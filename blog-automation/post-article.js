#!/usr/bin/env node
/**
 * Claude Codeが生成した記事JSONをWordPressに投稿するスクリプト
 *
 * 使い方:
 *   node post-article.js                    # article.json を投稿
 *   node post-article.js --file foo.json    # 指定ファイルを投稿
 *   node post-article.js --dry-run          # 投稿せず内容確認のみ
 *
 * article.json の形式:
 * {
 *   "title": "記事タイトル",
 *   "meta_description": "メタディスクリプション",
 *   "content": "<p>本文HTML</p>",
 *   "image_prompt": "画像プロンプト（英語）",
 *   "tags": ["タグ1", "タグ2"],
 *   "themeIndex": 0,
 *   "keyword": "Notion マニュアル 作り方"
 * }
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// .env 読み込み
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const WP_URL         = (process.env.WP_URL || '').replace(/\/$/, '');
const WP_USER        = process.env.WP_USERNAME;
const WP_PASS        = process.env.WP_APP_PASSWORD;
const WP_CATEGORY_ID = parseInt(process.env.WP_CATEGORY_ID || '1', 10);
const PERF_FILE      = path.join(__dirname, 'performance.json');
const USED_FILE      = path.join(__dirname, '.used-themes.json');

const args      = process.argv.slice(2);
const dryRun    = args.includes('--dry-run');
const isDraft   = args.includes('--draft');
const fileFlag  = args.indexOf('--file');
const inputFile = fileFlag !== -1 ? args[fileFlag + 1] : path.join(__dirname, 'article.json');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers:  options.headers || {},
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function generateImage(prompt) {
  log(`画像生成中...`);
  const encoded = encodeURIComponent(prompt + ', clean flat illustration, business, japanese office, minimal, professional');
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=630&model=flux&nologo=true&seed=${Date.now()}`;
  const res = await request(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.status !== 200) throw new Error(`画像取得失敗: ${res.status}`);
  log(`画像取得完了 (${res.body.length} bytes)`);
  return res.body;
}

async function uploadMedia(imageBuffer, filename) {
  log(`メディアアップロード中: ${filename}`);
  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  const res = await request(`${WP_URL}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      'Authorization':       `Basic ${auth}`,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type':        'image/png',
    },
  }, imageBuffer);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`メディアアップロード失敗 ${res.status}: ${res.body.toString().slice(0, 200)}`);
  }
  const data = JSON.parse(res.body.toString());
  log(`メディアID: ${data.id}`);
  return data.id;
}

async function postToWordPress(article, mediaId) {
  log(`WordPress投稿中...`);
  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  const body = JSON.stringify({
    title:          article.title,
    content:        article.content,
    status:         isDraft ? 'draft' : 'publish',
    featured_media: mediaId || 0,
    categories:     [WP_CATEGORY_ID],
    meta:           { _yoast_wpseo_metadesc: article.meta_description },
    excerpt:        article.meta_description,
  });
  const res = await request(`${WP_URL}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/json',
    },
  }, Buffer.from(body));
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`投稿失敗 ${res.status}: ${res.body.toString().slice(0, 300)}`);
  }
  const data = JSON.parse(res.body.toString());
  log(`投稿完了: ${data.link}`);
  return data;
}

function savePerformanceRecord(wpPost, article) {
  let perf;
  try { perf = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8')); }
  catch { perf = { siteUrl: WP_URL, lastGscFetch: null, posts: [] }; }
  perf.posts.push({
    wpId:       wpPost.id,
    url:        wpPost.link,
    keyword:    article.keyword || '',
    title:      wpPost.title?.rendered || article.title,
    published:  new Date().toISOString().split('T')[0],
    themeIndex: article.themeIndex ?? null,
    snapshots:  [],
  });
  fs.writeFileSync(PERF_FILE, JSON.stringify(perf, null, 2));
}

function markThemeUsed(themeIndex) {
  if (themeIndex == null) return;
  let used = [];
  try { used = JSON.parse(fs.readFileSync(USED_FILE, 'utf8')); } catch {}
  if (!used.includes(themeIndex)) {
    used.push(themeIndex);
    fs.writeFileSync(USED_FILE, JSON.stringify(used));
    log(`テーマ[${themeIndex}]を使用済みに記録`);
  }
}

async function main() {
  if (!fs.existsSync(inputFile)) {
    console.error(`ファイルが見つかりません: ${inputFile}`);
    console.error('Claude Codeに「次の記事を生成して」と伝えてarticle.jsonを作成してください。');
    process.exit(1);
  }

  const article = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  log(`記事読み込み: "${article.title}"`);

  if (dryRun) {
    log('--- DRY RUN ---');
    console.log(JSON.stringify(article, null, 2));
    return;
  }

  if (!WP_URL || !WP_USER || !WP_PASS) {
    throw new Error('WP_URL / WP_USERNAME / WP_APP_PASSWORD が未設定');
  }

  // 画像生成
  let mediaId = 0;
  if (article.image_prompt) {
    try {
      const imageBuffer = await generateImage(article.image_prompt);
      mediaId = await uploadMedia(imageBuffer, `notion-blog-${Date.now()}.png`);
    } catch (e) {
      log(`⚠️ 画像生成失敗（記事は投稿します）: ${e.message}`);
    }
  }

  // WordPress投稿
  const wpPost = await postToWordPress(article, mediaId);

  // 記録更新
  savePerformanceRecord(wpPost, article);
  markThemeUsed(article.themeIndex);

  // 投稿済みファイルをアーカイブ
  const archiveName = inputFile.replace('.json', `-${Date.now()}.done.json`);
  fs.renameSync(inputFile, archiveName);
  log(`アーカイブ: ${path.basename(archiveName)}`);

  log('=== 完了 ===');
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
