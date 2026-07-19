#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'next' / 'src' / 'App.tsx'
text = path.read_text(encoding='utf-8')
old = """  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        const fresh = loadGame();
        setGame(fresh);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
"""
new = """  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setGame(loadGame());
    };
    const onPersistedGame = (event: Event) => {
      const detail = (event as CustomEvent<GameState>).detail;
      // persistGame dispatches synchronously. Defer the render update so the
      // current React state transaction can finish before adopting its normalized result.
      queueMicrotask(() => setGame(detail ?? loadGame()));
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('bonsai:game-updated', onPersistedGame);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('bonsai:game-updated', onPersistedGame);
    };
  }, []);
"""
if old not in text:
    raise SystemExit('App visibility synchronization block not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('persisted game event synchronization patched')
