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
const {
    migrateExerciseId, migrateProgress, migrateSrsData, backupOnce, isFutureVersion,
    srsRef, srsTypedKey, isTypedSrsKey, STEPS, SCHEMA_VERSION, PROGRESS_KEY, SRS_KEY
} = Migrations;

const FUTURE_VERSION = SCHEMA_VERSION + 1;

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1700000000000;

// A record with every scheduling field populated, so a migration that drops one
// fails loudly. This is the data that is not reproducible if it is lost.
const srsRecord = (over = {}) => Object.assign({
    word: 'Happy',
    reps: 3,
    interval: 8,
    ease: 2.8,
    lapses: 1,
    due: NOW - 5000,
    lastReviewed: NOW - 8 * DAY_MS,
    createdAt: NOW - 30 * DAY_MS,
    data: {
        word: 'Happy',
        pronunciation: '/ˈhæpi/',
        definition: 'Feeling pleasure',
        example: 'She was happy.',
        quiz: { question: 'q', options: ['a', 'b'], correct: 1 },
        difficulty: 'basic'
    }
}, over);

const SCHEDULING_FIELDS = ['reps', 'interval', 'ease', 'lapses', 'due',
                           'lastReviewed', 'createdAt', 'selfReported',
                           'selfReports', 'lastSelfReported'];


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

// ---------------------------------------------------------------------------
// US-201 / US-202 — the CEFR rename, and the completion history it could eat.
// ---------------------------------------------------------------------------

