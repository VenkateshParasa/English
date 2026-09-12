/**
 * Recording blob store — js/core/blobstore.js
 * ===========================================================================
 *
 * WHY THIS FILE CARRIES A FAKE INDEXEDDB
 * --------------------------------------
 * jsdom implements no IndexedDB at all, and this module is 100% IndexedDB. The
 * module's author left the seam `BlobStore._useEnvironment({ indexedDB,
 * IDBKeyRange })` precisely so a fake can be injected and the REAL retention,
 * eviction, quota and degradation logic exercised — rather than a test that
 * re-implements the policy and then agrees with itself.
 *
 * So the top half of this file is a small IndexedDB. It implements only what
 * blobstore.js actually touches, but it implements those parts to spec:
 *
 *   - spec key ordering (number < date < string < array; a shorter array sorts
 *     before any array it prefixes) — without this, `list()`'s prefix range
 *     `bound([key], [key, []])` is meaningless;
 *   - IDBKeyRange.bound with open/closed bounds;
 *   - inline keyPath + autoIncrement, with ConstraintError on duplicate add,
 *     and the key written into the STORED value, never into the caller's object
 *     (which is what lets the quota-retry path re-add the same `row` twice);
 *   - compound-key createIndex + index.getAll(range), sorted by index key;
 *   - transactions that roll every write back on abort;
 *   - request errors that, when not preventDefault()ed, abort their own
 *     transaction — the behaviour runTx()'s `ctx.watch` deliberately relies on;
 *   - a settable byte budget that throws QuotaExceededError, so the
 *     evict-and-retry path is reachable;
 *   - open() modes: ok / throws / onerror / onblocked / never fires an event.
 *
 * WHAT A FAKE CANNOT PROVE — read this before trusting a green run
 * ---------------------------------------------------------------
 * Re-audited when US-227/US-228 landed. Two entries were wrong in the SAFE
 * direction — they claimed less proof than this suite actually has — which is
 * still misleading, because it points the next reader at the wrong risk.
 *
 *   1. STRUCTURED CLONE OF A REAL BLOB. The fake stores blob references by
 *      identity. `available({deep:true})` exists exactly because some WebKit
 *      builds fail to clone a Blob into IndexedDB while IndexedDB itself works;
 *      a fake that hands the same object back can never reproduce that. The
 *      DataCloneError branches here are driven by a synthetic error, not by a
 *      Blob a real engine refused.
 *   2. REAL PER-ORIGIN QUOTA. The budget below is a counter over blob bytes.
 *      A real quota is dynamic, shared with Cache API + localStorage, can shrink
 *      mid-session, and may be reported at a different granularity. "Freeing 3x
 *      what we need is enough" is untestable here by construction.
 *   3. STORAGE-PRESSURE EVICTION — NARROWED. The *symptom* that matters is
 *      reproduced and proven: a payload disappearing from under its metadata row
 *      is what the orphan tests do (`store.db._store('audio').records.delete`),
 *      and readRecord()'s repair is exercised on it. What is NOT modelled is the
 *      origin being emptied WHOLESALE mid-session — every row, both stores, or
 *      the schema itself gone between two calls. So "a partly-eaten archive" is
 *      covered; "the archive vanished" is not.
 *   4. SAFARI PRIVATE BROWSING. Modelled as "open() throws", which is what it
 *      historically did. Whether today's builds fail the same way is unproven.
 *   5. CROSS-TAB `versionchange` / `blocked`. `onblocked` is fired on command;
 *      no second connection actually exists, so the close-and-reopen handshake
 *      in openDb()'s `db.onversionchange` is exercised only by calling it.
 *   6. TRANSACTION AUTO-COMMIT TIMING — WAS WRONG. This said the hazard "cannot
 *      be reproduced here, so this suite cannot prove the module is free of it".
 *      It can be, and the suite now proves it: the fake commits the moment its
 *      request queue drains and then throws TransactionInactiveError on any
 *      further request, so a single `await` between two requests is already fatal
 *      — see "a transaction commits as soon as its queue drains" in section 0.
 *      What the fake cannot reproduce is a real engine's commit boundary
 *      relative to timers and I/O, i.e. the exact width of the window, and it
 *      can only speak for the paths this suite exercises.
 *   7. WEBKIT'S SILENT open(). Modelled as "fire no event", which is the
 *      observable symptom; the 8s OPEN_TIMEOUT_MS is exercised with fake timers.
 *   8. THE TRUE SIZE OF A STRANDED PAYLOAD (US-228). `strandedBytes` reports the
 *      `size` a metadata row CLAIMS, because measuring the payload means
 *      deserialising every blob in STORE_AUDIO. Here the two always agree,
 *      because the fixtures write both; on a real device a lying or absent
 *      `size` on a foreign row is an under-count nothing in this suite can catch.
 *
 * DEFECTS THIS SUITE FOUND — see the `⚠️ DEFECT` blocks, pinned as current
 * behaviour in the house style of srs.test.js / portability.test.js so the suite
 * stays green and the finding stays visible:
 *
 *   A. FIXED (US-216). put() used to report `full` — whose learner copy is "Your
 *      existing recordings are safe" — AFTER permanently deleting an existing
 *      recording, because the quota path evicted in its OWN transaction
 *      (evictForQuota) and nothing could roll that back when the retry also hit
 *      quota. The retry now frees its headroom inside its own transaction, so
 *      the abort takes the eviction with it. See "quota › FIXED (US-216)".
 *   B. FIXED (US-217). remove(id) used to report
 *      `{ ok:true, removed:1, message:'Recording deleted.' }` for an id that was
 *      never in the store, because `removeIds` resolved with `ids.slice()` — what
 *      it was asked to delete, not what IndexedDB held. It now reads each row in
 *      the deleting transaction and reports `missing` when there was nothing
 *      there.
 *   C. FIXED (US-218). MESSAGES.savedEvicted ("This prompt keeps your first
 *      recording and your two most recent, so an in-between one was removed") was
 *      also used when the evicted row belonged to a DIFFERENT prompt, via the
 *      50MB cap path, because put() picked the message from `evicted.length`
 *      alone. It now picks from WHOSE rows went, and `evictedPrompts` names them.
 *   D. FIXED (US-219). openUrl() on a device with no IndexedDB reported `missing`
 *      — "That recording is no longer on this device" — because get() flattened
 *      unavailability and not-found to the same null. Both now go through
 *      readRecord(), which keeps the reason; get() still returns null.
 *   E. FIXED (US-220). `cleanNumber(null)` was 0, because `Number(null) === 0`, and
 *      usableRows() ran every stored row through it — so a recording saved with no
 *      durationMs was reported as `null` by put() and as `0` by list()/get(): the
 *      same recording, two different answers. cleanNumber() now accepts only
 *      numbers and numeric strings. A row with a null `createdAt` — absent from
 *      IDX_PROMPT_TIME, because a compound key containing null is not a valid key,
 *      yet counted by usage()/prompts() — is now rejected by usableRows() instead
 *      of coerced to the epoch, and put() coerces its own createdAt so it can
 *      never write one.
 *   F. FIXED (US-227). `removeForPrompt()` of a prompt holding nothing reported
 *      `message:'Recording deleted.'`. Resolved as a COPY fix, not a logic fix:
 *      the result stays `{ ok:true, removed:0 }`, because this method names a
 *      STATE that already holds rather than a thing that was not there, and a
 *      `ok:false` for a satisfied request would make a caller paint an error over
 *      a no-op. `MESSAGES.nothingToRemove` says what is true instead. See
 *      "US-227 —" in the remove() section for the argument in full.
 *   G. FIXED (US-228). An unindexable row's bytes were invisible to usage() and
 *      unreachable by eviction, so a device could fill with bytes the module
 *      could see and could not free. Resolved by COUNTING and reporting them —
 *      `usage().strandedCount/strandedBytes`, `clear().strandedRemoved`, and the
 *      50MB cap now computed over them — and by touching them in no other way.
 *      Repair was rejected because rewriting `createdAt` invents a date on what
 *      may be a learner's month-one recording; deletion was rejected under BR-7.
 *      See the "US-228" describe block.
 *
 * Also once pinned here, now fixed: the `size > MAX_TOTAL_BYTES` guard in put() was
 * unreachable (the 10MB per-recording check always fired first) and has been removed
 * in favour of clamping MAX_RECORDING_BYTES to MAX_TOTAL_BYTES (US-221); and
 * planRetention()/evictionCandidates() disagreed about which row counted as a
 * baseline once the real one was deleted, and now share isPinnedBaseline() (US-222).
 *
 * WITHDRAWN, and worth knowing why: this block used to call the
 * `if (keep[row.id]) return;` guard in planRetention "only defensive… the early
 * return at the top makes a revisit impossible". That is false. When the flagged
 * baseline is not the OLDEST row — a clock corrected backwards after the first
 * recording, or a foreign row — the forward pass keeps it and the backward pass
 * walks over it again, and without the guard the revisit would spend a second
 * retention slot on one row and evict one recording more than the cap asks for.
 * Pinned by "the `keep[row.id]` guard is load-bearing, not defensive".
 *
 * Requirements under test: FR-DATA-6 (blobs in IndexedDB, size cap, eviction),
 * NFR-10 (quota handled with a clear message, never silent data loss),
 * BR-3 (never overstate what the app knows), BR-7 (learner data never silently
 * lost), CURRICULUM.md Strand E.7 (hear month-one against month-three).
 */

'use strict';

const fs = require('fs');
const pathMod = require('path');

const BlobStore = require('../../js/core/blobstore.js');

const MODULE_PATH = pathMod.resolve(__dirname, '../../js/core/blobstore.js');

// Captured before beforeEach replaces it, so the real default is still testable.
const REAL_NOW = BlobStore._now;

const MB = 1024 * 1024;

// ===========================================================================
// The fake IndexedDB
// ===========================================================================

function domError(name, message) {
    const e = new Error(message || name);
    e.name = name;
    return e;
}

/**
 * IndexedDB key ordering, per spec §key-construct: number < date < string <
 * binary < array; arrays compare element-wise and a shorter array that is a
 * prefix of a longer one sorts first. `list()` depends on this being right:
 * `bound([key], [key, []])` only isolates one prompt because every number sorts
 * before every array, so `[key, <any createdAt>]` < `[key, []]`.
 */
function keyRank(k) {
    if (Array.isArray(k)) return 4;
    if (typeof k === 'number') return 1;
    if (k instanceof Date) return 2;
    if (typeof k === 'string') return 3;
    return 0;
}

