# 📐 Requirements — English Learning Portal

**What** this product must do and **why**. This document is stable; it changes when the product
intent changes, not when the plan does.

Companions: [PROGRESS.md](PROGRESS.md) (state of play, open decisions) ·
[PRODUCT_BACKLOG.md](PRODUCT_BACKLOG.md) (when and in what order) ·
[CURRICULUM.md](CURRICULUM.md) (syllabus) ·
[TEACHING_METHODOLOGY.md](TEACHING_METHODOLOGY.md) (pedagogy contract) ·
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (build plan)

**Version:** 1.0 · **Date:** 2026-09-08

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
| **BR-2** | Every session produces **unscripted spoken output** | M |
| **BR-3** | The app **never overstates** what it knows about the learner's accuracy | M |
| **BR-4** | Full core function **offline**, on a mid-range Android phone | M |
| **BR-5** | Errors are **diagnosed by type** and resurfaced by spaced repetition | M |
| **BR-6** | Teaching is targeted at a learner's **first language** (Telugu first) | M |
| **BR-7** | Learner data is **portable and recoverable** — never silently lost to a migration | M |
| **BR-8** | Progress is **visible over weeks**, not just today | S |
| **BR-9** | Zero running cost; no accounts, no server, no third-party analytics | M |
| **BR-10** | A second first language can be added as **content, not code** | S |

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
| M-1 | % of sessions containing ≥1 unscripted spoken production | session log | Direct test of `BR-2` |
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
| **FR-VOC-1** | Vocabulary checks grade the **learner's chosen option** | Given shuffled options, when the learner picks option *n*, then the verdict compares *n* to the correct definition's current index. Fixes `correct: 0` after shuffle (`app.js:972-984`) | M |
| **FR-VOC-2** | Distractors are **plausible definitions**, not placeholders | No option is `"Something different"` / `"Unrelated concept"` / `"Opposite meaning"`. Distractors are definitions of *other* entries at the same level | M |
| **FR-VOC-3** | Pronunciation is **real IPA or absent** | No entry displays IPA that was mechanically derived from spelling. Removes `"/" + word + "/"` (`app.js:1402`) | M |
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
| **FR-SPK-1** | Read-aloud reports a **word-level diff**, never a verdict | Output names which words the recogniser missed. Full match reads "the recogniser understood every word" — never "Perfect!" (fixes `app.js:2535`) | M |
| **FR-SPK-2** | The speaking target is **stable and retryable** | The target derives from the current exercise or SRS queue, is not re-randomised on navigation, and can be retried (fixes `app.js:2392`) | M |
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
| **FR-RDW-4** | Exercise mode is **deterministic per item** | The same exercise index renders the same mode, so a failed item can be retried in the mode it was failed in (fixes `app.js:1638`) | M |

### 6.7 Spaced repetition — `SRS`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-SRS-1** | The scheduler is **generalised** beyond vocabulary | Keys namespaced `vocab:` / `gram:` / `phon:` / `coll:`; existing records migrate without loss | M |
| **FR-SRS-2** | Lapse resets to 1 day and lowers ease; success advances 1 → 3 → 7 → 16 → 35 | Verified by unit test | M |
| **FR-SRS-3** | A **mistake log** by error type, with a top-5 view | Mistakes are categorised (article omission, /v/–/w/, past-tense agreement …) and the learner can see their top 5 for the last 30 days | M |
| **FR-SRS-4** | The daily queue is **capped at ~20 items**; the rest defer | Queue never exceeds the cap; deferred items are not lost | M |
| **FR-SRS-5** | **Self-reported** outcomes may schedule but never certify | A self-marked production task can shorten an interval; it is stored flagged as self-reported and never counted as verified-correct | M |

### 6.8 Session & levels — `SES`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-SES-1** | A **"start today's session"** path sequences ~20 minutes across ≥3 strands, one of which is Speaking | Following the sequencer requires no menu choices and ends with a spoken production | M |
| **FR-SES-2** | A **placement check** sets the starting tier | 12 items (4 listening, 4 grammar-in-context, 2 spoken, 2 vocabulary depth); re-offered every 30 active days | S |
| **FR-SES-3** | Four **CEFR-aligned** tiers: `foundation` `everyday` `confident` `fluent` | Legacy keys `basic`/`intermediate`/`medium` resolve permanently via alias | M |
| **FR-SES-4** | **Promotion** follows the `TEACHING_METHODOLOGY.md §4` thresholds; demotion is never automatic | ≥85% grammar first-try, ≥80% discrimination, ≥5 free-speaking tasks over 10 sessions. Easier content is offered, never announced as a downgrade | S |
| **FR-SES-5** | The dashboard shows **streak, fluency trend and tomorrow's preview** | Present at session end | S |

### 6.9 Data — `DATA`

| # | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| **FR-DATA-1** | Persisted data is **versioned and migrated** on load | `schemaVersion` written on every load; the migration chain runs at startup | M |
| **FR-DATA-2** | Every migration is **idempotent** and **preceded by a backup** | Running a migration twice is a no-op; a restorable backup exists before any rewrite | M |
| **FR-DATA-3** | Metrics `M-1`–`M-8` are computed **locally** and shown to the learner | No metric requires a network call | M |
| **FR-DATA-4** | Learner can **export and re-import** all their data | One action produces a JSON file; importing it restores progress, SRS and settings | M |
| **FR-DATA-5** | Learner can **reset review history** without losing settings | A one-time "reset my review history" action exists, because pre-fix `srsData` is unreliable | M |
| **FR-DATA-6** | Recordings are stored as **blobs in IndexedDB**, with a size cap and eviction | Archive respects a documented cap; oldest-beyond-N evicted per prompt | S |

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
| **OQ-6** | Recording archive: what is **N**, and what is the size cap? | `FR-DATA-6` | Start at N=3 per prompt and a 50MB cap, then measure |
| **OQ-7** | Do **puzzles** (word search, crossword, scramble, matching) belong to any strand? | Whether they are maintained through refactors | Keep matching and scramble as warm-ups; retire word search and crossword. They are the most code per unit of teaching value |
| **OQ-8** | Which **frequency list** for `FR-VOC-6`? | Vocabulary ordering | A freely-licensed list (new-GSL or SUBTLEX-derived). Not Oxford 3000/5000 — copyrighted, and this repo is MIT |
| **OQ-9** | Which **audio source** for prosody (`FR-PRN-8`)? | Sentence stress, linking, intonation | None is free and adequate. Teach by noticing; if recording, use a native speaker, not a Telugu-L1 voice |

---

## Appendix — requirement count

| Group | Count |
|---|---|
| Business (`BR`) | 10 |
| Functional (`FR`) | 66 |
| Non-functional (`NFR`) | 17 |
| Constraints (`CON`) | 8 |
| Assumptions (`AS`) | 6 |
| Open questions (`OQ`) | 9 |
