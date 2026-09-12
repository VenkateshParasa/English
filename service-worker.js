// Service Worker for English Learning Portal
// Provides offline functionality and caching

const CACHE_NAME = 'english-portal-v1.0.2';
// v19 -> v20 (US-136 / US-404 — the recording archive gets a caller; plus US-236
// and US-237). Two content files were added to STATIC_ASSETS below, the modals and
// register grammar points. js/core/blobstore.js was already precached in v18 and
// simply had nothing calling it. What changed besides the content is app.js,
// styles.css and index.html together, and the
// cache split makes that combination the reason this line must move: index.html is
// network-first while app.js and styles.css go through cacheFirstStrategy(
// STATIC_CACHE). A returning learner would fetch the NEW index.html — which has
// `#recordingArchive` in the listening card — and run the OLD app.js, which
// defines no RecordingArchive, never draws into that div and never keeps a
// recording, so the archive region would sit empty and permanently hidden while
// the markup claimed it was there. In the other direction a new app.js against an
// old cached index.html is survivable by design: render() treats a missing host as
// "nothing to draw" rather than throwing, so the exercise still completes.
//
// v18 -> v19 (US-701 / US-703 / US-704 / US-711, plus US-225 / US-226). Two
// content files WERE added to STATIC_ASSETS below — the prepositions and
// past-simple grammar points; question-formation.js was already precached in v18.
// Beyond that, data.js, app.js and styles.css changed together and all three go
// through cacheFirstStrategy(STATIC_CACHE), while index.html goes network-first.
// That combination is the whole reason this line must move: a returning learner
// would fetch the NEW index.html — which has the speed buttons, the "✓ I said it"
// button, the "Show the transcript" button, the "I can't use the audio" switch
// and the Read Aloud lock note in it — and run the OLD app.js, which wires none
// of them. The result would be five dead controls, a permanently locked Read
// Aloud card (old app.js never enables #startSpeech) and a listening section with
// an empty sentence box, because old loadListeningExercise() writes `sentence`
// straight from a data.js that now holds objects and would print
// "[object Object]" or nothing at all.
//
// v17 -> v18 (US-140 / US-141 / US-186): the dictation check still grading with
// the fake `sim > 0.8`; comprehension questions painted red with no fix beside
// them; every new Mistakes.record() call missing.
//
// The previous bumps, for the record: v14 -> v15 -> v16 (US-177 / US-181,
// #reviewCard and #mistakePanel) and v16 -> v17 (US-179, the pronunciation
// group switcher).
const STATIC_CACHE = 'english-portal-static-v20';
const DYNAMIC_CACHE = 'english-portal-dynamic-v3';
const API_CACHE = 'english-portal-api-v3';

// Files to cache immediately on install.
//
// KEEP THIS IN SYNC WITH index.html. cache.addAll() below is all-or-nothing:
// one missing path rejects the whole install and the app silently loses
// offline support. __tests__/unit/assets.test.js enforces the invariant that
// every local <script>/<link> in index.html appears here and exists on disk.
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    // Styles
    '/styles.css',
    '/performance.css',
    '/css/animations.css',
    '/css/accessibility.css',
    '/css/notifications.css',
    // Core modules
    '/js/core/error-handler.js',
    '/js/core/validator.js',
    '/js/core/storage.js',
    '/js/core/notification.js',
    '/js/core/levels.js',
    '/js/core/sections.js',
    '/js/core/migrations.js',
    '/js/core/srs.js',
    '/js/core/mistakes.js',
    '/js/core/session.js',
    '/js/core/portability.js',
    '/js/core/blobstore.js',
    // UI
    '/js/theme-toggle.js',
    '/js/ui-enhancements.js',
    // App
    '/data.js',
    // Strand B grammar content, loaded by index.html before app.js.
    '/data/grammar.js',
    '/data/grammar/be.js',
    '/data/grammar/countability.js',
    '/data/grammar/present-simple-continuous.js',
    '/data/grammar/question-formation.js',
    '/data/grammar/prepositions.js',
    '/data/grammar/past-simple.js',
    '/data/grammar/modals.js',
    '/data/grammar/present-perfect.js',
    '/data/grammar/register.js',
    '/data/pronunciation/vowels-stress.js',
    '/data/pronunciation/consonants.js',
    '/app.js',
    // Shell metadata and icons referenced directly by index.html
    '/manifest.json',
    '/icons/icon-16x16.png',
    '/icons/icon-32x32.png',
    '/icons/apple-touch-icon.png',
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
    if (request.headers.get('accept')?.includes('text/html')) {
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

        // For navigation/HTML requests, serve the offline fallback page
        if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
            const offlineResponse = await caches.match('/offline.html');
            if (offlineResponse) {
                return offlineResponse;
            }
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
        icon: '/icons/icon-192x192.png',
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
