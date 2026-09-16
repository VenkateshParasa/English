/**
 * Pronunciation — the schwa, sentence stress, connected speech, intonation
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `PRONUNCIATION_CONNECTED_SPEECH`.
 *
 * ⚠️ A top-level `const` in a classic script is a *lexical* global, not a
 * property of `window`. Guard access with bare
 * `typeof PRONUNCIATION_CONNECTED_SPEECH !== 'undefined'`, never
 * `window.PRONUNCIATION_CONNECTED_SPEECH` (which is always undefined). Same
 * rule as data/pronunciation/vowels-stress.js and consonants.js.
 *
 * -----------------------------------------------------------------------------
 * WHAT THIS FILE IS FOR
 * -----------------------------------------------------------------------------
 * `US-409` is "schwa, sentence stress, linking and intonation taught by
 * noticing" (FR-PRN-8). `vowels-stress.js` shipped the first half — fifteen
 * items covering rhythm (T-P1), final-vowel epenthesis (T-P2) and cluster
 * breaking (T-P3). The second half had no content at all. This file is it:
 * CURRICULUM.md §3 Strand C parts **4** (the schwa), **5** (sentence stress),
 * **6** (connected speech) and **7** (intonation).
 *
 *   noticing  — 15 items in four blocks: schwa (4), sentence stress (4),
 *               connected speech (4), intonation (3).
 *
 * There is no `pairs[]` and no `stress[]` here. Segments are the other two
 * files' job; this one is entirely prosody and word-boundary phonology.
 *
 * -----------------------------------------------------------------------------
 * WHY THIS MATTERS MORE THAN THE SEGMENTS — REQUIREMENTS.md §3.1
 * -----------------------------------------------------------------------------
 * Telugu is syllable/mora-timed; English is stress-timed. §3.1 rates that row
 * (T-P1) **Highest** intelligibility impact — above /v/~/w/, above /θ/, above
 * every individual phoneme in the table — because a listener uses the strong
 * beats to find the word boundaries, and the schwa is where the weak syllables
 * go to disappear.
 *
 * So the framing throughout is: a learner who gives every syllable equal weight
 * is perfectly intelligible word by word and hard to follow in a sentence.
 * That is not an accent problem and it is never described as one. CURRICULUM.md
 * §3 excludes retroflex /t/, /d/ from scope on the explicit grounds that
 * "chasing accent trades effort for shame and buys no comprehension"; the same
 * posture holds here. Nothing in this file asks anyone to sound native.
 *
 * -----------------------------------------------------------------------------
 * FR-PRN-8 — NOTICING, AND WHY THE RULE IS HONESTY RATHER THAN FASHION
 * -----------------------------------------------------------------------------
 * TTS models prosody badly. An imitation task built on a synthetic voice has
 * the learner copying the wrong thing, and the app cannot tell them so. Hence,
 * on every item in this file:
 *
 *   requiresImitation false — INVARIANT. No "listen and repeat" item exists here
 *                     and none may be added. app.js checks the flag at RENDER
 *                     time and refuses to draw a control for an item that says
 *                     true, so a `true` produces a visible refusal, not a task.
 *   requiresAudio     false — INVARIANT. The answer never depends on a clip.
 *   answerableFrom    'text' on all 15. Never 'audio'.
 *   audioOptional     true only where a clip could genuinely help and could not
 *                     mislead. It is `false` on 12 of the 15, and the reason is
 *                     stated per item rather than assumed: a clip that models a
 *                     reduction the voice did not actually perform teaches the
 *                     learner the opposite of the item.
 *
 * -----------------------------------------------------------------------------
 * INTONATION IS THE HARDEST CASE, AND THIS IS THE HONEST ANSWER
 * -----------------------------------------------------------------------------
 * An item asking "does this rise or fall?" about a synthesised clip may be
 * asking about a defect: TTS flattens or mis-assigns terminal contours often
 * enough that the learner's correct answer and the voice's behaviour can
 * disagree. The app would then mark a right answer wrong, and would be
 * unable to say why.
 *
 * So all three intonation items are built on **text and punctuation**, which
 * signal the contour reliably, and all three carry `audioOptional: false` —
 * a truthful declaration that no clip belongs on them, not an oversight.
 * The rule the learner applies is written, determinate and checkable: full stop
 * falls; wh-question falls; yes/no question rises.
 *
 * ⚠️ WHAT IS DELIBERATELY MISSING. CURRICULUM.md §3 part 7 also names
 * **fall-rise for politeness and doubt**, and there is no item for it. Written
 * English does not mark it: "You could do" with a fall and the same words with a
 * fall-rise are the same sentence on paper, and the difference is exactly what
 * punctuation cannot carry. The only ways to ask about it are to play a clip
 * (which would be testing the voice) or to tell the learner the answer inside
 * the question. Three honest items beat four, one of which is a coin-flip
 * dressed as a rule. The same reasoning rules out an item on rising versus
 * falling tag questions ("You're coming, aren't you?"), where the written form
 * is genuinely ambiguous between "I expect you are" and "are you?".
 *
 * -----------------------------------------------------------------------------
 * GRADING — THE THREE SHAPES, AND NOTHING ELSE
 * -----------------------------------------------------------------------------
 * app.js `noticingGrading()` implements exactly three, and `pronNoticingItems()`
 * DROPS an item matching none of them with a console warning:
 *
 *   choice   `options[]` + numeric `correctIndex`      — 6 items here
 *   tokens   `tokens[]` + `correct[]` (indices)        — 3 items here
 *   rows     `items[]`, each with an `answer`          — 6 items here
 *
 * They are tested in that order, so an item graded as `rows` writes
 * `correctIndex: null` and `tokens: null` explicitly. Every item carries all
 * five grading fields with `null` where unused, so the key set is uniform
 * across the file — the same convention `vowels-stress.js` uses, and what keeps
 * SRS.auditProjection() free of phantom-field noise.
 *
 * For a `rows` item the renderer builds ONE shared answer space from the
 * distinct `items[].answer` values (app.js `noticingRowAnswers()`), so every
 * row here answers from a small closed set — 'strong'/'weak', 'beat'/'no beat',
 * 'dropped'/'kept', 'up'/'down', a schwa count, or one of three IPA symbols.
 * `options` is `null` on all six so the buttons are labelled with the answers
 * themselves; `noticingRowLabel()` only substitutes a prose label when exactly
 * one `options` entry contains the answer string, and depending on that match is
 * a silent way to mislabel a button. Every row also carries a `word` or `form`
 * field, because app.js reads the row's own label from one of
 * `word`/`form`/`intended`/`text` and falls back to "Item 3" when none exists.
 *
 * -----------------------------------------------------------------------------
 * SRS KEYS — FOUR NEW ONES
 * -----------------------------------------------------------------------------
 * `srsKey` is `'phon:' + target`, the convention `vowels-stress.js` documents
 * and app.js `pronBrowseRef()` verifies at runtime (`item.srsRef || item.target
 * || item.id`, warning on a mismatch). The four keys here are new:
 *
 *     phon:schwa            4 items   CURRICULUM §3 part 4
 *     phon:sentence-stress  4 items   CURRICULUM §3 part 5
 *     phon:connected-speech 4 items   CURRICULUM §3 part 6
 *     phon:intonation       3 items   CURRICULUM §3 part 7
 *
 * They join `phon:rhythm`, `phon:final-vowel`, `phon:cluster` and
 * `phon:word-stress`. Nothing in js/core/mistakes.js has a `drill.target`
 * pointing at any of the four, and that direction is the harmless one: a target
 * with no category aimed at it simply never gets routed to from the mistake
 * panel. A category whose target does not exist is the dangerous direction, and
 * this file creates none.
 *
 * -----------------------------------------------------------------------------
 * ⚠️ MISTAKE CATEGORIES — NOTHING INVENTED, AND TWO ITEMS LOG NOWHERE
 * -----------------------------------------------------------------------------
 * `Mistakes.record()` REJECTS an unregistered id, so a made-up
 * `mistakeCategory` does not go into the wrong bucket — the occurrence is lost
 * entirely. Every id used here is already in js/core/mistakes.js:
 *
 *   prn.rhythm       (T-P1) — the schwa and sentence-stress blocks, and the
 *                    assimilation item. T-P1's own text in REQUIREMENTS.md §3.1
 *                    says "every syllable gets equal weight **and the schwa is
 *                    over-pronounced**", so the schwa is not a stretch here; it
 *                    is the same row.
 *   prn.final-vowel  (T-P2) — the two linking items. The failure mode for
 *                    *an apple* is "an-u apple": a vowel propping up a final
 *                    consonant instead of letting it link forward. Same error,
 *                    at a word boundary.
 *   prn.cluster      (T-P3) — the elision item. *next day* → /neks deɪ/ is a
 *                    three-consonant join across a boundary, which is T-P3's
 *                    problem with a space in the middle of it.
 *
 * The three **intonation** items carry `mistakeCategory: null`, deliberately.
 * There is no pitch-direction row anywhere in §3.1 and no `prn.intonation`
 * category, and filing a rising-tune miss under `prn.rhythm` would put a pitch
 * error in the weight bucket and corrupt the FR-SRS-3 diagnosis for the sake of
 * logging something. `recordPronBrowseMistake()` returns early on a null
 * category, so those misses are simply not logged; the SRS schedule still moves,
 * because that runs off `srsKey`. See the wiring checklist below.
 *
 * -----------------------------------------------------------------------------
 * ⚠️ WIRING — NOT DONE HERE, AND THE FIRST ITEM IS THE ONE THAT HIDES BUGS
 * -----------------------------------------------------------------------------
 *   ☐ **app.js `pronContentList()` reads `PRONUNCIATION_VOWELS_STRESS` ONLY.**
 *     Until it also reads this global, every item in this file is invisible: the
 *     browsable section walks 15 items, not 30, and no warning is printed
 *     anywhere, because nothing has been dropped — nothing was ever loaded.
 *     This is the project's most-repeated defect and it needs a one-function
 *     change, not a content change.
 *   ☐ `<script src="data/pronunciation/connected-speech.js"></script>` in
 *     index.html, before app.js
 *   ☐ the same path in the service-worker.js precache list, or it breaks offline
 *   ☐ `PRON_GROUPS.noticing.label` is "Rhythm and syllables", which stops being
 *     true once this file is surfaced through it
 *   ☐ optional, and a real improvement rather than a fix: register
 *     `prn.schwa`, `prn.sentence-stress`, `prn.connected-speech` and
 *     `prn.intonation` in js/core/mistakes.js so these misses can be diagnosed
 *     in their own terms and the four new `phon:` keys become drill destinations
 * -----------------------------------------------------------------------------
 */

