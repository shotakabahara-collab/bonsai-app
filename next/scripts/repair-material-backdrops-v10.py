from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "public" / "assets" / "kuromatsu" / "base"
REFERENCE = BASE / "black.webp"
TARGETS = ("starter", "old", "blue")
REPORT = ROOT / "material-preview-v10-assets.json"
RELEASE = "bonsai-material-preview-v10"


def sigmoid(value: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-value))


def wall_metrics(image: np.ndarray) -> dict[str, object]:
    region = image[1130:1290, 30:870].astype(np.float32)
    luminance = 0.2126 * region[:, :, 0] + 0.7152 * region[:, :, 1] + 0.0722 * region[:, :, 2]
    pixels = region[luminance > 120]
    if len(pixels) < 80_000:
        raise RuntimeError(f"Too few wall pixels for audit: {len(pixels)}")
    maximum = pixels.max(axis=1)
    minimum = pixels.min(axis=1)
    saturation = np.where(maximum == 0, 0, (maximum - minimum) / maximum)
    average_rgb = pixels.mean(axis=0)
    return {
        "count": int(len(pixels)),
        "averageSaturation": float(saturation.mean()),
        "averageRgb": [float(value) for value in average_rgb],
        "maximumChannelDifference": float(average_rgb.max() - average_rgb.min()),
    }


def repair(name: str, reference: np.ndarray) -> dict[str, object]:
    path = BASE / f"{name}.webp"
    target_u8 = np.asarray(Image.open(path).convert("RGB"))
    if target_u8.shape != (1500, 900, 3):
        raise RuntimeError(f"Unexpected {name} dimensions: {target_u8.shape}")

    target = target_u8.astype(np.float32)
    height, width = target.shape[:2]
    registration = np.zeros((height, width), dtype=np.float32)
    cv2.rectangle(registration, (18, 1120), (882, 1307), 1.0, thickness=-1)
    registration = cv2.GaussianBlur(registration, (0, 0), sigmaX=12, sigmaY=10)

    target_luminance = 0.2126 * target[:, :, 0] + 0.7152 * target[:, :, 1] + 0.0722 * target[:, :, 2]
    reference_luminance = 0.2126 * reference[:, :, 0] + 0.7152 * reference[:, :, 1] + 0.0722 * reference[:, :, 2]
    wall_probability = sigmoid((target_luminance - 98) / 9) * sigmoid((reference_luminance - 105) / 9)
    alpha = registration * wall_probability

    rows = np.indices((height, width))[0]
    color_sample = (
        (rows > 1000)
        & (rows < 1110)
        & (target_luminance > 150)
        & (reference_luminance > 150)
    )
    target_mean = target[color_sample].mean(axis=0)
    reference_mean = reference[color_sample].mean(axis=0)
    target_std = target[color_sample].std(axis=0)
    reference_std = reference[color_sample].std(axis=0)
    matched_reference = (reference - reference_mean) * (target_std / (reference_std + 1e-6)) + target_mean
    matched_reference = np.clip(matched_reference, 0, 255)

    repaired = target * (1 - alpha[:, :, None]) + matched_reference * alpha[:, :, None]
    repaired_u8 = np.clip(repaired, 0, 255).astype(np.uint8)

    before = wall_metrics(target_u8)
    after = wall_metrics(repaired_u8)
    if after["averageSaturation"] > 0.04:
        raise RuntimeError(f"{name} backdrop remains saturated: {after}")
    if after["maximumChannelDifference"] > 8:
        raise RuntimeError(f"{name} backdrop remains color-biased: {after}")

    dark_foreground = target_luminance < 90
    foreground_delta = np.abs(repaired - target)[dark_foreground].mean()
    if foreground_delta > 0.8:
        raise RuntimeError(f"{name} foreground was altered: mean delta {foreground_delta}")

    temporary = path.with_suffix(".v10.webp")
    Image.fromarray(repaired_u8, mode="RGB").save(temporary, "WEBP", quality=94, method=6)
    verified = np.asarray(Image.open(temporary).convert("RGB"))
    verified_metrics = wall_metrics(verified)
    if verified_metrics["averageSaturation"] > 0.04 or verified_metrics["maximumChannelDifference"] > 8:
        raise RuntimeError(f"{name} encoded asset failed audit: {verified_metrics}")
    temporary.replace(path)

    changed = np.any(np.abs(repaired_u8.astype(np.int16) - target_u8.astype(np.int16)) > 3, axis=2)
    return {
        "path": str(path.relative_to(ROOT)),
        "dimensions": [width, height],
        "before": before,
        "after": verified_metrics,
        "changedPixelRatio": float(changed.mean()),
        "darkForegroundMeanDelta": float(foreground_delta),
        "bytes": path.stat().st_size,
    }


def replace_required(path: Path, old: str, new: str) -> None:
    content = path.read_text(encoding="utf-8")
    if old not in content and new not in content:
        raise RuntimeError(f"Expected release marker was not found in {path}")
    path.write_text(content.replace(old, new), encoding="utf-8")


def update_release_markers() -> None:
    replace_required(
        ROOT / "public" / "sw.js",
        "const VERSION = 'bonsai-black-pine-state-v9';",
        f"const VERSION = '{RELEASE}';",
    )
    replace_required(
        ROOT / "tests" / "authentic-v5.mjs",
        "bonsai-black-pine-state-v9-shell",
        "bonsai-material-preview-v10-shell",
    )


def main() -> None:
    reference = np.asarray(Image.open(REFERENCE).convert("RGB")).astype(np.float32)
    if reference.shape != (1500, 900, 3):
        raise RuntimeError(f"Unexpected reference dimensions: {reference.shape}")
    result = {name: repair(name, reference) for name in TARGETS}
    update_release_markers()
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("BONSAI Material Preview v10 base-backdrop repair: PASS")


if __name__ == "__main__":
    main()
