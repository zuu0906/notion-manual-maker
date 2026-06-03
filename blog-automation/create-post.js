#!/usr/bin/env node
/**
 * Notion関連ブログ記事を自動生成してWordPressに下書き投稿するスクリプト
 *
 * 使い方:
 *   node create-post.js              # テーマを自動選択
 *   node create-post.js --index 3    # themes.jsの3番目のテーマを使用
 *   node create-post.js --dry-run    # WordPressに投稿せずコンソール出力のみ
 *
 * 必要な環境変数 (.env):
 *   ANTHROPIC_API_KEY   Claude APIキー
 *   WP_URL              WordPressのURL (例: https://s-tasklog.com)
 *   WP_USERNAME         WordPressのユーザー名
 *   WP_APP_PASSWORD     WordPressのアプリケーションパスワード
 */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// .env 読み込み（dotenvがなければ手動パース）
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const THEMES        = require('./themes.js');
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const WP_URL        = (process.env.WP_URL || '').replace(/\/$/, '');
const WP_USER       = process.env.WP_USERNAME;
const WP_PASS       = process.env.WP_APP_PASSWORD;

const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const idxFlag = args.indexOf('--index');
const WP_CATEGORY_ID = parseInt(process.env.WP_CATEGORY_ID || '1', 10);
const PERF_FILE = path.join(__dirname, 'performance.json');

// アウトラインを keywords のハッシュからロード（generate-outline.js が事前に生成）
function loadOutlineForKeyword(keyword) {
  const hash = crypto.createHash('md5').update(keyword).digest('hex').slice(0, 8);
  const f = path.join(__dirname, 'outlines', `${hash}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  return null;
}

function savePerformanceRecord(wpPost, theme, themeIndex) {
  let perf;
  try { perf = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8')); }
  catch { perf = { siteUrl: WP_URL, lastGscFetch: null, posts: [] }; }

  const today = new Date().toISOString().split('T')[0];
  perf.posts.push({
    wpId:       wpPost.id,
    url:        wpPost.link,
    keyword:    theme.keyword,
    title:      wpPost.title?.rendered || wpPost.title || '',
    published:  today,
    themeIndex,
    snapshots:  [],
  });
  fs.writeFileSync(PERF_FILE, JSON.stringify(perf, null, 2));
  log(`パフォーマンス記録を追加: ${wpPost.link}`);
}

// ── ユーティリティ ──────────────────────────────────────────

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

// ── Claude APIで記事生成 ─────────────────────────────────────

async function generateArticle(theme) {
  log(`記事生成中: "${theme.title}"`);

  // アウトラインが存在する場合はSERP分析結果を活用
  const outline = loadOutlineForKeyword(theme.keyword);
  if (outline) {
    log(`アウトライン使用: ${outline.headings?.length || 0}見出し / 検索意図: ${outline.searchIntent}`);
  }

  const outlineSection = outline ? `
## SEO最適化アウトライン（競合SERP分析に基づく・必ずこの構成に従うこと）

検索意図: ${outline.searchIntent}
目標文字数: ${outline.targetCharCount || 2000}文字

見出し構成:
${(outline.headings || []).map(h => {
  const indent = h.level === 'h3' ? '  ' : '';
  const ctaNote = h.ctaHere ? ' ← ここにNotion Manual MakerのCTAを挿入' : '';
  return `${indent}<${h.level}>${h.text}</${h.level}>${ctaNote}${h.notes ? `  // ${h.notes}` : ''}`;
}).join('\n')}

ユーザーが知りたいこと（本文内で自然に回答すること）:
${(outline.paaToAnswer || []).map(q => `- ${q}`).join('\n')}

差別化ポイント（競合記事が触れていない点・必ず盛り込む）:
${(outline.differentiators || []).map(d => `- ${d}`).join('\n')}
` : `
## 記事構成
1. リード文（読者の悩みに共感、150字程度）
2. H2セクションを4〜5個（各300〜400字）
3. H2の中盤（2〜3番目）にNotion Manual Makerの自然な言及を1段落
4. 最後のH2は「Notion Manual Makerでマニュアル作成をもっと効率化」
5. まとめ（3行以内）
`;

  const prompt = `あなたはSEOに強い日本語ブログライターです。
以下のテーマで、WordPressに投稿するためのブログ記事をHTMLで作成してください。

テーマ: ${theme.title}
フォーカスキーワード: ${theme.keyword}

## 基本要件
- 読者: Notionを使い始めた日本のビジネスパーソン
- トーン: 親しみやすく、実用的
- SEO: タイトルと最初の100文字以内にフォーカスキーワードを含める
${outlineSection}

## Notion Manual Makerについて（CTA用）
- Chromeでクリックするだけでスクリーンショット＋赤丸アノテーションをNotionへ自動保存するChrome拡張
- Notionマニュアル作成を劇的に効率化する
- 無料プランあり
- 記事中盤（自然な流れで）と末尾の2箇所にCTAを挿入すること

## CTA HTML（コピー必須）
<div style="background:#fff5f5;border-left:4px solid #e53e3e;padding:16px;margin:24px 0;">
<p>📸 <strong>スクリーンショットを撮りながらNotionに貼るのが面倒…</strong>と感じたことはありませんか？</p>
<p><strong>Notion Manual Maker</strong>を使えば、Chromeでクリックするだけでスクリーンショット＋赤丸注釈がNotionに自動保存されます。</p>
<a href="https://chrome-manual-maker.vercel.app" style="display:inline-block;background:#e53e3e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Notion Manual Makerを無料で試す →</a>
</div>

## 出力形式（JSONのみ・コードブロック不要）
{
  "title": "SEOタイトル（32文字以内、キーワード含む）",
  "meta_description": "メタディスクリプション（120文字以内、キーワード含む）",
  "content": "記事本文HTML（<h2>/<h3>/<p>/<ul>/<li>タグを使用）",
  "image_prompt": "英語でのStable Diffusion向け画像プロンプト（50語以内、日本のビジネスシーンを表現）",
  "tags": ["タグ1", "タグ2", "タグ3"]
}`;

  const res = await request('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
  }, Buffer.from(JSON.stringify({
    model:      'claude-opus-4-7',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  })));

  if (res.status !== 200) {
    throw new Error(`Claude API error ${res.status}: ${res.body.toString()}`);
  }

  const data  = JSON.parse(res.body.toString());
  const text  = data.content[0].text.trim();
  const json  = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

// ── Pollinations.aiで画像生成（無料・APIキー不要）──────────────

async function generateImage(prompt) {
  log(`画像生成中: "${prompt}"`);
  const encoded = encodeURIComponent(prompt + ', clean flat illustration, business, japanese office, minimal, professional');
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=630&model=flux&nologo=true&seed=${Date.now()}`;

  // Pollinations は画像URLを直接返すので、実際の画像をダウンロード
  const res = await request(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (res.status !== 200) throw new Error(`Image fetch failed: ${res.status}`);

  log(`画像取得完了 (${res.body.length} bytes)`);
  return res.body; // PNG/JPEG バイナリ
}

// ── WordPressにメディアをアップロード ───────────────────────────

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
    throw new Error(`Media upload failed ${res.status}: ${res.body.toString().slice(0, 200)}`);
  }
  const data = JSON.parse(res.body.toString());
  log(`メディアID: ${data.id}`);
  return data.id;
}

