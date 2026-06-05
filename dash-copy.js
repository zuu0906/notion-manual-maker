// Dashboard copy — JA/EN
window.DASH_COPY = {
  ja: {
    title: "マイページ",
    logout: "ログアウト",
    plan: {
      tag: "Current Plan",
      name: "Free",
      sub: "個人で試すのに十分なプランです。",
    },
    usage: {
      tag: "Usage",
      shotLabel: "スクリーンショット",
      shotMeta: "今月のリセットまで",
      aiLabel: "AI 生成",
      stats: ["スクショ 0/20 枚", "AI 生成 11 回", "リセット まで 21 日"],
    },
    upgrade: {
      tag: "Upgrade",
      foot: "14日間無料トライアル · いつでもキャンセル可能",
      plans: [
        { name: "Standard", price: "¥500", per: "/月", desc: "本格的に使うチーム向け", featured: false },
        { name: "Pro", price: "¥1,200", per: "/月", desc: "複数ワークスペース対応", featured: true },
      ],
    },
    notion: {
      tag: "Notion Workspaces",
      meta: "1 / 1 接続中",
      add: "ワークスペースを追加",
      items: [
        { name: "Personal Workspace", date: "2026/05/10 接続" },
      ],
    },
    chart: {
      tag: "Monthly Usage",
      meta: "過去6ヶ月",
      months: ["12月", "1月", "2月", "3月", "4月", "5月"],
      data: [
        { shot: 8, ai: 4 },
        { shot: 12, ai: 6 },
        { shot: 14, ai: 9 },
        { shot: 9, ai: 5 },
        { shot: 18, ai: 11 },
        { shot: 0, ai: 0 },
      ],
      max: 22,
      legend: { shot: "スクリーンショット", ai: "AI 生成" },
    },
    manuals: {
      tag: "Manuals",
      meta: "全 7 件",
      empty: "まだマニュアルがありません",
      newer: "新しい順",
      see: "すべて見る →",
      items: [
        { title: "管理画面の初期設定マニュアル", steps: 8, date: "2026/05/10" },
        { title: "請求書の発行手順", steps: 5, date: "2026/04/26" },
        { title: "メンバー招待フロー", steps: 3, date: "2026/04/26" },
        { title: "ダッシュボードのカスタマイズ", steps: 6, date: "2026/04/26" },
        { title: "API キー再発行の手順", steps: 4, date: "2026/04/26" },
        { title: "サブスクリプションの変更", steps: 2, date: "2026/04/26" },
      ],
    },
    danger: {
      title: "アカウント削除",
      sub: "メールアドレスとスクリーンショット画像が削除されます。有料プランをご利用中の場合はサブスクリプションも解約されます。",
      cta: "アカウントを削除する",
    },
  },
  en: {
    title: "My Page",
    logout: "Sign out",
    plan: { tag: "Current Plan", name: "Free", sub: "Plenty for getting started." },
    usage: {
      tag: "Usage", shotLabel: "Screenshots", shotMeta: "Until monthly reset",
      aiLabel: "AI captions",
      stats: ["0/20 screenshots", "11 AI captions", "21 days to reset"],
    },
    upgrade: {
      tag: "Upgrade", foot: "14-day free trial · cancel anytime",
      plans: [
        { name: "Standard", price: "$5", per: "/mo", desc: "For teams shipping daily", featured: false },
        { name: "Pro", price: "$12", per: "/mo", desc: "Multi-workspace orgs", featured: true },
      ],
    },
    notion: {
      tag: "Notion Workspaces", meta: "1 / 1 connected",
      add: "Add workspace",
      items: [{ name: "Personal Workspace", date: "Connected 2026/05/10" }],
    },
    chart: {
      tag: "Monthly Usage", meta: "Last 6 months",
      months: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"],
      data: [
        { shot: 8, ai: 4 }, { shot: 12, ai: 6 }, { shot: 14, ai: 9 },
        { shot: 9, ai: 5 }, { shot: 18, ai: 11 }, { shot: 0, ai: 0 },
      ],
      max: 22,
      legend: { shot: "Screenshots", ai: "AI captions" },
    },
    manuals: {
      tag: "Manuals", meta: "7 total", empty: "No manuals yet",
      newer: "Newest first", see: "See all →",
      items: [
        { title: "Admin initial setup", steps: 8, date: "2026/05/10" },
        { title: "Issue an invoice", steps: 5, date: "2026/04/26" },
        { title: "Invite team members", steps: 3, date: "2026/04/26" },
        { title: "Customise dashboard", steps: 6, date: "2026/04/26" },
        { title: "Rotate API keys", steps: 4, date: "2026/04/26" },
        { title: "Change subscription", steps: 2, date: "2026/04/26" },
      ],
    },
    danger: {
      title: "Delete account",
      sub: "Removes your email, screenshots, and cancels active subscriptions.",
      cta: "Delete account",
    },
  },
};
