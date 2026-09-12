/**
 * Grammar point 4 — countable vs uncountable nouns.
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `GRAMMAR_COUNTABILITY`. Same schema, field for field, as the `articles` point
 * in data/grammar.js — read that file's header comment for what each field is
 * for. Nothing is added to the schema here and nothing is left out.
 *
 * CURRICULUM.md §3 Strand B point 4; T-G4 in REQUIREMENTS.md §3.2
 * ("Uncountables pluralised" — *informations*, *advices*, *furnitures*).
 *
 * ⚠️ MISTAKE-CATEGORY NOTE (see the report accompanying this file)
 * js/core/mistakes.js has no row for an uncountable treated as countable *with
 * an article* — "a work", "a meat", "an advice". The only countability row is
 * `gram.uncountable-plural`, whose learner-facing label is specifically
 * 'Plural "-s" on a word that has no plural'. That label is false for "an
 * advice", where no -s is present.
 *
 * This file logs those errors as `gram.uncountable-plural` anyway, deliberately:
 * it is the countability category (MISTAKE_CATEGORY_ALIASES in data/grammar.js
 * maps "countable-uncountable" → this id) and its `drill` target is
 * `countable-uncountable`, which is the correct remediation. Routing them to
 * `gram.articles` instead would send the learner to the wrong drill. The finer
 * distinction is preserved in `errorKind: "uncountable-with-article"` on every
 * affected feedback entry, so the split is recoverable in one pass once
 * mistakes.js gains a row. Do not invent a new id here — that file owns the
 * taxonomy, and an unknown id lands everything in 'general.uncategorised'.
 * =============================================================================
 */

