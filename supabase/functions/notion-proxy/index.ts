import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const NOTION_CLIENT_ID = Deno.env.get('NOTION_CLIENT_ID')!;
const NOTION_CLIENT_SECRET = Deno.env.get('NOTION_CLIENT_SECRET')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  try {
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return json({ error: 'missing params' }, 400);
    }

    const credentials = btoa(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`);
    const res = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri }),
    });

    const data = await res.json();
    if (!res.ok) return json({ error: data.error ?? 'notion token exchange failed' }, 400);

    return json({
      access_token: data.access_token,
      workspace_id: data.workspace_id,
      workspace_name: data.workspace_name,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
