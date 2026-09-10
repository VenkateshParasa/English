# 📋 Progress Ledger

The running record of **what we did** and **what is left**, sized so you can pick up one
item at a time. This is the doc to open first.

It deliberately does **not** duplicate content from the specification docs —
it points at them:

[CURRICULUM.md](CURRICULUM.md) (what we teach) ·
[TEACHING_METHODOLOGY.md](TEACHING_METHODOLOGY.md) (how we teach) ·
[CONTENT_AUTHORING_GUIDE.md](CONTENT_AUTHORING_GUIDE.md) (how to add content) ·
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (the phased build plan)

**Last updated:** 2026-09-09

---

## How to use this doc

- **Two tracks run in parallel.** Track A is the requirements paperwork (§4). Track B is
  the actual app work (§6). They are independent — you can do A1 and Phase 1 in either order.
- **Each unfilled box is one sitting.** If an item looks like more than about two hours,
  it is written wrong — split it.
- **Nothing is marked done here without evidence.** Every ✅ row in §2 names the file,
  the test, or the command that proves it. If it cannot be proven, it is ⏳, not ✅.
- **§3 is the asset inventory.** Read it before writing any requirement — a surprising
  amount is already built, and some of it is better than the docs suggest.
- **§5 is the list I need answers on.** Those are blocking or near-blocking, and they are
  decisions only you can make.

**Legend:** ✅ done and verified · 🔶 done, not yet verified · ⏳ in progress · ☐ not started · 🔴 blocked

---

## 1. Where the project stands, in one paragraph

Phase 0 and all seven planning docs are **committed**. **Sprint 0 is 4 of 6 points and Sprint 1 is
38 of 53.** Everything that actively misled a learner is now fixed: the quiz-grading corruption,
the fabricated IPA, the unearned WCAG claim, the substring speech check and its "✓ Perfect!", the
random exercise mode, the inert statistics pipeline, the inflating counters, the double-counted
reading passage, the solve-per-click scramble, the crashing fill-blank, and the validator that
accused learners of "invalid speech input" for saying *café*. `levels.js` and `migrations.js` now
actually run, and **the read-aloud exercise finally reads the sentence aloud** rather than a random
unrelated word. What remains in Sprint 1 is mostly hygiene and doc staleness (`US-124`–`US-129`),
plus `US-110` — the crossword still credits a solve on a blank grid, and it waits on `OQ-7`. One
blocker is unchanged and is not code: **`npm test` still cannot run** (`US-001`), so four waves of
changes to `app.js` rest on `node --check` and hand-verification alone.

---

## 2. What we did

### 2.1 Specification & audit — done

| # | Item | Evidence |
|---|---|---|
| ✅ | Pedagogical audit of the whole app; 14 gaps found and prioritised P1–P4 | [CURRICULUM.md §5](CURRICULUM.md) |
| ✅ | Syllabus written — CEFR framework, 6 strands, 24-point grammar syllabus, 7-part pronunciation syllabus | `docs/CURRICULUM.md`, 298 lines |
| ✅ | Pedagogy contract written — 7 principles, per-exercise feedback rules, SRS policy, promotion thresholds, tone, accessibility | `docs/TEACHING_METHODOLOGY.md`, 158 lines |
| ✅ | Content authoring schemas + pre-commit checklist | `docs/CONTENT_AUTHORING_GUIDE.md`, 306 lines |
| ✅ | 10-phase build plan, each phase independently shippable, ordered by descending data risk | `docs/IMPLEMENTATION_PLAN.md`, 881 lines |
| ✅ | 3 live bugs isolated and located to exact lines | [IMPLEMENTATION_PLAN.md § Three live bugs](IMPLEMENTATION_PLAN.md) |

### 2.2 Phase 0 — safety net and versioning spine (2026-08-14)

**Goal was zero behaviour change, and that held** — `js/core/srs.js` is byte-identical to
the committed version.

| # | Item | Evidence |
|---|---|---|
| ✅ | `js/core/levels.js` — 4 CEFR tiers, permanent legacy alias map, idempotent `canonicalLevel()` | 104 lines; identity aliases are load-bearing for idempotency |
| ✅ | `js/core/migrations.js` — `SCHEMA_VERSION = 1`, ordered upgrade chain, `migrateExerciseId`, `backupOnce` | 131 lines |
| ✅ | Test harness — `jest.config.js` + 5 npm scripts | `package.json:12-16` |
| ✅ | 3 unit suites — migrations (24), SRS (23), assets (65) | **112/112 assertions passing** |
| ✅ | Assertions proven non-vacuous — mutation-tested by breaking a level alias, dropping a precache entry, changing an SRS interval | all 3 mutations caught |
| ✅ | 5 orphaned suites quarantined | `__tests__/legacy/` |
| ✅ | `service-worker.js` — `STATIC_ASSETS` 19 → 23, cache `v3` → `v4` | precache completeness now asserted by `assets.test.js` |
| ✅ | `index.html` loads `levels.js` + `migrations.js` in dependency order | `index.html:360-361` |
| ✅ | `.gitignore` — `__tests__/` and `docs/` un-ignored | the 4 spec docs had never been committable |
| 🔶 | The 112 assertions run under **real Jest** | ran via a throwaway Jest-compatible shim, *not* Jest — see 🔴 B1 |

### 2.3 This session — requirements gap analysis

| # | Item | Evidence |
|---|---|---|
| ✅ | Audited all 11 docs for requirements coverage; confirmed **no requirements doc exists** | 5 named gaps, §2.4 below |
| ✅ | 4 scoping decisions taken | §7 Decisions log |
| ✅ | Personas + Telugu L1 interference analysis designed | plan file, pending write-up as **A1** |
| ✅ | Every code line to be cited re-read and confirmed accurate | `parseAPIResponse`, `generateVocabularyWord`, the speech check, `startRecognition`, `loadListeningExercise`, `SRS.schedule` — all confirmed against source |
| ✅ | Plan approved | `~/.claude/plans/okay-lets-create-it-cuddly-breeze.md` |
| ✅ | **Asset inventory** — read the whole codebase to establish what is already built and reusable | §3 below |

### 2.4 The five requirements gaps this work closes

1. No business goal or success metrics — nothing to judge a feature against.
2. Hard constraints buried in prose at `IMPLEMENTATION_PLAN.md:27` rather than numbered.
3. No non-functional requirements at all — no offline, performance, browser, accessibility or durability commitments.
4. Acceptance criteria are per-phase, not per-requirement — you can ask "is Phase 4 done?" but not "is requirement X satisfied?"
5. Requirements entangled with the defect list in `CURRICULUM.md §5`.

### 2.5 Wave 1 — first code changes and a second audit (2026-09-08)

Three subagents, scoped so no two touched the same file.

| # | Item | Evidence |
|---|---|---|
| ✅ | **US-101 + US-105 — quiz grading fixed.** `parseAPIResponse` now derives `correct` from `options.indexOf(correctDefinition)` after the shuffle, and distractors are real definitions of other `vocabularyData` entries | `app.js` `parseAPIResponse()`; new helper `getDistractorDefinitions(correctDefinition, count)` at `app.js` `Toast()`. `node --check app.js` passes |
| ✅ | Distractor helper degrades safely — `try/catch` around data access, `Array.isArray` guards, per-entry type checks, generic top-up so the option list is always 4 and `correct` always valid | Verified in Node against real `data.js`: 5000 renders, 0 index mismatches, 0 duplicate options, 0 placeholder strings; also survives deleted `vocabularyData`, unknown level, single-entry level, deleted `state` |
| ✅ | **W4 — doc drift corrected.** `FOLDER_STRUCTURE.md` and `ERROR_HANDLING_GUIDE.md` no longer present `new StorageManager(errorHandler, validator)` as the app's architecture; the aspirational design is retained but labelled *not wired up* | Both files edited; `js/core/` modules marked ⚠️ UNUSED with a harvest-then-delete note |
| ✅ | **Second doc audit** — `TECHNICAL_DOCUMENTATION.md`, `USER_GUIDE.md`, `docs/README.md` reviewed against source | 15 findings, §3.7 below |
| ⚠️ | `app.js` grew 3107 → **3160** lines, so every citation past ~985 shifted by +53 | All `app.js:` references in `PROGRESS.md`, `REQUIREMENTS.md` and `PRODUCT_BACKLOG.md` renumbered |

**One correction to an earlier claim in this ledger.** §3.4 called all four `js/core` modules dead.
`error-handler.js` is **not** fully dead: lines 332 and 341 register real `window` `error` and
`unhandledrejection` listeners, and `logError` persists to an `errorLog` key. It is the app's only
global error capture. It must be **preserved or replaced** before deletion, not simply removed.
Also `notification.js` mutates the DOM at load (its constructor calls `init()`, appending a
`.toast-container` and an `#sr-announcer`), so every page currently has **two** `.toast-container`
elements — `app.js`'s `Toast` creates its own with the same class.

### 2.6 Wave 2 — Sprint 1 mostly cleared (2026-09-09)

Three subagents on disjoint regions of `app.js` plus the docs, then two fixes done directly.

| # | Item | Evidence |
|---|---|---|
| ✅ | **US-102 — fabricated IPA gone.** `generateVocabularyWord` now sets `pronunciation: ''` (`generateVocabularyWord()` in `app.js`), and a new `setPronunciationDisplay()` helper (`setPronunciationDisplay()` in `app.js`) hides the element when the value is falsy | Also fixed a latent bug: one of the two DOM write sites had no `\|\| ''` fallback, so an `undefined` pronunciation printed the literal text "undefined" |
| ✅ | **US-107 — WCAG claim deleted.** The startup log is gone, with nothing put in its place | 0 matches for `WCAG 2.1 AA Compliant` in `app.js` |
| ✅ | **US-108 — exercise mode deterministic.** `exerciseTypes[state.currentSentenceIndex % exerciseTypes.length]` (`app.js`) replaces the random pick, so a failed item can be retried in the mode it was failed in | The two downstream dispatch sites derive the type from the live DOM, so they were already consistent |
| ✅ | **US-109 — statistics pipeline repaired.** All five types now route through `updateStatistics()`; the eight `state.stats.*` writes are removed | `grep -c 'state\.stats\.'` → **0**. The object itself is retained in `state` and `loadProgress` so old saves still load and `validator.js`'s progress schema still validates |
| ✅ | **US-111 — quiz counters guarded.** Counting moved inside the existing `if (!answered)` block; visual feedback stays unguarded | One rendered word can now contribute at most one increment |
| ✅ | **US-112 — reading counts once.** Both the comprehension and dictation paths wrap counting in `if (!isExerciseCompleted('reading', …))` | Whichever path fires first records the passage |
| ✅ | **US-113 — README testing claims corrected.** "260+ tests / 40+ integration / 70% coverage enforced" replaced with the real 112 assertions across 3 suites, the deliberate absence of a coverage threshold, and the Jest-not-declared gap stated plainly | `docs/README.md` §Testing rewritten |
| ✅ | **`updateStatistics` now has a `default` case** that `console.warn`s instead of silently counting nothing | `IMPLEMENTATION_PLAN.md` called this out as "the worst kind of bug"; it was still open |
| ✅ | **Listening now counts at all.** Both listening success paths call `updateStatistics('listening')`, guarded by `isExerciseCompleted`; added Listening rows to Today's Progress and Daily Averages, and included `totalListening` in "Total Exercises" | The switch always supported `'listening'` but nothing ever passed it, so `totalListening` was permanently 0 and displayed nowhere |
| ⚠️ | `app.js` 3160 → **3213** lines; citations renumbered again | All `app.js:` references across the three planning docs updated |

**Four new defects surfaced by these fixes**, now `US-114`…`US-117`:

- **`exercise.fillBlank` can be `undefined`**, so `case 'fillblank'` throws. Determinism converted
  this from an intermittent ~25% failure into a *reproducible* one at `index % 4 === 1`. That is an
  improvement — a visible bug beats a flaky one — but it needs fixing, and it touches `data.js`.
- **Scramble double-counts**: repeated "Check" clicks on a correct answer each count a solve. Unlike
  sentences and reading there is no exercise id to guard on.
- **Scramble's authored `hint` is dead code** (`app.js` writes it, `app.js` `initializeReadingButtons()` immediately
  hides it, `app.js` overwrites it with the answer).
