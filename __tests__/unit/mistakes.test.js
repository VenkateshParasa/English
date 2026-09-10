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
 *      error is fixed by two items (US-164, /θ/ and /ð/ under T-P6).
 *
 * Where a test pins a *policy number* rather than a behaviour it reads the
 * constant off the module, so retuning the policy does not look like a
 * regression. Where the number itself is the contract (30 days, top 5, from
 * FR-SRS-3) it is written out literally.
 *
 * The US-165 block requires the two grammar content files, so this suite is the
 * one place where the taxonomy and the content that references it are checked
 * against each other rather than against a transcription of each other.
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
        const realSetItem = localStorage.setItem;
        global.AppErrorHandler = { logError: (e, ctx) => logged.push(ctx) };
        try {
            Mistakes.entryList = [];
            Mistakes.record('gram.articles');
            localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
            expect(Mistakes.save()).toBe(false);
            expect(logged).toContain('Mistakes save');
        } finally {
            localStorage.setItem = realSetItem;
            if (previous === undefined) delete global.AppErrorHandler;
            else global.AppErrorHandler = previous;
        }
    });

    it('keeps the entry list intact when storage is unavailable, not merely full', () => {
        // The same path, checked for its data promise rather than its logging:
        // the trimmed quarter goes back, because the entries are not why the
        // write failed.
        const realSetItem = localStorage.setItem;
        try {
            Mistakes.entryList = [];
            seed('gram.articles', [1, 2, 3, 4]);
            const before = Mistakes.entryList.length;
            localStorage.setItem = () => { throw new Error('nope'); };
            expect(Mistakes.save()).toBe(false);
            expect(Mistakes.entryList.length).toBe(before);
        } finally {
            localStorage.setItem = realSetItem;
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
