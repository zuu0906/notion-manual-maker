// Desktop renderer — all chrome.* calls replaced with window.electronAPI.*
const api = window.electronAPI;

// ── i18n ────────────────────────────────────────────────────────────────────
let _msgs = {};

function t(key, ...subs) {
  const entry = _msgs[key];
  if (!entry) return key;
  let msg = entry.message;
  if (entry.placeholders) {
    Object.entries(entry.placeholders).forEach(([name, ph]) => {
      const idx = parseInt(ph.content.replace('$', '')) - 1;
      if (idx >= 0 && subs[idx] !== undefined) {
        msg = msg.replace(new RegExp(`\\$${name}\\$`, 'gi'), subs[idx]);
      }
    });
  }
  return msg;
}

async function applyI18n(localeOverride) {
  const lang = localeOverride ?? (navigator.language.startsWith('ja') ? 'ja' : 'en');
  _msgs = await api.loadI18n(lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = t(el.dataset.i18n);
    if (msg !== el.dataset.i18n) el.textContent = msg;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const msg = t(el.dataset.i18nPlaceholder);
    if (msg !== el.dataset.i18nPlaceholder) el.placeholder = msg;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const msg = t(el.dataset.i18nTitle);
    if (msg !== el.dataset.i18nTitle) el.title = msg;
  });
  // ロケール変更時（2回目以降）は動的テキストも再描画
  if (localeOverride) {
    updateStepsUI();
    updateAiUI();
    if (state.steps.length > 0) renderSteps();
  }
}

const SUPABASE_URL = 'https://ouscjeptmkoszcjkrmtm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91c2NqZXB0bWtvc3pjamtybXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODM2ODQsImV4cCI6MjA5MTk1OTY4NH0.hYxWKYO2_H--7WAthX7azRJuier5uI3IA7km1sgwV3g';
const DASHBOARD_URL = 'https://notion-manual-maker.vercel.app/dashboard';
const FREE_SCREENSHOT_LIMIT = 20;

let state = {
  steps: [],
  plan: 'free',
  monthly_screenshots: 0,
  googleToken: null,
  user: null,
};

// ── DOM refs ────────────────────────────────────────────────────────────────
const notionDot        = document.getElementById('notion-dot');
const notionStatus     = document.getElementById('notion-status');
const connectBtn       = document.getElementById('connect-btn');
const captureBtn       = document.getElementById('capture-btn');
const recordStatus     = document.getElementById('record-status');
const stepList         = document.getElementById('step-list');
const emptyHint        = document.getElementById('empty-hint');
const saveBtn          = document.getElementById('save-btn');
const clearBtn         = document.getElementById('clear-btn');
const pageTitle        = document.getElementById('page-title');
const msgEl            = document.getElementById('msg');
const planBadge        = document.getElementById('plan-badge');
const usageSection     = document.getElementById('usage-section');
const usageFill        = document.getElementById('usage-fill');
const usageText        = document.getElementById('usage-text');
const destRow          = document.getElementById('dest-row');
const pageDestSelect   = document.getElementById('page-dest-select');
const titleRow         = document.getElementById('title-row');
const destFilter       = document.getElementById('dest-filter');
const destRefreshBtn   = document.getElementById('dest-refresh-btn');
const bulkGenBtn       = document.getElementById('bulk-gen-btn');
const pdfBtn           = document.getElementById('pdf-btn');
const aiCallsLabel     = document.getElementById('ai-calls-label');
const googleSignInSection = document.getElementById('google-sign-in-section');
const googleSignInBtn  = document.getElementById('google-sign-in-btn');
const googleSignInText = document.getElementById('google-sign-in-text');
const wsSelector       = document.getElementById('ws-selector');
const wsAddBtn         = document.getElementById('ws-add-btn');
const upgradeSectionEl = document.getElementById('upgrade-section');
const upgradeMsgEl     = document.getElementById('upgrade-msg');
const upgradeBtn       = document.getElementById('upgrade-btn');
const portalLink       = document.getElementById('portal-link');

// ── Auth — Google ───────────────────────────────────────────────────────────

const authUserCache = { data: null, token: null, ts: 0 };
const AUTH_CACHE_TTL = 60_000;

async function fetchAuthUser(token, isRetry = false) {
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
  console.log('[auth-user response] plan:', data.plan, 'monthly_screenshots:', data.monthly_screenshots, 'error:', data.error);
  if (!data.error) {
    authUserCache.data = data; authUserCache.token = token; authUserCache.ts = now;
  } else if (!isRetry) {
    // トークンエラーの可能性 → mainプロセスで再取得を試みる
    const freshToken = await api.getGoogleToken().catch(() => null);
    if (freshToken && freshToken !== token) {
      state.googleToken = freshToken;
      api.storeSet('google_access_token_cached', freshToken);
      return fetchAuthUser(freshToken, true);
    } else if (!freshToken) {
      state.googleToken = null;
      state.user = null;
      updateAiUI();
      showMsg(t('sessionExpired'), 'error');
    }
  }
  return data;
}

