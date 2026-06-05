/**
 * Google OAuth2 for desktop app.
 *
 * Setup required:
 *  1. Google Cloud Console → OAuth 2.0 Credentials → "Desktop app" type
 *  2. Set env vars GOOGLE_DESKTOP_CLIENT_ID and GOOGLE_DESKTOP_CLIENT_SECRET
 *     (or put them in desktop/.env.local — never commit)
 *
 * The returned access_token is passed to Supabase auth-user, same as the
 * Chrome extension's chrome.identity.getAuthToken() token.
 */
const http = require('http');
const { BrowserWindow, shell } = require('electron');
const store = require('./store');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'openid email profile';

function getClientCredentials() {
  const id = process.env.GOOGLE_DESKTOP_CLIENT_ID || store.get('google_client_id');
  const secret = process.env.GOOGLE_DESKTOP_CLIENT_SECRET || store.get('google_client_secret');
  if (!id || !secret) {
    throw new Error(
      'Google OAuth2 client credentials not set.\n' +
      'Set GOOGLE_DESKTOP_CLIENT_ID and GOOGLE_DESKTOP_CLIENT_SECRET env vars.'
    );
  }
  return { id, secret };
}

/**
 * Start a temporary loopback HTTP server, return { port, waitForCode() }.
 * The server listens for GET /callback?code=... and resolves with the code.
 */
function startCallbackServer() {
  return new Promise((resolve) => {
    const server = http.createServer();
    let resolveCode;
    const codePromise = new Promise((res) => { resolveCode = res; });

    server.on('request', (req, res) => {
      const url = new URL(req.url, `http://localhost`);
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (code) {
          res.end('<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>✅ 認証完了</h2><p>このウィンドウを閉じてください。</p></body></html>');
          resolveCode({ code, error: null });
        } else {
          res.end('<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>❌ 認証エラー</h2><p>' + (error || 'unknown') + '</p></body></html>');
          resolveCode({ code: null, error: error || 'cancelled' });
        }
        server.close();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ port, waitForCode: () => codePromise });
    });
  });
}

async function exchangeCodeForTokens({ code, redirectUri, clientId, clientSecret }) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data; // { access_token, refresh_token, expires_in, token_type }
}

async function refreshAccessToken() {
  const refreshToken = store.get('google_refresh_token');
  if (!refreshToken) throw new Error('no_refresh_token');
  const { id: clientId, secret: clientSecret } = getClientCredentials();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  // access_token renewed; refresh_token usually unchanged
  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  store.setMulti({ google_access_token: data.access_token, google_token_expires_at: expiresAt });
  return data.access_token;
}

/**
 * Get a valid Google access token. Refreshes silently if expired.
 * Returns null if not signed in.
 */
async function getToken() {
  const accessToken = store.get('google_access_token');
  if (!accessToken) return null;
  const expiresAt = store.get('google_token_expires_at', 0);
  // Refresh 5 minutes before expiry
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    try {
      return await refreshAccessToken();
    } catch {
      return null;
    }
  }
  return accessToken;
}

/**
 * Initiate interactive Google OAuth2 flow via BrowserWindow.
 * Returns the access token on success.
 */
async function signInWithGoogle() {
  const { id: clientId, secret: clientSecret } = getClientCredentials();
  const { port, waitForCode } = await startCallbackServer();
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  // Open auth page in a BrowserWindow (or default browser)
  const authWin = new BrowserWindow({
    width: 500,
    height: 650,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  authWin.loadURL(authUrl.toString());

  const { code, error } = await waitForCode();
  authWin.close();

  if (!code) throw new Error(error || 'cancelled');

  const tokens = await exchangeCodeForTokens({ code, redirectUri, clientId, clientSecret });
  const expiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000;
  store.setMulti({
    google_access_token: tokens.access_token,
    google_refresh_token: tokens.refresh_token || store.get('google_refresh_token'),
    google_token_expires_at: expiresAt,
  });
  return tokens.access_token;
}

function signOut() {
  store.delete('google_access_token');
  store.delete('google_refresh_token');
  store.delete('google_token_expires_at');
  store.delete('google_access_token_cached');
  store.delete('last_user_id');
}

module.exports = { signInWithGoogle, getToken, signOut };
