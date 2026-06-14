// matcher.js — ロケーター特定（純関数中心・W3 本実装）
//
// 第1階層 UIA スコアリング / 第2階層 OCRテキスト特定。すべて物理px。
// 論理px→物理pxの変換は toPhysical() に一元化（DPIズレ防止の要）。
//
// 返り値はすべて LocateResult: {x,y,confidence,method,reason}（物理px）。

const UIA_MIN_SCORE = 0.5; // これ未満のUIA一致はOCR/AIへ委ねる

/**
 * 記録時の論理px座標を物理pxへ変換。
 * @param {object} step
 * @param {number} scaleFactor 記録時の scaleFactor（無ければ step.scaleFactor、無ければ1）
 * @returns {{x:number,y:number}}
 */
function toPhysical(step, scaleFactor) {
  const sf = scaleFactor || step.scaleFactor || 1;
  return { x: Math.round(step.x * sf), y: Math.round(step.y * sf) };
}

// ── 第1階層: UIA ────────────────────────────────────────────────────────────
/**
 * 記録時の uia 情報で前面ウィンドウ内の要素を特定し、その中心を返す。
 * @param {object} step  step.uia（UiaInfo）が必要
 * @param {(uia:object)=>Promise<{rect:{x,y,w,h},score:number}|null>} uiaFind  input-driver.uiaFind
 * @returns {Promise<object|null>} LocateResult|null
 */
async function matchByUia(step, uiaFind) {
  if (!step || !step.uia || typeof uiaFind !== 'function') return null;
  // 特定に使える識別子が皆無なら諦める（誤特定防止）
  const u = step.uia;
  if (!u.automationId && !u.name && !u.controlType && !u.className) return null;

  let res;
  try { res = await uiaFind(u); } catch { return null; }
  if (!res || !res.rect) return null;
  const score = typeof res.score === 'number' ? res.score : 0;
  if (score < UIA_MIN_SCORE) return null;

  const r = res.rect;
  if (r.w <= 0 || r.h <= 0) return null;
  return {
    x: r.x + Math.round(r.w / 2),
    y: r.y + Math.round(r.h / 2),
    confidence: score,
    method: 'uia',
    reason: `uia score=${score}`,
  };
}

// ── 第2階層: OCRテキスト特定 ────────────────────────────────────────────────
// 記録時にクリックした要素のテキスト（label 優先、無ければ ocrContext の語）を
// 現在画面のOCR語から探し、その中心をクリック先とする。
// UI がレイアウト変更で移動しても「同じ文字の要素」を追えるのが狙い。

// 比較用正規化: 小文字化・空白除去・記号除去（日本語/英数字を残す）
function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

// ocrContext / label からターゲット候補語を抽出（長く distinctive なものを優先）
function targetCandidates(step) {
  const cands = [];
  if (step.label) cands.push(String(step.label).trim());
  if (step.ocrContext) {
    for (const tok of String(step.ocrContext).split(/[\s\n\r\t,、。・|/]+/)) {
      const t = tok.trim();
      if (norm(t).length >= 2) cands.push(t);
    }
  }
  // 重複除去・正規化長の降順（長い＝distinctive を先に試す）
  const seen = new Set();
  const uniq = [];
  for (const c of cands) {
    const n = norm(c);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    uniq.push(c);
  }
  return uniq.sort((a, b) => norm(b).length - norm(a).length);
}

