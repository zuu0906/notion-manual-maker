#!/usr/bin/env node
/**
 * Google Search Console API 用 OAuth2 Refresh Token 取得スクリプト
 *
 * 使い方: node gsc-setup.js
 *
 * 手順:
 *   1. Google Cloud Console → Credentials → OAuth client ID の
 *      「承認済みのリダイレクト URI」に以下を追加:
 *        http://localhost:3000/callback
 *
 *   2. node gsc-setup.js を実行
 *
 *   3. ブラウザが開く（または表示されたURLを開く）
 *
 *   4. Googleアカウントで認証すると自動的にRefresh Tokenが表示される
 */

const https    = require('https');
const http     = require('http');
const fs       = require('fs');
const path     = require('path');

// .env 読み込み
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT          = 3000;
const REDIRECT_URI  = `http://localhost:${PORT}/callback`;

const SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly';

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('エラー: GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を .env に設定してください。');
    process.exit(1);
  }

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
  }).toString();

  console.log('=== Google Search Console OAuth2 セットアップ ===\n');

  // ローカルサーバーでコードを受け取る
  await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname !== '/callback') {
        res.end('Not found');
        return;
      }

      const code  = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error || !code) {
        res.writeHead(400);
        res.end(`<h1>エラー: ${error || '認証コードが取得できませんでした'}</h1>`);
        server.close();
        reject(new Error(error || 'no code'));
        return;
      }

      // コードをRefresh Tokenに交換
      console.log('認証コードを取得。Refresh Tokenに交換中...');
      try {
        const tokens = await httpsPost('https://oauth2.googleapis.com/token',
          new URLSearchParams({
            code,
            client_id:     CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri:  REDIRECT_URI,
            grant_type:    'authorization_code',
          }).toString()
        );

        if (tokens.refresh_token) {
          // .env に自動書き込み
          let envContent = fs.readFileSync(envPath, 'utf8');
          if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
            envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
          } else {
            envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
          }
          fs.writeFileSync(envPath, envContent);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <h1>✅ 認証成功！</h1>
            <p>Refresh Token を .env に保存しました。このタブを閉じてください。</p>
            <pre>GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</pre>
          `);

          console.log('\n✅ 取得成功！\n');
          console.log('.env に自動保存しました:');
          console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
          console.log('\nGitHub Secrets にも以下を追加してください:');
          console.log(`  GSC_SITE_URL=https://s-tasklog.com/`);
          console.log(`  GOOGLE_CLIENT_ID=${CLIENT_ID}`);
          console.log(`  GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
          console.log(`  GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);

          server.close();
          resolve();
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>エラー</h1><pre>${JSON.stringify(tokens, null, 2)}</pre>`);
          server.close();
          reject(new Error(JSON.stringify(tokens)));
        }
      } catch (e) {
        res.writeHead(500);
        res.end(`<h1>エラー: ${e.message}</h1>`);
        server.close();
        reject(e);
      }
    });

    server.listen(PORT, () => {
      console.log(`ローカルサーバー起動: http://localhost:${PORT}`);
      console.log('\n以下のURLをブラウザで開いてください:\n');
      console.log(authUrl);
      console.log('\n（ブラウザで認証後、自動的にRefresh Tokenが取得されます）\n');

      // Node.js 18+ では open が使えないので手動
      // Windows の場合は start コマンドで開く試み
      try {
        require('child_process').exec(`start "" "${authUrl}"`);
      } catch {}
    });

    server.on('error', reject);
  });
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
