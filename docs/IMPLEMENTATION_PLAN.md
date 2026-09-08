# 🗺️ Implementation Plan — Phased

The build plan for closing the 14 pedagogical gaps in [CURRICULUM.md §5](CURRICULUM.md).
Ten phases, each **independently shippable**, each leaving the app working.

Read alongside:
[PROGRESS.md](PROGRESS.md) (current state, blockers, decisions) ·
[REQUIREMENTS.md](REQUIREMENTS.md) (what must be true and why) ·
[PRODUCT_BACKLOG.md](PRODUCT_BACKLOG.md) (stories and acceptance criteria per phase) ·
[CURRICULUM.md](CURRICULUM.md) (what we teach) ·
[TEACHING_METHODOLOGY.md](TEACHING_METHODOLOGY.md) (how we teach) ·
[CONTENT_AUTHORING_GUIDE.md](CONTENT_AUTHORING_GUIDE.md) (how to add content)

---

## Why this order

Risk decreases as the phases progress:

1. **Safety net and versioning first** (Phase 0). Phases 2, 4 and 8 rewrite persisted user data
   in place. Those are the only places in this app where a bug is *unrecoverable* — a broken
   render is a reload away, a broken migration eats weeks of a learner's review history.
2. **Highest teaching value next** (Phase 1). Three dishonest behaviours die in about a day of
   work, with no schema changes. **If the appetite shrinks later, Phase 1 alone delivers most of
   the audit's value.**
3. **The two risky migrations** (Phases 2 and 4), each with a backup and a proven-idempotent path.
4. **Everything additive** (Phases 5–9), where a mistake is visible and cheap.
5. **Hygiene last** (Phase 10), once the code that depends on it has settled.

Constraints preserved throughout: static, client-only, `localStorage` only, no build step,
classic (non-module) scripts, CSP `script-src 'self'` (no CDN).

## Progress

| Phase | Goal | Risk | Status |
|---|---|---|---|
| 0 | Test harness + migration spine | none | ✅ done (except `npm install`, see below) |
| 1 | Honesty: speech diff, fake IPA, quiz-index bug | low | ☐ |
| 2 | CEFR rename + migration | **highest** | ☐ |
| 3 | `SECTIONS` registry refactor | high | ☐ |
| 4 | SRS generalization + migration | high | ☐ |
| 5 | Content file layout + foundation/everyday authoring | low | ☐ |
| 6 | Grammar section | low | ☐ |
| 7 | Pronunciation section | low | ☐ |
| 8 | Listening comprehension, rich vocab, generator honesty | medium | ☐ |
| 9 | Dashboard, daily goals, session sequencer | low | ☐ |
| 10 | Hygiene: dead code, service worker, CI | low | ☐ |

---

## Current status — as of 2026-08-14

### ✅ Phase 0 complete (code), pending one install

| Item | State |
|---|---|
| `js/core/levels.js` — 4 CEFR tiers, alias map, `canonicalLevel` | done |
| `js/core/migrations.js` — `SCHEMA_VERSION`, upgrade chain, `migrateExerciseId`, `backupOnce` | done |
| `jest.config.js` + npm scripts (`test`, `test:unit`, `test:integration`, `test:watch`, `test:verbose`) | done |
| `__tests__/unit/migrations.test.js` (24 assertions) | done, passing |
| `__tests__/unit/srs.test.js` (23 assertions) | done, passing |
| `__tests__/unit/assets.test.js` (65 assertions) | done, passing |
| 5 orphaned suites quarantined to `__tests__/legacy/` | done |
| `.gitignore` — `__tests__/` and `docs/` un-ignored | done |
| `service-worker.js` — `STATIC_ASSETS` 19 → 23, `STATIC_CACHE` v3 → v4 | done |
| `index.html` — loads `levels.js` + `migrations.js` in dependency order | done |
| `__tests__/README.md` — rewritten to state what is *not* covered | done |
| **`npm install` of Jest** | **blocked — see below** |

**Total: 112/112 assertions passing.** Verified by running the suites through a throwaway
Jest-compatible shim, then mutation-tested (broke a level alias, dropped a precache entry, changed
an SRS interval) to prove they are not vacuously passing — all three mutations were caught.

`js/core/srs.js` is byte-identical to the committed version. Phase 0 changed **no existing app
behaviour**, by design.

### ⏳ Action required from you

**1. Install Jest and run the real test suite.** Blocked on environment, not code: the local proxy
blocks `registry.npmjs.org` outright and the `npm.apple.com` token in `~/.npmrc` is expired (E401).

```bash
npm login --registry=https://npm.apple.com
npm i -D jest jest-environment-jsdom
npm test
```

Expected: green. The assertions are verified correct, but the shim used to check them is not Jest,
so real-Jest specifics (`it.each` name interpolation, jsdom `localStorage` semantics) could still
differ. Report any failure before Phase 1 starts.

**2. Review and commit.** Nothing has been committed. Working tree:

```
modified:   .github/workflows/ci-cd.yml   # docs + jest.config.js added to exclude_assets
modified:   .gitignore                    # __tests__/ and docs/ un-ignored
modified:   index.html                    # + levels.js, migrations.js
modified:   package.json                  # real test scripts, jest devDeps
modified:   service-worker.js             # STATIC_ASSETS completed, cache bumped
new:        __tests__/                    # 3 live suites + legacy/ + setup.js + README
new:        docs/                         # 4 specification docs (previously gitignored)
new:        jest.config.js
new:        js/core/levels.js
new:        js/core/migrations.js
```

Note `docs/` appears as new because it was gitignored until now — those four documents have never
been committed.

**3. One open decision, needed before Phase 2.** Existing `srsData` review history is substantially
noise, because the `correct: 0` bug graded most online vocabulary answers randomly. Options:
migrate it (default — the *set* of words seen is still signal), or offer learners a one-time
"reset my review history" button. Phase 2 assumes migrate-plus-backup unless you say otherwise.

### ▶️ Next up

**Phase 1 — honesty quick wins.** Roughly a day, no schema changes, and it delivers most of the
audit's pedagogical value: the word-level speech diff, deleting the fake IPA, and fixing the
`correct: 0` grading bug. Nothing in Phase 1 depends on the Jest install, so it can start
immediately if you prefer.

---

## Three live bugs this plan fixes

Found while planning. Two of them corrupt data, so they are called out separately from the
teaching gaps.

### 🔴 `parseAPIResponse` grades the wrong answer — `app.js:980-981`

