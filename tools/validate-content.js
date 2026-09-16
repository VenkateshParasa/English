#!/usr/bin/env node
/**
 * Content validation — US-811 / NFR-13 / FR-CNT-1
 * =============================================================================
 * The permanent version of the throwaway script that has been written, used and
 * deleted once per authoring wave. It is DISCOVERY-BASED: it walks `data/` and
 * validates whatever it finds, so a point authored after this file was written
 * is checked without anyone remembering to add it to a list.
 *
 * Two consumers, ONE implementation:
 *   - `node tools/validate-content.js`   — CI and the command line. Exits 1 on
 *                                          any error, prints a per-file report.
 *   - `__tests__/unit/content.test.js`   — requires this module and turns each
 *                                          (file x check) pair into an assertion.
 * Nothing is duplicated: the test asserts on the findings this file produces.
 *
 * -----------------------------------------------------------------------------
 * HOW THE CONTENT IS LOADED, and the mistake that has cost time repeatedly
 * -----------------------------------------------------------------------------
 * `data/*.js` are CLASSIC SCRIPTS (CON-4, no build step, no modules), so they
 * cannot be `require()`d for what matters: each one declares its content with a
 * top-level `const`, which is a *lexical* global and therefore NOT a property of
 * the context object. `ctx.grammarLessons` is permanently `undefined`.
 *
 * So the files are run with `vm` in ONE SHARED CONTEXT — shared because the
 * point files read `grammarLessons` by bare name and push themselves into it —
 * and the content is read back with an EXPRESSION EVALUATED INSIDE that context:
 *
 *     vm.runInContext('grammarLessons', ctx)          // works
 *     ctx.grammarLessons                              // always undefined
 *
 * `module` is deliberately left undefined in the context, so the `if (typeof
 * module !== 'undefined')` CommonJS branch each content file carries stays
 * inert and what gets exercised is the browser path — including the
 * self-registration that the browser actually runs.
 *
 * The two core modules the checks ask questions of (`js/core/mistakes.js`,
 * `js/core/srs.js`) DO export CommonJS, so they are `require()`d normally and
 * injected into the context as `Mistakes` / `SRS` and as `window.*`, which is
 * exactly how they are visible to a content file in the browser.
 *
 * -----------------------------------------------------------------------------
 * WHERE THE EXPECTED SHAPE COMES FROM
 * -----------------------------------------------------------------------------
 * Not from a literal in this file. A hardcoded field list is the thing that
 * rotted in `data/grammar.js`'s own header comment and in `PROJECTORS.gram`
 * twice, and a validator carrying a third copy would rot the same way.
 *
 * Instead the required key set for every shape is derived from the corpus
 * LEAVE-ONE-OUT: to check `data/grammar/modals.js`, the required keys are those
 * present on EVERY instance of that shape in every OTHER file. Two properties
 * follow, and both matter:
 *   - the file under test cannot lower the bar for itself (a plain corpus-wide
 *     intersection would: one file omitting `retryCue` makes `retryCue`
 *     "optional" and the defect validates clean);
 *   - a renamed field fails twice — once as a missing required key, once as a
 *     key no other file has — which is what makes a rename visible at all,
 *     since renaming breaks rendering silently.
 *
 * Optionality is the one thing a corpus cannot state: "present on 54 of 60
 * items" is equally consistent with "optional" and "omitted six times". So
 * optional fields are DECLARED, and the declaration is READ OUT OF the schema
 * comment in `data/grammar.js` (the lines reading `spoken   optional: ...`)
 * rather than copied here. Only three fields are hardcoded, as CONDITIONAL_KEYS
 * below, each because that same comment describes it as conditional rather than
 * using the word "optional".
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Check registry. One id per class of defect, so a report line, a jest test
// name and a backlog row all say the same word.
// ---------------------------------------------------------------------------
const CHECKS = {
    parse: 'every discovered content file parses',
    registration: 'each file self-registers into the tier its own `tier` field names, with a unique id',
    wiring: 'each discovered data file has a <script> tag and a precache entry',
    schema: 'field sets match the shape the rest of the corpus uses (top level and nested)',
    cardinality: 'exactly 3 contrast pairs and exactly 6 practice items (data/grammar.js schema)',
    'mode-gap': "every practice item is mode: 'gap' — the only mode app.js implements",
    'accept-in-options': 'US-166: every accepted answer appears in its item\'s options',
    'show-difference': 'US-188: showDifferenceOnCorrect set iff more than one answer is accepted',
    feedback: 'every wrong option has reason + 2-string contrast + retryCue; no feedback targets an accepted answer',
    categories: 'every logAs / mistakeCategory resolves in js/core/mistakes.js',
    'srs-projection': 'SRS.auditProjection drops nothing and reports no phantom field',
    references: 'prerequisites, review.itemIds and the srsType/srsRef/srsKey triple all resolve',
    placeholders: 'no PLACEHOLDER / TODO / FIXME left in shipped content',
    'pronunciation-pairs': 'every pair set carries the fields pronunciationPairs() requires',
    prosody: 'FR-PRN-8: every prosody item is gradable and requiresImitation is false everywhere',
    'minimal-pair': 'CONTENT_AUTHORING_GUIDE §9.1 rule 2: a minimal pair differs in exactly one IPA segment, and `differsIn` names it',
    'word-stress': 'stressNumbers has exactly one primary and one entry per syllable, and stressIndex / display / IPA agree with it'
};

// `showDifferenceOnCorrect` is conditional on `accept.length`, and the
// `show-difference` check owns it, so the schema check must not also demand it.
// `logAs` is documented in data/grammar.js as "the mistake-log category to log,
// WHEN IT DIFFERS from the lesson default", and `errorKind` as "for authoring
// and analysis only" — both legitimately absent, neither spelled "optional".
const CONDITIONAL_KEYS = {
    practice: ['showDifferenceOnCorrect'],
    feedback: ['logAs', 'errorKind']
};

// A shape needs this many instances before the fallback frequency rule (used
// only when no other file has instances of the shape) means anything.
const MIN_INSTANCES_FOR_FREQUENCY = 10;
const FREQUENCY_REQUIRED_AT = 0.9;

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** Every .js file under `data/`, plus data.js, relative to ROOT, sorted. */
function discover(root) {
    root = root || ROOT;
    const out = { grammarRegistry: null, grammar: [], pronunciation: [], other: [], all: [] };

    const walk = dir => {
        let entries;
        try { entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true }); }
        catch (e) { return []; }
        const files = [];
        entries.sort((a, b) => a.name.localeCompare(b.name)).forEach(e => {
            const rel = dir + '/' + e.name;
            if (e.isDirectory()) files.push.apply(files, walk(rel));
            else if (e.name.endsWith('.js')) files.push(rel);
        });
        return files;
    };

    const dataFiles = walk('data');
    if (fs.existsSync(path.join(root, 'data.js'))) dataFiles.unshift('data.js');

    dataFiles.forEach(rel => {
        out.all.push(rel);
        if (rel === 'data/grammar.js') out.grammarRegistry = rel;
        else if (rel.startsWith('data/grammar/')) out.grammar.push(rel);
        else if (rel.startsWith('data/pronunciation/')) out.pronunciation.push(rel);
        else out.other.push(rel);
    });
    return out;
}

/** Top-level `const NAME =` bindings declared by a classic script. */
function topLevelConsts(source) {
    const names = [];
    const re = /^const\s+([A-Za-z_$][\w$]*)\s*=/gm;
    let m;
    while ((m = re.exec(source)) !== null) names.push(m[1]);
    return names;
}

/**
 * Read a lexical global out of a vm context. A top-level `const` is not a
 * property of the context object, so it has to be evaluated by name inside it.
 */
