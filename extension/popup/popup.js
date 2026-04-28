const NOTION_OAUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const FREE_SCREENSHOT_LIMIT = 20;
const NOTION_CLIENT_ID = '345d872b-594c-810c-9c3d-00376d7425b3';
const REDIRECT_URL = chrome.identity.getRedirectURL('notion');
const SUPABASE_URL = 'https://ouscjeptmkoszcjkrmtm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91c2NqZXB0bWtvc3pjamtybXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODM2ODQsImV4cCI6MjA5MTk1OTY4NH0.hYxWKYO2_H--7WAthX7azRJuier5uI3IA7km1sgwV3g';
const SUPABASE_PROXY = `${SUPABASE_URL}/functions/v1/notion-proxy`;

const DASHBOARD_URL = 'https://chrome-manual-maker.vercel.app/dashboard';

let state = {
  isRecording: false,
  steps: [],
  plan: 'free',
  monthly_screenshots: 0,
  googleToken: null,
  user: null,
};
let sessionInitDone = false;
let showUpgradeMsg = false;

// DOM refs
const notionDot = document.getElementById('notion-dot');
const notionStatus = document.getElementById('notion-status');
const connectBtn = document.getElementById('connect-btn');
const recordBtn = document.getElementById('record-btn');
const recordStatus = document.getElementById('record-status');
const stepList = document.getElementById('step-list');
const emptyHint = document.getElementById('empty-hint');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const pdfBtn = document.getElementById('pdf-btn');
const pageTitle = document.getElementById('page-title');
const msgEl = document.getElementById('msg');
const planBadge = document.getElementById('plan-badge');
const usageSection = document.getElementById('usage-section');
const usageFill = document.getElementById('usage-fill');
const usageText = document.getElementById('usage-text');
const upgradeSection = document.getElementById('upgrade-section');
const upgradeMsg     = document.getElementById('upgrade-msg');
const upgradeBtn     = document.getElementById('upgrade-btn');

// DOM refs — 記録中バナー
const recBanner    = document.getElementById('rec-banner');
const recStepCount = document.getElementById('rec-step-count');

// DOM refs — 保存先
const destRow        = document.getElementById('dest-row');
const pageDestSelect = document.getElementById('page-dest-select');
const titleRow       = document.getElementById('title-row');
const destFilter     = document.getElementById('dest-filter');
const destRefreshBtn = document.getElementById('dest-refresh-btn');

// DOM refs — Notionワークスペース
const wsSelector = document.getElementById('ws-selector');
const wsAddBtn   = document.getElementById('ws-add-btn');

// DOM refs — プライバシー
const privacyBlurToggle = document.getElementById('privacy-blur-toggle');

// DOM refs — Customer Portal
const portalLink = document.getElementById('portal-link');

// DOM refs — AI
const bulkGenBtn         = document.getElementById('bulk-gen-btn');
const aiCallsLabel       = document.getElementById('ai-calls-label');
const googleSignInSection = document.getElementById('google-sign-in-section');
const googleSignInBtn     = document.getElementById('google-sign-in-btn');

// ── Google認証 ──

function getGoogleToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(token);
    });
  });
}

const authUserCache = { data: null, token: null, ts: 0 };
const AUTH_CACHE_TTL = 60 * 1000; // 1分（ダウングレード反映を早める）

