const { callClaude } = require('../lib/claude');

const SYSTEM = `あなたはSEOコンテンツレビュアーです。
日本語ブログ記事を採点基準に従って評価し、JSONで結果を返します。

## 採点基準（100点満点）
- keywordInTitle (15点): タイトルにキーワードが含まれる
- keywordInLead (10点): リード文の最初100文字にキーワードが含まれる
- h2Count (10点): H2見出しが4〜6個ある（「H2カウント（事前集計）」の数値を使うこと。本文プレビューから数えてはいけない）
- ctaCount (15点): Notion Manual MakerへのCTAが2個以上ある
- ctaMidAndEnd (10点): CTAが記事中盤と末尾の両方にある
- minCharCount (15点): 実際の文字数が目標の90%以上
- noPlaceholders (10点): [TODO]や「ここに〜」等のプレースホルダーがない（<!-- [SCREENSHOT: ...] --> のHTMLコメントは正常なマーカーなので減点しない）
- hasConcretExamples (10点): 「例えば」「〜のような場合」「〜さんのケース」「〜社では」などの具体例表現が記事中に複数含まれている
- hasPersonaResonance (5点): ペルソナの悩みや状況に共感する言葉・視点が記事に含まれている

## 出力形式（JSONのみ・コードブロック不要）
{
  "score": 合計点数（0〜100の整数）,
  "passed": scoreが75以上ならtrue,
  "checklist": {
    "keywordInTitle": true または false,
    "keywordInLead": true または false,
    "h2Count": 実際のH2数（整数）,
    "ctaCount": 実際のCTA数（整数）,
    "ctaMidAndEnd": true または false,
    "minCharCount": true または false,
    "noPlaceholders": true または false,
    "hasConcretExamples": true または false,
    "hasPersonaResonance": true または false
  },
  "issues": [
    {"severity": "error または warning または info", "type": "問題の種類", "detail": "説明"}
  ],
  "rewriteNeeded": scoreが75未満ならtrue,
  "rewriteInstructions": "修正指示（1〜3文、問題がなければnull）"
}`;

async function runReviewer({ title, content, totalChars, ctaCount, h2Count, targetCharCount, keyword, persona }) {
  // 先頭5000 + 末尾3000で中盤CTAと末尾CTAの両方をカバー（1万〜2万字対応）
  let preview = content;
  if (content.length > 8000) {
    preview = content.slice(0, 5000) + '\n...(中略)...\n' + content.slice(-3000);
  }

  const personaBlock = persona
    ? `\nペルソナ: ${persona.name}（${persona.role}）\nペルソナの悩み: ${persona.pain}`
    : '';

  const userMsg = `## 採点対象
タイトル: ${title}
キーワード: ${keyword}
目標文字数: ${targetCharCount || 2000}
実際の文字数: ${totalChars}
CTAカウント（事前集計）: ${ctaCount}
H2カウント（事前集計）: ${h2Count ?? '未提供'}${personaBlock}

## 記事本文
${preview}`;

  const result = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 700,
    expectJson: true,
  });
  try {
    return JSON.parse(result.text);
  } catch {
    throw new Error(`レビューエージェントのJSON解析失敗: ${result.text.slice(0, 200)}`);
  }
}

module.exports = { runReviewer };
