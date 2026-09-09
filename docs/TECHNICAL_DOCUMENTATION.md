# 📘 Technical Documentation - English Learning Portal

## Architecture Overview

The English Learning Portal is built using a modular, vanilla JavaScript architecture with no external dependencies. The application follows a state-driven design pattern with persistent storage.

> **How this document cites code.** `app.js` is a single ~4,000-line classic script that
> changes shape often, so line numbers here rot within days. This document therefore cites
> **function and object names** — search for them (`function updateStatistics`,
> `const speechAPI`) rather than jumping to a line. Where a number is unavoidable it is
> stamped with the date it was checked. Snapshot verified against `app.js` (3,998 lines),
> `styles.css` (2,045 lines), and the `js/core/` modules and storage keys on **2026-09-09**.
> (`app.js` was 3,175 lines on 2026-09-08 — it is being refactored concurrently, which is
> exactly why nothing here cites a line in it.)

## The `js/core/` modules

Six waves of work have moved the app's non-UI logic out of `app.js` into small, independently
testable modules under `js/core/`. They are **classic non-module scripts** (`CON-4`: no build step,
no bundler), so there are no `import` statements — each file is an IIFE that publishes one global
and, for the Jest suite, a CommonJS export.

### Load order is load-bearing

Declared in `index.html`, before `data.js` and `app.js`:

```
error-handler.js → validator.js → storage.js → notification.js
  → levels.js → sections.js → migrations.js → srs.js → mistakes.js
  → portability.js → blobstore.js
  → theme-toggle.js → ui-enhancements.js
  → data.js → app.js
```

The dependency edges that make the order mandatory:

- `migrations.js` needs `levels.js` (`LEVEL_ALIASES` drives the CEFR rewrite).
- `srs.js` needs `migrations.js` (key normaliser + legacy-key migration).
- `portability.js` needs `migrations.js` (`SCHEMA_VERSION`, `PROGRESS_KEY`, `backupOnce`) and
  optionally `srs.js` (`reset`).
- `sections.js` must parse **before `app.js`**, and `app.js` must call
  `Sections.registerRuntime()` **after** its loader functions are declared. Section loaders are
  function declarations in `app.js`, so naming them inside the registry literal would be a
  `ReferenceError` — data stays in `sections.js`, functions stay with the functions.
- `mistakes.js` and `blobstore.js` have **no** dependencies.

Each of `migrations.js`, `srs.js` and `portability.js` re-`require()`s its own dependencies when
running under Node, so a Jest test can `require()` any one of them in isolation. `srs.js` also
degrades rather than throwing if a script reorder loses `migrations.js`: it falls back to an inline
copy of the key normaliser and simply does not migrate, because it never rewrites storage blind.

### Module reference

| Module | Global | Owns | Notes |
|---|---|---|---|
| `error-handler.js` | `errorHandler` (instance of `ErrorHandler`) | `localStorage.errorLog` | Also defines `NetworkError`, `ValidationError`, `StorageError`, `APIError`. Registers `window.onerror` and `unhandledrejection` handlers |
| `validator.js` | `Validator` (all-`static` class) | — | `sanitizeHTML`, `sanitizeInput`, `isValidEmail`, `isValidURL`, `isValidLength`, `isInRange`, `validateProgress`, `validateStorageData` |
| `storage.js` | `StorageManager` (class) | — | **Never instantiated anywhere in the app.** Effectively dead code; `portability.js` was harvested from it. See the note below |
| `notification.js` | `notificationManager`, `loadingManager` | — | Plus `ConfirmationManager`. Toasts, spinners, confirm dialogs |
| `levels.js` | `Levels` | — | The CEFR tier vocabulary. Single source of truth for difficulty ids |
| `migrations.js` | `Migrations` | `SCHEMA_VERSION`, the migration chain, `*.bak.v*` backups | Versions and rewrites `learningProgress` and `srsData` |
| `srs.js` | `SRS` | `localStorage.srsData` | The scheduler. `PROJECTORS`, `RENDERABLE`, `DAILY_REVIEW_CAP` |
| `mistakes.js` | `Mistakes` | `localStorage.mistakeLog` | Mistake log by error *type* (`FR-SRS-3`). Its own key; never touches the other two |
| `portability.js` | `Portability` | the export envelope; `srsData.bak.reset` | Export / import / reset review history (`FR-DATA-4`, `FR-DATA-5`) |
| `blobstore.js` | `BlobStore` | **IndexedDB** `englishPortalMedia` | Audio recordings (`FR-DATA-6`). The only IndexedDB user |
| `sections.js` | `Sections` | the section registry | One row per section. Loaded after `levels.js`, before `migrations.js`; `app.js` calls `Sections.registerRuntime()` once its loaders are declared |

#### `levels.js` — the CEFR level system

Replaces the original `basic` / `intermediate` / `medium` keys, which were not an ordered scale
("medium" reads as below "intermediate"). Four tiers, each with a label, CEFR band and sort order:

| id | label | CEFR | order |
|---|---|---|---|
| `foundation` | Foundation | A1–A2 | 1 |
| `everyday` | Everyday | B1 | 2 |
| `confident` | Confident | B2 | 3 |
| `fluent` | Fluent | C1 | 4 |

`LEVEL_ALIASES` maps every accepted spelling to a canonical id — `basic → foundation`,
`intermediate → everyday`, `medium → confident` — **plus an identity entry for each canonical id**.
Those identity entries are not redundant: they are what make `canonicalLevel()` and the
exercise-id migration **idempotent**, so applying a migration twice cannot corrupt data. The legacy
aliases are kept permanently; they are the only thing that rescues a learner restoring an old
backup.

