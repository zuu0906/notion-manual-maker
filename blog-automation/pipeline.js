#!/usr/bin/env node
/**
 * 記事生成マルチエージェントパイプライン
 *
 * 使い方:
 *   node pipeline.js                          # 次の未使用テーマで実行
 *   node pipeline.js --index 5               # themes.jsの5番目のテーマ
 *   node pipeline.js --keyword "カスタムKW"  # テーマ外のキーワード
 *   node pipeline.js --dry-run               # WordPressに投稿しない
 *   node pipeline.js --run-id 1777413254271  # 失敗したパイプラインを再開
 */

const fs   = require('fs');
const path = require('path');

// .env 読み込み（モジュールより先に実行）
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const THEMES = require('./themes');
const { initRun, loadState, saveState, markDone, markFailed } = require('./lib/state');
const { generateImage, uploadMedia, postToWordPress, savePerformanceRecord } = require('./lib/wp');
const { runPlanner }    = require('./agents/planner');
const { runResearcher } = require('./agents/researcher');
const { runStructurer } = require('./agents/structurer');
const { runWriter }     = require('./agents/writer');
const { runReviewer }   = require('./agents/reviewer');
const { runRewriter }          = require('./agents/rewriter');
const { runInfographicPrompter } = require('./agents/infographic-prompter');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

const USED_FILE = path.join(__dirname, '.used-themes.json');

function loadUsed() {
  try { return JSON.parse(fs.readFileSync(USED_FILE, 'utf8')); } catch { return []; }
}

function saveUsed(used) {
  fs.writeFileSync(USED_FILE, JSON.stringify(used));
}

function pickTheme(indexArg) {
  if (indexArg !== null) {
    const idx = parseInt(indexArg, 10);
    if (isNaN(idx) || !THEMES[idx]) throw new Error(`無効なテーマインデックス: ${indexArg}`);
    return { theme: THEMES[idx], index: idx };
  }
  const used   = loadUsed();
  const unused = THEMES.filter((_, i) => !used.includes(i));
  if (unused.length === 0) {
    log('全テーマを使い切りました。リセットします。');
    saveUsed([]);
    return { theme: THEMES[0], index: 0 };
  }
  const randIdx = THEMES.indexOf(unused[Math.floor(Math.random() * unused.length)]);
  return { theme: THEMES[randIdx], index: randIdx };
}

