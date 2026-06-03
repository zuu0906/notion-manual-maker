const { loadSerpCache, buildSerpSummary } = require('../lib/schemas');
const { callClaude } = require('../lib/claude');

const LSI_SYSTEM = `あなたはSEOの専門家です。
競合記事の本文テキストを分析して、LSIキーワード（共起語・関連語）を抽出します。

## ルール
- メインキーワードと共起しやすい重要な語句を抽出する
- 1語〜4語のフレーズで、記事に自然に盛り込めるもの
- 検索ボリュームがありそうな具体的な語句を優先
- 固有名詞や製品名も含めてよい
- 出力はJSONのみ（コードブロック不要）

## 出力形式
{
  "lsiKeywords": ["キーワード1", "キーワード2", ...],
  "mustIncludeTerms": ["必ず言及すべき用語1", ...],
  "userQuestions": ["読者が疑問に思いそうな質問1", ...]
}`;

async function extractLsiKeywords(keyword, bodyTexts) {
  if (!bodyTexts || bodyTexts.length === 0) return { lsiKeywords: [], mustIncludeTerms: [], userQuestions: [] };

  const combinedText = bodyTexts
    .map((t, i) => `【競合${i + 1}の本文】\n${t}`)
    .join('\n\n')
    .slice(0, 8000); // トークン節約

  const result = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: LSI_SYSTEM,
    messages: [{
      role: 'user',
      content: `メインキーワード: ${keyword}\n\n${combinedText}\n\n上記の競合記事本文からLSIキーワードをJSONで抽出してください。lsiKeywordsは20個以内、mustIncludeTermsは5個以内、userQuestionsは5個以内。`,
    }],
    maxTokens: 800,
    expectJson: true,
  });

  try {
    return JSON.parse(result.text);
  } catch {
    return { lsiKeywords: [], mustIncludeTerms: [], userQuestions: [] };
  }
}

async function runResearcher({ keyword, plan }) {
  const serpData = loadSerpCache(keyword);
  const summary = buildSerpSummary(serpData);

  const competitorBodyTexts = summary ? summary.competitorBodyTexts : [];
  const lsiData = await extractLsiKeywords(keyword, competitorBodyTexts);

  return {
    keyword,
    topH2s: summary ? summary.topH2s : [],
    avgCharCount: summary ? summary.avgCharCount : 2000,
    paaQuestions: summary ? summary.paaQuestions : [],
    competitorCount: summary ? summary.competitorCount : 0,
    suggestions: summary ? summary.suggestions : [],
    googleSuggestions: summary ? summary.googleSuggestions : [],
    yahooSuggestions: summary ? summary.yahooSuggestions : [],
    relatedSearches: summary ? summary.relatedSearches : [],
    snippets: summary ? summary.snippets : [],
    lsiKeywords: lsiData.lsiKeywords || [],
    mustIncludeTerms: lsiData.mustIncludeTerms || [],
    userQuestions: lsiData.userQuestions || [],
    angle: plan.angle,
    uniqueValue: plan.uniqueValue,
    competitorGaps: plan.competitorGaps || [],
    persona: plan.persona || null,
    readerProblem: plan.readerProblem || '',
    problemSolution: plan.problemSolution || '',
  };
}

module.exports = { runResearcher };
