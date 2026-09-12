/**
 * Strand B, syllabus point 8 — modals of ability and request: can / could / may.
 *
 * THE LAST MISSING `foundation` POINT. Points 1-7 are authored (be, present
 * simple vs continuous, articles, countable/uncountable, past simple, question
 * formation, prepositions); this is 8, and it is what stood between US-502 and
 * done.
 *
 * ONE IDEA, and everything here follows from it: in a request, `could` is not
 * the past of `can` — it is DISTANCE, and distance is what politeness is made of
 * in English. Once a learner has that, `would`, `might` and "I was wondering
 * if…" need no separate formulas; they are the same move at greater length.
 *
 * WHY THIS POINT MATTERS FOR A TELUGU L1 SPEAKER, and it is not what a
 * grammar syllabus would predict. Telugu marks respect morphologically and
 * pervasively — verb endings, pronoun choice (`nuvvu`/`meeru`), honorific
 * plurals. English carries almost none of that load in its morphology; it
 * carries it in MODAL CHOICE AND INDIRECTNESS instead. So a speaker who is
 * being entirely respectful in Telugu can produce English that reads as blunt,
 * because the respect was encoded somewhere English does not look. "Give me the
 * file" is not rudeness. It is respect marked in a place the reader is not
 * reading.
 *
 * That is a REGISTER mismatch, not a grammar error, and this file never grades
 * it as one. The bare imperative in `modals-p5` is flagged `logAs:
 * "gram.register-indian"` and its feedback says outright that the sentence is
 * correct English. Compare data/grammar/prepositions.js's caveats and
 * question-formation.js's handling of invariant "isn't it?" — same posture.
 *
 * The `may` trap, stated once so nobody teaches a ladder: `may` is NOT "more
 * polite than can". `May I…` asks permission of someone with the standing to
 * refuse. `Can you…` asks about ability turned into a request. So *May you send
 * me the file* is not over-polite — it is wrong, because you are not the one
 * whose permission is at stake. Politeness ladders are why learners produce it.
 *
 * `l1Notes.transferId` is T-G9, the register row, because there is no T-G row
 * for modal bluntness and T-G9 is where the transfer actually lands. Noted here
 * so nobody "corrects" it to a grammar row later. T-G9 is Indian-English
 * register items; T-G6 is perfective aspect. They are easy to transpose.
 */

