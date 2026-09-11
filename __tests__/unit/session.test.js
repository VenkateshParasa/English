/**
 * Session sequencer — US-801 / FR-SES-1.
 *
 * ⚠️  UNRUN. jest is not installed in this checkout (`node_modules` has no
 * jest binary), so this file has NEVER been executed and must not be described
 * as passing. It was written alongside a plain-node harness that exercises the
 * same scenarios and DID run; the assertions below are that harness's, expressed
 * as jest cases. Treat any failure here as "the test was never run", not as a
 * regression, until someone installs jest and runs it once.
 *
 * WHAT IS STUBBED AND WHY
 * `Sections` is the REAL registry (js/core/sections.js is pure data and pure
 * functions), with stubbed content probes registered through its own public
 * registerContent() — so these tests exercise the real availability path rather
 * than a parallel fake of it. `SRS` and `Mistakes` are stubbed, because the
 * point of most cases here is "given exactly 40 due items" / "given exactly this
 * top mistake", and driving that through the real modules would be testing them
 * instead. Both stubs are installed on `global` BEFORE session.js is required,
 * which is what stops session.js pulling in the real ones.
 */

const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const NOW = Date.UTC(2026, 8, 10, 12, 0, 0);      // fixed clock; local-day safe at midday

// ---------------------------------------------------------------------------
// Stubs, installed before the module under test is loaded
// ---------------------------------------------------------------------------

const Sections = require(path.join(ROOT, 'js', 'core', 'sections.js'));
require(path.join(ROOT, 'js', 'core', 'levels.js'));
global.Sections = Sections;

/** The content actually authored as of 2026-09-10. */
const REAL_CONTENT = {
    vocabulary: l => ({ foundation: 60, everyday: 60, confident: 60, fluent: 40 }[l] || 0),
    sentences: l => ({ foundation: 5, everyday: 5, confident: 5, fluent: 5 }[l] || 0),
    reading: l => ({ foundation: 2, everyday: 2, confident: 1, fluent: 0 }[l] || 0),
    listening: l => ({ foundation: 30, everyday: 30, confident: 30, fluent: 0 }[l] || 0),
    puzzles: l => ({ foundation: 3, everyday: 3, confident: 3, fluent: 0 }[l] || 0),
    // Two authored points, foundation only.
    grammar: l => (l === 'foundation' ? 2 : 0),
    // Eight pair sets, reported at foundation only — see the probe comment in app.js.
    pronunciation: l => (l === 'foundation' ? 8 : 0)
};
const NO_CONTENT = Object.keys(REAL_CONTENT).reduce((m, k) => { m[k] = () => 0; return m; }, {});

const SRSstub = {
    TYPES: ['vocab', 'gram', 'phon', 'coll'],
    DAILY_REVIEW_CAP: 20,
    _queues: { vocab: [], gram: [], phon: [], coll: [] },
    _cap(limit) {
        return (typeof limit === 'number' && isFinite(limit) && limit >= 0) ? limit : 20;
    },
    getDue(type, opts) {
        const cap = this._cap(opts && opts.limit);
        if (type) return this._queues[type].slice(0, cap);
        const qs = this.TYPES.map(t => this._queues[t]).filter(q => q.length);
        const out = [];
        for (let i = 0; out.length < cap; i++) {
            let placed = false;
            for (const q of qs) {
                if (i < q.length) { out.push(q[i]); placed = true; if (out.length >= cap) break; }
            }
            if (!placed) break;
        }
        return out;
    },
    totalDueCount(type) {
        return type ? this._queues[type].length
                    : this.TYPES.reduce((n, t) => n + this._queues[t].length, 0);
    },
    countDue(t) { return this.totalDueCount(t); },
    dueCount(t) { return Math.min(20, this.totalDueCount(t || 'vocab')); },
    _seed(type, n) {
        this._queues[type] = Array.from({ length: n }, (_, i) => ({
            type, ref: `${type}-${i}`, key: `${type}:${type}-${i}`, data: {}
        }));
    },
    _clear() { this.TYPES.forEach(t => { this._queues[t] = []; }); }
};
global.SRS = SRSstub;

const MistakesStub = {
    _rows: [],
    topCategories() { return this._rows.slice(); },
    drillTarget(id) {
        const row = this._rows.find(r => r.id === id);
        return row ? row.drill : null;
    },
    _set(rows) { this._rows = rows; }
};
global.Mistakes = MistakesStub;

