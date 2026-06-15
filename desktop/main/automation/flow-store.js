// flow-store.js — ローカルフローの永続化（W1で実装）
//
// 保存先: <userData>/automation/flows/<id>/flow.json + step-N.png
// steps[] はメモリ内クリア後も残す必要があるため、electron-store ではなく
// ファイルシステムに独立保存する（画像が大きく electron-store の単一JSONに不向き）。
//
// 注意: inputText など機微情報の暗号化は Phase 7（safeStorage）で対応。
//       現段階では isSecret ステップの inputText は記録側で null にして保存しない。

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let baseDir = null;

/** @param {string} userDataPath app.getPath('userData') */
function init(userDataPath) {
  baseDir = path.join(userDataPath, 'automation', 'flows');
  fs.mkdirSync(baseDir, { recursive: true });
}

function flowDir(id) {
  return path.join(baseDir, id);
}
function flowFile(id) {
  return path.join(flowDir(id), 'flow.json');
}

function ensureInit() {
  if (!baseDir) throw new Error('flow-store not initialized — call init(userDataPath) first');
}

function listFlows() {
  ensureInit();
  let ids = [];
  try {
    ids = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch { return []; }
  const flows = [];
  for (const id of ids) {
    const f = getFlow(id);
    if (f) {
      flows.push({
        id: f.id,
        name: f.name,
        stepCount: Array.isArray(f.steps) ? f.steps.length : 0,
        manualId: f.manualId || null,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      });
    }
  }
  flows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return flows;
}

/** @returns {object|null} 完全な Flow オブジェクト */
function getFlow(id) {
  ensureInit();
  try {
    const raw = fs.readFileSync(flowFile(id), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * フローを保存（新規 or 上書き）。
 * 画像（step.screenshotDataUrl があれば）は step-N.png に書き出し、
 * flow.json には screenshotFile（相対パス）のみ残す。
 * @returns {string} flow id
 */
function saveFlow(flow) {
  ensureInit();
  const id = flow.id || crypto.randomUUID();
  const dir = flowDir(id);
  fs.mkdirSync(dir, { recursive: true });

  const now = Date.now();
  const steps = (flow.steps || []).map((s, i) => {
    const step = { ...s };
    if (step.screenshotDataUrl) {
      const file = `step-${i + 1}.png`;
      const b64 = String(step.screenshotDataUrl).replace(/^data:image\/\w+;base64,/, '');
      try { fs.writeFileSync(path.join(dir, file), Buffer.from(b64, 'base64')); } catch {}
      step.screenshotFile = file;
      delete step.screenshotDataUrl;
    }
    // 安全側: 秘匿ステップの入力値は保存しない
    if (step.isSecret) step.inputText = null;
    return step;
  });

  const out = {
    id,
    name: flow.name || '無題のフロー',
    manualId: flow.manualId || null,
    steps,
    createdAt: flow.createdAt || now,
    updatedAt: now,
  };
  fs.writeFileSync(flowFile(id), JSON.stringify(out, null, 2), 'utf8');
  return id;
}

function deleteFlow(id) {
  ensureInit();
  try { fs.rmSync(flowDir(id), { recursive: true, force: true }); } catch {}
}

/** ステップ単位の部分更新（W7 フロー編集 / NLエディタが利用） */
function updateStep(id, idx, patch) {
  ensureInit();
  const flow = getFlow(id);
  if (!flow || !flow.steps[idx]) return;
  backup(id);
  flow.steps[idx] = { ...flow.steps[idx], ...patch };
  if (flow.steps[idx].isSecret) flow.steps[idx].inputText = null;
  flow.updatedAt = Date.now();
  fs.writeFileSync(flowFile(id), JSON.stringify(flow, null, 2), 'utf8');
}

/**
 * 操作リストの一括適用（NLエディタ・W7b 用の土台）。
 * ops: [{op:'delete_step',index}|{op:'reorder',from,to}|{op:'update',index,patch}|...]
 * W1 では delete/reorder/update の基本3種を実装。残りは Phase 2 で拡張。
 */
function applyOps(id, ops) {
  ensureInit();
  const flow = getFlow(id);
  if (!flow) return;
  backup(id);
  for (const op of ops || []) {
    if (op.op === 'delete_step') {
      flow.steps.splice(op.index, 1);
    } else if (op.op === 'reorder') {
      const [m] = flow.steps.splice(op.from, 1);
      if (m) flow.steps.splice(op.to, 0, m);
    } else if (op.op === 'set_order') {
      // 全ステップの新しい並び順を一発指定（決定論的・連鎖reorderの曖昧さを回避）。
      const order = op.order;
      if (Array.isArray(order) && order.length === flow.steps.length) {
        const ok = order.every((n) => Number.isInteger(n) && n >= 0 && n < flow.steps.length)
          && new Set(order).size === order.length;
        if (ok) flow.steps = order.map((i) => flow.steps[i]);
      }
    } else if (op.op === 'update') {
      if (flow.steps[op.index]) flow.steps[op.index] = { ...flow.steps[op.index], ...op.patch };
    } else if (op.op === 'insert_step') {
      // 編集UIからのステップ挿入（アプリ起動ステップ等）。NLエディタからは呼ばれない。
      if (op.step && typeof op.step === 'object') {
        const idx = Math.max(0, Math.min(flow.steps.length, parseInt(op.index, 10) || 0));
        flow.steps.splice(idx, 0, { ...op.step });
      }
    }
  }
  // stepNumber を振り直す
  flow.steps.forEach((s, i) => { s.stepNumber = i + 1; });
  flow.updatedAt = Date.now();
  fs.writeFileSync(flowFile(id), JSON.stringify(flow, null, 2), 'utf8');
}

/** フロー名の変更（W7 編集UI）。1世代バックアップを取ってから更新。 */
function renameFlow(id, name) {
  ensureInit();
  const flow = getFlow(id);
  if (!flow) return;
  backup(id);
  flow.name = String(name || '').trim() || flow.name || '無題のフロー';
  flow.updatedAt = Date.now();
  fs.writeFileSync(flowFile(id), JSON.stringify(flow, null, 2), 'utf8');
}

/** 1世代バックアップ（undo用）。flow.json → flow.bak.json */
function backup(id) {
  ensureInit();
  try {
    fs.copyFileSync(flowFile(id), path.join(flowDir(id), 'flow.bak.json'));
  } catch {}
}

/** バックアップから復元。@returns {boolean} 成功可否 */
function restore(id) {
  ensureInit();
  const bak = path.join(flowDir(id), 'flow.bak.json');
  try {
    fs.copyFileSync(bak, flowFile(id));
    return true;
  } catch {
    return false;
  }
}

/** W14: 実行レポートを履歴へ追記（最新MAX件のみ保持）。runs.json に保存。 */
const MAX_RUN_LOG = 20;
function appendRunLog(id, entry) {
  ensureInit();
  const dir = flowDir(id);
  if (!fs.existsSync(dir)) return;
  const file = path.join(dir, 'runs.json');
  let log = [];
  try { log = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(log)) log = []; } catch { log = []; }
  log.unshift(entry);
  if (log.length > MAX_RUN_LOG) log = log.slice(0, MAX_RUN_LOG);
  try { fs.writeFileSync(file, JSON.stringify(log, null, 2), 'utf8'); } catch {}
}

/** 実行履歴を新しい順で返す。 */
function getRunLog(id) {
  ensureInit();
  try { const l = JSON.parse(fs.readFileSync(path.join(flowDir(id), 'runs.json'), 'utf8')); return Array.isArray(l) ? l : []; }
  catch { return []; }
}

/** ステップのスクショ絶対パス（HUD/編集UIのプレビュー用） */
function screenshotPath(id, file) {
  ensureInit();
  return path.join(flowDir(id), file);
}

module.exports = {
  init, listFlows, getFlow, saveFlow, deleteFlow,
  updateStep, applyOps, renameFlow, backup, restore, screenshotPath,
  appendRunLog, getRunLog,
};