- **`TECHNICAL_DOCUMENTATION.md`** stale line refs and the nonexistent `capitalize()` helper.

**Deliberately not done:** `US-110` (crossword honesty) still waits on `OQ-7` — there is no point
repairing a crossword that may be retired. Routing it through `updateStatistics` in US-109 does mean
its fake "solve" now shows on the dashboard, which makes the dishonesty more visible, not less.

---

### 2.7 Wave 3 — Phase 0 modules finally wired, honest speech feedback (2026-09-09)

| # | Item | Evidence |
|---|---|---|
| ✅ | **US-103 — word-level read-aloud diff.** The substring match and "✓ Perfect!" are gone. `diffSpeechAttempt()` aligns target against transcript with an **LCS over normalised word lists**, so one dropped or inserted word costs exactly one word instead of marking everything after it wrong | Hand-traced on 9 cases including insertion, deletion, empty transcript, casing and punctuation. Full match reads *"The recogniser understood every word."*; partial reads *"The recogniser missed 2 of 9 words: asked, texts."* |
| ✅ | No XSS surface in the new rendering — `renderSpeechDiff()` uses `textContent` and `createTextNode` only, zero `innerHTML` | Verified: 0 `innerHTML` occurrences in the function |
| ✅ | **US-106 — recognition errors differentiated.** A `speechRecognitionErrors` table gives distinct, non-blaming messages for `no-speech`, `not-allowed`, `service-not-allowed`, `audio-capture`, `network` and a fallback | `aborted` now returns early with no toast *and* no `logError`, since it fires on ordinary cancellation and was polluting the error log |
| ✅ | **US-003 — migrations run at startup.** `migrateStoredProgress()` runs the chain after parse and before merging into `state`, takes `backupOnce` first, persists the result, and soft-fails on a missing module | **Independently verified**: idempotent (second run byte-identical), backup equals the pristine record, unknown future fields preserved, all seven hostile `schemaVersion` values converge, and a missing `Migrations` does not throw |
| ✅ | **US-004 — `levels.js` wired in.** `resolveDifficulty()` normalises through `canonicalLevel()` at both entry points and bridges canonical ids to the data keys that exist, by *reversing* `LEVEL_ALIASES` rather than hardcoding | **Independently verified** across 14 inputs: identity on `basic`/`intermediate`/`medium`, and every degraded input (`undefined`, `null`, `42`, `{}`, `'fluent'`, `'  MEDIUM  '`) yields populated content in all four maps. Zero empty arrays |
| ✅ | **US-118 — `USER_GUIDE.md` corrected.** The nonexistent achievement system reframed as explicitly-untracked personal targets, `file://` instructions replaced with `npm start`, "Show Hint" corrected to its real label "Show Answer", Safari replay caveat added, and an unactionable notification-permission step removed | Also documented the crossword stub honestly and added the previously-undocumented SRS review bar |
| ✅ | **All 83 `app.js` line citations converted to function-name anchors** | They had rotted in all three waves (3107 → 3160 → 3213 → 3514 lines). Function anchors do not rot |

**One behaviour tightening, stated explicitly:** read-aloud completion now requires a **full**
match. The old substring test passed on any utterance merely containing the target, so this is
stricter than before. A partial attempt renders feedback and records nothing.

**Five new defects found**, now `US-119`–`US-123`. The one that matters:

> **`US-119` — the read-aloud target is a single random vocabulary word, unrelated to the sentence
> being played.** So "the recogniser understood every word" is trivially true on a one-word target,
> and saying a whole sentence containing that word still passes. US-103 made the *feedback* honest;
> it did not make the *exercise* meaningful. The real fix is to make the target the sentence in
> `listenSentence`.

Also: read-aloud failure records no SRS lapse (`US-120`); `validateInput`'s character pattern
rejects ordinary transcripts with curly apostrophes or accents and then accuses the learner of
"invalid speech input" (`US-121`); `migrations.js` downgrades a future schema version (`US-122`);
and Word Search selection never clears on a wrong guess (`US-123`).

---

### 2.8 Wave 4 — the read-aloud exercise becomes real (2026-09-09)

| # | Item | Evidence |
|---|---|---|
| ✅ | **US-119 + US-104 — the read-aloud target is now the sentence.** `getListeningSentence(index, difficulty)` produces the string once; the `startSpeech` handler reads `playListening.dataset.text` — literally what `speechAPI.speak` was handed — so the target **is** the played sentence rather than a copy that can drift | Traced across 8 indices: target matched the played sentence every time, identical across 5 consecutive re-renders. No `Math.random()` remains in the target path. The word-level diff now does real work, reporting which words of the sentence were missed |
| ✅ | **US-120 — SRS lapse on read-aloud failure**, gated honestly: lapses only vocabulary words the diff reports missed, and only when the recogniser matched **more than half** the sentence. Below that, the evidence is about the microphone or noise, not about specific words | Asymmetric on purpose — never `schedule(word, true)`, because a recogniser match is not evidence the learner knows a word. The lapse is surfaced to the learner ("Added back to your review queue: Weather"), not silent |
| ✅ | **US-121 — the validator stopped accusing learners.** The allowlist `/^[a-zA-Z0-9\s.,!?'\-]+$/` rejected curly apostrophes, ampersands and every accented letter, then displayed *"Invalid speech input detected"*. Replaced with a denylist of genuinely unsafe characters plus a hard 2000-char cap | Verified in node: `don't stop`, `fish & chips`, `café naïve résumé`, em-dashes, CJK and `50% of £5 @ #1` all pass; control characters and bidi overrides are stripped; `<script>` is defanged. Escaping is at the point of use — `renderSpeechDiff` is `textContent`-only |
| ✅ | **US-122 — no more silent schema downgrade.** `migrateProgress` now leaves a future version untouched instead of stamping it down, and exposes `isFutureVersion()` | ⚠️ The agent flagged that its own fix was **incomplete**: `saveProgress()` re-stamped `SCHEMA_VERSION` unconditionally, undoing it on the next save. Closed separately — the stamp is now `Math.max(state.schemaVersion, SCHEMA_VERSION)`. Verified end to end: a v2 record survives load *and* save at 2 |
| ✅ | **US-114 — the fill-blank crash is fixed at the point of use.** Blanks are derived from the exercise's own words (blanked **by position**, not by substring replace) when the supplied prompt is missing or corrupt; drag-and-drop is the last resort | Swept all 3000 fill-blank indices × 3 levels: **81 corrupt prompts rejected and rebuilt, 0 left unrenderable.** Determinism preserved — 5 repeat renders of indices 0-59 byte-identical |
| ✅ | **US-115 — scramble no longer counts a solve per click.** A once-per-render `dataset.counted` flag, reset in `loadWordScramble` | Measured against `git show HEAD:app.js`: 4 clicks recorded **4** solves before, **1** after. Advancing to the next scramble still counts |
| ✅ | 10 new assertions added to `__tests__/unit/migrations.test.js` for the future-version behaviour | 🔶 **Unrun as jest tests** — jest is still not installed. They were exercised through a throwaway `describe/it/expect` shim in plain node and all 34 blocks held, which checks the assertions' logic but not jest compatibility |

**Why the guard patterns differ across sections, since it looks inconsistent:** scramble could not
use `isExerciseCompleted` because `loadWordScramble` picks with `Math.random()` and so has no stable
id, and `state.completedExercises` has no `scramble` bucket. It could not use a closure local
because `initializeScrambleButtons` runs once at startup while `loadWordScramble` runs per puzzle —
the lifetimes do not match. The dataset flag is the vocabulary quiz's once-per-render semantics,
stored where both closures can reach it, and deliberately kept out of `state` because
`saveProgress()` spreads `state` and would persist a transient flag.

**Six new items → `US-124`–`US-129`.** The one that matters is **`US-124`**: the fill-blank
corruption has a *source*, not just a symptom. `generateAlgorithmicSentence` does
`correct.replace(words[mid], "___")` — a first-occurrence **substring** replace — which blanks
mid-word (`underst___ing`). US-114 rejects and rebuilds those downstream; the generator is still
wrong. Also found: `classifyError` never returns `VALIDATION`, so every validation failure shows
**two** toasts, one of them a useless "Something went wrong" (`US-125`).

---

## 3. Asset inventory — what already works

Read this before writing a requirement. The app is further along than the audit docs imply:
several "missing" features are actually **built but unwired**, which is a wiring job, not a
build. Conversely ~1,690 lines load on every page and do nothing.

### 3.1 Load-bearing and genuinely good — build on these

| Asset | Where | Why it matters |
|---|---|---|
| **SRS engine** — simplified SM-2, `localStorage`, full API (`schedule`, `getDueWords`, `dueCount`, `stats`, `getRecord`, `reset`) | `js/core/srs.js`, 175 lines | The single most valuable asset in the repo. Backend-free by design, 23 passing assertions. Phase 4 **generalises** it; it does not rewrite it. |
| **Working review mode** built on that engine — `startReview` / `loadReviewWord` / `onReviewAnswer` / `exitReview`, plus a live due-count badge | `app.js` `exitReview()`, fed at `app.js` `updateDashboard()` | "Review Due" is a real, complete loop today. The pedagogy in `TEACHING_METHODOLOGY.md §3` already has a host. |
| **PWA offline shell** — 3 cache buckets, differentiated strategies (cache-first for static, network-first for API and HTML), `offline.html` fallback, "new version available" toast, hourly update check | `service-worker.js`, `offline.html` | The offline NFR is **substantially already met**. Precache completeness is asserted by `assets.test.js` (65 assertions), so it cannot silently rot. |
| **Installable app** — complete manifest, standalone display, 10 icon sizes that all actually exist on disk | `manifest.json`, `icons/` | Nothing to do for "installable on a phone". |
| **Speech synthesis wrapper** — `speak(text, rate)`, `pause`, `resume`, `stop`, `replay`, tracks current text and rate | `app.js` | **`rate` already exists as a parameter and is simply never varied.** Listening speed grading (0.75×/1.0×/1.25×) is a UI control, not a feature build. |
| **Speech recognition** with correct feature detection and a graceful toast on unsupported browsers | `app.js` | The iOS-Safari degradation path the NFRs need already has its hook. What is wrong is the *verdict logic* at `app.js` `parseAPIResponse()`, not the plumbing. |
| **Voice recording** via `MediaRecorder` + `getUserMedia` | `app.js` | Capture works. What is missing is the archive and the rubric — not the recorder. |
| **Keyboard navigation** — shortcut map, focus indicators, focus trap | `app.js` (~220 lines) + `css/accessibility.css` | A real head start on the accessibility requirements in `TEACHING_METHODOLOGY.md §6`. |
| **Progress & stats engine** — save/load, streak tracking, per-exercise completion IDs, retake support, rolling averages with comparison badges, autosave every 30s | `app.js`, `1173-1280` | This is the substrate the success metrics need. Metrics are a *derivation* on existing data, not new instrumentation. |
| **Error/toast/loading utilities** actually in use — 20 call sites, with retry and timeout handling | `app.js` | Ugly that they duplicate `js/core/*`, but they work and they are wired. |
| **Exercise variety already shipped** — drag-drop sentence builder, fill-in-the-blank, multiple choice, word reorder, word search, crossword, scramble, matching pairs, dictation, hint-with-show-answer | across `app.js` | Far more interaction types than the docs credit. New strands can reuse these patterns. |
| **Phase 0 modules** — `levels.js` (4 CEFR tiers, permanent aliases, idempotent) and `migrations.js` (`SCHEMA_VERSION`, upgrade chain, `backupOnce`) | 104 + 131 lines, 47 assertions | Correct and tested. See 3.3 — not yet called. |

### 3.2 Curated content that exists

| Content | Counts (`basic` / `intermediate` / `medium`) | Schema |
|---|---|---|
| Vocabulary | 27 / 17 / 17 = **61** | `word`, `pronunciation` (real IPA), `definition`, `example`, `quiz{question, options, correct}` |
| Sentence exercises | 5 / 5 / 5 = **15** | `words`, `correct`, `fillBlank` |
| Reading passages | 2 / 2 / 1 = **5** | `title`, `text`, `questions`, **`dictation`** |
| Listening sentences | 10 / 10 / 10 = **30** | bare strings |
| Puzzles | word search, scramble (10/10/10), matching (10/10/10) | — |

Two things this exposes that the docs do not say:

