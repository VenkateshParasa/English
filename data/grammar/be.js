/**
 * Grammar point 1 — `be` (am / is / are).
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global `GRAMMAR_BE`.
 * Same schema, field for field, as the `articles` point in data/grammar.js —
 * read that file's header comment for what each field is for. Nothing is added
 * to the schema here and nothing is left out.
 *
 * CURRICULUM.md §3 Strand B point 1; T-G2 in REQUIREMENTS.md §3.2
 * ("Copula dropping" — *"I doctor"*, *"He very good"*). `js/core/mistakes.js`
 * already carries the matching row, `gram.copula`, whose drill target is
 * `be` — i.e. this point. That is the default `mistakeCategory` here.
 *
 * ⚠️ TWO AUTHORING NOTES
 *
 * 1. TESTING AN ABSENCE. The error this point fixes is a *missing word*, and a
 *    plain gap-fill hands the learner the one thing they do not have: the
 *    knowledge that something goes there at all. Every item here is
 *    `mode: 'gap'` — app.js implements only that mode, and an item in any other
 *    mode is skipped with a visible note and dropped from the completion count,
 *    so a `repair` or `choose` item would be unteachable content — and the
 *    absence is tested inside the gap format two different ways instead:
 *
 *      · `be-p1` and `be-p6` put the SUBJECT inside the gap, so the learner's
 *        own zero-copula sentence ("my sister", "she") is one ordinary-looking
 *        option among four. Nothing marks it as the odd one out, and choosing
 *        it renders the sentence they would actually have said.
 *      · `be-p4` offers `""` — nothing at all — as an option, labelled through
 *        `rendersAs` as "— (nothing: this part is already complete)". This is
 *        the same device as ZERO_ARTICLE in the articles point, and app.js
 *        supports it (the option value is held in a closure precisely so that
 *        the empty string survives). Its prompt also sets the learner auditing a
 *        four-clause introduction in which the other three clauses already carry
 *        correct be forms, two of them hidden inside contractions.
 *
 *    The remaining items drill the am/is/are choice, the negative and the
 *    contracted form, which is what is left to learn once the absence is
 *    audible.
 *
 * 2. SUBJECT OMISSION HAS NO CATEGORY. `js/core/mistakes.js` has no id for a
 *    dropped *subject* ("Am in a meeting", "Is very good"), which is a real and
 *    common Indian-English form and a near neighbour of this point. Nothing here
 *    needed it — the distractors are all be-forms, so every wrong answer routes
 *    honestly to `gram.copula` (be missing or wrong) or
 *    `gram.subject-verb-agreement` (be present, wrong person) or
 *    `gram.tense-agreement` (be present, wrong time). Do not invent an id: that
 *    file owns the taxonomy, and an unknown id lands everything in
 *    'general.uncategorised'.
 * =============================================================================
 */

