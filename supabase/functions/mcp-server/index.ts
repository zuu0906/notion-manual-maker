// MCP (Model Context Protocol) サーバー — Streamable HTTP Transport
// Claude Desktop 等のMCPクライアントから、ユーザー自身のマニュアルを参照できるようにする。
// 認証: mcp_api_keys のAPIキー（Bearer mcp_...）。Pro以上のプランのみ利用可。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, x-mcp-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const PROTOCOL_VERSION = '2024-11-05';
const ALLOWED_PLANS = ['pro', 'team'];

const TOOLS = [
  {
    name: 'list_manuals',
    description: 'あなたが作成した操作マニュアルの一覧を取得します。対象サービスのドメインで絞り込みできます。',
    inputSchema: {
      type: 'object',
      properties: {
        domain_filter: { type: 'string', description: '対象サービスのドメイン（例: app.freee.co.jp）で部分一致絞り込み' },
      },
    },
  },
  {
    name: 'search_manual',
    description: '操作マニュアルをキーワードで検索し、該当する手順を見つけます。「経費精算のやり方」のような質問に答える際に使います。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '検索キーワード（例: 経費精算、請求書）' },
        page_domain: { type: 'string', description: '対象サービスのドメインで絞り込み（任意）' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_manual_steps',
    description: '特定のマニュアルの詳細なステップ（操作手順）を取得します。include_screenshots を true にするとスクリーンショットURLも返します。',
    inputSchema: {
      type: 'object',
      properties: {
        manual_id: { type: 'string', description: 'マニュアルのID（list_manuals / search_manual で取得）' },
        include_screenshots: { type: 'boolean', description: 'スクリーンショット画像URLを含めるか（デフォルト false）' },
      },
      required: ['manual_id'],
    },
  },
];

function rpc(id: unknown, payload: { result?: unknown; error?: { code: number; message: string } }, status = 200) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, ...payload }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function toolText(id: unknown, data: unknown) {
  return rpc(id, { result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] } });
}

function toolError(id: unknown, message: string) {
  return rpc(id, { result: { content: [{ type: 'text', text: message }], isError: true } });
}

// steps_json からテキストを抽出（検索用）
function stepTexts(steps_json: { steps?: Array<Record<string, unknown>> } | null): string[] {
  if (!steps_json?.steps) return [];
  return steps_json.steps.map(s =>
    [s.label, s.memo, s.elementHint, s.pageTitle, s.ocrContext].filter(Boolean).join(' ')
  );
}

function sanitizeSteps(steps_json: { steps?: Array<Record<string, unknown>> } | null, includeScreenshots: boolean) {
  if (!steps_json?.steps) return [];
  return steps_json.steps.map(s => {
    const step: Record<string, unknown> = {
      stepNumber: s.stepNumber,
      label: s.label || null,
      memo: s.memo || null,
      pageUrl: s.pageUrl || null,
      pageTitle: s.pageTitle || null,
      elementHint: s.elementHint || null,
      inputText: s.inputText ?? null,
    };
    if (includeScreenshots) step.screenshotUrl = s.imageUrl ?? null;
    return step;
  });
}

