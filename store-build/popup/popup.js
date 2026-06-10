const NOTION_OAUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const FREE_SCREENSHOT_LIMIT = 20;
const NOTION_CLIENT_ID = '345d872b-594c-810c-9c3d-00376d7425b3';
const REDIRECT_URL = chrome.identity.getRedirectURL('notion');
const SUPABASE_URL = 'https://ouscjeptmkoszcjkrmtm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91c2NqZXB0bWtvc3pjamtybXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODM2ODQsImV4cCI6MjA5MTk1OTY4NH0.hYxWKYO2_H--7WAthX7azRJuier5uI3IA7km1sgwV3g';
const SUPABASE_PROXY = `${SUPABASE_URL}/functions/v1/notion-proxy`;

const DASHBOARD_URL = 'https://notion-manual-maker.vercel.app/dashboard';

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

// ── i18n ────────────────────────────────────────────────────────────────────
let _extMsgs = null; // null = use chrome.i18n fallback

function t(key, subsOrFirst, ...rest) {
  // chrome.i18n.getMessage 互換: 第2引数が配列ならそのまま、文字列なら可変長引数
  const subs = Array.isArray(subsOrFirst)
    ? subsOrFirst
    : subsOrFirst !== undefined ? [subsOrFirst, ...rest] : [];
  const entry = _extMsgs?.[key];
  if (entry) {
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
  // fallback: chrome.i18n (直接呼び出し—再帰防止)
  return chrome.i18n.getMessage(key, subs) || key;
}

async function applyI18n(localeOverride) {
  const systemLang = chrome.i18n.getUILanguage().startsWith('ja') ? 'ja' : 'en';
  const lang = localeOverride ?? systemLang;

  // ロケール上書きの場合: _locales/{lang}/messages.json を直接ロード
  if (localeOverride && localeOverride !== systemLang) {
    try {
      const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
      _extMsgs = await fetch(url).then(r => r.json());
    } catch { _extMsgs = null; }
  } else {
    _extMsgs = null; // chrome.i18n を使う
  }

  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  // data-i18n がボタンテキストを上書きするため、動的UIを再適用
  if (localeOverride) {
    updateRecordUI();
    updateAiUI();
    // 接続済み表示を復元（[data-i18n]の一括上書きで「未接続」に戻るのを防ぐ）
    if (notionDot.classList.contains('connected')) {
      const { notion_workspace_name: wsName } = await chrome.storage.local.get('notion_workspace_name');
      setNotionConnected(wsName ?? 'Notion');
    }
  }
}
applyI18n();

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
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!token) {
        // token が undefined/null の場合も reject（Chrome がエラーをセットしないケースがある）
        reject(new Error('no_token'));
      } else {
        resolve(token);
      }
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
  console.log('[auth-user] plan:', data.plan, 'monthly_screenshots:', data.monthly_screenshots);
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

      // ユーザーの言語設定を適用
      if (user.locale) await applyI18n(user.locale);

      const { screenshot_reset_at: prevResetAt } = await chrome.storage.sync.get('screenshot_reset_at');
      const serverResetAt = user.screenshot_reset_at ?? null;
      const serverResetNewer = serverResetAt && (!prevResetAt || serverResetAt > prevResetAt);

      const serverCount = user.monthly_screenshots ?? 0;
      state.monthly_screenshots = serverCount;
      await chrome.storage.sync.set({
        plan: newPlan,
        monthly_screenshots: state.monthly_screenshots,
        screenshot_reset_at: serverResetAt ?? prevResetAt,
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

      // プラン更新後にWSセレクター表示を再計算（stale plan による誤表示を防ぐ）
      const { notion_workspaces: latestWs, notion_active_workspace_id: latestActiveId }
        = await chrome.storage.local.get(['notion_workspaces', 'notion_active_workspace_id']);
      renderWsSelector(latestWs ?? [], latestActiveId);

      // プラン変更メッセージ
      if (showUpgradeMsg || (prevPlan === 'free' && newPlan !== 'free')) {
        const label = newPlan === 'pro' ? 'Pro' : 'Standard';
        showMsg(t('planUpgraded', [label]), 'success');
        showUpgradeMsg = false;
      } else if (prevPlan !== 'free' && newPlan === 'free') {
        const wsNote = wsDeletedCount > 0
          ? t('wsDeleted', [String(wsDeletedCount)])
          : t('planRestricted');
        showMsg(t('planDowngraded', [wsNote]), 'error');
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
        notionStatus.textContent = t('notionDisconnected');
        connectBtn.textContent = t('connect');
        recordBtn.disabled = true;
        wsSelector.style.display = 'none';
        wsAddBtn.style.display = 'none';
        allNotionPages = [];
        showMsg(t('welcomeMsg'), 'success');
      } else {
        // サーバーのWS一覧とローカルを常に照合し、差異があれば更新（他デバイス・ダッシュボードでの変更を反映）
        // 存在比較はトークン有無を問わない（旧バージョン同期のtoken無し行を「未接続」と誤認しないため）
        // トークンが無い行はローカルの同一IDから補完する
        const serverAll = (user.workspaces ?? []).map(w => ({
          id: w.workspace_id,
          name: w.workspace_name,
          token: w.access_token ?? (localWs ?? []).find(l => l.id === w.workspace_id)?.token ?? null,
        }));
        const serverWs = serverAll.filter(w => w.token);
        const localIds  = new Set((localWs ?? []).map(w => w.id));
        const serverIds = new Set(serverAll.map(w => w.id));
        const differs   = localIds.size !== serverIds.size ||
          [...serverIds].some(id => !localIds.has(id)) ||
          [...localIds].some(id => !serverIds.has(id));

        if (differs) {
          if (serverAll.length === 0) {
            const { notion_ws_synced_at: syncedAt = 0, notion_last_connect_at: lastConnectAt = 0 }
              = await chrome.storage.local.get(['notion_ws_synced_at', 'notion_last_connect_at']);
            if (!syncedAt || Date.now() - lastConnectAt < 120_000) {
              // 同期が一度も成功していない/接続直後 → ローカルが正 → サーバーへ再push
              syncWorkspacesToServer(localWs ?? []).catch(e => console.warn('[syncWorkspaces]', e.message));
            } else {
            // サーバーで全切断 → ローカルもクリア
            await chrome.storage.local.remove([
              'notion_workspaces', 'notion_active_workspace_id',
              'notion_access_token', 'notion_workspace_name',
              'notion_ws_synced_at', 'notion_last_connect_at',
            ]);
            notionDot.classList.remove('connected');
            notionStatus.textContent = t('notionDisconnected');
            connectBtn.textContent = t('connect');
            recordBtn.disabled = true;
            wsSelector.style.display = 'none';
            wsAddBtn.style.display = 'none';
            allNotionPages = [];
            }
          } else if (serverWs.length === 0) {
            // サーバーにWS行はあるがトークンを解決できない（旧バージョンの同期データ等）
            // → ローカルを維持し、トークン付きデータをサーバーへ再push（修復）
            if ((localWs ?? []).length > 0) {
              syncWorkspacesToServer(localWs).catch(e => console.warn('[syncWorkspaces]', e.message));
            }
          } else {
            // アクティブWSがサーバーにない場合は先頭に切り替え
            const { notion_active_workspace_id: curActiveId }
              = await chrome.storage.local.get('notion_active_workspace_id');
            const newActive = serverWs.find(w => w.id === curActiveId) ?? serverWs[0];
            await chrome.storage.local.set({
              notion_workspaces: serverWs,
              notion_active_workspace_id: newActive.id,
              notion_access_token: newActive.token,
              notion_workspace_name: newActive.name,
            });
            renderWsSelector(serverWs, newActive.id);
            setNotionConnected(newActive.name);
            if (!localIds.has(newActive.id)) loadNotionPages(newActive.token);
          }
        }
      }
    }
  } catch (e) {
    // no_token はサインイン未実施の正常ケース、それ以外はログ出力
    if (e.message !== 'no_token') console.warn('[initUserSession]', e.message);
    state.user = null;
    state.googleToken = null; // undefined のまま残らないよう明示的にリセット
  }
  sessionInitDone = true;
  renderSteps();
  updateAiUI();
}

