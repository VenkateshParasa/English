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
- **Total is 451 points** (§16), of which 204 are done. At a realistic 8–12 points a week of evenings,
  the **remaining 247** is a **5–7 month** effort. Sprints 0–1 hold most of the audit's value and are
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
| **US-136** | Wire `js/core/blobstore.js` into the recording UI. Note `promptId` must be **stable content identity**, not `state.currentListeningIndex` — an index renumbers when content is inserted, and month-one recordings would then belong to someone else's sentence | `FR-DATA-6`, `FR-SPK-6` | 3 | S |
| **US-137** | Wire `js/core/mistakes.js` into the wrong-answer paths and add the dashboard panel. Calls must sit behind the existing single-answer guards or one stubborn item becomes a whole diagnosis | `FR-SRS-3` | 3 | M |
| **US-138** | `FR-DATA-4` export does not cover recordings. With blobs in IndexedDB, `CON-3`'s "export is the only backup" is now false for them | `FR-DATA-4` | 3 | M |
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
| **US-166** | `data/grammar/countability.js` accepts answers not present in the item's `options` (*some advice*, *bits of information*, *work experience*). The grader must check `accept` before falling through to `fallbackFeedback`, or defensible answers are treated as unrecognised | `FR-GRM-5` | 2 | M |
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
| **US-185** | **`gram.tense-agreement`'s label is false for 100% of what routes to it.** All three producers are `be.js` sites where a past form was chosen in a present context; the label describes the opposite error (past not carried through a multi-clause sentence). Same defect class as `gram.copula` was. Fix needs one owner for both halves — the wording and the three `logAs` sites | `FR-SRS-3` | 2 | M |
| ✅ **US-186** | Producers wired for `vocab.meaning` (vocab quiz and review card), `vocab.spelling` + `lsn.detail` (dictation), `gram.word-order` (sentence builder), and `q.mistakeCategory` authored for comprehension — all `EVIDENCE.GRADED`, all behind the existing single-answer guards, verified by answering wrong twice and getting one entry. **Four categories still have no producer, deliberately, because no gradable task exists to attach them to**: `vocab.recall` (no production-from-meaning task), `vocab.collocation` (no collocation content), `lsn.gist` (the listening section asks no comprehension question), `rdw.inference` (comprehension questions carry no type metadata, so logging every wrong answer as "needed reading between the lines" would be a false claim — a content hook was added so an author can produce it without touching `app.js`). No category id was invented — **done 2026-09-12** | `FR-SRS-3` | 3 | M |
| **US-187** | `drillTarget()` builds `srsKey` with **no check the target is authored**, so `gram:past-simple`, `gram:prepositions`, `gram:register` and the listening/reading targets yield buttons that open nothing. `gram:question-formation` was a fourth until `US-215` authored it — which fixes one target, not the missing check. The new renderer guards; a naive caller would ship a dead button | `FR-SRS-3` | 2 | M |
| **US-188** | `renderGrammarCorrect` hardcodes "Both answers here are right, and they do not mean the same thing" whenever `showDifferenceOnCorrect` is set — so an `accept` entry that is a true synonym makes the app assert a difference that does not exist. Both new authors worked around it by excluding synonyms | `FR-GRM-5` | 1 | M |
| **US-189** | `data/pronunciation/consonants.js` has no `module.exports`, unlike every other content file, so `require()` returns `{}` and no jest test can audit its four category ids | — | 1 | S |
| **US-190** | No mistake row for aspect confusion between perfect and continuous ("she's had lunch" for "she's having lunch"). Suggested: `gram.aspect-perfect-vs-progressive`, drill `present-simple-vs-continuous` | `FR-SRS-3` | 1 | S |
| **US-191** | `switchSection()` does not exit review mode, so navigating away mid-review and back re-shows the card. Pre-existing, not a regression | — | 1 | S |
| **US-192** | Wire `gram.subject-dropped` into `be.js`: add `"am"` to `be-p2`'s options **with** a `feedback` entry carrying `logAs`, plus a `rendersAs`. Without the feedback entry it falls through to `fallbackFeedback`, which has no `logAs`, so it would log the default `gram.copula` — the false label the new row exists to remove | `FR-SRS-3` | 1 | M |
| ✅ **US-193** | **`portability.js` suite written — 0% → 96.44% statements, 179 tests.** Found **three real defects** (see `US-198`–`US-200`). 44 rejection cases table-driven, each asserting the store is byte-identical afterwards — **done 2026-09-12** | `NFR-16`, `FR-DATA-4` | 3 | M |
| ✅ **US-194** | **`js/core/blobstore.js` suite written — 0% → 98.78% statements / 92.33% branch / 99.29% funcs, 211 tests.** Needed a hand-built fake IndexedDB: spec key ordering, `IDBKeyRange.bound`, `autoIncrement`, compound-index `getAll`, abort-rollback, and a settable byte budget that throws `QuotaExceededError`. Found **five defects** (`US-216`–`US-220`) plus `US-221`/`US-222`; the single uncovered line is the dead code `US-221` names — **done 2026-09-12** | `NFR-16`, `FR-DATA-6` | 3 | M |
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
| **US-216** | **`put()` reports `full` — *"Your existing recordings are safe"* — after permanently deleting an existing recording.** `evictForQuota()` commits its deletes in its own transaction, so if the single retry also hits quota the outer catch returns `fail('full', …)` with nothing to roll the eviction back. Reproduced: 4MB baseline / 1MB middle / 4MB newest at prompt `p1`, 10MB budget, saving 4MB at `p2` → `{ok:false, code:'full'}`, the new recording correctly absent **and the middle recording gone**. Contradicts `NFR-10` and the module's own stated property 2. Pinned green with a ⚠️ DEFECT marker | `NFR-10`, `BR-3`, `FR-DATA-6` | 3 | M |
| **US-217** | `remove(id)` confirms deleting a recording that was never there — `removeIds` resolves with what it was *asked* to delete, and `IDBObjectStore.delete()` on an absent key succeeds silently. `remove(9999)` → `{ok:true, removed:1, message:'Recording deleted.'}` | `BR-3` | 1 | S |
| **US-218** | `MESSAGES.savedEvicted` is chosen from `evicted.length` alone, so saving at prompt `p3` can evict `p2`'s recording and tell the learner "**this prompt** keeps your first and two most recent" while `p3` has exactly one — and never mention that a *different* prompt lost one | `BR-3`, `FR-DATA-6` | 1 | S |
| **US-219** | `openUrl()` says "That recording is no longer on this device" when IndexedDB is merely unavailable, because `get()` flattens unavailable and not-found to `null`. Same class as `US-106`: the learner cannot tell whether the app broke or the data is gone | `NFR-3`, `BR-3` | 1 | S |
| **US-220** | `cleanNumber(null) === 0`, so a recording saved without a duration is reported as `null` by `put()` and `0` by `list()`/`get()` — one recording, two answers, and a UI showing "0:00". Related and spec-derived rather than observed: a null `createdAt` is coerced to the epoch by `usableRows` yet is absent from the compound index, so such a row is counted by `usage()` and acted on by eviction while being invisible to `list()` | `FR-DATA-6` | 2 | S |
| **US-221** | `blobstore.js:777-779` is **dead code** — `size > MAX_TOTAL_BYTES` can never fire because the 10MB per-recording check at `:773` fires first, so `limit: MAX_TOTAL_BYTES` is unreachable. The suite's only uncovered line. Delete it or make the two limits independent | — | 1 | C |
| **US-222** | `planRetention` pins `ordered[0]` while `evictionCandidates` checks `r.baseline`, so if a learner deletes the true baseline one protection guards the next-oldest row and the other considers that same row expendable. The two disagree on what "baseline" means; `FR-DATA-6` names only one | `FR-DATA-6` | 1 | S |
| **US-223** | **The sentences section still violates `FR-GRM-2`/`FR-A11Y-5`**: `✗ Incorrect. Try again! (Attempt 1/3)` — a red ✗ with no reason, no contrast, and the hint only after three attempts. The last section with this shape after `US-140`/`US-141`. Fixing it needs **authored per-option feedback** like `data/grammar/` has, not copy written in `app.js` | `FR-GRM-2`, `FR-A11Y-5` | 2 | M |
| **US-224** | **No mistake-category id for an omitted auxiliary** (*"Where you live?"*, *"You know him?"*). `gram.word-order` is the honest destination and is what `question-formation`'s options log, with `errorKind: 'auxiliary-omitted-in-direct-question'` keeping the finer grain. A content/taxonomy story, not a defect: decide whether the finer grain earns its own row before a second content file needs it | `FR-SRS-3` | 1 | S |
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

