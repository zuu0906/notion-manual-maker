/**
 * Google Trends 相対検索量取得
 * APIキー不要・無料。日本（JP）の過去12ヶ月の相対興味スコア（0〜100）を返す
 */

const https = require('https');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpsGet(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = https.request({
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers: {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
          'Accept':          'application/json, text/plain, */*',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
          'Referer':         'https://trends.google.com/',
          'Connection':      'keep-alive',
        },
        timeout: 20000,
      }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      });
      req.on('error',   () => resolve({ status: 0, body: '' }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
      req.end();
    } catch { resolve({ status: 0, body: '' }); }
  });
}

// Google は ")]}'\n" のプレフィックスを付けるので除去してパース
function parseGT(body) {
  const s = Math.min(
    body.indexOf('{') === -1 ? Infinity : body.indexOf('{'),
    body.indexOf('[') === -1 ? Infinity : body.indexOf('['),
  );
  if (s === Infinity) return null;
  try { return JSON.parse(body.slice(s)); } catch { return null; }
}

/**
 * 最大5キーワードの相対スコアを取得
 * @returns { [keyword]: avgScore (0〜100) }
 */
async function fetchTrendsScores(keywords) {
  if (!keywords.length) return {};
  const kws = keywords.slice(0, 5);

  const req = {
    comparisonItem: kws.map(k => ({ keyword: k, geo: 'JP', time: 'today 12-m' })),
    category: 0,
    property: '',
  };
  const exploreUrl = `https://trends.google.com/trends/api/explore?hl=ja&tz=-540&req=${encodeURIComponent(JSON.stringify(req))}`;

  const exploreRes = await httpsGet(exploreUrl);
  if (exploreRes.status !== 200 || !exploreRes.body) return {};

  const exploreData = parseGT(exploreRes.body);
  if (!exploreData) return {};

  const tsWidget = (exploreData.widgets || []).find(w => w.id === 'TIMESERIES');
  if (!tsWidget) return {};

  await sleep(1200);

  const dataUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=ja&tz=-540&req=${encodeURIComponent(JSON.stringify(tsWidget.request))}&token=${encodeURIComponent(tsWidget.token)}`;
  const dataRes = await httpsGet(dataUrl);
  if (dataRes.status !== 200 || !dataRes.body) return {};

  const timelineData = parseGT(dataRes.body);
  if (!timelineData) return {};

  const points = timelineData?.default?.timelineData || [];
  if (!points.length) return {};

  const sums   = new Array(kws.length).fill(0);
  const counts = new Array(kws.length).fill(0);
  for (const pt of points) {
    (pt.value || []).forEach((v, i) => {
      if (i < kws.length && v !== null) { sums[i] += v; counts[i]++; }
    });
  }

  const result = {};
  kws.forEach((kw, i) => {
    result[kw] = counts[i] > 0 ? Math.round(sums[i] / counts[i]) : 0;
  });
  return result;
}

/**
 * 多数のキーワードをバッチ処理し、リファレンスキーワードを基準に正規化する
 * @param {string[]} keywords
 * @param {string} reference - 比較基準（例: 'Notion 使い方'）
 * @returns { [keyword]: score | null }
 */
async function fetchTrendsScoresBatched(keywords, reference = 'Notion 使い方') {
  if (!keywords.length) return {};

  const BATCH    = 4; // 4KW + 1リファレンス = 5（Trends上限）
  const allScores = {};
  let   refBase   = null;

  for (let i = 0; i < keywords.length; i += BATCH) {
    const batch        = keywords.slice(i, i + BATCH);
    const batchWithRef = [reference, ...batch];

    if (i > 0) await sleep(2500); // レート制限回避

    const scores      = await fetchTrendsScores(batchWithRef);
    const refInBatch  = scores[reference] ?? null;

    if (refBase === null && refInBatch !== null && refInBatch > 0) refBase = refInBatch;
    const scale = (refBase && refInBatch) ? refBase / refInBatch : 1;

    for (const kw of batch) {
      allScores[kw] = scores[kw] !== undefined
        ? Math.min(100, Math.round(scores[kw] * scale))
        : null;
    }
  }

  return allScores;
}

/** スコアから検索量ラベルに変換 */
function volumeLabel(score) {
  if (score === null || score === undefined) return '不明';
  if (score >= 60) return '高';
  if (score >= 25) return '中';
  if (score >= 5)  return '低';
  return '極少';
}

module.exports = { fetchTrendsScores, fetchTrendsScoresBatched, volumeLabel };