const Session = require(path.join(ROOT, 'js', 'core', 'session.js'));

// ---------------------------------------------------------------------------

const ARTICLES_MISTAKE = {
    id: 'gram.articles',
    label: 'missing or wrong a / an / the',
    count: 11,
    trend: 'steady',
    drill: {
        categoryId: 'gram.articles',
        label: 'missing or wrong a / an / the',
        strand: 'grammar',
        target: 'articles',
        srsKey: 'gram:articles'
    }
};

const VW_MISTAKE = {
    id: 'phon.v-w',
    label: '/v/ and /w/ merged',
    count: 4,
    trend: 'improving',
    drill: { strand: 'pronunciation', target: 'v-w', srsKey: 'phon:v-w' }
};

const build = (over = {}) => Session.build(Object.assign(
    { minutes: 20, level: 'foundation', now: NOW, fresh: true }, over));

const stepIds = plan => plan.steps.map(s => s.id);
const stepById = (plan, id) => plan.steps.find(s => s.id === id) || null;
const productionStep = plan => plan.steps.find(s => s.production) || null;

beforeEach(() => {
    localStorage.clear();
    Session.reset();
    Session.resetSurfaces();
    SRSstub._clear();
    MistakesStub._set([]);
    Sections.registerContent(REAL_CONTENT);
});

// ===========================================================================
describe('policy constants', () => {
    it('targets §4\'s 20 minutes and BR-1\'s 15-minute floor', () => {
        expect(Session.TARGET_MINUTES).toBe(20);
        expect(Session.MIN_MINUTES).toBe(15);
    });

    it('has one shape row per §4 table row, in §4\'s order', () => {
        expect(Session.SHAPE.map(s => s.id)).toEqual([
            'review', 'grammar', 'pronunciation', 'listen', 'speak', 'wrapUp'
        ]);
    });

    it('§4\'s minutes sum to 20', () => {
        expect(Session.SHAPE.reduce((n, s) => n + s.minutes, 0)).toBe(20);
    });

    it('keeps its own storage key and never names the other two', () => {
        expect(Session.STORAGE_KEY).toBe('sessionPlan');
        expect(Session.STORAGE_KEY).not.toBe('learningProgress');
        expect(Session.STORAGE_KEY).not.toBe('srsData');
    });
});

// ===========================================================================
describe('strand derivation reads the registry', () => {
    it('derives a strand from each row\'s srsType', () => {
        expect(Session.strandOfSection('vocabulary')).toBe('A');
        expect(Session.strandOfSection('grammar')).toBe('B');
        expect(Session.strandOfSection('pronunciation')).toBe('C');
    });

    it('classifies the rows that have no scheduler type', () => {
        expect(Session.strandOfSection('listening')).toBe('D');
        expect(Session.strandOfSection('reading')).toBe('F');
        // Deliberately not a §3 strand, which is different from unclassified.
        expect(Session.strandOfSection('puzzles')).toBeNull();
        expect(Session.strandOfSection('dashboard')).toBeNull();
    });

    it('reports a section the registry knows and this file does not', () => {
        // The guard that makes "added a section, forgot the sequencer" loud.
        expect(Session.unclassifiedSections()).toEqual([]);
    });

    it('returns undefined for a section that does not exist', () => {
        expect(Session.strandOfSection('nope')).toBeUndefined();
    });
});

// ===========================================================================
describe('(a) a first-ever session: no history, nothing due', () => {
    it('does not open with an empty review step', () => {
        const plan = build();
        expect(stepIds(plan)[0]).not.toBe('review');
        expect(stepById(plan, 'review')).toBeNull();
    });

    it('says why review was left out instead of just being shorter', () => {
        const plan = build();
        const omission = plan.omitted.find(o => o.stepId === 'review');
        expect(omission).toBeTruthy();
        expect(omission.reason).toMatch(/Nothing is due/);
    });

    it('still covers three strands, one of them Speaking, ending in production', () => {
        const plan = build();
        expect(plan.strands.length).toBeGreaterThanOrEqual(3);
        expect(plan.strands).toContain('E');
        expect(plan.checks.endsWithProduction).toBe(true);
        expect(plan.meetsFrSes1).toBe(true);
    });

    it('works with no mistake history and says targeting is off', () => {
        const plan = build();
        expect(plan.targeting).toBeNull();
        expect(plan.notes.join(' ')).toMatch(/No mistake history yet/);
    });

    it('fills the budget by redistributing the dropped review minutes', () => {
        const plan = build();
        expect(plan.minutes).toBeGreaterThanOrEqual(19);
        expect(plan.shortMinutes).toBe(0);
    });
});