async function fetchAuthUser(token) {
  const now = Date.now();
  if (authUserCache.data && authUserCache.token === token && now - authUserCache.ts < AUTH_CACHE_TTL) {
    return authUserCache.data;
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-user`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ google_token: token }),
  });
  const data = await res.json();
  if (!data.error) { authUserCache.data = data; authUserCache.token = token; authUserCache.ts = now; }
  return data;
}

async function initUserSession() {
  try {
    let token = await getGoogleToken(false);
    let user = await fetchAuthUser(token);

    // トークン期限切れ → キャッシュ削除してサイレント再取得
    if (user?.error === 'invalid google token') {
      await new Promise(r => chrome.identity.removeCachedAuthToken({ token }, r));
      token = await getGoogleToken(false);
      user = await fetchAuthUser(token);
    }

    state.googleToken = token;
    state.user = user;
    await chrome.storage.session.set({ googleToken: token });
    if (user && !user.error) {
      const prevPlan = state.plan;
      const newPlan = user.plan ?? 'free';

      if (prevPlan !== newPlan) {
        authUserCache.ts = 0;
      }

      state.plan = newPlan;
      const localCount = state.monthly_screenshots ?? 0;
      const serverCount = user.monthly_screenshots ?? 0;
      state.monthly_screenshots = Math.max(localCount, serverCount);
      await chrome.storage.sync.set({
        plan: newPlan,
        monthly_screenshots: state.monthly_screenshots,
      });

      // ダウングレード時：ワークスペース数が上限を超えていたら自動クリーンアップ
      const maxWs = (newPlan === 'pro' || newPlan === 'team') ? 3 : 1;
      const { notion_workspaces } = await chrome.storage.local.get('notion_workspaces');
      let wsDeletedCount = 0;
      if (notion_workspaces && notion_workspaces.length > maxWs) {
        wsDeletedCount = notion_workspaces.length - maxWs;
        const trimmed = notion_workspaces.slice(0, maxWs);
        await chrome.storage.local.set({
          notion_workspaces: trimmed,
          notion_active_workspace_id: trimmed[0].id,
          notion_access_token: trimmed[0].token,
          notion_workspace_name: trimmed[0].name,
        });
        setNotionConnected(trimmed[0].name);
        loadNotionPages(trimmed[0].token);
        syncWorkspacesToServer(trimmed);
      }

      updatePlanUI();

      // プラン変更メッセージ
      if (showUpgradeMsg || (prevPlan === 'free' && newPlan !== 'free')) {
        const label = newPlan === 'pro' ? 'Pro' : 'Standard';
        showMsg(`${label}プランにアップグレードしました！`, 'success');
        showUpgradeMsg = false;
      } else if (prevPlan !== 'free' && newPlan === 'free') {
        const wsNote = wsDeletedCount > 0
          ? `追加ワークスペース${wsDeletedCount}件を削除しました。`
          : '一部機能が制限されています。';
        showMsg(`Freeプランに変更されました。${wsNote}`, 'error');
        updateAiUI(); // ダウングレード時は即時 AI UI を更新
      }

      // ローカルの Notion 情報とサーバーの整合チェック
      const { notion_workspaces: localWs } = await chrome.storage.local.get('notion_workspaces');
      const isNewUser = user.created_at &&
        (Date.now() - new Date(user.created_at).getTime() < 5 * 60 * 1000);

      if (localWs?.length && isNewUser) {
        // アカウント削除後の再登録: ゴーストデータをクリアして初期状態に戻す
        await chrome.storage.local.remove([
          'notion_workspaces', 'notion_active_workspace_id',
          'notion_access_token', 'notion_workspace_name', 'notion_workspace_id',
        ]);
        notionDot.classList.remove('connected');
        notionStatus.textContent = 'Notionに未接続';
        connectBtn.textContent = '接続';
        recordBtn.disabled = true;
        wsSelector.style.display = 'none';
        wsAddBtn.style.display = 'none';
        allNotionPages = [];
        showMsg('ようこそ！まずNotionを接続してください。', 'success');
      } else if (!localWs?.length && user.workspaces?.some(w => w.access_token)) {
        // ローカルにワークスペースがなく DB に access_token 付きレコードがある場合だけ復元
        const restored = user.workspaces
          .filter(w => w.access_token)
          .map(w => ({ id: w.workspace_id, name: w.workspace_name, token: w.access_token }));
        await chrome.storage.local.set({
          notion_workspaces: restored,
          notion_active_workspace_id: restored[0].id,
          notion_access_token: restored[0].token,
          notion_workspace_name: restored[0].name,
        });
        renderWsSelector(restored, restored[0].id);
        setNotionConnected(restored[0].name);
        loadNotionPages(restored[0].token);
      }
    }
  } catch (_) {
    state.user = null;
  }
  sessionInitDone = true;
  renderSteps();
  updateAiUI();
}

googleSignInBtn.addEventListener('click', async () => {
  googleSignInBtn.disabled = true;
  googleSignInBtn.textContent = 'サインイン中…';
  try {
    const token = await getGoogleToken(true);
    const user = await fetchAuthUser(token);
    state.googleToken = token;
    state.user = user;
    await chrome.storage.session.set({ googleToken: token });
    if (user && !user.error) {
      state.plan = user.plan ?? 'free';
      const localCount2 = state.monthly_screenshots ?? 0;
      const serverCount2 = user.monthly_screenshots ?? 0;
      state.monthly_screenshots = Math.max(localCount2, serverCount2);
      await chrome.storage.sync.set({
        plan: user.plan ?? 'free',
        monthly_screenshots: state.monthly_screenshots,
      });
      updatePlanUI();
      // 初回ログイン（新規ユーザー・再登録）にオンボーディングメッセージ
      const isNewUser2 = user.created_at &&
        (Date.now() - new Date(user.created_at).getTime() < 5 * 60 * 1000);
      const { notion_workspaces: wsCheck } = await chrome.storage.local.get('notion_workspaces');
      if (isNewUser2 && !wsCheck?.length) {
        showMsg('ようこそ！まずNotionを接続してください。', 'success');
      }
    }
    updateAiUI();
  } catch (e) {
    showMsg('Googleサインインに失敗しました: ' + e.message, 'error');
    googleSignInBtn.disabled = false;
    googleSignInBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>Googleでサインイン`;
  }
});

upgradeBtn.addEventListener('click', () => {
  authUserCache.ts = 0; // 戻ってきた時に必ず最新プランを取得
  chrome.tabs.create({ url: DASHBOARD_URL });
});

// ── AI UI更新 ──

