/**
 * Pronunciation — consonant contrasts (Telugu-L1 priority set)
 * =============================================================================
 * Classic non-module script (CON-4). Declares the lexical global
 * `PRONUNCIATION_CONSONANTS`.
 *
 * ⚠️ A top-level `const` in a classic script is a *lexical* global, not a
 * property of `window`. Guard access with bare
 * `typeof PRONUNCIATION_CONSONANTS !== 'undefined'`, never
 * `window.PRONUNCIATION_CONSONANTS` (which is always undefined).
 *
 * Sibling of data/pronunciation/vowels-stress.js. That file owns the vowel and
 * prosody rows (T-P1, T-P2, T-P3, T-P4, T-P7, T-P8, T-P9); this one owns the
 * consonant rows of REQUIREMENTS.md §3.1:
 *
 *   T-P5   /v/ ~ /w/      Telugu వ covers both            priority M
 *   T-P6   /θ/ ~ /t/      both absent, realised dental    priority M
 *   T-P6   /ð/ ~ /d/      the voiced half of the same row priority M
 *   T-P10  /z/ ~ /s/      /z/ absent → /dʒ/ or /s/        priority S
 *   T-P11  /f/ ~ /p/      Telugu ఫ is aspirated p         priority S
 *
 * per FR-PRN-1…FR-PRN-9.
 *
 * `pairs[]` uses **exactly the key set and key order** of `pairs[]` in
 * vowels-stress.js, because a section loader is being written against that
 * shape. There is no `stress` or `noticing` array here — those live in the
 * sibling and are not duplicated.
 *
 * -----------------------------------------------------------------------------
 * T-P6 IS TWO PAIR SETS, ONE MISTAKE CATEGORY
 * -----------------------------------------------------------------------------
 * REQUIREMENTS.md §3.1 row T-P6 covers /θ/ and /ð/ together, and
 * js/core/mistakes.js has a single category `prn.th` for both, whose
 * `drill.target` is `'θ-t'`. Two separate pair sets are authored here anyway —
 * the voiceless and voiced halves are different drills with different word
 * lists — so both carry `mistakeCategory: 'prn.th'` and only the /θ/ set has an
 * `id` that matches an existing `drill.target`.
 *
 * ⚠️ OPEN ITEM for whoever wires the drill: `'ð-d'` is **not** currently a
 * `drill.target` in js/core/mistakes.js, so `phon:ð-d` will schedule fine but
 * nothing in the mistake log routes back to it. Either add a `ð-d` target
 * alongside `θ-t` under `prn.th`, or accept that a /ð/ miss is reported as a
 * generic "th" mistake. Do not fix it by collapsing the two pair sets into one:
 * *then/den* and *thin/tin* need different word lists and different voicing
 * checks, and merging them would hide the fact that /ð/ is the more frequent of
 * the two in ordinary speech (*the*, *this*, *that*, *they*, *there*).
 *
 * -----------------------------------------------------------------------------
 * REFERENCE ACCENT
 * -----------------------------------------------------------------------------
 * British (RP-style, Oxford/Cambridge learner-dictionary conventions), matching
 * vowels-stress.js and the transcriptions in REQUIREMENTS.md §3.1. Consonants
 * are far more accent-stable than vowels, so this matters much less here than it
 * does in the sibling file — but where a non-rhotic transcription is doing work
 * (*fourth/fort*, *four/pour*, *worthy/wordy*) it is flagged in `caveats`.
 *
 * -----------------------------------------------------------------------------
 * ⚠️ AS-3 IS STILL UNVERIFIED
 * -----------------------------------------------------------------------------
 * REQUIREMENTS.md §8.2 `AS-3` ("browser TTS distinguishes minimal pairs audibly
 * on real devices") has not been tested on a real mid-range Android phone.
 * Nothing in this file depends on TTS being good:
 *
 *   - every set carries `audio.ttsRisk` with a stated reason;
 *   - every set carries `audio.degradeTo`;
 *   - every set carries a `textOnlyFallback` that is gradable with no audio at
 *     all and still teaches the half of the problem that is lexical rather than
 *     auditory (which English words contain which consonant, and where the
 *     spelling lies about it — "th" for two different sounds, "s" for /z/,
 *     "ph" for /f/).
 *
 * `audio.clipIds` are *proposed* filenames. Nothing here asserts a clip exists.
 *
 * -----------------------------------------------------------------------------
 * TTS SAFETY IS PER-ROW — `minimalPairs[].ttsUse` (US-168)
 * -----------------------------------------------------------------------------
 * Same field, same four values, same reasoning as the sibling file — see the
 * block of that name in data/pronunciation/vowels-stress.js for the full
 * rationale. In short: `audio.ttsHint` is prose ("Never use *three/tree* … as a
 * TTS item"), so every claim it makes about a specific pair is also carried on
 * that pair's own row:
 *
 *   ttsUse   'prefer' | 'verify' | 'clip-first' | 'clip-only', ascending
 *            severity. Absent = no claim; fall back to `audio.ttsRisk`.
 *   ttsWhy   one sentence naming the prose claim the flag encodes, so the two
 *            cannot drift. Never shown to a learner.
 *
 * Plus one row-specific flag this file needs and the sibling does not:
 *
 *   requiresCarrierSentence
 *            true on `close/close` in the /z/~/s/ set. The two words are
 *            homographs, so a bare-word TTS call or a bare-word recording picks
 *            a reading at random; the clip must be cut from a sentence. It is a
 *            clip-*authoring* requirement, which is why it is separate from
 *            `ttsUse` rather than folded into it.
 *
 * Row level, not pair-set level, because a pair-set field would have to be added
 * to `PROJECTORS.phon` in js/core/srs.js — a file this content cannot edit — or
 * `_project()` drops it from every review record. A field inside a
 * `minimalPairs` row rides along inside the already-projected `minimalPairs`
 * value. It is also the truthful level: TTS safety is a property of the two
 * words, not of the contrast.
 *
 * SCOPE: flags encode claims made in the `audio` object (`ttsHint`, and
 * `ttsRiskWhy` where it names a specific pair). Voice-dependent claims that live
 * in `caveats` — the `en-US` /d/-flap warning on *other/udder*, for one — are
 * left as prose on purpose, and the row says so, so the gap is visible rather
 * than looking like an oversight.
 *
 * -----------------------------------------------------------------------------
 * ARTICULATORY, NOT AUDITORY — PROGRESS.md §6.aa rule 2
 * -----------------------------------------------------------------------------
 * This is the load-bearing design decision of the file, and consonants are where
 * it pays off most: unlike a vowel, a consonant has a *contact point*, and a
 * contact point can be felt with a fingertip or seen in a mirror. §6.aa names
 * this exact case — "a Telugu-L1 speaker who cannot yet *hear* /v/ vs /w/ will
 * play back their own *wine* for *vine*, hear no difference, and mark themselves
 * correct." Every cue and every `feelChecks` entry below therefore asks about
 * contact, buzz, breath or lip travel. None asks "did it sound right?".
 *
 * `feelChecks` are for FR-PRN-4 self-comparison. They are never graded
 * (FR-PRN-5) and never gate anything (FR-SPK-9). The only gate is
 * discrimination (FR-PRN-6), via `productionGate`.
 *
 * -----------------------------------------------------------------------------
 * SCHEMA — identical to `pairs[]` in vowels-stress.js
 * -----------------------------------------------------------------------------
 *   id                pair id, and **must equal a `drill.target` in
 *                     js/core/mistakes.js** ('v-w', 'θ-t', 'z-s', 'f-p'; see the
 *                     open item above for 'ð-d'). The SRS key is 'phon:' + id.
 *   code              REQUIREMENTS.md §3.1 row ('T-P5').
 *   priority          'M' | 'S' | 'W', copied from that row.
 *   difficulty        'medium' | 'hard' — how hard the *contrast* is for a
 *                     Telugu-L1 learner. Display and ordering only.
 *   pair              the two symbols. `pair[0]` is the English sound that does
 *                     not exist in Telugu (the one being taught); `pair[1]` is
 *                     the substitute the learner is likely to produce. `a` in
 *                     `minimalPairs` is always the `pair[0]` word.
 *   label             one learner-facing line naming the *feelable* difference.
 *   srsType/srsRef/srsKey   'phon' / id / 'phon:' + id.
 *   mistakeCategory   an `id` in js/core/mistakes.js.
 *   phonemes          [{ symbol, gloss, keyword, articulation, feel }] — one per
 *                     symbol. `gloss` is the FR-PRN-9 plain-English string.
 *   contrastFeature   the ONE feature the drill trains, named for the FR-PRN-1
 *                     wrong-answer message.
 *   articulatoryCue   the load-bearing field (REQUIREMENTS.md §3.3). Checkable
 *                     without hearing anything.
 *   mirrorCheck       what to look for in a mirror. Visual, never auditory.
 *   feelChecks        FR-PRN-4 self-comparison questions. Feelable only, ≥3.
 *   lengthNote        for consonants this is the *continuant* note: whether the
 *                     sound can be held, which is itself a feelable test.
 *   minimalPairs      [{ a, b, aIpa, bIpa, differsIn, note?, ttsUse?, ttsWhy?,
 *                       requiresCarrierSentence? }] — a and b differ in
 *                     **exactly one phoneme**. See "TTS SAFETY IS PER-ROW"
 *                     above for the last three.
 *   examples          flat word list (PROJECTORS.phon declares `examples`).
 *   sentences         [{ text, note }] contexts where the contrast carries
 *                     meaning.
 *   audio             { ttsRisk, ttsRiskWhy, requiresBundledClip, clipIds,
 *                       ttsHint, degradeTo }
 *   textOnlyFallback  a gradable no-audio exercise.
 *   discrimination    { mode, itemsFrom, wrongAnswer }.
 *   productionGate    FR-PRN-6: { requiresKey, minAccuracy, minAttempts, why }.
 *   caveats           accent dependencies and anything not to rely on quietly.
 *   tags              flat strings.
 *
 * -----------------------------------------------------------------------------
 * ⚠️ SRS PROJECTION CONTRACT — same gap as the sibling file
 * -----------------------------------------------------------------------------
 * `PROJECTORS.phon` in js/core/srs.js declares
 *
 *     phon: ['id', 'pair', 'label', 'examples', 'minimalPairs', 'difficulty']
 *
 * so `articulatoryCue`, `phonemes`, `code` and `contrastFeature` are silently
 * dropped from a review card. For a consonant pair that is worse than for a
 * vowel: the cue *is* the teaching content here, and without it the card shows
 * two IPA symbols and a word list. The extension vowels-stress.js asks for
 *
 *     phon: ['id', 'code', 'pair', 'label', 'phonemes', 'contrastFeature',
 *            'articulatoryCue', 'examples', 'minimalPairs', 'difficulty']
 *
 * covers this file too. Do not duplicate the cue into `label`.
 *
 * -----------------------------------------------------------------------------
 * SCOPE EXCLUSION — T-P12
 * -----------------------------------------------------------------------------
 * Retroflex /ʈ/, /ɖ/ for alveolar /t/, /d/ is **deliberately not here**.
 * REQUIREMENTS.md §3.1 marks it "Low — deliberately excluded. Target
 * intelligibility, not accent", and js/core/mistakes.js carries
 * `prn.retroflex` with `reportable: false` so it stays out of every
 * learner-facing list. Retroflexion marks a speaker as Indian; it does not stop
 * anyone understanding them. Do not add a retroflex pair set to this file.
 *
 * -----------------------------------------------------------------------------
 * WIRING CHECKLIST (CONTENT_AUTHORING_GUIDE.md §10 — none of it done here)
 * -----------------------------------------------------------------------------
 *   ☐ `<script src="data/pronunciation/consonants.js"></script>` in index.html,
 *     **before app.js**
 *   ☐ the same path in the service-worker.js precache list, or offline breaks
 *   ☐ `PROJECTORS.phon` extended as above
 *   ☐ a `ð-d` drill target under `prn.th` in js/core/mistakes.js, or an accepted
 *     decision not to have one
 *   ☐ AS-3 validated on a real mid-range Android device before any
 *     `audio.ttsRisk: 'high'` set is put in front of a learner
 * -----------------------------------------------------------------------------
 */

