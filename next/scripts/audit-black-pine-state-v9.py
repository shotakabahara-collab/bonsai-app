from pathlib import Path
import json

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'next/test-artifacts'
NAMES = ['base', 'pruning', 'wire', 'jin-shari', 'reload']
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
    count, labels, stats, _ = cv2.connectedComponentsWithStats(changed.astype(np.uint8), 8)
    largest = 0 if count <= 1 else int(stats[1:, cv2.CC_STAT_AREA].max())
    return {
        'mean': float(diff.mean()),
        'changedRatio': float(changed.mean()),
        'severeRatio': float(severe.mean()),
        'changedPixels': int(changed.sum()),
        'largestComponent': largest,
        'largestComponentRatio': float(largest / changed.size),
    }


base = IMAGES['base']
pruning = delta(base, IMAGES['pruning'], (.43, .28, .98, .66))
wire = delta(IMAGES['pruning'], IMAGES['wire'], (.43, .28, .98, .66))
shari = delta(IMAGES['wire'], IMAGES['jin-shari'], (.35, .45, .72, .98))
reload = delta(IMAGES['jin-shari'], IMAGES['reload'], (0, 0, 1, 1))
report = {'pruning': pruning, 'wire': wire, 'shari': shari, 'reload': reload}

minimums = {
    'pruning': (0.006, 380),
    'wire': (0.0012, 90),
    'shari': (0.0020, 150),
}
for name, (ratio, pixels) in minimums.items():
    current = report[name]
    if current['changedRatio'] < ratio or current['changedPixels'] < pixels:
        raise SystemExit(f'{name} is not visibly reflected: {current}')

# Reject the previous white fragment failure: pruning must be local, fine-grained,
# and substantially smaller than the foliage pad itself.
if pruning['changedRatio'] > .16 or pruning['severeRatio'] > .10 or pruning['largestComponentRatio'] > .045:
    raise SystemExit(f'pruning became a pasted or over-cleared region: {pruning}')
if wire['changedRatio'] > .06 or wire['largestComponentRatio'] > .02:
    raise SystemExit(f'wire became an oversized pasted layer: {wire}')
if shari['changedRatio'] > .08 or shari['largestComponentRatio'] > .035:
    raise SystemExit(f'shari became an oversized pasted layer: {shari}')
if reload['changedRatio'] > 0.0005 or reload['mean'] > .15:
    raise SystemExit(f'reload changed photographic work state: {reload}')

output = ROOT / 'next/black-pine-state-v9-visual-audit.json'
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
