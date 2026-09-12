/**
 * Recording blob store — audio Blobs in IndexedDB, keyed per prompt
 * -------------------------------------------------------------
 * Implements FR-DATA-6 ("recordings are stored as blobs in IndexedDB, with a
 * size cap and eviction") and NFR-10 ("quota-exceeded is handled with a clear
 * message, never silent data loss") against the amended CON-3 — "client-side
 * storage only; localStorage for state, IndexedDB for blobs" (PROGRESS.md B11 /
 * §6.y A17).
 *
 * Why this file exists: CURRICULUM.md Strand E.7 wants the last N recordings
 * kept per prompt so a learner can hear month-one against month-three. Today
 * app.js holds one recording in a closure variable and revokes it on the next
 * navigation, so nothing survives. localStorage cannot help — it is string-only
 * with a ~5–10MB ceiling.
 *
 * THIS MODULE STORES ONLY BLOBS. It never reads or writes localStorage, and
 * DB_VERSION below is IndexedDB's own object-store-shape version, which is a
 * completely different thing from Migrations.SCHEMA_VERSION (the shape of the
 * `learningProgress` record in localStorage). The two are never compared,
 * synchronised, or bumped together. Conflating them would mean a localStorage
 * migration triggering an IndexedDB upgrade that has nothing to do with it.
 *
 * Two properties everything else here is built around:
 *
 *   1. NOTHING REJECTS. Every public method resolves. IndexedDB can be absent
 *      (old embedded webviews), blocked (Safari private browsing has thrown on
 *      open outright), or hang forever (a known WebKit bug), and a speaking
 *      exercise must stay completable when it is. Failures come back as
 *      { ok:false, code, message } from the writers and as empty/null from the
 *      readers, so a broken store can never surface as an unhandled rejection
 *      that stops the exercise. Callers ask available() BEFORE offering to save.
 *   2. A FAILED WRITE LOSES NOTHING. Every write is one IndexedDB transaction:
 *      eviction, the metadata row and the audio payload commit together or not
 *      at all. Space is refused before anything is deleted, so "there is no
 *      room" can never cost a learner a recording they already had. That
 *      includes the QuotaExceededError retry: the retry's extra eviction is
 *      issued INSIDE the retrying transaction (see put() and commit()), so a
 *      retry that hits quota again rolls its own eviction back and the refusal
 *      is honest. Nothing is ever deleted by a transaction that does not go on
 *      to write the recording it deleted it for.
 *
 * Public API (window.BlobStore) — see the README block above each method:
 *   isSupported()                        -> boolean, synchronous, cheap
 *   available(opts)                      -> Promise<{ ok, code, message }>
 *   put(promptId, blob, meta)            -> Promise<{ ok, record, evicted, ... }>
 *   list(promptId)                       -> Promise<[record, ...]> newest first
 *   get(id)                              -> Promise<record & { blob } | null>
 *   openUrl(id)                          -> Promise<{ ok, url, revoke, record }>
 *   revoke(url) / revokeAll()            -> object-URL lifecycle
 *   remove(id)                           -> Promise<{ ok, removed }>
 *   removeForPrompt(promptId)            -> Promise<{ ok, removed }>
 *   clear()                              -> Promise<{ ok, removed }>
 *   usage()                              -> Promise<{ count, bytes, ... }>
 *   prompts()                            -> Promise<[{ promptId, count, ... }]>
 *   MESSAGES, MAX_PER_PROMPT, MAX_TOTAL_BYTES, MAX_RECORDING_BYTES
 */
