const { callClaude } = require('../lib/claude');

const SYSTEM = `あなたはSEOコンテンツ戦略の専門家です。
Notionブログの記事企画を立案します。

## Chrome Manual Makerについて
- Chrome拡張機能（MV3）。クリックするだけでスクリーンショット＋赤丸アノテーションをNotionへ自動保存
- Notionマニュアル作成を劇的に効率化。無料プランあり
- URL: https://chrome-manual-maker.s-tasklog.com

## ターゲット読者
Notionを使い始めた日本のビジネスパーソン（中小企業の業務担当者・チームリーダー）

## ペルソナ設計ルール
- 読者の具体的なペルソナを1人に絞る（名前・役職・状況・抱えている悩み）
- そのペルソナが「この記事を検索した瞬間」にどんな問題を抱えているか特定する
- 記事を読み終えた後にペルソナの何が解決されるか明確にする
- ペルソナは架空の人物でよいが、リアリティが大切（「30代 中小企業の事務担当 田中さん」のような具体性）

## 出力形式（JSONのみ・コードブロック不要）
{
  "angle": "記事の切り口・アングル（1行で具体的に）",
  "uniqueValue": "競合記事と差別化するユニークな価値提案（1行）",
  "articleGoal": "Informational または Commercial または Transactional",
  "targetReader": "ターゲット読者の具体的なペルソナ（1行）",
  "competitorGaps": ["競合が触れていない可能性が高いトピック（1〜3個の配列）"],
  "ctaFocus": "この記事でChrome Manual Makerのどの価値を訴求するか（1行）",
  "persona": {
    "name": "ペルソナの名前（例: 田中 恵子）",
    "role": "役職・立場・年代（例: 中小企業の事務担当・30代）",
    "situation": "この記事を検索している状況（例: 業務マニュアルをNotionで整備しようとしているが作業が属人化している）",
    "pain": "具体的な悩み・困りごと（1文）"
  },
  "readerProblem": "ペルソナが解決したい問題（1文・具体的に）",
  "problemSolution": "この記事を読むとペルソナの何が解決されるか（1文）"
}`;

async function runPlanner({ keyword, themeTitle }) {
  const result = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `キーワード: ${keyword}\nテーマタイトル: ${themeTitle}\n\n上記の記事企画JSONを生成してください。`,
    }],
    maxTokens: 800,
    expectJson: true,
  });
  try {
    return JSON.parse(result.text);
  } catch {
    throw new Error(`企画エージェントのJSON解析失敗: ${result.text.slice(0, 200)}`);
  }
}

module.exports = { runPlanner };