- **Reading passages already carry a `dictation` field.** `CURRICULUM.md §3` Strand D asks for
  dictation to move into Listening — the data is already there to reuse.
- **`listeningExercises` entries are bare strings**, so adding comprehension questions is the
  `string[]` → `object[]` conversion that Phase 8 flags as its riskiest single step. Confirmed.

### 3.3 Built but not wired — the cheapest wins in the repo

| Finding | Evidence |
|---|---|
| **`levels.js` has zero call sites in `app.js`.** `canonicalLevel`, `isKnownLevel`, `levelIds`, `levelLabel` — all 0 references. | The module loads at `index.html:360` and is never used. |
| **`migrations.js` has zero call sites.** `loadProgress()` at `app.js` `loadProgress()` never calls `Migrations.migrateProgress`, so `schemaVersion` is **never written to `localStorage`**. | The migration spine exists but has never run against real data. |
| **`data.js` still uses `basic` / `intermediate` / `medium`** while `levels.js` defines `foundation` / `everyday` / `confident` / `fluent`. | The rename is entirely unstarted, and **no `fluent` content exists at all** — Phase 2 lands a 4th tier with zero items in it. |

This is by design — Phase 0 promised zero behaviour change and delivered it — but it means the
CEFR framework currently exists only on paper and in tests.

### 3.4 Dead weight — ~1,690 lines loading on every page for nothing

| File | Lines | Status |
|---|---|---|
| `js/core/notification.js` | 508 | `NotificationManager` instantiated inside its own file; **never used by `app.js`**, which has its own `Toast` |
| `js/core/storage.js` | 426 | `StorageManager` **never instantiated anywhere** |
| `js/core/validator.js` | 396 | `Validator` **never instantiated anywhere** |
| `js/core/error-handler.js` | 357 | `errorHandler` instantiated inside its own file; `app.js` uses its own `AppErrorHandler` (20 call sites) |

**⚠️ Do not simply delete these — harvest them first.** Phase 10 says to delete `storage.js` and
`notification.js`, but two of these files contain exactly the code the new requirements are about
to ask for:

- `storage.js` has `createBackup`, `restoreFromBackup`, `exportData`, `importData`,
  `getStorageInfo`, `getAvailableSpace`, `compress`/`decompress` — i.e. the data-durability NFR
  and the "export my stats" answer to **B5**, already written.
- `validator.js` has `validateSchema`, `validateExercise`, `validateProgress`, `sanitizeHTML` —
  i.e. the content-authoring validation the P5 author persona needs, and a migration safety net.

Recommendation: extract those functions into the modules that will use them, **then** delete the
class shells. Deleting first means rewriting them in Phase 5.

### 3.5 Two claims in the repo that are not true

Both are honesty problems of the same kind the audit already objects to, so they belong in the
same bucket as the three live bugs.

1. ~~**`app.js` logged `'♿ Accessibility: WCAG 2.1 AA Compliant'` at every startup.**~~ ✅ **Fixed
   2026-09-09 (US-107)** — the line is deleted. Nothing verified it: no audit, no automated check,
   and the keyboard suites are quarantined in `__tests__/legacy/`. Real work exists (§3.1), but the
   claim was unearned. `NFR-11` now states WCAG 2.1 AA as a *target with an audit* (`US-806`).
2. **`docs/FOLDER_STRUCTURE.md:123-124` and `docs/ERROR_HANDLING_GUIDE.md:57-58` document
   `new StorageManager(errorHandler, validator)` as the app's architecture.** That wiring does
   not exist anywhere in the app. Those docs describe an intended design that was never adopted.

### 3.6 Existing content and exercises — all of it is kept

**No document in the repo deletes any content or any exercise type.** The plan is additive
throughout, and says so in two places:

- `IMPLEMENTATION_PLAN.md:610` — *"new content types go in new `data/*.js` classic scripts;
  **existing structures are enriched in `data.js` in place**"*, and `data.js` is touched
  **exactly twice** in the whole plan: Phase 2 (level keys) and Phase 8 (schema enrichment).
- `IMPLEMENTATION_PLAN.md:472` — Phase 3 introduces the `SECTIONS` registry *"additively, with
  zero new sections in this phase."*

Phase 10 hygiene deletes **dead JavaScript modules** (§3.4), never content.

#### Sentence / phrase building — kept, four views on one data shape

The Sentences strand is 15 curated items (5 per level) plus the generator, and the four
interaction modes are **not four datasets** — they are four renderings of the same
`{words, correct, fillBlank}` item, dispatched at `app.js`:

| Mode | Loader |
|---|---|
| Drag-and-drop builder | `loadDragDropSentence()` in `app.js` |
| Fill in the blank | `loadFillBlankExercise()` in `app.js` |
| Multiple choice | `loadMultipleChoiceSentence()` in `app.js` |
| Word reorder | `loadReorderSentence()` in `app.js` |

That is efficient, and it means enriching one item improves four exercises.

**Its priority drops, though — it is not removed.** `CURRICULUM.md:235` is explicit:
*"Writing exists only as word-ordering. For a spoken-English course that is acceptable as a low
priority."* And `CURRICULUM.md:23` places multiple choice and matching as *"warm-ups, never the
goal."* So these keep their slot as warm-ups and stop being the main event.

**The one addition proposed for this strand** (`CURRICULUM.md:236-238`): sentence transformation
— *"Rewrite in the passive"*, *"Make this polite"* — called out as cheap to build and directly
useful for speech, because it drills the structural flexibility speaking requires.

#### What *does* change about them — behaviour, not existence

| # | Change | Why |
|---|---|---|
| 1 | Fill-in-the-blank feedback must gain a **reason, a contrast, and a retry** | Today it is the app's only grammar teaching and it does none of it — `CURRICULUM.md:91-95` calls it *"assessment without teaching"*. Required by `TEACHING_METHODOLOGY.md §2`. |
| 2 | **Stop re-randomising the exercise mode on every render** — `app.js` picks the type with `Math.random()` | A learner who fails a fill-blank and navigates back gets a drag-drop instead, so the "retry" the pedagogy contract requires is unreachable. Same defect class as the random target word at `app.js` `generateVocabularyWord()`. |
| 3 | Level keys migrate `basic`/`intermediate`/`medium` → CEFR ids | Phase 2. Content survives untouched; only the keys change. |
| 4 | Generated sentences become **padding only, never primary content** | Gap #9 — *"The penguin meanders madly at the estuary"* is valid, memorable and useless (`TEACHING_METHODOLOGY.md §6`). The generator stays; its role shrinks. |

#### ⚠️ Puzzles are the one orphan

Word search, crossword, scramble (10/10/10) and matching (10/10/10) are **built and working**,
but they appear in **no strand, no gap, and no requirement**. `CURRICULUM.md`,
`TEACHING_METHODOLOGY.md` and `CONTENT_AUTHORING_GUIDE.md` mention them zero times; the only
reference anywhere is `IMPLEMENTATION_PLAN.md:770`, about a stat-key naming inconsistency.

So they are not scheduled for deletion — but nothing justifies keeping them either. That needs
a decision, logged as **B8**.

---

### 3.7 Wave 1 audit — defects found beyond the original three

The original audit named 3 live bugs. A second pass found **10 more**. The three marked
**✅ verified personally** I re-checked against source myself; the rest are agent-reported with a
file:line to check.

#### 🔴 High — the app awards credit for nothing

| # | Defect | Evidence | Why it matters |
|---|---|---|---|
| **D1** ✅ | **Three of the four dashboard counters are permanently 0.** `updateDashboard` renders `state.overallStats.total*` (`updateDashboard()` in `app.js`), but `updateStatistics()` — the only writer of those fields — is called **exactly once**, for `'vocabulary'` (`updateStatistics()` in `app.js`). Sentences, reading and puzzles all incremented `state.stats.*` instead — eight write sites across the sentence, reading, dictation and four puzzle handlers — which `loadProgress()` reads on startup and **nothing displays** | verified by grep: `updateStatistics(` has 1 call site | Only "Words Learned" ever moves. Breaks `BR-8` and makes `M-1`…`M-8` uncomputable. Also makes the `USER_GUIDE.md` milestones unobservable |
| **D2** ✅ | **The crossword is a stub that grants the daily goal for a blank grid.** `generateCrossword()` in `app.js` hardcodes 2 clue strings and builds 64 cells of empty `<input>` with **no answer key**. `checkCrossword` (`initializeReadingButtons()` in `app.js`) validates nothing: it increments `puzzlesSolved`, sets `dailyGoals.puzzle = true`, saves, and `alert('Checked!')` | read the function; there is no answer data anywhere | **This is the same class of dishonesty as "✓ Perfect!"** — it is a `BR-3` violation, not just a missing feature |
| **D3** ✅ | **Word search is unwinnable.** On a match the handler adds `.found` but **never clears `.selected`** (`app.js`), so the accumulated selection string can never equal a second word. The completion branch requires all words found → unreachable. Selection also ignores adjacency, so scattered clicks spelling a word count | read the handler | A puzzle that cannot be completed, in a section that has no owning requirement anyway (`OQ-7`) |
| **D5** ✅ | **`docs/README.md:85-93` claims "260+ Unit Tests", "40+ Integration Tests" and "70% Code Coverage: Enforced minimum coverage threshold".** Those suites are quarantined in `__tests__/legacy/` and excluded by `testPathIgnorePatterns` (`jest.config.js:20-23`); there is no `__tests__/integration/`; and `jest.config.js:33` says in a comment **"No coverageThreshold yet, deliberately"** | read both files | The README asserts the exact opposite of the config. `__tests__/README.md` already contradicts it |

#### 🟠 Medium

| # | Defect | Evidence |
|---|---|---|
| **D4** ✅ | **Scramble's "Show Answer" reveals the solution, and the authored hint is dead code.** `app.js` writes `Hint: ${current.hint}` then `app.js` `initializeReadingButtons()` immediately removes `visible`; the handler at `app.js` `initializeReadingButtons()` overwrites it with `Answer: ${answer}`. The `hint` field in `data.js` is never shown to a learner. `USER_GUIDE.md:269` still calls it "Show Hint" |
| **D6** | Nearly every `app.js` line reference in `TECHNICAL_DOCUMENTATION.md` is wrong, several by 500–1000 lines. Worse, `:192-199` shows a `capitalize()` helper that **does not exist anywhere in the repo** — copying that snippet yields a `ReferenceError` |
| **D7** | Safari: recording is hardcoded to `new Blob(audioChunks, { type: 'audio/webm' })` (`app.js`). Safari's `MediaRecorder` produces MP4/AAC, so the replay promised in `USER_GUIDE.md:202-206` will not play back. `TECHNICAL_DOCUMENTATION.md:455` marks Media Recording ✅ for Safari |
| **D8** | `USER_GUIDE.md:10` and `README.md:108` say "simply open `index.html` in your browser". Over `file://` the service worker cannot register (`app.js` registers root-absolute `/service-worker.js`) and the root-absolute manifest/icon paths break, so the offline behaviour promised at `USER_GUIDE.md:436` never engages. `npm start` exists and neither doc mentions it |
| **D9** | Re-clicking an already-correct quiz option re-increments `wordsLearned`/`totalWords` — there is no answered-guard on the counters (`app.js`), so "words you've mastered" inflates |
| **D10** | Dictation success marks the **reading passage** complete (`app.js`), double-counting with the comprehension check at `app.js` `showSentenceHint()` |
| **D11** | `USER_GUIDE.md:406-424` documents an achievement/milestone system ("Complete 200 vocabulary words", "Master all difficulty levels") that exists nowhere in the code |
| **D12** | `TECHNICAL_DOCUMENTATION.md:440-442` claims "Event Delegation — Minimal event listeners". There is no delegated listener anywhere; handlers are attached per element — 100+ for the word-search grid alone, recreated on every "New Puzzle" |

#### What this changes about the plan

**D1 is the most consequential.** The success metrics in `REQUIREMENTS.md §4` assumed the progress
engine already collected the data. It does not — three of four counters are inert. `FR-DATA-3`
(compute metrics locally) therefore depends on repairing the stat pipeline first, which is new
work, not wiring.

**D2 and D3 belong in Sprint 1, not a puzzles backlog.** D2 in particular is an honesty defect:
the app tells a learner they solved a puzzle they did not attempt. That is the same failure the
audit already objects to in "✓ Perfect!", and it argues for deciding `OQ-7` sooner rather than
later — there is no point repairing a crossword nobody has justified keeping.



