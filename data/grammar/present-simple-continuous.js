/**
 * Grammar point 2 — present simple vs present continuous (the state/action sense).
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `GRAMMAR_PRESENT_SIMPLE_CONTINUOUS`. Same schema, field for field, as the
 * `articles` point in data/grammar.js — read that file's header comment for what
 * each field is for. Nothing is added to the schema here and nothing is left out.
 *
 * CURRICULUM.md §3 Strand B point 2; T-G3 in REQUIREMENTS.md §3.2
 * ("-ing on a verb that does not take it" — *"I am having a doubt"*, *"I am
 * knowing"*, *"I am having two brothers"*). js/core/mistakes.js carries the
 * matching row, `gram.stative-progressive`, whose drill target is
 * `present-simple-vs-continuous` — i.e. this point, which is why the `id` below
 * is `present-simple-vs-continuous` and not the file's own name. That row is the
 * default `mistakeCategory` here.
 *
 * ⚠️ THE AUTHORING PROBLEM THIS FILE EXISTS TO SOLVE
 *
 * The stative/dynamic boundary is genuinely fuzzy, and the usual teaching of it
 * is a lie: "never use -ing with know, have, see, think, love". A learner taught
 * that hears *I'm loving it*, *I'm having lunch*, *I'm seeing the doctor
 * tomorrow*, *what are you thinking?* — all ordinary English — and concludes the
 * app was wrong, which costs more than never teaching the point.
 *
 * So nothing in this file states a rule about VERBS. Every statement in it is
 * about SENSES, and the organising idea is stated once and then never
 * contradicted:
 *
 *     The -ing form is not banned from these verbs. It SWITCHES them into
 *     their activity sense. *have* has one (*have lunch*, *have a shower*),
 *     so *I'm having lunch* is fine. *know* has none, so there is nothing
 *     for *I am knowing* to switch into.
 *
 * That framing makes every genuine exception a confirmation rather than a
 * counter-example, which is the only way to teach this honestly. Three
 * consequences for anyone editing this file:
 *
 *   1. The three `contrast` pairs are all state-sense vs activity-sense of the
 *      SAME verb (*have*, *see*, *think*), both members correct. The point is
 *      not "simple good, -ing bad" — it is what the -ing DOES.
 *   2. Two of the six practice items have the CONTINUOUS as a right answer
 *      (`...-p3`, `...-p5`), and `...-p5` accepts both forms, because
 *      *I think it will slow us down* and *I'm thinking it will slow us down*
 *      are both real and mean subtly different things. An item set where -ing
 *      is always the wrong answer would teach the false rule by implication
 *      even if no sentence in the file stated it.
 *   3. Any item whose distractor is defensible somewhere was rewritten, not
 *      shipped. *I'm seeing the problem on my end* is completely ordinary in
 *      support and engineering English, so no item asks the learner to reject
 *      *am seeing* in front of a problem; `...-p4` uses the fixed formula
 *      *Ah, I see*, where the -ing form genuinely does not exist. Same reason
 *      there is no graded item on *understand*: informal American English does
 *      say *I'm not understanding you*.
 *
 * Every item is `mode: 'gap'`. app.js implements only that mode; an item in any
 * other mode is skipped with a visible note and dropped from the completion
 * count, so a `repair` item would be unteachable content. Where the target is a
 * continuous form, the auxiliary sits OUTSIDE the gap (*she's ___*, *I'm
 * still ___*) so that the gap holds a participle and no learner can be marked
 * wrong for typing a contraction the item never asked about.
 *
 * ⚠️ MISTAKE-CATEGORY ROUTING. Five ids are used and all five resolve against
 * js/core/mistakes.js. The two rules behind the choices, since a bare-participle
 * option appears in five of the six items and does NOT always route the same way:
 *
 *   · A bare -ing where adding *am/is/are* would NOT fix the sentence (*she
 *     knowing*, *I having two brothers*) is a stative error wearing a missing
 *     auxiliary as a disguise — the repair is the plain form, so it logs as
 *     `gram.stative-progressive`, whose drill is this point.
 *   · A bare -ing where adding *am* WOULD fix it — only `...-p5`, where
 *     *I'm thinking it will slow us down* is genuinely correct — is a real
 *     dropped-copula error and logs as `gram.copula`, whose drill is `be`.
 *
 * Routing follows the drill that actually repairs the answer, never the label
 * that reads closest; see the two comments in `...-p3` for the one route in this
 * file that is a compromise, and the report for the mistakes.js row that would
 * remove it.
 * =============================================================================
 */

