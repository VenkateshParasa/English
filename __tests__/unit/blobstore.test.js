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
 *   3. STORAGE-PRESSURE EVICTION. A real browser can evict the whole origin
 *      between two calls. Nothing here models that.
 *   4. SAFARI PRIVATE BROWSING. Modelled as "open() throws", which is what it
 *      historically did. Whether today's builds fail the same way is unproven.
 *   5. CROSS-TAB `versionchange` / `blocked`. `onblocked` is fired on command;
 *      no second connection actually exists, so the close-and-reopen handshake
 *      in openDb()'s `db.onversionchange` is exercised only by calling it.
 *   6. TRANSACTION AUTO-COMMIT TIMING. The fake drains its request queue in one
 *      microtask and then commits. A real transaction commits the moment its
 *      queue drains, which is why runTx() forbids awaiting mid-transaction —
 *      that hazard cannot be reproduced here, so this suite cannot prove the
 *      module is free of it. It can only prove the chaining it does use works.
 *   7. WEBKIT'S SILENT open(). Modelled as "fire no event", which is the
 *      observable symptom; the 8s OPEN_TIMEOUT_MS is exercised with fake timers.
 *
 * DEFECTS THIS SUITE FOUND — see the `⚠️ DEFECT` blocks, pinned as current
 * behaviour in the house style of srs.test.js / portability.test.js so the suite
 * stays green and the finding stays visible:
 *
 *   A. put() can report `full` — whose learner copy is "Your existing
 *      recordings are safe" — AFTER permanently deleting an existing recording.
 *      The quota path evicts in its OWN transaction (evictForQuota, :918), so
 *      when the retry also hits quota there is nothing to roll it back. This is
 *      the one that contradicts NFR-10 ("never silent data loss") and the
 *      module's own stated property 2. See "quota › ⚠️ DEFECT A".
 *   B. remove(id) reports `{ ok:true, removed:1, message:'Recording deleted.' }`
 *      for an id that was never in the store. `removeIds` resolves with
 *      `ids.slice()` (:941) — what it was asked to delete, not what IndexedDB
 *      held. IDBObjectStore.delete() on an absent key succeeds silently.
 *   C. MESSAGES.savedEvicted ("This prompt keeps your first recording and your
 *      two most recent, so an in-between one was removed") is also used when the
 *      evicted row belonged to a DIFFERENT prompt, via the 50MB cap path. put()
 *      picks the message from `evicted.length` alone (:826).
 *   D. openUrl() on a device with no IndexedDB reports `missing` — "That
 *      recording is no longer on this device" — rather than an unavailability
 *      code, because get() flattens both cases to null.
 *   E. `cleanNumber(null) === 0`, because `Number(null) === 0`. usableRows()
 *      (:307) runs every stored row through it, so a recording saved with no
 *      durationMs is reported as `null` by put() and as `0` by list()/get():
 *      the same recording, two different answers. A row with a null `createdAt`
 *      is coerced to the epoch AND is absent from IDX_PROMPT_TIME, so it is
 *      counted by usage()/prompts() while being invisible to list().
 *
 * Also pinned, not defects but worth not re-deriving: the `size > MAX_TOTAL_BYTES`
 * guard at :777-779 is unreachable (the 10MB per-recording check fires first), and
 * the `if (keep[row.id]) return;` guard in planRetention is defensive only (the
 * early return at :548 makes a revisit impossible).
 *
 * Requirements under test: FR-DATA-6 (blobs in IndexedDB, size cap, eviction),
 * NFR-10 (quota handled with a clear message, never silent data loss),
 * CURRICULUM.md Strand E.7 (hear month-one against month-three).
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
        const projected = [row(1, 500), row(2, 500), row(3, 500), row(Infinity, 500)];
        const victims = BlobStore._planRetention(projected);
        expect(victims).not.toContain(Infinity);
        // NEW_ID = +Infinity so byAge sorts the new row LAST on a tie: the real
        // oldest is pinned and the middle one goes.
        expect(victims).toEqual([2]);
    });

    test('ties are broken by id, so eviction is a total order', () => {
        const projected = [row(5, 1), row(3, 1), row(4, 1), row(Infinity, 1)];
        // Oldest by (createdAt, id) is 3; newest kept are 5 and the new row.
        expect(BlobStore._planRetention(projected)).toEqual([4]);
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

    test('⚠️ DEFECT A — `full` claims "your existing recordings are safe" AFTER deleting one', async () => {
        // Seeded so that the ONE expendable recording is too small to make the
        // retry fit: the quota eviction happens, the retry fails anyway, and the
        // learner is told nothing was lost.
        const base = await putAt('p1', 4 * MB, 100);
        const mid = await putAt('p1', 1 * MB, 200);      // the only expendable row
        const newest = await putAt('p1', 4 * MB, 300);
        store.budget = 10 * MB;                          // holding 9MB

        const res = await putAt('p2', 4 * MB, 400);

        // Refused, exactly once retried.
        expect(res.ok).toBe(false);
        expect(res.code).toBe('full');
        expect(audioPuts()).toBe(5);                     // 3 seeds + attempt + one retry
        // The new recording was not written — that half of the promise holds.
        expect(store.metaRows().some((r) => r.promptId === 'p2')).toBe(false);

        // ⚠️ ...but an EXISTING recording is gone, because evictForQuota() runs in
        // its own transaction (js/core/blobstore.js:918-931) and there is nothing
        // to roll it back when the retry fails. The message the learner sees is
        // MESSAGES.full, which states the opposite.
        expect(res.message).toContain('Your existing recordings are safe');
        expect(store.ids()).not.toContain(mid.record.id);
        expect(await BlobStore.get(mid.record.id)).toBeNull();
        expect(await BlobStore.list('p1')).toHaveLength(2);
        // The two protected rows did survive.
        expect(store.ids()).toEqual([base.record.id, newest.record.id]);
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
        // ⚠️ Not `toEqual(rec.record)`: durationMs comes back as 0 rather than
        // null — see DEFECT E.
        expect(opened.record).toEqual(Object.assign({}, rec.record, { durationMs: 0 }));
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
        expect(res).toEqual({ ok: true, removed: 0, message: BlobStore.MESSAGES.removed });
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

    test('⚠️ DEFECT D — openUrl() on a device with no IndexedDB says "no longer on this device"', async () => {
        BlobStore._useEnvironment({ indexedDB: null, IDBKeyRange: null });
        const res = await BlobStore.openUrl(1);
        // get() flattens "unavailable" and "not found" to null, so openUrl cannot
        // tell them apart and reports the one that is actively misleading: the
        // learner is told their recording is gone when it was never saveable.
        expect(res.code).toBe('missing');
        expect(res.message).toBe(BlobStore.MESSAGES.missing);
        expect(res.message).toContain('no longer on this device');
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
            durationMs: 0,          // ⚠️ put() reported null for this — DEFECT E
            label: 'first try', baseline: true
        });
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

    test('⚠️ DEFECT B — remove() reports success for an id that was never there', async () => {
        await putAt('p1', 100, 100);
        const res = await BlobStore.remove(9999);
        // removeIds() resolves with `ids.slice()` — the ids it was ASKED to delete,
        // not the ones IndexedDB actually held (js/core/blobstore.js:941). An
        // IDBObjectStore.delete() for an absent key succeeds silently, so nothing
        // upstream notices. A UI that says "Recording deleted." on a stale list
        // entry therefore confirms a deletion that never happened.
        expect(res).toEqual({ ok: true, removed: 1, message: BlobStore.MESSAGES.removed });
        expect(store.ids()).toHaveLength(1);
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
        expect(res).toEqual({ ok: true, removed: 2, message: BlobStore.MESSAGES.cleared });
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
        expect(await BlobStore.clear())
            .toEqual({ ok: true, removed: 0, message: BlobStore.MESSAGES.cleared });
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
// Metadata sanitisation and the learner-facing copy
// ===========================================================================

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
        ['full', 'writeFailed', 'removeFailed', 'clearFailed', 'tooLong'].forEach((k) => {
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

    test('⚠️ DEFECT C — a cap eviction from ANOTHER prompt still says "This prompt keeps..."', async () => {
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
        // The evicted row belongs to p2, but the message the learner reads while
        // saving at p3 is savedEvicted: "This prompt keeps your first recording
        // and your two most recent, so an in-between one was removed." put() picks
        // the message from `evicted.length` alone (js/core/blobstore.js:826) and
        // cannot distinguish a retention eviction from a cap eviction — so the
        // learner is told p3 dropped an in-between recording when p3 has only one,
        // and is not told that a recording at a DIFFERENT prompt was deleted.
        expect(res.message).toBe(BlobStore.MESSAGES.savedEvicted);
        expect(res.message).toContain('This prompt keeps');
        expect(await BlobStore.list('p3')).toHaveLength(1);
        expect(await BlobStore.list('p2')).toHaveLength(2);
    });

    test('⚠️ DEFECT E — a null durationMs comes back as 0 on every read', async () => {
        // cleanNumber() is `Number(value)` guarded by isFinite && >= 0, and
        // `Number(null) === 0`. usableRows() runs every stored row through it
        // (js/core/blobstore.js:307), so the null that put() wrote and reported
        // becomes 0 the moment it is read back.
        const written = await putAt('p1', 100, 100);        // no durationMs given
        expect(written.record.durationMs).toBeNull();
        expect(store.metaRows()[0].durationMs).toBeNull();  // null really is stored

        const listed = (await BlobStore.list('p1'))[0];
        const got = await BlobStore.get(written.record.id);
        expect(listed.durationMs).toBe(0);
        expect(got.durationMs).toBe(0);

        // So the same recording reports two different durations depending on
        // which call produced the record, and a UI rendering `durationMs` shows
        // "0:00" for every recording whose length was never measured.
        expect(listed.durationMs).not.toBe(written.record.durationMs);
    });

    test('⚠️ DEFECT E, cont. — a row with no createdAt is coerced to the epoch and vanishes from list()', async () => {
        await BlobStore.available();
        store.seedMeta([
            { id: 700, promptId: 'p9', createdAt: null, size: null, durationMs: false, v: 1 }
        ]);
        store.seedAudio([{ id: 700, promptId: 'p9', blob: fakeBlob(100) }]);

        // usableRows() coerces rather than rejects: `cleanNumber(null) || 0`, so
        // the module treats this row as a valid recording dated to the epoch.
        const u = await BlobStore.usage();
        expect(u.count).toBe(1);
        const got = await BlobStore.get(700);
        expect(got.createdAt).toBe(0);
        expect(got.size).toBe(0);
        expect(got.durationMs).toBe(0);
        expect((await BlobStore.prompts())[0]).toMatchObject({ promptId: 'p9', count: 1 });

        // ...but IndexedDB will not index a record whose compound key contains
        // `null`, so list() — which reads through IDX_PROMPT_TIME — cannot see it.
        // The archive screen shows nothing while usage() insists a recording is
        // there, and retention/eviction (which read via getAll) will act on it.
        expect(await BlobStore.list('p9')).toEqual([]);
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

    test('a failure while freeing space for the quota retry is swallowed, and the write refused', async () => {
        const seeded = [
            await putAt('p1', 4 * MB, 100),
            await putAt('p1', 4 * MB, 200),
            await putAt('p1', 4 * MB, 300)
        ];
        store.budget = 14 * MB;

        // getAll #1 is the failing commit's own ledger read; #2 is
        // evictForQuota()'s readAllMeta, which we break.
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
        expect(res.code).toBe('full');
        expect(loggedContexts()).toContain('blobstore quota eviction');
        // Nothing was freed, so nothing was lost.
        expect(store.ids()).toEqual(seeded.map((r) => r.record.id));
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

describe('dead code, pinned so nobody has to re-derive it', () => {
    test('the "bigger than the whole archive" guard is unreachable', async () => {
        // put() checks `size > MAX_RECORDING_BYTES` (10MB) and only then
        // `size > MAX_TOTAL_BYTES` (50MB), so the second guard — and its
        // `limit: MAX_TOTAL_BYTES` — can never fire. Every over-cap recording
        // reports the per-recording limit. js/core/blobstore.js:777-779.
        expect(BlobStore.MAX_RECORDING_BYTES).toBeLessThan(BlobStore.MAX_TOTAL_BYTES);
        const res = await BlobStore.put('p1', fakeBlob(BlobStore.MAX_TOTAL_BYTES + 1));
        expect(res.code).toBe('too-large');
        expect(res.limit).toBe(BlobStore.MAX_RECORDING_BYTES);
        expect(res.limit).not.toBe(BlobStore.MAX_TOTAL_BYTES);
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
