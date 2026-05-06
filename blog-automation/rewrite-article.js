#!/usr/bin/env node
/**
 * 既存WP記事を3原則（問題解決・ペルソナ・具体例）でリライトする
 *
 * 使い方:
 *   node rewrite-article.js --wp-id 1289
 *   node rewrite-article.js --wp-id 1289 --dry-run   # WP更新せずプレビュー表示
 *   node rewrite-article.js --wp-id 1289 --instructions "CTAをもう1つ追加して"
 */

const fs   = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const { callClaude }           = require('./lib/claude');
const { getPost, updatePost }  = require('./lib/wp');
const { CTA_HTML }             = require('./lib/schemas');

const args         = process.argv.slice(2);
const wpId         = args.includes('--wp-id')           ? args[args.indexOf('--wp-id') + 1]           : null;
const dryRun       = args.includes('--dry-run');
const extraInst    = args.includes('--instructions')    ? args[args.indexOf('--instructions') + 1]    : null;

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

const REWRITE_SYSTEM = `あなたはSEOに強い日本語ブログリライターです。
既存のNotionブログ記事を、次の3原則に沿ってリライトします。

## リライト3原則
1. 問題解決: 記事テーマに沿った「読者の具体的な問題を解決する記事」になっていること
   - 記事全体を通じて「誰のどんな問題を解決するか」が明確である
   - リード文でその問題に共感し、解決策を提示する

2. ペルソナ共鳴: ペルソナは書き手の内部文脈として使い、本文には登場させない
   - ペルソナ名や「〇〇さんのケースでは」といった表現は本文に出さない
   - ペルソナの役職・状況・悩みから逆算した言葉選び・視点・深さで書く
   - 「その読者が読んだら思わず頷く」共感ポイントを自然な文章に織り込む

3. 具体例必須: 各H2セクションに必ず1つ以上の具体例を入れる
   - 「例えば、〇〇のような場合は〜」「〜という状況なら〜」「実際に〇〇業種では〜」
   - 数字・職種・状況を使ってリアリティを出す（架空でよい）
   - ペルソナ名は固有名詞として本文に登場させない

## 文体・HTMLルール
- です・ます調を維持
- 既存のHTML構造（<h2>, <h3>, <p>等）を壊さない
- CTAのHTMLブロックは変更しない（位置は変えてよい）
- スマホで読みやすい短い段落（<p>70文字以内目安）
- 文字数は元記事と同程度か多くする（削りすぎ禁止）

## 出力
リライト後のHTML本文全体のみ出力。説明・前置き不要。`;

async function analyzeAndRewrite(post, extraInstructions) {
  let content = post.content?.raw || post.content?.rendered || '';
  content = content
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

  const title = post.title?.rendered || post.title?.raw || '';

  log('ペルソナ・問題を分析中...');

  // Step 1: ペルソナと問題を定義
  const analysisResult = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: `記事を分析してペルソナと問題を定義します。JSONのみ出力。
{
  "keyword": "記事のメインキーワード",
  "persona": {
    "name": "ペルソナ名（例: 田中 恵子）",
    "role": "役職・立場・年代",
    "situation": "この記事を検索している状況",
    "pain": "具体的な悩み（1文）"
  },
  "readerProblem": "解決したい問題（1文）",
  "problemSolution": "記事を読むと何が解決するか（1文）"
}`,
    messages: [{
      role: 'user',
      content: `記事タイトル: ${title}\n\n記事本文（先頭3000文字）:\n${content.slice(0, 3000)}\n\n上記記事のペルソナと問題をJSONで定義してください。`,
    }],
    maxTokens: 500,
    expectJson: true,
  });

  let analysis;
  try {
    analysis = JSON.parse(analysisResult.text);
  } catch {
    throw new Error(`分析JSONパース失敗: ${analysisResult.text.slice(0, 200)}`);
  }

  log(`ペルソナ: ${analysis.persona.name}（${analysis.persona.role}）`);
  log(`問題: ${analysis.readerProblem}`);
  log(`解決: ${analysis.problemSolution}`);

  // Step 2: リライト実行
  log('リライト中...');

  const extraBlock = extraInstructions
    ? `\n\n## 追加指示\n${extraInstructions}`
    : '';

  const rewriteResult = await callClaude({
    model: 'claude-sonnet-4-6',
    system: REWRITE_SYSTEM,
    messages: [{
      role: 'user',
      content: `## リライト対象記事
タイトル: ${title}
キーワード: ${analysis.keyword}

## ペルソナ情報
ペルソナ: ${analysis.persona.name}（${analysis.persona.role}）
状況: ${analysis.persona.situation}
悩み: ${analysis.persona.pain}
解決する問題: ${analysis.readerProblem}
解決後の姿: ${analysis.problemSolution}

## CTA HTML（変更禁止）
${CTA_HTML}
${extraBlock}

## 元の記事HTML
${content}`,
    }],
    maxTokens: 8000,
    expectJson: false,
  });

  let rewritten = rewriteResult.text;
  // コードブロックマーカー除去
  rewritten = rewritten.replace(/^```[a-z]*\n?/gim, '').replace(/^```\n?/gim, '').trim();

  return { rewritten, analysis };
}

async function main() {
  if (!wpId) {
    console.error('使い方: node rewrite-article.js --wp-id <WP記事ID> [--dry-run] [--instructions "追加指示"]');
    process.exit(1);
  }

  log(`WP記事取得中: ID ${wpId}`);
  const post = await getPost(wpId);
  const title = post.title?.rendered || post.title?.raw || '';
  log(`タイトル: ${title}`);

  const { rewritten, analysis } = await analyzeAndRewrite(post, extraInst);

  const charCount = rewritten.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
  log(`リライト完了: ${charCount}文字`);

  if (dryRun) {
    log('--- DRY RUN: WP更新をスキップ ---');
    console.log('\n=== ペルソナ分析 ===');
    console.log(JSON.stringify(analysis, null, 2));
    console.log('\n=== リライト後（先頭2000文字） ===');
    console.log(rewritten.slice(0, 2000));
    return;
  }

  await updatePost(wpId, rewritten);
  log(`=== 完了: https://s-tasklog.com/?p=${wpId} ===`);
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