`canonicalLevel(x)` returns `DEFAULT_LEVEL` (`foundation`) for anything unrecognised rather than
`undefined`, deliberately: `vocabularyData[undefined].length` throws and takes a whole section down,
whereas a wrong-but-valid level is one click from correct. `isKnownLevel(x)` is the strict test with
no silent defaulting.

#### `sections.js` — the section registry

One row per section, replacing roughly a dozen hand-written literals that were scattered through
`app.js`: two separate loader maps, index / prev-button / next-button / status-element maps, a
`switch` in `updateStatistics()`, a hardcoded `key <= '6'` in the Alt+N handler, five hardcoded
`new Set()`s, a hardcoded `/5` goal divisor. Every one of those was a silent-failure site — the
worst being `updateStatistics()`, where a missing section renders perfectly and counts nothing. The
registry's purpose is not to make that mistake noisy but to make it **unrepresentable**: one row,
and every consumer reads it, so a section exists everywhere or nowhere.

Loaders are deliberately **not** in the registry literal. They are function declarations in
`app.js`, which parses after this file, so naming them here would be a `ReferenceError`. `app.js`
calls `Sections.registerRuntime()` once they exist — data stays here, functions stay with the
functions.

`dashboard` is a row because it is a real nav target (nav button, `#dashboard` element, Alt+1) and
the Alt+N ceiling derives from `ids().length`. It has no exercises, so its learning-specific fields
are null/false and it is excluded from `exercises()`, `exerciseIds()` and `goalKeys()`. Read
`ids()` as "nav targets" and `exerciseIds()` as "learning sections".

Adding a section is three steps: add the row, add the markup to `index.html`, add the loader to the
`registerRuntime()` block. `__tests__/unit/sections.test.js` checks the markup against the registry —
including that each `#{id}` is a `.section` with a **direct-child `h2`**, because
`updateCompletionIndicator()` does `section.querySelector('h2').after(...)` and throws on null.

#### `migrations.js` — the migration chain

`SCHEMA_VERSION = 2`.

| Version | Shape |
|---|---|
| `1` | The original, pre-CEFR shape — or no `schemaVersion` field at all |
| `2` | CEFR level ids throughout `learningProgress`, **and** typed SRS keys (`vocab:<word>`) in `srsData` |

`STEPS` is an ordered array; each entry names the store it applies to, so the two keys are upgraded
independently:

```js
{ to: 2, key: PROGRESS_KEY, id: 'progress-levels-v2' }
{ to: 2, key: SRS_KEY,      id: 'srs-levels-v2'      }
{ to: 2, key: SRS_KEY,      id: 'srs-typed-keys-v2'  }
```

**One `SCHEMA_VERSION` for two keys, deliberately.** It versions the *stored-data era*, not a single
key: that is what guarantees two migrations can never both claim "version 2", the one mistake in
this module that is not recoverable. The stores stay independently upgradable because
`portability.js` can restore one without the other and `resetReviewHistory()` can clear `srsData`
alone.

Design commitments, all of them about not eating a learner's history:

- **Only `learningProgress` carries a persisted stamp.** `srsData` is stored as a bare records map
  with no version field, so `migrateSrsData()` reads the version off `learningProgress` via
  `storedProgressVersion()`. Its steps are shape-gated instead of counter-gated —
  `srs-typed-keys-v2` only touches keys lacking a `type:` prefix — so a half-migrated map (some
  keys typed, some bare) is the normal case it handles, not an edge case.
- **Idempotent.** Running any step twice is a no-op.
- **Fail closed.** `isFutureVersion()` / `warnAboutFutureVersion()`: if `learningProgress` was
  written by a *newer* release, nothing is touched at all — including `srsData`, which may be in a
  shape this build has never seen.
- **Backup before rewrite.** `backupOnce(storageKey, fromVersion)` copies the key aside as
  `<key>.bak.v<n>`, exactly once per source version. It **never overwrites**, so the first backup
  is the one that survives.
- **An envelope sniff** on `srsData`: if it ever arrives wrapped as `{ version, records }`, it is
  not what it looks like and is returned untouched.
- `LOST_KEY` (`'[object object]'`) is dropped rather than rescued. It is the victim of the old
  `_key` bug, which collapsed every non-`.word` object onto one record; there is no recoverable
  identity behind it, so the migration does not invent one.

Also exported: `srsRef(ref)`, `srsTypedKey(type, ref)`, `isTypedSrsKey(key)` and
`migrateExerciseId(id)`. `srsRef` is the **single source of truth** for key normalisation —
`srs.js` delegates to it so the migration and the runtime can never disagree about what key a word
gets, and a unit test asserts the two agree.

#### `srs.js` — the scheduler

Records live in `localStorage.srsData`, keyed `type:ref` across four types:
`vocab:happy`, `gram:present-perfect`, `phon:iː-ɪ`, `coll:make-a-decision`.

Two registries define what the scheduler will store and show, both exposed on `SRS`:

- **`PROJECTORS[type]`** — the field names copied out of a content item into `rec.data`. Bounded
  because `rec.data` goes to `localStorage`, so copying an author's whole object risks a DOM node,
  a Blob or a reference cycle ending up in storage. **A field not listed here is silently dropped
  from every review card** — the contract authors must know about, documented in
  [CONTENT_AUTHORING_GUIDE.md §7](CONTENT_AUTHORING_GUIDE.md).
- **`RENDERABLE[type]`** — "can this record be shown right now". `vocab` requires `data.quiz`
  (the vocabulary review card *is* a quiz); the other three only require a payload. An
  **unrecognised type is never renderable**, so a record written by a newer release is not poured
  into a card this build cannot draw.

