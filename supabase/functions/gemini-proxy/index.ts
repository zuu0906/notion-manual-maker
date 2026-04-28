import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const PLAN_LIMITS: Record<string, number> = { free: 0, standard: 100, pro: 500, team: 500 };
const GEMINI_MODEL = 'gemini-2.5-flash';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function nextMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
}

async function getVerifiedUser(google_token: string) {
  const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${google_token}` },
  });
  if (!gRes.ok) return null;

  const { sub: google_id } = await gRes.json();
  if (!google_id) return null;

  const { data: user } = await supabase
    .from('users')
    .select('id, plan, ai_calls_used, ai_calls_reset_at')
    .eq('google_id', google_id)
    .single();

  if (!user) return null;

  // 月次リセット（auth-userを経由しない場合もここでリセット）
  if (user.ai_calls_reset_at && new Date() > new Date(user.ai_calls_reset_at)) {
    await supabase.from('users')
      .update({ ai_calls_used: 0, ai_calls_reset_at: nextMonthStart() })
      .eq('id', user.id);
    user.ai_calls_used = 0;
  }

  return user;
}

async function callGemini(parts: unknown[], retries = 3): Promise<string> {
  const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')!;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2 } }),
      }
    );
    const data = await res.json();
    if (res.ok) return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const msg: string = data.error?.message ?? `Gemini error ${res.status}`;
    const isRetryable = res.status === 503 || res.status === 429 || msg.includes('high demand') || msg.includes('overloaded');
    if (!isRetryable || attempt === retries) throw new Error(msg);

    // 指数バックオフ: 1s, 2s, 4s
    await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error('Gemini: max retries exceeded');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { google_token } = body;
    if (!google_token) return json({ error: 'missing params' }, 400);

    const user = await getVerifiedUser(google_token);
    if (!user) return json({ error: '認証失敗' }, 401);

    const plan = user.plan ?? 'free';
    if (plan === 'free') {
      return json({ error: 'AI機能はStandardプラン以上でご利用いただけます' }, 403);
    }

    const limit = PLAN_LIMITS[plan] ?? 0;
    if (user.ai_calls_used >= limit) {
      return json({ error: `月間AI使用回数（${limit}回）に達しました` }, 429);
    }

    // ── バッチモード: images[] が来た場合、全画像を1回のGeminiリクエストで処理 ──
    if (Array.isArray(body.images) && body.images.length > 0) {
      const images: string[] = body.images;
      const hints: string[] = body.hints ?? [];
      const count = images.length;

      if (user.ai_calls_used + count > limit) {
        return json({ error: `月間AI使用回数（${limit}回）に達しました` }, 429);
      }

      const pageTitle = body.pageTitle ? `Page: "${body.pageTitle}". ` : '';
      const BATCH_PROMPT =
        `${pageTitle}You will be shown ${count} screenshot(s) of a web operation flow. ` +
        'For each image, write ONE short sentence in Japanese using dictionary form ' +
        '(e.g. 「〜をクリック。」「〜に入力。」「〜を選択。」) — NOT 丁寧語. ' +
        'Include button/link/field names if visible. ' +
        `Return ONLY a JSON array of ${count} strings in order. Example: ["説明1","説明2"]`;

      const parts: unknown[] = [{ text: BATCH_PROMPT }];
      for (let i = 0; i < count; i++) {
        const hint = hints[i] ? ` ヒント:「${hints[i]}」` : '';
        parts.push({ text: `Step ${i + 1} of ${count}:${hint}` });
        parts.push({ inline_data: { mime_type: 'image/jpeg', data: images[i] } });
      }

      const raw = await callGemini(parts);

      // JSON配列をパース（コードブロックに包まれている場合も対応）
      const match = raw.match(/\[[\s\S]*\]/);
      let results: string[] = [];
      if (match) {
        try { results = JSON.parse(match[0]); } catch (_) { /* fall through */ }
      }
      // パース失敗時は全ステップに同じテキストをフォールバック
      if (!Array.isArray(results) || results.length === 0) {
        results = Array(count).fill(raw.trim());
      }

      await supabase
        .from('users')
        .update({ ai_calls_used: user.ai_calls_used + count })
        .eq('id', user.id);

      return json({ results, ai_calls_used: user.ai_calls_used + count, ai_calls_limit: limit });
    }

    // ── シングルモード（既存：個別ステップ生成） ──
    const { parts } = body;
    if (!parts) return json({ error: 'missing params' }, 400);

    const result = await callGemini(parts);

    await supabase
      .from('users')
      .update({ ai_calls_used: user.ai_calls_used + 1 })
      .eq('id', user.id);

    return json({ result, ai_calls_used: user.ai_calls_used + 1, ai_calls_limit: limit });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
