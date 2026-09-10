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
 * The last KNOWN DIVERGENCE is gone too. The interval ladder was pinned here at
 * 1, 3, 8, 22 against the 1, 3, 7, 16, 35 that FR-SRS-2 and
 * TEACHING_METHODOLOGY.md §3 specify; `OQ-10` decided in favour of the specified
 * ladder and `_applyGraded()` now walks it, holding at 35 rather than
 * multiplying past the end. Those assertions are flipped below and marked
 * "was KNOWN DIVERGENCE". The change is forward-only — no stored record is
 * recomputed — and the tests that pin what happens to a record already sitting
 * on `interval: 62` are in "the interval ladder" block.
 *
 * ⚠️ jest is NOT installed in this repo (`node_modules` has no jest binary), so
 * NOTHING in this file has been run. It was written against the real content
 * files and verified by a plain-node harness instead; treat every assertion here
 * as unverified until someone installs jest and runs it.
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

describe('schedule — the success ladder (FR-SRS-2 / OQ-10)', () => {
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

    it('walks the ladder FR-SRS-2 specifies: 1, 3, 7, 16, 35', () => {
        // was KNOWN DIVERGENCE. `_applyGraded()` used to compute
        // round(interval * ease) from the third success on, which yields
        // 1, 3, 8, 22, 62 — the sequence this test pinned while naming
        // TEACHING_METHODOLOGY.md §3 as the thing it disagreed with. OQ-10
        // resolved the disagreement in favour of the documented ladder.
        const seen = [];
        for (let i = 0; i < 5; i++) seen.push(SRS.schedule(word(), true).interval);
        expect(seen).toEqual([1, 3, 7, 16, 35]);
        expect(seen).toEqual(SRS.INTERVAL_STEPS);
    });

    it('HOLDS at the last rung instead of running away', () => {
        // The reason the fixed ladder won. `ease` caps at 2.8 but the product
        // `interval * ease` capped at nothing, so the old ladder continued
        // 62 -> 174 -> 487 -> 1,364 days: seven right answers put an item 16
        // months out and eight put it nearly four years out, reachable by luck on
        // a four-option quiz. Holding makes MAX_INTERVAL_DAYS a fact.
        let rec;
        for (let i = 0; i < 12; i++) rec = SRS.schedule(word(), true);
        expect(rec.reps).toBe(12);
        expect(rec.interval).toBe(35);
        expect(rec.interval).toBe(SRS.MAX_INTERVAL_DAYS);
        expect(rec.due).toBe(NOW + 35 * DAY_MS);
    });

    it('derives the rung from reps alone, so nothing compounds', () => {
        // The old rule multiplied the PREVIOUS interval, so one implausible value
        // poisoned every value after it and the record could never recover.
        expect(SRS.intervalForReps(1)).toBe(1);
        expect(SRS.intervalForReps(3)).toBe(7);
        expect(SRS.intervalForReps(5)).toBe(35);
        expect(SRS.intervalForReps(99)).toBe(35);
        // Nonsense reps read as the first rung: sooner, never later.
        expect(SRS.intervalForReps(0)).toBe(1);
        expect(SRS.intervalForReps(-4)).toBe(1);
        expect(SRS.intervalForReps(undefined)).toBe(1);
        expect(SRS.intervalForReps(NaN)).toBe(1);
    });

    it('raises ease on success, capped at the maximum', () => {
        let rec;
        for (let i = 0; i < 10; i++) rec = SRS.schedule(word(), true);
        expect(rec.ease).toBeLessThanOrEqual(2.8);
        expect(rec.ease).toBeCloseTo(2.8, 5);
    });

    it('keeps ease as a queue-ORDER tie-break, not an interval input', () => {
        // OQ-10: "keep `ease` for ordering only". Two items equally overdue with
        // equal lapses: the harder one (lower ease) goes first.
        SRS.records = {
            'vocab:easy': { key: 'vocab:easy', type: 'vocab', ref: 'easy', word: 'easy',
                due: NOW - 1000, lapses: 0, ease: 2.8, data: { word: 'easy', quiz: {} } },
            'vocab:hard': { key: 'vocab:hard', type: 'vocab', ref: 'hard', word: 'hard',
                due: NOW - 1000, lapses: 0, ease: 1.4, data: { word: 'hard', quiz: {} } }
        };
        expect(SRS.getDueWords().map(r => r.word)).toEqual(['hard', 'easy']);
    });

    it('publishes the ladder as policy rather than as a magic sequence', () => {
        expect(SRS.INTERVAL_STEPS).toEqual([1, 3, 7, 16, 35]);
        expect(SRS.MAX_INTERVAL_DAYS).toBe(35);
        // A copy, so a caller cannot rewrite the policy by editing the array.
        SRS.INTERVAL_STEPS.push(99);
        expect(SRS.intervalForReps(6)).toBe(35);
        SRS.INTERVAL_STEPS.pop();
    });
});

