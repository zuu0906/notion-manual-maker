(() => {
  if (window.__cmm_active) return;
  window.__cmm_active = true;

  let pendingEl = null;
  let privacyBlurEnabled = true;

  // PII検出結果のキャッシュ（同一ページで連続クリック時にDOM再走査を省略）
  let piiCache = null;
  let piiCacheTs = 0;
  const PII_CACHE_TTL = 3000;

  // スクロール時はビューポート座標がずれるためキャッシュを即時無効化
  function onScroll() { piiCache = null; piiCacheTs = 0; }
  window.addEventListener('scroll', onScroll, { passive: true });

  function getPiiRegions() {
    const now = Date.now();
    if (piiCache && now - piiCacheTs < PII_CACHE_TTL) return piiCache;

    const patterns = [
      /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/,
      /\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/,
      /\b0\d{9,10}\b/,
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
    ];
    const regions = [];

    // パスワード欄は値に関わらず常にぼかし
    document.querySelectorAll('input[type="password"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0)
        regions.push({ x: r.left, y: r.top, w: r.width, h: r.height });
    });

    // テキスト系 input の value もスキャン（テキストノードに現れないため）
    const inputSel = 'input[type="text"],input[type="email"],input[type="tel"],input[type="number"],input:not([type])';
    document.querySelectorAll(inputSel).forEach(el => {
      const val = el.value;
      if (val && patterns.some(p => p.test(val))) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0)
          regions.push({ x: r.left, y: r.top, w: r.width, h: r.height });
      }
    });

    // 大規模ページのDOM走査は上限を設けてメインスレッドの長時間ブロックを防ぐ
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    let checked = 0;
    while ((node = walker.nextNode()) && checked < 3000) {
      checked++;
      const text = node.textContent;
      if (!patterns.some(p => p.test(text))) continue;
      try {
        const range = document.createRange();
        range.selectNode(node);
        for (const r of range.getClientRects()) {
          if (r.width > 0 && r.height > 0)
            regions.push({ x: r.left, y: r.top, w: r.width, h: r.height });
        }
      } catch (_) {}
    }

    piiCache = regions;
    piiCacheTs = now;
    return regions;
  }

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0',
    zIndex: '2147483647',
    cursor: 'crosshair',
    background: 'rgba(0,0,0,0.08)',
  });

  const hint = document.createElement('div');
  Object.assign(hint.style, {
    position: 'fixed', top: '12px', left: '50%',
    transform: 'translateX(-50%)',
    background: '#1a1a1a', color: '#fff',
    padding: '8px 18px', borderRadius: '8px',
    fontSize: '14px', fontFamily: 'sans-serif',
    zIndex: '2147483647', pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  });
  hint.textContent = chrome.i18n.getMessage('contentHint');

  document.body.appendChild(hint);
  document.body.appendChild(overlay);
  overlay.setAttribute('tabindex', '-1');
  overlay.addEventListener('keydown', onKeyDown);
  setTimeout(() => { try { overlay.focus(); } catch(e) {} }, 300);

  overlay.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX;
    const y = e.clientY;

    // 一時的に pointer-events を外して下の要素を取得
    overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(x, y);
    overlay.style.pointerEvents = '';

    overlay.style.display = 'none';
    hint.style.display = 'none';

    const tag = el?.tagName?.toLowerCase() ?? '';
    const inputType = (el?.type ?? '').toLowerCase();
    const isContentEditable = el?.isContentEditable === true && tag !== 'input' && tag !== 'textarea';
    const isTextInput = (tag === 'input' && !['submit', 'button', 'checkbox', 'radio', 'file', 'image', 'reset'].includes(inputType))
                     || tag === 'textarea'
                     || isContentEditable;
    const isPassword = isTextInput && inputType === 'password';
    const isSelect = tag === 'select';

    let inputText = null;

    if (isPassword) {
      await showPasswordConfirm();
    } else if (isTextInput) {
      inputText = await promptTextInput(el, x, y);
      if (inputText !== null) {
        if (!isContentEditable) {
          el.focus();
          el.value = inputText;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    } else if (isSelect) {
      inputText = el.options[el.selectedIndex]?.text ?? null;
      pendingEl = el;
    } else {
      pendingEl = el;
    }

    const piiRegions = privacyBlurEnabled ? getPiiRegions() : [];
    chrome.runtime.sendMessage({
      type: 'CLICK_CAPTURED',
      x, y,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      inputText,
      isPassword: isPassword || false,
      elementHint: getElementHint(el),
      formNote: getFormNote(el),
      piiRegions,
    }).catch(() => {
      // Extension reloaded while page was open — reactivate on next click
      deactivate();
    });
  });

  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keydown', onKeyDown, true);

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      deactivate();
    }
  }

  function deactivate() {
    overlay.remove();
    hint.remove();
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onScroll);
    window.__cmm_active = false;
    pendingEl = null;
    chrome.runtime.sendMessage({ type: 'RECORDING_STOPPED' }).catch(() => {});
  }

  function showRipple(x, y) {
    const r = document.createElement('div');
    Object.assign(r.style, {
      position: 'fixed', left: x - 18 + 'px', top: y - 18 + 'px',
      width: '36px', height: '36px', borderRadius: '50%',
      border: '3px solid #FF3B30', pointerEvents: 'none',
      zIndex: '2147483647', animation: 'cmm-ripple 0.5s ease-out forwards',
    });
    if (!document.getElementById('cmm-style')) {
      const s = document.createElement('style');
      s.id = 'cmm-style';
      s.textContent = `@keyframes cmm-ripple{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(2)}}`;
      document.head.appendChild(s);
    }
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 500);
  }

  // 要素のテキストヒントを取得（ラベル自動生成用）
  function getElementHint(el) {
    if (!el) return '';

    // 1. aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy.split(' ')
        .map(id => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean).join(' ');
      if (text) return text.slice(0, 80);
    }

    // 2. <label for="id"> による明示的な紐付け
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const text = label?.textContent?.trim();
      if (text && text.length <= 80) return text;
    }

    // 3. 親 <label> に包まれている場合
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const text = parentLabel.textContent?.trim();
      if (text && text.length <= 80) return text;
    }

    // 4. fieldset > legend（フォームセクション名）
    const fieldset = el.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend')?.textContent?.trim();
      if (legend && legend.length <= 80) return legend;
    }

    // 5. 直近の兄弟・親要素にある見出し/ラベルテキスト
    const nearestLabel = findNearbyLabel(el);
    if (nearestLabel) return nearestLabel;

    // 6. 要素自身の属性
    const candidates = [
      el.innerText?.trim(),
      el.value?.trim(),
      el.getAttribute('aria-label'),
      el.getAttribute('placeholder'),
      el.getAttribute('title'),
      el.getAttribute('alt'),
      el.getAttribute('name'),
    ];
    for (const c of candidates) {
      if (c && c.length > 0 && c.length <= 80) return c;
    }
    return '';
  }

  function getFormNote(el) {
    if (!el) return '';

    // aria-describedby が最も信頼できる
    const describedBy = el.getAttribute('aria-describedby');
    if (describedBy) {
      const text = describedBy.split(' ')
        .map(id => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean).join(' ');
      if (text) return text.slice(0, 120);
    }

    // 直後の兄弟要素を最大2個チェック（ナビ・見出し・ボタン系は除外）
    const SKIP_TAGS = new Set(['A', 'BUTTON', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'NAV', 'HEADER', 'FOOTER', 'LABEL']);
    let node = el.nextElementSibling;
    for (let i = 0; i < 2 && node; i++) {
      if (!SKIP_TAGS.has(node.tagName)) {
        const text = node.textContent?.trim();
        if (text && text.length > 0 && text.length <= 120 && !/[{}<>]/.test(text)) return text;
      }
      node = node.nextElementSibling;
    }
    return '';
  }

  function findNearbyLabel(el) {
    // 直前の兄弟要素のテキスト（<dt>, <span>, <p> などのラベルパターン）
    let node = el.previousElementSibling;
    for (let i = 0; i < 3 && node; i++) {
      const text = node.textContent?.trim();
      if (text && text.length > 0 && text.length <= 60 && !/[{};<>]/.test(text)) return text;
      node = node.previousElementSibling;
    }
    return '';
  }

  // テキスト入力ダイアログ
  function promptTextInput(el, clickX, clickY) {
    return new Promise((resolve) => {
      const fieldHint = el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('name') || chrome.i18n.getMessage('thisField');
      const card = createCard(chrome.i18n.getMessage('inputDialogTitle', [fieldHint]));

      const input = document.createElement('input');
      Object.assign(input.style, {
        width: '100%', padding: '6px 8px',
        border: '1px solid #ccc', borderRadius: '4px',
        fontSize: '13px', outline: 'none',
        boxSizing: 'border-box', marginBottom: '8px',
        fontFamily: 'sans-serif',
      });
      input.placeholder = chrome.i18n.getMessage('inputDialogPlaceholder');

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';

      const cancelBtn = createBtn(chrome.i18n.getMessage('skip'), '#f0f0f0', '#333');
      const okBtn = createBtn('OK', '#1a1a1a', '#fff');

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(okBtn);
      card.appendChild(input);
      card.appendChild(btnRow);
      positionCard(card, clickX, clickY);
      document.body.appendChild(card);
      input.focus();

      const done = (value) => {
        card.remove();
        resolve(value);
      };

      okBtn.addEventListener('click', () => done(input.value));
      cancelBtn.addEventListener('click', () => done(null));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); done(input.value); }
        if (e.key === 'Escape') { e.preventDefault(); done(null); }
        e.stopPropagation();
      });
    });
  }

  // パスワード確認ダイアログ
  function showPasswordConfirm() {
    return new Promise((resolve) => {
      const card = createCard(chrome.i18n.getMessage('passwordDialogTitle'));

      const msg = document.createElement('p');
      msg.style.cssText = 'font-size:12px;color:#555;margin-bottom:10px;line-height:1.5;';
      msg.textContent = chrome.i18n.getMessage('passwordDialogMsg');

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';

      const okBtn = createBtn('OK', '#1a1a1a', '#fff');
      btnRow.appendChild(okBtn);
      card.appendChild(msg);
      card.appendChild(btnRow);
      positionCard(card, window.innerWidth / 2, window.innerHeight / 2);
      document.body.appendChild(card);
      okBtn.focus();

      const done = () => { card.remove(); resolve(); };
      okBtn.addEventListener('click', done);
      document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          document.removeEventListener('keydown', handler, true);
          done();
        }
      }, true);
    });
  }

  function createCard(title) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      position: 'fixed',
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.15)',
      borderRadius: '8px',
      padding: '12px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      zIndex: '2147483647',
      minWidth: '220px', maxWidth: '280px',
      fontFamily: 'sans-serif',
    });
    const h = document.createElement('div');
    h.style.cssText = 'font-size:12px;font-weight:600;color:#1a1a1a;margin-bottom:8px;';
    h.textContent = title;
    card.appendChild(h);
    return card;
  }

  function createBtn(text, bg, color) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      padding: '5px 12px', border: 'none', borderRadius: '4px',
      background: bg, color, fontSize: '12px', fontWeight: '600',
      cursor: 'pointer', fontFamily: 'sans-serif',
    });
    btn.textContent = text;
    return btn;
  }

  function positionCard(card, x, y) {
    // まず画面に追加してサイズを測る
    card.style.visibility = 'hidden';
    card.style.top = '0px';
    card.style.left = '0px';
    document.body.appendChild(card);
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    card.remove();
    card.style.visibility = '';

    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(x - w / 2, margin), vw - w - margin);
    const top = (y + 20 + h < vh) ? y + 20 : y - h - 10;
    card.style.left = left + 'px';
    card.style.top = Math.max(margin, top) + 'px';
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STOP_RECORDING') deactivate();
    if (msg.type === 'PRIVACY_SETTING') privacyBlurEnabled = msg.enabled;
    if (msg.type === 'CAPTURE_DONE') {
      overlay.style.display = 'block';
      hint.style.display = 'block';
      showRipple(msg.x, msg.y);
      if (pendingEl) {
        const el = pendingEl;
        pendingEl = null;
        try { el.click(); } catch(e) {}
      }
    }
  });
})();
