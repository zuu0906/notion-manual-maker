// screen-reader.js — 現在画面のスクショ + OCR（W3 本実装）
//
// 既存 main.js の `capture:screenshot`（desktopCapturer 物理解像度キャプチャ）と
// ocr.ps1（WinRT OCR）のパターンを再利用する。
//
// 【座標系】automation は物理px統一（interfaces.js 参照）。
//   - capture() は物理解像度でキャプチャするので、画像px = 物理px。
//   - ocr() は ocr.ps1 が返す画像px座標を「そのまま」物理pxとして返す
//     （ocr-detector.js は記録/PII用途で scaleFactor 除算するが、ここでは除算しない）。

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const OCR_SCRIPT = path.join(__dirname, '..', 'ocr.ps1');

/**
 * 現在のプライマリ画面を物理解像度でキャプチャする。
 * desktopCapturer は Electron main から呼べる（renderer 不要）。
 * @returns {Promise<{dataUrl:string,width:number,height:number,scaleFactor:number}>}
 *   width/height は物理px。
 */
async function capture() {
  // electron は automation 内に持ち込まず、呼び出し時に解決（テスト容易性・隔離）
  const { screen, desktopCapturer } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { bounds, scaleFactor } = display;
  const physW = Math.round(bounds.width * scaleFactor);
  const physH = Math.round(bounds.height * scaleFactor);

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 200));
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: physW, height: physH },
    });
    if (!sources || sources.length === 0) continue;
    const thumb = sources[0].thumbnail;
    if (thumb.isEmpty()) continue;
    return { dataUrl: thumb.toDataURL(), width: physW, height: physH, scaleFactor };
  }
  throw new Error('screen_capture_failed');
}

/**
 * dataUrl（無ければ capture() で取得）をOCRし、単語を物理px座標で返す。
 * @param {string} [dataUrl] data:image/png;base64,...
 * @returns {Promise<{words:{text:string,x:number,y:number,w:number,h:number}[]}>}
 */
async function ocr(dataUrl) {
  if (!dataUrl) {
    const cap = await capture();
    dataUrl = cap.dataUrl;
  }
  const tmp = path.join(os.tmpdir(), `cmm-auto-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
  try {
    const raw = await runOcr(tmp);
    const words = raw.map((w) => ({ text: w.t, x: w.x, y: w.y, w: w.w, h: w.h }));
    return { words };
  } finally {
    fs.unlink(tmp, () => {});
  }
}

// ocr.ps1 を実行して [{t,x,y,w,h}]（画像px）を返す。失敗時は []。
// ocr-detector.js の runOcr と同等だが、automation 隔離のため内製。
function runOcr(imagePath) {
  return new Promise((resolve) => {
    execFile(
      'powershell',
      ['-Sta', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR_SCRIPT, '-ImagePath', imagePath],
      { timeout: 15000, windowsHide: true },
      (err, stdout) => {
        if (err) { resolve([]); return; }
        try {
          const parsed = JSON.parse(String(stdout).trim());
          resolve(Array.isArray(parsed) ? parsed : [parsed]);
        } catch {
          resolve([]);
        }
      }
    );
  });
}

module.exports = { capture, ocr };
