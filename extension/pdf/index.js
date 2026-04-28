document.getElementById('print-btn').addEventListener('click', () => window.print());
document.getElementById('close-btn').addEventListener('click', () => window.close());

chrome.storage.local.get('pdf_export', ({ pdf_export }) => {
  if (!pdf_export) {
    document.getElementById('content').textContent = 'データがありません。再度お試しください。';
    return;
  }

  const { title, steps } = pdf_export;
  document.title = title;

  const stepsHtml = steps.map(step => {
    const memoHtml = step.memo
      ? `<div class="step-memo">${step.memo.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
      : '';
    return `
      <div class="step">
        <div class="step-header">
          <div class="step-num">${step.stepNumber}</div>
          <span class="step-label">${(step.label || step.pageTitle || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
        </div>
        ${memoHtml}
        <img src="${step.annotatedDataUrl}" class="step-img" alt="step ${step.stepNumber}">
      </div>
    `;
  }).join('');

  document.getElementById('content').innerHTML = `<h1>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>${stepsHtml}`;

  chrome.storage.local.remove('pdf_export');

  const imgs = document.querySelectorAll('.step-img');
  if (imgs.length === 0) {
    setTimeout(() => window.print(), 300);
    return;
  }
  let loaded = 0;
  const onLoad = () => { if (++loaded === imgs.length) window.print(); };
  imgs.forEach(img => {
    if (img.complete) { onLoad(); } else { img.addEventListener('load', onLoad); img.addEventListener('error', onLoad); }
  });
});
