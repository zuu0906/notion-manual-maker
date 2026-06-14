// replay-engine.js — ハイブリッド実行ステートマシン（W5 本実装・統合点）
//
// ステップごと: ①ウィンドウ前面化 → ②安全/確認 → ③ロケーター階層
//   （UIA→OCR→AIフォールバック）→ ④実行（click/type/key/scroll/wait）。
//
// 【座標規約の境界をここに集約】
//   - matcher / screen-reader / input-driver はすべて「物理px」。
//   - ai-fallback は「スクショに対する 0..1000 正規化」→ ここで物理pxへ変換。
//
// 【安全方針】
//   - 3階層すべてで特定できなければブラインドクリックせず step を失敗にする（誤操作防止）。
//   - 危険操作（safety.isDangerous）は onConfirm 無しでは実行しない。
//   - 失敗・中断は即座にフローを停止（途中からの誤操作連鎖を防ぐ。フロー全体リトライ禁止）。
//
// 依存は注入可能（opts.deps）。Electron/PowerShell 非依存で単体テストするため。

const defaultDeps = {
  inputDriver: require('./input-driver'),
  screenReader: require('./screen-reader'),
  matcher: require('./matcher'),
  ai: require('./ai-fallback'),
  safety: require('./safety'),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

const OCR_ACCEPT = 0.6;     // この信頼度以上の OCR 一致は採用、未満は AI へ委ねる
const ACT_SETTLE_MS = 250;  // 前面化/操作後に画面が落ち着くのを待つ
const STEP_GAP_MS = 120;    // ステップ間の小休止

/**
 * @param {object} flow  Flow
 * @param {object} opts  RunOptions（mode/onProgress/onConfirm/onRuntimeInput/shouldAbort/deps）
 * @returns {Promise<{status:'success'|'aborted'|'failed'|'engine_not_ready',results:object[],error?:string}>}
 */
async function run(flow, opts = {}) {
  const deps = { ...defaultDeps, ...(opts.deps || {}) };
  const { inputDriver, screenReader, matcher, ai, safety, sleep } = deps;

  if (!flow || !Array.isArray(flow.steps) || flow.steps.length === 0) {
    return { status: 'failed', results: [], error: 'empty_flow' };
  }
  if (!inputDriver.isReady || !inputDriver.isReady()) {
    return { status: 'engine_not_ready', results: [], error: 'input_driver_not_ready' };
  }

  const mode = opts.mode || 'supervised';
  const dryRun = !!opts.dryRun;
  const total = flow.steps.length;
  const results = [];
  const report = (stepNumber, phase, extra = {}) =>
    opts.onProgress && opts.onProgress({ stepNumber, total, phase, ...extra });
  const aborted = () => typeof opts.shouldAbort === 'function' && opts.shouldAbort();

  for (let i = 0; i < total; i++) {
    const step = flow.steps[i];
    const stepNumber = step.stepNumber || i + 1;
    const label = step.label || '';
    if (aborted()) return { status: 'aborted', results };

    // ① 対象ウィンドウを前面化（best-effort）
    report(stepNumber, 'locating', { label });
    await activateWindow(step, inputDriver);
    await sleep(ACT_SETTLE_MS);
    if (aborted()) return { status: 'aborted', results };

    // ② 安全/確認（ドライランは実行しないので確認不要）
    const dangerous = safety.isDangerous(step);
    if (!dryRun) {
      const wantConfirm = dangerous || mode === 'step_by_step';
      if (wantConfirm) {
        if (typeof opts.onConfirm === 'function') {
          report(stepNumber, 'confirm', { label });
          const ok = await opts.onConfirm({ message: confirmMessage(step, dangerous), danger: dangerous, step });
          if (!ok) return { status: 'aborted', results };
        } else if (dangerous) {
          // 危険操作は確認手段が無ければ実行しない
          results.push({ stepNumber, action: step.action, status: 'failed', reason: 'confirmation_required' });
          return { status: 'failed', results, error: 'confirmation_required' };
        }
        // step_by_step かつ onConfirm 無し → そのまま続行
      }
    }
    if (aborted()) return { status: 'aborted', results };

    // ③ ロケーター + ④ 実行（dryRun時は特定のみ・実行しない）
    let res;
    try {
      res = await executeStep(step, { deps, report, opts, mode, dryRun });
    } catch (e) {
      res = { stepNumber, action: step.action, status: 'failed', reason: e.message };
    }
    if (dangerous) res.dangerous = true;
    results.push(res);
    // ドライランは失敗でも止めず全ステップを評価。本実行は失敗で即停止。
    if (!dryRun && res.status !== 'ok') {
      return { status: 'failed', results, error: res.reason };
    }
    await sleep(dryRun ? 0 : STEP_GAP_MS);
  }

  const allOk = results.every((r) => r.status === 'ok');
  return { status: allOk ? 'success' : 'failed', results, dryRun };
}

// ── 1ステップの特定＋実行（dryRun=true なら特定のみで実行しない）────────────
async function executeStep(step, { deps, report, opts, dryRun }) {
  const { inputDriver, screenReader, matcher, ai, sleep } = deps;
  const action = (step.action || 'click').toLowerCase();
  const stepNumber = step.stepNumber || 0;
  const label = step.label || '';

  // 座標を要さないアクションは先に処理
  if (action === 'wait') {
    report(stepNumber, 'acting', { label });
    if (!dryRun) await sleep(Math.max(0, Number(step.waitMs) || 500));
    return ok(step, { method: 'none' });
  }
  if (action === 'key') {
    report(stepNumber, 'acting', { label });
    const vk = String(step.vk || step.key || '').trim();
    if (!vk) return fail(step, 'missing_key');
    if (!dryRun) await inputDriver.key(vk);
    return ok(step, { method: 'none' });
  }
  if (action === 'type') {
    report(stepNumber, 'acting', { label });
    // ドライランは実際の値解決(プロンプト)をせず、実行時入力が要るかだけ判定
    if (dryRun) {
      const willPrompt = (step.isSecret && step.inputText == null) || step.promptAtRuntime;
      return ok(step, { method: 'none', reason: willPrompt ? 'prompt_at_runtime' : 'ready' });
    }
    const text = await resolveTypeText(step, opts);
    if (text == null) return fail(step, 'secret_input_required');
    await inputDriver.type(text);
    return ok(step, { method: 'none' });
  }

  // click / scroll は対象座標が必要 → ロケーター階層で物理pxを得る
  const located = await locate(step, { deps, report });
  if (!located) return fail(step, 'target_not_found');

  report(stepNumber, 'acting', { label, method: located.method });
  if (!dryRun) {
    if (action === 'scroll') {
      await inputDriver.move(located.x, located.y);
      await inputDriver.scroll(resolveScrollDelta(step, located));
    } else {
      // click（既定）
      await inputDriver.click(located.x, located.y, step.button === 'right' ? 'right' : 'left');
    }
  }
  return ok(step, { method: located.method, confidence: located.confidence, x: located.x, y: located.y, reason: located.reason });
}

// ── ロケーター3階層（UIA → OCR → AI）。返り値は物理px or null ──────────────
async function locate(step, { deps, report }) {
  const { inputDriver, screenReader, matcher, ai } = deps;
  const stepNumber = step.stepNumber || 0;

  // ① UIA
  const uiaLoc = await matcher.matchByUia(step, inputDriver.uiaFind);
  if (uiaLoc) return uiaLoc;

  // 現在画面を1回キャプチャ（OCR / AI で共用）
  let cap;
  try { cap = await screenReader.capture(); } catch { cap = null; }
  if (!cap) return null;

  // ② OCR
  let ocrLoc = null;
  try {
    const { words } = await screenReader.ocr(cap.dataUrl);
    ocrLoc = matcher.matchByOcr(step, words, { w: cap.width, h: cap.height });
  } catch { /* OCR失敗は無視してAIへ */ }
  if (ocrLoc && ocrLoc.confidence >= OCR_ACCEPT) return ocrLoc;

  // ③ AI フォールバック
  if (ai.isConfigured && ai.isConfigured()) {
    report(stepNumber, 'ai-fallback', { label: step.label || '' });
    try {
      const aiLoc = await aiLocate(step, cap, ai);
      if (aiLoc) return aiLoc;
    } catch { /* AI失敗は下の弱OCRへ */ }
  }

  // 最後の頼み: 信頼度の低い OCR 一致があればそれを使う（無ければ失敗）
  return ocrLoc || null;
}

// AI の 0..1000 正規化座標を物理pxへ変換して LocateResult に整える。
async function aiLocate(step, cap, ai) {
  const recordedCropDataUrl = undefined; // W3のクロップ供給は後続（任意）
  const a = await ai.decideNextAction({
    screenshotDataUrl: cap.dataUrl,
    recordedCropDataUrl,
    step,
  });
  if (!a || a.action === 'fail') return null;
  if (a.x == null || a.y == null) return null;
  return {
    x: Math.round((a.x / 1000) * cap.width),
    y: Math.round((a.y / 1000) * cap.height),
    confidence: typeof a.confidence === 'number' ? a.confidence : 0.5,
    method: 'ai',
    reason: a.reason || 'ai',
  };
}

// ── ヘルパー ────────────────────────────────────────────────────────────────
async function activateWindow(step, inputDriver) {
  let q = null;
  if (step.processName) q = { processName: step.processName };
  else if (step.windowTitle) q = { titleSubstr: step.windowTitle };
  if (!q) return false;
  try { return await inputDriver.activate(q); } catch { return false; }
}

async function resolveTypeText(step, opts) {
  if (step.isSecret && (step.inputText == null)) {
    if (typeof opts.onRuntimeInput === 'function') {
      const v = await opts.onRuntimeInput(step);
      return v == null ? null : String(v);
    }
    return null; // 秘匿値が無く、実行時入力手段も無い
  }
  if (step.promptAtRuntime && typeof opts.onRuntimeInput === 'function') {
    const v = await opts.onRuntimeInput(step);
    if (v != null) return String(v);
  }
  return String(step.inputText != null ? step.inputText : '');
}

function resolveScrollDelta(step, located) {
  if (Number.isFinite(Number(step.scrollDelta))) return Number(step.scrollDelta);
  // AIが text に 'up'/'down' を入れた場合に対応
  const dir = (located && located.dir) || step.scrollDir;
  return dir === 'up' ? -300 : 300;
}

function confirmMessage(step, dangerous) {
  const what = step.label || step.action || '操作';
  return dangerous ? `「${what}」は取り消せない操作の可能性があります。実行しますか？` : `「${what}」を実行しますか？`;
}

function ok(step, extra) {
  return { stepNumber: step.stepNumber || 0, action: step.action || 'click', status: 'ok', ...extra };
}
function fail(step, reason) {
  return { stepNumber: step.stepNumber || 0, action: step.action || 'click', status: 'failed', reason };
}

module.exports = { run };
