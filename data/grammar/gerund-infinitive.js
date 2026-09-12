/**
 * Grammar point 12 — gerund vs infinitive: *enjoy doing* / *want to do*.
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `GRAMMAR_GERUND_INFINITIVE`. Same schema, field for field, as
 * data/grammar/modals.js — read data/grammar.js's header for what each field
 * is for. Nothing is added and nothing is left out.
 *
 * CURRICULUM.md §3 Strand B point 12. `tier: 'everyday'` / B1 to match its
 * neighbours; `syllabusNumber: 12` is the §3 number, not a choice.
 *
 * ⚠️ FIVE AUTHORING NOTES
 *
 * 1. THE FRAMING: THREE THINGS UNDER ONE HEADING, AND ONLY ONE IS A RULE. This
 *    is the point that is usually taught dishonestly, because "gerund or
 *    infinitive?" is one question mark over three unrelated situations:
 *
 *      (a) AFTER A PREPOSITION, ALWAYS *-ing*. *good at swimming*, *without
 *          asking*, *before leaving*, *look forward to hearing*. A real rule,
 *          exceptionless, self-checkable (if a noun fits the slot, the word in
 *          front is a preposition), and high-yield — it covers *look forward to
 *          hearing from you*, which sits at the bottom of half the mail this
 *          learner sends.
 *
 *      (b) A SMALL GROUP WHERE BOTH FORMS ARE CORRECT AND MEAN DIFFERENT
 *          THINGS. *stop*, *remember*, *forget*, *try*, *go on*, *mean*,
 *          *regret*. Here the learner is not choosing a form, they are choosing
 *          what happened, so this is taught as meaning and there is something
 *          real to think about: *-ing* looks back at something done, *to* looks
 *          forward to something still to do.
 *
 *      (c) EVERYTHING ELSE IS A LIST. *enjoy* takes *-ing*, *want* takes *to*,
 *          and THERE IS NO RULE UNDERNEATH IT. Nothing about the sound, the
 *          meaning or the register of *enjoy* predicts *-ing*; *want* means
 *          almost the same as *would like* and behaves differently. The verb
 *          simply carries its own preference.
 *
 *    Group (c) is most of the point by volume, and a lesson that invents a
 *    rule to make it feel learnable is lying — BR-3 and
 *    TEACHING_METHODOLOGY.md §5 both forbid it. So (a), (b) and (c) are never
 *    described in the same sentence. `rule` states (a) and (c) as two separate
 *    clauses with "and that is the only part of this you can work out" between
 *    them. `decide` is a SORT before it is a decision: question one asks
 *    whether there is a preposition (rule), question two asks whether the verb
 *    is one of the seven (meaning), and the fourth entry says in as many words
 *    "otherwise you are in the list, and there is nothing to work out". No
 *    `retryCue` in group (c) asks the learner to reason, because there would be
 *    nothing to answer; every `retryCue` in group (a) does.
 *
 *    This is data/grammar/prepositions.js's structure, deliberately reused —
 *    that file split a DETECTABLE error (*discuss about*: the relation is
 *    already inside the verb) from an ARBITRARY collocation (*good at*: English
 *    just chose it), and the honest instruction for the arbitrary half was
 *    "learn the two words as one word". Same device here: *enjoy-cooking*,
 *    *want-to-go*, stored as single items.
 *
 * 2. THE SPLIT IS CARRIED IN `logAs`, NOT ONLY IN PROSE — which is the part
 *    prepositions.js got right and the reason it was the model:
 *      group (a) → `gram.verb-form` ("Right tense, wrong form of the verb").
 *                  A missed rule IS a grammar gap and should be reported as
 *                  one.
 *      group (c) → `vocab.collocation` ("The right word with the wrong partner
 *                  word … These pairings are learned together, as a phrase").
 *                  A learner who writes *enjoy to read* has not misunderstood
 *                  English grammar; they have not yet met *enjoy* enough times.
 *                  Telling the dashboard that is a grammar gap would be a false
 *                  claim about what they need.
 *    The split runs INSIDE an item, not just between items. In
 *    `gerund-infinitive-p3`, *to cook* logs `vocab.collocation` (real English,
 *    wrong partner for this verb — memory) while *cook* and *cooked* log
 *    `gram.verb-form` (no verb but a modal takes a bare complement — form).
 *    Same in p4. That is exactly `prepositions-p3`'s treatment of *coping up
 *    with*, where the arbitrary *with* and the passenger *up* were logged to
 *    different strands from one option set.
 *    Cross-strand `logAs` is established, not invented: data/grammar.js's
 *    schema comment blesses it, and prepositions.js ships it.
 *
 * 3. NO CATEGORY DRILLS THIS ID, SO THE ID WAS FREE. Every
 *    `drill: { strand: 'grammar', target: … }` in js/core/mistakes.js points at
 *    `articles`, `be`, `present-simple-vs-continuous`, `countable-uncountable`,
 *    `question-formation`, `present-perfect-vs-past-simple`, `prepositions`,
 *    `register` or `past-simple` — nothing points at a gerund/infinitive id.
 *    `gram.verb-form`, the category this point logs to most, drills
 *    `past-simple`. So no dashboard button resolves `gram:gerund-infinitive`
 *    and no dead-button bug (US-187) is created or fixed by the choice of slug.
 *    `gerund-infinitive` was picked for being the standard name for the
 *    contrast and stable under later edits. If a `gram.verb-complement` row is
 *    ever minted, this is the id it should target.
 *
 * 4. THE ADVERSARIAL PASS, AND THE TRAP THAT IS SPECIFIC TO THIS POINT. A large
 *    set of verbs takes BOTH forms with NO difference in meaning: *begin*,
 *    *start*, *continue*, *like*, *love*, *hate*, *prefer*, *bother*, *intend*,
 *    *cease*, *propose*, and *help* (*help do* / *help to do*). Offering both
 *    forms of one of those would force `showDifferenceOnCorrect: true` to
 *    assert a difference that does not exist — `renderGrammarCorrect`
 *    hardcodes "Both answers here are right, and they do not mean the same
 *    thing" (US-188). So NO ITEM USES ONE AS ITS TARGET VERB. *like* and *love*
 *    appear only in `fallbackFeedback` and `alsoNotice`, named there as taking
 *    either form with no difference, which is where an equally-right synonym
 *    belongs.
 *    Two more forms were kept out of `options` for the same reason and named in
 *    `fallbackFeedback` instead: *try **and** open the window* (informal, and
 *    identical in meaning to *try to open*), and *we've decided **on**
 *    postponing it* (correct, and it needs the preposition that is not in the
 *    option set).
 *    *interested in* was rejected as p1's frame despite being the obvious
 *    example, because *interested **to** hear/know/see* is standard English and
 *    *interested to join* is at least defensible — the item would have marked
 *    real English wrong. p1 uses *without* instead, where no infinitive is
 *    possible at all. Note also that in p1/p2 the preposition sits in the
 *    PROMPT and the gap holds only the verb form, so no option can produce a
 *    second reading by changing the preposition.
 *    Exactly two items have two accepted answers — p5 (*try to open* / *try
 *    opening*) and p6 (*remember locking* / *remember to lock*) — and both are
 *    genuine meaning-change pairs, which is `showDifferenceOnCorrect`'s honest
 *    use. Their prompts are deliberately built so both readings survive: p5's
 *    room is hot and the window's condition is unstated, and p6 uses *never*
 *    with no clue about whether the door ends up locked.
 *
 * 5. `l1Notes.transferId` IS `T-G7`, AND THAT IS DELIBERATE AND PARTIAL.
 *    REQUIREMENTS.md §3.2 has no row for verb complementation, and it should
 *    not: there is no Telugu form for this to be a transfer FROM. Telugu's
 *    verbal noun (*cēyaḍam*) and its purposive (*cēyaḍāniki*) map onto neither
 *    English shape, so a Telugu L1 speaker gets NO signal at all here and
 *    produces *I enjoy to read* and *I want reading* on the same day. That is
 *    an absence, not an interference — and it makes the arbitrary half strictly
 *    harder for this learner than for a French or Spanish speaker, whose own
 *    languages happen to split some of these verbs in a partly similar way.
 *    `l1Notes.telugu.note` says that in plain words, without dressing it up and
 *    without implying it is anyone's fault. T-G7 (postposition → preposition)
 *    covers the half of this point that IS a transfer — *good in explain* →
 *    *good at explaining* — and it is filed here so nobody "corrects" it to a
 *    row that would claim more than is true.
 * =============================================================================
 */