function compareKeys(a, b) {
    const ra = keyRank(a);
    const rb = keyRank(b);
    if (ra !== rb) return ra < rb ? -1 : 1;
    if (ra === 4) {
        const n = Math.min(a.length, b.length);
        for (let i = 0; i < n; i++) {
            const c = compareKeys(a[i], b[i]);
            if (c !== 0) return c;
        }
        if (a.length === b.length) return 0;
        return a.length < b.length ? -1 : 1;
    }
    if (ra === 2) return a.getTime() - b.getTime();
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

class FakeKeyRange {
    constructor(lower, upper, lowerOpen, upperOpen) {
        this.lower = lower;
        this.upper = upper;
        this.lowerOpen = !!lowerOpen;
        this.upperOpen = !!upperOpen;
    }
    includes(key) {
        if (this.lower !== undefined) {
            const c = compareKeys(key, this.lower);
            if (c < 0 || (c === 0 && this.lowerOpen)) return false;
        }
        if (this.upper !== undefined) {
            const c = compareKeys(key, this.upper);
            if (c > 0 || (c === 0 && this.upperOpen)) return false;
        }
        return true;
    }
    static bound(lower, upper, lowerOpen, upperOpen) {
        if (lower === undefined || upper === undefined) throw domError('DataError');
        if (compareKeys(lower, upper) > 0) throw domError('DataError');
        return new FakeKeyRange(lower, upper, lowerOpen, upperOpen);
    }
    static only(value) { return new FakeKeyRange(value, value, false, false); }
    static lowerBound(v, open) { return new FakeKeyRange(v, undefined, open, false); }
    static upperBound(v, open) { return new FakeKeyRange(undefined, v, false, open); }
}

/** Blob-shaped things pass by reference; everything else is copied, as a
 *  structured clone would be (see caveat 1 in the header). */
function isBlobLike(v) {
    return !!v && typeof v === 'object' &&
        typeof v.size === 'number' && typeof v.type === 'string' &&
        typeof v.promptId === 'undefined';
}

function cloneValue(v) {
    if (Array.isArray(v)) return v.map(cloneValue);
    if (v && typeof v === 'object') {
        if (isBlobLike(v)) return v;
        if (v instanceof Date) return new Date(v.getTime());
        const out = {};
        Object.keys(v).forEach((k) => { out[k] = cloneValue(v[k]); });
        return out;
    }
    return v;
}

/** Only blob payload bytes count against the fake budget; metadata rows are
 *  free. That keeps the quota arithmetic in the tests readable. */
function bytesOf(value) {
    if (value && value.blob && typeof value.blob.size === 'number') return value.blob.size;
    return 0;
}

class FakeObjectStore {
    constructor(db, name, options) {
        this.db = db;
        this.name = name;
        this.keyPath = (options && options.keyPath) || null;
        this.autoIncrement = !!(options && options.autoIncrement);
        this.nextKey = 1;
        this.records = new Map();      // key -> { value, bytes }
        this.indexes = new Map();
    }

    createIndex(name, keyPath, options) {
        const idx = { name: name, keyPath: keyPath, unique: !!(options && options.unique) };
        this.indexes.set(name, idx);
        return idx;
    }

    _write(key, value) {
        const factory = this.db.factory;
        // Models an engine that accepts the write but loses the Blob — the exact
        // WebKit failure available({deep:true}) exists to detect.
        if (factory.dropBlobs && value && value.blob) value.blob = null;
        const incoming = bytesOf(value);
        const existing = this.records.has(key) ? this.records.get(key).bytes : 0;
        const used = this.db._usedBytes();
        if (used - existing + incoming > factory.budget) {
            throw domError('QuotaExceededError', 'The quota has been exceeded.');
        }
        this.records.set(key, { value: value, bytes: incoming });
    }
}

class FakeRequest {
    constructor(source, tx) {
        this.source = source;
        this.transaction = tx;
        this.result = undefined;
        this.error = null;
        this.onsuccess = null;
        this.onerror = null;
    }
}

class FakeStoreHandle {
    constructor(tx, store) {
        this.tx = tx;
        this.store = store;
        this.name = store.name;
    }

    _readonlyGuard() {
        if (this.tx.mode !== 'readwrite' && this.tx.mode !== 'versionchange') {
            throw domError('ReadOnlyError');
        }
    }

    index(name) {
        const idx = this.store.indexes.get(name);
        if (!idx) throw domError('NotFoundError');
        return new FakeIndexHandle(this.tx, this.store, idx);
    }

    get(key) {
        return this.tx._enqueue(this.store, 'get', key, () => {
            const hit = this.store.records.get(key);
            return hit ? cloneValue(hit.value) : undefined;
        });
    }

    getAll() {
        return this.tx._enqueue(this.store, 'getAll', null, () => {
            return Array.from(this.store.records.keys())
                .sort(compareKeys)
                .map((k) => cloneValue(this.store.records.get(k).value));
        });
    }

    add(value) {
        this._readonlyGuard();
        return this.tx._enqueue(this.store, 'add', null, () => {
            const rec = cloneValue(value);
            let key = this.store.keyPath ? rec[this.store.keyPath] : undefined;
            if (key === undefined || key === null) {
                if (!this.store.autoIncrement) throw domError('DataError');
                key = this.store.nextKey;
                this.store.nextKey += 1;
                if (this.store.keyPath) rec[this.store.keyPath] = key;
            } else if (this.store.autoIncrement && typeof key === 'number' && key >= this.store.nextKey) {
                this.store.nextKey = Math.floor(key) + 1;
            }
            if (this.store.records.has(key)) throw domError('ConstraintError');
            this.store._write(key, rec);
            return key;
        });
    }

    put(value) {
        this._readonlyGuard();
        return this.tx._enqueue(this.store, 'put', null, () => {
            const rec = cloneValue(value);
            let key = this.store.keyPath ? rec[this.store.keyPath] : undefined;
            if (key === undefined || key === null) {
                if (!this.store.autoIncrement) throw domError('DataError');
                key = this.store.nextKey;
                this.store.nextKey += 1;
                if (this.store.keyPath) rec[this.store.keyPath] = key;
            }
            this.store._write(key, rec);
            return key;
        });
    }

    delete(key) {
        this._readonlyGuard();
        return this.tx._enqueue(this.store, 'delete', key, () => {
            this.store.records.delete(key);
            return undefined;
        });
    }

    clear() {
        this._readonlyGuard();
        return this.tx._enqueue(this.store, 'clear', null, () => {
            this.store.records.clear();
            return undefined;
        });
    }
}

class FakeIndexHandle {
    constructor(tx, store, idx) {
        this.tx = tx;
        this.store = store;
        this.idx = idx;
        this.name = idx.name;
    }

    _keyFor(value) {
        const paths = Array.isArray(this.idx.keyPath) ? this.idx.keyPath : [this.idx.keyPath];
        const parts = [];
        for (let i = 0; i < paths.length; i++) {
            const v = value[paths[i]];
            if (v === undefined || v === null) return undefined;   // row not in the index
            parts.push(v);
        }
        return Array.isArray(this.idx.keyPath) ? parts : parts[0];
    }

    getAll(range) {
        return this.tx._enqueue(this.store, 'index.getAll', null, () => {
            const hits = [];
            this.store.records.forEach((entry) => {
                const k = this._keyFor(entry.value);
                if (k === undefined) return;
                if (range && typeof range.includes === 'function' && !range.includes(k)) return;
                hits.push({ k: k, value: entry.value });
            });
            hits.sort((a, b) => compareKeys(a.k, b.k));
            return hits.map((h) => cloneValue(h.value));
        });
    }
}

class FakeTransaction {
    constructor(db, names, mode) {
        this.db = db;
        this.mode = mode;
        this.names = names;
        this.error = null;
        this.oncomplete = null;
        this.onabort = null;
        this.onerror = null;

        this._queue = [];
        this._finished = false;
        this._scheduled = false;

        // Rollback support: the fake writes live and restores on abort.
        this._snapshots = new Map();
        names.forEach((n) => {
            const s = db._store(n);
            this._snapshots.set(n, { records: new Map(s.records), nextKey: s.nextKey });
        });

        db.factory.txCount += 1;
    }

    objectStore(name) {
        if (this.names.indexOf(name) === -1) throw domError('NotFoundError');
        if (this._finished) throw domError('TransactionInactiveError');
        return new FakeStoreHandle(this, this.db._store(name));
    }

    abort() {
        if (this._finished) throw domError('InvalidStateError');
        this._abort(domError('AbortError'), false);
    }

    _enqueue(store, op, key, run) {
        if (this._finished) throw domError('TransactionInactiveError');
        const req = new FakeRequest(store, this);
        this.db.factory.ops.push({ store: store.name, op: op, key: key });
        this._queue.push({ req: req, run: run, store: store.name, op: op, key: key });
        this._schedule();
        return req;
    }

    _schedule() {
        if (this._scheduled) return;
        this._scheduled = true;
        Promise.resolve().then(() => {
            this._scheduled = false;
            this._drain();
        });
    }

    _drain() {
        let guard = 0;
        while (!this._finished && this._queue.length) {
            if (++guard > 5000) throw new Error('fake IndexedDB: runaway request queue');
            const entry = this._queue.shift();
            this._execute(entry);
        }
        if (!this._finished) this._commit();
    }

    _execute(entry) {
        const req = entry.req;
        let value;
        let err = null;

        // Per-operation error injection: DataCloneError on the payload, a generic
        // request failure, etc. `errorHook(store, op, key)` returns an Error or null.
        const hook = this.db.factory.errorHook;
        if (typeof hook === 'function') {
            err = hook(entry.store, entry.op, entry.key) || null;
        }

        if (!err) {
            try {
                value = entry.run();
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            req.error = err;
            let prevented = false;
            const ev = {
                target: req,
                type: 'error',
                preventDefault: function () { prevented = true; },
                stopPropagation: function () {}
            };
            if (typeof req.onerror === 'function') {
                try { req.onerror(ev); } catch (e2) { /* a throwing handler still aborts */ }
            }
            // Real IndexedDB: an unhandled request error aborts the transaction.
            if (!prevented) this._abort(err, true);
            return;
        }

        req.result = value;
        if (typeof req.onsuccess === 'function') {
            try {
                req.onsuccess({ target: req, type: 'success' });
            } catch (e3) {
                this._abort(e3, true);
            }
        }
    }

    _commit() {
        this._finished = true;
        const fn = this.oncomplete;
        Promise.resolve().then(() => { if (typeof fn === 'function') fn({ type: 'complete' }); });
    }

    _abort(err, fromRequest) {
        if (this._finished) return;
        this._finished = true;
        this._queue.length = 0;
        this._snapshots.forEach((snap, name) => {
            const s = this.db._store(name);
            s.records = new Map(snap.records);
            s.nextKey = snap.nextKey;
        });
        this.error = err || domError('AbortError');
        const onError = this.onerror;
        const onAbort = this.onabort;
        Promise.resolve().then(() => {
            // Real order for a failed request: request error -> tx error -> tx abort.
            if (fromRequest && typeof onError === 'function') onError({ type: 'error' });
            if (typeof onAbort === 'function') onAbort({ type: 'abort' });
        });
    }
}

class FakeDatabase {
    constructor(factory, name) {
        this.factory = factory;
        this.name = name;
        this.version = 0;
        this.stores = new Map();
        this.onversionchange = null;
        this.onclose = null;
        this._closed = false;
    }

    get objectStoreNames() {
        const names = Array.from(this.stores.keys());
        names.contains = (n) => names.indexOf(n) !== -1;
        return names;
    }

    _store(name) {
        const s = this.stores.get(name);
        if (!s) throw domError('NotFoundError');
        return s;
    }

    _usedBytes() {
        let sum = 0;
        this.stores.forEach((s) => { s.records.forEach((e) => { sum += e.bytes; }); });
        return sum;
    }

    createObjectStore(name, options) {
        const s = new FakeObjectStore(this, name, options);
        this.stores.set(name, s);
        return s;
    }

    transaction(names, mode) {
        if (this.factory.txThrows) throw domError(this.factory.txThrows);
        if (this._closed) throw domError('InvalidStateError');
        const list = typeof names === 'string' ? [names] : Array.prototype.slice.call(names);
        list.forEach((n) => { if (!this.stores.has(n)) throw domError('NotFoundError'); });
        return new FakeTransaction(this, list, mode || 'readonly');
    }

    close() { this._closed = true; }
}

/**
 * @param {Object} [opts]
 *   openMode: 'ok' | 'throw' | 'error' | 'blocked' | 'silent'
 *   budget:   bytes of blob payload the whole database may hold
 */
class FakeIndexedDB {
    constructor(opts) {
        const o = opts || {};
        this.openMode = o.openMode || 'ok';
        this.budget = typeof o.budget === 'number' ? o.budget : Infinity;
        this.txThrows = o.txThrows || null;
        this.errorHook = o.errorHook || null;
        this.dropBlobs = !!o.dropBlobs;
        this.extraErrorAfterSuccess = !!o.extraErrorAfterSuccess;
        this.openCount = 0;
        this.txCount = 0;
        this.ops = [];
        this.db = null;
        this.schemaThrows = !!o.schemaThrows;
    }

    open(name, version) {
        this.openCount += 1;
        if (this.openMode === 'throw') throw domError('InvalidStateError', 'private browsing');

        const req = new FakeRequest(null, null);
        req.onupgradeneeded = null;
        req.onblocked = null;

        const mode = this.openMode;
        Promise.resolve().then(() => {
            if (mode === 'silent') return;                 // WebKit: no event, ever
            if (mode === 'blocked') {
                if (typeof req.onblocked === 'function') req.onblocked({ type: 'blocked' });
                return;
            }
            if (mode === 'error') {
                req.error = domError('UnknownError', 'open failed');
                if (typeof req.onerror === 'function') req.onerror({ type: 'error', target: req });
                return;
            }

            if (!this.db) this.db = new FakeDatabase(this, name);
            const db = this.db;
            db._closed = false;
            req.result = db;

            const oldVersion = db.version;
            if (version > db.version) {
                // A versionchange transaction, so a throwing upgrade can abort it.
                const upgradeTx = new FakeTransaction(db, [], 'versionchange');
                req.transaction = upgradeTx;
                let aborted = false;
                upgradeTx.abort = function () { aborted = true; };
                db.version = version;
                if (this.schemaThrows) {
                    // Simulate createObjectStore blowing up inside onupgradeneeded.
                    const realCreate = db.createObjectStore.bind(db);
                    db.createObjectStore = function () { throw domError('InvalidStateError'); };
                    if (typeof req.onupgradeneeded === 'function') {
                        req.onupgradeneeded({ type: 'upgradeneeded', oldVersion: oldVersion, target: req });
                    }
                    db.createObjectStore = realCreate;
                } else if (typeof req.onupgradeneeded === 'function') {
                    req.onupgradeneeded({ type: 'upgradeneeded', oldVersion: oldVersion, target: req });
                }
                if (aborted) {
                    db.version = oldVersion;
                    db.stores.clear();
                    req.error = domError('AbortError');
                    if (typeof req.onerror === 'function') req.onerror({ type: 'error', target: req });
                    return;
                }
            }
            if (typeof req.onsuccess === 'function') req.onsuccess({ type: 'success', target: req });
            if (this.extraErrorAfterSuccess) {
                // A misbehaving engine firing a second event on an already-settled
                // request. openDb()'s `settled` latch has to absorb it.
                req.error = domError('UnknownError', 'late error');
                if (typeof req.onerror === 'function') req.onerror({ type: 'error', target: req });
                if (typeof req.onblocked === 'function') req.onblocked({ type: 'blocked' });
            }
        });

        return req;
    }

    // ---- test-side inspection -------------------------------------------
    metaRows() {
        if (!this.db || !this.db.stores.has('recordings')) return [];
        return Array.from(this.db.stores.get('recordings').records.values())
            .map((e) => e.value)
            .sort((a, b) => a.id - b.id);
    }
    /** Write straight into the store, bypassing put() — for rows put() would
     *  never produce (garbage, the reserved PROBE_ID, an over-cap archive). */
    seedMeta(rows) {
        const s = this.db._store('recordings');
        rows.forEach((r) => {
            s.records.set(r.id, { value: r, bytes: 0 });
            if (typeof r.id === 'number' && r.id >= s.nextKey) s.nextKey = Math.floor(r.id) + 1;
        });
    }
    seedAudio(entries) {
        const s = this.db._store('audio');
        entries.forEach((e) => { s.records.set(e.id, { value: e, bytes: bytesOf(e) }); });
    }
    audioIds() {
        if (!this.db || !this.db.stores.has('audio')) return [];
        return Array.from(this.db.stores.get('audio').records.keys()).sort((a, b) => a - b);
    }
    ids() { return this.metaRows().map((r) => r.id); }
    usedBytes() { return this.db ? this.db._usedBytes() : 0; }
    opsOn(storeName, op) {
        return this.ops.filter((o) => o.store === storeName && (!op || o.op === op));
    }
}

// ===========================================================================
// Fixtures / helpers
// ===========================================================================

/**
 * A stand-in for MediaRecorder output. blobSize() in the module is deliberately
 * duck-typed (`instanceof Blob` is false across realms), so a plain
 * { size, type } is a legitimate input and lets us fabricate 9MB "recordings"
 * without allocating 9MB.
 */
const fakeBlob = (size, type) => ({ size: size, type: type || 'audio/webm;codecs=opus' });

let store;   // the injected FakeIndexedDB for the current test

function install(opts) {
    store = new FakeIndexedDB(opts);
    BlobStore._useEnvironment({ indexedDB: store, IDBKeyRange: FakeKeyRange });
    return store;
}

let clock = 1000;
const at = (t) => { clock = t; };

/** put() with an explicit createdAt, so age order is never accidental. */
function putAt(promptId, size, createdAt, meta) {
    at(createdAt);
    return BlobStore.put(promptId, fakeBlob(size), meta);
}

let createdUrls;
let revokedUrls;
let logged;     // every logError() call, so failures are asserted not just silent

beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];
    logged = [];
    // logError() prefers AppErrorHandler over console.warn. Routing to a spy
    // both exercises that branch and keeps the suite's output readable.
    global.AppErrorHandler = {
        logError: (e, context) => { logged.push({ error: e, context: context }); }
    };

    let n = 0;
    // jsdom implements neither of these.
    global.URL.createObjectURL = jest.fn(() => {
        const url = 'blob:fake/' + (++n);
        createdUrls.push(url);
        return url;
    });
    global.URL.revokeObjectURL = jest.fn((url) => { revokedUrls.push(url); });

    clock = 1000;
    BlobStore._now = () => clock;

    // liveUrls is module-level and survives _useEnvironment / _reset.
    BlobStore.revokeAll();
    revokedUrls = [];

    install();
});

afterEach(() => {
    BlobStore.revokeAll();
    BlobStore._useEnvironment(null);
    delete global.AppErrorHandler;
    jest.useRealTimers();
});

const loggedContexts = () => logged.map((l) => l.context);

// ===========================================================================
// 0. The fake itself. If these are wrong, nothing below means anything.
// ===========================================================================

describe('the fake IndexedDB honours the parts of the spec this module leans on', () => {
    test('key ordering: every number sorts before every array, and a prefix sorts first', () => {
        expect(compareKeys(1, 2)).toBeLessThan(0);
        expect(compareKeys('a', 'b')).toBeLessThan(0);
        expect(compareKeys(9e15, [])).toBeLessThan(0);        // number < array
        expect(compareKeys(['p'], ['p', 0])).toBeLessThan(0); // prefix first
        expect(compareKeys(['p', 5], ['p', []])).toBeLessThan(0);
        expect(compareKeys(['p', 5], ['p', 4])).toBeGreaterThan(0);
        expect(compareKeys(['p'], ['p'])).toBe(0);
    });

    test("bound([k],[k,[]]) is exactly one prompt's rows — the range list() relies on", () => {
        const range = FakeKeyRange.bound(['p1'], ['p1', []]);
        expect(range.includes(['p1'])).toBe(true);
        expect(range.includes(['p1', 0])).toBe(true);
        expect(range.includes(['p1', Number.MAX_SAFE_INTEGER])).toBe(true);
        expect(range.includes(['p10', 5])).toBe(false);
        expect(range.includes(['p0', 5])).toBe(false);
        expect(range.includes(['p2', 5])).toBe(false);
    });

    test('a request error rolls the whole transaction back', async () => {
        await BlobStore.available();
        const db = store.db;
        const tx = db.transaction(['recordings'], 'readwrite');
        const s = tx.objectStore('recordings');
        s.add({ promptId: 'a', createdAt: 1, size: 1 });
        const dup = s.add({ id: 1, promptId: 'b', createdAt: 2, size: 1 });  // ConstraintError
        const outcome = await new Promise((resolve) => {
            tx.oncomplete = () => resolve('complete');
            tx.onabort = () => resolve('abort');
        });
        expect(outcome).toBe('abort');
        expect(dup.error.name).toBe('ConstraintError');
        expect(store.metaRows()).toEqual([]);   // the first add rolled back too
    });

    test('the byte budget throws QuotaExceededError and frees on delete', async () => {
        await BlobStore.available();
        store.budget = 10;
        const write = (id, size) => new Promise((resolve) => {
            const tx = store.db.transaction(['audio'], 'readwrite');
            const req = tx.objectStore('audio').put({ id: id, blob: fakeBlob(size) });
            tx.oncomplete = () => resolve(req.error);
            tx.onabort = () => resolve(req.error);
        });
        expect(await write(1, 8)).toBe(null);
        expect((await write(2, 8)).name).toBe('QuotaExceededError');
        expect(store.usedBytes()).toBe(8);   // the second write rolled back

        // Deleting frees the budget again.
        await new Promise((resolve) => {
            const tx = store.db.transaction(['audio'], 'readwrite');
            tx.objectStore('audio').delete(1);
            tx.oncomplete = resolve;
        });
        expect(store.usedBytes()).toBe(0);
        expect(await write(3, 9)).toBe(null);
    });

    /**
     * Caveat 6 used to say the auto-commit hazard "cannot be reproduced here".
     * It can: the fake commits the moment its request queue drains and then
     * refuses further work, so ONE await between two requests is already fatal.
     * What the fake cannot reproduce is a real engine's commit boundary relative
     * to timers and I/O — not the hazard itself.
     */
    test('a transaction commits as soon as its queue drains, so awaiting mid-transaction is fatal here too', async () => {
        await BlobStore.available();
        const tx = store.db.transaction(['recordings'], 'readwrite');
        const outcome = new Promise((resolve) => {
            tx.oncomplete = () => resolve('complete');
            tx.onabort = () => resolve('abort');
        });
        tx.objectStore('recordings').add({ promptId: 'a', createdAt: 1, size: 1 });

        await Promise.resolve();      // exactly what runTx() forbids its work() from doing

        let caught = null;
        try { tx.objectStore('recordings'); } catch (e) { caught = e; }
        expect(caught && caught.name).toBe('TransactionInactiveError');
        expect(await outcome).toBe('complete');
        expect(store.ids()).toEqual([1]);
    });
});

// ===========================================================================
// 1. Retention is pinned-baseline, not a ring buffer (FR-DATA-6 / Strand E.7)
// ===========================================================================

