#!/usr/bin/env python3
from __future__ import annotations

import base64
import re
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageFile

ROOT = Path(__file__).resolve().parents[1]
PHOTO_ASSETS = ROOT / "photo-assets.js"

ImageFile.LOAD_TRUNCATED_IMAGES = True


def main() -> None:
    text = PHOTO_ASSETS.read_text(encoding="utf-8")
    match = re.search(r'pine:"data:image/(?:jpeg|jpg|png);base64,([^"]+)"', text)
    if not match:
        raise RuntimeError("pine base image not found")

    raw = base64.b64decode(match.group(1))
    with Image.open(BytesIO(raw)) as source:
        image = source.convert("RGB")
        output = BytesIO()
        image.save(output, format="JPEG", quality=93, optimize=True, progressive=True)

    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    replacement = f'pine:"data:image/jpeg;base64,{encoded}"'
    normalized = text[: match.start()] + replacement + text[match.end() :]
    PHOTO_ASSETS.write_text(normalized, encoding="utf-8")
    print(f"normalized pine image: {image.width}x{image.height}, {len(output.getvalue())} bytes")


if __name__ == "__main__":
    main()
