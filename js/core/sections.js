/**
 * Sections — the single source of truth for "what a section is"
 * -------------------------------------------------------------
 * Before this file, every section was described by ~12 hand-written literals
 * scattered through app.js: a loaders map in switchSection, a second loaders
 * map in retakeCurrentExercise, an index map, a prev-button map, a next-button
 * map, a status-element map, a `switch` in updateStatistics, a hardcoded
 * `key <= '6'` in the Alt+N handler, five hardcoded `new Set()`s, five
 * hardcoded `Array.from()`s, a hardcoded `/5` goal divisor, and five hardcoded
 * average calculations.
 *
 * Every one of those was a silent-failure site. The worst was updateStatistics:
 * a section missing from that `switch` renders perfectly and counts nothing.
 * The point of this registry is not to make such a mistake noisy, it is to make
 * it unrepresentable — there is one row per section and every consumer reads
 * that row, so a section either exists everywhere or nowhere.
 *
 * WHY LOADERS ARE NOT IN THE LITERAL BELOW
 * This file is a classic <script> that parses before app.js. `loadVocabularyWord`
 * and friends are function declarations *in app.js*, so they do not exist while
 * this literal is being evaluated; naming them here would be a ReferenceError.
 * app.js therefore calls Sections.registerRuntime() once, after the loaders are
 * declared. Data stays here, functions stay with the functions.
 *
 * WHY `dashboard` IS A ROW
 * It is a real nav target: it has a .nav-btn, a #dashboard element and an
 * Alt+1 shortcut, and the Alt+N ceiling is derived from ids().length, which must
 * still be 6. It simply has no exercises, so every learning-specific field is
 * null/false and it is excluded from exercises()/exerciseIds()/goalKeys().
 * Read `ids()` as "nav targets" and `exerciseIds()` as "learning sections".
 *
 * WHY CONTENT PROBES ARE NOT IN THE LITERAL EITHER (US-153)
 * Availability used to be decided for every section by probing `vocabularyData`,
 * which was only ever true because vocabulary was the widest content map. It
 * stopped being true the moment `grammarLessons` shipped with content for one
 * tier and empty arrays for three: a tier can be "available" per vocabulary and
 * empty for grammar, which is why the grammar loader had to grow its own local
 * resolveGrammarLevel(). Each row now NAMES its own content map in
 * `contentGlobal`, and app.js registers one probe per section via
 * registerContent() so that "does this tier have content" is answered against
 * the section actually being asked about.
 *
 * The probes cannot live in the literal for the same reason the loaders cannot,
 * only worse: data.js and data/grammar.js declare `const vocabularyData` etc.,
 * which are *lexical* globals — not properties of `window` — so a name string
 * here cannot be dereferenced from this file at all, and both files load AFTER
 * this one. `contentGlobal` is therefore documentation and a greppable join key;
 * the accessor is behaviour and lives with the data-shape knowledge in app.js.
 *
 * ADDING A SECTION
 *   1. add a row below
 *   2. add the markup to index.html (see the contract note under CONTRACT)
 *   3. add its loader to the registerRuntime() block in app.js
 *   4. add its content probe to the registerContent() block in app.js
 * Nothing else in app.js needs touching — including the dashboard, which builds
 * its stat cards and all three stat blocks from these rows (US-154).
 * __tests__/unit/sections.test.js checks step 2 against step 1 so a mis-wired
 * section fails a test, not a learner.
 *
 * CONTRACT (enforced by __tests__/unit/sections.test.js)
 *   - `#{id}` exists and is a `.section`
 *   - a `[data-section="{id}"]` .nav-btn exists
 *   - `#{id}` has a DIRECT-CHILD `h2`. updateCompletionIndicator does
 *     `section.querySelector('h2').after(...)` (app.js), which throws on null.
 *   - `#{prevBtnId}` / `#{nextBtnId}` exist when non-null
 *   - `#{totalCardId}` exists and is a `.stat-number` when non-null
 *
 * FIELDS
 *   id              nav id; also the #element id, the [data-section] value,
 *                   the completedExercises key and the exercise-id prefix
 *   label           display name without the icon (nav button text is icon+label)
 *   icon            emoji used in the nav button and the section <h2>
 *   indexKey        the state.* field holding "which item am I on"
 *   goalKey         the state.dailyGoals.* field (drives #goal{Key} checkboxes)
 *   prevBtnId       id of the "← Previous" button, or null
 *   nextBtnId       id of the "Next →" button, or null
 *   statusId        id of the completion-indicator div (created on demand)
 *   dailyStatKey    the state.dailyStats.* counter
 *   totalStatKey    the state.overallStats.* counter
 *   avgKey          the state.overallStats.averageDaily.* field
 *   statLabel       the word the dashboard stat rows use for this section. NOT
 *                   `label`: vocabulary's rows say "Words" / "Total Words",
 *                   because a learner counts words, not "vocabularies".
 *   totalCardId     id of the big #dashboard .stat-number for this section's
 *                   lifetime total, or null when the dashboard has no card for
 *                   it (listening, today — a real gap, not a design decision;
 *                   adding the markup plus an id here is the whole fix)
 *   countsInTotalExercises
 *                   whether this section's total feeds the "Total Exercises"
 *                   row. False for vocabulary, which is reported on its own
 *                   "Total Words" row instead. Preserves the pre-registry split.
 *   contentGlobal   name of the content map this section's items come from. Read
 *                   the note above: this is the join key for registerContent(),
 *                   not something this file can dereference.
 *   srsType         js/core/srs.js item type, or null if this section does not
 *                   feed the scheduler
 *   tracksExercises whether state.completedExercises has a Set for it
 *   hasDifficulty   whether the section carries its own .diff-btn level selector
 */