describe('retention: the pure planner', () => {
    const row = (id, createdAt, over) => Object.assign({
        id: id, promptId: 'p', createdAt: createdAt, size: 100, baseline: false
    }, over);

    test('under the cap nothing is evicted', () => {
        expect(BlobStore._planRetention([row(1, 1), row(2, 2)])).toEqual([]);
        expect(BlobStore._planRetention([row(1, 1), row(2, 2), row(3, 3)])).toEqual([]);
    });

    test('the FOURTH recording evicts the SECOND, not the first', () => {
        const projected = [
            row(1, 100, { baseline: true }),
            row(2, 200),
            row(3, 300),
            row(Infinity, 400)          // the row being written
        ];
        expect(BlobStore._planRetention(projected)).toEqual([2]);
    });

    test('the pinned baseline survives an arbitrary number of later recordings', () => {
        let rows = [row(1, 100, { baseline: true })];
        for (let i = 2; i <= 12; i++) {
            const projected = rows.concat([row(Infinity, i * 100)]);
            const victims = BlobStore._planRetention(projected);
            rows = rows.filter((r) => victims.indexOf(r.id) === -1).concat([row(i, i * 100)]);
            expect(rows.map((r) => r.id)).toContain(1);
            expect(rows.length).toBeLessThanOrEqual(BlobStore.MAX_PER_PROMPT);
        }
        // After twelve tries: month one, plus the last two.
        expect(rows.map((r) => r.id)).toEqual([1, 11, 12]);
    });

    test('the new row is never itself a victim, even sharing a millisecond with the oldest', () => {
        const projected = [row(1, 500, { baseline: true }), row(2, 500), row(3, 500), row(Infinity, 500)];
        const victims = BlobStore._planRetention(projected);
        expect(victims).not.toContain(Infinity);
        // NEW_ID = +Infinity so byAge sorts the new row LAST on a tie: the real
        // oldest is pinned and the middle one goes.
        expect(victims).toEqual([2]);
    });

    test('ties are broken by id, so eviction is a total order', () => {
        const projected = [row(5, 1), row(3, 1, { baseline: true }), row(4, 1), row(Infinity, 1)];
        // Oldest by (createdAt, id) is 3 — and it is the flagged baseline;
        // newest kept are 5 and the new row.
        expect(BlobStore._planRetention(projected)).toEqual([4]);
    });

    test('the `keep[row.id]` guard is load-bearing, not defensive', () => {
        // The header used to call this guard unreachable. It is reachable whenever
        // the flagged baseline is NOT the oldest row — a clock corrected backwards
        // after the first recording, or a foreign row — because the forward pass
        // keeps it and the backward pass then walks over it again. Without the
        // guard that revisit spends a second slot on the same row and evicts one
        // more recording than the cap asks for.
        const projected = [row(2, 100), row(3, 200), row(4, 300), row(9, 400, { baseline: true })];
        expect(BlobStore._planRetention(projected)).toEqual([2]);
        // Three rows kept, as MAX_PER_PROMPT says: 9, 4 and 3. Drop the guard and
        // the answer becomes [2, 3] — only two kept.
        expect(BlobStore.MAX_PER_PROMPT).toBe(3);
    });

    test('US-222 — planRetention and evictionCandidates agree on which row is the baseline', () => {
        // The disagreement: planRetention used to pin `ordered[0]` (the oldest
        // row it could see) while evictionCandidates protected the persisted
        // `baseline` flag. After a learner deletes their real baseline, those are
        // different rows, and the same row was "protected" by one function and
        // "expendable" by the other.
        const afterBaselineDeleted = [
            row(2, 200),                 // oldest SURVIVING row, not the baseline
            row(3, 300),
            row(4, 400)
        ];
        const projected = afterBaselineDeleted.concat([row(Infinity, 500)]);

        // Both now answer from isPinnedBaseline(): nothing here is pinned, so the
        // oldest surviving row is expendable to BOTH.
        expect(BlobStore._planRetention(projected)).toEqual([2]);
        expect(BlobStore._evictionCandidates(afterBaselineDeleted, []).map((r) => r.id))
            .toEqual([2, 3]);            // everything but the prompt's newest

        // And with the flag present, both protect the same row.
        const withBaseline = [row(1, 100, { baseline: true }), row(2, 200), row(3, 300)];
        expect(BlobStore._planRetention(withBaseline.concat([row(Infinity, 400)]))).toEqual([2]);
        expect(BlobStore._evictionCandidates(withBaseline, []).map((r) => r.id)).toEqual([2]);
    });

    test('US-222 end to end — deleting the baseline does not leave a half-protected row', async () => {
        const base = await putAt('p1', 100, 100);
        const second = await putAt('p1', 100, 200);
        const third = await putAt('p1', 100, 300);
        expect((await BlobStore.remove(base.record.id)).ok).toBe(true);

        // p1 now holds [second, third] and no flagged baseline. A fourth
        // recording rolls the oldest surviving row out, and a cap eviction would
        // have picked exactly the same row — one answer, not two.
        const fourth = await putAt('p1', 100, 400);
        const fifth = await putAt('p1', 100, 500);
        expect(fourth.evicted).toEqual([]);
        expect(fifth.evicted).toEqual([second.record.id]);
        expect(store.ids()).toEqual([third.record.id, fourth.record.id, fifth.record.id]);
        // No later recording is silently promoted to "your first try".
        expect((await BlobStore.list('p1')).every((r) => r.baseline === false)).toBe(true);
    });
});

describe('retention: end to end through IndexedDB', () => {
    test('four recordings at one prompt leave the baseline and the two newest', async () => {
        const r1 = await putAt('p1', 1000, 100);
        const r2 = await putAt('p1', 1000, 200);
        const r3 = await putAt('p1', 1000, 300);
        expect([r1.ok, r2.ok, r3.ok]).toEqual([true, true, true]);
        expect(r1.record.baseline).toBe(true);
        expect(r2.record.baseline).toBe(false);

        const r4 = await putAt('p1', 1000, 400);
        expect(r4.ok).toBe(true);
        expect(r4.evicted).toEqual([r2.record.id]);
        expect(r4.message).toBe(BlobStore.MESSAGES.savedEvicted);

        expect(store.ids()).toEqual([r1.record.id, r3.record.id, r4.record.id]);
        // The payload went with the metadata row, in the same transaction.
        expect(store.audioIds()).toEqual([r1.record.id, r3.record.id, r4.record.id]);
    });

    test("month-one is still playable after a dozen attempts — E.7's stated motivator", async () => {
        const first = await putAt('p1', 500, 100);
        for (let i = 2; i <= 12; i++) await putAt('p1', 500, i * 100);

        const rows = await BlobStore.list('p1');
        expect(rows.map((r) => r.createdAt)).toEqual([1200, 1100, 100]);  // newest first
        expect(rows[2].id).toBe(first.record.id);
        expect(rows[2].baseline).toBe(true);

        const got = await BlobStore.get(first.record.id);
        expect(got).not.toBeNull();
        expect(got.blob.size).toBe(500);
    });

    test('the baseline flag is persisted, not re-derived per write', async () => {
        await putAt('p1', 100, 100);
        await putAt('p1', 100, 200);
        const flags = store.metaRows().map((r) => r.baseline);
        expect(flags).toEqual([true, false]);
    });

    test('retention is per prompt: recording at p2 never touches p1', async () => {
        for (let i = 1; i <= 4; i++) await putAt('p1', 100, i * 100);
        const before = store.ids();
        for (let i = 1; i <= 4; i++) await putAt('p2', 100, 1000 + i * 100);

        const p1 = await BlobStore.list('p1');
        expect(p1).toHaveLength(3);
        expect(before.every((id) => store.ids().indexOf(id) !== -1)).toBe(true);
        expect(await BlobStore.list('p2')).toHaveLength(3);
    });
});

describe('retention with PIN_BASELINE = false gives the literal FR-DATA-6 ring buffer', () => {
    /**
     * PIN_BASELINE is a module-private const; `BlobStore.PIN_BASELINE` is only a
     * copy of it, so flipping the export proves nothing. The module is therefore
     * re-evaluated from source with the constant patched. `new Function` bypasses
     * babel-jest, so these two tests contribute no coverage — they exist to pin
     * the documented escape hatch, which is otherwise dead code.
     */
    function loadWithPinBaseline(value) {
        const src = fs.readFileSync(MODULE_PATH, 'utf8');
        const needle = 'const PIN_BASELINE = true;';
        if (src.indexOf(needle) === -1) {
            throw new Error('blobstore.js no longer declares `' + needle + '` — update this test');
        }
        const patched = src.replace(needle, 'const PIN_BASELINE = ' + value + ';');
        const mod = { exports: {} };
        // A minimal host object: no addEventListener, so the pagehide backstop is
        // skipped and this copy cannot interfere with the required one.
        const host = { URL: global.URL, navigator: global.navigator };
        // eslint-disable-next-line no-new-func
        new Function('module', 'window', patched)(mod, host);
        return mod.exports;
    }

    test('the export really is patched', () => {
        expect(loadWithPinBaseline(false).PIN_BASELINE).toBe(false);
        expect(BlobStore.PIN_BASELINE).toBe(true);
    });

    test('the fourth recording evicts the FIRST — which is what E.7 could not live with', () => {
        const Literal = loadWithPinBaseline(false);
        const row = (id, createdAt) => ({ id: id, promptId: 'p', createdAt: createdAt, size: 100, baseline: false });
        expect(Literal._planRetention([row(1, 100), row(2, 200), row(3, 300), row(Infinity, 400)]))
            .toEqual([1]);
    });

    test('with PIN_BASELINE off, a baseline row is no longer protected from cap eviction', () => {
        const Literal = loadWithPinBaseline(false);
        const rows = [
            { id: 1, promptId: 'a', createdAt: 100, size: 10, baseline: true },
            { id: 2, promptId: 'a', createdAt: 200, size: 10, baseline: false }
        ];
        // Pinned build: only the non-newest, non-baseline rows are candidates.
        expect(BlobStore._evictionCandidates(rows, []).map((r) => r.id)).toEqual([]);
        // Literal build: the baseline is expendable; only "newest per prompt" holds.
        expect(Literal._evictionCandidates(rows, []).map((r) => r.id)).toEqual([1]);
    });

    test('with PIN_BASELINE off, a new row is never flagged as a baseline', async () => {
        const Literal = loadWithPinBaseline(false);
        const fake = new FakeIndexedDB();
        Literal._useEnvironment({ indexedDB: fake, IDBKeyRange: FakeKeyRange });
        Literal._now = () => 1234;
        const res = await Literal.put('p1', fakeBlob(100));
        expect(res.ok).toBe(true);
        expect(res.record.baseline).toBe(false);
    });
});

// ===========================================================================
// 2. Eviction never touches a protected row
// ===========================================================================

describe('eviction candidates: what may never be deleted to make room', () => {
    const rows = [
        { id: 1, promptId: 'a', createdAt: 100, size: 10, baseline: true },
        { id: 2, promptId: 'a', createdAt: 200, size: 20, baseline: false },
        { id: 3, promptId: 'a', createdAt: 300, size: 30, baseline: false },
        { id: 4, promptId: 'b', createdAt: 150, size: 40, baseline: true },
        { id: 5, promptId: 'b', createdAt: 250, size: 50, baseline: false }
    ];

    test("a prompt's newest is protected, and so is its pinned baseline", () => {
        expect(BlobStore._evictionCandidates(rows, []).map((r) => r.id)).toEqual([2]);
    });

    test('a prompt holding exactly one recording offers nothing', () => {
        const single = [{ id: 9, promptId: 'z', createdAt: 1, size: 100, baseline: false }];
        expect(BlobStore._evictionCandidates(single, [])).toEqual([]);
    });

    test('candidates come back oldest first', () => {
        const many = [
            { id: 1, promptId: 'a', createdAt: 500, size: 1, baseline: false },
            { id: 2, promptId: 'a', createdAt: 100, size: 1, baseline: false },
            { id: 3, promptId: 'a', createdAt: 300, size: 1, baseline: false },
            { id: 4, promptId: 'a', createdAt: 900, size: 1, baseline: false }
        ];
        expect(BlobStore._evictionCandidates(many, []).map((r) => r.id)).toEqual([2, 3, 1]);
    });

    test('rows this write is already deleting are not offered twice', () => {
        expect(BlobStore._evictionCandidates(rows, [2])).toEqual([]);
    });

    test('planForSpace stops as soon as it has freed enough', () => {
        const many = [
            { id: 1, promptId: 'a', createdAt: 100, size: 10, baseline: false },
            { id: 2, promptId: 'a', createdAt: 200, size: 10, baseline: false },
            { id: 3, promptId: 'a', createdAt: 300, size: 10, baseline: false },
            { id: 4, promptId: 'a', createdAt: 400, size: 10, baseline: false }
        ];
        expect(BlobStore._planForSpace(many, [], 15)).toEqual({ ok: true, ids: [1, 2], freed: 20 });
        expect(BlobStore._planForSpace(many, [], 0)).toEqual({ ok: true, ids: [], freed: 0 });
        expect(BlobStore._planForSpace(many, [], -5)).toEqual({ ok: true, ids: [], freed: 0 });
    });

    test('planForSpace reports ok:false rather than over-deleting', () => {
        const plan = BlobStore._planForSpace(rows, [], 1000);
        expect(plan.ok).toBe(false);
        expect(plan.ids).toEqual([2]);       // what it WOULD have taken
        expect(plan.freed).toBe(20);
    });

    test('recording at prompt B does not wipe prompt A — end to end over the cap', async () => {
        // 45MB seeded, all of it protected except p2's middle recording.
        const a1 = await putAt('p1', 9 * MB, 100);   // p1 baseline
        const a2 = await putAt('p1', 9 * MB, 200);   // p1 newest
        const b1 = await putAt('p2', 9 * MB, 300);   // p2 baseline
        const b2 = await putAt('p2', 9 * MB, 400);   // p2 middle  <- the only candidate
        const b3 = await putAt('p2', 9 * MB, 500);   // p2 newest
        expect(store.ids()).toHaveLength(5);

        const res = await putAt('p3', 9 * MB, 600);  // 45 + 9 = 54MB, cap is 50MB
        expect(res.ok).toBe(true);
        expect(res.evicted).toEqual([b2.record.id]);

        const surviving = store.ids();
        expect(surviving).toContain(a1.record.id);   // A's baseline survived
        expect(surviving).toContain(a2.record.id);
        expect(surviving).toContain(b1.record.id);   // B's baseline survived
        expect(surviving).toContain(b3.record.id);
        expect(surviving).not.toContain(b2.record.id);
        expect(res.bytes).toBe(45 * MB);
        expect(res.count).toBe(5);
    });
});

// ===========================================================================
// 3. Cap-based refusal never deletes
// ===========================================================================

describe('the 50MB cap refuses rather than deleting something protected', () => {
    async function seedSixSingleRecordingPrompts() {
        const made = [];
        for (let i = 1; i <= 6; i++) made.push(await putAt('p' + i, 8 * MB, i * 100));
        expect(made.every((r) => r.ok)).toBe(true);
        return made;
    }

    test('refusal reports `full` and deletes nothing at all', async () => {
        const seeded = await seedSixSingleRecordingPrompts();       // 48MB, every row protected
        const idsBefore = store.ids();
        const bytesBefore = store.usedBytes();
        expect(bytesBefore).toBe(48 * MB);

        const res = await putAt('p7', 8 * MB, 9999);                // would be 56MB
        expect(res.ok).toBe(false);
        expect(res.code).toBe('full');
        expect(res.message).toBe(BlobStore.MESSAGES.full);

        expect(store.ids()).toEqual(idsBefore);
        expect(store.usedBytes()).toBe(bytesBefore);
        expect(store.audioIds()).toEqual(seeded.map((r) => r.record.id));
        // Not one byte written either: the new row never landed.
        expect(store.metaRows().some((r) => r.promptId === 'p7')).toBe(false);
    });

    test('a refusal rolls back the retention eviction it had already planned', async () => {
        // The nastiest ordering in commit(): the retention victim is chosen and
        // deleted in the SAME transaction that then discovers the cap cannot be
        // met. If the abort did not roll the delete back, the learner would lose
        // a recording to a write that was refused.
        //
        // p1 is at the per-prompt cap with a SMALL middle recording, so retention
        // frees far less than the new recording needs; every other prompt holds
        // exactly one recording and is therefore fully protected.
        const p1base = await putAt('p1', 10 * MB, 100);
        const p1mid = await putAt('p1', 1 * MB, 200);      // retention victim, 1MB
        const p1new = await putAt('p1', 10 * MB, 300);
        await putAt('p2', 10 * MB, 400);
        await putAt('p3', 10 * MB, 500);
        await putAt('p4', 9 * MB, 600);
        expect(store.usedBytes()).toBe(50 * MB);           // exactly at the cap
        const idsBefore = store.ids();

        // Retention would free 1MB; the cap needs 9MB more; nothing else is
        // expendable. Refuse.
        const res = await putAt('p1', 10 * MB, 700);
        expect(res.ok).toBe(false);
        expect(res.code).toBe('full');

        expect(store.ids()).toEqual(idsBefore);
        expect(store.ids()).toContain(p1mid.record.id);     // the planned victim survived
        expect(store.ids()).toContain(p1base.record.id);
        expect(store.ids()).toContain(p1new.record.id);
        expect(store.usedBytes()).toBe(50 * MB);
        expect(await BlobStore.list('p1')).toHaveLength(3);
    });

    test('a recording larger than the whole archive is refused before the database opens', async () => {
        const res = await BlobStore.put('p1', fakeBlob(60 * MB));
        expect(res.ok).toBe(false);
        expect(res.code).toBe('too-large');
        expect(res.limit).toBe(BlobStore.MAX_RECORDING_BYTES);
        expect(store.openCount).toBe(0);
    });
});

