# 🗂️ Product Backlog — English Learning Portal

**When** and **in what order**. This document churns; [REQUIREMENTS.md](REQUIREMENTS.md) does not.

This backlog **indexes** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — it does not replace it.
The plan holds per-phase tasks and verification steps; this holds stories, acceptance criteria and
sequencing. Live state lives in [PROGRESS.md](PROGRESS.md).

**Version:** 1.0 · **Date:** 2026-09-08 · **Team:** 1 maintainer (`CON-7`)

**Story ids:** `E#` epic · `US-###` story. **MoSCoW:** `M` must · `S` should · `C` could · `W` won't.
**Points:** Fibonacci, where **1 ≈ under an hour** and **8 ≈ a full week of evenings**.

---

## 1. How this backlog is estimated

A single-maintainer project working evenings has no velocity in the team sense. So:

- **Points measure size, not time.** Calendar time is the real constraint.
- **A sprint here is a phase**, not two weeks. Phases are already ordered by descending data risk
  and are independently shippable.
- **Total is 248 points** (§16). At a realistic 8–12 points a week of evenings, the full backlog is a
  **5–7 month** effort. Sprints 0–1 together are 21 points and deliver most of the audit's value.
- Anything estimated **8 must be split** before it is started. One currently is, and it is flagged.

---

## 2. Definition of Ready

A story may start when:

1. It names its `FR-` id, and that requirement has acceptance criteria.
2. Its content (words, sentences, drills) exists or is explicitly part of the story.
3. It states which persona it serves.
4. Any blocker it depends on (`B#` in PROGRESS.md) is resolved.
5. It is ≤5 points, or split.

## 3. Definition of Done

Every story, without exception:

1. **Acceptance criteria pass**, demonstrated by using the app — not by reading the diff.
2. **Unit test added** under `__tests__/unit/` for any logic, migration or data shape.
3. **`npm test` green.**
4. **Offline-verified** — network disabled, the feature still works or degrades with an explanation
   (`NFR-4`).
5. **Feedback-rules check** — every wrong answer gives a reason, a contrast and a retry
   (`FR-GRM-2`, `TEACHING_METHODOLOGY.md §2`).
6. **Honesty check** — nothing claims accuracy we do not have (`BR-3`).
7. **No new CSP violation** (`NFR-12`); console clean.
8. **Keyboard-completable** and, if it involves speech, has a silent path (`FR-A11Y-1`,
   `FR-A11Y-4`).
9. **Migration safety** — if a persisted shape changed: idempotency test + `backupOnce` proven.
10. **Mobile-checked** on one real Android or iPhone (`NFR-1`).

---

## 4. Epics

| # | Epic | Value | Business req | Size (indicative) |
|---|---|---|---|---|
| **E1** | **Honesty** — stop the app lying to learners | Removes the three behaviours that actively teach errors. Highest value per point in the backlog | `BR-3` | 13 |
| **E2** | **Data integrity** — versioning, migration, export | The only place a bug is unrecoverable | `BR-7` | 21 |
| **E3** | **Levels & placement** — CEFR tiers a learner can self-assess against | Makes progression meaningful | `BR-1` | 13 |
| **E4** | **Extensibility** — section registry, generalised SRS | Turns "add a section" from 12 edits into 2 | `BR-5` | 21 |
| **E5** | **Grammar strand** — the largest curriculum hole | Grammar is currently tested, never taught | `BR-5`, `BR-6` | 34 |
| **E6** | **Pronunciation strand** — discrimination, stress, self-comparison | The strand that addresses P4's plateau and P2's fear | `BR-2`, `BR-6` | 34 |
| **E7** | **Speaking strand** — diff, prompts, dialogues, fluency | The app's stated purpose, currently its weakest strand | `BR-2` | 34 |
| **E8** | **Listening comprehension** — questions, speed, longer audio | Listening skill is currently untrained | `BR-1` | 13 |
| **E9** | **Vocabulary depth** — collocation, family, register, productive recall | Moves vocabulary from recognition to production | `BR-2` | 13 |
| **E10** | **Session & motivation** — sequencer, dashboard, mistake log | Removes the "menu of six sections" problem | `BR-1`, `BR-8` | 13 |
| **E11** | **Platform health** — accessibility, offline, performance, hygiene | Makes the rest usable on P3's phone | `BR-4` | 13 |
| **E12** | **Content authoring** — schemas, validation, L1 profiles | Lets content scale without breaking pedagogy | `BR-6`, `BR-10` | 21 |