describe('the version axis', () => {
    it('is a single number covering both storage keys', () => {
        expect(SCHEMA_VERSION).toBe(2);
        expect(new Set(STEPS.map(s => s.key))).toEqual(new Set([PROGRESS_KEY, SRS_KEY]));
    });

    it('never lets two steps claim the same version for the same store', () => {
        // The one mistake in this module that is not recoverable: two migrations
        // both called "v2" for one key, so whichever runs second is skipped.
        const ids = STEPS.map(s => s.key + '#' + s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('declares steps in ascending version order', () => {
        const versions = STEPS.map(s => s.to);
        expect(versions).toEqual([...versions].sort((a, b) => a - b));
        expect(Math.max(...versions)).toBe(SCHEMA_VERSION);
    });
});

describe('migrateProgress — level rename (US-201)', () => {
    const legacyProgress = () => ({
        currentDifficulty: 'medium',
        currentWordIndex: 7,
        completedExercises: {
            vocabulary: ['vocabulary_basic_0', 'vocabulary_intermediate_4', 'vocabulary_medium_9'],
            sentences: ['sentences_basic_0'],
            reading: ['reading_intermediate_12'],
            listening: ['listening_medium_0'],
            puzzles: ['puzzles_basic_0']
        },
        exerciseHistory: [
            { type: 'vocabulary', index: 0, difficulty: 'basic', id: 'vocabulary_basic_0' },
            { type: 'listening', index: 0, difficulty: 'medium', id: 'listening_medium_0' }
        ]
    });

    it('rewrites currentDifficulty to a canonical id', () => {
        expect(migrateProgress(legacyProgress()).currentDifficulty).toBe('confident');
    });

    it('rewrites the level token in every completed-exercise id', () => {
        // THE bug this step exists to prevent: rename the levels without
        // rewriting these ids and every finished exercise silently un-completes.
        const out = migrateProgress(legacyProgress());
        expect(out.completedExercises.vocabulary).toEqual([
            'vocabulary_foundation_0', 'vocabulary_everyday_4', 'vocabulary_confident_9'
        ]);
        expect(out.completedExercises.sentences).toEqual(['sentences_foundation_0']);
        expect(out.completedExercises.reading).toEqual(['reading_everyday_12']);
        expect(out.completedExercises.listening).toEqual(['listening_confident_0']);
        expect(out.completedExercises.puzzles).toEqual(['puzzles_foundation_0']);
    });

    it('loses no completed exercise', () => {
        const before = legacyProgress();
        const count = o => Object.keys(o.completedExercises)
            .reduce((n, k) => n + o.completedExercises[k].length, 0);
        expect(count(migrateProgress(legacyProgress()))).toBe(count(before));
    });

    it('keeps a completion resolvable by the id the app will rebuild', () => {
        // app.js getExerciseId(type, index, difficulty) === `${type}_${difficulty}_${index}`
        const out = migrateProgress(legacyProgress());
        const done = new Set(out.completedExercises.vocabulary);
        expect(done.has(`vocabulary_${canonicalLevel('medium')}_9`)).toBe(true);
        expect(done.has('vocabulary_medium_9')).toBe(false);
    });

    it('rewrites both id and difficulty in exerciseHistory', () => {
        const out = migrateProgress(legacyProgress());
        expect(out.exerciseHistory[0]).toMatchObject({ id: 'vocabulary_foundation_0', difficulty: 'foundation' });
        expect(out.exerciseHistory[1]).toMatchObject({ id: 'listening_confident_0', difficulty: 'confident' });
    });

    it('collapses duplicates two source levels could produce', () => {
        const out = migrateProgress({
            completedExercises: { vocabulary: ['vocabulary_medium_0', 'vocabulary_confident_0'] }
        });
        expect(out.completedExercises.vocabulary).toEqual(['vocabulary_confident_0']);
    });

    it('leaves an unrecognised level alone rather than guessing', () => {
        // Guessing would destroy the only evidence of what was selected;
        // loadProgress() normalises it through resolveDifficulty() anyway.
        const out = migrateProgress({
            currentDifficulty: 'expert',
            completedExercises: { vocabulary: ['vocabulary_expert_1'] }
        });
        expect(out.currentDifficulty).toBe('expert');
        expect(out.completedExercises.vocabulary).toEqual(['vocabulary_expert_1']);
    });

    it('tolerates every wrong shape a hand-edited store can hold', () => {
        expect(() => migrateProgress({ completedExercises: 'nope' })).not.toThrow();
        expect(() => migrateProgress({ completedExercises: { vocabulary: 'nope' } })).not.toThrow();
        expect(() => migrateProgress({ completedExercises: { vocabulary: [null, 42, {}] } })).not.toThrow();
        expect(() => migrateProgress({ exerciseHistory: 'nope' })).not.toThrow();
        expect(() => migrateProgress({ exerciseHistory: [null, 'x', 7] })).not.toThrow();
    });

    it('is byte-identical on a second run', () => {
        const once = migrateProgress(legacyProgress());
        const bytes = JSON.stringify(once);
        const twice = migrateProgress(JSON.parse(bytes));
        expect(JSON.stringify(twice)).toBe(bytes);
    });

    it('is byte-identical even when the version guard is bypassed', () => {
        // A corrupted or hand-edited version field must not be able to corrupt
        // data on a second pass — that is what the LEVEL_ALIASES identity
        // entries buy us, independently of the version check.
        const once = migrateProgress(legacyProgress());
        const bytes = JSON.stringify(once);
        const reset = JSON.parse(bytes);
        reset.schemaVersion = 1;
        const again = migrateProgress(reset);
        again.schemaVersion = SCHEMA_VERSION;
        expect(JSON.stringify(again)).toBe(bytes);
    });

    it('backs the pristine record up before rewriting it', () => {
        const raw = JSON.stringify(legacyProgress());
        localStorage.setItem(PROGRESS_KEY, raw);
        migrateProgress(JSON.parse(raw));
        expect(localStorage.getItem(PROGRESS_KEY + '.bak.v1')).toBe(raw);
    });

    it('does not touch a future record even though it holds legacy levels', () => {
        const input = Object.assign(legacyProgress(), { schemaVersion: FUTURE_VERSION });
        const bytes = JSON.stringify(input);
        expect(JSON.stringify(migrateProgress(input))).toBe(bytes);
    });
});

// ---------------------------------------------------------------------------
// US-302 / US-303 — typed SRS keys.
// ---------------------------------------------------------------------------

describe('srsTypedKey / srsRef', () => {
    it('namespaces a vocabulary word', () => {
        expect(srsTypedKey('vocab', 'Happy')).toBe('vocab:happy');
    });

    it('collapses whitespace to hyphens but does NOT slugify', () => {
        // phon:iː-ɪ has to keep its IPA, so this is deliberately not a slugifier.
        expect(srsTypedKey('coll', 'make a decision')).toBe('coll:make-a-decision');
        expect(srsTypedKey('phon', 'iː-ɪ')).toBe('phon:iː-ɪ');
        expect(srsRef('  Present   Perfect ')).toBe('present-perfect');
    });

    it('falls back to vocab for an unknown type rather than inventing one', () => {
        expect(srsTypedKey('mistake', 'happy')).toBe('vocab:happy');
        expect(srsTypedKey(undefined, 'happy')).toBe('vocab:happy');
    });

    it('returns empty string for an unkeyable ref, so callers can refuse', () => {
        ['', '   ', null, undefined].forEach(bad => {
            expect(srsTypedKey('vocab', bad)).toBe('');
        });
    });

    it('is idempotent on its own output — the fixed-point property', () => {
        expect(isTypedSrsKey('vocab:happy')).toBe(true);
        expect(isTypedSrsKey('happy')).toBe(false);
        expect(isTypedSrsKey('mistake:happy')).toBe(false);
        expect(isTypedSrsKey(null)).toBe(false);
    });
});

describe('migrateSrsData — typed keys, no loss (US-302)', () => {
    const legacyStore = () => ({
        happy: srsRecord(),
        achieve: srsRecord({
            word: 'Achieve', reps: 1, interval: 1, ease: 2.5, lapses: 0, due: NOW - 1000,
            data: { word: 'Achieve', quiz: { question: 'q2', options: ['x'], correct: 0 }, difficulty: 'intermediate' }
        }),
        // Self-reported, and with NO payload: not renderable, but still history.
        orphan: srsRecord({
            word: 'Orphan', reps: 0, interval: 0, ease: 1.9, lapses: 4, due: NOW - 60000,
            selfReported: true, selfReports: 2, lastSelfReported: NOW - 3 * DAY_MS, data: undefined
        })
    });

    it('renames every bare word key to vocab:<word>', () => {
        const out = migrateSrsData(legacyStore(), { fromVersion: 1 }).records;
        expect(Object.keys(out).sort()).toEqual(['vocab:achieve', 'vocab:happy', 'vocab:orphan']);
    });

    it('preserves every scheduling field exactly — this history is not reproducible', () => {
        const before = legacyStore();
        const out = migrateSrsData(legacyStore(), { fromVersion: 1 }).records;
        Object.keys(before).forEach(word => {
            const a = before[word];
            const b = out['vocab:' + word];
            expect(b).toBeDefined();
            SCHEDULING_FIELDS.forEach(f => expect(b[f]).toEqual(a[f]));
        });
    });

    it('keeps a record that cannot be rendered — it is still the learner\'s history', () => {
        const out = migrateSrsData(legacyStore(), { fromVersion: 1 }).records;
        expect(out['vocab:orphan']).toBeDefined();
        expect(out['vocab:orphan'].lapses).toBe(4);
        expect(out['vocab:orphan'].selfReports).toBe(2);
    });

    it('stamps type / ref / key onto each migrated record', () => {
        const rec = migrateSrsData(legacyStore(), { fromVersion: 1 }).records['vocab:happy'];
        expect(rec.type).toBe('vocab');
        expect(rec.ref).toBe('happy');
        expect(rec.key).toBe('vocab:happy');
    });

    it('renames the level cached in rec.data.difficulty', () => {
        const out = migrateSrsData(legacyStore(), { fromVersion: 1 }).records;
        expect(out['vocab:happy'].data.difficulty).toBe('foundation');
        expect(out['vocab:achieve'].data.difficulty).toBe('everyday');
    });

    it('drops the [object object] victim of the old _key bug', () => {
        // No recoverable identity behind that key, so there is nothing to keep.
        const out = migrateSrsData({
            '[object object]': srsRecord({ word: '[object Object]' }),
            happy: srsRecord()
        }, { fromVersion: 1 }).records;
        expect(Object.keys(out)).toEqual(['vocab:happy']);
    });

    it('keeps the more-advanced record when two keys collide', () => {
        const out = migrateSrsData({
            'vocab:happy': srsRecord({ reps: 1, interval: 1, lapses: 0 }),
            happy: srsRecord({ reps: 6, interval: 35, lapses: 3 })
        }, { fromVersion: 1 }).records;
        expect(Object.keys(out)).toEqual(['vocab:happy']);
        expect(out['vocab:happy'].reps).toBe(6);
    });

    it('completes a half-migrated store', () => {
        // The normal case, not an edge case: the steps are gated on shape.
        const out = migrateSrsData({
            'vocab:happy': srsRecord(),
            achieve: srsRecord({ word: 'Achieve', reps: 1 })
        }, { fromVersion: SCHEMA_VERSION }).records;
        expect(Object.keys(out).sort()).toEqual(['vocab:achieve', 'vocab:happy']);
        expect(out['vocab:achieve'].reps).toBe(1);
    });

    it('is byte-identical on a second run, and reports it changed nothing', () => {
        const once = migrateSrsData(legacyStore(), { fromVersion: 1 });
        const bytes = JSON.stringify(once.records);
        const twice = migrateSrsData(JSON.parse(bytes), { fromVersion: 1 });
        expect(JSON.stringify(twice.records)).toBe(bytes);
        expect(twice.changed).toBe(false);
        expect(once.changed).toBe(true);
    });

    it('returns the very same object when there is nothing to do', () => {
        // Not merely equal: the identical object, so no key re-ordering can
        // change the serialised bytes.
        const already = { 'vocab:happy': srsRecord({ data: { word: 'Happy', difficulty: 'foundation' } }) };
        expect(migrateSrsData(already, { fromVersion: 1 }).records).toBe(already);
    });

    it('backs the pristine store up before rewriting it', () => {
        const raw = JSON.stringify(legacyStore());
        localStorage.setItem(SRS_KEY, raw);
        migrateSrsData(JSON.parse(raw), { fromVersion: 1 });
        expect(localStorage.getItem(SRS_KEY + '.bak.v1')).toBe(raw);
    });

    it('takes no backup when it changes nothing', () => {
        localStorage.setItem(SRS_KEY, '{"vocab:happy":{}}');
        migrateSrsData({ 'vocab:happy': {} }, { fromVersion: 1 });
        expect(localStorage.getItem(SRS_KEY + '.bak.v1')).toBeNull();
    });

    it('leaves a future store completely alone', () => {
        const future = { 'vocab:happy': srsRecord(), 'mistake:xyz': { reps: 1, due: NOW } };
        const bytes = JSON.stringify(future);
        const out = migrateSrsData(future, { fromVersion: FUTURE_VERSION });
        expect(out.changed).toBe(false);
        expect(out.reason).toBe('future-version');
        expect(JSON.stringify(out.records)).toBe(bytes);
        expect(localStorage.getItem(SRS_KEY + '.bak.v' + FUTURE_VERSION)).toBeNull();
    });

    it('reads the progress stamp when no version is supplied', () => {
        // srsData carries no stamp of its own, so the single SCHEMA_VERSION
        // reaches it through learningProgress. See migrateSrsData's comment.
        localStorage.setItem(PROGRESS_KEY, JSON.stringify({ schemaVersion: FUTURE_VERSION }));
        expect(migrateSrsData({ happy: srsRecord() }).reason).toBe('future-version');
    });

    it('refuses to touch an unrecognised {version, records} envelope', () => {
        const envelope = { version: 9, records: { happy: srsRecord() } };
        const out = migrateSrsData(envelope, { fromVersion: 1 });
        expect(out.reason).toBe('unknown-envelope');
        expect(out.records).toBe(envelope);
    });

    it('still migrates a legacy word literally keyed "records"', () => {
        // The envelope sniff needs BOTH a numeric `version` and an object
        // `records`, so this falls through to the normal path.
        const out = migrateSrsData({ records: srsRecord({ word: 'Records' }) }, { fromVersion: 1 }).records;
        expect(Object.keys(out)).toEqual(['vocab:records']);
    });

    it('never throws on hostile input, and never invents records', () => {
        [null, undefined, 'garbage', 0, -1, true, NaN, [], [1, 2]].forEach(bad => {
            let out;
            expect(() => { out = migrateSrsData(bad, { fromVersion: 1 }); }).not.toThrow();
            expect(out.records).toEqual({});
            expect(out.changed).toBe(false);
        });
        expect(migrateSrsData({}, { fromVersion: 1 }).records).toEqual({});
    });

    it('leaves a non-record value where it is rather than prefixing it', () => {
        // A stray field from a hand-edited store is not an item. Prefixing it
        // would invent one; dropping it would destroy something unexplained.
        const out = migrateSrsData({ schemaVersion: 2, happy: srsRecord() }, { fromVersion: 1 }).records;
        expect(out.schemaVersion).toBe(2);
        expect(out['vocab:happy']).toBeDefined();
    });

    it('tolerates records that are not objects at all', () => {
        expect(() => migrateSrsData({ a: null, b: 'x', c: 7, d: [] }, { fromVersion: 1 })).not.toThrow();
    });
});
