const { callClaude } = require('../lib/claude');
const { CTA_HTML } = require('../lib/schemas');

const SYSTEM = `あなたはSEOに強い日本語ブログライターです。
Notionに関する記事をHTMLで書きます。

## 読者と文体
- 読者: Notionを使ったことがない、または使い始めたばかりの日本のビジネスパーソン
- 前提知識ゼロを想定し、専門用語は必ず平易に言い換える（例：「データベース＝情報を整理する一覧表」）
- 文体: です・ます調。「〜してみましょう」「〜がおすすめです」など柔らかく話しかけるトーン
- 体言止め・箇条書きは適切に使いつつ、地の文はです・ます調を崩さない

## 執筆の3原則（必ず守ること）
1. 問題解決: 記事全体が「読者の具体的な問題を解決するコンテンツ」であることを常に意識する
2. ペルソナ共鳴: ペルソナは書き手の頭の中にある読者像。ペルソナ名や「〇〇さんのケースでは」といった表現は本文に出さない。その人の悩み・状況から逆算した言葉選び・視点・深さで書く
3. 具体例必須: 各H2セクションに必ず1つ以上の具体例を入れる
   - 形式例: 「例えば、〇〇のような場合は〜」「実際に〇〇社では〜」「〜という状況なら〜」
   - 数字・状況・職種などを使うとリアリティが増す（架空でよいが具体的に）
   - ペルソナ名を固有名詞として本文に登場させてはいけない

## 使用できるHTMLコンポーネント（<h2>は使用禁止）

### 通常タグ
<p> <ul> <li> <ol> <strong> <h3> <table> <thead> <tbody> <tr> <th> <td>

### 比較表（ツール・プラン・機能を比べるときに使用）
<table style="width:100%;border-collapse:collapse;margin:20px 0;"><thead><tr style="background:#f5f5f5;"><th style="padding:10px 12px;border:1px solid #e0e0e0;text-align:left;">項目</th><th style="padding:10px 12px;border:1px solid #e0e0e0;text-align:left;">〇〇</th><th style="padding:10px 12px;border:1px solid #e0e0e0;text-align:left;">△△</th></tr></thead><tbody><tr><td style="padding:10px 12px;border:1px solid #e0e0e0;">内容</td><td style="padding:10px 12px;border:1px solid #e0e0e0;">内容</td><td style="padding:10px 12px;border:1px solid #e0e0e0;">内容</td></tr></tbody></table>

### ポイントボックス（重要な補足・豆知識）
<div style="background:#f0f7ff;border-left:4px solid #3b82f6;padding:14px 16px;margin:20px 0;border-radius:0 6px 6px 0;"><p>💡 <strong>ポイント</strong><br>内容</p></div>

### 注意ボックス（間違えやすい点・落とし穴）
<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 16px;margin:20px 0;border-radius:0 6px 6px 0;"><p>⚠️ <strong>注意</strong><br>内容</p></div>

### ステップフロー（3ステップ以上の手順を視覚化）
<div style="background:#f9f9f9;border-radius:8px;padding:16px 20px;margin:20px 0;"><p><strong>① ステップ名</strong>：内容</p><p style="color:#bbb;margin:2px 0 2px 8px;">↓</p><p><strong>② ステップ名</strong>：内容</p><p style="color:#bbb;margin:2px 0 2px 8px;">↓</p><p><strong>③ ステップ名</strong>：内容</p></div>

### スクリーンショット挿入指示（操作手順ごとに挿入）
<!-- [SCREENSHOT: ここに〇〇の画面を挿入] -->

## 使用ガイドライン
- 比較表: 比較が有効な場面で1回使用
- ポイント/注意ボックス: 合わせてセクションあたり最大1個
- ステップフロー: 操作手順が3ステップ以上あるセクションで使用
- スクリーンショット指示: 「画面を操作する」ステップの直後に必ず挿入

## 文章・改行ルール（スマホ読みやすさ重視）
- 1つの<p>タグはスマホ画面で3行以内（目安: テキスト70文字以内）
- 長い説明は<p>を分割する（1つの<p>に1〜2文）
- 1つのH2セクション直下の<p>は最大4つまで
- 同じ語尾（〜です、〜ます）を3回以上連続させない

## 出力
指定されたセクション内容のHTML本文のみ出力。余計な説明や前置きは不要。`;

