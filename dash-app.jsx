// Dashboard / My Page
const { useState, useEffect } = React;

function DashApp(){
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("cmm_lang") || "ja"; } catch(e) { return "ja"; }
  });
  useEffect(() => {
    try { localStorage.setItem("cmm_lang", lang); } catch(e) {}
    document.documentElement.lang = lang;
  }, [lang]);

  const c = window.DASH_COPY[lang];
  const navC = window.COPY[lang].nav;

  return (
    <div className="page">
      <DashNav lang={lang} setLang={setLang} c={navC} />
      <div className="dash-wrap">
        <div className="dash">
          <DashHeader c={c} />
          <div className="dash-grid">
            <div className="dash-col">
              <PlanCard c={c} lang={lang} />
              <ChartCard c={c.chart} />
              <ManualsCard c={c.manuals} />
            </div>
            <div className="dash-col">
              <NotionCard c={c.notion} />
              <ShortcutsCard lang={lang} />
              <SupportCard lang={lang} />
            </div>
          </div>
          <DangerZone c={c.danger} />
        </div>
      </div>
      <Footer copy={window.COPY[lang].footer} />
    </div>
  );
}

function DashNav({ lang, setLang, c }){
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a href="Chrome Manual Maker.html" className="brand">
          <span className="brand-mark"></span>
          <span>Chrome Manual Maker</span>
        </a>
        <div className="nav-links">
          <a href="Chrome Manual Maker.html#how">{c.how}</a>
          <a href="Chrome Manual Maker.html#pricing">{c.pricing}</a>
          <a href="My Page.html" style={{ color: "var(--ink)" }}>{c.dashboard}</a>
        </div>
        <div className="nav-right">
          <div className="lang">
            <button className={lang === "ja" ? "active" : ""} onClick={() => setLang("ja")}>JA</button>
            <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <a href="#" className="btn btn-primary">{c.install}</a>
        </div>
      </div>
    </nav>
  );
}

function DashHeader({ c }){
  return (
    <div className="dash-head">
      <div>
        <h1 className="dash-title">{c.title}</h1>
        <div className="dash-subtitle">
          <span className="acc">
            <span className="acc-avatar">Z</span>
            zuu0906@gmail.com
          </span>
        </div>
      </div>
      <div className="head-actions">
        <button className="btn btn-ghost">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3.5V2.5a1 1 0 0 0-1-1H2.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M6 7h7m0 0L10.5 4.5M13 7l-2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {c.logout}
        </button>
      </div>
    </div>
  );
}

