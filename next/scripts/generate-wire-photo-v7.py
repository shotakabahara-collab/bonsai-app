from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter
import math
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / 'public/assets/kuromatsu/base/black.webp'
OUT = ROOT / 'public/assets/kuromatsu/wire-photo-v7'
OUT.mkdir(parents=True, exist_ok=True)

BASE = Image.open(BASE_PATH).convert('RGB')
W, H = BASE.size
if (W, H) != (900, 1500):
    raise SystemExit(f'Unexpected black-pine master size: {(W, H)}')

arr = np.asarray(BASE).astype(np.int16)
mx = arr.max(axis=2)
mn = arr.min(axis=2)
lum = (arr[..., 0] * 30 + arr[..., 1] * 52 + arr[..., 2] * 18) / 100
sat = mx - mn
# White wall is bright and nearly neutral.  Every copper pixel is clipped to
# the photographed tree/needle silhouette (with a tiny contact allowance), so
# a wire turn can never float in empty wall space.
object_pixels = ((lum < 207) | (sat > 24)) & ~((arr[..., 0] > 218) & (arr[..., 1] > 214) & (arr[..., 2] > 205))
OBJECT_MASK = Image.fromarray((object_pixels * 255).astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(5))

GuidePoint = tuple[float, float, float]
GUIDES: dict[str, list[GuidePoint]] = {
    'apex': [(481, 607, 8.2), (474, 568, 8.0), (464, 529, 7.6), (451, 491, 7.1), (433, 454, 6.6), (411, 419, 6.1), (386, 388, 5.6), (360, 360, 5.1)],
    'firstLeft': [(466, 590, 7.3), (426, 574, 7.0), (386, 558, 6.6), (347, 545, 6.2), (309, 535, 5.8), (271, 528, 5.4), (234, 522, 5.0), (198, 517, 4.6)],
    'secondRight': [(493, 486, 7.8), (537, 480, 7.4), (581, 479, 7.0), (625, 482, 6.5), (669, 489, 6.0), (713, 500, 5.5), (756, 514, 5.0)],
    'thirdLeft': [(397, 829, 6.2), (373, 837, 5.8), (349, 846, 5.3), (326, 857, 4.8)],
    'back': [(473, 612, 6.3), (507, 619, 5.9), (541, 628, 5.5), (575, 639, 5.0), (608, 651, 4.6)],
    'front': [(405, 814, 6.4), (444, 827, 5.9), (483, 841, 5.4), (522, 856, 4.9), (560, 873, 4.5)],
}


def resample(points: list[GuidePoint], step: float = 0.9) -> list[tuple[float, float, float, float]]:
    out: list[tuple[float, float, float, float]] = []
    distance = 0.0
    for a, b in zip(points, points[1:]):
        x0, y0, r0 = a
        x1, y1, r1 = b
        length = math.hypot(x1 - x0, y1 - y0)
        count = max(2, int(length / step))
        tangent = math.atan2(y1 - y0, x1 - x0)
        for i in range(count):
            t = i / count
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t, distance + length * t))
        distance += length
    x, y, r = points[-1]
    tangent = math.atan2(points[-1][1] - points[-2][1], points[-1][0] - points[-2][0])
    out.append((x, y, r, distance))
    return out


def corridor_mask(samples: list[tuple[float, float, float, float]], intensity: str) -> Image.Image:
    mask = Image.new('L', (W, H), 0)
    draw = ImageDraw.Draw(mask)
    extra = 4.5 if intensity == 'strong' else 3.3
    for x, y, radius, _ in samples[::2]:
        rr = radius + extra
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=255)
    return ImageChops.multiply(mask.filter(ImageFilter.GaussianBlur(.35)), OBJECT_MASK)


def segments(samples: list[tuple[float, float, float, float]], intensity: str):
    radius_scale = .47 if intensity == 'strong' else .35
    pitch = 19.0 if intensity == 'strong' else 17.0
    front: list[list[tuple[float, float, float, float]]] = []
    back: list[list[tuple[float, float, float, float]]] = []
    active: list[tuple[float, float, float, float]] = []
    active_front: bool | None = None
    for i, (x, y, radius, distance) in enumerate(samples):
        before = samples[max(0, i - 2)]
        after = samples[min(len(samples) - 1, i + 2)]
        dx, dy = after[0] - before[0], after[1] - before[1]
        length = max(1e-6, math.hypot(dx, dy))
        nx, ny = -dy / length, dx / length
        phase = distance / pitch * math.tau + .35
        depth = math.cos(phase)
        offset = math.sin(phase) * radius * radius_scale
        px = x + nx * offset
        py = y + ny * offset
        is_front = depth >= -.10
        point = (px, py, nx, ny)
        if active_front is None:
            active_front = is_front
            active = [point]
        elif active_front == is_front:
            active.append(point)
        else:
            active.append(point)
            if len(active) >= 2:
                (front if active_front else back).append(active)
            active = [point]
            active_front = is_front
    if len(active) >= 2:
        (front if active_front else back).append(active)
    return front, back


def draw_polyline(draw: ImageDraw.ImageDraw, points: list[tuple[float, float, float, float]], intensity: str, front: bool, scale: int):
    coords = [(round(p[0] * scale), round(p[1] * scale)) for p in points]
    if intensity == 'strong':
        width = 1.85 if front else 1.35
    else:
        width = 1.25 if front else .92
    width_px = max(2, round(width * scale))
    if front:
        draw.line([(x + scale, y + scale) for x, y in coords], fill=(25, 14, 8, 110), width=width_px + 2, joint='curve')
        draw.line(coords, fill=(113, 68, 43, 235), width=width_px, joint='curve')
        draw.line([(x - 1, y - 1) for x, y in coords], fill=(191, 129, 84, 125), width=max(1, width_px // 3), joint='curve')
    else:
        draw.line(coords, fill=(54, 34, 23, 95), width=max(2, width_px), joint='curve')


def make_wire(part: str, intensity: str) -> Image.Image:
    sample_points = resample(GUIDES[part])
    front, back = segments(sample_points, intensity)
    scale = 2
    hi = Image.new('RGBA', (W * scale, H * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(hi, 'RGBA')
    for segment in back:
        draw_polyline(draw, segment, intensity, False, scale)
    for segment in front:
        draw_polyline(draw, segment, intensity, True, scale)
    layer = hi.resize((W, H), Image.Resampling.LANCZOS)

    support = corridor_mask(sample_points, intensity)
    alpha = ImageChops.multiply(layer.getchannel('A'), support)
    alpha = alpha.filter(ImageFilter.MedianFilter(3))
    layer.putalpha(alpha)
    return layer



for part in GUIDES:
    for intensity in ('light', 'strong'):
        image = make_wire(part, intensity)
        image.save(OUT / f'{part}-{intensity}.webp', 'WEBP', lossless=True, method=6)

print(f'Generated {len(GUIDES) * 2} photographed wire states in {OUT}')
