#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import io
import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PHOTO_ASSETS = ROOT / "photo-assets.js"
ASSET_ROOT = ROOT / "assets" / "kuromatsu"
BASE_ROOT = ASSET_ROOT / "base"
QA_ROOT = ASSET_ROOT / "qa"
MODEL = ROOT / ".cache" / "EDSR_x4.pb"

POTS = {
    "black": ((42, 39, 36), 0.28, 0.93, 1.08),
    "starter": ((151, 91, 58), 0.78, 1.08, 1.03),
    "blue": ((55, 103, 111), 0.62, 1.03, 1.05),
    "moon": ((185, 181, 168), 0.34, 1.30, 0.94),
    "old": ((117, 72, 45), 0.70, 1.00, 1.12),
}


def read_embedded_photo() -> Image.Image | None:
    text = PHOTO_ASSETS.read_text(encoding="utf-8")
    match = re.search(
        r'pine:\s*["\']data:image/(?:jpeg|jpg|png|webp);base64,([^"\']+)["\']',
        text,
    )
    if not match:
        return None
    raw = base64.b64decode(match.group(1))
    return Image.open(io.BytesIO(raw)).convert("RGB")


def upscale(source: Image.Image) -> tuple[Image.Image, str]:
    target = (source.width * 4, source.height * 4)
    method = "Lanczos x4"
    try:
        import cv2

        if MODEL.exists() and hasattr(cv2, "dnn_superres"):
            sr = cv2.dnn_superres.DnnSuperResImpl_create()
            sr.readModel(str(MODEL))
            sr.setModel("edsr", 4)
            bgr = cv2.cvtColor(np.asarray(source), cv2.COLOR_RGB2BGR)
            result = sr.upsample(bgr)
            image = Image.fromarray(cv2.cvtColor(result, cv2.COLOR_BGR2RGB))
            method = "EDSR x4"
        else:
            image = source.resize(target, Image.Resampling.LANCZOS)
    except Exception as error:
        print(f"EDSR fallback: {error}")
        image = source.resize(target, Image.Resampling.LANCZOS)

    image = ImageEnhance.Contrast(image).enhance(1.035)
    image = ImageEnhance.Color(image).enhance(0.98)
    sharpened = image.filter(ImageFilter.UnsharpMask(radius=1.25, percent=78, threshold=4))
    return Image.blend(image, sharpened, 0.42), method


def pot_mask(width: int, height: int) -> np.ndarray:
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(
        [
            (int(width * 0.08), int(height * 0.80)),
            (int(width * 0.92), int(height * 0.80)),
            (int(width * 0.93), int(height * 0.90)),
            (int(width * 0.86), int(height * 0.96)),
            (int(width * 0.14), int(height * 0.96)),
            (int(width * 0.07), int(height * 0.90)),
        ],
        fill=255,
    )
    return np.asarray(mask.filter(ImageFilter.GaussianBlur(max(3, width * 0.006))), dtype=np.float32) / 255


def recolor_pot(source: Image.Image, color: tuple[int, int, int], saturation: float, lift: float, contrast: float) -> Image.Image:
    pixels = np.asarray(source).astype(np.float32)
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
    mask = pot_mask(source.width, source.height)
    gray = pixels.mean(axis=2)
    mask *= np.clip((gray - 8) / 34, 0, 1)
    target = np.array(color, dtype=np.float32)[None, None, :]
    light = np.clip((luminance - 0.34) * contrast + 0.34, 0, 1)
    ceramic = target * (0.42 + 0.86 * light[:, :, None]) * lift
    ceramic = ceramic * saturation + pixels * (1 - saturation)
    output = pixels * (1 - mask[:, :, None]) + ceramic * mask[:, :, None]
    return Image.fromarray(np.clip(output, 0, 255).astype(np.uint8))


