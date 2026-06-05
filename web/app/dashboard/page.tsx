'use client';

import { useEffect, useState } from 'react';
import { supabase, SUPABASE_FUNCTIONS_URL, type UserProfile, type Invoice, type Manual, type UsageHistory, type NotionWorkspace } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

const STRIPE_STANDARD_PRICE_ID = 'price_1TeTkw1zfFhRe5YP4sbK4wKa';
const STRIPE_PRO_PRICE_ID      = 'price_1TeTmC1zfFhRe5YPW4ReYraX';
const CUSTOMER_PORTAL_URL      = 'https://billing.stripe.com/p/login/28EbIT8sHfD0bk70vS5gc00';

const NOTION_CLIENT_ID = '345d872b-594c-810c-9c3d-00376d7425b3';
const NOTION_PROXY_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notion-proxy`;
const WEB_NOTION_REDIRECT_URI = 'https://notion-manual-maker.vercel.app/auth/notion-callback';

type Locale = 'ja' | 'en';
type Msgs = Record<string, string>;

const MESSAGES: Record<Locale, Msgs> = {
  ja: {
    loading: '読み込み中…',
    title: 'マイページ',
    loginPromptDesc: '利用状況の確認やプラン管理はGoogle アカウントでログインしてください。',
    loginWithGoogle: 'Google でログイン',
    logout: 'ログアウト',
    currentPlan: '現在のプラン',
    endsAt: '{date} に終了予定',
    screenshotLabel: 'スクリーンショット',
    screenshotCount: '{used} / 20 枚',
    resetsOn: '{date}リセット',
    aiLabel: 'AI生成',
    aiCount: '{used} / {limit} 回',
    upgradePlanTitle: 'プランをアップグレード',
    upgradePlanDesc: '14日間無料トライアル。いつでもキャンセル可能。',
    processing: '処理中…',
    upgradeToProTitle: '🚀 Pro にアップグレード',
    upgradeToProDesc: 'AI生成 500回/月・ワークスペース3つ。',
    upgradeToProBtn: 'Pro $8/月 にアップグレード',
    confirmUpgradeTitle: 'Pro プランへの変更を確認',
    confirmUpgradeDesc: '月額 $8 に変更されます。差額は本日分から日割りで請求されます。',
    confirm: '確定する',
    cancel: 'キャンセル',
    downgradeTitle: 'Standard にダウングレード',
    downgradeDesc: 'AI生成 100回/月・ワークスペース1つ。差額は日割りで返金されます。',
    downgradeBtn: 'Standard $3/月 にダウングレード',
    confirmDowngradeTitle: 'ダウングレードを確認',
    confirmDowngradeDesc: '月額 $3 に変更されます。ワークスペースが1つに制限され、AI生成は100回/月になります。',
    cancelSubTitle: 'サブスクリプションを解約',
    cancelSubDesc: '解約後も当月末まではご利用いただけます。翌月からFreeプランに移行します。',
    cancelSubBtn: '解約する',
    confirmCancelTitle: '解約を確認',
    confirmCancelDesc: '当月末までは現在のプランをご利用いただけます。以降はFreeプラン（スクショ20枚/月）に移行します。',
    confirmCancelBtn: '解約を確定する',
    notionWorkspacesTitle: 'Notion ワークスペース',
    connectedCount: '{count} / {max} 接続中',
    noWorkspace: 'まだ Notion ワークスペースが接続されていません。',
    disconnect: '切断',
    addNotion: '＋ Notion を接続する',
    connecting: '接続中…',
    usageChartTitle: '使用量グラフ（月別）',
    screenshotChartLabel: 'スクショ',
    aiChartLabel: 'AI生成',
    screenshotTooltip: 'スクショ {n}枚',
    aiTooltip: 'AI {n}回',
    manualsTitle: '作成したマニュアル',
    steps: '{n} ステップ',
    billingTitle: '請求履歴',
    languageTitle: '言語設定',
    languageLabel: '表示言語：',
    deleteAccountTitle: 'アカウント削除',
    deleteAccountDesc: 'メールアドレスとスクリーンショット画像が削除されます。有料プランをご利用中の場合はサブスクリプションも解約されます。',
    deleteAccountBtn: 'アカウントを削除する',
    confirmDeleteMsg: '本当に削除しますか？この操作は取り消せません。',
    deleteBtn: '削除する',
    wsDisconnected: 'ワークスペースを切断しました。',
    wsDisconnectFailed: 'ワークスペースの切断に失敗しました。',
    manualDeleteFailed: 'マニュアルの削除に失敗しました。',
    networkError: '通信エラーが発生しました。',
    accountDeleted: 'アカウントを削除しました。',
    deleteFailed: '削除に失敗しました。しばらくしてから再試行してください。',
    notionConnected: '{name} を接続しました。',
    notionConnectFailed: 'Notion 接続に失敗しました: {error}',
    notionConnectError: 'Notion 接続中にエラーが発生しました。',
    wsMaxReached: 'このプランでは最大 {max} ワークスペースまで接続できます。',
    upgradeSuccess: 'Proプランにアップグレードしました！AI生成が500回/月になりました。',
    upgradeError: 'エラーが発生しました: {error}',
    downgradeSuccess: 'Standardプランにダウングレードしました。',
    checkoutFailed: 'チェックアウトの開始に失敗しました: {error}',
    cancelWithDate: '{date} にサブスクリプションが終了します。それまでは現在のプランをご利用いただけます。',
    cancelNoDate: 'サブスクリプションの解約を受け付けました。',
    shortcuts: 'ショートカット',
    captureShortcut: 'スクショ撮影',
    saveShortcut: 'Notionに保存',
    support: 'サポート',
    contactSupport: 'お問い合わせ',
    billing: '請求管理',
    send: '送る',
    connect: '接続',
    manuals: '件',
  },
  en: {
    loading: 'Loading…',
    title: 'My Page',
    loginPromptDesc: 'Sign in with your Google account to check usage and manage your plan.',
    loginWithGoogle: 'Sign in with Google',
    logout: 'Sign out',
    currentPlan: 'Current plan',
    endsAt: 'Ends on {date}',
    screenshotLabel: 'Screenshots',
    screenshotCount: '{used} / 20',
    resetsOn: 'Resets {date}',
    aiLabel: 'AI generations',
    aiCount: '{used} / {limit}',
    upgradePlanTitle: 'Upgrade your plan',
    upgradePlanDesc: '14-day free trial. Cancel anytime.',
    processing: 'Processing…',
    upgradeToProTitle: '🚀 Upgrade to Pro',
    upgradeToProDesc: '500 AI generations/month · 3 Notion workspaces.',
    upgradeToProBtn: 'Upgrade to Pro $8/month',
    confirmUpgradeTitle: 'Confirm upgrade to Pro',
    confirmUpgradeDesc: 'Your plan will change to $8/month. The difference will be charged on a prorated basis.',
    confirm: 'Confirm',
    cancel: 'Cancel',
    downgradeTitle: 'Downgrade to Standard',
    downgradeDesc: '100 AI generations/month · 1 Notion workspace. Difference refunded daily.',
    downgradeBtn: 'Downgrade to Standard $3/month',
    confirmDowngradeTitle: 'Confirm downgrade',
    confirmDowngradeDesc: 'Your plan will change to $3/month. Workspaces limited to 1, AI generations to 100/month.',
    cancelSubTitle: 'Cancel subscription',
    cancelSubDesc: 'You can continue using the current plan until the end of the month. It will switch to Free after that.',
    cancelSubBtn: 'Cancel subscription',
    confirmCancelTitle: 'Confirm cancellation',
    confirmCancelDesc: 'You can use the current plan until end of month. After that you\'ll move to Free (20 screenshots/month).',
    confirmCancelBtn: 'Confirm cancellation',
    notionWorkspacesTitle: 'Notion Workspaces',
    connectedCount: '{count} / {max} connected',
    noWorkspace: 'No Notion workspace connected yet.',
    disconnect: 'Disconnect',
    addNotion: '+ Connect Notion',
    connecting: 'Connecting…',
    usageChartTitle: 'Usage history (monthly)',
    screenshotChartLabel: 'Screenshots',
    aiChartLabel: 'AI',
    screenshotTooltip: '{n} screenshots',
    aiTooltip: 'AI: {n}',
    manualsTitle: 'Created manuals',
    steps: '{n} steps',
    billingTitle: 'Billing history',
    languageTitle: 'Language',
    languageLabel: 'Display language:',
    deleteAccountTitle: 'Delete account',
    deleteAccountDesc: 'Your email and screenshot images will be deleted. If you have an active subscription, it will also be cancelled.',
    deleteAccountBtn: 'Delete account',
    confirmDeleteMsg: 'Are you sure? This cannot be undone.',
    deleteBtn: 'Delete',
    wsDisconnected: 'Workspace disconnected.',
    wsDisconnectFailed: 'Failed to disconnect workspace.',
    manualDeleteFailed: 'Failed to delete manual.',
    networkError: 'A network error occurred.',
    accountDeleted: 'Account deleted.',
    deleteFailed: 'Deletion failed. Please try again later.',
    notionConnected: 'Connected to {name}.',
    notionConnectFailed: 'Notion connection failed: {error}',
    notionConnectError: 'An error occurred while connecting to Notion.',
    wsMaxReached: 'Your plan allows up to {max} workspace(s).',
    upgradeSuccess: 'Upgraded to Pro! You now have 500 AI generations/month.',
    upgradeError: 'An error occurred: {error}',
    downgradeSuccess: 'Downgraded to Standard.',
    checkoutFailed: 'Failed to start checkout: {error}',
    cancelWithDate: 'Your subscription will end on {date}. You can continue using the current plan until then.',
    cancelNoDate: 'Cancellation request received.',
    shortcuts: 'Shortcuts',
    captureShortcut: 'Capture screenshot',
    saveShortcut: 'Save to Notion',
    support: 'Support',
    contactSupport: 'Contact support',
    billing: 'Billing',
    send: 'Send',
    connect: 'Connect',
    manuals: 'manuals',
  },
};

function interpolate(msg: string, vars: Record<string, string> = {}): string {
  return msg.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export default function DashboardPage() {
  const [locale, setLocale] = useState<Locale>('en');

  const t = (key: string, vars?: Record<string, string>) =>
    interpolate(MESSAGES[locale][key] ?? key, vars);

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
    const refetch = params.get('refetch');

    // 決済後リダイレクト時はURLをクリーンアップ
    if (refetch) window.history.replaceState({}, '', window.location.pathname);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (profileRes.ok) {
        setProfile(profileData);
        if (profileData.locale) setLocale(profileData.locale as Locale);
      }
      const invoicesData = await invoicesRes.json();
      if (invoicesRes.ok && invoicesData.invoices) setInvoices(invoicesData.invoices);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetLocale(newLocale: 'ja' | 'en') {
    if (!session) return;
    try {
      await fetch(`${SUPABASE_FUNCTIONS_URL}/set-locale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ supabase_token: session.access_token, locale: newLocale }),
      });
      setLocale(newLocale);
      setProfile(prev => prev ? { ...prev, locale: newLocale } : prev);
    } catch { /* silently fail */ }
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
        setMsg(t('upgradeSuccess'));
      } else {
        setMsg(t('upgradeError', { error: data.error ?? '不明なエラー' }));
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
        setMsg(t('downgradeSuccess'));
      } else {
        setMsg(t('upgradeError', { error: data.error ?? '不明なエラー' }));
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
          ? new Date(data.cancel_at * 1000).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US')
          : null;
        setCancelAt(cancelDate);
        setMsg(cancelDate
          ? t('cancelWithDate', { date: cancelDate })
          : t('cancelNoDate'));
      } else {
        setMsg(t('upgradeError', { error: data.error ?? '不明なエラー' }));
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
      if (data.url) {
        location.href = data.url;
      } else {
        setMsg(t('checkoutFailed', { error: data.error ?? '不明なエラー' }));
      }
    } finally {
      setCheckoutLoading('');
    }
  }

  async function handleNotionCode(code: string, s: Session) {
    setNotionConnecting(true);
    try {
      const proxyRes = await fetch(NOTION_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ code, redirect_uri: WEB_NOTION_REDIRECT_URI }),
      });
      const data = await proxyRes.json();
      if (data.error || !data.access_token) {
        setMsg(t('notionConnectFailed', { error: data.error ?? 'access_token missing' }));
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

      setMsg(t('notionConnected', { name: workspaceName }));
    } catch {
      setMsg(t('notionConnectError'));
    } finally {
      setNotionConnecting(false);
    }
  }

  function connectNotion(s: Session, plan: string, currentWsCount: number) {
    const maxWs = plan === 'pro' ? 3 : 1;
    if (currentWsCount >= maxWs) {
      setMsg(t('wsMaxReached', { max: String(maxWs) }));
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
        setMsg(t('wsDisconnected'));
      } else {
        setMsg(t('wsDisconnectFailed'));
      }
    } catch {
      setMsg(t('networkError'));
    }
  }

  async function deleteManual(manualId: string) {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/delete-manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ supabase_token: session.access_token, manual_id: manualId }),
      });
      if (res.ok) {
        setProfile((prev) => prev ? {
          ...prev,
          manuals: prev.manuals.filter((m) => m.id !== manualId),
        } : prev);
      } else {
        setMsg(t('manualDeleteFailed'));
      }
    } catch {
      setMsg(t('networkError'));
    }
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
        setMsg(t('accountDeleted'));
      } else {
        setMsg(t('deleteFailed'));
      }
    } catch {
      setMsg(t('networkError'));
    }
    setDeleteConfirm(false);
  }

  const dateLocale = locale === 'ja' ? 'ja-JP' : 'en-US';

  function fmtResetDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (locale === 'ja') return `${d.getMonth() + 1}月${d.getDate()}日`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function fmtInvoiceDate(unix: number): string {
    const d = new Date(unix * 1000);
    if (locale === 'ja') return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat(dateLocale, { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
  }

  const planLabel: Record<string, { label: string; emoji: string }> = {
    free:     { label: 'Free',     emoji: '🌱' },
    standard: { label: 'Standard', emoji: '⚡' },
    pro:      { label: 'Pro',      emoji: '🚀' },
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="dash-wrap" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-4)' }}>{t('loading')}</p>
      </div>
    );
  }

  /* ── Not signed in ── */
  if (!session) {
    return (
      <div className="dash-wrap" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 320, padding: '0 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 10 }}>{t('title')}</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 28 }}>{t('loginPromptDesc')}</p>
          <button
            onClick={signIn}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'var(--paper)', border: '1px solid var(--line)',
              borderRadius: 10, padding: '10px 20px',
              fontSize: 14, fontWeight: 500, color: 'var(--ink)',
              boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
              transition: 'box-shadow .15s ease, border-color .15s ease',
              font: 'inherit',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.015 17.64 11.707 17.64 9.2z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            {t('loginWithGoogle')}
          </button>
        </div>
      </div>
    );
  }

  /* ── Dashboard ── */
  const planInfo = planLabel[profile?.plan ?? 'free'];
  const usedScreenshots = profile?.monthly_screenshots ?? 0;
  const screenshotLimit = profile?.plan === 'free' ? 20 : null;
  const screenshotPct = screenshotLimit ? Math.min((usedScreenshots / screenshotLimit) * 100, 100) : 0;
  const screenshotBarMod = screenshotPct >= 100 ? 'over' : screenshotPct >= 80 ? 'warn' : screenshotPct < 50 ? 'low' : '';

  const usedAI = profile?.ai_calls_used ?? 0;
  const limitAI = profile?.ai_calls_limit ?? 0;
  const aiPct = limitAI > 0 ? Math.min((usedAI / limitAI) * 100, 100) : 0;
  const aiBarMod = aiPct >= 100 ? 'over' : aiPct >= 80 ? 'warn' : aiPct < 50 ? 'low' : '';

  const maxWs = profile?.plan === 'pro' ? 3 : 1;

  return (
    <div className="dash-wrap">
      <div className="dash">

        {/* ── Header ── */}
        <div className="dash-head">
          <div>
            <h1 className="dash-title">{t('title')}</h1>
            <div className="dash-subtitle">
              <span className="acc">
                <span className="acc-avatar">{session.user.email?.[0]?.toUpperCase() ?? '?'}</span>
                <span>{session.user.email}</span>
              </span>
            </div>
          </div>
          <div className="head-actions">
            <button className="btn-outline" onClick={signOut}>{t('logout')}</button>
          </div>
        </div>

        {/* ── Status message ── */}
        {msg && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', marginBottom: 24,
            background: 'color-mix(in oklab, var(--green) 12%, var(--paper))',
            border: '1px solid color-mix(in oklab, var(--green) 25%, transparent)',
            borderRadius: 'var(--radius-lg)', fontSize: 13.5, color: 'oklch(0.42 0.10 155)',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L5.5 10.5L12 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {msg}
          </div>
        )}

        {/* ── Two-column grid ── */}
        <div className="dash-grid">

          {/* ── Left column ── */}
          <div className="dash-col">

            {/* Plan card */}
            <div className="plan-card">
              <div className="plan-row">
                <div className="plan-glyph">
                  <span className="leaf">{planInfo.emoji}</span>
                </div>
                <div className="plan-current">
                  <div className="lbl">{t('currentPlan')}</div>
                  <div className="name">{planInfo.label}</div>
                  {cancelAt && (
                    <div className="sub" style={{ color: 'oklch(0.58 0.14 50)' }}>
                      {t('endsAt', { date: cancelAt })}
                    </div>
                  )}
                </div>
                <div className="spacer" />
                {profile?.plan !== 'free' && (
                  <a href={CUSTOMER_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="btn-outline">
                    {t('billing')}
                  </a>
                )}
              </div>

              {/* Usage bars */}
              <div className="usage">
                {screenshotLimit && (
                  <>
                    <div className="usage-row">
                      <span>{t('screenshotLabel')}</span>
                      <span className="v"><strong>{usedScreenshots}</strong> / {screenshotLimit}</span>
                    </div>
                    <div className={`usage-bar ${screenshotBarMod}`}>
                      <span style={{ width: `${screenshotPct}%` }} />
                    </div>
                    {profile?.screenshot_reset_at && (
                      <div className="usage-meta">
                        <span>{t('resetsOn', { date: fmtResetDate(profile.screenshot_reset_at) })}</span>
                      </div>
                    )}
                  </>
                )}
                {limitAI > 0 && (
                  <div style={{ marginTop: screenshotLimit ? 16 : 0 }}>
                    <div className="usage-row">
                      <span>{t('aiLabel')}</span>
                      <span className="v"><strong>{usedAI}</strong> / {limitAI}</span>
                    </div>
                    <div className={`usage-bar ${aiBarMod}`}>
                      <span style={{ width: `${aiPct}%` }} />
                    </div>
                    {profile?.ai_calls_reset_at && (
                      <div className="usage-meta">
                        <span>{t('resetsOn', { date: fmtResetDate(profile.ai_calls_reset_at) })}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Free → upgrade cards */}
              {profile?.plan === 'free' && (
                <>
                  <div className="upgrade">
                    <button
                      className="upgrade-card"
                      onClick={() => startCheckout(STRIPE_STANDARD_PRICE_ID)}
                      disabled={!!checkoutLoading}
                    >
                      <div className="uc-name">Standard</div>
                      <div className="uc-price">$3<small>/mo</small></div>
                      <div className="uc-desc">{locale === 'ja' ? 'AI 100回/月' : '100 AI/mo'}</div>
                      <span className="uc-arrow">→</span>
                    </button>
                    <button
                      className="upgrade-card featured"
                      onClick={() => startCheckout(STRIPE_PRO_PRICE_ID)}
                      disabled={!!checkoutLoading}
                    >
                      <div className="uc-name">Pro</div>
                      <div className="uc-price">$8<small>/mo</small></div>
                      <div className="uc-desc">{locale === 'ja' ? 'AI 500回・WS 3つ' : '500 AI · 3 WS'}</div>
                      <span className="uc-arrow">→</span>
                    </button>
                  </div>
                  <div className="upgrade-foot">{t('upgradePlanDesc')}</div>
                </>
              )}

              {/* Standard → Pro upgrade */}
              {profile?.plan === 'standard' && (
                <div style={{ marginTop: 22, position: 'relative', zIndex: 1 }}>
                  {!proUpgradeConfirm ? (
                    <button
                      className="upgrade-card featured"
                      style={{ width: '100%', flexDirection: 'row', alignItems: 'center', padding: '14px 16px' }}
                      onClick={() => setProUpgradeConfirm(true)}
                      disabled={!!checkoutLoading}
                    >
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div className="uc-name">Pro</div>
                        <div className="uc-desc">{t('upgradeToProDesc')}</div>
                      </div>
                      <div className="uc-price">$8<small>/mo</small></div>
                      <span className="uc-arrow" style={{ position: 'relative', right: 'auto', bottom: 'auto', marginLeft: 12 }}>→</span>
                    </button>
                  ) : (
                    <div className="confirm-box">
                      <p><strong>{t('confirmUpgradeTitle')}</strong> — {t('confirmUpgradeDesc')}</p>
                      <div className="actions">
                        <button
                          className="btn-outline"
                          style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
                          onClick={upgradeToPro}
                          disabled={!!checkoutLoading}
                        >
                          {checkoutLoading === STRIPE_PRO_PRICE_ID ? t('processing') : t('confirm')}
                        </button>
                        <button className="btn-outline" onClick={() => setProUpgradeConfirm(false)} disabled={!!checkoutLoading}>
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pro → Standard downgrade */}
              {profile?.plan === 'pro' && !cancelAt && (
                <div style={{ marginTop: 16, position: 'relative', zIndex: 1 }}>
                  {!downgradeConfirm ? (
                    <button className="btn-outline" style={{ fontSize: 13 }} onClick={() => setDowngradeConfirm(true)} disabled={!!checkoutLoading}>
                      {t('downgradeBtn')}
                    </button>
                  ) : (
                    <div className="confirm-box">
                      <p><strong>{t('confirmDowngradeTitle')}</strong> — {t('confirmDowngradeDesc')}</p>
                      <div className="actions">
                        <button
                          className="btn-outline"
                          style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
                          onClick={downgradeToStandard}
                          disabled={!!checkoutLoading}
                        >
                          {checkoutLoading === STRIPE_STANDARD_PRICE_ID ? t('processing') : t('confirm')}
                        </button>
                        <button className="btn-outline" onClick={() => setDowngradeConfirm(false)} disabled={!!checkoutLoading}>
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cancel subscription */}
              {profile?.plan !== 'free' && !cancelAt && (
                <div style={{ marginTop: 12, position: 'relative', zIndex: 1 }}>
                  {!cancelConfirm ? (
                    <button
                      className="btn-outline"
                      style={{ fontSize: 12, color: 'var(--ink-4)', borderColor: 'var(--line)' }}
                      onClick={() => setCancelConfirm(true)}
                      disabled={!!checkoutLoading}
                    >
                      {t('cancelSubBtn')}
                    </button>
                  ) : (
                    <div className="confirm-box">
                      <p><strong>{t('confirmCancelTitle')}</strong> — {t('confirmCancelDesc')}</p>
                      <div className="actions">
                        <button className="btn-danger" onClick={cancelSubscription} disabled={!!checkoutLoading}>
                          {checkoutLoading === 'cancel' ? t('processing') : t('confirmCancelBtn')}
                        </button>
                        <button className="btn-outline" onClick={() => setCancelConfirm(false)} disabled={!!checkoutLoading}>
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Usage chart */}
            {profile && profile.usage_history.length > 0 && (
              <div className="card chart-card">
                <div className="card-h">
                  <span className="card-title">{t('usageChartTitle')}</span>
                </div>
                {(() => {
                  const history: UsageHistory[] = [...profile.usage_history].reverse();
                  const maxShots = Math.max(...history.map(h => h.screenshots), 1);
                  const maxAi   = Math.max(...history.map(h => h.ai_calls), 1);
                  return (
                    <>
                      <div className="chart">
                        <div className="y-axis">
                          <span>{maxShots}</span>
                          <span>{Math.round(maxShots / 2)}</span>
                          <span>0</span>
                        </div>
                        <div className="plot">
                          <div className="grid-y" />
                          <div className="bars">
                            {history.map((h) => {
                              const shotPct = Math.round((h.screenshots / maxShots) * 100);
                              const aiPct2  = maxAi > 0 ? Math.round((h.ai_calls / maxAi) * 100) : 0;
                              const [y, m]  = h.month.split('-');
                              const monthLabel = new Date(parseInt(y), parseInt(m) - 1)
                                .toLocaleDateString(dateLocale, { month: 'short' });
                              return (
                                <div key={h.month} className="month">
                                  <div className="pair">
                                    <div className="bar shot" style={{ height: `${shotPct}%` }}>
                                      <span className="tip">{t('screenshotTooltip', { n: String(h.screenshots) })}</span>
                                    </div>
                                    {h.ai_calls > 0 && (
                                      <div className="bar ai" style={{ height: `${aiPct2}%` }}>
                                        <span className="tip">{t('aiTooltip', { n: String(h.ai_calls) })}</span>
                                      </div>
                                    )}
                                  </div>
                                  <span className="label">{monthLabel}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="chart-legend">
                        <span className="swatch shot"><span />{t('screenshotChartLabel')}</span>
                        <span className="swatch ai"><span />{t('aiChartLabel')}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Manuals list */}
            {profile && profile.manuals.length > 0 && (
              <div className="card manuals-card">
                <div className="card-h">
                  <span className="card-title">{t('manualsTitle')}</span>
                  <span className="card-meta">{profile.manuals.length}</span>
                </div>
                <ul className="manuals-list">
                  {profile.manuals.map((m: Manual) => (
                    <li key={m.id} className={`manual-row ${m.step_count <= 5 ? 'few' : ''}`}>
                      <div className="manual-glyph">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </div>
                      {m.source === 'desktop' && (
                        <span title="デスクトップアプリから保存" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f0f0f0', color: '#666', marginRight: 6, flexShrink: 0 }}>🖥️ Desktop</span>
                      )}
                      <div className="manual-body">
                        <div className="manual-title">{m.title}</div>
                        <div className="manual-meta">
                          <span className="step-count">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <circle cx="5" cy="5" r="3.5" stroke="currentColor"/>
                              <path d="M5 3v2l1.5 1.5" stroke="currentColor" strokeLinecap="round"/>
                            </svg>
                            {t('steps', { n: String(m.step_count) })}
                          </span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-4)', display: 'inline-block' }} />
                          <span>{new Date(m.created_at).toLocaleDateString(dateLocale)}</span>
                        </div>
                      </div>
                      <div className="manual-actions">
                        {m.notion_page_url && (
                          <a
                            href={m.notion_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-outline"
                            style={{ fontSize: 11 }}
                          >
                            Notion ↗
                          </a>
                        )}
                        <button
                          className="btn-icon danger"
                          onClick={() => deleteManual(m.id)}
                          title={t('deleteBtn')}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="manuals-foot">
                  <span>{profile.manuals.length} {t('manuals')}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="dash-col">

            {/* Notion workspaces */}
            {profile && (
              <div className="card">
                <div className="card-h">
                  <span className="card-title">{t('notionWorkspacesTitle')}</span>
                  <span className="card-meta">
                    {t('connectedCount', { count: String(profile.workspaces.length), max: String(maxWs) })}
                  </span>
                </div>
                <ul className="list">
                  {profile.workspaces.length === 0 && (
                    <li style={{ padding: '10px 0', color: 'var(--ink-4)', fontSize: 13, border: 'none' }}>
                      {t('noWorkspace')}
                    </li>
                  )}
                  {profile.workspaces.map((ws: NotionWorkspace) => (
                    <li key={ws.workspace_id}>
                      <div className="row-glyph">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M5 5h4M5 8h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="row-body">
                        <div className="row-title">{ws.workspace_name}</div>
                        <div className="row-sub">
                          <span className="status ok">
                            <span className="dot-s" />connected
                          </span>
                          <span className="dot" />
                          <span>{new Date(ws.connected_at).toLocaleDateString(dateLocale)}</span>
                        </div>
                      </div>
                      <div className="row-actions">
                        <button
                          className="btn-icon danger"
                          onClick={() => disconnectWorkspace(ws.workspace_id)}
                          title={t('disconnect')}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {profile.workspaces.length < maxWs && (
                  <div className="connect-row">
                    <div className="l">
                      <span>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </span>
                      <span>{t('addNotion')}</span>
                    </div>
                    <button
                      className="btn-outline"
                      onClick={() => connectNotion(session!, profile.plan, profile.workspaces.length)}
                      disabled={notionConnecting}
                    >
                      {notionConnecting ? t('connecting') : t('connect')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Billing history */}
            {invoices.length > 0 && (
              <div className="card">
                <div className="card-h">
                  <span className="card-title">{t('billingTitle')}</span>
                </div>
                <ul className="list">
                  {invoices.map((inv) => (
                    <li key={inv.id}>
                      <div className="row-glyph">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M5 5.5h4M5 8h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="row-body">
                        <div className="row-title">
                          {fmtInvoiceDate(inv.period_start)}
                        </div>
                        <div className="row-sub">
                          <span className={`status ${inv.status === 'paid' ? 'ok' : 'muted'}`}>
                            <span className="dot-s" />{inv.status}
                          </span>
                        </div>
                      </div>
                      <div className="row-actions">
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
                          color: inv.status === 'paid' ? 'oklch(0.42 0.10 155)' : 'var(--ink-3)',
                        }}>
                          {fmtAmount(inv.amount_paid, inv.currency)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        </div>

        {/* ── Language setting ── */}
        {profile && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <span className="card-title">{t('languageTitle')}</span>
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', marginRight: 8 }}>
                {t('languageLabel')}
              </span>
              {(['ja', 'en'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => handleSetLocale(l)}
                  className="btn-outline"
                  style={{
                    fontWeight: (profile.locale ?? 'en') === l ? 700 : 400,
                    borderColor: (profile.locale ?? 'en') === l ? 'var(--ink)' : undefined,
                    color: (profile.locale ?? 'en') === l ? 'var(--ink)' : undefined,
                  }}
                >
                  {l === 'ja' ? '🇯🇵 日本語' : '🇺🇸 English'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Danger zone ── */}
        {profile && (
          <div className="danger-zone">
            <div className="dz-text">
              <div className="dz-title">
                <svg className="dz-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L1.5 13.5h13L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M8 6.5v3.5M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {t('deleteAccountTitle')}
              </div>
              <div className="dz-sub">{t('deleteAccountDesc')}</div>
            </div>
            {!deleteConfirm ? (
              <button className="btn-danger" onClick={() => setDeleteConfirm(true)}>
                {t('deleteAccountBtn')}
              </button>
            ) : (
              <div className="confirm-box" style={{ margin: 0, minWidth: 240 }}>
                <p>{t('confirmDeleteMsg')}</p>
                <div className="actions">
                  <button className="btn-danger" onClick={deleteAccount}>{t('deleteBtn')}</button>
                  <button className="btn-outline" onClick={() => setDeleteConfirm(false)}>{t('cancel')}</button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
