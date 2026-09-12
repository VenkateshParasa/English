/**
 * Mistake log — errors categorised by TYPE
 * -------------------------------------------------------------
 * FR-SRS-3 / BR-5 / TEACHING_METHODOLOGY.md principle 4 ("Errors are the
 * syllabus"). The point of this module is not that it counts wrong answers —
 * "you got 14 questions wrong" tells a learner nothing they can act on. The
 * point is the TAXONOMY: "missing or wrong a / an / the — 11 times this month"
 * is a diagnosis, and a diagnosis is what persona P4 (Anusha, C1, fluent for
 * 15 years, nobody has ever told her what marks her out) actually came for.
 *
 * Design commitments, each of which is a requirement rather than a preference:
 *
 *  - The taxonomy is DATA, not logic (FR-CNT-3 / BR-10). Every row is one
 *    object in CATEGORIES; a second L1 profile adds rows through
 *    registerCategories() and needs no change to this file or to app.js.
 *  - Rows derived from REQUIREMENTS.md §3 carry their table code (`T-G1`,
 *    `T-P5`, ...) so the mapping back to the requirement is checkable.
 *  - It NEVER READS CONTENT. `data/grammar/*`, `data/pronunciation/*` and the
 *    L1 profiles all load AFTER this module, and its own suite runs with none of
 *    them present, so anything it needs to know about authored content arrives by
 *    registration and is absent by default: registerCategories() for rows,
 *    registerDrillTargets() for the destinations those rows point at (US-187).
 *    Absent is a THIRD state, never a `false` — see isAuthoredTarget().
 *  - Learner-facing wording follows TEACHING_METHODOLOGY.md §5: addressed as
 *    *you*, specific, framed as normal and temporary, no gamification.
 *  - Evidence strength is tracked and never laundered. A speech recogniser
 *    miss is not the same claim as a graded wrong answer (BR-3, FR-SRS-5,
 *    FR-PRN-5), so it is stored under a weaker evidence class and is kept out
 *    of the ranked diagnosis entirely. See EVIDENCE below.
 *  - Its own localStorage key (`mistakeLog`). It never touches
 *    `learningProgress` or `srsData`.
 *
 * Public API (window.Mistakes):
 *   -- taxonomy --
 *   Mistakes.CATEGORIES                  the built-in rows (read this, do not mutate)
 *   Mistakes.categories(opts)            -> copies, optionally filtered
 *   Mistakes.getCategory(id)             -> copy of one row, or null
 *   Mistakes.isKnownCategory(id)         -> boolean
 *   Mistakes.categoryIds(opts)           -> registered ids, same filters as categories()
 *   Mistakes.unknownCategories(ids)      -> the ids in `ids` that are not registered
 *   Mistakes.registerCategories(rows)    -> { added, replaced, rejected } (FR-CNT-3)
 *   Mistakes.resetCategories()           -> back to the built-ins
 *   Mistakes.drillTarget(id)             -> { strand, target, srsKey, targets, srsKeys,
 *                                            authored, liveTargets, deadTargets, label } | null
 *   -- which drill targets content has actually authored (US-187) --
 *   Mistakes.registerDrillTargets(strand, targets)  -> { strand, added, known, ignored }
 *   Mistakes.authoredTargets(strand)     -> the targets registered for that strand
 *   Mistakes.isAuthoredTarget(s, t)      -> true | false | null (null = no claim)
 *   Mistakes.resetDrillTargets(strand)   -> forget them again; how many went
 *   -- recording --
 *   Mistakes.record(categoryId, opts)    -> the stored entry, or null
 *   Mistakes.recordMany(ids, opts)       -> [entry, ...] (the ones that stored)
 *   -- querying --
 *   Mistakes.topCategories(opts)         -> ranked rows, default top 5 / 30 days
 *   Mistakes.countsByCategory(opts)      -> { id: { count, unverifiedCount } }
 *   Mistakes.history(categoryId, opts)   -> that category's entries, newest first
 *   Mistakes.entries(opts)               -> copies of raw entries
 *   Mistakes.stats()                     -> log size / evidence split / span
 *   -- housekeeping --
 *   Mistakes.load() / save() / prune() / reset()
 *   Mistakes.EVIDENCE, WINDOW_DAYS, HALF_LIFE_DAYS, RETENTION_DAYS,
 *   Mistakes.MAX_ENTRIES, TOP_N
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'mistakeLog';
    const LOG_VERSION = 1;
    const DAY_MS = 24 * 60 * 60 * 1000;

    // ------------------------------------------------------------------
    // Policy constants
    // ------------------------------------------------------------------

    // FR-SRS-3 asks for "their top 5 for the last 30 days", and M-7 measures
    // "top-5 recurring mistake decay over 30 days". Both are parameters here so
    // the same code answers "and what did it look like three months ago?".
    const WINDOW_DAYS = 30;
    const TOP_N = 5;

    // Decay. The 30-day window is a hard edge — outside it, an occurrence
    // contributes nothing at all — and inside it occurrences are weighted by
    // recency with a 14-day half-life, so today's mistake counts double one
    // from a fortnight ago and four times one from a month ago.
    //
    // Why both, rather than a plain count inside the window: a learner who made
    // eleven article errors in the first ten days of the month and none since
    // has fixed the thing, and a plain count would still rank it first for
    // another three weeks. That is the specific failure this constant exists to
    // prevent. Half the window is chosen so that the oldest occurrence the
    // window admits is worth roughly a quarter of the newest — enough to
    // reorder two categories of similar size in favour of the live one, not
    // enough to let a single mistake yesterday outrank a real pattern.
    //
    // The weighting orders the list. It is deliberately NOT what is shown: the
    // number the learner reads is the honest raw count (`count`), because
    // "article omission, 4.7 times" is not a sentence anyone should be handed.
    const HALF_LIFE_DAYS = 14;

    // Retention (CON-3: browser storage only, quota is a real limit). Entries
    // older than this are dropped on the next write. 120 days is four default
    // windows, which is what P4's actual question needs — "is the thing I was
    // doing in June still in my top 5 in September?" — and no more.
    const RETENTION_DAYS = 120;

    // Second retention layer: a hard entry cap, oldest dropped first. At the
    // ~110 bytes an entry costs, 1000 entries is ~110KB, which sits beside
    // srsData inside a 5MB budget without competing with it. At a realistic
    // 5-15 logged mistakes per session that is roughly 100 sessions, so the
    // date-based rule normally bites first and the cap is the backstop against
    // a runaway caller.
    const MAX_ENTRIES = 1000;

    // Free text kept per entry is truncated to this, so one pathological
    // caller cannot put a whole passage in the log.
    const MAX_TEXT_CHARS = 120;

    // Trend honesty. Below this many occurrences in the window there is no
    // trend to report, only noise, so the direction reads 'unclear'.
    const MIN_TREND_EVIDENCE = 4;

    // ...and the rate has to move by at least this much, relatively, before a
    // direction is named. Without a deadband every category flickers between
    // 'improving' and 'worsening' week to week.
    const TREND_DEADBAND = 0.25;

    /**
     * Evidence classes, strongest first.
     *
     *  graded     - the app knew the right answer and compared it to the
     *               learner's. This is the only class that counts as a
     *               diagnosis.
     *  self       - the learner marked their own work (FR-SRS-5 self-report,
     *               FR-PRN-4 self-comparison, FR-A11Y-4 skip-and-mark-done).
     *               Real signal, but AS-5 says self-assessment drifts towards
     *               self-flattery, so it is not evidence.
     *  recogniser - a browser speech recogniser did not match something
     *               (FR-SPK-1 read-aloud diff). This says as much about the
     *               microphone, the noise floor and the recogniser's accent
     *               model as it does about the learner, and FR-PRN-5 forbids
     *               scoring production at all.
     */
    const EVIDENCE = {
        GRADED: 'graded',
        SELF: 'self',
        RECOGNISER: 'recogniser'
    };

    const EVIDENCE_VALUES = [EVIDENCE.GRADED, EVIDENCE.SELF, EVIDENCE.RECOGNISER];

    // Only this class is counted as a diagnosis. Everything else is reported
    // beside the diagnosis as `unverifiedCount`, never folded into it.
    const VERIFIED = EVIDENCE.GRADED;

    // SRS namespaces per FR-SRS-1, so a category can hand the caller the exact
    // key the scheduler uses for the drill it points at.
    const SRS_NAMESPACE = {
        grammar: 'gram',
        pronunciation: 'phon',
        vocabulary: 'vocab',
        collocation: 'coll'
    };

    // ------------------------------------------------------------------
    // The taxonomy
    // ------------------------------------------------------------------
    //
    // One row per error type. Shape:
    //
    //   id          stable, namespaced, never renamed once shipped — it is what
    //               is written into storage
    //   code        REQUIREMENTS.md §3 table row, or null for a generic type
    //   strand      grammar | pronunciation | vocabulary | listening |
    //               reading | general
    //   l1          the first language this row is transfer from, or null for
    //               types that are not L1-specific
    //   priority    M / S / W, carried straight from §3
    //   label       what the learner reads in the top-5 list. §5 tone.
    //   explanation one line of why, also learner-facing
    //   example     wrong -> right, so the list teaches instead of only judging
    //   drill       { strand, target } for "practise this" — target is a
    //               CURRICULUM.md §3 grammar point slug or a phoneme pair id.
    //               null means there is nothing honest to drill. A row that is
    //               drilled by more than one item adds `alsoTargets: [...]`
    //               beside `target` (or writes `targets: [...]` instead); see
    //               `prn.th`, which covers both halves of T-P6. A target is a
    //               claim about the CURRICULUM, not about what is authored —
    //               drillTarget() answers the second question separately, and
    //               only from what content has registered (US-187).
    //   reportable  false = recorded but never ranked or shown as a diagnosis
    //
    // WHAT THESE ROWS DELIBERATELY DO NOT CARRY: WHETHER ANYTHING PRODUCES THEM.
    //
    // The question is a real one — an author choosing what to write next needs to
    // tell a row that is UNUSED (nothing has logged it on this device yet) from
    // one that is UNUSABLE (no gradable task exists that could log it at all), and
    // reading this file you cannot. At the time US-186 wired producers across the
    // app (2026-09-12) exactly four rows were in the second class: `vocab.recall`
    // (no production-from-meaning task), `vocab.collocation` (no collocation
    // content), `lsn.gist` (the listening section asks no comprehension question)
    // and `rdw.inference` (comprehension questions carry no type metadata, so
    // logging every wrong answer as "needed reading between the lines" would be a
    // false claim). That sentence is a DATED OBSERVATION and is written as one; the
    // live answer is in app.js, beside the code that would have to change —
    // mistakeDrillDestinations(), recordVocabMistake() and
    // comprehensionMistakeCategory() each say which id they do not produce and why.
    //
    // It is not a field, and that is a decision rather than an oversight. A
    // producer is a call site in app.js or in a content file, both of which load
    // after this module; a `producer: null` beside a row would be a second copy of
    // a fact this file cannot check, and would be wrong the moment someone wired
    // one — which is exactly the defect US-160 removed when data/grammar.js's
    // hand-copied MISTAKE_CATEGORIES list went stale and began rejecting a valid
    // id. Nor can it be derived from the log: a row whose producer exists but which
    // this learner has never triggered would read as producerless, the same false
    // claim pointing the other way.
    //
    // The asymmetry with registerDrillTargets() is principled rather than lazy.
    // Content CAN declare what it authored, in one line, beside the registration it
    // already does — so the drill half of "does this button go anywhere" is
    // answerable here and is answered. Nothing can declare its own absence, so the
    // producer half is not claimed here at all.
    //
    // The rows below are the Telugu profile plus the generic types. Nothing in
    // this module reads any id, so a second L1 is a data addition (BR-10).
    const BUILT_IN_CATEGORIES = [

        // -- Grammar: Telugu transfer, REQUIREMENTS.md §3.2 --------------

        {
            id: 'gram.articles',
            code: 'T-G1',
            strand: 'grammar',
            l1: 'telugu',
            priority: 'M',
            label: 'Missing or wrong "a", "an", "the"',
            explanation: 'Telugu has no articles, so there is nothing to carry over — most Telugu speakers work on these for a while, and noticing them is most of the fix.',
            example: '"I went to shop" → "I went to the shop"',
            drill: { strand: 'grammar', target: 'articles' }
        },
        {
            id: 'gram.copula',
            code: 'T-G2',
            strand: 'grammar',
            l1: 'telugu',
            priority: 'M',
            label: 'Dropped "am", "is" or "are"',
            explanation: 'Telugu joins two nouns with no verb between them, so in English the "be" has to be put in on purpose.',
            example: '"He very good" → "He is very good"',
            drill: { strand: 'grammar', target: 'be' }
        },
        {
            // US-182. A dropped SUBJECT — "Am in a meeting", "Is very good",
            // "Very good at her job" — is a different error from T-G2 above, and
            // it had nowhere to go: `gram.copula`'s label ('Dropped "am", "is"
            // or "are"') is FALSE of a sentence in which the be word is present
            // and the subject is the missing piece. A learner told "you dropped
            // am / is / are — 6 times" about six sentences that all contained
            // am/is/are can check that finding and find it wrong, which costs
            // more than no finding at all. data/grammar/be.js's author found the
            // gap, declined to invent an id for it, and documented it in that
            // file's header instead. This is the row.
            //
            // A NEW ROW rather than widening `gram.copula`, which is how US-159
            // handled `gram.uncountable-plural`. The two cases differ:
            //  1. The remediation differs. Zero copula is fixed by adding a verb
            //     English needs and Telugu does not have. A dropped subject is
            //     fixed by keeping a word Telugu may leave out because its verb
            //     already carries the person. Same lesson, two habits, two
            //     different things to notice — where the three shapes of T-G4
            //     all needed one and the same fix.
            //  2. A label true of both would have to be vague enough ("a word
            //     missing from the front of the sentence") to stop being a
            //     diagnosis, which is the one thing this taxonomy is for.
            //  3. Nothing moves. Every wrong answer be.js authors today has its
            //     subject present, so no entry already stored as `gram.copula`
            //     belongs here. This row adds a destination; it takes nothing
            //     from the existing one, and hands the learner no half-count of
            //     a habit that used to be whole.
            //
            // `gram.copula` therefore keeps its id AND its wording, untouched.
            // Its id is in learner storage: record() writes it, and an entry
            // whose category has left the taxonomy is kept but not ranked, so a
            // rename would silently stop describing history rather than moving
            // it.
            //
            // `code` is null on purpose. REQUIREMENTS.md §3.2 has no row for
            // subject omission — T-G2 is copula dropping specifically, and its
            // own example column is *"I doctor"* / *"He very good"*, both with
            // the subject present. That is a gap in §3.2, not a code this file
            // may mint; whoever owns that document should consider a T-G10, and
            // this row can carry it on the day it exists.
            //
            // Priority S, not M, and for a stated reason: §3.2's priorities
            // track intelligibility, and a dropped subject normally leaves the
            // sentence understandable because the person is obvious from the
            // conversation. What it costs is tone. The explanation says that
            // rather than implying the sentence is broken.
            //
            // Finer grain, as elsewhere, belongs in the content's `errorKind`
            // (`subject-dropped-with-be`, `subject-and-be-dropped`), which is
            // authoring data and is never displayed.
            id: 'gram.subject-dropped',
            code: null,
            strand: 'grammar',
            l1: 'telugu',
            priority: 'S',
            label: 'A sentence that starts without its subject',
            explanation: 'Telugu puts the person on the end of the verb, so the subject can be left out and nothing is missing. English keeps that information in the subject word itself, so the word has to be said. English does leave it out in short replies and in writing that is deliberately clipped — "Sounds good", "Can\'t complain", "Back in five" — so this is not always an error; inside a full sentence it usually makes you sound abrupt rather than wrong, and one short word at the front puts it back.',
            example: '"Am in a meeting until five" → "I\'m in a meeting until five"; "Is very good at her job" → "She\'s very good at her job"',
            // Target `be`, i.e. CURRICULUM.md §3 Strand B point 1, giving
            // srsKey `gram:be`.
            //
            // Three candidates were considered. A whole-strand drill
            // (`target: null`) would leave `srsKey` null and offer the learner
            // the grammar strand rather than a lesson, when a lesson exists that
            // is already about this exact sentence shape. A point of its own does
            // not exist and cannot be invented here: `drillTarget()` builds
            // `srsKey` as `'gram:' + target` with no check that the target is
            // authored, so naming a slug nothing implements would produce a
            // button that schedules a lesson the app cannot open — a worse
            // failure than a slightly broad destination, and an invisible one.
            //
            // `be` is where this error is produced, diagnosed and fixed: its
            // items are audits of what a sentence is missing ("count the verbs"),
            // its `decide` steps already walk subject → be word → contraction,
            // and its own header is where the gap was reported from. Two
            // categories sharing one drill is established practice here, not a
            // compromise — `gram.tense-agreement` and `gram.verb-form` both
            // point at `past-simple`, and three rows point at
            // `question-formation`. The consequence to be aware of: a lapse
            // logged here resets `gram:be`, the same key `gram.copula` resets.
            // That is correct while `be` is the only point that teaches the
            // shape, and it is what makes the count worth keeping separate — one
            // destination, two findings, because the learner has to be told
            // which of the two words went missing.
            //
            // When a point that teaches subject pronouns or basic sentence
            // skeleton is authored, this becomes its primary target with `be` as
            // an `alsoTargets` entry; nothing else in the row changes.
            drill: { strand: 'grammar', target: 'be' }
        },
        {
            id: 'gram.stative-progressive',
            code: 'T-G3',
            strand: 'grammar',
            l1: 'telugu',
            priority: 'M',
            label: '"-ing" on a verb that does not take it',
            explanation: 'Verbs about states — know, have, understand — stay in the simple form in English, even when you mean right now.',
            example: '"I am having a doubt" → "I have a question"',
            drill: { strand: 'grammar', target: 'present-simple-vs-continuous' }
        },
        {
            // US-159. This row covers ONE error — an uncountable noun treated
            // as countable — in all three of the shapes it surfaces in:
            //
            //   the -s            "three informations", "advices"
            //   the article       "an advice", "a work", "a meat"
            //   the bare number   "three information"
            //
            // It used to be labelled for the -s alone, which sent the other two
            // shapes looking for a home: the articles lesson logged "a work" as
            // `gram.articles`, the countability lesson logged the same error as
            // this id, and a learner who met it in both lessons was handed two
            // findings for one habit. Widening the label rather than adding a
            // second row is the deliberate call, on three grounds:
            //
            //  1. Both shapes need the same remediation. `drill.target` here is
            //     already `countable-uncountable`, and a separate row would
            //     have to point at the same drill — so the split would buy the
            //     learner two half-sized counts and one destination.
            //  2. `gram.articles` above already merges omission and wrong
            //     choice for exactly this reason ("article omission, 4.7 times"
            //     is not a sentence anyone should be handed). Splitting
            //     countability while merging articles would be incoherent.
            //  3. The id is NOT renamed, even though it now says "plural" and
            //     the row covers more than plurals. record() writes this string
            //     into `mistakeLog`, so a rename orphans every entry already
            //     stored under it — topCategories keeps such an entry in
            //     storage but cannot describe it, so the learner's history
            //     would silently stop being ranked instead of moving. Ids are
            //     opaque storage keys and are never shown; the label is what
            //     the learner reads, so the label is what widens.
            //
            // The finer grain is not lost: content carries `errorKind`
            // (`plural-s-on-uncountable` / `uncountable-with-article` /
            // `number-without-unit-word` / `many-with-uncountable`), which is
            // authoring and analysis data and is never displayed.
            id: 'gram.uncountable-plural',
            code: 'T-G4',
            strand: 'grammar',
            l1: 'telugu',
            priority: 'M',
            label: '"-s", "a" or a number on a word English does not count',
            explanation: '"Information", "advice", "furniture" and "work" name stuff rather than separate items, so nothing that counts goes on the word itself — no -s, no "a", no number in front. The counting moves to a unit word instead.',
            example: '"three informations" → "three pieces of information"; "I am looking for a work" → "I am looking for a job"',
            drill: { strand: 'grammar', target: 'countable-uncountable' }
        },
        {
            id: 'gram.tag-question',
            code: 'T-G5',
            strand: 'grammar',
            l1: 'telugu',
            priority: 'M',
            label: '"isn\'t it?" used for every tag question',
            explanation: 'Telugu has one all-purpose tag (kadā). English builds the tag out of the verb already in the sentence.',
            example: '"You are coming, isn\'t it?" → "You are coming, aren\'t you?"',
            drill: { strand: 'grammar', target: 'question-formation' }
        },
        {
            id: 'gram.present-perfect',
            code: 'T-G6',
            strand: 'grammar',
            l1: 'telugu',
            priority: 'M',
            label: '"have gone" where English needs "went"',
            explanation: 'A finished time — yesterday, last week, in 2019 — takes the past simple in English. This is the contrast most learners find hardest, in any L1.',
            example: '"I have gone yesterday" → "I went yesterday"',
            drill: { strand: 'grammar', target: 'present-perfect-vs-past-simple' }
        },
        {
            id: 'gram.preposition-transfer',
            code: 'T-G7',
            strand: 'grammar',
            l1: 'telugu',
            priority: 'S',
            label: 'An extra preposition after the verb',
            explanation: 'Telugu marks these relations after the noun, so English verbs tend to collect one preposition too many.',
            example: '"discuss about it" → "discuss it"; "return back" → "return"',
            drill: { strand: 'grammar', target: 'prepositions' }
        },
        {
            // US-230. NOTHING IN THIS ROW CHANGED, AND THAT IS THE FINDING.
            //
            // The complaint was that this label narrows its own requirement:
            // §3.2's T-G8 is "SOV residue in questions AND embedded clauses", and
            // 'Question word order inside a longer sentence' is false of the
            // direct-question half. It is — but the direct-question half does not
            // route here, so no learner has ever been shown a false label from it.
            // That was established before anything was touched, by enumerating
            // both sides:
            //
            //   ROUTES HERE (all five, all embedded — label TRUE of every one):
            //     question-formation-p3 "what time is it"  `inversion-in-embedded-clause`
            //     question-formation-p3 "what is the time" `inversion-in-embedded-clause`
            //     question-formation-p3 "what time it's"   `clause-final-contraction`
            //     question-formation-p4 "where was the meeting"
            //                          `inversion-in-embedded-clause-no-question`
            //     question-formation-p4 "where is the meeting"
            //                          `inversion-in-embedded-clause-plus-wrong-tense`
            //   THE OTHER HALF OF T-G8 routes to `gram.word-order`, whose label
            //   'Words in the wrong order' is TRUE of every one of them:
            //     question-formation-p1 "you do live"  `auxiliary-after-subject-sov-residue`
            //     question-formation-p2 "he is knowing" `no-inversion-plus-stative-progressive`
            //     past-simple-p3        "they did ask"  `auxiliary-after-subject-sov-residue`
            //
            // So T-G8 is realised by TWO rows, and the defect was that no file
            // said so — an author routing the next direct-question residue error
            // had two plausible destinations and no rule. This comment is the rule:
            // **the residue in an EMBEDDED clause comes here; the residue in a
            // DIRECT question goes to `gram.word-order`.**
            //
            // The label was NOT widened to cover both, on three grounds:
            //  1. The two halves are mirror images, not two shapes of one habit.
            //     Embedded: English wants statement order and the learner used
            //     question order (*You know where is the station?*) — too much
            //     inversion. Direct: English wants question order and the learner
            //     used statement order (*Where you are going?*) — too little. A
            //     label true of both could only say "the inversion is in the wrong
            //     place", which is the vague wording US-224 refused.
            //  2. Widening here would mean re-pointing the two live
            //     `gram.word-order` residue sites, which halves that row's count
            //     for no gain and orphans the description of history that cannot
            //     move: record() stores no `errorKind`, so the log physically
            //     cannot say which past `gram.word-order` entries were residue.
            //  3. A THIRD row was explicitly out of scope, and would have been
            //     wrong anyway. US-224 minted `gram.auxiliary-omitted` because
            //     "words in the wrong order" was FALSE of an omitted word. Here
            //     both labels are TRUE of everything routed to them, so this is a
            //     narrower-than-ideal NAME, not a false finding, and a name is not
            //     worth a row that halves a count.
            //
            // `code` therefore stays 'T-G8' — this row is the half of T-G8 that
            // has a Telugu-transfer label and an L1 filter to be found by, and
            // `gram.word-order` cannot take the code: it is `l1: null` and its
            // largest producer (app.js's sentence builder) is not T-G8 at all.
            // Whoever owns REQUIREMENTS.md should consider splitting T-G8 into
            // T-G8a / T-G8b to match; until then the mapping above is the
            // authority and this row carries the code for both halves' sake.
            id: 'gram.embedded-question-order',
            code: 'T-G8',
            strand: 'grammar',
            l1: 'telugu',
            priority: 'S',
            label: 'Question word order inside a longer sentence',
            explanation: 'After "where", "what" or "why" inside a sentence, English keeps the ordinary statement order.',
            example: '"You know where is the station?" → "Do you know where the station is?"',
            drill: { strand: 'grammar', target: 'question-formation' }
        },
        {
            // US-224. There was no id for a DIRECT question with its helper word
            // missing — "Where you live?", "You know him?", "Where you going?" —
            // so data/grammar/question-formation.js sends those options to
            // `gram.word-order` with `errorKind:
            // 'auxiliary-omitted-in-direct-question'`. Honest, and blunt: nothing
            // is in the wrong order in "Where you live?". Every word is exactly
            // where English wants it and one word is not there at all. A learner
            // told "words in the wrong order — 6 times" about six sentences whose
            // words are in the right order can check that finding and find it
            // wrong, which this file's header argues costs more than no finding at
            // all. Same defect class as US-182 and US-185.
            //
            // A NEW ROW rather than rewording `gram.word-order`, and the deciding
            // fact is that that row now has THREE producers, not two:
            //   A  app.js's sentence builder (drag-and-drop / reorder / multiple
            //      choice) — "I like very much this book". Constituent order, with
            //      no helper anywhere in the picture.
            //   B  question-formation.js `auxiliary-after-subject-sov-residue` —
            //      "Whereabouts you do live?". The helper is present, and behind
            //      the subject instead of in front of it.
            //   C  question-formation.js `auxiliary-omitted-in-direct-question` —
            //      the helper is not there.
            // "Words in the wrong order" is TRUE of A and of B, and FALSE of C. A
            // label true of all three would have to read something like "words in
            // the wrong order, or a word missing that English needs", which
            // describes a scrambled adverb and an absent auxiliary in one breath
            // and stops being a diagnosis — the one thing this taxonomy is for.
            // So C leaves, and `gram.word-order` keeps its id AND its wording,
            // which are true of everything that remains. Only its `example` grew,
            // to teach B as well as A; see that row.
            //
            // The US-159 objection — "a second row would have to point at the same
            // drill" — is true and is not decisive, exactly as US-182 found.
            // `gram.copula` and `gram.subject-dropped` share `gram:be` on purpose,
            // and three rows already share `gram:question-formation`. One
            // destination, two findings, because the learner has to be told WHICH
            // thing went wrong: "borrow a word that is missing" and "move a word
            // you already said" are two different sentences to notice, and they are
            // not two halves of one count the way "advices" and "an advice" were.
            //
            // WHAT HAPPENS TO ENTRIES ALREADY LOGGED: nothing, and nothing can.
            // They stay under `gram.word-order`, which keeps its id, so none of
            // them is orphaned and none stops being ranked. Some of them do belong
            // here — item `question-formation-p1`'s "you live" option has been
            // producing them since US-215 — and they cannot be moved, because
            // record() stores `category`, `at`, `evidence` and free text and NOT
            // `errorKind`. The log physically does not contain the fact that would
            // say which past entries were omissions, so a migration would have to
            // guess, and guessing which of a learner's own mistakes were which is
            // worse than a stale label on a few of them. The 30-day window is a
            // hard edge, so those age out of the panel inside a month by
            // themselves, and both counts are honest from the day
            // question-formation.js re-points that one `logAs`.
            //
            // `code` is null. §3.2's T-G8 is "SOV residue in questions and
            // embedded clauses" — residue is a word in the WRONG PLACE, and the
            // example in its own column is "You know where is the station?".
            // Omission is a word that was never borrowed. That is a gap in §3.2,
            // not a code this file may mint; this row can carry one on the day it
            // exists.
            //
            // Priority S, for the reason §3.2 gives S to T-G7 and T-G8: those
            // priorities track intelligibility, and nobody has ever failed to
            // understand "Where you live?". What it costs is that the question is
            // heard as learner English by people who would not otherwise notice
            // anything — persona P4's entire complaint, worth a row of its own
            // without being worth an M.
            //
            // "helper", not "auxiliary", in every learner-facing string. The point
            // this row drills teaches the whole idea in that word ("the helper
            // moves in front of the subject of the clause that IS the question"),
            // so the panel and the lesson it opens say the same thing. `auxiliary`
            // survives in the id and in the content's `errorKind`, which are
            // authoring data and are never displayed.
            //
            // ---------------------------------------------------------------
            // US-229. ONE ROW COVERS QUESTIONS **AND** NEGATIVES, and this is the
            // argument, because it is the one place in this class of defect where
            // the US-159 merge test comes out the other way from US-182 and US-224.
            //
            // The gap was a negative built with no helper at all — *"I not got the
            // message"*, *"I not know"*. It logged `gram.verb-form`, which is broad
            // but not false; this row was the right DIAGNOSIS and the wrong LABEL,
            // because 'A question with its helper word missing' is a finding about
            // questions and that sentence is not one. Both options were open:
            // widen this label, or mint a second row for the negative shape.
            //
            // ONE ROW. Four grounds, in the order they decided it:
            //
            //  1. It is ONE HABIT WITH ONE CAUSE, and this row's own explanation
            //     already stated the cause before the negative case arrived:
            //     Telugu borrows no word to ask a question or to say no, so there
            //     is nothing for English "do" to correspond to and it does not come
            //     to mind. That single fact produces *"Where you live?"* and *"I
            //     not know"* identically. The learner has one thing to notice.
            //  2. It is ONE REMEDIATION, and the CONTENT ALREADY SAYS SO.
            //     past-simple.js's `past-simple-p2` feedback for *not got* reads
            //     "It is the same borrowing you do to ask a question, working here
            //     to carry a negative instead", and its p3 `alsoNotice` says "Two
            //     jobs, one word". A taxonomy that split what the lesson teaches as
            //     one move would contradict the lesson its own button opens.
            //  3. THE PANEL — the decisive one, and the US-159 objection in its
            //     strongest form. The question shape has ONE producer
            //     (past-simple-p3 "they asked"; question-formation-p1 is pending
            //     the re-point US-224 asked for) and the negative shape has ONE
            //     (past-simple-p2 "not got"). Two rows of one producer each, ranked
            //     by decayed count in a top FIVE, means a learner with this habit
            //     plausibly sees NEITHER of them, while one row of two producers
            //     ranks. Splitting would halve a count that is already small enough
            //     for halving to be the difference between a diagnosis and silence.
            //  4. AND THE VAGUE-LABEL OBJECTION DOES NOT BITE HERE, which is why
            //     this is not US-182 or US-224 again. Those two split because no
            //     wording could cover their cases and stay a diagnosis: "a word
            //     missing from the front of the sentence" spanned a dropped subject
            //     and a dropped copula, and "words in the wrong order, or a word
            //     missing" spanned a scrambled adverb and an absent auxiliary — in
            //     both, two DIFFERENT KINDS OF THING (presence vs identity,
            //     position vs presence). Here both cases are the ABSENCE OF THE
            //     SAME WORD. So the label can name the word, name the fact, and
            //     name the two sentence types it happens in, in eight words, and
            //     every one of them is specific: "A question or a negative with its
            //     helper word missing". Nothing had to be blurred to fit.
            //
            // WHAT WOULD HAVE CHANGED THE ANSWER: if the two shapes needed
            // different things noticed. They do not — *"Where do you live?"* and
            // *"I didn't know"* are the same borrowing, the same word, the same
            // lesson. Compare `gram.copula` / `gram.subject-dropped`, which share
            // one drill precisely BECAUSE the learner has to be told which of two
            // different words went missing. Here it is one word.
            //
            // The finer grain is not lost, exactly as `gram.uncountable-plural`
            // established: content carries `errorKind`
            // (`auxiliary-omitted-in-direct-question` /
            // `bare-not-negation-without-auxiliary`), which is authoring and
            // analysis data and is never displayed.
            //
            // THE ID DOES NOT CHANGE and nothing already logged moves. Widening is
            // label-only, so every entry stored under this id since US-224 stays,
            // stays ranked, and is still described truly. One CONTENT change is
            // outstanding and belongs to whoever owns that file: past-simple.js's
            // `past-simple-p2` *not got* option must move from
            // `logAs: "gram.verb-form"` to `logAs: "gram.auxiliary-omitted"`,
            // keeping its `errorKind`. Until it does, this row's wording is true of
            // more than reaches it, which is the safe direction — a label that
            // covers a case nothing sends costs the learner nothing, while the
            // reverse is the whole defect.
            id: 'gram.auxiliary-omitted',
            code: null,
            strand: 'grammar',
            l1: 'telugu',
            priority: 'S',
            label: 'A question or a negative with its helper word missing',
            explanation: 'Telugu borrows no word to ask a question or to say no — a question word does the one job, and the single word kādu does the other — so there is no Telugu word for English "do" to correspond to, and it does not come to mind. English wants a helper for both: in front of the subject when the clause is the question, and carrying the "not" when the clause is a negative. Where the verb has no helper of its own, English lends it "do", "does" or "did" for either job. English does leave the helper out in quick speech — "You coming?", "Seen it yet?" — so this is not always an error; in a full sentence it is heard as learner English rather than misunderstood, and one short borrowed word puts it right.',
            example: '"Where you live?" → "Where do you live?"; "You know him?" → "Do you know him?"; "I not got the message" → "I didn\'t get the message"',
            // Target `question-formation`, i.e. CURRICULUM.md §3 Strand B point 6,
            // giving srsKey `gram:question-formation`. Authored by US-215, and this
            // row is the reason the check added by US-187 matters: it reads as a
            // LIVE target rather than as an assumption, so the day someone renames
            // that point the button stops being drawn instead of quietly opening
            // nothing.
            //
            // US-229 left the destination alone. `question-formation` is where the
            // borrowing is TAUGHT — "the helper moves in front of the subject",
            // which is the idea both shapes need — and past-simple.js's p2, which
            // is where the negative shape is drilled, points its own learners back
            // at that framing rather than replacing it. Adding `past-simple` as an
            // `alsoTargets` entry would change `targets` / `srsKeys` /
            // `liveTargets` for a row that already ships, which is a drill decision
            // and not a wording one; whoever makes it should read US-187's
            // per-destination tests first.
            drill: { strand: 'grammar', target: 'question-formation' }
        },
        {
            id: 'gram.register-indian',
            code: 'T-G9',
            strand: 'grammar',
            l1: 'telugu',
            priority: 'S',
            label: 'Wording that reads as local rather than international',
            explanation: 'These are ordinary English inside India and puzzling outside it — worth swapping when you are writing to, or speaking with, people elsewhere.',
            example: '"I have a doubt" → "I have a question"; "out of station" → "away"',
            drill: { strand: 'grammar', target: 'register' }
        },

        // -- Grammar: not L1-specific ------------------------------------

        {
            // US-185. THE LABEL MOVED; THE ID, THE DRILL AND EVERY PRODUCER
            // STAYED. This row used to read 'Past tense not carried through the
            // whole sentence', which describes a MULTI-CLAUSE error — the past
            // established once and then dropped by a later verb. Not one thing
            // that has ever routed here is that error, so every learner who has
            // hit this row has been shown a finding about something they did not
            // do. Same defect class as `gram.copula` (US-182) and
            // `gram.word-order` (US-224); this is the last of the three.
            //
            // ALL SIX PRODUCERS, and what each one actually is. Every one is a
            // single clause whose verb names a different time from the time the
            // rest of the sentence has already named — in BOTH directions, which
            // is the fact the old label got wrong:
            //
            //   data/grammar/be.js — a PAST form in a PRESENT context,
            //   errorKind `past-be-in-present-context` on all three:
            //     be-p1  "My sister was a doctor"  (asked what she does now)
            //     be-p3  "My parents were both teachers — they still work there"
            //     be-p4  "I was twenty-nine"       (introducing yourself now)
            //   data/grammar/past-simple.js — a PRESENT form in a PAST context:
            //     past-simple-p1  "We go … on Saturday"   `present-form-for-finished-past`
            //     past-simple-p2  "I don't get the message"
            //                                              `present-auxiliary-for-past-event`
            //     past-simple-p5  "I send it … last night" `present-form-for-finished-past`
            //
            // WHY THE LABEL MOVED RATHER THAN THE PRODUCERS. The obvious
            // alternative was to send all six to `gram.verb-form` and retire this
            // row's routing. That row's label is 'Right tense, wrong form of the
            // verb' — it makes an EXPLICIT claim that the tense chosen was
            // correct, and all six of these chose the wrong tense. Routing them
            // there would swap one false label for another, and would make
            // `gram.verb-form` false of its own fifteen producers as well, every
            // one of which really is a right-tense-wrong-shape error (*have
            // went*, *didn't got*, *does he knows*, *was sending*, *catched*).
            // Widening `gram.verb-form` to cover wrong-tense too would leave it
            // saying "something is wrong with the verb", which is the vague-label
            // failure this whole class of defect is about. So the two rows stay
            // apart on exactly the line their labels draw: WHICH TIME (here) and
            // WHICH SHAPE (there).
            //
            // Widening this row's wording rather than splitting it is the US-159
            // call, and it passes that test where US-182 and US-224 failed it: the
            // remediation is one and the same in both directions. Read what the
            // rest of the sentence already says about time, and put the verb in
            // that time. There is no second thing to notice, so a second row
            // would buy two half-counts and one destination.
            //
            // THE ID IS NOT RENAMED. record() writes this string into
            // `mistakeLog`, and an entry whose category has left the taxonomy is
            // kept but not ranked, so a rename would silently stop describing a
            // learner's history instead of moving it. `tense-agreement` also
            // remains the phrase FR-SRS-3 uses ("past-tense agreement") and the
            // widened label still says *agree*, so the id has not drifted from
            // what the row means. Ids are opaque storage keys and are never
            // shown; the label is what the learner reads, so the label is what
            // widened — exactly as `gram.uncountable-plural` did.
            //
            // ALREADY-LOGGED ENTRIES: all of them stay, all of them stay ranked,
            // and all of them are now described BETTER than they were, because
            // every entry under this id was written by one of the six sites above
            // and the new label is true of all six. Nothing needs migrating, which
            // is the one comfortable case in this class — US-182 and US-224 both
            // had to leave some history under a stale label because record()
            // stores no `errorKind`.
            //
            // The drill stays `past-simple`, which US-226 authored on 2026-09-12,
            // so this row is live rather than dead. `be` is the natural second
            // destination for the three be.js producers and is deliberately NOT
            // added here: `alsoTargets` would change `targets` / `srsKeys` /
            // `liveTargets` for a row that already ships, which is a separate
            // decision from the wording, and past-simple.js's own p2 teaches the
            // be case in `alsoNotice` ("*be* is its own helper and never borrows
            // *did*"). Whoever adds it should read US-187's per-destination tests.
            //
            // Finer grain stays in the content's `errorKind`, as everywhere else
            // here: the six values above are authoring data and are never shown.
            id: 'gram.tense-agreement',
            code: null,
            strand: 'grammar',
            l1: null,
            priority: 'M',
            label: 'A verb in the wrong time for the rest of the sentence',
            explanation: 'Something else in the sentence has usually already said when this is — "on Saturday", "last night", "until five", "they still work there" — and the verb has to agree with it. Telugu lets the time word carry that on its own, so a verb left in the other time feels finished; in English the two have to match, and the sentence itself tells you which time the verb needs.',
            example: '"We go to my cousin\'s place on Saturday" → "We went to my cousin\'s place on Saturday"; "My sister was a doctor" (asked what she does now) → "My sister\'s a doctor"',
            drill: { strand: 'grammar', target: 'past-simple' }
        },
        {
            id: 'gram.subject-verb-agreement',
            code: null,
            strand: 'grammar',
            l1: null,
            priority: 'M',
            label: 'Subject and verb do not agree',
            explanation: 'The third-person -s is the one ending English holds on to: he goes, they go.',
            example: '"He go to work" → "He goes to work"',
            drill: { strand: 'grammar', target: 'present-simple-vs-continuous' }
        },
        {
            // US-185 considered folding `gram.tense-agreement` into this row and
            // rejected it. This label makes an explicit positive claim — the tense
            // chosen was RIGHT — and it is true of all fifteen of its producers
            // (past-simple.js: *have went*, *didn't got*, *did they asked*,
            // *catched*, *was sending*, *had lived*; present-perfect.js's five
            // participle sites; question-formation.js: *does he knows*). Every
            // tense-agreement producer chose the wrong tense, so this label would
            // be false of them, and a wording true of both would read "something
            // is wrong with the verb", which stops being a diagnosis. The two rows
            // divide on WHICH SHAPE (here) versus WHICH TIME (there), and both
            // drill `past-simple` because one lesson fixes both.
            //
            // One producer here is a KNOWN MISFIT, reported rather than moved
            // because this file cannot edit content: past-simple.js's
            // `past-simple-p2` sends *"I not got the message"* here with errorKind
            // `bare-not-negation-without-auxiliary`. Nothing about that answer is a
            // verb-form error — the shape is a missing helper — and US-229 widened
            // `gram.auxiliary-omitted` to be its true destination. See that row.
            id: 'gram.verb-form',
            code: null,
            strand: 'grammar',
            l1: null,
            priority: 'M',
            label: 'Right tense, wrong form of the verb',
            explanation: 'English keeps a separate past participle for about forty common verbs, and those forty cover most conversation.',
            example: '"I have saw it" → "I have seen it"',
            drill: { strand: 'grammar', target: 'past-simple' }
        },
        {
            // US-224 left this row's ID AND ITS LABEL untouched, and only its
            // `example` grew. Two producers remain and the label is true of both:
            // app.js's sentence builder, where all the words are present and the
            // order is wrong ("I like very much this book"), and
            // question-formation.js's `auxiliary-after-subject-sov-residue`, where
            // the helper is present and standing behind the subject ("Where you
            // are going?"). The third producer — a helper that was never borrowed
            // at all — moved to `gram.auxiliary-omitted`, because no wording could
            // cover a scrambled adverb and an absent auxiliary and still be a
            // diagnosis. See that row for what happens to entries already stored
            // here: they stay, and stay ranked.
            //
            // The second example is the one that was missing. This row has had a
            // question-shaped producer since US-215 and taught only the
            // sentence-builder shape, so a learner meeting the finding after a
            // question exercise saw an example from a different exercise.
            //
            // US-230 added ONE fact and changed nothing here: this row is the
            // DIRECT-QUESTION half of §3.2's T-G8 ("SOV residue in questions and
            // embedded clauses"), and `gram.embedded-question-order` is the
            // embedded half. Three of its producers are that residue —
            // question-formation-p1 "you do live", question-formation-p2 "he is
            // knowing", past-simple-p3 "they did ask" — and this label is true of
            // all three, as it is of the sentence builder. The routing rule is
            // written out beside the T-G8 code, on that other row. This row keeps
            // `code: null`, because it is `l1: null` and its largest producer is
            // not T-G8 at all.
            id: 'gram.word-order',
            code: null,
            strand: 'grammar',
            l1: null,
            priority: 'M',
            label: 'Words in the wrong order',
            explanation: 'English word order does a lot of the work other languages do with endings, so the order carries meaning.',
            example: '"I like very much this book" → "I like this book very much"; "Where you are going?" → "Where are you going?"',
            drill: { strand: 'grammar', target: 'question-formation' }
        },

        // -- Pronunciation: Telugu transfer, REQUIREMENTS.md §3.1 --------
        // Ordered by that table's intelligibility priority, highest first.

        {
            id: 'prn.rhythm',
            code: 'T-P1',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'M',
            label: 'Every syllable given the same weight',
            explanation: 'Telugu gives each syllable its full value; English squashes the unstressed ones almost flat. This changes how easy you are to follow more than any single sound does.',
            example: '"com-for-ta-ble" (four even beats) → "KUMF-tuh-bl" (two and a bit)',
            drill: { strand: 'pronunciation', target: 'rhythm' }
        },
        {
            id: 'prn.final-vowel',
            code: 'T-P2',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'M',
            label: 'An extra vowel added after a final consonant',
            explanation: 'Telugu syllables like to end on a vowel. English words are allowed to stop dead on a consonant — you can end on the /s/ and nothing follows it.',
            example: '"bus-u" → "bus"; "dog-u" → "dog"',
            drill: { strand: 'pronunciation', target: 'final-vowel' }
        },
        {
            id: 'prn.cluster',
            code: 'T-P3',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'M',
            label: 'A consonant cluster broken up with a vowel',
            explanation: 'Words like "asked" and "texts" end in two or three consonants run together. Say them slower rather than putting a vowel between them.',
            example: '"ask-ed" → "askt"; "tex-its" → "teksts"',
            drill: { strand: 'pronunciation', target: 'cluster' }
        },
        {
            id: 'prn.word-stress',
            code: 'T-P4',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'M',
            label: 'Stress on the wrong syllable',
            explanation: 'Telugu stress follows a rule; English stress has to be learned word by word, and it moves when the word changes shape.',
            example: '"PHO-to-graph" but "pho-TO-gra-pher"',
            drill: { strand: 'pronunciation', target: 'word-stress' }
        },
        {
            id: 'prn.v-w',
            code: 'T-P5',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'M',
            label: '/v/ and /w/ swapped',
            explanation: 'Telugu व covers both. For /v/ your top teeth touch your bottom lip; for /w/ your lips round and nothing touches.',
            example: '"vine" and "wine" — say them one after the other and feel the difference',
            drill: { strand: 'pronunciation', target: 'v-w' }
        },
        {
            // US-164. ONE category, TWO drill targets.
            //
            // REQUIREMENTS.md §3.1 row T-P6 is one error type — Telugu has
            // neither /θ/ nor /ð/, so the nearest dental stop steps in for both —
            // and data/pronunciation/consonants.js authors it as two pair sets,
            // `θ-t` and `ð-d`, both carrying `mistakeCategory: 'prn.th'`. Only
            // `θ-t` was a drill target here, so `phon:ð-d` scheduled fine but a
            // learner whose /ð/ misses piled up was offered the /θ/ drill.
            //
            // That file's author argued against closing the gap by merging the
            // two pair sets, and the argument is ACCEPTED, not overruled: /θ/ is
            // voiceless and the quietest consonant in English, /ð/ is voiced and
            // the sound native speakers reduce most, so the two need different
            // word lists, different audio risk handling and different feel
            // checks. Nothing here merges them — both remain separate drills.
            //
            // A second CATEGORY was considered and rejected. Three reasons:
            //  1. It would have no producer. Both pair sets in consonants.js
            //     declare `mistakeCategory: 'prn.th'`, so a new id would sit
            //     unused while /ð/ misses still arrived here — and narrowing this
            //     row's label to the /t/ story to make room for it would then
            //     describe those arriving entries falsely.
            //  2. `prn.th` is in learner storage. Its id cannot be renamed
            //     (record() writes it; an unregistered id is kept but unranked,
            //     so history would stop being described), and splitting it would
            //     hand a learner two half-counts of one habit — the exact defect
            //     US-159 removed from `gram.uncountable-plural`.
            //  3. §3.1 T-P6 is one row, and the learner-facing label below is
            //     already true of both sounds.
            //
            // So the count stays one and the destinations become two. `θ-t`
            // remains the primary because that is what consonants.js's own header
            // and schema note document as the existing target; that file's
            // caveats argue /ð/ is worth more effort than /θ/ on frequency
            // grounds (*the, this, that, they, there* are all /ð/), so a UI that
            // can present the halves in an order should read `srsKeys` and lead
            // with `phon:ð-d`.
            id: 'prn.th',
            code: 'T-P6',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'M',
            label: '"th" said as "t" or "d"',
            explanation: 'Telugu has no /θ/ or /ð/, so the nearest dental stop steps in. For both, the tongue tip comes forward to the teeth and the air keeps flowing, which is why you can hold them: the "th" in "thin" is breath only, and the one in "this" is the same position with your voice switched on.',
            example: '"tin" → "thin"; "den" → "then"',
            drill: { strand: 'pronunciation', target: 'θ-t', alsoTargets: ['ð-d'] }
        },
        {
            id: 'prn.i-length',
            code: 'T-P7',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'M',
            label: '/ɪ/ and /iː/ swapped',
            explanation: '"Ship" is short and the mouth is relaxed; "sheep" is longer and the lips spread wider.',
            example: '"ship" and "sheep"',
            drill: { strand: 'pronunciation', target: 'iː-ɪ' }
        },
        {
            id: 'prn.ae-e',
            code: 'T-P8',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'S',
            label: '/æ/ and /e/ swapped',
            explanation: '"Bad" opens the jaw further than "bed" — it is a bigger mouth position, not a different letter.',
            example: '"bed" and "bad"',
            drill: { strand: 'pronunciation', target: 'æ-e' }
        },
        {
            id: 'prn.o-ou',
            code: 'T-P9',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'S',
            label: '/ɒ/ and /əʊ/ swapped',
            explanation: '"Coat" slides through two vowel positions and the lips move; "cot" stays in one place.',
            example: '"cot" and "coat"',
            drill: { strand: 'pronunciation', target: 'ɒ-əʊ' }
        },
        {
            id: 'prn.z',
            code: 'T-P10',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'S',
            label: '/z/ said as "j" or "s"',
            explanation: '/z/ is /s/ with your voice switched on — put a finger on your throat and you should feel it buzz.',
            example: '"joo" → "zoo"',
            drill: { strand: 'pronunciation', target: 'z-s' }
        },
        {
            id: 'prn.f-p',
            code: 'T-P11',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'S',
            label: '/f/ and /p/ swapped',
            explanation: '/f/ is teeth on lip and you can hold it as long as you like; /p/ is a single burst of the lips.',
            example: '"pan" and "fan"',
            drill: { strand: 'pronunciation', target: 'f-p' }
        },
        {
            // T-P12. REQUIREMENTS.md §3.1 excludes retroflex stops from scope
            // on purpose: they mark a speaker as Indian and almost never block
            // understanding, and "chasing accent trades effort for shame and
            // buys no comprehension". The row exists so the exclusion is
            // visible in the data rather than hidden in code — and because a
            // future L1 profile may legitimately want to reverse the call —
            // but reportable:false keeps it out of every learner-facing list.
            id: 'prn.retroflex',
            code: 'T-P12',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'W',
            label: 'Retroflex /t/ and /d/',
            explanation: 'Not something this app will ask you to change. It says where you are from; it does not stop anyone understanding you.',
            example: null,
            drill: null,
            reportable: false
        },

        // -- Pronunciation: not a diagnosis -----------------------------

        {
            // Where read-aloud lapses land. reportable:false is the whole
            // point: recogniser misses are the highest-volume "mistake" the
            // app can generate and the weakest evidence it has, so they are
            // kept out of the ranking by category as well as by evidence
            // class. Belt and braces, deliberately.
            id: 'prn.recogniser-missed',
            code: null,
            strand: 'pronunciation',
            l1: null,
            priority: 'S',
            label: 'Words the speech recogniser could not catch',
            explanation: 'This means the recogniser did not match a word — not that you said it wrong. Treat it as a hint about where to look, and check it yourself against the model audio.',
            example: null,
            drill: null,
            reportable: false
        },

        // -- Vocabulary ---------------------------------------------------

        {
            id: 'vocab.meaning',
            code: null,
            strand: 'vocabulary',
            l1: null,
            priority: 'M',
            label: 'Picked the meaning of a different word',
            explanation: 'The definition you chose belongs to another word. Reading the two side by side is what separates them next time.',
            example: null,
            drill: { strand: 'vocabulary', target: null }
        },
        {
            id: 'vocab.recall',
            code: null,
            strand: 'vocabulary',
            l1: null,
            priority: 'M',
            label: 'Could not produce the word from its meaning',
            explanation: 'You recognise this word when you see it; the next step is getting it out of your mouth without time to think. That gap is normal and it closes with production practice.',
            example: null,
            drill: { strand: 'vocabulary', target: null }
        },
        {
            id: 'vocab.collocation',
            code: null,
            strand: 'vocabulary',
            l1: null,
            priority: 'S',
            label: 'The right word with the wrong partner word',
            explanation: 'English pairs some words and not others: you make a decision, you do not do one. These pairings are learned together, as a phrase.',
            example: '"do a decision" → "make a decision"',
            drill: { strand: 'collocation', target: null }
        },
        {
            id: 'vocab.spelling',
            code: null,
            strand: 'vocabulary',
            l1: null,
            priority: 'S',
            label: 'Spelling',
            explanation: 'You heard the word correctly and wrote it differently. Worth separating from a listening problem, because it is not one.',
            example: null,
            drill: null
        },

        // -- Listening and reading ---------------------------------------

        {
            id: 'lsn.gist',
            code: null,
            strand: 'listening',
            l1: null,
            priority: 'M',
            label: 'Missed the main point of the audio',
            explanation: 'Getting the overall point before the details is the skill that makes fast speech survivable. Try one listen for the shape of it, then a second for the specifics.',
            example: null,
            drill: { strand: 'listening', target: 'gist' }
        },
        {
            id: 'lsn.detail',
            code: null,
            strand: 'listening',
            l1: null,
            priority: 'M',
            label: 'Missed a specific detail in the audio',
            explanation: 'Numbers, names and times are where detail questions usually go wrong — they are worth a second, slower listen.',
            example: null,
            drill: { strand: 'listening', target: 'detail' }
        },
        {
            id: 'rdw.inference',
            code: null,
            strand: 'reading',
            l1: null,
            priority: 'S',
            label: 'Answer needed reading between the lines',
            explanation: 'The text did not say it outright. Working out what it implies is a different skill from finding a sentence, and it is trainable.',
            example: null,
            drill: { strand: 'reading', target: 'inference' }
        },

        // -- The honest fallback -----------------------------------------

        {
            // Several of the app's checkers only know "wrong", not "wrong
            // because". Logging those here keeps the totals honest — the log
            // can say "we recorded 14 wrong answers and could name 11 of them"
            // — while reportable:false keeps an unnamed bucket from ever
            // topping a list that is supposed to be a diagnosis. Growth in
            // this category is a to-do list for the app, not for the learner.
            id: 'general.uncategorised',
            code: null,
            strand: 'general',
            l1: null,
            priority: 'M',
            label: 'Not yet categorised',
            explanation: 'This app knew the answer was wrong but not yet why. These are counted, and kept out of the list above until they can be named.',
            example: null,
            drill: null,
            reportable: false
        }
    ];

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /** Normalize any value to a lookup key. */
    function _norm(x) {
        return String(x == null ? '' : x).trim();
    }

    /** Trim free text to a bounded, storable string. Empty becomes undefined. */
    function _text(x) {
        if (x == null) return undefined;
        const s = String(x).trim();
        if (!s) return undefined;
        return s.length > MAX_TEXT_CHARS ? s.slice(0, MAX_TEXT_CHARS) : s;
    }

    function _isPositive(n) {
        return typeof n === 'number' && isFinite(n) && n > 0;
    }

    /** A day bucket. UTC, so it never shifts when a device changes timezone. */
    function _dayIndex(ms) {
        return Math.floor(ms / DAY_MS);
    }

    /**
     * Normalize a row's `drill`.
     *
     * One row may legitimately point at MORE THAN ONE addressable drill item.
     * `prn.th` is the case that forced this: REQUIREMENTS.md §3.1 row T-P6 is a
     * single error type ("th" replaced by the nearest dental stop) but
     * data/pronunciation/consonants.js authors it as two pair sets, `θ-t` and
     * `ð-d`, because the voiced and voiceless halves need different word lists
     * and different checks. One category, two destinations.
     *
     * `target` therefore stays exactly what it was — the primary, the one an
     * existing single-button caller reads — and `targets` is the full ordered
     * list with the primary first. Nothing that read `drill.target` before this
     * change reads anything different after it.
     *
     * Accepts either `alsoTargets: [...]` beside a `target`, or a bare
     * `targets: [...]` (whose first entry becomes the primary). Duplicates and
     * blanks are dropped, so `targets` is safe to map straight to SRS keys.
     */
    function _normalizeDrill(drill) {
        if (!drill || typeof drill !== 'object') return null;

        const targets = [];
        function push(value) {
            const t = _norm(value);
            if (t && targets.indexOf(t) < 0) targets.push(t);
        }

        push(drill.target);
        const extra = Array.isArray(drill.alsoTargets)
            ? drill.alsoTargets
            : (Array.isArray(drill.targets) ? drill.targets : []);
        for (let i = 0; i < extra.length; i++) push(extra[i]);

        return {
            strand: _norm(drill.strand) || null,
            // null still means "a whole strand, not one addressable item", and
            // still makes drillTarget() return a null srsKey.
            target: targets.length ? targets[0] : null,
            targets: targets
        };
    }

    /**
     * The target name in one registration entry, or null if there is not one.
     *
     * Content is allowed to register whatever it already has to hand, because the
     * whole point of the seam is that the line it adds should be one line beside
     * the self-registration it already does:
     *
     *   'question-formation'                       a bare slug
     *   'gram:question-formation'                  the srsKey the point declares
     *   { id: 'be', srsKey: 'gram:be', ... }       the authored point itself
     *
     * A namespaced string is accepted only under ITS OWN strand: `phon:v-w` passed
     * as a grammar target is refused rather than filed as a grammar point called
     * "phon:v-w", so a mistyped strand argument fails loudly (FR-CNT-1) instead of
     * populating the registry with an entry no category can ever match.
     */
    function _drillTargetName(entry, ns) {
        if (entry == null) return null;
        let raw = entry;
        if (typeof entry === 'object') {
            raw = entry.target != null ? entry.target
                : (entry.id != null ? entry.id : entry.srsKey);
        }
        const s = _norm(raw);
        if (!s) return null;
        const colon = s.indexOf(':');
        if (colon < 0) return s;
        if (!ns || s.slice(0, colon) !== ns) return null;
        return _norm(s.slice(colon + 1)) || null;
    }

    /** Normalize a taxonomy row, filling defaults. Returns null if unusable. */
    function _normalizeCategory(row) {
        if (!row || typeof row !== 'object') return null;
        const id = _norm(row.id);
        const label = _norm(row.label);
        // id and label are the only hard requirements: without an id nothing
        // can be keyed, and without a label nothing can be shown, which are
        // the two things this module exists to do.
        if (!id || !label) return null;
        return {
            id: id,
            code: row.code == null ? null : _norm(row.code),
            strand: _norm(row.strand) || 'general',
            l1: row.l1 == null ? null : _norm(row.l1),
            priority: _norm(row.priority) || 'S',
            label: label,
            explanation: row.explanation == null ? '' : String(row.explanation),
            example: row.example == null ? null : String(row.example),
            drill: _normalizeDrill(row.drill),
            // Default true: a row an author bothered to write is a row they
            // want the learner to see. Opting out is the exceptional case.
            reportable: row.reportable !== false
        };
    }

    function _copyCategory(cat) {
        const out = {};
        for (const k in cat) {
            if (Object.prototype.hasOwnProperty.call(cat, k)) out[k] = cat[k];
        }
        out.drill = cat.drill
            ? { strand: cat.drill.strand, target: cat.drill.target, targets: (cat.drill.targets || []).slice() }
            : null;
        return out;
    }

    const Mistakes = {

        /** The built-in rows, for reference and for tests. Do not mutate. */
        CATEGORIES: BUILT_IN_CATEGORIES,

        EVIDENCE: EVIDENCE,
        WINDOW_DAYS: WINDOW_DAYS,
        HALF_LIFE_DAYS: HALF_LIFE_DAYS,
        RETENTION_DAYS: RETENTION_DAYS,
        MAX_ENTRIES: MAX_ENTRIES,
        MAX_TEXT_CHARS: MAX_TEXT_CHARS,
        TOP_N: TOP_N,
        MIN_TREND_EVIDENCE: MIN_TREND_EVIDENCE,
        STORAGE_KEY: STORAGE_KEY,

        /** Ordered list of registered rows; the registry of record. */
        categoryList: [],

        /** id -> row, for O(1) lookup. Rebuilt whenever categoryList changes. */
        categoryIndex: {},

        /**
         * strand -> { target: true } for every drill destination CONTENT has said
         * it authored. Empty at first load and empty throughout this module's own
         * suite, which is the normal state and not a broken one — see
         * isAuthoredTarget() for what empty means.
         *
         * Deliberately NOT cleared by resetCategories(): the taxonomy and the
         * content are two different things, and reloading the built-in rows does
         * not unauthor a lesson that is on disk.
         */
        drillTargets: {},

        /** The log itself: entries ascending by timestamp. */
        entryList: [],

        /** Current time in ms. Wrapped so it is easy to stub in tests. */
        _now() {
            return Date.now();
        },

        // --------------------------------------------------------------
        // Taxonomy
        // --------------------------------------------------------------

        _reindex() {
            const index = {};
            for (let i = 0; i < this.categoryList.length; i++) {
                index[this.categoryList[i].id] = this.categoryList[i];
            }
            this.categoryIndex = index;
            return this.categoryIndex;
        },

        /** Load the built-in taxonomy, discarding anything registered on top. */
        resetCategories() {
            this.categoryList = BUILT_IN_CATEGORIES
                .map(_normalizeCategory)
                .filter(c => c !== null);
            this._reindex();
            return this.categoryList.length;
        },

        /**
         * Add or replace taxonomy rows — the FR-CNT-3 / BR-10 extension point.
         *
         * A second L1 profile file (`data/l1/hindi.js`, loaded after this
         * module) ends with:
         *
         *     if (window.Mistakes) Mistakes.registerCategories(L1_HINDI.mistakeCategories);
         *
         * and needs no change here and none in app.js. Same id replaces in
         * place, keeping list order stable, so a profile may also override a
         * built-in row's wording for its own learners.
         *
         * Malformed rows are rejected and returned rather than silently
         * absorbed (FR-CNT-1: fail loudly at author time).
         *
         * @param {Array|Object} rows
         * @returns {{added: string[], replaced: string[], rejected: Array}}
         */
        registerCategories(rows) {
            const list = Array.isArray(rows) ? rows : [rows];
            const result = { added: [], replaced: [], rejected: [] };

            for (let i = 0; i < list.length; i++) {
                const normalized = _normalizeCategory(list[i]);
                if (!normalized) {
                    result.rejected.push(list[i]);
                    continue;
                }
                const existingIndex = this.categoryList.findIndex(c => c.id === normalized.id);
                if (existingIndex >= 0) {
                    this.categoryList[existingIndex] = normalized;
                    result.replaced.push(normalized.id);
                } else {
                    this.categoryList.push(normalized);
                    result.added.push(normalized.id);
                }
            }

            this._reindex();

            if (result.rejected.length > 0 &&
                global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                global.AppErrorHandler.logError(
                    new Error('Mistakes.registerCategories rejected ' + result.rejected.length +
                              ' row(s): each row needs a non-empty id and label'),
                    'Mistakes taxonomy'
                );
            }
            return result;
        },

        /**
         * One filter predicate, shared by categories() and categoryIds() so the
         * two can never disagree about what `{ strand: 'grammar' }` means.
         */
        _matches(cat, o) {
            if (o.strand && cat.strand !== o.strand) return false;
            if (o.l1 && cat.l1 !== null && cat.l1 !== o.l1) return false;
            if (typeof o.reportable === 'boolean' && cat.reportable !== o.reportable) return false;
            return true;
        },

        /**
         * Registered rows as copies.
         * @param {Object} [opts] - { strand, l1, reportable } filters. `l1` also
         *        matches rows with l1 === null, which are not L1-specific and
         *        apply to every learner.
         */
        categories(opts) {
            const o = opts || {};
            return this.categoryList
                .filter(c => this._matches(c, o))
                .map(_copyCategory);
        },

        /**
         * Registered ids, optionally filtered exactly as categories() filters.
         *
         * The filter exists for content authors (US-160). A content file that
         * needs "the grammar ids that are live right now" asks
         * `Mistakes.categoryIds({ strand: 'grammar' })` rather than keeping its
         * own copy of the list, which is a copy that goes stale the moment a row
         * is added here — and did: `data/grammar.js`'s MISTAKE_CATEGORIES was
         * missing `gram.register-indian`, so the guard meant to catch a typo
         * would have rejected a correct id instead.
         *
         * @param {Object} [opts] - as categories(); omit for every id.
         */
        categoryIds(opts) {
            if (!opts) return this.categoryList.map(c => c.id);
            return this.categoryList.filter(c => this._matches(c, opts)).map(c => c.id);
        },

        /**
         * Which of these ids are NOT registered — the author-time typo guard,
         * asked of the module that owns the taxonomy instead of duplicated as a
         * literal list somewhere else (US-160).
         *
         * A content file or its test collects every `logAs` / `mistakeCategory`
         * it declares and passes them here; `[]` means they all resolve.
         * Anything returned would have been REJECTED by record() at runtime —
         * the mistake would go unlogged rather than land in the wrong bucket —
         * so this is the check that turns a silent data loss into a failing
         * test (FR-CNT-1: fail loudly at author time).
         *
         * Ids are reported once each, and an empty or non-string entry is
         * reported as itself stringified, so the message names the offending
         * value rather than counting how many places repeat it.
         *
         * @param {Array|string} ids
         * @returns {string[]} the unrecognised ids, deduplicated
         */
        unknownCategories(ids) {
            const list = Array.isArray(ids) ? ids : [ids];
            const out = [];
            const seen = {};
            for (let i = 0; i < list.length; i++) {
                const id = _norm(list[i]);
                if (this.isKnownCategory(id)) continue;
                const named = id || String(list[i]);
                if (seen[named]) continue;
                seen[named] = true;
                out.push(named);
            }
            return out;
        },

        getCategory(id) {
            const cat = this.categoryIndex[_norm(id)];
            return cat ? _copyCategory(cat) : null;
        },

        isKnownCategory(id) {
            return Object.prototype.hasOwnProperty.call(this.categoryIndex, _norm(id));
        },

        // --------------------------------------------------------------
        // Which drill destinations actually exist  (US-187)
        // --------------------------------------------------------------
        //
        // A row's `drill.target` is a claim about the CURRICULUM: `gram.articles`
        // names `articles` because that is the point which fixes it. It has never
        // been a claim that anything is AUTHORED, and drillTarget() used to compose
        // `gram:' + target` regardless — so the dashboard drew "Practise this" from
        // a key that opens nothing, the learner clicked, and the app did nothing.
        // That is the class of silent failure BR-3 exists to prevent, and several
        // targets are in it right now: `past-simple` (two rows), `prepositions`,
        // `register`, and the listening and reading targets. `question-formation`
        // was another until US-215 authored it — which fixed one target and not the
        // missing check, and is what makes the gap visible rather than theoretical.
        //
        // THE CONSTRAINT: this module cannot look for itself. It loads before all
        // content, is unit-tested with none present, and must not import a list of
        // authored points or it stops being the L1-agnostic core the whole
        // FR-CNT-3 / BR-10 design rests on.
        //
        // So the dependency is INVERTED, exactly as registerCategories() inverts it
        // for the rows themselves: content declares what it authored and this
        // module only remembers. A grammar point file's registration becomes two
        // lines instead of one —
        //
        //     grammarLessons.foundation.push(GRAMMAR_QUESTION_FORMATION);
        //     if (window.Mistakes) Mistakes.registerDrillTargets(
        //         'grammar', GRAMMAR_QUESTION_FORMATION.id);
        //
        // — or a caller that already holds the whole content list registers it in
        // one call, which is the stale-proof form because a new point file adds
        // itself to that list and needs no second edit anywhere.
        //
        // THREE STATES, NOT TWO, and the third is the load-bearing one. "Nothing
        // has registered anything for this strand" is NOT "this target is dead": it
        // is the state at first load, in this module's own suite, and on a device
        // where a content script failed to fetch. Answering `false` there would
        // blank every drill button in the app on the strength of a registration
        // that had not run yet, which is a worse and more confusing failure than
        // the dead button. Absence of a claim is reported as a claim of absence
        // nowhere in this file.

        /**
         * Tell this module a drill destination exists.
         *
         * @param {string} strand - a `drill.strand` value ('grammar', ...).
         * @param {Array|string|Object} targets - slugs, `'gram:slug'` keys, or the
         *        authored objects themselves; see _drillTargetName().
         * @returns {{strand: string, added: string[], known: string[], ignored: Array}}
         *          `known` is what was already registered, so a double-loaded
         *          script is a no-op rather than an error. `ignored` is anything
         *          that named no usable target, reported the way
         *          registerCategories() reports a rejected row.
         */
        registerDrillTargets(strand, targets) {
            const s = _norm(strand);
            const list = Array.isArray(targets) ? targets : [targets];
            const result = { strand: s, added: [], known: [], ignored: [] };
            const ns = s ? (SRS_NAMESPACE[s] || null) : null;

            for (let i = 0; i < list.length; i++) {
                // No strand means nothing can be filed, so every entry is ignored
                // rather than guessed at from its shape.
                const name = s ? _drillTargetName(list[i], ns) : null;
                if (!name) {
                    result.ignored.push(list[i]);
                    continue;
                }
                const bucket = this.drillTargets[s] || (this.drillTargets[s] = {});
                if (Object.prototype.hasOwnProperty.call(bucket, name)) {
                    if (result.known.indexOf(name) < 0) result.known.push(name);
                    continue;
                }
                bucket[name] = true;
                result.added.push(name);
            }

            if (result.ignored.length > 0 &&
                global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                global.AppErrorHandler.logError(
                    new Error('Mistakes.registerDrillTargets ignored ' + result.ignored.length +
                              ' entr(y/ies) for strand "' + s + '": each needs a non-empty ' +
                              'target, and a namespaced key must match that strand'),
                    'Mistakes drill targets'
                );
            }
            return result;
        },

        /**
         * Forget registered destinations — one strand, or all of them.
         * @returns {number} how many targets were forgotten.
         */
        resetDrillTargets(strand) {
            const s = _norm(strand);
            if (s) {
                const gone = this.authoredTargets(s).length;
                delete this.drillTargets[s];
                return gone;
            }
            let gone = 0;
            const strands = Object.keys(this.drillTargets);
            for (let i = 0; i < strands.length; i++) {
                gone += Object.keys(this.drillTargets[strands[i]]).length;
            }
            this.drillTargets = {};
            return gone;
        },

        /** The targets registered for one strand, in registration order. */
        authoredTargets(strand) {
            const bucket = this.drillTargets[_norm(strand)];
            return bucket ? Object.keys(bucket) : [];
        },

        /**
         * Is there content behind this destination?
         *
         *   true   this strand's registry names this target
         *   false  this strand's registry is populated and does NOT name it, so
         *          the target is provably dead and a button drawn from it would
         *          open nothing
         *   null   no claim: nothing has registered for this strand at all, or no
         *          target was asked about. Callers must treat null as "unknown",
         *          which for a drill button means draw it — the behaviour before
         *          US-187, unchanged wherever no registration has happened.
         */
        isAuthoredTarget(strand, target) {
            const bucket = this.drillTargets[_norm(strand)];
            if (!bucket || !Object.keys(bucket).length) return null;
            const t = _norm(target);
            if (!t) return null;
            return Object.prototype.hasOwnProperty.call(bucket, t);
        },

        /**
         * What "practise this one" should open, for the FR-SRS-3 drill button.
         * Returns null when there is nothing honest to drill, which the UI must
         * read as "do not offer a button", not as an error.
         *
         * `target` / `srsKey` are the primary destination and are unchanged.
         * `targets` / `srsKeys` are every destination this category can route
         * to, primary first — normally a one-item list, and longer only where one
         * error type is drilled by more than one item (US-164: `prn.th` covers
         * both halves of T-P6, so a /ð/ miss has somewhere to go). A UI that
         * offers one button uses `srsKey`; one that offers a choice, or that has
         * to route a specific phoneme, reads `srsKeys`.
         *
         * US-187 added `authored` / `liveTargets` / `deadTargets`, and a dead
         * target is NOT dropped from `targets` or `srsKeys`. A category whose
         * lesson does not exist is still a real weakness the learner has, and the
         * panel owes them the finding plus an honest line about there being no
         * exercise for it yet — the shape app.js already draws for a `drillable`
         * row with no destination. Silently emptying the list would turn that into
         * "this one has no drill of its own", which is a different and false claim.
         */
        drillTarget(id) {
            const cat = this.categoryIndex[_norm(id)];
            if (!cat || !cat.drill || !cat.drill.strand) return null;
            const ns = SRS_NAMESPACE[cat.drill.strand];
            const targets = (cat.drill.targets || []).slice();

            const live = [];
            const dead = [];
            for (let i = 0; i < targets.length; i++) {
                const known = this.isAuthoredTarget(cat.drill.strand, targets[i]);
                if (known === true) live.push(targets[i]);
                else if (known === false) dead.push(targets[i]);
            }

            return {
                categoryId: cat.id,
                label: cat.label,
                strand: cat.drill.strand,
                target: cat.drill.target,
                // FR-SRS-1 namespaced key, so a caller can reset or query the
                // scheduler for exactly this item. null when the drill is a
                // whole strand rather than one addressable item.
                srsKey: (ns && cat.drill.target) ? (ns + ':' + cat.drill.target) : null,
                targets: targets,
                // Empty when the strand has no SRS namespace or the drill names
                // no addressable item — never a key built from a null target.
                srsKeys: ns ? targets.map(t => ns + ':' + t) : [],
                // Tri-state for the PRIMARY target; see isAuthoredTarget(). null
                // when `target` is null too, because a whole-strand drill names no
                // addressable item to have authored — the strand IS the
                // destination, which is authored intent rather than a dead end.
                authored: cat.drill.target
                    ? this.isAuthoredTarget(cat.drill.strand, cat.drill.target)
                    : null,
                // The same answer per destination, for the multi-target rows. Both
                // are empty while `authored` is null, so a caller cannot mistake
                // "nothing registered" for "nothing authored".
                liveTargets: live,
                deadTargets: dead
            };
        },

        // --------------------------------------------------------------
        // Persistence
        // --------------------------------------------------------------

        load() {
            let parsed = null;
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                parsed = raw ? JSON.parse(raw) : null;
            } catch (e) {
                // Corrupt or unavailable storage — start clean rather than
                // crash, exactly as srs.js does. A lost mistake log costs the
                // learner a diagnosis; a thrown exception costs them the app.
                parsed = null;
            }

            let entries = [];
            if (Array.isArray(parsed)) {
                entries = parsed;                       // tolerate a bare array
            } else if (parsed && Array.isArray(parsed.entries)) {
                entries = parsed.entries;
            }

            this.entryList = entries
                .filter(e => e && typeof e === 'object' && _isPositive(e.at) && _norm(e.category))
                .map(e => ({
                    category: _norm(e.category),
                    at: e.at,
                    evidence: EVIDENCE_VALUES.indexOf(e.evidence) >= 0 ? e.evidence : EVIDENCE.GRADED,
                    item: _text(e.item),
                    given: _text(e.given),
                    expected: _text(e.expected),
                    source: _text(e.source)
                }))
                .sort((a, b) => a.at - b.at);

            return this.entryList;
        },

        save() {
            const payload = () => JSON.stringify({
                version: LOG_VERSION,
                entries: this.entryList
            });
            try {
                localStorage.setItem(STORAGE_KEY, payload());
                return true;
            } catch (e) {
                // NFR-10: quota exceeded must not be silent. Drop the oldest
                // quarter and try once more — the oldest entries are the least
                // diagnostic thing in the log, so they are the right thing to
                // sacrifice to keep this month's diagnosis writable.
                const original = this.entryList;
                const before = original.length;
                this.entryList = original.slice(Math.ceil(before / 4));
                try {
                    localStorage.setItem(STORAGE_KEY, payload());
                    if (global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                        global.AppErrorHandler.logError(
                            new Error('mistakeLog storage was full; dropped the oldest ' +
                                      (before - this.entryList.length) + ' of ' + before + ' entries'),
                            'Mistakes save'
                        );
                    }
                    return true;
                } catch (e2) {
                    // Both writes failed — storage is unavailable rather than
                    // merely full (private mode, disabled storage). Put the
                    // trimmed entries back: they are not the reason the write
                    // failed, so dropping them buys nothing, and a later save
                    // in the same session may well succeed.
                    this.entryList = original;
                    if (global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                        global.AppErrorHandler.logError(e2, 'Mistakes save');
                    }
                    return false;
                }
            }
        },

        /**
         * Apply the retention policy: drop anything older than RETENTION_DAYS,
         * then cap at MAX_ENTRIES oldest-first. Returns how many were dropped.
         * Called on every write, so growth is bounded without a scheduled job.
         */
        prune(now) {
            const t = _isPositive(now) ? now : this._now();
            const cutoff = t - RETENTION_DAYS * DAY_MS;
            const before = this.entryList.length;

            let kept = this.entryList.filter(e => e.at >= cutoff);
            if (kept.length > MAX_ENTRIES) {
                kept = kept.slice(kept.length - MAX_ENTRIES);
            }
            this.entryList = kept;
            return before - kept.length;
        },

        reset() {
            this.entryList = [];
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (e) { /* ignore */ }
        },

        // --------------------------------------------------------------
        // Recording
        // --------------------------------------------------------------

        /**
         * Log one mistake, by type.
         *
         * @param {string} categoryId - A registered id. Unknown ids are
         *        REJECTED, not coerced: a typo that silently logged as
         *        "uncategorised" would quietly corrupt the one thing this
         *        module is for. Callers that genuinely do not know the type
         *        pass 'general.uncategorised' on purpose.
         * @param {Object} [opts]
         *        evidence  one of Mistakes.EVIDENCE (default 'graded')
         *        item      what was being practised — word, sentence, exercise id
         *        given     what the learner actually produced
         *        expected  what the item wanted
         *        source    which part of the app logged it ('vocabQuiz', ...)
         *        at        timestamp override (tests, backfill)
         * @returns {Object|null} A copy of the stored entry, or null.
         */
        record(categoryId, opts) {
            const id = _norm(categoryId);
            const cat = this.categoryIndex[id];
            if (!cat) {
                if (global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                    global.AppErrorHandler.logError(
                        new Error('Mistakes.record: unknown category "' + id + '"'),
                        'Mistakes'
                    );
                }
                return null;
            }

            const o = opts || {};
            const at = _isPositive(o.at) ? o.at : this._now();
            const evidence = EVIDENCE_VALUES.indexOf(o.evidence) >= 0 ? o.evidence : EVIDENCE.GRADED;

            const entry = {
                category: cat.id,
                at: at,
                evidence: evidence,
                item: _text(o.item),
                given: _text(o.given),
                expected: _text(o.expected),
                source: _text(o.source)
            };

            // Keep the list sorted ascending. Backfilled and out-of-order
            // timestamps are rare, so pay for them only when they happen.
            const last = this.entryList[this.entryList.length - 1];
            if (!last || last.at <= at) {
                this.entryList.push(entry);
            } else {
                let i = this.entryList.length - 1;
                while (i > 0 && this.entryList[i - 1].at > at) i--;
                this.entryList.splice(i, 0, entry);
            }

            this.prune(at > this._now() ? at : this._now());
            this.save();
            return Object.assign({}, entry);
        },

        /** record() over several categories that share one context. */
        recordMany(categoryIds, opts) {
            const list = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
            const out = [];
            for (let i = 0; i < list.length; i++) {
                const entry = this.record(list[i], opts);
                if (entry) out.push(entry);
            }
            return out;
        },

        // --------------------------------------------------------------
        // Querying
        // --------------------------------------------------------------

        /** Resolve the shared window options once, so every query agrees. */
        _window(opts) {
            const o = opts || {};
            const now = _isPositive(o.now) ? o.now : this._now();
            const windowDays = _isPositive(o.windowDays) ? o.windowDays : WINDOW_DAYS;
            return {
                now: now,
                windowDays: windowDays,
                // Inclusive lower bound. An entry exactly `windowDays` old is
                // inside the window; one millisecond older is outside.
                from: now - windowDays * DAY_MS,
                // Infinity is allowed and disables decay (_weight returns 1 for
                // every age), which is how a caller asks for a plain count.
                halfLifeDays: (typeof o.halfLifeDays === 'number' && o.halfLifeDays > 0)
                    ? o.halfLifeDays
                    : HALF_LIFE_DAYS,
                // Default false: only graded outcomes are a diagnosis.
                countUnverified: o.countUnverified === true,
                includeNonReportable: o.includeNonReportable === true
            };
        },

        /** Entries inside the window, oldest first. */
        _inWindow(w) {
            return this.entryList.filter(e => e.at >= w.from && e.at <= w.now);
        },

        /** Does this entry count towards the ranked figure under this policy? */
        _counts(entry, w) {
            return w.countUnverified || entry.evidence === VERIFIED;
        },

        /**
         * Recency weight for the ranking score: 1 today, 0.5 at one half-life,
         * 0.25 at two. Never shown to the learner — see HALF_LIFE_DAYS.
         */
        _weight(entry, w) {
            const ageDays = (w.now - entry.at) / DAY_MS;
            if (ageDays <= 0) return 1;
            return Math.pow(0.5, ageDays / w.halfLifeDays);
        },

        /**
         * Raw counts per category id inside the window.
         * @returns {Object} id -> { count, unverifiedCount, total }
         */
        countsByCategory(opts) {
            const w = this._window(opts);
            const out = {};
            const entries = this._inWindow(w);
            for (let i = 0; i < entries.length; i++) {
                const e = entries[i];
                if (!out[e.category]) out[e.category] = { count: 0, unverifiedCount: 0, total: 0 };
                if (e.evidence === VERIFIED) out[e.category].count++;
                else out[e.category].unverifiedCount++;
                out[e.category].total++;
            }
            return out;
        },

        /**
         * Trend for one category, derived honestly from the log alone.
         *
         * The window is split in half and the two halves compared. The
         * comparison is per ACTIVE DAY — a day on which the log recorded any
         * mistake at all, in any category — not per calendar day, because
         * mistakes falling simply because the learner practised less is not
         * improvement, and calling it improvement would break BR-3.
         *
         * It is still a proxy and not an accuracy rate: this log stores only
         * mistakes, so it cannot know how many attempts they came from. A
         * learner who did twice as much work per day this fortnight can look
         * worse while genuinely improving. `basis` is returned so the UI can
         * show what was actually compared instead of asserting a cause.
         *
         * 'unclear' is returned, and meant, whenever the evidence is too thin
         * to name a direction.
         */
        _trend(categoryId, w) {
            const mid = w.now - (w.windowDays / 2) * DAY_MS;
            const entries = this._inWindow(w).filter(e => this._counts(e, w));

            let earlier = 0;
            let recent = 0;
            const earlierDays = {};
            const recentDays = {};

            for (let i = 0; i < entries.length; i++) {
                const e = entries[i];
                const isRecent = e.at >= mid;
                // Active-day denominators count every category, so they measure
                // "was the learner practising", not "was this error happening".
                if (isRecent) recentDays[_dayIndex(e.at)] = true;
                else earlierDays[_dayIndex(e.at)] = true;
                if (e.category !== categoryId) continue;
                if (isRecent) recent++;
                else earlier++;
            }

            const recentActive = Object.keys(recentDays).length;
            const earlierActive = Object.keys(earlierDays).length;
            const basis = {
                earlierCount: earlier,
                recentCount: recent,
                earlierActiveDays: earlierActive,
                recentActiveDays: recentActive,
                earlierPerActiveDay: earlierActive ? earlier / earlierActive : null,
                recentPerActiveDay: recentActive ? recent / recentActive : null,
                splitAt: mid
            };

            if (earlier + recent < MIN_TREND_EVIDENCE) return { trend: 'unclear', basis: basis };
            if (!earlierActive || !recentActive) return { trend: 'unclear', basis: basis };

            const a = basis.earlierPerActiveDay;
            const b = basis.recentPerActiveDay;
            if (a === 0) return { trend: b > 0 ? 'worsening' : 'steady', basis: basis };

            const change = (b - a) / a;
            if (change <= -TREND_DEADBAND) return { trend: 'improving', basis: basis };
            if (change >= TREND_DEADBAND) return { trend: 'worsening', basis: basis };
            return { trend: 'steady', basis: basis };
        },

        /**
         * THE FR-SRS-3 view: the learner's top recurring error types.
         *
         * Ranked by the recency-weighted score so a fixed problem falls away
         * (see HALF_LIFE_DAYS); reported with the honest raw `count`, which is
         * the number to put on screen. Non-reportable categories — recogniser
         * misses, the uncategorised bucket, the deliberately out-of-scope
         * retroflex row — are absent unless asked for explicitly.
         *
         * @param {Object} [opts]
         *        limit             how many rows (default 5)
         *        windowDays        rolling window (default 30)
         *        now               clock override
         *        halfLifeDays      decay half-life override; Infinity disables decay
         *        countUnverified   fold self- and recogniser-sourced entries
         *                          into the ranked count (default false)
         *        includeNonReportable  include reportable:false categories
         *        strand            restrict to one strand
         * @returns {Array} ranked rows, most significant first
         */
        topCategories(opts) {
            const o = opts || {};
            const w = this._window(o);
            const limit = (typeof o.limit === 'number' && isFinite(o.limit) && o.limit >= 0)
                ? o.limit
                : TOP_N;

            const acc = {};
            const entries = this._inWindow(w);

            for (let i = 0; i < entries.length; i++) {
                const e = entries[i];
                const cat = this.categoryIndex[e.category];
                // An entry whose category is no longer registered (a profile
                // was swapped out) is kept in storage but cannot be described,
                // so it is not ranked. Dropping it from storage instead would
                // destroy history on a content change.
                if (!cat) continue;
                if (!cat.reportable && !w.includeNonReportable) continue;
                if (o.strand && cat.strand !== o.strand) continue;

                let row = acc[cat.id];
                if (!row) {
                    row = acc[cat.id] = {
                        id: cat.id,
                        count: 0,
                        unverifiedCount: 0,
                        score: 0,
                        first: e.at,
                        last: e.at
                    };
                }
                if (e.evidence === VERIFIED) row.count++;
                else row.unverifiedCount++;
                if (this._counts(e, w)) row.score += this._weight(e, w);
                if (e.at < row.first) row.first = e.at;
                if (e.at > row.last) row.last = e.at;
            }

            const ranked = Object.keys(acc)
                .map(id => acc[id])
                // score is 0 exactly when nothing that counts under this policy
                // landed in the window, so this is what keeps a category with
                // only recogniser noise out of a graded-evidence diagnosis.
                .filter(row => row.score > 0)
                .sort((a, b) => (b.score - a.score) || (b.last - a.last) || a.id.localeCompare(b.id));

            const rankedTotal = ranked.reduce((sum, r) => sum + (w.countUnverified ? r.count + r.unverifiedCount : r.count), 0);

            return ranked.slice(0, limit).map(row => {
                const cat = this.categoryIndex[row.id];
                const t = this._trend(row.id, w);
                const shown = w.countUnverified ? row.count + row.unverifiedCount : row.count;
                const drill = this.drillTarget(row.id);
                return {
                    id: cat.id,
                    code: cat.code,
                    strand: cat.strand,
                    l1: cat.l1,
                    priority: cat.priority,
                    label: cat.label,
                    explanation: cat.explanation,
                    example: cat.example,
                    // The honest headline number, and the one to display.
                    count: shown,
                    // Never folded into `count`: weaker evidence, reported beside it.
                    unverifiedCount: row.unverifiedCount,
                    // Ordering only. Not for display.
                    score: row.score,
                    share: rankedTotal > 0 ? shown / rankedTotal : 0,
                    first: row.first,
                    last: row.last,
                    daysSinceLast: Math.floor((w.now - row.last) / DAY_MS),
                    trend: t.trend,
                    trendBasis: t.basis,
                    windowDays: w.windowDays,
                    drillable: drill !== null,
                    drill: drill
                };
            });
        },

        /** One category's entries, newest first. For a "show me these" drill-down. */
        history(categoryId, opts) {
            const id = _norm(categoryId);
            const w = this._window(opts);
            const o = opts || {};
            const limit = (typeof o.limit === 'number' && isFinite(o.limit) && o.limit >= 0) ? o.limit : Infinity;
            return this._inWindow(w)
                .filter(e => e.category === id)
                .slice()
                .reverse()
                .slice(0, limit)
                .map(e => Object.assign({}, e));
        },

        /** Copies of raw entries, oldest first. Diagnostics and export. */
        entries(opts) {
            const o = opts || {};
            const list = (o.windowDays || o.now) ? this._inWindow(this._window(o)) : this.entryList;
            return list.map(e => Object.assign({}, e));
        },

        stats() {
            const now = this._now();
            let graded = 0;
            let unverified = 0;
            const seen = {};
            for (let i = 0; i < this.entryList.length; i++) {
                const e = this.entryList[i];
                if (e.evidence === VERIFIED) graded++;
                else unverified++;
                seen[e.category] = true;
            }
            const oldest = this.entryList.length ? this.entryList[0].at : null;
            const newest = this.entryList.length ? this.entryList[this.entryList.length - 1].at : null;
            return {
                entries: this.entryList.length,
                graded: graded,
                unverified: unverified,
                categoriesSeen: Object.keys(seen).length,
                categoriesRegistered: this.categoryList.length,
                oldest: oldest,
                newest: newest,
                spanDays: (oldest !== null) ? Math.floor((newest - oldest) / DAY_MS) : 0,
                // Rough stored size, so the retention policy is observable
                // rather than a matter of faith.
                bytes: JSON.stringify({ version: LOG_VERSION, entries: this.entryList }).length,
                capacityUsed: this.entryList.length / MAX_ENTRIES,
                retentionDays: RETENTION_DAYS,
                maxEntries: MAX_ENTRIES,
                asOf: now
            };
        }
    };

    Mistakes.resetCategories();
    Mistakes.load();

    // Expose globally (matches the pattern of the other core modules) and
    // support CommonJS for the test suite.
    global.Mistakes = Mistakes;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Mistakes;
    }
// `globalThis`, not `this`. Under CommonJS a bare top-level `this` is
// `module.exports`, so the old `: this` fallback meant that when Jest or a node
// script require()d this file, `global.Mistakes` was never published and
// `global.AppErrorHandler` resolved against an empty object — so the NFR-10
// quota-exceeded reporting in save() was unreachable under test, and a test that
// installed an error-handler spy would have passed while exercising nothing.
// levels.js, migrations.js and srs.js already use globalThis; this brings
// mistakes.js in line — it was the last core module with the defect.
})(typeof window !== 'undefined' ? window : globalThis);
