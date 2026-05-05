const { callClaude } = require('../lib/claude');
const { CTA_HTML } = require('../lib/schemas');

const SYSTEM = `あなたはSEOと日本語コンテンツ戦略の専門家です。
競合分析データとペルソナ情報をもとに、Notionブログ記事の最適なアウトラインを生成します。

## アウトライン生成ルール
1. 競合記事が多く使っているH2は「必須要素」として含める
2. 競合が触れていない差別化ポイントを1〜2つ入れる
3. CTAは記事中盤（H2の2〜3番目）と末尾のH2の2箇所にctaHere: trueを設定する
4. H2は4〜5個、必要なH3も含める
5. wordBudgetは各セクションの目標文字数（合計でtargetCharCountになるよう配分）
6. targetCharCountは10000〜20000の範囲で設定する（記事の深さに応じて調整）
7. H2ごとのwordBudgetは最低1200、平均2000〜3000文字を目安にする
8. 見出し構成はペルソナの「問題→原因→解決策→実践」というストーリーに沿って設計する

## 出力形式（JSONのみ・コードブロック不要）
{
  "keyword": "フォーカスキーワード",
  "suggestedTitle": "SEOタイトル（32文字以内、キーワード含む）",
  "metaDescription": "メタディスクリプション（120文字以内、キーワード含む）",
  "searchIntent": "Informational または Commercial または Transactional",
  "targetCharCount": 推奨文字数（数値）,
  "headings": [
    {
      "level": "h2 または h3",
      "text": "見出しテキスト",
      "ctaHere": false,
      "wordBudget": セクションの目標文字数（数値）
    }
  ],
  "differentiators": ["差別化ポイント（文字列配列）"]
}`;

async function runStructurer(research) {
  const topH2Lines = research.topH2s.length
    ? research.topH2s.slice(0, 8).map(h => `- "${h.text}"（${h.count}件）`).join('\n')
    : '（SERPデータなし）';

  const personaBlock = research.persona
    ? `\n## ペルソナ情報\nペルソナ: ${research.persona.name}（${research.persona.role}）\n状況: ${research.persona.situation}\n悩み: ${research.persona.pain}\n解決する問題: ${research.readerProblem}\n解決後の姿: ${research.problemSolution}`
    : '';

  const userMsg = `## リサーチデータ
キーワード: ${research.keyword}
記事の切り口: ${research.angle}
差別化ポイント: ${research.uniqueValue}
競合記事数: ${research.competitorCount}件
競合の平均文字数: ${research.avgCharCount}文字

競合H2（頻出順）:
${topH2Lines}

競合が触れていない可能性があるトピック:
${(research.competitorGaps || []).map(g => `- ${g}`).join('\n') || '- なし'}
${personaBlock}

上記データをもとに、ペルソナの問題解決ストーリーに沿ったアウトラインJSONを生成してください。`;

  const result = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 2048,
    expectJson: true,
  });

  let outline;
  try {
    outline = JSON.parse(result.text);
  } catch {
    throw new Error(`構成エージェントのJSON解析失敗: ${result.text.slice(0, 200)}`);
  }
  outline.ctaHtml = CTA_HTML;

  // ペルソナ情報をoutlineに引き継ぐ（writerで利用）
  outline.persona = research.persona || null;
  outline.readerProblem = research.readerProblem || '';
  outline.problemSolution = research.problemSolution || '';

  // 末尾のH2に必ずCTAを保証する
  const h2s = outline.headings.filter(h => h.level === 'h2');
  if (h2s.length > 0) {
    const lastH2 = h2s[h2s.length - 1];
    if (!h2s.some(h => h.ctaHere)) {
      const midIdx = Math.floor(h2s.length / 2) - 1;
      if (midIdx >= 0) h2s[Math.max(0, midIdx)].ctaHere = true;
      lastH2.ctaHere = true;
    } else if (!lastH2.ctaHere) {
      lastH2.ctaHere = true;
    }
  }

  return outline;
}

module.exports = { runStructurer };
