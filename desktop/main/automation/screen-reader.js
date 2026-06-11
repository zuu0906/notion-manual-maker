// screen-reader.js — 現在画面のスクショ+OCR（W3で本実装）
//
// 既存 desktop/main/ocr-detector.js / ocr.ps1 のパターンを再利用する。
// 出力座標はすべて物理px。
//
// ⚠️ W1スタブ。

const NI = (name) => { throw new Error(`screen-reader.${name}: NOT_IMPLEMENTED (W3)`); };

module.exports = {
  /** @returns {Promise<{dataUrl,width,height,scaleFactor}>} */
  async capture() { return NI('capture'); },
  /** @returns {Promise<{words:{text,x,y,w,h}[]}>} */
  async ocr(/* dataUrl */) { return NI('ocr'); },
};
