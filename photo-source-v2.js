(() => {
  'use strict';

  const ROOT = typeof window !== 'undefined' ? window : globalThis;
  const DOC = typeof document !== 'undefined' ? document : null;
  const REMOTE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Japanese_Black_Pine_bonsai_135%2C_October_10%2C_2008.jpg/960px-Japanese_Black_Pine_bonsai_135%2C_October_10%2C_2008.jpg';
  const FILE_PAGE = 'https://commons.wikimedia.org/wiki/File:Japanese_Black_Pine_bonsai_135,_October_10,_2008.jpg';
  const LICENSE = 'https://creativecommons.org/licenses/by-sa/3.0/';
  const fallback = ROOT.BonsaiPhotos?.pine || '';

  ROOT.BonsaiPhotos = ROOT.BonsaiPhotos || {};
  ROOT.BonsaiPhotos.pineFallback = fallback;
  ROOT.BonsaiPhotos.pine = REMOTE;
  ROOT.BonsaiPhotos.pineCredit = {
    title: 'Japanese Black Pine bonsai 135, October 10, 2008',
    author: 'Sage Ross',
    source: FILE_PAGE,
    license: 'CC BY-SA 3.0',
    licenseUrl: LICENSE,
    modified: true
  };

  function useFallback(image) {
    if (!fallback || !image) return;
    ROOT.BonsaiPhotos.pine = fallback;
    image.dataset.photoFallback = 'true';
    image.dataset.photoCorsReady = 'true';
    image.removeAttribute('crossorigin');
    image.src = fallback;
  }

  function prepareImage() {
    if (!DOC) return;
    const image = DOC.querySelector('.photo-bonsai img');
    if (!image || image.dataset.photoFallback === 'true' || image.dataset.photoCorsReady === 'true') return;
    const source = image.getAttribute('src') || image.src || '';
    if (!source || (!source.includes('upload.wikimedia.org') && source !== REMOTE)) return;
    image.dataset.photoCorsReady = 'true';
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.src = REMOTE;
  }

  function installFallback() {
    if (!DOC) return;
    DOC.addEventListener('error', event => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      if (!image.closest('.photo-bonsai')) return;
      if (image.dataset.photoFallback === 'true') return;
      if (image.currentSrc === REMOTE || image.src === REMOTE || image.src.includes('upload.wikimedia.org')) useFallback(image);
    }, true);
  }

  function creditMarkup() {
    return `<span>黒松写真：Sage Ross</span><a href="${FILE_PAGE}" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a><a href="${LICENSE}" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a><span>・状態表現のため加工</span>`;
  }

  function ensureCredit() {
    if (!DOC) return;
    prepareImage();
    if (DOC.getElementById('bonsai-photo-credit')) return;
    const figure = DOC.querySelector('.photo-bonsai');
    if (!figure) return;
    const credit = DOC.createElement('div');
    credit.id = 'bonsai-photo-credit';
    credit.className = 'bonsai-photo-credit';
    credit.innerHTML = creditMarkup();
    const card = figure.closest('.card');
    if (card) card.insertAdjacentElement('afterend', credit);
    else figure.insertAdjacentElement('afterend', credit);
  }

  function installStyles() {
    if (!DOC || DOC.getElementById('bonsai-photo-credit-style')) return;
    const style = DOC.createElement('style');
    style.id = 'bonsai-photo-credit-style';
    style.textContent = `.bonsai-photo-credit{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin:7px 4px 12px;color:#758279;font-size:8px;line-height:1.45}.bonsai-photo-credit a{color:#9eaa9f;text-decoration:none;border-bottom:1px solid rgba(158,170,159,.28)}.wall~.bonsai-photo-credit,.wall .bonsai-photo-credit{display:none}`;
    DOC.head.appendChild(style);
  }

  function start() {
    installFallback();
    installStyles();
    ensureCredit();
    const observer = new MutationObserver(ensureCredit);
    observer.observe(DOC.documentElement, { childList: true, subtree: true });
  }

  ROOT.BonsaiPhotoSource = {
    version: '2.1.0',
    remote: REMOTE,
    fallback,
    credit: ROOT.BonsaiPhotos.pineCredit,
    prepareImage,
    useFallback
  };

  if (DOC) {
    if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})();