// ===========================================================================
// 5. Degradation — no method may ever reject
// ===========================================================================

/**
 * Every public method, under every way IndexedDB can fail. The property is
 * "resolves, with the documented fallback" — a rejection here is a spinner that
 * never stops on a speaking exercise (see the module header, property 1).
 */
describe('degradation: no public method rejects, whatever IndexedDB does', () => {
    const scenarios = {
        'no indexedDB at all': () => BlobStore._useEnvironment({ indexedDB: null, IDBKeyRange: null }),
        'open() throws (Safari private browsing)': () => install({ openMode: 'throw' }),
        'open() fires onerror': () => install({ openMode: 'error' }),
        'open() fires onblocked (another tab)': () => install({ openMode: 'blocked' }),
        'db.transaction() throws': () => install({ txThrows: 'InvalidStateError' })
    };

    const readers = {
        'list()': (B) => B.list('p1'),
        'get()': (B) => B.get(1),
        'usage()': (B) => B.usage(),
        'prompts()': (B) => B.prompts(),
        'available()': (B) => B.available(),
        'available({deep:true})': (B) => B.available({ deep: true })
    };
    const writers = {
        'put()': (B) => B.put('p1', fakeBlob(100)),
        'remove()': (B) => B.remove(1),
        'removeForPrompt()': (B) => B.removeForPrompt('p1'),
        'clear()': (B) => B.clear(),
        'openUrl()': (B) => B.openUrl(1)
    };

    Object.keys(scenarios).forEach((name) => {
        describe(name, () => {
            beforeEach(() => { scenarios[name](); });

            Object.keys(readers).forEach((m) => {
                test(m + ' resolves', async () => {
                    await expect(readers[m](BlobStore)).resolves.toBeDefined();
                });
            });
            Object.keys(writers).forEach((m) => {
                test(m + ' resolves with ok:false and a learner-facing message', async () => {
                    const res = await writers[m](BlobStore);
                    expect(res.ok).toBe(false);
                    expect(typeof res.code).toBe('string');
                    expect(typeof res.message).toBe('string');
                    expect(res.message.length).toBeGreaterThan(10);
                });
            });

            test('list() is empty, get() is null, usage() says unavailable', async () => {
                expect(await BlobStore.list('p1')).toEqual([]);
                expect(await BlobStore.get(1)).toBeNull();
                const u = await BlobStore.usage();
                expect(u.available).toBe(false);
                expect(u.count).toBe(0);
                expect(u.bytes).toBe(0);
                expect(await BlobStore.prompts()).toEqual([]);
            });
        });
    });

    test('isSupported() is synchronous and reflects only the presence of indexedDB', () => {
        BlobStore._useEnvironment({ indexedDB: null, IDBKeyRange: null });
        expect(BlobStore.isSupported()).toBe(false);
        install();
        expect(BlobStore.isSupported()).toBe(true);
    });

    test('specific codes reach the caller so the UI can distinguish the causes', async () => {
        BlobStore._useEnvironment({ indexedDB: null, IDBKeyRange: null });
        expect((await BlobStore.available()).code).toBe('no-indexeddb');
        expect((await BlobStore.put('p1', fakeBlob(1))).code).toBe('no-indexeddb');

        install({ openMode: 'throw' });
        expect((await BlobStore.available()).code).toBe('blocked');

        install({ openMode: 'error' });
        expect((await BlobStore.available()).code).toBe('blocked');

        install({ openMode: 'blocked' });
        const blocked = await BlobStore.available();
        expect(blocked.code).toBe('blocked-by-other-tab');
        expect(blocked.message).toBe(BlobStore.MESSAGES.otherTab);
    });

    test('an open() that never fires any event times out after OPEN_TIMEOUT_MS', async () => {
        jest.useFakeTimers();
        install({ openMode: 'silent' });

        const pending = BlobStore.available();
        await Promise.resolve();
        jest.advanceTimersByTime(8000);
        const res = await pending;

        expect(res).toEqual({ ok: false, code: 'timeout', message: BlobStore.MESSAGES.unavailable });
    });

    test('a timed-out open() does not poison put() either', async () => {
        jest.useFakeTimers();
        install({ openMode: 'silent' });

        const pending = BlobStore.put('p1', fakeBlob(100));
        await Promise.resolve();
        jest.advanceTimersByTime(8000);
        const res = await pending;

        expect(res.ok).toBe(false);
        expect(res.code).toBe('timeout');
        expect(res.message).toBe(BlobStore.MESSAGES.unavailable);
    });
});

// ===========================================================================
// Input refusals that need no database
// ===========================================================================

describe('put() refuses obviously bad input without opening a database', () => {
    test.each([
        ['a null prompt id', null, fakeBlob(100), 'bad-prompt'],
        ['an empty prompt id', '   ', fakeBlob(100), 'bad-prompt'],
        ['a prompt id over 200 chars', 'x'.repeat(201), fakeBlob(100), 'bad-prompt'],
        ['a missing blob', 'p1', null, 'bad-blob'],
        ['a non-blob', 'p1', { size: 'lots' }, 'bad-blob'],
        ['a negative size', 'p1', { size: -1 }, 'bad-blob'],
        ['a NaN size', 'p1', { size: NaN }, 'bad-blob'],
        ['an empty recording', 'p1', fakeBlob(0), 'empty'],
        ['an over-long recording', 'p1', fakeBlob(11 * MB), 'too-large']
    ])('%s -> %s, with no open()', async (_label, promptId, blob, code) => {
        const res = await BlobStore.put(promptId, blob);
        expect(res.ok).toBe(false);
        expect(res.code).toBe(code);
        expect(store.openCount).toBe(0);
    });

    test('the empty-recording message is the one that says nothing was lost', async () => {
        const res = await BlobStore.put('p1', fakeBlob(0));
        expect(res.message).toBe(BlobStore.MESSAGES.empty);
    });

    test('a prompt id is trimmed and coerced, so 12 and " 12 " are the same prompt', async () => {
        await putAt(12, 100, 100);
        await putAt('  12  ', 100, 200);
        expect(await BlobStore.list('12')).toHaveLength(2);
    });
});

// ===========================================================================
// 4. Quota: evict and retry exactly once, then refuse
// ===========================================================================

/**
 * The browser's quota is not the module's 50MB cap. It is dynamic, shared with
 * every other store this origin uses, and can drop below what we are already
 * holding — so a QuotaExceededError is not "the archive is full", it is "this
 * allocation failed right now". put() therefore frees QUOTA_EVICT_FACTOR (3x)
 * what it needs from the SAME expendable set the cap path uses, and retries
 * ONCE. See the caveat in the header: the fake's budget is a byte counter over
 * blob payloads, not a real quota, and metadata rows are free.
 */
describe('quota', () => {
    const audioPuts = () => store.opsOn('audio', 'put').length;

    test('evicts the expendable middle recording and retries once, successfully', async () => {
        const base = await putAt('p1', 4 * MB, 100);
        const mid = await putAt('p1', 4 * MB, 200);
        const newest = await putAt('p1', 4 * MB, 300);
        store.budget = 14 * MB;                    // 12MB already held; 4MB more will not fit
        const seedPuts = audioPuts();

        const res = await putAt('p2', 4 * MB, 400);

        expect(res.ok).toBe(true);
        expect(res.quotaRetry).toBe(true);
        expect(res.evicted).toEqual([mid.record.id]);
        expect(audioPuts() - seedPuts).toBe(2);    // the attempt, and EXACTLY one retry
        expect(store.ids()).toEqual([base.record.id, newest.record.id, res.record.id]);
        expect(store.audioIds()).toEqual([base.record.id, newest.record.id, res.record.id]);
        expect(logged.some((l) => l.context === 'blobstore quota on first write')).toBe(true);
    });

    test('the aborted first attempt leaves no orphan metadata row behind', async () => {
        await putAt('p1', 4 * MB, 100);
        await putAt('p1', 4 * MB, 200);
        await putAt('p1', 4 * MB, 300);
        store.budget = 14 * MB;

        const res = await putAt('p2', 4 * MB, 400);
        // One p2 row, not two: the first commit's metadata add rolled back with
        // its payload, so autoIncrement is the only thing that moved.
        expect(store.metaRows().filter((r) => r.promptId === 'p2')).toHaveLength(1);
        expect(store.metaRows().length).toBe(store.audioIds().length);
        expect(store.ids()).toEqual(store.audioIds());
        expect(res.record.baseline).toBe(true);    // still p2's first recording
    });

    test('nothing expendable: refuses without a retry and without deleting', async () => {
        const a = await putAt('p1', 4 * MB, 100);   // single row -> newest AND baseline
        const b = await putAt('p2', 4 * MB, 200);   // ditto
        store.budget = 10 * MB;
        const idsBefore = store.ids();

        const res = await putAt('p3', 4 * MB, 300);

        expect(res.ok).toBe(false);
        expect(res.code).toBe('full');
        expect(res.message).toBe(BlobStore.MESSAGES.full);
        expect(audioPuts()).toBe(3);               // 2 seeds + 1 failed attempt, no retry
        expect(store.ids()).toEqual(idsBefore);
        expect(store.usedBytes()).toBe(8 * MB);
        expect(await BlobStore.get(a.record.id)).not.toBeNull();
        expect(await BlobStore.get(b.record.id)).not.toBeNull();
    });

    test('FIXED (US-216) — a `full` refusal after a quota retry really has deleted nothing', async () => {
        // Seeded so that the ONE expendable recording is too small to make the
        // retry fit: the quota eviction is planned, the retry fails anyway, and
        // the abort has to take the eviction with it.
        const base = await putAt('p1', 4 * MB, 100);
        const mid = await putAt('p1', 1 * MB, 200);      // the only expendable row
        const newest = await putAt('p1', 4 * MB, 300);
        store.budget = 10 * MB;                          // holding 9MB

        const res = await putAt('p2', 4 * MB, 400);

        // Refused, exactly once retried.
        expect(res.ok).toBe(false);
        expect(res.code).toBe('full');
        expect(audioPuts()).toBe(5);                     // 3 seeds + attempt + one retry
        // The new recording was not written.
        expect(store.metaRows().some((r) => r.promptId === 'p2')).toBe(false);

        // ...and neither was anything deleted. The retry frees its headroom
        // INSIDE its own transaction (js/core/blobstore.js commit(), the
        // `quotaHeadroom` branch), so the second QuotaExceededError aborts the
        // eviction along with the write. MESSAGES.full is now true when it is
        // shown: BR-3 / NFR-10.
        expect(res.message).toContain('Your existing recordings are safe');
        expect(store.ids()).toEqual([base.record.id, mid.record.id, newest.record.id]);
        expect(await BlobStore.get(mid.record.id)).not.toBeNull();
        expect(await BlobStore.list('p1')).toHaveLength(3);
        expect(store.usedBytes()).toBe(9 * MB);
        // Payload rows did not drift from metadata rows either.
        expect(store.audioIds()).toEqual(store.ids());
    });

    test('the quota retry frees nothing it does not then write for', async () => {
        // The success case of the same mechanism: the eviction and the new
        // recording land in ONE transaction, so there is no window in which the
        // archive is short a recording and has not gained one.
        const base = await putAt('p1', 4 * MB, 100);
        const mid = await putAt('p1', 4 * MB, 200);
        const newest = await putAt('p1', 4 * MB, 300);
        store.budget = 14 * MB;

        const res = await putAt('p2', 4 * MB, 400);

        expect(res.ok).toBe(true);
        expect(res.quotaRetry).toBe(true);
        expect(res.evicted).toEqual([mid.record.id]);
        // The retry transaction is the only one that deleted anything: two
        // deletes (metadata + payload) for the one victim, and none before it.
        expect(store.opsOn('recordings', 'delete').map((o) => o.key)).toEqual([mid.record.id]);
        expect(store.opsOn('audio', 'delete').map((o) => o.key)).toEqual([mid.record.id]);
        expect(store.ids()).toEqual([base.record.id, newest.record.id, res.record.id]);
    });

    test('the quota eviction is drawn from the documented expendable set only', async () => {
        // Two prompts, each with an expendable middle row. Only as many as needed
        // for 3x the request should go, oldest first, and never a protected row.
        const a1 = await putAt('pA', 2 * MB, 100);
        const a2 = await putAt('pA', 2 * MB, 200);
        const a3 = await putAt('pA', 2 * MB, 300);
        const b1 = await putAt('pB', 2 * MB, 400);
        const b2 = await putAt('pB', 2 * MB, 500);
        const b3 = await putAt('pB', 2 * MB, 600);
        expect(store.usedBytes()).toBe(12 * MB);
        store.budget = 13 * MB;

        const res = await putAt('pC', 2 * MB, 700);   // needs 2MB, frees up to 6MB

        expect(res.ok).toBe(true);
        expect(res.quotaRetry).toBe(true);
        // Candidates oldest first are [a2, b2]; 3x2MB = 6MB needed, so both go.
        expect(res.evicted).toEqual([a2.record.id, b2.record.id]);
        [a1, a3, b1, b3].forEach((r) => expect(store.ids()).toContain(r.record.id));
    });

    test('a quota error on the very first recording is refused, not retried into nothing', async () => {
        install({ budget: 1024 });
        const res = await putAt('p1', 4 * MB, 100);
        expect(res.ok).toBe(false);
        expect(res.code).toBe('full');
        expect(store.metaRows()).toEqual([]);
        expect(store.audioIds()).toEqual([]);
    });

    test('QuotaExceededError is recognised by name, code 22 and code 1014', async () => {
        // isQuotaError() has to cope with three engines' spellings.
        const spellings = [
            { name: 'QuotaExceededError' },
            { name: 'NS_ERROR_DOM_QUOTA_REACHED' },
            { name: 'Whatever', code: 22 },
            { name: 'Whatever', code: 1014 }
        ];
        for (let i = 0; i < spellings.length; i++) {
            const spec = spellings[i];
            install({
                errorHook: (storeName, op) => {
                    if (storeName !== 'audio' || op !== 'put') return null;
                    const e = new Error('quota');
                    Object.assign(e, spec);
                    return e;
                }
            });
            const res = await putAt('p1', 100, 100);
            expect(res.ok).toBe(false);
            expect(res.code).toBe('full');
        }
    });
});

describe('a Blob the engine refuses to clone', () => {
    test('DataCloneError on the payload is reported as no-blob-storage, not write-failed', async () => {
        install({
            errorHook: (storeName, op) => (storeName === 'audio' && op === 'put'
                ? domError('DataCloneError') : null)
        });
        const res = await BlobStore.put('p1', fakeBlob(100));
        expect(res.ok).toBe(false);
        expect(res.code).toBe('no-blob-storage');
        expect(res.message).toBe(BlobStore.MESSAGES.unavailable);
        expect(store.metaRows()).toEqual([]);       // rolled back
    });

    test('DataError is treated the same way', async () => {
        install({
            errorHook: (storeName, op) => (storeName === 'audio' && op === 'put'
                ? domError('DataError') : null)
        });
        expect((await BlobStore.put('p1', fakeBlob(100))).code).toBe('no-blob-storage');
    });

    test('any other request failure is write-failed, and says nothing was lost', async () => {
        const existing = await putAt('p1', 100, 100);
        store.errorHook = (storeName, op) => (storeName === 'audio' && op === 'put'
            ? domError('UnknownError') : null);

        const res = await putAt('p1', 100, 200);
        expect(res.ok).toBe(false);
        expect(res.code).toBe('write-failed');
        expect(res.message).toBe(BlobStore.MESSAGES.writeFailed);
        store.errorHook = null;
        expect(store.ids()).toEqual([existing.record.id]);
    });

    test('a failure on the metadata read aborts before anything is written', async () => {
        store.errorHook = (storeName, op) => (storeName === 'recordings' && op === 'getAll'
            ? domError('UnknownError') : null);
        const res = await BlobStore.put('p1', fakeBlob(100));
        expect(res.ok).toBe(false);
        expect(res.code).toBe('write-failed');
        store.errorHook = null;
        expect(store.metaRows()).toEqual([]);
    });
});

