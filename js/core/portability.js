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
 * A THIRD, added by US-138: the recording archive travels as a SECOND FILE, and
 * the data file says so in its own bytes. Recordings are binary Blobs in
 * IndexedDB and cannot go inside a text file of localStorage strings without
 * throwing away everything the first two choices buy — see the long note above
 * RECORDINGS_KIND for the full argument, including why base64-in-one-file and
 * metadata-only were both rejected. What the data file carries instead is a
 * `recordings` manifest: how many recordings exist, at which prompts, how big,
 * and a sentence stating that the audio is not in this file and naming the file
 * it is in. The export never claims to hold something it does not.
 *
 * Depends on js/core/migrations.js (SCHEMA_VERSION, PROGRESS_KEY, backupOnce,
 * isFutureVersion), optionally on js/core/srs.js, and — for recordings only, and
 * always optionally — on js/core/blobstore.js. A device with no IndexedDB, and a
 * build where blobstore.js failed to load, both still export and import
 * everything else and are told what they did not get.
 *
 * Public API (window.Portability):
 *   ownedKeys()                  -> the keys an export contains, sorted
 *   buildExport([archive])       -> the export envelope as an object
 *   exportToFile([archive])      -> triggers the download (synchronous)
 *   exportAll()                  -> Promise: reads the archive, then exports
 *   validateExport(text)         -> { ok, plan } | { ok:false, code, message }
 *   importConfirmMessage(plan)   -> the confirm copy for one specific file
 *   importFromText(text)         -> writes all-or-nothing
 *   resetReviewHistory()         -> clears srsData only
 *   storageInfo()                -> bytes held on this device
 *   writesSuspended()            -> true once an import is committed
 *   MESSAGES                     -> every learner-facing string
 *   initUI()                     -> wires the Dashboard controls
 *
 *   -- recordings (US-138), all promise-returning, none of them ever rejecting:
 *   archivePossible()            -> synchronous: can this device hold recordings
 *   archiveSummary()             -> what the archive holds, or available:false
 *   refreshArchive()             -> archiveSummary(), cached for the sync callers
 *   exportRecordingsToFile()     -> the companion .enrec file
 *   readRecordingsFile(file)     -> validate a companion file, writing nothing
 *   importRecordingsFromFile(f)  -> restore recordings, ADDITIVELY
 *
 *   _reload / _canReload / _resetWritesSuspended / _setArchiveCache -> test seams,
 *                                   never called in the browser except through
 *                                   handleFile()
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
    // The recording archive (US-138 / FR-DATA-4 over FR-DATA-6)
    // ------------------------------------------------------------------
    //
    // WHY THE ARCHIVE IS A SECOND FILE AND NOT PART OF THE FIRST.
    //
    // The export above is a TEXT file of localStorage key/value pairs carried as
    // raw strings. That is the whole reason a round trip is byte-exact, and it is
    // what lets every rejection above be provably write-free. Recordings are
    // binary Blobs in IndexedDB, and there is no honest way to put them in that
    // file:
    //
    //   - Base64 inflates by ~33%, so the 50MB archive (BlobStore.MAX_TOTAL_BYTES)
    //     becomes ~67MB of text that has to exist AS ONE JAVASCRIPT STRING before
    //     it can be written — ~134MB of UTF-16 heap, plus the JSON.stringify copy,
    //     plus the Blob. On the 3GB Android device NFR-6 names as the floor that
    //     is not a slow export, it is a killed tab. The cap that would make it
    //     safe is low enough to refuse exactly the learner with three months of
    //     recordings, which is the learner this story exists for.
    //   - MAX_IMPORT_BYTES exists so a mis-picked 400MB file is refused before it
    //     is read into memory. Raising it to ~70MB to admit inlined audio would
    //     throw that protection away for every import, including the ones that
    //     carry no audio at all.
    //   - localStorage and IndexedDB share no transaction. One file means one
    //     learner action committing to two stores, and a failure between them is
    //     a state neither store agreed to, with no rollback() equivalent for
    //     blobs.
    //
    // So the archive travels as its own artefact, and the two are made a PAIR
    // rather than a whole:
    //
    //   1. The data file above additionally carries a `recordings` MANIFEST —
    //      metadata only, plus a sentence in the file itself saying the audio is
    //      not in it and naming the companion file. That is what makes the data
    //      file honest instead of silently short: a learner reading it can see
    //      how many recordings existed, at which prompts, and how big they were.
    //   2. The recordings file carries the audio, as a BINARY container: an
    //      ASCII header followed by the payloads back to back. It is assembled
    //      with `new Blob([header, blobA, blobB, ...])`, which never materialises
    //      the bytes in JavaScript memory, and read back with `file.slice()`,
    //      which never reads a payload just to find the next one. No base64, no
    //      inflation, and memory cost that does not grow with the archive.
    //
    // The cost, stated rather than hidden: two files, and a learner who keeps only
    // one. That is why every message about either file names the other, and why
    // the container's header names the data file it was written beside.
    //
    // A restore of recordings is ADDITIVE, unlike the localStorage restore above,
    // which is a replacement. See importRecordingsFromFile() for why: a
    // replacement would have to empty the archive before writing it back, and a
    // failure after that point would cost the learner both copies.

    const RECORDINGS_KIND = 'learner-recordings-export';

    // Version of the CONTAINER, independent of FORMAT_VERSION (the data file's
    // envelope) and of BlobStore.DB_VERSION (IndexedDB's own object-store shape).
    // Three different things; none of them is ever compared with another.
    const RECORDINGS_FORMAT_VERSION = 1;

    // The container's fixed-width first line: magic + version + ':' + a
    // zero-padded decimal header length + '\n'. Fixed width so the header can be
    // found with one slice of known bounds rather than by scanning for a
    // delimiter, which would mean reading bytes to find out where the bytes are.
    const RECORDINGS_MAGIC = 'ENGPORTAL-REC';
    const RECORDINGS_LENGTH_DIGITS = 10;
    const RECORDINGS_PREFIX_BYTES =
        RECORDINGS_MAGIC.length + String(RECORDINGS_FORMAT_VERSION).length + 1 +
        RECORDINGS_LENGTH_DIGITS + 1;

    const RECORDINGS_MIME = 'application/octet-stream';

    // The header is the only part read as text, so it is the only part with a
    // memory cost that depends on the file. 1MB is ~4000 entries' worth of
    // metadata, far past MAX_RECORDINGS_ENTRIES, and it stops a hostile file from
    // declaring a 300MB "header".
    const MAX_RECORDINGS_HEADER_BYTES = 1024 * 1024;

    // The archive's own cap is BlobStore.MAX_TOTAL_BYTES (50MB), so a store this
    // app wrote can never exceed it. This ceiling therefore only fires on an
    // archive that grew past its own policy — stranded or foreign rows (US-228) —
    // and when it fires it REFUSES, naming the number, rather than writing a file
    // that silently holds some of the recordings. Read from BlobStore when it is
    // loaded so there is one number, not two that can drift.
    const DEFAULT_MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;

    // A cap on rows, not bytes: 50MB of 2KB recordings is 25,000 entries, whose
    // metadata alone would blow MAX_RECORDINGS_HEADER_BYTES. 500 is twice
    // blobstore.js's own realistic figure (~250 rows at 200KB).
    const MAX_RECORDINGS_ENTRIES = 500;

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
        // US-138. "Anything saved here that the file does not contain is removed"
        // is true of localStorage and NOT of the recording archive, which lives in
        // a different store and is not touched by a restore. A learner who has
        // just read the general rule will assume it covers their recordings, so
        // the exception is stated rather than left to be discovered.
        importConfirmRecordingsKept: 'Your recordings are not part of this. They are kept separately on this device, so restoring this file neither removes them nor changes them.',
        importConfirmRecordingsNotInFile: 'This file lists recordings but does not contain the audio, so restoring it cannot bring those back. The separate recordings file does that.',
        importConfirmRecordingsUnreadable: 'This file has something in it about recordings that this version of the app cannot read. Your recordings on this device are not affected either way.',
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
        resetUnverified: 'The review history may not have been cleared — this device stopped answering part way. Reload the page to see where things stand.',

        // ------------------------------------------------------------------
        // The recording archive (US-138)
        // ------------------------------------------------------------------
        //
        // The rule every one of these obeys: the export must never claim to
        // contain something it does not, and a learner must be able to tell from
        // the file or from this screen what they are actually holding. Where a
        // count or a size belongs in a sentence, the sentence is built by a
        // function below (recordingsExcludedNote, tooLargeNote) rather than
        // stored here with a placeholder, so no message can ever be shown with
        // the placeholder still in it.

        // Inside the data file itself, so a human reading the JSON learns this
        // without being told by a screen they no longer have in front of them.
        manifestNote: 'This file does NOT contain your recordings. Audio cannot be stored inside it. The recordings listed here are described only — their audio is in the separate recordings file named in companionFile, saved from the same screen.',
        manifestUnavailableNote: 'This device could not open its recording storage when this file was saved, so this app does not know whether there are any recordings. There are none in this file either way.',

        // Said beside a successful data-file export, when the archive holds
        // something. Never said when this app knows the archive is empty, and
        // never said when there is no recording storage on the device at all.
        exportRecordingsElsewhere: 'Audio cannot go inside that file, so your recordings are not in it. Save them as a second file with "Save my recordings", and keep the two files together.',
        // The same fact on a build whose Dashboard has no control for it yet.
        // Alarming on purpose: it is the one situation where recordings really
        // cannot be got off the device, and saying nothing would be the lie.
        exportRecordingsNoControl: 'Audio cannot go inside that file, so your recordings are not in it — and this screen has no control for saving them yet. Your recordings are still only on this device.',
        exportRecordingsUnknown: 'This app has not been able to check your recordings yet, so it cannot say whether that file leaves any behind. Nothing in it is wrong; it simply does not include audio.',

        recordingsExportOk: 'Saved. That second file holds your recordings. Keep it next to the data file — neither one restores the other.',
        recordingsExportNone: 'There are no recordings saved on this device, so there is nothing to put in a file.',
        // NOT recordingsExportNone. The archive says it holds recordings and not
        // one of them could be read, which is a device problem, not an empty
        // archive — and telling a learner they have no recordings when they have
        // three is the overstatement `BR-3` forbids, in the worst possible place.
        recordingsExportUnreadable: 'There are recordings on this device, but none of them could be read just now, so no file has been saved. Nothing has been deleted — they are still here. Reload the page and try again.',
        recordingsExportUnavailable: 'This browser will not let the app keep recordings, so there are none on this device to save. Your data file is unaffected.',
        recordingsExportFailed: 'Your recordings could not be saved to a file. Nothing on this device has changed and no recording has been deleted.',
        // Some rows could not be read back. The file is still written, and it says
        // how many it holds — it must never be presented as the whole archive.
        recordingsExportPartial: 'Saved, but not all of it. Some recordings could not be read from this device and are not in that file. Nothing has been deleted — they are still here. Keep this file, and try again to save the rest.',

        recordingsEmptyFile: 'That file is empty. Nothing has changed.',
        recordingsNotMine: 'That file is not a recordings file saved by this app. Nothing has changed.',
        recordingsDamaged: 'That recordings file is damaged, so nothing in it was restored. Nothing has changed.',
        recordingsIncomplete: 'That recordings file looks incomplete — part of it is missing — so nothing in it was restored. Nothing has changed.',
        recordingsFutureFile: 'That recordings file was saved by a newer version of this app, so this version cannot read it safely. Update this app, or restore it on the device that made it. Nothing has changed.',
        recordingsReadFailed: 'That recordings file could not be read. Nothing has changed.',
        recordingsUnavailable: 'This browser will not let the app keep recordings, so they cannot be restored here. Nothing has changed, and that file still holds every one of them — restore it on a device that can keep recordings.',

        // Additive, not a replacement — see importRecordingsFromFile().
        recordingsImportConfirm: 'Restoring recordings ADDS them to this device. Nothing already saved here is deleted. A recording already on this device is recognised and left alone, so restoring the same file twice changes nothing the second time.\n\nEach prompt keeps your first recording and your two most recent, so adding older recordings to a prompt that already has three may push out an in-between one. Your first recording at a prompt is never pushed out.\n\nContinue?',
        recordingsImportOk: 'Restored. Your recordings are back on this device and you can play them from the exercise they belong to.',
        recordingsImportNothingNew: 'Every recording in that file is already on this device, so nothing was changed and nothing was added twice.',
        recordingsImportNoneRestored: 'None of the recordings in that file could be put back on this device. Nothing has been deleted, and the file still holds all of them — free up some room and try again.',
        // Partial: says what landed, what did not, and that the file is still the
        // recovery copy for the remainder. `BR-3` — no round number for a partial.
        recordingsImportSomeFailed: 'Some of your recordings were restored and some were not. Nothing has been deleted, and that file still holds every one of them, so restoring it again after freeing up room will bring back the rest.',
        // The one refusal that is about this app rather than the file or the
        // device: the store would re-date every restored recording to today,
        // which destroys the month-one-against-month-three comparison the
        // archive exists for. Better to restore nothing than to hand back a
        // recording with the wrong date on it.
        recordingsImportUnsupported: 'This version of the app cannot put recordings back with their original dates, and a recording dated wrongly is no use for hearing how you have changed. Nothing has been restored and nothing has been deleted. Update this app and restore that file again — it still holds every recording.',

        // Both artefacts above are written synchronously; these two are not, and a
        // learner on a 3GB Android device reading 50MB out of IndexedDB needs to
        // be told the button worked. Present tense, no percentage: a progress
        // figure this module cannot actually measure would be its own small lie.
        recordingsExportBusy: 'Saving your recordings…',
        recordingsImportBusy: 'Restoring your recordings…'
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

        // Recordings (US-138). Said only when there is something true to say:
        // either this file describes some, or this device is KNOWN to hold some.
        // On a device where nothing has ever been recorded, and for a file that
        // makes no claim either way, silence is the honest answer.
        const manifest = (plan && plan.recordings) || null;
        const known = archiveCache;
        if (manifest && manifest.absent === false && manifest.readable === false) {
            parts.push(MESSAGES.importConfirmRecordingsUnreadable);
        } else if (manifest && manifest.readable && manifest.count > 0) {
            parts.push(MESSAGES.importConfirmRecordingsNotInFile);
            parts.push(MESSAGES.importConfirmRecordingsKept);
        } else if (known && known.available === true && known.count > 0) {
            parts.push(MESSAGES.importConfirmRecordingsKept);
        }

        parts.push(MESSAGES.importConfirmTail);
        return parts.join('\n\n');
    }

    // ------------------------------------------------------------------
    // Reading the recording archive (US-138, over FR-DATA-6)
    // ------------------------------------------------------------------
    //
    // Everything in this section goes through window.BlobStore and NEVER touches
    // IndexedDB itself. blobstore.js owns that store, and a second
    // implementation of its schema in this file is the defect US-222 is named
    // after: two copies of one rule eventually disagree, and then the answer
    // depends on which one you asked.
    //
    // blobstore.js guarantees that no public method of it rejects. This section
    // still wraps every call, because a MISSING or PARTIAL BlobStore — an old
    // service-worker cache that has index.html without js/core/blobstore.js, a
    // future refactor — is not covered by that guarantee, and an export must
    // never fail because of it.

    function blobStore() {
        try {
            return global.BlobStore || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * SYNCHRONOUS and cheap: can this device hold recordings at all?
     *
     * The point of asking synchronously is that a `false` here means "there is
     * no archive to leave behind", which is what lets exportToFile() say plain
     * "Saved." without a caveat and without waiting on a promise. A `true` only
     * means the API is there — available() is the real question, and it is async.
     */
    function archivePossible() {
        const store = blobStore();
        if (!store || typeof store.isSupported !== 'function') return false;
        try {
            return !!store.isSupported();
        } catch (e) {
            return false;
        }
    }

    function maxArchiveBytes() {
        const store = blobStore();
        const fromStore = store && Number(store.MAX_TOTAL_BYTES);
        return (isFinite(fromStore) && fromStore > 0) ? fromStore : DEFAULT_MAX_ARCHIVE_BYTES;
    }

    // There is deliberately NO per-entry size cap on this side. An entry bigger
    // than BlobStore.MAX_RECORDING_BYTES is refused by put() itself, with put()'s
    // own `too-large` message and the number the learner can act on, and it is
    // reported as ONE failed entry rather than as a refused file — so the other
    // eighty-nine recordings in the file still come back. A second copy of that
    // rule here would be a second chance to disagree with it (US-222).


    /** A recordings file this app could have written can never be bigger than this. */
    function maxRecordingsImportBytes() {
        return maxArchiveBytes() + MAX_RECORDINGS_HEADER_BYTES + RECORDINGS_PREFIX_BYTES;
    }

    /**
     * The archive as a summary, for the data file's manifest and for the copy on
     * the Dashboard. NEVER rejects, and never throws: an unreachable archive is
     * reported as `available:false`, which is a fact, rather than as an error the
     * export has to survive.
     *
     * `available:false` and `count:0` are deliberately DIFFERENT answers.
     * "There are no recordings" and "this app could not look" are not the same
     * thing to a learner deciding whether it is safe to wipe their phone, and the
     * manifest carries whichever one is true (`BR-3`).
     */
    function archiveSummary() {
        const unavailable = {
            available: false,
            count: 0,
            promptCount: 0,
            bytes: 0,
            strandedCount: 0,
            strandedBytes: 0,
            prompts: [],
            capturedAt: new Date().toISOString()
        };

        const store = blobStore();
        if (!store || typeof store.usage !== 'function' || !archivePossible()) {
            return Promise.resolve(unavailable);
        }

        return Promise.resolve()
            .then(function () { return store.usage(); })
            .then(function (usage) {
                if (!usage || usage.available !== true) return unavailable;
                const listPrompts = (typeof store.prompts === 'function')
                    ? Promise.resolve().then(function () { return store.prompts(); })
                        .catch(function (e) { logError(e, 'archive prompts'); return []; })
                    : Promise.resolve([]);
                return listPrompts.then(function (rows) {
                    return {
                        available: true,
                        count: Number(usage.count) || 0,
                        promptCount: Number(usage.promptCount) || 0,
                        bytes: Number(usage.bytes) || 0,
                        strandedCount: Number(usage.strandedCount) || 0,
                        strandedBytes: Number(usage.strandedBytes) || 0,
                        prompts: (rows || []).map(function (p) {
                            return {
                                promptId: String(p && p.promptId),
                                count: Number(p && p.count) || 0,
                                bytes: Number(p && p.bytes) || 0,
                                oldestAt: isFinite(p && p.oldestAt) ? p.oldestAt : null,
                                newestAt: isFinite(p && p.newestAt) ? p.newestAt : null
                            };
                        }),
                        capturedAt: new Date().toISOString()
                    };
                });
            })
            .catch(function (e) {
                logError(e, 'archive summary');
                return unavailable;
            });
    }

    /**
     * The last archiveSummary() this module took, or null if it has never been
     * able to take one.
     *
     * It exists because exportToFile(), importConfirmMessage() and the Dashboard's
     * usage line are all SYNCHRONOUS and the archive is not. Making any of them
     * async would change the contract of a method the whole export path is built
     * on, for a number that is a caveat rather than the payload.
     *
     * Every reading of it is guarded by `available === true`, so a stale or absent
     * cache degrades to "this app has not checked", never to "there are none" —
     * which is the only way a cache can be used here without lying (`BR-3`).
     */
    let archiveCache = null;

    /** Take a fresh summary and cache it. Resolves the summary; never rejects. */
    function refreshArchive() {
        return archiveSummary().then(function (summary) {
            archiveCache = summary;
            return summary;
        });
    }

    function cachedArchive() {
        return archiveCache;
    }

    /** TEST SEAM, and the one thing a caller may do to the cache besides read it. */
    function _setArchiveCache(summary) {
        archiveCache = summary || null;
        return archiveCache;
    }

    /**
     * The `recordings` block inside a data-file export.
     *
     * `audioIncluded: false` is written EVERY time and is never computed. It is
     * the honesty rule as a field: this artefact never carries audio, so a reader
     * — human or a future build — can tell what it is holding without knowing
     * anything about which version wrote it.
     *
     * Stamped with `recordingsFormat` rather than by bumping the envelope's
     * FORMAT_VERSION, because a build that predates this block reads the file
     * correctly by IGNORING it, and bumping FORMAT_VERSION would make every new
     * export unreadable to every deployed build (validateExport refuses
     * `format > FORMAT_VERSION`). Same reasoning as blobstore.js's RECORD_VERSION
     * against its DB_VERSION: adding a field is not a change of shape.
     */
    function recordingsManifest(archive, date) {
        if (!archive) return null;
        const manifest = {
            recordingsFormat: RECORDINGS_FORMAT_VERSION,
            audioIncluded: false,
            archiveReadable: archive.available === true,
            count: archive.available === true ? archive.count : 0,
            promptCount: archive.available === true ? archive.promptCount : 0,
            bytes: archive.available === true ? archive.bytes : 0,
            capturedAt: typeof archive.capturedAt === 'string' ? archive.capturedAt : null,
            companionFile: recordingsFileName(date),
            note: archive.available === true ? MESSAGES.manifestNote : MESSAGES.manifestUnavailableNote
        };
        if (archive.available === true) {
            if (archive.strandedCount) {
                manifest.unreadableCount = archive.strandedCount;
                manifest.unreadableBytes = archive.strandedBytes;
            }
            manifest.prompts = (archive.prompts || []).slice();
        }
        return manifest;
    }


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

    /**
     * The export envelope.
     *
     * @param {Object} [archive] - An archiveSummary() result. When given, the
     *        envelope additionally carries the `recordings` manifest. Omitted, the
     *        envelope is byte-for-byte what it has always been — which is why
     *        every existing caller and every round-trip proof is untouched by
     *        US-138, and why the manifest can never make an export WAIT on
     *        IndexedDB. The absence of `recordings` therefore means "written
     *        without asking the archive", which is honestly different from
     *        `recordings.count === 0`.
     */
    function buildExport(archive) {
        const data = snapshot();
        const keys = Object.keys(data);
        const envelope = {
            app: APP_ID,
            kind: KIND,
            formatVersion: FORMAT_VERSION,
            schemaVersion: exportSchemaVersion(data[PROGRESS_KEY]),
            exportedAt: new Date().toISOString(),
            keyCount: keys.length,
            data: data
        };
        const manifest = recordingsManifest(archive);
        if (manifest) envelope.recordings = manifest;
        return envelope;
    }

    function dateStamp(date) {
        const d = date || new Date();
        const pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function exportFileName(date) {
        return 'english-portal-data-' + dateStamp(date) + '.json';
    }

    /**
     * The companion file's name. Deliberately shares the date stamp with
     * exportFileName(), so a learner with a downloads folder full of both can see
     * at a glance which two belong together — the pairing has to survive being
     * looked at a month later, not just being described once on screen.
     */
    function recordingsFileName(date) {
        return 'english-portal-recordings-' + dateStamp(date) + '.enrec';
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
     * Hand a Blob to the browser as a download. Shared by both artefacts, so the
     * object-URL lifecycle is written once: revoked on the NEXT turn on success
     * (some browsers have not finished reading the blob when click() returns, and
     * revoking early cancels the download) and revoked immediately on failure, so
     * a failed export cannot leak a blob url for the life of the tab.
     *
     * Throws on failure rather than returning a code: both callers already have a
     * catch that owns the learner-facing message, and two of them would be two
     * chances to word the same failure differently.
     */
    function downloadBlob(blob, fileName) {
        let url = null;
        try {
            url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.rel = 'noopener';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(function () {
                try { URL.revokeObjectURL(url); } catch (e) { /* already gone */ }
            }, 0);

            return { fileName: a.download };
        } catch (e) {
            if (url) {
                try { URL.revokeObjectURL(url); } catch (ignored) { /* ignore */ }
            }
            throw e;
        }
    }

    /**
     * One learner action, one file. Blob + object URL, no library, no network —
     * CON-5 leaves nothing else on the table anyway.
     *
     * @param {Object} [archive] - archiveSummary() result. Passed straight to
     *        buildExport(); see there for why it is optional. The returned
     *        `recordings` / `archiveKnown` / `recordingsMessage` are the facts a
     *        caller needs to say what this file does NOT contain, which is the
     *        whole of US-138's honesty rule on this side.
     */
    function exportToFile(archive) {
        try {
            const payload = buildExport(archive);
            // Pretty-printed: FR-DATA-4 exists partly so a beta tester can send
            // numbers deliberately, and a human has to be able to read them.
            const text = JSON.stringify(payload, null, 2);
            const blob = new Blob([text], { type: 'application/json' });
            const download = downloadBlob(blob, exportFileName());

            const restorable = isRestorableExport(payload.data);
            const manifest = payload.recordings || null;
            return {
                ok: true,
                keyCount: payload.keyCount,
                bytes: byteLength(text),
                fileName: download.fileName,
                restorable: restorable,
                // null means "this export never asked the archive", which is not
                // the same claim as "there are no recordings".
                recordings: manifest,
                archiveKnown: !!manifest,
                // The sentence a caller should show BESIDE `message` when this
                // file leaves recordings behind. null when there is nothing to
                // say, so a caller cannot accidentally warn about an empty
                // archive.
                recordingsMessage: (manifest && manifest.count > 0)
                    ? MESSAGES.exportRecordingsElsewhere
                    : null,
                message: restorable ? MESSAGES.exportOk : MESSAGES.exportOkNotRestorable
            };
        } catch (e) {
            logError(e, 'export learner data');
            return { ok: false, code: 'export-failed', message: MESSAGES.exportFailed };
        }
    }

    /**
     * The data file, with the archive actually consulted first. This is what the
     * Dashboard button uses, and the only path that produces a manifest.
     *
     * Never rejects: archiveSummary() resolves an `available:false` summary for
     * every way an archive can be unreachable, so an export can never be lost to
     * a storage failure that has nothing to do with localStorage.
     */
    function exportAll() {
        // No rejection handler, on purpose: archiveSummary() catches every way an
        // archive can fail and resolves an `available:false` summary instead, and
        // its suite asserts that. A `.catch` here would be an unreachable guard
        // that reads as though the risk were live — the same dead-branch problem
        // US-221 removed from blobstore.js rather than reordered around.
        return archiveSummary().then(function (archive) {
            return exportToFile(archive);
        });
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
     * The `recordings` manifest a data file may carry, read for REPORTING only.
     *
     * This can never refuse a file. A manifest is informational — the audio was
     * never in this artefact and the localStorage payload does not depend on it —
     * so refusing an otherwise-good file over a malformed manifest would cost a
     * learner their progress to protect them from a wrong number. A manifest this
     * build cannot read is reported as `readable:false`, which is what the confirm
     * copy then says.
     *
     * `absent:true` (no manifest at all) is deliberately distinct from
     * `count:0`: a file written before US-138, or by buildExport() with no
     * archive summary, makes no claim about recordings either way, and inventing
     * "there were none" from silence is exactly the overstatement `BR-3` forbids.
     */
    function readManifest(parsed) {
        if (!hasOwn(parsed, 'recordings')) {
            return { absent: true, readable: false, count: 0, audioIncluded: false };
        }
        const raw = parsed.recordings;
        if (!isPlainObject(raw) || raw.audioIncluded === true) {
            // `audioIncluded: true` can only come from a build that puts audio in
            // this artefact. This one cannot read it, so it must not pretend the
            // block is a manifest it understands.
            return { absent: false, readable: false, count: 0, audioIncluded: raw && raw.audioIncluded === true };
        }
        const count = Number(raw.count);
        const bytes = Number(raw.bytes);
        return {
            absent: false,
            readable: true,
            audioIncluded: false,
            archiveReadable: raw.archiveReadable === true,
            recordingsFormat: Number(raw.recordingsFormat) || null,
            count: isFinite(count) && count >= 0 ? count : 0,
            promptCount: Number(raw.promptCount) || 0,
            bytes: isFinite(bytes) && bytes >= 0 ? bytes : 0,
            capturedAt: typeof raw.capturedAt === 'string' ? raw.capturedAt : null,
            companionFile: typeof raw.companionFile === 'string' ? raw.companionFile : null,
            prompts: Array.isArray(raw.prompts) ? raw.prompts : []
        };
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
                exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
                // Never a reason to refuse; see readManifest().
                recordings: readManifest(parsed)
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
    // The recordings container (US-138 / FR-DATA-4 over FR-SPK-6)
    // ------------------------------------------------------------------
    //
    // LAYOUT, and why it is this and not JSON:
    //
    //   ENGPORTAL-REC1:0000001234\n     fixed 26 ASCII bytes
    //   { ...header JSON, ASCII only... }   exactly 1234 bytes
    //   <payload 1><payload 2>...           back to back, in `entries` order
    //
    // Every property here exists to keep memory flat on the device NFR-6 names
    // as the floor:
    //
    //   - The header is ASCII-ONLY (asciiJson escapes every non-ASCII character),
    //     so its BYTE length equals its JavaScript string length. The offsets are
    //     therefore exact without a TextEncoder, which matters because
    //     jest-environment-jsdom has none and a real WebView may not either — and
    //     an offset that is right in one environment and wrong in another is a
    //     silently corrupted archive.
    //   - The length is a FIXED-WIDTH prefix, not a delimiter, so the header is
    //     found with one slice of known bounds. Scanning for a delimiter means
    //     reading bytes to discover where the bytes are.
    //   - Writing is `new Blob([prefix, json, blobA, blobB, ...])`, which
    //     concatenates by reference: the payload bytes are never a JavaScript
    //     string or an ArrayBuffer. A 50MB archive costs the header.
    //   - Reading is `file.slice(start, end)`, which is also by reference: a
    //     payload is handed to BlobStore.put() without ever being read here.
    //     Only the header is read as text.
    //
    // The cost, stated: the file is not human-readable. That is exactly why the
    // DATA file carries the manifest — the readable artefact is where a learner
    // finds out what exists, and only the audio itself is opaque.

    /**
     * JSON with every non-ASCII character escaped, so `string.length === bytes`.
     * A lone surrogate survives it — `\uD800` is legal JSON and parses back to
     * the same lone code unit — which matters because a `label` comes from
     * content this module does not control.
     */
    function asciiJson(value) {
        return JSON.stringify(value).replace(/[\u007f-\uffff]/g, function (ch) {
            return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
        });
    }

    function padLeft(value, width) {
        let s = String(value);
        while (s.length < width) s = '0' + s;
        return s;
    }

    function recordingsPrefix(headerBytes) {
        return RECORDINGS_MAGIC + RECORDINGS_FORMAT_VERSION + ':' +
               padLeft(headerBytes, RECORDINGS_LENGTH_DIGITS) + '\n';
    }

    function mbText(bytes) {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * The refusal for an archive too big to put in one file. Built rather than
     * stored, so the number a learner is asked to act on is always the real one.
     */
    function recordingsTooLargeMessage(bytes, limit) {
        return 'Your recordings come to ' + mbText(bytes) + ', which is more than this app ' +
               'will put in one file (' + mbText(limit) + '). Nothing has been saved and nothing ' +
               'has been deleted. Delete a few recordings you no longer need, then try again.';
    }

    function recordingsTooManyMessage(count, limit) {
        return 'There are ' + count + ' recordings on this device, which is more than this app ' +
               'will put in one file (' + limit + '). Nothing has been saved and nothing has been ' +
               'deleted. Delete a few recordings you no longer need, then try again.';
    }

    function recordingsFileTooLargeMessage(bytes, limit) {
        return 'That file is ' + mbText(bytes) + ', which is larger than this app can hold in its ' +
               'recording storage (' + mbText(limit) + '), so it cannot be restored here — not even ' +
               'part of it, because a part of an archive is not an archive. Nothing has changed.';
    }

    function blobSizeOf(blob) {
        // Duck-typed for the same reason blobstore.js is: `instanceof Blob` is
        // false across realms, and MediaRecorder output in some webviews is a
        // File.
        if (!blob || typeof blob !== 'object') return null;
        const size = blob.size;
        if (typeof size !== 'number' || !isFinite(size) || size < 0) return null;
        return size;
    }

    function sliceOf(file, start, end, contentType) {
        if (!file || typeof file.slice !== 'function') return null;
        try {
            // The third argument is not decoration: the slice's own `type` is what
            // the browser uses when the recording is played back through an object
            // url, so a payload cut out of the container with no type would be
            // stored, listed and then silently unplayable. The container is one
            // `application/octet-stream` blob; the recordings inside it are not.
            return contentType ? file.slice(start, end, contentType) : file.slice(start, end);
        } catch (e) {
            logError(e, 'recordings slice');
            return null;
        }
    }

    /**
     * A Blob as text. Prefers Blob.prototype.text(), falls back to FileReader,
     * which is what jsdom and older WebViews have. Rejects rather than resolving
     * a wrong answer: a header we could not read must not be treated as a header
     * that said nothing.
     */
    function readBlobText(blob) {
        return new Promise(function (resolve, reject) {
            if (!blob) {
                reject(new Error('nothing to read'));
                return;
            }
            if (typeof blob.text === 'function') {
                let pending;
                try {
                    pending = blob.text();
                } catch (e) {
                    reject(e);
                    return;
                }
                Promise.resolve(pending).then(function (text) {
                    resolve(String(text == null ? '' : text));
                }, reject);
                return;
            }
            let reader;
            try {
                reader = new FileReader();
            } catch (e) {
                reject(e);
                return;
            }
            reader.onload = function () {
                resolve(String(reader.result == null ? '' : reader.result));
            };
            reader.onerror = function () {
                reject(reader.error || new Error('read failed'));
            };
            try {
                reader.readAsText(blob);
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Every recording on this device, oldest first within each prompt, with its
     * payload — or a refusal.
     *
     * Refuses BEFORE reading any payload when the archive is over either ceiling,
     * so an oversized archive costs nothing and, in particular, produces no
     * half-file. Never truncates: "some of your recordings" in a file called
     * `english-portal-recordings-<date>` is a backup that will be trusted and is
     * not one.
     *
     * `entries[i].bytes` is the payload's OWN size, not the metadata row's
     * `size` field. The row's size is advisory (blobstore.js says so, and
     * strandedSummary() reports what a row merely CLAIMS); the offsets in this
     * container have to be facts.
     */
    function collectRecordings() {
        const store = blobStore();
        const usable = store &&
            typeof store.prompts === 'function' &&
            typeof store.list === 'function' &&
            typeof store.get === 'function';
        if (!usable || !archivePossible()) {
            return Promise.resolve(reject('recordings-unavailable', MESSAGES.recordingsExportUnavailable));
        }

        return archiveSummary().then(function (archive) {
            if (archive.available !== true) {
                return reject('recordings-unavailable', MESSAGES.recordingsExportUnavailable);
            }
            if (archive.count === 0) {
                return reject('no-recordings', MESSAGES.recordingsExportNone);
            }
            const limit = maxArchiveBytes();
            if (archive.bytes > limit) {
                return reject('too-large', recordingsTooLargeMessage(archive.bytes, limit));
            }
            if (archive.count > MAX_RECORDINGS_ENTRIES) {
                return reject('too-many', recordingsTooManyMessage(archive.count, MAX_RECORDINGS_ENTRIES));
            }

            // One list() per prompt, chained rather than parallel: 250 concurrent
            // IndexedDB transactions on a mid-range phone is how a "quick export"
            // becomes a visible stall.
            const promptIds = archive.prompts.map(function (p) { return p.promptId; });
            const rows = [];
            const chain = promptIds.reduce(function (previous, promptId) {
                return previous.then(function () {
                    return Promise.resolve()
                        .then(function () { return store.list(promptId); })
                        .then(function (found) {
                            (found || []).forEach(function (record) { rows.push(record); });
                        }, function (e) {
                            logError(e, 'recordings list');
                        });
                });
            }, Promise.resolve());

            return chain.then(function () {
                // Deterministic file order: grouped by prompt, oldest first inside
                // each. The importer re-sorts by date regardless, but a file whose
                // bytes depend on enumeration order cannot be compared between two
                // exports of the same archive.
                rows.sort(function (a, b) {
                    if (a.promptId !== b.promptId) return a.promptId < b.promptId ? -1 : 1;
                    return (a.createdAt - b.createdAt) || (a.id - b.id);
                });

                const entries = [];
                const blobs = [];
                let missed = 0;
                let bytes = 0;

                const reads = rows.reduce(function (previous, record) {
                    return previous.then(function (stop) {
                        if (stop) return stop;
                        return Promise.resolve()
                            .then(function () { return store.get(record.id); })
                            .catch(function (e) {
                                logError(e, 'recordings read');
                                return null;
                            })
                            .then(function (full) {
                                const size = full && blobSizeOf(full.blob);
                                if (size === null || size === undefined) {
                                    // Deleted between the ledger read and now, or
                                    // an orphan row. Counted, never invented.
                                    missed += 1;
                                    return false;
                                }
                                if (bytes + size > limit) {
                                    // The archive grew while we were reading it.
                                    // Stop and refuse rather than write a file
                                    // holding an arbitrary prefix of it.
                                    return { over: bytes + size };
                                }
                                bytes += size;
                                entries.push({
                                    promptId: record.promptId,
                                    createdAt: record.createdAt,
                                    bytes: size,
                                    mimeType: record.mimeType || null,
                                    durationMs: typeof record.durationMs === 'number' ? record.durationMs : null,
                                    baseline: record.baseline === true,
                                    label: record.label || null
                                });
                                blobs.push(full.blob);
                                return false;
                            });
                    });
                }, Promise.resolve(false));

                return reads.then(function (stopped) {
                    if (stopped && stopped.over) {
                        return reject('too-large', recordingsTooLargeMessage(stopped.over, limit));
                    }
                    if (entries.length === 0) {
                        // The archive said it held something and nothing came back:
                        // a DEVICE problem, not an empty archive. There is no
                        // `no-recordings` branch here — `archive.count === 0`
                        // already returned above, so reaching this point means the
                        // ledger promised recordings, and telling a learner they
                        // have none when they have three is the overstatement
                        // `BR-3` forbids, in the worst possible place.
                        return reject('recordings-unreadable', MESSAGES.recordingsExportUnreadable);
                    }
                    const prompts = {};
                    entries.forEach(function (e) { prompts[e.promptId] = true; });
                    return {
                        ok: true,
                        entries: entries,
                        blobs: blobs,
                        bytes: bytes,
                        // Measured against the LEDGER, not only against the reads
                        // that failed. A prompt whose list() failed contributes no
                        // rows at all, so counting only `missed` would let a file
                        // that is short a whole prompt's recordings stamp itself
                        // `complete: true` — the one claim in this container a
                        // learner would rely on a year later.
                        missed: Math.max(missed, archive.count - entries.length),
                        promptCount: Object.keys(prompts).length
                    };
                });
            });
        });
    }

    /**
     * The companion file. Resolves { ok:true, ... } or { ok:false, code, message }
     * and NEVER rejects, so a Dashboard button can await it without a catch.
     *
     * The header is written from `collected.entries` — the recordings actually
     * read — so the file cannot describe a payload it does not carry. `missed`
     * counts rows that could not be read, and a file with any of them is reported
     * as partial rather than as a backup.
     */
    function exportRecordingsToFile() {
        return collectRecordings().then(function (collected) {
            if (!collected.ok) return collected;
            try {
                const date = new Date();
                const header = {
                    app: APP_ID,
                    kind: RECORDINGS_KIND,
                    formatVersion: RECORDINGS_FORMAT_VERSION,
                    exportedAt: date.toISOString(),
                    // Names its pair, so the two files can be reunited from the
                    // file itself and not only from a message on a screen.
                    companionFile: exportFileName(date),
                    count: collected.entries.length,
                    bytes: collected.bytes,
                    promptCount: collected.promptCount,
                    // Honest even here: a partial file says so in its own header.
                    complete: collected.missed === 0,
                    unreadCount: collected.missed,
                    entries: collected.entries
                };
                const json = asciiJson(header);
                if (json.length > MAX_RECORDINGS_HEADER_BYTES) {
                    return reject('too-many', recordingsTooManyMessage(header.count, MAX_RECORDINGS_ENTRIES));
                }
                const blob = new Blob([recordingsPrefix(json.length), json].concat(collected.blobs),
                    { type: RECORDINGS_MIME });
                const download = downloadBlob(blob, recordingsFileName(date));
                return {
                    ok: true,
                    fileName: download.fileName,
                    companionFile: header.companionFile,
                    count: header.count,
                    bytes: collected.bytes,
                    totalBytes: blobSizeOf(blob),
                    headerBytes: json.length,
                    promptCount: collected.promptCount,
                    missed: collected.missed,
                    complete: collected.missed === 0,
                    message: collected.missed === 0
                        ? MESSAGES.recordingsExportOk
                        : MESSAGES.recordingsExportPartial
                };
            } catch (e) {
                logError(e, 'export recordings');
                return reject('export-failed', MESSAGES.recordingsExportFailed);
            }
        }).catch(function (e) {
            // .catch, not a sibling handler: see readRecordingsFile().
            logError(e, 'export recordings');
            return reject('export-failed', MESSAGES.recordingsExportFailed);
        });
    }

    // ------------------------------------------------------------------
    // Reading a recordings file back
    // ------------------------------------------------------------------

    function isFiniteNumber(v) {
        return typeof v === 'number' && isFinite(v);
    }

    /**
     * Validate one header entry and turn it into a slice. Returns null for
     * anything this build will not act on — a file that fails here is refused
     * whole, before a single write, exactly as validateExport() refuses a data
     * file.
     *
     * Deliberately does NOT check that the payload fits inside the file. That is
     * a different fact with a different cause — a file that was cut short in
     * transit rather than a header that is wrong — and the caller reports it as
     * `incomplete` rather than as `damaged`, because "part of it is missing" is
     * what a learner can act on (copy it again) and "damaged" is not.
     */
    function readEntry(raw, offset) {
        if (!isPlainObject(raw)) return null;
        const promptId = raw.promptId;
        if (typeof promptId !== 'string' || promptId.length === 0 || promptId.length > 200) return null;
        if (!isFiniteNumber(raw.createdAt) || raw.createdAt < 0) return null;
        if (!isFiniteNumber(raw.bytes) || raw.bytes <= 0 || Math.floor(raw.bytes) !== raw.bytes) return null;
        if (raw.mimeType !== null && raw.mimeType !== undefined && typeof raw.mimeType !== 'string') return null;
        if (raw.durationMs !== null && raw.durationMs !== undefined && !isFiniteNumber(raw.durationMs)) return null;
        if (raw.label !== null && raw.label !== undefined && typeof raw.label !== 'string') return null;
        return {
            promptId: promptId,
            createdAt: raw.createdAt,
            bytes: raw.bytes,
            mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : null,
            durationMs: isFiniteNumber(raw.durationMs) ? raw.durationMs : null,
            baseline: raw.baseline === true,
            label: typeof raw.label === 'string' ? raw.label : null,
            start: offset,
            end: offset + raw.bytes
        };
    }

    /**
     * Everything a recordings file can be refused for, decided before anything is
     * written and without reading one payload byte.
     *
     * Resolves { ok:true, header, entries } or { ok:false, code, message }.
     * Never rejects.
     */
    function readRecordingsFile(file) {
        const size = blobSizeOf(file);
        if (size === null) {
            return Promise.resolve(reject('recordings-read-failed', MESSAGES.recordingsReadFailed));
        }
        if (size === 0) {
            return Promise.resolve(reject('recordings-empty', MESSAGES.recordingsEmptyFile));
        }
        if (size < RECORDINGS_PREFIX_BYTES + 2) {
            return Promise.resolve(reject('recordings-foreign', MESSAGES.recordingsNotMine));
        }
        const importLimit = maxRecordingsImportBytes();
        if (size > importLimit) {
            // Refuse, never truncate: this device's archive could not hold it, and
            // restoring an arbitrary prefix would produce an archive whose
            // baselines and dates are a subset nobody chose.
            return Promise.resolve(reject('recordings-too-large',
                recordingsFileTooLargeMessage(size, maxArchiveBytes())));
        }

        return readBlobText(sliceOf(file, 0, RECORDINGS_PREFIX_BYTES)).then(function (prefix) {
            if (prefix.length < RECORDINGS_PREFIX_BYTES ||
                prefix.slice(0, RECORDINGS_MAGIC.length) !== RECORDINGS_MAGIC) {
                return reject('recordings-foreign', MESSAGES.recordingsNotMine);
            }
            const rest = prefix.slice(RECORDINGS_MAGIC.length);
            const colon = rest.indexOf(':');
            if (colon <= 0) return reject('recordings-foreign', MESSAGES.recordingsNotMine);
            const version = Number(rest.slice(0, colon));
            if (!isFinite(version) || version < 1) {
                return reject('recordings-foreign', MESSAGES.recordingsNotMine);
            }
            // A newer container may nest or encode things this build cannot see.
            if (version > RECORDINGS_FORMAT_VERSION) {
                return reject('recordings-future-format', MESSAGES.recordingsFutureFile);
            }
            const digits = rest.slice(colon + 1, colon + 1 + RECORDINGS_LENGTH_DIGITS);
            if (!/^\d+$/.test(digits)) {
                return reject('recordings-foreign', MESSAGES.recordingsNotMine);
            }
            const headerBytes = Number(digits);
            if (headerBytes <= 0 || headerBytes > MAX_RECORDINGS_HEADER_BYTES) {
                return reject('recordings-damaged', MESSAGES.recordingsDamaged);
            }
            const headerEnd = RECORDINGS_PREFIX_BYTES + headerBytes;
            if (headerEnd > size) {
                return reject('recordings-incomplete', MESSAGES.recordingsIncomplete);
            }

            return readBlobText(sliceOf(file, RECORDINGS_PREFIX_BYTES, headerEnd)).then(function (json) {
                let header;
                try {
                    header = JSON.parse(json);
                } catch (e) {
                    return reject('recordings-damaged', MESSAGES.recordingsDamaged);
                }
                if (!isPlainObject(header)) {
                    return reject('recordings-foreign', MESSAGES.recordingsNotMine);
                }
                if (header.app !== APP_ID || header.kind !== RECORDINGS_KIND) {
                    return reject('recordings-foreign', MESSAGES.recordingsNotMine);
                }
                if (!Array.isArray(header.entries) || header.entries.length === 0) {
                    return reject('recordings-damaged', MESSAGES.recordingsDamaged);
                }
                if (header.entries.length > MAX_RECORDINGS_ENTRIES) {
                    return reject('recordings-too-large',
                        recordingsTooManyMessage(header.entries.length, MAX_RECORDINGS_ENTRIES));
                }
                if (hasOwn(header, 'count') && Number(header.count) !== header.entries.length) {
                    // The same truncation detector as the data file's keyCount.
                    return reject('recordings-incomplete', MESSAGES.recordingsIncomplete);
                }

                const entries = [];
                let offset = headerEnd;
                for (let i = 0; i < header.entries.length; i++) {
                    const entry = readEntry(header.entries[i], offset);
                    if (!entry) return reject('recordings-damaged', MESSAGES.recordingsDamaged);
                    // The payload the header promises is not all there: the file
                    // was cut short. Different fact, different advice.
                    if (entry.end > size) {
                        return reject('recordings-incomplete', MESSAGES.recordingsIncomplete);
                    }
                    entries.push(entry);
                    offset = entry.end;
                }
                // Bytes nobody declared. Not a truncation — a file with something
                // else appended, which this build will not guess about.
                if (offset !== size) {
                    return reject('recordings-damaged', MESSAGES.recordingsDamaged);
                }

                return { ok: true, header: header, entries: entries };
            });
        // ONE .catch rather than a rejection handler beside each success handler.
        // `.then(onOk, onErr)` does NOT catch a throw from onOk — onErr is its
        // sibling, not its successor — so the "never rejects" guarantee held only
        // for a read that failed and not for a success path that threw. Found by
        // "never rejects when handed a malformed pre-read".
        }).catch(function (e) {
            logError(e, 'recordings read');
            return reject('recordings-read-failed', MESSAGES.recordingsReadFailed);
        });
    }

    /**
     * The confirm copy for a recordings restore. Fixed, unlike the data file's:
     * a recordings restore removes nothing, so there is nothing device-specific
     * to warn about — which is itself the thing the copy has to say, because a
     * learner who has just read the data file's "anything not in this file is
     * removed" will assume the same rule here.
     */
    function recordingsConfirmMessage(read) {
        const count = (read && read.entries && read.entries.length) || 0;
        const prompts = {};
        ((read && read.entries) || []).forEach(function (e) { prompts[e.promptId] = true; });
        const promptCount = Object.keys(prompts).length;
        return 'That file holds ' + count + (count === 1 ? ' recording' : ' recordings') +
               ' from ' + promptCount + (promptCount === 1 ? ' prompt' : ' prompts') + '.\n\n' +
               MESSAGES.recordingsImportConfirm;
    }

    /**
     * Restore recordings from a companion file. Resolves; never rejects.
     *
     * THIS IS ADDITIVE, and that is the one place US-138 deliberately parts
     * company with importFromText() above. A restore of localStorage is a
     * replacement because localStorage can be snapshotted in memory and rolled
     * back. An archive cannot: the whole point of blobstore.js is that the blobs
     * are NOT in memory, so "empty the archive, then write the file's recordings
     * back" has a failure mode where the learner loses both copies at once, on
     * exactly the full device where the writes are most likely to fail. There is
     * no rollback() for blobs and this design does not need one:
     *
     *   - nothing is deleted by this method, so no failure of it can lose a
     *     recording the learner already had;
     *   - a recording already on this device is recognised by (promptId,
     *     createdAt, size) and skipped, so restoring the same file twice is a
     *     no-op rather than a duplicate;
     *   - each BlobStore.put() is its own transaction and blobstore.js guarantees
     *     a failed one loses nothing, so a partial restore is a set of successes
     *     and a set of untouched entries — never a half-written recording;
     *   - THE FILE IS THE RECOVERY COPY. A partial restore is completed by
     *     restoring the same file again, which is what the copy says.
     *
     * The one thing it will not do is restore a recording with the wrong date on
     * it. If BlobStore does not honour `meta.createdAt`, every restored recording
     * would be stamped today, and the month-one-against-month-three comparison
     * CURRICULUM.md Strand E.7 calls its strongest motivator would be destroyed
     * by the act of rescuing it. That is detected on the FIRST write — from the
     * record put() returns, not from a version flag that could be wrong — the
     * probe row is deleted again, and the whole restore is refused.
     */
    function importRecordingsFromFile(file, preRead) {
        const opened = (preRead && preRead.ok === true)
            // Already validated by the caller (handleRecordingsFile validates
            // before asking for confirmation, exactly as handleFile does), so the
            // header is not read and re-validated a second time.
            ? Promise.resolve(preRead)
            : readRecordingsFile(file);
        return opened.then(function (read) {
            if (!read.ok) return read;

            const store = blobStore();
            const usable = store &&
                typeof store.put === 'function' &&
                typeof store.list === 'function' &&
                typeof store.remove === 'function';
            if (!usable || !archivePossible()) {
                // No write of any kind has happened at this point.
                return reject('recordings-unavailable', MESSAGES.recordingsUnavailable);
            }

            const entries = read.entries.slice().sort(function (a, b) {
                // Oldest first, globally. Within a prompt that means the learner's
                // real first recording is written first, so a store that derives
                // the pinned baseline from insertion order still gets it right.
                return (a.createdAt - b.createdAt) ||
                       (a.promptId < b.promptId ? -1 : (a.promptId > b.promptId ? 1 : 0));
            });

            const promptIds = [];
            entries.forEach(function (e) {
                if (promptIds.indexOf(e.promptId) === -1) promptIds.push(e.promptId);
            });

            const alreadyHere = Object.create(null);
            const survey = promptIds.reduce(function (previous, promptId) {
                return previous.then(function () {
                    return Promise.resolve()
                        .then(function () { return store.list(promptId); })
                        .then(function (rows) {
                            (rows || []).forEach(function (r) {
                                alreadyHere[r.promptId + '|' + r.createdAt + '|' + r.size] = true;
                            });
                        }, function (e) {
                            // A prompt we could not survey is simply not deduped:
                            // the worst case is one duplicate recording, which the
                            // confirm copy warns about, and the alternative is
                            // refusing a restore over a failed read.
                            logError(e, 'recordings survey');
                        });
                });
            }, Promise.resolve());

            return survey.then(function () {
                const outcome = {
                    total: entries.length,
                    restored: 0,
                    skipped: 0,
                    failed: [],
                    evictedPrompts: [],
                    baselineKept: 0,
                    baselineNotPinned: 0,
                    unfaithful: null
                };
                let verified = false;

                const writes = entries.reduce(function (previous, entry) {
                    return previous.then(function () {
                        if (outcome.unfaithful) return null;   // aborted
                        if (alreadyHere[entry.promptId + '|' + entry.createdAt + '|' + entry.bytes]) {
                            outcome.skipped += 1;
                            return null;
                        }
                        const part = sliceOf(file, entry.start, entry.end, entry.mimeType);
                        if (!part) {
                            outcome.failed.push({
                                promptId: entry.promptId, createdAt: entry.createdAt,
                                code: 'read-failed', message: MESSAGES.recordingsReadFailed
                            });
                            return null;
                        }
                        return Promise.resolve()
                            .then(function () {
                                return store.put(entry.promptId, part, {
                                    mimeType: entry.mimeType,
                                    durationMs: entry.durationMs,
                                    label: entry.label,
                                    // Restore-only metadata. See the required
                                    // blobstore.js change in this story's notes:
                                    // without it the two fields below are ignored
                                    // and the check further down refuses the whole
                                    // restore rather than re-dating the archive.
                                    createdAt: entry.createdAt,
                                    baseline: entry.baseline
                                });
                            })
                            .catch(function (e) {
                                // BlobStore.put() is documented never to reject.
                                // This is here so a build where that stops being
                                // true costs one entry, not the restore.
                                logError(e, 'recordings put');
                                return reject('write-failed', MESSAGES.recordingsImportNoneRestored);
                            })
                            .then(function (result) {
                                if (!result || result.ok !== true) {
                                    outcome.failed.push({
                                        promptId: entry.promptId,
                                        createdAt: entry.createdAt,
                                        code: (result && result.code) || 'write-failed',
                                        message: (result && result.message) || MESSAGES.recordingsImportNoneRestored
                                    });
                                    return null;
                                }
                                const record = result.record || {};
                                if (!verified) {
                                    verified = true;
                                    if (record.createdAt !== entry.createdAt) {
                                        // The store re-dated it. Undo this one
                                        // write and refuse the rest.
                                        outcome.unfaithful = {
                                            id: record.id,
                                            wanted: entry.createdAt,
                                            got: record.createdAt
                                        };
                                        return null;
                                    }
                                }
                                outcome.restored += 1;
                                if (entry.baseline) {
                                    if (record.baseline === true) outcome.baselineKept += 1;
                                    // A baseline that did not land as a baseline
                                    // is NOT an error: this prompt already had a
                                    // first recording on this device, and that one
                                    // really is the first. Counted so the caller
                                    // can say so rather than imply the flag was
                                    // lost.
                                    else outcome.baselineNotPinned += 1;
                                }
                                (result.evictedPrompts || []).forEach(function (p) {
                                    if (outcome.evictedPrompts.indexOf(p) === -1) {
                                        outcome.evictedPrompts.push(p);
                                    }
                                });
                                return null;
                            });
                    });
                }, Promise.resolve(null));

                return writes.then(function () {
                    if (outcome.unfaithful) {
                        // Remove the one row we wrote, so the refusal leaves the
                        // archive exactly as it was found. remove() is documented
                        // as learner-initiated and unprotected, and this row was
                        // created by us seconds ago — it is not the learner's.
                        return Promise.resolve()
                            .then(function () { return store.remove(outcome.unfaithful.id); })
                            .catch(function (e) { logError(e, 'recordings probe cleanup'); })
                            .then(function () {
                                return {
                                    ok: false,
                                    code: 'recordings-restore-unsupported',
                                    message: MESSAGES.recordingsImportUnsupported,
                                    total: outcome.total,
                                    restored: 0,
                                    skipped: outcome.skipped,
                                    failed: []
                                };
                            });
                    }

                    const out = {
                        total: outcome.total,
                        restored: outcome.restored,
                        skipped: outcome.skipped,
                        failed: outcome.failed,
                        evictedPrompts: outcome.evictedPrompts,
                        baselineKept: outcome.baselineKept,
                        baselineNotPinned: outcome.baselineNotPinned
                    };

                    if (outcome.failed.length === 0 && outcome.restored === 0) {
                        out.ok = true;
                        out.message = MESSAGES.recordingsImportNothingNew;
                        return out;
                    }
                    if (outcome.failed.length === 0) {
                        out.ok = true;
                        out.message = MESSAGES.recordingsImportOk;
                        return out;
                    }
                    if (outcome.restored === 0) {
                        out.ok = false;
                        out.code = 'recordings-none-restored';
                        out.message = MESSAGES.recordingsImportNoneRestored;
                        return out;
                    }
                    // Neither a success nor a failure, and reported as neither.
                    out.ok = true;
                    out.partial = true;
                    out.code = 'recordings-partial';
                    out.message = MESSAGES.recordingsImportSomeFailed;
                    return out;
                });
            });
        }).catch(function (e) {
            // .catch, not a sibling handler: see readRecordingsFile().
            logError(e, 'restore recordings');
            return reject('recordings-read-failed', MESSAGES.recordingsReadFailed);
        });
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
        // Recordings are a separate store with a separate cap, so they are a
        // separate line rather than folded into the item count above — the same
        // reason blobstore.js reports `strandedCount` beside `count` instead of
        // inside it. Drawn only when this app has actually looked.
        const recordingsEl = document.getElementById('dataControlsRecordings');
        if (!recordingsEl) return;
        recordingsEl.textContent = recordingsUsageText();
    }

    function recordingsUsageText() {
        if (!archivePossible()) {
            return 'This browser will not let the app keep recordings.';
        }
        const archive = cachedArchive();
        if (!archive) return 'Checking your recordings…';
        if (archive.available !== true) {
            return 'Your recordings could not be checked on this device just now.';
        }
        if (archive.count === 0) return 'No recordings saved on this device yet.';
        return 'Recordings: ' + archive.count + (archive.count === 1 ? ' recording' : ' recordings') +
               ' across ' + archive.promptCount + (archive.promptCount === 1 ? ' prompt' : ' prompts') +
               ', ' + mbText(archive.bytes) + '. These are NOT in the data file — save them separately.';
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

    /**
     * The sentence to show beside a successful data-file export about what that
     * file does NOT contain. '' when there is nothing true to say.
     *
     * The three cases are three different facts, and only one of them is the
     * ordinary one:
     *   - no recording storage on this device: there is no archive to leave
     *     behind, so plain "Saved." is the whole truth.
     *   - an archive with recordings in it, and a control to save them: name the
     *     control.
     *   - an archive with recordings in it and NO control on this screen: say
     *     that, plainly. It reads as alarming because it is — the recordings
     *     cannot currently be got off the device — and a reassuring version would
     *     be the lie US-138 exists to remove. It disappears as soon as the
     *     Dashboard markup carries `#exportRecordings`.
     */
    function exportRecordingsNote(result) {
        // Nowhere to keep recordings: there is no archive to leave behind, so the
        // caveat would be noise — and noise about data loss is how a real warning
        // gets ignored.
        if (!archivePossible()) return '';
        const manifest = result && result.recordings;
        // No manifest means the archive was never asked (a click before the check
        // landed); a manifest that could not read the archive means the same thing
        // for a different reason. Neither is "there are none".
        if (!manifest || manifest.archiveReadable !== true) {
            return MESSAGES.exportRecordingsUnknown;
        }
        if (manifest.count === 0) return '';
        const control = (typeof document !== 'undefined') &&
            document.getElementById('exportRecordings');
        return control ? MESSAGES.exportRecordingsElsewhere : MESSAGES.exportRecordingsNoControl;
    }

    function handleExport() {
        // Synchronous on purpose: the data file must not wait on IndexedDB, and a
        // storage failure in the archive must not be able to cost a learner the
        // one export that has always worked. The manifest therefore comes from
        // the cache, which initUI() warms, and the note below degrades to "not
        // checked" rather than to "none" when it is cold.
        const result = exportToFile(cachedArchive());
        if (!result.ok) {
            setStatus(result.message, 'error');
            return;
        }
        const note = exportRecordingsNote(result);
        // The file did save either way, but a copy this app cannot restore is a
        // caveat rather than a success, so it is not dressed as one (US-209).
        setStatus(note ? result.message + '\n\n' + note : result.message,
            result.restorable ? 'success' : 'info');
        showUsage();
    }

    function handleExportRecordings() {
        setStatus(MESSAGES.recordingsExportBusy, 'info');
        return exportRecordingsToFile().then(function (result) {
            setStatus(result.message, result.ok ? (result.complete ? 'success' : 'info') : 'error');
            return refreshArchive().then(function () {
                showUsage();
                return result;
            });
        });
    }

    function handleRecordingsFile(file) {
        if (!file) return Promise.resolve(null);
        return readRecordingsFile(file).then(function (read) {
            if (!read.ok) {
                setStatus(read.message, 'error');
                return read;
            }
            // Asked only for a file that was actually going to be acted on, and
            // asked AFTER the whole header has been validated — same doctrine as
            // handleFile() above.
            if (!confirmed(recordingsConfirmMessage(read))) {
                setStatus(MESSAGES.cancelled, 'info');
                return { ok: false, code: 'cancelled', message: MESSAGES.cancelled };
            }
            setStatus(MESSAGES.recordingsImportBusy, 'info');
            return importRecordingsFromFile(file, read).then(function (result) {
                setStatus(result.message, result.ok ? (result.partial ? 'info' : 'success') : 'error');
                return refreshArchive().then(function () {
                    showUsage();
                    return result;
                });
            });
        });
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

        // --------------------------------------------------------------
        // Recordings (US-138). All four ids are OPTIONAL.
        // --------------------------------------------------------------
        //
        // index.html is not this module's to change, so every control here is
        // wired only if the markup is present and nothing breaks when it is not.
        // The markup to add is:
        //
        //   <button id="exportRecordings">Save my recordings</button>
        //   <button id="importRecordings">Restore my recordings</button>
        //   <input type="file" id="importRecordingsFile" accept=".enrec"
        //          class="sr-only" tabindex="-1" aria-hidden="true">
        //   <p id="dataControlsRecordings" aria-live="polite"></p>
        //
        // Until it is, handleExport()'s copy says in as many words that this
        // screen cannot save the recordings — see exportRecordingsNote(). A
        // half-wired build tells the learner so rather than quietly omitting them.
        const exportRecordingsBtn = document.getElementById('exportRecordings');
        const importRecordingsBtn = document.getElementById('importRecordings');
        const recordingsInput = document.getElementById('importRecordingsFile');

        if (exportRecordingsBtn) {
            exportRecordingsBtn.addEventListener('click', function () {
                // Fire and forget: handleExportRecordings() resolves whatever
                // happens and reports through setStatus, so an unhandled
                // rejection here is impossible by construction.
                handleExportRecordings();
            });
        }
        if (importRecordingsBtn && recordingsInput) {
            importRecordingsBtn.addEventListener('click', function () { recordingsInput.click(); });
            recordingsInput.addEventListener('change', function () {
                const picked = recordingsInput.files && recordingsInput.files[0];
                handleRecordingsFile(picked);
                recordingsInput.value = '';
            });
        }

        showUsage();

        // Warm the cache so the export button's copy can tell the truth about
        // recordings on the first click. Only when there is a store to ask: on a
        // device with no IndexedDB there is nothing to check and no promise to
        // leave pending.
        if (archivePossible()) {
            // No rejection handler for the same reason exportAll() has none.
            refreshArchive().then(function () { showUsage(); });
        }
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

        // The recording archive's second artefact (US-138). Exposed for the same
        // reason BlobStore exposes its own caps: the UI and the tests reference
        // the policy rather than repeating the numbers.
        RECORDINGS_KIND: RECORDINGS_KIND,
        RECORDINGS_FORMAT_VERSION: RECORDINGS_FORMAT_VERSION,
        RECORDINGS_MAGIC: RECORDINGS_MAGIC,
        RECORDINGS_PREFIX_BYTES: RECORDINGS_PREFIX_BYTES,
        RECORDINGS_MIME: RECORDINGS_MIME,
        MAX_RECORDINGS_HEADER_BYTES: MAX_RECORDINGS_HEADER_BYTES,
        MAX_RECORDINGS_ENTRIES: MAX_RECORDINGS_ENTRIES,
        DEFAULT_MAX_ARCHIVE_BYTES: DEFAULT_MAX_ARCHIVE_BYTES,
        maxArchiveBytes: maxArchiveBytes,
        maxRecordingsImportBytes: maxRecordingsImportBytes,

        isOwnedKey: isOwnedKey,
        ownedKeys: ownedKeys,
        snapshot: snapshot,
        buildExport: buildExport,
        exportFileName: exportFileName,
        exportToFile: exportToFile,
        exportAll: exportAll,
        validateExport: validateExport,
        importConfirmMessage: importConfirmMessage,
        importFromText: importFromText,
        resetReviewHistory: resetReviewHistory,
        storageInfo: storageInfo,
        suspendWrites: suspendWrites,
        writesSuspended: writesSuspended,
        initUI: initUI,

        // Recordings (US-138). Every one of these resolves; none rejects.
        archivePossible: archivePossible,
        archiveSummary: archiveSummary,
        refreshArchive: refreshArchive,
        cachedArchive: cachedArchive,
        recordingsFileName: recordingsFileName,
        collectRecordings: collectRecordings,
        exportRecordingsToFile: exportRecordingsToFile,
        readRecordingsFile: readRecordingsFile,
        recordingsConfirmMessage: recordingsConfirmMessage,
        importRecordingsFromFile: importRecordingsFromFile,

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
        _resetWritesSuspended: _resetWritesSuspended,

        // TEST SEAM (US-138). The archive cache is module-level state that
        // survives localStorage.clear(), exactly like the `suspended` latch, so a
        // suite needs a way to put it back — and a way to stand a summary up
        // without a working IndexedDB.
        _setArchiveCache: _setArchiveCache
    };

    global.Portability = Portability;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Portability;
    }
})(typeof window !== 'undefined' ? window : globalThis);
