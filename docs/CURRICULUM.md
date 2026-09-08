# 🎓 Curriculum — English Learning Portal

This is the **syllabus document**: what a learner is supposed to be able to *do* after
using this app, in what order, and which strand of the app teaches it.

It is written from a spoken-English teaching perspective, not an engineering one.
The companion docs are [TEACHING_METHODOLOGY.md](TEACHING_METHODOLOGY.md) (how we
teach and give feedback) and [CONTENT_AUTHORING_GUIDE.md](CONTENT_AUTHORING_GUIDE.md)
(how to add content without breaking the pedagogy).

---

## 1. Who this is for

The target learner is an adult or older teen who:

- can read English but **freezes when speaking**,
- learned English through written exams, so has grammar *knowledge* but no grammar *habit*,
- is understood by their own community but not always by outsiders (pronunciation),
- has 15–20 minutes a day and no teacher in the room.

Design consequence: **speaking output must be produced in every session**, not just
recognised. Recognition tasks (multiple choice, matching) are warm-ups, never the goal.

---

## 2. Level framework

### 2.1 Current state (needs fixing)

The code uses three difficulty keys: `basic`, `intermediate`, `medium`.
This is not an ordered scale — "medium" reads as *below* "intermediate" to most people,
and neither maps to anything a learner can self-assess against.

### 2.2 Target framework — CEFR-aligned

| App level | CEFR | Learner can-do statement |
|---|---|---|
| `foundation` | A1–A2 | Introduce myself, ask and answer simple questions about family, work, daily routine. Speak in short present-tense sentences. |
| `everyday`   | B1    | Handle most day-to-day situations — shops, travel, appointments. Tell a story in the past. Give simple opinions and reasons. |
| `confident`  | B2    | Take part in a discussion, disagree politely, explain a process at work, handle an interview. Speak for 2 minutes on a familiar topic without stopping. |
| `fluent`     | C1    | Speak spontaneously and precisely, use idiom and register appropriately, restructure mid-sentence when I hit a wall. |

Rename plan: `basic → foundation`, `intermediate → everyday`, `medium → confident`,
plus a new `fluent` tier. Keep the old keys as aliases for one release so saved
progress in `localStorage` does not break.

### 2.3 Placement

There is currently **no placement test** — a learner must guess their own level.
A 12-item placement check (4 listening, 4 grammar-in-context, 2 spoken prompts scored
by length and hesitation, 2 vocabulary depth) should set the starting level once and
be re-offered every 30 active days.

---

## 3. The five strands

Every session should touch **at least three** strands, and one of them must be Speaking.

### Strand A — Vocabulary (`vocabulary` section)

**Currently:** 61 hand-written entries (27 foundation / 17 everyday / 17 confident) with
IPA, definition, example, and one multiple-choice check. Beyond entry 61 the app
generates words algorithmically. Spaced repetition (`js/core/srs.js`, SM-2) is wired
in and drives a "Review Due" queue.

**What good vocabulary teaching needs that is missing:**

- **Word families, not single words.** A learner who knows *decide* should meet
  *decision, decisive, decisively, undecided* together — that is how the mental
  lexicon actually stores them.
- **Collocation.** *make a decision*, not *do a decision*. Collocation errors are the
  single most common reason an advanced learner still sounds foreign. No field exists
  for this today.
- **Productive recall, not recognition.** The current quiz shows four definitions and
  asks the learner to pick one. That tests reading. Add a *produce-the-word* card:
  show definition + gap sentence, learner types or **says** the word.
- **Register labels.** *kids / children / offspring* are not interchangeable. Mark each
  entry `informal | neutral | formal`.
- **Frequency ordering.** Words should be introduced roughly in frequency order
  (a general service list), not alphabetically or arbitrarily.

**Known defect:** the algorithmic generator writes `pronunciation: "/" + word + "/"`
(`app.js:1349`), producing fake IPA like `/joyful/`. This teaches learners that IPA is
just the spelling in slashes. Generated words must either carry real IPA or show no
pronunciation field at all.

### Strand B — Grammar (**does not exist**)

This is the largest hole in the curriculum. A search for "grammar" across `app.js` and
`index.html` returns nothing. Grammar is currently only *tested*, incidentally, by the
fill-in-the-blank inside the Sentences strand — and when a learner picks *is* for
"I ___ happy today", they are told they are wrong and given no rule, no contrast,
no second chance. That is assessment without teaching.

**Proposed grammar syllabus** (each item = a short explanation, 3 contrast pairs,
6 practice items, and one *say it aloud* production task):

