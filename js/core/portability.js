/**
 * Learner data portability — save a copy, restore from a copy, clear review history
 * -------------------------------------------------------------
 * Implements FR-DATA-4 (export / re-import) and FR-DATA-5 (reset review
 * history) against BR-7 ("learner data is portable and recoverable") and CON-3
 * ("browser storage only — export is the only backup").
 *
 * Harvested from the never-instantiated StorageManager in js/core/storage.js
 * (createBackup / restoreFromBackup / getStorageInfo / exportData / importData),
 * with its two blocking defects fixed:
 *
 *   1. storage.js:333 called `this.validator.validateProgress(data)` — an
 *      instance call to a `static` method, which throws TypeError. Nothing in
 *      this file calls Validator at all; the shape checks below are local, so
 *      there is no instance/static confusion to get wrong, and an import cannot
 *      be rejected because Validator.validateProgress()'s strict schema (which
 *      requires currentSection, currentDifficulty in a fixed enum, and four
 *      `stats` counters) happens to disagree with an older but perfectly
 *      restorable save.
 *   2. storage.js prefixed every key with `englishLearning_`, while the app
 *      writes bare keys (`learningProgress` in app.js:208, `srsData` in
 *      srs.js:21, `theme` in theme-toggle.js:13). Exporting the prefixed set
 *      would have produced an empty file. This module reads the bare keys the
 *      app actually uses, and never guesses the list: it enumerates
 *      localStorage and removes a small, documented deny-list.
 *
 * Two deliberate design choices, both about not losing data:
 *
 *   - Values are carried as RAW STRINGS, exactly as localStorage holds them,
 *     never as re-parsed JSON. A round trip is therefore byte-identical, and
 *     data this build does not understand (a record written by a newer release)
 *     survives export without being re-serialised into a shape this build
 *     invented.
 *   - An import validates the WHOLE file before the first write, snapshots the
 *     keys it is about to touch, and rolls that snapshot back if any write
 *     fails. localStorage has no transaction; validate-then-commit plus
 *     rollback is the closest honest equivalent. See importFromText().
 *
 * Depends on js/core/migrations.js (SCHEMA_VERSION, PROGRESS_KEY, backupOnce,
 * isFutureVersion) and, optionally, js/core/srs.js — load those first.
 *
 * Public API (window.Portability):
 *   ownedKeys()                  -> the keys an export contains, sorted
 *   buildExport()                -> the export envelope as an object
 *   exportToFile()               -> triggers the download
 *   validateExport(text)         -> { ok, plan } | { ok:false, code, message }
 *   importConfirmMessage(plan)   -> the confirm copy for one specific file
 *   importFromText(text)         -> writes all-or-nothing
 *   resetReviewHistory()         -> clears srsData only
 *   storageInfo()                -> bytes held on this device
 *   writesSuspended()            -> true once an import is committed
 *   MESSAGES                     -> every learner-facing string
 *   initUI()                     -> wires the Dashboard controls
 *   _reload / _canReload / _resetWritesSuspended -> test seams, never called in
 *                                   the browser except through handleFile()
 */
