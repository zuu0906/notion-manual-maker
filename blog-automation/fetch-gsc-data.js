#!/usr/bin/env node
/**
 * Google Search Console APIから掲載順位・CTRデータを取得して performance.json を更新
 *
 * 使い方:
 *   node fetch-gsc-data.js              # 直近30日のデータ取得
 *   node fetch-gsc-data.js --days 90    # 直近90日
 *
 * 必要な環境変数:
 *   GSC_SITE_URL          例: https://s-tasklog.com/ （GSCに登録した通り）
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN  gsc-setup.js で取得
 *
 * セットアップ: node gsc-setup.js
 */

const https = require('https');
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

const GSC_SITE_URL    = process.env.GSC_SITE_URL;
const CLIENT_ID       = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET   = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN   = process.env.GOOGLE_REFRESH_TOKEN;
const PERF_FILE       = path.join(__dirname, 'performance.json');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port:     443,
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

function toISODate(date) {
  return date.toISOString().split('T')[0];
}

// OAuth2 アクセストークン取得（Refresh Tokenを使用）
async function getAccessToken() {
  const body = new URLSearchParams({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type:    'refresh_token',
  }).toString();

  const res = await request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }, Buffer.from(body));

  const data = JSON.parse(res.body.toString());
  if (!data.access_token) {
    throw new Error(`トークン取得失敗: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// GSC Search Analytics クエリ
async function queryGSC(accessToken, startDate, endDate, dimensions = ['page']) {
  const siteEncoded = encodeURIComponent(GSC_SITE_URL);
  const apiUrl = `https://searchconsole.googleapis.com/webmasters/v3/sites/${siteEncoded}/searchAnalytics/query`;

  const body = JSON.stringify({
    startDate,
    endDate,
    dimensions,
    rowLimit: 1000,
    dataState: 'final',
  });

  const res = await request(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
  }, Buffer.from(body));

  if (res.status !== 200) {
    throw new Error(`GSC API error ${res.status}: ${res.body.toString().slice(0, 300)}`);
  }

  return JSON.parse(res.body.toString());
}

function loadPerformance() {
  try {
    return JSON.parse(fs.readFileSync(PERF_FILE, 'utf8'));
  } catch {
    return { siteUrl: GSC_SITE_URL, lastGscFetch: null, posts: [] };
  }
}

function savePerformance(data) {
  fs.writeFileSync(PERF_FILE, JSON.stringify(data, null, 2));
}

async function main() {
  // 環境変数チェック
  const missing = ['GSC_SITE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']
    .filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`未設定の環境変数: ${missing.join(', ')}`);
    console.error('node gsc-setup.js を実行してセットアップしてください。');
    process.exit(1);
  }

  const args    = process.argv.slice(2);
  const daysIdx = args.indexOf('--days');
  const days    = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) : 30;

  const endDate   = new Date();
  const startDate = new Date(endDate - days * 86400000);

  log(`GSCデータ取得: ${toISODate(startDate)} 〜 ${toISODate(endDate)}`);

  const accessToken = await getAccessToken();
  log('アクセストークン取得済み');

  // ページ別パフォーマンス取得
  const gscData = await queryGSC(accessToken, toISODate(startDate), toISODate(endDate), ['page']);
  const rows = gscData.rows || [];
  log(`GSCから ${rows.length} ページのデータ取得`);

  // performance.json に反映
  const perf = loadPerformance();
  const today = toISODate(new Date());

  // GSCのURLとperformance.jsonのURLをマッチング
  for (const row of rows) {
    const pageUrl = row.keys[0]; // e.g. https://s-tasklog.com/notion-manual/
    const snapshot = {
      date:        today,
      position:    Math.round(row.position * 10) / 10,
      impressions: row.impressions,
      clicks:      row.clicks,
      ctr:         Math.round(row.ctr * 10000) / 10000, // 小数4桁
    };

    const post = perf.posts.find(p => p.url === pageUrl || pageUrl.includes(p.url) || p.url.includes(pageUrl));
    if (post) {
      // 同日のスナップショットは上書き
      const existingIdx = post.snapshots.findIndex(s => s.date === today);
      if (existingIdx !== -1) {
        post.snapshots[existingIdx] = snapshot;
      } else {
        post.snapshots.push(snapshot);
      }
      log(`更新: ${pageUrl} → 順位${snapshot.position} / ${snapshot.impressions}imp / CTR${(snapshot.ctr * 100).toFixed(1)}%`);
    }
    // performance.jsonにない記事も記録（GSC発見の記事）
    else if (pageUrl.startsWith(GSC_SITE_URL) || pageUrl.startsWith(GSC_SITE_URL.replace(/\/$/, ''))) {
      perf.posts.push({
        wpId:        null,
        url:         pageUrl,
        keyword:     '',
        title:       '',
        published:   null,
        themeIndex:  null,
        snapshots:   [snapshot],
        _fromGSC:    true, // GSC発見フラグ
      });
      log(`新規追跡追加: ${pageUrl}`);
    }
  }

  perf.lastGscFetch = today;
  savePerformance(perf);

  // サマリー出力
  console.log('\n=== パフォーマンスサマリー ===');
  const tracked = perf.posts.filter(p => p.snapshots.length > 0);
  const withData = tracked.filter(p => {
    const latest = p.snapshots[p.snapshots.length - 1];
    return latest.impressions > 10;
  });

  withData
    .map(p => {
      const latest = p.snapshots[p.snapshots.length - 1];
      return { ...p, latest };
    })
    .sort((a, b) => a.latest.position - b.latest.position)
    .slice(0, 20)
    .forEach(p => {
      const url = p.url.replace(GSC_SITE_URL, '/');
      console.log(`  順位${String(p.latest.position).padStart(5)} | ${p.latest.impressions}imp | CTR${(p.latest.ctr * 100).toFixed(1)}% | ${url}`);
    });

  log('完了');
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
