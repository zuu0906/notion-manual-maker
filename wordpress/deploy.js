#!/usr/bin/env node
/**
 * WordPress 自動デプロイスクリプト
 * 使い方: node wordpress/deploy.js [ファイル名]
 *   例: node wordpress/deploy.js lp          → lp.html だけ更新
 *       node wordpress/deploy.js              → 全ページ更新
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── 設定（初回だけ編集してください） ────────────────────────────
const WP_BASE_URL = 'https://s-tasklog.com'; // WordPressのURL（末尾スラッシュなし）
const WP_USER    = 'admin';                   // WordPress ログインユーザー名
const WP_APP_PW  = 'TeEe FYth 4kz3 KI7Y VG01 RYsk'; // アプリケーションパスワード（下記参照）

// ファイル名 → WordPress ページID のマッピング
// ページIDは WordPress 管理画面 > ページ > 該当ページ > URLの ?post=XXX で確認
const PAGE_MAP = {
  'lp':           null, // 例: 10
  'pricing':      null, // 例: 12
  'success':      null, // 例: 14
  'how-it-works': null, // 例: 16
  'faq':          null, // 例: 18
  'privacy':      null, // 例: 20
  'terms':        null, // 例: 22
};
// ─────────────────────────────────────────────────────────────────

const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PW}`).toString('base64');

async function updatePage(slug, pageId) {
  const filePath = join(__dir, `${slug}.html`);
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    console.error(`  ✗ ファイルが見つかりません: ${filePath}`);
    return false;
  }

  if (!pageId) {
    console.warn(`  ⚠ ${slug}: PAGE_MAP にIDが未設定（スキップ）`);
    return false;
  }

  const url = `${WP_BASE_URL}/wp-json/wp/v2/pages/${pageId}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content,
        status: 'publish',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`  ✗ ${slug}: HTTP ${res.status} — ${body.slice(0, 120)}`);
      return false;
    }

    const data = await res.json();
    console.log(`  ✓ ${slug}: 更新完了 → ${data.link}`);
    return true;
  } catch (e) {
    console.error(`  ✗ ${slug}: ${e.message}`);
    return false;
  }
}

async function main() {
  const target = process.argv[2]; // 指定がなければ全件
  const targets = target
    ? [target]
    : Object.keys(PAGE_MAP);

  console.log(`\nWordPress デプロイ開始 (${targets.join(', ')})\n`);

  let ok = 0, fail = 0;
  for (const slug of targets) {
    if (!(slug in PAGE_MAP)) {
      console.warn(`  ⚠ "${slug}" は PAGE_MAP に存在しません`);
      fail++;
      continue;
    }
    const result = await updatePage(slug, PAGE_MAP[slug]);
    result ? ok++ : fail++;
  }

  console.log(`\n完了: ${ok}件成功 / ${fail}件スキップ or 失敗\n`);
}

main();