const GRAMMAR_MODALS = {
    id: 'modals',
    syllabusNumber: 8,
    tier: 'foundation',
    cefr: 'A2',
    title: 'Asking for things: can, could and may',
    srsType: 'gram',
    srsRef: 'modals',
    srsKey: 'gram:modals',
    mistakeCategory: 'gram.verb-form',
    prerequisites: ['be', 'question-formation'],

    rule: 'A modal is followed by the plain verb, with no *to* and no *-s*: ' +
        '*can go*, *could send*, *may leave*. In a request, **`could` is not the past ' +
        'of `can` — it is distance**, and distance is what politeness is made of in ' +
        'English. And `may` asks permission of the person who can refuse, so it goes ' +
        'with *I*, not with *you*.',

    explain: 'Three things are happening under one set of words, and they are worth ' +
        'separating before anything else.\n\n' +
        '**`can` has three unrelated jobs.** Ability — *I can swim*. Permission — ' +
        '*Can I take this chair?* And a request — *Can you send me the file?* The last ' +
        'two differ by one word, *I* against *you*, and ask completely different ' +
        'things: one asks about you, the other asks about them.\n\n' +
        '**`could` is the interesting one.** For ability it really is the past: ' +
        '*When I was six I could read Telugu.* But in a request it is not past at all ' +
        '— *Could you send me the file?* is about right now. What it adds is distance. ' +
        'It steps back from the ask, and stepping back is how English is polite. ' +
        'Nothing is softened by being made past; it is softened by being made less ' +
        'direct.\n\n' +
        'That single idea is why *would you*, *might*, and *I was wondering if you ' +
        'could* all work, and why they get politer as they get longer. They are the ' +
        'same move, further back. You do not need a formula for each one.\n\n' +
        '**`may` is not a politer `can`.** It asks permission of whoever has the ' +
        'standing to refuse — so *May I leave early?* is fine, and *May you send me ' +
        'the file?* is not, because their permission is not what is in question. ' +
        'This is the mistake a politeness ladder produces: told that *may* is the ' +
        'polite one, a learner reaches for it in a request, where it has no role.',

    decide: [
        'Am I talking about ability, asking permission, or asking someone to do ' +
        'something? *can* covers all three, so decide which one before you pick ' +
        'anything else.',
        'If I am asking someone to DO something, the subject is *you*: *Can you…*, ' +
        '*Could you…*, *Would you…*. Never *May you…* — their permission is not what ' +
        'I am asking about.',
        'If I am asking permission for MYSELF, the subject is *I*: *Can I…*, ' +
        '*Could I…*, *May I…*. *May I* is for someone who could genuinely say no.',
        'How much distance do I want? *Can you* is neutral and fine with people I ' +
        'know. *Could you* steps back one pace. *I was wondering if you could* steps ' +
        'back several, and is for a stranger or a large favour.',
        'Whatever I chose, the next verb comes out plain — *send*, not *sends*, not ' +
        '*to send*, not *sending*.',
        'For past ability, *could* really is the past of *can*: *I could read it ' +
        'then*. That is the one place *could* is about time rather than distance.'
    ],

    whyItMatters: 'This is where a lot of otherwise strong English gets read as ' +
        'abrupt at work. Telugu puts respect into verb endings and pronouns; English ' +
        'puts it into how indirect you are willing to be. So "Send me the file" can ' +
        'come out of a completely respectful intention and land as an order, because ' +
        'the respect was marked somewhere the reader is not looking. Nothing about ' +
        'the sentence is broken — it is a mismatch of where the politeness lives, and ' +
        'one extra word usually fixes it.',

    notice: {
        lines: [
            { speaker: 'You', text: 'Morning — **could you** have a look at the deployment log when you get a minute?' },
            { speaker: 'Colleague', text: 'Sure. **Can I** send it to you after standup, or do you need it now?' },
            { speaker: 'You', text: 'After standup is fine. And **may I** ask you something else — **can you** actually deploy to staging, or is that locked to the leads?' },
            { speaker: 'Colleague', text: 'I **can**, yes. But I **may not** touch production, that one really is locked.' }
        ],
        question: 'Four modals, and only one of them is about ability. Which one — and ' +
            'what are the other three doing?',
        answer: '*Can you actually deploy* is the ability one, and so is the reply *I ' +
            'can, yes*. **`Could you have a look`** is a request, and it is not past — ' +
            'it is asking about right now, one step back so it does not read as an ' +
            'instruction. **`Can I send it`** is asking permission for the speaker. ' +
            '**`May I ask you something`** is also permission, and notice it is *I* — ' +
            'you could not swap in *May you*. And **`I may not touch production`** is ' +
            'permission refused by someone else\'s rule, which is why it is not *cannot*: ' +
            'they are able to, they are not allowed to.'
    },

    contrast: [
        {
            pair: [
                {
                    text: 'Can you send me the file?',
                    means: 'A neutral request. Perfectly polite with a colleague, a friend, ' +
                        'anyone you already deal with. It is short because you are not ' +
                        'imposing much and both of you know it.'
                },
                {
                    text: 'Could you send me the file?',
                    means: 'The same request, one step further back. You are treating it as ' +
                        'something they might reasonably not do — which is what you want with ' +
                        'someone senior, someone you have not met, or a bigger favour. Not ' +
                        'past tense. Just less direct.'
                }
            ],
            takeaway: '`could` here is distance, not time. Both are asking about now.'
        },
        {
            pair: [
                {
                    text: 'Can I use this room?',
                    means: 'Is it available, is it allowed, is anything stopping me — you are ' +
                        'asking about the situation as much as about the person.'
                },
                {
                    text: 'May I use this room?',
                    means: 'You are asking a person who has the standing to say no, and ' +
                        'acknowledging that they do. Right in front of a host, a manager, ' +
                        'someone whose room it is.'
                }
            ],
            takeaway: '`may` is about whose permission it is, not about how polite you are being.'
        },
        {
            pair: [
                {
                    text: 'I can\'t come tomorrow.',
                    means: 'Something is stopping me, now, about a day that has not happened.'
                },
                {
                    text: 'I couldn\'t come yesterday.',
                    means: 'Something stopped me, then. Here `could` genuinely IS the past of ' +
                        '`can` — because this is ability, not a request.'
                }
            ],
            takeaway: 'The one place `could` is about time is ability. In a request it never is.'
        }
    ],

    spokenNote: 'Two things happen out loud. `can` and `can\'t` are told apart by the ' +
        'vowel and the stress more than by the *t*, which often nearly disappears — ' +
        '*I CAN\'T hear you* is heavy on the modal, *I can HEAR you* is heavy on the ' +
        'verb. If a listener mishears which one you said, stress the right word rather ' +
        'than over-pronouncing the *t*. And in a request, intonation carries as much ' +
        'as the modal does: *Could you send me the file?* said flat and falling can ' +
        'still sound like an instruction, so let it rise at the end.',

    caveats: [
        'A bare imperative is not rude in itself. *Send me the file* is normal ' +
        'between people who work together closely, and in a list of steps, and in ' +
        'your own notes. It reads as abrupt mainly when it goes to someone senior, ' +
        'someone outside your team, or someone you have never met — which is exactly ' +
        'when one extra word is cheap.',
        '*Can* for permission is completely standard and always has been. Some older ' +
        'style guides insisted only *may* could grant permission; nobody speaks that ' +
        'way and you should not worry about it. The reason to reach for *may* is who ' +
        'you are asking, not correctness.',
        'More distance is not always better. *I was wondering if you could possibly ' +
        'send me the file when you have a moment* to a colleague you sit beside is ' +
        'odd, and can read as sarcastic or as though something is wrong. Match the ' +
        'distance to the size of the ask.',
        '*Could* has a third job this point does not cover: possibility, as in *That ' +
        'could be the problem*. Same word, no relation to either ability or requests.',
        '*Can\'t* and *may not* are not interchangeable. *You can\'t park here* says ' +
        'it is not possible or not allowed, full stop. *You may not park here* is ' +
        'someone with authority withholding permission, and sounds like a rule being ' +
        'stated. On a sign, either; from a person, they say different things about who ' +
        'is deciding.'
    ],

    commonErrors: [
        {
            heard: 'May you send me the file?',
            fix: 'Could you send me the file?',
            why: 'Their permission is not what is in question — you are asking them to ' +
                'do something. *May* goes with *I*. This is what a politeness ladder ' +
                'produces: told *may* is the polite one, you reach for it where it has ' +
                'no job.',
            l1: null
        },
        {
            heard: 'Can you to send me the file?',
            fix: 'Can you send me the file?',
            why: 'A modal is followed by the plain verb. No *to*, ever.',
            l1: null
        },
        {
            heard: 'Could you sends me the file?',
            fix: 'Could you send me the file?',
            why: 'The modal has taken over, so the main verb goes plain — the same ' +
                'thing that happens after a borrowed *do*: *Does he work here?*, not ' +
                '*Does he works here?*',
            l1: null
        },
        {
            heard: 'Send me the file.',
            fix: 'Could you send me the file?',
            why: 'Not wrong — correct English, and fine with people you work with ' +
                'daily. But to a client or someone senior it reads as an instruction, ' +
                'because English marks respect through indirectness where Telugu marks ' +
                'it on the verb.',
            l1: 'T-G9'
        }
    ],

    practice: [
        {
            id: 'modals-p1',
            mode: 'gap',
            focus: 'Distance in a request to someone you have never met',
            prompt: 'First email to a client in Chicago you have never spoken to, asking ' +
                'for something that will take them half an hour: "Hello Dana — ___ send ' +
                'me the signed copy before Friday?"',
            options: ['could you', 'would you', 'may you', 'can you please to'],
            accept: [
                {
                    answer: 'could you',
                    means: 'Asks whether they are ABLE to, treating it as something they ' +
                        'might reasonably not manage. The safest default with a stranger.'
                },
                {
                    answer: 'would you',
                    means: 'Asks whether they are WILLING to. Slightly more direct about ' +
                        'wanting them to agree, and a shade warmer — good when you already ' +
                        'expect a yes.'
                }
            ],
            showDifferenceOnCorrect: true,
            spoken: 'Let it rise at the end. Falling intonation on a request turns it back into an instruction.',
            feedback: [
                {
                    forAnswer: 'may you',
                    reason: 'This is the politeness-ladder mistake, and it is worth naming ' +
                        'because the instinct behind it is right. *May* is not the polite ' +
                        'version of *can* — it asks permission of the person who could refuse. ' +
                        'Here you are not asking Dana for permission, you are asking her to do ' +
                        'something, so there is no permission on the table for *may* to ask ' +
                        'about.',
                    contrast: [
                        'Could you send me the signed copy before Friday?',
                        'May I send you the draft before Friday?'
                    ],
                    retryCue: '*May* goes with *I*. When the subject is *you* and you want them ' +
                        'to act, reach for *could* or *would*.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'may-with-second-person-request'
                },
                {
                    forAnswer: 'can you please to',
                    reason: 'Two things at once. A modal is always followed by the plain ' +
                        'verb, so the *to* has to go — *can you send*, never *can you to ' +
                        'send*. And *please* is not what creates distance here; adding it to a ' +
                        'direct request makes it insistent rather than softer, which is the ' +
                        'opposite of what a first email to a stranger wants.',
                    contrast: [
                        'Could you send me the signed copy before Friday?',
                        'Can you send me the signed copy before Friday?'
                    ],
                    retryCue: 'Drop the *to*, and get the politeness from the modal rather ' +
                        'than from *please*.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'to-after-modal'
                }
            ],
            fallbackFeedback: {
                reason: 'The gap wants a modal plus *you* plus a plain verb, and enough ' +
                    'distance for a stranger. *Could you* and *would you* are both right. ' +
                    '*I was wondering if you could* is also right and steps back further, ' +
                    'which suits an ask this size.',
                contrast: [
                    'Could you send me the signed copy before Friday?',
                    'Send me the signed copy before Friday.'
                ],
                retryCue: 'Put a modal in front of *you*, and leave the verb plain.'
            },
            alsoNotice: 'The two right answers ask about different things — *could* about ' +
                'ability, *would* about willingness. Most of the time either is fine, and ' +
                'that is why request modals are so hard to get "wrong".'
        },
        {
            id: 'modals-p2',
            mode: 'gap',
            focus: 'Permission for yourself, from someone who can refuse',
            prompt: 'Your manager\'s door is closed and she is with someone, but you need ' +
                'ten seconds of her time: you knock and say, "Sorry — ___ borrow you for ' +
                'ten seconds?"',
            options: ['may I', 'may you', 'can I to', 'I can'],
            accept: [
                {
                    answer: 'may I',
                    means: 'Asks her permission, and acknowledges that she is entitled to ' +
                        'say no — which she visibly is, since she is mid-conversation.'
                }
            ],
            showDifferenceOnCorrect: false,
            spoken: 'Quietly, and stop after it. The pause is part of the ask.',
            feedback: [
                {
                    forAnswer: 'may you',
                    reason: 'The subject is the giveaway. You are asking for permission for ' +
                        'YOURSELF, so the subject has to be *I*. *May you* would be asking ' +
                        'whether she has permission to be borrowed, which is not a question ' +
                        'anyone is asking.',
                    contrast: [
                        'May I borrow you for ten seconds?',
                        'Could you spare me ten seconds?'
                    ],
                    retryCue: 'Who needs the permission here — you, or her? Put that person ' +
                        'after the modal.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'may-with-second-person-request'
                },
                {
                    forAnswer: 'can I to',
                    reason: 'The modal is right for a colleague you know well, but a modal ' +
                        'never takes *to* after it. *Can I borrow*, not *can I to borrow*.',
                    contrast: [
                        'Can I borrow you for ten seconds?',
                        'Can I to borrow you for ten seconds?'
                    ],
                    retryCue: 'Take out the *to*, then decide whether *can* or *may* fits ' +
                        'someone whose door is shut.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'to-after-modal'
                },
                {
                    forAnswer: 'I can',
                    reason: 'This is a statement, not a question — the modal has to come in ' +
                        'front of the subject to ask anything, exactly as in *Do you know…?* ' +
                        'A modal is its own helper, so it moves by itself and borrows no *do*.',
                    contrast: [
                        'May I borrow you for ten seconds?',
                        'I may borrow you for ten seconds.'
                    ],
                    retryCue: 'This clause is the question, so the helper goes in front of ' +
                        'the subject. The modal IS the helper.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.word-order',
                    errorKind: 'modal-not-inverted-in-question'
                }
            ],
            fallbackFeedback: {
                reason: 'You need permission for yourself from someone who can clearly ' +
                    'refuse, so the subject is *I* and the modal goes in front of it. *Could ' +
                    'I* is also right and slightly softer than *can I*; *may I* is the one ' +
                    'that most openly grants her the right to say no.',
                contrast: [
                    'May I borrow you for ten seconds?',
                    'Can I borrow you for ten seconds?'
                ],
                retryCue: 'Modal, then *I*, then the plain verb.'
            },
            alsoNotice: '*Can I* and *Could I* are both fine here too. What is not fine is ' +
                '*May you* — and the reason is the subject, not the politeness.'
        },
        {
            id: 'modals-p3',
            mode: 'gap',
            focus: 'The one place `could` really is the past',
            prompt: 'Talking about your childhood: "By the time I started school I ___ ' +
                'read Telugu perfectly well, but I did not know a word of English."',
            options: ['could', 'can', 'may', 'could to'],
            accept: [
                {
                    answer: 'could',
                    means: 'Past ability — you had the skill, then. This is `could` doing ' +
                        'the one job where it genuinely is the past of `can`.'
                }
            ],
            showDifferenceOnCorrect: false,
            spoken: 'Unstressed, almost swallowed — *I c\'d read Telugu*. Modals rarely take the beat.',
            feedback: [
                {
                    forAnswer: 'can',
                    reason: 'The rest of the sentence closes the time: *by the time I ' +
                        'started school*, and *I did not know* is past too. So the ability ' +
                        'belongs to then, not now, and *can* would put it in the present.',
                    contrast: [
                        'By the time I started school I could read Telugu.',
                        'I can read Telugu.'
                    ],
                    retryCue: 'The sentence has already said when. Make the modal agree with it.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.tense-agreement',
                    errorKind: 'present-modal-in-closed-past'
                },
                {
                    forAnswer: 'may',
                    reason: '*May* is about permission, and nobody was giving or withholding ' +
                        'permission to read. This is a skill you had, which is ability.',
                    contrast: [
                        'By the time I started school I could read Telugu.',
                        'May I read this?'
                    ],
                    retryCue: 'Ability or permission? Pick the modal for the one this sentence is about.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'permission-modal-for-ability'
                },
                {
                    forAnswer: 'could to',
                    reason: 'The modal is right; the *to* cannot be there. This is the same ' +
                        'rule in every one of these sentences — after a modal, the plain verb ' +
                        'and nothing in between.',
                    contrast: [
                        'I could read Telugu.',
                        'I could to read Telugu.'
                    ],
                    retryCue: 'Delete the *to*.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'to-after-modal'
                }
            ],
            fallbackFeedback: {
                reason: 'This is past ability in a time the sentence has already closed, so ' +
                    '*could* is the answer, with the plain verb after it. *Was able to read* ' +
                    'is also correct and means the same thing — it is just longer, which is ' +
                    'why it is not offered here.',
                contrast: [
                    'By the time I started school I could read Telugu.',
                    'By the time I started school I can read Telugu.'
                ],
                retryCue: 'Past ability. One word, then *read*.'
            },
            alsoNotice: 'This is the item to remember when a request confuses you. *Could* ' +
                'is past HERE because this is ability. In *Could you send me the file?* ' +
                'nothing is past at all.'
        },
        {
            id: 'modals-p4',
            mode: 'gap',
            focus: 'Not allowed, and who is doing the not-allowing',
            prompt: 'A notice taped to a locked cabinet in a hospital ward, signed by the ' +
                'ward sister: "Nursing staff ___ remove items from this cabinet without a ' +
                'countersignature."',
            options: ['may not', 'cannot', 'may not to', 'not may'],
            accept: [
                {
                    answer: 'may not',
                    means: 'Permission withheld by someone with the authority to withhold ' +
                        'it. It sounds like a rule being stated, which is exactly what a ' +
                        'notice signed by the ward sister is.'
                },
                {
                    answer: 'cannot',
                    means: 'Flatly not allowed, or not possible — no particular person doing ' +
                        'the deciding. Reads as the way things are rather than as somebody\'s ' +
                        'ruling.'
                }
            ],
            showDifferenceOnCorrect: true,
            spoken: 'Both stress the modal, not the verb: *may NOT remove*, *canNOT remove*.',
            feedback: [
                {
                    forAnswer: 'may not to',
                    reason: 'Right modal, but *to* cannot follow it. The negative sits ' +
                        'between the modal and the plain verb, and nothing else does.',
                    contrast: [
                        'Nursing staff may not remove items from this cabinet.',
                        'Nursing staff may not to remove items from this cabinet.'
                    ],
                    retryCue: 'Modal, *not*, plain verb. Take out the *to*.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'to-after-modal'
                },
                {
                    forAnswer: 'not may',
                    reason: 'The order is fixed: the modal first, then *not*. English puts ' +
                        'the negative after the helper, never in front of it — the same shape ' +
                        'as *is not*, *does not*, *have not*.',
                    contrast: [
                        'Nursing staff may not remove items.',
                        'Nursing staff not may remove items.'
                    ],
                    retryCue: 'Which comes first in *is not* and *does not* — the helper or ' +
                        'the *not*? Same here.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.word-order',
                    errorKind: 'negative-before-modal'
                }
            ],
            fallbackFeedback: {
                reason: 'The gap wants a negated modal followed by the plain verb. *May ' +
                    'not* and *cannot* are both right and say different things about who is ' +
                    'deciding. *Must not* is also correct and is stronger still — an ' +
                    'instruction rather than a permission.',
                contrast: [
                    'Nursing staff may not remove items without a countersignature.',
                    'Nursing staff cannot remove items without a countersignature.'
                ],
                retryCue: 'Modal, then *not*, then the plain verb.'
            },
            alsoNotice: 'On a sign either works. Said by a person they differ: *you may ' +
                'not* is somebody refusing you, *you can\'t* is somebody reporting how ' +
                'things are.'
        },
        {
            id: 'modals-p5',
            mode: 'gap',
            focus: 'Register, not grammar — and the difference matters',
            prompt: 'A message to the finance lead at a company you are hoping will become ' +
                'a client, whom you have met once: "Thanks for the call yesterday. ___ ' +
                'confirm which entity we should invoice?"',
            options: ['Could you', 'Can you', 'Confirm', 'You can confirm'],
            accept: [
                {
                    answer: 'Could you',
                    means: 'One step back, which is what a near-stranger who is deciding ' +
                        'whether to work with you should get.'
                },
                {
                    answer: 'Can you',
                    means: 'Neutral and perfectly polite. Slightly more familiar — fine, ' +
                        'given you have already spoken once, and a little warmer for it.'
                }
            ],
            showDifferenceOnCorrect: true,
            spoken: 'This one is written, so there is no intonation to rescue it. The words carry all of it.',
            feedback: [
                {
                    forAnswer: 'Confirm',
                    reason: 'THIS IS CORRECT ENGLISH and it is not a grammar mistake — it ' +
                        'is a bare imperative, and it is completely normal in a checklist, in ' +
                        'your own notes, or to a colleague you work beside every day. The ' +
                        'issue is only who is reading it. To someone outside your company who ' +
                        'is still deciding about you, it lands as an instruction, because ' +
                        'English marks respect through how indirect you are willing to be — ' +
                        'whereas Telugu marks it on the verb, where an English reader is not ' +
                        'looking. Nothing about your intention was blunt. The politeness was ' +
                        'just encoded somewhere they cannot see it.',
                    contrast: [
                        'Could you confirm which entity we should invoice?',
                        'Confirm which entity we should invoice.'
                    ],
                    retryCue: 'The sentence is fine as English. Add the two words that show ' +
                        'this reader you know they could say no.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.register-indian',
                    errorKind: 'bare-imperative-to-external-reader'
                },
                {
                    forAnswer: 'You can confirm',
                    reason: 'This is a statement telling them what they are able to do, not ' +
                        'a request — so it reads as granting them permission, which is an odd ' +
                        'thing to do to a client. The modal has to come in front of the ' +
                        'subject to ask rather than tell.',
                    contrast: [
                        'Could you confirm which entity we should invoice?',
                        'You can confirm which entity we should invoice.'
                    ],
                    retryCue: 'Move the modal in front of *you* and it becomes a question ' +
                        'instead of an assurance.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.word-order',
                    errorKind: 'modal-not-inverted-in-question'
                }
            ],
            fallbackFeedback: {
                reason: 'A request to someone outside your organisation wants a modal in ' +
                    'front of *you*. *Could you* and *Can you* are both right here. *Would ' +
                    'you mind confirming* and *I was wondering if you could confirm* are also ' +
                    'right and step back further.',
                contrast: [
                    'Could you confirm which entity we should invoice?',
                    'Confirm which entity we should invoice.'
                ],
                retryCue: 'Modal, then *you*, then the plain verb.'
            },
            alsoNotice: 'Note what the app did NOT say about *Confirm*: it did not call it ' +
                'wrong. It is a choice about the reader, and with a teammate it would be the ' +
                'better choice — shorter, and no pretending there is a decision to make.'
        },
        {
            id: 'modals-p6',
            mode: 'gap',
            focus: '`Can I` and `Can you` differ by one word and ask opposite things',
            prompt: 'A colleague is struggling with a spreadsheet and you have twenty free ' +
                'minutes. You want to offer: "That looks painful. ___ give you a hand with it?"',
            options: ['Can I', 'Can you', 'May you', 'Can'],
            accept: [
                {
                    answer: 'Can I',
                    means: 'You are offering yourself — asking whether they will let you ' +
                        'help. The subject is you, because you are the one who would do it.'
                }
            ],
            showDifferenceOnCorrect: false,
            spoken: 'Light and quick. An offer that sounds laboured starts to sound like a favour being done.',
            feedback: [
                {
                    forAnswer: 'Can you',
                    reason: 'This flips who is helping. *Can you give me a hand* asks THEM ' +
                        'to help YOU — the opposite of an offer, and a strange thing to say to ' +
                        'someone who is already struggling. One word, *I* against *you*, ' +
                        'changes the whole direction.',
                    contrast: [
                        'Can I give you a hand with it?',
                        'Can you give me a hand with it?'
                    ],
                    retryCue: 'Who is going to do the helping? Put that person after the modal.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.verb-form',
                    errorKind: 'wrong-subject-in-modal-question'
                },
                {
                    forAnswer: 'May you',
                    reason: 'Two problems, and the subject is the bigger one. You are ' +
                        'offering, so the subject must be *I*. And *may* asks permission of ' +
                        'the person who can refuse — here that is them, about your help, so ' +
                        'even the permission runs the wrong way round.',
                    contrast: [
                        'Can I give you a hand with it?',
                        'May I give you a hand with it?'
                    ],
                    retryCue: 'Change the subject to *I* first. Then either modal works.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'may-with-second-person-request'
                },
                {
                    forAnswer: 'Can',
                    reason: 'The subject is missing. English needs one in front of the verb ' +
                        'even when it is obvious from the situation — Telugu can leave it out ' +
                        'and be perfectly clear, English cannot.',
                    contrast: [
                        'Can I give you a hand with it?',
                        'Can give you a hand with it?'
                    ],
                    retryCue: 'Say who. The modal has moved in front of the subject, but ' +
                        'there still has to be one.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.subject-dropped',
                    errorKind: 'subject-omitted-after-modal'
                }
            ],
            fallbackFeedback: {
                reason: 'You are offering, so the subject is *I*: *Can I give you a hand?* ' +
                    '*Shall I* and *Do you want me to* are also right and equally natural for ' +
                    'an offer; *May I* is right but oddly formal for a colleague at the next desk.',
                contrast: [
                    'Can I give you a hand with it?',
                    'Can you give me a hand with it?'
                ],
                retryCue: 'Modal, then the person who will do it, then the plain verb.'
            },
            alsoNotice: 'This pair is worth over-learning, because both sentences are ' +
                'correct English and nothing will flag the mistake for you — you will just ' +
                'have asked for help when you meant to offer it.'
        }
    ],

    produce: {
        id: 'modals-produce',
        task: 'Out loud, and without writing anything first: ask the same person for the ' +
            'same thing three times, at three distances. First as you would ask a friend ' +
            'sitting next to you. Then as you would ask a manager you like. Then as you ' +
            'would ask someone you have never met who is doing you a real favour. Then ' +
            'offer to help them with something, and finally ask permission to leave early.',
        targetSeconds: 60,
        useLanguage: [
            'Can you… — the neutral request, once',
            'Could you… — the same request, one step back',
            'I was wondering if you could… — the same request, several steps back',
            'Can I… / Shall I… — an offer, where the subject is you',
            'May I… — permission, from someone who could say no'
        ],
        selfCheck: [
            'After every modal, did the verb come out plain — *send*, not *to send*, ' +
            '*sends* or *sending*?',
            'In each request, did the modal come BEFORE the person — *Could you send…*, ' +
            'not *You could send…*?',
            'When I was offering, was the subject *I*? When I was asking them to act, was it *you*?',
            'Did I use *may* only with *I* — never *May you…*?',
            'Did the three distances actually sound different, or did all three come out the same?'
        ],
        model: {
            text: 'Hey, can you send me the invoice? … Could you send me the invoice when ' +
                'you get a minute? … Sorry to bother you — I was wondering if you could ' +
                'possibly send me that invoice before Friday? … That looks painful, can I ' +
                'give you a hand? … May I head off a bit early today? I can finish the rest ' +
                'from home.',
            note: 'Read it once for the shape, then look away and do it about something ' +
                'real you actually need this week. The point is not the sentences — it is ' +
                'feeling the distance change, because that is the thing you have to judge ' +
                'live, in front of a person, with no time to plan.'
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            transferId: 'T-G9',
            priority: 'M',
            note: 'Telugu marks respect in the grammar itself — verb endings, and the ' +
                '*nuvvu* / *meeru* choice, which is obligatory and unmissable. English has ' +
                'almost none of that. It marks respect by how indirect you are prepared to ' +
                'be, which lives in modal choice and sentence length rather than in any ' +
                'ending. So a request that was fully respectful in Telugu can arrive in ' +
                'English as an order, not because anything was lost in your grammar but ' +
                'because the reader is looking in a different place. This is filed under ' +
                'the register row (T-G9) rather than a grammar row on purpose: nothing here ' +
                'is an error.',
            bridge: 'Ask yourself the question you already ask in Telugu — *nuvvu* or ' +
                '*meeru*? You know the answer instantly. If the answer is *meeru*, English ' +
                'wants the extra word: *could* rather than *can*, and a modal rather than a ' +
                'bare imperative. You are not learning a new judgement. You are learning ' +
                'where English keeps one you already make.'
        }
    },

    review: {
        rulePrompt: 'In a request, what is *could* doing — putting it in the past, or ' +
            'putting it at a distance? And which one of *can*, *could* and *may* cannot ' +
            'go with *you*?',
        itemIds: ['modals-p1', 'modals-p2', 'modals-p3', 'modals-p4', 'modals-p5', 'modals-p6']
    },

    tags: ['modals', 'can', 'could', 'may', 'requests', 'permission', 'ability',
           'politeness', 'register', 'T-G9', 'high-frequency']
};

// Self-registration, exactly as data/grammar/be.js and question-formation.js do it.
// `grammarLessons` in data/grammar.js is a top-level `const`, i.e. a lexical
// global, so a classic script loaded AFTER it can read the binding by bare name
// and push into the tier array.
//
// The guards cover the two things that can actually go wrong: a script-order
// mistake (grammar.js absent) leaves the point unregistered instead of throwing
// during page load, and an id already present is not pushed twice.
//
// A duplicate <script> include of THIS file is a different matter: it throws
// "GRAMMAR_MODALS has already been declared" at parse time, as a second include
// of any file in this codebase would. That is the classic-script contract, not
// something these guards can rescue.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.foundation) &&
    !grammarLessons.foundation.some(function (p) { return p && p.id === GRAMMAR_MODALS.id; })) {
    grammarLessons.foundation.push(GRAMMAR_MODALS);
}