googleSignInBtn.addEventListener('click', async () => {
  googleSignInBtn.disabled = true;
  document.getElementById('google-sign-in-text').textContent = t('signingIn');
  try {
    const token = await getGoogleToken(true);
    const user = await fetchAuthUser(token);
    state.googleToken = token;
    state.user = user;
    await chrome.storage.session.set({ googleToken: token });
    if (user && !user.error) {
      state.plan = user.plan ?? 'free';
      const { screenshot_reset_at: prevResetAt2 } = await chrome.storage.sync.get('screenshot_reset_at');
      const serverResetAt2 = user.screenshot_reset_at ?? null;
      const serverResetNewer2 = serverResetAt2 && (!prevResetAt2 || serverResetAt2 > prevResetAt2);

      const serverCount2 = user.monthly_screenshots ?? 0;
      state.monthly_screenshots = serverCount2;
      await chrome.storage.sync.set({
        plan: user.plan ?? 'free',
        monthly_screenshots: state.monthly_screenshots,
        screenshot_reset_at: serverResetAt2 ?? prevResetAt2,
      });
      updatePlanUI();
      // プラン更新後にWSセレクター表示を再計算
      const { notion_workspaces: latestWs2, notion_active_workspace_id: latestActiveId2 }
        = await chrome.storage.local.get(['notion_workspaces', 'notion_active_workspace_id']);
      renderWsSelector(latestWs2 ?? [], latestActiveId2);
      // 初回ログイン（新規ユーザー・再登録）にオンボーディングメッセージ
      const isNewUser2 = user.created_at &&
        (Date.now() - new Date(user.created_at).getTime() < 5 * 60 * 1000);
      const { notion_workspaces: wsCheck } = await chrome.storage.local.get('notion_workspaces');
      if (isNewUser2 && !wsCheck?.length) {
        showMsg(t('welcomeMsg'), 'success');
      }
    }
    updateAiUI();
  } catch (e) {
    showMsg(t('googleSignInFailed', [e.message]), 'error');
  } finally {
    // 成功時はupdatePlanUI等でボタンが隠れるため、無条件で復元してstuck状態を防ぐ
    googleSignInBtn.disabled = false;
    document.getElementById('google-sign-in-text').textContent = t('googleSignIn');
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
    upgradeMsg.textContent = t('upgradeMsgFree');
    upgradeSection.style.display = 'flex';
    return;
  }

  const used = user.ai_calls_used ?? 0;
  const remaining = limit - used;
  const hasRemaining = remaining > 0;

  aiCallsLabel.style.display = '';
  aiCallsLabel.textContent = t('aiCallsRemaining', [String(remaining), String(limit)]);

  bulkGenBtn.style.display = '';
  bulkGenBtn.disabled = !hasRemaining || state.steps.length === 0;

  // 個別AI生成ボタンも残り0なら非活性化
  document.querySelectorAll('.step-gen-btn').forEach(btn => {
    btn.disabled = !hasRemaining;
  });

  // Standard: 残り20回以下でProへの案内を表示
  if (user.plan === 'standard' && remaining <= 20) {
    upgradeMsg.textContent = t('upgradeMsgStandard', [String(remaining)]);
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
    chrome.storage.sync.get(['plan', 'monthly_screenshots', 'privacy_blur', 'screenshot_reset_at']),
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
    if (msg.step) {
      // 差分更新: 新しいステップを末尾に追加（画像サイズ問題を回避）
      state.steps = [...(state.steps ?? []), msg.step];
    } else if (msg.steps) {
      state.steps = msg.steps; // 旧形式との後方互換
    }
    renderSteps();
    updateRecordUI();
    updateAiUI();
  } else if (msg.type === 'INJECTION_ERROR') {
    showMsg(t('injectionError'), 'error');
  } else if (msg.type === 'SAVE_PROGRESS') {
    saveBtn.textContent = t('savingProgress', [String(msg.current), String(msg.total)]);
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
      // キャッシュの経過時間をツールチップで表示（更新ボタンへの導線）
      const ageMin = Math.round((Date.now() - (c.notionPagesCacheTs ?? 0)) / 60000);
      destRefreshBtn.title = t('cacheAgeHint', [String(ageMin)]);
      return;
    }
  }
  pageDestSelect.disabled = true;
  destFilter.disabled = true;
  destRefreshBtn.disabled = true;
  pageDestSelect.options[0].text = t('loading');
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
      const title = titleProp?.title?.[0]?.plain_text || t('untitled');
      return { id: p.id, title };
    });
    chrome.storage.session.set({ notionPagesCache: allNotionPages, notionPagesCacheTs: Date.now(), notionPagesCacheToken: token }).catch(() => {});

    pageDestSelect.options[0].text = allNotionPages.length
      ? t('newPageOption')
      : t('newPageOptionEmpty');
    applyDestFilter(destFilter.value);
  } catch (err) {
    pageDestSelect.options[0].text = t('newPageOption');
    if (err.message && !err.message.startsWith('Failed to fetch')) {
      showMsg(t('destLoadFailed', [err.message]), 'error');
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

async function syncWorkspacesToServer(workspaces) {
  if (!state.googleToken) return;
  const wsForSync = workspaces.map(w => ({ id: w.id, name: w.name, token: w.token ?? null }));
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-workspaces`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ google_token: state.googleToken, workspaces: wsForSync }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `sync failed (${res.status})`);
  }
  // 同期成功を記録 — 「サーバー空→ローカル消去」判定に使用
  await chrome.storage.local.set({ notion_ws_synced_at: Date.now() });
}

async function connectNotion() {
  const authUrl =
    `${NOTION_OAUTH_URL}?client_id=${NOTION_CLIENT_ID}` +
    `&response_type=code&owner=user&redirect_uri=${encodeURIComponent(REDIRECT_URL)}`;

  const originalText = connectBtn.textContent;
  connectBtn.disabled = true;
  connectBtn.textContent = t('connecting');

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
      if (maxWs === 1) {
        // Free/Standard(上限1): 既存WSを新WSに自動置き換え
        workspaces = [{ id: workspaceId, name: workspaceName, token: data.access_token }];
      } else {
        // Pro(上限3): 上限超過エラー
        showMsg(t('wsMaxReached', [String(maxWs)]), 'error');
        return;
      }
    } else {
      workspaces = [...existing, { id: workspaceId, name: workspaceName, token: data.access_token }];
    }

    await chrome.storage.local.set({
      notion_workspaces: workspaces,
      notion_active_workspace_id: workspaceId,
      notion_access_token: data.access_token,
      notion_workspace_name: workspaceName,
      notion_workspace_id: workspaceId,
      notion_last_connect_at: Date.now(),
      notion_ws_synced_at: 0, // 新しいWS構成はまだ未同期 — sync成功時に更新される
    });

    renderWsSelector(workspaces, workspaceId);
    setNotionConnected(workspaceName);
    loadNotionPages(data.access_token);
    // 同期失敗でもNotion接続自体は成功 — エラー扱いにしない（後でinitUserSessionが再push）
    await syncWorkspacesToServer(workspaces).catch(e => console.warn('[syncWorkspaces]', e.message));
  } catch (e) {
    showMsg(t('notionConnectFailed', [e.message]), 'error');
  } finally {
    connectBtn.disabled = false;
    if (connectBtn.textContent === t('connecting')) connectBtn.textContent = originalText;
  }
}

function setNotionConnected(workspaceName) {
  notionDot.classList.add('connected');
  notionStatus.textContent = t('notionConnected', [workspaceName]);
  connectBtn.textContent = t('reconnect');
  recordBtn.disabled = false;
}

async function startRecording() {
  if (!state.googleToken) {
    showMsg(t('needGoogleSignIn'), 'error');
    return;
  }
  const { notion_access_token } = await chrome.storage.local.get('notion_access_token');
  if (!notion_access_token) {
    showMsg(t('needNotionConnect'), 'error');
    return;
  }
  const granted = await new Promise(resolve =>
    chrome.permissions.request({ origins: ['<all_urls>'] }, resolve)
  );
  if (!granted) {
    showMsg(t('permissionRequired'), 'error');
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId: tab.id });
  window.close();
}

function updateRecordUI() {
  const count = state.steps.length;
  recordStatus.textContent = t('recordStatusN', [String(count)]);
  saveBtn.disabled = count === 0;
  clearBtn.disabled = count === 0;
  pdfBtn.disabled = count === 0;
  if (state.isRecording) {
    recBanner.style.display = 'flex';
    recStepCount.textContent = t('recordingSteps', [String(count)]);
    recordBtn.textContent = t('stopRecording');
    recordBtn.classList.add('btn-record-stop');
  } else {
    recBanner.style.display = 'none';
    recordBtn.textContent = t('startRecording');
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
    handle.title = t('dragHandle');

    const num = document.createElement('div');
    num.className = 'step-num';
    num.textContent = step.stepNumber;
    if (step.hasPiiBlur) {
      num.title = t('piiBlurApplied');
      num.style.position = 'relative';
      const badge = document.createElement('span');
      badge.textContent = '🔒';
      badge.style.cssText = 'position:absolute;top:-6px;right:-6px;font-size:9px;line-height:1;';
      num.appendChild(badge);
    }

    let thumb;
    if (step.annotatedDataUrl) {
      thumb = document.createElement('img');
      thumb.className = 'step-thumb';
      thumb.src = step.annotatedDataUrl;
      thumb.alt = `step ${step.stepNumber}`;
      thumb.title = t('zoomHint');
      thumb.addEventListener('click', () => openPreview(step.annotatedDataUrl));
    } else {
      // SW再起動で画像データが失われたステップ — プレースホルダ表示（保存対象外）
      thumb = document.createElement('div');
      thumb.className = 'step-thumb';
      thumb.style.cssText = 'display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#999;font-size:18px;cursor:default;';
      thumb.textContent = '📷✕';
      thumb.title = t('imageLostStep');
    }

    const topRow = document.createElement('div');
    topRow.className = 'step-item-top';

    const delBtn = document.createElement('button');
    delBtn.className = 'step-delete';
    delBtn.textContent = '×';
    delBtn.title = t('deleteStep');
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
      descLbl.textContent = t('stepDescLabel');
      const input = document.createElement('input');
      input.className = 'step-label-input';
      input.type = 'text';
      input.name = `step-desc-${i}`;
      input.placeholder = t('stepDescPlaceholder');
      input.value = step.label || '';
      input.addEventListener('input', (e) => { step.label = e.target.value; syncSteps(); });
      const genBtn = document.createElement('button');
      genBtn.className = 'step-gen-btn';
      genBtn.textContent = t('aiGenBtn');
      genBtn.title = t('aiGenTitle');
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
      memoLbl.textContent = t('stepMemoLabel');
      const memoInput = document.createElement('input');
      memoInput.className = 'step-memo-input';
      memoInput.type = 'text';
      memoInput.name = `step-memo-${i}`;
      memoInput.placeholder = t('stepMemoPlaceholder');
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
      titleLbl.textContent = t('stepTitleLabel');
      const input = document.createElement('input');
      input.className = 'step-label-input';
      input.type = 'text';
      input.name = `step-title-${i}`;
      input.placeholder = t('stepTitlePlaceholder');
      input.value = step.label || '';
      input.addEventListener('input', (e) => { step.label = e.target.value; syncSteps(); });
      titleRow.appendChild(titleLbl);
      titleRow.appendChild(input);
      fields.appendChild(titleRow);

      const memoRow = document.createElement('div');
      memoRow.className = 'step-field-row';
      const memoLbl = document.createElement('span');
      memoLbl.className = 'step-field-label';
      memoLbl.textContent = t('stepMemoLabel');
      const memoInput = document.createElement('input');
      memoInput.className = 'step-memo-input';
      memoInput.type = 'text';
      memoInput.name = `step-memo-${i}`;
      memoInput.placeholder = t('stepMemoPlaceholder');
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
    const srcUrl = step.annotatedDataUrl || step.rawDataUrl;
    if (!srcUrl) { reject(new Error(t('noImageData'))); return; }
    const img = new Image();
    img.onerror = () => reject(new Error(t('imageLoadFailed')));
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


function getStepPrompt() {
  const isJa = document.documentElement.lang === 'ja';
  return isJa
    ? 'This screenshot shows one step in a web operation. A red circle marks the exact point of interaction. Write ONE short sentence in Japanese describing the action at the red circle. Use dictionary form (e.g. 「〜をクリック。」「〜に入力。」「〜を選択。」) — not 丁寧語. Include button/link/field names near the red circle if visible. Return ONLY the sentence.'
    : 'This screenshot shows one step in a web operation. A red circle marks the exact point of interaction. Write ONE short sentence in English describing the action at the red circle. Use imperative form (e.g. "Click the button", "Enter the value", "Select the option"). Include button/link/field names near the red circle if visible. Return ONLY the sentence.';
}

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
  btn.textContent = t('generating');
  try {
    const cropped = await cropStep(step);
    const parts = [
      { text: getStepPrompt() + buildStepContext(step) },
      { inline_data: { mime_type: 'image/jpeg', data: cropped.split(',')[1] } },
    ];
    const text = await callGeminiProxy(parts);
    step.label = text.trim();
    if (input) input.value = step.label;
    syncSteps();
    updateAiUI();
  } catch (e) {
    showMsg(t('aiFailed', [e.message]), 'error');
  }
  btn.disabled = false;
  btn.textContent = t('aiGenBtn');
}

async function generateManual() {
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
    bulkGenBtn.textContent = t('bulkGenBtn');
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
      ? t('generatingPartial', [String(sendCount), String(total), String(remaining)])
      : t('generatingAll', [String(total)]);

    const token = state.googleToken || await getGoogleToken(false);
    const locale = document.documentElement.lang || 'ja';
    const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_token: token, images, hints, pageTitle: pageTitle.value || '', locale }),
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
      ? t('aiGeneratedPartial', [String(generated), String(total - sendCount)])
      : t('aiGeneratedN', [String(generated), String(total)]);
    showMsg(msg, 'success');
  } catch (e) {
    showMsg(t('aiFailed', [e.message]), 'error');
  }

  bulkGenBtn.disabled = false;
  bulkGenBtn.classList.remove('loading');
  bulkGenBtn.textContent = t('bulkGenBtn');
}

function exportPdf() {
  const title = pageTitle.value || `${t('pdfDefaultTitle')} ${new Date().toLocaleDateString(chrome.i18n.getUILanguage())}`;
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
  saveBtn.textContent = t('saving');

  chrome.runtime.sendMessage(
    { type: 'SAVE_TO_NOTION', notionPageId: pageDestSelect.value || null, title: pageTitle.value, steps: state.steps },
    async (resp) => {
      saveBtn.disabled = false;
      saveBtn.textContent = t('saveBtn');
      if (resp?.error) {
        showMsg(resp.error, 'error');
      } else if (resp?.success) {
        showMsg(resp.warning ? resp.warning : t('savedToNotion'), resp.warning ? 'error' : 'success');
        if (!resp.warning) {
          state.steps = [];
          state.isRecording = false;
          pageTitle.value = '';
          stopAndStopContent();
          renderSteps();
          updateRecordUI();
        }
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
    usageText.textContent = t('usageText', [String(used), String(limit)]);
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
