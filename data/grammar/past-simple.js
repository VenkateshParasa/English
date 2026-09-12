/**
 * Grammar point 5 — the past simple, and the finished-time rule.
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `GRAMMAR_PAST_SIMPLE`. Same schema, field for field, as the `articles` point in
 * data/grammar.js and as data/grammar/question-formation.js — read grammar.js's
 * header comment for what each field is for. Nothing is added to the schema here
 * and nothing is left out.
 *
 * CURRICULUM.md §3 Strand B point 5 ("regular *-ed* and the 40 irregulars that
 * carry most conversation"), hence `syllabusNumber: 5`. Point 7 is prepositions;
 * do not renumber this to match a reading order.
 *
 * ⚠️ THE L1 CODE IS T-G6, NOT T-G9. The transfer this point serves is
 * REQUIREMENTS.md §3.2 row **T-G6, perfective aspect mismatch** — *"I have gone
 * yesterday"*. §3.2's T-G9 is a different row (Indian-English register items:
 * *doubt* for *question*, *out of station*), and js/core/mistakes.js agrees:
 * `gram.present-perfect` carries `code: 'T-G6'` and `gram.register-indian`
 * carries `code: 'T-G9'`. Anything describing the perfective mismatch as T-G9 is
 * mis-keyed; every `l1` field below says T-G6.
 *
 * ⚠️ TIER — `foundation`. Three reasons, and the first is the syllabus itself:
 * CURRICULUM.md §3 puts the past simple at point 5, inside the first block
 * (points 1–8), and §2.2 maps that block to A1–A2 while `everyday` is B1. Second,
 * both prerequisites are foundation points, so nothing here depends on
 * everyday-tier content — whereas the reverse would be true of any other
 * placement, since a learner cannot be taught when NOT to use the perfect before
 * they can build the tense they are supposed to use instead. Third, this is the
 * tense almost every sentence about the learner's own life needs; a foundation
 * learner who cannot say what they did yesterday is stuck on day one.
 *
 * -----------------------------------------------------------------------------
 * ⚠️ 1. HOW THIS RELATES TO data/grammar/present-perfect.js — READ BEFORE EDITING
 * -----------------------------------------------------------------------------
 * That file is point 9, id `present-perfect-vs-past-simple`, tier `everyday`. It
 * teaches the same boundary from the other side and it is NOT restated here.
 *
 * WHAT THIS POINT DEFERS TO IT, explicitly and by name (`decide` step 5,
 * `caveats`, `p5.alsoNotice`): the choice between the two tenses when NO time is
 * stated — experience so far, news, a period still running, *since* and *for*,
 * the *just / already / yet* variation between British and American usage, and
 * the whole idea that *have* + participle marks an OPEN PERIOD rather than a
 * finished action. Point 9 owns that. This point states the blocking condition
 * only, and hands the rest over.
 *
 * WHAT THIS POINT ADDS, none of which point 9 covers: the past simple's own
 * machinery. `did` + bare infinitive in questions and negatives (its only
 * appearance in point 9 is one caveat about *did* not taking a participle),
 * irregular past forms as memorised items with no rule behind them, and the
 * finished-time signal treated as a trigger the learner scans FOR rather than a
 * choice they weigh.
 *
 * WHY THEY CANNOT CONTRADICT EACH OTHER. Both files say the same thing in the
 * same words, and it is deliberately a one-way condition rather than a pair of
 * competing rules: a stated past time that is OVER admits only the past simple.
 * Point 9: "use the past simple when the sentence names a time that is over…
 * the test is never how long ago it happened, only whether that piece of time
 * has closed." Here: the past simple is the default for finished time, and the
 * perfect is the special case that REFUSES a stated past time. A learner who
 * does both points is never choosing between two equal options; they are
 * noticing one blocking condition, and then — only if it is absent — reading
 * point 9.
 *
 * Three specific agreements were checked sentence by sentence, because these are
 * where a contradiction would actually surface:
 *
 *   - NEVER "a named time" on its own. *Today*, *this week*, *since Monday* are
 *     named times that do NOT block the perfect, and point 9's p2 grades
 *     *since 2019* as perfect-only. So every statement here says "a stated PAST
 *     time, one that is OVER" — never just "if you name the time". If you edit
 *     any wording below, keep the word *over* in it.
 *   - NEVER "the past simple is for finished actions". Point 9's `explain` is
 *     explicit that the action in *I have finished* is exactly as finished as the
 *     one in *I finished*. This file therefore says finished TIME throughout, and
 *     `explain` states the open-period fact and attributes it to point 9 rather
 *     than competing with it.
 *   - `past-simple-p6` accepts BOTH *lived* and *have lived* for a *for*-phrase,
 *     which is precisely what point 9's own `p2.alsoNotice` licenses: "*For*
 *     names a length and can go either way: *I have worked here for six years*
 *     means you are still here, *I worked there for six years* means you are
 *     not." Its contrast pair 1 is the same pair of sentences with the same two
 *     meanings. There is no item in either file that the other file's rule would
 *     grade differently.
 *
 * -----------------------------------------------------------------------------
 * 2. `did` IS THE HELPER question-formation.js ALREADY TEACHES, NOT A NEW FACT
 * -----------------------------------------------------------------------------
 * Point 6 frames the borrowed *do/does/did* as the word that MOVES IN FRONT OF
 * THE SUBJECT of the clause that is the question. This point meets the same word
 * doing its other job: CARRYING THE TENSE, so the main verb goes back to its
 * plain form. That connection is made explicitly and not left for the learner to
 * infer — in `rule`, in `decide` step 4, in the second contrast pair, in
 * `commonErrors` ("this is the same reason it is *Does he work here?*"), in
 * `p3.alsoNotice` ("two jobs, one word") and in the l1 `bridge`. `past-simple-p3`
 * is built to be point 6's `question-formation-p1` with the tense moved: same
 * four-way option shape (correct / doubled marking / no helper / helper behind
 * the subject), same errorKinds where the error is the same one, so a learner who
 * has done point 6 recognises the item rather than meeting it cold.
 *
 * -----------------------------------------------------------------------------
 * 3. IRREGULAR PASTS HAVE NO RULE, AND THIS FILE DOES NOT PRETEND OTHERWISE
 * -----------------------------------------------------------------------------
 * BR-3 and methodology §5: no invented pattern to make them feel learnable.
 * `past-simple-p4` says the reasoning behind *catched* was correct and the verb
 * is simply one that has its own form. What is offered instead of a rule is a
 * rhyme set (*caught / taught / thought / bought / brought*) named as a memory
 * aid, and one genuinely useful consequence: after *did* or *didn't* the
 * irregular form is not needed at all, so the question and negative shapes are a
 * safe route when a past form will not come to mind.
 *
 * -----------------------------------------------------------------------------
 * MISTAKE CATEGORIES — five ids, all of which already exist. None invented.
 * -----------------------------------------------------------------------------
 * `js/core/mistakes.js` routes TWO rows here, both with
 * `drill: { strand: 'grammar', target: 'past-simple' }`, which is why the id
 * below is exactly `past-simple` and must never be prettified (US-187: the
 * dashboard builds `gram:past-simple` from that string and, until this file
 * existed, both buttons opened nothing):
 *
 *   gram.verb-form        "Right tense, wrong form of the verb". The lesson
 *                         default, because the error this point meets most often
 *                         is a verb in the wrong shape — *didn't went*, *did you
 *                         went*, *have went*, *catched*.
 *   gram.tense-agreement  "Past tense not carried through the whole sentence".
 *                         Used where the verb was left in the present although
 *                         the sentence is about finished time (*Yesterday I go*,
 *                         *I don't get it* for *I didn't get it*).
 *
 * Three more ids are used where they are the accurate diagnosis, and each sends
 * the learner to the point that fixes that error rather than to this one:
 *
 *   gram.present-perfect  T-G6. Logged for the perfect used with a stated past
 *                         time — the error this point exists to prevent. Its
 *                         drill target is `present-perfect-vs-past-simple`, i.e.
 *                         point 9, which is correct and is the routing half of
 *                         the deference described above: the learner chose the
 *                         wrong tense, and point 9 is the point about choosing.
 *                         (Point 9 does the mirror image, logging
 *                         `gram.verb-form` here for a wrong participle.)
 *   gram.auxiliary-omitted  A question with its helper missing — *What they
 *                         asked you?* Its example is *"Where you live?"*, the
 *                         same error, and it drills point 6.
 *   gram.word-order       The helper present but standing behind the subject.
 *                         That row's own comment names
 *                         `auxiliary-after-subject-sov-residue` as one of its two
 *                         producers, so the errorKind here matches point 6's.
 *
 * THE HELPERLESS NEGATIVE NOW HAS ITS OWN ROW (US-229, resolved 2026-09-12).
 * When this point was authored there was no category for a NEGATIVE built with
 * no helper at all — *"I not got the message"*, *"I not know"* — so that option
 * (`past-simple-p2`, *not got*) logged `gram.verb-form`: broad, not false, and it
 * drilled the point the learner was already in. `gram.auxiliary-omitted` existed
 * but its label named questions only, so a learner who wrote a helperless
 * negative would have been shown a finding about questions.
 *
 * That row has since been widened to "A question or a negative with its helper
 * word missing", on the argument that both shapes are the absence of the SAME
 * word from the same cause — Telugu borrows no word to ask or to negate, so
 * there is no Telugu word for English *do* and it does not come to mind. Two
 * rows of one producer each would also both have failed to rank in a top five.
 * So `not got` now logs `gram.auxiliary-omitted`, and `errorKind` keeps the
 * finer grain.
 *
 * -----------------------------------------------------------------------------
 * FOUR RENDERER CONSTRAINTS THE CONTENT BELOW IS SHAPED BY
 * -----------------------------------------------------------------------------
 * 1. Every item is `mode: 'gap'`. app.js implements only that mode and renders a
 *    "cannot show" note for any other, so a `repair` or `order` item would be
 *    unteachable content. Where the target is word order (`p3`) the gap holds the
 *    whole helper-and-subject region, so the ORDER is what the learner chooses.
 * 2. Every accepted answer is also in that item's `options` (US-166): a gap item
 *    has buttons, not a text field, so an accepted answer that is not an option
 *    can never be submitted. `fallbackFeedback` is still written properly on all
 *    six — it is the documented contract for typed input.
 * 3. `showDifferenceOnCorrect` is set on exactly one item, `p6`, where the two
 *    accepted answers say opposite things about where the learner lives now.
 *    renderGrammarCorrect() prints the fixed sentence "Both answers here are
 *    right, and they do not mean the same thing" whenever that flag is set, so a
 *    true synonym must never be accepted (US-188). The near-equivalences this
 *    point attracts are named in prose rather than offered as options: the
 *    American *I just ate* beside the British *I've just eaten* is in `caveats`,
 *    because accepting both would make the app assert a difference in meaning
 *    that does not exist. The Indian-English *I am living here for six years* IS
 *    offered, on `p6`, because it is not an equivalent — it is the commonest
 *    wrong form for that exact meaning, and its feedback says plainly that it is
 *    understood by hundreds of millions of people before explaining what a
 *    listener outside the region hears instead.
 * 4. No option value needs capitalising, because no gap falls at the start of a
 *    sentence — hence no `rendersAs` map on any item. If an item is ever
 *    reworded so a gap opens a sentence, add one rather than capitalising the
 *    graded value.
 *
 * ONE THING THIS FILE DELIBERATELY DOES NOT CALL, for the reason set out at
 * length in data/grammar/prepositions.js: `Mistakes.registerDrillTargets`. The
 * registry is all-or-nothing per strand — `isAuthoredTarget()` returns `false`
 * ("provably dead") for every target a populated registry does not name — so a
 * unilateral registration from here would blank the drill buttons of every other
 * authored point. Either all of them register from one caller that holds the
 * content list, or none do. Until then no claim is made and the
 * `gram:past-simple` buttons are drawn on the `null` ("unknown") path, which is
 * what makes this file fix those two dead buttons on its own.
 * =============================================================================
 */

