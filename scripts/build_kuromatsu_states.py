#!/usr/bin/env python3
from __future__ import annotations

import base64
import re
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PHOTO_ASSETS = ROOT / "photo-assets.js"
ASSET_DIR = ROOT / "assets"
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"
STATE_JS = ROOT / "state-images.js"

ASSET_DIR.mkdir(exist_ok=True)


def decode_base_photo() -> np.ndarray:
    text = PHOTO_ASSETS.read_text(encoding="utf-8")
    match = re.search(r'pine:"data:image/(?:jpeg|jpg|png);base64,([^"]+)"', text)
    if not match:
        raise RuntimeError("pine base image not found in photo-assets.js")
    raw = base64.b64decode(match.group(1))
    arr = np.frombuffer(raw, np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError("failed to decode pine image")
    return image


def save_jpeg(path: Path, image: np.ndarray, quality: int = 92) -> None:
    ok = cv2.imwrite(str(path), image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise RuntimeError(f"failed to write {path}")


def green_mask(image: np.ndarray) -> np.ndarray:
    height = image.shape[0]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = (
        (hsv[:, :, 0] >= 25)
        & (hsv[:, :, 0] <= 95)
        & (hsv[:, :, 1] >= 45)
        & (hsv[:, :, 2] >= 35)
    ).astype(np.uint8)
    mask[int(height * 0.72):, :] = 0
    return mask


def fine_thin(image: np.ndarray, mask: np.ndarray, fraction: float, seed: int) -> np.ndarray:
    height, width = image.shape[:2]
    rng = np.random.default_rng(seed)
    small = rng.random((max(8, height // 6), max(8, width // 6))).astype(np.float32)
    noise = cv2.resize(small, (width, height), interpolation=cv2.INTER_LINEAR)
    noise = cv2.GaussianBlur(noise, (0, 0), 1.2)
    values = noise[mask.astype(bool)]
    threshold = np.quantile(values, fraction)
    remove = ((noise < threshold) & (mask > 0)).astype(np.uint8)
    remove = cv2.morphologyEx(remove, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    interior = cv2.erode(mask, np.ones((5, 5), np.uint8), iterations=1)
    remove *= interior

    background = cv2.GaussianBlur(image, (0, 0), 18)
    background = (
        background.astype(np.float32) * 0.65
        + np.array([18, 25, 21], dtype=np.float32) * 0.35
    ).clip(0, 255).astype(np.uint8)

    alpha = cv2.GaussianBlur(remove.astype(np.float32), (0, 0), 0.8)[..., None] * 0.82
    output = (image * (1 - alpha) + background * alpha).clip(0, 255).astype(np.uint8)
    blurred = cv2.GaussianBlur(output, (0, 0), 1.0)
    return cv2.addWeighted(output, 1.15, blurred, -0.15, 0)


def weak_dry(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
    green = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 7)
    hsv[:, :, 0] = hsv[:, :, 0] * (1 - green) + (hsv[:, :, 0] * 0.72 + 19) * green
    hsv[:, :, 1] *= (1 - 0.35 * green)
    hsv[:, :, 2] *= (1 - 0.13 * green)
    hsv[:, :, 1] *= 0.9
    output = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)

    soil = np.zeros((height, width), np.float32)
    cv2.ellipse(
        soil,
        (width // 2, int(height * 0.81)),
        (int(width * 0.38), int(height * 0.065)),
        0,
        0,
        360,
        1,
        -1,
    )
    soil = cv2.GaussianBlur(soil, (0, 0), 25)[..., None]
    tint = np.full_like(output, (70, 92, 112))
    output = (output * (1 - 0.18 * soil) + tint * (0.18 * soil)).clip(0, 255).astype(np.uint8)
    return cv2.convertScaleAbs(output, alpha=0.94, beta=5)


def award_finish(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    light, a, b = cv2.split(lab)
    light = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8)).apply(light)
    output = cv2.cvtColor(cv2.merge([light, a, b]), cv2.COLOR_LAB2BGR)
    hsv = cv2.cvtColor(output, cv2.COLOR_BGR2HSV).astype(np.float32)
    green = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 5)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * (1 + 0.18 * green), 0, 255)
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * (1 + 0.06 * green), 0, 255)
    output = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    yy, xx = np.mgrid[0:height, 0:width]
    distance = ((xx - width / 2) / (width / 2)) ** 2 + ((yy - height / 2) / (height / 2)) ** 2
    vignette = np.clip(1 - 0.16 * np.maximum(distance - 0.35, 0), 0.78, 1.0)[..., None]
    return (output * vignette).clip(0, 255).astype(np.uint8)


def write_state_mapping() -> None:
    STATE_JS.write_text(
        """(() => {
'use strict';
const ROOT = './assets/';
const FILES = {
  base: ROOT + 'kuromatsu_B02_P00_V02_W02_G00_FA_M01_POT02_main.jpg',
  lightPrune: ROOT + 'kuromatsu_B02_P01_V02_W02_G00_FA_M01_POT02_main.jpg',
  mediumPrune: ROOT + 'kuromatsu_B02_P02_V02_W02_G00_FA_M01_POT02_main.jpg',
  weakDry: ROOT + 'kuromatsu_B02_P01_V01_W01_G00_FA_M01_POT02_main.jpg',
  award: ROOT + 'kuromatsu_B03_P02_V03_W03_G00_FA_M02_POT05_award.jpg'
};
function resolve(state, derived, mode = 'current') {
  if (!state || state.sp !== 'pine') return null;
  if (mode === 'award') return FILES.award;
  if ((derived?.v ?? 100) < 60 || (derived?.w ?? 100) < 35) return FILES.weakDry;
  if (state.pot === 'old' && state.prune >= 2 && (derived?.v ?? 0) >= 82) return FILES.award;
  if (state.prune >= 2) return FILES.mediumPrune;
  if (state.prune >= 1) return FILES.lightPrune;
  return FILES.base;
}
window.BonsaiStateImages = { resolve, files: FILES };
})();
""",
        encoding="utf-8",
    )


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")
    if 'src="state-images.js"' not in text:
        if 'src="photo-assets.js"' in text:
            text = text.replace(
                '<script src="photo-assets.js"></script>',
                '<script src="state-images.js"></script><script src="photo-assets.js"></script>',
                1,
            )
        elif 'src="tree-renderer.js"' in text:
            text = text.replace(
                '<script src="tree-renderer.js"></script>',
                '<script src="state-images.js"></script><script src="tree-renderer.js"></script>',
                1,
            )
        else:
            text = text.replace(
                '<div id="root"></div><script>',
                '<div id="root"></div><script src="state-images.js"></script><script>',
                1,
            )

    pattern = r"function svg\(\)\{.*?\}function home\(\)\{"
    replacement = (
        "function svg(mode='current'){let statePhoto=window.BonsaiStateImages?.resolve(s,d(),mode);"
        "if(statePhoto){return `<figure class=\"photo-bonsai\"><img src=\"${statePhoto}\" "
        "alt=\"状態が反映された黒松盆栽\" draggable=\"false\"></figure>`}"
        "return window.BonsaiVisual.render(s,SP,POTS,season(),d())}function home(){"
    )
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError("failed to patch svg() in index.html")
    INDEX.write_text(text, encoding="utf-8")


def patch_service_worker() -> None:
    text = SW.read_text(encoding="utf-8")
    text = re.sub(r"const CACHE='[^']+'", "const CACHE='bonsai-state-images-v1-20260717'", text, count=1)
    assets = [
        "'./state-images.js'",
        "'./assets/kuromatsu_B02_P00_V02_W02_G00_FA_M01_POT02_main.jpg'",
        "'./assets/kuromatsu_B02_P01_V02_W02_G00_FA_M01_POT02_main.jpg'",
        "'./assets/kuromatsu_B02_P02_V02_W02_G00_FA_M01_POT02_main.jpg'",
        "'./assets/kuromatsu_B02_P01_V01_W01_G00_FA_M01_POT02_main.jpg'",
        "'./assets/kuromatsu_B03_P02_V03_W03_G00_FA_M02_POT05_award.jpg'",
    ]
    for asset in assets:
        if asset not in text:
            text = text.replace("];", f",{asset}];", 1)
    SW.write_text(text, encoding="utf-8")


def main() -> None:
    base = decode_base_photo()
    mask = green_mask(base)
    save_jpeg(ASSET_DIR / "kuromatsu_B02_P00_V02_W02_G00_FA_M01_POT02_main.jpg", base)
    save_jpeg(
        ASSET_DIR / "kuromatsu_B02_P01_V02_W02_G00_FA_M01_POT02_main.jpg",
        fine_thin(base, mask, 0.08, 11),
        94,
    )
    save_jpeg(
        ASSET_DIR / "kuromatsu_B02_P02_V02_W02_G00_FA_M01_POT02_main.jpg",
        fine_thin(base, mask, 0.17, 17),
        94,
    )
    save_jpeg(
        ASSET_DIR / "kuromatsu_B02_P01_V01_W01_G00_FA_M01_POT02_main.jpg",
        weak_dry(base, mask),
    )
    save_jpeg(
        ASSET_DIR / "kuromatsu_B03_P02_V03_W03_G00_FA_M02_POT05_award.jpg",
        award_finish(base, mask),
        94,
    )
    write_state_mapping()
    patch_index()
    patch_service_worker()


if __name__ == "__main__":
    main()
