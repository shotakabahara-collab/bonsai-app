from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "public" / "assets" / "kuromatsu" / "base"
TARGETS = ("starter", "old", "blue", "black", "moon")
REPORT = ROOT / "material-preview-v11-assets.json"


def sigmoid(value: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-value))


def luminance(image: np.ndarray) -> np.ndarray:
    return 0.2126 * image[:, :, 0] + 0.7152 * image[:, :, 1] + 0.0722 * image[:, :, 2]


def build_masks(height: int, width: int) -> tuple[np.ndarray, np.ndarray]:
    registration = np.zeros((height, width), dtype=np.float32)
    cv2.rectangle(registration, (8, 1278), (width - 9, 1489), 1.0, thickness=-1)
    registration = cv2.GaussianBlur(registration, (0, 0), sigmaX=10, sigmaY=9)

    # Protect the pot, moss, roots and the base of the trunk. The floor remains editable
    # around and in front of the pot, while the bonsai itself keeps its photographed colour.
    protected = np.zeros((height, width), dtype=np.float32)
    cv2.ellipse(protected, (306, 1365), (222, 112), 0, 0, 360, 1.0, thickness=-1)
    cv2.ellipse(protected, (318, 1272), (72, 82), 0, 0, 360, 1.0, thickness=-1)
    protected = cv2.GaussianBlur(protected, (0, 0), sigmaX=8, sigmaY=7)
    return registration, np.clip(protected, 0, 1)


def floor_metrics(image: np.ndarray, registration: np.ndarray, protected: np.ndarray) -> dict[str, object]:
    image_f = image.astype(np.float32)
    light = luminance(image_f)
    sample = (registration > 0.92) & (protected < 0.08) & (light > 18)
    pixels = image_f[sample]
    if len(pixels) < 70_000:
        raise RuntimeError(f"Too few floor pixels for audit: {len(pixels)}")

    maximum = pixels.max(axis=1)
    minimum = pixels.min(axis=1)
    saturation = np.where(maximum == 0, 0, (maximum - minimum) / maximum)
    average_rgb = pixels.mean(axis=0)
    return {
        "count": int(len(pixels)),
        "averageSaturation": float(saturation.mean()),
        "averageRgb": [float(value) for value in average_rgb],
        "maximumChannelDifference": float(average_rgb.max() - average_rgb.min()),
        "redBlueBias": float(average_rgb[0] - average_rgb[2]),
        "averageLuminance": float(light[sample].mean()),
    }


def repair(name: str) -> dict[str, object]:
    path = BASE / f"{name}.webp"
    source_u8 = np.asarray(Image.open(path).convert("RGB"))
    if source_u8.shape != (1500, 900, 3):
        raise RuntimeError(f"Unexpected {name} dimensions: {source_u8.shape}")

    source = source_u8.astype(np.float32)
    height, width = source.shape[:2]
    registration, protected = build_masks(height, width)
    source_luminance = luminance(source)

    # Keep the photographed wood grain and shadow depth, but remove the strong red-brown
    # colour cast. A slight cool-grey balance separates the floor from the brown pot.
    neutral_luminance = np.clip(source_luminance * 1.065 + 2.0, 0, 255)
    neutral = np.stack(
        (
            neutral_luminance * 0.985,
            neutral_luminance,
            neutral_luminance * 1.015,
        ),
        axis=2,
    )
    neutral = np.clip(neutral, 0, 255)

    black_protection = 0.18 + 0.82 * sigmoid((source_luminance - 19.0) / 6.0)
    alpha = registration * (1.0 - protected * 0.985) * black_protection * 0.90
    repaired = source * (1.0 - alpha[:, :, None]) + neutral * alpha[:, :, None]
    repaired_u8 = np.clip(repaired, 0, 255).astype(np.uint8)

    before = floor_metrics(source_u8, registration, protected)
    after = floor_metrics(repaired_u8, registration, protected)
    if after["averageSaturation"] > 0.07:
        raise RuntimeError(f"{name} lower floor remains saturated: {after}")
    if after["maximumChannelDifference"] > 7:
        raise RuntimeError(f"{name} lower floor remains colour-biased: {after}")
    if after["redBlueBias"] > 3:
        raise RuntimeError(f"{name} lower floor remains red-brown: {after}")

    protected_pixels = protected > 0.82
    protected_delta = np.abs(repaired - source)[protected_pixels].mean()
    if protected_delta > 1.2:
        raise RuntimeError(f"{name} pot or root area was altered: mean delta {protected_delta}")

    last_rows_delta = np.abs(repaired[-8:] - source[-8:]).mean()
    if last_rows_delta > 0.15:
        raise RuntimeError(f"{name} bottom black edge was altered: mean delta {last_rows_delta}")

    temporary = path.with_suffix(".v11.webp")
    Image.fromarray(repaired_u8, mode="RGB").save(temporary, "WEBP", quality=95, method=6)
    verified = np.asarray(Image.open(temporary).convert("RGB"))
    verified_metrics = floor_metrics(verified, registration, protected)
    if verified_metrics["averageSaturation"] > 0.07 or verified_metrics["maximumChannelDifference"] > 7 or verified_metrics["redBlueBias"] > 3:
        raise RuntimeError(f"{name} encoded floor asset failed audit: {verified_metrics}")
    temporary.replace(path)

    changed = np.any(np.abs(repaired_u8.astype(np.int16) - source_u8.astype(np.int16)) > 3, axis=2)
    return {
        "path": str(path.relative_to(ROOT)),
        "dimensions": [width, height],
        "before": before,
        "after": verified_metrics,
        "changedPixelRatio": float(changed.mean()),
        "protectedPotRootMeanDelta": float(protected_delta),
        "bottomEdgeMeanDelta": float(last_rows_delta),
        "bytes": path.stat().st_size,
    }


def replace_required(path: Path, old: str, new: str) -> None:
    content = path.read_text(encoding="utf-8")
    if old not in content and new not in content:
        raise RuntimeError(f"Expected release marker was not found in {path}")
    path.write_text(content.replace(old, new), encoding="utf-8")


def update_offline_contract() -> None:
    replace_required(
        ROOT / "tests" / "authentic-v5.mjs",
        "bonsai-material-preview-v10-shell",
        "bonsai-material-preview-v11-shell",
    )


def main() -> None:
    result = {name: repair(name) for name in TARGETS}
    update_offline_contract()
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("BONSAI Material Preview v11 lower-floor neutralization: PASS")


if __name__ == "__main__":
    main()
