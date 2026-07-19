#!/usr/bin/env python3
from pathlib import Path

path = Path('next/src/App.tsx')
text = path.read_text(encoding='utf-8')
old = "      persistGame(value);\n      return value;"
new = "      persistGame(value);\n      // Keep React state identical to the normalized, migrated state written to storage.\n      // This prevents a just-removed wire from remaining visible until a full reload.\n      return loadGame();"
if old not in text:
    raise SystemExit('App commit synchronization marker not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('runtime state synchronization patched')
