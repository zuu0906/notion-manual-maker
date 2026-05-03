// Service Worker — スクショ取得・Offscreen canvas呼び出し・Notion送信
import { CONFIG, PLAN_LIMITS } from './shared/config.js';

chrome.action.setBadgeBackgroundColor({ color: '#FF3B30' });

const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

let pendingClicks = [];
let isRecording = false;
let recordingTabId = null;
let clickQueue = Promise.resolve();
let lastCaptureTime = 0;
let recordingStartTime = null;
const MIN_CAPTURE_INTERVAL = 300;

// drawOnOffscreen でのストレージ呼び出しを避けるためのプランキャッシュ
let cachedPlan = 'free';
// 起動時に正確なプランを読み込む。resolveするまで drawOnOffscreen が待機する
const planReadyPromise = chrome.storage.sync.get('plan').then(({ plan }) => {
  cachedPlan = plan ?? 'free';
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.plan) cachedPlan = changes.plan.newValue ?? 'free';
});

restoreSession();

async function restoreSession() {
  const s = await chrome.storage.session.get(['pendingClicks', 'isRecording', 'recordingTabId']);
  if (s.pendingClicks) pendingClicks = s.pendingClicks;
  if (s.isRecording !== undefined) isRecording = s.isRecording;
  if (s.recordingTabId !== undefined) recordingTabId = s.recordingTabId;
}

async function saveSession() {
  await chrome.storage.session.set({ pendingClicks, isRecording, recordingTabId });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === recordingTabId && changeInfo.status === 'complete' && isRecording) {
    setTimeout(() => {
      chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).catch(() => {});
    }, 300);
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.tabId === recordingTabId && details.frameId === 0 && isRecording) {
    setTimeout(() => {
      chrome.scripting.executeScript({ target: { tabId: details.tabId }, files: ['content.js'] }).catch(() => {});
    }, 300);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'START_RECORDING':
      startRecording(sender.tab?.id ?? msg.tabId);
      break;
    case 'CLICK_CAPTURED':
      clickQueue = clickQueue.then(() => handleClick(msg, sender.tab?.id)).catch(e => console.error('[click]', e));
      break;
    case 'RECORDING_STOPPED':
      isRecording = false;
      recordingTabId = null;
      chrome.action.setBadgeText({ text: '' });
      notifyPopup({ type: 'STATE_UPDATE', isRecording: false, steps: pendingClicks });
      saveSession().catch(() => {});
      break;
    case 'SAVE_TO_NOTION':
      saveToNotion(msg.notionPageId, msg.title, msg.steps).then(sendResponse);
      return true;
    case 'CLEAR_STEPS':
      pendingClicks = [];
      clickQueue = Promise.resolve();
      lastCaptureTime = 0;
      chrome.action.setBadgeText({ text: '' });
      notifyPopup({ type: 'STATE_UPDATE', isRecording, steps: [] });
      saveSession().catch(() => {});
      break;
    case 'UPDATE_STEPS':
      pendingClicks = msg.steps ?? [];
      break;
    case 'GET_STATE':
      sendResponse({ isRecording, steps: pendingClicks });
      break;
  }
});

async function startRecording(tabId) {
  isRecording = true;
  recordingTabId = tabId;
  recordingStartTime = Date.now();
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  notifyPopup({ type: 'STATE_UPDATE', isRecording: true, steps: pendingClicks });
}

async function handleClick({ x, y, viewportWidth, viewportHeight, inputText, isPassword, elementHint, formNote = '', piiRegions = [] }, tabId) {
  const now = Date.now();
  const wait = Math.max(100, MIN_CAPTURE_INTERVAL - (now - lastCaptureTime));
  await new Promise(r => setTimeout(r, wait));
  lastCaptureTime = Date.now();

  const stepNumber = pendingClicks.length + 1;
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
  const tab = tabId ? await chrome.tabs.get(tabId) : null;
  const annotated = await drawOnOffscreen(dataUrl, x, y, viewportWidth, viewportHeight, stepNumber, piiRegions);
  if (tabId) chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_DONE', x, y }).catch(() => {});

  pendingClicks.push({
    stepNumber,
    x, y, viewportWidth, viewportHeight,
    rawDataUrl: dataUrl,
    annotatedDataUrl: annotated,
    label: '',
    pageUrl: tab?.url ?? '',
    pageTitle: tab?.title ?? '',
    hasPiiBlur: piiRegions.length > 0,
    elementHint: elementHint || '',
    inputText: isPassword ? null : (inputText || null),
    isPassword: isPassword || false,
    formNote: formNote || '',
  });

  chrome.action.setBadgeText({ text: String(pendingClicks.length) });
  notifyPopup({ type: 'STEP_ADDED', steps: pendingClicks });
  await saveSession();
}