Scheduling splits by evidence class, which is the module's central distinction:

- `_applyGraded()` — the app knew the answer, so this is evidence. Advances `reps`, moves `ease`
  (`±0.1` / `−0.2`, clamped to `[1.3, 2.8]`) and sets the interval. A lapse resets `reps` and
  `interval` to `0`, increments `lapses` and sets `due = now`, so the item stays in the current
  session's queue. **The interval ladder here does not match `FR-SRS-2` — see that requirement's
  discrepancy note; `OQ-10` decides it.**
- `_applySelfReport()` — a learner- or recogniser-judged outcome (`FR-SRS-5`, "may schedule but
  never certify"). Touches only `due` and `interval`, and **only downwards** (`Math.min`). `reps`,
  `ease` and `lapses` are the verified-evidence fields and are never moved, which is what makes
  `stats()` ungameable by self-report. A self-reported *success* changes nothing at all. It also
  leaves `lastReviewed` alone, recording `lastSelfReported` instead, so nothing downstream can
  mistake a self-report for a graded review.

Queue behaviour:

- `DAILY_REVIEW_CAP = 20` (`FR-SRS-4`) is a **presentation limit only**. Nothing is dropped or
  rescheduled; overflow is deferred by not being offered, and because deferring writes nothing, it
  cannot extend an interval.
- `_dueRecords()` orders oldest-due-first, tie-broken by most lapses — starvation-free, so a
  backlog drains in order.
- `getDue(null)` **interleaves types round-robin** rather than sorting globally, because a global
  oldest-first sort would fill all 20 slots with vocabulary and starve the other strands, defeating
  `CURRICULUM.md` §3 ("every session touches at least three strands").
- Four different counts, deliberately distinct: `dueCount()` (capped — the badge, a promise about
  session length), `countDue()` / `totalDueCount()` (the honest total), `deferredCount()` (waiting
  behind the cap) and `stats().due`. `dueCount() <= actionable <= due` holds by construction.

`SRS.init()` is the supported entry point. A parse-time `SRS.load()` also runs so a caller that
never calls `init()` still works, but that has a hard ordering dependency on `migrations.js`.

#### `mistakes.js` — the mistake log

`localStorage.mistakeLog`, `LOG_VERSION = 1`. **Not part of the `migrations.js` chain** — it has its
own version field and its own housekeeping.

The point is the taxonomy, not the count: "missing or wrong a / an / the — 11 times this month" is a
diagnosis; "you got 14 wrong" is not. The taxonomy is **data, not logic** (`FR-CNT-3`, `BR-10`) —
`CATEGORIES` is an array of objects and a second L1 profile adds rows via `registerCategories()`
with no change to this file or `app.js`. Rows derived from `REQUIREMENTS.md` §3 carry their table
code (`T-G1`, `T-P5`, …) so the mapping back to the requirement is checkable.

Policy constants: `WINDOW_DAYS = 30` and `TOP_N = 5` (`FR-SRS-3`, `M-7`), `HALF_LIFE_DAYS = 14`,
`RETENTION_DAYS = 120`, `MAX_ENTRIES = 1000`, `MIN_TREND_EVIDENCE = 4`. Ranking uses a hard 30-day
window **plus** recency weighting at a 14-day half-life: a learner who made eleven article errors in
the first ten days of the month and none since has fixed the thing, and a plain count would still
rank it first for another three weeks.

`EVIDENCE` is `{ GRADED, SELF, RECOGNISER }` and only `GRADED` counts as a diagnosis. Weaker classes
are reported beside it as `unverifiedCount` and never folded in — a speech-recogniser miss is not
the same claim as a graded wrong answer (`BR-3`, `FR-SRS-5`, `FR-PRN-5`).

#### `portability.js` — export, import, reset

Implements `FR-DATA-4` and `FR-DATA-5` against `CON-3` ("export is the only backup").
`FORMAT_VERSION = 1`; the envelope carries `app: 'english-learning-portal'` and
`kind: 'learner-data-export'`, which is what makes "this is not an English Portal backup" a fact
rather than a guess.

Two choices, both about not losing data:

- **Values are carried as raw strings**, exactly as `localStorage` holds them, never re-parsed JSON.
  A round trip is byte-identical, and data this build does not understand (a record from a newer
  release) survives export without being re-serialised into a shape this build invented.
- **An import validates the whole file before the first write**, snapshots the keys it will touch,
  and rolls that snapshot back if any write fails. `localStorage` has no transaction;
  validate-then-commit plus rollback is the closest honest equivalent.

`ownedKeys()` **enumerates `localStorage` and subtracts a deny-list** rather than listing keys to
include, so a key added by a future feature is exported by default. The failure mode of forgetting
to update a list becomes "the export is slightly larger than it needed to be" instead of "the
learner silently lost a month of data". Excluded: `errorLog` (diagnostics, nothing restores from
it), the pre-import snapshot key, `/^word_/` (dictionary API cache — regenerable, 24h expiry, and by
far the largest thing in storage), `/\.bak(\.|$)/` (device-local backups — importing a foreign one
would permanently block the local one from ever being taken, since `backupOnce()` never overwrites)
and `/^__/` (storage probes).

`resetReviewHistory()` clears `srsData` and nothing else, backing it up to `srsData.bak.reset` first.

#### `blobstore.js` — audio recordings in IndexedDB

The only IndexedDB user in the app. Exists because `app.js` held one recording in a closure variable
and revoked it on the next navigation, so nothing survived — and `localStorage` cannot help, being
string-only with a ~5–10MB ceiling.

