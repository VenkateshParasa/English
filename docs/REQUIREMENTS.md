# 📐 Requirements — English Learning Portal

**What** this product must do and **why**. This document is stable; it changes when the product
intent changes, not when the plan does.

Companions: [PROGRESS.md](PROGRESS.md) (state of play, open decisions) ·
[PRODUCT_BACKLOG.md](PRODUCT_BACKLOG.md) (when and in what order) ·
[CURRICULUM.md](CURRICULUM.md) (syllabus) ·
[TEACHING_METHODOLOGY.md](TEACHING_METHODOLOGY.md) (pedagogy contract) ·
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (build plan)

**Version:** 1.2 · **Date:** 2026-09-10

> **1.2 (wave 11 reconciliation)** — three changes, all where the build had moved past this
> document again. **`FR-SES-1`** is expanded from one acceptance row into a specified module: the
> session sequencer shipped as `js/core/session.js` and made three product decisions this
> requirement did not anticipate — it is **count-boxed, not time-boxed**; it resolves the
> `BR-2`/`FR-A11Y-4` contradiction by treating **silent production as production** and reporting
> the route; and it **refuses to shorten a plan silently**. Those decisions are correct and are now
> requirements rather than code comments. **`BR-2`** is amended to say *production*, not
> *audibility*, which is what makes it satisfiable alongside `FR-A11Y-4`. **§9.1** adds a
> **module map**, because six shipped `js/core/` modules were not named anywhere in this document.
> Separately, `OQ-10` (the interval ladder) is **resolved**: `js/core/srs.js` now implements the
> fixed `1 → 3 → 7 → 16 → 35` ladder holding at its last rung, so `FR-SRS-2` states the shipped
> rule and keeps the discrepancy and both options' consequences as recorded history.

> **1.1 (wave 6 reconciliation)** — two changes, both where six waves of implementation had moved
> past this document. `FR-DATA-6` / `OQ-6`: the recording-eviction rule is amended from
> oldest-beyond-N to **pinned baseline + N−1 most recent**, because the original rule destroyed
> the feature it served (the code was right; the requirement was wrong). `FR-SRS-2`: the interval
> ladder specified here has never matched the shipped scheduler, so **both ladders are now stated
> and the choice is an open decision** (`OQ-10`, implemented by `US-131`) rather than being
> silently resolved in favour of the code.

**Identifier scheme:** `BR-#` business · `FR-<STRAND>-#` functional · `NFR-#` non-functional ·
`CON-#` constraint · `AS-#` assumption · `OQ-#` open question.
Strand codes: `VOC` vocabulary · `GRM` grammar · `PRN` pronunciation · `LSN` listening ·
`SPK` speaking · `RDW` reading & writing · `SRS` scheduler · `SES` session · `DATA` data ·
`A11Y` accessibility · `CNT` content authoring.

**Priority:** `M` must · `S` should · `C` could · `W` won't (this release).

---

## 1. Business context

### 1.1 The problem

An adult who can read English, passed English exams, writes it acceptably at work — and **freezes
when speaking**. They have grammar *knowledge* without grammar *habit*. They are understood inside
their own community but not always outside it. They have 15–20 minutes a day and no teacher in the
room ([CURRICULUM.md §1](CURRICULUM.md)).

This is not a knowledge gap. It is a **production and confidence gap**, and it is not what most
software addresses.

### 1.2 Why the alternatives do not fit

| Alternative | Why it fails this learner |
|---|---|
| A tutor or spoken-English class | Cost, scheduling, travel, and the embarrassment that stops adults enrolling in the first place |
| Duolingo-class apps | Recognition-heavy — tapping the right option from four. Little unscripted production, no pronunciation diagnosis |
| YouTube lessons | Input without output. No feedback, no spaced review, no record of what you got wrong |
| AI speaking tutors | Effective, but need a paid backend, a live connection, and send your voice to a server |

### 1.3 The wedge

**Honest, offline, speaking-first practice with spaced repetition, free and private.**

Four properties, in priority order:

1. **Speaking-first** — every session produces speech that was not read off the screen.
2. **Honest** — the app never claims accuracy it does not have. A static app cannot score
   pronunciation, so it says what the recogniser heard and hands the learner a rubric
   ([CURRICULUM.md §6](CURRICULUM.md)). Honesty is a **feature**: overstated praise is the fastest
   way to fossilise an error.
3. **Offline and private** — works on a patchy connection; recordings never leave the device.
4. **Spaced** — what you got wrong comes back tomorrow, in 3 days, in 7.

### 1.4 Business requirements

| # | Requirement | Priority |
|---|---|---|
| **BR-1** | A learner completes a useful 15–20 minute session **without choosing what to practise** | M |
| **BR-2** | Every session produces **unscripted spoken output** — *production*, not *audibility* | M |
| **BR-3** | The app **never overstates** what it knows about the learner's accuracy | M |
| **BR-4** | Full core function **offline**, on a mid-range Android phone | M |
| **BR-5** | Errors are **diagnosed by type** and resurfaced by spaced repetition | M |
| **BR-6** | Teaching is targeted at a learner's **first language** (Telugu first) | M |
| **BR-7** | Learner data is **portable and recoverable** — never silently lost to a migration | M |
| **BR-8** | Progress is **visible over weeks**, not just today | S |
| **BR-9** | Zero running cost; no accounts, no server, no third-party analytics | M |
| **BR-10** | A second first language can be added as **content, not code** | S |

