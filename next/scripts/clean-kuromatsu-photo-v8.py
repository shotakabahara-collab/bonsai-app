from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'next/public/assets/kuromatsu/base'
NAMES = ('black.webp', 'starter.webp', 'blue.webp', 'moon.webp', 'old.webp')
KEYS = [(485, 252), (560, 252), (620, 253), (680, 251), (740, 253), (800, 252), (860, 253), (920, 252), (967, 253)]


def center_x(y: int) -> int:
    for (y0, x0), (y1, x1) in zip(KEYS, KEYS[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            return int(round(x0 + (x1 - x0) * t))
    return KEYS[0][1] if y < KEYS[0][0] else KEYS[-1][1]


def remove_support_line(image: np.ndarray) -> np.ndarray:
    original = image.copy()
    output = image.copy()

    # Restore the homogeneous wall across the narrow support line. Horizontal
    # interpolation retains the diagonal pine needles that cross this corridor.
    for y in range(485, 968):
        x = center_x(y)
        left = output[y, x - 6].astype(np.float32)
        right = output[y, x + 6].astype(np.float32)
        for xx in range(x - 3, x + 4):
            t = (xx - (x - 4)) / 8
            base = (1 - t) * left + t * right
            sx = xx - 12
            local = original[max(0, y - 1):min(original.shape[0], y + 2), max(0, sx - 1):min(original.shape[1], sx + 2)].mean(axis=(0, 1))
            broad = original[max(0, y - 4):min(original.shape[0], y + 5), max(0, sx - 4):min(original.shape[1], sx + 5)].mean(axis=(0, 1))
            output[y, xx] = np.clip(base + (local - broad) * 0.35, 0, 255)

    # Replace the metal hook with bark from the same branch and lighting.
    source = original[955:1035, 270:300].copy()
    source_mask = np.zeros(source.shape[:2], np.uint8)
    cv2.ellipse(source_mask, (source.shape[1] // 2, source.shape[0] // 2), (12, 35), 0, 0, 360, 255, -1)
    cloned = cv2.seamlessClone(source, output, source_mask, (255, 995), cv2.NORMAL_CLONE)

    hook_mask = np.zeros(output.shape[:2], np.uint8)
    polygon = np.array([[247, 965], [258, 965], [260, 980], [261, 995], [267, 1015], [265, 1025], [257, 1027], [251, 1018], [249, 1001], [247, 982]], np.int32)
    cv2.fillPoly(hook_mask, [polygon], 255)
    feather = cv2.GaussianBlur(hook_mask, (0, 0), 2.2).astype(np.float32) / 255
    return (cloned * feather[..., None] + output * (1 - feather[..., None])).astype(np.uint8)


def audit(image: np.ndarray) -> dict[str, float | int]:
    luminance = image.mean(axis=2)
    corridor = luminance[600:900, 247:259]
    dark = corridor < 120
    rows = dark.any(axis=1)
    longest = current = 0
    for value in rows:
        current = current + 1 if value else 0
        longest = max(longest, current)
    return {
        'darkRatio': float(dark.mean()),
        'darkRows': int(rows.sum()),
        'longestDarkRun': int(longest),
    }


report = {}
for name in NAMES:
    path = BASE / name
    if not path.exists():
        raise SystemExit(f'missing pine photograph: {path}')
    source = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if source is None or source.shape[:2] != (1500, 900):
        raise SystemExit(f'invalid pine photograph: {path}')

    before = audit(source)
    already_clean = before['darkRatio'] <= 0.012 and before['longestDarkRun'] <= 12
    cleaned = source if already_clean else remove_support_line(source)
    after = audit(cleaned)
    if after['darkRatio'] > 0.012 or after['longestDarkRun'] > 12:
        raise SystemExit(f'support line remains in {name}: {after}')

    if not already_clean:
        rgb = cv2.cvtColor(cleaned, cv2.COLOR_BGR2RGB)
        Image.fromarray(rgb).save(path, 'WEBP', quality=96, method=6)

    report[name] = {
        'alreadyClean': already_clean,
        'before': before,
        'after': after,
        'bytes': path.stat().st_size,
    }

report_path = ROOT / 'next/photo-cleanup-v8-audit.json'
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
