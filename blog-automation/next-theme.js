#!/usr/bin/env node
/**
 * 次に投稿すべきテーマを表示する（Claude Codeが記事生成するときの参照用）
 *
 * 使い方:
 *   node next-theme.js          # 次のテーマを表示
 *   node next-theme.js --index 5  # 特定のインデックスを表示
 *   node next-theme.js --list     # 未使用テーマ一覧を表示
 */

const fs   = require('fs');
const path = require('path');

const THEMES    = require('./themes.js');
const USED_FILE = path.join(__dirname, '.used-themes.json');

function loadUsed() {
  try { return JSON.parse(fs.readFileSync(USED_FILE, 'utf8')); } catch { return []; }
}

const args    = process.argv.slice(2);
const listAll = args.includes('--list');
const idxFlag = args.indexOf('--index');

const used   = loadUsed();
const unused = THEMES.map((t, i) => ({ ...t, index: i })).filter(t => !used.includes(t.index));

if (listAll) {
  console.log(`未使用テーマ: ${unused.length}件 / 全${THEMES.length}件\n`);
  unused.slice(0, 20).forEach(t => {
    console.log(`[${String(t.index).padStart(2)}] ${t.title}`);
    console.log(`     keyword: ${t.keyword}\n`);
  });
  process.exit(0);
}

let theme;
if (idxFlag !== -1) {
  const idx = parseInt(args[idxFlag + 1], 10);
  theme = { ...THEMES[idx], index: idx };
} else {
  theme = unused[0] || { ...THEMES[0], index: 0 };
}

// Claude Codeへの指示を出力
console.log('=== 次の記事テーマ ===\n');
console.log(`インデックス: ${theme.index}`);
console.log(`タイトル: ${theme.title}`);
console.log(`キーワード: ${theme.keyword}`);

// アウトラインがあれば表示
const crypto = require('crypto');
const hash   = crypto.createHash('md5').update(theme.keyword).digest('hex').slice(0, 8);
const outlineFile = path.join(__dirname, 'outlines', `${hash}.json`);
if (fs.existsSync(outlineFile)) {
  const outline = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  console.log(`\nアウトライン（${new Date(outline.generatedAt).toLocaleDateString('ja-JP')}生成）:`);
  console.log(`  タイトル案: ${outline.suggestedTitle}`);
  outline.headings?.forEach(h => {
    const indent = h.level === 'h3' ? '    ' : '  ';
    console.log(`${indent}[${h.level}] ${h.text}`);
  });
} else {
  console.log('\nアウトライン: なし（SERPキャッシュがあれば generate-outline.js で生成可能）');
}

console.log('\n--- Claude Codeへのコピペ用プロンプト ---');
console.log(`
以下のテーマでブログ記事を生成して blog-automation/article.json に保存してください。

テーマ: ${theme.title}
キーワード: ${theme.keyword}
themeIndex: ${theme.index}
`);
