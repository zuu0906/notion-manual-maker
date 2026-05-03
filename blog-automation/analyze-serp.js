#!/usr/bin/env node
/**
 * DuckDuckGo HTML検索 + 競合記事の見出し構造を分析（Playwright不要・完全無料）
 *
 * 使い方:
 *   node analyze-serp.js "Notion マニュアル 作り方"
 *   node analyze-serp.js --index 5
 *   node analyze-serp.js --all          # 未キャッシュのテーマを全て分析
 *   node analyze-serp.js --force "kw"   # キャッシュを無視して再取得
 */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// .env 読み込み
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const THEMES         = require('./themes.js');
const CACHE_DIR      = path.join(__dirname, 'serp-cache');
const CACHE_TTL_DAYS = 7;
const SKIP_DOMAINS   = ['youtube.com', 'twitter.com', 'x.com', 'amazon.co.jp', 'facebook.com', 'instagram.com'];

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function kwHash(keyword) {
  return crypto.createHash('md5').update(keyword).digest('hex').slice(0, 8);
}

function cacheFile(keyword) {
  return path.join(CACHE_DIR, `${kwHash(keyword)}.json`);
}

function isCacheValid(keyword) {
  const f = cacheFile(keyword);
  if (!fs.existsSync(f)) return false;
  return (Date.now() - fs.statSync(f).mtimeMs) / 86400000 < CACHE_TTL_DAYS;
}

function saveCache(keyword, data) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile(keyword), JSON.stringify(data, null, 2));
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers:  {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja-JP,ja;q=0.9',
          'Accept':          'text/html,application/xhtml+xml',
          ...headers,
        },
        timeout: 15000,
      }, res => {
        // リダイレクト追従（最大3回）
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          resolve(get(res.headers.location, headers));
          return;
        }
        const chunks = [];
        let total = 0;
        res.on('data', c => { total += c.length; if (total < 200000) chunks.push(c); });
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      });
      req.on('error', () => resolve({ status: 0, body: '' }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
      req.end();
    } catch { resolve({ status: 0, body: '' }); }
  });
}

// DuckDuckGo HTML検索
async function searchDDG(keyword) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword)}&kl=jp-jp`;
  const res = await get(url);
  if (res.status !== 200 || !res.body) return [];

  const results = [];
  const titleRe  = /class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)</g;
  const snippetRe = /class="result__snippet"[^>]*>([^<]+(?:<[^>]+>[^<]*)*)/g;

  const titles   = [...res.body.matchAll(titleRe)];
  const snippets = [...res.body.matchAll(snippetRe)];

  for (let i = 0; i < Math.min(titles.length, 10); i++) {
    let url = titles[i][1];
    const title = titles[i][2].trim();
    const snippet = snippets[i]
      ? snippets[i][1].replace(/<[^>]+>/g, '').trim().slice(0, 200)
      : '';

    // DDGのリダイレクトURLをデコード
    if (url.includes('duckduckgo.com/l/?')) {
      const uddg = url.match(/uddg=([^&]+)/);
      if (uddg) url = decodeURIComponent(uddg[1]);
    }

    if (!url.startsWith('http')) continue;
    if (SKIP_DOMAINS.some(d => url.includes(d))) continue;

    results.push({ url, title, snippet });
  }
  return results;
}

// 競合ページからH1/H2/H3を抽出
function extractHeadings(html) {
  const results = [];
  for (const level of ['h1', 'h2', 'h3']) {
    const re = new RegExp(`<${level}[^>]*>([\\s\\S]*?)<\\/${level}>`, 'gi');
    for (const m of html.matchAll(re)) {
      const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text && text.length > 2 && text.length < 100) {
        results.push({ level, text });
      }
    }
  }
  return results;
}

function estimateCharCount(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
}

async function analyzeSERP(keyword) {
  log(`検索中: "${keyword}"`);

  const organicResults = await searchDDG(keyword);
  log(`検索結果: ${organicResults.length}件`);

  // 上位5件の競合ページを取得
  const competitorAnalysis = [];
  for (const result of organicResults.slice(0, 5)) {
    log(`競合取得中: ${new URL(result.url).hostname}`);
    await sleep(1200);
    const res = await get(result.url);
    if (res.status === 200 && res.body) {
      competitorAnalysis.push({
        ...result,
        headings:  extractHeadings(res.body),
        charCount: estimateCharCount(res.body),
      });
    } else {
      competitorAnalysis.push({ ...result, headings: [], charCount: 0 });
    }
  }

  // H2の頻出パターンを集計
  const h2Freq = {};
  for (const comp of competitorAnalysis) {
    for (const h of comp.headings.filter(h => h.level === 'h2')) {
      h2Freq[h.text] = (h2Freq[h.text] || 0) + 1;
    }
  }
  const topH2s = Object.entries(h2Freq)
    .sort((a, b) => b[1] - a[1])
    .map(([text, count]) => ({ text, count }));

  return {
    keyword,
    scrapedAt:          new Date().toISOString(),
    organicResults,
    paaQuestions:       [], // DDGではPAA取得困難なためスキップ
    relatedSearches:    [],
    competitorAnalysis,
    topH2s,
  };
}

async function main() {
  const args    = process.argv.slice(2);
  const allFlag = args.includes('--all');
  const force   = args.includes('--force');
  const idxFlag = args.indexOf('--index');

  let keywords = [];
  if (allFlag) {
    keywords = THEMES.map(t => t.keyword);
  } else if (idxFlag !== -1) {
    const idx = parseInt(args[idxFlag + 1], 10);
    if (isNaN(idx) || !THEMES[idx]) { console.error('無効なインデックス'); process.exit(1); }
    keywords = [THEMES[idx].keyword];
  } else {
    const kw = args.find(a => !a.startsWith('--'));
    if (!kw) {
      console.log('使い方: node analyze-serp.js "キーワード"');
      console.log('        node analyze-serp.js --index 5');
      process.exit(1);
    }
    keywords = [kw];
  }

  let done = 0;
  for (const keyword of keywords) {
    if (!force && isCacheValid(keyword)) {
      log(`スキップ（7日以内のキャッシュあり）: "${keyword}"`);
      continue;
    }
    try {
      const data = await analyzeSERP(keyword);
      saveCache(keyword, data);
      log(`保存: ${cacheFile(keyword)}`);

      // サマリー表示
      console.log(`\n=== "${keyword}" SERP分析結果 ===`);
      console.log(`上位${data.organicResults.length}件を取得`);
      if (data.topH2s.length) {
        console.log('\n競合記事の頻出H2:');
        data.topH2s.slice(0, 8).forEach(h => console.log(`  (${h.count}件) ${h.text}`));
      }
      console.log('');
      done++;
    } catch (e) {
      log(`エラー: "${keyword}" — ${e.message}`);
    }
    if (keywords.length > 1) await sleep(3000);
  }

  log(`完了: ${done}件のSERPデータを取得`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
