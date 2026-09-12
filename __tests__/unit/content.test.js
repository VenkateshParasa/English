/**
 * Content validation — US-811 / NFR-13 / FR-CNT-1
 * =============================================================================
 * This suite contains NO validation logic. Every rule lives in
 * `tools/validate-content.js`, which is also what CI runs
 * (`node tools/validate-content.js`, no jest and no npm install needed). This
 * file only turns that one implementation's findings into assertions, so the
 * local suite and the CI job can never disagree about what "valid" means —
 * which is the whole reason the throwaway validator kept getting rewritten.
 *
 * Three groups of tests:
 *
 *  1. SANITY. A validator that silently discovers nothing passes everything.
 *     These assert the corpus was actually loaded, so the rest cannot be
 *     vacuously green.
 *  2. THE LIVE CORPUS, sliced both ways — one test per discovered file, one test
 *     per check — because "which file is broken" and "which rule is broken" are
 *     different questions and a failure should answer both.
 *  3. SELF-TESTS. Fixtures built IN MEMORY (nothing is written to `data/`, which
 *     this suite does not own) that prove each check actually fires. A check
 *     nobody has seen fail is a check nobody should trust.
 */

const validator = require('../../tools/validate-content.js');

// Loaded once: running the corpus through `vm` a second time per test would be
// slow and would re-run every content file's self-registration.
const result = validator.validate();
const corpus = result.corpus;

const FIXTURE_FILE = 'data/grammar/__fixture__.js';

/**
 * The real corpus with ONE point swapped for a mutated copy, attributed to a
 * file that does not exist. Deep-cloned via JSON because content is plain data.
 *
 * The other points are kept, on purpose: the schema check derives its expected
 * shape leave-one-out from the rest of the corpus, so a fixture in isolation
 * would have nothing to be compared against and the check would be vacuous.
 * The mutated point REPLACES the original rather than being appended, so its id
 * stays unique and the duplicate-id check does not fire on the harness itself.
 */
function fixtureCorpus(mutate, overrides) {
    const clone = JSON.parse(JSON.stringify(corpus.points[0].point));
    mutate(clone);
    const entry = { file: FIXTURE_FILE, tierKey: clone.tier, point: clone, declaredAs: 'GRAMMAR_FIXTURE' };
    return Object.assign({}, corpus, {
        // Empty by default so the wiring and placeholder checks, which read the
        // filesystem rather than the loaded objects, stay out of the way.
        files: Object.assign({}, corpus.files, { all: [], other: [] }),
        points: [entry].concat(corpus.points.slice(1)),
        registrations: [{ file: FIXTURE_FILE, declaredAs: 'GRAMMAR_FIXTURE', point: clone, landedIn: clone.tier }],
        pronunciation: [],
        parseErrors: [],
        consoleOutput: []
    }, overrides || {});
}

/** Errors the fixture file itself produced, ignoring the real corpus's. */
function fixtureErrors(mutate, overrides) {
    const r = validator.validate({ corpus: fixtureCorpus(mutate, overrides) });
    return r.errors.filter(f => f.file === FIXTURE_FILE);
}

const checksFailed = errs => Array.from(new Set(errs.map(e => e.check)));

// ---------------------------------------------------------------------------
describe('content validator sanity', () => {
    it('discovered content files', () => {
        expect(result.summary.filesDiscovered).toBeGreaterThan(2);
        expect(corpus.files.grammarRegistry).toBe('data/grammar.js');
        expect(corpus.files.grammar.length).toBeGreaterThan(0);
        expect(corpus.files.pronunciation.length).toBeGreaterThan(0);
    });

    it('read the lexical globals out of the vm context', () => {
        // The specific mistake this guards: `grammarLessons` is a top-level
        // `const` in a classic script, so it is NOT a property of the context
        // object and must be read with an expression evaluated inside it.
        expect(corpus.ctx.grammarLessons).toBeUndefined();
        expect(validator.lexical(corpus.ctx, 'grammarLessons')).toBeTruthy();
        expect(Object.keys(corpus.grammarLessons)).toContain('foundation');
    });

    it('loaded real grammar and pronunciation content', () => {
        expect(result.summary.grammarPoints).toBeGreaterThanOrEqual(10);
        expect(result.summary.practiceItems).toBe(result.summary.grammarPoints * 6);
        expect(result.summary.pairSets).toBeGreaterThanOrEqual(8);
        expect(result.summary.noticingItems).toBeGreaterThanOrEqual(15);
        expect(result.summary.categoryRefs).toBeGreaterThan(100);
    });

    it('no content file failed to parse or threw while loading', () => {
        expect(corpus.parseErrors).toEqual([]);
    });

    it('derives the expected shape from the corpus, not from a literal here', () => {
        const instances = validator.collectShapes(corpus.points);
        const optional = { practice: validator.declaredOptional(corpus.sources['data/grammar.js']) };
        // Read out of data/grammar.js's own schema comment.
        expect(optional.practice).toEqual(expect.arrayContaining(['spoken', 'rendersAs', 'alsoNotice']));
        const exp = validator.expectedShape(instances, 'feedback', corpus.points[0].file, optional);
        expect(exp.vacuous).toBeUndefined();
        expect(exp.required).toEqual(expect.arrayContaining(
            ['forAnswer', 'reason', 'contrast', 'retryCue', 'grammaticalButDifferent']));
    });
});