```js
options: [definition.definition, "Something different", "Unrelated concept", "Opposite meaning"]
             .sort(() => Math.random() - 0.5),
correct: 0
```

The options are shuffled and `correct` stays `0`. For **every curated word where the dictionary
API succeeds** — the default online path (`app.js:1388`) — the graded answer is whichever option
happened to land at index 0, wrong about 75% of the time. That verdict is what feeds
`SRS.schedule(state.currentVocabWord, isCorrect)` at `app.js:1444`, so **existing review data is
substantially noise**. Fixed in Phase 1b; it is why Phase 2 keeps a backup and offers a review-history
reset.

### 🔴 The word generator invents IPA — `app.js:1349`

`pronunciation: "/" + word + "/"` produces `/joyful/`. Learners conclude IPA is just spelling in
slashes. Fixed in Phase 1b.

### 🟠 Speech feedback is a substring match — `app.js:2482`

`transcript.toLowerCase().includes(target.toLowerCase())` → **"✓ Perfect!"**. Praise for an
uncorrected error is how errors fossilise. Fixed in Phase 1a/1c.

---

## Phase 0 — Safety net and versioning spine

**Goal:** a working `npm test` and the migration machinery, with **zero** behaviour change.

> **Status: complete, apart from `npm install`.** All files are written and all 112 assertions
> pass. The dependency install is blocked on the environment, not the code: the local proxy blocks
> `registry.npmjs.org` outright and the `npm.apple.com` token is expired. Run
> `npm login --registry=https://npm.apple.com`, then
> `npm i -D jest jest-environment-jsdom && npm test`.
>
> The suites were verified by running them through a throwaway Jest-compatible shim, and
> mutation-tested (break an alias, drop a precache entry, change an SRS interval) to confirm they
> are not vacuously passing. Actual counts: 24 migration, 23 SRS, 65 asset assertions.

Jest is one devDependency, never runs in the browser, and so preserves the no-build-step
constraint completely.

- [x] `npm i -D jest jest-environment-jsdom`; add scripts `test:unit`, `test:integration`, `test`
      — the names `.github/workflows/ci-cd.yml` already calls. *(scripts written; install pending
      re-auth. `test:integration` matches no files yet, so it carries `--passWithNoTests`.)*
- [x] Remove `__tests__/` **and** `docs/` from `.gitignore` (`:9` and `:12`). `__tests__/` being
      ignored means CI could never have run those tests even with Jest installed; `docs/` being
      ignored means these specification documents aren't in the repo at all.
      *(Also added `docs` and `jest.config.js` to the gh-pages `exclude_assets`, preserving the
      original intent of keeping docs off the deployed site.)*
- [x] Move the 4 orphaned suites to `__tests__/legacy/`, added to `testPathIgnorePatterns`.
      **Quarantine — don't fix, don't delete.** They encode ~155 assertions of intended behaviour
      (useful as documentation) but import `Toast`/`LoadingIndicator`/`KeyboardNavigation` as
      modules that don't export; making those importable means modularising `app.js`, a different
      project. `__tests__/unit/keyboardNavigation.test.js:108,125,142` duplicates the very maps
      Phase 3 deletes, so it needs rewriting regardless.
      *(Five files moved, not four: the old `setup.js` went too — it required
      `@testing-library/jest-dom`, which is not a dependency. A new minimal `setup.js` replaces it.)*
- [x] State plainly in `__tests__/README.md` what is **not** covered: `app.js` is one 3107-line
      classic script with top-level side effects and no exports. No DOM tests for it.

**Four pure-logic suites** — the three data-corruption surfaces plus an asset guard:

- [x] `migrations.test.js` — `canonicalLevel` idempotency, `migrateExerciseId` edge cases
      (multi-underscore type, unknown token, non-string), run-twice-equals-run-once, version
      guard, fresh install.
- [x] `srs.test.js` — `js/core/srs.js` already has `module.exports` (`:172-174`), so it is
      importable today; jsdom supplies `localStorage`. *(Also pins the three couplings Phase 4
      changes, each marked `KNOWN DEFECT` / `KNOWN DIVERGENCE` so the intentional break reads as
      an expected change rather than a regression.)*
- [ ] `speech-assess.test.js` — normalization, contraction expansion, alignment.
      **Deferred to Phase 1**, which is when the module it tests exists.
- [x] `assets.test.js` — parse `index.html` for `<script src>`/`<link href>`, assert each appears
      in `service-worker.js`'s `STATIC_ASSETS` **and** exists on disk. Twenty lines that
      permanently prevent the all-or-nothing `cache.addAll` from silently killing offline. Six
      scripts are already missing, so **this test fails on day one** and pays for itself.
      *(It found nine gaps, not six: the six scripts plus `manifest.json` and two favicon links.
      All are now precached, so the invariant needs no carve-out — every local reference must be
      in `STATIC_ASSETS`.)*

**New `js/core/levels.js`** — the single source of truth for levels:

```js
const LEVELS = [
    { id:'foundation', label:'Foundation', cefr:'A1–A2', order:1 },
    { id:'everyday',   label:'Everyday',   cefr:'B1',    order:2 },
    { id:'confident',  label:'Confident',  cefr:'B2',    order:3 },
    { id:'fluent',     label:'Fluent',     cefr:'C1',    order:4 }
];
// The identity entries are what make canonicalLevel() idempotent. Load-bearing, not redundant.
const LEVEL_ALIASES = {
    basic:'foundation', intermediate:'everyday', medium:'confident',
    foundation:'foundation', everyday:'everyday', confident:'confident', fluent:'fluent'
};
const DEFAULT_LEVEL = 'foundation';
function canonicalLevel(x) {
    return LEVEL_ALIASES[String(x == null ? '' : x).trim().toLowerCase()] || DEFAULT_LEVEL;
}
```

Coercing garbage to `foundation` rather than returning `undefined` is deliberate:
`vocabularyData[undefined].length` throws, whereas a wrong-but-valid level is one button click
from correct. Keep `LEVEL_ALIASES` **permanently**, not for one release — four lines, and it is
what saves a learner who restores an old `localStorage` backup.

**New `js/core/migrations.js`** — lands here with `SCHEMA_VERSION = 1`, a no-op chain, and the
backup helper, so the mechanism is tested before it has work to do:

```js
function backupOnce(storageKey, fromVersion) {
    const bakKey = `${storageKey}.bak.v${fromVersion}`;
    try {
        if (localStorage.getItem(bakKey) !== null) return;   // never overwrite
        const raw = localStorage.getItem(storageKey);
        if (raw !== null) localStorage.setItem(bakKey, raw);
    } catch (e) { /* quota / private mode: proceed, the migration is still guarded */ }
}
```