def write_photo_assets(width: int, height: int, sha256: str, method: str) -> None:
    content = f"""(() => {{
  'use strict';
  const POT_IMAGES = Object.freeze({{
    starter: './assets/kuromatsu/base/starter.webp',
    blue: './assets/kuromatsu/base/blue.webp',
    black: './assets/kuromatsu/base/black.webp',
    moon: './assets/kuromatsu/base/moon.webp',
    old: './assets/kuromatsu/base/old.webp'
  }});
  const currentPot = () => {{
    try {{
      const state = JSON.parse(localStorage.getItem('bonsai_live_1') || '{{}}');
      return POT_IMAGES[state?.pot] ? state.pot : 'black';
    }} catch {{ return 'black'; }}
  }};
  const photos = window.BonsaiPhotos || {{}};
  Object.defineProperty(photos, 'pine', {{
    configurable: true,
    enumerable: true,
    get: () => POT_IMAGES[currentPot()]
  }});
  photos.pineForPot = pot => POT_IMAGES[pot] || POT_IMAGES.black;
  photos.pineManifest = './assets/kuromatsu/manifest.json';
  photos.pineMeta = Object.freeze({{
    version: 'kuromatsu-photoreal-v3', width: {width}, height: {height},
    format: 'webp', sourceSha256: '{sha256}', method: '{method}',
    photorealistic: true, sameTreeIdentity: true
  }});
  window.BonsaiPhotos = photos;
}})();
"""
    PHOTO_ASSETS.write_text(content, encoding="utf-8")


def write_service_worker() -> None:
    app_assets = [
        "./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./tree-renderer.js",
        "./photo-assets.js", "./advanced-care.js", "./advanced-care-bridge.js",
        "./completion-core.js", "./judging-engine.js", "./state-image-runtime.js",
        "./assets/kuromatsu/manifest.json",
    ]
    app_assets += [f"./assets/kuromatsu/base/{name}.webp" for name in POTS]
    payload = json.dumps(app_assets, ensure_ascii=False, separators=(",", ":"))
    content = f"""const CACHE='bonsai-photo-v6-kuromatsu-photoreal-v3';
const ASSETS={payload};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==location.origin)return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{{if(response.ok){{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}}return response;}}).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):hit)));}});
"""
    (ROOT / "sw.js").write_text(content, encoding="utf-8")


def write_contact_sheet(images: dict[str, Image.Image]) -> None:
    panels = []
    for name, image in images.items():
        panel = image.copy()
        panel.thumbnail((300, 470), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (320, 515), (7, 14, 10))
        canvas.paste(panel, ((320 - panel.width) // 2, 8))
        ImageDraw.Draw(canvas).text((12, 486), name, fill=(235, 226, 205))
        panels.append(canvas)
    sheet = Image.new("RGB", (320 * len(panels), 515), (4, 8, 6))
    for index, panel in enumerate(panels):
        sheet.paste(panel, (index * 320, 0))
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    sheet.save(QA_ROOT / "pot-variants.webp", "WEBP", quality=84, method=5)


def main() -> None:
    BASE_ROOT.mkdir(parents=True, exist_ok=True)
    existing = BASE_ROOT / "black.webp"
    source = read_embedded_photo()
    if source is None:
        if existing.exists():
            print("Photoreal assets already generated; no embedded source remains.")
            return
        raise RuntimeError("Embedded pine photograph was not found")

    master, method = upscale(source)
    source_sha = hashlib.sha256(master.tobytes()).hexdigest()
    images: dict[str, Image.Image] = {}
    for name, (color, saturation, lift, contrast) in POTS.items():
        variant = master if name == "black" else recolor_pot(master, color, saturation, lift, contrast)
        path = BASE_ROOT / f"{name}.webp"
        variant.save(path, "WEBP", quality=88, method=5)
        images[name] = variant

    manifest = {
        "version": "kuromatsu-photoreal-v3",
        "width": master.width,
        "height": master.height,
        "format": "webp",
        "sourceWidth": source.width,
        "sourceHeight": source.height,
        "sourceSha256": source_sha,
        "upscaleMethod": method,
        "base": {name: f"assets/kuromatsu/base/{name}.webp" for name in POTS},
        "stateRenderer": "state-image-runtime.js",
        "sameTreeIdentity": True,
    }
    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    (ASSET_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_contact_sheet(images)
    write_photo_assets(master.width, master.height, source_sha, method)
    write_service_worker()

    status = f"""# 黒松フォトリアル・ビジュアルコア v3

- 元画像: {source.width}×{source.height}
- 正式マスター: {master.width}×{master.height}
- 超解像方式: {method}
- 同一個体・同一構図: 維持
- 実写鉢差分: 素焼き／青釉／黒土／白釉／古鉢
- 部位状態: 既存の剪定・針金・病害虫・神・舎利ランタイムへ接続
- SHA-256: `{source_sha}`

mainへの切替は、生成ブランチの画像検査と公開後GitHub Pages監査がPASSした後に限定する。
"""
    (ROOT / "PHOTOREAL_KUROMATSU_V3.md").write_text(status, encoding="utf-8")
    print(f"Generated {len(images)} variants at {master.size} using {method}")


if __name__ == "__main__":
    main()
