#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]

storage = root / 'next' / 'src' / 'storage.ts'
text = storage.read_text(encoding='utf-8')
text = text.replace('export function persistGame(game: GameState): void {', 'export function persistGame(game: GameState): GameState {', 1)
old = """  } catch (error) {
    console.error('[BONSAI save]', error);
  }
}
"""
new = """  } catch (error) {
    console.error('[BONSAI save]', error);
  }
  return normalized;
}
"""
if old not in text:
    raise SystemExit('persistGame return marker not found')
storage.write_text(text.replace(old, new, 1), encoding='utf-8')

app = root / 'next' / 'src' / 'App.tsx'
text = app.read_text(encoding='utf-8')
old_candidates = [
"""      persistGame(value);
      // React must render the same normalized state that was written to storage.
      // Otherwise an already-removed wire can remain visible and keep the
      // exhibition gate closed until the next full reload.
      return loadGame();
""",
"""      persistGame(value);
      return loadGame();
""",
"""      persistGame(value);
      return value;
"""
]
for old in old_candidates:
    if old in text:
        text = text.replace(old, """      return persistGame(value);
""", 1)
        break
else:
    raise SystemExit('App commit persistence marker not found')
app.write_text(text, encoding='utf-8')
print('persisted and rendered game state unified')
