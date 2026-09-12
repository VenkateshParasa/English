/**
 * Grammar lessons — Strand B content
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical globals
 * `grammarLessons`, `grammarMistakeCategoryIds`, `ZERO_ARTICLE`,
 * `ZERO_ARTICLE_LABEL`, `MISTAKE_CATEGORY_ALIASES` and `GRAMMAR_SCHEMA_VERSION`.
 *
 * There is no `MISTAKE_CATEGORIES` array any more — js/core/mistakes.js owns the
 * taxonomy and answers `categoryIds({ strand: 'grammar' })`; see the note above
 * `grammarMistakeCategoryIds` for why the local copy was deleted rather than
 * refreshed.
 *
 * ⚠️ A top-level `const` in a classic script is a *lexical* global, not a
 * property of `window`. Guard access with bare `typeof grammarLessons !==
 * 'undefined'`, never `window.grammarLessons` (which is always undefined).
 *
 * Covers CURRICULUM.md §3 Strand B, per FR-GRM-1…FR-GRM-5.
 * Authored here: point 3, articles (the US-500 spike). Point 4, countability,
 * lives in data/grammar/countability.js and pushes itself into
 * `grammarLessons.foundation` on load. The remaining 22 points follow this
 * schema exactly; the tier arrays are pre-created and empty so that
 * `grammarLessons[level]` never throws for a tier with no content yet.
 *
 * -----------------------------------------------------------------------------
 * SCHEMA — one object per grammar point
 * -----------------------------------------------------------------------------
 * Identity and scheduling
 *   id                 stable kebab-case slug. Never change it: it is the SRS
 *                      ref and the mistake-log key. ("articles")
 *   syllabusNumber     the point's number in CURRICULUM.md §3 Strand B (1–24).
 *   tier               'foundation' | 'everyday' | 'confident' | 'fluent'
 *                      (js/core/levels.js ids — must match the containing key).
 *   cefr               CEFR band string, display only.
 *   title              learner-facing title. Plain, not grammatical jargon.
 *   srsType            always 'gram'. Feeds SRS.scheduleItem('gram', id, …).
 *   srsRef             equals `id`. Written out so the key is greppable.
 *   srsKey             'gram:' + id. Denormalised for tests and dashboards.
 *   mistakeCategory    default js/core/mistakes.js category id for wrong answers
 *                      here. Per-feedback `logAs` overrides it (FR-SRS-3).
 *   prerequisites      ids of points a learner really needs first. Advisory:
 *                      the app may order by this, but must not hard-gate —
 *                      nothing in the methodology gates grammar.
 *
 * Teaching (the "notice" half of methodology principle 7)
 *   rule               ONE sentence. This is the exact string shown on a wrong
 *                      answer (methodology §2: "state the rule in one
 *                      sentence"). Keep it sayable out loud.
 *   explain            2–4 sentences that teach the *mechanism*, not a restated
 *                      rule. May name the L1 pattern.
 *   decide             ordered array of questions the learner can actually run
 *                      in real time. This is the part that transfers to speech.
 *   whyItMatters       one honest sentence about what breaks if you get it
 *                      wrong. Do not inflate it (methodology principle 3).
 *   notice             { lines: [{speaker, text}], question, answer }
 *                      A short natural exchange with the target in **bold**,
 *                      plus one noticing question. Markup convention across all
 *                      content: **double asterisks** for the target form.
 *   contrast           EXACTLY 3 pairs. Each is
 *                      { pair: [{text, means}, {text, means}], takeaway }
 *                      Both members must be correct English differing ONLY in
 *                      the target form, with a real change of meaning. This is
 *                      deliberately not the {right, wrong} shape sketched in
 *                      CONTENT_AUTHORING_GUIDE.md §6: a contrast teaches what
 *                      the form *does*, and "wrong vs right" cannot do that.
 *                      Genuine learner errors live in `commonErrors` instead.
 *   spokenNote         how the form actually sounds in connected speech. This is
 *                      a spoken-English app; written-only teaching is half a
 *                      lesson (authoring guide §3 rule 4).
 *   caveats            honest limits. Where the rule has exceptions, say so.
 *                      Never let the lesson imply a clean rule that isn't.
 *   commonErrors       [{ heard, fix, why, l1 }] — the error forms this learner
 *                      actually produces, keyed to a REQUIREMENTS.md §3.2 code.
 *                      Shown after practice, never before (do not prime errors).
 *
 * Practice (the "practise" half) — EXACTLY 6 items
 *   id                 '<lesson id>-p<n>'. Stable: the mistake log and
 *                      `review.itemIds` reference it.
 *   mode               'gap' | 'choose' | 'repair' | 'order'. Only 'gap' is used
 *                      by this point; the others are reserved so later points
 *                      (word order, tags) need no schema change.
 *   focus              sub-rule this item isolates. One item, one sub-rule
 *                      (authoring guide §3 rule 1). Also the natural unit for
 *                      per-sub-rule accuracy later.
 *   prompt             the sentence(s) with '___' for the gap. Enough context
 *                      that the answer set is closed (authoring guide §3 rule 2).
 *   options            the choices offered to the learner. Every option must
 *                      belong to ONE grammatical set, so that nothing but the
 *                      target form varies between them. The set is chosen per
 *                      point, not fixed by this schema: the articles point below
 *                      offers the four article choices (a / an / the /
 *                      ZERO_ARTICLE), while point 4 in
 *                      data/grammar/countability.js offers sets like ["advice",
 *                      "advices", "an advice", "some advices"] and ["much",
 *                      "many", "a lot of", "a"]. Until free text exists this is
 *                      ALSO the full set of right answers: EVERY entry in
 *                      `accept` must appear here (US-166). A `gap` item has no
 *                      typed input — renderGrammarPracticeItem() builds one
 *                      <button> per `options` entry and nothing else — so an
 *                      accepted answer outside this array can never be
 *                      submitted, and `fallbackFeedback` never fires for it
 *                      either. It is dead content that also makes
 *                      `showDifferenceOnCorrect` lie: the renderer announces two
 *                      right answers and then names one nobody was shown. Six
 *                      items shipped that way before tools/validate-content.js
 *                      existed to catch it.
 *   accept             array of EVERY defensible answer, each
 *                      { answer, means }. `means` is what that choice makes the
 *                      sentence mean. FR-GRM-5 lives here, and is honoured one of
 *                      two ways: PROMOTE the second defensible answer into
 *                      `options` so the learner can actually choose it, or name it
 *                      as correct in `fallbackFeedback` and leave it out of
 *                      `accept`. It is never "wrong". Before promoting, check the
 *                      answer is licensed by THIS prompt — one shipped item
 *                      accepted an emphatic "did see" whose own `means` had to
 *                      invent a contradicting remark the sentence never made.
 *   showDifferenceOnCorrect
 *                      true only when accept.length > 1. Methodology §2 says a
 *                      right first answer should say nothing more; the one
 *                      exception is an item with two right answers, where the
 *                      learner has to be told the two are not interchangeable.
 *   feedback           one entry per wrong option:
 *                      { forAnswer, reason, contrast: [2 strings], retryCue,
 *                        grammaticalButDifferent, logAs }
 *                        reason    — WHY, in the learner's terms. Never a verdict.
 *                        contrast  — a 2-sentence minimal pair showing what the
 *                                    learner's choice would have meant.
 *                        retryCue  — the question to ask yourself before trying
 *                                    again. This is the "retry" half of FR-GRM-2.
 *                        grammaticalButDifferent — true when the choice is real
 *                                    English that simply means something else
 *                                    here. Articles are mostly this, and saying
 *                                    so is the difference between teaching and
 *                                    scolding.
 *                        logAs     — the mistake-log category to log, when it
 *                                    differs from the lesson default. These are
 *                                    js/core/mistakes.js ids; that file owns the
 *                                    taxonomy. Not every entry in an articles
 *                                    item is an article error: where the learner
 *                                    has treated an uncountable noun as countable
 *                                    ("a work", "an meat") this points at
 *                                    `gram.uncountable-plural`, because that is
 *                                    where the drill that fixes it lives.
 *                        errorKind — finer grain than the learner-facing
 *                                    category, for authoring and analysis only.
 *                                    Never displayed: the mistake log shows one
 *                                    plain-language label per category.
 *   fallbackFeedback   { reason, contrast, retryCue } for an answer that is not in
 *                      `options` at all. NOTE, so it is not mistaken for a live
 *                      path: no typed input exists in the grammar section today,
 *                      so this fires only when an OFFERED option has no authored
 *                      `feedback` entry. It is written properly on every item
 *                      anyway, as the standing contract for the day free text
 *                      arrives — and because it is where a defensible answer that
 *                      is not offered gets named as correct rather than dropped.
 *                      Without it, free-text input would produce a bare verdict,
 *                      which FR-GRM-2 forbids.
 *   spoken             optional: how the answer is actually pronounced here.
 *   rendersAs          optional map { <answer>: <display form> }, for a gap that
 *                      falls at the start of a sentence. Grade against `answer`,
 *                      render `rendersAs[answer]`, so capitalisation never
 *                      becomes part of the correctness check.
 *   alsoNotice         optional: a second, smaller thing worth seeing in this
 *                      sentence. Shown after the item is answered.
 *
 * Production (the "use" half) — one say-it-aloud task
 *   produce            { id, task, targetSeconds, useLanguage, selfCheck,
 *                        model: { text, note }, skippable, srsSelfReport }
 *                        selfCheck — checkable questions ("did I say…"), never
 *                                    "did it sound good?" (cf. FR-PRN-4).
 *                        model     — an example, with a note telling the learner
 *                                    not to read it aloud: methodology principle
 *                                    1 requires the learner to say something
 *                                    that was not read off the screen.
 *                        skippable — FR-SPK-9: speaking is never a hard gate.
 *                        srsSelfReport — outcome goes through SRS.selfReport, so
 *                                    it can shorten an interval but never counts
 *                                    as verified-correct (FR-SRS-5).
 *
 * L1 targeting (FR-GRM-4)
 *   l1Notes            { <l1 id>: { transferId, priority, note, bridge } }
 *                      transferId keys to REQUIREMENTS.md §3.2 (e.g. 'T-G1').
 *                      priority 'M' | 'S' | 'W' drives L1-first ordering.
 *                      Absent l1 → the lesson simply shows no note.
 *
 * Review (FR-GRM-3)
 *   review             { rulePrompt, itemIds } — what a *due* review looks like,
 *                      without re-teaching the whole lesson. itemIds rotate so a
 *                      review is not always the first practice item.
 *
 * -----------------------------------------------------------------------------
 * SRS PROJECTION CONTRACT — js/core/srs.js is the authority, not this comment
 * -----------------------------------------------------------------------------
 * `SRS.scheduleItem('gram', lesson.id, lesson, correct)` does not store the
 * lesson. It stores a *projection* of it: `PROJECTORS.gram` in js/core/srs.js
 * names the fields copied onto `rec.data`, and a field absent from that list is
 * silently dropped from every review record. Nothing throws and nothing fails a
 * test — the field is simply not there when the card renders.
 *
 * So do not read a field list off this comment, and do not paste one back in.
 * This file does not own the registry, an earlier copy of the list here rotted,
 * and a reviewer then read the comment instead of the code and reported a
 * long-fixed defect as live. Ask the code what a given item loses:
 *
 *     SRS.auditProjection('gram', lesson)
 *       -> { type, fields, projected, dropped, omitted, phantom, ignored }
 *
 *   projected  the review card will see it.
 *   dropped    YOU AUTHORED IT AND NO CARD WILL EVER SEE IT. This is the bug
 *              the audit exists to surface; it is never intentional.
 *   omitted    unprojected on purpose (`DELIBERATE_OMISSIONS.gram`) — see below.
 *   phantom    the projector asks for a field this lesson does not have. Either
 *              the projector was edited against a guess, or the content is
 *              incomplete.
 *   ignored    identity fields (`NON_CONTENT_FIELDS`: srsType/srsRef/srsKey).
 *              schedule() lifts them onto the record as type/ref/key, so their
 *              absence from the payload is not loss.
 *
 * ADDING A FIELD TO THIS SCHEMA IS THEREFORE TWO EDITS: here, and
 * `PROJECTORS.gram`. `_project()` runs the same audit on every scheduled item
 * and warns once per type+field under Node and on localhost (force it either way
 * with `SRS_PROJECTION_WARNINGS = true|false`), so a Jest run will name the
 * field you forgot — but only for content something actually schedules.
 *
 * Deliberately unprojected — `DELIBERATE_OMISSIONS.gram`, reported as `omitted`.
 * These are decisions, not oversights; do not "fix" one by widening the
 * projector:
 *   notice · decide · whyItMatters · spokenNote · commonErrors
 *       First-teaching material. A review is by definition not the first
 *       teaching — FR-GRM-3 wants a due point reviewable "without re-teaching
 *       the whole lesson", and a card that re-runs the noticing exchange and the
 *       decision procedure is just the lesson again.
 *   prerequisites · syllabusNumber · tags
 *       Authoring and ordering metadata. A card has no use for them.
 * Every one of these still lives here in the content, so a *lesson* view reads
 * them from this file directly. Only the review card is projected.
 *
 * One field not to go looking for: no grammar point has `difficulty`. `tier`
 * carries the level (js/core/levels.js ids), and the projector takes it from
 * there. An earlier draft of this comment recommended adding `difficulty`;
 * `difficulty`, `explanation` and `example` are precisely the phantom fields a
 * projector once declared for `gram` while dropping `rule`, and they have been
 * removed already. Re-adding any of them re-creates that bug.
 *
 * And never close a projection gap by duplicating a paragraph under a second
 * field name — two copies of a paragraph drift. Fix the projector.
 * -----------------------------------------------------------------------------
 */