// 現在語の中から target に一致する「単語 or 同一行の連続語」を探す。
// 優先順位: exact（単語完全一致）> multi（同一行の連続語を結合した一致）> contains。
// 上位の tier が1つでもあれば、その tier だけを返す（部分語の誤検出を防ぐ）。
// 返り値: [{box:{x,y,w,h}, kind:'exact'|'multi'|'contains'}]
function findMatches(target, words) {
  const nt = norm(target);
  if (!nt) return [];
  const exact = [];
  const contains = [];

  // 1) 単語単位: 完全一致 / 「OCR語がターゲット全体を含む」(例: target"送信" ⊂ word"送信する")
  for (const w of words) {
    const nw = norm(w.text);
    if (!nw) continue;
    if (nw === nt) exact.push({ box: box(w), kind: 'exact' });
    else if (nt.length >= 2 && nw.length > nt.length && nw.includes(nt)) {
      contains.push({ box: box(w), kind: 'contains' });
    }
  }
  if (exact.length) return exact;

  // 2) 同一行の連続語を結合して一致を探す（"新規 作成" が2語に分かれるケース）
  const multi = [];
  const rows = groupRows(words);
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      let joined = '';
      for (let j = i; j < row.length && j < i + 6; j++) {
        joined += norm(row[j].text);
        if (joined === nt) { multi.push({ box: unionBox(row.slice(i, j + 1)), kind: 'multi' }); break; }
        if (joined.length >= nt.length) {
          // 包含一致は「2語以上を結合した」場合のみ multi とする
          // （単一語が target を含むケースは contains tier に委ねる）
          if (j > i && joined.includes(nt)) multi.push({ box: unionBox(row.slice(i, j + 1)), kind: 'multi' });
          break;
        }
      }
    }
  }
  if (multi.length) return multi;

  return contains;
}

function box(w) { return { x: w.x, y: w.y, w: w.w, h: w.h }; }

function unionBox(ws) {
  const x1 = Math.min(...ws.map((w) => w.x));
  const y1 = Math.min(...ws.map((w) => w.y));
  const x2 = Math.max(...ws.map((w) => w.x + w.w));
  const y2 = Math.max(...ws.map((w) => w.y + w.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// 近い y を同一行とみなしてグループ化（行内は x 昇順）
function groupRows(words) {
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const w of sorted) {
    const cy = w.y + w.h / 2;
    const row = rows.find((r) => Math.abs(r.cy - cy) < Math.max(8, w.h * 0.6));
    if (row) { row.items.push(w); row.cy = (row.cy * (row.items.length - 1) + cy) / row.items.length; }
    else rows.push({ cy, items: [w] });
  }
  return rows.map((r) => r.items.sort((a, b) => a.x - b.x));
}

function center(b) { return { x: b.x + Math.round(b.w / 2), y: b.y + Math.round(b.h / 2) }; }

const KIND_CONF = { exact: 0.9, multi: 0.78, contains: 0.65 };

/**
 * OCRテキストでクリック先を特定する。
 * @param {object} step  step.label / step.ocrContext と、補助に step.x/y（記録時物理px）
 * @param {{text:string,x:number,y:number,w:number,h:number}[]} currentWords  物理px
 * @param {{w:number,h:number}} [curSize]  現在画面サイズ（物理px・任意）
 * @returns {object|null} LocateResult|null
 */
function matchByOcr(step, currentWords, curSize) {
  if (!step || !Array.isArray(currentWords) || currentWords.length === 0) return null;

  for (const target of targetCandidates(step)) {
    const matches = findMatches(target, currentWords);
    if (matches.length === 0) continue;

    // 複数候補がある場合、記録時クリック座標(step.x,step.y 物理px)に最も近いものを採用。
    // 近接情報が無い/差が小さい場合は曖昧として信頼度を下げる。
    let chosen = matches[0];
    let ambiguous = matches.length > 1;
    if (matches.length > 1 && typeof step.x === 'number' && typeof step.y === 'number') {
      const sf = step.scaleFactor || 1;
      const rx = step.x * sf, ry = step.y * sf; // 記録座標→物理px
      let best = Infinity;
      let secondBest = Infinity;
      for (const m of matches) {
        const c = center(m.box);
        const d = (c.x - rx) ** 2 + (c.y - ry) ** 2;
        if (d < best) { secondBest = best; best = d; chosen = m; }
        else if (d < secondBest) { secondBest = d; }
      }
      // 最近接が2番目と十分離れていれば曖昧でないとみなす
      if (secondBest === Infinity || best * 4 < secondBest) ambiguous = false;
    }

    const c = center(chosen.box);
    let conf = KIND_CONF[chosen.kind] || 0.6;
    if (ambiguous) conf = Math.min(conf, 0.5);
    return {
      x: c.x,
      y: c.y,
      confidence: conf,
      method: 'ocr',
      reason: `ocr ${chosen.kind} "${target}"${ambiguous ? ' (ambiguous)' : ''}`,
    };
  }
  return null;
}

module.exports = { toPhysical, matchByUia, matchByOcr };
