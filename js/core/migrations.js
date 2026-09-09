/**
 * Storage migrations
 * -------------------------------------------------------------
 * The app persists learner progress under a single localStorage key
 * (`learningProgress`) that historically had no version field, so there was no
 * safe way to change its shape. This module introduces that version, the
 * chain that upgrades old data to it, and a one-shot backup taken before any
 * rewrite.
 *
 * A broken render is a reload away; a broken migration eats weeks of a
 * learner's review history. Everything here is therefore written to be
 * idempotent and to fail closed (leave data alone) rather than guess.
 *
 * Depends on js/core/levels.js — load that first.
 *
 * Public API (window.Migrations):
 *   SCHEMA_VERSION
 *   backupOnce(storageKey, fromVersion)
 *   migrateExerciseId(id)
 *   migrateProgress(loadedObject) -> migrated object (mutates in place)
 *   isFutureVersion(loadedObject) -> true if written by a newer release
 */
(function (global) {
    'use strict';

    // In the browser, index.html loads levels.js before this file. Under Node
    // (Jest) a test may require() this module on its own, so pull the
    // dependency in ourselves rather than failing on a missing global.
    if (typeof module !== 'undefined' && module.exports &&
        typeof global.LEVEL_ALIASES === 'undefined') {
        require('./levels.js');
    }

    // 1 = the original, pre-CEFR shape (or no schemaVersion field at all).
    // Phase 2 raises this to 2 and adds the level-rename step below.
    const SCHEMA_VERSION = 1;

    const PROGRESS_KEY = 'learningProgress';

    /**
     * Copy a storage key aside before it is rewritten, exactly once per
     * source version. This is the manual recovery path if a migration turns
     * out to be wrong in the field.
     */
    function backupOnce(storageKey, fromVersion) {
        const bakKey = storageKey + '.bak.v' + fromVersion;
        try {
            // Never overwrite: the first backup is the pristine one, and a
            // second migration attempt must not clobber it with already-
            // partially-migrated data.
            if (localStorage.getItem(bakKey) !== null) return false;
            const raw = localStorage.getItem(storageKey);
            if (raw === null) return false;
            localStorage.setItem(bakKey, raw);
            return true;
        } catch (e) {
            // Quota exceeded, or private mode with storage disabled. Proceed:
            // the migration itself is still guarded and idempotent.
            return false;
        }
    }

    /**
     * Rewrite the level token inside a completed-exercise id.
     *
     * Ids are built by getExerciseId() as `${type}_${difficulty}_${index}`, so
     * we parse from the END: the index never contains an underscore and the
     * level is always a single token, which makes parts[length - 2] the level
     * regardless of how many underscores the type has. Parsing from the front
     * would break the day a section is named e.g. "word_families".
     *
     * Idempotent, because LEVEL_ALIASES maps every canonical id to itself.
     * An unrecognised token is left untouched rather than defaulted — better a
     * stale id that simply never matches than a silently corrupted one.
     */
    function migrateExerciseId(id) {
        if (typeof id !== 'string') return id;
        const parts = id.split('_');
        if (parts.length < 3) return id;
        const levelIndex = parts.length - 2;
        const canon = global.LEVEL_ALIASES[String(parts[levelIndex]).trim().toLowerCase()];
        if (!canon) return id;
        parts[levelIndex] = canon;
        return parts.join('_');
    }

    // Upgrade steps, in order. Each entry declares the version it produces.
    // Phase 2 will add: { to: 2, run: migrateV1toV2 }
    const STEPS = [];

    // Noisy once, not on every load: the condition does not change while the
    // page is open, and this is a developer signal, never learner-facing text.
    let warnedAboutFuture = false;
    function warnAboutFutureVersion(from) {
        if (warnedAboutFuture) return;
        warnedAboutFuture = true;
        try {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[migrations] stored progress is schemaVersion ' + from +
                    ', newer than this build (' + SCHEMA_VERSION +
                    '). Leaving it untouched; some sections may look incomplete.');
            }
        } catch (e) {
            // A missing/hostile console must never break a load.
        }
    }

    /**
     * The version a stored record claims to be, as a number.
     *
     * Anything unusable — missing, `'banana'`, `null`, `0` — reads as 1, which
     * is the pre-version shape: that is the oldest thing this chain knows how
     * to handle, and it is the safe assumption because every upgrade step is
     * written to be a no-op on data that has already had it applied.
     */
    function storedVersion(loaded) {
        return Number(loaded && loaded.schemaVersion) || 1;
    }

    /**
     * True when a record claims a version this build has never heard of, i.e.
     * it was written by a newer release of the app (the learner used a newer
     * client on another device, or the deployed bundle was rolled back but the
     * browser's localStorage was not).
     *
     * Exposed so a caller can tell the learner something honest about why a
     * section may look incomplete, instead of the app quietly deciding the
     * data is current. Pure and side-effect free, so it stays safe to call on
     * every load.
     */
    function isFutureVersion(loaded) {
        if (!loaded || typeof loaded !== 'object') return false;
        return storedVersion(loaded) > SCHEMA_VERSION;
    }

    /**
     * Bring a parsed `learningProgress` object up to SCHEMA_VERSION.
     * Mutates and returns the same object (callers pass the result of
     * JSON.parse, so there is nothing to preserve).
     */
    function migrateProgress(loaded) {
        if (!loaded || typeof loaded !== 'object') return loaded;

        const from = storedVersion(loaded);

        if (from > SCHEMA_VERSION) {
            // From the future. There is no downgrade path — this build does not
            // know what a version-N record contains, so it cannot rewrite it
            // and must not relabel it either. Stamping SCHEMA_VERSION here (the
            // old behaviour) made the version field lie about the shape of the
            // data: the next load would take newer-shaped data for current, and
            // the newer client that wrote it would then read its own record as
            // if it had never been upgraded. Both are unrecoverable in the way
            // this module exists to prevent, so leave the record exactly as
            // found and return it untouched. The learner may see a section as
            // incomplete; that is recoverable, and callers can ask
            // isFutureVersion() to say so honestly.
            warnAboutFutureVersion(from);
            return loaded;
        }

        if (from === SCHEMA_VERSION) {
            // Already current. Stamp it anyway so data written before the
            // version field existed stops looking like a migration candidate.
            loaded.schemaVersion = SCHEMA_VERSION;
            return loaded;
        }

        backupOnce(PROGRESS_KEY, from);

        let out = loaded;
        STEPS.forEach(function (step) {
            if (from < step.to) out = step.run(out);
        });

        out.schemaVersion = SCHEMA_VERSION;
        return out;
    }

    const Migrations = {
        SCHEMA_VERSION: SCHEMA_VERSION,
        PROGRESS_KEY: PROGRESS_KEY,
        backupOnce: backupOnce,
        migrateExerciseId: migrateExerciseId,
        migrateProgress: migrateProgress,
        isFutureVersion: isFutureVersion
    };

    global.Migrations = Migrations;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Migrations;
    }
})(typeof window !== 'undefined' ? window : globalThis);