/**
 * The canonical value for "no article at all". Deliberately the empty string, so
 * that rendering the chosen answer into the gap produces the correct sentence
 * with no post-processing. Display it with ZERO_ARTICLE_LABEL; when grading typed
 * input, normalise "", "-", "—", "none", "no article" and "zero" to this value.
 */
const ZERO_ARTICLE = "";
const ZERO_ARTICLE_LABEL = "— (no article)";

/** Content-shape version, for future content migrations. Bump on schema change. */
const GRAMMAR_SCHEMA_VERSION = 1;

/**
 * The mistake-log ids this content DECLARES — collected from the content, not
 * hand-copied beside it (US-160).
 *
 * `js/core/mistakes.js` owns the taxonomy (its `BUILT_IN_CATEGORIES`), so content
 * references its ids directly rather than inventing a parallel vocabulary. A
 * literal `MISTAKE_CATEGORIES` array used to sit here, described as "the grammar
 * subset, held here so a typo in a `logAs` fails a test instead of silently
 * landing everything in 'general.uncategorised'". It has been deleted, for two
 * reasons:
 *
 *  1. It was a second copy of data that something else owns, and it had already
 *     rotted — it omitted `gram.register-indian`, so the guard built to catch an
 *     invalid id would have rejected a valid one. A stale allow-list is worse
 *     than no allow-list, because it fails in the direction that looks correct.
 *  2. It pointed the check the wrong way. It let a test ask "is this id in my
 *     local list?", when the only question worth asking is "is this id
 *     registered in the module that owns the taxonomy and that `record()` will
 *     accept?". Two APIs were added there last wave to answer exactly that:
 *
 *         Mistakes.categoryIds({ strand: 'grammar' })   // the live grammar ids
 *         Mistakes.unknownCategories(ids)               // [] = they all resolve
 *
 * Ask at the moment of the check, not at load time. A `const` initialised from
 * `categoryIds()` here would only be a fresher snapshot, and it would be empty in
 * any context where mistakes.js has not loaded yet — a guard that silently passes
 * everything is the same defect in a new place.
 *
 * What this file keeps instead is the other half of the pair: the ids the content
 * really uses. Feeding these to `unknownCategories()` catches a typo a hand-copied
 * list never could, because it reads the actual `logAs` strings rather than a
 * transcription of them.
 *
 * @param {Object} [lessons] a tier map; defaults to `grammarLessons`. Pass it
 *        explicitly to cover points that self-register after this file loads
 *        (point 4 in data/grammar/countability.js pushes itself in).
 * @returns {string[]} deduplicated ids, in first-seen order.
 */
