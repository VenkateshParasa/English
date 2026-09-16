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

// ---------------------------------------------------------------------------
// The IPA segmenter, proved on the cases that make a naive character diff wrong.
// These are unit tests of the segmenter itself rather than of a check, because a
// segmenter that mis-splits makes the minimal-pair check either useless (it
// rejects correct diphthong pairs) or decoration (it accepts anything).
// ---------------------------------------------------------------------------
describe('the IPA segmenter', () => {
    const seg = validator.segmentIpa;
    const diffCount = (a, b) => validator.compareIpa(a, b).count;

    it('drops delimiters and stress marks, which are not segments', () => {
        expect(seg('/kæt/')).toEqual(['k', 'æ', 't']);
        expect(seg('[kæt]')).toEqual(['k', 'æ', 't']);
        // `ˈ` is a Unicode modifier letter and would otherwise be swallowed by
        // the `d` in front of it, giving a segment no other /d/ could equal.
        expect(seg('/ədˈvaɪz/')).toEqual(['ə', 'd', 'v', 'aɪ', 'z']);
        expect(seg('/ˌfʌndəˈmentl/')).toEqual(['f', 'ʌ', 'n', 'd', 'ə', 'm', 'e', 'n', 't', 'l']);
    });

    it('keeps a length mark with the vowel in front of it', () => {
        expect(seg('/ʃiːp/')).toEqual(['ʃ', 'iː', 'p']);
        expect(seg('/ʃɪp/')).toEqual(['ʃ', 'ɪ', 'p']);
        expect(seg('/ɜː/')).toEqual(['ɜː']);
    });

    it('treats the affricates and diphthongs as single segments', () => {
        expect(seg('/tʃiːp/')).toEqual(['tʃ', 'iː', 'p']);
        expect(seg('/dʒʌmp/')).toEqual(['dʒ', 'ʌ', 'm', 'p']);
        expect(seg('/kəʊt/')).toEqual(['k', 'əʊ', 't']);
        expect(seg('/veɪl/')).toEqual(['v', 'eɪ', 'l']);
        expect(seg('/ˈweəri/')).toEqual(['w', 'eə', 'r', 'i']);
    });

    it('reads a tie-barred affricate as the same segment as the plain one', () => {
        expect(seg('/t͡ʃiːp/')).toEqual(seg('/tʃiːp/'));
        expect(seg('/d͡ʒʌmp/')).toEqual(seg('/dʒʌmp/'));
    });

    it('attaches combining marks and modifier letters to the segment before', () => {
        expect(seg('[bæd̪]')).toEqual(['b', 'æ', 'd̪']);   // dental
        expect(seg('[tʰɪn]')).toEqual(['tʰ', 'ɪ', 'n']);             // aspirated
        expect(seg('[ˈlɪtl̩]')).toEqual(['l', 'ɪ', 't', 'l̩']);
    });

    it('normalises the typographic variants of one phoneme', () => {
        expect(seg('/gri:n/')).toEqual(seg('/ɡriːn/'));
    });

    // ---- the hard cases, stated as the brief states them ----------------
    it('calls /ɔː/ ~ /əʊ/ one segment, though every character differs', () => {
        expect(seg('/ɔː/')).toEqual(['ɔː']);
        expect(seg('/əʊ/')).toEqual(['əʊ']);
        expect(diffCount('/ɔː/', '/əʊ/')).toBe(1);
    });

    it('calls /tʃ/ ~ /dʒ/ one segment', () => {
        expect(diffCount('/tʃ/', '/dʒ/')).toBe(1);
    });

    it('calls /ˈkɔːt/ ~ /ˈkəʊt/ one segment, across a length difference of one char', () => {
        expect(diffCount('/ˈkɔːt/', '/ˈkəʊt/')).toBe(1);
    });

    it('calls the corpus\'s own ɒ~əʊ and iː~ɪ rows one segment', () => {
        expect(diffCount('/kɒt/', '/kəʊt/')).toBe(1);
        expect(diffCount('/ʃiːp/', '/ʃɪp/')).toBe(1);
        expect(diffCount('/tʃiːp/', '/tʃɪp/')).toBe(1);
    });

    // The negative half. A segmenter that passes everything is decoration, so
    // the pairs the authoring guide REJECTED must come out as more than one.
    it('rejects the pairs the guide discarded for differing in the vowel too', () => {
        expect(diffCount('/lɑːf/', '/læp/')).toBe(2);          // laugh / lap
        expect(diffCount('/bɑːθ/', '/bæt/')).toBe(2);          // bath / bat
        expect(diffCount('/ˈlɑːðə/', '/ˈlædə/')).toBe(2);      // lather / ladder
        expect(diffCount('/pɑːθ/', '/pɑːt/')).toBe(1);         // path/part IS one, non-rhotically
    });

    it('counts one added or dropped segment as one difference, not as two', () => {
        // *eat* / *heat* is a one-phoneme pair and h-dropping is a real
        // Telugu-L1 interference, so a length difference of one must not be
        // rejected out of hand the way a naive same-length rule would.
        const ins = validator.compareIpa('/iːt/', '/hiːt/');
        expect(ins.kind).toBe('insert');
        expect(ins.count).toBe(1);
        expect(ins.segment).toBe('h');
        const del = validator.compareIpa('/spɔːt/', '/pɔːt/');
        expect(del.kind).toBe('delete');
        expect(del.count).toBe(1);
        expect(del.segment).toBe('s');
        // But two operations still fail, however they are spread.
        expect(validator.compareIpa('/kæt/', '/skæts/').kind).toBe('unaligned');
        expect(validator.compareIpa('/kæt/', '/skæts/').count).toBe(Infinity);
    });

    it('counts syllables through syllabic consonants, and reads the primary mark', () => {
        expect(validator.ipaSyllableCount('/ˈhæpi/')).toBe(2);
        expect(validator.ipaSyllableCount('/ˈkʌmftəbl/')).toBe(3);   // comf-ta-ble
        expect(validator.ipaSyllableCount('/ˈhɒspɪtl/')).toBe(3);    // hos-pi-tal
        expect(validator.ipaSyllableCount('/ɪmˈpɔːtnt/')).toBe(3);   // im-por-tant
        expect(validator.ipaSyllableCount('/fɪlm/')).toBe(1);        // NOT fil-m
        expect(validator.ipaPrimaryStressSyllable('/ˈhæpi/')).toBe(0);
        expect(validator.ipaPrimaryStressSyllable('/əˈtʃiːv/')).toBe(1);
        expect(validator.ipaPrimaryStressSyllable('/ˌedʒuˈkeɪʃn/')).toBe(2);
        expect(validator.ipaPrimaryStressSyllable('/bʊk/')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
describe('the minimal-pair and word-stress checks', () => {
    /**
     * Real pronunciation content, cloned and attributed to a fixture file. Same
     * harness as the pronunciation block above; kept separate only so these
     * fixtures can also mutate the `other` strands (data.js), which is where
     * stress marking landed after the pronunciation files were written.
     */
    function fixture(mutatePron, mutateOther) {
        const roots = corpus.pronunciation.map(x => JSON.parse(JSON.stringify(x.root)));
        if (mutatePron) roots.forEach(mutatePron);
        const others = (corpus.other || []).map(x => ({
            file: FIXTURE_FILE, declaredAs: x.declaredAs, root: JSON.parse(JSON.stringify(x.root))
        }));
        if (mutateOther) others.forEach(o => mutateOther(o.root, o.declaredAs));
        return Object.assign({}, corpus, {
            files: Object.assign({}, corpus.files, { all: [], other: [] }),
            points: [], registrations: [], parseErrors: [], consoleOutput: [],
            pronunciation: roots.map(r => ({ file: FIXTURE_FILE, declaredAs: 'PRON_FIXTURE', root: r })),
            other: mutateOther ? others : []
        });
    }
    const errorsFor = (mutatePron, mutateOther) =>
        validator.validate({ corpus: fixture(mutatePron, mutateOther) })
            .errors.filter(f => f.file === FIXTURE_FILE);
    const findingsFor = (mutatePron, mutateOther) =>
        validator.validate({ corpus: fixture(mutatePron, mutateOther) })
            .findings.filter(f => f.file === FIXTURE_FILE);

    /** The first minimalPairs row of the first pair set of the first root. */
    const firstRow = root => root.pairs && root.pairs[0] && root.pairs[0].minimalPairs[0];

    // ---- the checks are not vacuous ------------------------------------
    it('actually walked minimal-pair rows and stress-marked items', () => {
        expect(result.summary.minimalPairRows).toBeGreaterThanOrEqual(78);
        expect(result.summary.stressMarkedItems).toBeGreaterThanOrEqual(result.summary.stressItems);
    });

    it('reaches the strands data/pronunciation is not in, by walking rather than by path', () => {
        // The specific thing this guards: word stress was marked on
        // `vocabularyData` in data.js on a `stress` sub-object of a shape this
        // validator has no schema for. A path-based check would have reported
        // the pronunciation items as the whole corpus and called it clean.
        const files = Array.from(new Set((corpus.other || []).map(o => o.file)));
        expect(files).toContain('data.js');
        expect(result.summary.stressMarkedItems).toBeGreaterThan(result.summary.stressItems);
    });

    // ---- negative control ----------------------------------------------
    it('the unmutated fixture is clean, so the harness manufactures nothing', () => {
        expect(errorsFor(() => {}, () => {})).toEqual([]);
    });

    // ---- minimal-pair --------------------------------------------------
    it('catches a pair that differs in two segments (the guide\'s laugh/lap class)', () => {
        const errs = errorsFor(root => {
            const row = firstRow(root);
            if (!row) return;
            row.a = 'laugh'; row.b = 'lap';
            row.aIpa = '/lɑːf/'; row.bIpa = '/læp/'; row.differsIn = 'f/p';
        });
        expect(checksFailed(errs)).toContain('minimal-pair');
        expect(errs.some(e => /differ in 2 segment position\(s\)/.test(e.message))).toBe(true);
    });

    it('does NOT catch a diphthong pair a character diff would reject', () => {
        // The useless-checker direction. /kɔːt/ ~ /kəʊt/ share only `k` and `t`
        // as characters; as segments they differ in exactly one.
        const errs = errorsFor(root => {
            const set = root.pairs && root.pairs.find(p => p.id === 'ɒ-əʊ');
            if (!set) return;
            set.minimalPairs[0] = {
                a: 'caught', b: 'coat', aIpa: '/ˈkɔːt/', bIpa: '/ˈkəʊt/', differsIn: 'ɔː/əʊ'
            };
        });
        // The only complaint is that the set contrasts ɒ~əʊ, not ɔː~əʊ — which
        // is the guide's actual reason for rejecting caught/coat. The
        // "differs in more than one segment" error does NOT fire.
        expect(errs.every(e => !/differ in \d+ segment position/.test(e.message))).toBe(true);
    });

    it('catches a row whose differsIn names the wrong segment', () => {
        const errs = errorsFor(root => {
            const row = firstRow(root);
            if (row) row.differsIn = 'b/p';
        });
        expect(checksFailed(errs)).toContain('minimal-pair');
        expect(errs.some(e => /but the segment that actually differs is/.test(e.message))).toBe(true);
    });

    it('catches a row that trains a different contrast from the set it sits in', () => {
        const errs = errorsFor(root => {
            const row = firstRow(root);
            if (!row) return;
            row.a = 'sheep'; row.b = 'ship';
            row.aIpa = '/ʃiːp/'; row.bIpa = '/ʃɪp/'; row.differsIn = 'iː/ɪ';
        });
        expect(errs.some(e => e.check === 'minimal-pair' &&
            /the set it sits in is the/.test(e.message))).toBe(true);
    });

    it('catches an untranscribed member', () => {
        ['aIpa', 'bIpa', 'differsIn'].forEach(field => {
            const errs = errorsFor(root => { const row = firstRow(root); if (row) delete row[field]; });
            expect(errs.some(e => e.check === 'minimal-pair' &&
                e.message.indexOf('`' + field + '`') !== -1)).toBe(true);
        });
    });

    it('does not fail an h-dropping pair, and says why it only notes it', () => {
        const f = findingsFor(root => {
            const row = firstRow(root);
            if (!row) return;
            row.a = 'eat'; row.b = 'heat';
            row.aIpa = '/iːt/'; row.bIpa = '/hiːt/'; row.differsIn = 'h';
        });
        const mine = f.filter(x => x.check === 'minimal-pair');
        expect(mine.filter(x => x.severity === 'error')).toEqual([]);
        expect(mine.some(x => /one added segment h/.test(x.message))).toBe(true);
    });

    it('notes, without failing, a row oriented against the set\'s phonemes', () => {
        const f = findingsFor(root => {
            const row = firstRow(root);
            if (!row) return;
            const a = row.a, aIpa = row.aIpa, named = String(row.differsIn).split('/');
            row.a = row.b; row.b = a;
            row.aIpa = row.bIpa; row.bIpa = aIpa;
            row.differsIn = named[1] + '/' + named[0];
        });
        expect(f.filter(x => x.severity === 'error' && x.check === 'minimal-pair')).toEqual([]);
        expect(f.some(x => x.severity === 'note' && /oriented/.test(x.message))).toBe(true);
    });

    // ---- word-stress ---------------------------------------------------
    const firstStress = root => root.stress && root.stress[0];

    it('catches two primary stresses and none at all', () => {
        const two = errorsFor(root => {
            const s = firstStress(root);
            if (s) { s.stressNumbers = s.stressNumbers.slice(); s.stressNumbers[1] = 1; }
        });
        expect(checksFailed(two)).toContain('word-stress');
        expect(two.some(e => /has 2 primary \(1\) mark\(s\)/.test(e.message))).toBe(true);

        const none = errorsFor(root => {
            const s = firstStress(root);
            if (s) s.stressNumbers = s.stressNumbers.map(() => 0);
        });
        expect(none.some(e => /has 0 primary \(1\) mark\(s\)/.test(e.message))).toBe(true);
    });

    it('catches stressNumbers whose length disagrees with syllables', () => {
        const errs = errorsFor(root => {
            const s = firstStress(root);
            if (s) s.stressNumbers = s.stressNumbers.concat([0]);
        });
        expect(errs.some(e => e.check === 'word-stress' &&
            /one number per syllable by definition/.test(e.message))).toBe(true);
    });

    it('catches an out-of-convention stress number', () => {
        const errs = errorsFor(root => {
            const s = firstStress(root);
            if (s) { s.stressNumbers = s.stressNumbers.slice(); s.stressNumbers[1] = 3; }
        });
        expect(errs.some(e => /ARPAbet\/CMUdict/.test(e.message))).toBe(true);
    });

    it('catches a stressIndex that disagrees with its own stressNumbers', () => {
        const errs = errorsFor(root => {
            const s = firstStress(root);
            if (s) s.stressIndex = s.stressNumbers.length - 1;
        });
        expect(errs.some(e => e.check === 'word-stress' && /DENORMALISED/.test(e.message))).toBe(true);
    });

    it('catches a display that capitalises the wrong syllable', () => {
        const errs = errorsFor(root => {
            const s = (root.stress || []).find(x => typeof x.display === 'string' &&
                                                    x.display.split('-').length > 1);
            if (!s) return;
            const parts = s.display.split('-');
            s.display = parts.map((p, i) => (i === parts.length - 1 ? p.toUpperCase() : p.toLowerCase()))
                             .join('-');
            s.stressNumbers = s.stressNumbers.map((_, i) => (i === 0 ? 1 : 0));
            s.stressIndex = 0;
        });
        expect(errs.some(e => e.check === 'word-stress' &&
            /capitalises syllable\(s\)/.test(e.message))).toBe(true);
    });

    it('catches an IPA whose stress mark falls on a different syllable', () => {
        const errs = errorsFor(root => {
            const s = (root.stress || []).find(x => x.stressIndex === 0 && x.stressNumbers.length > 1);
            if (!s) return;
            // Move the marking to the last syllable and leave the IPA alone.
            s.stressNumbers = s.stressNumbers.map((_, i) => (i === s.stressNumbers.length - 1 ? 1 : 0));
            s.stressIndex = s.stressNumbers.length - 1;
            if (typeof s.display === 'string' && s.display) {
                const parts = s.display.split('-');
                s.display = parts.map((p, i) => (i === parts.length - 1 ? p.toUpperCase() : p.toLowerCase()))
                                 .join('-');
            }
            if (s.drill && s.drill.mode === 'choose-stress') s.drill.correctIndex = s.stressIndex;
        });
        expect(errs.some(e => e.check === 'word-stress' &&
            /two renderings of one fact and they disagree/.test(e.message))).toBe(true);
    });

    it('catches a choose-stress drill marking a syllable the item does not stress', () => {
        const errs = errorsFor(root => {
            const s = (root.stress || []).find(x => x.drill && x.drill.mode === 'choose-stress');
            if (s) s.drill.correctIndex = (s.stressIndex + 1) % s.stressNumbers.length;
        });
        expect(errs.some(e => e.check === 'word-stress' &&
            /the options ARE the syllables/.test(e.message))).toBe(true);
    });

    it('catches the same defect in a strand with no schema, via data.js', () => {
        // Proof that "discovery-based" reaches the vocabulary entries and not
        // only data/pronunciation. The mutation is applied to the cloned
        // `vocabularyData`, never to the file.
        const errs = errorsFor(null, root => {
            if (!root || typeof root !== 'object') return;
            Object.keys(root).forEach(k => {
                if (!Array.isArray(root[k])) return;
                const e = root[k].find(x => x && x.stress && x.stress.stressNumbers.length > 1);
                if (e) { e.stress.stressNumbers = e.stress.stressNumbers.map(() => 1); }
            });
        });
        expect(errs.some(e => e.check === 'word-stress' &&
            /primary \(1\) mark\(s\)/.test(e.message))).toBe(true);
    });
});

