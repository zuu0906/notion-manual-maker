// input-driver.js — 入力エミュレーション抽象層（W2で本実装）
//
// 採用方針: PowerShell 常駐ワーカー（input-worker.ps1）に stdin JSON Lines で指示。
// このファイルは抽象化境界。将来 koffi(FFI) 等へ差し替えてもエンジン側は無改修。
//
// ⚠️ W1スタブ: 実装は input-worker.ps1 と共に W2 で行う。
//   すべて NOT_IMPLEMENTED を投げ、replay-engine 側で握って AI/中断にフォールバックする。

const NI = (name) => { throw new Error(`input-driver.${name}: NOT_IMPLEMENTED (W2)`); };

let _started = false;

module.exports = {
  async init() { _started = true; /* W2: spawn input-worker.ps1 */ },
  async dispose() { _started = false; },
  isReady() { return _started; },

  async move(/* x, y */) { return NI('move'); },
  async click(/* x, y, button */) { return NI('click'); },
  async type(/* text */) { return NI('type'); },
  async key(/* vk */) { return NI('key'); },
  async scroll(/* delta */) { return NI('scroll'); },
  async activate(/* {titleSubstr, processName} */) { return NI('activate'); },
  async foreground() { return NI('foreground'); },
  async launch(/* path */) { return NI('launch'); },

  // UI Automation
  async uiaInspect(/* x, y */) { return NI('uiaInspect'); },
  async uiaFind(/* uia */) { return NI('uiaFind'); },
  async uiaTreeSummary(/* opts */) { return NI('uiaTreeSummary'); },
};
