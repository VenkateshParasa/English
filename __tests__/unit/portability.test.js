/**
 * Portability — export, restore, and reset review history.
 *
 * `js/core/portability.js` is the only backup a learner has (`CON-3`: browser
 * storage only), so `BR-7` ("learner data is portable and recoverable — never
 * silently lost") is enforced here or nowhere. These tests are built around the
 * four properties the module actually claims, in the order they would hurt:
 *
 *   1. A round trip is BYTE-EXACT. Values are carried as raw localStorage
 *      strings and never re-parsed, so a record written by a newer release
 *      survives export/import without being re-serialised into a shape this
 *      build invented (`FR-DATA-4`).
 *   2. VALIDATE BEFORE WRITE. Every rejection below is asserted to leave
 *      localStorage byte-identical *and* to have called neither setItem nor
 *      removeItem — the store is not merely restored, it is never touched.
 *   3. ROLLBACK IS VERIFIED, NOT ASSUMED. The module decides success by reading
 *      the store back, not by whether an exception was thrown. Both halves of
 *      that distinction are pinned: a rollback where every write throws but the
 *      data is intact reports `quota`; a rollback where nothing throws but the
 *      data is gone reports `rollback-failed`.
 *   4. Export is by DENY-LIST, so a key a future feature adds is carried
 *      automatically. Asserted in both directions against the keys the app
 *      really writes.
 *
 * WHAT IS STUBBED, and therefore what these tests do NOT prove:
 *
 *   - QUOTA. jsdom has no storage quota, so `Storage.prototype.setItem` is
 *     stubbed to throw a synthetic `QuotaExceededError`. That exercises the
 *     rollback logic exactly, but it does NOT prove a real browser throws where
 *     we assume it does, nor that a rollback fits in the space a failed commit
 *     freed. Only a real 5MB store can show that.
 *   - `URL.createObjectURL` / `revokeObjectURL`. jsdom does not implement them
 *     at all, so they are jest.fn()s. The download itself is therefore unproven:
 *     these tests show the anchor is built, clicked, detached and the URL
 *     revoked on the next turn, not that a file lands in a downloads folder.
 *   - `FileReader`, in the UI block only, replaced with a synchronous fake so
 *     the read path is deterministic. Real read errors are not exercised.
 *   - `window.confirm`, which jsdom stubs as a not-implemented no-op.
 *   - `TextEncoder` is ABSENT from jest-environment-jsdom, so `byteLength()`
 *     silently falls back to `String.length` and every byte figure here is in
 *     UTF-16 code units rather than UTF-8. All size fixtures are ASCII, where
 *     the two agree; see "TESTABILITY NOTE" in the storageInfo block.
 *
 * `__tests__/setup.js` clears localStorage after each test, which is necessary
 * but NOT sufficient for this module: `SRS.records`, and the module-level
 * `suspended` latch behind `writesSuspended()`, are in-memory and survive it.
 * Both are handled in beforeEach — the latch through the `_resetWritesSuspended`
 * seam, so this file has no declaration-order dependency and survives
 * `--randomize`.
 *
 * WHAT THIS SUITE FOUND, AND WHAT WAS DONE ABOUT IT. Three defects were pinned
 * here as current behaviour with a `⚠️` marker in the house style of
 * __tests__/unit/srs.test.js; all three are now fixed and the pins below assert
 * the fixed behaviour instead:
 *
 *   A. US-198 — `resetReviewHistory()` reported SUCCESS when the removal failed.
 *      SRS.reset() swallows its own removeItem error (js/core/srs.js:1408), so
 *      the learner was told "Your review history is cleared" while `srsData` was
 *      still in localStorage and came back on the next reload. The reset path now
 *      reads the store back, exactly as rollback() does, and re-syncs SRS from
 *      storage so the badge cannot show a zero the store does not agree with.
 *   B. US-199 — `MESSAGES.rollbackFailed` could name a recovery key that was
 *      never written. `writePreImportBackup()`'s return value is no longer
 *      discarded, and there are now three truthful endings: a copy exists, a copy
 *      does not exist and data is lost, or there was nothing here to lose.
 *   C. US-200 — `resetReviewHistory()` filed the migration backup under the
 *      CURRENT SCHEMA_VERSION whatever era the data was from. It now decides the
 *      era from the data's SHAPE, the same way migrations.js does, so pre-fix
 *      data lands under `srsData.bak.v1` where a recovery note would look for it.
 *
 * TWO TEST SEAMS were added with them, both no-ops in the browser:
 *   - `Portability._resetWritesSuspended()` (US-207), for the one-way latch.
 *   - `Portability._reload()` (US-208), the reload after a successful import.
 *     jsdom's `location.reload` is a not-implemented stub, `Location` is
 *     unforgeable so it cannot be spied on, and assigning to `window.location`
 *     navigates rather than replaces — so this was the module's only unreachable
 *     line. In production the seam still calls `global.location.reload()`.
 */

const Portability = require('../../js/core/portability.js');
const Migrations = require('../../js/core/migrations.js');
const SRS = require('../../js/core/srs.js');

const P = Portability;
const PRE_IMPORT_KEY = P.PRE_IMPORT_KEY;          // 'learnerData.preImport.bak'
const RESET_BAK = P.SRS_RESET_BACKUP_KEY;         // 'srsData.bak.reset'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * A progress record in the CURRENT shape. Carries `completedExercises` and
 * `streak` because FR-DATA-5 promises both survive a review-history reset, and
 * a PROGRESS_MARKER (`stats`) because that is what separates "our data" from
 * "valid JSON of something else".
 */
const progressRecord = (over = {}) => Object.assign({
    schemaVersion: Migrations.SCHEMA_VERSION,
    currentSection: 'vocabulary',
    currentDifficulty: 'everyday',
    streak: 7,
    stats: { exercisesCompleted: 41, correctAnswers: 33 },
    completedExercises: { vocabulary: ['vocabulary_everyday_0', 'vocabulary_everyday_3'] },
    exerciseHistory: [{ id: 'vocabulary_everyday_0', difficulty: 'everyday', at: 1700000000000 }]
}, over);

const PROGRESS = JSON.stringify(progressRecord());

/**
 * `srsData` in the CURRENT typed-key shape. It matters that this is already
 * migrated: a successful import calls SRS.load(), which migrates legacy
 * bare-word keys and writes them back — see "the SRS resync rewrites srsData".
 */
const SRSDATA = JSON.stringify({
    'vocab:happy': {
        type: 'vocab', ref: 'happy', key: 'vocab:happy', word: 'happy',
        reps: 3, interval: 7, ease: 2.5, lapses: 0, due: 1700000000000
    }
});

/** Every key the app really writes, as found by grepping the source. */
const APP_KEYS = ['learningProgress', 'srsData', 'mistakeLog', 'sessionPlan', 'theme'];

const seed = (obj) => {
    Object.keys(obj).forEach((k) => localStorage.setItem(k, obj[k]));
};

/** A populated device: learner data, plus the three things an export must skip. */
const seedPopulated = () => seed({
    learningProgress: PROGRESS,
    srsData: SRSDATA,
    mistakeLog: JSON.stringify([{ category: 'gram.articles', at: 1700000000000 }]),
    sessionPlan: JSON.stringify({ items: ['vocab:happy'] }),
    theme: 'dark',
    errorLog: JSON.stringify([{ message: 'boom', stack: 'at x' }]),
    word_serendipity: JSON.stringify({ definition: 'luck', cachedAt: 1700000000000 }),
    'learningProgress.bak.v1': '{"legacy":true}',
    __storage_test__: '1'
});

/** RAW dump of the WHOLE store, deny-listed keys included. The unit of "unchanged". */
const dumpAll = () => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        out[k] = localStorage.getItem(k);
    }
    return out;
};

/** Build an export envelope, defaulting `keyCount` to agree with `data`. */
const envelope = (over = {}) => {
    const e = Object.assign({
        app: P.APP_ID,
        kind: P.KIND,
        formatVersion: P.FORMAT_VERSION,
        schemaVersion: Migrations.SCHEMA_VERSION,
        exportedAt: '2026-01-01T00:00:00.000Z',
        data: { learningProgress: PROGRESS, srsData: SRSDATA }
    }, over);
    if (!Object.prototype.hasOwnProperty.call(over, 'keyCount')) {
        e.keyCount = Object.keys(e.data || {}).length;
    }
    return e;
};

const file = (over) => JSON.stringify(envelope(over));

const quotaError = () => {
    const e = new Error('The quota has been exceeded.');
    e.name = 'QuotaExceededError';
    e.code = 22;
    return e;
};

/**
 * Replace Storage.prototype.setItem with a decision function.
 *   'pass'   -> really write
 *   'throw'  -> throw a QuotaExceededError
 *   'error'  -> throw a non-quota error
 *   'silent' -> return normally and write NOTHING (the honest test of whether a
 *               rollback verdict comes from reading the store or from the
 *               absence of an exception)
 */
const stubSetItem = (decide) => {
    const original = Storage.prototype.setItem;
    return jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
        switch (decide(String(k), v)) {
            case 'throw': throw quotaError();
            case 'error': throw new TypeError('storage is on fire');
            case 'silent': return undefined;
            default: return original.call(this, k, v);
        }
    });
};