// ===========================================================================
// 6. available() caches `ok` and permanent failures, re-probes transient ones
// ===========================================================================

describe('available() caching', () => {
    test('a successful shallow probe opens the database once', async () => {
        const first = await BlobStore.available();
        expect(first).toEqual({ ok: true, code: 'ok', message: null });
        await BlobStore.available();
        await BlobStore.available();
        expect(store.openCount).toBe(1);
    });

    test('a successful deep probe round-trips a 1-byte Blob and cleans up after itself', async () => {
        const res = await BlobStore.available({ deep: true });
        expect(res).toEqual({ ok: true, code: 'ok', message: null });
        // Written under the reserved PROBE_ID and deleted in the same transaction.
        expect(store.opsOn('audio').map((o) => o.op)).toEqual(['put', 'get', 'delete']);
        expect(store.audioIds()).toEqual([]);
        expect(store.metaRows()).toEqual([]);
    });

    test('a deep probe is cached, and also answers the shallow question', async () => {
        await BlobStore.available({ deep: true });
        await BlobStore.available({ deep: true });
        expect(store.opsOn('audio', 'put')).toHaveLength(1);

        expect(await BlobStore.available()).toEqual({ ok: true, code: 'ok', message: null });
        expect(store.openCount).toBe(1);
    });

    test('the probe row can never collide with a real recording', async () => {
        // Ids come from autoIncrement, which starts at 1, so PROBE_ID 0 is
        // unreachable — and usableRows() drops id 0 even if something wrote it.
        await BlobStore.available({ deep: true });
        const first = await putAt('p1', 100, 100);
        expect(first.record.id).toBeGreaterThan(0);

        store.seedMeta([{ id: 0, promptId: '__probe__', createdAt: 1, size: 1, v: 1 }]);
        expect(await BlobStore.list('__probe__')).toEqual([]);
        expect(await BlobStore.get(0)).toBeNull();
        expect((await BlobStore.usage()).count).toBe(1);
    });

    test('a PERMANENT failure is cached — the same promise comes back', async () => {
        BlobStore._useEnvironment({ indexedDB: null, IDBKeyRange: null });
        const p1 = BlobStore.available();
        const p2 = BlobStore.available();
        expect(p2).toBe(p1);
        expect((await p1).code).toBe('no-indexeddb');
        expect(BlobStore.available()).toBe(p1);
    });

    test('a lost Blob is permanent (blob-roundtrip-failed) and is cached', async () => {
        install({ dropBlobs: true });
        const res = await BlobStore.available({ deep: true });
        expect(res.code).toBe('blob-roundtrip-failed');
        expect(res.message).toBe(BlobStore.MESSAGES.unavailable);

        await BlobStore.available({ deep: true });
        expect(store.opsOn('audio', 'put')).toHaveLength(1);   // not re-probed
    });

    /**
     * The one the author's own throwaway harness caught: a transient failure that
     * got cached leaves the Save control disabled for the rest of the session even
     * after the learner closes the other tab. Note the ordering hazard being
     * pinned here — `capability = promise` is assigned SYNCHRONOUSLY, while the
     * `capability = null` that undoes it runs in a later `.then`. The null has to
     * win, and it only does because it runs afterwards.
     */
    describe('a TRANSIENT failure is re-probed, never cached', () => {
        test('blocked-by-other-tab', async () => {
            install({ openMode: 'blocked' });
            expect((await BlobStore.available()).code).toBe('blocked-by-other-tab');
            expect((await BlobStore.available()).code).toBe('blocked-by-other-tab');
            expect(store.openCount).toBe(2);
        });

        test('and it recovers the moment the other tab closes', async () => {
            install({ openMode: 'blocked' });
            expect((await BlobStore.available()).ok).toBe(false);
            store.openMode = 'ok';                       // learner closes the other tab
            expect(await BlobStore.available()).toEqual({ ok: true, code: 'ok', message: null });
            expect(store.openCount).toBe(2);
        });

        test('open() erroring', async () => {
            install({ openMode: 'error' });
            expect((await BlobStore.available()).code).toBe('blocked');
            expect((await BlobStore.available()).code).toBe('blocked');
            expect(store.openCount).toBe(2);
        });

        test('open() throwing', async () => {
            install({ openMode: 'throw' });
            expect((await BlobStore.available()).code).toBe('blocked');
            expect((await BlobStore.available()).code).toBe('blocked');
            expect(store.openCount).toBe(2);
        });

        test('timeout', async () => {
            jest.useFakeTimers();
            install({ openMode: 'silent' });

            const p1 = BlobStore.available();
            await Promise.resolve();
            jest.advanceTimersByTime(8000);
            expect((await p1).code).toBe('timeout');

            const p2 = BlobStore.available();
            await Promise.resolve();
            jest.advanceTimersByTime(8000);
            expect((await p2).code).toBe('timeout');

            expect(store.openCount).toBe(2);
        });

        test('full (deep probe hitting quota)', async () => {
            install({ budget: 0 });
            const res = await BlobStore.available({ deep: true });
            expect(res.code).toBe('full');
            expect(res.message).toBe(BlobStore.MESSAGES.full);

            await BlobStore.available({ deep: true });
            expect(store.opsOn('audio', 'put')).toHaveLength(2);   // really re-probed
        });

        test('a deep probe that cannot clone the Blob is permanent, not transient', async () => {
            install({
                errorHook: (storeName, op) => (storeName === 'audio' && op === 'put'
                    ? domError('DataCloneError') : null)
            });
            const res = await BlobStore.available({ deep: true });
            expect(res.code).toBe('no-blob-storage');
            await BlobStore.available({ deep: true });
            expect(store.opsOn('audio', 'put')).toHaveLength(1);
        });

        test('an unexplained deep-probe failure is transient', async () => {
            install({
                errorHook: (storeName, op) => (storeName === 'audio' && op === 'put'
                    ? domError('UnknownError') : null)
            });
            expect((await BlobStore.available({ deep: true })).code).toBe('unavailable');
            await BlobStore.available({ deep: true });
            expect(store.opsOn('audio', 'put')).toHaveLength(2);
        });
    });

    test('_reset() drops every cache', async () => {
        await BlobStore.available({ deep: true });
        expect(store.openCount).toBe(1);
        BlobStore._reset();
        await BlobStore.available({ deep: true });
        expect(store.openCount).toBe(2);
    });

    test('a failed open is not cached, so the next call really reopens', async () => {
        install({ openMode: 'error' });
        expect((await BlobStore.list('p1'))).toEqual([]);
        expect((await BlobStore.list('p1'))).toEqual([]);
        expect(store.openCount).toBe(2);
    });

    test('a successful open IS cached across every method', async () => {
        await putAt('p1', 100, 100);
        await BlobStore.list('p1');
        await BlobStore.get(1);
        await BlobStore.usage();
        await BlobStore.prompts();
        await BlobStore.clear();
        expect(store.openCount).toBe(1);
    });
});

describe('another tab upgrading the database', () => {
    test('onversionchange closes this connection and the next call reopens', async () => {
        await putAt('p1', 100, 100);
        expect(store.openCount).toBe(1);
        expect(typeof store.db.onversionchange).toBe('function');

        store.db.onversionchange({ type: 'versionchange' });   // the other tab wants it

        const rows = await BlobStore.list('p1');
        expect(rows).toHaveLength(1);                          // data still there
        expect(store.openCount).toBe(2);                       // reopened
    });

    test('onclose drops the cached connection too', async () => {
        await BlobStore.available();
        expect(typeof store.db.onclose).toBe('function');
        store.db.onclose({ type: 'close' });
        await BlobStore.available();
        // available() itself is cached, so force a real reopen through a reader.
        BlobStore._reset();
        await BlobStore.list('p1');
        expect(store.openCount).toBeGreaterThan(1);
    });

    test('a schema upgrade that throws aborts the version change rather than half-building', async () => {
        install({ schemaThrows: true });
        const res = await BlobStore.available();
        expect(res.ok).toBe(false);
        expect(res.code).toBe('blocked');
        expect(logged.some((l) => l.context === 'blobstore schema upgrade')).toBe(true);
    });
});

// ===========================================================================
// 7. Object-URL discipline
// ===========================================================================

describe('object URLs', () => {
    let rec;
    beforeEach(async () => {
        rec = await putAt('p1', 512, 100);
    });

    test('openUrl() hands back a url, the metadata and an idempotent revoke()', async () => {
        const opened = await BlobStore.openUrl(rec.record.id);
        expect(opened.ok).toBe(true);
        expect(opened.url).toBe(createdUrls[0]);
        // Since US-220 a read reports exactly what put() reported, durationMs
        // included, so this really is the same record.
        expect(opened.record).toEqual(rec.record);
        expect(opened.record.blob).toBeUndefined();      // metadata only
        expect(BlobStore.liveUrlCount()).toBe(1);

        expect(opened.revoke()).toBe(true);
        expect(revokedUrls).toEqual([opened.url]);
        expect(BlobStore.liveUrlCount()).toBe(0);

        expect(opened.revoke()).toBe(false);             // idempotent
        expect(BlobStore.liveUrlCount()).toBe(0);
    });

    test('MAX_LIVE_URLS is a ceiling: the ninth url revokes the oldest', async () => {
        expect(BlobStore.MAX_LIVE_URLS).toBe(8);
        const opened = [];
        for (let i = 0; i < BlobStore.MAX_LIVE_URLS; i++) {
            opened.push(await BlobStore.openUrl(rec.record.id));
        }
        expect(BlobStore.liveUrlCount()).toBe(8);
        expect(revokedUrls).toEqual([]);

        const ninth = await BlobStore.openUrl(rec.record.id);
        expect(BlobStore.liveUrlCount()).toBe(8);
        expect(revokedUrls).toEqual([opened[0].url]);    // the OLDEST went
        expect(ninth.ok).toBe(true);

        // The caller who lost their url finds out honestly.
        expect(opened[0].revoke()).toBe(false);
        expect(opened[1].revoke()).toBe(true);
    });

    test('the ceiling holds under a long replay session', async () => {
        for (let i = 0; i < 30; i++) await BlobStore.openUrl(rec.record.id);
        expect(BlobStore.liveUrlCount()).toBe(8);
        expect(revokedUrls).toHaveLength(22);
        expect(createdUrls).toHaveLength(30);
    });

    test('revokeAll() releases every url and reports how many', async () => {
        await BlobStore.openUrl(rec.record.id);
        await BlobStore.openUrl(rec.record.id);
        expect(BlobStore.revokeAll()).toBe(2);
        expect(revokedUrls).toHaveLength(2);
        expect(BlobStore.liveUrlCount()).toBe(0);
        expect(BlobStore.revokeAll()).toBe(0);
    });

    test('remove() revokes live urls, because one may point at what was deleted', async () => {
        const opened = await BlobStore.openUrl(rec.record.id);
        expect(BlobStore.liveUrlCount()).toBe(1);

        const res = await BlobStore.remove(rec.record.id);
        expect(res.ok).toBe(true);
        expect(revokedUrls).toEqual([opened.url]);
        expect(BlobStore.liveUrlCount()).toBe(0);
    });

    test('removeForPrompt() revokes live urls', async () => {
        const opened = await BlobStore.openUrl(rec.record.id);
        await BlobStore.removeForPrompt('p1');
        expect(revokedUrls).toEqual([opened.url]);
    });

    test('clear() revokes live urls', async () => {
        const opened = await BlobStore.openUrl(rec.record.id);
        await BlobStore.clear();
        expect(revokedUrls).toEqual([opened.url]);
    });

    test('removeForPrompt() with nothing to delete does not disturb live urls', async () => {
        await BlobStore.openUrl(rec.record.id);
        const res = await BlobStore.removeForPrompt('nosuchprompt');
        expect(res).toEqual({ ok: true, removed: 0, message: BlobStore.MESSAGES.nothingToRemove });
        expect(revokedUrls).toEqual([]);
        expect(BlobStore.liveUrlCount()).toBe(1);
    });

    test('revoke() is safe on rubbish and on urls this module never made', () => {
        expect(BlobStore.revoke(null)).toBe(false);
        expect(BlobStore.revoke('')).toBe(false);
        expect(BlobStore.revoke(42)).toBe(false);
        expect(BlobStore.revoke({})).toBe(false);
        expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();

        // A real-looking url we did not issue: still handed to the platform (it
        // may be the caller's own), but reported as "not one of mine".
        expect(BlobStore.revoke('blob:somewhere/else')).toBe(false);
        expect(revokedUrls).toEqual(['blob:somewhere/else']);
    });

    test('a throwing revokeObjectURL cannot break the accounting', async () => {
        const opened = await BlobStore.openUrl(rec.record.id);
        global.URL.revokeObjectURL = jest.fn(() => { throw new Error('gone'); });
        expect(opened.revoke()).toBe(true);
        expect(BlobStore.liveUrlCount()).toBe(0);
    });

    test('openUrl() on a missing recording reports missing and creates no url', async () => {
        const res = await BlobStore.openUrl(99999);
        expect(res).toEqual({ ok: false, code: 'missing', message: BlobStore.MESSAGES.missing });
        expect(global.URL.createObjectURL).not.toHaveBeenCalled();
        expect(BlobStore.liveUrlCount()).toBe(0);
    });

    test('openUrl() with no createObjectURL at all reports no-object-url', async () => {
        const real = global.URL.createObjectURL;
        try {
            global.URL.createObjectURL = undefined;
            const res = await BlobStore.openUrl(rec.record.id);
            expect(res).toEqual({
                ok: false, code: 'no-object-url', message: BlobStore.MESSAGES.playbackFailed
            });
        } finally {
            global.URL.createObjectURL = real;
        }
    });

    test('openUrl() when createObjectURL throws reports no-object-url and logs', async () => {
        global.URL.createObjectURL = jest.fn(() => { throw new Error('nope'); });
        const res = await BlobStore.openUrl(rec.record.id);
        expect(res.code).toBe('no-object-url');
        expect(loggedContexts()).toContain('blobstore createObjectURL');
        expect(BlobStore.liveUrlCount()).toBe(0);
    });

    test('FIXED (US-219) — openUrl() on a device with no IndexedDB says unavailable, not deleted', async () => {
        BlobStore._useEnvironment({ indexedDB: null, IDBKeyRange: null });
        const res = await BlobStore.openUrl(1);
        // readRecord() keeps the reason that get() flattens to null, so a learner
        // whose browser will not keep recordings is no longer told that the
        // recording was deleted from their device.
        expect(res.ok).toBe(false);
        expect(res.code).toBe('no-indexeddb');
        expect(res.message).toBe(BlobStore.MESSAGES.unavailable);
        expect(res.message).not.toContain('no longer on this device');
        expect(global.URL.createObjectURL).not.toHaveBeenCalled();
        // get() keeps its documented "record or null" contract regardless.
        expect(await BlobStore.get(1)).toBeNull();
    });

    test('openUrl() separates every storage failure from a genuine "not there"', async () => {
        // A real miss still reports missing...
        await putAt('p1', 100, 100);
        expect((await BlobStore.openUrl(4242)).code).toBe('missing');

        // ...and each way the store can be unreachable reports itself.
        install({ openMode: 'throw' });
        expect(await BlobStore.openUrl(1)).toEqual({
            ok: false, code: 'blocked', message: BlobStore.MESSAGES.unavailable
        });

        install({ openMode: 'blocked' });
        expect(await BlobStore.openUrl(1)).toEqual({
            ok: false, code: 'blocked-by-other-tab', message: BlobStore.MESSAGES.otherTab
        });

        install({ txThrows: 'InvalidStateError' });
        const broken = await BlobStore.openUrl(1);
        expect(broken.code).toBe('tx-failed');
        // A failed read is a playback problem, never "your recording was saved
        // and then lost" and never "that recording could not be saved".
        expect(broken.message).toBe(BlobStore.MESSAGES.playbackFailed);
    });

    test('an orphaned row still reports missing from openUrl() — for an orphan that is true', async () => {
        const rec = await putAt('p1', 100, 100);
        store.db._store('audio').records.delete(rec.record.id);
        const res = await BlobStore.openUrl(rec.record.id);
        expect(res).toEqual({ ok: false, code: 'missing', message: BlobStore.MESSAGES.missing });
        expect(store.ids()).not.toContain(rec.record.id);   // and it was repaired
    });
});

// ===========================================================================
// Reading
// ===========================================================================

