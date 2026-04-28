#!/usr/bin/env node
/**
 * SERP分析キャッシュをもとにClaudeでSEO最適化された記事アウトラインを生成
 *
 * 使い方:
 *   node generate-outline.js "Notion マニュアル 作り方"
 *   node generate-outline.js --index 5
 *
 * 事前に analyze-serp.js を実行してキャッシュを作成しておくこと。
 * SERPキャッシュがない場合はキーワードのみでアウトラインを生成する（精度低め）。
 */

const https  = require('https');
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

const THEMES       = require('./themes.js');
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const CACHE_DIR    = path.join(__dirname, 'serp-cache');
const OUTLINE_DIR  = path.join(__dirname, 'outlines');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function kwHash(keyword) {
  return crypto.createHash('md5').update(keyword).digest('hex').slice(0, 8);
}

function loadSerpCache(keyword) {
  const f = path.join(CACHE_DIR, `${kwHash(keyword)}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  return null;
}

function saveOutline(keyword, data) {
  if (!fs.existsSync(OUTLINE_DIR)) fs.mkdirSync(OUTLINE_DIR, { recursive: true });
  const f = path.join(OUTLINE_DIR, `${kwHash(keyword)}.json`);
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
  return f;
}

function loadOutline(keyword) {
  const f = path.join(OUTLINE_DIR, `${kwHash(keyword)}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  return null;
}

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

function buildSerpSummary(serpData) {
  if (!serpData) return null;

  // 競合記事のH2見出し集計（頻出順）
  const h2Counts = {};
  for (const comp of serpData.competitorAnalysis) {
    for (const h of comp.headings.filter(h => h.level === 'h2')) {
      const normalized = h.text.slice(0, 30); // 正規化のため先頭30文字
      h2Counts[h.text] = (h2Counts[h.text] || 0) + 1;
    }
  }
  const topH2s = Object.entries(h2Counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([text, count]) => `- "${text}" (${count}件の競合が使用)`);

  // 文字数の平均
  const validCounts = serpData.competitorAnalysis
    .map(c => c.charCount)
    .filter(n => n > 0);
  const avgCharCount = validCounts.length
    ? Math.round(validCounts.reduce((a, b) => a + b, 0) / validCounts.length)
    : 2000;

  return {
    topH2s,
    avgCharCount,
    paaQuestions: serpData.paaQuestions,
    relatedSearches: serpData.relatedSearches,
    competitorCount: serpData.competitorAnalysis.length,
    topUrls: serpData.organicResults.slice(0, 5).map(r => r.url),
  };
}

async function generateOutline(theme, serpData) {
  const summary = buildSerpSummary(serpData);

  const serpSection = summary ? `
## SERP競合分析データ
競合記事数: ${summary.competitorCount}件
平均文字数: ${summary.avgCharCount}文字

競合記事で使われているH2見出し（頻出順）:
${summary.topH2s.join('\n')}

PAA（ユーザーがよく調べること）:
${summary.paaQuestions.map(q => `- ${q}`).join('\n') || '- (取得なし)'}

関連検索キーワード:
${summary.relatedSearches.map(r => `- ${r}`).join('\n') || '- (取得なし)'}
` : '（SERPデータなし：キーワードとテーマのみで生成）';

  const prompt = `あなたはSEOと日本語コンテンツ戦略の専門家です。
以下の情報をもとに、Notionブログ記事のSEO最適化アウトラインを生成してください。

## 記事情報
- タイトル案: ${theme.title}
- フォーカスキーワード: ${theme.keyword}
- ターゲット読者: Notionを使い始めた日本のビジネスパーソン
${serpSection}

## Chrome Manual Makerについて
- Chromeでクリックするだけでスクリーンショット＋赤丸アノテーションをNotionへ自動保存するツール
- Notionマニュアル作成を劇的に効率化する
- 無料プランあり
- CTA URL: https://chrome-manual-maker.s-tasklog.com

## 生成ルール
1. 競合記事が多く使っているH2は「必須要素」として含める
2. 競合が触れていない差別化ポイントを1〜2つ入れる
3. PAA質問に対する回答を記事の中で自然に答える
4. Chrome Manual MakerへのCTAを【記事の中盤（H2の2〜3番目付近）と末尾の2箇所】に配置
5. H2は4〜5個、必要なH3も含める
6. 検索意図に合った構成にする

## 出力形式（JSONのみ、コードブロック不要）
{
  "keyword": "${theme.keyword}",
  "suggestedTitle": "SEOタイトル（32文字以内、キーワード含む）",
  "metaDescription": "メタディスクリプション（120文字以内）",
  "searchIntent": "Informational|Commercial|Transactional のいずれか",
  "targetCharCount": 推奨文字数（数値）,
  "headings": [
    {
      "level": "h2",
      "text": "見出しテキスト",
      "notes": "なぜこの見出しか（競合頻出 or 差別化 or CTA）",
      "ctaHere": false
    }
  ],
  "paaToAnswer": ["この記事で答えるべきPAA質問"],
  "differentiators": ["競合が触れていない差別化ポイント"],
  "internalLinkSuggestions": ["関連する既存記事に内部リンクすべきトピック"]
}`;

  log('Claudeでアウトライン生成中...');
  const res = await request('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
  }, Buffer.from(JSON.stringify({
    model:      'claude-haiku-4-5-20251001', // アウトライン生成はHaikuで十分（コスト削減）
    max_tokens: 2048,
    messages:   [{ role: 'user', content: prompt }],
  })));

  if (res.status !== 200) {
    throw new Error(`Claude API error ${res.status}: ${res.body.toString().slice(0, 200)}`);
  }

  const data = JSON.parse(res.body.toString());
  const text = data.content[0].text.trim();
  const json = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

async function main() {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY が未設定');

  const args    = process.argv.slice(2);
  const idxFlag = args.indexOf('--index');

  let theme;
  if (idxFlag !== -1) {
    const idx = parseInt(args[idxFlag + 1], 10);
    theme = THEMES[idx];
    if (!theme) { console.error('無効なインデックス'); process.exit(1); }
  } else {
    const kw = args.find(a => !a.startsWith('--'));
    if (!kw) {
      console.log('使い方:');
      console.log('  node generate-outline.js "キーワード"');
      console.log('  node generate-outline.js --index 5');
      process.exit(1);
    }
    theme = THEMES.find(t => t.keyword === kw) || { title: kw, keyword: kw };
  }

  log(`アウトライン生成: "${theme.keyword}"`);

  const serpData = loadSerpCache(theme.keyword);
  if (serpData) {
    log(`SERPキャッシュ使用 (${new Date(serpData.scrapedAt).toLocaleDateString('ja-JP')}取得)`);
  } else {
    log('⚠️ SERPキャッシュなし。精度を上げるには先に analyze-serp.js を実行してください。');
  }

  const outline = await generateOutline(theme, serpData);
  outline.generatedAt = new Date().toISOString();
  outline.keyword = theme.keyword; // 確実に保持

  const savedPath = saveOutline(theme.keyword, outline);
  log(`保存: ${savedPath}`);

  // サマリー表示
  console.log('\n=== 生成アウトライン ===');
  console.log(`タイトル: ${outline.suggestedTitle}`);
  console.log(`検索意図: ${outline.searchIntent} / 目標文字数: ${outline.targetCharCount}`);
  console.log('\n見出し構成:');
  for (const h of outline.headings) {
    const indent = h.level === 'h3' ? '  ' : '';
    const ctaMark = h.ctaHere ? ' 🔗CTA' : '';
    console.log(`${indent}[${h.level}] ${h.text}${ctaMark}`);
    if (h.notes) console.log(`${indent}     → ${h.notes}`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });

// 他スクリプトから呼び出す場合のエクスポート
module.exports = { loadOutline, kwHash };