Schema: database `englishPortalMedia` at `DB_VERSION = 1`, with **two** object stores —
`recordings` (one small metadata row per recording, `keyPath: 'id'`, `autoIncrement`, **no blob**)
and `audio` (the payloads under the same id) — plus one compound index `promptCreated` on
`['promptId', 'createdAt']`.

**The store split is the most important decision in the file.** `list()`, `usage()` and every
eviction decision read metadata only. If blobs lived on the same rows, drawing a list of three
recordings or totalling the archive would deserialise every audio blob in the store into memory —
on a phone, the difference between an instant list and a visible stall. IndexedDB has no aggregate
query, so "how many bytes am I holding" is necessarily a scan; scanning ~250 small rows costs
nothing, scanning 50MB of audio does. A `readwrite` transaction spans both stores, so a row and its
payload commit or abort together.

Two invariants everything else is built around:

1. **Nothing rejects.** Every public method resolves. IndexedDB can be absent (old webviews),
   blocked (Safari private browsing has thrown on `open()` outright), or hang forever (a known
   WebKit bug — hence `OPEN_TIMEOUT_MS = 8000`, treating silence as unavailable). Failures come back
   as `{ ok: false, code, message }` from writers and as empty/null from readers, so a broken store
   can never stop a speaking exercise. Callers ask `available()` *before* offering to save;
   `available({ deep: true })` additionally round-trips a 1-byte Blob under a reserved `PROBE_ID`,
   because some WebKit builds get Blob storage wrong independently of IndexedDB itself.
2. **A failed write loses nothing.** Eviction, metadata row and payload are one transaction. Space
   is refused *before* anything is deleted, so "there is no room" can never cost a learner a
   recording they already had (`NFR-10`).

Retention: `MAX_PER_PROMPT = 3` with `PIN_BASELINE = true` — one pinned baseline (the prompt's first
recording) plus the two most recent. `MAX_TOTAL_BYTES = 50MB`, `MAX_RECORDING_BYTES = 10MB`. See the
amendment under `FR-DATA-6` for why this is not a plain ring buffer. `planRetention()`,
`evictionCandidates()` and `planForSpace()` are pure functions, exposed as `_`-prefixed test seams so
the interesting logic is testable without IndexedDB at all; `_useEnvironment()` is the single seam
through which the module reaches `indexedDB`.

**Object URLs have an explicit revoke contract**, because an object URL pins its Blob in memory
until revoked. `openUrl()` hands back a `revoke()` the caller owns and must call; every live URL is
registered so `revokeAll()` can release the lot on navigation; and `MAX_LIVE_URLS = 8` revokes the
oldest as a net, on the reasoning that an eighth live URL means a caller forgot. A page-level
`pagehide` handler is the final backstop.

## Storage model

Two stores, versioned on **two completely independent axes**.

### `localStorage` — application state

| Key | Written by | Versioned? |
|---|---|---|
| `learningProgress` | `app.js` `saveProgress()` | **Yes** — carries `schemaVersion`, migrated by `Migrations.STEPS` |
| `srsData` | `srs.js` `save()` | **Yes, by proxy** — a bare records map with no stamp of its own; migrated under `learningProgress`'s version |
| `mistakeLog` | `mistakes.js` | **Own** `LOG_VERSION = 1`; outside the migration chain |
| `theme` | `js/theme-toggle.js` | No |
| `errorLog` | `error-handler.js` | No — diagnostics, excluded from export |
| `word_<lemma>` | `app.js` dictionary cache | No — regenerable, 24h expiry, excluded from export |
| `<key>.bak.v<n>` | `Migrations.backupOnce()` | Snapshot of a pre-migration value; excluded from export |
| `srsData.bak.reset` | `Portability.resetReviewHistory()` | Snapshot; excluded from export |
| `__storage_test__` | `StorageManager.isAvailable()` | Probe; excluded from export |

### IndexedDB — blobs only

`englishPortalMedia` at `DB_VERSION = 1`, stores `recordings` + `audio`. Recording metadata rows
carry their own additive shape marker `RECORD_VERSION = 1`, so a future release can recognise rows
written by this one **without** an IndexedDB version bump — adding a field is not a schema change;
adding an index is.

> **`DB_VERSION` and `SCHEMA_VERSION` are not the same thing and are never compared, synchronised or
> bumped together.** `SCHEMA_VERSION` is the shape of `localStorage` records; `DB_VERSION` is
> IndexedDB's own object-store-shape version. Conflating them would mean a `localStorage` migration
> triggering an IndexedDB upgrade that has nothing to do with it. `blobstore.js` never reads or
> writes `localStorage` at all.

This split is `CON-3` as amended: **`localStorage` for state, IndexedDB for blobs.** The practical
consequence is that a `Portability` export contains state only — recordings are **not** exported,
because a 50MB archive cannot go in a JSON file the learner is expected to email themselves.

### Known inconsistencies

Verified on 2026-09-09, and stated here rather than left for the next reader to rediscover:

1. **`data/grammar.js` is not loaded.** It has no `<script>` tag in `index.html` and no entry in
   `STATIC_ASSETS`. The grammar content exists but nothing reads it yet — and because it declares
   its content with a top-level `const`, adding the tag is necessary but not sufficient: see
   point 2 for why `window.grammarLessons` will still be `undefined`.
