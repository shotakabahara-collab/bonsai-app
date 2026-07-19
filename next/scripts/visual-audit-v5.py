from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Audit BONSAI iPhone artwork captures.')
    parser.add_argument('--root', default='test-artifacts')
    parser.add_argument('--output', default='authentic-v5-visual-audit.json')
    return parser.parse_args()


def viewport_artwork_box(image: Image.Image) -> tuple[int, int, int, int]:
    width, height = image.size
    return (
        int(width * 0.055),
        int(height * 0.13),
        int(width * 0.945),
        int(height * 0.77),
    )


def stage_artwork_box(image: Image.Image) -> tuple[int, int, int, int]:
    """Trim frame labels/status chips and inspect the photographed tree itself."""
    width, height = image.size
    return (
        int(width * 0.02),
        int(height * 0.15),
        int(width * 0.98),
        int(height * 0.90),
    )


def inspect_capture(path: Path, *, stage_only: bool = False) -> tuple[Image.Image, dict[str, object]]:
    minimum_bytes = 250_000 if stage_only else 160_000
    if not path.exists() or path.stat().st_size < minimum_bytes:
        raise SystemExit(f'{path.name}: missing or suspiciously small')
    image = Image.open(path).convert('RGB')
    width, height = image.size
    if stage_only:
        if width < 600 or height < 900:
            raise SystemExit(f'{path.name}: unexpected photographed-stage size {image.size}')
        box = stage_artwork_box(image)
    else:
        if width < 390 or height < 700:
            raise SystemExit(f'{path.name}: unexpected viewport {image.size}')
        box = viewport_artwork_box(image)
    crop = image.crop(box).resize((120, 176)).convert('L')
    stat = ImageStat.Stat(crop)
    pixels = list(crop.getdata())
    bright = sum(value > 45 for value in pixels) / len(pixels)
    near_white = sum(value > 248 for value in pixels) / len(pixels)
    result = {
        'size': [width, height],
        'bytes': path.stat().st_size,
        'mean': stat.mean[0],
        'variance': stat.var[0],
        'brightRatio': bright,
        'nearWhiteRatio': near_white,
        'stageOnly': stage_only,
    }
    if stat.mean[0] < 17 or stat.var[0] < 235 or bright < 0.05:
        raise SystemExit(f'{path.name}: blank or hidden photographed artwork {result}')
    return image, result


def compare_state(base: Image.Image, changed: Image.Image, label: str) -> dict[str, float]:
    if changed.size != base.size:
        raise SystemExit(f'{label}: photographed stage changed size {base.size} -> {changed.size}')
    box = stage_artwork_box(base)
    delta = ImageChops.difference(base.crop(box), changed.crop(box)).resize((150, 220)).convert('L')
    values = list(delta.getdata())
    width, height = delta.size
    changed_mask = [value > 5 for value in values]
    severe_mask = [value > 48 for value in values]
    row_ratios = [sum(changed_mask[y * width:(y + 1) * width]) / width for y in range(height)]
    column_ratios = [sum(changed_mask[y * width + x] for y in range(height)) / height for x in range(width)]
    result = {
        'mean': ImageStat.Stat(delta).mean[0],
        'changedRatio': sum(changed_mask) / len(changed_mask),
        'severeRatio': sum(severe_mask) / len(severe_mask),
        'maxRowRatio': max(row_ratios),
        'maxColumnRatio': max(column_ratios),
    }
    if result['mean'] < 0.12 or result['changedRatio'] < 0.0015:
        raise SystemExit(f'{label}: work produced no visible state change {result}')
    # Only the central photographed tree is compared. A broad delta here is a real tint,
    # white band, dark ellipse or pasted panel rather than scroll-position drift.
    if result['changedRatio'] > 0.12 or result['severeRatio'] > 0.06:
        raise SystemExit(f'{label}: effect is implausibly broad, likely a pasted overlay {result}')
    if result['maxRowRatio'] > 0.55 or result['maxColumnRatio'] > 0.55:
        raise SystemExit(f'{label}: detected a straight band crossing the photographed tree {result}')
    return result


def main() -> None:
    args = parse_args()
    root = Path(args.root)

    viewport_required = [
        '01-grow-visible.png',
        '03-show-visible.png',
        'authentic-v5-danger-advice.png',
        'authentic-v5-danger-result.png',
        'authentic-v5-base.png',
        'authentic-v5-wire.png',
        'authentic-v5-deadwood-fresh.png',
        'authentic-v5-deadwood-paused.png',
        'authentic-v5-offline.png',
    ]
    stage_required = [
        'authentic-v5-base-artwork.png',
        'authentic-v5-wire-artwork.png',
        'authentic-v5-deadwood-fresh-artwork.png',
        'authentic-v5-deadwood-paused-artwork.png',
        'authentic-v5-offline-artwork.png',
    ]

    report: dict[str, object] = {}
    stage_images: dict[str, Image.Image] = {}
    for name in viewport_required:
        _, result = inspect_capture(root / name)
        report[name] = result
    for name in stage_required:
        image, result = inspect_capture(root / name, stage_only=True)
        stage_images[name] = image
        report[name] = result

    base = stage_images['authentic-v5-base-artwork.png']
    report['wireDelta'] = compare_state(base, stage_images['authentic-v5-wire-artwork.png'], 'wireDelta')
    report['deadwoodDelta'] = compare_state(base, stage_images['authentic-v5-deadwood-fresh-artwork.png'], 'deadwoodDelta')

    fresh = stage_images['authentic-v5-deadwood-fresh-artwork.png']
    paused = stage_images['authentic-v5-deadwood-paused-artwork.png']
    if fresh.size != paused.size:
        raise SystemExit('pauseAppearanceDelta: photographed stage changed size')
    box = stage_artwork_box(fresh)
    pause_delta = ImageChops.difference(fresh.crop(box), paused.crop(box)).resize((150, 220)).convert('L')
    pause_values = list(pause_delta.getdata())
    pause_mean = ImageStat.Stat(pause_delta).mean[0]
    pause_changed = sum(value > 5 for value in pause_values) / len(pause_values)
    report['pauseAppearanceDelta'] = {'mean': pause_mean, 'changedRatio': pause_changed}
    # Pausing is not undo; the photographed wood itself must remain unchanged.
    if pause_mean > 1.0 or pause_changed > 0.02:
        raise SystemExit(f'pausing deadwood changed the physical artwork too much: {report["pauseAppearanceDelta"]}')

    offline = stage_images['authentic-v5-offline-artwork.png']
    if fresh.size != offline.size:
        raise SystemExit('offlineAppearanceDelta: photographed stage changed size')
    offline_delta = ImageChops.difference(fresh.crop(box), offline.crop(box)).resize((150, 220)).convert('L')
    offline_values = list(offline_delta.getdata())
    offline_mean = ImageStat.Stat(offline_delta).mean[0]
    offline_changed = sum(value > 5 for value in offline_values) / len(offline_values)
    report['offlineAppearanceDelta'] = {'mean': offline_mean, 'changedRatio': offline_changed}
    if offline_mean > 1.0 or offline_changed > 0.02:
        raise SystemExit(f'offline restart changed the saved physical artwork: {report["offlineAppearanceDelta"]}')

    output = root / args.output
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