function lexical(ctx, name) {
    try {
        return vm.runInContext('(typeof ' + name + ' !== "undefined") ? ' + name + ' : undefined', ctx);
    } catch (e) {
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Run the discovered content in one shared vm context and return everything the
 * checks need, including per-file attribution (which file declared which point)
 * and any console output the content produced while loading.
 */
function loadCorpus(opts) {
    opts = opts || {};
    const root = opts.root || ROOT;
    const files = opts.files || discover(root);

    const Mistakes = require(path.join(root, 'js/core/mistakes.js'));
    const SRS = require(path.join(root, 'js/core/srs.js'));
    let Levels = null;
    try { Levels = require(path.join(root, 'js/core/levels.js')); } catch (e) { /* optional */ }

    const consoleOutput = [];
    const cap = level => function () {
        consoleOutput.push({ level, text: Array.prototype.slice.call(arguments).join(' ') });
    };
    const sandbox = {
        console: { log: cap('log'), info: cap('info'), warn: cap('warn'), error: cap('error'), debug: cap('debug') },
        Mistakes: Mistakes,
        SRS: SRS,
        Levels: Levels,
        // No `module`: the CommonJS branch in each content file must stay inert
        // so the browser path — including self-registration — is what runs.
        setTimeout: setTimeout,
        JSON: JSON,
        Math: Math,
        Date: Date
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    const ctx = vm.createContext(sandbox);

    const parseErrors = [];
    const sources = {};
    /**
     * @param {string} rel
     * @param {boolean} [throwIsFatal] false for the files in `files.other`: those
     *        are strands with no shape checks, and the sandbox is not a browser,
     *        so a file that legitimately touches `document` at load time would
     *        fail here for a reason that is not a content defect. A SYNTAX error
     *        is still fatal — that is unambiguous, and the same thing the
     *        `syntax` CI job asserts over every tracked file.
     */
    const run = (rel, throwIsFatal) => {
        const src = fs.readFileSync(path.join(root, rel), 'utf8');
        sources[rel] = src;
        try {
            new vm.Script(src, { filename: rel });
        } catch (e) {
            parseErrors.push({ file: rel, message: e.message, kind: 'syntax', fatal: true });
            return false;
        }
        try {
            vm.runInContext(src, ctx, { filename: rel });
        } catch (e) {
            parseErrors.push({
                file: rel, message: 'threw while loading: ' + e.message,
                kind: 'throw', fatal: throwIsFatal !== false
            });
            return false;
        }
        return true;
    };

    // ---- grammar -------------------------------------------------------
    // The registry first (it declares `grammarLessons` and pre-creates the tier
    // arrays), then each point file, diffing the registry after each one so the
    // file -> point -> tier-it-landed-in mapping is observed rather than assumed.
    const snapshot = () => {
        const lessons = lexical(ctx, 'grammarLessons');
        const out = {};
        if (lessons && typeof lessons === 'object') {
            Object.keys(lessons).forEach(k => {
                out[k] = Array.isArray(lessons[k]) ? lessons[k].map(p => p && p.id) : null;
            });
        }
        return out;
    };
    const flat = snap => {
        const m = {};
        Object.keys(snap).forEach(k => (snap[k] || []).forEach(id => { m[id] = k; }));
        return m;
    };

    const points = [];          // { file, tierKey, point, declaredAs }
    const registrations = [];   // { file, declaredAs, point, landedIn, alreadyThere }

    if (files.grammarRegistry) {
        const before = flat(snapshot());
        if (run(files.grammarRegistry)) {
            const after = flat(snapshot());
            Object.keys(after).forEach(id => {
                if (before[id]) return;
                const lessons = lexical(ctx, 'grammarLessons');
                const point = (lessons[after[id]] || []).filter(p => p && p.id === id)[0];
                points.push({ file: files.grammarRegistry, tierKey: after[id], point: point, declaredAs: null });
                registrations.push({
                    file: files.grammarRegistry, declaredAs: 'grammarLessons.' + after[id],
                    point: point, landedIn: after[id]
                });
            });
        }
    }

    files.grammar.forEach(rel => {
        const before = flat(snapshot());
        if (!run(rel)) return;
        const after = flat(snapshot());
        const landed = Object.keys(after).filter(id => !before[id]);
        const lessons = lexical(ctx, 'grammarLessons') || {};

        landed.forEach(id => {
            const point = (lessons[after[id]] || []).filter(p => p && p.id === id)[0];
            points.push({ file: rel, tierKey: after[id], point: point, declaredAs: null });
        });

        // What did the file DECLARE? Discovered from its own top-level consts,
        // so a point that failed to register is still visible to the checks.
        topLevelConsts(sources[rel]).forEach(name => {
            const value = lexical(ctx, name);
            if (!value || typeof value !== 'object' || Array.isArray(value)) return;
            if (typeof value.id !== 'string' || !Array.isArray(value.practice)) return;
            const already = points.filter(p => p.point === value)[0];
            if (already && already.declaredAs === null) already.declaredAs = name;
            registrations.push({
                file: rel, declaredAs: name, point: value,
                landedIn: after[value.id] || null,
                landedNow: landed.indexOf(value.id) !== -1
            });
        });
    });

    // ---- pronunciation -------------------------------------------------
    const pronunciation = [];   // { file, declaredAs, root }
    files.pronunciation.forEach(rel => {
        if (!run(rel)) return;
        topLevelConsts(sources[rel]).forEach(name => {
            const value = lexical(ctx, name);
            if (!value || typeof value !== 'object' || Array.isArray(value)) return;
            const looksRight = ['pairs', 'stress', 'noticing'].some(k => Array.isArray(value[k]));
            if (looksRight) pronunciation.push({ file: rel, declaredAs: name, root: value });
        });
    });

    // ---- everything else under data/ -----------------------------------
    // `data.js` and any future strand in `data/`'s root. There are no SHAPE
    // checks for these — that is still true and still reported as a note — but
    // they are now LOADED, which is what makes the cross-strand checks
    // (word-stress, placeholders) discovery-based rather than
    // pronunciation-only. The reason this matters concretely: word stress was
    // marked on `vocabularyData` in data.js while this file was being written,
    // and a checker that only walked data/pronunciation/ would have declared the
    // corpus clean without ever looking at the 61 items that had just landed.
    const other = [];           // { file, declaredAs, root }
    files.other.forEach(rel => {
        if (!run(rel, false)) return;
        topLevelConsts(sources[rel]).forEach(name => {
            const value = lexical(ctx, name);
            if (!value || typeof value !== 'object') return;
            other.push({ file: rel, declaredAs: name, root: value });
        });
    });

    return {
        root: root, files: files, ctx: ctx, sources: sources,
        parseErrors: parseErrors, consoleOutput: consoleOutput,
        Mistakes: Mistakes, SRS: SRS, Levels: Levels,
        grammarLessons: lexical(ctx, 'grammarLessons') || {},
        points: points, registrations: registrations, pronunciation: pronunciation,
        other: other
    };
}

// ---------------------------------------------------------------------------
// Shape collection + leave-one-out schema derivation
// ---------------------------------------------------------------------------

/** Every nested object in the grammar corpus, tagged with shape + source file. */
function collectShapes(points) {
    const inst = [];
    const add = (shape, file, where, obj) => {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
        inst.push({ shape: shape, file: file, where: where, keys: Object.keys(obj), obj: obj });
    };
    points.forEach(({ file, point: p }) => {
        if (!p) return;
        add('point', file, p.id, p);
        add('notice', file, p.id + '.notice', p.notice);
        (p.contrast || []).forEach((c, i) => {
            add('contrast', file, p.id + '.contrast[' + i + ']', c);
            (c && c.pair || []).forEach((m, j) => add('contrast.pair', file, p.id + '.contrast[' + i + '].pair[' + j + ']', m));
        });
        (p.practice || []).forEach((it, i) => {
            const label = (it && it.id) || p.id + '.practice[' + i + ']';
            add('practice', file, label, it);
            (it && it.accept || []).forEach((a, j) => add('accept', file, label + '.accept[' + j + ']', a));
            (it && it.feedback || []).forEach((f, j) => add('feedback', file, label + '.feedback[' + j + ']', f));
            add('fallbackFeedback', file, label + '.fallbackFeedback', it && it.fallbackFeedback);
        });
        add('produce', file, p.id + '.produce', p.produce);
        Object.keys(p.l1Notes || {}).forEach(k => add('l1Notes.' + k, file, p.id + '.l1Notes.' + k, p.l1Notes[k]));
        add('review', file, p.id + '.review', p.review);
        (p.commonErrors || []).forEach((e, i) => add('commonErrors', file, p.id + '.commonErrors[' + i + ']', e));
    });
    return inst;
}

/**
 * Fields data/grammar.js's own schema comment marks `optional:`. Read out of the
 * comment so this file does not carry a third copy of the field contract.
 */
function declaredOptional(source) {
    const out = [];
    const re = /^\s*\*\s+([A-Za-z_$][\w$]*)\s+optional\b/gm;
    let m;
    while ((m = re.exec(source || '')) !== null) out.push(m[1]);
    return out;
}

/** keys present on every member of `list`. */
function intersectKeys(list) {
    if (!list.length) return null;
    let acc = list[0].keys.slice();
    for (let i = 1; i < list.length; i++) {
        const has = list[i].keys;
        acc = acc.filter(k => has.indexOf(k) !== -1);
    }
    return acc;
}

function unionKeys(list) {
    const seen = {};
    list.forEach(i => i.keys.forEach(k => { seen[k] = true; }));
    return Object.keys(seen);
}

/**
 * The expected shape of `shape` as seen from `file`.
 *
 *   required  keys every instance in every OTHER file has (leave-one-out), so
 *             the file under test cannot lower its own bar.
 *   known     keys any other file uses; anything outside this is corpus-novel.
 *   basis     how it was derived, for the report.
 */
function expectedShape(instances, shape, file, optional) {
    const mine = instances.filter(i => i.shape === shape && i.file === file);
    const others = instances.filter(i => i.shape === shape && i.file !== file);
    const skip = (optional[shape] || []).concat(CONDITIONAL_KEYS[shape] || []);
    const strip = keys => keys.filter(k => skip.indexOf(k) === -1);

    if (others.length) {
        return {
            required: strip(intersectKeys(others) || []),
            known: unionKeys(others),
            basis: 'leave-one-out over ' + others.length + ' instance(s) in ' +
                   new Set(others.map(o => o.file)).size + ' other file(s)',
            instances: mine
        };
    }
    // Only this file has instances of this shape. Fall back to a frequency rule
    // over its own instances, which still catches the odd item out, but only
    // when there are enough of them for "odd one out" to mean anything.
    if (mine.length >= MIN_INSTANCES_FOR_FREQUENCY) {
        const count = {};
        mine.forEach(i => i.keys.forEach(k => { count[k] = (count[k] || 0) + 1; }));
        const required = Object.keys(count).filter(k => count[k] / mine.length >= FREQUENCY_REQUIRED_AT &&
                                                        count[k] !== mine.length);
        return {
            required: strip(required),
            known: unionKeys(mine),
            basis: 'no other file has this shape; keys on >=' +
                   Math.round(FREQUENCY_REQUIRED_AT * 100) + '% of its own ' + mine.length + ' instances',
            instances: mine
        };
    }
    return { required: [], known: unionKeys(mine), basis: 'not derivable: only ' + mine.length +
             ' instance(s), all in this file', instances: mine, vacuous: true };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const nonEmptyString = v => typeof v === 'string' && v.trim() !== '';
const nonEmptyArray = v => Array.isArray(v) && v.length > 0;

/** Every (path, value) pair under `obj` whose key is `key`. */
function deepFind(obj, key, trail, out) {
    trail = trail || '';
    out = out || [];
    if (!obj || typeof obj !== 'object') return out;
    if (Array.isArray(obj)) {
        obj.forEach((v, i) => deepFind(v, key, trail + '[' + i + ']', out));
        return out;
    }
    Object.keys(obj).forEach(k => {
        const at = trail ? trail + '.' + k : k;
        if (k === key) out.push({ path: at, value: obj[k], parent: obj });
        deepFind(obj[k], key, at, out);
    });
    return out;
}

/**
 * Every plain object under `root`, with its path and its chain of ancestors
 * (nearest first). Used by the checks that have to ask a question of an object
 * AND of the object that contains it — e.g. `stressNumbers` lives on a `stress`
 * sub-object in data.js while the IPA it must agree with sits on the vocabulary
 * entry one level up. Walking rather than naming paths is what lets those checks
 * find a shape nobody told this file about.
 */
function deepWalk(root, visit) {
    const seen = new Set();
    const step = (node, path, ancestors) => {
        if (!node || typeof node !== 'object') return;
        if (seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) {
            node.forEach((v, i) => step(v, path + '[' + i + ']', ancestors));
            return;
        }
        visit(node, path, ancestors);
        const deeper = [node].concat(ancestors);
        Object.keys(node).forEach(k => step(node[k], path ? path + '.' + k : k, deeper));
    };
    step(root, '', []);
}

// ---------------------------------------------------------------------------
// IPA segmentation
// ---------------------------------------------------------------------------
/*
 * "A minimal pair differs in exactly one phoneme" (CONTENT_AUTHORING_GUIDE
 * §9.1 rule 2, and the last checkbox of §10) cannot be checked by diffing
 * `aIpa` against `bIpa` as strings, and the reason is not subtle: a phoneme is
 * not a character.
 *
 *   /kɒt/ ~ /kəʊt/   3 chars vs 4 — a character diff calls this two changes,
 *                    and it is the corpus's own ɒ~əʊ contrast, all nine rows.
 *   /ɔː/ ~ /əʊ/      2 chars vs 2, both differing — a character diff calls it
 *                    two changes; it is one segment against one segment.
 *   /tʃ/ ~ /dʒ/      likewise.
 *   /ʃiːp/ ~ /ʃɪp/   4 vs 3, and `ː` belongs to the vowel before it.
 *
 * A checker that rejects those is worse than no checker: it fires on every
 * correct diphthong pair, so it gets deleted in a week. So the strings are
 * SEGMENTED first, and the invariant is asserted over segments.
 *
 * What the segmenter knows:
 *   - the multi-character segments English transcription uses: the two
 *     affricates and the eight diphthongs (IPA_MULTI below);
 *   - `ː` (and `ˑ`) belong to the vowel in front of them, so `iː` is one
 *     segment and never `i` + something;
 *   - combining marks and modifier letters attach to the segment before them —
 *     dental `d̪`, syllabic `l̩`, aspirated `tʰ`, nasalised `ã`;
 *   - a tie bar writes an affricate as `t͡ʃ`, which must segment identically to
 *     `tʃ` or two rows using different conventions would look contrastive;
 *   - `/ /`, `[ ]`, `.`, spaces and the stress marks `ˈ` `ˌ` are NOT segments;
 *     they are delimiters and prosody, and a diff must not see them at all.
 *
 * What it deliberately does not know: nothing here decides whether a symbol is
 * a phoneme *of English*. That would be a 44-symbol inventory, i.e. a hardcoded
 * list of exactly the kind this file refuses to carry (see the header). The
 * check is "one segment differs", which is answerable without an inventory.
 */
const IPA_MULTI = [
    'tʃ', 'dʒ',                                             // affricates
    'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'əʊ', 'oʊ', 'ɪə', 'eə', 'ʊə',   // diphthongs
    'ɛə', 'ɔə'                                              // older/variant notations of the same two
].sort((a, b) => b.length - a.length);

// Delimiters and prosody. Checked BEFORE the "attaches to the previous segment"
// rule, because `ˈ` and `ˌ` are Unicode modifier letters and would otherwise be
// swallowed by the segment in front of them — /ədˈvaɪz/ would come out with a
// segment `dˈ` that no other transcription of /d/ could ever equal.
const IPA_NOT_A_SEGMENT = /[ˈˌ.\s|‖‿/[\]()⁀\-–—'"`]/;
const IPA_TIE = /[\u0361\u035C\u0362]/;                    // the tie bar in t͡ʃ / d͡ʒ
const IPA_ATTACHES = /[\p{Mn}\p{Me}\p{Lm}\p{Sk}]/u;         // ː ˑ ʰ ʲ ʷ ̪ ̩ ̃ …
const IPA_VOWEL = /[iɪyʏeɛøœæaɶɑɒɔoʊuʉɯɤʌɜɞəɐɚɝɨ]/;
const IPA_SONORANT = /^[lmnrŋɱɲɳʎʁɹɻjw]/;                   // may not license a syllabic neighbour
const IPA_SYLLABIC_MARK = /[\u0329\u030D]/;                 // an explicitly syllabic l / n

/** Typographic variants that are the same phoneme written two ways. */
function normaliseIpa(s) {
    return String(s == null ? '' : s)
        .normalize('NFC')
        .replace(/:/g, 'ː')        // ASCII colon used as a length mark
        .replace(/g/g, 'ɡ')        // ASCII g for U+0261
        .replace(/ɹ/g, 'r');       // narrow vs broad transcription of English /r/
}

/**
 * Split an IPA string into phoneme-sized segments.
 * @param {string} input  with or without `/ /` or `[ ]`, stress marks and all.
 * @returns {string[]}
 */
function segmentIpa(input) {
    const str = normaliseIpa(input);
    const segs = [];
    let i = 0;
    while (i < str.length) {
        if (IPA_NOT_A_SEGMENT.test(str[i]) || IPA_TIE.test(str[i])) { i++; continue; }
        let seg = null;
        for (let k = 0; k < IPA_MULTI.length; k++) {
            if (str.startsWith(IPA_MULTI[k], i)) { seg = IPA_MULTI[k]; break; }
        }
        if (seg === null) seg = str[i];
        i += seg.length;
        for (;;) {
            if (i < str.length && IPA_TIE.test(str[i])) {
                // A tie bar pulls the next base letter into this segment.
                seg += str[i];
                i++;
                if (i < str.length && !IPA_NOT_A_SEGMENT.test(str[i])) { seg += str[i]; i++; }
                continue;
            }
            if (i < str.length && IPA_ATTACHES.test(str[i]) && !IPA_NOT_A_SEGMENT.test(str[i])) {
                seg += str[i];
                i++;
                continue;
            }
            break;
        }
        // `t͡ʃ` and `tʃ` are the same segment, so the tie itself is not part of it.
        segs.push(seg.replace(new RegExp(IPA_TIE.source, 'g'), ''));
    }
    return segs;
}

/**
 * Which segments are syllable nuclei. A vowel always is. A liquid or nasal is
 * one when it carries the syllabic diacritic, or when it stands where no vowel
 * can be reached: preceded by an OBSTRUENT and not followed by a vowel —
 * /ˈkʌmftəbl/ is three syllables, /ˈhɒspɪtl/ three, /ɪmˈpɔːtnt/ three.
 * "preceded by an obstruent" and not merely "by a consonant" is what keeps
 * /fɪlm/ at one syllable rather than two.
 */
function ipaNuclei(segs) {
    return segs.map((seg, i) => {
        if (IPA_VOWEL.test(seg[0])) return true;
        if (IPA_SYLLABIC_MARK.test(seg)) return true;
        if (!IPA_SONORANT.test(seg)) return false;
        const prev = segs[i - 1];
        const next = segs[i + 1];
        if (!prev || IPA_VOWEL.test(prev[0]) || IPA_SONORANT.test(prev)) return false;
        return !next || !IPA_VOWEL.test(next[0]);
    });
}

/** How many syllables the transcription has. */
function ipaSyllableCount(input) {
    return ipaNuclei(segmentIpa(input)).filter(Boolean).length;
}

/**
 * The 0-based syllable the primary stress mark falls on: the number of nuclei
 * before `ˈ`. null when there is no primary mark to read.
 */
function ipaPrimaryStressSyllable(input) {
    const str = normaliseIpa(input);
    const at = str.indexOf('ˈ');
    if (at === -1) return null;
    return ipaSyllableCount(str.slice(0, at));
}

/**
 * Compare two transcriptions segment by segment.
 *
 * "Differs in exactly one phoneme" is not only substitution. *eat* and *heat*
 * differ by the presence of one segment, and h-dropping is a real Telugu-L1
 * interference, so a pair authored that way must not be rejected as "differs in
 * two things" merely because the two strings have different lengths. So the
 * comparison recognises three one-segment differences and nothing else:
 *
 *   substitute  same length, exactly one position differs
 *   insert      `b` has one segment `a` does not, everything else aligns
 *   delete      the mirror of insert
 *
 * @returns {{a, b, kind, positions, count, segment, sameLength}}
 *   kind     'substitute' | 'insert' | 'delete' | 'unaligned'
 *   count    how many one-segment operations it took; anything but 1 fails
 *   segment  for insert/delete, the segment that is present on one side only
 */
function compareIpa(aIpa, bIpa) {
    const a = segmentIpa(aIpa);
    const b = segmentIpa(bIpa);
    const base = { a: a, b: b, sameLength: a.length === b.length, segment: null };

    if (a.length === b.length) {
        const positions = [];
        a.forEach((seg, i) => { if (seg !== b[i]) positions.push(i); });
        return Object.assign(base, { kind: 'substitute', positions: positions, count: positions.length });
    }
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    if (longer.length - shorter.length !== 1) {
        return Object.assign(base, { kind: 'unaligned', positions: [], count: Infinity });
    }
    let i = 0;
    while (i < shorter.length && shorter[i] === longer[i]) i++;
    for (let k = i; k < shorter.length; k++) {
        if (shorter[k] !== longer[k + 1]) {
            return Object.assign(base, { kind: 'unaligned', positions: [], count: Infinity });
        }
    }
    return Object.assign(base, {
        kind: a.length < b.length ? 'insert' : 'delete',
        positions: [i], count: 1, segment: longer[i]
    });
}

/** Notations authors use for "and nothing on this side". */
const IPA_ZERO = ['∅', 'ø', '-', '–', '—', '0', 'none', 'nothing', ''];



// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------

/**
 * @returns {{errors, notes, findings, byFile, corpus, summary}}
 *   errors  fail the build (NFR-13)
 *   notes   reported, do not fail — see the comment on each one for why
 */
function validate(opts) {
    const corpus = (opts && opts.corpus) || loadCorpus(opts);
    const findings = [];
    const add = (severity, check, file, where, message) =>
        findings.push({ severity: severity, check: check, file: file, where: where || null, message: message });
    const err = (check, file, where, message) => add('error', check, file, where, message);
    const note = (check, file, where, message) => add('note', check, file, where, message);

    const { Mistakes, SRS, Levels, points, registrations, pronunciation, files, sources } = corpus;
    const other = corpus.other || [];

    // --- parse ----------------------------------------------------------
    // A `throw` while loading is fatal for grammar and pronunciation (those files
    // are pure data and the browser runs them the same way) and a NOTE for the
    // other strands, where the sandbox's lack of a DOM is a plausible innocent
    // cause. A SYNTAX error is fatal everywhere.
    corpus.parseErrors.forEach(p => {
        if (p.fatal === false) {
            note('parse', p.file, null,
                 p.message + ' — reported and not failed because this file is not grammar or ' +
                 'pronunciation content and the vm sandbox is not a browser, so a load-time ' +
                 'reference to document/localStorage would fail here innocently. The consequence ' +
                 'is real, though: nothing inside this file was seen by any check.');
        } else {
            err('parse', p.file, null, p.message);
        }
    });

    // A content file that warns while merely loading is telling us something.
    corpus.consoleOutput.filter(o => o.level === 'warn' || o.level === 'error').forEach(o => {
        note('parse', '(load)', null, 'console.' + o.level + ' during load: ' + o.text);
    });

    // Any data/ file that is neither grammar nor pronunciation is a strand with
    // no SHAPE checks. It IS loaded and it IS walked by the cross-strand checks
    // (word-stress, minimal-pair, placeholders), so this note is narrower than it
    // used to be — but it is still a note, because nothing here knows what a
    // valid vocabulary entry or reading passage looks like.
    files.other.forEach(rel => {
        const roots = other.filter(o => o.file === rel).map(o => o.declaredAs);
        note('parse', rel, null,
             'no shape checks exist for this strand. It is loaded (' +
             (roots.length ? roots.length + ' top-level object(s): ' + roots.join(', ') : 'no top-level objects found') +
             ') and the cross-strand checks walk it, but nothing validates the shape of its items. ' +
             'If it is a new content strand, teach this script its shape.');
    });

    // --- registration ---------------------------------------------------
    const tierKeys = Object.keys(corpus.grammarLessons);
    const levelIds = (Levels && typeof Levels.levelIds === 'function') ? Levels.levelIds() : tierKeys;
    const idOwners = {};
    points.forEach(({ file, point }) => {
        if (!point || typeof point.id !== 'string') return;
        (idOwners[point.id] = idOwners[point.id] || []).push(file);
    });

    registrations.forEach(r => {
        const p = r.point;
        if (!p) return;
        if (!nonEmptyString(p.tier)) {
            err('registration', r.file, p.id, 'no `tier` field, so there is no tier it can claim to belong to');
        } else if (levelIds.indexOf(p.tier) === -1) {
            err('registration', r.file, p.id,
                'tier "' + p.tier + '" is not a js/core/levels.js id (' + levelIds.join(', ') +
                '). canonicalLevel() silently files an unrecognised key under foundation.');
        }
        if (!r.landedIn) {
            err('registration', r.file, p.id,
                '`' + r.declaredAs + '` declares a grammar point but it never reached grammarLessons. ' +
                'The self-registration guard turned a script-order or tier-key mistake into a no-op: ' +
                'the point simply does not appear in the app.');
        } else if (p.tier && r.landedIn !== p.tier) {
            err('registration', r.file, p.id,
                'registers into grammarLessons.' + r.landedIn + ' but its own `tier` says "' + p.tier + '"');
        }
    });
    Object.keys(idOwners).forEach(id => {
        if (idOwners[id].length > 1) {
            err('registration', idOwners[id].join(' + '), id,
                'id "' + id + '" is registered by more than one file. The id is the SRS ref AND the ' +
                'mistake-log key, so two points sharing one splits or overwrites a learner\'s history.');
        }
    });
    // One point per file is the shape that survived (authoring guide, top).
    const perFile = {};
    points.forEach(({ file, point }) => { (perFile[file] = perFile[file] || []).push(point && point.id); });
    Object.keys(perFile).forEach(f => {
        if (f !== files.grammarRegistry && perFile[f].length > 1) {
            note('registration', f, null,
                 'registers ' + perFile[f].length + ' points (' + perFile[f].join(', ') +
                 '). The established shape is one point per file.');
        }
    });

    // --- wiring ---------------------------------------------------------
    // NOT the same invariant as __tests__/unit/assets.test.js. That test walks
    // index.html -> disk and index.html -> STATIC_ASSETS, so it catches "a
    // <script> tag was added and the service worker was not". It cannot see a
    // file that is in NEITHER — which is exactly how data/grammar/be.js sat
    // authored-but-never-loaded (authoring guide §10, last checkbox). This check
    // walks the other way: disk -> index.html -> STATIC_ASSETS.
    const indexHtml = readIfPresent(corpus.root, 'index.html');
    const swSource = readIfPresent(corpus.root, 'service-worker.js');
    const norm = p => String(p).replace(/^\.?\//, '');
    if (indexHtml !== null && swSource !== null) {
        const scriptSrcs = new Set((indexHtml.match(/<script\b[^>]*?src\s*=\s*"([^"]+)"/gi) || [])
            .map(t => norm((t.match(/src\s*=\s*"([^"]+)"/i) || [])[1] || '')));
        const block = swSource.match(/const\s+STATIC_ASSETS\s*=\s*\[([\s\S]*?)\]/);
        const precached = new Set(((block ? block[1] : '').match(/'([^']+)'|"([^"]+)"/g) || [])
            .map(s => norm(s.slice(1, -1))));
        files.all.forEach(rel => {
            if (!scriptSrcs.has(rel)) {
                err('wiring', rel, null,
                    'exists on disk but has no <script src="' + rel + '"> in index.html, so it never ' +
                    'loads and its content does not appear in the app');
            }
            if (!precached.has(rel)) {
                err('wiring', rel, null,
                    'is not in service-worker.js STATIC_ASSETS, so it is missing offline');
            }
        });
    } else {
        note('wiring', '(repo)', null, 'index.html or service-worker.js not found; wiring not checked');
    }

    // --- schema ---------------------------------------------------------
    const instances = collectShapes(points);
    const optional = { practice: declaredOptional(sources[files.grammarRegistry]) };
    const shapeNames = Array.from(new Set(instances.map(i => i.shape)));
    const grammarFiles = Array.from(new Set(instances.map(i => i.file)));
    const schemaBasis = {};

    grammarFiles.forEach(file => {
        shapeNames.forEach(shape => {
            const exp = expectedShape(instances, shape, file, optional);
            schemaBasis[file + '|' + shape] = exp.basis;
            if (exp.vacuous) {
                note('schema', file, shape, 'shape not checked: ' + exp.basis);
                return;
            }
            exp.instances.forEach(i => {
                exp.required.forEach(k => {
                    if (i.keys.indexOf(k) === -1) {
                        err('schema', file, i.where,
                            'missing `' + k + '` on ' + shape + '. Every other instance in the corpus has it; ' +
                            'a missing field renders as nothing at all rather than failing.');
                    }
                });
                i.keys.forEach(k => {
                    if (exp.known.indexOf(k) === -1 &&
                        (optional[shape] || []).indexOf(k) === -1 &&
                        (CONDITIONAL_KEYS[shape] || []).indexOf(k) === -1) {
                        // A note, not an error: a genuinely new field is a legal
                        // authoring act. It is reported because the OTHER half of
                        // adding one is PROJECTORS[type] in js/core/srs.js, and
                        // the srs-projection check below fails hard if that half
                        // was skipped. A typo'd rename shows up here AND as a
                        // missing required key above, so it still fails the build.
                        note('schema', file, i.where,
                             '`' + k + '` on ' + shape + ' appears on no ' + shape + ' in any other file. ' +
                             'If it is a rename, the old name is reported missing above. If it is a new ' +
                             'field, add it to PROJECTORS/DELIBERATE_OMISSIONS in js/core/srs.js and to ' +
                             'the schema comment in data/grammar.js.');
                    }
                });
            });
        });
    });

    // --- cardinality / mode / accept / showDifference / feedback ---------
    points.forEach(({ file, point: p }) => {
        if (!p) return;

        if ((p.contrast || []).length !== 3) {
            err('cardinality', file, p.id,
                'contrast has ' + (p.contrast || []).length + ' pairs; the schema fixes it at exactly 3');
        }
        if ((p.practice || []).length !== 6) {
            err('cardinality', file, p.id,
                'practice has ' + (p.practice || []).length + ' items; the schema fixes it at exactly 6');
        }

        (p.practice || []).forEach((it, idx) => {
            const label = (it && it.id) || p.id + '.practice[' + idx + ']';
            if (!it) return;

            if (it.mode !== 'gap') {
                err('mode-gap', file, label,
                    "mode is " + JSON.stringify(it.mode) + ". app.js renders only 'gap'; anything else is " +
                    'filtered out and replaced with a "this version cannot show yet" note (app.js:8741), ' +
                    'so the item is authored and never seen.');
            }

            const options = Array.isArray(it.options) ? it.options : [];
            const accept = Array.isArray(it.accept) ? it.accept : [];
            const acceptedAnswers = accept.map(a => a && a.answer);
            const reachable = acceptedAnswers.filter(a => options.indexOf(a) !== -1);

            // US-166
            accept.forEach((a, j) => {
                if (!a || options.indexOf(a.answer) !== -1) return;
                let msg = 'accepts ' + JSON.stringify(a.answer) + ' but that answer is not among its options ' +
                          JSON.stringify(options) + '. The grammar practice UI renders one button per ' +
                          '`options` entry and has no typed-input path (app.js:8195, and the review card at ' +
                          'app.js:3553), so the learner can never produce this answer: it is unreachable ' +
                          'content, and `fallbackFeedback` never fires for it either.';
                if (it.showDifferenceOnCorrect && reachable.length <= 1) {
                    msg += ' Worse: `showDifferenceOnCorrect` is set and only ' + reachable.length +
                           ' accepted answer is actually offered, so app.js:8253 tells the learner ' +
                           '"Both answers here are right, and they do not mean the same thing" and then ' +
                           'lists an answer that was never on screen (US-188).';
                }
                err('accept-in-options', file, label, msg);
            });

            // US-188
            const flagged = !!it.showDifferenceOnCorrect;
            if (flagged !== (accept.length > 1)) {
                err('show-difference', file, label,
                    'showDifferenceOnCorrect is ' + JSON.stringify(it.showDifferenceOnCorrect) +
                    ' with ' + accept.length + ' accepted answer(s). It must be set if and only if more ' +
                    'than one answer is accepted: app.js hardcodes "Both answers here are right, and they ' +
                    'do not mean the same thing", so setting it on a single-answer item makes the app ' +
                    'assert a difference that does not exist, and omitting it on a two-answer item leaves ' +
                    'the learner thinking the two are interchangeable.');
            }

            // feedback completeness
            const feedback = Array.isArray(it.feedback) ? it.feedback : [];
            const acceptedSet = new Set(acceptedAnswers);
            const covered = new Set(feedback.map(f => f && f.forAnswer));
            options.forEach(o => {
                if (acceptedSet.has(o)) return;
                if (!covered.has(o)) {
                    err('feedback', file, label,
                        'wrong option ' + JSON.stringify(o) + ' has no `feedback` entry. FR-GRM-2 forbids a ' +
                        'bare verdict, and app.js falls back to `fallbackFeedback`, which is generic — the ' +
                        'learner loses the reason this particular choice was wrong.');
                }
            });
            feedback.forEach((f, j) => {
                const at = label + '.feedback[' + j + ']';
                if (!f) { err('feedback', file, at, 'null feedback entry'); return; }
                if (acceptedSet.has(f.forAnswer)) {
                    err('feedback', file, at,
                        'targets ' + JSON.stringify(f.forAnswer) + ', which the item ACCEPTS. A wrong-answer ' +
                        'explanation attached to a right answer is unreachable at best and contradictory ' +
                        'if the grader ever changes.');
                }
                if (options.indexOf(f.forAnswer) === -1) {
                    err('feedback', file, at,
                        'targets ' + JSON.stringify(f.forAnswer) + ', which is not one of the item\'s options, ' +
                        'so it can never be shown (app.js:8151 matches `forAnswer` against the clicked option)');
                }
                if (!nonEmptyString(f.reason)) {
                    err('feedback', file, at, 'no `reason` — FR-GRM-2 requires why, in the learner\'s terms');
                }
                if (!Array.isArray(f.contrast) || f.contrast.length !== 2 ||
                    !f.contrast.every(nonEmptyString)) {
                    err('feedback', file, at,
                        '`contrast` must be exactly two non-empty strings (what the learner\'s choice would ' +
                        'have meant, against what was meant); got ' + JSON.stringify(f.contrast));
                }
                if (!nonEmptyString(f.retryCue)) {
                    err('feedback', file, at, 'no `retryCue` — the retry half of FR-GRM-2');
                }
            });
            if (!it.fallbackFeedback) {
                err('feedback', file, label,
                    'no `fallbackFeedback`. Without it an answer with no authored entry falls all the way ' +
                    'through to a synthesised reason (app.js:8156).');
            }
        });
    });

    // --- categories -----------------------------------------------------
    // Asked of the module that OWNS the taxonomy, not of a copied list.
    const refs = [];
    const refWhere = {};
    const noteRef = (id, file, where) => {
        if (!id) return;
        refs.push(id);
        (refWhere[id] = refWhere[id] || []).push({ file: file, where: where });
    };
    points.forEach(({ file, point: p }) => {
        if (!p) return;
        noteRef(p.mistakeCategory, file, p.id + '.mistakeCategory');
        (p.practice || []).forEach((it, i) => {
            const label = (it && it.id) || p.id + '.practice[' + i + ']';
            (it && it.feedback || []).forEach((f, j) => noteRef(f && f.logAs, file, label + '.feedback[' + j + '].logAs'));
        });
    });
    pronunciation.forEach(({ file, root }) => {
        ['pairs', 'stress', 'noticing'].forEach(k => (root[k] || []).forEach((i, n) => {
            noteRef(i && i.mistakeCategory, file, k + '[' + n + '] ' + ((i && i.id) || n) + '.mistakeCategory');
        }));
    });
    const unknown = Mistakes.unknownCategories(refs);
    unknown.forEach(id => {
        (refWhere[id] || [{ file: '(unknown)', where: null }]).forEach(w => {
            err('categories', w.file, w.where,
                'category id ' + JSON.stringify(id) + ' is not registered in js/core/mistakes.js. ' +
                'Mistakes.record() rejects it at runtime, so the mistake goes UNLOGGED rather than into ' +
                'the wrong bucket — the diagnosis FR-SRS-3 promises simply loses those occurrences.');
        });
    });

    // --- srs-projection -------------------------------------------------
    // `dropped` and "no shape matched" are always errors: an authored field that
    // no review card can ever see is the silent-data-loss defect this audit
    // exists to surface, and it has landed three times.
    //
    // `phantom` is an error for the two shapes whose projector was validated
    // against complete content (gram, and phon's pair sets), and a NOTE for
    // phon's stress/noticing shapes, where the guide documents fields that
    // legitimately exist on only some items (`notMinimalPairs` on 2 of 15). A
    // check that fires 25 times on documented-intentional content gets turned
    // off, and then it is not there for the case that matters.
    // Phantom notes are aggregated: "10 of 21 stress items lack `exampleSentence`"
    // is one reviewable sentence, where ten identical lines is wallpaper.
    const phantomAgg = {};
    const phantomCounts = {};
    const auditOne = (type, item, file, where, phantomIsError) => {
        const a = SRS.auditProjection(type, item);
        if (!a.shape) {
            err('srs-projection', file, where,
                'matches no PROJECTORS.' + type + ' shape, so SRS._project() stores {} for it and ' +
                'RENDERABLE refuses the record. Nothing about this item survives into a review.');
            return a;
        }
        if (a.dropped.length) {
            err('srs-projection', file, where,
                'PROJECTORS.' + type + '[' + a.shape + '] does not list ' +
                a.dropped.map(f => '`' + f + '`').join(', ') + ', so ' +
                (a.dropped.length === 1 ? 'it is' : 'they are') + ' dropped from every review record. ' +
                'Adding a content field is a two-file change: the content file and js/core/srs.js.');
        }
        if (a.phantom.length) {
            const msg = 'PROJECTORS.' + type + '[' + a.shape + '] declares ' +
                a.phantom.map(f => '`' + f + '`').join(', ') + ', which this item does not have. ' +
                'Either the projector was edited against a guess, or the item is incomplete.';
            if (phantomIsError) err('srs-projection', file, where, msg);
            else {
                const k = file + '|' + type + '|' + a.shape + '|' + a.phantom.slice().sort().join(',');
                (phantomAgg[k] = phantomAgg[k] || {
                    file: file, type: type, shape: a.shape, phantom: a.phantom.slice(), items: []
                }).items.push(where);
            }
        }
        if (phantomCounts[file + '|' + a.shape] === undefined) phantomCounts[file + '|' + a.shape] = 0;
        phantomCounts[file + '|' + a.shape]++;
        return a;
    };

    points.forEach(({ file, point: p }) => { if (p) auditOne('gram', p, file, p.id, true); });
    pronunciation.forEach(({ file, root }) => {
        (root.pairs || []).forEach((s, i) => auditOne('phon', s, file, 'pairs[' + i + '] ' + (s && s.id), true));
        (root.stress || []).forEach((s, i) => auditOne('phon', s, file, 'stress[' + i + '] ' + (s && s.id), false));
        (root.noticing || []).forEach((s, i) => auditOne('phon', s, file, 'noticing[' + i + '] ' + (s && s.id), false));
    });
    Object.keys(phantomAgg).sort().forEach(k => {
        const g = phantomAgg[k];
        const total = phantomCounts[g.file + '|' + g.shape];
        note('srs-projection', g.file, g.shape + '[] x' + g.items.length,
             g.items.length + ' of ' + total + ' ' + g.shape + ' item(s) do not have ' +
             g.phantom.map(f => '`' + f + '`') .join(', ') + ', which PROJECTORS.' + g.type +
             '[' + g.shape + '] declares. Reported and not failed: the authoring guide documents ' +
             'fields that legitimately exist on only some items of these shapes (notMinimalPairs on ' +
             '2 of 15 by design), so a hard failure here would fire on correct content and be turned ' +
             'off. First: ' + g.items.slice(0, 3).join(', ') + (g.items.length > 3 ? ' …' : ''));
    });

    // --- references -----------------------------------------------------
    const allIds = new Set(points.map(x => x.point && x.point.id).filter(Boolean));
    points.forEach(({ file, point: p }) => {
        if (!p) return;
        (p.prerequisites || []).forEach(q => {
            if (!allIds.has(q)) {
                err('references', file, p.id,
                    'prerequisite "' + q + '" is not an authored point id. The field is advisory, but a ' +
                    'dangling id means any ordering built on it silently skips a step.');
            }
        });
        const practiceIds = new Set((p.practice || []).map(i => i && i.id).filter(Boolean));
        const itemIds = (p.review || {}).itemIds;
        if (!nonEmptyArray(itemIds)) {
            err('references', file, p.id,
                'review.itemIds is empty or missing, so RENDERABLE.gram refuses the record and the point ' +
                'is due but never showable (FR-GRM-3)');
        } else {
            itemIds.forEach(q => {
                if (!practiceIds.has(q)) {
                    err('references', file, p.id,
                        'review.itemIds names "' + q + '", which is not one of this point\'s practice item ' +
                        'ids. Dangling review ids are the specific way projecting `review` without ' +
                        '`practice` failed before (js/core/srs.js RENDERABLE.gram).');
                }
            });
        }
        if (p.srsType !== 'gram' || p.srsRef !== p.id || p.srsKey !== 'gram:' + p.id) {
            err('references', file, p.id,
                'the srs triple is inconsistent with `id`: srsType=' + JSON.stringify(p.srsType) +
                ' srsRef=' + JSON.stringify(p.srsRef) + ' srsKey=' + JSON.stringify(p.srsKey) +
                ' for id ' + JSON.stringify(p.id) + '. They are denormalised so they can be grepped and ' +
                'tested; if they disagree the greppable one is a lie.');
        }
    });
    pronunciation.forEach(({ file, root }) => {
        (root.pairs || []).forEach((s, i) => {
            if (!s || !s.id) return;
            if (s.srsType !== 'phon' || s.srsRef !== s.id || s.srsKey !== 'phon:' + s.id) {
                err('references', file, 'pairs[' + i + '] ' + s.id,
                    'the srs triple is inconsistent with `id`: srsType=' + JSON.stringify(s.srsType) +
                    ' srsRef=' + JSON.stringify(s.srsRef) + ' srsKey=' + JSON.stringify(s.srsKey));
            }
        });
    });

    // --- placeholders ---------------------------------------------------
    // Uppercase and word-bounded on purpose: a lowercase "todo" in a learner
    // sentence is English, not a marker.
    const marker = /\b(PLACEHOLDER|TODO|FIXME|TBD|XXX)\b/;
    files.all.forEach(rel => {
        const src = sources[rel];
        if (typeof src !== 'string') return;
        src.split('\n').forEach((line, i) => {
            const m = line.match(marker);
            if (!m) return;
            err('placeholders', rel, 'line ' + (i + 1),
                'contains ' + m[1] + ': ' + line.trim().slice(0, 120));
        });
    });

    // --- pronunciation-pairs --------------------------------------------
    // The exact filter app.js's pronunciationPairs() applies (app.js:8903): a
    // set missing any of these is dropped with a console.warn and simply never
    // appears, which is a content bug nobody would find by using the app.
    const REQUIRED_BY_LOADER = ['phonemes', 'minimalPairs', 'contrastFeature', 'articulatoryCue'];
    pronunciation.forEach(({ file, declaredAs, root }) => {
        if (!Array.isArray(root.pairs)) {
            note('pronunciation-pairs', file, declaredAs, 'declares no `pairs` array');
        }
        (root.pairs || []).forEach((s, i) => {
            const where = 'pairs[' + i + '] ' + ((s && s.id) || '(no id)');
            if (!s || !s.id) {
                err('pronunciation-pairs', file, where,
                    'no `id`, so pronunciationPairs() skips it outright (app.js:8902)');
                return;
            }
            const missing = REQUIRED_BY_LOADER.filter(f => !s[f] || (Array.isArray(s[f]) && !s[f].length));
            if (missing.length) {
                err('pronunciation-pairs', file, where,
                    'missing ' + missing.join(', ') + '. pronunciationPairs() (app.js:8903) DROPS the set ' +
                    'with a console.warn rather than half-drawing it, so the pair silently disappears from ' +
                    'the section — and because the exercise ids are positional, the sets after it move.');
            }
        });
    });

    // --- prosody --------------------------------------------------------
    pronunciation.forEach(({ file, declaredAs, root }) => {
        // FR-PRN-8 forbids imitation for prosody. Checked as a deep scan rather
        // than only over `noticing`, so a new shape carrying the flag is covered
        // without this file having to know the shape exists.
        deepFind(root, 'requiresImitation').forEach(hit => {
            if (hit.value !== false) {
                err('prosody', file, declaredAs + '.' + hit.path,
                    'requiresImitation is ' + JSON.stringify(hit.value) + '. FR-PRN-8 teaches prosody by ' +
                    'noticing, never by imitation: TTS is not trusted to model rhythm (AS-3), so an ' +
                    'imitation task has the learner copying something wrong.');
            }
        });
        (root.noticing || []).forEach((n, i) => {
            const where = 'noticing[' + i + '] ' + ((n && n.id) || i);
            if (!n) { err('prosody', file, where, 'null noticing item'); return; }
            if (n.requiresAudio !== false) {
                err('prosody', file, where,
                    'requiresAudio is ' + JSON.stringify(n.requiresAudio) + '; FR-PRN-8 items must be ' +
                    'answerable without audio (audio may illustrate, via audioOptional)');
            }
            if (n.answerableFrom === 'audio') {
                err('prosody', file, where,
                    "answerableFrom is 'audio'. Only 'text' and 'text-or-audio' are permitted.");
            }
            // The three grading shapes, matching RENDERABLE.phon's `noticing`
            // predicate in js/core/srs.js exactly: an item that satisfies none
            // is stored, counted as due, and then cannot be drawn.
            const byIndex = nonEmptyArray(n.options) && typeof n.correctIndex === 'number';
            const byTokens = nonEmptyArray(n.tokens) && n.correct != null;
            const byItems = nonEmptyArray(n.items);
            if (!(byIndex || byTokens || byItems)) {
                err('prosody', file, where,
                    'matches none of the three grading shapes (options+correctIndex, tokens+correct, or ' +
                    'items[].answer), so there is nothing to grade it against and RENDERABLE.phon refuses ' +
                    'the record: due, and never showable.');
            }
            if (byIndex && (n.correctIndex < 0 || n.correctIndex >= n.options.length)) {
                err('prosody', file, where,
                    'correctIndex ' + n.correctIndex + ' is out of range for ' + n.options.length + ' options');
            }
            if (!nonEmptyString(n.prompt)) {
                err('prosody', file, where, 'no `prompt`; RENDERABLE.phon requires one');
            }
        });
    });

    // --- minimal-pair ---------------------------------------------------
    // CONTENT_AUTHORING_GUIDE §9.1 rule 2 and §10's last pronunciation checkbox:
    // "every `minimalPairs` row has both members transcribed and differs in
    // exactly one phoneme, named in `differsIn` — check the vowels, that is
    // where the trap is." The guide's own rejection table is the defect class:
    // *laugh/lap*, *path/part*, *bath/bat*, *lather/ladder* and *caught/coat*
    // were all proposed, all look like clean consonant contrasts, and all differ
    // in the vowel as well. A pair that differs in two places does not isolate
    // the feature the drill trains, so a learner who gets it wrong learns
    // nothing about why — and the drill's own "the difference is X" feedback is
    // then false.
    //
    // Found by walking for the key rather than by reading `root.pairs`, so a set
    // authored under a new shape is checked without this file knowing the shape.
    //
    // `everyRoot` is every object tree that was loaded, grammar included. Not
    // because a grammar point carries minimal pairs today — none does — but
    // because "where would an author put this next?" is not a question this file
    // gets to answer, and the two checks below cost nothing on a tree that has
    // neither key.
    const everyRoot = pronunciation.concat(other).concat(
        points.filter(p => p.point).map(p => ({
            file: p.file, declaredAs: p.declaredAs || p.point.id, root: p.point
        })));

    let minimalPairRows = 0;
    everyRoot.forEach(({ file, declaredAs, root }) => {
        deepFind(root, 'minimalPairs').forEach(hit => {
            if (!Array.isArray(hit.value)) {
                err('minimal-pair', file, declaredAs + '.' + hit.path,
                    '`minimalPairs` is ' + JSON.stringify(hit.value) + ', not an array');
                return;
            }
            const set = hit.parent || {};
            // The two phonemes the SET claims to contrast, so a row can be
            // caught training a different contrast from the one it sits under.
            const claimed = (Array.isArray(set.phonemes) ? set.phonemes : [])
                .map(p => String(p && p.symbol || '').replace(/[/[\]]/g, ''))
                .filter(Boolean);

            hit.value.forEach((row, i) => {
                minimalPairRows++;
                const where = declaredAs + '.' + hit.path + '[' + i + '] ' +
                              ((row && row.a) || '?') + '/' + ((row && row.b) || '?');
                if (!row || typeof row !== 'object') {
                    err('minimal-pair', file, where, 'null or non-object minimalPairs row');
                    return;
                }
                const missing = ['a', 'b', 'aIpa', 'bIpa', 'differsIn'].filter(k => !nonEmptyString(row[k]));
                if (missing.length) {
                    err('minimal-pair', file, where,
                        'missing ' + missing.map(k => '`' + k + '`').join(', ') + '. Both members must be ' +
                        'transcribed and the differing segment named, or the "differs in exactly one ' +
                        'phoneme" invariant cannot be stated, let alone checked — and the drill\'s ' +
                        '"the difference is X" feedback has nothing truthful to say.');
                    return;
                }

                const cmp = compareIpa(row.aIpa, row.bIpa);
                const segs = JSON.stringify(cmp.a) + ' vs ' + JSON.stringify(cmp.b);
                if (cmp.kind === 'unaligned') {
                    err('minimal-pair', file, where,
                        row.aIpa + ' segments into ' + cmp.a.length + ' phoneme(s) and ' + row.bIpa +
                        ' into ' + cmp.b.length + ' — ' + segs + ' — and they do not align on any single ' +
                        'added or dropped segment either. §9.1 rule 2: a minimal pair differs in EXACTLY ' +
                        'ONE phoneme. Two words differing in two things do not isolate the feature the ' +
                        'drill trains, so a learner who gets it wrong learns nothing about why.');
                    return;
                }
                if (cmp.count !== 1) {
                    err('minimal-pair', file, where,
                        row.aIpa + ' ~ ' + row.bIpa + ' differ in ' + cmp.count +
                        ' segment position(s) (' +
                        cmp.positions.map(p => p + ': ' + cmp.a[p] + '/' + cmp.b[p]).join(', ') +
                        ') — ' + segs + '. §9.1 rule 2: a minimal pair differs in EXACTLY ONE phoneme, ' +
                        'and the trap is the vowel (the guide rejected laugh/lap, path/part, bath/bat, ' +
                        'lather/ladder and caught/coat for exactly this). Record it in the set\'s ' +
                        '`caveats` with its reason rather than deleting it silently.');
                    return;
                }

                // Exactly one segment differs. Now: does `differsIn` say so?
                const at = cmp.positions[0];
                const observed = cmp.kind === 'substitute' ? [cmp.a[at], cmp.b[at]]
                               : cmp.kind === 'insert' ? ['∅', cmp.segment]
                               : [cmp.segment, '∅'];
                const named = String(row.differsIn).split(/\s*(?:\/|~|vs\.?)\s*/);
                const zeroish = s => IPA_ZERO.indexOf(String(s).trim().toLowerCase()) !== -1;
                const namesIt = named.length === 2 &&
                    named.every((s, k) => s === observed[k] ||
                                          (observed[k] === '∅' && zeroish(s)));
                if (named.filter(s => s !== '').length !== 2 && cmp.kind === 'substitute') {
                    note('minimal-pair', file, where,
                         '`differsIn` is ' + JSON.stringify(row.differsIn) + ', which does not read as ' +
                         'two segments separated by "/". The pair itself is fine — it differs in exactly ' +
                         'one segment, ' + observed.join('/') + ' — so this is reported and not failed, ' +
                         'but the field is the one the drill quotes back to the learner.');
                } else if (!namesIt && cmp.kind !== 'substitute') {
                    note('minimal-pair', file, where,
                         'differs by one ' + (cmp.kind === 'insert' ? 'added' : 'dropped') + ' segment ' +
                         cmp.segment + ' (' + segs + '), which satisfies §9.1 rule 2 — an h-dropping or ' +
                         'cluster-reduction pair is a one-phoneme difference. Reported and not failed ' +
                         'because `differsIn` reads ' + JSON.stringify(row.differsIn) + ' and this repo has ' +
                         'no settled notation for "and nothing on the other side"; pick one and use it ' +
                         'everywhere.');
                } else if (!namesIt) {
                    err('minimal-pair', file, where,
                        '`differsIn` says ' + JSON.stringify(row.differsIn) + ' but the segment that ' +
                        'actually differs is ' + observed[0] + '/' + observed[1] + ' (position ' + at +
                        ' of ' + segs + '). The drill names `differsIn` to the learner after a miss, so a ' +
                        'wrong value teaches the wrong contrast on the one screen where the learner is ' +
                        'paying most attention.');
                }
                if (cmp.kind !== 'substitute') return;   // the set's `phonemes` are two sounds
                if (claimed.length === 2 && observed.indexOf(claimed[0]) === -1 &&
                    observed.indexOf(claimed[1]) === -1) {
                    err('minimal-pair', file, where,
                        'contrasts ' + observed.join('/') + ', but the set it sits in is the ' +
                        claimed.join('/') + ' set (from its own `phonemes`). Every row of a set must ' +
                        'train that set\'s contrast: the whole set shares one SRS key and one ' +
                        'articulatoryCue, so a row training a different pair of sounds is scored and ' +
                        'explained as if it were this one.');
                } else if (claimed.length === 2 &&
                           (observed[0] !== claimed[0] || observed[1] !== claimed[1]) &&
                           observed.indexOf(claimed[0]) !== -1 && observed.indexOf(claimed[1]) !== -1) {
                    note('minimal-pair', file, where,
                         'is oriented ' + observed.join('/') + ' while the set\'s `phonemes` are listed ' +
                         claimed.join('/') + '. Reported and not failed — a flipped row is still a valid ' +
                         'minimal pair for the same contrast — but every other row in the corpus puts ' +
                         'the set\'s first phoneme in `a`, and the drill\'s A/B labelling reads off `a`.');
                }
            });
        });
    });

    // --- word-stress ----------------------------------------------------
    // `stressNumbers` is the canonical marking (CONTENT_AUTHORING_GUIDE §9.4):
    // one number per syllable, `1` primary / `2` secondary / `0` unstressed,
    // exactly one `1` per word, and `stressNumbers.length === syllables.length`.
    // `stressIndex` and `display` are DENORMALISED from it — app.js:4004 and
    // renderStressWord() draw the beat from `stressNumbers` and never parse
    // `display` — so when they disagree the app marks one syllable and prints
    // another, and the learner is being taught two different words.
    //
    // Deliberately found by walking every loaded root for the key, not by
    // reading `pronunciation[].stress`. That is not neatness: while this check
    // was being written, word stress was being marked on `vocabularyData` in
    // data.js, on a `stress` sub-object of a shape this file has no schema for.
    // A path-based version would have reported the 21 items in vowels-stress.js
    // as the whole corpus and called it clean.
    let stressMarked = 0;
    const ipaNear = (obj, ancestors) => {
        const chain = [obj].concat(ancestors);
        for (let i = 0; i < chain.length; i++) {
            const from = ['ipa', 'pronunciation', 'phonetic'];
            for (let k = 0; k < from.length; k++) {
                if (nonEmptyString(chain[i][from[k]])) {
                    return { ipa: chain[i][from[k]], field: from[k], level: i };
                }
            }
        }
        return null;
    };

    everyRoot.forEach(({ file, declaredAs, root }) => {
        deepWalk(root, (obj, path, ancestors) => {
            if (!Object.prototype.hasOwnProperty.call(obj, 'stressNumbers')) return;            stressMarked++;
            const label = (obj.id || obj.word ||
                           (ancestors[0] && (ancestors[0].id || ancestors[0].word)) || path);
            const where = declaredAs + '.' + path + ' ' + label;
            const n = obj.stressNumbers;

            if (!nonEmptyArray(n) || !n.every(x => typeof x === 'number')) {
                err('word-stress', file, where,
                    '`stressNumbers` is ' + JSON.stringify(n) + '; it must be a non-empty array of ' +
                    'numbers, one per syllable. app.js:11908 warns and draws no beat at all when it is ' +
                    'missing or empty, so the item renders as a word with no stress marked.');
                return;
            }
            const bad = n.filter(x => x !== 0 && x !== 1 && x !== 2);
            if (bad.length) {
                err('word-stress', file, where,
                    '`stressNumbers` contains ' + JSON.stringify(bad) + '. The convention is ' +
                    'ARPAbet/CMUdict: 1 primary, 2 secondary, 0 unstressed, and renderStressWord() ' +
                    'has a branch for those three and nothing else.');
            }
            const primaries = n.reduce((acc, x, i) => (x === 1 ? acc.concat(i) : acc), []);
            if (primaries.length !== 1) {
                err('word-stress', file, where,
                    '`stressNumbers` ' + JSON.stringify(n) + ' has ' + primaries.length +
                    ' primary (1) mark(s). An English word has exactly one primary stress: with none ' +
                    'the drill has no correct answer to mark, and with two it has two, so a learner ' +
                    'answering correctly is told they are wrong.');
            }
            const primary = primaries.length === 1 ? primaries[0] : n.indexOf(1);

            const syl = obj.syllables;
            if (nonEmptyArray(syl) && syl.length !== n.length) {
                err('word-stress', file, where,
                    '`syllables` has ' + syl.length + ' entries (' + JSON.stringify(syl) +
                    ') but `stressNumbers` has ' + n.length + ' (' + JSON.stringify(n) +
                    '). They are one number per syllable by definition; renderStressWord() zips them, ' +
                    'so the shorter one decides how much of the word is drawn and the rest is dropped ' +
                    'or drawn unmarked.');
            } else if (!nonEmptyArray(syl)) {
                note('word-stress', file, where,
                     'is stress-marked but carries no `syllables` array, so the one-number-per-syllable ' +
                     'invariant cannot be checked against anything and a renderer has nothing to attach ' +
                     'the marks to.');
            }

            if (obj.stressIndex !== undefined && obj.stressIndex !== primary) {
                err('word-stress', file, where,
                    '`stressIndex` is ' + JSON.stringify(obj.stressIndex) + ' but `stressNumbers` ' +
                    JSON.stringify(n) + ' puts the primary at ' + primary + '. §9.4: stressIndex is ' +
                    'DENORMALISED from stressNumbers so a renderer never has to scan — a denormalised ' +
                    'field that disagrees with its source is a lie in whichever of the two the next ' +
                    'reader happens to trust, and for `choose-stress` drills the options are the ' +
                    'syllables themselves, so correctIndex === stressIndex marks the wrong one.');
            }
            if (obj.drill && obj.drill.mode === 'choose-stress' &&
                typeof obj.drill.correctIndex === 'number' && obj.drill.correctIndex !== primary) {
                err('word-stress', file, where,
                    "drill.mode is 'choose-stress' with correctIndex " + obj.drill.correctIndex +
                    ' but the primary stress is on syllable ' + primary + '. §9.4: for this mode the ' +
                    'options ARE the syllables, so the drill marks the learner wrong for picking the ' +
                    'syllable the rest of the item says is stressed.');
            }

            if (nonEmptyString(obj.display)) {
                const parts = String(obj.display).split(/[\s·•.|/-]+/).filter(s => s !== '');
                const shouted = parts.reduce((acc, s, i) =>
                    (/[A-Z]/.test(s) && s === s.toUpperCase() ? acc.concat(i) : acc), []);
                if (parts.length !== n.length) {
                    note('word-stress', file, where,
                         '`display` ' + JSON.stringify(obj.display) + ' splits into ' + parts.length +
                         ' part(s) against ' + n.length + ' syllable(s). Reported and not failed: ' +
                         '`display` is display-only (§9.4, "never parse it") and its separator ' +
                         'convention is not fixed anywhere, so this may be a hyphenation choice rather ' +
                         'than a defect. Worth a look all the same.');
                } else if (shouted.length !== 1 || shouted[0] !== primary) {
                    err('word-stress', file, where,
                        '`display` ' + JSON.stringify(obj.display) + ' capitalises syllable(s) ' +
                        JSON.stringify(shouted) + ' but the primary stress is on ' + primary +
                        '. `display` is the only stress marking a learner actually reads, so when it ' +
                        'disagrees with `stressNumbers` the page marks one beat and prints another.');
                }
            }

            const near = ipaNear(obj, ancestors);
            if (near) {
                const marked = ipaPrimaryStressSyllable(near.ipa);
                if (marked === null && n.length > 1) {
                    err('word-stress', file, where,
                        '`' + near.field + '` is ' + near.ipa + ', which carries no primary stress mark ' +
                        '(`ˈ`) although the word has ' + n.length + ' syllables. §10: stress is marked ' +
                        'on all multi-syllable words — and this item asserts a stress pattern, so the ' +
                        'transcription printed beside it has to agree rather than stay silent.');
                } else if (marked !== null && marked !== primary) {
                    err('word-stress', file, where,
                        '`' + near.field + '` is ' + near.ipa + ', whose `ˈ` falls after ' + marked +
                        ' syllable(s), but `stressNumbers` ' + JSON.stringify(n) + ' puts the primary ' +
                        'on syllable ' + primary + '. The IPA and the marked-up syllables are two ' +
                        'renderings of one fact and they disagree, so one of the two is teaching the ' +
                        'wrong word.');
                }
                const counted = ipaSyllableCount(near.ipa);
                if (counted !== n.length) {
                    note('word-stress', file, where,
                         '`' + near.field + '` ' + near.ipa + ' segments to ' + counted +
                         ' syllable nucleus/nuclei against ' + n.length + ' marked syllable(s). ' +
                         'Reported and not failed on purpose: counting nuclei needs a judgement about ' +
                         'syllabic consonants (/ˈkʌmftəbl/, /ˈhɒspɪtl/) and about whether /aɪə/ in ' +
                         '*quiet* or *fire* is one syllable or two, and English speakers differ. The ' +
                         'primary-stress position above does not need that judgement, which is why ' +
                         'that one fails and this one only asks.');
                }
            }
        });
    });

    // ---------------------------------------------------------------------
    const errors = findings.filter(f => f.severity === 'error');
    const notes = findings.filter(f => f.severity === 'note');
    const byFile = {};
    findings.forEach(f => { (byFile[f.file] = byFile[f.file] || []).push(f); });

    return {
        corpus: corpus,
        findings: findings,
        errors: errors,
        notes: notes,
        byFile: byFile,
        checkIds: Object.keys(CHECKS),
        schemaBasis: schemaBasis,
        summary: {
            filesDiscovered: files.all.length,
            grammarPoints: points.length,
            practiceItems: points.reduce((n, x) => n + ((x.point && x.point.practice || []).length), 0),
            pronunciationRoots: pronunciation.length,
            pairSets: pronunciation.reduce((n, x) => n + ((x.root.pairs || []).length), 0),
            stressItems: pronunciation.reduce((n, x) => n + ((x.root.stress || []).length), 0),
            noticingItems: pronunciation.reduce((n, x) => n + ((x.root.noticing || []).length), 0),
            otherRoots: other.length,
            minimalPairRows: minimalPairRows,
            stressMarkedItems: stressMarked,
            categoryRefs: refs.length,
            errors: errors.length,
            notes: notes.length
        }
    };
}

function readIfPresent(root, rel) {
    try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { return null; }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function formatReport(result) {
    const L = [];
    const s = result.summary;
    L.push('Content validation — US-811 / NFR-13 / FR-CNT-1');
    L.push('='.repeat(72));
    L.push('Discovered ' + s.filesDiscovered + ' data file(s): ' + s.grammarPoints + ' grammar point(s), ' +
           s.practiceItems + ' practice items, ' + s.pairSets + ' pair set(s), ' +
           s.stressItems + ' stress item(s), ' + s.noticingItems + ' prosody item(s), ' +
           s.categoryRefs + ' mistake-category reference(s).');
    L.push('Cross-strand: ' + s.minimalPairRows + ' minimal-pair row(s) segmented, ' +
           s.stressMarkedItems + ' stress-marked item(s) checked across ' +
           (s.pronunciationRoots + s.otherRoots) + ' loaded root(s).');
    L.push('');

    const validatedFiles = result.corpus.files.all.slice();
    Object.keys(result.byFile).forEach(f => { if (validatedFiles.indexOf(f) === -1) validatedFiles.push(f); });

    const width = Math.max.apply(null, validatedFiles.map(f => f.length).concat([30]));
    L.push('PER FILE');
    validatedFiles.forEach(f => {
        const mine = result.byFile[f] || [];
        const e = mine.filter(x => x.severity === 'error');
        const n = mine.filter(x => x.severity === 'note');
        const failed = Array.from(new Set(e.map(x => x.check)));
        let line = '  ' + f + ' '.repeat(Math.max(1, width - f.length + 2));
        if (!e.length) line += 'PASS' + (n.length ? '  (' + n.length + ' note' + (n.length > 1 ? 's' : '') + ')' : '');
        else line += 'FAIL  ' + failed.map(c => c + ' x' + e.filter(x => x.check === c).length).join(', ');
        L.push(line);
    });
    L.push('');

    L.push('CHECKS RUN');
    Object.keys(CHECKS).forEach(id => {
        const e = result.errors.filter(f => f.check === id).length;
        L.push('  [' + (e ? 'FAIL' : ' ok ') + '] ' + id + ' — ' + CHECKS[id] + (e ? '  (' + e + ')' : ''));
    });
    L.push('');

    if (result.errors.length) {
        L.push('ERRORS (' + result.errors.length + ')');
        L.push('-'.repeat(72));
        result.errors.forEach((f, i) => {
            L.push((i + 1) + '. [' + f.check + '] ' + f.file + (f.where ? '  ->  ' + f.where : ''));
            wrap(f.message, 72 - 5).forEach(l => L.push('     ' + l));
        });
        L.push('');
    }
    if (result.notes.length) {
        L.push('NOTES (' + result.notes.length + ', do not fail the build)');
        L.push('-'.repeat(72));
        result.notes.forEach((f, i) => {
            L.push((i + 1) + '. [' + f.check + '] ' + f.file + (f.where ? '  ->  ' + f.where : ''));
            wrap(f.message, 72 - 5).forEach(l => L.push('     ' + l));
        });
        L.push('');
    }
    L.push(result.errors.length
        ? 'RESULT: FAIL — ' + result.errors.length + ' error(s) in ' +
          new Set(result.errors.map(f => f.file)).size + ' file(s).'
        : 'RESULT: PASS — no errors.');
    return L.join('\n');
}

function wrap(text, width) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    words.forEach(w => {
        if (!cur.length) cur = w;
        else if ((cur + ' ' + w).length <= width) cur += ' ' + w;
        else { lines.push(cur); cur = w; }
    });
    if (cur.length) lines.push(cur);
    return lines;
}

// ---------------------------------------------------------------------------
module.exports = {
    ROOT: ROOT,
    CHECKS: CHECKS,
    discover: discover,
    topLevelConsts: topLevelConsts,
    lexical: lexical,
    loadCorpus: loadCorpus,
    collectShapes: collectShapes,
    declaredOptional: declaredOptional,
    expectedShape: expectedShape,
    deepFind: deepFind,
    deepWalk: deepWalk,
    segmentIpa: segmentIpa,
    compareIpa: compareIpa,
    ipaSyllableCount: ipaSyllableCount,
    ipaPrimaryStressSyllable: ipaPrimaryStressSyllable,
    validate: validate,
    formatReport: formatReport
};

if (require.main === module) {
    const argv = process.argv.slice(2);
    let result;
    try {
        result = validate();
    } catch (e) {
        process.stderr.write('Content validation could not run: ' + (e && e.stack || e) + '\n');
        process.exit(2);
    }
    if (argv.indexOf('--json') !== -1) {
        process.stdout.write(JSON.stringify({
            summary: result.summary,
            errors: result.errors.map(f => ({ check: f.check, file: f.file, where: f.where, message: f.message })),
            notes: result.notes.map(f => ({ check: f.check, file: f.file, where: f.where, message: f.message }))
        }, null, 2) + '\n');
    } else {
        process.stdout.write(formatReport(result) + '\n');
    }
    process.exit(result.errors.length ? 1 : 0);
}
