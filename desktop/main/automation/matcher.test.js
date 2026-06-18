// matcher.test.js — ハイブリッド突き合わせ(reconcile)とUIA曖昧解消の node 単体テスト
// 実行: node main/automation/matcher.test.js

const assert = require('assert');
const matcher = require('./matcher');
const { reconcile, matchByUia } = matcher;

let pass = 0;
const pending = [];
function t(name, fn) { pending.push([name, fn]); }

const uiaWithRect = { x: 50, y: 50, rect: { x: 40, y: 40, w: 20, h: 20 }, candidates: 1, ambiguous: false, confidence: 1, method: 'uia', reason: 'uia score=1' };

// ── reconcile ────────────────────────────────────────────────────────────────
t('reconcile: UIAのみ → use', () => {
  const r = reconcile(uiaWithRect, null);
  assert.strictEqual(r.decision, 'use');
  assert.strictEqual(r.loc.method, 'uia');
});

t('reconcile: UIAのみ・曖昧 → use だが信頼度を 0.6 以下に', () => {
  const amb = { ...uiaWithRect, candidates: 3, ambiguous: true, confidence: 1 };
  const r = reconcile(amb, null);
  assert.strictEqual(r.decision, 'use');
  assert.ok(r.loc.confidence <= 0.6);
});

t('reconcile: OCRのみ・強 → use', () => {
  const r = reconcile(null, { x: 5, y: 5, confidence: 0.9, method: 'ocr' });
  assert.strictEqual(r.decision, 'use');
  assert.strictEqual(r.loc.method, 'ocr');
});

t('reconcile: OCRのみ・弱 → weak', () => {
  const r = reconcile(null, { x: 5, y: 5, confidence: 0.4, method: 'ocr' });
  assert.strictEqual(r.decision, 'weak');
});

t('reconcile: 両方一致(OCR点がUIA矩形内) → use・信頼度は高い方', () => {
  const ocr = { x: 52, y: 52, confidence: 0.78, method: 'ocr' }; // rect 40..60 内
  const r = reconcile(uiaWithRect, ocr);
  assert.strictEqual(r.decision, 'use');
  assert.strictEqual(r.loc.method, 'uia');
  assert.strictEqual(r.loc.confidence, 1);
});

t('reconcile: 両方不一致(OCR点がUIA矩形外) → conflict（AI裁定へ）', () => {
  const ocr = { x: 500, y: 500, confidence: 0.9, method: 'ocr' };
  const r = reconcile(uiaWithRect, ocr);
  assert.strictEqual(r.decision, 'conflict');
  assert.strictEqual(r.loc, null);
});

t('reconcile: rect 無しUIAは中心距離で一致判定', () => {
  const uiaNoRect = { x: 100, y: 100, confidence: 1, method: 'uia' };
  assert.strictEqual(reconcile(uiaNoRect, { x: 120, y: 110, confidence: 0.9 }).decision, 'use'); // 距離≈22≤40
  assert.strictEqual(reconcile(uiaNoRect, { x: 300, y: 300, confidence: 0.9 }).decision, 'conflict');
});

t('reconcile: どちらも無し → none', () => {
  assert.strictEqual(reconcile(null, null).decision, 'none');
});

// ── matchByUia（曖昧解消・候補数）─────────────────────────────────────────────
t('matchByUia: uia 情報が無ければ null', async () => {
  assert.strictEqual(await matchByUia({ x: 1, y: 1 }, async () => ({})), null);
});

t('matchByUia: 識別子皆無なら null（誤特定防止）', async () => {
  assert.strictEqual(await matchByUia({ uia: {} }, async () => ({})), null);
});

t('matchByUia: 記録座標を物理pxへ変換して uiaFind に渡す', async () => {
  let received = null;
  const uiaFind = async (_u, point) => { received = point; return { rect: { x: 0, y: 0, w: 10, h: 10 }, score: 1, candidates: 1 }; };
  await matchByUia({ uia: { name: 'A' }, x: 100, y: 200 }, uiaFind, 2); // scaleFactor=2
  assert.deepStrictEqual(received, { x: 200, y: 400 });
});

t('matchByUia: 中心座標・candidates・ambiguous を返す', async () => {
  const uiaFind = async () => ({ rect: { x: 40, y: 40, w: 20, h: 20 }, score: 1, candidates: 3 });
  const loc = await matchByUia({ uia: { name: 'A' }, x: 1, y: 1 }, uiaFind, 1);
  assert.strictEqual(loc.x, 50);
  assert.strictEqual(loc.y, 50);
  assert.strictEqual(loc.candidates, 3);
  assert.strictEqual(loc.ambiguous, true);
});

t('matchByUia: スコアが閾値未満なら null', async () => {
  const uiaFind = async () => ({ rect: { x: 0, y: 0, w: 10, h: 10 }, score: 0.3, candidates: 1 });
  assert.strictEqual(await matchByUia({ uia: { name: 'A' }, x: 1, y: 1 }, uiaFind, 1), null);
});

// ── ランナー ──────────────────────────────────────────────────────────────────
(async () => {
  for (const [name, fn] of pending) {
    try { await fn(); pass++; console.log('  ok  -', name); }
    catch (e) { console.error('FAIL -', name, '\n     ', e.message); process.exitCode = 1; }
  }
  console.log(`\n${pass}/${pending.length} passed`);
})();