async function runPipeline({ keyword, themeIndex, theme, dryRun, resumeRunId }) {
  const { runId } = resumeRunId ? { runId: resumeRunId } : initRun(keyword, themeIndex);
  log(`=== パイプライン開始 runId=${runId} keyword="${keyword}" ===`);

  let state = loadState(runId);

  // Stage 1: 企画エージェント
  if (!state.plan) {
    log('[1/6] 企画エージェント...');
    state.plan = await runPlanner({ keyword, themeTitle: theme.title });
    saveState(runId, { plan: state.plan });
    log(`      角度: ${state.plan.angle}`);
  } else {
    log('[1/6] 企画エージェント スキップ（既存ステートあり）');
  }

  // Stage 2: リサーチエージェント（Claude呼び出しなし）
  if (!state.research) {
    log('[2/6] リサーチエージェント...');
    state.research = await runResearcher({ keyword, plan: state.plan });
    saveState(runId, { research: state.research });
    log(`      競合: ${state.research.competitorCount}件 / 平均文字数: ${state.research.avgCharCount}`);
  } else {
    log('[2/6] リサーチエージェント スキップ（既存ステートあり）');
  }

  // Stage 3: 構成エージェント
  if (!state.outline) {
    log('[3/6] 構成エージェント...');
    state.outline = await runStructurer(state.research);
    saveState(runId, { outline: state.outline });
    log(`      タイトル案: ${state.outline.suggestedTitle}`);
    log(`      見出し数: ${(state.outline.headings || []).filter(h => h.level === 'h2').length}個のH2`);
  } else {
    log('[3/6] 構成エージェント スキップ（既存ステートあり）');
  }

  // Stage 4: ライターエージェント（セクション別）
  if (!state.draft) {
    log('[4/6] ライターエージェント...');
    state.draft = await runWriter(state.outline);
    saveState(runId, { draft: state.draft });
    log(`      文字数: ${state.draft.totalChars} / CTA数: ${state.draft.ctaCount}`);
  } else {
    log('[4/6] ライターエージェント スキップ（既存ステートあり）');
  }

  // Stage 5: レビューエージェント
  if (!state.review) {
    log('[5/6] レビューエージェント...');
    const h2Count = (state.draft.content.match(/<h2[^>]*>/gi) || []).length;
    state.review = await runReviewer({
      title:           state.draft.title,
      content:         state.draft.content,
      totalChars:      state.draft.totalChars,
      ctaCount:        state.draft.ctaCount,
      h2Count,
      targetCharCount: state.outline.targetCharCount,
      keyword,
      persona:         state.outline.persona || null,
    });
    saveState(runId, { review: state.review });
    const status = state.review.passed ? '✓ PASS' : '✗ FAIL';
    log(`      スコア: ${state.review.score}/100 ${status}`);
    if (state.review.issues && state.review.issues.length) {
      state.review.issues.forEach(i => log(`      [${i.severity}] ${i.type}: ${i.detail}`));
    }
  } else {
    log('[5/6] レビューエージェント スキップ（既存ステートあり）');
  }

  // Stage 6: リライトエージェント（スコア<75のみ）
  if (!state.finalArticle) {
    if (state.review.passed) {
      log(`[6/6] リライトエージェント スキップ（スコア ${state.review.score}/100 合格）`);
      state.finalArticle = state.draft;
    } else {
      log(`[6/6] リライトエージェント実行（スコア ${state.review.score}/100 不合格）`);
      const rewrittenContent = await runRewriter({
        content:              state.draft.content,
        rewriteInstructions:  state.review.rewriteInstructions,
        keyword,
      });
      state.finalArticle = { ...state.draft, content: rewrittenContent };
    }
    saveState(runId, { finalArticle: state.finalArticle });
  } else {
    log('[6/6] リライトエージェント スキップ（既存ステートあり）');
  }

  // Stage 7: インフォグラフィックプロンプト生成（本文には影響しない）
  if (!state.infographicPrompts) {
    log('[7] インフォグラフィックプロンプト生成中...');
    state.infographicPrompts = await runInfographicPrompter(state.finalArticle, runId);
    saveState(runId, { infographicPrompts: state.infographicPrompts });
    log(`    → state/${runId}-infographics.md に保存しました`);
  } else {
    log('[7] インフォグラフィックプロンプト スキップ（既存ステートあり）');
  }

  if (dryRun) {
    log('--- DRY RUN: WordPressへの投稿をスキップ ---');
    console.log('\n=== 生成された記事 ===');
    console.log(JSON.stringify(state.finalArticle, null, 2));
    log(`ステートファイル: blog-automation/state/${runId}.json`);
    log(`インフォグラフィックプロンプト: blog-automation/state/${runId}-infographics.md`);
    return;
  }

  // アイキャッチ画像生成
  log('画像生成中...');
  let mediaId = 0;
  try {
    const imageBuffer = await generateImage(state.finalArticle.imagePrompt);
    ({ id: mediaId } = await uploadMedia(imageBuffer, `notion-blog-${runId}.png`));
  } catch (e) {
    log(`⚠️ 画像生成/アップロード失敗（記事は投稿します）: ${e.message}`);
  }

  const wpPost = await postToWordPress(state.finalArticle, mediaId);
  markDone(runId, state.finalArticle);
  savePerformanceRecord(wpPost, theme, themeIndex);
  saveUsed([...loadUsed(), themeIndex]);

  log(`=== 完了: ${wpPost.link} ===`);
}

async function main() {
  const args        = process.argv.slice(2);
  const dryRun      = args.includes('--dry-run');
  const indexArg    = args.includes('--index')   ? args[args.indexOf('--index') + 1]   : null;
  const kwArg       = args.includes('--keyword') ? args[args.indexOf('--keyword') + 1] : null;
  const resumeRunId = args.includes('--run-id')  ? args[args.indexOf('--run-id') + 1]  : null;

  if (!dryRun && (!process.env.WP_URL || !process.env.WP_USERNAME || !process.env.WP_APP_PASSWORD)) {
    throw new Error('WP_URL / WP_USERNAME / WP_APP_PASSWORD が未設定');
  }

  let theme, themeIndex, keyword;

  if (resumeRunId) {
    const s = loadState(resumeRunId);
    keyword    = s.keyword;
    themeIndex = s.themeIndex;
    theme      = THEMES[themeIndex] || { title: keyword, keyword };
  } else if (kwArg) {
    keyword    = kwArg;
    theme      = THEMES.find(t => t.keyword === kwArg) || { title: kwArg, keyword: kwArg };
    themeIndex = THEMES.indexOf(theme);
    if (themeIndex === -1) themeIndex = 999;
  } else {
    const picked = pickTheme(indexArg);
    theme      = picked.theme;
    themeIndex = picked.index;
    keyword    = theme.keyword;
  }

  log(`テーマ[${themeIndex}]: ${theme.title}`);
  log(`キーワード: ${keyword}`);

  try {
    await runPipeline({ keyword, themeIndex, theme, dryRun, resumeRunId });
  } catch (e) {
    if (resumeRunId) markFailed(resumeRunId, e);
    throw e;
  }
}

main().catch(e => {
  console.error('エラー:', e.message);
  process.exit(1);
});
