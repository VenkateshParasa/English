/**
 * Grammar point 7 — prepositions after verbs (and the ones after adjectives).
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `GRAMMAR_PREPOSITIONS`. Same schema, field for field, as the `articles` point
 * in data/grammar.js — read that file's header comment for what each field is
 * for. Nothing is added to the schema here and nothing is left out.
 *
 * CURRICULUM.md §3 Strand B point 7, and REQUIREMENTS.md §3.2 row T-G7
 * ("Postposition → preposition", priority S): *"discuss about"*, *"return
 * back"*, *"cope up with"*.
 *
 * `js/core/mistakes.js` routes `gram.preposition-transfer` here with
 * `drill: { strand: 'grammar', target: 'prepositions' }`. That is why the id
 * below is exactly `prepositions` and must never be "prettified" to
 * `prepositions-after-verbs` or the like: the dashboard's "practise this" button
 * for that row builds `gram:prepositions`, and until this file existed it opened
 * nothing (US-187).
 *
 * ⚠️ FOUR AUTHORING NOTES
 *
 * 1. THE FRAMING: TWO ERRORS THAT LOOK IDENTICAL AND ARE NOT. This is the point
 *    that is usually taught badly, and the reason is that "wrong preposition" is
 *    used as one label for two unrelated things:
 *
 *      (a) *discuss about it*, *return back*, *reply back*, *order for a coffee*
 *          The verb ALREADY CONTAINS the relation. *Discuss* is "talk about";
 *          *return* is "go back"/"give back"; *order* is "ask for". The extra
 *          word is not a wrong choice, it is a SECOND COPY of something already
 *          inside the verb. The learner can detect every one of these alone,
 *          with no list and no teacher, by one move: say the verb in other
 *          words, and see whether the preposition turns up in your own
 *          paraphrase. If it does, it is already in there.
 *
 *      (b) *good in maths*, *married with a doctor*, *depend from*
 *          Nothing is doubled. Something HAS to join *good* to *maths*, and
 *          English happens to have chosen *at* where Telugu chose *lō*. There is
 *          no meaning to unpack, no redundancy to hear, and NO REASON TO FIND.
 *
 *    The whole design of this point is that (a) and (b) are never described in
 *    the same sentence. `rule` states both halves separately; `decide` is one
 *    question that SORTS an utterance into (a) or (b) before doing anything
 *    else; every `retryCue` in group (a) asks "what does the verb already mean?"
 *    and no `retryCue` in group (b) does, because there would be nothing to
 *    answer.
 *
 *    The cost of lumping them is specific and worth naming: it takes away the
 *    one family the learner could have solved by thinking, and it implies the
 *    other family is solvable, which sends them looking for a rule that does not
 *    exist. BR-3 and TEACHING_METHODOLOGY.md §5 both forbid inventing one, so
 *    group (b) is stated as arbitrary, in those words, in `rule`, `explain`,
 *    `caveats` and the group's feedback — the honest instruction is "learn the
 *    two words as one word", and that is what is given.
 *
 *    The taxonomy in js/core/mistakes.js already makes exactly this split, which
 *    is why it is reflected in `logAs` rather than only in prose:
 *      group (a) → `gram.preposition-transfer` — "An extra preposition after the
 *                  verb" (T-G7); its drill is this point.
 *      group (b) → `vocab.collocation` — "The right word with the wrong partner
 *                  word … These pairings are learned together, as a phrase."
 *    A group (b) miss is not a grammar gap and the dashboard should not tell the
 *    learner it is one. Cross-strand `logAs` is established here, not invented:
 *    the schema comment blesses it (an articles item logs
 *    `gram.uncountable-plural` "because that is where the drill that fixes it
 *    lives").
 *
 * 2. NOTHING HERE IS CALLED BROKEN ENGLISH. *Discuss about*, *return back*,
 *    *reply back*, *cope up with*, *order for* and *good in* are regular
 *    features of Indian English, used by tens of millions of people who
 *    understand each other perfectly. So the frame is audience, exactly as
 *    data/grammar/question-formation.js frames invariant *isn't it?*: these
 *    forms cost you nothing inside India and are read as errors outside it, so
 *    the reason to drop the extra word is who is listening, not what is
 *    "correct". `caveats` says this in plain words, and `whyItMatters` does not
 *    inflate it (methodology principle 3) — the honest cost is a written-English
 *    and exam cost, plus a listener abroad noticing the form instead of the
 *    point.
 *
 * 3. PREPOSITIONS ARE THE WORST FIELD IN THE SYLLABUS FOR SECOND RIGHT ANSWERS,
 *    and the option sets were built adversarially because of it. Three forms
 *    that ARE correct English were kept out of `options` on purpose and named in
 *    `fallbackFeedback` instead, because each is a true synonym of an accepted
 *    answer and US-188 forbids accepting a synonym (`renderGrammarCorrect`
 *    asserts that two accepted answers "do not mean the same thing"):
 *      *depend upon* (= *depend on*, register only)
 *      *throw it for the dog* / *throw it towards the dog* (≈ *to the dog*)
 *      transitive *agree the timeline* (British business usage, ≈ *agree to*)
 *    Dialect pairs were avoided in `options` altogether for the same reason:
 *    *at the weekend* (British) and *on the weekend* (American) are both correct
 *    and mean the same thing, so an item that offered both would either mark
 *    real English wrong or assert a difference that is not there. They are in
 *    `caveats`.
 *    Exactly one item has two accepted answers — `prepositions-p6`, *threw it
 *    **to** the dog* versus *threw it **at** the dog* — and those two are as far
 *    from synonyms as this point gets, which is why it is the only item with
 *    `showDifferenceOnCorrect: true`.
 *
 * 4. ALL SIX ITEMS ARE `mode: 'gap'`. app.js implements only that mode and
 *    renders a "cannot show" note for any other, so a `repair` item would be
 *    unteachable content. Where the target is the presence or absence of a word
 *    rather than the choice between words, the gap simply holds the whole
 *    verb-plus-particle region (*discuss* / *discuss about*), so that the
 *    learner is choosing whether the word is there at all.
 *
 * NO MISSING CATEGORY. Both ids this point needs already exist
 * (`gram.preposition-transfer`, `vocab.collocation`), so nothing was invented.
 * One id was deliberately NOT used: `gram.register-indian` (T-G9) would be an
 * accurate label for *she'll revert* meaning "she'll reply", but its drill
 * points at `register`, a Strand A point that does not exist yet, so logging
 * there would reproduce the dead-button bug this file was written to fix. That
 * option is not offered; *revert* is discussed in prose instead.
 *
 * ONE THING THIS FILE DELIBERATELY DOES NOT CALL, and it needs a decision from
 * whoever wires the <script> tags: js/core/mistakes.js now offers
 * `Mistakes.registerDrillTargets('grammar', 'prepositions')` so content can
 * declare that a drill destination exists (US-187). Registering from here ALONE
 * would make things worse, not better, because `isAuthoredTarget()` returns
 * `false` — provably dead — for every target the populated registry does not
 * name. Verified in node: after this file registers by itself,
 * `isAuthoredTarget('grammar','articles' | 'be' | 'question-formation' |
 * 'countable-uncountable' | 'present-simple-vs-continuous')` all flip from
 * `null` ("unknown", draw the button) to `false`, and
 * `drillTarget('gram.articles').deadTargets` becomes `["articles"]` — i.e. one
 * unilateral registration would blank the drill buttons of the five points that
 * are already authored. The registry is all-or-nothing per strand, so all six
 * points register or none do. Until they all do, no claim is made here and the
 * `gram:prepositions` button is drawn on the `null` path, which is the correct
 * behaviour and is what makes this file fix the dead button on its own.
 * =============================================================================
 */