function updateAiUI() {
  const user = state.user;

  // Googleトークンがなければ未サインイン
  if (!state.googleToken) {
    googleSignInSection.style.display = 'block';
    aiCallsLabel.style.display = 'none';
    bulkGenBtn.style.display = 'none';
    upgradeSection.style.display = 'none';
    return;
  }

  // トークンあり = サインイン済み（バックエンドエラーでもボタンは消す）
  googleSignInSection.style.display = 'none';

  // バックエンドエラーの場合はAI機能を非表示にするだけ
  if (!user || user.error) {
    aiCallsLabel.style.display = 'none';
    bulkGenBtn.style.display = 'none';
    upgradeSection.style.display = 'none';
    return;
  }

  const limit = user.ai_calls_limit ?? 0;
  if (limit === 0) {
    // Free plan — AI非表示・アップグレード訴求
    aiCallsLabel.style.display = 'none';
    bulkGenBtn.style.display = 'none';
    upgradeMsg.textContent = 'AI機能を使うにはアップグレードが必要です';
    upgradeSection.style.display = 'flex';
    return;
  }

  const used = user.ai_calls_used ?? 0;
  const remaining = limit - used;
  const hasRemaining = remaining > 0;

  aiCallsLabel.style.display = '';
  aiCallsLabel.textContent = `AI残り${remaining}/${limit}`;

  bulkGenBtn.style.display = '';
  bulkGenBtn.disabled = !hasRemaining || state.steps.length === 0;

  // 個別AI生成ボタンも残り0なら非活性化
  document.querySelectorAll('.step-gen-btn').forEach(btn => {
    btn.disabled = !hasRemaining;
  });

  // Standard: 残り20回以下でProへの案内を表示
  if (user.plan === 'standard' && remaining <= 20) {
    upgradeMsg.textContent = `AI使用回数が残り${remaining}回です — Proプランで月500回に`;
    upgradeSection.style.display = 'flex';
  } else {
    upgradeSection.style.display = 'none';
  }
}

// ── Gemini Proxy経由呼び出し（サーバーサイドAPIキー使用） ──

async function callGeminiProxy(parts) {
  const token = state.googleToken || await getGoogleToken(false);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ google_token: token, parts }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  if (state.user && data.ai_calls_used !== undefined) {
    state.user.ai_calls_used = data.ai_calls_used;
    updateAiUI();
  }
  return data.result ?? '';
}

async function init() {
  // sync→local マイグレーション（旧バージョンからのアップデート時に1回だけ実行）
  const { notion_storage_migrated } = await chrome.storage.local.get('notion_storage_migrated');
  if (!notion_storage_migrated) {
    const syncKeys = ['notion_access_token', 'notion_workspace_name', 'notion_workspaces', 'notion_active_workspace_id', 'notion_workspace_id'];
    const syncData = await chrome.storage.sync.get(syncKeys);
    const hasData = syncKeys.some(k => syncData[k] != null);
    if (hasData) {
      await chrome.storage.local.set({ ...syncData, notion_storage_migrated: true });
      await chrome.storage.sync.remove(syncKeys);
    } else {
      await chrome.storage.local.set({ notion_storage_migrated: true });
    }
  }

  // Stripe支払い後の強制リフレッシュフラグを確認
  const { pendingPlanRefresh } = await chrome.storage.session.get('pendingPlanRefresh');
  if (pendingPlanRefresh) {
    authUserCache.ts = 0; // キャッシュ無効化
    await chrome.storage.session.remove('pendingPlanRefresh');
    showUpgradeMsg = true;
  }

  const [stored, storedLocal] = await Promise.all([
    chrome.storage.sync.get(['plan', 'monthly_screenshots', 'privacy_blur']),
    chrome.storage.local.get(['notion_access_token', 'notion_workspace_name', 'notion_workspaces', 'notion_active_workspace_id']),
  ]);
  Object.assign(stored, storedLocal);

  state.plan = stored.plan ?? 'free';
  state.monthly_screenshots = stored.monthly_screenshots ?? 0;

  updatePlanUI();

  if (stored.notion_workspaces?.length) {
    const activeWs = getActiveWorkspace(stored.notion_workspaces, stored.notion_active_workspace_id);
    if (activeWs) {
      renderWsSelector(stored.notion_workspaces, activeWs.id);
      setNotionConnected(activeWs.name);
      loadNotionPages(activeWs.token);
    }
  } else if (stored.notion_access_token) {
    // 旧スキーマ（notion_workspacesなし）との後方互換
    setNotionConnected(stored.notion_workspace_name ?? 'Notion');
    loadNotionPages(stored.notion_access_token);
  }

  privacyBlurToggle.checked = stored.privacy_blur ?? true;
  notifyPrivacySetting(privacyBlurToggle.checked);

  // GET_STATE と initUserSession を並列実行（互いに依存しない）
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (resp) => {
    if (resp) {
      state.isRecording = resp.isRecording;
      state.steps = resp.steps ?? [];
      renderSteps();
      updateRecordUI();
      if (sessionInitDone) updateAiUI();
    }
  });
  initUserSession();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATE_UPDATE') {
    state.isRecording = msg.isRecording;
    state.steps = msg.steps ?? [];
    renderSteps();
    updateRecordUI();
    updateAiUI();
  } else if (msg.type === 'STEP_ADDED') {
    state.steps = msg.steps ?? [];
    renderSteps();
    updateRecordUI();
    updateAiUI();
  }
});