async function handleToolCall(google_id: string, name: string, args: Record<string, unknown>) {
  if (name === 'list_manuals') {
    let q = supabase
      .from('manuals')
      .select('id, title, page_domain, step_count, source, created_at')
      .eq('google_id', google_id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (args.domain_filter) q = q.ilike('page_domain', `%${args.domain_filter}%`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { manuals: data ?? [] };
  }

  if (name === 'search_manual') {
    const query = String(args.query ?? '').trim();
    if (!query) throw new Error('query is required');
    let q = supabase
      .from('manuals')
      .select('id, title, page_domain, step_count, created_at, steps_json')
      .eq('google_id', google_id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (args.page_domain) q = q.ilike('page_domain', `%${args.page_domain}%`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    // v1はインメモリのキーワードマッチ（個人のマニュアル数は小さい）。将来pgvector化
    const terms = query.toLowerCase().split(/[\s、。,]+/).filter(Boolean);
    const scored = (data ?? []).map(m => {
      const title = (m.title ?? '').toLowerCase();
      const texts = stepTexts(m.steps_json);
      let score = 0;
      const matchedSteps: Array<{ stepNumber: number; text: string }> = [];
      for (const term of terms) {
        if (title.includes(term)) score += 10;
        texts.forEach((t, i) => {
          if (t.toLowerCase().includes(term)) {
            score += 2;
            if (matchedSteps.length < 3 && !matchedSteps.some(ms => ms.stepNumber === i + 1)) {
              matchedSteps.push({ stepNumber: i + 1, text: t.slice(0, 120) });
            }
          }
        });
      }
      return { manual: m, score, matchedSteps };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

    return {
      results: scored.map(r => ({
        id: r.manual.id,
        title: r.manual.title,
        page_domain: r.manual.page_domain,
        step_count: r.manual.step_count,
        matched_steps: r.matchedSteps,
        hint: '詳細は get_manual_steps で取得できます',
      })),
    };
  }

  if (name === 'get_manual_steps') {
    const manualId = String(args.manual_id ?? '');
    if (!manualId) throw new Error('manual_id is required');
    const { data, error } = await supabase
      .from('manuals')
      .select('id, title, page_domain, step_count, notion_page_url, created_at, steps_json')
      .eq('google_id', google_id)
      .eq('id', manualId)
      .single();
    if (error || !data) throw new Error('マニュアルが見つかりません');
    return {
      id: data.id,
      title: data.title,
      page_domain: data.page_domain,
      notion_page_url: data.notion_page_url,
      created_at: data.created_at,
      steps: sanitizeSteps(data.steps_json, args.include_screenshots === true),
      note: data.steps_json ? undefined : 'このマニュアルにはステップ詳細が保存されていません（旧バージョンで作成）。Notionページを参照してください。',
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  // APIキー認証 — SupabaseのJWTゲートを通すため Authorization にはanonキーを使い、
  // MCPキーは x-mcp-key ヘッダーで受け取る（Authorization の mcp_ もフォールバックで許容）
  const apiKey = (req.headers.get('x-mcp-key')
    ?? (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')).trim();
  if (!apiKey.startsWith('mcp_')) {
    return new Response(JSON.stringify({ error: 'invalid api key' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
  const { data: keyRow } = await supabase
    .from('mcp_api_keys')
    .select('google_id')
    .eq('key', apiKey)
    .single();
  if (!keyRow) {
    return new Response(JSON.stringify({ error: 'invalid api key' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  // プランチェック（キー発行後にダウングレードした場合もここで弾く）
  const { data: user } = await supabase
    .from('users')
    .select('plan, deleted_at')
    .eq('google_id', keyRow.google_id)
    .single();
  if (!user || user.deleted_at || !ALLOWED_PLANS.includes(user.plan)) {
    return new Response(JSON.stringify({ error: 'MCP連携はProプラン以上で利用できます' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  await supabase.from('mcp_api_keys').update({ last_used_at: new Date().toISOString() }).eq('key', apiKey);

  let body: { id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
  try {
    body = await req.json();
  } catch {
    return rpc(null, { error: { code: -32700, message: 'Parse error' } }, 400);
  }

  const { id, method, params } = body;

  try {
    if (method === 'initialize') {
      return rpc(id, {
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'notion-manual-maker', version: '1.0.0' },
        },
      });
    }

    // 通知（initialized等）には応答ボディ不要
    if (typeof method === 'string' && method.startsWith('notifications/')) {
      return new Response(null, { status: 202, headers: corsHeaders });
    }

    if (method === 'ping') return rpc(id, { result: {} });

    if (method === 'tools/list') return rpc(id, { result: { tools: TOOLS } });

    if (method === 'tools/call') {
      const name = params?.name ?? '';
      const args = params?.arguments ?? {};
      try {
        const data = await handleToolCall(keyRow.google_id, name, args);
        return toolText(id, data);
      } catch (e) {
        return toolError(id, String((e as Error)?.message ?? e));
      }
    }

    return rpc(id, { error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (e) {
    return rpc(id, { error: { code: -32603, message: String((e as Error)?.message ?? e) } }, 500);
  }
});
