const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function kwHash(keyword) {
  return crypto.createHash('md5').update(keyword).digest('hex').slice(0, 8);
}

function loadSerpCache(keyword) {
  const dir = path.join(__dirname, '..', 'serp-cache');
  const f = path.join(dir, `${kwHash(keyword)}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  return null;
}

function buildSerpSummary(serpData) {
  if (!serpData) return null;

  const h2Counts = {};
  for (const comp of serpData.competitorAnalysis || []) {
    for (const h of (comp.headings || []).filter(h => h.level === 'h2')) {
      h2Counts[h.text] = (h2Counts[h.text] || 0) + 1;
    }
  }
  const topH2s = Object.entries(h2Counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([text, count]) => ({ text, count }));

  const validCounts = (serpData.competitorAnalysis || [])
    .map(c => c.charCount)
    .filter(n => n > 500);
  const avgCharCount = validCounts.length
    ? Math.round(validCounts.reduce((a, b) => a + b, 0) / validCounts.length)
    : 2000;

  return {
    topH2s,
    avgCharCount,
    paaQuestions: serpData.paaQuestions || [],
    competitorCount: (serpData.competitorAnalysis || []).length,
  };
}

const CTA_HTML = `<div style="background:#fff5f5;border-left:4px solid #e53e3e;padding:16px;margin:24px 0;">
<p>📸 <strong>スクリーンショットを撮りながらNotionに貼るのが面倒…</strong>と感じたことはありませんか？</p>
<p><strong>Chrome Manual Maker</strong>を使えば、Chromeでクリックするだけでスクリーンショット＋赤丸注釈がNotionに自動保存されます。</p>
<a href="https://chrome-manual-maker.s-tasklog.com" style="display:inline-block;background:#e53e3e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Chrome Manual Makerを無料で試す →</a>
</div>`;

module.exports = { kwHash, loadSerpCache, buildSerpSummary, CTA_HTML };