2. **`window.AppErrorHandler` is always `undefined`.** `srs.js`, `blobstore.js`, `mistakes.js` and
   `portability.js` all guard their error logging with
   `global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function'`, but
   `AppErrorHandler` is declared as a top-level `const` in `app.js`. A top-level `const` in a classic
   script is a **lexical** global, not a property of `window`, so every one of those guards is
   permanently false and the core modules' error logging is a silent no-op in the browser
   (`blobstore.js` falls through to `console.warn`; `srs.js` logs nothing). The same trap is
   documented in `data/grammar.js`'s header for `grammarLessons`. Fixing it means either exporting
   `window.AppErrorHandler` explicitly from `app.js` or pointing the guards at the
   `errorHandler` instance that `error-handler.js` already creates.
3. **`StorageManager` in `js/core/storage.js` is never instantiated.** It is loaded on every page
   view and used by nothing. `portability.js` documents two blocking defects it was harvested
   around: an instance call to the `static` `Validator.validateProgress()` (throws `TypeError`), and
   an `englishLearning_` key prefix that no part of the app actually writes, which would have made
   every export empty.

`service-worker.js`'s `STATIC_ASSETS` is precached with `cache.addAll()`, which is
**all-or-nothing** — one missing path rejects the whole install and the app silently loses offline
support. `__tests__/unit/assets.test.js` guards this from both directions: every local
`<script>`/`<link>` in `index.html` must appear in `STATIC_ASSETS`, and every `STATIC_ASSETS` entry
must exist on disk. Any new file under `js/core/` or `data/` must be added to both lists.

## Core Components

### 1. State Management (`const state` in [`app.js`](app.js:1))

The application uses a centralized state object that manages:

```javascript
const state = {
    currentSection: 'dashboard',
    currentDifficulty: 'foundation',
    currentWordIndex: 0,
    currentSentenceIndex: 0,
    currentPassageIndex: 0,
    currentListeningIndex: 0,
    currentPuzzle: 'wordsearch',
    vocabProgress: 0,
    stats: { /* LEGACY counters, kept only so old saves keep loading */ },
    dailyGoals: { /* daily completion flags */ },
    sentenceBuilderWords: [], sentenceAttempts: 0, sentenceHintUsed: false,
    reviewMode: false, reviewQueue: [], currentVocabWord: null,
    completedExercises: { /* one Set per exercise type */ },
    exerciseHistory: [],
    generatedExercises: { /* memoised generated content */ },
    dailyStats: { /* today's metrics, keyed by date string */ },
    overallStats: { /* lifetime metrics + averageDaily */ },
    dailyHistory: []
}
```

`state.stats` is **not** authoritative. `state.dailyStats` and `state.overallStats`, both
written by `updateStatistics()`, are the source of truth; `state.stats` exists purely for
backwards-compatible loading of older saves.

`state.currentDifficulty` holds a **canonical `js/core/levels.js` id**, not one of the original
`basic` / `intermediate` / `medium` keys. Old saves carrying a legacy key are rewritten by the
`progress-levels-v2` migration step; anything unrecognised resolves to `foundation` via
`Levels.canonicalLevel()` rather than `undefined`.

### 2. Configuration (`const CONFIG` in [`app.js`](app.js:1))

```javascript
const CONFIG = {
    dictionaryAPI: 'https://api.dictionaryapi.dev/api/v2/entries/en/',
    cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
    offlineMode: false,
    useAPIFirst: true
}
```

## Data Layer

### Data Structure ([`data.js`](data.js:1))

All learning content is stored in structured JavaScript objects:

#### Vocabulary Data
```javascript
vocabularyData = {
    basic: [{ word, pronunciation, definition, example, quiz }],
    intermediate: [...],
    medium: [...]
}
```

#### Sentence Exercises
```javascript
sentenceExercises = {
    basic: [{ words, correct, fillBlank }],
    intermediate: [...],
    medium: [...]
}
```

#### Reading Passages
```javascript
readingPassages = {
    basic: [{ title, text, questions, dictation }],
    intermediate: [...],
    medium: [...]
}
```

#### Puzzle Data
```javascript
puzzleData = {
    wordSearch: { basic, intermediate, medium },
    scramble: { basic, intermediate, medium },
    matching: { basic, intermediate, medium }
}
```

## Key Features Implementation

### 1. API Integration with Offline Fallback

#### Dictionary API (`fetchWordData()` in [`app.js`](app.js:1))

```javascript
async function fetchWordData(word) {
    // 1. Check the 24h localStorage cache first
    const cached = cache.get(`word_${word.toLowerCase()}`);
    if (cached) return cached;

    // 2. Try the API, with retry + exponential backoff and a 5s timeout
    if (CONFIG.useAPIFirst && navigator.onLine) {
        try {
            const wordData = await AppErrorHandler.retryWithBackoff(
                async () => {
                    const response = await fetch(
                        `${CONFIG.dictionaryAPI}${word.toLowerCase()}`,
                        { signal: AbortSignal.timeout(5000) }
                    );
                    if (!response.ok) throw new Error(`API returned ${response.status}`);
                    return parseAPIResponse((await response.json())[0]);
                },
                3, 1000, `fetchWordData("${word}")`
            );
            cache.set(`word_${word.toLowerCase()}`, wordData);
            return wordData;
        } catch (error) {
            // Logged, but deliberately no toast: the fallback is not a user-facing failure
            AppErrorHandler.handleError(error, `word "${word}"`,
                { showToast: false, fallback: null });
        }
    }

    // 3. Fallback to local data from data.js
    return getLocalWordData(word);
}
```

`parseAPIResponse()` builds the quiz distractors with `getDistractorDefinitions()`, which
pulls real definitions from *other* vocabulary entries so the quiz tests meaning rather
than absurdity-spotting.

