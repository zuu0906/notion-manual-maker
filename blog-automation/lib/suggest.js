const https = require('https');
const http  = require('http');

function get(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers: {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja-JP,ja;q=0.9',
          'Accept':          'application/json, text/html',
        },
        timeout: 10000,
      }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      });
      req.on('error', () => resolve({ status: 0, body: '' }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
      req.end();
    } catch { resolve({ status: 0, body: '' }); }
  });
}

async function fetchGoogleSuggestions(keyword) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=ja&q=${encodeURIComponent(keyword)}`;
  const res = await get(url);
  if (res.status !== 200 || !res.body) return [];
  try {
    const data = JSON.parse(res.body);
    return (data[1] || []).slice(0, 15);
  } catch { return []; }
}

async function fetchYahooSuggestions(keyword) {
  const url = `https://suggest.yahoo.co.jp/search_suggest/api/v2/?output=json&p=${encodeURIComponent(keyword)}&lang=ja&region=jp`;
  const res = await get(url);
  if (res.status !== 200 || !res.body) return [];
  try {
    const data = JSON.parse(res.body);
    return (data.result || []).slice(0, 10).map(r => r[0]);
  } catch { return []; }
}

async function fetchAllSuggestions(keyword) {
  const [google, yahoo] = await Promise.all([
    fetchGoogleSuggestions(keyword),
    fetchYahooSuggestions(keyword),
  ]);
  const seen = new Set([keyword]);
  const merged = [];
  for (const s of [...google, ...yahoo]) {
    if (s && !seen.has(s)) { seen.add(s); merged.push(s); }
  }
  return { google, yahoo, merged };
}

module.exports = { fetchGoogleSuggestions, fetchYahooSuggestions, fetchAllSuggestions };