(function (global) {
    'use strict';

    // Order is nav order, which is also Alt+1..Alt+N order. Do not reorder
    // without reordering the .nav-btn list in index.html: the shortcut index is
    // positional.
    const SECTIONS = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: '📊',
            indexKey: null,
            goalKey: null,
            prevBtnId: null,
            nextBtnId: null,
            statusId: null,
            dailyStatKey: null,
            totalStatKey: null,
            avgKey: null,
            statLabel: null,
            totalCardId: null,
            countsInTotalExercises: false,
            contentGlobal: null,
            srsType: null,
            tracksExercises: false,
            hasDifficulty: false
        },
        {
            id: 'vocabulary',
            label: 'Vocabulary',
            icon: '📚',
            indexKey: 'currentWordIndex',
            goalKey: 'vocab',
            prevBtnId: 'prevWord',
            nextBtnId: 'nextWord',
            statusId: 'vocabStatus',
            dailyStatKey: 'wordsLearned',
            totalStatKey: 'totalWords',
            avgKey: 'words',
            statLabel: 'Words',
            totalCardId: 'wordsLearned',
            // Reported as its own "Total Words" row, so it must not also be
            // inside the "Total Exercises" sum — that is how the hand-written
            // dashboard did it, and double-counting it would silently restate
            // every learner's history.
            countsInTotalExercises: false,
            contentGlobal: 'vocabularyData',
            // The only section wired to the scheduler today; srs.js keys its
            // records 'vocab:<word>'.
            srsType: 'vocab',
            tracksExercises: true,
            hasDifficulty: true
        },
        {
            id: 'sentences',
            label: 'Sentences',
            icon: '✍️',
            indexKey: 'currentSentenceIndex',
            goalKey: 'sentence',
            prevBtnId: 'prevSentence',
            nextBtnId: 'nextSentence',
            statusId: 'sentenceStatus',
            dailyStatKey: 'sentencesCompleted',
            totalStatKey: 'totalSentences',
            avgKey: 'sentences',
            statLabel: 'Sentences',
            totalCardId: 'sentencesCompleted',
            countsInTotalExercises: true,
            contentGlobal: 'sentenceExercises',
            srsType: null,
            tracksExercises: true,
            hasDifficulty: true
        },
        {
            id: 'reading',
            label: 'Reading',
            icon: '📖',
            indexKey: 'currentPassageIndex',
            goalKey: 'reading',
            prevBtnId: 'prevReading',
            nextBtnId: 'nextReading',
            statusId: 'readingStatus',
            dailyStatKey: 'readingCompleted',
            totalStatKey: 'totalReading',
            avgKey: 'reading',
            statLabel: 'Reading',
            totalCardId: 'readingCompleted',
            countsInTotalExercises: true,
            contentGlobal: 'readingPassages',
            srsType: null,
            tracksExercises: true,
            hasDifficulty: true
        },
        {
            id: 'listening',
            label: 'Listening',
            icon: '🎧',
            indexKey: 'currentListeningIndex',
            goalKey: 'listening',
            prevBtnId: 'prevListening',
            nextBtnId: 'nextListening',
            statusId: 'listeningStatus',
            dailyStatKey: 'listeningCompleted',
            totalStatKey: 'totalListening',
            avgKey: 'listening',
            statLabel: 'Listening',
            // Deliberately null, and deliberately NOT quietly fixed here: the
            // dashboard has never had a Listening card, and inventing one would
            // change what every existing learner sees on the very commit that
            // was supposed to change nothing. It appears in all three stat
            // blocks, so the number is not hidden. See US-154.
            totalCardId: null,
            countsInTotalExercises: true,
            contentGlobal: 'listeningExercises',
            srsType: null,
            tracksExercises: true,
            // Deliberately false: this section has no .diff-btn group of its own
            // (it reads state.currentDifficulty, which the other three set).
            // See docs/IMPLEMENTATION_PLAN.md Phase 5 on the `fluent` stubs.
            hasDifficulty: false
        },
        {
            id: 'puzzles',
            label: 'Puzzles',
            icon: '🧩',
            // Puzzles are selected by .puzzle-btn, not walked with prev/next, so
            // there is no index, no nav pair and no completion indicator. The
            // null indexKey is what makes updateNavigationButtons() and
            // updateCompletionIndicator() bail out for puzzles exactly as their
            // old `if (!map[type]) return;` guards did.
            indexKey: null,
            goalKey: 'puzzle',
            prevBtnId: null,
            nextBtnId: null,
            statusId: null,
            dailyStatKey: 'puzzlesSolved',
            totalStatKey: 'totalPuzzles',
            avgKey: 'puzzles',
            statLabel: 'Puzzles',
            totalCardId: 'puzzlesSolved',
            countsInTotalExercises: true,
            // The one two-level map: puzzleData is keyed by puzzle TYPE first
            // and level second, so its probe in app.js looks one layer deeper
            // than the others'.
            contentGlobal: 'puzzleData',
            srsType: null,
            tracksExercises: true,
            hasDifficulty: false
        },
        {
            // US-501/US-149. Appended rather than slotted in after `sentences`
            // where it belongs pedagogically: this list is positional for the
            // Alt+N shortcuts, so inserting mid-list would silently renumber
            // Reading, Listening and Puzzles for every existing learner.
            id: 'grammar',
            label: 'Grammar',
            icon: '📐',
            indexKey: 'currentGrammarIndex',
            goalKey: 'grammar',
            prevBtnId: 'prevGrammar',
            nextBtnId: 'nextGrammar',
            statusId: 'grammarStatus',
            dailyStatKey: 'grammarCompleted',
            totalStatKey: 'totalGrammar',
            avgKey: 'grammar',
            statLabel: 'Grammar',
            totalCardId: 'grammarCompleted',
            countsInTotalExercises: true,
            // The map that broke the old vocabulary-only oracle: content for
            // `foundation`, deliberately empty arrays for the other three tiers.
            contentGlobal: 'grammarLessons',
            // The second section wired to the scheduler: one record per grammar
            // point, keyed 'gram:<lesson id>' (data/grammar.js `srsKey`).
            srsType: 'gram',
            tracksExercises: true,
            hasDifficulty: true
        }
    ];

    const BY_ID = Object.create(null);
    SECTIONS.forEach(function (s) {
        Object.freeze(s);
        BY_ID[s.id] = s;
    });
    Object.freeze(SECTIONS);

    /**
     * id -> loader function, populated by registerRuntime() from app.js.
     *
     * Kept off the (frozen) rows on purpose: the rows are data that can be
     * read before app.js exists, the loaders are behaviour that cannot.
     */
    const LOADERS = Object.create(null);

    /**
     * id -> function(level) -> item count, populated by registerContent() from
     * app.js. See the "WHY CONTENT PROBES ARE NOT IN THE LITERAL EITHER" note at
     * the top of this file for why the accessor cannot live in the row.
     */
    const CONTENT = Object.create(null);

    /** The full row for a nav id, or null. Never throws on junk input. */
    function get(id) {
        return BY_ID[id] || null;
    }

    /** Every row, nav order, including `dashboard`. */
    function all() {
        return SECTIONS.slice();
    }

    /**
     * Every nav id, nav order, including `dashboard`.
     *
     * The Alt+N handler uses ids().length as its ceiling. NOTE: that comparison
     * is a single-character one (`key <= '6'`), so it silently stops working at
     * 10 sections. Nine is the hard limit until someone reworks the handler.
     */
    function ids() {
        return SECTIONS.map(function (s) { return s.id; });
    }

    /** Rows for sections that record completed exercises (excludes dashboard). */
    function exercises() {
        return SECTIONS.filter(function (s) { return s.tracksExercises; });
    }

    /** Their ids — the key set of state.completedExercises. */
    function exerciseIds() {
        return exercises().map(function (s) { return s.id; });
    }

    /** The state.dailyGoals key set, in nav order. */
    function goalKeys() {
        return SECTIONS
            .filter(function (s) { return !!s.goalKey; })
            .map(function (s) { return s.goalKey; });
    }

    /**
     * Every state.* index field, in nav order. Sections without one (dashboard,
     * puzzles) are skipped, so this is safe to use as a "reset position" list.
     */
    function indexKeys() {
        return SECTIONS
            .filter(function (s) { return !!s.indexKey; })
            .map(function (s) { return s.indexKey; });
    }

    /**
     * `{ [row[field]]: 0 }` for every exercise-tracking section, nav order.
     * Used to build state.dailyStats / state.overallStats / averageDaily without
     * restating the five counters three times each.
     */
    function zeroMap(field) {
        const out = {};
        exercises().forEach(function (s) {
            if (s[field]) out[s[field]] = 0;
        });
        return out;
    }

    /**
     * Attach the section loaders. Called exactly once from app.js, after the
     * loader function declarations. Unknown ids and non-functions are reported
     * rather than ignored — a typo here is the one way a section can still be
     * half-registered, so it must be loud.
     */
    function registerRuntime(map) {
        if (!map || typeof map !== 'object') return;
        Object.keys(map).forEach(function (id) {
            const fn = map[id];
            if (!BY_ID[id]) {
                console.warn('Sections.registerRuntime: unknown section "' + id +
                             '" — add a row to js/core/sections.js');
                return;
            }
            if (typeof fn !== 'function') {
                console.warn('Sections.registerRuntime: loader for "' + id +
                             '" is not a function');
                return;
            }
            LOADERS[id] = fn;
        });
    }

    /** The loader for a section, or undefined. Call as `Sections.loader(id)?.()`. */
    function loader(id) {
        return LOADERS[id];
    }

    /**
     * Attach the per-section content probes. Same shape, same loudness and the
     * same once-only call site discipline as registerRuntime(); a probe is
     * `function (levelId) -> number of authored items`.
     */
    function registerContent(map) {
        if (!map || typeof map !== 'object') return;
        Object.keys(map).forEach(function (id) {
            const fn = map[id];
            if (!BY_ID[id]) {
                console.warn('Sections.registerContent: unknown section "' + id +
                             '" — add a row to js/core/sections.js');
                return;
            }
            if (typeof fn !== 'function') {
                console.warn('Sections.registerContent: probe for "' + id +
                             '" is not a function');
                return;
            }
            CONTENT[id] = fn;
        });
    }

    /**
     * True when this section can answer "how much content is at this tier".
     *
     * Callers need this separately from contentCount(): "no probe registered"
     * and "zero items authored" are different facts, and conflating them would
     * make an unregistered section look permanently empty — which is exactly the
     * silent-failure mode this file exists to prevent. `dashboard` has no probe
     * because it has no content.
     */
    function knowsContent(id) {
        return typeof CONTENT[id] === 'function';
    }

    /**
     * Authored item count for `level` in this section's own content, or -1 when
     * the section has no probe. Never throws: a probe that blows up on a junk
     * level (or on a content file that failed to load) counts as zero, because
     * an availability question must not be able to take a section down.
     */
    function contentCount(id, level) {
        const probe = CONTENT[id];
        if (typeof probe !== 'function') return -1;
        let n;
        try {
            n = probe(level);
        } catch (e) {
            console.warn('Sections.contentCount: probe for "' + id + '" threw', e);
            return 0;
        }
        return (typeof n === 'number' && isFinite(n) && n > 0) ? n : 0;
    }

    /** True when this section has at least one authored item at `level`. */
    function hasContent(id, level) {
        return contentCount(id, level) > 0;
    }

    const Sections = {
        SECTIONS: SECTIONS,
        get: get,
        all: all,
        ids: ids,
        exercises: exercises,
        exerciseIds: exerciseIds,
        goalKeys: goalKeys,
        indexKeys: indexKeys,
        zeroMap: zeroMap,
        registerRuntime: registerRuntime,
        loader: loader,
        registerContent: registerContent,
        knowsContent: knowsContent,
        contentCount: contentCount,
        hasContent: hasContent
    };

    global.Sections = Sections;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Sections;
    }
})(typeof window !== 'undefined' ? window : globalThis);
