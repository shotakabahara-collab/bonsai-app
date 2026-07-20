from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math
import random
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / 'public/assets/kuromatsu/base/black.webp'
OUT = ROOT / 'public/assets/kuromatsu/deadwood-photo-v6'
OUT.mkdir(parents=True, exist_ok=True)

BASE = Image.open(BASE_PATH).convert('RGB')
W, H = BASE.size
if (W, H) != (900, 1500):
    raise SystemExit(f'Unexpected black-pine master size: {(W, H)}')

A = np.asarray(BASE).astype(np.float32)
R, G, B = A[..., 0], A[..., 1], A[..., 2]
LUM = .30 * R + .52 * G + .18 * B
NOT_GREEN = (G < R * 1.16 + 10) | (G < B * 1.18 + 8)
WOOD_PIXELS = (LUM < 178) & NOT_GREEN
WOOD_MASK = (
    Image.fromarray((WOOD_PIXELS * 255).astype(np.uint8), 'L')
    .filter(ImageFilter.MaxFilter(3))
    .filter(ImageFilter.MinFilter(3))
)


def samples(points: list[tuple[float, float, float]], step: float = 1.0) -> list[tuple[float, float, float]]:
    result: list[tuple[float, float, float]] = []
    for current, following in zip(points, points[1:]):
        x0, y0, w0 = current
        x1, y1, w1 = following
        count = max(2, int(math.hypot(x1 - x0, y1 - y0) / step))
        for index in range(count):
            t = index / count
            smooth = t * t * (3 - 2 * t)
            result.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w0 + (w1 - w0) * smooth))
    result.append(points[-1])
    return result


