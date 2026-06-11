// matcher.js — ロケーター特定（純関数中心・W3で本実装、単体テスト付き）
//
// 第1階層 UIA スコアリング / 第2階層 OCRアンカー座標補正。
// すべて物理px。論理px→物理pxの変換は toPhysical() に一元化（DPIズレ防止の要）。
//
// ⚠️ W1: toPhysical のみ実装（座標系の基準を確定）。match系は W3。

/**
 * 記録時の論理px座標を物理pxへ変換。
 * 既存 steps[].x/y は記録時の論理px、viewportWidth/Height は記録時の論理サイズ。
 * @param {object} step
 * @param {number} scaleFactor 記録時の scaleFactor（無ければ現在値）
 * @returns {{x:number,y:number}}
 */
function toPhysical(step, scaleFactor) {
  const sf = scaleFactor || step.scaleFactor || 1;
  return { x: Math.round(step.x * sf), y: Math.round(step.y * sf) };
}

const NI = (name) => { throw new Error(`matcher.${name}: NOT_IMPLEMENTED (W3)`); };

module.exports = {
  toPhysical,
  /** @returns {Promise<LocateResult|null>} */
  async matchByUia(/* step, uiaFind */) { return NI('matchByUia'); },
  /** @returns {LocateResult|null} */
  matchByOcr(/* step, currentWords, curSize */) { return NI('matchByOcr'); },
};
