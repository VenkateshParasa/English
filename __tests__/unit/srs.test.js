/**
 * SRS — the spaced-repetition scheduler.
 *
 * Phase 4 has now landed the three couplings this file used to pin as KNOWN
 * DEFECTS: records are keyed `type:ref` (`vocab:happy`) instead of by bare word,
 * the payload whitelist is the per-type PROJECTORS registry, and the hardcoded
 * `data.quiz` filter is the per-type RENDERABLE predicate. The assertions that
 * documented those defects have been flipped and are marked "was KNOWN DEFECT"
 * so the change reads as intentional.
 *
 * Still pinned as a KNOWN DIVERGENCE: the interval ladder (1, 3, 8, 22 rather
 * than the documented 1, 3, 7, 16, 35). That is a forward-only behaviour change
 * with no data rewrite behind it, so it is deliberately NOT part of the
 * migration wave.
 */

const SRS = require('../../js/core/srs.js');
const Migrations = require('../../js/core/migrations.js');

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
    SRS._migrated = true;   // load() is exercised explicitly, not implicitly
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

    it('agrees with the migration about what key a word gets', () => {
        // If these two ever diverge, the migration writes records the runtime
        // cannot find — a learner's history present in storage and invisible.
        ['Happy', '  ACHIEVE ', 'make a decision', 'iː-ɪ'].forEach(ref => {
            expect(SRS._key(ref)).toBe(Migrations.srsRef(ref));
            expect(SRS._typedKey('vocab', ref)).toBe(Migrations.srsTypedKey('vocab', ref));
        });
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
        expect(Object.keys(SRS.records)).toEqual(['vocab:happy']);
        expect(SRS.records['vocab:happy'].reps).toBe(2);
    });

    it('keys records by type:ref (US-302)', () => {
        const rec = SRS.schedule(word(), true);
        expect(Object.keys(SRS.records)).toEqual(['vocab:happy']);
        expect(rec.key).toBe('vocab:happy');
        expect(rec.type).toBe('vocab');
        expect(rec.ref).toBe('happy');
    });

    it('accepts a bare string but then stores no payload', () => {
        const rec = SRS.schedule('happy', true);
        expect(rec.reps).toBe(1);
        expect(rec.data).toBeUndefined();
    });

    it('rejects an unkeyable item', () => {
        expect(SRS.schedule(null, true)).toBeNull();
        expect(SRS.schedule('', true)).toBeNull();
        expect(SRS.schedule('   ', true)).toBeNull();
        expect(SRS.schedule({}, true)).toBeNull();
    });

    it('stores only the fields PROJECTORS declares for the type', () => {
        const rec = SRS.schedule(word({ collocations: ['very happy'], register: 'neutral' }), true);
        expect(Object.keys(rec.data).sort())
            .toEqual(['definition', 'difficulty', 'example', 'pronunciation', 'quiz', 'word']);
        // Unchanged from the old inline whitelist ON PURPOSE, so this migration
        // moves no vocabulary bytes. Adding a vocabulary field now means adding
        // it to SRS.PROJECTORS.vocab — see docs/CONTENT_AUTHORING_GUIDE.md.
        expect(SRS.PROJECTORS.vocab).toEqual(
            ['word', 'pronunciation', 'definition', 'example', 'quiz', 'difficulty']);
        expect(rec.data.collocations).toBeUndefined();
        expect(rec.data.register).toBeUndefined();
    });

    it('refuses an object it cannot identify instead of colliding it', () => {
        // was KNOWN DEFECT (srs.js:76): `wordObj.word || wordObj` fell through to
        // the object itself, which String()s to "[object object]", so every
        // grammar point and phoneme pair shared ONE record. Refusing is the
        // honest alternative — a caller with a real item passes srsType/srsRef.
        expect(SRS.schedule({ id: 'present-perfect', practice: [] }, true)).toBeNull();
        expect(SRS.schedule({ id: 'articles', practice: [] }, true)).toBeNull();
        expect(SRS.records['[object object]']).toBeUndefined();
        expect(Object.keys(SRS.records)).toEqual([]);
    });

    it('adopts a pre-migration bare key instead of forking the schedule', () => {
        // Safety net for a record that reached memory without going through
        // load(): writing to `vocab:happy` while `happy` still existed would
        // split one item into two competing schedules.
        SRS.records = {
            happy: {
                word: 'Happy', reps: 4, interval: 16, ease: 2.6, lapses: 1,
                due: NOW - 1, lastReviewed: NOW - DAY_MS, createdAt: NOW - 40 * DAY_MS,
                data: { word: 'Happy', quiz: { question: 'q', options: ['a'], correct: 0 } }
            }
        };
        const rec = SRS.schedule(word(), true);
        expect(Object.keys(SRS.records)).toEqual(['vocab:happy']);
        expect(rec.reps).toBe(5);        // continued, not restarted
        expect(rec.lapses).toBe(1);
        expect(rec.createdAt).toBe(NOW - 40 * DAY_MS);
    });
});

