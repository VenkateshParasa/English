/**
 * Session sequencer — "Start today's session" (US-801 / FR-SES-1)
 * -------------------------------------------------------------
 * docs/CURRICULUM.md §4 asks for a learner to be handed a 20-minute session
 * rather than a menu of eight sections, and says a button that walks that path
 * "would raise completion more than any new content". FR-SES-1 turns that into
 * acceptance criteria: ~20 minutes across ≥3 strands, one of which is Speaking,
 * no menu choices, ending with a spoken production.
 *
 * This file is the PLANNING half only. No DOM, no rendering, no audio, no SRS
 * writes. It answers four questions and nothing else:
 *   - what should the learner do next, and in what order  (build)
 *   - where are they in that order                        (current/progress)
 *   - what could this build NOT include, and why          (omitted/shortfall)
 *   - where were they when the phone rang                 (load/resume)
 *
 * WHY IT PLANS AGAINST SURFACES AND NOT AGAINST THE CURRICULUM
 * §4's shape names five activities. Three of them have nothing that can draw
 * them: there is no listening comprehension question (FR-LST-1), no shadowing
 * mode (FR-SPK-8) and no free-production prompt surface (FR-SPK-3). A sequencer
 * that plans "4 min: listen → comprehension → shadow" against that build sends
 * the learner to a screen that cannot honour the instruction, which is worse
 * than no sequencer: it is the app overstating itself, which BR-3 forbids.
 *
 * So availability is decided from three independent facts, and a step survives
 * only if all three hold:
 *   1. a SURFACE exists that can render it        -> SURFACES / registerSurfaces
 *   2. the section behind it has authored CONTENT -> Sections.contentCount()
 *   3. the step's own precondition holds          -> part.requires()
 * Whatever fails is reported on `plan.omitted` with a reason. The plan gets
 * shorter honestly and says so; it never silently shrinks.
 *
 * WHY IT NEVER HARDCODES A SECTION LIST
 * js/core/sections.js is the registry and this file reads it. Strand membership
 * is derived from each row's `srsType` where it has one, and from one small
 * additive table for the rows that do not (`STRAND_BY_SECTION`). A section added
 * to the registry and not classified here is reported by
 * `Session.unclassifiedSections()` rather than silently ignored — the same
 * "make the mistake loud" discipline sections.js was written for.
 *
 * STORAGE
 * Its own key, `sessionPlan`. It never reads or writes `learningProgress` or
 * `srsData`. js/core/portability.js exports by deny-list, so this key is carried
 * by an export automatically (FR-DATA-4) with no change to that file.
 *
 * Public API (window.Session):
 *   -- planning --
 *   Session.build(opts)             -> plan (resumes today's plan unless opts.fresh)
 *   Session.availability(opts)      -> per-step/per-part report, no plan built
 *   Session.plan()                  -> the loaded plan, or null
 *   -- walking --
 *   Session.current()               -> the step the learner is on, or null
 *   Session.advance(outcome)        -> record + move on; returns the next step or null
 *   Session.skip(note)              -> advance('skipped')     (FR-A11Y-4)
 *   Session.markSilent(note)        -> advance('silent')      (FR-A11Y-4 + BR-2)
 *   Session.progress()              -> position, counts, minutes, strands covered
 *   Session.productionSummary()     -> what the speaking step actually produced
 *   Session.wrapUp()                -> the 1-minute close (FR-SES-5)
 *   -- capability registration --
 *   Session.registerSurfaces(map)   -> app.js declares what it can render
 *   Session.surface(name)           -> resolved { available, types, note }
 *   Session.resetSurfaces()
 *   -- persistence --
 *   Session.load() / save() / reset() / previous()
 *   -- introspection / policy --
 *   Session.SHAPE, STRANDS, SURFACES, TARGET_MINUTES, MIN_MINUTES, STORAGE_KEY
 *   Session.strandOfSection(id), Session.unclassifiedSections()
 */
