/**
 * Mistakes — the mistake log, keyed by error TYPE (US-305 / FR-SRS-3).
 *
 * These tests pin the four decisions that make this module a diagnosis rather
 * than a counter, because each of them is a judgement call that a later change
 * could quietly reverse:
 *
 *   1. the taxonomy is data, extensible by a second L1 profile (FR-CNT-3/BR-10);
 *   2. the 30-day window is a hard edge and occurrences inside it decay, so a
 *      fixed problem stops being ranked first;
 *   3. retention is bounded, by age and by count;
 *   4. recogniser- and self-sourced entries never enter the ranked diagnosis
 *      (BR-3, FR-SRS-5, FR-PRN-5);
 *   5. a category id is learner data, so a row's WORDING widens and its id
 *      never changes — and an entry whose id has left the taxonomy is kept and
 *      unranked, not dropped (US-159);
 *   6. one habit is one finding with one count and one drill (US-165), and one
 *      finding may still have more than one drill destination where the same
 *      error is fixed by two items (US-164, /θ/ and /ð/ under T-P6);
 *   7. a row's LABEL has to be true of the errors routed to it, which is why a
 *      dropped subject could not be filed under `gram.copula` and got its own
 *      row instead (US-182) — the mirror image of decision 5, where widening the
 *      wording was the right answer because the remediation was the same.
 *
 * Where a test pins a *policy number* rather than a behaviour it reads the
 * constant off the module, so retuning the policy does not look like a
 * regression. Where the number itself is the contract (30 days, top 5, from
 * FR-SRS-3) it is written out literally.
 *
 * The US-165 and US-182 blocks require the grammar content files, so this suite
 * is the one place where the taxonomy and the content that references it are
 * checked against each other rather than against a transcription of each other.
 */

