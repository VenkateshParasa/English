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
        '/__tests__/setup\\.js$'
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
