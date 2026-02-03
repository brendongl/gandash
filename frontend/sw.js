// GanDash Service Worker v0.3.3

const CACHE_NAME = 'gandash-v0.3.3';
const ASSETS_CACHE = 'gandash-assets-v0.3.3';
const API_CACHE = 'gandash-api-v0.3.3';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v0.3.3');
  
  event.waitUntil(
    caches.open(ASSETS_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        // Force this service worker to become active immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v0.3.3');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old caches
              return cacheName.startsWith('gandash-') && 
                     cacheName !== CACHE_NAME && 
                     cacheName !== ASSETS_CACHE && 
                     cacheName !== API_CACHE;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker v0.3.3 activated successfully');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseClone = response.clone();
          
          // Cache successful GET requests
          if (request.method === 'GET' && response.ok) {
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('[SW] Serving API from cache:', url.pathname);
                return cachedResponse;
              }
              // Return offline response for API failures
              return new Response(
                JSON.stringify({ 
                  error: 'Offline', 
                  message: 'You are currently offline' 
                }),
                { 
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }
  
  // Static assets - cache first, network fallback
  if (
    request.method === 'GET' &&
    (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com')
  ) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', url.pathname);
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetch(request)
            .then((response) => {
              // Don't cache non-successful responses
              if (!response || response.status !== 200) {
                return response;
              }
              
              // Clone the response
              const responseClone = response.clone();
              
              // Cache the fetched resource
              caches.open(ASSETS_CACHE)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
              
              return response;
            })
            .catch(() => {
              // Network failed, return offline page
              if (request.destination === 'document') {
                return caches.match('/index.html');
              }
            });
        })
    );
    return;
  }
  
  // For everything else, just fetch from network
  event.respondWith(fetch(request));
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