### 2. Web Speech API Integration

#### Text-to-Speech (`const speechAPI` in [`app.js`](app.js:1))

`speechAPI` holds its own playback state (`currentUtterance`, `isPaused`, `currentText`,
`currentRate`) so that pause/resume/replay work across renders, and pushes every
transition into `updateReadingControls()` to keep the button row in sync.

```javascript
const speechAPI = {
    currentUtterance: null,
    isPaused: false,
    currentText: '',
    currentRate: 1,

    speak: (text, rate = 1) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();

        speechAPI.currentText = text;
        speechAPI.currentRate = rate;
        speechAPI.isPaused = false;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.lang = 'en-US';
        utterance.onstart = () => updateReadingControls('playing');
        utterance.onend = () => {
            speechAPI.currentUtterance = null;
            updateReadingControls('stopped');
        };

        speechAPI.currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    },

    pause: () => { /* guards on speechSynthesis.speaking, sets isPaused */ },
    resume: () => { /* guards on isPaused */ },
    stop: () => { /* cancel + clear currentUtterance */ },
    replay: () => speechAPI.currentText && speechAPI.speak(
        speechAPI.currentText, speechAPI.currentRate)
}
```

#### Speech Recognition (`speechAPI.startRecognition()` in [`app.js`](app.js:1))

```javascript
startRecognition: (callback) => {
    const SpeechRecognition = window.SpeechRecognition ||
                              window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        Toast.error('Speech recognition not supported in this browser');
        return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
        try {
            // Transcripts are untrusted input: validated and sanitised before use
            callback(AppErrorHandler.validateInput(e.results[0][0].transcript, {
                required: true, maxLength: 500,
                pattern: /^[a-zA-Z0-9\s.,!?'\-]+$/
            }));
        } catch (error) {
            AppErrorHandler.handleError(error, 'speech recognition result');
            Toast.error('Invalid speech input detected');
        }
    };
    recognition.onerror = (e) => { /* logs, then one generic toast */ };
    recognition.start();
    return recognition;
}
```

> **Known limitation:** `onerror` collapses every failure into a single generic toast, so
> `no-speech` is indistinguishable from `not-allowed` or `network`. Differentiating these
> is tracked in `PROGRESS.md`.

### 3. Progress Tracking System

#### Exercise Completion Tracking (`getExerciseId()` / `markExerciseComplete()` / `isExerciseCompleted()` in [`app.js`](app.js:1))

```javascript
// Generate unique ID for each exercise
function getExerciseId(type, index, difficulty) {
    return `${type}_${difficulty}_${index}`;
}

// Mark as complete
function markExerciseComplete(type, index) {
    const id = getExerciseId(type, index, state.currentDifficulty);
    state.completedExercises[type].add(id);
    state.exerciseHistory.push({
        type,
        index,
        difficulty: state.currentDifficulty,
        timestamp: Date.now(),
        id
    });
    saveProgress();
    updateNavigationButtons(type);
}

// Check completion status
function isExerciseCompleted(type, index) {
    const id = getExerciseId(type, index, state.currentDifficulty);
    return state.completedExercises[type].has(id);
}

// Undo completion so the exercise can be retaken
function retakeExercise(type, index) {
    state.completedExercises[type].delete(
        getExerciseId(type, index, state.currentDifficulty));
    saveProgress();
    updateNavigationButtons(type);
}
```

#### Statistics Calculation (`calculateAverages()` / `updateStatistics()` in [`app.js`](app.js:1))

```javascript
function calculateAverages() {
    const totalDays = state.dailyHistory.length + 1; // +1 for today
    state.overallStats.totalDays = totalDays;

    if (totalDays > 0) {
        state.overallStats.averageDaily.words =
            Math.round(state.overallStats.totalWords / totalDays);
        // ... same for sentences, reading, listening, puzzles
    }
}

// `type` is one of: 'vocabulary' | 'sentences' | 'reading' | 'listening' | 'puzzles'.
// The daily and overall keys do not follow a single naming pattern, so this is an
// explicit switch rather than computed property access.
function updateStatistics(type) {
    switch (type) {
        case 'vocabulary':
            state.dailyStats.wordsLearned++;
            state.overallStats.totalWords++;
            break;
        case 'sentences':
            state.dailyStats.sentencesCompleted++;
            state.overallStats.totalSentences++;
            break;
        case 'reading':
            state.dailyStats.readingCompleted++;
            state.overallStats.totalReading++;
            break;
        case 'listening':
            state.dailyStats.listeningCompleted++;
            state.overallStats.totalListening++;
            break;
        case 'puzzles':
            state.dailyStats.puzzlesSolved++;
            state.overallStats.totalPuzzles++;
            break;
    }

    calculateAverages();
    saveProgress();
}
```

An unrecognised `type` falls through the switch silently — no counter moves and no error is
raised — so new exercise types must add a case here explicitly.

### 4. Persistent Storage (`saveProgress()` / `loadProgress()` in [`app.js`](app.js:1))

#### Save Progress
```javascript
function saveProgress() {
    try {
        const toSave = {
            ...state,
            completedExercises: {
                vocabulary: Array.from(state.completedExercises.vocabulary),
                sentences: Array.from(state.completedExercises.sentences),
                // ... one entry per type: Sets are not JSON-serialisable
            }
        };
        localStorage.setItem('learningProgress', JSON.stringify(toSave));
    } catch (e) {
        AppErrorHandler.logError(e, 'save progress');
    }
}
```