## 4. Track A — requirements paperwork

Two documents. Each row below is one sitting. Sections are numbered as they will appear
in the finished docs.

### A. `docs/REQUIREMENTS.md` — ✅ done 2026-09-08

| # | Item | Size | Depends on |
|---|---|---|---|
| ✅ **A1** | §1 Business context · §2 Personas (P1 Ravi, P2 Lakshmi, P3 Sandeep, P4 Anusha, P5 content author) · §3 Telugu L1 interference analysis + the pluggable L1-profile shape | L | — |
| ✅ **A2** | §4 Goals & success metrics (north star: weekly speaking-minutes produced) · §5 In scope / out of scope / deferred-pending-backend | M | A1 |
| ✅ **A3** | §6 Functional requirements, grouped by the 6 strands, each with acceptance criteria and a source reference | L | A1 |
| ✅ **A4** | §7 Non-functional requirements · §8 Constraints & assumptions promoted out of prose | M | — |
| ✅ **A5** | §9 Traceability matrix (BR → FR → gap # → phase → epic) · §10 Open questions | M | A2, A3, A4 |

**Delivered:** 10 `BR`, **66 `FR`**, 17 `NFR`, 8 `CON`, 6 `AS`, 9 `OQ`. All 14 curriculum gaps
traced to ≥1 requirement.

### B. `docs/PRODUCT_BACKLOG.md` — ✅ done 2026-09-08

| # | Item | Size | Depends on |
|---|---|---|---|
| ✅ **A6** | Epics per strand + platform/data epics, each with a value statement | S | A3 |
| ✅ **A7** | User stories in persona voice, Given/When/Then acceptance criteria, MoSCoW, points | L | A6 |
| ✅ **A8** | Sprint slices mapped onto the existing 10 phases (index the plan, do not replace it) · Definition of Ready / Done · RAID log | M | A7 |

**Delivered:** 12 epics, **9 sprints, 248 points**, 6 releases, 10 risks, 6 live issues, DoR + a
10-point DoD. Two spikes gate their sprints: `US-400` (TTS minimal-pair quality) and `US-500`
(author one grammar point and review it).

### C. Wiring

| # | Item | Size | Depends on |
|---|---|---|---|
| ✅ **A9** | Added all three new docs to the index in `docs/README.md` and the "Read alongside" block in `IMPLEMENTATION_PLAN.md` | S | A5, A8 |
| ✅ **A10** | Verified: all markdown links resolve · every cited code line accurate · 14/14 gaps map to ≥1 FR · **66/66 FRs map to ≥1 story** · every persona drives ≥1 must-have · sprint arithmetic consistent | S | A9 |

**Ground rules for A1–A10:** derive, don't invent — anything not traceable to a doc section
or a code line goes in §10 Open Questions rather than being asserted. No requirement may
imply accuracy the app cannot deliver ([TEACHING_METHODOLOGY.md §3](TEACHING_METHODOLOGY.md),
[CURRICULUM.md §6](CURRICULUM.md)).

---

## 5. Blockers and decisions I need from you

| # | Item | Why it matters | My recommendation |
|---|---|---|---|
| 🔴 **B1** | **Jest is not in `devDependencies`.** Five `package.json` scripts and `jest.config.js` reference it. `npm install` was blocked by the proxy plus an expired `npm.apple.com` token (E401). | `npm test` fails on a clean checkout **today**, and CI cannot be trusted. The 112 assertions are verified correct but only under a shim, so real-Jest specifics (`it.each` interpolation, jsdom `localStorage` semantics) are still unproven. | `npm login --registry=https://npm.apple.com` then `npm i -D jest jest-environment-jsdom && npm test`. Expected green. Report any failure before Phase 1. |
| 🔴 **B2** | **Existing `srsData` is substantially noise** — the `correct: 0` bug graded most online vocabulary answers effectively at random. Migrate it, or offer a one-time reset? | Phase 2 rewrites persisted data and needs this answer first. | **Migrate plus backup.** The *set* of words seen is still signal even where the verdicts are not. Add a learner-facing "reset my review history" button rather than deciding for them. |
| ☐ **B3** | **Nothing from Phase 0 is committed.** 5 modified files + 5 new paths are sitting in the working tree, including 4 spec docs that have never been committed. | A month of work exists only on this disk. | Commit Phase 0 as its own commit before starting Phase 1, so the "zero behaviour change" claim stays verifiable in isolation. |
| ☐ **B4** | Success-metric **targets** are unset — I can propose the metrics but not what "good" is. | Blocks A2. | Pick after 2 weeks of your own daily use; the app is its own first beta tester. |
| ☐ **B5** | Client-only means **no telemetry**, so retention and speaking-minutes cannot be measured centrally. | Blocks A2. | Compute locally, surface on the dashboard, add a manual "export my stats" JSON. Do not add a third-party analytics script — it would breach the CSP posture and the privacy stance. |
| ☐ **B6** | Should the UI offer **Telugu-language** glosses and instructions? | Changes the scope of every content schema. | Not now. Keep it an open question — English-only UI with plain-English IPA glosses covers P1/P3/P4 and most of P2. |
| ☐ **B7** | Phase 10 says delete `js/core/storage.js` and `js/core/notification.js`. But `storage.js` and `validator.js` contain the backup/export/import and schema-validation code the new NFRs are about to require (§3.4). | Deleting first means rewriting the same functions in Phase 5. | **Harvest, then delete.** Extract `createBackup` / `restoreFromBackup` / `exportData` / `importData` and `validateSchema` / `validateProgress` into the modules that will use them, then remove the class shells. Retarget Phase 10 accordingly. |
| ☐ **B8** | **What are puzzles for?** Word search, crossword, scramble and matching are built and working but belong to no strand, gap or requirement (§3.6). | They cost maintenance in every refactor — Phase 3's registry, Phase 2's level rename, every stat calculation — while teaching nothing the curriculum asks for. | **Keep matching and scramble, retire word search and crossword.** Matching is a legitimate vocabulary recognition warm-up under `CURRICULUM.md:23`; scramble drills spelling cheaply. Word search and crossword teach neither speaking nor listening and are the most code per unit of value. Your call — they are your app's most "fun" surface, and motivation is not nothing. |
| ☐ **B9** | **IPA and frequency ordering for Phase 5 content.** I can write IPA for common words, but across hundreds of entries the error rate is not negligible — and a wrong IPA *actively teaches an error*, which is the exact failure the audit objects to. Frequency ordering needs a published list I do not hold verbatim. | Gates the vocabulary authoring in Phase 5 and the stress marking in Phase 7. | **Two-part.** (a) *IPA:* write it only where I am confident and **leave the field empty otherwise** — `TEACHING_METHODOLOGY.md §3` already sanctions omission over false precision, and `CURRICULUM.md:84-87` asks exactly this. (b) *Frequency:* if you want a defensible ordering, I fetch a **freely-licensed** list once at authoring time (new-GSL or a SUBTLEX-derived list) and bundle it. Avoid Oxford 3000/5000 — it is Oxford's copyrighted list and this repo is MIT. |
| ☐ **B10** | **Audio for pronunciation and accents.** The repo has **zero audio files**; every sound comes from browser TTS at a hardcoded `lang = 'en-US'` (`app.js`), with no `getVoices()` call anywhere. | `CURRICULUM.md:143-146` asks for "listen-and-compare recordings" per phoneme, and §3 Strand D asks for multiple accents. Neither is deliverable as specified. | See the full 19-function breakdown in **§6.y**. Short version: **word-level audio is well covered free** (dictionary API), **minimal-pair discrimination — the highest-value feature — is fully coverable**, and **prosody (rhythm, connected speech, intonation) is not obtainable from any free source**. Recommend building A1/A7/A8 first and descoping A10–A12 to noticing-based exercises. |
| ☐ **B11** | **Recording archive vs. the `localStorage`-only constraint.** `CURRICULUM.md` Strand E.7 wants the last N recordings kept per prompt, but audio blobs cannot live in `localStorage` (string-only, ~5–10 MB) — that needs **IndexedDB**, which the stated constraint forbids (§6.y A17). | Blocks the "hear month-one against month-three" feature the curriculum calls its strongest motivator. | **Amend the constraint to "client-side storage only; `localStorage` for state, IndexedDB for blobs."** Still no backend, still offline, still no build step — it only widens *which* browser store is allowed. Add a size cap and an eviction policy, since a recording archive grows without bound. |

---

## 6. Track B — the app itself

This section is an **index**, not a plan. The authority is
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), which holds per-phase tasks and
verification steps.

| Phase | Goal | Risk | Status |
|---|---|---|---|
| 0 | Test harness + migration spine | none | 🔶 code done, uncommitted, real-Jest unverified (B1, B3) |
| 1 | **Honesty:** word-level speech diff, delete fake IPA, fix the `correct: 0` grading bug | low | ☐ |
| 2 | CEFR rename + migration | **highest** | ☐ blocked on B2 |
| 3 | `SECTIONS` registry refactor | high | ☐ |
| 4 | SRS generalisation (`vocab:` / `gram:` / `phon:` / `coll:` keys) + migration | high | ☐ |
| 5 | Content file layout + foundation/everyday authoring | low | ☐ |
| 6 | Grammar section — the largest hole in the curriculum | low | ☐ |
| 7 | Pronunciation section — minimal pairs, stress, schwa | low | ☐ |
| 8 | Listening comprehension, rich vocabulary, generator honesty | medium | ☐ |
| 9 | Dashboard, daily goals, session sequencer | low | ☐ |
| 10 | Hygiene — dead code, service worker, CI | low | ☐ |

**If you only ever do one phase, do Phase 1.** It is about a day, changes no persisted
schema, does not depend on B1, and by the plan's own assessment delivers most of the
audit's pedagogical value. The three fixes:

- 🔴 `app.js` — options are shuffled but `correct` stays `0`, so the graded answer is whichever option landed at index 0. Affects every curated word where the dictionary API succeeds, which is the default online path. This verdict feeds `SRS.schedule()` at `app.js` `Toast()`. *(The generated-word path at `app.js` `initializeDifficultySelectors()` is correct — it uses `options.indexOf(definition)`.)*
- 🔴 `app.js` — `pronunciation: "/" + word + "/"` produces fake IPA like `/joyful/`, teaching learners that IPA is spelling in slashes.
- 🟠 `app.js` — `transcript.includes(target)` prints **"✓ Perfect!"**. Praise for an uncorrected error is how errors fossilise.

### Build-capability audit — what I can write unaided

Asked before the content phases start: can each phase be built from working knowledge, or does
it need external data fetched from the web?

**7 of 10 phases: fully unaided. The other 3 have gaps that are all *data or audio* — never
code and never linguistic knowledge.**

| Phase | Unaided? | Notes |
|---|---|---|
| 0 | ⚠️ | Code done. The **only** network dependency in the whole plan is `npm install` of Jest — see B1. |
| 1 | ✅ | Word-level diff is a standard token-alignment problem. Deleting fake IPA needs no source: the plan permits an empty field, and the online path already gets **real** IPA from the API at `app.js`. |
| 2 | ✅ | Pure code + migration. Assigning CEFR tiers to the existing 61 words is judgement I can apply defensibly; a published wordlist would make it more rigorous, not more correct. |
| 3 | ✅ | Pure refactor. |
| 4 | ✅ | SM-2 is well understood and already implemented — this generalises the key space. |
| 5 | ⚠️ | Definitions, examples, **collocations, word families, register labels** — all unaided and high-confidence. Two gaps: **IPA at scale** and **frequency ordering**. See B9. |
| 6 | ✅ | The full 24-point grammar syllabus, rules, contrast pairs, practice items and Telugu interference notes are core knowledge. **The largest curriculum gap is the one I need the least help with.** |
| 7 | ⚠️ | Phoneme inventory, mouth-position notes, minimal-pair sets, schwa, word stress — all unaided. The gap is **audio**: the repo has **zero audio files**, so TTS is the only source. See B10. |
| 8 | ⚠️ | Comprehension questions and longer listening scripts — unaided. "Multiple accents" is not deliverable: `app.js` hardcodes `lang = 'en-US'` and there is no `getVoices()` call anywhere, so available accents are whatever the learner's OS installed. See B10. |
| 9 | ✅ | Pure code. |
| 10 | ✅ | Pure code — but retarget it per B7 first. |

