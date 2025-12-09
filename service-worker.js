// Service Worker for English Learning Portal
// Provides offline functionality and caching

const CACHE_NAME = 'english-portal-v1.0.0';
const STATIC_CACHE = 'english-portal-static-v1';
const DYNAMIC_CACHE = 'english-portal-dynamic-v1';
const API_CACHE = 'english-portal-api-v1';

// Files to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/data.js',
    // Add any other static assets
];

// API URLs to cache
const API_URLS = [
    'https://api.dictionaryapi.dev/api/v2/entries/en/'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((error) => {
                console.error('[Service Worker] Failed to cache static assets:', error);
            })
    );

    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => {
                        // Remove old caches
                        return cacheName.startsWith('english-portal-') &&
                               cacheName !== STATIC_CACHE &&
                               cacheName !== DYNAMIC_CACHE &&
                               cacheName !== API_CACHE;
                    })
                    .map((cacheName) => {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        })
    );

    // Take control of all pages immediately
    return self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle API requests with network-first strategy
    if (isAPIRequest(url)) {
        event.respondWith(networkFirstStrategy(request, API_CACHE));
        return;
    }

    // Handle static assets with cache-first strategy
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
        return;
    }

    // Handle HTML pages with network-first strategy
    if (request.headers.get('accept').includes('text/html')) {
        event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
        return;
    }

    // Default: try cache first, then network
    event.respondWith(cacheFirstStrategy(request, DYNAMIC_CACHE));
});

// Cache-first strategy: Check cache, then network
async function cacheFirstStrategy(request, cacheName) {
    try {
        const cached = await caches.match(request);
        if (cached) {
            console.log('[Service Worker] Serving from cache:', request.url);
            return cached;
        }

        console.log('[Service Worker] Fetching from network:', request.url);
        const response = await fetch(request);

        // Cache successful responses
        if (response && response.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);

        // Return offline page if available
        const offlineResponse = await caches.match('/offline.html');
        if (offlineResponse) {
            return offlineResponse;
        }

        return new Response('Offline - Content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
        });
    }
}

// Network-first strategy: Try network, fall back to cache
async function networkFirstStrategy(request, cacheName) {
    try {
        console.log('[Service Worker] Network first for:', request.url);
        const response = await fetch(request);

        // Cache successful responses
        if (response && response.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache:', request.url);
        const cached = await caches.match(request);

        if (cached) {
            return cached;
        }

        // Return offline response for failed API requests
        if (isAPIRequest(new URL(request.url))) {
            return new Response(JSON.stringify({ offline: true }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        throw error;
    }
}

// Helper: Check if request is for API
function isAPIRequest(url) {
    return API_URLS.some(apiUrl => url.href.includes(apiUrl));
}

// Helper: Check if request is for static asset
function isStaticAsset(url) {
    return url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/);
}

// Background sync for offline submissions (optional)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-progress') {
        event.waitUntil(syncProgress());
    }
});

async function syncProgress() {
    console.log('[Service Worker] Syncing progress...');
    // Implement progress sync logic here if needed
    return Promise.resolve();
}

// Push notifications (optional)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'English Learning Portal';
    const options = {
        body: data.body || 'You have a new notification',
        icon: '/icon.png',
        badge: '/badge.png',
        data: data
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow('/')
    );
});

console.log('[Service Worker] Loaded');