Epic sizes are indicative rollups for prioritisation; several stories serve more than one epic, so
they do not sum to the sprint total in §16.

---

## 5. Sprint 0 — unblock (do this first)

Not features. These make everything else possible, and two are already-live problems.

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| **US-001** | **Install Jest so `npm test` runs on a clean checkout.** `jest` and `jest-environment-jsdom` are referenced by 5 scripts and `jest.config.js` but are not in `devDependencies` | `NFR-16` | 1 | M |
| **US-002** | **Commit Phase 0.** 5 modified files + 5 new paths are uncommitted, including 4 spec docs that have never been committed | — | 1 | M |
| **US-003** | **Wire migrations into startup.** `Migrations.migrateProgress()` has **zero call sites**, so `schemaVersion` is never written | `FR-DATA-1` | 2 | M |
| **US-004** | **Wire `levels.js` into the app.** `canonicalLevel`, `levelIds`, `levelLabel` all have zero call sites | `FR-SES-3` | 2 | M |

> **US-003 acceptance:** Given a `learningProgress` with no `schemaVersion`, when the app loads,
> then the migration chain runs, `schemaVersion` equals `SCHEMA_VERSION`, a backup exists, and
> running it twice changes nothing.

**Why US-003 now:** the migration spine is written and tested but has never run against real data.
Do its first real run while nothing depends on it, not during Phase 2 when it is load-bearing.

**Sprint 0 total: 6 points.**

---

## 6. Sprint 1 — Honesty (Phase 1) · E1

**The highest-value sprint in the backlog.** No schema changes, ~a day's work, and it kills three
behaviours that teach errors.

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| ✅ **US-101** | Fix vocabulary quiz grading — **done 2026-09-08** | `FR-VOC-1` | 2 | M |
| ✅ **US-102** | Delete fabricated IPA — **done 2026-09-09** | `FR-VOC-3` | 1 | M |
| **US-103** | Word-level read-aloud diff replacing the substring match | `FR-SPK-1` | 5 | M |
| **US-104** | Stable, retryable speaking target | `FR-SPK-2` | 2 | M |
| ✅ **US-105** | Real quiz distractors — **done 2026-09-08** | `FR-VOC-2` | 2 | M |
| **US-106** | Differentiated speech-recognition errors | `NFR-3` | 1 | M |
| ✅ **US-107** | Remove the unverified WCAG compliance claim — **done 2026-09-09** | `NFR-11` | 1 | M |
| ✅ **US-108** | Deterministic sentence exercise mode — **done 2026-09-09** | `FR-RDW-4` | 1 | M |
| ✅ **US-109** | **Statistics pipeline repaired** — all five types now route through `updateStatistics()`; `state.stats` retained for loading old saves but no longer written — **done 2026-09-09** | `FR-DATA-3`, `BR-8` | 3 | M |
| **US-110** | **Stop the crossword awarding the daily goal for a blank grid** (D2) | `BR-3` | 2 | M |
| ✅ **US-111** | Guard the quiz counters against re-clicking a correct answer — **done 2026-09-09** | `FR-VOC-1` | 1 | M |
| ✅ **US-112** | Stop dictation double-counting the reading passage — **done 2026-09-09** | `FR-DATA-3` | 1 | M |
| ✅ **US-113** | Correct `docs/README.md`'s false testing claims — **done 2026-09-09** | `NFR-16` | 1 | M |
| **US-114** | `exercise.fillBlank` can be `undefined`, so `case 'fillblank'` breaks. Now reproducible at `index % 4 === 1` rather than intermittent | `FR-RDW-4` | 2 | M |
| **US-115** | Scramble: repeated "Check" clicks on a correct answer each count a solve — no per-render guard exists | `FR-DATA-3` | 1 | S |
| **US-116** | Scramble's "Show Answer" reveals the solution and the authored `hint` field is never displayed (D4) | `FR-VOC-7` | 2 | S |
| **US-117** | Correct `TECHNICAL_DOCUMENTATION.md` stale line refs and the nonexistent `capitalize()` (D6) | — | 2 | S |

### Stories in full