async function drawOnOffscreen(dataUrl, clickX, clickY, viewportWidth, viewportHeight, stepNumber, piiRegions = []) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0);

  const scaleX = imageBitmap.width / viewportWidth;
  const scaleY = imageBitmap.height / viewportHeight;
  const x = clickX * scaleX;
  const y = clickY * scaleY;
  const scale = Math.max(scaleX, scaleY);

  for (const r of piiRegions) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(r.x * scaleX - 2, r.y * scaleY - 2, r.w * scaleX + 4, r.h * scaleY + 4);
  }

  ctx.strokeStyle = '#FF3B30';
  ctx.lineWidth = Math.max(4, Math.round(5 * scale));
  ctx.beginPath();
  ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);
  ctx.stroke();

  const badgeR = 16 * scale;
  const badgeX = x + 22 * scale;
  const badgeY = y - 22 * scale;
  ctx.fillStyle = '#FF3B30';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(stepNumber), badgeX, badgeY + 1);

  // Freeプランのウォーターマーク（起動直後の race condition を避けるため planReady を待つ）
  await planReadyPromise;
  if (cachedPlan === 'free') {
    const wmText = '◆ Chrome Manual Maker';
    const fontSize = Math.round(12 * scale);
    ctx.font = `${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(wmText).width;
    const padX = 10 * scale;
    const padY = 6 * scale;
    const bgW = textWidth + padX * 2;
    const bgH = fontSize + padY * 2;
    const bgX = canvas.width - bgW - 12 * scale;
    const bgY = canvas.height - bgH - 10 * scale;
    const radius = bgH / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgW, bgH, radius);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(wmText, bgX + padX, bgY + bgH / 2);
  }

  const markedBlob = await canvas.convertToBlob({ type: 'image/png' });
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(markedBlob);
  });
}

async function saveToNotion(notionPageId, title, steps) {
  const { notion_access_token, plan, monthly_screenshots } = await getStoredAuth();
  if (!notion_access_token) return { error: 'Notion未接続' };

  const stepsToSave = steps?.length ? steps : pendingClicks;
  const limit = PLAN_LIMITS[plan]?.screenshots_per_month ?? 20;

  if (limit !== Infinity && monthly_screenshots + stepsToSave.length > limit) {
    const remaining = Math.max(0, limit - monthly_screenshots);
    return { error: `フリープランの上限(${limit}枚/月)に達します。残り${remaining}枚です。プランをアップグレードしてください。` };
  }

  // サーバー側でスクショ上限を再検証（Freeプランのみ）
  if (plan === 'free') {
    const { googleToken } = await chrome.storage.session.get('googleToken');
    if (googleToken) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-user`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ google_token: googleToken }),
        });
        if (res.ok) {
          const data = await res.json();
          const serverCount = data.monthly_screenshots ?? 0;
          if (serverCount + stepsToSave.length > 20) {
            const remaining = Math.max(0, 20 - serverCount);
            return { error: `フリープランの上限(20枚/月)に達します。残り${remaining}枚です。プランをアップグレードしてください。` };
          }
        }
      } catch (_) {
        // ネットワークエラー時はローカルチェック結果を優先して続行
      }
    }
  }

  const pageTitle = title || `マニュアル ${new Date().toLocaleDateString('ja-JP')}`;
  const notionPage = notionPageId
    ? { id: notionPageId }
    : await createNotionPage(notion_access_token, pageTitle);

  if (notionPage.error) return notionPage;
  const isExistingPage = !!notionPageId;

  let savedCount = 0;
  let failedCount = 0;
  for (const step of stepsToSave) {
    const imageUrl = await uploadToSupabase(step.annotatedDataUrl);
    if (!imageUrl) { failedCount++; continue; }

    const blocks = [];

    // 見出し: ラベルがあればそれを、なければステップ番号（既存ページは番号なし）
    const headingText = step.label
      ? step.label
      : isExistingPage ? null : `ステップ ${step.stepNumber}`;

    if (headingText) {
      blocks.push({
        object: 'block', type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: headingText } }] },
      });
    }

    blocks.push({
      object: 'block', type: 'image',
      image: { type: 'external', external: { url: imageUrl } },
    });

    if (step.memo) {
      blocks.push({
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: step.memo } }] },
      });
    }

    try {
      await appendNotionBlocks(notion_access_token, notionPage.id, blocks);
      savedCount++;
    } catch (e) {
      failedCount++;
      console.error('[Notion] ブロック追加失敗:', e.message);
    }
  }

  await incrementScreenshotCount(savedCount);

  // マニュアル記録（fire-and-forget）
  const { googleToken } = await chrome.storage.session.get('googleToken');
  const { notion_active_workspace_id } = await chrome.storage.local.get('notion_active_workspace_id');
  const notionPageUrl = `https://notion.so/${notionPage.id.replace(/-/g, '')}`;
  if (googleToken) {
    const page_domain = stepsToSave[0]?.pageUrl ? (() => { try { return new URL(stepsToSave[0].pageUrl).hostname; } catch { return null; } })() : null;
    const recording_duration_sec = recordingStartTime ? Math.round((Date.now() - recordingStartTime) / 1000) : null;
    fetch(`${SUPABASE_URL}/functions/v1/record-manual`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        google_token: googleToken,
        title: pageTitle,
        step_count: stepsToSave.length,
        notion_page_url: notionPageUrl,
        notion_workspace_id: notion_active_workspace_id ?? null,
        page_domain,
        recording_duration_sec,
      }),
    }).catch(() => {});
  }

  pendingClicks = [];
  isRecording = false;
  recordingTabId = null;
  chrome.action.setBadgeText({ text: '' });
  await saveSession();

  if (failedCount > 0 && savedCount === 0) {
    return { error: `Notionへの保存に失敗しました（${failedCount}件）` };
  }
  if (failedCount > 0) {
    return { success: true, url: notionPageUrl, warning: `${savedCount}件保存しました（${failedCount}件失敗）` };
  }
  return { success: true, url: notionPageUrl };
}