function grammarMistakeCategoryIds(lessons) {
    const source = lessons || grammarLessons;
    const out = [];
    const seen = Object.create(null);

    function add(id) {
        if (typeof id !== "string" || !id || seen[id]) return;
        seen[id] = true;
        out.push(id);
    }

    Object.keys(source || {}).forEach(function (tier) {
        const points = source[tier];
        if (!Array.isArray(points)) return;
        points.forEach(function (point) {
            if (!point) return;
            add(point.mistakeCategory);
            const practice = Array.isArray(point.practice) ? point.practice : [];
            practice.forEach(function (item) {
                if (!item || !Array.isArray(item.feedback)) return;
                item.feedback.forEach(function (entry) {
                    if (entry) add(entry.logAs);
                });
            });
        });
    });

    return out;
}

/**
 * Two facts about the ids above, kept here because they are the ones an author
 * gets wrong. The live taxonomy deliberately MERGES article omission ("I went to
 * shop") and wrong article choice ("He is the engineer") into one learner-facing
 * category, because "article omission, 4.7 times" is not a sentence anyone should
 * be handed; the finer distinction lives in `errorKind` on each feedback entry, so
 * per-sub-rule analysis survives without splitting the category the learner sees.
 * And pronunciation mistakes use the `prn.*` ids — phoneme detail rides along in
 * the `phon:<pair-id>` SRS key, never in a category name.
 *
 * The category names sketched in IMPLEMENTATION_PLAN.md Phase 9, mapped to the
 * ids that actually shipped in js/core/mistakes.js. Kept so the plan stays
 * readable against the code, and so any content authored against the old names
 * can be translated in one place instead of edited entry by entry.
 */
