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

describe('getDueWords — the daily cap (US-304 / FR-SRS-4)', () => {
    // n due records, most overdue first: w0 is the oldest, w(n-1) the newest.
    // Shaped like a real record so nothing under test has to special-case them.
    const seedDue = (n) => {
        SRS.records = {};
        for (let i = 0; i < n; i++) {
            const key = 'w' + i;
            SRS.records[key] = {
                word: key,
                reps: 1,
                interval: 1,
                ease: 2.5,
                lapses: 0,
                due: NOW - (n - i) * 1000,
                lastReviewed: NOW - DAY_MS,
                createdAt: NOW - DAY_MS,
                data: { word: key, quiz: { question: 'q', options: ['a', 'b'], correct: 0 } }
            };
        }
    };

    it('exposes the cap as a named constant, not a magic number', () => {
        expect(SRS.DAILY_REVIEW_CAP).toBe(20);
    });

    it('never offers more than the cap, however big the backlog', () => {
        seedDue(50);
        expect(SRS.getDueWords()).toHaveLength(SRS.DAILY_REVIEW_CAP);
    });

    it('leaves a queue under the cap untouched', () => {
        seedDue(5);
        expect(SRS.getDueWords()).toHaveLength(5);
        expect(SRS.dueCount()).toBe(5);
        expect(SRS.deferredCount()).toBe(0);
    });

    it('serves the most overdue items first', () => {
        seedDue(50);
        const expected = [];
        for (let i = 0; i < SRS.DAILY_REVIEW_CAP; i++) expected.push('w' + i);
        expect(SRS.getDueWords().map(r => r.word)).toEqual(expected);
    });

    it('breaks a due-date tie in favour of the most-lapsed item', () => {
        SRS.records = {
            steady: { word: 'steady', due: NOW - 1000, lapses: 0, data: { word: 'steady', quiz: {} } },
            shaky: { word: 'shaky', due: NOW - 1000, lapses: 4, data: { word: 'shaky', quiz: {} } }
        };
        expect(SRS.getDueWords().map(r => r.word)).toEqual(['shaky', 'steady']);
    });

    it('dueCount reports the capped queue, so the badge matches the session', () => {
        seedDue(50);
        expect(SRS.dueCount()).toBe(SRS.DAILY_REVIEW_CAP);
        expect(SRS.dueCount()).toBe(SRS.getDueWords().length);
    });

    it('still reports the honest backlog separately', () => {
        seedDue(50);
        expect(SRS.totalDueCount()).toBe(50);
        expect(SRS.deferredCount()).toBe(30);
        expect(SRS.getAllDueWords()).toHaveLength(50);
        const s = SRS.stats();
        expect(s.queued).toBe(20);
        expect(s.deferred).toBe(30);
        expect(s.due).toBe(50);
    });

    it('defers by writing nothing at all — no record is touched', () => {
        seedDue(50);
        const before = JSON.stringify(SRS.records);
        SRS.getDueWords();
        SRS.dueCount();
        expect(JSON.stringify(SRS.records)).toBe(before);
    });

    it('keeps deferred items due, and unmodified, the next day', () => {
        seedDue(50);
        const deferred = JSON.parse(JSON.stringify(SRS.records.w49));
        SRS.getDueWords();                       // w0..w19 offered, w20..w49 deferred

        SRS._now = () => NOW + DAY_MS;
        expect(SRS.records.w49).toEqual(deferred);   // interval and due untouched
        expect(SRS.totalDueCount()).toBe(50);        // still due, not lost
    });

    it('lets deferred items through once the queue in front of them clears', () => {
        seedDue(25);
        SRS.getDueWords().forEach(w => SRS.schedule(w, true));   // answer today's 20
        expect(SRS.totalDueCount()).toBe(5);
        expect(SRS.getDueWords().map(r => r.word))
            .toEqual(['w20', 'w21', 'w22', 'w23', 'w24']);
    });

    it('accepts an explicit limit for callers that want a different slice', () => {
        seedDue(50);
        expect(SRS.getDueWords(3)).toHaveLength(3);
        expect(SRS.getDueWords(0)).toHaveLength(0);
        expect(SRS.getDueWords(999)).toHaveLength(50);
        expect(SRS.getDueWords('lots')).toHaveLength(SRS.DAILY_REVIEW_CAP);
    });
});

