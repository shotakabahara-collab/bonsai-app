#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import re
import shutil
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFile, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
RELEASE = "bonsai-stable-v2-20260718"
BASE = ROOT / "assets" / "kuromatsu" / "base"

ImageFile.LOAD_TRUNCATED_IMAGES = True


def source_from_embedded() -> Image.Image | None:
    path = ROOT / "photo-assets.js"
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8", errors="ignore")
    match = re.search(r"data:image/(?:jpeg|jpg|png|webp);base64,([^\"']+)", text)
    if not match:
        return None
    try:
        raw = base64.b64decode(match.group(1), validate=False)
        return Image.open(BytesIO(raw)).convert("RGB")
    except Exception:
        return None


def fallback_master() -> Image.Image:
    w, h = 1280, 1600
    image = Image.new("RGB", (w, h), (7, 16, 10))
    draw = ImageDraw.Draw(image)
    for radius, color in [(620, (31, 53, 38)), (470, (23, 42, 30)), (310, (15, 31, 21))]:
        draw.ellipse((w // 2 - radius, 160 - radius // 2, w // 2 + radius, 160 + radius * 1.4), fill=color)
    draw.line([(640, 1240), (590, 1020), (625, 790), (570, 560), (665, 330)], fill=(100, 61, 39), width=90)
    branches = [((610, 850), (315, 650)), ((620, 690), (910, 520)), ((610, 570), (390, 420)), ((650, 470), (790, 325))]
    for start, end in branches:
        draw.line([start, end], fill=(78, 47, 32), width=40)
    crowns = [(300, 630, 205, 112), (470, 480, 210, 118), (815, 500, 220, 120), (770, 330, 180, 105), (575, 275, 175, 105)]
    for x, y, rx, ry in crowns:
        draw.ellipse((x-rx, y-ry, x+rx, y+ry), fill=(32, 74, 45))
        for i in range(110):
            xx = x + ((i * 73) % (rx * 2) - rx)
            yy = y + ((i * 43) % (ry * 2) - ry)
            draw.line((xx, yy, xx + 20, yy - 5), fill=(55, 104, 64), width=2)
    draw.ellipse((405, 1225, 875, 1285), fill=(49, 77, 49))
    draw.rounded_rectangle((330, 1260, 950, 1400), radius=28, fill=(47, 42, 38))
    draw.polygon([(360, 1380), (920, 1380), (860, 1480), (420, 1480)], fill=(42, 36, 33))
    return image.filter(ImageFilter.GaussianBlur(0.4))


def cover_resize(source: Image.Image, size=(1280, 1600)) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / source.width, target_h / source.height)
    resized = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = max(0, round((resized.height - target_h) * 0.48))
    return resized.crop((left, top, left + target_w, top + target_h))


def pot_variant(master: Image.Image, color: tuple[int, int, int], strength: float) -> Image.Image:
    image = master.copy()
    pixels = image.load()
    y0 = int(image.height * .76)
    for y in range(y0, image.height):
        fade = max(0.0, min(1.0, (y - y0) / max(1, image.height - y0)))
        for x in range(image.width):
            r, g, b = pixels[x, y]
            if 16 < (r + g + b) / 3 < 175:
                alpha = strength * fade
                lum = (r + g + b) / 3 / 255
                target = tuple(min(255, int(c * (.55 + lum * .72))) for c in color)
                pixels[x, y] = tuple(int(v * (1-alpha) + t * alpha) for v, t in zip((r,g,b), target))
    return image


def ensure_photos() -> dict[str, str]:
    BASE.mkdir(parents=True, exist_ok=True)
    black = BASE / "black.webp"
    if black.exists() and black.stat().st_size > 100_000:
        with Image.open(black) as existing:
            master = cover_resize(existing.convert("RGB"))
    else:
        source = source_from_embedded() or fallback_master()
        master = cover_resize(source)
        master = ImageEnhance.Contrast(master).enhance(1.035)
        master = ImageEnhance.Color(master).enhance(.96)
        master.save(black, "WEBP", quality=89, method=6)
    palette = {
        "starter": ((150, 88, 55), .64),
        "blue": ((52, 104, 112), .62),
        "moon": ((184, 180, 168), .55),
        "old": ((116, 70, 43), .70),
    }
    for name, (color, strength) in palette.items():
        path = BASE / f"{name}.webp"
        if not path.exists() or path.stat().st_size < 80_000:
            pot_variant(master, color, strength).save(path, "WEBP", quality=88, method=6)
    manifest = {
        "version": RELEASE,
        "width": 1280,
        "height": 1600,
        "format": "webp",
        "sameTreeIdentity": True,
        "base": {name: f"assets/kuromatsu/base/{name}.webp" for name in ["starter","blue","black","moon","old"]},
        "stateRenderer": "bonsai-v2.js",
    }
    asset_root = BASE.parent
    asset_root.mkdir(parents=True, exist_ok=True)
    (asset_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest["base"]


def write_index() -> None:
    html = f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#07100a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="BONSAI">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<link rel="manifest" href="manifest.webmanifest?v={RELEASE}">
<link rel="apple-touch-icon" href="icon.svg?v={RELEASE}">
<link rel="stylesheet" href="bonsai-v2.css?v={RELEASE}">
<title>BONSAI</title>
</head>
<body>
<div id="root"><main class="boot" data-bonsai-static-shell><div class="boot__inner"><div class="boot__logo">BONSAI</div><p class="boot__copy">作品と保存データを読み込んでいます…</p><div class="boot__bar"></div><noscript><p>JavaScriptを有効にしてください。</p></noscript></div></main></div>
<script>
(function(){{'use strict';var shown=false;function fail(reason){{if(shown||document.querySelector('[data-app-ready="true"]'))return;shown=true;var root=document.getElementById('root');if(!root)return;root.innerHTML='<main class="boot"><div class="boot__inner"><div class="boot__logo">BONSAI</div><section class="card" style="margin-top:28px"><h3>起動を修復できます</h3><p>作品データは残したまま、古いアプリキャッシュだけを更新します。</p><a class="btn primary" href="./repair.html?v={RELEASE}">起動キャッシュを修復</a><p class="muted">'+String(reason||'startup-error').replace(/[&<>]/g,'').slice(0,120)+'</p></section></div></main>'}}window.__BONSAI_FAIL=fail;addEventListener('error',function(e){{fail(e&&e.message)}},true);addEventListener('unhandledrejection',function(e){{fail(e&&e.reason&&e.reason.message||e&&e.reason)}});setTimeout(function(){{if(!document.querySelector('[data-app-ready="true"]'))fail('startup-timeout')}},12000)}})();
</script>
<script src="bonsai-v2.js?v={RELEASE}"></script>
</body>
</html>
'''
    (ROOT / "index.html").write_text(html, encoding="utf-8")


def write_repair() -> None:
    html = f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07100a"><title>BONSAI 起動修復</title><style>*{{box-sizing:border-box}}html,body{{min-height:100%;margin:0;background:#07100a;color:#efe9da;font-family:-apple-system,BlinkMacSystemFont,sans-serif}}main{{min-height:100vh;min-height:100dvh;max-width:560px;margin:auto;padding:calc(env(safe-area-inset-top) + 44px) 22px 40px}}.logo{{font:30px Georgia,serif;letter-spacing:.23em}}.card{{margin-top:34px;padding:22px;border:1px solid #ffffff20;border-radius:22px;background:#152219}}p{{color:#a4b0a7;line-height:1.75}}button,a{{display:block;width:100%;border:0;border-radius:14px;padding:14px;background:#efe9da;color:#101611;text-decoration:none;text-align:center;font-weight:750;font-size:15px}}.secondary{{margin-top:9px;background:#ffffff0c;color:#efe9da;border:1px solid #ffffff20}}</style></head><body><main><div class="logo">BONSAI</div><section class="card"><h1>起動を修復します</h1><p>盆栽のセーブデータは削除しません。古いService Workerとアプリキャッシュだけを消去し、安定版を読み直します。</p><p id="status">セーブデータを確認しています…</p><button id="repair">起動キャッシュを修復</button><a class="secondary" href="./index.html?direct={RELEASE}">修復せず直接開く</a></section></main><script>(function(){{'use strict';var key='bonsai_live_1',raw='';try{{raw=localStorage.getItem(key)||''}}catch(e){{}}var status=document.getElementById('status');status.textContent=raw?'セーブデータを検出しました（'+raw.length+'文字）。修復後も保持します。':'セーブデータはまだありません。';document.getElementById('repair').onclick=async function(){{this.disabled=true;this.textContent='修復しています…';try{{if('serviceWorker'in navigator){{var regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(function(r){{return r.unregister()}}))}}if('caches'in window){{var names=await caches.keys();await Promise.all(names.map(function(n){{return caches.delete(n)}}))}}}}catch(e){{}}try{{localStorage.setItem('__bonsai_release','{RELEASE}')}}catch(e){{}}location.replace('./index.html?recovered={RELEASE}&t='+Date.now())}}}})();</script></body></html>'''
    (ROOT / "repair.html").write_text(html, encoding="utf-8")


def write_manifest() -> None:
    manifest = {
        "id": "./",
        "name": "BONSAI — 育てた時間が、作品になる。",
        "short_name": "BONSAI",
        "description": "部位別剪定、針金、病害虫、神舎利、大会、銘木録を備えた盆栽作品育成ゲーム",
        "start_url": f"./index.html?release={RELEASE}",
        "scope": "./",
        "display": "standalone",
        "orientation": "portrait-primary",
        "background_color": "#07100a",
        "theme_color": "#07100a",
        "icons": [{"src":"icon.svg","sizes":"any","type":"image/svg+xml","purpose":"any maskable"}],
        "categories": ["games","lifestyle"],
        "lang": "ja",
    }
    (ROOT / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_worker() -> None:
    assets = [
        "./index.html","./repair.html","./manifest.webmanifest","./icon.svg","./bonsai-v2.css","./bonsai-v2.js",
        "./assets/kuromatsu/manifest.json","./assets/kuromatsu/base/starter.webp","./assets/kuromatsu/base/blue.webp",
        "./assets/kuromatsu/base/black.webp","./assets/kuromatsu/base/moon.webp","./assets/kuromatsu/base/old.webp",
    ]
    payload = json.dumps(assets, ensure_ascii=False, separators=(",", ":"))
    worker = f'''const CACHE='bonsai-stable-v2-20260718';
const ASSETS={payload};
self.addEventListener('message',event=>{{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting()}});
self.addEventListener('install',event=>event.waitUntil((async()=>{{const cache=await caches.open(CACHE);await Promise.allSettled(ASSETS.map(async path=>{{const response=await fetch(new Request(path,{{cache:'reload'}}));if(response.ok)await cache.put(path,response.clone())}}));await self.skipWaiting()}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{{const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim()}})()));
async function networkFirst(request){{const cache=await caches.open(CACHE);try{{const response=await Promise.race([fetch(request,{{cache:'no-store'}}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),5000))]);if(response&&response.ok)await cache.put('./index.html',response.clone());return response}}catch(error){{return await cache.match('./index.html')||await caches.match('./index.html')||new Response('<!doctype html><html style="background:#07100a"><meta name="viewport" content="width=device-width"><body style="margin:0;min-height:100vh;background:#07100a;color:#efe9da;display:grid;place-content:center;font-family:sans-serif;text-align:center"><h1>BONSAI</h1><p>通信回復後にもう一度開いてください。</p></body></html>',{{headers:{{'Content-Type':'text/html; charset=utf-8'}}}})}}}}
self.addEventListener('fetch',event=>{{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){{event.respondWith(networkFirst(event.request));return}}event.respondWith((async()=>{{const cached=await caches.match(event.request,{{ignoreSearch:true}});const network=fetch(event.request).then(async response=>{{if(response.ok){{const cache=await caches.open(CACHE);await cache.put(event.request,response.clone())}}return response}}).catch(()=>null);return cached||await network||new Response('',{{status:504}})}})())}});
'''
    (ROOT / "sw.js").write_text(worker, encoding="utf-8")


def main() -> None:
    if not (ROOT / "bonsai-v2.js").exists() or not (ROOT / "bonsai-v2.css").exists():
        raise SystemExit("stable v2 source files are missing")
    photos = ensure_photos()
    write_index()
    write_repair()
    write_manifest()
    write_worker()
    release = {
        "release": RELEASE,
        "entry": "index.html",
        "repair": "repair.html",
        "saveKey": "bonsai_live_1",
        "features": ["part-pruning","part-wiring","disease","pest","jin","shari","weekly-show","async-rivals","three-tree-garden","memorial-images","photoreal-pine"],
        "photos": photos,
    }
    (ROOT / "release.json").write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(release, ensure_ascii=False))


if __name__ == "__main__":
    main()
