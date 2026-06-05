const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const hintEl = document.getElementById('hint');
const blurBtn = document.getElementById('blur-btn');

let screenshot = null;
let screenWidth = 0;
let screenHeight = 0;
let stepNumber = 1;
let isFree = true;
let privacyBlurEnabled = true;
let captured = false;

// Blur mode state
let mode = 'click'; // 'click' | 'blur'
let piiRegions = []; // { x, y, w, h } in canvas coordinates
let dragStart = null;
let dragCurrent = null;

function drawOverlay() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(screenshot, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw committed blur regions
  ctx.fillStyle = '#1a1a1a';
  for (const r of piiRegions) {
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // Draw in-progress drag rectangle
  if (mode === 'blur' && dragStart && dragCurrent) {
    const rx = Math.min(dragStart.x, dragCurrent.x);
    const ry = Math.min(dragStart.y, dragCurrent.y);
    const rw = Math.abs(dragCurrent.x - dragStart.x);
    const rh = Math.abs(dragCurrent.y - dragStart.y);
    ctx.fillStyle = 'rgba(26, 26, 26, 0.7)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = 'rgba(255, 80, 60, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }
}

function toggleBlurMode() {
  mode = mode === 'blur' ? 'click' : 'blur';
  blurBtn.classList.toggle('active', mode === 'blur');
  hintEl.textContent = mode === 'blur'
    ? 'ドラッグしてぼかし範囲を選択 — [B] でモード切替'
    : 'クリックして撮影ポイントを選択 — Esc でキャンセル';
  canvas.style.cursor = mode === 'blur' ? 'crosshair' : 'crosshair';
}

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: Math.round((e.clientX - rect.left) * scaleX),
    y: Math.round((e.clientY - rect.top) * scaleY),
  };
}

function init({ dataUrl, screenWidth: sw, screenHeight: sh, stepNumber: sn, isFree: free, privacyBlurEnabled: pbe }) {
  screenWidth = sw;
  screenHeight = sh;
  stepNumber = sn;
  isFree = free ?? true;
  privacyBlurEnabled = pbe ?? true;
  piiRegions = [];
  canvas.width = sw;
  canvas.height = sh;
  canvas.style.width = sw + 'px';
  canvas.style.height = sh + 'px';

  if (!privacyBlurEnabled) {
    blurBtn.style.display = 'none';
  }

  const img = new Image();
  img.onload = () => {
    screenshot = img;
    drawOverlay();
  };
  img.onerror = (e) => {
    console.error('[overlay] img load ERROR', e);
  };
  img.src = dataUrl;
}

// ── Mouse events for blur mode ──────────────────────────────────────────────

canvas.addEventListener('mousedown', (e) => {
  if (mode !== 'blur' || !screenshot) return;
  dragStart = canvasCoords(e);
  dragCurrent = { ...dragStart };
});

canvas.addEventListener('mousemove', (e) => {
  if (mode !== 'blur' || !dragStart) return;
  dragCurrent = canvasCoords(e);
  drawOverlay();
});

canvas.addEventListener('mouseup', (e) => {
  if (mode !== 'blur' || !dragStart) return;
  const end = canvasCoords(e);
  const rx = Math.min(dragStart.x, end.x);
  const ry = Math.min(dragStart.y, end.y);
  const rw = Math.abs(end.x - dragStart.x);
  const rh = Math.abs(end.y - dragStart.y);
  if (rw > 4 && rh > 4) {
    piiRegions.push({ x: rx, y: ry, w: rw, h: rh });
  }
  dragStart = null;
  dragCurrent = null;
  drawOverlay();
});

// ── Click: capture step ─────────────────────────────────────────────────────

canvas.addEventListener('click', (e) => {
  if (!screenshot || captured || mode !== 'click') return;
  captured = true;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.round((e.clientX - rect.left) * scaleX);
  const y = Math.round((e.clientY - rect.top) * scaleY);

  // Annotated canvas: screenshot → blur regions → red circle → watermark
  const annotCanvas = document.createElement('canvas');
  annotCanvas.width = screenWidth;
  annotCanvas.height = screenHeight;
  const ac = annotCanvas.getContext('2d');
  ac.drawImage(screenshot, 0, 0, screenWidth, screenHeight);

  // Apply blur regions
  ac.fillStyle = '#1a1a1a';
  for (const r of piiRegions) {
    ac.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  }

  const scale = 1;

  // Red circle around click point
  ac.strokeStyle = '#FF3B30';
  ac.lineWidth = Math.max(4, Math.round(5 * scale));
  ac.beginPath();
  ac.arc(x, y, Math.round(18 * scale), 0, Math.PI * 2);
  ac.stroke();


  if (isFree) {
    const wmText = '◆ Notion Manual Maker';
    const fontSize = 12;
    ac.font = `${fontSize}px sans-serif`;
    const textWidth = ac.measureText(wmText).width;
    const padX = 10, padY = 6;
    const bgW = textWidth + padX * 2;
    const bgH = fontSize + padY * 2;
    const bgX = screenWidth - bgW - 12;
    const bgY = screenHeight - bgH - 10;
    const radius = bgH / 2;
    ac.fillStyle = 'rgba(0,0,0,0.18)';
    ac.beginPath();
    ac.roundRect(bgX, bgY, bgW, bgH, radius);
    ac.fill();
    ac.fillStyle = 'rgba(255,255,255,0.75)';
    ac.textAlign = 'left';
    ac.textBaseline = 'middle';
    ac.fillText(wmText, bgX + padX, bgY + bgH / 2);
  }

  const annotatedDataUrl = annotCanvas.toDataURL('image/png');

  // Raw canvas: screenshot + blur regions (no circle annotation)
  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = screenWidth;
  rawCanvas.height = screenHeight;
  const rc = rawCanvas.getContext('2d');
  rc.drawImage(screenshot, 0, 0, screenWidth, screenHeight);
  rc.fillStyle = '#1a1a1a';
  for (const r of piiRegions) {
    rc.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  }
  const rawDataUrl = rawCanvas.toDataURL('image/png');

  window.overlayAPI.sendCaptured({
    annotatedDataUrl,
    rawDataUrl,
    x, y,
    screenWidth,
    screenHeight,
    stepNumber,
    piiRegions,
  });
});

// ── Keyboard shortcuts ──────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.overlayAPI.cancel();
  if (e.key === 'b' || e.key === 'B') toggleBlurMode();
});

document.getElementById('cancel-btn').addEventListener('click', () => {
  window.overlayAPI.cancel();
});

blurBtn.addEventListener('click', () => toggleBlurMode());

// Receive initialization data from main process
window.overlayAPI.onInit((data) => init(data));

// Receive auto-detected PII regions separately (sent after init to avoid IPC size issues)
window.overlayAPI.onSetPii((regions) => {
  if (Array.isArray(regions) && regions.length > 0 && screenshot) {
    piiRegions = regions;
    drawOverlay();
  } else if (Array.isArray(regions) && regions.length > 0) {
    // screenshot not yet loaded — store and apply after image loads
    piiRegions = regions;
  }
});
