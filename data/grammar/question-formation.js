/**
 * Grammar point 6 — question formation.
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `GRAMMAR_QUESTION_FORMATION`. Same schema, field for field, as the `articles`
 * point in data/grammar.js — read that file's header comment for what each
 * field is for. Nothing is added to the schema here and nothing is left out.
 *
 * CURRICULUM.md §3 Strand B point 6 ("auxiliary inversion, *Do you…?* not
 * *You are knowing…?*"). TWO Telugu transfers from REQUIREMENTS.md §3.2 land on
 * this one point:
 *
 *   T-G5  invariant tag question, from *kadā*   — "You are coming, isn't it?"
 *   T-G8  SOV residue in embedded clauses       — "You know where is the station?"
 *
 * `js/core/mistakes.js` already routes three rows here — `gram.tag-question`
 * (T-G5), `gram.embedded-question-order` (T-G8) and `gram.word-order` — all with
 * `drill: { strand: 'grammar', target: 'question-formation' }`. That is why the
 * id below is exactly `question-formation` and must not be "prettified": those
 * three drill buttons build `gram:question-formation` and would otherwise open
 * nothing (US-187). `gram.word-order` is the lesson default, because a question
 * with the helper in the wrong place is the error this point meets most often;
 * the two L1 rows are reached through per-feedback `logAs`.
 *
 * ⚠️ THREE AUTHORING NOTES
 *
 * 1. THE FRAMING: INVERSION IS NOT A RULE ABOUT QUESTIONS, IT IS A RULE ABOUT
 *    ONE CLAUSE. The usual way to teach this produces the worst possible
 *    learner: "invert to make a question" gets them *Where is the station?*,
 *    then "but not in an embedded question" is filed as an exception, and now
 *    they hesitate on both. So nothing here is taught as an exception. The one
 *    idea, stated the same way in `rule`, `explain`, `decide`, every `retryCue`
 *    and the review prompt, is:
 *
 *        The helper moves in front of the subject of the clause that IS the
 *        question. Exactly one clause in any sentence is the question.
 *
 *    Direct question: there is only one clause, so it is the one that inverts.
 *    Embedded: the outer clause is the question (*Do you know…?*) and it does
 *    invert; the *where*-chunk is not being asked, it is being NAMED — it is the
 *    grammatical object of *know*, sitting where a noun would sit, and you can
 *    prove it by swapping it for one (*Do you know the answer / his name / the
 *    time?*). A thing has never inverted in English, so nothing is suspended.
 *    The learner's error is not "inverting where you shouldn't"; it is inverting
 *    the WRONG CLAUSE — they had the mechanism right and aimed it one clause too
 *    deep, which is a much better thing to be told.
 *
 *    `question-formation-p4` is the load-bearing item for this: *Nobody told me
 *    where the meeting was* contains no question at all, and the *where*-chunk
 *    still keeps statement order. If inversion were about questions, that
 *    sentence would be unexplainable. It is the item to protect in any edit.
 *
 *    Two more facts fall out of the same idea rather than needing their own
 *    rules, and are taught as such: a subject question does not invert
 *    (*Who called you?* — the helper would have to move in front of the subject,
 *    and the question word already IS the subject, so there is nowhere to go),
 *    and a tag inverts (*aren't you?* is *you aren't* turned round) because a
 *    tag is a small question.
 *
 * 2. "ISN'T IT?" IS NOT ALWAYS WRONG, AND THIS FILE NEVER SAYS IT IS. It is the
 *    correct tag for a sentence whose subject is *it* and whose helper is *is*:
 *    *It's cold in here, isn't it?* T-G5 is not the phrase, it is the phrase used
 *    as a UNIVERSAL tag. The feedback therefore says "right tag, wrong sentence"
 *    and shows the sentence it does belong to. `caveats` goes further and says
 *    the plainest true thing available: invariant *isn't it* is a regular feature
 *    of Indian English, so a learner using it is speaking a real variety rather
 *    than making a mistake — it is worth swapping only for listeners outside
 *    India, and *right?* / *no?* / *yeah?* are invariant tags that are standard
 *    everywhere and do the same job with no arithmetic.
 *
 * 3. EVERY OPTION IS A FORM SOMEONE ACTUALLY SAYS, AND TWO ITEMS HAVE TWO RIGHT
 *    ANSWERS. Question forms have more defensible variants than almost anything
 *    else in the syllabus, so the option sets were built adversarially:
 *    `question-formation-p1` offers *do you live* AND *are you living* (both
 *    right, genuinely different — home vs current arrangement) and
 *    `question-formation-p5` offers *aren't you* AND *are you* (both right: a
 *    reversed-polarity tag asks for confirmation, a same-polarity tag reports an
 *    inference you have just drawn). Both are marked
 *    `showDifferenceOnCorrect: true`, and neither pair is a synonym — US-188
 *    notes that `renderGrammarCorrect` asserts "they do not mean the same thing"
 *    whenever that flag is set, so a true synonym must never be accepted here.
 *    Every answer in every `accept` array is also present in that item's
 *    `options` (US-166). All six items are `mode: 'gap'`: app.js implements only
 *    that mode and shows a "cannot show" note for any other, so a `repair` or
 *    `order` item would be unteachable content — word order is tested inside the
 *    gap instead, by putting the whole helper-and-subject region in the gap so
 *    that the ORDER is what the learner chooses.
 *
 * ONE MISSING CATEGORY, reported not invented: `js/core/mistakes.js` has no id
 * for an omitted auxiliary as such — *"Where you live?"*, *"You know him?"* —
 * i.e. no `gram.do-support` or `gram.aux-omission`. `gram.word-order` is the
 * honest destination (the helper is absent from the position it should occupy,
 * and the row's drill already points here), and it is what those options log.
 * Do not invent an id: that file owns the taxonomy and an unknown id lands
 * everything in 'general.uncategorised'.
 * =============================================================================
 */

