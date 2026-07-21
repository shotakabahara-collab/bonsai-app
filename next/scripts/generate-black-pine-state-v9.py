from __future__ import annotations

from pathlib import Path
import hashlib
import json

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'next/public/assets/kuromatsu'
BASE = PUBLIC / 'base'
WIRE_SRC = PUBLIC / 'wire-photo-v7'
DEADWOOD_SRC = PUBLIC / 'deadwood-photo-v6'
WIRE_OUT = PUBLIC / 'wire-photo-v9'
DEADWOOD_OUT = PUBLIC / 'deadwood-photo-v9'
PRUNING_OUT = PUBLIC / 'pruning-photo-v9'

PARTS = {
    'apex': (390, 160, 660, 520),
    'firstLeft': (80, 300, 470, 760),
    'secondRight': (430, 350, 900, 900),
    'thirdLeft': (80, 620, 530, 1080),
    'front': (260, 580, 720, 1100),
    'back': (330, 260, 760, 780),
}


def write_webp(array: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba = cv2.cvtColor(array, cv2.COLOR_BGRA2RGBA)
    Image.fromarray(rgba).save(path, 'WEBP', lossless=True, method=6)


def read_rgba(path: Path) -> np.ndarray:
    data = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if data is None:
        raise SystemExit(f'missing image: {path}')
    if data.ndim == 2:
        data = cv2.cvtColor(data, cv2.COLOR_GRAY2BGRA)
    elif data.shape[2] == 3:
        data = cv2.cvtColor(data, cv2.COLOR_BGR2BGRA)
    if data.shape[:2] != (1500, 900):
        raise SystemExit(f'invalid image size: {path} {data.shape}')
    return data


def enhance_transparent(source: np.ndarray, kind: str, strength: float) -> np.ndarray:
    out = source.astype(np.float32)
    if kind == 'wire':
        out[..., 2] = np.clip(out[..., 2] * (1.08 + .10 * strength) + 8, 0, 255)
        out[..., 1] = np.clip(out[..., 1] * (1.01 + .04 * strength), 0, 255)
        out[..., 0] = np.clip(out[..., 0] * .90, 0, 255)
        out[..., 3] = np.clip(out[..., 3] * (1.06 + .08 * strength), 0, 255)
    else:
        gray = cv2.cvtColor(out[..., :3].astype(np.uint8), cv2.COLOR_BGR2GRAY)
        grain = cv2.Laplacian(gray, cv2.CV_32F)
        out[..., :3] = np.clip(out[..., :3] + grain[..., None] * (.08 + .05 * strength), 0, 255)
        out[..., 2] = np.clip(out[..., 2] * (1.03 + .04 * strength), 0, 255)
        out[..., 1] = np.clip(out[..., 1] * (1.01 + .02 * strength), 0, 255)
        out[..., 3] = np.clip(out[..., 3] * (1.08 + .10 * strength), 0, 255)
    return out.astype(np.uint8)


def photographed_wall_mask(base: np.ndarray) -> np.ndarray:
    bgr = base.astype(np.int16)
    luminance = bgr.mean(axis=2)
    chroma = bgr.max(axis=2) - bgr.min(axis=2)
    # Match the permanent visual audit's white-wall definition at source scale.
    return (luminance > 207) & (chroma < 24)


def generate_wire() -> list[str]:
    base = cv2.imread(str(BASE / 'black.webp'), cv2.IMREAD_COLOR)
    if base is None or base.shape[:2] != (1500, 900):
        raise SystemExit('invalid black pine master photograph')
    wall = photographed_wall_mask(base)
    names: list[str] = []
    for part in PARTS:
        for intensity, strength in [('light', .55), ('strong', 1.0)]:
            source = read_rgba(WIRE_SRC / f'{part}-{intensity}.webp')
            result = enhance_transparent(source, 'wire', strength)
            # Remove only pixels that sit on the actual pale wall. Branch, bark and
            # needles retain their original photographed wire width and antialiasing.
            result[..., 3][wall] = 0
            name = f'{part}-{intensity}.webp'
            write_webp(result, WIRE_OUT / name)
            names.append(name)
    return names


def generate_deadwood() -> list[str]:
    names: list[str] = []
    for path in sorted(DEADWOOD_SRC.glob('*.webp')):
        level = 1
        if '-l2' in path.stem:
            level = 2
        elif '-l3' in path.stem:
            level = 3
        source = read_rgba(path)
        result = enhance_transparent(source, 'deadwood', level / 3)
        write_webp(result, DEADWOOD_OUT / path.name)
        names.append(path.name)
    if len(names) != 24:
        raise SystemExit(f'expected 24 deadwood images, got {len(names)}')
    return names


def green_mask(image: np.ndarray, box: tuple[int, int, int, int], level: int, seed: int) -> np.ndarray:
    x0, y0, x1, y1 = box
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    green = cv2.inRange(hsv, np.array([31, 38, 22]), np.array([92, 255, 220]))
    roi = np.zeros(green.shape, np.uint8)
    cv2.rectangle(roi, (x0, y0), (x1, y1), 255, -1)
    green = cv2.bitwise_and(green, roi)

    rng = np.random.default_rng(seed)
    small_h = max(2, int(np.ceil(image.shape[0] / 14)))
    small_w = max(2, int(np.ceil(image.shape[1] / 14)))
    coarse = rng.random((small_h, small_w), dtype=np.float32)
    field = cv2.resize(coarse, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_CUBIC)
    threshold = {1: .18, 2: .31, 3: .44}[level]
    selected = np.where(field < threshold, 255, 0).astype(np.uint8)
    mask = cv2.bitwise_and(green, selected)
    if level >= 2:
        mask = cv2.dilate(mask, np.ones((2, 2), np.uint8), iterations=1)
    return cv2.medianBlur(mask, 3)


def generate_pruning() -> list[str]:
    base = cv2.imread(str(BASE / 'black.webp'), cv2.IMREAD_COLOR)
    if base is None or base.shape[:2] != (1500, 900):
        raise SystemExit('invalid black pine master photograph')
    names: list[str] = []
    for index, (part, box) in enumerate(PARTS.items()):
        for level in (1, 2, 3):
            mask = green_mask(base, box, level, seed=7100 + index * 37 + level * 101)
            count = cv2.countNonZero(mask)
            if count < 45:
                raise SystemExit(f'pruning mask too small: {part} l{level} ({count})')
            inpainted = cv2.inpaint(base, mask, 1.5 + level * .35, cv2.INPAINT_TELEA)
            local = cv2.bilateralFilter(base, 7, 24, 24)
            replacement = cv2.addWeighted(inpainted, .72, local, .28, 0)
            alpha = cv2.GaussianBlur(mask, (0, 0), .55 + level * .12)
            alpha = np.clip(alpha.astype(np.float32) * {1: .78, 2: .88, 3: .96}[level], 0, 255).astype(np.uint8)
            overlay = np.dstack([replacement, alpha])
            name = f'{part}-l{level}.webp'
            write_webp(overlay, PRUNING_OUT / name)
            names.append(name)
    return names


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    for directory in (WIRE_OUT, DEADWOOD_OUT, PRUNING_OUT):
        directory.mkdir(parents=True, exist_ok=True)
    wire = generate_wire()
    deadwood = generate_deadwood()
    pruning = generate_pruning()
    report = {
        'wire': wire,
        'deadwood': deadwood,
        'pruning': pruning,
        'counts': {'wire': len(wire), 'deadwood': len(deadwood), 'pruning': len(pruning)},
        'digests': {
            str(path.relative_to(PUBLIC)): digest(path)
            for directory in (WIRE_OUT, DEADWOOD_OUT, PRUNING_OUT)
            for path in sorted(directory.glob('*.webp'))
        },
    }
    if report['counts'] != {'wire': 12, 'deadwood': 24, 'pruning': 18}:
        raise SystemExit(f'invalid state asset counts: {report["counts"]}')
    output = ROOT / 'next/black-pine-state-v9-assets.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
