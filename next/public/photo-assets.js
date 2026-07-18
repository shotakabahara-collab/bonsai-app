(() => {
  'use strict';
  const POTS = Object.freeze({
    starter: './assets/kuromatsu/base/starter.webp',
    blue: './assets/kuromatsu/base/blue.webp',
    black: './assets/kuromatsu/base/black.webp',
    moon: './assets/kuromatsu/base/moon.webp',
    old: './assets/kuromatsu/base/old.webp'
  });
  function currentPot() {
    try {
      const game = JSON.parse(localStorage.getItem('bonsai:v2') || '{}');
      const bonsai = Array.isArray(game.bonsai) ? game.bonsai.find(item => item.id === game.activeBonsaiId) || game.bonsai[0] : null;
      if (bonsai && POTS[bonsai.potId]) return bonsai.potId;
      const legacy = JSON.parse(localStorage.getItem('bonsai_live_1') || '{}');
      if (POTS[legacy.pot]) return legacy.pot;
    } catch {}
    return 'black';
  }
  const photos = window.BonsaiPhotos || {};
  Object.defineProperty(photos, 'pine', { configurable: true, enumerable: true, get: () => POTS[currentPot()] || POTS.black });
  photos.pineForPot = pot => POTS[pot] || POTS.black;
  photos.pineManifest = './assets/kuromatsu/manifest.json';
  photos.pineMeta = Object.freeze({ version: 'react-kuromatsu-photoreal-v1', width: 900, height: 1500, sameTreeIdentity: true, local: true });
  window.BonsaiPhotos = photos;
})();