**The framing that matters:** CSP is `connect-src 'self' https://api.dictionaryapi.dev`, and
offline-first is a hard constraint (CON). So external data can only ever be **bundled at
authoring time** — a one-off fetch by me while writing a `data/*.js` file — never a runtime
dependency. Nothing in the plan requires the app to reach a new network endpoint.

### Can a free API close those gaps?

> ✅ **Verified 2026-09-08** against a live response for `decide`. Schema below is real, not
> recalled: `curl -s "https://api.dictionaryapi.dev/api/v2/entries/en/decide" | python3 -m json.tool`

**Short answer: it closes the *vocabulary* gaps and none of the *grammar* ones.**

#### What `api.dictionaryapi.dev` actually returns (Wiktionary-derived, word-level)

Confirmed fields, with the real values for `decide`:

| Field | Actual value | Use |
|---|---|---|
| `phonetic` | `/dɪˈsaɪd/` | **Real IPA.** Already consumed at `app.js`. Closes most of B9(a). |
| `phonetics[].audio` | `https://api.dictionaryapi.dev/media/pronunciations/en/decide-us.mp3` | ⭐ **Native-speaker MP3, and the app throws it away.** See W7. |
| `phonetics[].license` | `BY-SA 3.0`, sourced from Wikimedia Commons | Per-clip attribution, separate from the entry licence. |
| `meanings[].partOfSpeech` | `verb` | Free POS tagging — useful for word-family work. |
| `meanings[].definitions[]` | 4 senses, 2 carrying an `example` | Already used. |
| `meanings[].synonyms` | `choose`, `determine`, `make up one's mind`, `pick` | Populated at **meaning** level. |
| `definitions[].synonyms` / `.antonyms` | **all empty** | Populated inconsistently — do not depend on them. |
| `meanings[].antonyms` | **empty** | Even for a common verb. Antonym coverage is weak. |
| `license` / `sourceUrls` | `CC BY-SA 3.0` / `en.wiktionary.org` | **Attribution is required** if you bundle this data, and this repo is MIT. |

**Good news on the audio:** the MP3 is hosted on `api.dictionaryapi.dev` itself — the domain the
CSP already trusts in `connect-src`. So enabling playback is adding `media-src
https://api.dictionaryapi.dev` at `index.html:6-11`, **not** trusting a new third party.

**The limits, from the same response:** `decide` returned exactly **one** clip (`-us`), so accent
variety is not there for the asking, and many less-common words return no audio at all. Plan for
absence as the normal case.

#### ✗ Correction: synonyms are not quiz distractors

An earlier note in this ledger said the API's `synonyms`/`antonyms` would make better distractors
than today's `"Something different"` / `"Unrelated concept"`. **That was wrong**, for two reasons
the live response makes obvious:

1. The quiz options are **definitions**, not words (`app.js`). A synonym is not a wrong
   definition — and for a "what does X mean?" item, a synonym is arguably *correct*.
2. Coverage is too thin to build on: `decide` has 4 meaning-level synonyms and **zero** antonyms.

**The right fix needs no API at all:** draw distractor definitions from *other* entries in
`vocabularyData` — 61 real definitions already sitting in `data.js`, offline, free, and
guaranteed wrong for the current word. W8 is rewritten accordingly.

#### What it cannot give us — and why grammar is different

It is a **dictionary**: lexical, not pedagogical. Confirmed absent from the response: CEFR level,
frequency rank, collocations, word families (`synonyms` gives *choose / pick*, never *decision /
decisive / undecided*), register labels, and anything at sentence level.

**No free API teaches grammar, because grammar lessons are editorial content, not data.** There is
no endpoint that returns "present perfect vs past simple, with three contrast pairs and six
practice items." That must be authored — which is fine: Phase 6 is the phase already marked ✅
fully unaided.

#### Free sources that *are* worth using

> ⚠️ **Every row in this table is from knowledge, not verified.** Licences, coverage and dump
> availability all need checking before any of it is designed in. Verification commands are in
> §6.x below.

| Source | Gives us | Licence (claimed) | Verdict |
|---|---|---|---|
| **Tatoeba** | Millions of sentences, many with **native-speaker audio**, and **Telugu↔English pairs** | CC-BY 2.0 FR for sentences; **audio licences vary per contributor** — this is the risky bit | ⭐ Likely best fit. Downloadable dumps → bundle at authoring time. **Unverified:** Telugu pair volume, how much audio exists, and whether its licence permits redistribution in this app. |
| **LanguageTool** | Grammar/style *checking* with rule ids and suggestions | open source; free hosted API is rate-limited; self-hostable | Optional online extra only. It **detects**, it does not **teach**, and it needs network + sends learner text to a third party. Never a core path. **Unverified:** current free-tier limits. |
| **Wiktionary / Wikidata** | IPA, inflection tables | CC-BY-SA | Good authoring-time source; attribution required. Partly corroborated — the dictionary API is Wiktionary-derived and did return CC BY-SA 3.0. |
| **CMU Pronouncing Dictionary** | ~134k pronunciations | permissive | ARPAbet, not IPA — needs mapping — and US-only. Fallback if Wiktionary coverage disappoints. **Unverified:** exact entry count and licence text. |
| **SUBTLEX-US / new-GSL** | frequency ordering | free for research/reuse | Would close B9(b). **Unverified:** redistribution terms. |

#### 6.x Verification status — what is actually proven

Being explicit, because this ledger is meant to be trustworthy and three different kinds of claim
have been mixed together above.

**✅ Verified by direct inspection (solid — I ran these against the repo):**
every code line reference, the zero call sites for `levels.js`/`migrations.js`, the four
never-instantiated modules, all content counts and schemas, zero audio files, hardcoded
`lang = 'en-US'`, no `getVoices()` call, the randomised exercise-mode dispatch, and every
cross-doc citation.

**✅ Verified against one live API response (`decide`, 2026-09-08):**
the presence and shape of `phonetic`, `phonetics[].audio`, `license`, `sourceUrls`,
`partOfSpeech`, `definitions[].example`; empty definition-level synonyms/antonyms; and the
absence of CEFR/frequency/collocation/word-family/register fields.

**❌ Not verified — do not design on these yet:**

| # | Claim | How to check | Cost |
|---|---|---|---|
| V1 | The audio URL **actually plays** — we saw a string in JSON, nobody fetched the file | `curl -sI "https://api.dictionaryapi.dev/media/pronunciations/en/decide-us.mp3"` — want `200` and `audio/mpeg` | 1 command |
| V2 | Audio **coverage** across your 61 curated words — one sample proves nothing | Loop the 61 words, count how many return a non-empty `phonetics[].audio` | ~2 min script |
| V3 | The `media-src` CSP change actually permits playback in the app | Add the directive, play one clip, check the console for a CSP violation | 10 min |
| V4 | Tatoeba licence, Telugu↔English volume, and audio availability | Check the export page and licence terms | 20 min |
| V5 | LanguageTool free-tier limits and self-host cost | Their API docs | 15 min |
| V6 | CMU dict / SUBTLEX / new-GSL redistribution terms | Read each licence | 30 min |
| V7 | **iOS Safari `SpeechRecognition` behaviour** — the whole mobile degradation design rests on this | Open the app on a real iPhone, try the speech check | Needs a device |
| V8 | **TTS renders `/ɪ/` vs `/iː/` distinguishably** on real Android and iOS voices | Play *ship* / *sheep* on both, listen | Needs 2 devices |
| V9 | **Grammar content quality** — "Phase 6 is fully unaided" is a claim about my capability, unverifiable by inspection | Have me author **one** grammar point end-to-end (rule, 3 contrast pairs, 6 items, Telugu note) and judge it | ~1 sitting |

**The one that is unverifiable in principle:** "no free API teaches grammar." That is a negative
claim from knowledge — I did not survey the API landscape. It is a strong claim because grammar
*pedagogy* is editorial content, but treat it as a considered judgement, not a proven fact. **V9
is the cheap way to make it moot:** if a hand-authored grammar point is good, the question of
whether an API could have supplied one stops mattering.

#### 6.y Audio — the 19 functions, and how far free sources actually reach

"Audio is not verified" was too coarse. Audio is **19 distinct requirements** drawn from
`CURRICULUM.md` Strands C/D/E and the existing code, and coverage varies from *complete today* to
*not obtainable from any free source*.

**Sources referenced below:** `TTS` browser `speechSynthesis` (wired, zero assets) ·
`API` `api.dictionaryapi.dev/media/*.mp3` (words only) · `Commons` Wikimedia phoneme recordings
(CC-BY-SA) · `Tatoeba` CC-BY sentences + contributor audio · `CommonVoice` Mozilla, CC0, includes
**Indian English** · `LibriVox` public-domain long-form · `Self` record it yourself.

##### Playback / model audio

| # | Function | Source | Extent |
|---|---|---|---|
| A1 | Single-word pronunciation model (Strand A) | API, TTS fallback | ✅ **High.** Real recordings for common words. Coverage across your 61 words unverified (V2). |
| A2 | Sentence playback for repetition (D) — 30 sentences | TTS | ✅ **Works today.** Natural voices would need Tatoeba/CommonVoice. |
| A3 | Speed grading 0.75× / 1.0× / 1.25× (D) | TTS | ✅ **Full** — `rate` already exists (W1). ⚠️ But faster TTS is faster *articulation*, not the reduced, elided speech real fast English uses. It trains a different skill than intended. |
| A4 | Long-form audio — 90-second announcement, phone call (D) | TTS; LibriVox for authentic | ✅ Functional via TTS at any length. LibriVox is literary register, not conversational — poor fit. |
| A5 | Multiple accents / natural voices (D) | CommonVoice | ⚠️ **Low without bundling.** TTS accents depend on OS-installed voices. CommonVoice (CC0, Indian English included) is the only credible free route. |
| A6 | Isolated phoneme inventory — 44 phonemes (C.1) | Commons | ⚠️ **TTS cannot do this at all** — you cannot make it say a bare /ð/. Commons *does* host IPA phoneme recordings; extent unverified. |
| A7 | **Minimal-pair discrimination** — hear one, pick which (C.2) | API | ⭐ **Fully coverable.** Minimal pairs *are* pairs of single words, so per-word audio covers them exactly. See the note below. |
| A8 | Word-stress models — *PHOtograph / phoTOGrapher* (C.3) | API | ✅ **High.** Real recordings carry real stress, which TTS often gets wrong. |
| A9 | Schwa reduction examples (C.4) | API | ⚠️ The *model* is coverable (schwa examples are words). The *teaching* needs annotation on top, not just audio. |
| A10 | Sentence stress & rhythm (C.5) | Tatoeba, CommonVoice | ❌ **Weak.** Needs natural sentence audio plus stress annotation. TTS rhythm is unreliable as a model. |
| A11 | Connected speech — linking, elision, assimilation (C.6) | Self, or none | ❌ **The biggest hole.** Per-word audio cannot show *an apple → anapple*, and TTS synthesises word-by-word so it frequently **fails to exhibit the very linking you are teaching**. |
| A12 | Intonation contours (C.7) | Self, or none | ❌ **Not obtainable free.** TTS intonation is generic and often wrong for the teaching point. |
| A13 | Shadowing model — speak *along with* (E.1) | TTS, Tatoeba | ⚠️ Adequate with TTS (steady pace is what matters); natural audio is better. |
| A14 | Dictation lines (Reading, + move to Listening) | TTS | ✅ Works, and the `dictation` field already exists (W3). |
| A15 | Replay-both-slowed on a wrong discrimination answer (§2) | TTS, API | ✅ Covered — `rate` handles "slowed". |

##### Capture side

| # | Function | Status |
|---|---|---|
| A16 | Record own voice | ✅ **Built** — `MediaRecorder` + `getUserMedia` at `app.js`. |
| A17 | Recording archive — last N per prompt (E.7) | 🔴 **Blocked by a constraint conflict.** Audio blobs cannot go in `localStorage` (string-only, ~5–10 MB). Needs **IndexedDB**, which the stated "localStorage only" constraint forbids. See B11. |
| A18 | Read-aloud word-level diff | ✅ Plumbing exists; the verdict logic at `app.js` is what Phase 1 fixes. |
| A19 | Fluency metrics — WPM, fillers, pauses (E.6) | ⚠️ **Partial.** WPM is derivable from transcript + duration. Filler and pause counts need audio analysis or interim recognition timings — materially harder. |