beforeEach(() => {
    // setup.js clears storage AFTER each test; clear here too so this file does
    // not depend on hook ordering, and reset the in-memory state setup.js cannot
    // see.
    localStorage.clear();
    SRS.records = {};
    SRS._migrated = true;
    // The `suspended` latch is module-level and one-way, so a successful import
    // in any test would otherwise leak `writesSuspended() === true` into every
    // test declared after it. Reset through the seam rather than relying on
    // declaration order (US-207).
    P._resetWritesSuspended();
    // The archive summary cache is module-level for the same reason and survives
    // localStorage.clear() the same way (US-138). Cleared through its seam so no
    // test inherits another test's fake archive.
    P._setArchiveCache(null);
    delete global.BlobStore;
    // logError() falls through to console.warn when AppErrorHandler is absent.
    // Silenced, but kept as a spy so the failure paths can assert they logged.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ===========================================================================
describe('the deny-list: which keys are learner data (FR-DATA-4)', () => {
// ===========================================================================

    it('owns every key the app actually writes', () => {
        // The direction that loses data if it breaks. A key the app writes and
        // the export skips is a key the learner silently does not get back.
        APP_KEYS.forEach((k) => expect(P.isOwnedKey(k)).toBe(true));
    });

    it('owns a key no feature has invented yet, because it subtracts rather than lists', () => {
        // The whole point of a deny-list: forgetting to update it makes the
        // export slightly larger, not slightly lossy.
        ['recordingIndex', 'phonemeDrillState', 'somethingFromPhase9'].forEach((k) => {
            expect(P.isOwnedKey(k)).toBe(true);
        });
    });

    it('disowns diagnostics, the word cache, device-local backups and probes', () => {
        expect(P.isOwnedKey('errorLog')).toBe(false);
        expect(P.isOwnedKey(PRE_IMPORT_KEY)).toBe(false);
        expect(P.isOwnedKey('word_serendipity')).toBe(false);
        expect(P.isOwnedKey('word_')).toBe(false);
        expect(P.isOwnedKey('learningProgress.bak.v1')).toBe(false);
        expect(P.isOwnedKey('srsData.bak.reset')).toBe(false);
        expect(P.isOwnedKey('anything.bak')).toBe(false);
        expect(P.isOwnedKey('__storage_test__')).toBe(false);
        expect(P.isOwnedKey('__proto__')).toBe(false);
    });

    it('disowns the two keys it writes itself, so an export never carries its own backups', () => {
        // backupOnce() never overwrites, so importing a foreign
        // `learningProgress.bak.v1` would permanently block this device from
        // ever taking its own.
        expect(P.isOwnedKey(PRE_IMPORT_KEY)).toBe(false);
        expect(P.isOwnedKey(RESET_BAK)).toBe(false);
    });

    it('disowns non-strings and the empty key', () => {
        [null, undefined, 0, 1, {}, [], ''].forEach((k) => {
            expect(P.isOwnedKey(k)).toBe(false);
        });
    });

    it('ownedKeys() enumerates storage, sorted, with the deny-list subtracted', () => {
        seedPopulated();
        expect(P.ownedKeys()).toEqual(
            ['learningProgress', 'mistakeLog', 'sessionPlan', 'srsData', 'theme']
        );
    });

    it('ownedKeys() is [] on an empty device rather than throwing', () => {
        expect(P.ownedKeys()).toEqual([]);
    });

    it('snapshot() carries RAW strings, not parsed JSON', () => {
        seedPopulated();
        const snap = P.snapshot();
        expect(snap.learningProgress).toBe(PROGRESS);
        expect(typeof snap.learningProgress).toBe('string');
        expect(snap.theme).toBe('dark');
        expect(snap).not.toHaveProperty('errorLog');
        expect(snap).not.toHaveProperty('word_serendipity');
    });
});

// ===========================================================================
describe('buildExport — the envelope', () => {
// ===========================================================================

    it('stamps app, kind and formatVersion so a wrong file is a fact, not a guess', () => {
        seedPopulated();
        const e = P.buildExport();
        expect(e.app).toBe('english-learning-portal');
        expect(e.kind).toBe('learner-data-export');
        expect(e.formatVersion).toBe(1);
        expect(typeof e.exportedAt).toBe('string');
        expect(new Date(e.exportedAt).toISOString()).toBe(e.exportedAt);
    });

    it('keyCount agrees with data, which is what makes truncation detectable', () => {
        seedPopulated();
        const e = P.buildExport();
        expect(e.keyCount).toBe(Object.keys(e.data).length);
        expect(e.keyCount).toBe(5);
    });

    it('carries only owned keys', () => {
        seedPopulated();
        expect(Object.keys(P.buildExport().data).sort()).toEqual(
            ['learningProgress', 'mistakeLog', 'sessionPlan', 'srsData', 'theme']
        );
    });

    it('labels the export with the HIGHER of this build and the stored record', () => {
        // The rollback-to-an-older-bundle case: a record written by a newer
        // release must not be exported labelled as current, or the older client
        // that re-imports it believes it understands the shape.
        seed({ learningProgress: JSON.stringify(progressRecord({ schemaVersion: 99 })) });
        expect(P.buildExport().schemaVersion).toBe(99);
    });

    it('falls back to this build when the stored record has no version', () => {
        seed({ learningProgress: JSON.stringify(progressRecord({ schemaVersion: undefined })) });
        expect(P.buildExport().schemaVersion).toBe(Migrations.SCHEMA_VERSION);
    });

    it('falls back to this build when the stored record is unparseable', () => {
        seed({ learningProgress: 'not json at all' });
        expect(P.buildExport().schemaVersion).toBe(Migrations.SCHEMA_VERSION);
    });

    it('reads nothing and writes nothing on an empty device', () => {
        const e = P.buildExport();
        expect(e.keyCount).toBe(0);
        expect(e.data).toEqual({});
        expect(localStorage.length).toBe(0);
    });

    it('exportFileName is one file per day, zero-padded', () => {
        expect(P.exportFileName(new Date(2026, 0, 5))).toBe('english-portal-data-2026-01-05.json');
        expect(P.exportFileName(new Date(2026, 11, 31))).toBe('english-portal-data-2026-12-31.json');
        expect(typeof P.exportFileName()).toBe('string');
    });
});

// ===========================================================================
describe('exportToFile — the download (STUBBED: jsdom has no object URLs)', () => {
// ===========================================================================

    let createObjectURL;
    let revokeObjectURL;

    beforeEach(() => {
        // jsdom implements neither. Without these stubs exportToFile() would
        // take its catch branch, so nothing below proves a real download works —
        // only that the anchor is assembled and cleaned up correctly.
        createObjectURL = jest.fn(() => 'blob:mock-url');
        revokeObjectURL = jest.fn();
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = revokeObjectURL;
    });

    afterEach(() => {
        delete URL.createObjectURL;
        delete URL.revokeObjectURL;
    });

    it('reports the key count, byte size and file name it produced', () => {
        seed({ learningProgress: PROGRESS, theme: 'dark' });   // ASCII only
        const expected = JSON.stringify(P.buildExport(), null, 2);
        const result = P.exportToFile();
        expect(result.ok).toBe(true);
        expect(result.keyCount).toBe(2);
        // Pretty-printed, because FR-DATA-4 exists partly so a human can read
        // the numbers. ASCII fixture, so UTF-8 and UTF-16 lengths agree and this
        // does not depend on whether the environment has TextEncoder.
        expect(result.bytes).toBe(expected.length);
        expect(result.bytes).toBeGreaterThan(200);
        expect(result.fileName).toMatch(/^english-portal-data-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it('builds an application/json blob and detaches the anchor again', () => {
        seed({ learningProgress: PROGRESS });
        P.exportToFile();
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(createObjectURL.mock.calls[0][0].type).toBe('application/json');
        // Nothing left behind in the document.
        expect(document.querySelectorAll('a[download]').length).toBe(0);
    });

    it('revokes the URL on the NEXT turn, not synchronously', () => {
        jest.useFakeTimers();
        try {
            seed({ learningProgress: PROGRESS });
            P.exportToFile();
            // Revoking before the browser has finished reading the blob cancels
            // the download, so this must still be pending here.
            expect(revokeObjectURL).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1);
            expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        } finally {
            jest.useRealTimers();
        }
    });

    it('changes nothing on this device when the download cannot be created', () => {
        seedPopulated();
        const before = dumpAll();
        URL.createObjectURL = jest.fn(() => { throw new Error('no blobs today'); });
        const result = P.exportToFile();
        expect(result.ok).toBe(false);
        expect(result.code).toBe('export-failed');
        expect(result.message).toBe(P.MESSAGES.exportFailed);
        expect(result.message).toMatch(/Nothing on this device has changed/);
        expect(dumpAll()).toEqual(before);
        expect(console.warn).toHaveBeenCalled();
    });

    it('exports an empty envelope rather than failing on an empty device', () => {
        const result = P.exportToFile();
        expect(result.ok).toBe(true);
        expect(result.keyCount).toBe(0);
    });

    it('revokes the object URL even when the download fails after it was created', () => {
        // Otherwise a failed export leaks a blob URL for the life of the tab.
        seed({ learningProgress: PROGRESS });
        jest.spyOn(document, 'createElement').mockImplementation(() => {
            throw new Error('no elements today');
        });
        const result = P.exportToFile();
        expect(result.ok).toBe(false);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    // -----------------------------------------------------------------------
    // US-209: an export this app cannot restore says so.
    //
    // validateExport() refuses a file with neither progress nor review history
    // (`no-data`), so a settings-only device used to produce a "successful"
    // backup that could never be restored. The REFUSAL is kept deliberately: a
    // commit is a replacement, so accepting a settings-only file would let one
    // mis-picked, genuinely-ours file wipe a populated device, and the thing it
    // would rescue is a theme toggle. What changed is that the export no longer
    // claims to be something it is not (`BR-7`, `BR-3`).
    // -----------------------------------------------------------------------

    it('a normal export is restorable and says only "Saved."', () => {
        seed({ learningProgress: PROGRESS, theme: 'dark' });
        const result = P.exportToFile();
        expect(result.restorable).toBe(true);
        expect(result.message).toBe(P.MESSAGES.exportOk);
    });

    it('a review-history-only export is restorable too', () => {
        seed({ srsData: SRSDATA, theme: 'dark' });
        expect(P.exportToFile().restorable).toBe(true);
    });

    it('a settings-only export admits it cannot be restored', () => {
        seed({ theme: 'dark' });
        const result = P.exportToFile();
        expect(result.ok).toBe(true);              // the file really was written
        expect(result.keyCount).toBe(1);
        expect(result.restorable).toBe(false);
        expect(result.message).toBe(P.MESSAGES.exportOkNotRestorable);
        // ...and the admission is true: the very file it just wrote is refused.
        expect(P.validateExport(JSON.stringify(P.buildExport(), null, 2)).code).toBe('no-data');
    });

    it('an export from an empty device gets the same caveat, worded to fit', () => {
        const result = P.exportToFile();
        expect(result.ok).toBe(true);
        expect(result.restorable).toBe(false);
        expect(result.message).toBe(P.MESSAGES.exportOkNotRestorable);
        // Says nothing about what the file contains, because it contains nothing.
        expect(result.message).toMatch(/no progress or review history on this device yet/);
        expect(result.message).toMatch(/cannot restore that file later/);
    });
});

// ===========================================================================
describe('error reporting', () => {
// ===========================================================================

    it('prefers AppErrorHandler over the console when it is loaded', () => {
        // index.html loads error-handler.js first, so this is the real path in
        // the browser; the console fallback exists for Node and for a partial
        // page load.
        const logError = jest.fn();
        global.AppErrorHandler = { logError: logError };
        try {
            seed({ srsData: SRSDATA });
            stubSetItem(() => 'throw');
            P.resetReviewHistory();
            expect(logError).toHaveBeenCalled();
            expect(logError.mock.calls[0][1]).toBe('review history backup');
            expect(console.warn).not.toHaveBeenCalled();
        } finally {
            delete global.AppErrorHandler;
        }
    });

    it('a hostile logger never breaks a restore', () => {
        global.AppErrorHandler = { logError: () => { throw new Error('logger is broken'); } };
        try {
            seed({ learningProgress: PROGRESS, theme: 'dark' });
            const before = P.snapshot();
            stubSetItem((k) => (k === 'srsData' ? 'throw' : 'pass'));
            const result = P.importFromText(file());
            expect(result.code).toBe('quota');
            expect(P.snapshot()).toEqual(before);
        } finally {
            delete global.AppErrorHandler;
        }
    });
});

// ===========================================================================
describe('round trip is byte-exact (BR-7 / FR-DATA-4)', () => {
// ===========================================================================

    /** Export, wipe the device, restore. What a new laptop actually does. */
    const roundTrip = () => {
        const text = JSON.stringify(P.buildExport(), null, 2);
        localStorage.clear();
        return { text: text, result: P.importFromText(text) };
    };

    it('restores every key byte-identically after the device is wiped', () => {
        seedPopulated();
        const before = P.snapshot();
        const { result } = roundTrip();

        expect(result.ok).toBe(true);
        expect(P.snapshot()).toEqual(before);
        // Byte-for-byte, not merely deep-equal-after-parsing.
        Object.keys(before).forEach((k) => {
            expect(localStorage.getItem(k)).toBe(before[k]);
        });
        expect(result.keys).toEqual(
            ['learningProgress', 'mistakeLog', 'sessionPlan', 'srsData', 'theme']
        );
    });

    it('survives values JSON would happily mangle', () => {
        // Raw strings are never re-parsed, so nothing here is normalised: key
        // order, float formatting, escapes and unicode all come back as sent.
        const awkward = {
            learningProgress: PROGRESS,
            theme: '  dark  ',
            // Deliberately NOT canonical JSON: trailing zeros, wide spacing and
            // an unusual key order that a re-serialising build would rewrite.
            odd: '{ "z" : 1.500 ,  "a"\n: "x" }',
            unicode: 'పరీక్ష ✅ /ˈhæpi/ 😀 é',
            controls: 'tab\there\nnewline\r\n"quoted" \\backslash\\  nul',
            emptyString: '',
            justSpaces: '   '
        };
        seed(awkward);
        const before = P.snapshot();
        const { result } = roundTrip();
        expect(result.ok).toBe(true);
        Object.keys(awkward).forEach((k) => {
            expect(localStorage.getItem(k)).toBe(awkward[k]);
        });
        expect(P.snapshot()).toEqual(before);
    });

    it('survives a lone surrogate, which is the one thing JSON.stringify used to lose', () => {
        seed({ learningProgress: PROGRESS, weird: 'before\uD800after' });
        const { result } = roundTrip();
        expect(result.ok).toBe(true);
        expect(localStorage.getItem('weird')).toBe('before\uD800after');
    });

    it('carries a key this build has never heard of, and hands it back unchanged', () => {
        // The deny-list promise, end to end: a future feature's key is exported
        // automatically and restored verbatim by a build that cannot read it.
        const fromTheFuture = '{"phase":9,"shape":"unknown to this build"}';
        seed({ learningProgress: PROGRESS, phase9State: fromTheFuture });
        const { result } = roundTrip();
        expect(result.ok).toBe(true);
        expect(localStorage.getItem('phase9State')).toBe(fromTheFuture);
        expect(result.keys).toContain('phase9State');
    });

    it('is idempotent: exporting the restored store reproduces the same bytes', () => {
        seedPopulated();
        const first = JSON.stringify(P.buildExport().data);
        roundTrip();
        expect(JSON.stringify(P.buildExport().data)).toBe(first);
    });

    it('restores what the file has and drops what it does not — replacement, not merge', () => {
        // A "clean install" must not keep this device's leftovers, and the
        // rollback path depends on the commit being a whole state rather than a
        // merge. The flip side is that an srsData-only file DELETES
        // learningProgress (US-204). That behaviour is kept — see the
        // importConfirmMessage block, which is where the learner is now told,
        // in the words of the thing they are about to lose, before they agree.
        seed({ learningProgress: PROGRESS, theme: 'dark', staleLeftover: 'x' });
        const result = P.importFromText(file({ data: { srsData: SRSDATA } }));
        expect(result.ok).toBe(true);
        expect(localStorage.getItem('srsData')).toBe(SRSDATA);
        expect(localStorage.getItem('theme')).toBeNull();
        expect(localStorage.getItem('staleLeftover')).toBeNull();
        expect(localStorage.getItem('learningProgress')).toBeNull();
    });

    it('does not touch deny-listed keys already on the device', () => {
        seedPopulated();
        const cache = localStorage.getItem('word_serendipity');
        const log = localStorage.getItem('errorLog');
        roundTrip();
        // roundTrip() wipes the device, so re-seed and import over the top.
        seedPopulated();
        P.importFromText(file());
        expect(localStorage.getItem('word_serendipity')).toBe(cache);
        expect(localStorage.getItem('errorLog')).toBe(log);
        expect(localStorage.getItem('learningProgress.bak.v1')).toBe('{"legacy":true}');
    });

    it('returns the schemaVersion and exportedAt the file claimed', () => {
        seedPopulated();
        const text = JSON.stringify(P.buildExport(), null, 2);
        const stamped = JSON.parse(text).exportedAt;
        localStorage.clear();
        const result = P.importFromText(text);
        expect(result.schemaVersion).toBe(Migrations.SCHEMA_VERSION);
        expect(result.exportedAt).toBe(stamped);
    });

    it('reports exportedAt as null when the file does not carry a usable one', () => {
        const result = P.importFromText(file({ exportedAt: 12345 }));
        expect(result.ok).toBe(true);
        expect(result.exportedAt).toBeNull();
    });

    it('writes one pre-import recovery copy of what it replaced', () => {
        seed({ learningProgress: PROGRESS, theme: 'dark' });
        const before = P.snapshot();
        P.importFromText(file({ data: { srsData: SRSDATA } }));
        const bak = JSON.parse(localStorage.getItem(PRE_IMPORT_KEY));
        expect(bak.data).toEqual(before);
        expect(typeof bak.takenAt).toBe('string');
    });

    it('skips the pre-import copy when there was nothing to replace', () => {
        P.importFromText(file());
        expect(localStorage.getItem(PRE_IMPORT_KEY)).toBeNull();
    });

    it('also takes the migration-style backup, so the recovery path exists here too', () => {
        seed({ learningProgress: JSON.stringify(progressRecord({ schemaVersion: 1 })) });
        P.importFromText(file());
        expect(localStorage.getItem('learningProgress.bak.v1')).toBe(
            JSON.stringify(progressRecord({ schemaVersion: 1 }))
        );
    });
});

// ===========================================================================
describe('validateExport — everything that can say no (FR-DATA-4)', () => {
// ===========================================================================

    // The 200-char cap on key length, exceeded.
    const longKey = 'k'.repeat(201);
    const rawFile = (dataJson, over) => JSON.stringify(Object.assign({
        app: P.APP_ID, kind: P.KIND, formatVersion: 1,
        schemaVersion: Migrations.SCHEMA_VERSION
    }, over)).replace(/}$/, ',"data":' + dataJson + '}');

    /**
     * Each case: [name, text, expected code, expected message].
     * The message is asserted too, because the copy is the feature: `BR-7` is
     * kept by telling the learner nothing has changed, not merely by not
     * changing anything.
     */
    const cases = [
        ['an empty file', '', 'empty', P.MESSAGES.empty],
        ['whitespace only', '   \n\t  ', 'empty', P.MESSAGES.empty],
        ['not a string at all', null, 'empty', P.MESSAGES.empty],
        ['malformed JSON', '{"app": "english-learning', 'not-json', P.MESSAGES.notJson],
        ['a JSON array', '[]', 'wrong-shape', P.MESSAGES.notMine],
        ['a populated JSON array', '[{"app":"english-learning-portal"}]', 'wrong-shape', P.MESSAGES.notMine],
        ['a JSON string', '"english-learning-portal"', 'wrong-shape', P.MESSAGES.notMine],
        ['JSON null', 'null', 'wrong-shape', P.MESSAGES.notMine],
        ['valid JSON of the wrong shape', '{"progress":{"stats":{}}}', 'foreign', P.MESSAGES.notMine],
        ['another app\'s export', file({ app: 'some-other-app' }), 'foreign', P.MESSAGES.notMine],
        ['our app, someone else\'s kind of file', file({ kind: 'error-report' }), 'foreign', P.MESSAGES.notMine],
        ['no formatVersion', file({ formatVersion: undefined }), 'wrong-shape', P.MESSAGES.notMine],
        ['a nonsense formatVersion', file({ formatVersion: 'one' }), 'wrong-shape', P.MESSAGES.notMine],
        ['formatVersion 0', file({ formatVersion: 0 }), 'wrong-shape', P.MESSAGES.notMine],
        ['a formatVersion from the future', file({ formatVersion: 2 }), 'future-format', P.MESSAGES.futureFile],
        ['no data at all', file({ data: undefined }), 'wrong-shape', P.MESSAGES.notMine],
        ['data that is an array', file({ data: [] }), 'wrong-shape', P.MESSAGES.notMine],
        ['an empty data map', file({ data: {} }), 'no-data', P.MESSAGES.noData],
        ['a truncated file (keyCount disagrees)', file({ keyCount: 5 }), 'incomplete', P.MESSAGES.incomplete],
        ['a value that is not a string', file({ data: { learningProgress: { stats: {} } } }), 'wrong-shape', P.MESSAGES.notMine],
        ['a value that is a number', file({ data: { learningProgress: PROGRESS, streak: 7 } }), 'wrong-shape', P.MESSAGES.notMine],
        ['a value that is null', file({ data: { learningProgress: PROGRESS, theme: null } }), 'wrong-shape', P.MESSAGES.notMine],
        ['damaged progress', file({ data: { learningProgress: '{"stats":' } }), 'damaged', P.MESSAGES.damaged],
        ['progress that parses to an array', file({ data: { learningProgress: '[]' } }), 'damaged', P.MESSAGES.damaged],
        ['progress that parses to a number', file({ data: { learningProgress: '42' } }), 'damaged', P.MESSAGES.damaged],
        ['progress with none of our markers', file({ data: { learningProgress: '{"hello":"world"}' } }), 'wrong-shape', P.MESSAGES.notMine],
        ['damaged review history', file({ data: { srsData: '{"vocab:happy":' } }), 'damaged', P.MESSAGES.damaged],
        ['review history that is an array', file({ data: { srsData: '[]' } }), 'damaged', P.MESSAGES.damaged],
        ['a review record that is not an object', file({ data: { srsData: '{"vocab:happy":5}' } }), 'damaged', P.MESSAGES.damaged],
        ['a review record that is null', file({ data: { srsData: '{"vocab:happy":null}' } }), 'damaged', P.MESSAGES.damaged],
        ['a review record that is an array', file({ data: { srsData: '{"vocab:happy":[]}' } }), 'damaged', P.MESSAGES.damaged],
        ['neither progress nor review history', file({ data: { theme: 'dark' } }), 'no-data', P.MESSAGES.noData],
        ['a planted errorLog', file({ data: { learningProgress: PROGRESS, errorLog: '[]' } }), 'wrong-shape', P.MESSAGES.notMine],
        ['a planted word cache', file({ data: { learningProgress: PROGRESS, word_x: '{}' } }), 'wrong-shape', P.MESSAGES.notMine],
        ['a planted device-local backup', file({ data: { learningProgress: PROGRESS, 'learningProgress.bak.v1': '{}' } }), 'wrong-shape', P.MESSAGES.notMine],
        ['a planted pre-import backup', file({ data: { learningProgress: PROGRESS, [PRE_IMPORT_KEY]: '{}' } }), 'wrong-shape', P.MESSAGES.notMine],
        ['a planted storage probe', file({ data: { learningProgress: PROGRESS, __storage_test__: '1' } }), 'wrong-shape', P.MESSAGES.notMine],
        ['a planted __proto__', rawFile('{"learningProgress":' + JSON.stringify(PROGRESS) + ',"__proto__":"pwned"}', { keyCount: 2 }), 'wrong-shape', P.MESSAGES.notMine],
        ['a planted constructor', file({ data: { learningProgress: PROGRESS, constructor: 'x' } }), 'wrong-shape', P.MESSAGES.notMine],
        ['a planted prototype', file({ data: { learningProgress: PROGRESS, prototype: 'x' } }), 'wrong-shape', P.MESSAGES.notMine],
        ['an absurdly long key', file({ data: { learningProgress: PROGRESS, [longKey]: 'x' } }), 'wrong-shape', P.MESSAGES.notMine],
        ['an empty key', file({ data: { learningProgress: PROGRESS, '': 'x' } }), 'wrong-shape', P.MESSAGES.notMine],
        ['a schemaVersion from the future, in the envelope', file({ schemaVersion: 99, data: { learningProgress: JSON.stringify(progressRecord({ schemaVersion: undefined })) } }), 'future-schema', P.MESSAGES.futureFile],
        ['a schemaVersion from the future, in the record', file({ schemaVersion: undefined, data: { learningProgress: JSON.stringify(progressRecord({ schemaVersion: 99 })) } }), 'future-schema', P.MESSAGES.futureFile]
    ];

    describe('says no with the right code and the right words', () => {
        it.each(cases)('rejects %s', (_name, text, code, message) => {
            const result = P.validateExport(text);
            expect(result.ok).toBe(false);
            expect(result.code).toBe(code);
            expect(result.message).toBe(message);
            expect(result).not.toHaveProperty('plan');
        });
    });

    it('rejects a file too large to read, before reading it', () => {
        // ASCII, so the byte count is the character count in any environment.
        const huge = '"' + 'a'.repeat(P.MAX_IMPORT_BYTES + 10) + '"';
        const result = P.validateExport(huge);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('too-large');
        expect(result.message).toBe(P.MESSAGES.tooLarge);
    });

    it('every rejection message tells the learner nothing has changed', () => {
        // The one thing someone looking at this error needs to know.
        cases.forEach((c) => expect(c[3]).toMatch(/Nothing has changed/));
        expect(P.MESSAGES.tooLarge).toMatch(/Nothing has changed/);
    });

    it('is pure: it never writes, whatever it is handed', () => {
        seedPopulated();
        const before = dumpAll();
        const setItem = jest.spyOn(Storage.prototype, 'setItem');
        const removeItem = jest.spyOn(Storage.prototype, 'removeItem');
        cases.forEach((c) => P.validateExport(c[1]));
        expect(setItem).not.toHaveBeenCalled();
        expect(removeItem).not.toHaveBeenCalled();
        expect(dumpAll()).toEqual(before);
    });

    it('is pure about the ARCHIVE too: all 44 cases never reach BlobStore (US-138)', () => {
        // The archive is a second store with no shared transaction, so "validate
        // before write" has to hold across both. Every method of this stand-in
        // throws, so any contact at all fails the test rather than being invisible.
        const touched = [];
        global.BlobStore = new Proxy({}, {
            get(_t, name) {
                return () => { touched.push(String(name)); throw new Error('archive touched'); };
            }
        });
        seedPopulated();
        cases.forEach((c) => expect(P.validateExport(c[1]).ok).toBe(false));
        expect(cases.length).toBe(44);
        expect(touched).toEqual([]);
    });

    it('accepts a good file and hands back a sorted, committable plan', () => {
        const result = P.validateExport(file({ data: { theme: 'dark', learningProgress: PROGRESS, srsData: SRSDATA } }));
        expect(result.ok).toBe(true);
        expect(result.plan.keys).toEqual(['learningProgress', 'srsData', 'theme']);
        expect(result.plan.data.learningProgress).toBe(PROGRESS);
        expect(result.plan.schemaVersion).toBe(Migrations.SCHEMA_VERSION);
    });

    it('accepts a file with no keyCount, since the field is optional', () => {
        const result = P.validateExport(file({ keyCount: undefined }));
        expect(result.ok).toBe(true);
    });

    it('accepts progress carrying any ONE of our markers, so old saves still restore', () => {
        // Rejecting a restorable save because it predates `dailyHistory` would
        // be the worse failure.
        ['stats', 'dailyStats', 'overallStats', 'dailyGoals', 'completedExercises',
         'exerciseHistory', 'dailyHistory', 'currentWordIndex', 'currentSection',
         'vocabProgress'].forEach((marker) => {
            const minimal = {};
            minimal[marker] = marker === 'currentWordIndex' ? 0 : {};
            const result = P.validateExport(file({ data: { learningProgress: JSON.stringify(minimal) } }));
            expect(result.ok).toBe(true);
        });
    });

    it('accepts a review history this build cannot interpret, as long as records are objects', () => {
        const alien = JSON.stringify({ 'coll:make-a-decision': { somethingNew: true, reps: 4 } });
        expect(P.validateExport(file({ data: { srsData: alien } })).ok).toBe(true);
    });

    it('accepts an empty review history map', () => {
        expect(P.validateExport(file({ data: { srsData: '{}' } })).ok).toBe(true);
    });
});

// ===========================================================================
describe('the confirm copy names what a restore will remove (US-204)', () => {
// ===========================================================================
// A commit is a REPLACEMENT, so a file carrying only `srsData` deletes
// `learningProgress`. The behaviour is kept — a "clean install" that silently
// retained this device's leftovers would be a worse lie, and rollback() depends
// on `before` being a whole state rather than a merge — but the old fixed copy
// ("replaces the progress, review history and settings ... with the ones in this
// file") reads as substitution, and nobody would infer "and deletes the
// categories this file happens to omit". So the copy changed, not the code.

    const planFor = (text) => {
        const checked = P.validateExport(text);
        expect(checked.ok).toBe(true);
        return checked.plan;
    };

    it('states the general rule, so nothing rests on the specific sentences', () => {
        expect(P.MESSAGES.importConfirm).toMatch(/Anything saved here that the file does not contain is removed/);
        expect(P.MESSAGES.importConfirm).toMatch(/A copy of what is here now is kept/);
    });

    it('warns in as many words that a review-history-only file deletes progress', () => {
        seed({ learningProgress: PROGRESS, srsData: SRSDATA });
        const message = P.importConfirmMessage(planFor(file({ data: { srsData: SRSDATA } })));
        expect(message).toContain(P.MESSAGES.importConfirmProgressLost);
        expect(message).toMatch(/streak and completed exercises/);
        expect(message).not.toContain(P.MESSAGES.importConfirmReviewLost);
        expect(message.endsWith(P.MESSAGES.importConfirmTail)).toBe(true);
    });

    it('warns that a progress-only file deletes the review history', () => {
        seed({ learningProgress: PROGRESS, srsData: SRSDATA });
        const message = P.importConfirmMessage(planFor(file({ data: { learningProgress: PROGRESS } })));
        expect(message).toContain(P.MESSAGES.importConfirmReviewLost);
        expect(message).not.toContain(P.MESSAGES.importConfirmProgressLost);
    });

    it('names the other things it will remove in learner words, not storage keys', () => {
        seedPopulated();
        const message = P.importConfirmMessage(planFor(file()));
        expect(message).toContain('your mistake history');
        expect(message).toContain("today's plan");
        expect(message).toContain('your appearance settings');
        expect(message).not.toContain('mistakeLog');
        expect(message).not.toContain('sessionPlan');
        // Deny-listed keys are not touched by a commit, so they are not named.
        expect(message).not.toContain('errorLog');
        expect(message).not.toContain('word_serendipity');
    });

    it('counts a key it has no name for rather than showing it raw', () => {
        // The deny-list means a future feature's key is exported and replaced
        // automatically, and this module cannot invent a learner-facing name
        // for it — so it is counted, not printed.
        seed({ learningProgress: PROGRESS, phase9State: '{}' });
        const message = P.importConfirmMessage(planFor(file({ data: { learningProgress: PROGRESS } })));
        expect(message).toContain('one other saved item');
        expect(message).not.toContain('phase9State');
    });

    it('pluralises the unnamed count', () => {
        seed({ learningProgress: PROGRESS, phase9State: '{}', phase10State: '{}' });
        const message = P.importConfirmMessage(planFor(file({ data: { learningProgress: PROGRESS } })));
        expect(message).toContain('2 other saved items');
    });

    it('adds nothing when the file replaces everything the device has', () => {
        seed({ learningProgress: PROGRESS, srsData: SRSDATA });
        expect(P.importConfirmMessage(planFor(file()))).toBe(
            P.MESSAGES.importConfirm + '\n\n' + P.MESSAGES.importConfirmTail
        );
    });

    it('never warns about a loss on an empty device, because there is none', () => {
        const message = P.importConfirmMessage(planFor(file({ data: { srsData: SRSDATA } })));
        expect(message).not.toContain(P.MESSAGES.importConfirmProgressLost);
        expect(message).toBe(P.MESSAGES.importConfirm + '\n\n' + P.MESSAGES.importConfirmTail);
    });

    it('reads nothing and writes nothing', () => {
        seedPopulated();
        const before = dumpAll();
        const setItem = jest.spyOn(Storage.prototype, 'setItem');
        P.importConfirmMessage(planFor(file()));
        expect(setItem).not.toHaveBeenCalled();
        expect(dumpAll()).toEqual(before);
    });

    it('does not throw when handed no plan at all', () => {
        // A missing plan means "the file carries nothing", which is the most
        // alarming reading, not the most reassuring one.
        seedPopulated();
        expect(() => P.importConfirmMessage()).not.toThrow();
        expect(P.importConfirmMessage(null)).toContain(P.MESSAGES.importConfirmProgressLost);
    });
});

// ===========================================================================
describe('validate-before-write: a rejected import touches nothing', () => {
// ===========================================================================

    const rejections = [
        ['', 'empty'],
        ['   ', 'empty'],
        ['{oops', 'not-json'],
        ['[]', 'wrong-shape'],
        ['{"a":1}', 'foreign'],
        [file({ app: 'other-app' }), 'foreign'],
        [file({ formatVersion: 2 }), 'future-format'],
        [file({ data: {} }), 'no-data'],
        [file({ keyCount: 99 }), 'incomplete'],
        [file({ data: { learningProgress: '{"stats":' } }), 'damaged'],
        [file({ data: { srsData: '{"vocab:happy":5}' } }), 'damaged'],
        [file({ data: { learningProgress: PROGRESS, errorLog: '[]' } }), 'wrong-shape'],
        [file({ schemaVersion: 99 }), 'future-schema']
    ];

    it.each(rejections)('leaves the store byte-identical (%#: %s)', (text, code) => {
        seedPopulated();
        const before = dumpAll();
        const setItem = jest.spyOn(Storage.prototype, 'setItem');
        const removeItem = jest.spyOn(Storage.prototype, 'removeItem');

        const result = P.importFromText(text);

        expect(result.ok).toBe(false);
        expect(result.code).toBe(code);
        // Stronger than "restored": never touched. No snapshot, no pre-import
        // backup, no partial write to undo.
        expect(setItem).not.toHaveBeenCalled();
        expect(removeItem).not.toHaveBeenCalled();
        expect(dumpAll()).toEqual(before);
        expect(localStorage.getItem(PRE_IMPORT_KEY)).toBeNull();
    });

    it('leaves the recording archive untouched as well (US-138)', () => {
        const store = fakeStore();
        global.BlobStore = store;
        seedPopulated();
        const before = dumpAll();
        rejections.forEach((r) => expect(P.importFromText(r[0]).ok).toBe(false));
        expect(dumpAll()).toEqual(before);
        // Not one call, of any kind, to the store that holds the recordings.
        expect(store.putCalls).toEqual([]);
        expect(store.removeCalls).toEqual([]);
        expect(store.rows).toEqual([]);
    });

    it('does not pollute Object.prototype when a file plants __proto__', () => {
        const text = '{"app":"' + P.APP_ID + '","kind":"' + P.KIND + '","formatVersion":1,' +
            '"schemaVersion":' + Migrations.SCHEMA_VERSION + ',"keyCount":2,"data":{' +
            '"learningProgress":' + JSON.stringify(PROGRESS) + ',"__proto__":"pwned"}}';
        const result = P.importFromText(text);
        expect(result.ok).toBe(false);
        expect({}.pwned).toBeUndefined();
        expect(Object.getPrototypeOf({})).toBe(Object.prototype);
        expect(localStorage.getItem('__proto__')).toBeNull();
        expect(localStorage.length).toBe(0);
    });
});

// ===========================================================================
describe('commit failure: the store is put back (NFR-10 / BR-7)', () => {
// ===========================================================================

    /** A device mid-life, and a file that replaces some keys and drops others. */
    const setUpCollision = () => {
        seed({ learningProgress: PROGRESS, theme: 'dark', staleLeftover: 'x' });
        return {
            before: P.snapshot(),
            text: file({
                data: {
                    learningProgress: JSON.stringify(progressRecord({ streak: 99 })),
                    srsData: SRSDATA,
                    theme: 'light'
                }
            })
        };
    };

    it('rolls the snapshot back when a write hits quota mid-commit', () => {
        const { before, text } = setUpCollision();
        // Writes happen in sorted key order: learningProgress, srsData, theme.
        // Fail on the second, so the commit is genuinely half-applied.
        stubSetItem((k) => (k === 'srsData' ? 'throw' : 'pass'));

        const result = P.importFromText(text);

        expect(result.ok).toBe(false);
        expect(result.code).toBe('quota');
        expect(result.message).toBe(P.MESSAGES.quota);
        expect(result.message).toMatch(/put back/);
        // Every owned key back to the byte.
        expect(P.snapshot()).toEqual(before);
        expect(localStorage.getItem('srsData')).toBeNull();
        expect(localStorage.getItem('staleLeftover')).toBe('x');
        expect(console.warn).toHaveBeenCalled();
    });

    it('reports a non-quota write failure differently, and still rolls back', () => {
        const { before, text } = setUpCollision();
        stubSetItem((k) => (k === 'srsData' ? 'error' : 'pass'));

        const result = P.importFromText(text);

        expect(result.code).toBe('write-failed');
        expect(result.message).toBe(P.MESSAGES.writeFailed);
        expect(P.snapshot()).toEqual(before);
    });

    it('keeps the pre-import copy the rollback-failed message promises', () => {
        const { before, text } = setUpCollision();
        stubSetItem((k) => (k === PRE_IMPORT_KEY ? 'pass' : 'throw'));
        P.importFromText(text);
        expect(JSON.parse(localStorage.getItem(PRE_IMPORT_KEY)).data).toEqual(before);
    });

    it('a rollback the device has no room for is NOT reported as success', () => {
        // Quota blocks the restore too: `theme` was removed by the commit and
        // cannot be written back, so the device is genuinely short one key.
        seed({ learningProgress: PROGRESS, theme: 'dark' });
        stubSetItem((k) => (k === PRE_IMPORT_KEY ? 'pass' : 'throw'));

        const result = P.importFromText(file({ data: { learningProgress: PROGRESS, srsData: SRSDATA } }));

        expect(result.ok).toBe(false);
        expect(result.code).toBe('rollback-failed');
        expect(result.message).toBe(P.MESSAGES.rollbackFailed);
        // The message has to name where the data actually is.
        expect(result.message).toContain(PRE_IMPORT_KEY);
        expect(localStorage.getItem('theme')).toBeNull();
        expect(JSON.parse(localStorage.getItem(PRE_IMPORT_KEY)).data.theme).toBe('dark');
    });

    it('a failed pre-import backup does not block the restore', () => {
        // The in-memory snapshot is the real protection; a full device must not
        // be unable to restore just because the extra copy would not fit.
        seed({ learningProgress: PROGRESS });
        stubSetItem((k) => (k === PRE_IMPORT_KEY ? 'throw' : 'pass'));
        const result = P.importFromText(file());
        expect(result.ok).toBe(true);
        expect(localStorage.getItem(PRE_IMPORT_KEY)).toBeNull();
        expect(localStorage.getItem('srsData')).toBe(SRSDATA);
    });

    it('US-199 FIXED: names no backup when no backup could be taken', () => {
        // The worst case this module has, and the only path where learner data
        // is genuinely lost: a device so full that the pre-import copy will not
        // fit AND the rollback cannot write anything back.
        //
        // It used to hand the learner MESSAGES.rollbackFailed, which states the
        // previous data "is still on this device, saved under
        // 'learnerData.preImport.bak'" — while that key did not exist. The data
        // was lost AND the recovery advice pointed at nothing (`BR-3`).
        //
        // The decision was to keep committing and tell the truth, NOT to refuse
        // the restore: the commit removes keys before it writes, so it routinely
        // succeeds where the extra copy would not fit (see "a failed pre-import
        // backup does not block the restore"), and refusing would deny a restore
        // to exactly the learner who most needs one.
        seed({ learningProgress: JSON.stringify(progressRecord({ streak: 1 })), theme: 'dark' });
        stubSetItem(() => 'throw');                 // nothing can be written at all

        const result = P.importFromText(file({
            data: { learningProgress: PROGRESS, srsData: SRSDATA }
        }));

        // A distinct code, because this is a materially different outcome.
        expect(result.code).toBe('rollback-failed-no-backup');
        expect(result.message).toBe(P.MESSAGES.rollbackFailedNoBackup);
        // The key that does not exist is not named...
        expect(result.message).not.toContain(PRE_IMPORT_KEY);
        expect(localStorage.getItem(PRE_IMPORT_KEY)).toBeNull();
        // ...the loss is stated rather than glossed...
        expect(result.message).toMatch(/some of what was here before is lost/);
        // ...and the one thing that IS recoverable is what they are pointed at.
        expect(result.message).toMatch(/restore that file again/);
        expect(localStorage.getItem('theme')).toBeNull();
        expect(localStorage.getItem('learningProgress.bak.v1')).toBeNull();
    });

    it('says nothing was lost when a failed rollback had nothing to lose', () => {
        // Empty device, partial commit, and the removals fail too. The store is
        // not `before`, so the rollback is a failure — but there was no earlier
        // data, so both "your previous data could not be put back" and the name
        // of a recovery copy would be untrue.
        jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw quotaError();
        });
        stubSetItem((k) => (k === 'srsData' ? 'throw' : 'pass'));

        const result = P.importFromText(file());

        expect(result.code).toBe('rollback-failed-nothing-lost');
        expect(result.message).toBe(P.MESSAGES.rollbackFailedNothingLost);
        expect(result.message).not.toContain(PRE_IMPORT_KEY);
        expect(result.message).toMatch(/none of your earlier data is lost/);
    });

    it('still names the backup when there really is one', () => {
        // The other side of the fix: the original message is not weakened, it is
        // just no longer used when it would be false.
        seed({ learningProgress: PROGRESS, theme: 'dark' });
        stubSetItem((k) => (k === PRE_IMPORT_KEY ? 'pass' : 'throw'));

        const result = P.importFromText(file({ data: { learningProgress: PROGRESS, srsData: SRSDATA } }));

        expect(result.code).toBe('rollback-failed');
        expect(result.message).toContain(PRE_IMPORT_KEY);
        expect(JSON.parse(localStorage.getItem(PRE_IMPORT_KEY)).data.theme).toBe('dark');
    });

    describe('recognises a full device however the browser words it', () => {
        // Only Chrome throws a DOMException literally named
        // QuotaExceededError. Firefox has used NS_ERROR_DOM_QUOTA_REACHED /
        // code 1014, and legacy WebKit code 22. Get this wrong and a learner on
        // a full iPhone is told "the restore could not be completed" instead of
        // "there is not enough room", which points them at the wrong fix.
        const shapes = {
            'Chrome (name)': (e) => { e.name = 'QuotaExceededError'; },
            'legacy WebKit (code 22)': (e) => { e.name = 'Error'; e.code = 22; },
            'Firefox (name)': (e) => { e.name = 'NS_ERROR_DOM_QUOTA_REACHED'; },
            'Firefox (code 1014)': (e) => { e.name = 'Error'; e.code = 1014; }
        };

        Object.keys(shapes).forEach((label) => {
            it(label, () => {
                seed({ learningProgress: PROGRESS });
                const original = Storage.prototype.setItem;
                jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
                    if (k === 'srsData') {
                        const e = new Error('full');
                        shapes[label](e);
                        throw e;
                    }
                    return original.call(this, k, v);
                });
                expect(P.importFromText(file()).code).toBe('quota');
            });
        });

        it('and does NOT call an ordinary failure a quota problem', () => {
            seed({ learningProgress: PROGRESS });
            stubSetItem((k) => (k === 'srsData' ? 'error' : 'pass'));
            expect(P.importFromText(file()).code).toBe('write-failed');
        });
    });
});

// ===========================================================================
describe('rollback is verified by reading the store, not by catching', () => {
// ===========================================================================

    it('reports success when every restoring write threw but the data is intact', () => {
        // The commit's FIRST write fails, so nothing was overwritten. The
        // rollback then throws on everything it tries — yet the learner's data
        // never moved. Telling them it could not be restored, when it is sitting
        // there, would be its own kind of harm.
        seed({ learningProgress: PROGRESS, theme: 'dark' });
        const before = P.snapshot();
        stubSetItem((k) => (k === PRE_IMPORT_KEY ? 'pass' : 'throw'));

        const result = P.importFromText(file({
            data: { learningProgress: JSON.stringify(progressRecord({ streak: 99 })), theme: 'dark' }
        }));

        expect(result.code).toBe('quota');          // NOT rollback-failed
        expect(result.message).toBe(P.MESSAGES.quota);
        expect(P.snapshot()).toEqual(before);
    });

    it('reports failure when nothing threw during the rollback but the data is gone', () => {
        // The mirror image, and the reason "did an exception escape?" is not a
        // safe test. Here every restoring setItem returns normally and writes
        // nothing: a module that trusted the absence of an exception would tell
        // the learner their data was put back.
        seed({ learningProgress: PROGRESS, theme: 'dark' });
        let commitDone = false;
        stubSetItem((k) => {
            if (k === PRE_IMPORT_KEY) return 'pass';
            if (k === 'learningProgress' && !commitDone) return 'pass';   // commit
            if (k === 'srsData') { commitDone = true; return 'throw'; }   // commit fails
            return 'silent';                                             // rollback: no-op
        });

        const result = P.importFromText(file({
            data: { learningProgress: JSON.stringify(progressRecord({ streak: 99 })), srsData: SRSDATA }
        }));

        expect(result.ok).toBe(false);
        expect(result.code).toBe('rollback-failed');
        // Proof the verdict came from the store, not from an exception: the
        // rollback's own writes were silent successes.
        expect(localStorage.getItem('theme')).toBeNull();
        expect(localStorage.getItem('learningProgress')).toBe(JSON.stringify(progressRecord({ streak: 99 })));
    });

    it('removes keys the failed commit had added that were never here before', () => {
        seed({ learningProgress: PROGRESS });
        const before = P.snapshot();
        // srsData is written, then theme fails: srsData must not survive.
        stubSetItem((k) => (k === 'theme' ? 'throw' : 'pass'));
        const result = P.importFromText(file({
            data: { learningProgress: PROGRESS, srsData: SRSDATA, theme: 'light' }
        }));
        expect(result.ok).toBe(false);
        expect(localStorage.getItem('srsData')).toBeNull();
        expect(P.snapshot()).toEqual(before);
    });
});

// ===========================================================================
describe('future-version refusal, asked two ways', () => {
// ===========================================================================

    it('refuses on the envelope stamp alone', () => {
        const result = P.validateExport(file({
            schemaVersion: Migrations.SCHEMA_VERSION + 1,
            data: { learningProgress: JSON.stringify(progressRecord({ schemaVersion: undefined })) }
        }));
        expect(result.code).toBe('future-schema');
    });

    it('refuses on the record\'s own field alone, when the envelope says current', () => {
        // The two can disagree if either was hand-edited; the higher wins.
        const result = P.validateExport(file({
            schemaVersion: Migrations.SCHEMA_VERSION,
            data: { learningProgress: JSON.stringify(progressRecord({ schemaVersion: Migrations.SCHEMA_VERSION + 1 })) }
        }));
        expect(result.code).toBe('future-schema');
    });

    it('refuses when Migrations alone calls the record future', () => {
        // Belt and braces: this branch cannot fire on its own from real data,
        // because `claimed` already takes the max of both stamps. Stubbing
        // Migrations is the only way to reach it, which is itself the finding —
        // the check is redundant, not wrong.
        jest.spyOn(Migrations, 'isFutureVersion').mockReturnValue(true);
        const result = P.validateExport(file());
        expect(result.code).toBe('future-schema');
        expect(result.message).toBe(P.MESSAGES.futureFile);
    });

    it('tells the learner what to do about it, not just that it failed', () => {
        expect(P.MESSAGES.futureFile).toMatch(/newer version/);
        expect(P.MESSAGES.futureFile).toMatch(/Update this app/);
        expect(P.MESSAGES.futureFile).toMatch(/Nothing has changed/);
    });

    it('accepts the current version, and a record older than this build', () => {
        expect(P.validateExport(file()).ok).toBe(true);
        expect(P.validateExport(file({
            schemaVersion: 1,
            data: { learningProgress: JSON.stringify(progressRecord({ schemaVersion: 1 })) }
        })).ok).toBe(true);
    });

    it('a future envelope stamp is refused even with no progress record to check', () => {
        const result = P.validateExport(file({
            schemaVersion: 99, data: { srsData: SRSDATA }
        }));
        expect(result.code).toBe('future-schema');
    });

    it('refuses to re-import the very file it just exported from newer data', () => {
        // buildExport() labels the envelope with the record's higher version,
        // which is what makes this refusal possible at all. It also means a
        // learner on an out-of-date client cannot restore their own file — by
        // design, and the message says so.
        seed({ learningProgress: JSON.stringify(progressRecord({ schemaVersion: 99 })) });
        const text = JSON.stringify(P.buildExport());
        localStorage.clear();
        const result = P.importFromText(text);
        expect(result.code).toBe('future-schema');
        expect(localStorage.length).toBe(0);
    });
});

// ===========================================================================
describe('the SRS resync after a successful import', () => {
// ===========================================================================

    it('reloads SRS so a later save cannot write pre-import records back', () => {
        SRS.records = { 'vocab:stale': { word: 'stale', reps: 9 } };
        P.importFromText(file());
        expect(SRS.records).toEqual(JSON.parse(SRSDATA));
        expect(SRS.records['vocab:stale']).toBeUndefined();
    });

    it('migrates a legacy review history on the way in, which REWRITES srsData', () => {
        // The one documented exception to byte-exactness. An export made by a
        // pre-typed-key build carries bare word keys; SRS.load() migrates them
        // and persists the result, so what lands in storage is the migrated
        // form, not the file's bytes. Correct, but it means "byte-exact round
        // trip" holds for data in the CURRENT shape, not for every valid file.
        const legacy = JSON.stringify({ happy: { word: 'happy', reps: 3, interval: 7 } });
        const result = P.importFromText(file({ data: { srsData: legacy } }));
        expect(result.ok).toBe(true);
        expect(localStorage.getItem('srsData')).not.toBe(legacy);
        expect(JSON.parse(localStorage.getItem('srsData'))).toHaveProperty('vocab:happy');
        // Nothing is lost by the rewrite: the scheduling fields are carried.
        expect(JSON.parse(localStorage.getItem('srsData'))['vocab:happy'].reps).toBe(3);
    });

    it('still reports success if the resync throws', () => {
        jest.spyOn(SRS, 'load').mockImplementation(() => { throw new Error('nope'); });
        const result = P.importFromText(file());
        expect(result.ok).toBe(true);
        expect(console.warn).toHaveBeenCalled();
    });
});

// ===========================================================================
describe('resetReviewHistory — clears srsData and nothing else (FR-DATA-5)', () => {
// ===========================================================================

    it('clears the review history', () => {
        seed({ srsData: SRSDATA });
        const result = P.resetReviewHistory();
        expect(result.ok).toBe(true);
        expect(result.cleared).toBe(true);
        expect(result.message).toBe(P.MESSAGES.resetOk);
        expect(localStorage.getItem('srsData')).toBeNull();
    });

    it('leaves progress, streak, completed exercises and settings byte-identical', () => {
        // The whole promise of FR-DATA-5: a reset the learner can afford.
        seedPopulated();
        const before = dumpAll();
        P.resetReviewHistory();
        ['learningProgress', 'mistakeLog', 'sessionPlan', 'theme', 'errorLog',
         'word_serendipity', 'learningProgress.bak.v1', '__storage_test__'].forEach((k) => {
            expect(localStorage.getItem(k)).toBe(before[k]);
        });
        // Streak and completed exercises live inside learningProgress; asserting
        // the raw string is unchanged is what proves neither was touched.
        const p = JSON.parse(localStorage.getItem('learningProgress'));
        expect(p.streak).toBe(7);
        expect(p.completedExercises.vocabulary).toEqual(['vocabulary_everyday_0', 'vocabulary_everyday_3']);
    });

    it('writes the backup BEFORE clearing, so the discarded history is recoverable', () => {
        seed({ srsData: SRSDATA });
        P.resetReviewHistory();
        expect(localStorage.getItem(RESET_BAK)).toBe(SRSDATA);
    });

    it('also takes the never-overwritten migration backup', () => {
        seed({ srsData: SRSDATA });
        P.resetReviewHistory();
        expect(localStorage.getItem('srsData.bak.v' + Migrations.SCHEMA_VERSION)).toBe(SRSDATA);
    });

    it('a second reset rolls the reset copy but keeps the FIRST migration backup', () => {
        // The pre-grading-fix data is the reason this feature exists, and it has
        // to survive a second reset a month later.
        seed({ srsData: '{"vocab:first":{"reps":1}}' });
        P.resetReviewHistory();
        seed({ srsData: '{"vocab:second":{"reps":2}}' });
        P.resetReviewHistory();
        expect(localStorage.getItem(RESET_BAK)).toBe('{"vocab:second":{"reps":2}}');
        expect(localStorage.getItem('srsData.bak.v' + Migrations.SCHEMA_VERSION))
            .toBe('{"vocab:first":{"reps":1}}');
    });

    it('neither backup is ever exported', () => {
        seed({ srsData: SRSDATA, learningProgress: PROGRESS });
        P.resetReviewHistory();
        expect(P.ownedKeys()).toEqual(['learningProgress']);
        expect(Object.keys(P.buildExport().data)).not.toContain(RESET_BAK);
    });

    it('clears the in-memory records too, so the due badge is right immediately', () => {
        seed({ srsData: SRSDATA });
        SRS.records = JSON.parse(SRSDATA);
        P.resetReviewHistory();
        expect(SRS.records).toEqual({});
    });

    it('says so plainly when there is no history to clear, and writes nothing', () => {
        seed({ learningProgress: PROGRESS });
        const before = dumpAll();
        const setItem = jest.spyOn(Storage.prototype, 'setItem');
        const result = P.resetReviewHistory();
        expect(result).toEqual({ ok: true, cleared: false, message: P.MESSAGES.resetNothing });
        expect(setItem).not.toHaveBeenCalled();
        expect(dumpAll()).toEqual(before);
    });

    it('treats an empty srsData string as nothing to clear', () => {
        seed({ srsData: '' });
        const result = P.resetReviewHistory();
        expect(result.cleared).toBe(false);
        expect(result.message).toBe(P.MESSAGES.resetNothing);
    });

    it('clears anyway when the backup will not fit', () => {
        // The learner asked for this, and has been told the old data is
        // unreliable. A full device must not trap them with it.
        seed({ srsData: SRSDATA });
        stubSetItem(() => 'throw');
        const result = P.resetReviewHistory();
        expect(result.ok).toBe(true);
        expect(result.cleared).toBe(true);
        expect(localStorage.getItem('srsData')).toBeNull();
        expect(localStorage.getItem(RESET_BAK)).toBeNull();
        expect(console.warn).toHaveBeenCalled();
    });

    it('reports failure when the history cannot even be read', () => {
        seed({ srsData: SRSDATA });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage unavailable');
        });
        const result = P.resetReviewHistory();
        expect(result.ok).toBe(false);
        expect(result.code).toBe('reset-failed');
        expect(result.message).toBe(P.MESSAGES.resetFailed);
        expect(result.message).toMatch(/Nothing has changed/);
    });

    it('reports failure when the removal itself throws (no SRS module loaded)', () => {
        const savedSRS = global.SRS;
        try {
            delete global.SRS;
            seed({ srsData: SRSDATA });
            jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
                throw quotaError();
            });
            const result = P.resetReviewHistory();
            expect(result.ok).toBe(false);
            expect(result.code).toBe('reset-failed');
        } finally {
            global.SRS = savedSRS;
        }
    });

    it('US-198 FIXED: reports FAILURE when SRS is loaded and the removal fails', () => {
        // SRS.reset() swallows its own removeItem failure
        // (js/core/srs.js:1408 `catch (e) { /* ignore */ }`), so no exception
        // reaches resetReviewHistory() — it used to return
        // `{ ok: true, cleared: true }` with "Your review history is cleared"
        // while `srsData` was still sitting in localStorage. The in-memory records
        // ARE cleared, so the due badge read zero and the UI looked correct; on
        // the next reload SRS.load() read the old records back and the history
        // returned.
        //
        // The module now applies its own doctrine here: the verdict comes from
        // READING THE STORE BACK, exactly as rollback() decides its own (see the
        // "rollback is verified" block above).
        seed({ srsData: SRSDATA });
        SRS.records = JSON.parse(SRSDATA);
        jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw quotaError();
        });

        const result = P.resetReviewHistory();

        expect(result.ok).toBe(false);
        expect(result.cleared).toBeUndefined();
        expect(result.code).toBe('reset-failed');
        expect(result.message).toBe(P.MESSAGES.resetFailed);
        expect(result.message).toMatch(/Nothing has changed/);
        // The history is still here — and now the report agrees with the store.
        expect(localStorage.getItem('srsData')).toBe(SRSDATA);
        // And the in-memory records are back in step with it, so the badge does
        // not show a zero the store disagrees with until the next reload.
        expect(SRS.records).toEqual(JSON.parse(SRSDATA));
        expect(console.warn).toHaveBeenCalled();
    });

    it('reports the outcome as unverified when storage stops answering mid-reset', () => {
        // The removal may or may not have landed: getItem throws only on the
        // read-back. Claiming either outcome would be inventing one (`BR-3`), so
        // this is neither "cleared" nor "nothing has changed".
        seed({ srsData: SRSDATA });
        let reads = 0;
        const realGet = Storage.prototype.getItem;
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (k) {
            reads++;
            if (reads > 1) throw new Error('storage went away');
            return realGet.call(this, k);
        });

        const result = P.resetReviewHistory();

        expect(result.ok).toBe(false);
        expect(result.code).toBe('reset-unverified');
        expect(result.message).toBe(P.MESSAGES.resetUnverified);
        expect(result.message).not.toMatch(/Nothing has changed/);
        expect(result.message).toMatch(/may not have been cleared/);
    });

    it('US-200 FIXED: names the migration backup after the DATA\'s era, not the build\'s', () => {
        // backupOnce(SRS_KEY, buildSchemaVersion()) always passed the CURRENT
        // SCHEMA_VERSION, so a legacy bare-word `srsData` — exactly the
        // pre-grading-fix data FR-DATA-5 exists for — was filed as
        // `srsData.bak.v2`, naming the version it is NOT, while migrations.js's
        // own path files the same pristine data as `srsData.bak.v1`
        // (migrateSrsData: `backupOnce(SRS_KEY, Math.max(1, firstChangedTo - 1))`).
        //
        // Recovery here is by hand, so the name is the whole interface: someone
        // told to look for `.bak.v1` has to find it there.
        const legacy = '{"happy":{"word":"happy","reps":3}}';
        seed({ srsData: legacy });
        P.resetReviewHistory();
        expect(localStorage.getItem('srsData.bak.v1')).toBe(legacy);
        expect(localStorage.getItem('srsData.bak.v2')).toBeNull();
    });

    it('files a legacy DIFFICULTY as v1 too, because that is the other v2 step', () => {
        // srsLevelsV2 rewrites `data.difficulty` through LEVEL_ALIASES, so a
        // typed-key map still holding `intermediate` is pre-v2 data and
        // migrations.js would back it up as v1. Both steps are mirrored, not just
        // the one that is easy to see.
        const legacyLevel = JSON.stringify({
            'vocab:happy': { word: 'happy', reps: 1, data: { difficulty: 'intermediate' } }
        });
        seed({ srsData: legacyLevel });
        P.resetReviewHistory();
        expect(localStorage.getItem('srsData.bak.v1')).toBe(legacyLevel);
        expect(localStorage.getItem('srsData.bak.v2')).toBeNull();
    });

    it('files data already in the current shape under the current version', () => {
        // The flip side: the era is read from the data, so current data must not
        // be filed as legacy either. SRSDATA carries typed keys and no difficulty.
        seed({ srsData: SRSDATA });
        P.resetReviewHistory();
        expect(localStorage.getItem('srsData.bak.v' + Migrations.SCHEMA_VERSION)).toBe(SRSDATA);
        expect(localStorage.getItem('srsData.bak.v1')).toBeNull();
    });

    it('files an unreadable history under the current version, not as legacy', () => {
        // We cannot claim data belongs to an era we could not inspect, so an
        // unparseable value is filed under this build rather than guessed at v1.
        seed({ srsData: 'not json at all' });
        P.resetReviewHistory();
        expect(localStorage.getItem('srsData.bak.v' + Migrations.SCHEMA_VERSION)).toBe('not json at all');
        expect(localStorage.getItem('srsData.bak.v1')).toBeNull();
    });

    it('a stray non-record sibling does not make a typed map look legacy', () => {
        // srsTypedKeysV2 leaves a non-object value exactly where it is, so it
        // says nothing about the era — and neither does the era check.
        const withSibling = JSON.stringify({
            'vocab:happy': { word: 'happy', reps: 1 },
            lastSyncedAt: 1700000000000
        });
        seed({ srsData: withSibling });
        P.resetReviewHistory();
        expect(localStorage.getItem('srsData.bak.v' + Migrations.SCHEMA_VERSION)).toBe(withSibling);
        expect(localStorage.getItem('srsData.bak.v1')).toBeNull();
    });

    it('detects the era with its own fallback when Migrations has no predicate', () => {
        // The era test prefers Migrations.isTypedSrsKey so the two can never
        // disagree about what "typed" means, and falls back to its own regex.
        // The fallback has to reach the same verdict, or a recovery note would
        // point at the wrong name in exactly the environments that need it most.
        const savedIsTyped = Migrations.isTypedSrsKey;
        const legacy = '{"happy":{"word":"happy","reps":3}}';
        try {
            delete Migrations.isTypedSrsKey;
            seed({ srsData: legacy });
            P.resetReviewHistory();
            expect(localStorage.getItem('srsData.bak.v1')).toBe(legacy);
            expect(localStorage.getItem('srsData.bak.v2')).toBeNull();
        } finally {
            Migrations.isTypedSrsKey = savedIsTyped;
        }
    });

    it('resets at all with no Migrations module loaded', () => {
        // index.html loads migrations.js first, but this module is also
        // require()able on its own (see its header), so a missing Migrations
        // must cost the migration-style backup and nothing else.
        const savedMigrations = global.Migrations;
        try {
            delete global.Migrations;
            seed({ srsData: '{"happy":{"word":"happy","reps":3}}' });
            const result = P.resetReviewHistory();
            expect(result.ok).toBe(true);
            expect(result.cleared).toBe(true);
            expect(localStorage.getItem('srsData')).toBeNull();
            // The rolling reset copy does not go through Migrations at all.
            expect(localStorage.getItem(RESET_BAK)).toBe('{"happy":{"word":"happy","reps":3}}');
        } finally {
            global.Migrations = savedMigrations;
        }
    });

    it('a failed reset leaves the history itself intact, records and all', () => {
        // The resync goes through SRS.load(), so legacy data may come back in
        // its MIGRATED shape rather than its stored bytes — the same rewrite the
        // next page load would have done. What must not change is the history:
        // every record is still there and still schedulable.
        const legacy = '{"happy":{"word":"happy","reps":3,"interval":7}}';
        seed({ srsData: legacy });
        jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw quotaError();
        });

        const result = P.resetReviewHistory();

        expect(result.ok).toBe(false);
        expect(result.code).toBe('reset-failed');
        // The record survived, under whichever key shape SRS.load() settled on.
        const keys = Object.keys(SRS.records);
        expect(keys.length).toBe(1);
        expect(SRS.records[keys[0]].reps).toBe(3);
        expect(JSON.parse(localStorage.getItem('srsData'))).not.toEqual({});
    });

    it('the confirm copy promises exactly what the code does', () => {
        expect(P.MESSAGES.resetConfirm).toMatch(/progress, streak, completed exercises and settings stay/);
        expect(P.MESSAGES.resetConfirm).toMatch(/A copy of the review history is kept/);
    });
});

