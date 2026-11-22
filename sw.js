const CACHE_PREFIX='icthus-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=CACHE_PREFIX+'v5-20261122b';
const ASSETS=['./','./index.html','./styles.css','./app.js','./core.js','./songs.js','./appearance.js','./background-media.js','./personal-library.js','./backup.js','./install.js','./versions.js','./bible-download.js','./renderer.js','./icons.svg','./favicon.svg','./app-icons/icthus-192.png','./app-icons/icthus-512.png','./manifest.webmanifest','./projection.html','./projection.js','./data/rv1909.json','./data/FUENTE.txt'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if((name.startsWith(CACHE_PREFIX)||(new URL(self.registration.scope).pathname==='/'&&name.startsWith('ap-proyeccion-')))&&name!==CACHE)await caches.delete(name);await self.clients.claim();for(const client of await self.clients.matchAll())client.postMessage({type:'offline-ready'});})());});
self.addEventListener('message',event=>{if(event.data?.type==='check-ready')event.waitUntil(caches.open(CACHE).then(cache=>cache.match('./data/rv1909.json')).then(response=>{if(response)event.source?.postMessage({type:'offline-ready'});}));});

function assetUrl(url){
  const scope=new URL(self.registration.scope);
  // El alojamiento sirve projection.html también como /projection.
  if(url.pathname===new URL('./projection',scope).pathname)return new URL('./projection.html',scope);
  if(url.pathname===new URL('./index',scope).pathname)return scope;
  return ASSETS.map(asset=>new URL(asset,scope)).find(asset=>asset.pathname===url.pathname);
}

function navigationResponse(request,response){
  // Cache.addAll sigue la redirección .html → ruta sin extensión. Chrome no
  // permite devolver una respuesta ya redirigida a una navegación (manual).
  // Conservamos el HTML y sus cabeceras en una respuesta local sin redirección.
  if(request.mode==='navigate'&&response.redirected){
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers:response.headers});
  }
  return response;
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const asset=assetUrl(url);if(!asset)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(asset.href,{ignoreSearch:true});
    if(cached)return navigationResponse(event.request,cached);
    // Las redirecciones de la red siguen a cargo del navegador, incluidas
    // las que se necesiten para iniciar sesión en el sitio privado.
    return fetch(event.request);
  })());
});