**US-101 — As Ravi, I want my vocabulary answers graded correctly, so my review queue reflects what
I actually know.** ✅ **Done 2026-09-08.**
- **Given** a quiz whose options were shuffled, **when** I select an option, **then** the verdict
  compares my selection against the correct definition's *current* index.
- **Given** I answer correctly, **when** SRS is updated, **then** it records a success.
- **Implemented at** `app.js:980-996` — `correct: options.indexOf(correctDefinition)`, mirroring the
  already-correct generated path at `app.js:1427`. Verified over 5000 renders: 0 index mismatches.
- **Still outstanding:** review items already persisted to `srsData` carry the old `correct: 0` and
  the placeholder distractors, because `js/core/srs.js:100` stores the whole `quiz` object and
  `loadReviewWord` replays it. Those items will keep mis-grading until purged. Handled by **US-205**.

**US-105 — As Anusha, I want distractors that test meaning, not absurdity.** ✅ **Done 2026-09-08.**
- **Given** a vocabulary check, **then** all distractors are real definitions of *other* entries,
  preferring the current level and falling back to other levels.
- **Implemented at** `app.js:1008-1053` as `getDistractorDefinitions(correctDefinition, count)`.
  Wrapped in `try/catch` with `Array.isArray` guards and a generic top-up, so a missing
  `vocabularyData` degrades instead of taking the section down.
- Did **not** use the API's synonyms/antonyms, per the decision recorded in PROGRESS.md §6.

**US-109 — As the maintainer, I want the dashboard to count what the learner actually did.**
- **Given** I complete a sentence, reading or puzzle exercise, **when** the dashboard renders,
  **then** the corresponding counter has increased.
- **Given** the app loads saved progress, **then** historical counts are preserved.
- **Note:** `updateStatistics()` (`app.js:236`) has exactly **one** call site, for `'vocabulary'`
  (`app.js:1523`). Every other path increments `state.stats.*` (`app.js:1921`, `2316`, `2347`,
  `2625`, `2660`, `2694`, `2836`) which is loaded at `app.js:140` and read by nothing.
- **Blocks `FR-DATA-3`.** The success metrics assumed this data was already being collected.
- ⚠️ Decide whether to migrate the orphaned `state.stats` values into `overallStats` or start the
  repaired counters from zero. Migrating is kinder but the numbers are of unknown quality.

**US-110 — As a learner, I don't want to be told I solved something I didn't attempt.**
- **Given** an untouched crossword grid, **when** I press "Check Answers", **then** the daily puzzle
  goal is **not** awarded and no `puzzlesSolved` increment occurs.
- `generateCrossword` (`app.js:2695-2710`) has no answer key, so there is nothing to validate
  against. Minimum honest fix: stop granting credit and label the section unfinished.
- ⚠️ **Resolve `OQ-7` first.** If the crossword is being retired there is no point repairing it.

**US-102 — As a learner, I want to never be shown invented pronunciation.**
- **Given** an algorithmically generated word, **when** it renders, **then** it shows real IPA or
  **no** pronunciation field — never `/word/` derived from spelling (`app.js:1421`).

**US-103 — As Ravi, I want to know which words the recogniser missed, so I can practise those
sounds.**
- **Given** I read a sentence aloud, **when** the transcript returns, **then** I see a word-by-word
  diff with mismatches highlighted.
- **Given** 2 of 9 words mismatched, **then** the app names them: *"The recogniser missed 2 of 9
  words: asked, texts"*, and links to the relevant drill.
- **Given** every word matched, **then** it says *"The recogniser understood every word"* —
  **never "Perfect!"**.
- **Given** recognition is unavailable, **then** it degrades to record-and-self-review with an
  explanation (`NFR-2`).

**US-104 — As Lakshmi, I want to retry the word I just failed.**
- **Given** I failed a speaking target, **when** I navigate away and back, **then** the **same**
  target is presented (fixes the `Math.random()` pick at `app.js:2436`).
- **Given** an active SRS queue, **then** the target is drawn from it, not at random.

**US-106 — As Lakshmi, I want to know whether the app broke or I did.**
- **Given** `no-speech`, **then** "I didn't hear anything — try again". **Given** `not-allowed`,
  **then** microphone-permission guidance. **Given** `network`, **then** an offline explanation.
