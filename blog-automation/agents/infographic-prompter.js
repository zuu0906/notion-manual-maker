const fs   = require('fs');
const path = require('path');
const { callClaude } = require('../lib/claude');

const SYSTEM = `あなたはNotebookLM向けインフォグラフィックプロンプト作成の専門家です。
ブログ記事のH2セクションを受け取り、NotebookLMのチャットにそのまま貼り付けて使えるプロンプトを生成します。

出力ルール:
- 日本語のみ
- 前置き・説明不要。プロンプト本文だけを出力する
- セクション内容を整理して含める（長すぎず要点を凝縮）
- インフォグラフィック種別はセクション内容に最適なものを1つ選ぶ
  （縦型ポイントリスト / 横並び比較表 / フロー図 / 数字インフォグラフィック / タイムライン）`;

function extractSections(html) {
  const sections = [];
  const parts = html.split(/<h2[^>]*>/i);
  for (const part of parts.slice(1)) {
    const h2End = part.indexOf('</h2>');
    if (h2End === -1) continue;
    const h2   = part.slice(0, h2End).replace(/<[^>]+>/g, '').trim();
    const rest = part.slice(h2End + 5);
    const text = rest
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 800);
    if (h2 && text) sections.push({ h2, text });
  }
  return sections;
}

async function buildPrompt(section, articleTitle) {
  const result = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `記事タイトル: ${articleTitle}
セクション見出し: ${section.h2}
セクション内容:
${section.text}

このセクションのインフォグラフィック作成用プロンプトを生成してください。
形式:
1行目: 「〇〇のインフォグラフィックを作成してください。」
2行目以降: セクション内容の整理 + 作成指示（タイトル案・ポイント3〜5個・レイアウト種別・補足）`,
    }],
    maxTokens: 600,
    expectJson: false,
  });

  return result.text
    .replace(/^```[a-z]*\n?/gim, '')
    .replace(/^```\n?/gim, '')
    .trim();
}

async function runInfographicPrompter(finalArticle, runId) {
  const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`);
  const sections = extractSections(finalArticle.content || '');

  if (sections.length === 0) {
    log('  インフォグラフィック: H2セクションが見つかりません');
    return { sections: [] };
  }

  log(`  ${sections.length}セクションを順次処理中...`);
  const results = [];
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const prompt = await buildPrompt(sec, finalArticle.title || '');
    log(`  [${i + 1}/${sections.length}] 完了: ${sec.h2}`);
    results.push({ h2: sec.h2, prompt });
  }

  // Markdown ファイルに書き出す
  const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  let md = `# インフォグラフィックプロンプト集\n`;
  md += `記事: ${finalArticle.title || '（タイトルなし）'}\n`;
  md += `生成日: ${now}\n\n`;

  results.forEach((r, i) => {
    md += `---\n\n`;
    md += `## セクション${i + 1}: ${r.h2}\n\n`;
    md += '```\n';
    md += r.prompt + '\n';
    md += '```\n\n';
  });

  const outPath = path.join(__dirname, '..', 'state', `${runId}-infographics.md`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md, 'utf8');

  return { sections: results };
}

module.exports = { runInfographicPrompter };
