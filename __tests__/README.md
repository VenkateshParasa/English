# Testing

## What is and is not covered

Be clear about this before reading further, because the previous version of this
file was not: **`app.js` is not tested and cannot be with this setup.** It is a
single ~3100-line classic script with top-level side effects and no exports, so
there is no seam to import. Testing it would mean modularising it first, which
is a separate project.

What *is* tested is everything that can be tested honestly:

| Suite | Covers | Why it exists |
|---|---|---|
| `unit/migrations.test.js` | `js/core/levels.js`, `js/core/migrations.js` | Migrations rewrite saved learner progress **in place**. A bug here is unrecoverable — a broken render is a reload away, a lost review history is not. |
| `unit/srs.test.js` | `js/core/srs.js` | The scheduler owns weeks of accumulated learner state. Also pins the three known couplings that Phase 4 will change, so an intentional change reads as such. |
| `unit/assets.test.js` | `index.html` ↔ `service-worker.js` | `cache.addAll()` is all-or-nothing. One missing path silently kills offline support, and the failure is only logged to the console. |

There are no DOM or rendering tests. That is a deliberate gap, not an oversight.

## Running

```bash
npm install          # first time only
npm test             # everything, with coverage
npm run test:unit    # unit only
npm run test:watch   # re-run on change
```

Coverage is scoped to `js/core/**` (see `jest.config.js`) because reporting on
`app.js` would show a misleading near-zero for a file this setup cannot reach.
There is **no coverage threshold** yet, deliberately: a red `npm test` in CI is
worse than an honest low number. Thresholds go in once the modules that Phases
1–4 introduce are all under test.

## Layout

```
__tests__/
├── setup.js                   # minimal: clears storage between tests
├── unit/
│   ├── migrations.test.js
│   ├── srs.test.js
│   └── assets.test.js
└── legacy/                    # quarantined, NOT run — see below
```

## Why `legacy/` exists

`legacy/` holds five suites (~155 assertions) written against an intended
architecture that does not exist. They `require` `Toast`, `LoadingIndicator` and
`KeyboardNavigation` as modules, but those live as plain objects **inside**
`app.js` and are never exported. The suites have therefore never been able to
run, and CI could not have run them either: `__tests__/` was in `.gitignore`
until Phase 0, so the files were never even committed.

They are kept rather than deleted because they are a useful written record of
intended behaviour — a specification to test *against* once the relevant code
becomes importable. They are excluded via `testPathIgnorePatterns` in
`jest.config.js`.

Two of them will need rewriting regardless:
`legacy/keyboardNavigation.test.js` duplicates the section-name array and
prev/next button maps that Phase 3 replaces with a registry, and
`legacy/setup.js` depends on `@testing-library/jest-dom`, which is not a
dependency of this project.

## Writing new tests

Prefer pure logic. A module that takes data in and returns data out
(`levels.js`, `migrations.js`, the speech assessor arriving in Phase 1) is
testable in a few lines; anything that reaches into the DOM is not, with the
current structure.

Two conventions worth following:

1. **Stub the clock.** `srs.js` exposes `_now()` precisely so tests can replace
   it. Never let a test depend on `Date.now()`.
2. **Say when a test pins a known defect.** Several assertions in
   `srs.test.js` document current-but-wrong behaviour and are marked
   `KNOWN DEFECT` / `KNOWN DIVERGENCE`. When a later phase fixes one, the
   failure should read as "expected change", not "regression".

## CI

`.github/workflows/ci-cd.yml` calls `npm run test:unit`,
`npm run test:integration` and `npm test`. All three now exist.
`test:integration` currently matches no files and passes via
`--passWithNoTests`; the first real integration test replaces that flag.
