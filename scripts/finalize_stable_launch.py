#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "stable-launch-v1-20260718"


def build_app() -> None:
    playable = ROOT / "app.html" if (ROOT / "app.html").exists() else ROOT / "index.html"
    html = playable.read_text(encoding="utf-8")

    old_state = "let s;try{s={...base(),...JSON.parse(localStorage.getItem(KEY)||'null')}}catch{s=base()}"
    normalized = """const normalizeSavedState=raw=>{const b=base(),x=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},speciesAlias={kuromatsu:'pine','黒松':'pine',yamamomiji:'maple','山もみじ':'maple',satsuki:'azalea','皐月':'azalea'},potAlias={pot01:'starter',pot02:'black',pot03:'blue',pot04:'moon',pot05:'old'},n={...b,...x};n.sp=speciesAlias[n.sp]||n.sp;if(!SP[n.sp])n.sp='pine';n.pot=potAlias[n.pot]||n.pot;if(!POTS.some(p=>p[0]===n.pot))n.pot='starter';const mentor=Number(n.mentor);n.mentor=Number.isFinite(mentor)&&PEOPLE[Math.trunc(mentor)]?Math.trunc(mentor):0;n.stats={...b.stats,...(x.stats&&typeof x.stats==='object'&&!Array.isArray(x.stats)?x.stats:{})};n.owned=(Array.isArray(x.owned)?x.owned:['starter']).map(id=>potAlias[id]||id).filter(id=>POTS.some(p=>p[0]===id));if(!n.owned.includes('starter'))n.owned.unshift('starter');if(!n.owned.includes(n.pot))n.owned.push(n.pot);n.awards=Array.isArray(x.awards)?x.awards:[];n.log=(Array.isArray(x.log)?x.log:[]).map(item=>typeof item==='string'?{at:Date.now(),x:item}:item).filter(item=>item&&typeof item==='object');for(const key of ['born','water','last','vit','stress','prune','wire','fert','money','rep']){const value=Number(n[key]);n[key]=Number.isFinite(value)?value:b[key]}n.started=n.started===true;n.name=String(n.name||b.name);n.tree=String(n.tree||'');n.lastWeek=typeof n.lastWeek==='string'?n.lastWeek:'';if(x.advanced&&typeof x.advanced==='object')n.advanced=x.advanced;return n};let s;try{s=normalizeSavedState(JSON.parse(localStorage.getItem(KEY)||'null'));localStorage.setItem(KEY,JSON.stringify(s))}catch(error){try{localStorage.setItem(KEY+'_corrupt_backup',localStorage.getItem(KEY)||'')}catch{}s=base();localStorage.setItem(KEY,JSON.stringify(s))}"""
    if "normalizeSavedState=raw=>" not in html:
        if old_state not in html:
            raise RuntimeError("playable state initializer was not found")
        html = html.replace(old_state, normalized, 1)

    title_meta = '<meta name="apple-mobile-web-app-title" content="BONSAI">'
    status_meta = '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
    if status_meta not in html and title_meta in html:
        html = html.replace(title_meta, title_meta + status_meta, 1)

    release_meta = f'<meta name="bonsai-release" content="{VERSION}">'
    if release_meta not in html:
        html = html.replace("<title>BONSAI</title>", "<title>BONSAI</title>" + release_meta, 1)

    html = html.replace("./recovery-v4.html", f"./repair.html?release={VERSION}")
    html = html.replace("recovery-v4.html", f"repair.html?release={VERSION}")

    worker = f"""<script id="bonsai-stable-worker">(()=>{{'use strict';const VERSION='{VERSION}';if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v='+VERSION,{{scope:'./',updateViaCache:'none'}}).then(registration=>registration.update()).catch(error=>console.warn('[BONSAI worker]',error)),{{once:true}});window.BonsaiRelease=VERSION;}})();</script>"""
    if 'id="bonsai-stable-worker"' not in html:
        html = html.replace("</body>", worker + "</body>", 1)

    # index.html is directly playable: no redirect, iframe, or intermediate launcher.
    for name in ("index.html", "app.html", "offline-app.html"):
        (ROOT / name).write_text(html, encoding="utf-8")