// ---------------------------------------------------------------------------
// FR-SRS-2 / OQ-10 — what happens to records written by the OLD rule.
// Forward-only: nothing recomputes history (REQUIREMENTS.md §6.7).
// ---------------------------------------------------------------------------
describe('the interval ladder — records already on a large interval', () => {
    const legacy = (over = {}) => {
        SRS.records = {
            'vocab:legacy': Object.assign({
                key: 'vocab:legacy', type: 'vocab', ref: 'legacy', word: 'legacy',
                reps: 5, interval: 62, ease: 2.8, lapses: 0,
                due: NOW + 62 * DAY_MS, lastReviewed: NOW, createdAt: NOW - 90 * DAY_MS,
                data: { word: 'legacy', quiz: { question: 'q', options: ['a'], correct: 0 } }
            }, over)
        };
        return SRS.records['vocab:legacy'];
    };

    it('leaves the stored interval and due date exactly where they were', () => {
        legacy();
        const before = JSON.stringify(SRS.records);
        SRS.getDue(null); SRS.getDueWords(); SRS.dueCount(); SRS.stats();
        expect(JSON.stringify(SRS.records)).toBe(before);
    });

    it('drops 62 to 35 on the next graded success — the cap arriving', () => {
        // 1, 3, 8, 22, 62 are reps 1..5, so the next success is rep 6 and reads
        // rung min(6, 5) = 5. The interval SHORTENS, which is the point.
        legacy();
        const rec = SRS.schedule(word({ word: 'legacy' }), true);
        expect(rec.reps).toBe(6);
        expect(rec.interval).toBe(35);
        expect(rec.due).toBe(NOW + 35 * DAY_MS);
    });

    it('still resets to 1 day on a lapse, unchanged', () => {
        legacy();
        const rec = SRS.schedule(word({ word: 'legacy' }), false);
        expect(rec.reps).toBe(0);
        expect(rec.interval).toBe(0);
        expect(rec.due).toBe(NOW);
        expect(SRS.schedule(word({ word: 'legacy' }), true).interval).toBe(1);
    });

    it('reads a stored 62 as days, never as nonsense', () => {
        legacy();
        const rec = SRS.selfReport(word({ word: 'legacy' }), false);
        expect(rec.interval).toBe(1);
        expect(rec.due).toBe(NOW + DAY_MS);
    });

    it('resolves a huge interval with no reps to the FIRST rung, not the last', () => {
        // A hand-edited, imported or corrupt record. Under-claiming how well an
        // item is known is the safe direction (methodology principle 3).
        legacy({ reps: 0, interval: 487, due: NOW - 1 });
        expect(SRS.schedule(word({ word: 'legacy' }), true).interval).toBe(1);
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
        SRS.scheduleItem('gram', 'present perfect', { id: 'pp', explain: 'x' }, false);
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
        // `explain`, not `explanation`: the authored field name in data/grammar.js.
        // This assertion said `explanation` until US-148 — it was left behind when
        // PROJECTORS.gram was corrected, so it was asserting that a field no
        // grammar point has survives projection, and it could not have passed.
        const rec = SRS.schedule({ srsType: 'gram', srsRef: 'articles', explain: 'a/an/the' }, false);
        expect(rec.key).toBe('gram:articles');
        expect(rec.data.explain).toBe('a/an/the');
    });

    it('projects non-vocab payloads per type, dropping absent fields', () => {
        const rec = SRS.scheduleItem('gram', 'articles',
            { id: 'articles', title: 'Articles', explain: 'x', junk: 'dropped' }, false);
        expect(Object.keys(rec.data).sort()).toEqual(['explain', 'id', 'title']);
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
        // quiz. RENDERABLE.gram asks for what a grammar review card needs instead
        // — the one-sentence rule plus a resolvable review prompt (FR-GRM-3).
        // `explain`, not `explanation` — see the note in the typed-items block.
        SRS.scheduleItem('gram', 'articles', {
            id: 'articles', explain: 'a/an/the', rule: 'Use `the` when we both know which one.',
            review: { rulePrompt: 'One line first.', itemIds: ['articles-p1'] },
            practice: [{ id: 'articles-p1' }]
        }, false);
        expect(SRS.getDue('gram')).toHaveLength(1);
        expect(SRS.getDue('gram')[0].data.explain).toBe('a/an/the');
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
    // Three graded successes: reps 3, interval 7, due 7 days out, "learned".
    // (was 8 — see the ladder block: FR-SRS-2's third rung is 7, not round(3*2.7).)
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
        expect(dueBefore).toBe(NOW + 7 * DAY_MS);

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
        expect(rec.interval).toBe(7);
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
        // US-177 switched the badge over. app.js's updateDueCount() now reads
        // `SRS.dueCount(null)` — every type, not just vocabulary — because
        // startReview() walks getDue(null) and switches on (type, shape). So the
        // figure the badge is built from is the SECOND assertion below, and the
        // vocabulary-only default is only still here because srs.js's own
        // `dueCount()` default has not been changed (see the note on that method:
        // the call site passes `null` explicitly instead).
        for (let i = 0; i < 25; i++) SRS.schedule(word({ word: 'w' + i }), false);
        SRS.scheduleItem('gram', 'g1', { id: 'g1' }, false);
        expect(SRS.dueCount()).toBe(SRS.getDueWords().length);
        expect(SRS.dueCount()).toBe(SRS.DAILY_REVIEW_CAP);
        // THE BADGE'S OWN INVARIANT: what it counts is what the button opens.
        expect(SRS.dueCount(null)).toBe(SRS.getDue(null).length);
    });
});

