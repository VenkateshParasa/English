# 🗂️ Product Backlog — English Learning Portal

**When** and **in what order**. This document churns; [REQUIREMENTS.md](REQUIREMENTS.md) does not.

This backlog **indexes** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — it does not replace it.
The plan holds per-phase tasks and verification steps; this holds stories, acceptance criteria and
sequencing. Live state lives in [PROGRESS.md](PROGRESS.md).

**Version:** 1.0 · **Date:** 2026-09-12 · **Team:** 1 maintainer (`CON-7`)

**Story ids:** `E#` epic · `US-###` story. **MoSCoW:** `M` must · `S` should · `C` could · `W` won't.
**Points:** Fibonacci, where **1 ≈ under an hour** and **8 ≈ a full week of evenings**.

---

## 1. How this backlog is estimated

A single-maintainer project working evenings has no velocity in the team sense. So:

- **Points measure size, not time.** Calendar time is the real constraint.
- **A sprint here is a phase**, not two weeks. Phases are already ordered by descending data risk
  and are independently shippable.
- **Total is 492 points** (§16), of which 302 are done. At a realistic 8–12 points a week of evenings,
  the **remaining 190** is a **4–5 month** effort. Sprints 0–1 hold most of the audit's value and are
  where all the honesty defects live.
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

**On story numbers and sprint attribution.** Stories were originally numbered per sprint (`US-1xx` = Sprint 1, `US-2xx` = Sprint 2). From `US-193` onward they are allocated **sequentially**, so the number no longer implies a sprint — `US-211`–`US-213` are test-infrastructure fixes, not Data-integrity work, despite the `2xx`. Sprint attribution in §16 is editorial and maintained by hand; treat the per-sprint split as approximate and the totals as exact.

**Four ids collided and were reallocated 2026-09-12.** The sequential run ran into Sprint 2's pre-allocated `US-2xx` block, so `US-201`–`US-204` were each defined twice. The **Sprint 2** meanings are authoritative (the traceability matrix in §15 and §13 reference them); the newer post-`US-193` stories were renumbered: old-new `US-201` → **`US-211`** (`session.js` clock seam), `US-202` → **`US-212`** (`jest.config.js` collected `setup.js`), `US-203` → **`US-213`** (two `mistakes` tests asserted nothing), `US-204` → **`US-214`** (srsData-only import deletes `learningProgress`). **A commit message dated 2026-09-12 or earlier that says `US-201`–`US-204` may mean either story** — check whether it touches `data.js`/`portability.js` (Sprint 2) or `jest.config.js`/`session.js`/`__tests__/` (the renumbered run). `US-501` also appears twice, correctly: a Sprint 5 plan row and the Sprint 1 row recording it done.

### 4a. Corrections of record

Four briefing errors, recorded so they are not repeated from this document.

| Correction | The error | The authority |
|---|---|---|
| **`US-226`'s L1 code is `T-G6`, not `T-G9`** | The past-simple point was briefed as `T-G9`. The author caught it and every `l1` field in `data/grammar/past-simple.js` says `T-G6` | `REQUIREMENTS.md:226` is `T-G6 \| Perfective aspect mismatch`; `:229` is `T-G9 \| Indian-English register items` (*"doubt"*, *"out of station"*, *"cousin brother"*). `mistakes.js` agrees — `gram.present-perfect` carries `T-G6`, `gram.register-indian` carries `T-G9`. **Checked: no other backlog row repeats the error.** The only `T-G` codes elsewhere in this file are `T-G1`–`T-G4` (`US-507`), `T-G2` (`US-151`) and `T-G5`/`T-G8` (`US-215`), all correct |
| **`gram.subject-dropped` already has a producer** | It was briefed in this wave as still having none, with `US-192`'s one-line `be-p2` edit as the only way to give it one. It has had one since `US-236` | `data/grammar/modals.js` routes the subject-omitted-after-modal distractor to `logAs: 'gram.subject-dropped'` (`errorKind: 'subject-omitted-after-modal'`) — the missing subject after a fronted modal, which is the same habit `US-182` minted the row for. `be.js`'s own header says the opposite of the old brief too: the row exists, nothing in *that file* emits it because every distractor there has its subject present. `US-192` is therefore a **second** producer, not the first, and is repriced accordingly |
| **`US-187` closes nothing in Sprints 5–7** | It is a guard on drill destinations, not content and not a surface | It did not close `US-605` (whose module had no caller), nor `US-702` (`questions` now exists and is empty), nor any Sprint 6 story. What it *did* close is one dead-button class: 25 live targets / 1 dead, against four dead at the start of the wave. **`US-605` has since closed on `US-136`, and the last dead target on `US-237`** — 26 live, 0 dead — neither of them by `US-187`, which is the point the row was written to make |
| **"the API is enhancement-only" is `CON-6`, not `NFR-8`** | `US-245` was briefed as an `NFR-8` violation, and the fix's own comment in `app.js` says `NFR-8` too. `NFR-8` is about the **service worker** | `REQUIREMENTS.md:700` — `NFR-8` is *"Media caching is explicit — audio requests are routed deliberately by the service worker, tolerate Range/206 responses, and never fall back to an HTML page"*, which the eighteen-second hang does not touch. The clause the defect actually broke is **`CON-6`** (`:726`): *"One optional API — `api.dictionaryapi.dev`, enhancement only · **Its failure must never block an exercise** or corrupt data"*, with `NFR-4` (`:696`) as the offline half. `US-245` is filed against `CON-6`/`FR-CNT-4` accordingly. **The stale citation is still in the source comment at `app.js:1600`** and is not fixable from this document |

---

## 5. Sprint 0 — unblock (do this first)

Not features. These make everything else possible, and two are already-live problems.

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| ✅ **US-001** | **Done 2026-09-12.** `jest@30.5.1` and `jest-environment-jsdom` declared and installed; the suites executed for the first time after thirteen waves. `package-lock.json` is no longer gitignored — the ignore line is replaced by a comment recording that CI runs `npm ci`, which refuses to install without a committed lockfile, and that ignoring it is why CI could never install jest | `NFR-16` | 1 | M |
| ✅ **US-002** | **Commit Phase 0** — **done 2026-09-08** | — | 1 | M |
| ✅ **US-003** | **Migrations wired into startup** — `migrateStoredProgress()` runs the chain after parse and before merge, takes a `backupOnce` first, stamps `schemaVersion`, and soft-fails if the module is absent — **done 2026-09-09** | `FR-DATA-1` | 2 | M |
| ✅ **US-004** | **`levels.js` wired in** — `resolveDifficulty()` normalises through `canonicalLevel()` at both entry points (storage and UI selector) and bridges canonical ids to the data keys that actually exist — **done 2026-09-09** | `FR-SES-3` | 2 | M |

> **US-003 acceptance:** Given a `learningProgress` with no `schemaVersion`, when the app loads,
> then the migration chain runs, `schemaVersion` equals `SCHEMA_VERSION`, a backup exists, and
> running it twice changes nothing.

**Why US-003 now:** the migration spine is written and tested but has never run against real data.
Do its first real run while nothing depends on it, not during Phase 2 when it is load-bearing.

**Sprint 0 total: 6 points — 6 of 6 done. Sprint 0 is closed.**

---

## 6. Sprint 1 — Honesty (Phase 1) · E1