function buildH3Context(heading) {
  if (!heading.children || heading.children.length === 0) return '';
  return `\nこのセクションで使うH3サブ見出し:\n${heading.children.map(h => `- <h3>${h.text}</h3>`).join('\n')}`;
}

function buildPersonaContext(outline) {
  if (!outline.persona) return '';
  return `\n## 想定読者（本文には登場させない・書き手の内部文脈として使うこと）\n役職・立場: ${outline.persona.role}\n状況: ${outline.persona.situation}\n悩み: ${outline.persona.pain}\n解決する問題: ${outline.readerProblem}\n解決後の姿: ${outline.problemSolution}`;
}

function buildSpineContext(heading, narrativeSpine, previousSectionTail) {
  if (!narrativeSpine) return '';

  const section = (narrativeSpine.sections || []).find(s => s.h2 === heading.text);
  let ctx = `\n## ナラティブスパイン（記事全体の物語設計書）\n`;
  ctx += `中心メッセージ: ${narrativeSpine.centralMessage}\n`;
  ctx += `文体・トーン: ${narrativeSpine.tone}\n`;

  if (section) {
    ctx += `\n## このセクションの物語上の役割\n`;
    ctx += `役割: ${section.narrativeRole}\n`;
    ctx += `読者に感じてほしいこと: ${section.readerFeeling}\n`;
    ctx += `書き出しのヒント: ${section.openingHint}\n`;
  }

  if (previousSectionTail) {
    ctx += `\n## 直前セクションの末尾（文体・リズムをこのセクションに引き継ぐこと）\n${previousSectionTail}`;
  }

  return ctx;
}

async function writeLeadParagraph(outline, narrativeSpine) {
  const personaCtx = buildPersonaContext(outline);
  const personaInstruction = outline.persona
    ? `\n\n【重要】「${outline.persona.name}」のような${outline.persona.role}が抱える「${outline.persona.pain}」という悩みに共感し、この記事を読めば「${outline.problemSolution}」ことを伝えてください。`
    : '';

  const spineCtx = narrativeSpine
    ? `\n\n## ナラティブスパイン\n中心メッセージ: ${narrativeSpine.centralMessage}\n読者の旅: ${narrativeSpine.readerJourney}\n文体・トーン: ${narrativeSpine.tone}`
    : '';

  return callClaude({
    model: 'claude-sonnet-4-6',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `## リード文を書いてください
記事タイトル: ${outline.suggestedTitle}
キーワード: ${outline.keyword}
検索意図: ${outline.searchIntent}
${personaCtx}${spineCtx}

読者の悩みに共感し、この記事で解決できることを伝えるリード文（150〜200文字）を<p>タグで書いてください。
最初の100文字以内にキーワード「${outline.keyword}」を含めること。${personaInstruction}`,
    }],
    maxTokens: 400,
    expectJson: false,
  });
}

async function writeSection(heading, outline, previousSections, narrativeSpine) {
  // 直前セクションの末尾テキストを取り出す
  const lastSection = previousSections.length ? previousSections[previousSections.length - 1] : null;
  const previousSectionTail = lastSection ? lastSection.tail : null;

  // 重複回避用: 既に書いたセクション名リスト（headingのみ、内容重複チェック用）
  const prevHeadingNames = previousSections.map(s => `- ${s.h2}`).join('\n');
  const prevCtx = prevHeadingNames
    ? `\n既に書いたセクション（内容の重複を避けること）:\n${prevHeadingNames}`
    : '';

  const h3Ctx = buildH3Context(heading);
  const personaCtx = buildPersonaContext(outline);
  const spineCtx = buildSpineContext(heading, narrativeSpine, previousSectionTail);

  const budget = heading.wordBudget || 1500;
  const maxTokens = Math.min(4000, Math.max(1500, Math.ceil(budget * 1.8)));

  const exampleInstruction = '\n\n【具体例必須】このセクションには必ず1つ以上の具体例を入れてください（「例えば〜」「〜のような場合は〜」「実際に〇〇業種では〜」など）。数字・職種・状況を使ってリアリティを出すこと。ペルソナ名は本文に出さないこと。';

  return callClaude({
    model: 'claude-sonnet-4-6',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `## 見出しセクションを書いてください
見出し: ${heading.text}
目標文字数: ${budget}文字（テキストのみで${budget}文字以上になるよう必ず書いてください。短すぎる出力は禁止です）
キーワード: ${outline.keyword}${h3Ctx}${personaCtx}${spineCtx}${prevCtx}${exampleInstruction}

<h2>タグは出力しない。見出し配下のコンテンツ（<p>, <ul>, <li>, <h3>等）のみ出力してください。`,
    }],
    maxTokens,
    expectJson: false,
  });
}

