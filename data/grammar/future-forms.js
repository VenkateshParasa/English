/**
 * Strand B, syllabus point 10 — future forms: will / going to / present continuous.
 *
 * ONE IDEA, and it replaces the textbook one. Almost every course teaches this as
 * "`will` for predictions, `going to` for plans", which is close to useless: it
 * asks a learner to classify their own utterance as a "prediction" in real time,
 * and the categories do not carve the language where they claim to. What works is
 * a question about the SPEAKER'S OWN MENTAL STATE, which is always available:
 *
 *   `will`               — I am deciding RIGHT NOW, as I speak.
 *   `going to`           — I decided EARLIER. I am reporting that decision.
 *   present continuous   — it is ARRANGED, and someone else knows about it.
 *   present simple       — nobody decided; it is a timetable.
 *
 * WHY THIS MATTERS FOR A TELUGU L1 SPEAKER. Telugu has a real future tense,
 * marked on the verb, and there is ONE of it. So a Telugu-L1 speaker has one
 * future where English has three, and the efficient strategy is to pick one
 * English form and use it everywhere — nearly always `will`. That produces
 * "I will meet Ravi at six" for a fixed arrangement and "I will go to Hyderabad
 * next month" for a booked trip.
 *
 * NEITHER SENTENCE IS UNGRAMMATICAL, and this file never grades them as grammar
 * errors. What they get wrong is how SETTLED the plan sounds: `will` reads as a
 * decision being taken at the moment of speaking, so a booked trip described
 * with `will` sounds undecided. That is a register mismatch, so the wrong-option
 * feedback for it carries `logAs: "gram.register-indian"` and
 * `grammaticalButDifferent: true`, and says outright that the sentence is
 * correct English. Same posture as data/grammar/modals.js on the bare imperative
 * and question-formation.js on invariant "isn't it?".
 *
 * `mistakeCategory` is `gram.verb-form`, the point default, because the items'
 * genuinely BROKEN options are malformed verb groups (*will meeting*, *am go*,
 * *going to learning*). Choosing the wrong one of three well-formed futures is
 * logged per-option instead — `gram.register-indian` where the cause is the
 * one-Telugu-future transfer, `gram.tense-agreement` where a form simply points
 * at the wrong kind of futurity. No category in js/core/mistakes.js names
 * "future-form settledness", and this file may not mint one.
 *
 * `l1Notes.transferId` is T-G9, the Indian-English register row, and that is
 * deliberate: REQUIREMENTS.md §3.2 has NO row for the single-future transfer, and
 * because the resulting sentences are grammatical the register row describes it
 * better than any grammar row would. Do not "correct" this to a grammar code.
 *
 * `shall` is handled in `future-forms-p5` and in `caveats`: it is NOT a politer
 * `will`. It survives in offers and suggestions — *Shall I…?*, *Shall we…?* —
 * which is precisely where an Indian-English speaker uses it correctly and is
 * sometimes wrongly corrected by a style checker. The item exists to confirm the
 * learner is right, not to fix them.
 *
 * ADVERSARIAL NOTE for whoever edits an item. Future forms are the worst point in
 * the syllabus for accidental second answers: in most sentences two of the three
 * forms are fine and differ only in nuance. Items 1, 3 and 4 therefore ACCEPT TWO
 * answers and state the difference; items 2, 5 and 6 have prompts that block the
 * alternatives by naming the speaker's mental state ("you had not thought about
 * it", "I decided a couple of weeks ago"). If you loosen one of those prompts you
 * will re-open its answer set.
 */