**The highest-value sprint in the backlog.** No schema changes, ~a day's work, and it kills three
behaviours that teach errors.

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| ✅ **US-101** | Fix vocabulary quiz grading — **done 2026-09-08** | `FR-VOC-1` | 2 | M |
| ✅ **US-102** | Delete fabricated IPA — **done 2026-09-09** | `FR-VOC-3` | 1 | M |
| ✅ **US-103** | **Word-level read-aloud diff** replacing the substring match, LCS-aligned — **done 2026-09-09** | `FR-SPK-1` | 5 | M |
| ✅ **US-104** | Stable, retryable speaking target — **done 2026-09-09** | `FR-SPK-2` | 2 | M |
| ✅ **US-105** | Real quiz distractors — **done 2026-09-08** | `FR-VOC-2` | 2 | M |
| ✅ **US-106** | Differentiated speech-recognition errors — **done 2026-09-09** | `NFR-3` | 1 | M |
| ✅ **US-107** | Remove the unverified WCAG compliance claim — **done 2026-09-09** | `NFR-11` | 1 | M |
| ✅ **US-108** | Deterministic sentence exercise mode — **done 2026-09-09** | `FR-RDW-4` | 1 | M |
| ✅ **US-109** | **Statistics pipeline repaired** — all five types now route through `updateStatistics()`; `state.stats` retained for loading old saves but no longer written — **done 2026-09-09** | `FR-DATA-3`, `BR-8` | 3 | M |
| **US-130** | `loadProgress()` pushes `loaded.dailyStats` into `dailyHistory` and then overwrites `dailyHistory` from storage two lines later, dropping yesterday's stats on any day rollover | `FR-DATA-3` | 2 | M |
| ✅ **US-131** | **Fixed ladder implemented** — `INTERVAL_STEPS = [1,3,7,16,35]`, held at 35, rung from `reps` alone so nothing compounds. Forward-only, no stored record recomputed. Pinned assertion flipped in the same change — **done 2026-09-10** | `FR-SRS-2` | 3 | M |
| **US-132** | Dictation and scramble toast a hardcoded "Please enter your answer" for *any* validation failure, contradicting the inline message (paste 600 chars and it tells you to enter an answer you did enter) | `NFR-3` | 1 | S |
| **US-133** | Drag/drop toasts blame the learner for app-supplied data: "Invalid word detected", "Invalid drop operation" | `BR-3` | 1 | S |
| ✅ **US-134** | IIFE global-object bug fixed in `mistakes.js` (`srs.js` was already fixed). Note it never bit the jest suite, because jsdom makes `window === global` — so a behavioural test could not have caught it; pinned by a source check instead — **done 2026-09-09** | — | 1 | S |
| **US-135** | `js/core/portability.js` borrows `.daily-goal` styling for the data panel; a dedicated `.data-controls` class would read better | — | 1 | C |
| ✅ **US-136** | **`js/core/blobstore.js` has a caller.** `RecordingArchive` in `app.js` wires it into the listening/read-aloud path and the pronunciation self-comparison, so a recording survives leaving the sentence and `TEACHING_METHODOLOGY.md`'s *"keep the recording; progress over weeks is the reward"* is met. **`promptId` is derived from content, never an index**: `'<kind>:' + ID_VERSION + ':' + digest(contentKey(text))`, where `contentKey()` NFKC-normalises, drops apostrophes (so `don't` / `don’t` / `dont` agree), collapses non-alphanumerics and lowercases — so the id is keyed on what the learner actually said. `ID_VERSION` exists so that a future change to the derivation becomes a **visible new namespace** rather than silent orphaning. Pronunciation uses `pair.id` verbatim, which is already stable authored identity. **The stability proof ran, it was not asserted**: inserting a sentence at the front of a tier moves the learner's sentence to index 1 with the same id and it still resolves to the right sentence against a rebuilt catalogue; reversing a tier permutes ids identically; `rate`/`seconds`/`situation`/`focus`/`notes`/`shadow`/`questions`/`tier` all change without moving the id. **Editing the sentence itself does move it, and must** — otherwise the learner's voice plays against words they never said (`US-241` is the opt-out for a genuine typo fix). Structural guard: `currentListeningIndex` appears nowhere in the module and no archive call takes an index. Every failure mode surfaces BlobStore's own copy plus what still works, and with `available()` failing the exercise still completes. Verified by use: a 4th recording keeps the pinned baseline and drops the second-oldest, no object-URL leak across a 6-cycle Prev/Next walk, and `release('listening')` does not stop pronunciation playback — **done 2026-09-12** | `FR-DATA-6`, `FR-SPK-6` | 3 | S |
| **US-137** | Wire `js/core/mistakes.js` into the wrong-answer paths and add the dashboard panel. Calls must sit behind the existing single-answer guards or one stubborn item becomes a whole diagnosis | `FR-SRS-3` | 3 | M |
| ✅ **US-138** | **The export covers recordings — as two artefacts, not one.** The readable data file is **byte-for-byte unchanged when no archive summary is passed**, and `FORMAT_VERSION` is deliberately **not** bumped (still 1), so every already-deployed build reads a file written by this one; the container carries its own independent `RECORDINGS_FORMAT_VERSION`. **Inlining as base64 was rejected on arithmetic, not on taste**: a 50MB archive becomes ~67MB that must exist as ONE JavaScript string — ~134MB of UTF-16 heap before the stringify copy, against the 3GB Android floor in `NFR-6` — and it would have forced `MAX_IMPORT_BYTES` from 8MB to ~70MB **for every import**, so one mis-picked file would get 70MB of parsing instead of a fast refusal. `MAX_IMPORT_BYTES` is untouched at 8MB. The container concatenates payloads **by reference** and reads them back with `file.slice()`, so audio bytes never become a string in either direction. Metadata-only was rejected against `BR-7` — but **kept as a manifest inside the readable file**, with `audioIncluded: false` written unconditionally and never computed, so a build that cannot restore audio cannot be told by a file that it can. **The restore is additive, not a replacement**: the file is the recovery copy for whatever did not land, and duplicates are recognised by `(promptId, createdAt, size)`, so restoring the same file twice is a no-op. Needed one `blobstore.js` change, with ten tests of its own (241 → 250): `put()` now honours a supplied `createdAt` and `baseline`, because otherwise every restored recording is stamped with the **restore's** clock and rescuing the archive is the act that destroys `FR-SPK-6`'s month-one-against-month-three comparison. `baseline` is **clamped to false** when the prompt already has one — two baselines at one prompt is `US-222` one level down, where `planRetention()` credits one slot while `evictionCandidates()` protects every flagged row, so `commit()` would delete a pinned baseline. Portability suite 210 → **364 tests**, 97.51% → **98.75% statements**. Closes the named residue of `US-605` — **done 2026-09-16** | `FR-DATA-4` | 3 | M |
| ✅ **US-139** | `FR-DATA-6`/`OQ-6` amended to the pinned-baseline retention the code implements — **done 2026-09-09** | `FR-DATA-6` | 1 | M |
| ✅ **US-140** | `checkDictation`'s fake similarity (`sim = exact ? 1 : 0.5` then `if (sim > 0.8)`) replaced by **reusing the existing LCS word diff (`diffSpeechAttempt`)**, not a new similarity score: dictation has an exact known target, so "which words are missing" is the only actionable question, and a number cannot say *where*. Grading is no more generous than the exact comparison it replaced — `right = diff.allMatched && extra.length === 0`, the extra-word check added because LCS alone would pass a learner who typed every target word plus three of their own. Levenshtein appears but never as the grade, only to separate `vocab.spelling` from `lsn.detail` — **done 2026-09-12** | `FR-GRM-2` | 2 | M |
| ✅ **US-141** | `checkComprehension` gave a red mark with no fix on screen. A wrong answer now shows the chosen option, the correct one, a retry, and an `In the passage: "…"` citation printed **only** when exactly one sentence contains every content word of the answer. The ✓ stays for all-right — comprehension *is* objectively gradable — but "Perfect!" and the exclamation marks are gone, per the tone rule — **done 2026-09-12** | `FR-A11Y-5` | 2 | M |
| **US-142** | Grammar authoring: 6 practice items is too few for high-frequency points. Recommend 6 as a floor and 12 for the top four points | `FR-GRM-1` | 2 | S |
| **US-143** | `data/l1/telugu.js` does not exist, so the 21 `T-`coded mistake categories live inline in `mistakes.js` rather than in a pluggable L1 profile | `FR-CNT-3` | 2 | S |
| **US-144** | **`window.AppErrorHandler` was undefined**, because `const` at the top level of a classic script is a lexical global, not a `window` property. Every `global.AppErrorHandler` guard in `srs.js`, `blobstore.js`, `mistakes.js` and `portability.js` was permanently false — core-module error logging was a silent no-op. Fixed 2026-09-09 | `NFR-3` | 1 | M |
| **US-145** | `markExerciseComplete` is never called for `vocabulary` or `puzzles`, so those completion sets stay permanently empty and vocabulary never shows ✓/Retake however many quizzes are answered | `FR-DATA-3` | 2 | M |
| ✅ **US-146** | Progress bar could exceed 100% (8 ticked of 7) when a restored backup carried a goal key no section owns — the merge accepted arbitrary keys from storage. Fixed as part of US-163 — **done 2026-09-10** | `FR-DATA-1` | 1 | S |
| **US-147** | `updateStatisticsDisplay` still hardcodes all five sections across three `innerHTML` blocks — the last un-collapsed site after the registry refactor | — | 2 | S |
| ✅ **US-148** | `PROJECTORS.phon` validated per shape against real content; `auditProjection()` reports `shape` and warns by name when no shape matches — **done 2026-09-10** | `FR-GRM-3` | 1 | M |
| ✅ **US-149** | `data/grammar.js` is now loaded and precached; the Grammar section reads it — **done 2026-09-09** | `FR-GRM-1` | 1 | M |
| ✅ **US-150** | **Done 2026-09-10.** All 8 pair sets: vowels T-P7/8/9 + consonants T-P5/T-P6(×2)/T-P10/T-P11, 78 minimal pairs, plus 21 stress items and 15 prosody noticing items | `FR-PRN-1` | 5 | M |
| ✅ **US-151** | **All three points authored** — articles (#3), be (#1, T-G2), countable-uncountable (#4). Wired and registering — **done 2026-09-10** | `FR-GRM-1` | 5 | M |
| ✅ **US-501** | **Grammar section exists** — registry row, markup, loader, and feedback that teaches: every wrong answer shows the authored reason, a contrast pair and a retry, with defensible alternatives accepted. Scheduled as a `gram:` SRS item — **done 2026-09-09** | `FR-GRM-1`, `FR-GRM-2`, `FR-GRM-5` | 3 | M |
| ✅ **US-152** | Grammar tier double-count fixed via an additive optional level parameter — verified 2 → 1 — **done 2026-09-10** | `FR-DATA-3` | 2 | M |
| ✅ **US-153** | Tier availability resolves against each section's own content via `Sections.registerContent()`; the grammar loader's local workaround removed — **done 2026-09-10** | `FR-SES-3` | 2 | M |
| **US-154** | `updateDashboard`/`updateStatisticsDisplay` are the last non-registry-driven per-section code; grammar had to be added to three blocks by hand | — | 2 | S |
| **US-155** | `srs.js` lapse sets `interval = 0, due = now`, but `TEACHING_METHODOLOGY.md` §3 and `FR-GRM-3` both say a lapse resets to **1 day**. Related to `OQ-10` | `FR-SRS-2` | 1 | S |
| **US-156** | `data/grammar.js`'s own SRS PROJECTION CONTRACT recommends `difficulty`, which no grammar lesson has — following it would re-introduce the phantom-field bug | — | 1 | S |
| **US-157** | Grammar practice modes `choose`, `repair` and `order` are reserved in the schema but unimplemented; the section shows an honest count of skipped items | `FR-GRM-1` | 3 | S |
| **US-158** | No `state.learnerL1`, so the Telugu note renders only when content offers exactly one L1. A real profile field replaces one line | `FR-CNT-3` | 1 | S |
| ✅ **US-159** | Routing reconciled — `gram.uncountable-plural` widened to cover `-s`, article and bare-number shapes rather than adding a second row that would split one habit across two drills — **done 2026-09-10** | `FR-SRS-3` | 2 | M |
| ✅ **US-160** | `MISTAKE_CATEGORIES` deleted; the guard now asks `Mistakes.unknownCategories()` about ids the content actually declares — **done 2026-09-10** | — | 1 | S |
| ✅ **US-161** | Stale projection-contract comment rewritten to point at `srs.js` and `auditProjection()` as the authority rather than copying a list — **done 2026-09-10** | — | 1 | M |
| ✅ **US-162** | Prerequisite cycle removed; acyclicity proven by Kahn + DFS — **done 2026-09-10** | `FR-GRM-1` | 1 | S |
| ✅ **US-163** | `updateDashboard` and `updateStatisticsDisplay` now registry-driven; the false header claim in `sections.js` corrected. Adding a section drops **8 edits → 4** — **done 2026-09-10** | — | 2 | M |
| ✅ **US-164** | `ð-d` now reachable — `prn.th` gained `alsoTargets`, keeping one category and one count while routing both drills — **done 2026-09-10** | `FR-SRS-3` | 1 | M |
| ✅ **US-165** | Four `logAs` sites converged; all five uncountable shapes now produce one finding, one count, one drill — **done 2026-09-10** | `FR-SRS-3` | 1 | M |
| ✅ **US-166** | **Six items across `data/grammar/countability.js` and `data/grammar/present-perfect.js` listed an accepted answer absent from their own `options`** — and the grader was never the problem, because **there is no typed-input path in the grammar section at all**, so those answers were unreachable by any learner. Four of the six also set `showDifferenceOnCorrect: true` with only ONE reachable accepted answer, so the app announced *"Both answers here are right, and they do not mean the same thing"* and then named an answer it had never shown (`US-188` is the renderer half of that). Fixed **per item**, not by one rule: five demoted to `fallbackFeedback` (each a true synonym or off-focus), one promoted into `options` — `is`/`was` genuinely differ in time, and that option set could only represent the past as an error. **A third class was found and it is not this defect at all:** `present-perfect-vs-past-simple-p1`'s `"did see"` was not right-but-unreachable, it was **wrong** — emphatic `did` needs a claim to contradict, and the entry's own `means` had to invent one to justify itself. Also corrected `data/grammar.js`'s schema header, which had **sanctioned** the pattern on the false grounds that *"typed input outside `options` is what `fallbackFeedback` is for"* — the header was teaching the next author to reproduce it. Unblocks `US-248` — **done 2026-09-16** | `FR-GRM-5` | 2 | M |
| ✅ **US-167** | Prosody projectors fixed as part of US-171 — stress 3 → 17 projected fields, noticing 3 → 21 — **done 2026-09-10** | `FR-PRN-3`, `FR-PRN-8` | 5 | M |
| ✅ **US-168** | `ttsUse` enum added per `minimalPairs` row (58 of 78 flagged: 42 prefer, 7 clip-only, 6 verify, 3 clip-first) — **done 2026-09-10** | `FR-PRN-1` | 2 | S |
| ✅ **US-169** | Five theme-aware `--panel-*` tokens plus `--text-accent`; the `.pron-*` workaround removed. **Contrast computed, not asserted** — worst case 5.93:1 light / 5.95:1 dark, all AA — **done 2026-09-10** | `NFR-11` | 1 | S |
| ✅ **US-170** | **Start-today's-session UI shipped** — Start button, chrome, per-step Done/Skip, the three-way speaking choice, `omitted`/`shortfall` rendered rather than swallowed, resume banner, wrap-up. Completable start to finish with no mic — **done 2026-09-10** | `FR-SES-1`, `FR-SES-5` | 5 | M |
| ✅ **US-171** | **Scheduler half done** — `PROJECTORS.phon` split into 3 shapes (pair/stress/noticing), `RENDERABLE` now gates on the fields each card needs, `getDue()` returns `shape`. Found a 4th affected key the report missed: `phon:word-stress`, 21 items. The `app.js` review surface is **`US-177`** — **partly done 2026-09-10** | `FR-SRS-1`, `FR-GRM-3` | 5 | M |
| **US-172** | `markExerciseComplete` pushes to `exerciseHistory` unconditionally while counters are guarded, so re-completing appends a duplicate record. Affects all seven sections; the field is undocumented either way | `FR-DATA-3` | 1 | S |
| **US-173** | `.exercise-card` hard-codes `background: #f9f9f9` and `.instruction` `#555`. Fixed scoped to grammar/pronunciation only, because the legacy blocks below hard-code `background: white` — flipping the card globally would trade light-on-light for dark-on-dark | `NFR-11` | 2 | S |
| **US-174** | Decorative 4px accent stripes are below the 3:1 non-text threshold on light tints (2.07–2.43). Pre-existing, unchanged by the theme fix | `NFR-11` | 1 | C |
| ✅ **US-175** | Listening dashboard stat card added; verified populating with the dashboard otherwise byte-identical — **done 2026-09-10** | — | 1 | S |
| **US-176** | The Alt+N shortcut ceiling is a single-character comparison, so it silently stops working at 10 sections | — | 1 | C |
| ✅ **US-177** | **Typed review surface shipped** — 5 of 6 shapes render (`coll` declared unrenderable: no content, unverified projector). Grammar reviews show `review.rulePrompt` + the `itemIds` subset (634 chars vs the lesson's 6,006), not the lesson again. Badge === what the button opens, with held-back items named — **done 2026-09-10** | `FR-SRS-1`, `FR-GRM-3` | 5 | M |
| ✅ **US-178** | **`BR-2` reachable above foundation** — `present-perfect-vs-past-simple` is the first `everyday`-tier point. Verified: `everyday` now plans BCDE with production and zero shortfalls — **done 2026-09-10** | `BR-2` | 3 | M |
| **US-179** | `pron.produce` can never open from inside a session: the gate needs 10+ attempts at 80%+ on one pair, but the session's pronunciation step is count-boxed at ~8 items | `FR-PRN-6` | 2 | S |
| **US-180** | Records written under the old flat `phon` projector store 3 fields, so they count as due but not actionable until re-scheduled. They heal on the next `scheduleItem()` with history intact — no data rewrite | `FR-SRS-1` | 1 | S |
| ✅ **US-181** | **Mistake panel shipped** — top-5 over 30 days, raw counts (never the weighted score), recogniser-sourced entries kept separate, `'unclear'` trends rendered as unclear, drill buttons skipped when not drillable — **done 2026-09-10** | `FR-SRS-3` | 3 | M |
| ✅ **US-182** | `gram.subject-dropped` added — a new row rather than widening `gram.copula`, because the remediation differs; honest that English does drop subjects in clipped registers — **done 2026-09-10** | `FR-SRS-3` | 1 | S |
| **US-183** | `renderGrammarCorrect` prints "Both answers here are right" over a list, misreading for `be-p5`'s three accepted answers; `completeGrammarPoint` hardcodes "All six done" | — | 1 | S |
| **US-184** | `updateStatisticsDisplay`'s three `statBox` calls still use `innerHTML` — the last HTML-string path on the dashboard | `NFR-12` | 1 | S |
| ✅ **US-185** | **`gram.tense-agreement`'s label was false for 100% of what routes to it**, and the brief undercounted the producers: it said **three, all in `be.js`**; there are **six**, because `past-simple.js` added three pointing the *opposite* way (a present form in a closed past context, against `be.js`'s three past-in-present). A label naming either direction would have been false of the other half. Fixed by moving the **label, not the producers**: "Past tense not carried through the whole sentence" (a multi-clause error, which none of the six are) becomes **"A verb in the wrong time for the rest of the sentence"**, true of all six. `gram.verb-form` was considered as their destination and **rejected**: its label makes a positive claim — "Right tense, wrong form" — that is false of all six and true of its own fifteen. The two rows divide on **which time** versus **which shape**. Id kept, because `record()` writes it into `mistakeLog` and a rename would stop describing history rather than move it; nothing needs migrating, since every stored entry came from one of the six sites and the new label is true of all of them — **done 2026-09-12** | `FR-SRS-3` | 2 | M |
| ✅ **US-186** | Producers wired for `vocab.meaning` (vocab quiz and review card), `vocab.spelling` + `lsn.detail` (dictation), `gram.word-order` (sentence builder), and `q.mistakeCategory` authored for comprehension — all `EVIDENCE.GRADED`, all behind the existing single-answer guards, verified by answering wrong twice and getting one entry. **Four categories still have no producer, deliberately, because no gradable task exists to attach them to**: `vocab.recall` (no production-from-meaning task), `vocab.collocation` (no collocation content), `lsn.gist` (the listening section asks no comprehension question), `rdw.inference` (comprehension questions carry no type metadata, so logging every wrong answer as "needed reading between the lines" would be a false claim — a content hook was added so an author can produce it without touching `app.js`). No category id was invented — **done 2026-09-12**. **Re-checked after `US-701`:** `lsn.gist` still has **no** producer, deliberately. The `questions` field now merely *exists* on every listening item (`[]` when absent); the section still asks no comprehension question, and it will not until `US-702` authors one. **Corrected 2026-09-16 — it is three categories, not four.** `vocab.collocation` acquired a producer at `US-225` and this row was never amended: `data/grammar/prepositions.js` routes **12** arbitrary-partner misses to it, and `US-244` added **2** more in `data/grammar/gerund-infinitive.js`. Both are deliberate — the arbitrary half of a preposition or a verb pattern is a memory gap, not a grammar gap, and logging it as grammar would report a weakness the learner does not have. Content came from an unexpected direction: the collocation *drill* `US-708` still does not exist, but grammar content produces the category, which is why the "no collocation content" wording went stale unnoticed. **The same stale claim is still in the source comment at `js/core/mistakes.js:199`** | `FR-SRS-3` | 3 | M |
| ✅ **US-187** | **`drillTarget()` composed `gram:<slug>` with no check anything was authored under it.** Fixed by making content declare its own destinations: new `registerDrillTargets(strand, targets)`, mirroring `registerCategories()` — chosen over an `app.js`-injected predicate (`FR-CNT-3` forbids it, and it is unusable in the unit suite) and over making the caller prove it (the status quo, and there are already two callers). **Tri-state**: `authored` is `true`/`false`/`null`, where `null` means *no claim* — the state at first load and throughout the suite. Answering `false` there would blank every drill button in the app on the strength of a registration that had not run. Nothing is dropped from the return value: a category whose lesson does not exist is still a real weakness. Three call sites wired — registration at boot in `app.js`, read from `grammarLessons` and the content helpers and never a hand-written list, so a new content file needs no second edit; an `authored === false` early return in `mistakeDrillDestinations()`; and the same guard in **`js/core/session.js`, which was the real learner-facing bug** — it put an unchecked `gram:past-simple` into session plans and told the learner *"Targeting your most frequent recent error"* for a lesson that did not exist. Verified against the real content: `null` before registration, then **25 live / 1 dead**. Only `gram:register` was still dead, down from four at the start of the wave — and **`US-237` authored it later the same day, so the figure is now 26 live / 0 dead**. The registry is **all-or-nothing per strand** — a partial registration is worse than none, since registering one grammar point would blank the other seven's buttons — **done 2026-09-12** | `FR-SRS-3` | 2 | M |
| ✅ **US-188** | Fixed with `US-166` in one change, because they are the two halves of one false claim: the renderer asserted a difference the content could not have, and the content offered answers the renderer could not reach. Every surviving `showDifferenceOnCorrect` item now has **at least two reachable accepted answers that genuinely differ in meaning**, and true synonyms are `fallbackFeedback` instead — so the sentence *"Both answers here are right, and they do not mean the same thing"* is true wherever it still prints. The workaround the two earlier authors used (excluding synonyms from `accept`) is now the documented rule in `data/grammar.js`'s header rather than folklore — **done 2026-09-16** | `FR-GRM-5` | 1 | M |
| **US-189** | `data/pronunciation/consonants.js` has no `module.exports`, unlike every other content file, so `require()` returns `{}` and no jest test can audit its four category ids | — | 1 | S |
| **US-190** | No mistake row for aspect confusion between perfect and continuous ("she's had lunch" for "she's having lunch"). Suggested: `gram.aspect-perfect-vs-progressive`, drill `present-simple-vs-continuous` | `FR-SRS-3` | 1 | S |
| **US-191** | `switchSection()` does not exit review mode, so navigating away mid-review and back re-shows the card. Pre-existing, not a regression | — | 1 | S |
| **US-192** | Wire `gram.subject-dropped` into `be.js`: add `"am"` to `be-p2`'s options **with** a `feedback` entry carrying `logAs`, plus a `rendersAs`. Without the feedback entry it falls through to `fallbackFeedback`, which has no `logAs`, so it would log the default `gram.copula` — the false label the new row exists to remove. **Repriced `M` → `S` on 2026-09-12** (see §4a): `US-236` gave the row a producer in `data/grammar/modals.js` (subject omitted after a fronted modal), so this is a **second** producer widening coverage rather than the one thing standing between a live category and never ranking. Nothing currently mislabels, because `be-p2` offers no `"am"` option at all | `FR-SRS-3` | 1 | S |
| ✅ **US-193** | **`portability.js` suite written — 0% → 96.44% statements, 179 tests.** Found **three real defects** (see `US-198`–`US-200`). 44 rejection cases table-driven, each asserting the store is byte-identical afterwards — **done 2026-09-12**. **Grown by `US-138`: 364 tests, 98.75% statements, 93.96% branch, 99.39% funcs, 99.86% lines** — the recordings container is where most of the growth went, and the byte-identical assertion is now also the guard on `FORMAT_VERSION` not moving | `NFR-16`, `FR-DATA-4` | 3 | M |
| ✅ **US-194** | **`js/core/blobstore.js` suite written — 0% → 98.78% statements / 92.33% branch / 99.29% funcs, 211 tests.** Needed a hand-built fake IndexedDB: spec key ordering, `IDBKeyRange.bound`, `autoIncrement`, compound-index `getAll`, abort-rollback, and a settable byte budget that throws `QuotaExceededError`. Found **five defects** (`US-216`–`US-220`) plus `US-221`/`US-222`; the single uncovered line is the dead code `US-221` names — **done 2026-09-12**. **The suite has since grown with the fixes it prompted: 250 tests, 99.46% statements, 93.53% branch, 99.33% funcs, 100% lines** (`US-227`, `US-228`, and the ten `US-138` added for `put()`'s `createdAt`/`baseline` arguments) | `NFR-16`, `FR-DATA-6` | 3 | M |
| **US-195** | **Version skew unverified:** every suite was authored against jest 29 conventions by agents that could not run either version; `jest@30` is installed. Jest 30 changed some `toEqual` and mock semantics, so a green run is reassuring but a failure should be checked against the version before the assertion | `NFR-16` | 1 | S |
| **US-196** | `jest.config.js` deliberately has no `coverageThreshold`, with a comment saying to add one once the core modules are under test. Six modules are now at 85–100%, so a floor can be set — but only after `US-193`/`US-194`, or it locks in the two 0% modules | `NFR-16` | 1 | S |
| ✅ **US-197** | **Word-stress and prosody content now browsable in the Pronunciation section** — all 21 stress and 15 noticing items reachable without needing a review scheduled first; ungradable items are dropped loudly, and `requiresImitation` is refused per `FR-PRN-8` rather than trusted — **done 2026-09-12** | `FR-PRN-3`, `FR-PRN-8` | 5 | M |
| ✅ **US-211** | **`session.js` honoured an injected clock in `build()` but not on the walk path**, so `plan()` compared a test-stamped date against the wall date and `current()` returned null. The suite was green for its author and failed the next morning — 15 failures, no code change. Fixed with a `_now()` seam — **done 2026-09-12** | `NFR-16` | 2 | M |
| ✅ **US-212** | `jest.config.js` collected `__tests__/setup.js` as a test suite — one red suite that said nothing about the code — **done 2026-09-12** | `NFR-16` | 1 | M |
| ✅ **US-213** | **Two `mistakes` tests asserted nothing:** they patched `localStorage.setItem` on the instance, which jsdom does not honour, so the throw never fired and `save()` legitimately returned `true`. They passed under the plain-node shim — exactly the class of defect only a real jest run catches — **done 2026-09-12** | `NFR-16` | 1 | M |
| ✅ **US-198** | **`resetReviewHistory()` reported success when the removal failed.** Fixed: it now decides its verdict by **reading `srsData` back**, as `rollback()` already did, and resyncs the in-memory records so the due badge cannot read zero over a history still on disk. A read-back that itself throws reports a third honest outcome, `reset-unverified` — *"may not have been cleared… Reload the page to see where things stand"* — rather than guessing — **done 2026-09-12** | `FR-DATA-5`, `BR-3` | 2 | M |
| ✅ **US-199** | **`MESSAGES.rollbackFailed` could name a recovery key that was never written.** Fixed by telling the truth rather than refusing: refusing to commit when no recovery copy could be taken would deny a restore to precisely the learner with a full device, because the commit *removes* keys before writing and so routinely fits where an extra whole-store copy did not. Three distinct outcomes now — `rollback-failed` (a copy exists), `rollback-failed-no-backup` (names no key, points at the file as the one recoverable thing), `rollback-failed-nothing-lost` — **done 2026-09-12** | `BR-7` | 2 | M |
| ✅ **US-200** | `resetReviewHistory()` filed its backup under the current `SCHEMA_VERSION`, naming a version the data was not. Fixed: new `versionOfRawSrs()` decides the era by **shape**, mirroring `migrations.js` — any untyped record key, or a legacy level alias in `rec.data.difficulty`, means era 1. Unparseable data reads as the current build, not 1: we cannot claim an era we could not inspect — **done 2026-09-12** | `FR-DATA-5` | 1 | S |
| ✅ **US-214** | **An srsData-only import DELETES `learningProgress`** — resolved as **behaviour correct, copy was not**. Replacement rather than merge is right: `rollback()` depends on `before` being a whole state, and a restore that silently kept leftovers is the worse lie. Code unchanged; the confirm copy is now built per file by `importConfirmMessage(plan)`, naming what *that* file will remove in learner words, with unnamed future keys counted rather than shown as raw storage keys. 11 new tests — **done 2026-09-12** | `FR-DATA-4`, `BR-7` | 2 | M |
| ✅ **US-209** | A settings-only export reported `ok` but was rejected `no-data` on import. Resolved as **keep the refusal, fix the claim**: loosening `validateExport` would let one mis-picked settings-only file wipe a populated device to rescue a theme toggle. `exportToFile()` now returns `restorable` and a message, and a file with neither progress nor review history is reported in the `info` tone, not `success`. A test asserts the very file just written *is* refused `no-data` — **done 2026-09-12** | `FR-DATA-4` | 1 | S |
| **US-210** | `TextEncoder` is absent from `jest-environment-jsdom` 30, so `byteLength()` silently falls back to `String.length` and every byte figure (`MAX_IMPORT_BYTES`, `storageInfo()`, export size) is validated in **UTF-16 code units, not UTF-8**. A test pins the fallback so it fails loudly if the environment changes | `NFR-16` | 1 | S |
| ✅ **US-207** | `portability.js`'s `suspended` flag was a one-way module-level latch, giving the suite an ordering dependency. Seam added (`_resetWritesSuspended()`); the suite now passes under `--randomize` across three seeds — **done 2026-09-12** | `NFR-16` | 1 | S |
| ✅ **US-208** | The post-import reload was the module's only unreachable line. Seams added (`_reload()`, `_canReload()`) — a second seam was needed because jsdom's `location` is `[Unforgeable]`, so `delete window.location` is a silent no-op — **done 2026-09-12** | `NFR-16` | 1 | S |
| ✅ **US-215** | **`data/grammar/question-formation.js` authored** — syllabus point 6, `foundation` tier, T-G5 invariant-tag + T-G8 embedded-question-order notes; wired into `index.html` and the service-worker precache. **Closes three dangling drill targets**: `gram.tag-question`, `gram.embedded-question-order` and `gram.word-order` in `js/core/mistakes.js` all point at `question-formation`, so until now those dashboard drill buttons opened nothing — all three verified resolving to `gram:question-formation`. 6 gap items, 3 contrast pairs; every accepted answer is among its options (`US-166`). The adversarial pass **accepted a second correct answer** on two items (`do you live`/`are you living`, and the same-polarity tag `aren't you`/`are you`) rather than marking real English wrong. `foundation` now has 5 points; `everyday` still 1 — **done 2026-09-12** | `FR-GRM-1`, `FR-SRS-3` | 3 | M |
| ✅ **US-216** | **`put()` reported `full` — *"Your existing recordings are safe"* — after permanently deleting an existing recording.** Resolved by **a third option, neither of the two offered**: property 2 promises every write is one transaction, so the defect was that `evictForQuota()` existed as a *separate* transaction at all. The quota retry now frees headroom **inside the retrying transaction**, so a second `QuotaExceededError` aborts and rolls the eviction back with it; `evictForQuota()` is deleted. Restore-from-memory was rejected as asking a device that has just proved it has no room to hold megabytes of audio and find room again. Stated cost: an engine that does not credit in-transaction deletes against its own quota will refuse a retry that a separate eviction might have allowed — a **refusal, never a loss** — **done 2026-09-12** | `NFR-10`, `BR-3`, `FR-DATA-6` | 3 | M |
| ✅ **US-217** | `removeIds()` now resolves with the ids that **were there and are now gone**, not the ids it was asked for — the read and both deletes share one transaction, so nothing can appear or vanish between asking and acting. `IDBObjectStore.delete()` succeeding silently on an absent key is why the read is required — **done 2026-09-12** | `BR-3` | 1 | S |
| ✅ **US-218** | Copy now names **where the space came from** rather than assuming this prompt: `savedFreedSpace` / `savedEvictedAndFreedSpace` are separate messages from `savedEvicted`, and the result carries `evictedPrompts` (this prompt included) plus `evictedElsewhere`, so a UI can name the prompt that actually lost something — **done 2026-09-12** | `BR-3`, `FR-DATA-6` | 1 | S |
| ✅ **US-219** | `readRecord()` added beside `get()`: `get()` keeps its documented "record or null" contract, and the new function returns the reason, with `OPEN_FAILURE_CODES` separating "this device is not keeping recordings right now" from "that recording is not here". `openUrl()` reads the reason, so a learner whose browser blocked IndexedDB is no longer told their recording was deleted when it was never saveable — **done 2026-09-12** | `NFR-3`, `BR-3` | 1 | S |
| ✅ **US-220** | Both halves fixed, and **the null-`createdAt` half proved demonstrable rather than only spec-derived**: `cleanNumber` accepts only numbers and non-blank numeric strings so one recording can no longer have two durations, and a row with no `createdAt` is rejected on the same footing as a row with no `promptId` rather than being coerced to the epoch by `usableRows` and acted on while invisible to `list()` — **done 2026-09-12** | `FR-DATA-6` | 2 | S |
| ✅ **US-221** | Dead guard deleted and the invariant made **structural** — `MAX_RECORDING_BYTES = Math.min(10MB, MAX_TOTAL_BYTES)`, with a test grepping the source so the unreachable branch cannot return — **done 2026-09-12** | — | 1 | C |
| ✅ **US-222** | The persisted `baseline` flag wins, via a shared `isPinnedBaseline()` used by both `planRetention` and `evictionCandidates`, **because it is the only definition that can be *true*** — re-deriving baseline from position would let a later recording claim to be the learner's month-one after the true baseline is deleted — **done 2026-09-12** | `FR-DATA-6` | 1 | S |
| **US-223** | **The sentences section still violates `FR-GRM-2`/`FR-A11Y-5`**: `✗ Incorrect. Try again! (Attempt 1/3)` — a red ✗ with no reason, no contrast, and the hint only after three attempts. The last section with this shape after `US-140`/`US-141`. Fixing it needs **authored per-option feedback** like `data/grammar/` has, not copy written in `app.js` | `FR-GRM-2`, `FR-A11Y-5` | 2 | M |
| ✅ **US-224** | Resolved by **adding `gram.auxiliary-omitted`** — "A question with its helper word missing", drill `gram:question-formation`. Argued from the panel rather than the taxonomy: `gram.word-order` already had three producers, and "Words in the wrong order" is **false** of an omitted auxiliary — in *"Where you live?"* every word is where English wants it. Already-logged entries stay under `gram.word-order` and **cannot be migrated**, because `record()` stores no `errorKind`, so the log physically lacks the fact a migration would need; the 30-day window ages the mislabelled history out inside a month. Category count 35 → 36 — **done 2026-09-12** | `FR-SRS-3` | 1 | S |
| ✅ **US-225** | **`data/grammar/prepositions.js` authored** — T-G7, `foundation`, syllabus point 7. Makes `gram.preposition-transfer` a live drill target. Its central decision: *"discuss about"* and *"good in maths"* are **not the same error** and are never described in the same sentence. The first is a redundancy the learner can detect by paraphrasing the verb (*discuss* = "talk **about**"); the second is arbitrary and is stated as memory work with no invented rule (`BR-3`). **The split is in `logAs`, not just prose** — arbitrary misses log `vocab.collocation`, so they do not report a grammar gap the learner does not have. Guard-rails against over-deletion (*shouted at* / *shouted to*) keep the framing from teaching that prepositions can be dropped generally. Standard Indian English handled as audience, not correctness, following `question-formation.js` — **done 2026-09-12** | `FR-GRM-1`, `FR-SRS-3` | 3 | M |
| ✅ **US-226** | **`data/grammar/past-simple.js` authored** — **T-G6** (not T-G9; see §4a), `foundation`, syllabus point 5. Makes both `gram.tense-agreement` and `gram.verb-form` live. Its hard part was not contradicting `present-perfect.js` (point 9, `everyday`): both files state a **one-way blocking condition** rather than two competing rules. Two traps avoided — never "a named time" alone (*since Monday* is a named time that does **not** block the perfect, and point 9 grades it perfect-only), and never "the past simple is for finished actions", which would contradict point 9 head-on, since *I have finished* is exactly as finished as *I finished*. The distinction is finished **time**. Adds what point 9 lacks: `did` + bare infinitive, irregular pasts as memorised items, and the finished-time trigger — and connects `did` to `question-formation.js`'s helper framing rather than presenting it as a new fact — **done 2026-09-12** | `FR-GRM-1`, `FR-SRS-3` | 3 | M |
| ✅ **US-227** | Resolved as **keep `ok: true`, fix only the claim**: `removeForPrompt('nosuchprompt')` now returns `MESSAGES.nothingToRemove` — *"There was nothing to delete — this prompt has no saved recordings on this device."* The distinction that decided the `ok` half: `removeForPrompt` names a **state** ("this prompt keeps nothing"), which holds when it returns, whereas `remove(id)` names **a thing**, which either existed or did not. `ok: false` was rejected twice over — it would paint a red failure over a satisfied request, and it would force every caller to special-case one failure code as success, which is a contract that teaches callers to ignore `ok` — **done 2026-09-12** | `BR-3` | 1 | S |
| ✅ **US-228** | Resolved as **count and report, touch nothing**. New `strandedSummary()`, `usage().strandedCount` / `.strandedBytes`, `clear().strandedRemoved`, and `commit()`'s cap arithmetic now counts stranded bytes against the budget, with a new `MESSAGES.fullUnmanaged` for the case where a write *would* have fitted but for them. **Repair was rejected as self-defeating**: rewriting `createdAt` invents a date, and a repaired row is unflagged and dated to the epoch, so it becomes the oldest unprotected row and the next eviction takes it — repair is deletion with a fabricated date on the way. Deleting fails `BR-7` outright, and since the likeliest author of such a row is *this module before `US-220`*, the likeliest content is the learner's own. The tie-break between the two remaining options is which way each fails: ignoring fails **toward loss** (the cap is computed over a total that is not the total, so the eventual quota retry pays for invisible bytes by evicting real recordings), counting fails **toward a refusal** — **done 2026-09-12** | `FR-DATA-6` | 2 | S |
| ✅ **US-229** | Resolved as **ONE row**: `gram.auxiliary-omitted` widened to **"A question or a negative with its helper word missing"**. Argued from the panel rather than the taxonomy — each shape has exactly one producer, so two rows of one producer each, ranked in a **top five**, means a learner with the habit plausibly sees **neither**; one row ranks. Both shapes are the absence of the **same word** from the same cause (Telugu borrows no word to ask or to negate, so there is no Telugu word for English `do`), which is why this is the **opposite call from `US-224`**, where the label was actually *false* of a case rather than merely narrow. The two content routings it identified were made in the same change: `past-simple.js`'s *"not got"* and `question-formation.js`'s *"you live"* both now log `gram.auxiliary-omitted`, the second closing the last producer `gram.word-order`'s label was false of. The stale "ONE MISSING ID" header note is gone. Category count stays 36; the widening is label-only, so nothing already logged moves — **done 2026-09-12** | `FR-SRS-3` | 1 | S |
| ✅ **US-230** | Resolved as **leave the split, document the mapping** — and the finding is that nothing was wrong with either label. Established first, by enumerating the routings off the content: all five routings to `gram.embedded-question-order` **are** embedded, and every `gram.word-order` routing **is** an order error, so **both labels are true of every producer that reaches them today**. Not widened, because the halves are mirror images — embedded is *too much* inversion, direct is *too little* — so a wording true of both could only say "the inversion is in the wrong place", which is the vague wording `US-224` refused. No third row either: `US-224` minted one because a label was **false**; here both are **true**, so this is a narrow *name*, and a narrower-than-ideal name is not worth a row that halves a count. What shipped is the T-G8 mapping written out beside the code, with a cross-reference on `gram.word-order` — **done 2026-09-12** | `FR-SRS-3` | 1 | S |
| **US-231** | `docs/CONTENT_AUTHORING_GUIDE.md` §5 is **stale after `US-701`** — line 227 still says "A flat array of strings per level" and line 229 still calls the object shape "Proposed schema". The guide now documents the shape the code rejects | `FR-CNT-1` | 1 | S |
| **US-232** | **No `fluent` tier anywhere in `data.js`.** `levels.js` declares four tiers; `listeningExercises`, `vocabularyData`, `sentenceExercises`, `readingPassages` and `puzzleData` all have exactly three (`foundation`/`everyday`/`confident`). Pre-existing and affects every legacy section, so `US-201`'s "`fluent` will have zero content on landing" warning is still live. `grammarLessons`' explicit `fluent: []` is the precedent — an empty array present beats a missing key, because the missing key is the `.length`-off-undefined crash class | `FR-SES-3`, `FR-CNT-1` | 2 | S |
| **US-233** | `state.generatedExercises` is declared and **never written or read** — and all three fields are dead, not just `listening`: the only other mention anywhere is `TECHNICAL_DOCUMENTATION.md:394`, which documents it as "memoised generated content" that does not exist. Either memoise through it or delete it and the doc line together | — | 1 | C |
| **US-234** | `pronAccuracyBlock()`'s disclosure says **"Your accuracy on all three pairs"** while `pronunciationPairs()` returns **8** pair sets (3 vowel + 5 consonant). Stale from when only the vowel file was wired; the code comment above it says "all three pairs" too. A false count shown to the learner, in the one view `FR-PRN-2` exists to provide | `BR-3`, `FR-PRN-2` | 1 | S |
| **US-235** | **No `stress` field on any `vocabularyData` entry**, so `FR-PRN-3`'s first half — "word stress **marked on vocabulary entries**" — is unmet even though the drill ships (`US-197`, and `US-403` is closed on the drill). The 21 authored stress items live in `data/pronunciation/vowels-stress.js` and share no key with the vocabulary a learner is actually revising | `FR-PRN-3` | 2 | S |
| ✅ **US-236** | **`data/grammar/modals.js` authored** — syllabus point 8, `foundation`, modals of ability and request (`can` / `could` / `may`). **This completes `US-502`, 8 of 8.** Its central decision: `could` in a request is taught as **distance, not the past of `can`**, which then explains `would`, `might` and *"I was wondering if…"* as the same move at different lengths rather than as four separate formulas. `may` is taught as **whose permission it is**, deliberately *not* as the top rung of a politeness ladder — because the ladder is exactly what produces *"May you send me the file?"*. One item exists in order to **not** grade register as grammar: the bare imperative is told plainly that it **is correct English**, logged `gram.register-indian`, with the reason it lands badly on an external reader — the same audience-not-correctness framing as `question-formation.js` and `prepositions.js`. Also gives `gram.subject-dropped` its **first producer** (subject omitted after a fronted modal — see §4a), which `US-192` was briefed as the only route to. 23 automated schema checks pass — **done 2026-09-12** | `FR-GRM-1`, `FR-SRS-3` | 3 | M |
| ✅ **US-237** | **`data/grammar/register.js` authored** — T-G9, `everyday`. **Closes the LAST dead drill target: 26 live, 0 dead**, against four dead two waves ago and one (`gram:register`) after `US-187`. Its frame is a **three-way split**, not a right/wrong list: items that **cost you the message** (`doubt`, `revert`, `pass out`, `intimate` — the same word with a different meaning, so the reader is confidently wrong and never asks), items that **communicate fine but mark you as Indian** (`out of station`, `kindly`, `cousin brother`, `do the needful`, `prepone` — stated explicitly as *not* a problem to fix), and items that are **fine everywhere and corrected anyway** (`Shall I…?`, `Please find attached`). **The same word is graded both ways in adjacent items** — `doubt` is wrong in `p1` and the *only* right answer in `p2` — which is how a "who are you writing to?" judgement was built inside `mode: 'gap'` without inventing a new mode. Two items were rewritten during the adversarial pass because they could not be closed; all six ended with exactly one accepted answer. Its `l1Notes.telugu` says the accurate thing about T-G9 — that most of the list is not Telugu interference at all but nineteenth-century British official English that Indian English kept — 23 checks pass. **`syllabusNumber: 25`, outside 1–24, is a reported gap, not a free choice: `US-242`** — **done 2026-09-12** | `FR-GRM-1`, `FR-SRS-3` | 3 | M |
| **US-238** | `clear()` on an **empty** archive still says *"All your recordings have been deleted from this device."* Same family as `US-227` and lower severity: unlike `remove(id)` it asserts a whole-store **outcome** that is true of the resulting state and names no object, so nothing it says is false — it is just a deletion report for a deletion that did not happen. `MESSAGES.cleared` needs a sibling, on `US-227`'s pattern | `BR-3` | 1 | C |
| **US-239** | `remove(id)` **will** delete a stranded row (`US-228`) and say *"Recording deleted."*, while `get(id)` and `list()` deny that row exists. Kept **deliberately** — targeted recovery beats delete-everything, and no learner path can produce the id because `list()` is the only source of ids — and now documented and pinned by a test. The residue is a documentation defect, not a behaviour one: `US-228`'s original "only `clear()` removes them" is not quite true, and this row is where that is recorded rather than left as a contradiction between two rows | `FR-DATA-6` | 1 | C |
| **US-240** | `strandedBytes` reports the `size` a row **claims**, not the size it is. A foreign row with a lying or absent `size` produces an under-count that nothing in the module can catch, which reopens `US-228`'s failure mode in miniature — the cap is again computed over a total that is not the total. Reading `row.blob.size` instead of `row.size` would make the figure measured rather than declared for every row that actually holds a blob | `FR-DATA-6`, `BR-3` | 1 | S |
| **US-241** | `data.js` listening items carry **no authored `promptId`**, so a copy-edit to a sentence orphans its archive (`US-136`'s derivation is content-keyed, and that is the right default — the alternative plays a learner's voice against words they never said). What is missing is the **opt-out**: an explicit `promptId` on the item would let an author say *"this is a typo fix, keep the recordings"*. One line in `listeningPromptId()`, prefer the authored id over the digest | `FR-DATA-6`, `FR-CNT-1` | 1 | S |
| **US-242** | **`CURRICULUM.md` §3 Strand B lists 24 points and none of them is register or audience.** `REQUIREMENTS.md:229` maps T-G9 to "Strand A register labels", not to a Strand B number, so `data/grammar/register.js` (`US-237`) took `syllabusNumber: 25` — the first free slot — documented in the file as a reported gap rather than renumbered into a point §3 already names. Needs a **curriculum decision**: either §3 gains a 25th Strand B point, or T-G9 content is declared Strand A and carries no `syllabusNumber` at all. Until then one authored point sits outside the syllabus it claims to belong to, and `US-507`'s ordering-by-`syllabusNumber` would sort it last by accident rather than by design. **Sharpened 2026-09-16:** it is now also the reason `US-503` reads 3 of 8 while its tier holds 4 points | `FR-CNT-1`, `FR-GRM-4` | 1 | S |
| ✅ **US-243** | **`data/grammar/future-forms.js` authored** — syllabus point 10, `everyday`. It **replaces the standard framing rather than teaching it**: "predictions vs plans" asks the learner to classify their own utterance mid-sentence using a label they have no access to, so the four forms are taught as **four questions about the speaker's own mental state** — `will` = deciding now, `going to` = reporting a decision already made, present continuous = arranged and someone else knows, present simple = a timetable. A learner can answer all four from the inside. Telugu's single verb-marked future against English's four forms is handled as **register, never grammar**, flagged `grammaticalButDifferent` and logged `gram.register-indian`, so a learner who says *"I will go tomorrow"* for an arranged trip is told what it sounds like, not that it is wrong. `shall` is handled by **confirming the learner**: *"if a style checker flags this sentence, the checker is wrong."* Five of six prompts were rewritten during the adversarial pass to close their answer sets — the originals admitted a second defensible form, which for this point is not a distractor problem but the point itself, since three of the four forms fit most bare contexts. Every accepted answer is among its `options` (`US-166`) — **done 2026-09-16** | `FR-GRM-1`, `FR-SRS-3` | 3 | M |
| ✅ **US-244** | **`data/grammar/gerund-infinitive.js` authored** — syllabus point 12, `everyday`. Its central decision is that this "point" is **two things** and must not be taught as one: after a preposition it is always `-ing`, which is a rule a learner can apply, and after a particular verb it is an arbitrary per-verb list, which is memory work with no rule to find. **The split is carried in `logAs`, including within a single item** — the arbitrary half routes to `vocab.collocation`, so a learner writing *enjoy to read* is reported as a memory gap rather than a grammar gap, and `gram.` categories keep meaning what they say. It **names the thirteen both-forms-no-difference verbs it deliberately kept out of target position** (`begin`, `start`, `continue`…), because an item whose two answers mean the same thing would need `US-188`'s false difference claim to render. Drops `interested in` as the preposition example, since *interested to hear* is standard English and the example would have taught the rule by contradicting it. Gives `vocab.collocation` its second and third producers (see `US-186`) — **done 2026-09-16** | `FR-GRM-1`, `FR-SRS-3` | 3 | M |
| ✅ **US-245** | **A live production hang, filed and fixed in the same wave.** The deployed site sat on *"Loading word…"* and logged `TIMEOUT_ERROR in fetchWordData("Happy")`. `CONFIG.useAPIFirst` meant the dictionary API was tried **before** curated content for every word, through 3 attempts × a 5s timeout plus 1s and 2s of backoff — **up to 18 seconds** before the local fallback ran, for *"Happy"*, which is `data.js:6`, the **first foundation word**, authored with its own IPA and its own quiz. That breaks **`CON-6`** — *"its failure must never block an exercise"* — and `FR-CNT-4`/`US-714`'s curated-serves-first rule. (Briefed as `NFR-8`; `NFR-8` is service-worker media caching — see §4a.) Fixed with a new `curatedWordData()` returning the exact match **or null**: `getLocalWordData()` **could not** be the test, because it ends with `localWords[index % length]` and therefore answers yes for every word in the language — right for *"give me a word to show"*, useless as *"do we already have this word"*. The API is demoted to **one attempt, 4s timeout, non-curated words only**; `retryWithBackoff` itself is left alone because other callers legitimately want the ladder. Curated words now wait **0 seconds and never touch the network**, and that is not a degraded path but the better one — an authored quiz with hand-written distractors and an authored IPA beats generated distractors and whatever `phonetic` the API returns. Seven regression tests added, because **nothing asserted that vocabulary renders with the network failing** — the case `NFR-4` has required all along — **done 2026-09-16** | `CON-6`, `FR-CNT-4`, `NFR-4` | 2 | M |
| **US-246** | **The streak counts days the app was *opened*, not days with work done.** `updateStreak()` (`app.js:598`) is called from `loadProgress()` (`:564`) on any date change and increments `currentStreak` — and `bestStreak` with it — before the learner has completed anything; opening the app on eight consecutive mornings and closing it reports an eight-day streak. `TEACHING_METHODOLOGY.md`'s gamification rule is *"a streak that survives a session where the learner got everything wrong teaches nothing"*, and this is the **stronger** version of the same defect: a streak that survives a session with no attempt at all. Same class as `US-110` (the crossword crediting an untouched grid) and priced with it. The datum needed already exists — `dailyStats` counts per section — so the fix is to increment on the first *completion* of a day rather than on load, which also means the increment must move out of `loadProgress()` and become idempotent within a day. **Note for whoever takes it:** `TEACHING_METHODOLOGY.md` §5's own prose says *"the streak counter already reflects this"*, i.e. it endorses the counter and does not forbid this behaviour; the forbidding line is the gamification bullet at the end of the same section. Cite the bullet, not §5 generally | `BR-3`, `FR-SES-5` | 2 | M |
| **US-110** | **Stop the crossword awarding the daily goal for a blank grid** (D2) | `BR-3` | 2 | M |
| ✅ **US-111** | Guard the quiz counters against re-clicking a correct answer — **done 2026-09-09** | `FR-VOC-1` | 1 | M |
| ✅ **US-112** | Stop dictation double-counting the reading passage — **done 2026-09-09** | `FR-DATA-3` | 1 | M |
| ✅ **US-113** | Correct `docs/README.md`'s false testing claims — **done 2026-09-09** | `NFR-16` | 1 | M |
| ✅ **US-114** | `exercise.fillBlank` crash fixed — blanks are now derived from the exercise's own words when the supplied prompt is missing or corrupt, with drag-and-drop as last resort — **done 2026-09-09** | `FR-RDW-4` | 2 | M |
| ✅ **US-115** | Scramble solve-per-click inflation fixed via a once-per-render dataset flag — **done 2026-09-09** | `FR-DATA-3` | 1 | S |
| **US-116** | Scramble's "Show Answer" reveals the solution and the authored `hint` field is never displayed (D4) | `FR-VOC-7` | 2 | S |
| ✅ **US-117** | Correct `TECHNICAL_DOCUMENTATION.md` stale line refs and the nonexistent `capitalize()` (D6) — **done 2026-09-09** | — | 2 | S |
| ✅ **US-118** | Correct `USER_GUIDE.md` promises the app cannot keep — the nonexistent achievement system, the `file://` instructions, "Show Hint" vs "Show Answer", the Safari replay caveat, and an unactionable notification-permission step — **done 2026-09-09** | — | 3 | S |
| ✅ **US-119** | **Read-aloud target is now the sentence**, read from the same string handed to `speechAPI.speak`, so target and audio cannot drift — **done 2026-09-09** | `FR-SPK-1`, `FR-SPK-2` | 3 | M |
| ✅ **US-120** | SRS lapse on read-aloud failure — lapses only vocabulary words the diff reports missed, and only when the recogniser matched over half the sentence — **done 2026-09-09** | `FR-SRS-1` | 2 | S |
| ✅ **US-121** | `validateInput` no longer rejects ordinary speech; denylist + length cap replaces the allowlist, and the blaming message is gone — **done 2026-09-09** | `NFR-3`, `BR-3` | 2 | M |
| ✅ **US-122** | `migrations.js` no longer downgrades a future schema version, and `saveProgress()` no longer re-stamps it downwards — **done 2026-09-09** | `FR-DATA-2` | 2 | S |
| ✅ **US-124** | Generator fill-blank corruption fixed **at the source** — blanks by position, not substring replace; 0 of 3000 swept indices now rejected (was 81) — **done 2026-09-09** | `FR-RDW-4` | 2 | M |
| ✅ **US-125** | Double toast on validation fixed — `classifyError` now returns `VALIDATION` and `handleError` lets the call site's specific message stand — **done 2026-09-09** | `NFR-3` | 1 | M |
| ✅ **US-126** | `sanitizeInput` entity-encoding removed; `Toast` converted to a text sink so escaping is no longer needed there — **done 2026-09-09** | — | 1 | S |
| ✅ **US-127** | `updateCompletionIndicator` rebuilt with `createElement`/`addEventListener`; `app.js` now has **zero** inline `on*=` handlers — **done 2026-09-09** | `NFR-12` | 2 | S |
| ✅ **US-128** | `USER_GUIDE.md` listening section rewritten for the sentence-based read-aloud, with an honesty-framing subsection — **done 2026-09-09** | — | 1 | S |
| **US-129** | Generated listening sentences ("The trees love beautiful moments") violate the meaningful-input principle — and US-119 now asks learners to **read them aloud**, which raises the stakes | `FR-CNT-4` | 2 | M |
| **US-123** | Word Search selection never clears on a wrong guess, so leftover `.selected` cells silently poison later attempts (related to the unwinnable-puzzle defect D3) | — | 2 | S |

### Stories in full

**US-101 — As Ravi, I want my vocabulary answers graded correctly, so my review queue reflects what
I actually know.** ✅ **Done 2026-09-08.**
- **Given** a quiz whose options were shuffled, **when** I select an option, **then** the verdict
  compares my selection against the correct definition's *current* index.
- **Given** I answer correctly, **when** SRS is updated, **then** it records a success.
- **Implemented at** `app.js` — `correct: options.indexOf(correctDefinition)`, mirroring the
  already-correct generated path at `app.js`. Verified over 5000 renders: 0 index mismatches.
- **Still outstanding:** review items already persisted to `srsData` carry the old `correct: 0` and
  the placeholder distractors, because `js/core/srs.js:100` stores the whole `quiz` object and
  `loadReviewWord` replays it. Those items will keep mis-grading until purged. Handled by **US-205**.

**US-105 — As Anusha, I want distractors that test meaning, not absurdity.** ✅ **Done 2026-09-08.**
- **Given** a vocabulary check, **then** all distractors are real definitions of *other* entries,
  preferring the current level and falling back to other levels.
- **Implemented at** `app.js` as `getDistractorDefinitions(correctDefinition, count)`.
  Wrapped in `try/catch` with `Array.isArray` guards and a generic top-up, so a missing
  `vocabularyData` degrades instead of taking the section down.
- Did **not** use the API's synonyms/antonyms, per the decision recorded in PROGRESS.md §6.

**US-109 — As the maintainer, I want the dashboard to count what the learner actually did.**
- **Given** I complete a sentence, reading or puzzle exercise, **when** the dashboard renders,
  **then** the corresponding counter has increased.
- **Given** the app loads saved progress, **then** historical counts are preserved.
- **Note:** `updateStatistics()` had exactly **one** call site, for `'vocabulary'`. Every other
  completion path — sentences, reading, dictation and the four puzzle handlers — incremented
  `state.stats.*`, which `loadProgress()` reads on startup and nothing displays.
- **Blocks `FR-DATA-3`.** The success metrics assumed this data was already being collected.
- ⚠️ Decide whether to migrate the orphaned `state.stats` values into `overallStats` or start the
  repaired counters from zero. Migrating is kinder but the numbers are of unknown quality.

**US-110 — As a learner, I don't want to be told I solved something I didn't attempt.**
- **Given** an untouched crossword grid, **when** I press "Check Answers", **then** the daily puzzle
  goal is **not** awarded and no `puzzlesSolved` increment occurs.
- `generateCrossword()` in `app.js` has no answer key, so there is nothing to validate
  against. Minimum honest fix: stop granting credit and label the section unfinished.
- ⚠️ **Resolve `OQ-7` first.** If the crossword is being retired there is no point repairing it.

**US-102 — As a learner, I want to never be shown invented pronunciation.**
- **Given** an algorithmically generated word, **when** it renders, **then** it shows real IPA or
  **no** pronunciation field — never `/word/` derived from spelling (`app.js`).

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
  target is presented (fixes the `Math.random()` pick at `app.js`).
- **Given** an active SRS queue, **then** the target is drawn from it, not at random.

**US-106 — As Lakshmi, I want to know whether the app broke or I did.**
- **Given** `no-speech`, **then** "I didn't hear anything — try again". **Given** `not-allowed`,
  **then** microphone-permission guidance. **Given** `network`, **then** an offline explanation.
- Replaces the single generic toast at `app.js`.

**US-107 — As the maintainer, I want the app to stop asserting an unaudited standard.**
✅ **Done 2026-09-09.**
- **Given** startup, **then** no log claims WCAG compliance. The line is deleted with nothing put in
  its place. The target is stated in `NFR-11` and will be claimed only after an audit (`US-806`).

**US-108 — As Lakshmi, I want to retry an exercise in the mode I failed it in.** ✅ **Done 2026-09-09.**
- **Given** exercise index *n*, **when** it renders twice, **then** the same mode appears both times.
- Implemented as `exerciseTypes[state.currentSentenceIndex % exerciseTypes.length]` at
  `app.js`, replacing the `Math.random()` pick. The two downstream dispatch sites derive the
  type from the live DOM, so they were already consistent and needed no change.
- ⚠️ **Surfaced by this fix:** `case 'fillblank'` calls `loadFillBlankExercise(exercise.fillBlank)`,
  and that property can be absent. Previously this failed intermittently (~25% of renders); it is
  now *reproducibly* broken for indices where `index % 4 === 1`. Determinism is still correct — it
  converts an intermittent bug into a visible one — but it needs a follow-up. See `US-114`.

**Sprint 1 total: 260 points across 141 stories — 95 done (194 points), 46 remaining (66 points).**
The remaining items are
almost all hygiene, copy or wiring surfaced by later work; `US-110` (crossword crediting a blank
grid) is the last learner-facing honesty defect in the *legacy* sections and waits on `OQ-7`, and
`US-246` (a streak that counts days the app was opened) joined it on 2026-09-16 as the same defect
class in a live surface. Six rows closed on 2026-09-16 — `US-138`, `US-166`, `US-188` and the three
new rows `US-243`, `US-244`, `US-245`, the last of which was **filed and closed in the same wave**
because it was a hang on the deployed site. Two of the closures are one change: `US-166` and `US-188`
are the content and renderer halves of a single false claim, which is why neither could be fixed
alone — removing the unreachable answers is what made *"Both answers here are right"* true wherever
it still prints. `US-138` is the one that matters beyond this table: it closed `US-605`'s named
export residue in Sprint 6 without a Sprint 6 story, exactly as `US-136` opened that sprint. Eight
rows closed on 2026-09-12 — `US-136`, `US-185`, `US-227`–`US-230`, and the two content rows
`US-236`/`US-237` — and five were filed open by the same work (`US-238`–`US-242`). The table shrank
and grew at about the same rate again, which is what a wave spent finishing a defect class looks
like.

---

## 7. Sprint 2 — Data integrity (Phase 2) · E2 + E3

Highest-risk sprint. Blocked on **OQ-4**.

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| ✅ **US-201** | CEFR level rename with migration — `data.js` keys renamed, `data-level` attributes updated, **exercise ids migrated** so completion history survives — **done 2026-09-09** | `FR-SES-3` | 5 | M |
| ✅ **US-202** | Pre-migration backup, provably idempotent — byte-identical on rerun, `.bak.v1` for both stores — **done 2026-09-09** | `FR-DATA-2` | 3 | M |
| ✅ **US-203** | Export all learner data as one JSON file — **done 2026-09-09** | `FR-DATA-4` | 3 | M |
| ✅ **US-204** | Import/restore with validate-before-write and verified rollback — **done 2026-09-09** | `FR-DATA-4` | 3 | M |
| ✅ **US-205** | "Clear review history" — clears `srsData` only, backs up first — **done 2026-09-09** | `FR-DATA-5` | 2 | M |
| ✅ **US-206** | IndexedDB blob store (`js/core/blobstore.js`) with retention, quota handling and graceful degradation — **done 2026-09-09** (module only; UI wiring pending) | `NFR-10`, `CON-3` | 3 | M |

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
| ✅ **US-301** | `SECTIONS` registry, additive, zero new sections — adding a section drops from **23 `app.js` edits to 1** — **done 2026-09-09** | — | 5 | M |
| ✅ **US-302** | SRS keys namespaced `vocab:`/`gram:`/`phon:`/`coll:`; `getDueWords` no longer hardcodes a `quiz` filter — **done 2026-09-09** | `FR-SRS-1` | 5 | M |
| ✅ **US-303** | Existing bare-word `srsData` migrated to `vocab:<word>` with **zero drift** across all scheduling fields — **done 2026-09-09** | `FR-SRS-1`, `FR-DATA-2` | 3 | M |
| ✅ **US-304** | Daily review queue capped at 20, read-time only so deferral writes nothing — **done 2026-09-09** | `FR-SRS-4` | 2 | M |
| ✅ **US-305** | Mistake log by error type (`js/core/mistakes.js`) — 34 categories from the Telugu interference tables, top-5 over a 30-day window with recency decay — **done 2026-09-09** (module only; wiring pending) | `FR-SRS-3` | 5 | M |
| ✅ **US-306** | Self-reported outcomes may shorten an interval but never certify; backwards-compatible with no migration — **done 2026-09-09** | `FR-SRS-5` | 2 | M |

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
| ✅ **US-401** | **Pronunciation section exists** — minimal-pair discrimination drill, per-pair SRS (`phon:`), production gated at 80% discrimination, text-only fallback when audio is unusable — **done 2026-09-10** | `FR-PRN-1` | 5 | M |
| ✅ **US-402** | **Satisfied by `US-401`.** Both halves of `FR-PRN-2` verified in the build: per-pair tracking is `state.pronunciationAccuracy` keyed by `phon:<pair>` and sanitised on load, and the profile view is `pronAccuracyBlock()` — the number for the pair on screen plus a disclosure listing every pair, saying *"not tried yet"* rather than "0%" where there are no attempts, and excluding the written exercise from the figure because it does not test the ear. **One copy defect against it: `US-234`**, the list is titled "all three pairs" and there are eight — **done 2026-09-10 under `US-401`** | `FR-PRN-2` | 3 | M |
| ✅ **US-403** | **Satisfied by `US-197`, not by this story.** The 21 word-stress items are browsable in the Pronunciation section without a review being scheduled first, the stressed syllable is displayed and audible, and ungradable items are dropped loudly. `FR-PRN-3`'s acceptance criterion is met. **What is not: the other half of the requirement's headline** — no `vocabularyData` entry carries a `stress` field, so stress is marked on pronunciation content and not on the vocabulary a learner revises. Filed as **`US-235`** rather than left inside this row — **done 2026-09-12 under `US-197`** | `FR-PRN-3` | 3 | M |
| ✅ **US-404** | **Self-comparison shipped — A→B→A.** Model → the learner's own recording → model again, both model plays at the slow constant (`PRON_RATE_SLOW`) and the learner's clip at **no adjusted rate**, because a rate applied to a recording of a voice is not the same operation as a rate applied to TTS. Chained on `onend` with a **watchdog**, not out of paranoia: `onend` has been observed never to fire on some Android WebView voices, and without the watchdog the sequence would stop silently mid-comparison. **No score and no verdict** — there is no `Mistakes.record` and no `SRS.` call anywhere in the comparison code (`FR-PRN-5`). The feelable question is the authored `feelChecks[0]`, and **a test reads both content files and fails if any authored `feelChecks` entry ever asks about the sound rather than the feel**, so `FR-PRN-4`'s "never *did it sound right?*" is enforced against future content rather than checked once. `FR-A11Y-4` holds: the task is appended after the existing skip pair, and a device with no microphone gets one sentence saying the task was never the recording. The recording is kept per pair by `RecordingArchive` (`US-136`) — **done 2026-09-12** | `FR-PRN-4`, `FR-PRN-5` | 5 | M |
| ✅ **US-405** | **Satisfied by `US-401`.** `pronGate()` reads `productionGate.minAccuracy` / `.minAttempts` **from the content**, not from a constant, because the author knows how wide the perception blind spot is for a given contrast — and an absent gate still gates, defaulting to 0.8 / 10 rather than failing open. Measured on *first* answers so the gate cannot be ground open. `US-179` remains open against it: the gate needs 10+ attempts and the session's pronunciation step is count-boxed at ~8 — **done 2026-09-10 under `US-401`** | `FR-PRN-6` | 2 | M |
| **US-406** | Duration-comparison hint for epenthesis (T-P2, T-P3). **Unblocked by `US-136` and not built** — it waited on the recorder, the recorder exists and `US-404` proves the A→B→A path through it, so this is now a hint surface over a working archive rather than a story with a dependency | `FR-PRN-7` | 3 | S |
| ✅ **US-407** | **Satisfied by `US-401`.** `FR-PRN-9` is enforced structurally, not by inspection: `phonemes[].gloss` is the only place a symbol may be introduced, `pronPhonemeBlock()` renders it wherever IPA appears, and a pair with no `phonemes` is **refused** rather than shown as bare IPA — **done 2026-09-10 under `US-401`** | `FR-PRN-9` | 2 | M |
| **US-408** | Use API audio for word models; route media in the service worker | `NFR-8`, `FR-CNT-5` | 3 | S |
| **US-409** | Schwa, sentence stress, linking and intonation taught by **noticing**, not model imitation. **Partly satisfied by `US-197`** — the 15 noticing items are browsable and `requiresImitation` is refused per `FR-PRN-8` rather than trusted. **Not credited**, because those 15 items cover rhythm, final vowel and cluster only: connected speech and intonation have no content at all, so half of what `FR-PRN-8` names is unauthored | `FR-PRN-8` | 5 | S |

**US-400 is a spike and it gates the sprint.** If TTS cannot render /ɪ/ vs /iː/ distinguishably on
real devices, `US-401` needs bundled audio and the sprint doubles. **Do not author 8 pair sets
before this passes.** ⚠️ **That instruction was overtaken by events:** `US-150` authored all 8 sets
and `US-401` shipped the drill while `US-400` is still open, so the gate held nothing. Every set
carries a `ttsRisk`, a `degradeTo` and a no-audio fallback, which is the mitigation that made
proceeding defensible — but `AS-3` remains unvalidated on a real phone, and it is `R-2`.

**US-401 — As Anusha, I want to find out which sounds I confuse.**
- **Given** a minimal pair, **when** the drill starts, **then** one clip plays and I pick which word
  I heard.
- **Given** I answer wrongly, **then** both words replay back to back **slowed**, and the differing
  feature is named ("/iː/ is longer and the lips are wider than /ɪ/"), and I retry.
- **Given** a wrong answer, **then** `phon:<pair>` resets to a 1-day interval.
- **This is the only speech task that may gate progress** — the grade is objective because we know
  which file we played.

**US-404 — As Lakshmi, I want to judge my own pronunciation without being told I'm wrong.**
✅ **Done 2026-09-12.**
- **Given** a target word, **when** I record, **then** I can play **model → mine → model** at
  matched speed. Both model plays use `PRON_RATE_SLOW`; the recording is played unaltered.
- **Given** the self-check, **then** it asks a *feelable* question ("did your top teeth touch your
  bottom lip?"), **never** "did it sound right?" — enforced by a test that reads the content files,
  not by review.
- **Given** I mark "not yet", **then** the item returns sooner — and is stored flagged as
  self-reported (`FR-SRS-5`).
- **No score, no pass/fail, ever** (`FR-PRN-5`). Verified structurally: no `Mistakes.record` and no
  `SRS.` call exists in the comparison code.
- **Given** no microphone, **then** the task is skippable and says so in one sentence (`FR-A11Y-4`).

**Sprint 4 total: 33 points — 20 of 33 done.** `US-401` shipped under its own number; `US-402`,
`US-405` and `US-407` were **folded into it** and are marked done here naming it, and `US-403` was
shipped as `US-197`. `US-404` closed 2026-09-12 on the back of `US-136`, which is why the recorder
appears in this sprint's done column without a Sprint 4 story having built it. The done column read 5
until 2026-09-12 because defect-driven and
surface-driven stories were given sequential `1xx`/`2xx` numbers wherever they landed. What is
genuinely left is the epenthesis hint (`US-406`, now unblocked rather than blocked), the audio work
(`US-408`), the unvalidated spike (`US-400`), and the unauthored half of `FR-PRN-8` (`US-409`).

---

## 10. Sprint 5 — Grammar (Phase 6) · E5

Largest content effort in the backlog, and the phase needing no external data.

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| ✅ **US-500** | Authored **one** grammar point (articles) end to end for review, plus a schema designed to carry all 24 — **done 2026-09-09**. See `docs/GRAMMAR_SAMPLE_REVIEW.md` | `FR-GRM-1` | 2 | M |
| ✅ **US-501** | Grammar section shell wired to the registry — **done 2026-09-09**. One story, one done record; the Sprint 1 table holds the same row and §16 counts its 3 points here | `FR-GRM-1` | 3 | M |
| ✅ **US-502** | Foundation points 1–8 (**split from an 8**). **8 of 8 authored** — `be` (1), present simple vs continuous (2), articles (3), countable/uncountable (4), past simple (5, `US-226`), question formation (6, `US-215`), prepositions (7, `US-225`), modals of ability and request (8, `US-236`). **Closed by `US-236` on 2026-09-12**, the last of the eight and the one three agents failed to land before the maintainer wrote it — **done 2026-09-12** | `FR-GRM-1` | 5 | M |
| **US-503** | Everyday points 9–16 (**split from an 8**). **3 of 8 authored** — present perfect vs past simple (9, `US-178`), future forms (10, `US-243`), gerund/infinitive (12, `US-244`). **`grammarLessons.everyday` holds four points and this row counts three**, because the fourth is `register.js` (`US-237`), which registers into the `everyday` tier while carrying `syllabusNumber: 25` and is therefore not one of points 9–16 — see `US-242`. Verified against the content 2026-09-16: the tier's four `syllabusNumber`s are 9, 10, 12, 25. Tier content and syllabus coverage have come apart here, and **this row counts the syllabus** — a tier figure would read 4 of 8 and credit a point the syllabus does not contain. Points 11, 13, 14, 15 and 16 are unauthored | `FR-GRM-1` | 5 | M |
| **US-504** | Confident + fluent points 17–24 | `FR-GRM-1` | 5 | S |
| ✅ **US-505** | **Satisfied by `US-501`.** Every wrong answer in the Grammar section shows the authored reason, a contrast pair and a retry, with defensible alternatives accepted — verified by use, not by diff. Two open copy defects sit in the *correct*-answer path of the same renderer, not this one (`US-183`, `US-188`), and `FR-GRM-2` outside grammar is `US-223`'s territory — **done 2026-09-09 under `US-501`** | `FR-GRM-2` | 3 | M |
| ✅ **US-506** | **Satisfied by `US-501` + `US-171` + `US-177`.** Grammar points are scheduled as `gram:` SRS items in their own right, `PROJECTORS.gram` is validated against real content by `auditProjection()`, and the review surface renders `review.rulePrompt` plus the `itemIds` subset rather than replaying the lesson — **done 2026-09-10 under `US-177`** | `FR-GRM-3` | 2 | M |
| **US-507** | L1-prioritised ordering and Telugu notes. **Half satisfied and not credited:** every authored point carries `l1Notes.telugu` with a `transferId`, `priority`, `note` and `bridge`, so criterion 2 is met. **Ordering is not** — `app.js` never reads `syllabusNumber` or `priority`, so points are presented in array order, and criterion 3 fails while `state.learnerL1` does not exist (`US-158`) and `data/l1/telugu.js` does not exist (`US-143`) | `FR-GRM-4`, `FR-CNT-3` | 5 | M |
| **US-508** | Audit items for defensible alternatives. **Partly satisfied and not credited, and the denominator moved against it:** four of the twelve authored points have had an adversarial pass on record — `US-215` (accepted a second correct answer on two items rather than marking real English wrong), `US-237` (two items rewritten because they could not be closed), `US-243` (five of six prompts rewritten to close their answer sets) and `US-244`. **`US-166` is no longer the open counter-evidence** — the six unreachable `accept` entries are gone and one of them was found to be plain wrong — but the audit is a per-point pass and twelve points are now authored, so the arithmetic is worse than when this row read seven. What it still needs is a stated pass record per point, not another undocumented reading | `FR-GRM-5` | 3 | M |

**US-500 gates the sprint** — it is the cheapest test of the least-verified assumption in this whole
plan (that the grammar content can be authored unaided to a good standard). One point, one review,
before committing to 20+.

**US-507 — As Lakshmi, I want the grammar that Telugu speakers actually get wrong, first.**
- **Given** `l1 = telugu`, **then** articles (T-G1), copula (T-G2), stative progressive (T-G3) and
  uncountables (T-G4) surface before lower-impact points.
- **Given** a Telugu-flagged point, **then** it carries a note contrasting the Telugu pattern with
  the English one.
- **Given** a second L1 profile added later, **then** no `app.js` change is needed.

**Sprint 5 total: 33 points — 15 of 33 done.** The done column read 5 until 2026-09-12: `US-505` and
`US-506` were built inside `US-501` and `US-177` and never ticked here, and `US-502` closed later the
same day when `US-236` authored point 8.

**Where the grammar content is actually being credited.** Points authored after `US-193` carry
sequential ids and sit in the Sprint 1 table — `US-151` (points 1, 3, 4), `US-178` (9), `US-215` (6),
`US-225` (7), `US-226` (5), `US-236` (8), `US-237` (25, outside the syllabus — `US-242`), `US-243` (10),
`US-244` (12). `US-502` and
`US-503` are the **rollups** for the same work, so `US-502` ticks now that its eighth point exists,
while `US-503` stays open at 3 of 8; their 5 points each are counted once, here.
Grammar content is now **12 points authored: 8 `foundation`, 4 `everyday`** — of which **11 sit inside
`CURRICULUM.md` §3's 24**, the twelfth being `register.js` at 25. `foundation` is complete
and every one of `mistakes.js`'s grammar drill destinations resolves to an authored lesson (26 live,
0 dead). **`US-508` is now further behind, not level:** the per-point audit stands at four of **twelve**
authored points, though `US-166`'s closure removes its open counter-evidence.

---

## 11. Sprint 6 — Speaking (Phases 8–9) · E7

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| ✅ **US-601** | **Free-production speaking shipped — the app's first free-production surface of any kind.** Until now `TEACHING_METHODOLOGY.md` §1's rule that every session ends with the learner saying something of their own was honoured only by grammar `produce` blocks, which supply the sentence. Eight prompts, an advisory clock, a recording through the existing `RecordingArchive` (`US-136`), and a self-assessed rubric of 32 items, four per prompt. **The honesty rule is enforced at author time, not merely written carefully**: `rubricRefuses()` in `data.js` **drops** any rubric item mentioning sound, pronunciation, accent, fluency, score, grade or pass/fail, and a prompt left with fewer than two usable items is dropped whole rather than shown thin — so the refusal costs the author a prompt, which is the only kind of rule that holds. All 32 surviving items are yes/no questions about **what the learner did** (*"Did you name at least two things they will see on the way?"*), answerable from memory or one replay. **The timer is advisory and provably cannot end the task**: after `targetSeconds` passes, the recorder still runs, no route is set, no control is disabled and nothing is written — the clock reports, it does not grade, which is what makes it safe to show a nervous learner. Recordings land under a content-derived id (`free:1:<digest of the prompt text>`), unchanged by editing the slug, the tier, `targetSeconds` or the whole rubric — only the prompt text moves it, on `US-136`'s reasoning. **Residue named, not held inside this row: `FR-SPK-3` also asks for the 4/3/2 technique, which is `US-607` and unbuilt** — the 2-minute topic speaking half is here (three prompts at 120s) — **done 2026-09-16** | `FR-SPK-3` | 5 | M |
| **US-602** | Functional dialogues — 11 situations | `FR-SPK-4` | 8 → **split by situation group** | M |
| **US-603** | Words-per-minute metric with trend. **Blocked on a missing datum, not on a surface:** `lastSeconds` is stored per row (`app.js:8500`) and there is **no word count anywhere**, so a rate could only be derived from a duration — an invented number, which `BR-3` forbids and which is why `FR-SPK-5` was left unbuilt rather than half-built. The datum is `US-247`; this row is the trend on top of it | `FR-SPK-5` | 3 | S |
| **US-604** | Filler and pause counts | `FR-SPK-5` | 5 | C |
| ✅ **US-605** | Recording archive, last N per prompt, IndexedDB. **Now done — the module has a caller (`US-136`) and the archive works end to end.** `js/core/blobstore.js` (`US-206`) implements per-prompt retention of the pinned baseline plus the two most recent, quota handling and graceful degradation, and remains the best-tested file in the repo (250 tests, 99.46% statements, 93.53% branch, **100% lines**), with all seven defects its suite found (`US-216`–`US-222`) plus `US-227`/`US-228` closed. `RecordingArchive` in `app.js` calls it from the listening/read-aloud path and the pronunciation self-comparison, keyed on a **stable content `promptId`** rather than an index — and from the free-production card as of `US-601`, which is a third surface the derivation carried without change. **Its residue closed on 2026-09-16: `US-138` puts the archive inside `FR-DATA-4`'s export**, additively, in a container that never turns audio into a string, and it needed one `put()` change here — a supplied `createdAt` and `baseline`, clamped so a restore cannot mint a second pinned baseline. **Nothing is left dangling from this row.** Crediting it when its own criterion passed and filing the residue against the requirement that owned it — rather than holding the row open — is the pattern `US-403`/`US-235` set, and it worked: the residue was closed four days later by the sprint that owned the requirement, and one missing export was never counted twice. `FR-SPK-6` and `FR-DATA-6` are both met — **done 2026-09-12** | `FR-SPK-6`, `FR-DATA-6` | 5 | S |
| **US-606** | Shadowing mode | `FR-SPK-8` | 3 | S |
| **US-607** | 4/3/2 fluency technique | `FR-SPK-3` | 3 | S |
| ✅ **US-608** | **Silent completion now counts identically to aloud** — same tally, same rubric, same one press; only the button order flips when the session's silent flag is on, so the learner who needs it sees it first without the other learner being nudged. A skip completes the card and **counts as nothing**, which is what keeps `M-1` honest. Three surfaces were genuinely broken, not merely unticked: **Read Aloud had one control and needed a microphone** — it now offers `🗣️ I read it aloud` / `🤫 I read it silently` with distinct recorded routes; **grammar `produce`** had only *"I said it"* / *"Skip"*, so a silent learner had to either lie or take the skip, and now has a third equal-cost button; and the free-production card (`US-601`) was built with all three from the start. Rather than borrow a counter it should not, the card **reports its own totals split four ways** — recorded / aloud / silent / skipped — which is exactly what `M-1` ("split by route") and `FR-SES-4`'s *"≥5 free-speaking tasks"* need, and it means the escape hatch cannot inflate either figure. `speak.free` in the honesty audit is now a **predicate calling the same resolver the loader uses**, not a bare `true`, so the audit can no longer claim a surface that is not there — **done 2026-09-16** | `FR-SPK-9`, `FR-A11Y-4` | 3 | M |
| **US-609** | Periodic "ask a human" intelligibility prompt | `FR-SPK-7` | 1 | C |
| **US-247** | **`FR-SPK-5` has no word count.** `lastSeconds` is stored (`app.js:8500`) and nothing records how many words were spoken, so words-per-minute cannot be computed from what is persisted — and deriving a rate from a duration alone would be an invented number, which is why the metric was **deliberately** left unbuilt rather than shipped wrong (`BR-3`). What is needed is the datum, not the chart: a word count written beside `lastSeconds` on the routes where a count is real — the recogniser transcript on a recorded route, and nothing at all on a silent or skipped one, because a silent learner's word count is unknowable and a zero would drag their own trend down for practising the way `US-608` exists to permit. That per-route asymmetry is the whole design problem and is why this is filed separately from `US-603` rather than inside it | `FR-SPK-5` | 1 | S |

**US-604 is deliberately `C`.** Filler and pause detection needs audio analysis or interim
recognition timings; if it proves unreliable, ship WPM alone rather than an invented number
(`BR-3`).

**US-608 was `M` and did not slip.** It closed 2026-09-16 — and it closed as **work, not as a check**.
The previous version of this note said it was "currently satisfied on every speaking surface that
exists" and merely unticked; that was **wrong on two surfaces**, and the difference only became
visible when there was a fourth surface to compare them against. Read Aloud had a single control and
required a microphone, and grammar `produce` offered *"I said it"* or *"Skip"* — so a learner
practising silently had to either claim they spoke or take the skip, and the skip is counted as no
production. That is not an accessibility gap, it is the app asking a nervous learner to lie about
what they did. The rule the row now enforces is that **silent and aloud are the same tally**, and only
`skipped` counts as nothing. It closed with `US-601` rather than after all of `US-602`, `US-606` and
`US-607`, because the rule is now enforced at the shared surface and the three unbuilt tasks inherit
it — which is the opposite of `FR-A11Y-5` in §13a, and the reason that one stays a per-story check
while this one is done.

**Sprint 6 total: 37 points — 13 of 37 done** (before splitting US-602). **`US-601` is the sprint's
first built story** — `US-605` closed on `US-136` from Sprint 1, and `US-608`'s two real fixes landed
on surfaces owned by Sprints 4 and 7. What remains is the dialogue set (`US-602`, still an 8 and still
needing a split), shadowing (`US-606`), the 4/3/2 technique (`US-607`, the named residue of
`FR-SPK-3`), the fluency metrics (`US-603` and its missing datum `US-247`, plus `US-604`), and the
`C`-priority human check (`US-609`). `US-605`'s export residue `US-138` closed the same day and is
counted in Sprint 1.

---

## 12. Sprint 7 — Listening & vocabulary depth (Phase 8) · E8 + E9

| # | Story | FR | Pts | MoSCoW |
|---|---|---|---|---|
| ✅ **US-701** | **`listeningExercises` converted `string[]` → `object[]`** — the step the plan flags as Phase 8's riskiest single step. One normaliser, `normaliseListeningItem(raw, tier)` in `data.js`: `text` required (no text ⇒ the item is dropped), `transcript` defaults to `text`, plus `tier`, `rate`, `seconds`, `situation`, `focus`, `notes`, `shadow`, and `questions` **always an array** — `[]` when absent, which is `US-702`'s room left empty rather than invented. **A bare string is not a legacy case but a permanent shorthand** for `{text}`. Malformed input returns `null` and the loader says so on screen rather than drawing an empty card; generated sentences go through the same normaliser, so there is one shape downstream. **No `SCHEMA_VERSION` bump, for a narrower reason than "it's content"**: what learners store pointing into this content is `completedExercises.listening` = `listening_<tier>_<index>` stamps, and the conversion preserves tier keys, count **and index order**, so every stamp still names the same sentence. **Zero content loss proved twice** — against `git show HEAD:data.js` (30 items before, 30 after, every string surviving as `.text` at the same index), and pinned as a test with all 30 sentences written out verbatim as a before-image — **done 2026-09-12** | `FR-LSN-1` | 3 | M |
| **US-702** | Gist-then-detail comprehension questions. **Unblocked by `US-701`:** every item now carries a `questions` array, so this is content plus a surface, not a shape change. It is also what `lsn.gist` needs before it can have a producer (`US-186`) | `FR-LSN-1` | 5 | M |
| ✅ **US-703** | **The transcript is absent from the DOM before an attempt**, not CSS-hidden, and Read Aloud is locked because its target *is* the transcript. Attempt routes need no microphone: recording, or a new self-reported `✓ I said it` — previously a refused mic was a dead end that `alert()`ed and stopped. An attempt **unhides the reveal button and never presses it**, so replay-before-reveal is the learner's choice rather than the app's. The route is recorded (`'attempt'` vs `'no-audio'`) and never laundered — **done 2026-09-12** | `FR-LSN-3`, `FR-LSN-4` | 2 | M |
| ✅ **US-704** | 0.75× / 1.0× / 1.25×, verified reaching `speechAPI.speak`. `listeningRate` is a module-level `let`, deliberately **not** in `state`, so `saveProgress()`'s spread cannot persist it: it survives the session and resets on next load, because a learner who slows one hard clip and forgets should not still be fed 0.75× a month later with no way to notice. `null` — **not `1`** — means "not chosen this session", which lets an authored `item.rate` act as a default without overriding a real choice — **done 2026-09-12** | `FR-LSN-2` | 1 | M |
| **US-705** | Longer audio — one 60s+ item per tier | `FR-LSN-5` | 3 | S |
| **US-706** | Dictation in Listening, reusing the existing field | `FR-LSN-6` | 2 | S |
| **US-707** | Productive-recall vocabulary card | `FR-VOC-4` | 3 | M |
| **US-708** | Collocation, word-family and register fields | `FR-VOC-5` | 5 | S |
| **US-709** | Frequency-ordered introduction | `FR-VOC-6` | 3 | S |
| **US-710** | Right answers extend, wrong answers contrast | `FR-VOC-7` | 2 | M |
| ✅ **US-711** | **A declared, remembered "I can't use the audio" switch** (`FR-A11Y-2`) reveals the transcript immediately for every item and **credits nothing** — completion still needs a spoken or self-reported attempt, so a revealed sentence is never a credited one. That is the same defect class as `US-110`, the crossword crediting a blank grid, and this switch is exactly where it would otherwise have landed — **done 2026-09-12** | `FR-A11Y-2` | 2 | M |
| **US-712** | Inference and vocabulary-in-context reading questions | `FR-RDW-1` | 3 | S |
| **US-713** | Sentence-transformation exercises — "rewrite in the passive", "make this polite" | `FR-RDW-2` | 3 | S |
| **US-714** | Bound generated content so curated items always serve first. **Half closed by `US-245`, and the half it closed was the live one.** `fetchWordData()` now consults `curatedWordData()` before the network, so for a curated word the API is never called and the curated entry — authored IPA, authored quiz, hand-written distractors — is served in 0ms; *"curated items are served first"*, the first clause of `FR-CNT-4`, is met **on the vocabulary word path**. **The residue is the second clause, "generated items are clearly bounded and never displace curated content", and it is untouched.** Three generators still run unbounded against curated content: generated **listening** sentences go through the same normaliser as authored ones with nothing marking them as padding (`US-129` is the quality half of this, and `US-119` now asks learners to read them **aloud**), `getLocalWordData()` ends in `localWords[index % length]` and will hand back an arbitrary word rather than admit it has none, and `state.generatedExercises` was supposed to be the boundary and is dead (`US-233`). **Not repriced down**, because the remaining work is where the requirement's actual difficulty lives: deciding what "bounded" means per section and making generated items say so on screen. What `US-245` removed was the case where generated/API content **displaced** curated content in time — an 18-second wait to be served worse content than was already on disk | `FR-CNT-4` | 3 | M |

**US-701 was first and alone**, as planned — the plan flags this `string[]` → `object[]` conversion as
Phase 8's riskiest single step, and it shipped with no schema bump because the learner-facing stamps
(`listening_<tier>_<index>`) index by position and position was preserved.

**US-704 was 1 point** because `speechAPI.speak(text, rate)` already accepted the parameter and never
varied it. It now varies it, and deliberately does not persist the choice.

**Sprint 7 total: 40 points — 8 of 40 done.** `US-701`, `US-703`, `US-704` and `US-711` shipped
2026-09-12; the listening item shape, the reveal gate and the no-audio route are settled, and what
remains in this sprint is content (`US-702`, `US-705`, `US-706`) and the vocabulary-depth half, which
is untouched.

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
| ✅ **US-801** | Session sequencer built as `js/core/session.js` and wired — plans ≥3 strands ending in production, count-boxed not time-boxed, resumable, own storage key — **done 2026-09-10** (UI pending, `US-170`) | `FR-SES-1` | 5 | M |
| **US-802** | Dashboard: streak, fluency trend, tomorrow's preview | `FR-SES-5` | 3 | S |
| **US-803** | Local metrics M-1…M-8 computed and surfaced | `FR-DATA-3` | 5 | S |
| **US-804** | Placement check, 12 items | `FR-SES-2` | 5 | S |
| **US-805** | Promotion thresholds; demotion never announced | `FR-SES-4` | 3 | S |
| **US-806** | Accessibility audit against WCAG 2.1 AA; then claim it | `NFR-11` | 5 | M |
| **US-807** | Keyboard-completable everywhere; un-quarantine the keyboard suites | `FR-A11Y-1` | 3 | M |
| **US-808** | IPA legible at 200% zoom | `FR-A11Y-3` | 2 | M |
| **US-809** | Harvest `storage.js`/`validator.js`, **then** delete the dead modules | `NFR-13` | 5 | M |
| **US-810** | Performance budget documented and met on a mid-range Android | `NFR-6`, `NFR-7` | 3 | S |
| ✅ **US-811** | **`tools/validate-content.js` plus `__tests__/unit/content.test.js` sharing one implementation**, so the CI job and `npm test` can never disagree about what valid content is (69 tests). A `content` job that **actually runs on push and PR** — unlike the `test` job, which is still commented out — and needs **no `npm ci` at all**: it loads the classic `data/*.js` scripts with the built-in `vm` module and asks `mistakes.js` and `srs.js` the questions it cannot answer alone. That is the whole reason it is safe to leave enabled, since `npm ci` is what took the pipeline down once already. 15 checks, **discovery-based** — it walks `data/grammar/*.js` and `data/pronunciation/*.js` rather than naming files, and it picked up `US-243` and `US-244` while they were being authored, with no workflow edit. **Schema derivation is leave-one-out, not a corpus intersection**: a plain intersection lets a defective file lower its own bar, so one file omitting `retryCue` would make `retryCue` optional for everyone and the defect would validate clean. It deliberately omits prose-shape and distractor-quality checks, on the argument that a validator which fails on defensible authoring gets switched off within a week — so every check it makes is structural and answerable yes/no. Currently **PASS with zero errors** and four reported-not-failed shape gaps (`vowels-stress.js` optional fields), which is the tone the whole tool is built in. **Deliberately not in the deploy job's `needs`** — it was red on arrival against pre-existing content (`US-166`) and gating GitHub Pages would have taken the site down to report a defect that predated the job. Both stated blockers are now gone; adding it is `US-248` — **done 2026-09-16** | `NFR-13`, `FR-CNT-1` | 3 | M |
| **US-248** | **Add `content` to the deploy job's `needs`.** `NFR-13` says a malformed content item should fail the build, and `US-811` built the mechanism but deliberately left the wire disconnected, naming two conditions: the validator was red against pre-existing content (`US-166`, seven items), and two just-authored points were not yet in `index.html` or the precache list. **Both are now false** — `US-166` closed 2026-09-16, `future-forms.js` and `gerund-infinitive.js` are in both lists (`index.html:826-827`, `service-worker.js:98-99`), and `node tools/validate-content.js` reports `PASS — no errors`. The one-line change is `needs: [syntax, build]` → `needs: [syntax, build, content]`. **Judged worth doing**, on the ground that the validator can only fail on **structural** defects it can state — prose shape and distractor quality are deliberately outside it, and its four current shape gaps are reported without failing — so the class of thing that would block a deploy is the class `NFR-13` wants blocked. The cost is real and accepted: a content defect would hold an unrelated fix off the site until the content is fixed or the row reverted, and this row is where that trade is recorded | `NFR-13`, `FR-CNT-1` | 1 | M |
| **US-812** | Decide and act on puzzles (**OQ-7**) | — | 2 | S |

**US-809 order is load-bearing, and it held.** ~1,690 lines are dead, but `storage.js` and
`validator.js` contain the export/import/backup and schema-validation code `US-203`, `US-204` and
`US-811` need. **Harvest before deleting**, or the same functions get rewritten (**B7**).
✅ **The harvest happened for `US-203`/`US-204`:** `js/core/portability.js`'s header records that it
was harvested from the never-instantiated `StorageManager` (`createBackup` / `restoreFromBackup` /
`getStorageInfo` / `exportData` / `importData`) **with its two blocking defects fixed** — an instance
call to a `static` method that throws, and an `englishLearning_` key prefix that would have exported
an empty file, since the app writes bare keys. **`US-811` did not harvest `validator.js`, correctly**:
that class validates *learner progress* shape, not authored content, and `tools/validate-content.js`
derives its schemas leave-one-out from the corpus, which `validator.js` has no code for. What is left
of this row is the delete, plus `I-11` (the global error capture) and `I-12` (the duplicate toast
container).

**Sprint 8 total: 45 points — 8 of 45 done.** `US-811` closed 2026-09-16 and filed `US-248`, the one
line that makes it a gate rather than a report.

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
| **I-1** | `npm test` fails on a clean checkout — Jest not in `devDependencies`, `package-lock.json` gitignored so `npm ci` cannot run | ✅ Fixed 2026-09-12 (`US-001`) |
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
| **I-13** | **The deployed site hung on "Loading word…"** — `CONFIG.useAPIFirst` tried the dictionary API before curated content for every word, so *"Happy"* (`data.js:6`, authored with its own IPA and quiz) waited up to **18 seconds** behind 3 attempts × 5s plus 1s and 2s of backoff. The first entry in this table that was reported from production rather than found by reading the code | ✅ Fixed 2026-09-16 (`US-245`). Breaks `CON-6`, not `NFR-8` — see §4a |

### Dependencies

| Story | Waits on |
|---|---|
| `US-201` | **OQ-4** (migrate vs reset) |
| Sprint 4 | `US-400` spike, and `AS-3` |
| Sprint 5 | `US-500` spike; `US-301` registry |
| `US-401` | `US-302` (`phon:` SRS keys) |
| `US-605` | `US-206` (IndexedDB) ✅ **satisfied**, and `US-136` (the caller) ✅ **satisfied 2026-09-12** — row closed; its export residue `US-138` ✅ **closed 2026-09-16**, so nothing dangles |
| `US-404`, `US-406` | `US-136` (the recorder) ✅ **satisfied 2026-09-12**. `US-404` closed on it; `US-406` is unblocked and unbuilt |
| `US-502` | `US-236` (modals, point 8) ✅ **satisfied 2026-09-12** |
| `US-237`'s syllabus number | **`US-242`** — a `CURRICULUM.md` §3 decision, not code. Also the reason `US-503` reads 3 of 8 against a tier holding 4 |
| `US-248` (gate the deploy) | `US-811` ✅ **satisfied 2026-09-16**, and `US-166` ✅ **satisfied 2026-09-16** — the validator's two named blockers are both gone and it reports PASS |
| `US-603` (words per minute) | **`US-247`** — the word count itself. `lastSeconds` alone cannot produce a rate without inventing one |
| `US-203`, `US-204`, `US-811` | `US-809` **harvest** step, not its delete step. ✅ Honoured — `portability.js` records its harvest from `storage.js`; `US-811` correctly harvested nothing, `validator.js` validating progress rather than content |
| `US-709` | **OQ-8** (frequency list licence) |
| `US-806` claim | `US-807`, `US-808` complete |

---

## 16. Backlog summary

| Sprint | Theme | Points | Done | Cumulative |
|---|---|---|---|---|
| 0 | Unblock | 6 | 6 | 6 |
| 1 | Honesty | 257 | 191 | 263 |
| 2 | Data integrity | 19 | 19 | 282 |
| 3 | Extensibility | 22 | 22 | 304 |
| 4 | Pronunciation | 33 | 20 | 337 |
| 5 | Grammar | 33 | 15 | 370 |
| 6 | Speaking | 37 | 13 | 407 |
| 7 | Listening & vocabulary | 40 | 8 | 447 |
| 8 | Session & platform | 45 | 8 | 492 |

`US-501` is listed in both the Sprint 1 and Sprint 5 tables — one story, one done record, ticked
in both. Its 3 points are counted under Sprint 5 here, so the Sprint 1 row reads 257 where its table
sums to 260, and 191 where its table sums to 194. **That 3-point offset is the only difference
between the two, and it is the whole reason to recount from the tables rather than from this one:**
two of the last four recounts each found a real arithmetic error here — a 5-point gap in the grand
denominator, then 300 against 306 in the MoSCoW split. **The last two recounts found none**, this one
included: every sprint row above was re-derived from its own table, the MoSCoW split was re-derived
independently and reconciles to the same grand total from both directions, and the cumulative column
was re-added from the top.

**492 points total, of which 302 are done — 61%.** Must-have work is **254 of 322 (79%)**. **`npm test` is green: 10 suites, 1,538 tests, 81.15% statement coverage** (77.12% branch, 83.49% functions, 81.21% lines), and **`node tools/validate-content.js` reports `PASS — no errors`** with four shape gaps reported and deliberately not failed. **Sprints 0, 2 and 3 are complete.** The wave's keystone is **`US-601`** — the app's **first free-production surface**, and therefore the first time `TEACHING_METHODOLOGY.md` §1's "every session ends with the learner saying something of their own" is met by something other than a grammar block that supplies the sentence. The rule that makes it honest is enforced at author time: `rubricRefuses()` **drops** any rubric item mentioning sound, accent, fluency or a score, and a prompt reduced below two usable items is dropped whole — so all 32 items are yes/no questions about what the learner *did*, and the timer is advisory in the strong sense that **after it expires the recorder still runs, no route is set and nothing is written**. **`US-608` closed as work, not as a check**, and the previous entry in this document was wrong to call it already satisfied: Read Aloud had one control and needed a microphone, and grammar `produce` offered *"I said it"* or *"Skip"* — a silent learner had to lie or take the skip. Silent now counts identically to aloud, `skipped` counts as nothing, and the card reports its own four-way split (recorded / aloud / silent / skipped) so `M-1` cannot be inflated by the escape hatch. **`US-138` put the recording archive inside the export** as a second, binary file: the readable file is byte-for-byte unchanged when no archive is passed and `FORMAT_VERSION` deliberately does **not** move, base64 inlining was rejected on arithmetic (~134MB of UTF-16 heap for a 50MB archive, and `MAX_IMPORT_BYTES` forced from 8MB to ~70MB **for every import**), and the restore is **additive** with duplicates recognised by `(promptId, createdAt, size)`. It closed `US-605`'s named residue four days after that row was credited — the "credit the criterion, file the residue" pattern paying off twice now, after `US-403`/`US-235`. **`US-166` and `US-188` closed as one change**, because they were two halves of one false claim: six `accept` entries were unreachable (there is **no typed-input path in grammar at all**), four of those items then announced *"Both answers here are right, and they do not mean the same thing"* and named an answer never shown — and one of the six, `"did see"`, turned out not to be right-but-unreachable but **wrong**. `data/grammar.js`'s schema header, which had sanctioned the pattern, was corrected too. **Grammar content is 12 of 24 syllabus points: `foundation` complete 8/8, `everyday` 4 in the tier but 3 inside points 9–16** (`US-243` future forms, `US-244` gerund/infinitive), the fourth being `register.js` at syllabus 25 — `US-242`. Both new points carry their design decision in `logAs` rather than in prose: `US-243` treats Telugu's single future form as **register, not error**, and `US-244` routes the arbitrary half of a verb pattern to `vocab.collocation` so *enjoy to read* is reported as a memory gap. **`US-811` made content validation a job that actually runs**, discovery-based and with **no `npm ci`** so the lockfile cannot break it, sharing one implementation with `content.test.js`; it is not yet a deploy gate, and now that its two named blockers are gone that one line is `US-248`. One defect came from production rather than from reading code: **`US-245`**, an 18-second hang on *"Happy"* because the optional API was tried before curated content — `CON-6`, not `NFR-8` (§4a). At 8–12 points a week of evenings the remaining 190 points are roughly **4–5 months**.

**Three rows were filed open by this wave.** `US-246` — **the streak counts days the app was opened,
not days with work**: `updateStreak()` fires from `loadProgress()` on any date change, so eight
mornings of opening and closing the app report an eight-day streak. It is the same defect class as
`US-110`, the crossword crediting an untouched grid, and a stronger version of what
`TEACHING_METHODOLOGY.md`'s gamification bullet forbids — that document's §5 prose actually *endorses*
the counter, which is worth knowing before citing it. `US-247` — **`FR-SPK-5` has no word count**;
`lastSeconds` is stored and nothing counts words, so words-per-minute was deliberately left unbuilt
rather than derived from a duration alone, and the interesting part of the fix is that a silent or
skipped route has **no** honest word count and must not be recorded as zero. `US-248` — the one line
that turns `US-811`'s validator into a deploy gate.

**Four stories remain partly satisfied and deliberately not ticked**, each with the residue named in
its row — `US-409` (no connected-speech or intonation content), `US-503` (3 of 8 everyday points;
`register.js` registers into the tier but carries syllabus 25 and is not one of them), `US-507`
(Telugu notes yes, L1 ordering no), `US-508` (audit done on four points of twelve, though `US-166`'s
closure removes its open counter-evidence). **`US-714` joined the list from the other direction**: the
"curated serves first" clause of `FR-CNT-4` is now met on the vocabulary path and the "generated items
are clearly bounded" clause is untouched, so the row is half closed and **not** repriced, because the
remaining half is where the requirement's difficulty lives. `US-502` left this list on 2026-09-12 and
`US-605` left it from the other direction — held at not-done while its module was finished and
uncalled, credited for a caller rather than for tests, and as of 2026-09-16 with its residue closed
too.
