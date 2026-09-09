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
 *   PROGRESS_KEY / SRS_KEY / SRS_TYPES / STEPS
 *   backupOnce(storageKey, fromVersion)
 *   migrateExerciseId(id)
 *   migrateProgress(loadedObject) -> migrated object (mutates in place)
 *   migrateSrsData(loadedObject)  -> { records, changed, reason }
 *   srsRef(ref) / srsTypedKey(type, ref) / isTypedSrsKey(key)
 *   isFutureVersion(loadedObject) -> true if written by a newer release
 *
 * Two localStorage keys are migrated here (`learningProgress` and `srsData`)
 * under ONE SCHEMA_VERSION. See the comment on SCHEMA_VERSION for why one
 * constant, and the comment on migrateSrsData() for why only one of the two
 * stores carries a persisted stamp.
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

    // ---------------------------------------------------------------------
    // THE VERSION AXIS
    // ---------------------------------------------------------------------
    // 1 = the original, pre-CEFR shape (or no schemaVersion field at all).
    // 2 = CEFR level ids everywhere (foundation/everyday/confident/fluent) in
    //     `learningProgress` AND typed SRS keys (`vocab:<word>`) in `srsData`.
    //
    // ONE constant, deliberately, even though two localStorage keys are being
    // rewritten. SCHEMA_VERSION is the version of the *stored-data era*, not of
    // a single key: it is what guarantees two migrations can never both claim
    // "version 2", which is the one mistake in this module that is not
    // recoverable. Each store is upgraded by its own ordered steps (see STEPS,
    // whose entries name the key they apply to) and the two stores stay
    // independently upgradable, because portability.js can restore one without
    // the other and `resetReviewHistory()` can clear `srsData` alone.
    const SCHEMA_VERSION = 2;

    const PROGRESS_KEY = 'learningProgress';

    // srs.js's storage key. Repeated here rather than read from SRS because
    // migrations.js loads BEFORE srs.js (index.html) and must not depend on it.
    const SRS_KEY = 'srsData';

    // The four item types from docs/TEACHING_METHODOLOGY.md §3.
    const SRS_TYPES = ['vocab', 'gram', 'phon', 'coll'];
    const TYPED_KEY_RE = /^(vocab|gram|phon|coll):/;

    // Victims of the old `_key` bug (`String({...})`), which collapsed every
    // non-`.word` object onto a single record. There is no recoverable identity
    // behind this key, so the migration drops it instead of inventing one.
    const LOST_KEY = '[object object]';

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

    // ---------------------------------------------------------------------
    // TYPED SRS KEYS (US-302)
    // ---------------------------------------------------------------------

    /**
     * Normalize the reference half of a typed SRS key.
     *
     * Lowercase, trim, collapse whitespace to a single hyphen — and nothing
     * else. Deliberately NOT aggressive slugification: `phon:iː-ɪ` has to keep
     * its IPA, and a collocation like `coll:make-a-decision` has to survive
     * being authored as "make a decision". The same function runs on write and
     * on read, so ids round-trip whatever symbols an author uses.
     */
    function srsRef(ref) {
        return String(ref == null ? '' : ref)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-');
    }

    /**
     * `type:ref`. Returns '' when there is nothing to key on, so callers can
     * reject an unkeyable item rather than write a record named ":".
     */
    function srsTypedKey(type, ref) {
        const t = String(type == null ? '' : type).trim().toLowerCase();
        const r = srsRef(ref);
        if (!r) return '';
        return (SRS_TYPES.indexOf(t) === -1 ? 'vocab' : t) + ':' + r;
    }

    /** True for a key that already carries one of the four type prefixes. */
    function isTypedSrsKey(key) {
        return typeof key === 'string' && TYPED_KEY_RE.test(key);
    }

    // ---------------------------------------------------------------------
    // UPGRADE STEPS
    // ---------------------------------------------------------------------
    //
    // Every step is a FIXED POINT: applying it to its own output changes
    // nothing. That is the second, independent idempotency guarantee — the
    // first is the version check in migrateProgress(). Both exist because this
    // is the only operation in the app a learner cannot undo, and a corrupted
    // or hand-edited version field must not be able to corrupt data.

    /**
     * v1 -> v2 for `learningProgress`: every surface that embeds a level token.
     *
     * `completedExercises` is the dangerous one. Ids are `type_level_index`, so
     * renaming the levels without rewriting the ids silently un-completes every
     * exercise the learner has ever finished.
     */
    function progressLevelsV2(p) {
        if (!p || typeof p !== 'object') return p;

        // Only rewrite a level we actually recognise. An unknown value is left
        // exactly as found — loadProgress() normalises it through
        // resolveDifficulty() anyway, and guessing here would destroy the only
        // evidence of what the learner had selected.
        if (typeof global.isKnownLevel === 'function' && global.isKnownLevel(p.currentDifficulty)) {
            p.currentDifficulty = global.canonicalLevel(p.currentDifficulty);
        }

        if (p.completedExercises && typeof p.completedExercises === 'object') {
            Object.keys(p.completedExercises).forEach(function (type) {
                const ids = p.completedExercises[type];
                if (!Array.isArray(ids)) return;
                // Through a Set, because two source levels could in principle
                // migrate onto the same id (a hand-edited store holding both
                // `vocabulary_medium_0` and `vocabulary_confident_0`).
                const seen = [];
                ids.forEach(function (id) {
                    const next = migrateExerciseId(id);
                    if (seen.indexOf(next) === -1) seen.push(next);
                });
                p.completedExercises[type] = seen;
            });
        }

        if (Array.isArray(p.exerciseHistory)) {
            p.exerciseHistory.forEach(function (entry) {
                if (!entry || typeof entry !== 'object') return;
                if (typeof entry.id === 'string') entry.id = migrateExerciseId(entry.id);
                if (typeof global.isKnownLevel === 'function' && global.isKnownLevel(entry.difficulty)) {
                    entry.difficulty = global.canonicalLevel(entry.difficulty);
                }
            });
        }

        return p;
    }

    /**
     * v1 -> v2 for `srsData`, part 1: the level token cached inside each
     * record's word payload (`rec.data.difficulty`, written by srs.js).
     *
     * Mutates in place so JSON key order — and therefore the serialised bytes —
     * is untouched on a second run.
     */
    function srsLevelsV2(records) {
        Object.keys(records).forEach(function (k) {
            const rec = records[k];
            if (!rec || typeof rec !== 'object') return;
            const data = rec.data;
            if (!data || typeof data !== 'object') return;
            if (typeof global.isKnownLevel === 'function' && global.isKnownLevel(data.difficulty)) {
                data.difficulty = global.canonicalLevel(data.difficulty);
            }
        });
        return records;
    }

    /**
     * v1 -> v2 for `srsData`, part 2: bare lowercase word keys become typed
     * keys (`happy` -> `vocab:happy`).
     *
     * This is a learner's review history and it is not reproducible, so every
     * scheduling field (reps / interval / ease / lapses / due / lastReviewed /
     * createdAt / selfReport*) is carried across untouched — the record object
     * itself is moved, not rebuilt.
     *
     * Returns the SAME object when there is nothing legacy left, which is what
     * makes a second pass byte-identical rather than merely equal: rebuilding
     * the map would re-order its keys.
     */
    function srsTypedKeysV2(records) {
        const legacy = Object.keys(records).filter(function (k) {
            return !isTypedSrsKey(k) && records[k] && typeof records[k] === 'object';
        });
        if (legacy.length === 0) return records;

        // Preserve the original iteration order: typed keys keep their place,
        // legacy keys are re-inserted in the position they already occupied.
        const out = {};
        Object.keys(records).forEach(function (k) {
            const rec = records[k];

            if (isTypedSrsKey(k)) {
                out[k] = rec;
                return;
            }

            // Not a record. Could be a stray field from a hand-edited store or a
            // sibling written by a scheme this build does not know. Left exactly
            // where it is: prefixing it would invent an item, dropping it would
            // destroy something we do not understand.
            if (!rec || typeof rec !== 'object') {
                out[k] = rec;
                return;
            }

            // No recoverable identity — see LOST_KEY.
            if (String(k).trim().toLowerCase() === LOST_KEY) return;

            const ref = (typeof rec.word === 'string' && srsRef(rec.word))
                ? srsRef(rec.word)
                : srsRef(k);
            const typed = srsTypedKey('vocab', ref);
            if (!typed) {                    // unkeyable: keep it where it is
                out[k] = rec;
                return;
            }

            // Stamp the identity onto the record so nothing downstream has to
            // re-parse the key. Assigned before the collision check so both
            // candidates are comparable.
            rec.type = 'vocab';
            rec.ref = ref;
            rec.key = typed;

            const existing = out[typed];
            out[typed] = (existing === undefined) ? rec : moreAdvanced(existing, rec);
        });

        return out;
    }

    /**
     * Which of two colliding records to keep: the one with more verified
     * evidence behind it. reps first (that is what stats().learned counts),
     * then lapses, then the longer interval. Never merges the two — a merged
     * record would claim a history neither half actually has.
     */
    function moreAdvanced(a, b) {
        const num = function (x) { return Number(x) || 0; };
        if (!a || typeof a !== 'object') return b;
        if (!b || typeof b !== 'object') return a;
        if (num(b.reps) !== num(a.reps)) return num(b.reps) > num(a.reps) ? b : a;
        if (num(b.lapses) !== num(a.lapses)) return num(b.lapses) > num(a.lapses) ? b : a;
        if (num(b.interval) !== num(a.interval)) return num(b.interval) > num(a.interval) ? b : a;
        return a;
    }

    // Upgrade steps, in order. `key` names the store the step applies to, which
    // is how one SCHEMA_VERSION describes two localStorage keys without either
    // store needing to know about the other's steps.
    const STEPS = [
        { to: 2, key: PROGRESS_KEY, id: 'progress-levels-v2', run: progressLevelsV2 },
        { to: 2, key: SRS_KEY,      id: 'srs-levels-v2',      run: srsLevelsV2 },
        { to: 2, key: SRS_KEY,      id: 'srs-typed-keys-v2',  run: srsTypedKeysV2 }
    ];

    /** The steps that apply to one store, in declaration order. */
    function stepsFor(storageKey, from) {
        return STEPS.filter(function (s) {
            return s.key === storageKey && from < s.to;
        });
    }

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
        stepsFor(PROGRESS_KEY, from).forEach(function (step) {
            out = step.run(out);
        });

        out.schemaVersion = SCHEMA_VERSION;
        return out;
    }

    // ---------------------------------------------------------------------
    // srsData
    // ---------------------------------------------------------------------

    /**
     * The version `learningProgress` on disk claims, read tolerantly.
     *
     * `srsData` carries no version stamp of its own — see migrateSrsData — so
     * the progress stamp is the one place the "which era is this browser in"
     * question can be asked. Never throws: a missing key, unreadable storage or
     * unparseable JSON all read as version 1 (the oldest shape), which is the
     * safe assumption because every step is a fixed point.
     */
    function storedProgressVersion() {
        try {
            const raw = localStorage.getItem(PROGRESS_KEY);
            if (raw === null) return 1;
            return storedVersion(JSON.parse(raw));
        } catch (e) {
            return 1;
        }
    }

    /**
     * Bring a parsed `srsData` map up to SCHEMA_VERSION.
     *
     * WHY THERE IS NO VERSION FIELD IN `srsData`.
     * The obvious design is an envelope, `{ version, records }`. It cannot be
     * used: js/core/portability.js validates an imported `srsData` by requiring
     * every top-level value to be a plain object (portability.js:437-449), so a
     * numeric `version` sibling would make every export this build writes fail
     * to restore — and portability.js is owned elsewhere this wave.
     *
     * So the srsData steps are gated on SHAPE, not on a stamp, and each one is a
     * proven fixed point:
     *   - `srs-levels-v2` rewrites `data.difficulty` through LEVEL_ALIASES,
     *     whose identity entries make a second pass a no-op.
     *   - `srs-typed-keys-v2` only touches keys that lack a `type:` prefix, and
     *     returns the input object untouched when there are none.
     * A half-migrated map (some keys typed, some bare) is therefore the normal
     * case this handles, not an edge case.
     *
     * The single SCHEMA_VERSION still governs it in the one way that matters:
     * if `learningProgress` was written by a NEWER release, `srsData` may be in
     * a shape this build has never seen, so nothing is touched at all. That is
     * the same fail-closed rule migrateProgress() applies, reached through the
     * same version number.
     *
     * @param {*} raw - result of JSON.parse(localStorage.srsData), or anything.
     * @param {Object} [opts] - { fromVersion } to override the disk read (tests).
     * @returns {{records: Object, changed: boolean, reason: string}}
     */
    function migrateSrsData(raw, opts) {
        // Hostile input: null, 'garbage', 0, -1, true, an array. None of these
        // is a records map, and there is nothing in them to preserve.
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return { records: {}, changed: false, reason: 'not-a-records-map' };
        }

        const from = (opts && typeof opts.fromVersion === 'number')
            ? opts.fromVersion
            : storedProgressVersion();

        if (from > SCHEMA_VERSION) {
            warnAboutFutureVersion(from);
            return { records: raw, changed: false, reason: 'future-version' };
        }

        // Envelope sniff. This build stores `srsData` as a bare records map, but
        // if some other build ever wraps it as `{ version, records }` then this
        // map is not what it looks like and every step below would corrupt it.
        // Both conditions are required so that a legacy word literally keyed
        // "records" still falls through to the normal path.
        if (typeof raw.version === 'number' &&
            raw.records && typeof raw.records === 'object' && !Array.isArray(raw.records)) {
            return { records: raw, changed: false, reason: 'unknown-envelope' };
        }

        const before = safeStringify(raw);

        // `from` is only advisory for this store (see above): pass 1 so every
        // shape-gated step is offered the data even when the progress stamp is
        // already current — which is exactly the case after an import of an old
        // export, or after a hand-edited localStorage.
        let out = raw;
        let firstChangedTo = 0;
        stepsFor(SRS_KEY, 1).forEach(function (step) {
            const pre = safeStringify(out);
            out = step.run(out) || out;
            if (!firstChangedTo && safeStringify(out) !== pre) firstChangedTo = step.to;
        });

        const changed = safeStringify(out) !== before;

        // Backup only when something is actually being rewritten, keyed by the
        // version the data was in before the first step that changed it — not by
        // the progress stamp, which for this store says nothing about its shape.
        // backupOnce never clobbers, so the copy that survives is the pristine one.
        if (changed) backupOnce(SRS_KEY, Math.max(1, firstChangedTo - 1));

        return { records: out, changed: changed, reason: changed ? 'migrated' : 'no-op' };
    }

    /** JSON.stringify that cannot throw on a cyclic or hostile value. */
    function safeStringify(value) {
        try {
            return JSON.stringify(value);
        } catch (e) {
            return null;
        }
    }

    const Migrations = {
        SCHEMA_VERSION: SCHEMA_VERSION,
        PROGRESS_KEY: PROGRESS_KEY,
        SRS_KEY: SRS_KEY,
        SRS_TYPES: SRS_TYPES,
        STEPS: STEPS,
        backupOnce: backupOnce,
        migrateExerciseId: migrateExerciseId,
        migrateProgress: migrateProgress,
        migrateSrsData: migrateSrsData,
        srsRef: srsRef,
        srsTypedKey: srsTypedKey,
        isTypedSrsKey: isTypedSrsKey,
        isFutureVersion: isFutureVersion
    };

    global.Migrations = Migrations;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Migrations;
    }
})(typeof window !== 'undefined' ? window : globalThis);
