#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'next' / 'src' / 'App.tsx'
text = path.read_text(encoding='utf-8')
marker = """  if (!game.started || !bonsai) {
"""
insert = """  useEffect(() => {
    // Every screen transition adopts the canonical saved work state. This is
    // especially important after removing wire, because exhibition eligibility
    // must never be calculated from the previous rendered branch state.
    setGame(loadGame());
  }, [tab]);

  if (!game.started || !bonsai) {
"""
if marker not in text:
    raise SystemExit('App onboarding marker not found')
path.write_text(text.replace(marker, insert, 1), encoding='utf-8')
print('tab transition state synchronization patched')
