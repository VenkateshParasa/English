/**
 * Pronunciation — vowel contrasts, word stress, prosody noticing
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `PRONUNCIATION_VOWELS_STRESS`.
 *
 * ⚠️ A top-level `const` in a classic script is a *lexical* global, not a
 * property of `window`. Guard access with bare
 * `typeof PRONUNCIATION_VOWELS_STRESS !== 'undefined'`, never
 * `window.PRONUNCIATION_VOWELS_STRESS` (which is always undefined).
 *
 * Covers CURRICULUM.md §3 Strand C parts 3–6 and REQUIREMENTS.md §3.1 rows
 * T-P1, T-P2, T-P3, T-P4, T-P7, T-P8, T-P9, per FR-PRN-1…FR-PRN-9.
 *
 *   pairs     — vowel minimal-pair sets: T-P7 /iː/~/ɪ/, T-P8 /æ/~/e/,
 *               T-P9 /ɒ/~/əʊ/. Discrimination first (FR-PRN-1, FR-PRN-6).
 *   stress    — T-P4 word stress, including the shifting families
 *               CURRICULUM.md §3 part 3 names (PHOtograph / phoTOGrapher /
 *               photoGRAPHic) and the noun/verb stress pairs (FR-PRN-3).
 *   noticing  — T-P1 rhythm, T-P2 final-vowel epenthesis, T-P3 cluster
 *               breaking. **Noticing and discrimination only, never imitation**
 *               (FR-PRN-8).
 *
 * -----------------------------------------------------------------------------
 * REFERENCE ACCENT
 * -----------------------------------------------------------------------------
 * IPA is British (RP-style, Oxford/Cambridge learner-dictionary conventions),
 * matching the transcriptions already used in the docs (`/ˈkʌmftəbl/` at
 * REQUIREMENTS.md §3.1). Where a General-American realisation differs enough to
 * matter, it is carried in `ameNote` / `caveats` rather than silently ignored —
 * the app plays whatever voice the device has, which is usually `en-US`.
 *
 * -----------------------------------------------------------------------------
 * ⚠️ AS-3 IS STILL UNVERIFIED — read before wiring any audio
 * -----------------------------------------------------------------------------
 * REQUIREMENTS.md §8.2 `AS-3` ("browser TTS distinguishes minimal pairs audibly
 * on real devices") is recorded as **must be validated before authoring pair
 * sets**. Nobody has run that test on a real mid-range Android phone. This file
 * is therefore authored so that **no item depends on TTS being good**:
 *
 *   - every pair set carries `audio.ttsRisk` ('high' | 'medium' | 'low') with a
 *     stated reason, so the highest-risk sets can be shipped with bundled clips
 *     first and the low-risk ones can run on TTS in the meantime;
 *   - every pair set carries `audio.degradeTo`, naming what the drill becomes
 *     when audio is unavailable or untrustworthy;
 *   - every pair set carries `textOnlyFallback`, a gradable exercise that needs
 *     no audio at all and still teaches half the problem (*which* English words
 *     contain *which* vowel — for a Telugu-L1 learner that lexical knowledge is
 *     a real part of the difficulty, independent of the ear);
 *   - nothing in `noticing` requires audio, by design (FR-PRN-8).
 *
 * `audio.clipIds` are *proposed* filenames, not shipped assets. Nothing here
 * asserts a clip exists.
 *
 * -----------------------------------------------------------------------------
 * ARTICULATORY, NOT AUDITORY — PROGRESS.md §6.aa rule 2
 * -----------------------------------------------------------------------------
 * Every cue and every self-check in this file asks about something the learner
 * can **feel or see in a mirror** — jaw drop, corner-of-mouth spread, whether
 * the lips travel, whether anything comes out after the last consonant. None
 * asks "did it sound right?", because the learner who most needs the answer is
 * exactly the one whose ear cannot yet supply it (the perception blind spot).
 * `feelChecks` are for FR-PRN-4 self-comparison; they are never graded
 * (FR-PRN-5) and never gate anything (FR-SPK-9).
 *
 * -----------------------------------------------------------------------------
 * SCHEMA — `pairs[]`, one object per phoneme contrast
 * -----------------------------------------------------------------------------
 *   id                pair id. **Must equal the `drill.target` in
 *                     js/core/mistakes.js** ('iː-ɪ', 'æ-e', 'ɒ-əʊ'), because
 *                     the SRS key is 'phon:' + id (TEACHING_METHODOLOGY.md §3).
 *   code              REQUIREMENTS.md §3.1 row ('T-P7').
 *   priority          'M' | 'S' | 'W', copied from that same row. Drives
 *                     L1-first ordering.
 *   difficulty        how hard the *contrast* is for a Telugu-L1 learner:
 *                     'medium' | 'hard'. Display and ordering only.
 *   pair              the two symbols, [longer/tenser first] — same order as
 *                     `id`, so `id` is always derivable from it.
 *   label             one learner-facing line naming the *feelable* difference,
 *                     never the auditory one.
 *   phonemes          one entry per symbol (FR-PRN-9 — every symbol shown gets
 *                     a plain-English gloss):
 *                       symbol       '/iː/'
 *                       gloss        'the "ee" in sheep' — the FR-PRN-9 string
 *                       keyword      the single anchor word
 *                       articulation what the mouth does, in plain words
 *                       feel         what the learner can feel/see happening
 *   contrastFeature   the ONE feature the drill is training, named for the
 *                     wrong-answer message FR-PRN-1 requires.
 *   articulatoryCue   the load-bearing field (REQUIREMENTS.md §3.3: "load-
 *                     bearing, not decorative"). One or two sentences, all of
 *                     it checkable without hearing anything.
 *   mirrorCheck       what to look for in a mirror. Visual, not auditory.
 *   feelChecks        FR-PRN-4 self-comparison questions. Feelable only.
 *   lengthNote        honest note on how far length can be trusted as a cue.
 *   minimalPairs      [{ a, b, aIpa, bIpa, differsIn, note? }]
 *                     `a` is the `pair[0]` member, `b` the `pair[1]` member.
 *                     `differsIn` names the single segment that differs — the
 *                     invariant is that a and b differ in **exactly one
 *                     phoneme**, checked by the adversarial pass in
 *                     __tests__ (see `differsIn` on every row).
 *   examples          flat word list. Exists because `PROJECTORS.phon` declares
 *                     `examples` — see the projection note below.
 *   sentences         [{ text, note }] contexts where the contrast carries
 *                     meaning, for the disambiguation drill and for reading.
 *   audio             { ttsRisk, ttsRiskWhy, requiresBundledClip, clipIds,
 *                       ttsHint, degradeTo }
 *   textOnlyFallback  a gradable no-audio exercise (see AS-3 note above).
 *   discrimination    { mode, itemsFrom, wrongAnswer } — how FR-PRN-1 renders.
 *                     `wrongAnswer` is the feature-naming text FR-PRN-1
 *                     mandates on a miss.
 *   productionGate    FR-PRN-6: { requiresKey, minAccuracy, minAttempts }.
 *   caveats           accent dependencies and anything an author must not
 *                     quietly rely on.
 *
 * -----------------------------------------------------------------------------
 * SCHEMA — `stress[]`, one object per word (T-P4)
 * -----------------------------------------------------------------------------
 *   id                'stress-<word>' (+ '-noun'/'-verb' where stress is what
 *                     distinguishes the two).
 *   word, pos, ipa, ameNote
 *   syllables         spoken syllables, in order. Length must equal
 *                     `stressNumbers.length`.
 *   stressNumbers     canonical machine-readable marking, one number per
 *                     syllable: 1 = primary, 2 = secondary, 0 = unstressed.
 *                     (ARPAbet/CMUdict convention.) Exactly one 1 per word.
 *   stressIndex       0-based index of the primary stress. Denormalised from
 *                     `stressNumbers` so a renderer never has to scan, and so
 *                     tests can assert on it directly.
 *   display           learner-facing form, stressed syllable in CAPITALS
 *                     ('PHO-to-graph'). Display only — never parse this.
 *   reducedSyllables  indices whose vowel reduces to /ə/ or disappears. This is
 *                     the T-P1 half of a T-P4 word: English does not just move
 *                     the stress, it flattens everything else.
 *   family            groups the shifting sets ('photograph').
 *   familyRule        the transferable rule, one sentence.
 *   stressMinimalPair id of the other member when the two words differ ONLY in
 *                     stress (record noun/verb). Null otherwise.
 *   drill             { mode: 'choose-stress' | 'choose-syllable-count' |
 *                       'choose-form', prompt, options, correctIndex,
 *                       answerableFromText: true, whyWrong }
 *                     Answerable from text: the learner marks a syllable, not
 *                     an imitation. `options` are the syllables themselves, so
 *                     `correctIndex` === `stressIndex` for 'choose-stress'.
 *   srsKey            'phon:word-stress' for all of them — per
 *                     CONTENT_AUTHORING_GUIDE.md §9, phoneme/feature detail
 *                     rides in the key, and 'word-stress' is the existing
 *                     `drill.target` in js/core/mistakes.js. Per-word accuracy
 *                     is not an SRS key; it is the `drill` item id.
 *   mistakeCategory   'prn.word-stress'.
 *
 * -----------------------------------------------------------------------------
 * SCHEMA — `noticing[]`, one object per exercise (T-P1, T-P2, T-P3)
 * -----------------------------------------------------------------------------
 * FR-PRN-8: these are **text-and-discrimination** exercises. TTS is not
 * trusted to model rhythm, so an imitation task would have the learner copying
 * something wrong. Hence, on every item:
 *
 *   requiresImitation false — INVARIANT. There is no "listen and repeat" item
 *                     in this file and there must never be one added.
 *   requiresAudio     false — INVARIANT. Audio may *illustrate* an item
 *                     (`audioOptional`), but the answer never depends on it.
 *   answerableFrom    'text' | 'text-or-audio'. What the learner needs in
 *                     order to answer. Never 'audio'.
 *
 *   id, code, target  `target` matches the `drill.target` in
 *                     js/core/mistakes.js ('rhythm', 'final-vowel', 'cluster'),
 *                     so `srsKey` is 'phon:' + target.
 *   mode              'count-beats' | 'pick-beat-words' | 'pick-written-form' |
 *                     'count-sounds' | 'count-syllables' | 'sort' |
 *                     'pick-syllable-count'.
 *   teach             what the learner is being shown, 1–3 sentences.
 *   prompt            the question, as asked.
 *   text              the written material the question is about (may be null
 *                     for 'sort'/'count-syllables' items driven by `items`).
 *   items             for sort/per-word modes: [{ ... , answer }].
 *   options           the choices, when there is a fixed option list.
 *   correctIndex      index into `options`. Null when the item is graded from
 *                     `items` or `correct` instead.
 *   correct           for multi-select ('pick-beat-words'): array of indices
 *                     into `tokens`.
 *   tokens            the sentence split into selectable words, for
 *                     multi-select modes.
 *   answer            the plain-language answer shown afterwards.
 *   why               the reason, in the learner's terms. This is what makes it
 *                     noticing rather than trivia.
 *   feelCheck         optional, and never the graded part: one thing to feel in
 *                     your own mouth after answering (PROGRESS.md §6.aa r.2).
 *   l1                the Telugu pattern this item is aimed at.
 *   audioOptional     true when a clip would help but is not needed to answer.
 *
 * -----------------------------------------------------------------------------
 * ⚠️ SRS PROJECTION CONTRACT — CONTENT_AUTHORING_GUIDE.md §7
 * -----------------------------------------------------------------------------
 * `PROJECTORS.phon` in js/core/srs.js currently declares
 *
 *     phon: ['id', 'pair', 'label', 'examples', 'minimalPairs', 'difficulty']
 *
 * and the authoring guide (§9) says outright that this list is a **guess**,
 * written before any pronunciation content existed. The `pairs[]` schema above
 * deliberately uses all six of those names with those meanings, so a `phon:`
 * review card is not empty today. But four fields a review card actually needs
 * are **silently dropped**:
 *
 *     articulatoryCue   the one field FR-PRN-1 requires on a wrong answer
 *                       ("with the differing feature named") and FR-PRN-4
 *                       requires for self-comparison
 *     phonemes          the FR-PRN-9 plain-English glosses — without them the
 *                       review card shows bare IPA
 *     code              the T-P row, needed to link the mistake log
 *     contrastFeature   the short feature name for the miss message
 *
 * Whoever wires the pronunciation drill must extend `PROJECTORS.phon` to
 *
 *     phon: ['id', 'code', 'pair', 'label', 'phonemes', 'contrastFeature',
 *            'articulatoryCue', 'examples', 'minimalPairs', 'difficulty']
 *
 * in the same commit. Do not solve it by duplicating the cue text into `label`;
 * two copies of a sentence drift. `stress[]` and `noticing[]` have no projector
 * at all — they need one (`'phon:word-stress'`, `'phon:rhythm'`,
 * `'phon:final-vowel'`, `'phon:cluster'` are the keys they will schedule under).
 *
 * -----------------------------------------------------------------------------
 * WIRING CHECKLIST (CONTENT_AUTHORING_GUIDE.md §10 — none of it done here)
 * -----------------------------------------------------------------------------
 *   ☐ `<script src="data/pronunciation/vowels-stress.js"></script>` in
 *     index.html, **before app.js**
 *   ☐ the same path in the service-worker.js precache list, or it breaks offline
 *   ☐ `PROJECTORS.phon` extended as above
 *   ☐ AS-3 validated on a real mid-range Android device before any
 *     `audio.ttsRisk: 'high'` set is put in front of a learner
 * -----------------------------------------------------------------------------
 */