function PlanCard({ c, lang }){
  const used = 0, total = 20;
  const pct = Math.min(100, (used / total) * 100);
  const lvl = pct < 60 ? "low" : pct < 90 ? "warn" : "over";
  return (
    <section className="plan-card">
      <div className="plan-row">
        <div className="plan-glyph">
          <span className="leaf">🌱</span>
        </div>
        <div className="plan-current">
          <div className="lbl">{c.plan.tag}</div>
          <div className="name">{c.plan.name}</div>
          <div className="sub">{c.plan.sub}</div>
        </div>
        <div className="spacer"></div>
      </div>

      <div className="usage">
        <div className="usage-row">
          <span>{c.usage.shotLabel}</span>
          <span className="v"><strong>{used}</strong> <span style={{ color: 'var(--ink-4)' }}>/ {total}</span></span>
        </div>
        <div className={`usage-bar ${lvl}`}><span style={{ width: `${pct}%` }}></span></div>
        <div className="usage-meta">
          {c.usage.stats.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
      </div>

      <div className="upgrade">
        {c.upgrade.plans.map((p, i) => (
          <button key={i} className={"upgrade-card " + (p.featured ? "featured" : "")}>
            <span className="uc-name">{p.name}</span>
            <span className="uc-price">{p.price}<small>{p.per}</small></span>
            <span className="uc-desc">{p.desc}</span>
            <span className="uc-arrow">↗</span>
          </button>
        ))}
      </div>
      <div className="upgrade-foot">{c.upgrade.foot}</div>
    </section>
  );
}

function ChartCard({ c }){
  return (
    <section className="card chart-card">
      <div className="card-h">
        <div className="card-title">{c.tag}</div>
        <div className="card-meta">{c.meta}</div>
      </div>
      <div className="chart">
        <div className="y-axis">
          <span>{c.max}</span>
          <span>{Math.round(c.max * 0.75)}</span>
          <span>{Math.round(c.max * 0.5)}</span>
          <span>{Math.round(c.max * 0.25)}</span>
          <span>0</span>
        </div>
        <div className="plot">
          <div className="grid-y"></div>
          <div className="bars">
            {c.data.map((d, i) => (
              <div key={i} className="month">
                <div className="pair">
                  <div className="bar shot" style={{ height: `${(d.shot / c.max) * 100}%` }}>
                    <span className="tip">{c.legend.shot}: {d.shot}</span>
                  </div>
                  <div className="bar ai" style={{ height: `${(d.ai / c.max) * 100}%` }}>
                    <span className="tip">{c.legend.ai}: {d.ai}</span>
                  </div>
                </div>
                <div className="label">{c.months[i]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="chart-legend">
        <span className="swatch shot"><span></span>{c.legend.shot}</span>
        <span className="swatch ai"><span></span>{c.legend.ai}</span>
      </div>
    </section>
  );
}

function ManualsCard({ c }){
  return (
    <section className="card manuals-card">
      <div className="card-h">
        <div className="card-title">{c.tag}</div>
        <div className="card-meta">{c.meta} · {c.newer}</div>
      </div>
      <ul className="manuals-list">
        {c.items.map((m, i) => (
          <li key={i} className={"manual-row " + (m.steps <= 3 ? "few" : "")}>
            <div className="manual-glyph">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="2.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="manual-body">
              <div className="manual-title">{m.title}</div>
              <div className="manual-meta">
                <span className="step-count">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                  {m.steps} steps
                </span>
                <span>{m.date}</span>
              </div>
            </div>
            <div className="manual-actions">
              <a className="btn-outline" href="#">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M5 2H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7M7 2h3v3M5 7l5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Notion
              </a>
              <button className="btn-icon danger" aria-label="delete">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M3 4h8M5.5 4V2.8a.8.8 0 0 1 .8-.8h1.4a.8.8 0 0 1 .8.8V4M4 4l.5 7a1 1 0 0 0 1 .9h3a1 1 0 0 0 1-.9L10 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="manuals-foot">
        <span>{c.meta}</span>
        <a href="#">{c.see}</a>
      </div>
    </section>
  );
}

function NotionCard({ c }){
  return (
    <section className="card">
      <div className="card-h">
        <div className="card-title">{c.tag}</div>
        <div className="card-meta">{c.meta}</div>
      </div>
      <ul className="list">
        {c.items.map((it, i) => (
          <li key={i}>
            <div className="row-glyph">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4.5 4.5v5M4.5 4.5l5 5V4.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="row-body">
              <div className="row-title">{it.name}</div>
              <div className="row-sub">
                <span className="status ok"><span className="dot-s"></span>Connected</span>
                <span className="dot"></span>
                <span>{it.date}</span>
              </div>
            </div>
            <div className="row-actions">
              <button className="btn-icon" aria-label="disconnect">×</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="connect-row">
        <div className="l">
          <span>+</span>
          <span>{c.add}</span>
        </div>
        <button className="btn-outline">OAuth →</button>
      </div>
    </section>
  );
}

function ShortcutsCard({ lang }){
  const items = lang === "ja" ? [
    { k: ["⌘", "⇧", "M"], label: "新しい記録を開始" },
    { k: ["⌘", "S"], label: "Notionへ保存" },
    { k: ["⌘", "/"], label: "ヘルプを開く" },
  ] : [
    { k: ["⌘", "⇧", "M"], label: "Start new recording" },
    { k: ["⌘", "S"], label: "Save to Notion" },
    { k: ["⌘", "/"], label: "Open help" },
  ];
  return (
    <section className="card">
      <div className="card-h">
        <div className="card-title">{lang === "ja" ? "ショートカット" : "Shortcuts"}</div>
        <div className="card-meta">macOS</div>
      </div>
      <ul className="list">
        {items.map((it, i) => (
          <li key={i}>
            <div className="row-body">
              <div className="row-title" style={{ fontSize: 13.5, fontWeight: 400, color: 'var(--ink-2)' }}>
                {it.label}
              </div>
            </div>
            <div className="row-actions" style={{ gap: 4 }}>
              {it.k.map((k, j) => <span key={j} className="kbd">{k}</span>)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SupportCard({ lang }){
  return (
    <section className="card" style={{ background: 'linear-gradient(180deg, var(--bg-2), var(--paper))' }}>
      <div className="card-h" style={{ marginBottom: 8 }}>
        <div className="card-title">{lang === "ja" ? "サポート" : "Support"}</div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '4px 0 14px', lineHeight: 1.6 }}>
        {lang === "ja"
          ? "ご質問・ご要望は、いつでもメールでお気軽にどうぞ。営業日中に返信します。"
          : "Questions or requests? Email us anytime — we respond on business days."}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a className="btn btn-ghost" href="mailto:support@s-tasklog.com">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="1.5" y="3" width="11" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M2 4l5 4 5-4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
          {lang === "ja" ? "メールで問い合わせ" : "Contact support"}
        </a>
        <a className="btn btn-ghost" href="#">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5.2 5.5a1.8 1.8 0 0 1 3.6 0c0 1.2-1.8 1.4-1.8 2.5M7 10v.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          FAQ
        </a>
      </div>
    </section>
  );
}

function DangerZone({ c }){
  return (
    <section className="danger-zone">
      <div className="dz-text">
        <div className="dz-title">
          <span className="dz-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 12H1L7 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M7 5.5v3M7 10.2v.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </span>
          {c.title}
        </div>
        <div className="dz-sub">{c.sub}</div>
      </div>
      <button className="btn-danger">{c.cta}</button>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<DashApp />);
