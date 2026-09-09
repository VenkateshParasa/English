/**
 * Levels + migrations — the data-corruption surface.
 *
 * These are the only tests in the suite that guard against an unrecoverable
 * bug: a wrong migration rewrites a learner's saved progress in place. The
 * idempotency cases matter more than the happy paths.
 */

const Levels = require('../../js/core/levels.js');
const Migrations = require('../../js/core/migrations.js');

const { canonicalLevel, isKnownLevel, levelIds, levelLabel, DEFAULT_LEVEL } = Levels;
const { migrateExerciseId, migrateProgress, backupOnce, isFutureVersion, SCHEMA_VERSION, PROGRESS_KEY } = Migrations;

const FUTURE_VERSION = SCHEMA_VERSION + 1;

describe('canonicalLevel', () => {
    it('maps every legacy key to its CEFR replacement', () => {
        expect(canonicalLevel('basic')).toBe('foundation');
        expect(canonicalLevel('intermediate')).toBe('everyday');
        expect(canonicalLevel('medium')).toBe('confident');
    });

    it('is idempotent — canonical ids map to themselves', () => {
        levelIds().forEach(id => {
            expect(canonicalLevel(id)).toBe(id);
            expect(canonicalLevel(canonicalLevel(id))).toBe(id);
        });
        expect(canonicalLevel(canonicalLevel('basic'))).toBe('foundation');
    });

    it('normalizes case and surrounding whitespace', () => {
        expect(canonicalLevel('  BASIC ')).toBe('foundation');
        expect(canonicalLevel('Medium')).toBe('confident');
    });

    it('defaults unknown or missing input rather than returning undefined', () => {
        // Deliberate: data[undefined].length throws and takes a section down,
        // whereas a wrong-but-valid level is one button click from correct.
        [undefined, null, '', '   ', 'nonsense', 42, {}, []].forEach(bad => {
            expect(canonicalLevel(bad)).toBe(DEFAULT_LEVEL);
        });
    });
});

describe('isKnownLevel', () => {
    it('accepts canonical ids and legacy aliases', () => {
        ['foundation', 'everyday', 'confident', 'fluent', 'basic', 'intermediate', 'medium']
            .forEach(v => expect(isKnownLevel(v)).toBe(true));
    });

    it('rejects anything else, unlike canonicalLevel', () => {
        [undefined, null, '', 'nonsense', 'advanced'].forEach(v => {
            expect(isKnownLevel(v)).toBe(false);
        });
    });
});

describe('levels metadata', () => {
    it('exposes the four tiers in ascending order', () => {
        expect(levelIds()).toEqual(['foundation', 'everyday', 'confident', 'fluent']);
        const orders = Levels.LEVELS.map(l => l.order);
        expect(orders).toEqual([...orders].sort((a, b) => a - b));
    });

    it('resolves labels through the alias map', () => {
        expect(levelLabel('basic')).toBe('Foundation');
        expect(levelLabel('fluent')).toBe('Fluent');
    });
});

describe('migrateExerciseId', () => {
    // Ids come from getExerciseId(): `${type}_${difficulty}_${index}`
    it('rewrites the level token', () => {
        expect(migrateExerciseId('vocabulary_basic_0')).toBe('vocabulary_foundation_0');
        expect(migrateExerciseId('reading_medium_12')).toBe('reading_confident_12');
    });

    it('is idempotent', () => {
        const once = migrateExerciseId('sentences_intermediate_3');
        expect(once).toBe('sentences_everyday_3');
        expect(migrateExerciseId(once)).toBe(once);
    });

    it('handles a type containing underscores', () => {
        // Parsed from the end, so parts[length - 2] is the level regardless
        // of how many underscores precede it.
        expect(migrateExerciseId('word_families_medium_7')).toBe('word_families_confident_7');
    });

    it('leaves an unrecognised level token untouched', () => {
        // Better a stale id that never matches than a silently corrupted one.
        expect(migrateExerciseId('vocabulary_zzz_0')).toBe('vocabulary_zzz_0');
    });

    it('passes through malformed input unchanged', () => {
        expect(migrateExerciseId('too_short')).toBe('too_short');
        expect(migrateExerciseId('')).toBe('');
        expect(migrateExerciseId(42)).toBe(42);
        expect(migrateExerciseId(null)).toBe(null);
        expect(migrateExerciseId(undefined)).toBe(undefined);
    });

    it('normalizes an uppercase level token', () => {
        expect(migrateExerciseId('reading_INTERMEDIATE_3')).toBe('reading_everyday_3');
    });
});

describe('backupOnce', () => {
    it('copies the value aside', () => {
        localStorage.setItem('someKey', '{"a":1}');
        expect(backupOnce('someKey', 1)).toBe(true);
        expect(localStorage.getItem('someKey.bak.v1')).toBe('{"a":1}');
    });

    it('never overwrites an existing backup', () => {
        // The first backup is the pristine one; a second attempt must not
        // clobber it with already-partially-migrated data.
        localStorage.setItem('someKey', 'original');
        expect(backupOnce('someKey', 1)).toBe(true);
        localStorage.setItem('someKey', 'mutated');
        expect(backupOnce('someKey', 1)).toBe(false);
        expect(localStorage.getItem('someKey.bak.v1')).toBe('original');
    });

    it('does nothing when there is no value to back up', () => {
        expect(backupOnce('missingKey', 1)).toBe(false);
        expect(localStorage.getItem('missingKey.bak.v1')).toBeNull();
    });

    it('keys the backup by source version', () => {
        localStorage.setItem('k', 'v');
        backupOnce('k', 1);
        backupOnce('k', 2);
        expect(localStorage.getItem('k.bak.v1')).toBe('v');
        expect(localStorage.getItem('k.bak.v2')).toBe('v');
    });
});