const GRAMMAR_PREPOSITIONS = {
    id: "prepositions",
    syllabusNumber: 7,
    tier: "foundation",
    cefr: "A2",
    title: "The small word after the verb: when to drop it, when to learn it",

    srsType: "gram",
    srsRef: "prepositions",
    srsKey: "gram:prepositions",
    mistakeCategory: "gram.preposition-transfer",

    // Advisory only — nothing in the methodology gates grammar. `be` because
    // half the examples here are *is/are* plus an adjective plus a preposition
    // (*she's good at…*, *he's married to…*), and `articles` because almost every
    // prepositional phrase in English has an article inside it (*at **the**
    // office*), so a learner still dropping articles will hear their own correct
    // preposition inside a sentence that still sounds wrong.
    prerequisites: ["be", "articles"],

    rule: "Before you add a small word after a verb, ask what the verb already means: if the word is inside the meaning (*discuss* is \"talk **about**\", *return* is \"go **back**\") then saying it twice is the error — and if nothing is doubled, the preposition is simply the partner English chose for that word (*good **at***, *married **to***, *depend **on***), which has no logic behind it and is learned as one phrase.",

    explain: "Telugu marks who-did-what-to-whom with a small word AFTER the noun — *gurinchi* (about), *tō* (with), *lō* (in), *kōsam* (for), *ki* (to) — and English marks it with a small word BEFORE the noun. That much is a swap, and it is not the problem. The problem is that the two sets do not line up one to one, and they fail to line up in two completely different ways. Sometimes the English verb has swallowed the relation whole: your Telugu is *dāni gurinchi māṭlāḍu* — \"talk about it\" — and when *discuss* takes the place of *māṭlāḍu*, the *gurinchi* is left over, because *discuss* already means \"talk about\". Nothing was wrongly chosen there; a word was said twice, and you can hear it yourself once you know to listen. The other way is that nothing at all is doubled: *good* has to be joined to *maths* by something, Telugu joins it with *lō* (in), English joins it with *at*, and there is no reason for either. That second kind cannot be worked out, and this lesson will not pretend otherwise — those pairs are learned the way you learned *good morning*, as one thing with a space in it.",

    decide: [
        "First, sort it. Am I adding a word because the meaning needs it, or because it feels like something is missing? These are two different situations and they have two different answers.",
        "Say the verb in other words, out loud if you can. *Discuss* = talk **about**. *Return* = give **back**. *Reply* = answer **back**. *Order* = ask **for**. *Repeat* = say **again**. If the small word turns up in your own paraphrase, it is already inside the verb — drop it, and say nothing after the verb but the thing itself: *discuss the deadline*.",
        "Careful with the *re-* verbs, because *re-* IS the *back*: *reply*, *return*, *revert*, *repeat*, *reverse*, *react*. The direction is built into the front of the word, so it never needs adding at the end.",
        "If nothing is doubled — if the small word is doing a real job, joining two things that have to be joined — then stop reasoning. There is nothing to work out. *Good* takes *at*, *married* takes *to*, *depend* takes *on*, *cope* takes *with*, *listen* takes *to*, *interested* takes *in*. Learn the two words together as one item: not *good* + a preposition, but *good-at*.",
        "And do not over-correct. Most prepositions after verbs are load-bearing, not decoration: *shouted **at** me* and *shouted **to** me* are two different events, and *threw it **at** the dog* is not *threw it **to** the dog*. Deleting a word is only right when the verb already said it."
    ],

    whyItMatters: "Nobody will misunderstand *discuss about the budget* — the meaning arrives intact, which is exactly why these forms survive years of fluent English. The real cost is narrower and worth stating plainly: in writing, in exams, and with listeners outside India, an extra *about* or *back* is the kind of thing that gets noticed instead of your point, and it is cheap to fix because it is one word being removed rather than a structure being rebuilt. The group you cannot reason out — *good at*, *married to*, *depend on* — matters slightly more, because a wrong partner word can genuinely slow a listener down: *married with a doctor* makes an English ear look for children before it finds the spouse.",

    notice: {
        lines: [
            { speaker: "Manager", text: "Have you had a chance to look at the vendor mail?" },
            { speaker: "You", text: "Not yet. Can we **discuss** it after lunch?" },
            { speaker: "Manager", text: "Sure. I'll **reply** to them once we've decided — it **depends on** what you two agree." },
            { speaker: "You", text: "Fine. Sneha's **good at** spotting the hidden charges, so let's **wait for** her." },
            { speaker: "Manager", text: "She's on leave — her sister's **married to** someone in Pune and there's a function." },
            { speaker: "You", text: "Then I'll **return** the draft with comments and we'll **cope with** it ourselves." }
        ],
        question: "Six bold phrases. Three of them have no small word after the verb at all, and three of them have one that could not be removed. Which are which — and what makes the difference?",
        answer: "No small word: *discuss it*, *reply* (the *to them* names a person, not the reply), *return the draft*. Each of those verbs already contains the relation — *discuss* is \"talk about\", *reply* and *return* both begin with *re-*, which IS \"back\". Adding it again (*discuss about it*, *reply back*, *return back*) says the same thing twice. With a small word that cannot go: *depend **on***, *good **at***, *married **to***, *wait **for***, *cope **with***. Nothing is doubled in any of those — *depend* does not mean \"depend on\" all by itself; something has to join it to what follows, and English picked *on*. That is the difference, and it is the whole lesson: the first group is a word said twice, which you can catch yourself, and the second group is a partnership you memorise. Notice too that *married to* and *married with* are both real English doing different jobs — *married **to** a doctor* is who she married, *married **with** two children* is what the couple has."
    },

    contrast: [
        {
            pair: [
                {
                    text: "Can we return the file?",
                    means: "Give it back — to whoever lent it to us. *Return* on its own already carries the \"back\": there is nothing to add."
                },
                {
                    text: "Can we return to the file?",
                    means: "Go back to it — pick up the discussion of the file where we left off. Here *to* is not decoration; it changes the whole event from handing something over to resuming something."
                }
            ],
            takeaway: "Both are correct, and only the small word changed. This is the pair to hold on to, because it shows the two halves of the point at once: *to* is doing real work, so it stays — and *back* would be doing no work at all, because *return* already means \"go back\" / \"give back\", which is why *return back the file* is the one version English does not have."
        },
        {
            pair: [
                {
                    text: "He shouted at me.",
                    means: "Angry, aimed at you — you were what the shouting was directed against. This is the version that means you were told off."
                },
                {
                    text: "He shouted to me.",
                    means: "Across a distance, so you would hear — from the far end of the platform, probably to tell you which coach to get in. No anger in it at all."
                }
            ],
            takeaway: "Both are correct and they are not the same event, which is the honest warning against over-correcting. Once you learn to delete the extra *about* and *back*, there is a temptation to treat every small word as clutter. Most of them carry the meaning: *at* points, *to* connects. Nothing here is doubled, so nothing here comes out."
        },
        {
            pair: [
                {
                    text: "She's in the office.",
                    means: "Physically inside that room — you could open the door and see her. *In* is about being enclosed by something."
                },
                {
                    text: "She's at the office.",
                    means: "At work, rather than at home or travelling. *At* treats the office as a point on the map, not a room, so this is the one you use when someone asks where she is today."
                }
            ],
            takeaway: "Both are correct and both are useful, and neither could have been worked out from first principles — Telugu would use *lō* for both. That is what the second half of this lesson looks like in practice: a small set of very frequent partnerships (*at work*, *in hospital*, *on the bus*, *at home*) that are learned as fixed phrases, plus the comfort that when two of them are both possible, they usually differ in a way you can feel once you have met them."
        }
    ],

    spokenNote: "These words are almost never stressed, which is both why they are hard to hear and why dropping the extra one is easy to do in real speech. *At*, *to*, *of*, *for* and *from* all reduce to a schwa when they are not final: *good at it* is /ˈgʊdətɪt/ (three words, one run), *married to a doctor* is /ˈmæridtəə ˈdɒktə/, *waiting for you* is /ˈweɪtɪŋfəjə/. *To* before a consonant is /tə/ (*listen to me* → /ˈlɪsn̩təmi/) and before a vowel is /tʊ/. Two consequences worth knowing. First, when a preposition is the last word in a clause it stops reducing and takes a small stress: *Who are you waiting **for**?*, *That depends what it's **for**.* Second, because the correct forms are so unstressed, the extra word in *discuss about* is actually the loudest thing in the phrase for a listener — it stands out far more than its size suggests, which is the practical reason it is worth removing. If you want a drill that transfers to speech, say the two-word partnerships as single words with no gap: *good-at*, *married-to*, *depend-on*, *cope-with*, *wait-for*, *listen-to*.",

    caveats: [
        "*Discuss about*, *return back*, *reply back*, *cope up with*, *order for* and *good in* are regular, unremarkable features of Indian English. Hundreds of millions of people use them, understand each other perfectly, and are not making a mistake in any sense that matters at home. So this is a decision about audience, not about correctness: in international writing, in IELTS-style exams, and with listeners outside India, the extra word is heard as an error rather than as a variety, and removing it costs you a single word. Nobody has to change how they speak with their own colleagues to get that benefit.",
        "The \"is it already in the verb?\" test finds YOUR extra words. It does not tell you that every doubled-looking English phrase is wrong, because English keeps a few of its own: *meet up with*, *catch up with*, *put up with*, *end up*, *hurry up*, *finish up*, *wake up*. There is no way to derive that *cope up with* is not in that list while *catch up with* is — the test narrows where to look, and frequency does the rest. When you are unsure, the shorter form is the safer bet: *cope with*, *discuss*, *return* are never wrong.",
        "*Back* is genuinely correct with verbs that do not already contain it: *write back*, *call back*, *text back*, *pay back*, *get back to you*, *come back*. Those verbs say nothing about direction on their own, so *back* is adding information. It is only the *re-* verbs — *reply*, *return*, *revert*, *repeat*, *react*, *reverse* — where the *back* is already at the front of the word and adding it again is the repetition.",
        "One word to watch in office English: *revert*. In Indian business English *I'll revert* means \"I'll reply\", and it is completely standard here; internationally *revert* means \"go back to a previous state\" (*the file reverted to an older version*), so a reader outside India may be briefly confused. *I'll reply* / *I'll get back to you* are understood everywhere.",
        "Some pairs differ by country rather than by correctness, and neither is better: *at the weekend* (British) and *on the weekend* (American) are both right; so are *different from* and *different to* (British) beside *different than* (American), and *in hospital* beside *in the hospital*. Where you see two forms and cannot find a meaning difference, you have probably found one of these — pick one and be consistent rather than looking for a rule.",
        "The noun does need the preposition, even when the verb does not, and this is the single most useful footnote here: *discuss the plan* but *a discussion **about** the plan*; *marry someone* but *a marriage **to** someone*; *reply* but *a reply **to** your mail*. A verb can take an object directly; a noun cannot, so it needs a small word to reach one. If *discuss about* sounds right to you, that may be *discussion about* — which is correct — echoing in your ear.",
        "A preposition at the end of a sentence is fine and always was: *What are you waiting for?*, *Who did you give it to?*, *That's the file I was telling you about.* The rule against it was borrowed from Latin and never described English. Avoiding it produces *For what are you waiting?*, which no one says."
    ],

    commonErrors: [
        {
            heard: "Let's discuss about the new timeline.",
            fix: "Let's discuss the new timeline.",
            why: "Your Telugu is *dāni gurinchi māṭlāḍu* — \"about it talk\" — and *gurinchi* has to be there, because *māṭlāḍu* just means \"talk\". English *discuss* is not *talk*; it is *talk about*, both words folded into one. So the *about* has already been said, and *discuss about* says it twice. Test it whenever you are unsure: replace the verb with your own paraphrase, and if the small word appears in the paraphrase, it is already inside. Note that the noun is the other way round — *a discussion about the timeline* is correct, because a noun cannot take an object directly.",
            l1: "T-G7"
        },
        {
            heard: "I'll return back the documents tomorrow.",
            fix: "I'll return the documents tomorrow.",
            why: "In Telugu the \"back\" is a separate word — *tirigi ivvu*, \"back give\" — so leaving it out feels like leaving out half the meaning. In English the *back* is at the front of the word: *re-* means back, and *return* is \"turn back\". The same is true of *reply* (answer back), *repeat* (say again), *revert* (turn back) and *react*. Where the verb has no *re-*, *back* is welcome and normal: *write back*, *call back*, *pay back*.",
            l1: "T-G7"
        },
        {
            heard: "She hasn't replied back to my mail yet.",
            fix: "She hasn't replied to my mail yet.",
            why: "Same *re-* as *return*: a reply is already something that comes back, so *reply back* is a repetition rather than a wrong choice. Keep the *to*, though — that one is doing real work, naming what the reply answers: *reply **to** the mail*, *reply **to** her*. This is the distinction the whole lesson turns on: *back* was a second copy of something inside the verb, *to* is a connector that nothing else supplies.",
            l1: "T-G7"
        },
        {
            heard: "Shall I order for two coffees?",
            fix: "Shall I order two coffees?",
            why: "*Kāfī kōsam* — *kōsam* is \"for\", and it is required in Telugu. But English *order* already means \"ask for\", so the *for* is the second copy. There is a real *order for* in English and it is worth knowing so the phrase does not sound wrong to you when you meet it: *an order **for** fifty units* (the noun again), and *I ordered a coffee **for** Sneha* — where *for* names the person it is meant for, not the thing being ordered.",
            l1: "T-G7"
        },
        {
            heard: "How are you coping up with the new system?",
            fix: "How are you coping with the new system?",
            why: "This one is worth separating into its two halves, because they are different problems. That *cope* takes *with* is arbitrary — nothing about the word predicts it, and you simply learn *cope-with* as one item. The *up*, though, has no job at all: it has drifted in from the phrases that do have it (*put up with*, *catch up with*, *keep up with*), which is easy to do because English really does say those. *Cope with* is the whole pattern, and *How are you coping?* with nothing after it is also perfect English.",
            l1: "T-G7"
        },
        {
            heard: "My sister is very good in maths, and she is married with an engineer.",
            fix: "My sister is very good at maths, and she is married to an engineer.",
            why: "Neither of these is a doubling, and this is the honest part of the lesson: there is nothing to detect here and no reasoning that would have got you to the answer. Telugu joins *good* to *maths* with *lō* (in) and joins *married* to the person with *tō* (with); English chose *at* and *to*. Both choices are arbitrary, in both languages. So do not look for the logic — learn the pairs as single words: *good-at*, *married-to*, *interested-in*, *depend-on*, *afraid-of*. (*Married with* is real English with a different job: *married with two children* says what the couple has, not who she married — which is why an English ear briefly looks for the children.)",
            l1: "T-G7"
        }
    ],

    practice: [
        {
            id: "prepositions-p1",
            mode: "gap",
            focus: "the-verb-already-contains-about-so-adding-it-repeats-it",
            // Group (a), the detectable family, and the first item on purpose:
            // the learner meets the redundancy test before meeting anything
            // arbitrary. The gap holds the verb-plus-particle region so the
            // choice is whether the small word is there at all — which is how
            // presence/absence gets tested inside the only mode app.js
            // implements.
            prompt: "Ten minutes left in a team meeting. \"Before we finish — can we ___ the deadline? I don't think Friday is realistic any more.\"",
            options: ["discuss", "discuss about", "discuss on", "discuss regarding"],
            accept: [
                { answer: "discuss", means: "*Discuss* takes the thing straight after it, because the \"about\" is already inside the word — *discuss* IS \"talk about\". Nothing is missing from this sentence." }
            ],
            spoken: "*Can we discuss the deadline?* → /kənwi dɪˈskʌs ðə ˈdedlaɪn/. Stress on *-cuss* and on *dead-*. There is no gap and no small word between *discuss* and *the*, and that unbroken run is what the phrase should feel like in your mouth.",
            feedback: [
                {
                    forAnswer: "discuss about",
                    reason: "Nothing was wrongly chosen here — a word was said twice. In Telugu you need *gurinchi*, because *māṭlāḍu* only means \"talk\" and something has to supply the \"about\". English *discuss* has both halves folded into one word: it means \"talk about\". So *discuss about the deadline* is \"talk about about the deadline\", and you can catch this one yourself every single time, without a list: say the verb in your own words, and if the small word shows up in your paraphrase, it is already inside the verb. (This form is completely ordinary in Indian English and nobody will misunderstand you. It is worth dropping for readers and listeners outside India, where it is noticed.)",
                    contrast: [
                        "Can we discuss the deadline?",
                        "Can we have a discussion about the deadline?"
                    ],
                    retryCue: "Say *discuss* in other words. Does the word *about* appear in your own definition of it? Then how many times does the sentence need it?",
                    grammaticalButDifferent: false,
                    logAs: "gram.preposition-transfer",
                    errorKind: "redundant-particle-already-in-verb-meaning"
                },
                {
                    forAnswer: "discuss on",
                    reason: "Same doubling, with a different small word: *discuss* has the relation built in, so nothing goes between it and the thing being discussed. *On* has a real use with the nouns nearby — *a talk **on** the new process*, *a paper **on** climate*, *comments **on** my draft* — which is probably why it feels available here. But the verb *discuss* reaches its object directly: *discuss the deadline*.",
                    contrast: [
                        "Can we discuss the deadline?",
                        "She's giving a talk on the new process."
                    ],
                    retryCue: "*Discuss* already means \"talk about\". What has to come between it and *the deadline*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.preposition-transfer",
                    errorKind: "redundant-particle-already-in-verb-meaning"
                },
                {
                    forAnswer: "discuss regarding",
                    reason: "*Regarding* is a real word and it is doing the same job as *about* — which is exactly the problem, because *discuss* has already done that job. It is also a heavy, formal word that mostly lives at the start of business mails (*Regarding your invoice…*), so in speech it makes a simple sentence sound like a letter. The verb needs nothing: *discuss the deadline*.",
                    contrast: [
                        "Can we discuss the deadline?",
                        "Regarding the deadline — I don't think Friday is realistic."
                    ],
                    retryCue: "*Regarding* means \"about\". Is *about* already inside *discuss*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.preposition-transfer",
                    errorKind: "redundant-formal-connector-after-verb"
                }
            ],
            fallbackFeedback: {
                reason: "*Discuss* reaches its object with nothing in between, because the \"about\" is already inside the verb: *discuss the deadline*. Other true answers exist and they keep that shape — *talk about the deadline* and *go over the deadline* are both natural, and both use a verb that does NOT contain the relation, which is why they need a small word and *discuss* does not.",
                contrast: [
                    "Can we discuss the deadline?",
                    "Can we talk about the deadline?"
                ],
                retryCue: "Put the thing straight after the verb, with nothing between them — unless the verb genuinely needs a connector, the way *talk* does."
            },
            alsoNotice: "The noun goes the other way, and this is worth knowing because it is probably the source of the habit: *a discussion **about** the deadline* is correct. A verb can take an object directly; a noun cannot, so it needs a small word to reach one. Same with *marry someone* / *a marriage **to** someone*."
        },
        {
            id: "prepositions-p2",
            mode: "gap",
            focus: "the-re-prefix-already-means-back",
            // Group (a) again, and the item that turns the test into something
            // mechanical: *re-* is visible on the page, so this family can be
            // spotted by looking rather than by paraphrasing. One distractor
            // (*answer back*) is real English with a quite different meaning,
            // which keeps the item from teaching "delete every particle".
            prompt: "\"I mailed the vendor two days ago and heard nothing.\" — \"She's travelling. Give it till Monday and she'll ___, I'm sure.\"",
            options: ["reply", "reply back", "revert back", "answer back"],
            accept: [
                { answer: "reply", means: "A reply is already something that comes back — *re-* is the \"back\" — so the verb needs nothing after it here. If you want to name what she is replying to, *to* does that: *she'll reply to your mail*." }
            ],
            spoken: "*She'll reply on Monday* → /ʃil rɪˈplaɪ/. Stress on the second syllable, *-ply*, and the *re-* is reduced almost to nothing: /rɪ/. That is worth hearing, because the syllable carrying the whole meaning of \"back\" is the quietest one in the word.",
            feedback: [
                {
                    forAnswer: "reply back",
                    reason: "Look at the front of the word: *re-* means back, so *reply* is already \"answer back\" and adding *back* says it a second time. This family is the easiest one in English to catch, because you can see it — *reply*, *return*, *revert*, *repeat*, *react*, *reverse* all carry the direction in the first syllable. What makes it feel wrong to leave out is that Telugu puts the \"back\" in a separate word (*tirigi*), so removing it feels like removing meaning. Nothing is lost: *she'll reply* is complete. And notice that *back* is perfectly correct with verbs that do not already contain it — *she'll write back*, *she'll call back*, *she'll get back to you*.",
                    contrast: [
                        "Give it till Monday and she'll reply.",
                        "Give it till Monday and she'll write back."
                    ],
                    retryCue: "What does the *re-* at the front of *reply* already mean? Then does the end of the word need it again?",
                    grammaticalButDifferent: false,
                    logAs: "gram.preposition-transfer",
                    errorKind: "back-added-to-re-prefixed-verb"
                },
                {
                    forAnswer: "revert back",
                    reason: "Two things here, and the first is the same *re-* — *revert* is \"turn back\", so *revert back* doubles it. The second is worth knowing separately: in Indian business English *I'll revert* is a completely standard way to say \"I'll reply\", and inside India it will be understood instantly. Elsewhere *revert* means \"go back to a previous state\" — *the file reverted to an older version* — so a reader abroad may pause. *She'll reply* and *she'll get back to you* work everywhere.",
                    contrast: [
                        "Give it till Monday and she'll reply.",
                        "The document reverted to the previous version when it crashed."
                    ],
                    retryCue: "Both *revert* and *reply* start with the *re-* that already means back. Which of them, with nothing added, means \"send an answer\" to any English speaker anywhere?",
                    grammaticalButDifferent: false,
                    logAs: "gram.preposition-transfer",
                    errorKind: "back-added-to-re-prefixed-verb"
                },
                {
                    forAnswer: "answer back",
                    reason: "This is real English, and it is the reason \"delete the small word\" is not the lesson: *answer back* is a fixed phrase meaning to reply rudely to someone with authority over you — *don't answer back* is what a child gets told. So this sentence would suggest the vendor is going to be cheeky with you. The plain verb is what you want: *she'll answer* is fine, and *she'll reply* is the more natural word in a work context.",
                    contrast: [
                        "Give it till Monday and she'll reply.",
                        "He got into trouble for answering back to his teacher."
                    ],
                    retryCue: "*Answer back* means something specific about attitude. Which verb here just means \"send a response\"?",
                    grammaticalButDifferent: true,
                    logAs: "vocab.collocation",
                    errorKind: "fixed-phrase-with-unintended-meaning"
                }
            ],
            fallbackFeedback: {
                reason: "The *re-* at the front of *reply* already means \"back\", so nothing goes after the verb: *she'll reply*. Several other answers are equally correct here and they show where *back* IS welcome — *she'll write back*, *she'll get back to you*, *she'll respond*. Those verbs say nothing about direction on their own, so the *back* is adding information rather than repeating it.",
                contrast: [
                    "Give it till Monday and she'll reply.",
                    "Give it till Monday and she'll get back to you."
                ],
                retryCue: "Check the front of the verb first. If it starts with *re-*, the \"back\" is already there."
            },
            alsoNotice: "*Reply* does take a small word when you name what is being answered, and it is *to*, not *about*: *reply **to** your mail*, *reply **to** her*. That *to* is a connector doing real work — nothing else in the sentence supplies it — which is a different thing entirely from the *back* that was already inside the verb."
        },
        {
            id: "prepositions-p3",
            mode: "gap",
            focus: "an-arbitrary-partner-word-plus-a-particle-that-does-nothing",
            // The hinge item. *cope up with* contains BOTH families at once: the
            // *with* is arbitrary and must be memorised, the *up* is a passenger
            // with no job. Teaching them separately in one phrase is what the
            // rest of the lesson is built on, and this is where the learner sees
            // the two questions applied to the same string.
            prompt: "\"Two people left the team and nobody is replacing them.\" — \"That's rough. How is Divya ___ all the extra work?\"",
            options: ["coping with", "coping up with", "coping up", "coping"],
            accept: [
                { answer: "coping with", means: "The whole pattern is *cope with something*: *with* is the partner word this verb comes with, and it is what joins *coping* to *all the extra work*." }
            ],
            spoken: "*How is she coping with all this?* → /ˈkəʊpɪŋwɪð ˈɔːl ðɪs/. *Coping with* runs together as one unit with no gap and no stress on *with*, which is how you should practise it: *cope-with*, one word. The /ð/ at the end of *with* usually survives before a vowel and often disappears before a consonant.",
            feedback: [
                {
                    forAnswer: "coping up with",
                    reason: "There are two separate things in here and they need separating, because only one of them is your doing. That *cope* takes *with* is arbitrary — no reasoning gets you there, you learn *cope-with* as one item, and you have that part right. The *up* is the extra, and it has no job at all: it cannot be explained, because it is not adding anything. It has drifted in from the very common phrases that genuinely have it — *put up with*, *catch up with*, *keep up with* — and that is an easy slip precisely because those are real English. *Cope with* is the complete pattern. (*Coping up with* is unremarkable in Indian English; the reason to drop the *up* is readers and listeners elsewhere.)",
                    contrast: [
                        "How is Divya coping with all the extra work?",
                        "How is Divya keeping up with all the extra work?"
                    ],
                    retryCue: "Ask what the *up* contributes to the meaning. If you cannot say, what is left when you take it out?",
                    grammaticalButDifferent: false,
                    logAs: "gram.preposition-transfer",
                    errorKind: "extra-particle-borrowed-from-another-phrasal-verb"
                },
                {
                    forAnswer: "coping up",
                    reason: "The *up* again, and this time the *with* has gone with it — so now nothing joins the verb to *all the extra work*. That is the half of this phrase you cannot reason your way to and simply have to know: *cope* comes with *with*, always, whenever you name the thing being coped with. Drop the *up*, keep the *with*: *coping with all the extra work*.",
                    contrast: [
                        "How is Divya coping with all the extra work?",
                        "How is Divya standing up to all this pressure?"
                    ],
                    retryCue: "Which small word does *cope* always travel with when you say what someone is coping with?",
                    grammaticalButDifferent: false,
                    logAs: "vocab.collocation",
                    errorKind: "partner-word-missing-plus-extra-particle"
                },
                {
                    forAnswer: "coping",
                    reason: "On its own this is excellent English — *How is she coping?* is exactly what an English speaker would ask, and you should keep it. It only fails here because of what follows: this sentence goes on to name the thing (*all the extra work*), and *cope* cannot reach a thing by itself. Its partner word is *with*, and that is the arbitrary bit worth memorising: *cope* alone when nothing follows, *cope with* the moment you name what.",
                    contrast: [
                        "How is Divya coping with all the extra work?",
                        "Two people left. How is Divya coping?"
                    ],
                    retryCue: "Read on past the gap. Something is named after it — so what has to join the verb to it?",
                    grammaticalButDifferent: true,
                    logAs: "vocab.collocation",
                    errorKind: "partner-word-missing-before-named-object"
                }
            ],
            fallbackFeedback: {
                reason: "*Cope* takes *with* when you name what is being coped with: *coping with all the extra work*. Other true answers here use different verbs with their own partner words — *managing all the extra work* (no small word at all), *dealing with all the extra work*, *getting through all the extra work*. Each verb comes with its own arrangement, and there is no way to predict which; they are learned as phrases.",
                contrast: [
                    "How is Divya coping with all the extra work?",
                    "How is Divya managing all the extra work?"
                ],
                retryCue: "Two questions in order: is any word here repeating something the verb already means — and if not, which partner word does this verb come with?"
            },
            alsoNotice: "*Manage* is the useful comparison: *managing all the extra work* needs no small word, *coping with all the extra work* does, and the two verbs mean almost the same thing. That is the clearest possible sign that this half of the lesson is not about meaning — it is about which words English happens to pair, which is why it is memory work rather than thinking work."
        },
        {
            id: "prepositions-p4",
            mode: "gap",
            focus: "arbitrary-preposition-after-an-adjective",
            // Group (b), pure: nothing is doubled and there is nothing to
            // detect. The feedback for the target error says so in as many
            // words, because BR-3 forbids inventing a rule to make it feel
            // learnable. The noun was chosen as an activity (*explaining
            // things*) rather than *numbers* or *maths*, because *good with
            // numbers* and *good with computers* are both correct and would have
            // made the answer set open.
            prompt: "\"Should Divya run the induction session for the new joiners?\" — \"Definitely. She's ___ explaining things — nobody ever leaves her desk still confused.\"",
            options: ["good at", "good in", "good for", "good to"],
            accept: [
                { answer: "good at", means: "*Good at* is the pattern for a skill or an activity — what someone can do well: *good at explaining*, *good at maths*, *good at her job*." }
            ],
            spoken: "*She's good at explaining things* → /ʃiz ˈgʊdət ɪkˈspleɪnɪŋ/. *Good at* fuses into one unit, /ˈgʊdət/, with the /t/ running straight into the vowel of *explaining*. Practise it as a single word — *goodat* — because that is what it is in speech, and it is also the most reliable way to stop the wrong preposition arriving.",
            feedback: [
                {
                    forAnswer: "good in",
                    reason: "Nothing is doubled here, so there is nothing to detect and no reasoning that would have got you to the answer — this is the arbitrary half of the lesson and it is worth being told so plainly. Telugu joins *good* to a subject or skill with *lō* (*lekkallō*, \"in maths\"), and English happens to use *at*. Neither choice has a reason behind it; English simply settled on *at* for skills and activities. So do not look for the logic: learn it as one word, *good-at*, the way you learned *good morning*. (*Good in* is very widely used in Indian English and will be understood; *good at* is what is expected elsewhere and in writing.) One real *good in* does exist, and it is about time, not skill: *she's good in a crisis*.",
                    contrast: [
                        "She's good at explaining things.",
                        "She's good in a crisis — she doesn't panic."
                    ],
                    retryCue: "There is nothing to work out in this one. Which small word does English pair with *good* when what follows is a skill?",
                    grammaticalButDifferent: false,
                    logAs: "vocab.collocation",
                    errorKind: "arbitrary-preposition-after-adjective"
                },
                {
                    forAnswer: "good for",
                    reason: "*Good for* is real English, and it says something quite different: it is about benefit, not ability. *Walking is good for you*, *this room is good for small meetings*, *she'd be good for the role* — in each of those, something is useful to somebody. Here you are talking about what Divya can do well, and the pattern for ability is *good at*. Same adjective, different partner word, different job — which is exactly why these have to be learned as pairs rather than as *good* plus a preposition of your choosing.",
                    contrast: [
                        "She's good at explaining things.",
                        "A short session would be good for the new joiners."
                    ],
                    retryCue: "Is this sentence about something being useful to someone, or about what a person can do well? Which pair goes with ability?",
                    grammaticalButDifferent: true,
                    logAs: "vocab.collocation",
                    errorKind: "arbitrary-preposition-after-adjective"
                },
                {
                    forAnswer: "good to",
                    reason: "Also real English, also a different meaning: *good to someone* is about kindness — *she's been very good to me since I joined*, *be good to your parents*. There is no ability in it at all. The ability pattern is *good at*. It is worth collecting the whole family in one go, because they all behave like this and none of them can be worked out: *good at* (skill), *good with* (things or people you handle — *good with children*, *good with numbers*), *good for* (benefit), *good to* (kindness).",
                    contrast: [
                        "She's good at explaining things.",
                        "She's been very good to me since I joined."
                    ],
                    retryCue: "Kindness, or skill? Then which of the four *good* pairs is the skill one?",
                    grammaticalButDifferent: true,
                    logAs: "vocab.collocation",
                    errorKind: "arbitrary-preposition-after-adjective"
                }
            ],
            fallbackFeedback: {
                reason: "The pattern for a skill is *good at*: *good at explaining things*. Other true answers here change the adjective rather than the preposition — *great at explaining things*, *brilliant at explaining things*, *very clear when she explains things* — and notice that *great* and *brilliant* keep the same *at*, because the partner word belongs to this whole family of ability adjectives.",
                contrast: [
                    "She's good at explaining things.",
                    "She's brilliant at explaining things."
                ],
                retryCue: "Nothing is repeated in this sentence, so nothing needs removing. The only question is which partner word English pairs with an ability adjective."
            },
            alsoNotice: "The other member of this family worth learning at the same time is *good with*, for things and people you handle: *good with children*, *good with her hands*, *good with numbers*, *good with computers*. Both *good at* and *good with* are correct English, so this is not a case of one right answer — it is two fixed phrases that happen to divide the world between activities and things."
        },
        {
            id: "prepositions-p5",
            mode: "gap",
            focus: "arbitrary-preposition-where-the-alternative-is-real-english-elsewhere",
            prompt: "\"Do you know Rajesh's wife at all?\" — \"Not really. I know she's a paediatrician, and that he's been ___ her for about ten years.\"",
            options: ["married to", "married with", "married by", "married for"],
            accept: [
                { answer: "married to", means: "*Married to* names the person you married — the spouse. English chose *to* for this and there is nothing further to say about why." }
            ],
            spoken: "*He's married to her* → /hiz ˈmæridtəhə/ or, faster, /ˈmæridtəə/ with the /h/ of *her* gone altogether. *Married to* is one unstressed run; the stress is on *mar-* and then on whatever follows. Say it as a single word, *married-to*, and the wrong preposition stops being available to you.",
            feedback: [
                {
                    forAnswer: "married with",
                    reason: "Nothing is doubled here — something has to join *married* to the person, and Telugu joins it with *tō* (*ḍākṭar tō pelli*), which is exactly \"with\". English picked *to*. There is no reason behind either choice, so this is memory rather than logic: *married-to*, learned as one word. What makes this one worth care is that *married with* is also real English doing a different job: it says what the couple has, not who they married. *He's married with two children* is a complete, natural sentence about a man with a spouse and two kids. So an English listener hearing *married with her* starts looking for the children — the confusion is brief, but it is real, which is why this pair is worth getting exactly right.",
                    contrast: [
                        "He's been married to her for about ten years.",
                        "He's married with two children — the younger one's just started school."
                    ],
                    retryCue: "There is nothing to work out here. Which small word does English pair with *married* when the next thing you say is the person?",
                    grammaticalButDifferent: true,
                    logAs: "vocab.collocation",
                    errorKind: "arbitrary-preposition-after-adjective"
                },
                {
                    forAnswer: "married by",
                    reason: "*Married by* is correct English for one specific thing: the person who performed the ceremony. *They were married by her uncle, who's a priest.* So *by* names the official, never the spouse — and it needs the past (*they were married by…*), because it describes the wedding day rather than the state of being married since. For the spouse it is *to*: *married to her*.",
                    contrast: [
                        "He's been married to her for about ten years.",
                        "They were married by her uncle in a small ceremony."
                    ],
                    retryCue: "Are you naming the person he married, or the person who conducted the wedding? Which small word goes with the spouse?",
                    grammaticalButDifferent: true,
                    logAs: "vocab.collocation",
                    errorKind: "arbitrary-preposition-after-adjective"
                },
                {
                    forAnswer: "married for",
                    reason: "*For* does belong in this sentence, but further along: it measures the time, not the person — *married for ten years*. That is why it feels available; the sentence really does end *for about ten years*. What *for* cannot do is introduce the spouse, and only one small word does that: *married **to** her for about ten years*. (There is also *married for money*, where *for* gives the reason, which is a third job again.)",
                    contrast: [
                        "He's been married to her for about ten years.",
                        "They've been married for about ten years."
                    ],
                    retryCue: "*For* is already doing a job later in this sentence. What is it measuring there — and what is the word right after the gap?",
                    grammaticalButDifferent: true,
                    logAs: "vocab.collocation",
                    errorKind: "arbitrary-preposition-after-adjective"
                }
            ],
            fallbackFeedback: {
                reason: "The spouse is introduced by *to*: *married to her*. Other true answers avoid the adjective entirely and are worth having — *he married her about ten years ago* (the verb *marry* takes the person directly, with no small word at all), *they've been married for about ten years*, *she's his wife*. Notice the split: the verb *marry* needs nothing, the adjective *married* needs *to*, and neither fact can be derived from the other.",
                contrast: [
                    "He's been married to her for about ten years.",
                    "He married her about ten years ago."
                ],
                retryCue: "Nothing is repeated here, so nothing comes out. Which partner word does *married* take before a person?"
            },
            alsoNotice: "*Marry* the verb takes the person straight after it — *he married her*, never *he married with her* or *he married to her* — while *married* the adjective needs *to*. Two forms of one word, two different arrangements, no logic connecting them. This is why the safest unit to memorise is the whole phrase, not the word."
        },
        {
            id: "prepositions-p6",
            mode: "gap",
            focus: "the-preposition-carries-the-meaning-so-two-choices-are-two-events",
            // TWO right answers, and the item exists to stop the lesson being
            // heard as "delete the small word". *to* and *at* are as far from
            // synonyms as this point gets — one is a gift, the other is an
            // assault — so showDifferenceOnCorrect is honest here (US-188).
            // *for the dog* and *towards the dog* are also correct and are named
            // in fallbackFeedback rather than offered, because both are near
            // enough to *to* that accepting them would break the same rule.
            prompt: "In the park, explaining the state of the tennis ball. \"Aravind threw it ___ the dog, and it ended up in the pond.\"",
            options: ["to", "at", "on", "in"],
            accept: [
                { answer: "to", means: "He wanted the dog to have it — a throw for the dog to catch or chase. *To* connects two points and hands something over." },
                { answer: "at", means: "He was aiming for the dog, trying to hit it — shooing it away, or being unkind. *At* points a thing in a direction, with the target on the receiving end, which is a very different afternoon in the park." }
            ],
            showDifferenceOnCorrect: true,
            spoken: "Both are unstressed and short: *threw it to the dog* → /ˈθruːɪttə ðə ˈdɒg/, *threw it at the dog* → /ˈθruːɪtət ðə ˈdɒg/. In fast speech the difference is one reduced vowel and a consonant, which is why the whole meaning can turn on a syllable you can barely hear. When it matters, English speakers slow down and stress it: *he threw it **AT** the dog*.",
            feedback: [
                {
                    forAnswer: "on",
                    reason: "Telugu and Hindi both use a locative here — the ball goes \"on\" the dog — and English uses *on* that way only when something ends up lying over or covering the thing: *he threw a blanket on the dog*, *she threw water on the fire*. A tennis ball does not cover a dog, so an English ear will not accept it as the aiming word. English has two aiming words and they mean opposite things: *to the dog* (so it can have it) and *at the dog* (trying to hit it). Both would be right in this sentence, and neither of them is *on*.",
                    contrast: [
                        "Aravind threw it to the dog, and it ended up in the pond.",
                        "Aravind threw a blanket on the dog to dry it off."
                    ],
                    retryCue: "Was the ball meant to land on top of the dog — or to travel towards it? Which two words does English use for travelling towards?",
                    // Real English in its own use (*threw a blanket on the dog*,
                    // *threw it on the bed*), so this is `true`: the learner has
                    // produced a genuine English pattern in a slot that wants a
                    // directional word, not a broken one.
                    grammaticalButDifferent: true,
                    logAs: "vocab.collocation",
                    errorKind: "locative-transfer-for-a-directional-preposition"
                },
                {
                    forAnswer: "in",
                    reason: "*In* names what something ends up inside, and it is used correctly later in this very sentence: *it ended up **in** the pond*. So the word is right, in the right sentence, in the wrong slot — a dog is not a container. What the gap needs is a direction: *to the dog* if the dog was meant to get it, *at the dog* if the dog was the target.",
                    contrast: [
                        "Aravind threw it to the dog, and it ended up in the pond.",
                        "Aravind threw it in the pond, and the dog went in after it."
                    ],
                    retryCue: "*In* is already used later in the sentence. What is it doing there — and is a dog that kind of thing?",
                    grammaticalButDifferent: true,
                    logAs: "vocab.collocation",
                    errorKind: "container-preposition-for-a-directional-one"
                }
            ],
            fallbackFeedback: {
                reason: "Both *to the dog* (so the dog could have it) and *at the dog* (aiming at it) are right, and they describe two different events. Two more answers are just as correct and were left out of the options only to keep the choice clean: *threw it **for** the dog* — for the dog to chase, the fetch game — and *threw it **towards** the dog*, which is *to* with the arrival left open. What none of them are is optional: this is a gap where the small word carries the meaning, so nothing can be deleted.",
                contrast: [
                    "Aravind threw it to the dog, and it ended up in the pond.",
                    "Aravind threw it at the dog, and it ended up in the pond."
                ],
                retryCue: "Ask what actually happened: was the dog supposed to get the ball, or to be hit by it? English has a different small word for each."
            },
            alsoNotice: "This is the item to remember when you start deleting extra words: most prepositions after a verb are not clutter, they are the meaning. *Throw it to me* and *throw it at me* differ by one syllable and by whether we are still friends. Deleting a small word is only right when the verb already said it — *discuss*, *return*, *reply* — and never as a general habit."
        }
    ],

    produce: {
        id: "prepositions-produce",
        task: "Out loud, tell someone about a problem at work that took a while to sort out — 60 seconds, no writing it down first. Somewhere in it, use *discuss* and *return* or *reply* with nothing after them, and use three of these partnerships as single words: *depend on*, *cope with*, *wait for*, *good at*, *married to*, *interested in*, *listen to*. Then say one sentence where the small word carries the meaning — *I shouted **at** him* or *I shouted **to** him* — and notice that you had to choose.",
        targetSeconds: 60,
        useLanguage: [
            "We discussed… / I returned… / She replied… — the verb with nothing after it, at least twice",
            "It depends on… / I'm coping with… / We're waiting for… — a partnership said as one word, three times",
            "She's good at… / He's married to… / I'm interested in… — the same for adjectives, at least once",
            "I shouted at / to him… — one sentence where the small word is the meaning"
        ],
        selfCheck: [
            "After *discuss*, did the thing come straight next — *discuss the delay* — with no *about* in between?",
            "After a *re-* verb (*reply*, *return*, *repeat*), did I leave out *back*?",
            "Did I say the partnerships as single unstressed runs — *dependon*, *copewith*, *goodat* — rather than pausing before the small word?",
            "In my *shouted at / to* sentence, did I choose the one that matched what actually happened?",
            "Did I get through the whole minute without stopping to hunt for a preposition mid-sentence?"
        ],
        model: {
            text: "So the vendor sent the wrong parts, and when I mailed them nobody replied for three days. I couldn't return the box either, because it depended on their pickup team. Anyway, Divya's good at this sort of thing — she's dealt with them before — so we discussed it on Friday and she just phoned the supervisor. She's very good with people. I'd have shouted at him, honestly.",
            note: "Read this once for the shape of it, then look away from the screen and tell a real story out loud — yours, or an invented one. Reading it aloud is not the exercise: prepositions go wrong when you are thinking about the story instead of the words, so the point is to be thinking about the story."
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            transferId: "T-G7",
            priority: "S",
            note: "Telugu marks relations after the noun, English marks them before it, and that swap is genuinely the easy part: *gurinchi* (about), *tō* (with), *lō* (in), *kōsam* (for), *ki* (to), *nuṇḍi* (from). What makes this point hard is that the two sets do not line up one to one, and they fail to line up in two ways that have nothing to do with each other. First: some English verbs have swallowed the relation whole. Your Telugu for *discuss* is *X gurinchi māṭlāḍu*, \"talk about X\", and *gurinchi* is compulsory there — but English *discuss* already means \"talk about\", so when *discuss* replaces *māṭlāḍu*, the *about* is a second copy. The same for *tirigi ivvu* → *return* (*re-* is the *tirigi*), *kāfī kōsam adugu* → *order* (which already means \"ask for\"), and *tirigi javābu ivvu* → *reply*. Every one of those you can catch yourself, by paraphrasing the verb. Second, and completely different: sometimes nothing is doubled and the two languages have simply chosen different words for the same joint. *Lekkallō manci* is \"good in maths\", and English says *good at*. *Ḍākṭar tō pelli* is \"married with a doctor\", and English says *married to*. There is nothing to detect in those, no rule waiting to be found, and this lesson will not invent one. Worth saying once more: all of these forms — *discuss about*, *return back*, *cope up with*, *good in maths* — are ordinary Indian English, spoken by tens of millions of people who understand each other perfectly. Nothing about your English is broken. The reason to change them is a reader or listener outside India, where they are noticed as errors instead of heard as a variety.",
            bridge: "Two questions, always in this order, and the first one is the whole trick. QUESTION ONE: say the verb in other words. *Discuss* = talk about. *Return* = give back. *Reply* = answer back. *Order* = ask for. *Repeat* = say again. If the small word appears in your own paraphrase, it is already inside the verb — so drop it, and put the thing straight after the verb. The *re-* verbs make this visible: *re-* IS *back*, so *reply*, *return*, *revert*, *repeat* and *react* never take *back* after them (while *write*, *call*, *text* and *pay* happily do, because they say nothing about direction on their own). QUESTION TWO, only if nothing is doubled: stop reasoning. There is no logic to find, and looking for one is how learners waste months on this. Learn the pair as a single word instead — *goodat*, *marriedto*, *dependon*, *copewith*, *waitfor*, *listento*, *interestedin*, *afraidof* — said in one unstressed run, which is also exactly how they sound in real speech. Ten of those, learned as words rather than as rules, will cover most of what you say in a day. And one guard-rail: do not turn the first question into a habit of deleting small words, because most of them are the meaning. *Shouted at me* and *shouted to me* are different events. Deletion is only for the words the verb had already said."
        }
    },

    review: {
        rulePrompt: "One line before you start: if the small word is already inside the verb (*discuss* = talk about, *return* = go back), saying it again is the error — and if nothing is doubled, the preposition is just the partner English chose (*good at*, *married to*, *cope with*), with no reason behind it, so it is learned as one phrase rather than worked out.",
        itemIds: ["prepositions-p3", "prepositions-p6", "prepositions-p1"]
    },

    tags: ["prepositions", "verb-patterns", "collocation", "redundancy", "adjective-plus-preposition", "phrasal-verbs", "T-G7", "indian-english"]
};

