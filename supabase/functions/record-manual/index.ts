import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    if (!body.google_token) return json({ error: 'google_token required' }, 400);

    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${body.google_token}` },
    });
    if (!gRes.ok) return json({ error: 'invalid google token' }, 401);
    const { sub: google_id } = await gRes.json();
    if (!google_id) return json({ error: 'google_id missing' }, 401);

    // steps_json: ステップ詳細（MCP連携・自動実行の基盤）。巨大ペイロードはガード
    let steps_json = null;
    if (body.steps_json && Array.isArray(body.steps_json.steps)) {
      const steps = body.steps_json.steps.slice(0, 200);
      const serialized = JSON.stringify({ steps });
      if (serialized.length <= 1_000_000) {
        steps_json = { steps };
      }
    }

    const { data, error } = await supabase.from('manuals').insert({
      google_id,
      title: body.title ?? '無題のマニュアル',
      step_count: body.step_count ?? 0,
      notion_page_url: body.notion_page_url ?? null,
      notion_workspace_id: body.notion_workspace_id ?? null,
      page_domain: body.page_domain ?? null,
      recording_duration_sec: body.recording_duration_sec ?? null,
      source: body.source ?? 'extension',
      steps_json,
    }).select('id').single();

    if (error) return json({ error: error.message }, 500);

    // 初回マニュアル作成日時を記録（first_record_at が未設定の場合のみ）
    await supabase.from('users')
      .update({ first_record_at: new Date().toISOString() })
      .eq('google_id', google_id)
      .is('first_record_at', null);

    return json({ ok: true, id: data.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