connectBtn.addEventListener('click', connectNotion);
recordBtn.addEventListener('click', () => {
  if (state.isRecording) stopOnly();
  else startRecording();
});
saveBtn.addEventListener('click', saveToNotion);
clearBtn.addEventListener('click', clearSteps);
pdfBtn.addEventListener('click', exportPdf);

bulkGenBtn.addEventListener('click', generateManual);

pageDestSelect.addEventListener('change', () => {
  titleRow.style.display = pageDestSelect.value ? 'none' : '';
});

let allNotionPages = [];

destFilter.addEventListener('input', () => {
  applyDestFilter(destFilter.value);
});

destRefreshBtn.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['notion_workspaces', 'notion_active_workspace_id', 'notion_access_token']);
  const ws = getActiveWorkspace(stored.notion_workspaces, stored.notion_active_workspace_id);
  const token = ws?.token ?? stored.notion_access_token;
  if (token) loadNotionPages(token, true);
});

function applyDestFilter(query) {
  const q = query.trim().toLowerCase();
  const current = pageDestSelect.value;
  while (pageDestSelect.options.length > 1) pageDestSelect.remove(1);
  const filtered = q ? allNotionPages.filter(p => p.title.toLowerCase().includes(q)) : allNotionPages;
  for (const p of filtered) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.title.slice(0, 40);
    pageDestSelect.appendChild(opt);
  }
  pageDestSelect.value = current;
  if (!pageDestSelect.value) pageDestSelect.selectedIndex = 0;
  titleRow.style.display = pageDestSelect.value ? 'none' : '';
}

const NOTION_PAGES_CACHE_TTL = 10 * 60 * 1000;

async function loadNotionPages(token, force = false) {
  // メモリキャッシュ
  if (!force && allNotionPages.length > 0) {
    applyDestFilter(destFilter.value);
    destRow.style.display = state.plan === 'free' ? 'none' : '';
    return;
  }
  // セッションストレージキャッシュ（ポップアップ再オープン時）
  if (!force) {
    const c = await chrome.storage.session.get(['notionPagesCache', 'notionPagesCacheTs', 'notionPagesCacheToken']);
    if (c.notionPagesCache?.length && c.notionPagesCacheToken === token &&
        Date.now() - (c.notionPagesCacheTs ?? 0) < NOTION_PAGES_CACHE_TTL) {
      allNotionPages = c.notionPagesCache;
      applyDestFilter(destFilter.value);
      destRow.style.display = state.plan === 'free' ? 'none' : '';
      return;
    }
  }
  pageDestSelect.disabled = true;
  destFilter.disabled = true;
  destRefreshBtn.disabled = true;
  pageDestSelect.options[0].text = '読み込み中…';
  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        filter: { value: 'page', property: 'object' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: 50,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(`${res.status} ${data?.message ?? data?.code ?? ''}`);
    }

    allNotionPages = (data.results ?? []).map(p => {
      const titleProp = Object.values(p.properties ?? {}).find(v => v.type === 'title');
      const title = titleProp?.title?.[0]?.plain_text || '（無題）';
      return { id: p.id, title };
    });
    chrome.storage.session.set({ notionPagesCache: allNotionPages, notionPagesCacheTs: Date.now(), notionPagesCacheToken: token }).catch(() => {});

    pageDestSelect.options[0].text = allNotionPages.length
      ? '＋ 新規ページとして作成'
      : '＋ 新規ページとして作成（既存ページなし）';
    applyDestFilter(destFilter.value);
  } catch (err) {
    pageDestSelect.options[0].text = '＋ 新規ページとして作成';
    if (err.message && !err.message.startsWith('Failed to fetch')) {
      showMsg(`保存先の取得に失敗: ${err.message}`, 'error');
    }
  }
  pageDestSelect.disabled = false;
  destFilter.disabled = false;
  destRefreshBtn.disabled = false;
  destRow.style.display = state.plan === 'free' ? 'none' : '';
}

privacyBlurToggle.addEventListener('change', async () => {
  const enabled = privacyBlurToggle.checked;
  await chrome.storage.sync.set({ privacy_blur: enabled });
  notifyPrivacySetting(enabled);
});

function notifyPrivacySetting(enabled) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) chrome.tabs.sendMessage(tab.id, { type: 'PRIVACY_SETTING', enabled }).catch(() => {});
  });
}

// ── Notionワークスペース管理 ──

function getActiveWorkspace(workspaces, activeId) {
  if (!workspaces?.length) return null;
  return workspaces.find(w => w.id === activeId) ?? workspaces[0];
}

function renderWsSelector(workspaces, activeId) {
  if (!workspaces || workspaces.length <= 1) {
    wsSelector.style.display = 'none';
  } else {
    wsSelector.style.display = '';
    wsSelector.innerHTML = '';
    workspaces.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = w.name.slice(0, 12);
      opt.title = w.name;
      if (w.id === activeId) opt.selected = true;
      wsSelector.appendChild(opt);
    });
  }
  const maxWs = (state.plan === 'pro' || state.plan === 'team') ? 3 : 1;
  const showAdd = (state.plan === 'pro' || state.plan === 'team') && workspaces && workspaces.length < maxWs;
  wsAddBtn.style.display = showAdd ? '' : 'none';
}

