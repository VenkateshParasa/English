/**
 * Spaced Repetition System (SRS)
 * -------------------------------------------------------------
 * A self-contained, offline-first review scheduler based on a
 * simplified SM-2 algorithm. It tracks per-item review state in
 * localStorage and surfaces the items that are due for review.
 *
 * No backend required — everything persists locally in the browser.
 *
 * ITEM TYPES (docs/TEACHING_METHODOLOGY.md §3). Records are keyed `type:ref`:
 *   vocab:happy · gram:present-perfect · phon:iː-ɪ · coll:make-a-decision
 * Records written before this existed were keyed by bare lowercase word; they
 * are migrated to `vocab:<word>` by js/core/migrations.js, without loss.
 *
 * Depends on js/core/migrations.js (which depends on js/core/levels.js) for the
 * key normaliser and the legacy-key migration. index.html loads both first; if
 * a script-order mistake removes them, this module degrades to an inline copy of
 * the normaliser and simply does not migrate (it never rewrites blind).
 *
 * Public API (window.SRS):
 *   SRS.init()                           -> load + migrate, explicitly, once
 *   SRS.schedule(item, correct, opts)    -> updates an item's schedule
 *   SRS.scheduleItem(type, ref, data, correct, opts) -> typed form
 *   SRS.selfReport(item, achieved)       -> records a self-judged outcome
 *   SRS.getDueWords(limit)               -> [wordObj, ...] vocab due now, capped
 *   SRS.getAllDueWords()                 -> every due vocab wordObj, uncapped
 *   SRS.getDue(type, opts)               -> [{type, shape, ref, key, data, ...}, ...] capped
 *   SRS.countDue(type)                   -> every due AND renderable item
 *   SRS.dueCount(type)                   -> capped actionable count (the badge)
 *   SRS.totalDueCount(type)              -> honest total that is due
 *   SRS.deferredCount(type)              -> due items waiting behind the cap
 *   SRS.stats(type) -> { total, due, actionable, queued, deferred, learned, lapses, selfReported }
 *   SRS.getRecord(item)                  -> raw record or null
 *   SRS.isSelfReported(item)             -> was the last outcome self-judged?
 *   SRS.reset()                          -> clears all SRS data
 *   SRS.DAILY_REVIEW_CAP                 -> the daily queue cap (20)
 *   SRS.INTERVAL_STEPS / SRS.MAX_INTERVAL_DAYS -> the interval ladder (FR-SRS-2)
 *   SRS.intervalForReps(reps)            -> the rung a given rep count sits on
 *   SRS.PROJECTORS / SRS.RENDERABLE      -> per-type payload + renderability
 *   SRS.SHAPES                           -> { type: [shapeName, ...] }, the card
 *                                           kinds a review surface must handle
 *   SRS.shapeOf(type, item)              -> which shape an item/payload is
 *   SRS.projectorFields(type, item)      -> the field list that item projects through
 *   SRS.auditProjection(type, item)      -> { shape, projected, dropped, phantom, ignored }
 *                                           what a projector keeps and loses for
 *                                           one item. Development-time warnings
 *                                           for `dropped` are emitted automatically
 *                                           under Node/localhost; force them with
 *                                           `SRS_PROJECTION_WARNINGS = true|false`.
 *
 * THE INTERVAL LADDER (FR-SRS-2 / OQ-10, decided 2026-09-10). Successes advance
 * along the FIXED ladder 1 -> 3 -> 7 -> 16 -> 35 days and HOLD at 35, which is
 * what FR-SRS-2 and TEACHING_METHODOLOGY.md §3 have always specified. The old
 * `interval * ease` rule produced 1 -> 3 -> 8 -> 22 -> 62 -> 174 -> 487 and never
 * capped, because `ease` caps at 2.8 but the product does not; `ease` is retained
 * as a queue-ORDER tie-break only. The change is FORWARD-ONLY: no stored record
 * is recomputed and no `due` date is rewritten. See _applyGraded().
 */