describe('migrateProgress', () => {
    it('stamps the current schema version', () => {
        const out = migrateProgress({ currentWordIndex: 4 });
        expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    });

    it('run twice equals run once', () => {
        const input = {
            currentDifficulty: 'basic',
            completedExercises: { vocabulary: ['vocabulary_basic_0'] },
            exerciseHistory: [{ id: 'vocabulary_basic_0', difficulty: 'basic' }]
        };
        const once = JSON.parse(JSON.stringify(migrateProgress(input)));
        const twice = JSON.parse(JSON.stringify(migrateProgress(JSON.parse(JSON.stringify(once)))));
        expect(twice).toEqual(once);
    });

    it('leaves already-current data alone', () => {
        const out = migrateProgress({ schemaVersion: SCHEMA_VERSION, foo: 'bar' });
        expect(out.foo).toBe('bar');
        expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    });

    it('does not back up data that is already current', () => {
        localStorage.setItem(PROGRESS_KEY, '{"schemaVersion":' + SCHEMA_VERSION + '}');
        migrateProgress({ schemaVersion: SCHEMA_VERSION });
        expect(localStorage.getItem(PROGRESS_KEY + '.bak.v' + SCHEMA_VERSION)).toBeNull();
    });

    it('tolerates a non-object, including a fresh install', () => {
        expect(migrateProgress(null)).toBeNull();
        expect(migrateProgress(undefined)).toBeUndefined();
        expect(migrateProgress('nonsense')).toBe('nonsense');
    });

    it('treats a corrupt version field as the oldest version', () => {
        // Must not throw or skip the chain on garbage input.
        const out = migrateProgress({ schemaVersion: 'banana' });
        expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    });

    // A record from a NEWER release is the one case where stamping is wrong.
    // The old code stamped anything `>= SCHEMA_VERSION` back down to
    // SCHEMA_VERSION, so an older client silently relabelled newer-shaped data
    // as current and the version field stopped describing the data.
    it('does not downgrade a record written by a newer release', () => {
        const out = migrateProgress({ schemaVersion: FUTURE_VERSION, foo: 'bar' });
        expect(out.schemaVersion).toBe(FUTURE_VERSION);
        expect(out.foo).toBe('bar');
    });

    it('does not downgrade a far-future version either', () => {
        expect(migrateProgress({ schemaVersion: 99 }).schemaVersion).toBe(99);
    });

    it('returns the future record itself, with nothing added or removed', () => {
        // Fails closed: no upgrade step can be correct for a shape this build
        // has never seen, so the record is handed back exactly as found.
        const input = { schemaVersion: FUTURE_VERSION, currentWordIndex: 7, newShape: { x: 1 } };
        const before = JSON.stringify(input);
        const out = migrateProgress(input);
        expect(out).toBe(input);
        expect(JSON.stringify(out)).toBe(before);
    });

    it('does not back up a future record — it is not being rewritten', () => {
        localStorage.setItem(PROGRESS_KEY, '{"schemaVersion":' + FUTURE_VERSION + '}');
        migrateProgress({ schemaVersion: FUTURE_VERSION });
        expect(localStorage.getItem(PROGRESS_KEY + '.bak.v' + FUTURE_VERSION)).toBeNull();
    });

    it('run twice equals run once for a future record', () => {
        const input = { schemaVersion: FUTURE_VERSION, completedExercises: { vocabulary: ['vocabulary_foundation_0'] } };
        const once = JSON.parse(JSON.stringify(migrateProgress(input)));
        const twice = JSON.parse(JSON.stringify(migrateProgress(JSON.parse(JSON.stringify(once)))));
        expect(twice).toEqual(once);
        expect(twice.schemaVersion).toBe(FUTURE_VERSION);
    });

    it('still treats a version older than current as a migration candidate', () => {
        // Guards the boundary from the other side: only `> SCHEMA_VERSION` is
        // left alone; anything below it goes through the chain and is stamped.
        localStorage.setItem(PROGRESS_KEY, '{"schemaVersion":-1}');
        const out = migrateProgress({ schemaVersion: -1 });
        expect(out.schemaVersion).toBe(SCHEMA_VERSION);
        expect(localStorage.getItem(PROGRESS_KEY + '.bak.v-1')).toBe('{"schemaVersion":-1}');
    });
});

describe('isFutureVersion', () => {
    it('flags a record written by a newer release', () => {
        expect(isFutureVersion({ schemaVersion: FUTURE_VERSION })).toBe(true);
        expect(isFutureVersion({ schemaVersion: 99 })).toBe(true);
    });

    it('does not flag current, missing or corrupt versions', () => {
        // Anything unusable reads as version 1, the pre-version shape — which
        // is a migration candidate, not something from the future.
        expect(isFutureVersion({ schemaVersion: SCHEMA_VERSION })).toBe(false);
        expect(isFutureVersion({})).toBe(false);
        expect(isFutureVersion({ schemaVersion: 'banana' })).toBe(false);
        expect(isFutureVersion({ schemaVersion: 0 })).toBe(false);
        expect(isFutureVersion({ schemaVersion: -1 })).toBe(false);
    });

    it('tolerates non-objects, like migrateProgress does', () => {
        [null, undefined, 'garbage', 0, -1, [], 42].forEach(bad => {
            expect(isFutureVersion(bad)).toBe(false);
        });
    });

    it('does not modify the record it inspects', () => {
        const record = { schemaVersion: FUTURE_VERSION, foo: 'bar' };
        isFutureVersion(record);
        expect(record).toEqual({ schemaVersion: FUTURE_VERSION, foo: 'bar' });
    });
});