const MISTAKE_CATEGORY_ALIASES = {
    "article-omission": "gram.articles",
    "article-wrong-choice": "gram.articles",
    "subject-verb-agreement": "gram.subject-verb-agreement",
    "past-tense-form": "gram.verb-form",
    "preposition": "gram.preposition-transfer",
    "countable-uncountable": "gram.uncountable-plural",
    "word-stress": "prn.word-stress",
    "collocation": "vocab.collocation"
};

const grammarLessons = {
    foundation: [
        {
            // ---------------------------------------------------------------
            // Point 3 — Articles. CURRICULUM.md §3 Strand B, "the classic
            // Indian-English pressure point"; T-G1 in REQUIREMENTS.md §3.2.
            // ---------------------------------------------------------------
            id: "articles",
            syllabusNumber: 3,
            tier: "foundation",
            cefr: "A1–A2",
            title: "a, an, the — and when to use nothing at all",

            srsType: "gram",
            srsRef: "articles",
            srsKey: "gram:articles",
            mistakeCategory: "gram.articles",

            // Deliberately empty, and it has to stay empty in BOTH directions:
            // point 4 (data/grammar/countability.js) keeps `prerequisites: []`
            // for the same reason, so there is no 3↔4 edge left to close.
            //
            // This point previously listed ["countable-uncountable"], which was
            // a cycle waiting to happen: this is syllabusNumber 3 and that point
            // is 4, so the edge made the earlier point require the later one, and
            // any loader that orders by `prerequisites` either deadlocks or drops
            // one of the two. GRAMMAR_SAMPLE_REVIEW.md §7.2 is the origin of that
            // entry ("you cannot choose a/the/zero without countability").
            //
            // The dependency it was recording is real but is on the *concept*,
            // not on point 4 as a lesson, and this point teaches the subset it
            // needs in place: `decide` step 1 asks "can I count this thing",
            // p4 turns on uncountable *meat*, p6 on uncountable *work*, and p3's
            // `alsoNotice` covers *milk*. It is also mutual — point 4 teaches the
            // article facts it uses ("a" means one, so it cannot precede stuff)
            // in place for exactly the same reason. A relationship that runs both
            // ways cannot be a prerequisite edge in either direction, so it is
            // recorded as prose here and stays out of the graph.
            //
            // If a later author decides the full lesson-level dependency IS real,
            // do not renumber here: CURRICULUM.md §3 Strand B fixes the numbering
            // (3 = articles, 4 = countability), so the syllabus would be the
            // thing with the order wrong. Change §3 first, then `syllabusNumber`
            // on both points to follow it, and only then add the edge.
            prerequisites: [],

            rule: "Before you name a thing, ask what your listener already knows: use **the** when you both have the same one in mind, **a** or **an** when you are introducing one they do not know about yet, and nothing at all when you mean the thing in general or an amount you cannot count.",

            explain: "Every time you name a thing in English, you also have to say whether your listener can already pick it out. That is the entire job of these little words: **a** hands your listener something new, **the** points at something you have both got in mind already — from earlier in the conversation, or just from the room you are standing in. Telugu marks this only when it matters, so in English the slot in front of the noun feels empty rather than wrong, and that is why this error outlives almost every other one. Most learners need a long time before it becomes automatic; what you are building here is a habit, not a fact.",

            decide: [
                "Can I count this thing, and am I talking about one of them? If it is uncountable (water, advice, money) or a general plural (buses, doctors), you usually need nothing at all.",
                "Does my listener already know which one I mean — because we just mentioned it, or because it is obvious right here? If yes, use **the**.",
                "One thing, and they do not know which yet? Use **a**, or **an** if the next word starts with a vowel *sound*."
            ],

            whyItMatters: "A missing article rarely stops anyone understanding you, so this is not about sounding correct — it is about two specific things: it is the most noticeable feature of Indian English to a listener from outside the region, and a wrong **the** can genuinely mislead, because \"He is the engineer\" sends your listener looking for an engineer they were supposed to already know about.",

            notice: {
                lines: [
                    { speaker: "You", text: "Excuse me, is there **a** chemist near here?" },
                    { speaker: "Passer-by", text: "Yes — go past **the** bank and it is on **the** left." },
                    { speaker: "You", text: "Thanks. Do they take **cards**?" }
                ],
                question: "Why is it *a chemist* but *the bank*, when neither has been mentioned before?",
                answer: "Because *the* is not about mentioning — it is about whether you both already know which one. You do not know which chemist you want, so it is **a chemist**. But there is only one bank on that street and you can both see it, so it is **the bank**. And *cards* is a general plural — all cards, not particular ones — so it takes nothing at all."
            },

            contrast: [
                {
                    pair: [
                        {
                            text: "I am waiting for a bus.",
                            means: "Any bus that goes my way. I have not told you which one, and you do not need to know."
                        },
                        {
                            text: "I am waiting for the bus.",
                            means: "The one we both know about — my usual one, or the one we were just talking about."
                        }
                    ],
                    takeaway: "Both are correct. **a** means \"you do not know which one yet\"; **the** means \"we are both thinking of the same one\"."
                },
                {
                    pair: [
                        {
                            text: "He is a doctor.",
                            means: "That is his job. This is the normal way to say what someone does."
                        },
                        {
                            text: "He is the doctor.",
                            means: "He is the particular doctor we are expecting — the one who will see you, the one on duty. You would say it while pointing him out."
                        }
                    ],
                    takeaway: "Jobs take **a** or **an**. **The** picks out one specific person your listener is already looking for — which is why \"He is the engineer\" makes people ask \"which engineer?\"."
                },
                {
                    pair: [
                        {
                            text: "I am going to school.",
                            means: "I am going as a student, for lessons. Here *school* is the activity, not the building."
                        },
                        {
                            text: "I am going to the school.",
                            means: "I am going to the building — to meet a teacher, to vote, to collect my nephew."
                        }
                    ],
                    takeaway: "With *school*, *work*, *hospital*, *church* and *prison*, English drops the article when you mean the activity and uses **the** when you mean the building. This is a short fixed list, not a general rule."
                }
            ],

            spokenNote: "Nobody stresses these words, so do not give them their full value. **a** is /ə/ (\"uh\"), not /eɪ/ (\"ay\") — /ə ˈbʌs/, not /eɪ ˈbʌs/. **the** is /ðə/ before a consonant sound (*the bus*) and /ði/ before a vowel sound (*the office*). **an** links straight into the next word, so *an hour* comes out as one word, /əˈnaʊə/. If you say these words clearly and separately, you sound slower and less fluent than you actually are.",

            caveats: [
                "Some phrases simply have no article and are learned whole: *go to work*, *go to bed*, *at home*, *by bus*, *on foot*, *have breakfast*. There is no rule to derive here; learn the phrase.",
                "British and American English disagree about hospital: *She is in hospital* (British) and *She is in the hospital* (American) are both standard. This app will not mark either wrong.",
                "Names are inconsistent and have to be learned one by one: *India*, *Hyderabad*, *Lake Superior* take nothing, but *the UK*, *the US*, *the Netherlands*, *the Ganges* take **the**.",
                "Articles are the last thing most advanced speakers get fully right, and a real minority of uses are idiom rather than logic. Where careful speakers would accept either, this app accepts both — if you are ever told a defensible answer is wrong, the item is broken, not you."
            ],

            commonErrors: [
                {
                    heard: "I went to shop.",
                    fix: "I went to the shop. / I went to a shop.",
                    why: "*Shop* is one countable thing, so the slot in front of it cannot stay empty. Use **the** for the one near your house, **a** for some shop you have not identified.",
                    l1: "T-G1"
                },
                {
                    heard: "He is the engineer.",
                    fix: "He is an engineer.",
                    why: "Jobs take **a** or **an**. **The** tells your listener to look for a specific engineer they should already know about.",
                    l1: "T-G1"
                },
                {
                    heard: "I am doing the shopping every Sunday.",
                    fix: "I do the shopping every Sunday.",
                    why: "Here the article is fine — *the shopping* is a fixed phrase. The tense is what to look at; see point 2.",
                    l1: "T-G3"
                }
            ],

            practice: [
                {
                    id: "articles-p1",
                    mode: "gap",
                    focus: "a-or-an-by-sound",
                    prompt: "It takes ___ hour by bus.",
                    options: ["a", "an", "the", ZERO_ARTICLE],
                    accept: [
                        { answer: "an", means: "One hour — some hour, not a particular one you both have in mind." }
                    ],
                    showDifferenceOnCorrect: false,
                    spoken: "*an hour* runs together as one word: /əˈnaʊə/. The h is silent.",
                    feedback: [
                        {
                            forAnswer: "a",
                            reason: "The choice between **a** and **an** follows the *sound* that comes next, not the letter. *Hour* is written with h but said with a vowel — the h is silent — so it needs **an**.",
                            contrast: [
                                "It takes an hour by bus.",
                                "It takes a bus ticket and ten minutes."
                            ],
                            retryCue: "Say the next word out loud on its own. Does it *start* with a vowel sound?",
                            grammaticalButDifferent: false,
                            logAs: "gram.articles",
                            errorKind: "wrong-choice"
                        },
                        {
                            forAnswer: "the",
                            reason: "**The hour** would mean one particular hour you have both already talked about, and here you are just saying how long the journey is.",
                            contrast: [
                                "It takes an hour by bus.",
                                "I will call you in the hour before the meeting."
                            ],
                            retryCue: "Have we already agreed which hour we are talking about?",
                            grammaticalButDifferent: true,
                            logAs: "gram.articles",
                            errorKind: "wrong-choice"
                        },
                        {
                            forAnswer: ZERO_ARTICLE,
                            reason: "*Hour* is one countable thing here, and a singular countable noun cannot stand on its own in English — the slot in front of it has to be filled.",
                            contrast: [
                                "It takes an hour by bus.",
                                "It takes time."
                            ],
                            retryCue: "Can I count this — one hour, two hours? If I can, something has to go in front of it.",
                            grammaticalButDifferent: false,
                            logAs: "gram.articles",
                            errorKind: "omission"
                        }
                    ],
                    fallbackFeedback: {
                        reason: "This item is only about the four article choices — **a**, **an**, **the**, or nothing — so anything else cannot be checked here.",
                        contrast: [
                            "It takes an hour by bus.",
                            "It takes one hour by bus."
                        ],
                        retryCue: "Pick from a, an, the, or no article. Which one does *hour* need, going by its sound?"
                    },
                    alsoNotice: "*by bus* takes no article at all. So does *by train*, *by car*, *on foot* — learn them as whole phrases."
                },
                {
                    id: "articles-p2",
                    mode: "gap",
                    focus: "second-mention-the",
                    prompt: "I watched a film last night. ___ film was really long.",
                    options: ["a", "an", "the", ZERO_ARTICLE],
                    accept: [
                        { answer: "the", means: "The same film you have just introduced. Once it is on the table between you, it becomes **the** film." }
                    ],
                    // Sentence-initial gap: grade against `answer`, display `rendersAs`.
                    rendersAs: { the: "The" },
                    showDifferenceOnCorrect: false,
                    spoken: "Unstressed and short: /ðə ˈfɪlm/. It should take less time to say than *film*.",
                    feedback: [
                        {
                            forAnswer: "a",
                            reason: "**A film** starts again from nothing, so your listener hears you talking about a second, different film they have not been told about. You have already introduced this one, so it is no longer new.",
                            contrast: [
                                "I watched a film last night. The film was really long.",
                                "I watched a film last night. A film I saw last year was even longer."
                            ],
                            retryCue: "Is this a new thing for my listener, or the same one I mentioned a second ago?",
                            grammaticalButDifferent: true,
                            logAs: "gram.articles",
                            errorKind: "wrong-choice"
                        },
                        {
                            forAnswer: "an",
                            reason: "**An** is only the form of **a** used before a vowel sound, so it has the same problem — it introduces a different film — and *film* starts with a consonant sound anyway.",
                            contrast: [
                                "I watched a film last night. The film was really long.",
                                "I watched an old film last night."
                            ],
                            retryCue: "Two questions, in order: new thing or the same one? Then, if it is new, what sound comes next?",
                            grammaticalButDifferent: false,
                            logAs: "gram.articles",
                            errorKind: "wrong-choice"
                        },
                        {
                            forAnswer: ZERO_ARTICLE,
                            reason: "*Film* here is one particular countable thing, so it cannot stand alone. Leaving the slot empty is the commonest article mistake in Indian English, and it is the one listeners notice most.",
                            contrast: [
                                "I watched a film last night. The film was really long.",
                                "I watched films all weekend."
                            ],
                            retryCue: "Am I talking about one specific film, or about films in general?",
                            grammaticalButDifferent: false,
                            logAs: "gram.articles",
                            errorKind: "omission"
                        }
                    ],
                    fallbackFeedback: {
                        reason: "Only the four article choices are being tested here — **a**, **an**, **the**, or nothing.",
                        contrast: [
                            "I watched a film last night. The film was really long.",
                            "I watched a film last night. That film was really long."
                        ],
                        retryCue: "*That* would also work in real speech, but choose from a, an, the, or no article: which one marks the film we have both got in mind?"
                    },
                    alsoNotice: "This is the pattern to listen for in your own speech: **a** the first time, **the** every time after. It is the single most useful article habit you can build."
                },
                {
                    id: "articles-p3",
                    mode: "gap",
                    focus: "filling-the-empty-slot",
                    prompt: "I went to ___ shop and bought milk.",
                    options: ["a", "an", "the", ZERO_ARTICLE],
                    accept: [
                        { answer: "the", means: "The shop we both know — the usual one near your house. This is what most people would say." },
                        { answer: "a", means: "Some shop, not one you expect your listener to know. You would say this if the shop is not the point." }
                    ],
                    // Two right answers, so the learner is told the difference even
                    // when correct. See the schema note on showDifferenceOnCorrect.
                    showDifferenceOnCorrect: true,
                    spoken: "*the shop* → /ðə ˈʃɒp/; *a shop* → /ə ˈʃɒp/. Both articles are just a quick \"uh\" sound before the noun.",
                    feedback: [
                        {
                            forAnswer: "an",
                            reason: "**An** goes before a vowel *sound*, and *shop* begins with the consonant /ʃ/. The meaning would have been fine — the form is not.",
                            contrast: [
                                "I went to a shop and bought milk.",
                                "I went to an ATM and took out some cash."
                            ],
                            retryCue: "Say *shop* on its own. Vowel sound or consonant sound at the front?",
                            grammaticalButDifferent: false,
                            logAs: "gram.articles",
                            errorKind: "wrong-choice"
                        },
                        {
                            forAnswer: ZERO_ARTICLE,
                            reason: "This is the T-G1 pattern exactly: in Telugu *shop* can stand there alone, and in English it cannot. *Shop* is one countable thing, so the slot in front of it has to be filled — with **the** if it is the shop we both know, with **a** if it is just some shop.",
                            contrast: [
                                "I went to the shop and bought milk.",
                                "I went shopping and bought milk."
                            ],
                            retryCue: "If you cannot decide between a and the, notice that *I went shopping* avoids the problem completely — that is a legitimate escape, not cheating. But here, which shop do I mean?",
                            grammaticalButDifferent: false,
                            logAs: "gram.articles",
                            errorKind: "omission"
                        }
                    ],
                    fallbackFeedback: {
                        reason: "Only the four article choices are being tested here — **a**, **an**, **the**, or nothing. Note that *my* and *that* would also be fine in real speech; they do the same job as **the**.",
                        contrast: [
                            "I went to the shop and bought milk.",
                            "I went to my usual shop and bought milk."
                        ],
                        retryCue: "Choose from a, an, the, or no article: does my listener know which shop?"
                    },
                    alsoNotice: "Nothing goes in front of *milk*. It is uncountable, so it takes no **a** — you could add *some* (*bought some milk*), but nothing at all is fine here. \"I bought a milk\" would make your listener wait for a unit — *a bottle of milk*, *a litre of milk*."
                },
                {
                    id: "articles-p4",
                    mode: "gap",
                    focus: "zero-article-for-things-in-general",
                    prompt: "I am vegetarian. I do not eat ___ meat.",
                    options: ["a", "an", "the", ZERO_ARTICLE],
                    accept: [
                        { answer: ZERO_ARTICLE, means: "Meat in general, all of it, always. This is the meaning *I am vegetarian* forces." }
                    ],
                    showDifferenceOnCorrect: false,
                    spoken: "Say it straight through — *do not eat meat* /dəʊnt iːt miːt/ — with no little pause where an article would go. In fast speech this is *I don't eat meat*.",
                    feedback: [
                        {
                            forAnswer: "the",
                            reason: "**The meat** narrows it to one particular lot of meat — the meat on this plate, the meat at that restaurant. That contradicts *I am vegetarian*, which is about meat in general.",
                            contrast: [
                                "I am vegetarian. I do not eat meat.",
                                "The curry was fine, but I did not eat the meat."
                            ],
                            retryCue: "Am I talking about all meat everywhere, or about some particular meat in front of me?",
                            grammaticalButDifferent: true,
                            logAs: "gram.articles",
                            errorKind: "wrong-choice"
                        },
                        // US-165. These two answers are an ARTICLE choice in an
                        // articles lesson, and they are still not an article
                        // error: the learner has treated an uncountable noun as
                        // countable, and the fix is the countability drill, not
                        // this one. So they route to `gram.uncountable-plural`
                        // — the same id data/grammar/countability.js uses for
                        // "an advice" — while every other feedback entry in this
                        // point stays `gram.articles`. Before this converged, a
                        // learner who met the habit here and in point 4 was
                        // handed two findings, two half-counts and two drill
                        // targets for one habit. `errorKind` keeps the finer
                        // grain for analysis; it is never displayed.
                        {
                            forAnswer: "a",
                            reason: "**A** counts things one at a time, and *meat* is uncountable — you cannot have one meat and two meats. If you want to count it, you count the container or the piece.",
                            contrast: [
                                "I do not eat meat.",
                                "I do not eat a lot of chicken either."
                            ],
                            retryCue: "Can I put a number in front of this word? If not, **a** cannot go there.",
                            grammaticalButDifferent: false,
                            logAs: "gram.uncountable-plural",
                            errorKind: "uncountable-treated-as-countable"
                        },
                        {
                            forAnswer: "an",
                            reason: "Same problem as **a** — *meat* is uncountable, so neither form fits — and *meat* starts with a consonant sound in any case.",
                            contrast: [
                                "I do not eat meat.",
                                "I do not eat an egg every day, only sometimes."
                            ],
                            retryCue: "Can I count it? Then: what sound comes next?",
                            grammaticalButDifferent: false,
                            logAs: "gram.uncountable-plural",
                            errorKind: "uncountable-treated-as-countable"
                        }
                    ],
                    fallbackFeedback: {
                        reason: "Only the four article choices are being tested here — **a**, **an**, **the**, or nothing.",
                        contrast: [
                            "I do not eat meat.",
                            "I do not eat any meat at all."
                        ],
                        retryCue: "*Any* would work too, for emphasis. From a, an, the, or nothing: which one means \"all meat, in general\"?"
                    },
                    alsoNotice: "You will hear both *I am vegetarian* and *I am a vegetarian*, and both are correct — the first describes you, the second puts you in a group. This is one of the places where the choice is genuinely free."
                },
                {
                    id: "articles-p5",
                    mode: "gap",
                    focus: "the-from-the-situation",
                    prompt: "Could you close ___ door behind you?",
                    options: ["a", "an", "the", ZERO_ARTICLE],
                    accept: [
                        { answer: "the", means: "The one door you both know I mean — the one you just came through. Nothing had to be mentioned first; the situation identifies it." }
                    ],
                    showDifferenceOnCorrect: false,
                    spoken: "/ðə ˈdɔː/ — quick and unstressed. The stress goes on *close* and *door*, never on *the*.",
                    feedback: [
                        {
                            forAnswer: "a",
                            reason: "**A door** would mean any one of several doors, so your listener has to choose which — an odd thing to be asked. *Behind you* already tells them exactly which door you mean, and once a thing is identified, English wants **the**.",
                            contrast: [
                                "Could you close the door behind you?",
                                "It is noisy in here. Could you close a window — whichever one is nearest?"
                            ],
                            retryCue: "Does my listener have to pick which one, or is it already obvious which one I mean?",
                            grammaticalButDifferent: true,
                            logAs: "gram.articles",
                            errorKind: "wrong-choice"
                        },
                        {
                            forAnswer: "an",
                            reason: "Two problems: it introduces a door as new when *behind you* has already identified it, and **an** only goes before a vowel sound, which *door* does not have.",
                            contrast: [
                                "Could you close the door behind you?",
                                "Could you open an umbrella? It is starting to rain."
                            ],
                            retryCue: "Is this door already identified? And what sound starts the next word?",
                            grammaticalButDifferent: false,
                            logAs: "gram.articles",
                            errorKind: "wrong-choice"
                        },
                        {
                            forAnswer: ZERO_ARTICLE,
                            reason: "*Door* is one countable thing, so the slot cannot stay empty. This is the same gap as \"I went to shop\" — the word your Telugu sentence does not need is the word English insists on.",
                            contrast: [
                                "Could you close the door behind you?",
                                "Could you close all the doors behind you?"
                            ],
                            retryCue: "One door, and we both know which one. What goes in front of it?",
                            grammaticalButDifferent: false,
                            logAs: "gram.articles",
                            errorKind: "omission"
                        }
                    ],
                    fallbackFeedback: {
                        reason: "Only the four article choices are being tested here — **a**, **an**, **the**, or nothing.",
                        contrast: [
                            "Could you close the door behind you?",
                            "Could you close that door behind you?"
                        ],
                        retryCue: "From a, an, the, or nothing: we both already know which door, so which one is it?"
                    },
                    alsoNotice: "This is **the** without any earlier mention. The room does the identifying — same reason you say *pass me the salt* at a table, not *pass me a salt*."
                },
                {
                    id: "articles-p6",
                    mode: "gap",
                    focus: "fixed-phrases-with-no-article",
                    prompt: "I usually go to ___ work by bus.",
                    options: ["a", "an", "the", ZERO_ARTICLE],
                    accept: [
                        { answer: ZERO_ARTICLE, means: "*Go to work* is a fixed phrase about the activity — being at your job. It never takes an article." }
                    ],
                    showDifferenceOnCorrect: false,
                    spoken: "*go to work* → /ɡəʊ tə ˈwɜːk/. Notice *to* weakens to /tə/; only *go* and *work* carry any weight.",
                    feedback: [
                        {
                            forAnswer: "the",
                            reason: "**The work** means the tasks themselves, not the place or the routine — so \"I go to the work\" leaves your listener waiting to hear which work. *Go to work* belongs to the same small family as *go to school*, *go to bed*, *go home*: activity, no article.",
                            contrast: [
                                "I usually go to work by bus.",
                                "I finished the work you sent me last night."
                            ],
                            retryCue: "Do I mean the daily routine of being at my job, or a specific pile of tasks?",
                            grammaticalButDifferent: true,
                            logAs: "gram.articles",
                            errorKind: "wrong-choice"
                        },
                        // US-165, as in articles-p4: "a work" / "an work" is the
                        // uncountable-treated-as-countable habit surfacing in an
                        // articles item, so it logs as `gram.uncountable-plural`
                        // and lands the learner in the countability drill. The
                        // "the" entry above is a genuine article error and stays.
                        {
                            forAnswer: "a",
                            reason: "English does not use **a work** for a job — *work* in this sense is uncountable. If you want to count it, the countable word is *job*: *I have a job in Hyderabad*.",
                            contrast: [
                                "I usually go to work by bus.",
                                "I have got a job interview on Monday."
                            ],
                            retryCue: "Would *job* fit better than *work* in what I am trying to say? If yes, use *job* and keep the **a**.",
                            grammaticalButDifferent: false,
                            logAs: "gram.uncountable-plural",
                            errorKind: "uncountable-treated-as-countable"
                        },
                        {
                            forAnswer: "an",
                            reason: "Same as **a** — *work* is uncountable in this meaning — and **an** goes only before a vowel sound, which *work* does not have.",
                            contrast: [
                                "I usually go to work by bus.",
                                "I have got an interview on Monday."
                            ],
                            retryCue: "Countable or not? And what sound comes next?",
                            grammaticalButDifferent: false,
                            logAs: "gram.uncountable-plural",
                            errorKind: "uncountable-treated-as-countable"
                        }
                    ],
                    fallbackFeedback: {
                        reason: "Only the four article choices are being tested here — **a**, **an**, **the**, or nothing.",
                        contrast: [
                            "I usually go to work by bus.",
                            "I usually go to my office by bus."
                        ],
                        retryCue: "*My office* works too, and takes no article of its own. From a, an, the, or nothing: what does the fixed phrase *go to ___* need?"
                    },
                    alsoNotice: "Worth learning as a set, because there is no rule underneath them: *go to work*, *go to school*, *go to bed*, *go home*, *at home*, *by bus*, *have breakfast*."
                }
            ],

            produce: {
                id: "articles-produce",
                task: "Out loud, in three sentences, tell me about the last thing you bought. Introduce it in the first sentence with **a** or **an**. In the next two sentences, talk about the same thing using **the**.",
                targetSeconds: 45,
                useLanguage: ["a / an for the first mention", "the for every mention after that"],
                selfCheck: [
                    "Did I say **a** or **an** the very first time, and **the** every time after?",
                    "Did I put something — a, an, the, my, some — in front of every singular noun, with no empty slots?",
                    "Did I keep the articles short and weak — \"uh\" and \"thuh\" — instead of giving them their full spelling?",
                    "Did I speak for the whole time without stopping to plan?"
                ],
                model: {
                    text: "Last week I bought a water bottle. The bottle was only two hundred rupees. I keep the bottle in my bag now, so I drink more water.",
                    note: "Read this once to see the pattern, then look away from the screen and say your own. Reading it aloud is not the exercise; producing your own sentences is."
                },
                skippable: true,
                srsSelfReport: true
            },

            l1Notes: {
                telugu: {
                    transferId: "T-G1",
                    priority: "M",
                    note: "Telugu has no articles, so there is nothing to translate from. Where it matters, Telugu uses other tools: *oka* (ఒక, \"one\") to introduce something new, and *ā* (ఆ, \"that\") or *ī* (ఈ, \"this\") to point at something known. Most of the time it uses neither, because the listener can work it out. English does not allow that: in front of a singular countable noun the slot must be filled, every single time, even when the meaning is already obvious. That is why the error is so persistent — you are not choosing the wrong word, you are not hearing a slot that your first language does not have.",
                    bridge: "Two habits that transfer straight across: if you would say *oka* in Telugu, English almost certainly wants **a** or **an**; if you would say *ā*, English wants **the**. The third habit is the one with no Telugu equivalent, and it needs deliberate practice: when you would say nothing at all in Telugu, English still needs **a** or **the** before a singular countable noun."
                }
            },

            review: {
                rulePrompt: "One line before you start: **the** when we both know which one, **a** or **an** when you are introducing it, nothing when you mean it in general.",
                itemIds: ["articles-p3", "articles-p5", "articles-p2"]
            },

            tags: ["articles", "determiners", "T-G1", "high-frequency"]
        }
    ],

    // Tiers with no content yet. Present so that grammarLessons[level] is always
    // an array — the `fluent`-tier crash that Phase 5 calls out is exactly this
    // class of bug (reading .length off undefined).
    everyday: [],
    confident: [],
    fluent: []
};

