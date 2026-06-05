const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PII_PATTERNS = [
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/,          // メールアドレス
  /\b0\d{9,10}\b/,                                               // 日本の電話番号
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,                  // クレジットカード番号
  /\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/, // 日付
];

const OCR_SCRIPT = path.join(__dirname, 'ocr.ps1');

async function detectPiiRegions(dataUrl, scaleFactor = 1) {
  const tmp = path.join(os.tmpdir(), `cmm-ocr-${Date.now()}.png`);
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));

  try {
    const words = await runOcr(tmp);
    if (!words.length) return [];

    const regions = [];
    for (const word of words) {
      if (PII_PATTERNS.some(p => p.test(word.t))) {
        regions.push({
          x: Math.round(word.x / scaleFactor) - 2,
          y: Math.round(word.y / scaleFactor) - 2,
          w: Math.round(word.w / scaleFactor) + 4,
          h: Math.round(word.h / scaleFactor) + 4,
        });
      }
    }

    return mergeRegions(regions);
  } finally {
    fs.unlink(tmp, () => {});
  }
}

function runOcr(imagePath) {
  return new Promise((resolve) => {
    const start = Date.now();
    execFile(
      'powershell',
      ['-Sta', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR_SCRIPT, '-ImagePath', imagePath],
      { timeout: 15000, windowsHide: true },
      (err, stdout) => {
        if (err) { resolve([]); return; }
        try {
          const raw = stdout.trim();
          const parsed = JSON.parse(raw);
          resolve(Array.isArray(parsed) ? parsed : [parsed]);
        } catch {
          resolve([]);
        }
      }
    );
  });
}

function mergeRegions(regions) {
  if (!regions.length) return [];
  const sorted = [...regions].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    const sameRow = Math.abs(cur.y - prev.y) < 12;
    const adjacent = cur.x <= prev.x + prev.w + 24;
    if (sameRow && adjacent) {
      prev.w = Math.max(prev.x + prev.w, cur.x + cur.w) - prev.x;
      prev.h = Math.max(prev.h, cur.h);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

// Returns both PII regions and all OCR words (for context extraction)
async function detectPiiAndWords(dataUrl, scaleFactor = 1) {
  const tmp = path.join(os.tmpdir(), `cmm-ocr-${Date.now()}.png`);
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));

  try {
    const words = await runOcr(tmp);
    if (!words.length) return { piiRegions: [], words: [] };

    const regions = [];
    for (const word of words) {
      if (PII_PATTERNS.some(p => p.test(word.t))) {
        regions.push({
          x: Math.round(word.x / scaleFactor) - 2,
          y: Math.round(word.y / scaleFactor) - 2,
          w: Math.round(word.w / scaleFactor) + 4,
          h: Math.round(word.h / scaleFactor) + 4,
        });
      }
    }

    // Normalize word coordinates to logical pixels
    const scaledWords = words.map(w => ({
      t: w.t,
      x: Math.round(w.x / scaleFactor),
      y: Math.round(w.y / scaleFactor),
      w: Math.round(w.w / scaleFactor),
      h: Math.round(w.h / scaleFactor),
    }));

    return { piiRegions: mergeRegions(regions), words: scaledWords };
  } finally {
    fs.unlink(tmp, () => {});
  }
}

module.exports = { detectPiiRegions, detectPiiAndWords };
