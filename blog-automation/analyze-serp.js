#!/usr/bin/env node
/**
 * Google SERPをPlaywrightでスクレイピングして競合記事の構造を分析
 *
 * 使い方:
 *   node analyze-serp.js "Notion マニュアル 作り方"
 *   node analyze-serp.js --index 5
 *   node analyze-serp.js --all          # 未キャッシュのテーマを全て分析
 *   node analyze-serp.js --force "kw"   # キャッシュを無視して再取得
 *
 * 注意: Playwrightが必要。初回のみ:
 *   npm install playwright
 *   npx playwright install chromium
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');
const crypto = require('crypto');

// .env 読み込み
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const THEMES    = require('./themes.js');
const CACHE_DIR = path.join(__dirname, 'serp-cache');
const CACHE_TTL_DAYS = 7;

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
  const ageDays = (Date.now() - fs.statSync(f).mtimeMs) / 86400000;
  return ageDays < CACHE_TTL_DAYS;
}

function saveCache(keyword, data) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile(keyword), JSON.stringify(data, null, 2));
}

// 競合ページのHTMLを取得（最大100KB）
function fetchPageHtml(url) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja-JP,ja;q=0.9',
          'Accept': 'text/html',
        },
        timeout: 10000,
      }, res => {
        const chunks = [];
        let total = 0;
        res.on('data', c => {
          total += c.length;
          if (total < 150000) chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
      req.on('error', () => resolve(''));
      req.on('timeout', () => { req.destroy(); resolve(''); });
      req.end();
    } catch { resolve(''); }
  });
}

function extractHeadings(html) {
  const results = [];
  for (const level of ['h1', 'h2', 'h3']) {
    const re = new RegExp(`<${level}[^>]*>([\\s\\S]*?)<\\/${level}>`, 'gi');
    for (const m of html.matchAll(re)) {
      const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text && text.length < 150) results.push({ level, text });
    }
  }
  return results;
}

function estimateCharCount(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
}

async function scrapeSERP(keyword) {
  let chromium;
  try {
    chromium = require('playwright').chromium;
  } catch {
    throw new Error('Playwright未インストール。実行: npm install playwright && npx playwright install chromium');
  }

  log(`Google検索中: "${keyword}"`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const context = await browser.newContext({
    locale: 'ja-JP',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.5' },
  });

  const page = await context.newPage();
  let serpData = null;

  try {
    const url = `https://www.google.co.jp/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=jp&num=10`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);

    const title = await page.title();
    if (title.toLowerCase().includes('captcha') || title.includes('unusual traffic')) {
      log('⚠️ CAPTCHA検出。スキップします。');
      await browser.close();
      return null;
    }

    // オーガニック検索結果
    const organicResults = await page.evaluate(() => {
      const seen = new Set();
      const items = [];
      const candidates = document.querySelectorAll('div.g, div[data-sokoban-container]');
      candidates.forEach(div => {
        const a   = div.querySelector('a[href^="http"]');
        const h3  = div.querySelector('h3');
        const snp = div.querySelector('[data-sncf="1"], .VwiC3b, [style*="-webkit-line-clamp"]');
        if (!a || !h3 || seen.has(a.href)) return;
        // 広告除外
        if (div.closest('[data-text-ad]') || div.closest('.ads-ad')) return;
        seen.add(a.href);
        items.push({
          url: a.href,
          title: h3.innerText.trim(),
          snippet: snp ? snp.innerText.trim().slice(0, 200) : '',
        });
      });
      return items.slice(0, 10);
    });

    // PAA（People Also Ask）
    const paaQuestions = await page.evaluate(() => {
      const qs = new Set();
      // パターン1
      document.querySelectorAll('[data-q]').forEach(el => {
        const q = el.getAttribute('data-q');
        if (q) qs.add(q.trim());
      });
      // パターン2: aria-expanded ボタン
      document.querySelectorAll('div[role="heading"][aria-level]').forEach(el => {
        const t = el.innerText.trim();
        if (t && (t.endsWith('？') || t.endsWith('?') || t.includes('方法') || t.includes('とは')) && t.length < 80) {
          qs.add(t);
        }
      });
      return [...qs].slice(0, 8);
    });

    // 関連検索
    const relatedSearches = await page.evaluate(() => {
      const rs = [];
      document.querySelectorAll('#brs a, .k8XOCe a').forEach(a => {
        const t = a.innerText.trim();
        if (t) rs.push(t);
      });
      return [...new Set(rs)].slice(0, 8);
    });

    log(`結果: ${organicResults.length}件 / PAA: ${paaQuestions.length}件`);
    await browser.close();

    // 上位5件の競合記事を取得（広告・動画サイト除外）
    const SKIP_DOMAINS = ['youtube.com', 'twitter.com', 'x.com', 'amazon.co.jp', 'rakuten.co.jp', 'wikipedia.org'];
    const top5 = organicResults
      .filter(r => !SKIP_DOMAINS.some(d => r.url.includes(d)))
      .slice(0, 5);

    const competitorAnalysis = [];
    for (const result of top5) {
      log(`競合取得中: ${new URL(result.url).hostname}`);
      await sleep(1800);
      const html = await fetchPageHtml(result.url);
      competitorAnalysis.push({
        ...result,
        headings:  html ? extractHeadings(html) : [],
        charCount: html ? estimateCharCount(html) : 0,
      });
    }

    serpData = {
      keyword,
      scrapedAt: new Date().toISOString(),
      organicResults,
      paaQuestions,
      relatedSearches,
      competitorAnalysis,
    };

  } catch (e) {
    await browser.close();
    throw e;
  }

  return serpData;
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
      console.log('使い方:');
      console.log('  node analyze-serp.js "キーワード"');
      console.log('  node analyze-serp.js --index 5');
      console.log('  node analyze-serp.js --all');
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
      const data = await scrapeSERP(keyword);
      if (data) {
        saveCache(keyword, data);
        log(`保存: ${cacheFile(keyword)}`);
        done++;
      }
    } catch (e) {
      log(`エラー: "${keyword}" — ${e.message}`);
    }
    if (keywords.length > 1) await sleep(5000); // Google負荷軽減
  }

  log(`完了: ${done}件のSERPデータを取得`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
