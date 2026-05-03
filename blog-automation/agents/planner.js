const { callClaude } = require('../lib/claude');

const SYSTEM = `あなたはSEOコンテンツ戦略の専門家です。
Notionブログの記事企画を立案します。

## Chrome Manual Makerについて
- Chrome拡張機能（MV3）。クリックするだけでスクリーンショット＋赤丸アノテーションをNotionへ自動保存
- Notionマニュアル作成を劇的に効率化。無料プランあり
- URL: https://chrome-manual-maker.s-tasklog.com

## ターゲット読者
Notionを使い始めた日本のビジネスパーソン（中小企業の業務担当者・チームリーダー）

## 出力形式（JSONのみ・コードブロック不要）
{
  "angle": "記事の切り口・アングル（1行で具体的に）",
  "uniqueValue": "競合記事と差別化するユニークな価値提案（1行）",
  "articleGoal": "Informational または Commercial または Transactional",
  "targetReader": "ターゲット読者の具体的なペルソナ（1行）",
  "competitorGaps": ["競合が触れていない可能性が高いトピック（1〜3個の配列）"],
  "ctaFocus": "この記事でChrome Manual Makerのどの価値を訴求するか（1行）"
}`;

async function runPlanner({ keyword, themeTitle }) {
  const result = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `キーワード: ${keyword}\nテーマタイトル: ${themeTitle}\n\n上記の記事企画JSONを生成してください。`,
    }],
    maxTokens: 512,
    expectJson: true,
  });
  try {
    return JSON.parse(result.text);
  } catch {
    throw new Error(`企画エージェントのJSON解析失敗: ${result.text.slice(0, 200)}`);
  }
}

module.exports = { runPlanner };
