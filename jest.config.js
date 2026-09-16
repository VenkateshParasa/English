/**
 * Jest configuration
 * -------------------------------------------------------------
 * This project is a static, no-build-step PWA: every browser file is a
 * classic <script>, not an ES module. Jest therefore only tests the files
 * that deliberately expose `module.exports` alongside their browser global
 * (js/core/*.js), plus a couple of pure-Node checks over the repo itself.
 *
 * app.js is NOT tested and cannot be with this setup — see __tests__/README.md.
 */
module.exports = {
    testEnvironment: 'jsdom',

    // jsdom gives us localStorage; setup.js only resets shared state per test.
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],

    // __tests__/legacy/ holds the pre-existing suites that import app.js
    // internals as modules. They cannot run (app.js exports nothing) and are
    // kept only as documentation of intended behaviour. See __tests__/README.md.
    testPathIgnorePatterns: [
        '/node_modules/',
        '/__tests__/legacy/',
        // setup.js is a setupFilesAfterEach module, not a suite. Jest's default
        // testMatch picks up everything under __tests__/, so without this it is
        // collected as a test file and fails with "must contain at least one
        // test" — one red suite that says nothing about the code.
        '/__tests__/setup\\.js$',
        // tmp/ is gitignored scratch — throwaway harnesses, CI dry-runs, copies of
        // the tree. Jest's default testMatch is rooted at the project, not at
        // __tests__/, so ANY *.test.js under tmp/ gets collected. That is not
        // hypothetical: a CI simulation left a full copy of the suites at
        // tmp/ci-sim/__tests__/unit/, and `npx jest` went from 10 suites and 1,538
        // tests to 20 and 3,076 — every figure exactly doubled, every suite
        // reported twice, and coverage computed over two copies of the same file.
        // Doubled-but-green is the dangerous shape: nothing fails, so nothing tells
        // you the number you are quoting is wrong.
        //
        // Same root cause as the setup.js line above — the default testMatch is
        // greedier than the directory it looks like it is scoped to.
        '/tmp/'
    ],

    // Coverage is scoped to what is actually testable. Reporting on app.js
    // would show a misleading ~0% for a file this setup cannot reach.
    collectCoverageFrom: [
        'js/core/**/*.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text-summary', 'lcov', 'json'],

    // No coverageThreshold yet, deliberately: a failing `npm test` in CI is
    // worse than an honest low number. Add thresholds once the core modules
    // that Phases 1-4 introduce are all under test.

    clearMocks: true
};
