/**
 * Grammar point 9 — present perfect vs past simple.
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `GRAMMAR_PRESENT_PERFECT`. Same schema, field for field, as the `articles`
 * point in data/grammar.js — read that file's header comment for what each
 * field is for. Nothing is added to the schema here and nothing is left out.
 *
 * CURRICULUM.md §3 Strand B point 9 ("the hardest contrast for most learners");
 * T-G6 in REQUIREMENTS.md §3.2 ("have gone" where English needs "went").
 *
 * ⚠️ TIER — this point registers into `grammarLessons.everyday`, NOT
 * `foundation`. It is the first everyday-tier content in the app. Before it,
 * every authored grammar point was `foundation`, so a learner who chose
 * Everyday or Confident got no grammar step and no speaking step at all and the
 * session planner reported `meetsFrSes1: false` (BR-2 unreachable above
 * foundation). CURRICULUM.md §2.2 puts this tier at B1, so the sentences here
 * are longer and more clausal than the foundation points on purpose.
 *
 * ⚠️ WHAT THIS POINT DOES NOT TEACH
 * It never says "use the present perfect for recent things". That rule is false
 * and it is the direct cause of the error this point exists to fix: *last week*
 * is recent and still cannot take *have seen*. What is taught throughout is
 * whether the time frame is FINISHED — a closed frame takes the past simple
 * however recent it is, an open frame that runs up to now takes the present
 * perfect however long ago it started. Every practice item, the noticing
 * exchange, all three contrasts and `alsoNotice` on p1 restate that and nothing
 * else. If you edit this file, do not reintroduce recency as the criterion.
 *
 * MISTAKE-CATEGORY NOTE
 * Every id used here already exists in js/core/mistakes.js — nothing is
 * missing and nothing new was invented:
 *   gram.present-perfect  T-G6, the lesson default. Its `drill.target` is
 *                         `present-perfect-vs-past-simple`, which is exactly
 *                         this point's `id`, so the drill route already lands
 *                         here with no change to that file.
 *   gram.verb-form        for a wrong participle inside a correctly chosen
 *                         tense — "have saw", "have finish", "have readed".
 *                         That row exists for precisely this ("I have saw it"),
 *                         and routing it to gram.present-perfect would tell a
 *                         learner who picked the right tense that their tense
 *                         was the problem.
 * The finer grain lives in `errorKind`, which is authoring data and is never
 * displayed.
 *
 * ⚠️ WHY `accept` HOLDS NO BARE SYNONYMS
 * Read app.js before widening an `accept` array here. Two facts about the live
 * renderer shape these lists:
 *
 *  1. A 'gap' item has no typed input — renderGrammarPracticeItem() builds one
 *     <button> per entry in `options` and nothing else. So an accepted answer
 *     that is not in `options` can never be submitted, and `fallbackFeedback` is
 *     currently reachable only when an option has no authored feedback entry.
 *     That is why every accepted answer here is also an option (US-166), and why
 *     `fallbackFeedback` is still written properly on all six items: it is the
 *     documented contract for typed input, and it must not degrade to a verdict
 *     on the day free text arrives.
 *  2. renderGrammarCorrect() prints a FIXED sentence when
 *     `showDifferenceOnCorrect` is set: "Both answers here are right, and they
 *     do not mean the same thing". That string is app.js's, not this file's, and
 *     it is why no `accept` array here lists a pure synonym or a contraction.
 *     Accepting *completed* beside *finished* on p4, or *haven't read* beside
 *     *have not read* on p5, would make the app assert a difference that does
 *     not exist and then hand the learner two `means` strings saying it does
 *     not. Every multi-answer item below differs by aspect (p2), variety (p5) or
 *     emphasis (p1) — a real difference the sentence can carry.
 *     The genuine near-equivalences are told the truth about where the
 *     methodology puts honest limits: in `caveats`.
 * =============================================================================
 */

