/**
 * Grammar point — Indian-English register items (T-G9).
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `GRAMMAR_REGISTER`. Same schema, field for field and nested key for nested
 * key, as the `articles` point in data/grammar.js and
 * data/grammar/question-formation.js — read data/grammar.js's header comment for
 * what each field is for. Nothing is added to the schema here and nothing is
 * left out; `SRS.auditProjection('gram', GRAMMAR_REGISTER)` returns
 * `dropped: []`, `phantom: []`.
 *
 * `id` is exactly `register`, and must not be "prettified". `js/core/mistakes.js`
 * routes `gram.register-indian` here with `drill: { strand: 'grammar', target:
 * 'register' }`, and before this file that was the LAST dead drill target in the
 * taxonomy (PROGRESS.md §2.10: "25 live, 1 dead"), i.e. a "Practise this" button
 * that opened nothing (US-187). Verified after this file loads:
 * `Mistakes.drillTarget('gram.register-indian')` → `authored: true`,
 * `deadTargets: []`.
 *
 * ⚠️ FIVE AUTHORING NOTES. THE FIRST ONE IS THE POINT.
 *
 * 1. NOTHING IN THIS LESSON IS AN ERROR, AND THE FILE NEVER SAYS OTHERWISE.
 *    *doubt* for *question*, *out of station*, *cousin brother*, *do the
 *    needful*, *revert*, *prepone*, *kindly*, *What is your good name?* are
 *    standard Indian English — a variety with more speakers than British
 *    English — and correct in the register where they live. A lesson that treats
 *    them as mistakes is both wrong and insulting, so this one does not. It is an
 *    AUDIENCE point, and it sorts every item into three groups, stated in `rule`,
 *    `explain`, `decide`, `caveats[0]` and the review prompt in the same words:
 *
 *      (a) COSTS YOU THE MESSAGE — *doubt* (= disbelief elsewhere), *revert*
 *          (= undo), *pass out* (= faint), *intimate*. The word exists in both
 *          varieties with different meanings, so the reader is confidently wrong
 *          and never asks. This group is the only one with a real cost.
 *      (b) COSTS YOU NOTHING — *out of station*, *kindly*, *cousin brother*,
 *          *do the needful*, *prepone*. Understood, guessable, or asked about.
 *          These merely mark the writing as Indian, which is NOT a problem to be
 *          fixed: it is a choice, and there is nothing to do if the learner does
 *          not want to change it.
 *      (c) FINE EVERYWHERE and corrected anyway — *Shall I…?*, *Do let me
 *          know*, *Please find attached*, *Convey my regards*.
 *
 *    The posture is data/grammar/prepositions.js's: the reason to change a word
 *    is a reader outside India, and nobody has to change how they speak with
 *    their own colleagues to get that benefit. Two facts are stated because they
 *    make the point unarguable rather than merely polite: *cousin brother*
 *    carries information *cousin* throws away (so English is the variety short of
 *    a word), and *do the needful* / *kindly* / *intimate* / *the same* are
 *    Victorian British officialese that Indian English kept and British English
 *    dropped. `whyItMatters` also says the true and unflattering thing: for most
 *    of a learner's English this lesson changes nothing.
 *
 * 2. THE AUDIENCE IS BUILT INTO THE PROMPT, BECAUSE `mode: 'gap'` IS THE ONLY
 *    MODE app.js RENDERS. A register point wants a "who are you writing to?"
 *    judgement and there is no mode for that, so every `prompt` NAMES THE READER
 *    — a client in Chicago, a client in Boston, a partner in Toronto who has
 *    never worked with an Indian team, a landlord in Hyderabad, a contractor in
 *    Warsaw in his second week. With the reader pinned, the gap has one best
 *    answer, and the SAME WORD IS GRADED BOTH WAYS ON PURPOSE:
 *      register-p1  *I have a doubt* is wrong, *I have a question* is right.
 *      register-p2  same client, an hour later: *doubt* is the ONLY right answer
 *                   and *question* is the wrong one.
 *    p1 → p2 is the pair the whole lesson rests on. It proves the lesson is about
 *    the message rather than a list of forbidden words, and `alsoNotice` on both
 *    items says so out loud. register-p4 does the other half of the job: the
 *    accepted answer is *Kindly*, i.e. the "Indian-marked" word graded RIGHT,
 *    because the reader is a stranger thirty years older in a formal letter.
 *
 * 3. NO ITEM GRADES A GROUP-(b) FORM WRONG FOR BEING INDIAN. Where a group-(b)
 *    form is a distractor it is wrong for a reason that survives the posture:
 *    *do the needful* in register-p6 loses to a named action, and the item PROVES
 *    the fault is vagueness rather than variety by grading *please do what's
 *    needed* — plain English, nothing Indian in it — exactly as wrong. In
 *    register-p4 *do the needful* loses because it duplicates an action the
 *    sentence goes on to name. *prepone* in register-p5 loses only to a reader
 *    who has never met the word, and the feedback says the sentence would be the
 *    better of the two with the learner's own team. `grammaticalButDifferent` is
 *    `true` on every one of those, so app.js prints "That is correct English — it
 *    just says something different here" before the reason.
 *
 * 4. THE ADVERSARIAL PASS, AND WHY EVERY ITEM HAS EXACTLY ONE ACCEPTED ANSWER.
 *    For most items here the Indian form IS correct English, so an item whose
 *    prompt does not pin the reader hard enough marks real English as an error —
 *    the exact thing this point exists to avoid. Two items were rewritten during
 *    that pass: register-p2 gained "You are not asking anything — you have the
 *    dates in front of you", because *my only question is…* is a real native
 *    hedge for disagreement (the feedback now says so and shows the *whether*
 *    shape it needs); register-p4 gained "this is your first and friendly
 *    request", because *You must transfer…* is the right sentence for a third
 *    letter. Equally-right answers were kept OUT of the option sets and named in
 *    `fallbackFeedback` instead — *concern* or *reservation* in p2, *reply* and
 *    *let you know* in p3, *please* or *could you please* in p4, *bring it
 *    forward* in p5, *reissue* in p6 — because US-166/US-188 make `showDifferenceOnCorrect` the
 *    only way to accept two answers, and app.js then asserts "they do not mean
 *    the same thing", which would be a lie about a synonym. Every item therefore
 *    has one `accept` entry and no item sets that flag: with one reader and one
 *    message per item, one right answer is the honest count. Every `accept`
 *    member is present in its item's `options`; no `feedback` entry targets an
 *    accepted answer.
 *
 * 5. TIER `everyday` / B1, DELIBERATELY, AND A SYLLABUS NUMBER OUTSIDE 1–24.
 *    CURRICULUM.md §3 Strand B lists 24 points and NONE of them is register or
 *    audience: REQUIREMENTS.md:229 maps T-G9 to "Strand A register labels", not
 *    to a Strand B number. Squatting on 21 (discourse markers) or 23 (hedging)
 *    would collide with points §3 already names, so `syllabusNumber: 25` is the
 *    first slot past the authored syllabus and this is a REPORTED curriculum gap,
 *    not an invented point. `everyday` because the choice this point teaches only
 *    exists for a learner who can already produce both wordings, and because
 *    nothing else in the syllabus lists it as a prerequisite. That it is a
 *    priority-`S` row is not an argument for `foundation`: tier governs
 *    SEQUENCING, while a learner who logs `gram.register-indian` today is sent
 *    here today by the drill button, at any level. `prerequisites` is one entry
 *    and advisory, as everywhere else.
 *
 * NO MISSING CATEGORY. Every `logAs` in this file is an existing id in
 * `js/core/mistakes.js`: `gram.register-indian` (the lesson default and most
 * per-option destination), plus `gram.stative-progressive` for *I am having a
 * doubt*, `gram.subject-verb-agreement` for *my only doubts is*, and
 * `gram.preposition-transfer` for *revert back*, which is the same redundancy
 * data/grammar/prepositions.js teaches in *return back*. Do not invent an id:
 * that file owns the taxonomy and an unknown id lands everything in
 * 'general.uncategorised'.
 * =============================================================================
 */

