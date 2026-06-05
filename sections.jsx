// All non-hero sections of the Chrome Manual Maker LP
const { useState: useStateS } = React;

function Eyebrow({ children }){ return <div className="section-tag">{children}</div>; }

function ProblemSection({ copy }){
  return (
    <section className="section" id="problem">
      <div className="container">
        <Eyebrow>{copy.tag}</Eyebrow>
        <h2 className="h2">{copy.h2}</h2>
        <p className="section-lede">{copy.lede}</p>
        <div className="problem-grid">
          {copy.cells.map((c, i) => (
            <div key={i} className="problem-cell">
              <div className="x">{c.x}</div>
              <div className="kanji"><span className="strike">{c.t}</span></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepVisual({ idx, copy }){
  // Each step gets a distinct minimal visual
  if (idx === 0){
    // Extension popup
    return (
      <div className="visual">
        <div className="svgrid"></div>
        <div style={{
          position:'absolute', top: 14, right: 14,
          width: 170, padding: 12, borderRadius: 10,
          background:'var(--paper)', border:'1px solid var(--line)',
          boxShadow:'var(--shadow-md)', fontSize: 11
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 8 }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, background: 'linear-gradient(135deg, oklch(0.66 0.16 250), oklch(0.58 0.16 270))' }}></span>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Manual Maker</span>
          </div>
          <div style={{ height: 8, borderRadius: 3, background: 'var(--bg-3)', marginBottom: 6 }}></div>
          <div style={{ height: 8, width: '70%', borderRadius: 3, background: 'var(--bg-3)', marginBottom: 12 }}></div>
          <button style={{
            display:'block', width:'100%',
            background:'var(--ink)', color:'var(--paper)',
            padding:'7px 0', borderRadius: 6, fontSize: 11, fontWeight: 500
          }}>● 記録を開始</button>
        </div>
        {/* Toolbar dot */}
        <div style={{
          position:'absolute', top: 14, left: 14,
          padding:'5px 10px', background:'var(--paper)', border:'1px solid var(--line)',
          borderRadius: 7, fontFamily:'var(--font-mono)', fontSize: 10, color:'var(--ink-3)',
          display:'flex', alignItems:'center', gap:6
        }}>
          <span style={{ width:10, height:10, borderRadius: 3, background:'linear-gradient(135deg, oklch(0.66 0.16 250), oklch(0.58 0.16 270))' }}></span>
          chrome://extensions
        </div>
      </div>
    );
  }
  if (idx === 1){
    // Click + arrow trail visual
    return (
      <div className="visual">
        <div className="svgrid"></div>
        <svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid meet"
             style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
          {[
            { x: 60, y: 40, n: 1 },
            { x: 165, y: 75, n: 2 },
            { x: 260, y: 110, n: 3 },
          ].map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="15" fill="none" stroke="oklch(0.58 0.20 25)" strokeWidth="2"/>
              <text x={p.x} y={p.y+4} textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono, monospace" fill="oklch(0.50 0.20 25)" fontWeight="600">{p.n}</text>
            </g>
          ))}
        </svg>
      </div>
    );
  }
  // idx 2 — Notion preview growing
  return (
    <div className="visual" style={{ padding: 12 }}>
      <div className="svgrid"></div>
      <div style={{
        position:'absolute', inset: 16,
        background:'var(--paper)', border:'1px solid var(--line)',
        borderRadius: 8, padding: 12, fontSize: 11,
        boxShadow:'var(--shadow-sm)'
      }}>
        <div style={{ fontWeight: 600, color:'var(--ink)', fontSize: 12, marginBottom: 8 }}>
          📋 操作マニュアル
        </div>
        {[1,2,3].map((n) => (
          <div key={n} style={{ display:'flex', gap:8, padding:'4px 0', borderTop: n>1 ? '1px dashed var(--line)' : 0 }}>
            <span style={{
              width:14, height:14, borderRadius:'50%',
              background:'transparent', color:'oklch(0.50 0.20 25)',
              border:'1.5px solid oklch(0.58 0.20 25)',
              display:'grid', placeItems:'center', fontSize:9, fontFamily:'monospace', fontWeight:600,
              flexShrink: 0, marginTop: 1
            }}>{n}</span>
            <div style={{ flex:1 }}>
              <div style={{ height:6, borderRadius:2, background:'var(--bg-3)', width: `${[80,65,72][n-1]}%` }}></div>
              <div style={{ height:18, borderRadius:3, background:'linear-gradient(135deg, var(--bg-2), var(--bg-3))', marginTop:4 }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowSection({ copy }){
  return (
    <section className="section" id="how" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div className="container">
        <Eyebrow>{copy.tag}</Eyebrow>
        <h2 className="h2">{copy.h2}</h2>
        <p className="section-lede">{copy.lede}</p>
        <div className="steps">
          {copy.steps.map((s, i) => (
            <div key={i} className="step">
              <div className="num-lg">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
              <StepVisual idx={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BeforeAfter({ copy }){
  return (
    <section className="section" id="ba">
      <div className="container">
        <Eyebrow>{copy.tag}</Eyebrow>
        <h2 className="h2">{copy.h2}</h2>
        <div className="ba">
          <div className="ba-col">
            <div className="ba-head">
              <div className="ba-label">{copy.before.label}</div>
              <div className="ba-time">{copy.before.time}</div>
            </div>
            <ul className="ba-list">
              {copy.before.items.map((t, i) => (
                <li key={i}>
                  <span className="mark x">×</span>
                  <span style={{ color: 'var(--ink-3)' }}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ba-col">
            <div className="ba-head">
              <div className="ba-label" style={{ color:'var(--accent-ink)' }}>{copy.after.label}</div>
              <div className="ba-time">{copy.after.time}</div>
            </div>
            <ul className="ba-list">
              {copy.after.items.map((t, i) => (
                <li key={i}>
                  <span className="mark o">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatVisual({ kind }){
  if (kind === "shot"){
    return (
      <div className="visual">
        <div style={{
          position:'absolute', left: 14, bottom: 14, right: 50, top: 14,
          background:'var(--paper)', border:'1px solid var(--line)',
          borderRadius: 8, overflow:'hidden'
        }}>
          <div style={{ height: 16, background:'var(--bg-2)', borderBottom:'1px solid var(--line)' }}></div>
          <div style={{ padding: 10, display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ height: 8, width: '70%', borderRadius: 3, background:'var(--bg-3)' }}></div>
            <div style={{ height: 8, width: '50%', borderRadius: 3, background:'var(--bg-3)' }}></div>
            <div style={{ height: 28, borderRadius: 4, background:'linear-gradient(135deg, var(--bg-2), var(--bg-3))', marginTop: 4 }}></div>
          </div>
        </div>
        {/* number markers - red circles */}
        {[{x:'70%',y:'30%',n:1},{x:'82%',y:'62%',n:2}].map((p,i) => (
          <span key={i} style={{
            position:'absolute', left: p.x, top: p.y, transform:'translate(-50%,-50%)',
            width:26, height:26, borderRadius:'50%',
            background:'transparent', color:'oklch(0.50 0.20 25)',
            border: '2px solid oklch(0.58 0.20 25)',
            display:'grid', placeItems:'center',
            fontSize: 11, fontFamily:'JetBrains Mono, monospace', fontWeight: 600,
            boxShadow:'0 0 0 3px color-mix(in oklab, oklch(0.58 0.20 25) 14%, transparent)'
          }}>{p.n}</span>
        ))}
      </div>
    );
  }
  if (kind === "ai"){
    return (
      <div className="visual" style={{ padding: 14 }}>
        <div style={{
          background:'var(--paper)', border:'1px solid var(--line)',
          borderRadius: 8, padding: 12, fontSize: 11.5, color:'var(--ink-3)'
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <span style={{
              fontFamily:'var(--font-mono)', fontSize:10,
              color:'var(--accent-ink)', background:'var(--accent-soft)',
              border:'1px solid color-mix(in oklab, var(--accent) 18%, transparent)',
              padding:'2px 6px', borderRadius: 4
            }}>Gemini AI</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize: 10 }}>step_02.png</span>
          </div>
          <div style={{ display:'flex', gap:6, marginBottom: 6 }}>
            <span style={{ width:16, height:16, borderRadius:'50%', background:'transparent', color:'oklch(0.50 0.20 25)', border:'1.5px solid oklch(0.58 0.20 25)', display:'grid', placeItems:'center', fontSize: 9, fontFamily:'monospace', fontWeight:600 }}>2</span>
            <span style={{ color:'var(--ink)', fontWeight: 500, fontSize: 12 }}>設定アイコンをクリック</span>
          </div>
          <div style={{ fontSize: 11, color:'var(--ink-3)', lineHeight: 1.55 }}>
            右上の歯車アイコンをクリックすると、設定パネルが開きます。
          </div>
        </div>
      </div>
    );
  }
  if (kind === "notion"){
    return (
      <div className="visual" style={{ padding: 14 }}>
        <div style={{
          position:'absolute', inset: 14,
          background:'var(--paper)', border:'1px solid var(--line)',
          borderRadius: 8, padding: 10
        }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize: 9.5, color:'var(--ink-4)', marginBottom: 8 }}>NOTION.SO</div>
          <div style={{ display:'flex', flexDirection:'column', gap: 5 }}>
            <div style={{ height: 8, borderRadius: 2, background:'var(--bg-3)', width: '80%' }}></div>
            <div style={{ height: 6, borderRadius: 2, background:'var(--bg-3)', width: '60%' }}></div>
            <div style={{ height: 22, borderRadius: 4, background:'linear-gradient(135deg, var(--bg-2), var(--bg-3))', marginTop: 4 }}></div>
            <div style={{ height: 6, borderRadius: 2, background:'var(--bg-3)', width: '70%', marginTop: 4 }}></div>
          </div>
        </div>
      </div>
    );
  }
  if (kind === "pdf"){
    return (
      <div className="visual">
        <div style={{
          position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%) rotate(-3deg)',
          width: 90, height: 110,
          background:'var(--paper)', border:'1px solid var(--line)',
          borderRadius: 4, padding: 8, fontFamily:'var(--font-mono)',
          fontSize: 8, color:'var(--ink-4)',
          boxShadow:'var(--shadow-md)'
        }}>
          PDF
          <div style={{ display:'flex', flexDirection:'column', gap:3, marginTop:6 }}>
            {[80,60,70,40,75,55].map((w,i) => (
              <div key={i} style={{ height: 4, background:'var(--bg-3)', width: `${w}%` }}></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (kind === "mask"){
    return (
      <div className="visual" style={{ padding: 14, display:'grid', placeItems:'center' }}>
        <div style={{
          background:'var(--paper)', border:'1px solid var(--line)',
          borderRadius: 6, padding:'8px 10px', fontSize: 11,
          fontFamily:'var(--font-mono)', display:'flex', flexDirection:'column', gap: 5
        }}>
          <span>email: <span style={{ background:'var(--ink)', color:'var(--ink)', borderRadius:2, padding:'0 16px', filter:'blur(2px)' }}>·····</span></span>
          <span>card:&nbsp; <span style={{ background:'var(--ink)', color:'var(--ink)', borderRadius:2, padding:'0 28px', filter:'blur(2px)' }}>·····</span></span>
          <span>name:&nbsp; <span style={{ background:'var(--ink)', color:'var(--ink)', borderRadius:2, padding:'0 22px', filter:'blur(2px)' }}>·····</span></span>
        </div>
      </div>
    );
  }
  if (kind === "lock"){
    return (
      <div className="visual" style={{ display:'grid', placeItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 12, fontFamily:'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          <span style={{ padding:'6px 10px', background:'var(--paper)', border:'1px solid var(--line)', borderRadius: 6 }}>browser</span>
          <span>—</span>
          <span style={{ padding:'6px 10px', background:'var(--paper)', border:'1px dashed var(--line-2)', borderRadius: 6, color:'var(--ink-4)', textDecoration:'line-through' }}>our&nbsp;server</span>
          <span>→</span>
          <span style={{ padding:'6px 10px', background:'var(--ink)', color:'var(--paper)', borderRadius: 6 }}>your Notion</span>
        </div>
      </div>
    );
  }
  return <div className="visual"></div>;
}

function FeatIcon({ kind }){
  // Minimal stroke icons
  const stroke = "currentColor";
  const sw = 1.5;
  const w = 18, h = 18;
  if (kind === "shot") return (
    <svg width={w} height={h} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="4" width="14" height="10" rx="2" stroke={stroke} strokeWidth={sw}/>
      <circle cx="9" cy="9" r="2.5" stroke={stroke} strokeWidth={sw}/>
    </svg>
  );
  if (kind === "ai") return (
    <svg width={w} height={h} viewBox="0 0 18 18" fill="none">
      <path d="M9 2L10.5 6.5L15 8L10.5 9.5L9 14L7.5 9.5L3 8L7.5 6.5L9 2Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
    </svg>
  );
  if (kind === "notion") return (
    <svg width={w} height={h} viewBox="0 0 18 18" fill="none">
      <rect x="3" y="3" width="12" height="12" rx="1.5" stroke={stroke} strokeWidth={sw}/>
      <path d="M6 6V12M6 6L12 12V6" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
  if (kind === "pdf") return (
    <svg width={w} height={h} viewBox="0 0 18 18" fill="none">
      <path d="M4 2h7l3 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
      <path d="M11 2v3h3" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
    </svg>
  );
  if (kind === "mask") return (
    <svg width={w} height={h} viewBox="0 0 18 18" fill="none">
      <path d="M2 9s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke={stroke} strokeWidth={sw}/>
      <circle cx="9" cy="9" r="2" stroke={stroke} strokeWidth={sw}/>
      <path d="M3 3l12 12" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  );
  if (kind === "lock") return (
    <svg width={w} height={h} viewBox="0 0 18 18" fill="none">
      <rect x="3.5" y="8" width="11" height="7.5" rx="1.5" stroke={stroke} strokeWidth={sw}/>
      <path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke={stroke} strokeWidth={sw}/>
    </svg>
  );
  return null;
}

function FeaturesSection({ copy }){
  return (
    <section className="section" id="features">
      <div className="container">
        <Eyebrow>{copy.tag}</Eyebrow>
        <h2 className="h2">{copy.h2}</h2>
        <p className="section-lede">{copy.lede}</p>
        <div className="features">
          {copy.items.map((it, i) => (
            <article key={i} className={"feat " + it.size}>
              <span className="ico"><FeatIcon kind={it.visual} /></span>
              <h3>{it.t}</h3>
              <p>{it.d}</p>
              <FeatVisual kind={it.visual} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ copy }){
  return (
    <section className="section" id="pricing" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div className="container">
        <Eyebrow>{copy.tag}</Eyebrow>
        <h2 className="h2">{copy.h2}</h2>
        <p className="section-lede">{copy.lede}</p>
        <div className="pricing">
          {copy.plans.map((p, i) => (
            <div key={i} className={"plan " + (p.featured ? "featured" : "")}>
              {p.ribbon && <span className="ribbon">{p.ribbon}</span>}
              <div className="name">{p.name}</div>
              <div className="price">{p.price}<small>{p.per}</small></div>
              <div className="desc">{p.desc}</div>
              <ul>
                {p.features.map((f, j) => (
                  <li key={j}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#" className={"btn btn-lg " + (p.featured ? "btn-primary" : "btn-ghost")}>
                {p.cta}
              </a>
            </div>
          ))}
        </div>
        <div style={{ textAlign:'center', marginTop: 24, fontFamily:'var(--font-mono)', fontSize: 12, color:'var(--ink-4)', letterSpacing:'.05em' }}>
          {copy.foot}
        </div>
      </div>
    </section>
  );
}

function FAQSection({ copy }){
  return (
    <section className="section" id="faq">
      <div className="container" style={{ maxWidth: 880 }}>
        <Eyebrow>{copy.tag}</Eyebrow>
        <h2 className="h2">{copy.h2}</h2>
        <div className="faq">
          {copy.items.map((it, i) => (
            <details key={i}>
              <summary>
                <span>{it.q}</span>
                <span className="plus">+</span>
              </summary>
              <div className="ans">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ copy }){
  return (
    <section className="container" id="cta">
      <div className="final-cta">
        <div className="final-cta-inner">
          <div>
            <h2>{copy.h2}</h2>
            <p>{copy.lede}</p>
          </div>
          <div className="actions">
            <a href="#" className="btn btn-primary btn-lg">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M7 1v6l4 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {copy.ctaPrimary}
            </a>
            <div className="small">{copy.foot}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ copy }){
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <span className="brand-mark"></span>
          <div>
            <div style={{ color:'var(--ink)', fontWeight:600, fontSize: 14 }}>Chrome Manual Maker</div>
            <div style={{ fontSize: 12, color:'var(--ink-4)', marginTop: 2 }}>{copy.desc}</div>
          </div>
        </div>
        <div className="footer-links">
          {copy.links.map((l, i) => <a key={i} href="#">{l}</a>)}
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize: 12, color:'var(--ink-4)' }}>{copy.copy}</div>
      </div>
    </footer>
  );
}

Object.assign(window, {
  ProblemSection, HowSection, BeforeAfter, FeaturesSection, PricingSection, FAQSection, FinalCTA, Footer
});
