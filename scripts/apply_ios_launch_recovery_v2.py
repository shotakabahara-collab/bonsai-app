#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
APP = ROOT / "app.html"
MANIFEST = ROOT / "manifest.webmanifest"
SW = ROOT / "sw.js"
RECOVERY = ROOT / "recovery-v2.html"

VERSION = "ios-launch-wrapper-v2"


def patch_app() -> None:
    current = INDEX.read_text(encoding="utf-8")
    if APP.exists():
        html = APP.read_text(encoding="utf-8")
    elif "const KEY='bonsai_live_1'" in current:
        html = current
    else:
        raise RuntimeError("The playable application shell was not found")

    old_state = "let s;try{s={...base(),...JSON.parse(localStorage.getItem(KEY)||'null')}}catch{s=base()}"
    new_state = (
        "const normalizeSavedState=raw=>{const b=base(),x=raw&&typeof raw==='object'?raw:{},"
        "speciesAlias={kuromatsu:'pine','黒松':'pine',yamamomiji:'maple','山もみじ':'maple',"
        "satsuki:'azalea','皐月':'azalea'},potAlias={pot01:'starter',pot02:'black',pot03:'blue',"
        "pot04:'moon',pot05:'old'},n={...b,...x};n.sp=speciesAlias[n.sp]||n.sp;if(!SP[n.sp])n.sp='pine';"
        "n.pot=potAlias[n.pot]||n.pot;if(!POTS.some(p=>p[0]===n.pot))n.pot='starter';"
        "const mentor=Number(n.mentor);n.mentor=Number.isFinite(mentor)&&PEOPLE[Math.trunc(mentor)]?Math.trunc(mentor):0;"
        "n.stats={...b.stats,...(x.stats&&typeof x.stats==='object'?x.stats:{})};"
        "n.owned=(Array.isArray(x.owned)?x.owned:['starter']).map(id=>potAlias[id]||id).filter(id=>POTS.some(p=>p[0]===id));"
        "if(!n.owned.includes('starter'))n.owned.unshift('starter');if(!n.owned.includes(n.pot))n.owned.push(n.pot);"
        "n.awards=Array.isArray(x.awards)?x.awards:[];n.log=(Array.isArray(x.log)?x.log:[]).map(item=>"
        "typeof item==='string'?{at:Date.now(),x:item}:item).filter(item=>item&&typeof item==='object');"
        "for(const key of ['born','water','last','vit','stress','prune','wire','fert','money','rep']){"
        "const value=Number(n[key]);n[key]=Number.isFinite(value)?value:b[key]}n.started=Boolean(n.started);"
        "n.name=String(n.name||b.name);n.tree=String(n.tree||'');n.lastWeek=String(n.lastWeek||'');return n};"
        "let s;try{s=normalizeSavedState(JSON.parse(localStorage.getItem(KEY)||'null'));"
        "localStorage.setItem(KEY,JSON.stringify(s))}catch{s=base();localStorage.setItem(KEY,JSON.stringify(s))}"
    )
    if "normalizeSavedState=raw=>" not in html:
        if old_state not in html:
            raise RuntimeError("Legacy state initializer is missing")
        html = html.replace(old_state, new_state, 1)

    boot_style = (
        '<style id="bonsai-ios-boot-v2">html,body,#root{min-height:100%;background:#09100c!important}'
        'body{min-height:100vh;min-height:100dvh}.bonsai-safe-boot{min-height:100vh;min-height:100dvh;'
        'display:grid;place-content:center;gap:13px;padding:32px;text-align:center;background:#09100c;color:#eee8da;'
        'font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif}.bonsai-safe-boot strong{'
        'font:32px Georgia,serif;letter-spacing:.24em}.bonsai-safe-boot p{margin:0;color:#9daa9f;font-size:13px;'
        'line-height:1.7}.bonsai-safe-boot a{display:block;border-radius:14px;padding:13px 18px;background:#eee8da;'
        'color:#101611;text-decoration:none;font-weight:700}</style>'
    )
    if 'id="bonsai-ios-boot-v2"' not in html:
        html = html.replace("</head>", boot_style + "</head>", 1)

    if 'id="bonsai-safe-boot"' not in html:
        marker = '<body><div id="root"></div>'
        replacement = (
            '<body><div id="root"><main id="bonsai-safe-boot" class="bonsai-safe-boot">'
            '<strong>BONSAI</strong><p>作品と保存データを読み込んでいます…</p></main></div>'
        )
        if marker not in html:
            raise RuntimeError("Root marker is missing")
        html = html.replace(marker, replacement, 1)

    guard = '''<script id="bonsai-ios-guard-v2">(function(){'use strict';function clean(value){return String(value||'起動エラー').replace(/[&<>]/g,'').slice(0,160)}function show(reason){var root=document.getElementById('root');if(!root||root.querySelector('.app,.onboard'))return;root.innerHTML='<main class="bonsai-safe-boot" role="alert"><strong>BONSAI</strong><p>起動用キャッシュを修復できます。<br>セーブデータは削除しません。</p><a href="./recovery-v2.html">起動を修復する</a><p style="font-size:9px">'+clean(reason)+'</p></main>'}window.__BonsaiLaunchFailure=show;window.addEventListener('error',function(event){show(event&&event.message)},true);window.addEventListener('unhandledrejection',function(event){show(event&&event.reason&&event.reason.message||event&&event.reason)},true);setTimeout(function(){var root=document.getElementById('root');if(root&&root.querySelector('#bonsai-safe-boot')&&!root.querySelector('.app,.onboard'))show('startup-timeout')},9000)})();</script>'''
    if 'id="bonsai-ios-guard-v2"' not in html:
        anchor = '<script src="photo-assets.js"></script>'
        if anchor not in html:
            raise RuntimeError("Photo asset marker is missing")
        html = html.replace(anchor, guard + anchor, 1)

    APP.write_text(html, encoding="utf-8")