- Replaces the single generic toast at `app.js:1144-1147`.

**US-107 — As the maintainer, I want the app to stop asserting an unaudited standard.**
✅ **Done 2026-09-09.**
- **Given** startup, **then** no log claims WCAG compliance. The line is deleted with nothing put in
  its place. The target is stated in `NFR-11` and will be claimed only after an audit (`US-806`).

**US-108 — As Lakshmi, I want to retry an exercise in the mode I failed it in.** ✅ **Done 2026-09-09.**
- **Given** exercise index *n*, **when** it renders twice, **then** the same mode appears both times.
- Implemented as `exerciseTypes[state.currentSentenceIndex % exerciseTypes.length]` at
  `app.js:1672`, replacing the `Math.random()` pick. The two downstream dispatch sites derive the
  type from the live DOM, so they were already consistent and needed no change.
- ⚠️ **Surfaced by this fix:** `case 'fillblank'` calls `loadFillBlankExercise(exercise.fillBlank)`,
  and that property can be absent. Previously this failed intermittently (~25% of renders); it is
  now *reproducibly* broken for indices where `index % 4 === 1`. Determinism is still correct — it
  converts an intermittent bug into a visible one — but it needs a follow-up. See `US-114`.

**US-108 — As Lakshmi, I want to retry an exercise in the mode I failed it in.**
**Sprint 1 total: 30 points across 17 stories** — **13 done, 17 remaining.** Grew 15 → 23 after the
Wave 1 audit (US-109…US-113), then → 30 after Wave 2 surfaced US-114…US-117. The sprint doubling in
size while half-completing is the honest shape of fixing a codebase nobody had audited: each fix
exposes the next defect.

---

## 7. Sprint 2 — Data integrity (Phase 2) · E2 + E3

Highest-risk sprint. Blocked on **OQ-4**.

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| **US-201** | Migrate level keys to the four CEFR tiers | `FR-SES-3` | 5 | M |
| **US-202** | Pre-migration backup, provably idempotent | `FR-DATA-2` | 3 | M |
| **US-203** | Export all learner data as JSON | `FR-DATA-4` | 3 | M |
| **US-204** | Import/restore from an export | `FR-DATA-4` | 3 | M |
| **US-205** | "Reset my review history" action | `FR-DATA-5` | 2 | M |
| **US-206** | Adopt IndexedDB for blobs; document the storage split | `NFR-10`, `CON-3` | 3 | M |

**US-201 — As Lakshmi, I want levels that tell me what I can do.**
- **Given** saved progress under `basic`/`intermediate`/`medium`, **when** I upgrade, **then** it
  resolves to `foundation`/`everyday`/`confident` with no loss.
- **Given** a legacy backup restored a year later, **then** aliases still resolve (permanent, per
  the Phase 0 decision).
- **Given** the migration runs twice, **then** the second run is a no-op.
- ⚠️ **`fluent` will have zero content on landing.** Either author a minimum set first or hide the
  tier until `US-501` lands. Decide before starting.

**US-203/204 — As Anusha, I want to move my progress to a new phone.**
- **Given** I export, **then** one JSON file contains progress, SRS records, settings and mistake
  log. **Given** I import it on a clean install, **then** my state is restored, including streak.
- **Note:** harvest `exportData`/`importData`/`createBackup`/`restoreFromBackup` from
  `js/core/storage.js` — they are already written and currently dead (**B7**). Do not rewrite.

**Sprint 2 total: 19 points.**

---

## 8. Sprint 3 — Extensibility (Phases 3–4) · E4

Enables E5 and E6. No user-visible feature — and that is deliberate.

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| **US-301** | `SECTIONS` registry, additive, zero new sections | — | 5 | M |
| **US-302** | Generalise SRS keys to `vocab:`/`gram:`/`phon:`/`coll:` | `FR-SRS-1` | 5 | M |
| **US-303** | Migrate existing `srsData` to namespaced keys | `FR-SRS-1`, `FR-DATA-2` | 3 | M |
| **US-304** | Cap the daily queue at ~20, defer the rest | `FR-SRS-4` | 2 | M |
| **US-305** | Mistake log by error type, with a top-5 view | `FR-SRS-3` | 5 | M |
| **US-306** | Store self-reported outcomes flagged, never as verified | `FR-SRS-5` | 2 | M |