async function initUserSession() {
  try {
    const token = await api.getGoogleToken();
    if (!token) {
      state.googleToken = null;
      state.user = null;
      return;
    }
    let user = await fetchAuthUser(token);

    state.googleToken = token;
    state.user = user;
    api.storeSet('google_access_token_cached', token);

    if (user && !user.error) {
      const prevPlan = state.plan; // ローカルストアから読み込み済みの前回プラン
      const newPlan = user.plan ?? 'free';
      console.log('[plan] prev:', prevPlan, '→ new:', newPlan, '(from Supabase)');

      // ① アカウント切り替え検出 → ゴーストデータ削除
      const lastUserId = await api.storeGet('last_user_id', null);
      if (lastUserId && lastUserId !== user.userId) {
        api.storeDeleteMulti([
          'notion_workspaces', 'notion_active_workspace_id',
          'notion_access_token', 'notion_workspace_name',
        ]);
        notionDot.classList.remove('connected');
        notionStatus.textContent = t('notionDisconnected');
        connectBtn.textContent = t('connect');
        wsSelector.style.display = 'none';
        wsAddBtn.style.display = 'none';
        allNotionPages = [];
        pagesCacheTs = 0;
        showMsg(t('accountSwitched'), 'success');
      }
      await api.storeSet('last_user_id', user.userId);

      // ② ダウングレード処理: ワークスペースを上限に切り詰め
      const maxWsAllowed = (newPlan === 'pro' || newPlan === 'team') ? 3 : 1;
      const storedWs = await api.storeGet('notion_workspaces', []);
      let wsDeletedCount = 0;
      if (storedWs.length > maxWsAllowed) {
        wsDeletedCount = storedWs.length - maxWsAllowed;
        const trimmed = storedWs.slice(0, maxWsAllowed);
        api.storeSetMulti({
          notion_workspaces: trimmed,
          notion_active_workspace_id: trimmed[0].id,
          notion_access_token: trimmed[0].token,
          notion_workspace_name: trimmed[0].name,
        });
        setNotionConnected(trimmed[0].name);
        updateWsSelector(trimmed, trimmed[0].id);
        loadNotionPages(trimmed[0].token);
        syncWorkspacesToServer(trimmed);
      }

      // ③ プラン変更通知
      if (prevPlan === 'free' && newPlan !== 'free') {
        const label = newPlan === 'pro' ? 'Pro' : newPlan === 'team' ? 'Team' : 'Standard';
        showMsg(t('planUpgraded', label), 'success');
      } else if (prevPlan !== 'free' && newPlan === 'free') {
        const wsNote = wsDeletedCount > 0 ? t('wsDeleted', String(wsDeletedCount)) : t('planRestricted');
        showMsg(t('planDowngraded', wsNote), 'error');
      }

      state.plan = newPlan;

      // ユーザーの言語設定を適用（システム言語と異なる場合は再適用）
      if (user.locale) await applyI18n(user.locale);

      // screenshot_reset_at を比較してサーバー側のリセットを検出
      const prevResetAt = await api.storeGet('screenshot_reset_at', null);
      const serverResetAt = user.screenshot_reset_at ?? null;
      const serverResetNewer = serverResetAt && (!prevResetAt || serverResetAt > prevResetAt);

      const serverCount = user.monthly_screenshots ?? 0;
      // サーバーを Source of Truth として常に採用（Supabase直接変更にも対応）
      state.monthly_screenshots = serverCount;
      console.log('[screenshots] server count:', serverCount);
      api.storeSetMulti({
        plan: state.plan,
        monthly_screenshots: state.monthly_screenshots,
        screenshot_reset_at: serverResetAt ?? prevResetAt,
      });
      updatePlanUI();

      // プラン更新後にWSセレクター表示を再計算（stale値による誤表示を防ぐ）
      const latestWs = await api.storeGet('notion_workspaces', []);
      const latestActiveId = await api.storeGet('notion_active_workspace_id', null);
      updateWsSelector(latestWs, latestActiveId);

      // ④ サーバーのWS一覧とローカルを常に照合し、差異があれば更新（他デバイス・ダッシュボードでの変更を反映）
      const freshWs = await api.storeGet('notion_workspaces', []);
      const serverWs = (user.workspaces ?? [])
        .filter(w => w.access_token)
        .map(w => ({ id: w.workspace_id, name: w.workspace_name, token: w.access_token }));
      const localIds  = new Set(freshWs.map(w => w.id));
      const serverIds = new Set(serverWs.map(w => w.id));
      const wsDiffers = localIds.size !== serverIds.size ||
        [...serverIds].some(id => !localIds.has(id)) ||
        [...localIds].some(id => !serverIds.has(id));

      if (wsDiffers) {
        if (serverWs.length === 0) {
          const lastConnectAt = await api.storeGet('notion_last_connect_at', 0);
          if (Date.now() - lastConnectAt < 120_000) {
            // 接続直後(2分以内)はサーバー未反映の可能性 → ローカルをサーバーに再push
            syncWorkspacesToServer(freshWs);
          } else {
          // サーバーで全切断 → ローカルもクリア
          api.storeDeleteMulti([
            'notion_workspaces', 'notion_active_workspace_id',
            'notion_access_token', 'notion_workspace_name',
          ]);
          notionDot.classList.remove('connected');
          notionStatus.textContent = t('notionDisconnected');
          connectBtn.textContent = t('connect');
          wsSelector.style.display = 'none';
          wsAddBtn.style.display = 'none';
          allNotionPages = [];
          pagesCacheTs = 0;
          }
        } else {
          // アクティブWSがサーバーにない場合は先頭に切り替え
          const curActiveId = await api.storeGet('notion_active_workspace_id', null);
          const newActive = serverWs.find(w => w.id === curActiveId) ?? serverWs[0];
          api.storeSetMulti({
            notion_workspaces: serverWs,
            notion_active_workspace_id: newActive.id,
            notion_access_token: newActive.token,
            notion_workspace_name: newActive.name,
          });
          setNotionConnected(newActive.name);
          updateWsSelector(serverWs, newActive.id);
          if (!localIds.has(newActive.id)) loadNotionPages(newActive.token);
        }
      }
    }
  } catch (e) {
    console.warn('[initUserSession]', e.message);
    state.user = null;
    state.googleToken = null;
  }
  updateAiUI();
}