const Mistakes = require('../../js/core/mistakes.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1700000000000;   // fixed clock; Date.now() would make tests flaky

/** `d` days before NOW. */
const daysAgo = d => NOW - d * DAY_MS;

/** Seed one category with occurrences at the given ages in days. */
const seed = (category, ages, opts) => {
    ages.forEach(d => Mistakes.record(category, Object.assign({ at: daysAgo(d) }, opts)));
};

beforeEach(() => {
    Mistakes.resetCategories();
    // US-187. The drill-target registry is content's claim about itself, and is
    // deliberately NOT cleared by resetCategories() — reloading the built-in rows
    // does not unauthor a lesson on disk. It IS cleared here, because empty is the
    // module's state at first load and is what almost every test below wants: an
    // empty registry means "no claim", so nothing in this suite reads as dead
    // unless it registered something first.
    Mistakes.resetDrillTargets();
    Mistakes.entryList = [];
    Mistakes._now = () => NOW;
});

describe('the taxonomy', () => {
    it('covers every Telugu interference row in REQUIREMENTS.md §3', () => {
        const codes = Mistakes.categories().map(c => c.code).filter(Boolean);
        for (let i = 1; i <= 9; i++) expect(codes).toContain('T-G' + i);
        for (let i = 1; i <= 12; i++) expect(codes).toContain('T-P' + i);
    });

    it('also carries generic types, so a non-L1 error still has a name', () => {
        const generic = Mistakes.categories().filter(c => c.l1 === null);
        expect(generic.length).toBeGreaterThan(5);
        // FR-SRS-3 names three examples explicitly; all three must exist.
        expect(Mistakes.isKnownCategory('gram.articles')).toBe(true);          // article omission
        expect(Mistakes.isKnownCategory('prn.v-w')).toBe(true);                // /v/-/w/
        expect(Mistakes.isKnownCategory('gram.tense-agreement')).toBe(true);   // past-tense agreement
    });

    it('gives every category a stable id, a learner-facing label and a strand', () => {
        Mistakes.categories().forEach(c => {
            expect(typeof c.id).toBe('string');
            expect(c.id.length).toBeGreaterThan(0);
            expect(typeof c.label).toBe('string');
            expect(c.label.length).toBeGreaterThan(0);
            expect(typeof c.strand).toBe('string');
            expect(c.strand.length).toBeGreaterThan(0);
        });
    });

    it('explains itself: every reportable category has a one-line explanation', () => {
        // TEACHING_METHODOLOGY.md §5 / FR-A11Y-5: a named error with no
        // explanation is a red cross with no fix on the same screen.
        Mistakes.categories({ reportable: true }).forEach(c => {
            expect(c.explanation.length).toBeGreaterThan(20);
        });
    });

    it('has no duplicate ids', () => {
        const ids = Mistakes.categoryIds();
        expect(ids).toHaveLength(new Set(ids).size);
    });

    it('returns copies, so a caller cannot corrupt the taxonomy', () => {
        const cat = Mistakes.getCategory('gram.articles');
        cat.label = 'MUTATED';
        cat.drill.target = 'MUTATED';
        expect(Mistakes.getCategory('gram.articles').label).not.toBe('MUTATED');
        expect(Mistakes.drillTarget('gram.articles').target).toBe('articles');
    });

    it('returns null for an unknown id rather than guessing', () => {
        expect(Mistakes.getCategory('gram.artcles')).toBeNull();
        expect(Mistakes.getCategory(null)).toBeNull();
        expect(Mistakes.isKnownCategory('nope')).toBe(false);
    });

    it('filters by strand and by L1, treating non-L1 rows as universal', () => {
        expect(Mistakes.categories({ strand: 'grammar' }).length).toBeGreaterThan(9);
        const telugu = Mistakes.categories({ l1: 'telugu' });
        // Telugu rows plus every row that is not L1-specific.
        expect(telugu.some(c => c.code === 'T-G1')).toBe(true);
        expect(telugu.some(c => c.l1 === null)).toBe(true);
        expect(telugu.some(c => c.l1 === 'hindi')).toBe(false);
    });
});

describe('drillTarget — the "practise this" button (FR-SRS-3)', () => {
    it('hands back the FR-SRS-1 namespaced scheduler key', () => {
        expect(Mistakes.drillTarget('gram.articles')).toMatchObject({
            strand: 'grammar', target: 'articles', srsKey: 'gram:articles'
        });
        expect(Mistakes.drillTarget('prn.v-w')).toMatchObject({
            strand: 'pronunciation', target: 'v-w', srsKey: 'phon:v-w'
        });
    });

    it('is null where there is nothing honest to drill', () => {
        // The UI must read null as "offer no button", not as an error.
        expect(Mistakes.drillTarget('general.uncategorised')).toBeNull();
        expect(Mistakes.drillTarget('prn.retroflex')).toBeNull();
        expect(Mistakes.drillTarget('prn.recogniser-missed')).toBeNull();
    });

    it('gives a strand but no srsKey when the drill is a whole strand', () => {
        const t = Mistakes.drillTarget('vocab.meaning');
        expect(t.strand).toBe('vocabulary');
        expect(t.srsKey).toBeNull();
    });
});

describe('registerCategories — a second L1 as data (FR-CNT-3 / BR-10)', () => {
    const hindiRow = {
        id: 'gram.hi.progressive-habitual', code: 'H-G1', strand: 'grammar',
        l1: 'hindi', priority: 'M', label: '"-ing" used for a habit',
        explanation: 'Hindi marks habits with the form English keeps for right now.',
        example: '"I am going daily" → "I go daily"',
        drill: { strand: 'grammar', target: 'present-simple-vs-continuous' }
    };

    it('adds a new row and makes it immediately recordable and rankable', () => {
        const res = Mistakes.registerCategories(hindiRow);
        expect(res.added).toEqual(['gram.hi.progressive-habitual']);
        expect(res.rejected).toHaveLength(0);

        Mistakes.record('gram.hi.progressive-habitual', { at: daysAgo(1) });
        const top = Mistakes.topCategories();
        expect(top[0].id).toBe('gram.hi.progressive-habitual');
        expect(top[0].label).toBe('"-ing" used for a habit');
        expect(top[0].drill.srsKey).toBe('gram:present-simple-vs-continuous');
    });

    it('replaces a built-in row in place, so a profile can reword it', () => {
        const before = Mistakes.categoryIds().length;
        const res = Mistakes.registerCategories([{
            id: 'gram.articles', strand: 'grammar', l1: 'hindi',
            label: 'Missing or wrong "a", "an", "the"',
            explanation: 'Hindi has no articles either, so the same work applies.',
            drill: { strand: 'grammar', target: 'articles' }
        }]);
        expect(res.replaced).toEqual(['gram.articles']);
        expect(res.added).toHaveLength(0);
        expect(Mistakes.categoryIds()).toHaveLength(before);
        expect(Mistakes.getCategory('gram.articles').l1).toBe('hindi');
    });

    it('rejects malformed rows loudly instead of absorbing them (FR-CNT-1)', () => {
        const res = Mistakes.registerCategories([
            hindiRow,
            { label: 'no id' },
            { id: 'gram.noLabel' },
            'not an object',
            null
        ]);
        expect(res.added).toEqual(['gram.hi.progressive-habitual']);
        expect(res.rejected).toHaveLength(4);
        expect(Mistakes.isKnownCategory('gram.noLabel')).toBe(false);
    });

    it('defaults the optional fields, so a profile row can be terse', () => {
        Mistakes.registerCategories({ id: 'x.minimal', label: 'Minimal' });
        const cat = Mistakes.getCategory('x.minimal');
        expect(cat).toMatchObject({
            code: null, strand: 'general', l1: null, priority: 'S',
            explanation: '', example: null, drill: null, reportable: true
        });
    });

    it('resetCategories restores the built-ins', () => {
        const builtIn = Mistakes.categoryIds().length;
        Mistakes.registerCategories(hindiRow);
        expect(Mistakes.categoryIds()).toHaveLength(builtIn + 1);
        Mistakes.resetCategories();
        expect(Mistakes.categoryIds()).toHaveLength(builtIn);
        expect(Mistakes.isKnownCategory('gram.hi.progressive-habitual')).toBe(false);
    });
});

describe('countability: one error, one routing (US-159 / T-G4)', () => {
    // "I am looking for a work", "a meat", "an advice" and "three information"
    // are one habit — an uncountable noun treated as countable — and they used
    // to arrive under two ids depending on which lesson surfaced them. These
    // tests pin the decision: ONE row, widened to cover every shape, and the id
    // left alone because it is in learner storage.

    it('names all three shapes, not only the plural -s', () => {
        const cat = Mistakes.getCategory('gram.uncountable-plural');
        // The label is what the learner reads, and it has to be true for
        // "a work", where no -s is present.
        expect(cat.label).toMatch(/"a"/);
        expect(cat.label).toMatch(/-s/);
        expect(cat.label).toMatch(/number/);
        // ...and the example teaches both ends of the range.
        expect(cat.explanation + ' ' + cat.example).toMatch(/a work/);
        expect(cat.explanation + ' ' + cat.example).toMatch(/information/);
    });

    it('keeps the shipped id, because record() writes it into learner storage', () => {
        // Renaming this to something that reads better (gram.uncountable-counted,
        // say) would orphan every entry already logged under the old string.
        expect(Mistakes.isKnownCategory('gram.uncountable-plural')).toBe(true);
        expect(Mistakes.getCategory('gram.uncountable-plural').code).toBe('T-G4');
    });

    it('sends every shape to the one drill that fixes them', () => {
        // A second row would have had to point at this same target, so the
        // split would have bought two half-counts and one destination.
        expect(Mistakes.drillTarget('gram.uncountable-plural')).toMatchObject({
            strand: 'grammar',
            target: 'countable-uncountable',
            srsKey: 'gram:countable-uncountable'
        });
    });

    it('reports ONE finding when both lessons log the same habit', () => {
        // What the learner sees once data/grammar.js's articles point converges
        // on this id: five occurrences of one thing, not two rankings of one.
        Mistakes.record('gram.uncountable-plural', { at: daysAgo(2), given: 'a work' });
        Mistakes.record('gram.uncountable-plural', { at: daysAgo(2), given: 'a meat' });
        Mistakes.record('gram.uncountable-plural', { at: daysAgo(1), given: 'an advice' });
        Mistakes.record('gram.uncountable-plural', { at: daysAgo(1), given: 'a luggage' });
        Mistakes.record('gram.uncountable-plural', { at: daysAgo(1), given: 'three information' });

        const top = Mistakes.topCategories();
        expect(top).toHaveLength(1);
        expect(top[0].id).toBe('gram.uncountable-plural');
        expect(top[0].count).toBe(5);
        expect(top[0].share).toBe(1);
    });

    it('still ranks two DIFFERENT habits separately', () => {
        // US-165 closed the split in data/grammar.js — the articles point's "a
        // work" / "a meat" / "an work" / "an meat" entries now carry
        // `logAs: "gram.uncountable-plural"`, so the five shapes converge (see
        // the content-driven test below). What must NOT happen is the taxonomy
        // collapsing two genuinely different errors: a real article error and a
        // countability error are still two findings with two drills.
        Mistakes.record('gram.articles', { at: daysAgo(2), given: 'I went to shop' });
        Mistakes.record('gram.uncountable-plural', { at: daysAgo(1), given: 'an advice' });
        const top = Mistakes.topCategories();
        expect(top.map(r => r.id).sort())
            .toEqual(['gram.articles', 'gram.uncountable-plural']);
        expect(new Set(top.map(r => r.drill.srsKey)).size).toBe(2);
    });
});

describe('US-165 — the split routing converges, driven by the content itself', () => {
    // The point of this block is that it reads the routing OFF data/grammar.js and
    // data/grammar/countability.js rather than restating it. If someone re-points
    // one of those four `logAs` entries back at `gram.articles`, this fails.
    //
    // The two content files are classic scripts that share a lexical scope in the
    // browser: countability.js pushes itself into `grammarLessons.foundation` by
    // bare name. Under CommonJS each file gets its own module scope, so that
    // self-registration cannot fire and the test assembles the tiers by hand —
    // which is also why it asserts the point is present before relying on it.
    const grammar = require('../../data/grammar.js');
    const countability = require('../../data/grammar/countability.js');

    const lessons = {
        foundation: grammar.grammarLessons.foundation
            .concat(grammar.grammarLessons.foundation
                .some(p => p.id === countability.GRAMMAR_COUNTABILITY.id)
                ? []
                : [countability.GRAMMAR_COUNTABILITY]),
        everyday: [], confident: [], fluent: []
    };

    /** Every practice item, with the point it came from. */
    const items = () => {
        const out = [];
        Object.keys(lessons).forEach(tier => (lessons[tier] || []).forEach(point =>
            (point.practice || []).forEach(item => out.push({ point, item }))));
        return out;
    };

    /** What the CONTENT says to log when the learner picks `answer` on `itemId`. */
    const routeOf = (itemId, answer) => {
        const found = items().find(x => x.item.id === itemId);
        expect(found).toBeDefined();
        const fb = (found.item.feedback || []).find(f => f.forAnswer === answer);
        expect(fb).toBeDefined();
        return fb.logAs || found.point.mistakeCategory;
    };

    const byPrompt = needle => {
        const found = items().find(x => (x.item.prompt || '').indexOf(needle) >= 0);
        expect(found).toBeDefined();
        return found.item.id;
    };

    it('assembled both grammar points', () => {
        expect(lessons.foundation.map(p => p.id))
            .toEqual(expect.arrayContaining(['articles', 'countable-uncountable']));
    });

    it('routes the article-shaped uncountable error to the countability id', () => {
        // The four sites US-165 changed, identified by item and answer — never by
        // line number, because other work renumbers the items.
        expect(routeOf('articles-p4', 'a')).toBe('gram.uncountable-plural');   // "a meat"
        expect(routeOf('articles-p4', 'an')).toBe('gram.uncountable-plural');  // "an meat"
        expect(routeOf('articles-p6', 'a')).toBe('gram.uncountable-plural');   // "a work"
        expect(routeOf('articles-p6', 'an')).toBe('gram.uncountable-plural');  // "an work"
    });

    it('leaves every genuine article error on gram.articles', () => {
        // The other entries in the very same two items are article errors and
        // must not have been swept along: "the meat" and "the work" are real
        // English that mean something else here.
        expect(routeOf('articles-p4', 'the')).toBe('gram.articles');
        expect(routeOf('articles-p6', 'the')).toBe('gram.articles');
        // And nothing outside the uncountable shape moved: every remaining
        // gram.articles site is an omission or a wrong choice.
        items().forEach(({ item }) => (item.feedback || []).forEach(f => {
            if (f.logAs === 'gram.articles') {
                expect(['omission', 'wrong-choice']).toContain(f.errorKind);
            }
        }));
    });

    it('gives ONE finding, ONE count and ONE drill for all five shapes', () => {
        const shapes = [
            ['a work',            routeOf('articles-p6', 'a')],
            ['a meat',            routeOf('articles-p4', 'a')],
            ['an advice',         routeOf(byPrompt('get ___ from a lawyer'), 'an advice')],
            ['a luggage',         routeOf(byPrompt('luggage'), 'a')],
            ['three information', routeOf(byPrompt('The email left out three'), 'information')]
        ];
        shapes.forEach(([given, id], i) => Mistakes.record(id, { at: daysAgo(i + 1), given }));

        const top = Mistakes.topCategories();
        expect(top).toHaveLength(1);                                   // one finding
        expect(top[0].id).toBe('gram.uncountable-plural');
        expect(top[0].count).toBe(5);                                  // one count
        expect(top[0].share).toBe(1);
        expect(new Set(top.map(r => r.drill.srsKey)).size).toBe(1);    // one drill
        expect(top[0].drill.srsKey).toBe('gram:countable-uncountable');
    });

    it('declares no mistake id that record() would refuse (US-160)', () => {
        // This replaces the deleted MISTAKE_CATEGORIES array. It compares the ids
        // the content ACTUALLY writes against the module that owns the taxonomy,
        // so it catches a typo the hand-copied list could not — and cannot itself
        // go stale, which that list had (it omitted gram.register-indian).
        const declared = grammar.grammarMistakeCategoryIds(lessons);
        expect(declared.length).toBeGreaterThan(0);
        expect(Mistakes.unknownCategories(declared)).toEqual([]);
        expect(declared).toContain('gram.uncountable-plural');
        // The alias table's targets have to resolve too.
        expect(Mistakes.unknownCategories(Object.values(grammar.MISTAKE_CATEGORY_ALIASES)))
            .toEqual([]);
        // A stale local list is exactly what was removed; prove the module knows
        // the id that list was missing.
        expect(Mistakes.categoryIds({ strand: 'grammar' })).toContain('gram.register-indian');
        expect(grammar.MISTAKE_CATEGORIES).toBeUndefined();
    });
});

describe('US-182 — a dropped SUBJECT is its own row, and gram.copula keeps its id', () => {
    // data/grammar/be.js's header reported the gap: there was no id for "Am in a
    // meeting", "Is very good", "Very good at her job". The nearest row,
    // `gram.copula`, is labelled 'Dropped "am", "is" or "are"' — which is FALSE of
    // a sentence where the be word is present and the SUBJECT is missing, so
    // routing these there would hand the learner a finding they can check and
    // find wrong. These tests pin the new row, its wording, its destination, and
    // that nothing that already exists moved.
    //
    // The content half is read OFF data/grammar/be.js rather than restated, in
    // the style of the US-165 block above.
    const be = require('../../data/grammar/be.js').GRAMMAR_BE;

    /** Every mistake id be.js declares — `mistakeCategory` plus every `logAs`. */
    const beDeclaredIds = () => {
        const out = [be.mistakeCategory];
        (be.practice || []).forEach(item => (item.feedback || []).forEach(f => {
            if (f && f.logAs) out.push(f.logAs);
        }));
        return out.filter(Boolean);
    };

    /** What the CONTENT says to log when the learner picks `answer` on `itemId`. */
    const routeOf = (itemId, answer) => {
        const item = (be.practice || []).find(i => i.id === itemId);
        expect(item).toBeDefined();
        const fb = (item.feedback || []).find(f => f.forAnswer === answer);
        expect(fb).toBeDefined();
        return fb.logAs || be.mistakeCategory;
    };

    it('registers the row, and gram.copula is untouched', () => {
        expect(Mistakes.isKnownCategory('gram.subject-dropped')).toBe(true);
        // The id is learner storage: gram.copula could not be renamed or
        // repurposed, so the new error needed a new id beside it.
        const copula = Mistakes.getCategory('gram.copula');
        expect(copula.label).toBe('Dropped "am", "is" or "are"');
        expect(copula.code).toBe('T-G2');
        expect(Mistakes.drillTarget('gram.copula').srsKey).toBe('gram:be');
        // Nothing else was renamed or dropped either: 34 shipped rows + 1, and
        // + 1 again for US-224's `gram.auxiliary-omitted`.
        expect(Mistakes.categoryIds()).toHaveLength(36);
        ['gram.articles', 'gram.copula', 'gram.stative-progressive',
            'gram.uncountable-plural', 'gram.tag-question', 'gram.present-perfect',
            'gram.preposition-transfer', 'gram.embedded-question-order',
            'gram.auxiliary-omitted',
            'gram.register-indian', 'gram.tense-agreement', 'gram.subject-verb-agreement',
            'gram.verb-form', 'gram.word-order', 'prn.rhythm', 'prn.final-vowel',
            'prn.cluster', 'prn.word-stress', 'prn.v-w', 'prn.th', 'prn.i-length',
            'prn.ae-e', 'prn.o-ou', 'prn.z', 'prn.f-p', 'prn.retroflex',
            'prn.recogniser-missed', 'vocab.meaning', 'vocab.recall', 'vocab.collocation',
            'vocab.spelling', 'lsn.gist', 'lsn.detail', 'rdw.inference',
            'general.uncategorised'
        ].forEach(id => expect(Mistakes.isKnownCategory(id)).toBe(true));
    });

    it('has a label that is TRUE of the error routed to it', () => {
        const cat = Mistakes.getCategory('gram.subject-dropped');
        // The defect being fixed: the label must not say a be word was dropped,
        // because in every one of these sentences the be word is present.
        expect(cat.label).not.toMatch(/\bam\b|\bis\b|\bare\b/i);
        expect(cat.label).toMatch(/subject/i);
        // ...and the example has to show the shape the learner actually produced.
        expect(cat.example).toMatch(/Am in a meeting/);
        expect(cat.example).toMatch(/Is very good/);
    });

    it('is honest that English drops subjects too (§5, "never claim more than we have")', () => {
        const cat = Mistakes.getCategory('gram.subject-dropped');
        // "Sounds good" and "Can't complain" are ordinary English. A row that
        // told the learner a missing subject is always an error would be wrong,
        // and being told something wrong about your own language costs trust.
        expect(cat.explanation).toMatch(/not always an error/);
        expect(cat.explanation).toMatch(/Sounds good/);
        // The cost is tone, not grammar, and the row says so instead of
        // implying the sentence is broken.
        expect(cat.explanation).toMatch(/abrupt rather than wrong/);
    });

    it('follows §5 tone: second person, no blame, no exclamation marks', () => {
        const cat = Mistakes.getCategory('gram.subject-dropped');
        expect(cat.explanation).toMatch(/\byou\b/);
        expect(cat.label + cat.explanation + cat.example).not.toMatch(/!/);
        expect(cat.explanation).not.toMatch(/careless|lazy|wrong of you|bad/i);
        // Every reportable row owes the learner a reason, not just a name.
        expect(cat.explanation.length).toBeGreaterThan(20);
        expect(cat.reportable).toBe(true);
    });

    it('carries no T- code, because REQUIREMENTS.md §3.2 has no row for it', () => {
        // T-G2 is copula dropping specifically — its own example column is
        // "I doctor" / "He very good", both with the subject present. Minting a
        // T-G10 here would put a code in the data that the requirement does not
        // have; when §3.2 grows the row, this row can carry it.
        expect(Mistakes.getCategory('gram.subject-dropped').code).toBeNull();
        expect(Mistakes.categories().map(c => c.code)).not.toContain('T-G10');
        // Still a Telugu-transfer row, so an L1 filter finds it.
        expect(Mistakes.categories({ l1: 'telugu' }).map(c => c.id))
            .toContain('gram.subject-dropped');
    });

    it('points at a drill that exists, and shares it with gram.copula on purpose', () => {
        const t = Mistakes.drillTarget('gram.subject-dropped');
        expect(t).toMatchObject({
            strand: 'grammar', target: 'be', srsKey: 'gram:be',
            targets: ['be'], srsKeys: ['gram:be']
        });
        // drillTarget() builds `gram:<target>` without checking that anything
        // implements the target, so a slug nothing authors would schedule a
        // lesson the app cannot open. Read the target back off the content.
        expect(be.id).toBe('be');
        expect(be.srsKey).toBe('gram:be');
        expect(t.srsKey).toBe(be.srsKey);
        // One destination, two findings — the learner has to be told WHICH word
        // went missing, which is the whole reason the count is kept separate.
        expect(Mistakes.drillTarget('gram.copula').srsKey).toBe(t.srsKey);
    });

    it('ranks as its own finding, with a routable drill button', () => {
        seed('gram.subject-dropped', [1, 2, 3, 5],
            { item: 'be-p2', given: 'Am', expected: "I'm / I am", source: 'grammarPractice' });
        seed('gram.copula', [4]);

        const top = Mistakes.topCategories();
        expect(top[0].id).toBe('gram.subject-dropped');
        expect(top[0].label).toBe('A sentence that starts without its subject');
        expect(top[0].count).toBe(4);                    // the honest raw count
        expect(top[0].drillable).toBe(true);
        expect(top[0].drill.srsKey).toBe('gram:be');
        // Two findings, not one merged one, and not two halves of one habit.
        expect(top.map(r => r.id)).toEqual(['gram.subject-dropped', 'gram.copula']);
        expect(top[1].count).toBe(1);
    });

    it('is barred from the ranking on recogniser evidence, like every other row', () => {
        // BR-3 / FR-PRN-5. A new row must not become a back door into the
        // diagnosis for the weakest evidence the app has.
        seed('gram.subject-dropped', [1, 2, 3, 4, 5, 6], { evidence: Mistakes.EVIDENCE.RECOGNISER });
        expect(Mistakes.topCategories()).toEqual([]);
        const shown = Mistakes.topCategories({ countUnverified: true })[0];
        expect(shown.id).toBe('gram.subject-dropped');
        expect(shown.unverifiedCount).toBe(6);
        // Self-report may schedule but never certify (FR-SRS-5).
        Mistakes.entryList = [];
        seed('gram.subject-dropped', [1, 2], { evidence: Mistakes.EVIDENCE.SELF });
        expect(Mistakes.topCategories()).toEqual([]);
    });

    it('survives the taxonomy being reloaded, and its entries survive it not being there', () => {
        // The old-id path, exercised with the NEW id: a row that leaves the
        // taxonomy must leave its entries in storage, unranked rather than lost.
        seed('gram.subject-dropped', [1, 2]);
        expect(Mistakes.topCategories()[0].id).toBe('gram.subject-dropped');

        // Simulate the id having gone (a swapped L1 profile, a retired routing).
        Mistakes.categoryList = Mistakes.categoryList.filter(c => c.id !== 'gram.subject-dropped');
        Mistakes._reindex();
        expect(Mistakes.isKnownCategory('gram.subject-dropped')).toBe(false);
        expect(() => Mistakes.topCategories()).not.toThrow();
        expect(Mistakes.topCategories()).toEqual([]);          // unranked...
        expect(Mistakes.entryList).toHaveLength(2);            // ...but kept
        expect(Mistakes.countsByCategory()['gram.subject-dropped'].count).toBe(2);
        expect(Mistakes.history('gram.subject-dropped')).toHaveLength(2);
        expect(Mistakes.load().filter(e => e.category === 'gram.subject-dropped'))
            .toHaveLength(2);                                  // and reload-safe

        // resetCategories() brings the built-in row back, and the history with it.
        Mistakes.resetCategories();
        expect(Mistakes.isKnownCategory('gram.subject-dropped')).toBe(true);
        expect(Mistakes.topCategories()[0].count).toBe(2);
    });

    it('declares nothing be.js cannot log, and nothing be.js already logs has moved', () => {
        // The typo guard, pointed at the content that reported the gap.
        expect(Mistakes.unknownCategories(beDeclaredIds())).toEqual([]);
        expect(be.mistakeCategory).toBe('gram.copula');
        // Every wrong answer be.js authors today has its subject PRESENT, so
        // none of these three routings belongs on the new row and none moved.
        expect(routeOf('be-p1', 'my sister')).toBe('gram.copula');          // zero copula
        expect(routeOf('be-p2', 'i')).toBe('gram.copula');                 // zero copula
        expect(routeOf('be-p4', '')).toBe('gram.copula');                  // zero copula
        expect(routeOf('be-p6', 'she')).toBe('gram.copula');               // zero copula
        expect(routeOf('be-p2', 'i is')).toBe('gram.subject-verb-agreement');
        expect(routeOf('be-p6', 'she are')).toBe('gram.subject-verb-agreement');
    });

    it('will only ever be emitted for an answer that really has no subject', () => {
        // NOTHING emits this id yet — be.js is owned elsewhere and this file
        // cannot wire it. The one-line edit that file needs is on item `be-p2`
        // ("Sorry, ___ in a meeting until five."), whose options are currently
        // ["i'm", "i am", "i", "i is"]: add the bare be form `"am"`, so the
        // learner can choose the sentence they would actually say — "Am in a
        // meeting until five." — and give that option a feedback entry carrying
        //     logAs: "gram.subject-dropped"
        // (an option with no authored entry falls through to `fallbackFeedback`,
        // which has no `logAs`, so it would be logged as the point's default
        // `gram.copula` — the false label this row exists to avoid).
        //
        // This assertion is written so that it holds both before and after that
        // edit: it checks the HONESTY of any routing to the new row rather than
        // its presence, so wiring be.js does not break it.
        const subjectless = /^(am|is|are|was|were|'m|'s|'re)?$/;
        (be.practice || []).forEach(item => (item.feedback || []).forEach(f => {
            if (f && f.logAs === 'gram.subject-dropped') {
                // The chosen answer must be a bare be form or nothing at all —
                // if it contains a subject, the error is not a dropped subject.
                expect(String(f.forAnswer).trim().toLowerCase()).toMatch(subjectless);
            }
        }));
        // And whatever be.js declares must stay loggable.
        expect(Mistakes.unknownCategories(beDeclaredIds())).toEqual([]);
    });
});

describe('US-164 — a /ð/ miss has somewhere to go', () => {
    // consonants.js authors T-P6 as two pair sets, θ-t and ð-d, and gives BOTH
    // `mistakeCategory: 'prn.th'`. Only θ-t was a drill target, so phon:ð-d
    // scheduled fine and nothing in the log routed back to it.
    //
    // The fix is a second target under the one category, not a second category:
    // a new id would have no producer while consonants.js (read-only here) points
    // both sets at prn.th, and splitting would hand the learner two half-counts of
    // one habit. The two pair SETS stay separate, as that file's author argued.

    it('keeps one category for T-P6, with its id and its label intact', () => {
        expect(Mistakes.isKnownCategory('prn.th')).toBe(true);
        expect(Mistakes.getCategory('prn.th').code).toBe('T-P6');
        // The label has to stay true of both sounds, because both arrive here.
        expect(Mistakes.getCategory('prn.th').label).toMatch(/"t"/);
        expect(Mistakes.getCategory('prn.th').label).toMatch(/"d"/);
        // No second row was invented for the voiced half.
        expect(Mistakes.isKnownCategory('prn.th-voiced')).toBe(false);
        expect(Mistakes.isKnownCategory('prn.dh')).toBe(false);
    });

    it('hands a drill both halves, with the θ-t primary unchanged', () => {
        const t = Mistakes.drillTarget('prn.th');
        // Unchanged for every existing caller.
        expect(t.target).toBe('θ-t');
        expect(t.srsKey).toBe('phon:θ-t');
        // ...and now routable for /ð/.
        expect(t.targets).toEqual(['θ-t', 'ð-d']);
        expect(t.srsKeys).toEqual(['phon:θ-t', 'phon:ð-d']);
    });

    it('carries both keys through the ranked row a learner would act on', () => {
        seed('prn.th', [1, 2, 3, 6], { item: 'ð-d/then', given: 'den', expected: 'then' });
        const row = Mistakes.topCategories()[0];
        expect(row.id).toBe('prn.th');
        expect(row.drillable).toBe(true);
        expect(row.drill.srsKeys).toContain('phon:ð-d');
    });

    it('leaves every single-target row exactly as it was', () => {
        expect(Mistakes.drillTarget('prn.v-w')).toMatchObject({
            target: 'v-w', srsKey: 'phon:v-w', targets: ['v-w'], srsKeys: ['phon:v-w']
        });
        expect(Mistakes.drillTarget('gram.articles')).toMatchObject({
            target: 'articles', srsKey: 'gram:articles', targets: ['articles']
        });
        // A whole-strand drill still has no addressable item, so no keys.
        expect(Mistakes.drillTarget('vocab.meaning')).toMatchObject({
            target: null, srsKey: null, targets: [], srsKeys: []
        });
        expect(Mistakes.drillTarget('prn.retroflex')).toBeNull();
    });

    it('accepts either authoring shape, deduplicates, and returns copies', () => {
        Mistakes.registerCategories([
            { id: 'x.also', strand: 'pronunciation', label: 'alsoTargets form',
              drill: { strand: 'pronunciation', target: 'a', alsoTargets: ['b', 'a', '', null] } },
            { id: 'x.list', strand: 'pronunciation', label: 'bare targets form',
              drill: { strand: 'pronunciation', targets: ['c', 'd'] } }
        ]);
        expect(Mistakes.drillTarget('x.also').targets).toEqual(['a', 'b']);
        // A bare list promotes its first entry to the primary, so `srsKey` is
        // never null just because the author used the other shape.
        expect(Mistakes.drillTarget('x.list')).toMatchObject({
            target: 'c', srsKey: 'phon:c', targets: ['c', 'd']
        });

        const copy = Mistakes.getCategory('prn.th');
        copy.drill.targets.push('MUTATED');
        expect(Mistakes.drillTarget('prn.th').targets).toEqual(['θ-t', 'ð-d']);
        Mistakes.drillTarget('prn.th').srsKeys.push('MUTATED');
        expect(Mistakes.drillTarget('prn.th').srsKeys).toHaveLength(2);
    });
});

describe('US-187 — a drill target that nothing authors is distinguishable from one that does', () => {
    // drillTarget() composed `gram:<target>` with no check that anything was
    // authored under it, so the dashboard drew "Practise this" from a key that
    // opens nothing: the learner clicks and the app does nothing, which is the
    // class of silent failure BR-3 exists to prevent. Four targets are in that
    // state today — `past-simple` (two rows point at it), `prepositions`,
    // `register`, plus the listening and reading targets.
    //
    // The seam is a REGISTRATION, mirroring registerCategories(): content declares
    // what it authored and this module only remembers, because a core module that
    // read data/grammar/* would invert the load order and couple the taxonomy to
    // one profile's content (FR-CNT-3 / BR-10). The authored half is read OFF
    // data/grammar/question-formation.js rather than restated, in the style of the
    // US-165 and US-182 blocks above.
    const questionFormation =
        require('../../data/grammar/question-formation.js').GRAMMAR_QUESTION_FORMATION;

    /** What data/grammar/*.js would register at load, read off the content. */
    const registerAuthoredGrammar = () =>
        Mistakes.registerDrillTargets('grammar', [
            require('../../data/grammar/be.js').GRAMMAR_BE,
            require('../../data/grammar/countability.js').GRAMMAR_COUNTABILITY,
            questionFormation
        ]);

    it('makes NO claim until content has registered something', () => {
        // The load-bearing case. An empty registry is the state at first load, in
        // this whole suite, and on a device where a content script failed to fetch.
        // Reading it as "dead" would blank every drill button in the app on the
        // strength of a registration that had not run yet.
        expect(Mistakes.authoredTargets('grammar')).toEqual([]);
        const t = Mistakes.drillTarget('gram.articles');
        expect(t.authored).toBeNull();
        expect(t.liveTargets).toEqual([]);
        expect(t.deadTargets).toEqual([]);
        // ...and everything a pre-US-187 caller read is byte-for-byte unchanged.
        expect(t).toMatchObject({
            strand: 'grammar', target: 'articles', srsKey: 'gram:articles',
            targets: ['articles'], srsKeys: ['gram:articles']
        });
        expect(Mistakes.isAuthoredTarget('grammar', 'articles')).toBeNull();
    });

    it('reads question-formation as LIVE once its own file registers it', () => {
        registerAuthoredGrammar();
        expect(questionFormation.id).toBe('question-formation');
        const t = Mistakes.drillTarget('gram.word-order');
        expect(t.authored).toBe(true);
        expect(t.liveTargets).toEqual(['question-formation']);
        expect(t.deadTargets).toEqual([]);
        expect(t.srsKey).toBe('gram:question-formation');
        // All FOUR rows that route there resolve, US-215's three plus US-224's.
        ['gram.tag-question', 'gram.embedded-question-order', 'gram.word-order',
            'gram.auxiliary-omitted'].forEach(id => {
            expect(Mistakes.drillTarget(id).authored).toBe(true);
        });
    });

    it('reads a target outside the registered set as DEAD, and names it', () => {
        // Deliberately registers a PARTIAL set — the three points this block
        // requires — so what reads dead is a property of the registry handed in,
        // not of what happens to be authored in the repo today. `prepositions` and
        // `register` are dangling as US-187 was written; the day someone authors
        // one, app.js registers it and it reads live with no change here.
        registerAuthoredGrammar();
        // The two rows that point at `past-simple`, which nothing authors.
        ['gram.tense-agreement', 'gram.verb-form'].forEach(id => {
            const t = Mistakes.drillTarget(id);
            expect(t.authored).toBe(false);
            expect(t.deadTargets).toEqual(['past-simple']);
            expect(t.liveTargets).toEqual([]);
        });
        expect(Mistakes.drillTarget('gram.preposition-transfer').deadTargets)
            .toEqual(['prepositions']);
        expect(Mistakes.drillTarget('gram.register-indian').deadTargets)
            .toEqual(['register']);
        // And a live one beside them, so `false` is a real discrimination and not
        // a blanket answer.
        expect(Mistakes.drillTarget('gram.copula').authored).toBe(true);
    });

    it('does NOT drop a dead target from targets, srsKeys or the panel', () => {
        // A category whose lesson does not exist is still a real weakness the
        // learner has. The finding stays, `drillable` stays true, and the panel
        // owes them the honest line about there being no exercise yet — which is a
        // different claim from "this one has no drill of its own", the copy for a
        // row with `drill: null`.
        registerAuthoredGrammar();
        seed('gram.tense-agreement', [1, 2, 3]);
        const row = Mistakes.topCategories()[0];
        expect(row.id).toBe('gram.tense-agreement');
        expect(row.count).toBe(3);
        expect(row.drillable).toBe(true);                       // unchanged
        expect(row.drill.srsKey).toBe('gram:past-simple');      // unchanged
        expect(row.drill.targets).toEqual(['past-simple']);     // unchanged
        expect(row.drill.authored).toBe(false);                 // ...and now known
        // The two "no button" cases stay distinguishable, which is what the two
        // different sentences in the panel are keyed on.
        expect(Mistakes.drillTarget('prn.retroflex')).toBeNull();
    });

    it('answers per destination, so prn.th can have one live half and one dead', () => {
        Mistakes.registerDrillTargets('pronunciation', ['θ-t', 'v-w']);
        const t = Mistakes.drillTarget('prn.th');
        expect(t.authored).toBe(true);            // the primary is authored
        expect(t.liveTargets).toEqual(['θ-t']);
        expect(t.deadTargets).toEqual(['ð-d']);   // ...and the /ð/ half is not
        expect(t.srsKeys).toEqual(['phon:θ-t', 'phon:ð-d']);   // still both
        // Registering the second half makes it live with no other change.
        Mistakes.registerDrillTargets('pronunciation', 'ð-d');
        expect(Mistakes.drillTarget('prn.th').liveTargets).toEqual(['θ-t', 'ð-d']);
        expect(Mistakes.drillTarget('prn.th').deadTargets).toEqual([]);
    });

    it('makes no claim about a whole-strand drill, which has nothing to author', () => {
        // vocab.meaning declares `target: null` — "the strand IS the destination",
        // authored intent rather than a dead end — so `false` would be a lie even
        // with a populated vocabulary registry.
        Mistakes.registerDrillTargets('vocabulary', ['some-word-list']);
        const t = Mistakes.drillTarget('vocab.meaning');
        expect(t.target).toBeNull();
        expect(t.authored).toBeNull();
        expect(t.deadTargets).toEqual([]);
    });

    it('keeps strands apart, so a pronunciation pair is not a grammar point', () => {
        Mistakes.registerDrillTargets('pronunciation', ['θ-t']);
        expect(Mistakes.isAuthoredTarget('grammar', 'θ-t')).toBeNull();
        expect(Mistakes.drillTarget('gram.articles').authored).toBeNull();
        expect(Mistakes.resetDrillTargets('pronunciation')).toBe(1);
        expect(Mistakes.authoredTargets('pronunciation')).toEqual([]);
    });

    it('accepts a slug, its srsKey, or the authored object itself', () => {
        // One line beside the self-registration a content file already does, using
        // whatever that file has to hand.
        Mistakes.registerDrillTargets('grammar', 'articles');
        Mistakes.registerDrillTargets('grammar', 'gram:be');
        Mistakes.registerDrillTargets('grammar', [{ id: 'countable-uncountable' }]);
        Mistakes.registerDrillTargets('grammar', [{ srsKey: 'gram:question-formation' }]);
        expect(Mistakes.authoredTargets('grammar').sort()).toEqual(
            ['articles', 'be', 'countable-uncountable', 'question-formation']);
        ['gram.articles', 'gram.copula', 'gram.uncountable-plural', 'gram.word-order']
            .forEach(id => expect(Mistakes.drillTarget(id).authored).toBe(true));
    });

    it('refuses a namespaced key that does not match the strand (FR-CNT-1)', () => {
        // Filing `phon:v-w` as a grammar point called "phon:v-w" would populate the
        // registry with an entry no category can ever match, and would make every
        // real grammar target read as dead. Loud, not absorbed.
        const res = Mistakes.registerDrillTargets('grammar', ['phon:v-w', 'articles', '', null]);
        expect(res.added).toEqual(['articles']);
        expect(res.ignored).toHaveLength(3);
        expect(Mistakes.authoredTargets('grammar')).toEqual(['articles']);
        // No strand, nothing to file it under, so nothing is guessed at.
        expect(Mistakes.registerDrillTargets('', ['articles']).ignored).toHaveLength(1);
        expect(Mistakes.authoredTargets('')).toEqual([]);
    });

    it('refuses the entry shapes that name no target at all', () => {
        // `{ target }` wins over `{ id }`, because a row that carries both means
        // the drill destination by the first.
        expect(Mistakes.registerDrillTargets('grammar',
            [{ target: 'articles', id: 'not-this-one' }]).added).toEqual(['articles']);
        // A bare namespace with nothing after it, an object with none of the three
        // fields, and — for a strand with no SRS namespace at all — anything
        // colon-shaped, since `lsn:` is not a namespace this module mints.
        expect(Mistakes.registerDrillTargets('grammar', ['gram:', 'gram:   ']).added).toEqual([]);
        expect(Mistakes.registerDrillTargets('grammar', [{ code: 'T-G1' }]).added).toEqual([]);
        expect(Mistakes.registerDrillTargets('listening', ['lsn:gist']).added).toEqual([]);
        expect(Mistakes.registerDrillTargets('listening', ['gist']).added).toEqual(['gist']);
        expect(Mistakes.drillTarget('lsn.gist').authored).toBe(true);
        expect(Mistakes.drillTarget('lsn.detail').authored).toBe(false);
        // An empty target is a question with no answer, not a dead target.
        expect(Mistakes.isAuthoredTarget('listening', '')).toBeNull();
        expect(Mistakes.isAuthoredTarget('listening', null)).toBeNull();
    });

    it('is idempotent, so a double-loaded script is a no-op not an error', () => {
        expect(Mistakes.registerDrillTargets('grammar', ['articles', 'be']).added)
            .toEqual(['articles', 'be']);
        const again = Mistakes.registerDrillTargets('grammar', ['articles', 'be', 'articles']);
        expect(again.added).toEqual([]);
        expect(again.known).toEqual(['articles', 'be']);
        expect(Mistakes.authoredTargets('grammar')).toEqual(['articles', 'be']);
    });

    it('reports an ignored entry through AppErrorHandler, as a bad row is', () => {
        const logged = [];
        const previous = global.AppErrorHandler;
        global.AppErrorHandler = { logError: (e, ctx) => logged.push(ctx) };
        try {
            Mistakes.registerDrillTargets('grammar', ['phon:v-w']);
            expect(logged).toContain('Mistakes drill targets');
        } finally {
            if (previous === undefined) delete global.AppErrorHandler;
            else global.AppErrorHandler = previous;
        }
    });

    it('survives resetCategories, because content is not the taxonomy', () => {
        registerAuthoredGrammar();
        Mistakes.resetCategories();
        // Reloading the built-in rows does not unauthor a lesson that is on disk.
        expect(Mistakes.drillTarget('gram.word-order').authored).toBe(true);
        expect(Mistakes.resetDrillTargets()).toBeGreaterThan(0);
        expect(Mistakes.drillTarget('gram.word-order').authored).toBeNull();
    });

    it('answers for a row a second L1 profile registers, with no change here', () => {
        // FR-CNT-3 / BR-10: the two extension points compose. A Hindi row pointing
        // at an authored point reads live; one pointing at a slug nobody wrote
        // reads dead, and the profile author finds out from this module.
        registerAuthoredGrammar();
        Mistakes.registerCategories([
            { id: 'gram.hi.live', strand: 'grammar', label: 'Points at a real point',
              drill: { strand: 'grammar', target: 'question-formation' } },
            { id: 'gram.hi.dead', strand: 'grammar', label: 'Points at a slug nobody wrote',
              drill: { strand: 'grammar', target: 'ergative-ne' } }
        ]);
        expect(Mistakes.drillTarget('gram.hi.live').authored).toBe(true);
        expect(Mistakes.drillTarget('gram.hi.dead').authored).toBe(false);
        expect(Mistakes.drillTarget('gram.hi.dead').deadTargets).toEqual(['ergative-ne']);
    });
});

describe('US-224 — an omitted helper word is its own row, and gram.word-order keeps its wording', () => {
    // There was no id for "Where you live?" / "You know him?", so
    // data/grammar/question-formation.js sends those options to `gram.word-order`
    // with `errorKind: 'auxiliary-omitted-in-direct-question'`. Honest and blunt:
    // in "Where you live?" every word is exactly where English wants it and one
    // word is absent, so "Words in the wrong order" is a finding the learner can
    // check and find wrong — the US-182 / US-185 defect class.
    //
    // The tension US-224 names is that `gram.word-order` now has THREE producers.
    // Two are order errors (app.js's sentence builder; question-formation.js's
    // `auxiliary-after-subject-sov-residue`) and one is an omission. The label is
    // true of the first two and false of the third, and a label true of all three
    // would have to describe a scrambled adverb and an absent auxiliary at once,
    // which stops being a diagnosis. So the third leaves.
    //
    // The content half is read OFF question-formation.js rather than restated.
    const qf = require('../../data/grammar/question-formation.js').GRAMMAR_QUESTION_FORMATION;

    /** What the CONTENT says to log when the learner picks `answer` on `itemId`. */
    const routeOf = (itemId, answer) => {
        const item = (qf.practice || []).find(i => i.id === itemId);
        expect(item).toBeDefined();
        const fb = (item.feedback || []).find(f => f.forAnswer === answer);
        expect(fb).toBeDefined();
        return { logAs: fb.logAs || qf.mistakeCategory, errorKind: fb.errorKind };
    };

    it('registers the row beside the one it split from', () => {
        expect(Mistakes.isKnownCategory('gram.auxiliary-omitted')).toBe(true);
        const cat = Mistakes.getCategory('gram.auxiliary-omitted');
        expect(cat.strand).toBe('grammar');
        expect(cat.l1).toBe('telugu');       // same source as T-G5 and T-G8
        expect(cat.reportable).toBe(true);
    });

    it('has a label TRUE of the error routed to it — and no claim about order', () => {
        const cat = Mistakes.getCategory('gram.auxiliary-omitted');
        // The defect being fixed: the label must not say anything is misordered,
        // because in every one of these sentences the order is correct.
        expect(cat.label).not.toMatch(/order/i);
        expect(cat.label).toMatch(/question/i);
        expect(cat.label).toMatch(/missing|left out|no helper/i);
        // ...and the example shows the shape the learner actually produced.
        expect(cat.example).toMatch(/Where you live\?/);
        expect(cat.example).toMatch(/You know him\?/);
        expect(cat.example).toMatch(/Where do you live\?/);
    });

    it('speaks the same word as the lesson its button opens', () => {
        // question-formation.js teaches the whole idea as "the helper moves in
        // front of the subject". A panel that said "auxiliary" and a lesson that
        // said "helper" would be two vocabularies for one idea.
        const cat = Mistakes.getCategory('gram.auxiliary-omitted');
        expect(cat.label + cat.explanation).toMatch(/helper/);
        expect(cat.label + cat.explanation).not.toMatch(/auxiliar/i);
        expect(qf.review.rulePrompt).toMatch(/helper/);
    });

    it('is honest that English drops helpers too (§5, "never claim more than we have")', () => {
        // "You coming?" and "Seen it yet?" are ordinary English. A row that told
        // the learner a missing helper is always an error would be wrong, and
        // being told something wrong about your own language costs trust — the
        // same commitment gram.subject-dropped makes.
        const cat = Mistakes.getCategory('gram.auxiliary-omitted');
        expect(cat.explanation).toMatch(/not always an error/);
        expect(cat.explanation).toMatch(/You coming\?/);
        // The cost is how it is heard, not whether it is understood.
        expect(cat.explanation).toMatch(/rather than misunderstood/);
    });

    it('follows §5 tone: second person, no blame, no exclamation marks', () => {
        const cat = Mistakes.getCategory('gram.auxiliary-omitted');
        expect(cat.explanation).toMatch(/\byou\b/i);
        expect(cat.label + cat.explanation + cat.example).not.toMatch(/!/);
        expect(cat.explanation).not.toMatch(/careless|lazy|wrong of you|bad/i);
        expect(cat.explanation.length).toBeGreaterThan(20);
    });

    it('carries no T- code, because §3.2 has no row for omission', () => {
        // T-G8 is "SOV residue in questions and embedded clauses" — residue is a
        // word in the WRONG PLACE, and its own example column is "You know where
        // is the station?". Omission is a word that was never borrowed.
        expect(Mistakes.getCategory('gram.auxiliary-omitted').code).toBeNull();
        expect(Mistakes.categories().map(c => c.code)).not.toContain('T-G10');
        expect(Mistakes.getCategory('gram.embedded-question-order').code).toBe('T-G8');
        // Still Telugu transfer, so an L1 filter finds it.
        expect(Mistakes.categories({ l1: 'telugu' }).map(c => c.id))
            .toContain('gram.auxiliary-omitted');
    });

    it('is priority S, on the intelligibility grounds §3.2 uses', () => {
        // Nobody has ever failed to understand "Where you live?". What it costs is
        // being heard as learner English — worth a row, not worth an M.
        expect(Mistakes.getCategory('gram.auxiliary-omitted').priority).toBe('S');
        expect(Mistakes.getCategory('gram.preposition-transfer').priority).toBe('S');
    });

    it('shares one drill with gram.word-order on purpose, as US-182 established', () => {
        const t = Mistakes.drillTarget('gram.auxiliary-omitted');
        expect(t).toMatchObject({
            strand: 'grammar', target: 'question-formation',
            srsKey: 'gram:question-formation'
        });
        // Read the destination back off the content, not off a literal.
        expect(qf.id).toBe('question-formation');
        expect(t.srsKey).toBe('gram:' + qf.id);
        expect(Mistakes.drillTarget('gram.word-order').srsKey).toBe(t.srsKey);
        // One destination, FOUR findings. That is the established shape here, not
        // a compromise: gram.copula and gram.subject-dropped already share
        // `gram:be` because the learner has to be told which word went missing.
        const sharing = Mistakes.categories()
            .filter(c => c.drill && c.drill.target === 'question-formation')
            .map(c => c.id);
        expect(sharing).toEqual(['gram.tag-question', 'gram.embedded-question-order',
            'gram.auxiliary-omitted', 'gram.word-order']);
    });

    it('leaves gram.word-order its id AND its label, which are true of what remains', () => {
        // Not renamed: record() writes this string into learner storage, so a
        // rename would orphan every entry already logged under it. Not reworded
        // either, because both remaining producers ARE misordered words.
        const cat = Mistakes.getCategory('gram.word-order');
        expect(cat.label).toBe('Words in the wrong order');
        expect(cat.code).toBeNull();
        expect(cat.priority).toBe('M');
        // The one thing that changed: the example now teaches the question-shaped
        // producer as well as the sentence-builder one, which it has had since
        // US-215 and never showed.
        expect(cat.example).toMatch(/I like this book very much/);
        expect(cat.example).toMatch(/Where are you going\?/);
    });

    it('ranks as its own finding, and does not halve the row it left', () => {
        // What the learner sees. Two labels, both true, and neither is two halves
        // of one habit: "borrow a word that is missing" and "move a word you
        // already said" are two different things to notice.
        seed('gram.auxiliary-omitted', [1, 2, 3, 5], { given: 'you live', source: 'grammarPractice' });
        seed('gram.word-order', [4, 6], { given: 'I like very much this book' });

        const top = Mistakes.topCategories();
        expect(top.map(r => r.id)).toEqual(['gram.auxiliary-omitted', 'gram.word-order']);
        expect(top[0].label).toBe('A question with its helper word missing');
        expect(top[0].count).toBe(4);
        expect(top[1].label).toBe('Words in the wrong order');
        expect(top[1].count).toBe(2);
        expect(top[0].drillable).toBe(true);
        expect(top[0].drill.srsKey).toBe('gram:question-formation');
    });

    it('leaves already-logged gram.word-order entries in place and still ranked', () => {
        // The split cannot be retroactive, and this is why: record() stores
        // `category`, `at`, `evidence` and free text, and NOT `errorKind`. The log
        // physically does not contain the fact that would say which past entries
        // were omissions, so a migration would have to guess — and guessing which
        // of a learner's own mistakes were which is worse than a stale label on a
        // few of them. Nothing is orphaned and nothing stops being ranked.
        const stored = Mistakes.record('gram.word-order', { at: daysAgo(1), given: 'you live' });
        expect(Object.keys(stored).sort())
            .toEqual(['at', 'category', 'evidence', 'expected', 'given', 'item', 'source']);
        expect(stored.category).toBe('gram.word-order');
        expect(Object.prototype.hasOwnProperty.call(stored, 'errorKind')).toBe(false);
        expect(Mistakes.topCategories()[0].id).toBe('gram.word-order');
        expect(Mistakes.topCategories()[0].label).toBe('Words in the wrong order');
        // ...and the 30-day window is a hard edge, so a mislabelled historical
        // entry ages out of the panel by itself rather than needing a rewrite.
        expect(Mistakes.topCategories({ now: NOW + 31 * DAY_MS })).toEqual([]);
        expect(Mistakes.stats().entries).toBe(1);
    });

    it('is loggable now, and the content still declares nothing record() refuses', () => {
        // NOTHING emits this id yet — question-formation.js is owned elsewhere and
        // this file cannot wire it. The edit that file needs is on
        // `question-formation-p1`, whose "you live" option carries
        //     logAs: "gram.word-order", errorKind: "auxiliary-omitted-in-direct-question"
        // and should become `logAs: "gram.auxiliary-omitted"` with the errorKind
        // kept. That is the ONLY site: the other word-order routings in that file
        // are order errors and stay put.
        expect(Mistakes.record('gram.auxiliary-omitted', { at: daysAgo(1) })).not.toBeNull();

        const declared = [qf.mistakeCategory];
        (qf.practice || []).forEach(item => (item.feedback || []).forEach(f => {
            if (f && f.logAs) declared.push(f.logAs);
        }));
        expect(Mistakes.unknownCategories(declared)).toEqual([]);

        // Written to hold both before and after that edit: it pins that the
        // omission errorKind and the order errorKinds never share a destination,
        // rather than pinning which destination the omission currently has.
        const omission = routeOf('question-formation-p1', 'you live');
        const residue = routeOf('question-formation-p1', 'you do live');
        expect(omission.errorKind).toBe('auxiliary-omitted-in-direct-question');
        expect(residue.errorKind).toBe('auxiliary-after-subject-sov-residue');
        expect(['gram.word-order', 'gram.auxiliary-omitted']).toContain(omission.logAs);
        expect(residue.logAs).toBe('gram.word-order');
        // Whatever the omission is logged as, its row's label must be true of it.
        expect(Mistakes.getCategory(omission.logAs).label)
            .toMatch(omission.logAs === 'gram.auxiliary-omitted' ? /helper/ : /order/);
    });
});

describe('Task 3 — the taxonomy does not claim which rows have a producer', () => {
    // Four rows can never fire in this build — `vocab.recall`,
    // `vocab.collocation`, `lsn.gist`, `rdw.inference` — because no gradable task
    // exists to attach them to, and app.js documents that beside the code that
    // would have to change. The taxonomy's shape doc now names the DISTINCTION an
    // author needs (unused vs unusable) and says where the live answer is, as a
    // dated observation. It is deliberately not a field, and these pin that.

    it('carries no per-row producer field that could go stale', () => {
        // A `producer` / `producible` field here would be a second copy of a fact
        // this module cannot check — the US-160 defect, where data/grammar.js's
        // hand-copied list went stale and began rejecting a valid id.
        Mistakes.categories().forEach(c => {
            ['producer', 'producers', 'producible', 'hasProducer', 'unusable']
                .forEach(k => expect(Object.prototype.hasOwnProperty.call(c, k)).toBe(false));
        });
        // The row shape is exactly the eleven documented fields, so a later field
        // cannot arrive unremarked.
        expect(Object.keys(Mistakes.getCategory('gram.articles')).sort()).toEqual(
            ['code', 'drill', 'example', 'explanation', 'id', 'l1', 'label',
                'priority', 'reportable', 'strand']);
    });

    it('reports what has actually fired on THIS device, and nothing more', () => {
        // The only honest runtime answer, and it is a fact about the learner's
        // history rather than about the build. Absence here is NOT evidence that a
        // producer does not exist: a row whose producer the learner never
        // triggered is indistinguishable from one that has none, which is why the
        // claim is not made in either direction.
        expect(Mistakes.isKnownCategory('vocab.recall')).toBe(true);
        expect(Mistakes.stats().categoriesSeen).toBe(0);
        expect(Mistakes.stats().categoriesRegistered).toBe(36);
        seed('vocab.meaning', [1]);
        expect(Mistakes.stats().categoriesSeen).toBe(1);
        // The four never-firing rows are ordinary rows in every other respect:
        // registered, reportable, explained, and rankable the day one is wired.
        ['vocab.recall', 'vocab.collocation', 'lsn.gist', 'rdw.inference'].forEach(id => {
            const cat = Mistakes.getCategory(id);
            expect(cat.reportable).toBe(true);
            expect(cat.explanation.length).toBeGreaterThan(20);
            expect(Mistakes.record(id, { at: daysAgo(1) })).not.toBeNull();
        });
        expect(Mistakes.topCategories({ limit: 99 }).map(r => r.id))
            .toEqual(expect.arrayContaining(['vocab.recall', 'lsn.gist']));
    });

    it('does not let the drill registry answer the producer question either', () => {
        // The two are separate axes and the asymmetry is principled: content CAN
        // declare what it authored, so the DRILL half of "does this button go
        // anywhere" is answerable here. Nothing can declare a producer's absence,
        // so a registered drill target says nothing about whether anything logs
        // the row that points at it.
        Mistakes.registerDrillTargets('listening', ['gist', 'detail']);
        expect(Mistakes.drillTarget('lsn.gist').authored).toBe(true);
        expect(Mistakes.stats().categoriesSeen).toBe(0);   // still no producer
    });
});

describe('an id that is no longer registered still resolves (id stability)', () => {
    // Category ids live in learner data. The documented behaviour is that an
    // entry whose category has gone is KEPT in storage and merely left out of
    // the ranking — dropping it would destroy history on a content change, and
    // throwing would cost the learner the app. Any future decision to retire a
    // routing depends on this holding.
    const retired = { id: 'gram.retired-routing', strand: 'grammar', label: 'A routing that later went away' };

    it('does not throw, and does not drop the entries', () => {
        Mistakes.registerCategories(retired);
        seed('gram.retired-routing', [3, 4]);
        seed('gram.articles', [3]);
        expect(Mistakes.topCategories().map(r => r.id)).toContain('gram.retired-routing');

        Mistakes.resetCategories();                 // the row is gone
        expect(Mistakes.isKnownCategory('gram.retired-routing')).toBe(false);

        expect(() => Mistakes.topCategories()).not.toThrow();
        expect(Mistakes.topCategories().map(r => r.id)).toEqual(['gram.articles']);
        expect(Mistakes.stats().entries).toBe(3);
        expect(Mistakes.entries().filter(e => e.category === 'gram.retired-routing')).toHaveLength(2);
    });

    it('keeps counting and can still be listed, so nothing is silently lost', () => {
        Mistakes.registerCategories(retired);
        seed('gram.retired-routing', [2, 5]);
        Mistakes.resetCategories();
        // These two do not consult the taxonomy, by design: the raw log is the
        // record of what happened, whatever the taxonomy currently says.
        expect(Mistakes.countsByCategory()['gram.retired-routing'].count).toBe(2);
        expect(Mistakes.history('gram.retired-routing')).toHaveLength(2);
    });

    it('ranks again the moment the id is registered again', () => {
        Mistakes.registerCategories(retired);
        seed('gram.retired-routing', [1, 2]);
        Mistakes.resetCategories();
        expect(Mistakes.topCategories()).toEqual([]);
        Mistakes.registerCategories(retired);
        expect(Mistakes.topCategories()[0].id).toBe('gram.retired-routing');
        expect(Mistakes.topCategories()[0].count).toBe(2);
    });
});

describe('the taxonomy answers the typo guard itself (US-160)', () => {
    // data/grammar.js used to keep a literal MISTAKE_CATEGORIES array so an
    // author's `logAs` typo would fail a test. A duplicated list goes stale —
    // that one was missing gram.register-indian, so the guard would have rejected
    // a valid id. It has been deleted; these pin the module-side replacement, and
    // the US-165 block above runs it against the real content.

    it('filters ids by strand, so a content file need not keep its own list', () => {
        const grammarIds = Mistakes.categoryIds({ strand: 'grammar' });
        expect(grammarIds).toContain('gram.articles');
        expect(grammarIds).toContain('gram.register-indian');   // the omission in question
        expect(grammarIds).toContain('gram.uncountable-plural');
        expect(grammarIds).not.toContain('prn.v-w');
        expect(grammarIds.every(id => Mistakes.isKnownCategory(id))).toBe(true);
        // Unfiltered still means everything, as it always did.
        expect(Mistakes.categoryIds()).toHaveLength(Mistakes.categoryList.length);
    });

    it('names the unknown ids and stays quiet when they all resolve', () => {
        expect(Mistakes.unknownCategories(Mistakes.categoryIds())).toEqual([]);
        expect(Mistakes.unknownCategories(['gram.articles', 'gram.register-indian'])).toEqual([]);
        expect(Mistakes.unknownCategories('gram.artcles')).toEqual(['gram.artcles']);
    });

    it('reports each bad id once, however many places repeat it', () => {
        expect(Mistakes.unknownCategories([
            'gram.articles', 'gram.artcles', 'gram.artcles', 'gram.uncountble-plural'
        ])).toEqual(['gram.artcles', 'gram.uncountble-plural']);
    });

    it('flags exactly what record() would have refused to log', () => {
        const bad = 'gram.uncountable-counted';   // a plausible id that does not exist
        expect(Mistakes.unknownCategories([bad])).toEqual([bad]);
        expect(Mistakes.record(bad)).toBeNull();
        expect(Mistakes.stats().entries).toBe(0);
    });
});

describe('record', () => {
    it('stores the category, the time and the evidence class', () => {
        const entry = Mistakes.record('gram.articles');
        expect(entry).toMatchObject({
            category: 'gram.articles',
            at: NOW,
            evidence: Mistakes.EVIDENCE.GRADED   // the default: the app graded it
        });
    });

    it('keeps enough context to teach from later', () => {
        const entry = Mistakes.record('gram.articles', {
            item: 'sentences:12',
            given: 'I went to shop',
            expected: 'I went to the shop',
            source: 'sentenceCheck'
        });
        expect(entry.given).toBe('I went to shop');
        expect(entry.expected).toBe('I went to the shop');
        expect(entry.source).toBe('sentenceCheck');
    });

    it('truncates free text so one caller cannot bloat the log', () => {
        const entry = Mistakes.record('gram.articles', { given: 'x'.repeat(1000) });
        expect(entry.given).toHaveLength(Mistakes.MAX_TEXT_CHARS);
    });

    it('drops empty context fields rather than storing empty strings', () => {
        const entry = Mistakes.record('gram.articles', { given: '   ', item: '' });
        expect(entry.given).toBeUndefined();
        expect(entry.item).toBeUndefined();
    });

    it('REJECTS an unknown category instead of coercing it', () => {
        // A typo that silently logged as "uncategorised" would quietly corrupt
        // the one thing this module exists to produce.
        expect(Mistakes.record('gram.artcles')).toBeNull();
        expect(Mistakes.record(null)).toBeNull();
        expect(Mistakes.record('')).toBeNull();
        expect(Mistakes.stats().entries).toBe(0);
    });

    it('accepts the uncategorised bucket when the caller genuinely does not know', () => {
        expect(Mistakes.record('general.uncategorised')).not.toBeNull();
        expect(Mistakes.stats().entries).toBe(1);
    });

    it('keeps entries ordered by time even when backfilled out of order', () => {
        Mistakes.record('gram.articles', { at: daysAgo(1) });
        Mistakes.record('prn.v-w', { at: daysAgo(10) });
        Mistakes.record('prn.th', { at: daysAgo(5) });
        expect(Mistakes.entries().map(e => e.category))
            .toEqual(['prn.v-w', 'prn.th', 'gram.articles']);
    });

    it('recordMany logs several categories against one shared context', () => {
        const out = Mistakes.recordMany(
            ['gram.articles', 'gram.copula', 'nope.not.a.category'],
            { source: 'placementTest' }
        );
        expect(out).toHaveLength(2);                 // the unknown one is dropped
        expect(out.every(e => e.source === 'placementTest')).toBe(true);
    });

    it('returns a copy, so a caller cannot rewrite what was logged', () => {
        const entry = Mistakes.record('gram.articles');
        entry.category = 'prn.v-w';
        expect(Mistakes.entries()[0].category).toBe('gram.articles');
    });
});

describe('topCategories — the FR-SRS-3 view', () => {
    it('defaults to five categories over thirty days', () => {
        expect(Mistakes.TOP_N).toBe(5);
        expect(Mistakes.WINDOW_DAYS).toBe(30);

        ['gram.articles', 'gram.copula', 'prn.v-w', 'prn.th',
         'gram.present-perfect', 'gram.word-order', 'lsn.detail'].forEach((cat, i) => {
            seed(cat, [1, 2, 3].map(d => d + i * 0.01));
        });
        expect(Mistakes.topCategories()).toHaveLength(5);
        expect(Mistakes.topCategories()[0].windowDays).toBe(30);
    });

    it('reports the honest raw count, not the weighted score', () => {
        seed('gram.articles', [1, 4, 8, 15, 22, 28]);
        const row = Mistakes.topCategories()[0];
        expect(row.count).toBe(6);                    // what the learner reads
        expect(row.score).toBeLessThan(6);            // what the ranking uses
        expect(Number.isInteger(row.count)).toBe(true);
    });

    it('carries the label, explanation and example through to the caller', () => {
        seed('gram.stative-progressive', [1, 2]);
        const row = Mistakes.topCategories()[0];
        expect(row.label).toBe('"-ing" on a verb that does not take it');
        expect(row.explanation).toContain('know, have, understand');
        expect(row.example).toContain('I am having a doubt');
        expect(row.code).toBe('T-G3');
    });

    it('offers a drill for a drillable category and says so for the rest', () => {
        seed('prn.v-w', [1, 2]);
        const row = Mistakes.topCategories()[0];
        expect(row.drillable).toBe(true);
        expect(row.drill.srsKey).toBe('phon:v-w');
    });

    it('respects an explicit limit', () => {
        ['gram.articles', 'gram.copula', 'prn.v-w'].forEach((c, i) => seed(c, [1 + i]));
        expect(Mistakes.topCategories({ limit: 2 })).toHaveLength(2);
        expect(Mistakes.topCategories({ limit: 0 })).toHaveLength(0);
        expect(Mistakes.topCategories({ limit: 99 })).toHaveLength(3);
        expect(Mistakes.topCategories({ limit: 'five' })).toHaveLength(3);
    });

    it('reports share of the counted total, and days since last seen', () => {
        seed('gram.articles', [1, 2, 3]);
        seed('prn.v-w', [4]);
        const rows = Mistakes.topCategories();
        expect(rows[0].share).toBeCloseTo(0.75, 5);
        expect(rows[1].share).toBeCloseTo(0.25, 5);
        expect(rows[0].daysSinceLast).toBe(1);
        expect(rows[1].daysSinceLast).toBe(4);
    });

    it('returns nothing at all on an empty log', () => {
        expect(Mistakes.topCategories()).toEqual([]);
    });
});

describe('the window boundary', () => {
    it('includes an entry exactly at the edge and excludes one past it', () => {
        Mistakes.record('gram.articles', { at: NOW - 30 * DAY_MS });
        Mistakes.record('prn.v-w', { at: NOW - 30 * DAY_MS - 1 });
        const counts = Mistakes.countsByCategory();
        expect(counts['gram.articles'].count).toBe(1);
        expect(counts['prn.v-w']).toBeUndefined();
        expect(Mistakes.topCategories().map(r => r.id)).toEqual(['gram.articles']);
    });

    it('ignores an entry from the future rather than letting it dominate', () => {
        // A device clock that jumped forward must not put a mistake at the top
        // of the list for a month.
        Mistakes.record('prn.v-w', { at: NOW + 1 });
        expect(Mistakes.stats().entries).toBe(1);
        expect(Mistakes.topCategories()).toEqual([]);
    });

    it('keeps the entry in storage even when it is outside the window', () => {
        // Outside the window is not outside the log: a wider query still finds it.
        Mistakes.record('gram.articles', { at: daysAgo(60) });
        expect(Mistakes.topCategories()).toEqual([]);
        expect(Mistakes.topCategories({ windowDays: 90 })).toHaveLength(1);
        expect(Mistakes.stats().entries).toBe(1);
    });

    it('accepts an explicit window, so "and three months ago?" is answerable', () => {
        seed('gram.articles', [62, 66, 70, 74, 78]);   // fixed two months ago
        seed('prn.th', [2, 5, 9]);                     // live now
        expect(Mistakes.topCategories().map(r => r.id)).toEqual(['prn.th']);
        expect(Mistakes.topCategories({ windowDays: 120, limit: 99 }).map(r => r.id).sort())
            .toEqual(['gram.articles', 'prn.th']);
    });
});

describe('decay — a fixed problem stops being ranked first', () => {
    it('weights a recent occurrence above an old one', () => {
        Mistakes.record('gram.articles', { at: NOW });
        const fresh = Mistakes.topCategories()[0].score;

        Mistakes.entryList = [];
        Mistakes.record('gram.articles', { at: daysAgo(Mistakes.HALF_LIFE_DAYS) });
        const halfLifeOld = Mistakes.topCategories()[0].score;

        expect(fresh).toBeCloseTo(1, 5);
        expect(halfLifeOld).toBeCloseTo(0.5, 5);
    });

    it('ranks five recent occurrences above ten that stopped three weeks ago', () => {
        // This is the whole point of the decay: word stress was a real problem
        // and the learner fixed it, so it must not still head the list.
        seed('prn.word-stress', [22, 23, 24, 25, 26, 27, 28, 29, 29, 29]);
        seed('gram.articles', [1, 2, 3, 5, 8]);

        const ranked = Mistakes.topCategories().map(r => r.id);
        expect(ranked[0]).toBe('gram.articles');
        expect(ranked[1]).toBe('prn.word-stress');

        // ...and the counts are unchanged: the ordering moved, the truth did not.
        const rows = Mistakes.topCategories();
        expect(rows.find(r => r.id === 'prn.word-stress').count).toBe(10);
        expect(rows.find(r => r.id === 'gram.articles').count).toBe(5);
    });

    it('with decay disabled the raw count wins, which is what decay exists to fix', () => {
        seed('prn.word-stress', [22, 23, 24, 25, 26, 27, 28, 29, 29, 29]);
        seed('gram.articles', [1, 2, 3, 5, 8]);
        const ranked = Mistakes.topCategories({ halfLifeDays: Infinity }).map(r => r.id);
        expect(ranked[0]).toBe('prn.word-stress');
        expect(Mistakes.topCategories({ halfLifeDays: Infinity })[0].score).toBe(10);
    });
});

describe('trend', () => {
    it('calls a falling rate improving and a rising one worsening', () => {
        seed('gram.articles', [26, 24, 22, 20, 18, 16]);   // all in the older half
        seed('prn.th', [12, 9, 6, 3]);                     // all in the recent half
        const rows = Mistakes.topCategories();
        expect(rows.find(r => r.id === 'gram.articles').trend).toBe('improving');
        expect(rows.find(r => r.id === 'prn.th').trend).toBe('worsening');
    });

    it('refuses to name a direction on thin evidence', () => {
        expect(Mistakes.MIN_TREND_EVIDENCE).toBeGreaterThan(1);
        seed('gram.articles', [2, 20]);   // two occurrences is not a trend
        expect(Mistakes.topCategories()[0].trend).toBe('unclear');
        expect(Mistakes.topCategories()[0].count).toBe(2);   // still counted
    });

    it('compares per active day, so practising less is not "improving"', () => {
        // Older half: 6 mistakes over 6 practice days = 1.0/day.
        // Recent half: 3 mistakes over 3 practice days = 1.0/day. Same rate,
        // half the volume — a plain count would have said "improving".
        seed('gram.articles', [26, 24, 22, 20, 18, 16]);
        seed('gram.articles', [6, 4, 2]);
        const row = Mistakes.topCategories()[0];
        expect(row.trend).toBe('steady');
        expect(row.trendBasis.earlierPerActiveDay).toBeCloseTo(1, 5);
        expect(row.trendBasis.recentPerActiveDay).toBeCloseTo(1, 5);
    });

    it('is unclear when one half of the window has no practice in it at all', () => {
        seed('gram.articles', [2, 3, 4, 5, 6]);   // nothing older than 15 days
        const row = Mistakes.topCategories()[0];
        expect(row.trend).toBe('unclear');
        expect(row.trendBasis.earlierActiveDays).toBe(0);
    });

    it('publishes what it compared, so the UI need not assert a cause', () => {
        seed('gram.articles', [26, 24, 22, 20]);
        seed('gram.articles', [6, 4]);
        const basis = Mistakes.topCategories()[0].trendBasis;
        expect(basis).toMatchObject({
            earlierCount: 4, recentCount: 2,
            earlierActiveDays: 4, recentActiveDays: 2
        });
        expect(basis.splitAt).toBe(NOW - 15 * DAY_MS);
    });
});

describe('evidence — recogniser noise must not become a diagnosis', () => {
    // BR-3 (never overstate), FR-SRS-5 (self-report never certifies),
    // FR-PRN-5 (production is never auto-scored), methodology principle 3.
    const flood = () => {
        for (let i = 0; i < 40; i++) {
            Mistakes.record('prn.v-w', {
                at: daysAgo(1 + (i % 25)),
                evidence: Mistakes.EVIDENCE.RECOGNISER
            });
        }
    };

    it('keeps a recogniser-only category out of the ranked list entirely', () => {
        flood();
        seed('gram.articles', [1, 2, 3]);
        expect(Mistakes.topCategories().map(r => r.id)).toEqual(['gram.articles']);
    });

    it('still stores every one of them, and says so honestly', () => {
        flood();
        const s = Mistakes.stats();
        expect(s.entries).toBe(40);
        expect(s.graded).toBe(0);
        expect(s.unverified).toBe(40);
        expect(Mistakes.countsByCategory()['prn.v-w'])
            .toEqual({ count: 0, unverifiedCount: 40, total: 40 });
    });

    it('reports weak evidence beside a graded count, never folded into it', () => {
        flood();
        seed('prn.v-w', [1, 2, 3]);   // three graded misses as well
        const row = Mistakes.topCategories()[0];
        expect(row.id).toBe('prn.v-w');
        expect(row.count).toBe(3);              // the diagnosis
        expect(row.unverifiedCount).toBe(40);   // the context, kept separate
    });

    it('treats a self-reported outcome as weak evidence too (FR-SRS-5)', () => {
        seed('prn.rhythm', [1, 2, 3, 4, 5, 6], { evidence: Mistakes.EVIDENCE.SELF });
        seed('gram.articles', [10]);
        expect(Mistakes.topCategories().map(r => r.id)).toEqual(['gram.articles']);
        expect(Mistakes.countsByCategory()['prn.rhythm'].unverifiedCount).toBe(6);
    });

    it('can be asked for the fuller picture explicitly, and then labels it', () => {
        flood();
        seed('gram.articles', [1, 2, 3]);
        const rows = Mistakes.topCategories({ countUnverified: true });
        expect(rows[0].id).toBe('prn.v-w');
        expect(rows[0].count).toBe(40);
        expect(rows[0].unverifiedCount).toBe(40);   // all of it is unverified
    });

    it('defaults an unrecognised evidence value to graded rather than dropping it', () => {
        // A caller that passes nonsense has still told us the learner got
        // something wrong; losing the mistake would be worse than over-trusting it.
        const entry = Mistakes.record('gram.articles', { evidence: 'vibes' });
        expect(entry.evidence).toBe(Mistakes.EVIDENCE.GRADED);
    });
});

describe('non-reportable categories', () => {
    it('never rank, however many there are', () => {
        for (let i = 0; i < 30; i++) Mistakes.record('general.uncategorised', { at: daysAgo(1 + (i % 20)) });
        for (let i = 0; i < 30; i++) Mistakes.record('prn.recogniser-missed', { at: daysAgo(1 + (i % 20)) });
        seed('gram.articles', [4]);
        expect(Mistakes.topCategories().map(r => r.id)).toEqual(['gram.articles']);
    });

    it('are counted, so the totals stay honest', () => {
        for (let i = 0; i < 14; i++) Mistakes.record('general.uncategorised', { at: daysAgo(2) });
        expect(Mistakes.stats().entries).toBe(14);
        expect(Mistakes.countsByCategory()['general.uncategorised'].count).toBe(14);
    });

    it('surface only when asked for, for a diagnostics view', () => {
        for (let i = 0; i < 14; i++) Mistakes.record('general.uncategorised', { at: daysAgo(1 + i) });
        expect(Mistakes.topCategories({ includeNonReportable: true })[0].id)
            .toBe('general.uncategorised');
    });

    it('include the deliberately out-of-scope retroflex row (T-P12)', () => {
        // REQUIREMENTS.md §3.1 excludes accent features on purpose. The row
        // exists so the exclusion is data; it must never reach a learner's list.
        expect(Mistakes.getCategory('prn.retroflex').reportable).toBe(false);
        seed('prn.retroflex', [1, 2, 3, 4, 5, 6]);
        expect(Mistakes.topCategories()).toEqual([]);
    });
});

describe('retention — the log cannot grow without bound', () => {
    it('drops entries older than the retention period on the next write', () => {
        Mistakes.record('gram.articles', { at: daysAgo(Mistakes.RETENTION_DAYS + 1) });
        Mistakes.record('gram.articles', { at: daysAgo(Mistakes.RETENTION_DAYS - 1) });
        expect(Mistakes.stats().entries).toBe(1);
        expect(Mistakes.entries()[0].at).toBe(daysAgo(Mistakes.RETENTION_DAYS - 1));
    });

    it('keeps enough history to answer "did I fix it?" — several windows deep', () => {
        expect(Mistakes.RETENTION_DAYS).toBeGreaterThanOrEqual(2 * Mistakes.WINDOW_DAYS);
    });

    it('caps the entry count, dropping the oldest first', () => {
        const cap = Mistakes.MAX_ENTRIES;
        for (let i = 0; i < cap + 50; i++) {
            Mistakes.record('gram.articles', { at: daysAgo(60 - i * (60 / (cap + 50))) });
        }
        expect(Mistakes.stats().entries).toBe(cap);
        // The survivors are the newest ones.
        const entries = Mistakes.entries();
        expect(entries[entries.length - 1].at).toBeGreaterThan(entries[0].at);
        expect(Mistakes.stats().capacityUsed).toBe(1);
    });

    it('prune() is idempotent', () => {
        seed('gram.articles', [1, 50, 200]);
        const after = Mistakes.stats().entries;
        expect(Mistakes.prune()).toBe(0);
        expect(Mistakes.stats().entries).toBe(after);
    });

    it('stays inside a sane byte budget when full', () => {
        for (let i = 0; i < Mistakes.MAX_ENTRIES; i++) {
            Mistakes.record('gram.articles', { at: daysAgo(1), item: 'sentences:' + i });
        }
        // ~100 bytes an entry. Asserted loosely: the contract is "small next to
        // srsData in a 5MB quota", not an exact size.
        expect(Mistakes.stats().bytes).toBeLessThan(300 * 1024);
    });
});

describe('history', () => {
    it('returns one category, newest first, with its context', () => {
        Mistakes.record('gram.articles', { at: daysAgo(3), given: 'I went to shop' });
        Mistakes.record('gram.articles', { at: daysAgo(1), given: 'He is engineer' });
        Mistakes.record('prn.v-w', { at: daysAgo(2) });

        const h = Mistakes.history('gram.articles');
        expect(h).toHaveLength(2);
        expect(h[0].given).toBe('He is engineer');
        expect(h[1].given).toBe('I went to shop');
    });

    it('respects the window and an explicit limit', () => {
        seed('gram.articles', [1, 2, 3, 40]);
        expect(Mistakes.history('gram.articles')).toHaveLength(3);
        expect(Mistakes.history('gram.articles', { limit: 2 })).toHaveLength(2);
        expect(Mistakes.history('gram.articles', { windowDays: 90 })).toHaveLength(4);
    });

    it('returns copies, so callers cannot corrupt the log', () => {
        Mistakes.record('gram.articles', { given: 'original' });
        Mistakes.history('gram.articles')[0].given = 'MUTATED';
        expect(Mistakes.entries()[0].given).toBe('original');
    });
});

describe('stats', () => {
    it('splits graded from unverified and reports the span', () => {
        seed('gram.articles', [1, 5]);
        seed('prn.v-w', [3], { evidence: Mistakes.EVIDENCE.RECOGNISER });
        const s = Mistakes.stats();
        expect(s).toMatchObject({
            entries: 3, graded: 2, unverified: 1,
            categoriesSeen: 2, spanDays: 4
        });
        expect(s.categoriesRegistered).toBe(Mistakes.categoryIds().length);
    });

    it('is safe on an empty log', () => {
        const s = Mistakes.stats();
        expect(s.entries).toBe(0);
        expect(s.oldest).toBeNull();
        expect(s.spanDays).toBe(0);
    });
});

describe('persistence', () => {
    it('round-trips through its own localStorage key', () => {
        Mistakes.record('gram.articles', { given: 'I went to shop' });
        Mistakes.entryList = [];
        Mistakes.load();
        expect(Mistakes.stats().entries).toBe(1);
        expect(Mistakes.entries()[0].given).toBe('I went to shop');
        expect(localStorage.getItem('mistakeLog')).toBeTruthy();
    });

    it('never touches learningProgress or srsData', () => {
        // Both are owned by other modules and are being migrated separately.
        localStorage.setItem('learningProgress', '{"kept":true}');
        localStorage.setItem('srsData', '{"kept":true}');
        Mistakes.record('gram.articles');
        Mistakes.reset();
        expect(localStorage.getItem('learningProgress')).toBe('{"kept":true}');
        expect(localStorage.getItem('srsData')).toBe('{"kept":true}');
    });

    it('writes a version field, so the shape can be migrated later', () => {
        Mistakes.record('gram.articles');
        expect(JSON.parse(localStorage.getItem('mistakeLog')).version).toBe(1);
    });

    it('starts clean on corrupt stored JSON rather than throwing', () => {
        localStorage.setItem('mistakeLog', '{not json');
        expect(() => Mistakes.load()).not.toThrow();
        expect(Mistakes.entryList).toEqual([]);
    });

    it('tolerates a bare array, in case an older shape ever shipped', () => {
        localStorage.setItem('mistakeLog', JSON.stringify([
            { category: 'gram.articles', at: NOW, evidence: 'graded' }
        ]));
        Mistakes.load();
        expect(Mistakes.stats().entries).toBe(1);
    });

    it('drops unusable entries on load instead of ranking garbage', () => {
        localStorage.setItem('mistakeLog', JSON.stringify({
            version: 1,
            entries: [
                { category: 'gram.articles', at: NOW },   // kept
                { category: '', at: NOW },                // no category
                { at: NOW },                              // no category
                { category: 'prn.v-w' },                  // no timestamp
                null
            ]
        }));
        Mistakes.load();
        expect(Mistakes.stats().entries).toBe(1);
        expect(Mistakes.entries()[0].evidence).toBe(Mistakes.EVIDENCE.GRADED);
    });

    it('keeps an entry whose category is no longer registered, but does not rank it', () => {
        // A content change must not destroy history.
        localStorage.setItem('mistakeLog', JSON.stringify({
            version: 1,
            entries: [{ category: 'gram.retired', at: daysAgo(1), evidence: 'graded' }]
        }));
        Mistakes.load();
        expect(Mistakes.stats().entries).toBe(1);
        expect(Mistakes.topCategories()).toEqual([]);
    });

    it('reset clears memory and storage', () => {
        Mistakes.record('gram.articles');
        Mistakes.reset();
        expect(Mistakes.entryList).toEqual([]);
        expect(localStorage.getItem('mistakeLog')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// US-134 — the IIFE global object
// ---------------------------------------------------------------------------
describe('module globals under CommonJS (US-134)', () => {
    it('publishes Mistakes as a global, not only as module.exports', () => {
        expect(global.Mistakes).toBeDefined();
        expect(global.Mistakes).toBe(require('../../js/core/mistakes.js'));
    });

    it('sees an AppErrorHandler installed on the global object', () => {
        // The load-bearing consequence of the defect this replaced. save() must
        // report a full-quota write through global.AppErrorHandler (NFR-10:
        // "quota exceeded must not be silent"). When the IIFE was handed
        // `module.exports` instead of the real global, that lookup could never
        // resolve — so a test that installed a spy here would have passed while
        // exercising a branch that was structurally unreachable.
        const logged = [];
        const previous = global.AppErrorHandler;
        // NOTE: the patch goes on Storage.prototype, not on the localStorage
        // instance. In jsdom an assignment to `localStorage.setItem` does not
        // shadow the prototype method the module's call resolves to, so an
        // instance patch never throws and this test passed while asserting
        // nothing. __tests__/unit/portability.test.js hit the same thing.
        const realSetItem = Storage.prototype.setItem;
        global.AppErrorHandler = { logError: (e, ctx) => logged.push(ctx) };
        try {
            Mistakes.entryList = [];
            Mistakes.record('gram.articles');
            Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
            expect(Mistakes.save()).toBe(false);
            expect(logged).toContain('Mistakes save');
        } finally {
            Storage.prototype.setItem = realSetItem;
            if (previous === undefined) delete global.AppErrorHandler;
            else global.AppErrorHandler = previous;
        }
    });

    it('keeps the entry list intact when storage is unavailable, not merely full', () => {
        // The same path, checked for its data promise rather than its logging:
        // the trimmed quarter goes back, because the entries are not why the
        // write failed.
        const realSetItem = Storage.prototype.setItem;   // prototype, not instance — see above
        try {
            Mistakes.entryList = [];
            seed('gram.articles', [1, 2, 3, 4]);
            const before = Mistakes.entryList.length;
            Storage.prototype.setItem = () => { throw new Error('nope'); };
            expect(Mistakes.save()).toBe(false);
            expect(Mistakes.entryList.length).toBe(before);
        } finally {
            Storage.prototype.setItem = realSetItem;
        }
    });

    it('passes globalThis, not `this`, as the IIFE global — checked in the source', () => {
        // A source check on purpose: jest.config.js sets testEnvironment 'jsdom',
        // where `window` IS the test global object, so the `: this` branch is
        // never taken and no behavioural assertion in this file can detect the
        // defect. It bites plain `node` and `@jest-environment node` only. See
        // the matching test in srs.test.js.
        const fs = require('fs');
        const path = require('path');
        const src = fs.readFileSync(
            path.join(__dirname, '../../js/core/mistakes.js'), 'utf8');
        expect(src).toMatch(/\?\s*window\s*:\s*globalThis\s*\)/);
        expect(src).not.toMatch(/\?\s*window\s*:\s*this\s*\)/);
    });
});