**US-305 — As Anusha, I want to know what I keep getting wrong.**
- **Given** 30 days of practice, **when** I open the mistake log, **then** I see my top 5 recurring
  error *types* (article omission, /v/–/w/, past-tense agreement), not a list of items.
- **Given** a mistake category, **then** I can start a drill targeting it.
- Categories come from the L1 profile (`FR-CNT-3`) plus grammar point ids.

**Sprint 3 total: 22 points.**

---

## 9. Sprint 4 — Pronunciation (Phase 7, pulled forward) · E6

**Deliberately ahead of Grammar**, against the plan's phase numbering. Rationale: it is the
strongest fit to the Telugu-L1 analysis, it serves P4's plateau and P2's silent practice, and
discrimination is the only speech task we can grade honestly. **Blocked on AS-3.**

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| **US-400** | **Spike:** validate TTS renders minimal pairs distinguishably on real Android + iPhone | `AS-3` | 2 | M |
| **US-401** | Minimal-pair discrimination drill for T-P5…T-P11 | `FR-PRN-1` | 5 | M |
| **US-402** | Per-phoneme-pair accuracy tracking and profile view | `FR-PRN-2` | 3 | M |
| **US-403** | Word stress marked and drillable | `FR-PRN-3` | 3 | M |
| **US-404** | Self-comparison: A→B→A playback with an articulatory cue | `FR-PRN-4`, `FR-PRN-5` | 5 | M |
| **US-405** | Gate production behind ≥80% discrimination on that pair | `FR-PRN-6` | 2 | M |
| **US-406** | Duration-comparison hint for epenthesis (T-P2, T-P3) | `FR-PRN-7` | 3 | S |
| **US-407** | Plain-English IPA glosses | `FR-PRN-9` | 2 | M |
| **US-408** | Use API audio for word models; route media in the service worker | `NFR-8`, `FR-CNT-5` | 3 | S |
| **US-409** | Schwa, sentence stress, linking and intonation taught by **noticing**, not model imitation | `FR-PRN-8` | 5 | S |

**US-400 is a spike and it gates the sprint.** If TTS cannot render /ɪ/ vs /iː/ distinguishably on
real devices, `US-401` needs bundled audio and the sprint doubles. **Do not author 8 pair sets
before this passes.**

**US-401 — As Anusha, I want to find out which sounds I confuse.**
- **Given** a minimal pair, **when** the drill starts, **then** one clip plays and I pick which word
  I heard.
- **Given** I answer wrongly, **then** both words replay back to back **slowed**, and the differing
  feature is named ("/iː/ is longer and the lips are wider than /ɪ/"), and I retry.
- **Given** a wrong answer, **then** `phon:<pair>` resets to a 1-day interval.
- **This is the only speech task that may gate progress** — the grade is objective because we know
  which file we played.

**US-404 — As Lakshmi, I want to judge my own pronunciation without being told I'm wrong.**
- **Given** a target word, **when** I record, **then** I can play **model → mine → model** at
  matched speed.