describe('list()', () => {
    test('newest first, metadata only, never a blob', async () => {
        const a = await putAt('p1', 100, 100, { label: 'first try' });
        const b = await putAt('p1', 200, 200);
        const rows = await BlobStore.list('p1');

        expect(rows.map((r) => r.id)).toEqual([b.record.id, a.record.id]);
        expect(rows[1]).toEqual({
            id: a.record.id, promptId: 'p1', createdAt: 100, size: 100,
            mimeType: 'audio/webm;codecs=opus',
            durationMs: null,       // exactly what put() reported — US-220
            label: 'first try', baseline: true
        });
        expect(rows[1]).toEqual(a.record);
        rows.forEach((r) => expect(r.blob).toBeUndefined());
    });

    test('the compound-key range returns this prompt and nothing else', async () => {
        await putAt('p1', 100, 100);
        await putAt('p10', 100, 200);       // a prefix trap for a naive range
        await putAt('p1x', 100, 300);
        await putAt('p2', 100, 400);

        expect((await BlobStore.list('p1')).map((r) => r.promptId)).toEqual(['p1']);
        expect((await BlobStore.list('p10')).map((r) => r.promptId)).toEqual(['p10']);
        expect((await BlobStore.list('p1x')).map((r) => r.promptId)).toEqual(['p1x']);
    });

    test('two recordings in the same millisecond are still totally ordered', async () => {
        const a = await putAt('p1', 100, 500);
        const b = await putAt('p1', 100, 500);
        const c = await putAt('p1', 100, 500);
        // The index alone cannot order these; the in-memory id tie-break does.
        expect((await BlobStore.list('p1')).map((r) => r.id))
            .toEqual([c.record.id, b.record.id, a.record.id]);
    });

    test('an unknown prompt is an empty archive, not an error', async () => {
        await putAt('p1', 100, 100);
        expect(await BlobStore.list('nope')).toEqual([]);
    });

    test('an unusable prompt id short-circuits without opening the database', async () => {
        expect(await BlobStore.list('')).toEqual([]);
        expect(await BlobStore.list(null)).toEqual([]);
        expect(await BlobStore.list('x'.repeat(201))).toEqual([]);
        expect(store.openCount).toBe(0);
    });

    test('garbage rows in the store are ignored, never thrown on', async () => {
        const real = await putAt('p1', 100, 100);
        store.seedMeta([
            { id: 900, promptId: 'p1', createdAt: 'not a number', size: 'lots', v: 1 },
            { id: 'not-a-number', promptId: 'p1', createdAt: 200, size: 10 },
            { id: 902, promptId: '', createdAt: 300, size: 10 },
            { id: 903, createdAt: 400, size: 10 }
        ]);

        const rows = await BlobStore.list('p1');
        // id 900 IS usable (its bad fields are coerced); the other three are not.
        expect(rows.map((r) => r.id).sort()).toEqual([real.record.id, 900]);
        const coerced = rows.filter((r) => r.id === 900)[0];
        expect(coerced.createdAt).toBe(0);
        expect(coerced.size).toBe(0);
    });

    test('a missing IDBKeyRange degrades to an empty list rather than throwing', async () => {
        await putAt('p1', 100, 100);
        BlobStore._useEnvironment({ indexedDB: store, IDBKeyRange: null });
        expect(await BlobStore.list('p1')).toEqual([]);
        expect(loggedContexts()).toContain('blobstore list');
    });

    test('a failing index read degrades to an empty list', async () => {
        await putAt('p1', 100, 100);
        store.errorHook = (s, op) => (op === 'index.getAll' ? domError('UnknownError') : null);
        expect(await BlobStore.list('p1')).toEqual([]);
        store.errorHook = null;
    });
});

describe('get()', () => {
    test('returns the metadata with the blob attached', async () => {
        const rec = await putAt('p1', 321, 100, { durationMs: 4200, mimeType: 'audio/mp4' });
        const got = await BlobStore.get(rec.record.id);
        expect(got.id).toBe(rec.record.id);
        expect(got.promptId).toBe('p1');
        expect(got.durationMs).toBe(4200);
        expect(got.mimeType).toBe('audio/mp4');
        expect(got.blob.size).toBe(321);
    });

    test('a numeric string id is accepted', async () => {
        const rec = await putAt('p1', 100, 100);
        expect((await BlobStore.get(String(rec.record.id))).id).toBe(rec.record.id);
    });

    test('a non-numeric id is null without opening the database', async () => {
        expect(await BlobStore.get('abc')).toBeNull();
        expect(await BlobStore.get(undefined)).toBeNull();
        expect(await BlobStore.get(Infinity)).toBeNull();
        expect(store.openCount).toBe(0);
    });

    test('an id that is not there is null', async () => {
        await putAt('p1', 100, 100);
        expect(await BlobStore.get(4242)).toBeNull();
    });

    test('an orphaned metadata row is REPAIRED, not reported forever', async () => {
        const rec = await putAt('p1', 100, 100);
        // Lose the payload behind the module's back.
        store.db._store('audio').records.delete(rec.record.id);

        expect(await BlobStore.get(rec.record.id)).toBeNull();
        expect(store.ids()).not.toContain(rec.record.id);   // the row was cleaned up
        expect(await BlobStore.list('p1')).toEqual([]);
        expect(await BlobStore.get(rec.record.id)).toBeNull();
    });

    test('an orphan whose repair also fails still reports "not there"', async () => {
        const rec = await putAt('p1', 100, 100);
        store.db._store('audio').records.delete(rec.record.id);
        store.errorHook = (s, op) => (op === 'delete' ? domError('UnknownError') : null);
        expect(await BlobStore.get(rec.record.id)).toBeNull();
        store.errorHook = null;
    });

    test('a payload row present but blob-less counts as an orphan', async () => {
        const rec = await putAt('p1', 100, 100);
        store.seedAudio([{ id: rec.record.id, promptId: 'p1', blob: null }]);
        expect(await BlobStore.get(rec.record.id)).toBeNull();
        expect(store.ids()).not.toContain(rec.record.id);
    });
});

// ===========================================================================
// Deleting
// ===========================================================================

describe('remove() / removeForPrompt() / clear()', () => {
    test('remove() deletes the metadata row and the payload together', async () => {
        const a = await putAt('p1', 100, 100);
        const b = await putAt('p1', 100, 200);

        const res = await BlobStore.remove(a.record.id);
        expect(res).toEqual({ ok: true, removed: 1, message: BlobStore.MESSAGES.removed });
        expect(store.ids()).toEqual([b.record.id]);
        expect(store.audioIds()).toEqual([b.record.id]);
    });

    test('remove() is allowed to delete a baseline — the learner asked for it', async () => {
        const base = await putAt('p1', 100, 100);
        await putAt('p1', 100, 200);
        expect(base.record.baseline).toBe(true);
        expect((await BlobStore.remove(base.record.id)).ok).toBe(true);
        expect(store.ids()).not.toContain(base.record.id);
    });

    test('FIXED (US-217) — remove() of an id that was never there reports missing, not success', async () => {
        const kept = await putAt('p1', 100, 100);
        const opened = await BlobStore.openUrl(kept.record.id);
        const res = await BlobStore.remove(9999);
        // removeIds() now reads each row inside the deleting transaction and
        // resolves with what WAS there, because IDBObjectStore.delete() on an
        // absent key succeeds silently. A UI acting on a stale list entry is
        // told to refresh instead of being told "Recording deleted."
        expect(res).toEqual({ ok: false, code: 'missing', message: BlobStore.MESSAGES.missing });
        expect(res.message).toContain('no longer on this device');
        expect(store.ids()).toEqual([kept.record.id]);
        // Nothing was deleted, so no live url needed releasing either.
        expect(revokedUrls).toEqual([]);
        expect(BlobStore.liveUrlCount()).toBe(1);
        expect(opened.revoke()).toBe(true);
    });

    test('remove() of a metadata row whose payload is already gone still reports the deletion', async () => {
        // The orphan case: the row is real, so deleting it IS a deletion.
        const rec = await putAt('p1', 100, 100);
        store.db._store('audio').records.delete(rec.record.id);
        const res = await BlobStore.remove(rec.record.id);
        expect(res).toEqual({ ok: true, removed: 1, message: BlobStore.MESSAGES.removed });
        expect(store.ids()).toEqual([]);
    });

    test('remove() with a non-numeric id refuses without opening the database', async () => {
        const res = await BlobStore.remove('nonsense');
        expect(res).toEqual({ ok: false, code: 'missing', message: BlobStore.MESSAGES.missing });
        expect(store.openCount).toBe(0);
    });

    test('a failed remove() reports failure and changes nothing', async () => {
        const a = await putAt('p1', 100, 100);
        store.errorHook = (s, op) => (op === 'delete' ? domError('UnknownError') : null);
        const res = await BlobStore.remove(a.record.id);
        store.errorHook = null;
        expect(res.ok).toBe(false);
        expect(res.code).toBe('remove-failed');
        expect(res.message).toBe(BlobStore.MESSAGES.removeFailed);
        expect(store.ids()).toEqual([a.record.id]);
    });

    test('removeForPrompt() deletes only that prompt', async () => {
        await putAt('p1', 100, 100);
        await putAt('p1', 100, 200);
        const keep = await putAt('p2', 100, 300);

        const res = await BlobStore.removeForPrompt('p1');
        expect(res).toEqual({ ok: true, removed: 2, message: BlobStore.MESSAGES.removed });
        expect(store.ids()).toEqual([keep.record.id]);
        expect(store.audioIds()).toEqual([keep.record.id]);
    });

    test('removeForPrompt() with an unusable id refuses without opening', async () => {
        const res = await BlobStore.removeForPrompt('   ');
        expect(res).toEqual({
            ok: false, code: 'bad-prompt', message: BlobStore.MESSAGES.removeFailed
        });
        expect(store.openCount).toBe(0);
    });

    /**
     * US-227. The same family as US-217 and deliberately NOT the same answer.
     *
     * remove(id) names one recording, which either existed or did not, so a UI
     * acting on a stale list has to be told its list is stale — hence ok:false.
     * removeForPrompt(promptId) names a STATE, "this prompt keeps nothing", and
     * that state holds when it returns: the request succeeded. Reporting ok:false
     * would make the caller being wired in US-136 paint an error over a no-op,
     * and would force every caller to treat one failure code as success.
     *
     * So the logic is unchanged and only the CLAIM is fixed: MESSAGES.removed
     * ("Recording deleted.") is no longer used when nothing was deleted (BR-3).
     */
    test('US-227 — an empty prompt succeeds without claiming a deletion', async () => {
        const kept = await putAt('p1', 100, 100);

        const res = await BlobStore.removeForPrompt('p2');

        expect(res).toEqual({
            ok: true, removed: 0, message: BlobStore.MESSAGES.nothingToRemove
        });
        expect(res.message).not.toMatch(/deleted/i);
        expect(store.ids()).toEqual([kept.record.id]);
    });

    test('US-227 — remove() and removeForPrompt() answer an absent target differently, on purpose', async () => {
        await putAt('p1', 100, 100);
        // A named thing that is not there: the caller's list is stale.
        expect(await BlobStore.remove(4242)).toEqual({
            ok: false, code: 'missing', message: BlobStore.MESSAGES.missing
        });
        // A state that already holds: the caller has nothing to apologise for.
        expect((await BlobStore.removeForPrompt('nope')).ok).toBe(true);
    });

    test('US-227 — emptying a prompt twice reports the deletion once', async () => {
        await putAt('p1', 100, 100);
        await putAt('p1', 100, 200);

        expect(await BlobStore.removeForPrompt('p1'))
            .toEqual({ ok: true, removed: 2, message: BlobStore.MESSAGES.removed });
        // Idempotent by nature: the second call changes nothing and says so.
        expect(await BlobStore.removeForPrompt('p1'))
            .toEqual({ ok: true, removed: 0, message: BlobStore.MESSAGES.nothingToRemove });
    });

    test('US-227 — a row another tab deleted mid-call is reported as nothing deleted', async () => {
        // The ids come from the ledger read; the deleting transaction is what
        // decides. `gone.length === 0` after a non-empty plan means the other tab
        // won the race, and the copy must not report a deletion for it either.
        const rec = await putAt('p1', 100, 100);
        store.errorHook = (s, op) => {
            if (s === 'recordings' && op === 'get') {
                store.db._store('recordings').records.delete(rec.record.id);
            }
            return null;   // a spy with a side effect, not an injected failure
        };

        const res = await BlobStore.removeForPrompt('p1');
        store.errorHook = null;

        expect(res).toEqual({
            ok: true, removed: 0, message: BlobStore.MESSAGES.nothingToRemove
        });
    });

    test('a failed removeForPrompt() changes nothing', async () => {
        await putAt('p1', 100, 100);
        await putAt('p1', 100, 200);
        store.errorHook = (s, op) => (op === 'delete' ? domError('UnknownError') : null);
        const res = await BlobStore.removeForPrompt('p1');
        store.errorHook = null;
        expect(res.code).toBe('remove-failed');
        expect(store.ids()).toHaveLength(2);
        expect(store.audioIds()).toHaveLength(2);
    });

    test('clear() empties both stores and reports the count', async () => {
        await putAt('p1', 100, 100);
        await putAt('p2', 100, 200);
        const res = await BlobStore.clear();
        expect(res).toEqual({
            ok: true, removed: 2, strandedRemoved: 0, message: BlobStore.MESSAGES.cleared
        });
        expect(store.ids()).toEqual([]);
        expect(store.audioIds()).toEqual([]);
    });

    test('clear() empties the stores rather than deleting the database', async () => {
        await putAt('p1', 100, 100);
        await BlobStore.clear();
        // The schema must still be there: a deleteDatabase() can be blocked by
        // another tab, so the module deliberately does not use it.
        expect(store.db.stores.has('recordings')).toBe(true);
        expect(store.db.stores.has('audio')).toBe(true);
        const again = await putAt('p1', 100, 300);
        expect(again.ok).toBe(true);
        expect(again.record.baseline).toBe(true);   // a fresh baseline
    });

    test('clear() on an empty archive is a no-op success', async () => {
        expect(await BlobStore.clear()).toEqual({
            ok: true, removed: 0, strandedRemoved: 0, message: BlobStore.MESSAGES.cleared
        });
    });

    test('a failed clear() reports failure and leaves the archive alone', async () => {
        await putAt('p1', 100, 100);
        store.errorHook = (s, op) => (op === 'clear' ? domError('UnknownError') : null);
        const res = await BlobStore.clear();
        store.errorHook = null;
        expect(res.ok).toBe(false);
        expect(res.code).toBe('clear-failed');
        expect(res.message).toBe(BlobStore.MESSAGES.clearFailed);
        expect(store.ids()).toHaveLength(1);
    });
});

// ===========================================================================
// Usage reporting
// ===========================================================================

describe('usage()', () => {
    test('reports our own cap and the browser estimate as separate numbers', async () => {
        const realStorage = global.navigator.storage;
        Object.defineProperty(global.navigator, 'storage', {
            value: { estimate: () => Promise.resolve({ usage: 1234, quota: 999999 }) },
            configurable: true
        });
        try {
            await putAt('p1', 1 * MB, 100);
            await putAt('p2', 4 * MB, 200);
            const u = await BlobStore.usage();
            expect(u).toEqual({
                available: true,
                count: 2,
                bytes: 5 * MB,
                strandedCount: 0,
                strandedBytes: 0,
                promptCount: 2,
                maxPerPrompt: 3,
                maxTotalBytes: 50 * MB,
                percentOfCap: 10,
                estimate: { usage: 1234, quota: 999999 }
            });
        } finally {
            Object.defineProperty(global.navigator, 'storage',
                { value: realStorage, configurable: true });
        }
    });

    test('no navigator.storage means estimate:null, not a failure', async () => {
        await putAt('p1', 100, 100);
        const u = await BlobStore.usage();
        expect(u.available).toBe(true);
        expect(u.estimate).toBeNull();
    });

    test('a rejecting estimate() is swallowed', async () => {
        const realStorage = global.navigator.storage;
        Object.defineProperty(global.navigator, 'storage', {
            value: { estimate: () => Promise.reject(new Error('denied')) },
            configurable: true
        });
        try {
            await putAt('p1', 100, 100);
            const u = await BlobStore.usage();
            expect(u.available).toBe(true);
            expect(u.estimate).toBeNull();
        } finally {
            Object.defineProperty(global.navigator, 'storage',
                { value: realStorage, configurable: true });
        }
    });

    test('a throwing estimate() is swallowed', async () => {
        const realStorage = global.navigator.storage;
        Object.defineProperty(global.navigator, 'storage', {
            value: { estimate: () => { throw new Error('boom'); } },
            configurable: true
        });
        try {
            await putAt('p1', 100, 100);
            expect((await BlobStore.usage()).estimate).toBeNull();
        } finally {
            Object.defineProperty(global.navigator, 'storage',
                { value: realStorage, configurable: true });
        }
    });

    test('percentOfCap is clamped at 100 for an archive already over the cap', async () => {
        await BlobStore.available();
        store.seedMeta([
            { id: 500, promptId: 'p1', createdAt: 1, size: 40 * MB, v: 1 },
            { id: 501, promptId: 'p2', createdAt: 2, size: 40 * MB, v: 1 }
        ]);
        const u = await BlobStore.usage();
        expect(u.bytes).toBe(80 * MB);
        expect(u.percentOfCap).toBe(100);
    });

    test('an empty archive is available with zeroes', async () => {
        const u = await BlobStore.usage();
        expect(u.available).toBe(true);
        expect(u).toMatchObject({ count: 0, bytes: 0, promptCount: 0, percentOfCap: 0 });
    });

    test('a failing metadata scan reports unavailable rather than a lie', async () => {
        await putAt('p1', 100, 100);
        store.errorHook = (s, op) => (op === 'getAll' ? domError('UnknownError') : null);
        const u = await BlobStore.usage();
        store.errorHook = null;
        expect(u.available).toBe(false);
        expect(u.count).toBe(0);
        expect(loggedContexts()).toContain('blobstore usage');
    });
});