const PRONUNCIATION_CONNECTED_SPEECH = {

    schemaVersion: 1,

    /* =====================================================================
     * NOTICING — CURRICULUM.md §3 Strand C parts 4, 5, 6, 7
     *
     * INVARIANTS, matching vowels-stress.js and asserted by
     * tools/validate-content.js: `requiresImitation === false` and
     * `requiresAudio === false` on every item, `answerableFrom` never 'audio',
     * and every item gradable by one of the three shapes.
     * ===================================================================== */
    noticing: [

        /* ---------------- part 4  the schwa /ə/ -------------------------
         * The most common sound in English and the one a syllable-timed
         * speaker over-pronounces, because it is where an unstressed vowel
         * goes when English takes its colour away. Reading the spelling is
         * the mechanism: Telugu spelling is close to phonemic, English is
         * not, so a habit that works in one language misleads in the other.
         */
        {
            id: 'notice-schwa-only-one-real-vowel',
            code: 'T-P1',
            target: 'schwa',
            srsKey: 'phon:schwa',
            mistakeCategory: 'prn.rhythm',
            mode: 'pick-syllable',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'English keeps one vowel in a word at full strength — the stressed one — and drains the colour out of the rest. What is left is /ə/, the schwa: a short, flat, relaxed sound with no shape of its own. *Banana* is spelt with three "a"s and says only one of them.',
            prompt: 'In *banana*, which syllable has a vowel that is NOT /ə/?',
            text: 'banana  /bəˈnɑːnə/',
            options: [
                'the first — ba',
                'the second — na, the one with the stress mark',
                'the third — na',
                'none of them; all three are /ə/'
            ],
            correctIndex: 1,
            correct: null,
            tokens: null,
            items: null,
            answer: 'The second: /ˈnɑː/. The first and third syllables are both /nə/ — schwa.',
            why: 'Three identical letters, three different sounds, and the IPA is the only honest record of it. Give all three "a"s their full value and you produce three equal beats where English has one strong one and two almost-nothing ones — which is the T-P1 pattern in a single word.',
            feelCheck: 'Say /ə/ on its own: let your jaw hang slightly open and your tongue lie flat in the middle of your mouth, and make a short sound without moving anything. If your lips round or spread, you are still making a real vowel.',
            l1: 'Telugu vowels keep their quality wherever they fall, so an unstressed English vowel has nothing to reduce *to* unless the schwa is learned as a sound in its own right. That is why this item comes before the sentence-level ones.'
        },
        {
            id: 'notice-schwa-count-them',
            code: 'T-P1',
            target: 'schwa',
            srsKey: 'phon:schwa',
            mistakeCategory: 'prn.rhythm',
            mode: 'count-schwas',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'Once you can spot a schwa in the IPA you can count them, and the count is often higher than the spelling suggests. Every one of them is a syllable you are allowed to say almost nothing on.',
            prompt: 'How many /ə/ sounds does each word actually contain? Count the ə symbols.',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { word: 'about',        answer: 1, ipa: '/əˈbaʊt/',      note: 'The whole first syllable is one schwa — "uh-BOUT".' },
                { word: 'police',       answer: 1, ipa: '/pəˈliːs/',     note: 'Not "po-LICE". The "o" is a schwa, so the word is close to "pleece" with a breath in front.' },
                { word: 'problem',      answer: 1, ipa: '/ˈprɒbləm/',    note: 'The "e" is a schwa: PROB-lm.' },
                { word: 'banana',       answer: 2, ipa: '/bəˈnɑːnə/',     note: 'Three "a"s in the spelling, two of them schwas.' },
                { word: 'together',     answer: 2, ipa: '/təˈɡeðə/',      note: 'Both the first vowel and the -er are /ə/; only the middle syllable is a real vowel.' },
                { word: 'photographer', answer: 3, ipa: '/fəˈtɒɡrəfə/',  note: 'Three schwas and one strong vowel in a five-letter-syllable word.' },
                { word: 'comfortable',  answer: 1, ipa: '/ˈkʌmftəbl/',   note: 'One schwa, and the "-or-" is not pronounced at all — a syllable deleted rather than reduced.' },
                { word: 'suppose',      answer: 1, ipa: '/səˈpəʊz/' }
            ],
            answer: 'The order in the item is about, police, problem, banana, together, photographer, comfortable, suppose — so 1, 1, 1, 2, 2, 3, 1, 1.',
            why: 'These are the normal, careful, dictionary pronunciations, not fast or sloppy ones. Saying every written vowel at full value does not sound more correct; it sounds like a word your listener has to work to recognise.',
            feelCheck: null,
            l1: 'Pure text work: no ear needed and no model needed. A learner who can find the schwas on paper has the concept, and producing them is a later and much easier problem.'
        },
        {
            id: 'notice-schwa-odd-one-out',
            code: 'T-P1',
            target: 'schwa',
            srsKey: 'phon:schwa',
            mistakeCategory: 'prn.rhythm',
            mode: 'pick-odd-one-out',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'In a real sentence the schwa is everywhere, because almost every grammar word has a weak form built on it: *the* /ðə/, *a* /ə/, *was* /wəz/, *for* /fə/, *from* /frəm/, *and* /ənd/, *to* /tə/.',
            prompt: 'Every word in this sentence contains a schwa except one. Tap the odd word out.',
            text: 'The doctor was waiting for a teacher from Canada.',
            tokens: ['The', 'doctor', 'was', 'waiting', 'for', 'a', 'teacher', 'from', 'Canada.'],
            correct: [3],
            options: null,
            correctIndex: null,
            items: null,
            answer: '*waiting* — /ˈweɪtɪŋ/ has /eɪ/ and /ɪ/ and no schwa. The other eight all have one: /ðə/, /ˈdɒktə/, /wəz/, /fə/, /ə/, /ˈtiːtʃə/, /frəm/, /ˈkænədə/.',
            why: 'This is what "the most common sound in English" means in practice: eight words out of nine. If you replace all eight schwas with full vowels, nothing you said is wrong and every one of them costs your listener a beat they were expecting you to skip.',
            feelCheck: 'Read the sentence and let your mouth go completely lazy on the eight, keeping it awake only on DOC, WAIT, TEACH and CAN. The laziness is the skill.',
            l1: 'The eight are exactly the words a careful reader gives most attention to, because they are short and look easy. Reversing that instinct — small word, small effort — is the single most useful habit in this file.'
        },
        {
            id: 'notice-schwa-strong-and-weak-forms',
            code: 'T-P1',
            target: 'schwa',
            srsKey: 'phon:schwa',
            mistakeCategory: 'prn.rhythm',
            mode: 'sort',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'Most grammar words have two pronunciations: a strong form with a real vowel, and a weak form with a schwa. Which one you get is not random and not a matter of care — it is position. A word that ends the clause, or that is being contrasted, keeps its strong form; the same word doing its ordinary job in the middle of a clause reduces.',
            prompt: 'The capitalised word carries the beat. For each line, is the marked word in its strong form or its weak form?',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { form: 'What are you looking AT?',   answer: 'strong', note: 'Last word in the clause, so /æt/ with a full vowel.' },
                { form: 'I looked at the photo.',     answer: 'weak',   note: '/ət/ — ordinary job, mid-clause, schwa.' },
                { form: 'Where are you FROM?',        answer: 'strong', note: '/frɒm/.' },
                { form: 'She came from Delhi.',       answer: 'weak',   note: '/frəm/.' },
                { form: 'Yes, I CAN.',                answer: 'strong', note: '/kæn/ — nothing follows it, so it cannot reduce.' },
                { form: 'I can swim quite well.',     answer: 'weak',   note: '/kən/, and often barely that.' },
                { form: 'Who was it FOR?',            answer: 'strong', note: '/fɔː/.' },
                { form: 'It was for my sister.',      answer: 'weak',   note: '/fə/.' }
            ],
            answer: 'strong, weak, strong, weak, strong, weak, strong, weak — the same four words, alternating.',
            why: 'The pairs are the point: nothing about the word changed, only where it sat. So this is not a list to memorise, it is one rule with an obvious test — if the word ends the clause or carries the contrast, it keeps its vowel; otherwise it gives it up.',
            feelCheck: 'Say the two *from* lines back to back. The mouth movement on the strong one is visibly bigger, and that difference is the whole of what a listener uses to tell a question from a statement here.',
            l1: 'Reading aloud pulls a Telugu-L1 speaker towards the strong form everywhere, because the strong form is what the spelling shows and what a dictionary lists first. Recognising the weak forms while LISTENING is worth more than producing them, and it is trainable entirely from text.'
        },

        /* ---------------- part 5  sentence stress -----------------------
         * Content words take a beat, function words get out of the way.
         * The learner who stresses every word is not making a mistake in
         * any single word — every one of them is correct — and the line
         * still arrives as a list rather than a sentence. That is the
         * argument REQUIREMENTS.md §3.1 makes for rating T-P1 highest.
         */
        {
            id: 'notice-sentence-stress-content-words',
            code: 'T-P1',
            target: 'sentence-stress',
            srsKey: 'phon:sentence-stress',
            mistakeCategory: 'prn.rhythm',
            mode: 'pick-beat-words',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'A sentence is not a row of equal words. The words carrying the information — nouns, main verbs, adjectives, most adverbs, question words — take a beat. The grammar holding them together — articles, auxiliaries, pronouns, prepositions — does not, and shrinks into the gaps.',
            prompt: 'Tap the words that carry a beat.',
            text: "I've been to the shop.",
            tokens: ["I've", 'been', 'to', 'the', 'shop.'],
            correct: [1, 4],
            options: null,
            correctIndex: null,
            items: null,
            answer: "**been** and **shop** — I've BEEN to the SHOP.",
            why: 'Two beats out of five words. "I\'ve", "to" and "the" carry no news: you could text "been shop" and be understood, which is the test for whether a word takes a beat. Give all five equal weight and a listener gets five candidates for the important word instead of two.',
            feelCheck: 'Tap the table on BEEN and on SHOP and fit everything else between the taps. If the taps are not evenly spaced, the squashing has not happened yet.',
            l1: 'Telugu delivers all five at close to the same size, so this is the highest-impact habit in the app to change — and note that changing it requires no new sounds at all, only a decision about which words to hurry.'
        },
        {
            id: 'notice-sentence-stress-sounds-like-a-list',
            code: 'T-P1',
            target: 'sentence-stress',
            srsKey: 'phon:sentence-stress',
            mistakeCategory: 'prn.rhythm',
            mode: 'pick-written-form',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'Equal stress is not a neutral choice. In English, stressing a word marks it as important, so stressing everything marks everything as important — and a line where every item is important is a list, not a sentence.',
            prompt: 'Which written version matches what a native speaker says?',
            text: 'I have been to the shop.',
            options: [
                'I HAVE BEEN TO THE SHOP — six words, six beats, all the same size',
                "I've BEEN to the SHOP — two beats, and the three words between them squeezed almost flat",
                'i have been to the SHOP — only the last word said properly, the rest whispered',
                'I have been to the shop — no beats at all, one even stream'
            ],
            correctIndex: 1,
            correct: null,
            tokens: null,
            items: null,
            answer: "I've BEEN to the SHOP.",
            why: 'The first version is what careful, word-by-word reading produces, and it is the one this item exists to name: it sounds like someone reading out a shopping list — *have. been. to. the. shop.* — because six equal beats is exactly how English signals six separate items. The third version is the opposite error: unstressed does not mean whispered or mumbled, it means quick and flat, still clearly there.',
            feelCheck: null,
            l1: 'Worth saying plainly to the learner: the first version contains no wrong sounds. Every word in it is pronounced correctly. It is the pattern across the words that costs the listener, which is why no amount of work on individual sounds fixes it.'
        },
        {
            id: 'notice-sentence-stress-by-word-class',
            code: 'T-P1',
            target: 'sentence-stress',
            srsKey: 'phon:sentence-stress',
            mistakeCategory: 'prn.rhythm',
            mode: 'sort',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'You can decide this word by word before you say anything, because it follows word class. Content words — nouns, main verbs, adjectives, adverbs, question words, negatives, numbers — take beats. Function words — articles, auxiliaries, pronouns, prepositions, conjunctions — do not.',
            prompt: 'Sort these: does the word normally take a beat in a sentence, or not?',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { word: 'station',  answer: 'beat',    note: 'Noun.' },
                { word: 'the',      answer: 'no beat', note: 'Article. There is no sentence in English where a plain *the* takes the main beat.' },
                { word: 'bought',   answer: 'beat',    note: 'Main verb.' },
                { word: 'have',     answer: 'no beat', note: 'Auxiliary here — *I have bought it*. When *have* is the only verb (*I have two brothers*) it is a main verb and does take a beat.' },
                { word: 'quickly',  answer: 'beat',    note: 'Adverb.' },
                { word: 'of',       answer: 'no beat', note: 'Preposition, and one of the most reduced words in the language: /əv/, often just /ə/.' },
                { word: 'never',    answer: 'beat',    note: 'Negatives take beats, and this one surprises learners because it is short and looks like a grammar word.' },
                { word: 'them',     answer: 'no beat', note: 'Pronoun — /ðəm/, often /ðm/.' },
                { word: 'where',    answer: 'beat',    note: 'Question word.' },
                { word: 'could',    answer: 'no beat', note: 'Modal auxiliary — /kəd/.' }
            ],
            answer: 'beat: station, bought, quickly, never, where. No beat: the, have, of, them, could.',
            why: 'This is the rule in its usable form. It is not a list of ten words to remember; it is a question you can ask of any word — *is this carrying information, or holding the sentence together?* The two entries that look like exceptions, *never* and *have*, are the ones that make it a rule about the job rather than about the length.',
            feelCheck: null,
            l1: 'Sorting first, producing later, exactly as with the vowel-final words. A learner who can sort a word list correctly has the concept; the mouth catches up afterwards.'
        },
        {
            id: 'notice-sentence-stress-negatives-take-the-beat',
            code: 'T-P1',
            target: 'sentence-stress',
            srsKey: 'phon:sentence-stress',
            mistakeCategory: 'prn.rhythm',
            mode: 'pick-beat-word',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'The word-class rule has one clean override: a grammar word takes the beat when it is negative. *Not* is news. So an auxiliary that would normally vanish becomes the loudest thing in the sentence the moment it is contracted with *n\'t*.',
            prompt: "Which word carries the main beat in *I don't like it*?",
            text: "I don't like it.",
            options: [
                "*don't* — the negative takes the beat",
                '*like* — it is the main verb, so it takes the beat',
                '*it* — the last word always takes the beat',
                'none of them; all four words are too short to carry a beat'
            ],
            correctIndex: 0,
            correct: null,
            tokens: null,
            items: null,
            answer: "*don't*. I DON'T like it.",
            why: 'The content-word rule on its own predicts *like*, and it is wrong here, because the single most important fact in the sentence is that this is a negative. Compare *I DO like it*, where the beat lands on *do* for the same reason — the auxiliary is carrying the contrast. This is worth knowing in both directions: if you hear a beat on an auxiliary, the speaker is either denying something or insisting on it.',
            feelCheck: null,
            l1: 'A practical listening consequence. English contracts the negative into a syllable — /dəʊnt/, /kɑːnt/, /wəʊnt/ — and then puts the beat on it, so the beat is the most reliable clue that a sentence was negative at all. Missing it means hearing the opposite of what was said, which no individual sound can cost you.'
        },

        /* ---------------- part 6  connected speech ----------------------
         * Linking, elision, assimilation. CURRICULUM.md §3 part 6 gives the
         * reason this block exists: "learners who never practise this
         * understand written English but not spoken English". Every item is
         * therefore aimed at RECOGNITION first — what the join does to the
         * written words — and each one is a determinate operation on text.
         *
         * The three mistake categories are the precise ones rather than a
         * uniform one, because the failure modes really are different:
         * failing to link is T-P2 epenthesis at a word boundary, failing to
         * elide is T-P3 cluster breaking with a space in it, and failing to
         * assimilate is T-P1 full-value delivery.
         */
        {
            id: 'notice-linking-consonant-to-vowel',
            code: 'T-P2',
            target: 'connected-speech',
            srsKey: 'phon:connected-speech',
            mistakeCategory: 'prn.final-vowel',
            mode: 'pick-written-form',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'English does not leave a gap between words. When a word ending in a consonant sound is followed by a word beginning with a vowel sound, the consonant crosses over and starts the next word. The space on the page is not a space in the mouth.',
            prompt: 'Which written version matches *an apple* said at a normal speed?',
            text: 'an apple',
            options: [
                'an APPLE — a small stop between the two words, so each one is clear',
                'a-NAPPLE — the /n/ joins onto the vowel and starts the second word',
                'an-u apple — a short vowel after the /n/ before the next word begins',
                'AN apple — the first word strong, the second one quick'
            ],
            correctIndex: 1,
            correct: null,
            tokens: null,
            items: null,
            answer: 'a-NAPPLE — /əˈnæpl/, and there is no boundary you could point at in the sound.',
            why: 'This is why spoken English is hard to follow even when every word in it is known: the words you are listening for have been re-cut into different chunks. *Not at all* arrives as *no-ta-tall*. Nothing is being dropped or slurred — the consonants have simply changed which syllable they belong to.',
            feelCheck: 'Say *an apple* and then say *a napple*. If your mouth does the same thing both times, you have it. Any difference at all means you are inserting a stop the language does not have.',
            l1: 'The third option is the T-P2 error at a word boundary, and it is the one to watch: propping the final /n/ with a small vowel gives "an-u apple", three beats where English has two, and it blocks the link the listener was using to find the join. The fix is not a new sound; it is moving a consonant you already say.'
        },
        {
            id: 'notice-linking-where-it-happens',
            code: 'T-P2',
            target: 'connected-speech',
            srsKey: 'phon:connected-speech',
            mistakeCategory: 'prn.final-vowel',
            mode: 'pick-linking-points',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'You can find every linking point in a sentence on paper, with one question asked of each word in turn: does this word end in a consonant sound, and does the next word begin with a vowel sound? If both, they join.',
            prompt: 'Tap every word that links straight onto the word after it.',
            text: 'Put it in a box and open it.',
            tokens: ['Put', 'it', 'in', 'a', 'box', 'and', 'open', 'it.'],
            correct: [0, 1, 2, 4, 5, 6],
            options: null,
            correctIndex: null,
            items: null,
            answer: '**Put**, **it**, **in**, **box**, **and**, **open** — six of the eight. The whole thing runs as /ˈpʊtɪtɪnə ˈbɒksən ˈdəʊpənɪt/: note where the /d/ of *and* has ended up.',
            why: '*a* is not tapped because it ends in a vowel, and the last *it* is not tapped because nothing follows it. Everything else joins, which means the eight written words arrive as roughly two unbroken stretches of sound. A learner listening for eight separate words will not hear them, and that is a listening problem long before it is a speaking one.',
            feelCheck: 'Read it once with a tiny stop after each word, then once as two long runs. The second is faster and easier, which is the useful surprise: linking is less work, not more.',
            l1: 'Every one of the six links is also a place a Telugu-L1 speaker is likely to add a vowel instead, so the same six positions are both the opportunity and the risk. Marking them on paper is the whole exercise; nothing has to be produced to get value from it.'
        },
        {
            id: 'notice-elision-the-disappearing-t',
            code: 'T-P3',
            target: 'connected-speech',
            srsKey: 'phon:connected-speech',
            mistakeCategory: 'prn.cluster',
            mode: 'sort',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'English drops sounds as well as joining them. A /t/ or /d/ squeezed between two other consonants is normally not said at all — *next day* is /neks deɪ/. But give it a vowel to land on and it survives and links instead. The rule is about what comes next, and you can read that off the page.',
            prompt: 'In each pair of words, is the /t/ or /d/ at the join dropped, or kept?',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { form: 'next day',    answer: 'dropped', note: '/neks deɪ/ — the /t/ sits between /s/ and /d/ and goes.' },
                { form: 'last night',  answer: 'dropped', note: '/lɑːs naɪt/.' },
                { form: 'most people', answer: 'dropped', note: '/məʊs piːpl/.' },
                { form: 'first time',  answer: 'dropped', note: '/fɜːs taɪm/ — one /t/ where the spelling has two.' },
                { form: 'next April',  answer: 'kept',    note: '/neks-ˈteɪprəl/ — a vowel follows, so the /t/ survives and links forward onto it.' },
                { form: 'best of all', answer: 'kept',    note: '/bes-təv ɔːl/ — same reason.' },
                { form: 'sand castle', answer: 'dropped', note: '/sæn kɑːsl/ — /d/ behaves exactly like /t/ here. Note *castle* has a silent "t" in the spelling too, which is a different thing: that one is never pronounced at all.' },
                { form: 'send it',     answer: 'kept',    note: '/sen-dɪt/ — the /d/ has a vowel and links onto it.' }
            ],
            answer: 'dropped: next day, last night, most people, first time, sand castle. Kept: next April, best of all, send it.',
            why: 'Two things follow from this, and the second is the useful one. First, if you say the /t/ in *next day* you have not been more careful, you have added a sound a native speaker does not make. Second, and more important while listening: *nex day* is what you will hear, so a learner waiting for the /t/ before deciding they heard *next* will lose the word.',
            feelCheck: 'Say *next day* both ways. Keeping the /t/ forces a tiny pause between the words; dropping it lets them run. The pause is what a listener hears as strange, not the /t/ itself.',
            l1: 'This is the honest half of a message worth stating plainly. Native speakers simplify constantly — but they simplify by DROPPING a consonant, never by adding a vowel. So T-P3 is not "English forbids simplification"; it is that the two languages simplify in opposite directions, and one of the two directions is invisible to a listener.'
        },
        {
            id: 'notice-assimilation-two-words-one-new-sound',
            code: 'T-P1',
            target: 'connected-speech',
            srsKey: 'phon:connected-speech',
            mistakeCategory: 'prn.rhythm',
            mode: 'match-join-to-sound',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'Sometimes the two sounds at a join do not merely touch — they merge into a third sound that is in neither word. When /t/, /d/ or /s/ meets the /j/ at the start of *you*, *your* or *year*, the pair collapses: /t/+/j/ becomes /tʃ/, /d/+/j/ becomes /dʒ/, /s/+/j/ becomes /ʃ/.',
            prompt: 'Apply the rule. Which single sound does the join in each pair produce?',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { form: "don't you", answer: '/tʃ/', ipa: '/ˈdəʊntʃə/', note: 'The *ch* in *church*. "Doncha."' },
                { form: "won't you", answer: '/tʃ/', ipa: '/ˈwəʊntʃə/' },
                { form: 'would you', answer: '/dʒ/', ipa: '/ˈwʊdʒə/',   note: 'The *j* in *jam*. "Wouldja."' },
                { form: 'did you',   answer: '/dʒ/', ipa: '/ˈdɪdʒə/',   note: 'Which is why *did you eat?* can sound like *dijeet?*' },
                { form: 'miss you',  answer: '/ʃ/',  ipa: '/ˈmɪʃə/',    note: 'The *sh* in *ship*.' },
                { form: 'this year', answer: '/ʃ/',  ipa: '/ˈðɪʃɪə/' }
            ],
            answer: "don't you and won't you → /tʃ/; would you and did you → /dʒ/; miss you and this year → /ʃ/.",
            why: 'The reason to learn this is comprehension, not performance. *Doncha* and *wouldja* are not slang or careless speech — they are what the ordinary polite forms sound like at ordinary speed, and a learner who is listening for a clean /t/ followed by a clean /j/ will not find either. Recognising the merged sound is enough; producing it is optional, and nobody has ever been misunderstood for saying *don\'t you* in full.',
            feelCheck: null,
            l1: 'This is T-P1 at a word boundary: giving each word its full separate value is what stops the merge from happening. Note that the sounds involved — /tʃ/, /dʒ/, /ʃ/ — are all already available to a Telugu speaker, so nothing new has to be learned to say it. The only change is where the boundary falls.'
        },

        /* ---------------- part 7  intonation ----------------------------
         * THREE ITEMS, NOT FOUR OR FIVE, AND THE COUNT IS THE POINT.
         *
         * This is the block where FR-PRN-8's reason bites hardest. TTS gets
         * terminal contours wrong or flat often enough that an item asking
         * "does this clip rise or fall?" may be asking the learner to
         * describe a synthesis defect — and when they answer correctly and
         * the voice disagrees, the app has no way to tell them which of the
         * two was wrong. So every item below is built on **text and
         * punctuation**, which signal the contour reliably, and every one
         * carries `audioOptional: false` as a truthful statement that no
         * clip belongs on it. `mistakeCategory` is null on all three: see
         * the header — there is no pitch row in REQUIREMENTS.md §3.1 and no
         * `prn.intonation` category, and filing a tune error under
         * `prn.rhythm` would corrupt the diagnosis to log something.
         *
         * The two things CURRICULUM.md §3 part 7 names that are NOT here —
         * fall-rise for politeness and doubt, and the rising-versus-falling
         * tag question — are absent because writing does not distinguish
         * them. Both would have to be asked of audio, or answered inside
         * the question. Neither is honest, so neither was written.
         */
        {
            id: 'notice-intonation-punctuation-tells-you',
            code: null,
            target: 'intonation',
            srsKey: 'phon:intonation',
            mistakeCategory: null,
            mode: 'sort',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'English marks the end of a sentence with the direction of the voice, and the written form tells you which direction it is. Three rules cover almost everything: a statement or an instruction falls; a question starting with a question word — who, what, where, when, why, how — also falls; a question you could answer with yes or no rises.',
            prompt: 'For each line, does the voice go UP or DOWN at the end?',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { form: 'The train leaves at six.',        answer: 'down', note: 'A statement. Full stop, falling voice.' },
                { form: 'Where does the train leave from?', answer: 'down', note: 'A wh-question. It has a question mark and it still falls.' },
                { form: 'Does the train leave at six?',    answer: 'up',   note: 'Answerable with yes or no, so it rises.' },
                { form: 'What time is it?',                answer: 'down' },
                { form: "Is it six o'clock?",              answer: 'up' },
                { form: 'Close the door, please.',         answer: 'down', note: 'An instruction behaves like a statement. *Please* does not change the direction.' },
                { form: 'Have you finished?',              answer: 'up' },
                { form: 'Who finished first?',             answer: 'down' }
            ],
            answer: 'down, down, up, down, up, down, up, down. Every wh-question falls; only the yes/no questions rise.',
            why: 'The question mark is not the signal — five of these eight have one and three of those five fall. The signal is the grammar, which is on the page in front of you. That is what makes this answerable without hearing anything at all.',
            feelCheck: 'Say the last word of *What time is it?* and let your voice drop as if you were finishing a sentence. Then say the last word of *Is it six?* and let it climb. You can feel the difference in your throat without needing to hear whether it worked.',
            l1: 'Telugu marks yes/no questions with a particle — a bit of grammar you can see and count — where English uses only word order and the direction of the voice. So the tune is not decoration here; on a yes/no question it is carrying work that nothing else in the sentence is doing.'
        },
        {
            id: 'notice-intonation-same-words-two-marks',
            code: null,
            target: 'intonation',
            srsKey: 'phon:intonation',
            mistakeCategory: null,
            mode: 'pick-written-form',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'English can turn a statement into a question without moving a single word. The only change is the direction of the voice at the end — and in writing, the punctuation mark is how that direction is recorded.',
            prompt: 'The words are identical. Spoken, what is the only difference between these two lines?',
            text: '"You\'re coming."   /   "You\'re coming?"',
            options: [
                'The second one is louder',
                'The first one falls at the end and the second one rises',
                'The second one is slower',
                'There is no difference — the words are the same, so the meaning is the same'
            ],
            correctIndex: 1,
            correct: null,
            tokens: null,
            items: null,
            answer: 'The first falls; the second rises. Nothing else changes.',
            why: 'The rising version is a real question, and there is no auxiliary at the front and no question word to announce it. The tune is doing the entire job on its own — which is the strongest case in the language for treating intonation as grammar rather than as expression. It is also why the question mark is the right thing to build this item on: the mark and the rise are two records of the same fact.',
            feelCheck: null,
            l1: 'Useful in the listening direction above all. If you miss the rise, you hear a statement about yourself instead of a question you were expected to answer, and the silence that follows is confusing for both people. Nothing in the words would have warned you.'
        },
        {
            id: 'notice-intonation-wh-questions-fall',
            code: null,
            target: 'intonation',
            srsKey: 'phon:intonation',
            mistakeCategory: null,
            mode: 'pick-which-rises',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'The common assumption is that questions rise. Half of them do not. A question that begins with a question word has already announced itself, so its voice falls exactly like a statement; a yes/no question has no such announcement, so the rise is what marks it as a question at all.',
            prompt: 'Both of these are questions with question marks. Which one ends with the voice going UP?',
            text: 'A: "Where are you going?"   B: "Are you going out?"',
            options: [
                'A — "Where are you going?"',
                'B — "Are you going out?"',
                'Both, because both are questions',
                'Neither — English questions are marked by word order, not by the voice'
            ],
            correctIndex: 1,
            correct: null,
            tokens: null,
            items: null,
            answer: 'B. *Where are you going?* falls, like a statement.',
            why: '"Both, because both are questions" is the tempting answer and the wrong one, and it is worth being tempted by it once: it is the rule most learners are carrying, and it makes every wh-question sound tentative or surprised. A falling *Where are you going?* is the neutral, ordinary way to ask. The rise on B is not politeness or friendliness — it is the only thing distinguishing that sentence from a report.',
            feelCheck: null,
            l1: 'The practical cost of getting this backwards is tone rather than meaning. A rise on every wh-question reads to an English listener as doubt or challenge — *WHERE are you going?* — which is a long way from what was meant. Worth saying clearly to a learner: this is a pattern to swap, not a deficiency, and the pattern is fully learnable from the written form of the question.'
        }
    ]
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PRONUNCIATION_CONNECTED_SPEECH: PRONUNCIATION_CONNECTED_SPEECH };
}
