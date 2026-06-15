// recorder.js — グローバル入力フックによる操作の自動記録（W15）
//
// uiohook-napi でマウスクリック/キー入力を受動的に拾い、自動実行フロー(Step[])を作る。
//   - クリック: 位置＋UIA要素＋ウィンドウ＋スクショを記録（実行時はUIA優先で再特定）。
//   - 入力: キー入力を検知し、沈静後に UIA でフォーカス要素の「値」を読む
//           （キーコード→文字変換やIMEの問題を避ける）。秘匿フィールドは値を保存しない。
//
// 【秘匿4段ガード】detectSecret():
//   ① UIA IsPassword（最優先・最も確実）
//   ② name / automationId のキーワード（パスワード/password/暗証/PIN/secret 等）
//   ③ value がマスク文字（●•＊…）で構成
//   ④ 既定（非秘匿）
//
// uiohook / input-driver / screen-reader / flow-store は注入可能（DIでテスト容易）。
// 純関数（detectSecret / buildClickStep / buildTypeStep）は node 単体テスト対象。

const SECRET_RE = /pass|password|パスワード|ﾊﾟｽﾜｰﾄﾞ|暗証|secret|秘密|pin\b/i;
const TYPE_SETTLE_MS = 350; // 連続入力が止まってから値を読むまでの待ち

// スタートメニュー/検索/シェル/IME 等は自動化の対象に不向き（前面化不可・非再現）。
// これらの上のクリックは記録しない。ApplicationFrameHost(UWPホスト)は正当なので除外しない。
const DEFAULT_IGNORE = [
  'startmenuexperiencehost', 'searchhost', 'searchapp', 'searchui',
  'shellexperiencehost', 'textinputhost', 'lockapp',
];

// タスクバー/トレイ等のシェル面はウィンドウクラスで判定して除外する
// （explorer.exe は File Explorer も兼ねるためプロセス名では切り分けられない）。
const IGNORE_CLASSNAMES = [
  'shell_traywnd', 'traynotifywnd', 'mstasklistwclass', 'mstaskswwclass',
  'notifyiconoverflowwindow', 'reblistview', 'systemtray.normalbutton',
];

// クリック対象が記録対象外（自アプリ/シェル/タスクバー）か
function shouldIgnoreClick(state, fg, uia) {
  if (fg && state.ignore.includes(String(fg.processName || '').toLowerCase())) return true;
  if (uia && IGNORE_CLASSNAMES.includes(String(uia.className || '').toLowerCase())) return true;
  return false;
}

// ── 純関数 ──────────────────────────────────────────────────────────────────
/** 秘匿4段ガード。@returns {{secret:boolean,tier:number}} */
function detectSecret(uia) {
  if (!uia) return { secret: false, tier: 0 };
  if (uia.isPassword === true) return { secret: true, tier: 1 };
  const hay = `${uia.name || ''} ${uia.automationId || ''}`;
  if (SECRET_RE.test(hay)) return { secret: true, tier: 2 };
  if (/[●•＊*]{3,}/.test(String(uia.value || ''))) return { secret: true, tier: 3 };
  return { secret: false, tier: 4 };
}

