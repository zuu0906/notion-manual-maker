#!/usr/bin/env node
// build-store.js — extension/（開発ソース）から store-build/（ストア提出版）を生成しZIP化する。
//
// 目的: dev版とストア版で異なる manifest の3点（key / oauth2.client_id / version）を
//       「手作業の二重管理」でなくスクリプトで決定論的に適用し、取り違え事故を防ぐ。
//   - ストア版は `key` を入れない（拡張IDはChrome Web Storeが管理）
//   - oauth2.client_id は本番値に置換（dev版はローカル検証用の別client_id）
//   - version はコマンド引数で指定（公開中バージョンより大きくすること）
//   - デッドコード offscreen/ は同梱しない
//
// 使い方: node scripts/build-store.js 1.1.0
//
// ⚠️ 本番OAuth client_id は公開前提の値（秘密ではない）。dev版と取り違えると拡張IDが
//    変わり別物として登録される事故になるため、ここで一元管理する。

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'extension');
const OUT = path.join(ROOT, 'store-build');

// 本番（Chrome Web Store公開版）の OAuth client_id（公開値）
const PROD_OAUTH_CLIENT_ID = '1097550430323-6r11eua9fustnbffh91c8bi4lbc8a0a9.apps.googleusercontent.com';
// store-build に含めないもの（デッドコード・dev専用）
const EXCLUDE_DIRS = new Set(['offscreen']);
const EXCLUDE_FILES = new Set(['SETUP.md', 'README.md']);

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('usage: node scripts/build-store.js <version>  (例: 1.1.0)');
  process.exit(1);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      copyDir(path.join(src, e.name), path.join(dst, e.name));
    } else {
      if (EXCLUDE_FILES.has(e.name)) continue;
      fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
    }
  }
}

// 1) store-build のコード系を一旦クリーン（*.zip は残す）
for (const e of fs.readdirSync(OUT, { withFileTypes: true })) {
  if (e.name.endsWith('.zip')) continue;
  fs.rmSync(path.join(OUT, e.name), { recursive: true, force: true });
}

// 2) extension/ を store-build/ へ反映（offscreen等は除外）
copyDir(SRC, OUT);

// 3) manifest を本番用にパッチ
const mfPath = path.join(OUT, 'manifest.json');
const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
delete mf.key;                                  // ストア版に key は入れない
if (!mf.oauth2) mf.oauth2 = {};
mf.oauth2.client_id = PROD_OAUTH_CLIENT_ID;     // 本番OAuth
mf.version = version;
fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2) + '\n');

// 4) ZIP化（store-build 直下の非zipエントリをルートに格納）
const zipName = `Notion-Manual-Maker-v${version}.zip`;
const zipPath = path.join(OUT, zipName);
try { fs.unlinkSync(zipPath); } catch {}
const items = fs.readdirSync(OUT)
  .filter((n) => !n.endsWith('.zip'))
  .map((n) => `'${path.join(OUT, n)}'`)
  .join(',');
cp.execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path ${items} -DestinationPath '${zipPath}' -Force"`,
  { stdio: 'inherit' }
);

// 5) 検証ログ
console.log('--- build-store done ---');
console.log('version      :', mf.version);
console.log('key present  :', Object.prototype.hasOwnProperty.call(mf, 'key'), '(false であるべき)');
console.log('oauth client :', mf.oauth2.client_id);
console.log('zip          :', zipPath);