(function (global) {
    'use strict';

    // In the browser index.html loads sections.js / srs.js / mistakes.js before
    // this file. Under Node a test may require() this module alone, so pull the
    // dependencies in ourselves — but only when the global is genuinely absent,
    // so a test that installs a stub keeps its stub.
    if (typeof module !== 'undefined' && module.exports) {
        ['sections', 'srs', 'mistakes'].forEach(function (name) {
            const globalName = name === 'srs' ? 'SRS'
                : name.charAt(0).toUpperCase() + name.slice(1);
            if (typeof global[globalName] !== 'undefined') return;
            try { require('./' + name + '.js'); } catch (e) { /* optional */ }
        });
    }

    const STORAGE_KEY = 'sessionPlan';
    const RECORD_VERSION = 1;

    // ------------------------------------------------------------------
    // Time policy  (decision 3: advisory minutes, count-boxed work)
    // ------------------------------------------------------------------
    //
    // Steps are COUNT-boxed where a count exists and ADVISORY-minute-labelled
    // everywhere else. They are never time-boxed, i.e. nothing expires.
    //
    // Why not a countdown per step:
    //   - We cannot measure the thing a timer would be pacing. The learner is on
    //     a commute (P1) with the screen locked half the time; wall-clock
    //     elapsed is not time-on-task, so a 3-minute timer is measuring the
    //     train, not the review.
    //   - A step that expires mid-answer is a punishment, and it lands hardest
    //     on the learner who is slowest — P2, who "will abandon anything that
    //     feels like a test she is failing" (REQUIREMENTS.md §2 P2, NFR-15 tone
    //     rules). Cutting off a half-finished thought teaches quitting.
    //   - FR-SES-1's "~20 minutes" is a promise about SIZE, and size is what a
    //     count delivers honestly: "9 review items, then 1 grammar point, then
    //     9 minimal pairs" is a session a learner can see the end of, and it
    //     ends when the work ends rather than when a clock says so.
    // The one timer that does exist is inside the free-speaking task, because
    // FR-SPK-3 explicitly asks for "prompt, timer, record" — and that is a
    // stopwatch the learner starts, reported as `targetSeconds`, not a guillotine.
    //
    // Minutes are still carried per step: they are what makes the shape read as
    // a 20-minute session in the UI, they are how the budget is split, and they
    // are how `count` is derived. `plan.minutes` is the advisory total.
    const TARGET_MINUTES = 20;      // §4's shape, and P2's 20 min at night
    const MIN_MINUTES = 15;         // BR-1's floor, and P1's 15 min commute
    const MAX_MINUTES = 45;         // a sanity ceiling on opts.minutes

    // §4's table sums to 20. Every step's `minutes` below is that table's row,
    // and this constant is what a requested budget is scaled against.
    const SHAPE_MINUTES = 20;

    // A degraded plan redistributes the minutes freed by dropped steps over the
    // survivors, but never past this multiple of a step's §4 share. Without the
    // clamp, a build where only vocabulary content exists would prescribe 20
    // minutes of vocabulary review — which is not the §4 session, it is the old
    // single-section app with a progress bar. With it, the plan comes out short
    // and SAYS it is short (`plan.shortMinutes`), which is the honest outcome.
    const REDISTRIBUTE_CEILING = 1.5;

    // ------------------------------------------------------------------
    // Strands  (docs/CURRICULUM.md §3)
    // ------------------------------------------------------------------
    const STRANDS = [
        { id: 'A', key: 'vocabulary',      label: 'Vocabulary',       srsType: 'vocab' },
        { id: 'B', key: 'grammar',         label: 'Grammar',          srsType: 'gram' },
        { id: 'C', key: 'pronunciation',   label: 'Pronunciation',    srsType: 'phon' },
        { id: 'D', key: 'listening',       label: 'Listening',        srsType: null },
        { id: 'E', key: 'speaking',        label: 'Speaking',         srsType: null },
        { id: 'F', key: 'reading-writing', label: 'Reading & Writing', srsType: null }
    ];

    const STRAND_BY_ID = Object.create(null);
    const STRAND_BY_KEY = Object.create(null);
    const STRAND_BY_SRS_TYPE = Object.create(null);
    STRANDS.forEach(function (s) {
        Object.freeze(s);
        STRAND_BY_ID[s.id] = s;
        STRAND_BY_KEY[s.key] = s;
        if (s.srsType) STRAND_BY_SRS_TYPE[s.srsType] = s;
    });
    Object.freeze(STRANDS);

    /**
     * Strand for a registry row that has no `srsType` to derive one from.
     *
     * Additive and deliberately tiny. `null` means "real section, no strand in
     * §3" — puzzles are a support activity and the dashboard is not a strand at
     * all — and that is different from "absent", which is what
     * unclassifiedSections() reports.
     *
     * Note there is NO row here for Speaking, because there is no speaking
     * SECTION in the registry. Speaking is delivered today as sub-surfaces of
     * other sections (grammar's `produce` task, pronunciation's production gate)
     * and that is exactly why the speak step below resolves by surface rather
     * than by section. See DECISION 6 in the header of `SHAPE`.
     */
    const STRAND_BY_SECTION = {
        dashboard: null,
        sentences: 'F',
        reading: 'F',
        listening: 'D',
        puzzles: null
    };

    // ------------------------------------------------------------------
    // Surfaces  (decision 1: what can actually be rendered today)
    // ------------------------------------------------------------------
    //
    // A "surface" is a thing the app can put on screen and let a learner
    // complete. This table is the state of the build on 2026-09-10, written down
    // rather than assumed, so that this module is useful before app.js wires it
    // AND becomes truthful the moment app.js calls registerSurfaces().
    //
    // Each value: { available, types?, note, requirement? }
    //   available  false means "do not plan this step"; a FUNCTION means "ask
    //              at build time" (used for gates whose answer is per item)
    //   types      for srs.review only: which SRS item types the review screen
    //              can actually draw. This is the field that stops the plan
    //              promising a grammar review the review screen cannot render.
    //   note       learner-facing-ish reason, copied onto plan.omitted
    const SURFACES = {
        // app.js startReview() walks SRS.getDueWords(), which is vocab-only —
        // see the comment on SRS.dueCount(). A due `gram:` or `phon:` record
        // exists and is correctly scheduled, but no screen draws it yet, so the
        // review step must not count it. countsHeldBack() reports the gap.
        'srs.review': {
            available: true,
            types: ['vocab'],
            note: 'Review mode renders vocabulary cards only (app.js startReview walks SRS.getDueWords).'
        },
        // renderGrammarLesson / notice / decide / contrast all exist.
        'grammar.teach': { available: true, note: 'Grammar lesson view exists.' },
        'grammar.contrast': { available: true, note: 'Contrast pairs are authored on every point.' },
        // renderGrammarProduce: a say-it-aloud task with a self-check list, both
        // buttons complete it, no microphone required. This is the only
        // unconditional spoken-production surface in the build.
        'grammar.produce': {
            available: true,
            note: 'Grammar "say it aloud" task with self-check (FR-SPK-9 / FR-A11Y-4 skippable).'
        },
        // The audio minimal-pair drill.
        'pron.discriminate': { available: true, note: 'Minimal-pair discrimination drill exists.' },
        // Exists, but FR-PRN-6 gates it per pair at ≥80% discrimination
        // accuracy, and only app.js can evaluate that gate (pronGate reads
        // per-pair attempt history). Declared unavailable here so the planner
        // never promises it; app.js may register a predicate to switch it on.
        'pron.produce': {
            available: false,
            requirement: 'FR-PRN-6',
            note: 'Pronunciation production is gated per pair at 80% discrimination accuracy; register a predicate from app.js to use it.'
        },
        'listen.model': { available: true, note: 'Listening plays a TTS model sentence.' },
        'listen.comprehend': {
            available: false,
            requirement: 'FR-LST-1',
            note: 'No listening comprehension question exists anywhere in the app (CURRICULUM.md §3 Strand D).'
        },
        'speak.shadow': {
            available: false,
            requirement: 'FR-SPK-8',
            note: 'Shadowing mode is not built.'
        },
        'speak.free': {
            available: false,
            requirement: 'FR-SPK-3',
            note: 'Free-production prompts with a timer, recording and rubric are not built.'
        },
        // The dashboard already shows streak and totals; the fluency trend does
        // not exist yet (FR-SPK-5), which wrapUp() reports rather than fakes.
        'session.summary': { available: true, note: 'Dashboard streak and totals exist.' }
    };

    // Runtime overrides from app.js. Kept separate from SURFACES so
    // resetSurfaces() restores the documented baseline exactly.
    let OVERRIDES = Object.create(null);

    // ------------------------------------------------------------------
    // The shape  (docs/CURRICULUM.md §4, one row per table row)
    // ------------------------------------------------------------------
    //
    // DECISION 4 — review first, and never as an empty step. §4 opens with SRS
    // because the cheapest retention in the session is the item that is about to
    // be forgotten. The queue is read, never re-derived: SRS.getDue() already
    // applies FR-SRS-4's 20-item cap and its own oldest-first ordering, and
    // re-implementing either here would give two components two different ideas
    // of what is due. `requires` returns false when nothing is due, so the plan
    // opens on the grammar point instead — an empty "0 items to review" card is
    // the single most demoralising first screen a spaced-repetition app can show.
    //
    // DECISION 6 (speaking) — the `speak` step resolves through an ORDERED list
    // of alternatives, best first, and the plan records which one it got. There
    // is no speaking section to look up: Strand E exists today only as
    // sub-surfaces of other sections. `speak.free` is what §4 and FR-SPK-3 ask
    // for; `grammar.produce` is the honest fallback that actually ships; and the
    // step is marked `required: true`, meaning it is the one step a degraded
    // plan may not drop while still claiming to satisfy FR-SES-1.
    //
    // `pace` is items per minute and is what turns a minute budget into a count.
    // The numbers are deliberately conservative (a vocabulary card at ~15s, a
    // discrimination item at ~20s including feedback): overshooting the count is
    // how a "20-minute session" becomes a 35-minute one and stops being trusted.
    const SHAPE = [
        {
            id: 'review',
            title: 'Review what is due',
            minutes: 3,
            isTask: true,
            rationale: '§4 opens with SRS: the most overdue item has the most retention to gain. Capped by FR-SRS-4, read from SRS rather than recomputed.',
            parts: [{
                id: 'srs',
                kind: 'srs-review',
                surface: 'srs.review',
                strandsFrom: 'due',     // filled in from the queue that is built
                pace: 4,
                requires: function (ctx) {
                    return ctx.due.length > 0
                        ? { ok: true }
                        : { ok: false, reason: 'Nothing is due for review today.' };
                }
            }]
        },
        {
            id: 'grammar',
            title: 'One grammar point, with its contrast pairs',
            minutes: 4,
            isTask: true,
            sectionId: 'grammar',
            rationale: '§4: new teaching goes early, while attention is highest. One point only — TEACHING_METHODOLOGY.md §2 wants a reason, a contrast and a retry, not coverage.',
            parts: [
                { id: 'teach', kind: 'grammar-lesson', surface: 'grammar.teach', strands: ['B'], sectionId: 'grammar' },
                { id: 'contrast', kind: 'grammar-contrast', surface: 'grammar.contrast', strands: ['B'], sectionId: 'grammar' }
            ]
        },
        {
            id: 'pronunciation',
            title: 'Minimal-pair discrimination',
            minutes: 3,
            isTask: true,
            sectionId: 'pronunciation',
            rationale: '§4 + FR-PRN-6: discrimination before production. A learner who cannot hear a contrast cannot self-judge it, so this step is what unlocks speaking on a pair.',
            parts: [
                { id: 'discriminate', kind: 'discrimination', surface: 'pron.discriminate', strands: ['C'], sectionId: 'pronunciation', pace: 3 }
            ]
        },
        {
            id: 'listen',
            title: 'Listen, answer, shadow',
            minutes: 4,
            isTask: true,
            sectionId: 'listening',
            rationale: '§4: input before output. Comprehension and shadowing are separate parts of this step, so whichever of the three is unbuilt drops out on its own and is named on plan.omitted.',
            parts: [
                { id: 'model', kind: 'listen-model', surface: 'listen.model', strands: ['D'], sectionId: 'listening', pace: 2 },
                { id: 'comprehend', kind: 'listen-question', surface: 'listen.comprehend', strands: ['D'], sectionId: 'listening' },
                { id: 'shadow', kind: 'shadow', surface: 'speak.shadow', strands: ['E'], speaking: true }
            ]
        },
        {
            id: 'speak',
            title: 'Say something of your own',
            minutes: 5,
            isTask: true,
            required: true,
            terminal: true,
            rationale: 'FR-SES-1 ("ends with a spoken production") and BR-2 ("every session produces unscripted spoken output"). Last, because production is what the preceding fifteen minutes were input for.',
            parts: [{
                id: 'produce',
                kind: 'free-production',
                strands: ['E'],
                speaking: true,
                // Best first. Whichever resolves is recorded on the step.
                alternatives: [
                    { surface: 'speak.free', kind: 'free-production', unscripted: true, targetSeconds: true },
                    { surface: 'grammar.produce', kind: 'prompted-production', sectionId: 'grammar', unscripted: true, targetSeconds: true },
                    { surface: 'pron.produce', kind: 'pair-production', sectionId: 'pronunciation', unscripted: false }
                ]
            }]
        },
        {
            id: 'wrapUp',
            title: 'Where you are, and tomorrow',
            minutes: 1,
            // NOT a task, and that distinction is load-bearing. FR-SES-1 says the
            // session "ends with a spoken production"; §4 also puts a 1-minute
            // streak/trend/preview row last. Both are satisfiable because this
            // row is the APP reporting back, not the learner doing something. So
            // `endsWithProduction` is computed over task steps only, and the
            // last thing the learner DOES is speak.
            isTask: false,
            rationale: 'FR-SES-5: streak, trend and tomorrow\'s preview at session end. A report, not a task — which is why the last thing the learner does is still the speaking step.',
            parts: [
                { id: 'summary', kind: 'summary', surface: 'session.summary', strands: [] }
            ]
        }
    ];
    SHAPE.forEach(function (s) { Object.freeze(s.parts); Object.freeze(s); });
    Object.freeze(SHAPE);

    const OUTCOMES = ['done', 'aloud', 'silent', 'skipped'];

    // ==================================================================
    // Helpers
    // ==================================================================

    function _isFiniteNumber(n) {
        return typeof n === 'number' && isFinite(n);
    }

    function _round1(n) {
        return Math.round(n * 10) / 10;
    }

    /** Local calendar day. A session belongs to a day, not to a 24h window. */
    function _dateKey(now) {
        const d = new Date(_isFiniteNumber(now) ? now : Date.now());
        const m = d.getMonth() + 1;
        const day = d.getDate();
        return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    function _budget(minutes) {
        if (!_isFiniteNumber(minutes) || minutes <= 0) return TARGET_MINUTES;
        return Math.min(MAX_MINUTES, Math.max(5, minutes));
    }

    function _level(level) {
        if (global.Levels && typeof global.Levels.canonicalLevel === 'function') {
            return global.Levels.canonicalLevel(level);
        }
        if (typeof global.canonicalLevel === 'function') return global.canonicalLevel(level);
        return typeof level === 'string' && level ? level : 'foundation';
    }

    function _sections() {
        return (global.Sections && typeof global.Sections.all === 'function')
            ? global.Sections
            : null;
    }

    function _srs() {
        return (global.SRS && typeof global.SRS.getDue === 'function') ? global.SRS : null;
    }

    function _mistakes() {
        return (global.Mistakes && typeof global.Mistakes.topCategories === 'function')
            ? global.Mistakes
            : null;
    }

    // ------------------------------------------------------------------
    // Surfaces
    // ------------------------------------------------------------------

    /**
     * Resolve a surface to `{ name, available, types, note, source }`.
     *
     * An override may be `true` / `false`, an object, or a function evaluated
     * with the build context — the function form is what lets app.js answer
     * FR-PRN-6's per-pair gate ("is production open for ANY pair right now").
     * A function that throws counts as unavailable: an availability question may
     * not be able to take the session down.
     */
    function surface(name, ctx) {
        const base = SURFACES[name] || { available: false, note: 'Unknown surface "' + name + '".' };
        let resolved = Object.prototype.hasOwnProperty.call(OVERRIDES, name)
            ? OVERRIDES[name]
            : base;
        let source = Object.prototype.hasOwnProperty.call(OVERRIDES, name) ? 'registered' : 'default';

        if (typeof resolved === 'function') {
            try {
                resolved = resolved(ctx || {});
            } catch (e) {
                resolved = { available: false, note: 'Surface predicate for "' + name + '" threw.' };
            }
        }
        if (typeof resolved === 'boolean') resolved = { available: resolved };
        if (!resolved || typeof resolved !== 'object') resolved = { available: false };

        return {
            name: name,
            source: source,
            available: !!resolved.available,
            types: Array.isArray(resolved.types) ? resolved.types.slice()
                : (Array.isArray(base.types) ? base.types.slice() : null),
            requirement: resolved.requirement || base.requirement || null,
            note: resolved.note || base.note || ''
        };
    }

    /**
     * app.js declares what it can render. Same loudness and same once-only call
     * discipline as Sections.registerRuntime(): an unknown surface name is a
     * typo that would otherwise silently never take effect.
     */
    function registerSurfaces(map) {
        if (!map || typeof map !== 'object') return;
        Object.keys(map).forEach(function (name) {
            if (!Object.prototype.hasOwnProperty.call(SURFACES, name)) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('Session.registerSurfaces: unknown surface "' + name +
                                 '" — add it to SURFACES in js/core/session.js');
                }
                return;
            }
            OVERRIDES[name] = map[name];
        });
    }

    function resetSurfaces() {
        OVERRIDES = Object.create(null);
    }

    // ------------------------------------------------------------------
    // Strand derivation (registry-driven)
    // ------------------------------------------------------------------

    /**
     * Which §3 strand a registry row belongs to. Derived from `srsType` first,
     * because that field already encodes the strand and cannot drift from it;
     * the table is only for rows with no scheduler type.
     *
     * Returns a strand id, or null for a section that is deliberately not a
     * strand, or undefined when the registry knows a section this file does not.
     */
    function strandOfSection(sectionId) {
        const S = _sections();
        const row = S ? S.get(sectionId) : null;
        if (!row) return undefined;
        if (row.srsType && STRAND_BY_SRS_TYPE[row.srsType]) {
            return STRAND_BY_SRS_TYPE[row.srsType].id;
        }
        if (Object.prototype.hasOwnProperty.call(STRAND_BY_SECTION, sectionId)) {
            return STRAND_BY_SECTION[sectionId];
        }
        return undefined;
    }

    /**
     * Registry rows this file cannot place in a strand. Add a section to
     * sections.js and forget this file, and it shows up here — the failure is
     * loud instead of a section that quietly never appears in a session.
     */
    function unclassifiedSections() {
        const S = _sections();
        if (!S) return [];
        return S.ids().filter(function (id) { return strandOfSection(id) === undefined; });
    }

    function strandLabel(id) {
        return STRAND_BY_ID[id] ? STRAND_BY_ID[id].label : id;
    }

    // ------------------------------------------------------------------
    // Content availability
    // ------------------------------------------------------------------

    /**
     * `{ ok, reason }` for "does this section have something authored at this
     * tier". Follows sections.js's own rule that "no probe registered" and "zero
     * items" are DIFFERENT facts: an unprobed section is allowed through with a
     * note, because reporting it empty would make every section look empty
     * before app.js runs registerContent().
     */
    function _contentOk(sectionId, level) {
        if (!sectionId) return { ok: true };
        const S = _sections();
        if (!S) return { ok: true, note: 'Section registry not loaded; content unverified.' };
        if (!S.get(sectionId)) {
            return { ok: false, reason: 'No section "' + sectionId + '" in the registry.' };
        }
        if (!S.knowsContent(sectionId)) {
            return { ok: true, note: 'No content probe registered for "' + sectionId + '"; content unverified.' };
        }
        const n = S.contentCount(sectionId, level);
        if (n > 0) return { ok: true, count: n };
        return { ok: false, reason: 'No ' + sectionId + ' content authored at tier "' + level + '".' };
    }

    // ------------------------------------------------------------------
    // The review queue
    // ------------------------------------------------------------------

    /**
     * Today's review queue, restricted to the item types the review SCREEN can
     * draw, and capped.
     *
     * The cap is SRS's (FR-SRS-4). This never raises it: `limit` is only ever
     * passed to ask for FEWER than the cap when the minute budget is smaller
     * than 20 minutes' worth of cards. Overflow is deferred by SRS, not dropped.
     */
    function _dueQueue(types, limit) {
        const SRSmod = _srs();
        if (!SRSmod) return [];
        const allTypes = Array.isArray(SRSmod.TYPES) ? SRSmod.TYPES : ['vocab', 'gram', 'phon', 'coll'];
        const allowed = Array.isArray(types) && types.length ? types : allTypes;

        // All types allowed: use SRS's own round-robin, which is the ordering
        // that keeps three strands represented in one queue.
        if (allowed.length === allTypes.length) {
            const out = SRSmod.getDue(null, _isFiniteNumber(limit) ? { limit: limit } : undefined);
            return Array.isArray(out) ? out : [];
        }

        const queues = allowed.map(function (t) {
            const q = SRSmod.getDue(t, _isFiniteNumber(limit) ? { limit: limit } : undefined);
            return Array.isArray(q) ? q : [];
        });
        const out = [];
        const cap = _isFiniteNumber(limit) ? limit : Infinity;
        for (let i = 0; out.length < cap; i++) {
            let placed = false;
            for (let q = 0; q < queues.length; q++) {
                if (i < queues[q].length) {
                    out.push(queues[q][i]);
                    placed = true;
                    if (out.length >= cap) break;
                }
            }
            if (!placed) break;
        }
        return out;
    }

    /**
     * Items that are genuinely due but whose type the review screen cannot draw.
     *
     * This is the honesty half of the review step. Without it, a learner with
     * four due grammar points and no due vocabulary is told "nothing to review",
     * which is false — the work exists, the screen does not.
     */
    function countsHeldBack(types) {
        const SRSmod = _srs();
        if (!SRSmod || typeof SRSmod.totalDueCount !== 'function') return [];
        const allTypes = Array.isArray(SRSmod.TYPES) ? SRSmod.TYPES : ['vocab', 'gram', 'phon', 'coll'];
        const allowed = Array.isArray(types) && types.length ? types : allTypes;
        const out = [];
        allTypes.forEach(function (t) {
            if (allowed.indexOf(t) !== -1) return;
            let n = 0;
            try { n = SRSmod.totalDueCount(t) || 0; } catch (e) { n = 0; }
            if (n > 0) {
                out.push({
                    type: t,
                    count: n,
                    strand: STRAND_BY_SRS_TYPE[t] ? STRAND_BY_SRS_TYPE[t].id : null,
                    reason: n + ' ' + t + ' item' + (n === 1 ? '' : 's') +
                            ' are due but no screen renders a ' + t + ' review yet.'
                });
            }
        });
        return out;
    }

    // ------------------------------------------------------------------
    // Mistake-driven targeting  (decision 5)
    // ------------------------------------------------------------------

    /**
     * The learner's top recurring error, resolved to a step to steer.
     *
     * DECISION: yes, target — but as a STEERING layer over the §4 order, never
     * as a step of its own and never as a precondition. Reasons:
     *   - TEACHING_METHODOLOGY.md principle 4 ("errors are the syllabus") is the
     *     whole point of the mistake log; a session that ignores it is picking
     *     content at random when it has evidence available.
     *   - It must not change the SHAPE, because the shape is what makes the
     *     session predictable, and predictability is what BR-1 buys.
     *   - A first session has no history at all, and it has to work. So the
     *     absence of a target is a normal outcome, reported as
     *     `plan.targeting = null` plus a note — not a fallback path.
     * Categories are walked in rank order until one is drillable AND lands on a
     * step this plan actually contains: pointing the session at a strand it
     * could not build is worse than not targeting.
     *
     * The review step is deliberately NOT steerable. Its order is SRS's
     * (oldest-due first, tie-broken by lapses, starvation-free) and reordering it
     * around a mistake category would strand items behind the FR-SRS-4 cap
     * forever — the exact failure that ordering was designed to prevent.
     */
    function _resolveTarget(steps) {
        const M = _mistakes();
        if (!M) return { target: null, note: 'Mistake log not loaded; no targeting.' };

        let rows = [];
        try { rows = M.topCategories({ limit: 5 }) || []; } catch (e) { rows = []; }
        if (!rows.length) {
            return { target: null, note: 'No mistake history yet — the plan follows the default §4 order.' };
        }

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const drill = row.drill || (typeof M.drillTarget === 'function' ? M.drillTarget(row.id) : null);
            if (!drill || !drill.strand) continue;
            const strand = STRAND_BY_KEY[drill.strand];
            if (!strand) continue;                       // e.g. `collocation`: no §3 strand
            const step = _stepForStrand(strand.id, steps);
            if (!step) continue;
            return {
                target: {
                    stepId: step.id,
                    strand: strand.id,
                    strandLabel: strand.label,
                    categoryId: row.id,
                    label: row.label,
                    count: row.count,
                    trend: row.trend,
                    ref: drill.target || null,
                    srsKey: drill.srsKey || null,
                    rank: i + 1
                },
                note: 'Targeting your most frequent recent error: ' + row.label + '.'
            };
        }
        return {
            target: null,
            note: 'Your top recurring errors have nothing drillable in this build; the plan follows the default §4 order.'
        };
    }

    /**
     * The planned step that teaches a strand, if this plan has one. Reads the
     * RESOLVED strands on the built steps rather than the SHAPE, so a step that
     * degraded out of a strand cannot be targeted at it.
     */
    function _stepForStrand(strandId, steps) {
        for (let i = 0; i < steps.length; i++) {
            const s = steps[i];
            if (s.id === 'review') continue;             // see _resolveTarget
            if (!s.isTask) continue;
            if ((s.strands || []).indexOf(strandId) !== -1) return s;
        }
        return null;
    }

    // ==================================================================
    // Availability report
    // ==================================================================

    /**
     * What this build could and could not include, without building a plan.
     * The UI can use this to say "today's session covers 3 of 5 strands" before
     * the learner presses anything.
     */
    function availability(opts) {
        const o = opts || {};
        const now = _isFiniteNumber(o.now) ? o.now : Date.now();
        const level = _level(o.level);
        const reviewSurface = surface('srs.review', { level: level, now: now });
        const due = _dueQueue(reviewSurface.available ? reviewSurface.types : [], undefined);
        const ctx = { level: level, now: now, due: due, silent: !!o.silent };

        const rows = SHAPE.map(function (shape) {
            const parts = shape.parts.map(function (part) {
                return _partAvailability(part, shape, ctx);
            });
            const usable = parts.filter(function (p) { return p.ok; });
            return {
                id: shape.id,
                title: shape.title,
                isTask: shape.isTask !== false,
                required: !!shape.required,
                minutes: shape.minutes,
                ok: usable.length > 0,
                parts: parts,
                strands: _unique(usable.reduce(function (acc, p) {
                    return acc.concat(p.strands || []);
                }, []))
            };
        });

        return {
            level: level,
            date: _dateKey(now),
            steps: rows,
            strands: _unique(rows.reduce(function (acc, r) { return acc.concat(r.strands); }, [])),
            heldBack: reviewSurface.available ? countsHeldBack(reviewSurface.types) : [],
            unclassifiedSections: unclassifiedSections()
        };
    }

    /**
     * `{ ok, reason, strands, ... }` for one part. An `alternatives` part
     * resolves to the first alternative that passes; a part with none passes on
     * its own surface plus content plus precondition.
     */
    function _partAvailability(part, shape, ctx) {
        if (Array.isArray(part.alternatives)) {
            const tried = [];
            for (let i = 0; i < part.alternatives.length; i++) {
                const alt = part.alternatives[i];
                const merged = Object.assign({}, part, alt, { alternatives: null });
                const res = _partAvailability(merged, shape, ctx);
                if (res.ok) {
                    res.chosen = alt.surface;
                    res.rejected = tried;
                    return res;
                }
                tried.push({ surface: alt.surface, reason: res.reason });
            }
            return {
                id: part.id,
                ok: false,
                strands: part.strands || [],
                speaking: !!part.speaking,
                rejected: tried,
                reason: 'No production surface is available: ' +
                        tried.map(function (t) { return t.surface + ' (' + t.reason + ')'; }).join('; ')
            };
        }

        const sectionId = part.sectionId || shape.sectionId || null;
        const surf = part.surface ? surface(part.surface, ctx) : { available: true, note: '', types: null };

        const out = {
            id: part.id,
            kind: part.kind,
            surface: part.surface || null,
            sectionId: sectionId,
            strands: (part.strandsFrom === 'due')
                ? _unique(ctx.due.map(function (d) {
                    return STRAND_BY_SRS_TYPE[d.type] ? STRAND_BY_SRS_TYPE[d.type].id : null;
                }).filter(Boolean))
                : (part.strands || []),
            speaking: !!part.speaking,
            unscripted: !!part.unscripted,
            pace: part.pace || null,
            targetSeconds: !!part.targetSeconds,
            ok: true,
            reason: null,
            notes: []
        };

        if (!surf.available) {
            out.ok = false;
            out.reason = surf.note || 'Surface "' + part.surface + '" is not available.';
            out.requirement = surf.requirement || null;
            return out;
        }
        if (surf.note) out.notes.push(surf.note);

        const content = _contentOk(sectionId, ctx.level);
        if (!content.ok) {
            out.ok = false;
            out.reason = content.reason;
            return out;
        }
        if (content.note) out.notes.push(content.note);
        if (_isFiniteNumber(content.count)) out.contentCount = content.count;

        if (typeof part.requires === 'function') {
            let pre;
            try {
                pre = part.requires(ctx);
            } catch (e) {
                pre = { ok: false, reason: 'Precondition for "' + part.id + '" threw.' };
            }
            if (!pre || !pre.ok) {
                out.ok = false;
                out.reason = (pre && pre.reason) || 'Precondition not met.';
                return out;
            }
        }
        return out;
    }

    function _unique(list) {
        const seen = Object.create(null);
        const out = [];
        (list || []).forEach(function (x) {
            if (x == null || seen[x]) return;
            seen[x] = true;
            out.push(x);
        });
        return out;
    }

    // ==================================================================
    // Build
    // ==================================================================

    /**
     * Build (or resume) today's plan.
     *
     * @param {Object} [opts]
     *        minutes   advisory budget; default 20, P1's commute is 15
     *        level     tier; canonicalised through levels.js
     *        silent    P2's mode: production stays in the plan, its instruction
     *                  changes and its default completion is 'silent'
     *        exhausted array of section ids the learner has already finished
     *                  today (app.js knows this from completedExercises)
     *        fresh     true to discard a stored plan for today and rebuild
     *        now       clock override
     */
    function build(opts) {
        const o = opts || {};
        const now = _isFiniteNumber(o.now) ? o.now : Date.now();

        if (o.fresh !== true) {
            const stored = load(now);
            if (stored && stored.plan && stored.date === _dateKey(now)) {
                _state = stored;
                _state.plan.resumed = true;
                return _state.plan;
            }
        }

        // A record from another day is not resumed — yesterday's due queue is not
        // today's — but an unfinished session still happened, so its summary is
        // carried forward for the streak/preview copy rather than discarded.
        const carried = (_state && _state.plan && _state.date !== _dateKey(now))
            ? (_state.previous && _state.previous.date === _state.date ? _state.previous : _summary())
            : (_state ? _state.previous : null);

        const budget = _budget(o.minutes);
        const level = _level(o.level);
        const silent = !!o.silent;
        const exhausted = Array.isArray(o.exhausted) ? o.exhausted.slice() : [];

        const reviewSurface = surface('srs.review', { level: level, now: now });
        // Pull the queue uncapped-by-us first: the count-box below needs to know
        // how much is actually there, and SRS has already applied FR-SRS-4.
        const due = reviewSurface.available ? _dueQueue(reviewSurface.types, undefined) : [];
        const ctx = { level: level, now: now, due: due, silent: silent, exhausted: exhausted };

        const omitted = [];
        const notes = [];
        const survivors = [];

        SHAPE.forEach(function (shape) {
            const parts = shape.parts.map(function (part) { return _partAvailability(part, shape, ctx); });
            const usable = parts.filter(function (p) { return p.ok; });
            const dropped = parts.filter(function (p) { return !p.ok; });

            if (!usable.length) {
                omitted.push({
                    stepId: shape.id,
                    title: shape.title,
                    strands: _unique(shape.parts.reduce(function (a, p) { return a.concat(p.strands || []); }, [])),
                    required: !!shape.required,
                    minutes: shape.minutes,
                    reason: _unique(dropped.map(function (p) { return p.reason; }).filter(Boolean)).join(' ')
                });
                return;
            }
            dropped.forEach(function (p) {
                omitted.push({
                    stepId: shape.id,
                    partId: p.id,
                    title: shape.title + ' — ' + p.id,
                    strands: p.strands || [],
                    partial: true,
                    reason: p.reason,
                    requirement: p.requirement || null
                });
            });
            survivors.push({ shape: shape, parts: usable, droppedParts: dropped });
        });

        // --- minutes: scale to budget, redistribute what dropped steps freed ---
        const survivingBase = survivors.reduce(function (n, s) { return n + s.shape.minutes; }, 0);
        const factor = survivingBase > 0
            ? Math.min(REDISTRIBUTE_CEILING, budget / survivingBase)
            : 0;

        const steps = survivors.map(function (s, i) {
            const minutes = _round1(s.shape.minutes * factor);
            const step = {
                index: i,
                id: s.shape.id,
                title: s.shape.title,
                isTask: s.shape.isTask !== false,
                required: !!s.shape.required,
                terminal: !!s.shape.terminal,
                minutes: minutes,
                rationale: s.shape.rationale,
                sectionId: s.shape.sectionId || null,
                strands: _unique(s.parts.reduce(function (a, p) { return a.concat(p.strands || []); }, [])),
                parts: s.parts.map(function (p) {
                    return {
                        id: p.id,
                        kind: p.kind,
                        surface: p.chosen || p.surface,
                        sectionId: p.sectionId || null,
                        strands: p.strands || [],
                        speaking: !!p.speaking,
                        unscripted: !!p.unscripted,
                        notes: p.notes || []
                    };
                }),
                reduced: s.droppedParts.map(function (p) { return p.reason; }),
                // Count-boxing: derived from the part with a pace, clamped by
                // what is actually available.
                count: null,
                target: null,
                status: 'pending',
                outcome: null,
                note: null,
                startedAt: null,
                endedAt: null
            };

            // Speaking steps carry both completion routes, always. See
            // resolveSilentTension() and the module header.
            const speaks = step.parts.some(function (p) { return p.speaking; });
            if (speaks) {
                step.speaking = true;
                step.silentPath = true;
                step.completion = ['aloud', 'silent'];
                step.defaultOutcome = silent ? 'silent' : 'aloud';
                if (s.shape.terminal) {
                    step.targetSeconds = Math.max(30, Math.round(minutes * 60));
                    step.production = {
                        surface: step.parts[0].surface,
                        unscripted: !!step.parts[0].unscripted
                    };
                }
            } else {
                step.completion = ['done', 'skipped'];
                step.defaultOutcome = 'done';
            }

            // Count boxes.
            const paced = s.parts.filter(function (p) { return p.pace; })[0];
            if (paced) {
                let n = Math.max(1, Math.round(minutes * paced.pace));
                if (s.shape.id === 'review') n = Math.min(n, ctx.due.length);
                if (_isFiniteNumber(paced.contentCount)) n = Math.min(n, paced.contentCount);
                step.count = n;
            }

            if (s.shape.id === 'review') {
                step.items = ctx.due.slice(0, step.count || 0).map(function (d) {
                    return { type: d.type, ref: d.ref, key: d.key };
                });
                step.heldBack = countsHeldBack(reviewSurface.types);
                step.strands = _unique(step.items.map(function (it) {
                    return STRAND_BY_SRS_TYPE[it.type] ? STRAND_BY_SRS_TYPE[it.type].id : null;
                }).filter(Boolean));
            }

            // Already-finished sections are re-run, labelled, never hidden.
            if (step.sectionId && exhausted.indexOf(step.sectionId) !== -1) {
                step.repeat = true;
                step.reduced.push('You have already finished today\'s authored ' +
                                  step.sectionId + ' items; this is a second pass.');
            }
            return step;
        });

        const targeting = _resolveTarget(steps);
        if (targeting.note) notes.push(targeting.note);
        if (targeting.target) {
            const t = steps.filter(function (s) { return s.id === targeting.target.stepId; })[0];
            if (t) t.target = targeting.target;
        }

        const plan = {
            version: RECORD_VERSION,
            date: _dateKey(now),
            createdAt: now,
            level: level,
            silent: silent,
            budgetMinutes: budget,
            minutes: _round1(steps.reduce(function (n, s) { return n + s.minutes; }, 0)),
            steps: steps,
            omitted: omitted,
            notes: notes,
            targeting: targeting.target,
            resumed: false
        };
        plan.shortMinutes = _round1(Math.max(0, budget - plan.minutes));

        _annotate(plan);
        _state = {
            version: RECORD_VERSION,
            date: plan.date,
            index: 0,
            startedAt: null,
            updatedAt: now,
            plan: plan,
            previous: carried || null
        };
        save();
        return plan;
    }

    /**
     * Derive and attach the FR-SES-1 verdict. Separate from build() so a
     * resumed plan is re-verified against today's surfaces too.
     */
    function _annotate(plan) {
        const tasks = plan.steps.filter(function (s) { return s.isTask; });
        const lastTask = tasks.length ? tasks[tasks.length - 1] : null;

        plan.taskCount = tasks.length;
        plan.strands = _unique(plan.steps.reduce(function (a, s) { return a.concat(s.strands); }, []));
        plan.strandLabels = plan.strands.map(strandLabel);

        const production = plan.steps.filter(function (s) { return s.production; })[0] || null;
        plan.production = production
            ? {
                planned: true,
                stepId: production.id,
                surface: production.production.surface,
                unscripted: production.production.unscripted,
                silentPathAvailable: !!production.silentPath,
                targetSeconds: production.targetSeconds || null
            }
            : { planned: false, stepId: null, surface: null, unscripted: false, silentPathAvailable: false, targetSeconds: null };

        plan.checks = {
            // ≥3 strands
            threeStrands: plan.strands.length >= 3,
            // one of which is Speaking
            speakingStrand: plan.strands.indexOf('E') !== -1,
            // "ends with a spoken production" — over TASK steps, see wrapUp's
            // comment in SHAPE
            endsWithProduction: !!(lastTask && lastTask.production),
            // "requires no menu choices": the plan is an array plus a cursor.
            // Alternatives are resolved at build time and never offered.
            noChoices: plan.steps.every(function (s) { return !s.choices; }),
            // Advisory only: reported, and NOT part of the verdict, because the
            // budget is advisory by decision 3.
            fullBudget: plan.shortMinutes <= 1
        };
        plan.meetsFrSes1 = plan.checks.threeStrands && plan.checks.speakingStrand &&
                           plan.checks.endsWithProduction && plan.checks.noChoices;

        plan.shortfall = [];
        if (!plan.checks.threeStrands) {
            plan.shortfall.push('FR-SES-1 wants at least three strands; this plan covers ' +
                plan.strands.length + ' (' + (plan.strandLabels.join(', ') || 'none') + ').');
        }
        if (!plan.checks.speakingStrand) {
            plan.shortfall.push('FR-SES-1 and BR-2 require a Speaking strand; no speaking surface is available in this build.');
        }
        if (!plan.checks.endsWithProduction) {
            plan.shortfall.push('FR-SES-1 requires the session to end with a spoken production; no production surface is available, so this plan does not.');
        }
        if (!plan.checks.fullBudget) {
            plan.shortfall.push('This plan is ' + plan.shortMinutes + ' minutes short of the ' +
                plan.budgetMinutes + '-minute budget because steps were dropped for missing content or surfaces.');
        }
        if (!plan.taskCount) {
            plan.shortfall.push('No learning step could be planned at all: nothing is due and no section has content that this build can render.');
        }
        plan.empty = plan.taskCount === 0;
        return plan;
    }

    // ==================================================================
    // Walking the plan
    // ==================================================================

    // In-memory record. Shape is exactly what goes to localStorage.
    let _state = null;

    /**
     * TODAY'S plan, or null.
     *
     * Null for a stored record from another day, deliberately: current() /
     * advance() / progress() all read through here, so a learner who opens the
     * app the next morning cannot be dropped back into the middle of yesterday's
     * sequence against a due queue that has moved on. The record itself is kept
     * in memory so previous() still works; build() is what starts today.
     */
    function plan() {
        if (!_state) load(Date.now());
        if (!_state || !_state.plan) return null;
        if (_state.date !== _dateKey(Date.now())) return null;
        return _state.plan;
    }

    function current() {
        const p = plan();
        if (!p) return null;
        if (_state.index < 0 || _state.index >= p.steps.length) return null;
        const step = p.steps[_state.index];
        if (step.startedAt === null) {
            step.startedAt = Date.now();
            save();
        }
        return step;
    }

    /**
     * Record an outcome for the current step and move on.
     *
     * @param {string|Object} [outcome] one of 'done' | 'aloud' | 'silent' |
     *        'skipped', or `{ outcome, note }`. Omitted uses the step's
     *        `defaultOutcome`, which is 'silent' for a speaking step in silent
     *        mode and 'done'/'aloud' otherwise.
     * @returns {Object|null} the next step, or null when the session is finished.
     */
    function advance(outcome) {
        const p = plan();
        if (!p) return null;
        const step = (_state.index >= 0 && _state.index < p.steps.length) ? p.steps[_state.index] : null;
        if (!step) return null;

        let value = outcome;
        let note = null;
        if (value && typeof value === 'object') {
            note = value.note || null;
            value = value.outcome;
        }
        if (typeof value !== 'string' || OUTCOMES.indexOf(value) === -1) {
            value = step.defaultOutcome || 'done';
        }
        // A step only accepts the routes it actually offers, plus 'skipped',
        // which FR-A11Y-4 makes universal. Without this, a caller could mark a
        // grammar lesson 'silent' and productionSummary() would be reading a
        // route that never meant anything on that step.
        const allowed = (step.completion || ['done']).concat(['skipped']);
        if (allowed.indexOf(value) === -1) value = step.defaultOutcome || 'done';

        step.outcome = value;
        step.status = value === 'skipped' ? 'skipped' : 'done';
        step.note = note;
        step.endedAt = Date.now();
        if (_state.startedAt === null) _state.startedAt = step.startedAt || step.endedAt;

        _state.index += 1;
        _state.updatedAt = Date.now();

        if (_state.index >= p.steps.length) {
            _state.previous = _summary();
            save();
            return null;
        }
        save();
        return current();
    }

    /** FR-A11Y-4: complete a task without doing it. Never a dead end. */
    function skip(note) {
        return advance({ outcome: 'skipped', note: note || null });
    }

    /** FR-A11Y-4 + BR-2: production happened, silently. See resolveSilentTension(). */
    function markSilent(note) {
        return advance({ outcome: 'silent', note: note || null });
    }

    function progress() {
        const p = plan();
        if (!p) return null;
        const done = p.steps.filter(function (s) { return s.status === 'done'; }).length;
        const skipped = p.steps.filter(function (s) { return s.status === 'skipped'; }).length;
        const remaining = p.steps.slice(Math.max(0, _state.index));
        return {
            date: p.date,
            index: _state.index,
            total: p.steps.length,
            stepId: (_state.index < p.steps.length) ? p.steps[_state.index].id : null,
            done: done,
            skipped: skipped,
            complete: _state.index >= p.steps.length,
            remainingMinutes: _round1(remaining.reduce(function (n, s) { return n + s.minutes; }, 0)),
            elapsedMs: _state.startedAt ? (_state.updatedAt - _state.startedAt) : 0,
            strandsCovered: _unique(p.steps.filter(function (s) { return s.status === 'done'; })
                .reduce(function (a, s) { return a.concat(s.strands); }, [])),
            strandsPlanned: p.strands.slice()
        };
    }

    /**
     * What the speaking step actually produced. Deliberately reports the ROUTE,
     * so BR-2's metric M-1 ("% of sessions containing ≥1 unscripted spoken
     * production") can be computed without the app ever claiming it heard
     * something it did not (BR-3).
     */
    function productionSummary() {
        const p = plan();
        if (!p) return null;
        const step = p.steps.filter(function (s) { return s.production; })[0] || null;
        if (!step) {
            return {
                planned: false, completed: null, route: null, unscripted: false,
                surface: null,
                note: 'No production surface exists in this build, so this session cannot satisfy BR-2. ' +
                      'See plan.shortfall.'
            };
        }
        return {
            planned: true,
            stepId: step.id,
            surface: step.production.surface,
            unscripted: step.production.unscripted,
            completed: step.status === 'done',
            // 'aloud' = the learner says they spoke. 'silent' = they produced the
            // language without voicing it. 'skipped' = they did neither, and the
            // session still completed, which is FR-A11Y-4's floor.
            route: step.outcome,
            // Never "we verified speech". Self-reported, and labelled as such.
            selfReported: true
        };
    }

    /**
     * The 1-minute close (FR-SES-5). Everything here is session-local; the
     * fields this module cannot know are NAMED rather than faked.
     */
    function wrapUp() {
        const p = plan();
        if (!p) return null;
        const prog = progress();
        return {
            date: p.date,
            complete: prog.complete,
            steps: p.steps.map(function (s) {
                return { id: s.id, title: s.title, status: s.status, outcome: s.outcome, strands: s.strands };
            }),
            strandsCovered: prog.strandsCovered.map(strandLabel),
            strandsPlanned: p.strandLabels.slice(),
            production: productionSummary(),
            minutesPlanned: p.minutes,
            elapsedMs: prog.elapsedMs,
            omitted: p.omitted.slice(),
            shortfall: p.shortfall.slice(),
            previousSession: _state.previous || null,
            // FR-SES-5 asks for streak and fluency trend too. Streak lives in
            // `learningProgress` and the fluency trend (FR-SPK-5) does not exist
            // yet; both are app.js's to supply. Named, not invented.
            needsFromApp: ['streak', 'fluencyTrend', 'tomorrowPreview']
        };
    }

    function _summary() {
        const p = _state && _state.plan;
        if (!p) return null;
        return {
            date: p.date,
            steps: p.steps.length,
            done: p.steps.filter(function (s) { return s.status === 'done'; }).length,
            skipped: p.steps.filter(function (s) { return s.status === 'skipped'; }).length,
            strands: p.strands.slice(),
            production: (function () {
                const s = p.steps.filter(function (x) { return x.production; })[0];
                return s ? { route: s.outcome, surface: s.production.surface } : null;
            }())
        };
    }

    // ==================================================================
    // The silent-learner tension  (decision 2)
    // ==================================================================

    /**
     * BR-2 says every session produces unscripted spoken output and FR-SES-1
     * says the session must END with one. FR-A11Y-4 says every speaking task has
     * a skip-and-mark-done path, and P2 (Lakshmi, 10pm, cannot be overheard)
     * is the persona that exists to enforce it. Both are `M`.
     *
     * The contradiction is only apparent, and it dissolves on one distinction:
     * BR-2 is about PRODUCTION, not about AUDIBILITY.
     *
     * So:
     *   1. The production step is ALWAYS in the plan when a surface exists. It
     *      is `required: true` and no option removes it — not silent mode, not
     *      a skip, not a 15-minute budget. Dropping it is the thing that would
     *      violate BR-2, so it is not representable.
     *   2. It has TWO completion routes, `aloud` and `silent`, and both mark it
     *      done. Neither is a lesser path in the UI and neither needs a
     *      microphone (FR-SPK-9: only discrimination may gate).
     *   3. `silent` is a real production mode, not a skip: sub-vocal or
     *      whispered speech, or typing the utterance the prompt asked for. The
     *      learner still composes the language, which is the part that transfers.
     *      In silent mode the step's `defaultOutcome` is 'silent'.
     *   4. `skipped` remains possible, because FR-A11Y-4's floor is that a
     *      learner can get "start to finish" without speaking or granting mic
     *      access. A skipped production still completes the session.
     *   5. Nothing is laundered. productionSummary() reports the ROUTE and flags
     *      `selfReported: true`, so a session completed silently is counted as a
     *      silent production and a skipped one is counted as no production —
     *      which is what M-1 has to measure to mean anything, and what BR-3
     *      requires of every claim this app makes.
     *
     * The residual honest cost: a learner who skips every production task has
     * sessions that do not satisfy BR-2, and the app will say so in the wrap-up
     * rather than pretend otherwise. That is a reporting outcome, not a locked
     * door.
     */
    function resolveSilentTension() {
        return {
            productionAlwaysPlanned: true,
            routes: ['aloud', 'silent', 'skipped'],
            routesThatCompleteTheStep: ['aloud', 'silent', 'skipped'],
            routesThatSatisfyBr2: ['aloud', 'silent'],
            micRequired: false,
            claim: 'self-reported; never verified'
        };
    }

    // ==================================================================
    // Persistence  (decision 6: resume)
    // ==================================================================

    /**
     * Load the stored record. Returns it only when it is well formed; a record
     * for another day is still returned to the caller of load() but build()
     * refuses to resume it, because yesterday's due queue is not today's.
     */
    function load(now) {
        let parsed = null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            parsed = raw ? JSON.parse(raw) : null;
        } catch (e) {
            _state = null;
            return null;
        }
        if (!parsed || typeof parsed !== 'object' || !parsed.plan ||
            !Array.isArray(parsed.plan.steps) || Number(parsed.version) !== RECORD_VERSION) {
            _state = null;
            return null;
        }
        const index = Number(parsed.index);
        _state = {
            version: RECORD_VERSION,
            date: String(parsed.date || ''),
            index: (isFinite(index) && index >= 0) ? Math.min(index, parsed.plan.steps.length) : 0,
            startedAt: _isFiniteNumber(parsed.startedAt) ? parsed.startedAt : null,
            updatedAt: _isFiniteNumber(parsed.updatedAt) ? parsed.updatedAt : null,
            plan: parsed.plan,
            previous: parsed.previous || null
        };
        // Re-derive the verdict rather than trusting a stored boolean: surfaces
        // can change between two loads (a content file failed to fetch, app.js
        // registered a gate predicate), and a stale `meetsFrSes1: true` would be
        // exactly the overstatement BR-3 forbids.
        if (!_isFiniteNumber(_state.plan.shortMinutes)) _state.plan.shortMinutes = 0;
        _annotate(_state.plan);
        if (_isFiniteNumber(now) && _state.date !== _dateKey(now)) _state.stale = true;
        return _state;
    }

    function save() {
        if (!_state) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                version: RECORD_VERSION,
                date: _state.date,
                index: _state.index,
                startedAt: _state.startedAt,
                updatedAt: _state.updatedAt,
                plan: _state.plan,
                previous: _state.previous
            }));
        } catch (e) {
            if (global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                global.AppErrorHandler.logError(e, 'Session save');
            }
        }
    }

    /** The last finished session's summary, for streak/preview copy. */
    function previous() {
        if (!_state) load();
        return _state ? (_state.previous || null) : null;
    }

    function reset() {
        _state = null;
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) { /* ignore */ }
    }

    // ==================================================================
    // Export
    // ==================================================================

    const Session = {
        STORAGE_KEY: STORAGE_KEY,
        RECORD_VERSION: RECORD_VERSION,
        TARGET_MINUTES: TARGET_MINUTES,
        MIN_MINUTES: MIN_MINUTES,
        MAX_MINUTES: MAX_MINUTES,
        SHAPE_MINUTES: SHAPE_MINUTES,
        REDISTRIBUTE_CEILING: REDISTRIBUTE_CEILING,
        OUTCOMES: OUTCOMES,
        SHAPE: SHAPE,
        STRANDS: STRANDS,
        SURFACES: SURFACES,

        build: build,
        availability: availability,
        plan: plan,
        current: current,
        advance: advance,
        skip: skip,
        markSilent: markSilent,
        progress: progress,
        productionSummary: productionSummary,
        wrapUp: wrapUp,
        resolveSilentTension: resolveSilentTension,

        registerSurfaces: registerSurfaces,
        resetSurfaces: resetSurfaces,
        surface: surface,

        strandOfSection: strandOfSection,
        strandLabel: strandLabel,
        unclassifiedSections: unclassifiedSections,
        countsHeldBack: countsHeldBack,

        load: load,
        save: save,
        previous: previous,
        reset: reset,

        // Test seams, named so it is obvious they are not the public path.
        _dateKey: _dateKey,
        _dueQueue: _dueQueue,
        _state: function () { return _state; }
    };

    global.Session = Session;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Session;
    }
// `globalThis`, not `this`: under CommonJS a bare top-level `this` is
// module.exports, which would make every `global.Sections` / `global.SRS` lookup
// resolve against an empty object. Same fix as srs.js's closing note.
})(typeof window !== 'undefined' ? window : globalThis);
