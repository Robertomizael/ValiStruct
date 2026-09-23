const CACHE='valistruct-v3-0-rc6-dashboard-hotfix-1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const staticAsset=sameOrigin && ASSETS.some(a=>{
    const normalized=new URL(a,self.location.href).pathname;
    return url.pathname===normalized;
  });

  if(staticAsset){
    // Network-first for application shell: when an update is available,
    // users receive the current index/app.js/styles.css instead of a stale
    // cache-first copy. If offline, fall back to the last cached version.
    event.respondWith(
      fetch(event.request).then(resp=>{
        if(resp.ok){
          const copy=resp.clone();
          caches.open(CACHE).then(c=>c.put(event.request,copy));
        }
        return resp;
      }).catch(()=>caches.match(event.request))
    );
    return;
  }

  // Dynamic/API requests are network-only and are never put in Cache Storage.
  event.respondWith(fetch(event.request));
});