Both stores are small; the copy is free and is the manual recovery path if a migration turns out
wrong in the field. **The highest-value safety measure in this plan.**

**Verify:** `npm test` green except the intentionally-failing asset test (fix by completing
`STATIC_ASSETS`). App behaviour identical. `canonicalLevel('basic') === 'foundation'` in console.

**Verified ✅** — 112/112 assertions pass; all core modules load cleanly in `index.html` order with
no global-name collisions; `migrateProgress` confirmed idempotent end-to-end in browser-global
form; `service-worker.js`, `package.json` and `jest.config.js` all parse. `js/core/srs.js` is
byte-identical to the committed version — Phase 0 changed no existing behaviour.

---

## Phase 1 — Honesty quick wins

**Goal:** kill the three dishonest behaviours. No persisted-schema changes. About a day's work,
and it delivers most of the audit's pedagogical value.

### 1a. `js/core/speech-assess.js` — new module

**A new module rather than inline in `app.js`**, because it is pure string-in/object-out and so the
only kind of code testable without a DOM; `app.js` is already 3107 lines; and it gets three call
sites (listening read-aloud, pronunciation production, reading dictation).

**Normalization.** Treat `"I'm" == "I am"` as a match — the recogniser's choice between the two is
a transcription convention, not a fact about the learner's mouth, and penalising it is exactly the
false precision [TEACHING_METHODOLOGY.md §3](TEACHING_METHODOLOGY.md) forbids. Expand contractions
into *multiple tokens* on both sides so they align 1:1 (canonicalising the other direction would
require merging two transcript tokens into one — strictly harder). Surface the spoken form as a
non-punitive hint, phrased conditionally because we genuinely cannot tell which one they said:

> "If you said *I am*, try the contraction *I'm* — that's what you'll hear in real speech."

Also: strip punctuation but keep apostrophes; normalise smart quotes (recognisers emit them); map
number words 0–20 and the tens (recognisers emit digits where the target has words).

**Alignment: a Needleman-Wunsch edit script, not an index-by-index zip.** A naive zip mis-reports
catastrophically — drop one word and every subsequent word reports as wrong, so a learner who
omitted one article is told they failed 8 of 9. **That is a new dishonesty replacing the old one.**
Sequences are under 40 tokens, so O(n·m) DP is free.

```js
// -> [{op:'match'|'sub'|'del'|'ins', t, h}]
function align(T, H) {
    const n = T.length, m = H.length;
    const d = Array.from({length: n+1}, () => new Int32Array(m+1));
    for (let i = 1; i <= n; i++) d[i][0] = i;
    for (let j = 1; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
        const c = T[i-1].norm === H[j-1].norm ? 0 : 1;
        d[i][j] = Math.min(d[i-1][j-1] + c, d[i-1][j] + 1, d[i][j-1] + 1);
    }
    const ops = []; let i = n, j = m;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0) {
            const c = T[i-1].norm === H[j-1].norm ? 0 : 1;
            if (d[i][j] === d[i-1][j-1] + c) {           // prefer the diagonal on ties
                ops.push({op: c === 0 ? 'match' : 'sub', t: T[i-1], h: H[j-1]});
                i--; j--; continue;
            }
        }
        if (i > 0 && d[i][j] === d[i-1][j] + 1) { ops.push({op:'del', t:T[i-1], h:null}); i--; continue; }
        ops.push({op:'ins', t:null, h:H[j-1]}); j--;
    }
    return ops.reverse();
}
```

**Preferring the diagonal on ties is pedagogically load-bearing**, not a micro-optimisation: it
makes *sheep*→*ship* report as one substitution ("the recogniser heard *ship*") instead of a
delete plus an insert. The substitution is what lets us name the confused pair and link to the
/iː/–/ɪ/ drill — the entire point of [CURRICULUM.md §6](CURRICULUM.md).

`assess(target, transcript)` returns `{totalWords, matchedWords, missed, swapped, extra, accuracy,
allMatched, ops}`. `allMatched` is defined on **target coverage only**; extras are reported as a
neutral note. This does not resurrect the old "say a paragraph containing the word and it passes"
hole, because the target is now the whole sentence (see 1c) — covering every word of a sentence is
a real achievement. Top-tier copy still requires `extra.length === 0`.

**Message copy** (methodology §5 — name the specific thing, no baby talk):

| Condition | Message |
|---|---|
| all matched, no extras | "The recogniser understood every word." — **never** "Perfect!" |
| substitutions | "The recogniser heard *ship* where you wanted *sheep*. Listen to both and try again." (+ drill link when the pair maps to a `minimalPairs` id) |
| deletions only | "The recogniser missed 2 of 9 words: *asked*, *texts*. Those are consonant clusters — try the clusters drill." |
| extras only | "The recogniser understood every word, plus 2 it didn't expect." |
| empty / accuracy 0 | "The recogniser didn't catch anything. That's usually the microphone, not you — check the level and try again." |
| once per visit | "This tells you what the recogniser guessed, not whether a person would understand you." |

**Rendering: a node-building renderer, NOT `showFeedback`.** `showFeedback` (`app.js:2807`) uses
`textContent` and therefore cannot render per-word markup — and it must **not** be converted to
`innerHTML`, because it takes arbitrary strings from many call sites. Build spans with
`createElement` + `textContent` (`.diff-word` + `.diff-match` / `.diff-sub` / `.diff-del`); no
injection path even though the content derives from user speech.

- [ ] `js/core/speech-assess.js`: `tokenize`, `align`, `assess`, `renderDiff`, message builder
- [ ] `styles.css`: `.diff-word` + three states, and the **missing `.feedback.warning`** —
      `Toast.warning` exists (`app.js:850`) but `styles.css` only defines
      `.feedback.success/error/info` (`:1947-1959`), so `showFeedback(id,msg,'warning')` currently
      renders unstyled. Per methodology §6, don't encode meaning in colour alone: pair each state
      with an underline style and a leading glyph.

### 1b. Fake IPA and the quiz-index bug

- [ ] **`app.js:1349`** — delete the `pronunciation: \`/${word}/\`` line (authoring guide §2 rule
      1: omit rather than invent). **Must land together with a guard at `app.js:1396`**, or
      `textContent = wordData.pronunciation` prints the literal string "undefined". Use
      `wordData.pronunciation || ''` and hide the element when empty. Shipping half of this is
      exactly the visible regression to avoid.