wsSelector.addEventListener('change', async () => {
  const selectedId = wsSelector.value;
  const { notion_workspaces } = await chrome.storage.local.get('notion_workspaces');
  const ws = (notion_workspaces ?? []).find(w => w.id === selectedId);
  if (!ws) return;
  await chrome.storage.local.set({
    notion_active_workspace_id: selectedId,
    notion_access_token: ws.token,
    notion_workspace_name: ws.name,
  });
  setNotionConnected(ws.name);
  allNotionPages = [];
  loadNotionPages(ws.token, true);
});

wsAddBtn.addEventListener('click', connectNotion);

function syncWorkspacesToServer(workspaces) {
  if (!state.googleToken) return;
  const wsForSync = workspaces.map(w => ({ id: w.id, name: w.name, token: w.token ?? null }));
  fetch(`${SUPABASE_URL}/functions/v1/sync-workspaces`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ google_token: state.googleToken, workspaces: wsForSync }),
  }).catch(() => {});
}

async function connectNotion() {
  const authUrl =
    `${NOTION_OAUTH_URL}?client_id=${NOTION_CLIENT_ID}` +
    `&response_type=code&owner=user&redirect_uri=${encodeURIComponent(REDIRECT_URL)}`;

  const originalText = connectBtn.textContent;
  connectBtn.disabled = true;
  connectBtn.textContent = '接続中…';

  try {
    const redirected = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
    const url = new URL(redirected);
    const code = url.searchParams.get('code');
    if (!code) throw new Error('code not found');

    const res = await fetch(SUPABASE_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URL }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.access_token) throw new Error('access_token missing. response: ' + JSON.stringify(data));

    const workspaceName = data.workspace_name || data.owner?.workspace?.name || 'Notion';
    const workspaceId = data.workspace_id || crypto.randomUUID();

    // ワークスペース上限チェック
    const { notion_workspaces: existing = [] } = await chrome.storage.local.get('notion_workspaces');
    const maxWs = (state.plan === 'pro' || state.plan === 'team') ? 3 : 1;

    // 同一IDはupsert（トークン更新）、それ以外は上限チェックして追加
    const idx = existing.findIndex(w => w.id === workspaceId);
    let workspaces;
    if (idx >= 0) {
      workspaces = existing.map((w, i) =>
        i === idx ? { id: workspaceId, name: workspaceName, token: data.access_token } : w
      );
    } else if (existing.length >= maxWs) {
      showMsg(`このプランでは最大${maxWs}ワークスペースまで接続できます`, 'error');
      return;
    } else {
      workspaces = [...existing, { id: workspaceId, name: workspaceName, token: data.access_token }];
    }

    await chrome.storage.local.set({
      notion_workspaces: workspaces,
      notion_active_workspace_id: workspaceId,
      notion_access_token: data.access_token,
      notion_workspace_name: workspaceName,
      notion_workspace_id: workspaceId,
    });

    renderWsSelector(workspaces, workspaceId);
    setNotionConnected(workspaceName);
    loadNotionPages(data.access_token);
    syncWorkspacesToServer(workspaces);
  } catch (e) {
    showMsg('Notion接続に失敗しました: ' + e.message, 'error');
    connectBtn.textContent = originalText;
  } finally {
    connectBtn.disabled = false;
  }
}

function setNotionConnected(workspaceName) {
  notionDot.classList.add('connected');
  notionStatus.textContent = workspaceName + ' に接続済み';
  connectBtn.textContent = '再接続';
  recordBtn.disabled = false;
}

async function startRecording() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId: tab.id });
  window.close();
}

function updateRecordUI() {
  const count = state.steps.length;
  recordStatus.textContent = `${count} ステップ記録済み`;
  saveBtn.disabled = count === 0;
  clearBtn.disabled = count === 0;
  pdfBtn.disabled = count === 0;
  if (state.isRecording) {
    recBanner.style.display = 'flex';
    recStepCount.textContent = `${count} ステップ`;
    recordBtn.textContent = '■ 停止';
    recordBtn.classList.add('btn-record-stop');
  } else {
    recBanner.style.display = 'none';
    recordBtn.textContent = '記録開始';
    recordBtn.classList.remove('btn-record-stop');
  }
}

// ── プレビュー（別ウィンドウ） ──
function openPreview(src) {
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${src}" style="max-width:100%;max-height:100vh;object-fit:contain"></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  chrome.windows.create({ url, type: 'popup', width: 1100, height: 750 });
}

// ── ドラッグ&ドロップ ──
let dragSrcIndex = null;