def write_wrapper() -> None:
    wrapper = f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#09100c"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="BONSAI"><link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon.svg"><title>BONSAI</title><style>html,body{{min-height:100%;margin:0;background:#09100c;color:#eee8da;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif}}main{{min-height:100vh;min-height:100dvh;display:grid;place-content:center;gap:13px;padding:32px;text-align:center}}strong{{font:32px Georgia,serif;letter-spacing:.24em}}p{{margin:0;color:#9daa9f;font-size:13px;line-height:1.7}}a{{display:block;border-radius:14px;padding:13px 18px;background:#eee8da;color:#101611;text-decoration:none;font-weight:700}}</style></head><body><main><strong>BONSAI</strong><p id="status">作品を起動しています…</p><a id="repair" href="./recovery-v2.html" hidden>起動を修復する</a></main><script>(function(){{'use strict';var VERSION='{VERSION}';var status=document.getElementById('status');var repair=document.getElementById('repair');function fallback(error){{status.textContent='起動用キャッシュの修復が必要です。';repair.hidden=false;if(error)repair.dataset.error=String(error).slice(0,120)}}async function clearRuntime(){{try{{if('serviceWorker'in navigator){{var regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(function(reg){{return reg.unregister()}}))}}}}catch(error){{}}try{{if('caches'in window){{var keys=await caches.keys();await Promise.all(keys.map(function(key){{return caches.delete(key)}}))}}}}catch(error){{}}}}async function launch(){{var params=new URL(location.href).searchParams;var seen=localStorage.getItem('__bonsai_launch_version');if(params.get('repair')==='1'||seen!==VERSION){{await clearRuntime();localStorage.setItem('__bonsai_launch_version',VERSION)}}location.replace('./app.html?v='+VERSION+'&t='+Date.now())}}setTimeout(function(){{fallback('launch-timeout')}},10000);launch().catch(fallback)}})();</script></body></html>'''
    INDEX.write_text(wrapper, encoding="utf-8")


