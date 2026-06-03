const { callClaude } = require('../lib/claude');
const { CTA_HTML } = require('../lib/schemas');

const SYSTEM = `あなたはSEOコンテンツの修正専門家です。
指摘された問題点のみを修正し、改善後のHTML本文全体を返します。

## Notion Manual Maker CTA（CTAが不足している場合はこのHTMLを挿入）
${CTA_HTML}

## 修正ルール
- 指示された箇所のみ修正する。それ以外の文章は一切変更しない
- HTMLタグ構造とインデントを維持する
- 日本語として自然な文章を保つ
- 修正後のHTML本文全体を出力する（前置き・説明文は不要）`;

async function runRewriter({ content, rewriteInstructions, keyword }) {
  // Sonnet を使用して品質を保つ（Haikuでは全文書き直しの品質が落ちる）
  const result = await callClaude({
    model: 'claude-sonnet-4-6',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `## 修正指示
${rewriteInstructions}

## キーワード
${keyword}

## 修正対象のHTML
${content}`,
    }],
    maxTokens: 4096,
    expectJson: false,
  });
  return result.text;
}

module.exports = { runRewriter };