const PRONUNCIATION_CONSONANTS = {

    schemaVersion: 1,

    /* =====================================================================
     * CONSONANT MINIMAL PAIRS — T-P5, T-P6 (×2), T-P10, T-P11
     * ===================================================================== */
    pairs: [

        /* ---------------------------------------------------------------
         * T-P5  /v/ ~ /w/   vine / wine
         * The clearest articulatory case in the whole strand: one sound
         * has a contact point and the other has none. A learner who
         * cannot hear the difference at all can still check it with a
         * fingertip, which is the entire argument of PROGRESS.md §6.aa
         * rule 2 — and §6.aa uses this exact pair to make it.
         * --------------------------------------------------------------- */
        {
            id: 'v-w',
            code: 'T-P5',
            priority: 'M',
            difficulty: 'medium',
            pair: ['/v/', '/w/'],
            label: 'Top teeth touching your bottom lip, versus lips rounded and nothing touching',

            srsType: 'phon',
            srsRef: 'v-w',
            srsKey: 'phon:v-w',
            mistakeCategory: 'prn.v-w',

            phonemes: [
                {
                    symbol: '/v/',
                    gloss: '/v/ — the "v" in van',
                    keyword: 'van',
                    articulation: 'Your top front teeth rest lightly on your bottom lip and you push voiced breath through the narrow gap. There is a contact point, and the sound is a continuous buzz — you can hold it.',
                    feel: 'Bite very gently on your bottom lip with your top teeth, then hum. You should feel the lip vibrating against the teeth. That tickle is /v/, and it is the only thing you need to check.'
                },
                {
                    symbol: '/w/',
                    gloss: '/w/ — the "w" in wet',
                    keyword: 'wet',
                    articulation: 'Your lips round into a small circle and push forward, and then open again. Nothing touches anything: no teeth on lip, no tongue on the roof of the mouth. It is a glide from a rounded shape into the vowel.',
                    feel: 'Round your lips as if you were about to whistle, then say the word. Your teeth should stay clear of your lip the whole way through. If you feel a contact, you have said /v/.'
                }
            ],

            contrastFeature: 'whether the top teeth touch the bottom lip',
            articulatoryCue: 'Rest a fingertip flat against your bottom lip and say the word. For /v/ your top teeth land on the lip and the finger feels the buzz through it; for /w/ the lip pushes forward into a round and your teeth never arrive. One sound has a contact point, the other has none — that is the whole difference, and you can check it with your ears blocked.',
            mirrorCheck: 'Say "vine, wine, vine, wine" close to a mirror. On *vine* you should see your top teeth sitting on your bottom lip. On *wine* you should see a small round hole and no teeth at all. If you can see your teeth on both, you are saying /v/ twice; if you can see them on neither, you are saying /w/ twice.',
            feelChecks: [
                'Did your top teeth touch your bottom lip, or not touch it at all?',
                'Did your lips push forward into a round shape before the vowel started?',
                'Could you feel a buzz in your bottom lip, or only in your throat?',
                'Could you hold the first sound for two seconds without it turning into a vowel? Only /v/ does that.'
            ],
            lengthNote: '/v/ is a continuant: you can hold it — vvvvvine — for as long as your breath lasts, and while you hold it the buzz in your lip does not stop. /w/ cannot be held at all; try and it turns into an "oo" vowel. That is a second feelable test and it needs no ear: hold the first sound, and notice whether your teeth are involved in the holding.',

            minimalPairs: [
                { a: 'vine',   b: 'wine',   aIpa: '/vaɪn/',    bIpa: '/waɪn/',    differsIn: 'v/w',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: one syllable, contrast word-initial and stressed.',
                  note: 'The pair REQUIREMENTS.md §3.1 names for this row, and the one PROGRESS.md §6.aa uses to describe the perception blind spot.' },
                { a: 'vest',   b: 'west',   aIpa: '/vest/',    bIpa: '/west/',    differsIn: 'v/w',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: one syllable, contrast word-initial and stressed.' },
                { a: 'veil',   b: 'wail',   aIpa: '/veɪl/',    bIpa: '/weɪl/',    differsIn: 'v/w',
                  note: '*Veil* is the cloth; *wail* is a long cry. Spelling shares nothing, which is useful — the learner cannot read their way to the answer.' },
                { a: 'vet',    b: 'wet',    aIpa: '/vet/',     bIpa: '/wet/',     differsIn: 'v/w',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: one syllable, contrast word-initial and stressed.' },
                { a: 'vent',   b: 'went',   aIpa: '/vent/',    bIpa: '/went/',    differsIn: 'v/w',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: one syllable, contrast word-initial and stressed.',
                  note: 'Both very frequent, and *went* is one of the commonest verbs in English — a good sentence-level item.' },
                { a: 'verse',  b: 'worse',  aIpa: '/vɜːs/',    bIpa: '/wɜːs/',    differsIn: 'v/w' },
                { a: 'viper',  b: 'wiper',  aIpa: '/ˈvaɪpə/',  bIpa: '/ˈwaɪpə/',  differsIn: 'v/w',
                  note: 'Two syllables, so the contrast sits at the start of a longer word. *Wiper* as in a windscreen wiper.' },
                { a: 'vary',   b: 'wary',   aIpa: '/ˈveəri/',  bIpa: '/ˈweəri/',  differsIn: 'v/w',
                  note: 'AmE /ˈveri/ and /ˈweri/ — still a true pair, still differing only in the first consonant.' },
                { a: 'veal',   b: 'wheel',  aIpa: '/viːl/',    bIpa: '/wiːl/',    differsIn: 'v/w',
                  ttsUse: 'verify',
                  ttsWhy: 'audio.ttsHint: check on the device voice once before using it. This is a *minimality* risk, not a fidelity one — a /hw/ voice says /hwiːl/, which adds a second difference and stops the pair being minimal at all. Not a defect in the row; a dependency on the voice.',
                  note: '⚠️ Depends on the accent of the *voice*, not the learner. Most British and American speakers say *wheel* as /wiːl/, which makes this minimal. A minority (parts of Scotland, Ireland, the American South) say /hwiːl/, which adds a second difference. Drop this item if the device voice is one of those.' }
            ],

            examples: ['vine', 'wine', 'vest', 'west', 'veil', 'wail', 'vet', 'wet', 'vent',
                       'went', 'verse', 'worse', 'viper', 'wiper', 'vary', 'wary', 'veal',
                       'wheel'],

            sentences: [
                { text: 'We went to the vent.',
                  note: 'Both sounds in five words, and both readings are grammatical. Good first mirror sentence.' },
                { text: 'The wine came from that vine.',
                  note: 'Ordinary sentence, and the two words are related in meaning, so the learner has to keep them apart on the consonant alone rather than on sense.' },
                { text: 'Is your vest wet?',
                  note: 'Short, and the /v/ and /w/ sit at the front of two stressed words.' },
                { text: 'It could get worse in verse.',
                  note: 'Deliberately odd, so nothing but the consonant tells you which word is which.' },
                { text: 'The van is very wide.',
                  note: 'Two /v/ then one /w/, in a sentence someone might actually say. Watch your teeth in a mirror through all three.' }
            ],

            audio: {
                ttsRisk: 'low',
                ttsRiskWhy: 'The safest set in the file. /v/ and /w/ differ in *manner* — a fricative with audible high-frequency friction against a smooth glide — and friction survives compression, small speakers and a bad duration model far better than a vowel-quality difference does. A synthesiser has no trouble producing either, because both are frequent and unambiguous in its training data. The one real risk is not fidelity but the learner: at low volume on a tinny speaker the friction is the first thing to disappear, so tell them to turn the volume up rather than assuming their ear is at fault. This is a good candidate for the first set to ship on TTS if AS-3 passes on anything.',
                requiresBundledClip: false,
                clipIds: ['v-w/vine', 'v-w/wine', 'v-w/vest', 'v-w/west', 'v-w/veil', 'v-w/wail',
                          'v-w/vet', 'v-w/wet', 'v-w/vent', 'v-w/went', 'v-w/verse', 'v-w/worse',
                          'v-w/viper', 'v-w/wiper', 'v-w/vary', 'v-w/wary', 'v-w/veal',
                          'v-w/wheel'],
                ttsHint: 'Safe on TTS. Prefer the one-syllable pairs where the contrast is word-initial and stressed — *vine/wine*, *vest/west*, *vet/wet*, *vent/went*. Check *veal/wheel* on the device voice once before using it, in case the voice has /hw/.',
                degradeTo: 'textOnlyFallback'
            },

            textOnlyFallback: {
                mode: 'sort-by-consonant',
                prompt: 'Does the marked letter make /v/ (teeth on lip) or /w/ (lips rounded, nothing touching)? English spelling is nearly reliable here — the point of this exercise is the handful of places it is not.',
                items: [
                    { word: 'one',      ipa: '/wʌn/',       answer: 'w',
                      hint: 'No "w" in the spelling at all, and it starts with /w/. One of the commonest words in English.' },
                    { word: 'once',     ipa: '/wʌns/',      answer: 'w',
                      hint: 'Same trick as *one*.' },
                    { word: 'of',       ipa: '/ɒv/',        answer: 'v',
                      hint: 'The "f" is pronounced /v/. Compare *off* /ɒf/, which really is /f/ — two different words.' },
                    { word: 'wrong',    ipa: '/rɒŋ/',       answer: 'neither',
                      hint: 'Deliberate odd one out: the "w" is silent. Also *write*, *wrist*, *wrap*.' },
                    { word: 'quick',   ipa: '/kwɪk/',      answer: 'w',
                      hint: '"qu" is /kw/. The /w/ is hiding inside the "u".' },
                    { word: 'answer',   ipa: '/ˈɑːnsə/',    answer: 'neither',
                      hint: 'Another silent "w". Also *two*, *sword*, *who*.' },
                    { word: 'seven',    ipa: '/ˈsevn/',     answer: 'v' },
                    { word: 'away',     ipa: '/əˈweɪ/',     answer: 'w' },
                    { word: 'save',     ipa: '/seɪv/',      answer: 'v',
                      hint: 'Final /v/, and English is allowed to stop on it — no vowel after. That is also a T-P2 item.' }
                ],
                why: 'You do not need to hear this contrast to know that *one* and *once* begin with /w/, that the "f" in *of* is really a /v/, and that the "w" in *wrong* and *answer* is not pronounced at all. Those are facts about words, learnable from text, and they are half of what goes wrong in practice.'
            },

            discrimination: {
                mode: 'pick-which-word',
                itemsFrom: 'minimalPairs',
                wrongAnswer: 'Both words replay back to back and slowed. Name the feature, not the verdict: "*vine* puts your top teeth on your bottom lip; *wine* rounds your lips and touches nothing." Then offer the fingertip check — the point is that you can settle this one without hearing it. Telugu వ covers this whole area, so the two English words have been arriving as one word; that is a fact about the language you already speak, not about how carefully you are listening.'
            },

            productionGate: {
                requiresKey: 'phon:v-w',
                minAccuracy: 0.8,
                minAttempts: 10,
                why: 'FR-PRN-6, applied uniformly. Note the honest tension: this is the one pair where the articulatory check is reliable enough that a learner could self-monitor production before their ear catches up. The gate stays anyway, because FR-PRN-6 is uniform and because a learner who cannot pick *vine* out of a pair has no way to tell whether the habit is transferring into running speech.'
            },

            caveats: [
                'Telugu వ is usually described as a labiodental or labial approximant covering the whole /v/–/w/ space, which is why one Telugu letter answers two English sounds. Have a native speaker confirm the description before it is shown to a learner as fact; the teaching does not depend on it, since the cue is about the learner\'s own mouth.',
                'Do not teach /v/ as "harder" or "stronger" than /w/. Effort is not the difference and a learner told to push harder produces a strained /w/ or a /b/. The difference is a contact point: teeth on lip, or nothing.',
                'The related error /v/ → /b/ (both lips instead of teeth-on-lip) is a Hindi/Urdu and Spanish pattern more than a Telugu one, but it can appear in a learner who has been drilled on /v/ and is trying too hard. The fix is the same mirror check: /b/ shows two lips meeting, /v/ shows teeth on lip.',
                '"wh" spellings (*wheel*, *while*, *white*) are /w/ for most speakers but /hw/ for some. Keep them out of the graded discrimination items unless the device voice has been checked, and never mark a learner wrong on one.'
            ],
            tags: ['consonant', 'T-P5', 'v-w', 'contact-point', 'tts-risk-low', 'priority-M']
        },

        /* ---------------------------------------------------------------
         * T-P6a  /θ/ ~ /t/   thin / tin
         * The hardest set in the file, and the reason is worth stating
         * plainly rather than hiding in a caveat: the substitution is
         * *acoustically close to the target*. Telugu త is a dental stop —
         * the tongue is already at the teeth, which is where /θ/ wants it.
         * So the learner is not making a wild error, they are making a
         * small one, and small errors are the ones the ear filters out.
         * Everything here leans on the tongue tip being VISIBLE.
         * --------------------------------------------------------------- */
        {
            id: 'θ-t',
            code: 'T-P6',
            priority: 'M',
            difficulty: 'hard',
            pair: ['/θ/', '/t/'],
            label: 'Tongue tip visible between your teeth with air hissing past it, versus tongue hidden and air stopped dead',

            srsType: 'phon',
            srsRef: 'θ-t',
            srsKey: 'phon:θ-t',
            mistakeCategory: 'prn.th',

            phonemes: [
                {
                    symbol: '/θ/',
                    gloss: '/θ/ — the "th" in thin',
                    keyword: 'thin',
                    articulation: 'The tip of your tongue goes between your front teeth, or just touches the back of the top ones, and you let air hiss through the gap without stopping it. Nothing blocks completely, and there is no voice — only breath.',
                    feel: 'Put your tongue tip out until you can feel your top teeth resting on it, then blow gently. Hold a fingertip a centimetre from your mouth: you should feel a steady thin stream of cool air for as long as you keep going.'
                },
                {
                    symbol: '/t/',
                    gloss: '/t/ — the "t" in tin',
                    keyword: 'tin',
                    articulation: 'The tongue seals right across the roof of your mouth just behind the top teeth, air pressure builds behind it, and then it releases in one small burst. It is a stop: for a moment nothing at all gets out.',
                    feel: 'Say *tin* with a fingertip in front of your mouth. You feel nothing, then one sharp puff. The air arrives all at once instead of flowing — and your tongue tip stays hidden inside your mouth the whole time.'
                }
            ],

            contrastFeature: 'whether the air keeps flowing (and whether the tongue tip is visible)',
            articulatoryCue: 'Put your tongue tip out far enough to touch your top teeth and blow — that hiss is /θ/, and it can go on as long as your breath does. For /t/ the tongue pulls back behind the teeth, seals, and the air comes out as one puff. Hold a finger in front of your mouth: /θ/ gives you a steady stream, /t/ gives you a single tap of air.',
            mirrorCheck: 'This is the best mirror contrast in English and the whole reason to use a mirror at all. Say *thin* and you should be able to **see the tip of your tongue** between or just touching your teeth. Say *tin* and you should see no tongue at all. If the mirror shows no tongue on *thin*, you have said *tin*, whatever your ear tells you.',
            feelChecks: [
                'Could you see the tip of your tongue in the mirror on the "th" word?',
                'Did your top teeth rest on your tongue, or did your tongue seal behind them?',
                'Did the air keep flowing out, or did it stop and then burst?',
                'Could you hold the first sound for two seconds? /θ/ can be held; /t/ cannot be held at all.',
                'Was there any tickle in your throat? There should be none — /θ/ is breath only, no voice.'
            ],
            lengthNote: 'The holdable-or-not test is the most reliable one you have here, and it needs no ear. /θ/ is a fricative and can be stretched: thhhhhin. /t/ is a stop and physically cannot be stretched — try and you either get silence or you have swapped to a different sound. So: say the first sound and try to hold it for two seconds. If you can, it was /θ/. If you cannot, it was /t/, no matter what it sounded like to you.',

            minimalPairs: [
                { a: 'thin',    b: 'tin',    aIpa: '/θɪn/',   bIpa: '/tɪn/',   differsIn: 'θ/t',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: word-initial before a vowel, where the friction has the most room.',
                  note: 'The pair REQUIREMENTS.md §3.1 names for this row.' },
                { a: 'thick',   b: 'tick',   aIpa: '/θɪk/',   bIpa: '/tɪk/',   differsIn: 'θ/t',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: word-initial before a vowel.' },
                { a: 'thought', b: 'taught', aIpa: '/θɔːt/',  bIpa: '/tɔːt/',  differsIn: 'θ/t',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: word-initial before a vowel.',
                  note: 'Spelling gives no help at all here, which is why it is a good item. Both are very frequent words.' },
                { a: 'three',   b: 'tree',   aIpa: '/θriː/',  bIpa: '/triː/',  differsIn: 'θ/t',
                  ttsUse: 'clip-only',
                  ttsWhy: 'audio.ttsHint names this pair as never to be used as a TTS item: the following /r/ is where synthesised /θ/ collapses.',
                  note: 'Hardest item in the set: the following /r/ pulls the tongue back and makes the tip harder to keep forward. Keep it, because *three* is a word the learner says constantly, but expect it to be the last one to come right.' },
                { a: 'theme',   b: 'team',   aIpa: '/θiːm/',  bIpa: '/tiːm/',  differsIn: 'θ/t',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: word-initial before a vowel.' },
                { a: 'both',    b: 'boat',   aIpa: '/bəʊθ/',  bIpa: '/bəʊt/',  differsIn: 'θ/t',
                  note: 'Word-final, which is the harder position — the tongue has to come forward at the *end* of the word instead of the start.' },
                { a: 'faith',   b: 'fate',   aIpa: '/feɪθ/',  bIpa: '/feɪt/',  differsIn: 'θ/t' },
                { a: 'death',   b: 'debt',   aIpa: '/deθ/',   bIpa: '/det/',   differsIn: 'θ/t',
                  note: 'The "b" in *debt* is silent, so /det/ really is the whole word. Written forms look unrelated; spoken forms differ in one sound.' },
                { a: 'tenth',   b: 'tent',   aIpa: '/tenθ/',  bIpa: '/tent/',  differsIn: 'θ/t',
                  note: 'Both a /t/ and a /θ/ inside *tenth*, so the learner has to switch positions inside one syllable. Good self-check item: same word, both tongue positions.' },
                { a: 'thread',  b: 'tread',  aIpa: '/θred/',  bIpa: '/tred/',  differsIn: 'θ/t',
                  ttsUse: 'verify',
                  ttsWhy: 'audio.ttsHint names only *three/tree* and *through/true* as forbidden, but the reason it gives — "the following /r/ is where synthesised /θ/ collapses" — applies to this row too. Flagged as verify rather than clip-only because the hint does not forbid it: check it on the device voice, and if it fails, raise it to clip-only and add it to the hint.' },
                { a: 'through', b: 'true',   aIpa: '/θruː/',  bIpa: '/truː/',  differsIn: 'θ/t',
                  ttsUse: 'clip-only',
                  ttsWhy: 'audio.ttsHint names this pair as never to be used as a TTS item: the following /r/ is where synthesised /θ/ collapses.',
                  note: 'Two extremely common words, and the same following-/r/ difficulty as *three/tree*.' }
            ],

            examples: ['thin', 'tin', 'thick', 'tick', 'thought', 'taught', 'three', 'tree',
                       'theme', 'team', 'both', 'boat', 'faith', 'fate', 'death', 'debt',
                       'tenth', 'tent', 'thread', 'tread', 'through', 'true'],

            sentences: [
                { text: 'Both of them got on the boat.',
                  note: 'Both target sounds in one short line, and both readings of the pair are plausible English, so the consonant has to carry it.' },
                { text: 'I thought she taught maths.',
                  note: 'Ordinary sentence. *Thought* and *taught* differ in exactly one sound and in nothing else at all.' },
                { text: 'The tenth tent is thin.',
                  note: 'Three items in five words. The best mirror sentence in the set — your tongue should appear twice and stay hidden once.' },
                { text: 'Count to three, then look at the tree.',
                  note: 'The hardest pair, in a sentence where the meaning makes the target obvious, so the learner can practise the position without also having to guess.' },
                { text: 'He got through it, and that is true.',
                  note: 'Everyday phrasing, and it contains a /ð/ in *that* as well — worth pointing at the sibling /ð/–/d/ set here.' }
            ],

            audio: {
                ttsRisk: 'high',
                ttsRiskWhy: 'Expect this set to fail on TTS, and not mainly because of the synthesiser. /θ/ is the quietest consonant in English: it is a weak, very high-frequency, voiceless hiss with almost no energy in it. Small phone speakers roll off exactly that part of the spectrum, low-bitrate playback discards it, and any room noise buries it. On top of that, some TTS voices produce a /θ/ that is genuinely close to /t/ before /r/ (*three*, *through*), and the pre-/r/ items are the ones the learner most needs. So there are two independent failure modes: the contrast may not survive the speaker, and the voice may not have made it cleanly in the first place. **Do not judge a learner\'s ear on this set until AS-3 has been run on a real device.** Where a clip is missing, run the drill from `textOnlyFallback` and the mirror check instead — the mirror is more reliable here than any audio path we control.',
                requiresBundledClip: true,
                clipIds: ['θ-t/thin', 'θ-t/tin', 'θ-t/thick', 'θ-t/tick', 'θ-t/thought',
                          'θ-t/taught', 'θ-t/three', 'θ-t/tree', 'θ-t/theme', 'θ-t/team',
                          'θ-t/both', 'θ-t/boat', 'θ-t/faith', 'θ-t/fate', 'θ-t/death',
                          'θ-t/debt', 'θ-t/tenth', 'θ-t/tent', 'θ-t/thread', 'θ-t/tread',
                          'θ-t/through', 'θ-t/true'],
                ttsHint: 'If TTS must be used, prefer word-initial pairs before a vowel — *thin/tin*, *thick/tick*, *theme/team*, *thought/taught* — where the friction has the most room. Never use *three/tree* or *through/true* as a TTS item; the following /r/ is where synthesised /θ/ collapses. Prompt the learner to turn the volume up and use headphones if they have any, because this is a genuinely quiet sound rather than a badly made recording.',
                degradeTo: 'textOnlyFallback'
            },

            textOnlyFallback: {
                mode: 'sort-by-consonant',
                prompt: 'The letters "th" spell two different sounds in English, and sometimes a third thing. Is this word\'s "th" the breathy /θ/ of *thin*, the buzzing /ð/ of *this*, or something else?',
                items: [
                    { word: 'think',   ipa: '/θɪŋk/',     answer: 'θ' },
                    { word: 'this',    ipa: '/ðɪs/',      answer: 'ð',
                      hint: 'Put a hand on your throat: *this* buzzes, *think* does not.' },
                    { word: 'Thomas',  ipa: '/ˈtɒməs/',   answer: 't',
                      hint: 'Deliberate odd one out: some names spell a plain /t/ with "th". Also *Thames*, *Thailand*.' },
                    { word: 'nothing', ipa: '/ˈnʌθɪŋ/',   answer: 'θ' },
                    { word: 'weather', ipa: '/ˈweðə/',    answer: 'ð' },
                    { word: 'thirty',  ipa: '/ˈθɜːti/',   answer: 'θ',
                      hint: 'Contains both sounds\' worth of trouble: a /θ/ at the front and a /t/ in the middle.' },
                    { word: 'together',ipa: '/təˈɡeðə/',  answer: 'ð',
                      hint: 'The word starts with a plain /t/ and the "th" in the middle is /ð/.' },
                    { word: 'month',   ipa: '/mʌnθ/',     answer: 'θ',
                      hint: 'Word-final, and the plural *months* /mʌnθs/ is one of the hardest clusters in English — that is a T-P3 item.' },
                    { word: 'clothes', ipa: '/kləʊðz/',   answer: 'ð',
                      hint: 'Very often said as /kləʊz/, identical to *close*, even by native speakers.' }
                ],
                why: 'Which of the two "th" sounds a word takes is a fact about the word, not about your ear, and there is a usable rule underneath it: the grammar words — *the, this, that, they, them, then, there, than* — take the buzzing /ð/, and most content words take the breathy /θ/. You can learn that from text today and it will still be true when your ear catches up.'
            },

            discrimination: {
                mode: 'pick-which-word',
                itemsFrom: 'minimalPairs',
                wrongAnswer: 'Replay both slowed, back to back, and name the feature: "*thin* keeps the air hissing past your tongue tip; *tin* stops the air and lets it go in one puff." Then go straight to the mirror — on this pair the mirror is more trustworthy than the audio. Say honestly that this is the hardest contrast in the set, because Telugu త already puts your tongue at your teeth, so your version is close to the target rather than far from it, and close is exactly what an ear filters out.'
            },

            productionGate: {
                requiresKey: 'phon:θ-t',
                minAccuracy: 0.8,
                minAttempts: 10,
                why: 'FR-PRN-6. The gate matters more here than anywhere else: the substitution is acoustically near the target, so a learner self-comparing before their ear is ready will hear two identical clips and mark themselves right. That is the perception blind spot in PROGRESS.md §6.aa at its widest.'
            },

            caveats: [
                'Be honest that this is the hardest pair in the strand, and be specific about why: Telugu త and ద are **dental** stops, made with the tongue against the teeth, which is already where /θ/ and /ð/ want it. The learner is not missing by a mile, they are missing by the last few millimetres — tongue behind the teeth and sealing, instead of tongue on the teeth and leaking. A near-miss is harder to hear than a wild miss, so progress here is slower and that is not the learner\'s fault.',
                'A Telugu-L1 native speaker should check the dental description of త / ద, and whether the aspirated థ is close enough to /θ/ to be a useful starting point or close enough to be a trap. The teaching does not depend on the answer — the cue is about the learner\'s own tongue — but the explanation shown to them should not assert something unverified.',
                'Substituting /t/ for /θ/ costs less comprehension than the T-P1 rhythm errors do, and *thin* said as *tin* is usually recoverable from context. Say so. This is a long slow item and framing it as urgent is how a learner ends up avoiding words with "th" in them.',
                'Tongue *between* the teeth (interdental) and tongue tip *against the back of the top teeth* (dental fricative) both give an acceptable /θ/. Teach the interdental version first because it is the one you can see in a mirror, and let the learner drift back to the tidier position later.',
                'Do not use *thing/ting*, *thank/tank* style pairs where one member is rare or a proper noun, and do not use *path/part* or *bath/bat* — in the British reference accent those differ in the vowel as well.'
            ],
            tags: ['consonant', 'T-P6', 'θ-t', 'dental', 'mirror-visible', 'tts-risk-high', 'priority-M', 'hardest']
        },

        /* ---------------------------------------------------------------
         * T-P6b  /ð/ ~ /d/   then / den
         * The voiced half of row T-P6, and a separate drill: different
         * word list, and one extra check the voiceless set does not have
         * (the throat buzz, which the learner can feel with a hand).
         * Frequency matters here — /ð/ carries *the, this, that, they,
         * there, then, them, than*, so it is in almost every sentence the
         * learner will ever say, which makes it more worth the effort
         * than /θ/ even though it is the same difficulty.
         *
         * ⚠️ `id` 'ð-d' has no matching `drill.target` in
         * js/core/mistakes.js — see the open item in the file header.
         * --------------------------------------------------------------- */
        {
            id: 'ð-d',
            code: 'T-P6',
            priority: 'M',
            difficulty: 'hard',
            pair: ['/ð/', '/d/'],
            label: 'Tongue tip visible on your teeth and buzzing, versus tongue hidden behind them and the air stopped',

            srsType: 'phon',
            srsRef: 'ð-d',
            srsKey: 'phon:ð-d',
            mistakeCategory: 'prn.th',

            phonemes: [
                {
                    symbol: '/ð/',
                    gloss: '/ð/ — the "th" in this',
                    keyword: 'this',
                    articulation: 'Exactly the tongue position of /θ/ — tip between or just touching the front teeth — but with your voice switched on. The air keeps flowing and it buzzes as it goes.',
                    feel: 'Tongue tip out until your top teeth rest on it, then hum. You should feel two things at once: the buzz in your throat under your fingers, and the tongue tip pressed against your teeth. Both, at the same time, is /ð/.'
                },
                {
                    symbol: '/d/',
                    gloss: '/d/ — the "d" in den',
                    keyword: 'den',
                    articulation: 'The tongue seals against the roof of the mouth just behind the top teeth, the voice is on behind the seal, and then it releases in one burst. Voiced, but stopped.',
                    feel: 'Your tongue tip goes up and back and disappears from view. There is a moment where no air comes out at all, then a single release. Nothing rests on your teeth.'
                }
            ],

            contrastFeature: 'whether the buzz keeps flowing past the tongue tip or is stopped and released',
            articulatoryCue: 'Both sounds buzz, so the buzz is not the difference — the difference is whether the air escapes while it buzzes. Put one hand on your throat and look in a mirror. For /ð/ your tongue tip is out on your teeth and the buzz runs on continuously, so you can hold it: thhhhhis. For /d/ the tongue vanishes behind your teeth, the buzz is trapped for a moment, then it pops out. Same voice, different exit.',
            mirrorCheck: 'Say "then, den, then, den" into a mirror. On *then* your tongue tip should be visible against or between your teeth. On *den* you should see no tongue at all. Two words, two pictures — and unlike the sound, the picture is not something you can be wrong about.',
            feelChecks: [
                'Could you see your tongue tip in the mirror on the "th" word?',
                'Did the buzz run on without a break, or did it stop and then release?',
                'Was your hand on your throat feeling a buzz on both words? It should be — voicing is not what separates these two.',
                'Could you hold the first sound for two seconds? /ð/ can be held; /d/ cannot.'
            ],
            lengthNote: 'Same holdable test as the /θ/ set, and it is still the check that needs no ear: /ð/ is a fricative and stretches — thhhhhen — while /d/ is a stop and cannot be stretched at all. What is different here is that the buzz is present in *both* sounds, so do not try to use voicing as the cue. Voicing separates /ð/ from /θ/. It does nothing to separate /ð/ from /d/.',

            minimalPairs: [
                { a: 'then',    b: 'den',   aIpa: '/ðen/',    bIpa: '/den/',    differsIn: 'ð/d',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: stressed word-initial.',
                  note: 'The pair REQUIREMENTS.md §3.1 names for the voiced half of this row.' },
                { a: 'they',    b: 'day',   aIpa: '/ðeɪ/',    bIpa: '/deɪ/',    differsIn: 'ð/d',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: stressed word-initial.',
                  note: 'Two of the most frequent words in English. If these two collapse, ordinary sentences get genuinely ambiguous, which is the strongest argument for spending time on /ð/.' },
                { a: 'those',   b: 'doze',  aIpa: '/ðəʊz/',   bIpa: '/dəʊz/',   differsIn: 'ð/d',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: stressed word-initial.' },
                { a: 'there',   b: 'dare',  aIpa: '/ðeə/',    bIpa: '/deə/',    differsIn: 'ð/d',
                  note: '*There* and *their* are homophones, so either spelling works for the /ð/ member. AmE /ðer/ and /der/ — still minimal.' },
                { a: 'though',  b: 'dough', aIpa: '/ðəʊ/',    bIpa: '/dəʊ/',    differsIn: 'ð/d',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: stressed word-initial.',
                  note: '*Dough* is the bread mixture. Neither spelling tells you anything about the pronunciation, which makes the pair a fair test of the ear rather than of reading.' },
                { a: 'breathe', b: 'breed', aIpa: '/briːð/',  bIpa: '/briːd/',  differsIn: 'ð/d',
                  ttsUse: 'clip-only',
                  ttsWhy: 'audio.ttsHint: "Treat breathe/breed and loathe/load as bundled-clip-only." Final /ð/ is where voices are least consistent.',
                  note: 'Word-final, the harder position. Note *breathe* /briːð/ the verb, not *breath* /breθ/ the noun — the verb has both a different vowel and a voiced ending.' },
                { a: 'loathe',  b: 'load',  aIpa: '/ləʊð/',   bIpa: '/ləʊd/',   differsIn: 'ð/d',
                  ttsUse: 'clip-only',
                  ttsWhy: 'audio.ttsHint: "Treat breathe/breed and loathe/load as bundled-clip-only." Final /ð/ is where voices are least consistent.' },
                { a: 'worthy',  b: 'wordy', aIpa: '/ˈwɜːði/', bIpa: '/ˈwɜːdi/', differsIn: 'ð/d',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: the intervocalic pair, where /ð/ is longest and clearest.',
                  note: 'Mid-word between two vowels, which is where /ð/ is commonest in real speech (*other*, *mother*, *either*, *rather*). AmE /ˈwɜːrði/ and /ˈwɜːrdi/ — the /r/ is in both, so it stays minimal.' },
                { a: 'other',   b: 'udder', aIpa: '/ˈʌðə/',   bIpa: '/ˈʌdə/',   differsIn: 'ð/d',
                  note: 'An *udder* is the part of a cow that milk comes from. A real word but a rare one, so use this item for the mirror check rather than for vocabulary. ⚠️ `caveats` also warns that an `en-US` intervocalic /d/ flap can sound close to /ð/ here; that is a voice-dependent claim rather than an audio.ttsHint one, so it is deliberately NOT flagged with ttsUse — see the note on scope in the file header.' }
            ],

            examples: ['then', 'den', 'they', 'day', 'those', 'doze', 'there', 'dare', 'though',
                       'dough', 'breathe', 'breed', 'loathe', 'load', 'worthy', 'wordy', 'other',
                       'udder'],

            sentences: [
                { text: 'They come on that day.',
                  note: 'Two /ð/ and one /d/, all in the top hundred words of English. Best first sentence in the set.' },
                { text: 'We will do it then, in the den.',
                  note: 'Both target words in one line, and the sentence still makes sense either way round, so the consonant does the work.' },
                { text: 'Those two doze all afternoon.',
                  note: '*Doze* means to sleep lightly. Both readings are grammatical.' },
                { text: 'Breathe, and then load the van.',
                  note: 'A word-final /ð/ against a word-final /d/, plus a /v/ from the T-P5 set.' },
                { text: 'This, that, these, those — there are four of them.',
                  note: 'Not a minimal-pair item: this is the frequency argument made visible. Six /ð/ sounds in one short line, all of them grammar words. This is why /ð/ is worth the work.' }
            ],

            audio: {
                ttsRisk: 'medium',
                ttsRiskWhy: 'Better than the /θ/ set, for one physical reason: /ð/ is voiced, so it carries low-frequency energy that a small speaker can actually reproduce, whereas /θ/ is nothing but high-frequency hiss. The risk is different rather than absent. In connected speech /ð/ is frequently weakened almost to nothing, and some TTS voices reproduce that faithfully — a synthesised *then* can arrive as a /d/-like tap, which would mark the learner wrong for hearing what was actually said. It is also the sound native speakers themselves reduce most, so a clip that sounds "wrong" may simply be natural. Test word-final items (*breathe*, *loathe*) specifically: final /ð/ is where voices are least consistent.',
                requiresBundledClip: true,
                clipIds: ['ð-d/then', 'ð-d/den', 'ð-d/they', 'ð-d/day', 'ð-d/those', 'ð-d/doze',
                          'ð-d/there', 'ð-d/dare', 'ð-d/though', 'ð-d/dough', 'ð-d/breathe',
                          'ð-d/breed', 'ð-d/loathe', 'ð-d/load', 'ð-d/worthy', 'ð-d/wordy',
                          'ð-d/other', 'ð-d/udder'],
                ttsHint: 'Prefer stressed word-initial items — *then/den*, *they/day*, *those/doze*, *though/dough* — and the intervocalic pair *worthy/wordy*, where /ð/ is longest and clearest. Treat *breathe/breed* and *loathe/load* as bundled-clip-only.',
                degradeTo: 'textOnlyFallback'
            },

            textOnlyFallback: {
                mode: 'sort-by-consonant',
                prompt: 'These all have a "th". Which ones are the buzzing /ð/ of *this*, and which are the breathy /θ/ of *thin*? Put a hand on your throat if it helps — but you can also get every one of these from the rule underneath.',
                items: [
                    { word: 'the',      ipa: '/ðə/',       answer: 'ð',
                      hint: 'The single most frequent word in English, and it takes /ð/.' },
                    { word: 'they',     ipa: '/ðeɪ/',      answer: 'ð' },
                    { word: 'think',    ipa: '/θɪŋk/',     answer: 'θ' },
                    { word: 'rather',   ipa: '/ˈrɑːðə/',   answer: 'ð' },
                    { word: 'thousand', ipa: '/ˈθaʊznd/',  answer: 'θ' },
                    { word: 'brother',  ipa: '/ˈbrʌðə/',   answer: 'ð',
                      hint: '"th" between two vowels is nearly always /ð/.' },
                    { word: 'anything', ipa: '/ˈeniθɪŋ/',  answer: 'θ',
                      hint: 'The exception to the between-vowels pattern: *-thing* compounds keep /θ/. Also *nothing*, *something*.' },
                    { word: 'without',  ipa: '/wɪˈðaʊt/',  answer: 'ð' },
                    { word: 'through',  ipa: '/θruː/',     answer: 'θ' },
                    { word: 'clothes',  ipa: '/kləʊðz/',   answer: 'ð' }
                ],
                why: 'There is a usable rule and it is worth having even if you cannot yet hear the difference. **Grammar words take /ð/** — *the, this, that, these, those, they, them, then, there, than, though*. **Content words starting with "th" take /θ/** — *think, thin, three, thousand, through*. And "th" between two vowels is usually /ð/ — *other, mother, brother, rather* — except in the *-thing* words. That covers nearly everything you will meet, and it is learnable from text alone.'
            },

            discrimination: {
                mode: 'pick-which-word',
                itemsFrom: 'minimalPairs',
                wrongAnswer: 'Replay both slowed, back to back, and name the feature: "in *then* the buzz keeps flowing past your tongue tip; in *den* it is trapped behind your tongue and then released." Both words buzz, so do not offer voicing as the difference. Send them to the mirror, and say plainly that this pair is as hard as the *thin/tin* one and for the same reason — Telugu ద already has the tongue at the teeth, so the miss is a small one.'
            },

            productionGate: {
                requiresKey: 'phon:ð-d',
                minAccuracy: 0.8,
                minAttempts: 10,
                why: 'FR-PRN-6. Same reasoning as the /θ/ set — a near-miss substitution defeats self-comparison. ⚠️ This key has no `drill.target` in js/core/mistakes.js yet; see the open item in the file header before relying on the mistake log to route misses here.'
            },

            caveats: [
                'The two hardest sets in this file are this one and /θ/–/t/, and the reason is the same: Telugu త and ద are dental stops, so the tongue already starts in roughly the right place. The error is a few millimetres and a manner change, not a wrong sound, and small errors are the ones an ear trained on another language filters out completely. Expect this to take weeks, tell the learner that up front, and do not let the app imply that slow progress here means they are not trying.',
                'A native Telugu speaker should check the claim that ద is dental rather than alveolar, and how the aspirated ధ behaves, before either is described to a learner as fact.',
                '/ð/ is worth more effort than /θ/ despite being equally hard, purely because of frequency: *the, this, that, they, them, then, there, than* are all /ð/ and they are in nearly every sentence. Order this set before the /θ/ one if only one can be drilled.',
                'Native speakers reduce /ð/ heavily in fast speech — *in the* can come out with barely any friction at all, and "with them" often has no distinct /ð/ in the second word. Do not present the careful form as the only correct one, and do not build a listening item out of a reduced clip.',
                '*Lather/ladder* and *bathe/bade* were left out: the first differs in the vowel as well in the British reference accent, and *bade* is too rare to put in front of a learner.',
                'In American English, intervocalic /d/ is often a flap that can sound close to /ð/ — *udder* and *other* are genuinely hard to keep apart in a fast American clip. Prefer word-initial items when the device voice is `en-US`.'
            ],
            tags: ['consonant', 'T-P6', 'ð-d', 'dental', 'mirror-visible', 'tts-risk-medium', 'priority-M', 'hardest', 'high-frequency']
        },

        /* ---------------------------------------------------------------
         * T-P10  /z/ ~ /s/   zoo / sue
         * The tongue position is identical for both. Only the voicing
         * differs, and voicing is the one thing on this whole list you can
         * feel *directly* with a hand on your throat — which makes this the
         * second-easiest set to self-check after /v/–/w/, despite /z/ not
         * existing in Telugu at all.
         *
         * REQUIREMENTS.md §3.1 records the substitution as /dʒ/ or /s/
         * ("zoo" → "joo"). The drill is built on /z/ ~ /s/ because that is
         * where the genuine minimal pairs are and because it matches the
         * `z-s` drill target in js/core/mistakes.js. The /dʒ/ substitution
         * is handled by the cue and the caveats instead, where it belongs:
         * it is an error to *rule out*, not a contrast to train.
         * --------------------------------------------------------------- */
        {
            id: 'z-s',
            code: 'T-P10',
            priority: 'S',
            difficulty: 'medium',
            pair: ['/z/', '/s/'],
            label: 'Same tongue position for both — one buzzes in your throat, the other does not',

            srsType: 'phon',
            srsRef: 'z-s',
            srsKey: 'phon:z-s',
            mistakeCategory: 'prn.z',

            phonemes: [
                {
                    symbol: '/z/',
                    gloss: '/z/ — the "z" in zoo',
                    keyword: 'zoo',
                    articulation: 'Tongue tip close to the ridge behind your top teeth, a narrow channel down the middle, air hissing through it — and your voice on. It is /s/ with the voice switched on, and nothing else changes.',
                    feel: 'Two fingers flat on the front of your throat. Say a long zzzzz and you should feel a steady vibration under them. It is the same feeling as humming.'
                },
                {
                    symbol: '/s/',
                    gloss: '/s/ — the "s" in Sue',
                    keyword: 'Sue',
                    articulation: 'Identical tongue position, identical channel, identical hiss — but no voice. Breath only.',
                    feel: 'Same two fingers on your throat. Say a long ssssss and you should feel nothing at all. Your throat is still.'
                }
            ],

            contrastFeature: 'whether your throat vibrates (voicing)',
            articulatoryCue: 'Put two fingers flat on the front of your throat and say a long ssssss, then a long zzzzz, without moving your tongue or lips at all. The /z/ makes your fingers buzz and the /s/ leaves them still. Your mouth does exactly the same thing for both — the only thing you are changing is switching your voice on, and that switch is something you can feel from outside.',
            mirrorCheck: 'Less useful than the throat check here, because the mouth position is genuinely identical for both — that is the point. What the mirror is for is ruling out the other error: if your lips push forward and round, or your tongue comes up flat against the roof of your mouth, you have said /dʒ/ ("j"), not /z/. A /z/ shows a flat, still mouth with the teeth almost closed.',
            feelChecks: [
                'Did your fingers on your throat feel a buzz, or stay still?',
                'Did your tongue and lips stay in exactly the same place for both words? They should — nothing moves but the voice.',
                'Did your lips round or push forward? If so you have said "j" rather than /z/.',
                'Could you hold the sound and keep the buzz going the whole time, without it turning into a burst?'
            ],
            lengthNote: 'Both sounds are continuants and both can be held for as long as your breath lasts, so holding does not separate them here — it is the *buzz during the hold* that does. The useful drill is the slow switch: hold ssssszzzzzsssss on one breath with your fingers on your throat and your mouth completely still, and feel the vibration come and go. That is the whole contrast, isolated, with no words and no listening involved. It also rules out /dʒ/, which cannot be held at all.',

            minimalPairs: [
                { a: 'zoo',    b: 'Sue',    aIpa: '/zuː/',      bIpa: '/suː/',      differsIn: 'z/s',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: word-initial. But audio.ttsRiskWhy warns the voice may read *Sue* as a name with different prosody — use the verb reading in the prompt text.',
                  note: 'REQUIREMENTS.md §3.1 names *zoo* for this row. *Sue* is both a common name and the verb "to sue" — use the verb sense if a proper noun is unwanted.' },
                { a: 'zip',    b: 'sip',    aIpa: '/zɪp/',      bIpa: '/sɪp/',      differsIn: 'z/s',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: word-initial.' },
                { a: 'zeal',   b: 'seal',   aIpa: '/ziːl/',     bIpa: '/siːl/',     differsIn: 'z/s',
                  note: '*Zeal* means great enthusiasm. Less common than the rest, kept because word-initial /z/ items are scarce in English.' },
                { a: 'zinc',   b: 'sink',   aIpa: '/zɪŋk/',     bIpa: '/sɪŋk/',     differsIn: 'z/s',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: word-initial.',
                  note: 'The "c" of *zinc* and the "k" of *sink* both spell /k/, so the two words really do differ only at the front.' },
                { a: 'buzz',   b: 'bus',    aIpa: '/bʌz/',      bIpa: '/bʌs/',      differsIn: 'z/s',
                  ttsUse: 'verify',
                  ttsWhy: 'audio.ttsHint: "Treat buzz/bus with care — final /z/ devoicing can make a synthesised buzz land close to bus." Check it on the device voice before grading a miss on it.',
                  note: 'Word-final, and *bus* is the exact word REQUIREMENTS.md §3.1 uses for T-P2 final-vowel epenthesis — so this item catches two Telugu-L1 patterns at once. Neither word may end in a vowel.' },
                { a: 'eyes',   b: 'ice',    aIpa: '/aɪz/',      bIpa: '/aɪs/',      differsIn: 'z/s',
                  note: 'Very frequent, and the plural "-s" ending being /z/ rather than /s/ is a rule worth teaching alongside it.' },
                { a: 'rise',   b: 'rice',   aIpa: '/raɪz/',     bIpa: '/raɪs/',     differsIn: 'z/s',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: the vowel-length cue before the final consonant is largest here, and TTS reproduces it fairly reliably.' },
                { a: 'prize',  b: 'price',  aIpa: '/praɪz/',    bIpa: '/praɪs/',    differsIn: 'z/s',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: large vowel-length cue before the final consonant.' },
                { a: 'lose',   b: 'loose',  aIpa: '/luːz/',     bIpa: '/luːs/',     differsIn: 'z/s',
                  note: 'Confused in *writing* by native speakers constantly, and the spoken difference is only the final consonant.' },
                { a: 'advise', b: 'advice', aIpa: '/ədˈvaɪz/',  bIpa: '/ədˈvaɪs/',  differsIn: 'z/s',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: large vowel-length cue before the final consonant.',
                  note: 'The most useful pair in the set: verb versus noun, and in English the *only* thing separating them in speech is the voicing of the last consonant. "Can you advise me" against "can you give me advice".' },
                { a: 'close',  b: 'close',  aIpa: '/kləʊz/',    bIpa: '/kləʊs/',    differsIn: 'z/s',
                  ttsUse: 'clip-only',
                  requiresCarrierSentence: true,
                  ttsWhy: 'audio.ttsHint: "The two `close` clips must be generated from a carrier sentence, not from the bare word, or the voice will pick one reading at random." A bare-word TTS call cannot satisfy that, so this row is never TTS-renderable; `requiresCarrierSentence` is the flag for whoever generates the clips.',
                  note: 'Same nine letters, two different words: /kləʊz/ is the verb (shut the door) and /kləʊs/ is the adjective (near). Nothing in the spelling tells you which, so this is the item that proves the contrast carries real meaning. Show it late in the set, after the learner can feel the buzz.' }
            ],

            examples: ['zoo', 'Sue', 'zip', 'sip', 'zeal', 'seal', 'zinc', 'sink', 'buzz', 'bus',
                       'eyes', 'ice', 'rise', 'rice', 'prize', 'price', 'lose', 'loose', 'advise',
                       'advice', 'close'],

            sentences: [
                { text: 'The bus made a loud buzz.',
                  note: 'Both target sounds word-final, and both words must stop dead on the consonant — no vowel after either. Doubles as a T-P2 check.' },
                { text: 'What is the price of the prize?',
                  note: 'Ordinary question, and only the last consonant of each word keeps the two apart.' },
                { text: 'Close the door — we are close to the zoo.',
                  note: 'The same spelling twice, said two different ways, in one sentence. Best teaching sentence in the set.' },
                { text: 'Can you advise me? I need advice.',
                  note: 'Verb then noun. This is the pattern that costs a learner real credibility at work, and it is only a voicing difference.' },
                { text: 'She closed her eyes and had some rice.',
                  note: 'A /z/ from the "-ed" ending, a /z/ from the plural, and an /s/ at the end — three endings, and the spelling predicts none of them.' }
            ],

            audio: {
                ttsRisk: 'low',
                ttsRiskWhy: 'One of the safer sets. Voicing shows up as low-frequency energy plus a real duration difference in the preceding vowel, and both of those survive small speakers and compression better than a high-frequency hiss does. English also gives a free second cue: the vowel before a voiced consonant is noticeably longer, so the /aɪ/ in *rise* is longer than the one in *rice*, and TTS reproduces that fairly reliably because it is in the training data. Two caveats. Word-final /z/ is often partly devoiced by real speakers and by voices copying them, which narrows the contrast — *rise/rice* is safer than *buzz/bus*. And *zoo/Sue* may render *Sue* as a name with different prosody, so prefer the verb reading in the prompt text.',
                requiresBundledClip: false,
                clipIds: ['z-s/zoo', 'z-s/sue', 'z-s/zip', 'z-s/sip', 'z-s/zeal', 'z-s/seal',
                          'z-s/zinc', 'z-s/sink', 'z-s/buzz', 'z-s/bus', 'z-s/eyes', 'z-s/ice',
                          'z-s/rise', 'z-s/rice', 'z-s/prize', 'z-s/price', 'z-s/lose',
                          'z-s/loose', 'z-s/advise', 'z-s/advice', 'z-s/close-verb',
                          'z-s/close-adjective'],
                ttsHint: 'Prefer word-initial pairs (*zip/sip*, *zinc/sink*, *zoo/sue*) and the pairs where the vowel-length cue is largest (*rise/rice*, *prize/price*, *advise/advice*). Treat *buzz/bus* with care: final /z/ devoicing can make a synthesised *buzz* land close to *bus*. The two `close` clips must be generated from a carrier sentence, not from the bare word, or the voice will pick one reading at random.',
                degradeTo: 'textOnlyFallback'
            },

            textOnlyFallback: {
                mode: 'sort-by-consonant',
                prompt: 'The letter "s" spells /z/ in English at least as often as it spells /s/. Does the "s" or "z" in this word buzz (/z/) or not (/s/)?',
                items: [
                    { word: 'is',       ipa: '/ɪz/',        answer: 'z',
                      hint: 'One of the commonest words in English and its "s" is a /z/. So are *was*, *has*, *his*, *as*.' },
                    { word: 'was',      ipa: '/wɒz/',       answer: 'z' },
                    { word: 'this',     ipa: '/ðɪs/',       answer: 's',
                      hint: 'Compare *is* — same two letters at the end, different sound.' },
                    { word: 'because',  ipa: '/bɪˈkɒz/',    answer: 'z' },
                    { word: 'busy',     ipa: '/ˈbɪzi/',     answer: 'z' },
                    { word: 'house',    ipa: '/haʊs/',      answer: 's',
                      hint: 'The noun is /s/, but the plural *houses* is /ˈhaʊzɪz/ and the verb *to house* is /haʊz/.' },
                    { word: 'dogs',     ipa: '/dɒɡz/',      answer: 'z',
                      hint: 'The plural ending is /z/ after a voiced sound. So is *cars*, *jobs*, *rooms*, *days*.' },
                    { word: 'cats',     ipa: '/kæts/',      answer: 's',
                      hint: 'And /s/ after a voiceless one. Compare *dogs*: same letter, two sounds, and the sound before it decides.' },
                    { word: 'exam',     ipa: '/ɪɡˈzæm/',    answer: 'z',
                      hint: 'The "x" is /ɡz/, so there is a /z/ inside it. Also *example*, *exact*, *exist*.' },
                    { word: 'scissors', ipa: '/ˈsɪzəz/',    answer: 'both',
                      hint: 'One of each and then some: /s/ at the front, /z/ in the middle, /z/ at the end. Four "s" letters, three of them doing different jobs.' }
                ],
                why: 'This is the half of the problem that has nothing to do with your ear. English spells /z/ with the letter "s" in some of its commonest words — *is, was, has, his, as, because* — and the plural ending is /z/ after a voiced sound (*dogs*) and /s/ after a voiceless one (*cats*). Learning that from text costs nothing and fixes a lot.'
            },

            discrimination: {
                mode: 'pick-which-word',
                itemsFrom: 'minimalPairs',
                wrongAnswer: 'Replay both slowed, back to back, and name the feature: "*zoo* buzzes in your throat and *Sue* does not — your mouth does the same thing for both." Then send them to the throat check, which is the most direct self-test anywhere in this strand: fingers on the throat, hold ssssszzzzz, feel the vibration switch on and off. Add the /dʒ/ warning if the learner\'s attempt showed rounded lips.'
            },

            productionGate: {
                requiresKey: 'phon:z-s',
                minAccuracy: 0.8,
                minAttempts: 10,
                why: 'FR-PRN-6, applied uniformly. Honest note: the blind spot is narrower here than on any other set except /v/–/w/, because a hand on the throat gives an answer that does not route through the ear at all.'
            },

            caveats: [
                'REQUIREMENTS.md §3.1 records the substitution as /dʒ/ **or** /s/, and the /dʒ/ half ("zoo" → "joo") has no usable minimal pairs — *zest/jest* is the only clean one and *jest* is rare. So /dʒ/ is trained out by exclusion rather than by contrast: the cue and the mirror check both tell the learner that /z/ has a still, flat mouth and can be held, while /dʒ/ rounds the lips and cannot be held. If a learner is producing "joo", the useful instruction is "hold the first sound for three seconds" — /dʒ/ cannot survive that.',
                'A native Telugu speaker should confirm how /z/ is actually realised in Telugu-accented English locally, and in loanwords. The absence of /z/ from the Telugu inventory is the documented claim; which substitute wins in practice may vary by speaker and by word, and the app should not assert "you say joo" to someone who says "soo".',
                'Word-final /z/ is partly devoiced even by native speakers, so *buzz* does not end in a fully voiced buzz in real speech. The reliable cue in final position is the *length of the vowel before it* — the /ʌ/ in *buzz* is longer than the one in *bus*. Mention this rather than insisting on a strong final buzz, which produces an unnatural, overdone ending.',
                'Do not build items on *close* without a carrier sentence. Out of context the written word is genuinely ambiguous and the learner would be marked wrong for a defensible reading.',
                '*Zen/den*, *zoo/Jew* and similar were not used: the first is not a /z/–/s/ pair at all, and the second is a religious and ethnic term with no place in a pronunciation drill.'
            ],
            tags: ['consonant', 'T-P10', 'z-s', 'voicing', 'throat-check', 'tts-risk-low', 'priority-S']
        },

        /* ---------------------------------------------------------------
         * T-P11  /f/ ~ /p/   fan / pan
         * Structurally the same lesson as /v/–/w/ one octave down: teeth
         * on lip against lips together, and both are visible in a mirror.
         * The Telugu-specific twist is that ఫ is an *aspirated p*, not an
         * /f/, so the learner reading "ph" or "f" reaches for a puff of
         * air from both lips — /pʰ/ — which is a stop where English wants
         * a fricative. The fix is the hold test: /f/ can be held, /pʰ/
         * cannot.
         * --------------------------------------------------------------- */
        {
            id: 'f-p',
            code: 'T-P11',
            priority: 'S',
            difficulty: 'medium',
            pair: ['/f/', '/p/'],
            label: 'Top teeth on your bottom lip with air flowing, versus both lips together and the air stopped',

            srsType: 'phon',
            srsRef: 'f-p',
            srsKey: 'phon:f-p',
            mistakeCategory: 'prn.f-p',

            phonemes: [
                {
                    symbol: '/f/',
                    gloss: '/f/ — the "f" in fan',
                    keyword: 'fan',
                    articulation: 'Your top front teeth rest on your bottom lip and air flows continuously through the gap. No voice, and nothing ever closes completely — the air never stops.',
                    feel: 'The same contact point as /v/, without the buzz. Rest your top teeth on your bottom lip and blow: you should feel a steady stream of air across your lip, and you can keep it going as long as you have breath.'
                },
                {
                    symbol: '/p/',
                    gloss: '/p/ — the "p" in pan',
                    keyword: 'pan',
                    articulation: 'Both lips press together and seal completely, pressure builds behind them, and they part in one burst. Your teeth are not involved at all.',
                    feel: 'Your two lips meet. There is a moment of complete silence with no air escaping, then one puff. Hold a hand in front of your mouth and you feel a single slap of air, not a stream.'
                }
            ],

            contrastFeature: 'teeth-on-lip with the air flowing, versus two lips sealing and stopping it',
            articulatoryCue: 'Hold your palm about ten centimetres in front of your mouth. Say *fan* and you should feel a steady stream of air arriving the whole time the "f" lasts. Say *pan* and you feel nothing, then one slap. Then check the contact: /f/ is top teeth on bottom lip, /p/ is lip against lip. Two different contact points, and you can feel which one you used with your eyes shut.',
            mirrorCheck: 'Say "fan, pan, fan, pan" into a mirror. *Fan* should show your top teeth sitting on your bottom lip. *Pan* should show both lips pressed flat together and no teeth at all. It is the same picture pair as *vine/wine* from the T-P5 set, so if you have done that one you already know what you are looking for.',
            feelChecks: [
                'Did your top teeth touch your bottom lip, or did your two lips meet each other?',
                'Did the air arrive at your palm as a steady stream, or as one slap?',
                'Could you hold the first sound for two seconds? /f/ can be held; /p/ cannot.',
                'Did your lips close completely at any point? For /f/ they must not — the gap has to stay open.'
            ],
            lengthNote: 'The hold test is the one that solves the specific Telugu problem here. /f/ is a fricative and stretches — ffffffan — because the air never stops. /p/ is a stop and cannot be stretched at all. Telugu ఫ is an *aspirated p*: a stop with a strong puff after it. A puff feels like effort, so a learner who is trying hard tends to produce more puff rather than more flow, and ends up further from /f/ the harder they try. So do not push harder — put your teeth on your lip and let the air run.',

            minimalPairs: [
                { a: 'fan',    b: 'pan',    aIpa: '/fæn/',     bIpa: '/pæn/',     differsIn: 'f/p',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: stressed word-initial before a vowel.',
                  note: 'The pair REQUIREMENTS.md §3.1 names for this row.' },
                { a: 'coffee', b: 'copy',   aIpa: '/ˈkɒfi/',   bIpa: '/ˈkɒpi/',   differsIn: 'f/p',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: mid-word, the safest position in this set — the surrounding vowels give the ear a frame.',
                  note: 'Mid-word, two syllables, and both words are said daily at work. The most useful item in the set.' },
                { a: 'fine',   b: 'pine',   aIpa: '/faɪn/',    bIpa: '/paɪn/',    differsIn: 'f/p',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: stressed word-initial before a vowel.' },
                { a: 'full',   b: 'pull',   aIpa: '/fʊl/',     bIpa: '/pʊl/',     differsIn: 'f/p' },
                { a: 'fool',   b: 'pool',   aIpa: '/fuːl/',    bIpa: '/puːl/',    differsIn: 'f/p',
                  note: 'Worth keeping next to *full/pull* — the two pairs have different vowels, so a learner who mixes all four up has a T-P7-adjacent vowel problem as well as this one.' },
                { a: 'face',   b: 'pace',   aIpa: '/feɪs/',    bIpa: '/peɪs/',    differsIn: 'f/p',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: stressed word-initial before a vowel.' },
                { a: 'four',   b: 'pour',   aIpa: '/fɔː/',     bIpa: '/pɔː/',     differsIn: 'f/p',
                  note: 'Non-rhotic British transcription. In American English /fɔːr/ and /pɔːr/ — the /r/ is in both, so it stays a true minimal pair either way.' },
                { a: 'leaf',   b: 'leap',   aIpa: '/liːf/',    bIpa: '/liːp/',    differsIn: 'f/p',
                  ttsUse: 'clip-first',
                  ttsWhy: 'audio.ttsHint: "Treat the word-final items as bundled-clip-first, because final /f/ is the quietest thing in the set." Clip-first, not clip-only: the hint permits TTS as a fallback if the learner is warned to raise the volume.',
                  note: 'Word-final. Also a T-P2 item: neither word may pick up a vowel at the end.' },
                { a: 'cuff',   b: 'cup',    aIpa: '/kʌf/',     bIpa: '/kʌp/',     differsIn: 'f/p',
                  ttsUse: 'clip-first',
                  ttsWhy: 'audio.ttsHint: word-final /f/ is the quietest thing in the set — bundled clip first, TTS only as a warned fallback.' },
                { a: 'wife',   b: 'wipe',   aIpa: '/waɪf/',    bIpa: '/waɪp/',    differsIn: 'f/p',
                  ttsUse: 'clip-first',
                  ttsWhy: 'audio.ttsHint: word-final /f/ is the quietest thing in the set — bundled clip first, TTS only as a warned fallback.',
                  note: 'Starts with a /w/, so it doubles as a T-P5 check: lips rounded and no contact at the start, teeth on lip at the end.' },
                { a: 'suffer', b: 'supper', aIpa: '/ˈsʌfə/',   bIpa: '/ˈsʌpə/',   differsIn: 'f/p',
                  ttsUse: 'prefer',
                  ttsWhy: 'audio.ttsHint: mid-word, the safest position in this set.',
                  note: 'Mid-word between vowels, like *coffee/copy*. The doubled letters in the spelling are irrelevant to the sound.' }
            ],

            examples: ['fan', 'pan', 'coffee', 'copy', 'fine', 'pine', 'full', 'pull', 'fool',
                       'pool', 'face', 'pace', 'four', 'pour', 'leaf', 'leap', 'cuff', 'cup',
                       'wife', 'wipe', 'suffer', 'supper'],

            sentences: [
                { text: 'Can you copy this while I get a coffee?',
                  note: 'Both words in one ordinary office sentence, which is exactly where this pair costs the learner something.' },
                { text: 'Put the fan next to the pan.',
                  note: 'Shortest possible contrast, same vowel and same final consonant either side. Best mirror sentence.' },
                { text: 'Pour me four cups.',
                  note: 'Both target sounds plus a /p/ in *cups*. Palm in front of the mouth: stream, slap, slap.' },
                { text: 'The pool is full of fools.',
                  note: 'Deliberately silly, and it forces the vowel and the consonant to be right at the same time.' },
                { text: 'My wife will wipe the leaf.',
                  note: 'Four target consonants in six words, two of them word-final, plus a /w/ from T-P5.' }
            ],

            audio: {
                ttsRisk: 'medium',
                ttsRiskWhy: 'A genuinely mixed case. In favour: /f/ and /p/ differ in manner — continuous friction against a stop with a silent gap before it — and a silence is one of the most robust things a bad speaker can reproduce, because it is the absence of signal rather than a fine detail of it. Against: /f/ is, like /θ/, a weak high-frequency voiceless fricative with very little energy, so a tinny speaker at low volume can lose the friction and leave the learner with two sounds that both read as "something happened here". Word-final /f/ (*leaf*, *cuff*, *wife*) is the weakest position and the highest risk. Mid-word items (*coffee/copy*, *suffer/supper*) are the safest, because the surrounding vowels give the ear a frame. Rank this above /θ/–/t/ and below /v/–/w/ for TTS.',
                requiresBundledClip: false,
                clipIds: ['f-p/fan', 'f-p/pan', 'f-p/coffee', 'f-p/copy', 'f-p/fine', 'f-p/pine',
                          'f-p/full', 'f-p/pull', 'f-p/fool', 'f-p/pool', 'f-p/face', 'f-p/pace',
                          'f-p/four', 'f-p/pour', 'f-p/leaf', 'f-p/leap', 'f-p/cuff', 'f-p/cup',
                          'f-p/wife', 'f-p/wipe', 'f-p/suffer', 'f-p/supper'],
                ttsHint: 'Prefer the mid-word pairs — *coffee/copy*, *suffer/supper* — and the stressed word-initial ones before a vowel: *fan/pan*, *fine/pine*, *face/pace*. Treat the word-final items (*leaf/leap*, *cuff/cup*, *wife/wipe*) as bundled-clip-first, because final /f/ is the quietest thing in the set. Tell the learner to raise the volume before deciding their ear is at fault.',
                degradeTo: 'textOnlyFallback'
            },

            textOnlyFallback: {
                mode: 'sort-by-consonant',
                prompt: 'Does this word contain /f/ (teeth on lip, air flowing) or /p/ (both lips, one burst)? Watch the spelling — English writes /f/ four different ways.',
                items: [
                    { word: 'phone',     ipa: '/fəʊn/',       answer: 'f',
                      hint: '"ph" is /f/, never /p/ and never /pʰ/. Also *photo*, *physics*, *elephant*.' },
                    { word: 'enough',    ipa: '/ɪˈnʌf/',      answer: 'f',
                      hint: '"gh" is /f/ here. Also *cough*, *laugh*, *tough*, *rough*.' },
                    { word: 'photograph',ipa: '/ˈfəʊtəɡrɑːf/',answer: 'f',
                      hint: 'Two /f/ sounds, spelled "ph" and then "ph" again. No /p/ anywhere in it.' },
                    { word: 'people',    ipa: '/ˈpiːpl/',     answer: 'p' },
                    { word: 'cupboard',  ipa: '/ˈkʌbəd/',     answer: 'neither',
                      hint: 'Deliberate odd one out: the "p" is silent and the "b" does the work — /ˈkʌbəd/, two syllables.' },
                    { word: 'half',      ipa: '/hɑːf/',       answer: 'f',
                      hint: 'The "l" is silent. Also *calf*, *behalf*.' },
                    { word: 'purple',    ipa: '/ˈpɜːpl/',     answer: 'p' },
                    { word: 'shepherd',  ipa: '/ˈʃepəd/',     answer: 'p',
                      hint: 'Trap in the other direction: this "ph" is **not** /f/, because it sits across a word join (*sheep* + *herd*). Same in *uphill*, *loophole*.' },
                    { word: 'perfect',   ipa: '/ˈpɜːfɪkt/',   answer: 'both',
                      hint: 'One of each: /p/ at the front, /f/ in the middle. Good final self-check — palm in front of your mouth, slap then stream.' }
                ],
                why: 'English writes /f/ as "f", "ff", "ph" and "gh", and Telugu ఫ is an aspirated *p*, so a learner reading "ph" has a real reason to reach for a p-sound. Knowing that "ph" is always /f/ — except across a word join, as in *shepherd* — is a text fact worth having on day one, whatever your ear is doing.'
            },

            discrimination: {
                mode: 'pick-which-word',
                itemsFrom: 'minimalPairs',
                wrongAnswer: 'Replay both slowed, back to back, and name the feature: "*fan* puts your top teeth on your bottom lip and lets the air run; *pan* seals both lips and lets it go in one burst." Then the palm test — stream against slap. If they are producing a strong puff of air from both lips, name that specifically: that is Telugu ఫ, an aspirated p, and the fix is not less puff but a different contact point.'
            },

            productionGate: {
                requiresKey: 'phon:f-p',
                minAccuracy: 0.8,
                minAttempts: 10,
                why: 'FR-PRN-6, applied uniformly. This is the lowest-impact pair in the file (REQUIREMENTS.md §3.1 rates it Low-medium), so it should be scheduled last of the five — but it is gated on the same terms as the rest, because a uniform rule is easier to trust than a set of exceptions.'
            },

            caveats: [
                'Telugu ఫ is described as an aspirated bilabial stop /pʰ/, not a fricative, which is why "ph" spellings invite the wrong sound. A native speaker should confirm that description, and confirm whether ఫ is realised as [f] in some words or registers locally — if it is, the "ph is always /f/" framing in the text-only exercise needs softening.',
                'Do not tell a learner to "blow harder" for /f/. Effort produces aspiration, aspiration is what the Telugu substitute already has, and the harder they push the closer they get to /pʰ/. The instruction is a contact point plus continuous flow, not force.',
                'English /p/ is itself aspirated at the start of a stressed syllable — the *p* in *pan* really does have a puff — so the learner is not wrong about the puff, only about which sound it belongs to. Saying this out loud helps: they have the /pʰ/ already and it is correct where it belongs.',
                'REQUIREMENTS.md §3.1 rates this pair Low-medium impact, the lowest of the five in this file, and *fan* for *pan* is usually recoverable from context. Order it last and do not let the app imply otherwise.',
                '*Laugh/lap* was rejected: /lɑːf/ against /læp/ differs in the vowel as well as the consonant in the British reference accent. *Fig/pig* and *feel/peel* are clean pairs and were left out only to keep the list at a workable length — add them if more items are needed.'
            ],
            tags: ['consonant', 'T-P11', 'f-p', 'contact-point', 'aspiration', 'tts-risk-medium', 'priority-S', 'lowest-impact']
        }
    ]
};