function groupHeadings(headings) {
  const sections = [];
  let current = null;
  for (const h of headings) {
    if (h.level === 'h2') {
      if (current) sections.push(current);
      current = { ...h, children: [] };
    } else if (h.level === 'h3' && current) {
      current.children.push(h);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function autoTags(keyword, outline) {
  const tags = new Set(['Notion']);
  keyword.split(/\s+/).filter(Boolean).forEach(w => tags.add(w));
  (outline.headings || []).slice(0, 3).forEach(h => {
    h.text.split(/[・\s]+/).filter(w => w.length > 2).slice(0, 2).forEach(w => tags.add(w));
  });
  return [...tags].slice(0, 5);
}

function autoImagePrompt(keyword) {
  const kw = keyword.replace(/\s+/g, ', ');
  return `Japanese business person using Notion, ${kw}, professional office workspace, clean flat illustration, minimal, digital productivity`;
}

function stripMeta(text) {
  let t = text.replace(/^```[a-z]*\n?/gim, '').replace(/^```\n?/gim, '');
  t = t.replace(/^\*\*[^\n]*\n?/gm, '');
  return t.trim();
}

async function runWriter(outline, narrativeSpine = null) {
  const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`);
  const sections = groupHeadings(outline.headings || []);

  if (outline.persona) {
    log(`  ペルソナ: ${outline.persona.name}（${outline.persona.role}）`);
    log(`  解決する問題: ${outline.readerProblem}`);
  }
  if (narrativeSpine) {
    log(`  中心メッセージ: ${narrativeSpine.centralMessage}`);
  }

  log('  リード文生成中...');
  const leadResult = await writeLeadParagraph(outline, narrativeSpine);
  let content = stripMeta(leadResult.text) + '\n';

  // 各セクションの末尾300字を蓄積（文体・リズムの引き継ぎ用）
  const previousSections = [];
  for (const heading of sections) {
    log(`  セクション生成中: "${heading.text}"`);
    const sectionResult = await writeSection(heading, outline, previousSections, narrativeSpine);
    const written = stripMeta(sectionResult.text);
    content += `\n<h2>${heading.text}</h2>\n${written}\n`;
    if (heading.ctaHere) {
      content += `\n${CTA_HTML}\n`;
    }
    // 末尾300字をHTMLタグ除去して蓄積
    const plainTail = written.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(-300);
    previousSections.push({ h2: heading.text, tail: plainTail });
  }

  const CLOSING_CTA = `<div style="background:#f9fafb;border-radius:8px;padding:24px;margin:32px 0;text-align:center;">
<p style="font-size:18px;font-weight:700;margin:0 0 12px;">Notionマニュアル作成を、もっとラクに。</p>
<p style="color:#6b7280;margin:0 0 20px;">Chrome Manual Maker はクリックするだけでスクリーンショット＋説明文をNotionに自動保存します。<br>無料プランでまず試してみてください。</p>
<a href="https://chromewebstore.google.com/detail/kapchgeffhkfffhflcpjjkiojneipicd" style="display:inline-block;background:#e53e3e;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">無料でインストールする →</a>
</div>`;
  content += `\n${CLOSING_CTA}\n`;

  const totalChars = content.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
  const ctaCount = (content.match(/chrome-manual-maker\.s-tasklog\.com/g) || []).length;

  return {
    title: outline.suggestedTitle,
    metaDescription: outline.metaDescription || '',
    content,
    tags: autoTags(outline.keyword, outline),
    imagePrompt: autoImagePrompt(outline.keyword),
    totalChars,
    ctaCount,
  };
}

module.exports = { runWriter };