// ── WordPressに記事を投稿 ────────────────────────────────────

async function postToWordPress(article, mediaId) {
  log(`WordPress投稿中...`);
  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

  const body = JSON.stringify({
    title:          article.title,
    content:        article.content,
    status:         'publish',          // 'draft' にすれば下書き
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
    throw new Error(`Post failed ${res.status}: ${res.body.toString().slice(0, 300)}`);
  }
  const data = JSON.parse(res.body.toString());
  log(`投稿完了: ${data.link}`);
  return data;
}

// ── 使用済みテーマを記録（重複投稿防止）───────────────────────

const USED_FILE = path.join(__dirname, '.used-themes.json');

function loadUsed() {
  try { return JSON.parse(fs.readFileSync(USED_FILE, 'utf8')); } catch { return []; }
}

function saveUsed(used) {
  fs.writeFileSync(USED_FILE, JSON.stringify(used));
}

function pickTheme() {
  if (idxFlag !== -1) {
    const idx = parseInt(args[idxFlag + 1], 10);
    return THEMES[idx] || THEMES[0];
  }
  const used   = loadUsed();
  const unused = THEMES.filter((_, i) => !used.includes(i));
  if (unused.length === 0) {
    log('全テーマを使い切りました。リセットします。');
    saveUsed([]);
    return THEMES[0];
  }
  const randIdx = THEMES.indexOf(unused[Math.floor(Math.random() * unused.length)]);
  return { theme: THEMES[randIdx], index: randIdx };
}

// ── メイン ───────────────────────────────────────────────────

async function main() {
  log('=== ブログ自動投稿 開始 ===');

  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY が設定されていません');
  if (!dryRun && (!WP_URL || !WP_USER || !WP_PASS)) {
    throw new Error('WP_URL / WP_USERNAME / WP_APP_PASSWORD が設定されていません');
  }

  const { theme, index } = idxFlag !== -1
    ? { theme: pickTheme(), index: parseInt(args[idxFlag + 1], 10) }
    : pickTheme();

  log(`テーマ[${index}]: ${theme.title}`);

  // 1. 記事生成
  const article = await generateArticle(theme);
  log(`タイトル: ${article.title}`);
  log(`メタ: ${article.meta_description}`);

  if (dryRun) {
    log('--- DRY RUN: WordPressへの投稿をスキップ ---');
    console.log('\n=== 生成された記事 ===');
    console.log(JSON.stringify(article, null, 2));
    return;
  }

  // 2. 画像生成
  let mediaId = 0;
  try {
    const imageBuffer = await generateImage(article.image_prompt);
    const filename = `notion-blog-${Date.now()}.png`;
    mediaId = await uploadMedia(imageBuffer, filename);
  } catch (e) {
    log(`⚠️ 画像生成/アップロード失敗（記事は投稿します）: ${e.message}`);
  }

  // 3. WordPress投稿
  const wpPost = await postToWordPress(article, mediaId);

  // 4. 使用済みテーマを記録
  const used = loadUsed();
  used.push(index);
  saveUsed(used);

  // 5. パフォーマンス追跡に記録
  try {
    savePerformanceRecord(wpPost, theme, index);
  } catch (e) {
    log(`⚠️ パフォーマンス記録失敗（記事投稿は成功）: ${e.message}`);
  }

  log('=== 完了 ===');
}

main().catch(e => {
  console.error('エラー:', e.message);
  process.exit(1);
});
