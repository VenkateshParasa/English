/**
 * The typed-review switchover contract (US-177).
 *
 * WHY THIS FILE EXISTS. srs.js's PROJECTORS note records three bugs in a row that
 * all shipped as the same thing: "an empty review card offered as a real one".
 * Two were projectors dropping a field; the third was a shape the review surface
 * did not know it could not draw. The defence against a fourth is not a comment —
 * it is that EVERY (type, shape) in SRS.SHAPES must be either drawn by app.js or
 * DECLARED undrawable by app.js, with nothing falling between the two. That is the
 * first assertion below, and it is what fails the moment a new content shape lands.
 *
 * The second thing it guards is the four-step switchover that srs.js's own
 * dueCount() comment says must land together, or "Review Due (N)" promises a
 * session the button does not open:
 *   1. startReview() walks SRS.getDue(null), not SRS.getDueWords()
 *   2. the badge counts every type, i.e. dueCount(null)
 *   3. SURFACES['srs.review'].types widens to what the screen draws
 *   4. this file
 *
 * HOW IT TESTS app.js WITHOUT LOADING IT. __tests__/README.md records that app.js
 * exports nothing and cannot be required; jest.config.js scopes coverage to
 * js/core/ for the same reason. So app.js is read as SOURCE and the two registries
 * are parsed out of it — the same technique __tests__/unit/assets.test.js uses on
 * service-worker.js's STATIC_ASSETS, and for the same reason: a cheap structural
 * check beats no check at all. It cannot verify that a card looks right; it can
 * verify that no shape is silently unhandled and that the four steps agree.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const SRS = require(path.join(ROOT, 'js', 'core', 'srs.js'));
const Session = require(path.join(ROOT, 'js', 'core', 'session.js'));

const appSource = read('app.js');
const indexHtml = read('index.html');

/** The keys of an object literal assigned to `name` in app.js. */
function literalKeys(source, name) {
    const start = source.indexOf('const ' + name + ' = {');
    if (start === -1) throw new Error('Could not find `const ' + name + '` in app.js');
    const open = source.indexOf('{', start);
    let depth = 0;
    let end = open;
    for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    const body = source.slice(open + 1, end);
    // Only quoted keys: every entry in both registries is a 'type/shape' string,
    // which is deliberate — an unquoted key could not hold the slash.
    return (body.match(/^\s*'([^']+)'\s*:/gm) || [])
        .map(s => s.replace(/^\s*'/, '').replace(/'\s*:$/, ''));
}

/** Every 'type/shape' pair the scheduler can put in the queue. */
function everyShape() {
    const shapes = SRS.SHAPES;
    return Object.keys(shapes).reduce(
        (out, type) => out.concat(shapes[type].map(shape => type + '/' + shape)), []);
}

const drawn = literalKeys(appSource, 'REVIEW_RENDERERS');
const declared = literalKeys(appSource, 'REVIEW_UNRENDERABLE');

describe('every card kind is either drawn or declared undrawable', () => {
    it('covers all six of SRS.SHAPES with no gap and no overlap', () => {
        const handled = drawn.concat(declared).sort();
        expect(handled).toEqual(everyShape().sort());
        // A shape in both tables would mean app.js says it can and cannot draw
        // the same card, and REVIEW_RENDERERS wins at runtime — so the
        // declaration would be a lie the learner never sees.
        expect(drawn.filter(k => declared.indexOf(k) !== -1)).toEqual([]);
    });

    it('names the six kinds srs.js documents, exactly', () => {
        expect(drawn.concat(declared).sort()).toEqual([
            'coll/coll', 'gram/gram', 'phon/noticing', 'phon/pair', 'phon/stress', 'vocab/vocab'
        ]);
    });

    it('gives every undrawable shape a reason, not just a null', () => {
        // REVIEW_UNRENDERABLE's values are printed to the learner in
        // #reviewHeldBack, so an empty one would be a blank explanation for a
        // missing card — which is the blank card again, one level up.
        declared.forEach(key => {
            const value = appSource.match(new RegExp("'" + key.replace(/[/]/g, '\\/') + "':\\s*'([^']+)'"));
            expect(value).not.toBeNull();
            expect(value[1].length).toBeGreaterThan(40);
        });
    });

    it('registers a renderer function for each drawn shape', () => {
        drawn.forEach(key => {
            const fn = appSource.match(new RegExp("'" + key.replace(/[/]/g, '\\/') + "':\\s*(render\\w+)"));
            expect(fn).not.toBeNull();
            expect(appSource.indexOf('function ' + fn[1] + '(')).toBeGreaterThan(-1);
        });
    });
});

