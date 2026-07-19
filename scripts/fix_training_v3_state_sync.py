#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'next' / 'src' / 'App.tsx'
text = path.read_text(encoding='utf-8')
old = """      persistGame(value);
      return value;
"""
new = """      persistGame(value);
      // React must render the same normalized state that was written to storage.
      // Otherwise an already-removed wire can remain visible and keep the
      // exhibition gate closed until the next full reload.
      return loadGame();
"""
if old not in text:
    raise SystemExit('App commit state marker missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('App state synchronized with normalized persistence')