upgradeBtn.addEventListener('click', () => {
  authUserCache.ts = 0;
  api.openExternal(DASHBOARD_URL);
});

// 更新ボタン
document.getElementById('refresh-btn').addEventListener('click', async () => {
  authUserCache.ts = 0;
  if (state.googleToken) {
    const btn = document.getElementById('refresh-btn');
    btn.style.opacity = '0.4';
    btn.style.pointerEvents = 'none';
    await initUserSession();
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  }
});

// ログアウトボタン
document.getElementById('logout-btn').addEventListener('click', async () => {
  await api.googleSignOut();
  state.googleToken = null;
  state.user = null;
  authUserCache.data = null;
  authUserCache.ts = 0;
  document.getElementById('logout-btn').style.display = 'none';
  googleSignInSection.style.display = 'flex';
  updatePlanUI();
  updateAiUI();
});

googleSignInBtn.addEventListener('click', async () => {
  googleSignInBtn.disabled = true;
  googleSignInText.textContent = t('signingIn');
  try {
    const token = await api.googleSignIn();
    const user = await fetchAuthUser(token);
    state.googleToken = token;
    state.user = user;
    if (user && !user.error) {
      state.plan = user.plan ?? 'free';
      state.monthly_screenshots = user.monthly_screenshots ?? 0;
      api.storeSetMulti({ plan: state.plan, monthly_screenshots: state.monthly_screenshots });
      updatePlanUI();
    }
    updateAiUI();
    showMsg(t('signedIn'), 'success');
  } catch (e) {
    showMsg(t('googleSignInFailed', e.message), 'error');
    googleSignInBtn.disabled = false;
    googleSignInText.textContent = t('googleSignIn');
  }
});

// ── AI UI ───────────────────────────────────────────────────────────────────

function updateAiUI() {
  const user = state.user;
  if (!state.googleToken) {
    googleSignInSection.style.display = 'block';
    aiCallsLabel.style.display = 'none';
    bulkGenBtn.style.display = 'none';
    pdfBtn.style.display = 'none';
    upgradeSectionEl.style.display = 'none';
    return;
  }
  googleSignInSection.style.display = 'none';

  if (!user || user.error) {
    aiCallsLabel.style.display = 'none';
    bulkGenBtn.style.display = 'none';
    pdfBtn.style.display = 'none';
    upgradeSectionEl.style.display = 'none';
    return;
  }

  const isPaidPlan = user.plan === 'standard' || user.plan === 'pro' || user.plan === 'team';
  pdfBtn.style.display = isPaidPlan ? '' : 'none';
  pdfBtn.disabled = state.steps.length === 0;

  const limit = user.ai_calls_limit ?? 0;
  if (limit === 0) {
    aiCallsLabel.style.display = 'none';
    bulkGenBtn.style.display = 'none';
    return;
  }

  const used = user.ai_calls_used ?? 0;
  const remaining = limit - used;
  const hasRemaining = remaining > 0;

  aiCallsLabel.style.display = '';
  aiCallsLabel.textContent = t('aiCallsRemaining', String(remaining), String(limit));
  bulkGenBtn.style.display = '';
  bulkGenBtn.disabled = !hasRemaining || state.steps.length === 0;

  document.querySelectorAll('.step-gen-btn').forEach(btn => { btn.disabled = !hasRemaining; });

  // Standard プラン: 使用率に応じて段階的にアップグレード訴求
  if (user.plan === 'standard') {
    const pct = used / limit;
    if (remaining <= 0) {
      upgradeMsgEl.textContent = t('upgradeAiLimitReached');
      upgradeSectionEl.style.display = 'flex';
    } else if (remaining <= 20) {
      upgradeMsgEl.textContent = t('upgradeAiLow', String(remaining));
      upgradeSectionEl.style.display = 'flex';
    } else if (pct >= 0.8) {
      upgradeMsgEl.textContent = t('upgradeAi80pct');
      upgradeSectionEl.style.display = 'flex';
    } else if (pct >= 0.5) {
      upgradeMsgEl.textContent = t('upgradeAi50pct');
      upgradeSectionEl.style.display = 'flex';
    } else {
      upgradeSectionEl.style.display = 'none';
    }
  } else {
    upgradeSectionEl.style.display = 'none';
  }
}

// ── Notion connect ──────────────────────────────────────────────────────────