const GRAMMAR_QUESTION_FORMATION = {
    id: "question-formation",
    syllabusNumber: 6,
    tier: "foundation",
    cefr: "A2",
    title: "Asking questions: which part of the sentence turns round",

    srsType: "gram",
    srsRef: "question-formation",
    srsKey: "gram:question-formation",
    mistakeCategory: "gram.word-order",

    // `be` supplies the helper that moves in the commonest questions of all
    // (*Are you…?*, *Where is…?*), and point 2 supplies the do/does contrast that
    // *Do you know…?* versus *Are you knowing…?* depends on. Advisory only —
    // nothing in the methodology gates grammar, and a learner who needs to ask a
    // question today should be sent here today.
    prerequisites: ["be", "present-simple-vs-continuous"],

    rule: "To ask something, put the helper word in front of the subject of the clause that **is** the question — *Are you…?*, *Where does he…?* — and if the sentence has no helper, borrow **do**; a *where/what/why* chunk sitting inside a longer sentence is not the question, it is a thing you are naming, so it keeps ordinary statement order.",

    explain: "English has one moving part for questions: the helper word — *am/is/are*, *was/were*, *have/has*, *will*, *can*, or a borrowed *do/does/did* — steps in front of the subject. What decides where it steps is not the question mark; it is which clause you are actually asking. In *Where is the station?* there is only one clause, so that is the one. In *Do you know where the station is?* you are asking whether they know, so the helper of THAT clause moves, and the *where* part is left alone — because it is not a question at all, it is the thing you are asking them about, sitting exactly where a noun would sit. Swap it for a noun and you can hear it: *Do you know the answer?* / *Do you know where the station is?* Same slot, same order. Telugu has no such moving part — the words stay put and *ēmiṭi* or *ekkaḍa* does the whole job — so English asks you to move something you have never had to move, and then not to move it again in a place where you have just learned that moving is what questions do. Nothing is being suspended: things have never turned round in English, and a *where*-chunk inside a statement is a thing.",

    decide: [
        "First, what am I actually asking? Say it as a statement and find that one clause. That clause, and nothing else, is the one that turns round.",
        "Does it already have a helper — am/is/are, was/were, have/has, will, can, should? Put it in front of the subject. Any wh-word goes first of all: *Where **are** you…?*",
        "No helper in it? Borrow one: **do**, **does** for one person, **did** for the past. The borrowed word takes the tense and the -s, so the main verb goes back to its plain form — *Does he **work** here?*, not *Does he works*.",
        "Is there a where/what/why/if chunk further inside? Try swapping it for *the answer*. If that still makes a sentence, the chunk is a thing, not a question — leave it in statement order: *Do you know **where the station is**?*",
        "Adding a tag? Take the sentence's own helper, flip yes to no or no to yes, and add the pronoun: *You're coming → **aren't you**?*, *You aren't coming → **are you**?* No helper to take? Borrow *do* again: *He works here → **doesn't he**?*"
    ],

    whyItMatters: "Questions are the part of a conversation you cannot avoid and cannot rehearse, because they depend on what the other person just said. A statement with the words in an unexpected order is usually still understood; a question is where word order carries the whole signal that you have handed the turn back, so a mis-built one tends to produce a pause while the listener works out whether you asked something or told them something. And *isn't it?* on every sentence is one of the two or three features that most reliably marks speech as Indian English abroad — worth knowing about, whatever you decide to do with it.",

    notice: {
        lines: [
            { speaker: "You", text: "Sorry to bother you — **do you know** whether the 4:10 has left?" },
            { speaker: "Stranger", text: "It's late today. **Are you** going to Secunderabad?" },
            { speaker: "You", text: "Kacheguda. **Do you know** which platform **it goes** from?" },
            { speaker: "Stranger", text: "Platform 3, I think. You've got plenty of time, **haven't you**?" },
            { speaker: "You", text: "**Where does** the queue for tickets start?" },
            { speaker: "Stranger", text: "Just there. It moves quickly, **doesn't it**? Nobody believes me." }
        ],
        question: "Two of these have a *which* or *whether* chunk inside them. In those chunks, does the helper come before the subject or after it — and how is that different from *Where does the queue start?*",
        answer: "Inside the chunks the order is ordinary statement order: *which platform **it goes** from*, *whether **the 4:10 has** left*. In *Where does the queue start?* the helper is out in front. The difference is not the wh-word and it is not the question mark — both sentences end in one. It is which clause is being asked. *Do you know…?* is the question in the third line, so *do* moved to the front of *you*; the *which platform* part is simply what you want to know, sitting where a noun sits — you could say *Do you know the platform?* and nothing about the shape changes. In the fifth line there is only one clause, so that clause is the question and *does* moves. Notice the two tags as well: *haven't you?* is built from the *have* in *you've*, and *doesn't it?* had to borrow a *do* because *it moves quickly* had no helper of its own — and each one flipped from yes to no."
    },

    contrast: [
        {
            pair: [
                {
                    text: "What time is it?",
                    means: "You want the time, and you are asking for it directly. Fine with anyone you know, or in a hurry — this clause is the question, so it turns round."
                },
                {
                    text: "Do you know what time it is?",
                    means: "You are asking whether they can tell you — softer, and what you would say to a stranger. Here the question is *Do you know…?*, so that is what turned round; the time part is just the thing you want, in ordinary order."
                }
            ],
            takeaway: "Both are correct, and the helper moved in both — it simply moved in the clause that was being asked. The second sentence has not switched a rule off: *what time it is* was never a question in it, only the name of the thing you want, which is why it sits in statement order like any other object of *know*."
        },
        {
            pair: [
                {
                    text: "You're coming, aren't you?",
                    means: "You think they are coming and you want it confirmed. The statement is positive, so the tag flips to negative — and this is the ordinary, neutral tag."
                },
                {
                    text: "You aren't coming, are you?",
                    means: "You think they are NOT coming and you want that confirmed — often with a note of disappointment. The statement is negative, so the tag flips to positive."
                }
            ],
            takeaway: "Both are correct and they expect opposite answers, which is exactly why one fixed tag cannot cover both. The tag is built, not chosen: take the helper the sentence already has (*are*), flip the polarity, add the pronoun. Note that the tag itself is turned round — *aren't you* is *you aren't* with the helper in front — because a tag is a small question tacked on."
        },
        {
            pair: [
                {
                    text: "Do you talk to him?",
                    means: "Generally, as a habit — are you two in contact? Asking about how things stand now."
                },
                {
                    text: "Did you talk to him?",
                    means: "About one occasion that has already passed — the conversation you were both expecting to happen."
                }
            ],
            takeaway: "Both are correct, and only the borrowed helper changed. That is where the tense now lives, which is why the main verb goes back to its plain form in both: *talk*, never *talked* or *talks*. Once you have said *did*, the past is already marked, and marking it twice (*Did you talked?*) is the commonest slip in this shape."
        }
    ],

    spokenNote: "Helpers in questions are unstressed and heavily reduced, which is why they are hard to hear and easy to leave out. *Do you* is /dʒə/ — *D'you know where it is?* is two syllables before *know*, not three. *Did you* is /ˈdɪdʒə/, *Are you* is /əjə/ or /ə/, *What's he* is /ˈwɒtsi/ (the /h/ disappears), *Where does he* is /ˈweədəzi/. Tags reduce too: *aren't you* is /ˈɑːntʃə/, *doesn't he* is /ˈdʌzəni/. Intonation on a tag carries real meaning and is worth practising separately from the words: FALLING on the tag means you are fairly sure and inviting agreement (*Lovely day, isn't it?* ↘ — not really a question at all), RISING means you genuinely want to know (*You did send it, didn't you?* ↗). Both are correct on the same tag, and the same is true of the wh-questions here. One more thing to listen for: in relaxed speech people often ask with no inversion at all, just a rise — *You're coming?* — which is real English and covered in the caveats.",

    caveats: [
        "*Isn't it?* is not wrong. It is the correct tag for a sentence whose subject is *it* and whose helper is *is*: *It's cold in here, isn't it?*, *That's your bike, isn't it?* What T-G5 describes is *isn't it* used as the tag for EVERY sentence, which is a regular feature of Indian English — tens of millions of people speak it and are understood perfectly by each other. So this is a choice about audience, not about correctness: with listeners outside India, an invariant *isn't it* is heard as an error rather than as a variety, and the built tag (*aren't you?*, *doesn't he?*, *have you?*) is what they expect. If the arithmetic is slow in real time, English has invariant tags that are standard everywhere — *right?*, *no?*, *yeah?* — and *You're coming, right?* costs you nothing.",
        "A subject question does not turn round and takes no borrowed *do*: *Who called you?*, *What happened?*, *Which train goes to Kacheguda?* This is not an exception to the rule — the helper moves in front of the subject, and here the question word already IS the subject, so there is nowhere in front of it to move to. Compare *Who did you call?*, where *who* is the object and *did* has a subject (*you*) to step in front of.",
        "An embedded yes/no question uses *if* or *whether* as its wh-word and then behaves exactly like the others: *Do you know if he's coming?*, *I'll ask whether they've sent it.* Never *Do you know is he coming?* — the same clause, the same statement order.",
        "In relaxed speech a statement said with a rising tone is a real question: *You're coming?*, *He said that?*, *You've already sent it?* This is ordinary English, not a shortcut, but it is not a free pass — it carries checking or mild surprise, so it does not replace the built question, and it is not available with a wh-word at the front (*Where you live?* is not the casual version of anything).",
        "Punctuation follows the same logic and is a useful test. *Could you tell me where the station is?* takes a question mark, because the outer clause is a question. *I wonder where the station is.* takes a full stop, because nothing in it is. The *where*-chunk is identical in both, which is the point: it never depended on the question mark.",
        "A few question shapes are worth learning whole rather than assembling: *How about Tuesday?*, *What's it like?*, *Would you mind if…?*, *Shall we?*, and the imperative tags *Sit down, won't you?* and *Let's go, shall we?* The rule does explain most of them, but you will say them faster if you never have to build them."
    ],

    commonErrors: [
        {
            heard: "You are coming tomorrow, isn't it?",
            fix: "You're coming tomorrow, aren't you?",
            why: "Telugu adds one tag, *kadā*, to anything, so there is nothing in your first language telling you the tag has parts. In English the tag is assembled from the sentence: take its helper (*are*), flip yes to no, add the pronoun (*you*) — *aren't you?* *Isn't it* is not a wrong phrase, it is the tag for a sentence about *it* with *is* in it, as in *It's late, isn't it?*",
            l1: "T-G5"
        },
        {
            heard: "He works in the Pune office, isn't it?",
            fix: "He works in the Pune office, doesn't he?",
            why: "Same tag, and this time the sentence has no helper at all to reuse — so borrow one, exactly as you would to ask the question: *Does he work in Pune?* → *…, doesn't he?* The pronoun in the tag has to match the subject too, and the subject here is *he*, not *it*.",
            l1: "T-G5"
        },
        {
            heard: "You know where is the station?",
            fix: "Do you know where the station is?",
            why: "Two things happened, and one of them was nearly right. The turning-round went to the wrong clause: you asked *Do you know…?*, so *do* was the word to move, and the *where* part is only the thing you want to know — it sits in statement order like any object of *know* (*Do you know the answer?*). Then the outer clause had no helper of its own, so it needed a borrowed *do* at the front.",
            l1: "T-G8"
        },
        {
            heard: "I asked him where does he live.",
            fix: "I asked him where he lives.",
            why: "There is no question anywhere in this sentence — you are telling someone what you asked — and yet the *where* chunk is where learners invert most confidently. That is the clue that inversion was never about question marks: the chunk is the thing you asked ABOUT, so it stays in statement order whether the sentence around it asks anything or not.",
            l1: "T-G8"
        },
        {
            heard: "Where you are from? What you are doing?",
            fix: "Where are you from? What are you doing?",
            why: "The helper is there, which is most of the work — it is just standing behind the subject, where Telugu word order leaves it. In a direct question it goes in front: *Where **are** you from?* These two are asked of you constantly, so drill them as fixed chunks and the order stops being a decision.",
            l1: "T-G8"
        },
        {
            heard: "You are knowing my colleague Ravi?",
            fix: "Do you know my colleague Ravi?",
            why: "*Know* is about a state, not something you are in the middle of doing, so it does not take *-ing* in English — and once *know* goes back to its plain form the sentence has no helper left to move, which is precisely when English lends you *do*. Hence *Do you know…?* Two habits fixed by one substitution, and it is the most useful question opener in the language.",
            l1: "T-G3"
        }
    ],

    practice: [
        {
            id: "question-formation-p1",
            mode: "gap",
            focus: "inversion-and-borrowed-do-in-a-direct-wh-question",
            // The gap holds the whole helper-and-subject region, so the learner
            // is choosing an ORDER rather than a word — which is how word order
            // gets tested inside the only mode app.js implements. Two of the four
            // options are right and genuinely different: this is the
            // "Where does he live? / Where's he living?" trap the adversarial
            // pass exists to catch, turned into the teaching point.
            prompt: "A new colleague is working out your commute. \"So whereabouts ___, exactly?\" — \"Kukatpally. About forty minutes on the metro.\"",
            options: ["do you live", "are you living", "you live", "you do live"],
            accept: [
                { answer: "do you live", means: "Where your home is — the neutral question, and the one you would ask about a settled arrangement." },
                { answer: "are you living", means: "Where you are staying at the moment. This one quietly suggests the arrangement is temporary — a posting, a sublet, a few months at a cousin's place — and invites that story." }
            ],
            showDifferenceOnCorrect: true,
            spoken: "*Whereabouts do you live?* → the helper almost disappears: /ˈweərəbaʊts dʒə ˈlɪv/. *Do you* is one squashed syllable, /dʒə/. If you say *do* clearly and separately, the question is correct and sounds like a form being filled in.",
            feedback: [
                {
                    forAnswer: "you live",
                    reason: "This is the sentence with no helper in it at all, and the wh-word left to do the whole job on its own — which is exactly what *ekkaḍa* does in Telugu, so nothing in your ear objects. English wants a helper in front of the subject in a direct question, and *live* has none of its own, so English lends you one: *do*. That is all *do* is here — a word with no meaning, borrowed so that something can move.",
                    contrast: [
                        "Whereabouts do you live, exactly?",
                        "I was wondering whereabouts you live."
                    ],
                    retryCue: "This clause IS the question, so something has to come in front of *you*. The verb *live* has no helper — so which word does English lend you?",
                    grammaticalButDifferent: false,
                    logAs: "gram.auxiliary-omitted",
                    errorKind: "auxiliary-omitted-in-direct-question"
                },
                {
                    forAnswer: "you do live",
                    reason: "The helper is here and it is the right one — you have done the harder half. It is standing behind the subject, which is where Telugu word order would leave it, and in a direct question English needs it in front: *do you live*. (There is one situation where *you do live* is right, and it is worth knowing: *I do live here!* said in protest, when someone has doubted you. That is emphasis, not a question.)",
                    contrast: [
                        "Whereabouts do you live, exactly?",
                        "I do live here — I've been in this flat for years."
                    ],
                    retryCue: "You have the helper. Which side of *you* does it go on when this clause is the question?",
                    grammaticalButDifferent: true,
                    logAs: "gram.word-order",
                    errorKind: "auxiliary-after-subject-sov-residue"
                }
            ],
            fallbackFeedback: {
                reason: "This gap wants a helper in front of *you*, because this clause is the question. *Do you live* and *are you living* are both right and mean slightly different things. Other real answers exist and they all keep that shape — *have you been living*, *did you use to live* — because the shape is what the item is about, not the tense.",
                contrast: [
                    "Whereabouts do you live, exactly?",
                    "Whereabouts are you living, exactly?"
                ],
                retryCue: "Put a helper in front of *you*. If the verb has no helper of its own, borrow *do*."
            },
            alsoNotice: "The answer *Kukatpally* is a bare noun with no sentence around it, and that is completely normal in speech. A question built correctly earns you short answers; you do not have to say *I live in Kukatpally* to be answering properly."
        },
        {
            id: "question-formation-p2",
            mode: "gap",
            focus: "borrowed-do-keeps-the-tense-and-the-verb-stays-plain",
            // The curriculum names *Do you know…?* vs *You are knowing…?*
            // explicitly. All three distractors are forms learners produce, and
            // they separate cleanly: -s doubled onto the main verb, stative -ing
            // with the inversion right, stative -ing with the inversion missing.
            prompt: "\"My cousin's just moved to Bangalore for work.\" — \"Oh nice. ___ anyone there?\" — \"One friend from college, that's it.\"",
            options: ["does he know", "does he knows", "is he knowing", "he is knowing"],
            accept: [
                { answer: "does he know", means: "Asks whether he has anyone he knows in the city — a state, so the plain verb, and the borrowed *does* carries both the present tense and the -s." }
            ],
            // The gap opens a sentence, so the option values stay lowercase (they
            // are what is graded) and `rendersAs` supplies the capital for
            // display. Same device as be.js: capitalisation never becomes part of
            // the correctness check.
            rendersAs: {
                "does he know": "Does he know",
                "does he knows": "Does he knows",
                "is he knowing": "Is he knowing",
                "he is knowing": "He is knowing"
            },
            spoken: "*Does he know anyone there?* → /ˈdʌzi ˈnəʊ ˈeniwʌn ðeə/. The /h/ of *he* drops out after *does*, so the first two words fuse into /ˈdʌzi/. Stress lands on *know* and *anyone*, never on *does*.",
            feedback: [
                {
                    forAnswer: "does he knows",
                    reason: "The order is right and the helper is right — this is the last small thing. The borrowed *does* has already taken the tense and the -s for the whole clause, so the main verb goes back to its plain form: *does he know*. Marking it twice is the commonest slip in this shape, and the same logic explains *Did you go?* rather than *Did you went?*",
                    contrast: [
                        "Does he know anyone there?",
                        "He knows one person there, from college."
                    ],
                    retryCue: "Which word is already carrying the -s? Then what shape does the main verb go back to?",
                    grammaticalButDifferent: false,
                    logAs: "gram.verb-form",
                    errorKind: "inflected-verb-after-do-support"
                },
                {
                    forAnswer: "is he knowing",
                    reason: "The turning-round is right — the helper is in front of *he*, which is the part this point is about. The problem is *knowing*: *know* describes a state you are in, not something you are in the middle of doing, so English keeps it in the plain form even when you mean right now. And once *know* is plain, the sentence has no helper left, which is exactly when *do* gets borrowed — *does he know*.",
                    contrast: [
                        "Does he know anyone there?",
                        "Is he staying with anyone there?"
                    ],
                    retryCue: "Is *know* something you do, or something you are? Then which helper does a plain verb need borrowed for it?",
                    grammaticalButDifferent: false,
                    logAs: "gram.stative-progressive",
                    errorKind: "stative-verb-in-progressive"
                },
                {
                    forAnswer: "he is knowing",
                    reason: "Two things at once here, and they are worth separating. *Knowing* is the state problem again — *know* does not take *-ing*. But the bigger one for this lesson is that the helper *is* has stayed behind *he*: this clause is the question, so whatever helper it has must come in front of the subject. Fix the order and the *-ing*, and what is left is *does he know*.",
                    contrast: [
                        "Does he know anyone there?",
                        "He knows one person there — is he in touch with her?"
                    ],
                    retryCue: "This clause is the question, so which side of *he* does the helper belong on? And does *know* take *-ing*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.word-order",
                    errorKind: "no-inversion-plus-stative-progressive"
                }
            ],
            fallbackFeedback: {
                reason: "This gap wants a helper in front of *he* and a plain main verb after it, so the answer is *does he know*. Other true questions fit the situation — *has he got anyone there?*, *does he have any friends there?* — and every one of them puts a helper in front of *he*, which is the shape being tested.",
                contrast: [
                    "Does he know anyone there?",
                    "Has he got friends there?"
                ],
                retryCue: "Borrow a helper for the plain verb *know*, and put it in front of *he*. Which form goes with one person in the present?"
            },
            alsoNotice: "*Do you know…?* and *Does he know…?* are the highest-frequency question openers you will ever build, and *You are knowing…?* is the version most learners arrive with. Saying the correct one twenty times out loud is worth more than remembering why it is correct."
        },
        {
            id: "question-formation-p3",
            mode: "gap",
            focus: "the-chunk-inside-a-question-keeps-statement-order",
            prompt: "You stop someone outside the station. \"Sorry to bother you — do you know ___?\" — \"Ten past four.\"",
            options: ["what time it is", "what time is it", "what is the time", "what time it's"],
            accept: [
                { answer: "what time it is", means: "The thing you want to know, named — it sits after *know* exactly where a noun would, so it keeps statement order. The question in this sentence is *do you know…?*, and that part has already turned round." }
            ],
            spoken: "*Do you know what time it is?* → /dʒə ˈnəʊ wɒt ˈtaɪm ɪt ˈɪz/. Two things to notice: *do you* squashes to /dʒə/, and the final *is* is the last word in the clause, so it is said in full and carries a little stress. That is why it cannot be contracted — there is nothing after it to lean on.",
            feedback: [
                {
                    forAnswer: "what time is it",
                    reason: "Every word here is right, and *What time is it?* is a perfectly good question — on its own. The turning-round has just gone one clause too deep. You are asking *do you know…?*, so *do* is the word that moves; the *what time* part is not being asked, it is the thing you want, and things sit in statement order after *know*. Test it by swapping in a noun: *Do you know the time?* — nothing turns round there either.",
                    contrast: [
                        "Do you know what time it is?",
                        "What time is it?"
                    ],
                    retryCue: "Which clause here is the question — *do you know…?*, or the *what time* part? Only the question turns round.",
                    grammaticalButDifferent: true,
                    logAs: "gram.embedded-question-order",
                    errorKind: "inversion-in-embedded-clause"
                },
                {
                    forAnswer: "what is the time",
                    reason: "Same thing, and this version is very common in Indian English: *What is the time?* is a fine question standing alone, but inside *do you know…* it is a thing being named, so it takes statement order — *what the time is*, or more usually *what time it is*. Once the outer clause has turned round, nothing further in the sentence does.",
                    contrast: [
                        "Do you know what time it is?",
                        "Excuse me — what is the time?"
                    ],
                    retryCue: "You have already turned the outer clause round with *do*. Does anything else in the sentence get to turn round?",
                    grammaticalButDifferent: true,
                    logAs: "gram.embedded-question-order",
                    errorKind: "inversion-in-embedded-clause"
                },
                {
                    forAnswer: "what time it's",
                    reason: "The order is exactly right — this is the statement order the chunk needs, so the main idea has landed. The only trouble is the contraction: *is* is the last word in the clause, and English will not let a contracted *'s* sit at the end of anything, because there is no following word for it to lean on. Say it in full: *what time it **is***. The same is true of *I don't know where he's* → *where he **is***.",
                    contrast: [
                        "Do you know what time it is?",
                        "Do you know what time it's going to start?"
                    ],
                    retryCue: "Is anything coming after *is* in this clause? If not, can it still be squeezed onto the word before?",
                    grammaticalButDifferent: false,
                    logAs: "gram.embedded-question-order",
                    errorKind: "clause-final-contraction"
                }
            ],
            fallbackFeedback: {
                reason: "This chunk is the thing you want to know, sitting after *know* where a noun would sit, so it keeps statement order: *what time it is*. *What the time is* is also correct, and so is simply *the time* — *Do you know the time?* — which is what most people would actually say. What English does not allow is turning this part round as well, once *do you know* has already turned round.",
                contrast: [
                    "Do you know what time it is?",
                    "Do you know the time?"
                ],
                retryCue: "Write the chunk as a plain statement first — *it is ten past four* — then put the wh-word on the front and change nothing else."
            },
            alsoNotice: "Swapping the chunk for a noun is a test you can run in real time: *Do you know the answer / his name / the platform / where the station is.* If the noun version works, the chunk goes in the same slot, in the same order."
        },
        {
            id: "question-formation-p4",
            mode: "gap",
            focus: "no-question-in-the-sentence-and-still-no-inversion",
            // THE load-bearing item for the framing. There is no question here at
            // all, and the chunk still keeps statement order — which is only
            // explainable if inversion belongs to the clause that is the
            // question, rather than to sentences that end in a question mark.
            // Protect this item in any edit.
            prompt: "Complaining afterwards: \"Nobody told me ___, so I spent ten minutes on the wrong floor.\"",
            options: ["where the meeting was", "where was the meeting", "where is the meeting", "where the meeting"],
            accept: [
                { answer: "where the meeting was", means: "Statement order, because this chunk is simply the thing nobody told you — the object of *told me*, sitting where a noun like *the room number* would sit. And *was*, because the meeting has already happened." }
            ],
            spoken: "*Nobody told me where the meeting was* → the chunk is said as one smooth run with no break before *where*, and *was* is the last word, so it gets a small stress: /ˈnəʊbədi təʊld mi weə ðə ˈmiːtɪŋ ˈwɒz/.",
            feedback: [
                {
                    forAnswer: "where was the meeting",
                    reason: "Look at the whole sentence for a moment: it does not ask anything. It is a complaint, ending in a full stop. So there is no clause here that is the question, and nothing to turn round — the chunk is just the thing nobody told you, sitting where a noun would sit (*Nobody told me the room number*). This is the most useful place to notice it, because there is no question mark to blame.",
                    contrast: [
                        "Nobody told me where the meeting was.",
                        "Where was the meeting?"
                    ],
                    retryCue: "Is anything in this sentence being asked? If nothing is, what would make the helper move?",
                    grammaticalButDifferent: true,
                    logAs: "gram.embedded-question-order",
                    errorKind: "inversion-in-embedded-clause-no-question"
                },
                {
                    forAnswer: "where is the meeting",
                    reason: "Two things here. The chunk has turned round, and nothing in this sentence is a question — it is a complaint about the past, so the chunk stays in statement order. And the time is off as well: *is* would mean the meeting is still to come, but you have already spent ten minutes looking for it. Statement order plus the past: *where the meeting was*.",
                    contrast: [
                        "Nobody told me where the meeting was.",
                        "Nobody's told me where the meeting is — it's at four, isn't it?"
                    ],
                    retryCue: "Nothing is being asked here, so the helper stays put — and has the meeting already happened, or not yet?",
                    grammaticalButDifferent: true,
                    logAs: "gram.embedded-question-order",
                    errorKind: "inversion-in-embedded-clause-plus-wrong-tense"
                },
                {
                    forAnswer: "where the meeting",
                    reason: "The order is right as far as it goes — nothing has been turned round, which is the main thing this item is about. There is just no verb in the chunk. *Where the meeting* is the Telugu shape, where a place and a thing can sit side by side and the sentence is finished; English needs a be word to hold them together, even at the end of a chunk like this: *where the meeting **was***.",
                    contrast: [
                        "Nobody told me where the meeting was.",
                        "Nobody told me the room number."
                    ],
                    retryCue: "Say the chunk on its own as a statement: *the meeting ___ upstairs*. What word is missing in the middle?",
                    grammaticalButDifferent: false,
                    logAs: "gram.copula",
                    errorKind: "zero-copula-in-embedded-clause"
                }
            ],
            fallbackFeedback: {
                reason: "There is no question in this sentence, so nothing in it turns round: the chunk is the thing nobody told you, in ordinary statement order — *where the meeting was*. *Which room the meeting was in* and *what floor it was on* are just as correct, and they all have the same shape. What does not work is putting the helper in front of *the meeting*.",
                contrast: [
                    "Nobody told me where the meeting was.",
                    "Nobody told me which room it was in."
                ],
                retryCue: "Write the chunk as a plain statement — *the meeting was upstairs* — then put *where* on the front and leave everything else exactly as it is."
            },
            alsoNotice: "Compare *I wonder where the station is.* (full stop) with *Could you tell me where the station is?* (question mark). The chunk is identical in both, and only the outer clause decides the punctuation — more evidence that the chunk never depended on the question mark at all."
        },
        {
            id: "question-formation-p5",
            mode: "gap",
            focus: "building-a-tag-from-the-sentences-own-helper",
            // Two right answers, and the second one is the reason this item was
            // built that way: *are you?* is a real same-polarity tag, so marking
            // it wrong would fail FR-GRM-5 on the exact form the adversarial pass
            // was told to look for. The two are not synonyms — one asks for
            // confirmation, the other reports an inference — so
            // showDifferenceOnCorrect is honest here (US-188).
            prompt: "\"You're coming to the offsite on Friday, ___?\" — \"Wouldn't miss it.\"",
            options: ["aren't you", "are you", "isn't it", "don't you"],
            accept: [
                { answer: "aren't you", means: "The ordinary tag: you believe they are coming and you want it confirmed. Positive sentence, so the tag flips to negative." },
                { answer: "are you", means: "A tag that keeps the same polarity, which does a different job — it reports an inference you have just drawn, roughly \"oh, so you're coming, are you?\" Depending on your tone it sounds interested or faintly challenging, and it is not the neutral way to ask." }
            ],
            showDifferenceOnCorrect: true,
            spoken: "*You're coming, aren't you?* → /jɔː ˈkʌmɪŋ ˈɑːntʃə/. *Aren't you* fuses into two syllables, /ˈɑːntʃə/, with the /t/ and /j/ blending into a *ch* sound. Intonation decides how much you mean it: falling on the tag ↘ means you are fairly sure, rising ↗ means you really do want an answer. Both are correct on this tag.",
            feedback: [
                {
                    forAnswer: "isn't it",
                    reason: "Right tag, wrong sentence. *Isn't it?* belongs to a sentence whose subject is *it* and whose helper is *is* — *It's a long drive, isn't it?* — and this sentence is about *you*, with *are* inside *you're*. A tag is not chosen, it is built from the sentence in front of it: take its helper (*are*), flip yes to no, add its pronoun (*you*). If building it on the fly is slow, English has tags that never change and are standard everywhere: *You're coming on Friday, right?*",
                    contrast: [
                        "You're coming to the offsite, aren't you?",
                        "It's on Friday, isn't it?"
                    ],
                    retryCue: "What is this sentence's helper, and who is it about? Build the tag out of those two.",
                    grammaticalButDifferent: true,
                    logAs: "gram.tag-question",
                    errorKind: "invariant-tag-isnt-it"
                },
                {
                    forAnswer: "don't you",
                    reason: "You have built a tag rather than reaching for a fixed one, which is the harder half — it is just built from a borrowed *do*, and this sentence did not need to borrow anything. *You're coming* already contains *are*, so that is the helper the tag reuses. Borrowing *do* is only for sentences with no helper of their own: *You come here often, don't you?*",
                    contrast: [
                        "You're coming to the offsite, aren't you?",
                        "You come to these things fairly often, don't you?"
                    ],
                    retryCue: "Does this sentence already have a helper in it? Then there is nothing to borrow — reuse the one that is there.",
                    grammaticalButDifferent: true,
                    logAs: "gram.tag-question",
                    errorKind: "borrowed-do-in-tag-when-helper-present"
                }
            ],
            fallbackFeedback: {
                reason: "A tag is built from the sentence: its helper, the polarity flipped, and its pronoun. Here that gives *aren't you?* — the same-polarity *are you?* is also real English, with a different flavour. Invariant tags that need no building are available too and are standard everywhere: *right?*, *yeah?*, *no?*",
                contrast: [
                    "You're coming to the offsite, aren't you?",
                    "You're coming to the offsite, right?"
                ],
                retryCue: "Find the helper inside *you're*, flip yes to no, and add the pronoun."
            },
            alsoNotice: "Notice that the tag itself is turned round: *aren't you* is *you aren't* with the helper moved in front of the subject. That is not a coincidence — a tag is a small question stuck on the end, so it does what every question does."
        },
        {
            id: "question-formation-p6",
            mode: "gap",
            focus: "the-tag-flips-a-negative-sentence-to-positive",
            prompt: "\"You haven't sent the invoice yet, ___?\" — \"Sorry — doing it right now.\"",
            options: ["have you", "haven't you", "did you", "isn't it"],
            accept: [
                { answer: "have you", means: "The sentence is negative, so the tag goes positive, and it reuses the sentence's own helper — the *have* inside *haven't*. Say it gently with a falling tone and it is a reminder rather than an accusation." }
            ],
            spoken: "*You haven't sent it yet, have you?* → /jʊ ˈhævnt ˈsent ɪt jet həv jə/. The tag is unstressed and the /h/ often survives only as a breath: /əvjə/. A falling tone here softens it into a nudge; a sharp rise makes it sound like you are checking up on someone.",
            feedback: [
                {
                    forAnswer: "haven't you",
                    reason: "You have taken the sentence's own helper, which is exactly right — the flip is the bit that got skipped. English tags reverse the polarity: a positive sentence takes a negative tag (*You've sent it, haven't you?*) and a negative sentence takes a positive one (*You haven't sent it, have you?*). Two negatives in a row cancel into something no one says.",
                    contrast: [
                        "You haven't sent the invoice yet, have you?",
                        "You've already sent the invoice, haven't you?"
                    ],
                    retryCue: "Is the sentence positive or negative? Then the tag goes the other way.",
                    grammaticalButDifferent: false,
                    logAs: "gram.tag-question",
                    errorKind: "tag-polarity-not-flipped"
                },
                {
                    forAnswer: "did you",
                    reason: "The polarity is flipped correctly — positive tag on a negative sentence — but the helper has been swapped for a borrowed one. A tag reuses the helper the sentence already has, and this sentence has *have* in it (inside *haven't*), so the tag is *have you?* You would need *did you?* for a sentence built with *did*: *You didn't send the invoice, did you?*",
                    contrast: [
                        "You haven't sent the invoice yet, have you?",
                        "You didn't send the invoice, did you?"
                    ],
                    retryCue: "Which helper is hiding inside *haven't*? That is the one the tag has to reuse.",
                    grammaticalButDifferent: false,
                    logAs: "gram.tag-question",
                    errorKind: "tag-helper-does-not-match-sentence"
                },
                {
                    forAnswer: "isn't it",
                    reason: "*Isn't it?* is a real tag — for a sentence about *it* with *is* in it, like *It's due today, isn't it?* This sentence is about *you* and its helper is *have*, so the tag built from it is *have you?* The tag is assembled from what is in front of it, which is why one fixed tag cannot cover every sentence: this one is negative, so the tag also has to come out positive.",
                    contrast: [
                        "You haven't sent the invoice yet, have you?",
                        "It isn't due until Friday, is it?"
                    ],
                    retryCue: "Take the helper out of *haven't*, flip the negative to positive, and add the pronoun. What do you get?",
                    grammaticalButDifferent: true,
                    logAs: "gram.tag-question",
                    errorKind: "invariant-tag-isnt-it"
                }
            ],
            fallbackFeedback: {
                reason: "The sentence is negative and its helper is *have*, so the tag is positive and reuses it: *have you?* The invariant *right?* also works here (*You haven't sent it yet, right?*). What does not work is a second negative, or a helper the sentence never had.",
                contrast: [
                    "You haven't sent the invoice yet, have you?",
                    "You haven't sent the invoice yet, right?"
                ],
                retryCue: "Two steps: pull the helper out of *haven't*, then flip the negative to positive."
            },
            alsoNotice: "A positive tag on a negative sentence expects the answer *no* — *No, sorry, not yet* — and English speakers answer the statement, not the tag. If you are ever unsure which one to answer, repeat the helper back: *No, I haven't.*"
        }
    ],

    produce: {
        id: "question-formation-produce",
        task: "Out loud, interview someone about a new job — six questions, no writing them down first. Make two of them direct questions with a wh-word (*Where…?*, *How long…?*), two of them the softer embedded kind starting *Do you know…* or *Can you tell me…*, and two of them statements with a tag on the end. Then ask one question about who did something, and notice that it needs no helper at all: *Who interviewed you?*",
        targetSeconds: 60,
        useLanguage: [
            "Where do you… / How long does… — a direct question with a borrowed helper, twice",
            "Do you know where / what / whether… — the chunk in statement order, twice",
            "…, aren't you? / …, doesn't he? / …, have you? — a tag built from your own sentence, twice",
            "Who…? — a subject question, once, with no helper"
        ],
        selfCheck: [
            "In each direct question, did the helper come BEFORE the person — *Where do you work?*, not *Where you work?*",
            "After *Do you know…*, did the inside part stay in statement order — *where the office is*, not *where is the office*?",
            "Did each tag use the helper from my own sentence, and flip yes to no or no to yes — rather than *isn't it* every time?",
            "After a borrowed *do*, *does* or *did*, did the main verb come out in its plain form — *work*, not *works* or *worked*?",
            "Did I get through all six without stopping to rebuild one mid-sentence?"
        ],
        model: {
            text: "So how long have you been there? And whereabouts is the office — do you know whether it's near the metro? You're still working from home two days a week, aren't you? Right, so the team's quite small. Do you know who you'll be reporting to? He interviewed you, didn't he? And you don't have to travel much, do you?",
            note: "Read this once for the shape, then look away from the screen and interview a real person, or an imaginary one out loud. Reading it aloud is not the exercise — questions are the one thing in a conversation you cannot prepare, because they depend on what the other person just said, so the whole point is to build them while talking."
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            // The schema carries one transferId per l1 and this point is the
            // drill target for two. T-G5 is the higher-priority row in
            // REQUIREMENTS.md §3.2 (M, against S for T-G8), so it is the id
            // here; T-G8 is named explicitly in the note rather than being left
            // to a field that does not exist.
            transferId: "T-G5",
            priority: "M",
            note: "Two Telugu habits meet in this one point, and both come from the same source: Telugu does not move words to ask things. A question is marked by a question word or a particle, and everything else stays exactly where it was — *nuvvu ekkaḍa uṇṭunnāvu?* keeps the verb at the end, so *Where you are staying?* is not a mistake in reasoning, it is Telugu word order wearing English words. That is T-G8. The same lack of movement is why the helper often does not appear at all: if nothing has to move, nothing has to be borrowed, so *do* has no job in your first language and does not come to mind. Then the tag. Telugu adds *kadā* to any sentence at all — *nuvvu vastunnāvu kadā?* — one invariant word doing what English does with a dozen different two-word tags. So *isn't it?* is not a wrong guess; it is *kadā* translated, and it is also completely standard in Indian English, which is why it survives fluency. That is T-G5. The awkward part is the third habit, which is a habit you acquire from English lessons rather than from Telugu: once you have learned to move the helper for questions, you move it inside embedded clauses too, where it must not go — *You know where is the station?* is a mistake you can only make AFTER learning the rule, which is why it is worth understanding rather than memorising.",
            bridge: "One idea covers all of it: the helper moves in front of the subject of the clause that IS the question, and no other clause in the sentence moves anything. Run it in three steps out loud. First, say the answer as a plain statement — *the station is over there*. Second, decide what you are actually asking: if it is the station's location, that clause is the question and the helper moves (*Where is the station?*); if you are asking whether the person knows, then *Do you know…?* is the question, so *do* moves and the *where* part stays a statement (*Do you know where the station is?*). A quick test for the second case: swap the chunk for *the answer*. If *Do you know the answer?* still works, the chunk is a thing, and things never turn round. Third, for tags, do not choose one — build it: take the helper the sentence already has (*are*, *have*, *can*), flip yes to no or no to yes, add the pronoun. And while you are building that skill, use *right?* — *You're coming on Friday, right?* — which is standard everywhere, needs no arithmetic, and buys you time to practise the built tags where they matter most."
        }
    },

    review: {
        rulePrompt: "One line before you start: the helper word moves in front of the subject of the clause that IS the question — borrow *do* if that clause has no helper — and a where/what/whether chunk sitting inside a longer sentence is a thing you are naming, not a question, so it keeps statement order.",
        itemIds: ["question-formation-p4", "question-formation-p6", "question-formation-p1"]
    },

    tags: ["questions", "inversion", "do-support", "question-tags", "embedded-questions", "word-order", "T-G5", "T-G8", "high-frequency"]
};

