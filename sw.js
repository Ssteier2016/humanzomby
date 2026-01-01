// Zombie Survivor - Service Worker
const CACHE_NAME = 'zombie-survivor-v2.0';
const STATIC_CACHE = 'zombie-static-v2.0';
const DYNAMIC_CACHE = 'zombie-dynamic-v2.0';

// Archivos para cachear
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logozombie.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&family=Inter:wght@400;500;700&display=swap',
  'https://cdn-icons-png.flaticon.com/512/3408/3408545.png',
  'https://cdn-icons-png.flaticon.com/512/4140/4140037.png',
  'https://cdn-icons-png.flaticon.com/512/1154/1154443.png',
  'https://cdn-icons-png.flaticon.com/512/606/606553.png',
  'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
  'https://cdn-icons-png.flaticon.com/512/2590/2590525.png',
  'https://cdn-icons-png.flaticon.com/512/1066/1066744.png',
  'https://cdn-icons-png.flaticon.com/512/1067/1067357.png'
];

// Firebase SDKs
const FIREBASE_FILES = [
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Cacheando archivos estáticos');
        return cache.addAll([...STATIC_FILES, ...FIREBASE_FILES]);
      })
      .then(() => {
        console.log('[SW] Todos los recursos fueron cacheados');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Error al cachear:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Eliminar caches antiguos
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[SW] Service Worker activado');
      return self.clients.claim();
    })
  );
});

// Estrategia de Cache: Network First, luego Cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Para WebSockets, no hacer cache
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  // Para Firebase y APIs, siempre network
  if (url.href.includes('firebase') || url.href.includes('googleapis')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cachear respuesta exitosa
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(event.request, responseClone);
              });
          }
          return response;
        })
        .catch(() => {
          // Fallback a cache si hay error
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Para assets del juego, cache first
  if (STATIC_FILES.some(file => url.href.includes(file.split('/').pop()))) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              if (!response || response.status !== 200) {
                return response;
              }
              
              const responseClone = response.clone();
              caches.open(STATIC_CACHE)
                .then(cache => {
                  cache.put(event.request, responseClone);
                });
              
              return response;
            })
            .catch(error => {
              console.error('[SW] Error al fetch:', error);
              // Puedes devolver una página offline personalizada aquí
            });
        })
    );
    return;
  }
  
  // Para otras peticiones, network first
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Solo cachear respuestas exitosas
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => {
              cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // Intentar servir desde cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Página offline para HTML
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/')
                .then(homePage => homePage || new Response(
                  '<h1>Zombie Survivor - Modo Offline</h1><p>No hay conexión a internet.</p>',
                  { headers: { 'Content-Type': 'text/html' } }
                ));
            }
            
            // Para otros tipos, devolver error
            return new Response('', { status: 408, statusText: 'Offline' });
          });
      })
  );
});

// Manejo de mensajes desde la app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_INFO') {
    caches.keys().then(cacheNames => {
      event.ports[0].postMessage({
        type: 'CACHE_INFO',
        cacheNames: cacheNames
      });
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }).then(() => {
      event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});

// Sincronización en segundo plano
self.addEventListener('sync', event => {
  if (event.tag === 'sync-game-data') {
    console.log('[SW] Sincronizando datos del juego');
    event.waitUntil(syncGameData());
  }
});

async function syncGameData() {
  // Aquí puedes implementar la sincronización de datos del juego
  // como puntuaciones, progreso, etc.
  console.log('[SW] Sincronización completada');
}

// Manejo de notificaciones push
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : '¡Nueva actividad en Zombie Survivor!',
    icon: '/logozombie.png',
    badge: '/logozombie.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      timestamp: Date.now()
    },
    actions: [
      { action: 'play', title: '🎮 Jugar' },
      { action: 'dismiss', title: '❌ Cerrar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Zombie Survivor', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'play') {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then(clientList => {
          for (const client of clientList) {
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});
