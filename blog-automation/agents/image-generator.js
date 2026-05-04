const puppeteer = require('puppeteer');
const { callClaude } = require('../lib/claude');

const COLORS = ['#3b82f6', '#f59e0b', '#10b981'];

function buildHtml(keyword, headline, points) {
  const cards = points.map((p, i) => `
    <div class="point" style="--c:${COLORS[i % COLORS.length]}">
      <div class="icon">${p.icon}</div>
      <div class="label">${p.label}</div>
      <div class="desc">${p.desc}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1200px; height:630px;
    font-family:'Yu Gothic','Meiryo','Hiragino Sans',sans-serif;
    background:#f8fafc;
    display:flex; flex-direction:column;
    padding:44px 56px;
    overflow:hidden; position:relative;
  }
  body::before {
    content:''; position:absolute;
    width:400px; height:400px; border-radius:50%;
    background:#e53e3e; opacity:0.05;
    top:-120px; right:-80px;
  }
  .badge {
    display:inline-block; align-self:flex-start;
    background:#e53e3e; color:#fff;
    font-size:14px; font-weight:700;
    padding:5px 14px; border-radius:4px;
    margin-bottom:14px;
  }
  .headline {
    font-size:34px; font-weight:900;
    color:#1a202c; line-height:1.35;
    margin-bottom:32px;
  }
  .headline em { color:#e53e3e; font-style:normal; }
  .points { display:flex; gap:20px; flex:1; }
  .point {
    flex:1; background:#fff;
    border-radius:14px; padding:26px 22px;
    border-top:5px solid var(--c);
    box-shadow:0 2px 12px rgba(0,0,0,0.07);
    display:flex; flex-direction:column; gap:12px;
  }
  .icon { font-size:38px; line-height:1; }
  .label { font-size:18px; font-weight:700; color:#1a202c; }
  .desc { font-size:15px; color:#4a5568; line-height:1.65; }
  .footer {
    text-align:right; margin-top:18px;
    font-size:13px; color:#cbd5e0;
    font-weight:700; letter-spacing:0.05em;
  }
</style>
</head>
<body>
  <div class="badge">${keyword}</div>
  <h1 class="headline">${headline}</h1>
  <div class="points">${cards}</div>
  <div class="footer">Chrome Manual Maker</div>
</body>
</html>`;
}

async function generateSectionContent(headingText, keyword) {
  const res = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    messages: [{
      role: 'user',
      content: `以下のブログセクション見出しを視覚的に解説するインフォグラフィック用のコンテンツを生成してください。

見出し: ${headingText}
キーワード: ${keyword}

JSON形式で出力してください（他のテキストは不要）。pointsは必ず3つ:
{
  "headline": "見出しを読者に響く短いフレーズに言い換え（<em>タグで1〜2語を強調可、全体30文字以内）",
  "points": [
    { "icon": "絵文字1つ", "label": "ポイント名（8文字以内）", "desc": "説明（36文字以内）" },
    { "icon": "絵文字1つ", "label": "ポイント名（8文字以内）", "desc": "説明（36文字以内）" },
    { "icon": "絵文字1つ", "label": "ポイント名（8文字以内）", "desc": "説明（36文字以内）" }
  ]
}`,
    }],
    expectJson: true,
    maxTokens: 500,
  });

  try {
    return JSON.parse(res.text);
  } catch {
    return {
      headline: headingText,
      points: [
        { icon: '📌', label: 'ポイント1', desc: headingText },
        { icon: '✅', label: 'ポイント2', desc: headingText },
        { icon: '💡', label: 'ポイント3', desc: headingText },
      ],
    };
  }
}

async function runImageGenerator(finalArticle) {
  const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`);

  const h2Matches = [...(finalArticle.content || '').matchAll(/<h2>([^<]+)<\/h2>/g)];
  if (h2Matches.length === 0) return { ...finalArticle, sectionImages: [] };

  log(`  セクション画像生成: ${h2Matches.length}件`);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  const sectionImages = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });

    for (const [tag, headingText] of h2Matches) {
      log(`    画像生成中: "${headingText}"`);
      const { headline, points } = await generateSectionContent(headingText, finalArticle.keyword || '');
      const html = buildHtml(finalArticle.keyword || '', headline, points);
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const buf = await page.screenshot({ type: 'png' });
      sectionImages.push({ tag, buf, alt: headingText });
    }
  } finally {
    await browser.close();
  }

  return { ...finalArticle, sectionImages };
}

module.exports = { runImageGenerator };