// ===========================================================================
describe('storageInfo — what is on this device (CON-3 / NFR-10)', () => {
// ===========================================================================

    it('separates learner data from everything else in the store', () => {
        seed({ learningProgress: PROGRESS, theme: 'dark', errorLog: '[]', word_x: '{}' });
        const info = P.storageInfo();
        expect(info.keys).toEqual(['learningProgress', 'theme']);
        expect(info.ownedBytes).toBeGreaterThan(0);
        expect(info.totalBytes).toBeGreaterThan(info.ownedBytes);
        expect(info.items.theme).toBe('theme'.length + 'dark'.length);
    });

    it('counts the key as well as the value, because the key costs quota too', () => {
        seed({ theme: 'dark' });
        expect(P.storageInfo().ownedBytes).toBe(9);
    });

    it('TESTABILITY NOTE: byte counts here are UTF-16 units, not UTF-8', () => {
        // byteLength() prefers TextEncoder and silently falls back to
        // String.length. jest-environment-jsdom 30 provides NO TextEncoder
        // (probed: `typeof TextEncoder === 'undefined'`), so every byte figure in
        // this suite — storageInfo().ownedBytes/ownedKB, exportToFile().bytes,
        // and the MAX_IMPORT_BYTES cap — is measured in UTF-16 code units here
        // and in UTF-8 bytes in a real browser. All the size fixtures in this
        // file are therefore ASCII, where the two agree.
        //
        // This assertion pins the FALLBACK, so it fails loudly the day the
        // environment gains TextEncoder and the numbers change meaning.
        seed({ e: 'é😀' });
        const utf16Units = 1 /* key */ + 1 /* é */ + 2 /* surrogate pair */;
        const utf8Bytes = 1 + 2 + 4;
        expect(typeof TextEncoder).toBe('undefined');
        expect(P.storageInfo().ownedBytes).toBe(utf16Units);
        expect(P.storageInfo().ownedBytes).not.toBe(utf8Bytes);
    });

    it('is zero and empty on a fresh device', () => {
        const info = P.storageInfo();
        expect(info.keys).toEqual([]);
        expect(info.items).toEqual({});
        expect(info.ownedBytes).toBe(0);
        expect(info.totalBytes).toBe(0);
        expect(info.ownedKB).toBe('0.0');
    });

    it('reports KB to one decimal', () => {
        seed({ learningProgress: PROGRESS });
        expect(P.storageInfo().ownedKB).toMatch(/^\d+\.\d$/);
    });

    it('survives storage becoming unreadable mid-count', () => {
        seed({ theme: 'dark' });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage unavailable');
        });
        const info = P.storageInfo();
        expect(info.ownedBytes).toBe(0);
        expect(console.warn).toHaveBeenCalled();
    });
});

