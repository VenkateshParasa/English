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
//
// v20 -> v21 (US-601 / US-608): the free-production card (#freeSpeaking) and the
// silent route on Read Aloud (#readAloudSilent) are new markup in index.html
// that new app.js draws into. index.html is network-first and app.js is
// cache-first, so without a bump a returning learner gets the NEW index.html
// with the OLD app.js: the two new cards would sit on screen empty, which is the
// exact failure mode this comment block exists for.
//
// v21 -> v22 (US-408 / US-406). Three reasons, and the first two are the usual
// index.html-versus-app.js split:
//   1. index.html gains `#wordAudioNative` and `#wordAudioCredit` in the
//      vocabulary word card, which only the new app.js draws into or enables.
//      New index.html + old app.js = a permanently invisible native-audio
//      control, which is this comment block's whole reason to exist.
//   2. index.html's CSP `media-src` is new (see the CSP comment in index.html).
//      The OLD app.js under the NEW CSP is fine, but the NEW app.js under the
//      OLD cached CSP would have its clips refused, so the two must move
//      together.
//   3. This file itself changed shape: media is now routed by mediaStrategy()
//      into MEDIA_CACHE instead of falling through to cacheFirstStrategy(), and
//      cacheFirstStrategy() no longer answers a non-document request with
//      offline.html (see the defect note on that function). A returning learner
//      keeps the old worker until this constant moves, so the bump is what
//      actually delivers the fix.
//   4. US-406 adds NO markup to index.html — the duration-hint card is built by
//      app.js inside the US-404 comparison box — but it does add `.pron-duration`
//      rules to styles.css, and styles.css is cache-first like app.js. So it
//      needs the same bump to arrive, and it needs no separate one: v22 has not
//      shipped, and a second bump for an unreleased version would only cost a
//      returning learner an extra cache purge.
const STATIC_CACHE = 'english-portal-static-v22';
const DYNAMIC_CACHE = 'english-portal-dynamic-v3';
const API_CACHE = 'english-portal-api-v3';

/**
 * Audio (and video, if there is ever any) lives in its own cache — NFR-8:
 * "Audio requests are routed deliberately by the service worker, tolerate
 * Range/206 responses, and never fall back to an HTML page."
 *
 * WHY A SEPARATE CACHE AND NOT DYNAMIC_CACHE. Three properties that only hold
 * when media is on its own:
 *   - a clip is orders of magnitude bigger than anything else this app stores,
 *     so it is the thing that will hit a quota. Evicting it must not take the
 *     app shell with it, and `caches.delete(MEDIA_CACHE)` is a recovery that
 *     costs the learner nothing but a re-download;
 *   - the version does NOT ride on STATIC_CACHE. A pronunciation clip does not
 *     become stale because app.js changed, and throwing away every clip on
 *     every deploy would re-download them over a mobile connection for no
 *     reason. It gets bumped only when the STORED SHAPE changes;
 *   - a media entry can be evicted individually by the surface that discovered
 *     it will not play (see the 'media-failed' message handler at the bottom).
 */
