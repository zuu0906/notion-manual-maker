/**
 * Notion OAuth2 for desktop app.
 *
 * Setup required:
 *  In the Notion integration settings, add the following redirect URI:
 *    http://localhost:3721/callback
 */
const http = require('http');
const { BrowserWindow } = require('electron');
const { CONFIG } = require('../shared/config');

const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const SUPABASE_PROXY = `${CONFIG.SUPABASE_URL}/functions/v1/notion-proxy`;
const REDIRECT_URI = CONFIG.NOTION_REDIRECT_URI; // http://localhost:3721/callback

/**
 * Start the local callback server on a fixed port (3721) for Notion OAuth.
 * Returns { codePromise, cancel } — cancel() resolves the promise with an error
 * and closes the server (window closed / timeout でのハング防止).
 */
function startCallbackServer() {
  const server = http.createServer();
  let resolved = false;
  let resolveCode, rejectCode;
  const codePromise = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  const settle = (result) => {
    if (resolved) return;
    resolved = true;
    resolveCode(result);
    server.close();
  };

  server.on('request', (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (code) {
        res.end('<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>✅ Notion接続完了</h2><p>このウィンドウを閉じてください。</p></body></html>');
      } else {
        res.end('<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>❌ 接続エラー</h2><p>' + (error || 'unknown') + '</p></body></html>');
      }
      settle({ code, error });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.on('error', (err) => {
    if (!resolved) {
      resolved = true;
      rejectCode(new Error(`ポート3721が使用中です: ${err.message}`));
    }
  });

  server.listen(3721, 'localhost');

  return { codePromise, cancel: (error) => settle({ code: null, error: error || 'cancelled' }) };
}

/**
 * Open Notion OAuth flow in a BrowserWindow.
 * Returns { access_token, workspace_id, workspace_name } on success.
 */
async function connectNotion() {
  const { codePromise, cancel } = startCallbackServer();

  const authUrl = new URL(NOTION_AUTH_URL);
  authUrl.searchParams.set('client_id', CONFIG.NOTION_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('owner', 'user');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);

  const authWin = new BrowserWindow({
    width: 520,
    height: 700,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  authWin.loadURL(authUrl.toString());

  // ウィンドウを手動で閉じた場合・5分経過した場合はキャンセル扱い（ハング防止）
  authWin.on('closed', () => cancel('cancelled'));
  const timeoutId = setTimeout(() => cancel('timeout'), 5 * 60_000);

  let code, error;
  try {
    ({ code, error } = await codePromise);
  } finally {
    clearTimeout(timeoutId);
    if (!authWin.isDestroyed()) authWin.close();
  }

  if (!code) throw new Error(error || 'cancelled');

  // Exchange code via Supabase proxy (same as extension)
  const res = await fetch(SUPABASE_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (!data.access_token) throw new Error('access_token missing');

  return {
    access_token: data.access_token,
    workspace_id: data.workspace_id || crypto.randomUUID(),
    workspace_name: data.workspace_name || data.owner?.workspace?.name || 'Notion',
  };
}

module.exports = { connectNotion };