function renderStepsInto(container) {
  container.innerHTML = '';
  state.steps.forEach((step, i) => {
    const row = document.createElement('div');
    row.className = 'step-item';
    row.draggable = true;
    row.dataset.index = i;

    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.title = 'ドラッグして並び替え';

    const num = document.createElement('div');
    num.className = 'step-num';
    num.textContent = step.stepNumber;
    if (step.hasPiiBlur) {
      num.title = '個人情報を自動ぼかし済み';
      num.style.position = 'relative';
      const badge = document.createElement('span');
      badge.textContent = '🔒';
      badge.style.cssText = 'position:absolute;top:-6px;right:-6px;font-size:9px;line-height:1;';
      num.appendChild(badge);
    }

    const thumb = document.createElement('img');
    thumb.className = 'step-thumb';
    thumb.src = step.annotatedDataUrl;
    thumb.alt = `step ${step.stepNumber}`;
    thumb.title = 'クリックで拡大';
    thumb.addEventListener('click', () => openPreview(step.annotatedDataUrl));

    const topRow = document.createElement('div');
    topRow.className = 'step-item-top';

    const delBtn = document.createElement('button');
    delBtn.className = 'step-delete';
    delBtn.textContent = '×';
    delBtn.title = '削除';
    delBtn.addEventListener('click', () => deleteStep(i));

    const fields = document.createElement('div');
    fields.className = 'step-fields';

    const isPaidPlan = state.user && (state.user.plan === 'standard' || state.user.plan === 'pro' || state.user.plan === 'team');

    if (isPaidPlan) {
      // 説明欄 + 個別生成ボタン
      const descRow = document.createElement('div');
      descRow.className = 'step-field-row';
      const descLbl = document.createElement('span');
      descLbl.className = 'step-field-label';
      descLbl.textContent = '説明';
      const input = document.createElement('input');
      input.className = 'step-label-input';
      input.type = 'text';
      input.placeholder = 'AI生成または手入力…';
      input.value = step.label || '';
      input.addEventListener('input', (e) => { step.label = e.target.value; syncSteps(); });
      const genBtn = document.createElement('button');
      genBtn.className = 'step-gen-btn';
      genBtn.textContent = 'AI生成';
      genBtn.title = 'この説明をAI生成';
      genBtn.addEventListener('click', () => generateStepDescription(step, genBtn, input));
      descRow.appendChild(descLbl);
      descRow.appendChild(input);
      descRow.appendChild(genBtn);
      fields.appendChild(descRow);

      // メモ欄
      const memoRow = document.createElement('div');
      memoRow.className = 'step-field-row';
      const memoLbl = document.createElement('span');
      memoLbl.className = 'step-field-label';
      memoLbl.textContent = 'メモ';
      const memoInput = document.createElement('input');
      memoInput.className = 'step-memo-input';
      memoInput.type = 'text';
      memoInput.placeholder = '補足メモ（任意）…';
      memoInput.value = step.memo || '';
      memoInput.addEventListener('input', (e) => { step.memo = e.target.value; syncSteps(); });
      memoRow.appendChild(memoLbl);
      memoRow.appendChild(memoInput);
      fields.appendChild(memoRow);
    } else {
      // Free: タイトル + メモ欄
      const titleRow = document.createElement('div');
      titleRow.className = 'step-field-row';
      const titleLbl = document.createElement('span');
      titleLbl.className = 'step-field-label';
      titleLbl.textContent = 'タイトル';
      const input = document.createElement('input');
      input.className = 'step-label-input';
      input.type = 'text';
      input.placeholder = 'タイトルを入力…';
      input.value = step.label || '';
      input.addEventListener('input', (e) => { step.label = e.target.value; syncSteps(); });
      titleRow.appendChild(titleLbl);
      titleRow.appendChild(input);
      fields.appendChild(titleRow);

      const memoRow = document.createElement('div');
      memoRow.className = 'step-field-row';
      const memoLbl = document.createElement('span');
      memoLbl.className = 'step-field-label';
      memoLbl.textContent = 'メモ';
      const memoInput = document.createElement('input');
      memoInput.className = 'step-memo-input';
      memoInput.type = 'text';
      memoInput.placeholder = '補足メモ（任意）…';
      memoInput.value = step.memo || '';
      memoInput.addEventListener('input', (e) => { step.memo = e.target.value; syncSteps(); });
      memoRow.appendChild(memoLbl);
      memoRow.appendChild(memoInput);
      fields.appendChild(memoRow);
    }

    row.addEventListener('dragstart', (e) => {
      dragSrcIndex = i;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('dragging'), 0);
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      container.querySelectorAll('.step-item').forEach(r => r.classList.remove('drag-over'));
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      container.querySelectorAll('.step-item').forEach(r => r.classList.remove('drag-over'));
      if (dragSrcIndex !== i) row.classList.add('drag-over');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrcIndex === null || dragSrcIndex === i) return;
      const moved = state.steps.splice(dragSrcIndex, 1)[0];
      state.steps.splice(i, 0, moved);
      state.steps.forEach((s, idx) => s.stepNumber = idx + 1);
      dragSrcIndex = null;
      syncSteps();
      renderSteps();
      updateRecordUI();
    });

    topRow.appendChild(handle);
    topRow.appendChild(num);
    topRow.appendChild(thumb);
    topRow.appendChild(delBtn);
    row.appendChild(topRow);
    row.appendChild(fields);
    container.appendChild(row);
  });
}