// US-160. The typo guard, run for real rather than only in a test.
//
// The deleted `MISTAKE_CATEGORIES` array never checked anything by itself — it
// was a list that a test could have compared against. This does the check, at
// load, against the module that owns the taxonomy and that `record()` will
// consult, so an unregistered `logAs` is named on the console instead of losing
// the mistake silently at practice time (FR-CNT-1: fail loudly at author time).
//
// Deliberately non-fatal and deliberately cheap: it walks one lesson's feedback
// entries, reports through AppErrorHandler when that module is present, and does
// nothing at all when mistakes.js has not loaded — a content file must never be
// the reason a page fails to start. It sees only what is registered and loaded at
// this moment, so point 4 (data/grammar/countability.js, which self-registers
// after this file) is not covered here; the test covers both by passing the
// assembled `grammarLessons` to `grammarMistakeCategoryIds()` explicitly.
if (typeof Mistakes !== "undefined" && Mistakes &&
    typeof Mistakes.unknownCategories === "function") {
    const unknownGrammarCategories = Mistakes.unknownCategories(grammarMistakeCategoryIds());
    if (unknownGrammarCategories.length > 0) {
        const message = "data/grammar.js declares " + unknownGrammarCategories.length +
            " mistake category id(s) that js/core/mistakes.js does not register, so " +
            "record() would refuse them and the mistakes would go unlogged: " +
            unknownGrammarCategories.join(", ");
        if (typeof AppErrorHandler !== "undefined" && AppErrorHandler &&
            typeof AppErrorHandler.logError === "function") {
            AppErrorHandler.logError(new Error(message), "grammar content");
        } else if (typeof console !== "undefined" && console.error) {
            console.error(message);
        }
    }
}

// Match the js/core/* pattern: lexical globals for the browser, CommonJS for the
// Jest suite. `module` is undefined in a classic script, so this is inert there.
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        grammarLessons: grammarLessons,
        grammarMistakeCategoryIds: grammarMistakeCategoryIds,
        MISTAKE_CATEGORY_ALIASES: MISTAKE_CATEGORY_ALIASES,
        ZERO_ARTICLE: ZERO_ARTICLE,
        ZERO_ARTICLE_LABEL: ZERO_ARTICLE_LABEL,
        GRAMMAR_SCHEMA_VERSION: GRAMMAR_SCHEMA_VERSION
    };
}