const GRAMMAR_BE = {
    id: "be",
    syllabusNumber: 1,
    tier: "foundation",
    cefr: "A1",
    title: "Saying what something is: am, is, are",

    srsType: "gram",
    srsRef: "be",
    srsKey: "gram:be",
    mistakeCategory: "gram.copula",

    // Nothing comes before point 1. Articles and countability both touch the
    // sentences here, but neither is needed first: *I'm a doctor* can be taught
    // whole, and is, long before the **a** in it is explained.
    prerequisites: [],

    rule: "An English sentence that just says what someone or something **is** still needs a verb in the middle — *am* after *I*, *is* after one person or thing, *are* after *you*, *we*, *they* or more than one — and in speech it joins onto the subject: *I'm*, *he's*, *we're*.",

    explain: "Telugu says who you are by putting two things side by side and stopping: *nēnu ḍākṭar*, literally \"I doctor\", is a complete, correct sentence with no verb in it at all. English cannot do that. It insists on a small linking word between the subject and whatever you are saying about it, even when that word carries no information — *I am a doctor*, *she is my sister*, *they are late*. The reason this one is so persistent is not that it is difficult; it is that the word is almost inaudible. *He's very good* is said /hiz/, one buzz on the end of *he*, so the input you hear every day barely contains the thing you are supposed to copy. Learn the contracted forms as single words — *I'm*, *you're*, *he's*, *she's*, *it's*, *we're*, *they're* — and the gap closes from the pronunciation side rather than the grammar side.",

    decide: [
        "Am I just saying what someone or something IS — a job, a name, a description, a place, an age — with no action happening? Then a be word has to go in.",
        "Which one? *I* → **am**. One person or one thing, and *he*, *she*, *it* → **is**. *You*, *we*, *they*, or more than one → **are**.",
        "Now stick it onto the subject before you say it: *I'm*, *you're*, *he's*, *she's*, *it's*, *we're*, *they're*. That is the form you actually want out loud; the full *I am* is for emphasis.",
        "Before you finish, count the verbs in what you just said. If there is no action word AND no am/is/are, a word is missing — put it back in."
    ],

    whyItMatters: "Most of the time you will still be understood: *He very good* reaches the listener. It is worth fixing for a narrower reason — a missing *be* is one of the few errors that makes a sentence sound unfinished rather than accented, so listeners tend to wait for the rest of it, and short introductions are exactly where it shows up. *I doctor* is the first thing you say to a new person, and it is a sentence that stalls them for a moment.",

    notice: {
        lines: [
            { speaker: "New colleague", text: "So how long have you been here?" },
            { speaker: "You", text: "Three months. **I'm** in the design team — **I'm** the one who does the onboarding screens." },
            { speaker: "New colleague", text: "Oh, then **you're** the person I've been told to find. **Is** Priya on that team too?" },
            { speaker: "You", text: "**She's** the lead, yes. **She's** in Bangalore this week though." }
        ],
        question: "Count the be words in that exchange. Now say each one at normal speed — how much of *I am* and *she is* actually survives when you say it fast?",
        answer: "Six of them, and almost nothing survives. *I'm* is one syllable, /aɪm/. *She's* is /ʃiz/ — the whole verb has shrunk to a /z/ hanging off the end of *she*. That is the real difficulty with this point: the word is grammatically compulsory and phonetically almost nothing, so it is easy to hear a hundred of them a day and never notice one. Notice too what happened in the question: *Is Priya on that team?* moved the be word to the front. Same word, doing the work of a question mark."
    },

    contrast: [
        {
            pair: [
                {
                    text: "He's a teacher.",
                    means: "That is his job now. Ask him about his class and he will have one."
                },
                {
                    text: "He was a teacher.",
                    means: "That was his job, and the sentence quietly says it is not any more — he has retired, or changed careers."
                }
            ],
            takeaway: "Both are correct, and the only difference is which be word you chose. The be carries the time information all by itself: nothing else in the sentence changed, but *was* has moved the whole thing into the past and closed it."
        },
        {
            pair: [
                {
                    text: "I'm ready.",
                    means: "Plain information, neutral. This is the ordinary way to say it, and what you would say if nobody had asked twice."
                },
                {
                    text: "I am ready.",
                    means: "Said in full, this pushes back: someone has doubted it, or asked you a second time, and you are insisting. In speech the stress lands on *am*."
                }
            ],
            takeaway: "Both are correct English and they are not interchangeable — this is why the contraction is the form to learn first. *I'm* is the default; the full *I am* is emphasis, so using it everywhere makes you sound like you are arguing when you are only answering."
        },
        {
            pair: [
                {
                    text: "Your sister is a doctor.",
                    means: "You are telling someone a fact — you already know it about their sister."
                },
                {
                    text: "Is your sister a doctor?",
                    means: "You are asking. Nothing was added and nothing was removed; *is* simply moved in front of *your sister*."
                }
            ],
            takeaway: "Moving the be word to the front turns telling into asking. That is another reason the word cannot be dropped: it is the piece English picks up and moves when it needs a question, so a sentence with no be has nothing to move."
        }
    ],

    spokenNote: "Learn these seven as single words, not as two words joined: *I'm* /aɪm/, *you're* /jɔː/ (identical to *your*), *he's* /hiz/, *she's* /ʃiz/, *it's* /ɪts/, *we're* /wɪə/, *they're* /ðeə/ (identical to *there* and *their*). Notice that *is* becomes /z/ after a voiced sound (*he's*, *she's*, *there's*) and /s/ after a voiceless one (*it's*, *that's*, *what's*) — the same rule as plural -s, so you already know it. Negatives contract two ways and both are ordinary: *he isn't* /ˈɪznt/ and *he's not*, *they aren't* /ɑːnt/ and *they're not*. One gap in the pattern worth knowing: *am* has no negative contraction in standard English — there is no *amn't*, so it is always *I'm not*.",

    caveats: [
        "This point covers be as the main verb — the one that links a subject to a job, a description, a place or an age. The same word also works as a helper, in *I'm working* and *it was built in 1990*, and that is a different job for a later point. If you see am/is/are with another verb after it, you are looking at the helper.",
        "Questions move the be word to the front — *Is she ready?*, *Are you from Warangal?* — and that word order gets its own treatment later. Here you only need to notice that a question is where a dropped be becomes impossible to hide: *Where you from?* has nowhere to move.",
        "*There is* and *there are* look like this pattern but behave differently — the *there* is not really the subject, and the be agrees with what comes after it (*there is a problem*, *there are two problems*). Learn those as their own construction.",
        "English is not unusual in needing this word. Telugu, Russian, Arabic and Hindi all manage without it in the present tense, and some varieties of English drop it systematically too. English also drops it in specific registers you will see in writing: headlines (*Minister dead at 74*), notes and messages (*Back in five*), and captions. So this is not a rule about logic — it is about what a standard spoken English sentence needs, which is what listeners outside your region are tuned for.",
        "A few very common expressions are worth learning whole rather than assembling from the rule: *How are you?*, *What's your name?*, *Here you are*, *That's fine*, *It's OK*. The rule does explain all of them, but you will say them faster if you never have to build them."
    ],

    commonErrors: [
        {
            heard: "I doctor. I from Warangal.",
            fix: "I'm a doctor. I'm from Warangal.",
            why: "Both sentences say what you are, with no action in them, so both need a be. Say *I'm* as one word and both sentences are fixed at once — you are not remembering a grammar rule, you are starting the sentence with a different sound.",
            l1: "T-G2"
        },
        {
            heard: "She my sister.",
            fix: "She's my sister.",
            why: "*She my sister* is a perfect Telugu sentence with English words in it. English needs the /z/ on the end of *she* — that buzz is the whole verb.",
            l1: "T-G2"
        },
        {
            heard: "He very good in English.",
            fix: "He's very good at English.",
            why: "A description needs a be just as much as a job does: *he's very good*, not *he very good*. (While you are there: it is *good at* something, not *good in* — that one is a preposition habit, a separate point.)",
            l1: "T-G2"
        },
        {
            heard: "My father not at home.",
            fix: "My father isn't at home. / My father's not at home.",
            why: "Telugu negates an equational sentence with a single word — *kādu* — and there is no verb underneath it to translate. So *not* arrives in English on its own, with nothing to attach to. English needs the be word plus the *not*: *isn't*, or *'s not*. Both are equally normal in speech.",
            l1: "T-G2"
        },
        {
            heard: "Where you from? What your name?",
            fix: "Where are you from? What's your name?",
            why: "These are the two questions you will be asked most often, and in both of them the missing word is a be that should have moved to the front. *What's your name* is one chunk — learn it as a chunk and the be is never dropped.",
            l1: "T-G2"
        }
    ],

    practice: [
        {
            id: "be-p1",
            mode: "gap",
            focus: "noticing-that-a-word-is-missing",
            // Absence item #1. The subject sits INSIDE the gap, so the bare
            // subject — the learner's own zero-copula sentence — is one
            // ordinary-looking option among four, and nothing about the gap
            // announces that a verb is required. Choosing it renders the sentence
            // they would actually have said, which is the whole lesson in one
            // line of feedback.
            prompt: "\"So what does your sister do?\" — \"___ a doctor in Vizag.\"",
            options: ["my sister's", "my sister is", "my sister", "my sister was"],
            accept: [
                { answer: "my sister's", means: "The natural spoken answer. The whole verb is the /z/ on the end of *sister* — this is what you would actually hear in the conversation." },
                { answer: "my sister is", means: "The same sentence said in full. Correct, and more deliberate — you would use this to make the point clearly, or in writing." }
            ],
            // Two right answers doing different work: the learner has to be told
            // that the contraction is the default and the full form is not neutral.
            showDifferenceOnCorrect: true,
            rendersAs: {
                "my sister's": "My sister's",
                "my sister is": "My sister is",
                "my sister": "My sister",
                "my sister was": "My sister was"
            },
            spoken: "*My sister's a doctor* → /maɪ ˈsɪstəz ə ˈdɒktə/. The /z/ and the *a* run together into one unstressed mumble, /zə/, which is exactly why this word is so easy to miss when you are listening — and easy to leave out when you are speaking.",
            feedback: [
                {
                    forAnswer: "my sister",
                    reason: "This is the sentence with nothing in the middle of it, and it is the commonest version of this error. It is not carelessness — in Telugu *nā cellelu ḍākṭar* is finished and correct, so there is genuinely nothing in your ear telling you a word is absent. English is the odd one here: it will not let you put a person and a job side by side without a verb between them.",
                    contrast: [
                        "My sister's a doctor in Vizag.",
                        "My sister works as a doctor in Vizag."
                    ],
                    retryCue: "Say it slowly and count the verbs. There is no action word in this answer — so what has to go between *my sister* and *a doctor*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.copula",
                    errorKind: "zero-copula-noun-complement"
                },
                {
                    forAnswer: "my sister was",
                    reason: "The be word is there, which is the harder half of this — it is the time that is off. *Was* says that being a doctor is finished: she has retired, or changed jobs. The question asked what she does now, so keep the same word in its present form: *is*, or *'s*.",
                    contrast: [
                        "My sister's a doctor in Vizag. (that is her job now)",
                        "My sister was a doctor in Vizag. (she is not any more)"
                    ],
                    retryCue: "Is this true now, or was it true before? Then take the present form of the same word.",
                    grammaticalButDifferent: true,
                    logAs: "gram.tense-agreement",
                    errorKind: "past-be-in-present-context"
                }
            ],
            fallbackFeedback: {
                reason: "This gap wants a subject plus the be word that goes with it, for one person, right now. *My sister's* and *My sister is* are both right, and so is *She's a doctor in Vizag* — swapping the subject for *she* changes nothing about the verb. What English will not accept is a subject with nothing after it.",
                contrast: [
                    "My sister's a doctor in Vizag.",
                    "She's a doctor in Vizag."
                ],
                retryCue: "Try again with a be word after the subject. Which of *am*, *is* or *are* goes with one person?"
            },
            alsoNotice: "*A doctor* takes **a** in English even though Telugu needs nothing there. Two words that carry no meaning, both compulsory, in one five-word answer — which is why introductions are worth rehearsing out loud until they come out whole."
        },
        {
            id: "be-p2",
            mode: "gap",
            focus: "am-with-I-and-the-contracted-form",
            prompt: "\"Are you free at four?\" — \"Sorry, ___ in a meeting until five.\"",
            options: ["i'm", "i am", "i", "i is"],
            accept: [
                { answer: "i'm", means: "The normal spoken form, and what a colleague would actually say. One syllable, /aɪm/, and the verb is inside it." },
                { answer: "i am", means: "Correct, but said in full it sounds like you are insisting — as if they had already been told once. Fine in writing; slightly heavy in this reply." }
            ],
            // Both correct, and the difference is exactly the point of the lesson.
            showDifferenceOnCorrect: true,
            rendersAs: { "i'm": "I'm", "i am": "I am", i: "I", "i is": "I is" },
            spoken: "*Sorry, I'm in a meeting* → /ˈsɒri aɪm ɪn ə ˈmiːtɪŋ/. *I'm in* runs together as /aɪmɪn/, three sounds, no pause. If you say *I ... am ... in*, the sentence is correct and you sound like you are reading it.",
            feedback: [
                {
                    forAnswer: "i",
                    reason: "*I in a meeting* is the Telugu shape running straight through: subject, then the information, and stop. English needs a verb before *in a meeting*, and after *I* there is only ever one choice — **am** — which is why *I'm* is worth learning as a single word rather than as two.",
                    contrast: [
                        "Sorry, I'm in a meeting until five.",
                        "Sorry, I have a meeting until five."
                    ],
                    retryCue: "There is no action verb in this reply. What goes right after *I* to hold the sentence up?",
                    grammaticalButDifferent: false,
                    logAs: "gram.copula",
                    errorKind: "zero-copula-place-complement"
                },
                {
                    forAnswer: "i is",
                    reason: "*Is* is the form most learners reach for as a default, because it is the one they meet most, and it works with nearly every subject — *he is*, *she is*, *the meeting is*, *my sister is*. *I* is the exception, and it is the exception you need most often: it takes **am** and nothing else. Learn *I'm* as a single word and the choice never comes up again.",
                    contrast: [
                        "Sorry, I am in a meeting until five.",
                        "Sorry, she is in a meeting until five."
                    ],
                    retryCue: "Which be word belongs to *I* alone — the one no other subject can use?",
                    grammaticalButDifferent: false,
                    logAs: "gram.subject-verb-agreement",
                    errorKind: "wrong-person-of-be"
                }
            ],
            fallbackFeedback: {
                reason: "This gap is testing which be word follows *I*, so it can check *I'm* and *I am*. Other true answers exist for this situation — *I'll be in a meeting*, *I have a meeting* — but they change the verb rather than the be form, which is what this item is about.",
                contrast: [
                    "Sorry, I'm in a meeting until five.",
                    "Sorry, I am in a meeting until five."
                ],
                retryCue: "Fill the gap with *I* plus the be word that goes with it. Which of am/is/are belongs to *I*?"
            },
            alsoNotice: "The question *Are you free at four?* has the be word out in front. Answering with a be word too — *I'm* — keeps the two halves matched, and that pairing is a useful check: if the question started with a be, your answer needs one."
        },
        {
            id: "be-p3",
            mode: "gap",
            focus: "are-with-a-plural-subject",
            // "they still work at the same school" is load-bearing: it closes off
            // *were*, which would otherwise be perfectly defensible here.
            prompt: "My parents ___ both teachers — they still work at the same school in Warangal.",
            options: ["are", "is", "am", "were"],
            accept: [
                { answer: "are", means: "Two people, so the plural form. This is the only be word that fits both the number (*parents*) and the time (*they still work*)." }
            ],
            spoken: "*My parents are both teachers* → /maɪ ˈpeərənts ə bəʊθ ˈtiːtʃəz/. Said at speed, *are* reduces to a single /ə/ and almost vanishes between *parents* and *both* — audible enough to a listener, but nothing like the full /ɑː/ you may have been taught.",
            feedback: [
                {
                    forAnswer: "is",
                    reason: "*Is* is for one — one person, one thing. *My parents* is two people, so English wants **are**. This is not a small formality: *is* after a plural subject is one of the few grammar slips that a listener notices immediately, because the number is information they were tracking.",
                    contrast: [
                        "My parents are both teachers.",
                        "My father is a teacher."
                    ],
                    retryCue: "How many people does *my parents* mean? Then pick the be word for that number.",
                    grammaticalButDifferent: false,
                    logAs: "gram.subject-verb-agreement",
                    errorKind: "singular-be-with-plural-subject"
                },
                {
                    forAnswer: "am",
                    reason: "*Am* has exactly one subject in the whole language: *I*. Nothing else ever takes it — not *you*, not *he*, not *my parents*. If the subject is not *I*, the choice is only ever between *is* and *are*.",
                    contrast: [
                        "My parents are both teachers.",
                        "I am a teacher too."
                    ],
                    retryCue: "Is the subject *I*? If not, *am* is out — so *is* or *are*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.subject-verb-agreement",
                    errorKind: "am-with-non-first-person-subject"
                },
                {
                    forAnswer: "were",
                    reason: "*Were* is the right number — it is the plural form — but the wrong time. It would mean they used to be teachers and are not now, and the second half of the sentence says they still work at the school. Keep the number and move it back to the present: **are**.",
                    contrast: [
                        "My parents are both teachers — they still work at the same school.",
                        "My parents were both teachers — they retired last year."
                    ],
                    retryCue: "Is this true now, or was it true before? Then take the present form of the plural be.",
                    grammaticalButDifferent: true,
                    logAs: "gram.tense-agreement",
                    errorKind: "past-be-in-present-context"
                }
            ],
            fallbackFeedback: {
                reason: "This gap wants the be word that matches two people, right now. *Are* is the only one that fits: *is* and *am* are singular, and *were* puts it in the past, which the rest of the sentence contradicts.",
                contrast: [
                    "My parents are both teachers.",
                    "My mother is a teacher."
                ],
                retryCue: "Two people, happening now. Which of am/is/are/was/were is that?"
            },
            alsoNotice: "*Both* sits after the be word, not before it — *are both teachers*, never *both are teachers* in this sentence. Short words like *both*, *also*, *always* and *never* slot in right after am/is/are, and that position is one more reason the be word has to be there: without it they have nothing to sit behind."
        },
        {
            id: "be-p4",
            mode: "gap",
            focus: "hearing-the-absence-in-connected-speech",
            // Absence item #2, and the harder one. "" — nothing at all — is an
            // offered option, so the gap does not assert that a word belongs
            // there; the learner has to decide. The other three clauses of the
            // introduction already carry correct be forms, two of them inside
            // contractions, so the task is an audit of connected speech rather
            // than a hole someone else dug.
            prompt: "Read this introduction out loud, at normal speed. Three of the four parts already have their be word in them — and two of those are hidden inside a contraction. Decide what the remaining part needs.\n\n\"Hello, I'm Ramesh. I ___ twenty-nine, my wife is a teacher, and we're both from Warangal.\"",
            options: ["am", "", "is", "was"],
            accept: [
                { answer: "am", means: "An age needs a be word just as much as a job does, and after *I* the form is always *am*. This is the one part of the introduction that had nothing between the subject and the information." }
            ],
            // The empty string would otherwise be labelled with
            // ZERO_ARTICLE_LABEL, which is the wrong words for a missing verb.
            rendersAs: { "": "— (nothing: this part is already complete)" },
            spoken: "Said at speed, each of the three complete parts carries its be inside the subject — /aɪm ˈrɑːmɛʃ/, /maɪ waɪfɪz ə ˈtiːtʃə/, /wɪə bəʊθ frəm/ — and the fourth has a small silence where that sound should be. Learning to hear that silence is what lets you correct yourself mid-sentence, which is the real skill this item is for. Out loud you would say *I'm twenty-nine*; the gap can only take the full *am*, because *'m* has to attach to the *I* in front of it.",
            feedback: [
                {
                    forAnswer: "",
                    reason: "This is the answer that says the part is already finished — and in Telugu it would be. *Nāku iravai tommidi ēḷḷu* has no verb for English to copy, so nothing in your first language flags the gap. But compare it with the three parts around it: *I'm Ramesh* has *am* inside it, *my wife is a teacher* has *is* out in the open, *we're both from Warangal* has *are* inside it. An age is the same kind of sentence as those, so it needs the same kind of word.",
                    contrast: [
                        "I am twenty-nine. (the same shape as *my wife is a teacher*)",
                        "I twenty-nine. (subject, information, and no verb between them)"
                    ],
                    retryCue: "Expand every contraction in the introduction into two words. Three parts then show a be word — so what is missing from the fourth?",
                    grammaticalButDifferent: false,
                    logAs: "gram.copula",
                    errorKind: "zero-copula-not-noticed"
                },
                {
                    forAnswer: "is",
                    reason: "The be word is there, and it is the right one for the part next door — *my wife is a teacher*. It just does not travel: *is* belongs to *he*, *she*, *it* and any single other person or thing, while *I* keeps its own private form, **am**. Two subjects in one sentence, two different forms of the same word.",
                    contrast: [
                        "I am twenty-nine, and my wife is thirty-one.",
                        "My wife is a teacher, and I am an analyst."
                    ],
                    retryCue: "Look at the subject of THIS part, not the one beside it. Which be word belongs to *I*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.subject-verb-agreement",
                    errorKind: "wrong-person-of-be"
                },
                {
                    forAnswer: "was",
                    reason: "Right form for *I*, wrong time. *I was twenty-nine* is real English — it belongs in a story about the past, *I was twenty-nine when I moved here* — but you are introducing yourself now, so the present form is the one you want.",
                    contrast: [
                        "I am twenty-nine. (now)",
                        "I was twenty-nine when I moved to Hyderabad. (then)"
                    ],
                    retryCue: "Am I telling them how old I am now, or how old I was at some point? Then pick the present or the past form.",
                    grammaticalButDifferent: true,
                    logAs: "gram.tense-agreement",
                    errorKind: "past-be-in-present-context"
                }
            ],
            fallbackFeedback: {
                reason: "The part being tested is the age, and what it needs is the be word that goes with *I*. Three of the four parts of the introduction already have theirs, two of them hidden inside a contraction (*I'm* = I am, *we're* = we are).",
                contrast: [
                    "I am twenty-nine. (repaired)",
                    "I twenty-nine. (as it was written)"
                ],
                retryCue: "Expand every contraction into two words, then put the missing be word after *I*."
            },
            alsoNotice: "English puts an age with be — *I'm twenty-nine* — where many languages use *have* (*I have 29 years*), and where Telugu uses a possessive with no verb at all: *nāku iravai tommidi ēḷḷu*, \"to me twenty-nine years\". So there is nothing in the Telugu to translate, and nothing turns up in the English either. Ages, names, jobs and prices all take be: *I'm Ramesh*, *I'm twenty-nine*, *it's four hundred rupees*."
        },
        {
            id: "be-p5",
            mode: "gap",
            focus: "negative-with-be",
            prompt: "\"Can we start?\" — \"Don't worry, ___ ready yet. Give him five minutes.\"",
            options: ["he isn't", "he's not", "he is not", "he not"],
            accept: [
                { answer: "he isn't", means: "One of the two normal spoken negatives. The *not* has contracted onto the verb: *is not* → *isn't*." },
                { answer: "he's not", means: "Equally normal, and just as common in speech. Here the verb contracts onto the subject instead and *not* stays whole. Slightly more weight lands on *not*, so it is a shade more emphatic." },
                { answer: "he is not", means: "Correct, and said in full it is emphatic — this is the version for insisting, after someone has assumed otherwise. Neutral in writing, strong out loud." }
            ],
            // Three right answers separated only by register and emphasis. Saying
            // nothing would leave the learner thinking they are interchangeable.
            showDifferenceOnCorrect: true,
            spoken: "*He isn't ready* → /hi ˈɪznt ˈrɛdi/, with the /t/ often swallowed before the /r/: /ˈɪzn ˈrɛdi/. *He's not ready* → /hiz nɒt ˈrɛdi/. Both are two beats and neither is more careful than the other — choose whichever comes out faster.",
            feedback: [
                {
                    forAnswer: "he not",
                    reason: "Telugu negates a sentence like this with one word — *kādu* — and there is no verb sitting under it to carry over, so *not* arrives in English on its own with nothing to attach to. English needs both pieces: the be word AND the *not*. Put them together and you get *isn't*, or split them as *he's not*.",
                    contrast: [
                        "He isn't ready yet.",
                        "He's not ready yet."
                    ],
                    retryCue: "*Not* cannot stand alone here. What word goes in front of it — and which of am/is/are matches *he*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.copula",
                    errorKind: "not-without-be"
                }
            ],
            fallbackFeedback: {
                reason: "This gap wants *he* plus a negative be. All three of *he isn't*, *he's not* and *he is not* are correct; what English will not accept is *not* with no be word in front of it.",
                contrast: [
                    "He isn't ready yet.",
                    "He's not ready yet."
                ],
                retryCue: "Say it as two pieces — the be word for *he*, then *not* — and then decide which of the two you want to squeeze together."
            },
            alsoNotice: "One gap in this pattern: *am* has no negative contraction in standard English. There is no *amn't*, and *I isn't* is not available either, so the negative of *I am* is always *I'm not*. Everything else contracts both ways: *she isn't* / *she's not*, *they aren't* / *they're not*."
        },
        {
            id: "be-p6",
            mode: "gap",
            focus: "be-before-a-description",
            prompt: "\"What's your new manager like?\" — \"___ very good at her job. Everyone says so.\"",
            options: ["she's", "she is", "she", "she are"],
            accept: [
                { answer: "she's", means: "The spoken default. The verb is the /z/ on the end of *she* — say it as one word, /ʃiz/." },
                { answer: "she is", means: "Correct, and in full it puts weight on the verb, as if you were confirming something that had been doubted. Neutral in writing, emphatic out loud." }
            ],
            showDifferenceOnCorrect: true,
            rendersAs: { "she's": "She's", "she is": "She is", she: "She", "she are": "She are" },
            spoken: "*She's very good at her job* → /ʃiz ˈvɛri ɡʊd ət hə ˈdʒɒb/. The stress is on *very* and *good*; /ʃiz/ is quick and low. Do not stress the verb unless you mean to argue.",
            feedback: [
                {
                    forAnswer: "she",
                    reason: "*She very good* — this is the same absence as *I doctor*, just with a description instead of a job, and it is the commonest form of it. Telugu can put a person next to a quality and stop; English needs a be word between them whatever comes second, whether that is a job (*she's a manager*), a description (*she's very good*), or a place (*she's in Chennai*).",
                    contrast: [
                        "She's very good at her job.",
                        "She works very hard at her job."
                    ],
                    retryCue: "There is no action word in this answer, only a description. What has to go between *she* and *very good*?",
                    grammaticalButDifferent: false,
                    logAs: "gram.copula",
                    errorKind: "zero-copula-adjective-complement"
                },
                {
                    forAnswer: "she are",
                    reason: "The be word is there, which is the hard part done. *Are* is the plural one though — it goes with *you*, *we*, *they* and anything more than one — and *she* is a single person, so it takes **is**, contracted to *she's*.",
                    contrast: [
                        "She is very good at her job.",
                        "They are very good at their jobs."
                    ],
                    retryCue: "One person or more than one? Then choose between *is* and *are*.",
                    grammaticalButDifferent: false,
                    logAs: "gram.subject-verb-agreement",
                    errorKind: "wrong-person-of-be"
                }
            ],
            fallbackFeedback: {
                reason: "This gap is about the be word before a description. *She's* and *She is* are both right; what will not work is *she* on its own, or a plural be with a single person.",
                contrast: [
                    "She's very good at her job.",
                    "She is very good at her job."
                ],
                retryCue: "Fill the gap with *she* plus the be word for one person."
            },
            alsoNotice: "The question that set this up — *What's your new manager like?* — has the same word in it, contracted onto *what*: *what is* → *what's*. It is the standard way to ask for a description, and answering it always takes a be word back, so the two fit together as a pair worth rehearsing."
        }
    ],

    produce: {
        id: "be-produce",
        task: "Out loud, introduce yourself to someone you have just met at work — about five sentences. Say your name, your job, where you are from, and one thing about a family member or a colleague. Use the contracted forms every time: *I'm*, *she's*, *he's*, *we're*. Then add one negative sentence about yourself with *I'm not*.",
        targetSeconds: 45,
        useLanguage: [
            "I'm — as one word, at least twice",
            "he's, she's or we're — at least once",
            "I'm not — once, for something that is not true of you"
        ],
        selfCheck: [
            "Did every sentence have a be word or an action verb in it — no sentence that jumped straight from the person to the information?",
            "Did I say *I'm* as one syllable, rather than *I ... am*?",
            "Did I use *am* only after *I*, and never after anyone else?",
            "Did my negative come out as *I'm not*, and not as *I not* or *amn't*?",
            "Did I get through all five sentences without stopping to assemble one?"
        ],
        model: {
            text: "Hi, I'm Ramesh. I'm a data analyst — I'm in the reporting team on the second floor. I'm from Warangal, but we're in Hyderabad now because my wife's job moved. She's a teacher at a school near our flat. I'm not from here originally, so I'm still learning my way around.",
            note: "Read this once to see the shape of it, then look away from the screen and say your own version. Reading it aloud is not the exercise — the point is to produce sentences that hold themselves up without a script, because that is the situation where the be word goes missing."
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            transferId: "T-G2",
            priority: "M",
            note: "Telugu says what something is by putting the two parts side by side and stopping. *Nēnu ḍākṭar* — \"I doctor\" — is complete, correct, ordinary Telugu, and so is *āme nā cellelu*, \"she my sister\". There is no verb in either, so when you translate them there is nothing to translate INTO *am* and *is*: the English words simply are not called for by anything in your first language. That is why this error survives so long after you know the rule. Two more pieces of the same puzzle. First, negation: Telugu uses the single word *kādu* — *nēnu ḍākṭar kādu* — so *not* comes across on its own and lands in English as *He not ready*, with no be underneath it. Second, and more useful: Telugu DOES use a verb for location and existence, the *unnu* forms — *nēnu iṇṭlō unnānu*, \"I am at home\". So your instinct is already correct for where things are; the gap is specifically for saying what something IS, and for describing it.",
            bridge: "Two habits, and the first one is a pronunciation habit rather than a grammar one. Learn *I'm*, *you're*, *he's*, *she's*, *it's*, *we're*, *they're* as seven single words — the way you learned *cellelu* as one word, not as parts. Then the be word arrives with the subject instead of having to be remembered separately, and the sentence cannot start wrong. Second: before you finish any sentence about who or what someone is, count the verbs. No action word and no am/is/are means a word is missing, and you can put it back mid-sentence — self-correcting out loud is not a failure, it is how the habit gets built. And when the sentence is about where someone is, trust yourself: that is the one you already do right."
        }
    },

    review: {
        rulePrompt: "One line before you start: a sentence that only says what someone or something IS still needs am, is or are in the middle of it — and out loud that word joins onto the subject, as *I'm*, *he's*, *we're*.",
        itemIds: ["be-p4", "be-p2", "be-p5"]
    },

    tags: ["be", "copula", "am-is-are", "contractions", "T-G2", "high-frequency"]
};

// Match the js/core/* pattern: a lexical global for the browser, CommonJS for
// the Jest suite. `module` is undefined in a classic script, so this is inert
// there.
if (typeof module !== "undefined" && module.exports) {
    module.exports = { GRAMMAR_BE: GRAMMAR_BE };
}

// Self-registration, exactly as data/grammar/countability.js does it.
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
// "GRAMMAR_BE has already been declared" at parse time, as a second include of
// any file in this codebase would. That is the classic-script contract, not
// something these guards can rescue.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.foundation) &&
    !grammarLessons.foundation.some(function (p) { return p && p.id === GRAMMAR_BE.id; })) {
    grammarLessons.foundation.push(GRAMMAR_BE);
}