**Amendment (wave 11) — `BR-2` is about production, not audibility.** As originally worded, `BR-2`
("every session produces unscripted spoken output") read as a hard requirement that the learner
make a *sound*, which put it in direct contradiction with `FR-A11Y-4` ("every speaking task has a
silent / skip-and-mark-done path"). Both are `M`, so a contradiction between them is not
resolvable by priority — one of the two wordings had to be wrong. The sequencer
(`js/core/session.js`, `resolveSilentTension()`) resolved it by drawing the distinction this
document had left implicit:

> The thing that transfers is **composing the utterance**, not vibrating the air. A learner who
> reads a prompt, builds an unscripted answer and produces it sub-vocally, in a whisper, or by
> typing it has done the language work. A learner who skips the prompt has not.

So `BR-2` requires unscripted **production**; `FR-A11Y-4` governs the **channel** it is produced
through. See `FR-SES-1` below for the three completion routes, which one does *not* satisfy `BR-2`,
and why the app reports the route rather than laundering it. This also fixes what metric `M-1`
measures: not "did audio happen", but "did an unscripted production route complete".

---

## 2. Personas

Four learners spanning the four CEFR tiers in `js/core/levels.js`, plus one non-learner
stakeholder. All are Telugu L1.

### P1 — Ravi, 29, Hyderabad · `confident` (B1→B2)

Software engineer, 6 years' experience. Writes flawless Jira tickets and design docs. In stand-up
he rehearses one sentence in his head and then says a shorter version of it. On client calls he
lets the manager speak. Turned down a team-lead conversation partly because it meant presenting.

- **Wants:** to speak for two minutes without stalling; to disagree politely in a meeting.
- **Blocker:** knows the words, cannot retrieve them in real time under mild social pressure.
- **Pattern:** 15 min on the phone, on the commute, most weekdays.
- **Drives:** `FR-SPK-4` functional dialogues (meetings, stand-ups), `FR-SPK-5` fluency metrics,
  `FR-GRM-*` discourse markers and hedging, `FR-SES-1` session sequencer.

### P2 — Lakshmi, 34, Vijayawada · `foundation` (A1→A2)

Telugu-medium schooling, learned English by grammar-translation. Returning to work after a career
break; the family may relocate. Can read a form, cannot ask a question at a school meeting.
**Practises at 10pm when the house is quiet — she cannot speak aloud without being overheard.**

- **Wants:** to handle a shop, an appointment, a parent-teacher meeting.
- **Blocker:** produces nothing aloud. Also, embarrassment — she will abandon anything that feels
  like a test she is failing.
- **Pattern:** 20 min at night, phone, headphones, silent.
- **Drives:** `FR-A11Y-4` **silent / skip-and-mark-done path for every speaking task** — the
  requirement no other persona surfaces — plus `FR-GRM-1` foundation grammar habit,
  `FR-SPK-4` everyday dialogues, and the tone rules in `NFR-15`.

### P3 — Sandeep, 21, Warangal · `everyday` (B1)

Final-year engineering student, campus placement season. Group discussions and HR interviews are
weeks away. Budget Android, 3GB RAM, prepaid data he rations. Hostel wifi is unreliable.

- **Wants:** to get through a GD and an interview without freezing.
- **Blocker:** a hard external deadline and no time to waste on a curriculum that meanders.
- **Pattern:** 30–40 min in bursts, offline as often as online.
- **Drives:** `NFR-1`–`NFR-6` (offline, performance, low-end device), `FR-SPK-4` interview and GD
  dialogues, `FR-SPK-3` 2-minute topic speaking.

### P4 — Anusha, 41, Bengaluru · `fluent` (C1)

Team lead, 15 years of fluent working English. Presents to clients comfortably. But she still says
*"I am having a doubt"*, drops articles under pressure, stresses *phoTOgrapher* wrongly, and
merges /v/ and /w/. Nobody has ever told her. She does not need lessons; she needs a **diagnosis**.

- **Wants:** to know what specifically marks her out, and to fix a short list.
- **Blocker:** a plateau. Generic lessons are beneath her and she will quit in one session.
- **Pattern:** 10 min, irregular, wants signal not exercises.
- **Drives:** `FR-SES-2` placement test, `FR-SRS-3` **mistake log by error type**, `FR-PRN-2`
  per-phoneme accuracy profile, `FR-SPK-6` recording archive for week-over-week comparison.

### P5 — Content author (project maintainer) · non-learner

Adds vocabulary, grammar points and drills, alone, in evenings. Needs schemas that fail loudly
rather than silently, and a checklist that prevents shipping pedagogically broken items.

- **Drives:** `FR-CNT-1`–`FR-CNT-3`, `NFR-13` content validation, and the authoring rules in
  [CONTENT_AUTHORING_GUIDE.md](CONTENT_AUTHORING_GUIDE.md).

### 2.1 What the personas jointly demand

| Because of | The product must |
|---|---|
| P2 practising silently | Never make speaking a hard gate; always offer a silent path |
| P3's data rationing | Treat every network call as optional enhancement |
| P4's plateau | Lead with diagnosis, not lessons, for high-level learners |
| P1 and P4 both | Report *specific* errors, never a score |
| P2 and P4 both | Never mark a defensible alternative wrong |

---

## 3. Telugu L1 interference

This section is the reason the product is not language-neutral. Each row is a teachable item, and
each maps to a functional requirement.

### 3.1 Phonological transfer

Extends the South-Asian priority list in [CURRICULUM.md §3](CURRICULUM.md) Strand C.

| # | Interference | Example | Intelligibility impact | Priority |
|---|---|---|---|---|
| T-P1 | **Syllable-timed rhythm.** Telugu is syllable/mora-timed; English is stress-timed. Every syllable gets equal weight and the schwa is over-pronounced | *comfortable* as *com-for-ta-ble*, not /ˈkʌmftəbl/ | **Highest** — breaks comprehension faster than any single wrong sound | M |
| T-P2 | **Final-vowel epenthesis.** Telugu is strongly CV-structured, so English final consonants attract a vowel | *bus* → "bus-u", *dog* → "dog-u" | High | M |
| T-P3 | **Cluster breaking** | *asked* → "ask-ed", *films* → "fil-ims", *texts* → "tex-its" | High | M |
| T-P4 | **Word-stress misplacement.** Telugu stress is weight-predictable; English lexical stress must be learned per word | *phoTOgrapher* / *PHOtograph* confusion | High | M |
| T-P5 | /v/ ~ /w/ — Telugu వ covers both | *vine* / *wine* | Medium-high | M |
| T-P6 | /θ/, /ð/ absent → dental త / ద | *thin* / *tin*, *then* / *den* | Medium | M |
| T-P7 | /ɪ/ ~ /iː/ | *ship* / *sheep* | Medium | M |
| T-P8 | /æ/ ~ /e/ | *bad* / *bed* | Medium | S |
| T-P9 | /ɒ/ ~ /əʊ/ | *cot* / *coat* | Medium | S |
| T-P10 | /z/ absent → /dʒ/ or /s/ | *zoo* → "joo" | Medium | S |
| T-P11 | /f/ ~ /p/ aspiration | *fan* / *pan* | Low-medium | S |
| T-P12 | Retroflex /t/, /d/ for alveolar | marks accent | **Low — deliberately excluded.** Target intelligibility, not accent | W |

**T-P12 is a scope exclusion with a reason.** Retroflex stops identify a speaker as Indian but
rarely block understanding. Chasing accent trades effort for shame and buys no comprehension.

### 3.2 Grammatical transfer

Each maps to a numbered grammar point in [CURRICULUM.md §3](CURRICULUM.md) Strand B.

| # | Interference | Example error | Grammar point | Priority |
|---|---|---|---|---|
| T-G1 | **No articles in Telugu** | *"I went to shop"*, *"He is the engineer"* | 3 — articles | M |
| T-G2 | **Copula dropping** — Telugu equational sentences need no *be* (*nenu doctor*) | *"I doctor"*, *"He very good"* | 1 — `be` | M |
| T-G3 | **Stative progressive** | *"I am knowing"*, *"I am having two brothers"* | 2 — present simple vs continuous | M |
| T-G4 | **Uncountables pluralised** | *"informations"*, *"advices"*, *"furnitures"* | 4 — countable/uncountable | M |
| T-G5 | **Invariant tag question** — from *kadā* | *"You are coming, isn't it?"* | 6 — question formation | M |
| T-G6 | **Perfective aspect mismatch** | *"I have gone yesterday"* | 9 — present perfect vs past simple | M |
| T-G7 | **Postposition → preposition** | *"discuss about"*, *"return back"*, *"cope up with"* | 7 — prepositions | S |
| T-G8 | **SOV residue** in questions and embedded clauses | *"You know where is the station?"* | 6 — question formation | S |
| T-G9 | **Indian-English register items** | *"doubt"* for *question*, *"out of station"*, *"cousin brother"* | Strand A register labels | S |

### 3.3 The L1 profile must be data, not code

**`FR-CNT-3`** — L1 interference lives in a declarative profile file so a second language is a
content addition (`BR-10`).

Required shape (classic script, no modules, per `CON-4`):

```
data/l1/telugu.js  →  const L1_TELUGU = {
    id: 'telugu',
    phonemePairs:   [{ pair: 'v-w', words: ['vine','wine'], priority: 'M', articulatoryCue: '...' }, ...],
    grammarTransfer:[{ id: 'T-G1', grammarPoint: 'articles', wrongForms: [...], note: '...' }, ...],
    registerSwaps:  [{ avoid: 'doubt', prefer: 'question', context: 'formal' }, ...]
}
```

`articulatoryCue` is load-bearing, not decorative — see `FR-PRN-4`.

---

## 4. Goals and success metrics

### 4.1 North star

**Weekly minutes of speech produced per active learner.**

Chosen because it is the only number that moves when the product does its actual job. Streaks,
sessions and words-learned can all rise while the learner still cannot talk.

### 4.2 Supporting metrics

| # | Metric | Source | Why |
|---|---|---|---|
| M-1 | % of sessions containing ≥1 unscripted spoken production, **split by route** (`aloud` / `silent`) | session log (`Session.productionSummary()`) | Direct test of `BR-2`. A `skipped` production counts as **no** production, so the metric cannot be inflated by the `FR-A11Y-4` escape hatch |
| M-2 | D7 / D30 return rate | local streak data | Habit is the precondition for everything else |
| M-3 | Sessions per week vs the 15–20 min/day assumption | local | Tests `AS-1` |
| M-4 | SRS due-queue completion rate against the ≤20/day cap | `srsData` | An unmanageable backlog is the top reason SRS apps get abandoned |
| M-5 | Level promotion rate against the `TEACHING_METHODOLOGY.md §4` thresholds | progress | Tests whether the syllabus actually advances people |
| M-6 | Words per minute, trend | fluency log | The one number a solo learner can move |
| M-7 | Top-5 recurring mistake decay over 30 days | mistake log | Tests `BR-5` |
| M-8 | Per-phoneme discrimination accuracy | `srsData` `phon:` keys | P4's diagnosis |

### 4.3 The measurement constraint — stated plainly

**`CON-2` (client-only, no telemetry) means none of the above can be measured centrally.** There
is no analytics backend and adding one would breach `BR-9` and `NFR-14`.

Resolution:

- **`FR-DATA-3`** — compute all metrics locally and surface them to the learner. They are feedback
  first, instrumentation second.
- **`FR-DATA-4`** — a manual "export my stats" JSON, so beta testers can send numbers deliberately.
- Product decisions in this release are therefore made from **qualitative feedback plus the
  maintainer's own use**, not dashboards. `OQ-2` covers whether that changes.

Targets are deliberately unset — see `OQ-1`.

---

## 5. Scope

### 5.1 In scope

Vocabulary with productive recall · the grammar strand (24 points) · pronunciation via
discrimination, stress and schwa · listening comprehension with speed grading · speaking via
read-aloud diff, self-comparison, dialogues and free prompts · CEFR levels and placement ·
generalised SRS across item types · mistake log · session sequencer · Telugu L1 profile ·
data export/restore.

### 5.2 Out of scope

| Item | Reason |
|---|---|
| Accounts, login, cross-device sync | `BR-9`, `CON-2` |
| Leaderboards, social features | Contradicts the nervous-adult tone in `NFR-15` |
| Written-paragraph correction | Cannot be graded honestly offline |
| Accent reduction as a goal | See T-P12 — intelligibility, not accent |
| Translation exercises | Grammar-translation is what failed these learners already |
| Native-app packaging | PWA already installable (`NFR-5`) |

### 5.3 Deferred — needs a backend, and we do not have one

Per [CURRICULUM.md §6](CURRICULUM.md), each deferred item has a **substitute** shipping instead:

| Deferred | Substitute in this release |
|---|---|
| Automated pronunciation scoring | Minimal-pair discrimination (objectively gradable) + self-comparison with articulatory cues (`FR-PRN-4`) |
| Free-speech grading | Rubric-based self-review + fluency numbers (`FR-SPK-5`) |
| Cross-device sync | Manual export / import (`FR-DATA-4`) |
| AI conversation partner | Scripted functional dialogues (`FR-SPK-4`) |
| Human intelligibility judgement | Prompt the learner to send a recording to a friend (`FR-SPK-7`) |

---

## 6. Functional requirements

### 6.1 Vocabulary — `VOC`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-VOC-1** | Vocabulary checks grade the **learner's chosen option** | Given shuffled options, when the learner picks option *n*, then the verdict compares *n* to the correct definition's current index. Fixes `correct: 0` after shuffle (`app.js`) | M |
| **FR-VOC-2** | Distractors are **plausible definitions**, not placeholders | No option is `"Something different"` / `"Unrelated concept"` / `"Opposite meaning"`. Distractors are definitions of *other* entries at the same level | M |
| **FR-VOC-3** | Pronunciation is **real IPA or absent** | No entry displays IPA that was mechanically derived from spelling. Removes `"/" + word + "/"` (`app.js`) | M |
| **FR-VOC-4** | **Productive recall** card: definition + gap sentence, learner types or says the word | At least one produce-the-word item per session; recognition-only sessions are not possible | M |
| **FR-VOC-5** | Entries carry **collocation**, **word family**, **register** | Schema has all three; a learner meeting *decide* also meets *decision/decisive/undecided* and *make a decision* | S |
| **FR-VOC-6** | New vocabulary is introduced in roughly **frequency order** | Introduction order derives from a documented frequency source, not alphabetical or arbitrary | S |
| **FR-VOC-7** | Right answers **extend**; wrong answers **contrast** | Correct → one collocation + one family member shown. Wrong → chosen and correct definitions displayed side by side with the difference named | M |

### 6.2 Grammar — `GRM`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-GRM-1** | A grammar strand exists, covering the **24 points** in `CURRICULUM.md §3` Strand B, graded by tier | Each point has: one-sentence rule, 3 contrast pairs, 6 practice items, 1 say-it-aloud task | M |
| **FR-GRM-2** | Every wrong answer returns a **reason, a contrast, and a retry** | No wrong answer displays only a verdict. Applies to the existing fill-in-the-blank too | M |
| **FR-GRM-3** | Each grammar point is an **SRS item** | Wrong → that point's interval resets to 1 day. Right first time → interval extends | M |
| **FR-GRM-4** | Points flagged in the learner's **L1 profile** are prioritised and annotated | Given `l1 = telugu`, the article, copula and stative-progressive points surface earlier and carry a Telugu-specific note | M |
| **FR-GRM-5** | **Defensible alternatives are never marked wrong** | Items with more than one valid answer accept all of them, or are rewritten | M |

### 6.3 Pronunciation — `PRN`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-PRN-1** | **Minimal-pair discrimination** drills for the learner's L1 priority pairs | App plays one clip; learner picks which word. Wrong → both replayed back to back, slowed, with the differing feature named | M |
| **FR-PRN-2** | Accuracy tracked **per phoneme pair**, not per item | Learner can see per-pair accuracy; `srsData` holds `phon:<pair>` keys | M |
| **FR-PRN-3** | **Word stress** marked on vocabulary entries and drillable | Stressed syllable is displayed and audible | M |
| **FR-PRN-4** | Production uses **self-comparison with an articulatory cue** | Model plays, learner records, both replay **A→B→A** at matched speed. The self-check asks a *feelable* question ("did your top teeth touch your bottom lip?"), never "did it sound right?" | M |
| **FR-PRN-5** | Production is **never auto-scored** | No numeric or pass/fail verdict is produced from a recording | M |
| **FR-PRN-6** | Discrimination is **prerequisite** to production for a given pair | Production drill for a pair unlocks at ≥80% discrimination accuracy on that pair. Rationale: a learner who cannot hear a contrast cannot self-judge it | M |
| **FR-PRN-7** | **Duration comparison** offered as an honest hint | If the recording is materially longer than the model, prompt: "check whether you added extra vowel sounds." Phrased as a prompt, never a verdict | S |
| **FR-PRN-8** | Schwa, sentence stress, connected speech and intonation taught by **noticing**, not by model imitation | These are text-and-discrimination exercises. No claim is made that TTS models them correctly | S |
| **FR-PRN-9** | IPA has a **plain-English gloss** | Every symbol shown offers "/ʃ/ — the *sh* in *ship*" | M |

### 6.4 Listening — `LSN`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-LSN-1** | **Comprehension questions** — gist before detail | Every listening item has ≥1 gist question; detail questions come after. Play once for gist, twice for detail | M |
| **FR-LSN-2** | **Speed grading** 0.75× / 1.0× / 1.25× | Learner selects rate; it is applied via the existing `speechAPI.speak(text, rate)` | M |
| **FR-LSN-3** | Transcript available **only after** the attempt | Transcript is never visible before the learner answers | M |
| **FR-LSN-4** | Wrong answer → **replay the relevant clip**, then reveal transcript | Replay precedes transcript, always | M |
| **FR-LSN-5** | **Longer audio** — multi-sentence announcements and calls | At least one item per tier exceeds 60 seconds | S |
| **FR-LSN-6** | **Dictation** available in Listening, reusing the existing `dictation` field | Dictation appears in both Reading and Listening | S |

### 6.5 Speaking — `SPK`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-SPK-1** | Read-aloud reports a **word-level diff**, never a verdict | Output names which words the recogniser missed. Full match reads "the recogniser understood every word" — never "Perfect!" (fixes `app.js`) | M |
| **FR-SPK-2** | The speaking target is **stable and retryable** | The target derives from the current exercise or SRS queue, is not re-randomised on navigation, and can be retried (fixes `app.js`) | M |
| **FR-SPK-3** | **Free-production prompts** graded by tier, with a timer | Prompt, timer, record, self-review rubric, keep the recording. Includes 2-minute topic speaking and the 4/3/2 technique | M |
| **FR-SPK-4** | **Functional dialogues** for real situations | Covers introductions, phone calls, shopping, directions, appointments, interviews, stand-ups/meetings, complaints, apologising, polite disagreement, status updates | M |
| **FR-SPK-5** | **Fluency metrics** — words per minute, filler count, pause count, trended | Compared against the learner's own history, never a native baseline. Filler/pause counts may be `S` if timing data proves unreliable | S |
| **FR-SPK-6** | **Recording archive** — last N per prompt, comparable across weeks | Learner can play a month-one and a month-three recording of the same prompt back to back | S |
| **FR-SPK-7** | Periodic prompt to seek a **human** intelligibility check | Suggests sending a recording to a friend to write down what they heard | C |
| **FR-SPK-8** | **Shadowing** mode — speak *along with* the model | Model plays at a steady rate; no grading | S |
| **FR-SPK-9** | Speaking is **never a hard gate** | Every speaking task can be completed via skip-and-mark-done. Only discrimination (`FR-PRN-1`) may gate | M |

### 6.6 Reading & writing — `RDW`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-RDW-1** | Comprehension questions go beyond **literal recall** | Each passage has ≥1 inference or vocabulary-in-context question | S |
| **FR-RDW-2** | **Sentence transformation** exercises | "Rewrite in the passive", "make this polite" — drills the structural flexibility speaking needs | S |
| **FR-RDW-3** | Existing word-ordering, fill-blank, multiple-choice and reorder modes are **retained as warm-ups** | All four remain available; none is the main event of a session | M |
| **FR-RDW-4** | Exercise mode is **deterministic per item** | The same exercise index renders the same mode, so a failed item can be retried in the mode it was failed in (fixes `app.js`) | M |

### 6.7 Spaced repetition — `SRS`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-SRS-1** | The scheduler is **generalised** beyond vocabulary | Keys namespaced `vocab:` / `gram:` / `phon:` / `coll:`; existing records migrate without loss | M |
| **FR-SRS-2** | Lapse resets to 1 day and lowers ease; success advances along a documented interval ladder | The ladder is the **fixed** `1 → 3 → 7 → 16 → 35`, **holding** at 35 rather than multiplying past it. `ease` still moves on every outcome but does **not** decide intervals — it is a queue-order tie-break only. Lapse behaviour is met. Both halves verified by unit test | M |
| **FR-SRS-3** | A **mistake log** by error type, with a top-5 view | Mistakes are categorised (article omission, /v/–/w/, past-tense agreement …) and the learner can see their top 5 for the last 30 days | M |
| **FR-SRS-4** | The daily queue is **capped at ~20 items**; the rest defer | Queue never exceeds the cap; deferred items are not lost | M |
| **FR-SRS-5** | **Self-reported** outcomes may schedule but never certify | A self-marked production task can shorten an interval; it is stored flagged as self-reported and never counted as verified-correct | M |

#### `FR-SRS-2` — the interval ladder. Question raised as `OQ-10`, implemented as `US-131`, **resolved in favour of the fixed ladder.**

**Status when this section was last verified against source (2026-09-10):** the decision has
landed in `js/core/srs.js`. The discrepancy below is kept as history, because the reasoning is
what makes the resolution a decision rather than a drift, and because stored records written under
the old rule are still out there.

##### The discrepancy, as it stood

This requirement and [TEACHING_METHODOLOGY.md §3](TEACHING_METHODOLOGY.md) specified
**1 → 3 → 7 → 16 → 35** days from the day they were written. `js/core/srs.js` never produced that
sequence — it produced **1 → 3 → 8 → 22 → 62**. The two disagreed from the start, and neither side
was silently rewritten to match the other.

| | Ladder | Where it was written |
|---|---|---|
| **Specified** | 1 → 3 → **7 → 16 → 35** | `FR-SRS-2`, `TEACHING_METHODOLOGY.md` §3 |
| **Shipped (until wave 11)** | 1 → 3 → **8 → 22 → 62** | `SRS._applyGraded()` in `js/core/srs.js`, pinned by `__tests__/unit/srs.test.js` |

**How the old numbers arose.** `_applyGraded()` hardcoded only the first two rungs
(`reps === 1` → `interval = 1`, `reps === 2` → `interval = 3`) and from the third success onwards
computed `Math.round(rec.interval * rec.ease)`. `ease` starts at `DEFAULT_EASE = 2.5` and gains
`+0.1` on every success, clamped to `MAX_EASE = 2.8`; a lapse subtracts `0.2`, floored at
`MIN_EASE = 1.3`. So for an item answered correctly every time: `round(3 × 2.7) = 8`,
`round(8 × 2.8) = 22`, `round(22 × 2.8) = 62`.

**Consequence of each option, stated honestly.** This is the part that had to be written down
before either could be chosen, and it is why the choice was not obvious:

- **SM-2 multiplicative growth (the old code).** The interval is a function of the item's own
  history, so a word the learner keeps getting right accelerates away and a word they keep lapsing
  on stays close. Per-item adaptation is the whole point of SM-2 and it is why the algorithm won.
  The cost is unboundedness and unpredictability: `ease` caps at 2.8 but the interval did not cap at
  all, so the ladder continued 62 → 174 → 487 → 1,364 days. Seven consecutive right answers put an
  item **16 months** out; eight put it nearly four years out. On a four-option quiz a run that long
  is reachable by luck, and a self-study learner has no "I actually forgot this" control to pull it
  back with — so neither they nor the author could say when a given word would next appear.
- **Fixed ladder (the specification).** Predictable, inspectable, and it caps how far any item can
  drift: the sequence is the same for every item, so 35 days is the furthest anything goes before
  the ladder is extended deliberately. That makes the schedule explainable to a learner and testable
  without simulating ease. The cost is that it discards per-item adaptation — a word the learner
  finds trivial and one they find hard are asked for on the same schedule — which is a real loss of
  scheduling efficiency, mitigated but not erased by keeping `ease` as a queue-order tie-break.

##### What is in the code now

Verified in `js/core/srs.js`:

- `INTERVAL_STEPS = [1, 3, 7, 16, 35]`, with `MAX_INTERVAL_DAYS` derived from its last element, so
  the cap is a fact about the app rather than a comment.
- `intervalForReps(reps)` clamps into the array: `reps ≤ 1` reads the first rung, and **past the
  last rung the interval holds at 35** rather than multiplying. That settles the open sub-question —
  the cap is real.
- `_applyGraded()` sets `rec.interval = intervalForReps(rec.reps)` on a success. The rung is a
  function of **`reps` alone**, never of the previous interval, so nothing compounds and one
  implausible stored `interval` no longer poisons every interval after it.
- `ease` is retained and still moves (`+0.1` on success to `MAX_EASE`, `−0.2` on a lapse to
  `MIN_EASE`), but only as the **third sort key** in `_dueRecords()` — after due date, then lapse
  count. Lower ease first, so a harder item leads among items that are otherwise equal, and a
  missing `ease` reads as `DEFAULT_EASE` rather than sorting as the easiest or hardest thing in the
  queue. Per-item difficulty therefore still influences *order within a day*, and no longer
  influences *when an item returns*.
- `SELF_REPORT_INTERVAL_DAYS` is now derived as `INTERVAL_STEPS[0]` rather than hardcoded `1`, so
  `FR-SRS-5`'s floor and the ladder's first rung cannot drift apart.

**The migration answer: forward-only, and it self-corrects.** No stored record is recomputed, no
`due` date is rewritten, and `migrations.js` has no entry for this — a rule change is not a data
change. A record sitting on `interval: 62` keeps that due date until the learner next answers it;
because 62 is reps 5 under the old ladder, the next success reads rung `min(6, 5) = 5` → **35 days**,
so the interval *drops* to the cap. A legacy record with a large interval but small or missing
`reps` resolves to an *earlier* rung, which is the safe direction: the scheduler under-claims how
well an item is known. **Residual, stated rather than hidden:** a record the old rule already pushed
174+ days out keeps that date, and pulling those in would be a separate one-time migration.

**"Verified by unit test" is met.** `__tests__/unit/srs.test.js` was flipped in the same wave and its
`KNOWN DIVERGENCE` marker is gone. It now pins the ladder itself (`[1, 3, 7, 16, 35]`, asserted both
literally and against `SRS.INTERVAL_STEPS`), the **hold** at the last rung over 12 consecutive
successes, `intervalForReps()`'s clamping of `0`, a negative, `undefined` and `NaN` to the first rung
(sooner, never later), the ease **ordering** tie-break — two equally-overdue items with equal lapses,
harder one first — and that `SRS.INTERVAL_STEPS` is exported as a copy so a caller cannot rewrite the
policy by mutating the array. The lapse half was already covered. ⚠️ One caveat on the whole suite,
recorded in its own header: **jest is not installed in this repo**, so these tests are read and
maintained but not currently executed by a local `npm test`.

The other half of `FR-SRS-2` — "a lapse resets to 1 day and lowers ease" — **is** met and was never
in dispute: `_applyGraded()` sets `reps = 0`, `interval = 0`, `due = now` and
`ease = Math.max(MIN_EASE, ease - 0.2)` on a wrong answer, so the item stays in the current
session's queue and comes back at the 1-day rung on its next success.

### 6.8 Session & levels — `SES`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-SES-1** | A **"start today's session"** path sequences ~20 minutes across ≥3 strands, one of which is Speaking | Following the sequencer requires no menu choices and ends with a spoken production. Work is **count-boxed, not time-boxed**; the production step has an `aloud` and a `silent` route and is never dropped; a plan that cannot meet any clause of this requirement **says so** rather than shrinking quietly. Planning is specified below and lives in `js/core/session.js`; `app.js` owns the `#sessionPanel` Dashboard card that walks it | M |
| **FR-SES-2** | A **placement check** sets the starting tier | 12 items (4 listening, 4 grammar-in-context, 2 spoken, 2 vocabulary depth); re-offered every 30 active days | S |
| **FR-SES-3** | Four **CEFR-aligned** tiers: `foundation` `everyday` `confident` `fluent` | Legacy keys `basic`/`intermediate`/`medium` resolve permanently via alias | M |
| **FR-SES-4** | **Promotion** follows the `TEACHING_METHODOLOGY.md §4` thresholds; demotion is never automatic | ≥85% grammar first-try, ≥80% discrimination, ≥5 free-speaking tasks over 10 sessions. Easier content is offered, never announced as a downgrade | S |
| **FR-SES-5** | The dashboard shows **streak, fluency trend and tomorrow's preview** | Present at session end | S |

#### `FR-SES-1` — the sequencer, and the three decisions it made

Wave 11 shipped this requirement in two halves. **Planning** is `js/core/session.js` (`US-801`): no
DOM, no audio, no SRS writes, its own `localStorage` key `sessionPlan`, loaded after
`sections.js` / `srs.js` / `mistakes.js`. It answers four questions: what to do next and in what
order (`build`), where the learner is in that order (`current` / `progress`), what the plan could
*not* include and why (`omitted` / `shortfall`), and where they were when the phone rang (`load` /
`resume`). **Walking** is `app.js`'s `#sessionPanel` card on the Dashboard (`US-170`): the "Start
today's session" button, per-step rendering, the production routes, and the `FR-SES-5` wrap-up. The
split is deliberate and worth keeping — the planner is testable without a DOM, and `app.js` declares
what it can draw through `Session.registerSurfaces()` rather than the planner guessing.

In building it, three product decisions had to be made that this requirement did not anticipate.
All three are judged correct, so they are recorded here as requirements rather than left as
reasoning in a code comment.

##### Decision 1 — the session is **count-boxed**, not time-boxed

"~20 minutes" is a promise about **size**, and it is honoured with a count of items, not a
countdown. Nothing in a session expires. Steps carry advisory minutes — that is what makes the
plan *read* as a 20-minute session, and it is how the budget is split into counts via a
conservative per-item `pace` (a vocabulary card at ~15s, a discrimination item at ~20s including
feedback) — but a step ends when the work ends.

Three reasons, in order of weight:

1. **We cannot measure what a timer would pace.** P1 practises on a commute with the screen locked
   half the time. Wall-clock elapsed is not time-on-task, so a 3-minute timer measures the train.
2. **A step that expires mid-answer is a punishment, and it lands hardest on the slowest learner.**
   That is P2, who "will abandon anything that feels like a test she is failing" (§2 P2, `NFR-15`).
   Cutting off a half-finished thought teaches quitting.
3. **A count is a promise the app can keep.** "9 review items, then 1 grammar point, then 9 minimal
   pairs" is a session whose end the learner can see, and it does not depend on how fast they read.

The one timer that exists is *inside* the free-speaking task, because `FR-SPK-3` asks for "prompt,
timer, record" — and that is a stopwatch the learner starts, surfaced as `targetSeconds`, not a
guillotine. **Consequence to accept:** the app cannot promise a 20-minute session to the minute,
and must not claim to. `plan.minutes` is advisory and is reported as such; overshooting the count
is how a "20-minute session" becomes a 35-minute one and stops being trusted, which is why `pace`
is deliberately pessimistic rather than optimistic.

##### Decision 2 — **silent production is production**; the route is reported, never laundered

This is the `BR-2` / `FR-A11Y-4` resolution (see the amendment under §1.4). Concretely:

- The production step is **always planned** when any production surface exists. It is `required`
  and `terminal`: no option removes it — not silent mode, not a skip, not a 15-minute budget.
  Dropping it is the thing that would violate `BR-2`, so it is not representable.
- It has **two completion routes, `aloud` and `silent`**, and both mark it done. Neither is
  presented as the lesser path and **neither requires a microphone** (`FR-SPK-9`: only
  discrimination may gate on audio).
- `silent` is a **production mode, not a skip**: sub-vocal or whispered speech, or typing the
  utterance the prompt asked for. In silent mode it is the step's default outcome.
- `skipped` remains available, because `FR-A11Y-4`'s floor is that a learner can get from start to
  finish without speaking or granting mic access. A skipped production still completes the session.
- **Nothing is laundered.** The session reports the route and flags the claim `selfReported`, so a
  silently-completed session counts as a silent production and a skipped one counts as **no**
  production. That is what `M-1` has to measure to mean anything, and what `BR-3` requires of every
  claim this app makes.

**Consequence to accept:** a learner who skips every production task has sessions that do not
satisfy `BR-2`, and the app says so in the wrap-up. That is a reporting outcome, not a locked door —
and it is the honest version of the alternative, which is to count a skip as a production and have
`M-1` mean nothing.

##### Decision 3 — a degraded plan is **short and says so**; it never shrinks silently

The §4 session shape names five activities. Three of them currently have nothing that can draw
them: there is no listening comprehension question (`FR-LSN-1`), no shadowing mode (`FR-SPK-8`) and
no free-production prompt surface (`FR-SPK-3`). A sequencer that plans "4 min: listen →
comprehension → shadow" against that build sends the learner to a screen that cannot honour the
instruction — which is worse than no sequencer: it is the app overstating itself, and `BR-3`
forbids that.

So a step survives only if **three independent facts all hold**, and this is now part of the
acceptance criteria:

| # | Fact | Source |
|---|---|---|
| 1 | A **surface** exists that can render it | `SURFACES` / `registerSurfaces()` — app.js declares what it can draw |
| 2 | The section behind it has authored **content** | `Sections.contentCount()` |
| 3 | The step's own **precondition** holds | the step's `requires()` — e.g. review is dropped when nothing is due |

Whatever fails is named on `plan.omitted` with a reason. The freed minutes are redistributed over
the surviving steps but **never past 1.5× a step's §4 share**, because without that clamp a build
where only vocabulary content exists would prescribe 20 minutes of vocabulary review — which is not
the §4 session, it is the old single-section app with a progress bar. With it, the plan comes out
short and reports `plan.shortMinutes`.

The verdict is then computed and stated, not assumed. `plan.meetsFrSes1` is the conjunction of four
checks — ≥3 strands, Speaking among them, ends with a production over *task* steps, and no menu
choices — and each failure emits an explicit `plan.shortfall` line naming the requirement it misses.
Budget shortfall is reported but is deliberately **not** part of the verdict, because minutes are
advisory by Decision 1.

Two consequences worth stating:

- **"Ends with a spoken production" and `FR-SES-5`'s 1-minute wrap-up are both satisfiable**, because
  the wrap-up is the *app* reporting back, not the learner doing something. The check runs over task
  steps only, so the last thing the learner **does** is speak.
- **A shortfall is a real state the UI must render, and does.** Today's build produces them:
  `listen.comprehend`, `speak.shadow` and `speak.free` are all unavailable, and `srs.review` renders
  **vocabulary only** (due `gram:` and `phon:` records are scheduled correctly and no screen draws
  them — see the module map in §9.1). The Dashboard card prints `plan.shortfall` and `plan.omitted`
  on screen rather than swallowing them, and `app.js` states the rule plainly: *an honest empty space
  is a bug report; a hidden one is a lie.* Any future session surface inherits that obligation.

##### Two structural rules the module also fixes

- **No hardcoded section list.** Strand membership derives from each registry row's `srsType`, with
  one small additive table for rows that have none. A section added to the registry and not
  classified is reported by `Session.unclassifiedSections()` rather than silently ignored.
- **Speaking is not a section.** Strand E exists today only as sub-surfaces of other sections
  (grammar's *say it aloud* task, the pronunciation production gate), so the production step
  resolves through an **ordered list of alternatives**, best first, and the plan records which one
  it got: `speak.free` (what §4 and `FR-SPK-3` ask for) → `grammar.produce` (the honest fallback
  that ships today) → `pron.produce` (gated per pair by `FR-PRN-6`, so not unscripted).

### 6.9 Data — `DATA`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-DATA-1** | Persisted data is **versioned and migrated** on load | `schemaVersion` written on every load; the migration chain runs at startup | M |
| **FR-DATA-2** | Every migration is **idempotent** and **preceded by a backup** | Running a migration twice is a no-op; a restorable backup exists before any rewrite | M |
| **FR-DATA-3** | Metrics `M-1`–`M-8` are computed **locally** and shown to the learner | No metric requires a network call | M |
| **FR-DATA-4** | Learner can **export and re-import** all their data | One action produces a JSON file; importing it restores progress, SRS and settings | M |
| **FR-DATA-5** | Learner can **reset review history** without losing settings | A one-time "reset my review history" action exists, because pre-fix `srsData` is unreliable | M |
| **FR-DATA-6** | Recordings are stored as **blobs in IndexedDB**, with a size cap and **pinned-baseline** eviction | Per prompt, `N` slots hold **the first recording ever made for that prompt (the pinned baseline) plus the `N−1` most recent**. Eviction takes the oldest *unprotected* recording. A prompt's newest recording and any pinned baseline are never deleted to make room for a different prompt; when only protected rows remain, the write is **refused with a clear message**, not forced. Total-bytes cap enforced separately from the browser's own quota | S |

**Amendment (wave 6) — why this is no longer "oldest-beyond-N".** This requirement previously
read *"oldest-beyond-N evicted per prompt"*, i.e. a plain ring buffer. That is the one eviction
policy that destroys the feature it serves. [CURRICULUM.md](CURRICULUM.md) Strand E.7 asks for
the archive so a learner "can hear month-one against month-three" and calls that comparison the
strand's strongest motivator — but a ring buffer at `N=3` deletes the month-one recording on the
**fourth** attempt at a prompt, so by month three there is nothing left to compare against. The
motivator destroys itself on the fourth use, at no saving: the pinned-baseline allocation costs
exactly the same `N` slots.

`js/core/blobstore.js` therefore implements the pinned-baseline rule and flagged the divergence
rather than shipping it silently. The requirement is the thing that was wrong, so the requirement
has been amended. Verified against the code:

- `MAX_PER_PROMPT = 3`, `PIN_BASELINE = true`; `PIN_BASELINE = false` restores the literal
  ring-buffer behaviour if this is ever judged the wrong call.
- `planRetention()` keeps `ordered[0]` (the baseline) then fills the remaining slots from the
  newest end. The `baseline` flag is persisted on the metadata row by `commit()` (`row.baseline =
  PIN_BASELINE && mine.length === 0`), so later writes do not have to re-derive which row it was.
- `evictionCandidates()` protects, and says why for each: any pinned baseline, each prompt's
  most recent recording (otherwise recording at prompt B silently wipes what the learner just
  did at prompt A), and anything already in this write's own retention plan.
- `planForSpace()` returns `{ ok: false }` when the cap cannot be honoured without deleting
  something protected, and `commit()` then aborts the whole transaction — so "there is no room"
  can never cost a learner a recording they already had. This is the `NFR-10` path.
- Eviction, the metadata row and the audio payload are one IndexedDB transaction, so a failed
  write rolls back its own eviction too.

**Not versioned together.** `BlobStore.DB_VERSION` is IndexedDB's own object-store-shape version
and is unrelated to `Migrations.SCHEMA_VERSION` (the shape of `learningProgress` / `srsData` in
`localStorage`). The two are never compared or bumped together — see
[TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) "Storage model".

### 6.10 Accessibility — `A11Y`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-A11Y-1** | Every drill completable by **keyboard alone** | No task requires pointer or touch | M |
| **FR-A11Y-2** | Every audio item has a **transcript on demand**, after the attempt | Available for all audio; never before answering | M |
| **FR-A11Y-3** | IPA is **selectable and legible at 200% zoom**, with a plain-English gloss | Verified at 200% on a 360px-wide viewport | M |
| **FR-A11Y-4** | Every speaking task has a **silent / skip-and-mark-done path** | Learner can complete a session start to finish without producing audible speech or granting mic access | M |
| **FR-A11Y-5** | No red ✗ without the fix **on the same screen** | Verified per exercise type | M |

### 6.11 Content authoring — `CNT`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-CNT-1** | Content is **validated against a schema** before it can ship | Malformed items fail loudly at author time, not silently at render | M |
| **FR-CNT-2** | New content types live in **new `data/*.js` files**; existing structures are enriched in place | No `const` redeclaration; `data.js` changes only for level keys and schema enrichment | M |
| **FR-CNT-3** | L1 interference is a **declarative profile** (§3.3) | Adding a second L1 requires no changes to `app.js` | S |
| **FR-CNT-4** | Generated content is **padding, never primary** | Curated items are served first; generated items are clearly bounded and never displace curated content | M |
| **FR-CNT-5** | Third-party content carries **attribution** | CC BY-SA sources (dictionary entries, audio clips) are credited with licence and source URL | M |

---

## 7. Non-functional requirements

| # | Requirement | Target / test |
|---|---|---|
| **NFR-1** | **Platform floor:** Android Chrome and iOS Safari, last 2 major versions; mobile-first layout | Verified manually on one real Android and one real iPhone before each release |
| **NFR-2** | **Graceful degradation of speech recognition** | Where `SpeechRecognition` is missing or unreliable (notably iOS Safari), read-aloud diff degrades to record-and-self-review with an explanation. It must never fail silently |
| **NFR-3** | **Differentiated speech errors** | `no-speech`, `not-allowed`, `network` and `audio-capture` each produce a distinct, actionable message |
| **NFR-4** | **Full core function offline** | With the network disabled: every strand loads, every drill completes, progress persists. Only fresh dictionary lookups and uncached audio are unavailable |
| **NFR-5** | **Installable PWA** with offline fallback page | Installs on Android and iOS; `offline.html` served when a navigation fails |
| **NFR-6** | **Performance on a mid-range Android** | Interactive within 3s on a 3GB-RAM device over 3G; feedback after any answer within 100ms |
| **NFR-7** | **Asset budget** | Total precached payload documented and bounded; growth reviewed when content is added |
| **NFR-8** | **Media caching is explicit** | Audio requests are routed deliberately by the service worker, tolerate Range/206 responses, and never fall back to an HTML page |
| **NFR-9** | **Data durability** | No release ships a migration without an idempotency test and a pre-migration backup |
| **NFR-10** | **Storage:** `localStorage` for state, **IndexedDB for blobs** | Quota-exceeded is handled with a clear message, never silent data loss |
| **NFR-11** | **Accessibility target: WCAG 2.1 AA** | Claimed only where audited. The unverified `'WCAG 2.1 AA Compliant'` startup log is removed until an audit exists |
| **NFR-12** | **Security:** CSP stays `default-src 'self'`; `connect-src` and `media-src` limited to `api.dictionaryapi.dev` | No CDN, no inline third-party script |
| **NFR-13** | **Content validation runs in CI** | A malformed content item fails the build |
| **NFR-14** | **Privacy:** recordings and transcripts never leave the device; no third-party analytics | No outbound request carries learner content |
| **NFR-15** | **Tone:** addresses the learner as *you*, praises specifics, never gamifies at the expense of honesty | A streak cannot survive a session the learner failed throughout |
| **NFR-16** | **Test coverage on data-critical code** | Migrations, levels, SRS and precache integrity have unit tests; `npm test` passes on a clean checkout |
| **NFR-17** | **Localisation:** UI in English | Telugu-language glosses are `OQ-3`, not an assumed requirement |

---

## 8. Constraints and assumptions

### 8.1 Constraints — non-negotiable

Promoted from prose at `IMPLEMENTATION_PLAN.md:27` into first-class requirements.

| # | Constraint | Consequence |
|---|---|---|
| **CON-1** | **Static hosting only** — no server-side execution | No accounts, no server grading, no sync |
| **CON-2** | **Client-only** — no backend of any kind | Metrics cannot be centrally measured (§4.3) |
| **CON-3** | **Browser storage only** — `localStorage` for state, IndexedDB for blobs | Storage quota is a real limit; export is the only backup |
| **CON-4** | **No build step; classic non-module scripts** | Script order in `index.html` is load-bearing; no bundler, no JSX, no TypeScript |
| **CON-5** | **CSP `default-src 'self'`; no CDN** | Fonts and libraries are self-hosted or absent; one allowed API origin |
| **CON-6** | **One optional API** — `api.dictionaryapi.dev`, enhancement only | Its failure must never block an exercise or corrupt data |
| **CON-7** | **Single maintainer** | Capacity is calendar-bound; scope must stay independently shippable |
| **CON-8** | **No paid services** (`BR-9`) | Rules out cloud speech scoring and licensed corpora |

### 8.2 Assumptions — to be validated

| # | Assumption | Risk if wrong |
|---|---|---|
| **AS-1** | Learners have 15–20 minutes a day | Session design is wrong; sequencer needs a 5-minute mode |
| **AS-2** | Learners have a working microphone and will grant permission | `FR-A11Y-4` covers those who will not — but if most refuse, the speaking strand is untested |
| **AS-3** | Browser TTS distinguishes minimal pairs audibly on real devices | Discrimination drills — the highest-value feature — become unteachable. **Must be validated before authoring pair sets** |
| **AS-4** | Free per-word audio covers enough of the curated vocabulary | Falls back to TTS models, weakening `FR-PRN-3` |
| **AS-5** | Learners will self-assess honestly given articulatory cues | Self-comparison degrades into self-flattery; `FR-PRN-6` gating is the mitigation |
| **AS-6** | A Telugu-first profile generalises to other South Asian L1s as data | `BR-10` costs a refactor rather than a data file |

---

## 9. Traceability

Every gap in [CURRICULUM.md §5](CURRICULUM.md) maps to at least one requirement.

| Gap | Description | Pri | Requirements | Phase |
|---|---|---|---|---|
| 1 | No grammar strand | P1 | `FR-GRM-1`…`FR-GRM-5` | 6 |
| 2 | Speech check is a substring match reporting "Perfect!" | P1 | `FR-SPK-1`, `FR-SPK-2` | 1 |
| 3 | Fake IPA from the generator | P1 | `FR-VOC-3` | 1 |
| 4 | No pronunciation strand | P1 | `FR-PRN-1`…`FR-PRN-9` | 7 |
| 5 | No listening comprehension | P2 | `FR-LSN-1`, `FR-LSN-3`, `FR-LSN-4`, `FR-LSN-6` | 8 |
| 6 | No free speaking or fluency metrics | P2 | `FR-SPK-3`, `FR-SPK-5`, `FR-SPK-6`, `FR-SPK-8` | 8, 9 |
| 7 | Levels unordered; no placement test | P2 | `FR-SES-2`, `FR-SES-3`, `FR-SES-4` | 2 |
| 8 | No functional dialogues | P2 | `FR-SPK-4` | 8 |
| 9 | Generated content semantically empty | P3 | `FR-CNT-4`, `FR-VOC-2` | 8 |
| 10 | Curated content thin | P3 | `FR-CNT-1`, `FR-CNT-2`, `FR-LSN-5`, `FR-RDW-1` | 5 |
| 11 | No collocation / word-family / register fields | P3 | `FR-VOC-5`, `FR-VOC-6` | 8 |
| 12 | No mistake log | P3 | `FR-SRS-3` | 4 |
| 13 | No session sequencing | P3 | `FR-SES-1`, `FR-SES-5` | 9 |
| 14 | Single voice, single accent, fixed speed | P4 | `FR-LSN-2` | 8 |

**Requirements with no owning gap** — added by this analysis, chiefly from the personas and the
live-bug review:

`FR-VOC-1` (quiz grading defect) · `FR-RDW-3`, `FR-RDW-4` (retain and stabilise existing modes) ·
`FR-PRN-4`, `FR-PRN-6`, `FR-PRN-7` (self-comparison design) · `FR-SPK-7`, `FR-SPK-9` ·
`FR-SRS-5` (self-report handling) · all of `FR-DATA-*` and `FR-A11Y-*` · `FR-CNT-3`, `FR-CNT-5` ·
`FR-GRM-4` (L1 targeting).

**Persona coverage:** P1 → `FR-SPK-4/5`, `FR-SES-1` · P2 → `FR-A11Y-4`, `FR-GRM-1`, `FR-SPK-9` ·
P3 → `NFR-1/4/6`, `FR-SPK-3/4` · P4 → `FR-SES-2`, `FR-SRS-3`, `FR-PRN-2`, `FR-SPK-6` ·
P5 → `FR-CNT-1`…`FR-CNT-5`, `NFR-13`.

### 9.1 Module map — every `js/core/` module, and the requirement that owns it

Added in wave 11. Twelve modules exist in `js/core/`; **six of them were not named anywhere in this
document**, which is how three of the session sequencer's product decisions ended up living only in
a code comment (see `FR-SES-1`). This table is the inverse index: from shipped module to owning
requirement. It is deliberately here in §9 rather than in §6 — a module is not a requirement, and
the point of the map is to make an *unowned* module visible.

Verified against `index.html`'s script order and `app.js` call sites on 2026-09-10. "Wired" means
`app.js` actually calls it, not merely that a `<script>` tag loads it.

| Module | Owning requirement(s) | Wired? | Notes |
|---|---|---|---|
| `levels.js` | `FR-SES-3` | yes | The four CEFR tiers plus the permanent legacy aliases. Identity aliases are what make the `migrations.js` exercise-id rewrite idempotent |
| `migrations.js` | `FR-DATA-1`, `FR-DATA-2`, `NFR-9` | yes | One `SCHEMA_VERSION` over both `learningProgress` and `srsData`; `backupOnce()` before any rewrite; fails closed |
| `srs.js` | `FR-SRS-1`, `FR-SRS-2`, `FR-SRS-4`, `FR-SRS-5` | yes | See the `FR-SRS-2` note and `OQ-10` for the open ladder question. `PROJECTORS` / `RENDERABLE` / `auditProjection()` are the content contract that `CONTENT_AUTHORING_GUIDE.md` §7 documents |
| `sections.js` | **none — architectural** | yes | The section registry. It replaced ~12 hand-maintained literals in `app.js`, each of which was a silent-failure site (a section missing from `updateStatistics`'s `switch` rendered perfectly and counted nothing). It carries no product requirement and should not be given one; it is the reason `FR-CNT-2` ("new content types live in new files") is cheap, and `Session` reads it rather than hardcoding a strand list |
| `mistakes.js` | `FR-SRS-3`, `BR-5`, `FR-CNT-3` | yes | The taxonomy is **data**, so `BR-10`'s second-L1 profile is `registerCategories()` rather than a code change. Evidence strength is tracked: a recogniser miss is stored under a weaker class than a graded wrong answer and kept out of the ranked diagnosis (`BR-3`, `FR-PRN-5`) |
| `session.js` | `FR-SES-1`, `FR-SES-5`, `BR-1`, `BR-2`, `FR-A11Y-4` | yes | The sequencer. Specified in full under `FR-SES-1`. Planning only, no DOM; `app.js` owns the `#sessionPanel` Dashboard card, calls `registerSurfaces()` with per-surface predicates checkable against the named render function, and draws `plan.shortfall` / `plan.omitted` rather than swallowing them |
| `portability.js` | `FR-DATA-4`, `FR-DATA-5`, `BR-7`, `CON-3` | yes | Exports by **deny-list** over `localStorage`, carrying raw strings so a round trip is byte-identical and a key written by a newer release survives. Validate-whole-file-then-commit with rollback, because `localStorage` has no transaction. A new module key is exported automatically — which is why `sessionPlan` needed no change here |
| `blobstore.js` | `FR-DATA-6`, `NFR-10`, `CON-3` | **not called** | IndexedDB recording archive with the pinned-baseline retention amended into `FR-DATA-6` in wave 6. `BlobStore.DB_VERSION` is unrelated to `Migrations.SCHEMA_VERSION` |
| `error-handler.js` | **none — infrastructure** | yes (26 call sites) | Cross-cutting error logging. No owning requirement, and arguably needs none, but note the class of bug it caused: `AppErrorHandler` was permanently `undefined` for a full wave because a top-level `const` in a classic script is a *lexical* global, not a `window` property (`CON-4`), so every error-logging guard in four core modules was a silent no-op |
| `storage.js` | **superseded** | no | Never instantiated. `portability.js` harvested its useful half and fixed two blocking defects: an instance call to a `static` `Validator` method, and an `englishLearning_` key prefix the app has never written, which would have exported an empty file. Kept only as history; nothing should be built on it |
| `validator.js` | `FR-CNT-1`, `NFR-13` (nominally) | no | Content/record schema checks, unwired. Its level enum was corrected during the CEFR rename or it would have rejected every valid record after it. `FR-CNT-1`'s "fails loudly at author time" is currently met by per-file authoring invariants and tests, **not** by this module |
| `notification.js` | **none** | no | Unwired toast/notification manager. No requirement asks for it |

**What this map makes visible.** Three modules are unwired (`storage`, `validator`,
`notification`) and one built-and-uncalled module implements an `S` requirement (`blobstore`,
`FR-DATA-6`), so four of twelve are not reachable by a learner. And one live gap deserves naming
here because it crosses three modules: `srs.js` schedules `gram:` and `phon:` records correctly,
`app.js`'s review screen walks vocabulary only, and `session.js` therefore refuses to count them —
so due grammar and pronunciation records exist, accumulate and are never shown. That is a defect in
the review surface, not in any of the three modules, and it is the largest single shortfall the
sequencer reports.

---

## 10. Open questions

Each blocks something specific. Recommendations given; decisions are the maintainer's.

| # | Question | Blocks | Recommendation |
|---|---|---|---|
| **OQ-1** | What are the **target values** for `M-1`–`M-8`? | Judging whether a release helped | Set after 2 weeks of the maintainer's own daily use. The app is its own first beta tester |
| **OQ-2** | Add **privacy-respecting analytics**? | §4.3 measurement | **No.** It breaches `NFR-14` and `CON-5`. Rely on local metrics plus manual export |
| **OQ-3** | Offer **Telugu-language** glosses and UI? | Scope of every content schema | Not this release. English UI with plain-English IPA glosses covers all four personas adequately |
| **OQ-4** | Migrate or **reset** the existing `srsData`? | The CEFR migration | **Migrate with a backup** — the *set* of words seen is still signal — and expose `FR-DATA-5` so the learner can choose |
| **OQ-5** | **Placement test scoring** thresholds | `FR-SES-2` | Defer until the grammar and pronunciation strands exist; the test needs items to draw from |
| **OQ-6** | Recording archive: what is **N**, what is the size cap, and how are the `N` slots **allocated**? | `FR-DATA-6` | **Resolved for now, measure later.** `N=3` per prompt and a 50MB total cap, both adopted as `blobstore.js` defaults. The slot *allocation* question is the one the original wording got wrong: it must be **one pinned baseline + the `N−1` most recent**, not oldest-beyond-N — a ring buffer deletes the month-one recording on the fourth attempt and destroys Strand E.7's stated motivator. See the amendment under `FR-DATA-6`. What still needs measuring is `N` and the cap against real recording sizes (`MAX_RECORDING_BYTES` is 10MB, ~1 hour of webm/opus mono) |
| **OQ-7** | Do **puzzles** (word search, crossword, scramble, matching) belong to any strand? | Whether they are maintained through refactors | Keep matching and scramble as warm-ups; retire word search and crossword. They are the most code per unit of teaching value |
| **OQ-8** | Which **frequency list** for `FR-VOC-6`? | Vocabulary ordering | A freely-licensed list (new-GSL or SUBTLEX-derived). Not Oxford 3000/5000 — copyrighted, and this repo is MIT |
| **OQ-9** | Which **audio source** for prosody (`FR-PRN-8`)? | Sentence stress, linking, intonation | None is free and adequate. Teach by noticing; if recording, use a native speaker, not a Telugu-L1 voice |
| **OQ-10** | ~~**Which interval ladder is correct**~~ — the fixed `1 → 3 → 7 → 16 → 35` that `FR-SRS-2` and `TEACHING_METHODOLOGY.md` §3 specify, or the SM-2 multiplicative `1 → 3 → 8 → 22 → 62` that `js/core/srs.js` shipped? Sub-question: what happens **past the last rung** of a fixed ladder? | `FR-SRS-2`, `US-131`, and every acceptance test that asserts an interval | **RESOLVED (wave 11, verified in source 2026-09-10): the fixed ladder, holding at 35.** `js/core/srs.js` now declares `INTERVAL_STEPS = [1, 3, 7, 16, 35]`, derives `MAX_INTERVAL_DAYS` from it, and computes each success's interval as `intervalForReps(rec.reps)` — a function of `reps` alone, clamped, so it holds at 35 instead of multiplying and nothing compounds. `ease` is kept and still moves, but only as the third sort key in `_dueRecords()` (due date → lapses → lowest ease first), so per-item difficulty still shapes queue *order* and no longer shapes *when* an item returns. `SELF_REPORT_INTERVAL_DAYS` is derived from `INTERVAL_STEPS[0]`. Forward-only: nothing recomputes history, and a stored `interval: 62` drops to 35 on its next graded success rather than continuing to 174. **Reasons the fixed ladder won** (recorded so the decision is auditable): (1) it is what the pedagogy contract says, and a methodology document the scheduler ignores is worse than no document; (2) the multiplicative interval had no cap at all — seven right answers put an item 16 months out and eight nearly four years, a run reachable by luck on a four-option quiz, with no learner-facing "I actually forgot this" control to pull it back; (3) a fixed ladder is testable without simulating ease, which is what this requirement's own acceptance criterion asks for. **The accepted cost:** per-item interval adaptation is gone; a word the learner finds trivial and one they find hard now return on the same schedule, and only the queue order distinguishes them. **Tests reconciled in the same wave** — `__tests__/unit/srs.test.js`'s `KNOWN DIVERGENCE` marker is gone and it now pins the ladder, the hold at 35, `intervalForReps()`'s clamping, the ease ordering tie-break, and that `INTERVAL_STEPS` is exported as a copy. Extending the ladder past 35 days later is a deliberate change to the contents of one array, which is exactly the property the array was chosen for |

---

## Appendix — requirement count

| Group | Count |
|---|---|
| Business (`BR`) | 10 |
| Functional (`FR`) | 66 |
| Non-functional (`NFR`) | 17 |
| Constraints (`CON`) | 8 |
| Assumptions (`AS`) | 6 |
| Open questions (`OQ`) | 10 |