def low_noise(seed: int, scale: int = 26) -> Image.Image:
    rng = np.random.default_rng(seed)
    grid = (rng.random((max(2, H // scale), max(2, W // scale))) * 255).astype(np.uint8)
    return (
        Image.fromarray(grid, 'L')
        .resize((W, H), Image.Resampling.BICUBIC)
        .filter(ImageFilter.GaussianBlur(1.2))
    )


def make_mask(
    segments: list[list[tuple[float, float, float]]],
    seed: int,
    *,
    clip_wood: bool = True,
    holes: bool = True,
) -> tuple[Image.Image, list[tuple[float, float, float]]]:
    mask = Image.new('L', (W, H), 0)
    draw = ImageDraw.Draw(mask)
    all_samples: list[tuple[float, float, float]] = []
    for segment in segments:
        segment_samples = samples(segment)
        all_samples += segment_samples
        for x, y, width in segment_samples:
            radius = max(.6, width / 2)
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=255)

    # A clean Bezier edge reads as an overlay. Real peeled bark has torn fibres
    # and small recesses, so the boundary is broken by deterministic noise.
    mask = mask.filter(ImageFilter.GaussianBlur(.45))
    core = mask.filter(ImageFilter.MinFilter(3))
    outer = mask.filter(ImageFilter.MaxFilter(5))
    boundary = ImageChops.subtract(outer, core)
    noise = np.asarray(low_noise(seed))
    pixels = np.maximum(np.asarray(core), ((np.asarray(boundary) > 0) & (noise > 125)) * 255).astype(np.uint8)
    mask = Image.fromarray(pixels, 'L').filter(ImageFilter.GaussianBlur(.25))

    if clip_wood:
        mask = ImageChops.multiply(mask, WOOD_MASK)

    if holes:
        rng = random.Random(seed + 77)
        mask_draw = ImageDraw.Draw(mask)
        candidates = [point for point in all_samples if point[2] > 6]
        for _ in range(max(5, len(all_samples) // 95)):
            x, y, width = rng.choice(candidates)
            radius_x = rng.uniform(1.2, width * .22)
            radius_y = rng.uniform(2.0, width * .48)
            angle = rng.uniform(-1.0, 1.0)
            polygon = []
            for index in range(9):
                phase = 2 * math.pi * index / 9
                wobble = 1 + rng.uniform(-.32, .25)
                local_x = math.cos(phase) * radius_x * wobble
                local_y = math.sin(phase) * radius_y * wobble
                polygon.append((
                    x + local_x * math.cos(angle) - local_y * math.sin(angle),
                    y + local_x * math.sin(angle) + local_y * math.cos(angle),
                ))
            mask_draw.polygon(polygon, fill=0)

    return mask, all_samples


def make_layer(
    mask: Image.Image,
    centreline: list[tuple[float, float, float]],
    seed: int,
    kind: str,
) -> Image.Image:
    # Preserve photographed bark relief and recolour only the stripped wood.
    # This keeps the master photograph's light direction and micro-contrast.
    base = A.copy()
    blurred = np.asarray(BASE.convert('L').filter(ImageFilter.GaussianBlur(2.2))).astype(np.float32)
    detail = LUM - blurred
    target = np.empty_like(base)
    target[..., 0] = 138 + detail * 1.20
    target[..., 1] = 104 + detail * .95
    target[..., 2] = 72 + detail * .72
    if kind == 'jin':
        target += np.array([5, 4, 2], dtype=np.float32)
    noise = (np.asarray(low_noise(seed + 3, scale=16)).astype(np.float32) - 128)[..., None] * .06
    wood = np.clip(base * .43 + target * .57 + noise, 0, 255).astype(np.uint8)
    alpha = (np.asarray(mask).astype(np.float32) * .90).astype(np.uint8)
    layer = Image.fromarray(np.dstack([wood, alpha]), 'RGBA')

    # Contact shadow outside and a thin, broken cambium line inside the peel.
    ring = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(5)), mask).point(lambda value: int(value * .26))
    lip = Image.new('RGBA', (W, H), (36, 24, 17, 0))
    lip.putalpha(ring)
    layer = Image.alpha_composite(lip, layer)
    inner = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(3))).point(lambda value: int(value * .17))
    cambium = Image.new('RGBA', (W, H), (111, 65, 42, 0))
    cambium.putalpha(inner)
    layer = Image.alpha_composite(layer, cambium)

    draw = ImageDraw.Draw(layer, 'RGBA')
    rng = random.Random(seed + 9)
    stride = max(1, len(centreline) // 190)
    sparse = centreline[::stride]

    # Longitudinal fibres follow the photographed branch or trunk direction.
    for grain_index in range(5 if kind == 'shari' else 4):
        offset = (grain_index - 2) * 1.4 + rng.uniform(-.35, .35)
        points: list[tuple[float, float]] = []
        for index, (x, y, _width) in enumerate(sparse):
            before = sparse[max(0, index - 1)]
            after = sparse[min(len(sparse) - 1, index + 1)]
            tangent_x, tangent_y = after[0] - before[0], after[1] - before[1]
            length = max(1, math.hypot(tangent_x, tangent_y))
            normal_x, normal_y = -tangent_y / length, tangent_x / length
            jitter = math.sin(index * .24 + grain_index * 1.8) * .45
            points.append((x + normal_x * (offset + jitter), y + normal_y * (offset + jitter)))
        draw.line(points, fill=(45, 36, 27, 65 if grain_index % 2 == 0 else 42), width=1, joint='curve')

    # Small cross-grain drying checks; never a repeated dashed SVG line.
    for _ in range(max(3, len(centreline) // 110)):
        index = rng.randrange(5, len(centreline) - 5)
        x, y, width = centreline[index]
        before = centreline[index - 4]
        after = centreline[index + 4]
        tangent_x, tangent_y = after[0] - before[0], after[1] - before[1]
        length = max(1, math.hypot(tangent_x, tangent_y))
        normal_x, normal_y = -tangent_y / length, tangent_x / length
        half = width * rng.uniform(.14, .30)
        draw.line(
            [(x - normal_x * half, y - normal_y * half), (x + normal_x * half * .65, y + normal_y * half * .65)],
            fill=(33, 27, 22, 82),
            width=1,
        )

    clipped_alpha = np.minimum(np.asarray(layer.getchannel('A')), np.asarray(mask))
    layer.putalpha(Image.fromarray(clipped_alpha.astype(np.uint8), 'L'))
    return layer


TRUNK = [
    (302, 1238), (286, 1188), (255, 1135), (229, 1090), (228, 1045),
    (255, 1008), (315, 978), (365, 945), (387, 900), (397, 850),
    (414, 800), (432, 750), (450, 700), (469, 650), (482, 600), (486, 555),
]
WIDTHS = [13, 16, 18, 19, 18, 17, 18, 18, 16, 15, 14, 13, 12, 11, 10, 8]


def trunk_point(index: int, side: str, width: float) -> tuple[float, float, float]:
    x, y = TRUNK[index]
    before = TRUNK[max(0, index - 1)]
    after = TRUNK[min(len(TRUNK) - 1, index + 1)]
    tangent_x, tangent_y = after[0] - before[0], after[1] - before[1]
    length = max(1, math.hypot(tangent_x, tangent_y))
    normal_x, normal_y = -tangent_y / length, tangent_x / length
    sign = -1 if side == 'left' else 1
    offset = sign * 2.2
    return x + normal_x * offset, y + normal_y * offset, width


def write_shari(side: str, level: int) -> None:
    groups = {
        1: [(0, 4), (5, 7)],
        2: [(0, 4), (5, 7), (7, 10), (10, 12)],
        3: [(0, 4), (5, 7), (7, 10), (10, 12), (12, 16)],
    }[level]
    segments: list[list[tuple[float, float, float]]] = []
    for start, end in groups:
        segment = []
        for index in range(start, end):
            width = WIDTHS[index] * (.52 if index in (start, end - 1) else 1)
            segment.append(trunk_point(index, side, width))
        segments.append(segment)
    seed = 5000 + level + (50 if side == 'right' else 0)
    mask, centreline = make_mask(segments, seed, clip_wood=True, holes=True)
    make_layer(mask, centreline, seed, 'shari').save(
        OUT / f'shari-{side}-l{level}.webp', 'WEBP', lossless=True, method=6
    )


for shari_side in ('left', 'right'):
    for shari_level in (1, 2, 3):
        write_shari(shari_side, shari_level)


JIN = {
    'apex': [(480, 606, 16), (478, 592, 14), (475, 578, 10), (471, 564, 3)],
    'firstLeft': [(466, 590, 16), (452, 585, 13), (439, 580, 9), (427, 575, 3)],
    'secondRight': [(492, 486, 15), (505, 483, 12), (519, 481, 8), (532, 480, 3)],
    'thirdLeft': [(399, 829, 14), (388, 833, 11), (377, 837, 7), (366, 841, 2.5)],
    'back': [(472, 612, 12), (482, 614, 9), (491, 617, 6), (500, 620, 2.2)],
    'front': [(405, 815, 13), (416, 819, 10), (427, 823, 6), (438, 827, 2.2)],
}

def jin_level_points(points: list[tuple[float, float, float]], level: int) -> list[tuple[float, float, float]]:
    if level == 1:
        return points
    origin_x, origin_y, _ = points[0]
    length_scale = {2: 1.28, 3: 1.55}[level]
    width_scale = {2: 1.20, 3: 1.38}[level]
    result = []
    for index, (x, y, width) in enumerate(points):
        taper = 1 - index / max(1, len(points) - 1) * .12
        result.append((
            origin_x + (x - origin_x) * length_scale,
            origin_y + (y - origin_y) * length_scale,
            max(2.0, width * width_scale * taper),
        ))
    return result


for offset, (name, base_points) in enumerate(JIN.items()):
    for level in (1, 2, 3):
        points = jin_level_points(base_points, level)
        seed = 6000 + offset
        mask, centreline = make_mask([points], seed, clip_wood=True, holes=False)
        # Tear a small notch from the free end so the jin does not terminate as a cap.
        draw = ImageDraw.Draw(mask)
        end_x, end_y, end_width = points[-1]
        notch = max(3.0, end_width * .9)
        draw.polygon([
            (end_x - notch, end_y - notch * .45),
            (end_x + notch * .25, end_y),
            (end_x - notch * .45, end_y + notch),
        ], fill=0)
        make_layer(mask, centreline, seed, 'jin').save(
            OUT / f'jin-{name}-l{level}.webp', 'WEBP', lossless=True, method=6
        )

expected = {
    *(f'shari-{side}-l{level}.webp' for side in ('left', 'right') for level in (1, 2, 3)),
    *(f'jin-{name}-l{level}.webp' for name in JIN for level in (1, 2, 3)),
}
actual = {path.name for path in OUT.glob('*.webp')}
if actual != expected:
    raise SystemExit(f'Unexpected deadwood asset set: {sorted(actual)}')
for path in OUT.glob('*.webp'):
    image = Image.open(path)
    if image.size != (900, 1500) or image.mode != 'RGBA':
        raise SystemExit(f'Invalid deadwood asset {path}: {image.mode} {image.size}')
print(f'Generated {len(actual)} photographed deadwood layers in {OUT}')