##### The two conclusions that matter

**1. The highest-value pronunciation feature is also the most coverable.**
`CURRICULUM.md:168-170` already argues minimal-pair discrimination is *"the highest-value
pronunciation feature available offline."* It happens that discrimination drills need only
**single-word audio**, which is exactly what the dictionary API supplies for free. A7 + A8 + A1 are
the strong cases, and they are the ones the curriculum ranks highest. **Build there first.**

**2. Prosody is where free sources fail — and that is 3 of the 7 pronunciation sub-syllabi.**
A10 (rhythm), A11 (connected speech) and A12 (intonation) cannot be assembled from per-word
recordings, and TTS is actively misleading for them: it synthesises word-by-word, so it often does
*not* link or reduce, meaning a learner shadowing TTS would be practising the syllable-timed
delivery the Telugu-L1 analysis specifically targets. Options, none free-and-easy:

- **Descope** — teach rhythm and linking through *noticing* exercises on text plus discrimination,
  and drop "listen to the model" for these three. Honest and cheap.
- **Record them yourself** — but ⚠️ a Telugu-L1 speaker modelling /θ/, /v/–/w/ or English
  stress-timing risks teaching the very interference the app exists to fix. If you go this route,
  use a native-speaker recording, not your own.
- **Bundle CommonVoice/Tatoeba clips** and annotate them by hand — highest quality, most effort.

##### One more code finding

Audio requests are **not routed** by the service worker. `API_URLS` matches only
`.../api/v2/entries/en/` (`service-worker.js:47-49`), and `isStaticAsset` (`:207`) matches
`css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot` — **no `mp3`**. So MP3s fall through to the
default cache-first/`DYNAMIC_CACHE` branch. They would probably get cached, but by accident rather
than design, and with two real hazards: `<audio>` issues **Range requests**, and the Cache API
**cannot store a 206 partial response**, so media caching can fail silently; and
`cacheFirstStrategy`'s failure path returns `/offline.html` — an HTML page — in response to an
audio request. See W10.



#### 6.z The three speaking loops — what "correct" can mean, and when we advance

The design question: *do we wait 5–10 seconds and move on, or judge the pronunciation, demand a
correct attempt, and only then advance?* Neither. There are **three loops**, they have **three
different grading powers**, and only one of them can gate anything.

##### What "correct" can actually mean — three tiers

| Tier | Can we grade it? | Why |
|---|---|---|
| **Discrimination** — we played a file, learner picks which word it was | ✅ **Objectively, 100%** | We know which file we played. This is real grading, not inference. |
| **Recognition** — learner speaks, Web Speech returns a transcript | ⚠️ **Only "the recogniser understood / did not"** | It reports the recogniser's guess, never whether a human would understand. |
| **Production quality** — is the /æ/ right, is the stress right, is the schwa reduced | ❌ **Not at all, offline** | Needs acoustic scoring, i.e. a backend. `CURRICULUM.md:287-298` already rules this out. |

##### Loop 1 — Discrimination (the only loop that may gate)

1. Play **one** clip from a minimal pair — *ship* / *sheep*.
2. Learner taps which word they heard.
3. **Right:** confirm, advance. **Wrong:** replay both back to back **slowed**, name the feature
   that differs — *"/iː/ is longer and the lips are wider than /ɪ/"* — then retry.
4. Track accuracy **per phoneme pair**, not per item (`TEACHING_METHODOLOGY.md:75`).

This may gate, because the grade is true. It is also the cheapest to build (§6.y A7).

##### Loop 2 — Read-aloud with recognition (reports, never judges)

1. Show the target word or sentence, with the model audio available.
2. Learner speaks. **No stopwatch** — `SpeechRecognition` ends on its own silence detection
   (`continuous` is false, so it captures one utterance and stops).
3. Diff the transcript against the target **word by word**.
4. Report what happened, in the recogniser's voice, not the teacher's:
   *"The recogniser missed 2 of 9 words: **asked**, **texts**."* Link to the cluster drill.
5. Offer **retry**. Also offer **advance** — always.

**Never "✓ Perfect!"** Even on a full match the honest phrasing is *"the recogniser understood
every word"* (`TEACHING_METHODOLOGY.md:85-90`).

##### Loop 3 — Free production (no grading at all)

Prompt → timer → record → play back → **self-review rubric** → keep the recording.
The rubric is the four questions at `TEACHING_METHODOLOGY.md:79-83` (right syllable stressed?
unstressed vowels reduced? words linked? pitch fell at the end?). Completion means *"I did it"*,
never *"I got it right"*.

##### Why we do not gate on pronunciation — three independent reasons

1. **The judge is unreliable in both directions.** A Telugu-L1 speaker saying *apple* as
   "apple-**u**" (final-vowel epenthesis, §3 of the L1 analysis) will still be transcribed
   `apple` — a **false pass** that fossilises the exact error the app exists to fix. Meanwhile
   background noise returns no result at all — a **false fail** that tells a learner their
   pronunciation is bad when their room was noisy.
2. **A hard gate is unreachable for some learners by design.** Persona P2 practises at night with
   no privacy to speak aloud, and `TEACHING_METHODOLOGY.md:158` requires a
   skip-and-mark-done path. A blocking gate contradicts a stated accessibility rule.
3. **We already have the right mechanism, and it is not a gate — it is SRS.** "You did not get
   this, so you will see it again" is delivered by `phon:iː-ɪ` resetting to a 1-day interval, not
   by trapping the learner in the current screen. The scheduler is already built (`js/core/srs.js`).

##### Direct answers

| Question | Answer |
|---|---|
| Fixed 5–10s wait, then move on? | **No.** Recognition is event-driven — it ends on detected silence. Use timers only where the *pedagogy* wants one (the 4/3/2 fluency technique, `CURRICULUM.md:218`). |
| Auto-advance? | **Never.** It punishes the slow, thoughtful learner and contradicts self-paced practice. |
| Analyse whether it sounds correct? | **We cannot** — not offline, not honestly. We report what the recogniser heard, and hand the learner a rubric plus their own recording. |
| Require a correct attempt before the next item? | **Only in Loop 1**, where the grade is real. Never in Loops 2 or 3. |
| Same for sentences? | **Same three loops, different weights.** Loop 2 is strongest at sentence level — that is exactly where a word-by-word diff pays off. Loop 1 at sentence level works for *stress and intonation* discrimination ("which word was stressed?"), not phonemes. Shadowing (`CURRICULUM.md:210-211`) is Loop 3: pure practice, ungraded by nature. |

##### What today's code does, for contrast

`app.js` — substring match → **"✓ Perfect!"**, target word chosen at random on every
render (`app.js`), so the learner cannot retry the sound they just failed. Recognition errors
all collapse to one generic toast (`app.js`), so `no-speech` (say something) is
indistinguishable from `not-allowed` (grant mic permission). And the recording blob is a closure
variable (`app.js`), discarded on navigation — there is no comparison against the model and
no archive. All four are Phase 1 / Phase 7 work.



#### 6.aa Self-comparison (model ↔ own recording) — verdict and design rules

**Proposal:** play the model, learner mimics and records, then both are replayable so the learner
judges themselves. **Verdict: correct, and it is not a consolation prize.** Two precedents:
language labs ran on exactly this for decades, and **Anki — the most successful SRS app there
is — grades nothing automatically.** Every rating in it is self-reported. Self-assessment as a
*scheduling* signal is proven; it is only self-assessment as a *claim of mastery* that fails.

##### The one real flaw: the perception blind spot

Self-comparison fails **precisely where the learner needs it most.** L2 perception is filtered
through L1 phonology, so a Telugu-L1 speaker who cannot yet *hear* /v/ vs /w/ will play back their
own *wine* for *vine*, hear no difference, and mark themselves correct. The blind spot sits exactly
on the interference points the app is built to fix.

That is not a reason to drop the design. It is a reason to structure it.

##### Six rules that fix it

| # | Rule | Why |
|---|---|---|
| 1 | **Discrimination before production, per phoneme pair** | Never ask someone to self-judge a sound they cannot yet hear. Gate the *production* drill behind ~80% on the *discrimination* drill for that pair — using the `phon:iː-ɪ` SRS keys already planned. This is a second, independent reason discrimination comes first. |
| 2 | **Ask an articulatory question, not an auditory one** | "Did it sound right?" is unanswerable and invites *yes*. "Did your top teeth touch your bottom lip?" (for /v/) or "Did your version end in a vowel sound?" (for *apple*) asks about something the learner can **feel**, which sidesteps the perception problem entirely. One targeted question per item, tied to the known L1 error. |
| 3 | **Play A → B → A**, not A then B | Model, own, model again. The returning reference makes the contrast far more audible than a single pairwise comparison. |
| 4 | **Compare at matched speed** | A fast native clip against a slow learner attempt is hard to judge. Offer both slowed to the same rate — `speechAPI.speak(text, rate)` already supports this for TTS. |
| 5 | **Keep recordings and compare across weeks, not within the session** | This is where self-comparison is strongest and the perception problem weakest: month-1 vs month-3 differences are large enough for an untrained ear. `CURRICULUM.md:226-227` already calls this the strongest motivator. Requires B11 (IndexedDB). |
| 6 | **Self-report may schedule, but must never claim mastery** | Feed "not yet" into SRS to bring the item back sooner — legitimate, and exactly what Anki does. Never record it as a verified correct answer, or the review data becomes self-flattery. Store it flagged as self-reported. |

##### Two objective signals we *can* compute offline

Honest, cheap, no scoring claims — and they partly cover the blind spot:

- **Duration comparison.** Compare recording length against the model. For a Telugu-L1 learner this
  is a genuinely useful proxy for **final-vowel epenthesis and cluster breaking**: "your version was
  1.8s, the model was 1.1s — check whether you added extra vowel sounds." Cheap, and it catches the
  single most characteristic L1 error. ⚠️ Crude — deliberate slow speech reads the same way — so
  phrase it as a prompt to check, never as a verdict.
- **Volume normalisation** before playback. Otherwise learners hear "difference" that is only
  device-mic colouring versus a studio model clip.

Syllable counting from energy peaks (Web Audio `AnalyserNode`) is tempting for the same purpose but
is flaky enough to mislead — do not ship it as feedback.

##### The honest limit, and a free way around it

Self-comparison trains **self-monitoring**, which is a real transferable skill. It will never tell
a learner *"a stranger would understand you"* — only a human can. So the design should periodically
prompt exactly that: *"Send this recording to a friend and ask them to write down what they heard."*
Human-in-the-loop, zero backend, and more honest than any score we could invent.

##### Where the audio comes from

Model audio is **cached or bundled, never live-dependent**: the dictionary API's per-word MP3s
(cached — see W10) for single words, TTS for sentences, and bundled clips for anything prosodic.
No backend at any point.



#### The rule this implies

**Fetch once at authoring time, bundle the result. Do not add runtime API calls.**

The app already has the correct posture — `fetchWordData()` in `app.js` treats the dictionary as
enhancement-only with a local fallback, retry/backoff, and a 5s timeout. Adding more runtime
endpoints would erode exactly what makes the app usable for persona P3 (budget Android, patchy
data). One enhancement-only endpoint is the ceiling.

### Loose wins found in the §3 inventory


Not phases — small, independent, and each an hour or less. Pick any of them cold.