// ---------------------------------------------------------------------------
describe('the live corpus, by file', () => {
    const files = Array.from(new Set(corpus.files.all.concat(Object.keys(result.byFile)))).sort();

    it.each(files)('%s passes every content check', file => {
        const errs = (result.byFile[file] || []).filter(f => f.severity === 'error');
        expect(errs.map(e => '[' + e.check + '] ' + (e.where || '') + ': ' + e.message)).toEqual([]);
    });
});

describe('the live corpus, by check', () => {
    it.each(Object.keys(validator.CHECKS))('%s holds across the whole corpus', check => {
        const errs = result.errors.filter(f => f.check === check);
        expect(errs.map(e => e.file + ' -> ' + (e.where || '') + ': ' + e.message)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
describe('the validator catches each class of defect', () => {
    it('the unmutated fixture is clean, so the harness manufactures nothing', () => {
        expect(fixtureErrors(() => {})).toEqual([]);
    });

    it('catches a missing top-level field', () => {
        const errs = fixtureErrors(p => { delete p.rule; });
        expect(checksFailed(errs)).toContain('schema');
        expect(errs.some(e => /missing `rule`/.test(e.message))).toBe(true);
    });

    it('catches a missing nested field', () => {
        const errs = fixtureErrors(p => { delete p.practice[0].feedback[0].retryCue; });
        expect(checksFailed(errs)).toContain('schema');
        expect(checksFailed(errs)).toContain('feedback');
    });

    it('catches a renamed field, as both a missing key and a corpus-novel one', () => {
        const c = fixtureCorpus(p => { p.rulePhrase = p.rule; delete p.rule; });
        const r = validator.validate({ corpus: c });
        const mine = r.findings.filter(f => f.file === FIXTURE_FILE);
        expect(mine.filter(f => f.severity === 'error').some(f => /missing `rule`/.test(f.message))).toBe(true);
        expect(mine.some(f => /`rulePhrase`.*no point in any other file/s.test(f.message))).toBe(true);
    });

    it('catches an accepted answer that is not among its options (US-166)', () => {
        const errs = fixtureErrors(p => {
            p.practice[0].accept.push({ answer: 'not-on-any-button', means: 'unreachable' });
            p.practice[0].showDifferenceOnCorrect = true;
        });
        expect(checksFailed(errs)).toEqual(['accept-in-options']);
        expect(errs[0].message).toMatch(/not among its options/);
    });

    it('catches showDifferenceOnCorrect set on a single-answer item (US-188)', () => {
        const single = corpus.points
            .map(x => (x.point.practice || []).find(i => (i.accept || []).length === 1))
            .filter(Boolean)[0];
        expect(single).toBeTruthy();   // the corpus does contain such an item
        const errs = fixtureErrors(p => {
            const item = p.practice.find(i => (i.accept || []).length === 1);
            item.showDifferenceOnCorrect = true;
        });
        expect(checksFailed(errs)).toEqual(['show-difference']);
    });

    it('catches showDifferenceOnCorrect absent on a two-answer item (US-188)', () => {
        const errs = fixtureErrors(p => {
            const item = p.practice.find(i => (i.accept || []).length > 1) || p.practice[0];
            item.accept.push({ answer: item.options[1], means: 'a second right answer' });
            delete item.showDifferenceOnCorrect;
        });
        expect(checksFailed(errs)).toContain('show-difference');
    });

    it('catches a wrong option with no feedback entry', () => {
        const errs = fixtureErrors(p => { p.practice[0].feedback.shift(); });
        expect(checksFailed(errs)).toContain('feedback');
        expect(errs.some(e => /has no `feedback` entry/.test(e.message))).toBe(true);
    });

    it('catches a feedback entry that targets an accepted answer', () => {
        const errs = fixtureErrors(p => {
            p.practice[0].feedback[0].forAnswer = p.practice[0].accept[0].answer;
        });
        expect(checksFailed(errs)).toContain('feedback');
        expect(errs.some(e => /which the item ACCEPTS/.test(e.message))).toBe(true);
    });

    it('catches a one-sentence contrast in feedback', () => {
        const errs = fixtureErrors(p => { p.practice[0].feedback[0].contrast = ['only one']; });
        expect(errs.some(e => e.check === 'feedback' && /exactly two non-empty strings/.test(e.message))).toBe(true);
    });

    it('catches an invented logAs id', () => {
        const errs = fixtureErrors(p => { p.practice[0].feedback[0].logAs = 'gram.no-such-category'; });
        expect(checksFailed(errs)).toEqual(['categories']);
        expect(errs[0].message).toMatch(/not registered in js\/core\/mistakes\.js/);
    });

    it('catches an invented lesson-level mistakeCategory', () => {
        const errs = fixtureErrors(p => { p.mistakeCategory = 'gram.invented'; });
        expect(checksFailed(errs)).toContain('categories');
    });

    it('catches a field SRS.auditProjection would silently drop', () => {
        const errs = fixtureErrors(p => { p.pronunciationHint = 'a field no projector lists'; });
        expect(checksFailed(errs)).toContain('srs-projection');
        expect(errs.some(e => /dropped from every review record/.test(e.message))).toBe(true);
    });

    it('catches a mode app.js cannot render', () => {
        const errs = fixtureErrors(p => { p.practice[0].mode = 'order'; });
        expect(checksFailed(errs)).toEqual(['mode-gap']);
    });

    it('catches wrong cardinality', () => {
        const tooFew = fixtureErrors(p => { p.practice.pop(); });
        expect(checksFailed(tooFew)).toContain('cardinality');
        const tooMany = fixtureErrors(p => { p.contrast.push(p.contrast[0]); });
        expect(checksFailed(tooMany)).toContain('cardinality');
    });

    it('catches a dangling review.itemId and a dangling prerequisite', () => {
        expect(checksFailed(fixtureErrors(p => { p.review.itemIds = ['no-such-item']; })))
            .toContain('references');
        expect(checksFailed(fixtureErrors(p => { p.prerequisites = ['no-such-point']; })))
            .toContain('references');
    });

    it('catches an srs triple that disagrees with the id', () => {
        expect(checksFailed(fixtureErrors(p => { p.srsKey = 'gram:prettier-name'; })))
            .toContain('references');
    });

    it('catches a point whose tier does not match where it registered', () => {
        const c = fixtureCorpus(() => {});
        c.registrations = [Object.assign({}, c.registrations[0], { landedIn: 'confident' })];
        const errs = validator.validate({ corpus: c }).errors.filter(f => f.file === FIXTURE_FILE);
        expect(checksFailed(errs)).toContain('registration');
    });

    it('catches a point that never reached grammarLessons at all', () => {
        const c = fixtureCorpus(() => {});
        c.registrations = [Object.assign({}, c.registrations[0], { landedIn: null })];
        const errs = validator.validate({ corpus: c }).errors.filter(f => f.file === FIXTURE_FILE);
        expect(errs.some(e => /never reached grammarLessons/.test(e.message))).toBe(true);
    });

    it('catches a tier that is not a js/core/levels.js id', () => {
        const errs = fixtureErrors(p => { p.tier = 'intermediate'; });   // a legacy alias, not an id
        expect(checksFailed(errs)).toContain('registration');
    });

    it('catches a literal PLACEHOLDER left in a content file', () => {
        const c = fixtureCorpus(() => {}, {
            files: Object.assign({}, corpus.files, { all: [FIXTURE_FILE], other: [] })
        });
        c.sources = Object.assign({}, corpus.sources, {
            [FIXTURE_FILE]: 'const X = {\n    rule: "PLACEHOLDER — write this",\n    todo: "lowercase prose is fine"\n};\n'
        });
        const errs = validator.validate({ corpus: c }).errors.filter(f => f.file === FIXTURE_FILE);
        expect(errs.some(e => e.check === 'placeholders' && /PLACEHOLDER/.test(e.message))).toBe(true);
        // Case matters: "todo" inside an English sentence is not a marker.
        expect(errs.filter(e => e.check === 'placeholders')).toHaveLength(1);
    });

    it('catches a data file with no <script> tag and no precache entry', () => {
        const c = fixtureCorpus(() => {}, {
            files: Object.assign({}, corpus.files, { all: ['data/grammar/__never-wired__.js'], other: [] })
        });
        const errs = validator.validate({ corpus: c }).errors
            .filter(f => f.file === 'data/grammar/__never-wired__.js');
        expect(checksFailed(errs)).toEqual(['wiring']);
        expect(errs).toHaveLength(2);   // index.html and the service worker
    });

    it('catches a parse error rather than crashing', () => {
        const c = fixtureCorpus(() => {}, {
            parseErrors: [{ file: FIXTURE_FILE, message: 'Unexpected token }' }]
        });
        const errs = validator.validate({ corpus: c }).errors.filter(f => f.file === FIXTURE_FILE);
        expect(checksFailed(errs)).toEqual(['parse']);
    });
});

describe('the validator catches each class of pronunciation defect', () => {
    /** The real pronunciation content, deep-cloned and attributed to a fixture. */
    function pronFixture(mutate) {
        const roots = corpus.pronunciation.map(x => JSON.parse(JSON.stringify(x.root)));
        roots.forEach(mutate);
        return Object.assign({}, corpus, {
            files: Object.assign({}, corpus.files, { all: [], other: [] }),
            points: [], registrations: [], parseErrors: [], consoleOutput: [],
            pronunciation: roots.map(r => ({ file: FIXTURE_FILE, declaredAs: 'PRON_FIXTURE', root: r }))
        });
    }
    const pronErrors = mutate => validator.validate({ corpus: pronFixture(mutate) })
        .errors.filter(f => f.file === FIXTURE_FILE);

    it('the unmutated pronunciation fixture is clean', () => {
        expect(pronErrors(() => {})).toEqual([]);
    });

    it.each(['phonemes', 'minimalPairs', 'contrastFeature', 'articulatoryCue'])(
        'catches a pair set missing %s, which pronunciationPairs() silently drops',
        field => {
            const errs = pronErrors(root => { if (root.pairs && root.pairs[0]) delete root.pairs[0][field]; });
            expect(checksFailed(errs)).toContain('pronunciation-pairs');
            expect(errs.some(e => e.message.indexOf(field) !== -1)).toBe(true);
        }
    );

    it('catches requiresImitation anywhere in the file (FR-PRN-8)', () => {
        const errs = pronErrors(root => { if (root.noticing) root.noticing[0].requiresImitation = true; });
        expect(checksFailed(errs)).toContain('prosody');
        expect(errs.some(e => /FR-PRN-8/.test(e.message))).toBe(true);
    });

    it('catches requiresImitation nested somewhere new, because the scan is deep', () => {
        const errs = pronErrors(root => {
            if (root.pairs && root.pairs[0]) root.pairs[0].discrimination.requiresImitation = true;
        });
        expect(checksFailed(errs)).toContain('prosody');
    });

    it('catches a prosody item that matches none of the three grading shapes', () => {
        const errs = pronErrors(root => {
            if (!root.noticing) return;
            const n = root.noticing[0];
            delete n.options; delete n.correctIndex; delete n.tokens; delete n.correct; delete n.items;
        });
        expect(checksFailed(errs)).toContain('prosody');
        expect(errs.some(e => /none of the three grading shapes/.test(e.message))).toBe(true);
    });

    it('catches requiresAudio and answerableFrom: audio', () => {
        expect(checksFailed(pronErrors(root => {
            if (root.noticing) root.noticing[0].requiresAudio = true;
        }))).toContain('prosody');
        expect(checksFailed(pronErrors(root => {
            if (root.noticing) root.noticing[0].answerableFrom = 'audio';
        }))).toContain('prosody');
    });

    it('catches a correctIndex out of range', () => {
        const errs = pronErrors(root => {
            if (root.noticing) {
                const n = root.noticing.find(x => Array.isArray(x.options) && x.options.length);
                if (n) n.correctIndex = n.options.length;
            }
        });
        expect(errs.some(e => /out of range/.test(e.message))).toBe(true);
    });

    it('catches a pair set whose srsKey does not match its id', () => {
        const errs = pronErrors(root => { if (root.pairs && root.pairs[0]) root.pairs[0].srsKey = 'phon:renamed'; });
        expect(checksFailed(errs)).toContain('references');
    });
});
