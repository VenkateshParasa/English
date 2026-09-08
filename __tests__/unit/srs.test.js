/**
 * SRS — the spaced-repetition scheduler.
 *
 * These tests pin CURRENT behaviour, including the three couplings that Phase 4
 * will deliberately change (the `.word`-only key, the 6-field payload
 * whitelist, and the `data.quiz` filter in getDueWords). Where a test documents
 * a known defect rather than desired behaviour it says so, so that when Phase 4
 * flips it the failure reads as "expected change", not "regression".
 */

const SRS = require('../../js/core/srs.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1700000000000;   // fixed clock; Date.now() would make tests flaky

const word = (over = {}) => Object.assign({
    word: 'Happy',
    pronunciation: '/ˈhæpi/',
    definition: 'Feeling pleasure',
    example: 'She was happy.',
    quiz: { question: 'q', options: ['a', 'b'], correct: 1 }
}, over);

beforeEach(() => {
    SRS.records = {};
    SRS._now = () => NOW;
});

describe('_key', () => {
    it('normalizes case and whitespace so a word has one record', () => {
        expect(SRS._key('  Happy ')).toBe('happy');
        expect(SRS._key('HAPPY')).toBe('happy');
    });

    it('returns empty string for nullish input', () => {
        expect(SRS._key(null)).toBe('');
        expect(SRS._key(undefined)).toBe('');
    });
});

describe('schedule — the success ladder', () => {
    it('first correct answer is due tomorrow', () => {
        const rec = SRS.schedule(word(), true);
        expect(rec.reps).toBe(1);
        expect(rec.interval).toBe(1);
        expect(rec.due).toBe(NOW + DAY_MS);
    });

    it('second correct answer is due in three days', () => {
        SRS.schedule(word(), true);
        const rec = SRS.schedule(word(), true);
        expect(rec.reps).toBe(2);
        expect(rec.interval).toBe(3);
    });

    it('subsequent answers multiply by ease', () => {
        SRS.schedule(word(), true);
        SRS.schedule(word(), true);
        const rec = SRS.schedule(word(), true);
        expect(rec.reps).toBe(3);
        // KNOWN DIVERGENCE from docs/TEACHING_METHODOLOGY.md §3, which
        // specifies the ladder 1 -> 3 -> 7 -> 16 -> 35. The current code
        // yields round(3 * 2.7) = 8. Phase 4 replaces this with an explicit
        // INTERVAL_STEPS ladder; this expectation is meant to change then.
        expect(rec.interval).toBe(8);
    });

    it('raises ease on success, capped at the maximum', () => {
        let rec;
        for (let i = 0; i < 10; i++) rec = SRS.schedule(word(), true);
        expect(rec.ease).toBeLessThanOrEqual(2.8);
        expect(rec.ease).toBeCloseTo(2.8, 5);
    });
});

describe('schedule — lapses', () => {
    it('resets progress and stays due immediately', () => {
        SRS.schedule(word(), true);
        SRS.schedule(word(), true);
        const rec = SRS.schedule(word(), false);
        expect(rec.reps).toBe(0);
        expect(rec.interval).toBe(0);
        expect(rec.lapses).toBe(1);
        expect(rec.due).toBe(NOW);   // stays hot inside the session
    });

    it('lowers ease on failure, floored at the minimum', () => {
        let rec;
        for (let i = 0; i < 20; i++) rec = SRS.schedule(word(), false);
        expect(rec.ease).toBeGreaterThanOrEqual(1.3);
        expect(rec.ease).toBeCloseTo(1.3, 5);
    });
});

describe('schedule — identity and payload', () => {
    it('treats different casings as the same item', () => {
        SRS.schedule(word({ word: 'Happy' }), true);
        SRS.schedule(word({ word: 'happy' }), true);
        expect(Object.keys(SRS.records)).toEqual(['happy']);
        expect(SRS.records.happy.reps).toBe(2);
    });

    it('accepts a bare string but then stores no payload', () => {
        const rec = SRS.schedule('happy', true);
        expect(rec.reps).toBe(1);
        expect(rec.data).toBeUndefined();
    });

    it('rejects an unkeyable item', () => {
        expect(SRS.schedule(null, true)).toBeNull();
        expect(SRS.schedule('', true)).toBeNull();
    });

    it('stores only the six whitelisted payload fields', () => {
        const rec = SRS.schedule(word({ collocations: ['very happy'], register: 'neutral' }), true);
        expect(Object.keys(rec.data).sort())
            .toEqual(['definition', 'difficulty', 'example', 'pronunciation', 'quiz', 'word']);
        // KNOWN DEFECT: authored fields are silently dropped. Phase 4 replaces
        // the whitelist with a per-type projector registry.
        expect(rec.data.collocations).toBeUndefined();
        expect(rec.data.register).toBeUndefined();
    });

    it('collides every non-word object onto one record', () => {
        // KNOWN DEFECT (srs.js:76): `wordObj.word || wordObj` falls through to
        // the object itself, which String()s to "[object object]". This is why
        // grammar points and phoneme pairs cannot use the scheduler today, and
        // it is the coupling Phase 4 fixes with typed keys.
        SRS.schedule({ id: 'present-perfect', practice: [] }, true);
        SRS.schedule({ id: 'articles', practice: [] }, true);
        expect(Object.keys(SRS.records)).toEqual(['[object object]']);
    });
});

describe('getDueWords', () => {
    it('returns nothing before the due date', () => {
        SRS.schedule(word(), true);          // due tomorrow
        expect(SRS.getDueWords()).toHaveLength(0);
    });

    it('returns the word once it is due', () => {
        SRS.schedule(word(), true);
        SRS._now = () => NOW + DAY_MS + 1;
        const due = SRS.getDueWords();
        expect(due).toHaveLength(1);
        expect(due[0].word).toBe('Happy');
    });

    it('orders oldest due first', () => {
        SRS.records = {
            a: { word: 'a', due: NOW - 3000, data: { word: 'a', quiz: {} } },
            b: { word: 'b', due: NOW - 1000, data: { word: 'b', quiz: {} } },
            c: { word: 'c', due: NOW - 2000, data: { word: 'c', quiz: {} } }
        };
        expect(SRS.getDueWords().map(r => r.word)).toEqual(['a', 'c', 'b']);
    });

    it('returns copies, so callers cannot corrupt the store', () => {
        SRS.schedule(word(), false);         // due now
        const due = SRS.getDueWords();
        due[0].word = 'MUTATED';
        expect(SRS.records.happy.data.word).toBe('Happy');
    });

    it('hides records with no quiz payload', () => {
        // KNOWN CONSEQUENCE (srs.js:139): an item scheduled without a quiz is
        // persisted but never surfaces and is never counted. Phase 4 replaces
        // this filter with a per-type renderability predicate.
        SRS.schedule('orphan', false);
        expect(SRS.records.orphan).toBeDefined();
        expect(SRS.getDueWords()).toHaveLength(0);
        expect(SRS.dueCount()).toBe(0);
    });
});

describe('dueCount vs stats().due', () => {
    it('disagree, because they filter differently', () => {
        // KNOWN INCONSISTENCY: dueCount() counts due-AND-renderable while
        // stats().due counts due-regardless, so the review badge and the
        // dashboard can differ with no explanation to the learner. Phase 4
        // reconciles these into getDue / countDue / dueCount / stats.
        SRS.schedule(word(), false);   // due now, has a quiz
        SRS.schedule('orphan', false); // due now, no quiz
        expect(SRS.dueCount()).toBe(1);
        expect(SRS.stats().due).toBe(2);
    });
});

describe('stats', () => {
    it('counts totals, learned and lapses', () => {
        SRS.schedule(word({ word: 'one' }), true);
        SRS.schedule(word({ word: 'one' }), true);
        SRS.schedule(word({ word: 'one' }), true);   // reps 3 => learned
        SRS.schedule(word({ word: 'two' }), false);  // 1 lapse
        const s = SRS.stats();
        expect(s.total).toBe(2);
        expect(s.learned).toBe(1);
        expect(s.lapses).toBe(1);
    });
});

describe('persistence', () => {
    it('round-trips through localStorage', () => {
        SRS.schedule(word(), true);
        SRS.records = {};
        SRS.load();
        expect(SRS.records.happy.reps).toBe(1);
    });

    it('starts clean on corrupt stored JSON rather than throwing', () => {
        localStorage.setItem('srsData', '{not json');
        expect(() => SRS.load()).not.toThrow();
        expect(SRS.records).toEqual({});
    });

    it('reset clears memory and storage', () => {
        SRS.schedule(word(), true);
        SRS.reset();
        expect(SRS.records).toEqual({});
        expect(localStorage.getItem('srsData')).toBeNull();
    });
});
