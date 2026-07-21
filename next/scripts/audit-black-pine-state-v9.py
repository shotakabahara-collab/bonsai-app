from pathlib import Path
import json

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'next/test-artifacts'
NAMES = ['base', 'pruning', 'wire', 'shari', 'reload']
IMAGES = {name: cv2.imread(str(ART / f'black-pine-v9-{name}.png'), cv2.IMREAD_COLOR) for name in NAMES}
for name, image in IMAGES.items():
    if image is None:
        raise SystemExit(f'missing screenshot: {name}')


def delta(a: np.ndarray, b: np.ndarray, roi: tuple[float, float, float, float]) -> dict[str, float | int]:
    h, w = a.shape[:2]
    x0, y0, x1, y1 = roi
    aa = a[int(h*y0):int(h*y1), int(w*x0):int(w*x1)].astype(np.int16)
    bb = b[int(h*y0):int(h*y1), int(w*x0):int(w*x1)].astype(np.int16)
    diff = np.abs(aa - bb).mean(axis=2)
    changed = diff > 8
    severe = diff > 24
    return {
        'mean': float(diff.mean()),
        'changedRatio': float(changed.mean()),
        'severeRatio': float(severe.mean()),
        'changedPixels': int(changed.sum()),
    }

base = IMAGES['base']
pruning = delta(base, IMAGES['pruning'], (.43, .28, .98, .66))
wire = delta(IMAGES['pruning'], IMAGES['wire'], (.43, .28, .98, .66))
shari = delta(IMAGES['wire'], IMAGES['shari'], (.35, .45, .72, .98))
reload = delta(IMAGES['shari'], IMAGES['reload'], (0, 0, 1, 1))
report = {'pruning': pruning, 'wire': wire, 'shari': shari, 'reload': reload}

minimums = {
    'pruning': (0.010, 600),
    'wire': (0.0012, 90),
    'shari': (0.0020, 150),
}
for name, (ratio, pixels) in minimums.items():
    current = report[name]
    if current['changedRatio'] < ratio or current['changedPixels'] < pixels:
        raise SystemExit(f'{name} is not visibly reflected: {current}')
if reload['changedRatio'] > 0.0005 or reload['mean'] > .15:
    raise SystemExit(f'reload changed photographic work state: {reload}')

output = ROOT / 'next/black-pine-state-v9-visual-audit.json'
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