// ===========================================================================
describe('(b) a backlog of 40 due items', () => {
    beforeEach(() => {
        SRSstub._seed('vocab', 28);
        SRSstub._seed('gram', 8);
        SRSstub._seed('phon', 4);
    });

    it('puts review first, as §4 requires', () => {
        expect(stepIds(build())[0]).toBe('review');
    });

    it('never exceeds FR-SRS-4\'s daily cap, and does not re-implement it', () => {
        const review = stepById(build(), 'review');
        expect(review.count).toBeLessThanOrEqual(SRSstub.DAILY_REVIEW_CAP);
        // 3 minutes at 4 items/min. The cap is not the binding constraint here —
        // the minute budget is — which is the point: the queue is read, not
        // recomputed, and then count-boxed to fit the session.
        expect(review.count).toBe(12);
    });

    it('queues every item type the review screen can draw, and only those', () => {
        // US-177 widened SURFACES['srs.review'].types from ['vocab'] to
        // ['vocab', 'gram', 'phon'], because app.js startReview() now walks
        // SRS.getDue(null) and switches on (type, shape). The interesting
        // assertion is no longer "vocabulary only" — it is that the queue is
        // exactly the declared set, so a type the screen cannot draw could still
        // never reach a step. `coll` is the one still outside it.
        const review = stepById(build(), 'review');
        const types = review.items.map(i => i.type);
        expect(new Set(types)).toEqual(new Set(['vocab', 'gram', 'phon']));
        expect(types.every(t => Session.surface('srs.review').types.indexOf(t) !== -1)).toBe(true);
    });

    it('reports the due items it cannot show rather than calling them done', () => {
        // Nothing is held back in this build any more: the three types this stub
        // seeds are all drawable. The mechanism is what is under test, so it is
        // exercised by NARROWING the surface — which is also what a build that
        // loses a renderer would look like.
        expect(stepById(build(), 'review').heldBack).toEqual([]);

        Session.registerSurfaces({ 'srs.review': { available: true, types: ['vocab'] } });
        const held = stepById(build(), 'review').heldBack;
        expect(held.map(h => h.type).sort()).toEqual(['gram', 'phon']);
        expect(held.reduce((n, h) => n + h.count, 0)).toBe(12);
        expect(held[0].reason).toMatch(/no screen renders/);
    });

    it('scales the counts down for P1 Ravi\'s 15-minute commute', () => {
        const twenty = stepById(build({ minutes: 20 }), 'review').count;
        const fifteen = stepById(build({ minutes: 15 }), 'review').count;
        expect(fifteen).toBeLessThan(twenty);
        expect(fifteen).toBeGreaterThan(0);
    });

    it('keeps three strands and a closing production at 15 minutes', () => {
        const plan = build({ minutes: 15 });
        expect(plan.strands.length).toBeGreaterThanOrEqual(3);
        expect(plan.checks.endsWithProduction).toBe(true);
        expect(Math.abs(plan.minutes - 15)).toBeLessThanOrEqual(0.5);
    });
});

// ===========================================================================
describe('(c) a learner with a clear top mistake', () => {
    it('steers the matching step without changing the §4 order', () => {
        MistakesStub._set([ARTICLES_MISTAKE, VW_MISTAKE]);
        SRSstub._seed('vocab', 6);
        const plan = build();
        expect(stepIds(plan)).toEqual(['review', 'grammar', 'pronunciation', 'listen', 'speak', 'wrapUp']);
        expect(plan.targeting.stepId).toBe('grammar');
        expect(plan.targeting.ref).toBe('articles');
        expect(plan.targeting.srsKey).toBe('gram:articles');
        expect(plan.targeting.rank).toBe(1);
        expect(stepById(plan, 'grammar').target.categoryId).toBe('gram.articles');
    });

    it('never retargets the review step, whose order belongs to SRS', () => {
        MistakesStub._set([ARTICLES_MISTAKE]);
        SRSstub._seed('vocab', 6);
        expect(stepById(build(), 'review').target).toBeNull();
    });

    it('falls through to the next category when the top one is not drillable here', () => {
        MistakesStub._set([
            { id: 'coll.chunks', label: 'wrong collocation', count: 9, trend: 'steady',
              drill: { strand: 'collocation', target: null, srsKey: null } },
            VW_MISTAKE
        ]);
        const plan = build();
        expect(plan.targeting.stepId).toBe('pronunciation');
        expect(plan.targeting.rank).toBe(2);
    });

    it('says so, rather than silently not targeting, when nothing is drillable', () => {
        MistakesStub._set([
            { id: 'coll.chunks', label: 'wrong collocation', count: 9, trend: 'steady',
              drill: { strand: 'collocation', target: null, srsKey: null } }
        ]);
        const plan = build();
        expect(plan.targeting).toBeNull();
        expect(plan.notes.join(' ')).toMatch(/nothing drillable/);
    });

    it('survives a mistake log that throws', () => {
        MistakesStub.topCategories = () => { throw new Error('boom'); };
        expect(() => build()).not.toThrow();
        MistakesStub.topCategories = function () { return this._rows.slice(); };
    });
});