// Match the js/core/* pattern: a lexical global for the browser, CommonJS for
// the Jest suite. `module` is undefined in a classic script, so this is inert
// there.
if (typeof module !== "undefined" && module.exports) {
    module.exports = { GRAMMAR_PREPOSITIONS: GRAMMAR_PREPOSITIONS };
}

// Self-registration, exactly as data/grammar/be.js, countability.js and
// question-formation.js do it. `grammarLessons` in data/grammar.js is a
// top-level `const`, i.e. a lexical global, so a classic script loaded AFTER it
// can read the binding by bare name and push into the tier array.
//
// The guards cover the two things that can actually go wrong: a script-order
// mistake (grammar.js absent) leaves the point unregistered instead of throwing
// during page load, and an id already present is not pushed twice — so if this
// point is ever folded into data/grammar.js inline, this file becomes a no-op
// rather than producing a duplicate.
//
// A duplicate <script> include of THIS file is a different matter: it throws
// "GRAMMAR_PREPOSITIONS has already been declared" at parse time, as a second
// include of any file in this codebase would. That is the classic-script
// contract, not something these guards can rescue.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.foundation) &&
    !grammarLessons.foundation.some(function (p) { return p && p.id === GRAMMAR_PREPOSITIONS.id; })) {
    grammarLessons.foundation.push(GRAMMAR_PREPOSITIONS);
}
