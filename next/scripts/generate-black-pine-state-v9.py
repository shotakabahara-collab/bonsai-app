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
    alpha = out[..., 3] / 255.0
    if kind == 'wire':
        out[..., 2] = np.clip(out[..., 2] * (1.08 + .10 * strength) + 8, 0, 255)
        out[..., 1] = np.clip(out[..., 1] * (1.01 + .04 * strength), 0, 255)
        out[..., 0] = np.clip(out[..., 0] * .90, 0, 255)
        kernel = np.ones((3, 3), np.uint8)
        expanded = cv2.dilate((alpha * 255).astype(np.uint8), kernel, iterations=1)
        out[..., 3] = np.maximum(out[..., 3], expanded * (.58 + .12 * strength))
    else:
        gray = cv2.cvtColor(out[..., :3].astype(np.uint8), cv2.COLOR_BGR2GRAY)
        grain = cv2.Laplacian(gray, cv2.CV_32F)
        out[..., :3] = np.clip(out[..., :3] + grain[..., None] * (.08 + .05 * strength), 0, 255)
        out[..., 2] = np.clip(out[..., 2] * (1.03 + .04 * strength), 0, 255)
        out[..., 1] = np.clip(out[..., 1] * (1.01 + .02 * strength), 0, 255)
        out[..., 3] = np.clip(out[..., 3] * (1.08 + .10 * strength), 0, 255)
    return out.astype(np.uint8)


def generate_wire() -> list[str]:
    names: list[str] = []
    for part in PARTS:
        for intensity, strength in [('light', .55), ('strong', 1.0)]:
            source = read_rgba(WIRE_SRC / f'{part}-{intensity}.webp')
            result = enhance_transparent(source, 'wire', strength)
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


def green_mask(image: np.ndarray, box: tuple[int, int, int, int], level: int) -> np.ndarray:
    x0, y0, x1, y1 = box
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    green = cv2.inRange(hsv, np.array([28, 30, 18]), np.array([95, 255, 230]))
    roi = np.zeros(green.shape, np.uint8)
    cv2.rectangle(roi, (x0, y0), (x1, y1), 255, -1)
    mask = cv2.bitwise_and(green, roi)
    kernel = np.ones((3 + level * 2, 3 + level * 2), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=level)
    return mask


def generate_pruning() -> list[str]:
    base = cv2.imread(str(BASE / 'black.webp'), cv2.IMREAD_COLOR)
    if base is None or base.shape[:2] != (1500, 900):
        raise SystemExit('invalid black pine master photograph')
    names: list[str] = []
    for part, box in PARTS.items():
        for level in (1, 2, 3):
            mask = green_mask(base, box, level)
            if cv2.countNonZero(mask) < 80:
                raise SystemExit(f'pruning mask too small: {part} l{level}')
            radius = 2 + level * 2
            changed = cv2.inpaint(base, mask, radius, cv2.INPAINT_TELEA)
            alpha = cv2.GaussianBlur(mask, (0, 0), 1.2 + level * .35)
            overlay = np.dstack([changed, alpha])
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