#### Load Progress
```javascript
function loadProgress() {
    try {
        const saved = localStorage.getItem('learningProgress');
        if (saved) {
            const loaded = JSON.parse(saved);

            // Restore scalar state and the legacy counters
            Object.assign(state.stats, loaded.stats || {});
            Object.assign(state.dailyGoals, loaded.dailyGoals || {});

            // Convert Arrays back to Sets
            if (loaded.completedExercises) {
                state.completedExercises.vocabulary =
                    new Set(loaded.completedExercises.vocabulary || []);
                // ... one per type
            }

            // Same day? merge. New day? archive yesterday, reset, update the streak
            if (loaded.dailyStats) {
                const today = new Date().toDateString();
                if (loaded.dailyStats.date === today) {
                    Object.assign(state.dailyStats, loaded.dailyStats);
                } else {
                    state.dailyHistory.push(loaded.dailyStats);
                    resetDailyStats();
                    updateStreak(loaded.dailyStats.date);
                }
            }

            if (loaded.overallStats) Object.assign(state.overallStats, loaded.overallStats);
            if (loaded.dailyHistory) state.dailyHistory = loaded.dailyHistory;

            calculateAverages();
            updateDashboard();
        }
    } catch (e) {
        AppErrorHandler.logError(e, 'load progress');
    }
}
```

### 5. Hint System (`showHintButton()` / `showSentenceHint()` in [`app.js`](app.js:1))

The hint system provides contextual help after multiple failed attempts:

```javascript
// Show hint button after 3 attempts (in the sentence "Check Answer" handler)
if (state.sentenceAttempts >= 3 && !state.sentenceHintUsed) {
    showHintButton();
}

function showSentenceHint() {
    if (!state.currentExercise) return;
    const hintDisplay = document.getElementById('hintDisplay');
    if (!hintDisplay) return;

    const words = state.currentExercise.words
        || state.currentExercise.correct.split(' ');

    // Fill-in-the-blank: never hint a word the learner can already see
    let availableWords = [...words];
    const fillBlankContainer = document.getElementById('fillBlankExerciseContainer');
    if (fillBlankContainer && fillBlankContainer.style.display === 'block') {
        const visibleText = document.getElementById('fillBlankInstruction')
            .textContent.toLowerCase();
        availableWords = words.filter(w =>
            !visibleText.includes(w.toLowerCase()) || w === '___');
    }
    if (availableWords.length === 0) availableWords = words;

    const hintWord = availableWords[
        Math.floor(Math.random() * availableWords.length)];
    const position = words.indexOf(hintWord) + 1;

    hintDisplay.innerHTML = `
        <div class="hint-content">
            <span class="hint-icon">💡</span>
            <strong>Hint:</strong> Word #${position} is
            "<span class="hint-word">${hintWord}</span>"
        </div>
    `;
    hintDisplay.classList.add('visible');
}
```

### 6. Sentence Exercise Types

Each type has its own loader, selected by `loadSentenceExercise()`:

#### Drag and Drop (`loadDragDropSentence()`, `initializeSentenceBuilderDragDrop()`)
- Words shuffled randomly
- Drag or click to build sentence
- Visual feedback with animations

#### Fill in the Blanks (`loadFillBlankExercise()`)
- Dynamic input generation
- Answer validation
- Visual feedback on correctness

#### Multiple Choice (`loadMultipleChoiceSentence()`)
- Generates wrong options algorithmically
- Radio button selection
- Instant feedback

#### Word Reordering (`loadReorderSentence()`, `selectWordInOrder()`)
- Click words in sequence
- Visual selection tracking
- Order validation

### 7. Audio Recording (`initializeListeningButtons()` in [`app.js`](app.js:1))

Recorder state (`mediaRecorder`, `recordedAudioBlob`, `recordedAudioURL`) is scoped inside
`initializeListeningButtons()`; the handlers are assigned as `onclick` properties on
`#startRecording`, `#stopRecording` and `#replayRecording`.

```javascript
// Start recording
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
mediaRecorder = new MediaRecorder(stream);   // no mimeType requested
const audioChunks = [];

mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) audioChunks.push(event.data);
};

mediaRecorder.onstop = () => {
    // NOTE: 'audio/webm' is hardcoded, not read from mediaRecorder.mimeType
    recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    if (recordedAudioURL) URL.revokeObjectURL(recordedAudioURL);
    recordedAudioURL = URL.createObjectURL(recordedAudioBlob);
    // Show replay button, mark the daily listening goal, save
};

mediaRecorder.start();

// Stop: also releases the microphone
if (mediaRecorder?.state === 'recording') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
}

// Replay recording
const audio = new Audio(recordedAudioURL);
audio.play();
```

> **Known limitation:** the Blob type is hardcoded to `audio/webm` regardless of what the
> browser actually produced. Safari's `MediaRecorder` emits MP4/AAC, so on Safari the Blob
> is mislabelled and replay is unreliable. See *Browser Compatibility* below. The fix is to
> read `mediaRecorder.mimeType` instead of hardcoding.

### 8. Puzzle Generation

#### Word Search (`generateWordSearch()`)
- Dynamic grid generation, sized from `puzzleData.wordSearch[difficulty].gridSize`
- Word placement in three directions only — horizontal, vertical, down-diagonal
  (`[[0,1],[1,0],[1,1]]`), with up to 100 placement attempts per word
- A word that cannot be placed in 100 attempts is silently dropped from the grid but
  stays in the word list
- Remaining cells filled with random A–Z letters
- Click-to-select: selection is compared against each word forwards and reversed

#### Word Scramble (`loadWordScramble()`, `initializeScrambleButtons()`)
- Random letter shuffling
- Hint system
- Answer validation