function prune(obj) {
  const out = {};
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function pickUia(uia) {
  if (!uia || !(uia.automationId || uia.name || uia.controlType)) return undefined;
  return prune({
    automationId: uia.automationId || undefined,
    name: uia.name || undefined,
    controlType: uia.controlType || undefined,
    className: uia.className || undefined,
  });
}

/** クリックStepを組み立てる（物理px前提）。 */
function buildClickStep({ stepNumber, x, y, button, fg, uia, shot }) {
  return prune({
    stepNumber,
    action: 'click',
    x, y,
    button: button === 'right' ? 'right' : undefined,
    windowTitle: (fg && fg.title) || undefined,
    processName: (fg && fg.processName) || undefined,
    viewportWidth: (shot && shot.width) || undefined,
    viewportHeight: (shot && shot.height) || undefined,
    label: (uia && (uia.name || uia.automationId)) || (fg && fg.title) || 'クリック',
    uia: pickUia(uia),
    screenshotDataUrl: (shot && shot.dataUrl) || undefined,
  });
}

/** 入力Stepを組み立てる。秘匿なら値を保存しない。 */
function buildTypeStep({ stepNumber, focused, fg }) {
  const { secret } = detectSecret(focused);
  const val = (focused && focused.value) || '';
  return prune({
    stepNumber,
    action: 'type',
    windowTitle: (fg && fg.title) || undefined,
    processName: (fg && fg.processName) || undefined,
    label: secret ? '（秘匿）を入力' : `「${val.slice(0, 20)}」を入力`,
    isSecret: secret || undefined,
    inputText: secret ? null : val,
    uia: pickUia(focused),
  });
}

// ── 記録オーケストレーション（状態あり）────────────────────────────────────
let state = null;

function defaultDeps() {
  return {
    uiohook: require('uiohook-napi').uIOhook,
    inputDriver: require('./input-driver'),
    screenReader: require('./screen-reader'),
    flowStore: require('./flow-store'),
  };
}

function isRecording() { return !!state; }

/**
 * 記録開始。
 * @param {{name?:string, manualId?:string, deps?:object, onProgress?:Function}} opts
 */
async function start(opts = {}) {
  if (state) return { ok: false, error: 'already_recording' };
  const deps = opts.deps || defaultDeps();
  await (deps.inputDriver.init ? deps.inputDriver.init() : Promise.resolve());

  state = {
    deps,
    name: opts.name || `記録 ${new Date().toLocaleString('ja-JP')}`,
    manualId: opts.manualId || null,
    // 自アプリ＋シェル系(Start/検索/IME等)のウィンドウ上のクリックは記録しない
    ignore: [...DEFAULT_IGNORE, ...(opts.ignoreProcessNames || []).map((s) => String(s).toLowerCase())],
    startProcs: new Set(),  // 記録開始時に動作中のプロセス名（小文字）。これに無い=記録中に起動
    launched: new Set(),    // 既に launch ステップを挿入したプロセス名
    steps: [],
    queue: Promise.resolve(),   // 非同期処理を直列化
    typingTimer: null,
    pendingType: null,          // {focused} 入力沈静後にUIAで読んだスナップショット
    onProgress: opts.onProgress || (() => {}),
    handlers: {},
  };

  // 記録開始時点で動作中のプロセスを控える（これ以降に現れたアプリ＝起動とみなす）
  try {
    if (typeof deps.inputDriver.procNames === 'function') {
      const names = await deps.inputDriver.procNames();
      for (const n of names) state.startProcs.add(String(n).toLowerCase());
    }
  } catch { /* 取得失敗時は起動検知なしで続行 */ }

  const enqueue = (fn) => { state.queue = state.queue.then(fn).catch(() => {}); return state.queue; };

  const onMouseDown = (e) => {
    if (!state) return;
    const button = e.button === 2 ? 'right' : 'left';
    enqueue(async () => {
      await flushType();
      await recordClick(e.x, e.y, button);
    });
  };
  const onKeyDown = () => {
    if (!state) return;
    if (state.typingTimer) clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => { enqueue(captureTypeSnapshot); }, TYPE_SETTLE_MS);
  };

  state.handlers = { onMouseDown, onKeyDown };
  deps.uiohook.on('mousedown', onMouseDown);
  deps.uiohook.on('keydown', onKeyDown);
  deps.uiohook.start();
  state.onProgress({ phase: 'recording', steps: 0 });
  return { ok: true };
}

async function captureTypeSnapshot() {
  if (!state) return;
  try {
    const focused = await state.deps.inputDriver.uiaFocused();
    if (focused) state.pendingType = { focused };
  } catch { /* 取得失敗は無視 */ }
}