const GRAMMAR_PRESENT_PERFECT = {
    id: "present-perfect-vs-past-simple",
    syllabusNumber: 9,
    tier: "everyday",
    cefr: "B1",
    title: "Is that time over? — \"I saw him\" vs \"I have seen him\"",

    srsType: "gram",
    srsRef: "present-perfect-vs-past-simple",
    srsKey: "gram:present-perfect-vs-past-simple",
    mistakeCategory: "gram.present-perfect",

    // Advisory only (nothing in the methodology gates grammar), and deliberately
    // short. `be` is listed because every form in this point is built on an
    // auxiliary and on the was/been pair, so a learner who is still dropping the
    // copula will get more out of that point first. The past simple point is not
    // listed: it is not authored yet, and naming an id that no tier array
    // contains would give an ordering pass a dangling edge to chase.
    prerequisites: ["be"],

    rule: "Use the past simple when the sentence names a time that is over — *yesterday*, *last week*, *in 2019* — and the present perfect when the period you mean is still open and runs up to now; the test is never how long ago it happened, only whether that period has closed.",

    explain: "English *have* + participle does not say that the action is finished — the action in *I have finished* is exactly as finished as the one in *I finished*. What it says is that the action sits inside a stretch of time that is still open, and that stretch always reaches the moment you are speaking. This is why a word like *yesterday* breaks it: *yesterday* draws a box round a piece of time and closes the lid, and nothing inside a closed box can also be inside a period that reaches now. Telugu marks whether the action itself is complete, and completeness sits perfectly happily next to *ninna* (yesterday) — so the Telugu form that feels like *have gone* takes a finished-time word with no friction at all, and *I have gone yesterday* is that habit working correctly on a language that happens to measure something else.",

    decide: [
        "Does the sentence name a time? If it does, ask one question about it and nothing else: is that time over? *Yesterday*, *last night*, *last week*, *in 2019*, *two hours ago*, *when I was at college* — all over, so all past simple.",
        "Is the named period still running? *Today*, *this week*, *this year*, *since Monday*, *in the last few days*, *so far*, *ever* — these reach right up to now, so use *have* or *has* + participle.",
        "If no time is named at all, ask what you are actually talking about: the fact that this has happened at some point up to now, or the occasion it happened on. Fact so far → *I have read it*. Occasion → *I read it on the train*.",
        "Fastest check of all: would *When?* be a sensible next question? If it would, you are talking about an occasion, and English simply will not let you say it with *have* — *When have you eaten?* is not a sentence. It has to be *When did you eat?*"
    ],

    whyItMatters: "Most of the time this costs you nothing at all: *I have gone yesterday* is understood everywhere in the world and hundreds of millions of people say it. Two things make it worth the work anyway. The first is that a listener from outside the region hears it immediately — after articles it is the feature that most marks your English as regional. The second is that in one very common case it changes what you said: *I worked there for five years* tells your interviewer you have left, and *I have worked there for five years* tells them you are still there, and that is not a thing you want the other person guessing about.",

    notice: {
        lines: [
            { speaker: "Colleague", text: "**Have** you **spoken** to Ravi about the deadline?" },
            { speaker: "You", text: "Yes — I **spoke** to him yesterday evening. He says Friday is fine." },
            { speaker: "Colleague", text: "Good. I **have** not **heard** anything from the client **since** Monday, though." }
        ],
        question: "The question was *have you spoken* and the answer came back *I spoke to him yesterday evening*. Same two people, same conversation, one verb — so what made it change shape?",
        answer: "The question and the answer are about different periods. *Have you spoken* asks about the whole stretch of time up to right now, which has not ended; the colleague does not care when it happened, only whether it has happened yet. The answer names the occasion — *yesterday evening* — and yesterday evening is over, so it takes the past simple. Notice what did *not* decide this: how recent it was. Yesterday evening is more recent than almost anything either of them will mention all day, and it still cannot take *have spoken*. What decided it is that the period named has closed. Then look at the last line: *since Monday* names a period that is still running, so the verb goes straight back to *have not heard*."
    },

    contrast: [
        {
            pair: [
                {
                    text: "I have worked at this company for six years.",
                    means: "Six years so far, and I am still there. The period started six years ago and has not closed — it runs up to this sentence."
                },
                {
                    text: "I worked at this company for six years.",
                    means: "Six years that are over. I have left. The listener will now assume you are somewhere else, and may ask where."
                }
            ],
            takeaway: "Both are correct, and the difference is not the six years — it is whether the six years have finished. This is the one case where getting it wrong genuinely misinforms somebody, which is why interviews are full of it."
        },
        {
            pair: [
                {
                    text: "Have you seen the new office?",
                    means: "At any point up to now — I am asking about the state of your knowledge today, not about a particular visit. *Not yet* is the natural answer."
                },
                {
                    text: "Did you see the new office?",
                    means: "On the occasion we both have in mind: when you went in on Tuesday, when the tour happened. I am asking about that visit."
                }
            ],
            takeaway: "Both are correct. The present perfect asks whether it has happened at all inside an open period; the past simple asks about one occasion inside a frame we have already closed between us. That is why the second one only works if we both know which visit is meant."
        },
        {
            pair: [
                {
                    text: "She has broken her arm.",
                    means: "It is broken now — there is a cast on it. The open period is her situation as it stands today, and that is what you are reporting."
                },
                {
                    text: "She broke her arm.",
                    means: "An event, told as a story. It may have healed years ago. The next question is naturally *When?* or *How?*"
                }
            ],
            takeaway: "Both are correct English about the same event. Present perfect keeps it inside a period that includes now, so it reports a situation; past simple puts it in a closed frame, so it reports an episode. Try *When?* after each one and you will hear which is which."
        }
    ],

    spokenNote: "In real speech the *have* nearly disappears. *I have* is /aɪv/, *you have* /juv/, *we have* /wiv/, and after a name or a noun *has* reduces to a bare /z/ or /s/ — *Ravi's finished* sounds exactly like *Ravi is finished*, and only the participle tells you which one you heard. That is why the participle is the part to make solid: say /aɪv siːn ɪm/ and nobody needs to hear the *have* at all, but *I've saw him* leaves the listener with nothing to hold on to. Questions reduce the other way round: *Have you eaten?* comes out as /əvjuˈiːtn/ or just /əjuˈiːtn/, which is why it is easy to hear it as *You eaten?* and miss the tense completely. Four pairs carry most conversations, and they are worth drilling out loud until they are automatic: *saw / seen*, *went / gone*, *did / done*, *was / been*.",

    caveats: [
        "British and American English genuinely split over *just*, *already* and *yet*. *Did you eat yet?*, *I just ate* and *I already told you* are standard American English; *Have you eaten yet?*, *I have just eaten* and *I have already told you* are what most British speakers say. Both are correct and this app marks neither wrong. If you learned English in India your instinct will usually match the British pattern, and that is fine — the American pattern is not an error to fix and not one you have to adopt.",
        "That variation is narrow, and it is worth knowing exactly where it stops. No variety of English allows the present perfect with a finished-time word: nobody in America or anywhere else says *I have seen him last week*. So *Did you eat yet?* being perfectly good American English does not make *I have eaten yesterday* good anything. The finished-frame rule is the part that does not vary.",
        "*Have you ever…* is the usual form for life experience, but *Did you ever…* is ordinary in American English and increasingly common everywhere. Note that the verb has to change with it, because *did* cannot carry a participle: *Have you ever been to Delhi?* or *Did you ever go to Delhi?*, never *Did you ever been*.",
        "Some periods close while you are still inside the day. At nine in the morning, *I have not had breakfast* — this morning is still going. At four in the afternoon, *I did not have breakfast* is what people say, because the morning is over even though today is not. The word *this morning* does not decide it; whether that morning has finished decides it.",
        "A frame can close with no time word in the sentence at all. *I saw him at the wedding* is past simple because the wedding is over — the event closed the frame, not an adverb. So do not go looking for a time expression before you choose; ask whether the period you have in mind has ended.",
        "*I have lived here for ten years* and *I have been living here for ten years* are both correct and mean very nearly the same thing. With *live*, *work*, *study*, *wait* and their like the two are interchangeable in practice; the continuous can hint that the situation is temporary or put the stretch of time more in view, but you will not be misunderstood either way and neither is marked wrong here.",
        "*I am working here since 2019* is ordinary Indian English, said and understood by hundreds of millions of people, and this point does not flag it because it is unclear. It flags it for two narrower reasons. It marks your English as regional, more than almost any other feature except articles. And outside the region it can genuinely mislead, because for those listeners the present continuous does not reach backwards at all, so what they hear is a sentence about this week with a date attached that does not fit. That is a smaller claim than \"this is wrong\", and it is the honest one.",
        "Two participles of *go* do different jobs, and this is the one place where the participle rather than the tense carries the meaning. *She has gone to the bank* means she is not here — she is still out. *She has been to the bank* means she went and came back."
    ],

    commonErrors: [
        {
            heard: "I have gone to Delhi last month.",
            fix: "I went to Delhi last month. / I have been to Delhi.",
            why: "*Last month* has closed, so the verb has to be *went*. Both fixes are good English and they say different things: the first is about that trip, the second is about your life so far, which is why it drops the time word altogether. Note also *been*, not *gone* — *I have gone to Delhi* would mean you are there right now.",
            l1: "T-G6"
        },
        {
            heard: "I have seen him last week.",
            fix: "I saw him last week. / I have seen him — a few days ago, actually.",
            why: "Run the *When?* test on this one. If your listener could sensibly reply *When?*, you are talking about an occasion and English needs the past simple. Here you have already answered *when* inside the sentence, which is the strongest possible sign that the frame is closed.",
            l1: "T-G6"
        },
        {
            heard: "I have completed my B.Tech in 2019.",
            fix: "I completed my B.Tech in 2019. / I have completed my B.Tech.",
            why: "A year is the most tightly closed frame there is — 2019 finished on a specific date. Drop the year and *I have completed my B.Tech* is perfect, because the open period is now your life up to today. This one matters because it is on your CV and in every interview.",
            l1: "T-G6"
        },
        {
            heard: "When have you come?",
            fix: "When did you come? / When did you get here?",
            why: "*When* asks for the occasion, and an occasion is by definition inside a frame that has closed — so *when* and *have* cannot share a clause in any variety of English. This is a useful one to notice, because the same block explains every other error on this list.",
            l1: "T-G6"
        },
        {
            heard: "I am working in this company since three years.",
            fix: "I have worked at this company for three years. / I have been working here for three years.",
            why: "Three things move together. *Since* names a starting point, so with a length of time you need *for*; the period runs up to now, so the verb needs *have*; and the present continuous cannot reach back into the past at all. Both fixes are correct and interchangeable here.",
            l1: "T-G6"
        },
        {
            heard: "I have joined this company in 2021 and I am here since then.",
            fix: "I joined this company in 2021 and I have been here ever since.",
            why: "The two halves need opposite tenses, and this sentence has them the wrong way round. *In 2021* is closed, so it takes *joined*; *ever since* is open and running, so it takes *have been*. One sentence can hold both tenses — it switches as often as its time frames do.",
            l1: "T-G6"
        }
    ],

    practice: [
        {
            id: "present-perfect-vs-past-simple-p1",
            mode: "gap",
            focus: "finished-time-word-takes-past-simple",
            prompt: "I ___ him last week, at the airport — we had about ten minutes before his flight.",
            options: ["saw", "have seen", "have saw", "was seeing"],
            accept: [
                { answer: "saw", means: "One occasion inside a frame that has closed. *Last week* shut the lid, so the past simple is the only tense available here." },
                { answer: "did see", means: "The same thing with emphasis on it — what you would say if someone had just told you he was abroad all week. The *did* is contradicting them, not changing the tense." }
            ],
            // Two right answers. "did see" is not among the options, but a learner
            // typing it is emphasising, not making an error (FR-GRM-5), and the
            // difference between the two is worth stating even on a correct first
            // answer.
            showDifferenceOnCorrect: true,
            spoken: "*I saw him* runs together as /aɪ ˈsɔː rɪm/ — the /h/ of *him* drops and the /r/ links it to *saw*. Compare *I've seen him* /aɪv ˈsiːn ɪm/: the vowel in the verb is the part your listener actually hears.",
            feedback: [
                {
                    forAnswer: "have seen",
                    reason: "*I have seen him* is a good sentence — right up until *last week* arrives. *Have seen* puts the meeting inside a period that is still running, and *last week* is a period that closed on Sunday, so the two cannot describe the same event. Take the time word out and your choice becomes correct; keep it, and the verb has to be *saw*.",
                    contrast: [
                        "I saw him last week, at the airport.",
                        "I have seen him — not for a while, but we are still in touch."
                    ],
                    retryCue: "Has the time I named finished? If it has, there is no open period for *have* to point at.",
                    grammaticalButDifferent: false,
                    logAs: "gram.present-perfect",
                    errorKind: "perfect-with-closed-time-frame"
                },
                {
                    forAnswer: "have saw",
                    reason: "Two separate things are going on, and one of them you nearly had. *Have* needs the participle, and the participle of *see* is *seen*, not *saw* — *saw* is the past simple and can never follow *have*. Fix the form and you get *I have seen*, which is still the wrong tense for *last week*, so the answer this sentence wants is the bare past simple on its own.",
                    contrast: [
                        "I saw him last week.",
                        "I have seen him twice this month."
                    ],
                    retryCue: "After *have*, which of the two forms goes there — *saw* or *seen*? And do I need *have* here at all?",
                    grammaticalButDifferent: false,
                    logAs: "gram.verb-form",
                    errorKind: "past-form-as-participle"
                },
                {
                    forAnswer: "was seeing",
                    reason: "*I was seeing him* is real English, but it means one of two other things: that you were in a relationship with him, or that something was going on around a meeting you have not finished describing. Neither fits a sentence that goes on to give you one occasion of about ten minutes at an airport. A single completed event in a closed frame takes the plain past simple.",
                    contrast: [
                        "I saw him last week, at the airport.",
                        "I was seeing him at the time, so I knew about the job before anyone else."
                    ],
                    retryCue: "Is this one complete event that started and finished, or a situation going on in the background?",
                    grammaticalButDifferent: true,
                    logAs: "gram.present-perfect",
                    errorKind: "progressive-for-simple-past"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about which form of *see* goes in front of *last week*. *Last week* is over, so the answer is the past simple — *saw*, or *did see* if you are emphasising it. Anything with *have* in it is claiming the period is still open, and it is not. If you reached for a different verb, *I met him last week* is good English and the same tense; if you wrote *seen* on its own, that is the participle with the *have* left out, and the participle cannot stand alone.",
                contrast: [
                    "I saw him last week, at the airport.",
                    "I have seen him, but I could not tell you when."
                ],
                retryCue: "Ask the one question: is *last week* over? Then pick the tense that goes with the answer."
            },
            alsoNotice: "*Last week* is not a long time ago. It is a matter of days — more recent than almost anything else you will talk about today. And it still cannot take *have seen*. That is the whole point of this lesson: what matters is that last week is finished, not that it is far away."
        },
        {
            id: "present-perfect-vs-past-simple-p2",
            mode: "gap",
            focus: "open-period-with-since-takes-the-present-perfect",
            prompt: "I ___ at the same company since 2019, and I am still enjoying it.",
            options: ["have worked", "have been working", "worked", "am working"],
            accept: [
                { answer: "have worked", means: "This puts the six years on the record as a fact about you: the period opened in 2019, it has not closed, and that is the whole claim. It is the plain form and the one to reach for if you are unsure." },
                { answer: "have been working", means: "This puts the stretch itself in view rather than the fact — the going-to-work, day after day, still going on. Some speakers also hear it as hinting that the arrangement is temporary, which the plain form does not." }
            ],
            // Both are correct and both are offered (US-166). They differ by
            // aspect, not by wording, which is what makes the flag honest here:
            // app.js prints "they do not mean the same thing" whenever it is set,
            // so a pair whose difference is nil must not go in an accept array.
            // How close these two actually are in practice is stated in
            // `caveats`, which is where the methodology puts honest limits.
            showDifferenceOnCorrect: true,
            spoken: "*I've worked* is /aɪv ˈwɜːkt/ — the /t/ at the end is the whole of the participle, and it is easy to swallow. *I've been working* /aɪv bɪn ˈwɜːkɪŋ/ gives you more syllables to land on, which is one reason people reach for it in speech.",
            feedback: [
                {
                    forAnswer: "worked",
                    reason: "*Since 2019* opens a period and leaves it open — it runs from that year to the moment you are speaking. The past simple can only go inside a frame that has closed, so it cannot sit next to *since* at all. The rest of the sentence agrees with that: *I am still enjoying it* says you have not left.",
                    contrast: [
                        "I have worked at the same company since 2019.",
                        "I worked at the same company for four years, and then I moved."
                    ],
                    retryCue: "Does *since 2019* stop anywhere, or does it reach right up to now? Which tense goes with a period that reaches now?",
                    grammaticalButDifferent: false,
                    logAs: "gram.present-perfect",
                    errorKind: "past-simple-with-open-period"
                },
                {
                    forAnswer: "am working",
                    reason: "This is the most common version of the sentence in Indian English and the meaning is completely clear, so nothing here is about being understood. The problem is reach: the present continuous only covers what is happening around now and cannot stretch back to 2019, so the *since* has nothing to attach to. *Have* is the word that reaches backwards — that is its whole job.",
                    contrast: [
                        "I have been working at the same company since 2019.",
                        "I am working from home this week because the office is being painted."
                    ],
                    retryCue: "How far back does *am working* reach? If I need the sentence to reach 2019, which auxiliary does that?",
                    grammaticalButDifferent: false,
                    logAs: "gram.present-perfect",
                    errorKind: "present-continuous-for-perfect"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about which form reaches back to 2019 and still arrives at today. *Have worked* and *have been working* both do it and both are correct here. The past simple cannot, because it needs a closed frame, and the present continuous cannot, because it does not reach that far back.",
                contrast: [
                    "I have worked at the same company since 2019.",
                    "I have been working at the same company since 2019."
                ],
                retryCue: "Which auxiliary connects a starting point in the past to right now?"
            },
            alsoNotice: "*Since* names a starting point and leaves the period open, so it always pulls *have*. *For* names a length and can go either way: *I have worked here for six years* means you are still here, *I worked there for six years* means you are not. This is also where *since three years* comes from — *since* wants a point, *for* wants a length."
        },
        {
            id: "present-perfect-vs-past-simple-p3",
            mode: "gap",
            focus: "life-experience-with-no-time-named",
            // The first line is doing real work: it plants the conversation
            // firmly in the present, so that "Had you ever been…?" — which needs
            // an earlier past moment to look back from — has nothing to attach
            // to and the answer set closes properly (authoring guide §3 rule 2).
            prompt: "\"We are thinking about Delhi for the holidays. ___ you ever been there?\" \"Yes — I went in 2018 for a wedding.\"",
            options: ["have", "did", "do", "had"],
            accept: [
                { answer: "have", means: "The question is about your whole life up to now, which is the largest open period there is. *Ever* is the word that says so, and it is *have* that carries it." }
            ],
            showDifferenceOnCorrect: false,
            // The gap falls at the start of a sentence inside the prompt, so
            // grade the lower-case answer and render the capital. Capitalisation
            // is never part of the correctness check.
            rendersAs: {
                have: "Have",
                did: "Did",
                do: "Do",
                had: "Had"
            },
            spoken: "*Have you ever been* collapses in speech to /əvjuˈevə bɪn/, with the *have* almost gone. If you are listening for it you will miss it — listen for *been* instead, which is the part that survives.",
            feedback: [
                {
                    forAnswer: "did",
                    reason: "*Did you ever go to Delhi?* is a perfectly good question and completely ordinary in American English, so the instinct is not wrong. The trouble is the next word: *did* cannot carry a participle, so *did you ever been* is not available in any variety. If you start with *did*, the verb has to become *go*.",
                    contrast: [
                        "Have you ever been to Delhi?",
                        "Did you ever go to Delhi, in all those years you were in the north?"
                    ],
                    retryCue: "Which auxiliary goes with *been*? *Did* takes the plain form of the verb — so which one is left?",
                    grammaticalButDifferent: true,
                    logAs: "gram.verb-form",
                    errorKind: "did-with-participle"
                },
                {
                    forAnswer: "do",
                    reason: "*Do you ever go to Delhi?* asks about a habit — whether you go from time to time, these days. That is a real question about the present, but it is not a question about experience, and like *did* it cannot be followed by *been*. The answer given here is one trip in 2018, which is an experience rather than a habit.",
                    contrast: [
                        "Have you ever been to Delhi?",
                        "Do you ever go to Delhi for work these days?"
                    ],
                    retryCue: "Am I asking whether this happens repeatedly, or whether it has happened at all in your life so far?",
                    grammaticalButDifferent: true,
                    logAs: "gram.present-perfect",
                    errorKind: "present-simple-for-experience"
                },
                {
                    forAnswer: "had",
                    reason: "*Had you ever been to Delhi?* is good English, but it needs an earlier moment in the past to look back from — *when you took that job in 2015, had you ever been to Delhi?* This conversation gives you no such moment: it opens in the present, with a holiday still being planned, so the period the question looks back over ends at now — and the form for a period that ends at now is *have*.",
                    contrast: [
                        "Have you ever been to Delhi?",
                        "When they offered you the transfer, had you ever been to Delhi before?"
                    ],
                    retryCue: "Am I looking back from now, or from some earlier point in the past? Is there an earlier point in this sentence at all?",
                    grammaticalButDifferent: true,
                    logAs: "gram.present-perfect",
                    errorKind: "past-perfect-without-past-reference"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about the auxiliary in front of *ever been*. The period is your life up to now, which is open, so it is *have*. *Did you ever go* is a good alternative question, but it needs *go* rather than *been*, so it does not fit this gap.",
                contrast: [
                    "Have you ever been to Delhi?",
                    "Did you ever go to Delhi?"
                ],
                retryCue: "Which auxiliary can be followed by *been*, and which period does it point at?"
            },
            alsoNotice: "Read the reply again: *I went in 2018*. The question is present perfect because it asks about a whole life; the moment a year appears, the reply switches to the past simple. That switch — perfect to open the subject, past simple to give the details — is what a real conversation about experience sounds like, and you will hear it dozens of times a day once you notice it."
        },
        {
            id: "present-perfect-vs-past-simple-p4",
            mode: "gap",
            focus: "a-named-year-closes-the-frame",
            prompt: "I ___ my degree in 2021, and I have been looking for the right job ever since.",
            options: ["finished", "have finished", "was finishing", "have finish"],
            accept: [
                { answer: "finished", means: "2021 is over, so the frame is closed and the past simple is the only option. The second half of the sentence stays in the present perfect because *ever since* is still open." }
            ],
            showDifferenceOnCorrect: false,
            spoken: "*I finished my degree* → /aɪ ˈfɪnɪʃt maɪ dɪˈɡriː/. The past-tense ending here is a plain /t/ with no extra syllable — *finish-ed* said as two syllables is one of the most audible signs of reading rather than speaking.",
            feedback: [
                {
                    forAnswer: "have finished",
                    reason: "*I have finished my degree* is exactly right when you stop there, because then the period is your life up to now. Add *in 2021* and the frame snaps shut: a year is the most tightly closed period there is. Look at the other half of this same sentence — *have been looking … ever since* — and you can see the present perfect doing its actual job a few words later, because *ever since* is open and 2021 is not.",
                    contrast: [
                        "I finished my degree in 2021.",
                        "I have finished my degree, so I am free to start whenever you need me."
                    ],
                    retryCue: "Is the year I named still going on? If it is not, which tense belongs inside it?",
                    grammaticalButDifferent: false,
                    logAs: "gram.present-perfect",
                    errorKind: "perfect-with-closed-time-frame"
                },
                {
                    forAnswer: "was finishing",
                    reason: "*I was finishing my degree in 2021* means you were in the middle of it during that year — it is about the state you were in, not about the moment it ended, and it leaves open whether you ever finished. The sentence goes on to say you have been job-hunting since, so what is needed is the completed event that started the search.",
                    contrast: [
                        "I finished my degree in 2021.",
                        "I was finishing my degree in 2021, so I could only work weekends."
                    ],
                    retryCue: "Do I mean the point where it was done, or the stretch of time when it was still going on?",
                    grammaticalButDifferent: true,
                    logAs: "gram.present-perfect",
                    errorKind: "progressive-for-simple-past"
                },
                {
                    forAnswer: "have finish",
                    reason: "*Have* has to be followed by the participle, and the participle of a regular verb is the *-ed* form: *have finished*, not *have finish*. That said, fixing the ending still leaves you with the present perfect in front of *in 2021*, which the year will not allow — so the form this sentence wants is the past simple standing on its own.",
                    contrast: [
                        "I finished my degree in 2021.",
                        "I have finished my degree."
                    ],
                    retryCue: "Which ending does the verb need after *have*? And once it is fixed, does *in 2021* still let me use *have*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.verb-form",
                    errorKind: "bare-stem-as-participle"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about the verb in front of *in 2021*. A named year is a closed frame, so the answer is the past simple *finished*. The present perfect is not wrong in general — it is right in the second half of this very sentence — it just cannot go inside a year that has ended. If you reached for a different verb, *I completed my degree in 2021* is equally good English: this item is checking the tense, not the choice of word.",
                contrast: [
                    "I finished my degree in 2021.",
                    "I have finished my degree."
                ],
                retryCue: "Which tense goes inside a year that is over?"
            },
            alsoNotice: "Both tenses are in this one sentence and both are correct: *in 2021* is a closed box, *ever since* is an open one. A sentence switches tense as often as its time frames change, and a speaker who can switch mid-sentence like this is doing the thing this point is actually for."
        },
        {
            id: "present-perfect-vs-past-simple-p5",
            mode: "gap",
            focus: "yet-leaves-the-period-open",
            prompt: "Do not throw that magazine away — I ___ it yet.",
            options: ["have not read", "did not read", "am not reading", "have not readed"],
            accept: [
                { answer: "have not read", means: "*Yet* says the period is still open and you still intend to read it. This is the British and international pattern, the one your ear was most likely trained on, and the one that will sound right to the widest range of listeners." },
                { answer: "did not read", means: "This is the American pattern, and with *yet* it is completely standard. What it changes is not what you have said about the magazine but which variety of English you are speaking — an American listener will not blink at it, and a British one may notice it. Either way it is not an error." }
            ],
            // Two right answers, both offered, and the reason is the AmE/BrE split
            // set out in `caveats`: "I didn't read it yet" is standard American
            // English, so marking it wrong would break the methodology's rule
            // about defensible alternatives — and would tell a learner who had
            // been listening to American speakers that their ear was faulty.
            //
            // The contractions *haven't read* and *didn't read* are deliberately
            // NOT listed. They cannot be submitted (a gap item has buttons, not a
            // text field) and, if they were, app.js would announce that they "do
            // not mean the same thing" as the full forms, which is false. They
            // are taught in `spoken` instead, which is where a pronunciation fact
            // belongs.
            showDifferenceOnCorrect: true,
            spoken: "*I haven't read it yet* → /aɪ ˈhævnt ˈred ɪt jet/. Note the vowel: the participle *read* is said /red/, exactly like the colour, even though it is spelled like the present tense. The spelling tells you nothing here and the vowel tells you everything.",
            feedback: [
                {
                    forAnswer: "am not reading",
                    reason: "*I am not reading it* is about right now — this minute, I do not have it open. That is true and it is not the reason to keep the magazine. What you need to say is that the reading has not happened yet but is still going to, and the present continuous cannot carry that: it has no reach into the future or the past.",
                    contrast: [
                        "I have not read it yet.",
                        "I am not reading it at the moment — take it if you need it for an hour."
                    ],
                    retryCue: "Am I describing this minute, or something that has not happened yet and still might?",
                    grammaticalButDifferent: true,
                    logAs: "gram.present-perfect",
                    errorKind: "present-continuous-for-perfect"
                },
                {
                    forAnswer: "have not readed",
                    reason: "The tense is right and the reasoning behind it is right — *yet* does keep the period open. Only the form of the verb slipped: *read* is one of the verbs that never takes *-ed*, and its past and participle are both spelled *read* and both said /red/. So the participle you want is *read*, unchanged on the page and changed in the mouth.",
                    contrast: [
                        "I have not read it yet.",
                        "I have not finished it yet."
                    ],
                    retryCue: "Does this verb take *-ed* at all? Say the past form out loud and listen to the vowel.",
                    grammaticalButDifferent: false,
                    logAs: "gram.verb-form",
                    errorKind: "regular-ending-on-irregular-verb"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about the form of *read* after a *yet* that keeps the period open. *I have not read it yet* and *I did not read it yet* are both right — the first is the British and international form, the second is standard American English — and both are perfectly good contracted, *haven't read* and *didn't read*, which is how they are actually said out loud.",
                contrast: [
                    "I have not read it yet.",
                    "I did not read it yet."
                ],
                retryCue: "*Yet* says this has not happened but still might. Which forms of *read* can say that?"
            },
            alsoNotice: "*Just*, *already* and *yet* are the three words where the two big varieties of English genuinely disagree. *I have just eaten* and *I just ate* are both correct, as are *Have you eaten yet?* and *Did you eat yet?* This is the only corner of the point where that is true — *I have eaten yesterday* is not American English either."
        },
        {
            id: "present-perfect-vs-past-simple-p6",
            mode: "gap",
            focus: "when-questions-cannot-take-the-present-perfect",
            prompt: "\"When ___ you get back from Chennai?\" \"On Sunday night — I slept for twelve hours after that.\"",
            options: ["did", "have", "were", "do"],
            accept: [
                { answer: "did", means: "*When* asks for the occasion, and an occasion always sits in a frame that has closed. The reply confirms it: Sunday night is over and the sleeping is already done." }
            ],
            showDifferenceOnCorrect: false,
            spoken: "*When did you* becomes /wenˈdʒə/ in ordinary speech — *when-ja get back* — with the *did* and the *you* fused into one syllable. Learning to hear /dʒə/ as *did you* is worth more than any drill on the written form.",
            feedback: [
                {
                    forAnswer: "have",
                    reason: "This one English blocks outright, and the reason is the heart of the point: *when* asks the listener to name an occasion, and naming an occasion closes the frame around it, while *have* insists the frame is still open. The two cancel each other, so *When have you got back?* is not a sentence any variety of English produces. That is why the *When?* test works so well — if *When?* fits, *have* cannot.",
                    contrast: [
                        "When did you get back from Chennai?",
                        "Are you back from Chennai yet? — Yes, I have just got back."
                    ],
                    retryCue: "Is this question asking whether something happened, or asking exactly when it happened? Only the first one can take *have*.",
                    grammaticalButDifferent: false,
                    logAs: "gram.present-perfect",
                    errorKind: "perfect-in-when-question"
                },
                {
                    forAnswer: "were",
                    reason: "*Were* needs either an *-ing* form or an adjective or place after it — *When were you getting back?*, *When were you in Chennai?* — and it cannot be followed by the plain verb *get*. There is a good question hiding in your instinct, though: *When were you in Chennai?* asks about the trip rather than the return, which is a different question from the one this reply answers.",
                    contrast: [
                        "When did you get back from Chennai?",
                        "When were you in Chennai? — Last month, for about a week."
                    ],
                    retryCue: "What can follow *were*? And which auxiliary goes in front of a plain verb like *get*?",
                    grammaticalButDifferent: true,
                    logAs: "gram.verb-form",
                    errorKind: "be-with-bare-stem"
                },
                {
                    forAnswer: "do",
                    reason: "*When do you get back from Chennai?* is a good question about a trip that has not finished — you are still there and I am asking your plans. The reply here rules that out: *I slept for twelve hours after that* puts the whole thing behind us, so the question has to be about a return that has already happened.",
                    contrast: [
                        "When did you get back from Chennai?",
                        "When do you get back from Chennai? — Sunday night, if the flight is on time."
                    ],
                    retryCue: "Has this journey already happened, or is it still to come? Read the reply before deciding.",
                    grammaticalButDifferent: true,
                    logAs: "gram.present-perfect",
                    errorKind: "present-for-past-occasion"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about the auxiliary after *When*. The reply names Sunday night and reports sleeping that is already over, so the question is about a closed occasion and the auxiliary is *did*. *Have* cannot appear in a *when* question at all.",
                contrast: [
                    "When did you get back from Chennai?",
                    "Have you got back from Chennai yet?"
                ],
                retryCue: "Am I asking *whether* or asking *when*? Which of those two can use *have*?"
            },
            alsoNotice: "This is the most useful test in the whole point, and it costs nothing to run. Before you say *have*, ask whether *When?* would fit as the next question. If it would, you are on an occasion, and English will not let *when* and the present perfect share a clause."
        }
    ],

    produce: {
        id: "present-perfect-vs-past-simple-produce",
        task: "Out loud, in about five sentences, tell someone about a place you have visited. Open with the present perfect and no time word at all — *I have been to…* — because all you are doing is putting it on the record. Then switch to the past simple the moment you give details, and say an actual year or month so the switch is forced: *I went in 2019 and we stayed for a week*. Finish with one sentence about a period that is still open: *I have not been back since*, or *I have wanted to go again ever since*.",
        targetSeconds: 60,
        useLanguage: [
            "I have been to … with no time word attached",
            "a real year or month, with the verb in the past simple",
            "since or ever since, with have"
        ],
        selfCheck: [
            "Did my first sentence use *have been* with no time word hanging off it?",
            "Did I say an actual year or month out loud, and did the verb in that sentence switch to the past simple?",
            "Did I get all the way through without putting a finished time — *yesterday*, *last year*, *in 2019* — after *have*?",
            "Did my last sentence use *since* or *ever since* together with *have*?"
        ],
        model: {
            text: "I have been to Kerala twice. I went the first time in 2017, with two friends from college, and we stayed in a houseboat for three nights. It rained the entire week and we did not care at all. I went back in 2019 for a cousin's wedding, but that trip was only two days. I have not been since then, and I have been meaning to fix that for a while.",
            note: "Read this once to see the shape of the switch, then look away from the screen and say your own version about your own trip. Reading it aloud is not the exercise — producing your own sentences, and hearing yourself change tense when the year appears, is."
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            transferId: "T-G6",
            priority: "M",
            note: "Telugu marks whether an action is complete. English *have* + participle marks something else entirely: whether the period the action sits in is still open. Those two look alike from the inside, because most complete actions are in the past, and they come apart at exactly one point — a word like *ninna* (ninna, yesterday). Completion has no problem with *ninna*: an action finished yesterday is finished, and Telugu says so without any awkwardness. But an open period cannot contain yesterday, because yesterday has a lid on it. So *I have gone yesterday* is not sloppy English and it is not a gap in your grammar; it is your grammar applying a rule that works perfectly in Telugu to a language that is measuring a different thing. The same mismatch produces *When have you come?* — Telugu can ask when about a completed action, and English cannot ask when about an open period. Notice too that Telugu does not need *for* and *since* to be different words in the way English does, which is where *since three years* comes from: English *since* wants a starting point (*since 2019*, *since Monday*) and *for* wants a length (*for three years*).",
            bridge: "One habit to build and one to unlearn. Build this: before any verb, ask yourself whether the piece of time you have in mind has ended. If it has — *ninna*, *last week*, *in 2019*, the wedding, the meeting — use the plain past simple, however recently it happened. If it has not — today, this week, since Monday, your life so far — use *have* or *has*. Notice that this question is about the *time*, not about the action: you are not asking whether you finished the thing, which is the question Telugu trains you to ask. Unlearn this: the idea that the present perfect is for recent events. It is not, and believing it is what puts *last week* after *have seen*. *I have lived here for ten years* reaches back a decade and is present perfect; *I saw him ten minutes ago* is ten minutes old and is past simple. Open or closed is the only thing being asked."
        }
    },

    review: {
        rulePrompt: "One line before you start: the question is never how long ago it happened, only whether that piece of time has finished — *in 2019* has finished, *since 2019* has not.",
        itemIds: ["present-perfect-vs-past-simple-p4", "present-perfect-vs-past-simple-p2", "present-perfect-vs-past-simple-p6"]
    },

    tags: ["present-perfect", "past-simple", "tense", "aspect", "T-G6", "high-frequency", "everyday"]
};

// Match the js/core/* pattern: a lexical global for the browser, CommonJS for
// the Jest suite. `module` is undefined in a classic script, so this is inert
// there.
if (typeof module !== "undefined" && module.exports) {
    module.exports = { GRAMMAR_PRESENT_PERFECT: GRAMMAR_PRESENT_PERFECT };
}

// Self-registration, same shape as data/grammar/countability.js — except that
// the tier array is `everyday`, not `foundation`. `grammarLessons` in
// data/grammar.js is a top-level `const`, i.e. a lexical global, so a classic
// script loaded AFTER it can read the binding by bare name and push into the
// tier array. `grammarLessons.everyday` is pre-created and empty there, which is
// why the Array.isArray guard passes and this is the first point in it.
//
// The guards cover the two things that can actually go wrong: a script-order
// mistake (grammar.js absent) leaves the point unregistered instead of throwing
// during page load, and an id already present is not pushed twice — so if this
// point is ever folded into data/grammar.js inline, this file becomes a no-op
// rather than producing a duplicate. Both verified.
//
// A duplicate <script> include of THIS file is a different matter: it throws
// "GRAMMAR_PRESENT_PERFECT has already been declared" at parse time, as a second
// include of any file in this codebase would. That is the classic-script
// contract, not something these guards can rescue.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.everyday) &&
    !grammarLessons.everyday.some(function (p) { return p && p.id === GRAMMAR_PRESENT_PERFECT.id; })) {
    grammarLessons.everyday.push(GRAMMAR_PRESENT_PERFECT);
}
