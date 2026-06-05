/**
 * Notion API operations — ported from extension/background.js saveToNotion().
 */
const { CONFIG, PLAN_LIMITS } = require('../shared/config');
const store = require('./store');

const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

const NOTION_ERROR_MAP = {
  unauthorized: 'Notionの認証が切れています。再接続してください。',
  restricted_resource: 'このページへのアクセス権がありません。',
  object_not_found: 'ページが見つかりません。',
  rate_limited: 'Notionのレート制限に達しました。しばらくしてから再試行してください。',
  validation_error: 'データの形式が無効です。',
};

function notionErrorMsg(err, status) {
  if (err?.code && NOTION_ERROR_MAP[err.code]) return NOTION_ERROR_MAP[err.code];
  if (err?.message) return `Notionエラー: ${err.message}`;
  return `Notionへの接続に失敗しました（HTTP ${status}）`;
}

function notionHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  };
}

async function createNotionPage(token, title) {
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
}

async function createNotionPageUnder(token, parentPageId, title) {
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: notionHeaders(token),
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: parentPageId },
      properties: { title: { title: [{ type: 'text', text: { content: title } }] } },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: notionErrorMsg(err, res.status) };
  }
  return res.json();
}

async function getExistingStepCount(token, pageId) {
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
      headers: notionHeaders(token),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.results ?? []).filter(b => b.type === 'heading_3').length;
  } catch {
    return 0;
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

async function uploadToSupabase(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const isJpeg = header.includes('jpeg');
  const bytes = Buffer.from(b64, 'base64');
  const ext = isJpeg ? 'jpg' : 'png';
  const contentType = isJpeg ? 'image/jpeg' : 'image/png';
  const filename = `screenshots/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/annotations/${filename}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': contentType,
    },
    body: bytes,
  });

  if (!res.ok) {
    console.error('[Supabase] upload failed:', res.status, await res.text());
    return null;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/annotations/${filename}`;
}

async function incrementScreenshotCount(count, googleToken) {
  const currentCount = store.get('monthly_screenshots', 0);
  store.set('monthly_screenshots', currentCount + count);

  if (googleToken) {
    fetch(`${SUPABASE_URL}/functions/v1/record-screenshots`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_token: googleToken, count }),
    }).catch(() => {});
  }
}

/**
 * Save manual steps to Notion. Mirrors background.js saveToNotion().
 *
 * @param {object} args
 * @param {string|null} args.notionPageId  — existing page ID, or null to create new
 * @param {string}      args.title         — page title
 * @param {Array}       args.stepsToSave   — step objects with annotatedDataUrl, label, memo
 * @param {string|null} args.googleToken   — for screenshot count recording
 * @param {string}      args.plan          — 'free'|'standard'|'pro'
 * @param {number}      args.monthlyScreenshots — current month count
 */
async function saveToNotion({ notionPageId, title, stepsToSave, googleToken, plan, monthlyScreenshots, recordingDurationSec }) {
  const notionToken = store.get('notion_access_token');
  if (!notionToken) return { error: 'Notion未接続' };

  const limit = PLAN_LIMITS[plan]?.screenshots_per_month ?? 20;
  if (limit !== Infinity && monthlyScreenshots + stepsToSave.length > limit) {
    const remaining = Math.max(0, limit - monthlyScreenshots);
    return { error: `フリープランの上限(${limit}枚/月)に達します。残り${remaining}枚です。アップグレードしてください。` };
  }

  // Server-side re-check for free plan
  if (plan === 'free' && googleToken) {
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
          return { error: `フリープランの上限(20枚/月)に達します。残り${Math.max(0, 20 - serverCount)}枚です。アップグレードしてください。` };
        }
      }
    } catch { /* network error — use local count */ }
  }

  const fallbackTitle = `Manual ${new Date().toLocaleDateString('en-US')}`;
  const usedTitle = title || fallbackTitle;
  let notionPage;
  if (notionPageId && title) {
    notionPage = await createNotionPageUnder(notionToken, notionPageId, title);
  } else if (notionPageId) {
    notionPage = { id: notionPageId };
  } else {
    notionPage = await createNotionPage(notionToken, title || fallbackTitle);
  }

  if (notionPage.error) return notionPage;
  const isExistingPage = !!notionPageId && !title;

  // 既存ページへの追記時、現在のステップ数を取得して番号を続ける
  const stepOffset = isExistingPage ? await getExistingStepCount(notionToken, notionPage.id) : 0;

  // 全画像を並列アップロード
  const imageUrls = await Promise.all(
    stepsToSave.map(step => uploadToSupabase(step.annotatedDataUrl))
  );

  // 全ブロックを一括構築
  let savedCount = 0;
  let failedCount = 0;
  const allBlocks = [];

  stepsToSave.forEach((step, i) => {
    const imageUrl = imageUrls[i];
    if (!imageUrl) { failedCount++; return; }

    const displayNumber = stepOffset + step.stepNumber;
    const headingText = step.label || `Step ${displayNumber}`;

    if (headingText) {
      allBlocks.push({
        object: 'block', type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: headingText } }] },
      });
    }
    allBlocks.push({
      object: 'block', type: 'image',
      image: { type: 'external', external: { url: imageUrl } },
    });
    if (step.memo) {
      allBlocks.push({
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: step.memo } }] },
      });
    }
    savedCount++;
  });

  // Notion API は1リクエスト最大100ブロック → 100件ずつ送信
  for (let i = 0; i < allBlocks.length; i += 100) {
    try {
      await appendNotionBlocks(notionToken, notionPage.id, allBlocks.slice(i, i + 100));
    } catch (e) {
      console.error('[Notion] block append failed:', e.message);
      const chunkSize = Math.min(100, allBlocks.length - i);
      failedCount += chunkSize;
      savedCount -= chunkSize;
    }
  }

  await incrementScreenshotCount(savedCount, googleToken);

  // Record manual (fire-and-forget)
  if (googleToken) {
    const notionPageUrl = `https://notion.so/${notionPage.id.replace(/-/g, '')}`;
    const wsId = store.get('notion_active_workspace_id', null);
    fetch(`${SUPABASE_URL}/functions/v1/record-manual`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        google_token: googleToken,
        title: usedTitle,
        step_count: stepsToSave.length,
        notion_page_url: notionPageUrl,
        notion_workspace_id: wsId,
        recording_duration_sec: recordingDurationSec ?? null,
        source: 'desktop',
      }),
    }).catch(() => {});
  }

  const notionPageUrl = `https://notion.so/${notionPage.id.replace(/-/g, '')}`;

  if (failedCount > 0 && savedCount === 0) {
    return { error: `Notionへの保存に失敗しました（${failedCount}件）` };
  }
  if (failedCount > 0) {
    return { success: true, warning: `${savedCount}件保存しました（${failedCount}件失敗）`, notionPageUrl };
  }
  return { success: true, notionPageUrl };
}

module.exports = { saveToNotion };