describe('schedule — self-reported outcomes (US-306 / FR-SRS-5)', () => {
    // Three graded successes: reps 3, interval 8, due 8 days out, "learned".
    const learnedItem = () => {
        SRS.schedule(word(), true);
        SRS.schedule(word(), true);
        return SRS.schedule(word(), true);
    };

    it('flags the record as self-reported and counts it separately', () => {
        const rec = SRS.selfReport(word(), false);
        expect(rec.selfReported).toBe(true);
        expect(rec.selfReports).toBe(1);
        expect(rec.lastSelfReported).toBe(NOW);
        expect(SRS.isSelfReported('happy')).toBe(true);
    });

    it('brings the item back sooner on "not yet"', () => {
        // schedule() mutates and returns the live record, so the numbers to
        // compare against have to be copied out before the self-report.
        const dueBefore = learnedItem().due;
        expect(dueBefore).toBe(NOW + 8 * DAY_MS);

        const rec = SRS.selfReport(word(), false);
        expect(rec.due).toBe(NOW + DAY_MS);   // at most one day out
        expect(rec.interval).toBe(1);
        expect(rec.due).toBeLessThan(dueBefore);
    });

    it('leaves the verified-evidence fields alone on "not yet"', () => {
        const before = learnedItem();
        const reps = before.reps;
        const ease = before.ease;

        const rec = SRS.selfReport(word(), false);
        expect(rec.reps).toBe(reps);          // not a verified failure either
        expect(rec.ease).toBe(ease);
        expect(rec.lapses).toBe(0);           // must not pollute the mistake log
        expect(SRS.stats().lapses).toBe(0);
    });

    it('never extends an interval or a due date on a self-reported success', () => {
        const before = learnedItem();
        const dueBefore = before.due;
        const easeBefore = before.ease;
        const rec = SRS.selfReport(word(), true);
        expect(rec.due).toBe(dueBefore);      // not one millisecond further out
        expect(rec.interval).toBe(8);
        expect(rec.reps).toBe(3);
        expect(rec.ease).toBe(easeBefore);
    });

    it('cannot mark an item learned, however often it is self-reported', () => {
        for (let i = 0; i < 20; i++) SRS.selfReport(word(), true);
        const rec = SRS.getRecord('happy');
        expect(rec.reps).toBe(0);
        expect(rec.selfReports).toBe(20);
        expect(SRS.stats().learned).toBe(0);
    });

    it('cannot inflate the learned count of an already-graded item', () => {
        SRS.schedule(word({ word: 'one' }), true);
        SRS.schedule(word({ word: 'two' }), true);
        SRS.schedule(word({ word: 'two' }), true);
        SRS.schedule(word({ word: 'two' }), true);   // the only learned item
        const before = SRS.stats().learned;

        SRS.selfReport(word({ word: 'one' }), true);
        SRS.selfReport(word({ word: 'three' }), true);
        const after = SRS.stats();
        expect(after.learned).toBe(before);
        expect(after.selfReported).toBe(2);          // surfaced, never as learned
    });

    it('is not recorded as a review, because no review was graded', () => {
        const rec = SRS.selfReport(word(), false);
        expect(rec.lastReviewed).toBeNull();
        expect(SRS.schedule(word(), true).lastReviewed).toBe(NOW);
    });

    it('a graded outcome clears the self-reported flag again', () => {
        SRS.selfReport(word(), false);
        const rec = SRS.schedule(word(), true);
        expect(rec.selfReported).toBe(false);
        expect(rec.selfReports).toBe(1);   // the history is kept
        expect(SRS.isSelfReported('happy')).toBe(false);
    });

    it('keeps the two-argument call graded, so existing call sites are unchanged', () => {
        const rec = SRS.schedule(word(), false);
        expect(rec.selfReported).toBe(false);
        expect(rec.lapses).toBe(1);
        expect(rec.due).toBe(NOW);
        expect(rec.selfReports).toBeUndefined();
        expect(SRS.schedule(word(), false, {}).selfReported).toBe(false);
        expect(SRS.schedule(word(), false, { selfReported: false }).lapses).toBe(3);
    });

    it('reads a pre-FR-SRS-5 record without a flag as graded, with no migration', () => {
        // Exactly the shape the old code wrote: no selfReported, no selfReports.
        SRS.records = {
            happy: {
                word: 'Happy', reps: 3, interval: 8, ease: 2.8, lapses: 1,
                due: NOW - 1000, lastReviewed: NOW - DAY_MS, createdAt: NOW - 9 * DAY_MS,
                data: { word: 'Happy', quiz: { question: 'q', options: ['a'], correct: 0 } }
            }
        };
        expect(SRS.isSelfReported('happy')).toBe(false);
        expect(() => SRS.getDueWords()).not.toThrow();
        expect(SRS.dueCount()).toBe(1);
        expect(SRS.stats().learned).toBe(1);       // still verified-learned
        expect(SRS.stats().selfReported).toBe(0);  // absence is not self-report

        const rec = SRS.selfReport(word(), false);
        expect(rec.selfReports).toBe(1);           // counter starts from absent
        expect(rec.due).toBe(NOW - 1000);          // already sooner; not pushed out
        expect(rec.lapses).toBe(1);
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
