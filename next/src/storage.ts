import { advanceTime, createGame, migrateLegacy, normalizeGame, type GameState } from './model';

const STORAGE_KEY = 'bonsai:v2';
const LEGACY_KEY = 'bonsai_live_1';
export const GAME_UPDATED_EVENT = 'bonsai:game-updated';

export function loadGame(): GameState {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return advanceTime(normalizeGame(JSON.parse(current)));
  } catch (error) {
    backupCorrupt(STORAGE_KEY, error);
  }

  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = advanceTime(migrateLegacy(JSON.parse(legacy)));
      persistGame(migrated);
      return migrated;
    }
  } catch (error) {
    backupCorrupt(LEGACY_KEY, error);
  }

  return createGame();
}

export function persistGame(game: GameState): void {
  const normalized = normalizeGame(game);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    mirrorLegacy(normalized);
    window.dispatchEvent(new CustomEvent<GameState>(GAME_UPDATED_EVENT, { detail: normalized }));
  } catch (error) {
    console.error('[BONSAI save]', error);
  }
}

function backupCorrupt(key: string, error: unknown): void {
  try {
    const raw = localStorage.getItem(key);
    if (raw) localStorage.setItem(`${key}:corrupt:${Date.now()}`, raw.slice(0, 500_000));
  } catch {
    // Storage can be unavailable in private mode. The app still starts with a new state.
  }
  console.warn('[BONSAI storage migration]', error);
}

function mirrorLegacy(game: GameState): void {
  const bonsai = game.bonsai.find(item => item.id === game.activeBonsaiId) ?? game.bonsai[0];
  if (!bonsai) return;
  const legacy = {
    started: game.started,
    name: game.playerName,
    mentor: Math.max(0, ['gensai', 'shino', 'ren', 'gakuto', 'soichiro', 'reiji', 'takashi'].indexOf(game.mentorId)),
    sp: bonsai.species,
    tree: bonsai.name,
    born: bonsai.bornAt,
    water: bonsai.water,
    last: bonsai.lastUpdatedAt,
    vit: bonsai.vitality,
    stress: bonsai.stress,
    prune: Object.values(bonsai.parts).reduce((sum, part) => sum + part.pruneLevel, 0),
    wire: Object.values(bonsai.parts).filter(part => part.wire).length,
    fert: 0,
    pot: bonsai.potId,
    money: game.money,
    rep: game.reputation,
    owned: game.ownedPots,
    awards: bonsai.awards,
    log: bonsai.logs.map(item => ({ at: item.at, x: item.text })),
    lastWeek: game.lastShowWeek,
    stats: {
      water: bonsai.logs.filter(item => item.text.includes('水を与え')).length,
      prune: bonsai.logs.filter(item => item.text.includes('剪定')).length,
      wire: bonsai.logs.filter(item => item.text.includes('針金')).length,
      shows: bonsai.awards.length
    },
    advanced: {
      parts: Object.fromEntries(Object.entries(bonsai.parts).map(([id, part]) => [id, {
        foliage: part.foliage,
        health: part.health,
        pruneLevel: part.pruneLevel,
        wire: part.wire,
        disease: part.disease,
        pest: part.pest,
        deadwood: part.deadwood,
        scar: part.scar
      }])),
      shari: bonsai.shari
    }
  };
  localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
}

export async function repairRuntimeCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }
  } catch (error) {
    console.warn('[BONSAI repair worker]', error);
  }
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    }
  } catch (error) {
    console.warn('[BONSAI repair cache]', error);
  }
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(error => console.warn('[BONSAI service worker]', error));
  }, { once: true });
}