const GRAMMAR_PRESENT_SIMPLE_CONTINUOUS = {
    id: "present-simple-vs-continuous",
    syllabusNumber: 2,
    tier: "foundation",
    cefr: "A2–B1",
    title: "Doing it now, or just being that way",

    srsType: "gram",
    srsRef: "present-simple-vs-continuous",
    srsKey: "gram:present-simple-vs-continuous",
    mistakeCategory: "gram.stative-progressive",

    // Advisory only (nothing in the methodology gates grammar). The continuous
    // is built out of am/is/are, so a learner who is still dropping the copula
    // has a more useful lesson available first.
    prerequisites: ["be"],

    rule: "**-ing** does not mean *now* — it means *in the middle of doing something*, so a verb that names a state rather than an activity stays in its plain form: *I **have** two brothers*, *I **know** the answer*, *I **have** a question*.",

    explain: "English has two present tenses and it splits them by activity, not by time. The plain form covers what is generally true — what you own, know, think, want, or do regularly. The -ing form covers something you are in the middle of doing, and that is why it cannot attach to a state: there is no middle of owning two brothers. The important part is what the -ing form does when a verb has both a state sense and an activity sense, which many of the common ones do. It does not become wrong — it switches the verb to the activity. *I have a car* is possession; *I'm having lunch* is an activity, and both are correct. So the question to ask is never \"is this verb allowed -ing\", it is \"is there an activity here for the -ing to name\". *Have* has one, so *I'm having lunch* is fine. *Know* has none, so *I am knowing* has nothing to switch into, and that is the whole of why it does not exist.",

    decide: [
        "Am I describing something I am busy doing, or something that is simply the case? Busy doing it → -ing. Simply the case → plain form. *I'm filling in the form* against *I know the answer*.",
        "Could I stop in the middle of it? *I'm reading the report* — yes, I can put it down. *I know your sister* — there is no middle to stop in, so no -ing.",
        "If the verb is one of the both-ways verbs — *have*, *see*, *think*, *feel*, *taste*, *look* — ask which sense I mean. Owning, perceiving, believing → plain form. Eating, meeting, considering → -ing, and it is correct.",
        "*Now* on its own does not decide it. *I want it now*, *I need it now*, *I have it now* are all plain, because wanting, needing and owning are states however immediate they are.",
        "Last check, for the sentence you are actually about to say: *I am having a doubt* → what is the state? Possessing a question. So: *I have a question*."
    ],

    whyItMatters: "Be honest about the size of this: nobody has ever misunderstood *I am having a doubt*, and it is ordinary, unremarkable English across South Asia. Two things make it worth your attention anyway. First, it is one of the few remaining features that marks an otherwise excellent English as regional to a listener from outside the region — which matters only when that is not what you want. Second, and less cosmetically, four of these verbs really do change meaning with the -ing: *I'm seeing Ravi* is not *I see Ravi*, and *what are you thinking?* is not *what do you think?*. That is where getting it wrong costs you something more than an accent.",

    notice: {
        lines: [
            { speaker: "Anusha", text: "Quick one before you go — I **have** a question about the migration plan." },
            { speaker: "Tom", text: "Go ahead. Actually, can it wait ten minutes? I'm **having** lunch." },
            { speaker: "Anusha", text: "Of course. I'll ping you at two." },
            { speaker: "Tom", text: "Perfect. I **don't know** the answer off the top of my head anyway — I'll look it up while I eat." }
        ],
        question: "Tom uses *have* twice in ten seconds: once as **have** and once as **having**. He is not being inconsistent, and he is not correcting himself. What is different about the two?",
        answer: "The sense of the verb, not the timing. Anusha's *have* is possession — she is holding a question — and possession has no middle to be in, so it takes the plain form. Tom's *having* is an activity: he is in the middle of eating, and *have lunch* is a thing you do. Same verb, two senses, and the -ing is what picks the second one. Notice the last line too: *I don't know* stays plain even though he means right this second. That is the proof that -ing is not about *now* — if it were, *I am not knowing* would be the natural thing to say there, and it is not."
    },

    contrast: [
        {
            pair: [
                {
                    text: "Do you have milk?",
                    means: "Is there milk in the house — do you keep it, have you got any? A question about what you possess."
                },
                {
                    text: "Are you having milk?",
                    means: "Are you taking milk in this, right now — in your tea, on your cereal? A question about what you are about to do."
                }
            ],
            takeaway: "Both are correct and you would use them in different rooms. The -ing has not broken *have*; it has moved it from *possess* to *take, consume, go through*. That second sense is where *I'm having lunch*, *she's having a baby* and *we're having trouble with the wifi* all come from."
        },
        {
            pair: [
                {
                    text: "Do you see anyone?",
                    means: "Is there anybody visible — can your eyes find a person? Perception, happening to you rather than done by you."
                },
                {
                    text: "Are you seeing anyone?",
                    means: "Are you in a relationship with someone? *See* in its activity sense — meeting a person regularly, by arrangement."
                }
            ],
            takeaway: "The same switch, and a much bigger jump in meaning. *See* has an activity sense — meeting someone on purpose — and the -ing is what selects it: *I'm seeing the doctor at four* is an appointment, not eyesight. Ask the wrong one of these two questions and you will find out immediately."
        },
        {
            pair: [
                {
                    text: "What do you think?",
                    means: "What is your opinion? Asking for the view you hold — a state you are in."
                },
                {
                    text: "What are you thinking?",
                    means: "What is going through your mind at this moment? Asking about mental activity in progress, which is a much more personal question."
                }
            ],
            takeaway: "*Think* has both senses too: believing something is a state, turning something over is an activity. This is why *I'm thinking about it* is correct and *I'm knowing about it* is not — *think* has an activity to switch into and *know* does not. There is nothing you do in order to know something; you either do or you don't."
        }
    ],

    spokenNote: "Three things you can hear rather than read. First, the plain form is genuinely shorter, and in real speech the difference is one syllable against three: *I have a question* /aɪ ˈhæv ə ˈkwestʃən/ against *I am having a question* — which is also why the correct form arrives faster once it is a habit. Second, the continuous almost never appears in full: it is /aɪm/, /ʃiːz/, /wɪər/, and *I'm having lunch* runs to /aɪm ˈhævɪŋ ˈlʌntʃ/ with no gap in it. If you are saying *I ... am ... having*, that hesitation is usually the sound of assembling a form you do not need. Third, the negative of the plain form is the one to drill out loud, because it is where the -ing is most tempting: *I don't know* /aɪ ˈdəʊnəʊ/, said as almost one word, and *I don't understand* — not *I am not knowing*, which takes twice as long to say and lands on the wrong sense.",

    caveats: [
        "The -ing form is NOT forbidden with these verbs, and any rule that says so is wrong. What is true is narrower: the -ing form selects a verb's activity sense, and a few verbs have no activity sense to select. *Know*, *belong*, *consist*, *contain*, *own*, *seem* and *deserve* are the safest examples of that small group. Everything else on the usual \"stative verbs\" list has some sense where -ing is completely normal.",
        "The both-ways verbs, with both senses spelled out, because these are where teaching usually goes wrong. *have*: possess (*I have a car*) against take part in or go through (*I'm having lunch*, *we're having trouble*). *see*: perceive (*I see it*) against meet by arrangement, or date (*I'm seeing the doctor*, *they're seeing each other*). *think*: believe (*I think you're right*) against turn over (*I'm thinking about it*). *feel*: hold an opinion (*I feel it's too soon*) against physical sensation, where BOTH work with no real difference (*I feel fine* / *I'm feeling fine*). *taste*, *smell*, *look*, *sound*: describe a quality (*this tastes odd*) against perform the action (*she's tasting the sauce*, *I'm looking at it*).",
        "*I'm loving it* is real English, and this app will not tell you otherwise. Pushing a state verb into the -ing form on purpose is a live and spreading usage that says \"temporarily, vividly, while it is happening\" — *I'm loving this weather*, *I'm liking the new layout*, *I'm wanting to say yes*. It is a marked, informal, deliberate choice rather than the default, so it is not the form to reach for by accident; but if you hear it, you are hearing a stylistic move, not a mistake.",
        "*I'm seeing the doctor tomorrow* is about the future, not the present. The continuous is the ordinary English way to state a fixed arrangement — *we're flying on Sunday*, *I'm meeting them at six* — and it is one of the most common uses of the form. Do not let this lesson talk you out of it.",
        "*Always* plus -ing means irritation, and it is deliberate: *he's always losing his badge*, *she's always asking me to reformat things*. It does not mean the action is in progress. Compare *he always loses his badge*, which is a neutral fact about him.",
        "Indian and South Asian English use the -ing form with state verbs as a settled regional norm — *I am not knowing*, *I am having two brothers*, *she is having a doubt* — and hundreds of millions of people speak it that way. When this point calls a form the one \"English does not have\", the honest scope of that claim is British, American and international-standard usage. Nothing here says you have been speaking badly; it says the two varieties differ here, and shows you which form travels.",
        "*I am having a doubt* has a second, separate thing going on: outside South Asia, *doubt* means you suspect something is untrue, not that you want information. So the full repair is *I have a question*, and the *have/having* half is only one of the two changes. That second half is a word-choice matter and belongs to the register point (T-G9), not to this one.",
        "With perception verbs, English often uses *can* instead of either present tense: *I can see it*, *I can hear you*, *I can smell burning*. Where a learner reaches for *I am seeing it*, *I can see it* is very often the form a native speaker would actually have used — and it is easier than choosing between the other two."
    ],

    commonErrors: [
        {
            heard: "I am having a doubt about the third slide.",
            fix: "I have a question about the third slide.",
            why: "Two changes. *Having* → *have*, because holding a question is possession and not an activity; and *doubt* → *question*, because outside South Asia *a doubt* means you suspect something is false. The second change is the one that actually prevents a misunderstanding.",
            l1: "T-G3"
        },
        {
            heard: "I am having two brothers.",
            fix: "I have two brothers.",
            why: "*Have* here is possession, and there is no middle of possessing someone to be in. Keep the -ing for the sense where *have* means going through something: *she's having a baby*, *we're having a rough week*.",
            l1: "T-G3"
        },
        {
            heard: "I am not knowing his number.",
            fix: "I don't know his number.",
            why: "*Know* is the clearest case of a verb with no activity sense at all — there is nothing you do in order to know a number, so there is nothing for the -ing to name. Drill the negative out loud as one chunk: /aɪ ˈdəʊnəʊ/.",
            l1: "T-G3"
        },
        {
            heard: "I am understanding what you are saying.",
            fix: "I understand what you're saying. / I see what you mean.",
            why: "Understanding arrives rather than being carried out, so English marks it with the plain form — and in conversation the short *I see* or *I understand* does the whole job. (Informal American speech does say *I'm not understanding you*, so this is not the most clear-cut of the set; the plain form is the one that is right everywhere.)",
            l1: "T-G3"
        },
        {
            heard: "She is belonging to the finance team.",
            fix: "She's on the finance team. / She belongs to the finance team.",
            why: "*Belong* is in the small group with no activity sense whatsoever. The more useful fix is the second half of that line, though: most speakers would not say *belongs to* about a team at all, they would say *she's on it*.",
            l1: "T-G3"
        },
        {
            heard: "I am wanting to ask you something.",
            fix: "I wanted to ask you something. / I want to ask you something.",
            why: "Wanting is a state. The interesting fix is the first one: English softens a request by putting it in the past, so *I wanted to ask you something* is what a native speaker says even though the wanting is present. That is the polite form you were reaching for.",
            l1: "T-G3"
        }
    ],

    practice: [
        {
            id: "present-simple-vs-continuous-p1",
            mode: "gap",
            focus: "state-verb-with-no-activity-sense",
            prompt: "Ask Priya about the billing system — she ___ how it works better than anyone here.",
            options: ["knows", "is knowing", "know", "knowing"],
            accept: [
                { answer: "knows", means: "She is in a state of knowing it — no start, no middle, no finish. This is the one form *know* has in the present, and the -s is there because the subject is *she*." }
            ],
            showDifferenceOnCorrect: false,
            spoken: "*she knows how it works* → /ʃi ˈnəʊz haʊ ɪt ˈwɜːks/. The -s on *knows* is a /z/, not an /s/, and it runs straight into *how* with no pause.",
            feedback: [
                {
                    forAnswer: "is knowing",
                    reason: "This is the form the sense will not support. *Know* is one of the few verbs with no activity sense at all — there is nothing you *do* in order to know something, so there is no middle of it for the -ing to point at. That is different from *have* or *think*, which do have an activity sense, which is exactly why *I'm having lunch* and *I'm thinking about it* are fine. Worth saying: this is the single most common form of this habit, it survives in otherwise excellent English for years, and *I am not knowing* is standard across a great deal of South Asia — so this is a difference between varieties, not a hole in your English.",
                    contrast: [
                        "She knows how it works better than anyone here.",
                        "She's learning how it works — give her a week."
                    ],
                    retryCue: "Is there something she is busy doing here, or a state she is simply in? If I cannot picture her stopping halfway, the plain form is the one.",
                    grammaticalButDifferent: false,
                    logAs: "gram.stative-progressive",
                    errorKind: "progressive-on-verb-with-no-activity-sense"
                },
                {
                    forAnswer: "know",
                    reason: "The tense is right and the sense is right — this is only the third-person -s, which English holds on to after *he*, *she* and *it*. Worth separating from the -ing question: you have made the harder decision correctly.",
                    contrast: [
                        "She knows how it works.",
                        "They know how it works."
                    ],
                    retryCue: "Who is the subject? *He*, *she* or *it* puts an -s on the plain form.",
                    grammaticalButDifferent: false,
                    logAs: "gram.subject-verb-agreement",
                    errorKind: "missing-third-person-s"
                },
                {
                    forAnswer: "knowing",
                    reason: "An -ing form cannot stand as the verb of a sentence on its own — it always needs *am*, *is* or *are* in front of it. That is worth noticing for its own sake, but here the deeper answer is that neither *knowing* nor *is knowing* fits: the sentence wants the plain form.",
                    contrast: [
                        "She knows how it works.",
                        "She's working on it right now."
                    ],
                    retryCue: "If I am not going to say *is* in front of this, the -ing has nothing holding it up. So which plain form of *know* goes after *she*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.stative-progressive",
                    errorKind: "bare-participle-no-auxiliary"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about which present form of *know* goes after *she*. *Knows* is the one. If you typed something with *understands* or *gets* in it, that is fine English and means much the same thing — the item just cannot check a different verb.",
                contrast: [
                    "She knows how it works better than anyone here.",
                    "She understands how it works better than anyone here."
                ],
                retryCue: "Try again with *know*, and decide first whether knowing is something she is doing or something she is."
            },
            alsoNotice: "*How it works*, not *how is it working* and not *how does it work*, inside the sentence. Once a question word is buried in the middle of a longer sentence, English goes back to ordinary statement order — a separate habit, and the one behind *Do you know where is the station?*."
        },
        {
            id: "present-simple-vs-continuous-p2",
            mode: "gap",
            focus: "have-in-the-possession-sense",
            prompt: "— Any brothers or sisters? — Yes, I ___ two brothers, both older than me.",
            options: ["have", "have got", "am having", "having"],
            accept: [
                { answer: "have", means: "Possession, stated plainly. There is no middle of possessing a brother, so nothing here is in progress and the plain form is the whole answer." },
                { answer: "have got", means: "The same possession, in the form most British and Indian speakers actually say out loud — usually contracted to *I've got*. It is not more correct or less; it is more spoken, and it is slightly less natural in American English." }
            ],
            // Two right answers with the same meaning and a different register, so
            // the learner is told they are not simply interchangeable.
            showDifferenceOnCorrect: true,
            spoken: "*I have two brothers* → /aɪ ˈhæv ˈtuː ˈbrʌðəz/. *I have got* is almost never said in full: it is /aɪv ˈɡɒt/, one beat, with the *have* reduced to a /v/ stuck on *I*.",
            feedback: [
                {
                    forAnswer: "am having",
                    reason: "*Have* really does take -ing — but only in its other sense, where it means going through something or taking part in something: *I'm having lunch*, *she's having a baby*, *we're having trouble with the wifi*. Brothers are not something you go through, so that sense has nothing to attach to here, and the plain possession form is what is left.",
                    contrast: [
                        "I have two brothers, both older than me.",
                        "My sister's having a baby in March."
                    ],
                    retryCue: "Which *have* do I mean — owning it, or going through it? Only the second one takes -ing.",
                    grammaticalButDifferent: false,
                    logAs: "gram.stative-progressive",
                    errorKind: "progressive-on-possessive-have"
                },
                {
                    forAnswer: "having",
                    reason: "An -ing form needs *am*, *is* or *are* in front of it to work as the verb of a sentence — but adding *am* would not rescue this one either, because possession is not an activity in progress. Both roads lead back to the plain *have*.",
                    contrast: [
                        "I have two brothers.",
                        "I'm having a rough week, to be honest."
                    ],
                    retryCue: "What is the plain present form of *have* after *I*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.stative-progressive",
                    errorKind: "bare-participle-no-auxiliary"
                }
            ],
            fallbackFeedback: {
                reason: "There are two right answers here and both are forms of plain *have*: *I have two brothers* and *I've got two brothers*. If you typed the contracted *I've got*, that is the same answer as *have got* and it is correct — it is what most people say. What does not work is any form with -ing on it, because owning something is not an activity you are in the middle of.",
                contrast: [
                    "I have two brothers, both older than me.",
                    "I've got two brothers, both older than me."
                ],
                retryCue: "Say it out loud the way you would to a colleague. Is there anything in progress in this sentence at all?"
            },
            alsoNotice: "*Both older than me* has no verb in it, and needs none — English lets a short description hang off the end of a sentence like that. It is worth collecting: *I have two brothers, both older than me*, *she has one daughter, still at school*."
        },
        {
            id: "present-simple-vs-continuous-p3",
            mode: "gap",
            focus: "have-in-the-activity-sense-takes-ing",
            prompt: "Don't ring her now — she's ___ lunch with the client from Pune.",
            options: ["having", "eating", "have", "had"],
            accept: [
                { answer: "having", means: "*Have* in its activity sense — taking part in a meal — and the -ing says she is in the middle of it. This is the sense that makes *I'm having lunch* correct, and it is the same verb as *I have two brothers*." },
                { answer: "eating", means: "The plain activity verb for the same thing, and just as correct. Slightly more literally about the food: *having lunch* covers the whole occasion, including the client and the conversation." }
            ],
            // Two right answers doing different work. This item exists to prove
            // the -ing form is not banned from `have` — an item set where the
            // continuous is always wrong would teach the false rule by implication.
            showDifferenceOnCorrect: true,
            spoken: "*she's having lunch* → /ʃiz ˈhævɪŋ ˈlʌntʃ/, all one phrase with no gap after *she's*. The -ing ending is /ɪŋ/ and in fast speech often just /ɪn/ — *she's havin' lunch* — which is ordinary, not sloppy.",
            feedback: [
                {
                    forAnswer: "have",
                    reason: "This one is over-correction, and it is worth naming as that: you have learned that *have* takes the plain form and applied it one step too far. After *she's* the verb must be an -ing form, and here the -ing is exactly right — she is in the middle of a meal, which is an activity, so *have* is in its activity sense and the -ing belongs.",
                    contrast: [
                        "She's having lunch with the client from Pune.",
                        "She has lunch at her desk most days."
                    ],
                    retryCue: "*She's* is already sitting there. What form has to follow it — and is there an activity here for the -ing to name?",
                    grammaticalButDifferent: false,
                    // Over-correction of THIS rule, so the drill that fixes it is
                    // this point — which is what `gram.stative-progressive`
                    // targets. `gram.verb-form` ("right tense, wrong form") reads
                    // like the closer label, but its drill is `past-simple`, and
                    // sending a learner who over-applied the stative rule to the
                    // past-simple drill is the mis-route countability.js warns
                    // about. Same call as that file logging *two coffee* — an
                    // over-applied no-plural rule — under the countability id.
                    logAs: "gram.stative-progressive",
                    errorKind: "over-applied-stative-rule"
                },
                {
                    forAnswer: "had",
                    reason: "This is real English and it means something else: *she's had lunch* is the present perfect — she has already eaten, and she is free. Your sentence would be a reason to ring her rather than a reason not to. The word *now* is the clue that the meal is still going on.",
                    contrast: [
                        "Don't ring her now — she's having lunch.",
                        "Ring her now — she's had lunch, so she'll be at her desk."
                    ],
                    retryCue: "Is the lunch finished or still happening? *She's had* is finished; what says still happening?",
                    grammaticalButDifferent: true,
                    // ⚠️ THE ONE IMPERFECT ROUTE IN THIS FILE. js/core/mistakes.js
                    // has no row for aspect confusion between the perfect and the
                    // continuous — `gram.present-perfect` is labelled '"have gone"
                    // where English needs "went"', which is perfect-vs-past-simple
                    // and not what happened here. It is still the least wrong
                    // destination available: the learner reached for the present
                    // perfect, and that row's drill
                    // (`present-perfect-vs-past-simple`) is the only place the
                    // perfect is taught at all. Routing to the lesson default
                    // would be worse — a stative drill teaches nothing about
                    // *she's had*. `errorKind` keeps the real distinction
                    // recoverable in one pass if mistakes.js ever gains the row.
                    logAs: "gram.present-perfect",
                    errorKind: "perfect-for-in-progress"
                }
            ],
            fallbackFeedback: {
                reason: "Two answers work here and both describe a meal in progress: *she's having lunch* and *she's eating lunch*. Anything you typed that means she is out at a meal right now is on the right track — *she's at lunch* and *she's out for lunch* are both natural too, they just change the shape of the sentence rather than filling this gap.",
                contrast: [
                    "She's having lunch with the client from Pune.",
                    "She's eating lunch with the client from Pune."
                ],
                retryCue: "*She's* needs an -ing form after it. Which -ing form says she is in the middle of a meal?"
            },
            alsoNotice: "Hold this item next to the one about two brothers: same verb, opposite answer. That is the whole point of this lesson in one pair — the -ing is not banned from *have*, it selects the sense where *have* means going through something rather than owning it."
        },
        {
            id: "present-simple-vs-continuous-p4",
            mode: "gap",
            focus: "see-in-the-perceive-sense",
            prompt: "— The invoice goes to Finance first, and only then to me. — Ah, I ___. That explains the delay.",
            options: ["see", "am seeing", "sees", "seeing"],
            accept: [
                { answer: "see", means: "*See* meaning understand, which is a state you land in rather than something you carry out. *Ah, I see* is a fixed two-word response and one of the most useful things to have ready in a conversation." }
            ],
            showDifferenceOnCorrect: false,
            spoken: "*Ah, I see* → /ɑː aɪ ˈsiː/, with the whole weight on *see* and the pitch falling. Said with a rising pitch instead it becomes a question — *I see?* — so the fall is what makes it sound like understanding rather than doubt.",
            feedback: [
                {
                    forAnswer: "am seeing",
                    reason: "*See* does take -ing in some of its senses — *I'm seeing the doctor at four*, *they're seeing each other* — but both of those are the sense where *see* means meeting somebody. Understanding is not an activity you conduct, so this sense has no -ing form at all, and *Ah, I'm seeing* is not a thing English says.",
                    contrast: [
                        "Ah, I see. That explains the delay.",
                        "I'm seeing the finance team at four, so I'll ask them then."
                    ],
                    retryCue: "Which *see* do I mean — understanding it, or meeting somebody? Only the meeting sense takes -ing.",
                    grammaticalButDifferent: false,
                    logAs: "gram.stative-progressive",
                    errorKind: "progressive-on-perception-see"
                },
                {
                    forAnswer: "sees",
                    reason: "The -s belongs after *he*, *she* or *it*, and the subject here is *I*. The tense choice was right, which is the harder half.",
                    contrast: [
                        "Ah, I see.",
                        "Ah, she sees the problem now too."
                    ],
                    retryCue: "Who is the subject? *I* takes the bare form with no -s.",
                    grammaticalButDifferent: false,
                    logAs: "gram.subject-verb-agreement",
                    errorKind: "third-person-s-on-first-person"
                },
                {
                    forAnswer: "seeing",
                    reason: "An -ing form on its own has nothing holding it up — it needs *am*, *is* or *are*. And *am seeing* would not fit here either, because understanding is not an activity in progress. The plain form is what the sense calls for.",
                    contrast: [
                        "Ah, I see.",
                        "I'm seeing what you mean as you explain it — keep going."
                    ],
                    retryCue: "No *am* in front of it means no -ing. What is the plain form?",
                    grammaticalButDifferent: false,
                    logAs: "gram.stative-progressive",
                    errorKind: "bare-participle-no-auxiliary"
                }
            ],
            fallbackFeedback: {
                reason: "The gap wants a form of *see* in its understanding sense, and *I see* is the one. If you typed *I get it* or *I understand*, that is correct English doing the same job — the item can only check *see*, but you had the right idea.",
                contrast: [
                    "Ah, I see. That explains the delay.",
                    "Ah, I understand. That explains the delay."
                ],
                retryCue: "Two words. What does English say when something has just become clear?"
            },
            alsoNotice: "Do not read this item as \"*see* never takes -ing\". In support and engineering English, *I'm seeing an error on my end* and *we're seeing a lot of timeouts* are completely ordinary — there the -ing means repeatedly, over a period, and it is the right form. What has no -ing is *see* meaning *understand*, which is this sentence."
        },
        {
            id: "present-simple-vs-continuous-p5",
            mode: "gap",
            focus: "both-forms-correct-with-a-shift-in-certainty",
            prompt: "— What do you make of the new approval process? — Honestly, I ___ it will slow us down.",
            options: ["think", "am thinking", "thinks", "thinking"],
            accept: [
                { answer: "think", means: "*Think* in its state sense — the opinion you hold. This is your settled view, offered plainly, and it is the form to reach for by default." },
                { answer: "am thinking", means: "Also correct, and not the same. *I'm thinking it will slow us down* is the view you are arriving at rather than one you have arrived at — tentative, still open, and softer on whoever designed the process. Native speakers use it in exactly this situation to leave themselves room." }
            ],
            // BOTH forms are correct here and the difference is real. This item is
            // deliberately the fuzzy case: an item set in which -ing is always
            // wrong would teach a false rule even with no false sentence in it.
            showDifferenceOnCorrect: true,
            spoken: "*I think it'll slow us down* → /aɪ ˈθɪŋk ɪtl ˈsləʊ əs ˈdaʊn/. *I'm thinking* stretches the middle of the sentence out — /aɪm ˈθɪŋkɪŋ/ — and that extra length is part of how it sounds tentative. The *th* is the unvoiced one, tongue behind the teeth, no /t/.",
            feedback: [
                {
                    forAnswer: "thinks",
                    reason: "The -s form goes with *he*, *she* or *it*, and the subject here is *I*. Both of the tense choices were available to you and either would have been right — this is only the ending.",
                    contrast: [
                        "I think it will slow us down.",
                        "Ravi thinks it will slow us down too."
                    ],
                    retryCue: "Who is doing the thinking? *I* takes the bare form.",
                    grammaticalButDifferent: false,
                    logAs: "gram.subject-verb-agreement",
                    errorKind: "third-person-s-on-first-person"
                },
                {
                    forAnswer: "thinking",
                    reason: "You have chosen the -ing form, which is genuinely available here — *I'm thinking it will slow us down* is good English. It just cannot stand without *am* in front of it. Put the *am* back and your answer is right.",
                    contrast: [
                        "I'm thinking it will slow us down.",
                        "I think it will slow us down."
                    ],
                    retryCue: "An -ing form always needs am/is/are. Which one goes with *I*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.copula",
                    errorKind: "bare-participle-no-auxiliary"
                }
            ],
            fallbackFeedback: {
                reason: "This is one of the items where two forms are both right: *I think it will slow us down* is your settled opinion, *I'm thinking it will slow us down* is the opinion forming as you speak. Either one fills the gap. *I suspect* and *I reckon* are natural here too — they just are not forms of *think*.",
                contrast: [
                    "I think it will slow us down.",
                    "I'm thinking it will slow us down."
                ],
                retryCue: "Have I made up my mind, or am I making it up as I answer? Both have a form — pick the one you mean."
            },
            alsoNotice: "This is the item to remember when someone tells you the -ing form is banned with *think*. It is not. What is true is that the two forms are not the same: the plain one states a position, the -ing one is still deciding. *What do you think?* and *What are you thinking?* are the same difference in question form."
        },
        {
            id: "present-simple-vs-continuous-p6",
            mode: "gap",
            focus: "the-doubt-sentence-repaired",
            prompt: "Sorry to interrupt — I ___ a quick question about slide four, if there's time at the end.",
            options: ["have", "am having", "having", "has"],
            accept: [
                { answer: "have", means: "Possession again: you are holding a question, which is a state and not an activity. This is the repair for the sentence this whole lesson is built around." }
            ],
            showDifferenceOnCorrect: false,
            spoken: "*I have a quick question* → /aɪ ˈhæv ə ˈkwɪk ˈkwestʃən/, four beats with the stress on *quick* and *ques-*. In a meeting most people front it with a softener like this one — *sorry to interrupt* — and then the sentence itself is short.",
            feedback: [
                {
                    forAnswer: "am having",
                    reason: "This is the exact sentence the lesson is for, so it is worth being precise about why. *Have* takes -ing in the sense of going through something — *I'm having a rough morning*, *I'm having second thoughts* — but a question is something you hold, not something you undergo, so that sense has nothing to attach to. Plain *have* is the form. (If the sentence you had in mind was *I am having a doubt*, there is a second half to the repair: outside South Asia *a doubt* means you suspect something is untrue, so the word you want is *question*.)",
                    contrast: [
                        "I have a quick question about slide four.",
                        "I'm having second thoughts about slide four."
                    ],
                    retryCue: "Am I holding this thing, or going through it? Holding it means plain *have*.",
                    grammaticalButDifferent: false,
                    logAs: "gram.stative-progressive",
                    errorKind: "progressive-on-possessive-have"
                },
                {
                    forAnswer: "having",
                    reason: "An -ing form needs am/is/are in front of it — but here even *am having* would be the wrong sense, because holding a question is a state. The plain form does the job in one word.",
                    contrast: [
                        "I have a quick question about slide four.",
                        "I'm having trouble with slide four — the numbers don't add up."
                    ],
                    retryCue: "What is the plain present form of *have* after *I*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.stative-progressive",
                    errorKind: "bare-participle-no-auxiliary"
                },
                {
                    forAnswer: "has",
                    reason: "*Has* is the *he/she/it* form, and the subject here is *I*. The sense decision underneath it was right, which is the part this lesson is about.",
                    contrast: [
                        "I have a quick question about slide four.",
                        "Ravi has a question about slide four as well."
                    ],
                    retryCue: "Who has the question? *I have*, *she has*.",
                    grammaticalButDifferent: false,
                    logAs: "gram.subject-verb-agreement",
                    errorKind: "third-person-s-on-first-person"
                }
            ],
            fallbackFeedback: {
                reason: "The gap wants the plain *have*: *I have a quick question*. *I've got a quick question* is equally correct and is what most people say out loud, so if that is what you typed you were right — the item is checking the *have/having* choice rather than the *got*. What does not work is *am having*, because holding a question is not an activity in progress.",
                contrast: [
                    "I have a quick question about slide four.",
                    "I've got a quick question about slide four."
                ],
                retryCue: "One word, and it is the same word as in *I have two brothers*."
            },
            alsoNotice: "*If there's time at the end* is doing as much work as the grammar. Flagging a question rather than firing it is how the request lands well in a meeting, and it buys you the two seconds you need to assemble the sentence."
        }
    ],

    produce: {
        id: "present-simple-vs-continuous-produce",
        task: "Say six sentences out loud, in this order, without writing them down first. (1) One thing you own or possess. (2) One thing you know how to do. (3) One thing you are in the middle of this week — a project, a course, a move. (4) Where you are and what you are doing right now, as if someone has just called you. (5) One opinion you hold about your work. (6) One question you have for someone. The order is the exercise: it alternates states and activities, so you have to make the choice fresh each time rather than settling into one form.",
        targetSeconds: 60,
        useLanguage: [
            "have, know, want, need, understand, think — the plain form, for anything you own, know or believe",
            "am/is/are + -ing — for sentences 3 and 4 only, where something really is in progress",
            "I have a question about… — the sentence to say at full speed, because it is the one that has to arrive without assembling",
            "at the moment, right now, these days — say one of these WITH a plain form on purpose (*I want it right now*), to prove to yourself that *now* does not force the -ing"
        ],
        selfCheck: [
            "In sentences 1, 2, 5 and 6, did I use the plain form — no am/is/are and no -ing anywhere in them?",
            "In sentences 3 and 4, could I name the activity I was in the middle of? If I could not, the -ing was probably not needed there.",
            "Did *I have a question* come out in one piece, at speaking speed, without a pause between *have* and *a*?",
            "Did I say *doubt* anywhere? If so, did I mean *I suspect that is untrue* — and if not, did I swap it for *question*?",
            "Did I catch myself starting *I am hav…* at any point, and did I finish the sentence instead of stopping to restart? Self-correcting mid-sentence out loud is the habit forming, not a failure."
        ],
        model: {
            text: "I have a flat in Kondapur and a scooter I barely use. I know Excel properly — pivot tables, the lot — and I know enough SQL to be dangerous. This month I'm rewriting the whole onboarding deck, so I'm working late most days. Right now I'm sitting on my balcony with a coffee, avoiding it. I think our approval process has one step too many in it, honestly. And I have a question for my manager that I keep not asking: what would a promotion actually look like here?",
            note: "Read this once for the shape of it, then look away from the screen and say your own six. Reading it aloud is not the exercise — the -ing choice only goes wrong when you are composing under time pressure, so the version that counts is the one you build yourself, out loud, while thinking about what you mean."
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            transferId: "T-G3",
            priority: "M",
            note: "There is a specific reason this survives at C1, and it is not carelessness. Telugu's everyday present tense is built with -tunnā-, and that one form covers both of English's present tenses: *nēnu tinṭunnānu* is *I am eating* and *I eat*, with the context deciding. So the shape you have used for the ordinary present all your life maps straight onto English's am/is/are + -ing — and English's marked, in-the-middle-of-it form becomes your default present, which is exactly the wrong way round. Then there is a second, sharper reason for these particular verbs. Telugu does not use a verb like *have* or *know* at all for possession and knowledge: it says *nāku iddaru annayyalu unnāru*, \"to me two brothers exist\", and *nāku telusu*, \"to me it is known\". There is no verb in your sentence to keep in the plain form, so when you build the English one you reach for the default present — and the default is -ing. That is why *I am having two brothers* and *I am not knowing* feel completely normal to produce: nothing in Telugu is pushing back. Worth saying plainly: this is also a settled feature of Indian English, spoken by hundreds of millions of people, and nobody has ever misunderstood you. If nobody has mentioned it to you before now, that is because it never obscures anything — not because they did not notice.",
            bridge: "Two habits, and the first is a single sentence rather than a rule. Learn *I have a question* as one fixed chunk, at speaking speed, until it arrives without being built — the way *nāku telusu* arrives. That one phrase covers most of the occasions when this error is actually heard by other people, because it turns up in meetings. Then generalise from it with a test that fits inside real time: can I stop halfway? *I'm reading it* — yes, I can put it down. *I have two brothers* — there is no halfway, so no -ing. Second habit, which is the one that stops the over-correction: do NOT learn a list of verbs that ban -ing, because the list is not true and it will make you distrust the whole thing the first time you hear *I'm loving it* or *I'm having lunch*. Learn the question instead — is there an activity here for the -ing to name? *Have* has one, so *I'm having lunch* is right. *Know* has none, so *I am knowing* has nothing to be. And when the verb is *see* or *feel* or *taste*, remember that English often ducks the choice entirely with *can*: *I can see it*, *I can hear you*."
        }
    },

    review: {
        rulePrompt: "One line before you start: -ing does not mean *now*, it means *in the middle of doing something* — so ask whether there is an activity for it to name. *Have lunch* is an activity, so *I'm having lunch*. Having two brothers is not, so *I have two brothers*.",
        itemIds: ["present-simple-vs-continuous-p3", "present-simple-vs-continuous-p6", "present-simple-vs-continuous-p5"]
    },

    tags: ["present-simple", "present-continuous", "stative-verbs", "aspect", "have", "know", "T-G3", "high-frequency"]
};

// Match the js/core/* pattern: a lexical global for the browser, CommonJS for
// the Jest suite. `module` is undefined in a classic script, so this is inert
// there.
if (typeof module !== "undefined" && module.exports) {
    module.exports = { GRAMMAR_PRESENT_SIMPLE_CONTINUOUS: GRAMMAR_PRESENT_SIMPLE_CONTINUOUS };
}

// Self-registration, exactly as data/grammar/be.js and
// data/grammar/countability.js do it. `grammarLessons` in data/grammar.js is a
// top-level `const`, i.e. a lexical global, so a classic script loaded AFTER it
// can read the binding by bare name and push into the tier array.
//
// The guards cover the two things that can actually go wrong: a script-order
// mistake (grammar.js absent) leaves the point unregistered instead of throwing
// during page load, and an id already present is not pushed twice — so if this
// point is ever folded into data/grammar.js inline, this file becomes a no-op
// rather than producing a duplicate. Both verified.
//
// A duplicate <script> include of THIS file is a different matter: it throws
// "GRAMMAR_PRESENT_SIMPLE_CONTINUOUS has already been declared" at parse time,
// as a second include of any file in this codebase would. That is the
// classic-script contract, not something these guards can rescue.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.foundation) &&
    !grammarLessons.foundation.some(function (p) { return p && p.id === GRAMMAR_PRESENT_SIMPLE_CONTINUOUS.id; })) {
    grammarLessons.foundation.push(GRAMMAR_PRESENT_SIMPLE_CONTINUOUS);
}