// ===========================================================================
describe('writesSuspended — the autosave latch', () => {
// ===========================================================================
// `suspended` is a module-level ONE-WAY latch: nothing in the browser clears it,
// because the only thing that legitimately does is the reload after a successful
// import. That used to give this file a declaration-order dependency — the UI
// block imports a file successfully and flipped the latch for every test
// declared after it — which would have broken under `--randomize`.
//
// The seam `Portability._resetWritesSuspended()` (US-207) closes it: beforeEach
// resets the latch, so these assertions hold wherever the block runs. The seam
// is never called in the browser, so it changes no production behaviour.

    it('does not block saves before an import', () => {
        expect(P.writesSuspended()).toBe(false);
    });

    it('blocks them once, and stays blocked until the reload', () => {
        // app.js autosaves every 30s. Without this, an autosave firing between a
        // successful import and the reload writes the PRE-import in-memory state
        // over the record just restored, and the learner watches the restore
        // undo itself.
        P.suspendWrites();
        expect(P.writesSuspended()).toBe(true);
        P.suspendWrites();
        expect(P.writesSuspended()).toBe(true);
    });

    it('is still false here, which is the proof the ordering dependency is gone', () => {
        // Declared immediately after a test that latched it. Before the seam
        // this read `true`, and every later test in the file inherited it.
        expect(P.writesSuspended()).toBe(false);
    });
});

// ===========================================================================
describe('initUI — the Dashboard controls', () => {
// ===========================================================================

    const HTML =
        '<button id="exportData"></button>' +
        '<button id="importData"></button>' +
        '<input id="importDataFile" type="file">' +
        '<button id="resetReviewHistory"></button>' +
        '<p id="dataControlsStatus"></p>' +
        '<p id="dataControlsUsage"></p>';

    let confirmMock;

    /** Synchronous stand-in for FileReader, so the read path is deterministic. */
    const stubFileReader = (textToReturn, mode) => {
        if (mode === 'no-reader') {
            window.FileReader = function () { throw new Error('FileReader unavailable'); };
            return;
        }
        window.FileReader = function () {
            this.onload = null;
            this.onerror = null;
            this.result = null;
            this.readAsText = () => {
                if (mode === 'throw') throw new Error('cannot read');
                if (mode === 'error') { this.onerror(); return; }
                this.result = textToReturn;
                this.onload();
            };
        };
    };

    const pick = (text, size) => {
        const input = document.getElementById('importDataFile');
        Object.defineProperty(input, 'files', {
            value: [{ size: size === undefined ? text.length : size }],
            configurable: true
        });
        input.dispatchEvent(new window.Event('change'));
    };

    const status = () => document.getElementById('dataControlsStatus').textContent;
    const usage = () => document.getElementById('dataControlsUsage').textContent;

    let savedFileReader;

    beforeEach(() => {
        document.body.innerHTML = HTML;
        savedFileReader = window.FileReader;
        confirmMock = jest.fn(() => true);
        window.confirm = confirmMock;                 // jsdom's is a no-op stub
        URL.createObjectURL = jest.fn(() => 'blob:mock');
        URL.revokeObjectURL = jest.fn();
    });

    afterEach(() => {
        window.FileReader = savedFileReader;
        delete URL.createObjectURL;
        delete URL.revokeObjectURL;
        document.body.innerHTML = '';
    });

    it('shows how much is on the device, in the learner\'s words', () => {
        seed({ learningProgress: PROGRESS, theme: 'dark' });
        P.initUI();
        expect(usage()).toMatch(/^On this device now: [\d.]+ KB across 2 items\.$/);
    });

    it('says "item" for one, not "1 items"', () => {
        seed({ theme: 'dark' });
        P.initUI();
        expect(usage()).toMatch(/across 1 item\.$/);
    });

    it('says nothing is saved yet on a fresh device', () => {
        P.initUI();
        expect(usage()).toBe('Nothing saved on this device yet.');
    });

    it('does not throw when the Dashboard markup is absent', () => {
        document.body.innerHTML = '';
        expect(() => P.initUI()).not.toThrow();
    });

    it('the export button reports where the file went', () => {
        seed({ learningProgress: PROGRESS });
        P.initUI();
        document.getElementById('exportData').click();
        expect(status()).toBe(P.MESSAGES.exportOk);
        expect(document.getElementById('dataControlsStatus').className).toContain('success');
    });

    it('the export button reports a failure without blaming the device', () => {
        seed({ learningProgress: PROGRESS });
        P.initUI();
        URL.createObjectURL = () => { throw new Error('no'); };
        document.getElementById('exportData').click();
        expect(status()).toBe(P.MESSAGES.exportFailed);
        expect(document.getElementById('dataControlsStatus').className).toContain('error');
    });

    it('the export button reports a caveat as information, not as a success', () => {
        // US-209: the file saved, but this app cannot restore it. Dressing that
        // in a success tone is what made it a trap.
        seed({ theme: 'dark' });
        P.initUI();
        document.getElementById('exportData').click();
        expect(status()).toBe(P.MESSAGES.exportOkNotRestorable);
        expect(document.getElementById('dataControlsStatus').className).toContain('info');
        expect(document.getElementById('dataControlsStatus').className).not.toContain('success');
        // The usage line is still redrawn: the export did happen.
        expect(usage()).toMatch(/across 1 item\.$/);
    });

    it('the import button opens the picker rather than importing anything', () => {
        P.initUI();
        const input = document.getElementById('importDataFile');
        const clicked = jest.spyOn(input, 'click').mockImplementation(() => {});
        document.getElementById('importData').click();
        expect(clicked).toHaveBeenCalled();
        expect(localStorage.length).toBe(0);
    });

    it('rejects an empty file on its size alone, before reading it', () => {
        P.initUI();
        stubFileReader('', 'ok');
        pick('', 0);
        expect(status()).toBe(P.MESSAGES.empty);
    });

    it('rejects an oversized file on its size alone', () => {
        P.initUI();
        stubFileReader('x', 'ok');
        pick('x', P.MAX_IMPORT_BYTES + 1);
        expect(status()).toBe(P.MESSAGES.tooLarge);
    });

    it('reports a read failure as a read failure', () => {
        P.initUI();
        stubFileReader('', 'error');
        pick('whatever', 10);
        expect(status()).toBe(P.MESSAGES.readFailed);
    });

    it('reports a reader that cannot even start', () => {
        P.initUI();
        stubFileReader('', 'throw');
        pick('whatever', 10);
        expect(status()).toBe(P.MESSAGES.readFailed);
    });

    it('reports an environment with no FileReader at all', () => {
        P.initUI();
        stubFileReader('', 'no-reader');
        pick('whatever', 10);
        expect(status()).toBe(P.MESSAGES.readFailed);
    });

    it('reports a commit that fails AFTER the learner agreed to it', () => {
        // The file was valid, so the learner was asked and said yes; the write
        // then failed. They must be told their data was put back, not left
        // wondering whether the "yes" cost them anything.
        seed({ learningProgress: JSON.stringify(progressRecord({ streak: 1 })), theme: 'dark' });
        const before = P.snapshot();
        P.initUI();
        // The file replaces both keys, so nothing is dropped and the very first
        // write is the one that fails — the store never moves.
        stubFileReader(file({ data: { learningProgress: PROGRESS, theme: 'dark' } }), 'ok');
        stubSetItem((k) => (k === PRE_IMPORT_KEY ? 'pass' : 'throw'));
        pick('x', 10);
        expect(confirmMock).toHaveBeenCalled();
        expect(status()).toBe(P.MESSAGES.quota);
        expect(document.getElementById('dataControlsStatus').className).toContain('error');
        expect(P.snapshot()).toEqual(before);
    });

    it('does NOT ask the learner to confirm a file that was never going to load', () => {
        // Making someone agree to replace their history with a file that is
        // then rejected is the cruellest version of this screen.
        seedPopulated();
        const before = dumpAll();
        P.initUI();
        stubFileReader(file({ app: 'some-other-app' }), 'ok');
        pick('x', 10);
        expect(confirmMock).not.toHaveBeenCalled();
        expect(status()).toBe(P.MESSAGES.notMine);
        expect(dumpAll()).toEqual(before);
    });

    it('asks before replacing data that is already on the device', () => {
        seedPopulated();
        const before = dumpAll();
        confirmMock.mockReturnValue(false);
        P.initUI();
        stubFileReader(file(), 'ok');
        pick('x', 10);
        // The copy is built for THIS file against THIS device, so it can name
        // what the file does not carry (US-204).
        expect(confirmMock).toHaveBeenCalledWith(
            P.importConfirmMessage(P.validateExport(file()).plan)
        );
        expect(confirmMock.mock.calls[0][0]).toContain(P.MESSAGES.importConfirm);
        expect(status()).toBe(P.MESSAGES.cancelled);
        expect(dumpAll()).toEqual(before);
    });

    it('spells out that a review-history-only file will delete the progress', () => {
        seed({ learningProgress: PROGRESS, srsData: SRSDATA });
        confirmMock.mockReturnValue(false);
        P.initUI();
        stubFileReader(file({ data: { srsData: SRSDATA } }), 'ok');
        pick('x', 10);
        expect(confirmMock.mock.calls[0][0]).toContain(P.MESSAGES.importConfirmProgressLost);
        expect(localStorage.getItem('learningProgress')).toBe(PROGRESS);
    });

    it('does not ask on an empty device, because there is nothing to replace', () => {
        jest.useFakeTimers();
        try {
            P.initUI();
            stubFileReader(file(), 'ok');
            pick('x', 10);
            expect(confirmMock).not.toHaveBeenCalled();
            expect(localStorage.getItem('learningProgress')).toBe(PROGRESS);
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });

    it('fails closed when there is no confirm() to ask with', () => {
        // An embedded webview must not perform an irreversible action nobody
        // agreed to.
        seed({ srsData: SRSDATA });
        const saved = window.confirm;
        try {
            window.confirm = undefined;
            P.initUI();
            document.getElementById('resetReviewHistory').click();
            expect(status()).toBe(P.MESSAGES.cancelled);
            expect(localStorage.getItem('srsData')).toBe(SRSDATA);
        } finally {
            window.confirm = saved;
        }
    });

    it('the reset button asks, then clears, then redraws the usage line', () => {
        seed({ srsData: SRSDATA, learningProgress: PROGRESS });
        P.initUI();
        document.getElementById('resetReviewHistory').click();
        expect(confirmMock).toHaveBeenCalledWith(P.MESSAGES.resetConfirm);
        expect(status()).toBe(P.MESSAGES.resetOk);
        expect(localStorage.getItem('srsData')).toBeNull();
        expect(usage()).toMatch(/across 1 item\.$/);
    });

    it('a cancelled reset changes nothing', () => {
        seed({ srsData: SRSDATA });
        const before = dumpAll();
        confirmMock.mockReturnValue(false);
        P.initUI();
        document.getElementById('resetReviewHistory').click();
        expect(status()).toBe(P.MESSAGES.cancelled);
        expect(dumpAll()).toEqual(before);
    });

    describe('the free variables it reaches into app.js for', () => {
        // app.js declares `state` as a top-level `const` in a classic script, so
        // it is a global LEXICAL binding and never appears on `window` — hence
        // the bare identifiers plus typeof guards in the module. Under Jest they
        // resolve up the scope chain to the global object, which is close enough
        // to test the guards.
        afterEach(() => {
            delete global.updateDueCount;
            delete global.exitReview;
            delete global.state;
        });

        it('redraws the due badge after a reset', () => {
            global.updateDueCount = jest.fn();
            seed({ srsData: SRSDATA });
            P.initUI();
            document.getElementById('resetReviewHistory').click();
            expect(global.updateDueCount).toHaveBeenCalled();
        });

        it('leaves review mode BEFORE the badge is redrawn', () => {
            // The review queue was built from records that no longer exist, so
            // redrawing first would render a queue over deleted data.
            const order = [];
            global.exitReview = jest.fn(() => order.push('exitReview'));
            global.updateDueCount = jest.fn(() => order.push('updateDueCount'));
            global.state = { reviewMode: true };
            seed({ srsData: SRSDATA });
            P.initUI();
            document.getElementById('resetReviewHistory').click();
            expect(order).toEqual(['exitReview', 'updateDueCount']);
        });

        it('does not leave review mode when the learner is not in it', () => {
            global.exitReview = jest.fn();
            global.state = { reviewMode: false };
            seed({ srsData: SRSDATA });
            P.initUI();
            document.getElementById('resetReviewHistory').click();
            expect(global.exitReview).not.toHaveBeenCalled();
        });

        it('does not leave review mode when there was nothing to clear', () => {
            global.exitReview = jest.fn();
            global.state = { reviewMode: true };
            P.initUI();
            document.getElementById('resetReviewHistory').click();
            expect(global.exitReview).not.toHaveBeenCalled();
        });

        it('survives either of them throwing', () => {
            global.updateDueCount = () => { throw new Error('badge is broken'); };
            global.exitReview = () => { throw new Error('review is broken'); };
            global.state = { reviewMode: true };
            seed({ srsData: SRSDATA });
            P.initUI();
            expect(() => document.getElementById('resetReviewHistory').click()).not.toThrow();
            // The reset itself still happened and was still reported.
            expect(localStorage.getItem('srsData')).toBeNull();
            expect(status()).toBe(P.MESSAGES.resetOk);
        });

        it('survives `state` not being readable at all', () => {
            // The case the try/catch exists for. In the browser `state` is a
            // top-level `const`; touching it before its initialiser has run
            // throws ReferenceError from the temporal dead zone, and a reset must
            // not die because the learner clicked early in the page's life.
            Object.defineProperty(global, 'state', {
                configurable: true,
                get() { throw new ReferenceError("Cannot access 'state' before initialization"); }
            });
            global.exitReview = jest.fn();
            seed({ srsData: SRSDATA });
            P.initUI();
            expect(() => document.getElementById('resetReviewHistory').click()).not.toThrow();
            expect(global.exitReview).not.toHaveBeenCalled();   // fails closed
            expect(localStorage.getItem('srsData')).toBeNull();
        });
    });

    it('reports "nothing to clear" as information, not as an error', () => {
        seed({ learningProgress: PROGRESS });
        P.initUI();
        document.getElementById('resetReviewHistory').click();
        expect(status()).toBe(P.MESSAGES.resetNothing);
        expect(document.getElementById('dataControlsStatus').className).toContain('info');
    });

    it('reports a failed reset as an error', () => {
        seed({ srsData: SRSDATA });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage unavailable');
        });
        P.initUI();
        document.getElementById('resetReviewHistory').click();
        expect(status()).toBe(P.MESSAGES.resetFailed);
        expect(document.getElementById('dataControlsStatus').className).toContain('error');
    });

    it('clears the file input so picking the same file twice fires again', () => {
        P.initUI();
        stubFileReader(file({ app: 'nope' }), 'ok');
        pick('x', 10);
        expect(document.getElementById('importDataFile').value).toBe('');
    });

    it('ignores a change event with no file behind it', () => {
        P.initUI();
        const input = document.getElementById('importDataFile');
        Object.defineProperty(input, 'files', { value: [], configurable: true });
        expect(() => input.dispatchEvent(new window.Event('change'))).not.toThrow();
        expect(status()).toBe('');
    });

    it('suspends autosaves and RELOADS after a successful import', () => {
        // US-208: the reload is asserted through `Portability._reload`, the seam
        // that exists because jsdom's `location.reload` is a "not implemented"
        // stub, the Location object is unforgeable (defineProperty on it is
        // rejected) and assigning to `window.location` navigates instead of
        // replacing it. In production the seam still calls
        // `global.location.reload()` at exactly this moment.
        jest.useFakeTimers();
        const realReload = P._reload;
        const reload = jest.fn();
        try {
            P._reload = reload;
            seedPopulated();
            P.initUI();
            stubFileReader(file(), 'ok');
            pick('x', 10);

            expect(localStorage.getItem('learningProgress')).toBe(PROGRESS);
            expect(status()).toBe(P.MESSAGES.importOk);
            expect(document.getElementById('dataControlsStatus').className).toContain('success');
            // Suspended BEFORE the reload, or a 30s autosave lands in the gap and
            // writes the pre-import state over what was just restored.
            expect(P.writesSuspended()).toBe(true);
            // Deferred, not synchronous: long enough to read the confirmation.
            expect(reload).not.toHaveBeenCalled();
            expect(jest.getTimerCount()).toBe(1);

            jest.advanceTimersByTime(1500);
            expect(reload).toHaveBeenCalledTimes(1);
        } finally {
            P._reload = realReload;
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });

    it('a reload that throws is logged, not allowed to escape', () => {
        // The learner has already been told the restore succeeded — and it did.
        // A failed reload must not surface as an unhandled error on top of it.
        jest.useFakeTimers();
        const realReload = P._reload;
        try {
            P._reload = () => { throw new Error('navigation blocked'); };
            seed({ learningProgress: PROGRESS });
            P.initUI();
            stubFileReader(file(), 'ok');
            pick('x', 10);
            expect(status()).toBe(P.MESSAGES.importOk);
            expect(() => jest.advanceTimersByTime(1500)).not.toThrow();
            expect(console.warn).toHaveBeenCalled();
        } finally {
            P._reload = realReload;
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });

    it('the default seam is the real reload, not a test stub left behind', () => {
        // The seam is only honest if production still goes to location.reload().
        // jsdom's is a not-implemented stub that logs rather than navigating, so
        // this asserts the wiring, which is all that can be asserted here.
        expect(typeof P._reload).toBe('function');
        expect(String(P._reload)).toContain('location.reload()');
    });

    it('tells the learner to reload themselves when there is no reload to call', () => {
        // An embedded webview with no usable location: the restore still
        // happened, and the copy says what to do about it.
        //
        // The capability check goes through a seam for the same reason the
        // reload itself does — jsdom's `location` is [Unforgeable], so
        // `delete window.location` is a silent no-op and defineProperty on it
        // throws. Without `_canReload` this branch is unreachable here, which is
        // how it stayed uncovered.
        jest.useFakeTimers();
        const realCanReload = P._canReload;
        try {
            P._canReload = () => false;
            seed({ learningProgress: PROGRESS });
            P.initUI();
            stubFileReader(file(), 'ok');
            pick('x', 10);
            expect(status()).toBe(P.MESSAGES.importOkNoReload);
            expect(document.getElementById('dataControlsStatus').className).toContain('success');
            // No reload scheduled, so nothing is promised that will not happen.
            expect(jest.getTimerCount()).toBe(0);
            // The restore itself still landed, and saves are still suspended.
            expect(localStorage.getItem('srsData')).toBe(SRSDATA);
            expect(P.writesSuspended()).toBe(true);
        } finally {
            P._canReload = realCanReload;
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });

    it('the default capability check asks the real location', () => {
        expect(typeof P._canReload).toBe('function');
        // jsdom does provide location.reload (a not-implemented stub), so the
        // real check says yes here — which is why the reload branch is the one
        // every other UI import test takes.
        expect(P._canReload()).toBe(true);
    });
});

// ###########################################################################
//
// US-138 — THE RECORDING ARCHIVE IS IN THE EXPORT
//
// ###########################################################################
//
// WHAT WAS DECIDED, because these tests only make sense against it.
//
// The archive travels as a SECOND ARTEFACT — a binary `.enrec` container — and
// the data file above carries a metadata-only MANIFEST that states, in the file's
// own bytes, that the audio is not in it and names the file it is in. The two
// alternatives were rejected on evidence, not taste:
//
//   - ONE FILE, base64-inlined. A 50MB archive (BlobStore.MAX_TOTAL_BYTES)
//     becomes ~67MB of text that must exist as ONE JavaScript string before it
//     can be written, on the 3GB Android device NFR-6 names as the floor. It also
//     forces MAX_IMPORT_BYTES up from 8MB to ~70MB for EVERY import, including
//     the ones carrying no audio, and it puts two stores with no shared
//     transaction behind one learner action.
//   - MANIFEST ONLY. BR-7 weighs against it directly: a recording is the one
//     thing in this app that cannot be regenerated, and an export that describes
//     it without carrying it is a backup of everything except the irreplaceable
//     part.
//
// WHAT THESE TESTS DO NOT PROVE, on top of the four stubs listed at the top of
// this file:
//
//   1. NO REAL INDEXEDDB. Every archive below is a fake object on
//      `global.BlobStore` implementing the same surface. That is deliberate — it
//      is the only way to drive portability.js's OWN logic rather than
//      blobstore.js's, which has its own 241-test suite — but it means the
//      IndexedDB behaviour of a restore is proven there and nowhere here.
//   2. NO REAL BLOB STORAGE. jsdom's Blob is in-memory and its `slice()` is
//      exact, so the container's offset arithmetic IS proven byte-for-byte
//      (see "the payload bytes survive the round trip"). What is NOT proven is
//      that a browser holds a 50MB `new Blob([...])` on disk rather than on the
//      JS heap. The whole memory argument for the binary container rests on that,
//      and no test in this repo can reach it — only a device can.
//   3. NO REAL DOWNLOAD. `URL.createObjectURL` is a jest.fn() here exactly as it
//      is in the export block above, so "the file lands in a downloads folder"
//      is unproven for BOTH artefacts.
//   4. `TextEncoder` IS STILL ABSENT, so `byteLength()` still falls back to
//      String.length. The container sidesteps this rather than depending on it:
//      asciiJson() escapes every non-ASCII character, so the header's byte length
//      IS its string length in every environment. "the header is pure ASCII" pins
//      that, and it is the one place where the missing TextEncoder would
//      otherwise have silently corrupted a real file.
//   5. NO REAL `FileReader` FAILURE. jsdom's FileReader is real and used
//      unstubbed here, so the header read path is exercised for real — but a
//      genuine I/O error on a half-copied file is synthesised, not reproduced.

// ---------------------------------------------------------------------------
// A fake BlobStore
// ---------------------------------------------------------------------------

/** Read a Blob back as text. jsdom implements FileReader for real. */
const readBlob = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result == null ? '' : reader.result));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsText(blob);
});