// ===========================================================================
describe('(d) a learner who has finished everything available today', () => {
    const ALL = ['vocabulary', 'sentences', 'reading', 'listening', 'puzzles',
                 'grammar', 'pronunciation'];

    it('still produces a walkable plan rather than an empty screen', () => {
        const plan = build({ exhausted: ALL });
        expect(plan.empty).toBe(false);
        expect(plan.taskCount).toBeGreaterThanOrEqual(3);
    });

    it('labels every re-run step as a second pass instead of hiding it', () => {
        const plan = build({ exhausted: ALL });
        const content = plan.steps.filter(s => s.sectionId);
        expect(content.length).toBeGreaterThan(0);
        expect(content.every(s => s.repeat === true)).toBe(true);
        expect(content[0].reduced.join(' ')).toMatch(/already finished/);
    });

    it('keeps the closing production, which is always re-runnable', () => {
        const plan = build({ exhausted: ALL });
        expect(plan.checks.endsWithProduction).toBe(true);
        expect(plan.meetsFrSes1).toBe(true);
    });

    it('resumes a finished plan instead of silently starting a second one', () => {
        build({ exhausted: ALL });
        let guard = 0;
        while (Session.advance() !== null && guard++ < 20) { /* walk to the end */ }
        expect(Session.progress().complete).toBe(true);

        const again = Session.build({ minutes: 20, level: 'foundation', now: NOW });
        expect(again.resumed).toBe(true);
        expect(Session.progress().complete).toBe(true);
    });

    it('writes a previous-session summary for the streak copy', () => {
        const plan = build({ exhausted: ALL });
        let guard = 0;
        while (Session.advance() !== null && guard++ < 20) { /* walk */ }
        const prev = Session.previous();
        expect(prev.steps).toBe(plan.steps.length);
        expect(prev.done).toBe(plan.steps.length);
    });
});

// ===========================================================================
describe('(e) content missing entirely', () => {
    beforeEach(() => { Sections.registerContent(NO_CONTENT); });

    it('does not throw, and returns a plan object', () => {
        const plan = build();
        expect(Array.isArray(plan.steps)).toBe(true);
    });

    it('reports itself as empty rather than pretending to be a session', () => {
        const plan = build();
        expect(plan.empty).toBe(true);
        expect(plan.taskCount).toBe(0);
    });

    it('fails FR-SES-1 explicitly, naming each unmet criterion', () => {
        const plan = build();
        expect(plan.meetsFrSes1).toBe(false);
        expect(plan.checks.threeStrands).toBe(false);
        expect(plan.checks.speakingStrand).toBe(false);
        expect(plan.checks.endsWithProduction).toBe(false);
        expect(plan.shortfall.join(' ')).toMatch(/at least three strands/);
        expect(plan.shortfall.join(' ')).toMatch(/Speaking strand/);
        expect(plan.shortfall.join(' ')).toMatch(/end with a spoken production/);
    });

    it('lists every dropped step with a reason', () => {
        const plan = build();
        const whole = plan.omitted.filter(o => !o.partial);
        expect(whole.length).toBeGreaterThanOrEqual(4);
        expect(whole.every(o => typeof o.reason === 'string' && o.reason.length > 0)).toBe(true);
        expect(whole.find(o => o.stepId === 'grammar').reason).toMatch(/No grammar content authored/);
    });

    it('is honest that BR-2 cannot be met', () => {
        build();
        const summary = Session.productionSummary();
        expect(summary.planned).toBe(false);
        expect(summary.note).toMatch(/cannot satisfy BR-2/);
    });

    it('still enumerates every §4 row, so the UI can say what is missing', () => {
        const report = Session.availability({ level: 'foundation', now: NOW });
        expect(report.steps.map(s => s.id)).toEqual(Session.SHAPE.map(s => s.id));
        expect(report.steps.every(s => s.ok === false)).toBe(false);   // wrapUp survives
        expect(report.strands).toEqual([]);
    });
});