const GRAMMAR_PAST_SIMPLE = {
    id: "past-simple",
    syllabusNumber: 5,
    tier: "foundation",
    cefr: "A2",
    title: "Talking about finished time: \"I went\", \"Did you go?\"",

    srsType: "gram",
    srsRef: "past-simple",
    srsKey: "gram:past-simple",
    mistakeCategory: "gram.verb-form",

    // `be` supplies *was/were*, which is the one past tense that borrows no
    // helper at all, and question-formation supplies the borrowed *do/does/did*
    // that this point reuses. Both are foundation points. Advisory only —
    // nothing in the methodology gates grammar, and a learner who has to talk
    // about yesterday today should be sent here today.
    prerequisites: ["be", "question-formation"],

    rule: "For anything in time that is over, use the past simple — and if the sentence states a past time (*yesterday*, *last week*, *in 2019*, *when I was a child*), it is the only tense English allows; mark the past exactly once, on the verb itself in a statement (*went*, *saw*, *worked*) or on a borrowed **did** in a question or a negative, and then the main verb goes back to its plain form (*Did you go?*, *I didn't go*).",

    explain: "The past simple is the ordinary, unmarked way to talk about time that is over, and it is where most of a conversation about your own life happens. It is not one option among several. Once the sentence states a past time, English has nothing else available — which is the whole of the *I have gone yesterday* problem. That sentence is not wrong because the perfect is a difficult form or because the trip was recent; it is wrong because a stated past time blocks the perfect outright. So keep the order in your head one way round: past simple by default for finished time, and the present perfect only where no past time is stated. You are not weighing two tenses against each other; you are checking one blocking condition, and only if it is absent does a choice exist at all. What that choice then depends on is point 9's subject, not this one's — and the short version is that *have* + participle is not about the action being finished (*I have finished* is exactly as finished as *I finished*), it is about the stretch of time being still open.\n\nThe other half of this point is where the past mark sits, and English puts it in exactly one place per clause. In a plain statement it sits on the verb: *I went*, *she saw*, *they worked*. In a question or a negative, English borrows **did** — the same helper you borrowed in point 6 to put something in front of the subject — and once *did* is in the clause it is carrying the tense for the whole of it, so the main verb drops back to its plain form: *Did you go?*, *I didn't go*. Marking it twice (*Did you went?*, *I didn't went*) is the commonest slip in the shape and it is not carelessness: it is the reasonable assumption that the past should show up everywhere it applies.\n\nTelugu is behind both halves. Its perfective reports that something is complete and attaches no condition about stated times — completion sits perfectly happily next to *ninna* (yesterday) — so nothing in your first language warns you that *yesterday* and *have gone* cannot share a sentence. And Telugu marks tense as a suffix on the verb, in statements, questions and negatives alike, with no borrowed helper anywhere, so *did* has no counterpart to lean on and taking the past OFF the verb feels like losing it.",

    decide: [
        "Is this about time that is over? Then the past simple is your default. Do not open by wondering whether the perfect might fit.",
        "Does the sentence state a past time — *yesterday*, *last night*, *last week*, *in 2019*, *two days ago*, *when I was a child*, *at school*? Then it is settled before you get to the verb: past simple, and the perfect is not available at all.",
        "Statement? Put the past on the verb: *I **went***, *she **told** me*, *we **worked** late*. If the verb is irregular, you either know the form or you look it up — there is no rule to work it out from.",
        "Question or negative? Borrow **did**, exactly as you borrow *do* to ask anything, and then leave the main verb plain — *did* is already carrying the tense: *Did you **go***?, *I didn't **go***. Past marked once per clause, never twice.",
        "No past time stated at all, and you mean experience so far, or news, or a period that is still running? That is the one case where a choice exists, and point 9 — present perfect vs past simple — is where it is taught. Everything before that step belongs here."
    ],

    whyItMatters: "Nearly everything you say about yourself sits in finished time: what you did yesterday, where you studied, how the meeting went, why you were late. So this is not a tense you reach for occasionally, it is the one you spend most of a conversation in. The two halves of the point fail differently, and it is worth knowing which is which. *I have gone there last year* is understood everywhere and hundreds of millions of people say it — it costs you nothing in India and it is, after articles, the feature that most marks your English as regional to a listener elsewhere. *Did you went?* is not heard as a variety, it is heard as an error, and it turns up in the question shapes you use most often in an office.",

    notice: {
        lines: [
            { speaker: "Manager", text: "You **weren't** in yesterday — **did** everything **go** all right at the hospital?" },
            { speaker: "You", text: "Fine, thanks. We **got** there at eight and they **saw** us within an hour." },
            { speaker: "Manager", text: "That's quick. **Did** they **say** anything about the results?" },
            { speaker: "You", text: "They **didn't tell** us much. The doctor **said** to come back on Friday." },
            { speaker: "Manager", text: "Right. **Have** you **spoken** to Priya about covering Friday?" },
            { speaker: "You", text: "Not yet — I **sent** her a message last night, but she **hasn't replied**." }
        ],
        question: "Four verbs here follow *did* or *didn't*. What shape are they in — and in the last line, why does one half of the sentence use *sent* and the other *hasn't replied*?",
        answer: "After *did* and *didn't*, every verb is in its plain form: *did everything **go***, *did they **say***, *they didn't **tell** us. Not *went*, *said* or *told*, because *did* has already taken the past for the whole clause and English marks it once. Compare the statements around them, where there is no helper to borrow and the past therefore sits on the verb itself: *we **got** there*, *they **saw** us*, *the doctor **said***. Now the last line. *I **sent** her a message last night* states a past time, so the past simple is the only thing available — *I have sent her a message last night* is not English. *She **hasn't replied*** states no time; it is about how things stand right now. The two halves are not two styles the speaker picked between: the stated time in the first half forced one, and the absence of a stated time in the second half is what allowed the other."
    },

    contrast: [
        {
            pair: [
                {
                    text: "I went to Mumbai in 2019.",
                    means: "One finished trip, placed in time. You have said when, so this is the only tense English offers here — and it invites the follow-ups: why, who with, how long."
                },
                {
                    text: "I've been to Mumbai.",
                    means: "Mumbai is on the list of places you have been, at some point in your life. No *when*, because the *when* is not the point — you are saying it counts as something you have done."
                }
            ],
            takeaway: "Both are correct and they do different jobs. What decides between them is not how recent the trip was and not how important it was: it is the words *in 2019*. Add a stated past time to the second sentence and it breaks (*I've been to Mumbai in 2019*); take it out of the first and the sentence is still fine (*I went to Mumbai*). The past simple works with or without a stated time. The perfect only works without one — and note *been*, not *gone*: *I have gone to Mumbai* would mean you are there now."
        },
        {
            pair: [
                {
                    text: "The power went off at nine.",
                    means: "A statement, so the past sits on the verb and *go* becomes *went*. There is no helper in the clause and none is needed."
                },
                {
                    text: "Did the power go off at nine?",
                    means: "A question, so English borrows *did* — and *did* is now carrying the past for the whole clause, which is exactly why the verb drops back to its plain form *go*."
                }
            ],
            takeaway: "Both are correct, and the past is marked in both — once each, in a different place. This is the same borrowed helper as point 6: there you watched it move in front of the subject, and here you can see it take the tense. So *Did the power went off?* is not a small extra slip on top of a correct question; it is the past marked twice in one clause, which English never does."
        },
        {
            pair: [
                {
                    text: "I lived in Hyderabad for six years.",
                    means: "Those six years are over. You may have moved away, or moved away and come back — either way you are describing a closed stretch of your life."
                },
                {
                    text: "I've lived in Hyderabad for six years.",
                    means: "You still live here. Six years so far, and counting: the stretch runs right up to this conversation, which is why it takes the perfect."
                }
            ],
            takeaway: "Both are correct and they say opposite things about where you live now, which makes this the one case in the point where the wrong choice actually misinforms somebody. It is the same rule seen from the other side: the past simple is for a period that has closed, the perfect for one that has not. And notice that neither sentence states a point in time — *for six years* is a length, not a date — which is why the perfect is available here at all."
        }
    ],

    spokenNote: "Regular *-ed* has three pronunciations and none of them is an extra syllable unless the verb already ends in a /t/ or /d/ sound: *worked* is /wɜːkt/, *called* is /kɔːld/, and only *wanted* /ˈwɒntɪd/ and *needed* /ˈniːdɪd/ get the extra beat. Saying *work-ed* as two syllables is the commonest thing that makes a correct past tense sound wrong. In connected speech the ending often collides with the next word and nearly vanishes — *I finished the report* comes out with a single /t/ doing all the work — which is one good reason to trust the vowel of an irregular verb instead: *went*, *saw*, *took*, *got* are unmistakable at any speed. *Did you* is /ˈdɪdʒə/, one squashed word, and *didn't* usually loses its /t/ in front of a consonant: *I didn't go* is /aɪ ˈdɪdn̩ ɡəʊ/. Listen for the *-n*, not the *-t*, or you will hear *I did go*.",

    caveats: [
        "*Yesterday*, *last week*, *in 2019*, *two days ago*, *when I was a child*, *at school*, *during the lockdown* are all stated past times and all of them block the perfect. What matters is that the time is stated and over, not that it is distant: *last week* is a matter of days and still blocks it. Note the other side of that, because it is where this rule is easy to over-apply — *today*, *this week*, *since Monday* are stated times too, and they do NOT block the perfect, because they have not finished. Over, not merely mentioned.",
        "Irregular pasts are memorised and there is genuinely no rule (BR-3). *Go → went*, *see → saw*, *take → took*, *buy → bought*, *teach → taught*, *catch → caught*, *think → thought*, *bring → brought*. Some of them rhyme, which helps a little, but do not spend effort looking for a system that is not there: the fastest route is the fifty or so you actually use, said out loud in short sentences. One trap is worth naming separately — *went* is the past and *gone* is the participle that goes after *have*, so *I have went* mixes the two halves of one verb.",
        "In a question or a negative you never need the irregular form at all, because *did* takes the tense: *Did you go?*, *I didn't buy it*, *Did she bring it?* So if an irregular past will not come to mind mid-sentence, the question and negative shapes are already safe ground.",
        "*Was* and *were* are the exception to the *did* rule, for the reason you already know from point 1: *be* is its own helper and never borrows one. So it is *Were you there?* and *I wasn't there*, never *Did you be there?* The same is true of *had* when it is working as a helper: *Had you eaten?*",
        "*Used to* and *would* are past-simple territory as well, for repeated things that are over: *I used to walk to school*, *We would eat there every Sunday*. Both are optional — *I walked to school every day* says the same thing — but *used to* makes the \"not any more\" part explicit, which is often exactly what you mean.",
        "Where no past time is stated, British and American English genuinely draw the line differently and both are correct. *I just ate* and *I've just eaten*; *Did you eat yet?* and *Have you eaten yet?*; *Did you ever go to Delhi?* and *Have you ever been to Delhi?* Americans reach for the past simple in these, most British speakers for the perfect, and Indian English usually follows the British pattern. Nothing here marks either as an error, and point 9 sets out exactly where that variation starts and stops. What it never touches is a sentence with a stated past time: *I have seen him last week* is not American English either.",
        "One narrow thing, said so it does not surprise you later: a period can close with no time word in the sentence at all. *I saw him at the wedding* is past simple because the wedding is over, not because an adverb told you so. So the stated time is a reliable signal to scan for, not the only one there is — where it is absent, ask whether the stretch of time you have in mind has ended, and point 9 is the point that walks through that."
    ],

    commonErrors: [
        {
            heard: "I have gone to my native place last month.",
            fix: "I went to my native place last month.",
            why: "Nothing is wrong with the meaning you are aiming at — the trip is over, and the Telugu perfective says so exactly this way. It is wrong because *last month* states the time, and a stated past time blocks the perfect in English. Nothing in Telugu carries that restriction, which is why this is a rule you have to be told rather than one you could have worked out. Take the time out and *I have gone* has a use again, though it means something else: I am away right now.",
            l1: "T-G6"
        },
        {
            heard: "I have seen him last week in the office.",
            fix: "I saw him last week in the office.",
            why: "The same rule, and this is the version that survives longest, because it sounds careful rather than casual. *I have seen him* is good English on its own — it means at some point, no time given. Add *last week* and the two halves of the sentence contradict each other: the perfect says \"never mind when\", and *last week* says exactly when.",
            l1: "T-G6"
        },
        {
            heard: "Did you went to the bank?",
            fix: "Did you go to the bank?",
            why: "You have already done the harder half: the helper is borrowed and it is in front of the subject, which is what point 6 was about. The one thing left is that *did* is now carrying the past for the whole clause, so the verb goes back to its plain form — English marks the past once. This is the same reason it is *Does he work here?* rather than *Does he works here?*: the borrowed helper takes the tense and the main verb goes plain.",
            l1: null
        },
        {
            heard: "I didn't went there.",
            fix: "I didn't go there.",
            why: "Exactly the same thing in a negative. *Didn't* is *did* plus *not*, so the past is already in it, and *went* marks it a second time. Notice the useful consequence: after *didn't* you never need an irregular past form at all, so a verb whose past you cannot remember is easy to negate.",
            l1: null
        },
        {
            heard: "He teached us in tenth class.",
            fix: "He taught us in tenth class.",
            why: "This is a good mistake, in the sense that the machinery is right: you took a verb and added the regular past ending, which is what English does with most verbs. *Teach* is simply one of the hundred or so that has its own form instead, and there is honestly no rule that predicts *taught* — it is learned. The upside is that you only ever need it in statements: *Did he teach you?* and *He didn't teach us* need no irregular form.",
            l1: null
        },
        {
            heard: "Yesterday I am going to my cousin's house.",
            fix: "Yesterday I went to my cousin's house.",
            why: "The time word is doing all the work here. *Yesterday* is in the sentence, so you have said when — and in Telugu that would be enough, because the time word and the verb do not have to agree about it. English insists the verb changes too, even when the time word has made it obvious. Once *yesterday* is there, the verb has one available shape: *went*.",
            l1: "T-G6"
        }
    ],

    practice: [
        {
            id: "past-simple-p1",
            mode: "gap",
            focus: "a-stated-past-time-blocks-the-perfect",
            // The T-G6 headline item. `have went` is here rather than only
            // `have gone` because it separates two errors that look like one:
            // the tense choice and the went/gone split inside the verb.
            prompt: "\"How was the weekend?\" — \"Good. We ___ to my cousin's place in Warangal on Saturday.\"",
            options: ["went", "have gone", "have went", "go"],
            accept: [
                { answer: "went", means: "The trip is over and you have said when — *on Saturday* — so the past simple is the only tense available, and the past of *go* is *went*." }
            ],
            spoken: "*We went to my cousin's place on Saturday* → /wi ˈwent tə maɪ ˈkʌzɪnz ˈpleɪs ɒn ˈsatədeɪ/. *Went* is short and its /t/ runs straight into *to*, so the two words come out as one: /ˈwentə/.",
            feedback: [
                {
                    forAnswer: "have gone",
                    reason: "The meaning you are aiming at is right, and the Telugu perfective would say it exactly this way — the trip is complete. English adds one restriction that Telugu does not have: once a past time is stated, the perfect is not available at all. *On Saturday* is that time. So this is not a close call between two tenses, it is one blocked and one left standing. (And *we have gone* would say something else anyway: that we are away right now, not back and talking about it.)",
                    contrast: [
                        "We went to my cousin's place on Saturday.",
                        "We've gone to my cousin's place — back on Monday."
                    ],
                    retryCue: "Which words in this sentence state the time? Then which of the two tenses is still allowed?",
                    grammaticalButDifferent: true,
                    logAs: "gram.present-perfect",
                    errorKind: "perfect-with-stated-past-time"
                },
                {
                    forAnswer: "have went",
                    reason: "Two things at once. First, *on Saturday* states a past time, so the perfect is ruled out however it is built. Second, this mixes the two halves of one verb: *went* is the past form and it stands on its own, while *gone* is the form that follows *have*. So the perfect would be *have gone*, never *have went* — and what this sentence actually wants is the past form by itself: *went*.",
                    contrast: [
                        "We went to my cousin's place on Saturday.",
                        "Two of them have gone home already."
                    ],
                    retryCue: "Does *went* ever follow *have*? And with *on Saturday* in the sentence, do you need *have* at all?",
                    grammaticalButDifferent: false,
                    logAs: "gram.verb-form",
                    errorKind: "past-form-as-participle"
                },
                {
                    forAnswer: "go",
                    reason: "The verb has been left in its present form. *We go to my cousin's place on Saturdays* is a real sentence about a habit — but it does not answer *How was the weekend?*, and the *Good.* in front of the gap has already put you in finished time. In Telugu the time word can carry the past on its own; in English the verb has to change with it.",
                    contrast: [
                        "We went to my cousin's place in Warangal on Saturday.",
                        "We go to my cousin's place most Saturdays."
                    ],
                    retryCue: "Is this about what you do generally, or about one particular Saturday that has passed?",
                    grammaticalButDifferent: true,
                    logAs: "gram.tense-agreement",
                    errorKind: "present-form-for-finished-past"
                }
            ],
            fallbackFeedback: {
                reason: "*On Saturday* states a past time that is over, so the past simple is the only tense this gap accepts, and the past of *go* is *went*. Other verbs would fit the situation just as well — *drove*, *took the bus*, *travelled* — and every one of them would be in the same tense, which is what the item is about.",
                contrast: [
                    "We went to my cousin's place in Warangal on Saturday.",
                    "We've been to my cousin's place a few times."
                ],
                retryCue: "Finished, and the time is stated. Put the past on the verb itself — one word, no helper."
            },
            alsoNotice: "Notice how little this has to do with recency. Saturday was two days ago and the perfect is still blocked, while *I've been to Warangal* is perfectly good about a trip twenty years old. The stated time decides, not the distance."
        },
        {
            id: "past-simple-p2",
            mode: "gap",
            focus: "didnt-plus-bare-infinitive-past-marked-once",
            prompt: "\"Why didn't you reply?\" — \"I ___ the message. My phone was dead all evening.\"",
            options: ["didn't get", "didn't got", "not got", "don't get"],
            accept: [
                { answer: "didn't get", means: "The past sits on the helper: *didn't* is *did* plus *not*, so the tense is already marked and the main verb stays in its plain form *get*." }
            ],
            spoken: "*I didn't get the message* → /aɪ ˈdɪdn̩ ˈɡet ðə ˈmesɪdʒ/. The /t/ of *didn't* disappears in front of *get*, so what you actually hear is the *-n*. Listen for that rather than for a clean /t/ — and copy it, because a fully pronounced *did not* sounds like reading aloud.",
            feedback: [
                {
                    forAnswer: "didn't got",
                    reason: "This is the error the item exists for, and it is a sensible one: the event is past, so you marked the verb past. But *didn't* already contains *did*, and *did* carries the past for the entire clause — so *got* marks it a second time, and English marks it once. The helper takes the tense and the verb goes back to plain: *didn't **get***. There is a real bonus in this: after *didn't* you never have to remember an irregular past at all.",
                    contrast: [
                        "I didn't get the message.",
                        "I got your other message, though."
                    ],
                    retryCue: "Which word inside *didn't* is already the past? Then what shape does *get* go back to?",
                    grammaticalButDifferent: false,
                    logAs: "gram.verb-form",
                    errorKind: "inflected-verb-after-do-support"
                },
                {
                    forAnswer: "not got",
                    reason: "The negative word is here but it has nothing to stand on. English cannot negate an ordinary verb with a bare *not* — *I not got*, *I not know* — because *not* has to attach to a helper, and *get* has none of its own. That is precisely when English lends you one, and in the past it is *did*: *I **didn't** get*. It is the same borrowing you do to ask a question, working here to carry a negative instead.",
                    contrast: [
                        "I didn't get the message.",
                        "I haven't got your number, actually."
                    ],
                    retryCue: "*Not* needs a helper to sit on. Which helper does English lend a plain verb in the past?",
                    grammaticalButDifferent: false,
                    logAs: "gram.auxiliary-omitted",
                    errorKind: "bare-not-negation-without-auxiliary"
                },
                {
                    forAnswer: "don't get",
                    reason: "The shape is completely right — helper borrowed, negative on the helper, plain verb after it. Only the tense is off: *don't* is the present, and this is about one evening that has passed, as *my phone was dead* confirms. The past of *do* is *did*, so the whole thing becomes *didn't get*. (*I don't get the message* would mean you do not understand it, which is a different sentence altogether.)",
                    contrast: [
                        "I didn't get the message — my phone was dead.",
                        "I don't get these automated ones at all."
                    ],
                    retryCue: "You have the right shape. What is the past form of the borrowed helper *do*?",
                    grammaticalButDifferent: true,
                    logAs: "gram.tense-agreement",
                    errorKind: "present-auxiliary-for-past-event"
                }
            ],
            fallbackFeedback: {
                reason: "A negative in the past borrows the helper *did*, puts the *not* on it, and leaves the main verb plain: *I didn't get*. *I never got the message* is equally correct and slightly stronger, and *I hadn't got it by then* works if you are pinning it to a later moment — but all of them keep the past off *get* itself.",
                contrast: [
                    "I didn't get the message.",
                    "I never got the message."
                ],
                retryCue: "Borrow *did*, attach the *not* to it, and let the main verb go back to its plain form."
            },
            alsoNotice: "*My phone was dead* in the next sentence is a past simple with no helper anywhere in sight — *be* is its own helper and never borrows *did*. That is why *Did you be there?* is not a sentence and *Were you there?* is."
        },
        {
            id: "past-simple-p3",
            mode: "gap",
            focus: "did-in-a-wh-question-carries-the-tense",
            // Deliberately point 6's question-formation-p1 with the tense moved:
            // the gap holds the whole helper-and-subject region, so word order is
            // what the learner chooses inside the only mode app.js implements,
            // and the four options separate cleanly into correct / past marked
            // twice / helper missing / helper behind the subject. A wh-question
            // rather than a yes/no one on purpose: point 6's own caveat says a
            // rising-tone statement is a real question, so a yes/no frame would
            // make *they asked* defensible and the item would have two answers.
            prompt: "\"So how did the interview go?\" — \"Fine, I think. What ___ you about your last job?\" — \"Not much, actually — mostly about the new role.\"",
            options: ["did they ask", "did they asked", "they asked", "they did ask"],
            accept: [
                { answer: "did they ask", means: "The borrowed helper *did* comes in front of the subject because this clause is the question, and it carries the past — which is why *ask* stays in its plain form." }
            ],
            spoken: "*What did they ask you?* → /ˈwɒt dɪd ðeɪ ˈɑːsk jə/, and in quicker speech *did they* flattens to /dɪðeɪ/ as the /d/ and /ð/ merge. The stress is on *what* and *ask*; the helper is unstressed, which is exactly why it is so easy to leave out or to double up on.",
            feedback: [
                {
                    forAnswer: "did they asked",
                    reason: "Everything about the question is right — the helper is borrowed and it is in front of the subject — and this is the last small thing. *Did* has already taken the past for the clause, so *asked* marks it twice. Point 6 showed you this helper moving in front of the subject; carrying the tense is its other job, and it cannot do that job while the verb is doing it too. Past once per clause: *did they **ask***.",
                    contrast: [
                        "What did they ask you about your last job?",
                        "They asked me mostly about the new role."
                    ],
                    retryCue: "Which word here is already carrying the past? Then what shape does *ask* go back to?",
                    grammaticalButDifferent: false,
                    logAs: "gram.verb-form",
                    errorKind: "inflected-verb-after-do-support"
                },
                {
                    forAnswer: "they asked",
                    reason: "This is a statement, and the sentence needs a question. No helper has come in front of the subject, so nothing signals that you have handed the turn back — and with a *wh*-word at the front, English does not offer the casual rising-tone version that a yes/no question can sometimes get away with. *What they asked you* is not the informal form of anything; it is the start of a longer statement. Borrow *did*, put it in front of *they*, and the past moves onto it.",
                    contrast: [
                        "What did they ask you about your last job?",
                        "I never found out what they asked her."
                    ],
                    retryCue: "This clause IS the question, so something has to come in front of *they*. Which word does English lend you — and then what happens to *asked*?",
                    grammaticalButDifferent: true,
                    logAs: "gram.auxiliary-omitted",
                    errorKind: "auxiliary-omitted-in-direct-question"
                },
                {
                    forAnswer: "they did ask",
                    reason: "The helper is here, it is the right one and it is in the right tense — it is just standing behind the subject, where Telugu word order would leave it. In a direct question it goes in front: *did they ask*. (*They did ask* is real English in one situation and it is worth knowing: *They did ask about it, actually* — insisting, when someone has doubted it. That is emphasis, not a question.)",
                    contrast: [
                        "What did they ask you about your last job?",
                        "They did ask about my notice period, now I think of it."
                    ],
                    retryCue: "You have the helper and the tense. Which side of *they* does the helper go on when this clause is the question?",
                    grammaticalButDifferent: true,
                    logAs: "gram.word-order",
                    errorKind: "auxiliary-after-subject-sov-residue"
                }
            ],
            fallbackFeedback: {
                reason: "A direct question borrows *did*, puts it in front of the subject and leaves the main verb plain: *What did they ask you?* Other verbs fit the situation — *What did they want to know?*, *What did they cover?* — and every one of them keeps those two properties: helper in front of *they*, plain verb after it.",
                contrast: [
                    "What did they ask you about your last job?",
                    "What did they want to know about your last job?"
                ],
                retryCue: "Put *did* in front of *they*, then say the main verb with nothing added to it."
            },
            alsoNotice: "Two jobs, one word. In point 6 you borrowed *do / does / did* so that something could move in front of the subject; here the same word is holding the tense so the verb does not have to. That is why *Did you went?* and *Does he works?* are the same mistake wearing different clothes."
        },
        {
            id: "past-simple-p4",
            mode: "gap",
            focus: "irregular-past-forms-are-memorised-not-derived",
            prompt: "\"Did you find the place all right?\" — \"Eventually. I ___ the wrong bus first and ended up near the flyover.\"",
            options: ["caught", "catched", "have caught", "was catching"],
            accept: [
                { answer: "caught", means: "The past of *catch*, which simply has to be known — the regular ending is not available for this verb. One finished step, inside a journey that is over." }
            ],
            spoken: "*I caught the wrong bus* → /aɪ ˈkɔːt ðə ˈrɒŋ ˈbʌs/. *Caught* is one syllable and there is no *-ed* to say; it rhymes with *thought*, *bought* and *brought*. That rhyming group is worth learning as a set, because saying them together is the closest thing to a pattern these verbs have.",
            feedback: [
                {
                    forAnswer: "catched",
                    reason: "The reasoning is right and the machinery is right: you took a verb and added the regular past ending, which is what English does with most verbs. *Catch* is one of the few hundred that has its own past form instead, *caught*, and there is honestly no rule that predicts it — it is memorised. What helps is not a rule but a set of rhymes: *caught, taught, thought, bought, brought*. Say them as a group a few times and this one stops being a decision.",
                    contrast: [
                        "I caught the wrong bus first.",
                        "I watched the stops carefully after that."
                    ],
                    retryCue: "*Catch* does not take the regular *-ed*. What does its past rhyme with — *thought*, *bought*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.verb-form",
                    errorKind: "regular-ending-on-irregular-verb"
                },
                {
                    forAnswer: "have caught",
                    reason: "The irregular form is exactly right, which is the hard part of this item. The tense is the problem: this is one finished step inside a journey that is over — *Did you find the place?* has already put the whole exchange in past time, and *first* places this step in a sequence that has finished. The perfect would be reporting how things stand now, which is not what you are doing. So the past form stands on its own, with no *have* in front of it.",
                    contrast: [
                        "I caught the wrong bus first.",
                        "I've caught the wrong bus here twice now — the stops are confusing."
                    ],
                    retryCue: "Is this one finished step in a journey that is over, or something about how things stand now?",
                    grammaticalButDifferent: true,
                    logAs: "gram.present-perfect",
                    errorKind: "perfect-for-finished-narrative-event"
                },
                {
                    forAnswer: "was catching",
                    reason: "The *-ing* form describes something in progress, usually as the background to something else: *I was catching the last bus when she called*. Catching a bus is not a background — it is a single completed step, and it is one item in a sequence (*first… and ended up…*), so it takes the plain past simple. The continuous is for what was going on around events like this, not for the events themselves.",
                    contrast: [
                        "I caught the wrong bus first.",
                        "I was waiting at the wrong stop when someone pointed it out."
                    ],
                    retryCue: "Was this one completed step in the story, or the background going on while something else happened?",
                    grammaticalButDifferent: false,
                    logAs: "gram.verb-form",
                    errorKind: "past-continuous-for-completed-event"
                }
            ],
            fallbackFeedback: {
                reason: "This is one finished step in a story, so it is the past simple — and *catch* has its own past form, *caught*. *Took the wrong bus* and *got on the wrong bus* are just as natural and both are past simple too: the item is about the form, not the choice of verb.",
                contrast: [
                    "I caught the wrong bus first.",
                    "I took the wrong bus first."
                ],
                retryCue: "One finished event. What is the past of *catch*? It rhymes with *thought*."
            },
            alsoNotice: "There is a shortcut worth keeping for the moment an irregular past will not come to you: put it in a question or a negative, where *did* takes the tense and the verb stays plain. *Did you catch the wrong bus?*, *I didn't catch the bus.* No irregular form needed at all."
        },
        {
            id: "past-simple-p5",
            mode: "gap",
            focus: "the-handover-perfect-question-past-simple-answer",
            // The item that shows the two points meeting. The question is in the
            // perfect (no time stated) and is not what is being graded — the gap
            // is in the ANSWER, which states a time and therefore has exactly one
            // available tense. Deliberately an office exchange rather than a
            // travel one, so it does not restate point 9's p3.
            prompt: "\"Have you finished the deck?\" — \"Yes — I ___ it to you at about six last night.\"",
            options: ["sent", "have sent", "was sending", "send"],
            accept: [
                { answer: "sent", means: "The moment you say when — *at about six last night* — the sentence has a stated past time in it, and the past simple takes over from the perfect the question was asked in." }
            ],
            spoken: "*I sent it to you at about six last night* → /aɪ ˈsent ɪt tə jʊ ət əˈbaʊt ˈsɪks lɑːst ˈnaɪt/. *Sent it* links into /ˈsentɪt/, and the strong beats are *sent*, *six* and *night*. Note that *sent* and *send* differ only in that vowel, so it is a distinction worth making audibly.",
            feedback: [
                {
                    forAnswer: "have sent",
                    reason: "This is the clearest case of the rule in the whole point, because the question really was in the perfect — *Have you finished…?* — so answering in the same tense is a reasonable instinct. But your answer adds something the question did not have: a time. *At about six last night* states it, and a stated past time blocks the perfect. So the tense switches mid-exchange, and that is ordinary English rather than an inconsistency — the perfect opens the topic, the past simple gives the details.",
                    contrast: [
                        "Yes — I sent it to you at about six last night.",
                        "Yes, I've sent it — it should be in your inbox."
                    ],
                    retryCue: "Your answer states a time that the question did not. What does a stated past time do to the perfect?",
                    grammaticalButDifferent: true,
                    logAs: "gram.present-perfect",
                    errorKind: "perfect-with-stated-past-time"
                },
                {
                    forAnswer: "was sending",
                    reason: "The *-ing* past describes something in progress, and it wants an interruption or a background to be part of: *I was sending it when the wifi went*. On its own, as an answer to *have you finished*, it leaves the job hanging — which is the opposite of what you mean, because you are saying *yes*. One completed action at a stated time takes the plain past simple.",
                    contrast: [
                        "Yes — I sent it to you at about six last night.",
                        "I was sending it at about six when the wifi went, so it may not have gone."
                    ],
                    retryCue: "Did the sending finish, or is something about to interrupt it? Which of those does the *-ing* form set up?",
                    grammaticalButDifferent: true,
                    logAs: "gram.verb-form",
                    errorKind: "past-continuous-for-completed-event"
                },
                {
                    forAnswer: "send",
                    reason: "The verb has been left in its present form while the rest of the sentence is firmly in the past — *last night* has stated the time. This is the habit the time word hides: in Telugu the time word can carry the past by itself, and the verb needs no adjusting, so a sentence that already says *last night* feels complete. English marks it in both places, and the past of *send* is *sent*.",
                    contrast: [
                        "I sent it to you at about six last night.",
                        "I send you the numbers every Friday, don't I?"
                    ],
                    retryCue: "The time word says last night. What has to happen to the verb as well?",
                    grammaticalButDifferent: true,
                    logAs: "gram.tense-agreement",
                    errorKind: "present-form-for-finished-past"
                }
            ],
            fallbackFeedback: {
                reason: "The question is in the perfect because it states no time; your answer states one — *at about six last night* — so it has to be the past simple: *sent*. *I emailed it to you at about six* and *I put it in the shared drive last night* are equally correct and are past simple for the same reason.",
                contrast: [
                    "Yes — I sent it to you at about six last night.",
                    "Yes — I emailed it to you at about six last night."
                ],
                retryCue: "A past time is stated, so only one tense is available. Put the past on the verb itself."
            },
            alsoNotice: "This handover is worth listening for, because it happens constantly: *Have you tried that place? — Yes, we went last Diwali.* The perfect opens the subject with no time in it, and the first detail that has a time in it switches to the past simple. Point 9 teaches the opening move and where the two tenses genuinely compete; this point covers everything that follows a stated time."
        },
        {
            id: "past-simple-p6",
            mode: "gap",
            focus: "finished-stretch-versus-one-still-running",
            // The two-right-answers item, and the only place in this point where
            // showDifferenceOnCorrect is honest: *lived* and *have lived* say
            // opposite things about where the learner lives now, so app.js's fixed
            // "they do not mean the same thing" is true (US-188). Both answers are
            // exactly the pair point 9's p2.alsoNotice licenses for a `for`-phrase,
            // which is what makes it impossible for the two points to grade this
            // sentence differently. Full forms, not *'ve lived*: the graded value
            // is rendered straight into the gap after *I*, and a contraction would
            // come out as "I 've lived". The contraction is taught in `spoken`.
            prompt: "A colleague who has just moved: \"You know Hyderabad well, don't you?\" — \"Fairly well. I ___ here for about six years.\"",
            options: ["lived", "have lived", "am living", "had lived"],
            accept: [
                { answer: "lived", means: "Those six years are a closed stretch — you are not counting them up to today. Someone who moved away and came back, or who is talking about an earlier spell in the city, says it exactly this way." },
                { answer: "have lived", means: "You still live here: six years so far, and the count is still running. The stretch reaches this conversation, which is why the perfect is what fits." }
            ],
            showDifferenceOnCorrect: true,
            spoken: "*I lived here for about six years* → /aɪ ˈlɪvd hɪə/, where the *-ed* is a plain /d/ with no extra syllable. *I have lived here* is almost always contracted in speech to *I've lived* /aɪv ˈlɪvd/, one beat; the full form sounds emphatic or careful. Telling these two apart at speed is genuinely hard, and that is worth knowing — the /v/ is the only clue you get.",
            feedback: [
                {
                    forAnswer: "am living",
                    reason: "This is how the sentence is most often said in Indian English, it is understood by hundreds of millions of people, and the meaning you intend is perfectly clear — so nothing here is about being understood. Two narrower things are worth knowing. Outside the region the present continuous does not reach backwards at all, so what those listeners hear is *for about six years* attached to a plan: *I'm living here for six months while the office moves* is the reading it has for them, which is not what you mean. And the two forms that do say what you mean are already available: *I lived here for six years* if the stretch is over, *I have lived here for six years* if it is still running. *Have* is the word that reaches back — that is its whole job.",
                    contrast: [
                        "I have lived here for about six years.",
                        "I'm living here for six months while the office moves."
                    ],
                    retryCue: "How far back does *am living* reach? If the six years have to start six years ago and arrive at today, which helper does that?",
                    grammaticalButDifferent: true,
                    logAs: "gram.present-perfect",
                    errorKind: "present-continuous-for-perfect"
                },
                {
                    forAnswer: "had lived",
                    reason: "This form needs a later moment in the past to be measured against — *By the time I left, I had lived here for six years* — and there is no such moment in this conversation, so the sentence is left hanging. Take that extra layer out and you get the two answers that do work: *I lived here for six years* if the period is over, *I have lived here for six years* if it is still going.",
                    contrast: [
                        "I lived here for about six years.",
                        "By the time I moved, I had lived here for six years."
                    ],
                    retryCue: "What later past moment are the six years being measured up to? If there isn't one, drop a layer.",
                    grammaticalButDifferent: false,
                    logAs: "gram.verb-form",
                    errorKind: "past-perfect-without-reference-point"
                }
            ],
            fallbackFeedback: {
                reason: "Two answers are right here and they say opposite things: *I lived here for six years* means that stretch is over, and *I have lived here for six years* means you still live here. Both are natural, and both are contracted in speech (*I've lived*). *I was living here for six years* is not what the *-ing* past is for — that form wants a moment to be the background to, as in *I was living here when the metro opened* — and *I am living here for six years*, though it is ordinary Indian English for the still-true meaning, does not reach backwards for a listener outside the region.",
                contrast: [
                    "I lived here for about six years.",
                    "I have lived here for about six years."
                ],
                retryCue: "Decide first whether the six years are over or still running — the form follows from that."
            },
            alsoNotice: "*For six years* is a length, not a date, which is why the perfect is even possible here. Put a date in and the choice disappears: *I lived here from 2015 to 2021* can only be the past simple, because *from 2015 to 2021* states a time that is over."
        }
    ],

    produce: {
        id: "past-simple-produce",
        task: "Out loud, tell the story of one ordinary day that is over — yesterday, or the last time you travelled somewhere. Six or seven sentences, and do not write them down first. Put a time word in the very first sentence (*yesterday*, *last Sunday*, *in March*) and then keep going. Use at least three irregular verbs, one negative with *didn't*, and finish by asking your listener two questions about their day starting *Did you…?* or *What did you…?*",
        targetSeconds: 60,
        useLanguage: [
            "Yesterday / Last Sunday / In March… — a stated past time, in the first sentence",
            "went / got / took / saw / had / said — irregular pasts, at least three",
            "I didn't… — one negative, with the main verb left plain",
            "Did you…? / What did you…? — two questions, with the main verb left plain"
        ],
        selfCheck: [
            "Did I put a time word in at the start and then keep the verbs in the past — or did I drift back into the present after the first sentence?",
            "After *didn't*, did the verb come out plain — *didn't go*, not *didn't went*?",
            "After *did* in my two questions, the same — *Did you go?*, not *Did you went?*",
            "Did I use any *have + verb* form in a sentence that also stated a past time? If I did, that one has to become a past simple.",
            "Which irregular pasts did I hesitate on? Those three or four are the whole of tonight's revision."
        ],
        model: {
            text: "Yesterday was a long day. I left home at seven because I had to drop my sister at the station, and the traffic on the flyover was terrible. I got to the office around half past nine, so I missed the first half of the standup. Nobody said anything, luckily. I didn't have lunch until three — we had a client call that ran over — and then the power went off for twenty minutes and everybody just stood around talking. I finally sent the report at seven. How was your day? Did you get out on time?",
            note: "Read it once for the shape, then look away from the screen and tell your own. Reading it aloud is not the exercise. Two things to notice before you look away: there is not a single *have + verb* anywhere in it, because every sentence is in finished time — and the question at the end leaves its verb plain, *Did you get*, not *Did you got*."
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            transferId: "T-G6",
            priority: "M",
            note: "Telugu marks completion, and it marks it on the verb — and two habits come out of those two facts. First the perfective. *Nēnu vāḍini ninna cūśānu*, \"I saw him yesterday\", reports a completed event, and Telugu attaches no condition at all about whether a time is mentioned: completion is completion. English splits that single idea in two and puts a restriction on one half, because *have* + participle does not report that the action is complete — it reports that the stretch of time it sits in is still open, and a stated past time closes that stretch. Nothing in Telugu could have warned you, which is why *I have seen him last week* feels not merely acceptable but careful: you have marked completion, which is what your first language asks of you. It is also why the habit survives fluency — the sentence communicates perfectly and no listener in India will correct it. Second, the helper. Telugu has no borrowed auxiliary anywhere: tense is a suffix on the verb, in statements, questions and negatives alike, and the verb keeps it in every one of them. So when English asks you to take the past OFF the verb and put it on a word borrowed from nowhere — *did* — the natural move is to mark it in both places, because marking the verb is what tense IS. *Did you went?* is not carelessness; it is the past marked the Telugu way and the English way at the same time.",
            bridge: "Two habits, two fixes, and they are separate — so practise them separately. For the first, make the time word the trigger rather than the verb. If a sentence contains *yesterday*, *last week*, *in 2019*, *when I was small*, *at school*, then the verb has exactly one possible shape and *have* cannot appear in the sentence at all. Drill it in one direction only: say the time word FIRST, out loud, and let it force the verb — *Last week… I saw him. In March… I went to Bangalore. Yesterday… I didn't come.* Never start from the verb and work back. For the second, remember that English marks the past once per clause, and let *did* be the one that does it. Say the three shapes of one verb as a set, ten verbs a day: *I went / Did you go? / I didn't go.* The past is on *went* in the first and on *did* in the other two, and the main verb is plain both times. There is a bonus hidden in that: because *did* carries the tense, questions and negatives never need an irregular form at all — so if *brought* or *taught* will not come to you mid-sentence, the safe road is *Did you bring it?* And you already know this helper from point 6, where you borrowed it to put something in front of the subject. It is the same word doing its other job."
        }
    },

    review: {
        rulePrompt: "One line before you start: anything in time that is over takes the past simple, and a stated past time — *yesterday*, *last week*, *in 2019* — makes it the only choice; mark the past once, either on the verb (*went*) or on a borrowed *did*, in which case the verb goes back to plain (*Did you go?*, *I didn't go*).",
        itemIds: ["past-simple-p3", "past-simple-p6", "past-simple-p1"]
    },

    tags: ["past-simple", "tense", "do-support", "irregular-verbs", "finished-time", "T-G6", "high-frequency"]
};