const MB = 1024 * 1024;

/**
 * A stand-in for window.BlobStore.
 *
 * `honourRestoreMeta` is the whole point of the option: `false` is TODAY's
 * blobstore.js, which stamps `createdAt` with its own clock and derives
 * `baseline` from insertion order, and `true` is the one-field change US-138
 * needs from it. Both are exercised, because portability.js has to behave
 * honestly against either.
 */
const fakeStore = (opts = {}) => {
    const rows = [];
    let nextId = 1;
    const honour = opts.honourRestoreMeta !== false;

    const total = () => rows.reduce((n, r) => n + r.size, 0);
    const publicRecord = (r) => ({
        id: r.id, promptId: r.promptId, createdAt: r.createdAt, size: r.size,
        mimeType: r.mimeType, durationMs: r.durationMs, label: r.label,
        baseline: r.baseline === true
    });

    const store = {
        MAX_TOTAL_BYTES: opts.maxTotalBytes === undefined ? 50 * MB : opts.maxTotalBytes,
        MAX_RECORDING_BYTES: opts.maxRecordingBytes === undefined ? 10 * MB : opts.maxRecordingBytes,
        rows: rows,
        putCalls: [],
        removeCalls: [],
        supported: opts.supported !== false,

        isSupported: () => {
            if (opts.isSupportedThrows) throw new Error('sandboxed');
            return store.supported;
        },

        usage: () => {
            if (opts.usageThrows) throw new Error('usage exploded');
            if (opts.usageRejects) return Promise.reject(new Error('usage rejected'));
            if (opts.usage) return Promise.resolve(opts.usage);
            const prompts = {};
            rows.forEach((r) => { prompts[r.promptId] = true; });
            return Promise.resolve({
                available: true, count: rows.length, bytes: total(),
                promptCount: Object.keys(prompts).length,
                strandedCount: opts.strandedCount || 0, strandedBytes: opts.strandedBytes || 0
            });
        },

        prompts: () => {
            if (opts.promptsThrows) throw new Error('prompts exploded');
            const byPrompt = {};
            rows.forEach((r) => {
                const e = byPrompt[r.promptId] ||
                    (byPrompt[r.promptId] = { promptId: r.promptId, count: 0, bytes: 0, oldestAt: Infinity, newestAt: 0 });
                e.count += 1; e.bytes += r.size;
                if (r.createdAt < e.oldestAt) e.oldestAt = r.createdAt;
                if (r.createdAt > e.newestAt) e.newestAt = r.createdAt;
            });
            return Promise.resolve(Object.keys(byPrompt).map((k) => byPrompt[k]));
        },

        list: (promptId) => {
            if (opts.listThrowsFor === promptId) return Promise.reject(new Error('list exploded'));
            return Promise.resolve(rows.filter((r) => r.promptId === promptId)
                .sort((a, b) => b.createdAt - a.createdAt).map(publicRecord));
        },

        get: (id) => {
            const row = rows.filter((r) => r.id === id)[0];
            if (!row) return Promise.resolve(null);
            if (opts.unreadableIds && opts.unreadableIds.indexOf(id) !== -1) return Promise.resolve(null);
            if (opts.getThrowsFor === id) return Promise.reject(new Error('get exploded'));
            return Promise.resolve(Object.assign(publicRecord(row), { blob: row.blob }));
        },

        put: (promptId, blob, meta) => {
            store.putCalls.push({ promptId: promptId, blob: blob, meta: meta });
            const refuse = opts.putFails && opts.putFails(promptId, meta, store.putCalls.length);
            if (refuse) return Promise.resolve(refuse);
            if (opts.putRejectsFor === promptId) return Promise.reject(new Error('put exploded'));
            const mine = rows.filter((r) => r.promptId === promptId);
            const hasBaseline = mine.some((r) => r.baseline === true);
            const row = {
                id: nextId++,
                promptId: promptId,
                // The one-line change US-138 needs from blobstore.js. `false` is
                // today's behaviour: the store's own clock, whatever was asked.
                createdAt: (honour && typeof (meta && meta.createdAt) === 'number')
                    ? meta.createdAt : (opts.clock || 9999999999999),
                size: blob.size,
                mimeType: (meta && meta.mimeType) || null,
                durationMs: (meta && typeof meta.durationMs === 'number') ? meta.durationMs : null,
                label: (meta && meta.label) || null,
                // Clamped: two pinned baselines at one prompt would break
                // blobstore.js's own planRetention(), which credits ONE retention
                // slot to a baseline but protects every one of them.
                baseline: (honour && typeof (meta && meta.baseline) === 'boolean')
                    ? (meta.baseline && !hasBaseline)
                    : (mine.length === 0),
                blob: blob
            };
            rows.push(row);
            return Promise.resolve({
                ok: true, record: publicRecord(row), evicted: [],
                evictedPrompts: opts.evictedPrompts || [], bytes: total(), count: rows.length,
                message: 'Saved.'
            });
        },

        remove: (id) => {
            store.removeCalls.push(id);
            if (opts.removeThrows) return Promise.reject(new Error('remove exploded'));
            const at = rows.map((r) => r.id).indexOf(id);
            if (at === -1) return Promise.resolve({ ok: false, code: 'missing' });
            rows.splice(at, 1);
            return Promise.resolve({ ok: true, removed: 1 });
        }
    };

    /** Put a recording in the fake archive directly, bypassing put(). */
    store.seed = (promptId, text, over = {}) => {
        const blob = new Blob([text], { type: over.mimeType || 'audio/webm' });
        const mine = rows.filter((r) => r.promptId === promptId);
        const row = Object.assign({
            createdAt: 1700000000000 + rows.length, durationMs: 1500, label: null,
            baseline: mine.length === 0, mimeType: 'audio/webm'
        }, over, { id: nextId++, promptId: promptId, size: blob.size, blob: blob });
        rows.push(row);
        return row;
    };

    return store;
};

/** Two prompts, three recordings, the older at prompt A pinned as its baseline. */
const seedTwoPrompts = (store) => {
    const a1 = store.seed('lsn:1:aaa', 'MONTH-ONE-AUDIO-A', {
        createdAt: 1700000000000, baseline: true, durationMs: 2100, mimeType: 'audio/webm;codecs=opus'
    });
    const a2 = store.seed('lsn:1:aaa', 'MONTH-THREE-AUDIO-A-IS-LONGER', {
        createdAt: 1707000000000, baseline: false, durationMs: 2600, mimeType: 'audio/webm;codecs=opus'
    });
    const b1 = store.seed('pron:i-I', 'PRONUNCIATION-AUDIO-B', {
        createdAt: 1703000000000, baseline: true, durationMs: 900, label: 'ship / sheep'
    });
    return { a1: a1, a2: a2, b1: b1 };
};

const stubDownloads = () => {
    const created = [];
    URL.createObjectURL = jest.fn((blob) => { created.push(blob); return 'blob:mock-rec'; });
    URL.revokeObjectURL = jest.fn();
    return created;
};

const releaseDownloads = () => {
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
};

// ===========================================================================
describe('US-138 · the container format', () => {
// ===========================================================================

    it('is self-describing from its first byte, at a fixed width', () => {
        // Fixed width so the header is found with ONE slice of known bounds.
        // Scanning for a delimiter means reading bytes to find out where the
        // bytes are, which is the thing this format exists to avoid.
        expect(P.RECORDINGS_MAGIC).toBe('ENGPORTAL-REC');
        expect(P.RECORDINGS_PREFIX_BYTES).toBe('ENGPORTAL-REC'.length + 1 + 1 + 10 + 1);
        expect(P.RECORDINGS_PREFIX_BYTES).toBe(26);
        expect(P.RECORDINGS_FORMAT_VERSION).toBe(1);
        expect(P.RECORDINGS_KIND).toBe('learner-recordings-export');
    });

    it('does NOT bump the data file\'s formatVersion, so old builds still read it', () => {
        // validateExport() refuses `formatVersion > FORMAT_VERSION`. Bumping it to
        // announce the manifest would make every new export unreadable to every
        // deployed build — for a block those builds read correctly by ignoring.
        // Same call blobstore.js makes for RECORD_VERSION against DB_VERSION.
        expect(P.FORMAT_VERSION).toBe(1);
        const archive = { available: true, count: 2, promptCount: 1, bytes: 40, prompts: [], capturedAt: 'x' };
        seed({ learningProgress: PROGRESS });
        const withManifest = JSON.stringify(P.buildExport(archive));
        expect(P.validateExport(withManifest).ok).toBe(true);
        expect(JSON.parse(withManifest).formatVersion).toBe(1);
        expect(JSON.parse(withManifest).recordings.recordingsFormat).toBe(1);
    });

    it('names the companion file with the SAME date stamp as the data file', () => {
        // The pairing has to survive being looked at in a downloads folder a month
        // later, not only being described once on a screen.
        const day = new Date(2026, 8, 12);
        expect(P.exportFileName(day)).toBe('english-portal-data-2026-09-12.json');
        expect(P.recordingsFileName(day)).toBe('english-portal-recordings-2026-09-12.enrec');
    });
});

// ===========================================================================
describe('US-138 · archiveSummary — asking the archive, and never failing', () => {
// ===========================================================================

    it('reports available:false when blobstore.js is not loaded at all', async () => {
        // An old service-worker cache with index.html but not js/core/blobstore.js.
        // BlobStore guarantees its own methods never reject; it guarantees nothing
        // about not existing.
        const summary = await P.archiveSummary();
        expect(summary.available).toBe(false);
        expect(summary.count).toBe(0);
    });

    it('reports available:false — not count:0 — when there is no IndexedDB', async () => {
        // The distinction is the whole point. "There are no recordings" and "this
        // app could not look" are different facts to somebody deciding whether it
        // is safe to wipe their phone (`BR-3`).
        global.BlobStore = fakeStore({ supported: false });
        const summary = await P.archiveSummary();
        expect(summary.available).toBe(false);
        expect(P.archivePossible()).toBe(false);
    });

    it('survives isSupported() itself throwing, as it can in a sandboxed iframe', async () => {
        global.BlobStore = fakeStore({ isSupportedThrows: true });
        expect(P.archivePossible()).toBe(false);
        expect((await P.archiveSummary()).available).toBe(false);
    });

    it('reports what the archive holds, per prompt', async () => {
        const store = fakeStore();
        seedTwoPrompts(store);
        global.BlobStore = store;

        const summary = await P.archiveSummary();
        expect(summary.available).toBe(true);
        expect(summary.count).toBe(3);
        expect(summary.promptCount).toBe(2);
        expect(summary.bytes).toBeGreaterThan(0);
        expect(summary.prompts.map((p) => p.promptId).sort()).toEqual(['lsn:1:aaa', 'pron:i-I']);
        const a = summary.prompts.filter((p) => p.promptId === 'lsn:1:aaa')[0];
        expect(a.count).toBe(2);
        expect(a.oldestAt).toBe(1700000000000);
        expect(a.newestAt).toBe(1707000000000);
        expect(typeof summary.capturedAt).toBe('string');
    });

    it('reports available:false when usage() says the store is unavailable', async () => {
        global.BlobStore = fakeStore({ usage: { available: false, count: 0 } });
        expect((await P.archiveSummary()).available).toBe(false);
    });

    it('never rejects when usage() throws or rejects, and logs it', async () => {
        global.BlobStore = fakeStore({ usageThrows: true });
        expect((await P.archiveSummary()).available).toBe(false);
        global.BlobStore = fakeStore({ usageRejects: true });
        expect((await P.archiveSummary()).available).toBe(false);
        expect(console.warn).toHaveBeenCalled();
    });

    it('still reports the totals when only prompts() fails', async () => {
        // The per-prompt breakdown is a nicety; the count is the fact.
        const store = fakeStore({ promptsThrows: true });
        store.seed('lsn:1:aaa', 'audio');
        global.BlobStore = store;
        const summary = await P.archiveSummary();
        expect(summary.available).toBe(true);
        expect(summary.count).toBe(1);
        expect(summary.prompts).toEqual([]);
    });

    it('caches through refreshArchive(), and the cache starts empty', async () => {
        expect(P.cachedArchive()).toBeNull();
        const store = fakeStore();
        store.seed('lsn:1:aaa', 'audio');
        global.BlobStore = store;
        await P.refreshArchive();
        expect(P.cachedArchive().count).toBe(1);
    });
});

// ===========================================================================
describe('US-138 · the data file tells the truth about what it lacks', () => {
// ===========================================================================

    afterEach(releaseDownloads);

    it('carries NO recordings block when the archive was never asked', () => {
        // Which is why every byte-exactness and rejection proof above is
        // untouched: buildExport() with no argument is what it always was.
        seedPopulated();
        expect(P.buildExport()).not.toHaveProperty('recordings');
        expect(Object.keys(P.buildExport()).sort()).toEqual(
            ['app', 'data', 'exportedAt', 'formatVersion', 'keyCount', 'kind', 'schemaVersion']
        );
    });

    it('states IN THE FILE that the audio is not in it, and names the file it is in', async () => {
        // The honesty rule as bytes rather than as a message on a screen the
        // learner will not have in front of them in three months.
        const store = fakeStore();
        seedTwoPrompts(store);
        global.BlobStore = store;
        seed({ learningProgress: PROGRESS });

        const envelope = P.buildExport(await P.archiveSummary());
        expect(envelope.recordings.audioIncluded).toBe(false);
        expect(envelope.recordings.count).toBe(3);
        expect(envelope.recordings.promptCount).toBe(2);
        expect(envelope.recordings.note).toMatch(/does NOT contain your recordings/);
        expect(envelope.recordings.note).toMatch(/companionFile/);
        expect(envelope.recordings.companionFile).toMatch(/^english-portal-recordings-\d{4}-\d{2}-\d{2}\.enrec$/);
        expect(envelope.recordings.prompts.length).toBe(2);
    });

    it('says it could not look, rather than claiming none, when the archive is unreachable', async () => {
        global.BlobStore = fakeStore({ supported: false });
        const envelope = P.buildExport(await P.archiveSummary());
        expect(envelope.recordings.archiveReadable).toBe(false);
        expect(envelope.recordings.count).toBe(0);
        expect(envelope.recordings.note).toBe(P.MESSAGES.manifestUnavailableNote);
        expect(envelope.recordings.note).toMatch(/could not open its recording storage/);
        expect(envelope.recordings).not.toHaveProperty('prompts');
    });

    it('reports the rows blobstore.js can see and cannot free, separately', async () => {
        // US-228's stranded rows. They are part of what this app costs the device,
        // so a manifest that silently dropped them would under-report the archive
        // by exactly the bytes nobody can free.
        const store = fakeStore({ strandedCount: 2, strandedBytes: 4096 });
        store.seed('lsn:1:aaa', 'audio');
        global.BlobStore = store;
        const envelope = P.buildExport(await P.archiveSummary());
        expect(envelope.recordings.unreadableCount).toBe(2);
        expect(envelope.recordings.unreadableBytes).toBe(4096);
    });

    it('exportToFile() hands back the facts a caller needs to say what is missing', async () => {
        stubDownloads();
        const store = fakeStore();
        seedTwoPrompts(store);
        global.BlobStore = store;
        seed({ learningProgress: PROGRESS });

        const result = await P.exportAll();
        expect(result.ok).toBe(true);
        expect(result.archiveKnown).toBe(true);
        expect(result.recordings.count).toBe(3);
        expect(result.recordingsMessage).toBe(P.MESSAGES.exportRecordingsElsewhere);
        expect(result.message).toBe(P.MESSAGES.exportOk);
    });

    it('says nothing about recordings when there are none, rather than reassuring', async () => {
        stubDownloads();
        global.BlobStore = fakeStore();
        seed({ learningProgress: PROGRESS });
        const result = await P.exportAll();
        expect(result.archiveKnown).toBe(true);
        expect(result.recordings.count).toBe(0);
        expect(result.recordingsMessage).toBeNull();
    });

    it('archiveKnown is false — not "none" — for a plain exportToFile()', () => {
        stubDownloads();
        seed({ learningProgress: PROGRESS });
        const result = P.exportToFile();
        expect(result.archiveKnown).toBe(false);
        expect(result.recordings).toBeNull();
        expect(result.recordingsMessage).toBeNull();
    });

    it('exportAll() still produces the data file when the archive throws', async () => {
        // The data export is the one thing that has always worked. A failure in a
        // store it did not use before must not be able to take it away.
        stubDownloads();
        global.BlobStore = fakeStore({ usageThrows: true });
        seed({ learningProgress: PROGRESS });
        const result = await P.exportAll();
        expect(result.ok).toBe(true);
        expect(result.recordings.archiveReadable).toBe(false);
    });

    it('validateExport reads a manifest back, and NEVER refuses a file over one', () => {
        // A manifest is informational. Refusing an otherwise-good file because a
        // number in it is malformed would cost the learner their progress to
        // protect them from a wrong count.
        const good = P.validateExport(file({
            recordings: {
                recordingsFormat: 1, audioIncluded: false, archiveReadable: true,
                count: 4, promptCount: 2, bytes: 900
            }
        }));
        expect(good.ok).toBe(true);
        expect(good.plan.recordings.readable).toBe(true);
        expect(good.plan.recordings.count).toBe(4);

        ['junk', 42, null, [], { count: 'lots' }].forEach((junk) => {
            expect(P.validateExport(file({ recordings: junk })).ok).toBe(true);
        });
        expect(P.validateExport(file({ recordings: 'junk' })).plan.recordings.readable).toBe(false);
        // An empty object is a manifest, just an uninformative one.
        expect(P.validateExport(file({ recordings: {} })).plan.recordings.count).toBe(0);
        expect(P.validateExport(file({ recordings: { count: 'lots' } })).plan.recordings.count).toBe(0);
    });

    it('distinguishes "no manifest" from "a manifest saying zero"', () => {
        const old = P.validateExport(file());
        expect(old.plan.recordings.absent).toBe(true);
        expect(old.plan.recordings.readable).toBe(false);

        const zero = P.validateExport(file({
            recordings: { recordingsFormat: 1, audioIncluded: false, count: 0 }
        }));
        expect(zero.plan.recordings.absent).toBe(false);
        expect(zero.plan.recordings.readable).toBe(true);
        expect(zero.plan.recordings.count).toBe(0);
    });

    it('refuses to trust a block CLAIMING to carry audio, because this build cannot read one', () => {
        const result = P.validateExport(file({ recordings: { audioIncluded: true, count: 3 } }));
        expect(result.ok).toBe(true);               // the localStorage half still restores
        expect(result.plan.recordings.readable).toBe(false);
        expect(result.plan.recordings.audioIncluded).toBe(true);
    });

    it('an OLD file with no manifest still imports, byte for byte', () => {
        // The compatibility half of "a reader must be able to tell an old file
        // from a new one, and an old file must still import".
        seedPopulated();
        const before = P.snapshot();
        const text = JSON.stringify(P.buildExport(), null, 2);
        localStorage.clear();
        expect(P.importFromText(text).ok).toBe(true);
        expect(P.snapshot()).toEqual(before);
    });

    it('a file WITH a manifest imports byte for byte too, and the manifest is not written', () => {
        const archive = { available: true, count: 2, promptCount: 1, bytes: 40, prompts: [], capturedAt: 'x' };
        seedPopulated();
        const before = P.snapshot();
        const text = JSON.stringify(P.buildExport(archive), null, 2);
        localStorage.clear();
        expect(P.importFromText(text).ok).toBe(true);
        expect(P.snapshot()).toEqual(before);
        // The manifest is metadata about another store; it must not become a key.
        expect(localStorage.getItem('recordings')).toBeNull();
        expect(P.ownedKeys()).not.toContain('recordings');
    });
});

// ===========================================================================
describe('US-138 · the confirm copy: a data restore does not touch recordings', () => {
// ===========================================================================
// `MESSAGES.importConfirm` promises that "anything saved here that the file does
// not contain is removed". That is true of localStorage and FALSE of the archive,
// which lives in another store and is not touched. A learner who has just read
// the general rule will assume it covers their recordings, so the exception is
// stated rather than left to be discovered.

    const planFor = (text) => {
        const checked = P.validateExport(text);
        expect(checked.ok).toBe(true);
        return checked.plan;
    };

    it('says the recordings are kept when the FILE lists some', () => {
        seed({ learningProgress: PROGRESS, srsData: SRSDATA });
        const message = P.importConfirmMessage(planFor(file({
            recordings: {
                recordingsFormat: 1, audioIncluded: false, archiveReadable: true,
                count: 5, promptCount: 2
            }
        })));
        expect(message).toContain(P.MESSAGES.importConfirmRecordingsNotInFile);
        expect(message).toContain(P.MESSAGES.importConfirmRecordingsKept);
        expect(message).toMatch(/neither removes them nor changes them/);
        expect(message.endsWith(P.MESSAGES.importConfirmTail)).toBe(true);
    });

    it('says it when THIS DEVICE is known to hold some, even for an old file', () => {
        P._setArchiveCache({ available: true, count: 4, promptCount: 2, bytes: 90, prompts: [] });
        seed({ learningProgress: PROGRESS, srsData: SRSDATA });
        const message = P.importConfirmMessage(planFor(file()));
        expect(message).toContain(P.MESSAGES.importConfirmRecordingsKept);
        expect(message).not.toContain(P.MESSAGES.importConfirmRecordingsNotInFile);
    });

    it('says nothing when nothing has ever been recorded — silence is the honest answer', () => {
        seed({ learningProgress: PROGRESS, srsData: SRSDATA });
        expect(P.importConfirmMessage(planFor(file()))).toBe(
            P.MESSAGES.importConfirm + '\n\n' + P.MESSAGES.importConfirmTail
        );
        P._setArchiveCache({ available: true, count: 0, promptCount: 0, bytes: 0, prompts: [] });
        expect(P.importConfirmMessage(planFor(file()))).not.toContain('recordings are not part of this');
    });

    it('does not claim "none" from a cache that says "could not look"', () => {
        // The cache is only ever read through `available === true`, so a stale or
        // absent one degrades to silence rather than to a false reassurance.
        P._setArchiveCache({ available: false, count: 0, promptCount: 0, bytes: 0, prompts: [] });
        seed({ learningProgress: PROGRESS, srsData: SRSDATA });
        expect(P.importConfirmMessage(planFor(file()))).toBe(
            P.MESSAGES.importConfirm + '\n\n' + P.MESSAGES.importConfirmTail
        );
    });

    it('admits when the file has a recordings block it cannot read', () => {
        seed({ learningProgress: PROGRESS, srsData: SRSDATA });
        const message = P.importConfirmMessage(planFor(file({ recordings: 'something new' })));
        expect(message).toContain(P.MESSAGES.importConfirmRecordingsUnreadable);
        expect(message).toMatch(/not affected either way/);
    });
});

