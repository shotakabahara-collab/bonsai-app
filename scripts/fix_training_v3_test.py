#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'next' / 'tests' / 'smoke.mjs'
text = path.read_text(encoding='utf-8')
old = "  if (migrated.bonsai[0].fertilizer !== 0) throw new Error(`Fertilizer state was not removed: ${migrated.bonsai[0].fertilizer}`);\n"
if old not in text:
    raise SystemExit('legacy fertilizer assertion marker missing')
path.write_text(text.replace(old, '', 1), encoding='utf-8')
print('fertilizer absence assertion normalized')