// Match the js/core/* pattern: a lexical global for the browser, CommonJS for
// the Jest suite. `module` is undefined in a classic script, so this is inert
// there.
if (typeof module !== "undefined" && module.exports) {
    module.exports = { GRAMMAR_QUESTION_FORMATION: GRAMMAR_QUESTION_FORMATION };
}

// Self-registration, exactly as data/grammar/be.js and countability.js do it.
// `grammarLessons` in data/grammar.js is a top-level `const`, i.e. a lexical
// global, so a classic script loaded AFTER it can read the binding by bare name
// and push into the tier array.
//
// The guards cover the two things that can actually go wrong: a script-order
// mistake (grammar.js absent) leaves the point unregistered instead of throwing
// during page load, and an id already present is not pushed twice — so if this
// point is ever folded into data/grammar.js inline, this file becomes a no-op
// rather than producing a duplicate. Both verified.
//
// A duplicate <script> include of THIS file is a different matter: it throws
// "GRAMMAR_QUESTION_FORMATION has already been declared" at parse time, as a
// second include of any file in this codebase would. That is the classic-script
// contract, not something these guards can rescue.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.foundation) &&
    !grammarLessons.foundation.some(function (p) { return p && p.id === GRAMMAR_QUESTION_FORMATION.id; })) {
    grammarLessons.foundation.push(GRAMMAR_QUESTION_FORMATION);
}