describe('prompts()', () => {
    test('one entry per prompt, newest prompt first', async () => {
        await putAt('old', 100, 100);
        await putAt('old', 200, 150);
        await putAt('new', 300, 900);

        expect(await BlobStore.prompts()).toEqual([
            { promptId: 'new', count: 1, bytes: 300, newestAt: 900, oldestAt: 900 },
            { promptId: 'old', count: 2, bytes: 300, newestAt: 150, oldestAt: 100 }
        ]);
    });

    test('an empty archive is an empty list', async () => {
        expect(await BlobStore.prompts()).toEqual([]);
    });

    test('a failing scan degrades to an empty list', async () => {
        await putAt('p1', 100, 100);
        store.errorHook = (s, op) => (op === 'getAll' ? domError('UnknownError') : null);
        expect(await BlobStore.prompts()).toEqual([]);
        store.errorHook = null;
        expect(loggedContexts()).toContain('blobstore prompts');
    });
});

// ===========================================================================
// US-228. Bytes the module can see and cannot free
// ===========================================================================

/**
 * After US-220 an unindexable row is ignored rather than acted on, which made
 * every method agree about it — and left its bytes stranded: uncounted by
 * usage(), unreachable by eviction.
 *
 * The resolution is the middle option of three: COUNT them and report them, and
 * touch nothing.
 *
 *   - Repair (rewrite createdAt) invents a date. A row that is genuinely a
 *     learner's month-one recording would then sort as though it were made at a
 *     time it was not, which is the one harm the pinned baseline exists to
 *     prevent, and the absence we overwrote is the only evidence that we do not
 *     know. It also merely makes the row expendable, so it is deletion with a
 *     fabricated date on the way.
 *   - Delete breaks BR-7 outright: we do not know the row is not the learner's,
 *     and a row with a real promptId and a real size and no createdAt is exactly
 *     what a build of this module from BEFORE US-220 wrote when the clock was
 *     unavailable.
 *
 * Counting fails toward a refusal; ignoring fails toward the browser's own quota
 * error, whose retry pays for the invisible bytes with the learner's real
 * in-between recordings. Refusal is the direction this whole file errs in.
 */
describe('US-228 — bytes this module can see and cannot free', () => {
    /** A correct promptId, a real size, no createdAt: not ours, and not garbage. */
    const foreign = (over) => Object.assign(
        { id: 700, promptId: 'p9', createdAt: null, size: 6 * MB, v: 1 }, over
    );

    async function seedForeignRow(over) {
        await BlobStore.available();          // build the schema without writing a row
        const row = foreign(over);
        store.seedMeta([row]);
        store.seedAudio([{ id: row.id, promptId: row.promptId, blob: fakeBlob(row.size) }]);
        return row;
    }

    test('usage() reports them instead of pretending they are not there', async () => {
        await seedForeignRow();
        const real = await putAt('p1', 1 * MB, 100);
        expect(real.ok).toBe(true);

        const u = await BlobStore.usage();

        // `count` and `bytes` still describe the recordings list() can show, so
        // the storage line and the archive screen cannot disagree (US-220)...
        expect(u.count).toBe(1);
        expect(u.bytes).toBe(1 * MB);
        expect(u.promptCount).toBe(1);
        expect(await BlobStore.list('p9')).toEqual([]);
        // ...and the remainder is named rather than dropped on the floor.
        expect(u.strandedCount).toBe(1);
        expect(u.strandedBytes).toBe(6 * MB);
        // percentOfCap is the whole cost to the device, because that is the total
        // put() refuses on: 7MB of 50MB.
        expect(u.percentOfCap).toBe(14);
    });

    test('a row that claims no size is counted as a row and as zero bytes', async () => {
        // All we have is the metadata. Learning the true payload size means
        // deserialising every blob in STORE_AUDIO, which is the cost the two-store
        // split exists to avoid — so the row count is honest and the byte count is
        // an admitted under-count, rather than a number we made up.
        await seedForeignRow({ size: null });
        const u = await BlobStore.usage();
        expect(u.strandedCount).toBe(1);
        expect(u.strandedBytes).toBe(0);
    });

    test('NEVER repaired: the row keeps the date it does not have', async () => {
        await seedForeignRow();
        for (let i = 1; i <= 4; i++) await putAt('p9', 100, i * 100);

        const still = store.metaRows().filter((r) => r.id === 700)[0];
        expect(still.createdAt).toBeNull();
        // And it is not silently promoted into p9's archive either: four writes
        // leave p9 with its own three, and no later recording inherits the
        // stranded row's identity.
        const rows = await BlobStore.list('p9');
        expect(rows).toHaveLength(3);
        expect(rows.some((r) => r.id === 700)).toBe(false);
    });

    test('NEVER deleted: retention and cap eviction both leave it alone (BR-7)', async () => {
        await seedForeignRow({ size: 1 });
        // The shape that forces BOTH kinds of eviction in one write: p1 is at the
        // per-prompt cap with a small middle row, and the archive is close enough
        // to 50MB that the write also has to free space from p2.
        await putAt('p1', 10 * MB, 100);
        const p1mid = await putAt('p1', 1 * MB, 200);
        await putAt('p1', 10 * MB, 300);
        await putAt('p2', 9 * MB, 400);
        const p2mid = await putAt('p2', 9 * MB, 500);
        await putAt('p2', 9 * MB, 600);

        const res = await putAt('p1', 10 * MB, 700);
        expect(res.ok).toBe(true);
        expect(res.evicted).toEqual([p1mid.record.id, p2mid.record.id]);
        // Neither plan could see the stranded row, and neither took it.
        expect(store.ids()).toContain(700);
        expect(store.audioIds()).toContain(700);
    });

    test('the 50MB cap is computed over what the device actually holds', async () => {
        // 45MB stranded plus one 5MB recording. A 6MB recording does not fit, and
        // the eviction that would have made room cannot touch the stranded row, so
        // the write is refused instead of quietly taking the archive past the cap
        // and leaving the browser to complain later.
        await BlobStore.available();
        store.seedMeta([{ id: 800, promptId: 'ghost', createdAt: null, size: 45 * MB, v: 1 }]);
        const kept = await putAt('p1', 5 * MB, 100);
        const idsBefore = store.ids();

        const res = await putAt('p1', 6 * MB, 200);

        expect(res.ok).toBe(false);
        expect(res.code).toBe('full');
        // MESSAGES.full's advice — "delete a few from this prompt" — would not
        // free one byte of this, so the copy says what would (BR-3).
        expect(res.message).toBe(BlobStore.MESSAGES.fullUnmanaged);
        expect(res.message).toContain('cannot open or delete on its own');
        expect(res.message).toContain('Your existing recordings are safe');
        // Refuse, never lose: nothing deleted, nothing written.
        expect(store.ids()).toEqual(idsBefore);
        expect(await BlobStore.list('p1')).toHaveLength(1);
        expect((await BlobStore.get(kept.record.id)).blob.size).toBe(5 * MB);
    });

    test('an archive that is over cap on its own account still gets the ordinary refusal', async () => {
        // One stranded byte must not turn every "no room" into "this app cannot
        // free the space" — that would be the overstatement facing the other way.
        await BlobStore.available();
        store.seedMeta([{ id: 801, promptId: 'ghost', createdAt: null, size: 1, v: 1 }]);
        for (let i = 1; i <= 6; i++) await putAt('p' + i, 8 * MB, i * 100);   // 48MB, all protected

        const res = await putAt('p7', 8 * MB, 9999);

        expect(res.ok).toBe(false);
        expect(res.code).toBe('full');
        expect(res.message).toBe(BlobStore.MESSAGES.full);
    });

    test('clear() is the recovery path, and reports that it took them', async () => {
        await seedForeignRow();
        await putAt('p1', 1 * MB, 100);

        const res = await BlobStore.clear();

        // `removed` still counts only the recordings the learner could see;
        // `strandedRemoved` is what a UI needs to say the invisible space is gone.
        expect(res).toEqual({
            ok: true, removed: 1, strandedRemoved: 1, message: BlobStore.MESSAGES.cleared
        });
        expect(store.ids()).toEqual([]);
        expect(store.audioIds()).toEqual([]);
        const u = await BlobStore.usage();
        expect(u.strandedCount).toBe(0);
        expect(u.strandedBytes).toBe(0);
        expect(u.percentOfCap).toBe(0);
    });

    test('remove(id) can still take exactly one — the only targeted way back', async () => {
        await seedForeignRow();
        // Worth stating rather than "fixing": remove() is documented as
        // learner-initiated and unprotected, and it names ONE id. Targeted
        // recovery is strictly better than clear(), which takes everything. No
        // learner-facing path can produce the id — list() is the only source of
        // ids and never returns this row — so this is a repair tool, not a second
        // answer a UI can trip over.
        expect(await BlobStore.remove(700))
            .toEqual({ ok: true, removed: 1, message: BlobStore.MESSAGES.removed });
        expect(store.ids()).toEqual([]);
        expect(store.audioIds()).toEqual([]);
        expect((await BlobStore.usage()).strandedCount).toBe(0);
    });

    test('every other method still gives exactly one answer about it', async () => {
        await seedForeignRow();
        expect(await BlobStore.list('p9')).toEqual([]);
        expect(await BlobStore.get(700)).toBeNull();
        expect(await BlobStore.openUrl(700)).toMatchObject({ ok: false, code: 'missing' });
        expect(await BlobStore.prompts()).toEqual([]);
        expect(await BlobStore.removeForPrompt('p9')).toEqual({
            ok: true, removed: 0, message: BlobStore.MESSAGES.nothingToRemove
        });
        // Reported in exactly one place, under the one name that is true of it.
        expect((await BlobStore.usage()).strandedCount).toBe(1);
        expect(store.ids()).toEqual([700]);
    });

    test('_strandedSummary counts what a row claims, and skips the write probe', () => {
        expect(BlobStore._strandedSummary([
            { id: 1, promptId: 'p', createdAt: 1, size: 10 },              // usable
            { id: 2, promptId: 'p', createdAt: null, size: 20 },           // no index key
            { id: 3, promptId: 'p', createdAt: undefined, size: 30 },      // ditto
            { id: 4, promptId: '', createdAt: 1, size: 40 },               // no prompt
            { id: 5, createdAt: 1, size: 50 },                            // ditto
            { id: 'x', promptId: 'p', createdAt: 1, size: 60 },           // no usable key
            { id: 0, promptId: '__probe__', createdAt: null, size: 999 },  // PROBE_ID
            { id: 6, promptId: 'p', createdAt: null },                     // claims no size
            null,
            'nonsense'
        ])).toEqual({ count: 6, bytes: 200 });

        expect(BlobStore._strandedSummary([])).toEqual({ count: 0, bytes: 0 });
        expect(BlobStore._strandedSummary(null)).toEqual({ count: 0, bytes: 0 });
    });

    test('a device this module wrote reports zero stranded, whatever it holds', async () => {
        // The whole mechanism is inert on healthy data: put() cannot produce an
        // unindexable row (US-220), so none of these numbers move.
        BlobStore._now = () => undefined;                 // even with a broken clock
        for (let i = 0; i < 8; i++) await BlobStore.put('p' + (i % 3), fakeBlob(1 * MB));
        const u = await BlobStore.usage();
        expect(u.strandedCount).toBe(0);
        expect(u.strandedBytes).toBe(0);
        expect(u.percentOfCap).toBe(Math.round((u.bytes / u.maxTotalBytes) * 100));
    });
});


describe('metadata is advisory, sanitised, and never trusted', () => {
    test('mimeType falls back to the blob type, and meta wins when given', async () => {
        const a = await putAt('p1', 100, 100);
        expect(a.record.mimeType).toBe('audio/webm;codecs=opus');

        const b = await putAt('p1', 100, 200, { mimeType: '  audio/mp4  ' });
        expect(b.record.mimeType).toBe('audio/mp4');

        at(300);
        const c = await BlobStore.put('p2', { size: 100, type: '' });
        expect(c.record.mimeType).toBeNull();
    });

    test('label is trimmed, capped at 200 chars, and dropped when not a string', async () => {
        const a = await putAt('p1', 100, 100, { label: '  month one  ' });
        expect(a.record.label).toBe('month one');

        const b = await putAt('p1', 100, 200, { label: 'x'.repeat(500) });
        expect(b.record.label).toHaveLength(200);

        const c = await putAt('p2', 100, 300, { label: 12345 });
        expect(c.record.label).toBeNull();

        const d = await putAt('p3', 100, 400, { label: '   ' });
        expect(d.record.label).toBeNull();
    });

    test('mimeType is capped at 100 chars', async () => {
        const a = await putAt('p1', 100, 100, { mimeType: 'a'.repeat(300) });
        expect(a.record.mimeType).toHaveLength(100);
    });

    test('durationMs is cleaned: negatives, NaN and rubbish all become null', async () => {
        expect((await putAt('p1', 100, 100, { durationMs: 1500 })).record.durationMs).toBe(1500);
        expect((await putAt('p2', 100, 200, { durationMs: -1 })).record.durationMs).toBeNull();
        expect((await putAt('p3', 100, 300, { durationMs: NaN })).record.durationMs).toBeNull();
        expect((await putAt('p4', 100, 400, { durationMs: 'ages' })).record.durationMs).toBeNull();
        expect((await putAt('p5', 100, 500, {})).record.durationMs).toBeNull();
        expect((await putAt('p6', 100, 600)).record.durationMs).toBeNull();
        expect((await putAt('p7', 100, 700, { durationMs: 0 })).record.durationMs).toBe(0);
    });

    test('a record-shape marker is persisted so a later release can recognise these rows', async () => {
        await putAt('p1', 100, 100);
        expect(store.metaRows()[0].v).toBe(1);
    });

    test('the stored row carries no blob — the split that keeps list() cheap', async () => {
        await putAt('p1', 100, 100);
        expect(store.metaRows()[0].blob).toBeUndefined();
        expect(Object.keys(store.metaRows()[0]).sort()).toEqual(
            ['baseline', 'createdAt', 'durationMs', 'id', 'label', 'mimeType', 'promptId', 'size', 'v']
        );
    });
});