async function connectNotion() {
  const orig = connectBtn.textContent;
  connectBtn.disabled = true;
  connectBtn.textContent = t('connecting');
  try {
    const result = await api.notionConnect();
    const { access_token, workspace_id, workspace_name } = result;

    const workspaces = await api.storeGet('notion_workspaces', []);
    const idx = workspaces.findIndex(w => w.id === workspace_id);
    const maxWs = (state.plan === 'pro' || state.plan === 'team') ? 3 : 1;
    let newWs;
    if (idx >= 0) {
      newWs = workspaces.map((w, i) => i === idx ? { id: workspace_id, name: workspace_name, token: access_token } : w);
    } else if (workspaces.length >= maxWs) {
      if (maxWs === 1) {
        // Free/Standard(上限1): 既存WSを新WSに自動置き換え
        newWs = [{ id: workspace_id, name: workspace_name, token: access_token }];
      } else {
        // Pro(上限3): 上限超過エラー
        showMsg(t('wsMaxReachedFmt', String(maxWs)), 'error');
        return;
      }
    } else {
      newWs = [...workspaces, { id: workspace_id, name: workspace_name, token: access_token }];
    }

    api.storeSetMulti({
      notion_workspaces: newWs,
      notion_active_workspace_id: workspace_id,
      notion_access_token: access_token,
      notion_workspace_name: workspace_name,
      notion_last_connect_at: Date.now(),
    });

    setNotionConnected(workspace_name);
    updateWsSelector(newWs, workspace_id);
    loadNotionPages(access_token, true);
    showMsg(t('notionConnected', workspace_name), 'success');

    if (state.googleToken) {
      syncWorkspacesToServer(newWs);
    }
  } catch (e) {
    showMsg(t('notionConnectFailed', e.message), 'error');
  } finally {
    connectBtn.disabled = false;
    if (connectBtn.textContent === t('connecting')) connectBtn.textContent = orig;
  }
}

function setNotionConnected(workspaceName) {
  notionDot.classList.add('connected');
  notionStatus.textContent = t('notionConnected', workspaceName);
  connectBtn.textContent = t('reconnect');
}

function updateWsSelector(workspaces, activeId) {
  if (!workspaces || workspaces.length <= 1) {
    wsSelector.style.display = 'none';
    notionStatus.style.display = '';
  } else {
    wsSelector.style.display = '';
    notionStatus.style.display = 'none';
    while (wsSelector.options.length) wsSelector.remove(0);
    for (const ws of workspaces) {
      const opt = document.createElement('option');
      opt.value = ws.id;
      opt.textContent = ws.name;
      if (ws.id === activeId) opt.selected = true;
      wsSelector.appendChild(opt);
    }
  }
  const maxWs = (state.plan === 'pro' || state.plan === 'team') ? 3 : 1;
  const canAdd = workspaces && workspaces.length < maxWs && workspaces.length > 0;
  wsAddBtn.style.display = canAdd ? '' : 'none';
}

wsSelector.addEventListener('change', async () => {
  const workspaces = await api.storeGet('notion_workspaces', []);
  const active = workspaces.find(w => w.id === wsSelector.value);
  if (!active) return;
  api.storeSetMulti({
    notion_active_workspace_id: active.id,
    notion_access_token: active.token,
    notion_workspace_name: active.name,
  });
  setNotionConnected(active.name);
  allNotionPages = [];
  pagesCacheTs = 0;
  loadNotionPages(active.token, true);
});

wsAddBtn.addEventListener('click', connectNotion);

async function syncWorkspacesToServer(workspaces) {
  if (!state.googleToken) return;
  const wsForSync = workspaces.map(w => ({ id: w.id, name: w.name, token: w.token ?? null }));
  fetch(`${SUPABASE_URL}/functions/v1/sync-workspaces`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ google_token: state.googleToken, workspaces: wsForSync }),
  }).catch(() => {});
}

connectBtn.addEventListener('click', connectNotion);

// ── Notion pages ────────────────────────────────────────────────────────────

let allNotionPages = [];
const PAGES_CACHE_TTL = 10 * 60_000;
let pagesCacheTs = 0;
let pagesCacheToken = null;

