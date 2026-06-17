// manual-to-flow.js — マニュアル（スクショ＋クリック点＋周辺OCR）→ 自動実行 Flow へ変換
//
// マニュアル作成フロー（main.js の overlay:captured）が各ステップに記録するもの:
//   { stepNumber, x, y, viewportWidth, viewportHeight, rawDataUrl, ocrContext, label, memo, ... }
// 座標は「論理px」（OCR語も論理px）。automation Step の規約と一致し、再生時に
// matcher.toPhysical() が scaleFactor を掛けて物理pxへ変換する（ここでは変換しない）。
//
// このモジュールは「種別の推定とマッピング」だけを担う。実行系（replay-engine /
// input-driver / matcher / ai-fallback）はすべて既存資産を再利用する。
//
// AI（ai-fallback.inferStepAction）が click/type・秘匿・入力値・成功条件を推定する。
// AI 未設定や失敗時は安全側に倒して全ステップ 'click' とする（鍵なしでも動く）。

/**
 * 1 件のマニュアルステップ＋AI推定 → Flow Step（純関数・ネットワーク非依存）。
 * @param {object} manualStep  main.js が steps.push した形
 * @param {{action:string,isSecret?:boolean,inputText?:string|null,promptAtRuntime?:boolean,successCriteria?:string}} plan
 * @param {number} index  0 始まり
 * @returns {object} Flow Step（screenshotDataUrl は saveFlow が step-N.png に永続化）
 */
function buildFlowStep(manualStep = {}, plan = {}, index = 0) {
  const action = plan.action === 'type' ? 'type' : 'click';
  const step = {
    stepNumber: manualStep.stepNumber || index + 1,
    action,
    x: Math.round(Number(manualStep.x) || 0),
    y: Math.round(Number(manualStep.y) || 0),
    viewportWidth: manualStep.viewportWidth || 0,
    viewportHeight: manualStep.viewportHeight || 0,
  };

  if (manualStep.label) step.label = String(manualStep.label).slice(0, 200);
  if (manualStep.memo) step.memo = String(manualStep.memo).slice(0, 1000);
  if (manualStep.ocrContext) step.ocrContext = String(manualStep.ocrContext).slice(0, 300);

  // 第1階層（UIA）: 撮影時に採取できていれば引き継ぐ（Slice 2 で付与）。
  if (manualStep.uia && typeof manualStep.uia === 'object') step.uia = manualStep.uia;
  if (manualStep.windowTitle) step.windowTitle = String(manualStep.windowTitle);
  if (manualStep.processName) step.processName = String(manualStep.processName);

  if (action === 'type') {
    if (plan.isSecret) {
      step.isSecret = true;
      step.inputText = null;
      step.promptAtRuntime = true;
    } else if (typeof plan.inputText === 'string' && plan.inputText.length > 0) {
      step.inputText = plan.inputText;
      step.promptAtRuntime = false;
    } else {
      step.inputText = null;
      step.promptAtRuntime = true; // 入力内容が不明 → 実行時に尋ねる
    }
  }

  if (plan.successCriteria) step.successCriteria = String(plan.successCriteria).slice(0, 200);

  // クリーンなスクショ（赤マーカー無し）を保存。AI/OCR 照合の精度が上がる。
  const shot = manualStep.rawDataUrl || manualStep.screenshotDataUrl;
  if (shot) step.screenshotDataUrl = shot;

  return step;
}

/**
 * マニュアル全体 → 保存可能な Flow（saveFlow にそのまま渡せる形）。
 * @param {{name?:string, manualId?:string|null, steps:object[]}} manual
 * @param {{ai?:object, onProgress?:(p:{index:number,total:number})=>void}} [deps]
 * @returns {Promise<{name:string, manualId:string|null, steps:object[]}>}
 */
async function convertManualToFlow(manual = {}, deps = {}) {
  const srcSteps = Array.isArray(manual.steps) ? manual.steps : [];
  const ai = deps.ai;
  const aiUsable = !!(ai && typeof ai.inferStepAction === 'function' &&
    typeof ai.isConfigured === 'function' && ai.isConfigured());

  const steps = [];
  for (let i = 0; i < srcSteps.length; i++) {
    const ms = srcSteps[i];
    let plan = { action: 'click' };
    if (aiUsable) {
      try {
        plan = await ai.inferStepAction({
          screenshotDataUrl: ms.rawDataUrl || ms.screenshotDataUrl,
          step: { label: ms.label, memo: ms.memo, ocrContext: ms.ocrContext },
        });
      } catch {
        plan = { action: 'click' }; // 失敗は安全な click に倒す
      }
    }
    steps.push(buildFlowStep(ms, plan, i));
    if (typeof deps.onProgress === 'function') {
      try { deps.onProgress({ index: i + 1, total: srcSteps.length }); } catch {}
    }
  }

  const name = (manual.name && String(manual.name).trim()) || '無題のマニュアル';
  return {
    name: name.slice(0, 120),
    manualId: manual.manualId || null,
    steps,
  };
}

module.exports = { convertManualToFlow, buildFlowStep };