// Match the js/core/* pattern: a lexical global for the browser, CommonJS for
// the Jest suite. `module` is undefined in a classic script, so this is inert
// there.
if (typeof module !== "undefined" && module.exports) {
    module.exports = { GRAMMAR_PAST_SIMPLE: GRAMMAR_PAST_SIMPLE };
}

// Self-registration, exactly as data/grammar/be.js, countability.js,
// question-formation.js and prepositions.js do it. `grammarLessons` in
// data/grammar.js is a top-level `const`, i.e. a lexical global, so a classic
// script loaded AFTER it can read the binding by bare name and push into the
// tier array.
//
// The guards cover the two things that can actually go wrong: a script-order
// mistake (grammar.js absent) leaves the point unregistered instead of throwing
// during page load, and an id already present is not pushed twice — so if this
// point is ever folded into data/grammar.js inline, this file becomes a no-op
// rather than producing a duplicate.
//
// A duplicate <script> include of THIS file is a different matter: it throws
// "GRAMMAR_PAST_SIMPLE has already been declared" at parse time, as a second
// include of any file in this codebase would. That is the classic-script
// contract, not something these guards can rescue.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.foundation) &&
    !grammarLessons.foundation.some(function (p) { return p && p.id === GRAMMAR_PAST_SIMPLE.id; })) {
    grammarLessons.foundation.push(GRAMMAR_PAST_SIMPLE);
}