- [ ] **`app.js:970-983`** — stop shuffling in the data layer (authoring guide §2 rule 5 already
      says shuffling is the app's job at render time). Return unshuffled
      `options: [definition, ...distractors], correct: 0`, and add one render-time
      `shuffleQuiz(quiz)` helper (proper Fisher-Yates, recomputing `correct`) used by
      `displayVocabQuiz`.
- [ ] Replace all **8** `sort(() => Math.random() - 0.5)` sites — that idiom is also a biased
      shuffle, not just a misplaced one.

### 1c. Fix the randomised, disconnected target word

`app.js:2338-2340` picks a random vocabulary word on every listening load — unrelated to the
sentence just heard and to the review queue, re-randomising on Next so a learner cannot retry a
sound they just failed.

- [ ] The **read-aloud target is the listening sentence itself** — the honest choice, since the
      learner just heard it.
- [ ] A separate *focus word* only when the item declares `focusWord`; else
      `SRS.getDue('vocab', {limit:1})[0]?.word`; else the curated word at `state.currentWordIndex`.
- [ ] Store on `state.currentSpeechTarget`, recomputed only on navigation. **No `Math.random()`.**
- [ ] `app.js:2478-2492` becomes `SpeechAssess.assess(state.currentSpeechTarget, transcript)` →
      diff render + honest copy, with `markExerciseComplete` gated on `result.accuracy >= threshold`
      instead of a substring hit.

**Verify:** read a sentence correctly → "understood every word". Omit one word → *exactly* that
word highlighted, the others still matched (this is the regression a naive zip would fail). Say
"sheep" for "ship" → substitution naming both. Say nothing → microphone message. Navigate away and
back → same target, not a new random one. Offline, walk 30 generated words → no `/word/` and no
"undefined" in the pronunciation slot.

---

## Phase 2 — CEFR rename + migration

**Goal:** four canonical levels everywhere, old data resolving correctly, migration provably
idempotent. **Highest-risk phase — be paranoid here.**

**Nine surfaces carry the old level string:**

| # | Surface | Handling |
|---|---|---|
| 1 | `learningProgress.completedExercises.*` entries `"vocabulary_basic_0"` | rewrite the level token |
| 2 | `learningProgress.exerciseHistory[].difficulty` and `.id` | rewrite both |
| 3 | `learningProgress.currentDifficulty` (saved, never restored) | rewrite + **start restoring it** |
| 4 | `srsData[key].data.difficulty` (via `app.js:1399` → `srs.js:101`) | separate versioned migration |
| 5 | `js/core/validator.js:264` enum | replace with `levelIds()` |
| 6 | `index.html` — 9 `data-level` attrs + labels across 3 sections | rewrite + add a `fluent` button |
| 7 | Generator template objects (`app.js:1282-1299`, `:330-490`, `:2027`) | rename keys + add `fluent` |
| 8 | `data.js` level keys × 5 objects | rename + author `fluent` stubs |
| 9 | `getLocalWordData` fallback `vocabularyData.basic` (`app.js:987`) | `vocabularyData[DEFAULT_LEVEL]` |

**The exercise-ID rewrite.** `getExerciseId` returns `` `${type}_${difficulty}_${index}` ``
(`app.js:266`):

```js
// Parse from the END: the index never contains "_" and the level is one token, so the
// level is always parts[length-2]. Parsing from the front breaks the day a type is
// named e.g. "word_families".
function migrateExerciseId(id) {
    if (typeof id !== 'string') return id;
    const parts = id.split('_');
    if (parts.length < 3) return id;
    const li = parts.length - 2;
    const canon = LEVEL_ALIASES[parts[li].toLowerCase()];
    if (!canon) return id;            // unknown token: leave it alone, never corrupt
    parts[li] = canon;
    return parts.join('_');
}
```

**Two independent idempotency guarantees** — belt-and-braces, because this operation is the one
that cannot be undone:

1. The `from >= SCHEMA_VERSION` early return.
2. The identity entries in `LEVEL_ALIASES`, which make `migrateExerciseId` a fixed point after one
   application — so re-running is harmless even if the version guard is bypassed by a corrupted
   version field or a hand-edited `localStorage`.

Collapse results through `new Set` to absorb any duplicate two source levels could produce.

**Where it runs — inside `loadProgress()` (`app.js:135`), immediately after `JSON.parse` and
before every existing read.** Three subtleties that will bite if missed:

- [ ] **`state.schemaVersion` must be set on `state`**, not only on the parsed object.
      `saveProgress()` spreads `state` (`app.js:120`), so an unset field means the version never
      persists and the migration re-runs silently on every load, forever.
- [ ] **`loadProgress` is an allowlist**, so `schemaVersion` needs its own explicit assignment.
- [ ] **The fresh-install branch must stamp the version too**, or new users get flagged for
      migration on their second load.
- [ ] Also **start restoring `currentDifficulty`** here, wrapped in `canonicalLevel()` — today it
      is saved and never read back, silently resetting to `basic` on every reload.

**`srsData` — separate store, separate version, chained.** Phase 2 does srsData v1→v2 (the level
rename in `rec.data.difficulty`); Phase 4 does v2→v3 (typed keys). Two small chained steps prove
the chain works before the harder migration needs it. Wrap the bare map in a `{version, records}`
envelope with a shape sniff that requires **both** `records` to be an object **and** `version` to
be a *number*, so a legacy word key literally named `"records"` still falls to the legacy branch.

**Migrate or reset `srsData`?** Given the `correct: 0` bug, existing correctness verdicts are
largely noise for online curated words, so a clean reset is genuinely defensible.
**Recommendation: migrate + backup.** The *set* of words encountered is still valid signal even
where the pass/fail was noise; lapse counts recover within a few sessions; and `backupOnce` plus
`SRS.reset()` gives an escape hatch either way. Worth surfacing as a one-time
**"reset my review history"** button so the learner can choose.

**Verify:** with populated pre-migration data, note some completed-exercise ids in DevTools;
reload; confirm `vocabulary_foundation_0`, `schemaVersion: 2`, `learningProgress.bak.v1` present,
and completion ticks still on the same exercises. Reload again — byte-identical, no second backup.
Manually set `schemaVersion` back to `1` and reload — no corruption (the identity-alias property).
Switch through all four levels in all three selectors; **`fluent` must load without throwing** —
this is where a missing `listeningExercises.fluent` will surface (see Phase 5).

---

## Phase 3 — `SECTIONS` registry refactor

**Decision: introduce the registry, additively, with zero new sections in this phase.**

Adding Grammar and Pronunciation by hand is 2 × ~12 sites ≈ 24 hand-edits, each a silent-failure
site. `updateStatistics` has **no `default` case**, so a missed entry there gives you a section
that renders perfectly and counts nothing — the worst kind of bug.
`updateCompletionIndicator` returns early on unknown types. `handleGlobalShortcuts` is hardcoded
to `key <= '6'`. Doing that twice by hand is how you ship a section that works everywhere except
the dashboard.

The refactor risk is real but bounded: **we are not refactoring 3100 lines.** Every one of these
sites is a pure data lookup inside a function that already does
`const x = map[type]; if (!x) return;`. Every signature stays identical, every call site stays
where it is, and each site is independently verifiable by clicking one thing. Landing the refactor
and the new sections in separate phases means that when Grammar misbehaves, you know it's the
data, not the refactor.

**New `js/core/sections.js`** — one entry per section carrying `id, label, icon, indexKey,
goalKey, prevBtnId, nextBtnId, statusId, dailyStatKey, totalStatKey, avgKey, srsType,
tracksExercises, hasDifficulty`.

Loaders are **registered at runtime**, not referenced in the literal: `sections.js` parses before
`app.js`, so `loadVocabularyWord` does not exist when the registry is evaluated. One explicit
`Sections.registerRuntime()` block in `app.js`, placed after the loaders, keeps functions with
functions. **Adding a section becomes two edits plus HTML, not twelve.**

**The call sites that collapse** (all `app.js`):

| Site | Becomes |
|---|---|
| `switchSection` loaders map `:1140-1146` | `Sections.loader(id)?.()` |
| `handleGlobalShortcuts` bound `:2872` | `key <= String(Sections.ids().length)` — **note the single-character ceiling at 9 sections**; comment it |
| `handleGlobalShortcuts` array `:2874` | `Sections.ids()` |
| `navigatePrevious` / `navigateNext` `:2892-2914` | `Sections.get(id)?.prevBtnId` / `.nextBtnId` |
| `state.completedExercises` init `:47-53` | loop `Sections.exerciseIds()` |
| `saveProgress` `Array.from` `:121-127`, `loadProgress` `new Set` `:149-155` | loops |
| `updateStatistics` switch `:236-263` | registry keys **plus a `default` that calls `AppErrorHandler.logError`** — kill the silent no-op |
| `updateNavigationButtons` `:492-497` | `indexKey` |
| `updateCompletionIndicator` `:511-516` | `statusId` |
| `retakeCurrentExercise` two maps `:542-558` | `indexKey` + `Sections.loader` |
| `initializeDifficultySelectors` `:1157-1164` | index-reset loop + `Sections.loader(section)()` |
| `dailyGoals` init `:32-38`, `/5` at `:1187` | `Sections.goalKeys()` — see Phase 9 |
| `calculateAverages` `:227-231` | loop over `avgKey` |

**Two deliberate behaviour changes to name in the commit message:**
- The index-reset loop now also resets `currentListeningIndex` on a level change (previously
  omitted — a pre-existing inconsistency, arguably a bug).
- `updateStatistics` now logs unknown types instead of silently doing nothing.

**Registry contract to document and test:** `updateCompletionIndicator` does
`section.querySelector('h2').after(...)` (`app.js:529`), so **every section element needs a
direct-child `h2`** or that line throws.

- [ ] **New `__tests__/unit/sections.test.js`** — parse `index.html` and for every registry entry
      assert `#{id}`, `#{prevBtnId}`, `#{nextBtnId}`, `[data-section="{id}"]`, the `statusId` host
      section, and a direct-child `h2` all exist. This is what the old `keyboardNavigation.test.js`
      was groping toward by duplicating the maps, and it catches a mis-wired Grammar section in
      Phase 6 before a human clicks anything.

**Verify:** every nav button; Alt+1..6; arrow keys in each section; complete an exercise and check
the ✓ ticks and dashboard counters; retake; change level in all three selectors; hard-reload and
confirm completions survive. Then `npm test`.

---

## Phase 4 — SRS generalization

**Goal:** one scheduler holding vocabulary, grammar points, phoneme pairs and collocations per
[TEACHING_METHODOLOGY.md §3](TEACHING_METHODOLOGY.md), with the three hardcoded couplings removed.

**Record shape:** `{key, type, ref, reps, interval, ease, lapses, due, lastReviewed, createdAt, data}`
where `type ∈ {vocab, gram, phon, coll}` and `key = "type:ref"`.

**Typed keys** — lowercase plus whitespace→hyphen only, **not** aggressive slugification, because
`phon:iː-ɪ` must retain its IPA. Since the same function runs on write and on read, ids round-trip
regardless of what symbols an author uses. Authoring rule: use the exact `minimalPairs[].id`.

**The three couplings that currently block non-vocabulary items:**

- [ ] **`_key` stringifies non-`.word` objects to `"[object object]"`** (`srs.js:76-78`), so every
      such item collides on a single record. Fix with `_typedKey` plus a backward-compatible
      `_normalizeItem` accepting a string, a `{srsType, srsRef}` item, or a legacy `{word}` object
      — so the sole existing call site (`app.js:1444`) needs **no change at all**. Add an explicit
      `scheduleItem(type, ref, data, correct)` for new callers.
- [ ] **The 6-field whitelist** (`srs.js:95-102`) silently drops any new field. Replace with a
      per-type `PROJECTORS` registry — bounded (no accidental blob or DOM node in `localStorage`)
      yet extensible. **Document loudly in [CONTENT_AUTHORING_GUIDE.md](CONTENT_AUTHORING_GUIDE.md):
      adding a vocabulary field requires adding it to `PROJECTORS.vocab`, or it silently vanishes
      from every review card.** That is exactly the bug class the current whitelist already causes.
- [ ] **The `data.quiz` filter** (`srs.js:139`) means non-vocab items schedule but never surface,
      and `dueCount()` never counts them. Replace with a per-type `RENDERABLE` predicate
      (`vocab: d => !!d.quiz` preserves today's behaviour exactly).

**Resolve the `dueCount()` / `stats().due` disagreement.** Today `dueCount()` counts
due-**and**-renderable while `stats().due` counts due-**regardless**, so the badge and the
dashboard can differ with no explanation. Name all of them and pick one definition per question:

| API | Means |
|---|---|
| `getDue(type, opts)` | renderable, oldest-due-first, capped — **what the learner walks** |
| `countDue(type)` | all due, renderable or not |
| `dueCount(type)` | capped actionable count — **what the badge shows** |
| `stats(type)` | `{total, due, actionable, learned, lapses}` |

**"Review Due (7)" followed by a 3-item session is a trust bug**, forbidden by methodology §3
("never claim more than we have") as much as a false "Perfect!" is. Assert
`dueCount() <= stats().actionable <= stats().due` in tests.

- [ ] **Daily cap of 20** per methodology §3 — **per-call and stateless.** Because the sort key
      (`due` timestamp) is stable, the same 20 items come back on every call within a day without
      persisting a counter. One less field to migrate.
- [ ] **Interleaving is required, not a nicety.** A global oldest-first sort then `slice(0,20)`
      will happily fill all 20 slots with vocabulary and starve grammar and pronunciation,
      defeating [CURRICULUM.md §3](CURRICULUM.md)'s "every session touches at least three
      strands". Round-robin across types.
- [ ] **Make the interval ladder match the documented policy.** Methodology §3 specifies
      1 → 3 → 7 → 16 → 35; the current code yields 1, 3, 8, 22. Use an explicit
      `INTERVAL_STEPS = [1,3,7,16,35]` with the multiplicative tail beyond it. Forward-only, no
      data rewrite, so it is free to land here.
- [ ] **srsData v2→v3 migration** — legacy `"happy"` → `"vocab:happy"`, preserving
      reps/interval/ease/lapses/due so no learner loses scheduling state. **Drop records whose ref
      is `"[object object]"`** — victims of the old `_key` bug, with no recoverable identity. Guard
      collisions by keeping the more-advanced record.
- [ ] **Move the parse-time `SRS.load()`** (`srs.js:167`) into an explicit `SRS.init()` called
      from bootstrap. As written, adding migrations to `load()` means a `localStorage` migration
      running during script parse, before `app.js` exists, with a hard ordering dependency on
      `levels.js` — exactly the coupling that breaks silently when someone reorders a `<script>`
      tag.

**Verify:** note a word's `reps`/`due`; reload; the key is now `vocab:happy` with the same numbers,
`version: 3`, both `.bak` keys present. Reload again — unchanged. Answer a vocab quiz wrong → the
record resets to 1 day and the badge increments. **Confirm the badge equals the number of cards
review mode actually walks.** `npm test` covers the ladder, clamps, cap, interleave, the
invariant, and the `[object object]` drop.

---

## Phase 5 — Content file layout and foundation + everyday authoring

**Decision: new content types go in new `data/*.js` classic scripts; existing structures are
enriched in `data.js` in place.**

`const` redeclaration across two classic scripts is a fatal `SyntaxError`, so anything new needs a
new name — and a file per strand keeps each authoring task reviewable and diff-able. But
`vocabularyData` and `listeningExercises` are already `const` in `data.js` and cannot be extended
from another file, so **`data.js` is touched exactly twice in the whole plan**: Phase 2 (level
keys) and Phase 8 (schema enrichment). Two well-scoped diffs beat five overlapping ones.

```
data.js                  existing consts, enriched in place
data/grammar.js          const grammarLessons, MISTAKE_CATEGORIES
data/pronunciation.js    const minimalPairs, phonemeInventory, stressDrills, schwaDrills
data/speaking.js         const speakingPrompts, dialogues
```

**Load order in `index.html`:**
`error-handler → validator → levels → sections → migrations → srs → speech-assess → theme-toggle
→ ui-enhancements → data.js → data/*.js → app.js`.
Hard constraints: `levels.js` before `migrations.js` and `srs.js`; everything before `app.js`.

> ⚠️ **Access guards: always bare `typeof grammarLessons !== 'undefined'`, never
> `window.grammarLessons`.** A top-level `const` in a classic script is a lexical global, *not* a
> property of `window`, so the `window.` form is always falsy and the guard always fails. This is
> the single most likely mistake in Phases 6–7 — put a comment at every guard site.

- [ ] **Service worker:** add the three `data/*.js`, the four new `js/core/*.js`, and the **six
      already-missing** files (`error-handler`, `validator`, `storage`, `notification`,
      `theme-toggle`, `ui-enhancements`) to `STATIC_ASSETS`; bump `STATIC_CACHE` to `v4`. Phase 0's
      `assets.test.js` enforces this from here on.

**Content to author** (per [CONTENT_AUTHORING_GUIDE.md §6](CONTENT_AUTHORING_GUIDE.md) schemas,
foundation + everyday tiers):

- [ ] **16 grammar lessons** (8 + 8) — each with `explain`, ≥3 `contrast` pairs, `spokenNote`,
      6 `practice` items **each carrying its own `explanation`**, and one `produce` task.
- [ ] **8 minimal-pair sets** — the South-Asian priority list in
      [CURRICULUM.md §3 Strand C](CURRICULUM.md): /v/–/w/, /θ/–/t/, /ð/–/d/, /ɪ/–/iː/, /æ/–/e/,
      /ɒ/–/əʊ/, /s/–/ʃ/, and final consonant clusters — each 3+ pairs plus a contrasting sentence.
- [ ] **Stress drills** (`PHOtograph / phoTOGrapher`) and **schwa drills**.
- [ ] **Speaking prompts**, ~6 per level, with `targetSeconds`, `useLanguage`, `rubric`.
- [ ] **Functional dialogues**, ~6 per level, with `keyPhrases`, `lines`, `roleplay`.
- [ ] **`fluent` stubs for every existing `data.js` structure — mandatory.** Listening has no level
      selector of its own (`index.html:258-287`) but reads
      `listeningExercises[state.currentDifficulty]` and `vocabularyData[state.currentDifficulty]`,
      so it throws on `undefined.length` the moment another section sets the level to `fluent`.

**Verify:** `node -e "new Function(require('fs').readFileSync('data/grammar.js','utf8'))"` per file
(authoring guide §7 checklist). Console: `grammarLessons.foundation.length === 8`, no redeclaration
errors. Toggle offline in DevTools and reload — the app still works, proving the SW list is complete.

---

## Phase 6 — Grammar section

The largest hole in the curriculum: today grammar is *tested* by fill-in-the-blank and never
*taught*.

- [ ] Registry entry + one runtime line + `index.html` section (direct-child `h2`,
      `.difficulty-selector`, `#prevGrammar` / `#nextGrammar`, `#grammarStatus`) + nav button.
- [ ] `dailyGoals.grammar` — a new key restored by `Object.assign` merge, so **no migration**.
- [ ] `loadGrammarLesson()` implements methodology §7's **Notice → Practise → Use** arc:
      `explain` plus highlighted `contrast` pairs; then the 6 `practice` items; then the `produce`
      task using Phase 1's speech assessment.
- [ ] Feedback per methodology §2: right-first-try schedules at a longer interval and says nothing
      more; **wrong states the rule in one sentence, shows a minimal contrast pair, offers a
      retry**, and resets the point to 1 day via
      `SRS.scheduleItem('gram', lesson.id, lesson, false)`.
- [ ] Log wrong answers to the mistake log with the lesson's category.

Reuse `.section`, `.nav-btn`, `.difficulty-selector`, `.diff-btn`, `.feedback`,
`.navigation-buttons`, `.exercise-card`, `.exercise-status` as-is — no new CSS beyond a
contrast-pair block.

**Verify:** Alt+7 reaches it; arrows navigate; a wrong practice answer shows rule + contrast +
retry and pushes the point into the review queue; the dashboard grammar goal ticks;
`sections.test.js` passes with the new ids.

---

## Phase 7 — Pronunciation section

Three sub-modes, same registry pattern; `dailyGoals.pronunciation`.

- [ ] **Minimal-pair discrimination** — play one member at random, learner picks which they heard.
      Methodology §2 calls this the only reliably gradeable offline pronunciation task, so make it
      the **default** mode.
- [ ] **Stress drills.**
- [ ] **Production drills** using the existing MediaRecorder plus the methodology §2 rubric
      checklist — no automatic scoring.
- [ ] Track accuracy **per phoneme pair, not per item** (methodology §2) via
      `SRS.scheduleItem('phon', pair.id, pair, correct)`.
- [ ] Wrong answer: replay both words back-to-back **slowed** — finally a real use for
      `speechAPI.speak(text, rate)`'s never-varied `rate` argument (`app.js:1002`) — and name the
      differing feature from the set's `hint`.
- [ ] Accessibility per methodology §6: IPA selectable and legible at 200% zoom, a plain-English
      gloss ("/ʃ/ — the *sh* in *ship*"), full keyboard completion, and a skip-and-mark-done path
      for learners who cannot record.

**Verify:** the discrimination drill is completable by keyboard alone; a wrong pick replays both
words slowly and names the feature; the pair enters the queue as `phon:iː-ɪ`; per-pair accuracy
shows on the dashboard.

---

## Phase 8 — Listening comprehension, rich vocabulary, generator honesty

**Do step 1 alone, and first.** Converting `listeningExercises` from `string[]` to `object[]`
breaks `loadListeningExercise` (`app.js:2322`). This is the most breakage-prone content change in
the plan, and the normalizer is what decouples the code change from the content change:

- [ ] Land `asListeningItem(x) => typeof x === 'string' ? {text:x, rate:1, questions:[]} : x` at
      every read site **before** touching any data.

Then:

- [ ] Comprehension questions on every listening item — **gist before detail, transcript revealed
      last** (methodology §2). Without a question, it is not a listening exercise.
- [ ] 0.75× / 1.0× / 1.25× rate controls; shadowing mode; dictation in Listening as well as Reading.
- [ ] **Rich vocabulary fields** (`stress`, `register`, `partOfSpeech`, `collocations`, `family`,
      `produce`) — with a **prerequisite fix**: `parseAPIResponse` rebuilds `wordData` wholesale
      from the API, so authored fields never survive the online path. Change `loadVocabularyWord`
      to **merge API over curated** (`{...curated, ...apiFields}`) rather than replace. Without
      this, every field authored in this phase is invisible whenever the learner is online.
- [ ] The produce-the-word card (definition + gap sentence, typed or spoken) per
      [CURRICULUM.md §3 Strand A](CURRICULUM.md).

**Generators — decision: keep, fix, cap, and label. Do not retire.** Retiring them removes the
app's only source of unbounded practice, a real product loss; but methodology §6 is explicit that
combinatorial content may "pad, never [be] the primary content". Encode that as mechanism rather
than intention:

- [ ] Convert `generateVocabularyWord` from a **composer into a sampler over a larger curated
      pool** (~300 real words with real IPA, real definitions, real examples). This is the honest
      resolution of the volume-versus-quality tension: the effectively-infinite feel survives
      while every individual item is true.
- [ ] Tag generated items `source:'generated'`, show a discreet "practice filler" label, and
      enforce the rule mechanically: **generated items never enter SRS and never count toward daily
      goals.** Note the consequence — generated vocabulary currently *does* enter SRS via
      `state.currentVocabWord`, so this shrinks the review queue while removing garbage from it.
      That is the right trade; say so in the commit.
- [ ] Constrain `generateAlgorithmicSentence`'s slot arrays to combinations that actually co-occur,
      killing "The penguin meanders madly at the estuary". Lower priority than the two above.

---

## Phase 9 — Dashboard, daily goals, session sequencer

**The `/5` fix (`app.js:1187`)** — derive the denominator from the registry:

```js
const keys = Sections.goalKeys();
const pct  = keys.length ? (keys.filter(k => state.dailyGoals[k]).length / keys.length) * 100 : 0;
```

Counting `Object.values(state.dailyGoals).length` is the obvious fix but subtly wrong:
`dailyGoals` is restored by `Object.assign` **merge**, so a stale key from an older version
survives forever and silently inflates the denominator. The registry is the authority.

- [ ] **Keep the existing five goal keys exactly as they are** (`vocab`, `sentence`, `reading`,
      `listening`, `puzzle` — inconsistently singular, not matching section ids). Renaming is
      cosmetic and would cost a third migration; carrying `goalKey:'vocab'` on section
      `vocabulary` is precisely why `goalKey` is an explicit registry field. Add `grammar`,
      `pronunciation`, `speaking` — free, because merge-restore tolerates new keys. Checkbox ids
      follow the existing `goal${Capitalized}` convention (`app.js:1182`).

**Session sequencer** ([CURRICULUM.md §4](CURRICULUM.md)) — the app currently offers a menu of six
sections and sequences nothing. A "Start today's session" button that walks the 20-minute path
would raise completion more than any new content:

- [ ] `state.session = {active, stepIndex, startedAt, date, plan}`.
- [ ] `buildSessionPlan()` returns the walk — review-if-due → grammar → minimal pairs →
      listen + shadow → free speaking → wrap — with `.filter(stepHasContent)` to skip strands that
      have nothing at this level.
- [ ] UI: a "Start today's session" card plus a persistent step strip with Next / Skip.
      `advanceSession()` calls `switchSection(step.sectionId)` then `step.enter?.()`.
- [ ] Persist `session` so a reload resumes mid-session; rebuild when `session.date !== today`.

**Mistake log** (gap #12) — a **capped ring buffer (500) plus a closed category vocabulary**, the
two things that keep it from degenerating into unbounded junk:

- [ ] `MISTAKE_CATEGORIES` in `data/grammar.js`: `article-omission`, `subject-verb-agreement`,
      `past-tense-form`, `preposition`, `countable-uncountable`, `word-stress`, `collocation`,
      `phoneme:<pair-id>`.
- [ ] `topMistakes(days, n)` renders methodology §1.4's "your top 5 recurring mistakes this month".

**Fluency metrics:**

- [ ] `state.fluency = [{ts, promptId, seconds, words, wpm, fillers}]`, reusing
      `SpeechAssess.tokenize` for the word count and a filler list (um, uh, er, like, you know).
- [ ] **Honesty caveat that must reach the UI:** WPM derived from a recognition transcript
      systematically *undercounts*, because the recogniser silently drops words it fails to catch.
      Label it **"recognised words per minute"** and compare only against the learner's own
      history — which methodology §2 requires anyway ("never against a native baseline").

> ⚠️ **The trap for all three new fields.** `state.session`, `state.mistakeLog` and
> `state.fluency` are saved for free (`saveProgress` spreads `state`) and then **never restored**,
> because `loadProgress` is an explicit allowlist (`app.js:135-190`). Each needs its own read line.
> Standing checklist item: *any new top-level `state` field requires an explicit read in
> `loadProgress`.* Add a Jest test that round-trips `state` through save/load and asserts no key is
> lost — that kills this bug class permanently.

---

## Phase 10 — Hygiene

- [ ] **Delete `js/core/storage.js` and `js/core/notification.js`.** Both load on every page with
      zero call sites; `notification.js`'s `NotificationManager` / `LoadingManager` /
      `ConfirmationManager` duplicate `app.js`'s `Toast` (`:741`) and `LoadingIndicator` (`:873`)
      under different names. `storage.js`'s `{value, timestamp, version}` envelope idea has already
      been harvested by the srsData envelope in Phase 2, so the file has served its purpose.
- [ ] **Keep `js/core/validator.js`** — `safeClone` / `isEmpty` are genuinely reusable, and
      `validateProgress` becomes useful once its enum (`:264`) is `levelIds()`. Wire it into
      `loadProgress` as **warn-only**: log, never block a load, or schema drift locks a learner out
      of their own data.
- [ ] **Keep `js/core/error-handler.js`** — its instance captures uncaught errors to `errorLog`
      independently of `AppErrorHandler`.
- [ ] Reconcile `.github/workflows/ci-cd.yml` with the now-real npm scripts.
- [ ] Correct the README / CHANGELOG claims of "260+ tests, 70% coverage, production-ready", and
      the `yourusername` placeholders in `package.json`.

---

## Critical files

| File | Role across the plan |
|---|---|
| `app.js` | ~12 registry call sites; migration hook in `loadProgress` (`:135`); speech handler (`:2478-2492`) and target-word fix (`:2338`); `parseAPIResponse` (`:970`); `generateVocabularyWord` (`:1281`, fake IPA `:1349`); `updateDashboard` `/5` (`:1187`) |
| `js/core/srs.js` | typed keys, projectors, renderability, `getDue`/`dueCount`/`stats` reconciliation, v1→v3 migration, `init()` replacing the parse-time `load()` |
| `data.js` | level-key rename (P2) and schema enrichment (P8) — the only two in-place edits, plus `fluent` tiers |
| `index.html` | script load order, 9 `data-level` attrs + `fluent` buttons, two new sections with direct-child `h2`, new goal checkboxes |
| `service-worker.js` | `STATIC_ASSETS` (6 files already missing) and `STATIC_CACHE` bumps; the all-or-nothing `addAll` makes this a hard offline dependency |

**New files:** `js/core/levels.js`, `js/core/migrations.js`, `js/core/sections.js`,
`js/core/speech-assess.js`, `data/grammar.js`, `data/pronunciation.js`, `data/speaking.js`,
`jest.config.js`.

**Reuse, don't reinvent:** `showFeedback` (`app.js:2807` — `textContent` only, never convert to
innerHTML), `Toast.info/success/error/warning` (`:741`), `LoadingIndicator` (`:873`),
`AppErrorHandler.logError/handleError/validateInput` (`:566`), `speechAPI.speak(text, rate)` /
`startRecognition(cb)` (`:1002`), `markExerciseComplete` / `isExerciseCompleted` / `getExerciseId`
(`:266-289`), `SRS.schedule/getDueWords/stats`, and the CSS classes `.section .nav-btn
.difficulty-selector .diff-btn .feedback .navigation-buttons .exercise-card .exercise-status`.

---

## End-to-end verification

Each phase has its own **Verify** block. After Phase 9, walk one full learner journey:

1. Clear `localStorage`, load the app → fresh install, `schemaVersion` stamped, no migration runs.
2. Click **Start today's session** → the sequencer walks grammar → minimal pairs →
   listen + shadow → free speaking → wrap, switching sections and entering each mode.
3. Answer a grammar practice item **wrong** → rule + contrast pair + retry appear; the point enters
   the review queue; the mistake log records the category.
4. Pick the wrong member of a minimal pair → both words replay slowly, the differing feature is
   named, `phon:iː-ɪ` enters the queue.
5. Read a listening sentence aloud, deliberately dropping one word → that word alone is
   highlighted and the message names it. **`grep -rn "Perfect" app.js` returns nothing.**
6. Record a free-speaking prompt → "recognised words per minute" and filler count stored, shown
   against the learner's own history only.
7. Dashboard: 8 goal checkboxes, progress bar reads /8 not /5, top-5 mistakes rendered, and
   **the "Review Due (N)" badge equals the number of cards review mode actually walks.**
8. Hard-reload mid-session → the session resumes at the same step; all progress intact.
9. DevTools → offline → reload → app fully functional (proves `STATIC_ASSETS` is complete).
10. Restore a pre-migration `learningProgress` + `srsData` backup and reload twice → migrated once,
    idempotent, `.bak` keys present, completion ticks on the same exercises as before.

**Regression guard — `npm test` must be green:** `migrations` (idempotency), `srs` (ladder, clamps,
cap, interleave, `dueCount <= actionable <= due`), `speech-assess` (alignment, contractions),
`sections` (every registry entry has its DOM), `assets` (every script and stylesheet precached and
present on disk), and the `state` save/load round-trip.
