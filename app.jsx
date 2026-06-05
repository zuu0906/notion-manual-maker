// App shell: nav, hero, all sections wired up. Language toggle JA/EN.
const { useState, useEffect } = React;

function App(){
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("cmm_lang") || "ja"; } catch(e) { return "ja"; }
  });
  useEffect(() => {
    try { localStorage.setItem("cmm_lang", lang); } catch(e) {}
    document.documentElement.lang = lang;
  }, [lang]);

  const c = window.COPY[lang];

  return (
    <div className="page">
      <Nav lang={lang} setLang={setLang} c={c.nav} />

      <Hero c={c.hero} />

      <ProblemSection copy={c.problem} />
      <HowSection copy={c.how} />
      <BeforeAfter copy={c.ba} />
      <FeaturesSection copy={c.feat} />
      <PricingSection copy={c.pricing} />
      <FAQSection copy={c.faq} />
      <FinalCTA copy={c.final} />
      <Footer copy={c.footer} />
    </div>
  );
}

function Nav({ lang, setLang, c }){
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a href="#" className="brand">
          <span className="brand-mark"></span>
          <span>Chrome Manual Maker</span>
        </a>
        <div className="nav-links">
          <a href="#how">{c.how}</a>
          <a href="#pricing">{c.pricing}</a>
          <a href="#" >{c.dashboard}</a>
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

function Hero({ c }){
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">
              <span className="dot"></span>
              {c.eyebrow}
            </span>
            <h1 className="h1">
              <span className="accent">{c.h1Pre}</span>
              <em>{c.h1Em}</em>
              <span className="accent">{c.h1Post}</span>
            </h1>
            <p className="lede">{c.lede}</p>
            <div className="cta-row">
              <a href="#" className="btn btn-primary btn-lg">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 2 }}>
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" opacity="0.4"/>
                  <circle cx="7" cy="7" r="2.4" fill="currentColor"/>
                </svg>
                {c.ctaPrimary}
              </a>
              <a href="#how" className="btn btn-ghost btn-lg">
                {c.ctaSecondary} →
              </a>
            </div>
            <div className="trust">
              {c.trust.map((t, i) => (
                <span key={i}>
                  <span className="check">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M2.5 7L5.5 10L10.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  {t}
                </span>
              ))}
            </div>
          </div>

          <HeroStage copy={c.stage} />
        </div>

        <div className="hero-stats">
          {c.stats.map((s, i) => (
            <div key={i} className="hero-stat">
              <span className="tag">{`0${i+1}`}</span>
              <div className="v">{s.v}<sup>{s.suf}</sup></div>
              <div className="l">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