function renderSteps() {
  if (state.steps.length === 0) {
    stepList.innerHTML = '';
    stepList.appendChild(emptyHint);
    emptyHint.style.display = '';
    return;
  }
  emptyHint.style.display = 'none';
  renderStepsInto(stepList);
}

function deleteStep(index) {
  state.steps.splice(index, 1);
  state.steps.forEach((s, i) => s.stepNumber = i + 1);
  syncSteps();
  renderSteps();
  updateRecordUI();
}

function syncSteps() {
  chrome.runtime.sendMessage({ type: 'UPDATE_STEPS', steps: state.steps });
}

// ── AI生成（Gemini Proxy経由） ──

function cropStep(step) {
  return new Promise((resolve, reject) => {
    const srcUrl = step.rawDataUrl || step.annotatedDataUrl;
    if (!srcUrl) { reject(new Error('画像データなし')); return; }
    const img = new Image();
    img.onerror = () => reject(new Error('画像の読み込み失敗'));
    img.onload = () => {
      if (step.viewportWidth && step.viewportHeight) {
        const px = step.x * (img.naturalWidth  / step.viewportWidth);
        const py = step.y * (img.naturalHeight / step.viewportHeight);
        resolve(doCrop(img, px, py));
      } else {
        const aImg = new Image();
        aImg.onerror = () => resolve(doCrop(img, img.naturalWidth / 2, img.naturalHeight / 2));
        aImg.onload = () => {
          const ac = document.createElement('canvas');
          ac.width = aImg.naturalWidth; ac.height = aImg.naturalHeight;
          const actx = ac.getContext('2d');
          actx.drawImage(aImg, 0, 0);
          const d = actx.getImageData(0, 0, ac.width, ac.height).data;
          let sumX = 0, sumY = 0, count = 0;
          for (let y = 0; y < ac.height; y += 2) {
            for (let x = 0; x < ac.width; x += 2) {
              const i = (y * ac.width + x) * 4;
              if (d[i] > 220 && d[i+1] < 80 && d[i+2] < 80) {
                sumX += x; sumY += y; count++;
              }
            }
          }
          const px = count > 5 ? sumX / count : img.naturalWidth  / 2;
          const py = count > 5 ? sumY / count : img.naturalHeight / 2;
          resolve(doCrop(img, px, py));
        };
        aImg.src = step.annotatedDataUrl;
      }
    };
    img.src = srcUrl;
  });
}

function doCrop(img, px, py) {
  const CW = 360, CH = 240;
  const ox = Math.max(0, Math.round(px - CW / 2));
  const oy = Math.max(0, Math.round(py - CH / 2));
  const ow = Math.min(CW, img.naturalWidth  - ox);
  const oh = Math.min(CH, img.naturalHeight - oy);
  const out = document.createElement('canvas');
  out.width = ow; out.height = oh;
  out.getContext('2d').drawImage(img, ox, oy, ow, oh, 0, 0, ow, oh);
  return out.toDataURL('image/jpeg', 0.72);
}


const STEP_PROMPT = 'This screenshot shows one step in a web operation. Write ONE short sentence in Japanese describing the action shown. Use the dictionary form ending (e.g. 「〜をクリック。」「〜に入力。」「〜を選択。」) — not 丁寧語 (not 〜します/〜しています). Include button/link/field names if visible. If a form note is provided, mention it briefly only when essential. Return ONLY the sentence.';

function buildStepContext(step) {
  const parts = [];
  if (step.isPassword) parts.push('Input type: password field');
  else if (step.inputText) parts.push(`Input value: "${step.inputText}"`);
  if (step.elementHint) parts.push(`Element: "${step.elementHint}"`);
  if (step.formNote) parts.push(`Form note: "${step.formNote}"`);
  return parts.length ? ' Additional context: ' + parts.join(', ') + '.' : '';
}

async function generateStepDescription(step, btn, input) {
  btn.disabled = true;
  btn.textContent = '生成中…';
  try {
    const cropped = await cropStep(step);
    const parts = [
      { text: STEP_PROMPT + buildStepContext(step) },
      { inline_data: { mime_type: 'image/jpeg', data: cropped.split(',')[1] } },
    ];
    const text = await callGeminiProxy(parts);
    step.label = text.trim();
    if (input) input.value = step.label;
    syncSteps();
    updateAiUI();
  } catch (e) {
    showMsg('生成失敗: ' + e.message, 'error');
  }
  btn.disabled = false;
  btn.textContent = 'AI生成';
}

