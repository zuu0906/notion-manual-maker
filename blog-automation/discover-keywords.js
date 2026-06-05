#!/usr/bin/env node
/**
 * キーワード自動発掘ツール（Notion中心 + Google Trends検索量）
 *
 * Notionを軸にしたシードからGoogleサジェストを展開し、
 * Claude でCTA挿入適性を評価 → Google Trends で相対検索量を取得して総合スコア化する
 *
 * 使い方:
 *   node discover-keywords.js                      # 全カテゴリで実行
 *   node discover-keywords.js --category マニュアル # カテゴリ絞り込み
 *   node discover-keywords.js --min-score 6        # 総合スコア6以上のみ表示
 *   node discover-keywords.js --no-trends          # Trends取得をスキップ（高速）
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

const { fetchAllSuggestions } = require('./lib/suggest');
const { callClaude }          = require('./lib/claude');
const THEMES                                     = require('./themes');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── シードキーワード（Notion中心・機能×用途の掛け合わせ） ──────────────────
// カテゴリ名はそのまま --category の絞り込みに使える
// ブリッジシード: 広いキーワードで「マニュアル」「手順書」を検索すると
// Notionキーワードが複数シードで出現 → seedCountが上がって需要スコアが機能する
const BRIDGE_SEEDS = [
  'マニュアル 作り方', 'マニュアル 作成 ツール', 'マニュアル 作成 おすすめ',
  '手順書 作り方', '手順書 テンプレート', '手順書 作成 ツール',
  '操作マニュアル 作り方', '業務マニュアル 作り方', '業務マニュアル ツール',
  '社内wiki 作り方', '社内ドキュメント 作り方', 'ナレッジ管理 ツール',
  '業務効率化 ツール', '引き継ぎ 資料 作り方', '引き継ぎ書 テンプレート',
  'スクリーンショット ツール Windows', 'スクリーンショット 共有 方法',
  '新人教育 マニュアル', 'OJT マニュアル',
];

const SEED_CATEGORIES = {

  'Notion入門・基礎': [
    'Notion 使い方', 'Notion 始め方', 'Notion 無料 できること',
    'Notion アプリ 使い方', 'Notion ブラウザ', 'Notion 日本語 設定',
    'Notion 登録方法', 'Notion ページ 作り方',
  ],

  'Notionマニュアル・手順書': [
    'Notion マニュアル', 'Notion 手順書', 'Notion 操作マニュアル',
    'Notion スクリーンショット', 'Notion 画像 貼り付け',
    'Notion マニュアル テンプレート', 'Notion 社内マニュアル',
    'Notion マニュアル 共有',
  ],

  'Notionデータベース・機能': [
    'Notion データベース', 'Notion テンプレート 作り方',
    'Notion フォーム', 'Notion ギャラリー', 'Notion カレンダー',
    'Notion リレーション', 'Notion ロールアップ', 'Notion フィルター',
    'Notion ビュー 切り替え',
  ],

  'Notion AI・自動化': [
    'Notion AI', 'Notion AI 使い方', 'Notion AI 料金',
    'Notion 自動化', 'Notion API 連携', 'Notion Zapier',
    'Notion Make 連携', 'Notion スラッシュコマンド',
  ],

  'Notion業務活用': [
    'Notion 業務効率化', 'Notion プロジェクト管理', 'Notion タスク管理',
    'Notion 議事録', 'Notion 日報', 'Notion 週報',
    'Notion ナレッジ管理', 'Notion 採用管理',
  ],

  'Notion連携・拡張': [
    'Notion Slack 連携', 'Notion Google Drive 連携',
    'Notion Chrome拡張', 'Notion Googleカレンダー',
    'Notion Figma', 'Notion GitHub',
  ],

  'Notion比較・選定': [
    'Notion Confluence 比較', 'Notion Evernote 比較',
    'Notion Google Docs 比較', 'Notion esa 比較',
    'Notion Obsidian 比較', 'Notion ClickUp 比較',
    'Notion OneNote 比較', 'Notion 有料 いつ',
  ],

  'Notionトラブル・Tips': [
    'Notion 重い 対処', 'Notion 使えない', 'Notion オフライン',
    'Notion 共有 できない', 'Notion PDF 書き出し',
    'Notion Excel 読み込み', 'Notion 表 作り方',
  ],

  'Notion × 職種・業種': [
    'Notion エンジニア 活用', 'Notion デザイナー テンプレート',
    'Notion 営業 管理', 'Notion 人事 採用',
    'Notion 中小企業 導入', 'Notion フリーランス 使い方',
    'Notion 学生 勉強',
  ],

  // 隣接トピック（記事内でNotionを解決策として提示）
  'マニュアル作成全般（Notion導線）': [
    'マニュアル作成 ツール', '業務マニュアル 作り方', '操作マニュアル テンプレート',
    '手順書 作り方 コツ', '業務 引き継ぎ 資料', '引き継ぎ書 作り方',
    '社内Wiki 作り方', 'ナレッジベース 構築',
  ],
};

// ─── Claude評価プロンプト ────────────────────────────────────────────────
const EVAL_SYSTEM = `あなたはSEOとコンテンツマーケティングの専門家です。

## Notion Manual Makerとは
- Chromeの拡張機能。ワンクリックでスクリーンショット＋赤丸注釈を撮ってNotionに自動保存できる
- 主なユースケース: Notionでの業務マニュアル作成・手順書作成・新人教育・システム操作説明
- ターゲット: Notionを使って日本のビジネスシーンでマニュアル・手順書を作る人

## 評価の目的
「このキーワードで書いた記事内に、Notion Manual Makerへの自然なCTAを挿入できるか」を評価する。
Notionが記事内に登場すること・解決策として使われることが望ましい。

## スコアリング基準（0〜10点）
- 9〜10: NotionとCTAが両方ドンピシャ（例: 「Notion マニュアル スクリーンショット」）
- 7〜8: Notionが中心でCTAを自然に入れやすい（例: 「Notion 手順書 作り方」「Notion マニュアル テンプレート」）
- 5〜6: Notionが登場しCTAも可能（例: 「Notion プロジェクト管理」「業務マニュアル ツール」）
- 3〜4: NotionかCTAの片方が弱い（例: 「Notion カレンダー 使い方」）
- 0〜2: Notionもマニュアルも遠い

## 出力形式（JSONのみ・コードブロック不要）
[
  {
    "keyword": "キーワード",
    "score": スコア（0〜10の整数）,
    "intent": "Informational または Commercial",
    "ctaAngle": "CTA挿入の切り口（20文字以内）",
    "suggestedTitle": "記事タイトル案（32文字以内・キーワード含む）"
  }
]`;

async function evaluateKeywords(keywords) {
  const kwList = keywords.map((k, i) => `${i + 1}. ${k}`).join('\n');
  const result = await callClaude({
    model:      'claude-haiku-4-5-20251001',
    system:     EVAL_SYSTEM,
    messages:   [{ role: 'user', content: `以下をスコアリングしてJSON配列で返してください。\n\n${kwList}` }],
    maxTokens:  3000,
    expectJson: false,
  });
  try {
    const s = result.text.indexOf('['), e = result.text.lastIndexOf(']');
    if (s === -1 || e === -1) return [];
    return JSON.parse(result.text.slice(s, e + 1));
  } catch { return []; }
}

async function main() {
  const args      = process.argv.slice(2);
  const minScore  = args.includes('--min-score')
    ? parseInt(args[args.indexOf('--min-score') + 1], 10) || 5 : 5;
  const catFilter = args.includes('--category')
    ? args[args.indexOf('--category') + 1] : null;
  const extraSeed = args.includes('--seed')
    ? args[args.indexOf('--seed') + 1] : null;

  const activeCats = catFilter
    ? Object.fromEntries(Object.entries(SEED_CATEGORIES).filter(([k]) => k.includes(catFilter)))
    : SEED_CATEGORIES;

  const seeds = [
    ...Object.values(activeCats).flat(),
    ...(catFilter ? [] : BRIDGE_SEEDS), // ブリッジシードは全体実行時のみ追加
    ...(extraSeed ? [extraSeed] : []),
  ];

  const existingKeywords = new Set(THEMES.map(t => t.keyword));
  log(`カテゴリ: ${Object.keys(activeCats).join(' / ')}`);
  log(`ブリッジシード: ${catFilter ? 0 : BRIDGE_SEEDS.length}件`);
  log(`シード合計: ${seeds.length}件`);
  log('Googleサジェスト取得中...');

  // 5件ずつ並列でサジェスト取得
  // seedCount = 何シードから出現したか（検索需要の代替指標）
  const kwFreq = {}; // { keyword: { seedCount, googleCount, yahooCount } }
  const BATCH  = 5;
  for (let i = 0; i < seeds.length; i += BATCH) {
    const batch   = seeds.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(s => fetchAllSuggestions(s)));
    for (const r of results) {
      const seenInThisSeed = new Set();
      for (const kw of r.google) {
        if (!existingKeywords.has(kw) && kw.length > 3) {
          if (!kwFreq[kw]) kwFreq[kw] = { seedCount: 0, googleCount: 0, yahooCount: 0 };
          kwFreq[kw].googleCount++;
          seenInThisSeed.add(kw);
        }
      }
      for (const kw of r.yahoo) {
        if (!existingKeywords.has(kw) && kw.length > 3) {
          if (!kwFreq[kw]) kwFreq[kw] = { seedCount: 0, googleCount: 0, yahooCount: 0 };
          kwFreq[kw].yahooCount++;
          seenInThisSeed.add(kw);
        }
      }
      for (const kw of seenInThisSeed) kwFreq[kw].seedCount++;
    }
    process.stdout.write(`\r  ${Math.min(i + BATCH, seeds.length)}/${seeds.length} シード完了...`);
    if (i + BATCH < seeds.length) await sleep(500);
  }
  console.log('');

  // 需要スコア（0〜100）: seedCount×8 + yahooCount×5
  // ブリッジシード追加により、高需要キーワードは複数シードから出現する設計
  // 閾値: 高=3シード以上(24+), 中=2シード(16+), 低=1シード(8+), 極少=Yahoo未確認
  function demandScore(f) {
    return Math.min(100, f.seedCount * 8 + f.yahooCount * 5);
  }
  function demandLabel(score) {
    if (score >= 24) return '高';
    if (score >= 16) return '中';
    if (score >= 8)  return '低';
    return '極少';
  }

  const discovered = Object.keys(kwFreq);
  log(`発掘キーワード（重複・既存除外後）: ${discovered.length}件`);
  if (!discovered.length) { log('新規キーワードなし'); return; }

  // ── Claude評価 ──────────────────────────────────────────────────────
  log('Claude評価中...');
  const kwArray    = discovered;
  const evaluated  = [];
  const EVAL_BATCH = 20;
  for (let i = 0; i < kwArray.length; i += EVAL_BATCH) {
    log(`  ${i + 1}〜${Math.min(i + EVAL_BATCH, kwArray.length)} / ${kwArray.length}件`);
    const results = await evaluateKeywords(kwArray.slice(i, i + EVAL_BATCH));
    evaluated.push(...results);
    if (i + EVAL_BATCH < kwArray.length) await sleep(800);
  }

  const preFiltered = evaluated.filter(e => e.score >= minScore);
  log(`Claude評価通過: ${preFiltered.length}件（スコア${minScore}以上）`);

  // ── 総合スコア計算 ────────────────────────────────────────────────────
  // 総合 = Claude(60%) + 検索需要スコア(40%)
  // 検索需要スコア = サジェスト出現シード数×12 + Yahoo出現数×6（最大100）
  // ※ 複数のNotionシードに跨って出現するキーワード = 需要が高い
  const scored = preFiltered.map(e => {
    const freq  = kwFreq[e.keyword] || { seedCount: 1, googleCount: 1, yahooCount: 0 };
    const ds    = demandScore(freq);
    const dlbl  = demandLabel(ds);
    const total = Math.round((e.score * 0.6 + (ds / 10) * 0.4) * 10) / 10;
    return {
      ...e,
      demandScore: ds,
      demandLabel: dlbl,
      seedCount:   freq.seedCount,
      yahooCount:  freq.yahooCount,
      totalScore:  total,
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  // ── 結果表示 ──────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(68)}`);
  console.log(`新規キーワード候補 計${scored.length}件（総合スコア順）`);
  console.log(`スコア = Claude評価(60%) + サジェスト需要スコア(40%)`);
  console.log(`需要スコア = ${seeds.length}シードを横断して出現した頻度（出現多＝高需要）`);
  console.log('='.repeat(68));

  for (const e of scored) {
    const seedInfo = `${e.seedCount}シード出現${e.yahooCount > 0 ? '・Yahoo確認済' : ''}`;
    console.log(`[総合:${e.totalScore} / Claude:${e.score} / 需要:${e.demandLabel}(${e.demandScore} / ${seedInfo})] ${e.keyword}`);
    console.log(`  タイトル案: ${e.suggestedTitle}`);
    console.log(`  CTA切り口: ${e.ctaAngle}  /  意図: ${e.intent}`);
    console.log('');
  }

  // ── themes.js形式 ─────────────────────────────────────────────────────
  console.log('='.repeat(68));
  console.log('themes.js に追記できる形式（総合スコア順）:');
  console.log('='.repeat(68));
  for (const e of scored) {
    const note = ` /* 需要:${e.demandLabel}(${e.seedCount}シード) Claude:${e.score} */`;
    console.log(`  { title: '${e.suggestedTitle}', keyword: '${e.keyword}' },${note}`);
  }

  // ファイル保存
  const outFile = path.join(__dirname, `discovered-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(scored, null, 2));
  log(`\nJSON保存: ${outFile}`);
  log(`完了: ${scored.length}件`);
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
