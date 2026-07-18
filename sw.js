const CACHE='bonsai-photo-v5-highres-state-20260718';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./tree-renderer.js','./photo-assets.js','./photo-source-v2.js','./advanced-care.js','./advanced-care-bridge.js','./completion-core.js','./state-image-runtime.js','./judging-engine.js','./IMAGE_LICENSES.md'];
const REMOTE=['https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Japanese_Black_Pine_bonsai_135%2C_October_10%2C_2008.jpg/960px-Japanese_Black_Pine_bonsai_135%2C_October_10%2C_2008.jpg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const local=url.origin===location.origin;
  const remote=REMOTE.includes(event.request.url);
  if(!local&&!remote)return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
    if(response.ok||response.type==='opaque'){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>local&&event.request.mode==='navigate'?caches.match('./index.html'):hit)));
});