// 記録中に新しいアプリが前面に出たら、その起動を launch ステップとして自動挿入する。
// （スタート/タスクバーのクリック自体は非再現で記録しないため、結果＝起動を捕まえる）
function maybeInsertLaunch(fg) {
  if (!fg) return;
  const pn = String(fg.processName || '').toLowerCase();
  if (!pn) return;
  if (state.startProcs.has(pn)) return;  // 記録前から動いていた＝起動操作ではない
  if (state.launched.has(pn)) return;    // 既に起動ステップ追加済み
  if (state.ignore.includes(pn)) return; // 自アプリ/シェル
  state.launched.add(pn);
  // Storeアプリのパス(WindowsApps配下)はバージョン依存で壊れやすく保護フォルダで起動も不安定。
  // その場合は processName.exe（Windowsが App Paths で名前解決）にフォールバック。
  let target = (fg.path && String(fg.path).trim()) || '';
  if (!target || /\\WindowsApps\\/i.test(target)) target = `${fg.processName}.exe`;
  state.steps.push(prune({
    stepNumber: state.steps.length + 1,
    action: 'launch',
    label: `${fg.processName} を起動`,
    launchTarget: target,
    waitMs: 1500,
  }));
  state.onProgress({ phase: 'recording', steps: state.steps.length });
}

async function flushType() {
  if (!state || !state.pendingType) return;
  const { focused } = state.pendingType;
  state.pendingType = null;
  const fg = await safeForeground();
  maybeInsertLaunch(fg);
  state.steps.push(buildTypeStep({ stepNumber: state.steps.length + 1, focused, fg }));
  state.onProgress({ phase: 'recording', steps: state.steps.length });
}

async function recordClick(x, y, button) {
  if (!state) return;
  const fg = await safeForeground();
  let uia = null;
  try { uia = await state.deps.inputDriver.uiaInspect(x, y); } catch {}
  // 自アプリ/シェル/タスクバー上のクリックは記録対象外
  if (shouldIgnoreClick(state, fg, uia)) return;
  maybeInsertLaunch(fg); // 新規アプリなら先に起動ステップを入れる
  let shot = null;
  try { shot = await state.deps.screenReader.capture(); } catch {}
  state.steps.push(buildClickStep({ stepNumber: state.steps.length + 1, x, y, button, fg, uia, shot }));
  state.onProgress({ phase: 'recording', steps: state.steps.length });
}

async function safeForeground() {
  try { return await state.deps.inputDriver.foreground(); } catch { return null; }
}

/**
 * 記録停止。フローを保存して flowId を返す。
 * @returns {Promise<{ok:boolean,id?:string,stepCount?:number,error?:string}>}
 */
async function stop() {
  if (!state) return { ok: false, error: 'not_recording' };
  const s = state;
  try { if (s.typingTimer) clearTimeout(s.typingTimer); } catch {}
  try { s.deps.uiohook.off && s.deps.uiohook.off('mousedown', s.handlers.onMouseDown); } catch {}
  try { s.deps.uiohook.off && s.deps.uiohook.off('keydown', s.handlers.onKeyDown); } catch {}
  try { s.deps.uiohook.removeListener && s.deps.uiohook.removeListener('mousedown', s.handlers.onMouseDown); } catch {}
  try { s.deps.uiohook.removeListener && s.deps.uiohook.removeListener('keydown', s.handlers.onKeyDown); } catch {}
  try { s.deps.uiohook.stop(); } catch {}

  await enqueueFlushAndDrain(s);

  state = null; // 先に止めて再入を防ぐ
  if (s.steps.length === 0) return { ok: false, error: 'no_steps' };
  let id;
  try {
    id = s.deps.flowStore.saveFlow({ name: s.name, manualId: s.manualId, steps: s.steps });
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return { ok: true, id, stepCount: s.steps.length };
}

// 残った入力スナップショットを反映してからキューを空にする
function enqueueFlushAndDrain(s) {
  s.queue = s.queue.then(async () => {
    if (s.pendingType) {
      const { focused } = s.pendingType;
      s.pendingType = null;
      let fg = null;
      try { fg = await s.deps.inputDriver.foreground(); } catch {}
      s.steps.push(buildTypeStep({ stepNumber: s.steps.length + 1, focused, fg }));
    }
  }).catch(() => {});
  return s.queue;
}

module.exports = {
  start, stop, isRecording,
  _internals: { detectSecret, buildClickStep, buildTypeStep, pickUia },
};