def write_recovery() -> None:
    recovery = f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#09100c"><title>BONSAI 起動修復</title><style>html,body{{min-height:100%;margin:0;background:#09100c;color:#eee8da;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif}}main{{max-width:540px;min-height:100vh;min-height:100dvh;margin:auto;display:grid;align-content:center;gap:13px;padding:28px}}h1{{font:32px Georgia,serif;letter-spacing:.18em;margin:0}}p{{color:#9daa9f;line-height:1.75;margin:0}}.box{{padding:14px;border:1px solid #ffffff20;border-radius:15px;background:#152119}}button,a{{appearance:none;border:0;border-radius:14px;padding:14px 17px;background:#eee8da;color:#101611;text-decoration:none;font-weight:700;text-align:center;font-size:15px}}.secondary{{background:#ffffff10;color:#eee8da;border:1px solid #ffffff20}}textarea{{width:100%;height:90px;background:#08100b;color:#9daa9f;border:1px solid #ffffff20;border-radius:12px;padding:10px}}</style></head><body><main><h1>BONSAI</h1><p>古いPWAキャッシュとService Workerだけを削除します。<br><b>盆栽のセーブデータは削除しません。</b></p><div class="box" id="save-status">セーブデータを確認しています…</div><button id="repair" type="button">起動キャッシュを修復</button><button id="backup" class="secondary" type="button">セーブデータをコピー</button><textarea id="backup-text" readonly hidden></textarea><a class="secondary" href="./app.html?v={VERSION}">修復せず直接開く</a></main><script>(function(){{'use strict';var KEY='bonsai_live_1';var raw=localStorage.getItem(KEY)||'';var status=document.getElementById('save-status');status.textContent=raw?'セーブデータを検出しました（'+raw.length+'文字）。修復後も保持します。':'セーブデータはまだありません。';document.getElementById('backup').addEventListener('click',async function(){{var area=document.getElementById('backup-text');area.hidden=false;area.value=raw||'セーブデータなし';area.select();try{{await navigator.clipboard.writeText(area.value);status.textContent='セーブデータをコピーしました。'}}catch(error){{status.textContent='下の文字列を長押ししてコピーしてください。'}}}});document.getElementById('repair').addEventListener('click',async function(){{this.disabled=true;this.textContent='修復しています…';try{{if('serviceWorker'in navigator){{var regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(function(reg){{return reg.unregister()}}))}}}}catch(error){{}}try{{if('caches'in window){{var keys=await caches.keys();await Promise.all(keys.map(function(key){{return caches.delete(key)}}))}}}}catch(error){{}}localStorage.setItem('__bonsai_launch_version','{VERSION}');location.replace('./app.html?v={VERSION}&recovered=1&t='+Date.now())}})}})();</script></body></html>'''
    RECOVERY.write_text(recovery, encoding="utf-8")


def update_manifest() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    manifest.update(
        {
            "id": "./",
            "start_url": f"./index.html?v={VERSION}",
            "scope": "./",
            "display": "standalone",
            "background_color": "#09100c",
            "theme_color": "#09100c",
        }
    )
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_service_worker() -> None:
    core = [
        "./index.html",
        "./app.html",
        "./recovery-v2.html",
        "./manifest.webmanifest",
        "./icon.svg",
        "./tree-renderer.js",
        "./photo-assets.js",
        "./advanced-care.js",
        "./advanced-care-bridge.js",
        "./completion-core.js",
        "./judging-engine.js",
        "./state-image-runtime.js",
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
            core.append(item)
    payload = json.dumps(core, ensure_ascii=False, separators=(",", ":"))
    worker = f'''const CACHE='bonsai-{VERSION}-20260718';
const CORE={payload};
self.addEventListener('message',event=>{{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting()}});
self.addEventListener('install',event=>event.waitUntil((async()=>{{const cache=await caches.open(CACHE);await Promise.allSettled(CORE.map(async path=>{{const response=await fetch(new Request(path,{{cache:'reload'}}));if(response.ok)await cache.put(path,response.clone())}}));await self.skipWaiting()}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{{const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim()}})()));
async function navigation(request){{const cache=await caches.open(CACHE);try{{const response=await fetch(request,{{cache:'no-store'}});if(response.ok){{const pathname=new URL(request.url).pathname;if(pathname.endsWith('/app.html'))await cache.put('./app.html',response.clone());return response}}}}catch(error){{}}return await cache.match('./app.html',{{ignoreSearch:true}})||await cache.match('./index.html',{{ignoreSearch:true}})||await cache.match('./recovery-v2.html',{{ignoreSearch:true}})||new Response('<!doctype html><body style="margin:0;background:#09100c;color:#eee8da;display:grid;min-height:100vh;place-content:center;font-family:sans-serif"><h1>BONSAI</h1><a href="./recovery-v2.html" style="color:white">起動を修復</a></body>',{{headers:{{'Content-Type':'text/html; charset=utf-8'}}}})}}
self.addEventListener('fetch',event=>{{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){{event.respondWith(navigation(event.request));return}}event.respondWith((async()=>{{const cached=await caches.match(event.request,{{ignoreSearch:true}});if(cached)return cached;try{{const response=await fetch(event.request);if(response.ok){{const cache=await caches.open(CACHE);await cache.put(event.request,response.clone())}}return response}}catch(error){{return new Response('',{{status:504}})}}}})())}});
'''
    SW.write_text(worker, encoding="utf-8")


def main() -> None:
    patch_app()
    write_wrapper()
    write_recovery()
    update_manifest()
    write_service_worker()
    print("iPhone launch recovery v2 prepared")


if __name__ == "__main__":
    main()
