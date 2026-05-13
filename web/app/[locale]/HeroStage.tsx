'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface StageCopy {
  urlHost: string;
  urlPath: string;
  ext: string;
  side: readonly string[];
  sideSection: string;
  statTitles: readonly string[];
  steps: readonly string[];
  stepsAI: readonly string[];
  notionTitle: string;
  notionMeta: string;
  replay: string;
  capturing: string;
  saved: string;
}

interface Shot { idx: number; x: number; y: number; label: string; }
interface Block { idx: number; k: string; ai: string; }

function CursorSVG() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 3L19 12L12 13.5L9.5 20L5 3Z" fill="#1F1D1A" stroke="white" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

function AppMock({ copy }: { copy: StageCopy }) {
  return (
    <div className="app-mock">
      <aside className="app-side">
        <div className="side-logo">
          <span className="sq"></span>
          <span>Acme HQ</span>
        </div>
        <div className="side-section">{copy.sideSection}</div>
        {copy.side.map((label, i) => (
          <div key={i} className={'side-item ' + (i === 1 ? 'active' : '')}>
            <span className="ico"></span>
            <span>{label}</span>
          </div>
        ))}
      </aside>
      <header className="app-top">
        <div className="top-search">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor"/>
            <path d="M8 8L11 11" stroke="currentColor" strokeLinecap="round"/>
          </svg>
          <span>Search…</span>
        </div>
        <div className="top-actions">
          <button className="gear" aria-label="Settings">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.5 2.5l1 1M10.5 10.5l1 1M2.5 11.5l1-1M10.5 3.5l1-1"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="avatar"></div>
        </div>
      </header>
      <main className="app-main">
        <div className="card-row">
          {copy.statTitles.map((t, i) => (
            <div key={i} className="stat-card">
              <div className="lbl">{t}</div>
              <div className="val">{['¥1.2M', '3,482', '1.4%'][i]}</div>
              <div className="delta">{['+12.4%', '+248', '−0.3%'][i]}</div>
            </div>
          ))}
        </div>
        <div className="table">
          <div className="tr"><div>NAME</div><div>STATUS</div><div>ROLE</div><div></div></div>
          {[
            { n: 'Yui Tanaka', s: 'Active', r: 'Admin', p: 'ok' },
            { n: 'Mark Chen', s: 'Pending', r: 'Member', p: 'warn' },
            { n: 'Sora Park', s: 'Active', r: 'Member', p: 'ok' },
            { n: 'Kenji Sato', s: 'Inactive', r: 'Viewer', p: 'muted' },
          ].map((row, i) => (
            <div key={i} className="tr">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg, oklch(0.66 0.16 250), oklch(0.58 0.16 270))' }}></span>
                <span style={{ color: 'var(--ink-2)' }}>{row.n}</span>
              </div>
              <div><span className={'pill ' + row.p}>{row.s}</span></div>
              <div style={{ color: 'var(--ink-3)' }}>{row.r}</div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>···</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const ANNO_MAP = [
  { ax: 88, ay: 18, dir: 'tl' as const },
  { ax: 60, ay: 50, dir: 'tr' as const },
  { ax: 84, ay: 78, dir: 'tl' as const },
];

function ShotCard({ shot, index, total }: { shot: Shot; index: number; total: number }) {
  const [show, setShow] = useState(false);
  const [annoShow, setAnnoShow] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShow(true), 30);
    const t2 = setTimeout(() => setAnnoShow(true), 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const a = ANNO_MAP[(shot.idx - 1) % ANNO_MAP.length];

  return (
    <div
      className={'shot ' + (show ? 'show' : '')}
      style={{ left: `${6 + index * 4}%`, top: `${8 + index * 7}%`, width: '44%', zIndex: 6 + index }}
    >
      <div className="crop">
        <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <rect x="0" y="0" width="320" height="180" fill="#FBFAF7"/>
          <rect x="0" y="0" width="320" height="22" fill="#F4F1EB"/>
          <rect x="10" y="7" width="60" height="8" rx="2" fill="#E7E2D9"/>
          <rect x="80" y="6" width="120" height="10" rx="3" fill="#FFFFFF" stroke="#E7E2D9"/>
          <rect x="270" y="6" width="40" height="10" rx="3" fill="#E7E2D9"/>
          <rect x="0" y="22" width="64" height="158" fill="#FBFAF7" stroke="#EAE7E1"/>
          <g transform="translate(8, 32)">
            <rect width="48" height="6" rx="2" fill="#D9D3C7"/>
            <rect y="14" width="40" height="6" rx="2" fill="#EAE7E1"/>
            <rect y="26" width="44" height="6" rx="2" fill="#EAE7E1"/>
            <rect y="38" width="38" height="6" rx="2" fill="#EAE7E1"/>
          </g>
          <g transform="translate(76, 34)">
            <rect width="72" height="44" rx="5" fill="#FFFFFF" stroke="#EAE7E1"/>
            <rect width="72" height="44" rx="5" x="80" fill="#FFFFFF" stroke="#EAE7E1"/>
            <rect width="72" height="44" rx="5" x="160" fill="#FFFFFF" stroke="#EAE7E1"/>
            <rect width="232" height="86" rx="6" y="56" fill="#FFFFFF" stroke="#EAE7E1"/>
            <line x1="0" y1="76" x2="232" y2="76" stroke="#EAE7E1"/>
            <line x1="0" y1="96" x2="232" y2="96" stroke="#EAE7E1"/>
            <line x1="0" y1="116" x2="232" y2="116" stroke="#EAE7E1"/>
          </g>
          <circle cx={a.ax * 3.2} cy={a.ay * 1.8} r="34" fill="oklch(0.55 0.13 250)" opacity="0.06"/>
        </svg>
        <div
          className={'anno ' + (annoShow ? 'show' : '')}
          style={{ left: `${a.ax}%`, top: `${a.ay}%`, transform: 'translate(-50%,-50%)' }}
        >
          <div className="num">{shot.idx}</div>
        </div>
        <svg
          className={'anno ' + (annoShow ? 'show' : '')}
          style={{ left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          viewBox="0 0 100 100" preserveAspectRatio="none"
        >
          <circle cx={a.ax} cy={a.ay} r="6" fill="none" stroke="oklch(0.58 0.20 25)"
            strokeWidth="1.6" vectorEffect="non-scaling-stroke" opacity="0.95"/>
        </svg>
      </div>
      <div className="meta">
        <div className="left">
          <span className="badge">{`#${shot.idx}`}</span>
          <span>{shot.label}</span>
        </div>
        <span>{`${shot.idx} / ${total}`}</span>
      </div>
    </div>
  );
}

function NotionPreview({ copy, blocks }: { copy: StageCopy; blocks: Block[] }) {
  return (
    <div className={'notion-preview ' + (blocks.length > 0 ? 'show' : '')}>
      <div className="np-head">
        <span className="dot-r"></span><span className="dot-y"></span><span className="dot-g"></span>
        <span style={{ marginLeft: 4 }}>{copy.notionMeta}</span>
      </div>
      <div className="np-body">
        <div className="np-title">{copy.notionTitle}</div>
        {blocks.map((b, i) => (
          <div key={i} className="np-block show">
            <div className="n">{b.idx}</div>
            <div className="txt">
              <div><span className="k">{b.k}</span></div>
              <div style={{ marginTop: 4, color: 'var(--ink-3)', fontSize: 11.5, lineHeight: 1.5 }}>
                <span className="ai">AI</span>{b.ai}
              </div>
              <div className="thumb"></div>
            </div>
          </div>
        ))}
        {blocks.length < 3 && (
          <div className="np-block show" style={{ opacity: 0.5 }}>
            <div className="n" style={{ background: 'var(--line-2)' }}>+</div>
            <div className="txt" style={{ color: 'var(--ink-4)', fontSize: 12 }}>…</div>
          </div>
        )}
      </div>
    </div>
  );
}

const TARGETS = [
  { x: 92, y: 12 },
  { x: 60, y: 38 },
  { x: 88, y: 76 },
];

export default function HeroStage({ copy }: { copy: StageCopy }) {
  const flashRef = useRef<HTMLDivElement>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [savedBlocks, setSavedBlocks] = useState<Block[]>([]);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 80 });
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runIdRef = useRef(0);

  const clearTimers = () => { timeoutsRef.current.forEach(clearTimeout); timeoutsRef.current = []; };
  const wait = (ms: number) => new Promise<void>((res) => {
    const t = setTimeout(res, ms); timeoutsRef.current.push(t);
  });

  const runSequence = useCallback(async () => {
    runIdRef.current++;
    const myRun = runIdRef.current;
    clearTimers();
    setShots([]); setSavedBlocks([]); setRipple(null);
    setCursorPos({ x: 8, y: 92 });
    await wait(500);
    if (myRun !== runIdRef.current) return;

    for (let i = 0; i < TARGETS.length; i++) {
      if (myRun !== runIdRef.current) return;
      const t = TARGETS[i];
      setCursorPos({ x: t.x, y: t.y });
      await wait(900);
      if (myRun !== runIdRef.current) return;

      setRipple({ x: t.x, y: t.y, key: Date.now() });
      await wait(180);
      if (myRun !== runIdRef.current) return;

      if (flashRef.current) {
        flashRef.current.classList.remove('go');
        void flashRef.current.offsetWidth;
        flashRef.current.classList.add('go');
      }
      await wait(280);
      if (myRun !== runIdRef.current) return;

      setShots((prev) => [...prev, { idx: i + 1, x: t.x, y: t.y, label: copy.steps[i] }]);
      await wait(700);
      if (myRun !== runIdRef.current) return;

      setSavedBlocks((prev) => [...prev, { idx: i + 1, k: copy.steps[i], ai: copy.stepsAI[i] }]);
      await wait(700);
    }

    await wait(2400);
    if (myRun !== runIdRef.current) return;
    runSequence();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy.notionTitle]);

  useEffect(() => {
    runSequence();
    return () => { clearTimers(); runIdRef.current++; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy.notionTitle]);

  return (
    <div className="stage-wrap">
      <div className="float float-1">
        <span className="pip"></span>
        <span>{copy.capturing}</span>
      </div>
      <div className="float float-2">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5L5 9.5L10 3.5" stroke="oklch(0.55 0.13 155)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>{copy.saved}</span>
      </div>

      <div className="browser">
        <div className="browser-bar">
          <div className="tl"><span></span><span></span><span></span></div>
          <div className="url">
            <span className="lock">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <rect x="2.5" y="5" width="7" height="5" rx="1" stroke="currentColor"/>
                <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor"/>
              </svg>
            </span>
            <span className="path">{copy.urlHost}{copy.urlPath}</span>
          </div>
          <div className="ext-pill">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" fill="currentColor" opacity="0.25"/>
              <circle cx="5" cy="5" r="2" fill="currentColor"/>
            </svg>
            {copy.ext}
          </div>
        </div>

        <div className="browser-body">
          <button className="replay" onClick={runSequence}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6a4 4 0 1 0 1.2-2.85" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M3 1.5V4h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {copy.replay}
          </button>

          <AppMock copy={copy} />

          <div className="flash" ref={flashRef}></div>

          <div className="cursor" style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}>
            <CursorSVG />
          </div>

          {ripple && (
            <span key={ripple.key} className="ripple go"
                  style={{ left: `${ripple.x}%`, top: `${ripple.y}%` }} />
          )}

          {shots.map((s, i) => (
            <ShotCard key={i} shot={s} index={i} total={TARGETS.length} />
          ))}

          <NotionPreview copy={copy} blocks={savedBlocks} />
        </div>
      </div>
    </div>
  );
}