const GRAMMAR_FUTURE_FORMS = {
    id: 'future-forms',
    syllabusNumber: 10,
    tier: 'everyday',
    cefr: 'B1',
    title: 'Talking about later: will, going to and the present continuous',
    srsType: 'gram',
    srsRef: 'future-forms',
    srsKey: 'gram:future-forms',
    mistakeCategory: 'gram.verb-form',
    prerequisites: ['present-simple-vs-continuous', 'modals'],

    rule: 'English picks a future form by asking **when the decision was made**, not ' +
        'by asking what kind of statement it is. `will` = I am deciding as I speak. ' +
        '`going to` = I decided earlier and I am reporting it. The **present ' +
        'continuous** = it is arranged, and someone else knows. The **present ' +
        'simple** = nobody decided; it is a timetable.',

    explain: 'Forget "predictions versus plans". That test asks you to label your own ' +
        'sentence while you are still saying it, and the labels overlap anyway.\n\n' +
        '**`will` is the moment of decision.** The phone rings, nobody moves, you say ' +
        '*I\'ll get it* — you did not have that intention a second earlier. Offers, ' +
        'promises and on-the-spot choices all live here: *I\'ll have the biryani*, said ' +
        'with your finger still on the menu.\n\n' +
        '**`going to` reports a decision you already took.** *I\'m going to learn ' +
        'Python this year* says the deciding is over; it happened last week, in your ' +
        'head, and nothing has been booked or arranged with anybody.\n\n' +
        '**The present continuous says it is arranged.** *I\'m meeting Ravi at six* ' +
        'means Ravi knows too — a time, a place, another person. This is the form an ' +
        'English listener expects when you answer *what are you doing tomorrow?*\n\n' +
        '**The present simple is for timetables.** *The train leaves at six.* No ' +
        'decision of yours is involved; you are quoting a schedule.\n\n' +
        'The reason this test is better is that you always know the answer. You know ' +
        'whether you decided just now or last week, and you know whether anyone else ' +
        'is expecting you. You do not have to decide whether your own sentence counts ' +
        'as a "prediction".',

    decide: [
        'Am I deciding this AS I SPEAK — an offer, a promise, a choice I have only ' +
        'just made? Then `will`: *I\'ll get it.*',
        'Did I decide EARLIER, with nothing arranged yet? Then `going to`: *I\'m going ' +
        'to learn Python.*',
        'Is it ARRANGED — a time, and another person who knows? Then the present ' +
        'continuous: *I\'m meeting Ravi at six.*',
        'Is it a TIMETABLE that nobody in this conversation decided? Then the present ' +
        'simple: *The train leaves at six.*',
        'If two of these are true, two forms are right and they emphasise different ' +
        'things. That is normal and you have not made a mistake.',
        'For an offer or a suggestion, `shall` is the natural word: *Shall I carry ' +
        'that?*, *Shall we try the new place?* It is not a formal `will`.'
    ],

    whyItMatters: 'Telugu has one future tense; English has three forms and no single ' +
        'default. So the efficient strategy — pick `will` and use it everywhere — ' +
        'produces perfectly grammatical English that sounds undecided. "I will go to ' +
        'Hyderabad next month" about a trip whose tickets are already booked leaves a ' +
        'listener unsure whether it is settled, and they may ask again. Nothing in the ' +
        'sentence is broken. It just does not sound as fixed as your plan actually is.',

    notice: {
        lines: [
            { speaker: 'Colleague', text: 'Are you around on Thursday?' },
            { speaker: 'You', text: 'Thursday\'s bad — **I\'m flying** to Delhi in the morning. The tickets came through yesterday.' },
            { speaker: 'Colleague', text: 'Right. **I\'m going to** book my own leave this week, actually — I decided over the weekend.' },
            { speaker: 'You', text: 'Do it before the sheet fills up. Oh — **I\'ll** send you the client deck now, before I forget. **Shall I** copy in Priya?' },
            { speaker: 'Colleague', text: 'Please. And check the times — **the flight leaves** at 6:20, not 7.' }
        ],
        question: 'Four different futures in five lines. What decides which one each ' +
            'speaker reaches for?',
        answer: '**`I\'m flying`** — arranged, dated, tickets in hand, and the airline ' +
            'knows. **`I\'m going to book`** — decided over the weekend, but nothing is ' +
            'arranged with anyone yet. **`I\'ll send`** — decided in the middle of the ' +
            'sentence, which is why it comes with *before I forget*. **`the flight ' +
            'leaves`** — a timetable nobody in this conversation decided. And **`Shall ' +
            'I`** is an offer, not a formal `will`. Notice that none of these is a ' +
            '"prediction", and the choice was never in doubt.'
    },

    contrast: [
        {
            pair: [
                {
                    text: 'I\'ll have the mutton biryani.',
                    means: 'You are deciding now, menu still open. This is the form a waiter ' +
                        'expects, because the decision is happening in front of them.'
                },
                {
                    text: 'I\'m going to have the mutton biryani.',
                    means: 'You decided before you sat down — on the way over, or last time you ' +
                        'came. You are reporting a decision, not making one.'
                }
            ],
            takeaway: 'Both are correct. They differ only in WHEN you decided.'
        },
        {
            pair: [
                {
                    text: 'I\'ll meet Ravi at six.',
                    means: 'You are settling it as you speak — perhaps offering, perhaps ' +
                        'agreeing to something just suggested. Ravi may not know yet.'
                },
                {
                    text: 'I\'m meeting Ravi at six.',
                    means: 'Already arranged. Ravi knows, the time is fixed, and it is in your ' +
                        'day whether or not this conversation happens.'
                }
            ],
            takeaway: 'The continuous says someone else is expecting you. `will` does not.'
        },
        {
            pair: [
                {
                    text: 'The train leaves at six.',
                    means: 'The timetable, every day. Nobody in this conversation decided it and ' +
                        'nobody can change it.'
                },
                {
                    text: 'The train is leaving at six.',
                    means: 'This particular train, today. Often used when the time has been ' +
                        'confirmed or changed for this one departure.'
                }
            ],
            takeaway: 'Both are right. The simple form is the schedule; the continuous is ' +
                'this one occasion.'
        }
    ],

    spokenNote: '`will` is almost never said in full. It contracts onto the subject — ' +
        '*I\'ll*, *we\'ll*, *he\'ll* — and in fast speech *I\'ll* is barely more than a ' +
        'long *I*. Saying *I will send it* in full sounds like a formal promise or an ' +
        'argument (*I WILL send it*), which is why over-using the uncontracted form can ' +
        'make ordinary sentences sound insistent. `going to` reduces to *gonna* before ' +
        'a verb in relaxed speech and this is completely standard spoken English, ' +
        'though it is not written outside dialogue.',

    caveats: [
        '**`shall` is not a politer `will`.** In current English it survives mainly in ' +
        'offers and suggestions — *Shall I carry that?*, *Shall we go?* — where it is ' +
        'the natural, idiomatic choice and no other word does the job as neatly. Indian ' +
        'English uses it exactly there, correctly, and is sometimes "corrected" by ' +
        'style checkers that know only the old *I shall / you will* rule. Ignore them.',
        'Two forms are right far more often than a textbook admits. *I\'m going to see ' +
        'the doctor tomorrow* and *I\'m seeing the doctor tomorrow* can both be true of ' +
        'the same appointment; the first foregrounds your intention, the second the ' +
        'arrangement. If a course tells you one of these is wrong, the course is ' +
        'simplifying.',
        '`going to` has a second job this point touches only lightly: something visibly ' +
        'about to happen, on present evidence. *Watch out — that shelf is going to ' +
        'fall.* No decision is involved at all, and `will` would sound like a guess ' +
        'rather than a warning.',
        '`will` is also the ordinary form for opinions and neutral predictions about ' +
        'things nobody decides — *I think it\'ll rain*, *she\'ll be about forty*. That ' +
        'use is untouched by everything above, because there is no decision to date.',
        'The present continuous needs a time, stated or obvious. *I\'m meeting Ravi* on ' +
        'its own can be heard as right now, so say *at six* or *tomorrow* unless the ' +
        'context has already supplied it.'
    ],

    commonErrors: [
        {
            heard: 'I will meet Ravi at six.',
            fix: 'I\'m meeting Ravi at six.',
            why: 'Grammatical, and fine if you are settling it as you speak. But if it is ' +
                'already arranged and Ravi knows, `will` makes a fixed plan sound like a ' +
                'decision you are taking mid-sentence, and the listener may ask again.',
            l1: 'T-G9'
        },
        {
            heard: 'I will go to Hyderabad next month. The tickets are booked.',
            fix: 'I\'m going to Hyderabad next month. The tickets are booked.',
            why: 'The two halves disagree about how settled it is. Once tickets exist, ' +
                'English reaches for the continuous. This is the single most common ' +
                'future-form pattern in Telugu-L1 English and it is not an error — it is a ' +
                'plan that sounds looser than it is.',
            l1: 'T-G9'
        },
        {
            heard: 'I will meeting him tomorrow.',
            fix: 'I\'m meeting him tomorrow.',
            why: 'This one really is broken: a modal takes the plain verb, so `will` cannot ' +
                'sit in front of *meeting*. Either *will meet* or *am meeting* — the two ' +
                'forms have collided into one.',
            l1: null
        },
        {
            heard: 'I am going to learning Python.',
            fix: 'I\'m going to learn Python.',
            why: '*going to* is followed by the plain verb, exactly like a modal. The *-ing* ' +
                'has been copied from the *going*, which is where the pull comes from.',
            l1: null
        }
    ],

    practice: [
        {
            id: 'future-forms-p1',
            mode: 'gap',
            focus: 'An arrangement another person already knows about',
            prompt: 'You and Ravi agreed yesterday on a time and a place, and he is ' +
                'expecting you. A colleague asks what you are doing this evening: "I ___ ' +
                'Ravi at six at the coffee place near the office."',
            options: ['am meeting', 'am going to meet', 'will meet', 'will meeting'],
            accept: [
                {
                    answer: 'am meeting',
                    means: 'Reports the ARRANGEMENT. Ravi knows, the time is fixed, and this is ' +
                        'the form an English listener expects when you describe your evening.'
                },
                {
                    answer: 'am going to meet',
                    means: 'Reports YOUR INTENTION, decided earlier. Also true here — but you ' +
                        'could say it about someone who does not know yet, which is exactly ' +
                        'what the continuous rules out.'
                }
            ],
            showDifferenceOnCorrect: true,
            spoken: 'Stress *six*, not *meeting*. The new information is the time.',
            feedback: [
                {
                    forAnswer: 'will meet',
                    reason: 'This is the sentence to look at hardest, because there is nothing ' +
                        'wrong with it as English — and it is the most common Telugu-L1 future ' +
                        'in the language. `will` reads as a decision being made at the moment of ' +
                        'speaking, so answering *what are you doing this evening?* with *I will ' +
                        'meet Ravi at six* sounds as though you are settling it now, when in ' +
                        'fact you settled it yesterday and Ravi is already expecting you. Your ' +
                        'plan is firmer than your sentence.',
                    contrast: [
                        'I\'m meeting Ravi at six. (arranged yesterday, he knows)',
                        'Fine, I\'ll meet Ravi at six then. (deciding right now, in reply)'
                    ],
                    retryCue: 'It is arranged and someone else knows. Use the present continuous.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.register-indian',
                    errorKind: 'will-for-fixed-arrangement'
                },
                {
                    forAnswer: 'will meeting',
                    reason: 'Two futures have collided. `will` takes the plain verb, like every ' +
                        'modal — *will meet* — and the *-ing* belongs to the other form, which ' +
                        'needs *am*: *am meeting*. Pick one whole form rather than half of each.',
                    contrast: [
                        'I\'m meeting Ravi at six.',
                        'I\'ll meet Ravi at six.'
                    ],
                    retryCue: 'Either *am* + *-ing*, or *will* + plain verb. Never *will* + *-ing*.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'will-plus-ing'
                }
            ],
            fallbackFeedback: {
                reason: 'The evening is already arranged with another person, so English wants ' +
                    'the present continuous — *am* plus *-ing*. *I\'m going to meet Ravi* is ' +
                    'also right and puts the weight on your intention instead.',
                contrast: [
                    'I\'m meeting Ravi at six.',
                    'I will meet Ravi at six. (correct, but sounds undecided)'
                ],
                retryCue: 'Arranged, with someone who knows: *am* + *-ing*.'
            },
            alsoNotice: 'Both right answers are real English and neither is a mistake. The ' +
                'continuous is the one that tells your colleague not to bother suggesting ' +
                'anything else this evening.'
        },
        {
            id: 'future-forms-p2',
            mode: 'gap',
            focus: 'A decision made in the moment of speaking',
            prompt: 'The office phone starts ringing and nobody moves. A second ago you had ' +
                'not thought about it at all; now you reach for it: "___ get it."',
            options: ['I\'ll', 'I\'m going to', 'I\'m getting', 'Will I'],
            accept: [
                {
                    answer: 'I\'ll',
                    means: 'The decision is being made inside the sentence. This is what `will` ' +
                        'is for, and it is why offers almost always take it.'
                }
            ],
            showDifferenceOnCorrect: false,
            spoken: 'Contracted and fast — *I\'ll get it*, one beat. *I will get it* said in ' +
                'full sounds like you are settling an argument about whose turn it is.',
            feedback: [
                {
                    forAnswer: 'I\'m going to',
                    reason: 'Correct English, but it reports a decision you had ALREADY taken — ' +
                        'so it sounds as though you had been intending to answer that phone ' +
                        'before it rang. The prompt says the opposite: a second ago you had not ' +
                        'thought about it.',
                    contrast: [
                        'I\'ll get it. (deciding now, as the phone rings)',
                        'I\'m going to get it — I told Priya I would cover the desk. (decided earlier)'
                    ],
                    retryCue: 'Nothing was decided until this second. That is `will`.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.tense-agreement',
                    errorKind: 'going-to-for-spontaneous-decision'
                },
                {
                    forAnswer: 'I\'m getting',
                    reason: 'The present continuous claims an arrangement — a time, and someone ' +
                        'else who knows. Nobody arranged for you to answer this phone; it just ' +
                        'rang. *I\'m getting it* would also be heard as already in progress.',
                    contrast: [
                        'I\'ll get it. (deciding as it rings)',
                        'I\'m getting the four o\'clock call — Priya\'s taking the rest. (arranged)'
                    ],
                    retryCue: 'No arrangement exists. Use the form for deciding on the spot.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.tense-agreement',
                    errorKind: 'continuous-without-arrangement'
                },
                {
                    forAnswer: 'Will I',
                    reason: 'That is question order, and this is not a question — you are ' +
                        'announcing what you are about to do. *Will I get it?* asks someone else ' +
                        'to decide for you.',
                    contrast: [
                        'I\'ll get it.',
                        'Shall I get it? (if you really are asking)'
                    ],
                    retryCue: 'Subject first in a statement: *I* then the modal.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.word-order',
                    errorKind: 'inversion-in-statement'
                }
            ],
            fallbackFeedback: {
                reason: 'You had no intention until the phone rang, so the decision is being ' +
                    'made inside the sentence. That is what `will` marks, and it contracts: ' +
                    '*I\'ll*.',
                contrast: [
                    'I\'ll get it.',
                    'I\'m going to get it. (implies you had already decided)'
                ],
                retryCue: 'Deciding as you speak: `will`, contracted.'
            },
            alsoNotice: 'Every offer works like this — *I\'ll carry that*, *I\'ll wait*, ' +
                '*I\'ll ask her*. If you find yourself offering with `going to`, listen for ' +
                'whether you really had decided beforehand.'
        },
        {
            id: 'future-forms-p3',
            mode: 'gap',
            focus: 'A timetable nobody in the conversation decided',
            prompt: 'You are at Secunderabad reading the printed departure board aloud to a ' +
                'friend. Nothing here was arranged by either of you: "The Charminar Express ' +
                '___ at 6:20, so we should leave home by five."',
            options: ['leaves', 'is leaving', 'will leave', 'is going to leave'],
            accept: [
                {
                    answer: 'leaves',
                    means: 'The schedule — this is what that train does every day. Timetables take ' +
                        'the present simple even though they are about the future.'
                },
                {
                    answer: 'is leaving',
                    means: 'This particular departure, today. Natural when you are talking about ' +
                        'one journey rather than the daily pattern, or when the time has been ' +
                        'confirmed for this train.'
                }
            ],
            showDifferenceOnCorrect: true,
            spoken: 'Times are where listeners lose the thread. Say *six twenty* clearly and ' +
                'let it carry the stress.',
            feedback: [
                {
                    forAnswer: 'will leave',
                    reason: 'Correct English, and close to what a station announcement says. But ' +
                        'reading a printed board you are quoting a fact, not predicting one, and ' +
                        '`will` invites the thought that something might yet change it. For a ' +
                        'published timetable English prefers the flat present simple.',
                    contrast: [
                        'The Charminar Express leaves at 6:20. (the timetable)',
                        'It\'ll probably leave late — it usually does. (a prediction)'
                    ],
                    retryCue: 'You are reading a schedule. Use the present simple.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.tense-agreement',
                    errorKind: 'will-for-timetable'
                },
                {
                    forAnswer: 'is going to leave',
                    reason: '`going to` needs either a decision somebody took or visible evidence ' +
                        'right now — *the doors are closing, it\'s going to leave*. A printed ' +
                        'board is neither. Here it sounds as though the train has formed an ' +
                        'intention.',
                    contrast: [
                        'The Charminar Express leaves at 6:20. (schedule)',
                        'Run — it\'s going to leave without us. (evidence, this second)'
                    ],
                    retryCue: 'No decision and no evidence — just a schedule. Present simple.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.tense-agreement',
                    errorKind: 'going-to-for-timetable'
                }
            ],
            fallbackFeedback: {
                reason: 'Timetables take the present simple: *the train leaves at 6:20*, *the ' +
                    'film starts at eight*, *the office opens at nine*. *Is leaving* is also ' +
                    'right if you mean this one departure rather than the daily pattern.',
                contrast: [
                    'The Charminar Express leaves at 6:20.',
                    'The Charminar Express is going to leave at 6:20.'
                ],
                retryCue: 'A published schedule. One word, present simple.'
            },
            alsoNotice: 'This is the one future form that looks like a present tense, which ' +
                'is why it gets missed. *What time does your flight land?* — present simple, ' +
                'about tomorrow.'
        },
        {
            id: 'future-forms-p4',
            mode: 'gap',
            focus: 'A booked trip: the settledness trap',
            prompt: 'A colleague asks if you are free on the 14th. Your tickets are booked ' +
                'and your leave is approved: "Sorry, I ___ to Hyderabad that day — the ' +
                'tickets are already booked."',
            options: ['am going', 'am going to go', 'will go', 'am go'],
            accept: [
                {
                    answer: 'am going',
                    means: 'The arrangement itself: dated, booked, on a calendar. This is the form ' +
                        'that matches *the tickets are already booked* and closes the question.'
                },
                {
                    answer: 'am going to go',
                    means: 'Your intention, decided earlier. Real English and very common in ' +
                        'speech — but it is the form you would also use with nothing booked, so ' +
                        'it says less about how fixed this is.'
                }
            ],
            showDifferenceOnCorrect: true,
            spoken: 'Most speakers shorten *going to go* to *going* precisely to avoid the ' +
                'double *go*. Both are said; the short one is commoner.',
            feedback: [
                {
                    forAnswer: 'will go',
                    reason: 'Nothing is wrong with this as a sentence, and it is the commonest ' +
                        'Telugu-L1 future by a wide margin — Telugu has one future tense, so one ' +
                        'English form has to cover everything, and `will` is the one that gets ' +
                        'chosen. But `will` marks a decision taken as you speak, and the second ' +
                        'half of your own sentence says the tickets are already booked. The two ' +
                        'halves disagree about how settled the trip is, and a listener may ask ' +
                        'you again to be sure.',
                    contrast: [
                        'I\'m going to Hyderabad that day — the tickets are booked. (settled)',
                        'All right, I\'ll go on the 14th then. (deciding, right now, in reply)'
                    ],
                    retryCue: 'Booked and dated. Use the present continuous — *am* plus *going*.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.register-indian',
                    errorKind: 'will-for-booked-plan'
                },
                {
                    forAnswer: 'am go',
                    reason: 'This one is genuinely broken. *am* has to be followed by *-ing* ' +
                        '(*am going*), and the plain verb *go* needs a modal in front of it ' +
                        '(*will go*). Half of each form has been taken.',
                    contrast: [
                        'I\'m going to Hyderabad that day.',
                        'I\'ll go to Hyderabad that day.'
                    ],
                    retryCue: 'After *am*, the verb takes *-ing*.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'be-plus-bare-verb'
                }
            ],
            fallbackFeedback: {
                reason: 'The trip is arranged and paid for, so English wants the present ' +
                    'continuous: *I\'m going to Hyderabad*. *I\'m going to go* is also correct ' +
                    'and reports the decision rather than the booking.',
                contrast: [
                    'I\'m going to Hyderabad that day.',
                    'I will go to Hyderabad that day. (correct, but sounds undecided)'
                ],
                retryCue: 'Arranged and dated: *am* + *going*.'
            },
            alsoNotice: 'Note what the feedback did NOT say about *I will go*: it did not ' +
                'call it wrong, because it is not. Every word of it is correct English. What ' +
                'it does is undersell a plan you have already paid for.'
        },
        {
            id: 'future-forms-p5',
            mode: 'gap',
            focus: '`shall` in a suggestion — where Indian English is right',
            prompt: 'You and two colleagues are standing by the lift at one o\'clock. Nobody ' +
                'has decided anything and you want to put an idea on the table: "___ we try ' +
                'the new place on the corner?"',
            options: ['Shall', 'Will', 'Are we going to', 'Shall we to'],
            accept: [
                {
                    answer: 'Shall',
                    means: 'A suggestion. `shall` in a question with *we* proposes something and ' +
                        'invites the others to agree, and no other single word does that job as ' +
                        'neatly in English.'
                }
            ],
            showDifferenceOnCorrect: false,
            spoken: 'Rising at the end. A suggestion said with falling intonation stops ' +
                'sounding like a suggestion.',
            feedback: [
                {
                    forAnswer: 'Will',
                    reason: 'Grammatical, but it is not a suggestion — *Will we try the new ' +
                        'place?* asks whether that is going to happen, as though someone else has ' +
                        'already decided and you are checking. You are the one proposing.',
                    contrast: [
                        'Shall we try the new place? (proposing it)',
                        'Will we get a table at one, do you think? (asking about the facts)'
                    ],
                    retryCue: 'You are proposing, not checking. That is `shall` with *we*.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.tense-agreement',
                    errorKind: 'will-for-suggestion'
                },
                {
                    forAnswer: 'Are we going to',
                    reason: 'Also real English, and also not a proposal — it asks about a ' +
                        'decision that has supposedly already been made, which can come out ' +
                        'sounding impatient: *are we going to try it or not?* Nothing has been ' +
                        'decided yet, so there is no decision to ask about.',
                    contrast: [
                        'Shall we try the new place? (an idea, offered)',
                        'Are we going to try the new place, then? (chasing a decision)'
                    ],
                    retryCue: 'Nothing is decided yet. Offer the idea with `shall`.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.tense-agreement',
                    errorKind: 'going-to-for-suggestion'
                },
                {
                    forAnswer: 'Shall we to',
                    reason: '`shall` is a modal, so the verb after it is plain — *shall we try*, ' +
                        'never *shall we to try*. Same rule as *can*, *could* and *will*.',
                    contrast: [
                        'Shall we try the new place?',
                        'Shall we to try the new place?'
                    ],
                    retryCue: 'Modal, then the plain verb. Drop the *to*.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'to-after-modal'
                }
            ],
            fallbackFeedback: {
                reason: 'A suggestion to a group takes `shall` with *we*, and an offer to one ' +
                    'person takes `shall` with *I*: *Shall I carry that?* This is the one ' +
                    'place `shall` is fully alive in modern English, and it is idiomatic, not ' +
                    'formal.',
                contrast: [
                    'Shall we try the new place?',
                    'Will we try the new place?'
                ],
                retryCue: 'One word, a modal, followed by *we try*.'
            },
            alsoNotice: '`shall` is NOT a politer `will`, and if a style checker flags this ' +
                'sentence, the checker is wrong. Offers and suggestions are exactly where ' +
                'Indian English uses `shall` correctly, and it is worth knowing that so you ' +
                'do not let anyone talk you out of it.'
        },
        {
            id: 'future-forms-p6',
            mode: 'gap',
            focus: 'A decision already taken, with nothing arranged',
            prompt: 'A friend asks what you are doing about your career. You decided a ' +
                'couple of weeks ago, you have told nobody, and you have not enrolled in ' +
                'anything: "I ___ Python properly this year. I decided a fortnight ago."',
            options: ['am going to learn', 'will learn', 'am learning', 'am going to learning'],
            accept: [
                {
                    answer: 'am going to learn',
                    means: 'Reports a decision already taken. Nothing is booked and nobody else ' +
                        'is involved, which is exactly the space `going to` occupies.'
                }
            ],
            showDifferenceOnCorrect: false,
            spoken: 'In relaxed speech this is *I\'m gonna learn*. Completely standard ' +
                'spoken English; just do not write it outside dialogue.',
            feedback: [
                {
                    forAnswer: 'will learn',
                    reason: 'Correct English, but it clashes with your own next sentence. `will` ' +
                        'reads as a decision being made now — a resolution taken on the spot — ' +
                        'and you have just said you decided a fortnight ago. This is the ' +
                        'one-Telugu-future pull again: `will` is doing a job that belongs to ' +
                        '`going to`.',
                    contrast: [
                        'I\'m going to learn Python this year. I decided a fortnight ago.',
                        'You know what? I\'ll learn Python this year. (deciding as you speak)'
                    ],
                    retryCue: 'The deciding is over. Report it with `going to`.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.register-indian',
                    errorKind: 'will-for-earlier-decision'
                },
                {
                    forAnswer: 'am learning',
                    reason: 'The present continuous would claim an arrangement — an enrolled ' +
                        'course, a booked class, someone else expecting you — or that you have ' +
                        'already started. The prompt rules both out: nothing is arranged and you ' +
                        'have told nobody.',
                    contrast: [
                        'I\'m going to learn Python this year. (decided, nothing booked)',
                        'I\'m learning Python on Tuesday evenings. (enrolled, it is arranged)'
                    ],
                    retryCue: 'Decided but not arranged. That is `going to`.',
                    grammaticalButDifferent: true,
                    logAs: 'gram.tense-agreement',
                    errorKind: 'continuous-without-arrangement'
                },
                {
                    forAnswer: 'am going to learning',
                    reason: 'The *-ing* has jumped across from *going*. `going to` behaves like a ' +
                        'modal: the verb after it is plain. *going to learn*, *going to send*, ' +
                        '*going to ask*.',
                    contrast: [
                        'I\'m going to learn Python this year.',
                        'I\'m going to learning Python this year.'
                    ],
                    retryCue: 'After *going to*, the plain verb. Drop the *-ing*.',
                    grammaticalButDifferent: false,
                    logAs: 'gram.verb-form',
                    errorKind: 'going-to-plus-ing'
                }
            ],
            fallbackFeedback: {
                reason: 'You decided a fortnight ago and nothing has been arranged with ' +
                    'anybody, which is precisely `going to`: *I\'m going to learn Python this ' +
                    'year.* The verb after *going to* stays plain.',
                contrast: [
                    'I\'m going to learn Python this year.',
                    'I will learn Python this year. (sounds like you decided just now)'
                ],
                retryCue: 'Decided earlier, nothing booked: *am going to* + plain verb.'
            },
            alsoNotice: 'Put items 2, 4 and 6 side by side and the whole point is there: ' +
                'deciding now (`will`), decided earlier (`going to`), arranged with someone ' +
                '(continuous). Three states of one plan, and you always know which one you ' +
                'are in.'
        }
    ],

    produce: {
        id: 'future-forms-produce',
        task: 'Out loud, no writing first. Describe your actual next seven days in five ' +
            'sentences, and make yourself use a different future in each: one thing that ' +
            'is arranged with another person, one thing you decided earlier but have not ' +
            'arranged, one timetabled thing, one offer you make on the spot, and one ' +
            'suggestion to somebody.',
        targetSeconds: 60,
        useLanguage: [
            'I\'m …-ing on … — arranged, and someone else knows',
            'I\'m going to … — decided earlier, nothing booked',
            'It leaves / starts / opens at … — a timetable',
            'I\'ll … — deciding as you speak; an offer',
            'Shall we … ? — a suggestion'
        ],
        selfCheck: [
            'For the arranged one, did I use *am* + *-ing* rather than `will`? That is the ' +
            'habit this point is trying to build.',
            'After `will` and after *going to*, did the verb come out plain — *learn*, not ' +
            '*learning*?',
            'Did the timetabled one come out as a present simple — *leaves*, not *will leave*?',
            'Was my offer contracted — *I\'ll* — rather than a full *I will*?',
            'Did any sentence sound less settled than the plan actually is? That is the ' +
            'thing to listen for.'
        ],
        model: {
            text: 'I\'m seeing the dentist on Wednesday — that\'s been booked for a month. ' +
                'I\'m going to sort out my passport renewal this week, I decided over the ' +
                'weekend but I haven\'t done anything yet. My train on Friday leaves at 6:20, ' +
                'so it\'s an early start. Oh, you\'re carrying all that — I\'ll take one of ' +
                'those bags. Shall we get a coffee before you go?',
            note: 'Read it once for the shape, then do it about your own week. The value is ' +
                'in noticing which state each plan is actually in — settled, decided, or ' +
                'still an idea — because that is the judgement you have to make live, and it ' +
                'is one Telugu never asks you to make.'
        },
        skippable: true,
        srsSelfReport: true
    },

    l1Notes: {
        telugu: {
            transferId: 'T-G9',
            priority: 'M',
            note: 'Telugu has a genuine future tense marked on the verb, and there is ONE ' +
                'of it. English splits the same ground four ways — `will`, `going to`, the ' +
                'present continuous and the present simple — and has no default. Faced with ' +
                'one form to choose where the first language offered none, the efficient ' +
                'strategy is to pick one and use it everywhere, and the one almost everyone ' +
                'picks is `will`. The result is *I will meet Ravi at six* for a fixed ' +
                'arrangement and *I will go to Hyderabad next month* for a booked trip. ' +
                'Neither is ungrammatical and neither is graded as a grammar error anywhere ' +
                'in this point: what they get wrong is how SETTLED the plan sounds, because ' +
                '`will` marks a decision taken at the moment of speaking. Filed under the ' +
                'register row (T-G9) rather than a grammar row for that reason — ' +
                'REQUIREMENTS.md §3.2 has no row for the single-future transfer, and the ' +
                'sentences it produces are correct English.',
            bridge: 'You already know the three states; Telugu just never made you mark ' +
                'them on the verb. Before you speak, ask which one you are in: have I only ' +
                'this second decided (`will`), did I decide a while ago (`going to`), or is ' +
                'it fixed with somebody else who is expecting me (*am* + *-ing*)? That is ' +
                'not a grammar question and it needs no rule — you know the answer about ' +
                'your own plan before you open your mouth. English simply asks you to say ' +
                'it out loud.'
        }
    },

    review: {
        rulePrompt: 'What question does English ask to choose a future form — and it is not ' +
            '"is this a prediction or a plan"? Say what each of `will`, `going to` and the ' +
            'present continuous tells a listener about WHEN the decision was made.',
        itemIds: ['future-forms-p1', 'future-forms-p2', 'future-forms-p3',
                  'future-forms-p4', 'future-forms-p5', 'future-forms-p6']
    },

    tags: ['future', 'will', 'going-to', 'present-continuous', 'shall', 'timetables',
           'arrangements', 'register', 'T-G9', 'high-frequency']
};

// Self-registration, exactly as data/grammar/modals.js and present-perfect.js do
// it. `grammarLessons` in data/grammar.js is a top-level `const`, i.e. a lexical
// global, so a classic script loaded AFTER it can read the binding by bare name
// and push into the tier array. It is NOT a property of `window`, so never write
// `window.grammarLessons`.
//
// ⚠️ TIER — this point registers into `grammarLessons.everyday`, NOT
// `foundation`. `everyday` is pre-created and empty in data/grammar.js, so the
// Array.isArray guard passes on a clean build. Copying this block into a
// foundation point means changing BOTH tier names below.
//
// The guards cover the two things that can actually go wrong: a script-order
// mistake (grammar.js absent) leaves the point unregistered instead of throwing
// during page load, and an id already present is not pushed twice.
if (typeof grammarLessons !== 'undefined' &&
    grammarLessons && Array.isArray(grammarLessons.everyday) &&
    !grammarLessons.everyday.some(function (p) { return p && p.id === GRAMMAR_FUTURE_FORMS.id; })) {
    grammarLessons.everyday.push(GRAMMAR_FUTURE_FORMS);
}
