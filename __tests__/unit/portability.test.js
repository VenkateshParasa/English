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
