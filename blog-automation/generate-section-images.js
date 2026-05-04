#!/usr/bin/env node
/**
 * H2セクションごとに Imagen 4 で画像生成して WP 記事に挿入する
 *
 * 使い方:
 *   node generate-section-images.js --wp-id 1303
 *
 * 動作:
 *   1. WP記事のH2見出しを取得
 *   2. Gemini Flash でセクションごとの英語アイコン説明を生成（数十トークン）
 *   3. Imagen 4 で1200x630px 画像を生成
 *   4. WP メディアにアップロード
 *   5. <h2> 直後に <figure><img> を挿入して記事を更新
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
const GEMINI_KEY = process.env.GEMINI_API_KEY;

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// H2見出しからアイコン説明3点を Gemini Flash で生成（小トークン）
async function buildIconDescription(heading) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text:
          `Output exactly 3 flat design icon descriptions for this blog section topic. ` +
          `Format: icon1, icon2, icon3 (comma-separated, one line, no extra text). ` +
          `Each description: 2-5 English words describing a simple icon. ` +
          `Topic: "${heading}"`,
        }] }],
        generationConfig: { maxOutputTokens: 100, temperature: 0.3 },
      }),
    }
  );
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  // コンマ区切りで3要素あることを確認、足りなければフォールバック
  const parts = text.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) return parts.slice(0, 3).join(', ');
  return 'document with checkmark, arrow connecting boxes, clipboard with list';
}

// Imagen 4 で画像生成
async function generateWithImagen4(iconDesc) {
  const prompt =
    'Flat design infographic illustration, wide horizontal 16:9 banner, very light gray background. ' +
    'Three rounded white cards arranged in a single horizontal row with soft drop shadows. ' +
    `Each card contains one simple clean icon: ${iconDesc}. ` +
    'Left card has blue accent border, center card has red accent border, right card has green accent border. ' +
    'Absolutely no text, no letters, no numbers, no words, no labels anywhere. ' +
    'Minimalist professional flat illustration, pastel colors, generous white space.';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '16:9' },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(`Imagen 4 エラー: ${data.error.message}`);
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('画像データがありません');
  return Buffer.from(b64, 'base64');
}

async function main() {
  if (!wpId) {
    console.error('使い方: node generate-section-images.js --wp-id <WP記事ID>');
    process.exit(1);
  }
  if (!GEMINI_KEY) {
    console.error('GEMINI_API_KEY が .env に未設定');
    process.exit(1);
  }

  log(`WP記事取得中: ID ${wpId}`);
  const post = await getPost(wpId);

  // raw を優先、なければ rendered をデコード
  let content = post.content?.raw || post.content?.rendered || '';
  content = content
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

  // H2見出しを抽出
  const h2s = [...content.matchAll(/<h2>([^<]+)<\/h2>/g)];
  if (h2s.length === 0) { log('H2見出しが見つかりません'); process.exit(0); }
  log(`H2セクション数: ${h2s.length}件`);

  for (const [tag, heading] of h2s) {
    log(`  処理中: "${heading}"`);
    try {
      const iconDesc = await buildIconDescription(heading);
      log(`    アイコン: ${iconDesc}`);
      const buf = await generateWithImagen4(iconDesc);
      const { url } = await uploadMedia(buf, `section-${Date.now()}.png`);
      if (!url) { log(`    ⚠️ URL取得失敗`); continue; }

      const figure = `<figure><img src="${url}" alt="${heading}" style="width:100%;border-radius:8px;margin:16px 0 24px;"></figure>`;
      content = content.replace(tag, `${tag}\n${figure}`);
      log(`    ✅ 挿入完了`);
    } catch (e) {
      log(`    ❌ ${e.message}`);
    }
  }

  await updatePost(wpId, content);
  log(`=== 完了: https://s-tasklog.com/?p=${wpId} ===`);
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