(function (global) {
    'use strict';

    // In the browser, index.html loads these first. Under Node a test may
    // require() this module on its own, so pull the dependency in ourselves
    // rather than failing on a missing global (same pattern as migrations.js).
    //
    // The return value of require() is used rather than trusting the module to
    // have set a global: js/core/srs.js closes its IIFE over `this` instead of
    // `globalThis`, and under CommonJS `this` is `module.exports`, so requiring
    // it never publishes `global.SRS`. Harmless in the browser, where `this` is
    // `window`; fatal to a Node check that expects the global.
    if (typeof module !== 'undefined' && module.exports) {
        if (typeof global.Migrations === 'undefined') {
            try { global.Migrations = require('./migrations.js'); } catch (e) { /* optional */ }
        }
        if (typeof global.SRS === 'undefined') {
            try { global.SRS = require('./srs.js'); } catch (e) { /* optional */ }
        }
    }

    // Envelope identity. `app` + `kind` are what make "this is not an English
    // Portal backup" a fact rather than a guess, so a learner who picks the
    // wrong file gets told which mistake they made.
    const APP_ID = 'english-learning-portal';
    const KIND = 'learner-data-export';

    // Version of the ENVELOPE, independent of the progress record's
    // schemaVersion. Bump only when the wrapper changes shape.
    const FORMAT_VERSION = 1;

    const PROGRESS_KEY = (global.Migrations && global.Migrations.PROGRESS_KEY) || 'learningProgress';
    const SRS_KEY = 'srsData';

    // One rolling copy of everything that was here before the most recent
    // import. The last resort if a rollback itself cannot complete.
    const PRE_IMPORT_KEY = 'learnerData.preImport.bak';

    // One rolling copy of the review history discarded by the most recent
    // reset, so FR-DATA-5 is reversible by hand even though it is presented as
    // irreversible.
    const SRS_RESET_BACKUP_KEY = 'srsData.bak.reset';

    // A 5MB localStorage cannot hold more than this anyway; the cap exists so a
    // mis-picked 400MB file is refused before it is read into memory.
    const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

    // ------------------------------------------------------------------
    // Which keys are learner data
    // ------------------------------------------------------------------
    //
    // Enumerate localStorage and subtract this deny-list, rather than listing
    // the keys to include: a key added by a future feature is then exported by
    // default, and the failure mode of forgetting to update a list is "the
    // export is slightly larger than it needed to be" instead of "the learner
    // silently lost a month of data".

    const EXCLUDED_EXACT = [
        // Diagnostics, not learner data (error-handler.js:234). Carries
        // messages and stack traces; nothing restores from it.
        'errorLog',
        PRE_IMPORT_KEY
    ];

    const EXCLUDED_PATTERNS = [
        // Dictionary API response cache (app.js cache.set, `word_<lemma>`).
        // Regenerable, expires after 24h, and by far the largest thing in
        // storage — carrying it would make the export mostly cache.
        /^word_/,
        // Device-local backups: `learningProgress.bak.v1` (Migrations.backupOnce)
        // and `srsData.bak.reset`. These describe THIS device's history. Worse,
        // backupOnce() never overwrites, so importing a foreign backup would
        // permanently block the local one from ever being taken.
        /\.bak(\.|$)/,
        // Storage probes (StorageManager.isAvailable writes `__storage_test__`).
        /^__/
    ];

    function isOwnedKey(key) {
        if (typeof key !== 'string' || key.length === 0) return false;
        if (EXCLUDED_EXACT.indexOf(key) !== -1) return false;
        for (let i = 0; i < EXCLUDED_PATTERNS.length; i++) {
            if (EXCLUDED_PATTERNS[i].test(key)) return false;
        }
        return true;
    }

    /** Every learner-data key currently in localStorage, sorted for stable diffs. */
    function ownedKeys() {
        const keys = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (isOwnedKey(key)) keys.push(key);
            }
        } catch (e) {
            // Private mode with storage disabled. An empty list is honest.
        }
        return keys.sort();
    }

    /** Raw string values for every owned key. The unit of both export and rollback. */
    function snapshot() {
        const out = {};
        ownedKeys().forEach(function (key) {
            const raw = localStorage.getItem(key);
            if (raw !== null) out[key] = raw;
        });
        return out;
    }

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------

    function hasOwn(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    function isPlainObject(v) {
        return !!v && typeof v === 'object' && !Array.isArray(v);
    }

    function buildSchemaVersion() {
        return (global.Migrations && Number(global.Migrations.SCHEMA_VERSION)) || 1;
    }

    /**
     * The version a raw progress string claims. Mirrors migrations.js
     * storedVersion(): anything unusable reads as 1, the pre-version shape.
     */
    function versionOfRawProgress(raw) {
        if (typeof raw !== 'string') return 0;
        try {
            const parsed = JSON.parse(raw);
            return Number(parsed && parsed.schemaVersion) || 1;
        } catch (e) {
            return 0;
        }
    }

    /** True for a pre-CEFR difficulty id (`basic` / `intermediate` / `medium`). */
    function isLegacyLevel(value) {
        const aliases = global.LEVEL_ALIASES;
        if (!aliases) return false;
        const norm = String(value == null ? '' : value).trim().toLowerCase();
        return hasOwn(aliases, norm) && aliases[norm] !== norm;
    }

    /**
     * The schema era a raw `srsData` string is from, decided by SHAPE.
     *
     * `srsData` carries no version stamp of its own — migrations.js
     * migrateSrsData() explains why it cannot have one — so migrations.js
     * decides the era by asking which of its shape-gated steps would change the
     * data, and files its backup under `Math.max(1, firstChangedTo - 1)`. This
     * mirrors that verdict from the outside, so a copy taken here lands under
     * the SAME name migrations.js would have used for the same bytes: a bare
     * (untyped) record key, or a legacy level alias inside a record, means the
     * pre-typed-key era (1).
     *
     * Anything unreadable reads as THIS BUILD's version, not as 1: we cannot
     * claim data belongs to an era we were unable to inspect (`BR-3`). The
     * asymmetry with versionOfRawProgress() is deliberate — there, an unusable
     * value really is the pre-version shape, because version 1 is defined as
     * "no schemaVersion field"; here there is no field to be missing.
     */
    function versionOfRawSrs(raw) {
        const current = buildSchemaVersion();
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            return current;
        }
        if (!isPlainObject(parsed)) return current;

        // Migrations' own predicate when it is loaded, so the two can never
        // disagree about what "typed" means; the regex is the Node fallback.
        const isTyped = (global.Migrations && typeof global.Migrations.isTypedSrsKey === 'function')
            ? global.Migrations.isTypedSrsKey
            : function (k) { return /^(vocab|gram|phon|coll):/.test(String(k)); };

        const keys = Object.keys(parsed);
        for (let i = 0; i < keys.length; i++) {
            const rec = parsed[keys[i]];
            // Matches srsTypedKeysV2's own test for "is this a record": a stray
            // non-object sibling is left exactly where it is by the migration,
            // so it says nothing about which era the map is from.
            if (!rec || typeof rec !== 'object') continue;
            if (!isTyped(keys[i])) return 1;
            if (isLegacyLevel(rec.data && rec.data.difficulty)) return 1;
        }
        return current;
    }

    /** UTF-8 byte length, with a character-count fallback. */
    function byteLength(str) {
        const s = String(str == null ? '' : str);
        try {
            if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
        } catch (e) { /* fall through */ }
        return s.length;
    }

    function isQuotaError(e) {
        if (!e) return false;
        return e.name === 'QuotaExceededError' ||
               e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
               e.code === 22 || e.code === 1014;
    }

    function logError(e, context) {
        try {
            if (global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                global.AppErrorHandler.logError(e, context);
            } else if (typeof console !== 'undefined' && console.warn) {
                console.warn('[portability] ' + context + ':', e);
            }
        } catch (ignored) { /* a hostile console must never break a restore */ }
    }

    // ------------------------------------------------------------------
    // Learner-facing copy — docs/TEACHING_METHODOLOGY.md §5
    // Plain, calm, second person. Every rejection states what did NOT happen,
    // because "did I just lose my history?" is the only question that matters
    // to someone looking at an error here.
    // ------------------------------------------------------------------

    const MESSAGES = {
        exportOk: 'Saved. The file is in your downloads folder.',
        // A file with neither progress nor review history in it is refused on
        // the way back in (see validateExport), so saying only "Saved." would be
        // promising a restore that cannot happen. Worded to be true of a
        // settings-only file and of a brand-new device alike. US-209.
        exportOkNotRestorable: 'Saved. There is no progress or review history on this device yet, though, so this app cannot restore that file later. Save another copy once you have done some work.',
        exportFailed: 'The copy could not be created. Nothing on this device has changed.',

        // A restore is a REPLACEMENT, not a merge (see importFromText step 3), so
        // the copy has to say what happens to anything the file does not carry.
        // "replaces ... with the ones in this file" alone reads as substitution
        // and nobody would guess it means "and deletes the categories the file
        // omits" — US-204. importConfirmMessage() appends the specific sentences.
        importConfirm: 'Restoring replaces what is on this device with what is in this file. Anything saved here that the file does not contain is removed, not kept. A copy of what is here now is kept on this device first.',
        importConfirmProgressLost: 'This file has no progress in it, so the progress on this device — including your streak and completed exercises — will be removed.',
        importConfirmReviewLost: 'This file has no review history in it, so the review history on this device will be removed, and every word goes back to being unseen.',
        importConfirmOtherLost: 'Other items saved on this device are not in this file and will also be removed: ',
        importConfirmTail: 'Continue?',
        importOk: 'Restored. Reloading now so everything on screen matches your file.',
        importOkNoReload: 'Restored. Reload the page when you are ready, so everything on screen matches your file.',
        cancelled: 'Nothing has changed.',

        empty: 'That file is empty. Nothing has changed.',
        notJson: 'That file is not readable. It should be the .json file this app saved. Nothing has changed.',
        notMine: 'That file is not a copy saved by this app. Nothing has changed.',
        noData: 'That file has no progress or review history in it. Nothing has changed.',
        damaged: 'The progress inside that file is damaged, so it was not applied. Nothing has changed.',
        incomplete: 'That file looks incomplete, so it was not applied. Nothing has changed.',
        tooLarge: 'That file is too large for this app to read. Nothing has changed.',
        readFailed: 'That file could not be read. Nothing has changed.',
        futureFile: 'That file was saved by a newer version of this app, so this version cannot read it safely. Update this app, or restore the file on the device that made it. Nothing has changed.',

        quota: 'There is not enough room on this device to restore that file, so your existing data has been put back. Nothing has changed.',
        writeFailed: 'The restore could not be completed, so your existing data has been put back. Nothing has changed.',
        // Three ways a failed rollback can end, because the module must only
        // name a recovery copy it actually took (`BR-3`) and must not tell
        // someone data is lost when there was none to lose. US-199.
        rollbackFailed: 'The restore stopped part way and your previous data could not be put back automatically. It is still on this device, saved under "' + PRE_IMPORT_KEY + '". Save a copy of this message before you reload.',
        rollbackFailedNoBackup: 'The restore stopped part way, your previous data could not be put back, and this device had no room to keep a copy of it first — so some of what was here before is lost. What is on the device now is part of the file you chose. Make room on this device, then restore that file again. Save a copy of this message before you reload.',
        rollbackFailedNothingLost: 'The restore stopped part way, so only part of that file is on this device. There was nothing saved here before it, so none of your earlier data is lost. Make room on this device, then restore that file again.',

        resetConfirm: 'This clears your review history. Every word goes back to being unseen, so reviews start again from the beginning.\n\nYour progress, streak, completed exercises and settings stay exactly as they are. A copy of the review history is kept on this device.\n\nThis cannot be undone from here. Continue?',
        resetOk: 'Your review history is cleared. Words you meet from now on are scheduled fresh.',
        resetNothing: 'There is no review history to clear yet.',
        resetFailed: 'The review history could not be cleared. Nothing has changed.',
        // The removal neither failed nor could be confirmed: storage stopped
        // answering between clearing it and reading it back. Saying "nothing has
        // changed" would be a guess. US-198 / `BR-3`.
        resetUnverified: 'The review history may not have been cleared — this device stopped answering part way. Reload the page to see where things stand.'
    };

    // ------------------------------------------------------------------
    // Naming what a restore is about to remove (US-204)
    // ------------------------------------------------------------------
    //
    // Learner-facing names for the keys the app writes today. A key with no
    // entry here is still learner data — the export is a deny-list, so a future
    // feature's key is carried automatically — but this module cannot invent a
    // name for it, so it is counted as "other saved items" rather than shown to
    // a learner as a raw storage key.

    const KEY_LABELS = {};
    KEY_LABELS[PROGRESS_KEY] = 'your progress';
    KEY_LABELS[SRS_KEY] = 'your review history';
    KEY_LABELS.mistakeLog = 'your mistake history';
    KEY_LABELS.sessionPlan = "today's plan";
    KEY_LABELS.theme = 'your appearance settings';

    /**
     * The confirm text for ONE specific file, on THIS device.
     *
     * A restore is a replacement, so a file carrying only `srsData` deletes
     * `learningProgress`. That is the right behaviour — a "clean install" that
     * silently kept this device's leftovers would be a worse lie, and the
     * rollback path depends on the commit being a whole state, not a merge — but
     * it is only defensible if the learner is told before they agree, in the
     * words of the thing they are about to lose rather than in storage keys.
     *
     * Takes a validated plan, so it is only ever built for a file that was
     * actually going to load: nobody is warned about a loss that was never on
     * the table.
     */
    function importConfirmMessage(plan) {
        const data = (plan && plan.data) || {};
        const parts = [MESSAGES.importConfirm];

        const dropped = ownedKeys().filter(function (key) {
            return !hasOwn(data, key);
        });

        if (dropped.indexOf(PROGRESS_KEY) !== -1) parts.push(MESSAGES.importConfirmProgressLost);
        if (dropped.indexOf(SRS_KEY) !== -1) parts.push(MESSAGES.importConfirmReviewLost);

        const others = [];
        let unnamed = 0;
        dropped.forEach(function (key) {
            if (key === PROGRESS_KEY || key === SRS_KEY) return;
            if (hasOwn(KEY_LABELS, key)) others.push(KEY_LABELS[key]);
            else unnamed++;
        });
        if (unnamed > 0) {
            others.push(unnamed === 1 ? 'one other saved item' : unnamed + ' other saved items');
        }
        if (others.length > 0) {
            parts.push(MESSAGES.importConfirmOtherLost + others.join(', ') + '.');
        }

        parts.push(MESSAGES.importConfirmTail);
        return parts.join('\n\n');
    }

    // ------------------------------------------------------------------
    // Export (US-203 / FR-DATA-4)
    // ------------------------------------------------------------------

    /**
     * The version an import should reason about: the higher of what this build
     * knows and what the stored progress record claims. Taking the max matters
     * for the rollback-to-an-older-bundle case — a record written by a newer
     * release must not be exported labelled as current, or the older client
     * that re-imports it will believe it understands the shape.
     */
    function exportSchemaVersion(rawProgress) {
        return Math.max(buildSchemaVersion(), versionOfRawProgress(rawProgress));
    }

    function buildExport() {
        const data = snapshot();
        const keys = Object.keys(data);
        return {
            app: APP_ID,
            kind: KIND,
            formatVersion: FORMAT_VERSION,
            schemaVersion: exportSchemaVersion(data[PROGRESS_KEY]),
            exportedAt: new Date().toISOString(),
            keyCount: keys.length,
            data: data
        };
    }

    function exportFileName(date) {
        const d = date || new Date();
        const pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return 'english-portal-data-' + d.getFullYear() + '-' +
               pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json';
    }

    /**
     * True when a file built from this data could actually be restored by
     * validateExport() — i.e. it carries progress or review history.
     *
     * US-209: a device holding only `theme` produces a file that exports
     * happily and is then refused `no-data` on the way back in. The refusal is
     * KEPT deliberately: an import is a replacement, so accepting a
     * settings-only file would let one mis-picked, genuinely-ours file wipe a
     * populated device, and the thing it would rescue is a theme toggle. What
     * was wrong was calling that export a success with no qualification — so the
     * export tells the truth instead. `BR-7` is about data being recoverable;
     * this is about not claiming a copy is a backup when it is not.
     */
    function isRestorableExport(data) {
        return hasOwn(data, PROGRESS_KEY) || hasOwn(data, SRS_KEY);
    }

    /**
     * One learner action, one file. Blob + object URL, no library, no network —
     * CON-5 leaves nothing else on the table anyway.
     */
    function exportToFile() {
        let url = null;
        try {
            const payload = buildExport();
            // Pretty-printed: FR-DATA-4 exists partly so a beta tester can send
            // numbers deliberately, and a human has to be able to read them.
            const text = JSON.stringify(payload, null, 2);
            const blob = new Blob([text], { type: 'application/json' });
            url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = exportFileName();
            a.rel = 'noopener';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Revoked on the next turn, not synchronously: some browsers have
            // not finished reading the blob when click() returns, and revoking
            // early cancels the download.
            setTimeout(function () {
                try { URL.revokeObjectURL(url); } catch (e) { /* already gone */ }
            }, 0);

            const restorable = isRestorableExport(payload.data);
            return {
                ok: true,
                keyCount: payload.keyCount,
                bytes: byteLength(text),
                fileName: a.download,
                restorable: restorable,
                message: restorable ? MESSAGES.exportOk : MESSAGES.exportOkNotRestorable
            };
        } catch (e) {
            if (url) {
                try { URL.revokeObjectURL(url); } catch (ignored) { /* ignore */ }
            }
            logError(e, 'export learner data');
            return { ok: false, code: 'export-failed', message: MESSAGES.exportFailed };
        }
    }

    // ------------------------------------------------------------------
    // Import (US-204 / FR-DATA-4)
    // ------------------------------------------------------------------

    function reject(code, message) {
        return { ok: false, code: code, message: message };
    }

    /**
     * Own properties that mark a blob as this app's progress record. Any ONE is
     * enough: old saves predate most of them, and rejecting a restorable save
     * because it lacks `dailyHistory` would be the worse failure. Requiring at
     * least one is what separates "our data" from "valid JSON of something
     * else entirely".
     */
    const PROGRESS_MARKERS = [
        'stats', 'dailyStats', 'overallStats', 'dailyGoals',
        'completedExercises', 'exerciseHistory', 'dailyHistory',
        'currentWordIndex', 'currentSection', 'vocabProgress'
    ];

    function looksLikeProgress(obj) {
        if (!isPlainObject(obj)) return false;
        for (let i = 0; i < PROGRESS_MARKERS.length; i++) {
            if (hasOwn(obj, PROGRESS_MARKERS[i])) return true;
        }
        return false;
    }

    /**
     * A key we are willing to write. Rejects prototype-polluting names and
     * anything on the export deny-list: our own files never contain those, so
     * refusing them cannot break a legitimate restore, and it stops a
     * hand-edited file from planting keys the app never wrote.
     */
    function isImportableKey(key) {
        if (typeof key !== 'string' || key.length === 0 || key.length > 200) return false;
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') return false;
        return isOwnedKey(key);
    }

    /**
     * Everything that can say no, said before anything is written.
     *
     * Returns { ok: true, plan } where plan.data is the exact map of raw strings
     * to commit, or a rejection carrying a learner-facing message. Pure: it
     * touches localStorage only to read the current progress version.
     */
    function validateExport(text) {
        if (typeof text !== 'string' || text.trim() === '') {
            return reject('empty', MESSAGES.empty);
        }
        if (byteLength(text) > MAX_IMPORT_BYTES) {
            return reject('too-large', MESSAGES.tooLarge);
        }

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            return reject('not-json', MESSAGES.notJson);
        }

        if (!isPlainObject(parsed)) return reject('wrong-shape', MESSAGES.notMine);
        if (parsed.app !== APP_ID || parsed.kind !== KIND) return reject('foreign', MESSAGES.notMine);

        const format = Number(parsed.formatVersion);
        if (!isFinite(format) || format < 1) return reject('wrong-shape', MESSAGES.notMine);
        // A newer envelope may nest or encode things this build cannot see.
        if (format > FORMAT_VERSION) return reject('future-format', MESSAGES.futureFile);

        if (!isPlainObject(parsed.data)) return reject('wrong-shape', MESSAGES.notMine);

        const keys = Object.keys(parsed.data);
        if (keys.length === 0) return reject('no-data', MESSAGES.noData);
        if (hasOwn(parsed, 'keyCount') && Number(parsed.keyCount) !== keys.length) {
            return reject('incomplete', MESSAGES.incomplete);
        }

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (!isImportableKey(key)) return reject('wrong-shape', MESSAGES.notMine);
            // Values are raw localStorage strings by construction. Anything
            // else means the file was written by something that is not us.
            if (typeof parsed.data[key] !== 'string') return reject('wrong-shape', MESSAGES.notMine);
        }

        // A file with neither of these restores nothing a learner would notice —
        // and, because a commit is a replacement, accepting one would let a
        // settings-only file DELETE the progress on a populated device. Kept
        // strict for that reason; exportToFile() says so at the moment the file
        // is written instead. See isRestorableExport() (US-209).
        const hasProgress = hasOwn(parsed.data, PROGRESS_KEY);
        const hasSrs = hasOwn(parsed.data, SRS_KEY);
        if (!hasProgress && !hasSrs) return reject('no-data', MESSAGES.noData);

        let progress = null;
        if (hasProgress) {
            try {
                progress = JSON.parse(parsed.data[PROGRESS_KEY]);
            } catch (e) {
                return reject('damaged', MESSAGES.damaged);
            }
            if (!isPlainObject(progress)) return reject('damaged', MESSAGES.damaged);
            if (!looksLikeProgress(progress)) return reject('wrong-shape', MESSAGES.notMine);
        }

        if (hasSrs) {
            let srs;
            try {
                srs = JSON.parse(parsed.data[SRS_KEY]);
            } catch (e) {
                return reject('damaged', MESSAGES.damaged);
            }
            // srs.js keys records by lowercase word; a non-object here would
            // make SRS.getDueWords() throw on every load after the import.
            if (!isPlainObject(srs)) return reject('damaged', MESSAGES.damaged);
            const words = Object.keys(srs);
            for (let i = 0; i < words.length; i++) {
                if (!isPlainObject(srs[words[i]])) return reject('damaged', MESSAGES.damaged);
            }
        }

        // From the future: refuse honestly rather than write data whose shape
        // this build has never seen. Asked two ways, because the envelope's
        // stamp and the record's own field can disagree if either was edited.
        const claimed = Math.max(
            Number(parsed.schemaVersion) || 0,
            progress ? (Number(progress.schemaVersion) || 0) : 0
        );
        const migrationsSayFuture = !!(global.Migrations &&
            typeof global.Migrations.isFutureVersion === 'function' &&
            progress && global.Migrations.isFutureVersion(progress));
        if (migrationsSayFuture || claimed > buildSchemaVersion()) {
            return reject('future-schema', MESSAGES.futureFile);
        }

        return {
            ok: true,
            plan: {
                data: parsed.data,
                keys: keys.slice().sort(),
                schemaVersion: claimed || buildSchemaVersion(),
                exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null
            }
        };
    }

    /** Best-effort single-write copy of everything that is about to be replaced. */
    function writePreImportBackup(before) {
        if (Object.keys(before).length === 0) return false;
        try {
            localStorage.setItem(PRE_IMPORT_KEY, JSON.stringify({
                takenAt: new Date().toISOString(),
                data: before
            }));
            return true;
        } catch (e) {
            // Quota or private mode. The in-memory rollback below is the real
            // protection, so a failed backup does not block the restore.
            logError(e, 'pre-import backup');
            return false;
        }
    }

    /** True when the store's owned keys are exactly `expected`, values included. */
    function storeMatches(expected) {
        const now = snapshot();
        const a = Object.keys(now).sort();
        const b = Object.keys(expected).sort();
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
            if (now[a[i]] !== expected[a[i]]) return false;
        }
        return true;
    }

    /**
     * Put `before` back. Removes everything the failed commit wrote FIRST, so
     * the space the old values need is free again before we ask for it.
     *
     * Every step is individually guarded, and the return value is decided by
     * READING THE STORE rather than by whether an exception was thrown: a write
     * can throw on a key whose value was already correct, and telling a learner
     * their data could not be restored when it is sitting there intact is its
     * own kind of harm.
     */
    function rollback(before, written) {
        function tryRemove(key) {
            try { localStorage.removeItem(key); } catch (e) { logError(e, 'rollback remove'); }
        }

        written.forEach(function (key) {
            if (!hasOwn(before, key)) tryRemove(key);
        });
        ownedKeys().forEach(function (key) {
            if (!hasOwn(before, key)) tryRemove(key);
        });
        Object.keys(before).forEach(function (key) {
            try {
                if (localStorage.getItem(key) === before[key]) return; // already right
                localStorage.setItem(key, before[key]);
            } catch (e) {
                logError(e, 'rollback restore');
            }
        });

        return storeMatches(before);
    }

    /**
     * The verdict for a rollback that did not restore the store.
     *
     * The message may only name PRE_IMPORT_KEY when that copy was actually
     * written. On a device too full to hold the recovery copy AND too full to
     * roll back, the old copy pointed a learner at a key that does not exist —
     * the one path in this module where data is genuinely lost, made worse by
     * misdirecting the recovery (US-199, `BR-3`).
     *
     * The alternative — refusing to commit when no recovery copy could be taken —
     * was rejected: the commit REMOVES keys before it writes, so it routinely
     * succeeds on a device where the extra copy would not fit, and refusing
     * there would deny a restore to exactly the learner who most needs one. The
     * in-memory snapshot, not PRE_IMPORT_KEY, is the real protection (see
     * writePreImportBackup). So we still commit, and say what is true.
     */
    function rollbackFailure(before, backupTaken) {
        if (backupTaken) {
            return reject('rollback-failed', MESSAGES.rollbackFailed);
        }
        if (Object.keys(before).length === 0) {
            // Nothing was here to lose: the restore is simply incomplete.
            return reject('rollback-failed-nothing-lost', MESSAGES.rollbackFailedNothingLost);
        }
        return reject('rollback-failed-no-backup', MESSAGES.rollbackFailedNoBackup);
    }

    /**
     * Restore from an export. All-or-nothing, in four steps:
     *
     *   1. Validate the entire file. Nothing is written until it passes, so
     *      every rejection above is provably a no-op on stored data.
     *   2. Snapshot every owned key in memory, and write one recovery copy to
     *      PRE_IMPORT_KEY. Also take the migration-style
     *      Migrations.backupOnce() copy, so the recovery path a future
     *      migration bug would look for exists here too.
     *   3. Commit: drop owned keys the file does not have (a restore is a
     *      replacement, not a merge — otherwise a "clean install" still carries
     *      this device's leftovers), then write the file's keys verbatim.
     *   4. If any write throws — quota is the realistic case — roll the
     *      snapshot back and report failure. Whether the recovery copy of step 2
     *      exists decides which failure the learner is told about.
     *
     * localStorage has no transaction, so this is not atomicity; it is
     * "validate before touching anything, and undo if the commit breaks".
     * The residual risk is a crash between two setItem() calls, which is what
     * PRE_IMPORT_KEY is for.
     */
    function importFromText(text) {
        const checked = validateExport(text);
        if (!checked.ok) return checked;

        const plan = checked.plan;
        const before = snapshot();

        // Kept, not discarded: it is the only thing that makes the
        // rollback-failed message true. See rollbackFailure().
        const backupTaken = writePreImportBackup(before);
        if (global.Migrations && typeof global.Migrations.backupOnce === 'function' &&
            hasOwn(before, PROGRESS_KEY)) {
            global.Migrations.backupOnce(PROGRESS_KEY, versionOfRawProgress(before[PROGRESS_KEY]));
        }

        const written = [];
        try {
            Object.keys(before).forEach(function (key) {
                if (!hasOwn(plan.data, key)) localStorage.removeItem(key);
            });
            plan.keys.forEach(function (key) {
                localStorage.setItem(key, plan.data[key]);
                written.push(key);
            });
        } catch (e) {
            logError(e, 'import learner data');
            const restored = rollback(before, written);
            if (!restored) {
                return rollbackFailure(before, backupTaken);
            }
            return isQuotaError(e)
                ? reject('quota', MESSAGES.quota)
                : reject('write-failed', MESSAGES.writeFailed);
        }

        // Resync the one module that caches its records in memory, so a save
        // triggered before the reload cannot write pre-import records back.
        if (global.SRS && typeof global.SRS.load === 'function') {
            try { global.SRS.load(); } catch (e) { logError(e, 'SRS reload after import'); }
        }

        return {
            ok: true,
            keys: plan.keys,
            schemaVersion: plan.schemaVersion,
            exportedAt: plan.exportedAt
        };
    }

    // ------------------------------------------------------------------
    // Reset review history (US-205 / FR-DATA-5)
    // ------------------------------------------------------------------

    /**
     * Put the in-memory review records back in step with what is actually in
     * storage. Used when a reset could not be confirmed: SRS.reset() has already
     * emptied SRS.records, so without this the due badge would read zero over a
     * history that is still on disk and returns on the next reload.
     *
     * SRS.load() is the module's own loader, so a legacy history may come back
     * in its migrated shape rather than its stored bytes — the same rewrite the
     * next page load would have performed anyway. Nothing is lost by it, and
     * re-parsing the raw string here instead would leave the in-memory records
     * in a shape the rest of the app has stopped expecting.
     */
    function resyncSrsFromStorage() {
        if (global.SRS && typeof global.SRS.load === 'function') {
            try { global.SRS.load(); } catch (e) { logError(e, 'SRS resync after failed reset'); }
        }
    }

    /**
     * Clear `srsData` and nothing else. Progress, streak, completed exercises
     * and settings are separate keys and are never touched here.
     *
     * Two backups, on purpose:
     *   - SRS_RESET_BACKUP_KEY is rewritten every reset, so the history just
     *     discarded is always recoverable by hand.
     *   - Migrations.backupOnce() keeps the FIRST one forever. That is the
     *     pre-grading-fix data this feature exists because of, and it must
     *     survive a second reset a month later. It is filed under the era the
     *     DATA is from, not the era this build is in — see versionOfRawSrs().
     *
     * The verdict comes from READING THE STORE BACK, exactly as rollback()
     * decides its own. SRS.reset() swallows its removeItem failure
     * (js/core/srs.js:1408), so "no exception escaped" is not evidence here
     * either, and this is the one place a false "cleared" would be invisible:
     * the in-memory records really are gone, so the badge reads zero and the
     * screen looks right until the next reload brings the history back (US-198).
     */
    function resetReviewHistory() {
        let existing = null;
        try {
            existing = localStorage.getItem(SRS_KEY);
        } catch (e) {
            logError(e, 'read review history');
            return reject('reset-failed', MESSAGES.resetFailed);
        }

        if (existing === null || existing === '') {
            return { ok: true, cleared: false, message: MESSAGES.resetNothing };
        }

        try {
            localStorage.setItem(SRS_RESET_BACKUP_KEY, existing);
        } catch (e) {
            // Non-fatal: the learner asked for this and a full storage must not
            // trap them with data they have been told is unreliable.
            logError(e, 'review history backup');
        }
        if (global.Migrations && typeof global.Migrations.backupOnce === 'function') {
            global.Migrations.backupOnce(SRS_KEY, versionOfRawSrs(existing));
        }

        try {
            if (global.SRS && typeof global.SRS.reset === 'function') {
                // Clears the in-memory records too, so dueCount() is correct
                // immediately and no later save() rewrites the old records.
                global.SRS.reset();
            } else {
                localStorage.removeItem(SRS_KEY);
            }
        } catch (e) {
            logError(e, 'reset review history');
            return reject('reset-failed', MESSAGES.resetFailed);
        }

        // Did it actually go? The module's own standard, applied here too.
        let after;
        try {
            after = localStorage.getItem(SRS_KEY);
        } catch (e) {
            // The removal may or may not have landed and storage will no longer
            // say. Claiming either outcome would be inventing one.
            logError(e, 'verify review history reset');
            resyncSrsFromStorage();
            return reject('reset-unverified', MESSAGES.resetUnverified);
        }

        if (after !== null && after !== '') {
            logError(new Error('srsData survived the reset'), 'verify review history reset');
            resyncSrsFromStorage();
            return reject('reset-failed', MESSAGES.resetFailed);
        }

        return { ok: true, cleared: true, message: MESSAGES.resetOk };
    }

    // ------------------------------------------------------------------
    // Storage usage (CON-3 / NFR-10)
    // ------------------------------------------------------------------

    /**
     * Harvested from StorageManager.getStorageInfo, minus its
     * getAvailableSpace() helper: that probe wrote up to 10MB in a loop with
     * `testData.repeat(i)` on every iteration, which is quadratic and would
     * hang the tab for seconds before hitting quota. An estimate is not worth
     * that, and navigator.storage.estimate() covers it where it exists.
     */
    function storageInfo() {
        const items = {};
        let ownedBytes = 0;
        let totalBytes = 0;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const size = byteLength(key) + byteLength(localStorage.getItem(key));
                totalBytes += size;
                if (isOwnedKey(key)) {
                    ownedBytes += size;
                    items[key] = size;
                }
            }
        } catch (e) {
            logError(e, 'storage info');
        }
        return {
            items: items,
            keys: Object.keys(items).sort(),
            ownedBytes: ownedBytes,
            totalBytes: totalBytes,
            // Engines store localStorage as UTF-16, so the quota cost is
            // roughly double these UTF-8 figures. Reported, not hidden.
            ownedKB: (ownedBytes / 1024).toFixed(1)
        };
    }

    // ------------------------------------------------------------------
    // Write suspension
    // ------------------------------------------------------------------
    //
    // app.js runs `setInterval(saveProgress, 30000)`. Without this flag, an
    // autosave firing between a successful import and the reload would write
    // the PRE-import in-memory state straight over the record just restored,
    // and the learner would watch the restore silently undo itself. saveProgress
    // checks writesSuspended().

    let suspended = false;

    function suspendWrites() { suspended = true; }
    function writesSuspended() { return suspended; }

    /**
     * TEST SEAM (US-207). In the browser nothing calls this: the latch is
     * one-way on purpose, because the only thing that legitimately clears it is
     * the page reload that follows a successful import.
     *
     * It exists because `suspended` is module-level state that survives
     * localStorage.clear(), which gave the suite a hidden ordering dependency —
     * every test after the first successful import saw `writesSuspended() ===
     * true`, and the file would break under `--randomize`. A seam that only ever
     * runs in a test is honest; a production reset path would not be.
     */
    function _resetWritesSuspended() { suspended = false; }

    // ------------------------------------------------------------------
    // UI wiring
    // ------------------------------------------------------------------
    //
    // Kept in this module rather than app.js so the controls, their copy and
    // the code behind them stay in one reviewable place.

    const RELOAD_DELAY_MS = 1500; // long enough to read the confirmation

    function statusEl() {
        return document.getElementById('dataControlsStatus');
    }

    function setStatus(message, tone) {
        const el = statusEl();
        if (!el) return;
        el.textContent = message;
        el.className = 'feedback visible ' + (tone || 'info');
    }

    function showUsage() {
        const el = document.getElementById('dataControlsUsage');
        if (!el) return;
        const info = storageInfo();
        el.textContent = info.keys.length === 0
            ? 'Nothing saved on this device yet.'
            : 'On this device now: ' + info.ownedKB + ' KB across ' +
              info.keys.length + (info.keys.length === 1 ? ' item.' : ' items.');
    }

    function confirmed(message) {
        // No confirm() available (embedded webview, or Node) — fail closed
        // rather than perform an irreversible action nobody agreed to.
        if (typeof global.confirm !== 'function') return false;
        return global.confirm(message);
    }

    // app.js declares these at the top level of a classic script, so they are
    // reachable as free variables from here. `state` is a `const`, which means
    // it is a global LEXICAL binding and never appears on `window` — hence the
    // bare identifiers plus typeof guards rather than `global.x`.
    function refreshDueCount() {
        if (typeof updateDueCount === 'function') {
            try { updateDueCount(); } catch (e) { logError(e, 'refresh due count'); }
        }
    }

    function inReviewMode() {
        try {
            return typeof state !== 'undefined' && !!state && state.reviewMode === true;
        } catch (e) {
            return false;
        }
    }

    function handleExport() {
        const result = exportToFile();
        if (!result.ok) {
            setStatus(result.message, 'error');
            return;
        }
        // The file did save either way, but a copy this app cannot restore is a
        // caveat rather than a success, so it is not dressed as one (US-209).
        setStatus(result.message, result.restorable ? 'success' : 'info');
        showUsage();
    }

    function handleFile(file) {
        if (!file) return;
        if (file.size === 0) {
            setStatus(MESSAGES.empty, 'error');
            return;
        }
        if (file.size > MAX_IMPORT_BYTES) {
            setStatus(MESSAGES.tooLarge, 'error');
            return;
        }

        let reader;
        try {
            reader = new FileReader();
        } catch (e) {
            setStatus(MESSAGES.readFailed, 'error');
            return;
        }

        reader.onerror = function () {
            setStatus(MESSAGES.readFailed, 'error');
        };
        reader.onload = function () {
            const text = String(reader.result == null ? '' : reader.result);

            // Validate BEFORE asking, so a learner is never made to confirm
            // replacing their data with a file that was never going to load.
            const checked = validateExport(text);
            if (!checked.ok) {
                setStatus(checked.message, 'error');
                return;
            }
            // Named per file, not a fixed string: a restore is a replacement, so
            // the learner has to be told which of THEIR categories this
            // particular file does not carry (US-204).
            if (ownedKeys().length > 0 && !confirmed(importConfirmMessage(checked.plan))) {
                setStatus(MESSAGES.cancelled, 'info');
                return;
            }

            const result = importFromText(text);
            if (!result.ok) {
                setStatus(result.message, 'error');
                return;
            }

            // The in-memory `state` in app.js holds Sets, generated exercises
            // and review-queue objects built from the data we just replaced. A
            // fresh load is the only way to be sure every one of them matches
            // storage, so suspend saves and reload rather than half-refresh.
            suspendWrites();
            refreshDueCount();
            if (Portability._canReload()) {
                setStatus(MESSAGES.importOk, 'success');
                setTimeout(function () {
                    // Through the seam, not straight to location.reload(): see
                    // Portability._reload (US-208). Same call in production.
                    try { Portability._reload(); } catch (e) { logError(e, 'reload after import'); }
                }, RELOAD_DELAY_MS);
            } else {
                setStatus(MESSAGES.importOkNoReload, 'success');
            }
        };

        try {
            reader.readAsText(file);
        } catch (e) {
            setStatus(MESSAGES.readFailed, 'error');
        }
    }

    function handleReset() {
        if (!confirmed(MESSAGES.resetConfirm)) {
            setStatus(MESSAGES.cancelled, 'info');
            return;
        }
        const result = resetReviewHistory();
        if (!result.ok) {
            setStatus(result.message, 'error');
            return;
        }
        // Leave review mode before the badge is redrawn: its queue was built
        // from records that no longer exist.
        if (result.cleared && inReviewMode() && typeof exitReview === 'function') {
            try { exitReview(); } catch (e) { logError(e, 'exit review after reset'); }
        }
        refreshDueCount();
        showUsage();
        setStatus(result.message, result.cleared ? 'success' : 'info');
    }

    function initUI() {
        if (typeof document === 'undefined') return;

        const exportBtn = document.getElementById('exportData');
        const importBtn = document.getElementById('importData');
        const fileInput = document.getElementById('importDataFile');
        const resetBtn = document.getElementById('resetReviewHistory');

        if (exportBtn) exportBtn.addEventListener('click', handleExport);

        // The <button> is what the learner tabs to and activates; the input is
        // only the file-picker mechanism and is kept out of the tab order.
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', function () { fileInput.click(); });
            fileInput.addEventListener('change', function () {
                const file = fileInput.files && fileInput.files[0];
                // Cleared so picking the same file twice fires `change` again.
                handleFile(file);
                fileInput.value = '';
            });
        }

        if (resetBtn) resetBtn.addEventListener('click', handleReset);

        showUsage();
    }

    const Portability = {
        APP_ID: APP_ID,
        KIND: KIND,
        FORMAT_VERSION: FORMAT_VERSION,
        PROGRESS_KEY: PROGRESS_KEY,
        SRS_KEY: SRS_KEY,
        PRE_IMPORT_KEY: PRE_IMPORT_KEY,
        SRS_RESET_BACKUP_KEY: SRS_RESET_BACKUP_KEY,
        MAX_IMPORT_BYTES: MAX_IMPORT_BYTES,
        MESSAGES: MESSAGES,

        isOwnedKey: isOwnedKey,
        ownedKeys: ownedKeys,
        snapshot: snapshot,
        buildExport: buildExport,
        exportFileName: exportFileName,
        exportToFile: exportToFile,
        validateExport: validateExport,
        importConfirmMessage: importConfirmMessage,
        importFromText: importFromText,
        resetReviewHistory: resetReviewHistory,
        storageInfo: storageInfo,
        suspendWrites: suspendWrites,
        writesSuspended: writesSuspended,
        initUI: initUI,

        /**
         * TEST SEAM (US-208). The reload after a successful import, behind one
         * indirection so it can be observed, plus the capability check that
         * decides whether a reload is possible at all.
         *
         * jsdom's `location` is [Unforgeable]: `location.reload` is a "not
         * implemented" stub, it cannot be spied on, `delete window.location` is
         * a silent no-op and defineProperty on it throws — so without these two
         * the reload was the only unreachable line in the module and the
         * "reload it yourself" branch could not be reached either. In production
         * they ARE `global.location.reload()` and the same guard as before,
         * called at the same moment: the seams change what the calls can be
         * watched through, not what they do.
         */
        _reload: function () { global.location.reload(); },
        _canReload: function () {
            return !!(global.location && typeof global.location.reload === 'function');
        },

        // TEST SEAM (US-207) — see _resetWritesSuspended().
        _resetWritesSuspended: _resetWritesSuspended
    };

    global.Portability = Portability;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Portability;
    }
})(typeof window !== 'undefined' ? window : globalThis);