describe('getDue — interleaving across types (US-303)', () => {
    // Payloads have to be RENDERABLE for their type or they never reach the
    // queue, which is the whole point of RENDERABLE. `{ id }` used to be enough
    // for a gram or phon record; it is not, and must not be — see the
    // "RENDERABLE" block below for why. These are the minimum shapes.
    const payload = (type, ref) => {
        if (type === 'vocab') return { word: ref, quiz: { question: 'q', options: ['a'], correct: 0 } };
        if (type === 'gram') return {
            id: ref, rule: 'One sentence.',
            review: { rulePrompt: 'One line first.', itemIds: [ref + '-p1'] },
            practice: [{ id: ref + '-p1' }]
        };
        if (type === 'phon') return {
            id: ref, pair: ['sheep', 'ship'],
            minimalPairs: [{ a: 'sheep', b: 'ship' }]
        };
        return { id: ref, chunk: ref, meaning: 'a meaning' };
    };

    const seed = (type, n, base) => {
        for (let i = 0; i < n; i++) {
            const ref = type[0] + i;
            const key = type + ':' + ref;
            SRS.records[key] = {
                key: key, type: type, ref: ref,
                reps: 1, interval: 1, ease: 2.5, lapses: 0,
                due: NOW - base + i,
                lastReviewed: NOW - DAY_MS, createdAt: NOW - DAY_MS,
                data: payload(type, ref)
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

    it('carries everything a caller needs to CHOOSE and DRAW a card (US-171)', () => {
        // The gap US-171 is really about: a queue entry that says only
        // "{ type, ref, key, data }" is not enough to render a typed review,
        // because `phon` is three different screens and `data` alone does not say
        // which. `shape` is the card selector; the schedule fields let a card say
        // "you have missed this 3 times" without reaching into records.
        SRS.records = {};
        seed('gram', 1, 1000);
        SRS.records['gram:g0'].lapses = 3;
        SRS.records['gram:g0'].selfReported = true;
        const item = SRS.getDue('gram')[0];
        expect(Object.keys(item).sort()).toEqual([
            'data', 'due', 'interval', 'key', 'lapses', 'ref', 'reps', 'selfReported', 'shape', 'type'
        ]);
        expect(item.type).toBe('gram');
        expect(item.shape).toBe('gram');
        expect(item.ref).toBe('g0');
        expect(item.key).toBe('gram:g0');
        expect(item.lapses).toBe(3);
        expect(item.reps).toBe(1);
        expect(item.interval).toBe(1);
        expect(item.due).toBe(SRS.records['gram:g0'].due);
        expect(item.selfReported).toBe(true);
    });

    it('never hands out a shape it cannot name', () => {
        // `shape` null would mean "renderable but undrawable", which is the
        // contradiction this whole change exists to remove.
        SRS.records = {};
        seed('vocab', 3, 1000); seed('gram', 3, 1000); seed('phon', 3, 1000); seed('coll', 3, 1000);
        const items = SRS.getDue(null);
        expect(items).toHaveLength(12);
        items.forEach(i => {
            expect(typeof i.shape).toBe('string');
            expect(SRS.SHAPES[i.type]).toContain(i.shape);
        });
    });

    it('hands out payload copies, so a card cannot corrupt the store', () => {
        SRS.records = {};
        seed('gram', 1, 1000);
        SRS.getDue('gram')[0].data.rule = 'MUTATED';
        expect(SRS.records['gram:g0'].data.rule).toBe('One sentence.');
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

// ---------------------------------------------------------------------------
// US-148 — what a grammar review card actually receives
// ---------------------------------------------------------------------------
describe('PROJECTORS.gram — against the authored schema, not a guess (US-148)', () => {
    // Requiring the real content is the whole point: a projector checked against
    // an invented item proves nothing, and every defect in this list so far has
    // been a divergence between the list and data/grammar.js. If this require
    // ever fails, the projector's contract has lost its counterparty.
    const { grammarLessons } = require('../../data/grammar.js');
    const lesson = grammarLessons.foundation[0];

    beforeEach(() => {
        SRS.records = {};
        SRS._resetProjectionWarnings();
    });

    it('has real content to check against', () => {
        expect(lesson).toBeDefined();
        expect(lesson.id).toBe('articles');
    });

    it('round-trips `rule` through localStorage — the field a wrong answer must show', () => {
        // TEACHING_METHODOLOGY.md §2: state the rule in one sentence on a wrong
        // answer. An earlier list dropped `rule` and projected `explanation`,
        // which does not exist on a grammar point, so the card had nothing.
        SRS.scheduleItem('gram', lesson.id, lesson, false);
        const stored = JSON.parse(localStorage.getItem('srsData'))['gram:articles'];
        expect(stored.data.rule).toBe(lesson.rule);
        expect(typeof stored.data.rule).toBe('string');
        expect(stored.data.rule.length).toBeGreaterThan(0);
    });

    it('round-trips `review` — without it FR-GRM-3 has no review card (US-148)', () => {
        // was KNOWN DEFECT: `review` was not projected, so a due grammar point
        // could only be re-taught, not reviewed. `review.itemIds` indexes into
        // `practice`, which is why the two must be projected together.
        SRS.scheduleItem('gram', lesson.id, lesson, false);
        const stored = JSON.parse(localStorage.getItem('srsData'))['gram:articles'];
        expect(stored.data.review).toEqual(lesson.review);
        expect(typeof stored.data.review.rulePrompt).toBe('string');
        expect(Array.isArray(stored.data.review.itemIds)).toBe(true);
        expect(stored.data.review.itemIds.length).toBeGreaterThan(0);
    });

    it('round-trips `cefr` (US-148)', () => {
        SRS.scheduleItem('gram', lesson.id, lesson, false);
        const stored = JSON.parse(localStorage.getItem('srsData'))['gram:articles'];
        expect(stored.data.cefr).toBe(lesson.cefr);
    });

    it('keeps review.itemIds resolvable from the stored practice array', () => {
        // The specific way projecting `review` without `practice` (or the other
        // way round) would fail: ids on the record that point at nothing.
        SRS.scheduleItem('gram', lesson.id, lesson, false);
        const data = JSON.parse(localStorage.getItem('srsData'))['gram:articles'].data;
        const practiceIds = data.practice.map(p => p.id);
        data.review.itemIds.forEach(id => expect(practiceIds).toContain(id));
    });

    it('declares no field the authored schema does not have', () => {
        // The `explanation` / `example` / `difficulty` class of mistake: a list
        // edited against a sketch instead of against content. `phantom` is the
        // audit's name for it.
        expect(SRS.auditProjection('gram', lesson).phantom).toEqual([]);
    });

    it('drops only first-teaching and authoring-metadata fields', () => {
        // Pinned so that shrinking this list is a deliberate act. A review is
        // not the first teaching, so `notice` / `decide` / `whyItMatters` /
        // `spokenNote` / `commonErrors` / `prerequisites` stay in content; the
        // rest is authoring metadata. Everything here is still readable from
        // data/grammar.js by id — it is absent from the RECORD, not from the app.
        //
        // These are `omitted`, not `dropped`: DELIBERATE_OMISSIONS.gram is what
        // stops the audit warning about all eight on the very first grammar item
        // scheduled. This assertion read `.dropped` and could never have passed —
        // it was written before DELIBERATE_OMISSIONS existed and was never run,
        // because jest is not installed. `dropped` must be EMPTY: it is the
        // silent-data-loss channel and anything in it is a bug.
        const audit = SRS.auditProjection('gram', lesson);
        expect(audit.omitted.sort()).toEqual([
            'commonErrors', 'decide', 'notice', 'prerequisites', 'spokenNote',
            'syllabusNumber', 'tags', 'whyItMatters'
        ]);
        expect(audit.dropped).toEqual([]);
    });

    it('does not treat the item\'s own srs identity fields as lost content', () => {
        // srsType / srsRef / srsKey are on the record as type / ref / key, so a
        // projector that omits them is complete, not lossy.
        expect(SRS.auditProjection('gram', lesson).ignored.sort())
            .toEqual(['srsKey', 'srsRef', 'srsType']);
        const rec = SRS.scheduleItem('gram', lesson.id, lesson, false);
        expect(rec.key).toBe(lesson.srsKey);
        expect(rec.ref).toBe(lesson.srsRef);
        expect(rec.type).toBe(lesson.srsType);
    });

    it('projects every field the phon content authors, now that it exists', () => {
        // This used to pin the ORIGINAL GUESS and assert that no pronunciation
        // content existed, so that whoever landed it would see this test. They
        // did: data/pronunciation/vowels-stress.js is here, and the projector was
        // corrected against it (it had been dropping 16 authored fields including
        // `articulatoryCue`, `productionGate` and `phonemes` — the whole of the
        // teaching). The assertion is now the real contract: audit a real pair
        // and require that nothing an author wrote is silently dropped.
        const content = require(
            require('path').join(__dirname, '../../data/pronunciation/vowels-stress.js'));
        const pair = content.PRONUNCIATION_VOWELS_STRESS.pairs[0];

        const audit = SRS.auditProjection('phon', pair);
        expect(audit.shape).toBe('pair');
        expect(audit.dropped).toEqual([]);
        expect(audit.phantom).toEqual([]);

        // The four the Pronunciation section (US-401) cannot render a review card
        // without, called out by name so a future trim of the list is loud.
        // PROJECTORS.phon is a VARIANT list now (US-167), so the fields live on
        // the matching variant, which is what projectorFields() resolves.
        ['articulatoryCue', 'contrastFeature', 'phonemes', 'productionGate']
            .forEach(f => expect(SRS.projectorFields('phon', pair)).toContain(f));
    });

    it('stores a phon record under the key the content declares', () => {
        // The FR-PRN-6 production gate reads a per-pair accuracy counter keyed the
        // same way. If scheduleItem() ever normalised the IPA ref differently from
        // the authored `srsKey`, the gate would read a counter nothing writes to
        // and would never open — silently.
        const content = require(
            require('path').join(__dirname, '../../data/pronunciation/vowels-stress.js'));
        content.PRONUNCIATION_VOWELS_STRESS.pairs.forEach(pair => {
            const rec = SRS.scheduleItem('phon', pair.id, pair, false);
            expect(rec.key).toBe(pair.srsKey);
            expect(rec.key).toBe(pair.productionGate.requiresKey);
            expect(rec.type).toBe('phon');
            expect(rec.ref).toBe(pair.id);
        });
    });
});

// ---------------------------------------------------------------------------
// US-167 / US-171 — `phon` is THREE content shapes, not one
// ---------------------------------------------------------------------------
describe('PROJECTORS.phon shapes — against the real pronunciation content (US-167)', () => {
    const path = require('path');
    const fs = require('fs');
    const VS = require(path.join(__dirname, '../../data/pronunciation/vowels-stress.js'))
        .PRONUNCIATION_VOWELS_STRESS;
    // data/pronunciation/consonants.js declares a lexical global and has NO
    // module.exports (that file is not this change's to edit), so it is evaluated
    // as the classic script it is rather than required. Its `pairs[]` is authored
    // to the same key set and key order as the vowel pairs, which is exactly the
    // claim being checked here.
    const CONS = new Function(
        fs.readFileSync(path.join(__dirname, '../../data/pronunciation/consonants.js'), 'utf8') +
        '\n;return PRONUNCIATION_CONSONANTS;')();

    beforeEach(() => {
        SRS.records = {};
        SRS._resetProjectionWarnings();
    });

    it('has real content of all three shapes to check against', () => {
        expect(VS.pairs.length).toBe(3);
        expect(CONS.pairs.length).toBe(5);
        expect(VS.stress.length).toBe(21);
        expect(VS.noticing.length).toBe(15);
    });

    it('declares the three shapes a review surface must be able to draw', () => {
        expect(SRS.SHAPES.phon).toEqual(['pair', 'stress', 'noticing']);
        expect(SRS.SHAPES.vocab).toEqual(['vocab']);
        expect(SRS.SHAPES.gram).toEqual(['gram']);
        expect(SRS.SHAPES.coll).toEqual(['coll']);
    });

    it('routes every authored item to the right shape', () => {
        VS.pairs.concat(CONS.pairs).forEach(p => expect(SRS.shapeOf('phon', p)).toBe('pair'));
        VS.stress.forEach(s => expect(SRS.shapeOf('phon', s)).toBe('stress'));
        VS.noticing.forEach(n => expect(SRS.shapeOf('phon', n)).toBe('noticing'));
    });

    it('drops nothing an author wrote, on any of the 44 real phon items', () => {
        // The defect US-167 reported: `phon:rhythm`, `phon:final-vowel` and
        // `phon:cluster` had no projector, so a noticing item was projected
        // through the vowel-pair field list. The three key sets overlap on
        // exactly { id, code, mistakeCategory }, so the record stored three
        // fields, the card had no prompt and no answer, and RENDERABLE said yes.
        const dropped = [];
        const audit = (kind, items) => items.forEach(it => {
            const a = SRS.auditProjection('phon', it);
            if (a.dropped.length) dropped.push([kind, it.id, a.dropped]);
        });
        audit('pair', VS.pairs.concat(CONS.pairs));
        audit('stress', VS.stress);
        audit('noticing', VS.noticing);
        expect(dropped).toEqual([]);
    });

    it('projects a word-stress item with the drill that IS its card (FR-PRN-3)', () => {
        const item = VS.stress[0];
        expect(item.srsKey).toBe('phon:word-stress');
        const rec = SRS.scheduleItem('phon', item.srsRef, item, false);
        expect(rec.key).toBe(item.srsKey);
        const stored = JSON.parse(localStorage.getItem('srsData'))['phon:word-stress'];
        // The drill, and the three fields a renderer needs to mark the syllables
        // WITHOUT parsing the display string.
        expect(stored.data.drill).toEqual(item.drill);
        expect(stored.data.word).toBe(item.word);
        expect(stored.data.syllables).toEqual(item.syllables);
        expect(stored.data.stressNumbers).toEqual(item.stressNumbers);
        expect(stored.data.stressIndex).toBe(item.stressIndex);
        expect(stored.data.ipa).toBe(item.ipa);
        // Before US-167 this was the ENTIRE stored payload.
        expect(Object.keys(stored.data).length).toBeGreaterThan(3);
    });

    it('projects a noticing item with its prompt, grading and FR-PRN-8 policy', () => {
        VS.noticing.forEach(item => {
            SRS.records = {};
            const ref = item.srsKey.split(':')[1];
            const rec = SRS.scheduleItem('phon', ref, item, false);
            expect(rec.key).toBe(item.srsKey);
            expect(rec.data.prompt).toBe(item.prompt);
            expect(rec.data.mode).toBe(item.mode);
            expect(rec.data.teach).toBe(item.teach);
            expect(rec.data.answer).toBe(item.answer);
            expect(rec.data.why).toBe(item.why);
            expect(rec.data.feelCheck).toBe(item.feelCheck);
            // FR-PRN-8 is POLICY on the card, not metadata: a review that ignores
            // this and asks the learner to imitate a TTS model breaks the
            // requirement and AS-3 at once.
            expect(rec.data.requiresImitation).toBe(false);
            expect(rec.data.answerableFrom).toBe(item.answerableFrom);
        });
    });

    it('keys the prosody records exactly as the content declares', () => {
        // Three keys across 15 items, and one key across 21 stress items. The
        // surface has to know that: per-word accuracy is NOT an SRS fact.
        const keys = new Set();
        VS.noticing.forEach(n => {
            keys.add(SRS.scheduleItem('phon', n.srsKey.split(':')[1], n, false).key);
        });
        expect([...keys].sort()).toEqual(['phon:cluster', 'phon:final-vowel', 'phon:rhythm']);

        SRS.records = {};
        VS.stress.forEach(s => SRS.scheduleItem('phon', s.srsRef, s, false));
        expect(Object.keys(SRS.records)).toEqual(['phon:word-stress']);
    });

    it('answers shapeOf() the same way for authored content and stored payload', () => {
        // The invariant that lets RENDERABLE and getDue() agree: a variant's
        // `when` may only test fields the variant itself projects. Break it and a
        // record becomes un-routable the moment it is saved.
        const all = [].concat(VS.pairs, CONS.pairs, VS.stress, VS.noticing);
        all.forEach(item => {
            SRS.records = {};
            const ref = item.srsRef || (item.srsKey || '').split(':')[1] || item.id;
            const rec = SRS.scheduleItem('phon', ref, item, false);
            expect(SRS.shapeOf('phon', rec.data)).toBe(SRS.shapeOf('phon', item));
        });
    });

    it('makes all 44 real phon items reach a review queue', () => {
        // The end-to-end claim of US-171's scheduler half: schedule real content,
        // and it comes back out of getDue() as something drawable.
        const all = [].concat(VS.pairs, CONS.pairs, VS.stress, VS.noticing);
        const shapes = {};
        all.forEach(item => {
            SRS.records = {};
            const ref = item.srsRef || (item.srsKey || '').split(':')[1] || item.id;
            SRS.scheduleItem('phon', ref, item, false);       // a lapse: due now
            const q = SRS.getDue('phon');
            expect(q).toHaveLength(1);
            expect(q[0].type).toBe('phon');
            expect(typeof q[0].shape).toBe('string');
            shapes[q[0].shape] = (shapes[q[0].shape] || 0) + 1;
        });
        expect(shapes).toEqual({ pair: 8, stress: 21, noticing: 15 });
    });

    it('warns by name when an item matches no shape at all', () => {
        // A fourth phon shape landing must not fail the way the third one did.
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            SRS.scheduleItem('phon', 'intonation', { id: 'fall-rise', somethingNew: 1 }, false);
            expect(warn).toHaveBeenCalled();
            const msg = warn.mock.calls[0][0];
            expect(msg).toContain('No PROJECTORS.phon shape matches');
            expect(msg).toContain('fall-rise');
            expect(msg).toContain('js/core/srs.js');
            // Scheduling still WORKS — the lapse is recorded, FR-PRN-2 is not lost.
            expect(SRS.records['phon:intonation'].lapses).toBe(1);
            // It is simply not offered as a card.
            expect(SRS.getDue('phon')).toHaveLength(0);
            expect(SRS.stats('phon').due).toBe(1);
            expect(SRS.stats('phon').actionable).toBe(0);
        } finally {
            warn.mockRestore();
        }
    });
});

// ---------------------------------------------------------------------------
// RENDERABLE — "can this be drawn", per type and per shape
// ---------------------------------------------------------------------------
describe('RENDERABLE — a queue entry is a promise the card can be drawn', () => {
    const path = require('path');
    const VS = require(path.join(__dirname, '../../data/pronunciation/vowels-stress.js'))
        .PRONUNCIATION_VOWELS_STRESS;
    const { grammarLessons } = require('../../data/grammar.js');

    beforeEach(() => { SRS.records = {}; });

    it('says yes to every real authored item', () => {
        grammarLessons.foundation.forEach(p => {
            expect(SRS.RENDERABLE.gram(SRS._project('gram', p))).toBe(true);
        });
        [].concat(VS.pairs, VS.stress, VS.noticing).forEach(p => {
            expect(SRS.RENDERABLE.phon(SRS._project('phon', p))).toBe(true);
        });
    });

    it('vocab is still EXACTLY the old data.quiz test', () => {
        // The vocabulary review flow must not move a byte.
        expect(SRS.RENDERABLE.vocab({ quiz: {} })).toBe(true);
        expect(SRS.RENDERABLE.vocab({ word: 'x' })).toBe(false);
        expect(SRS.RENDERABLE.vocab({})).toBe(false);
        expect(SRS.RENDERABLE.vocab(null)).toBe(false);
    });

    it('gram needs the rule and a review prompt that resolves (FR-GRM-3)', () => {
        const full = {
            id: 'articles', rule: 'One sentence.',
            review: { rulePrompt: 'One line first.', itemIds: ['articles-p1'] },
            practice: [{ id: 'articles-p1' }]
        };
        expect(SRS.RENDERABLE.gram(full)).toBe(true);
        // methodology §2: a wrong answer must state the rule. No rule, no card.
        expect(SRS.RENDERABLE.gram(Object.assign({}, full, { rule: undefined }))).toBe(false);
        expect(SRS.RENDERABLE.gram(Object.assign({}, full, { rule: '   ' }))).toBe(false);
        // FR-GRM-3: reviewable "without re-teaching the whole lesson".
        expect(SRS.RENDERABLE.gram(Object.assign({}, full, { review: undefined }))).toBe(false);
        expect(SRS.RENDERABLE.gram(Object.assign({}, full, { review: { itemIds: ['articles-p1'] } }))).toBe(false);
        // Dangling ids: the exact way projecting `review` without `practice`
        // (or the other way round) failed before.
        expect(SRS.RENDERABLE.gram(Object.assign({}, full, { practice: [] }))).toBe(false);
        expect(SRS.RENDERABLE.gram(Object.assign({}, full, { practice: [{ id: 'other-p9' }] }))).toBe(false);
        expect(SRS.RENDERABLE.gram(Object.assign({}, full, { review: { rulePrompt: 'p', itemIds: [] } }))).toBe(false);
        // was KNOWN LOOSENESS: `d => !!d` said yes to this.
        expect(SRS.RENDERABLE.gram({ id: 'articles' })).toBe(false);
    });

    it('phon is judged per shape, not per type', () => {
        // pair: gradable discrimination, or the no-audio text fallback (AS-3).
        expect(SRS.RENDERABLE.phon({ pair: ['sheep', 'ship'], minimalPairs: [{ a: 1 }] })).toBe(true);
        expect(SRS.RENDERABLE.phon({ pair: ['sheep', 'ship'], textOnlyFallback: { items: [] } })).toBe(true);
        expect(SRS.RENDERABLE.phon({ pair: ['sheep', 'ship'], minimalPairs: [] })).toBe(false);
        // stress: the drill is the card.
        const stress = { syllables: ['a', 'b'], drill: { options: ['a', 'b'], correctIndex: 0 } };
        expect(SRS.RENDERABLE.phon(stress)).toBe(true);
        expect(SRS.RENDERABLE.phon({ syllables: ['a'], drill: { options: ['a'] } })).toBe(false);
        expect(SRS.RENDERABLE.phon({ syllables: ['a'] })).toBe(false);
        // noticing: a prompt plus any one of the three grading shapes.
        expect(SRS.RENDERABLE.phon({ target: 'rhythm', mode: 'count-beats', prompt: 'p', options: ['a'], correctIndex: 0 })).toBe(true);
        expect(SRS.RENDERABLE.phon({ target: 'rhythm', mode: 'pick-beat-words', prompt: 'p', tokens: ['a'], correct: [0] })).toBe(true);
        expect(SRS.RENDERABLE.phon({ target: 'cluster', mode: 'count-syllables', prompt: 'p', items: [{ answer: 1 }] })).toBe(true);
        expect(SRS.RENDERABLE.phon({ target: 'rhythm', mode: 'count-beats', prompt: 'p' })).toBe(false);
        expect(SRS.RENDERABLE.phon({ target: 'rhythm', mode: 'count-beats', options: ['a'], correctIndex: 0 })).toBe(false);
        // was KNOWN LOOSENESS, and the actual US-167 bug: the three keys the
        // shapes share, stored by the shape-blind projector, called renderable.
        expect(SRS.RENDERABLE.phon({ id: 'stress-photograph', code: 'T-P4', mistakeCategory: 'prn.word-stress' })).toBe(false);
        expect(SRS.RENDERABLE.phon({})).toBe(false);
        expect(SRS.RENDERABLE.phon(null)).toBe(false);
    });

    it('coll needs a chunk and a meaning or example', () => {
        expect(SRS.RENDERABLE.coll({ chunk: 'make a decision', meaning: 'to decide' })).toBe(true);
        expect(SRS.RENDERABLE.coll({ chunk: 'make a decision', example: 'She made one.' })).toBe(true);
        expect(SRS.RENDERABLE.coll({ chunk: 'make a decision' })).toBe(false);
        expect(SRS.RENDERABLE.coll({ id: 'x' })).toBe(false);
    });

    it('reports a record it cannot draw rather than hiding or deleting it', () => {
        // What happens to a record stored before a projector was corrected. It
        // stops being OFFERED and starts being REPORTED — the gap between
        // stats().due and stats().actionable, which js/core/session.js surfaces as
        // `heldBack`. Nothing is deleted and no due date moves.
        SRS.records = {
            'phon:word-stress': {
                key: 'phon:word-stress', type: 'phon', ref: 'word-stress',
                reps: 0, interval: 0, ease: 2.3, lapses: 2, due: NOW - 5000,
                data: { id: 'stress-photograph', code: 'T-P4', mistakeCategory: 'prn.word-stress' }
            }
        };
        const before = JSON.stringify(SRS.records);
        expect(SRS.getDue('phon')).toHaveLength(0);
        expect(SRS.countDue('phon')).toBe(0);
        expect(SRS.stats('phon').due).toBe(1);
        expect(SRS.stats('phon').actionable).toBe(0);
        expect(JSON.stringify(SRS.records)).toBe(before);
    });

    it('heals such a record on the next real schedule() call, history intact', () => {
        SRS.records = {
            'phon:word-stress': {
                key: 'phon:word-stress', type: 'phon', ref: 'word-stress',
                reps: 0, interval: 0, ease: 2.3, lapses: 2, due: NOW - 5000,
                createdAt: NOW - 3 * DAY_MS,
                data: { id: 'stress-photograph', code: 'T-P4', mistakeCategory: 'prn.word-stress' }
            }
        };
        const item = VS.stress[0];
        const rec = SRS.scheduleItem('phon', item.srsRef, item, false);
        expect(SRS.shapeOf('phon', rec.data)).toBe('stress');
        expect(rec.data.drill).toEqual(item.drill);
        expect(SRS.getDue('phon')).toHaveLength(1);
        expect(rec.lapses).toBe(3);                       // the old history kept
        expect(rec.createdAt).toBe(NOW - 3 * DAY_MS);
    });
});

// ---------------------------------------------------------------------------
// The badge. `SRS.dueCount()`'s DEFAULT is still vocabulary-only; the BADGE is
// not, and since US-177 the two are different things.
//
// app.js's updateDueCount() calls `SRS.dueCount(null)` explicitly, which is the
// figure this method's own note proposes making the default. The switchover it
// describes has therefore landed in behaviour — startReview() walks getDue(null),
// SURFACES['srs.review'].types is ['vocab','gram','phon'], and the badge counts
// every type the review screen can draw — while this file is unchanged, because
// srs.js was outside that commit's edit set. Changing the default here is now
// SAFE and is the one line still outstanding; these tests describe the module as
// it stands, and the assertions below say which figure the badge is built from.
// ---------------------------------------------------------------------------
describe('dueCount — the badge does not promise a session app.js cannot open', () => {
    beforeEach(() => { SRS.records = {}; });

    const gram = ref => ({
        id: ref, rule: 'One sentence.',
        review: { rulePrompt: 'One line first.', itemIds: [ref + '-p1'] },
        practice: [{ id: ref + '-p1' }]
    });

    it('still defaults to vocab, while the badge reads dueCount(null)', () => {
        // The default is untouched, so every existing 0-argument caller keeps its
        // behaviour. app.js does NOT rely on the default any more.
        SRS.schedule(word(), false);
        SRS.scheduleItem('gram', 'g1', gram('g1'), false);
        SRS.scheduleItem('gram', 'g2', gram('g2'), false);
        expect(SRS.dueCount()).toBe(1);
        expect(SRS.dueCount()).toBe(SRS.getDueWords().length);
        // What the badge shows, and what the button opens.
        expect(SRS.dueCount(null)).toBe(3);
        expect(SRS.dueCount(null)).toBe(SRS.getDue(null).length);
        expect(SRS.totalDueCount('gram')).toBe(2);
        expect(SRS.countDue(null)).toBe(3);
    });

    it('an explicit type is answered honestly, so a caller can opt in today', () => {
        SRS.scheduleItem('gram', 'g1', gram('g1'), false);
        expect(SRS.dueCount('gram')).toBe(1);
        expect(SRS.dueCount('vocab')).toBe(0);
        expect(SRS.dueCount(null)).toBe(1);
    });

    it('dueCount(null) equals getDue(null).length, whatever the mix', () => {
        for (let i = 0; i < 25; i++) SRS.schedule(word({ word: 'w' + i }), false);
        for (let i = 0; i < 25; i++) SRS.scheduleItem('gram', 'g' + i, gram('g' + i), false);
        expect(SRS.dueCount(null)).toBe(SRS.getDue(null).length);
        expect(SRS.dueCount(null)).toBe(SRS.DAILY_REVIEW_CAP);
    });
});

// ---------------------------------------------------------------------------
// US-148 — preventing the class of bug, not the two instances of it
// ---------------------------------------------------------------------------
describe('the projection audit (US-148)', () => {
    let warn;

    beforeEach(() => {
        SRS.records = {};
        SRS._resetProjectionWarnings();
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        warn.mockRestore();
        delete global.SRS_PROJECTION_WARNINGS;
    });

    it('warns when an author writes a field the projector drops', () => {
        // `mystery`, not `spokenNote`: this assertion used `spokenNote` and could
        // never have passed, because `spokenNote` is in DELIBERATE_OMISSIONS.gram
        // and being deliberately omitted is precisely what does NOT warn. Never
        // run, because jest is not installed.
        SRS.scheduleItem('gram', 'articles', { id: 'articles', rule: 'r', mystery: 'x' }, false);
        expect(warn).toHaveBeenCalledTimes(1);
        const msg = warn.mock.calls[0][0];
        expect(msg).toContain('PROJECTORS.gram');
        expect(msg).toContain('`mystery`');
        expect(msg).toContain('js/core/srs.js');
    });

    it('stays silent about a field DELIBERATE_OMISSIONS declares', () => {
        // The other half: a warning that fires on the documented, correct call is
        // noise, and noise is how the real signal gets ignored.
        SRS.scheduleItem('gram', 'articles', {
            id: 'articles', rule: 'r', spokenNote: 'x', notice: {}, decide: [],
            whyItMatters: 'w', commonErrors: [], prerequisites: [],
            syllabusNumber: 3, tags: ['x']
        }, false);
        expect(warn).not.toHaveBeenCalled();
    });

    it('warns once per type and field, so the console stays readable', () => {
        // A warning printed on every review is a warning nobody reads, which is
        // the same silence this exists to break.
        for (let i = 0; i < 5; i++) {
            SRS.scheduleItem('gram', 'g' + i, { id: 'g' + i, mystery: 1 }, false);
        }
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('warns separately for the same field name under a different type', () => {
        SRS.scheduleItem('gram', 'g', { id: 'g', mystery: 1 }, false);
        // `{ id, mystery }` matches no `phon` shape, so this is the "no shape"
        // warning rather than the per-field one — a bigger statement, and it still
        // names the registry the author has to edit.
        SRS.scheduleItem('phon', 'iː-ɪ', { id: 'iː-ɪ', mystery: 1 }, false);
        expect(warn).toHaveBeenCalledTimes(2);
        expect(warn.mock.calls[0][0]).toContain('PROJECTORS.gram');
        expect(warn.mock.calls[1][0]).toContain('PROJECTORS.phon');
    });

    it('names the SHAPE, not just the type, when a type has several', () => {
        // "PROJECTORS.phon does not list `foo`" would send an author to a
        // three-variant list with no clue which one to edit.
        SRS.scheduleItem('phon', 'iː-ɪ', {
            id: 'iː-ɪ', pair: ['sheep', 'ship'], minimalPairs: [{ a: 1 }], mystery: 1
        }, false);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('PROJECTORS.phon[pair]');
        expect(warn.mock.calls[0][0]).toContain('`mystery`');
    });

    it('warns once per type+shape+field, so one shape does not silence another', () => {
        SRS.scheduleItem('phon', 'iː-ɪ', { pair: ['a', 'b'], mystery: 1 }, false);
        SRS.scheduleItem('phon', 'word-stress', { syllables: ['a'], mystery: 1 }, false);
        expect(warn).toHaveBeenCalledTimes(2);
        expect(warn.mock.calls[0][0]).toContain('[pair]');
        expect(warn.mock.calls[1][0]).toContain('[stress]');
    });

    it('is silent about identity fields', () => {
        SRS.scheduleItem('gram', 'g', {
            id: 'g', srsType: 'gram', srsRef: 'g', srsKey: 'gram:g',
            type: 'gram', ref: 'g', key: 'gram:g'
        }, false);
        expect(warn).not.toHaveBeenCalled();
    });

    it('is silent about a field explicitly set to undefined', () => {
        SRS.scheduleItem('gram', 'g', { id: 'g', notWritten: undefined }, false);
        expect(warn).not.toHaveBeenCalled();
    });

    it('can be switched off, and off means silent', () => {
        global.SRS_PROJECTION_WARNINGS = false;
        SRS.scheduleItem('gram', 'g', { id: 'g', mystery: 1 }, false);
        expect(warn).not.toHaveBeenCalled();
    });

    it('changes nothing about what is stored, on or off', () => {
        // The audit is a diagnostic. If it could alter a payload it would be a
        // feature, and a feature that only runs in development is a bug.
        const item = { id: 'g', title: 'T', rule: 'R', mystery: 1, tags: ['x'] };
        global.SRS_PROJECTION_WARNINGS = false;
        SRS.records = {};
        SRS.scheduleItem('gram', 'g', item, false);
        const quiet = JSON.stringify(SRS.records['gram:g'].data);

        global.SRS_PROJECTION_WARNINGS = true;
        SRS._resetProjectionWarnings();
        SRS.records = {};
        SRS.scheduleItem('gram', 'g', item, false);
        expect(JSON.stringify(SRS.records['gram:g'].data)).toBe(quiet);
        expect(warn).toHaveBeenCalled();
    });

    it('never lets a diagnostic break a review', () => {
        warn.mockImplementation(() => { throw new Error('console is gone'); });
        expect(() => SRS.scheduleItem('gram', 'g', { id: 'g', mystery: 1 }, false)).not.toThrow();
        expect(SRS.records['gram:g'].data.id).toBe('g');
    });

    it('would have caught both of the defects that have actually happened', () => {
        const original = SRS.PROJECTORS.gram;
        try {
            // The list as it shipped before US-148: three fields no grammar point
            // has, and no `rule`.
            SRS.PROJECTORS.gram = ['id', 'title', 'explanation', 'example', 'practice', 'difficulty'];
            const audit = SRS.auditProjection('gram', {
                id: 'articles', title: 'T', rule: 'R', review: { itemIds: [] },
                cefr: 'A1–A2', practice: []
            });
            expect(audit.dropped).toContain('rule');      // defect 1
            expect(audit.dropped).toContain('review');    // defect 2
            expect(audit.dropped).toContain('cefr');      // defect 2
            expect(audit.phantom).toContain('explanation');
            expect(audit.phantom).toContain('example');
            expect(audit.phantom).toContain('difficulty');
        } finally {
            SRS.PROJECTORS.gram = original;
        }
    });

    it('reports an unknown type against the default projector, as _project does', () => {
        expect(SRS.auditProjection('nope', { word: 'x' }).type).toBe('vocab');
    });

    it('tolerates a nullish or non-object item', () => {
        [null, undefined, 'string', 42].forEach(bad => {
            expect(() => SRS.auditProjection('gram', bad)).not.toThrow();
            expect(SRS.auditProjection('gram', bad).dropped).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// US-134 — the IIFE global object
// ---------------------------------------------------------------------------
describe('module globals under CommonJS (US-134)', () => {
    it('publishes SRS as a global, not only as module.exports', () => {
        expect(global.SRS).toBeDefined();
        expect(global.SRS).toBe(require('../../js/core/srs.js'));
    });

    it('resolves its own dependencies through the same global object', () => {
        // The real consequence of getting this wrong: srs.js looks up
        // global.Migrations to run the legacy-key migration and to normalise
        // keys. If its `global` is not the one migrations.js published to, the
        // migration silently never runs and normRef falls back to the inline
        // copy — a whole class of test passing while exercising nothing.
        expect(global.Migrations).toBeDefined();
        expect(global.Migrations).toBe(require('../../js/core/migrations.js'));
        expect(SRS._key('  Happy ')).toBe(Migrations.srsRef('  Happy '));
    });

    it('passes globalThis, not `this`, as the IIFE global — checked in the source', () => {
        // THIS IS THE ASSERTION WITH TEETH, and it is a source check on purpose.
        //
        // Under CommonJS a bare top-level `this` is `module.exports`, so
        // `(function (global) {...})(typeof window !== 'undefined' ? window : this)`
        // hands the module an empty object as its global. But jest.config.js sets
        // testEnvironment: 'jsdom', where `window` IS the test global object — so
        // the `: this` branch is never taken and NO behavioural assertion in this
        // file can detect the defect. It bites plain `node` scripts and any file
        // with `@jest-environment node`. A source check is therefore the only
        // guard that actually fails when this regresses.
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(__dirname, '../../js/core');
        fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => {
            const src = fs.readFileSync(path.join(dir, f), 'utf8');
            expect(src).not.toMatch(/\?\s*window\s*:\s*this\s*\)/);
        });
    });
});