#### Word Matching (`loadWordMatching()`, `generateMatchingPairs()`, `selectMatch()`)
- Pairs are generated algorithmically ~98% of the time; the curated
  `puzzleData.matching` set is used on a ~2% random draw
- Pair selection logic and match validation
- Visual feedback

## Event Handling

### Navigation System (`initializeNavigation()` / `switchSection()` in [`app.js`](app.js:1))

```javascript
function switchSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => 
        s.classList.remove('active'));
    
    // Show selected section
    document.getElementById(sectionName).classList.add('active');
    
    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(b => 
        b.classList.remove('active'));
    document.querySelector(`[data-section="${sectionName}"]`)
        .classList.add('active');
    
    // Load section content
    const loaders = {
        vocabulary: loadVocabularyWord,
        sentences: loadSentenceExercise,
        reading: loadReadingPassage,
        listening: loadListeningExercise,
        puzzles: () => loadPuzzle(state.currentPuzzle)
    };
    loaders[sectionName]?.();
}
```

### Difficulty Selection ([`app.js`](app.js:572-589))

```javascript
function initializeDifficultySelectors() {
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const level = btn.dataset.level;
            
            // Update UI
            btn.parentElement.querySelectorAll('.diff-btn')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update state and reset indices
            state.currentDifficulty = level;
            state.currentWordIndex = 0;
            state.currentSentenceIndex = 0;
            
            // Reload content
            const section = btn.closest('.section').id;
            if (section === 'vocabulary') loadVocabularyWord();
            if (section === 'sentences') loadSentenceExercise();
            if (section === 'reading') loadReadingPassage();
        });
    });
}
```

## Styling Architecture ([`styles.css`](styles.css:1))

### CSS Organization
1. **Reset & Base Styles** (lines 1-12)
2. **Layout Components** (lines 14-111)
3. **Section-Specific Styles** (lines 113-803)
4. **Interactive Elements** (lines 804-1191)
5. **Responsive Design** (lines 1192-1237)

### Key CSS Features
- CSS Grid for responsive layouts
- Flexbox for component alignment
- CSS animations for smooth transitions
- Custom properties for theming
- Media queries for mobile responsiveness

### Color Scheme
```css
/* Primary Gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Success */
#4CAF50

/* Error */
#f44336

/* Info */
#2196F3
```

## Performance Optimizations

1. **Caching Strategy**
   - API responses cached for 24 hours
   - LocalStorage for persistent data
   - Automatic cache invalidation

2. **Lazy Loading**
   - Content loaded only when section is active
   - Exercises generated on-demand

3. **Event Delegation**
   - Minimal event listeners
   - Efficient DOM manipulation

4. **Auto-Save**
   - Progress saved every 30 seconds
   - Prevents data loss

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Core App | ✅ | ✅ | ✅ | ✅ |
| Speech Synthesis | ✅ | ✅ | ✅ | ✅ |
| Speech Recognition | ✅ | ❌ | ⚠️ | ✅ |
| Media Recording | ✅ | ✅ | ✅ | ✅ |
| LocalStorage | ✅ | ✅ | ✅ | ✅ |

## Error Handling

### API Failures
```javascript
try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
        // Process response
    }
} catch (error) {
    console.warn('API failed, using offline data');
    return getLocalWordData(word);
}
```

### Storage Failures
```javascript
try {
    localStorage.setItem(key, value);
} catch (e) {
    console.warn('Storage failed:', e);
    // Continue without saving
}
```

### Media Access Failures
```javascript
try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Use stream
} catch (e) {
    alert('Microphone access denied');
}
```

## Testing Recommendations

### Unit Testing
- Test state management functions
- Validate exercise generation
- Check statistics calculations

### Integration Testing
- Test API integration with mock responses
- Verify localStorage operations
- Test speech API integration

### User Testing
- Cross-browser compatibility
- Mobile responsiveness
- Accessibility features

## Future Enhancements

1. **Backend Integration**
   - User authentication
   - Cloud progress sync
   - Leaderboards

2. **Advanced Features**
   - AI-powered feedback
   - Adaptive difficulty
   - Social learning features

3. **Content Expansion**
   - More exercise types
   - Video lessons
   - Interactive dialogues

4. **Analytics**
   - Detailed learning analytics
   - Performance insights
   - Personalized recommendations

## Development Guidelines

### Adding New Features

1. **Update State**: Add necessary state properties
2. **Create UI**: Add HTML structure in [`index.html`](index.html:1)
3. **Add Styles**: Update [`styles.css`](styles.css:1)
4. **Implement Logic**: Add functions in [`app.js`](app.js:1)
5. **Add Data**: Update [`data.js`](data.js:1) if needed
6. **Test**: Verify across browsers

### Code Style

- Use descriptive variable names
- Add comments for complex logic
- Follow existing patterns
- Keep functions focused and small
- Use ES6+ features appropriately

### Debugging

```javascript
// Enable verbose logging
console.log('🎓 English Learning Portal Ready!');
console.log('📡 API: Free Dictionary + Web Speech');
console.log('💾 Offline Fallback: Enabled');
```

## Security Considerations

1. **Input Validation**: All user inputs are sanitized
2. **XSS Prevention**: No innerHTML with user data
3. **API Rate Limiting**: Cached responses prevent abuse
4. **Local Storage**: No sensitive data stored

## Deployment

### Static Hosting
The application can be deployed to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- AWS S3
- Firebase Hosting

### Requirements
- HTTPS (required for speech recognition)
- No server-side processing needed
- No build step required

---

**For questions or contributions, refer to the main [`README.md`](README.md:1) in this docs folder**