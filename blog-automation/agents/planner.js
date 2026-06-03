const { callClaude } = require('../lib/claude');
const { loadSerpCache, buildSerpSummary } = require('../lib/schemas');

const SYSTEM = `あなたはSEOコンテンツ戦略の専門家です。
Notionブログの記事企画を立案します。

## Notion Manual Makerについて
- Chrome拡張機能（MV3）。クリックするだけでスクリーンショット＋赤丸アノテーションをNotionへ自動保存
- Notionマニュアル作成を劇的に効率化。無料プランあり
- URL: https://chrome-manual-maker.vercel.app

## ターゲット読者
Notionを使い始めた日本のビジネスパーソン（中小企業の業務担当者・チームリーダー）

## ペルソナ設計ルール
- 読者の具体的なペルソナを1人に絞る（名前・役職・状況・抱えている悩み）
- そのペルソナが「この記事を検索した瞬間」にどんな問題を抱えているか特定する
- 記事を読み終えた後にペルソナの何が解決されるか明確にする
- ペルソナは架空の人物でよいが、リアリティが大切（「30代 中小企業の事務担当 田中さん」のような具体性）

## 競合ギャップ分析ルール（SERPデータが提供された場合）
- 競合H2を見て「どの角度・トピックが抜けているか」を具体的に特定する
- Googleサジェストに含まれるが競合があまり扱っていないキーワードはギャップ候補
- 読者の検索意図をより深く満たす切り口を1つ選んでangleに設定する
- competitorGapsには「競合が触れていない、かつ読者ニーズがある」トピックのみ挙げる

## 出力形式（JSONのみ・コードブロック不要）
{
  "angle": "記事の切り口・アングル（1行で具体的に）",
  "uniqueValue": "競合記事と差別化するユニークな価値提案（1行）",
  "articleGoal": "Informational または Commercial または Transactional",
  "targetReader": "ターゲット読者の具体的なペルソナ（1行）",
  "competitorGaps": ["競合が触れていない可能性が高いトピック（1〜3個の配列）"],
  "ctaFocus": "この記事でNotion Manual Makerのどの価値を訴求するか（1行）",
  "persona": {
    "name": "ペルソナの名前（例: 田中 恵子）",
    "role": "役職・立場・年代（例: 中小企業の事務担当・30代）",
    "situation": "この記事を検索している状況（例: 業務マニュアルをNotionで整備しようとしているが作業が属人化している）",
    "pain": "具体的な悩み・困りごと（1文）"
  },
  "readerProblem": "ペルソナが解決したい問題（1文・具体的に）",
  "problemSolution": "この記事を読むとペルソナの何が解決されるか（1文）"
}`;

async function runPlanner({ keyword, themeTitle, gist = null }) {
  // SERPキャッシュがあれば競合情報を企画に活用する
  const serpData = loadSerpCache(keyword);
  const summary = buildSerpSummary(serpData);

  let serpContext = '';
  if (summary && summary.competitorCount > 0) {
    const topH2Lines = summary.topH2s.slice(0, 6).map(h => `- "${h.text}"（${h.count}件）`).join('\n');
    const suggestionLines = summary.suggestions.slice(0, 8).map(s => `- ${s}`).join('\n');
    serpContext = `
## 競合分析データ（活用して差別化を図ること）
競合記事数: ${summary.competitorCount}件
競合の平均文字数: ${summary.avgCharCount}文字

競合記事の頻出H2（これらはすでに上位が網羅済み）:
${topH2Lines}

Googleサジェスト（読者の検索意図の広がり）:
${suggestionLines || '（データなし）'}`;
  }

  const gistContext = gist
    ? `\n\n## ユーザー指定の趣旨（最優先）\n${gist}\nこの趣旨を最優先にしてangle・ctaFocus・uniqueValueを決定してください。`
    : '';

  const result = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `キーワード: ${keyword}\nテーマタイトル: ${themeTitle}${serpContext}${gistContext}\n\n上記の記事企画JSONを生成してください。SERPデータがある場合は競合ギャップを必ず分析してcompetitorGapsに反映してください。`,
    }],
    maxTokens: 900,
    expectJson: true,
  });
  try {
    return JSON.parse(result.text);
  } catch {
    throw new Error(`企画エージェントのJSON解析失敗: ${result.text.slice(0, 200)}`);
  }
}

module.exports = { runPlanner };
