const { callClaude } = require('../lib/claude');
const { CTA_HTML } = require('../lib/schemas');

const SYSTEM = `あなたはSEOに強い日本語ブログライターです。
Notionに関する記事をHTMLで書きます。

## 読者と文体
- 読者: Notionを使ったことがない、または使い始めたばかりの日本のビジネスパーソン
- 前提知識ゼロを想定し、専門用語は必ず平易に言い換える（例：「データベース＝情報を整理する一覧表」）
- 文体: です・ます調。「〜してみましょう」「〜がおすすめです」など柔らかく話しかけるトーン
- 体言止め・箇条書きは適切に使いつつ、地の文はです・ます調を崩さない

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

## 出力
指定されたセクション内容のHTML本文のみ出力。余計な説明や前置きは不要。`;

function buildH3Context(heading) {
  if (!heading.children || heading.children.length === 0) return '';
  return `\nこのセクションで使うH3サブ見出し:\n${heading.children.map(h => `- <h3>${h.text}</h3>`).join('\n')}`;
}

async function writeLeadParagraph(outline) {
  return callClaude({
    model: 'claude-sonnet-4-6',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `## リード文を書いてください
記事タイトル: ${outline.suggestedTitle}
キーワード: ${outline.keyword}
検索意図: ${outline.searchIntent}

読者の悩みに共感し、この記事で解決できることを伝えるリード文（150〜200文字）を<p>タグで書いてください。
最初の100文字以内にキーワード「${outline.keyword}」を含めること。`,
    }],
    maxTokens: 400,
    expectJson: false,
  });
}

async function writeSection(heading, outline, previousHeadings) {
  const prevCtx = previousHeadings.length
    ? `\n既に書いたセクション（内容の重複を避けること）:\n${previousHeadings.map(h => `- ${h}`).join('\n')}`
    : '';
  const h3Ctx = buildH3Context(heading);

  // wordBudgetに応じてトークン上限を調整（日本語は1文字≒1.5トークン）
  const budget = heading.wordBudget || 1500;
  const maxTokens = Math.min(4000, Math.max(1500, Math.ceil(budget * 1.8)));

  return callClaude({
    model: 'claude-sonnet-4-6',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `## 見出しセクションを書いてください
見出し: ${heading.text}
目標文字数: ${budget}文字（テキストのみで${budget}文字以上になるよう必ず書いてください。短すぎる出力は禁止です）
キーワード: ${outline.keyword}${h3Ctx}${prevCtx}

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

async function runWriter(outline) {
  const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`);
  const sections = groupHeadings(outline.headings || []);

  log('  リード文生成中...');
  const leadResult = await writeLeadParagraph(outline);
  let content = leadResult.text + '\n';

  const previousHeadings = [];
  for (const heading of sections) {
    log(`  セクション生成中: "${heading.text}"`);
    const sectionResult = await writeSection(heading, outline, previousHeadings);
    content += `\n<h2>${heading.text}</h2>\n${sectionResult.text}\n`;
    if (heading.ctaHere) {
      content += `\n${CTA_HTML}\n`;
    }
    previousHeadings.push(heading.text);
  }

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
