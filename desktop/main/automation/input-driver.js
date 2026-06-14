// input-driver.js — 入力エミュレーション抽象層（W2 本実装）
//
// input-worker.ps1 を常駐 spawn し、stdin に JSON Lines でコマンドを送り、
// stdout の JSON 1行を対応する Promise に解決する。
//
// 採用方針: PowerShell 常駐ワーカー（既存 ocr.ps1 と同じ powershell -Sta パターン）。
// 抽象境界なので、将来 koffi(FFI) 等へ差し替えてもエンジン側は無改修。

const { spawn } = require('child_process');
const path = require('path');

const WORKER = path.join(__dirname, 'input-worker.ps1');
const CMD_TIMEOUT_MS = 5000;

let proc = null;
let ready = false;
let readyResolvers = [];
let buf = '';
let nextId = 1;
const pending = new Map(); // id -> { resolve, reject, timer }

function handleLine(line) {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  // 起動完了通知
  if (msg.id === 0 && msg.ready) {
    ready = true;
    readyResolvers.forEach(r => r());
    readyResolvers = [];
    return;
  }

  const p = pending.get(msg.id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(msg.id);
  if (msg.ok) p.resolve(msg);
  else p.reject(new Error(msg.error || 'worker_error'));
}

function spawnWorker() {
  proc = spawn(
    'powershell',
    ['-Sta', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', WORKER],
    { windowsHide: true }
  );
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      handleLine(line);
    }
  });
  proc.stderr.on('data', (d) => console.warn('[input-worker]', String(d).trim()));
  proc.on('exit', (code) => {
    ready = false;
    // 実行中の全コマンドを失敗させる（中断扱い）
    for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error('worker_exited')); }
    pending.clear();
    proc = null;
    if (code !== 0 && code !== null) console.warn('[input-worker] exited with code', code);
  });
}

async function init() {
  if (ready) return;
  if (!proc) spawnWorker();
  await new Promise((resolve, reject) => {
    if (ready) return resolve();
    readyResolvers.push(resolve);
    setTimeout(() => reject(new Error('worker_init_timeout')), 8000);
  });
}

function isReady() { return ready && !!proc; }

async function dispose() {
  if (proc) {
    try { proc.stdin.end(); } catch {}
    try { proc.kill(); } catch {}
  }
  proc = null;
  ready = false;
}

// コマンド送信。死活していれば respawn を1回試みる。
function send(cmd, extra = {}, timeoutMs = CMD_TIMEOUT_MS) {
  return new Promise(async (resolve, reject) => {
    if (!isReady()) {
      try { await init(); } catch (e) { return reject(e); }
    }
    const id = nextId++;
    const payload = JSON.stringify({ id, cmd, ...extra });
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`cmd_timeout: ${cmd}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try {
      proc.stdin.write(payload + '\n');
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(e);
    }
  });
}

module.exports = {
  init,
  dispose,
  isReady,
  ping: () => send('ping'),
  move: (x, y) => send('move', { x, y }),
  click: (x, y, button = 'left') => send('click', { x, y, button }),
  type: (text) => send('type', { text }, 10000),
  key: (vk) => send('key', { vk }),
  scroll: (delta) => send('scroll', { delta }),
  // 戻り値はウィンドウが実際に前面化できたか（foreground）。
  // 旧ワーカー互換のため foreground 未提供時は found を見る。
  activate: (q) => send('activate', q).then(r => (r.foreground !== undefined ? !!r.foreground : !!r.found)),
  foreground: () => send('foreground').then(r => ({ title: r.title, processName: r.processName, hwnd: r.hwnd })),
  launch: (p) => send('launch', { path: p }),
  uiaInspect: (x, y) => send('uiaInspect', { x, y }, 8000).then(r => {
    if (r.element === null) return null;
    return {
      name: r.name, controlType: r.controlType, automationId: r.automationId,
      className: r.className, isPassword: r.isPassword, path: r.path, rect: r.rect,
    };
  }),
  uiaFind: (uia) => send('uiaFind', { uia }, 8000).then(r => (r.found ? { rect: r.rect, score: r.score } : null)),
  uiaTreeSummary: () => Promise.resolve(''), // W4/W5 で必要になれば worker に uiaTree を追加
};
