#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    if old not in text:
        if new in text:
            return
        raise SystemExit(f'marker missing in {path}: {old[:90]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_regex(path: Path, pattern: str, replacement: str) -> None:
    text = path.read_text(encoding='utf-8')
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        if replacement.strip() in text:
            return
        raise SystemExit(f'regex marker missing in {path}: {pattern[:100]!r}')
    path.write_text(updated, encoding='utf-8')


app = ROOT / 'next/src/App.tsx'
replace_once(
    app,
    "import { DeadwoodLifecycleSheet, PrecisionPruningSheet, WireLifecycleStatus } from './CraftPanels';",
    "import { DeadwoodLifecycleSheet, WireLifecycleStatus } from './CraftPanels';\nimport { PrecisionPruningV4 } from './PrecisionPruningV4';"
)
replace_once(app, "  applyPrecisionPruningToGame,\n", "")
replace_once(
    app,
    "} from './craft-v3';\nimport {\n  PARTS,",
    "} from './craft-v3';\nimport { applySeasonalPruningToGame } from './seasonal-craft-v4';\nimport {\n  PARTS,"
)
replace_once(app, '<PrecisionPruningSheet', '<PrecisionPruningV4')
replace_once(
    app,
    "commit(current => applyPrecisionPruningToGame(current, siteId, technique), '精密剪定を不可逆で確定しました');",
    "commit(current => applySeasonalPruningToGame(current, siteId, technique).game, '季節・樹勢を判定し、結果待ちの精密剪定を記録しました');"
)

storage = ROOT / 'next/src/storage.ts'
replace_once(
    storage,
    "import { advanceTime, createGame, migrateLegacy, normalizeGame, type GameState } from './model';",
    "import { advanceTime, createGame, migrateLegacy, normalizeGame, type GameState } from './model';\nimport { advanceSeasonalGame } from './seasonal-craft-v4';"
)
replace_regex(
    storage,
    r"export function loadGame\(\): GameState \{.*?\n\}\n\nexport function persistGame\(game: GameState\): GameState \{.*?\n\}\n",
    """export function loadGame(): GameState {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return advanceForLoad(normalizeGame(JSON.parse(current)));
  } catch (error) {
    backupCorrupt(STORAGE_KEY, error);
  }

  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = advanceForLoad(migrateLegacy(JSON.parse(legacy)));
      persistGame(migrated);
      return migrated;
    }
  } catch (error) {
    backupCorrupt(LEGACY_KEY, error);
  }

  return createGame();
}

export function persistGame(game: GameState): GameState {
  const normalized = normalizeGame(game);
  const seasonal = advanceSeasonalGame(normalized).game;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seasonal));
    mirrorLegacy(seasonal);
    window.dispatchEvent(new CustomEvent<GameState>(GAME_UPDATED_EVENT, { detail: seasonal }));
  } catch (error) {
    console.error('[BONSAI save]', error);
  }
  return seasonal;
}

function advanceForLoad(game: GameState): GameState {
  const timed = advanceTime(game);
  const seasonal = advanceSeasonalGame(timed);
  if (seasonal.changed) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seasonal.game));
      mirrorLegacy(seasonal.game);
    } catch (error) {
      console.warn('[BONSAI seasonal save]', error);
    }
  }
  return seasonal.game;
}
"""
)

main = ROOT / 'next/src/main.tsx'
replace_once(main, "import './craft-v3.css';", "import './craft-v3.css';\nimport './seasonal-v4.css';")
replace_once(main, "BonsaiRelease = 'bonsai-craft-v3-20260719';", "BonsaiRelease = 'bonsai-seasonal-response-v4-20260719';")

sw = ROOT / 'next/public/sw.js'
replace_regex(sw, r"const VERSION = '[^']+';", "const VERSION = 'bonsai-seasonal-response-v4';")

for required in (
    ROOT / 'next/src/seasonal-craft-v4.ts',
    ROOT / 'next/src/PrecisionPruningV4.tsx',
    ROOT / 'next/src/seasonal-v4.css',
    ROOT / 'next/tests/seasonal-v4.mjs'
):
    if not required.exists() or required.stat().st_size < 100:
        raise SystemExit(f'missing seasonal v4 file: {required}')

print('seasonal response v4 connected')