| # | Item | Why it is cheap |
|---|---|---|
| ☐ **W1** | Add the 0.75× / 1.0× / 1.25× listening speed control | `speechAPI.speak(text, rate)` already accepts `rate` (`app.js`) and it is never varied. This is a UI control over an existing parameter. Closes gap #14. |
| ✅ **W2** | Delete the `'♿ Accessibility: WCAG 2.1 AA Compliant'` startup log — **done 2026-09-09** | Nothing verified it (§3.5). One line, and it stops the codebase asserting something untrue. |
| ☐ **W3** | Move dictation into Listening | `readingPassages` entries **already carry a `dictation` field** — reuse, no new content needed. Part of gap #5. |
| ☐ **W4** | Correct `docs/FOLDER_STRUCTURE.md:123-124` and `docs/ERROR_HANDLING_GUIDE.md:57-58` | They document a `new StorageManager(errorHandler, validator)` architecture that the app never adopted (§3.5). |
| ☐ **W5** | Call `Migrations.migrateProgress()` from `loadProgress()` | The spine is written and tested but has **zero call sites**, so `schemaVersion` is never written (§3.3). Do this *before* Phase 2 needs it, while the blast radius is still nil. |
| ☐ **W6** | Make the Sentences exercise mode deterministic per index instead of `Math.random()` at `app.js` | A learner who fails a fill-blank and navigates back gets a different mode, so the retry required by `TEACHING_METHODOLOGY.md §2` is unreachable (§3.6). |
| ✅ **W12** | **CI/CD: test job disabled, `npm ci` removed from build/deploy** — done 2026-09-09 | The pipeline was failing at *"Install dependencies"* in **all three jobs**, because `npm ci` requires a committed `package-lock.json` and the lockfile is gitignored (`.gitignore:3`). Since `deploy` had `needs: [test, build]`, **GitHub Pages deployment was blocked too**. Test job commented out (not deleted) with restore instructions; npm dropped from build/deploy since the site is static with no runtime deps; a zero-dependency `node --check` syntax job added as a minimal stand-in. |
| ✅ **W13** | **Netlify: `Permissions-Policy` was blocking the microphone** — done 2026-09-09 | The header read `microphone=()`. An **empty allowlist denies the feature to all origins including our own**, so `SpeechRecognition` and `getUserMedia({audio:true})` would both fail on the deployed site while working on `localhost` — silently killing the whole Listening & Speaking strand. Now `microphone=(self)`. Camera and geolocation stay denied (unused). |
| ☐ **W11** | Differentiate `recognition.onerror` cases at `app.js` | Every failure currently shows one generic toast, so *"say something"* (`no-speech`) is indistinguishable from *"grant microphone permission"* (`not-allowed`) or *"you are offline"* (`network`). The learner cannot tell whether the app broke or they did (§6.z). |
| ☐ **W7** | Use `phonetics[].audio` in `parseAPIResponse()` in `app.js` instead of discarding it | ✅ Verified present: `decide` returns `.../media/pronunciations/en/decide-us.mp3`. Hosted on `api.dictionaryapi.dev`, so this needs only `media-src https://api.dictionaryapi.dev` added at `index.html:6-11` — no new third-party domain. Handle absent audio as the normal case. |
| ☐ **W8** | Build quiz distractors from **other `vocabularyData` entries'** definitions, replacing `"Something different"` / `"Unrelated concept"` / `"Opposite meaning"` (`app.js`) | 61 real definitions already sit in `data.js` — offline, free, and guaranteed wrong for the current word. *(Not from the API's synonyms: options are definitions, not words, and `decide` returns zero antonyms.)* Fix alongside the `correct: 0` bug on the same line. |
| ☐ **W9** | Add CC BY-SA 3.0 attribution for dictionary content and per-clip audio credit | ✅ Verified: the entry carries `license: CC BY-SA 3.0` + `sourceUrls: en.wiktionary.org`, and each audio clip carries its own `BY-SA 3.0` Commons licence. This repo is MIT, so the obligation needs stating explicitly. |
| ☐ **W10** | Route audio explicitly in `service-worker.js` — add `mp3\|ogg\|wav\|m4a` to `isStaticAsset` (`:207`) or the media path to `API_URLS` (`:47-49`) | Today MP3s match neither predicate and fall through to the default branch — cached by accident, not design. Two hazards: `<audio>` Range requests yield **206 responses the Cache API cannot store**, so media caching can fail silently; and the cache-first failure path serves `/offline.html` in response to an audio request (§6.y). |

---

## 7. Decisions log

Decisions already taken, so they are not re-litigated later.

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-14 | Safety net and migrations **before** any feature work | Phases 2, 4 and 8 rewrite persisted data in place. A broken render is a reload away; a broken migration eats weeks of a learner's review history. |
| 2026-08-14 | Keep legacy level aliases (`basic`/`intermediate`/`medium`) **permanently** | Four lines, and they are the only thing that rescues a learner restoring an old backup. |
| 2026-08-14 | Phase 3 introduces the `SECTIONS` registry **additively**, zero new sections | Separates a risky refactor from new feature surface. |
| 2026-09-08 | Requirements split into **two** docs, not one | `REQUIREMENTS.md` is stable (what/why); `PRODUCT_BACKLOG.md` churns (when/order). Mixing them means the stable half rots. |
| 2026-09-08 | **Telugu-first, via a pluggable L1 profile** | Hindi/Tamil/Bengali then become a data file, not a refactor. Telugu-specific items (final-vowel epenthesis *bus* → "bus-u", cluster breaking *asked* → "ask-ed") sit alongside the shared South-Asian pairs already in `CURRICULUM.md §3`. |
| 2026-09-08 | Platform floor: **mobile-first**, Android Chrome + iOS Safari, last 2 versions | The target learner has 15–20 min/day and no teacher — that is a phone user. Consequence: `SpeechRecognition` is unreliable on iOS Safari, so read-aloud diff **must** degrade to record-and-self-review, not fail. It is already feature-detected at `app.js`. |
| 2026-09-08 | Client-only is a **hard constraint**, not a current limitation | Static hosting, `localStorage` only, no build step, classic non-module scripts, CSP `default-src 'self'`, no CDN. Real pronunciation scoring and free-speech grading are therefore *deferred*, and replaced by discrimination drills + self-assessment rubrics per `CURRICULUM.md §6`. |
| 2026-09-08 | Do **not** chase accent | Retroflex /t/, /d/ substitution marks a speaker as Indian but rarely blocks understanding. Target intelligibility instead: rhythm, word stress, schwa. Explicit scope exclusion. |

---

## 8. Changelog of this ledger

