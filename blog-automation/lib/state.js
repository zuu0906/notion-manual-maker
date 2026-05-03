const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', 'state');

function ensureDir() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

function initRun(keyword, themeIndex) {
  ensureDir();
  const runId = Date.now().toString();
  const stateFile = path.join(STATE_DIR, `${runId}.json`);
  fs.writeFileSync(stateFile, JSON.stringify(
    { runId, keyword, themeIndex, startedAt: new Date().toISOString() },
    null, 2
  ));
  return { runId, stateFile };
}

function loadState(runId) {
  const f = path.join(STATE_DIR, `${runId}.json`);
  if (!fs.existsSync(f)) throw new Error(`ステートファイルが見つかりません: ${runId}`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function saveState(runId, patch) {
  const f = path.join(STATE_DIR, `${runId}.json`);
  const current = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  fs.writeFileSync(f, JSON.stringify({ ...current, ...patch }, null, 2));
}

function markDone(runId, article) {
  ensureDir();
  fs.writeFileSync(
    path.join(STATE_DIR, `${runId}.done.json`),
    JSON.stringify(article, null, 2)
  );
}

function markFailed(runId, error) {
  ensureDir();
  fs.writeFileSync(
    path.join(STATE_DIR, `${runId}.fail.json`),
    JSON.stringify({ error: error.message, failedAt: new Date().toISOString() }, null, 2)
  );
}

module.exports = { initRun, loadState, saveState, markDone, markFailed };