const NOTION_ERROR_MAP = {
  unauthorized: 'Notionの認証が切れています。拡張機能から再接続してください。',
  restricted_resource: 'このページへのアクセス権がありません。',
  object_not_found: 'ページが見つかりません。',
  rate_limited: 'Notionのレート制限に達しました。しばらくしてから再試行してください。',
  validation_error: 'データの形式が無効です。',
};

function notionErrorMsg(err, fallbackStatus) {
  const code = err?.code ?? '';
  if (NOTION_ERROR_MAP[code]) return NOTION_ERROR_MAP[code];
  if (err?.message) return `Notionエラー: ${err.message}`;
  return `Notionへの接続に失敗しました（HTTP ${fallbackStatus}）`;
}

async function createNotionPage(token, title) {
  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { type: 'workspace', workspace: true },
        properties: { title: { title: [{ type: 'text', text: { content: title } }] } },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: notionErrorMsg(err, res.status) };
    }
    return res.json();
  } catch (e) {
    return { error: `ネットワークエラー: ${e.message}` };
  }
}

async function appendNotionBlocks(token, pageId, children) {
  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers: notionHeaders(token),
    body: JSON.stringify({ children }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(notionErrorMsg(err, res.status));
  }
}

function notionHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  };
}

async function uploadToSupabase(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  const filename = `screenshots/${Date.now()}_${Math.random().toString(36).slice(2)}.png`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/annotations/${filename}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'image/png',
    },
    body: blob,
  });

  if (!res.ok) {
    console.error('[Supabase] upload failed:', res.status, await res.text());
    return null;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/annotations/${filename}`;
}

function dataUrlToBlob(dataUrl) {
  const [, b64] = dataUrl.split(',');
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: 'image/png' });
}

async function getStoredAuth() {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(['plan', 'monthly_screenshots']),
    chrome.storage.local.get('notion_access_token'),
  ]);
  cachedPlan = syncData.plan ?? 'free';
  return {
    notion_access_token: localData.notion_access_token ?? null,
    plan: cachedPlan,
    monthly_screenshots: syncData.monthly_screenshots ?? 0,
  };
}

async function incrementScreenshotCount(count) {
  const { monthly_screenshots = 0 } = await chrome.storage.sync.get('monthly_screenshots');
  const newCount = monthly_screenshots + count;
  await chrome.storage.sync.set({ monthly_screenshots: newCount });

  // DB側も更新（ポップアップを再開した際に0リセットされないよう）
  const { googleToken } = await chrome.storage.session.get('googleToken');
  if (googleToken) {
    fetch(`${SUPABASE_URL}/functions/v1/record-screenshots`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_token: googleToken, count }),
    }).catch(() => {});
  }
}

function notifyPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}
