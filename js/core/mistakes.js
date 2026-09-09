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
 *   Mistakes.categoryIds()               -> every registered id
 *   Mistakes.registerCategories(rows)    -> { added, replaced, rejected } (FR-CNT-3)
 *   Mistakes.resetCategories()           -> back to the built-ins
 *   Mistakes.drillTarget(id)             -> { strand, target, srsKey, label } | null
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
    //               null means there is nothing honest to drill.
    //   reportable  false = recorded but never ranked or shown as a diagnosis
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
            id: 'gram.uncountable-plural',
            code: 'T-G4',
            strand: 'grammar',
            l1: 'telugu',
            priority: 'M',
            label: 'Plural "-s" on a word that has no plural',
            explanation: '"Information", "advice" and "furniture" never take -s in English; the counting happens outside the word.',
            example: '"three informations" → "three pieces of information"',
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
            id: 'gram.tense-agreement',
            code: null,
            strand: 'grammar',
            l1: null,
            priority: 'M',
            label: 'Past tense not carried through the whole sentence',
            explanation: 'Once a sentence is in the past, every verb in it goes to the past too. The marker is the first thing to slip when you are speaking under pressure.',
            example: '"Yesterday I go and bought it" → "Yesterday I went and bought it"',
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
            id: 'gram.word-order',
            code: null,
            strand: 'grammar',
            l1: null,
            priority: 'M',
            label: 'Words in the wrong order',
            explanation: 'English word order does a lot of the work other languages do with endings, so the order carries meaning.',
            example: '"I like very much this book" → "I like this book very much"',
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
            id: 'prn.th',
            code: 'T-P6',
            strand: 'pronunciation',
            l1: 'telugu',
            priority: 'M',
            label: '"th" said as "t" or "d"',
            explanation: 'Telugu has no /θ/ or /ð/, so the nearest dental stop steps in. The tongue tip goes between the teeth, and you can hold the sound.',
            example: '"tin" → "thin"; "den" → "then"',
            drill: { strand: 'pronunciation', target: 'θ-t' }
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
            drill: (row.drill && typeof row.drill === 'object')
                ? { strand: _norm(row.drill.strand) || null, target: row.drill.target == null ? null : _norm(row.drill.target) }
                : null,
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
        out.drill = cat.drill ? { strand: cat.drill.strand, target: cat.drill.target } : null;
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
         * Registered rows as copies.
         * @param {Object} [opts] - { strand, l1, reportable } filters. `l1` also
         *        matches rows with l1 === null, which are not L1-specific and
         *        apply to every learner.
         */
        categories(opts) {
            const o = opts || {};
            return this.categoryList
                .filter(c => {
                    if (o.strand && c.strand !== o.strand) return false;
                    if (o.l1 && c.l1 !== null && c.l1 !== o.l1) return false;
                    if (typeof o.reportable === 'boolean' && c.reportable !== o.reportable) return false;
                    return true;
                })
                .map(_copyCategory);
        },

        categoryIds() {
            return this.categoryList.map(c => c.id);
        },

        getCategory(id) {
            const cat = this.categoryIndex[_norm(id)];
            return cat ? _copyCategory(cat) : null;
        },

        isKnownCategory(id) {
            return Object.prototype.hasOwnProperty.call(this.categoryIndex, _norm(id));
        },

        /**
         * What "practise this one" should open, for the FR-SRS-3 drill button.
         * Returns null when there is nothing honest to drill, which the UI must
         * read as "do not offer a button", not as an error.
         */
        drillTarget(id) {
            const cat = this.categoryIndex[_norm(id)];
            if (!cat || !cat.drill || !cat.drill.strand) return null;
            const ns = SRS_NAMESPACE[cat.drill.strand];
            return {
                categoryId: cat.id,
                label: cat.label,
                strand: cat.drill.strand,
                target: cat.drill.target,
                // FR-SRS-1 namespaced key, so a caller can reset or query the
                // scheduler for exactly this item. null when the drill is a
                // whole strand rather than one addressable item.
                srsKey: (ns && cat.drill.target) ? (ns + ':' + cat.drill.target) : null
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
})(typeof window !== 'undefined' ? window : this);
