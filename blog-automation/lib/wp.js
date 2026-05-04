const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PERF_FILE = path.join(__dirname, '..', 'performance.json');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks),
        headers: res.headers,
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function generateImage(prompt) {
  log(`画像生成中: "${prompt}"`);
  const encoded = encodeURIComponent(prompt + ', clean flat illustration, business, japanese office, minimal, professional');
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1600&height=900&model=flux&nologo=true&seed=${Date.now()}`;
  const res = await request(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.status !== 200) throw new Error(`Image fetch failed: ${res.status}`);
  log(`画像取得完了 (${res.body.length} bytes)`);
  return res.body;
}

async function uploadMedia(imageBuffer, filename) {
  const WP_URL = (process.env.WP_URL || '').replace(/\/$/, '');
  const auth = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64');
  log(`メディアアップロード中: ${filename}`);
  const res = await request(`${WP_URL}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'image/png',
    },
  }, imageBuffer);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Media upload failed ${res.status}: ${res.body.toString().slice(0, 200)}`);
  }
  const data = JSON.parse(res.body.toString());
  log(`メディアID: ${data.id}`);
  return { id: data.id, url: data.source_url || '' };
}

async function getPost(wpId) {
  const WP_URL = (process.env.WP_URL || '').replace(/\/$/, '');
  const auth = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64');
  const res = await request(`${WP_URL}/wp-json/wp/v2/posts/${wpId}`, {
    headers: { 'Authorization': `Basic ${auth}` },
  });
  if (res.status !== 200) throw new Error(`Post fetch failed ${res.status}`);
  return JSON.parse(res.body.toString());
}

async function updatePost(wpId, content) {
  const WP_URL = (process.env.WP_URL || '').replace(/\/$/, '');
  const auth = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64');
  const body = Buffer.from(JSON.stringify({ content }));
  const res = await request(`${WP_URL}/wp-json/wp/v2/posts/${wpId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  }, body);
  if (res.status < 200 || res.status >= 300) throw new Error(`Post update failed ${res.status}`);
  log(`記事更新完了: ID ${wpId}`);
  return JSON.parse(res.body.toString());
}

async function postToWordPress(article, mediaId) {
  const WP_URL = (process.env.WP_URL || '').replace(/\/$/, '');
  const WP_CATEGORY_ID = parseInt(process.env.WP_CATEGORY_ID || '1', 10);
  const auth = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64');
  log('WordPress投稿中...');
  const body = JSON.stringify({
    title: article.title,
    content: article.content,
    status: 'draft',
    featured_media: mediaId || 0,
    categories: [WP_CATEGORY_ID],
    meta: { _yoast_wpseo_metadesc: article.metaDescription || article.meta_description || '' },
    excerpt: article.metaDescription || article.meta_description || '',
  });
  const res = await request(`${WP_URL}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  }, Buffer.from(body));
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Post failed ${res.status}: ${res.body.toString().slice(0, 300)}`);
  }
  const data = JSON.parse(res.body.toString());
  log(`投稿完了: ${data.link}`);
  return data;
}

function savePerformanceRecord(wpPost, theme, themeIndex) {
  let perf;
  try { perf = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8')); }
  catch { perf = { siteUrl: process.env.WP_URL || '', lastGscFetch: null, posts: [] }; }

  const today = new Date().toISOString().split('T')[0];
  perf.posts.push({
    wpId: wpPost.id,
    url: wpPost.link,
    keyword: theme.keyword,
    title: wpPost.title?.rendered || wpPost.title || '',
    published: today,
    themeIndex,
    snapshots: [],
  });
  fs.writeFileSync(PERF_FILE, JSON.stringify(perf, null, 2));
  log(`パフォーマンス記録を追加: ${wpPost.link}`);
}

module.exports = { generateImage, uploadMedia, postToWordPress, savePerformanceRecord, getPost, updatePost };