**Foundation (A1–A2)**
1. `be` — am / is / are, and contractions in speech (*I'm*, not *I am*)
2. Present simple vs present continuous — habit vs right now
3. Articles a / an / the / zero — the classic Indian-English pressure point
4. Countable vs uncountable — *advice*, *information*, *furniture* take no plural
5. Past simple — regular *-ed* and the 40 irregulars that carry most conversation
6. Question formation — auxiliary inversion, *Do you…?* not *You are knowing…?*
7. Prepositions of time and place — in / on / at
8. Modals of ability and request — can / could / may

**Everyday (B1)**
9. Present perfect vs past simple — *I have seen* vs *I saw* (the hardest contrast for most learners)
10. Future forms — will / going to / present continuous for arrangements
11. Comparatives and superlatives
12. Gerund vs infinitive — *enjoy doing* / *want to do*
13. First and second conditionals
14. Reported speech
15. Passive voice — and when *not* to use it in speech
16. Relative clauses — who / which / that

**Confident (B2)**
17. Third conditional and mixed conditionals
18. Modals of deduction — must be / can't be / might be
19. Perfect continuous aspects
20. Phrasal verbs by particle, with separability rules
21. Discourse markers — *actually*, *mind you*, *having said that*
22. Cleft sentences and fronting for emphasis
23. Hedging and softening — *I'd say*, *it tends to*, *sort of*

**Fluent (C1)**
24. Inversion for emphasis, subjunctive remnants, nuanced article use with abstract nouns

Each grammar point should be an **SRS item in its own right**, not just a lesson —
a point the learner got wrong should come back in 1 day, 3 days, 7 days.

### Strand C — Pronunciation & Phonetics (**barely exists**)

Today: IPA strings on curated vocabulary entries, and browser text-to-speech that reads
a sentence at a fixed rate. That is exposure, not training. There is no phonetics
teaching anywhere in the app.

**Proposed pronunciation syllabus:**

1. **The sound inventory** — 44 English phonemes, each with a mouth-position note,
   3 example words, and a listen-and-compare recording.
2. **Minimal pairs** — the diagnostic tool of pronunciation teaching. Priority sets for
   South-Asian first languages:
   - /v/ vs /w/ — *vine / wine*
   - /θ/ vs /t/ and /ð/ vs /d/ — *thin / tin*, *then / den*
   - /ɪ/ vs /iː/ — *ship / sheep*
   - /æ/ vs /e/ — *bad / bed*
   - /ɒ/ vs /əʊ/ — *cot / coat*
   - /s/ vs /ʃ/ — *sea / she*
   - /f/ vs /p/ (aspiration) — *fan / pan*
   - final consonant clusters — *asked*, *texts*, *worlds*
3. **Word stress** — mark the stressed syllable on every vocabulary entry
   (`PHOtograph / phoTOGrapher / photoGRAPHic`). Wrong stress breaks comprehension
   faster than a wrong vowel.
4. **The schwa /ə/** — the most common English sound and the one most often
   over-pronounced by learners reading spelling. *comfortable* = /ˈkʌmftəbl/.
5. **Sentence stress and rhythm** — content words stressed, function words weak.
   This is what makes speech sound English rather than syllable-timed.
6. **Connected speech** — linking (*an apple* → *anapple*), elision (*next day* →
   *nex' day*), assimilation, contractions. Learners who never practise this
   understand written English but not spoken English.
7. **Intonation** — falling for statements and wh-questions, rising for yes/no
   questions, fall-rise for politeness and doubt.

Delivery inside a static app: minimal-pair **discrimination** drills (hear one, pick
which word) need no server and are the highest-value pronunciation feature available
offline. Production drills use the existing recorder plus a self-check rubric.

### Strand D — Listening (`listening` section, currently half-built)

Today: 30 sentences read by text-to-speech, plus a record-your-voice button and a
speech-recognition check.

**Missing:**
- **Comprehension.** There is no listening question anywhere — no gist question, no
  detail question, no inference question. Listening is currently only a model for
  repetition, so listening *skill* is untrained.
- **Speed grading.** Real speech is fast and reduced. Offer 0.75× / 1.0× / 1.25× and
  push learners toward 1.0× and above; the API already accepts a `rate` argument
  (`speechAPI.speak(text, rate)`), it is simply never varied.
- **Longer audio.** Single sentences never build the working memory needed to follow a
  90-second announcement or a phone call.
- **Dictation in this strand.** Dictation exists but only inside Reading. Dictation is
  fundamentally a listening exercise and belongs here too.
- **Natural voices and multiple accents.** One `en-US` voice teaches one accent.

### Strand E — Speaking (the weakest strand relative to the app's stated purpose)

Today, "speaking" is: (a) record yourself and listen back, with no comparison or
rubric; (b) a speech-recognition check that does
`transcript.toLowerCase().includes(target.toLowerCase())` and prints **"✓ Perfect!"**
(`app.js:2482`).

Three problems with that check:
1. A substring match is not pronunciation assessment. Say a whole paragraph containing
   the word and it passes. Say the word with wrong stress and the recogniser will often
   normalise it and still pass.
2. "Perfect!" is a false promise. Speech recognition tells you *whether the recogniser
   guessed your word*, not whether a human would understand you.
3. The target word is picked at random from the vocabulary list on every load
   (`app.js:2338–2340`) — unrelated to the sentence just heard and unrelated to the SRS
   queue, and it re-randomises on navigation so a learner cannot retry a sound they
   failed.

**What a speaking strand needs:**

1. **Shadowing** — play a model, learner speaks *along with* it, not after. The single
   most effective solo technique for rhythm and intonation.
2. **Read-aloud with word-level diff** — compare the transcript against the target
   word by word, highlight the mismatches, and report *which words* the recogniser
   missed rather than a pass/fail.
3. **Free production prompts** — "Describe your morning routine", "Tell me about a time
   you were late", graded by level. Record, self-review against a rubric, keep the
   recording.
4. **The 4/3/2 fluency technique** — say the same content in 4 minutes, then 3, then 2.
   Proven to build fluency without a partner.
5. **Functional dialogues** — the app teaches no situational English at all. Needed:
   introductions and small talk, phone calls, ordering and shopping, directions,
   appointments, job interviews, meetings and stand-ups, complaints, apologising,
   agreeing and disagreeing politely, presenting a status update.
6. **Fluency metrics** — words per minute, filler count, pause count. Show the trend
   over weeks; that is the number a self-study learner can actually move.
7. **A recording archive** — keep the last N recordings per prompt so a learner can hear
   month-one against month-three. Nothing motivates like that comparison.

### Strand F — Reading & Writing (partial)

Reading: 5 curated passages total (2 / 2 / 1) with 3 comprehension questions each, plus
generated passages. Thin, and the questions are all literal recall — no inference, no
vocabulary-in-context, no "what does *it* refer to in line 3".

Writing exists only as word-ordering. For a spoken-English course that is acceptable
as a low priority, but **sentence transformation** ("Rewrite in the passive", "Make this
polite") is cheap to build and directly improves speech, because it drills the same
structural flexibility speaking requires.

---

## 4. Session design

A learner opening the app should be given a **20-minute session**, not a menu of six
sections. Recommended shape:

| Minutes | Activity | Strand |
|---|---|---|
| 3 | SRS review — words and grammar points due today | A + B |
| 4 | New grammar point + contrast pairs | B |
| 3 | Minimal-pair discrimination drill | C |
| 4 | Listen → comprehension question → shadow the model | D + E |
| 5 | Free speaking prompt, recorded, self-reviewed | E |
| 1 | Streak, fluency trend, tomorrow's preview | — |

The current dashboard tracks daily goals per section but does not sequence anything.
A "Start today's session" button that walks this path would raise completion more than
any new content.

---

## 5. Gap summary and priority

| # | Gap | Impact | Effort | Priority |
|---|---|---|---|---|
| 1 | No grammar strand — grammar is tested, never taught | Very high | High | **P1** |
| 2 | Speech check is a substring match reporting "Perfect!" | Very high | Low | **P1** |
| 3 | Fake IPA from the word generator (`/joyful/`) | High (teaches error) | Low | **P1** |
| 4 | No pronunciation strand — no minimal pairs, no stress, no schwa | Very high | Medium | **P1** |
| 5 | No listening comprehension questions | High | Low | **P2** |
| 6 | No free-speaking prompts or fluency metrics | Very high | Medium | **P2** |
| 7 | Level names unordered and not CEFR-mapped; no placement test | Medium | Low | **P2** |
| 8 | No functional / situational dialogues | High | Medium | **P2** |
| 9 | Generated content is semantically empty ("The penguin meanders madly at the estuary"); generated definitions are boilerplate | Medium | Medium | **P3** |
| 10 | Curated content thin: 5 sentence exercises and ~2 passages per level | Medium | High | **P3** |
| 11 | No collocation / word-family / register fields on vocabulary | Medium | Medium | **P3** |
| 12 | No mistake log — recurring errors are never surfaced | Medium | Medium | **P3** |
| 13 | No session sequencing; learner must self-direct | Medium | Low | **P3** |
| 14 | Single TTS voice, single accent, fixed speed | Low | Low | **P4** |

All P1 items work within the project's client-only, `localStorage`-only constraint.
Nothing above requires a backend except automated pronunciation *scoring*, which is
deliberately replaced here by discrimination drills plus self-assessment rubrics.

---

## 6. A note on the honest limits of a static app

Without a server we cannot do real pronunciation scoring, cannot grade free speech, and
cannot correct a learner's written paragraph. Pretending otherwise — as "✓ Perfect!"
currently does — costs more than admitting it. The right posture is:

> "The recogniser heard *ship* when you said *sheep*. Listen to both and try again."

That is truthful, actionable, and needs no AI. Reserve model-graded feedback for the
day a backend exists, and until then lean on **discrimination, self-recording, and
rubrics** — which is, incidentally, what good language teachers used long before
software existed.
