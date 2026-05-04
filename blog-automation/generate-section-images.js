#!/usr/bin/env node
/**
 * NotebookLMが生成したプロンプトJSON → Gemini画像生成 → WP記事に挿入
 *
 * 使い方:
 *   node generate-section-images.js --wp-id 1303
 *
 * 事前準備:
 *   blog-automation/notebooklm-output.json を用意
 *   形式: [{ "section": "見出し", "prompt": "英語プロンプト" }, ...]
 */

const fs   = require('fs');
const path = require('path');
const { uploadMedia, getPost, updatePost } = require('./lib/wp');

// .env 読み込み
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const args  = process.argv.slice(2);
const wpId  = args.includes('--wp-id') ? args[args.indexOf('--wp-id') + 1] : null;
const INPUT = path.join(__dirname, 'notebooklm-output.json');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function generateWithGemini(prompt) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY が未設定');

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Gemini API エラー ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  }

  // レスポンスから画像データを抽出
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart) throw new Error('画像データがレスポンスに含まれていません');

  return Buffer.from(imagePart.inlineData.data, 'base64');
}

async function main() {
  if (!wpId) {
    console.error('使い方: node generate-section-images.js --wp-id <WP記事ID>');
    process.exit(1);
  }
  if (!fs.existsSync(INPUT)) {
    console.error(`notebooklm-output.json が見つかりません: ${INPUT}`);
    console.error('NotebookLMの出力をこのファイルに保存してください');
    process.exit(1);
  }

  const prompts = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  log(`プロンプト読み込み: ${prompts.length}件`);

  // WP記事の現在のcontentを取得
  log(`WP記事取得中: ID ${wpId}`);
  const post = await getPost(wpId);
  let content = post.content?.raw || post.content?.rendered || '';

  // rendered の場合はエンティティをデコード
  content = content
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

  // セクションごとに画像生成・挿入
  for (const { section, prompt } of prompts) {
    log(`  画像生成中: "${section}"`);
    try {
      const buf = await generateWithGemini(prompt);
      const { url } = await uploadMedia(buf, `section-${Date.now()}.png`);
      if (!url) { log(`  ⚠️ URL取得失敗: "${section}"`); continue; }

      // <h2>見出し</h2> の直後に figure を挿入（見出しテキストで照合）
      const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const h2Regex = new RegExp(`(<h2>${escaped}<\\/h2>)`, 'i');
      if (h2Regex.test(content)) {
        const figure = `<figure><img src="${url}" alt="${section}" style="width:100%;border-radius:8px;margin:16px 0 24px;"></figure>`;
        content = content.replace(h2Regex, `$1\n${figure}`);
        log(`  ✅ 挿入完了: "${section}"`);
      } else {
        log(`  ⚠️ 見出しが記事内に見つかりません: "${section}"`);
      }
    } catch (e) {
      log(`  ❌ エラー "${section}": ${e.message}`);
    }
  }

  // WP記事を更新
  await updatePost(wpId, content);
  log(`=== 完了: https://s-tasklog.com/?p=${wpId} ===`);
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
