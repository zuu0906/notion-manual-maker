#!/usr/bin/env node
/**
 * 記事をNotebookLM用テキストファイルに変換して出力する
 *
 * 使い方:
 *   node export-for-notebooklm.js                     # 最新のstateファイルを使用
 *   node export-for-notebooklm.js --run-id 1777853844293
 *
 * 出力: blog-automation/notebooklm-input.txt
 */

const fs   = require('fs');
const path = require('path');

const args    = process.argv.slice(2);
const runIdArg = args.includes('--run-id') ? args[args.indexOf('--run-id') + 1] : null;

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

function findLatestState() {
  const dir = path.join(__dirname, 'state');
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.includes('.done.'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) throw new Error('stateファイルが見つかりません');
  return path.join(dir, files[0].name);
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function main() {
  loadEnv();

  const stateFile = runIdArg
    ? path.join(__dirname, 'state', `${runIdArg}.json`)
    : findLatestState();

  if (!fs.existsSync(stateFile)) throw new Error(`ファイルが見つかりません: ${stateFile}`);

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const article = state.finalArticle || state.draft;
  if (!article) throw new Error('記事データが見つかりません（finalArticle/draft）');

  const { title, content, keyword } = article;

  // H2セクションごとに分割
  const sections = [];
  const h2Regex = /<h2>([^<]+)<\/h2>([\s\S]*?)(?=<h2>|$)/g;
  let match;
  while ((match = h2Regex.exec(content)) !== null) {
    sections.push({
      heading: match[1].trim(),
      body: stripHtml(match[2]).slice(0, 800), // 長すぎる場合は800文字まで
    });
  }

  // テキスト整形
  const lines = [
    `# ${title}`,
    `キーワード: ${keyword}`,
    '',
    '---',
    '',
  ];

  for (const s of sections) {
    lines.push(`## ${s.heading}`);
    lines.push(s.body);
    lines.push('');
  }

  // NotebookLM用プロンプトを末尾に添付
  lines.push('---');
  lines.push('');
  lines.push('【NotebookLMへの指示】');
  lines.push('上記の記事の各H2セクションについて、インフォグラフィック用の画像生成プロンプトを作成してください。');
  lines.push('条件：');
  lines.push('- 英語で記述');
  lines.push('- 「flat design infographic illustration」スタイル');
  lines.push('- テキスト・文字は画像に含めない（no text, no words）');
  lines.push('- 1200x630px バナー形式（16:9）');
  lines.push('- セクションの内容を視覚的に表す具体的なイラスト要素を含める');
  lines.push('');
  lines.push('以下のJSON形式のみで出力してください（説明文不要）:');
  lines.push('[');
  lines.push('  {');
  lines.push('    "section": "セクション見出し（日本語）",');
  lines.push('    "prompt": "英語プロンプト全文"');
  lines.push('  }');
  lines.push(']');

  const outputPath = path.join(__dirname, 'notebooklm-input.txt');
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

  console.log(`✅ 出力完了: ${outputPath}`);
  console.log(`   セクション数: ${sections.length}`);
  console.log('');
  console.log('次のステップ:');
  console.log('  1. https://notebooklm.google.com を開く');
  console.log('  2. 新しいノートブックを作成し、notebooklm-input.txt をソースに追加');
  console.log('  3. ファイル末尾の【NotebookLMへの指示】をチャットに貼り付けて実行');
  console.log('  4. 出力JSONを notebooklm-output.json に保存');
  console.log('  5. node generate-section-images.js --wp-id <WP記事ID>');
}

main();
