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

This table is the **original audit**, and its 14 rows drove every phase of the build. The first
five columns are left exactly as audited — they are the record of what was found, and rewriting
them would erase the reason the roadmap looks the way it does. The two right-hand columns are the
running status, re-verified against source on **2026-09-10** (wave 11).

Status is one of:

- **Closed** — the gap no longer exists; the behaviour the audit asked for is in the build and
  reachable by a learner.
- **Partly closed** — the *mechanism* exists and is reachable, but the content, the surface or the
  learner-facing half is incomplete. Read the note: a partly-closed gap is not "nearly done", and
  several of these are ⅒ of the way there.
- **Open** — nothing in the build addresses it yet.

"Reachable by a learner" is the bar deliberately, because several modules in `js/core/` and one
content file are built and never called — see [REQUIREMENTS.md §9.1](REQUIREMENTS.md).
Authored-but-unrendered content counts as partly closed, never closed.

| # | Gap (as audited) | Impact | Effort | Priority | Status | Where it stands (2026-09-10) |
|---|---|---|---|---|---|---|
| 1 | No grammar strand — grammar is tested, never taught | Very high | High | **P1** | **Partly closed** | Grammar is a real section: nav entry, registry row, lesson/notice/decide/contrast/produce views, `gram:` SRS keys, and feedback that gives the reason, a contrast pair and a retry on every wrong answer rather than a verdict. **Content is 3 points authored of the 24 in §3, of which 2 are reachable** — `articles` (no. 3) in `data/grammar.js` and `countable-uncountable` (no. 4) in `data/grammar/countability.js` are wired; `be` (no. 1) exists as `data/grammar/be.js` and is **not in `index.html` or the precache list**, so it self-registers only once someone adds two lines. `grammarLessons.everyday`, `.confident` and `.fluent` are deliberately empty arrays. The teaching machinery is done; the syllabus is ⅛ authored |
| 2 | Speech check is a substring match reporting "Perfect!" | Very high | Low | **P1** | **Closed** | `diffSpeechAttempt()` is a word-level LCS diff; `speechAttemptMessage()` reports *"The recogniser missed 2 of 7 words: thirsty, water"*, and on a full match says *"The recogniser understood every word"* — never "Perfect!", because we have no evidence for that claim. Completion now requires **every** target word matched, so reading a paragraph that happens to contain the word no longer passes, and a miss re-queues the words involved through SRS |
| 3 | Fake IPA from the word generator (`/joyful/`) | High (teaches error) | Low | **P1** | **Closed** | The generator no longer fabricates `/spelling/` as if it were phonetics, and the pronunciation line renders **only** when real phonetics exist (from the dictionary API, or omitted). Authored IPA in the pronunciation files is copied from learner-dictionary sources with the reference accent declared |
| 4 | No pronunciation strand — no minimal pairs, no stress, no schwa | Very high | Medium | **P1** | **Partly closed** | **Minimal pairs: closed.** A real discrimination drill over **8 pair sets / 78 minimal pairs** — 3 vowel sets (T-P7/8/9) in `data/pronunciation/vowels-stress.js` and 5 consonant sets (T-P5, T-P6 ×2, T-P10, T-P11) in `consonants.js`, both loaded and precached. Per-pair `phon:` SRS, production gated at 80% discrimination measured on *first* answers so the gate cannot be ground open, a miss replays both words slowed **at one matched rate** and names the differing feature, and there is a text-only path for a device that cannot render the contrast. **Stress and prosody: authored, no surface.** The 21 word-stress items and 15 rhythm / final-vowel / cluster noticing items in `vowels-stress.js` are rendered nowhere — the section reads only `.pairs`. **Not started:** the 44-phoneme inventory (§3 part 1), connected speech (part 6) and intonation (part 7). And `AS-3` — whether device TTS distinguishes these pairs audibly at all — is **still unvalidated on a real phone**, which is why every set carries a `ttsRisk`, a `degradeTo` and a no-audio fallback |
| 5 | No listening comprehension questions | High | Low | **P2** | **Open** | The comprehension questions that exist belong to the **reading** passages. Listening is still: play a TTS sentence, record, run the recogniser. `FR-LSN-1` has no surface, and the session sequencer marks `listen.comprehend` unavailable for exactly this reason |
| 6 | No free-speaking prompts or fluency metrics | Very high | Medium | **P2** | **Open** | No `speakingPrompts` content, no prompt/timer/record surface (`FR-SPK-3`), no shadowing mode (`FR-SPK-8`), no fluency trend (`FR-SPK-5`). The **only** spoken-production surface in the build is grammar's *say it aloud* self-check — which is why the sequencer's production step has to fall back to it, and why that fallback is reported rather than hidden |
| 7 | Level names unordered and not CEFR-mapped; no placement test | Medium | Low | **P2** | **Partly closed** | **Naming: closed.** `js/core/levels.js` is the single source of truth — `foundation` (A1–A2), `everyday` (B1), `confident` (B2), `fluent` (C1), each with an explicit `order`, plus permanently-kept legacy aliases so an old backup still restores. The rename shipped with a migration that rewrote **exercise ids**, so completion history survived. **Placement test: does not exist** (`FR-SES-2`); `OQ-5` defers its scoring thresholds until there are enough grammar and pronunciation items to draw from |
| 8 | No functional / situational dialogues | High | Medium | **P2** | **Open** | No dialogue content of any kind. This is P1's and P3's most-wanted item (stand-ups, client calls, GDs, interviews) and it is untouched |
| 9 | Generated content is semantically empty ("The penguin meanders madly at the estuary"); generated definitions are boilerplate | Medium | Medium | **P3** | **Open (less harmful)** | Word-bank sentence assembly and generated vocabulary padding are both still there. What changed is that generated entries no longer **fabricate phonetics** (gap 3), so they mislead less; they still do not teach. Curated-first ordering is honoured — the sentence builder reads the curated list before generating — which is `FR-CNT-4`'s rule, but the padding itself is unimproved |
| 10 | Curated content thin: 5 sentence exercises and ~2 passages per level | Medium | High | **P3** | **Partly closed — and the thinness moved** | Vocabulary, sentences and reading are as audited. What has been added is depth in the two *new* strands: each grammar point carries 3 contrast pairs, 6 practice items and a production task, and pronunciation carries 78 minimal pairs plus 21 stress and 15 noticing items. So content is no longer uniformly thin — it is thin in the old sections and thin-by-count-of-points in grammar (3 of 24, 2 reachable), while pronunciation's authored volume now **exceeds what the app renders** |
| 11 | No collocation / word-family / register fields on vocabulary | Medium | Medium | **P3** | **Open** | No such fields on any vocabulary entry. `PROJECTORS.coll` exists in `js/core/srs.js` and `data/collocations.js` does not — the scheduler is ready for a content type nobody has authored |
| 12 | No mistake log — recurring errors are never surfaced | Medium | Medium | **P3** | **Partly closed** | `js/core/mistakes.js` ships the taxonomy as **data** (so a second L1 is `registerCategories()`, not a code change), keyed back to the interference tables in `REQUIREMENTS.md` §3, and it grades evidence strength so a recogniser miss is never counted as a graded wrong answer. The grammar and pronunciation sections call `Mistakes.record()`. **But `topCategories()` is never rendered** — there is no top-5-in-30-days view, which is `FR-SRS-3`'s actual acceptance criterion and the whole of what P4 came for. Errors are now logged and still not surfaced |
| 13 | No session sequencing; learner must self-direct | Medium | Low | **P3** | **Closed** | `js/core/session.js` plans the §4 session — ≥3 strands, ending in production, count-boxed, no menu choices — and `app.js` now walks it from a `#sessionPanel` card on the Dashboard with a **"Start today's session"** button, per-step rendering, an `aloud`/`silent`/`skip` production route and the `FR-SES-5` wrap-up. Critically it **prints `plan.shortfall` and `plan.omitted` on screen** rather than swallowing them, so the session tells the learner what this build cannot yet give them. What remains is not sequencing: it is the missing surfaces those shortfall lines name — gaps 5 and 6 |
| 14 | Single TTS voice, single accent, fixed speed | Low | Low | **P4** | **Partly closed** | **Speed: closed.** Playback rate is now chosen per call — 0.6 for a slow pronunciation replay, 0.8 for dictation, 0.9 for a listening model, 1.0 normal — and the discrimination drill deliberately plays *both* words of a compared pair at one matched rate, so a learner never judges a fast clip against a slow one. **Voice and accent: unchanged.** `utterance.lang` is hardcoded `'en-US'` with no `getVoices()` selection, which now also collides with content authored to a **British** reference IPA; the content files carry `ameNote` / `caveats` for the divergences rather than hiding them |