// ===========================================================================
describe('US-138 · exportRecordingsToFile — the companion file', () => {
// ===========================================================================

    let created;

    beforeEach(() => { created = stubDownloads(); });
    afterEach(releaseDownloads);

    it('assembles prefix, header and payloads in that order, byte for byte', async () => {
        const store = fakeStore();
        seedTwoPrompts(store);
        global.BlobStore = store;

        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(true);
        expect(result.count).toBe(3);
        expect(result.promptCount).toBe(2);
        expect(result.complete).toBe(true);
        expect(result.missed).toBe(0);
        expect(result.fileName).toMatch(/^english-portal-recordings-\d{4}-\d{2}-\d{2}\.enrec$/);
        expect(result.message).toBe(P.MESSAGES.recordingsExportOk);
        // Names its pair in the RESULT as well as in the header.
        expect(result.companionFile).toMatch(/^english-portal-data-/);

        expect(created.length).toBe(1);
        const whole = await readBlob(created[0]);
        expect(whole.slice(0, P.RECORDINGS_MAGIC.length)).toBe(P.RECORDINGS_MAGIC);
        const declared = Number(whole.slice(15, 25));
        expect(declared).toBe(result.headerBytes);
        expect(whole.charAt(25)).toBe('\n');

        const header = JSON.parse(whole.slice(P.RECORDINGS_PREFIX_BYTES,
            P.RECORDINGS_PREFIX_BYTES + declared));
        expect(header.app).toBe(P.APP_ID);
        expect(header.kind).toBe(P.RECORDINGS_KIND);
        expect(header.complete).toBe(true);
        expect(header.companionFile).toBe(result.companionFile);
        // Grouped by prompt, oldest first inside each: a file whose bytes depend
        // on enumeration order cannot be compared between two exports.
        expect(header.entries.map((e) => e.promptId + '@' + e.createdAt)).toEqual([
            'lsn:1:aaa@1700000000000',
            'lsn:1:aaa@1707000000000',
            'pron:i-I@1703000000000'
        ]);
        // And the payloads follow in exactly that order, back to back.
        expect(whole.slice(P.RECORDINGS_PREFIX_BYTES + declared)).toBe(
            'MONTH-ONE-AUDIO-A' + 'MONTH-THREE-AUDIO-A-IS-LONGER' + 'PRONUNCIATION-AUDIO-B'
        );
    });

    it('carries the metadata that makes month-one comparable with month-three', async () => {
        const store = fakeStore();
        seedTwoPrompts(store);
        global.BlobStore = store;
        await P.exportRecordingsToFile();

        const whole = await readBlob(created[0]);
        const declared = Number(whole.slice(15, 25));
        const header = JSON.parse(whole.slice(26, 26 + declared));
        expect(header.entries[0]).toEqual({
            promptId: 'lsn:1:aaa',
            createdAt: 1700000000000,
            bytes: 'MONTH-ONE-AUDIO-A'.length,
            mimeType: 'audio/webm;codecs=opus',
            durationMs: 2100,
            baseline: true,
            label: null
        });
        expect(header.entries[1].baseline).toBe(false);
        expect(header.entries[2].label).toBe('ship / sheep');
    });

    it('the header is pure ASCII, so its byte length IS its string length', async () => {
        // The one place a missing TextEncoder would have silently corrupted a real
        // file: every payload offset is derived from the declared header length,
        // and a header whose bytes and characters disagree shifts every one of
        // them. asciiJson() escapes non-ASCII rather than measuring it, so the
        // arithmetic is right in an environment with no TextEncoder AND in one
        // with it. `new Blob([s]).size` is jsdom's real UTF-8 byte count.
        const store = fakeStore();
        store.seed('lsn:1:aaa', 'AUDIO', { label: 'పరీక్ష 😀 é — “quoted”' });
        global.BlobStore = store;
        await P.exportRecordingsToFile();

        const whole = await readBlob(created[0]);
        const declared = Number(whole.slice(15, 25));
        const headerText = whole.slice(26, 26 + declared);
        expect(headerText.length).toBe(declared);
        expect(new Blob([headerText]).size).toBe(declared);
        // Escaped, not lost: the label comes back exactly.
        expect(JSON.parse(headerText).entries[0].label).toBe('పరీక్ష 😀 é — “quoted”');
        expect(headerText).toMatch(/\\u0c2a/);        // really escaped in the bytes
    });

    it('refuses when blobstore.js is not loaded, without touching anything', async () => {
        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(false);
        expect(result.code).toBe('recordings-unavailable');
        expect(result.message).toBe(P.MESSAGES.recordingsExportUnavailable);
        expect(created.length).toBe(0);
    });

    it('refuses on a device with no IndexedDB, and says the data file is unaffected', async () => {
        global.BlobStore = fakeStore({ supported: false });
        const result = await P.exportRecordingsToFile();
        expect(result.code).toBe('recordings-unavailable');
        expect(result.message).toMatch(/Your data file is unaffected/);
        expect(created.length).toBe(0);
    });

    it('says there is nothing to save rather than writing an empty file', async () => {
        global.BlobStore = fakeStore();
        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(false);
        expect(result.code).toBe('no-recordings');
        expect(result.message).toBe(P.MESSAGES.recordingsExportNone);
        expect(created.length).toBe(0);
    });

    it('REFUSES rather than truncates when the archive is over the ceiling', async () => {
        // The requirement in one test: an archive too large to put in one file is
        // refused, by name and with the number, and NOT written as "some of your
        // recordings" in a file called english-portal-recordings-<date>.
        const store = fakeStore({
            maxTotalBytes: 4 * MB,
            usage: { available: true, count: 3, bytes: 6 * MB, promptCount: 2, strandedCount: 0, strandedBytes: 0 }
        });
        seedTwoPrompts(store);
        global.BlobStore = store;

        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(false);
        expect(result.code).toBe('too-large');
        expect(result.message).toMatch(/^Your recordings come to 6\.0 MB, which is more than this app will put in one file \(4\.0 MB\)\./);
        expect(result.message).toMatch(/Nothing has been saved and nothing has been deleted/);
        // No file, and not one row touched.
        expect(created.length).toBe(0);
        expect(store.rows.length).toBe(3);
        expect(store.removeCalls).toEqual([]);
    });

    it('refuses an archive with more rows than one header can honestly describe', async () => {
        const store = fakeStore({
            usage: {
                available: true, count: P.MAX_RECORDINGS_ENTRIES + 1, bytes: 1024,
                promptCount: 1, strandedCount: 0, strandedBytes: 0
            }
        });
        store.seed('lsn:1:aaa', 'audio');
        global.BlobStore = store;
        const result = await P.exportRecordingsToFile();
        expect(result.code).toBe('too-many');
        expect(result.message).toContain(String(P.MAX_RECORDINGS_ENTRIES));
        expect(created.length).toBe(0);
    });

    it('refuses mid-read when the archive grows past the ceiling under it', async () => {
        // usage() said it would fit; by the time the payloads were read it did
        // not. Stopping and refusing is the only answer that does not write a
        // file holding an arbitrary prefix of somebody's archive.
        const store = fakeStore({
            maxTotalBytes: 20,
            usage: { available: true, count: 3, bytes: 10, promptCount: 2, strandedCount: 0, strandedBytes: 0 }
        });
        seedTwoPrompts(store);
        global.BlobStore = store;
        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(false);
        expect(result.code).toBe('too-large');
        expect(created.length).toBe(0);
    });

    it('reports a PARTIAL file as partial, in the result and in its own header', async () => {
        // A row that could not be read is counted, never invented, and the file
        // says `complete:false` in its own bytes so a reader a year later is not
        // relying on having remembered a status line.
        const store = fakeStore({ unreadableIds: [2] });
        seedTwoPrompts(store);
        global.BlobStore = store;

        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(true);
        expect(result.complete).toBe(false);
        expect(result.missed).toBe(1);
        expect(result.count).toBe(2);
        expect(result.message).toBe(P.MESSAGES.recordingsExportPartial);
        expect(result.message).toMatch(/Nothing has been deleted/);

        const whole = await readBlob(created[0]);
        const header = JSON.parse(whole.slice(26, 26 + Number(whole.slice(15, 25))));
        expect(header.complete).toBe(false);
        expect(header.unreadCount).toBe(1);
        expect(header.count).toBe(2);
    });

    it('does NOT say "no recordings" when there are three and none could be read', async () => {
        // The archive says it holds three; not one payload came back. That is a
        // device problem, and reporting it as an empty archive would tell a
        // learner they have nothing in exactly the moment they are checking
        // whether it is safe to wipe the phone (`BR-3`).
        const store = fakeStore({ unreadableIds: [1, 2, 3] });
        seedTwoPrompts(store);
        global.BlobStore = store;
        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(false);
        expect(result.code).toBe('recordings-unreadable');
        expect(result.message).toBe(P.MESSAGES.recordingsExportUnreadable);
        expect(result.message).toMatch(/There are recordings on this device, but none of them could be read/);
        expect(result.message).toMatch(/Nothing has been deleted/);
        expect(created.length).toBe(0);
    });

    it('survives a get() that rejects, and counts the row as unread', async () => {
        const store = fakeStore({ getThrowsFor: 1 });
        seedTwoPrompts(store);
        global.BlobStore = store;
        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(true);
        expect(result.missed).toBe(1);
        expect(result.complete).toBe(false);
        expect(console.warn).toHaveBeenCalled();
    });

    it('counts a prompt it could not even LIST as missing, so `complete` cannot lie', async () => {
        // A prompt whose list() failed contributes no rows at all, so counting
        // only failed READS would let a file that is short a whole prompt's
        // recordings stamp itself `complete: true` — the one claim in this
        // container a learner would rely on a year later. `missed` is therefore
        // measured against the ledger's own count.
        const store = fakeStore({ listThrowsFor: 'pron:i-I' });
        seedTwoPrompts(store);
        global.BlobStore = store;
        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(true);
        expect(result.count).toBe(2);
        expect(result.promptCount).toBe(1);
        expect(result.missed).toBe(1);
        expect(result.complete).toBe(false);
        expect(result.message).toBe(P.MESSAGES.recordingsExportPartial);
        const whole = await readBlob(created[0]);
        expect(JSON.parse(whole.slice(26, 26 + Number(whole.slice(15, 25)))).complete).toBe(false);
    });

    it('reports a download failure without blaming the recordings', async () => {
        const store = fakeStore();
        seedTwoPrompts(store);
        global.BlobStore = store;
        URL.createObjectURL = jest.fn(() => { throw new Error('no blobs today'); });
        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(false);
        expect(result.code).toBe('export-failed');
        expect(result.message).toBe(P.MESSAGES.recordingsExportFailed);
        expect(result.message).toMatch(/no recording has been deleted/);
        expect(store.rows.length).toBe(3);
    });

    it('never rejects, whatever the store does', async () => {
        // The contract blobstore.js keeps for itself, kept here too: a Dashboard
        // button may await this without a catch.
        global.BlobStore = { isSupported: () => true, prompts: 1, list: 2, get: 3 };
        await expect(P.exportRecordingsToFile()).resolves.toEqual(
            expect.objectContaining({ ok: false, code: 'recordings-unavailable' })
        );
    });
});