**Sprint 1 total: 221 points across 119 stories — 70 done (145 points), 49 remaining (76 points).**
The remaining items are
almost all hygiene, copy or wiring surfaced by later work; `US-110` (crossword crediting a blank
grid) is the last learner-facing honesty defect and waits on `OQ-7`.

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
| ✅ **US-500** | Authored **one** grammar point (articles) end to end for review, plus a schema designed to carry all 24 — **done 2026-09-09**. See `docs/GRAMMAR_SAMPLE_REVIEW.md` | `FR-GRM-1` | 2 | M |
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

| Sprint | Theme | Points | Done | Cumulative |
|---|---|---|---|---|
| 0 | Unblock | 6 | 6 | 6 |
| 1 | Honesty | 218 | 142 | 224 |
| 2 | Data integrity | 19 | 19 | 243 |
| 3 | Extensibility | 22 | 22 | 265 |
| 4 | Pronunciation | 33 | 5 | 298 |
| 5 | Grammar | 33 | 5 | 331 |
| 6 | Speaking | 36 | 0 | 367 |
| 7 | Listening & vocabulary | 40 | 0 | 407 |
| 8 | Session & platform | 44 | 5 | 451 |

`US-501` is listed in both the Sprint 1 and Sprint 5 tables — one story, one done record. Its 3 points
are counted under Sprint 5 here, so the Sprint 1 row reads 218 where its table sums to 221.

**451 points total, of which 204 are done — 45%.** Must-have work is **177 of 300 (59%)**. **`npm test` is green: 9 suites, 1,046 tests, 77.4% statement coverage** (72.32% branch, 80.32% functions). **Sprints 0, 2 and 3 are complete** — Sprint 0 closed when `US-001` un-ignored `package-lock.json`, the last reason CI could never install jest. Six modules carry suites at 85–100% and `blobstore.js` joined them at 98.78%, which is where the last two waves' defects came from: the untested modules are now the tested ones, and the nine stories they produced (`US-216`–`US-224`) are all still open — `US-216` first, because `put()` deletes a recording and then says none was lost. What remains open is concentrated in Sprint 1 — 76 points of hygiene, copy and wiring surfaced by later work, plus `US-110` (the crossword crediting a blank grid), the last learner-facing honesty defect, which waits on `OQ-7`. At 8–12 points a week of evenings the remaining 247 points are roughly **5–7 months**.