def build_repair() -> None:
    repair = f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#09100c"><meta name="apple-mobile-web-app-capable" content="yes"><title>BONSAI 起動修復</title><style>*{{box-sizing:border-box}}html,body{{min-height:100%;margin:0;background:#09100c;color:#eee8da;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif}}main{{max-width:560px;min-height:100vh;min-height:100dvh;margin:auto;padding:calc(env(safe-area-inset-top) + 38px) 22px 40px;display:grid;align-content:center;gap:14px}}.logo{{font:30px Georgia,serif;letter-spacing:.22em}}.card{{padding:22px;border:1px solid #ffffff20;border-radius:22px;background:#152119}}h1{{font:24px Georgia,serif;margin:0 0 12px}}p{{color:#aeb9b0;font-size:13px;line-height:1.8}}button,a{{appearance:none;width:100%;display:block;border:0;border-radius:14px;padding:14px;background:#eee8da;color:#101611;text-decoration:none;text-align:center;font-weight:700;font-size:15px}}.secondary{{margin-top:10px;background:#ffffff0e;color:#eee8da;border:1px solid #ffffff20}}</style></head><body><main><div class="logo">BONSAI</div><section class="card"><h1>起動を修復します</h1><p id="status">盆栽のセーブデータは残したまま、古いアプリキャッシュとService Workerだけを削除します。</p><button id="repair" type="button">起動キャッシュを修復</button><a class="secondary" href="./index.html?release={VERSION}&direct=1">修復せず開く</a></section></main><script>(function(){{'use strict';var button=document.getElementById('repair'),status=document.getElementById('status');button.addEventListener('click',async function(){{button.disabled=true;button.textContent='修復しています…';try{{if('serviceWorker'in navigator){{var registrations=await navigator.serviceWorker.getRegistrations();await Promise.all(registrations.map(function(registration){{return registration.unregister()}}))}}if('caches'in window){{var names=await caches.keys();await Promise.all(names.map(function(name){{return caches.delete(name)}}))}}}}catch(error){{console.warn(error)}}status.textContent='修復が完了しました。BONSAIを開きます。';location.replace('./index.html?release={VERSION}&repaired=1&t='+Date.now())}})}})();</script></body></html>'''
    for name in ("repair.html", "recovery-v4.html"):
        (ROOT / name).write_text(repair, encoding="utf-8")


def build_manifest() -> None:
    path = ROOT / "manifest.webmanifest"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest.update(
        {
            "id": "./stable-launch-v1",
            "start_url": f"./index.html?release={VERSION}",
            "scope": "./",
            "display": "standalone",
            "background_color": "#09100c",
            "theme_color": "#09100c",
        }
    )
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_service_worker() -> None:
    assets = [
        "./manifest.webmanifest",
        "./icon.svg",
        "./tree-renderer.js",
        "./photo-assets.js",
        "./advanced-care.js",
        "./advanced-care-bridge.js",
        "./completion-core.js",
        "./judging-engine.js",
        "./state-image-runtime.js",
        "./repair.html",
        "./offline-app.html",
    ]
    optional = [
        "./assets/kuromatsu/manifest.json",
        "./assets/kuromatsu/base/black.webp",
        "./assets/kuromatsu/base/starter.webp",
        "./assets/kuromatsu/base/blue.webp",
        "./assets/kuromatsu/base/moon.webp",
        "./assets/kuromatsu/base/old.webp",
    ]
    for item in optional:
        if (ROOT / item[2:]).exists():
            assets.append(item)
    payload = json.dumps(assets, ensure_ascii=False, separators=(",", ":"))
    worker = f"""const VERSION='{VERSION}';
const CACHE='bonsai-'+VERSION;
const ASSETS={payload};
self.addEventListener('install',event=>event.waitUntil((async()=>{{const cache=await caches.open(CACHE);for(const url of ASSETS){{try{{const response=await fetch(new Request(url,{{cache:'reload'}}));if(response.ok)await cache.put(url,response.clone())}}catch(error){{}}}}await self.skipWaiting()}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{{const names=await caches.keys();await Promise.all(names.filter(name=>name!==CACHE).map(name=>caches.delete(name)));await self.clients.claim()}})()));
self.addEventListener('fetch',event=>{{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){{event.respondWith(fetch(event.request,{{cache:'no-store'}}).catch(()=>caches.match('./offline-app.html',{{ignoreSearch:true}})));return}}event.respondWith(caches.match(event.request,{{ignoreSearch:true}}).then(cached=>{{const network=fetch(event.request).then(response=>{{if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));return response}}).catch(()=>cached);return cached||network}}))}});
"""
    (ROOT / "sw.js").write_text(worker, encoding="utf-8")


def build_release_metadata() -> None:
    release = {
        "version": VERSION,
        "architecture": "single-document",
        "navigation": "network-first",
        "saveData": "preserved-and-normalized",
        "repair": "repair.html",
    }
    (ROOT / "release.json").write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_pages_workflow() -> None:
    pages = """name: Test and Deploy BONSAI stable

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Validate stable app
        run: |
          node --check sw.js
          for file in photo-assets.js tree-renderer.js advanced-care.js advanced-care-bridge.js completion-core.js judging-engine.js state-image-runtime.js; do node --check "$file"; done
          grep -Fq 'stable-launch-v1-20260718' index.html
          grep -Fq 'normalizeSavedState' index.html
          grep -Fq '起動キャッシュを修復' repair.html
          grep -Fq 'network-first' release.json
  deploy:
    needs: verify
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
"""
    (ROOT / ".github/workflows/pages.yml").write_text(pages, encoding="utf-8")


def main() -> None:
    build_app()
    build_repair()
    build_manifest()
    build_service_worker()
    build_release_metadata()
    build_pages_workflow()
    print(f"BONSAI stable package prepared: {VERSION}")


if __name__ == "__main__":
    main()
