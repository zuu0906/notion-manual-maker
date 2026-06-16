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

  const suggestionsBlock = research.suggestions && research.suggestions.length
    ? `\n関連キーワード（Googleサジェスト）:\n${research.suggestions.slice(0, 12).map(s => `- ${s}`).join('\n')}`
    : '';

  const snippetsBlock = research.snippets && research.snippets.length
    ? `\n競合記事スニペット（検索結果の抜粋）:\n${research.snippets.slice(0, 4).map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  const lsiBlock = research.lsiKeywords && research.lsiKeywords.length
    ? `\nLSIキーワード（共起語・関連語）:\n${research.lsiKeywords.slice(0, 15).map(k => `- ${k}`).join('\n')}`
    : '';

  const mustTermsBlock = research.mustIncludeTerms && research.mustIncludeTerms.length
    ? `\n必ず言及すべき用語:\n${research.mustIncludeTerms.map(t => `- ${t}`).join('\n')}`
    : '';

  const userQuestionsBlock = research.userQuestions && research.userQuestions.length
    ? `\n読者が疑問に思いやすい質問:\n${research.userQuestions.map(q => `- ${q}`).join('\n')}`
    : '';

  const userMsg = `## リサーチデータ
キーワード: ${research.keyword}
記事の切り口: ${research.angle}
差別化ポイント: ${research.uniqueValue}
競合記事数: ${research.competitorCount}件
競合の平均文字数: ${research.avgCharCount}文字
${suggestionsBlock}
${snippetsBlock}
${lsiBlock}
${mustTermsBlock}
${userQuestionsBlock}

競合H2（頻出順）:
${topH2Lines}

競合が触れていない可能性があるトピック:
${(research.competitorGaps || []).map(g => `- ${g}`).join('\n') || '- なし'}
${personaBlock}

上記データをもとに、ペルソナの問題解決ストーリーに沿ったアウトラインJSONを生成してください。
※関連キーワード・LSIキーワードはH2・H3の見出しや本文に自然に盛り込み、検索意図を幅広くカバーしてください。
※「読者が疑問に思いやすい質問」はFAQセクションや見出しとして活用してください。`;

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

  // 中盤に必ずインラインCTAを1つ保証する（末尾CTAは writer の CLOSING_CTA が担うため、
  // 最終H2の ctaHere は writer 側で無視される。中盤＝最終以外のH2にCTAが無ければ補う）
  const h2s = outline.headings.filter(h => h.level === 'h2');
  if (h2s.length > 1) {
    const nonLast = h2s.slice(0, -1);
    if (!nonLast.some(h => h.ctaHere)) {
      const midIdx = Math.max(0, Math.floor(h2s.length / 2) - 1);
      h2s[midIdx].ctaHere = true;
    }
  }

  return outline;
}

module.exports = { runStructurer };