(function (global) {
    'use strict';

    // In the browser, index.html loads migrations.js (and levels.js) before this
    // file. Under Node (Jest) a test may require() this module on its own, so
    // pull the dependency in ourselves rather than failing on a missing global.
    if (typeof module !== 'undefined' && module.exports &&
        typeof global.Migrations === 'undefined') {
        require('./migrations.js');
    }

    const STORAGE_KEY = 'srsData';
    const DAY_MS = 24 * 60 * 60 * 1000;

    // SM-2 tuning constants
    const MIN_EASE = 1.3;
    const MAX_EASE = 2.8;
    const DEFAULT_EASE = 2.5;

    const DEFAULT_TYPE = 'vocab';
    const TYPES = ['vocab', 'gram', 'phon', 'coll'];

    /**
     * Per-type payload projection.
     *
     * Bounded on purpose: `rec.data` goes to localStorage, so copying an
     * author's whole object risks a DOM node, a blob or a cycle ending up in
     * storage. Extensible on purpose too — it is a registry, not a hardcoded
     * whitelist.
     *
     * ⚠️  ADDING A FIELD TO A CONTENT ITEM REQUIRES ADDING IT HERE, or it is
     * silently dropped from every review card. `vocab` is deliberately the exact
     * six fields the old inline whitelist copied, so this change moves no
     * vocabulary bytes. See docs/CONTENT_AUTHORING_GUIDE.md.
     *
     * That warning has now been missed twice on `gram` alone, so it is no longer
     * only a comment: _project() audits every item against its projector and
     * warns about unlisted fields in development. See auditProjection below.
     *
     * ─────────────────────────────────────────────────────────────────────────
     * ONE TYPE IS NOT ALWAYS ONE SHAPE (US-167)
     * ─────────────────────────────────────────────────────────────────────────
     * A flat field list per type was a third silent-loss bug waiting to happen,
     * and the content to trigger it already shipped. `phon` is THREE authored
     * shapes with three disjoint key sets:
     *
     *   pair      data/pronunciation/vowels-stress.js + consonants.js `pairs[]`
     *             8 records: phon:iː-ɪ · æ-e · ɒ-əʊ · v-w · θ-t · ð-d · z-s · f-p
     *   stress    vowels-stress.js `stress[]` — 21 items, ALL under the single
     *             key `phon:word-stress`, each carrying its own `drill`
     *   noticing  vowels-stress.js `noticing[]` — 15 items under `phon:rhythm`,
     *             `phon:final-vowel` and `phon:cluster` (FR-PRN-8: noticing and
     *             discrimination, never imitation)
     *
     * Projected through the vowel-pair list, a stress or noticing item stored
     * exactly `{ id, code, mistakeCategory }` — the three keys the shapes happen
     * to share — and RENDERABLE said yes to it. That is an empty review card
     * offered as a real one, which is the `gram`-dropped-`rule` defect again.
     *
     * So a projector entry is EITHER a flat `[field, ...]` list (one shape,
     * always matched) OR an ordered list of `{ shape, when, fields }` variants,
     * first match wins. Two rules for a variant:
     *   1. `when` may only test fields the variant itself PROJECTS. shapeOf()
     *      is then answerable from a stored payload as well as from authored
     *      content, which is what lets RENDERABLE and getDue() agree about
     *      which card a record is.
     *   2. `when` predicates must be mutually exclusive across a type's
     *      variants. They are checked in order and the first match wins, so an
     *      overlap silently prefers the earlier one.
     * An item matching NO variant projects to `{}`, is not renderable, and
     * warns — loudly and by name — rather than rendering blank.
     */
    const PROJECTORS = {
        vocab: ['word', 'pronunciation', 'definition', 'example', 'quiz', 'difficulty'],
        // Matched to the authored schema in data/grammar.js, not guessed. The
        // earlier list projected `explanation`, `example` and `difficulty`, none
        // of which exist on a grammar point, while dropping `rule` — the one
        // field a wrong answer MUST show. TEACHING_METHODOLOGY.md §2 requires a
        // reason, a contrast and a retry on every wrong grammar answer, so
        // `rule`, `explain`, `contrast` and `practice` are all load-bearing.
        // `tier` carries the level (grammar has no `difficulty` field).
        //
        // `review` and `cefr` were the two remaining gaps flagged in that file's
        // own "SRS PROJECTION CONTRACT" note:
        //  - `review` is { rulePrompt, itemIds } and IS the review card. FR-GRM-3
        //    asks for a due grammar point to be reviewable "without re-teaching
        //    the whole lesson"; without this field there is no such thing as a
        //    grammar review, only the lesson again. `itemIds` indexes into
        //    `practice`, so the two must be projected together or the ids on a
        //    stored record dangle.
        //  - `cefr` is display-only, but it is what a card labels the point with.
        // NOT projected, deliberately: `notice`, `decide`, `whyItMatters`,
        // `spokenNote`, `commonErrors` and `prerequisites` are first-teaching
        // fields, and a review by definition is not the first teaching;
        // `syllabusNumber` and `tags` are authoring metadata; `srsType`/`srsRef`/
        // `srsKey` are already on the record as type/ref/key. All are still in
        // data/grammar.js, so a lesson view reads them from content directly.
        gram:  ['id', 'title', 'tier', 'cefr', 'rule', 'explain', 'contrast',
                'practice', 'review', 'produce', 'caveats', 'l1Notes',
                'mistakeCategory'],
        phon: [
            // ── pair ──────────────────────────────────────────────────────
            // Validated 2026-09-10 against data/pronunciation/vowels-stress.js —
            // the first real phon content to exist — and re-validated against
            // data/pronunciation/consonants.js, whose `pairs[]` uses the same key
            // set and key order by design. The earlier guess had no phantom
            // fields, but it dropped 16 authored ones including `articulatoryCue`,
            // `feelChecks`, `mirrorCheck`, `discrimination` and `productionGate` —
            // i.e. all of the actual teaching. A phoneme review card without the
            // articulatory cue is useless: PROGRESS.md §6.aa rule 2 makes the
            // feelable cue load-bearing precisely because a learner who cannot yet
            // HEAR a contrast can still check their mouth. Same class of defect as
            // `gram` omitting `rule`; auditProjection() is what surfaced it.
            {
                shape: 'pair',
                when: function (s) {
                    return s.minimalPairs !== undefined || s.phonemes !== undefined ||
                           s.contrastFeature !== undefined || s.pair !== undefined;
                },
                fields: ['id', 'pair', 'label', 'code', 'phonemes', 'contrastFeature',
                         'articulatoryCue', 'mirrorCheck', 'feelChecks', 'lengthNote',
                         'minimalPairs', 'examples', 'sentences', 'textOnlyFallback',
                         'discrimination', 'productionGate', 'caveats',
                         'mistakeCategory', 'difficulty']
            },
            // ── stress ────────────────────────────────────────────────────
            // FR-PRN-3 word stress. `drill` is the review card ({ mode, prompt,
            // options, correctIndex, answerableFromText, whyWrong }); everything
            // else is what the card shows around it. `stressNumbers` +
            // `stressIndex` are how a renderer marks primary/secondary/reduced
            // WITHOUT parsing the `display` string, so all three travel together.
            // `ameNote` and `reductionNote` are teaching, not metadata, and are
            // projected for the same reason `gram.rule` is.
            //
            // NOTE FOR THE SURFACE, not a projector problem: all 21 items share
            // ONE key, `phon:word-stress`, so one record holds whichever item was
            // last answered. Per-word accuracy is not an SRS fact and must not be
            // derived from `reps`/`lapses` (methodology principle 3) — it needs its
            // own counter, as app.js:80 already does for pairs.
            {
                shape: 'stress',
                when: function (s) {
                    return s.syllables !== undefined || s.stressIndex !== undefined ||
                           s.stressNumbers !== undefined;
                },
                fields: ['id', 'code', 'word', 'pos', 'ipa', 'ameNote', 'syllables',
                         'stressNumbers', 'stressIndex', 'display', 'reducedSyllables',
                         'reductionNote', 'family', 'familyRule', 'stressMinimalPair',
                         'exampleSentence', 'drill', 'mistakeCategory']
            },
            // ── noticing ──────────────────────────────────────────────────
            // FR-PRN-8 prosody: rhythm (T-P1), final-vowel epenthesis (T-P2) and
            // cluster breaking (T-P3), taught by noticing rather than imitation.
            // `requiresImitation` / `requiresAudio` / `answerableFrom` /
            // `audioOptional` are POLICY, not metadata: a review card that ignores
            // `requiresImitation: false` and asks the learner to copy a TTS model
            // breaks FR-PRN-8 and AS-3 at once, so they are projected and a card
            // must honour them. Grading is `correctIndex`, or `tokens` + `correct`
            // for the multi-select modes, or per-row `items[].answer` — hence all
            // three, plus the explicit `null`s the content writes to keep the key
            // set uniform across items. `notMinimalPairs` / `notMinimalPairsWhy`
            // exist on 2 of the 15 and are a hard "do not feed this to the
            // minimal-pair drill" instruction.
            {
                shape: 'noticing',
                when: function (s) {
                    return s.target !== undefined && s.mode !== undefined;
                },
                fields: ['id', 'code', 'target', 'mode', 'requiresImitation',
                         'requiresAudio', 'answerableFrom', 'audioOptional', 'teach',
                         'prompt', 'text', 'tokens', 'options', 'correctIndex',
                         'correct', 'items', 'answer', 'why', 'feelCheck', 'l1',
                         'notMinimalPairs', 'notMinimalPairsWhy', 'mistakeCategory']
            }
        ],
        // Still unverified: data/collocations.js does not exist yet. When it
        // lands, audit a real chunk before trusting this list — that is exactly
        // how the two `gram` defects and the `phon` one were found.
        coll:  ['id', 'chunk', 'meaning', 'example', 'practice', 'difficulty']
    };

    /**
     * Normalised view of a projector entry: always an ordered variant list.
     * A flat field list becomes one variant named after the type, matching
     * everything, so callers never branch on the registry's two spellings.
     */
    const _variantCache = Object.create(null);
    function variantsFor(type) {
        if (_variantCache[type] && _variantCache[type].src === PROJECTORS[type]) {
            return _variantCache[type].list;
        }
        const entry = PROJECTORS[type];
        let list;
        if (!entry) {
            list = [];
        } else if (typeof entry[0] === 'string' || entry.length === 0) {
            list = [{ shape: type, when: function () { return true; }, fields: entry }];
        } else {
            list = entry;
        }
        _variantCache[type] = { src: entry, list: list };
        return list;
    }

    /** Which variant of `type` does this item (or stored payload) match? */
    function variantOf(type, source) {
        if (!source || typeof source !== 'object') return null;
        const list = variantsFor(type);
        for (let i = 0; i < list.length; i++) {
            let hit = false;
            try { hit = !!list[i].when(source); } catch (e) { hit = false; }
            if (hit) return list[i];
        }
        return null;
    }

    /** { vocab: ['vocab'], phon: ['pair','stress','noticing'], ... } */
    function shapeNames() {
        const out = {};
        TYPES.forEach(function (t) {
            out[t] = variantsFor(t).map(function (v) { return v.shape; });
        });
        return out;
    }

    /**
     * Fields that identify or route an item rather than describe it. schedule()
     * lifts them onto the record itself as `type` / `ref` / `key`, so a projector
     * that does not list them is complete, not lossy — the audit below must not
     * cry wolf about them or the warning stops being read.
     */
    const NON_CONTENT_FIELDS = ['srsType', 'srsRef', 'srsKey', 'type', 'ref', 'key'];

    /**
     * Fields a projector drops ON PURPOSE, per type — or, where a type has more
     * than one shape, per shape.
     *
     * Without this the audit contradicts the PROJECTORS comment directly above:
     * that comment lists eight grammar fields as deliberately unprojected
     * (first-teaching material and authoring metadata), and the audit then warned
     * about all eight on the very first grammar item scheduled. A warning that
     * fires on the documented, correct call is noise, and noise is how the real
     * signal — an author's new field silently vanishing — gets ignored. Same
     * reasoning as NON_CONTENT_FIELDS: the audit must not cry wolf.
     *
     * Adding a field here is a deliberate statement that a review card does not
     * need it. Anything NOT listed here and not projected still warns.
     */
    const DELIBERATE_OMISSIONS = {
        vocab: [],
        gram:  ['notice', 'decide', 'whyItMatters', 'spokenNote', 'commonErrors',
                'prerequisites', 'syllabusNumber', 'tags'],
        phon:  {
            // `priority` is authoring/sequencing metadata (REQUIREMENTS.md §3.1
            // M/S rating); `audio` is clip PLANNING — `clipIds` are proposed
            // filenames and nothing asserts a clip exists, so a card must not
            // read them off a record. `ttsUse` per minimalPairs row travels
            // inside `minimalPairs`, which IS projected.
            pair:     ['priority', 'audio', 'tags'],
            stress:   ['tags'],
            noticing: []
        },
        coll:  []
    };

    /** The deliberate-omission list for one type+shape. */
    function omissionsFor(type, shape) {
        const entry = DELIBERATE_OMISSIONS[type];
        if (!entry) return [];
        if (Array.isArray(entry)) return entry;
        return entry[shape] || [];
    }

    /**
     * Per-type "can the learner actually be shown this right now" predicate,
     * running on `rec.data` — the PROJECTED payload, not the authored item.
     *
     * `vocab` reproduces the old `data.quiz` filter EXACTLY, because the
     * vocabulary review card *is* a quiz and a record without one cannot be
     * rendered.
     *
     * The other three used to be `d => !!d`, i.e. "any payload at all". That was
     * defensible while no non-vocab content existed and there was nothing to
     * accidentally admit. It is not defensible now: `{ id, code,
     * mistakeCategory }` is what a word-stress item stored under the vowel-pair
     * field list, and `!!d` called it renderable, so getDue('phon') handed a
     * caller a record with no drill, no word and no prompt and said "draw this".
     *
     * So each predicate now asks for the fields ITS OWN CARD needs, and nothing
     * more — a gate on renderability, not a content validator:
     *   gram   FR-GRM-3 wants a due point reviewable "without re-teaching the
     *          whole lesson": the one-sentence `rule` (methodology §2), the
     *          `review.rulePrompt`, and at least one `review.itemIds` entry that
     *          actually resolves in `practice`. Dangling ids are the specific way
     *          projecting `review` without `practice` failed before.
     *   phon   per shape — a pair needs gradable discrimination items or the
     *          text-only fallback; a stress item needs its `drill`; a noticing
     *          item needs a prompt and something to grade against.
     *   coll   a chunk plus a meaning or an example. Unverified, like its
     *          projector, because data/collocations.js does not exist yet.
     *
     * WHAT HAPPENS TO A RECORD STORED UNDER AN OLD PROJECTOR. It stops being
     * offered and starts being REPORTED: `stats().due` still counts it,
     * `stats().actionable` and `dueCount()` do not, and the gap between those two
     * numbers is the existing, documented "due but not showable" signal
     * (js/core/session.js reports the same gap as `heldBack`). Nothing is
     * deleted, no due date moves, and the record heals itself the next time
     * schedule()/scheduleItem() is called with the real content item, because
     * that rewrites `rec.data` through the corrected projector. Showing an empty
     * card would be the alternative, and a blank review is worse than a review
     * the app admits it cannot draw yet.
     *
     * An unrecognised type is NOT renderable — a record from a newer release
     * must not be poured into a card this build does not know how to draw. Same
     * for a payload matching no shape of a known type.
     */
    function _nonEmptyArray(v) {
        return Array.isArray(v) && v.length > 0;
    }

    function _nonEmptyString(v) {
        return typeof v === 'string' && v.trim() !== '';
    }

    const RENDERABLE = {
        vocab: d => !!(d && d.quiz),
        gram: function (d) {
            if (!d || !_nonEmptyString(d.rule)) return false;
            if (!d.review || !_nonEmptyString(d.review.rulePrompt)) return false;
            if (!_nonEmptyArray(d.review.itemIds) || !_nonEmptyArray(d.practice)) return false;
            const ids = d.practice.map(function (p) { return p && p.id; });
            return d.review.itemIds.some(function (id) { return ids.indexOf(id) !== -1; });
        },
        phon: function (d) {
            const variant = variantOf('phon', d);
            if (!variant) return false;
            switch (variant.shape) {
                case 'pair':
                    // FR-PRN-1 discrimination, or the AS-3 text-only fallback
                    // that needs no audio at all and is still gradable.
                    return _nonEmptyArray(d.minimalPairs) || !!d.textOnlyFallback;
                case 'stress':
                    // FR-PRN-3: the drill is the card. `answerableFromText` is
                    // not required — a card may speak the word — but options and
                    // a correct index are, or there is nothing to answer.
                    return !!(d.drill && _nonEmptyArray(d.drill.options) &&
                              typeof d.drill.correctIndex === 'number');
                case 'noticing':
                    // FR-PRN-8: three grading shapes, any one of which is enough.
                    return _nonEmptyString(d.prompt) && (
                        _nonEmptyArray(d.items) ||
                        (_nonEmptyArray(d.options) && typeof d.correctIndex === 'number') ||
                        (_nonEmptyArray(d.tokens) && d.correct != null)
                    );
                default:
                    return false;
            }
        },
        coll: d => !!(d && _nonEmptyString(d.chunk) && (d.meaning || d.example))
    };

    // docs/TEACHING_METHODOLOGY.md §3 / FR-SRS-4: "Do not let the queue exceed
    // ~20 items a day — an unmanageable backlog is the most common reason
    // learners abandon SRS apps. Cap the daily queue and defer the rest."
    // The cap is a *presentation* limit only: nothing is dropped or rescheduled,
    // the overflow simply is not offered yet (see _dueRecords / getDueWords).
    const DAILY_REVIEW_CAP = 20;

    // ------------------------------------------------------------------
    // The interval ladder — FR-SRS-2, decided by OQ-10 on 2026-09-10
    // ------------------------------------------------------------------
    //
    // FR-SRS-2 and TEACHING_METHODOLOGY.md §3 have specified 1 → 3 → 7 → 16 → 35
    // since they were written. The code shipped `Math.round(interval * ease)`
    // from the third success on, which yields 1 → 3 → 8 → 22 → 62 and then
    // 174 → 487 → 1,364. OQ-10 resolves the discrepancy in favour of the fixed
    // ladder, for the three reasons recorded there:
    //
    //   1. it is what the pedagogy contract says, and a methodology document the
    //      scheduler ignores is worse than no document;
    //   2. `ease` caps at 2.8 but the PRODUCT caps at nothing, so seven right
    //      answers put an item 16 months out and eight put it nearly four years
    //      out. On a four-option quiz a run that long is reachable by luck, and a
    //      self-study learner has no "I actually forgot this" control to pull it
    //      back with. A schedule nobody can predict is a schedule nobody trusts;
    //   3. a fixed ladder is testable without simulating ease, which is what
    //      FR-SRS-2's own acceptance criterion ("verified by unit test") asks for.
    //
    // PAST THE LAST RUNG the interval HOLDS at 35 days rather than multiplying,
    // so the cap is real and MAX_INTERVAL_DAYS is a fact about the app rather
    // than an aspiration. `ease` is kept — it still rises on success and falls on
    // a lapse — but only as a queue-ORDER tie-break in _dueRecords(), so per-item
    // difficulty still influences WHICH of two equally overdue items comes first
    // without deciding when either returns.
    //
    // The rung is a function of `reps` ALONE, not of the previous interval. That
    // is deliberate and slightly more than the doc asked for: the old rule
    // compounded, so one bad `interval` value poisoned every interval after it,
    // and a record with an implausible interval could never recover. Now it does,
    // on the next graded answer.
    //
    // MIGRATION: forward-only, exactly as REQUIREMENTS.md §6.7 requires — nothing
    // recomputes history, no stored record is rewritten, no `due` date moves. See
    // the long note in _applyGraded() for what happens to a record already
    // sitting on `interval: 62`.
    const INTERVAL_STEPS = [1, 3, 7, 16, 35];
    const MAX_INTERVAL_DAYS = INTERVAL_STEPS[INTERVAL_STEPS.length - 1];

    /**
     * The rung a given number of successful reps sits on.
     * reps <= 1 -> the first rung (1 day); reps beyond the ladder holds at 35.
     * Non-numeric or negative reps read as the first rung, which is the safe
     * direction: sooner, never later.
     */
    function intervalForReps(reps) {
        const n = (typeof reps === 'number' && isFinite(reps)) ? Math.floor(reps) : 0;
        const i = Math.max(1, Math.min(INTERVAL_STEPS.length, n));
        return INTERVAL_STEPS[i - 1];
    }

    // FR-SRS-5: a self-reported outcome may bring an item back sooner, so the
    // soonest it may ask for is one day — the same rung a graded lapse falls to
    // (§3: "a lapse resets to 1 day"), i.e. the ladder's first rung. It is never
    // allowed to push an item out.
    const SELF_REPORT_INTERVAL_DAYS = INTERVAL_STEPS[0];

    // Single source of truth for key normalisation lives in migrations.js, so
    // the migration and the runtime can never disagree about what key a word
    // gets. The fallback is an exact copy for the degraded case where a script
    // reorder leaves migrations.js unloaded.
    function normRef(ref) {
        if (global.Migrations && typeof global.Migrations.srsRef === 'function') {
            return global.Migrations.srsRef(ref);
        }
        return String(ref == null ? '' : ref).trim().toLowerCase().replace(/\s+/g, '-');
    }

    function typedKey(type, ref) {
        if (global.Migrations && typeof global.Migrations.srsTypedKey === 'function') {
            return global.Migrations.srsTypedKey(type, ref);
        }
        const t = String(type == null ? '' : type).trim().toLowerCase();
        const r = normRef(ref);
        if (!r) return '';
        return (TYPES.indexOf(t) === -1 ? DEFAULT_TYPE : t) + ':' + r;
    }

    // ------------------------------------------------------------------
    // Projection audit (development only)
    // ------------------------------------------------------------------
    //
    // WHY THIS EXISTS AT ALL. The projector is the right design — rec.data goes
    // to localStorage and copying an author's whole object risks a DOM node, a
    // blob or a cycle in storage — but it fails in the one way a whitelist
    // always fails: SILENTLY, and at content-authoring time rather than at code
    // time. `gram` has now been wrong twice. Once it projected three fields that
    // do not exist on a grammar point while dropping `rule`, the single field a
    // wrong answer must show; then it dropped `review`, without which FR-GRM-3
    // has no review card at all. Neither threw, neither failed a test, and both
    // were found by a human reading two files side by side. `phon` and `coll`
    // are still unverified guesses and will fail the same way when their
    // content lands.
    //
    // A comment saying "remember to update this" has already been tried; it is
    // the comment directly above PROJECTORS and it did not work. So the audit is
    // machinery instead: any field an author puts on an item that its projector
    // does not list produces a console warning, naming the type, the field and
    // the file to edit.
    //
    // Constraints it is built to respect, since a diagnostic that misbehaves is
    // worse than none:
    //   - It NEVER throws and never changes what is stored. The projector's
    //     output is byte-identical with warnings on or off.
    //   - It is off in production. A learner must not see console noise, and
    //     the key scan must not run on their device.
    //   - It warns ONCE per type+field. A dictionary payload carrying twenty
    //     unused API fields must not print twenty lines per review, or the
    //     warning trains people to ignore the console — which is the same
    //     silence it was built to break.
    //   - Identity fields are excluded (NON_CONTENT_FIELDS) — see above.
    const _warnedFields = Object.create(null);

    /**
     * Is this a development context? Node/Jest and localhost, plus an explicit
     * override (`SRS_PROJECTION_WARNINGS = true/false`) for anyone who wants to
     * force it either way — including a CI content check that wants them on.
     */
    function projectionWarningsEnabled() {
        if (typeof global.SRS_PROJECTION_WARNINGS === 'boolean') {
            return global.SRS_PROJECTION_WARNINGS;
        }
        // Under Node (Jest, a content lint script) always on: a dropped field is
        // a content bug, and the test run is exactly where it should surface.
        if (typeof module !== 'undefined' && module.exports) return true;
        try {
            const host = (global.location && global.location.hostname) || '';
            return host === 'localhost' || host === '127.0.0.1' ||
                   host === '[::1]' || host === '' || /\.local$/.test(host);
        } catch (e) {
            return false;                      // no location: assume production
        }
    }

    const SRS = {
        records: {},

        // Exposed so the UI and the tests reference the policy constant rather
        // than repeating the number 20.
        DAILY_REVIEW_CAP: DAILY_REVIEW_CAP,
        INTERVAL_STEPS: INTERVAL_STEPS.slice(),
        MAX_INTERVAL_DAYS: MAX_INTERVAL_DAYS,
        TYPES: TYPES,
        PROJECTORS: PROJECTORS,
        RENDERABLE: RENDERABLE,
        NON_CONTENT_FIELDS: NON_CONTENT_FIELDS,
        DELIBERATE_OMISSIONS: DELIBERATE_OMISSIONS,

        /**
         * The card kinds a review surface has to be able to draw, per type:
         *   { vocab: ['vocab'], gram: ['gram'],
         *     phon: ['pair', 'stress', 'noticing'], coll: ['coll'] }
         * app.js switches on `(item.type, item.shape)` from getDue(); this is the
         * exhaustive list, read from the registry rather than copied, so adding a
         * shape cannot leave a stale duplicate behind. A getter, not a snapshot,
         * so it stays true if PROJECTORS is edited at runtime (a test doing that
         * is exactly how the audit's own regression test works).
         */
        get SHAPES() { return shapeNames(); },

        /** The rung a given rep count sits on. See INTERVAL_STEPS. */
        intervalForReps: intervalForReps,

        /**
         * Which shape of `type` this item is — an authored content item or a
         * payload already on a record, both answered the same way (a variant's
         * `when` may only test fields it projects). Returns null when no shape
         * matches, which is the honest answer for content this build predates.
         */
        shapeOf(type, source) {
            const t = TYPES.indexOf(type) === -1 ? DEFAULT_TYPE : type;
            const variant = variantOf(t, source);
            return variant ? variant.shape : null;
        },

        /** The field list `source` would actually be projected through. */
        projectorFields(type, source) {
            const t = TYPES.indexOf(type) === -1 ? DEFAULT_TYPE : type;
            const variant = variantOf(t, source);
            return variant ? variant.fields.slice() : [];
        },

        /**
         * Normalize a reference into a stable, case-insensitive key fragment.
         * Kept as the BARE ref (no type prefix) because it is also how legacy
         * records were keyed, so it stays the lookup of last resort.
         */
        _key(word) {
            return normRef(word);
        },

        /** `type:ref` — the key a record is actually stored under. */
        _typedKey(type, ref) {
            return typedKey(type, ref);
        },

        /**
         * Accept any of the three shapes a caller may hold and return a common
         * `{ type, ref, data }`:
         *   - a bare string                -> vocab, no payload
         *   - `{ srsType, srsRef, ... }`   -> an explicitly typed item
         *   - `{ word, ... }`              -> legacy vocabulary object
         *
         * Anything else returns null. The old code fell through to
         * `String(obj)` === "[object object]", which collapsed every grammar
         * point and phoneme pair onto ONE shared record — silent data loss.
         * Refusing an item we cannot identify is the honest alternative.
         */
        _normalizeItem(item, typeHint) {
            if (item == null) return null;

            if (typeof item === 'string' || typeof item === 'number') {
                const ref = normRef(item);
                return ref ? { type: typeHint || DEFAULT_TYPE, ref: ref, data: null } : null;
            }

            if (typeof item !== 'object') return null;

            const hasWord = typeof item.word === 'string';
            const explicitRef = (item.srsRef !== undefined && item.srsRef !== null)
                ? item.srsRef
                : (hasWord ? item.word : null);

            if (explicitRef === null || normRef(explicitRef) === '') return null;

            // `item.type` is only trusted when the item is NOT a plain vocabulary
            // object. A rich vocabulary entry may well carry `type: 'noun'` (part
            // of speech) or, worse, a value that happens to collide with one of
            // OUR type names, and reading that as an SRS type would file the word
            // under the wrong strand.
            const explicitType = item.srsType || typeHint ||
                ((item.srsRef !== undefined || !hasWord) ? item.type : undefined);

            return {
                type: TYPES.indexOf(String(explicitType).toLowerCase()) === -1
                    ? DEFAULT_TYPE
                    : String(explicitType).toLowerCase(),
                ref: normRef(explicitRef),
                data: item
            };
        },

        /** The type a stored record belongs to: its own field, then its key. */
        _recordType(rec, key) {
            const own = rec && rec.type;
            if (typeof own === 'string' && TYPES.indexOf(own) !== -1) return own;
            const colon = typeof key === 'string' ? key.indexOf(':') : -1;
            if (colon > 0) {
                const prefix = key.slice(0, colon);
                if (TYPES.indexOf(prefix) !== -1) return prefix;
                return prefix;              // unknown type: reported honestly
            }
            // A bare key is a pre-migration vocabulary record.
            return DEFAULT_TYPE;
        },

        /** Is this record showable to the learner right now? */
        _isRenderable(rec, key) {
            const type = this._recordType(rec, key);
            const predicate = RENDERABLE[type];
            if (!predicate) return false;   // unknown type: fail closed
            return predicate(rec && rec.data);
        },

        /** Current time in ms. Wrapped so it is easy to stub in tests. */
        _now() {
            return Date.now();
        },

        /**
         * Load persisted records from localStorage, migrating legacy bare-word
         * keys on the way in.
         *
         * The migration is delegated to js/core/migrations.js and is gated on
         * SHAPE, not on a counter, so calling load() twice is a no-op. If
         * migrations.js is not present the records are used exactly as found —
         * this never rewrites storage blind.
         */
        load() {
            let parsed = null;
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                parsed = raw ? JSON.parse(raw) : null;
            } catch (e) {
                // Corrupt or unavailable storage — start clean rather than crash.
                this.records = {};
                return this.records;
            }

            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                this.records = {};
                return this.records;
            }

            if (global.Migrations && typeof global.Migrations.migrateSrsData === 'function') {
                try {
                    const result = global.Migrations.migrateSrsData(parsed);
                    this.records = result.records || {};
                    this._migrated = true;
                    // Persist so the rewrite happens once rather than on every
                    // load. Only when something actually changed, so a normal
                    // load performs no write at all.
                    if (result.changed) this.save();
                } catch (e) {
                    // A failed migration must not cost the learner their data:
                    // use it as found and leave storage untouched.
                    this.records = parsed;
                    if (global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                        global.AppErrorHandler.logError(e, 'SRS migrate');
                    }
                }
            } else {
                this.records = parsed;
            }

            return this.records;
        },

        /**
         * Explicit bootstrap. srs.js also calls load() at parse time so that a
         * caller which never calls init() still works, but that parse-time call
         * has a hard ordering dependency on migrations.js having been loaded
         * first. init() is the supported entry point: call it from bootstrap and
         * the migration is guaranteed to have run whatever the script order.
         *
         * Idempotent, and it will not clobber in-memory state that has already
         * been migrated.
         */
        init() {
            if (!this._migrated) this.load();
            return this.records;
        },


        /** Persist records to localStorage. Silent on failure (private mode, quota). */
        save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
            } catch (e) {
                if (global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                    global.AppErrorHandler.logError(e, 'SRS save');
                }
            }
        },

        /**
         * Resolve any of the three ways a caller might name an item to the key
         * it is actually stored under, WITHOUT creating anything:
         *   1. an exact key            (`vocab:happy`)
         *   2. the typed key for a ref (`happy`  -> `vocab:happy`)
         *   3. the bare legacy key     (`happy`) — a record that predates the
         *      typed-key migration and has not been through load() yet.
         * Returns null when the item is not in the store.
         */
        _findKey(item, type) {
            const norm = this._normalizeItem(item, type);
            const ref = norm ? norm.ref : normRef(item);
            if (!ref) return null;

            if (typeof item === 'string' && Object.prototype.hasOwnProperty.call(this.records, item)) {
                return item;
            }
            const typed = typedKey(norm ? norm.type : (type || DEFAULT_TYPE), ref);
            if (typed && Object.prototype.hasOwnProperty.call(this.records, typed)) return typed;
            if (Object.prototype.hasOwnProperty.call(this.records, ref)) return ref;
            return null;
        },

        /**
         * Move a legacy bare-keyed record onto its typed key, in place.
         *
         * The bulk migration in migrations.js does this at load time; this is the
         * write-path safety net for a record that reached memory without it —
         * a script-order mistake, a direct `SRS.records = {...}` assignment, or
         * an import that bypassed load(). Without it, writing to `vocab:happy`
         * while `happy` still existed would fork one item into two schedules.
         */
        _adoptLegacy(typed, ref) {
            if (typed === ref) return;
            if (Object.prototype.hasOwnProperty.call(this.records, typed)) return;
            if (!Object.prototype.hasOwnProperty.call(this.records, ref)) return;
            this.records[typed] = this.records[ref];
            delete this.records[ref];
        },

        getRecord(item, type) {
            const key = this._findKey(item, type);
            return key ? (this.records[key] || null) : null;
        },

        /**
         * Was the most recent recorded outcome for this item self-judged?
         * Records written before FR-SRS-5 carry no flag at all; the absent
         * field reads as `false` — "not self-reported" — which is correct,
         * because every outcome written by the old code was a graded one.
         */
        isSelfReported(item, type) {
            const rec = this.getRecord(item, type);
            return !!(rec && rec.selfReported);
        },

        /**
         * Update an item's review schedule based on the answer.
         *
         * @param {Object|string} item - A vocabulary object ({ word, pronunciation,
         *        definition, example, quiz, ... }), a bare string, or an explicitly
         *        typed item ({ srsType: 'gram', srsRef: 'present-perfect', ... }).
         *        The two-argument vocabulary call is unchanged, so every existing
         *        call site keeps its exact behaviour.
         * @param {boolean} correct - Whether the learner answered correctly.
         * @param {Object} [opts] - { selfReported: true } for a learner- or
         *        recogniser-judged outcome. Omitting it means "graded", so every
         *        existing two-argument call site keeps its exact behaviour.
         *        { type: 'gram' } sets the type for an untyped item.
         * @returns {Object|null} The updated record, or null for an unkeyable item.
         */
        schedule(item, correct, opts) {
            const norm = this._normalizeItem(item, opts && opts.type);
            if (!norm) return null;

            const key = typedKey(norm.type, norm.ref);
            if (!key) return null;

            const selfReported = !!(opts && opts.selfReported);

            // Adopt a pre-migration record for this same item rather than
            // starting a second schedule alongside it.
            this._adoptLegacy(key, norm.ref);

            const now = this._now();
            const rec = this.records[key] || {
                key: key,
                type: norm.type,
                ref: norm.ref,
                // Kept for backwards compatibility: older code and the export
                // format both read `rec.word`.
                word: (norm.data && norm.data.word) || norm.ref,
                reps: 0,
                interval: 0,
                ease: DEFAULT_EASE,
                lapses: 0,
                due: now,
                lastReviewed: null,
                createdAt: now
            };

            // Backfill identity on a record that predates it (migrated or adopted).
            if (rec.key === undefined) rec.key = key;
            if (rec.type === undefined) rec.type = norm.type;
            if (rec.ref === undefined) rec.ref = norm.ref;

            // Keep the item's payload so review works fully offline without
            // re-hitting the dictionary API. Projected per type — see PROJECTORS.
            if (norm.data && typeof norm.data === 'object') {
                rec.data = this._project(norm.type, norm.data);
            }

            if (selfReported) {
                this._applySelfReport(rec, correct, now);
            } else {
                this._applyGraded(rec, correct, now);
            }

            this.records[key] = rec;
            this.save();
            return rec;
        },

        /**
         * Explicitly typed form, for the non-vocabulary callers that arrive with
         * a type and a reference rather than a word object.
         */
        scheduleItem(type, ref, data, correct, opts) {
            const payload = Object.assign({}, data || {}, { srsType: type, srsRef: ref });
            return this.schedule(payload, correct, opts);
        },

        /**
         * Copy the fields PROJECTORS declares for this type AND SHAPE, and
         * nothing else. A declared-but-absent field is copied as `undefined` for
         * `vocab` only, so the stored shape is byte-for-byte what the old inline
         * whitelist produced; other types omit absent fields.
         *
         * An item matching no shape projects to `{}`. That is not a silent
         * failure: _warnUnprojected names every authored field as dropped, and
         * RENDERABLE refuses the record, so a new content shape shows up as a
         * loud console warning and an item the app admits it cannot draw —
         * instead of an empty card the learner is asked to answer.
         */
        _project(type, source) {
            const t = TYPES.indexOf(type) === -1 ? DEFAULT_TYPE : type;
            const variant = variantOf(t, source);
            const fields = variant ? variant.fields : [];
            const out = {};
            fields.forEach(function (f) {
                if (t === DEFAULT_TYPE || source[f] !== undefined) out[f] = source[f];
            });
            // Diagnostic only, after the fact: it cannot alter `out`, and it is
            // wrapped because a review must survive anything the audit does.
            try {
                this._warnUnprojected(t, source);
            } catch (e) { /* never let a diagnostic break a review */ }
            return out;
        },

        /**
         * What this type's projector does and does not carry, for a given item.
         * Pure — no logging, no storage, safe in production and in a test.
         *
         *   shape      which PROJECTORS variant matched (null = none, and then
         *              everything the author wrote is `dropped`, on purpose)
         *   projected  fields the review card will see
         *   dropped    fields the AUTHOR wrote that the card will never see
         *              (the silent-data-loss bug, made visible)
         *   phantom    fields the projector DECLARES that this item does not
         *              have (the `explanation`/`example`/`difficulty` class of
         *              mistake: a list edited against a guess, not content)
         *   omitted    fields dropped deliberately (DELIBERATE_OMISSIONS)
         *   ignored    identity fields, listed so the output is complete
         *
         * @param {string} type - one of SRS.TYPES.
         * @param {Object} source - an authored content item.
         */
        auditProjection(type, source) {
            const t = TYPES.indexOf(type) === -1 ? DEFAULT_TYPE : type;
            const variant = variantOf(t, source);
            const fields = variant ? variant.fields : [];
            const out = {
                type: t,
                shape: variant ? variant.shape : null,
                fields: fields.slice(),
                projected: [], dropped: [], phantom: [], ignored: [], omitted: []
            };
            if (!source || typeof source !== 'object') return out;

            const omit = omissionsFor(t, out.shape);
            Object.keys(source).forEach(function (k) {
                if (NON_CONTENT_FIELDS.indexOf(k) !== -1) out.ignored.push(k);
                else if (fields.indexOf(k) !== -1) out.projected.push(k);
                else if (omit.indexOf(k) !== -1) out.omitted.push(k);
                else if (source[k] !== undefined) out.dropped.push(k);
            });
            fields.forEach(function (f) {
                if (source[f] === undefined) out.phantom.push(f);
            });
            return out;
        },

        /**
         * Development-time warning for fields an author wrote that this type's
         * projector drops. Once per type+shape+field, never throws. See the block
         * comment above _warnedFields for why this is machinery and not a note.
         */
        _warnUnprojected(type, source) {
            if (!projectionWarningsEnabled()) return;
            if (!source || typeof source !== 'object') return;
            if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
            try {
                const audit = this.auditProjection(type, source);
                const label = 'PROJECTORS.' + audit.type +
                    (audit.shape && audit.shape !== audit.type ? '[' + audit.shape + ']' : '');

                // No shape matched at all: a whole content shape is unknown to
                // this build, which is a bigger statement than "one field is
                // missing" and deserves its own line. Warned once per type+id so
                // a 21-item section prints once, not 21 times.
                if (!audit.shape) {
                    const seen = audit.type + '.<no-shape>';
                    if (_warnedFields[seen]) return;
                    _warnedFields[seen] = true;
                    console.warn(
                        '[SRS] No PROJECTORS.' + audit.type + ' shape matches this item (' +
                        (source.id || source.srsRef || source.word || 'unnamed') +
                        '), so nothing is stored for it and no review card can be ' +
                        'drawn. Add a { shape, when, fields } variant to ' +
                        'PROJECTORS.' + audit.type + ' in js/core/srs.js.'
                    );
                    return;
                }

                const fresh = audit.dropped.filter(function (f) {
                    const seen = audit.type + '.' + audit.shape + '.' + f;
                    if (_warnedFields[seen]) return false;
                    _warnedFields[seen] = true;
                    return true;
                });
                if (!fresh.length) return;
                console.warn(
                    '[SRS] ' + label + ' does not list ' +
                    fresh.map(function (f) { return '`' + f + '`'; }).join(', ') +
                    ', so ' + (fresh.length === 1 ? 'it is' : 'they are') +
                    ' dropped from every ' + audit.type + ' review card. ' +
                    'Add to ' + label + ' in js/core/srs.js, or ' +
                    'remove from the content if the card genuinely does not need it.'
                );
            } catch (e) {
                /* a diagnostic must never break a review */
            }
        },

        /** Forget which fields have already been warned about. For tests. */
        _resetProjectionWarnings() {
            Object.keys(_warnedFields).forEach(function (k) { delete _warnedFields[k]; });
        },


        /**
         * Record an outcome the learner (or a speech recogniser) judged for
         * themselves — FR-PRN-4/FR-PRN-5 self-comparison, "not yet" buttons,
         * read-aloud misses. Sugar for schedule(word, achieved, { selfReported: true }).
         */
        selfReport(wordObj, achieved) {
            return this.schedule(wordObj, achieved, { selfReported: true });
        },

        /**
         * Graded outcome: the app knows the answer, so this is evidence.
         *
         * FR-SRS-2 / OQ-10: successes walk the FIXED ladder in INTERVAL_STEPS and
         * hold at its last rung. The rung comes from `reps` alone, never from the
         * previous interval, so nothing compounds. `ease` still moves — it is the
         * queue-order tie-break in _dueRecords() — but it no longer decides when
         * an item comes back.
         *
         * WHAT HAPPENS TO A RECORD ALREADY ON `interval: 62`
         * ---------------------------------------------------------------------
         * Nothing, until the learner next answers it. The change is forward-only,
         * as REQUIREMENTS.md §6.7 requires: load() does not rewrite it,
         * migrations.js has no entry for it, and its `due` date is left exactly
         * where the old rule put it. It is not yanked forward (which would drop a
         * surprise backlog on the learner) and not pushed out.
         *
         * When it does come due and is answered:
         *   - answered RIGHT: `reps` was 5 for a 62-day record (1, 3, 8, 22, 62
         *     are reps 1–5), so the 6th success reads rung min(6, 5) = 5 → 35
         *     days. The interval DROPS from 62 to 35 and stays there. That is the
         *     cap arriving, which is the whole point of the decision.
         *   - answered WRONG: `interval = 0`, `due = now`, unchanged from before.
         *   - self-reported "not yet": `Math.min(interval, 1)` → 1, unchanged.
         * At no point is 62 read as anything other than a number of days, so a
         * stored 62 is stale, never nonsense — and it self-corrects on the next
         * answer instead of compounding to 174.
         *
         * A record with a large interval but a small or missing `reps` (a legacy
         * or hand-edited record) resolves to an EARLIER rung, i.e. sooner. That is
         * the safe direction: the scheduler under-claims rather than over-claims
         * how well the item is known (methodology principle 3).
         *
         * RESIDUAL, stated rather than hidden: a record whose `due` the old rule
         * already pushed 174+ days out keeps that date. Forward-only means we do
         * not touch it. Pulling those in would be a one-time migration in
         * js/core/migrations.js — deliberately not done here, because rewriting
         * due dates is a data change and this is a rule change.
         */
        _applyGraded(rec, correct, now) {
            if (correct) {
                rec.reps += 1;
                rec.interval = intervalForReps(rec.reps);
                rec.ease = Math.min(MAX_EASE, rec.ease + 0.1);
                rec.due = now + rec.interval * DAY_MS;
            } else {
                // Lapse: reset progress and re-queue within the current session.
                rec.reps = 0;
                rec.interval = 0;
                rec.lapses += 1;
                rec.ease = Math.max(MIN_EASE, rec.ease - 0.2);
                rec.due = now; // due immediately, stays in the queue
            }

            rec.lastReviewed = now;
            // The last outcome on this record is a graded one again.
            rec.selfReported = false;
            return rec;
        },

        /**
         * Self-reported outcome (FR-SRS-5): "may schedule but never certify".
         *
         * Deliberately touches only `due` and `interval`, and only ever downwards:
         *  - `reps`, `ease` and `lapses` are the verified-evidence fields. reps
         *    drives stats().learned and ease drives the ladder, so a learner
         *    marking their own work — in either direction — must not move them.
         *    That is what makes stats() ungameable by self-report.
         *  - a self-reported success changes *nothing* about the schedule. It is
         *    not evidence, so it may not buy a longer interval (methodology
         *    principle 3: never claim more accuracy than we have).
         *  - a self-reported failure pulls the item back to at most one day out.
         *    Math.min means it can only ever move the due date earlier, so no
         *    self-report can silently extend an interval or defer an item that
         *    is already due.
         *  - `lastReviewed` is left alone: no graded review happened, and nothing
         *    downstream may mistake a self-report for one. The timestamp lives in
         *    `lastSelfReported` instead.
         */
        _applySelfReport(rec, achieved, now) {
            rec.selfReported = true;
            rec.selfReports = (rec.selfReports || 0) + 1;
            rec.lastSelfReported = now;

            if (!achieved) {
                // Back sooner, never later. interval is lowered too, so the next
                // graded success multiplies from the shortened rung rather than
                // from an interval the learner has just said they cannot hold.
                rec.interval = Math.min(
                    typeof rec.interval === 'number' ? rec.interval : 0,
                    SELF_REPORT_INTERVAL_DAYS
                );
                rec.due = Math.min(rec.due, now + SELF_REPORT_INTERVAL_DAYS * DAY_MS);
            }
            return rec;
        },

        /**
         * Every due, renderable record, most-overdue first. Internal: callers get
         * payload copies from getDueWords / getAllDueWords / getDue, never records.
         *
         * Order is oldest-due-first, tie-broken by most lapses and then by lowest
         * ease. Pedagogically: the most overdue item is the one closest to being
         * forgotten outright, so it has the most retention to gain from a review
         * right now, and recovering a decaying memory is worth more than topping
         * up a fresh one. It is also starvation-free — a newly due item can never
         * queue ahead of an older one, so a backlog drains in order instead of
         * stranding the same items behind the cap forever. Among items that
         * came due at the same moment the most-lapsed goes first: repeated
         * failure is the app's own evidence that the item is the least secure.
         *
         * Ease is the THIRD key, added with the FR-SRS-2 / OQ-10 ladder decision:
         * the fixed ladder deliberately gives every item the same intervals, and
         * this is where per-item difficulty is retained instead — lower ease means
         * a harder item, so it goes first among items that are otherwise equal.
         * It is a tie-break only, so the two existing ordering guarantees are
         * untouched; a missing ease reads as DEFAULT_EASE so an old record is not
         * sorted as if it were the easiest or hardest thing in the queue.
         *
         * Renderability is per type now, not a hardcoded `data.quiz` test, which
         * is what lets grammar points and phoneme pairs be represented at all.
         * For `vocab` the predicate is exactly the old test, so the vocabulary
         * review flow is unchanged.
         *
         * @param {string} [type] - restrict to one item type; omit for all types.
         */
        _dueRecords(type) {
            const now = this._now();
            const self = this;
            return Object.keys(this.records)
                .map(k => ({ key: k, rec: this.records[k] }))
                .filter(function (e) {
                    const r = e.rec;
                    if (!r || !(r.due <= now)) return false;
                    if (type && self._recordType(r, e.key) !== type) return false;
                    return self._isRenderable(r, e.key);
                })
                .map(e => e.rec)
                .sort((a, b) =>
                    (a.due - b.due) ||
                    ((b.lapses || 0) - (a.lapses || 0)) ||
                    ((typeof a.ease === 'number' ? a.ease : DEFAULT_EASE) -
                     (typeof b.ease === 'number' ? b.ease : DEFAULT_EASE)));
        },

        /** Normalize a cap argument: a non-negative finite number, else the policy cap. */
        _cap(limit) {
            return (typeof limit === 'number' && isFinite(limit) && limit >= 0)
                ? limit
                : DAILY_REVIEW_CAP;
        },

        /**
         * Round-robin the due records of every type into one capped list.
         *
         * A global oldest-first sort would happily fill all 20 slots with
         * vocabulary and starve grammar and pronunciation, defeating
         * docs/CURRICULUM.md §3 ("every session touches at least three strands").
         * Interleave instead, in the declared TYPES order so the sequence is
         * stable across calls. Within each type the order is still strict
         * oldest-due-first, so nothing starves inside a strand either.
         *
         * Returns RECORDS, not payloads, so dueCount() can count the queue
         * without building a copy of every payload just to read `.length`.
         */
        _interleavedDue(cap) {
            const self = this;
            const queues = TYPES.map(t => self._dueRecords(t)).filter(q => q.length > 0);
            const out = [];
            let i = 0;
            while (out.length < cap) {
                let placed = false;
                for (let q = 0; q < queues.length; q++) {
                    if (i < queues[q].length) {
                        out.push(queues[q][i]);
                        placed = true;
                        if (out.length >= cap) break;
                    }
                }
                if (!placed) break;
                i++;
            }
            return out;
        },

        /**
         * The general, typed review queue: renderable, oldest-due-first, capped.
         * THIS is what a typed review surface walks. Vocabulary-only callers keep
         * using getDueWords(), whose shape is unchanged.
         *
         * Each entry is everything a card needs to be chosen and drawn without a
         * second lookup:
         *
         *   type          'vocab' | 'gram' | 'phon' | 'coll'
         *   shape         WHICH card of that type — 'pair' | 'stress' | 'noticing'
         *                 for `phon`, otherwise the type's own name. `type` alone
         *                 is not enough: a due `phon:word-stress` record and a due
         *                 `phon:iː-ɪ` record are different screens, and picking the
         *                 wrong one is how the empty-card bug happened. Never null
         *                 here — an unmatched shape is not renderable, so it never
         *                 reaches this list.
         *   ref / key     the item's identity, for scheduling the answer back
         *                 (`SRS.scheduleItem(type, ref, contentItem, correct)`)
         *                 and for looking the full content item up by id.
         *   data          the projected payload: a COPY, so a caller cannot
         *                 mutate a record by editing the card it was given.
         *   due, interval, reps, lapses, selfReported
         *                 read-only schedule context, so a card can say "you have
         *                 missed this 3 times" without reaching into `records`.
         *                 `selfReported` matters for FR-SRS-5: a card must not
         *                 present a self-judged outcome as verified.
         *
         * `data` is deliberately the projected payload and not the authored item.
         * A surface that wants a field a projector does not carry (grammar's
         * `notice`, a pair's `audio.clipIds`) must read it from data/ by
         * `data.id` — that is what the id is for, and it is why nothing in
         * PROJECTORS needs to grow to support a lesson view.
         *
         * @param {string} [type] - one of SRS.TYPES, or null/undefined for all.
         * @param {Object} [opts] - { limit } to override the cap.
         */
        getDue(type, opts) {
            const cap = this._cap(opts && opts.limit);
            const self = this;
            const wrap = function (r) {
                const t = self._recordType(r, r && r.key);
                const data = Object.assign({}, r && r.data);
                return {
                    type: t,
                    shape: self.shapeOf(t, data),
                    ref: r && r.ref !== undefined ? r.ref : normRef(r && r.word),
                    key: r && r.key,
                    data: data,
                    due: r && r.due,
                    interval: r && r.interval,
                    reps: r && r.reps,
                    lapses: (r && r.lapses) || 0,
                    selfReported: !!(r && r.selfReported)
                };
            };

            if (type) return this._dueRecords(type).slice(0, cap).map(wrap);
            return this._interleavedDue(cap).map(wrap);
        },

        /**
         * Words to review now: most-overdue first, capped at DAILY_REVIEW_CAP.
         * Only records that carry a full word payload are returned.
         *
         * Overflow is *deferred, not dropped*: no record is touched here, so a
         * deferred item keeps its due date in the past, stays due tomorrow, and
         * sorts even further to the front then. Deferring cannot extend an
         * interval because deferring writes nothing at all.
         *
         * @param {number} [limit] - Override the cap (tests, "review more"
         *        flows). Must be a non-negative number; anything else uses the cap.
         */
        getDueWords(limit) {
            return this._dueRecords(DEFAULT_TYPE)
                .slice(0, this._cap(limit))
                .map(r => Object.assign({}, r.data));
        },

        /** Every due word, ignoring the cap. For dashboards and diagnostics. */
        getAllDueWords() {
            return this._dueRecords(DEFAULT_TYPE).map(r => Object.assign({}, r.data));
        },

        /**
         * The number of items the learner will actually be asked to review, i.e.
         * the size of the capped queue. This is deliberately the capped figure,
         * not the honest backlog: the badge it feeds ("Review Due (N)") is a
         * promise about how long the session is, and it must equal
         * getDueWords().length or pressing it contradicts it. Showing "347" is
         * exactly the wall of work FR-SRS-4 exists to prevent. The honest total
         * is still available, unrounded, via totalDueCount() / deferredCount()
         * / stats().
         *
         * STILL DEFAULTS TO `vocab`, and this commit deliberately does not move it.
         *
         * The scheduler is now able to SERVE a typed queue — getDue() carries a
         * `shape` and RENDERABLE gates on the fields each card needs — but
         * app.js:2364 `startReview()` still walks getDueWords(), which is
         * vocabulary-only, and app.js is not this change's to edit. Moving the
         * default now would make the badge count grammar points and phoneme pairs
         * that pressing the button cannot show: "Review Due (7)" opening a
         * 3-item session. That is the same class of trust bug as a false
         * "Perfect!" and methodology §3 forbids it as squarely.
         *
         * So the ordering is: the surface lands first, the badge follows. THE
         * EXACT CHANGE, for whoever lands the app.js half — in the same commit,
         * not before it:
         *   1. `startReview()` walks `SRS.getDue(null)` and switches on
         *      `(item.type, item.shape)`;
         *   2. this line becomes `arguments.length === 0 ? null : type`;
         *   3. `js/core/session.js` SURFACES['srs.review'].types grows from
         *      `['vocab']` to the types that screen can now draw, which is what
         *      stops countsHeldBack() reporting them as held back;
         *   4. the badge assertion in __tests__/unit/srs.test.js
         *      ("keeps the badge equal to the session review mode actually
         *      walks") is updated in the same commit.
         * Until all four happen together, `vocab` is the honest default.
         *
         * @param {string|null} [type] - a type, or null for every type.
         */
        dueCount(type) {
            const t = arguments.length === 0 ? DEFAULT_TYPE : type;
            return t ? this._dueRecords(t).slice(0, DAILY_REVIEW_CAP).length
                     : this._interleavedDue(DAILY_REVIEW_CAP).length;
        },

        /**
         * Every due AND renderable item, cap ignored. "Actionable": work that
         * exists and could be shown, as opposed to stats().due which counts work
         * that exists at all (including records with no showable payload).
         */
        countDue(type) {
            return this._dueRecords(type).length;
        },

        /** The honest total that is due now, cap ignored. Alias of countDue. */
        totalDueCount(type) {
            return this.countDue(type);
        },

        /** How many due items are waiting behind the cap. */
        deferredCount(type) {
            return Math.max(0, this.totalDueCount(type) - DAILY_REVIEW_CAP);
        },

        /**
         * `dueCount() <= actionable <= due` holds by construction: the badge is a
         * capped subset of the actionable queue, which is a subset of everything
         * that is due.
         *
         * @param {string} [type] - restrict every figure to one item type.
         */
        stats(type) {
            const now = this._now();
            const self = this;
            const keys = Object.keys(this.records).filter(function (k) {
                return !type || self._recordType(self.records[k], k) === type;
            });
            const all = keys.map(k => this.records[k]).filter(r => !!r);
            return {
                total: all.length,
                due: all.filter(r => r.due <= now).length,
                // Due and showable. The gap between this and `due` is records
                // whose payload cannot be rendered — never silently hidden.
                actionable: this.countDue(type),
                // What today's session actually holds, and what it is holding back.
                queued: this.dueCount(type || DEFAULT_TYPE),
                deferred: this.deferredCount(type),
                // reps only ever advances on a graded success, so "learned"
                // cannot be reached by self-report. Same for lapses.
                learned: all.filter(r => r.reps >= 3).length,
                lapses: all.reduce((sum, r) => sum + (r.lapses || 0), 0),
                // Reported separately and never folded into learned/lapses.
                selfReported: all.reduce((sum, r) => sum + (r.selfReports || 0), 0)
            };
        },

        reset() {
            this.records = {};
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (e) { /* ignore */ }
        }
    };

    // Parse-time load, kept so a caller that never reaches init() still works.
    // SRS.init() is the supported entry point — see its comment.
    SRS.load();

    // Expose globally (matches the pattern of the other core modules) and
    // support CommonJS for the test suite.
    global.SRS = SRS;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SRS;
    }
// `globalThis`, not `this`. Under CommonJS a bare top-level `this` is
// `module.exports`, so the old `: this` fallback meant that when Jest or a node
// script require()d this file, `global.Migrations` / `global.AppErrorHandler`
// resolved against an empty object and were silently always undefined — i.e. the
// legacy-key migration would never have run under test. levels.js and
// migrations.js already use globalThis; this brings srs.js in line.
})(typeof window !== 'undefined' ? window : globalThis);