- **Given** the self-check, **then** it asks a *feelable* question ("did your top teeth touch your
  bottom lip?"), **never** "did it sound right?".
- **Given** I mark "not yet", **then** the item returns sooner — and is stored flagged as
  self-reported (`FR-SRS-5`).
- **No score, no pass/fail, ever** (`FR-PRN-5`).

**Sprint 4 total: 33 points.**

---

## 10. Sprint 5 — Grammar (Phase 6) · E5

Largest content effort in the backlog, and the phase needing no external data.

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| **US-500** | **Spike:** author **one** grammar point end to end and review it | `FR-GRM-1` | 2 | M |
| **US-501** | Grammar section shell wired to the registry | `FR-GRM-1` | 3 | M |
| **US-502** | Foundation points 1–8 (**split from an 8**) | `FR-GRM-1` | 5 | M |
| **US-503** | Everyday points 9–16 (**split from an 8**) | `FR-GRM-1` | 5 | M |
| **US-504** | Confident + fluent points 17–24 | `FR-GRM-1` | 5 | S |
| **US-505** | Reason + contrast + retry on every wrong answer | `FR-GRM-2` | 3 | M |
| **US-506** | Grammar points as SRS items | `FR-GRM-3` | 2 | M |
| **US-507** | L1-prioritised ordering and Telugu notes | `FR-GRM-4`, `FR-CNT-3` | 5 | M |
| **US-508** | Audit items for defensible alternatives | `FR-GRM-5` | 3 | M |

**US-500 gates the sprint** — it is the cheapest test of the least-verified assumption in this whole
plan (that the grammar content can be authored unaided to a good standard). One point, one review,
before committing to 20+.

**US-507 — As Lakshmi, I want the grammar that Telugu speakers actually get wrong, first.**
- **Given** `l1 = telugu`, **then** articles (T-G1), copula (T-G2), stative progressive (T-G3) and
  uncountables (T-G4) surface before lower-impact points.
- **Given** a Telugu-flagged point, **then** it carries a note contrasting the Telugu pattern with
  the English one.
- **Given** a second L1 profile added later, **then** no `app.js` change is needed.

**Sprint 5 total: 33 points.**

---

## 11. Sprint 6 — Speaking (Phases 8–9) · E7

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| **US-601** | Free-production prompts with timer, recording, rubric | `FR-SPK-3` | 5 | M |
| **US-602** | Functional dialogues — 11 situations | `FR-SPK-4` | 8 → **split by situation group** | M |
| **US-603** | Words-per-minute metric with trend | `FR-SPK-5` | 3 | S |
| **US-604** | Filler and pause counts | `FR-SPK-5` | 5 | C |
| **US-605** | Recording archive, last N per prompt, IndexedDB | `FR-SPK-6`, `FR-DATA-6` | 5 | S |
| **US-606** | Shadowing mode | `FR-SPK-8` | 3 | S |
| **US-607** | 4/3/2 fluency technique | `FR-SPK-3` | 3 | S |
| **US-608** | Silent / skip-and-mark-done on every speaking task | `FR-SPK-9`, `FR-A11Y-4` | 3 | M |
| **US-609** | Periodic "ask a human" intelligibility prompt | `FR-SPK-7` | 1 | C |

**US-604 is deliberately `C`.** Filler and pause detection needs audio analysis or interim
recognition timings; if it proves unreliable, ship WPM alone rather than an invented number
(`BR-3`).

**US-608 is `M` and must not slip** — it is what makes the app usable for P2 at all.

**Sprint 6 total: 36 points** (before splitting US-602).

---

## 12. Sprint 7 — Listening & vocabulary depth (Phase 8) · E8 + E9

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| **US-701** | Convert `listeningExercises` from `string[]` to `object[]` | `FR-LSN-1` | 3 | M |
| **US-702** | Gist-then-detail comprehension questions | `FR-LSN-1` | 5 | M |
| **US-703** | Transcript only after the attempt; replay before reveal | `FR-LSN-3`, `FR-LSN-4` | 2 | M |
| **US-704** | 0.75× / 1.0× / 1.25× speed control | `FR-LSN-2` | 1 | M |
| **US-705** | Longer audio — one 60s+ item per tier | `FR-LSN-5` | 3 | S |
| **US-706** | Dictation in Listening, reusing the existing field | `FR-LSN-6` | 2 | S |
| **US-707** | Productive-recall vocabulary card | `FR-VOC-4` | 3 | M |
| **US-708** | Collocation, word-family and register fields | `FR-VOC-5` | 5 | S |
| **US-709** | Frequency-ordered introduction | `FR-VOC-6` | 3 | S |
| **US-710** | Right answers extend, wrong answers contrast | `FR-VOC-7` | 2 | M |
| **US-711** | Transcript available on demand for every audio item, after the attempt | `FR-A11Y-2` | 2 | M |
| **US-712** | Inference and vocabulary-in-context reading questions | `FR-RDW-1` | 3 | S |
| **US-713** | Sentence-transformation exercises — "rewrite in the passive", "make this polite" | `FR-RDW-2` | 3 | S |
| **US-714** | Bound generated content so curated items always serve first | `FR-CNT-4` | 3 | M |

**US-701 first and alone** — the plan flags this `string[]` → `object[]` conversion as Phase 8's
riskiest single step.

**US-704 is 1 point** because `speechAPI.speak(text, rate)` already accepts the parameter and never
varies it.

**Sprint 7 total: 40 points.**

---

## 13a. Requirements with no story — and why

Four requirements have no story deliberately. Recording them here so the traceability gap is a
decision rather than an oversight.

| # | Requirement | Why no story |
|---|---|---|
| `FR-A11Y-5` | No red ✗ without the fix on the same screen | **Definition of Done item 5.** It is a check applied to every story, not work in itself |
| `FR-CNT-2` | New content types in new `data/*.js`; existing structures enriched in place | **An authoring rule**, enforced by DoD and `CONTENT_AUTHORING_GUIDE.md`. No implementation |
| `FR-RDW-3` | Existing word-order, fill-blank, multiple-choice and reorder modes retained as warm-ups | **Satisfied by doing nothing.** Protected by the DoD regression check — it exists to stop a future refactor deleting them |
| `FR-SRS-2` | Lapse resets to 1 day; success advances 1 → 3 → 7 → 16 → 35 | **Already implemented and unit-tested** in `js/core/srs.js` (23 assertions). Documented as a requirement so a future change to the curve is a deliberate decision |

---

## 13. Sprint 8 — Session, motivation, platform (Phases 9–10) · E10 + E11

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| **US-801** | "Start today's session" sequencer — 20 min, ≥3 strands, one Speaking | `FR-SES-1` | 5 | M |
| **US-802** | Dashboard: streak, fluency trend, tomorrow's preview | `FR-SES-5` | 3 | S |
| **US-803** | Local metrics M-1…M-8 computed and surfaced | `FR-DATA-3` | 5 | S |
| **US-804** | Placement check, 12 items | `FR-SES-2` | 5 | S |
| **US-805** | Promotion thresholds; demotion never announced | `FR-SES-4` | 3 | S |
| **US-806** | Accessibility audit against WCAG 2.1 AA; then claim it | `NFR-11` | 5 | M |
| **US-807** | Keyboard-completable everywhere; un-quarantine the keyboard suites | `FR-A11Y-1` | 3 | M |
| **US-808** | IPA legible at 200% zoom | `FR-A11Y-3` | 2 | M |
| **US-809** | Harvest `storage.js`/`validator.js`, **then** delete the dead modules | `NFR-13` | 5 | M |
| **US-810** | Performance budget documented and met on a mid-range Android | `NFR-6`, `NFR-7` | 3 | S |
| **US-811** | Content validation in CI | `NFR-13`, `FR-CNT-1` | 3 | M |
| **US-812** | Decide and act on puzzles (**OQ-7**) | — | 2 | S |

**US-809 order is load-bearing.** ~1,690 lines are dead, but `storage.js` and `validator.js`
contain the export/import/backup and schema-validation code `US-203`, `US-204` and `US-811` need.
**Harvest before deleting**, or the same functions get rewritten (**B7**).

**Sprint 8 total: 44 points.**

---

## 14. Release slices

| Release | Contents | Learner-visible promise |
|---|---|---|
| **R1 — Honest** | Sprints 0–1 | "The app no longer tells you that you're right when you aren't." |
| **R2 — Safe** | Sprint 2 | "Your progress is versioned, backed up and exportable." |
| **R3 — Diagnostic** | Sprints 3–4 | "Find out which sounds you confuse, and track them." |
| **R4 — Taught** | Sprint 5 | "Grammar is now taught, not just tested." |
| **R5 — Spoken** | Sprints 6–7 | "Every session ends with you speaking, and you can hear yourself improve." |
| **R6 — Guided** | Sprint 8 | "Open the app, press start, and it decides what you practise." |

R1 and R2 are the ones that matter for trust. R3 onward is where the product becomes what
`CURRICULUM.md` describes.

---

## 15. RAID log

### Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| **R-1** | A migration corrupts review history | **Severe — unrecoverable** | Medium | `backupOnce` before every migration; idempotency tests; export before upgrade (`US-202`, `US-203`) |
| **R-2** | TTS cannot render minimal pairs distinguishably, invalidating the highest-value feature | High | **Medium** | `US-400` spike gates Sprint 4. Fallback: bundle audio |
| **R-3** | Grammar content quality falls short — the least-verified assumption in the plan | High | Low-medium | `US-500` spike: author one point, review it, before committing to 24 |
| **R-4** | Content authoring, not coding, is the real bottleneck for Sprints 5–7 | High | **High** | Ship per tier, not per strand. `foundation` + `everyday` complete beats four tiers half-done |
| **R-5** | iOS Safari speech recognition unreliable | Medium | **High** | `NFR-2` degradation is a `M` requirement, not a nice-to-have |
| **R-6** | Single maintainer — illness or a busy month stalls everything | Medium | High | Every phase independently shippable; nothing half-migrated at rest |
| **R-7** | Learners refuse microphone permission | Medium | Medium | `US-608` silent path is `M` |
| **R-8** | Self-assessment becomes self-flattery | Medium | Medium | `FR-PRN-6` gating; articulatory not auditory questions; self-report never certifies |
| **R-9** | Audio caching fails on Range/206 responses | Low-medium | Medium | `US-408` routes media explicitly and tests offline replay |
| **R-10** | Scope creep from 66 requirements against one maintainer | High | High | MoSCoW is enforced; `C` and `W` items are not started before all `M` items ship |

### Assumptions

Tracked as `AS-1`…`AS-6` in [REQUIREMENTS.md §8.2](REQUIREMENTS.md). `AS-3` (TTS quality) is the
one with a spike attached.

### Issues — live now

| # | Issue | Status |
|---|---|---|
| **I-1** | `npm test` fails on a clean checkout — Jest not in `devDependencies` | Open → `US-001` |
| **I-2** | Phase 0 uncommitted; 4 spec docs never committed | Open → `US-002` |
| **I-3** | `levels.js` and `migrations.js` have zero call sites — CEFR framework exists only on paper | Open → `US-003`, `US-004` |
| **I-4** | Existing `srsData` substantially noise from the `correct: 0` bug | Open → `US-101`, `US-205` |
| **I-5** | ~1,690 lines of never-instantiated modules load on every page | Open → `US-809` |
| **I-6** | `docs/FOLDER_STRUCTURE.md` and `docs/ERROR_HANDLING_GUIDE.md` document an architecture never adopted | ✅ Fixed 2026-09-08 |
| **I-7** | Dashboard counters for sentences, reading and puzzles are permanently 0 — `updateStatistics()` is called only for vocabulary | Open → `US-109`. **Blocks `FR-DATA-3`** |
| **I-8** | The crossword grants the daily puzzle goal for an untouched grid — a `BR-3` honesty defect, not just a missing feature | Open → `US-110` |
| **I-9** | Word search is unwinnable: `.selected` is never cleared on a match, so no second word can ever match | Open → `OQ-7` decision, then fix or retire |
| **I-10** | `docs/README.md:85-93` claims 260+ tests and 70% enforced coverage; `jest.config.js:33` says the opposite | Open → `US-113` |
| **I-11** | `error-handler.js` is the app's **only** global error capture (`:332`, `:341`) — it must be preserved or replaced before the Phase 10 delete, not simply removed | Open → amends `US-809` |
| **I-12** | Two `.toast-container` elements exist on every page: `notification.js` appends one at load, `app.js`'s `Toast` creates another with the same class | Open → resolve with `US-809` |

### Dependencies

| Story | Waits on |
|---|---|
| `US-201` | **OQ-4** (migrate vs reset) |
| Sprint 4 | `US-400` spike, and `AS-3` |
| Sprint 5 | `US-500` spike; `US-301` registry |
| `US-401` | `US-302` (`phon:` SRS keys) |
| `US-605` | `US-206` (IndexedDB) |
| `US-203`, `US-204`, `US-811` | `US-809` **harvest** step, not its delete step |
| `US-709` | **OQ-8** (frequency list licence) |
| `US-806` claim | `US-807`, `US-808` complete |

---

## 16. Backlog summary

| Sprint | Theme | Points | Cumulative |
|---|---|---|---|
| 0 | Unblock | 6 | 6 |
| 1 | Honesty | 30 | 36 |
| 2 | Data integrity | 19 | 55 |
| 3 | Extensibility | 22 | 77 |
| 4 | Pronunciation | 33 | 110 |
| 5 | Grammar | 33 | 143 |
| 6 | Speaking | 36 | 179 |
| 7 | Listening & vocabulary | 40 | 219 |
| 8 | Session & platform | 44 | 263 |

**263 points total, of which 13 are done.** At 8–12 points a week of evenings that is roughly
**5–7 months** for everything, or **about two weeks to finish R1** — the point at which the app
stops misleading learners. If time runs out anywhere, it should run out after R2, not before.
