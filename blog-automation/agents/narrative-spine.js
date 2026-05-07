const { callClaude } = require('../lib/claude');

const SYSTEM = `あなたはストーリーテリングとコンテンツ設計の専門家です。
ブログ記事のアウトラインを受け取り、記事全体を1本の一貫したストーリーとして設計する
「ナラティブスパイン（物語の背骨）」を生成します。

このドキュメントは各セクションを書く前にライターが読む設計書です。
- 記事全体の「中心メッセージ」を1文で定義する（読者が記事を読み終えて何を持ち帰るか）
- 読者が経験する感情的・論理的な旅を設計する（共感 → 気づき → 解決 → 行動）
- 各H2セクションが物語のどの役割を担うかを明確にする
- セクション間の接続を設計する（前後の自然な流れを明示）

## 出力形式（JSONのみ・コードブロック不要）
{
  "centralMessage": "記事全体で読者に伝える1つのメッセージ（1文・具体的に）",
  "readerJourney": "読者が共感→気づき→解決→行動を経験する流れ（2文）",
  "tone": "文体・語り方の方向性（例: 迷っている読者に寄り添いながら、具体例で一歩ずつ背中を押すトーン）",
  "sections": [
    {
      "h2": "見出しテキスト（アウトラインのH2と完全一致）",
      "narrativeRole": "この記事の物語においてこのセクションが果たす役割（1文）",
      "readerFeeling": "読者がこのセクションを読み終えたときに感じてほしいこと（1文）",
      "openingHint": "このセクションをどう始めるかのヒント（前セクションからの自然な橋渡し、または読者への問いかけなど。1〜2文）"
    }
  ]
}`;

async function runNarrativeSpine(outline) {
  const h2s = (outline.headings || [])
    .filter(h => h.level === 'h2')
    .map(h => `- ${h.text}`)
    .join('\n');

  const personaBlock = outline.persona
    ? `\nペルソナ: ${outline.persona.name}（${outline.persona.role}）\n悩み: ${outline.persona.pain}\n解決する問題: ${outline.readerProblem}\n解決後の姿: ${outline.problemSolution}`
    : '';

  const userMsg = `記事タイトル: ${outline.suggestedTitle}
キーワード: ${outline.keyword}
検索意図: ${outline.searchIntent || ''}${personaBlock}

H2見出し一覧:
${h2s}

上記のアウトラインに基づいて、記事全体のナラティブスパインJSONを生成してください。
sectionsにはH2見出しのみ含めてください（H3は含めない）。`;

  const result = await callClaude({
    model: 'claude-sonnet-4-6',
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 1500,
    expectJson: true,
  });

  try {
    return JSON.parse(result.text);
  } catch {
    throw new Error(`ナラティブスパインのJSON解析失敗: ${result.text.slice(0, 200)}`);
  }
}

module.exports = { runNarrativeSpine };