const PRONUNCIATION_VOWELS_STRESS = {

    schemaVersion: 1,

    /* =====================================================================
     * VOWEL MINIMAL PAIRS — T-P7, T-P8, T-P9
     * ===================================================================== */
    pairs: [

        /* ---------------------------------------------------------------
         * T-P7  /iː/ ~ /ɪ/   sheep / ship
         * The highest-risk set for TTS, and the one where the popular
         * "long vs short" framing is least reliable. See lengthNote.
         * --------------------------------------------------------------- */
        {
            id: 'iː-ɪ',
            code: 'T-P7',
            priority: 'M',
            difficulty: 'hard',
            pair: ['/iː/', '/ɪ/'],
            label: 'Wide smile and tense, versus relaxed and slightly open',

            srsType: 'phon',
            srsRef: 'iː-ɪ',
            srsKey: 'phon:iː-ɪ',
            mistakeCategory: 'prn.i-length',

            phonemes: [
                {
                    symbol: '/iː/',
                    gloss: '/iː/ — the "ee" in sheep',
                    keyword: 'sheep',
                    articulation: 'Tongue high and pushed forward, corners of the mouth pulled back, and the muscles round your mouth are working. It is a tense sound.',
                    feel: 'Pull the corners of your mouth back as if you are being photographed. Put a fingertip on each corner and you should feel them travel outwards and go firm.'
                },
                {
                    symbol: '/ɪ/',
                    gloss: '/ɪ/ — the "i" in ship',
                    keyword: 'ship',
                    articulation: 'Same general area, but everything is loose: tongue slightly lower and further back, lips neutral, jaw a touch more open. It is a relaxed sound.',
                    feel: 'Let your face go slack first, then say it. The corners of your mouth should not move at all. If they pull back, you have said /iː/.'
                }
            ],

            contrastFeature: 'lip spread and muscle tension (not only length)',
            articulatoryCue: 'For /iː/ pull the corners of your mouth back into a wide smile and hold everything tense; for /ɪ/ let your whole face go loose and do not move the corners at all. Check the corners with your fingertips: they travel for sheep and stay put for ship.',
            mirrorCheck: 'Say "sheep, ship, sheep, ship" into a mirror. Your mouth should visibly change shape twice. If the mirror shows one shape, you are saying one vowel.',
            feelChecks: [
                'Did the corners of your mouth pull back and go firm, or stay loose?',
                'Was your jaw a fraction more open on the short one?',
                'Could you feel tension round your lips, or was your face slack?'
            ],
            lengthNote: 'Length is real but do not lean on it. English shortens /iː/ a lot before /p/, /t/, /k/, /f/, /s/ — the "ee" in *seat* is much shorter than the one in *seed* — so a long *ship* and a clipped *sheep* can come out almost the same duration. **Spread and tension are the cue that always holds; length is the one that sometimes disappears.** This is also why this set is the least safe on TTS.',

            minimalPairs: [
                { a: 'sheep',  b: 'ship',  aIpa: '/ʃiːp/',  bIpa: '/ʃɪp/',  differsIn: 'iː/ɪ' },
                { a: 'feel',   b: 'fill',  aIpa: '/fiːl/',  bIpa: '/fɪl/',  differsIn: 'iː/ɪ' },
                { a: 'seat',   b: 'sit',   aIpa: '/siːt/',  bIpa: '/sɪt/',  differsIn: 'iː/ɪ' },
                { a: 'heat',   b: 'hit',   aIpa: '/hiːt/',  bIpa: '/hɪt/',  differsIn: 'iː/ɪ' },
                { a: 'leave',  b: 'live',  aIpa: '/liːv/',  bIpa: '/lɪv/',  differsIn: 'iː/ɪ',
                  note: '"Live" here is the verb, /lɪv/ ("I live in Hyderabad"). The adjective *live* — a live match — is /laɪv/ and is a different word; keep it out of the drill.' },
                { a: 'green',  b: 'grin',  aIpa: '/ɡriːn/', bIpa: '/ɡrɪn/', differsIn: 'iː/ɪ' },
                { a: 'cheap',  b: 'chip',  aIpa: '/tʃiːp/', bIpa: '/tʃɪp/', differsIn: 'iː/ɪ' },
                { a: 'reach',  b: 'rich',  aIpa: '/riːtʃ/', bIpa: '/rɪtʃ/', differsIn: 'iː/ɪ' },
                { a: 'seek',   b: 'sick',  aIpa: '/siːk/',  bIpa: '/sɪk/',  differsIn: 'iː/ɪ' }
            ],

            examples: ['sheep', 'ship', 'feel', 'fill', 'seat', 'sit', 'heat', 'hit',
                       'leave', 'live', 'green', 'grin', 'cheap', 'chip', 'reach', 'rich',
                       'seek', 'sick'],

            sentences: [
                { text: 'Is that a sheep or a ship?',
                  note: 'The classic. Both readings are grammatical, so only the vowel tells you which.' },
                { text: 'Please fill it — do not feel it.',
                  note: 'Two ordinary instructions that swap completely on one vowel.' },
                { text: 'He wants to leave, not to live here.',
                  note: 'Meaning flips: leaving versus staying.' },
                { text: 'Take a seat and sit down.',
                  note: 'Both vowels in one short line, which makes the shape change easy to watch in a mirror.' }
            ],

            audio: {
                ttsRisk: 'high',
                ttsRiskWhy: 'This contrast leans on vowel quality *and* duration, and TTS is unreliable on both. Neural voices generate duration from a predicted timing model rather than from a speaker, and in isolated single words they tend to even the two out; compact on-device voices on a budget Android are worse. The quality difference is a tongue-height/tenseness difference sitting in a narrow band of the spectrum, which small phone speakers and low-bitrate playback blur. Add English pre-fortis clipping (*sheep*, *seat*, *cheap* are already short because of the following /p/, /t/) and a synthesised *sheep* can genuinely land closer to *ship* than to itself. **Assume this set is unteachable on TTS until AS-3 says otherwise.**',
                requiresBundledClip: true,
                clipIds: ['iː-ɪ/sheep', 'iː-ɪ/ship', 'iː-ɪ/feel', 'iː-ɪ/fill', 'iː-ɪ/seat',
                          'iː-ɪ/sit', 'iː-ɪ/heat', 'iː-ɪ/hit', 'iː-ɪ/leave', 'iː-ɪ/live',
                          'iː-ɪ/green', 'iː-ɪ/grin', 'iː-ɪ/cheap', 'iː-ɪ/chip', 'iː-ɪ/reach',
                          'iː-ɪ/rich', 'iː-ɪ/seek', 'iː-ɪ/sick'],
                ttsHint: 'If a clip is missing and TTS must be used, prefer the pairs ending in a voiced consonant — *feel/fill*, *leave/live*, *green/grin* — where English keeps the length difference largest. Never use *seat/sit* or *cheap/chip* as a TTS item.',
                degradeTo: 'textOnlyFallback'
            },

            textOnlyFallback: {
                mode: 'sort-by-vowel',
                prompt: 'Which vowel does each word have — the /iː/ of *sheep* or the /ɪ/ of *ship*? Spelling will not always tell you, so go by words you already know.',
                items: [
                    { word: 'busy',    ipa: '/ˈbɪzi/',   answer: 'ɪ', hint: 'First vowel. The "u" spelling is a trap.' },
                    { word: 'women',   ipa: '/ˈwɪmɪn/',  answer: 'ɪ', hint: 'First vowel — and note *woman* is different again.' },
                    { word: 'key',     ipa: '/kiː/',     answer: 'iː' },
                    { word: 'been',    ipa: '/biːn/',    answer: 'iː', hint: 'Often weakened to /bɪn/ when unstressed; the strong form is /iː/.' },
                    { word: 'build',   ipa: '/bɪld/',    answer: 'ɪ' },
                    { word: 'police',  ipa: '/pəˈliːs/', answer: 'iː', hint: 'Second vowel, the stressed one.' },
                    { word: 'minute',  ipa: '/ˈmɪnɪt/',  answer: 'ɪ', hint: 'The noun, sixty seconds. Both vowels are /ɪ/.' },
                    { word: 'machine', ipa: '/məˈʃiːn/', answer: 'iː', hint: 'Second vowel. "-ine" here is /iːn/, not /aɪn/.' }
                ],
                why: 'Half of this problem is not hearing at all — it is not knowing which vowel a given English word takes. That half can be learned from text, with no audio and no working ear for the contrast, and it is worth learning first.'
            },

            discrimination: {
                mode: 'pick-which-word',
                itemsFrom: 'minimalPairs',
                wrongAnswer: 'Both words replay back to back and slowed. Name the feature, not the verdict: "*sheep* pulls the corners of the mouth back and holds them tense; *ship* leaves the face loose." Then offer the mirror check.'
            },

            productionGate: {
                requiresKey: 'phon:iː-ɪ',
                minAccuracy: 0.8,
                minAttempts: 10,
                why: 'FR-PRN-6. A learner who cannot yet hear this contrast cannot self-judge it, and this is the pair where the perception blind spot is widest.'
            },

            caveats: [
                'Do not teach this as "long e versus short i". It is a different vowel, not the same vowel held longer, and the length part is the part English throws away first.',
                'Unstressed /ɪ/ and /iː/ blur in real speech (*happy* is /ˈhæpi/ for some speakers and /ˈhæpiː/-ish for others). Keep every drill item stressed.',
                'Avoid the *beach/bitch*, *sheet/shit* and *peace/piss* pairs entirely. They are textbook-perfect minimal pairs and a humiliation risk for an adult learner practising out loud in a shared room.'
            ],
            tags: ['vowel', 'T-P7', 'iː-ɪ', 'length', 'tts-risk-high']
        },

        /* ---------------------------------------------------------------
         * T-P8  /æ/ ~ /e/   bad / bed
         * Pure jaw height. No length cue at all, which makes it the
         * cleanest of the three to teach articulatorily.
         * --------------------------------------------------------------- */
        {
            id: 'æ-e',
            code: 'T-P8',
            priority: 'S',
            difficulty: 'medium',
            pair: ['/æ/', '/e/'],
            label: 'Jaw dropped wide open, versus jaw only half open',

            srsType: 'phon',
            srsRef: 'æ-e',
            srsKey: 'phon:æ-e',
            mistakeCategory: 'prn.ae-e',

            phonemes: [
                {
                    symbol: '/æ/',
                    gloss: '/æ/ — the "a" in bad',
                    keyword: 'bad',
                    articulation: 'Jaw well down, mouth open wide and flat, tongue low and forward. It takes real effort — this is a big mouth position, not a small one.',
                    feel: 'Rest the back of your hand under your chin and say *bad*. Your jaw should push the hand down and hold it there.'
                },
                {
                    symbol: '/e/',
                    gloss: '/e/ — the "e" in bed',
                    keyword: 'bed',
                    articulation: 'Jaw only about halfway down, tongue higher than for /æ/ and the mouth much less open.',
                    feel: 'Same hand under the chin: for *bed* the jaw barely moves. Say *bed, bad, bed, bad* and you are feeling one thing only — how far the jaw travels.'
                }
            ],

            contrastFeature: 'how far the jaw drops',
            articulatoryCue: 'Put the back of your hand under your chin. /æ/ pushes your jaw down onto your hand; /e/ hardly moves it. It is one movement, and you can feel it with your eyes shut — there is no length difference here to confuse you.',
            mirrorCheck: 'In a mirror, *bad* should show you noticeably more of the inside of your mouth than *bed*. If the two look the same, they are the same.',
            feelChecks: [
                'Did your jaw push down onto your hand, or stay put?',
                'Was your mouth wide open, or only half open?',
                'Did your tongue stay low and flat for the wide one?'
            ],
            lengthNote: 'These two are close to the same length, so length tells you nothing. That is good news: jaw drop is the only thing to think about, and jaw drop is the one thing you can feel directly.',

            minimalPairs: [
                { a: 'bad',  b: 'bed',   aIpa: '/bæd/',  bIpa: '/bed/',  differsIn: 'æ/e' },
                { a: 'man',  b: 'men',   aIpa: '/mæn/',  bIpa: '/men/',  differsIn: 'æ/e',
                  note: 'Singular versus plural — the vowel is the only thing carrying it, which is why this one costs real comprehension.' },
                { a: 'sat',  b: 'set',   aIpa: '/sæt/',  bIpa: '/set/',  differsIn: 'æ/e' },
                { a: 'pan',  b: 'pen',   aIpa: '/pæn/',  bIpa: '/pen/',  differsIn: 'æ/e' },
                { a: 'bat',  b: 'bet',   aIpa: '/bæt/',  bIpa: '/bet/',  differsIn: 'æ/e' },
                { a: 'sad',  b: 'said',  aIpa: '/sæd/',  bIpa: '/sed/',  differsIn: 'æ/e',
                  note: 'Spelling looks unrelated but *said* is /sed/, so this is a true minimal pair. Useful precisely because the spelling gives no help.' },
                { a: 'land', b: 'lend',  aIpa: '/lænd/', bIpa: '/lend/', differsIn: 'æ/e' },
                { a: 'gas',  b: 'guess', aIpa: '/ɡæs/',  bIpa: '/ɡes/',  differsIn: 'æ/e',
                  note: 'The "u" in *guess* is silent — it is there to keep the g hard.' },
                { a: 'had',  b: 'head',  aIpa: '/hæd/',  bIpa: '/hed/',  differsIn: 'æ/e',
                  note: 'Use the strong form of *had*. In fast speech it weakens to /həd/ or /əd/, which is a different exercise (see the T-P1 noticing items).' }
            ],

            examples: ['bad', 'bed', 'man', 'men', 'sat', 'set', 'pan', 'pen', 'bat', 'bet',
                       'sad', 'said', 'land', 'lend', 'gas', 'guess', 'had', 'head'],

            sentences: [
                { text: 'The men sat on the mat; the man set it down.',
                  note: 'Four of the drill words in one line, and every one of them is doing real work.' },
                { text: 'Can you lend me some land?',
                  note: 'Absurd on purpose — the learner can hear that the sentence has gone wrong, which is the point.' },
                { text: 'That was a bad bed.',
                  note: 'Both vowels, same consonant frame. Best mirror item in the set.' },
                { text: 'I guess we are out of gas.',
                  note: 'Ordinary sentence, both vowels, no gimmick.' }
            ],

            audio: {
                ttsRisk: 'medium',
                ttsRiskWhy: 'Better prospects than T-P7: this is a jaw-height difference that shows up as a large, low-frequency formant gap, and it survives compression and small speakers reasonably well. Two real risks remain. First, voice-dependent /æ/ raising — several `en-US` voices already pronounce /æ/ high enough to sit close to /e/, especially before nasals, so a synthesised *man* can arrive almost as *men*. Second, some voices lengthen /æ/, which teaches an accidental length cue that is not the real difference. Test *man/men* specifically on the device voice: if that pair fails, drop it and keep the non-nasal pairs.',
                requiresBundledClip: false,
                clipIds: ['æ-e/bad', 'æ-e/bed', 'æ-e/man', 'æ-e/men', 'æ-e/sat', 'æ-e/set',
                          'æ-e/pan', 'æ-e/pen', 'æ-e/bat', 'æ-e/bet', 'æ-e/sad', 'æ-e/said',
                          'æ-e/land', 'æ-e/lend', 'æ-e/gas', 'æ-e/guess', 'æ-e/had', 'æ-e/head'],
                ttsHint: 'Prefer the pairs with no nasal after the vowel — *bad/bed*, *sat/set*, *bat/bet*, *sad/said*, *gas/guess*, *had/head* — because /æ/ raising before nasals is where TTS voices go wrong.',
                degradeTo: 'textOnlyFallback'
            },

            textOnlyFallback: {
                mode: 'sort-by-vowel',
                prompt: 'Jaw wide open (/æ/, like *bad*) or half open (/e/, like *bed*)? Spelling is not a reliable guide — sort by words you know.',
                items: [
                    { word: 'many',    ipa: '/ˈmeni/',    answer: 'e',  hint: 'Looks like *man*, sounds like *men*.' },
                    { word: 'any',     ipa: '/ˈeni/',     answer: 'e',  hint: 'Same trap as *many*.' },
                    { word: 'thank',   ipa: '/θæŋk/',     answer: 'æ' },
                    { word: 'friend',  ipa: '/frend/',    answer: 'e',  hint: '"ie" spelling, /e/ sound.' },
                    { word: 'answer',  ipa: '/ˈɑːnsə/',   answer: 'neither',
                      hint: 'Deliberate odd one out: in British English this is the long /ɑː/ of *father*, not /æ/ at all. In American English it is /ˈænsər/.' },
                    { word: 'again',   ipa: '/əˈɡen/',    answer: 'e',  hint: 'Second vowel. /əˈɡeɪn/ is also standard for many speakers.' },
                    { word: 'happy',   ipa: '/ˈhæpi/',    answer: 'æ' },
                    { word: 'ready',   ipa: '/ˈredi/',    answer: 'e' }
                ],
                why: '*Many* and *any* are two of the most frequent words in English and both use /e/ despite the "a" spelling. Knowing that costs nothing and needs no ear.'
            },

            discrimination: {
                mode: 'pick-which-word',
                itemsFrom: 'minimalPairs',
                wrongAnswer: 'Replay both slowed, back to back, and name the feature: "*bad* drops the jaw right down; *bed* only halfway." Then send them to the hand-under-the-chin check.'
            },

            productionGate: {
                requiresKey: 'phon:æ-e',
                minAccuracy: 0.8,
                minAttempts: 10,
                why: 'FR-PRN-6, applied uniformly. Discrimination before production for every pair.'
            },

            caveats: [
                'British reference. In much of northern England /æ/ and the *father* vowel pattern differently, and in American English *bad* is often longer and slightly diphthongal. The jaw-drop cue holds across all of them, which is another reason to teach the cue rather than the sound.',
                '*marry/merry* was rejected as a drill pair: it is minimal in RP but merged for most American speakers, so an `en-US` voice would produce two identical clips and the learner would be marked wrong for hearing correctly.',
                '*bag/beg* is a true pair but several American voices raise /æ/ before /ɡ/ far enough to spoil it. Left out of the drill list on purpose.'
            ],
            tags: ['vowel', 'T-P8', 'æ-e', 'jaw-height', 'tts-risk-medium']
        },

        /* ---------------------------------------------------------------
         * T-P9  /ɒ/ ~ /əʊ/   cot / coat
         * One position versus a glide. The safest of the three on TTS,
         * because the cue is movement over time rather than a static
         * spectral difference.
         * --------------------------------------------------------------- */
        {
            id: 'ɒ-əʊ',
            code: 'T-P9',
            priority: 'S',
            difficulty: 'medium',
            pair: ['/ɒ/', '/əʊ/'],
            label: 'Lips parked in one place, versus lips travelling forward into a round',

            srsType: 'phon',
            srsRef: 'ɒ-əʊ',
            srsKey: 'phon:ɒ-əʊ',
            mistakeCategory: 'prn.o-ou',

            phonemes: [
                {
                    symbol: '/ɒ/',
                    gloss: '/ɒ/ — the "o" in cot',
                    keyword: 'cot',
                    articulation: 'One position, held. Jaw fairly open, tongue low and back, lips slightly rounded and then completely still.',
                    feel: 'Say *cot* and keep a fingertip lightly on your lips. Nothing should move between the start of the vowel and the /t/.'
                },
                {
                    symbol: '/əʊ/',
                    gloss: '/əʊ/ — the "oa" in coat',
                    keyword: 'coat',
                    articulation: 'Two positions, glided together. It starts central and almost unrounded and finishes with the lips rounded and pushed forward. Your mouth is *moving* the whole way through it.',
                    feel: 'Fingertip on your lips again: for *coat* you should feel them close in and push forward while the vowel is still going. If they are still where they started, you have said /ɒ/.'
                }
            ],

            contrastFeature: 'whether the lips move during the vowel',
            articulatoryCue: 'Rest a fingertip on your lips. /ɒ/ is one parked position — nothing moves. /əʊ/ travels: your lips round and push forward before the word ends, so the finger gets pushed. One vowel is a photo, the other is a short film.',
            mirrorCheck: 'Watch your lips in a mirror and say *cot, coat*. *Coat* must end in a smaller, rounder, more forward lip shape than it began with. *Cot* must not change shape at all.',
            feelChecks: [
                'Did your lips move during the vowel, or stay in one place?',
                'Did they finish rounded and pushed forward?',
                'Did your jaw close a little towards the end of the long one?'
            ],
            lengthNote: '/əʊ/ is longer than /ɒ/, but only because a glide takes time to travel. Teach the movement and the length comes free; teach the length alone and the learner produces a long /ɒː/, which sounds like neither word.',

            minimalPairs: [
                { a: 'cot',   b: 'coat',  aIpa: '/kɒt/',   bIpa: '/kəʊt/',  differsIn: 'ɒ/əʊ' },
                { a: 'not',   b: 'note',  aIpa: '/nɒt/',   bIpa: '/nəʊt/',  differsIn: 'ɒ/əʊ' },
                { a: 'got',   b: 'goat',  aIpa: '/ɡɒt/',   bIpa: '/ɡəʊt/',  differsIn: 'ɒ/əʊ' },
                { a: 'cost',  b: 'coast', aIpa: '/kɒst/',  bIpa: '/kəʊst/', differsIn: 'ɒ/əʊ' },
                { a: 'sock',  b: 'soak',  aIpa: '/sɒk/',   bIpa: '/səʊk/',  differsIn: 'ɒ/əʊ' },
                { a: 'clock', b: 'cloak', aIpa: '/klɒk/',  bIpa: '/kləʊk/', differsIn: 'ɒ/əʊ' },
                { a: 'rob',   b: 'robe',  aIpa: '/rɒb/',   bIpa: '/rəʊb/',  differsIn: 'ɒ/əʊ' },
                { a: 'hop',   b: 'hope',  aIpa: '/hɒp/',   bIpa: '/həʊp/',  differsIn: 'ɒ/əʊ' },
                { a: 'cop',   b: 'cope',  aIpa: '/kɒp/',   bIpa: '/kəʊp/',  differsIn: 'ɒ/əʊ' }
            ],

            examples: ['cot', 'coat', 'not', 'note', 'got', 'goat', 'cost', 'coast', 'sock',
                       'soak', 'clock', 'cloak', 'rob', 'robe', 'hop', 'hope', 'cop', 'cope'],

            sentences: [
                { text: 'I did not write a note.',
                  note: 'Both vowels in a sentence anyone might actually say.' },
                { text: 'What did the coat cost on the coast?',
                  note: 'Three /əʊ/ words against one /ɒ/ — good for watching the lips repeat the same journey.' },
                { text: 'He got the goat.',
                  note: 'Shortest possible contrast, same consonant frame either side.' },
                { text: 'The clock was under the cloak.',
                  note: 'Both are ordinary objects, so neither reading can be ruled out by sense — the vowel has to do the work.' }
            ],

            audio: {
                ttsRisk: 'low',
                ttsRiskWhy: 'The safest of the three. The cue is a *change over time* — a formant trajectory — rather than a static difference or a duration, and movement is exactly what survives a small speaker, a low bitrate and an unreliable duration model. The one real caveat is accent, not fidelity: an `en-US` voice says /ɑ/ or /ɔ/ for /ɒ/ and /oʊ/ for /əʊ/, so the clips will not match the British IPA printed on screen even though the contrast itself stays perfectly audible. If AS-3 gets validated for exactly one set, this is the one it will pass on.',
                requiresBundledClip: false,
                clipIds: ['ɒ-əʊ/cot', 'ɒ-əʊ/coat', 'ɒ-əʊ/not', 'ɒ-əʊ/note', 'ɒ-əʊ/got',
                          'ɒ-əʊ/goat', 'ɒ-əʊ/cost', 'ɒ-əʊ/coast', 'ɒ-əʊ/sock', 'ɒ-əʊ/soak',
                          'ɒ-əʊ/clock', 'ɒ-əʊ/cloak', 'ɒ-əʊ/rob', 'ɒ-əʊ/robe', 'ɒ-əʊ/hop',
                          'ɒ-əʊ/hope', 'ɒ-əʊ/cop', 'ɒ-əʊ/cope'],
                ttsHint: 'Safe on TTS. If the device voice is `en-US`, show the American transcriptions from `caveats` beside the British ones rather than letting the learner see IPA that does not match what they just heard.',
                degradeTo: 'textOnlyFallback'
            },

            textOnlyFallback: {
                mode: 'sort-by-vowel',
                prompt: 'One parked position (/ɒ/, like *cot*) or lips travelling (/əʊ/, like *coat*)? Sort these, then check the spelling patterns underneath.',
                items: [
                    { word: 'both',     ipa: '/bəʊθ/',     answer: 'əʊ' },
                    { word: 'gone',     ipa: '/ɡɒn/',      answer: 'ɒ',  hint: 'Compare *bone* /bəʊn/ — same letters, different vowel.' },
                    { word: 'shoulder', ipa: '/ˈʃəʊldə/',  answer: 'əʊ', hint: '"ou" is /əʊ/ here, not /aʊ/.' },
                    { word: 'shop',     ipa: '/ʃɒp/',      answer: 'ɒ' },
                    { word: 'although', ipa: '/ɔːlˈðəʊ/',  answer: 'əʊ', hint: 'Second syllable, the stressed one.' },
                    { word: 'sorry',    ipa: '/ˈsɒri/',    answer: 'ɒ' },
                    { word: 'own',      ipa: '/əʊn/',      answer: 'əʊ' },
                    { word: 'follow',   ipa: '/ˈfɒləʊ/',   answer: 'both',
                      hint: 'One of each: /ɒ/ then /əʊ/. Two "o" letters, two different vowels, in one two-syllable word.' }
                ],
                why: 'The English spelling "o" covers both of these, so the learner cannot read their way to the answer. *follow* is the item that proves it.'
            },

            discrimination: {
                mode: 'pick-which-word',
                itemsFrom: 'minimalPairs',
                wrongAnswer: 'Replay both slowed, and name the feature: "in *coat* the lips travel and finish rounded; in *cot* they never move." Then the fingertip-on-the-lips check.'
            },

            productionGate: {
                requiresKey: 'phon:ɒ-əʊ',
                minAccuracy: 0.8,
                minAttempts: 10,
                why: 'FR-PRN-6, applied uniformly.'
            },

            caveats: [
                'American equivalents, for when the device voice is `en-US`: cot /kɑːt/, coat /koʊt/, not /nɑːt/, note /noʊt/, got /ɡɑːt/, goat /ɡoʊt/, cost /kɔːst/, coast /koʊst/. The contrast survives; the symbols do not.',
                'Telugu ఓ is a long single vowel with no glide, so the likely error is not a wrong vowel but a *still* one — /koːt/ for *coat*. Correcting that is a movement instruction, which is why the cue is about travel and not about length.',
                '*caught/coat* was rejected: /kɔːt/ versus /kəʊt/ differs in more than one way and is merged with *cot* for many American speakers.'
            ],
            tags: ['vowel', 'T-P9', 'ɒ-əʊ', 'diphthong', 'tts-risk-low']
        }
    ],

    /* =====================================================================
     * WORD STRESS — T-P4
     * ---------------------------------------------------------------------
     * Telugu stress is rule-governed and weight-predictable, so a Telugu-L1
     * learner reasonably expects English stress to fall out of the spelling.
     * It does not: it is a per-word fact, and it *moves* when the word changes
     * shape. REQUIREMENTS.md §3.1 rates this High impact, and CURRICULUM.md §3
     * part 3 puts it plainly — wrong stress breaks comprehension faster than a
     * wrong vowel, because a listener re-segments the whole word around the
     * beat they heard.
     *
     * Machine-readable marking on every item: `stressNumbers` (1 primary,
     * 2 secondary, 0 unstressed — one per syllable) with `stressIndex`
     * denormalised from it. `display` is for humans only; never parse it.
     *
     * Every drill is a *marking* task, answerable from text: tap the syllable
     * that carries the beat, or pick the syllable count. No item asks the
     * learner to imitate a model, so nothing here depends on TTS getting the
     * prosody right (FR-PRN-8 applies to the drills even though FR-PRN-3 also
     * wants the stress audible where a clip exists).
     * ===================================================================== */
    stress: [

        /* -- Family 1: the -graph / -grapher / -graphic shift ------------
         * The set CURRICULUM.md §3 part 3 names by hand. Same root, three
         * different beats, and the vowels change with them. Teach it as one
         * object, not three unrelated words.
         */
        {
            id: 'stress-photograph',
            code: 'T-P4',
            word: 'photograph',
            pos: 'noun',
            ipa: '/ˈfəʊtəɡrɑːf/',
            ameNote: 'AmE /ˈfoʊtəɡræf/ — same stress, different vowels.',
            syllables: ['pho', 'to', 'graph'],
            stressNumbers: [1, 0, 0],
            stressIndex: 0,
            display: 'PHO-to-graph',
            reducedSyllables: [1],
            reductionNote: 'The middle syllable is just /tə/. It is not "to".',
            family: 'photograph',
            familyRule: 'The plain noun keeps the beat on the first syllable.',
            stressMinimalPair: null,
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *photograph*?',
                options: ['pho', 'to', 'graph'],
                correctIndex: 0,
                answerableFromText: true,
                whyWrong: 'The beat is on the first syllable: PHO-to-graph. The other two are squashed — the middle one is barely there at all.'
            },
            tags: ['T-P4', 'stress-shift', 'photograph-family']
        },
        {
            id: 'stress-photographer',
            code: 'T-P4',
            word: 'photographer',
            pos: 'noun',
            ipa: '/fəˈtɒɡrəfə/',
            ameNote: 'AmE /fəˈtɑːɡrəfər/.',
            syllables: ['pho', 'tog', 'ra', 'pher'],
            stressNumbers: [0, 1, 0, 0],
            stressIndex: 1,
            display: 'pho-TOG-ra-pher',
            reducedSyllables: [0, 2, 3],
            reductionNote: 'Three of the four syllables are /ə/. Only the second one has a full vowel — the word is really "fuh-TOG-ruh-fuh".',
            family: 'photograph',
            familyRule: 'Adding -er/-y pulls the beat onto the second syllable, and the first vowel collapses to /ə/ as it goes.',
            stressMinimalPair: null,
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *photographer*?',
                options: ['pho', 'tog', 'ra', 'pher'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'The beat moved: pho-TOG-ra-pher. The first syllable is now just /fə/ — nothing like the PHO of *photograph*. This is the pair REQUIREMENTS.md §3.1 names for T-P4.'
            },
            tags: ['T-P4', 'stress-shift', 'photograph-family']
        },
        {
            id: 'stress-photographic',
            code: 'T-P4',
            word: 'photographic',
            pos: 'adjective',
            ipa: '/ˌfəʊtəˈɡræfɪk/',
            ameNote: 'AmE the same, /ˌfoʊtəˈɡræfɪk/.',
            syllables: ['pho', 'to', 'graph', 'ic'],
            stressNumbers: [2, 0, 1, 0],
            stressIndex: 2,
            display: 'pho-to-GRAPH-ic',
            reducedSyllables: [1],
            reductionNote: 'The first syllable keeps a real vowel but only a secondary beat (the /ˌ/ mark); the second is /tə/.',
            family: 'photograph',
            familyRule: 'The -ic ending puts the primary beat on the syllable immediately before it. This one is a rule you can trust: atom → aTOMic, econOMic, dramATic.',
            stressMinimalPair: null,
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *photographic*?',
                options: ['pho', 'to', 'graph', 'ic'],
                correctIndex: 2,
                answerableFromText: true,
                whyWrong: 'Words ending in -ic put the beat on the syllable just before the ending: pho-to-GRAPH-ic. Never on the -ic itself.'
            },
            tags: ['T-P4', 'stress-shift', 'photograph-family', 'suffix-ic']
        },
        {
            id: 'stress-photography',
            code: 'T-P4',
            word: 'photography',
            pos: 'noun',
            ipa: '/fəˈtɒɡrəfi/',
            ameNote: 'AmE /fəˈtɑːɡrəfi/.',
            syllables: ['pho', 'tog', 'ra', 'phy'],
            stressNumbers: [0, 1, 0, 0],
            stressIndex: 1,
            display: 'pho-TOG-ra-phy',
            reducedSyllables: [0, 2],
            reductionNote: 'Same shape as *photographer* — /fə/ then the beat.',
            family: 'photograph',
            familyRule: 'The -y noun behaves like the -er noun: beat on the second syllable.',
            stressMinimalPair: null,
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *photography*?',
                options: ['pho', 'tog', 'ra', 'phy'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'pho-TOG-ra-phy — the same beat as *photographer*, and not the same as *photograph*. One root, three different beats: that is the whole lesson.'
            },
            tags: ['T-P4', 'stress-shift', 'photograph-family']
        },

        /* -- Family 2: -ic and -ity, two suffixes that move the beat ----- */
        {
            id: 'stress-economy',
            code: 'T-P4',
            word: 'economy',
            pos: 'noun',
            ipa: '/ɪˈkɒnəmi/',
            ameNote: 'AmE /ɪˈkɑːnəmi/.',
            syllables: ['e', 'co', 'no', 'my'],
            stressNumbers: [0, 1, 0, 0],
            stressIndex: 1,
            display: 'e-CO-no-my',
            reducedSyllables: [2, 3],
            reductionNote: 'The third syllable is /nə/, not "no".',
            family: 'economic',
            familyRule: 'Base noun: beat on the second syllable.',
            stressMinimalPair: null,
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *economy*?',
                options: ['e', 'co', 'no', 'my'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'e-CO-no-my. Now compare it with *economic* in the next item and watch the beat move.'
            },
            tags: ['T-P4', 'stress-shift', 'economic-family']
        },
        {
            id: 'stress-economic',
            code: 'T-P4',
            word: 'economic',
            pos: 'adjective',
            ipa: '/ˌiːkəˈnɒmɪk/',
            ameNote: 'Both /ˌiːkə-/ and /ˌekə-/ are standard for the first syllable, in Britain and America alike. The stress does not vary.',
            syllables: ['e', 'co', 'no', 'mic'],
            stressNumbers: [2, 0, 1, 0],
            stressIndex: 2,
            display: 'e-co-NO-mic',
            reducedSyllables: [1],
            reductionNote: 'Second syllable is /kə/.',
            family: 'economic',
            familyRule: 'Same -ic rule as *photographic*: primary beat on the syllable before -ic.',
            stressMinimalPair: null,
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *economic*?',
                options: ['e', 'co', 'no', 'mic'],
                correctIndex: 2,
                answerableFromText: true,
                whyWrong: 'e-co-NO-mic — the beat has moved one syllable to the right compared with *economy*, because -ic pulls it there.'
            },
            tags: ['T-P4', 'stress-shift', 'economic-family', 'suffix-ic']
        },
        {
            id: 'stress-electric',
            code: 'T-P4',
            word: 'electric',
            pos: 'adjective',
            ipa: '/ɪˈlektrɪk/',
            ameNote: 'AmE the same.',
            syllables: ['e', 'lec', 'tric'],
            stressNumbers: [0, 1, 0],
            stressIndex: 1,
            display: 'e-LEC-tric',
            reducedSyllables: [0],
            reductionNote: 'The first syllable is /ɪ/ and almost disappears.',
            family: 'electricity',
            familyRule: 'And here is the -ic rule again: beat immediately before the ending.',
            stressMinimalPair: null,
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *electric*?',
                options: ['e', 'lec', 'tric'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'e-LEC-tric. The -ic ending never takes the beat itself.'
            },
            tags: ['T-P4', 'suffix-ic', 'electricity-family']
        },
        {
            id: 'stress-electricity',
            code: 'T-P4',
            word: 'electricity',
            pos: 'noun',
            ipa: '/ˌɪlekˈtrɪsəti/',
            ameNote: 'AmE /ɪˌlekˈtrɪsəti/ — same beat.',
            syllables: ['e', 'lec', 'tri', 'ci', 'ty'],
            stressNumbers: [2, 0, 1, 0, 0],
            stressIndex: 2,
            display: 'e-lec-TRI-ci-ty',
            reducedSyllables: [3, 4],
            reductionNote: 'The last two syllables flatten to /səti/ — a very common shape, as in *university*, *possibility*, *quality*.',
            family: 'electricity',
            familyRule: '-ity works like -ic: the beat lands on the syllable just before the ending, however long the word gets.',
            stressMinimalPair: null,
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *electricity*?',
                options: ['e', 'lec', 'tri', 'ci', 'ty'],
                correctIndex: 2,
                answerableFromText: true,
                whyWrong: 'e-lec-TRI-ci-ty. Note that the /k/ of *electric* has become /s/ as well: the ending changes the sound before it, not just the beat.'
            },
            tags: ['T-P4', 'suffix-ity', 'electricity-family']
        },
        {
            id: 'stress-educate',
            code: 'T-P4',
            word: 'educate',
            pos: 'verb',
            ipa: '/ˈedʒukeɪt/',
            ameNote: 'AmE the same.',
            syllables: ['e', 'du', 'cate'],
            stressNumbers: [1, 0, 2],
            stressIndex: 0,
            display: 'E-du-cate',
            reducedSyllables: [1],
            reductionNote: 'The middle syllable is /dʒu/ and unstressed; the last keeps a full /eɪ/ but no primary beat.',
            family: 'education',
            familyRule: 'Base verb: beat on the first syllable.',
            stressMinimalPair: null,
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *educate*?',
                options: ['e', 'du', 'cate'],
                correctIndex: 0,
                answerableFromText: true,
                whyWrong: 'E-du-cate, beat on the first syllable — then compare *education*, where it moves.'
            },
            tags: ['T-P4', 'stress-shift', 'education-family']
        },
        {
            id: 'stress-education',
            code: 'T-P4',
            word: 'education',
            pos: 'noun',
            ipa: '/ˌedʒuˈkeɪʃn/',
            ameNote: 'AmE the same.',
            syllables: ['e', 'du', 'ca', 'tion'],
            stressNumbers: [2, 0, 1, 0],
            stressIndex: 2,
            display: 'e-du-CA-tion',
            reducedSyllables: [1, 3],
            reductionNote: 'The -tion ending is one syllable, /ʃn/, with hardly any vowel in it at all.',
            family: 'education',
            familyRule: '-tion / -sion always puts the beat on the syllable immediately before the ending. This is one of the most reliable stress rules in English: inforMAtion, deCIsion, pronunciAtion.',
            stressMinimalPair: null,
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *education*?',
                options: ['e', 'du', 'ca', 'tion'],
                correctIndex: 2,
                answerableFromText: true,
                whyWrong: 'e-du-CA-tion. The beat is always just before -tion, never on it and never back at the start.'
            },
            tags: ['T-P4', 'stress-shift', 'education-family', 'suffix-tion']
        },

        /* -- Family 3: same spelling, two words, stress is the only
         * difference. These are genuine *stress* minimal pairs: identical
         * letters, and only the beat (and the reduction that follows it)
         * tells a listener which word you meant. Paired via
         * `stressMinimalPair`.
         */
        {
            id: 'stress-record-noun',
            code: 'T-P4',
            word: 'record',
            pos: 'noun',
            ipa: '/ˈrekɔːd/',
            ameNote: 'AmE /ˈrekərd/.',
            syllables: ['re', 'cord'],
            stressNumbers: [1, 0],
            stressIndex: 0,
            display: 'RE-cord',
            reducedSyllables: [],
            reductionNote: 'First syllable /re/ takes the beat; the second keeps a full vowel but no beat.',
            family: 'noun-verb-pairs',
            familyRule: 'Two-syllable noun/verb twins: the noun takes the beat at the front, the verb takes it at the back. "I keep a RE-cord" versus "I re-CORD it".',
            stressMinimalPair: 'stress-record-verb',
            exampleSentence: 'She broke the world RE-cord.',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'In "She broke the world record", which syllable of *record* carries the beat?',
                options: ['re', 'cord'],
                correctIndex: 0,
                answerableFromText: true,
                whyWrong: 'Here *record* is a noun — a thing she broke — so the beat goes at the front: RE-cord. Put it at the back and you have said the verb, and the sentence stops making sense.'
            },
            tags: ['T-P4', 'noun-verb-stress', 'stress-minimal-pair']
        },
        {
            id: 'stress-record-verb',
            code: 'T-P4',
            word: 'record',
            pos: 'verb',
            ipa: '/rɪˈkɔːd/',
            ameNote: 'AmE /rɪˈkɔːrd/.',
            syllables: ['re', 'cord'],
            stressNumbers: [0, 1],
            stressIndex: 1,
            display: 're-CORD',
            reducedSyllables: [0],
            reductionNote: 'Losing the beat also changes the vowel: /re/ becomes /rɪ/. English does not just move the beat, it flattens whatever it leaves behind.',
            family: 'noun-verb-pairs',
            familyRule: 'Same rule from the other side: the verb takes the beat at the back.',
            stressMinimalPair: 'stress-record-noun',
            exampleSentence: 'Please re-CORD the meeting.',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'In "Please record the meeting", which syllable of *record* carries the beat?',
                options: ['re', 'cord'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'Here *record* is something you do, so the beat goes at the back: re-CORD. Identical letters, different word — and the beat is the only thing distinguishing them.'
            },
            tags: ['T-P4', 'noun-verb-stress', 'stress-minimal-pair']
        },
        {
            id: 'stress-present-noun',
            code: 'T-P4',
            word: 'present',
            pos: 'noun',
            ipa: '/ˈprezənt/',
            ameNote: 'AmE the same.',
            syllables: ['pre', 'sent'],
            stressNumbers: [1, 0],
            stressIndex: 0,
            display: 'PRE-sent',
            reducedSyllables: [1],
            reductionNote: 'Second syllable reduces to /zənt/.',
            family: 'noun-verb-pairs',
            familyRule: 'Noun (a gift, or now) at the front; verb (to hand over, to show) at the back.',
            stressMinimalPair: 'stress-present-verb',
            exampleSentence: 'Thank you for the PRE-sent.',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'In "Thank you for the present", which syllable carries the beat?',
                options: ['pre', 'sent'],
                correctIndex: 0,
                answerableFromText: true,
                whyWrong: 'A gift is a PRE-sent. To pre-SENT is to hand something over or give a talk.'
            },
            tags: ['T-P4', 'noun-verb-stress', 'stress-minimal-pair']
        },
        {
            id: 'stress-present-verb',
            code: 'T-P4',
            word: 'present',
            pos: 'verb',
            ipa: '/prɪˈzent/',
            ameNote: 'AmE the same.',
            syllables: ['pre', 'sent'],
            stressNumbers: [0, 1],
            stressIndex: 1,
            display: 'pre-SENT',
            reducedSyllables: [0],
            reductionNote: 'The unstressed first syllable becomes /prɪ/, and the /s/ turns into a /z/.',
            family: 'noun-verb-pairs',
            familyRule: 'Verb takes the beat at the back.',
            stressMinimalPair: 'stress-present-noun',
            exampleSentence: 'I will pre-SENT the report on Monday.',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'In "I will present the report", which syllable carries the beat?',
                options: ['pre', 'sent'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'It is a verb here, so pre-SENT. A PRE-sent is a gift, which would leave the sentence with no verb at all.'
            },
            tags: ['T-P4', 'noun-verb-stress', 'stress-minimal-pair']
        },
        {
            id: 'stress-increase-noun',
            code: 'T-P4',
            word: 'increase',
            pos: 'noun',
            ipa: '/ˈɪŋkriːs/',
            ameNote: 'AmE the same.',
            syllables: ['in', 'crease'],
            stressNumbers: [1, 0],
            stressIndex: 0,
            display: 'IN-crease',
            reducedSyllables: [],
            reductionNote: 'Both vowels stay full; only the beat differs from the verb.',
            family: 'noun-verb-pairs',
            familyRule: 'Same pattern. Useful at work: "a pay IN-crease" but "prices in-CREASE".',
            stressMinimalPair: 'stress-increase-verb',
            exampleSentence: 'We asked for a pay IN-crease.',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'In "We asked for a pay increase", which syllable carries the beat?',
                options: ['in', 'crease'],
                correctIndex: 0,
                answerableFromText: true,
                whyWrong: 'It is the thing you asked for, so it is a noun: IN-crease.'
            },
            tags: ['T-P4', 'noun-verb-stress', 'stress-minimal-pair', 'workplace']
        },
        {
            id: 'stress-increase-verb',
            code: 'T-P4',
            word: 'increase',
            pos: 'verb',
            ipa: '/ɪnˈkriːs/',
            ameNote: 'AmE the same.',
            syllables: ['in', 'crease'],
            stressNumbers: [0, 1],
            stressIndex: 1,
            display: 'in-CREASE',
            reducedSyllables: [0],
            reductionNote: 'The first syllable loses its beat and flattens towards /ɪn/.',
            family: 'noun-verb-pairs',
            familyRule: 'Verb at the back.',
            stressMinimalPair: 'stress-increase-noun',
            exampleSentence: 'Prices in-CREASE every year.',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'In "Prices increase every year", which syllable carries the beat?',
                options: ['in', 'crease'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'It is what prices *do*, so it is a verb: in-CREASE.'
            },
            tags: ['T-P4', 'noun-verb-stress', 'stress-minimal-pair']
        },

        /* -- Family 4: high-frequency words that are simply misstressed,
         * where the misstressing also blocks the T-P1 squashing. These are
         * the ones worth drilling because the learner says them daily.
         */
        {
            id: 'stress-comfortable',
            code: 'T-P4',
            word: 'comfortable',
            pos: 'adjective',
            ipa: '/ˈkʌmftəbl/',
            ameNote: 'AmE /ˈkʌmftərbl/ or /ˈkʌmfərtəbl/. Both keep the beat on the first syllable.',
            syllables: ['comf', 'ta', 'ble'],
            stressNumbers: [1, 0, 0],
            stressIndex: 0,
            display: 'COMF-ta-ble',
            reducedSyllables: [1, 2],
            reductionNote: 'The "-or-" of the spelling is **gone**, not reduced — four written syllables come out as three spoken ones. This is the word REQUIREMENTS.md §3.1 uses to define T-P1, so it is a stress item and a rhythm item at once.',
            family: 'frequent-misstressed',
            familyRule: 'No rule to lean on — this one is a per-word fact, which is exactly the point about English stress.',
            stressMinimalPair: null,
            exampleSentence: 'Are you COMF-table?',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-syllable-count',
                prompt: 'The spelling *com-for-ta-ble* shows four syllables. How many does a native speaker actually say?',
                options: ['2', '3', '4', '5'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'Three: COMF-ta-ble /ˈkʌmftəbl/. The "-or-" disappears completely. Saying all four even syllables is the single most recognisable Telugu-L1 rhythm error.'
            },
            tags: ['T-P4', 'T-P1', 'frequent', 'syllable-loss']
        },
        {
            id: 'stress-develop',
            code: 'T-P4',
            word: 'develop',
            pos: 'verb',
            ipa: '/dɪˈveləp/',
            ameNote: 'AmE the same.',
            syllables: ['de', 've', 'lop'],
            stressNumbers: [0, 1, 0],
            stressIndex: 1,
            display: 'de-VE-lop',
            reducedSyllables: [0, 2],
            reductionNote: 'First and last both reduce: /dɪ/ … /ləp/.',
            family: 'frequent-misstressed',
            familyRule: 'Commonly misstressed as DE-velop. The beat is in the middle, and it stays there in *development* and *developer*.',
            stressMinimalPair: null,
            exampleSentence: 'We need to de-VE-lop the idea.',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *develop*?',
                options: ['de', 've', 'lop'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'de-VE-lop — middle syllable. It stays in the middle for *development* and *developer* too, which is a rare piece of good luck.'
            },
            tags: ['T-P4', 'frequent', 'workplace']
        },
        {
            id: 'stress-available',
            code: 'T-P4',
            word: 'available',
            pos: 'adjective',
            ipa: '/əˈveɪləbl/',
            ameNote: 'AmE the same.',
            syllables: ['a', 'vai', 'la', 'ble'],
            stressNumbers: [0, 1, 0, 0],
            stressIndex: 1,
            display: 'a-VAI-la-ble',
            reducedSyllables: [0, 2, 3],
            reductionNote: 'Only the second syllable has a full vowel. The other three are /ə/ or next to nothing: "uh-VAY-luh-bl".',
            family: 'frequent-misstressed',
            familyRule: 'Four syllables, one beat, three squashed. A high-frequency work word and a good rhythm test.',
            stressMinimalPair: null,
            exampleSentence: 'Are you a-VAI-lable at four?',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *available*?',
                options: ['a', 'vai', 'la', 'ble'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'a-VAI-la-ble. One strong syllable out of four — if all four come out equally loud, the word takes twice as long as it should and a listener has to work to place it.'
            },
            tags: ['T-P4', 'frequent', 'workplace']
        },
        {
            id: 'stress-committee',
            code: 'T-P4',
            word: 'committee',
            pos: 'noun',
            ipa: '/kəˈmɪti/',
            ameNote: 'AmE /kəˈmɪti/.',
            syllables: ['com', 'mit', 'tee'],
            stressNumbers: [0, 1, 0],
            stressIndex: 1,
            display: 'com-MIT-tee',
            reducedSyllables: [0, 2],
            reductionNote: 'The double "ee" spelling pulls learners to the end, but the ending is unstressed /i/ and the beat is in the middle.',
            family: 'frequent-misstressed',
            familyRule: 'Spelling that looks like it should take the beat (a long vowel, a double letter) often does not. Check the word, do not trust the letters.',
            stressMinimalPair: null,
            exampleSentence: 'The com-MIT-tee meets on Friday.',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *committee*?',
                options: ['com', 'mit', 'tee'],
                correctIndex: 1,
                answerableFromText: true,
                whyWrong: 'com-MIT-tee. The "-tee" looks heavy but is unstressed — this is exactly where a weight-based rule from Telugu sends you to the wrong syllable.'
            },
            tags: ['T-P4', 'frequent', 'spelling-trap']
        },
        {
            id: 'stress-hospital',
            code: 'T-P4',
            word: 'hospital',
            pos: 'noun',
            ipa: '/ˈhɒspɪtl/',
            ameNote: 'AmE /ˈhɑːspɪtl/.',
            syllables: ['hos', 'pi', 'tal'],
            stressNumbers: [1, 0, 0],
            stressIndex: 0,
            display: 'HOS-pi-tal',
            reducedSyllables: [1, 2],
            reductionNote: 'The last syllable has no real vowel at all — /tl/, the tongue simply releases sideways.',
            family: 'frequent-misstressed',
            familyRule: 'Three syllables, beat at the front, the other two flattened. Same shape as *hospital*, *general*, *interest*, *national*.',
            stressMinimalPair: null,
            exampleSentence: 'She works at the HOS-pital.',
            srsType: 'phon',
            srsRef: 'word-stress',
            srsKey: 'phon:word-stress',
            mistakeCategory: 'prn.word-stress',
            drill: {
                mode: 'choose-stress',
                prompt: 'Which syllable carries the beat in *hospital*?',
                options: ['hos', 'pi', 'tal'],
                correctIndex: 0,
                answerableFromText: true,
                whyWrong: 'HOS-pi-tal, beat at the front. Watch the ending too: it is /tl/ with no vowel, not "tal".'
            },
            tags: ['T-P4', 'frequent']
        }
    ],

    /* =====================================================================
     * PROSODY NOTICING — T-P1 rhythm, T-P2 final-vowel epenthesis,
     *                    T-P3 cluster breaking
     * ---------------------------------------------------------------------
     * ⚠️ THE RULE FOR THIS WHOLE ARRAY, per FR-PRN-8:
     *
     *   **Noticing on text, plus discrimination. Never listen-and-repeat.**
     *
     * The reason is specific and it is not squeamishness. TTS models prosody
     * badly — timing comes out of a predicted duration model, not a speaker —
     * so an imitation task would have the learner faithfully copying the wrong
     * rhythm, and the app would have taught the error it exists to fix.
     * FR-PRN-8 therefore says outright that no claim is made that TTS models
     * these things correctly.
     *
     * So every item below is answered by *doing something to written text*:
     * counting syllables, counting sounds, marking which words carry the beat,
     * or choosing which of two written forms is what a native actually says.
     * Every one is objectively gradable and none needs a model to copy.
     * `feelCheck` exists on most items and is the one place the learner's own
     * mouth is involved — but it is a **feelable** check on their own body
     * (PROGRESS.md §6.aa rule 2), never a comparison against a clip, and it is
     * never the graded part of the item.
     *
     * INVARIANTS, asserted in tests: `requiresImitation === false` and
     * `requiresAudio === false` on every item, and `answerableFrom` is never
     * 'audio'.
     * ===================================================================== */
    noticing: [

        /* ---------------- T-P1  syllable-timed rhythm -------------------
         * REQUIREMENTS.md §3.1 rates this the **highest** intelligibility
         * impact of anything in the table — above every individual sound —
         * because a listener uses the strong beats to find word boundaries.
         * Six even syllables give them nothing to hold on to.
         */
        {
            id: 'notice-rhythm-beats',
            code: 'T-P1',
            target: 'rhythm',
            srsKey: 'phon:rhythm',
            mistakeCategory: 'prn.rhythm',
            mode: 'count-beats',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'An English sentence is built on a small number of strong beats, not on its syllables. The words that carry information — nouns, main verbs, adjectives, question words — get a beat. The grammar words between them get squashed into the gaps.',
            prompt: 'This sentence has six syllables. How many of them does a native speaker give a strong beat to?',
            text: "I'll see you on Friday.",
            options: ['2', '3', '4', '6'],
            correctIndex: 0,
            correct: null,
            tokens: null,
            items: null,
            answer: 'Two: **SEE** and **FRI**(day).',
            why: "\"I'll\", \"you\" and \"on\" are grammar words — they get out of the way. Six syllables, two beats, and the four in between are compressed into almost nothing. If you give all six equal weight, the sentence takes twice as long and your listener has to find the words for themselves.",
            feelCheck: 'Tap the table twice while you say it, once on SEE and once on FRI. Everything else has to fit between the taps — that squeezing is the sound of English rhythm.',
            l1: 'Telugu gives every syllable close to equal weight, so all six arrive with the same size. Nothing is wrong with any individual sound; the shape of the whole line is what makes it hard to follow.'
        },
        {
            id: 'notice-rhythm-which-words',
            code: 'T-P1',
            target: 'rhythm',
            srsKey: 'phon:rhythm',
            mistakeCategory: 'prn.rhythm',
            mode: 'pick-beat-words',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'You can work out the beats from the text before you ever say the sentence. Content words take them; grammar words do not.',
            prompt: 'Tap every word that carries a beat.',
            text: 'Can you give me a lift to the station?',
            tokens: ['Can', 'you', 'give', 'me', 'a', 'lift', 'to', 'the', 'station?'],
            correct: [2, 5, 8],
            options: null,
            correctIndex: null,
            items: null,
            answer: '**give**, **lift**, **station**.',
            why: 'Those three carry the message: if you texted just "give lift station" you would still be understood. "Can you", "me a", "to the" are structural — English shrinks them to almost nothing, and "to the" comes out closer to /tə ðə/ than to two full words.',
            feelCheck: 'Say it as three beats with mumble in between: da-da-GIVE-da-da-LIFT-da-da-STATION. Then say it properly. The mouth movement in the gaps should feel small and lazy, not careful.',
            l1: 'This is the item to run before any of the others. A learner who can mark the beats on paper has the concept; producing it is a later problem.'
        },
        {
            id: 'notice-rhythm-comfortable',
            code: 'T-P1',
            target: 'rhythm',
            srsKey: 'phon:rhythm',
            mistakeCategory: 'prn.rhythm',
            mode: 'pick-written-form',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'English does not only make unstressed syllables quieter. Sometimes it deletes them. *Comfortable* is spelt with four syllables and said with three.',
            prompt: 'Which written version matches what a native speaker actually says for *comfortable*?',
            text: 'comfortable',
            options: [
                'com-for-ta-ble — four syllables, all the same size',
                'COMF-ta-ble — three syllables, the first one strong',
                'com-for-TA-ble — four syllables, beat on the third',
                'com-FOR-table — three syllables, beat on the second'
            ],
            correctIndex: 1,
            correct: null,
            tokens: null,
            items: null,
            answer: 'COMF-ta-ble, /ˈkʌmftəbl/ — three syllables.',
            why: 'The "-or-" in the middle of the spelling is not pronounced at all. This is the exact word REQUIREMENTS.md §3.1 uses to define this error, because "com-for-ta-ble" in four even beats is the most recognisable Telugu-L1 rhythm pattern there is — and the fix is not a new sound, it is *leaving something out*.',
            feelCheck: 'Say COMF and then jump straight to the /t/. If your tongue makes an "r" or your lips round on the way, you are still saying the "-or-".',
            l1: 'Reading pronunciation off the spelling is the mechanism here. Telugu spelling is close to phonemic and English spelling is not, so the habit that works in one language actively misleads in the other.'
        },
        {
            id: 'notice-rhythm-spelling-vs-speech',
            code: 'T-P1',
            target: 'rhythm',
            srsKey: 'phon:rhythm',
            mistakeCategory: 'prn.rhythm',
            mode: 'count-syllables',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'A whole group of everyday English words lose a syllable in normal speech. The IPA is the honest record; the spelling is not.',
            prompt: 'For each word: how many syllables does the spelling suggest, and how many does a native speaker say? Give the spoken count.',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { word: 'chocolate',   spelt: 3, answer: 2, ipa: '/ˈtʃɒklət/',    note: 'CHOC-lat. The middle syllable goes completely.' },
                { word: 'vegetable',   spelt: 4, answer: 3, ipa: '/ˈvedʒtəbl/',   note: 'VEJ-ta-bl.' },
                { word: 'interesting', spelt: 4, answer: 3, ipa: '/ˈɪntrəstɪŋ/',  note: 'IN-tres-ting.' },
                { word: 'every',       spelt: 3, answer: 2, ipa: '/ˈevri/',       note: 'EV-ry.' },
                { word: 'different',   spelt: 3, answer: 2, ipa: '/ˈdɪfrənt/',    note: 'DIF-rent.' },
                { word: 'camera',      spelt: 3, answer: 2, ipa: '/ˈkæmrə/',      note: 'CAM-ra.' },
                { word: 'business',    spelt: 3, answer: 2, ipa: '/ˈbɪznəs/',     note: 'BIZ-ness. The middle "i" is not there at all.' },
                { word: 'Wednesday',   spelt: 3, answer: 2, ipa: '/ˈwenzdeɪ/',    note: 'WENZ-day.' }
            ],
            answer: '2, 3, 3, 2, 2, 2, 2, 2 — every one of them is shorter than it looks.',
            why: 'These are not sloppy or fast-speech forms; they are the normal, careful pronunciations, and they are what the dictionary gives. Saying every written syllable does not sound more correct, it sounds like a different word.',
            feelCheck: null,
            l1: 'This is the pure text half of T-P1 — no ear needed, no model needed, and it transfers immediately, because these are high-frequency words the learner already uses.'
        },
        {
            id: 'notice-rhythm-syllables-vs-beats',
            code: 'T-P1',
            target: 'rhythm',
            srsKey: 'phon:rhythm',
            mistakeCategory: 'prn.rhythm',
            mode: 'pick-written-form',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'In a syllable-timed language, the length of a line follows its syllable count. In English it follows its *beat* count. Two lines with the same number of syllables can take very different amounts of time.',
            prompt: 'Both lines have six syllables. Line A has two strong beats; line B has six. Which one takes longer to say at a normal speed?',
            text: 'A: "The doctor will see you."   B: "Nine big dogs ate green cake."',
            options: ['Line A', 'Line B', 'The same — they have the same number of syllables'],
            correctIndex: 1,
            correct: null,
            tokens: null,
            items: null,
            answer: 'Line B, comfortably.',
            why: 'Every word in B is a content word, so every syllable takes a full beat. In A only "doc-" and "see" get beats, and "The", "-tor", "will", "you" are compressed into the space between them. Six syllables is the same count and nothing like the same duration — which is why syllable count is the wrong thing to plan an English sentence around.',
            feelCheck: 'Count the two lines out on your fingers at a steady tap per beat: two taps for A, six for B. Same syllables, three times the taps.',
            l1: 'If the answer "the same" felt obviously right, that is the Telugu timing intuition talking, and naming it is the point of the item.'
        },
        {
            id: 'notice-rhythm-weak-forms',
            code: 'T-P1',
            target: 'rhythm',
            srsKey: 'phon:rhythm',
            mistakeCategory: 'prn.rhythm',
            mode: 'pick-written-form',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'The small words between the beats do not merely get quieter — they change shape. *Of*, *and*, *to*, *for*, *can* all have a reduced form that is what you will actually hear.',
            prompt: 'Which written version matches "a cup of tea" said at a normal speed?',
            text: 'a cup of tea',
            options: [
                'a CUP OF TEA — three clear words',
                'a CUP-pa TEA — "of" shrinks to /ə/ and leans onto "cup"',
                'a cup of TEA — only the last word strong, the rest careful'
            ],
            correctIndex: 1,
            correct: null,
            tokens: null,
            items: null,
            answer: 'a CUP-pa TEA — /ə ˈkʌp ə ˈtiː/.',
            why: '"Of" between two beats reduces to a single /ə/ and attaches to the word before it. This is why English sounds fast: not because the beats are quick, but because everything between them has collapsed. Learners who have never met this understand written English and lose the spoken version.',
            feelCheck: null,
            l1: 'Also the reason "fish and chips" arrives as "fish-n-chips". Recognising it while listening is worth more than producing it, and recognition is trainable from text.'
        },
        {
            id: 'notice-rhythm-beat-changes-meaning',
            code: 'T-P1',
            target: 'rhythm',
            srsKey: 'phon:rhythm',
            mistakeCategory: 'prn.rhythm',
            mode: 'match-beat-to-meaning',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'Which word you put the main beat on changes what the sentence means, even though the words are identical. Beats are grammar, not decoration.',
            prompt: 'The capitalised word is the one carrying the main beat. Match each version to what it implies.',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { form: 'I never said SHE took it.',   answer: 'Someone took it — but not her.' },
                { form: 'I never SAID she took it.',   answer: 'I may have thought it or hinted it, but I did not say it.' },
                { form: 'I never said she TOOK it.',   answer: 'She did something with it — borrowed it, moved it — but not took.' },
                { form: 'I NEVER said she took it.',   answer: 'A flat denial: not once, not ever.' }
            ],
            answer: 'Four beats, four different accusations, one sentence.',
            why: 'This is what a listener loses when every word gets equal weight: not the words, but which of these four you meant. It is the strongest argument in the app for taking rhythm seriously, and you can see the whole thing on paper.',
            feelCheck: null,
            l1: 'Telugu marks this kind of emphasis with particles and word order rather than with a beat, so the tool exists in both languages — it is the mechanism that has to be swapped.'
        },

        /* ---------------- T-P2  final-vowel epenthesis ------------------
         * *bus* → "bus-u". Telugu is strongly CV-structured, so a final
         * consonant attracts a vowel. Everything here is counting and
         * choosing on text.
         */
        {
            id: 'notice-final-vowel-count-sounds',
            code: 'T-P2',
            target: 'final-vowel',
            srsKey: 'phon:final-vowel',
            mistakeCategory: 'prn.final-vowel',
            mode: 'count-sounds',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'An English word is allowed to stop dead on a consonant. Nothing follows it — no vowel, no breath, no release you can hear as a syllable.',
            prompt: 'How many sounds — not letters — are there in *dog*?',
            text: 'dog  /dɒɡ/',
            options: ['2', '3', '4'],
            correctIndex: 1,
            correct: null,
            tokens: null,
            items: null,
            answer: 'Three: /d/ + /ɒ/ + /ɡ/. The word ends on the /ɡ/ and stops.',
            why: 'If you say "dog-u" you have produced four sounds and two syllables where English has three sounds and one. The count is the diagnosis, and you can do it on paper before you open your mouth.',
            feelCheck: 'Say *dog* and freeze. Your tongue should still be pressed against the back of your mouth, holding the /ɡ/ in. If it has already dropped and air is coming out, a vowel has escaped.',
            l1: 'Telugu syllables strongly prefer to end on a vowel, so a short /u/ or /ə/ slips in after a final English consonant. REQUIREMENTS.md §3.1 rates this High impact.'
        },
        {
            id: 'notice-final-vowel-at-risk-words',
            code: 'T-P2',
            target: 'final-vowel',
            srsKey: 'phon:final-vowel',
            mistakeCategory: 'prn.final-vowel',
            mode: 'pick-consonant-final',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'Before you can stop adding the vowel you have to see where it would go. Every word ending in a consonant *sound* is a place it can slip in.',
            prompt: 'Tap every word that ends in a consonant sound — those are the ones at risk.',
            text: 'I put the book back in the bag.',
            tokens: ['I', 'put', 'the', 'book', 'back', 'in', 'the', 'bag.'],
            correct: [1, 3, 4, 5, 7],
            options: null,
            correctIndex: null,
            items: null,
            answer: '**put**, **book**, **back**, **in**, **bag** — five of the eight words.',
            why: '"I" ends in a vowel and "the" ends in /ə/, so they are safe. The other five all stop on a consonant, and five added vowels would turn an eight-word sentence into thirteen syllables. This is what makes the error so audible: it is not one word, it is the whole line.',
            feelCheck: 'Read the sentence and stop hard on each of the five. Hold the last consonant for a second instead of releasing it — holding is always safe, releasing into a vowel is not.',
            l1: 'Sentence-level practice matters here, because the epenthesis is worst exactly where a Telugu-L1 speaker pauses to think — the extra vowel becomes the pause.'
        },
        {
            id: 'notice-final-vowel-becomes-another-word',
            code: 'T-P2',
            target: 'final-vowel',
            srsKey: 'phon:final-vowel',
            mistakeCategory: 'prn.final-vowel',
            mode: 'pick-which-word-you-said',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'The extra vowel is not a harmless accent feature. When it comes out as /ə/ it produces a different English word, and the listener hears that word.',
            prompt: 'You meant the word on the left. If a small /ə/ escapes after the final consonant, what does your listener hear?',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { intended: 'bet',  intendedIpa: '/bet/',  heard: 'better', heardIpa: '/ˈbetə/',  answer: 'better' },
                { intended: 'hard', intendedIpa: '/hɑːd/', heard: 'harder', heardIpa: '/ˈhɑːdə/', answer: 'harder' },
                { intended: 'wait', intendedIpa: '/weɪt/', heard: 'waiter', heardIpa: '/ˈweɪtə/', answer: 'waiter' },
                { intended: 'cook', intendedIpa: '/kʊk/',  heard: 'cooker', heardIpa: '/ˈkʊkə/',  answer: 'cooker' },
                { intended: 'farm', intendedIpa: '/fɑːm/', heard: 'farmer', heardIpa: '/ˈfɑːmə/', answer: 'farmer' },
                { intended: 'read', intendedIpa: '/riːd/', heard: 'reader', heardIpa: '/ˈriːdə/', answer: 'reader' }
            ],
            answer: 'bet → better, hard → harder, wait → waiter, cook → cooker, farm → farmer, read → reader.',
            why: '"I will wait" and "I will waiter" are not the same sentence, and the only difference is a vowel you did not mean to add. This is the honest answer to "does it really matter?" — sometimes it changes the word outright.',
            feelCheck: 'Say *wait*. Keep your tongue on the /t/ and do not let it go. That held /t/ is a complete, correct English word ending.',
            notMinimalPairs: false,
            l1: 'Accent dependency, stated plainly: this argument works because the reference accent is non-rhotic, so *waiter* ends in /ə/. In a strongly rhotic American accent the -er has an r-colour and the overlap is smaller — but the epenthetic vowel is still heard as an extra syllable, so the item still teaches. ⚠️ Needs a native check: whether Telugu-L1 epenthesis most often surfaces as /u/, /ʊ/ or /ə/ decides how literal "your listener hears *waiter*" really is.'
        },
        {
            id: 'notice-final-vowel-sort-endings',
            code: 'T-P2',
            target: 'final-vowel',
            srsKey: 'phon:final-vowel',
            mistakeCategory: 'prn.final-vowel',
            mode: 'sort',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: false,
            teach: 'Some English words really do end in a vowel sound. Spelling will not tell you which — a final "e" is usually silent, and a final "a" or "o" usually is not.',
            prompt: 'Sort these by their last *sound*: vowel or consonant?',
            text: null,
            options: ['ends in a vowel sound', 'ends in a consonant sound'],
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { word: 'coffee', ipa: '/ˈkɒfi/',    answer: 'vowel' },
                { word: 'photo',  ipa: '/ˈfəʊtəʊ/',  answer: 'vowel' },
                { word: 'sofa',   ipa: '/ˈsəʊfə/',   answer: 'vowel' },
                { word: 'idea',   ipa: '/aɪˈdɪə/',   answer: 'vowel' },
                { word: 'table',  ipa: '/ˈteɪbl/',   answer: 'consonant', note: 'The "e" is silent; the word ends on /l/.' },
                { word: 'orange', ipa: '/ˈɒrɪndʒ/',  answer: 'consonant', note: 'Silent "e" again — it ends on /dʒ/.' },
                { word: 'milk',   ipa: '/mɪlk/',     answer: 'consonant' },
                { word: 'hotel',  ipa: '/həʊˈtel/',  answer: 'consonant' }
            ],
            answer: 'coffee, photo, sofa, idea end in vowels; table, orange, milk, hotel end in consonants.',
            why: 'The four vowel-final words are the ones where your instinct is already right. The other four are where an English word does something Telugu words rarely do, and knowing which group a word is in is a text fact you can simply learn.',
            feelCheck: null,
            l1: 'Sorting first, producing later. A learner who can sort these has stopped guessing from spelling, which is the actual root of the habit.'
        },

        /* ---------------- T-P3  cluster breaking ------------------------
         * *asked* → "ask-ed", *films* → "fil-ims", *texts* → "tex-its".
         * The -ed item is the strongest exercise in this file: the rule is
         * fully determinate from the written verb, so a learner can get it
         * right on paper and carry it straight into speech.
         */
        {
            id: 'notice-cluster-ed-syllable',
            code: 'T-P3',
            target: 'cluster',
            srsKey: 'phon:cluster',
            mistakeCategory: 'prn.cluster',
            mode: 'sort',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'The -ed ending is a whole extra syllable **only after /t/ or /d/**. Everywhere else it is just a /t/ or /d/ sound welded onto the end of the word, adding no syllable at all. Look at the last *sound* of the verb before you add it — the spelling of the ending never changes, but what it does changes completely.',
            prompt: 'Does -ed add an extra syllable? Sort each word: yes or no.',
            text: null,
            options: ['yes — extra syllable', 'no — no extra syllable'],
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { word: 'asked',    base: 'ask',    baseEndsIn: '/k/',  answer: 'no',  syllables: 1, ipa: '/ɑːskt/',      note: 'One syllable, and it ends in three consonants in a row: /s/ /k/ /t/. "ask-ed" is two syllables and a different shape.' },
                { word: 'wanted',   base: 'want',   baseEndsIn: '/t/',  answer: 'yes', syllables: 2, ipa: '/ˈwɒntɪd/',    note: 'After /t/, so the ending really is a syllable: WON-tid.' },
                { word: 'walked',   base: 'walk',   baseEndsIn: '/k/',  answer: 'no',  syllables: 1, ipa: '/wɔːkt/' },
                { word: 'needed',   base: 'need',   baseEndsIn: '/d/',  answer: 'yes', syllables: 2, ipa: '/ˈniːdɪd/' },
                { word: 'watched',  base: 'watch',  baseEndsIn: '/tʃ/', answer: 'no',  syllables: 1, ipa: '/wɒtʃt/',      note: '/tʃ/ is not /t/ — this one catches almost everybody.' },
                { word: 'decided',  base: 'decide', baseEndsIn: '/d/',  answer: 'yes', syllables: 3, ipa: '/dɪˈsaɪdɪd/' },
                { word: 'finished', base: 'finish', baseEndsIn: '/ʃ/',  answer: 'no',  syllables: 2, ipa: '/ˈfɪnɪʃt/',     note: 'Two syllables, but both of them come from *finish*. The -ed adds none.' },
                { word: 'started',  base: 'start',  baseEndsIn: '/t/',  answer: 'yes', syllables: 2, ipa: '/ˈstɑːtɪd/' },
                { word: 'played',   base: 'play',   baseEndsIn: '/eɪ/', answer: 'no',  syllables: 1, ipa: '/pleɪd/' },
                { word: 'visited',  base: 'visit',  baseEndsIn: '/t/',  answer: 'yes', syllables: 3, ipa: '/ˈvɪzɪtɪd/' }
            ],
            answer: 'yes: wanted, needed, decided, started, visited (all after /t/ or /d/). no: asked, walked, watched, finished, played.',
            why: 'This one rule kills "ask-ed" outright, and it is fully decidable from the written word — no ear required. It is also the highest-value single item in the pronunciation strand, because -ed is on every past-tense verb the learner will ever say.',
            feelCheck: 'Say *asked* as one syllable: /ɑːs/ then let /k/ and /t/ happen with no vowel between them. Your tongue moves twice at the back and once at the front; your jaw should not open again. If the jaw opens, a vowel got in.',
            l1: 'Telugu clusters are far more restricted, so the tongue wants a vowel to lean on between the consonants. This is a timing problem, not a sound problem: the consonants are all sounds the learner already has.'
        },
        {
            id: 'notice-cluster-texts',
            code: 'T-P3',
            target: 'cluster',
            srsKey: 'phon:cluster',
            mistakeCategory: 'prn.cluster',
            mode: 'pick-written-form',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'English allows three and even four consonants at the end of one syllable. It is legal, and it stays one syllable.',
            prompt: 'Which written version matches *texts*?',
            text: 'texts',
            options: [
                'tek-sits — two syllables',
                'teksts — one syllable, four consonants at the end',
                'tek-sts — a small break before the last consonants',
                'tex-its — two syllables'
            ],
            correctIndex: 1,
            correct: null,
            tokens: null,
            items: null,
            answer: 'teksts — /teksts/, one syllable, with /k/ /s/ /t/ /s/ run together at the end.',
            why: 'Nothing goes between those consonants: no vowel and no pause. If it is hard, say the whole word more slowly — a slow *teksts* is still correct English, while a fast "tek-sits" is a different word shape and costs the listener a moment.',
            feelCheck: 'Say /teks/ and stop. Now add /ts/ without letting your jaw drop. Jaw still means no vowel; jaw dropping means one got in.',
            l1: 'The "say it slower rather than breaking it up" instruction is the practical fix, and it is also what js/core/mistakes.js already tells the learner for prn.cluster.'
        },
        {
            id: 'notice-cluster-one-syllable',
            code: 'T-P3',
            target: 'cluster',
            srsKey: 'phon:cluster',
            mistakeCategory: 'prn.cluster',
            mode: 'count-syllables',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'A syllable has exactly one vowel in it. Count the vowels and you have counted the syllables — no matter how many consonants are stacked around them.',
            prompt: 'How many syllables does each of these have?',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { word: 'films',   answer: 1, ipa: '/fɪlmz/',   note: 'One vowel, so one syllable. "fil-ims" has two.' },
                { word: 'worlds',  answer: 1, ipa: '/wɜːldz/',  note: 'Ends /l/ /d/ /z/.' },
                { word: 'months',  answer: 1, ipa: '/mʌnθs/',   note: 'Many native speakers simplify this to /mʌns/ — dropping a consonant is normal English, adding a vowel is not.' },
                { word: 'sixths',  answer: 1, ipa: '/sɪksθs/',  note: 'The hardest word in the language for this, and still one syllable.' },
                { word: 'clothes', answer: 1, ipa: '/kləʊðz/',  note: 'Usually just /kləʊz/, exactly like *close*.' },
                { word: 'asked',   answer: 1, ipa: '/ɑːskt/' },
                { word: 'strength', answer: 1, ipa: '/streŋθ/', note: 'Three consonants before the vowel and two after it.' },
                { word: 'wanted',  answer: 2, ipa: '/ˈwɒntɪd/', note: 'Two vowels, so genuinely two syllables — the odd one out here, and for a reason.' }
            ],
            answer: 'All one syllable except *wanted*, which has two.',
            why: 'Counting vowels is a text operation with a definite answer, and it gives the learner a way to check their own production later: if *films* came out as two beats, a vowel was invented.',
            feelCheck: 'Say *films* while resting a hand on your jaw. One drop of the jaw, one syllable. Two drops means "fil-ims".',
            l1: 'Note that *months* and *clothes* are simplified by native speakers too — but by dropping a consonant, never by adding a vowel. Worth saying, so the learner does not conclude that all simplification is an error.'
        },
        {
            id: 'notice-cluster-becomes-another-word',
            code: 'T-P3',
            target: 'cluster',
            srsKey: 'phon:cluster',
            mistakeCategory: 'prn.cluster',
            mode: 'pick-which-word-you-said',
            requiresImitation: false,
            requiresAudio: false,
            answerableFrom: 'text',
            audioOptional: true,
            teach: 'Clusters happen at the *start* of words too, and breaking one there can land you on a completely different word.',
            prompt: 'You meant the word on the left. If a vowel slips into the opening cluster, what have you said instead?',
            text: null,
            options: null,
            correctIndex: null,
            correct: null,
            tokens: null,
            items: [
                { intended: 'sport', intendedIpa: '/spɔːt/', heard: 'support', heardIpa: '/səˈpɔːt/', answer: 'support' },
                { intended: 'state', intendedIpa: '/steɪt/', heard: 'estate',  heardIpa: '/ɪˈsteɪt/', answer: 'estate' },
                { intended: 'steam', intendedIpa: '/stiːm/', heard: 'esteem',  heardIpa: '/ɪˈstiːm/', answer: 'esteem' }
            ],
            answer: 'sport → support, state → estate, steam → esteem.',
            why: '"We need more sport" and "we need more support" are both sensible sentences, so context will not rescue you. The /sp/ and /st/ have to arrive with nothing in front of them and nothing in between.',
            feelCheck: 'Start with just /s/, hold it for two seconds, and then add /p/ — /ssssport/. Slow is fine. As long as no vowel appears before or inside the /sp/, the word is right.',
            notMinimalPairs: true,
            notMinimalPairsWhy: '⚠️ These are illustrations, **not** minimal pairs, and must not be fed to the minimal-pair drill. Each differs from its partner by an inserted vowel *and* a stress shift — two changes, not one. They are here because they answer "does breaking a cluster really matter?" with a real English word.',
            l1: 'The inserted vowel is the same CV preference behind T-P2, applied to the front of the word instead of the end.'
        }
    ]
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PRONUNCIATION_VOWELS_STRESS: PRONUNCIATION_VOWELS_STRESS };
}
