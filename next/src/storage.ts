import { advanceTime, createGame, migrateLegacy, normalizeGame, type GameState, type SpeciesId } from './model';
import { advanceSeasonalGame } from './seasonal-craft-v4';

const STORAGE_KEY = 'bonsai:v2';
const LEGACY_KEY = 'bonsai_live_1';
const ACTIVE_SLOT_KEY = 'bonsai:active-slot';
const SLOT_PREFIX = 'bonsai:v2:slot:';
export const GAME_UPDATED_EVENT = 'bonsai:game-updated';

export type SaveSlotId = 1 | 2 | 3;

export interface SaveSlotSummary {
  id: SaveSlotId;
  active: boolean;
  started: boolean;
  playerName: string;
  treeName: string;
  species?: SpeciesId;
  updatedAt: number;
}

function slotKey(slot: SaveSlotId): string {
  return `${SLOT_PREFIX}${slot}`;
}

function validSlot(value: unknown): SaveSlotId {
  const parsed = Number(value);
  return parsed === 2 || parsed === 3 ? parsed : 1;
}

export function activeSaveSlot(): SaveSlotId {
  try {
    return validSlot(localStorage.getItem(ACTIVE_SLOT_KEY));
  } catch {
    return 1;
  }
}

export function setActiveSaveSlot(slot: SaveSlotId): void {
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
  } catch (error) {
    console.warn('[BONSAI slot selection]', error);
  }
}

function rawForSlot(slot: SaveSlotId): string | null {
  const direct = localStorage.getItem(slotKey(slot));
  const canonical = localStorage.getItem(STORAGE_KEY);
  // The canonical bonsai:v2 key remains the active slot's compatibility mirror.
  // Prefer it for the active slot so older builds, audits and safe-mode recovery
  // can still write the current game without silently losing that update.
  if (slot === activeSaveSlot() && canonical) return canonical;
  if (direct) return direct;
  // Gameplay v8 adopts the original bonsai:v2 save as slot 1 exactly once.
  return slot === 1 ? canonical : null;
}

export function listSaveSlots(): SaveSlotSummary[] {
  const current = activeSaveSlot();
  return ([1, 2, 3] as SaveSlotId[]).map(id => {
    try {
      const raw = rawForSlot(id);
      if (!raw) return { id, active: id === current, started: false, playerName: '', treeName: '', updatedAt: 0 };
      const game = normalizeGame(JSON.parse(raw));
      const bonsai = game.bonsai.find(item => item.id === game.activeBonsaiId) ?? game.bonsai[0];
      return {
        id,
        active: id === current,
        started: game.started && Boolean(bonsai),
        playerName: game.playerName,
        treeName: bonsai?.name ?? '',
        species: bonsai?.species,
        updatedAt: Math.max(game.createdAt, ...game.bonsai.map(item => item.lastUpdatedAt))
      };
    } catch (error) {
      backupCorrupt(slotKey(id), error);
      return { id, active: id === current, started: false, playerName: '', treeName: '', updatedAt: 0 };
    }
  });
}

export function loadGame(slot: SaveSlotId = activeSaveSlot()): GameState {
  try {
    const current = rawForSlot(slot);
    if (current) {
      const loaded = advanceForLoad(normalizeGame(JSON.parse(current)), slot);
      const direct = localStorage.getItem(slotKey(slot));
      const canonical = localStorage.getItem(STORAGE_KEY);
      const activeCanonicalChanged = slot === activeSaveSlot() && Boolean(canonical) && canonical !== direct;
      // Persisting here completes adoption and folds compatibility-key changes
      // back into the active slot before the next slot switch.
      if (!direct || activeCanonicalChanged) persistGame(loaded, slot);
      return loaded;
    }
  } catch (error) {
    backupCorrupt(slotKey(slot), error);
  }

  if (slot === 1) {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const migrated = advanceForLoad(migrateLegacy(JSON.parse(legacy)), slot);
        persistGame(migrated, slot);
        return migrated;
      }
    } catch (error) {
      backupCorrupt(LEGACY_KEY, error);
    }
  }

  return createGame();
}

export function switchSaveSlot(slot: SaveSlotId): GameState {
  try {
    // Replace the compatibility mirror before changing the active marker so the
    // previous slot cannot be mistaken for the newly selected one.
    const target = localStorage.getItem(slotKey(slot));
    if (target) localStorage.setItem(STORAGE_KEY, target);
    else localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[BONSAI slot mirror switch]', error);
  }
  setActiveSaveSlot(slot);
  const game = loadGame(slot);
  const persisted = persistGame(game, slot);
  window.dispatchEvent(new CustomEvent<GameState>(GAME_UPDATED_EVENT, { detail: persisted }));
  return persisted;
}

export function resetSaveSlot(slot: SaveSlotId = activeSaveSlot()): GameState {
  try {
    localStorage.removeItem(slotKey(slot));
    if (slot === activeSaveSlot()) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch (error) {
    console.warn('[BONSAI reset slot]', error);
  }
  setActiveSaveSlot(slot);
  return persistGame(createGame(), slot);
}

export function persistGame(game: GameState, slot: SaveSlotId = activeSaveSlot()): GameState {
  const normalized = normalizeGame(game);
  const seasonal = advanceSeasonalGame(normalized).game;
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify(seasonal));
    if (slot === activeSaveSlot()) {
      // Keep the canonical key as a mirror for existing builds and migration audits.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seasonal));
      mirrorLegacy(seasonal);
    }
    window.dispatchEvent(new CustomEvent<GameState>(GAME_UPDATED_EVENT, { detail: seasonal }));
  } catch (error) {
    console.error('[BONSAI save]', error);
  }
  return seasonal;
}

function advanceForLoad(game: GameState, slot: SaveSlotId): GameState {
  const timed = advanceTime(game);
  const seasonal = advanceSeasonalGame(timed);
  if (seasonal.changed) {
    try {
      localStorage.setItem(slotKey(slot), JSON.stringify(seasonal.game));
      if (slot === activeSaveSlot()) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seasonal.game));
        mirrorLegacy(seasonal.game);
      }
    } catch (error) {
      console.warn('[BONSAI seasonal save]', error);
    }
  }
  return seasonal.game;
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
  if (!bonsai) {
    localStorage.removeItem(LEGACY_KEY);
    return;
  }
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
        wireHistory: part.wireHistory,
        disease: part.disease,
        pest: part.pest,
        deadwood: part.deadwood,
        scar: part.scar
      }])),
      shari: bonsai.shari,
      lifeStatus: bonsai.lifeStatus,
      diedAt: bonsai.diedAt,
      deathCause: bonsai.deathCause,
      aftercareRisks: bonsai.aftercareRisks,
      craft: bonsai.craft
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