// ===========================================================================
describe('US-138 · readRecordingsFile — validate before write', () => {
// ===========================================================================
// The same doctrine as validateExport(): every refusal below is asserted to have
// called BlobStore.put() exactly zero times. A recordings restore has no
// rollback() — there is no transaction spanning IndexedDB — so "never write until
// the whole file has passed" is not a nicety here, it is the whole safety story.

    const padTo = (value, width) => {
        let s = String(value);
        while (s.length < width) s = '0' + s;
        return s;
    };

    /**
     * Build a container by hand, so the reader can be handed things the writer
     * would never produce.
     */
    const makeContainer = (items, over = {}, tweak = {}) => {
        const blobs = items.map((i) => new Blob([i.text], { type: i.mimeType || 'audio/webm' }));
        const entries = items.map((i, n) => ({
            promptId: i.promptId,
            createdAt: i.createdAt,
            bytes: blobs[n].size,
            mimeType: i.mimeType || 'audio/webm',
            durationMs: i.durationMs === undefined ? 1000 : i.durationMs,
            baseline: !!i.baseline,
            label: i.label === undefined ? null : i.label
        }));
        const prompts = {};
        entries.forEach((e) => { prompts[e.promptId] = true; });
        const header = Object.assign({
            app: P.APP_ID,
            kind: P.RECORDINGS_KIND,
            formatVersion: P.RECORDINGS_FORMAT_VERSION,
            exportedAt: '2026-09-12T00:00:00.000Z',
            companionFile: 'english-portal-data-2026-09-12.json',
            count: entries.length,
            bytes: entries.reduce((n, e) => n + e.bytes, 0),
            promptCount: Object.keys(prompts).length,
            complete: true,
            unreadCount: 0,
            entries: entries
        }, over);
        const json = typeof tweak.rawHeader === 'string' ? tweak.rawHeader : JSON.stringify(header);
        const declared = tweak.declaredLength === undefined ? json.length : tweak.declaredLength;
        const magic = tweak.magic === undefined ? P.RECORDINGS_MAGIC : tweak.magic;
        const version = tweak.version === undefined ? P.RECORDINGS_FORMAT_VERSION : tweak.version;
        const digits = typeof declared === 'string' ? declared : padTo(declared, 10);
        const prefix = magic + version + ':' + digits + '\n';
        const parts = [prefix, json].concat(blobs);
        if (tweak.trailing) parts.push(tweak.trailing);
        const blob = new Blob(parts, { type: P.RECORDINGS_MIME });
        if (tweak.dropBytes) return blob.slice(0, blob.size - tweak.dropBytes);
        return blob;
    };

    const ONE = [{ promptId: 'lsn:1:aaa', createdAt: 1700000000000, text: 'AUDIO-A', baseline: true }];

    /** A well-formed container, as the baseline the rejections are measured from. */
    it('accepts a container this module wrote and reports its entries with offsets', async () => {
        const read = await P.readRecordingsFile(makeContainer(ONE));
        expect(read.ok).toBe(true);
        expect(read.entries.length).toBe(1);
        expect(read.entries[0].promptId).toBe('lsn:1:aaa');
        expect(read.entries[0].createdAt).toBe(1700000000000);
        expect(read.entries[0].baseline).toBe(true);
        expect(read.entries[0].end - read.entries[0].start).toBe('AUDIO-A'.length);
        expect(read.header.kind).toBe(P.RECORDINGS_KIND);
    });

    const rejections = () => [
        ['an empty file', new Blob([]), 'recordings-empty', P.MESSAGES.recordingsEmptyFile],
        ['something far too short to be one', new Blob(['nope']), 'recordings-foreign', P.MESSAGES.recordingsNotMine],
        ['a file with the wrong magic', makeContainer(ONE, {}, { magic: 'SOMEOTHERAPP1' }), 'recordings-foreign', P.MESSAGES.recordingsNotMine],
        ['a container from the future', makeContainer(ONE, {}, { version: 2 }), 'recordings-future-format', P.MESSAGES.recordingsFutureFile],
        ['a length that is not digits', makeContainer(ONE, {}, { declaredLength: 'abcdefghij' }), 'recordings-foreign', P.MESSAGES.recordingsNotMine],
        ['a zero-length header', makeContainer(ONE, {}, { declaredLength: 0 }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['a header longer than the whole file', makeContainer(ONE, {}, { declaredLength: 999999 }), 'recordings-incomplete', P.MESSAGES.recordingsIncomplete],
        ['a header length that lands inside the JSON', makeContainer(ONE, {}, { declaredLength: 20 }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['a header that is not JSON', makeContainer(ONE, {}, { rawHeader: '{not json at all' }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['a header that is a JSON array', makeContainer(ONE, {}, { rawHeader: '[1,2,3]' }), 'recordings-foreign', P.MESSAGES.recordingsNotMine],
        ['another app\'s container', makeContainer(ONE, { app: 'some-other-app' }), 'recordings-foreign', P.MESSAGES.recordingsNotMine],
        ['our app, the wrong kind of file', makeContainer(ONE, { kind: 'learner-data-export' }), 'recordings-foreign', P.MESSAGES.recordingsNotMine],
        ['no entries array', makeContainer(ONE, { entries: undefined }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['an empty entries array', makeContainer(ONE, { entries: [] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['entries that are not objects', makeContainer(ONE, { entries: ['nope'] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['a count that disagrees with entries', makeContainer(ONE, { count: 4 }), 'recordings-incomplete', P.MESSAGES.recordingsIncomplete],
        ['an entry with no promptId', makeContainer(ONE, { entries: [{ createdAt: 1, bytes: 7 }] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['an entry with an absurd promptId', makeContainer(ONE, { entries: [{ promptId: 'k'.repeat(201), createdAt: 1, bytes: 7 }] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['an entry with no date', makeContainer(ONE, { entries: [{ promptId: 'a', bytes: 7 }] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['an entry dated with a string', makeContainer(ONE, { entries: [{ promptId: 'a', createdAt: '1700000000000', bytes: 7 }] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['an entry with a negative date', makeContainer(ONE, { entries: [{ promptId: 'a', createdAt: -1, bytes: 7 }] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['an entry of zero bytes', makeContainer(ONE, { entries: [{ promptId: 'a', createdAt: 1, bytes: 0 }] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['an entry of fractional bytes', makeContainer(ONE, { entries: [{ promptId: 'a', createdAt: 1, bytes: 3.5 }] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['an entry claiming more bytes than the file has left', makeContainer(ONE, { entries: [{ promptId: 'a', createdAt: 1, bytes: 99999 }] }), 'recordings-incomplete', P.MESSAGES.recordingsIncomplete],
        ['an entry with a non-string mimeType', makeContainer(ONE, { entries: [{ promptId: 'a', createdAt: 1, bytes: 7, mimeType: 5 }] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['an entry with a non-number duration', makeContainer(ONE, { entries: [{ promptId: 'a', createdAt: 1, bytes: 7, durationMs: 'ages' }] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['an entry with a non-string label', makeContainer(ONE, { entries: [{ promptId: 'a', createdAt: 1, bytes: 7, label: {} }] }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['a file with bytes nobody declared at the end', makeContainer(ONE, {}, { trailing: 'EXTRA' }), 'recordings-damaged', P.MESSAGES.recordingsDamaged],
        ['a file that was cut short in transit', makeContainer(ONE, {}, { dropBytes: 2 }), 'recordings-incomplete', P.MESSAGES.recordingsIncomplete],
        ['more entries than one header may describe', makeContainer(ONE, {
            count: undefined,
            entries: new Array(P.MAX_RECORDINGS_ENTRIES + 1).join(',').split(',')
                .map(() => ({ promptId: 'a', createdAt: 1, bytes: 1 }))
        }), 'recordings-too-large', null],
        ['nothing blob-shaped at all', { size: 'lots' }, 'recordings-read-failed', P.MESSAGES.recordingsReadFailed]
    ];

    it.each(rejections())('rejects %s', async (_name, blob, code, message) => {
        const store = fakeStore();
        global.BlobStore = store;
        const read = await P.readRecordingsFile(blob);
        expect(read.ok).toBe(false);
        expect(read.code).toBe(code);
        if (message) expect(read.message).toBe(message);
        // Not merely "restored": never touched.
        expect(store.putCalls).toEqual([]);
        expect(store.removeCalls).toEqual([]);
    });

    it('every rejection message tells the learner nothing has changed', () => {
        rejections().forEach((c) => {
            if (c[3]) expect(c[3]).toMatch(/Nothing has changed/);
        });
        expect(P.MESSAGES.recordingsUnavailable).toMatch(/Nothing has changed/);
        expect(P.MESSAGES.recordingsImportUnsupported).toMatch(/Nothing has been restored and nothing has been deleted/);
    });

    it('REFUSES a file larger than this device\'s archive could ever hold', async () => {
        // Refuse, never truncate: restoring an arbitrary prefix produces an
        // archive whose dates and baselines are a subset nobody chose.
        global.BlobStore = fakeStore();
        // No real bytes: the refusal happens on `size` alone, before one is read.
        const oversized = { size: 60 * MB, slice: () => new Blob(['x']) };
        const read = await P.readRecordingsFile(oversized);
        expect(read.ok).toBe(false);
        expect(read.code).toBe('recordings-too-large');
        expect(read.message).toMatch(/^That file is 60\.0 MB, which is larger than this app can hold/);
        expect(read.message).toContain('50.0 MB');
        expect(read.message).toMatch(/not even part of it, because a part of an archive is not an archive/);
    });

    it('reports a read failure as a read failure, not as a damaged file', async () => {
        const unreadable = {
            size: 500,
            slice: () => ({ size: 26, text: () => Promise.reject(new Error('I/O')) })
        };
        const read = await P.readRecordingsFile(unreadable);
        expect(read.code).toBe('recordings-read-failed');
        expect(console.warn).toHaveBeenCalled();
    });

    it('survives a file whose slice() throws', async () => {
        const hostile = { size: 500, slice: () => { throw new Error('nope'); } };
        const read = await P.readRecordingsFile(hostile);
        expect(read.ok).toBe(false);
        expect(read.code).toBe('recordings-read-failed');
    });

    it('the confirm copy counts what the file holds and says the restore ADDS', async () => {
        const read = await P.readRecordingsFile(makeContainer([
            { promptId: 'lsn:1:aaa', createdAt: 1, text: 'A', baseline: true },
            { promptId: 'lsn:1:aaa', createdAt: 2, text: 'BB' },
            { promptId: 'pron:i-I', createdAt: 3, text: 'CCC', baseline: true }
        ]));
        const message = P.recordingsConfirmMessage(read);
        expect(message).toMatch(/^That file holds 3 recordings from 2 prompts\./);
        expect(message).toContain(P.MESSAGES.recordingsImportConfirm);
        expect(message).toMatch(/ADDS them to this device/);
        expect(message).toMatch(/Nothing already saved here is deleted/);
        // The eviction cost of adding older recordings is stated, not hidden.
        expect(message).toMatch(/may push out an in-between one/);
        expect(message).toMatch(/first recording at a prompt is never pushed out/);
    });

    it('the confirm copy uses the singular for one recording at one prompt', async () => {
        const read = await P.readRecordingsFile(makeContainer(ONE));
        expect(P.recordingsConfirmMessage(read)).toMatch(/^That file holds 1 recording from 1 prompt\./);
    });

    it('does not throw when handed no read at all', () => {
        expect(() => P.recordingsConfirmMessage()).not.toThrow();
        expect(P.recordingsConfirmMessage(null)).toMatch(/holds 0 recordings from 0 prompts/);
    });
});

// ===========================================================================
describe('US-138 · the round trip that matters: month one against month three', () => {
// ===========================================================================

    /** Let every promise and every jsdom FileReader task settle. */
    const settle = async (turns = 14) => {
        for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
    };

    let created;
    beforeEach(() => { created = stubDownloads(); });
    afterEach(releaseDownloads);

    /** Export the archive and hand back the container as a File-shaped Blob. */
    const exportContainer = async (store) => {
        global.BlobStore = store;
        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(true);
        return { file: created[created.length - 1], result: result };
    };

    it('restores two recordings across two prompts, with the pinned baseline intact', async () => {
        // The whole feature in one test. A restored archive whose baseline was lost
        // has destroyed the thing CURRICULUM.md Strand E.7 calls its strongest
        // motivator: month-one is the half of the comparison that cannot be made
        // again.
        const source = fakeStore();
        seedTwoPrompts(source);
        const { file } = await exportContainer(source);

        // A new device: the data file has been restored, the archive is empty.
        const fresh = fakeStore();
        global.BlobStore = fresh;

        const result = await P.importRecordingsFromFile(file);
        expect(result.ok).toBe(true);
        expect(result.restored).toBe(3);
        expect(result.skipped).toBe(0);
        expect(result.failed).toEqual([]);
        expect(result.message).toBe(P.MESSAGES.recordingsImportOk);

        const a = fresh.rows.filter((r) => r.promptId === 'lsn:1:aaa')
            .sort((x, y) => x.createdAt - y.createdAt);
        expect(a.length).toBe(2);
        // The dates, which are the only thing that makes the comparison meaningful.
        expect(a[0].createdAt).toBe(1700000000000);
        expect(a[1].createdAt).toBe(1707000000000);
        // The pinned baseline, still pinned, and still the OLDER one.
        expect(a[0].baseline).toBe(true);
        expect(a[1].baseline).toBe(false);
        expect(result.baselineKept).toBe(2);
        expect(result.baselineNotPinned).toBe(0);

        const b = fresh.rows.filter((r) => r.promptId === 'pron:i-I');
        expect(b.length).toBe(1);
        expect(b[0].createdAt).toBe(1703000000000);
        expect(b[0].baseline).toBe(true);
        expect(b[0].label).toBe('ship / sheep');

        // And the audio itself, byte for byte.
        expect(await readBlob(a[0].blob)).toBe('MONTH-ONE-AUDIO-A');
        expect(await readBlob(a[1].blob)).toBe('MONTH-THREE-AUDIO-A-IS-LONGER');
        expect(await readBlob(b[0].blob)).toBe('PRONUNCIATION-AUDIO-B');
        expect(a[0].mimeType).toBe('audio/webm;codecs=opus');
        expect(a[0].durationMs).toBe(2100);
        expect(b[0].durationMs).toBe(900);
    });

    it('asks the store for the original date and the baseline flag explicitly', async () => {
        // The contract this restore depends on, asserted as a call rather than
        // only as an outcome, so the required blobstore.js change is visible here.
        const source = fakeStore();
        seedTwoPrompts(source);
        const { file } = await exportContainer(source);
        const fresh = fakeStore();
        global.BlobStore = fresh;
        await P.importRecordingsFromFile(file);

        expect(fresh.putCalls.length).toBe(3);
        // Oldest first, globally: a store that derives the baseline from insertion
        // order still gets it right.
        expect(fresh.putCalls.map((c) => c.meta.createdAt)).toEqual(
            [1700000000000, 1703000000000, 1707000000000]
        );
        expect(fresh.putCalls[0].meta).toEqual(expect.objectContaining({
            createdAt: 1700000000000,
            baseline: true,
            mimeType: 'audio/webm;codecs=opus',
            durationMs: 2100
        }));
        expect(fresh.putCalls[2].meta.baseline).toBe(false);
    });

    it('re-exporting the restored archive reproduces the same entries', async () => {
        // Container-level idempotence, and the strongest single proof that nothing
        // was silently normalised on the way through.
        const source = fakeStore();
        seedTwoPrompts(source);
        const first = await exportContainer(source);
        const firstHeader = JSON.parse(await readBlob(first.file.slice(26,
            26 + first.result.headerBytes)));

        const fresh = fakeStore();
        global.BlobStore = fresh;
        await P.importRecordingsFromFile(first.file);

        const second = await exportContainer(fresh);
        const secondHeader = JSON.parse(await readBlob(second.file.slice(26,
            26 + second.result.headerBytes)));

        expect(secondHeader.entries).toEqual(firstHeader.entries);
        expect(secondHeader.bytes).toBe(firstHeader.bytes);
        // The payload region too, byte for byte.
        expect(await readBlob(second.file.slice(26 + second.result.headerBytes)))
            .toBe(await readBlob(first.file.slice(26 + first.result.headerBytes)));
    });

    it('carries a non-ASCII label through the container and back', async () => {
        const source = fakeStore();
        source.seed('lsn:1:aaa', 'AUDIO-WITH-A-TELUGU-LABEL', {
            label: 'పరీక్ష 😀', createdAt: 1700000000000, baseline: true
        });
        const { file } = await exportContainer(source);
        const fresh = fakeStore();
        global.BlobStore = fresh;
        await P.importRecordingsFromFile(file);
        expect(fresh.rows[0].label).toBe('పరీక్ష 😀');
        expect(await readBlob(fresh.rows[0].blob)).toBe('AUDIO-WITH-A-TELUGU-LABEL');
    });

    it('is idempotent: restoring the same file twice adds nothing the second time', async () => {
        // A recording is recognised by (promptId, createdAt, size), so a learner
        // who restores twice does not end up with duplicates — which matters
        // because duplicates would evict their real in-between recordings.
        const source = fakeStore();
        seedTwoPrompts(source);
        const { file } = await exportContainer(source);
        const fresh = fakeStore();
        global.BlobStore = fresh;

        const first = await P.importRecordingsFromFile(file);
        expect(first.restored).toBe(3);

        const second = await P.importRecordingsFromFile(file);
        expect(second.ok).toBe(true);
        expect(second.restored).toBe(0);
        expect(second.skipped).toBe(3);
        expect(second.message).toBe(P.MESSAGES.recordingsImportNothingNew);
        expect(second.message).toMatch(/nothing was added twice/);
        expect(fresh.rows.length).toBe(3);
    });

    it('does not fabricate a baseline for a prompt that already has one', async () => {
        // The learner recorded again on the new device before restoring. Their
        // FIRST recording here really is the first one here; the restored one is
        // older but is not promoted over it silently, and the count says so
        // instead of implying the flag was lost.
        const source = fakeStore();
        source.seed('lsn:1:aaa', 'RESTORED-OLD', { createdAt: 1700000000000, baseline: true });
        const { file } = await exportContainer(source);

        const fresh = fakeStore();
        fresh.seed('lsn:1:aaa', 'ALREADY-HERE', { createdAt: 1710000000000, baseline: true });
        global.BlobStore = fresh;

        const result = await P.importRecordingsFromFile(file);
        expect(result.ok).toBe(true);
        expect(result.restored).toBe(1);
        expect(result.baselineKept).toBe(0);
        expect(result.baselineNotPinned).toBe(1);
        expect(fresh.rows.filter((r) => r.baseline === true).length).toBe(1);
    });
});

// ===========================================================================
describe('US-138 · a partial restore says what is and is not recoverable', () => {
// ===========================================================================
// There is no rollback() for blobs — localStorage and IndexedDB share no
// transaction — and this design does not need one, because the restore is
// ADDITIVE. Nothing is deleted, each put() is its own transaction that
// blobstore.js guarantees loses nothing on failure, and THE FILE IS THE RECOVERY
// COPY for whatever did not land. That is what the copy has to say.

    let created;
    beforeEach(() => { created = stubDownloads(); });
    afterEach(releaseDownloads);

    const containerOf = async (store) => {
        global.BlobStore = store;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        return created[created.length - 1];
    };

    it('reports a partial restore as neither a success nor a failure', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        const file = await containerOf(source);

        const fresh = fakeStore({
            putFails: (promptId) => (promptId === 'pron:i-I'
                ? { ok: false, code: 'full', message: 'There is no room left on this device for another recording.' }
                : null)
        });
        global.BlobStore = fresh;

        const result = await P.importRecordingsFromFile(file);
        // `ok` is true because two recordings really are back; `partial` is what a
        // caller switches on, and the message claims neither more nor less.
        expect(result.ok).toBe(true);
        expect(result.partial).toBe(true);
        expect(result.code).toBe('recordings-partial');
        expect(result.restored).toBe(2);
        expect(result.total).toBe(3);
        expect(result.failed.length).toBe(1);
        expect(result.failed[0]).toEqual(expect.objectContaining({
            promptId: 'pron:i-I', createdAt: 1703000000000, code: 'full'
        }));
        expect(result.message).toBe(P.MESSAGES.recordingsImportSomeFailed);
        // The two things a learner needs: nothing was lost, and the file will
        // finish the job.
        expect(result.message).toMatch(/Nothing has been deleted/);
        expect(result.message).toMatch(/restoring it again after freeing up room will bring back the rest/);
        // And the two that did land are really there.
        expect(fresh.rows.length).toBe(2);
    });

    it('finishes the job when the same file is restored again after room is freed', async () => {
        // The claim the partial message makes, actually carried out.
        const source = fakeStore();
        seedTwoPrompts(source);
        const file = await containerOf(source);

        let full = true;
        const fresh = fakeStore({
            putFails: (promptId) => (full && promptId === 'pron:i-I'
                ? { ok: false, code: 'full', message: 'no room' } : null)
        });
        global.BlobStore = fresh;

        expect((await P.importRecordingsFromFile(file)).restored).toBe(2);
        full = false;
        const again = await P.importRecordingsFromFile(file);
        expect(again.ok).toBe(true);
        expect(again.restored).toBe(1);
        expect(again.skipped).toBe(2);        // the two already here, untouched
        expect(fresh.rows.length).toBe(3);
    });

    it('reports a failure when NOTHING could be restored, and deletes nothing', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        const file = await containerOf(source);

        const fresh = fakeStore({ putFails: () => ({ ok: false, code: 'full', message: 'no room' }) });
        fresh.seed('lsn:1:zzz', 'SOMETHING-ALREADY-HERE');
        global.BlobStore = fresh;

        const result = await P.importRecordingsFromFile(file);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('recordings-none-restored');
        expect(result.restored).toBe(0);
        expect(result.failed.length).toBe(3);
        expect(result.message).toBe(P.MESSAGES.recordingsImportNoneRestored);
        expect(result.message).toMatch(/Nothing has been deleted, and the file still holds all of them/);
        // The recording that was already on the device is untouched.
        expect(fresh.rows.length).toBe(1);
        expect(fresh.removeCalls).toEqual([]);
    });

    it('survives a put() that rejects, which its own contract says cannot happen', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        const file = await containerOf(source);
        const fresh = fakeStore({ putRejectsFor: 'pron:i-I' });
        global.BlobStore = fresh;

        const result = await P.importRecordingsFromFile(file);
        expect(result.ok).toBe(true);
        expect(result.partial).toBe(true);
        expect(result.failed[0].code).toBe('write-failed');
        expect(console.warn).toHaveBeenCalled();
    });

    it('restores without deduplication rather than refusing when a survey fails', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        const file = await containerOf(source);
        const fresh = fakeStore({ listThrowsFor: 'lsn:1:aaa' });
        global.BlobStore = fresh;
        const result = await P.importRecordingsFromFile(file);
        expect(result.ok).toBe(true);
        expect(result.restored).toBe(3);
        expect(console.warn).toHaveBeenCalled();
    });

    it('reports a payload it cannot slice as one failed entry, not as a failed file', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        const good = await containerOf(source);
        const fresh = fakeStore();
        global.BlobStore = fresh;

        // A file that reads for validation and then refuses to slice a payload.
        let calls = 0;
        const flaky = {
            size: good.size,
            slice: function (start, end) {
                calls += 1;
                if (calls > 2 && start >= 26) throw new Error('media detached');
                return good.slice(start, end);
            }
        };
        const result = await P.importRecordingsFromFile(flaky);
        expect(result.ok).toBe(false);
        expect(result.failed.length).toBe(3);
        expect(result.failed[0].code).toBe('read-failed');
        expect(fresh.rows.length).toBe(0);
    });
});

// ===========================================================================
describe('US-138 · a restore will not re-date the archive to today', () => {
// ===========================================================================
// The refusal that is about this app rather than the file or the device.
//
// TODAY's blobstore.js stamps `createdAt` with its OWN clock and derives
// `baseline` from insertion order. Restoring through it would put every recording
// in the archive at today's date and mark whichever landed first as the learner's
// month-one — which destroys the comparison the archive exists for while
// appearing to succeed. So the fidelity is checked against the record put()
// RETURNS, on the very first write, and a store that does not honour it gets the
// whole restore refused and its one probe row deleted again.

    let created;
    beforeEach(() => { created = stubDownloads(); });
    afterEach(releaseDownloads);

    it('refuses, deletes its own probe row, and leaves the archive as it was found', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        const file = created[created.length - 1];

        // Today's store: honours mimeType and durationMs, ignores createdAt.
        const old = fakeStore({ honourRestoreMeta: false, clock: 1770000000000 });
        old.seed('lsn:1:zzz', 'THE-LEARNERS-OWN-RECORDING');
        global.BlobStore = old;

        const result = await P.importRecordingsFromFile(file);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('recordings-restore-unsupported');
        expect(result.restored).toBe(0);
        expect(result.message).toBe(P.MESSAGES.recordingsImportUnsupported);
        expect(result.message).toMatch(/cannot put recordings back with their original dates/);
        expect(result.message).toMatch(/still holds every recording/);

        // Exactly one write was attempted, and it was undone.
        expect(old.putCalls.length).toBe(1);
        expect(old.removeCalls.length).toBe(1);
        // The archive is byte-for-byte what it was: the learner's own recording,
        // and nothing dated wrongly left behind.
        expect(old.rows.length).toBe(1);
        expect(old.rows[0].promptId).toBe('lsn:1:zzz');
    });

    it('still refuses when the probe row cannot be deleted, and says so no differently', async () => {
        // The learner's answer does not change: nothing of theirs was touched.
        const source = fakeStore();
        source.seed('lsn:1:aaa', 'AUDIO', { createdAt: 1700000000000, baseline: true });
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        const file = created[created.length - 1];

        const old = fakeStore({ honourRestoreMeta: false, removeThrows: true });
        global.BlobStore = old;
        const result = await P.importRecordingsFromFile(file);
        expect(result.code).toBe('recordings-restore-unsupported');
        expect(result.restored).toBe(0);
        expect(console.warn).toHaveBeenCalled();
    });
});

// ===========================================================================
describe('US-138 · a device that cannot keep recordings', () => {
// ===========================================================================

    afterEach(releaseDownloads);

    it('exports everything else and says, in the file, that it could not look', async () => {
        // The requirement in full: an export on a device with no IndexedDB
        // succeeds and states what it lacks.
        stubDownloads();
        global.BlobStore = fakeStore({ supported: false });
        seedPopulated();

        const result = await P.exportAll();
        expect(result.ok).toBe(true);
        expect(result.keyCount).toBe(5);
        expect(result.message).toBe(P.MESSAGES.exportOk);
        expect(result.recordings.archiveReadable).toBe(false);
        expect(result.recordings.note).toMatch(/could not open its recording storage/);
        // And it does not warn about recordings it has no reason to think exist.
        expect(result.recordingsMessage).toBeNull();
    });

    it('exports everything else when blobstore.js was never loaded', async () => {
        stubDownloads();
        seedPopulated();
        const result = await P.exportAll();
        expect(result.ok).toBe(true);
        expect(result.keyCount).toBe(5);
        expect(result.recordings.archiveReadable).toBe(false);
    });

    it('imports the data file normally with no archive anywhere', () => {
        global.BlobStore = fakeStore({ supported: false });
        seedPopulated();
        const before = P.snapshot();
        const text = JSON.stringify(P.buildExport(), null, 2);
        localStorage.clear();
        expect(P.importFromText(text).ok).toBe(true);
        expect(P.snapshot()).toEqual(before);
    });

    it('refuses a recordings restore without writing, and says the file still holds them', async () => {
        stubDownloads();
        const source = fakeStore();
        seedTwoPrompts(source);
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        const file = URL.createObjectURL.mock.calls[0][0];

        const none = fakeStore({ supported: false });
        global.BlobStore = none;
        const result = await P.importRecordingsFromFile(file);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('recordings-unavailable');
        expect(result.message).toBe(P.MESSAGES.recordingsUnavailable);
        expect(result.message).toMatch(/that file still holds every one of them/);
        expect(none.putCalls).toEqual([]);
        expect(none.removeCalls).toEqual([]);
    });

    it('refuses a recordings restore when blobstore.js is missing methods', async () => {
        global.BlobStore = { isSupported: () => true, put: 'not a function' };
        const result = await P.importRecordingsFromFile({
            size: 10, slice: () => new Blob(['x'])
        });
        expect(result.ok).toBe(false);
    });
});

// ===========================================================================
describe('US-138 · neither store is touched by a rejection', () => {
// ===========================================================================

    it('a rejected DATA import leaves the archive alone as well as localStorage', async () => {
        // The 44-case block above proves localStorage is never written on a
        // rejection. This proves the other store is never reached at all — by
        // handing the module a BlobStore whose every method throws.
        const hostile = {
            isSupported: () => { throw new Error('archive touched'); },
            usage: () => { throw new Error('archive touched'); },
            prompts: () => { throw new Error('archive touched'); },
            list: () => { throw new Error('archive touched'); },
            get: () => { throw new Error('archive touched'); },
            put: () => { throw new Error('archive touched'); },
            remove: () => { throw new Error('archive touched'); }
        };
        global.BlobStore = hostile;
        seedPopulated();
        const before = dumpAll();

        [ '', '{oops', '[]', '{"a":1}', file({ app: 'other-app' }), file({ formatVersion: 2 }),
          file({ data: {} }), file({ keyCount: 99 }), file({ data: { learningProgress: '{"stats":' } }),
          file({ schemaVersion: 99 }) ].forEach((text) => {
            expect(P.importFromText(text).ok).toBe(false);
        });
        expect(dumpAll()).toEqual(before);

        // ...and a SUCCESSFUL data import does not reach it either: the two
        // stores are restored by two separate learner actions, which is what
        // removes the "state neither store agreed to" failure mode entirely.
        localStorage.clear();
        expect(P.importFromText(file()).ok).toBe(true);
        expect(localStorage.getItem('srsData')).toBe(SRSDATA);
    });

    it('a rejected RECORDINGS import leaves localStorage alone as well as the archive', async () => {
        seedPopulated();
        const before = dumpAll();
        const setItem = jest.spyOn(Storage.prototype, 'setItem');
        const removeItem = jest.spyOn(Storage.prototype, 'removeItem');
        const store = fakeStore();
        global.BlobStore = store;

        const result = await P.importRecordingsFromFile(new Blob(['not a container at all']));
        expect(result.ok).toBe(false);
        expect(setItem).not.toHaveBeenCalled();
        expect(removeItem).not.toHaveBeenCalled();
        expect(dumpAll()).toEqual(before);
        expect(store.putCalls).toEqual([]);
    });

    it('a SUCCESSFUL recordings restore writes nothing to localStorage', async () => {
        stubDownloads();
        try {
            const source = fakeStore();
            seedTwoPrompts(source);
            global.BlobStore = source;
            expect((await P.exportRecordingsToFile()).ok).toBe(true);
            const file = URL.createObjectURL.mock.calls[0][0];

            seedPopulated();
            const before = dumpAll();
            const fresh = fakeStore();
            global.BlobStore = fresh;
            const setItem = jest.spyOn(Storage.prototype, 'setItem');

            expect((await P.importRecordingsFromFile(file)).restored).toBe(3);
            expect(setItem).not.toHaveBeenCalled();
            expect(dumpAll()).toEqual(before);
        } finally {
            releaseDownloads();
        }
    });
});

// ===========================================================================
describe('US-138 · what the learner actually sees on the Dashboard', () => {
// ===========================================================================
// index.html belongs to another story, so every recordings control is OPTIONAL
// and initUI() must work with or without it. The half-wired case is the
// interesting one: a build with recordings and no control for saving them says so
// in as many words, because that is the one situation where the audio genuinely
// cannot be got off the device, and a reassuring "Saved." over the top of it is
// the exact lie US-138 exists to remove.

    const BASE =
        '<button id="exportData"></button>' +
        '<button id="importData"></button>' +
        '<input id="importDataFile" type="file">' +
        '<button id="resetReviewHistory"></button>' +
        '<p id="dataControlsStatus"></p>' +
        '<p id="dataControlsUsage"></p>';

    const RECORDING_CONTROLS =
        '<button id="exportRecordings"></button>' +
        '<button id="importRecordings"></button>' +
        '<input id="importRecordingsFile" type="file">' +
        '<p id="dataControlsRecordings"></p>';

    const status = () => document.getElementById('dataControlsStatus').textContent;
    const recordingsLine = () => {
        const el = document.getElementById('dataControlsRecordings');
        return el ? el.textContent : null;
    };

    /** Let every promise and every jsdom FileReader task settle. */
    const settle = async (turns = 16) => {
        for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
    };

    const pickRecordings = (blobOrFile) => {
        const input = document.getElementById('importRecordingsFile');
        Object.defineProperty(input, 'files', { value: [blobOrFile], configurable: true });
        input.dispatchEvent(new window.Event('change'));
    };

    let confirmMock;

    beforeEach(() => {
        document.body.innerHTML = BASE + RECORDING_CONTROLS;
        confirmMock = jest.fn(() => true);
        window.confirm = confirmMock;
        stubDownloads();
    });

    afterEach(() => {
        releaseDownloads();
        document.body.innerHTML = '';
    });

    it('does not throw, and starts no promise, when there is no archive to ask', async () => {
        // No BlobStore at all: initUI() must not leave a pending check behind, and
        // the recordings line says what is true of the device rather than "checking".
        P.initUI();
        await settle(2);
        expect(recordingsLine()).toBe('This browser will not let the app keep recordings.');
    });

    it('does not throw when the recordings markup is absent', () => {
        document.body.innerHTML = BASE;
        global.BlobStore = fakeStore();
        expect(() => P.initUI()).not.toThrow();
        expect(recordingsLine()).toBeNull();
    });

    it('draws the recordings line as its own line, with its own numbers', async () => {
        const store = fakeStore();
        seedTwoPrompts(store);
        global.BlobStore = store;
        seed({ learningProgress: PROGRESS, theme: 'dark' });

        P.initUI();
        await settle();
        // The item count above is still only localStorage: recordings are a
        // separate store with a separate cap, so folding them in would put a
        // number in the storage line that the archive screen cannot explain.
        expect(document.getElementById('dataControlsUsage').textContent)
            .toMatch(/^On this device now: [\d.]+ KB across 2 items\.$/);
        expect(recordingsLine()).toMatch(/^Recordings: 3 recordings across 2 prompts, 0\.0 MB\./);
        expect(recordingsLine()).toMatch(/NOT in the data file — save them separately/);
    });

    it('says "no recordings yet" rather than "could not check" on an empty archive', async () => {
        global.BlobStore = fakeStore();
        P.initUI();
        await settle();
        expect(recordingsLine()).toBe('No recordings saved on this device yet.');
    });

    it('says it could not check when the archive is unreachable', async () => {
        global.BlobStore = fakeStore({ usage: { available: false } });
        P.initUI();
        await settle();
        expect(recordingsLine()).toBe('Your recordings could not be checked on this device just now.');
    });

    it('the data-file export says plain "Saved." when there can be no archive', () => {
        // No IndexedDB means there is nothing to leave behind, so the caveat would
        // be noise — and noise about data loss is how a real warning gets ignored.
        global.BlobStore = fakeStore({ supported: false });
        seed({ learningProgress: PROGRESS });
        P.initUI();
        document.getElementById('exportData').click();
        expect(status()).toBe(P.MESSAGES.exportOk);
    });

    it('the data-file export names the recordings control when there are recordings', async () => {
        const store = fakeStore();
        seedTwoPrompts(store);
        global.BlobStore = store;
        seed({ learningProgress: PROGRESS });
        P.initUI();
        await settle();

        document.getElementById('exportData').click();
        expect(status()).toContain(P.MESSAGES.exportOk);
        expect(status()).toContain(P.MESSAGES.exportRecordingsElsewhere);
        expect(status()).toMatch(/Save them as a second file with "Save my recordings"/);
        expect(document.getElementById('dataControlsStatus').className).toContain('success');
    });

    it('the data-file export ADMITS a half-wired screen rather than reassuring', async () => {
        // No `#exportRecordings` in the markup: the recordings cannot be got off
        // this device at all, and that is what the learner is told.
        document.body.innerHTML = BASE;
        const store = fakeStore();
        seedTwoPrompts(store);
        global.BlobStore = store;
        seed({ learningProgress: PROGRESS });
        P.initUI();
        await settle();

        document.getElementById('exportData').click();
        expect(status()).toContain(P.MESSAGES.exportRecordingsNoControl);
        expect(status()).toMatch(/this screen has no control for saving them yet/);
        expect(status()).toMatch(/still only on this device/);
    });

    it('says it has not checked yet, rather than "none", on a cold cache', () => {
        // Clicked before the archive check landed. The honest answer is that the
        // file is not wrong, it simply does not include audio.
        global.BlobStore = fakeStore();
        seed({ learningProgress: PROGRESS });
        // Deliberately NOT initUI(): nothing has warmed the cache.
        expect(P.cachedArchive()).toBeNull();
        P.initUI();
        document.getElementById('exportData').click();
        expect(status()).toContain(P.MESSAGES.exportRecordingsUnknown);
        expect(status()).toMatch(/has not been able to check your recordings yet/);
    });

    it('says nothing extra once the check says the archive is empty', async () => {
        global.BlobStore = fakeStore();
        seed({ learningProgress: PROGRESS });
        P.initUI();
        await settle();
        document.getElementById('exportData').click();
        expect(status()).toBe(P.MESSAGES.exportOk);
    });

    it('the recordings button saves them and redraws the line', async () => {
        const store = fakeStore();
        seedTwoPrompts(store);
        global.BlobStore = store;
        P.initUI();
        await settle();

        document.getElementById('exportRecordings').click();
        await settle();
        expect(status()).toBe(P.MESSAGES.recordingsExportOk);
        expect(document.getElementById('dataControlsStatus').className).toContain('success');
        expect(recordingsLine()).toMatch(/^Recordings: 3 recordings/);
    });

    it('reports a partial save as information, not as a success', async () => {
        const store = fakeStore({ unreadableIds: [2] });
        seedTwoPrompts(store);
        global.BlobStore = store;
        P.initUI();
        await settle();
        document.getElementById('exportRecordings').click();
        await settle();
        expect(status()).toBe(P.MESSAGES.recordingsExportPartial);
        expect(document.getElementById('dataControlsStatus').className).toContain('info');
        expect(document.getElementById('dataControlsStatus').className).not.toContain('success');
    });

    it('reports "nothing to save" as an error the learner can act on', async () => {
        global.BlobStore = fakeStore();
        P.initUI();
        await settle();
        document.getElementById('exportRecordings').click();
        await settle();
        expect(status()).toBe(P.MESSAGES.recordingsExportNone);
    });

    it('the restore button opens the picker rather than restoring anything', async () => {
        global.BlobStore = fakeStore();
        P.initUI();
        const input = document.getElementById('importRecordingsFile');
        const clicked = jest.spyOn(input, 'click').mockImplementation(() => {});
        document.getElementById('importRecordings').click();
        expect(clicked).toHaveBeenCalled();
    });

    it('validates, asks, restores, and redraws — in that order', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        const container = URL.createObjectURL.mock.calls[0][0];

        const fresh = fakeStore();
        global.BlobStore = fresh;
        P.initUI();
        await settle();

        pickRecordings(container);
        await settle();

        expect(confirmMock).toHaveBeenCalledTimes(1);
        expect(confirmMock.mock.calls[0][0]).toMatch(/^That file holds 3 recordings from 2 prompts\./);
        expect(status()).toBe(P.MESSAGES.recordingsImportOk);
        expect(fresh.rows.length).toBe(3);
        expect(recordingsLine()).toMatch(/^Recordings: 3 recordings across 2 prompts/);
        // The file input is cleared so the same file can be picked again.
        expect(document.getElementById('importRecordingsFile').value).toBe('');
    });

    it('does NOT ask about a file that was never going to be acted on', async () => {
        const store = fakeStore();
        global.BlobStore = store;
        P.initUI();
        await settle();
        pickRecordings(new Blob(['not a recordings file']));
        await settle();
        expect(confirmMock).not.toHaveBeenCalled();
        expect(status()).toBe(P.MESSAGES.recordingsNotMine);
        expect(store.putCalls).toEqual([]);
    });

    it('a cancelled restore changes nothing', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        const container = URL.createObjectURL.mock.calls[0][0];

        const fresh = fakeStore();
        global.BlobStore = fresh;
        confirmMock.mockReturnValue(false);
        P.initUI();
        await settle();
        pickRecordings(container);
        await settle();

        expect(status()).toBe(P.MESSAGES.cancelled);
        expect(fresh.rows.length).toBe(0);
        expect(fresh.putCalls).toEqual([]);
    });

    it('fails closed when there is no confirm() to ask with', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        const container = URL.createObjectURL.mock.calls[0][0];

        const fresh = fakeStore();
        global.BlobStore = fresh;
        const saved = window.confirm;
        try {
            window.confirm = undefined;
            P.initUI();
            await settle();
            pickRecordings(container);
            await settle();
            expect(status()).toBe(P.MESSAGES.cancelled);
            expect(fresh.putCalls).toEqual([]);
        } finally {
            window.confirm = saved;
        }
    });

    it('reports a partial restore as information and names what to do', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        const container = URL.createObjectURL.mock.calls[0][0];

        const fresh = fakeStore({
            putFails: (promptId) => (promptId === 'pron:i-I'
                ? { ok: false, code: 'full', message: 'no room' } : null)
        });
        global.BlobStore = fresh;
        P.initUI();
        await settle();
        pickRecordings(container);
        await settle();

        expect(status()).toBe(P.MESSAGES.recordingsImportSomeFailed);
        expect(document.getElementById('dataControlsStatus').className).toContain('info');
        expect(recordingsLine()).toMatch(/^Recordings: 2 recordings/);
    });

    it('reports a restore that put nothing back as an error', async () => {
        const source = fakeStore();
        seedTwoPrompts(source);
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        const container = URL.createObjectURL.mock.calls[0][0];

        global.BlobStore = fakeStore({ putFails: () => ({ ok: false, code: 'full', message: 'no room' }) });
        P.initUI();
        await settle();
        pickRecordings(container);
        await settle();
        expect(status()).toBe(P.MESSAGES.recordingsImportNoneRestored);
        expect(document.getElementById('dataControlsStatus').className).toContain('error');
    });

    it('ignores a change event with no file behind it', async () => {
        global.BlobStore = fakeStore();
        P.initUI();
        await settle();
        const input = document.getElementById('importRecordingsFile');
        Object.defineProperty(input, 'files', { value: [], configurable: true });
        expect(() => input.dispatchEvent(new window.Event('change'))).not.toThrow();
        await settle(2);
        expect(status()).toBe('');
    });

    it('a data restore still reloads, and does not touch the archive on the way', async () => {
        // The two artefacts are two separate learner actions over two separate
        // stores; restoring one must not disturb the other.
        jest.useFakeTimers();
        const realReload = P._reload;
        const reload = jest.fn();
        try {
            P._reload = reload;
            const store = fakeStore();
            seedTwoPrompts(store);
            global.BlobStore = store;
            seedPopulated();
            P.initUI();

            // The data path's own FileReader stub, local to this test.
            const savedReader = window.FileReader;
            window.FileReader = function () {
                this.onload = null;
                this.onerror = null;
                this.result = null;
                this.readAsText = () => { this.result = file(); this.onload(); };
            };
            try {
                const input = document.getElementById('importDataFile');
                Object.defineProperty(input, 'files', { value: [{ size: 10 }], configurable: true });
                input.dispatchEvent(new window.Event('change'));
            } finally {
                window.FileReader = savedReader;
            }

            expect(status()).toBe(P.MESSAGES.importOk);
            jest.advanceTimersByTime(1500);
            expect(reload).toHaveBeenCalledTimes(1);
            // Three recordings, still there, still with their original dates.
            expect(store.rows.length).toBe(3);
            expect(store.removeCalls).toEqual([]);
            expect(store.rows.map((r) => r.createdAt).sort()).toEqual(
                [1700000000000, 1703000000000, 1707000000000]
            );
        } finally {
            P._reload = realReload;
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });
});

// ===========================================================================
describe('US-138 · the read paths, and the environments that break them', () => {
// ===========================================================================
// The container is read with `file.slice()` + a text read of the header only, so
// these are the paths that decide whether a restore works on a device rather than
// in a test. jsdom's Blob has no `Blob.prototype.text()` and its FileReader is
// real, so BOTH branches of readBlobText() need standing up deliberately: the
// modern one with a duck-typed file, the fallback with jsdom's own FileReader.

    let savedFileReader;

    beforeEach(() => { savedFileReader = window.FileReader; });
    afterEach(() => { window.FileReader = savedFileReader; });

    /** A File-shaped object whose slices resolve text through `.text()`. */
    const modernFile = (text, over = {}) => ({
        size: over.size === undefined ? text.length : over.size,
        slice: (start, end) => ({
            size: (end === undefined ? text.length : end) - start,
            text: () => (over.textRejectsAfter !== undefined && start >= over.textRejectsAfter)
                ? Promise.reject(new Error('I/O'))
                : Promise.resolve(text.slice(start, end))
        })
    });

    const padTo = (v, w) => { let s = String(v); while (s.length < w) s = '0' + s; return s; };

    const containerText = (entries, payload, over = {}) => {
        const header = Object.assign({
            app: P.APP_ID, kind: P.RECORDINGS_KIND, formatVersion: 1,
            exportedAt: '2026-09-12T00:00:00.000Z', count: entries.length,
            bytes: payload.length, promptCount: 1, complete: true, unreadCount: 0,
            entries: entries
        }, over);
        const json = JSON.stringify(header);
        return P.RECORDINGS_MAGIC + '1:' + padTo(json.length, 10) + '\n' + json + payload;
    };

    it('uses Blob.prototype.text() when the browser has one', async () => {
        // The real browser path. jsdom has no `text()`, so without a duck-typed
        // file this branch would only ever run on a device.
        const text = containerText(
            [{ promptId: 'lsn:1:aaa', createdAt: 1700000000000, bytes: 5, mimeType: 'audio/webm', durationMs: 10, baseline: true, label: null }],
            'AUDIO'
        );
        const read = await P.readRecordingsFile(modernFile(text));
        expect(read.ok).toBe(true);
        expect(read.entries[0].promptId).toBe('lsn:1:aaa');
    });

    it('reports a header read that fails AFTER the prefix read succeeded', async () => {
        const text = containerText(
            [{ promptId: 'a', createdAt: 1, bytes: 5, mimeType: null, durationMs: null, baseline: false, label: null }],
            'AUDIO'
        );
        const read = await P.readRecordingsFile(modernFile(text, { textRejectsAfter: P.RECORDINGS_PREFIX_BYTES }));
        expect(read.ok).toBe(false);
        expect(read.code).toBe('recordings-read-failed');
        expect(console.warn).toHaveBeenCalled();
    });

    it('reports a text() that throws synchronously', async () => {
        const hostile = { size: 100, slice: () => ({ size: 26, text: () => { throw new Error('nope'); } }) };
        expect((await P.readRecordingsFile(hostile)).code).toBe('recordings-read-failed');
    });

    it('reports a file with no slice() at all', async () => {
        expect((await P.readRecordingsFile({ size: 100 })).code).toBe('recordings-read-failed');
    });

    it('reports something that is not a file at all', async () => {
        for (const junk of [undefined, null, 'a string', 42]) {
            const read = await P.readRecordingsFile(junk);
            expect(read.ok).toBe(false);
            expect(read.code).toBe('recordings-read-failed');
        }
    });

    it('reports an environment with no FileReader and no Blob.text()', async () => {
        window.FileReader = function () { throw new Error('FileReader unavailable'); };
        const read = await P.readRecordingsFile(new Blob(['ENGPORTAL-REC1:0000000010\n{}0123456789']));
        expect(read.code).toBe('recordings-read-failed');
    });

    it('reports a FileReader that fires onerror', async () => {
        window.FileReader = function () {
            this.onload = null; this.onerror = null; this.error = new Error('disk gone');
            this.readAsText = () => { this.onerror(); };
        };
        const read = await P.readRecordingsFile(new Blob(['ENGPORTAL-REC1:0000000010\n{}0123456789']));
        expect(read.code).toBe('recordings-read-failed');
    });

    it('reports a FileReader whose readAsText throws', async () => {
        window.FileReader = function () {
            this.onload = null; this.onerror = null;
            this.readAsText = () => { throw new Error('cannot read'); };
        };
        const read = await P.readRecordingsFile(new Blob(['ENGPORTAL-REC1:0000000010\n{}0123456789']));
        expect(read.code).toBe('recordings-read-failed');
    });

    it('reports a FileReader that hands back nothing', async () => {
        // `reader.result === null` must read as "nothing", not as "undefined".
        window.FileReader = function () {
            this.onload = null; this.onerror = null; this.result = null;
            this.readAsText = () => { this.onload(); };
        };
        const read = await P.readRecordingsFile(new Blob(['ENGPORTAL-REC1:0000000010\n{}0123456789']));
        expect(read.code).toBe('recordings-foreign');
    });

    it('refuses a prefix with no version at all', async () => {
        // Magic present, but nothing before the colon.
        const read = await P.readRecordingsFile(new Blob(['ENGPORTAL-REC:00000000010\n{}xxxxxxxxxx']));
        expect(read.code).toBe('recordings-foreign');
    });

    it('refuses a prefix whose version is not a number', async () => {
        const read = await P.readRecordingsFile(new Blob(['ENGPORTAL-RECx:0000000010\n{}0123456789']));
        expect(read.code).toBe('recordings-foreign');
    });

    it('survives reading window.BlobStore itself throwing', async () => {
        // A sandboxed iframe can throw on a global property read. blobstore.js
        // guards its own global reads for this; so does this module.
        const saved = Object.getOwnPropertyDescriptor(global, 'BlobStore');
        try {
            Object.defineProperty(global, 'BlobStore', {
                configurable: true,
                get() { throw new Error('blocked by the sandbox'); }
            });
            expect(P.archivePossible()).toBe(false);
            expect((await P.archiveSummary()).available).toBe(false);
            expect((await P.exportRecordingsToFile()).code).toBe('recordings-unavailable');
        } finally {
            if (saved) Object.defineProperty(global, 'BlobStore', saved);
            else delete global.BlobStore;
        }
    });
});

// ===========================================================================
describe('US-138 · the remaining refusals, and the guarantees behind them', () => {
// ===========================================================================

    afterEach(releaseDownloads);

    it('refuses to save recordings when IndexedDB is there but will not open', async () => {
        // isSupported() says yes, usage() says no. A different fact from "no
        // IndexedDB", and it must not be reported as "no recordings".
        stubDownloads();
        global.BlobStore = fakeStore({ usage: { available: false } });
        const result = await P.exportRecordingsToFile();
        expect(result.code).toBe('recordings-unavailable');
        expect(result.message).toBe(P.MESSAGES.recordingsExportUnavailable);
    });

    it('the data-file caveat says "not checked", not "none", for an unreachable archive', async () => {
        stubDownloads();
        document.body.innerHTML =
            '<button id="exportData"></button><button id="exportRecordings"></button>' +
            '<p id="dataControlsStatus"></p><p id="dataControlsUsage"></p>';
        try {
            global.BlobStore = fakeStore({ usage: { available: false } });
            seed({ learningProgress: PROGRESS });
            P.initUI();
            await new Promise((r) => setTimeout(r, 0));
            await new Promise((r) => setTimeout(r, 0));
            document.getElementById('exportData').click();
            expect(document.getElementById('dataControlsStatus').textContent)
                .toContain(P.MESSAGES.exportRecordingsUnknown);
        } finally {
            document.body.innerHTML = '';
        }
    });

    it('refuses when the metadata alone would not fit in one header', async () => {
        // 500 entries is inside MAX_RECORDINGS_ENTRIES, but 500 long labels are not
        // inside MAX_RECORDINGS_HEADER_BYTES. The refusal names the row limit,
        // because rows are the thing a learner can do something about.
        stubDownloads();
        const store = fakeStore();
        const longLabel = 'x'.repeat(2500);
        for (let i = 0; i < P.MAX_RECORDINGS_ENTRIES; i++) {
            store.seed('lsn:1:p' + i, 'A', { label: longLabel, createdAt: 1700000000000 + i });
        }
        global.BlobStore = store;
        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(false);
        expect(result.code).toBe('too-many');
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('never rejects when a store breaks its own contract mid-read', async () => {
        // list() resolving something that is not a list. The "no public method
        // rejects" guarantee has to survive a store that is not blobstore.js.
        stubDownloads();
        const store = fakeStore();
        store.seed('lsn:1:aaa', 'AUDIO');
        store.list = () => Promise.resolve(5);
        global.BlobStore = store;
        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(false);
        expect(result.code).toBe('export-failed');
        expect(result.message).toBe(P.MESSAGES.recordingsExportFailed);
        expect(console.warn).toHaveBeenCalled();
    });

    it('never rejects when handed a malformed pre-read', async () => {
        // importRecordingsFromFile()'s second argument is an internal shortcut
        // (handleRecordingsFile validates before asking). A caller that abuses it
        // must still get a resolved answer, not an unhandled rejection.
        global.BlobStore = fakeStore();
        const result = await P.importRecordingsFromFile(new Blob(['x']), { ok: true, entries: 'nope' });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('recordings-read-failed');
        expect(console.warn).toHaveBeenCalled();
    });

    it('names every prompt that lost an in-between recording to the restore', async () => {
        // US-218's finding, carried through: the eviction a restore causes may be
        // at a prompt the learner is not looking at, so the prompts are named
        // rather than assumed.
        stubDownloads();
        const source = fakeStore();
        source.seed('lsn:1:aaa', 'AUDIO', { createdAt: 1700000000000, baseline: true });
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        const container = URL.createObjectURL.mock.calls[0][0];

        const fresh = fakeStore({ evictedPrompts: ['lsn:1:something-else'] });
        global.BlobStore = fresh;
        const result = await P.importRecordingsFromFile(container);
        expect(result.ok).toBe(true);
        expect(result.evictedPrompts).toEqual(['lsn:1:something-else']);
    });

    it('falls back to its own 50MB ceiling when BlobStore does not state one', async () => {
        // The number comes from BlobStore when it is loaded so there is ONE cap,
        // not two that can drift; the constant is only the fallback.
        const store = fakeStore();
        delete store.MAX_TOTAL_BYTES;
        global.BlobStore = store;
        expect(P.maxArchiveBytes()).toBe(P.DEFAULT_MAX_ARCHIVE_BYTES);
        expect(P.maxArchiveBytes()).toBe(50 * MB);
        expect(P.maxRecordingsImportBytes()).toBe(50 * MB + P.MAX_RECORDINGS_HEADER_BYTES + P.RECORDINGS_PREFIX_BYTES);

        global.BlobStore = fakeStore({ maxTotalBytes: 8 * MB });
        expect(P.maxArchiveBytes()).toBe(8 * MB);
    });

    it('_setArchiveCache(null) really clears it, which is what the suite relies on', () => {
        P._setArchiveCache({ available: true, count: 9 });
        expect(P.cachedArchive().count).toBe(9);
        P._setArchiveCache(null);
        expect(P.cachedArchive()).toBeNull();
        P._setArchiveCache(undefined);
        expect(P.cachedArchive()).toBeNull();
    });
});

// ===========================================================================
describe('US-138 · two recordings in the same millisecond', () => {
// ===========================================================================
// blobstore.js breaks a createdAt tie with the row id, because "the oldest" has
// to be a total order or eviction depends on whatever order the engine returned
// (see byAge there). The container has to be just as deterministic, or two
// exports of one archive produce two different files and the pairing with a data
// file stops meaning anything.

    let created;
    beforeEach(() => { created = stubDownloads(); });
    afterEach(releaseDownloads);

    it('orders them by id, so the file is the same file every time', async () => {
        const store = fakeStore();
        store.seed('lsn:1:aaa', 'FIRST', { createdAt: 1700000000000, baseline: true });
        store.seed('lsn:1:aaa', 'SECOND-SAME-MS', { createdAt: 1700000000000, baseline: false });
        global.BlobStore = store;

        const result = await P.exportRecordingsToFile();
        expect(result.ok).toBe(true);
        const whole = await readBlob(created[0]);
        expect(whole.slice(26 + result.headerBytes)).toBe('FIRST' + 'SECOND-SAME-MS');

        // And re-exporting produces the same payload region, which is the property
        // the tie-break exists for.
        const again = await P.exportRecordingsToFile();
        const wholeAgain = await readBlob(created[1]);
        expect(wholeAgain.slice(26 + again.headerBytes)).toBe(whole.slice(26 + result.headerBytes));
    });

    it('breaks a cross-prompt tie by promptId, so the restore order is fixed too', async () => {
        const store = fakeStore();
        store.seed('pron:zzz', 'Z-AUDIO', { createdAt: 1700000000000, baseline: true });
        store.seed('lsn:1:aaa', 'A-AUDIO', { createdAt: 1700000000000, baseline: true });
        global.BlobStore = store;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);

        const fresh = fakeStore();
        global.BlobStore = fresh;
        await P.importRecordingsFromFile(created[0]);
        expect(fresh.putCalls.map((c) => c.promptId)).toEqual(['lsn:1:aaa', 'pron:zzz']);
    });

    it('uses the singular in the Dashboard line for one recording at one prompt', async () => {
        document.body.innerHTML =
            '<button id="exportData"></button><p id="dataControlsStatus"></p>' +
            '<p id="dataControlsUsage"></p><p id="dataControlsRecordings"></p>';
        try {
            const store = fakeStore();
            store.seed('lsn:1:aaa', 'AUDIO');
            global.BlobStore = store;
            P.initUI();
            for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
            expect(document.getElementById('dataControlsRecordings').textContent)
                .toMatch(/^Recordings: 1 recording across 1 prompt, 0\.0 MB\./);
        } finally {
            document.body.innerHTML = '';
        }
    });
});

// ===========================================================================
describe('US-138 · a restored recording is playable, not merely present', () => {
// ===========================================================================

    let created;
    beforeEach(() => { created = stubDownloads(); });
    afterEach(releaseDownloads);

    it('cuts each payload out of the container WITH its own MIME type', async () => {
        // The container is one application/octet-stream blob. A payload sliced out
        // of it with no type is stored, listed and then silently unplayable: the
        // browser decides how to decode an object url from the blob's `type`. So
        // the slice carries the type the header recorded, and the store is handed a
        // blob that is audio rather than bytes.
        const source = fakeStore();
        source.seed('lsn:1:aaa', 'MONTH-ONE', {
            createdAt: 1700000000000, baseline: true, mimeType: 'audio/webm;codecs=opus'
        });
        source.seed('pron:i-I', 'PRON-CLIP', {
            createdAt: 1703000000000, baseline: true, mimeType: 'audio/mp4'
        });
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);
        expect(created[0].type).toBe(P.RECORDINGS_MIME);

        const fresh = fakeStore();
        global.BlobStore = fresh;
        expect((await P.importRecordingsFromFile(created[0])).restored).toBe(2);

        expect(fresh.putCalls[0].blob.type).toBe('audio/webm;codecs=opus');
        expect(fresh.putCalls[1].blob.type).toBe('audio/mp4');
        // And the bytes are still the right bytes.
        expect(await readBlob(fresh.putCalls[0].blob)).toBe('MONTH-ONE');
        expect(await readBlob(fresh.putCalls[1].blob)).toBe('PRON-CLIP');
    });

    it('slices without a type when the header recorded none, rather than inventing one', async () => {
        const source = fakeStore();
        source.seed('lsn:1:aaa', 'CLIP', { createdAt: 1, baseline: true, mimeType: null });
        global.BlobStore = source;
        expect((await P.exportRecordingsToFile()).ok).toBe(true);

        const fresh = fakeStore();
        global.BlobStore = fresh;
        await P.importRecordingsFromFile(created[0]);
        expect(fresh.putCalls[0].blob.type).toBe('');
        expect(fresh.putCalls[0].meta.mimeType).toBeNull();
    });
});
