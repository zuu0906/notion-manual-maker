// dev-test-ai.js — ai-fallback の Gemini 実往復スモーク（開発専用・要ネットワーク＋鍵）
//
// 使い方（desktop/ で実行）:
//   node main/automation/dev-test-ai.js
//
// .env.local の GEMINI_API_KEY を process.env へ読み込み、合成スクショ1枚で
// decideNextAction / verifyResult を1回ずつ叩く。API往復とJSONパース・正規化の
// 疎通確認が目的（要素特定の正確さは W5/E2E で検証）。本番不要。

const fs = require('fs');
const path = require('path');

// main.js と同じ素朴な .env.local ローダ
(function loadEnv() {
  try {
    const f = path.join(__dirname, '..', '..', '.env.local');
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.trim().match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    });
  } catch {}
})();

const ai = require('./ai-fallback');

// 小さな合成PNG（青背景に白い四角＝擬似ボタン, 200x120）を生成して data URL 化。
function makeFakeScreenshot() {
  const { createCanvas } = tryCanvas();
  if (createCanvas) {
    const c = createCanvas(200, 120);
    const g = c.getContext('2d');
    g.fillStyle = '#1e3a8a'; g.fillRect(0, 0, 200, 120);
    g.fillStyle = '#ffffff'; g.fillRect(60, 45, 80, 30);
    g.fillStyle = '#000000'; g.font = '16px sans-serif'; g.fillText('OK', 88, 66);
    return c.toDataURL('image/png');
  }
  // canvas 非導入環境では既知の 1x1 PNG で API 往復だけ確認
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
}
function tryCanvas() { try { return require('canvas'); } catch { return {}; } }

(async () => {
  console.log('isConfigured:', ai.isConfigured());
  if (!ai.isConfigured()) {
    console.error('GEMINI_API_KEY が読めていません（.env.local を確認）'); process.exit(1);
  }
  const screenshotDataUrl = makeFakeScreenshot();

  try {
    console.log('\n[decideNextAction] step="OKボタンをクリック" ...');
    const action = await ai.decideNextAction({
      screenshotDataUrl,
      step: { action: 'click', label: 'OKボタンをクリック', ocrContext: 'OK' },
    });
    console.log('  ->', JSON.stringify(action));
    assertShape(action.action && typeof action.confidence === 'number', 'decide の形が不正');

    console.log('\n[verifyResult] criteria="白いOKボタンが見える" ...');
    const v = await ai.verifyResult({
      screenshotDataUrl,
      successCriteria: '白いOKボタンが画面に表示されている',
      step: { label: 'OK確認' },
    });
    console.log('  ->', JSON.stringify(v));
    assertShape(['success', 'fail', 'uncertain'].includes(v.status), 'verify の status が不正');

    console.log('\nDONE — API往復・JSONパース・正規化すべて疎通OK');
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();

function assertShape(cond, msg) { if (!cond) throw new Error(msg); }