const GRAMMAR_GERUND_INFINITIVE = {
    id: 'gerund-infinitive',
    syllabusNumber: 12,
    tier: 'everyday',
    cefr: 'B1',
    title: 'After the verb: *enjoy doing* or *want to do*',

    srsType: 'gram',
    srsRef: 'gerund-infinitive',
    srsKey: 'gram:gerund-infinitive',
    mistakeCategory: 'gram.verb-form',
    prerequisites: ['modals', 'prepositions', 'present-simple-vs-continuous'],

    rule: 'After a preposition English always uses *-ing* (*good at swimming*, ' +
        '*before leaving*), and that is the only part of this you can work out — ' +
        'after another verb the form is the verb\'s own preference (*enjoy doing*, ' +
        '*want to do*) and is learned with the verb, as one chunk.',

    explain: 'There are three different things under one heading here, and keeping ' +
        'them apart is most of the work.\n\n' +
        '**One is a real rule.** After a preposition, the verb takes *-ing*. ' +
        '*Good at swimming*, *interested in learning*, *without asking*, *before ' +
        'leaving*, *instead of waiting*. No exceptions, and you can check it ' +
        'yourself: if a noun could go in that slot (*good at maths*), the word ' +
        'before it is a preposition, so the verb needs *-ing*.\n\n' +
        '**One is meaning.** A small group of verbs takes both forms and means ' +
        'something different with each. *She stopped smoking* and *She stopped to ' +
        'smoke* are two different events. Here you are not choosing a form, you ' +
        'are choosing what happened.\n\n' +
        '**And one is just a list.** *Enjoy* takes *-ing*. *Want* takes *to*. ' +
        'There is no reason underneath that. Nothing about *enjoy* predicts *-ing*; ' +
        'nothing about *want* predicts *to*. The verb carries its own preference ' +
        'and you learn the two words together — *enjoy-doing*, *want-to-do* — the ' +
        'way you learned *good morning*, as one thing with a space in it.',

    decide: [
        'First, what is in front of the gap? If it is a preposition — *at*, *in*, ' +
        '*on*, *of*, *about*, *without*, *before*, *after*, *instead of* — the ' +
        'answer is *-ing* and you are done. Test it by trying a noun there: if ' +
        '*good at maths* works, *good at swimming* is what English wants.',
        'Watch the *to* that is a preposition rather than an infinitive: *look ' +
        'forward to*, *object to*, *used to*, *instead of*. Same test — *I look ' +
        'forward to Friday* takes a noun, so it takes *-ing*: *look forward to ' +
        'hearing from you*.',
        'If it is a verb in front of the gap, ask whether it is one of the ' +
        'meaning-changing few: *stop*, *remember*, *forget*, *try*, *go on*, ' +
        '*mean*. If it is, decide what you actually mean and the form follows.',
        'Otherwise you are in the list, and there is nothing to work out. Recall ' +
        'the verb with its form attached. If you cannot, use a verb you are sure ' +
        'of, or say it another way — *I like cooking* rather than a guess at ' +
        '*enjoy*.',
        'Never a bare verb after another verb, and never *to* after a modal: ' +
        '*I enjoy cooking*, *I want to cook*, *I can cook*. Three shapes, and the ' +
        'bare one belongs only to modals.'
    ],

    whyItMatters: 'These slips do not stop anyone understanding you — *I enjoy to ' +
        'read* arrives intact. The cost is that they are frequent, so they are the ' +
        'thing a listener or a marker notices instead of your point, and because ' +
        'they sit on the commonest verbs in the language they turn up several times ' +
        'in any long conversation. The one part with a rule behind it, *-ing* after ' +
        'a preposition, is worth fixing first: it is a single habit and it covers a ' +
        'lot of ground.',

    notice: {
        lines: [
            { speaker: 'Sneha', text: 'Are you still planning **to move** to the Bangalore office?' },
            { speaker: 'You', text: 'I\'ve decided **to go** in March. And I\'ve stopped **worrying** about the rent — I found a place.' },
            { speaker: 'Sneha', text: 'Nice. Do you mind **living** that far from the metro?' },
            { speaker: 'You', text: 'Not at all, I\'m looking forward to **cycling** in. Though I must remember **to buy** a helmet first.' }
        ],
        question: 'Six verbs after other words. Only one of them follows a rule you ' +
            'could have worked out from scratch. Which one, and how would you know?',
        answer: '**looking forward to cycling**. That *to* is a preposition, not the ' +
            'front of an infinitive, and you can prove it by putting a noun after it: ' +
            '*I\'m looking forward to the move* is fine, so *to* is a preposition here, ' +
            'and after a preposition English always uses *-ing*. Every other one on the ' +
            'list is the verb\'s own preference and nothing more: *plan to*, *decide ' +
            'to*, *stop worrying*, *mind living*, *remember to*. There is no rule ' +
            'behind those and this lesson will not invent one. Notice one extra thing ' +
            'about the last: *remember to buy a helmet* is buying it, and *remember ' +
            'buying a helmet* would be recalling that you already did.'
    },

    contrast: [
        {
            pair: [
                {
                    text: 'She stopped smoking.',
                    means: 'She gave it up. The smoking is what stopped.'
                },
                {
                    text: 'She stopped to smoke.',
                    means: 'She was doing something else — walking, working — and paused ' +
                        'in order to have a cigarette. The smoking is why she stopped.'
                }
            ],
            takeaway: 'Both are correct and they are opposite events. With *stop*, the ' +
                '*-ing* is the thing that ended and the *to* is the reason for stopping.'
        },
        {
            pair: [
                {
                    text: 'I remembered locking the door.',
                    means: 'The memory came back to me: I could see myself doing it. The ' +
                        'locking happened first, the remembering second.'
                },
                {
                    text: 'I remembered to lock the door.',
                    means: 'It occurred to me in time, so I did it. The remembering ' +
                        'happened first, the locking second.'
                }
            ],
            takeaway: 'Both are correct. The *-ing* looks back at something done; the ' +
                '*to* looks forward to something still to do.'
        },
        {
            pair: [
                {
                    text: 'We tried to open the window.',
                    means: 'We made the effort — and the sentence hints that it was hard ' +
                        'or that we failed. The opening was the difficulty.'
                },
                {
                    text: 'We tried opening the window.',
                    means: 'Opening it was easy; we did it as an experiment, to see ' +
                        'whether it would fix the heat. The opening was the attempted cure.'
                }
            ],
            takeaway: 'Both are correct. *Try to* is about whether you can manage it; ' +
                '*try -ing* is about whether it works.'
        }
    ],

    spokenNote: 'Both forms are unstressed and both get shortened, which is why the ' +
        'ear is not much help here. *To* before a consonant is /tə/ — *want to go* ' +
        'runs to /ˈwɒnəgəʊ/ in ordinary speech, and *going to* to /ˈgənə/ — so the ' +
        '*to* you are trying to hear may not be fully there. The *-ing* ending is ' +
        'usually /ɪn/ rather than /ɪŋ/ in relaxed speech: *enjoy cooking* → ' +
        '/ɪnˈdʒɔɪ ˈkʊkɪn/. Two consequences. First, do not try to learn these pairs ' +
        'by ear from fast speech; learn them as written chunks and let the reduction ' +
        'happen by itself. Second, practise them the way the prepositions point ' +
        'suggests — as single words with no gap: *enjoy-cooking*, *want-to-go*, ' +
        '*look-forward-to-hearing*, *good-at-swimming*.',

    caveats: [
        'A large group of verbs takes BOTH forms with no difference at all: ' +
        '*begin*, *start*, *continue*, *like*, *love*, *hate*, *prefer*, *bother*, ' +
        '*intend*. *It started raining* and *It started to rain* are the same ' +
        'sentence. You cannot get these wrong, which is worth knowing so you stop ' +
        'worrying about them — and it is why none of the practice items below uses ' +
        'one.',
        'The list really is a list, and it is not short. This point teaches the ' +
        'shape and about a dozen of the commonest verbs; the rest arrive one at a ' +
        'time, from reading and listening, over years. That is not a failure of ' +
        'method — there is no method that shortcuts it, and anyone selling you a ' +
        'rule for it is selling you something that does not exist.',
        'The meaning-changing group is small: *stop*, *remember*, *forget*, *try*, ' +
        '*go on*, *mean*, *regret*. Do not extend it by analogy. *Avoid* and ' +
        '*suggest* take *-ing* and mean one thing only; there is no *avoid to do* ' +
        'with a second meaning waiting to be found.',
        '*Used to* is two different things and they are worth separating. *I used ' +
        'to smoke* is a past habit and takes the plain verb. *I\'m used to smoking* ' +
        'is being accustomed to something, and there *to* is a preposition, so ' +
        '*-ing*. Same three letters, two grammars.',
        '*-ing* after a preposition is not the continuous tense, even though it ' +
        'looks identical. *I\'m good at swimming* says nothing about now. If you ' +
        'have been taught to be careful with *-ing* because of *I am knowing*, the ' +
        'caution does not apply here — this *-ing* is a noun-like form, and every ' +
        'verb has one, including the stative ones: *I\'m interested in knowing*.',
        'Some verbs take a person before the *to*: *want*, *ask*, *tell*, *expect*, ' +
        '*allow*. *I want to go* but *I want you to go* — and *I want that you go* ' +
        'is not English, though the Telugu shape leads straight to it.'
    ],

    commonErrors: [
        {
            heard: 'I enjoy to read in the evenings.',
            fix: 'I enjoy reading in the evenings.',
            why: 'Nothing was reasoned wrongly here, because there was nothing to ' +
                'reason: *enjoy* takes *-ing* and no property of the word tells you ' +
                'that. It is one of the commonest slips in Indian English and in ' +
                'learner English everywhere, and the only fix is to store the two ' +
                'words as one item — *enjoy-reading*, *enjoy-cooking*, ' +
                '*enjoy-watching*. Same list: *avoid*, *finish*, *mind*, *suggest*, ' +
                '*keep*, *practise*.',
            l1: null
        },
        {
            heard: 'I want going home early today.',
            fix: 'I want to go home early today.',
            why: 'The mirror image, and it comes from the same place: *want* takes ' +
                '*to* for no reason you could have guessed. The company it keeps: ' +
                '*decide to*, *hope to*, *plan to*, *promise to*, *manage to*, ' +
                '*refuse to*, *offer to*, *need to*.',
            l1: null
        },
        {
            heard: 'I look forward to hear from you.',
            fix: 'I look forward to hearing from you.',
            why: 'This one IS detectable, and it is worth the effort because it sits ' +
                'at the bottom of half the mails you send. The *to* in *look forward ' +
                'to* is a preposition, not the front of an infinitive — you can tell ' +
                'because a noun fits after it: *I look forward to Friday*, *I look ' +
                'forward to the trip*. And after a preposition English always uses ' +
                '*-ing*.',
            l1: 'T-G7'
        },
        {
            heard: 'She is very good in explain things.',
            fix: 'She is very good at explaining things.',
            why: 'Two things, and only the second one belongs to this point. That ' +
                '*good* takes *at* is arbitrary — the prepositions lesson deals with ' +
                'that. What is a rule is what comes next: once there is a ' +
                'preposition, the verb after it takes *-ing*, every time, with no ' +
                'exceptions. *Good at explaining*, *tired of waiting*, *interested ' +
                'in learning*.',
            l1: 'T-G7'
        },
        {
            heard: 'He suggested to meet at four.',
            fix: 'He suggested meeting at four.',
            why: 'Pure list, and this verb catches people who have everything else ' +
                'right, because *suggest* feels like *want* and behaves like ' +
                '*enjoy*. English has *suggest doing* and *suggest that we do*, and ' +
                'no *suggest to do* at all. Nothing predicts it. *Suggest-meeting*, ' +
                'as one word.',
            l1: null
        },
        {
            heard: 'I stopped to smoke two years ago.',
            fix: 'I stopped smoking two years ago.',
            why: 'This is the one place in the point where the form is carrying real ' +
                'meaning, so the sentence is not broken — it is about something else. ' +
                '*I stopped to smoke* says you paused whatever you were doing in ' +
                'order to have a cigarette, which is a two-minute event, not a ' +
                'two-year one. Giving it up is *stopped smoking*.',
            l1: null
        }
    ],

    practice: [
        {
            id: 'gerund-infinitive-p1',
            mode: 'gap',
            focus: 'after-a-preposition-always-ing',
            prompt: 'Handover note to the colleague covering your desk next week: ' +
                '"Please don\'t approve any invoice without ___ it against the PO first."',
            options: ['checking', 'to check', 'check', 'checked'],
            accept: [
                {
                    answer: 'checking',
                    means: '*Without* is a preposition, and after a preposition English ' +
                        'uses *-ing*. This is the one part of the whole point that follows ' +
                        'a rule.'
                }
            ],
            showDifferenceOnCorrect: false,
            spoken: '*without checking it* → /wɪˈðaʊt ˈtʃekɪŋɪt/, and the *-ing* is ' +
                'usually /ɪn/ in relaxed speech. Say *without-checking* as one word.',
            feedback: [
                {
                    forAnswer: 'to check',
                    reason: 'This is the half of the point that IS a rule, so it is worth ' +
                        'being firm about: an infinitive cannot follow a preposition. ' +
                        'Nothing in English says *without to check*, *good at to swim*, ' +
                        '*before to leave*. The test is quick — put a noun in the slot. ' +
                        '*Without a check* works, so *without* is a preposition, so the verb ' +
                        'takes *-ing*.',
                    contrast: [
                        'Please don\'t approve any invoice without checking it against the PO.',
                        'Please check it against the PO before you approve it.'
                    ],
                    retryCue: 'Could a noun go in this gap? Then the word in front is a ' +
                        'preposition — and after a preposition, which form?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'infinitive-after-preposition'
                },
                {
                    forAnswer: 'check',
                    reason: 'The plain verb belongs after a modal and nowhere else: *you ' +
                        'must check*, *you can check*. After a preposition it has nothing to ' +
                        'attach to, and *without check* would read as a noun that is ' +
                        'missing its article.',
                    contrast: [
                        'Please don\'t approve any invoice without checking it.',
                        'Please don\'t approve any invoice until you check it.'
                    ],
                    retryCue: 'A bare verb needs a modal in front of it. Is *without* a modal?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'bare-verb-after-preposition'
                },
                {
                    forAnswer: 'checked',
                    reason: 'The past form cannot follow a preposition either. There IS a ' +
                        'correct sentence close to this one — *without its being checked*, or ' +
                        'more naturally *without having it checked* — and in both of those ' +
                        'the word right after *without* is still an *-ing* form. That is how ' +
                        'reliable the rule is.',
                    contrast: [
                        'Please don\'t approve any invoice without checking it against the PO.',
                        'Please don\'t approve any invoice without having it checked.'
                    ],
                    retryCue: 'Look at the word immediately after *without*. What ending ' +
                        'does it always have?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'past-form-after-preposition'
                }
            ],
            fallbackFeedback: {
                reason: 'After a preposition, *-ing*: *without checking it*. Other correct ' +
                    'ways to say this drop the preposition and get a clause instead — ' +
                    '*before you check it*, *until you have checked it*, *unless you check ' +
                    'it*. Notice that each of those replaces *without* with a joining word ' +
                    'that can take a whole sentence, which is precisely what a preposition ' +
                    'cannot do.',
                contrast: [
                    'Don\'t approve any invoice without checking it against the PO.',
                    'Don\'t approve any invoice until you have checked it against the PO.'
                ],
                retryCue: 'Preposition in front? Then *-ing*, with no exceptions.'
            },
            alsoNotice: 'This *-ing* is not the continuous tense, even though it looks ' +
                'the same. *Without checking* says nothing about when. Every verb has this ' +
                'form, including the ones that never go continuous: *interested in ' +
                'knowing*, *tired of owning a car*.'
        },
        {
            id: 'gerund-infinitive-p2',
            mode: 'gap',
            focus: 'the-to-that-is-a-preposition-not-an-infinitive',
            prompt: 'Closing line of a mail to a client you have just sent a revised ' +
                'quote: "The updated figures are attached. I look forward to ___ from you."',
            options: ['hearing', 'hear', 'to hear', 'heard'],
            accept: [
                {
                    answer: 'hearing',
                    means: 'The *to* in *look forward to* is a preposition, so the verb after ' +
                        'it takes *-ing* — exactly as in *without checking*.'
                }
            ],
            showDifferenceOnCorrect: false,
            spoken: '*look forward to hearing from you* runs as one unbroken phrase, ' +
                '/lʊkˈfɔːwədtə ˈhɪərɪŋfrəmjuː/, with both *to* and *from* reduced to ' +
                '/tə/ and /frəm/. Learn the whole thing as a single chunk.',
            feedback: [
                {
                    forAnswer: 'hear',
                    reason: 'This is the commonest version of this sentence in the world and ' +
                        'it is still not the standard one, which makes it worth the sixty ' +
                        'seconds. The trap is that *to* has two completely different jobs. In ' +
                        '*I want to hear* it is the front of an infinitive and the plain verb ' +
                        'follows. In *look forward to* it is a preposition, and you can prove ' +
                        'that in one move: put a noun after it. *I look forward to Friday*, *I ' +
                        'look forward to the trip*, *I look forward to your reply* — all fine. ' +
                        '*I want to Friday* is not. So this *to* is a preposition, and after a ' +
                        'preposition English always uses *-ing*.',
                    contrast: [
                        'I look forward to hearing from you.',
                        'I want to hear from you.'
                    ],
                    retryCue: 'Try a noun after this *to*. If a noun fits, it is a ' +
                        'preposition — so which form of the verb?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'infinitive-read-into-a-preposition'
                },
                {
                    forAnswer: 'to hear',
                    reason: 'This gives *look forward to to hear*, and the doubling is ' +
                        'actually useful evidence: the *to* already in the sentence is not ' +
                        'spare, it belongs to *look forward to*, which is a fixed three-word ' +
                        'unit. So the gap holds only the verb, and after that preposition the ' +
                        'verb takes *-ing*.',
                    contrast: [
                        'I look forward to hearing from you.',
                        'I hope to hear from you soon.'
                    ],
                    retryCue: 'Read the sentence with your answer in it, out loud. How many ' +
                        '*to*s did you say?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'doubled-to'
                },
                {
                    forAnswer: 'heard',
                    reason: 'The past form has nothing to attach to here. It is worth ' +
                        'separating the two things *-ing* and *-ed* are doing in your head: ' +
                        'this slot wants the noun-like form of the verb, which is always ' +
                        '*-ing*, and it has nothing to do with time. *I look forward to ' +
                        'hearing* is about the future, and the *-ing* does not contradict that.',
                    contrast: [
                        'I look forward to hearing from you.',
                        'I was glad to have heard from you so quickly.'
                    ],
                    retryCue: 'This gap is not about time at all. Which form goes after a ' +
                        'preposition?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'past-form-after-preposition'
                }
            ],
            fallbackFeedback: {
                reason: 'After the preposition *to* in *look forward to*, the verb takes ' +
                    '*-ing*: *look forward to hearing from you*. Several other sign-offs are ' +
                    'equally correct and sidestep the whole problem — *I hope to hear from ' +
                    'you*, *I\'ll wait to hear from you*, *Do let me know*. Notice that ' +
                    '*hope* and *wait* take a real infinitive, so the plain verb is right ' +
                    'after those: the form depends on the word in front, never on the ' +
                    'meaning of the sentence.',
                contrast: [
                    'I look forward to hearing from you.',
                    'I hope to hear from you.'
                ],
                retryCue: 'Is this *to* a preposition or the front of an infinitive? Put a ' +
                    'noun after it and see.'
            },
            alsoNotice: 'Four more prepositional *to*s worth learning as chunks, because ' +
                'they all behave this way and they all look like infinitives: *object to ' +
                'paying*, *be used to waiting*, *get round to reading it*, *in addition to ' +
                'running the team*.'
        },
        {
            id: 'gerund-infinitive-p3',
            mode: 'gap',
            focus: 'arbitrary-verb-preference-the-ing-side',
            prompt: '"How do you actually switch off at the weekend?" — "It sounds dull, ' +
                'but I genuinely enjoy ___ on Sunday mornings. Nobody else is awake."',
            options: ['cooking', 'to cook', 'cook', 'cooked'],
            accept: [
                {
                    answer: 'cooking',
                    means: '*Enjoy* takes *-ing*. Not for a reason — that is simply the form ' +
                        'this verb comes with.'
                }
            ],
            showDifferenceOnCorrect: false,
            spoken: '*enjoy cooking* → /ɪnˈdʒɔɪ ˈkʊkɪn/, with the stress on *-joy* and on ' +
                '*cook-*. Say it as one word, *enjoycooking*, which is how you will store it.',
            feedback: [
                {
                    forAnswer: 'to cook',
                    reason: 'Nothing was reasoned wrongly here, because there is nothing to ' +
                        'reason: *enjoy* takes *-ing*, and no property of the word *enjoy* ' +
                        'would ever have told you that. *Want* takes *to* and means something ' +
                        'very similar; *like* takes either. So this is not a rule you missed, ' +
                        'it is an item you have not met enough times yet, and the only fix is ' +
                        'to store the pair as one word: *enjoy-cooking*. The same list, worth ' +
                        'learning together: *avoid*, *finish*, *mind*, *suggest*, *keep*, ' +
                        '*practise*, *give up* — all *-ing*.',
                    contrast: [
                        'I genuinely enjoy cooking on Sunday mornings.',
                        'I genuinely want to cook on Sunday mornings.'
                    ],
                    retryCue: 'There is nothing to work out in this one. Which form have you ' +
                        'heard after *enjoy* — *enjoy doing* or *enjoy to do*?',
                    grammaticalButDifferent: false,
                    logAs: 'vocab.collocation',
                    errorKind: 'wrong-complement-form-for-this-verb'
                },
                {
                    forAnswer: 'cook',
                    reason: 'The plain verb after another verb is the one shape English never ' +
                        'allows, and it is a different mistake from the one above: that one ' +
                        'was a memory gap, this one is a form. Only a modal takes a bare verb ' +
                        '— *I can cook*, *I must cook*. Every other verb needs either *-ing* ' +
                        'or *to* after it, and *enjoy* wants *-ing*.',
                    contrast: [
                        'I genuinely enjoy cooking on Sunday mornings.',
                        'I can cook, but only on Sunday mornings.'
                    ],
                    retryCue: 'A bare verb needs a modal in front. Is *enjoy* a modal?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'bare-verb-after-main-verb'
                },
                {
                    forAnswer: 'cooked',
                    reason: 'The past form cannot be the object of *enjoy*. Notice that ' +
                        '*enjoy* is not doing anything unusual — the *-ing* form is what the ' +
                        'whole slot wants, and it is a noun-like thing: you could put a real ' +
                        'noun there instead and the sentence would still work. *I enjoy the ' +
                        'quiet*, *I enjoy Sunday mornings*, *I enjoy cooking*.',
                    contrast: [
                        'I genuinely enjoy cooking on Sunday mornings.',
                        'I genuinely enjoyed cooking on Sunday mornings, when I had the time.'
                    ],
                    retryCue: 'Could a noun go in this gap? Then which form of the verb ' +
                        'behaves like a noun?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'past-form-after-main-verb'
                }
            ],
            fallbackFeedback: {
                reason: '*Enjoy* takes *-ing*: *I enjoy cooking*. Other answers are just as ' +
                    'correct and are worth knowing because they let you round the problem ' +
                    'when the verb deserts you — *I like cooking* and *I love cooking* are ' +
                    'equally right (and *like to cook* and *love to cook* are right too, ' +
                    'because *like* and *love* take both forms with no difference at all).',
                contrast: [
                    'I genuinely enjoy cooking on Sunday mornings.',
                    'I genuinely like cooking on Sunday mornings.'
                ],
                retryCue: 'This is a memory question, not a thinking question. What form ' +
                    'does *enjoy* come with?'
            },
            alsoNotice: 'The escape hatch is worth having. If you are not sure which form a ' +
                'verb takes, use one you are sure of: *like* and *love* accept either, so ' +
                'they can never catch you out. That is not cheating — it is what fluent ' +
                'speakers of a second language do all day.'
        },
        {
            id: 'gerund-infinitive-p4',
            mode: 'gap',
            focus: 'arbitrary-verb-preference-the-to-side',
            prompt: '"Are we still launching in January?" — "No, we\'ve decided ___ it ' +
                'until March, so the documentation is actually ready this time."',
            options: ['to postpone', 'postponing', 'postpone', 'postponed'],
            accept: [
                {
                    answer: 'to postpone',
                    means: '*Decide* takes *to*. Same kind of fact as *enjoy* taking *-ing*, ' +
                        'pointing the other way.'
                }
            ],
            showDifferenceOnCorrect: false,
            spoken: '*decided to postpone* → /dɪˈsaɪdɪdtə pəˈspəʊn/, with *to* reduced to ' +
                '/tə/ and given no beat at all. In fast speech it can nearly vanish, which ' +
                'is why you cannot learn these by ear.',
            feedback: [
                {
                    forAnswer: 'postponing',
                    reason: 'Same arbitrariness as the *enjoy* item, in the other direction: ' +
                        '*decide* takes *to* and nothing about the word tells you so. This is ' +
                        'memory, not logic. The verbs that keep it company are worth learning ' +
                        'as one batch: *decide to*, *want to*, *hope to*, *plan to*, *promise ' +
                        'to*, *manage to*, *refuse to*, *offer to*, *agree to*. One near miss ' +
                        'is worth knowing so it stops feeling wrong: *we\'ve decided **on** ' +
                        'postponing it* is correct — with the preposition *on*, after which ' +
                        '*-ing* is required, exactly as the rule says.',
                    contrast: [
                        'We\'ve decided to postpone it until March.',
                        'We\'ve decided on postponing it until March.'
                    ],
                    retryCue: 'Nothing to work out here. Which have you heard — *decided to ' +
                        'do* or *decided doing*?',
                    grammaticalButDifferent: false,
                    logAs: 'vocab.collocation',
                    errorKind: 'wrong-complement-form-for-this-verb'
                },
                {
                    forAnswer: 'postpone',
                    reason: 'The bare verb needs a modal in front of it, and *decide* is not ' +
                        'one. There is a correct sentence nearby that hides this, though, and ' +
                        'it may be what you were hearing: *we\'ve decided we\'ll postpone it* ' +
                        '— once you start a whole new clause with *we*, the verb can be plain ' +
                        'again, because it now has its own subject.',
                    contrast: [
                        'We\'ve decided to postpone it until March.',
                        'We\'ve decided we\'ll postpone it until March.'
                    ],
                    retryCue: 'Either give the verb a *to*, or give it a subject of its own. ' +
                        'Bare and subjectless is the one option English does not have.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'bare-verb-after-main-verb'
                },
                {
                    forAnswer: 'postponed',
                    reason: 'The past form cannot follow *decide*. The tense is already ' +
                        'carried by *decided* at the front, and English does not mark it twice ' +
                        '— the second verb goes into a timeless form, *to postpone*, and stays ' +
                        'there whether the deciding was yesterday or is happening now.',
                    contrast: [
                        'We\'ve decided to postpone it until March.',
                        'We decided to postpone it, and then postponed it again.'
                    ],
                    retryCue: 'Which word in this sentence is already carrying the past?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'past-form-after-main-verb'
                }
            ],
            fallbackFeedback: {
                reason: '*Decide* takes *to*: *we\'ve decided to postpone it*. Other answers ' +
                    'are equally correct — *we\'ve agreed to postpone it*, *we\'re going to ' +
                    'postpone it*, *we\'ve decided on postponing it*, *we\'ve decided we\'ll ' +
                    'postpone it*. The last two are the interesting ones: add the preposition ' +
                    '*on* and the form must switch to *-ing*, and start a new clause and the ' +
                    'verb goes plain.',
                contrast: [
                    'We\'ve decided to postpone it until March.',
                    'We\'ve decided on postponing it until March.'
                ],
                retryCue: 'What comes after *decide* — *to* or *-ing*? Then check whether ' +
                    'you have put a preposition in front of it.'
            },
            alsoNotice: 'Compare this item with the *enjoy* one and you have the whole ' +
                'arbitrary half of the point in two sentences: *enjoy cooking*, *decide to ' +
                'postpone*. Two verbs, two preferences, no reason for either. Learning them ' +
                'in contrasting pairs like that is more efficient than learning two lists.'
        },
        {
            id: 'gerund-infinitive-p5',
            mode: 'gap',
            focus: 'both-forms-correct-and-the-meaning-changes-try',
            prompt: 'A stuffy meeting room on a hot afternoon. Someone says: "It\'s ' +
                'boiling in here." You reply: "Try ___ the window."',
            options: ['to open', 'opening', 'open', 'opened'],
            accept: [
                {
                    answer: 'to open',
                    means: 'Make the effort — see whether you can manage it. This is the ' +
                        'version you would say if the window sticks, or is high up, or might ' +
                        'be locked. The difficulty is the opening itself.'
                },
                {
                    answer: 'opening',
                    means: 'Do it as an experiment, to see whether it helps. Opening the ' +
                        'window is easy; what is uncertain is whether it will cool the room. ' +
                        'This is advice about a possible solution, not about an effort.'
                }
            ],
            showDifferenceOnCorrect: true,
            spoken: 'The two are the same length and neither is stressed: *try to open* → ' +
                '/traɪtə ˈəʊpən/, *try opening* → /traɪ ˈəʊpənɪŋ/. When the difference ' +
                'matters, speakers usually rebuild the sentence rather than lean on the ' +
                'form: *see if you can open it* against *what if we opened it?*',
            feedback: [
                {
                    forAnswer: 'open',
                    reason: 'One word short. *Try* needs either *to* or *-ing* after it, and ' +
                        'here it is the missing *to* rather than a wrong choice — which is why ' +
                        'this feels so nearly right. It IS nearly right, because *try and ' +
                        'open the window* is correct, ordinary, informal English and probably ' +
                        'what your ear was reaching for. That *and* is doing the joining work; ' +
                        'without it the two verbs have nothing between them.',
                    contrast: [
                        'Try to open the window.',
                        'Try and open the window.'
                    ],
                    retryCue: 'Two verbs cannot sit side by side with nothing between them. ' +
                        'What could go in the gap — and what would each choice mean?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'bare-verb-after-main-verb'
                },
                {
                    forAnswer: 'opened',
                    reason: 'The past form cannot follow *try*. Worth noticing why it might ' +
                        'have felt possible: *I tried opening it* and *what if we opened it* ' +
                        'are both correct, and the *-ed* in the second one belongs to a clause ' +
                        'with its own subject. Directly after *try* there are only two ' +
                        'options, and they mean different things: *to open* is the effort, ' +
                        '*opening* is the experiment.',
                    contrast: [
                        'Try opening the window.',
                        'What if we opened the window?'
                    ],
                    retryCue: '*Try* offers you exactly two forms. Which two, and which one ' +
                        'matches what you mean?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'past-form-after-main-verb'
                }
            ],
            fallbackFeedback: {
                reason: 'Both *try to open* and *try opening* are right here, and they are ' +
                    'not the same advice — one is about whether you can, the other about ' +
                    'whether it will help. Two more answers are just as correct and were ' +
                    'left out to keep the choice clean: *try and open the window* (informal, ' +
                    'and identical in meaning to *try to open*) and *see if you can open ' +
                    'the window*.',
                contrast: [
                    'Try to open the window — it may be stuck.',
                    'Try opening the window — it might cool the room down.'
                ],
                retryCue: 'Is the hard part getting the window open, or knowing whether it ' +
                    'will work? English has a different form for each.'
            },
            alsoNotice: 'This is the small group where the form carries meaning, so it is ' +
                'the one part of the point you can think your way through: *stop*, ' +
                '*remember*, *forget*, *try*, *go on*, *mean*, *regret*. Do not extend the ' +
                'list by analogy — *avoid* and *suggest* take *-ing* and have no second ' +
                'reading waiting.'
        },
        {
            id: 'gerund-infinitive-p6',
            mode: 'gap',
            focus: 'both-forms-correct-and-the-meaning-changes-remember',
            prompt: 'A friend is teasing you about your terrible memory. You admit: ' +
                '"Honestly, I never remember ___ the front door. It drives my flatmate mad."',
            options: ['locking', 'to lock', 'lock', 'locked'],
            accept: [
                {
                    answer: 'locking',
                    means: 'You have no memory of the act afterwards. You may well have ' +
                        'locked it — you just cannot recall doing it, which is why you keep ' +
                        'having to go back and check. The locking comes first, the ' +
                        'remembering after.'
                },
                {
                    answer: 'to lock',
                    means: 'It never occurs to you at the time, so the door stays unlocked. ' +
                        'The remembering comes first, and the locking only happens if it does. ' +
                        'This is why the flatmate is annoyed: the door is genuinely open.'
                }
            ],
            showDifferenceOnCorrect: true,
            spoken: 'Both are unstressed and quick: *remember locking* → /rɪˈmembə ' +
                'ˈlɒkɪn/, *remember to lock* → /rɪˈmembətə ˈlɒk/. The whole difference ' +
                'between forgetting an action and failing to perform it rides on one ' +
                'reduced syllable, so in speech people often add a word: *I never remember ' +
                'whether I locked it*.',
            feedback: [
                {
                    forAnswer: 'lock',
                    reason: 'The bare verb needs a modal in front of it, and *remember* is ' +
                        'not one. There is a correct sentence very close to this, and it may ' +
                        'be what you were hearing: *I never remember **if I** lock the front ' +
                        'door* — once the verb has a subject of its own, it can be plain ' +
                        'again. Directly after *remember*, though, it is *-ing* or *to*, and ' +
                        'the two say different things.',
                    contrast: [
                        'I never remember locking the front door.',
                        'I never remember whether I locked the front door.'
                    ],
                    retryCue: 'Give the verb a *to*, an *-ing*, or a subject of its own. Bare ' +
                        'and subjectless is not available.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'bare-verb-after-main-verb'
                },
                {
                    forAnswer: 'locked',
                    reason: 'This one is worth slowing down on, because the MEANING you were ' +
                        'reaching for is almost certainly right — recalling a past action — ' +
                        'and English expresses it with the *-ing* form, not the *-ed* one. ' +
                        '*I never remember locking it* is exactly "I have no memory of having ' +
                        'locked it". The *-ed* form works only with a subject in front of it: ' +
                        '*I never remember whether I locked it*.',
                    contrast: [
                        'I never remember locking the front door.',
                        'I never remember whether I locked the front door.'
                    ],
                    retryCue: 'You want the backward-looking meaning — which form does ' +
                        '*remember* use for that, directly after it?',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'past-form-after-main-verb'
                }
            ],
            fallbackFeedback: {
                reason: 'Both *remember locking* and *remember to lock* are right, and they ' +
                    'describe two different problems — no memory of doing it, against never ' +
                    'thinking of it in the first place. Other correct answers rebuild the ' +
                    'sentence rather than choosing a form: *I never remember whether I ' +
                    'locked it*, *I can never remember if I\'ve locked it*. Those are what ' +
                    'people actually say when they want to be unmistakable.',
                contrast: [
                    'I never remember locking the front door — I have to go back and check.',
                    'I never remember to lock the front door — I just pull it shut and walk.'
                ],
                retryCue: 'Did the locking happen and get forgotten, or never happen at ' +
                    'all? The form is the answer to that question.'
            },
            alsoNotice: 'The pattern generalises across the whole meaning-changing group, ' +
                'and it is the nearest thing to a rule in this half of the point: the ' +
                '*-ing* form looks BACK at something already done, and *to* looks FORWARD ' +
                'to something still to do. *Remember locking* / *remember to lock*, *forget ' +
                'meeting her* / *forget to meet her*, *regret saying it* / *regret to say ' +
                'it*.'
        }
    ],

    produce: {
        id: 'gerund-infinitive-produce',
        task: 'Out loud, sixty seconds, nothing written first: describe your ideal ' +
            'Sunday. Say two things you enjoy doing, one thing you have decided to do ' +
            'this month, one thing you are good at doing, one thing you keep forgetting ' +
            'to do, and one thing you have stopped doing. Then say the same sentence ' +
            'twice with *stopped* — once meaning you gave it up, once meaning you paused ' +
            'in order to do it — and notice that you had to choose.',
        targetSeconds: 60,
        useLanguage: [
            'I enjoy… / I don\'t mind… / I\'ve given up… — the *-ing* verbs, twice',
            'I\'ve decided to… / I\'m hoping to… / I need to… — the *to* verbs, twice',
            'I\'m good at… / before… / instead of… — a preposition, then *-ing*',
            'I keep forgetting to… — the forward-looking meaning',
            'I\'ve stopped… — said once each way, and heard as two different things'
        ],
        selfCheck: [
            'After every preposition — *at*, *of*, *about*, *before*, *instead of* — did ' +
            'the verb come out with *-ing*?',
            'Did any bare verb slip in directly after another verb — *I enjoy cook*, ' +
            '*I decided postpone*?',
            'When I used *stop*, *remember*, *forget* or *try*, did I choose the form ' +
            'that matched what I actually meant?',
            'Did I dodge a verb I was unsure of by using *like* or *love*, which take ' +
            'either form? That is a good habit, not a failure.',
            'Did I get through the minute without stopping mid-sentence to hunt for the ' +
            'form?'
        ],
        model: {
            text: 'A good Sunday? I enjoy cooking, and I don\'t mind cleaning if there\'s ' +
                'music on. I\'ve decided to start swimming again this month — I\'m ' +
                'actually quite good at swimming, I just stopped going. Before leaving ' +
                'the house I always try to check the plants, and I never remember to ' +
                'water them, so half of them are dead. Oh, and I\'ve stopped drinking ' +
                'coffee after four. Yesterday I stopped to drink a coffee at eleven, ' +
                'which is allowed.',
            note: 'Read it once for the shape, then look away and talk about your own ' +
                'Sunday. Reading it aloud is not the exercise — these forms go wrong when ' +
                'you are thinking about the content instead of the words, so thinking ' +
                'about the content is the point.'
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            transferId: 'T-G7',
            priority: 'S',
            note: 'This point is harder for a Telugu speaker than the syllabus makes it ' +
                'look, and the reason is an absence rather than an interference. Telugu ' +
                'has a verbal noun (*cēyaḍam*, "doing") and an infinitive-like form ' +
                '(*cēyaḍāniki*, "in order to do"), and neither maps onto the English ' +
                'split. English does not divide *-ing* from *to* by meaning at all in ' +
                'the arbitrary group — it divides them by which verb came first. So ' +
                'there is no Telugu pattern to transfer, wrongly or rightly: whatever ' +
                'you reach for is a guess, which is exactly why *I enjoy to read* and ' +
                '*I want reading* are both common from the same speaker on the same day. ' +
                'It is worth being blunt about the consequence. A French or Spanish ' +
                'speaker gets some free hits here, because their own languages happen ' +
                'to split these verbs in a partly similar way; a Telugu speaker gets ' +
                'none. That means more of this point is memory work for you than for ' +
                'them, and it is not a reflection of anything except which languages ' +
                'happen to resemble each other. The filed transfer row, T-G7, covers ' +
                'only the half of this point that is a preposition interface (*good ' +
                'in explain* → *good at explaining*); REQUIREMENTS.md §3.2 has no row ' +
                'for the arbitrary half, and that is correct — there is no L1 form for ' +
                'it to be a transfer FROM.',
            bridge: 'Two questions, in this order, and the first one is the only one with ' +
                'an answer you can derive. QUESTION ONE: is there a preposition in front ' +
                'of the gap? *at*, *in*, *of*, *about*, *without*, *before*, *after*, ' +
                '*instead of* — and the *to* in *look forward to* and *used to*, which ' +
                'are prepositions in disguise. Test it by trying a noun in the slot: if ' +
                '*good at maths* works, *good at swimming* is what English wants. If the ' +
                'answer is yes, use *-ing* and stop; you have just handled the highest ' +
                'yield third of this point with one rule. QUESTION TWO: is the verb in ' +
                'front one of the seven where the form carries meaning — *stop*, ' +
                '*remember*, *forget*, *try*, *go on*, *mean*, *regret*? Then choose by ' +
                'meaning: *-ing* looks back at something done, *to* looks forward to ' +
                'something still to do. And if neither question applies, stop reasoning ' +
                'immediately, because there is nothing there to find. Store about a dozen ' +
                'pairs as single words — *enjoy-cooking*, *avoid-driving*, ' +
                '*suggest-meeting*, *finish-reading*, *mind-waiting*, *keep-trying* on ' +
                'one side, *want-to-go*, *decide-to-leave*, *hope-to-see*, ' +
                '*plan-to-start*, *manage-to-finish*, *need-to-ask* on the other — and ' +
                'when a verb you do not have deserts you mid-sentence, switch to *like* ' +
                'or *love*, which take both forms and cannot catch you out. That last ' +
                'move is not a workaround. It is what fluent second-language speakers do ' +
                'all day, and it keeps you talking instead of stalling.'
        }
    },

    review: {
        rulePrompt: 'One line before you start: after a preposition it is always *-ing* ' +
            '(*good at swimming*, *look forward to hearing*) — and after another verb ' +
            'the form is that verb\'s own preference (*enjoy doing*, *want to do*), ' +
            'which is learned with the verb rather than worked out. The exception is the ' +
            'handful where both forms are correct and mean different things: *-ing* ' +
            'looks back, *to* looks forward.',
        itemIds: ['gerund-infinitive-p2', 'gerund-infinitive-p3', 'gerund-infinitive-p6']
    },

    tags: ['gerund', 'infinitive', 'verb-patterns', 'complementation', '-ing',
           'to-infinitive', 'collocation', 'preposition-plus-ing', 'T-G7',
           'high-frequency']
};

// Match the js/core/* pattern: a lexical global for the browser, CommonJS for
// the Jest suite. `module` is undefined in a classic script, so this is inert
// there.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GRAMMAR_GERUND_INFINITIVE: GRAMMAR_GERUND_INFINITIVE };
}

// Self-registration, exactly as data/grammar/register.js does it.
// `grammarLessons` in data/grammar.js is a top-level `const`, i.e. a lexical
// global, so a classic script loaded AFTER it can read the binding by bare name
// and push into the tier array. The guards make a script-order mistake a no-op
// rather than a page-load throw, and make a second push impossible.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.everyday) &&
    !grammarLessons.everyday.some(function (p) { return p && p.id === GRAMMAR_GERUND_INFINITIVE.id; })) {
    grammarLessons.everyday.push(GRAMMAR_GERUND_INFINITIVE);
}