describe('the four-step switchover landed together', () => {
    it('1. startReview() walks the typed queue, not getDueWords()', () => {
        const fn = appSource.slice(appSource.indexOf('function startReview()'),
                                  appSource.indexOf('function exitReview()'));
        expect(fn).toMatch(/reviewQueueNow\(\)/);
        expect(fn).not.toMatch(/getDueWords/);
        // reviewQueueNow() is the one place the queue comes from.
        const queue = appSource.slice(appSource.indexOf('function reviewQueueNow('),
                                     appSource.indexOf('function updateDueCount('));
        expect(queue).toMatch(/SRS\.getDue\(null/);
    });

    it('2. the badge counts every type, and equals what the button opens', () => {
        const fn = appSource.slice(appSource.indexOf('function updateDueCount()'),
                                   appSource.indexOf('function setReviewUI('));
        // The figure written into #dueCount is the queue's own length, so the
        // badge cannot promise a card the screen would refuse to draw...
        expect(fn).toMatch(/el\.textContent = q\.queue\.length/);
        // ...and dueCount(null) — the switchover's step 2, applied at the call
        // site — is read to compute and REPORT the difference.
        expect(fn).toMatch(/SRS\.dueCount\(null\)/);
        expect(fn).not.toMatch(/SRS\.dueCount\(\)/);
    });

    it('3. SURFACES["srs.review"].types matches what app.js can draw', () => {
        const declaredTypes = Session.SURFACES['srs.review'].types.slice().sort();
        const drawnTypes = [...new Set(drawn.map(k => k.split('/')[0]))].sort();
        expect(declaredTypes).toEqual(drawnTypes);
        // app.js overrides the baseline with a DERIVED list rather than a second
        // literal, so the two cannot drift.
        expect(appSource).toMatch(/types:\s*reviewDrawableTypes\(\)/);
        expect(appSource).toMatch(/function reviewDrawableTypes\(\)/);
    });

    it('4. a type this build cannot draw is reported, never silently dropped', () => {
        // Session.countsHeldBack() is the module's half; #reviewHeldBack is the
        // screen's. Both must exist or a due `coll:` record becomes invisible.
        const undrawnTypes = [...new Set(declared.map(k => k.split('/')[0]))];
        undrawnTypes.forEach(type => {
            expect(Session.SURFACES['srs.review'].types).not.toContain(type);
            expect(Session.countsHeldBack(Session.SURFACES['srs.review'].types)).toEqual(
                expect.any(Array));
        });
        expect(indexHtml).toMatch(/id="reviewHeldBack"/);
    });
});

describe('the markup the typed cards need', () => {
    it('has a #reviewCard host, hidden in the markup', () => {
        expect(indexHtml).toMatch(/id="reviewCard"[^>]*hidden/);
    });

    it('has a #vocabContainer the typed cards can hide', () => {
        // The vocabulary review still IS the word card, so the two hosts are
        // mutually exclusive and both have to be addressable.
        expect(indexHtml).toMatch(/id="vocabContainer"/);
    });

    it('keeps the review controls inside the vocabulary section', () => {
        const section = indexHtml.slice(indexHtml.indexOf('<section id="vocabulary"'),
                                        indexHtml.indexOf('<section id="sentences"'));
        ['startReview', 'exitReview', 'dueCount', 'reviewStatus', 'reviewHeldBack',
         'reviewCard', 'vocabContainer'].forEach(id => {
            expect(section).toContain('id="' + id + '"');
        });
    });
});

describe('per-item accuracy is not derived from the schedule', () => {
    it('keeps a counter of its own, separate from the FR-PRN-6 pair counter', () => {
        // srs.js's `stress` projector note: all 21 word-stress items share the key
        // `phon:word-stress`, so per-word accuracy "is not an SRS fact and must not
        // be derived from reps/lapses". state.itemAccuracy is that counter, and it
        // is deliberately NOT state.pronunciationAccuracy, which the FR-PRN-6 gate
        // iterates.
        expect(appSource).toMatch(/itemAccuracy:\s*\{\}/);
        expect(appSource).toMatch(/function recordItemAttempt\(/);
        const stressCard = appSource.slice(appSource.indexOf('function answerPhonStressReview('),
                                           appSource.indexOf('// phon / noticing'));
        expect(stressCard).toMatch(/recordItemAttempt\(/);
        expect(stressCard).not.toMatch(/pronRecordAttempt\(/);
        expect(stressCard).not.toMatch(/\.reps|\.lapses/);
    });
});

describe('FR-PRN-8: prosody is never taught by imitation', () => {
    it('refuses a requiresImitation item instead of drawing it', () => {
        const card = appSource.slice(appSource.indexOf('function renderPhonNoticingReviewCard('),
                                     appSource.indexOf('function renderNoticingChoice('));
        expect(card).toMatch(/if \(payload\.requiresImitation\)/);
        expect(card).toMatch(/FR-PRN-8/);
    });

    it('draws no audio and no recogniser control on a stress or noticing card', () => {
        const block = appSource.slice(appSource.indexOf('function renderPhonStressReviewCard('),
                                      appSource.indexOf('// ============================================\n// SENTENCE FORMATION'));
        expect(block).not.toMatch(/pronSpeak|pronPlayButton|SpeechRecognition|speechAPI/);
    });
});
