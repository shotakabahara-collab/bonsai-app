from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageStat


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Audit Photoreal Craft v6 iPhone artwork captures.')
    parser.add_argument('--root', default='test-artifacts')
    parser.add_argument('--output', default='photoreal-v6-visual-audit.json')
    return parser.parse_args()


def load_artwork(path: Path) -> Image.Image:
    if not path.exists() or path.stat().st_size < 120_000:
        raise SystemExit(f'{path.name}: missing or suspiciously small')
    image = Image.open(path).convert('RGB')
    width, height = image.size
    if width < 600 or height < 800:
        raise SystemExit(f'{path.name}: unexpected artwork size {image.size}')
    return image


def image_health(image: Image.Image, name: str, size_bytes: int) -> dict[str, object]:
    sample = image.resize((120, 176)).convert('L')
    values = np.asarray(sample, dtype=np.uint8)
    stat = ImageStat.Stat(sample)
    result = {
        'size': list(image.size),
        'bytes': size_bytes,
        'mean': stat.mean[0],
        'variance': stat.var[0],
        'brightRatio': float(np.mean(values > 45)),
        'nearWhiteRatio': float(np.mean(values > 248)),
    }
    if stat.mean[0] < 17 or stat.var[0] < 230 or result['brightRatio'] < .05:
        raise SystemExit(f'{name}: blank or hidden photographed artwork {result}')
    return result


def connected_components(mask: np.ndarray) -> list[dict[str, int | float]]:
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    components: list[dict[str, int | float]] = []
    for y0, x0 in zip(*np.nonzero(mask & ~seen)):
        if seen[y0, x0]:
            continue
        queue = deque([(int(y0), int(x0))])
        seen[y0, x0] = True
        count = 0
        min_x = max_x = int(x0)
        min_y = max_y = int(y0)
        while queue:
            y, x = queue.popleft()
            count += 1
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        bbox_w = max_x - min_x + 1
        bbox_h = max_y - min_y + 1
        components.append({
            'pixels': count,
            'width': bbox_w,
            'height': bbox_h,
            'fill': count / max(1, bbox_w * bbox_h),
        })
    return sorted(components, key=lambda item: int(item['pixels']), reverse=True)


def compare_state(base: Image.Image, changed: Image.Image, label: str) -> dict[str, object]:
    if changed.size != base.size:
        raise SystemExit(f'{label}: artwork size changed {base.size} -> {changed.size}')
    # Downsample enough to absorb antialiasing but preserve bands and giant tubes.
    base_small = base.resize((300, 500), Image.Resampling.LANCZOS)
    changed_small = changed.resize((300, 500), Image.Resampling.LANCZOS)
    delta_rgb = np.asarray(ImageChops.difference(base_small, changed_small), dtype=np.uint8)
    delta = np.max(delta_rgb, axis=2)
    changed_mask = delta > 7
    severe_mask = delta > 55
    components = connected_components(changed_mask)
    largest = components[0] if components else {'pixels': 0, 'width': 0, 'height': 0, 'fill': 0.0}
    row_ratio = np.mean(changed_mask, axis=1)
    column_ratio = np.mean(changed_mask, axis=0)

    changed_arr = np.asarray(changed_small, dtype=np.uint8)
    red, green, blue = changed_arr[..., 0], changed_arr[..., 1], changed_arr[..., 2]
    bright_orange = (red > 185) & (green > 80) & (green < 175) & (blue < 95) & ((red.astype(int) - green.astype(int)) > 45)
    pale_band = (delta > 30) & (red > 210) & (green > 190) & (blue > 165)

    result: dict[str, object] = {
        'mean': float(np.mean(delta)),
        'changedRatio': float(np.mean(changed_mask)),
        'severeRatio': float(np.mean(severe_mask)),
        'maxRowRatio': float(np.max(row_ratio)),
        'maxColumnRatio': float(np.max(column_ratio)),
        'largestComponent': largest,
        'componentCount': len(components),
        'brightOrangeRatio': float(np.mean(bright_orange & changed_mask)),
        'paleBandRatio': float(np.mean(pale_band)),
    }
    if result['mean'] < .035 or result['changedRatio'] < .00018:
        raise SystemExit(f'{label}: work produced no visible state change {result}')
    if result['changedRatio'] > .16 or result['severeRatio'] > .075:
        raise SystemExit(f'{label}: effect is implausibly broad {result}')
    if result['maxRowRatio'] > .56 or result['maxColumnRatio'] > .48:
        raise SystemExit(f'{label}: work crosses too much of the photograph {result}')
    if int(largest['width']) > 150 or int(largest['height']) > 360:
        raise SystemExit(f'{label}: giant connected tube or ribbon detected {result}')
    if result['brightOrangeRatio'] > .004 or result['paleBandRatio'] > .018:
        raise SystemExit(f'{label}: luminous orange or pale pasted ribbon detected {result}')

    circular = [item for item in components if 5 <= int(item['width']) <= 44 and 5 <= int(item['height']) <= 44 and .72 <= float(item['width']) / max(1, float(item['height'])) <= 1.38 and float(item['fill']) > .5]
    result['circularMarkerCandidates'] = circular[:8]
    if len(circular) > 2:
        raise SystemExit(f'{label}: circular marker/halo candidates detected {result}')
    return result


