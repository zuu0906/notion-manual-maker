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
    suggestions: serpData.suggestions?.merged || [],
    googleSuggestions: serpData.suggestions?.google || [],
    yahooSuggestions: serpData.suggestions?.yahoo || [],
    relatedSearches: serpData.relatedSearches || [],
    snippets: (serpData.organicResults || []).map(r => r.snippet).filter(Boolean),
    competitorBodyTexts: (serpData.competitorAnalysis || [])
      .map(c => c.bodyText || '')
      .filter(t => t.length > 100),
  };
}

const CTA_HTML = `<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:20px 24px;margin:32px 0;">
<p style="font-size:16px;font-weight:700;margin:0 0 8px;">📸 Notionのマニュアル作成、まだ手動でやっていますか？</p>
<p style="margin:0 0 16px;color:#4b5563;">クリックするだけでスクリーンショット＋赤丸注釈が自動でNotionに保存される Chrome 拡張機能です。無料プランあり・インストール30秒。</p>
<div style="display:flex;gap:12px;flex-wrap:wrap;">
<a href="https://chromewebstore.google.com/detail/kapchgeffhkfffhflcpjjkiojneipicd" style="display:inline-block;background:#e53e3e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">無料でインストール →</a>
<a href="https://chromewebstore.google.com/detail/kapchgeffhkfffhflcpjjkiojneipicd" style="display:inline-block;background:#fff;color:#e53e3e;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;border:1px solid #e53e3e;">詳細を見る</a>
</div>
</div>`;

module.exports = { kwHash, loadSerpCache, buildSerpSummary, CTA_HTML };
