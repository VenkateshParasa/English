/**
 * Levels — the single source of truth for difficulty tiers
 * -------------------------------------------------------------
 * The app originally used the keys `basic` / `intermediate` / `medium`, which
 * are not an ordered scale ("medium" reads as below "intermediate") and map to
 * nothing a learner can self-assess against. These are the CEFR-aligned
 * replacements; see docs/CURRICULUM.md §2.
 *
 * Public API (window.Levels, plus a few bare globals for convenience):
 *   canonicalLevel(x)  -> always a valid level id
 *   isKnownLevel(x)    -> true if x is a current id OR a legacy alias
 *   levelIds()         -> ['foundation', 'everyday', 'confident', 'fluent']
 *   levelLabel(id)     -> display label
 *   LEVELS, LEVEL_ALIASES, DEFAULT_LEVEL
 */
(function (global) {
    'use strict';

    const LEVELS = [
        { id: 'foundation', label: 'Foundation', cefr: 'A1–A2', order: 1 },
        { id: 'everyday',   label: 'Everyday',   cefr: 'B1',    order: 2 },
        { id: 'confident',  label: 'Confident',  cefr: 'B2',    order: 3 },
        { id: 'fluent',     label: 'Fluent',     cefr: 'C1',    order: 4 }
    ];

    const DEFAULT_LEVEL = 'foundation';

    // Maps every accepted spelling to its canonical id.
    //
    // The identity entries (foundation -> foundation, etc.) are load-bearing,
    // not redundant: they are what make canonicalLevel() and the exercise-id
    // migration in migrations.js idempotent. Applying the migration twice must
    // be a no-op, because a corrupted version field or a hand-edited
    // localStorage would otherwise corrupt data on a second pass.
    //
    // Keep the legacy aliases permanently. They cost four lines and they are
    // the only thing that rescues a learner who restores an old backup.
    const LEVEL_ALIASES = {
        // legacy -> canonical
        basic: 'foundation',
        intermediate: 'everyday',
        medium: 'confident',
        // canonical -> itself
        foundation: 'foundation',
        everyday: 'everyday',
        confident: 'confident',
        fluent: 'fluent'
    };

    /** Normalize any value to a lookup key. */
    function _norm(x) {
        return String(x == null ? '' : x).trim().toLowerCase();
    }

    /**
     * Resolve any level-ish value to a valid level id.
     *
     * Unknown input returns DEFAULT_LEVEL rather than undefined, deliberately:
     * `vocabularyData[undefined].length` throws and takes a section down,
     * whereas a wrong-but-valid level is one button click from correct.
     */
    function canonicalLevel(x) {
        return LEVEL_ALIASES[_norm(x)] || DEFAULT_LEVEL;
    }

    /** True only for values we actually recognise (no silent defaulting). */
    function isKnownLevel(x) {
        return Object.prototype.hasOwnProperty.call(LEVEL_ALIASES, _norm(x));
    }

    function levelIds() {
        return LEVELS.map(l => l.id);
    }

    function levelLabel(id) {
        const found = LEVELS.find(l => l.id === canonicalLevel(id));
        return found ? found.label : '';
    }

    const Levels = {
        LEVELS: LEVELS,
        LEVEL_ALIASES: LEVEL_ALIASES,
        DEFAULT_LEVEL: DEFAULT_LEVEL,
        canonicalLevel: canonicalLevel,
        isKnownLevel: isKnownLevel,
        levelIds: levelIds,
        levelLabel: levelLabel
    };

    global.Levels = Levels;

    // Bare globals so call sites read naturally (canonicalLevel(x) rather than
    // Levels.canonicalLevel(x)) and so migrations.js can use them directly.
    global.LEVELS = LEVELS;
    global.LEVEL_ALIASES = LEVEL_ALIASES;
    global.DEFAULT_LEVEL = DEFAULT_LEVEL;
    global.canonicalLevel = canonicalLevel;
    global.isKnownLevel = isKnownLevel;
    global.levelIds = levelIds;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Levels;
    }
})(typeof window !== 'undefined' ? window : globalThis);