**Net position.** Three of the four `P1` gaps are closed or have their mechanism closed (2, 3, and
the minimal-pair half of 4); the two `P1` content gaps (1 and the rest of 4) are now bounded
authoring work rather than open design questions. The `P2` speaking and listening gaps (5, 6, 8) are
**untouched and are now the largest hole in the app**, and they matter more than they did at audit
time: the session sequencer (gap 13) is live and needs those surfaces to plan the session §4
describes, so it now names their absence to the learner as a shortfall line **every time it builds a
plan**. The app is honest about the hole, which is the right behaviour and not a substitute for
filling it.

Two failure modes this table is meant to make visible, because both are new since the audit:

1. **Authored content with no surface, or no script tag.** Word stress, prosody noticing and the
   mistake-log top-5 view are all built and invisible; grammar point 1 (`be`) is authored and not
   loaded at all. Content that no screen draws teaches nobody, and it is easy to mistake for
   progress because the files are large and correct.
2. **Correctly scheduled records with nothing to draw them.** `gram:` and `phon:` items are
   scheduled properly by `js/core/srs.js`, and the review screen walks vocabulary only, so due
   grammar and pronunciation records accumulate unseen. This is one defect in one surface, and it
   silently undoes part of gaps 1, 4 and 12 at once.

All P1 items work within the project's client-only, `localStorage`-only constraint.
Nothing above requires a backend except automated pronunciation *scoring*, which is
deliberately replaced here by discrimination drills plus self-assessment rubrics.

> **Note on §3.** The strand headings above still carry the audit's own language — "does not
> exist", "barely exists". Strands B and C now exist as sections; read those parentheticals as the
> audit's snapshot, and this table for where each strand actually stands.

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