describe('the learner-facing copy', () => {
    test('every message says what did NOT happen', async () => {
        // The one question that matters when reading an error here.
        ['full', 'fullUnmanaged', 'writeFailed', 'removeFailed', 'clearFailed', 'tooLong'].forEach((k) => {
            expect(BlobStore.MESSAGES[k]).toMatch(/safe|unchanged|Nothing has changed|nothing else has changed/i);
        });
    });

    test('no message is empty, and none shouts a code at the learner', () => {
        Object.keys(BlobStore.MESSAGES).forEach((k) => {
            const m = BlobStore.MESSAGES[k];
            expect(typeof m).toBe('string');
            expect(m.length).toBeGreaterThan(15);
            expect(m).not.toMatch(/IndexedDB|QuotaExceeded|undefined|null/);
        });
    });

    test('a plain save gets the compare-with-earlier-tries copy', async () => {
        const res = await putAt('p1', 100, 100);
        expect(res.message).toBe(BlobStore.MESSAGES.saved);
        expect(res.evicted).toEqual([]);
        expect(res.quotaRetry).toBe(false);
    });

    test('FIXED (US-218) — a cap eviction from ANOTHER prompt no longer says "This prompt keeps..."', async () => {
        // 45MB seeded across two prompts; p2's middle recording is the only
        // expendable row. Saving at p3 pushes past the 50MB cap and evicts it.
        await putAt('p1', 9 * MB, 100);
        await putAt('p1', 9 * MB, 200);
        await putAt('p2', 9 * MB, 300);
        const victim = await putAt('p2', 9 * MB, 400);
        await putAt('p2', 9 * MB, 500);

        const res = await putAt('p3', 9 * MB, 600);

        expect(res.ok).toBe(true);
        expect(res.evicted).toEqual([victim.record.id]);
        expect(res.record.promptId).toBe('p3');
        // The evicted row belongs to p2, so the copy talks about "your other
        // prompts", not about the prompt in front of the learner — which still
        // holds exactly one recording and lost nothing.
        expect(res.message).toBe(BlobStore.MESSAGES.savedFreedSpace);
        expect(res.message).not.toContain('This prompt keeps');
        expect(res.message).toContain('no room left');
        // And the prompt that DID lose one is named, so a caller can say so.
        expect(res.evictedPrompts).toEqual(['p2']);
        expect(res.evictedElsewhere).toEqual([victim.record.id]);
        expect(await BlobStore.list('p3')).toHaveLength(1);
        expect(await BlobStore.list('p2')).toHaveLength(2);
    });

    test('a retention eviction at THIS prompt still gets the "this prompt keeps" copy', async () => {
        await putAt('p1', 100, 100);
        const mid = await putAt('p1', 100, 200);
        await putAt('p1', 100, 300);
        const res = await putAt('p1', 100, 400);

        expect(res.message).toBe(BlobStore.MESSAGES.savedEvicted);
        expect(res.evicted).toEqual([mid.record.id]);
        expect(res.evictedPrompts).toEqual(['p1']);
        expect(res.evictedElsewhere).toEqual([]);
    });

    test('losing one here AND one elsewhere gets copy that admits both', async () => {
        // p1 is at the per-prompt cap with a small middle row (a retention
        // victim); p2 holds an expendable middle row; the archive is at the 50MB
        // cap, so the write also has to free space from p2.
        await putAt('p1', 10 * MB, 100);                  // p1 baseline
        const p1mid = await putAt('p1', 1 * MB, 200);     // retention victim
        await putAt('p1', 10 * MB, 300);                  // p1 newest
        await putAt('p2', 9 * MB, 400);                   // p2 baseline
        const p2mid = await putAt('p2', 9 * MB, 500);     // cap victim
        await putAt('p2', 9 * MB, 600);                   // p2 newest
        expect(store.usedBytes()).toBe(48 * MB);

        const res = await putAt('p1', 10 * MB, 700);      // 48 - 1 + 10 = 57MB

        expect(res.ok).toBe(true);
        expect(res.evicted).toEqual([p1mid.record.id, p2mid.record.id]);
        expect(res.evictedPrompts).toEqual(['p1', 'p2']);
        expect(res.evictedElsewhere).toEqual([p2mid.record.id]);
        expect(res.message).toBe(BlobStore.MESSAGES.savedEvictedAndFreedSpace);
        expect(res.message).toContain('at this prompt');
        expect(res.message).toContain('your other prompts');
    });

    test('FIXED (US-220) — a null durationMs stays null on every read', async () => {
        // cleanNumber() no longer runs `Number(value)` on anything that is not a
        // number or a numeric string, so `null` stays null instead of becoming 0
        // the moment the row is read back.
        const written = await putAt('p1', 100, 100);        // no durationMs given
        expect(written.record.durationMs).toBeNull();
        expect(store.metaRows()[0].durationMs).toBeNull();  // null really is stored

        const listed = (await BlobStore.list('p1'))[0];
        const got = await BlobStore.get(written.record.id);
        expect(listed.durationMs).toBeNull();
        expect(got.durationMs).toBeNull();

        // One recording, one duration: a UI can now tell "not measured" from
        // "0:00" instead of showing a length nobody ever recorded.
        expect(listed.durationMs).toBe(written.record.durationMs);
        expect(got.durationMs).toBe(written.record.durationMs);
    });

    test('FIXED (US-220) — a measured duration of 0 is still 0, not "not measured"', async () => {
        const written = await putAt('p1', 100, 100, { durationMs: 0 });
        expect(written.record.durationMs).toBe(0);
        expect((await BlobStore.list('p1'))[0].durationMs).toBe(0);
        expect((await BlobStore.get(written.record.id)).durationMs).toBe(0);
    });

    test('cleanNumber rejects every value Number() would silently turn into 0', async () => {
        // The class of bug behind US-220: each of these used to become 0.
        const cases = [null, false, true, '', '   ', [], {}, [7]];
        for (let i = 0; i < cases.length; i++) {
            const res = await putAt('p' + i, 100, 100 + i, { durationMs: cases[i] });
            expect(res.record.durationMs).toBeNull();
        }
        // ...while genuine numbers and numeric strings still get through.
        expect((await putAt('pn', 100, 900, { durationMs: '2500' })).record.durationMs).toBe(2500);
        expect((await putAt('pm', 100, 901, { durationMs: 2500 })).record.durationMs).toBe(2500);
    });

    test('FIXED (US-220) — a row IndexedDB cannot index is ignored everywhere, not counted in one place', async () => {
        await BlobStore.available();
        store.seedMeta([
            { id: 700, promptId: 'p9', createdAt: null, size: null, durationMs: false, v: 1 }
        ]);
        store.seedAudio([{ id: 700, promptId: 'p9', blob: fakeBlob(100) }]);

        // A compound index key containing `null` is not a valid key, so this row
        // is absent from IDX_PROMPT_TIME and list() — which reads through it —
        // can never return the row. usableRows() therefore refuses it outright
        // instead of coercing it to the epoch, so every method gives the same
        // answer: there is no such recording.
        expect(await BlobStore.list('p9')).toEqual([]);
        const u = await BlobStore.usage();
        expect(u.count).toBe(0);
        expect(u.bytes).toBe(0);
        expect(await BlobStore.prompts()).toEqual([]);
        expect(await BlobStore.get(700)).toBeNull();
        expect(await BlobStore.openUrl(700)).toMatchObject({ ok: false, code: 'missing' });

        // Consequence, since US-228 reported rather than hidden: the row is still
        // physically there and no read admits it exists, but its bytes are now
        // counted and named as stranded, and clear() is the whole-archive way out.
        expect(store.ids()).toEqual([700]);
        expect(await BlobStore.usage()).toMatchObject({ strandedCount: 1, strandedBytes: 0 });
        expect((await BlobStore.clear()).ok).toBe(true);
        expect(store.ids()).toEqual([]);
        expect(store.audioIds()).toEqual([]);
    });

    test('a row whose createdAt is garbage but indexable is still kept, dated to the epoch', async () => {
        // The distinction usableRows() draws: "no key" is fatal, "a key that is
        // not a number" is not — such a row IS in the index, so list() can show
        // it and the learner can act on it.
        await BlobStore.available();
        store.seedMeta([{ id: 701, promptId: 'p9', createdAt: 'whenever', size: 100, v: 1 }]);
        store.seedAudio([{ id: 701, promptId: 'p9', blob: fakeBlob(100) }]);

        const rows = await BlobStore.list('p9');
        expect(rows).toHaveLength(1);
        expect(rows[0].createdAt).toBe(0);
        expect((await BlobStore.usage()).count).toBe(1);
    });

    test('put() can never write a row that the index would skip', async () => {
        // Even with a broken clock: `createdAt` is coerced to a real key.
        BlobStore._now = () => undefined;
        const res = await BlobStore.put('p1', fakeBlob(100));
        expect(res.ok).toBe(true);
        expect(res.record.createdAt).toBe(0);
        expect(store.metaRows()[0].createdAt).toBe(0);
        expect(await BlobStore.list('p1')).toHaveLength(1);
    });

    test('the policy constants are exported so the UI never repeats the numbers', () => {
        expect(BlobStore.DB_NAME).toBe('englishPortalMedia');
        expect(BlobStore.DB_VERSION).toBe(1);
        expect(BlobStore.MAX_PER_PROMPT).toBe(3);
        expect(BlobStore.PIN_BASELINE).toBe(true);
        expect(BlobStore.MAX_TOTAL_BYTES).toBe(50 * MB);
        expect(BlobStore.MAX_RECORDING_BYTES).toBe(10 * MB);
        expect(BlobStore.MAX_LIVE_URLS).toBe(8);
        // DB_VERSION is IndexedDB's store shape, NOT Migrations.SCHEMA_VERSION.
        const Migrations = require('../../js/core/migrations.js');
        expect(BlobStore.DB_VERSION).not.toBe(Migrations.SCHEMA_VERSION);
    });
});

describe('logError never breaks a save', () => {
    test('it falls back to console.warn when there is no AppErrorHandler', async () => {
        delete global.AppErrorHandler;
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            install({ openMode: 'error' });
            expect((await BlobStore.available()).ok).toBe(false);
            expect(warn).toHaveBeenCalled();
            expect(warn.mock.calls[0][0]).toContain('[blobstore]');
        } finally {
            warn.mockRestore();
        }
    });

    test('a throwing logger cannot turn a handled failure into a rejection', async () => {
        global.AppErrorHandler = { logError: () => { throw new Error('logger down'); } };
        install({ openMode: 'error' });
        await expect(BlobStore.available()).resolves.toMatchObject({ ok: false });
        await expect(BlobStore.put('p1', fakeBlob(1))).resolves.toMatchObject({ ok: false });
    });
});

// ===========================================================================
// Whole-archive behaviour over time — the property E.7 actually cares about
// ===========================================================================

describe('a term of use', () => {
    test('twenty prompts, ten attempts each, stays inside both caps and keeps every baseline', async () => {
        const baselines = [];
        let t = 1000;
        for (let p = 0; p < 20; p++) {
            for (let n = 0; n < 10; n++) {
                t += 1000;
                const res = await putAt('prompt-' + p, 200 * 1024, t);
                expect(res.ok).toBe(true);
                if (n === 0) baselines.push(res.record.id);
            }
        }

        const u = await BlobStore.usage();
        expect(u.count).toBe(20 * BlobStore.MAX_PER_PROMPT);
        expect(u.bytes).toBeLessThanOrEqual(BlobStore.MAX_TOTAL_BYTES);
        expect(u.promptCount).toBe(20);

        // Every month-one recording is still there and still playable.
        const ids = store.ids();
        baselines.forEach((id) => expect(ids).toContain(id));
        expect(store.ids()).toEqual(store.audioIds());     // no orphans anywhere

        const rows = await BlobStore.list('prompt-7');
        expect(rows).toHaveLength(3);
        expect(rows[2].baseline).toBe(true);
        expect((await BlobStore.get(rows[2].id)).blob.size).toBe(200 * 1024);
    });

    test('metadata rows and payload rows never drift apart', async () => {
        // A mixed workload: saves, retention evictions, cap evictions, removes.
        let t = 0;
        for (let i = 0; i < 40; i++) {
            t += 100;
            await putAt('p' + (i % 7), 1 * MB, t);
        }
        await BlobStore.remove(store.ids()[0]);
        await BlobStore.removeForPrompt('p3');
        expect(store.ids()).toEqual(store.audioIds());

        await BlobStore.clear();
        expect(store.ids()).toEqual([]);
        expect(store.audioIds()).toEqual([]);
    });
});

// ===========================================================================
// The last few edges
// ===========================================================================

describe('hostile environments', () => {
    test('a sandboxed iframe where merely READING window.indexedDB throws', () => {
        const desc = Object.getOwnPropertyDescriptor(global, 'indexedDB');
        Object.defineProperty(global, 'indexedDB', {
            get() { throw new Error('blocked by sandbox policy'); },
            configurable: true
        });
        try {
            // The getter must already be in place: _useEnvironment(null) re-reads
            // the real globals immediately.
            BlobStore._useEnvironment(null);
            // readGlobal() swallows it: a getter that throws must not crash the
            // first paint of the speaking exercise.
            expect(BlobStore.isSupported()).toBe(false);
        } finally {
            if (desc) Object.defineProperty(global, 'indexedDB', desc);
            else delete global.indexedDB;
        }
    });

    test('a browser with no Blob constructor reports no-blob from the deep probe', async () => {
        const RealBlob = global.Blob;
        global.Blob = function () { throw new Error('no Blob in this webview'); };
        try {
            const res = await BlobStore.available({ deep: true });
            expect(res).toEqual({
                ok: false, code: 'no-blob', message: BlobStore.MESSAGES.unavailable
            });
        } finally {
            global.Blob = RealBlob;
        }
    });

    test('a failing ledger read on the quota retry refuses the write and loses nothing', async () => {
        const seeded = [
            await putAt('p1', 4 * MB, 100),
            await putAt('p1', 4 * MB, 200),
            await putAt('p1', 4 * MB, 300)
        ];
        store.budget = 14 * MB;

        // getAll #1 is the failing first attempt's own ledger read; #2 is the
        // retry's, inside the transaction that would also do the freeing.
        let getAlls = 0;
        store.errorHook = (s, op) => {
            if (s === 'recordings' && op === 'getAll') {
                getAlls += 1;
                if (getAlls === 2) return domError('UnknownError');
            }
            return null;
        };

        const res = await putAt('p2', 4 * MB, 400);
        store.errorHook = null;

        expect(res.ok).toBe(false);
        // Since US-216 the freeing lives inside the retry transaction, so a
        // broken ledger read there aborts that transaction: the outcome is a
        // plain write failure, and its copy is the one that says so.
        expect(res.code).toBe('write-failed');
        expect(res.message).toBe(BlobStore.MESSAGES.writeFailed);
        expect(loggedContexts()).toContain('blobstore put');
        // Nothing was freed, so nothing was lost.
        expect(store.ids()).toEqual(seeded.map((r) => r.record.id));
        expect(store.audioIds()).toEqual(seeded.map((r) => r.record.id));
    });

    test('the default _now() really is the clock', () => {
        const before = Date.now();
        const t = REAL_NOW();
        expect(typeof t).toBe('number');
        expect(t).toBeGreaterThanOrEqual(before);
        expect(t).toBeLessThanOrEqual(Date.now());
    });

    test('revoke() works in a realm with no URL object at all', async () => {
        const rec = await putAt('p1', 100, 100);
        const opened = await BlobStore.openUrl(rec.record.id);
        const realURL = global.URL;
        try {
            // Deliberately after the url was minted: a page teardown can pull URL
            // out from under a pending revoke.
            delete global.URL;
            expect(opened.revoke()).toBe(true);
            expect(BlobStore.liveUrlCount()).toBe(0);
        } finally {
            global.URL = realURL;
        }
    });

    test('a put() while another tab holds the database reports the actionable message', async () => {
        install({ openMode: 'blocked' });
        const res = await BlobStore.put('p1', fakeBlob(100));
        expect(res).toEqual({
            ok: false, code: 'blocked-by-other-tab', message: BlobStore.MESSAGES.otherTab
        });
        expect(res.message).toContain('Close the other tab');
    });

    test('the module never touches localStorage', async () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem');
        const removeItem = jest.spyOn(Storage.prototype, 'removeItem');
        try {
            await putAt('p1', 100, 100);
            await BlobStore.list('p1');
            await BlobStore.usage();
            await BlobStore.clear();
            // CON-3: localStorage for state, IndexedDB for blobs. Patched on the
            // PROTOTYPE, not the instance — jsdom ignores instance patching.
            expect(setItem).not.toHaveBeenCalled();
            expect(removeItem).not.toHaveBeenCalled();
        } finally {
            setItem.mockRestore();
            removeItem.mockRestore();
        }
    });
});

describe('the per-recording cap is the only size guard, by construction', () => {
    test('US-221 — an over-cap recording reports the limit it actually broke', async () => {
        // There used to be a second `size > MAX_TOTAL_BYTES` guard immediately
        // after the 10MB one, which could never fire. It is gone, and the
        // invariant that made it dead is now in the constant: MAX_RECORDING_BYTES
        // is clamped to MAX_TOTAL_BYTES, so one recording can never exceed the
        // whole archive and there is nothing left to check twice.
        expect(BlobStore.MAX_RECORDING_BYTES).toBeLessThanOrEqual(BlobStore.MAX_TOTAL_BYTES);
        const res = await BlobStore.put('p1', fakeBlob(BlobStore.MAX_TOTAL_BYTES + 1));
        expect(res.code).toBe('too-large');
        // The number the learner can act on is the per-recording rule they broke.
        expect(res.limit).toBe(BlobStore.MAX_RECORDING_BYTES);
        expect(res.message).toBe(BlobStore.MESSAGES.tooLong);
        expect(store.openCount).toBe(0);
    });

    test('the source no longer contains the unreachable guard', () => {
        const src = fs.readFileSync(MODULE_PATH, 'utf8');
        // Pinned so it cannot come back by copy-paste: no refusal anywhere may
        // report MAX_TOTAL_BYTES as a per-recording limit.
        expect(src).not.toMatch(/limit:\s*MAX_TOTAL_BYTES/);
    });

    test('a recording of exactly MAX_RECORDING_BYTES is accepted', async () => {
        const res = await BlobStore.put('p1', fakeBlob(BlobStore.MAX_RECORDING_BYTES));
        expect(res.ok).toBe(true);
    });
});

describe('a request that fires a second event after settling', () => {
    test('the open latch absorbs a late error and a late onblocked', async () => {
        install({ extraErrorAfterSuccess: true });
        // openDb() resolves once and only once; the late events must not turn a
        // working database into a rejected promise (property 1: nothing rejects).
        expect(await BlobStore.available()).toEqual({ ok: true, code: 'ok', message: null });
        const res = await putAt('p1', 100, 100);
        expect(res.ok).toBe(true);
        expect(await BlobStore.list('p1')).toHaveLength(1);
    });
});