def compare_identity(first: Image.Image, second: Image.Image, label: str) -> dict[str, float]:
    if first.size != second.size:
        raise SystemExit(f'{label}: artwork size changed')
    delta = np.asarray(ImageChops.difference(first, second).resize((300, 500)).convert('L'), dtype=np.uint8)
    result = {'mean': float(np.mean(delta)), 'changedRatio': float(np.mean(delta > 5))}
    if result['mean'] > .12 or result['changedRatio'] > .0015:
        raise SystemExit(f'{label}: irreversible physical work changed unexpectedly {result}')
    return result


def main() -> None:
    args = parse_args()
    root = Path(args.root)
    names = [
        'authentic-v5-base-artwork.png',
        'authentic-v5-wire-artwork.png',
        'authentic-v5-deadwood-fresh-artwork.png',
        'authentic-v5-deadwood-paused-artwork.png',
        'photoreal-v6-combined-artwork.png',
        'authentic-v5-offline-artwork.png',
    ]
    images: dict[str, Image.Image] = {}
    report: dict[str, object] = {}
    for name in names:
        path = root / name
        image = load_artwork(path)
        images[name] = image
        report[name] = image_health(image, name, path.stat().st_size)

    base = images['authentic-v5-base-artwork.png']
    report['wireDelta'] = compare_state(base, images['authentic-v5-wire-artwork.png'], 'wireDelta')
    report['deadwoodDelta'] = compare_state(base, images['authentic-v5-deadwood-fresh-artwork.png'], 'deadwoodDelta')
    # A deadwood state must occupy an irregular photographed surface, not collapse
    # back into the thin vector line that failed the iPhone review.
    deadwood = report['deadwoodDelta']
    if deadwood['changedRatio'] < .0024 or deadwood['componentCount'] < 3 or int(deadwood['largestComponent']['width']) < 7 or int(deadwood['largestComponent']['height']) < 28:
        raise SystemExit(f"deadwoodDelta: stripped wood is too thin or too small {deadwood}")
    report['combinedDelta'] = compare_state(base, images['photoreal-v6-combined-artwork.png'], 'combinedDelta')
    report['pauseAppearanceDelta'] = compare_identity(
        images['authentic-v5-deadwood-fresh-artwork.png'],
        images['authentic-v5-deadwood-paused-artwork.png'],
        'pauseAppearanceDelta',
    )
    report['offlineAppearanceDelta'] = compare_identity(
        images['photoreal-v6-combined-artwork.png'],
        images['authentic-v5-offline-artwork.png'],
        'offlineAppearanceDelta',
    )

    output = root / args.output
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