const GRAMMAR_COUNTABILITY = {
    id: "countable-uncountable",
    syllabusNumber: 4,
    tier: "foundation",
    cefr: "A1–A2",
    title: "Things you can count, and stuff you cannot",

    srsType: "gram",
    srsRef: "countable-uncountable",
    srsKey: "gram:countable-uncountable",
    mistakeCategory: "gram.uncountable-plural",

    // Deliberately empty. The `articles` point lists this point as its
    // prerequisite, and prerequisites are advisory, so naming `articles` here
    // would create a cycle for any loader that tries to order by them. Nothing
    // in this point needs articles taught first: the article facts it uses
    // ("a" means one, so it cannot go in front of uncountable stuff) are taught
    // in place.
    prerequisites: [],

    rule: "Before you put **-s** or **a** on a noun, ask whether English counts that thing at all: some nouns name stuff rather than separate items — *advice*, *information*, *furniture*, *luggage*, *work* — and with those the number goes on a unit word instead, as in *two pieces of advice*.",

    explain: "English sorts nouns into things it counts and stuff it measures, and the sorting is a fact about each word rather than about the world. *Furniture* is stuff; *chair* is a thing, even though a room contains both in the same way. Telugu attaches its plural to almost any noun that has a plural meaning, so *renḍu salahālu* — two advices — is ordinary Telugu, and the English -s goes on by the same reflex. The repair is not to memorise which words are forbidden a plural, though the core list is short enough to learn. It is to notice that English moves the counting outside the word: you count *pieces*, *bits*, *bottles*, *items*, and the noun itself never changes.",

    decide: [
        "Am I naming separate items I could point at one at a time, or the stuff itself? *Three chairs* — items. *Some furniture* — stuff, so no -s and no **a**.",
        "If I need a number, what unit am I counting? Put the number on the unit word and leave the noun alone: *two pieces of advice*, *three bottles of water*, *a bit of information*.",
        "Am I about to say *many* or *a* in front of one of these words? Swap to *much*, *a lot of*, or *some* — or swap the noun for a countable one: not *a work* but *a job*, not *a news* but *a news story*.",
        "If I do put -s on it, check what the plural has turned the word into. *Two coffees* is two cups. *Her works* are her paintings. If that is not what I meant, take the -s off."
    ],

    whyItMatters: "Most of this costs you nothing in understanding — nobody has ever been confused by *informations*, and it is ordinary usage across South Asia. It is worth fixing for one reason and one reason only: after articles, it is the feature that most marks your English as regional to a listener from outside the region. Two cases do change your meaning, though, and those are worth real attention: *a work* sends your listener looking for a painting, and *two experiences* on your CV says something quite different from *two years of experience*.",

    notice: {
        lines: [
            { speaker: "Colleague", text: "Have you got a minute? I need some **advice**." },
            { speaker: "You", text: "Of course. Is it about the visa?" },
            { speaker: "Colleague", text: "Yes. I have found three **pieces of information** online and all three say something different." }
        ],
        question: "Both *advice* and *information* work the same way in English. So why is one of them just *advice*, while the other has *pieces of* stuck in front of it?",
        answer: "Because *some* does not need a number, and *three* does. Neither word can take -s, so as soon as a number appears it has to land somewhere else — on *pieces*. The noun itself is untouched in both sentences: *advice*, *information*, never *advices* or *informations*. Notice too that the unit words are fixed by habit rather than logic: it is **a piece of information** and **a bit of advice**, and *an advice* or *an information* is not English at all."
    },

    contrast: [
        {
            pair: [
                {
                    text: "Would you like coffee?",
                    means: "The drink in general — I am asking whether coffee is what you drink, or offering you as much as you want from the pot."
                },
                {
                    text: "Would you like a coffee?",
                    means: "One serving of it. A cup, right now. This is what you say in a café or when you are getting up to make one."
                }
            ],
            takeaway: "Both are correct. The **a** does not make *coffee* countable in general — it counts a serving. Same with *two waters* for two bottles and *three teas* for three cups: the plural is on the servings, not on the liquid."
        },
        {
            pair: [
                {
                    text: "She has a lot of experience.",
                    means: "Knowledge built up from years of doing the work. This is what a CV or an interview means by the word."
                },
                {
                    text: "She has a lot of experiences.",
                    means: "Many separate things have happened to her — she has lived through a lot. You would say this about someone's life, not their qualifications."
                }
            ],
            takeaway: "Both are correct English and they are not interchangeable. Without -s, *experience* is knowledge; with -s, *experiences* are events. In a job interview only the first one is what you meant."
        },
        {
            pair: [
                {
                    text: "I saw his work at the gallery.",
                    means: "What he produces, taken as a whole — his output, his style, whatever was on the walls."
                },
                {
                    text: "I saw his works at the gallery.",
                    means: "Several individual pieces, countable, that you could list. This use is fairly formal and belongs to art, music and writing."
                }
            ],
            takeaway: "*Work* meaning labour or a job has no plural and takes no **a** — this is where *a work* and *I am looking for a work* come from. *Works* exists, but it means finished artworks, so it sends your listener somewhere you did not intend."
        }
    ],

    spokenNote: "Two things to hear. First, the unit phrases run together into single chunks in real speech — *a piece of* is /əˈpiːsəv/, *a bit of* is /əˈbɪdəv/, *a lot of* is /əˈlɒtəv/ — so learn them as one word each rather than assembling them from three. Second, *advice* already ends in /s/, so adding the plural produces an extra syllable, /ədˈvaɪsɪz/, and that extra syllable is the single most audible form of this error; the same goes for *a piece of advice* said as /ədˈvaɪsɪz/. And *news* is pronounced with a /z/, /njuːz/, which is exactly why it sounds plural and exactly why you have to remember it is not: *the news is*, never *the news are*.",

    caveats: [
        "The core list really does have no plural in ordinary use, and it is short enough to learn as a list: *advice*, *information*, *furniture*, *equipment*, *luggage*, *baggage*, *news*, *work* (labour), *money*, *traffic*, *weather*, *homework*, *research*, *progress*, *accommodation*. No rule predicts membership — *furniture* is stuff and *chair* is a thing for no reason you can derive.",
        "Do not turn this into \"these words are never plural\". A great many nouns go both ways with a change of meaning: *a coffee* (a cup), *two waters* (two bottles), *experiences* (events) against *experience* (knowledge), *works* (artworks) against *work* (labour), *papers* (documents) against *paper* (the material), *a hair* (one strand) against *hair* (all of it). When you hear a plural on one of these, it is not a mistake you are hearing — check what the plural has done to the meaning.",
        "*Data* and *media* are genuinely unsettled. Careful speakers write both *the data is* and *the data are*, and this app will not mark either wrong.",
        "British and American English disagree about group nouns: *the staff are meeting* (British) and *the staff is meeting* (American) are both standard, as are *the team have won* and *the team has won*. Neither is marked wrong here.",
        "*Equipments*, *informations* and *furnitures* are used and understood by hundreds of millions of English speakers, and no listener will misunderstand you. This point flags them because they mark your English as regional, not because they are unclear. That is a smaller claim than \"this is wrong\", and it is the honest one."
    ],

    commonErrors: [
        {
            heard: "He gave me some good advices.",
            fix: "He gave me some good advice. / He gave me a couple of good tips.",
            why: "*Some* already covers the amount, so the -s has no work to do. If you want a number, either move it onto a unit word (*two pieces of advice*) or use a countable word that means nearly the same thing (*tips*, *suggestions*, *pointers*).",
            l1: "T-G4"
        },
        {
            heard: "I need more informations about the course.",
            fix: "I need more information about the course. / I need a few more details about the course.",
            why: "*Information* names the stuff, not the items, so it never takes -s. *Details* is the countable word that does the same job, and in speech most people reach for it.",
            l1: "T-G4"
        },
        {
            heard: "We have to buy furnitures for the new flat.",
            fix: "We have to buy furniture for the new flat. / We have to buy a few pieces of furniture.",
            why: "*Furniture* is the collective word — it already covers the sofa, the table and the beds together, so pluralising it is saying the same thing twice.",
            l1: "T-G4"
        },
        {
            heard: "I am looking for a work in Hyderabad.",
            fix: "I am looking for a job in Hyderabad. / I am looking for work in Hyderabad.",
            why: "*Work* in this sense has no **a**. English keeps a separate countable word for exactly this: *job*. Both fixes are natural — *a job* if you mean one position, *work* with nothing in front of it if you mean employment in general.",
            l1: "T-G4"
        },
        {
            heard: "The equipments are in the store room.",
            fix: "The equipment is in the store room.",
            why: "Two things move together here: the -s comes off, and the verb goes singular. Uncountable nouns take *is* and *was*, however much stuff you are talking about.",
            l1: "T-G4"
        },
        {
            heard: "There is a meat in the fridge.",
            fix: "There is some meat in the fridge.",
            why: "**A** counts one item, and *meat* is measured rather than counted. Use *some*, or name the unit: *a packet of meat*, *two chicken pieces*.",
            l1: "T-G4"
        }
    ],

    practice: [
        {
            id: "countable-uncountable-p1",
            mode: "gap",
            focus: "no-plural-and-no-a-on-uncountable",
            prompt: "Before you sign anything, you should get ___ from a lawyer.",
            options: ["advice", "advices", "an advice", "some advices"],
            accept: [
                { answer: "advice", means: "Advice in general, as much of it as you need. English never counts this word, so nothing goes on it and nothing goes in front of it." }
            ],
            // ONE right answer, so nothing extra is shown on a correct first try
            // (US-188). *Some advice* was accepted here and is not among the
            // options: the renderer builds one button per `options` entry and the
            // grammar section has no typed input at all, so it could never be
            // submitted (US-166) — and while it was listed, app.js announced "Both
            // answers here are right, and they do not mean the same thing" and then
            // named a form the learner had never been shown.
            //
            // DEMOTED rather than promoted, for the reason its own `means` gave
            // away: *some advice* means the same as *advice* here. *Some* says the
            // vague amount out loud and changes nothing else about the sentence, so
            // the two are not two readings but one answer with and without a
            // determiner. US-188 forbids accepting a true synonym precisely because
            // the flag would then assert a difference that does not exist. It stays
            // named as correct in `fallbackFeedback`, so a learner who thinks of it
            // is not told they are wrong.
            showDifferenceOnCorrect: false,
            spoken: "*get advice* → /ɡet ədˈvaɪs/, ending on a clean /s/ with no extra syllable after it. *some advice* → /səm ədˈvaɪs/, with *some* reduced almost to nothing.",
            feedback: [
                {
                    forAnswer: "advices",
                    reason: "*Advice* names the stuff itself rather than separate items, and English puts no -s on that kind of noun. The word never changes shape; the counting happens outside it, on a unit word — *a piece of advice*, *two pieces of advice*.",
                    contrast: [
                        "You should get advice from a lawyer.",
                        "You should get two opinions from a lawyer before you decide."
                    ],
                    retryCue: "Could I point at these one at a time and count them? If not, there is nowhere for the -s to go.",
                    grammaticalButDifferent: false,
                    logAs: "gram.uncountable-plural",
                    errorKind: "plural-s-on-uncountable"
                },
                {
                    forAnswer: "an advice",
                    reason: "**An** is a counting word — it means exactly one — so it hits the same wall as the -s. When you do mean one particular thing somebody told you, English counts the unit and not the noun: *a piece of advice*, *a bit of advice*.",
                    contrast: [
                        "You should get advice from a lawyer.",
                        "You should get a piece of advice from someone who has done this before."
                    ],
                    retryCue: "If I want one of these, what is the one thing I am counting — is there a unit word for it?",
                    grammaticalButDifferent: false,
                    logAs: "gram.uncountable-plural",
                    errorKind: "uncountable-with-article"
                },
                {
                    forAnswer: "some advices",
                    reason: "*Some* is exactly the right instinct — it is the English word for an amount you are not counting — and it does not need help from -s. *Some advice* is already complete.",
                    contrast: [
                        "You should get some advice from a lawyer.",
                        "You should get some names from a lawyer."
                    ],
                    retryCue: "Once I have said *some*, is there anything left for the -s to do?",
                    grammaticalButDifferent: false,
                    logAs: "gram.uncountable-plural",
                    errorKind: "plural-s-on-uncountable"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about what shape *advice* takes here, so it can only check forms of that word. *Some advice* and *a piece of advice* are both fine; *advices* and *an advice* are the two forms English does not have.",
                contrast: [
                    "You should get advice from a lawyer.",
                    "You should get a piece of advice from a lawyer."
                ],
                retryCue: "Try again with *advice*, and decide first whether you are counting anything at all."
            },
            alsoNotice: "*A lawyer* takes **a** without any trouble, in the same sentence. That is the whole point: countability is a fact about each word, not about how important or how physical the thing is."
        },
        {
            id: "countable-uncountable-p2",
            mode: "gap",
            focus: "counting-with-a-unit-word",
            prompt: "The email left out three ___ I actually needed: the venue, the time and the dress code.",
            options: ["informations", "pieces of information", "information", "details"],
            accept: [
                { answer: "pieces of information", means: "The number lands on *pieces*, and *information* stays exactly as it is. This is the unit-word route, and it works with every noun on the uncountable list." },
                { answer: "details", means: "A countable word that means nearly the same thing, so the number can go straight on it. This is the route fluent speakers take most often, because it is shorter." }
            ],
            // Two right answers, both offered, and they do genuinely different
            // work — a unit word carries the number, or a countable noun replaces
            // the uncountable one altogether — so the flag is true in fact and the
            // learner does need telling that the two are not the same move.
            //
            // *Bits of information* was accepted here as a third and is not among
            // the options, so it could never be submitted (US-166) while still
            // being read out on a correct answer. DEMOTED rather than promoted
            // because its own `means` said what the language says: *bit* and *piece*
            // are interchangeable in this slot, and US-188 will not have a true
            // synonym in an accept array — the flag would announce a difference
            // between *pieces of* and *bits of* that does not exist. It stays named
            // as correct in `fallbackFeedback`.
            showDifferenceOnCorrect: true,
            spoken: "*three pieces of information* is a mouthful, and in speech it compresses: /θriː ˈpiːsɪzəv ɪnfəˈmeɪʃn/, with *pieces of* run into one chunk. *three details* /θriː ˈdiːteɪlz/ is why people reach for it.",
            feedback: [
                {
                    forAnswer: "informations",
                    reason: "This is the -s the number pushed onto the wrong word. The number is real — there are three things — but *information* cannot carry it, so it has to move onto a word that counts: *pieces*, *bits*, or a countable noun like *details*.",
                    contrast: [
                        "The email left out three pieces of information I needed.",
                        "The email left out three attachments I needed."
                    ],
                    retryCue: "The number is right. What word can I put it on, so that *information* does not have to change?",
                    grammaticalButDifferent: false,
                    logAs: "gram.uncountable-plural",
                    errorKind: "plural-s-on-uncountable"
                },
                {
                    forAnswer: "information",
                    reason: "Taking the -s off is half of it, and the half you got right — but *three information* leaves the number with nothing to attach to. English will not let a bare number sit in front of an uncountable noun; something countable has to come between them.",
                    contrast: [
                        "The email left out three pieces of information I needed.",
                        "The email left out some information I needed."
                    ],
                    retryCue: "If I drop the number and say *some information*, the sentence works. So what do I add when I want to keep *three*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.uncountable-plural",
                    errorKind: "number-without-unit-word"
                }
            ],
            fallbackFeedback: {
                reason: "There are several right answers here and they are all built the same way: either a unit word carries the number (*pieces of information*, *bits of information*) or a countable noun replaces it (*details*, *things*).",
                contrast: [
                    "The email left out three pieces of information I needed.",
                    "The email left out three things I needed to know."
                ],
                retryCue: "Put the number on something countable. What could count these three?"
            },
            alsoNotice: "*Three things I needed to know* is what most people say out loud. *Three pieces of information* is correct but formal — it belongs in an email more than in a conversation, and knowing which register you are in is part of using it well."
        },
        {
            id: "countable-uncountable-p3",
            mode: "gap",
            focus: "plural-counts-the-serving",
            prompt: "The waiter came over and my friend said, \"Two ___, please.\"",
            options: ["coffee", "coffees", "cups of coffee", "coffee cups"],
            accept: [
                { answer: "coffees", means: "Two servings. The -s counts the cups, not the liquid, and this is what people genuinely say when they order." },
                { answer: "cups of coffee", means: "The same order, with the unit said out loud. Slightly more explicit, and always safe — you cannot go wrong naming the unit." }
            ],
            // Both are correct and the difference is register, not meaning. The
            // point of the item is that the plural is *not* an error here.
            showDifferenceOnCorrect: true,
            spoken: "*two coffees* → /tuː ˈkɒfiz/, ending on a /z/. In a café this is often just two fingers and \"two coffees, please\" — it does not need a full sentence.",
            feedback: [
                {
                    forAnswer: "coffee",
                    reason: "This is the over-correction: you have heard that *coffee* is uncountable and taken the -s off, but *two* needs something to count. Here you genuinely are counting — two cups — so the plural belongs. Uncountable nouns become countable the moment you mean servings of them.",
                    contrast: [
                        "Two coffees, please.",
                        "Do you drink coffee, or shall I make tea?"
                    ],
                    retryCue: "Am I talking about the drink in general, or about a number of cups on a tray?",
                    grammaticalButDifferent: false,
                    logAs: "gram.uncountable-plural",
                    errorKind: "over-applied-no-plural-rule"
                },
                {
                    forAnswer: "coffee cups",
                    reason: "This is real English, but it names the crockery rather than the drink — you would be asking the waiter for two empty cups. Word order is doing that: *cups of coffee* are full, *coffee cups* are the objects.",
                    contrast: [
                        "Two cups of coffee, please.",
                        "Could you bring two coffee cups? We want to share the pot."
                    ],
                    retryCue: "Do I want the drink, or the object it comes in? Which word is the head of the phrase?",
                    grammaticalButDifferent: true,
                    logAs: "gram.uncountable-plural",
                    errorKind: "unit-phrase-word-order"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about how you count a drink. Both *two coffees* and *two cups of coffee* are correct here, and either one would be understood in any café.",
                contrast: [
                    "Two coffees, please.",
                    "Two cups of coffee, please."
                ],
                retryCue: "You are counting servings, not liquid. What can the *two* sit in front of?"
            },
            alsoNotice: "The same move works with any drink and most food you order by the portion: *two waters*, *three teas*, *two beers*, *two ice creams*. Off the menu, though, the noun goes back to being uncountable — *I do not drink coffee*, not *I do not drink coffees*."
        },
        {
            id: "countable-uncountable-p4",
            mode: "gap",
            focus: "plural-changes-the-meaning",
            prompt: "I did not get the job. They wanted five years of ___ and I have two.",
            options: ["experience", "experiences", "an experience", "the experience"],
            accept: [
                { answer: "experience", means: "Knowledge and skill built up over time, measured in years rather than counted. This is the meaning every job advert has." }
            ],
            // ONE right answer, so nothing extra is shown on a correct first try
            // (US-188). *Work experience* was accepted and is not among the options,
            // so it was unreachable content (US-166) that the flag nevertheless read
            // out to a learner who had never seen it.
            //
            // DEMOTED, on two grounds. In this sentence it is the same answer with
            // the kind spelled out: *five years of experience* and *five years of
            // work experience* make the same claim to the same employer, and its own
            // `means` said so ("no more or less correct"), which is the true synonym
            // US-188 forbids. And it varies the NOUN, where every option here varies
            // only the number and the determiner — `options` must belong to one
            // grammatical set so that nothing but the target form changes, and this
            // item's target form is the -s. It stays named as correct in
            // `fallbackFeedback`.
            showDifferenceOnCorrect: false,
            spoken: "*years of experience* runs together: /ˈjɪəzəv ɪkˈspɪəriəns/. The stress is on *years* and on the middle of *experience*, and *of* almost disappears.",
            feedback: [
                {
                    forAnswer: "experiences",
                    reason: "The -s changes what the word means rather than just its number. *Experiences* are separate events you have lived through — a trek, a bad flight, a first day. Knowledge built up from working is *experience*, with no -s, and *years of* is the phrase that always goes with it.",
                    contrast: [
                        "They wanted five years of experience.",
                        "She has had some interesting experiences since she moved abroad."
                    ],
                    retryCue: "Do I mean things that happened to me, or what I have learned to do? Only the first one takes -s.",
                    grammaticalButDifferent: true,
                    logAs: "gram.uncountable-plural",
                    errorKind: "plural-shifts-meaning"
                },
                {
                    forAnswer: "an experience",
                    reason: "**An experience** is one single event, so it cannot follow *five years of* — you cannot have five years of one event. It is good English elsewhere: *living in Delhi was an experience*.",
                    contrast: [
                        "They wanted five years of experience.",
                        "Living in Delhi for a year was an experience I would not repeat."
                    ],
                    retryCue: "Is this one thing that happened on one day, or a slow build-up over years?",
                    grammaticalButDifferent: true,
                    logAs: "gram.uncountable-plural",
                    errorKind: "uncountable-with-article"
                },
                {
                    forAnswer: "the experience",
                    reason: "**The** points at some particular experience you and your listener have already agreed on, and here there is none — you are talking about experience in general, the kind anyone could have. Uncountable nouns used in general take no article at all.",
                    contrast: [
                        "They wanted five years of experience.",
                        "The experience of living abroad changed how she works."
                    ],
                    retryCue: "Have we already established which experience? If not, leave the slot empty.",
                    grammaticalButDifferent: true,
                    logAs: "gram.articles",
                    errorKind: "wrong-choice"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about the shape of *experience* after *five years of*. Both *experience* and *work experience* are correct; the forms with -s, with **a**, or with **the** all mean something else.",
                contrast: [
                    "They wanted five years of experience.",
                    "They wanted five years of work experience."
                ],
                retryCue: "Am I counting events, or measuring how much I know? Which shape does the second one take?"
            },
            alsoNotice: "This one is worth getting right because it is on your CV. *Two years of experience* says you can do the work; *two experiences* says two things happened to you, which is not what an employer asked."
        },
        {
            id: "countable-uncountable-p5",
            mode: "gap",
            focus: "much-and-a-lot-of-instead-of-many-and-a",
            prompt: "Do not worry about space in the car — I have not got ___ luggage.",
            options: ["much", "many", "a lot of", "a"],
            accept: [
                { answer: "much", means: "The measuring word. *Much* only ever goes with uncountable nouns, so choosing it correctly is itself proof that you have sorted the noun right." },
                { answer: "a lot of", means: "The one people actually say, and it goes with countable and uncountable nouns alike — so it commits you to nothing about *luggage*, where *much* commits you to reading it as stuff. Under a negative it also denies a large amount rather than insisting on a small one: *not a lot of luggage* leaves room for a middling pile, and *not much luggage* does not." }
            ],
            // Two right answers, both offered. *Lots of* and *any* were accepted
            // here too and neither is among the options, so neither could ever be
            // submitted (US-166) — and both were read out to a learner who had never
            // been shown them.
            //
            // Both DEMOTED, for different reasons. *Lots of* is interchangeable with
            // *a lot of* and its own `means` said so, which is exactly the synonym
            // US-188 keeps out of an accept array. *Any* is correct here and does
            // mean something different — none at all, rather than not much — but it
            // belongs to a different contrast from the one this item isolates: *any*
            // partners countable and uncountable nouns alike (*I have not got any
            // bags*), so clicking it would demonstrate nothing about the sorting this
            // item is for, and putting it in `options` would break the rule that
            // every option belongs to ONE grammatical set with nothing but the target
            // form varying. Both stay named as correct in `fallbackFeedback`.
            //
            // The two answers that remain differ in degree rather than in kind, which
            // is the thinnest difference this flag is set on anywhere in the file. It
            // stays set because both are offered and both are right, and US-188's
            // other half — omitting it on a two-answer item leaves the learner
            // thinking they are interchangeable — bites here: *much* is the one that
            // proves the noun was sorted.
            showDifferenceOnCorrect: true,
            spoken: "In this negative sentence the whole thing compresses: *I haven't got much luggage* → /aɪ ˈhævnt ɡɒt mʌtʃ ˈlʌɡɪdʒ/. *Luggage* ends /ɪdʒ/, not /ɪdʒɪz/ — the last sound is the one to keep clean.",
            feedback: [
                {
                    forAnswer: "many",
                    reason: "*Many* counts separate items, and *luggage* is the collective word for all of it together, so the two do not fit. You have a choice: keep the noun and swap the determiner (*not much luggage*), or keep the counting and swap the noun (*not many bags*).",
                    contrast: [
                        "I have not got much luggage.",
                        "I have not got many bags — just the one."
                    ],
                    retryCue: "Would I say *one luggage, two luggages*? If not, *many* cannot go there — so is it *much*, or should the noun become *bags*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.uncountable-plural",
                    errorKind: "many-with-uncountable"
                },
                {
                    forAnswer: "a",
                    reason: "**A** means exactly one, and *luggage* is not something English counts in ones — there is no *a luggage* and no *two luggages*. The countable words nearby are *bag*, *case* and *suitcase*: *I have not got a big bag*.",
                    contrast: [
                        "I have not got much luggage.",
                        "I have not got a big suitcase, only a rucksack."
                    ],
                    retryCue: "If I want to say *one*, what is the one thing I am holding — a bag, a case? Use that word and keep the **a**.",
                    grammaticalButDifferent: false,
                    logAs: "gram.uncountable-plural",
                    errorKind: "uncountable-with-article"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about which measuring word goes in front of *luggage*. *Much*, *a lot of*, *lots of* and *any* all work; *many* and **a** are the two that do not, because both of them count.",
                contrast: [
                    "I have not got much luggage.",
                    "I have not got a lot of luggage."
                ],
                retryCue: "Is this word one I would count, or one I would measure? Pick the measuring word."
            },
            alsoNotice: "The pairs are worth learning together, because they sort the noun for you: *much / many*, *a little / a few*, *a lot of* with either. If you can only remember one, remember *a lot of* — it never picks the wrong side."
        },
        {
            id: "countable-uncountable-p6",
            mode: "gap",
            focus: "singular-verb-with-an-uncountable-noun",
            prompt: "Have you heard? The news ___ not as bad as everyone expected.",
            options: ["is", "are", "was", "were"],
            accept: [
                { answer: "is", means: "One uncountable noun, so a singular verb. The -s on *news* is part of the word, not a plural ending." },
                { answer: "was", means: "The same agreement, in the past. Correct if you are reporting news you heard earlier rather than reacting to it now." }
            ],
            // Two right answers, and after this change both are offered. *Was* was
            // accepted and was not among the options, so it could never be submitted
            // (US-166) while app.js still read it out on a correct answer.
            //
            // PROMOTED rather than demoted, because it is the one unreachable answer
            // in this file that differs in MEANING: *is* reacts to news now, *was*
            // reports news heard earlier, and both readings sit happily in this
            // prompt. So the flag becomes true in fact rather than being cleared.
            //
            // It also repairs the option set. This item is about NUMBER — *news* is
            // one uncountable thing — and the past used to be representable only as
            // an error (*were*), so a learner who sorted the number correctly and
            // wanted the past had nowhere to go. The set is now two singular forms,
            // both right, against two plural forms, both wrong, so the correct/wrong
            // split falls exactly on the sub-rule the item isolates and the time is
            // free to vary.
            //
            // *Have been* made way for it, as the least valuable of the three
            // distractors: all three carried the same `errorKind`
            // (`plural-agreement-with-uncountable`), and its own feedback conceded
            // that the form is not what a speaker would reach for here anyway. No
            // diagnosis is lost — *are* and *were* still cover plural agreement with
            // an uncountable noun, in the present and in the past.
            showDifferenceOnCorrect: true,
            spoken: "*The news is* → /ðə ˈnjuːz ɪz/, which gives you /z/ then /ɪz/ back to back and feels wrong in the mouth at first. Say it slowly a few times; the awkwardness is the point where the habit gets made. *The news was* → /ðə ˈnjuːz wəz/ is easier to say, because the /w/ puts something between the two /z/ sounds for you.",
            feedback: [
                {
                    forAnswer: "are",
                    reason: "*News* ends in -s but it is not a plural — the -s is simply part of the word, like the -s in *maths*. It is one uncountable noun, so it takes a singular verb: *is* if you are reacting now, *was* if you are reporting news you heard earlier. There is no *a news* either: the countable units are *a news story* and *a piece of news*.",
                    contrast: [
                        "The news is not as bad as everyone expected.",
                        "The headlines are not as bad as everyone expected."
                    ],
                    retryCue: "Can I say *one news, two newses*? If not, the noun is singular however it is spelled.",
                    grammaticalButDifferent: false,
                    logAs: "gram.uncountable-plural",
                    errorKind: "plural-agreement-with-uncountable"
                },
                {
                    forAnswer: "were",
                    reason: "Two things at once: *were* is plural, and *news* is not. If you do want the past — because you heard it earlier — the form is *was*: *the news was not as bad as everyone expected*.",
                    contrast: [
                        "The news is not as bad as everyone expected.",
                        "The reports were not as bad as everyone expected."
                    ],
                    retryCue: "Singular or plural first, then present or past. Which singular form do I need?",
                    grammaticalButDifferent: false,
                    logAs: "gram.uncountable-plural",
                    errorKind: "plural-agreement-with-uncountable"
                }
            ],
            fallbackFeedback: {
                reason: "This item is about verb agreement after an uncountable noun. *Is* fits a reaction right now and *was* fits news you heard earlier; both are correct, and both are singular.",
                contrast: [
                    "The news is not as bad as everyone expected.",
                    "The news was not as bad as everyone expected."
                ],
                retryCue: "*News* is one uncountable thing. Which singular verb form does the timing call for?"
            },
            alsoNotice: "A handful of uncountable nouns look plural and take singular verbs: *news*, *maths*, *physics*, *politics*, *athletics*. The same singular agreement runs through the whole list you have been learning — *the equipment is*, *the furniture was*, *the information is*."
        }
    ],

    produce: {
        id: "countable-uncountable-produce",
        task: "Out loud, in about four sentences, describe what you packed the last time you travelled. Say how much **luggage** you had, using *much* or *a lot of* and no -s. Then count at least two things with a number and a unit word — *two bottles of water*, *a couple of pairs of shoes*, *three pieces of paper*.",
        targetSeconds: 45,
        useLanguage: [
            "luggage with no -s",
            "much or a lot of in front of it, never many or a",
            "a number plus a unit word for anything you count"
        ],
        selfCheck: [
            "Did I say **luggage** with no -s on the end?",
            "Did I use *much* or *a lot of* in front of it, rather than *many* or *a*?",
            "Did I put each number on a unit word — *bottles*, *pairs*, *pieces* — rather than on the noun itself?",
            "Did I get through all four sentences without stopping to plan the next one?"
        ],
        model: {
            text: "I did not take much luggage — just one bag for three days. I packed two pairs of trousers and a couple of shirts. I also took three bottles of water, because the flight was early and nothing was open. The only heavy thing was my laptop and its equipment.",
            note: "Read this once to see the shape of it, then look away from the screen and say your own version. Reading it aloud is not the exercise; producing your own sentences is."
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            transferId: "T-G4",
            priority: "M",
            note: "Telugu attaches its plural suffix -lu to almost any noun with a plural meaning, and it does not first check whether the thing is countable — *salahā* (సలహా, advice) becomes *salahālu*, and *renḍu salahālu*, two advices, is completely ordinary Telugu. English has an extra step that Telugu does not: it sorts nouns into ones it counts and ones it measures, and that sorting is arbitrary word by word. So the -s is not a mistake in your grammar; it is your grammar working correctly on a language that has an extra rule in the way. Notice too that Telugu can put a number straight in front of the noun, while English insists on a counting word in between, which is where *three pieces of information* comes from.",
            bridge: "Two habits transfer straight across. First: when you would add -lu in Telugu, pause and ask whether English counts that thing at all — if it does not, move the number onto a unit word, so *renḍu salahālu* comes out as *two pieces of advice*, not *two advices*. Second, and this is the one nobody teaches: when you hear an English plural on one of these words — *two coffees*, *her works*, *some experiences* — do not assume the speaker is wrong. Ask what the plural has turned the word into, because in English it has almost always changed the meaning rather than just the number."
        }
    },

    review: {
        rulePrompt: "One line before you start: if English does not count the thing, the number goes on a unit word instead of on the noun — *two pieces of advice*, not *two advices*.",
        itemIds: ["countable-uncountable-p2", "countable-uncountable-p5", "countable-uncountable-p3"]
    },

    tags: ["countable-uncountable", "nouns", "determiners", "T-G4", "high-frequency"]
};

// Match the js/core/* pattern: a lexical global for the browser, CommonJS for
// the Jest suite. `module` is undefined in a classic script, so this is inert
// there.
if (typeof module !== "undefined" && module.exports) {
    module.exports = { GRAMMAR_COUNTABILITY: GRAMMAR_COUNTABILITY };
}

// Self-registration. `grammarLessons` in data/grammar.js is a top-level `const`,
// i.e. a lexical global, so a classic script loaded AFTER it can read the binding
// by bare name and push into the tier array.
//
// The guards cover the two things that can actually go wrong: a script-order
// mistake (grammar.js absent) leaves the point unregistered instead of throwing
// during page load, and an id already present is not pushed twice — so if this
// point is ever folded into data/grammar.js inline, this file becomes a no-op
// rather than producing a duplicate. Both verified.
//
// A duplicate <script> include of THIS file is a different matter: it throws
// "GRAMMAR_COUNTABILITY has already been declared" at parse time, as a second
// include of any file in this codebase would. That is the classic-script contract,
// not something these guards can rescue.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.foundation) &&
    !grammarLessons.foundation.some(function (p) { return p && p.id === GRAMMAR_COUNTABILITY.id; })) {
    grammarLessons.foundation.push(GRAMMAR_COUNTABILITY);
}