| Date | Change |
|---|---|
| 2026-09-08 | Created. Recorded Phase 0 as code-complete/uncommitted, opened Track A (A1–A10), logged blockers B1–B6 and 8 decisions. |
| 2026-09-08 | Added §3 asset inventory after reading the full codebase. Found `levels.js`/`migrations.js` have zero call sites, ~1,690 lines of never-instantiated modules, and that `speechAPI` already takes a `rate` argument. Added B7 (harvest before deleting) and quick wins W1–W5. Renumbered §3–§7 → §4–§8. |
| 2026-09-08 | Added §3.6: confirmed **all existing content and exercise types are kept** — the plan is additive and `data.js` is touched exactly twice. Found the 4 sentence modes are 4 views on 1 data shape, that mode selection is randomised per render (W6), and that puzzles belong to no strand (B8). |
| 2026-09-08 | Added the build-capability audit to §6: **7 of 10 phases fully unaided**; the 3 gaps are data/audio, never code. Confirmed zero audio assets in the repo and no `getVoices()` call. Added B9 (IPA + frequency sources) and B10 (audio/accent reality). |
| 2026-09-08 | Added §6 "Can a free API close those gaps?" — dictionary API closes the vocabulary/IPA gaps and **no grammar gap** (no free API teaches grammar). Identified **Tatoeba** (CC-BY, native audio, Telugu↔English) as the best free source, and that `phonetics[].audio` is currently discarded (W7). ⚠️ API schema unverified — network blocked from this environment. |
| 2026-09-08 | **API schema verified live** against `decide`. Audio confirmed and self-hosted on `api.dictionaryapi.dev` (so `media-src` needs no new domain); licence confirmed CC BY-SA 3.0 at both entry and clip level (W9). **Corrected an earlier error:** synonyms/antonyms are *not* usable as quiz distractors — options are definitions, not words, and antonym coverage is empty even for `decide`. W8 rewritten to source distractors from other `vocabularyData` entries instead. |
| 2026-09-08 | Added §6.x **verification status**, separating what is proven from what is asserted. Marked the free-sources table as unverified in full. Logged V1–V9, including that the audio URL has never actually been fetched, that "no free API teaches grammar" is a judgement rather than a proven fact, and that grammar-authoring quality (V9) can only be tested by writing one point and reviewing it. |
| 2026-09-08 | Added §6.y: audio broken into **19 functions** with per-function source and extent. Key findings — minimal-pair discrimination (highest curriculum value) is **fully coverable free**; prosody A10–A12 is **not obtainable from any free source** and TTS is actively misleading for it; the recording archive **cannot use `localStorage`** (B11); and MP3s are unrouted in the service worker (W10). |
| 2026-09-08 | Added §6.z: the **three speaking loops** and the gating rule. Only discrimination may gate progress; recognition reports without judging; free production is ungraded. Established that **SRS replaces mastery-gating** — a failed item returns tomorrow rather than trapping the learner. Added W11 (differentiate recognition errors). |
| 2026-09-08 | Added §6.aa: **self-comparison design approved** (model ↔ own recording), with the perception blind spot named as its one real flaw and six rules that fix it — discrimination-before-production gating, articulatory rather than auditory self-check questions, A→B→A playback, matched speed, cross-week comparison, and self-report as a scheduling signal only. Identified **duration comparison** as an honest offline proxy for Telugu final-vowel epenthesis. |
| 2026-09-08 | **Track A complete (A1–A10).** Wrote `REQUIREMENTS.md` (10 BR, 66 FR, 17 NFR, 8 CON, 6 AS, 9 OQ) and `PRODUCT_BACKLOG.md` (12 epics, 9 sprints, 248 points, 6 releases, RAID). Verified 66/66 FRs have a story, 14/14 gaps trace to a requirement, all links resolve, and sprint arithmetic is consistent. Four FRs documented as intentionally story-free (DoD or already-implemented). Blockers B1–B11 became `OQ-1`–`OQ-9` plus Sprint 0 stories `US-001`–`US-004`. |
| 2026-09-08 | **Wave 1.** Fixed the quiz-grading bug and placeholder distractors (`app.js`, new `getDistractorDefinitions` helper) — US-101 and US-105 done. Corrected the documented-but-nonexistent `StorageManager` architecture in two docs. A second audit found **10 more defects** (§3.7), three of them high-severity and personally verified: the dashboard's sentence/reading/puzzle counters are permanently 0, the crossword awards the daily goal for a blank grid, and word search is unwinnable. Renumbered every `app.js:` citation (+53) after the file grew to 3160 lines. Sprint 1 grew 15 → 23 points. **Corrected an earlier ledger claim:** `error-handler.js` is not dead — it is the app's only global error capture. |
| 2026-09-09 | **Wave 2 — Sprint 1 taken from 4 to 13 of 30 points.** Fixed the fabricated IPA (US-102), the unearned WCAG log (US-107), the random exercise mode (US-108), the inert statistics pipeline (US-109 — all five types now reach `updateStatistics`, eight `state.stats.*` writes removed), the inflating quiz counters (US-111), the double-counted reading passage (US-112) and the README's false testing claims (US-113). Also closed two gaps found while verifying: `updateStatistics` had **no `default` case** (silent miscounts), and **listening never counted at all** despite the switch supporting it. Four new defects surfaced by the fixes became US-114…US-117; Sprint 1 grew 23 → 30 points. Citations renumbered again (3160 → 3213 lines). `US-110` deliberately deferred pending `OQ-7`. |
| 2026-09-09 | **CI/CD and Netlify.** Disabled the CI test job (commented out with restore steps, tracked as `US-001`) after finding the pipeline failed at *"Install dependencies"* in **all three jobs** — `npm ci` needs a committed `package-lock.json` and the lockfile is gitignored, so `deploy` was blocked too and GitHub Pages had stopped updating. Removed npm from build/deploy (static site, no runtime deps) and added a zero-dependency `node --check` syntax gate. **Found and fixed a production-only Netlify bug:** `Permissions-Policy: microphone=()` denied the microphone to all origins including self, which would have silently disabled speech recognition and voice recording on the deployed site while working on localhost. Now `microphone=(self)`. Compared against the Vite/Tailwind reference project at `~/Documents/Manual/manual-testing-app` and documented three of its patterns as **deliberately not adopted**: `base`/`publish = "dist"`, the SPA catch-all redirect, and `immutable` caching for un-hashed filenames. |
| 2026-09-09 | **Wave 3.** Landed the word-level speech diff with LCS alignment (`US-103`, ending the substring match and "✓ Perfect!"), differentiated recognition errors (`US-106`), and finally **wired `levels.js` and `migrations.js` into the app** (`US-003`, `US-004`) — independently verified: migration idempotent and byte-identical on rerun, backup equals the pristine record, and `resolveDifficulty` is identity on the three real data keys while every degraded input still yields populated content. Corrected `USER_GUIDE.md` (`US-118`). Five new defects → `US-119`–`US-123`, the notable one being that the read-aloud target is still a single random word unrelated to the sentence, so honest *feedback* has not yet made the *exercise* meaningful. **Also replaced all 83 `app.js:NNNN` citations with function-name anchors** after they rotted for the third time — and had to repair that conversion, which initially resolved stale numbers against the current file and produced confidently-wrong function names. Where the correct function was not derivable from context, the citation is now plain `app.js` rather than falsely precise. |
| 2026-09-09 | **Wave 4.** The read-aloud exercise now reads the **sentence** rather than a random unrelated vocabulary word (`US-119`, `US-104`), so the word-level diff finally does real work. Added an honestly-gated SRS lapse on read-aloud failure (`US-120`), replaced the input validator's allowlist that rejected *café* and then blamed the learner (`US-121`), stopped `migrations.js` silently downgrading a future schema version (`US-122`), fixed the fill-blank crash by deriving blanks by position (`US-114`, 81 of 3000 corrupt prompts rebuilt, 0 unrenderable), and stopped scramble counting a solve per click (`US-115`). **Caught an incomplete fix:** the US-122 change was defeated by `saveProgress()` re-stamping the version unconditionally — closed separately and verified end to end. Sprint 1 is now 38 of 53 points. Six new items → `US-124`–`US-129`, the notable one being that the fill-blank corruption has a source in `generateAlgorithmicSentence`, not just the symptom US-114 patched. |
| 2026-09-09 | **Wave 5 — work across three sprints at once.** Five agents on disjoint files; four landed, one (generator quality) died on an API stream timeout and I finished its work directly. **Sprint 1** 45/62: fixed the fill-blank corruption **at its source** (`US-124` — blank by position, 0 of 3000 swept indices now rejected, was 81), the double toast on every validation failure (`US-125`), `sanitizeInput`'s entity-encoding leaking into text display (`US-126`), and the last inline `on*=` handler in `app.js` (`US-127`). **Sprint 2** 8/19: full export / import / clear-review-history, harvested from the dead `storage.js` — including fixing two defects in that dead code (a static method called on an instance, and a key prefix that would have exported nothing). Import is validate-before-write with verified rollback across 19 rejection cases, none of which write. **Sprint 3** 4/22: daily review queue capped at 20 (read-time only, so deferral writes nothing) and self-reported outcomes that may shorten an interval but never certify. **Corrected a real pedagogy violation** the SRS agent flagged: a read-aloud miss was calling the *graded* `schedule(word, false)`, which wiped `reps 3→0`, dropped ease and logged a lapse — recording the learner as having got the word wrong on nothing but a recogniser guess. Now `selfReport(word, false)`. Six new items → `US-130`–`US-135`, including that `FR-SRS-2`'s specified interval ladder (1→3→7→16→35) **does not exist in the code** (it yields 1→3→8→22→62). |
| 2026-09-09 | **Wave 6 — Sprint 2 complete, Sprint 3 at 17/22.** Four agents, all landed. **The CEFR rename shipped with its migration** (`US-201`/`US-202`): `data.js` keys renamed, `data-level` attributes updated, and — the part that matters — **exercise ids migrated**, so completion history survived. `SCHEMA_VERSION` bumped to 2 once, with three ordered `STEPS` covering both `learningProgress` and `srsData`. **SRS keys namespaced** (`US-302`/`US-303`) with **zero drift** across all six scheduling fields, verified independently; idempotent and byte-identical on rerun, both stores backed up. New modules: `js/core/blobstore.js` (IndexedDB archive, `US-206`) and `js/core/mistakes.js` (34-category diagnosis from the Telugu interference tables, `US-305`) — both built and verified but **not yet wired**, tracked as `US-136`/`US-137`. `US-500` authored one grammar point (articles) end to end for review — see `docs/GRAMMAR_SAMPLE_REVIEW.md`. **Two cross-agent catches I fixed directly:** `PROJECTORS.gram` projected `explanation`/`example`/`difficulty`, none of which exist on a grammar point, while dropping `rule` — so every grammar review card would have rendered with no rule to show on a wrong answer, silently breaking `FR-GRM-2`; and `validator.js` still hardcoded the legacy level enum, which after the rename would have rejected every valid record. Eight new items → `US-136`–`US-143`. |
| 2026-09-09 | **Wave 7 — Sprint 3 complete.** Four agents; **two died on API errors** (`US-150` pronunciation content and `US-151` grammar points 1/2/4 — neither landed, both refiled). Two succeeded. **`US-301` — the `SECTIONS` registry shipped**, and it was worth more than the plan estimated: adding a section drops from **23 `app.js` edits to 1**, not the "~12" the plan assumed. The agent proved equivalence by executing `git show HEAD:app.js` and the working copy side by side in two stubbed contexts and diffing 100+ results — which caught one real regression it then removed (registry-derived loaders made Retake regenerate a puzzle, because puzzles now *have* a loader where the old retake map omitted them). One deliberate behaviour change, pre-authorised by the plan: the level-change reset now also clears `currentListeningIndex`, which it had silently omitted. Docs reconciled: `FR-DATA-6` amended to the pinned-baseline retention the code implements (`US-139` — the requirement was wrong, not the code), and the `FR-SRS-2` interval-ladder discrepancy documented with both ladders and a recommendation rather than quietly rewritten to match the code (`US-131`, now `OQ-10`). **One defect I fixed directly, found by the docs agent:** `window.AppErrorHandler` was permanently `undefined` — `const` at the top level of a classic script is a lexical global, not a `window` property — so every error-logging guard in `srs.js`, `blobstore.js`, `mistakes.js` and `portability.js` was false and core-module error logging was a silent no-op. Verified in a VM before and after. Eight new items → `US-144`–`US-151`. |
| 2026-09-09 | **Wave 8 — the Grammar section exists.** Four agents; **the same two content-authoring tasks died again** (`US-150` pronunciation, `US-151` grammar points 1/2/4 — second failure each, nothing landed either time). That is a pattern, not luck: both are long single-run authoring jobs and they time out. Future content work must be **one point or one phoneme pair per agent**, not three. What landed: **`US-501` — Grammar is a real section**, the largest gap in the curriculum. Registry row, markup, loader, and feedback that actually teaches — every wrong answer shows the authored reason, a contrast pair and a retry, with defensible alternatives accepted rather than marked wrong, verified by quoting real output. Scheduled as a `gram:` SRS item; a wrong answer lapses immediately so a learner who abandons the point still leaves the evidence. 181 structural checks pass. **`US-148`** fixed the remaining `PROJECTORS.gram` gaps (`review`, `cefr`) and added `auditProjection()` so a dropped authored field warns in development rather than vanishing. **`US-134`**: the IIFE global bug was only in `mistakes.js` — `srs.js` was already fixed, correcting my own premise. Worth recording: that defect **could never have been caught by a jest test**, because jsdom makes `window === global`, so it is pinned by a source check instead. **One thing I fixed directly:** the new projection audit warned about the eight fields `srs.js`'s own comment calls deliberately unprojected — firing on the documented, correct call. A warning that cries wolf stops being read, so deliberate omissions are now declared and silent, while a genuinely new unlisted field still warns. Eight new items → `US-152`–`US-158`. |
| 2026-09-10 | **Wave 9 — high agent failure rate; two content deliverables landed.** Six agents launched, one unit each (the fix for last wave's timeouts). **Four failed or were cut short**, two produced usable work. Landed: **`data/grammar/countability.js`** (T-G4, complete — 3 contrast pairs all built from *both-ways* nouns like *coffee*/*a coffee*, 6 practice items, and an adversarial pass that found a second correct answer in **all six** items and widened `accept` rather than marking learners wrong), and **`data/pronunciation/vowels-stress.js`** (T-P7/8/9 vowel pairs with feelable articulatory cues, 21 word-stress items, 15 prosody noticing items built as text/discrimination tasks rather than imitation, per `FR-PRN-8`). Both wired: self-registration into `grammarLessons`, script tags in order, precached, cache → v9. Verified 1 → 2 grammar points, safe degradation on script-order error, and the duplicate-id guard. **Deleted two PLACEHOLDER skeletons** (`be.js`, `present-simple-continuous.js`) rather than shipping files that would print "PLACEHOLDER" to a learner. **`PROJECTORS.phon` validated against real content for the first time and fixed** — the old guess had no phantom fields but dropped **16 authored ones** including `articulatoryCue`, `feelChecks` and `productionGate`, i.e. the entire teaching value. Exactly the class of defect `auditProjection()` was built to catch, and it caught it. Four new items → `US-159`–`US-162`, the notable one being that the *a work* / *a meat* error currently routes to **two different drills** depending on which lesson surfaced it. |
| 2026-09-10 | **Wave 10 — all four agents succeeded; Pronunciation exists.** **`US-401`: the minimal-pair discrimination drill is live** — the one speech task this app can grade honestly, because we know which clip we played. Per-pair SRS under `phon:` keys, production gated at 80% discrimination (`FR-PRN-6`) and measured against first answers only so the gate cannot be ground open, both words replayed **slowed** on a miss with the differing feature named rather than a verdict given, and a text-only path so a learner whose device cannot render the contrast is never stuck. **`US-150` completed**: consonant sets T-P5, T-P6 (×2), T-P10, T-P11 landed and are wired — **8 pair sets, 78 minimal pairs, every one with a feelable articulatory cue, zero projection loss.** Each set uses a *different physical channel* (fingertip on lip, tongue tip in mirror, fingers on throat, palm in front of mouth) so a learner who fails one self-check has another. The adversarial pass discarded 10 near-minimal pairs, and **all but three were vowel differences hiding behind a plausible consonant contrast** — the exact trap. **`US-159`–`US-162`** closed: the countability routing was reconciled by *widening* the existing category rather than adding a second row, on the grounds that two rows would split one habit into two half-counts pointing at the same drill; the stale projection comment now points at `auditProjection()` instead of copying a list; and the prerequisite cycle is gone with acyclicity proven. **One agent corrected the brief**: there was no suggested `gram.uncountable-counted` row anywhere in the repo — I had propagated that from a report summary. It judged the option on merits instead. Seven new items → `US-163`–`US-169`, including that `sections.js`'s own header **falsely claims** the dashboard is registry-driven when `updateDashboard` is still hardcoded per section. |
| 2026-09-10 | **Wave 11 — all four agents succeeded; the registry migration is finally complete.** **`US-163`**: `updateDashboard` and `updateStatisticsDisplay` are now registry-driven, so adding a section costs **4 edits instead of 8** and the false claim in `sections.js`'s own header is corrected. The agent proved equivalence by running HEAD's and the new functions side by side against a DOM built from `index.html`'s own id set and diffing across five states — byte-identical for every real state, with two intentional differences in degenerate ones. **One of those was a live HEAD bug**: a restored backup carrying a goal key no section owns gave **8 ticked of 7 → a 114% progress bar**, reachable through Restore-from-a-copy. That closes `US-146` as a side effect. It also found `US-152`/`US-153` were **already at HEAD** from an earlier interrupted run — my backlog was wrong — so it finished the tail and proved both hold. **`US-164`/`US-165`**: the countability routing is converged (five shapes → one finding, one count, one drill) and `ð-d` is reachable via `alsoTargets`, keeping one category rather than handing the learner two half-counts. The agent **accepted the content author's argument** against merging the pair sets rather than overriding it. **`US-169`**: theme-aware panel tokens, with contrast **computed rather than asserted** — worst case 5.93:1 light and 5.95:1 dark, all AA — and it found a third bug the fix depended on (`.exercise-card` hard-codes `#f9f9f9`, so pinning text colour could never have worked). **`US-801`**: the session sequencer exists as `js/core/session.js`, wired this turn. It plans ≥3 strands ending in production, is **count-boxed rather than time-boxed** (a step that expires mid-answer punishes the slowest learner hardest, and P2 abandons anything that feels like a failed test), resolves the BR-2/`FR-A11Y-4` tension by treating silent sub-vocal production as real production while reporting the route honestly, and **refuses to hide what it cannot do** — five explicit shortfall lines when content is absent. Seven new items → `US-170`–`US-176`, the significant one being `US-171`: due `gram:`/`phon:` records are scheduled correctly and **no screen renders them**. |