const GRAMMAR_REGISTER = {
    id: "register",
    syllabusNumber: 25,
    tier: "everyday",
    cefr: "B1",
    title: "Writing for a reader outside India: which words travel and which do not",

    srsType: "gram",
    srsRef: "register",
    srsKey: "gram:register",
    mistakeCategory: "gram.register-indian",

    prerequisites: ["question-formation"],

    rule: "Nothing on this page is bad English — these are all standard Indian English. Before you change a word, ask who is reading it: if the wording only marks you as Indian (*out of station*, *kindly*), leave it alone; change it only when the word means something else outside India (*doubt*, *revert*, *passed out*), because then the reader hears a different message and neither of you finds out.",

    explain: "Indian English is a variety of English with more speakers than British English, and the wordings in this lesson are correct in it. So this point is not about right and wrong words. It is about one reader at a time, and it sorts every item into three groups. Group one costs you the message: *doubt* means disbelief outside India, so *I have a doubt* is heard as *I am not sure I believe you* — the listener does not know you were asking a question. Group two costs you nothing at all: *out of station*, *kindly*, *cousin brother* are understood or easily guessed, and they mark the writing as Indian, which is not a problem and needs no fixing. Group three is fine everywhere and learners get corrected on it anyway. Only group one is worth spending effort on.",

    decide: [
        "Who is reading this? Someone in India, or someone outside it? If the reader is your own team, stop here — nothing needs changing.",
        "For a reader outside India: does any word I used mean something ELSE there? *doubt*, *revert*, *pass out*, *intimate* do. Swap those.",
        "Does the reader simply not have the word — *prepone*, *out of station*? That is a much smaller problem: they will ask. Swap it if it is easy, keep it if it is not.",
        "Have I actually said what I want done? *Do the needful* fails for a reader who does not know your process — but so does *please do what's needed*, so the fix is naming the action, not sounding less Indian.",
        "Check the other direction too: *I want you to send it* is a register mistake as well, and a blunter one than anything in this lesson."
    ],

    whyItMatters: "Most of your English writing is read by people in India, and for them this lesson has nothing to change. It matters for the small share that goes elsewhere — a client, a visa form, a CV — and mostly for four or five words that exist in both varieties with different meanings. Those fail silently: nobody asks, because nobody knows anything was missed. *I have a doubt about the timeline* reads as distrust of the person who wrote the timeline, which is an expensive thing to say by accident.",

    notice: {
        lines: [
            { speaker: "You → your team lead, Chennai", text: "Sir, I'll be **out of station** Thursday. Will dial into standup." },
            { speaker: "Team lead", text: "Fine. **Kindly** update the tracker before you go." },
            { speaker: "You → client, Chicago", text: "I'll be **away** on Thursday, but I'll join the standup." },
            { speaker: "Client", text: "No problem. One thing — is the vendor date realistic?" },
            { speaker: "You", text: "**I have a question** about that myself. And honestly, **I doubt** they can do two weeks." },
            { speaker: "Client", text: "That's useful. Let's not promise it, then." }
        ],
        question: "The first line and the third say the same thing in different words. Which of the two wordings is wrong?",
        answer: "Neither. *Out of station* and *kindly* are ordinary English between colleagues in India, and *away* is what a reader in Chicago has heard all their life — the difference is who reads it fastest, not correctness, and nobody has to change how they write to their own team. The line worth studying is the fifth: it uses *question* and *doubt* in the same breath, doing two different jobs. *I have a question* asks for information. *I doubt they can do two weeks* says you do not believe them. Outside India only the second meaning of *doubt* exists, so a question announced as a doubt arrives as distrust."
    },

    contrast: [
        {
            pair: [
                {
                    text: "I have a doubt about the vendor's timeline.",
                    means: "To a reader outside India: I am not convinced by that timeline. A statement of disbelief."
                },
                {
                    text: "I have a question about the vendor's timeline.",
                    means: "I want information about it. A request, and the thing an Indian speaker usually means by the first sentence."
                }
            ],
            takeaway: "Both are correct English and they say opposite things — one doubts the writer, one asks them something. That is the whole reason this swap is worth making: not that *doubt* is bad English, but that outside India the sentence you meant is the second one."
        },
        {
            pair: [
                {
                    text: "I'll be out of station on Thursday.",
                    means: "Standard Indian English: away from your usual place of work, generally out of the city. An Indian colleague reads it instantly."
                },
                {
                    text: "I'll be away on Thursday.",
                    means: "The same message in words every English reader has. Slightly vaguer — *away* does not say you have left town."
                }
            ],
            takeaway: "Both are correct, and the second one actually carries less information. This pair belongs to the group where there is nothing to fix: use the first with your own colleagues, and the second if you happen to be writing abroad and want it read without a pause."
        },
        {
            pair: [
                {
                    text: "He's my cousin brother.",
                    means: "Indian English: a male cousin — and for many speakers, a cousin close enough to count as a brother."
                },
                {
                    text: "He's my cousin.",
                    means: "Understood everywhere, and says less: no sex, no age, no side of the family."
                }
            ],
            takeaway: "English is the variety that is short of a word here, not Indian English. *Cousin* throws away three things Telugu marks routinely, and *cousin brother* puts one of them back. Use the second where a form or a stranger needs a category they recognise; the first is not a mistake being corrected."
        }
    ],

    spokenNote: "In speech these words carry no accent risk — they are word choices, not sounds — so the only thing to practise is the swap itself, fast enough that it happens mid-sentence. Two are worth drilling as fixed chunks because they come up in every first conversation with a foreign colleague: *I have a question* (never *a doubt*) and *I graduated in 2019* (never *I passed out*). One spoken habit does matter: *only* placed after the thing it emphasises — *I came yesterday only* — is standard Indian English and completely clear in India; a listener elsewhere will try to attach it to the word before it and briefly hear *nothing but yesterday*.",

    caveats: [
        "The whole lesson in one line: three groups, and only one of them has a cost. **Costs you the message** — *doubt*, *revert*, *pass out*, *intimate*: the word exists elsewhere with another meaning, so the reader is confidently wrong and never asks. **Costs you nothing** — *out of station*, *kindly*, *cousin brother*, *do the needful*, *prepone*: understood, guessable, or asked about, and they mark the writing as Indian, which is not a defect. **Fine everywhere, and corrected anyway** — *Shall I…?*, *Do let me know*, *Please find attached*, *Convey my regards*. Spend your attention on the first group.",
        "*Kindly* is not an Indianism to be removed. It is standard formal English, it appears in British legal and official letters, and it is understood everywhere. It reads formal rather than friendly, which is exactly what you want in a letter to a landlord and not what you want in a message to a colleague you like — that is a choice about tone, and *please* is not more correct than it.",
        "Several of these are not Indian in origin at all: *do the needful*, *the same*, *kindly*, *intimate* are Victorian British officialese that Indian English kept and British English dropped. So when a British reader finds them old-fashioned, they are meeting their own grandparents' writing.",
        "*Prepone* is better built than most English words — *pre-* against *post-*, exactly the pattern the language already uses — and it fills a real gap, since English needs three words (*bring it forward*) for a thing that happens constantly. It has simply not travelled yet. With your own team it is the better word; the only problem is a reader who has never heard it, and that reader will ask.",
        "Register runs in both directions, and the direction nobody warns Indian learners about is bluntness. *I want you to send it today*, *You must reply by Friday* are clear, grammatical, and considerably more damaging with a stranger than any word in this lesson. If you are unsure, err formal — you will sound old-fashioned, which costs nothing.",
        "None of this applies to how you speak with other Indian speakers of English, which for most learners is almost all of their English. Changing your wording for a reader in Boston does not mean the Boston wording is better; it means one reader is missing some information, and you are supplying it."
    ],

    commonErrors: [
        {
            heard: "Sir, I have a doubt in this topic.",
            fix: "Sir, I have a question about this topic.",
            why: "Outside India *doubt* means disbelief, so this arrives as *I am not sure I believe this*. The word is right inside India and in Telugu — *sandēham* covers both asking and disbelieving — but English splits the two, and only one of the two meanings travels. (*In this topic* → *about this topic* as well.)",
            l1: "T-G9"
        },
        {
            heard: "Please revert on the same at the earliest.",
            fix: "Could you reply by Thursday morning?",
            why: "Three unknowns for a reader outside India: *revert* means go back to a previous state there, *the same* names nothing they can identify, and *at the earliest* sets no date. Perfectly ordinary Indian business English; just three guesses for someone who cannot make them.",
            l1: "T-G9"
        },
        {
            heard: "I passed out from college in 2019.",
            fix: "I graduated in 2019.",
            why: "The most expensive one on this list, because it is usually on a CV. *Pass out* means faint everywhere outside India, and the reader does not stop to wonder — they read it, believe it, and move on.",
            l1: "T-G9"
        },
        {
            heard: "Can we prepone the call to 11?",
            fix: "Can we move the call up to 11? / bring the call forward to 11?",
            why: "Not an error — a word your reader may not have. Keep it with your own team, where it is shorter and clearer than the alternatives. Swap it only for someone who has never seen it, and note that they will ask rather than misunderstand.",
            l1: "T-G9"
        },
        {
            heard: "What is your good name?",
            fix: "Sorry — what's your name? / May I know your name?",
            why: "Understood everywhere; it is the politeness of *śubh nām* / a respectful Telugu form carried across, and it reads as very formal rather than wrong. If you want the warmth back, *May I know your name?* does the same job internationally.",
            l1: "T-G9"
        },
        {
            heard: "Please do the needful.",
            fix: "Could you resend the invoice with PO 4471 on it?",
            why: "Ordinary Indian business English, and your colleagues act on it because they know what the needful is. A reader who does not know your process cannot act on it — and *please do what's needed* fails identically, which shows the missing thing is the instruction, not the Indianness.",
            l1: "T-G9"
        }
    ],

    practice: [
        {
            id: "register-p1",
            mode: "gap",
            focus: "doubt-for-question-with-a-reader-outside-india",
            prompt: "Video call with a client in Chicago you have never met. You did not follow one slide and you want it explained. \"Sorry — before we move on, ___ about the timeline on slide four.\"",
            options: ["I have a question", "I have a doubt", "I am having a doubt", "I have a small doubt"],
            accept: [
                { answer: "I have a question", means: "Asks for information, and only that. This reader has one meaning for *doubt* and it is not this one." }
            ],
            feedback: [
                {
                    forAnswer: "I have a doubt",
                    reason: "Standard Indian English, and inside India nobody would blink. To this reader *doubt* means disbelief, so the sentence says you are not convinced by his timeline — and he will not ask, because he thinks he understood you.",
                    contrast: [
                        "I have a question about the timeline on slide four.",
                        "I have a doubt about the timeline — I don't think two weeks is realistic."
                    ],
                    retryCue: "You want the slide explained. Which word asks for information rather than announcing disbelief?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "doubt-for-question"
                },
                {
                    forAnswer: "I am having a doubt",
                    reason: "Two things: *doubt* reads as disbelief to this reader, and *have* here is a state, so it does not take *-ing* — *I have*, not *I am having*.",
                    contrast: [
                        "I have a question about slide four.",
                        "I'm having trouble with the file — that one is a real activity."
                    ],
                    retryCue: "Is *have* something you do, or something that is true of you? And which noun asks for information?",
                    grammaticalButDifferent: false,
                    logAs: "gram.stative-progressive",
                    errorKind: "stative-have-in-progressive-plus-doubt"
                },
                {
                    forAnswer: "I have a small doubt",
                    reason: "*Small* is doing polite work here, and to this reader it makes things worse rather than better: it turns the sentence into mild, politely-worded scepticism instead of removing the scepticism.",
                    contrast: [
                        "I have a quick question about slide four.",
                        "I have a small doubt about the vendor — nothing serious, but I'd check."
                    ],
                    retryCue: "Softening the word does not change what it means to him. Change the noun, and keep the softener if you like: *a quick question*.",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "softened-doubt-for-question"
                }
            ],
            fallbackFeedback: {
                reason: "This reader has one meaning for *doubt*, and it is disbelief. You are asking for information, so the noun is *question* — or *a quick question*, or simply *could I ask about slide four?*",
                contrast: [
                    "I have a question about the timeline on slide four.",
                    "I have a doubt about the timeline on slide four."
                ],
                retryCue: "Name what you are doing: asking. Which of these nouns means a thing you ask?"
            },
            alsoNotice: "With your own team, *doubt* stays. This is not a word you delete from your English — it is a word you switch when the reader changes, and the next item is a sentence where *doubt* is the only right answer."
        },
        {
            id: "register-p2",
            mode: "gap",
            focus: "the-same-word-graded-the-other-way-doubt-is-correct-here",
            prompt: "Same client, an hour later. The vendor has promised delivery in two weeks; they have missed that date twice before and you do not believe them. You are not asking anything — you have the dates in front of you. \"The plan looks good. My only ___ is the two-week delivery date, and I'd rather we didn't promise it to your board.\"",
            options: ["doubt", "question", "clarification", "doubts"],
            accept: [
                { answer: "doubt", means: "Exactly right, and to exactly this reader: a doubt is a thing you do not believe, which is what you have here." }
            ],
            feedback: [
                {
                    forAnswer: "question",
                    reason: "The word from the last item, and here it is the wrong one — you are not asking for information, you have it and you disbelieve it. English speakers do sometimes hedge disagreement as a question, but that shape needs *whether*: *my only question is whether they can hit two weeks*.",
                    contrast: [
                        "My only doubt is the two-week delivery date.",
                        "My only question is whether they've built in any slack."
                    ],
                    retryCue: "Are you asking him something, or telling him what you believe? Pick the noun for the second.",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "question-where-disbelief-is-meant"
                },
                {
                    forAnswer: "clarification",
                    reason: "*I have one clarification* is common Indian business English for *I have one question*, but a clarification is something you give, not something you have — and in any case you are not asking here.",
                    contrast: [
                        "My only doubt is the two-week delivery date.",
                        "Thanks for the clarification — that answers it."
                    ],
                    retryCue: "Who gives a clarification, you or him? And are you asking at all in this sentence?",
                    grammaticalButDifferent: false,
                    logAs: "gram.register-indian",
                    errorKind: "clarification-for-question"
                },
                {
                    forAnswer: "doubts",
                    reason: "The right word, in the wrong number: *my only doubts* would need *are*, and *only* here means there is exactly one. Singular subject, singular verb — *my only doubt is*.",
                    contrast: [
                        "My only doubt is the two-week delivery date.",
                        "My doubts are all about the vendor, not the plan."
                    ],
                    retryCue: "The sentence already says *is*. How many doubts does that allow?",
                    grammaticalButDifferent: false,
                    logAs: "gram.subject-verb-agreement",
                    errorKind: "plural-noun-with-singular-verb"
                }
            ],
            fallbackFeedback: {
                reason: "You are stating something you do not believe, so *doubt* is the word — the same word that was wrong in the last item, right here, with the same reader. *Concern* and *reservation* are equally correct and equally professional, and *worry* is fine in speech.",
                contrast: [
                    "My only doubt is the two-week delivery date.",
                    "My only question is whether they've built in any slack."
                ],
                retryCue: "Which noun names a thing you do not believe, rather than a thing you want to know?"
            },
            alsoNotice: "Put the two items side by side and the rule stops being a list of forbidden words: *doubt* was wrong in the first one and is the only right answer here, because what changed was the message, not the vocabulary."
        },
        {
            id: "register-p3",
            mode: "gap",
            focus: "revert-and-intimate-mean-something-else-outside-india",
            prompt: "Email to a client in Boston. You need a day to check something with your team. \"Thanks for the details — let me check with the team and ___ tomorrow.\"",
            options: ["get back to you", "revert to you", "revert back", "intimate you"],
            accept: [
                { answer: "get back to you", means: "The ordinary business phrase for this everywhere, and it says the two things the reader needs: you will reply, and when." }
            ],
            feedback: [
                {
                    forAnswer: "revert to you",
                    reason: "This is ordinary Indian business English and it is what half the email in the country says. Outside India *revert* means go back to an earlier state — *revert to the old version* — so the sentence reads as though something is being changed back, and the reader is left guessing what.",
                    contrast: [
                        "Let me check with the team and get back to you tomorrow.",
                        "If the new layout causes problems, we'll revert to the old one."
                    ],
                    retryCue: "To this reader, *revert* is about undoing, not replying. Which phrase says *I will reply*?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "revert-for-reply"
                },
                {
                    forAnswer: "revert back",
                    reason: "Same word, plus one more: *back* is already inside *revert* (*re-* is the going back), so even in the Indian sense it repeats itself — the same pattern as *return back* and *discuss about*.",
                    contrast: [
                        "Let me check with the team and get back to you tomorrow.",
                        "We'll revert to the old layout if this one causes problems."
                    ],
                    retryCue: "Two problems here. Which word already contains *back*, and which phrase actually means *reply*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.preposition-transfer",
                    errorKind: "redundant-back-after-revert"
                },
                {
                    forAnswer: "intimate you",
                    reason: "*Intimate* as a verb belongs to Indian official writing — notices, circulars, government letters — and it is correct there. To this reader the word is almost only an adjective about closeness, so *I'll intimate you tomorrow* lands somewhere between baffling and unfortunate.",
                    contrast: [
                        "Let me check with the team and get back to you tomorrow.",
                        "The office will intimate all candidates by post — Indian official register, where it is at home."
                    ],
                    retryCue: "Save this one for a circular. What is the plain phrase for *I will tell you*?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "official-register-verb-intimate"
                }
            ],
            fallbackFeedback: {
                reason: "The reader needs to know you will reply and when. *Get back to you* is the standard phrase; *reply*, *let you know* and *come back to you* are all equally correct. What does not work with this reader is *revert*, which means undo there.",
                contrast: [
                    "Let me check with the team and get back to you tomorrow.",
                    "Let me check with the team and revert to you tomorrow."
                ],
                retryCue: "Say it as plainly as you can: you will do what, tomorrow?"
            },
            alsoNotice: "Adding the day is worth more than the word choice. *I'll get back to you tomorrow* answers the question the client actually has, and *at the earliest* — standard here, understood there — answers it with no date in it."
        },
        {
            id: "register-p4",
            mode: "gap",
            focus: "an-indian-marked-word-is-the-right-answer-because-of-who-reads-it",
            prompt: "A formal letter to your landlord in Hyderabad about your deposit. You have never met him, he is thirty years older than you, this is your first and friendly request, and you would like the money without a fight. \"___ transfer the deposit to the account below by the 10th.\"",
            options: ["Kindly", "I want you to", "You must", "Do the needful and"],
            accept: [
                { answer: "Kindly", means: "Standard formal English, understood everywhere, and pitched exactly right for a stranger much older than you in a letter about money." }
            ],
            feedback: [
                {
                    forAnswer: "I want you to",
                    reason: "Grammatical, clear, and far more damaging than anything this lesson is usually accused of. It reports what you want rather than asking him for it, which with a stranger this much older reads as a demand.",
                    contrast: [
                        "Kindly transfer the deposit to the account below by the 10th.",
                        "I want you to transfer the deposit by the 10th."
                    ],
                    retryCue: "You are asking a favour of a stranger you want on your side. Which opening asks rather than instructs?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "too-direct-for-the-reader"
                },
                {
                    forAnswer: "You must",
                    reason: "This is the second letter, not the first. *You must* asserts an obligation, which is what you would write after being ignored twice — here it starts the fight you said you did not want.",
                    contrast: [
                        "Kindly transfer the deposit to the account below by the 10th.",
                        "As agreed in writing, you must transfer the deposit by the 10th — this is my third request."
                    ],
                    retryCue: "Nothing has gone wrong yet. Which opening keeps it friendly?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "obligation-instead-of-request"
                },
                {
                    forAnswer: "Do the needful and",
                    reason: "The phrase is fine English in Indian business use, and this reader knows it perfectly well. The trouble is that it duplicates the sentence it is attached to: the needful IS transferring the deposit, and you go on to say so.",
                    contrast: [
                        "Kindly transfer the deposit to the account below by the 10th.",
                        "The lease has ended; kindly do the needful. — where you have not named the action at all."
                    ],
                    retryCue: "You already say what you want done. What does the phrase add?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "needful-duplicating-a-named-action"
                }
            ],
            fallbackFeedback: {
                reason: "The reader is a stranger much older than you and you want a favour, so a formal request opens it: *Kindly transfer…*. *Please transfer* and *Could you please transfer* are just as correct — *kindly* is not better English than *please*, only more formal. The two openings that do not work are the blunt ones.",
                contrast: [
                    "Kindly transfer the deposit to the account below by the 10th.",
                    "You must transfer the deposit by the 10th."
                ],
                retryCue: "Formal request, not instruction. Which of the four asks?"
            },
            alsoNotice: "This is the item to remember when someone tells you to strike *kindly* out of your English. It is standard, it is formal, and formal is what this letter needed. In a message to a colleague you like, the same word is merely stiff — a tone choice, not a correction."
        },
        {
            id: "register-p5",
            mode: "gap",
            focus: "a-word-the-reader-does-not-have-versus-a-word-they-will-misread",
            prompt: "Email to a partner in Toronto who has never worked with an Indian team. Thursday's call is at 4 p.m. and you need it at 11 a.m. instead. \"Would it be possible to ___?\"",
            options: [
                "move Thursday's call up to 11 a.m.",
                "prepone Thursday's call to 11 a.m.",
                "postpone Thursday's call to 11 a.m.",
                "prepone Thursday's call by five hours"
            ],
            accept: [
                { answer: "move Thursday's call up to 11 a.m.", means: "Words this reader has, and a time that removes any doubt about direction. In British usage *bring forward* does the same job." }
            ],
            feedback: [
                {
                    forAnswer: "prepone Thursday's call to 11 a.m.",
                    reason: "The cheapest failure in this lesson, and the word deserves better: *prepone* is built exactly as English builds words and fills a gap English fills with three. This reader has simply never met it — so they will write back and ask, which costs one email and no misunderstanding.",
                    contrast: [
                        "Would it be possible to move Thursday's call up to 11 a.m.?",
                        "Can we prepone Thursday's call to 11? — to your own team, the better sentence of the two."
                    ],
                    retryCue: "Nothing is wrong with the word; this reader just does not have it. Which option uses words they do?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "prepone-with-a-reader-who-lacks-the-word"
                },
                {
                    forAnswer: "postpone Thursday's call to 11 a.m.",
                    reason: "The dangerous option, and note why: every word in it is one the reader knows, so nothing prompts them to ask. *Postpone* means later, 11 a.m. is earlier, and the sentence contradicts itself — a reader outside India is more likely to trust *postpone* and put you at 11 p.m. or next week.",
                    contrast: [
                        "Would it be possible to move Thursday's call up to 11 a.m.?",
                        "Would it be possible to postpone Thursday's call to Friday?"
                    ],
                    retryCue: "Is 11 a.m. earlier or later than 4 p.m.? Now which verb matches that direction?",
                    grammaticalButDifferent: false,
                    logAs: "gram.register-indian",
                    errorKind: "postpone-for-an-earlier-time"
                },
                {
                    forAnswer: "prepone Thursday's call by five hours",
                    reason: "Two guesses for one reader: the word they have not met, and *by five hours*, which does not say in which direction the five hours go. Naming the new time instead removes the second problem in any variety of English.",
                    contrast: [
                        "Would it be possible to move Thursday's call up to 11 a.m.?",
                        "Would it be possible to push Thursday's call back by an hour?"
                    ],
                    retryCue: "Give the reader the time, not the size of the change. Which option names 11 a.m. in words they have?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "unknown-word-plus-unspecified-direction"
                }
            ],
            fallbackFeedback: {
                reason: "This reader needs the new time in words they already have. *Move it up to 11 a.m.*, *bring it forward to 11 a.m.* and *reschedule it to 11 a.m.* are all correct; *prepone* is a good word they have not met, and *postpone* means the opposite of what you want.",
                contrast: [
                    "Would it be possible to move Thursday's call up to 11 a.m.?",
                    "Would it be possible to prepone Thursday's call to 11 a.m.?"
                ],
                retryCue: "Earlier, not later — and in words a Canadian reader has heard before."
            },
            alsoNotice: "Rank the two failures honestly. A word the reader lacks produces a question; a word they know with the wrong meaning produces a diary entry at the wrong time. *Prepone* is the safer mistake, and *postpone* here is the real one."
        },
        {
            id: "register-p6",
            mode: "gap",
            focus: "naming-the-action-rather-than-sounding-less-indian",
            prompt: "A contractor in Warsaw, second week. Last week they asked what a PO number was. Their invoice carries March's PO number instead of this month's, 4471. \"Thanks for this — the PO on the invoice is March's. Could you ___?\"",
            options: [
                "resend it with PO 4471 on it",
                "do the needful",
                "kindly do the needful",
                "please do what's needed"
            ],
            accept: [
                { answer: "resend it with PO 4471 on it", means: "Names the action and the number, so a reader who has not learnt your process can act today without another email." }
            ],
            feedback: [
                {
                    forAnswer: "do the needful",
                    reason: "This is ordinary Indian business English and your own colleagues would act on it at once, because they know what the needful is. This reader has been here a week and does not — so what is missing is the instruction, not the Englishness. Look at the fourth option: it is not Indian at all and it fails in exactly the same way.",
                    contrast: [
                        "Could you resend it with PO 4471 on it?",
                        "Could you do the needful? — to a colleague who has raised fifty of these invoices."
                    ],
                    retryCue: "Ask what this reader can do after reading your sentence. Which option tells them?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "needful-with-a-reader-who-lacks-the-process"
                },
                {
                    forAnswer: "kindly do the needful",
                    reason: "*Kindly* is not the problem — it is standard formal English and understood everywhere. It is the same request as the option above with politeness added, and politeness was never what was missing: the reader still does not know that a corrected invoice with PO 4471 is what you want.",
                    contrast: [
                        "Could you resend it with PO 4471 on it?",
                        "Kindly transfer the deposit by the 10th — where *kindly* is doing exactly the job it should."
                    ],
                    retryCue: "Keep *kindly* if you like it. What has to be added before the reader can act?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "politeness-added-where-the-action-is-missing"
                },
                {
                    forAnswer: "please do what's needed",
                    reason: "This is the important wrong answer, because there is nothing Indian in it and it is just as unusable. Plain English, polite, and it still does not say which invoice, which number, or what to do — which proves the fault in the other two was vagueness, not variety.",
                    contrast: [
                        "Could you resend it with PO 4471 on it?",
                        "Please do what's needed and let me know once it's done."
                    ],
                    retryCue: "Translating *the needful* into plain words changed nothing. What information does the reader still not have?",
                    grammaticalButDifferent: true,
                    logAs: "gram.register-indian",
                    errorKind: "vague-request-in-plain-english"
                }
            ],
            fallbackFeedback: {
                reason: "A reader who does not know your process needs the action and the detail: *resend it with PO 4471 on it*. *Could you reissue the invoice against PO 4471?* and *Could you correct the PO to 4471 and resend?* are just as good. Every option that leaves the action unnamed fails here, whether it is phrased in Indian English or not.",
                contrast: [
                    "Could you resend it with PO 4471 on it?",
                    "Could you do the needful?"
                ],
                retryCue: "One sentence, one action, one number. Which option has all three?"
            },
            alsoNotice: "This is worth doing with your Indian colleagues too, for a different reason: *do the needful* works when both of you know the process, and every new person on the team is someone who does not yet."
        }
    ],

    produce: {
        id: "register-produce",
        task: "Take one real message you sent this week and say it aloud twice: once as you would to your own team, once as you would to a client abroad. Change only what has to change. Then say out loud which of your own wordings you are keeping either way, and why.",
        targetSeconds: 90,
        useLanguage: [
            "I have a question about… — the swap that matters most, said as one chunk",
            "I'll get back to you by Thursday — a reply and a date, not *revert* and *at the earliest*",
            "Could you resend it with… on it? — the action named",
            "I'm keeping *kindly* / *out of station* here, because… — the group that needs no fixing, said out loud"
        ],
        selfCheck: [
            "Did the version for my own team stay as it was, or did I change things that did not need changing?",
            "In the version for abroad, did I catch the words that mean something else there — *doubt*, *revert*, *passed out*?",
            "Did I say what I actually want done, with a date on it?",
            "Did I check the other direction — is anything in either version blunter than I meant?"
        ],
        model: {
            text: "To my team: Sir, I'll be out of station Thursday, kindly update the tracker before EOD. — To the client: Hi Dan, I'll be away on Thursday but I'll join the standup. Two things. I have a question about the timeline on slide four — I didn't follow the dependency. And my only doubt about the two-week delivery is that this vendor has missed it twice, so I'd rather we didn't promise it to your board. Let me check with the team and get back to you tomorrow morning.",
            note: "Read it once, then do your own message without looking. Notice what the two versions share: both are polite, both name the action, and the first was not corrected into the second — they are two right versions of one message, for two readers."
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            transferId: "T-G9",
            priority: "S",
            note: "This point is not Telugu interference in the way the others are — nothing here is a wrong structure carried over from Telugu. Two of the items do come straight from Telugu, and neither is careless. *Sandēham* covers both *I want to ask something* and *I am not convinced*, so a speaker moving into English reaches for the one English word that translates it — *doubt* — without any reason to suspect that English keeps the two meanings in separate words. And Telugu kinship is precise where English is crude: *annayya* and *tammuḍu* separate elder from younger brother, and cousins are named by which side of the family they come from, so *cousin* looks like a word with information missing, and *cousin brother* puts some of it back. The rest of the list is not Telugu at all: *do the needful*, *kindly*, *intimate*, *the same* and *out of station* are nineteenth-century British official English that Indian English kept and British English dropped, and *prepone* is a word Indian English built correctly out of the pieces English supplies. So the accurate description of T-G9 is not interference and not error; it is a vocabulary that is standard for a billion-odd readers and unfamiliar to the rest, and the only decision it asks of you is who you are writing to.",
            bridge: "Two questions, in order, and only when you are writing outside India. First: who reads this? If the answer is your own team, your family, anyone in India — you are done, change nothing. Second, and only for the others: does any word I used already mean something else there? Learn the short list, because it is short — *doubt* (disbelief), *revert* (undo), *pass out* (faint), *intimate* (close). Those four are worth the effort, because they fail without a sound: the reader is sure they understood you. Everything else on the list — *out of station*, *kindly*, *cousin brother*, *do the needful*, *prepone* — is either understood or asked about, so the cost of keeping it is one question and the cost of changing it is nothing. Decide those on taste, not on correctness."
        }
    },

    review: {
        rulePrompt: "One line before you start: none of these wordings is wrong — decide by reader. If the word only marks you as Indian, keep it; if it already means something else outside India (*doubt*, *revert*, *passed out*), swap it, because that reader will never tell you they misread it.",
        itemIds: ["register-p1", "register-p4", "register-p6"]
    },

    tags: ["register", "audience", "indian-english", "business-writing", "email", "word-choice", "politeness", "T-G9", "high-frequency"]
};

// Match the js/core/* pattern: a lexical global for the browser, CommonJS for
// the Jest suite. `module` is undefined in a classic script, so this is inert
// there.
if (typeof module !== "undefined" && module.exports) {
    module.exports = { GRAMMAR_REGISTER: GRAMMAR_REGISTER };
}

// Self-registration, exactly as data/grammar/question-formation.js does it.
// `grammarLessons` in data/grammar.js is a top-level `const`, i.e. a lexical
// global, so a classic script loaded AFTER it can read the binding by bare name
// and push into the tier array. The guards make a script-order mistake a no-op
// rather than a page-load throw, and make a second push impossible.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.everyday) &&
    !grammarLessons.everyday.some(function (p) { return p && p.id === GRAMMAR_REGISTER.id; })) {
    grammarLessons.everyday.push(GRAMMAR_REGISTER);
}
