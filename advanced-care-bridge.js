(() => {
  'use strict';
  const KEY = 'bonsai_live_1';
  const ROOT = typeof window !== 'undefined' ? window : globalThis;
  const DOC = typeof document !== 'undefined' ? document : null;

  function installStorageBridge() {
    if (!ROOT.Storage || !ROOT.localStorage) return;
    const proto = ROOT.Storage.prototype;
    if (proto.__bonsaiAdvancedBridge) return;
    const nativeSet = proto.setItem;
    const nativeGet = proto.getItem;
    Object.defineProperty(proto, '__bonsaiAdvancedBridge', { value: true });
    proto.setItem = function setItemWithAdvancedState(key, value) {
      if (this === ROOT.localStorage && key === KEY) {
        try {
          const incoming = JSON.parse(String(value));
          const current = JSON.parse(nativeGet.call(this, key) || '{}');
          if (current.advanced && !incoming.advanced) incoming.advanced = current.advanced;
          const migrated = ROOT.BonsaiAdvancedCare
            ? ROOT.BonsaiAdvancedCare.migrateState(incoming)
            : incoming;
          return nativeSet.call(this, key, JSON.stringify(migrated));
        } catch {
          return nativeSet.call(this, key, value);
        }
      }
      return nativeSet.call(this, key, value);
    };
  }

  function relabelLegacyButtons() {
    if (!DOC) return;
    const prune = DOC.querySelector('[data-prune]');
    const wire = DOC.querySelector('[data-care="wire"]');
    if (prune && !prune.dataset.partSpecific) {
      prune.dataset.partSpecific = 'true';
      prune.innerHTML = '<span>✂️</span>部位剪定';
    }
    if (wire && !wire.dataset.partSpecific) {
      wire.dataset.partSpecific = 'true';
      wire.innerHTML = '<span>🪢</span>部位針金';
    }
  }

  function interceptLegacyCare(event) {
    const target = event.target.closest?.('[data-prune],[data-care="wire"]');
    if (!target || !ROOT.BonsaiAdvancedCare) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    ROOT.BonsaiAdvancedCare.open(target.matches('[data-prune]') ? 'apex' : 'first_left');
  }

  function init() {
    installStorageBridge();
    if (!DOC) return;
    DOC.addEventListener('click', interceptLegacyCare, true);
    const observer = new MutationObserver(relabelLegacyButtons);
    observer.observe(DOC.documentElement, { childList: true, subtree: true });
    relabelLegacyButtons();

    const state = ROOT.BonsaiAdvancedCare?.readState();
    if (state) ROOT.BonsaiAdvancedCare.writeState(state);
  }

  if (DOC && DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