async function loadNotionPages(token, force = false) {
  if (!force && allNotionPages.length > 0 && token === pagesCacheToken &&
      Date.now() - pagesCacheTs < PAGES_CACHE_TTL) {
    applyDestFilter(destFilter.value);
    destRow.style.display = state.plan === 'free' ? 'none' : '';
    return;
  }
  pageDestSelect.disabled = true;
  destFilter.disabled = true;
  destRefreshBtn.disabled = true;
  pageDestSelect.options[0].text = t('loading');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
      body: JSON.stringify({ filter: { value: 'page', property: 'object' }, sort: { direction: 'descending', timestamp: 'last_edited_time' }, page_size: 50 }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${data?.message ?? ''}`);

    allNotionPages = (data.results ?? []).map(p => {
      const titleProp = Object.values(p.properties ?? {}).find(v => v.type === 'title');
      const title = titleProp?.title?.[0]?.plain_text || t('untitled');
      return { id: p.id, title };
    });
    pagesCacheTs = Date.now();
    pagesCacheToken = token;
    pageDestSelect.options[0].text = t('newPageOption');
    applyDestFilter(destFilter.value);
  } catch (err) {
    pageDestSelect.options[0].text = t('newPageOption');
    if (err.name === 'AbortError') {
      showMsg(t('notionPageLoadTimeout'), 'error');
    } else if (err.message && !err.message.startsWith('Failed to fetch')) {
      showMsg(t('destLoadFailed', err.message), 'error');
    }
  } finally {
    clearTimeout(timeoutId);
    pageDestSelect.disabled = false;
    destFilter.disabled = false;
    destRefreshBtn.disabled = false;
    destRow.style.display = state.plan === 'free' ? 'none' : '';
  }
}

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

destFilter.addEventListener('input', () => applyDestFilter(destFilter.value));
pageDestSelect.addEventListener('change', () => { titleRow.style.display = pageDestSelect.value ? 'none' : ''; });
destRefreshBtn.addEventListener('click', async () => {
  const token = await api.storeGet('notion_access_token');
  if (token) loadNotionPages(token, true);
});

// ── Capture ─────────────────────────────────────────────────────────────────

async function doCapture() {
  // Free プラン: 月間上限到達時はブロック
  if (state.plan === 'free' && state.monthly_screenshots >= FREE_SCREENSHOT_LIMIT) {
    upgradeSectionEl.style.display = 'flex';
    upgradeMsgEl.textContent = t('captureLimitBanner', String(FREE_SCREENSHOT_LIMIT));
    showMsg(t('captureLimitMsg', String(FREE_SCREENSHOT_LIMIT)), 'error');
    return;
  }
  try {
    await api.hideForCapture();
    await new Promise(r => setTimeout(r, 600));
    const result = await api.takeScreenshot();
    if (result) api.screenshotReady();
    else await api.showWindow();
  } catch (e) {
    await api.showWindow();
    showMsg(t('screenshotFailed', e.message), 'error');
  }
}

captureBtn.addEventListener('click', () => doCapture());

// Global hotkey (Ctrl+Shift+M) routes through main → renderer
api.onCaptureTrigger(() => doCapture());

// Receive state updates from main (overlay captured a step, etc.)
api.onStateUpdated(({ steps: newSteps }) => {
  state.steps = newSteps ?? [];
  renderSteps();
  updateStepsUI();
  updateAiUI();
});

// ── Step rendering ──────────────────────────────────────────────────────────

let dragSrcIndex = null;

function renderSteps() {
  if (state.steps.length === 0) {
    stepList.innerHTML = '';
    stepList.appendChild(emptyHint);
    emptyHint.style.display = '';
    return;
  }
  emptyHint.style.display = 'none';
  stepList.innerHTML = '';

  const isPaid = state.user && (state.user.plan === 'standard' || state.user.plan === 'pro' || state.user.plan === 'team');

  state.steps.forEach((step, i) => {
    const row = document.createElement('div');
    row.className = 'step-item';
    row.draggable = true;
    row.dataset.index = i;

    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.title = t('dragHandle');

    const num = document.createElement('div');
    num.className = 'step-num';
    num.textContent = i + 1;
    if (step.hasPiiBlur) {
      num.style.position = 'relative';
      num.title = t('piiBlurApplied');
      const badge = document.createElement('span');
      badge.textContent = '🔒';
      badge.style.cssText = 'position:absolute;top:-6px;right:-6px;font-size:9px;line-height:1;';
      num.appendChild(badge);
    }

    const thumb = document.createElement('img');
    thumb.className = 'step-thumb';
    thumb.src = step.annotatedDataUrl;
    thumb.alt = `step ${i + 1}`;
    thumb.title = t('zoomHint');
    thumb.addEventListener('click', () => api.openPreview(step.annotatedDataUrl));

    const topRow = document.createElement('div');
    topRow.className = 'step-item-top';

    const delBtn = document.createElement('button');
    delBtn.className = 'step-delete';
    delBtn.textContent = '×';
    delBtn.title = t('deleteStepTitle');
    delBtn.addEventListener('click', () => deleteStep(i));

    const fields = document.createElement('div');
    fields.className = 'step-fields';

    // Desc row
    const descRow = document.createElement('div');
    descRow.className = 'step-field-row';
    const descLbl = document.createElement('span');
    descLbl.className = 'step-field-label';
    descLbl.textContent = t('stepDescLabel');
    const descInput = document.createElement('input');
    descInput.className = 'step-label-input';
    descInput.type = 'text';
    descInput.name = `step-desc-${i}`;
    descInput.placeholder = t('stepDescPlaceholderDesktop');
    descInput.value = step.label || '';
    descInput.addEventListener('input', e => { step.label = e.target.value; syncSteps(); });
    descRow.appendChild(descLbl);
    descRow.appendChild(descInput);

    if (isPaid) {
      const genBtn = document.createElement('button');
      genBtn.className = 'step-gen-btn';
      genBtn.textContent = t('aiGenBtn');
      genBtn.title = t('aiGenBtnTitle');
      genBtn.addEventListener('click', () => generateStepDescription(step, genBtn, descInput));
      descRow.appendChild(genBtn);
    }
    fields.appendChild(descRow);

    // Memo row
    const memoRow = document.createElement('div');
    memoRow.className = 'step-field-row';
    const memoLbl = document.createElement('span');
    memoLbl.className = 'step-field-label';
    memoLbl.textContent = t('stepMemoLabel');
    const memoInput = document.createElement('input');
    memoInput.className = 'step-memo-input';
    memoInput.type = 'text';
    memoInput.name = `step-memo-${i}`;
    memoInput.placeholder = t('stepMemoPlaceholderDesktop');
    memoInput.value = step.memo || '';
    memoInput.addEventListener('input', e => { step.memo = e.target.value; syncSteps(); });
    memoRow.appendChild(memoLbl);
    memoRow.appendChild(memoInput);
    fields.appendChild(memoRow);

    // Drag events
    row.addEventListener('dragstart', e => {
      dragSrcIndex = i;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('dragging'), 0);
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      stepList.querySelectorAll('.step-item').forEach(r => r.classList.remove('drag-over'));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      stepList.querySelectorAll('.step-item').forEach(r => r.classList.remove('drag-over'));
      if (dragSrcIndex !== i) row.classList.add('drag-over');
    });
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (dragSrcIndex === null || dragSrcIndex === i) return;
      const moved = state.steps.splice(dragSrcIndex, 1)[0];
      state.steps.splice(i, 0, moved);
      state.steps.forEach((s, idx) => { s.stepNumber = idx + 1; });
      dragSrcIndex = null;
      await redrawAnnotations();
      syncSteps();
      renderSteps();
      updateStepsUI();
    });

    topRow.appendChild(handle);
    topRow.appendChild(num);
    topRow.appendChild(thumb);
    topRow.appendChild(delBtn);
    row.appendChild(topRow);
    row.appendChild(fields);
    stepList.appendChild(row);
  });
}

async function deleteStep(index) {
  state.steps.splice(index, 1);
  state.steps.forEach((s, i) => { s.stepNumber = i + 1; });
  await redrawAnnotations();
  syncSteps();
  renderSteps();
  updateStepsUI();
}

async function redrawAnnotations() {
  stepList.classList.add('step-list-processing');
  try {
  await Promise.all(state.steps.map((step, i) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = step.viewportWidth;
      c.height = step.viewportHeight;
      const ac = c.getContext('2d');
      ac.drawImage(img, 0, 0, step.viewportWidth, step.viewportHeight);
      // Re-apply blur regions
      if (step.piiRegions?.length) {
        ac.fillStyle = '#1a1a1a';
        for (const r of step.piiRegions) {
          ac.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
        }
      }
      const { x, y } = step;
      ac.strokeStyle = '#FF3B30';
      ac.lineWidth = 5;
      ac.beginPath(); ac.arc(x, y, 18, 0, Math.PI * 2); ac.stroke();
      if (state.plan === 'free') {
        const w = step.viewportWidth, h = step.viewportHeight;
        const wmText = '◆ Notion Manual Maker';
        const fontSize = 12;
        ac.font = `${fontSize}px sans-serif`;
        const textWidth = ac.measureText(wmText).width;
        const padX = 10, padY = 6;
        const bgW = textWidth + padX * 2;
        const bgH = fontSize + padY * 2;
        const bgX = w - bgW - 12;
        const bgY = h - bgH - 10;
        const radius = bgH / 2;
        ac.fillStyle = 'rgba(0,0,0,0.18)';
        ac.beginPath();
        ac.roundRect(bgX, bgY, bgW, bgH, radius);
        ac.fill();
        ac.fillStyle = 'rgba(255,255,255,0.75)';
        ac.textAlign = 'left';
        ac.textBaseline = 'middle';
        ac.fillText(wmText, bgX + padX, bgY + bgH / 2);
      }
      step.annotatedDataUrl = c.toDataURL('image/png');
      resolve();
    };
    img.src = step.rawDataUrl;
  })));
  } finally {
    stepList.classList.remove('step-list-processing');
  }
}

function syncSteps() {
  api.updateSteps(state.steps);
}

function updateStepsUI() {
  const count = state.steps.length;
  recordStatus.textContent = count === 0 ? t('recordStatusZero') : t('recordStatusN', String(count));
  saveBtn.disabled = count === 0;
  clearBtn.disabled = count === 0;
  if (pdfBtn.style.display !== 'none') {
    pdfBtn.disabled = count === 0;
  }
  if (bulkGenBtn.style.display !== 'none') {
    bulkGenBtn.disabled = count === 0 || !((state.user?.ai_calls_limit ?? 0) > (state.user?.ai_calls_used ?? 0));
  }
}

// ── AI generation ───────────────────────────────────────────────────────────

async function callGeminiProxy(parts) {
  const token = state.googleToken;
  if (!token) throw new Error('not signed in');
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

function cropStep(step) {
  return new Promise((resolve, reject) => {
    const srcUrl = step.annotatedDataUrl || step.rawDataUrl;
    if (!srcUrl) { reject(new Error('no image data')); return; }
    const img = new Image();
    img.onerror = () => reject(new Error('image load failed'));
    img.onload = () => {
      // クリック位置を画像座標に変換（拡張機能と同じロジック）
      let px, py;
      if (step.x != null && step.viewportWidth) {
        px = step.x * (img.naturalWidth  / step.viewportWidth);
        py = step.y * (img.naturalHeight / step.viewportHeight);
      } else {
        px = img.naturalWidth  / 2;
        py = img.naturalHeight / 2;
      }
      const CW = 360, CH = 240;
      const ox = Math.max(0, Math.round(px - CW / 2));
      const oy = Math.max(0, Math.round(py - CH / 2));
      const ow = Math.min(CW, img.naturalWidth - ox);
      const oh = Math.min(CH, img.naturalHeight - oy);
      const out = document.createElement('canvas');
      out.width = ow; out.height = oh;
      out.getContext('2d').drawImage(img, ox, oy, ow, oh, 0, 0, ow, oh);
      resolve(out.toDataURL('image/jpeg', 0.72));
    };
    img.src = srcUrl;
  });
}

function getStepPrompt() {
  const isJa = document.documentElement.lang === 'ja';
  return isJa
    ? 'This screenshot shows one step in a desktop app operation. A red circle marks the exact point of interaction. Write ONE short sentence in Japanese describing the action at the red circle. Use dictionary form (e.g. 「〜をクリック。」「〜に入力。」「〜を選択。」) — not 丁寧語. Include button/field names near the red circle if visible. Return ONLY the sentence.'
    : 'This screenshot shows one step in a desktop app operation. A red circle marks the exact point of interaction. Write ONE short sentence in English in imperative form (e.g. "Click the button", "Enter the value"). Include button/field names near the red circle if visible. Return ONLY the sentence.';
}

async function generateStepDescription(step, btn, input) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const cropped = await cropStep(step);
    const contextStr = step.ocrContext ? ` Additional context near click: "${step.ocrContext}".` : '';
    const text = await callGeminiProxy([
      { text: getStepPrompt() + contextStr },
      { inline_data: { mime_type: 'image/jpeg', data: cropped.split(',')[1] } },
    ]);
    step.label = text.trim();
    if (input) input.value = step.label;
    syncSteps();
    updateAiUI();
  } catch (e) {
    showMsg(t('aiFailed', e.message), 'error');
  }
  btn.disabled = false;
  btn.textContent = 'AI';
}

bulkGenBtn.addEventListener('click', async () => {
  if (!state.user || state.steps.length === 0) return;
  bulkGenBtn.disabled = true;
  bulkGenBtn.classList.add('loading');
  bulkGenBtn.textContent = t('preparingImages');
  showMsg('', '');

  const total = state.steps.length;
  const remaining = (state.user.ai_calls_limit ?? 0) - (state.user.ai_calls_used ?? 0);
  const sendCount = Math.min(total, remaining);
  if (sendCount <= 0) {
    showMsg(t('aiLimitReached'), 'error');
    bulkGenBtn.disabled = false;
    bulkGenBtn.classList.remove('loading');
    bulkGenBtn.textContent = t('desktopBulkGenBtn');
    return;
  }

  const stepsToSend = state.steps.slice(0, sendCount);
  try {
    const cropped = await Promise.all(stepsToSend.map(s => cropStep(s)));
    const images = cropped.map(c => c.split(',')[1]);
    const hints = stepsToSend.map(s => {
      const parts = [];
      if (s.label) parts.push(`label:"${s.label}"`);
      if (s.ocrContext) parts.push(`context:"${s.ocrContext}"`);
      return parts.join(' ');
    });

    bulkGenBtn.textContent = sendCount < total
      ? t('generatingPartial', String(sendCount), String(total), String(remaining))
      : t('generatingAll', String(total));

    const locale = document.documentElement.lang || 'ja';
    const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_token: state.googleToken, images, hints, pageTitle: pageTitle.value || '', locale }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

    let generated = 0;
    (data.results ?? []).forEach((text, i) => {
      if (stepsToSend[i] && text) { stepsToSend[i].label = String(text).trim(); generated++; }
    });
    if (state.user && data.ai_calls_used !== undefined) {
      state.user.ai_calls_used = data.ai_calls_used;
      updateAiUI();
    }
    syncSteps();
    renderSteps();
    showMsg(sendCount < total
      ? t('aiGeneratedPartial', String(generated), String(total - sendCount))
      : t('aiGeneratedN', String(generated), String(total)), 'success');
  } catch (e) {
    showMsg(t('aiFailed', e.message), 'error');
  }

  bulkGenBtn.disabled = false;
  bulkGenBtn.classList.remove('loading');
  bulkGenBtn.textContent = t('desktopBulkGenBtn');
});

// ── Save to Notion ──────────────────────────────────────────────────────────

function compressForUpload(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1280;
      const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

saveBtn.addEventListener('click', async () => {
  showMsg('', '');
  saveBtn.disabled = true;
  saveBtn.textContent = t('saving');

  let result;
  try {
    const compressedSteps = await Promise.all(
      state.steps.map(async s => ({
        ...s,
        annotatedDataUrl: await compressForUpload(s.annotatedDataUrl),
      }))
    );

    result = await api.saveToNotion({
      notionPageId: pageDestSelect.value || null,
      title: pageTitle.value,
      stepsToSave: compressedSteps,
      googleToken: state.googleToken,
      plan: state.plan,
      monthlyScreenshots: state.monthly_screenshots,
    });
  } catch (e) {
    result = { error: String(e?.message ?? e) };
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = t('saveBtn');
  }

  if (result?.error) {
    showMsg(result.error, 'error');
  } else if (result?.success) {
    showMsg(result.warning || t('savedToNotion'), result.warning ? 'error' : 'success');
    if (result.notionPageUrl) api.openExternal(result.notionPageUrl);
    // 部分失敗（warning付き）時はステップを保持して再保存できるようにする
    if (!result.warning) {
      state.steps = [];
      pageTitle.value = '';
      renderSteps();
      updateStepsUI();
      updateAiUI();
    }
    // Refresh screenshot count
    const saved = await api.storeGet('monthly_screenshots', 0);
    state.monthly_screenshots = saved;
    updatePlanUI();
  }
});

// ── PDF export ──────────────────────────────────────────────────────────────

pdfBtn.addEventListener('click', () => {
  const title = pageTitle.value.trim() || t('pdfDefaultTitle');
  api.exportPdf({ title, steps: state.steps });
});

// ── Clear ───────────────────────────────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  api.clearSteps();
  state.steps = [];
  renderSteps();
  updateStepsUI();
  updateAiUI();
});

// ── Plan UI ─────────────────────────────────────────────────────────────────

function updatePlanUI() {
  const plan = state.plan;
  if (plan === 'pro' || plan === 'team') {
    planBadge.textContent = plan === 'team' ? 'Team' : 'Pro';
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
    usageSection.style.display = 'block';
    usageFill.style.width = `${Math.min((used / limit) * 100, 100)}%`;
    usageText.textContent = t('usageText', String(used), String(limit));
  }
  destRow.style.display = plan === 'free' ? 'none' : '';

  // ログアウトボタン表示制御
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.style.display = state.googleToken ? '' : 'none';

  // プランバッジをクリックで強制リフレッシュ
  planBadge.style.cursor = 'pointer';
  planBadge.title = `plan: ${state.plan} | shots: ${state.monthly_screenshots} (click to refresh)`;
  planBadge.onclick = async () => {
    authUserCache.ts = 0;
    if (state.googleToken) {
      planBadge.textContent = '…';
      await initUserSession();
      planBadge.title = `plan: ${state.plan} | shots: ${state.monthly_screenshots} (click to refresh)`;
    }
  };

  // Portal リンク: サインイン済みなら表示
  portalLink.style.display = state.googleToken ? 'inline' : 'none';
  portalLink.onclick = (e) => {
    e.preventDefault();
    authUserCache.ts = 0;
    api.openExternal(DASHBOARD_URL);
  };
}

// ── Show message ─────────────────────────────────────────────────────────────

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = type || '';
  msgEl.style.display = text ? 'block' : 'none';
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  await applyI18n();

  // ── Main プロセスからのアプリイベント購読 ──
  if (api.onAppEvent) {
    // autoUpdater: 新バージョン検知・ダウンロード完了
    api.onAppEvent('app:update-available', ({ version }) => {
      showMsg(t('updateAvailable', String(version)), 'success');
    });
    api.onAppEvent('app:update-downloaded', ({ version }) => {
      showMsg(t('updateDownloaded', String(version)), 'success');
    });
    // OCR処理中はキャプチャボタンを「解析中…」表示に
    api.onAppEvent('app:ocr-status', ({ status }) => {
      if (status === 'processing') {
        captureBtn.disabled = true;
        captureBtn.textContent = t('ocrProcessing');
      } else {
        captureBtn.disabled = false;
        captureBtn.textContent = t('captureBtn');
      }
    });
    // OCR失敗 — ぼかし未適用の可能性を通知
    api.onAppEvent('app:ocr-failed', () => {
      showMsg(t('ocrFailed'), 'error');
      setTimeout(() => { if (msgEl.textContent === t('ocrFailed')) showMsg('', ''); }, 6000);
    });
  }

  // Load stored state
  const stored = await api.storeGetMulti([
    'plan', 'monthly_screenshots',
    'notion_access_token', 'notion_workspace_name', 'notion_workspaces', 'notion_active_workspace_id',
  ]);

  state.plan = stored.plan ?? 'free';
  state.monthly_screenshots = stored.monthly_screenshots ?? 0;

  updatePlanUI();

  if (stored.notion_access_token || stored.notion_workspaces?.length) {
    const workspaces = stored.notion_workspaces ?? [];
    const activeId = stored.notion_active_workspace_id;
    const active = workspaces.find(w => w.id === activeId) ?? workspaces[0];
    const token = active?.token ?? stored.notion_access_token;
    const name = active?.name ?? stored.notion_workspace_name ?? 'Notion';
    if (token) {
      setNotionConnected(name);
      updateWsSelector(workspaces, active?.id ?? activeId);
      loadNotionPages(token);
    }
  }

  // Get current steps from main process
  const { steps: savedSteps } = await api.getState();
  state.steps = savedSteps ?? [];
  renderSteps();
  updateStepsUI();

  // Init Google session in background
  initUserSession();

  // Google token は1時間で期限切れ → 50分ごとに自動リフレッシュ
  setInterval(() => { if (state.googleToken) initUserSession(); }, 50 * 60 * 1000);

  // プラン変更を即時反映 → フォーカス時にキャッシュクリアして再チェック
  window.addEventListener('focus', () => {
    authUserCache.ts = 0;
    if (state.googleToken) initUserSession();
  });

  // 5分ごとにプランをチェック（Supabase直接変更などに対応）
  setInterval(() => {
    if (state.googleToken) {
      authUserCache.ts = 0;
      initUserSession();
    }
  }, 5 * 60 * 1000);
}

init();