async function generateManual() {
  if (!state.user || state.steps.length === 0) return;

  bulkGenBtn.disabled = true;
  bulkGenBtn.classList.add('loading');
  bulkGenBtn.textContent = '画像を準備中…';
  showMsg('', '');

  const total = state.steps.length;
  const remaining = (state.user.ai_calls_limit ?? 0) - (state.user.ai_calls_used ?? 0);
  const sendCount = Math.min(total, remaining);

  if (sendCount <= 0) {
    showMsg('月間AI使用回数の上限に達しました', 'error');
    bulkGenBtn.disabled = false;
    bulkGenBtn.classList.remove('loading');
    bulkGenBtn.textContent = '一括AI生成';
    return;
  }

  const stepsToSend = state.steps.slice(0, sendCount);

  try {
    // 対象画像を並列でクロップ（ローカル処理なので高速）
    const cropped = await Promise.all(stepsToSend.map(s => cropStep(s)));
    const images = cropped.map(c => c.split(',')[1]);
    const hints = stepsToSend.map(s => {
      const ctx = [];
      if (s.label) ctx.push(`label:"${s.label}"`);
      if (s.isPassword) ctx.push('type:password');
      else if (s.inputText) ctx.push(`input:"${s.inputText}"`);
      if (s.elementHint) ctx.push(`element:"${s.elementHint}"`);
      return ctx.join(' ');
    });

    bulkGenBtn.textContent = sendCount < total
      ? `${sendCount}/${total}件 生成中…（残り${remaining}回）`
      : `${total}件 生成中…`;

    const token = state.googleToken || await getGoogleToken(false);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_token: token, images, hints, pageTitle: pageTitle.value || '' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

    const results = data.results ?? [];
    let generated = 0;
    results.forEach((text, i) => {
      if (stepsToSend[i] && text) {
        stepsToSend[i].label = String(text).trim();
        generated++;
      }
    });

    if (state.user && data.ai_calls_used !== undefined) {
      state.user.ai_calls_used = data.ai_calls_used;
      updateAiUI();
    }

    syncSteps();
    renderSteps();
    const msg = sendCount < total
      ? `${generated}件生成（残り${total - sendCount}件は上限超過のためスキップ）`
      : `${generated}/${total}件の説明を生成しました`;
    showMsg(msg, 'success');
  } catch (e) {
    showMsg('生成失敗: ' + e.message, 'error');
  }

  bulkGenBtn.disabled = false;
  bulkGenBtn.classList.remove('loading');
  bulkGenBtn.textContent = '一括AI生成';
}

function exportPdf() {
  const title = pageTitle.value || `マニュアル ${new Date().toLocaleDateString('ja-JP')}`;
  chrome.storage.local.set({ pdf_export: { title, steps: state.steps } }, () => {
    chrome.windows.create({
      url: chrome.runtime.getURL('pdf/index.html'),
      type: 'popup', width: 960, height: 760,
    });
  });
}

async function saveToNotion() {
  showMsg('', '');
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中…';

  chrome.runtime.sendMessage(
    { type: 'SAVE_TO_NOTION', notionPageId: pageDestSelect.value || null, title: pageTitle.value, steps: state.steps },
    async (resp) => {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Notionへ保存';
      if (resp?.error) {
        showMsg(resp.error, 'error');
      } else if (resp?.success) {
        showMsg('Notionに保存しました！', 'success');
        state.steps = [];
        state.isRecording = false;
        pageTitle.value = '';
        stopAndStopContent();
        renderSteps();
        updateRecordUI();
        // 保存後にローカルのカウントを再読み込みして使用量バーを更新
        const { monthly_screenshots: saved } = await chrome.storage.sync.get('monthly_screenshots');
        state.monthly_screenshots = saved ?? state.monthly_screenshots;
        updatePlanUI();
      }
    }
  );
}

async function stopOnly() {
  state.isRecording = false;
  stopAndStopContent();
  chrome.runtime.sendMessage({ type: 'RECORDING_STOPPED' });
  updateRecordUI();
}

async function stopAndStopContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' }).catch(() => {});
}

function clearSteps() {
  chrome.runtime.sendMessage({ type: 'CLEAR_STEPS' });
}

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = type || '';
  msgEl.style.display = text ? 'block' : 'none';
}

function updatePlanUI() {
  const plan = state.plan;
  portalLink.style.display = 'inline';
  if (plan === 'pro') {
    planBadge.textContent = 'Pro';
    planBadge.classList.add('pro');
    usageSection.style.display = 'none';
  } else if (plan === 'standard') {
    planBadge.textContent = 'Standard';
    planBadge.classList.add('pro');
    usageSection.style.display = 'none';
  } else {
    planBadge.textContent = 'Free';
    planBadge.classList.remove('pro');
    const used = state.monthly_screenshots;
    const limit = FREE_SCREENSHOT_LIMIT;
    const pct = Math.min((used / limit) * 100, 100);
    usageSection.style.display = 'block';
    usageFill.style.width = pct + '%';
    usageText.textContent = `${used} / ${limit} スクショ / 月`;
  }
  // PDFはStandard以上
  if (pdfBtn) pdfBtn.style.display = (plan === 'standard' || plan === 'pro') ? '' : 'none';
  // Freeプランは新規ページのみ（保存先選択なし）
  if (destRow) destRow.style.display = plan === 'free' ? 'none' : '';
  // ワークスペースセレクターの表示更新
  chrome.storage.local.get(['notion_workspaces', 'notion_active_workspace_id'], (stored) => {
    renderWsSelector(stored.notion_workspaces ?? [], stored.notion_active_workspace_id);
  });
}

init();
