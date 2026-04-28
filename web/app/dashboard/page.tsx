'use client';

import { useEffect, useState } from 'react';
import { supabase, SUPABASE_FUNCTIONS_URL, type UserProfile, type Invoice, type Manual, type UsageHistory, type NotionWorkspace } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

const STRIPE_STANDARD_PRICE_ID = 'price_1TO5CS1zfFhRe5YPzWfAYSpa';
const STRIPE_PRO_PRICE_ID      = 'price_1TN4YS1zfFhRe5YP6ZLFX9qq';
const CUSTOMER_PORTAL_URL      = 'https://billing.stripe.com/p/login/28EbIT8sHfD0bk70vS5gc00';

const NOTION_CLIENT_ID = '345d872b-594c-810c-9c3d-00376d7425b3';
const NOTION_PROXY_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notion-proxy`;
const WEB_NOTION_REDIRECT_URI = 'https://chrome-manual-maker.s-tasklog.com/auth/notion-callback';

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [proUpgradeConfirm, setProUpgradeConfirm] = useState(false);
  const [downgradeConfirm, setDowngradeConfirm] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelAt, setCancelAt] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [notionConnecting, setNotionConnecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const notionCode = params.get('notion_code');

    if (code) {
      window.history.replaceState({}, '', window.location.pathname);
      supabase.auth.exchangeCodeForSession(code).then(({ data }) => {
        if (data.session) {
          setSession(data.session);
          fetchProfile(data.session);
        } else {
          setLoading(false);
        }
      });
      return;
    }

    if (notionCode) {
      window.history.replaceState({}, '', window.location.pathname);
      supabase.auth.getSession().then(async ({ data }) => {
        if (data.session) {
          setSession(data.session);
          await handleNotionCode(notionCode, data.session);
          await fetchProfile(data.session);
        } else {
          setLoading(false);
        }
      });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) fetchProfile(data.session);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) fetchProfile(s);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(s: Session) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      };
      const body = JSON.stringify({ supabase_token: s.access_token });
      const [profileRes, invoicesRes] = await Promise.all([
        fetch(`${SUPABASE_FUNCTIONS_URL}/auth-user`, { method: 'POST', headers, body }),
        fetch(`${SUPABASE_FUNCTIONS_URL}/get-invoices`, { method: 'POST', headers, body }),
      ]);
      const profileData = await profileRes.json();
      if (profileRes.ok) setProfile(profileData);
      const invoicesData = await invoicesRes.json();
      if (invoicesRes.ok && invoicesData.invoices) setInvoices(invoicesData.invoices);
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function upgradeToPro() {
    if (!session?.access_token) return;
    setProUpgradeConfirm(false);
    setCheckoutLoading(STRIPE_PRO_PRICE_ID);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/upgrade-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          supabase_token: session.access_token,
          new_price_id: STRIPE_PRO_PRICE_ID,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) => prev ? { ...prev, plan: 'pro', ai_calls_limit: 500 } : prev);
        setMsg('Proプランにアップグレードしました！AI生成が500回/月になりました。');
      } else {
        setMsg('エラーが発生しました: ' + (data.error ?? '不明なエラー'));
      }
    } finally {
      setCheckoutLoading('');
    }
  }

  async function downgradeToStandard() {
    if (!session?.access_token) return;
    setDowngradeConfirm(false);
    setCheckoutLoading(STRIPE_STANDARD_PRICE_ID);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/upgrade-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          supabase_token: session.access_token,
          new_price_id: STRIPE_STANDARD_PRICE_ID,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) => prev ? { ...prev, plan: 'standard', ai_calls_limit: 100 } : prev);
        setMsg('Standardプランにダウングレードしました。');
      } else {
        setMsg('エラーが発生しました: ' + (data.error ?? '不明なエラー'));
      }
    } finally {
      setCheckoutLoading('');
    }
  }

  async function cancelSubscription() {
    if (!session?.access_token) return;
    setCancelConfirm(false);
    setCheckoutLoading('cancel');
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ supabase_token: session.access_token }),
      });
      const data = await res.json();
      if (data.success) {
        const cancelDate = data.cancel_at
          ? new Date(data.cancel_at * 1000).toLocaleDateString('ja-JP')
          : null;
        setCancelAt(cancelDate);
        setMsg(cancelDate
          ? `${cancelDate} にサブスクリプションが終了します。それまでは現在のプランをご利用いただけます。`
          : 'サブスクリプションの解約を受け付けました。');
      } else {
        setMsg('エラーが発生しました: ' + (data.error ?? '不明なエラー'));
      }
    } finally {
      setCheckoutLoading('');
    }
  }

  async function startCheckout(priceId: string) {
    if (!session?.access_token) return;
    setCheckoutLoading(priceId);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          supabase_token: session.access_token,
          price_id: priceId,
          success_url: `${location.origin}/success`,
          cancel_url: `${location.origin}/pricing`,
        }),
      });
      const data = await res.json();
      if (data.url) location.href = data.url;
    } finally {
      setCheckoutLoading('');
    }
  }

  async function handleNotionCode(code: string, s: Session) {
    setNotionConnecting(true);
    try {
      const redirectUri = WEB_NOTION_REDIRECT_URI;
      const proxyRes = await fetch(NOTION_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      });
      const data = await proxyRes.json();
      if (data.error || !data.access_token) {
        setMsg('Notion 接続に失敗しました: ' + (data.error ?? 'access_token missing'));
        return;
      }

      const workspaceName = data.workspace_name || 'Notion';
      const workspaceId = data.workspace_id || crypto.randomUUID();

      await fetch(`${SUPABASE_FUNCTIONS_URL}/sync-workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          supabase_token: s.access_token,
          mode: 'add',
          workspaces: [{ id: workspaceId, name: workspaceName, token: data.access_token }],
        }),
      });

      setMsg(`${workspaceName} を接続しました。`);
    } catch {
      setMsg('Notion 接続中にエラーが発生しました。');
    } finally {
      setNotionConnecting(false);
    }
  }

  function connectNotion(s: Session, plan: string, currentWsCount: number) {
    const maxWs = plan === 'pro' ? 3 : 1;
    if (currentWsCount >= maxWs) {
      setMsg(`このプランでは最大 ${maxWs} ワークスペースまで接続できます。`);
      return;
    }
    const redirectUri = encodeURIComponent(WEB_NOTION_REDIRECT_URI);
    location.href = `https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${redirectUri}`;
  }

  async function disconnectWorkspace(workspaceId: string) {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/disconnect-workspace`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ supabase_token: session.access_token, workspace_id: workspaceId }),
      });
      if (res.ok) {
        setProfile((prev) => prev ? {
          ...prev,
          workspaces: prev.workspaces.filter((w) => w.workspace_id !== workspaceId),
        } : prev);
      }
    } catch { /* ignore */ }
  }

  async function deleteManual(manualId: string) {
    if (!session?.access_token) return;
    try {
      await fetch(`${SUPABASE_FUNCTIONS_URL}/delete-manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ supabase_token: session.access_token, manual_id: manualId }),
      });
      setProfile((prev) => prev ? {
        ...prev,
        manuals: prev.manuals.filter((m) => m.id !== manualId),
      } : prev);
    } catch { /* fire-and-forget on error */ }
  }

  async function deleteAccount() {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ supabase_token: session.access_token }),
      });
      if (res.ok) {
        await supabase.auth.signOut();
        setMsg('アカウントを削除しました。');
      } else {
        setMsg('削除に失敗しました。しばらくしてから再試行してください。');
      }
    } catch {
      setMsg('通信エラーが発生しました。');
    }
    setDeleteConfirm(false);
  }

  function fmtResetDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function fmtInvoiceDate(unix: number): string {
    const d = new Date(unix * 1000);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function fmtAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
  }

  const planLabel: Record<string, { label: string; emoji: string }> = {
    free:     { label: 'Free',     emoji: '🌱' },
    standard: { label: 'Standard', emoji: '⚡' },
    pro:      { label: 'Pro',      emoji: '🚀' },
  };
  const screenshotLimit = profile?.plan === 'free' ? 20 : null;
  const screenshotPct = screenshotLimit
    ? Math.min(((profile?.monthly_screenshots ?? 0) / screenshotLimit) * 100, 100)
    : 0;
  const aiPct = profile?.ai_calls_limit
    ? Math.min(((profile?.ai_calls_used ?? 0) / profile.ai_calls_limit) * 100, 100)
    : 0;
  const planInfo = planLabel[profile?.plan ?? 'free'];

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center text-n-400 text-sm">
        読み込み中…
      </div>
    );
  }

  /* ── Not signed in ── */
  if (!session) {
    return (
      <div className="max-w-sm mx-auto px-6 py-32 text-center">
        <div className="text-5xl mb-4">👤</div>
        <h1 className="text-xl font-bold text-n-900 mb-2">マイページ</h1>
        <p className="text-n-500 text-sm mb-8 leading-relaxed">
          利用状況の確認やプラン管理は<br />Google アカウントでログインしてください。
        </p>
        <button
          onClick={signIn}
          className="inline-flex items-center gap-2.5 bg-white border border-n-200 px-5 py-2.5 rounded-notion font-medium text-sm text-n-900 shadow-notion hover:shadow-notion-md hover:border-n-300 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.015 17.64 11.707 17.64 9.2z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          Google でログイン
        </button>
      </div>
    );
  }

  /* ── Dashboard ── */
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-bold text-n-900">マイページ</h1>
          <p className="text-sm text-n-500 mt-0.5">{session.user.email}</p>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-n-500 border border-n-200 px-3 py-1.5 rounded-notion hover:bg-n-50 hover:border-n-300 transition-colors"
        >
          ログアウト
        </button>
      </div>

      {/* Success message */}
      {msg && (
        <div className="mb-5 flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          <span className="flex-shrink-0">✓</span>
          {msg}
        </div>
      )}

      {/* Plan card */}
      <div className="bg-white border border-n-200 rounded-xl shadow-notion p-5 sm:p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{planInfo.emoji}</span>
            <div>
              <p className="text-xs text-n-500 mb-0.5">現在のプラン</p>
              <p className="text-lg font-bold text-n-900">{planInfo.label}</p>
            </div>
          </div>
          {profile?.plan !== 'free' && cancelAt && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-notion">
              {cancelAt} に終了予定
            </span>
          )}
        </div>

        {/* Screenshot usage (Free only) */}
        {profile?.plan === 'free' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-n-500 mb-1.5">
              <span>スクリーンショット</span>
              <span className="flex items-center gap-2">
                <span>{profile.monthly_screenshots} / 20 枚</span>
                {profile.screenshot_reset_at && (
                  <span className="text-n-400">· {fmtResetDate(profile.screenshot_reset_at)}リセット</span>
                )}
              </span>
            </div>
            <div className="h-1.5 bg-n-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{ width: `${screenshotPct}%` }}
              />
            </div>
          </div>
        )}

        {/* AI usage (paid only) */}
        {profile && profile.ai_calls_limit > 0 && (
          <div>
            <div className="flex justify-between text-xs text-n-500 mb-1.5">
              <span>AI生成</span>
              <span className="flex items-center gap-2">
                <span>{profile.ai_calls_used} / {profile.ai_calls_limit} 回</span>
                {profile.ai_calls_reset_at && (
                  <span className="text-n-400">· {fmtResetDate(profile.ai_calls_reset_at)}リセット</span>
                )}
              </span>
            </div>
            <div className="h-1.5 bg-n-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${aiPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Free → Upgrade */}
      {profile?.plan === 'free' && (
        <div className="bg-n-50 border border-n-200 rounded-xl p-5 sm:p-6 mb-4">
          <p className="font-semibold text-n-900 mb-1">プランをアップグレード</p>
          <p className="text-sm text-n-500 mb-4">14日間無料トライアル。いつでもキャンセル可能。</p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => startCheckout(STRIPE_STANDARD_PRICE_ID)}
              disabled={!!checkoutLoading}
              className="text-sm font-semibold px-4 py-2 rounded-notion border border-n-200 bg-white text-n-700 hover:bg-n-50 hover:border-n-300 disabled:opacity-50 transition-colors shadow-notion"
            >
              {checkoutLoading === STRIPE_STANDARD_PRICE_ID ? '処理中…' : '⚡ Standard ¥500/月'}
            </button>
            <button
              onClick={() => startCheckout(STRIPE_PRO_PRICE_ID)}
              disabled={!!checkoutLoading}
              className="text-sm font-semibold px-4 py-2 rounded-notion bg-brand text-white hover:bg-red-600 disabled:opacity-50 transition-colors shadow-notion"
            >
              {checkoutLoading === STRIPE_PRO_PRICE_ID ? '処理中…' : '🚀 Pro ¥1,200/月'}
            </button>
          </div>
        </div>
      )}

      {/* Standard → Pro */}
      {profile?.plan === 'standard' && (
        <div className="bg-n-50 border border-n-200 rounded-xl p-5 sm:p-6 mb-4">
          <p className="font-semibold text-n-900 mb-1">🚀 Pro にアップグレード</p>
          <p className="text-sm text-n-500 mb-4">AI生成 500回/月・ワークスペース3つ。</p>
          {!proUpgradeConfirm ? (
            <button
              onClick={() => setProUpgradeConfirm(true)}
              disabled={!!checkoutLoading}
              className="text-sm font-semibold px-4 py-2 rounded-notion bg-brand text-white hover:bg-red-600 disabled:opacity-50 transition-colors shadow-notion"
            >
              Pro ¥1,200/月 にアップグレード
            </button>
          ) : (
            <div className="bg-white border border-n-200 rounded-xl p-4">
              <p className="text-sm font-medium text-n-900 mb-1">Pro プランへの変更を確認</p>
              <p className="text-xs text-n-500 mb-4 leading-relaxed">
                月額 <span className="font-semibold text-n-900">¥1,200</span> に変更されます。
                差額は本日分から日割りで請求されます。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={upgradeToPro}
                  disabled={!!checkoutLoading}
                  className="text-sm font-semibold px-4 py-2 rounded-notion bg-brand text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {checkoutLoading === STRIPE_PRO_PRICE_ID ? '処理中…' : '確定する'}
                </button>
                <button
                  onClick={() => setProUpgradeConfirm(false)}
                  disabled={!!checkoutLoading}
                  className="text-sm px-4 py-2 rounded-notion border border-n-200 text-n-600 hover:bg-n-100 disabled:opacity-50 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pro → Standard ダウングレード */}
      {profile?.plan === 'pro' && !cancelAt && (
        <div className="bg-n-50 border border-n-200 rounded-xl p-5 sm:p-6 mb-4">
          <p className="font-semibold text-n-900 mb-1">Standard にダウングレード</p>
          <p className="text-sm text-n-500 mb-4">AI生成 100回/月・ワークスペース1つ。差額は日割りで返金されます。</p>
          {!downgradeConfirm ? (
            <button
              onClick={() => setDowngradeConfirm(true)}
              disabled={!!checkoutLoading}
              className="text-sm px-4 py-2 rounded-notion border border-n-200 bg-white text-n-700 hover:bg-n-50 disabled:opacity-50 transition-colors"
            >
              Standard ¥500/月 にダウングレード
            </button>
          ) : (
            <div className="bg-white border border-n-200 rounded-xl p-4">
              <p className="text-sm font-medium text-n-900 mb-1">ダウングレードを確認</p>
              <p className="text-xs text-n-500 mb-4 leading-relaxed">
                月額 <span className="font-semibold text-n-900">¥500</span> に変更されます。
                ワークスペースが1つに制限され、AI生成は100回/月になります。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={downgradeToStandard}
                  disabled={!!checkoutLoading}
                  className="text-sm font-semibold px-4 py-2 rounded-notion bg-n-800 text-white hover:bg-n-900 disabled:opacity-50 transition-colors"
                >
                  {checkoutLoading === STRIPE_STANDARD_PRICE_ID ? '処理中…' : '確定する'}
                </button>
                <button
                  onClick={() => setDowngradeConfirm(false)}
                  disabled={!!checkoutLoading}
                  className="text-sm px-4 py-2 rounded-notion border border-n-200 text-n-600 hover:bg-n-100 disabled:opacity-50 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 解約 */}
      {profile?.plan !== 'free' && !cancelAt && (
        <div className="bg-n-50 border border-n-200 rounded-xl p-5 sm:p-6 mb-4">
          <p className="font-semibold text-n-900 mb-1">サブスクリプションを解約</p>
          <p className="text-sm text-n-500 mb-4">解約後も当月末まではご利用いただけます。翌月からFreeプランに移行します。</p>
          {!cancelConfirm ? (
            <button
              onClick={() => setCancelConfirm(true)}
              disabled={!!checkoutLoading}
              className="text-sm px-4 py-2 rounded-notion border border-brand/30 text-brand hover:bg-brand/5 disabled:opacity-50 transition-colors"
            >
              解約する
            </button>
          ) : (
            <div className="bg-white border border-brand/20 rounded-xl p-4">
              <p className="text-sm font-medium text-n-900 mb-1">解約を確認</p>
              <p className="text-xs text-n-500 mb-4 leading-relaxed">
                当月末までは現在のプランをご利用いただけます。以降はFreeプラン（スクショ20枚/月）に移行します。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={cancelSubscription}
                  disabled={!!checkoutLoading}
                  className="text-sm font-semibold px-4 py-2 rounded-notion bg-brand text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {checkoutLoading === 'cancel' ? '処理中…' : '解約を確定する'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  disabled={!!checkoutLoading}
                  className="text-sm px-4 py-2 rounded-notion border border-n-200 text-n-600 hover:bg-n-100 disabled:opacity-50 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notion workspaces */}
      {profile && (
        <div className="bg-white border border-n-200 rounded-xl shadow-notion p-5 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-n-900">Notion ワークスペース</p>
            <span className="text-xs text-n-400">
              {profile.workspaces.length} / {profile.plan === 'pro' ? 3 : 1} 接続中
            </span>
          </div>
          {profile.workspaces.length === 0 ? (
            <p className="text-sm text-n-400 mb-3">まだ Notion ワークスペースが接続されていません。</p>
          ) : (
            <ul className="space-y-1 mb-3">
              {profile.workspaces.map((ws: NotionWorkspace) => (
                <li key={ws.workspace_id} className="flex items-center gap-3 py-2 border-b border-n-100 last:border-0">
                  <span className="text-base">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-n-900 truncate">{ws.workspace_name}</p>
                    <p className="text-xs text-n-400">接続: {new Date(ws.connected_at).toLocaleDateString('ja-JP')}</p>
                  </div>
                  <button
                    onClick={() => disconnectWorkspace(ws.workspace_id)}
                    className="text-xs text-n-400 hover:text-brand transition-colors px-1.5 py-1 flex-shrink-0"
                    title="切断"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {profile.workspaces.length < (profile.plan === 'pro' ? 3 : 1) && (
            <button
              onClick={() => connectNotion(session!, profile.plan, profile.workspaces.length)}
              disabled={notionConnecting}
              className="text-sm text-n-700 border border-n-200 px-3 py-1.5 rounded-notion hover:bg-n-50 hover:border-n-300 disabled:opacity-50 transition-colors"
            >
              {notionConnecting ? '接続中…' : '＋ Notion を接続する'}
            </button>
          )}
        </div>
      )}

      {/* Usage history chart */}
      {profile && profile.usage_history.length > 0 && (
        <div className="bg-white border border-n-200 rounded-xl shadow-notion p-5 sm:p-6 mb-4">
          <p className="font-semibold text-n-900 mb-4">使用量グラフ（月別）</p>
          {(() => {
            const history: UsageHistory[] = [...profile.usage_history].reverse();
            const maxShots = Math.max(...history.map(h => h.screenshots), 1);
            const maxAi = Math.max(...history.map(h => h.ai_calls), 1);
            return (
              <div className="flex items-end gap-2 h-24">
                {history.map((h) => {
                  const shotPct = Math.round((h.screenshots / maxShots) * 100);
                  const aiPct = Math.round((h.ai_calls / maxAi) * 100);
                  const [y, m] = h.month.split('-');
                  return (
                    <div key={h.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex gap-0.5 items-end" style={{ height: '72px' }}>
                        <div
                          title={`スクショ ${h.screenshots}枚`}
                          className="flex-1 bg-brand/70 rounded-t-sm transition-all"
                          style={{ height: `${shotPct}%` }}
                        />
                        {h.ai_calls > 0 && (
                          <div
                            title={`AI ${h.ai_calls}回`}
                            className="flex-1 bg-emerald-400/70 rounded-t-sm transition-all"
                            style={{ height: `${aiPct}%` }}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-n-400">{m}月</p>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div className="flex gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-n-500"><span className="w-2.5 h-2.5 rounded-sm bg-brand/70 inline-block" />スクショ</span>
            <span className="flex items-center gap-1.5 text-xs text-n-500"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/70 inline-block" />AI生成</span>
          </div>
        </div>
      )}

      {/* Manuals list */}
      {profile && profile.manuals.length > 0 && (
        <div className="border border-n-200 rounded-xl p-5 sm:p-6 mb-4">
          <p className="font-semibold text-n-900 mb-4">作成したマニュアル</p>
          <div className="space-y-1">
            {profile.manuals.map((m: Manual) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-n-100 last:border-0">
                <span className="text-sm">📋</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-n-900 truncate">{m.title}</p>
                  <p className="text-xs text-n-400 mt-0.5">
                    {m.step_count} ステップ · {new Date(m.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.notion_page_url && (
                    <a
                      href={m.notion_page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-n-500 border border-n-200 px-2.5 py-1 rounded-notion hover:bg-n-50 transition-colors"
                    >
                      Notion
                    </a>
                  )}
                  <button
                    onClick={() => deleteManual(m.id)}
                    className="text-xs text-n-400 hover:text-brand transition-colors px-1.5 py-1"
                    title="削除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Billing history */}
      {invoices.length > 0 && (
        <div className="border border-n-200 rounded-xl p-5 sm:p-6 mb-4">
          <p className="font-semibold text-n-900 mb-4">請求履歴</p>
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-n-100 last:border-0">
                <div>
                  <p className="text-sm text-n-700">{fmtInvoiceDate(inv.period_start)} 〜 {fmtInvoiceDate(inv.period_end)}</p>
                  <p className="text-xs text-n-400 mt-0.5">{fmtInvoiceDate(inv.created)}</p>
                </div>
                <span className={`text-sm font-medium ${inv.status === 'paid' ? 'text-emerald-600' : 'text-n-500'}`}>
                  {fmtAmount(inv.amount_paid, inv.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account deletion */}
      <div className="border border-n-200 rounded-xl p-5 sm:p-6 mt-6">
        <p className="font-semibold text-n-900 mb-1">アカウント削除</p>
        <p className="text-sm text-n-500 mb-4">
          メールアドレスとスクリーンショット画像が削除されます。有料プランをご利用中の場合はサブスクリプションも解約されます。
        </p>
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="text-sm text-brand border border-brand/25 px-4 py-2 rounded-notion hover:bg-brand/5 transition-colors"
          >
            アカウントを削除する
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-brand">本当に削除しますか？</p>
            <button
              onClick={deleteAccount}
              className="text-sm bg-brand text-white px-4 py-2 rounded-notion hover:bg-red-600 transition-colors"
            >
              削除する
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="text-sm text-n-500 border border-n-200 px-4 py-2 rounded-notion hover:bg-n-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
