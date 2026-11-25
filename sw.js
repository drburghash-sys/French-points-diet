/* French Points Diet: cache static assets for offline use, not personal diet logs */
const CACHE='french-points-v1.2.0';
const PREFIX='french-points-v';
const CORE=['./','./index.html','./styles.css','./app.js?v=3','./foods-usda.js?v=1','./foods-local.js?v=3','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url),scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)))}return res}).catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html'))));
 }else event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)))}return res})));
});