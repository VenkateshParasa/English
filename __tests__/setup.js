// Test setup — runs before each test file.
//
// Deliberately minimal. jsdom already provides localStorage, sessionStorage
// and a DOM; the old heavyweight mock file now lives in __tests__/legacy/
// alongside the suites that needed it.

afterEach(() => {
    // SRS and the migration helpers both persist to localStorage, so tests
    // must not leak state into each other.
    localStorage.clear();
    sessionStorage.clear();
});