(function (global) {
    'use strict';

    // ------------------------------------------------------------------
    // IndexedDB schema identity
    // ------------------------------------------------------------------

    const DB_NAME = 'englishPortalMedia';

    // IndexedDB's own schema version. Bump ONLY when the object stores or
    // indexes below change shape, and add the matching branch to createSchema().
    // Unrelated to Migrations.SCHEMA_VERSION (localStorage). See file header.
    const DB_VERSION = 1;

    const STORE_META = 'recordings';   // one small row per recording, no blobs
    const STORE_AUDIO = 'audio';       // the payloads, keyed by the same id
    const IDX_PROMPT_TIME = 'promptCreated';  // ['promptId', 'createdAt']

    // Shape marker on each metadata row, so a future release can recognise rows
    // written by this one without an IndexedDB version bump (adding a field is
    // not a schema change; adding an index is).
    const RECORD_VERSION = 1;

    // STORE_AUDIO uses the metadata row's id as its key. Ids come from an
    // autoIncrement generator, which starts at 1, so 0 can never belong to a
    // real recording and is reserved for the write probe in available({deep}).
    const PROBE_ID = 0;

    // ------------------------------------------------------------------
    // Retention and caps — FR-DATA-6, OQ-6
    // ------------------------------------------------------------------
    //
    // OQ-6 proposes "N=3 per prompt and a 50MB cap, then measure". Both are
    // adopted as the defaults below. One thing about N=3 IS wrong, though, and
    // it is worth stating plainly rather than implementing:
    //
    //   FR-DATA-6's rule as written — "oldest-beyond-N evicted per prompt" — is
    //   a plain ring buffer, and a ring buffer deletes exactly the recording
    //   E.7 exists to keep. On the fourth attempt at a prompt, month-one goes
    //   in the bin; by month three there is nothing left to compare against.
    //   The feature's stated motivator destroys itself on the fourth use.
    //
    // So the cap here is still "N per prompt" but the SLOTS are allocated as
    // one pinned baseline (the first recording ever made for that prompt) plus
    // the N-1 most recent. With N=3: your first try, and your last two. That
    // keeps the comparison the curriculum calls its strongest motivator working
    // forever, at zero extra storage, and it is still a documented cap with
    // documented eviction. PIN_BASELINE=false gives the literal FR-DATA-6
    // behaviour if this is ever judged the wrong call.
    const MAX_PER_PROMPT = 3;
    const PIN_BASELINE = true;

    // Total across all prompts. A cap this module enforces itself, distinct
    // from the browser's own quota, which is larger, invisible and can shrink
    // under storage pressure at any time (hence the quota path in put()).
    const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

    // One recording. MediaRecorder webm/opus mono runs ~3KB/s, so 10MB is
    // roughly an hour: far past any prompt in this app. A blob bigger than this
    // is a recorder that was never stopped, and accepting it would spend a
    // fifth of the whole archive on one accident.
    //
    // Clamped to MAX_TOTAL_BYTES so "one recording may never be more than the
    // whole archive" is true by construction rather than by a second runtime
    // check that the 10MB rule always beat to it (US-221). Whichever cap is
    // smaller is the one put() reports, and there is only ever one branch.
    const MAX_RECORDING_BYTES = Math.min(10 * 1024 * 1024, MAX_TOTAL_BYTES);

    // On QuotaExceededError we free space and retry exactly ONCE, asking for a
    // multiple of what we need so the retry is not defeated by the next
    // allocation. See put() for why retry-once and not refuse-outright.
    const QUOTA_EVICT_FACTOR = 3;

    // A WebKit bug has left indexedDB.open() never firing any event at all. A
    // pending promise that never settles would leave the Save button spinning
    // for the rest of the session, so treat silence as unavailable.
    const OPEN_TIMEOUT_MS = 8000;

    // Backstop for callers that forget to revoke (see the object-URL contract
    // above openUrl). A learner cannot be playing eight recordings at once.
    const MAX_LIVE_URLS = 8;

    // ------------------------------------------------------------------
    // Learner-facing copy — docs/TEACHING_METHODOLOGY.md §5
    // Plain, calm, second person. Every failure says what did NOT happen,
    // because "did I just lose my recordings?" is the only question that
    // matters to someone reading an error here.
    // ------------------------------------------------------------------

    const MESSAGES = {
        unavailable: 'This browser will not let the app keep recordings, so this one lasts until you leave the page. Everything else works normally.',
        otherTab: 'This app is open in another tab, which is holding on to your recordings. Close the other tab and try again.',

        saved: 'Saved. You can play it back and compare it with your earlier tries.',
        // Retention at THIS prompt: the learner's fourth try here pushed out the
        // in-between one. Only ever used when the deleted recording belonged to
        // the prompt just recorded at.
        savedEvicted: 'Saved. This prompt keeps your first recording and your two most recent, so an in-between one was removed.',
        // The 50MB cap or the browser's quota, which frees space from OTHER
        // prompts. Saying "this prompt" here would name the wrong prompt
        // entirely (US-218), so this copy says where the space came from and
        // what is still protected. `evictedPrompts` on the result names them.
        savedFreedSpace: 'Saved. There was no room left on this device, so in-between recordings at your other prompts were deleted to make space. Every prompt still keeps its first recording and its most recent one.',
        savedEvictedAndFreedSpace: 'Saved. An in-between recording at this prompt was removed, and so were in-between recordings at your other prompts, because there was no room left. Every prompt still keeps its first recording and its most recent one.',

        empty: 'Nothing was recorded, so there is nothing to keep.',
        tooLong: 'That recording is too long to keep. Stop the recording when you have finished speaking and try again — nothing else has changed.',

        full: 'There is no room left on this device for another recording. Your existing recordings are safe. Delete a few from this prompt and record again.',
        writeFailed: 'That recording could not be saved. Your existing recordings are unchanged.',

        missing: 'That recording is no longer on this device.',
        playbackFailed: 'That recording could not be opened for playback.',

        removed: 'Recording deleted.',
        removeFailed: 'That recording could not be deleted. Nothing has changed.',
        cleared: 'All your recordings have been deleted from this device.',
        clearFailed: 'Your recordings could not be deleted. Nothing has changed.'
    };

    // ------------------------------------------------------------------
    // Environment seam
    // ------------------------------------------------------------------
    //
    // Node has no IndexedDB, so every reference goes through environment().
    // __tests__ / tmp harnesses inject a fake with useEnvironment(). This is
    // the ONLY way the module reaches indexedDB, so a test drives the real
    // logic rather than a parallel implementation of it.

    let env = null;
    let dbPromise = null;
    let capability = null;      // cached available() result, reset by useEnvironment
    let deepProbe = null;       // cached available({deep:true}) result

    /** Reading a global can itself throw in a sandboxed iframe. */
    function readGlobal(name) {
        try {
            return global[name] || null;
        } catch (e) {
            return null;
        }
    }

    function environment() {
        if (!env) {
            env = {
                indexedDB: readGlobal('indexedDB'),
                IDBKeyRange: readGlobal('IDBKeyRange')
            };
        }
        return env;
    }

    /** Test seam. Pass null to go back to the real globals. */
    function useEnvironment(next) {
        env = next ? { indexedDB: next.indexedDB || null, IDBKeyRange: next.IDBKeyRange || null } : null;
        dbPromise = null;
        capability = null;
        deepProbe = null;
        return environment();
    }

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------

    function logError(e, context) {
        try {
            if (global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                global.AppErrorHandler.logError(e, context);
            } else if (typeof console !== 'undefined' && console.warn) {
                console.warn('[blobstore] ' + context + ':', e);
            }
        } catch (ignored) { /* a hostile console must never break a save */ }
    }

    /** An Error carrying a stable `code` and the learner-facing `message`. */
    function storeError(code, message, cause) {
        const err = new Error(code + (cause && cause.name ? ' (' + cause.name + ')' : ''));
        err.code = code;
        err.learnerMessage = message;
        if (cause) err.cause = cause;
        return err;
    }

    function fail(code, message, extra) {
        const out = { ok: false, code: code, message: message };
        if (extra) {
            Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
        }
        return out;
    }

    /** Same detection as portability.js — engines disagree on name and code. */
    function isQuotaError(e) {
        if (!e) return false;
        return e.name === 'QuotaExceededError' ||
               e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
               e.code === 22 || e.code === 1014;
    }

    /** A Blob that cannot be structured-cloned into IndexedDB at all. */
    function isCloneError(e) {
        return !!e && (e.name === 'DataCloneError' || e.name === 'DataError');
    }

    function now() {
        return BlobStore._now();
    }

    /**
     * Byte size of something blob-shaped, or null if it is not.
     * Deliberately duck-typed: `instanceof Blob` is false across realms (an
     * iframe, a worker) and MediaRecorder output in some webviews is a File,
     * which is a Blob subclass but not always the same constructor.
     */
    function blobSize(blob) {
        if (!blob || typeof blob !== 'object') return null;
        const size = blob.size;
        if (typeof size !== 'number' || !isFinite(size) || size < 0) return null;
        return size;
    }

    /** Stable, trimmed, bounded prompt key. Empty means "unusable". */
    function normalizePromptId(promptId) {
        if (promptId === null || promptId === undefined) return '';
        const key = String(promptId).trim();
        if (key.length === 0 || key.length > 200) return '';
        return key;
    }

    function cleanString(value, max) {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        return trimmed.slice(0, max || 200);
    }

    /**
     * A non-negative finite number, or null.
     *
     * Deliberately NOT `Number(value)` alone: `Number(null)` is 0, `Number(false)`
     * is 0, `Number('')` is 0 and `Number([])` is 0, all of which pass isFinite
     * and `>= 0`. That is how a recording saved with no duration came back as
     * `null` from put() and `0` from list()/get() — the same recording, two
     * different answers, and a UI showing "0:00" for a length nobody measured
     * (US-220). Only numbers and non-blank numeric strings are accepted; every
     * other type means "not a number", which is what null says.
     */
    function cleanNumber(value) {
        if (typeof value === 'number') {
            return (isFinite(value) && value >= 0) ? value : null;
        }
        if (typeof value !== 'string' || value.trim() === '') return null;
        const n = Number(value);
        return (isFinite(n) && n >= 0) ? n : null;
    }

    /**
     * Oldest first, ties broken by id. The tie-break is not cosmetic: two
     * recordings can land in the same millisecond, and eviction has to be a
     * total order or "the oldest" is whatever order the engine happened to
     * return. Ids come from autoIncrement, so id order IS insertion order.
     */
    function byAge(a, b) {
        return (a.createdAt - b.createdAt) || (a.id - b.id);
    }

    /**
     * Rows we can trust: anything else in the store is ignored, never thrown on.
     *
     * "Trust" includes being FINDABLE. A row whose createdAt is not a number is
     * absent from IDX_PROMPT_TIME — a compound key containing null or undefined
     * is not a valid key, so IndexedDB skips the record entirely — and list()
     * reads through that index. Coercing such a row to the epoch here would have
     * usage() and prompts() count a recording, and eviction act on it, while the
     * archive screen could never show it and the learner could never play it
     * (US-220). So it is rejected on the same footing as a row with no promptId:
     * one answer everywhere, rather than two answers depending on which method
     * was asked.
     *
     * Consequence, stated rather than hidden: bytes held by such a row are not
     * counted by usage() and cannot be reclaimed by eviction. Only clear(), which
     * empties the stores wholesale, removes it. put() can never create one (see
     * the createdAt guard there), so this is a foreign-write / corruption case,
     * and under-reporting a row we refuse to manage is safer than acting on one
     * we cannot show.
     */
    function usableRows(rows) {
        if (!rows || typeof rows.length !== 'number') return [];
        const out = [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!r || typeof r !== 'object') continue;
            if (typeof r.id !== 'number' || r.id === PROBE_ID) continue;
            if (typeof r.promptId !== 'string' || !r.promptId) continue;
            // Any value the index can hold is fine, including a garbage string
            // that cleanNumber turns into 0 — such a row IS indexed, just dated
            // to the epoch. Only "no key at all" is unusable.
            if (r.createdAt === null || r.createdAt === undefined) continue;
            out.push({
                id: r.id,
                promptId: r.promptId,
                createdAt: cleanNumber(r.createdAt) || 0,
                size: cleanNumber(r.size) || 0,
                mimeType: typeof r.mimeType === 'string' ? r.mimeType : null,
                durationMs: cleanNumber(r.durationMs),
                label: typeof r.label === 'string' ? r.label : null,
                baseline: r.baseline === true,
                v: cleanNumber(r.v) || 1
            });
        }
        return out;
    }

    function totalBytes(rows) {
        let sum = 0;
        for (let i = 0; i < rows.length; i++) sum += rows[i].size;
        return sum;
    }

    // ------------------------------------------------------------------
    // Promise wrappers over the event-based API
    // ------------------------------------------------------------------

    /**
     * Object stores and indexes.
     *
     * STORE_META holds one small row per recording — id, promptId, createdAt,
     * size, mimeType, durationMs, label, baseline — and NO blob. STORE_AUDIO
     * holds the payloads under the same id. That split is the single most
     * important design decision in this file:
     *
     *   - list(), usage() and every eviction decision read metadata only. If
     *     the blobs lived on the same rows, drawing a list of three recordings
     *     or totalling the archive would deserialise every audio blob in the
     *     store into memory. On a phone that is the difference between an
     *     instant list and a visible stall.
     *   - IndexedDB has no aggregate query, so "how many bytes am I holding" is
     *     necessarily a scan. Scanning ~250 small rows (50MB at a realistic
     *     200KB per recording) costs nothing; scanning 50MB of audio does.
     *   - A readwrite transaction spans both stores, so a row and its payload
     *     commit or abort together. There is no state where a list offers a
     *     recording whose audio was never written.
     *
     * One index: IDX_PROMPT_TIME on ['promptId', 'createdAt'].
     *   - It answers the query the UI actually makes — "this prompt's
     *     recordings, in order" — as a single range read, already sorted, so
     *     drawing the archive never scans other prompts.
     *   - There is deliberately NO index on createdAt alone. Global
     *     oldest-first eviction needs the byte total anyway, so it already has
     *     every row in memory and sorts there; an extra index would be write
     *     cost for a sort we get free. If a future feature needs "most recent
     *     across all prompts" without the total, DB_VERSION 2 can add it —
     *     createIndex() on an existing store backfills, so that upgrade is
     *     additive and non-destructive, which is exactly why the stores
     *     themselves had to be right first time and the indexes did not.
     */
    function createSchema(db, oldVersion) {
        // Written as a fall-through ladder so a device arriving from any older
        // version runs every step it missed, in order. `oldVersion` is 0 on a
        // fresh install.
        if (oldVersion < 1) {
            const meta = db.createObjectStore(STORE_META, { keyPath: 'id', autoIncrement: true });
            meta.createIndex(IDX_PROMPT_TIME, ['promptId', 'createdAt'], { unique: false });
            // Out-of-line would be tidier, but an inline record keeps the
            // payload self-describing: dump this store and you can still tell
            // which prompt each blob belonged to.
            db.createObjectStore(STORE_AUDIO, { keyPath: 'id' });
        }
        // if (oldVersion < 2) { ... } — add future steps here, never edit above.
    }

    function openDb() {
        if (dbPromise) return dbPromise;

        const attempt = new Promise(function (resolve, reject) {
            const factory = environment().indexedDB;
            if (!factory) {
                reject(storeError('no-indexeddb', MESSAGES.unavailable));
                return;
            }

            let request;
            try {
                request = factory.open(DB_NAME, DB_VERSION);
            } catch (e) {
                // Safari private browsing threw here for years; some webviews
                // still do. This is not an error worth surfacing as a crash.
                reject(storeError('blocked', MESSAGES.unavailable, e));
                return;
            }

            let settled = false;
            let timer = null;
            function settle(fn, arg) {
                if (settled) return;
                settled = true;
                if (timer !== null && typeof clearTimeout === 'function') clearTimeout(timer);
                fn(arg);
            }

            if (typeof setTimeout === 'function') {
                timer = setTimeout(function () {
                    settle(reject, storeError('timeout', MESSAGES.unavailable));
                }, OPEN_TIMEOUT_MS);
            }

            request.onupgradeneeded = function (event) {
                try {
                    createSchema(request.result, (event && event.oldVersion) || 0);
                } catch (e) {
                    // Abort the version change rather than leave a half-built
                    // schema behind for the next load to trip over.
                    logError(e, 'blobstore schema upgrade');
                    try { request.transaction.abort(); } catch (ignored) { /* already gone */ }
                }
            };

            request.onsuccess = function () {
                const db = request.result;
                // Another tab is upgrading: let go so it is not blocked, and
                // drop the cache so the next call reopens.
                db.onversionchange = function () {
                    try { db.close(); } catch (e) { /* ignore */ }
                    dbPromise = null;
                };
                db.onclose = function () { dbPromise = null; };
                settle(resolve, db);
            };

            request.onerror = function () {
                settle(reject, storeError('blocked', MESSAGES.unavailable, request.error));
            };

            // An older version is still open in another tab. Reject rather than
            // hang; the learner gets a message they can act on.
            request.onblocked = function () {
                settle(reject, storeError('blocked-by-other-tab', MESSAGES.otherTab));
            };
        });

        // Cache the success, never the failure: a blocked-by-another-tab or
        // timed-out open must be retryable without a page reload.
        dbPromise = attempt.catch(function (e) {
            dbPromise = null;
            throw e;
        });
        return dbPromise;
    }

    /**
     * One transaction, one promise.
     *
     * `work(tx, ctx)` must issue its requests synchronously, or from inside the
     * onsuccess of a request it already issued. It must never await between
     * requests: an IndexedDB transaction auto-commits as soon as its request
     * queue drains, so an intervening microtask can close it under you. That is
     * why the writers below chain via onsuccess instead of async/await, and why
     * the ONLY thing awaited is the transaction as a whole.
     *
     * ctx.watch(request)   - record the request's error, and let it abort the tx
     * ctx.resolveWith(v)   - the value the promise resolves to on commit
     * ctx.refuse(err)      - abort deliberately and reject with a chosen error
     */
    function runTx(db, storeNames, mode, work) {
        return new Promise(function (resolve, reject) {
            let tx;
            try {
                tx = db.transaction(storeNames, mode);
            } catch (e) {
                reject(storeError('tx-failed', MESSAGES.writeFailed, e));
                return;
            }

            let value = null;
            let failure = null;

            const ctx = {
                watch: function (request) {
                    request.onerror = function () {
                        // First error wins — it is the cause; later ones are
                        // consequences of the abort.
                        if (!failure) {
                            failure = request.error ||
                                storeError('request-failed', MESSAGES.writeFailed);
                        }
                        // NOT preventDefault()ed on purpose: an unhandled
                        // request error aborts the transaction, which is the
                        // all-or-nothing behaviour we want. A QuotaExceededError
                        // on the audio payload therefore rolls back the metadata
                        // row and every eviction in the same transaction.
                    };
                    return request;
                },
                resolveWith: function (v) { value = v; },
                refuse: function (err) {
                    failure = err;
                    try { tx.abort(); } catch (e) { /* already finishing */ }
                }
            };

            tx.oncomplete = function () { resolve(value); };
            tx.onabort = function () {
                reject(failure || tx.error || storeError('aborted', MESSAGES.writeFailed));
            };
            tx.onerror = function () {
                reject(failure || tx.error || storeError('tx-error', MESSAGES.writeFailed));
            };

            try {
                work(tx, ctx);
            } catch (e) {
                failure = e;
                try { tx.abort(); } catch (ignored) { /* already finishing */ }
            }
        });
    }

    /** Every metadata row in the store, cleaned. Reads no blobs. */
    function readAllMeta(db) {
        return runTx(db, [STORE_META], 'readonly', function (tx, ctx) {
            const req = ctx.watch(tx.objectStore(STORE_META).getAll());
            req.onsuccess = function () { ctx.resolveWith(usableRows(req.result)); };
        });
    }

    // ------------------------------------------------------------------
    // Retention policy — pure functions, so the interesting logic is testable
    // without IndexedDB at all
    // ------------------------------------------------------------------

    // Stands in for the row being inserted, which has no id yet. Deliberately
    // +Infinity rather than a sentinel like -1: byAge falls back to id when two
    // rows share a millisecond, and a sentinel that sorted FIRST would make the
    // brand-new row look like the prompt's baseline and get the real month-one
    // recording evicted in its place. The new row is the newest by
    // construction, so it must sort last.
    const NEW_ID = Infinity;

    /**
     * The ONE definition of "this row is the prompt's pinned baseline".
     *
     * planRetention() used to pin `ordered[0]` — the oldest row it could see —
     * while evictionCandidates() protected `r.baseline`, the flag commit()
     * persists for the first recording ever made at a prompt. Those agree until
     * a learner deletes their real baseline (remove() deliberately allows it):
     * from then on the next-oldest row was protected by one function and offered
     * up as expendable by the other, so "is this row safe?" depended on which
     * function you asked (US-222).
     *
     * The persisted flag wins, because it is the only one of the two that can be
     * TRUE: it means "the first recording ever made here", it is what
     * publicRecord() reports to the UI, and re-deriving it from position would
     * make a later recording claim to be the learner's month-one. A prompt whose
     * baseline the learner deleted therefore has no pinned row at all and keeps
     * its MAX_PER_PROMPT most recent — which is what "I deleted my first try"
     * honestly means. It is not silently promoted, in either function.
     */
    function isPinnedBaseline(row) {
        return PIN_BASELINE && !!row && row.baseline === true;
    }

    /**
     * Which of ONE prompt's rows to drop, given the projected list including
     * the row about to be written. Oldest first, keeping:
     *   - the pinned baseline, by isPinnedBaseline() — the same definition
     *     evictionCandidates() protects, so the two can never disagree about
     *     whether a given row is safe (US-222), and
     *   - the most recent, up to MAX_PER_PROMPT slots in total.
     */
    function planRetention(projected) {
        const ordered = projected.slice().sort(byAge);
        if (ordered.length <= MAX_PER_PROMPT) return [];

        const keep = Object.create(null);
        let kept = 0;
        function keepRow(row) {
            if (keep[row.id]) return;
            keep[row.id] = true;
            kept += 1;
        }

        // The pinned baseline, by the shared definition — not "whatever is
        // oldest", which is a different row once the real baseline is gone.
        for (let i = 0; i < ordered.length; i++) {
            if (isPinnedBaseline(ordered[i])) { keepRow(ordered[i]); break; }
        }
        for (let i = ordered.length - 1; i >= 0 && kept < MAX_PER_PROMPT; i--) keepRow(ordered[i]);

        const victims = [];
        for (let i = 0; i < ordered.length; i++) {
            if (!keep[ordered[i].id] && ordered[i].id !== NEW_ID) victims.push(ordered[i].id);
        }
        return victims;
    }

    /**
     * Rows that may be deleted to make room, oldest first.
     *
     * Protected, and the reason each one is:
     *   - a prompt's most recent recording. Deleting it would mean recording at
     *     prompt B silently wipes what the learner just did at prompt A.
     *   - a pinned baseline. It is the month-one half of the comparison this
     *     whole feature exists for, and it is also the smallest thing in the
     *     archive to keep.
     *   - anything already being deleted by this write's own retention plan.
     * If that leaves nothing, the write is refused rather than made to fit.
     */
    function evictionCandidates(rows, alreadyPlanned) {
        const skip = Object.create(null);
        (alreadyPlanned || []).forEach(function (id) { skip[id] = true; });

        const newestPerPrompt = Object.create(null);
        rows.forEach(function (r) {
            const current = newestPerPrompt[r.promptId];
            if (!current || byAge(current, r) < 0) newestPerPrompt[r.promptId] = r;
        });

        return rows
            .filter(function (r) {
                if (skip[r.id]) return false;
                if (isPinnedBaseline(r)) return false;
                const newest = newestPerPrompt[r.promptId];
                return !(newest && newest.id === r.id);
            })
            .sort(byAge);
    }

    /**
     * Pick candidates, oldest first, until `bytesNeeded` is freed.
     * { ok:false } means the cap cannot be honoured without deleting something
     * protected — the caller must refuse the write, not delete it anyway.
     */
    function planForSpace(rows, alreadyPlanned, bytesNeeded) {
        if (bytesNeeded <= 0) return { ok: true, ids: [], freed: 0 };

        const candidates = evictionCandidates(rows, alreadyPlanned);
        const ids = [];
        let freed = 0;
        for (let i = 0; i < candidates.length && freed < bytesNeeded; i++) {
            ids.push(candidates[i].id);
            freed += candidates[i].size;
        }
        return freed >= bytesNeeded
            ? { ok: true, ids: ids, freed: freed }
            : { ok: false, ids: ids, freed: freed };
    }

    // ------------------------------------------------------------------
    // Availability — ask this BEFORE offering to save (NFR-10, CON-3)
    // ------------------------------------------------------------------

    /**
     * Synchronous, free, and only answers "is there an indexedDB object here at
     * all". Use it to decide whether to even render a Save control on first
     * paint; use available() before promising the learner anything.
     */
    function isSupported() {
        return !!environment().indexedDB;
    }

    /**
     * Can this device keep recordings?
     *
     * available()                -> opens the database. Proves IndexedDB is
     *                               present, permitted and upgradable.
     * available({ deep: true })  -> additionally round-trips a 1-byte Blob and
     *                               deletes it again, under the reserved
     *                               PROBE_ID, in a single transaction. This is
     *                               the only way to prove *Blob* storage works,
     *                               which some WebKit builds have got wrong
     *                               independently of IndexedDB itself. It costs
     *                               one tiny write, so do it once when the
     *                               speaking exercise loads, not per render.
     *
     * Both results are cached. Resolves { ok:true, code:'ok' } or
     * { ok:false, code, message } with a learner-facing message — never rejects.
     */
    /**
     * Failure codes that will not change without the learner changing something
     * we cannot see. Everything else — another tab holding the database, a
     * timeout, a full disk — must be retryable without a page reload, so it is
     * deliberately NOT cached.
     */
    const PERMANENT_FAILURES = ['no-indexeddb', 'no-blob', 'no-blob-storage', 'blob-roundtrip-failed'];

    /**
     * The codes openDb() can reject with. They all mean "this device is not
     * keeping recordings right now", which is a different thing from "that
     * recording is not in the store" — see readRecord() (US-219).
     */
    const OPEN_FAILURE_CODES = ['no-indexeddb', 'blocked', 'blocked-by-other-tab', 'timeout'];


    function available(opts) {
        const deep = !!(opts && opts.deep);

        if (deep && deepProbe) return deepProbe;
        if (!deep && capability) return capability;

        const promise = openDb().then(function (db) {
            if (!deep) return { ok: true, code: 'ok', message: null };
            return probeBlobWrite(db);
        }).catch(function (e) {
            logError(e, 'blobstore availability');
            return {
                ok: false,
                code: e && e.code ? e.code : 'unavailable',
                message: (e && e.learnerMessage) || MESSAGES.unavailable
            };
        }).then(function (result) {
            if (!result.ok && PERMANENT_FAILURES.indexOf(result.code) === -1) {
                // Transient: drop the cache so the next ask really re-checks.
                if (deep) { deepProbe = null; } else { capability = null; }
            } else if (deep && result.ok && !capability) {
                // A deep probe that opened the database has already answered
                // the shallow question.
                capability = Promise.resolve({ ok: true, code: 'ok', message: null });
            }
            return result;
        });

        if (deep) {
            deepProbe = promise;
        } else {
            capability = promise;
        }
        return promise;
    }

    function probeBlobWrite(db) {
        let blob;
        try {
            blob = new Blob(['0'], { type: 'application/octet-stream' });
        } catch (e) {
            // No Blob constructor means no MediaRecorder output either.
            return { ok: false, code: 'no-blob', message: MESSAGES.unavailable };
        }

        return runTx(db, [STORE_AUDIO], 'readwrite', function (tx, ctx) {
            const audio = tx.objectStore(STORE_AUDIO);
            const write = ctx.watch(audio.put({ id: PROBE_ID, promptId: '__probe__', blob: blob }));
            write.onsuccess = function () {
                const read = ctx.watch(audio.get(PROBE_ID));
                read.onsuccess = function () {
                    const stored = read.result;
                    const ok = !!(stored && stored.blob && blobSize(stored.blob) === 1);
                    // Deleted inside the same transaction, so a probe never
                    // leaves a row behind even if the page dies mid-way.
                    ctx.watch(audio.delete(PROBE_ID));
                    ctx.resolveWith(ok
                        ? { ok: true, code: 'ok', message: null }
                        : { ok: false, code: 'blob-roundtrip-failed', message: MESSAGES.unavailable });
                };
            };
        }).catch(function (e) {
            logError(e, 'blobstore blob probe');
            return {
                ok: false,
                code: isQuotaError(e) ? 'full' : (isCloneError(e) ? 'no-blob-storage' : 'unavailable'),
                message: isQuotaError(e) ? MESSAGES.full : MESSAGES.unavailable
            };
        });
    }

    // ------------------------------------------------------------------
    // Writing
    // ------------------------------------------------------------------

    /** The record shape handed to callers: metadata only, never the blob. */
    function publicRecord(row) {
        return {
            id: row.id,
            promptId: row.promptId,
            createdAt: row.createdAt,
            size: row.size,
            mimeType: row.mimeType || null,
            durationMs: typeof row.durationMs === 'number' ? row.durationMs : null,
            label: row.label || null,
            baseline: row.baseline === true
        };
    }

    /**
     * Keep a recording for a prompt.
     *
     * @param {string} promptId - Stable identity of the prompt. See the wiring
     *        note: an array index is NOT stable, because inserting content
     *        renumbers it and a learner's month-one recording then belongs to
     *        somebody else's sentence.
     * @param {Blob} blob - MediaRecorder output.
     * @param {Object} [meta] - { durationMs, mimeType, label }. All optional,
     *        all sanitised, all advisory.
     * @returns {Promise<Object>} { ok:true, record, evicted:[id...],
     *          evictedPrompts:[promptId...], evictedElsewhere:[id...], bytes,
     *          count, quotaRetry, message } or { ok:false, code, message }.
     *          Never rejects. `evictedPrompts` names every prompt that lost a
     *          recording, so a caller can say WHICH prompt was affected instead
     *          of assuming it was this one.
     *
     * Codes: 'no-indexeddb' | 'blocked' | 'blocked-by-other-tab' | 'timeout'
     *        (storage unavailable — offer playback-until-navigation instead),
     *        'empty', 'too-large', 'full', 'no-blob-storage', 'write-failed'.
     */
    function put(promptId, blob, meta) {
        const key = normalizePromptId(promptId);
        const size = blobSize(blob);

        // Refusals that need no database at all, so an obviously bad save never
        // opens one.
        if (!key) return Promise.resolve(fail('bad-prompt', MESSAGES.writeFailed));
        if (size === null) return Promise.resolve(fail('bad-blob', MESSAGES.writeFailed));
        if (size === 0) return Promise.resolve(fail('empty', MESSAGES.empty));
        if (size > MAX_RECORDING_BYTES) {
            return Promise.resolve(fail('too-large', MESSAGES.tooLong, { size: size, limit: MAX_RECORDING_BYTES }));
        }
        // There is no second "bigger than the whole archive" check here. It used
        // to sit at this exact spot and could never fire, because
        // MAX_RECORDING_BYTES is defined as at most MAX_TOTAL_BYTES, so the guard
        // above always fires first (US-221). Deleting it rather than reordering
        // the two is deliberate: reordering would report `limit:
        // MAX_TOTAL_BYTES` to a learner whose recording actually broke the 10MB
        // per-recording rule, which is the number they can act on. The invariant
        // that made it dead now lives in the constant itself.

        const row = {
            v: RECORD_VERSION,
            promptId: key,
            // Never null/undefined, whatever _now() is stubbed with: a compound
            // index key containing null is not a valid key, so such a row would
            // be written, counted and evicted while being invisible to list()
            // (US-220). 0 is a real key; "no key" is not.
            createdAt: cleanNumber(now()) || 0,
            size: size,
            mimeType: cleanString(meta && meta.mimeType, 100) || (typeof blob.type === 'string' && blob.type ? blob.type : null),
            durationMs: cleanNumber(meta && meta.durationMs),
            label: cleanString(meta && meta.label, 200)
        };

        return openDb().then(function (db) {
            return commit(db, row, blob).catch(function (e) {
                if (!isQuotaError(e)) throw e;

                // QuotaExceededError. The browser's quota is not our 50MB cap:
                // it is dynamic, shared with every other origin store, and can
                // drop below what we are already holding. Refusing outright
                // would strand the feature while the archive still holds
                // recordings our own policy calls expendable; evicting without
                // limit would let one oversized recording quietly empty the
                // archive. So: free a few multiples of what we need, from the
                // SAME candidate set the documented policy already allows to be
                // deleted (never a prompt's newest, never a pinned baseline),
                // and retry EXACTLY once.
                //
                // The freeing happens INSIDE the retrying transaction, not in a
                // transaction of its own (US-216). That is the whole point: if
                // the retry hits quota again, the abort rolls the eviction back
                // with it, so the `full` refusal below — whose copy promises
                // "your existing recordings are safe" — is telling the truth.
                // An eviction committed separately could not be undone, and on
                // a device that has just proved it has no room the only way to
                // undo it would be to hold the evicted payloads in memory and
                // write them back, which is the one thing such a device cannot
                // be asked to do. Same-transaction eviction needs no memory and
                // no restore.
                //
                // The cost, stated plainly: an engine that does not credit
                // in-transaction deletes against the transaction's own quota
                // will fail the retry that a separate eviction might have let
                // through. commit() already relies on exactly that crediting
                // for the 50MB cap path (deletes are issued before the insert
                // for this reason), and the failure mode is a refusal, never a
                // loss — so a lower retry success rate is the right side to
                // err on.
                //
                // Nothing has been lost at this point — the failed transaction
                // rolled back its own eviction along with its write.
                logError(e, 'blobstore quota on first write');
                return commit(db, row, blob, size * QUOTA_EVICT_FACTOR).then(function (result) {
                    result.quotaRetry = true;
                    return result;
                });
            });
        }).then(function (result) {
            const victims = result.evictedRows || [];
            const here = victims.filter(function (r) { return r.promptId === key; });
            const elsewhere = victims.filter(function (r) { return r.promptId !== key; });
            const affected = [];
            victims.forEach(function (r) {
                if (affected.indexOf(r.promptId) === -1) affected.push(r.promptId);
            });
            return {
                ok: true,
                record: result.record,
                evicted: result.evicted,
                // Every prompt that lost a recording to this write, this one
                // included. A cap or quota eviction takes from OTHER prompts, and
                // a learner told "an in-between one was removed" about the prompt
                // in front of them — which may still hold a single recording — is
                // being told about the wrong prompt (US-218, BR-3).
                evictedPrompts: affected,
                evictedElsewhere: elsewhere.map(function (r) { return r.id; }),
                bytes: result.bytes,
                count: result.count,
                quotaRetry: !!result.quotaRetry,
                message: elsewhere.length
                    ? (here.length ? MESSAGES.savedEvictedAndFreedSpace : MESSAGES.savedFreedSpace)
                    : (here.length ? MESSAGES.savedEvicted : MESSAGES.saved)
            };
        }).catch(function (e) {
            logError(e, 'blobstore put');
            if (isQuotaError(e) || (e && (e.code === 'cap-full' || e.code === 'quota-full'))) {
                return fail('full', MESSAGES.full);
            }
            if (isCloneError(e)) {
                return fail('no-blob-storage', MESSAGES.unavailable);
            }
            if (e && e.code && e.learnerMessage) {
                return fail(e.code, e.learnerMessage);
            }
            return fail('write-failed', MESSAGES.writeFailed);
        });
    }

    /**
     * The whole write, as ONE transaction: read the ledger, decide eviction,
     * delete, insert metadata, insert payload. Commits together or not at all.
     *
     * Deletes are issued BEFORE the insert deliberately, so the engine has the
     * freed pages available for the payload rather than having to grow first.
     *
     * @param {number} [quotaHeadroom] - Extra bytes to free beyond the 50MB
     *        cap's own arithmetic, used ONLY by put()'s one quota retry. Freeing
     *        it here rather than in a transaction of its own is what makes the
     *        retry's failure recoverable: the abort takes the eviction with it.
     *        Partial freeing is accepted (freeing what we can and letting the
     *        engine decide beats refusing because we could not free the full
     *        multiple), but freeing NOTHING refuses before any payload is
     *        written, so a second quota failure is never provoked for nothing.
     */
    function commit(db, row, blob, quotaHeadroom) {
        const headroom = cleanNumber(quotaHeadroom) || 0;
        return runTx(db, [STORE_META, STORE_AUDIO], 'readwrite', function (tx, ctx) {
            const metaStore = tx.objectStore(STORE_META);
            const audioStore = tx.objectStore(STORE_AUDIO);

            // One read of the metadata (no blobs) answers both questions:
            // this prompt's retention, and the archive's byte total.
            const readAll = ctx.watch(metaStore.getAll());
            readAll.onsuccess = function () {
                const all = usableRows(readAll.result);
                const mine = all.filter(function (r) { return r.promptId === row.promptId; }).sort(byAge);

                // The first recording for a prompt is its pinned baseline, and
                // the flag is persisted so later writes do not have to
                // re-derive which row that was.
                row.baseline = PIN_BASELINE && mine.length === 0;

                const projected = mine.concat([{
                    id: NEW_ID, createdAt: row.createdAt, size: row.size, baseline: row.baseline
                }]);
                const retentionVictims = planRetention(projected);

                const remainingBytes = totalBytes(all) - totalBytes(all.filter(function (r) {
                    return retentionVictims.indexOf(r.id) !== -1;
                }));
                const overCap = (remainingBytes + row.size) - MAX_TOTAL_BYTES;
                const spacePlan = planForSpace(all, retentionVictims, overCap);

                if (!spacePlan.ok) {
                    // Refuse. Aborting here means not one byte was deleted, so
                    // "there is no room" costs the learner nothing they had.
                    ctx.refuse(storeError('cap-full', MESSAGES.full));
                    return;
                }

                // The quota retry's extra headroom, from the same expendable set
                // and net of whatever the two plans above already free.
                let quotaVictims = [];
                if (headroom > 0) {
                    const planned = retentionVictims.concat(spacePlan.ids);
                    const alreadyFreed = totalBytes(all.filter(function (r) {
                        return planned.indexOf(r.id) !== -1;
                    }));
                    const stillNeeded = headroom - alreadyFreed;
                    if (stillNeeded > 0) {
                        const quotaPlan = planForSpace(all, planned, stillNeeded);
                        if (quotaPlan.ids.length === 0) {
                            // Nothing expendable left. Refuse before writing
                            // anything, so the retry does not re-provoke the
                            // quota error it cannot do anything about.
                            ctx.refuse(storeError('quota-full', MESSAGES.full));
                            return;
                        }
                        quotaVictims = quotaPlan.ids;
                    }
                }

                const evicted = retentionVictims.concat(spacePlan.ids, quotaVictims);
                evicted.forEach(function (id) {
                    ctx.watch(metaStore.delete(id));
                    ctx.watch(audioStore.delete(id));
                });

                const add = ctx.watch(metaStore.add(row));
                add.onsuccess = function () {
                    const id = add.result;
                    const stored = Object.assign({}, row, { id: id });
                    const payload = ctx.watch(audioStore.put({
                        id: id,
                        promptId: row.promptId,
                        mimeType: row.mimeType,
                        blob: blob
                    }));
                    payload.onsuccess = function () {
                        const evictedSet = Object.create(null);
                        evicted.forEach(function (victimId) { evictedSet[victimId] = true; });
                        const kept = all.filter(function (r) { return !evictedSet[r.id]; });
                        ctx.resolveWith({
                            record: publicRecord(stored),
                            evicted: evicted,
                            // Which prompt each victim belonged to, so put() can
                            // pick copy that names the right one (US-218). Ids
                            // alone cannot answer that once the rows are gone.
                            evictedRows: all.filter(function (r) { return evictedSet[r.id]; })
                                .map(function (r) { return { id: r.id, promptId: r.promptId }; }),
                            bytes: totalBytes(kept) + row.size,
                            count: kept.length + 1
                        });
                    };
                };
            };
        });
    }

    /**
     * Delete a set of ids, metadata and payload together, in one transaction.
     * Resolves with the ids that WERE THERE and are now gone — not the ids it
     * was asked for. IDBObjectStore.delete() succeeds silently on a key that
     * does not exist, so without the read below remove() would confirm deleting
     * a recording that was never in the store (US-217). The read and both
     * deletes share one transaction, so nothing can appear or vanish between
     * asking and acting.
     */
    function removeIds(db, ids) {
        return runTx(db, [STORE_META, STORE_AUDIO], 'readwrite', function (tx, ctx) {
            const metaStore = tx.objectStore(STORE_META);
            const audioStore = tx.objectStore(STORE_AUDIO);
            const removed = [];
            // Resolved with by reference: `removed` is still being filled by the
            // onsuccess handlers below when this runs, and the transaction only
            // commits once they have all fired.
            ctx.resolveWith(removed);
            ids.forEach(function (id) {
                const probe = ctx.watch(metaStore.get(id));
                probe.onsuccess = function () {
                    if (probe.result === undefined || probe.result === null) return;
                    removed.push(id);
                    ctx.watch(metaStore.delete(id));
                    ctx.watch(audioStore.delete(id));
                };
            });
        });
    }

    // ------------------------------------------------------------------
    // Reading
    // ------------------------------------------------------------------

    /**
     * A prompt's recordings, NEWEST FIRST, metadata only — no blobs, so this is
     * cheap enough to call on every render. Resolves [] when storage is
     * unavailable: the caller draws an empty archive and the exercise carries
     * on. Ask available() if you need to tell "none yet" from "cannot".
     */
    function list(promptId) {
        const key = normalizePromptId(promptId);
        if (!key) return Promise.resolve([]);

        return openDb().then(function (db) {
            return runTx(db, [STORE_META], 'readonly', function (tx, ctx) {
                const index = tx.objectStore(STORE_META).index(IDX_PROMPT_TIME);
                // Prefix range over the compound key. Per the IndexedDB key
                // ordering rules an array sorts after every number, and a
                // shorter array sorts before any array it prefixes, so
                // [key] .. [key, []] is exactly this prompt's rows and nothing
                // else. The in-memory sort afterwards is belt and braces: it
                // adds the id tie-break for two recordings in the same
                // millisecond, which the index alone does not guarantee.
                const range = environment().IDBKeyRange.bound([key], [key, []]);
                const req = ctx.watch(index.getAll(range));
                req.onsuccess = function () {
                    const rows = usableRows(req.result).sort(byAge).reverse();
                    ctx.resolveWith(rows.map(publicRecord));
                };
            });
        }).catch(function (e) {
            logError(e, 'blobstore list');
            return [];
        });
    }

    /**
     * One recording, blob included, WITH the reason when there is none.
     *
     * get() flattens the reason away because its documented contract is
     * "record or null", but "this device cannot open its storage at all" and
     * "that recording is not here" are different facts, and openUrl() has to
     * tell a learner which one happened. Reporting "no longer on this device"
     * to somebody whose browser merely blocked IndexedDB tells them their
     * recording was deleted when it was never saveable (US-219, BR-3).
     *
     * @returns {Promise<Object>} { ok:true, record } or { ok:false, code,
     *          message }. Never rejects.
     */
    function readRecord(id) {
        const numericId = Number(id);
        if (!isFinite(numericId)) return Promise.resolve(fail('missing', MESSAGES.missing));

        return openDb().then(function (db) {
            return runTx(db, [STORE_META, STORE_AUDIO], 'readonly', function (tx, ctx) {
                const metaReq = ctx.watch(tx.objectStore(STORE_META).get(numericId));
                metaReq.onsuccess = function () {
                    const rows = usableRows([metaReq.result]);
                    if (rows.length === 0) { ctx.resolveWith(null); return; }
                    const audioReq = ctx.watch(tx.objectStore(STORE_AUDIO).get(numericId));
                    audioReq.onsuccess = function () {
                        const payload = audioReq.result;
                        if (!payload || !payload.blob) { ctx.resolveWith({ orphan: rows[0] }); return; }
                        const out = publicRecord(rows[0]);
                        out.blob = payload.blob;
                        ctx.resolveWith(out);
                    };
                };
            }).then(function (result) {
                if (result && result.orphan) {
                    // A row with no audio can only mislead the UI. Drop it, in
                    // its own transaction, and report "not there" — which for an
                    // orphan is the honest answer.
                    return removeIds(db, [result.orphan.id]).catch(function () {}).then(function () {
                        return fail('missing', MESSAGES.missing);
                    });
                }
                if (!result) return fail('missing', MESSAGES.missing);
                return { ok: true, record: result };
            });
        }).catch(function (e) {
            logError(e, 'blobstore get');
            const code = (e && typeof e.code === 'string') ? e.code : 'read-failed';
            // Only the open() failures mean "this device will not keep
            // recordings"; a failed read means "could not be opened for
            // playback". Neither means "deleted".
            return OPEN_FAILURE_CODES.indexOf(code) !== -1
                ? fail(code, (e && e.learnerMessage) || MESSAGES.unavailable)
                : fail(code, MESSAGES.playbackFailed);
        });
    }

    /**
     * One recording, blob included. null when it is not there — including the
     * case where the metadata row survived but the payload did not, which is
     * repaired (the orphan row is deleted) rather than reported forever, and
     * including the case where storage could not be opened. Callers that need to
     * tell those apart use openUrl(), whose failures carry the code, or ask
     * available().
     */
    function get(id) {
        return readRecord(id).then(function (found) {
            return found.ok ? found.record : null;
        });
    }

    // ------------------------------------------------------------------
    // Object URLs — the revoke contract
    // ------------------------------------------------------------------
    //
    // An object URL pins its Blob in memory until it is revoked (or the
    // document is destroyed). A learner replaying a recording twenty times
    // while comparing month-one against month-three would otherwise pin twenty
    // audio blobs, and on a 3GB Android device (NFR-6) that is the whole
    // session's memory. So the contract is explicit and there are three layers:
    //
    //   1. openUrl() hands back a `revoke()` alongside the url. The CALLER owns
    //      it and must call it — on the audio element's 'ended'/'error', and
    //      whenever the view changes. It is idempotent, so calling it twice, or
    //      after revokeAll(), is safe.
    //   2. Every live url is registered here. revokeAll() releases the lot and
    //      is what a navigation handler should call; clear() and remove() call
    //      it themselves, because a url pointing at a recording the learner has
    //      just deleted is pure leak.
    //   3. MAX_LIVE_URLS is a ceiling. Passing it revokes the OLDEST url first,
    //      on the reasoning that nobody plays eight recordings at once, so an
    //      eighth live url means a caller forgot. This is a net, not a licence
    //      to skip step 1 — if the app ever legitimately needs more than eight
    //      at once, raise the constant rather than remove the net.
    //
    // A page-level 'pagehide' handler calls revokeAll() as a final backstop.

    const liveUrls = [];

    function registerUrl(url) {
        liveUrls.push(url);
        while (liveUrls.length > MAX_LIVE_URLS) {
            revoke(liveUrls[0]);
        }
    }

    /** Release one url. Idempotent, and safe to call on a url we never made. */
    function revoke(url) {
        if (typeof url !== 'string' || !url) return false;
        const at = liveUrls.indexOf(url);
        if (at !== -1) liveUrls.splice(at, 1);
        try {
            if (global.URL && typeof global.URL.revokeObjectURL === 'function') {
                global.URL.revokeObjectURL(url);
            }
        } catch (e) { /* already gone */ }
        return at !== -1;
    }

    /** Release every url this module handed out. Call on navigation. */
    function revokeAll() {
        const count = liveUrls.length;
        while (liveUrls.length) revoke(liveUrls[0]);
        return count;
    }

    function liveUrlCount() {
        return liveUrls.length;
    }

    /**
     * A playable url for a stored recording.
     * @returns {Promise<Object>} { ok:true, url, revoke, record } or
     *          { ok:false, code, message }. The caller MUST call revoke().
     *
     * Codes: 'missing' (really not in the store), 'no-indexeddb' | 'blocked' |
     *        'blocked-by-other-tab' | 'timeout' (storage unavailable — the
     *        recording may never have been saved at all, so the copy says so
     *        rather than claiming a deletion), 'read-failed', 'no-object-url'.
     */
    function openUrl(id) {
        return readRecord(id).then(function (found) {
            if (!found.ok) return fail(found.code, found.message);
            const record = found.record;
            if (!global.URL || typeof global.URL.createObjectURL !== 'function') {
                return fail('no-object-url', MESSAGES.playbackFailed);
            }
            let url;
            try {
                url = global.URL.createObjectURL(record.blob);
            } catch (e) {
                logError(e, 'blobstore createObjectURL');
                return fail('no-object-url', MESSAGES.playbackFailed);
            }
            registerUrl(url);
            const meta = publicRecord(record);
            return {
                ok: true,
                url: url,
                record: meta,
                revoke: function () { return revoke(url); }
            };
        });
    }

    // ------------------------------------------------------------------
    // Deleting
    // ------------------------------------------------------------------

    /**
     * Delete one recording. Learner-initiated, so it is not protected here.
     *
     * An id that is not in the store reports { ok:false, code:'missing' } — the
     * same answer as an unusable id — rather than confirming a deletion that
     * never happened (US-217). A UI acting on a stale list therefore gets told
     * to refresh instead of being told "Recording deleted."
     */
    function remove(id) {
        const numericId = Number(id);
        if (!isFinite(numericId)) return Promise.resolve(fail('missing', MESSAGES.missing));
        return openDb().then(function (db) {
            return removeIds(db, [numericId]);
        }).then(function (ids) {
            if (ids.length === 0) return fail('missing', MESSAGES.missing);
            revokeAll();   // any live url may point at what was just deleted
            return { ok: true, removed: ids.length, message: MESSAGES.removed };
        }).catch(function (e) {
            logError(e, 'blobstore remove');
            return fail('remove-failed', (e && e.learnerMessage) || MESSAGES.removeFailed);
        });
    }

    /** Delete every recording for one prompt. */
    function removeForPrompt(promptId) {
        const key = normalizePromptId(promptId);
        if (!key) return Promise.resolve(fail('bad-prompt', MESSAGES.removeFailed));
        return openDb().then(function (db) {
            return readAllMeta(db).then(function (all) {
                const ids = all.filter(function (r) { return r.promptId === key; })
                               .map(function (r) { return r.id; });
                if (ids.length === 0) return { ok: true, removed: 0, message: MESSAGES.removed };
                return removeIds(db, ids).then(function (gone) {
                    // `gone` rather than `ids`: another tab may have deleted a row
                    // between the ledger read and this transaction, and this
                    // method reports what it removed (US-217).
                    if (gone.length) revokeAll();
                    return { ok: true, removed: gone.length, message: MESSAGES.removed };
                });
            });
        }).catch(function (e) {
            logError(e, 'blobstore removeForPrompt');
            return fail('remove-failed', (e && e.learnerMessage) || MESSAGES.removeFailed);
        });
    }

    /**
     * Delete every recording on this device.
     *
     * Empties the stores rather than deleteDatabase(): a database deletion is
     * blocked by any other tab holding the database open, so it can hang
     * indefinitely, and the schema would have to be rebuilt afterwards.
     * Clearing both stores in one transaction is atomic and cannot be blocked.
     */
    function clear() {
        return openDb().then(function (db) {
            return readAllMeta(db).then(function (all) {
                return runTx(db, [STORE_META, STORE_AUDIO], 'readwrite', function (tx, ctx) {
                    ctx.watch(tx.objectStore(STORE_META).clear());
                    ctx.watch(tx.objectStore(STORE_AUDIO).clear());
                    ctx.resolveWith(all.length);
                });
            });
        }).then(function (removed) {
            revokeAll();
            return { ok: true, removed: removed, message: MESSAGES.cleared };
        }).catch(function (e) {
            logError(e, 'blobstore clear');
            return fail('clear-failed', (e && e.learnerMessage) || MESSAGES.clearFailed);
        });
    }

    // ------------------------------------------------------------------
    // Usage reporting — NFR-10, and the Dashboard's storage line
    // ------------------------------------------------------------------

    /**
     * What the archive is holding. Always resolves; `available:false` with
     * zeroes when storage is unavailable, which is honest and lets the
     * Dashboard say so instead of showing a lie.
     *
     * `estimate` is the BROWSER's view (navigator.storage.estimate), which
     * covers every store this origin uses — Cache API, localStorage,
     * IndexedDB — not just recordings. Reported separately from our own cap for
     * exactly that reason; the two numbers answer different questions.
     */
    function usage() {
        const empty = {
            available: false,
            count: 0,
            bytes: 0,
            promptCount: 0,
            maxPerPrompt: MAX_PER_PROMPT,
            maxTotalBytes: MAX_TOTAL_BYTES,
            percentOfCap: 0,
            estimate: null
        };

        return openDb().then(function (db) {
            return readAllMeta(db);
        }).then(function (all) {
            const prompts = Object.create(null);
            all.forEach(function (r) { prompts[r.promptId] = true; });
            const bytes = totalBytes(all);
            return browserEstimate().then(function (estimate) {
                return {
                    available: true,
                    count: all.length,
                    bytes: bytes,
                    promptCount: Object.keys(prompts).length,
                    maxPerPrompt: MAX_PER_PROMPT,
                    maxTotalBytes: MAX_TOTAL_BYTES,
                    percentOfCap: Math.min(100, Math.round((bytes / MAX_TOTAL_BYTES) * 100)),
                    estimate: estimate
                };
            });
        }).catch(function (e) {
            logError(e, 'blobstore usage');
            return empty;
        });
    }

    function browserEstimate() {
        try {
            const storage = global.navigator && global.navigator.storage;
            if (!storage || typeof storage.estimate !== 'function') return Promise.resolve(null);
            return storage.estimate().then(function (est) {
                return { usage: est && est.usage, quota: est && est.quota };
            }).catch(function () { return null; });
        } catch (e) {
            return Promise.resolve(null);
        }
    }

    /** Per-prompt summary for a "your recordings" screen. Newest prompt first. */
    function prompts() {
        return openDb().then(function (db) {
            return readAllMeta(db);
        }).then(function (all) {
            const byPrompt = Object.create(null);
            all.forEach(function (r) {
                const entry = byPrompt[r.promptId] ||
                    (byPrompt[r.promptId] = { promptId: r.promptId, count: 0, bytes: 0, newestAt: 0, oldestAt: Infinity });
                entry.count += 1;
                entry.bytes += r.size;
                if (r.createdAt > entry.newestAt) entry.newestAt = r.createdAt;
                if (r.createdAt < entry.oldestAt) entry.oldestAt = r.createdAt;
            });
            return Object.keys(byPrompt)
                .map(function (k) { return byPrompt[k]; })
                .sort(function (a, b) { return b.newestAt - a.newestAt; });
        }).catch(function (e) {
            logError(e, 'blobstore prompts');
            return [];
        });
    }

    // ------------------------------------------------------------------
    // Public surface
    // ------------------------------------------------------------------

    const BlobStore = {
        // Policy constants, exposed so the UI and tests reference the policy
        // rather than repeating the numbers (same reason as SRS.DAILY_REVIEW_CAP).
        DB_NAME: DB_NAME,
        DB_VERSION: DB_VERSION,
        MAX_PER_PROMPT: MAX_PER_PROMPT,
        PIN_BASELINE: PIN_BASELINE,
        MAX_TOTAL_BYTES: MAX_TOTAL_BYTES,
        MAX_RECORDING_BYTES: MAX_RECORDING_BYTES,
        MAX_LIVE_URLS: MAX_LIVE_URLS,
        MESSAGES: MESSAGES,

        isSupported: isSupported,
        available: available,

        put: put,
        list: list,
        get: get,
        openUrl: openUrl,
        revoke: revoke,
        revokeAll: revokeAll,
        liveUrlCount: liveUrlCount,
        remove: remove,
        removeForPrompt: removeForPrompt,
        clear: clear,
        usage: usage,
        prompts: prompts,

        // Current time, wrapped so it is easy to stub in tests (as srs.js does).
        _now: function () { return Date.now(); },

        // Test seams. Underscored because nothing in the app may use them.
        _useEnvironment: useEnvironment,
        _planRetention: planRetention,
        _planForSpace: planForSpace,
        _evictionCandidates: evictionCandidates,
        _reset: function () { dbPromise = null; capability = null; deepProbe = null; }
    };

    // Final backstop for object urls: if the learner navigates away mid-replay,
    // release them. Registered once, and additive — it never replaces a
    // caller's own revoke() call, it only catches what was missed.
    try {
        if (global.addEventListener) {
            global.addEventListener('pagehide', function () { revokeAll(); });
        }
    } catch (e) { /* no window (worker, Node) */ }

    global.BlobStore = BlobStore;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = BlobStore;
    }
})(typeof window !== 'undefined' ? window : globalThis);