const MEDIA_CACHE = 'english-portal-media-v1';

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
    '/data/grammar/future-forms.js',
    '/data/grammar/gerund-infinitive.js',
    '/data/pronunciation/vowels-stress.js',
    '/data/pronunciation/consonants.js',
    '/data/pronunciation/connected-speech.js',
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
                               cacheName !== MEDIA_CACHE &&
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

    // MEDIA IS ROUTED FIRST AND EXPLICITLY (NFR-8, US-408).
    //
    // Before this branch existed, an audio request matched none of the tests
    // below it — isStaticAsset()'s extension list has no audio extension in it
    // and an <audio> element sends no `Accept: text/html` — so every clip fell
    // through to the DEFAULT case at the bottom, cacheFirstStrategy(), whose
    // failure path answered with offline.html. "Routed deliberately" is the
    // opposite of "reached the default branch", so it goes first, ahead of
    // isStaticAsset() as well: a hypothetical '/clips/bus.webm' matches BOTH
    // (`webm` is in that regex) and media handling is the correct one.
    if (isMediaRequest(request, url)) {
        event.respondWith(mediaStrategy(request));
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

/**
 * Is this request asking for a sound?
 *
 * Three tests, deliberately in this order, because each one covers a case the
 * others miss:
 *
 *   request.destination  the honest answer when the browser gives one: the
 *                        platform itself says this fetch came from an <audio>
 *                        or <video> element. Not universally implemented, hence
 *                        the other two.
 *   Accept header        a media element sends an `Accept` of `audio/...` (or the
 *                        wildcard everything sends); the `audio/`-PREFIX test
 *                        catches the explicit case without misreading a bare
 *                        wildcard, which every other request in the app sends.
 *   extension            the fallback, and the only test that works for a
 *                        bundled clip requested by a plain fetch().
 *
 * `.webm` is in the list even though it is also a video container, because in
 * this app it is what MediaRecorder produces. A learner's own recording never
 * reaches the network (it is a blob: URL and blob: URLs do not hit a service
 * worker at all), so the only .webm here would be a bundled clip.
 */
function isMediaRequest(request, url) {
    const destination = request && request.destination;
    if (destination === 'audio' || destination === 'video') return true;

    const accept = (request && request.headers && request.headers.get('accept')) || '';
    if (accept.indexOf('audio/') === 0 || accept.indexOf('video/') === 0) return true;

    const pathname = (url && url.pathname) || '';
    return /\.(mp3|ogg|oga|opus|wav|m4a|aac|flac|weba|webm)$/i.test(pathname);
}

/** True for a request that a HTML page is a sane answer to, and only those. */
function isDocumentRequest(request) {
    if (!request) return false;
    if (request.mode === 'navigate') return true;
    if (request.destination === 'document' || request.destination === 'iframe') return true;
    const accept = (request.headers && request.headers.get('accept')) || '';
    return accept.includes('text/html');
}

/**
 * A failed media request, failing AS a media request (NFR-8).
 *
 * No body and no HTML. An <audio> element handed a 504 with an empty body fires
 * `error` with MEDIA_ERR_NETWORK, which is the truth and which app.js's clip
 * path can fall back from. Handed offline.html at status 200 — what this used to
 * do — it downloads a whole HTML document, fails to demux it and reports
 * MEDIA_ERR_SRC_NOT_SUPPORTED, i.e. "this file is corrupt": the learner is told
 * the recording is broken when the real answer is that they are offline.
 */
function mediaFailure() {
    return new Response(null, {
        status: 504,
        statusText: 'Audio unavailable offline'
    });
}

/**
 * Build a real 206 out of a complete cached clip.
 *
 * NFR-8 says media caching must "tolerate Range/206 responses". There are two
 * halves to that and this is the harder one: a media element that asks for
 * `bytes=0-` (Chromium's <audio> routinely does, and always does when seeking)
 * must not be answered with a 200 that claims to be the whole file when the
 * element asked for a fragment. The other half — never storing a 206 as if it
 * were complete — is in mediaStrategy() below.
 *
 * Returns null when the request cannot be served from this response, so the
 * caller falls through to the network rather than inventing bytes.
 */
async function rangeResponse(cached, rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/i.exec(rangeHeader || '');
    if (!match) return null;

    let buffer;
    try {
        // An opaque (cross-origin, no-cors) response cannot be read, so it cannot
        // be sliced. Falling through is correct: the network, or the untouched
        // full response, is the only honest answer for one of those.
        buffer = await cached.clone().arrayBuffer();
    } catch (error) {
        return null;
    }

    const total = buffer.byteLength;
    if (!total) return null;

    let start;
    let end;
    if (match[1] === '' && match[2] !== '') {
        // Suffix range: `bytes=-500` means the LAST 500 bytes, not the first.
        start = Math.max(0, total - parseInt(match[2], 10));
        end = total - 1;
    } else {
        start = match[1] === '' ? 0 : parseInt(match[1], 10);
        end = match[2] === '' ? total - 1 : Math.min(parseInt(match[2], 10), total - 1);
    }

    if (!(start >= 0) || start >= total || start > end) {
        // 416, with the Content-Range the spec requires on one, rather than a
        // slice of nothing that the media stack would read as a truncated file.
        return new Response(null, {
            status: 416,
            statusText: 'Range Not Satisfiable',
            headers: new Headers({ 'Content-Range': 'bytes */' + total })
        });
    }

    const slice = buffer.slice(start, end + 1);
    return new Response(slice, {
        status: 206,
        statusText: 'Partial Content',
        headers: new Headers({
            'Content-Type': cached.headers.get('content-type') || 'audio/mpeg',
            'Content-Length': String(slice.byteLength),
            'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
            'Accept-Ranges': 'bytes'
        })
    });
}

/**
 * The deliberate route for audio (NFR-8, US-408, R-9).
 *
 * Cache-first, because a clip is immutable: `.../media/pronunciations/en/bus-uk.mp3`
 * is one recording of one word forever, so revalidating it costs a mobile
 * learner bytes and buys nothing. NFR-4 wants replay to keep working offline.
 *
 * THE THREE RULES, none of which the default cache-first path honoured:
 *
 *  1. A 206 IS NEVER STORED. cache.put() on a 206 throws a TypeError, so the old
 *     `status === 200` guard did stop the crash — but the interesting half is
 *     that a fragment must not be stored under the whole file's URL even if the
 *     API allowed it. Half a clip served later as a complete one is a corrupt
 *     file that survives going offline.
 *  2. A RANGE REQUEST GETS A RANGE ANSWER. See rangeResponse().
 *  3. A FAILURE FAILS AS AUDIO. mediaFailure(), never offline.html.
 *
 * OPAQUE RESPONSES ARE CACHED, AND THAT IS A JUDGEMENT CALL. A cross-origin clip
 * fetched by <audio> without `crossorigin` comes back opaque: status 0, headers
 * unreadable, indistinguishable from a 404 page. Storing it risks pinning a
 * failure. Not storing it means NFR-4's offline replay never works for API
 * audio, on the one thing NFR-8 exists for. So it is stored, and the risk is
 * bounded from the other end instead: when a cached clip will not play, the
 * surface that discovered that tells this worker to delete it (the
 * 'media-failed' handler at the bottom). A pinned failure therefore costs one
 * silent press, once, rather than a permanently silent word.
 *
 * `crossorigin` is deliberately NOT set on the element: it would make the
 * response readable, but it would also make the clip fail outright on a host
 * that sends no CORS headers. Playing is the point; measuring it is not.
 */
async function mediaStrategy(request) {
    const range = (request.headers && request.headers.get('range')) || '';

    let cached = null;
    try {
        cached = await caches.match(request);
    } catch (error) {
        // A broken Cache API must not stop the clip from being fetched.
        console.warn('[Service Worker] Media cache lookup failed:', error);
    }

    if (cached && range) {
        const partial = await rangeResponse(cached, range);
        if (partial) return partial;
    }
    if (cached && !range) {
        return cached;
    }

    try {
        const response = await fetch(request);
        const status = response ? response.status : 0;

        // Rule 1. A 206 is the answer to THIS request and nothing more: return it,
        // store nothing. Anything other than a complete 200 (or an opaque
        // response, whose status is 0 by definition) is not a whole file either.
        const storable = !range &&
            (status === 200 || (status === 0 && response && response.type === 'opaque'));
        if (storable) {
            try {
                const cache = await caches.open(MEDIA_CACHE);
                await cache.put(request, response.clone());
            } catch (error) {
                // Quota, or a response the Cache API refuses. The learner still
                // gets the clip they asked for; only the offline copy is lost.
                console.warn('[Service Worker] Could not cache media:', error);
            }
        }
        return response;
    } catch (error) {
        console.warn('[Service Worker] Media fetch failed:', request.url, error);
        // Offline with a complete copy and a range request we could not slice
        // (an opaque entry). A complete 200 is a worse answer than a 206 and a
        // far better one than an error: the media stack treats it as "this
        // server does not do ranges" and reads from the start.
        if (cached) return cached;
        return mediaFailure();
    }
}

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

        // ⚠️ THE DEFECT THIS BRANCH USED TO BE (US-408, against NFR-8's last
        // clause: "never fall back to an HTML page").
        //
        // It used to return `caches.match('/offline.html')` for ANY request that
        // reached it — and every audio request reached it, because media matched
        // none of the tests in the fetch handler and landed on the default
        // cache-first branch. So a clip that failed to download resolved to an
        // HTML DOCUMENT WITH STATUS 200. Nothing anywhere reads that as an
        // error: the media element downloads the page, fails to demux it, and
        // reports MEDIA_ERR_SRC_NOT_SUPPORTED — "this file is corrupt". The
        // learner is told the recording is broken when they are simply offline,
        // and app.js cannot tell the two apart either, because at the fetch
        // layer it was a success.
        //
        // The same wrongness applied to every non-document request: a failed
        // fetch() for JSON got an HTML page at 200 and threw inside JSON.parse()
        // with a syntax error rather than reporting a network failure.
        //
        // networkFirstStrategy() below already had this right (it checks
        // `mode === 'navigate'` before reaching for the page); this branch is
        // now held to the same rule. A document gets the offline page. Everything
        // else fails as ITSELF, with a status that says so.
        if (isMediaRequest(request, new URL(request.url))) {
            return mediaFailure();
        }

        if (isDocumentRequest(request)) {
            const offlineResponse = await caches.match('/offline.html');
            if (offlineResponse) {
                return offlineResponse;
            }
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

/**
 * The other end of "opaque responses are cached" (see mediaStrategy).
 *
 * A cached clip that will not play is deleted by the surface that discovered it
 * will not play, because that surface is the only thing in the system that CAN
 * know: the worker stored a response it was not allowed to read. One message,
 * one delete, no retry ladder and no reply — this is a cleanup, and a learner is
 * never waiting on it.
 */
self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type !== 'media-failed' || !data.url) return;

    event.waitUntil(
        caches.open(MEDIA_CACHE)
            .then((cache) => cache.delete(data.url))
            .then((deleted) => {
                console.log('[Service Worker] Dropped unplayable media from cache:',
                            data.url, deleted);
            })
            .catch((error) => {
                console.warn('[Service Worker] Could not drop media:', error);
            })
    );
});

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
