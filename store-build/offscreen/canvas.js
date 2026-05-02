chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'DRAW_ANNOTATION') return;
  drawAnnotation(msg).then(sendResponse);
  return true;
});

async function drawAnnotation({ dataUrl, clicks }) {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  for (const click of clicks) {
    drawArrow(ctx, click.x, click.y, click.stepNumber);
  }

  return { annotatedDataUrl: canvas.toDataURL('image/png') };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawArrow(ctx, x, y, stepNumber) {
  const OFFSET = 36;
  const ax = x - OFFSET;
  const ay = y - OFFSET;

  ctx.save();
  ctx.strokeStyle = '#FF3B30';
  ctx.fillStyle = '#FF3B30';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(x - 8, y - 8);
  ctx.stroke();

  const angle = Math.atan2(y - 8 - ay, x - 8 - ax);
  const headLen = 14;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 8);
  ctx.lineTo(x - 8 - headLen * Math.cos(angle - Math.PI / 6), y - 8 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x - 8 - headLen * Math.cos(angle + Math.PI / 6), y - 8 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(ax, ay, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#FF3B30';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stepNumber, ax, ay);
  ctx.restore();
}