// ===========================================================================
describe('the surface registry', () => {
    it('upgrades the production step when FR-SPK-3 ships', () => {
        expect(productionStep(build()).production.surface).toBe('grammar.produce');
        Session.registerSurfaces({ 'speak.free': true });
        expect(productionStep(build()).production.surface).toBe('speak.free');
    });

    it('lets the review screen narrow again if a renderer is lost', () => {
        // The baseline is ['vocab', 'gram', 'phon'] since US-177, so widening is
        // no longer the interesting direction — narrowing is. A build that could
        // only draw vocabulary must plan a vocabulary-only review step and report
        // the rest as held back, which is what keeps the planner honest either way.
        SRSstub._seed('vocab', 6);
        SRSstub._seed('gram', 4);
        SRSstub._seed('phon', 2);
        expect(stepById(build(), 'review').strands.sort()).toEqual(['A', 'B', 'C']);
        expect(stepById(build(), 'review').heldBack).toEqual([]);

        Session.registerSurfaces({ 'srs.review': { available: true, types: ['vocab'] } });
        const narrowed = stepById(build({ fresh: true }), 'review');
        expect(narrowed.strands).toEqual(['A']);
        expect(narrowed.heldBack.map(h => h.type).sort()).toEqual(['gram', 'phon']);
    });

    it('accepts a predicate, for FR-PRN-6\'s per-pair gate', () => {
        let open = false;
        Session.registerSurfaces({ 'pron.produce': () => ({ available: open }) });
        expect(Session.surface('pron.produce').available).toBe(false);
        open = true;
        expect(Session.surface('pron.produce').available).toBe(true);
    });

    it('treats a throwing predicate as unavailable rather than crashing', () => {
        Session.registerSurfaces({ 'speak.free': () => { throw new Error('boom'); } });
        expect(Session.surface('speak.free').available).toBe(false);
        expect(() => build()).not.toThrow();
    });

    it('warns about an unknown surface name instead of ignoring the typo', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        Session.registerSurfaces({ 'speak.freee': true });
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('resetSurfaces restores the documented baseline', () => {
        Session.registerSurfaces({ 'speak.free': true });
        Session.resetSurfaces();
        expect(Session.surface('speak.free').available).toBe(false);
    });
});

// ===========================================================================
describe('walking the plan, and resume', () => {
    beforeEach(() => { SRSstub._seed('vocab', 10); });

    it('hands out one step at a time, so there is no menu choice', () => {
        const plan = build();
        expect(plan.checks.noChoices).toBe(true);
        expect(Session.current().id).toBe(plan.steps[0].id);
    });

    it('records an outcome and moves on', () => {
        build();
        expect(Session.current().id).toBe('review');
        const next = Session.advance('done');
        expect(next.id).toBe('grammar');
        expect(stepById(Session.plan(), 'review').status).toBe('done');
        expect(stepById(Session.plan(), 'review').outcome).toBe('done');
    });

    it('resumes at the exact position after a reload', () => {
        build();
        Session.advance('done');
        Session.advance('done');
        const index = Session.progress().index;
        const stepId = Session.current().id;

        // A page reload: same localStorage, a brand-new module instance.
        const modulePath = require.resolve(path.join(ROOT, 'js', 'core', 'session.js'));
        delete require.cache[modulePath];
        const Reloaded = require(modulePath);

        const resumed = Reloaded.build({ minutes: 20, level: 'foundation', now: NOW });
        expect(resumed.resumed).toBe(true);
        expect(Reloaded.progress().index).toBe(index);
        expect(Reloaded.current().id).toBe(stepId);
        expect(resumed.steps.slice(0, 2).every(s => s.status === 'done')).toBe(true);
    });

    it('writes only its own key', () => {
        build();
        Session.advance('done');
        expect(localStorage.getItem('sessionPlan')).toBeTruthy();
        expect(localStorage.getItem('learningProgress')).toBeNull();
        expect(localStorage.getItem('srsData')).toBeNull();
    });

    it('does not resume yesterday\'s plan into today', () => {
        build({ now: NOW });
        Session.advance('done');
        const tomorrow = NOW + 24 * 60 * 60 * 1000;
        const fresh = Session.build({ minutes: 20, level: 'foundation', now: tomorrow });
        expect(fresh.resumed).toBe(false);
        expect(fresh.date).not.toBe(Session.previous().date);
    });

    it('carries an unfinished session forward as `previous`', () => {
        build({ now: NOW });
        Session.advance('done');
        Session.build({ minutes: 20, level: 'foundation', now: NOW + 24 * 60 * 60 * 1000 });
        expect(Session.previous()).toBeTruthy();
        expect(Session.previous().done).toBe(1);
    });

    it('survives corrupt storage', () => {
        localStorage.setItem('sessionPlan', '{not json');
        expect(Session.load(NOW)).toBeNull();
        expect(() => build()).not.toThrow();
    });

    it('re-derives the FR-SES-1 verdict on load rather than trusting a stored flag', () => {
        build();
        const raw = JSON.parse(localStorage.getItem('sessionPlan'));
        raw.plan.meetsFrSes1 = true;
        raw.plan.steps = [];                       // a plan with nothing in it
        localStorage.setItem('sessionPlan', JSON.stringify(raw));
        const record = Session.load(NOW);
        expect(record.plan.meetsFrSes1).toBe(false);
    });
});

// ===========================================================================
describe('the silent-learner tension (BR-2 vs FR-A11Y-4 / P2 Lakshmi)', () => {
    beforeEach(() => { SRSstub._seed('vocab', 8); });

    it('keeps the production step in the plan in silent mode', () => {
        const plan = build({ silent: true });
        const speak = productionStep(plan);
        expect(speak).toBeTruthy();
        expect(speak.required).toBe(true);
    });

    it('offers two completion routes, neither needing a microphone', () => {
        const speak = productionStep(build({ silent: true }));
        expect(speak.completion).toEqual(['aloud', 'silent']);
        expect(speak.silentPath).toBe(true);
        expect(Session.resolveSilentTension().micRequired).toBe(false);
    });

    it('defaults to the silent route in silent mode, and aloud otherwise', () => {
        expect(productionStep(build({ silent: true })).defaultOutcome).toBe('silent');
        expect(productionStep(build({ silent: false })).defaultOutcome).toBe('aloud');
    });

    it('lets a silent learner finish start to finish', () => {
        build({ silent: true });
        let guard = 0;
        while (Session.current() && guard++ < 20) {
            if (Session.current().production) Session.markSilent('sub-vocalised');
            else Session.advance('done');
        }
        expect(Session.progress().complete).toBe(true);
        const summary = Session.productionSummary();
        expect(summary.completed).toBe(true);
        expect(summary.route).toBe('silent');
    });

    it('never claims it verified the speech', () => {
        build();
        let guard = 0;
        while (Session.current() && guard++ < 20) {
            if (Session.current().production) { Session.advance('aloud'); break; }
            Session.advance('done');
        }
        const summary = Session.productionSummary();
        expect(summary.route).toBe('aloud');
        expect(summary.selfReported).toBe(true);
    });

    it('counts a skipped production as no production, not as one', () => {
        build();
        let guard = 0;
        while (Session.current() && guard++ < 20) {
            if (Session.current().production) Session.skip('not now');
            else Session.advance('done');
        }
        expect(Session.progress().complete).toBe(true);
        const summary = Session.productionSummary();
        expect(summary.route).toBe('skipped');
        expect(summary.completed).toBe(false);
    });

    it('names the routes that satisfy BR-2 and the ones that only complete the step', () => {
        const r = Session.resolveSilentTension();
        expect(r.routesThatSatisfyBr2).toEqual(['aloud', 'silent']);
        expect(r.routesThatCompleteTheStep).toContain('skipped');
        expect(r.productionAlwaysPlanned).toBe(true);
    });

    it('rejects an unrecognised outcome by falling back to the step default', () => {
        build();
        Session.advance('nonsense');
        expect(stepById(Session.plan(), 'review').outcome).toBe('done');
    });

    it('does not let a non-speaking step be marked with a speaking route', () => {
        // Otherwise productionSummary() would be reading a route that never
        // meant anything on that step.
        build();
        Session.advance('silent');
        expect(stepById(Session.plan(), 'review').outcome).toBe('done');
    });

    it('always accepts a skip, on every step (FR-A11Y-4)', () => {
        build();
        expect(Session.plan().steps.every(s => s.completion.concat(['skipped']).includes('skipped'))).toBe(true);
        Session.skip('later');
        expect(stepById(Session.plan(), 'review').status).toBe('skipped');
    });
});

// ===========================================================================
describe('degradation is honest, not silent', () => {
    it('reports how short a degraded plan is instead of quietly shrinking', () => {
        Sections.registerContent(Object.assign({}, NO_CONTENT, { grammar: l => (l === 'foundation' ? 2 : 0) }));
        const plan = build();
        expect(plan.shortMinutes).toBeGreaterThan(0);
        expect(plan.shortfall.join(' ')).toMatch(/minutes short/);
        expect(plan.checks.fullBudget).toBe(false);
    });

    it('clamps redistribution so one strand cannot fill the whole session', () => {
        Sections.registerContent(Object.assign({}, NO_CONTENT, { grammar: l => (l === 'foundation' ? 2 : 0) }));
        const plan = build();
        const grammar = stepById(plan, 'grammar');
        expect(grammar.minutes).toBeLessThanOrEqual(4 * Session.REDISTRIBUTE_CEILING);
    });

    it('fails the three-strand check when only one strand has content', () => {
        Sections.registerContent(Object.assign({}, NO_CONTENT, { grammar: l => (l === 'foundation' ? 2 : 0) }));
        const plan = build();
        expect(plan.checks.threeStrands).toBe(false);
        // Speaking still resolves, because grammar.produce is a grammar surface.
        expect(plan.production.surface).toBe('grammar.produce');
    });

    it('names which part of a step degraded, not just the step', () => {
        const listen = stepById(build(), 'listen');
        expect(listen.reduced.join(' ')).toMatch(/comprehension question/);
        expect(listen.reduced.join(' ')).toMatch(/Shadowing/);
        const parts = build().omitted.filter(o => o.partial && o.stepId === 'listen');
        expect(parts.map(p => p.requirement).sort()).toEqual(['FR-LSN-1', 'FR-SPK-8']);
    });

    it('does not throw on a tier with no content anywhere', () => {
        expect(() => build({ level: 'fluent' })).not.toThrow();
    });

    it('does not throw when SRS is absent altogether', () => {
        const saved = global.SRS;
        delete global.SRS;
        expect(() => build()).not.toThrow();
        global.SRS = saved;
    });

    it('does not throw when the section registry is absent', () => {
        const saved = global.Sections;
        delete global.Sections;
        expect(() => build()).not.toThrow();
        global.Sections = saved;
    });
});

// ===========================================================================
describe('availability(), for the pre-session UI', () => {
    it('reports every shape row with its parts, without building a plan', () => {
        const report = Session.availability({ level: 'foundation', now: NOW });
        expect(report.steps.map(s => s.id)).toEqual(Session.SHAPE.map(s => s.id));
        expect(Session.plan()).toBeNull();
    });

    it('names the unbuilt surfaces behind each unavailable part', () => {
        const listen = Session.availability({ level: 'foundation', now: NOW })
            .steps.find(s => s.id === 'listen');
        const comprehend = listen.parts.find(p => p.id === 'comprehend');
        expect(comprehend.ok).toBe(false);
        expect(comprehend.requirement).toBe('FR-LSN-1');
    });
});

// ===========================================================================
describe('wrapUp() — FR-SES-5', () => {
    it('returns what it knows and names what it cannot know', () => {
        SRSstub._seed('vocab', 4);
        build();
        let guard = 0;
        while (Session.current() && guard++ < 20) Session.advance();
        const wrap = Session.wrapUp();
        expect(wrap.complete).toBe(true);
        expect(wrap.strandsCovered.length).toBeGreaterThanOrEqual(3);
        expect(wrap.production.route).toBeTruthy();
        // Streak lives in learningProgress and the fluency trend does not exist
        // yet (FR-SPK-5). Named, not invented.
        expect(wrap.needsFromApp).toEqual(['streak', 'fluencyTrend', 'tomorrowPreview']);
    });
});