describe('typed items — grammar, phonemes, collocations (US-302 / US-303)', () => {
    it('keys each of the four types from TEACHING_METHODOLOGY.md §3', () => {
        SRS.scheduleItem('vocab', 'Happy', { word: 'Happy', quiz: {} }, true);
        SRS.scheduleItem('gram', 'present perfect', { id: 'pp', explanation: 'x' }, false);
        SRS.scheduleItem('phon', 'iː-ɪ', { id: 'iː-ɪ', pair: ['sheep', 'ship'] }, false);
        SRS.scheduleItem('coll', 'make a decision', { chunk: 'make a decision' }, false);
        expect(Object.keys(SRS.records).sort()).toEqual([
            'coll:make-a-decision', 'gram:present-perfect', 'phon:iː-ɪ', 'vocab:happy'
        ]);
    });

    it('keeps IPA intact rather than slugifying it away', () => {
        SRS.scheduleItem('phon', 'iː-ɪ', { id: 'iː-ɪ' }, false);
        expect(SRS.records['phon:iː-ɪ']).toBeDefined();
        expect(SRS.getRecord('iː-ɪ', 'phon')).not.toBeNull();
    });

    it('accepts an inline { srsType, srsRef } item through plain schedule()', () => {
        const rec = SRS.schedule({ srsType: 'gram', srsRef: 'articles', explanation: 'a/an/the' }, false);
        expect(rec.key).toBe('gram:articles');
        expect(rec.data.explanation).toBe('a/an/the');
    });

    it('projects non-vocab payloads per type, dropping absent fields', () => {
        const rec = SRS.scheduleItem('gram', 'articles',
            { id: 'articles', title: 'Articles', explanation: 'x', junk: 'dropped' }, false);
        expect(Object.keys(rec.data).sort()).toEqual(['explanation', 'id', 'title']);
        expect(rec.data.junk).toBeUndefined();
    });

    it('is on the same ladder as vocabulary — one scheduler, four types', () => {
        const rec = SRS.scheduleItem('gram', 'articles', { id: 'articles' }, true);
        expect(rec.reps).toBe(1);
        expect(rec.interval).toBe(1);
        expect(rec.due).toBe(NOW + DAY_MS);
    });

    it('does not read a vocabulary word\'s part-of-speech as an SRS type', () => {
        // A rich vocabulary entry may carry `type: 'noun'` — or, worse, a value
        // that collides with one of our four type names. Filing the word under
        // the wrong strand would hide it from the vocabulary review queue.
        expect(SRS.schedule(word({ type: 'noun' }), true).key).toBe('vocab:happy');
        expect(SRS.schedule(word({ word: 'Chunk', type: 'coll' }), true).key).toBe('vocab:chunk');
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
        expect(SRS.records['vocab:happy'].data.word).toBe('Happy');
    });

    it('hides records with no quiz payload', () => {
        // Unchanged behaviour, reached differently: the hardcoded `data.quiz`
        // filter is now RENDERABLE.vocab, which is exactly the same predicate.
        // A vocabulary review card IS a quiz, so a record without one cannot be
        // drawn. Non-vocab types are no longer caught by it — see getDue().
        SRS.schedule('orphan', false);
        expect(SRS.records['vocab:orphan']).toBeDefined();
        expect(SRS.getDueWords()).toHaveLength(0);
        expect(SRS.dueCount()).toBe(0);
    });

    it('still returns a non-vocab item that has no quiz, via getDue', () => {
        // was KNOWN CONSEQUENCE (srs.js:139): a grammar point could be scheduled
        // but never surfaced and was never counted, because the filter demanded a
        // quiz. RENDERABLE.gram only asks for a payload.
        SRS.scheduleItem('gram', 'articles', { id: 'articles', explanation: 'a/an/the' }, false);
        expect(SRS.getDue('gram')).toHaveLength(1);
        expect(SRS.getDue('gram')[0].data.explanation).toBe('a/an/the');
        expect(SRS.countDue('gram')).toBe(1);
        // ...and it does not leak into the vocabulary review flow.
        expect(SRS.getDueWords()).toHaveLength(0);
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
    it('are named, and each answers exactly one question', () => {
        // was KNOWN INCONSISTENCY: dueCount() counted due-AND-renderable while
        // stats().due counted due-regardless, and nothing said so. The figures
        // still differ — they have to — but each now has a name and a meaning:
        //   dueCount()          capped + renderable  -> what the badge promises
        //   stats().actionable  renderable, uncapped -> work that could be shown
        //   stats().due         due, uncapped        -> work that exists at all
        SRS.schedule(word(), false);   // due now, has a quiz
        SRS.schedule('orphan', false); // due now, no quiz
        expect(SRS.dueCount()).toBe(1);
        expect(SRS.stats().actionable).toBe(1);
        expect(SRS.stats().due).toBe(2);
    });

    it('holds dueCount() <= actionable <= due, always', () => {
        // "Review Due (7)" followed by a 3-item session is a trust bug, forbidden
        // by methodology §3 as much as a false "Perfect!" is.
        for (let i = 0; i < 30; i++) SRS.schedule(word({ word: 'w' + i }), false);
        for (let i = 0; i < 5; i++) SRS.schedule('noquiz' + i, false);
        SRS.scheduleItem('gram', 'g1', { id: 'g1' }, false);
        const s = SRS.stats();
        expect(SRS.dueCount()).toBeLessThanOrEqual(s.actionable);
        expect(s.actionable).toBeLessThanOrEqual(s.due);
        expect(SRS.dueCount()).toBe(SRS.getDueWords().length);
    });

    it('keeps the badge equal to the session review mode actually walks', () => {
        // dueCount() defaults to vocab because startReview() walks getDueWords(),
        // which is vocab-only. Counting grammar here would promise a longer
        // session than the button opens.
        for (let i = 0; i < 25; i++) SRS.schedule(word({ word: 'w' + i }), false);
        SRS.scheduleItem('gram', 'g1', { id: 'g1' }, false);
        expect(SRS.dueCount()).toBe(SRS.getDueWords().length);
        expect(SRS.dueCount()).toBe(SRS.DAILY_REVIEW_CAP);
        expect(SRS.dueCount(null)).toBe(SRS.getDue(null).length);
    });
});

describe('getDue — interleaving across types (US-303)', () => {
    const seed = (type, n, base) => {
        for (let i = 0; i < n; i++) {
            const key = type + ':' + type[0] + i;
            SRS.records[key] = {
                key: key, type: type, ref: type[0] + i,
                reps: 1, interval: 1, ease: 2.5, lapses: 0,
                due: NOW - base + i,
                lastReviewed: NOW - DAY_MS, createdAt: NOW - DAY_MS,
                data: type === 'vocab'
                    ? { word: type[0] + i, quiz: { question: 'q', options: ['a'], correct: 0 } }
                    : { id: type[0] + i }
            };
        }
    };

    it('does not let vocabulary starve the other strands', () => {
        // A global oldest-first sort then slice(0,20) would fill all 20 slots with
        // vocabulary, defeating CURRICULUM.md §3 ("every session touches at least
        // three strands"). Round-robin instead.
        SRS.records = {};
        seed('vocab', 30, 100000);   // much more overdue than the rest
        seed('gram', 5, 10);
        const types = SRS.getDue(null).map(i => i.type);
        expect(types).toHaveLength(SRS.DAILY_REVIEW_CAP);
        expect(types.filter(t => t === 'gram')).toHaveLength(5);
        expect(types.slice(0, 4)).toEqual(['vocab', 'gram', 'vocab', 'gram']);
    });

    it('keeps strict oldest-due-first order inside each strand', () => {
        SRS.records = {};
        seed('gram', 4, 1000);
        expect(SRS.getDue('gram').map(i => i.ref)).toEqual(['g0', 'g1', 'g2', 'g3']);
    });

    it('respects the cap across types, not per type', () => {
        SRS.records = {};
        seed('vocab', 30, 100000);
        seed('gram', 30, 50000);
        expect(SRS.getDue(null)).toHaveLength(SRS.DAILY_REVIEW_CAP);
        expect(SRS.getDue(null, { limit: 7 })).toHaveLength(7);
        expect(SRS.getDue(null, { limit: 0 })).toHaveLength(0);
    });

    it('writes nothing — deferral stays read-only for typed items too', () => {
        SRS.records = {};
        seed('vocab', 25, 100000);
        seed('phon', 25, 100000);
        const before = JSON.stringify(SRS.records);
        SRS.getDue(null);
        SRS.getDue('phon');
        SRS.countDue();
        SRS.stats();
        expect(JSON.stringify(SRS.records)).toBe(before);
    });

    it('fails closed on a record whose type this build does not know', () => {
        // A record written by a newer release must not be poured into a card
        // this build has no idea how to draw.
        SRS.records = {
            'mistake:xyz': { key: 'mistake:xyz', type: 'mistake', due: NOW - 1, data: { anything: 1 } }
        };
        expect(SRS.getDue(null)).toHaveLength(0);
        expect(SRS.countDue()).toBe(0);
        expect(SRS.stats().due).toBe(1);          // still counted honestly
        expect(SRS.stats().actionable).toBe(0);
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

    it('scopes to one type when asked', () => {
        SRS.schedule(word(), true);
        SRS.scheduleItem('gram', 'articles', { id: 'articles' }, false);
        expect(SRS.stats('vocab').total).toBe(1);
        expect(SRS.stats('gram').total).toBe(1);
        expect(SRS.stats('gram').lapses).toBe(1);
        expect(SRS.stats('vocab').lapses).toBe(0);
        expect(SRS.stats().total).toBe(2);
    });
});

describe('persistence and the legacy-key migration (US-302)', () => {
    // A record exactly as the pre-typed-key code wrote it: bare lowercase key,
    // legacy level name inside the payload, full scheduling state.
    const legacyStored = () => ({
        happy: {
            word: 'Happy', reps: 3, interval: 8, ease: 2.8, lapses: 1,
            due: NOW - 5000, lastReviewed: NOW - 8 * DAY_MS, createdAt: NOW - 30 * DAY_MS,
            data: {
                word: 'Happy', pronunciation: '/ˈhæpi/', definition: 'Feeling pleasure',
                example: 'She was happy.',
                quiz: { question: 'q', options: ['a', 'b'], correct: 1 },
                difficulty: 'medium'
            }
        },
        orphan: {
            word: 'Orphan', reps: 0, interval: 0, ease: 1.9, lapses: 4,
            due: NOW - 60000, lastReviewed: NOW - 3 * DAY_MS, createdAt: NOW - 10 * DAY_MS,
            selfReported: true, selfReports: 2, lastSelfReported: NOW - 3 * DAY_MS
        }
    });

    const loadFresh = () => {
        SRS.records = {};
        SRS._migrated = false;
        SRS.load();
    };

    it('round-trips through localStorage', () => {
        SRS.schedule(word(), true);
        loadFresh();
        expect(SRS.records['vocab:happy'].reps).toBe(1);
    });

    it('migrates legacy bare-word keys on load, losing nothing', () => {
        const before = legacyStored();
        localStorage.setItem('srsData', JSON.stringify(before));
        loadFresh();

        expect(Object.keys(SRS.records).sort()).toEqual(['vocab:happy', 'vocab:orphan']);
        ['reps', 'interval', 'ease', 'lapses', 'due', 'lastReviewed', 'createdAt']
            .forEach(f => expect(SRS.records['vocab:happy'][f]).toBe(before.happy[f]));
        expect(SRS.records['vocab:orphan'].selfReports).toBe(2);
        expect(SRS.records['vocab:orphan'].lapses).toBe(4);
    });

    it('renames the level cached in the payload while it is there', () => {
        localStorage.setItem('srsData', JSON.stringify(legacyStored()));
        loadFresh();
        expect(SRS.records['vocab:happy'].data.difficulty).toBe('confident');
    });

    it('keeps the record findable by the word the app still holds', () => {
        localStorage.setItem('srsData', JSON.stringify(legacyStored()));
        loadFresh();
        expect(SRS.getRecord('happy').reps).toBe(3);
        expect(SRS.getRecord('Happy').reps).toBe(3);
        expect(SRS.getRecord('vocab:happy').reps).toBe(3);
        expect(SRS.isSelfReported('orphan')).toBe(true);
    });

    it('keeps the review queue working across the rename', () => {
        localStorage.setItem('srsData', JSON.stringify(legacyStored()));
        loadFresh();
        expect(SRS.getDueWords().map(w => w.word)).toEqual(['Happy']);  // orphan has no payload
        expect(SRS.dueCount()).toBe(1);
        expect(SRS.stats().due).toBe(2);          // both are due; one is not showable
    });

    it('persists the migration once and is then byte-identical', () => {
        localStorage.setItem('srsData', JSON.stringify(legacyStored()));
        loadFresh();
        const first = localStorage.getItem('srsData');
        expect(first).toContain('vocab:happy');

        loadFresh();
        expect(localStorage.getItem('srsData')).toBe(first);
        loadFresh();
        expect(localStorage.getItem('srsData')).toBe(first);
    });

    it('backs the pristine store up exactly once', () => {
        const raw = JSON.stringify(legacyStored());
        localStorage.setItem('srsData', raw);
        loadFresh();
        expect(localStorage.getItem('srsData.bak.v1')).toBe(raw);
        loadFresh();
        expect(localStorage.getItem('srsData.bak.v1')).toBe(raw);   // not clobbered
    });

    it('leaves an already-migrated store completely untouched', () => {
        SRS.schedule(word(), true);
        const bytes = localStorage.getItem('srsData');
        loadFresh();
        expect(localStorage.getItem('srsData')).toBe(bytes);
        expect(localStorage.getItem('srsData.bak.v1')).toBeNull();
    });

    it('init() is idempotent and does not clobber migrated memory', () => {
        localStorage.setItem('srsData', JSON.stringify(legacyStored()));
        SRS.records = {};
        SRS._migrated = false;
        SRS.init();
        SRS.schedule(word({ word: 'later' }), true);
        SRS.init();                                    // must not reload over it
        expect(SRS.records['vocab:later']).toBeDefined();
        expect(SRS.records['vocab:happy']).toBeDefined();
    });

    it('starts clean on corrupt stored JSON rather than throwing', () => {
        localStorage.setItem('srsData', '{not json');
        expect(() => loadFresh()).not.toThrow();
        expect(SRS.records).toEqual({});
    });

    it('starts clean on any non-map stored value', () => {
        ['"a string"', '0', '-1', 'null', 'true', '[]', '[1,2]'].forEach(raw => {
            localStorage.setItem('srsData', raw);
            expect(() => loadFresh()).not.toThrow();
            expect(SRS.records).toEqual({});
        });
    });

    it('reset clears memory and storage', () => {
        SRS.schedule(word(), true);
        SRS.reset();
        expect(SRS.records).toEqual({});
        expect(localStorage.getItem('srsData')).toBeNull();
    });
});
