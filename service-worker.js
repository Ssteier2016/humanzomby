const CACHE_NAME = 'zombie-survivor-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&display=swap',
  'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
  'https://cdn-icons-png.flaticon.com/512/3408/3408545.png',
  'https://cdn-icons-png.flaticon.com/512/4140/4140037.png',
  'https://cdn-icons-png.flaticon.com/512/1154/1154443.png',
  'https://cdn-icons-png.flaticon.com/512/606/606553.png',
  'https://cdn-icons-png.flaticon.com/512/744/744465.png',
  'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
  'https://cdn-icons-png.flaticon.com/512/2590/2590525.png',
  'https://cdn-icons-png.flaticon.com/512/1066/1066744.png',
  'https://cdn-icons-png.flaticon.com/512/1067/1067357.png'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activar y limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Cache First con fallback a network
self.addEventListener('fetch', (event) => {
  // Excluir Firebase y videos del cache
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('.mp4') ||
      event.request.url.includes('.mp3')) {
    return; // Usar network directamente
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          })
          .catch(() => {
            // Fallback para página offline
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Manejar mensajes desde la página principal
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
