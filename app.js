
// English Learning Portal - Main Application
// Integrated with Free Dictionary API and Web Speech API
// With Offline Fallback Support

// ============================================
// CONFIGURATION & STATE MANAGEMENT
// ============================================

const CONFIG = {
    dictionaryAPI: 'https://api.dictionaryapi.dev/api/v2/entries/en/',
    cacheDuration: 24 * 60 * 60 * 1000,
    offlineMode: false,
    useAPIFirst: true
};

// ============================================
// SECTION REGISTRY
// ============================================
//
// js/core/sections.js owns every per-section fact (nav id, index field, button
// ids, status element, stat keys, goal key). Everything below reads it instead
// of restating the section list, so adding a section is a row there plus markup
// plus one line in the registerRuntime() block near the loaders.
//
// There is deliberately NO `typeof Sections === 'undefined'` fallback here, and
// no degraded mode. levels.js gets one because a bad level id has a sane
// substitute; a missing section registry has none — every section, counter and
// shortcut is defined by it. If the <script> tag is missing this throws
// immediately on the next line, which is the correct, loud outcome.
// __tests__/unit/assets.test.js and __tests__/unit/sections.test.js exist so
// that never reaches a learner.

/** `{ vocabulary: new Set(), ... }` — one Set per exercise-tracking section. */
function freshCompletedExercises() {
    const sets = {};
    Sections.exerciseIds().forEach(id => { sets[id] = new Set(); });
    return sets;
}

/** `{ vocab: false, ... }` — one flag per section that has a daily goal. */
function freshDailyGoals() {
    const goals = {};
    Sections.goalKeys().forEach(key => { goals[key] = false; });
    return goals;
}

const state = {
    currentSection: 'dashboard',
    currentDifficulty: 'foundation',
    currentWordIndex: 0,
    currentSentenceIndex: 0,
    currentPassageIndex: 0,
    currentListeningIndex: 0,
    currentGrammarIndex: 0,
    currentPronunciationIndex: 0,
    currentPuzzle: 'wordsearch',
    vocabProgress: 0,
    // Legacy counters kept for backwards-compatible loading of old saves only.
    // Not authoritative: see state.dailyStats / state.overallStats.
    stats: {
        wordsLearned: 0,
        sentencesCompleted: 0,
        readingCompleted: 0,
        puzzlesSolved: 0
    },
    dailyGoals: freshDailyGoals(),
    sentenceBuilderWords: [],
    sentenceAttempts: 0,
    sentenceHintUsed: false,
    // Spaced-repetition review state
    reviewMode: false,
    reviewQueue: [],
    currentVocabWord: null,
    // Enhanced progress tracking
    completedExercises: freshCompletedExercises(),
    exerciseHistory: [],
    /**
     * Per-phoneme-pair discrimination accuracy — FR-PRN-2.
     *
     *     { 'phon:iː-ɪ': { attempts: 12, correct: 10 }, ... }
     *
     * Keyed by the SAME key as the pair's SRS record, on purpose: FR-PRN-6 gates
     * the production task on ~80% accuracy for that pair, and the gate has to be
     * able to find the counter from the pair.
     *
     * Kept here rather than on the SRS record because an SRS record cannot answer
     * "out of how many". `reps` resets to 0 on every lapse and `lapses` counts
     * only failures, so attempts are not recoverable from a record — deriving an
     * accuracy from them would be a made-up number, which is exactly what
     * TEACHING_METHODOLOGY.md principle 3 forbids. srs.js also projects `data`
     * through PROJECTORS.phon, so a counter smuggled in there would be silently
     * dropped anyway.
     *
     * Only the AUDIO discrimination drill writes here. The text-only fallback is
     * graded and useful, but it tests which vowel a word contains, not whether
     * the learner can hear the contrast — feeding it in would open the FR-PRN-6
     * gate for a learner who has never heard the difference, which is the exact
     * perception blind spot the gate exists to close (PROGRESS.md §6.aa).
     */
    pronunciationAccuracy: {},
    generatedExercises: {
        sentences: [],
        reading: [],
        listening: []
    },
    // Daily and overall statistics.
    //
    // Object.assign rather than a spread of literals so the five per-section
    // counters come from the registry while the fields that are NOT per-section
    // (date, timeSpent, streak, totalDays, bestStreak, currentStreak) stay
    // visible and hand-written. Key order is unchanged from the old literals.
    dailyStats: Object.assign(
        { date: new Date().toDateString() },
        Sections.zeroMap('dailyStatKey'),
        { timeSpent: 0, streak: 0 }
    ),
    overallStats: Object.assign(
        { totalDays: 0 },
        Sections.zeroMap('totalStatKey'),
        {
            bestStreak: 0,
            currentStreak: 0,
            averageDaily: Sections.zeroMap('avgKey')
        }
    ),
    dailyHistory: []
};

// ============================================
// LEVEL RESOLUTION
// ============================================
//
// js/core/levels.js owns the canonical tier ids (foundation / everyday /
// confident / fluent) and data.js now keys ALL of its content by those same
// ids, so state.currentDifficulty holds a canonical id and the legacy
// canonical->data-key bridge that used to live here is gone.
//
// What has NOT gone is the normalisation. resolveDifficulty() still runs every
// level-ish value through canonicalLevel() — which never returns undefined —
// because a corrupted localStorage value, a data-level typo or a stale value
// from an old release would otherwise produce vocabularyData[undefined] and
// take a whole section down. Legacy stored values ('basic', 'medium') are
// handled by LEVEL_ALIASES, which is kept permanently for exactly this reason.
//
// It also still checks that content EXISTS behind the resolved id. That is what
// makes the `fluent` tier safe: `fluent` is a real, canonical, first-class level
// with no authored content yet, so it resolves DOWN to the nearest lower tier
// that does have content (confident) instead of rendering an empty section. See
// the disabled "Fluent" buttons in index.html.

// vocabularyData used to be the oracle for every section, on the grounds that it
// was the widest content map and every other map used the same key set. That was
// true until `grammarLessons` shipped: it has content for `foundation` and
// deliberately EMPTY arrays for the other three tiers, so "Everyday is
// available" was simultaneously true (per vocabulary) and false (per grammar).
// The visible symptom was that the grammar loader had to grow its own local
// resolveGrammarLevel(); the invisible one was statistics counting the same
// grammar point twice (US-152).
//
// So availability is now asked of a SECTION, and each section names its own
// content map in js/core/sections.js (`contentGlobal`) with the accessor
// registered from the registerContent() block near the bottom of this file.

/**
 * Does `key` have authored content?
 *
 * With `sectionId`, the question is answered against that section's own content.
 * Without it, the question is app-wide — "does ANY learning section have
 * something at this tier" — because the callers with no section to name are the
 * ones acting on state.currentDifficulty, which is one app-wide setting shared
 * by every section, and on the .diff-btn selectors that paint it. Disabling a
 * shared, app-wide button per section would be incoherent: clicking Foundation
 * inside Grammar also moves Vocabulary.
 *
 * For the content shipping today the union answers identically to the old
 * vocabularyData probe (vocabulary is still the widest map). It is written as a
 * union so that it stays honest when that stops being true.
 */
function hasContentForLevel(key, sectionId) {
    if (typeof key !== 'string' || key.length === 0) return false;

    if (sectionId && Sections.knowsContent(sectionId)) {
        return Sections.hasContent(sectionId, key);
    }

    const probed = Sections.exerciseIds().filter(id => Sections.knowsContent(id));
    if (probed.length === 0) {
        // registerContent() has not run (a script-order or partial-parse
        // mistake). Degrade to the pre-US-153 probe rather than report every
        // tier empty, which would leave the learner with no selectable level.
        return typeof vocabularyData !== 'undefined' && !!vocabularyData &&
               Object.prototype.hasOwnProperty.call(vocabularyData, key);
    }
    return probed.some(id => Sections.hasContent(id, key));
}

// The tiers that actually have content behind them, in ascending order. Derived
// from levels.js rather than hardcoded, so authoring `fluent` content is the
// only step needed to make the tier live. Scoped to one section when asked.
function playableLevels(sectionId) {
    if (typeof LEVELS === 'undefined' || !Array.isArray(LEVELS)) return [];
    return LEVELS.slice()
        .sort((a, b) => a.order - b.order)
        .map(l => l.id)
        .filter(id => hasContentForLevel(id, sectionId));
}

/** True when this tier is a real level with no authored content yet. */
function isLevelAvailable(value, sectionId) {
    if (typeof canonicalLevel !== 'function') return hasContentForLevel(value, sectionId);
    return hasContentForLevel(canonicalLevel(value), sectionId);
}

/**
 * The tier whose content the learner will actually be shown.
 *
 * `sectionId` is optional and additive: omitting it keeps the exact pre-US-153
 * contract (app-wide availability), which is what the three existing callers —
 * two normalisations of state.currentDifficulty and the .diff-btn handler —
 * want, since all three are about the single shared setting rather than about
 * one section's content. Passing it answers for that section alone, which is
 * what the grammar loader needs and what makes exercise ids honest (US-152).
 */
function resolveDifficulty(value, sectionId) {
    // Guard for levels.js being absent (script-order mistake). Degrade to the
    // previous behaviour of trusting the value, but still never hand back a key
    // that has no content behind it.
    if (typeof canonicalLevel !== 'function') {
        return hasContentForLevel(value, sectionId) ? value : 'foundation';
    }

    const canonical = canonicalLevel(value);
    if (hasContentForLevel(canonical, sectionId)) return canonical;

    // No content for this tier. Step DOWN to the nearest lower tier that has
    // some — easier content the learner can still use beats an empty screen,
    // and stepping down never shows them something above the level they asked
    // for. Only if nothing lower exists do we step up.
    const playable = playableLevels(sectionId);
    const wanted = (typeof LEVELS !== 'undefined' && Array.isArray(LEVELS))
        ? (LEVELS.find(l => l.id === canonical) || {}).order
        : undefined;

    if (typeof wanted === 'number' && playable.length > 0) {
        const orderOf = id => (LEVELS.find(l => l.id === id) || {}).order || 0;
        const lower = playable.filter(id => orderOf(id) < wanted);
        if (lower.length > 0) return lower[lower.length - 1];
        return playable[0];
    }

    if (hasContentForLevel(DEFAULT_LEVEL, sectionId)) return DEFAULT_LEVEL;
    return playable[0] || 'foundation';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const cache = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
        } catch (e) {
            AppErrorHandler.logError(e, 'cache operation');
        }
    },
    get: (key) => {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;
            const parsed = JSON.parse(item);
            if (Date.now() - parsed.timestamp > CONFIG.cacheDuration) {
                localStorage.removeItem(key);
                return null;
            }
            return parsed.value;
        } catch (e) { return null; }
    }
};

function saveProgress() {
    // A restore (js/core/portability.js) has replaced `learningProgress` on disk
    // but `state` still holds the pre-import data until the page reloads. The
    // 30-second autosave below would otherwise write that stale state straight
    // over the restored record and silently undo the restore. Fail closed:
    // between a successful import and the reload, nobody writes progress.
    if (typeof Portability !== 'undefined' && Portability &&
        typeof Portability.writesSuspended === 'function' &&
        Portability.writesSuspended()) {
        return;
    }
    try {
        const toSave = {
            ...state,
            // Stamp the schema version on every write so a later save cannot
            // silently un-version data that loadProgress() already migrated,
            // which would make the migration chain re-run on every load.
            //
            // Never stamp DOWNWARDS. If this record was written by a newer
            // release, state.schemaVersion holds that higher number and we must
            // preserve it: migrateProgress() deliberately leaves a future
            // version alone, and stamping SCHEMA_VERSION here would undo that
            // on the very next save, relabelling newer-shaped data as current.
            schemaVersion: Math.max(
                Number(state.schemaVersion) || 0,
                typeof Migrations !== 'undefined' && Migrations
                    ? Migrations.SCHEMA_VERSION
                    : 0
            ) || undefined,
            // Sets are not JSON-serialisable, so every tracked section's Set
            // becomes an array. Driven by the registry so a new section cannot
            // be saved-but-not-loaded (or vice versa) — see loadProgress().
            completedExercises: Sections.exerciseIds().reduce((out, id) => {
                out[id] = Array.from(state.completedExercises[id]);
                return out;
            }, {})
        };
        localStorage.setItem('learningProgress', JSON.stringify(toSave));
    } catch (e) {
        AppErrorHandler.logError(e, 'save progress');
    }
}

/**
 * Bring a parsed `learningProgress` object up to the current schema version
 * before anything is merged into `state`, so state only ever sees current-shape
 * data.
 *
 * Fails soft in three ways, because a throwing loadProgress() bricks the whole
 * app while stale-but-readable data costs the learner nothing:
 *   - js/core/migrations.js missing (script-order mistake) -> pass through
 *   - migration throws -> log and use the data as-is
 *   - backup write fails (quota / private mode) -> backupOnce() returns false
 *     and the migration still proceeds, since it is idempotent
 */
function migrateStoredProgress(loaded) {
    if (!loaded || typeof loaded !== 'object') return loaded;
    if (typeof Migrations === 'undefined' || !Migrations) return loaded;

    try {
        const from = Number(loaded.schemaVersion) || 1;
        // Nothing to do on a second load: the stamp is already current, so skip
        // both the backup and the rewrite. This is what makes the whole call
        // site idempotent, not just Migrations.migrateProgress() itself.
        const alreadyStamped = loaded.schemaVersion === Migrations.SCHEMA_VERSION;

        if (!alreadyStamped) {
            // Copy the pristine record aside BEFORE the rewrite below. This is
            // the manual recovery path if a migration turns out to be wrong in
            // the field; backupOnce never overwrites an existing backup.
            Migrations.backupOnce(Migrations.PROGRESS_KEY, from);
        }

        const migrated = Migrations.migrateProgress(loaded);

        if (!alreadyStamped) {
            // Persist the migrated record so the chain runs once rather than on
            // every load. Written directly rather than via saveProgress() so
            // that fields state does not track survive untouched.
            localStorage.setItem(Migrations.PROGRESS_KEY, JSON.stringify(migrated));
        }

        return migrated;
    } catch (e) {
        AppErrorHandler.logError(e, 'migrate progress');
        return loaded;
    }
}

function loadProgress() {
    try {
        // Normalise the level id before anything reads it, so nothing downstream
        // can index a content map with a value levels.js does not recognise.
        state.currentDifficulty = resolveDifficulty(state.currentDifficulty);

        const saved = localStorage.getItem('learningProgress');
        if (saved) {
            const loaded = migrateStoredProgress(JSON.parse(saved));
            if (loaded && loaded.schemaVersion) {
                state.schemaVersion = loaded.schemaVersion;
            }
            // Restore the selected tier. It has always been SAVED and never read
            // back, so every reload silently dropped the learner to Foundation.
            // Safe to restore now that initializeDifficultySelectors() syncs the
            // visible buttons from state instead of hardcoding the first one
            // active — without that sync, restoring here would show Confident
            // content under a highlighted "Foundation" button.
            state.currentDifficulty = resolveDifficulty(
                loaded.currentDifficulty !== undefined ? loaded.currentDifficulty : state.currentDifficulty
            );
            // Legacy counters: kept only so old saves keep loading. They are no longer
            // authoritative and are not displayed anywhere - state.dailyStats and
            // state.overallStats (written by updateStatistics) are the source of truth.
            Object.assign(state.stats, loaded.stats || {});
            Object.assign(state.dailyGoals, loaded.dailyGoals || {});
            // Where the learner was in each section. Registry-driven so a new
            // section's position is restored without a fifth near-identical line.
            Sections.indexKeys().forEach(key => {
                state[key] = loaded[key] || 0;
            });
            state.exerciseHistory = loaded.exerciseHistory || [];

            // Per-pair discrimination accuracy (FR-PRN-2). Sanitised rather than
            // trusted: it is the input to the FR-PRN-6 production gate, so a
            // corrupt or hand-edited record must not be able to unlock a task by
            // claiming `correct: 999`. Records written before US-401 simply have
            // no such field, which reads as "no attempts yet" — correct.
            state.pronunciationAccuracy = sanitizePronunciationAccuracy(
                loaded.pronunciationAccuracy
            );
            
            // Restore completed exercises sets
            if (loaded.completedExercises) {
                Sections.exerciseIds().forEach(id => {
                    state.completedExercises[id] = new Set(loaded.completedExercises[id] || []);
                });
            }
            
            // Load daily and overall stats
            if (loaded.dailyStats) {
                // Check if it's a new day
                const today = new Date().toDateString();
                if (loaded.dailyStats.date === today) {
                    Object.assign(state.dailyStats, loaded.dailyStats);
                } else {
                    // New day - save yesterday's stats and reset
                    if (loaded.dailyHistory) {
                        state.dailyHistory = loaded.dailyHistory;
                    }
                    state.dailyHistory.push(loaded.dailyStats);
                    resetDailyStats();
                    updateStreak(loaded.dailyStats.date);
                }
            }
            
            if (loaded.overallStats) {
                Object.assign(state.overallStats, loaded.overallStats);
            }
            
            if (loaded.dailyHistory) {
                state.dailyHistory = loaded.dailyHistory;
            }
            
            calculateAverages();
            updateDashboard();
        }
    } catch (e) {
        AppErrorHandler.logError(e, 'load progress');
    }
}

// Reset daily stats for new day
function resetDailyStats() {
    // Same shape and same key order as the state.dailyStats literal, with one
    // pre-existing difference preserved deliberately: `streak` is NOT reset here
    // (it never was), because state.overallStats.currentStreak is the real
    // streak and state.dailyStats.streak is a vestigial field nothing reads.
    state.dailyStats = Object.assign(
        { date: new Date().toDateString() },
        Sections.zeroMap('dailyStatKey'),
        { timeSpent: 0 }
    );
}

// Update streak
function updateStreak(lastDate) {
    const today = new Date();
    const last = new Date(lastDate);
    const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        // Consecutive day
        state.overallStats.currentStreak++;
        if (state.overallStats.currentStreak > state.overallStats.bestStreak) {
            state.overallStats.bestStreak = state.overallStats.currentStreak;
        }
    } else if (diffDays > 1) {
        // Streak broken
        state.overallStats.currentStreak = 1;
    }
}

// Calculate averages
function calculateAverages() {
    const totalDays = state.dailyHistory.length + 1; // +1 for today
    state.overallStats.totalDays = totalDays;
    
    if (totalDays > 0) {
        Sections.exercises().forEach(section => {
            state.overallStats.averageDaily[section.avgKey] =
                Math.round(state.overallStats[section.totalStatKey] / totalDays);
        });
    }
}

// Update statistics when completing exercises
function updateStatistics(type) {
    // This used to be a `switch` with one `case` per section and, for a long
    // time, no `default` at all — so a section missing a case rendered perfectly
    // and counted nothing. The registry removes the possibility rather than the
    // symptom: any section that exists has both counter keys, and any `type`
    // that is not a section cannot reach the counters.
    const section = Sections.get(type);
    if (!section || !section.dailyStatKey || !section.totalStatKey) {
        // Reachable only from a caller typo or a section row missing its counter
        // keys, both of which are programmer errors, not learner-facing failures
        // — hence console.warn rather than AppErrorHandler.logError, which is for
        // thrown Errors and writes to the sessionStorage error log.
        console.warn(`updateStatistics: unknown type "${type}" — nothing counted`);
        return;
    }

    state.dailyStats[section.dailyStatKey]++;
    state.overallStats[section.totalStatKey]++;

    calculateAverages();
    saveProgress();
}

// Exercise ID generator
function getExerciseId(type, index, difficulty) {
    return `${type}_${difficulty}_${index}`;
}

/**
 * The level an exercise id is stamped with — US-152.
 *
 * The three helpers below used to read `state.currentDifficulty` themselves.
 * That is wrong for any section whose content does not cover every tier: with
 * grammar authored only for `foundation`, selecting Everyday shows the very same
 * Foundation point (renderGrammarTeaching says so out loud), yet completing it
 * stored `grammar_everyday_0` alongside `grammar_foundation_0` and
 * updateStatistics counted it a second time. One point, two ✓s, two increments
 * to `totalGrammar` — and those counters now feed the dashboard.
 *
 * The level therefore has to come from the section's CONTENT, not from the
 * global button state: `resolveDifficulty(state.currentDifficulty, type)` is
 * exactly the tier the section is showing, so both selected tiers now stamp
 * `grammar_foundation_0` and the point counts once.
 *
 * WHY AN OPTIONAL PARAMETER AND NOT A SIGNATURE CHANGE
 * These helpers are shared by all six exercise sections. Changing their contract
 * would mean editing every call site in five sections I have no reason to touch,
 * and any call site missed would silently read `undefined` and stamp ids like
 * `sentences_undefined_3` — a data-corrupting failure that renders perfectly.
 * The added third parameter is therefore optional, and OMITTING it is the
 * correct call for every existing caller: the derived default is identical to
 * the old `state.currentDifficulty` for any section whose content covers the
 * selected tier, which is all five of the others at every tier a learner can
 * select. Grammar's own call sites pass the level explicitly anyway, so the
 * stored id and the ✓ indicator cannot drift apart even if the derivation
 * changes later.
 *
 * WHY NOT FIX THIS INSIDE THE GRAMMAR LOADER
 * Because the loader is not the only reader. updateNavigationButtons() ->
 * isExerciseCompleted() paints the ✓, retakeExercise() clears it, and
 * markExerciseComplete() writes it. Correcting the level in one of them desyncs
 * the indicator from what is stored, which is worse than counting twice.
 */
function exerciseLevel(type, level) {
    if (level) {
        return typeof canonicalLevel === 'function' ? canonicalLevel(level) : level;
    }
    return resolveDifficulty(state.currentDifficulty, type);
}

// Mark exercise as complete
function markExerciseComplete(type, index, level) {
    const difficulty = exerciseLevel(type, level);
    const id = getExerciseId(type, index, difficulty);
    state.completedExercises[type].add(id);
    state.exerciseHistory.push({
        type,
        index,
        // The tier whose content was actually practised, which is what `id`
        // encodes. Recording the selected button instead would leave history
        // disagreeing with the id sitting next to it in the same record.
        difficulty,
        timestamp: Date.now(),
        id
    });
    saveProgress();
    updateNavigationButtons(type);
}

// Check if exercise is completed
function isExerciseCompleted(type, index, level) {
    const id = getExerciseId(type, index, exerciseLevel(type, level));
    return state.completedExercises[type].has(id);
}

// Retake exercise
function retakeExercise(type, index, level) {
    const id = getExerciseId(type, index, exerciseLevel(type, level));
    state.completedExercises[type].delete(id);
    saveProgress();
    updateNavigationButtons(type);
}

// Hybrid sentence generation: Combines curated data with algorithmic generation
function generateSentenceExercise(index) {
    const difficulty = state.currentDifficulty;
    
    // First, check if we have curated sentences from data.js
    const curatedExercises = sentenceExercises[difficulty] || [];
    const curatedCount = curatedExercises.length;
    
    // Strategy: Use curated sentences first, then alternate between curated and generated
    // Pattern: C C C C C G C G C G C G... (where C=Curated, G=Generated)
    // This ensures users see quality curated content mixed with unlimited variety
    
    if (index < curatedCount) {
        // Use curated sentences for first N exercises
        return curatedExercises[index];
    }
    
    // After curated sentences, alternate: every 2nd sentence is curated (cycling), others are generated
    const adjustedIndex = index - curatedCount;
    const shouldUseCurated = adjustedIndex % 3 === 0; // Every 3rd sentence uses curated (cycling)
    
    if (shouldUseCurated && curatedCount > 0) {
        // Cycle through curated sentences
        return curatedExercises[adjustedIndex % curatedCount];
    }
    
    // Generate new sentence using templates
    return generateAlgorithmicSentence(index, difficulty);
}

// Algorithmic sentence generation with multiple templates
function generateAlgorithmicSentence(index, difficulty) {
    // Multiple sentence templates for variety
    const sentenceTemplates = {
        foundation: [
            // Template 1: Subject + Verb + Adverb + Place (50 words each = 6.25M combinations)
            (i) => {
                const subjects = ["The cat", "My dog", "The bird", "A child", "The teacher", "My friend", "The rabbit", "A butterfly", "The fish", "My sister", "The puppy", "A kitten", "The mouse", "My cousin", "The baby", "A squirrel", "The horse", "My brother", "The duck", "A turtle", "The frog", "A spider", "The bee", "My neighbor", "The ant", "A ladybug", "The owl", "My classmate", "The fox", "A deer", "The bear", "My pet", "The lion", "A tiger", "The elephant", "My uncle", "The monkey", "A panda", "The zebra", "My aunt", "The giraffe", "A kangaroo", "The penguin", "My grandma", "The dolphin", "A whale", "The seal", "My grandpa", "The otter", "A raccoon"];
                const verbs = ["runs", "jumps", "plays", "walks", "dances", "swims", "flies", "hops", "climbs", "skips", "moves", "travels", "wanders", "explores", "rushes", "strolls", "marches", "glides", "bounces", "races", "jogs", "sprints", "trots", "gallops", "crawls", "slides", "rolls", "spins", "twirls", "leaps", "dives", "soars", "floats", "drifts", "sways", "wobbles", "shuffles", "struts", "prances", "scampers", "darts", "zooms", "speeds", "hurries", "ambles", "meanders", "roams", "ventures", "proceeds", "advances"];
                const adverbs = ["quickly", "happily", "quietly", "slowly", "carefully", "gracefully", "eagerly", "gently", "freely", "lightly", "swiftly", "smoothly", "steadily", "rapidly", "briskly", "lazily", "calmly", "peacefully", "joyfully", "cheerfully", "merrily", "playfully", "energetically", "vigorously", "actively", "busily", "diligently", "patiently", "cautiously", "nervously", "confidently", "boldly", "bravely", "timidly", "shyly", "proudly", "humbly", "politely", "kindly", "warmly", "tenderly", "lovingly", "sweetly", "softly", "silently", "noisily", "loudly", "wildly", "crazily", "madly"];
                const places = ["in the park", "at home", "in the garden", "at school", "by the river", "in the forest", "by the lake", "on the hill", "at the beach", "in the city", "near the pond", "at the zoo", "in the meadow", "by the stream", "on the mountain", "at the farm", "in the valley", "by the ocean", "on the island", "at the village", "in the jungle", "by the waterfall", "on the bridge", "at the harbor", "in the desert", "by the canyon", "on the plateau", "at the oasis", "in the woods", "by the creek", "on the cliff", "at the shore", "in the field", "by the bay", "on the path", "at the trail", "in the clearing", "by the marsh", "on the ridge", "at the summit", "in the grove", "by the inlet", "on the slope", "at the peak", "in the thicket", "by the rapids", "on the terrace", "at the lookout", "in the sanctuary", "by the estuary"];
                return `${subjects[i % 50]} ${verbs[Math.floor(i/50) % 50]} ${adverbs[Math.floor(i/2500) % 50]} ${places[Math.floor(i/125000) % 50]}`;
            },
            // Template 2: Subject + Verb + Object + Time (50 words each = 6.25M combinations)
            (i) => {
                const subjects = ["The sun", "The moon", "A student", "The flower", "The baby", "A squirrel", "The horse", "My brother", "The duck", "A turtle", "The star", "A cloud", "The tree", "My sister", "The plant", "A seed", "The grass", "My friend", "The rose", "A daisy", "The lily", "My cousin", "The tulip", "A sunflower", "The orchid", "My classmate", "The blossom", "A petal", "The leaf", "My neighbor", "The branch", "A twig", "The root", "My teacher", "The stem", "A bud", "The vine", "My parent", "The shrub", "A bush", "The hedge", "My sibling", "The garden", "A lawn", "The meadow", "My relative", "The field", "A pasture", "The prairie", "My companion"];
                const verbs = ["shines", "grows", "sleeps", "eats", "rests", "works", "studies", "learns", "teaches", "watches", "blooms", "flourishes", "thrives", "develops", "matures", "expands", "rises", "sets", "glows", "sparkles", "twinkles", "radiates", "beams", "illuminates", "brightens", "warms", "heats", "cools", "refreshes", "nourishes", "feeds", "sustains", "supports", "strengthens", "energizes", "revitalizes", "rejuvenates", "renews", "restores", "heals", "soothes", "comforts", "relaxes", "calms", "quiets", "settles", "stabilizes", "balances", "harmonizes", "unifies"];
                const objects = ["brightly", "beautifully", "peacefully", "warmly", "kindly", "proudly", "sweetly", "calmly", "wisely", "safely", "gently", "softly", "quietly", "loudly", "clearly", "vividly", "brilliantly", "magnificently", "splendidly", "wonderfully", "marvelously", "gloriously", "radiantly", "luminously", "dazzlingly", "stunningly", "impressively", "remarkably", "notably", "significantly", "considerably", "substantially", "greatly", "immensely", "tremendously", "enormously", "vastly", "hugely", "massively", "extensively", "broadly", "widely", "fully", "completely", "totally", "entirely", "wholly", "absolutely", "perfectly", "flawlessly"];
                const times = ["every morning", "at night", "during the day", "in the evening", "at dawn", "at sunset", "all day long", "throughout the year", "in springtime", "during winter", "in summer", "during autumn", "at noon", "at midnight", "in the afternoon", "during twilight", "at dusk", "throughout the season", "in the fall", "during harvest", "at sunrise", "throughout the month", "in January", "during February", "at Easter", "throughout December", "in the weekend", "during holidays", "at Christmas", "throughout vacation", "in the morning", "during breakfast", "at lunchtime", "throughout dinner", "in the daytime", "during nighttime", "at bedtime", "throughout naptime", "in the early hours", "during late hours", "at prime time", "throughout rush hour", "in the quiet hours", "during peak season", "at off-peak times", "throughout busy periods", "in leisure time", "during work hours", "at closing time", "throughout opening hours"];
                return `${subjects[i % 50]} ${verbs[Math.floor(i/50) % 50]} ${objects[Math.floor(i/2500) % 50]} ${times[Math.floor(i/125000) % 50]}`;
            },
            // Template 3: Subject + Verb + Adjective + Noun (50 words each = 6.25M combinations)
            (i) => {
                const subjects = ["The children", "My friends", "The students", "The birds", "The flowers", "The trees", "The clouds", "The stars", "The animals", "The people", "The kids", "My family", "The learners", "The butterflies", "The plants", "The forests", "The skies", "The planets", "The creatures", "The citizens", "The toddlers", "My relatives", "The pupils", "The insects", "The gardens", "The mountains", "The heavens", "The galaxies", "The beings", "The residents", "The youngsters", "My neighbors", "The scholars", "The bees", "The orchards", "The hills", "The atmospheres", "The universes", "The organisms", "The inhabitants", "The teenagers", "My colleagues", "The apprentices", "The ants", "The farms", "The valleys", "The spaces", "The worlds", "The species", "The communities"];
                const verbs = ["love", "enjoy", "appreciate", "admire", "explore", "discover", "create", "build", "share", "celebrate", "cherish", "treasure", "value", "embrace", "welcome", "accept", "respect", "honor", "praise", "recognize", "acknowledge", "understand", "comprehend", "grasp", "realize", "perceive", "observe", "notice", "see", "witness", "experience", "feel", "sense", "detect", "identify", "find", "locate", "seek", "search", "hunt", "pursue", "chase", "follow", "track", "trace", "investigate", "examine", "study", "analyze", "evaluate"];
                const adjectives = ["beautiful", "wonderful", "amazing", "exciting", "interesting", "colorful", "peaceful", "joyful", "special", "magical", "fantastic", "incredible", "spectacular", "magnificent", "splendid", "gorgeous", "stunning", "breathtaking", "remarkable", "extraordinary", "exceptional", "outstanding", "superb", "excellent", "marvelous", "fabulous", "terrific", "awesome", "brilliant", "dazzling", "radiant", "glorious", "delightful", "charming", "lovely", "pleasant", "enjoyable", "entertaining", "fascinating", "captivating", "enchanting", "mesmerizing", "intriguing", "compelling", "engaging", "absorbing", "gripping", "thrilling", "exhilarating", "electrifying"];
                const nouns = ["moments", "experiences", "adventures", "stories", "memories", "places", "activities", "games", "songs", "dreams", "times", "occasions", "events", "happenings", "incidents", "episodes", "chapters", "periods", "phases", "stages", "journeys", "trips", "voyages", "expeditions", "quests", "missions", "ventures", "undertakings", "endeavors", "pursuits", "projects", "tasks", "assignments", "challenges", "opportunities", "possibilities", "prospects", "chances", "options", "choices", "selections", "preferences", "favorites", "treasures", "gems", "jewels", "prizes", "rewards", "gifts", "blessings"];
                return `${subjects[i % 50]} ${verbs[Math.floor(i/50) % 50]} ${adjectives[Math.floor(i/2500) % 50]} ${nouns[Math.floor(i/125000) % 50]}`;
            },
            // Template 4: Time + Subject + Verb + Place (50 words each = 6.25M combinations)
            (i) => {
                const times = ["Every day", "Sometimes", "Often", "Usually", "Always", "Frequently", "Occasionally", "Regularly", "Daily", "Weekly", "Monthly", "Yearly", "Annually", "Seasonally", "Periodically", "Constantly", "Continuously", "Repeatedly", "Routinely", "Habitually", "Typically", "Normally", "Generally", "Commonly", "Ordinarily", "Customarily", "Traditionally", "Conventionally", "Standardly", "Universally", "Consistently", "Steadily", "Reliably", "Dependably", "Predictably", "Unfailingly", "Invariably", "Perpetually", "Endlessly", "Ceaselessly", "Incessantly", "Unceasingly", "Unremittingly", "Persistently", "Continually", "Eternally", "Everlastingly", "Permanently", "Forever", "Indefinitely"];
                const subjects = ["we", "they", "people", "students", "children", "friends", "families", "teachers", "neighbors", "visitors", "folks", "individuals", "persons", "learners", "kids", "companions", "relatives", "educators", "residents", "guests", "citizens", "members", "participants", "attendees", "observers", "spectators", "audiences", "crowds", "groups", "teams", "classes", "communities", "societies", "populations", "generations", "youngsters", "adults", "seniors", "elders", "youth", "teenagers", "toddlers", "infants", "babies", "colleagues", "coworkers", "partners", "associates", "peers", "classmates"];
                const verbs = ["meet", "gather", "play", "work", "study", "practice", "exercise", "relax", "chat", "laugh", "talk", "discuss", "converse", "communicate", "interact", "socialize", "mingle", "network", "connect", "bond", "unite", "join", "assemble", "congregate", "convene", "collaborate", "cooperate", "coordinate", "organize", "arrange", "plan", "prepare", "train", "rehearse", "perform", "present", "demonstrate", "show", "display", "exhibit", "share", "exchange", "trade", "swap", "give", "receive", "offer", "provide", "supply", "deliver"];
                const places = ["in the library", "at the playground", "in the classroom", "at the gym", "in the cafeteria", "at the museum", "in the auditorium", "at the stadium", "in the laboratory", "at the workshop", "in the theater", "at the arena", "in the hall", "at the center", "in the studio", "at the gallery", "in the office", "at the clinic", "in the hospital", "at the store", "in the mall", "at the market", "in the plaza", "at the square", "in the courtyard", "at the pavilion", "in the lobby", "at the foyer", "in the lounge", "at the terrace", "in the balcony", "at the rooftop", "in the basement", "at the attic", "in the garage", "at the shed", "in the barn", "at the stable", "in the kennel", "at the coop", "in the pen", "at the enclosure", "in the compound", "at the complex", "in the facility", "at the venue", "in the location", "at the site", "in the spot", "at the destination"];
                return `${times[i % 50]} ${subjects[Math.floor(i/50) % 50]} ${verbs[Math.floor(i/2500) % 50]} ${places[Math.floor(i/125000) % 50]}`;
            },
            // Template 5: Subject + Can + Verb + Object + Place (50 words each = 6.25M combinations)
            (i) => {
                const subjects = ["I", "You", "We", "She", "He", "They", "Everyone", "Someone", "Anyone", "Nobody", "Somebody", "Anybody", "One", "People", "Folks", "Individuals", "Students", "Children", "Adults", "Teachers", "Friends", "Family", "Neighbors", "Visitors", "Guests", "Citizens", "Members", "Participants", "Observers", "Learners", "Scholars", "Experts", "Professionals", "Specialists", "Practitioners", "Workers", "Employees", "Staff", "Personnel", "Crew", "Team", "Group", "Class", "Community", "Society", "Population", "Generation", "Youth", "Seniors", "Elders"];
                const verbs = ["see", "hear", "feel", "smell", "taste", "touch", "sense", "notice", "observe", "perceive", "detect", "recognize", "identify", "spot", "find", "discover", "locate", "pinpoint", "distinguish", "discern", "understand", "comprehend", "grasp", "realize", "appreciate", "value", "enjoy", "experience", "witness", "watch", "view", "behold", "glimpse", "spy", "catch", "note", "mark", "register", "record", "remember", "recall", "recollect", "reminisce", "reflect", "ponder", "consider", "contemplate", "meditate", "think", "imagine"];
                const objects = ["the beauty", "the music", "the warmth", "the fragrance", "the sweetness", "the softness", "the energy", "the difference", "the change", "the improvement", "the progress", "the development", "the growth", "the advancement", "the evolution", "the transformation", "the modification", "the alteration", "the variation", "the diversity", "the variety", "the richness", "the abundance", "the wealth", "the treasure", "the value", "the worth", "the significance", "the importance", "the meaning", "the purpose", "the essence", "the nature", "the quality", "the character", "the spirit", "the soul", "the heart", "the core", "the center", "the focus", "the point", "the detail", "the aspect", "the feature", "the element", "the component", "the part", "the piece", "the fragment"];
                const places = ["around us", "everywhere", "nearby", "in nature", "in the air", "all around", "in the distance", "close by", "far away", "right here", "over there", "up above", "down below", "straight ahead", "behind us", "beside us", "next to us", "near us", "around here", "in this place", "at this spot", "in this area", "within reach", "at hand", "in sight", "in view", "on display", "in plain sight", "before us", "in front", "to the side", "on the left", "on the right", "in the middle", "at the center", "on the edge", "at the border", "on the boundary", "at the limit", "in the vicinity", "in the neighborhood", "in the region", "in the zone", "in the sector", "in the district", "in the quarter", "in the locality", "in the territory", "in the domain", "in the realm"];
                return `${subjects[i % 50]} can ${verbs[Math.floor(i/50) % 50]} ${objects[Math.floor(i/2500) % 50]} ${places[Math.floor(i/125000) % 50]}`;
            }
        ],
        everyday: [
            // Template 1: Subject + Verb + Object + Modifier
            (i) => {
                const subjects = ["Success", "Learning", "Practice", "Knowledge", "Experience", "Teamwork", "Patience", "Creativity", "Dedication", "Understanding"];
                const verbs = ["requires", "develops", "improves", "enhances", "builds", "creates", "strengthens", "promotes", "encourages", "demonstrates"];
                const objects = ["hard work", "time and effort", "consistent practice", "careful planning", "strong focus", "clear goals", "good habits", "positive thinking", "effective strategies", "continuous learning"];
                const modifiers = ["and dedication", "and patience", "over time", "through practice", "every day", "gradually", "systematically", "effectively", "successfully", "remarkably"];
                return `${subjects[i % 10]} ${verbs[Math.floor(i/10) % 10]} ${objects[Math.floor(i/100) % 10]} ${modifiers[Math.floor(i/1000) % 10]}`;
            },
            // Template 2: Gerund + Verb + Object + Result
            (i) => {
                const gerunds = ["Reading", "Writing", "Practicing", "Studying", "Exercising", "Planning", "Organizing", "Communicating", "Collaborating", "Reflecting"];
                const verbs = ["helps", "enables", "allows", "supports", "facilitates", "encourages", "promotes", "fosters", "develops", "improves"];
                const objects = ["us", "people", "students", "learners", "individuals", "teams", "everyone", "professionals", "beginners", "experts"];
                const results = ["achieve goals", "gain knowledge", "build skills", "grow personally", "succeed professionally", "think critically", "solve problems", "make progress", "reach potential", "excel academically"];
                return `${gerunds[i % 10]} ${verbs[Math.floor(i/10) % 10]} ${objects[Math.floor(i/100) % 10]} ${results[Math.floor(i/1000) % 10]}`;
            },
            // Template 3: Subject + Must + Verb + To + Infinitive
            (i) => {
                const subjects = ["We", "Students", "Learners", "People", "Everyone", "Individuals", "Teams", "Organizations", "Communities", "Societies"];
                const verbs = ["work", "strive", "try", "aim", "endeavor", "attempt", "seek", "aspire", "commit", "dedicate"];
                const adverbs = ["hard", "diligently", "consistently", "persistently", "continuously", "actively", "earnestly", "seriously", "carefully", "thoughtfully"];
                const goals = ["to improve", "to succeed", "to excel", "to achieve", "to grow", "to develop", "to advance", "to progress", "to learn", "to master"];
                return `${subjects[i % 10]} must ${verbs[Math.floor(i/10) % 10]} ${adverbs[Math.floor(i/100) % 10]} ${goals[Math.floor(i/1000) % 10]}`;
            },
            // Template 4: The key to + Noun + Is + Gerund
            (i) => {
                const concepts = ["success", "happiness", "growth", "improvement", "achievement", "excellence", "mastery", "wisdom", "fulfillment", "prosperity"];
                const gerunds = ["practicing", "learning", "working", "studying", "planning", "organizing", "communicating", "collaborating", "persevering", "adapting"];
                const adverbs = ["consistently", "regularly", "diligently", "carefully", "thoughtfully", "systematically", "effectively", "efficiently", "wisely", "strategically"];
                const contexts = ["in all areas", "throughout life", "every single day", "with dedication", "with purpose", "with passion", "with focus", "with determination", "with commitment", "with enthusiasm"];
                return `The key to ${concepts[i % 10]} is ${gerunds[Math.floor(i/10) % 10]} ${adverbs[Math.floor(i/100) % 10]} ${contexts[Math.floor(i/1000) % 10]}`;
            },
            // Template 5: By + Gerund + We Can + Verb
            (i) => {
                const gerunds = ["practicing", "studying", "working", "learning", "reading", "writing", "listening", "observing", "analyzing", "reflecting"];
                const adverbs = ["regularly", "daily", "consistently", "carefully", "thoroughly", "actively", "attentively", "mindfully", "purposefully", "intentionally"];
                const verbs = ["improve", "enhance", "develop", "strengthen", "build", "expand", "deepen", "refine", "perfect", "master"];
                const objects = ["our skills", "our knowledge", "our abilities", "our understanding", "our expertise", "our competence", "our proficiency", "our capabilities", "our performance", "our potential"];
                return `By ${gerunds[i % 10]} ${adverbs[Math.floor(i/10) % 10]} we can ${verbs[Math.floor(i/100) % 10]} ${objects[Math.floor(i/1000) % 10]}`;
            }
        ],
        confident: [
            // Template 1: Subject + Verb + Object + Context
            (i) => {
                const subjects = ["Effective communication", "Critical thinking", "Strategic planning", "Professional development", "Continuous improvement", "Innovation", "Collaboration", "Leadership", "Problem solving", "Decision making"];
                const verbs = ["enhances", "develops", "requires", "promotes", "facilitates", "strengthens", "improves", "demonstrates", "encourages", "establishes"];
                const objects = ["productivity and efficiency", "analytical skills", "careful analysis", "professional growth", "team performance", "organizational success", "creative solutions", "positive outcomes", "sustainable practices", "long-term goals"];
                const contexts = ["in modern organizations", "through systematic approaches", "across diverse teams", "in complex environments", "for better results", "strategically", "comprehensively", "proactively", "consistently", "sustainably"];
                return `${subjects[i % 10]} ${verbs[Math.floor(i/10) % 10]} ${objects[Math.floor(i/100) % 10]} ${contexts[Math.floor(i/1000) % 10]}`;
            },
            // Template 2: Organizations that + Verb + Object + Achieve + Result
            (i) => {
                const verbs = ["prioritize", "emphasize", "focus on", "invest in", "commit to", "embrace", "implement", "adopt", "integrate", "leverage"];
                const objects = ["innovation", "collaboration", "quality", "excellence", "efficiency", "sustainability", "diversity", "transparency", "accountability", "agility"];
                const adverbs = ["consistently", "effectively", "successfully", "strategically", "systematically", "proactively", "continuously", "comprehensively", "holistically", "dynamically"];
                const results = ["achieve superior results", "gain competitive advantages", "drive organizational success", "create lasting value", "maximize performance", "optimize outcomes", "enhance capabilities", "build strong foundations", "foster growth", "ensure sustainability"];
                return `Organizations that ${verbs[i % 10]} ${objects[Math.floor(i/10) % 10]} ${adverbs[Math.floor(i/100) % 10]} ${results[Math.floor(i/1000) % 10]}`;
            },
            // Template 3: The ability to + Verb + Is crucial for + Context
            (i) => {
                const verbs = ["adapt", "innovate", "collaborate", "communicate", "analyze", "strategize", "execute", "optimize", "integrate", "transform"];
                const adverbs = ["quickly", "effectively", "efficiently", "successfully", "strategically", "systematically", "proactively", "continuously", "comprehensively", "dynamically"];
                const contexts = ["organizational success", "competitive advantage", "sustainable growth", "market leadership", "operational excellence", "business transformation", "strategic objectives", "long-term viability", "continuous improvement", "stakeholder value"];
                const environments = ["in today's business environment", "in rapidly changing markets", "in complex organizations", "in global contexts", "in competitive landscapes", "in modern enterprises", "in dynamic industries", "in evolving sectors", "in challenging conditions", "in uncertain times"];
                return `The ability to ${verbs[i % 10]} ${adverbs[Math.floor(i/10) % 10]} is crucial for ${contexts[Math.floor(i/100) % 10]} ${environments[Math.floor(i/1000) % 10]}`;
            },
            // Template 4: Successful + Noun + Requires + Gerund + And + Gerund
            (i) => {
                const nouns = ["leadership", "management", "implementation", "execution", "transformation", "innovation", "collaboration", "communication", "development", "optimization"];
                const gerund1 = ["understanding", "analyzing", "planning", "organizing", "coordinating", "integrating", "aligning", "balancing", "prioritizing", "managing"];
                const gerund2 = ["implementing", "executing", "monitoring", "evaluating", "adjusting", "optimizing", "improving", "refining", "enhancing", "sustaining"];
                const objects = ["complex systems", "diverse stakeholders", "strategic objectives", "organizational goals", "business processes", "team dynamics", "resource allocation", "performance metrics", "quality standards", "operational efficiency"];
                return `Successful ${nouns[i % 10]} requires ${gerund1[Math.floor(i/10) % 10]} and ${gerund2[Math.floor(i/100) % 10]} ${objects[Math.floor(i/1000) % 10]}`;
            },
            // Template 5: In order to + Verb + Organizations must + Verb + Object
            (i) => {
                const goals = ["achieve excellence", "maintain competitiveness", "drive innovation", "ensure sustainability", "maximize value", "optimize performance", "enhance capabilities", "build resilience", "foster growth", "create impact"];
                const verbs = ["develop", "implement", "establish", "maintain", "strengthen", "enhance", "optimize", "integrate", "leverage", "cultivate"];
                const objects = ["robust strategies", "effective processes", "strong capabilities", "clear frameworks", "comprehensive systems", "dynamic approaches", "innovative solutions", "collaborative cultures", "agile methodologies", "sustainable practices"];
                const contexts = ["across all levels", "throughout the organization", "in all departments", "at every stage", "in every function", "across diverse teams", "within all operations", "through all channels", "in all initiatives", "across the enterprise"];
                return `In order to ${goals[i % 10]} organizations must ${verbs[Math.floor(i/10) % 10]} ${objects[Math.floor(i/100) % 10]} ${contexts[Math.floor(i/1000) % 10]}`;
            }
        ]
    };
    
    const templates = sentenceTemplates[difficulty] || sentenceTemplates[DEFAULT_LEVEL];
    
    // Select template based on index to ensure variety
    const templateIndex = index % templates.length;
    const templateFunction = templates[templateIndex];
    
    // Generate sentence using selected template
    const sentence = templateFunction(Math.floor(index / templates.length));
    const words = sentence.split(' ');
    
    const baseExercise = {
        words: words,
        correct: sentence
    };

    // Blank the middle word BY POSITION, not with correct.replace(word, "___").
    // A first-occurrence substring replace blanks mid-word whenever the chosen
    // word also appears inside an earlier one — producing prompts like
    // "requires underst___ing and implementing" for the answer "and", which no
    // learner can answer. This is the same idiom deriveFillBlank() uses.
    const blankIndex = Math.floor(words.length / 2);

    return {
        words: baseExercise.words,
        correct: baseExercise.correct,
        fillBlank: {
            sentence: words.map((word, i) => (i === blankIndex ? '___' : word)).join(' '),
            answer: words[blankIndex],
            // Only `sentence` and `answer` are read by loadFillBlankExercise.
            // The old `options` array padded the answer with the literal strings
            // "other"/"word"/"test" and shuffled them with Math.random(), so it
            // was both nondeterministic and never displayed. Carrying just the
            // answer keeps the shape without pretending to offer distractors.
            options: [words[blankIndex]]
        }
    };
}

// Update navigation buttons visibility and state
function updateNavigationButtons(type) {
    // Sections without an index field (dashboard, puzzles) are not walked with
    // prev/next and have nothing to indicate, exactly as the old map — which
    // listed only vocabulary/sentences/reading/listening — arranged by omission.
    const section = Sections.get(type);
    if (!section || !section.indexKey) return;

    const currentIndex = state[section.indexKey];
    const isCompleted = isExerciseCompleted(type, currentIndex);

    // Update completion indicator
    updateCompletionIndicator(type, currentIndex, isCompleted);
}

// Update completion indicator in UI
function updateCompletionIndicator(type, index, isCompleted) {
    const indicatorId = (Sections.get(type) || {}).statusId;
    if (!indicatorId) return;
    
    let indicator = document.getElementById(indicatorId);
    if (!indicator) {
        // Create indicator if it doesn't exist
        const section = document.getElementById(type);
        if (section) {
            indicator = document.createElement('div');
            indicator.id = indicatorId;
            indicator.className = 'exercise-status';
            section.querySelector('h2').after(indicator);
        }
    }
    
    if (indicator) {
        // Built node by node rather than with innerHTML (US-127). The markup this
        // replaces carried an inline onclick="retakeCurrentExercise('...')" — a
        // script inside an attribute, which only runs because index.html's CSP
        // still allows 'unsafe-inline' for scripts, and which is exactly the kind
        // of code that makes dropping that allowance a large change instead of a
        // one-line one. `type` is internal today, but it is still interpolated
        // straight into an HTML sink, so nothing but that fact makes it safe.
        // Same element structure, same classes, same behaviour; the handler is
        // simply attached in JavaScript.
        indicator.textContent = '';

        const status = document.createElement('span');
        status.className = isCompleted ? 'status-complete' : 'status-incomplete';
        status.textContent = isCompleted ? '✓ Completed' : '○ Not completed';
        indicator.appendChild(status);

        if (isCompleted) {
            // The whitespace text node the old template had between the span and
            // the button. .exercise-status is a flex container, so it never
            // rendered as a gap (that comes from `gap: 15px`), but keeping it
            // makes this DOM identical to what innerHTML produced.
            indicator.appendChild(document.createTextNode(' '));

            const retakeButton = document.createElement('button');
            retakeButton.className = 'btn-secondary btn-retake';
            retakeButton.textContent = 'Retake';
            // Looked up on window at click time, exactly as the inline handler
            // did: retakeCurrentExercise is assigned further down this file.
            retakeButton.addEventListener('click', () => window.retakeCurrentExercise(type));
            indicator.appendChild(retakeButton);
        }
    }
}

// Retake current exercise
window.retakeCurrentExercise = function(type) {
    const section = Sections.get(type);

    // No early return on an unknown/index-less type: the old code did
    // `state[indexMap[type]]`, which yields undefined, and then still cleared and
    // re-saved. Kept identical — this is only ever called from a Retake button,
    // which updateCompletionIndicator only creates for sections that have a
    // statusId, so in practice `section` is always one of the four walkable ones.
    const currentIndex = state[(section || {}).indexKey];
    retakeExercise(type, currentIndex);

    // Reload the exercise, but only for a section the learner can be positioned
    // within. `indexKey` is the condition, not a section list: the old retake
    // loaders map held exactly the four sections that have one. Puzzles have a
    // registered loader (switchSection uses it) but no index and no Retake
    // button, and re-running it here would regenerate a puzzle nobody asked for.
    if (section && section.indexKey) {
        Sections.loader(type)?.();
    }
};

// ============================================
// ERROR HANDLER WITH RETRY LOGIC
// ============================================

const AppErrorHandler = {
    // Error types
    ErrorTypes: {
        NETWORK: 'NETWORK_ERROR',
        TIMEOUT: 'TIMEOUT_ERROR',
        API: 'API_ERROR',
        VALIDATION: 'VALIDATION_ERROR',
        STORAGE: 'STORAGE_ERROR',
        PERMISSION: 'PERMISSION_ERROR',
        UNKNOWN: 'UNKNOWN_ERROR'
    },

    // Classify error type.
    //
    // Order matters here. The validation check runs first, before the offline
    // check, because a validation failure is a statement about what the learner
    // typed and has nothing to do with the network: with `!navigator.onLine`
    // first, an empty answer entered offline was classified NETWORK and reported
    // as "No internet connection. Using offline mode." — nonsense in a PWA whose
    // whole point is that it works offline.
    classifyError(error) {
        const err = error || {};
        if (this.isValidationError(err)) return this.ErrorTypes.VALIDATION;
        if (!navigator.onLine) return this.ErrorTypes.NETWORK;
        if (err.name === 'TimeoutError' || err.name === 'AbortError') return this.ErrorTypes.TIMEOUT;
        if (err.response) return this.ErrorTypes.API;
        if (err.name === 'QuotaExceededError') return this.ErrorTypes.STORAGE;
        if (err.name === 'NotAllowedError') return this.ErrorTypes.PERMISSION;
        return this.ErrorTypes.UNKNOWN;
    },

    // True only for the errors validateInput() raises *about the input*.
    //
    // Deliberately a tag, not a guess from the message text: anything else that
    // escapes validateInput — a TypeError because a caller passed a non-regex
    // `pattern`, say — is a genuine bug, must keep classifying as UNKNOWN, and
    // must keep being reported. This is the line between "the learner has not
    // typed anything yet" and "this code is broken", so it stays narrow.
    isValidationError(error) {
        return !!error && (error.isValidationError === true || error.name === 'ValidationError');
    },

    // Build a tagged validation error. The message is shown to the learner
    // verbatim by the call sites, so it is written for them, not for a log.
    validationError(message) {
        const error = new Error(message);
        error.name = 'ValidationError';
        error.isValidationError = true;
        return error;
    },

    // Get user-friendly error message
    getUserMessage(errorType, context = '') {
        const messages = {
            [this.ErrorTypes.NETWORK]: 'No internet connection. Using offline mode.',
            [this.ErrorTypes.TIMEOUT]: 'Request timed out. Please try again.',
            [this.ErrorTypes.API]: `Unable to fetch ${context}. Using cached data.`,
            [this.ErrorTypes.VALIDATION]: 'Invalid input. Please check your entry.',
            [this.ErrorTypes.STORAGE]: 'Storage limit reached. Some data may not be saved.',
            [this.ErrorTypes.PERMISSION]: 'Permission denied. Please check your settings.',
            [this.ErrorTypes.UNKNOWN]: 'Something went wrong. Please try again.'
        };
        return messages[errorType] || messages[this.ErrorTypes.UNKNOWN];
    },

    // Log error for debugging
    logError(error, context = '') {
        const errorType = this.classifyError(error);
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ${errorType} in ${context}:`, error);

        // Store error in sessionStorage for debugging
        try {
            const errorLog = JSON.parse(sessionStorage.getItem('errorLog') || '[]');
            errorLog.push({
                timestamp,
                type: errorType,
                context,
                message: error.message,
                stack: error.stack
            });
            // Keep only last 50 errors
            if (errorLog.length > 50) errorLog.shift();
            sessionStorage.setItem('errorLog', JSON.stringify(errorLog));
        } catch (e) {
            // If sessionStorage fails, just log to console
            console.warn('Could not store error log:', e);
        }
    },

    // Retry with exponential backoff
    async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000, context = '') {
        let lastError;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                this.logError(error, `${context} (attempt ${attempt + 1}/${maxRetries})`);

                // Don't retry on validation errors or permission errors
                const errorType = this.classifyError(error);
                if (errorType === this.ErrorTypes.VALIDATION ||
                    errorType === this.ErrorTypes.PERMISSION) {
                    throw error;
                }

                // Don't retry if it's the last attempt
                if (attempt < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    },

    // Handle error with user notification
    handleError(error, context = '', options = {}) {
        const {
            showToast = true,
            useCache = true,
            fallback = null,
            showValidationToast = false
        } = options;

        this.logError(error, context);
        const errorType = this.classifyError(error);

        // A validation failure is not a malfunction, and it is already spoken
        // for (US-125). validateInput() throws a message written for the learner
        // ("There is nothing to check yet. Say or type your answer, then try
        // again."), and every call site surfaces it — inline feedback under the
        // exercise, or a toast in the exercise's own words. Adding a second,
        // generic toast from here is what produced two notifications for one
        // empty answer, the second of them the vague and faintly alarming
        // "Something went wrong. Please try again." So: log it, and let the call
        // site do the talking.
        //
        // Only validation is treated this way. Every other type still toasts,
        // because nothing else here is guaranteed to have been reported already.
        // A caller that has nothing of its own to say can opt in with
        // showValidationToast, and then gets the thrown message verbatim rather
        // than the generic line.
        if (errorType === this.ErrorTypes.VALIDATION) {
            if (showValidationToast && showToast && window.Toast) {
                const validationMessage = (error && error.message)
                    ? error.message
                    : this.getUserMessage(errorType, context);
                window.Toast.warning(validationMessage);
            }
            return fallback;
        }

        const message = this.getUserMessage(errorType, context);

        if (showToast && window.Toast) {
            window.Toast.show(message, 'error');
        }

        return fallback;
    },

    // Wrap async function with error handling
    async wrapAsync(fn, context = '', options = {}) {
        try {
            return await fn();
        } catch (error) {
            return this.handleError(error, context, options);
        }
    },

    // Absolute ceiling on any validated string, whatever the caller asks for.
    // A learner's answer is a sentence, not a document; anything past this is a
    // paste accident or an attempt to fill localStorage.
    HARD_MAX_LENGTH: 2000,

    // The denylist: characters that are dangerous rather than merely
    // unexpected, and are never part of anything a learner says or types.
    //   U+0000-U+0008, U+000B, U+000C, U+000E-U+001F
    //       C0 controls except tab, newline and carriage return. NUL
    //       truncates strings in some storage layers and any of them can
    //       break the console line written by logError().
    //   U+007F-U+009F
    //       DEL and the C1 controls.
    //   U+200E, U+200F, U+202A-U+202E, U+2066-U+2069
    //       Bidi marks and overrides, which can make a string render in an
    //       order that is not the order it is stored in.
    UNSAFE_CHARS: /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,

    /**
     * Validate and sanitize a learner-supplied string.
     *
     * What this is actually for (US-121). Every caller passes free-form text a
     * learner produced: a speech transcript (`speechAPI.startRecognition`), a
     * word chip's text and the drag/drop payload built from it, a dictation
     * answer, a word-scramble answer. None of it is a structured field, and
     * none of it reaches an HTML sink — the read-aloud feedback is built with
     * createElement/textContent in renderSpeechDiff(), the chips and the
     * feedback lines are set with .textContent, and the rest is only compared
     * against an expected answer. So the job here is: cap the length, drop
     * characters that are genuinely dangerous, and reject nothing that a
     * learner could legitimately say or type.
     *
     * Denylist, not allowlist. Callers used to pass the allowlist
     * `/^[a-zA-Z0-9\s.,!?'\-]+$/`, which rejected the curly apostrophe most
     * recognisers emit for "don't", every accented word (café, naïve, résumé),
     * ampersands, en/em dashes and ellipses — and the app then told the learner
     * their speech was invalid, which is the app blaming a learner for the
     * app's own narrow pattern (BR-3, and the tone rules in
     * docs/TEACHING_METHODOLOGY.md §5). Widening that allowlist only moves the
     * same trap: written English keeps borrowing punctuation, and a recogniser
     * set to en-US still emits names and loanwords from most of Latin-1 and
     * beyond. The threat model here is unbounded input and control/bidi
     * characters, not spelling, so an allowlist of *permitted* characters buys
     * no safety it does not already have from the length cap, the denylist,
     * and textContent at the point of use — while guaranteeing false
     * accusations. Hence: denylist.
     *
     * `pattern` is still honoured for a genuinely structured field (an email,
     * a date), but only when the caller opts in with `strictPattern: true`.
     * Without that flag a passed pattern is ignored, because every pattern in
     * this codebase today is the free-text allowlist described above.
     * (`type` was accepted and never used; it is gone.)
     */
    validateInput(input, rules = {}) {
        const {
            required = false,
            minLength = 0,
            maxLength = this.HARD_MAX_LENGTH,
            pattern = null,
            strictPattern = false
        } = rules;

        const text = (input === null || input === undefined) ? '' : String(input);

        // Nothing supplied. Phrased as a state of the exercise, not a verdict
        // on the learner: an empty transcript usually means the mic heard
        // nothing, which is not a mistake.
        //
        // Every throw below is built with validationError(), so classifyError()
        // can recognise it as VALIDATION and handleError() knows the call site
        // has already shown this message (US-125). Anything thrown here with a
        // bare `new Error` would be reported a second time as an unexplained
        // failure.
        if (required && text.trim() === '') {
            throw this.validationError('There is nothing to check yet. Say or type your answer, then try again.');
        }

        if (text === '') return '';

        // Sanitize. Deliberately NOT via sanitizeInput(): that one is for text a
        // caller is about to display as-is, and it does not enforce this
        // function's length cap or its `required` rule. The two share the same
        // stripping rules on purpose — dangerous characters and the markup
        // delimiters go, the learner's own punctuation (ampersands, curly
        // apostrophes, accents, dashes) stays, because the result is shown with
        // textContent and compared against an expected answer. Entity-encoding
        // here would show the learner "fish &amp; chips" and then mark them
        // wrong for an ampersand.
        const sanitized = text
            .replace(this.UNSAFE_CHARS, '')
            .replace(/[<>]/g, '')
            .trim();

        if (required && sanitized === '') {
            throw this.validationError('There is nothing to check yet. Say or type your answer, then try again.');
        }

        // Length. The caller's cap applies, but never above the hard ceiling.
        const cap = Math.min(Number(maxLength) || this.HARD_MAX_LENGTH, this.HARD_MAX_LENGTH);
        if (sanitized.length < minLength) {
            throw this.validationError(`This needs at least ${minLength} characters. Add a little more and try again.`);
        }
        if (sanitized.length > cap) {
            throw this.validationError(`This exercise can only check ${cap} characters at a time. Shorten it and try again.`);
        }

        // Format, for structured fields only — see the note above.
        if (strictPattern && pattern && !pattern.test(sanitized)) {
            throw this.validationError('That is not the format this field expects.');
        }

        return sanitized;
    },

    /**
     * Sanitize a string for display as plain text.
     *
     * Returns text, not entity-encoded HTML (US-126). This used to round-trip
     * through .innerHTML — textContent in, innerHTML out — which encodes: "fish
     * & chips" came back as "fish &amp; chips". That only rendered correctly if
     * the consumer happened to be an innerHTML sink, and the word chips in
     * loadDragDropSentence() are not: they assign the result to .textContent, so
     * a learner building a sentence about fish & chips read "fish &amp; chips"
     * on the chip. The encoding also meant the escaping of the one real HTML
     * sink in this file (Toast) was a side effect of a helper named "sanitize" —
     * protection you could remove by accident while fixing a display bug. Toast
     * now escapes structurally at its own sink (displayToast builds its nodes
     * and sets .textContent), so this function can do what all of its callers
     * already assume it does: hand back safe plain text.
     *
     * "Safe" here means the same denylist validateInput() uses — control and
     * bidi characters out, the markup delimiters `<` and `>` out — and nothing
     * about the learner's own punctuation touched. What it is not is a
     * substitute for escaping at an HTML sink: any future caller that writes
     * this result with .innerHTML must escape it there.
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;

        return input
            .replace(this.UNSAFE_CHARS, '')
            .replace(/[<>]/g, '')
            .trim();
    }
};

// `const` at the top level of a classic script creates a LEXICAL global, not a
// property of `window`. So `window.AppErrorHandler` was permanently undefined,
// and every `global.AppErrorHandler && ...` guard in js/core/srs.js,
// blobstore.js, mistakes.js and portability.js evaluated false — meaning error
// logging from all four core modules was a silent no-op in the browser.
// Publishing it explicitly is the one-line fix; the alternative was rewriting
// four modules to reach a binding they cannot see.
window.AppErrorHandler = AppErrorHandler;

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================

const Toast = {
    container: null,
    queue: [],
    activeToasts: [],
    maxToasts: 3,

    // Initialize toast container
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            this.container.setAttribute('role', 'region');
            this.container.setAttribute('aria-label', 'Notifications');
            this.container.setAttribute('aria-live', 'polite');
            document.body.appendChild(this.container);
        }
    },

    // Show toast notification
    show(message, type = 'info', duration = 4000) {
        this.init();

        const toast = {
            id: Date.now() + Math.random(),
            // sanitizeInput() is still worth calling — it drops control and bidi
            // characters, which would otherwise land in a notification and in the
            // console line logError() writes. What it no longer does is escape
            // for HTML; displayToast() handles that by setting .textContent.
            message: AppErrorHandler.sanitizeInput(message),
            type,
            duration
        };

        // Add to queue if max toasts reached
        if (this.activeToasts.length >= this.maxToasts) {
            this.queue.push(toast);
            return;
        }

        this.displayToast(toast);
    },

    // Display toast element
    displayToast(toast) {
        const toastEl = document.createElement('div');
        toastEl.className = `toast toast-${toast.type}`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.dataset.toastId = toast.id;

        // Icon based on type
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };

        // Built node by node instead of with innerHTML (US-126). The message can
        // contain anything a learner typed or a recogniser heard, and it used to
        // be interpolated into markup here — safe only because sanitizeInput()
        // happened to entity-encode on the way in. That encoding was wrong for
        // the callers that display its result as text, so it is gone; the
        // escaping now lives at the sink, where it belongs. .textContent is not
        // parsed as markup, so a message about fish & chips renders as "fish &
        // chips" rather than "fish &amp; chips", and a message containing markup
        // cannot become markup. Same elements, same classes, same order.
        const iconEl = document.createElement('span');
        iconEl.className = 'toast-icon';
        iconEl.textContent = icons[toast.type] || icons.info;

        const messageEl = document.createElement('span');
        messageEl.className = 'toast-message';
        messageEl.textContent = toast.message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Close notification');
        closeBtn.textContent = '×';

        toastEl.appendChild(iconEl);
        toastEl.appendChild(messageEl);
        toastEl.appendChild(closeBtn);

        // Close button handler
        closeBtn.addEventListener('click', () => this.dismiss(toast.id));

        // Add to container
        this.container.appendChild(toastEl);
        this.activeToasts.push(toast.id);

        // Trigger animation
        setTimeout(() => toastEl.classList.add('toast-show'), 10);

        // Auto dismiss
        if (toast.duration > 0) {
            setTimeout(() => this.dismiss(toast.id), toast.duration);
        }
    },

    // Dismiss toast
    dismiss(toastId) {
        const toastEl = this.container.querySelector(`[data-toast-id="${toastId}"]`);
        if (toastEl) {
            toastEl.classList.remove('toast-show');
            toastEl.classList.add('toast-hide');

            setTimeout(() => {
                toastEl.remove();
                this.activeToasts = this.activeToasts.filter(id => id !== toastId);

                // Show next queued toast
                if (this.queue.length > 0) {
                    const nextToast = this.queue.shift();
                    this.displayToast(nextToast);
                }
            }, 300);
        }
    },

    // Success toast shorthand
    success(message, duration) {
        this.show(message, 'success', duration);
    },

    // Error toast shorthand
    error(message, duration) {
        this.show(message, 'error', duration);
    },

    // Warning toast shorthand
    warning(message, duration) {
        this.show(message, 'warning', duration);
    },

    // Info toast shorthand
    info(message, duration) {
        this.show(message, 'info', duration);
    },

    // Clear all toasts
    clearAll() {
        this.activeToasts.forEach(id => this.dismiss(id));
        this.queue = [];
    }
};

// Make Toast available globally
window.Toast = Toast;

// ============================================
// LOADING INDICATOR SYSTEM
// ============================================

const LoadingIndicator = {
    overlay: null,
    activeOperations: new Set(),

    // Initialize overlay
    init() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'loadingOverlay';
            this.overlay.className = 'loading-overlay';
            this.overlay.setAttribute('role', 'status');
            this.overlay.setAttribute('aria-live', 'polite');
            this.overlay.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <span class="loading-text">Loading...</span>
                </div>
            `;
            document.body.appendChild(this.overlay);
        }
    },

    // Show loading indicator
    show(operationId = 'default', message = 'Loading...') {
        this.init();
        this.activeOperations.add(operationId);

        const loadingText = this.overlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }

        this.overlay.classList.add('loading-show');
        this.overlay.setAttribute('aria-busy', 'true');
    },

    // Hide loading indicator
    hide(operationId = 'default') {
        this.activeOperations.delete(operationId);

        // Only hide if no other operations are active
        if (this.activeOperations.size === 0 && this.overlay) {
            this.overlay.classList.remove('loading-show');
            this.overlay.setAttribute('aria-busy', 'false');
        }
    },

    // Check if loading
    isLoading() {
        return this.activeOperations.size > 0;
    }
};

// Make LoadingIndicator available globally
window.LoadingIndicator = LoadingIndicator;

// ============================================
// API INTEGRATION WITH OFFLINE FALLBACK
// ============================================

async function fetchWordData(word) {
    const cached = cache.get(`word_${word.toLowerCase()}`);
    if (cached) return cached;

    if (CONFIG.useAPIFirst && navigator.onLine) {
        try {
            // Use ErrorHandler with retry logic
            const wordData = await AppErrorHandler.retryWithBackoff(
                async () => {
                    const response = await fetch(`${CONFIG.dictionaryAPI}${word.toLowerCase()}`, {
                        signal: AbortSignal.timeout(5000)
                    });
                    if (!response.ok) {
                        throw new Error(`API returned ${response.status}`);
                    }
                    const data = await response.json();
                    return parseAPIResponse(data[0]);
                },
                3,
                1000,
                `fetchWordData("${word}")`
            );

            cache.set(`word_${word.toLowerCase()}`, wordData);
            return wordData;
        } catch (error) {
            // Use ErrorHandler to handle the error gracefully
            AppErrorHandler.handleError(error, `word "${word}"`, {
                showToast: false, // Don't show toast for API fallback
                fallback: null
            });
            console.warn(`API failed for "${word}", using offline data`);
        }
    }
    return getLocalWordData(word);
}

function parseAPIResponse(apiData) {
    const meaning = apiData.meanings[0];
    const definition = meaning.definitions[0];
    const correctDefinition = definition.definition;
    const options = [correctDefinition, ...getDistractorDefinitions(correctDefinition, 3)].sort(() => Math.random() - 0.5);
    return {
        word: apiData.word,
        pronunciation: apiData.phonetic || apiData.phonetics[0]?.text || '',
        definition: correctDefinition,
        example: definition.example || `Example: ${apiData.word} is commonly used.`,
        quiz: {
            question: `What does '${apiData.word}' mean?`,
            options: options,
            correct: options.indexOf(correctDefinition)
        }
    };
}

function getLocalWordData(word) {
    const localWords = vocabularyData[state.currentDifficulty] || vocabularyData[DEFAULT_LEVEL];
    return localWords.find(w => w.word.toLowerCase() === word.toLowerCase()) ||
           localWords[state.currentWordIndex % localWords.length];
}

// Build plausible quiz distractors from the real definitions of OTHER vocabulary
// entries, so the quiz tests meaning instead of absurdity-spotting. Prefers the
// learner's current difficulty level and falls back to the remaining levels when
// that level does not have enough entries.
function getDistractorDefinitions(correctDefinition, count) {
    const wanted = typeof count === 'number' && count > 0 ? count : 3;
    const genericFallbacks = [
        'A word with an entirely different meaning',
        'A term used in an unrelated context',
        'A phrase that means roughly the opposite'
    ];
    const preferred = [];
    const others = [];
    const seen = [correctDefinition];

    function collect(entries, target) {
        if (!Array.isArray(entries)) return;
        entries.forEach(entry => {
            const definition = entry && entry.definition;
            if (typeof definition !== 'string' || definition.length === 0) return;
            if (seen.indexOf(definition) !== -1) return;
            seen.push(definition);
            target.push(definition);
        });
    }

    try {
        const allLevels = typeof vocabularyData !== 'undefined' && vocabularyData ? vocabularyData : {};
        const currentLevel = state && state.currentDifficulty ? state.currentDifficulty : DEFAULT_LEVEL;
        collect(allLevels[currentLevel], preferred);
        Object.keys(allLevels).forEach(level => {
            if (level !== currentLevel) collect(allLevels[level], others);
        });
    } catch (error) {
        console.warn('Vocabulary distractors unavailable, using generic options', error);
    }

    const pool = preferred.sort(() => Math.random() - 0.5).concat(others.sort(() => Math.random() - 0.5));
    const distractors = pool.slice(0, wanted);

    // Degrade gracefully: top up with generic options if the curated set is too small.
    genericFallbacks.forEach(fallback => {
        if (distractors.length >= wanted) return;
        if (seen.indexOf(fallback) !== -1) return;
        seen.push(fallback);
        distractors.push(fallback);
    });

    return distractors;
}

// ============================================
// WEB SPEECH API
// ============================================

// Speech recognition failures the browser reports, each with the one thing the
// learner can actually do about it. `aborted` is handled separately in
// startRecognition because it is normal cancellation, not an error.
const speechRecognitionErrors = {
    'no-speech': {
        message: 'The microphone did not pick up any speech. Press the button again and start speaking after a short pause.',
        level: 'info'
    },
    'not-allowed': {
        message: 'Your browser is blocking microphone access for this site. Allow the microphone in the site permissions, then press the button again.',
        level: 'warning'
    },
    'service-not-allowed': {
        message: 'Your browser or system is blocking its speech recognition service. Check the speech or privacy settings, then press the button again.',
        level: 'warning'
    },
    'audio-capture': {
        message: 'No working microphone was found. Check that one is connected and chosen as the input device, then press the button again.',
        level: 'warning'
    },
    'network': {
        message: 'Speech recognition needs an internet connection and could not reach the service. The rest of this exercise still works offline.',
        level: 'warning'
    }
};

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
        
        utterance.onend = () => {
            speechAPI.currentUtterance = null;
            updateReadingControls('stopped');
        };
        
        utterance.onstart = () => {
            updateReadingControls('playing');
        };
        
        speechAPI.currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    },
    
    pause: () => {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            speechAPI.isPaused = true;
            updateReadingControls('paused');
        }
    },
    
    resume: () => {
        if (window.speechSynthesis && speechAPI.isPaused) {
            window.speechSynthesis.resume();
            speechAPI.isPaused = false;
            updateReadingControls('playing');
        }
    },
    
    stop: () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            speechAPI.currentUtterance = null;
            speechAPI.isPaused = false;
            updateReadingControls('stopped');
        }
    },
    
    replay: () => {
        if (speechAPI.currentText) {
            speechAPI.speak(speechAPI.currentText, speechAPI.currentRate);
        }
    },
    
    startRecognition: (callback) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            Toast.error('Speech recognition not supported in this browser');
            return null;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.onresult = (e) => {
            try {
                const transcript = e.results[0][0].transcript;
                // Length-cap and strip control characters. No `pattern` here:
                // an allowlist of "acceptable" characters rejected ordinary
                // speech output (curly apostrophes, accented letters, "&") and
                // then told the learner their input was invalid, which blamed
                // them for the app's own narrowness. Escaping happens at the
                // point of use — renderSpeechDiff() builds with textContent only.
                const validatedTranscript = AppErrorHandler.validateInput(transcript, {
                    required: true,
                    maxLength: 500
                });
                callback(validatedTranscript);
            } catch (error) {
                AppErrorHandler.handleError(error, 'speech recognition result');
                // Not "Invalid speech input detected" — that accused the learner
                // of the app's own failure to read what the recogniser returned.
                Toast.info('The recogniser did not return anything to check that time. Press the button and try again.');
            }
        };
        recognition.onerror = (e) => {
            const code = (e && e.error) ? e.error : 'unknown';

            // `aborted` is what the browser reports when the learner stops the mic,
            // switches exercise, or a new recognition run replaces this one. That is
            // ordinary use, not a failure, so it gets no toast and no error log.
            if (code === 'aborted') return;

            AppErrorHandler.logError(new Error(code), 'speech recognition');

            const known = speechRecognitionErrors[code];
            const message = known ? known.message : 'Speech recognition stopped before it could finish. You can press the button and try again, or skip this one and come back to it.';
            const level = known ? known.level : 'warning';
            Toast[level](message);
        };
        recognition.start();
        return recognition;
    }
};

// ============================================
// READ-ALOUD WORD COMPARISON
// ============================================
// The browser recogniser tells us which words it guessed, never whether a human
// would understand the learner. Everything below reports the former only.

// Split text into display tokens. Comparison keys are derived separately so the
// learner always sees their target with its original casing and punctuation.
function splitSpeechWords(text) {
    return String(text == null ? '' : text).trim().split(/\s+/).filter(word => word.length > 0);
}

// Comparison key: lowercase, punctuation stripped, internal apostrophes kept so
// "don't" and "dont" still differ from "do". Returns '' for punctuation-only tokens.
function normalizeSpeechWord(word) {
    return String(word).toLowerCase().replace(/[^a-z0-9']+/g, '').replace(/^'+|'+$/g, '');
}

// Compare a target string with a recogniser transcript, word by word.
// Returns { words: [{ word, matched }], missed: [word], matchedCount, totalCount, allMatched }.
//
// Alignment is done with a longest common subsequence over the normalised word
// lists rather than comparing index by index. Index-by-index breaks as soon as
// the recogniser drops or inserts a single word: everything after the shift is
// reported wrong, which tells the learner their whole sentence failed when only
// one word did. LCS finds the largest in-order set of target words the recogniser
// produced, so one drop or insertion costs exactly one word. It is O(n*m) on word
// counts of a sentence, which is nothing.
function diffSpeechAttempt(target, transcript) {
    const targetWords = splitSpeechWords(target);
    const heardWords = splitSpeechWords(transcript);
    const targetKeys = targetWords.map(normalizeSpeechWord);
    const heardKeys = heardWords.map(normalizeSpeechWord).filter(key => key.length > 0);

    const n = targetKeys.length;
    const m = heardKeys.length;

    // lcs[i][j] = length of the longest common subsequence of targetKeys[i..] and heardKeys[j..]
    const lcs = [];
    for (let i = 0; i <= n; i++) {
        lcs.push(new Array(m + 1).fill(0));
    }
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            if (targetKeys[i] && targetKeys[i] === heardKeys[j]) {
                lcs[i][j] = lcs[i + 1][j + 1] + 1;
            } else {
                lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }
    }

    // A token that normalises to nothing (a stray dash, say) carries no sound, so
    // it is never something the recogniser could have missed.
    const words = targetWords.map((word, i) => ({ word, matched: targetKeys[i].length === 0 }));

    // Walk the table forwards, taking a match whenever the keys agree and
    // otherwise stepping down whichever side keeps the subsequence longest.
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (targetKeys[i] && targetKeys[i] === heardKeys[j]) {
            words[i].matched = true;
            i++;
            j++;
        } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
            i++;
        } else {
            j++;
        }
    }

    const missed = words.filter(entry => !entry.matched).map(entry => entry.word);
    return {
        words,
        missed,
        matchedCount: words.length - missed.length,
        totalCount: words.length,
        allMatched: words.length > 0 && missed.length === 0
    };
}

// Wording rule: we only ever report what the recogniser did. A full match is
// "understood every word", never "Perfect!" — we have no evidence for that.
function speechAttemptMessage(diff) {
    if (diff.allMatched) {
        return 'The recogniser understood every word.';
    }
    const noun = diff.totalCount === 1 ? 'word' : 'words';
    return `The recogniser missed ${diff.missed.length} of ${diff.totalCount} ${noun}: ${diff.missed.join(', ')}.`;
}

// Render the diff into a feedback element. Built with createElement/textContent
// rather than innerHTML: the transcript is user-derived, and target words are
// echoed back next to it, so no string here is ever parsed as HTML.
function renderSpeechDiff(id, diff) {
    const el = document.getElementById(id);
    if (!el) return;

    if (diff.totalCount === 0) {
        showFeedback(id, 'There is no target word to compare with yet.', 'info');
        return;
    }

    el.textContent = '';

    const summary = document.createElement('div');
    summary.textContent = speechAttemptMessage(diff);
    el.appendChild(summary);

    const line = document.createElement('div');
    line.style.marginTop = '8px';
    diff.words.forEach((entry, index) => {
        const span = document.createElement('span');
        span.textContent = entry.word;
        if (!entry.matched) {
            span.style.fontWeight = '700';
            span.style.textDecoration = 'underline';
            span.style.textDecorationStyle = 'wavy';
            span.title = 'The recogniser did not match this word';
        }
        line.appendChild(span);
        if (index < diff.words.length - 1) {
            line.appendChild(document.createTextNode(' '));
        }
    });
    el.appendChild(line);

    el.className = `feedback ${diff.allMatched ? 'success' : 'info'} visible`;
}

function updateReadingControls(state) {
    const playBtn = document.getElementById('readAloud');
    const pauseBtn = document.getElementById('pauseReading');
    const resumeBtn = document.getElementById('resumeReading');
    const stopBtn = document.getElementById('stopReading');
    const replayBtn = document.getElementById('replayReading');
    
    if (!playBtn) return;
    
    // Reset all buttons
    [playBtn, pauseBtn, resumeBtn, stopBtn, replayBtn].forEach(btn => {
        if (btn) btn.style.display = 'none';
    });
    
    // Show appropriate buttons based on state
    switch(state) {
        case 'playing':
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
            if (stopBtn) stopBtn.style.display = 'inline-block';
            break;
        case 'paused':
            if (resumeBtn) resumeBtn.style.display = 'inline-block';
            if (stopBtn) stopBtn.style.display = 'inline-block';
            break;
        case 'stopped':
            if (playBtn) playBtn.style.display = 'inline-block';
            if (replayBtn) replayBtn.style.display = 'inline-block';
            break;
        default:
            if (playBtn) playBtn.style.display = 'inline-block';
    }
}

// ============================================
// NAVIGATION
// ============================================

function initializeNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });
}

function switchSection(sectionName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(sectionName).classList.add('active');
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    state.currentSection = sectionName;

    // `dashboard` has no loader registered, so this is a no-op for it — the same
    // outcome the old literal produced by simply not listing it.
    Sections.loader(sectionName)?.();
}

/**
 * Paint the difficulty selectors from state.currentDifficulty.
 *
 * index.html can no longer hardcode which button is active, because the tier is
 * restored from storage now (see loadProgress). A hardcoded `active` class would
 * label Confident content as Foundation on every reload.
 *
 * A tier with no authored content (`fluent` today) is marked unavailable rather
 * than hidden: the four-tier scale is what the learner self-assesses against, so
 * concealing the top of it is dishonest about where the ladder ends. It is
 * `disabled` so it cannot be selected, and resolveDifficulty() would step it
 * down to Confident anyway if anything ever did select it.
 */
function syncDifficultySelectors() {
    const current = state.currentDifficulty;
    document.querySelectorAll('.diff-btn').forEach(btn => {
        const level = typeof canonicalLevel === 'function'
            ? canonicalLevel(btn.dataset.level)
            : btn.dataset.level;
        const available = isLevelAvailable(level);
        const active = available && level === current;

        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');

        // levels.js owns the display label, so a tier can be renamed in one
        // place. The text already in index.html is only the no-JS fallback.
        if (typeof Levels !== 'undefined' && Levels && typeof Levels.levelLabel === 'function') {
            const label = Levels.levelLabel(level);
            if (label) btn.textContent = available ? label : label + ' (soon)';
        }

        if (!available) {
            // styles.css has no :disabled rule for .diff-btn, so dim it here
            // rather than leave a button that looks pressable and is not.
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
            btn.style.opacity = '0.45';
            btn.style.cursor = 'not-allowed';
            btn.title = 'Not available yet — content for this level is still being written.';
        }
    });
}

function initializeDifficultySelectors() {
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Normalise the DOM attribute through levels.js rather than trusting
            // it: a data-level typo or a level the content no longer has would
            // otherwise be written straight into state and crash every lookup.
            const level = resolveDifficulty(btn.dataset.level);
            state.currentDifficulty = level;
            // Every section's content is keyed by level, so every section's
            // position has to go back to the start. This used to list three of
            // the four index fields and silently omit currentListeningIndex,
            // which left Listening pointing at, say, item 7 of a level that might
            // only have three exercises. Named as a deliberate change in the
            // Phase 3 commit message (docs/IMPLEMENTATION_PLAN.md).
            Sections.indexKeys().forEach(key => { state[key] = 0; });
            // Repaint every selector, not just this section's: all three show the
            // same single state.currentDifficulty, so highlighting one section's
            // button and leaving the others stale is a lie about which level the
            // other sections are showing.
            syncDifficultySelectors();
            saveProgress();

            const section = btn.closest('.section').id;
            // Whichever section this button lives in — read from the DOM, so the
            // set is whatever `hasDifficulty` is true for in js/core/sections.js
            // (vocabulary, sentences, reading and grammar today; the comment here
            // used to say "the three" and had been wrong since Grammar shipped).
            Sections.loader(section)?.();
        });
    });

    syncDifficultySelectors();
}

// ============================================
// DASHBOARD
// ============================================

// US-163. The dashboard was the last part of app.js still describing sections by
// hand, and the worst possible place for it: updateDashboard() and
// updateStatisticsDisplay() below are the two functions that display everything,
// so a section missing from them counts correctly in state and reads as zero to
// the learner — the silent failure the registry exists to make unrepresentable,
// still live after US-154 moved the counters. Grammar and Pronunciation each had
// to be hand-added in three places here (a stat card line, a "Today" row, an
// "Averages" row) plus a term in the Total Exercises sum. Both now read
// Sections.exercises().
//
// The markup these build is byte-for-byte what the hand-written template
// literals produced — including the indentation, which is why statRow()/statBox()
// carry explicit indent strings rather than relying on how they are written.
// Verified by rendering both versions against a fake DOM built from index.html's
// own id set and diffing every innerHTML/textContent; see the US-163 note in the
// commit. `.stat-row` and `.stat-box` are styled in styles.css and read aloud by
// the aria-live regions in index.html, so "close enough" markup is a visual and
// an accessibility regression, not a cosmetic one.

// The indentation the old template literals sat at. Two levels: rows are indented
// one step further, badges one step past their row's opening tag.
const STAT_INDENT = '            ';

/**
 * One `.stat-row`. `badge` omitted (not empty-string) means this block has no
 * comparison badges at all — the Overall and Averages blocks — and the badge line
 * is then absent rather than blank, which is what those two literals did.
 */
function statRow(label, value, badge) {
    return STAT_INDENT + '<div class="stat-row">\n' +
        STAT_INDENT + '    <span>' + label + ':</span> <strong>' + value + '</strong>\n' +
        (badge === undefined ? '' : STAT_INDENT + '    ' + badge + '\n') +
        STAT_INDENT + '</div>\n';
}

/** Fill one `.stat-box`, or do nothing if an older cached index.html lacks it. */
function statBox(id, heading, rows) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '\n' + STAT_INDENT + '<h4>' + heading + '</h4>\n' +
        rows.join('') + '        ';
}

function updateDashboard() {
    // Lifetime-total stat cards, one per row that has one. Every
    // exercise-tracking section has a card since US-175 gave Listening the one it
    // had always been missing; the guard stays because `totalCardId: null` is
    // still representable (and is what `dashboard` itself carries).
    Sections.exercises().forEach(section => {
        if (!section.totalCardId) return;
        const card = document.getElementById(section.totalCardId);
        if (!card) {
            // Every card is asserted present by __tests__/unit/sections.test.js,
            // so reaching this means a stale cached index.html (the reason the
            // Grammar and Pronunciation cards were individually guarded before)
            // or a row naming an id that does not exist. Warn rather than throw:
            // the four original cards were unguarded, and one missing card taking
            // the whole dashboard — goals, progress bar and all three stat blocks
            // — down with it is a worse outcome than one stale number.
            console.warn('updateDashboard: no #' + section.totalCardId +
                         ' card for section "' + section.id + '"');
            return;
        }
        card.textContent = state.overallStats[section.totalStatKey] || 0;
    });

    // Daily goals. Driven from the registry rather than from the keys present in
    // state.dailyGoals, so a goal a legacy save has never heard of still paints.
    Sections.goalKeys().forEach(key => {
        const el = document.getElementById(`goal${key.charAt(0).toUpperCase() + key.slice(1)}`);
        if (el) el.checked = !!state.dailyGoals[key];
    });

    // Numerator AND denominator from the registry. The denominator already was
    // (US-154); the numerator was `Object.values(state.dailyGoals)`, which counts
    // whatever keys the object happens to have. loadProgress does
    // `Object.assign(state.dailyGoals, loaded.dailyGoals)`, and Portability
    // restores that field from a file, so a backup written when a since-removed
    // section had a goal adds a key the registry has never heard of — 8 ticked out
    // of 7 goals, a progress bar past 100%. Counting the registry's keys makes the
    // fraction unable to disagree with itself.
    const goalKeys = Sections.goalKeys();
    const completedGoals = goalKeys.filter(key => state.dailyGoals[key]).length;
    const progressPercent = (completedGoals / goalKeys.length) * 100;
    document.getElementById('overallProgress').style.width = `${progressPercent}%`;
    document.getElementById('progressPercent').textContent = `${Math.round(progressPercent)}%`;
    
    // Update statistics display
    updateStatisticsDisplay();
}

function updateStatisticsDisplay() {
    // Nav order throughout, which is the order all three blocks were written in
    // by hand, so the learner sees no reshuffle.
    const sections = Sections.exercises();

    // Today's stats. `|| 0` on every counter now, where the five original rows
    // read the field bare and only the two newest used it. The values are always
    // numbers for a state built by freshCompletedExercises()/zeroMap(), so this
    // renders identically — it just means a save predating a section shows 0
    // rather than the string "undefined".
    statBox('todayStats', "📅 Today's Progress", sections.map(section => {
        const today = state.dailyStats[section.dailyStatKey] || 0;
        const average = state.overallStats.averageDaily[section.avgKey] || 0;
        // statLabel, not label: a learner counts "Words", not "Vocabulary".
        return statRow(section.statLabel, today, getComparisonBadge(today, average));
    }));

    // Overall stats. The first three rows are not per-section facts, so they stay
    // hand-written and visible; the rest come from the rows.
    const overallRows = [
        statRow('Total Days', state.overallStats.totalDays),
        statRow('Current Streak', `${state.overallStats.currentStreak} days 🔥`),
        statRow('Best Streak', `${state.overallStats.bestStreak} days 🏆`)
    ];
    // A section reported on its own "Total X" row instead of inside the sum —
    // vocabulary, and only vocabulary today. `countsInTotalExercises` is what
    // preserves that split; before the registry it was the fact that somebody
    // remembered to leave totalWords out of the addition.
    sections.filter(section => !section.countsInTotalExercises).forEach(section => {
        overallRows.push(statRow('Total ' + section.statLabel,
                                 state.overallStats[section.totalStatKey] || 0));
    });
    overallRows.push(statRow('Total Exercises', sections
        .filter(section => section.countsInTotalExercises)
        .reduce((sum, section) => sum + (state.overallStats[section.totalStatKey] || 0), 0)));
    statBox('overallStats', '📊 Overall Statistics', overallRows);

    // Averages. No badges here — there is nothing to compare an average against.
    statBox('averageStats', '📈 Daily Averages', sections.map(section =>
        statRow(section.statLabel, state.overallStats.averageDaily[section.avgKey] || 0)));
}

function getComparisonBadge(current, average) {
    if (average === 0) return '';
    if (current > average) {
        const percent = Math.round(((current - average) / average) * 100);
        return `<span class="badge badge-success">+${percent}% ⬆️</span>`;
    } else if (current < average) {
        const percent = Math.round(((average - current) / average) * 100);
        return `<span class="badge badge-warning">-${percent}% ⬇️</span>`;
    }
    return `<span class="badge badge-neutral">Average ➡️</span>`;
}

// ============================================
// VOCABULARY SECTION
// ============================================

// Generate unlimited vocabulary words algorithmically
function generateVocabularyWord(index, difficulty) {
    const wordTemplates = {
        foundation: {
            prefixes: ["", "un", "re", "pre", "dis"],
            roots: ["happy", "kind", "clear", "bright", "quick", "soft", "warm", "cool", "fresh", "clean", "safe", "calm", "fair", "pure", "wise", "bold", "keen", "mild", "neat", "rich"],
            suffixes: ["", "ly", "ness", "ful", "less"],
            adjectives: ["joyful", "peaceful", "helpful", "careful", "cheerful", "grateful", "hopeful", "playful", "useful", "wonderful", "colorful", "powerful", "beautiful", "meaningful", "successful", "thoughtful", "respectful", "delightful", "graceful", "skillful"],
            nouns: ["joy", "peace", "hope", "love", "trust", "faith", "care", "help", "light", "warmth", "smile", "dream", "gift", "friend", "home", "heart", "life", "time", "day", "way"],
            verbs: ["help", "learn", "play", "work", "read", "write", "speak", "listen", "think", "know", "feel", "see", "hear", "touch", "taste", "smell", "walk", "run", "jump", "dance"]
        },
        everyday: {
            words: ["achieve", "believe", "create", "develop", "explore", "improve", "inspire", "motivate", "organize", "practice", "progress", "realize", "succeed", "understand", "accomplish", "contribute", "demonstrate", "encourage", "facilitate", "participate"],
            concepts: ["achievement", "belief", "creation", "development", "exploration", "improvement", "inspiration", "motivation", "organization", "practice", "progress", "realization", "success", "understanding", "accomplishment", "contribution", "demonstration", "encouragement", "facilitation", "participation"]
        },
        confident: {
            words: ["analyze", "collaborate", "demonstrate", "evaluate", "implement", "integrate", "optimize", "synthesize", "transform", "validate", "articulate", "conceptualize", "differentiate", "elaborate", "formulate", "hypothesize", "illustrate", "justify", "negotiate", "prioritize"],
            abstract: ["analysis", "collaboration", "demonstration", "evaluation", "implementation", "integration", "optimization", "synthesis", "transformation", "validation", "articulation", "conceptualization", "differentiation", "elaboration", "formulation", "hypothesis", "illustration", "justification", "negotiation", "prioritization"]
        }
    };
    
    // Fall back rather than throw: this is called with state.currentDifficulty,
    // and a tier with no template block (a new tier authored in data.js before
    // its generator templates exist) must degrade, not take the section down.
    const level = wordTemplates[difficulty] ? difficulty : DEFAULT_LEVEL;
    const templates = wordTemplates[level];
    let word, definition, example;

    if (level === 'foundation') {
        const wordType = index % 3; // 0=adjective, 1=noun, 2=verb
        if (wordType === 0) {
            word = templates.adjectives[index % templates.adjectives.length];
            definition = `Describing something in a positive way`;
            example = `The ${word} person made everyone smile.`;
        } else if (wordType === 1) {
            word = templates.nouns[Math.floor(index / 3) % templates.nouns.length];
            definition = `A concept or thing that is important in life`;
            example = `${word.charAt(0).toUpperCase() + word.slice(1)} is something we all need.`;
        } else {
            word = templates.verbs[Math.floor(index / 3) % templates.verbs.length];
            definition = `An action that people do regularly`;
            example = `I ${word} every day to improve myself.`;
        }
    } else if (level === 'everyday') {
        const wordType = index % 2;
        if (wordType === 0) {
            word = templates.words[index % templates.words.length];
            definition = `To engage in an action that leads to growth or improvement`;
            example = `When you ${word}, you become better at what you do.`;
        } else {
            word = templates.concepts[Math.floor(index / 2) % templates.concepts.length];
            definition = `A concept related to personal or professional development`;
            example = `${word.charAt(0).toUpperCase() + word.slice(1)} is key to success.`;
        }
    } else {
        const wordType = index % 2;
        if (wordType === 0) {
            word = templates.words[index % templates.words.length];
            definition = `To perform a complex action requiring skill and understanding`;
            example = `Professionals ${word} strategies to achieve organizational goals.`;
        } else {
            word = templates.abstract[Math.floor(index / 2) % templates.abstract.length];
            definition = `An abstract concept important in professional contexts`;
            example = `${word.charAt(0).toUpperCase() + word.slice(1)} requires careful consideration and expertise.`;
        }
    }
    
    // Generate quiz options
    const wrongOptions = ["Something unrelated", "The opposite meaning", "A different concept"];
    const options = [definition, ...wrongOptions].sort(() => Math.random() - 0.5);
    
    return {
        word: word.charAt(0).toUpperCase() + word.slice(1),
        // No IPA source exists for generated words, so leave this empty
        // rather than fabricating `/spelling/` as if it were phonetics.
        pronunciation: '',
        definition: definition,
        example: example,
        quiz: {
            question: `What does '${word}' mean?`,
            options: options,
            correct: options.indexOf(definition)
        }
    };
}

// Show the pronunciation line only when we actually have phonetics.
// Generated words carry no IPA, and an empty element would still take up
// its margin and render as a blank gap under the word.
//
// The element id is `wordPronunciation`, renamed from the bare `pronunciation`
// in US-401: the section registry's contract is that `#{section id}` IS the
// section element, and `pronunciation` is now a section. This lookup was the
// only reader; the `.pronunciation` class it is styled by did not change.
function setPronunciationDisplay(pronunciation) {
    const el = document.getElementById('wordPronunciation');
    if (!el) return;
    const value = pronunciation || '';
    el.textContent = value;
    el.style.display = value ? '' : 'none';
}

async function loadVocabularyWord() {
    const localWords = vocabularyData[state.currentDifficulty];
    const curatedCount = localWords.length;
    
    let currentWord;
    
    // Hybrid approach: use curated first, then alternate
    if (state.currentWordIndex < curatedCount) {
        currentWord = localWords[state.currentWordIndex];
    } else {
        const adjustedIndex = state.currentWordIndex - curatedCount;
        const shouldUseCurated = adjustedIndex % 3 === 0;
        
        if (shouldUseCurated && curatedCount > 0) {
            currentWord = localWords[adjustedIndex % curatedCount];
        } else {
            // Generate new vocabulary word
            currentWord = generateVocabularyWord(state.currentWordIndex, state.currentDifficulty);
        }
    }

    // Show loading indicator
    LoadingIndicator.show('vocabulary', 'Loading word...');
    document.getElementById('currentWord').textContent = 'Loading...';

    try {
        // Try to fetch from API if it's a curated word
        let wordData;
        if (state.currentWordIndex < curatedCount) {
            wordData = await fetchWordData(currentWord.word);
        } else {
            // Use generated word data directly
            wordData = currentWord;
        }
        
        // Review mode may have STARTED while that await was in flight, and the
        // session's review step does exactly that: switchSection('vocabulary')
        // runs this loader, then startReview() paints the review card. Writing
        // here would replace the card the learner is answering with an unrelated
        // word a second later. loadReviewWord() owns the card while review mode
        // is on, so bail — `finally` below still hides the indicator.
        if (state.reviewMode) return;

        document.getElementById('currentWord').textContent = wordData.word;
        setPronunciationDisplay(wordData.pronunciation);
        document.getElementById('definition').textContent = wordData.definition;
        document.getElementById('example').textContent = wordData.example;
        wordData.difficulty = state.currentDifficulty;
        state.currentVocabWord = wordData;
        displayVocabQuiz(wordData.quiz);
        document.getElementById('vocabProgress').textContent = `${state.vocabProgress}/10`;
    } catch (error) {
        AppErrorHandler.handleError(error, 'vocabulary word', {
            showToast: true,
            fallback: null
        });
        Toast.error('Failed to load word. Please try again.');
    } finally {
        LoadingIndicator.hide('vocabulary');
    }
}

function displayVocabQuiz(quiz) {
    document.getElementById('quizQuestion').textContent = quiz.question;
    const container = document.getElementById('quizOptions');
    container.innerHTML = '';

    let answered = false;

    quiz.options.forEach((option, index) => {
        const div = document.createElement('div');
        div.className = 'quiz-option';
        div.textContent = option;
        div.onclick = () => {
            container.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected', 'correct', 'incorrect'));
            const isCorrect = index === quiz.correct;
            div.classList.add('selected', isCorrect ? 'correct' : 'incorrect');
            if (!isCorrect) {
                container.children[quiz.correct].classList.add('correct');
            }

            // Count progress and feed the spaced-repetition scheduler once per word render,
            // so re-clicking an option cannot inflate the counters.
            if (!answered) {
                answered = true;
                if (isCorrect) {
                    state.vocabProgress++;
                    state.dailyGoals.vocab = true;
                    updateStatistics('vocabulary');
                    updateDashboard();
                    saveProgress();
                }
                if (window.SRS && state.currentVocabWord) {
                    SRS.schedule(state.currentVocabWord, isCorrect);
                    updateDueCount();
                }
                if (state.reviewMode) {
                    onReviewAnswer(isCorrect);
                }
            }
        };
        container.appendChild(div);
    });
}

function initializeVocabularyButtons() {
    document.getElementById('speakWord').onclick = () => {
        speechAPI.speak(`${document.getElementById('currentWord').textContent}. ${document.getElementById('definition').textContent}`);
    };
    
    document.getElementById('prevWord').onclick = () => {
        if (state.currentWordIndex > 0) {
            state.currentWordIndex--;
            loadVocabularyWord();
            saveProgress();
        }
    };
    
    document.getElementById('nextWord').onclick = () => {
        state.currentWordIndex++;
        if (state.vocabProgress >= 10) state.vocabProgress = 0;
        loadVocabularyWord();
        saveProgress();
    };

    const startBtn = document.getElementById('startReview');
    const exitBtn = document.getElementById('exitReview');
    if (startBtn) startBtn.onclick = startReview;
    if (exitBtn) exitBtn.onclick = exitReview;

    updateDueCount();
}

// ============================================
// SPACED REPETITION REVIEW MODE
// ============================================

// Refresh the "Review Due (N)" badge from the SRS scheduler.
function updateDueCount() {
    if (!window.SRS) return;
    const el = document.getElementById('dueCount');
    if (el) el.textContent = SRS.dueCount();
}

// Show/hide the parts of the vocab UI that don't apply during review.
function setReviewUI(active) {
    const startBtn = document.getElementById('startReview');
    const exitBtn = document.getElementById('exitReview');
    const nav = document.querySelector('#vocabulary .navigation-buttons');
    const status = document.getElementById('reviewStatus');
    if (startBtn) startBtn.style.display = active ? 'none' : '';
    if (exitBtn) exitBtn.style.display = active ? '' : 'none';
    if (nav) nav.style.display = active ? 'none' : '';
    if (status) status.textContent = '';
}

function startReview() {
    if (!window.SRS) return;
    const queue = SRS.getDueWords();
    if (queue.length === 0) {
        if (window.Toast) Toast.info('Nothing to review right now — great job! Learn some new words to build your queue.');
        return;
    }
    state.reviewMode = true;
    state.reviewQueue = queue;
    setReviewUI(true);
    loadReviewWord();
}

function exitReview() {
    state.reviewMode = false;
    state.reviewQueue = [];
    setReviewUI(false);
    updateDueCount();
    loadVocabularyWord();
}

// Render the word at the front of the review queue directly from SRS
// data — no API call, so review works fully offline.
function loadReviewWord() {
    if (!state.reviewMode) return;
    if (!state.reviewQueue || state.reviewQueue.length === 0) {
        if (window.Toast) Toast.success('Review complete! 🎉');
        exitReview();
        return;
    }
    const wordData = state.reviewQueue[0];
    document.getElementById('currentWord').textContent = wordData.word;
    setPronunciationDisplay(wordData.pronunciation);
    document.getElementById('definition').textContent = wordData.definition || '';
    document.getElementById('example').textContent = wordData.example || '';
    state.currentVocabWord = wordData;
    displayVocabQuiz(wordData.quiz);

    const status = document.getElementById('reviewStatus');
    if (status) status.textContent = `${state.reviewQueue.length} word(s) left to review`;
}

// After an answer in review mode: drop the word if correct, otherwise
// rotate it to the back of the queue to try again later this session.
function onReviewAnswer(isCorrect) {
    if (!state.reviewMode || !state.reviewQueue.length) return;
    const word = state.reviewQueue.shift();
    if (!isCorrect) state.reviewQueue.push(word);
    setTimeout(loadReviewWord, 1100);
}

// ============================================
// SENTENCE FORMATION
// ============================================

function loadSentenceExercise() {
    const difficulty = state.currentDifficulty;
    const exercises = sentenceExercises[difficulty];
    
    // Reset attempts and hint for new exercise
    state.sentenceAttempts = 0;
    state.sentenceHintUsed = false;
    hideHintButton();
    
    // Use local data or generate new exercise
    let exercise;
    if (state.currentSentenceIndex < exercises.length) {
        exercise = exercises[state.currentSentenceIndex];
    } else {
        // Generate unlimited exercises
        exercise = generateSentenceExercise(state.currentSentenceIndex);
    }
    
    // Store current exercise for hint system
    state.currentExercise = exercise;
    
    // Choose the exercise type deterministically from the exercise index so
    // the same exercise always renders in the same mode. A random pick made
    // retrying a failed exercise impossible: navigating away and back would
    // swap fill-in-the-blank for drag-and-drop.
    const exerciseTypes = ['dragdrop', 'fillblank', 'multiplechoice', 'reorder'];
    const exerciseType = exerciseTypes[state.currentSentenceIndex % exerciseTypes.length];

    // Hide all exercise containers
    document.querySelectorAll('.sentence-exercise-container').forEach(el => el.style.display = 'none');

    // Show selected exercise type
    switch(exerciseType) {
        case 'dragdrop':
            loadDragDropSentence(exercise);
            document.getElementById('dragDropContainer').style.display = 'block';
            break;
        case 'fillblank':
            // exercise.fillBlank is not guaranteed to be usable, so only show
            // the fill-in-the-blank screen if one could actually be rendered.
            // loadFillBlankExercise() rebuilds the prompt from the exercise's
            // own words when the supplied one is missing or malformed, and
            // returns false only when there is nothing at all to blank out.
            // In that case drop to drag-and-drop, which needs just words and
            // correct. The choice is data-driven, not random, so the same
            // index always lands on the same mode and a failed item can be
            // retried exactly as it was first seen.
            if (loadFillBlankExercise(exercise.fillBlank)) {
                document.getElementById('fillBlankExerciseContainer').style.display = 'block';
            } else {
                loadDragDropSentence(exercise);
                document.getElementById('dragDropContainer').style.display = 'block';
            }
            break;
        case 'multiplechoice':
            loadMultipleChoiceSentence(exercise);
            document.getElementById('multipleChoiceContainer').style.display = 'block';
            break;
        case 'reorder':
            loadReorderSentence(exercise);
            document.getElementById('reorderContainer').style.display = 'block';
            break;
    }
    
    updateNavigationButtons('sentences');
}

function loadDragDropSentence(exercise) {
    const wordBank = document.getElementById('wordBank');
    const sentenceBuilder = document.getElementById('sentenceBuilder');
    wordBank.innerHTML = '';
    sentenceBuilder.innerHTML = '<p class="placeholder">Drop words here...</p>';
    state.sentenceBuilderWords = [];
    
    [...exercise.words].sort(() => Math.random() - 0.5).forEach(word => {
        const chip = document.createElement('div');
        chip.className = 'word-chip';
        // Sanitize word content before displaying
        const sanitizedWord = AppErrorHandler.sanitizeInput(word);
        chip.textContent = sanitizedWord;
        chip.draggable = true;
        chip.ondragstart = (e) => {
            try {
                // Validate word before allowing drag
                const validatedWord = AppErrorHandler.validateInput(sanitizedWord, {
                    required: true,
                    maxLength: 100,
                    pattern: /^[a-zA-Z0-9\s.,!?'\-]+$/
                });
                e.dataTransfer.setData('text', validatedWord);
                chip.classList.add('dragging');
            } catch (error) {
                e.preventDefault();
                AppErrorHandler.handleError(error, 'drag operation');
                Toast.warning('Invalid word detected');
            }
        };
        chip.ondragend = () => chip.classList.remove('dragging');
        chip.onclick = () => {
            try {
                const placeholder = sentenceBuilder.querySelector('.placeholder');
                if (placeholder) placeholder.remove();
                sentenceBuilder.classList.add('has-words');
                sentenceBuilder.appendChild(chip);
                // Validate before adding to state
                const validatedText = AppErrorHandler.validateInput(chip.textContent, {
                    required: true,
                    maxLength: 100
                });
                state.sentenceBuilderWords.push(validatedText);
            } catch (error) {
                AppErrorHandler.handleError(error, 'word selection');
                Toast.warning('Invalid word selection');
            }
        };
        wordBank.appendChild(chip);
    });
    sentenceBuilder.dataset.correct = exercise.correct;
}

function initializeSentenceBuilderDragDrop() {
    const builder = document.getElementById('sentenceBuilder');
    builder.ondragover = (e) => e.preventDefault();
    builder.ondrop = (e) => {
        e.preventDefault();
        try {
            // Validate dropped data
            const droppedText = e.dataTransfer.getData('text');
            if (droppedText) {
                const validatedText = AppErrorHandler.validateInput(droppedText, {
                    required: true,
                    maxLength: 100,
                    pattern: /^[a-zA-Z0-9\s.,!?'\-]+$/
                });
            }
            const chip = document.querySelector('.word-chip.dragging');
            if (chip) chip.click();
        } catch (error) {
            AppErrorHandler.handleError(error, 'drop operation');
            Toast.warning('Invalid drop operation');
        }
    };
}

// A fill-in-the-blank prompt is only usable if rendering it actually produces a
// gradable blank: a sentence string holding a whole-word "___", plus an answer
// to compare the typed value against.
//
// Two ways the data breaks this. Curated entries in data.js carry fillBlank by
// hand, so nothing stops a new entry from shipping without one. Generated
// exercises build the blank with a plain String.replace of the middle word,
// which happily lands inside a longer word earlier in the sentence - "and" in
// "Successful leadership requires understanding and implementing..." blanks out
// as "underst___ing", a blank no learner can answer. Both are rejected here.
function isUsableFillBlank(fillBlank) {
    if (!fillBlank || typeof fillBlank.sentence !== 'string') return false;
    if (typeof fillBlank.answer !== 'string' || !fillBlank.answer.trim()) return false;

    const blankAt = fillBlank.sentence.indexOf('___');
    if (blankAt === -1) return false;

    // The blank must stand on its own rather than sitting mid-word.
    const isBoundary = (character) => character === undefined || !/[A-Za-z0-9]/.test(character);
    return isBoundary(fillBlank.sentence[blankAt - 1]) && isBoundary(fillBlank.sentence[blankAt + 3]);
}

// Build a fill-in-the-blank prompt out of the exercise's own words, for
// exercises whose supplied fillBlank is missing or unusable.
//
// Blanking a token by position rather than by String.replace guarantees exactly
// one "___" and an answer that grades correctly, and always taking the middle
// token keeps the result deterministic: the same exercise yields the same blank
// on every render, so a learner can retry an item they failed.
function deriveFillBlank(exercise) {
    if (!exercise) return null;

    const source = Array.isArray(exercise.words) && exercise.words.length
        ? exercise.words
        : (typeof exercise.correct === 'string' ? exercise.correct.split(' ') : []);
    const words = source.filter(word => typeof word === 'string' && word.trim());

    // One word alone would blank the whole sentence away, leaving no context.
    if (words.length < 2) return null;

    const blankIndex = Math.floor(words.length / 2);
    return {
        sentence: words.map((word, i) => (i === blankIndex ? '___' : word)).join(' '),
        answer: words[blankIndex],
        options: [words[blankIndex]]
    };
}

// Returns true when a blank was rendered, false when this exercise cannot
// support the mode at all, so the caller can show a different one instead.
function loadFillBlankExercise(fillBlank) {
    // Do not trust the caller: reading .sentence off a missing prompt used to
    // throw and leave the learner staring at an empty exercise. Fall back to a
    // blank derived from the exercise currently on screen.
    let prompt = isUsableFillBlank(fillBlank) ? fillBlank : deriveFillBlank(state.currentExercise);
    if (!isUsableFillBlank(prompt)) return false;

    document.getElementById('fillBlankInstruction').textContent = prompt.sentence;
    const container = document.getElementById('fillBlankContainer');
    container.innerHTML = '';
    prompt.sentence.split('___').forEach((part, i, arr) => {
        container.appendChild(document.createTextNode(part));
        if (i < arr.length - 1) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'blank-input';
            input.dataset.answer = prompt.answer;
            container.appendChild(input);
        }
    });
    return true;
}

// Multiple Choice Sentence Exercise
function loadMultipleChoiceSentence(exercise) {
    const container = document.getElementById('multipleChoiceContent');
    container.innerHTML = '';
    
    // Create question
    const question = document.createElement('p');
    question.className = 'instruction';
    question.textContent = 'Choose the correct sentence:';
    container.appendChild(question);
    
    // Generate wrong options
    const wrongOptions = [
        exercise.words.slice().reverse().join(' '),
        exercise.words.slice().sort(() => Math.random() - 0.5).join(' '),
        exercise.words.slice(1).concat(exercise.words[0]).join(' ')
    ];
    
    // Mix correct and wrong options
    const allOptions = [exercise.correct, ...wrongOptions.slice(0, 3)].sort(() => Math.random() - 0.5);
    
    // Create radio buttons
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'sentence-options';
    allOptions.forEach((option, index) => {
        const label = document.createElement('label');
        label.className = 'sentence-option';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'sentenceChoice';
        radio.value = option;
        radio.dataset.correct = exercise.correct;
        label.appendChild(radio);
        label.appendChild(document.createTextNode(option));
        optionsDiv.appendChild(label);
    });
    container.appendChild(optionsDiv);
}

// Reorder Words Exercise
function loadReorderSentence(exercise) {
    const container = document.getElementById('reorderContent');
    container.innerHTML = '';
    
    const instruction = document.createElement('p');
    instruction.className = 'instruction';
    instruction.textContent = 'Click the words in the correct order:';
    container.appendChild(instruction);
    
    const wordsDiv = document.createElement('div');
    wordsDiv.className = 'reorder-words';
    wordsDiv.dataset.correct = exercise.correct;
    
    const shuffled = [...exercise.words].sort(() => Math.random() - 0.5);
    shuffled.forEach(word => {
        const btn = document.createElement('button');
        btn.className = 'word-btn';
        btn.textContent = word;
        btn.onclick = () => selectWordInOrder(btn);
        wordsDiv.appendChild(btn);
    });
    container.appendChild(wordsDiv);
    
    const selectedDiv = document.createElement('div');
    selectedDiv.id = 'selectedWords';
    selectedDiv.className = 'selected-words';
    selectedDiv.innerHTML = '<p class="placeholder">Click words above...</p>';
    container.appendChild(selectedDiv);
}

function selectWordInOrder(btn) {
    if (btn.classList.contains('selected')) return;
    
    btn.classList.add('selected');
    btn.disabled = true;
    
    const selectedDiv = document.getElementById('selectedWords');
    const placeholder = selectedDiv.querySelector('.placeholder');
    if (placeholder) placeholder.remove();
    
    const wordSpan = document.createElement('span');
    wordSpan.className = 'selected-word';
    wordSpan.textContent = btn.textContent;
    selectedDiv.appendChild(wordSpan);
}

function initializeSentenceButtons() {
    // Universal check button
    document.getElementById('checkSentence').onclick = () => {
        // Clear all feedbacks
        document.getElementById('sentenceFeedback').classList.remove('visible');
        
        let isCorrect = false;
        let correctAnswer = '';
        
        // Check which exercise type is visible
        if (document.getElementById('dragDropContainer') && document.getElementById('dragDropContainer').style.display === 'block') {
            const userSentence = state.sentenceBuilderWords.join(' ');
            correctAnswer = document.getElementById('sentenceBuilder').dataset.correct;
            isCorrect = userSentence.toLowerCase() === correctAnswer.toLowerCase();
        } else if (document.getElementById('fillBlankExerciseContainer') && document.getElementById('fillBlankExerciseContainer').style.display === 'block') {
            const inputs = document.querySelectorAll('.blank-input');
            isCorrect = true;
            inputs.forEach(input => {
                input.style.borderColor = '';
                const correct = input.value.trim().toLowerCase() === input.dataset.answer.toLowerCase();
                input.style.borderColor = correct ? '#4CAF50' : '#f44336';
                if (!correct) isCorrect = false;
            });
            correctAnswer = 'the blanks correctly';
        } else if (document.getElementById('multipleChoiceContainer') && document.getElementById('multipleChoiceContainer').style.display === 'block') {
            const selected = document.querySelector('input[name="sentenceChoice"]:checked');
            if (selected) {
                correctAnswer = selected.dataset.correct;
                isCorrect = selected.value === correctAnswer;
                // Highlight selection
                document.querySelectorAll('.sentence-option').forEach(opt => {
                    opt.style.background = '';
                    const radio = opt.querySelector('input');
                    if (radio.checked) {
                        opt.style.background = isCorrect ? '#e8f5e9' : '#ffebee';
                    }
                });
            }
        } else if (document.getElementById('reorderContainer') && document.getElementById('reorderContainer').style.display === 'block') {
            const selectedWords = Array.from(document.querySelectorAll('#selectedWords .selected-word')).map(s => s.textContent);
            correctAnswer = document.querySelector('.reorder-words').dataset.correct;
            isCorrect = selectedWords.join(' ').toLowerCase() === correctAnswer.toLowerCase();
        }
        
        if (isCorrect) {
            showFeedback('sentenceFeedback', '✓ Correct!', 'success');
            state.dailyGoals.sentence = true;
            // Count the exercise once, even if "Check Answer" is clicked again.
            if (!isExerciseCompleted('sentences', state.currentSentenceIndex)) {
                updateStatistics('sentences');
                markExerciseComplete('sentences', state.currentSentenceIndex);
            }
            updateDashboard();
            saveProgress();
            hideHintButton();
        } else {
            // Increment attempts
            state.sentenceAttempts++;
            
            // Show hint button after 3 attempts and keep it visible
            if (state.sentenceAttempts >= 3) {
                showHintButton();
                if (state.sentenceHintUsed) {
                    // After hint is used, remind user to check the hint
                    showFeedback('sentenceFeedback', `✗ Incorrect. Check the hint above for help! (Attempt ${state.sentenceAttempts})`, 'error');
                } else {
                    // Before hint is used, prompt user to click hint button
                    showFeedback('sentenceFeedback', `✗ Incorrect. Click the hint button for help! (Attempt ${state.sentenceAttempts})`, 'error');
                }
            } else {
                showFeedback('sentenceFeedback', `✗ Incorrect. Try again! (Attempt ${state.sentenceAttempts}/3)`, 'error');
            }
        }
    };
    
    // Hint button handler
    document.getElementById('sentenceHint').onclick = () => {
        if (state.sentenceAttempts >= 3 && !state.sentenceHintUsed) {
            state.sentenceHintUsed = true;
            showSentenceHint();
        }
    };
    
    document.getElementById('resetSentence').onclick = () => {
        // Reset the current exercise without changing to a new one
        state.sentenceAttempts = 0;
        state.sentenceHintUsed = false;
        
        // Clear feedback and hint
        document.getElementById('sentenceFeedback').classList.remove('visible');
        document.getElementById('hintDisplay').classList.remove('visible');
        
        // Reset hint button to initial state
        const hintBtn = document.getElementById('sentenceHint');
        if (hintBtn) {
            hintBtn.style.display = 'none';
            hintBtn.textContent = '💡 Get Hint';
            hintBtn.disabled = false;
            hintBtn.classList.remove('pulse');
            hintBtn.style.opacity = '1';
            hintBtn.style.cursor = 'pointer';
        }
        
        // Reload the same exercise (don't increment index)
        const difficulty = state.currentDifficulty;
        const exercises = sentenceExercises[difficulty];
        let exercise;
        
        if (state.currentSentenceIndex < exercises.length) {
            exercise = exercises[state.currentSentenceIndex];
        } else {
            exercise = generateSentenceExercise(state.currentSentenceIndex);
        }
        
        state.currentExercise = exercise;
        
        // Determine which exercise type is currently visible and reload it
        if (document.getElementById('dragDropContainer').style.display === 'block') {
            loadDragDropSentence(exercise);
        } else if (document.getElementById('fillBlankExerciseContainer').style.display === 'block') {
            loadFillBlankExercise(exercise.fillBlank);
        } else if (document.getElementById('multipleChoiceContainer').style.display === 'block') {
            loadMultipleChoiceSentence(exercise);
        } else if (document.getElementById('reorderContainer').style.display === 'block') {
            loadReorderSentence(exercise);
        }
    };
    
    document.getElementById('prevSentence').onclick = () => {
        if (state.currentSentenceIndex > 0) {
            state.currentSentenceIndex--;
            loadSentenceExercise();
            document.getElementById('sentenceFeedback').classList.remove('visible');
            document.getElementById('hintDisplay').classList.remove('visible');
            saveProgress();
        }
    };
    
    document.getElementById('nextSentence').onclick = () => {
        state.currentSentenceIndex++;
        loadSentenceExercise();
        document.getElementById('sentenceFeedback').classList.remove('visible');
        document.getElementById('hintDisplay').classList.remove('visible');
        saveProgress();
    };
}

// ============================================
// HINT SYSTEM FOR SENTENCES
// ============================================

function showHintButton() {
    const hintBtn = document.getElementById('sentenceHint');
    if (hintBtn) {
        hintBtn.style.display = 'inline-block';
        hintBtn.classList.add('pulse');
    }
}

function hideHintButton() {
    const hintBtn = document.getElementById('sentenceHint');
    if (hintBtn) {
        hintBtn.style.display = 'none';
        hintBtn.classList.remove('pulse');
    }
    const hintDisplay = document.getElementById('hintDisplay');
    if (hintDisplay) {
        hintDisplay.classList.remove('visible');
    }
}

function showSentenceHint() {
    if (!state.currentExercise) {
        console.error('No current exercise found!');
        return;
    }
    
    const hintDisplay = document.getElementById('hintDisplay');
    if (!hintDisplay) {
        console.error('hintDisplay element not found!');
        return;
    }
    
    // Get words from the correct sentence
    const words = state.currentExercise.words || state.currentExercise.correct.split(' ');
    
    // For fill-in-the-blank exercises, find words that are NOT already visible
    const fillBlankContainer = document.getElementById('fillBlankExerciseContainer');
    let availableWords = [...words];
    
    if (fillBlankContainer && fillBlankContainer.style.display === 'block') {
        // Get the visible text from the fill blank instruction
        const instruction = document.getElementById('fillBlankInstruction');
        if (instruction) {
            const visibleText = instruction.textContent.toLowerCase();
            // Filter out words that are already visible in the sentence
            availableWords = words.filter(word =>
                !visibleText.includes(word.toLowerCase()) || word === '___'
            );
        }
    }
    
    // If no available words (shouldn't happen), fall back to all words
    if (availableWords.length === 0) {
        availableWords = words;
    }
    
    // Select a random word from available words
    const randomIndex = Math.floor(Math.random() * availableWords.length);
    const hintWord = availableWords[randomIndex];
    
    // Find the position of this word in the original sentence
    const position = words.indexOf(hintWord) + 1;
    
    hintDisplay.innerHTML = `
        <div class="hint-content">
            <span class="hint-icon">💡</span>
            <strong>Hint:</strong> Word #${position} is "<span class="hint-word">${hintWord}</span>"
        </div>
    `;
    hintDisplay.classList.add('visible');
    
    // Keep the hint button visible but disable it and change text
    const hintBtn = document.getElementById('sentenceHint');
    if (hintBtn) {
        hintBtn.textContent = '💡 Hint Shown';
        hintBtn.disabled = true;
        hintBtn.classList.remove('pulse');
        hintBtn.style.opacity = '0.6';
        hintBtn.style.cursor = 'not-allowed';
    }
}

// ============================================
// READING SECTION
// ============================================

// Generate algorithmic reading passages for unlimited content
function generateReadingPassage(index, difficulty) {
    const passageTemplates = {
        foundation: [
            (i) => {
                const subjects = ["The park", "My school", "Our garden", "The library", "The beach"];
                const activities = ["is a wonderful place", "has many things", "is very special", "makes me happy", "is my favorite"];
                const details = ["Children play there every day", "I visit it often", "Everyone enjoys it", "It is always clean", "People are friendly there"];
                const feelings = ["I feel happy when I go there", "It makes me smile", "I love spending time there", "It is a peaceful place", "I always have fun there"];
                
                const subject = subjects[i % subjects.length];
                const activity = activities[Math.floor(i / subjects.length) % activities.length];
                const detail = details[Math.floor(i / (subjects.length * activities.length)) % details.length];
                const feeling = feelings[Math.floor(i / (subjects.length * activities.length * details.length)) % feelings.length];
                
                return {
                    title: subject,
                    text: `${subject} ${activity}. ${detail}. ${feeling}. I go there whenever I can. It is a great place to be.`,
                    questions: [
                        {
                            question: `What is special about ${subject.toLowerCase()}?`,
                            options: ["Nothing", "It is wonderful", "It is boring", "It is far away"],
                            correct: 1
                        },
                        {
                            question: "How does the narrator feel?",
                            options: ["Sad", "Happy", "Angry", "Tired"],
                            correct: 1
                        },
                        {
                            question: "Does the narrator visit often?",
                            options: ["No", "Yes", "Never", "Sometimes"],
                            correct: 1
                        }
                    ],
                    dictation: feeling
                };
            }
        ],
        everyday: [
            (i) => {
                const topics = ["Reading books", "Learning languages", "Helping others", "Staying healthy", "Being creative"];
                const benefits = ["improves your mind", "opens new opportunities", "makes a difference", "keeps you strong", "develops your talents"];
                const examples = ["Many successful people read daily", "Bilingual people have more job options", "Small acts of kindness matter", "Exercise and good food are key", "Artists practice their skills regularly"];
                const conclusions = ["It is worth the effort", "You will see positive results", "Everyone can benefit from this", "Start today and be consistent", "The rewards are significant"];
                
                const topic = topics[i % topics.length];
                const benefit = benefits[Math.floor(i / topics.length) % benefits.length];
                const example = examples[Math.floor(i / (topics.length * benefits.length)) % examples.length];
                const conclusion = conclusions[Math.floor(i / (topics.length * benefits.length * examples.length)) % conclusions.length];
                
                return {
                    title: `The Value of ${topic}`,
                    text: `${topic} ${benefit}. When you engage in this activity, you grow as a person. ${example}. This shows how important it is. ${conclusion}. Remember, consistent practice leads to improvement.`,
                    questions: [
                        {
                            question: `What does ${topic.toLowerCase()} do?`,
                            options: ["Nothing", "Improves you", "Wastes time", "Costs money"],
                            correct: 1
                        },
                        {
                            question: "What is needed for improvement?",
                            options: ["Luck", "Consistent practice", "Money", "Talent only"],
                            correct: 1
                        },
                        {
                            question: "Who can benefit?",
                            options: ["No one", "Everyone", "Only experts", "Only children"],
                            correct: 1
                        }
                    ],
                    dictation: conclusion
                };
            }
        ],
        confident: [
            (i) => {
                const concepts = ["Effective communication", "Strategic thinking", "Continuous learning", "Team collaboration", "Problem solving"];
                const importance = ["is essential in professional environments", "drives organizational success", "ensures long-term growth", "creates competitive advantages", "leads to innovative solutions"];
                const applications = ["Leaders who communicate well inspire their teams", "Strategic planners anticipate future challenges", "Lifelong learners adapt to change", "Collaborative teams achieve more together", "Analytical thinkers find creative solutions"];
                const implications = ["Organizations that prioritize this succeed", "Individuals who develop this skill advance", "Companies that embrace this thrive", "Teams that practice this excel", "Professionals who master this lead"];
                
                const concept = concepts[i % concepts.length];
                const imp = importance[Math.floor(i / concepts.length) % importance.length];
                const app = applications[Math.floor(i / (concepts.length * importance.length)) % applications.length];
                const impl = implications[Math.floor(i / (concepts.length * importance.length * applications.length)) % implications.length];
                
                return {
                    title: concept,
                    text: `${concept} ${imp}. In today's dynamic business landscape, this capability has become increasingly valuable. ${app}. This demonstrates the practical impact of developing such competencies. ${impl}. Therefore, investing time and resources in building these skills yields significant returns.`,
                    questions: [
                        {
                            question: `Why is ${concept.toLowerCase()} important?`,
                            options: ["It is not important", "It is essential for success", "It is optional", "It is outdated"],
                            correct: 1
                        },
                        {
                            question: "What happens to organizations that prioritize this?",
                            options: ["They fail", "They succeed", "Nothing changes", "They struggle"],
                            correct: 1
                        },
                        {
                            question: "What does investing in these skills yield?",
                            options: ["Nothing", "Significant returns", "Losses", "Confusion"],
                            correct: 1
                        }
                    ],
                    dictation: impl
                };
            }
        ]
    };
    
    const templates = passageTemplates[difficulty] || passageTemplates[DEFAULT_LEVEL];
    const templateIndex = index % templates.length;
    const templateFunction = templates[templateIndex];
    
    return templateFunction(Math.floor(index / templates.length));
}

function loadReadingPassage() {
    const curatedPassages = readingPassages[state.currentDifficulty];
    const curatedCount = curatedPassages.length;
    
    let passage;
    
    // Strategy: Use curated for first N, then alternate between curated and generated
    if (state.currentPassageIndex < curatedCount) {
        passage = curatedPassages[state.currentPassageIndex];
    } else {
        const adjustedIndex = state.currentPassageIndex - curatedCount;
        const shouldUseCurated = adjustedIndex % 3 === 0;
        
        if (shouldUseCurated && curatedCount > 0) {
            passage = curatedPassages[adjustedIndex % curatedCount];
        } else {
            // Generate new reading passage
            passage = generateReadingPassage(state.currentPassageIndex, state.currentDifficulty);
        }
    }
    
    document.getElementById('passageTitle').textContent = passage.title;
    document.getElementById('passageText').textContent = passage.text;
    loadComprehensionQuestions(passage.questions);
    document.getElementById('playDictation').dataset.text = passage.dictation;
    updateNavigationButtons('reading');
}

function loadComprehensionQuestions(questions) {
    const container = document.getElementById('comprehensionQuestions');
    container.innerHTML = '';
    questions.forEach((q, qi) => {
        const div = document.createElement('div');
        div.className = 'question-item';
        div.innerHTML = `<p>${qi + 1}. ${q.question}</p><div class="question-options"></div>`;
        const opts = div.querySelector('.question-options');
        q.options.forEach((opt, oi) => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="radio" name="q${qi}" value="${oi}" data-correct="${q.correct}">${opt}`;
            opts.appendChild(label);
        });
        container.appendChild(div);
    });
}

function initializeReadingButtons() {
    // Play button
    document.getElementById('readAloud').onclick = () => {
        const text = document.getElementById('passageText').textContent;
        speechAPI.speak(text, 0.9);
    };
    
    // Pause button
    const pauseBtn = document.getElementById('pauseReading');
    if (pauseBtn) {
        pauseBtn.onclick = () => speechAPI.pause();
    }
    
    // Resume button
    const resumeBtn = document.getElementById('resumeReading');
    if (resumeBtn) {
        resumeBtn.onclick = () => speechAPI.resume();
    }
    
    // Stop button
    const stopBtn = document.getElementById('stopReading');
    if (stopBtn) {
        stopBtn.onclick = () => speechAPI.stop();
    }
    
    // Replay button
    const replayBtn = document.getElementById('replayReading');
    if (replayBtn) {
        replayBtn.onclick = () => speechAPI.replay();
    }
    
    // Initialize controls state
    updateReadingControls('stopped');
    
    document.getElementById('prevReading').onclick = () => {
        if (state.currentPassageIndex > 0) {
            state.currentPassageIndex--;
            loadReadingPassage();
            document.getElementById('comprehensionFeedback').classList.remove('visible');
            document.getElementById('dictationFeedback').classList.remove('visible');
            saveProgress();
        }
    };
    
    document.getElementById('nextReading').onclick = () => {
        state.currentPassageIndex++;
        loadReadingPassage();
        document.getElementById('comprehensionFeedback').classList.remove('visible');
        document.getElementById('dictationFeedback').classList.remove('visible');
        saveProgress();
    };
    
    document.getElementById('checkComprehension').onclick = () => {
        // Clear previous feedback
        document.getElementById('comprehensionFeedback').classList.remove('visible');
        
        const questions = document.querySelectorAll('.question-item');
        let correct = 0;
        questions.forEach(q => {
            // Reset background before checking
            q.style.background = '';
            const sel = q.querySelector('input:checked');
            if (sel && parseInt(sel.value) === parseInt(sel.dataset.correct)) {
                correct++;
                q.style.background = '#e8f5e9';
            } else {
                q.style.background = '#ffebee';
            }
        });
        const msg = `${correct}/${questions.length} correct!`;
        if (correct === questions.length) {
            showFeedback('comprehensionFeedback', `✓ Perfect! ${msg}`, 'success');
            state.dailyGoals.reading = true;
            // A passage counts once, no matter which success path completes it.
            if (!isExerciseCompleted('reading', state.currentPassageIndex)) {
                updateStatistics('reading');
                markExerciseComplete('reading', state.currentPassageIndex);
            }
            updateDashboard();
            saveProgress();
        } else {
            showFeedback('comprehensionFeedback', msg, 'info');
        }
    };
    
    document.getElementById('playDictation').onclick = function() { speechAPI.speak(this.dataset.text, 0.8); };
    
    document.getElementById('checkDictation').onclick = () => {
        // Clear previous feedback
        document.getElementById('dictationFeedback').classList.remove('visible');

        const input = document.getElementById('dictationInput').value;
        const correct = document.getElementById('playDictation').dataset.text;

        // Validate input
        try {
            const sanitizedInput = AppErrorHandler.validateInput(input, {
                required: true,
                minLength: 1,
                maxLength: 500
            });

            const sim = sanitizedInput.trim().toLowerCase() === correct.toLowerCase() ? 1 : 0.5;
            if (sim > 0.8) {
                showFeedback('dictationFeedback', '✓ Excellent!', 'success');
                Toast.success('Dictation completed successfully!');
                state.dailyGoals.reading = true;
                // Dictation is a separate exercise, so it must not re-count a passage
                // that comprehension already completed.
                if (!isExerciseCompleted('reading', state.currentPassageIndex)) {
                    updateStatistics('reading');
                    markExerciseComplete('reading', state.currentPassageIndex);
                }
                updateDashboard();
                saveProgress();
            } else {
                showFeedback('dictationFeedback', `Correct: "${correct}"`, 'info');
            }
        } catch (error) {
            showFeedback('dictationFeedback', error.message, 'error');
            Toast.error('Please enter your answer before checking');
        }
    };
}

// ============================================
// LISTENING SECTION
// ============================================

// The one place a listening sentence is chosen. Pure in (index, difficulty) and
// free of Math.random, which is what makes the exercise retryable: a learner who
// fails, navigates away and comes back gets the same sentence, not a new one.
// Use hybrid approach: curated sentences + generated sentences.
function getListeningSentence(index, difficulty) {
    const level = difficulty || state.currentDifficulty;
    const curatedExercises = listeningExercises[level] || [];
    const curatedCount = curatedExercises.length;

    // Strategy: Use curated for first N, then alternate between curated and generated
    if (index < curatedCount) {
        return curatedExercises[index];
    }

    const adjustedIndex = index - curatedCount;
    const shouldUseCurated = adjustedIndex % 3 === 0;

    if (shouldUseCurated && curatedCount > 0) {
        return curatedExercises[adjustedIndex % curatedCount];
    }

    // Generated listening sentence. generateAlgorithmicSentence picks its template
    // and its slot words from the index alone, so `.correct` is stable for a given
    // (index, difficulty); only its unused fillBlank.options shuffles.
    return generateAlgorithmicSentence(index, level).correct;
}

function loadListeningExercise() {
    const sentence = getListeningSentence(state.currentListeningIndex, state.currentDifficulty);

    // One string drives all three: what is shown, what is spoken, and what the
    // learner is asked to say back. Read-aloud means reading *this* sentence, so
    // the target cannot drift from the audio. It used to be a random vocabulary
    // word, which made the task "say an unrelated word" and made a full match
    // trivial — a one-word target is matched by any sentence containing it.
    document.getElementById('listenSentence').textContent = sentence;
    document.getElementById('playListening').dataset.text = sentence;
    document.getElementById('targetWord').textContent = sentence;
    updateNavigationButtons('listening');
}

// Vocabulary items for the current level that the recogniser failed to match in a
// read-aloud attempt. Returns full word objects, not strings: SRS.getDueWords()
// only surfaces records that carry a word payload with a quiz, so lapsing a bare
// string would write a record the review queue can never show.
function missedVocabularyWords(diff) {
    const words = vocabularyData[state.currentDifficulty] || [];
    const missedKeys = new Set(diff.missed.map(normalizeSpeechWord).filter(key => key.length > 0));
    return words.filter(entry => missedKeys.has(normalizeSpeechWord(entry.word)));
}

// TEACHING_METHODOLOGY.md §3 lists "read-aloud failure" as a reset trigger for a
// vocabulary item. The sentence itself is not an SRS item, so what we lapse is the
// vocabulary words inside it that the recogniser did not match. Three deliberate
// limits, because a recogniser miss is weak evidence:
//  - Only words in the level's vocabulary list. Function words ("a", "the") are
//    what the recogniser drops most and are not items we teach.
//  - Only when the recogniser matched more than half the sentence. If most of the
//    sentence failed, the evidence is about the microphone, the noise floor or the
//    recogniser, not about particular words, and lapsing on it would corrupt the
//    schedule with false lapses.
//  - Lapse only, never success. A recogniser match is not evidence the learner
//    knows the word (principle 3), so it must never extend an interval.
// A lapse here means "due for review again", not "you mispronounced this" — which
// is the honest response to "we could not verify you produced this word".
function recordReadAloudLapses(diff) {
    if (!window.SRS || diff.totalCount === 0) return [];
    if (diff.matchedCount * 2 <= diff.totalCount) return [];

    const lapsed = missedVocabularyWords(diff);
    // selfReport(), not schedule(word, false). A graded lapse increments `lapses`,
    // zeroes `reps` and drops `ease` — it records that the learner got the word
    // wrong. All we actually know is that a speech recogniser did not match it,
    // which is not the same claim (FR-SRS-5). selfReport brings the word back
    // sooner without certifying anything about the learner's knowledge.
    lapsed.forEach(wordObj => SRS.selfReport(wordObj, false));
    if (lapsed.length > 0) {
        updateDueCount();
    }
    return lapsed;
}

// Tell the learner which words went back into the review queue. Appended to the
// diff rather than replacing it, and built with textContent for the same reason
// renderSpeechDiff is.
function appendLapseNote(id, lapsed) {
    if (lapsed.length === 0) return;
    const el = document.getElementById(id);
    if (!el) return;

    const note = document.createElement('div');
    note.style.marginTop = '8px';
    note.textContent = `Added back to your review queue: ${lapsed.map(entry => entry.word).join(', ')}.`;
    el.appendChild(note);
}

function initializeListeningButtons() {
    let mediaRecorder = null;
    let recordedAudioBlob = null;
    let recordedAudioURL = null;
    
    document.getElementById('playListening').onclick = function() { speechAPI.speak(this.dataset.text); };
    
    document.getElementById('startRecording').onclick = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                // Create blob from recorded chunks
                recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                
                // Revoke previous URL if exists
                if (recordedAudioURL) {
                    URL.revokeObjectURL(recordedAudioURL);
                }
                
                // Create new URL for the blob
                recordedAudioURL = URL.createObjectURL(recordedAudioBlob);
                
                // Update UI
                document.getElementById('recordingStatus').textContent = 'Recording saved!';
                document.getElementById('recordingStatus').className = 'recording-status success';
                
                // Show replay button
                const replayBtn = document.getElementById('replayRecording');
                if (replayBtn) {
                    replayBtn.style.display = 'inline-block';
                }
                
                state.dailyGoals.listening = true;
                if (!isExerciseCompleted('listening', state.currentListeningIndex)) {
                    markExerciseComplete('listening', state.currentListeningIndex);
                    updateStatistics('listening');
                }
                updateDashboard();
                saveProgress();
            };

            mediaRecorder.start();
            document.getElementById('startRecording').disabled = true;
            document.getElementById('stopRecording').disabled = false;
            document.getElementById('recordingStatus').textContent = '🔴 Recording...';
            document.getElementById('recordingStatus').className = 'recording-status recording';
            
            // Hide replay button while recording
            const replayBtn = document.getElementById('replayRecording');
            if (replayBtn) {
                replayBtn.style.display = 'none';
            }
        } catch (e) {
            alert('Microphone access denied');
        }
    };
    
    document.getElementById('stopRecording').onclick = () => {
        if (mediaRecorder?.state === 'recording') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
            document.getElementById('startRecording').disabled = false;
            document.getElementById('stopRecording').disabled = true;
        }
    };
    
    // Replay recorded audio
    document.getElementById('replayRecording').onclick = () => {
        if (recordedAudioURL) {
            const audio = new Audio(recordedAudioURL);
            audio.play();
            document.getElementById('recordingStatus').textContent = '▶️ Playing recording...';
            document.getElementById('recordingStatus').className = 'recording-status info';
            
            audio.onended = () => {
                document.getElementById('recordingStatus').textContent = 'Recording saved!';
                document.getElementById('recordingStatus').className = 'recording-status success';
            };
        }
    };
    document.getElementById('prevListening').onclick = () => {
        if (state.currentListeningIndex > 0) {
            state.currentListeningIndex--;
            loadListeningExercise();
            
            // Clean up recorded audio
            if (recordedAudioURL) {
                URL.revokeObjectURL(recordedAudioURL);
                recordedAudioURL = null;
                recordedAudioBlob = null;
            }
            
            document.getElementById('recordingStatus').textContent = '';
            document.getElementById('listeningFeedback').classList.remove('visible');
            document.getElementById('speechFeedback').classList.remove('visible');
            
            // Hide replay button
            const replayBtn = document.getElementById('replayRecording');
            if (replayBtn) {
                replayBtn.style.display = 'none';
            }
            
            saveProgress();
        }
    };
    
    document.getElementById('nextListening').onclick = () => {
        state.currentListeningIndex++;
        loadListeningExercise();
        
        // Clean up recorded audio
        if (recordedAudioURL) {
            URL.revokeObjectURL(recordedAudioURL);
            recordedAudioURL = null;
            recordedAudioBlob = null;
        }
        
        document.getElementById('recordingStatus').textContent = '';
        document.getElementById('listeningFeedback').classList.remove('visible');
        document.getElementById('speechFeedback').classList.remove('visible');
        
        // Hide replay button
        const replayBtn = document.getElementById('replayRecording');
        if (replayBtn) {
            replayBtn.style.display = 'none';
        }
        
        saveProgress();
    };
    
    document.getElementById('startSpeech').onclick = () => {
        // The target is the sentence that gets played, read from the same element
        // that feeds speechAPI.speak. Anything else could go stale against the
        // audio; this is the audio.
        const target = document.getElementById('playListening').dataset.text || '';
        speechAPI.startRecognition((transcript) => {
            // textContent, not innerHTML: the transcript is user-derived.
            document.getElementById('recognizedText').textContent = `The recogniser heard: "${transcript}"`;

            const diff = diffSpeechAttempt(target, transcript);
            renderSpeechDiff('speechFeedback', diff);

            // A read-aloud miss re-queues the vocabulary words involved. Done before
            // the completion check so a full match, which lapses nothing, still
            // costs the same call.
            appendLapseNote('speechFeedback', recordReadAloudLapses(diff));

            // Completion requires every target word to be matched. The old check
            // passed on a substring, so reading a whole paragraph that happened to
            // contain the word counted as done; a partial match now leaves the
            // exercise open so the learner can try it again.
            if (diff.allMatched) {
                state.dailyGoals.listening = true;
                if (!isExerciseCompleted('listening', state.currentListeningIndex)) {
                    markExerciseComplete('listening', state.currentListeningIndex);
                    updateStatistics('listening');
                }
                updateDashboard();
                saveProgress();
            }
        });
    };
}

// ============================================
// PUZZLES
// ============================================

function initializePuzzleSelector() {
    document.querySelectorAll('.puzzle-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.puzzle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.puzzle-container').forEach(p => p.classList.remove('active'));
            document.getElementById(btn.dataset.puzzle).classList.add('active');
            state.currentPuzzle = btn.dataset.puzzle;
            loadPuzzle(btn.dataset.puzzle);
        };
    });
}

function loadPuzzle(type) {
    const loaders = { wordsearch: generateWordSearch, crossword: generateCrossword, scramble: loadWordScramble, matching: loadWordMatching };
    loaders[type]?.();
}

function generateWordSearch() {
    const data = puzzleData.wordSearch[state.currentDifficulty];
    // One generated grid can only be counted as one solved puzzle.
    let puzzleCounted = false;
    const list = document.getElementById('searchWordList');
    list.innerHTML = '';
    data.words.forEach(word => {
        const span = document.createElement('span');
        span.className = 'word-list-item';
        span.textContent = word;
        span.dataset.word = word;
        list.appendChild(span);
    });
    
    const grid = Array(data.gridSize).fill().map(() => Array(data.gridSize).fill(''));
    data.words.forEach(word => {
        let placed = false, attempts = 0;
        while (!placed && attempts++ < 100) {
            const dir = [[0,1],[1,0],[1,1]][Math.floor(Math.random() * 3)];
            const r = Math.floor(Math.random() * data.gridSize);
            const c = Math.floor(Math.random() * data.gridSize);
            let canPlace = true;
            for (let i = 0; i < word.length; i++) {
                const nr = r + dir[0] * i, nc = c + dir[1] * i;
                if (nr >= data.gridSize || nc >= data.gridSize || (grid[nr][nc] && grid[nr][nc] !== word[i])) {
                    canPlace = false;
                    break;
                }
            }
            if (canPlace) {
                for (let i = 0; i < word.length; i++) grid[r + dir[0] * i][c + dir[1] * i] = word[i];
                placed = true;
            }
        }
    });
    
    for (let i = 0; i < data.gridSize; i++) {
        for (let j = 0; j < data.gridSize; j++) {
            if (!grid[i][j]) grid[i][j] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        }
    }
    
    const gridEl = document.getElementById('wordGrid');
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${data.gridSize}, 1fr)`;
    grid.forEach((row, i) => row.forEach((cell, j) => {
        const div = document.createElement('div');
        div.className = 'grid-cell';
        div.textContent = cell;
        div.onclick = () => {
            div.classList.toggle('selected');
            const sel = Array.from(document.querySelectorAll('.grid-cell.selected')).map(c => c.textContent).join('');
            document.querySelectorAll('.word-list-item').forEach(item => {
                if (sel === item.dataset.word || sel === item.dataset.word.split('').reverse().join('')) {
                    item.classList.add('found');
                    document.querySelectorAll('.grid-cell.selected').forEach(c => c.classList.add('found'));
                    if (!puzzleCounted && document.querySelectorAll('.word-list-item.found').length === data.words.length) {
                        puzzleCounted = true;
                        state.dailyGoals.puzzle = true;
                        updateStatistics('puzzles');
                        updateDashboard();
                        saveProgress();
                    }
                }
            });
        };
        gridEl.appendChild(div);
    }));
}

function initializeWordSearchButton() {
    document.getElementById('newWordSearch').onclick = generateWordSearch;
}

function generateCrossword() {
    document.getElementById('cluesAcross').innerHTML = '<div class="clue-item">1. Feeling joyful (5)</div>';
    document.getElementById('cluesDown').innerHTML = '<div class="clue-item">1. A person you like (6)</div>';
    const grid = document.getElementById('crosswordGrid');
    grid.innerHTML = '';
    for (let i = 0; i < 64; i++) {
        const cell = document.createElement('div');
        cell.className = 'crossword-cell';
        if (i % 8 === 0 || i % 8 === 7 || i < 8 || i >= 56) {
            cell.classList.add('black');
        } else {
            cell.innerHTML = '<input type="text" maxlength="1">';
        }
        grid.appendChild(cell);
    }
}

function initializeCrosswordButtons() {
    document.getElementById('checkCrossword').onclick = () => {
        state.dailyGoals.puzzle = true;
        updateStatistics('puzzles');
        updateDashboard();
        saveProgress();
        alert('Checked!');
    };
    document.getElementById('newCrossword').onclick = generateCrossword;
}

function loadWordScramble() {
    const scrambles = puzzleData.scramble[state.currentDifficulty];
    const current = scrambles[Math.floor(Math.random() * scrambles.length)];
    document.getElementById('scrambledWord').textContent = current.scrambled;
    document.getElementById('scrambleInput').value = '';
    document.getElementById('scrambleInput').dataset.answer = current.word;
    // Each rendered scramble may be counted as one solved puzzle. The flag
    // rides on the input alongside this puzzle's answer because the Check
    // handler is wired once at startup and cannot see a local declared here.
    document.getElementById('scrambleInput').dataset.counted = 'false';
    document.getElementById('scrambleHint').textContent = `Hint: ${current.hint}`;
    document.getElementById('scrambleHint').classList.remove('visible');
    document.getElementById('scrambleFeedback').classList.remove('visible');
}

function initializeScrambleButtons() {
    document.getElementById('checkScramble').onclick = () => {
        const input = document.getElementById('scrambleInput');

        try {
            const sanitizedInput = AppErrorHandler.validateInput(input.value, {
                required: true,
                minLength: 1,
                maxLength: 50
            });

            if (sanitizedInput.toUpperCase() === input.dataset.answer) {
                showFeedback('scrambleFeedback', '✓ Correct!', 'success');
                Toast.success('Word unscrambled correctly!');
                // Count the solve once per rendered scramble, so pressing
                // Check again with the answer still in the box cannot inflate
                // puzzlesSolved. loadWordScramble() clears the flag, so the
                // next puzzle counts again.
                if (input.dataset.counted !== 'true') {
                    input.dataset.counted = 'true';
                    state.dailyGoals.puzzle = true;
                    updateStatistics('puzzles');
                    updateDashboard();
                    saveProgress();
                }
            } else {
                showFeedback('scrambleFeedback', '✗ Incorrect', 'error');
            }
        } catch (error) {
            showFeedback('scrambleFeedback', error.message, 'error');
            Toast.error('Please enter your answer before checking');
        }
    };
    document.getElementById('showHint').onclick = () => {
        const answer = document.getElementById('scrambleInput').dataset.answer;
        const hintElement = document.getElementById('scrambleHint');
        hintElement.textContent = `Answer: ${answer}`;
        hintElement.classList.add('visible');
    };
    document.getElementById('nextScramble').onclick = loadWordScramble;
}

// Generate unlimited matching pairs
function generateMatchingPairs(index, difficulty) {
    const pairPools = {
        foundation: [
            { word: "Happy", meaning: "Feeling joyful" },
            { word: "Friend", meaning: "Someone you like" },
            { word: "Learn", meaning: "Gain knowledge" },
            { word: "Beautiful", meaning: "Pleasing to look at" },
            { word: "Family", meaning: "Related people" },
            { word: "Kind", meaning: "Friendly and caring" },
            { word: "Help", meaning: "Assist someone" },
            { word: "Smile", meaning: "Happy expression" },
            { word: "Play", meaning: "Have fun" },
            { word: "Dream", meaning: "Hope or vision" },
            { word: "Peace", meaning: "Calm state" },
            { word: "Trust", meaning: "Belief in someone" },
            { word: "Love", meaning: "Deep affection" },
            { word: "Hope", meaning: "Positive expectation" },
            { word: "Joy", meaning: "Great happiness" }
        ],
        everyday: [
            { word: "Achieve", meaning: "Reach a goal" },
            { word: "Challenge", meaning: "Difficult task" },
            { word: "Develop", meaning: "Grow and improve" },
            { word: "Important", meaning: "Significant" },
            { word: "Success", meaning: "Achievement" },
            { word: "Knowledge", meaning: "Information and skills" },
            { word: "Opportunity", meaning: "Favorable chance" },
            { word: "Practice", meaning: "Repeated exercise" },
            { word: "Understand", meaning: "Comprehend" },
            { word: "Environment", meaning: "Surroundings" },
            { word: "Improve", meaning: "Make better" },
            { word: "Progress", meaning: "Forward movement" },
            { word: "Creative", meaning: "Imaginative" },
            { word: "Confident", meaning: "Self-assured" },
            { word: "Motivate", meaning: "Inspire action" }
        ],
        confident: [
            { word: "Collaborate", meaning: "Work together" },
            { word: "Demonstrate", meaning: "Show clearly" },
            { word: "Efficient", meaning: "Productive" },
            { word: "Fundamental", meaning: "Basic and essential" },
            { word: "Versatile", meaning: "Adaptable" },
            { word: "Perspective", meaning: "Viewpoint" },
            { word: "Significant", meaning: "Important" },
            { word: "Accomplish", meaning: "Complete successfully" },
            { word: "Beneficial", meaning: "Advantageous" },
            { word: "Implement", meaning: "Put into action" },
            { word: "Articulate", meaning: "Express clearly" },
            { word: "Conceptualize", meaning: "Form an idea" },
            { word: "Differentiate", meaning: "Distinguish" },
            { word: "Elaborate", meaning: "Explain in detail" },
            { word: "Formulate", meaning: "Create systematically" }
        ]
    };
    
    const pool = pairPools[difficulty] || pairPools[DEFAULT_LEVEL];
    const startIndex = (index * 5) % pool.length;
    const pairs = [];
    
    for (let i = 0; i < 5; i++) {
        pairs.push(pool[(startIndex + i) % pool.length]);
    }
    
    return pairs;
}

function loadWordMatching() {
    const curatedPairs = puzzleData.matching[state.currentDifficulty];
    const curatedCount = curatedPairs.length;
    
    // Use a random index for variety
    const randomIndex = Math.floor(Math.random() * 100);
    
    let pairs;
    if (randomIndex < 2) { // 2% chance to use curated
        pairs = curatedPairs;
    } else {
        pairs = generateMatchingPairs(randomIndex, state.currentDifficulty);
    }
    
    const wordsCol = document.getElementById('wordsColumn');
    const meaningsCol = document.getElementById('meaningsColumn');
    wordsCol.innerHTML = '';
    meaningsCol.innerHTML = '';
    
    pairs.forEach((pair, i) => {
        const div = document.createElement('div');
        div.className = 'match-item';
        div.textContent = pair.word;
        div.onclick = () => selectMatch(div, 'word');
        wordsCol.appendChild(div);
    });
    
    [...pairs].sort(() => Math.random() - 0.5).forEach(pair => {
        const div = document.createElement('div');
        div.className = 'match-item';
        div.textContent = pair.meaning;
        div.dataset.word = pair.word;
        div.onclick = () => selectMatch(div, 'meaning');
        meaningsCol.appendChild(div);
    });
}

function selectMatch(item, type) {
    if (item.classList.contains('matched')) return;
    const col = type === 'word' ? 'wordsColumn' : 'meaningsColumn';
    document.querySelectorAll(`#${col} .match-item:not(.matched)`).forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    
    const w = document.querySelector('#wordsColumn .match-item.selected');
    const m = document.querySelector('#meaningsColumn .match-item.selected');
    if (w && m) {
        if (m.dataset.word === w.textContent) {
            w.classList.add('matched');
            m.classList.add('matched');
            w.classList.remove('selected');
            m.classList.remove('selected');
            if (document.querySelectorAll('#wordsColumn .match-item.matched').length === document.querySelectorAll('#wordsColumn .match-item').length) {
                setTimeout(() => {
                    showFeedback('matchingFeedback', '✓ All matched!', 'success');
                    state.dailyGoals.puzzle = true;
                    updateStatistics('puzzles');
                    updateDashboard();
                    saveProgress();
                }, 300);
            }
        } else {
            setTimeout(() => { w.classList.remove('selected'); m.classList.remove('selected'); }, 500);
        }
    }
}

function initializeMatchingButtons() {
    document.getElementById('checkMatching').onclick = () => {
        const total = document.querySelectorAll('#wordsColumn .match-item').length;
        const matched = document.querySelectorAll('#wordsColumn .match-item.matched').length;
        showFeedback('matchingFeedback', `${matched}/${total} matched!`, 'info');
    };
    document.getElementById('resetMatching').onclick = () => {
        loadWordMatching();
        document.getElementById('matchingFeedback').classList.remove('visible');
    };
}

function showFeedback(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = `feedback ${type} visible`;
}

// ============================================
// GRAMMAR SECTION (US-501 / US-149)
// ============================================
//
// One grammar point per screen, rendered from data/grammar.js. The point of this
// section is FR-GRM-2 / TEACHING_METHODOLOGY.md §2: every wrong answer returns a
// REASON, a CONTRAST and a RETRY. All three come out of the authored content
// (`feedback[].reason`, `feedback[].contrast`, `feedback[].retryCue`) — nothing
// here writes generic copy, because generic copy is the worthless "Wrong" the
// methodology exists to forbid. The rule (`lesson.rule`) is shown alongside,
// which is the other half of that paragraph, and the options stay live so the
// retry is on the same screen as the ✗ (FR-A11Y-5).
//
// ⚠️ data/grammar.js is a classic script declaring LEXICAL globals, so
// `window.grammarLessons` is permanently undefined. Every access below goes
// through a bare `typeof grammarLessons` check, as that file's header requires.
//
// Only `mode: 'gap'` is implemented. The schema reserves 'choose', 'repair' and
// 'order'; an item in one of those modes is skipped with a visible note rather
// than mis-rendered as a gap.

/**
 * The authored points for a tier, always an array.
 *
 * This is also the section's content probe — Sections.registerContent() at the
 * bottom of this file registers `grammar: level => grammarLessonsFor(level).length`
 * — so "which tier does Grammar show" and "how much content has Grammar got" are
 * answered from one function, and cannot disagree.
 */
function grammarLessonsFor(level) {
    if (typeof grammarLessons === 'undefined' || !grammarLessons) return [];
    const list = grammarLessons[level];
    return Array.isArray(list) ? list : [];
}

// resolveGrammarLevel() USED TO BE HERE, and is gone — US-153.
//
// It was this section's local copy of the step-down policy, needed because
// resolveDifficulty() probed `vocabularyData` (content for three tiers) while
// grammar has content for one: asking the general helper for `confident` returned
// `confident` and rendered an empty section. Grammar's call sites therefore asked
// a different function than every other section's, and that split is what let the
// stored exercise id and the ✓ indicator disagree (US-152).
//
// resolveDifficulty() now takes a section id and answers against that section's
// own registered content, so the local policy had nothing left to do; the last
// commit left it as a one-line alias, and an alias whose only content is 20 lines
// of history is a second name for one question — exactly the shape that let the
// two answers drift. Both remaining call sites now call
// `resolveDifficulty(state.currentDifficulty, 'grammar')` directly, which is the
// same call markExerciseComplete()/isExerciseCompleted() make through
// exerciseLevel(), so there is one expression and no policy to keep in sync.
//
// NOTE the contract change that came with it: the old function returned `null`
// when no tier had any grammar content, where resolveDifficulty() always returns
// a level id. Every caller consumed the null only as "falsy, therefore zero
// lessons", and grammarLessonsFor() on the returned tier is `[]` in exactly that
// case — so the "No grammar points yet" screen and the disabled Prev/Next still
// appear, now via `lessons.length`.

/**
 * Append authored text to `el`, honouring the content markup convention:
 * `**double asterisks**` for the target form, `*single*` for a cited word.
 *
 * Built node by node, never with innerHTML (US-127). This is our own content, so
 * the risk today is low — but it is *content*, the thing most likely to grow a
 * stray angle bracket, and index.html's CSP still allows 'unsafe-inline'.
 */
function appendGrammarText(el, text) {
    const raw = text == null ? '' : String(text);
    raw.split(/(\*\*[^*]+\*\*)/).forEach(chunk => {
        if (!chunk) return;
        if (chunk.length > 4 && chunk.startsWith('**') && chunk.endsWith('**')) {
            const strong = document.createElement('strong');
            strong.textContent = chunk.slice(2, -2);
            el.appendChild(strong);
            return;
        }
        chunk.split(/(\*[^*]+\*)/).forEach(part => {
            if (!part) return;
            if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
                const em = document.createElement('em');
                em.textContent = part.slice(1, -1);
                el.appendChild(em);
                return;
            }
            el.appendChild(document.createTextNode(part));
        });
    });
    return el;
}

/** `<p class=…>` with the content markup rendered. */
function grammarParagraph(text, className) {
    const p = document.createElement('p');
    if (className) p.className = className;
    return appendGrammarText(p, text);
}

/**
 * A collapsed extra, as a native <details>/<summary> — which is keyboard
 * operable without a line of JavaScript (FR-A11Y-1). Used for the honest-limits
 * material the methodology insists on carrying but which would bury the rule if
 * it were all open at once.
 */
function grammarDisclosure(summaryText, fill) {
    const details = document.createElement('details');
    details.className = 'grammar-more';
    const summary = document.createElement('summary');
    summary.textContent = summaryText;
    details.appendChild(summary);
    const body = document.createElement('div');
    details.appendChild(body);
    fill(body);
    return details;
}

/** How an answer is displayed: `rendersAs` if the item has one, else the value. */
function grammarAnswerLabel(item, answer) {
    if (item && item.rendersAs && Object.prototype.hasOwnProperty.call(item.rendersAs, answer)) {
        return item.rendersAs[answer];
    }
    if (answer === '' || answer === null || answer === undefined) {
        return typeof ZERO_ARTICLE_LABEL !== 'undefined' ? ZERO_ARTICLE_LABEL : '— (nothing)';
    }
    return String(answer);
}

/** The prompt with the gap filled by `answer`, for showing the finished sentence. */
function grammarFilledPrompt(item, answer) {
    const shown = (answer === '' || answer === null || answer === undefined)
        ? ''
        : grammarAnswerLabel(item, answer);
    return String(item.prompt || '')
        // Function form, not a string: a replacement string would treat `$&` and
        // friends as backreferences, and this text comes from content.
        .replace('___', () => shown)
        // A zero-article answer leaves a double space behind it.
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/** True when `answer` is one of the item's defensible answers (FR-GRM-5). */
function isAcceptedGrammarAnswer(item, answer) {
    return Array.isArray(item.accept) &&
        item.accept.some(a => a && a.answer === answer);
}

/**
 * Per-render state for the point on screen. Rebuilt by loadGrammarPoint(), so
 * moving to another point or another tier cannot carry an outcome across.
 *
 *   solved      ids of practice items the learner has got right
 *   wrongSeen   any wrong answer on this point since it was loaded
 *   scheduled   the SRS lapse has already been recorded (record it once)
 */
let grammarSession = null;

/**
 * The lapse half of FR-GRM-3: "Wrong → that point's interval resets to 1 day."
 *
 * Recorded on the FIRST wrong answer, not at the end, so a learner who abandons
 * the point still has the evidence that they got it wrong. Recorded once per
 * render: six wrong answers on one point are one point to review, not six.
 */
function scheduleGrammarLapse(lesson) {
    if (!grammarSession || grammarSession.scheduled) return;
    grammarSession.scheduled = true;
    if (window.SRS && typeof SRS.scheduleItem === 'function') {
        SRS.scheduleItem('gram', lesson.id, lesson, false);
    }
}

/**
 * The success half: "Right first time → interval extends."
 *
 * Only when the whole point was answered with no wrong answer at all. If the
 * learner lapsed, `scheduled` is already true and this is a no-op — a point the
 * learner got wrong and then fixed must not buy a longer interval, which is the
 * same reasoning as SRS.selfReport not being allowed to.
 */
function scheduleGrammarSuccess(lesson) {
    if (!grammarSession || grammarSession.scheduled || grammarSession.wrongSeen) return;
    grammarSession.scheduled = true;
    if (window.SRS && typeof SRS.scheduleItem === 'function') {
        SRS.scheduleItem('gram', lesson.id, lesson, true);
    }
}

/** Log a wrong answer by type, so it can be resurfaced (FR-SRS-3, principle 4). */
function recordGrammarMistake(lesson, item, feedback, given) {
    if (typeof Mistakes === 'undefined' || !Mistakes || typeof Mistakes.record !== 'function') return;
    const category = (feedback && feedback.logAs) || lesson.mistakeCategory;
    if (!category) return;
    const expected = (item.accept || []).map(a => grammarAnswerLabel(item, a.answer)).join(' / ');
    Mistakes.record(category, {
        item: item.id,
        given: grammarAnswerLabel(item, given),
        expected: expected,
        source: 'grammarPractice'
    });
}

/**
 * Everything the learner sees on a wrong answer, in the order the methodology
 * lists it: the reason, the contrast, the rule, the retry.
 *
 * `feedback[]` carries one entry per wrong option, so the normal path is entirely
 * authored. The two fallbacks exist because a bare verdict is not an acceptable
 * degraded mode: an option with no authored entry falls back to
 * `fallbackFeedback` (written for exactly this), and if that is missing too the
 * last resort is still a reason (the rule), a contrast (the authored pair) and a
 * retry (the first `decide` question) — never "✗ Wrong".
 */
function grammarFeedbackFor(lesson, item, answer) {
    const authored = (item.feedback || []).find(f => f && f.forAnswer === answer);
    if (authored) return authored;
    if (item.fallbackFeedback) return item.fallbackFeedback;
    return {
        reason: lesson.rule,
        contrast: [
            grammarFilledPrompt(item, (item.accept && item.accept[0] || {}).answer),
            item.prompt
        ],
        retryCue: (lesson.decide && lesson.decide[0]) || 'Read the sentence again and ask who knows which one.'
    };
}

/** Render one 'gap' practice item, with its own feedback area. */
function renderGrammarPracticeItem(lesson, item, number) {
    const wrap = document.createElement('div');
    wrap.className = 'grammar-item';
    wrap.setAttribute('role', 'group');

    const promptId = `grammarPrompt-${item.id}`;
    const prompt = grammarParagraph(item.prompt, 'grammar-prompt');
    prompt.id = promptId;
    const label = document.createElement('span');
    label.className = 'grammar-item-number';
    label.textContent = `${number}. `;
    prompt.insertBefore(label, prompt.firstChild);
    wrap.setAttribute('aria-labelledby', promptId);
    wrap.appendChild(prompt);

    // Real <button>s, so Tab reaches them and Enter/Space activate them with no
    // key handling of our own (FR-A11Y-1). The vocabulary quiz uses clickable
    // <div>s, which is the bug this section deliberately does not copy.
    const options = document.createElement('div');
    options.className = 'grammar-options';
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', 'Answer options');

    const feedback = document.createElement('div');
    feedback.className = 'grammar-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    (item.options || []).forEach(option => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'grammar-option';
        btn.textContent = grammarAnswerLabel(item, option);
        // The value is held in the closure, not in a data attribute: the
        // zero-article answer IS the empty string, and dataset would hand back
        // '' for "missing" too.
        btn.addEventListener('click', () => {
            answerGrammarItem(lesson, item, option, btn, options, feedback);
        });
        options.appendChild(btn);
    });

    wrap.appendChild(options);
    wrap.appendChild(feedback);
    return wrap;
}

/** Handle one answer: grade against `accept`, then teach. */
function answerGrammarItem(lesson, item, answer, button, optionsHost, feedbackHost) {
    if (!grammarSession) return;
    const correct = isAcceptedGrammarAnswer(item, answer);

    optionsHost.querySelectorAll('.grammar-option').forEach(b => {
        b.classList.remove('selected');
    });
    button.classList.add('selected');
    button.classList.toggle('correct', correct);
    button.classList.toggle('incorrect', !correct);

    feedbackHost.textContent = '';
    feedbackHost.className = 'grammar-feedback visible ' + (correct ? 'is-correct' : 'is-wrong');

    if (correct) {
        renderGrammarCorrect(lesson, item, answer, optionsHost, feedbackHost);
    } else {
        renderGrammarWrong(lesson, item, answer, feedbackHost);
    }
}

/**
 * A right answer. Methodology §2: "Right on first try: say nothing more." So this
 * shows the finished sentence and nothing that reads as praise — plus the two
 * things the content explicitly authored to appear after an answer: `alsoNotice`,
 * and, when `showDifferenceOnCorrect` is set, what each accepted answer means.
 * That flag only exists on items with more than one right answer, where the
 * learner has to be told the two are not interchangeable.
 */
function renderGrammarCorrect(lesson, item, answer, optionsHost, feedbackHost) {
    const heading = document.createElement('p');
    heading.className = 'grammar-verdict';
    heading.textContent = '✓ ';
    const sentence = document.createElement('strong');
    sentence.textContent = grammarFilledPrompt(item, answer);
    heading.appendChild(sentence);
    feedbackHost.appendChild(heading);

    if (item.showDifferenceOnCorrect && (item.accept || []).length > 1) {
        const note = document.createElement('div');
        note.className = 'grammar-both-right';
        note.appendChild(grammarParagraph(
            'Both answers here are right, and they do not mean the same thing:'
        ));
        const list = document.createElement('ul');
        item.accept.forEach(a => {
            const li = document.createElement('li');
            const form = document.createElement('strong');
            form.textContent = grammarAnswerLabel(item, a.answer);
            li.appendChild(form);
            li.appendChild(document.createTextNode(' — '));
            appendGrammarText(li, a.means);
            list.appendChild(li);
        });
        note.appendChild(list);
        feedbackHost.appendChild(note);
    }

    if (item.spoken) feedbackHost.appendChild(grammarParagraph(item.spoken, 'grammar-spoken'));
    if (item.alsoNotice) feedbackHost.appendChild(grammarParagraph(item.alsoNotice, 'grammar-also'));

    // Answered correctly: lock this item so a second click cannot re-count it,
    // and leave the chosen answer visible.
    optionsHost.querySelectorAll('.grammar-option').forEach(b => { b.disabled = true; });

    grammarSession.solved.add(item.id);
    if (grammarSession.solved.size >= grammarSession.itemsTotal) {
        completeGrammarPoint(lesson);
    }
}

/**
 * A wrong answer — the acceptance bar for this whole section.
 *
 * Reason, contrast, rule, retry, in that order, all from the content. The option
 * buttons are deliberately NOT disabled: the retry has to be on the same screen
 * as the ✗ (FR-A11Y-5), so the learner answers again in place.
 */
function renderGrammarWrong(lesson, item, answer, feedbackHost) {
    const fb = grammarFeedbackFor(lesson, item, answer);

    const verdict = document.createElement('p');
    verdict.className = 'grammar-verdict';
    verdict.textContent = '✗ ';
    const chosen = document.createElement('strong');
    chosen.textContent = grammarFilledPrompt(item, answer);
    verdict.appendChild(chosen);
    feedbackHost.appendChild(verdict);

    // 1. WHY. Never a verdict — see the schema note on `reason`.
    feedbackHost.appendChild(grammarParagraph(fb.reason, 'grammar-reason'));

    // Real English that simply means something else here. Saying so is the
    // difference between teaching and scolding (data/grammar.js on
    // `grammaticalButDifferent`).
    if (fb.grammaticalButDifferent) {
        feedbackHost.appendChild(grammarParagraph(
            'That is correct English — it just says something different here.',
            'grammar-butdifferent'
        ));
    }

    // 2. THE CONTRAST: a minimal pair, so the learner sees what their choice
    //    would have meant instead of only what was wanted.
    const pair = Array.isArray(fb.contrast) ? fb.contrast : [];
    if (pair.length) {
        const list = document.createElement('ul');
        list.className = 'grammar-contrast-pair';
        pair.forEach(line => {
            const li = document.createElement('li');
            appendGrammarText(li, line);
            list.appendChild(li);
        });
        feedbackHost.appendChild(list);
    }

    // 3. THE RULE, in one sentence (methodology §2).
    const rule = grammarParagraph(lesson.rule, 'grammar-rule-reminder');
    rule.insertBefore(document.createTextNode('The rule: '), rule.firstChild);
    feedbackHost.appendChild(rule);

    // 4. THE RETRY. The cue is a question the learner can run before answering
    //    again; the buttons above are still live.
    const retry = grammarParagraph(fb.retryCue, 'grammar-retry');
    retry.insertBefore(document.createTextNode('Try again — '), retry.firstChild);
    feedbackHost.appendChild(retry);

    grammarSession.wrongSeen = true;
    scheduleGrammarLapse(lesson);
    recordGrammarMistake(lesson, item, fb, answer);
    if (typeof updateDueCount === 'function') updateDueCount();
}

/**
 * Every practice item on this point answered correctly.
 *
 * This is the call that makes the section count: updateStatistics('grammar')
 * reads the registry row, so `grammarCompleted` / `totalGrammar` / the
 * `grammar` daily average all move without a line of section-specific code.
 * Guarded by isExerciseCompleted so redoing a point cannot inflate the counters.
 *
 * Both calls pass `grammarSession.level` — the tier this point was actually
 * loaded from, not the tier whose button is lit. With grammar authored for
 * `foundation` only, selecting Everyday shows the same Foundation point, and
 * reading the button here counted it a second time under a second exercise id
 * (US-152). Passing the session's own level makes the check and the write agree
 * with each other and with what is on screen, whatever the selector says.
 */
function completeGrammarPoint(lesson) {
    const index = grammarSession.index;
    const level = grammarSession.level;
    const alreadyDone = isExerciseCompleted('grammar', index, level);

    scheduleGrammarSuccess(lesson);
    if (typeof updateDueCount === 'function') updateDueCount();

    if (!alreadyDone) {
        state.dailyGoals.grammar = true;
        updateStatistics('grammar');
    }
    markExerciseComplete('grammar', index, level);
    updateDashboard();
    saveProgress();

    const done = document.getElementById('grammarFeedback');
    if (done) {
        showFeedback(
            'grammarFeedback',
            grammarSession.wrongSeen
                ? 'All six done. The ones you had to think about are the ones worth saying out loud below — this point will come back for review tomorrow.'
                : 'All six right first time. This point will come back for review later, at a longer gap.',
            'success'
        );
    }

    // The error forms this learner actually produces — shown only now. The
    // schema is explicit: "Shown after practice, never before (do not prime
    // errors)."
    renderGrammarCommonErrors(lesson);
}

/** `commonErrors`, appended after the practice block once the point is done. */
function renderGrammarCommonErrors(lesson) {
    const host = document.getElementById('grammarPractice');
    if (!host || !Array.isArray(lesson.commonErrors) || !lesson.commonErrors.length) return;
    if (host.querySelector('.grammar-common-errors')) return;

    const block = document.createElement('div');
    block.className = 'grammar-common-errors';
    block.appendChild(grammarDisclosure(
        'What most learners say instead, and the fix',
        body => {
            lesson.commonErrors.forEach(err => {
                const entry = document.createElement('div');
                entry.className = 'grammar-common-error';
                entry.appendChild(grammarParagraph('Often heard: ' + err.heard, 'grammar-heard'));
                entry.appendChild(grammarParagraph('Instead: ' + err.fix, 'grammar-fix'));
                if (err.why) entry.appendChild(grammarParagraph(err.why));
                body.appendChild(entry);
            });
        }
    ));
    host.appendChild(block);
}

/**
 * The "notice" half of the arc (methodology principle 7): the rule, how to decide
 * in real time, the pattern in a short exchange, and the three contrast pairs.
 *
 * The honest-limits material — the mechanism, why it matters, how it actually
 * sounds, the caveats, the L1 note — goes in <details> blocks. It is all required
 * reading by the methodology and all of it would bury the one-sentence rule if it
 * were open at once.
 */
function renderGrammarTeaching(lesson, shownLevel, requestedLevel) {
    const title = document.getElementById('grammarPointTitle');
    if (title) title.textContent = lesson.title;

    const host = document.getElementById('grammarTeaching');
    if (!host) return;
    host.textContent = '';

    if (shownLevel !== requestedLevel) {
        // Honest about what happened, rather than silently showing another tier's
        // content under the selected button.
        const note = grammarParagraph(
            `No grammar points are written for ${grammarLevelLabel(requestedLevel)} yet, so this is a ${grammarLevelLabel(shownLevel)} point.`,
            'grammar-level-note'
        );
        host.appendChild(note);
    }

    const meta = document.createElement('p');
    meta.className = 'grammar-meta';
    meta.textContent = [
        lesson.cefr ? `CEFR ${lesson.cefr}` : '',
        `Point ${grammarSession.index + 1} of ${grammarSession.total}`
    ].filter(Boolean).join(' · ');
    host.appendChild(meta);

    host.appendChild(grammarParagraph(lesson.rule, 'grammar-rule'));

    if (Array.isArray(lesson.decide) && lesson.decide.length) {
        const h = document.createElement('h4');
        h.textContent = 'How to decide, while you are speaking';
        host.appendChild(h);
        const ol = document.createElement('ol');
        ol.className = 'grammar-decide';
        lesson.decide.forEach(step => {
            const li = document.createElement('li');
            appendGrammarText(li, step);
            ol.appendChild(li);
        });
        host.appendChild(ol);
    }

    if (lesson.notice && Array.isArray(lesson.notice.lines)) {
        const h = document.createElement('h4');
        h.textContent = 'Notice it here';
        host.appendChild(h);
        const dialogue = document.createElement('div');
        dialogue.className = 'grammar-notice';
        lesson.notice.lines.forEach(line => {
            const p = document.createElement('p');
            const who = document.createElement('span');
            who.className = 'grammar-speaker';
            who.textContent = line.speaker + ': ';
            p.appendChild(who);
            appendGrammarText(p, line.text);
            dialogue.appendChild(p);
        });
        host.appendChild(dialogue);

        if (lesson.notice.question) {
            host.appendChild(grammarDisclosure(lesson.notice.question, body => {
                body.appendChild(grammarParagraph(lesson.notice.answer));
            }));
        }
    }

    if (Array.isArray(lesson.contrast) && lesson.contrast.length) {
        const h = document.createElement('h4');
        h.textContent = 'Same sentence, different meaning';
        host.appendChild(h);
        lesson.contrast.forEach(c => {
            const card = document.createElement('div');
            card.className = 'grammar-contrast';
            (c.pair || []).forEach(member => {
                const line = document.createElement('p');
                line.className = 'grammar-contrast-line';
                const text = document.createElement('strong');
                text.textContent = member.text;
                line.appendChild(text);
                line.appendChild(document.createElement('br'));
                appendGrammarText(line, member.means);
                card.appendChild(line);
            });
            if (c.takeaway) card.appendChild(grammarParagraph(c.takeaway, 'grammar-takeaway'));
            host.appendChild(card);
        });
    }

    if (lesson.explain || lesson.whyItMatters) {
        host.appendChild(grammarDisclosure('Why English works this way', body => {
            if (lesson.explain) body.appendChild(grammarParagraph(lesson.explain));
            if (lesson.whyItMatters) {
                body.appendChild(grammarParagraph(lesson.whyItMatters, 'grammar-why'));
            }
        }));
    }

    if (lesson.spokenNote) {
        host.appendChild(grammarDisclosure('How it actually sounds', body => {
            body.appendChild(grammarParagraph(lesson.spokenNote));
        }));
    }

    if (Array.isArray(lesson.caveats) && lesson.caveats.length) {
        host.appendChild(grammarDisclosure('Where the rule does not hold', body => {
            const ul = document.createElement('ul');
            lesson.caveats.forEach(c => {
                const li = document.createElement('li');
                appendGrammarText(li, c);
                ul.appendChild(li);
            });
            body.appendChild(ul);
        }));
    }

    const l1 = grammarL1Note(lesson);
    if (l1) {
        host.appendChild(grammarDisclosure('If your first language has no articles like this', body => {
            if (l1.note) body.appendChild(grammarParagraph(l1.note));
            if (l1.bridge) body.appendChild(grammarParagraph(l1.bridge, 'grammar-bridge'));
        }));
    }
}

/** A tier's display label, from levels.js, falling back to the raw id. */
function grammarLevelLabel(level) {
    if (typeof Levels !== 'undefined' && Levels && typeof Levels.levelLabel === 'function') {
        return Levels.levelLabel(level) || level;
    }
    return level;
}

/**
 * The L1 note for this learner (FR-GRM-4), or null.
 *
 * There is no learner L1 profile in `state` yet, so there is nothing to key on.
 * Rather than hardcode 'telugu' — which would be a guess dressed up as a
 * setting — this shows the note only when the content offers exactly one, which
 * is unambiguous, and shows nothing once a point carries several. A real profile
 * field replaces the `keys.length === 1` line and nothing else.
 */
function grammarL1Note(lesson) {
    const notes = lesson && lesson.l1Notes;
    if (!notes || typeof notes !== 'object') return null;
    const chosen = state.learnerL1 && notes[state.learnerL1];
    if (chosen) return chosen;
    const keys = Object.keys(notes);
    return keys.length === 1 ? notes[keys[0]] : null;
}

/**
 * The "use" half of the arc: one say-it-aloud task with a self-check list.
 *
 * Never graded and never gated — `skippable` is FR-SPK-9 / FR-A11Y-4, so both
 * buttons complete the task and neither needs a microphone. "I could not do it
 * yet" goes through SRS as a SELF-REPORT, which per FR-SRS-5 may bring the point
 * back sooner but can never certify it; "I said it" is deliberately not sent at
 * all, because a learner marking their own speaking right is not evidence and
 * srs.js would ignore it anyway.
 */
function renderGrammarProduce(lesson) {
    const host = document.getElementById('grammarProduce');
    if (!host) return;
    host.textContent = '';

    const produce = lesson.produce;
    if (!produce) {
        host.appendChild(grammarParagraph('No speaking task is written for this point yet.'));
        return;
    }

    host.appendChild(grammarParagraph(produce.task, 'grammar-task'));
    if (produce.targetSeconds) {
        host.appendChild(grammarParagraph(`About ${produce.targetSeconds} seconds. Nobody is recording — this is for you.`, 'grammar-task-meta'));
    }

    if (Array.isArray(produce.selfCheck) && produce.selfCheck.length) {
        const h = document.createElement('h4');
        h.textContent = 'Check yourself';
        host.appendChild(h);
        const ul = document.createElement('ul');
        ul.className = 'grammar-selfcheck';
        produce.selfCheck.forEach(q => {
            const li = document.createElement('li');
            appendGrammarText(li, q);
            ul.appendChild(li);
        });
        host.appendChild(ul);
    }

    if (produce.model && produce.model.text) {
        host.appendChild(grammarDisclosure('Show an example (then look away)', body => {
            body.appendChild(grammarParagraph(produce.model.text, 'grammar-model'));
            if (produce.model.note) {
                body.appendChild(grammarParagraph(produce.model.note, 'grammar-model-note'));
            }
        }));
    }

    const buttons = document.createElement('div');
    buttons.className = 'button-group';
    buttons.setAttribute('role', 'group');
    buttons.setAttribute('aria-label', 'Speaking task');

    const status = document.createElement('div');
    status.className = 'grammar-feedback';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'btn-primary';
    done.textContent = 'I said it';
    done.addEventListener('click', () => {
        status.className = 'grammar-feedback visible is-correct';
        status.textContent = 'Noted. Saying it is the part that transfers to real conversation.';
    });

    const notYet = document.createElement('button');
    notYet.type = 'button';
    notYet.className = 'btn-secondary';
    notYet.textContent = produce.skippable ? 'Skip for now' : 'Not yet';
    notYet.addEventListener('click', () => {
        if (produce.srsSelfReport && window.SRS && typeof SRS.scheduleItem === 'function') {
            SRS.scheduleItem('gram', lesson.id, lesson, false, { selfReported: true });
            if (typeof updateDueCount === 'function') updateDueCount();
        }
        status.className = 'grammar-feedback visible';
        status.textContent = 'Fine — skipping it costs you nothing. This point will come back sooner so you can try again.';
    });

    buttons.appendChild(done);
    buttons.appendChild(notYet);
    host.appendChild(buttons);
    host.appendChild(status);
}

/**
 * The section loader, registered as `grammar` in Sections.registerRuntime().
 *
 * Renders exactly one point: whichever `state.currentGrammarIndex` points at,
 * clamped to what is authored. Deliberately synchronous and content-only — there
 * is no API call to make here, so there is nothing to fail.
 */
function loadGrammarPoint() {
    const requested = (typeof canonicalLevel === 'function')
        ? canonicalLevel(state.currentDifficulty)
        : state.currentDifficulty;
    const level = resolveDifficulty(state.currentDifficulty, 'grammar');
    // No `level ? … : []` any more: resolveDifficulty() never returns null (see
    // the note where resolveGrammarLevel() used to be). grammarLessonsFor()
    // already returns [] for a tier with no authored points and for
    // data/grammar.js failing to load, which is the same empty array the null
    // branch produced.
    const lessons = grammarLessonsFor(level);

    const feedbackEl = document.getElementById('grammarFeedback');
    if (feedbackEl) feedbackEl.className = 'feedback';

    if (!lessons.length) {
        // No content anywhere: say so plainly rather than render an empty card.
        // Reachable if data/grammar.js fails to load, which is the one failure
        // mode this section has.
        const title = document.getElementById('grammarPointTitle');
        if (title) title.textContent = 'No grammar points yet';
        ['grammarTeaching', 'grammarPractice', 'grammarProduce'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
        const host = document.getElementById('grammarTeaching');
        if (host) {
            host.appendChild(grammarParagraph(
                'The grammar content could not be loaded on this device. Everything else still works — try reloading the page.'
            ));
        }
        grammarSession = null;
        updateGrammarNavigationState(0);
        return;
    }

    // Clamp rather than wrap: with one authored point, wrapping would make Next
    // look like it did nothing. Also repairs an index restored from a save made
    // when more points existed.
    const index = Math.min(Math.max(0, state.currentGrammarIndex || 0), lessons.length - 1);
    state.currentGrammarIndex = index;
    const lesson = lessons[index];

    const gapItems = (lesson.practice || []).filter(p => p && p.mode === 'gap');

    grammarSession = {
        lessonId: lesson.id,
        level: level,
        index: index,
        total: lessons.length,
        itemsTotal: gapItems.length,
        solved: new Set(),
        wrongSeen: false,
        scheduled: false
    };

    renderGrammarTeaching(lesson, level, requested);

    const practiceHost = document.getElementById('grammarPractice');
    if (practiceHost) {
        practiceHost.textContent = '';
        gapItems.forEach((item, i) => {
            practiceHost.appendChild(renderGrammarPracticeItem(lesson, item, i + 1));
        });

        // Modes the schema reserves but this section does not implement yet.
        // Named rather than dropped: a silently missing practice item is how a
        // section starts teaching less than its content says it does.
        const otherModes = (lesson.practice || []).filter(p => p && p.mode !== 'gap');
        if (otherModes.length) {
            practiceHost.appendChild(grammarParagraph(
                `${otherModes.length} more practice item(s) on this point use an exercise type this version cannot show yet.`,
                'grammar-unsupported'
            ));
        }
    }

    renderGrammarProduce(lesson);

    // Paints #grammarStatus (created after the h2 on first use) and is the reason
    // the section's h2 must stay a direct child.
    updateNavigationButtons('grammar');
    updateGrammarNavigationState(lessons.length);
}

/** Disable the ends of the walk, rather than letting Next look broken. */
function updateGrammarNavigationState(total) {
    const prev = document.getElementById('prevGrammar');
    const next = document.getElementById('nextGrammar');
    const index = state.currentGrammarIndex || 0;
    if (prev) prev.disabled = total === 0 || index <= 0;
    if (next) next.disabled = total === 0 || index >= total - 1;
}

function initializeGrammarButtons() {
    const prev = document.getElementById('prevGrammar');
    const next = document.getElementById('nextGrammar');

    if (prev) {
        prev.onclick = () => {
            if ((state.currentGrammarIndex || 0) > 0) {
                state.currentGrammarIndex--;
                loadGrammarPoint();
                saveProgress();
            }
        };
    }

    if (next) {
        next.onclick = () => {
            const level = resolveDifficulty(state.currentDifficulty, 'grammar');
            const total = grammarLessonsFor(level).length;
            if ((state.currentGrammarIndex || 0) < total - 1) {
                state.currentGrammarIndex++;
                loadGrammarPoint();
                saveProgress();
            }
        };
    }
}

// ============================================
// PRONUNCIATION SECTION (US-401)
// ============================================
//
// A minimal-pair DISCRIMINATION drill, and deliberately only that.
// docs/CURRICULUM.md calls it the highest-value pronunciation feature available
// offline, and REQUIREMENTS.md §6 names it the one speech task this app can grade
// honestly: we chose the clip, so we know the answer. Everything else in the
// strand either cannot be graded (production — FR-PRN-5) or does not need audio
// at all (the `stress` and `noticing` arrays, which this section does NOT render;
// see the note at the end of this block for what they would need).
//
// The four requirements this section implements, and where:
//   FR-PRN-1  play one word, learner picks which; a miss replays BOTH words
//             slowed, back to back, and NAMES the differing feature
//             — renderPronunciationWrong()
//   FR-PRN-2  accuracy per PAIR, not per item, keyed like the SRS record
//             — state.pronunciationAccuracy / pronRecordAttempt()
//   FR-PRN-6  discrimination gates production for that pair
//             — pronGate() / renderPronunciationProduce()
//   FR-PRN-9  every IPA symbol shown carries a plain-English gloss
//             — pronPhonemeBlock(), and `phonemes[].gloss` is the only place a
//               symbol is ever introduced
//
// ⚠️ AS-3 IS UNVERIFIED. Nobody has confirmed that a real device's built-in voice
// says these pairs differently, and data/pronunciation/vowels-stress.js is
// authored on the assumption that it may not: every set carries `audio.ttsRisk`,
// `audio.requiresBundledClip` and a gradable `textOnlyFallback`. There are no
// bundled clips in this repo, so this section is on TTS today and says so out
// loud BEFORE the learner answers anything (pronAudioNotice), with one click to
// the written exercise. A learner whose device audio is useless — or absent —
// can complete the section from text alone and is never stuck.
//
// ⚠️ data/pronunciation/vowels-stress.js is a classic script declaring a LEXICAL
// global, so `window.PRONUNCIATION_VOWELS_STRESS` is permanently undefined. Every
// access below goes through a bare `typeof` check, as that file's header requires.

/** Playback rates. The slow one is used for BOTH words of a replayed pair, which
 *  is PROGRESS.md §6.aa rule 4: compare at matched speed, never fast-vs-slow. */
const PRON_RATE_NORMAL = 1;
const PRON_RATE_SLOW = 0.6;

/**
 * Every authored pair set that this section can actually render, in order.
 *
 * TWO SOURCES, ON PURPOSE. `PRONUNCIATION_VOWELS_STRESS.pairs` is the vowel file
 * (T-P7/8/9) and is wired today. `PRONUNCIATION_CONSONANTS.pairs` is its sibling
 * — the consonant contrasts, authored to exactly the same `pairs[]` shape — and
 * is read here the moment index.html loads it, WITHOUT another edit to this file.
 * It is appended after the vowels rather than interleaved, because
 * `state.currentPronunciationIndex` and the `pronunciation_foundation_N` exercise
 * ids are positional: inserting would silently move a learner's completed pairs.
 * Wiring the consonants is therefore a <script> tag plus a precache entry, and
 * nothing here.
 *
 * A row that cannot be rendered HONESTLY is dropped rather than half-drawn: no
 * `phonemes` means no FR-PRN-9 gloss and the learner would be shown bare IPA; no
 * `minimalPairs` means there is no drill; no `contrastFeature` means the
 * FR-PRN-1 wrong-answer message has nothing to name. Dropping is loud, because a
 * pair that quietly disappears is a content bug nobody would find.
 */
function pronunciationPairs() {
    const sources = [];
    if (typeof PRONUNCIATION_VOWELS_STRESS !== 'undefined' && PRONUNCIATION_VOWELS_STRESS) {
        sources.push(PRONUNCIATION_VOWELS_STRESS.pairs);
    }
    if (typeof PRONUNCIATION_CONSONANTS !== 'undefined' && PRONUNCIATION_CONSONANTS) {
        sources.push(PRONUNCIATION_CONSONANTS.pairs);
    }
    const out = [];
    sources.forEach(list => {
        if (!Array.isArray(list)) return;
        list.forEach(p => {
            if (!p || !p.id) return;
            const missing = ['phonemes', 'minimalPairs', 'contrastFeature', 'articulatoryCue']
                .filter(f => !p[f] || (Array.isArray(p[f]) && !p[f].length));
            if (missing.length) {
                console.warn('Pronunciation: pair "' + p.id + '" is missing ' +
                             missing.join(', ') + ', so it cannot be drilled honestly ' +
                             'and is not shown. Fix the content file.');
                return;
            }
            out.push(p);
        });
    });
    return out;
}

/**
 * The content markup convention (`**target form**`, `*cited word*`) is a
 * repo-wide authoring rule (docs/CONTENT_AUTHORING_GUIDE.md), not a grammar one,
 * and the pronunciation content uses it too (`lengthNote`, `minimalPairs[].note`).
 * The three renderers that implement it happen to be named after the section that
 * needed them first; they are reused verbatim here rather than duplicated,
 * because two copies of a text renderer drift. Aliased so this section reads
 * honestly without renaming thirty grammar call sites for no behaviour change.
 */
const pronText = appendGrammarText;
const pronParagraph = grammarParagraph;
const pronDisclosure = grammarDisclosure;

/**
 * The SRS/accuracy key for a pair, normalised the way srs.js will normalise it.
 *
 * Derived rather than read straight from `pair.srsKey` so the counter and the
 * scheduler cannot disagree: SRS.scheduleItem() runs the ref through
 * Migrations.srsRef(), and if the authored key ever stopped matching that, the
 * FR-PRN-6 gate would read an accuracy counter no drill was writing to — a gate
 * that silently never opens. The authored key is checked against it instead, so
 * a mismatch is loud and one line to fix in the content.
 */
function pronPairKey(pair) {
    if (!pair || !pair.id) return '';
    const key = (window.SRS && typeof SRS._typedKey === 'function')
        ? SRS._typedKey('phon', pair.id)
        : 'phon:' + pair.id;
    const authored = (pair.productionGate && pair.productionGate.requiresKey) || pair.srsKey;
    if (authored && authored !== key) {
        console.warn('Pronunciation: pair "' + pair.id + '" declares the SRS key "' +
                     authored + '" but this build stores it under "' + key +
                     '". Per-pair accuracy and the FR-PRN-6 gate use "' + key + '".');
    }
    return key;
}

/**
 * `{ [key]: { attempts, correct } }` with every value forced to a sane shape.
 *
 * This is the input to a gate, so it is sanitised on the way in from storage
 * rather than trusted: `correct` is clamped to `attempts`, both are clamped to
 * non-negative integers, and anything unrecognisable is dropped. A hand-edited
 * `{ attempts: 1, correct: 999 }` must not unlock a production task.
 */
function sanitizePronunciationAccuracy(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(key => {
        const rec = raw[key];
        if (!rec || typeof rec !== 'object') return;
        const attempts = Math.max(0, Math.floor(Number(rec.attempts) || 0));
        const correct = Math.min(attempts, Math.max(0, Math.floor(Number(rec.correct) || 0)));
        if (attempts === 0 && correct === 0) return;
        out[key] = { attempts: attempts, correct: correct };
    });
    return out;
}

/** `{ attempts, correct, rate }` for a pair key. `rate` is null with no attempts —
 *  "no data" and "0%" are different facts and must not be conflated on screen. */
function pronAccuracy(key) {
    const rec = (state.pronunciationAccuracy || {})[key];
    const attempts = (rec && rec.attempts) || 0;
    const correct = (rec && rec.correct) || 0;
    return {
        attempts: attempts,
        correct: correct,
        rate: attempts > 0 ? correct / attempts : null
    };
}

/**
 * Record ONE graded discrimination attempt against the pair (FR-PRN-2).
 *
 * Only ever called for a learner's FIRST answer on a drill item. A retry after a
 * miss is for the mouth, not for the number: re-counting it would let a learner
 * grind the FR-PRN-6 gate open by pressing the other button, which would put a
 * self-comparison task in front of exactly the learner it is meant to protect.
 */
function pronRecordAttempt(key, correct) {
    if (!key) return;
    if (!state.pronunciationAccuracy || typeof state.pronunciationAccuracy !== 'object') {
        state.pronunciationAccuracy = {};
    }
    const rec = state.pronunciationAccuracy[key] || { attempts: 0, correct: 0 };
    rec.attempts += 1;
    if (correct) rec.correct += 1;
    state.pronunciationAccuracy[key] = rec;
    saveProgress();
}

/**
 * FR-PRN-6: is the production/self-comparison task available for this pair?
 *
 * Thresholds come from the CONTENT (`productionGate.minAccuracy` /
 * `.minAttempts`), not from a constant here, because the author is the one who
 * knows how wide the perception blind spot is for a given contrast. The 0.8 / 10
 * defaults only apply to a pair that forgot to declare a gate — failing OPEN
 * there would be the wrong default, so an absent gate still gates.
 */
function pronGate(pair) {
    const gate = (pair && pair.productionGate) || {};
    const minAccuracy = typeof gate.minAccuracy === 'number' ? gate.minAccuracy : 0.8;
    const minAttempts = typeof gate.minAttempts === 'number' ? gate.minAttempts : 10;
    const acc = pronAccuracy(pronPairKey(pair));
    return {
        open: acc.attempts >= minAttempts && acc.rate !== null && acc.rate >= minAccuracy,
        minAccuracy: minAccuracy,
        minAttempts: minAttempts,
        attempts: acc.attempts,
        correct: acc.correct,
        rate: acc.rate
    };
}

/** Can this device speak at all? Feature-detected, never assumed. */
function pronAudioUsable() {
    return !!(window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined');
}

/**
 * Speak one or more short texts back to back at one rate.
 *
 * speechAPI.speak() calls speechSynthesis.cancel() on entry, so calling it twice
 * in a row plays only the second word — which is precisely the FR-PRN-1 "replay
 * both, back to back" case. The first text therefore goes through speechAPI (so
 * rate, lang, and the replay state stay identical to the rest of the app) and the
 * rest are queued onto the same synthesis queue without cancelling, which is what
 * that queue is for.
 *
 * @returns {boolean} whether anything was actually spoken — the caller uses this
 *          to tell the learner the truth when nothing came out.
 */
function pronSpeak(texts, rate) {
    const list = (Array.isArray(texts) ? texts : [texts]).filter(t => !!t);
    if (!list.length || !pronAudioUsable()) return false;
    try {
        speechAPI.speak(list[0], rate);
        for (let i = 1; i < list.length; i++) {
            const u = new SpeechSynthesisUtterance(list[i]);
            u.rate = rate;
            u.lang = 'en-US';
            window.speechSynthesis.speak(u);
        }
        return true;
    } catch (e) {
        AppErrorHandler.logError(e, 'pronunciation playback');
        return false;
    }
}

/** A labelled play button. Speaks `texts` at `rate` and says so if nothing plays. */
function pronPlayButton(label, texts, rate, ariaLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-secondary pron-play';
    btn.textContent = label;
    if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
    btn.addEventListener('click', () => {
        if (!pronSpeak(texts, rate)) {
            Toast.warning('This device could not play that. The written exercise below needs no sound.');
        }
    });
    return btn;
}

/**
 * How far the audio can be trusted for this pair, stated before the learner
 * answers anything rather than after they have collected a miss.
 *
 * 'unavailable'  the device cannot speak at all
 * 'untrusted'    the author marked this set `requiresBundledClip` and no clip
 *                ships in this repo, so it is running on the one thing they said
 *                not to trust it on
 * 'tts'          TTS with a stated risk the learner should know about
 */
function pronAudioNotice(pair) {
    if (!pronAudioUsable()) {
        return {
            level: 'unavailable',
            text: 'This device cannot play audio, so the listening drill is not available. The written exercise below teaches the other half of this problem — which English words use which sound — and needs no sound at all.'
        };
    }
    const audio = (pair && pair.audio) || {};
    if (audio.requiresBundledClip) {
        return {
            level: 'untrusted',
            text: 'Honest warning before you start: this pair is played by your phone\'s built-in voice, and the author of this content marked it as a set that needs a real recording. **If the two words sound identical on this device, that is far more likely to be the voice than your ear.** Use the written exercise instead — a miss recorded against a voice that cannot say the difference is worse than no score at all.'
        };
    }
    return {
        level: 'tts',
        text: 'These clips are your phone\'s built-in voice, not a recording of a person, and nobody has yet checked how well it says this pair on your device. If a word sounds wrong rather than just unfamiliar, trust the written exercise over the audio.'
    };
}

/**
 * Per-render state for the pair on screen. Rebuilt by loadPronunciationPair().
 *
 *   items       the drill queue: the pair's authored minimalPairs, in order
 *   step        which item is on screen
 *   target      'a' or 'b' — which member was PLAYED (the answer)
 *   graded      the first answer on this item has been recorded
 *   wrongSeen   any first-answer miss on this pair since it was loaded
 *   scheduled   the SRS outcome for this render has been written (write once)
 *   mode        'audio' (graded, feeds the gate) or 'text' (graded, does not)
 */
let pronunciationSession = null;

/**
 * The lapse half of the SRS contract (TEACHING_METHODOLOGY.md §3: a phoneme pair
 * resets on a "wrong discrimination choice").
 *
 * Written on the FIRST miss and once per render, exactly like the grammar
 * section: nine misses on one pair are one pair to review, not nine, and a
 * learner who walks away after the first miss still leaves the evidence.
 */
function schedulePronunciationLapse(pair) {
    if (!pronunciationSession || pronunciationSession.scheduled) return;
    pronunciationSession.scheduled = true;
    if (window.SRS && typeof SRS.scheduleItem === 'function') {
        SRS.scheduleItem('phon', pair.id, pair, false);
    }
}

/**
 * The success half: a clean round extends the interval. Only when the learner
 * finished every item of this round with no first-answer miss — a pair they got
 * wrong and then fixed must not buy a longer interval, same rule as grammar and
 * the same rule as srs.js applies to self-reports.
 */
function schedulePronunciationSuccess(pair) {
    if (!pronunciationSession || pronunciationSession.scheduled ||
        pronunciationSession.wrongSeen) return;
    pronunciationSession.scheduled = true;
    if (window.SRS && typeof SRS.scheduleItem === 'function') {
        SRS.scheduleItem('phon', pair.id, pair, true);
    }
}

/** Log the miss by type so it can be resurfaced (FR-SRS-3, principle 4). */
function recordPronunciationMistake(pair, item, heard, chosen) {
    if (typeof Mistakes === 'undefined' || !Mistakes || typeof Mistakes.record !== 'function') return;
    if (!pair.mistakeCategory) return;
    Mistakes.record(pair.mistakeCategory, {
        item: item.a + '/' + item.b,
        given: chosen,
        expected: heard,
        source: 'pronunciationDiscrimination'
    });
}

/** `<span class="pron-ipa">` — IPA is marked up so it can be styled legibly at
 *  200% zoom (FR-A11Y / methodology §6) and is never the only thing on screen. */
function pronIpa(text) {
    const span = document.createElement('span');
    span.className = 'pron-ipa';
    span.textContent = text;
    return span;
}

/**
 * FR-PRN-9. The two symbols of the pair, each with its plain-English gloss, what
 * the mouth does, and what the learner can FEEL — the last of these is the
 * load-bearing one (PROGRESS.md §6.aa rule 2: a learner who cannot yet hear the
 * contrast can still check their own mouth).
 *
 * This is the only place either symbol is introduced, which is what makes the
 * FR-PRN-9 guarantee hold rather than depend on remembering it at each use.
 */
function pronPhonemeBlock(pair) {
    const list = document.createElement('dl');
    list.className = 'pron-phonemes';
    (pair.phonemes || []).forEach(p => {
        const dt = document.createElement('dt');
        dt.appendChild(pronIpa(p.symbol));
        if (p.keyword) {
            const kw = document.createElement('span');
            kw.className = 'pron-keyword';
            kw.textContent = ' as in ' + p.keyword;
            dt.appendChild(kw);
        }
        list.appendChild(dt);

        const dd = document.createElement('dd');
        // The gloss is the FR-PRN-9 string itself, e.g. '/iː/ — the "ee" in sheep'.
        dd.appendChild(pronParagraph(p.gloss, 'pron-gloss'));
        if (p.articulation) dd.appendChild(pronParagraph(p.articulation));
        if (p.feel) dd.appendChild(pronParagraph(p.feel, 'pron-feel'));
        if (p.keyword) {
            const row = document.createElement('div');
            row.className = 'button-group';
            row.appendChild(pronPlayButton('▶ Hear ' + p.keyword, p.keyword,
                PRON_RATE_NORMAL, 'Hear the word ' + p.keyword));
            row.appendChild(pronPlayButton('▶ Slowly', p.keyword,
                PRON_RATE_SLOW, 'Hear the word ' + p.keyword + ' slowly'));
            dd.appendChild(row);
        }
        list.appendChild(dd);
    });
    return list;
}

/**
 * FR-PRN-2's other half: "learner can see per-pair accuracy". The number for the
 * pair on screen, plus all three pairs, because the whole point of tracking per
 * pair is that it is the learner's own profile — which contrast is their problem.
 *
 * Says "not tried yet" rather than "0%" when there are no attempts: those are
 * different facts and printing the second for the first is a small lie.
 */
function pronAccuracyBlock(pair) {
    const host = document.createElement('div');
    host.className = 'pron-accuracy';
    const own = pronAccuracy(pronPairKey(pair));

    host.appendChild(pronParagraph(
        own.attempts === 0
            ? 'You have not tried this pair yet.'
            : 'On this pair you have picked the right word **' + own.correct +
              ' of ' + own.attempts + '** times (' + Math.round(own.rate * 100) + '%).',
        'pron-accuracy-own'
    ));

    const pairs = pronunciationPairs();
    if (pairs.length > 1) {
        host.appendChild(pronDisclosure('Your accuracy on all three pairs', body => {
            const ul = document.createElement('ul');
            ul.className = 'pron-accuracy-list';
            pairs.forEach(p => {
                const acc = pronAccuracy(pronPairKey(p));
                const li = document.createElement('li');
                const name = document.createElement('strong');
                name.textContent = (p.pair || []).join(' ~ ') || p.id;
                li.appendChild(name);
                li.appendChild(document.createTextNode(
                    acc.attempts === 0
                        ? ' — not tried yet'
                        : ' — ' + acc.correct + ' of ' + acc.attempts +
                          ' (' + Math.round(acc.rate * 100) + '%)'
                ));
                ul.appendChild(li);
            });
            body.appendChild(ul);
            body.appendChild(pronParagraph(
                'Only the listening drill counts here. The written exercise is useful but it does not test your ear, so it is kept out of this number.',
                'pron-note'
            ));
        }));
    }
    return host;
}

/** The teaching card: what the two sounds are, and how to feel the difference. */
function renderPronunciationTeaching(pair) {
    const title = document.getElementById('pronunciationPairTitle');
    if (title) {
        title.textContent = (pair.pair || []).join(' or ') + ' — ' +
            (pair.phonemes || []).map(p => p.keyword).filter(Boolean).join(' / ');
    }

    const host = document.getElementById('pronunciationTeaching');
    if (!host) return;
    host.textContent = '';

    const meta = document.createElement('p');
    meta.className = 'pron-meta';
    meta.textContent = 'Pair ' + (pronunciationSession.index + 1) + ' of ' +
        pronunciationSession.total +
        (pair.code ? ' · ' + pair.code : '') +
        (pair.difficulty ? ' · ' + pair.difficulty + ' contrast' : '');
    host.appendChild(meta);

    // The feelable difference in one line. Never the auditory one — that is the
    // thing the learner cannot yet use.
    host.appendChild(pronParagraph(pair.label, 'pron-label'));
    host.appendChild(pronPhonemeBlock(pair));

    // REQUIREMENTS.md §3.3: the articulatory cue is load-bearing, not
    // decorative, so it is never behind a disclosure.
    const cue = document.createElement('div');
    cue.className = 'pron-cue';
    const cueHead = document.createElement('h4');
    cueHead.textContent = 'How to feel the difference';
    cue.appendChild(cueHead);
    cue.appendChild(pronParagraph(pair.articulatoryCue));
    if (pair.mirrorCheck) cue.appendChild(pronParagraph(pair.mirrorCheck, 'pron-mirror'));
    host.appendChild(cue);

    if (pair.lengthNote) {
        host.appendChild(pronDisclosure('How much can you trust "long versus short"?', body => {
            body.appendChild(pronParagraph(pair.lengthNote));
        }));
    }

    if (Array.isArray(pair.caveats) && pair.caveats.length) {
        host.appendChild(pronDisclosure('Honest limits of this drill', body => {
            const ul = document.createElement('ul');
            pair.caveats.forEach(c => {
                const li = document.createElement('li');
                pronText(li, c);
                ul.appendChild(li);
            });
            body.appendChild(ul);
        }));
    }

    host.appendChild(pronAccuracyBlock(pair));
}

// ---------------------------------------------------------------------------
// The drill (FR-PRN-1)
// ---------------------------------------------------------------------------

/** Switch this render between the audio drill and the written fallback. */
function pronSetMode(pair, mode) {
    pronunciationSession.mode = mode;
    pronunciationSession.step = 0;
    // Cleared with the step: `target` is a fact about one item, and carrying it
    // across a mode switch would make the first word of the new round play
    // whichever side the abandoned one happened to land on.
    pronunciationSession.target = null;
    pronunciationSession.graded = false;
    renderPronunciationDrill(pair);
}

/** The banner that tells the learner what the audio is worth, before they answer. */
function pronNoticeBlock(pair, host) {
    // Already in the written exercise on a device that CAN speak: the AS-3
    // warning has done its job and repeating it here would be noise. What the
    // learner needs at this point is the way back.
    if (pronunciationSession.mode === 'text' && pronAudioUsable()) {
        const box = document.createElement('div');
        box.className = 'pron-audio-notice pron-audio-tts';
        box.appendChild(pronParagraph('You are on the written exercise, which needs no sound.'));
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'btn-secondary';
        back.textContent = 'Back to the listening drill';
        back.addEventListener('click', () => pronSetMode(pair, 'audio'));
        box.appendChild(back);
        host.appendChild(box);
        return;
    }

    const notice = pronAudioNotice(pair);
    const box = document.createElement('div');
    box.className = 'pron-audio-notice pron-audio-' + notice.level;
    box.appendChild(pronParagraph(notice.text));
    if (notice.level !== 'unavailable' && pronunciationSession.mode === 'audio' &&
        pair.textOnlyFallback) {
        const swap = document.createElement('button');
        swap.type = 'button';
        swap.className = 'btn-secondary';
        swap.textContent = 'Use the written exercise instead';
        swap.addEventListener('click', () => pronSetMode(pair, 'text'));
        box.appendChild(swap);
    }
    host.appendChild(box);
}

/** Render whichever drill this render is running. */
function renderPronunciationDrill(pair) {
    const host = document.getElementById('pronunciationDrill');
    if (!host) return;
    host.textContent = '';

    pronNoticeBlock(pair, host);

    if (pronunciationSession.mode === 'text') {
        renderPronunciationTextItem(pair, host);
    } else {
        renderPronunciationAudioItem(pair, host);
    }
}

/**
 * One discrimination item: play one word of the pair, learner picks which.
 *
 * The word played is chosen at random per item so the answer cannot be learned
 * from the position of the button. The two option buttons stay in the AUTHORED
 * order (`a` then `b`), so the learner is choosing between two words and not
 * between two positions.
 */
function renderPronunciationAudioItem(pair, host) {
    const items = pronunciationSession.items;
    const item = items[pronunciationSession.step];
    if (!item) return;

    // Only decided once per item: re-rendering after a retry must replay the
    // same word, or the retry is a different question.
    if (!pronunciationSession.target) {
        pronunciationSession.target = Math.random() < 0.5 ? 'a' : 'b';
    }
    const heard = item[pronunciationSession.target];

    const prompt = document.createElement('p');
    prompt.className = 'pron-prompt';
    prompt.textContent = 'Word ' + (pronunciationSession.step + 1) + ' of ' + items.length +
        '. Play it, then choose the word you heard.';
    host.appendChild(prompt);

    const controls = document.createElement('div');
    controls.className = 'button-group';
    controls.appendChild(pronPlayButton('▶ Play', heard, PRON_RATE_NORMAL, 'Play the word'));
    controls.appendChild(pronPlayButton('▶ Play slowly', heard, PRON_RATE_SLOW, 'Play the word slowly'));
    host.appendChild(controls);

    const options = document.createElement('div');
    options.className = 'pron-options';
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', 'Which word did you hear');

    const feedback = document.createElement('div');
    feedback.className = 'pron-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    ['a', 'b'].forEach(side => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pron-option';
        btn.textContent = item[side];
        btn.addEventListener('click', () => {
            answerPronunciationItem(pair, item, side, btn, options, feedback);
        });
        options.appendChild(btn);
    });
    host.appendChild(options);
    host.appendChild(feedback);

    // FR-A11Y-4 / AS-3: an escape hatch that costs the learner nothing and is
    // not silently recorded as a wrong answer, because it is not one.
    if (pair.textOnlyFallback) {
        const cannot = document.createElement('button');
        cannot.type = 'button';
        cannot.className = 'btn-secondary pron-cannot';
        cannot.textContent = 'I cannot hear a difference — switch to the written exercise';
        cannot.addEventListener('click', () => {
            Toast.info('Nothing was recorded as wrong. Switching to the written exercise.');
            pronSetMode(pair, 'text');
        });
        host.appendChild(cannot);
    }

    // Auto-play the item on arrival: it is a listening task, and requiring two
    // presses to reach the question is friction for no gain. Silent failure is
    // fine here — the Play buttons above are still there, and the notice block
    // has already said what to do if nothing comes out.
    pronSpeak(heard, PRON_RATE_NORMAL);
}

/** Grade one discrimination answer, then teach. */
function answerPronunciationItem(pair, item, chosenSide, button, optionsHost, feedbackHost) {
    if (!pronunciationSession) return;
    const correct = chosenSide === pronunciationSession.target;
    const heard = item[pronunciationSession.target];
    const chosen = item[chosenSide];
    const firstAnswer = !pronunciationSession.graded;

    optionsHost.querySelectorAll('.pron-option').forEach(b => b.classList.remove('selected'));
    button.classList.add('selected');
    button.classList.toggle('correct', correct);
    button.classList.toggle('incorrect', !correct);

    // FR-PRN-2. First answer only — see pronRecordAttempt().
    if (firstAnswer) {
        pronunciationSession.graded = true;
        pronRecordAttempt(pronunciationSession.key, correct);
        if (!correct) {
            pronunciationSession.wrongSeen = true;
            schedulePronunciationLapse(pair);
            recordPronunciationMistake(pair, item, heard, chosen);
        }
    }

    feedbackHost.textContent = '';
    feedbackHost.className = 'pron-feedback visible ' + (correct ? 'is-correct' : 'is-wrong');

    if (correct) {
        renderPronunciationCorrect(pair, item, heard, feedbackHost, firstAnswer);
    } else {
        renderPronunciationWrong(pair, item, heard, chosen, feedbackHost, optionsHost, firstAnswer);
    }

    // The number on the teaching card has just changed, and so may the gate.
    renderPronunciationTeaching(pair);
    renderPronunciationProduce(pair);
}

/**
 * A right answer. Methodology §2 and §5: confirm the specific thing, do not
 * praise. So it says which word it was and which sound that is — no "Great job!".
 */
function renderPronunciationCorrect(pair, item, heard, feedbackHost, firstAnswer) {
    const verdict = document.createElement('p');
    verdict.className = 'pron-verdict';
    verdict.textContent = '✓ That was ';
    const word = document.createElement('strong');
    word.textContent = heard;
    verdict.appendChild(word);
    verdict.appendChild(document.createTextNode('. '));
    verdict.appendChild(pronIpa(
        pronunciationSession.target === 'a' ? item.aIpa : item.bIpa
    ));
    feedbackHost.appendChild(verdict);

    // Which of the two sounds that word contains, with its gloss (FR-PRN-9).
    // phonemes[0] is `pair[0]` is the `a` member, by the content's own schema.
    const phoneme = (pair.phonemes || [])[pronunciationSession.target === 'a' ? 0 : 1];
    if (phoneme) feedbackHost.appendChild(pronParagraph(phoneme.gloss, 'pron-gloss'));
    if (item.note) feedbackHost.appendChild(pronParagraph(item.note, 'pron-note'));

    if (!firstAnswer) {
        feedbackHost.appendChild(pronParagraph(
            'Your first answer on this word is the one that was recorded, so this does not change the number — it is the practice that matters here.',
            'pron-note'
        ));
    }

    feedbackHost.appendChild(pronNextButton(pair));
}

/**
 * THE FR-PRN-1 WRONG-ANSWER PATH, in the order the requirement and
 * TEACHING_METHODOLOGY.md §2 list it:
 *
 *   1. what was actually played, and what they chose        (honest, not a scold)
 *   2. BOTH words replayed back to back and SLOWED          — replayed on arrival
 *      and re-playable, both at the same rate (§6.aa rule 4)
 *   3. the differing FEATURE named                          — `contrastFeature`
 *   4. what to do with the mouth                            — `articulatoryCue`
 *   5. the mirror check as the retry cue                    — `mirrorCheck`
 *   6. a retry, on the same screen as the ✗                 — FR-A11Y-5
 *
 * `pair.discrimination.wrongAnswer` is NOT rendered here. It reads "Both words
 * replay back to back and slowed. Name the feature, not the verdict: …" — an
 * instruction to whoever wires the drill, with the learner-facing sentence quoted
 * inside it. Printing it verbatim would show the learner the instructions. The
 * message below is composed from the fields that ARE learner-facing, which is
 * what that instruction asks for.
 */
function renderPronunciationWrong(pair, item, heard, chosen, feedbackHost, optionsHost, firstAnswer) {
    const verdict = document.createElement('p');
    verdict.className = 'pron-verdict';
    verdict.textContent = '✗ That was ';
    const right = document.createElement('strong');
    right.textContent = heard;
    verdict.appendChild(right);
    verdict.appendChild(document.createTextNode(', not '));
    const wrong = document.createElement('em');
    wrong.textContent = chosen;
    verdict.appendChild(wrong);
    verdict.appendChild(document.createTextNode('.'));
    feedbackHost.appendChild(verdict);

    // 2. Both words, back to back, slowed, at one matched rate.
    const played = pronSpeak([item.a, item.b], PRON_RATE_SLOW);
    const replay = document.createElement('p');
    replay.className = 'pron-replay';
    replay.textContent = played
        ? 'Playing both slowly, one after the other: ' + item.a + ', then ' + item.b + '.'
        : 'This device could not replay them. Read on — the difference below is one you can feel without hearing anything.';
    feedbackHost.appendChild(replay);

    const replayRow = document.createElement('div');
    replayRow.className = 'button-group';
    replayRow.appendChild(pronPlayButton(
        '▶ Play both again, slowly', [item.a, item.b], PRON_RATE_SLOW,
        'Play ' + item.a + ' and ' + item.b + ' slowly, one after the other'
    ));
    feedbackHost.appendChild(replayRow);

    // 3. The feature. This is the sentence FR-PRN-1 exists for.
    const feature = document.createElement('p');
    feature.className = 'pron-feature';
    feature.textContent = 'The difference is ';
    const named = document.createElement('strong');
    named.textContent = pair.contrastFeature;
    feature.appendChild(named);
    feature.appendChild(document.createTextNode('.'));
    feedbackHost.appendChild(feature);

    // Which of the two sounds each word has, each with its gloss (FR-PRN-9).
    const list = document.createElement('ul');
    list.className = 'pron-contrast-pair';
    ['a', 'b'].forEach((side, i) => {
        const phoneme = (pair.phonemes || [])[i];
        const li = document.createElement('li');
        const w = document.createElement('strong');
        w.textContent = item[side];
        li.appendChild(w);
        li.appendChild(document.createTextNode(' '));
        li.appendChild(pronIpa(side === 'a' ? item.aIpa : item.bIpa));
        if (phoneme) {
            li.appendChild(document.createTextNode(' — '));
            pronText(li, phoneme.gloss);
        }
        list.appendChild(li);
    });
    feedbackHost.appendChild(list);

    // 4 and 5. What to do with the mouth, and how to check it.
    feedbackHost.appendChild(pronParagraph(pair.articulatoryCue, 'pron-cue-inline'));
    if (pair.mirrorCheck) {
        feedbackHost.appendChild(pronParagraph(pair.mirrorCheck, 'pron-mirror'));
    }
    if (item.note) feedbackHost.appendChild(pronParagraph(item.note, 'pron-note'));

    if (firstAnswer) {
        feedbackHost.appendChild(pronParagraph(
            'This one is recorded as a miss and this pair will come back sooner. Most learners take a while with it — try the same word again now.',
            'pron-note'
        ));
    }

    // 6. Retry, in place, with the options still live (FR-A11Y-5). The panel is
    // deliberately NOT cleared: the cue, the replay and "Next word" all stay
    // reachable, so a learner who tries again and still cannot hear it is not
    // trapped on an item with no way forward. Answering again rebuilds the panel.
    const retryRow = document.createElement('div');
    retryRow.className = 'button-group';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn-primary';
    retry.textContent = 'Play it again and try this word once more';
    retry.addEventListener('click', () => {
        optionsHost.querySelectorAll('.pron-option').forEach(b => {
            b.classList.remove('selected', 'correct', 'incorrect');
        });
        pronSpeak(heard, PRON_RATE_NORMAL);
    });
    retryRow.appendChild(retry);
    retryRow.appendChild(pronNextButton(pair));
    feedbackHost.appendChild(retryRow);
}

/** "Next word" / "Finish", advancing the round or completing it. */
function pronNextButton(pair) {
    const last = pronunciationSession.step >= pronunciationSession.items.length - 1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = last ? 'btn-primary' : 'btn-secondary';
    btn.textContent = last ? 'Finish this pair' : 'Next word →';
    btn.addEventListener('click', () => {
        if (last) {
            completePronunciationDrill(pair);
            return;
        }
        pronunciationSession.step += 1;
        pronunciationSession.target = null;
        pronunciationSession.graded = false;
        renderPronunciationDrill(pair);
    });
    return btn;
}

// ---------------------------------------------------------------------------
// The written fallback (AS-3): gradable, needs no audio, and is honest about
// what it does not measure
// ---------------------------------------------------------------------------

/** How a fallback answer is shown. A symbol answer gets its FR-PRN-9 gloss. */
function pronFallbackLabel(pair, answer) {
    const phoneme = (pair.phonemes || []).find(
        p => p && String(p.symbol).replace(/\//g, '') === answer
    );
    if (phoneme) return phoneme.gloss;
    if (answer === 'both') return 'One of each — both sounds are in the word';
    if (answer === 'neither') return 'Neither of them';
    return String(answer);
}

/** The answer space of a fallback: the pair's two symbols, plus any extra the
 *  items actually use ('both', 'neither'). Never an option no item can be. */
function pronFallbackOptions(pair) {
    const items = (pair.textOnlyFallback && pair.textOnlyFallback.items) || [];
    const used = [];
    items.forEach(it => {
        if (it && it.answer != null && used.indexOf(it.answer) === -1) used.push(it.answer);
    });
    const symbols = (pair.phonemes || []).map(p => String(p.symbol).replace(/\//g, ''));
    const ordered = symbols.filter(s => used.indexOf(s) !== -1);
    used.forEach(a => { if (ordered.indexOf(a) === -1) ordered.push(a); });
    return ordered;
}

function renderPronunciationTextItem(pair, host) {
    const fallback = pair.textOnlyFallback;
    if (!fallback || !Array.isArray(fallback.items) || !fallback.items.length) {
        host.appendChild(pronParagraph(
            'No written exercise is written for this pair yet, so there is nothing here that works without sound.'
        ));
        return;
    }

    const items = fallback.items;
    const step = Math.min(pronunciationSession.step, items.length - 1);
    const item = items[step];

    const why = document.createElement('div');
    why.className = 'pron-fallback-why';
    why.appendChild(pronParagraph(fallback.prompt, 'pron-prompt'));
    why.appendChild(pronParagraph(
        'This is graded and it counts as finishing this pair, but it is deliberately kept out of your listening accuracy: it tests which sound a word has, not whether you can hear the two apart.',
        'pron-note'
    ));
    host.appendChild(why);

    const count = document.createElement('p');
    count.className = 'pron-prompt';
    count.textContent = 'Word ' + (step + 1) + ' of ' + items.length + ': ';
    const word = document.createElement('strong');
    word.textContent = item.word;
    count.appendChild(word);
    host.appendChild(count);

    const options = document.createElement('div');
    options.className = 'pron-options';
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', 'Which sound does this word have');

    const feedback = document.createElement('div');
    feedback.className = 'pron-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    pronFallbackOptions(pair).forEach(answer => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pron-option';
        btn.textContent = pronFallbackLabel(pair, answer);
        btn.addEventListener('click', () => {
            const correct = answer === item.answer;
            options.querySelectorAll('.pron-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            btn.classList.toggle('correct', correct);
            btn.classList.toggle('incorrect', !correct);

            feedback.textContent = '';
            feedback.className = 'pron-feedback visible ' + (correct ? 'is-correct' : 'is-wrong');

            const verdict = document.createElement('p');
            verdict.className = 'pron-verdict';
            verdict.textContent = (correct ? '✓ ' : '✗ ') + item.word + ' ';
            verdict.appendChild(pronIpa(item.ipa));
            feedback.appendChild(verdict);
            feedback.appendChild(pronParagraph(
                pronFallbackLabel(pair, item.answer), 'pron-gloss'
            ));
            if (item.hint) feedback.appendChild(pronParagraph(item.hint, 'pron-note'));

            const row = document.createElement('div');
            row.className = 'button-group';
            const last = step >= items.length - 1;
            const next = document.createElement('button');
            next.type = 'button';
            next.className = last ? 'btn-primary' : 'btn-secondary';
            next.textContent = last ? 'Finish this pair' : 'Next word →';
            next.addEventListener('click', () => {
                if (last) {
                    completePronunciationDrill(pair);
                    return;
                }
                pronunciationSession.step = step + 1;
                renderPronunciationDrill(pair);
            });
            row.appendChild(next);
            // No "back to the audio drill" button here: pronNoticeBlock() puts
            // one at the top of this card on every render, and two of the same
            // control on one screen is a way to make the learner wonder whether
            // they do different things.
            feedback.appendChild(row);
        });
        options.appendChild(btn);
    });

    host.appendChild(options);
    host.appendChild(feedback);

    if (fallback.why && step === 0) {
        host.appendChild(pronDisclosure('Why this is worth doing without audio', body => {
            body.appendChild(pronParagraph(fallback.why));
        }));
    }
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

/**
 * The call that makes the section count. updateStatistics('pronunciation') reads
 * the registry row, so `pronunciationCompleted` / `totalPronunciation` / the
 * `pronunciation` daily average all move with no section-specific code.
 *
 * `pronunciationSession.level` is passed to both markExerciseComplete() and
 * isExerciseCompleted() for the reason US-152 documents: the id must be stamped
 * with the tier the content actually came from. Pronunciation content is not
 * tiered at all, so its probe reports it at `foundation` only and every id is
 * `pronunciation_foundation_N` whatever level button is lit — otherwise one pair
 * would be completable, and counted, once per tier.
 */
function completePronunciationDrill(pair) {
    const index = pronunciationSession.index;
    const level = pronunciationSession.level;
    const alreadyDone = isExerciseCompleted('pronunciation', index, level);

    // Only in the audio drill is a clean round evidence about the learner's ear.
    if (pronunciationSession.mode === 'audio') schedulePronunciationSuccess(pair);

    if (!alreadyDone) {
        state.dailyGoals.pronunciation = true;
        updateStatistics('pronunciation');
        updateDashboard();
    }
    markExerciseComplete('pronunciation', index, level);

    const done = document.getElementById('pronunciationFeedback');
    if (done) {
        const gate = pronGate(pair);
        let msg;
        if (pronunciationSession.mode === 'text') {
            msg = 'Written exercise finished. Nothing was claimed about your ear here — when the audio is worth trusting, the listening drill is what moves the number.';
        } else if (pronunciationSession.wrongSeen) {
            msg = 'Round finished. This pair will come back sooner, which is the point of getting one wrong.';
        } else {
            msg = 'Round finished with every word right first time.';
        }
        if (pronunciationSession.mode === 'audio' && !gate.open) {
            msg += ' Speaking practice for this pair opens at ' +
                Math.round(gate.minAccuracy * 100) + '% over ' + gate.minAttempts +
                ' tries — you are at ' + gate.correct + ' of ' + gate.attempts + '.';
        }
        // 'success' / 'info', which are the only classes styles.css defines for
        // .feedback. A finished round with misses in it is `info`, not `error`:
        // getting one wrong is how the pair earns a shorter interval, and §5 says
        // do not use a red ✗ without the fix, which was already on the item.
        showFeedback('pronunciationFeedback', msg,
            pronunciationSession.wrongSeen ? 'info' : 'success');
    }

    // Re-run the gate and repaint the ✓ / Retake indicator.
    renderPronunciationProduce(pair);
    updateNavigationButtons('pronunciation');
}

// ---------------------------------------------------------------------------
// Production / self-comparison (FR-PRN-4, FR-PRN-5), gated by FR-PRN-6
// ---------------------------------------------------------------------------

/**
 * The one place in this section that FR-PRN-6 governs, and the only gate in the
 * app that is allowed to exist (FR-SPK-9: "Only discrimination may gate").
 *
 * Below the threshold the task is genuinely unavailable — not greyed out with the
 * content visible anyway — because the reason for the gate is that a learner who
 * cannot yet hear a contrast cannot self-judge it, and showing them the
 * self-check questions is the whole of the task.
 *
 * Above it, nothing is scored and no verdict is ever produced about the learner's
 * voice (FR-PRN-5). The self-check is the AUTHORED articulatory question — what
 * did your mouth do — never "did it sound right?", which is unanswerable by
 * exactly the person who needs the answer (PROGRESS.md §6.aa rule 2).
 */
function renderPronunciationProduce(pair) {
    const host = document.getElementById('pronunciationProduce');
    if (!host) return;
    host.textContent = '';

    const gate = pronGate(pair);

    if (!gate.open) {
        const lock = document.createElement('div');
        lock.className = 'pron-locked';
        lock.appendChild(pronParagraph(
            'Speaking practice for this pair is not open yet.', 'pron-locked-head'
        ));
        lock.appendChild(pronParagraph(
            'It opens once you are picking the right word at least ' +
            Math.round(gate.minAccuracy * 100) + '% of the time on this pair, over at least ' +
            gate.minAttempts + ' tries. ' +
            (gate.attempts === 0
                ? 'You have not tried this pair yet.'
                : 'You are at ' + gate.correct + ' of ' + gate.attempts + ' (' +
                  Math.round(gate.rate * 100) + '%).')
        ));
        lock.appendChild(pronParagraph(
            'This is not a reward being withheld. Judging your own pronunciation means hearing the difference first — until then a self-check would only tell you what you already believe.'
        ));
        host.appendChild(lock);
        return;
    }

    host.appendChild(pronParagraph(
        'Say ' + (pair.phonemes || []).map(p => '*' + p.keyword + '*').join(' and then ') +
        ' out loud, in front of a mirror if you can.', 'pron-task'
    ));

    // §6.aa rule 4: the model is offered at the same slow rate for both words, so
    // the learner is not comparing a fast clip against their own slow attempt.
    const row = document.createElement('div');
    row.className = 'button-group';
    (pair.phonemes || []).forEach(p => {
        if (p.keyword) {
            row.appendChild(pronPlayButton('▶ ' + p.keyword + ', slowly', p.keyword,
                PRON_RATE_SLOW, 'Hear ' + p.keyword + ' slowly'));
        }
    });
    const both = (pair.phonemes || []).map(p => p.keyword).filter(Boolean);
    if (both.length === 2) {
        row.appendChild(pronPlayButton('▶ Both, slowly', both, PRON_RATE_SLOW,
            'Hear both words slowly, one after the other'));
    }
    host.appendChild(row);

    host.appendChild(pronParagraph(pair.articulatoryCue, 'pron-cue-inline'));

    // The self-check. ONE articulatory question, per §6.aa rule 2.
    const question = (pair.feelChecks || [])[0];
    if (question) {
        const h = document.createElement('h4');
        h.textContent = 'Check yourself';
        host.appendChild(h);
        host.appendChild(pronParagraph(question, 'pron-selfcheck-q'));

        const status = document.createElement('div');
        status.className = 'pron-feedback';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        const buttons = document.createElement('div');
        buttons.className = 'button-group';
        buttons.setAttribute('role', 'group');
        buttons.setAttribute('aria-label', 'Self-check');

        const yes = document.createElement('button');
        yes.type = 'button';
        yes.className = 'btn-primary';
        yes.textContent = 'Yes, I felt that';
        yes.addEventListener('click', () => {
            // Deliberately not sent to SRS. A learner marking their own speaking
            // right is not evidence, and srs.js would ignore a self-reported
            // success anyway (FR-SRS-5) — so pretending to record it would be
            // theatre.
            status.className = 'pron-feedback visible is-correct';
            status.textContent = 'Good — that is the movement to keep. Nothing here is scored: this app never judges your voice.';
        });

        const notYet = document.createElement('button');
        notYet.type = 'button';
        notYet.className = 'btn-secondary';
        notYet.textContent = 'Not yet / skip this';
        notYet.addEventListener('click', () => {
            // FR-SRS-5 / §6.aa rule 6: a self-report may bring an item back
            // sooner and may never certify it.
            if (window.SRS && typeof SRS.scheduleItem === 'function') {
                SRS.scheduleItem('phon', pair.id, pair, false, { selfReported: true });
                if (typeof updateDueCount === 'function') updateDueCount();
            }
            status.className = 'pron-feedback visible';
            status.textContent = 'Fine — skipping costs you nothing, and this pair will come back sooner so you can try again.';
        });

        buttons.appendChild(yes);
        buttons.appendChild(notYet);
        host.appendChild(buttons);
        host.appendChild(status);
    }

    if ((pair.feelChecks || []).length > 1) {
        host.appendChild(pronDisclosure('More things you can feel', body => {
            const ul = document.createElement('ul');
            ul.className = 'pron-selfcheck';
            pair.feelChecks.slice(1).forEach(q => {
                const li = document.createElement('li');
                pronText(li, q);
                ul.appendChild(li);
            });
            body.appendChild(ul);
        }));
    }

    // The honest limit, stated rather than implied. §6.aa rule 3 wants A→B→A —
    // model, your own recording, model again — and this build cannot record you,
    // so it does not pretend to have done the comparison.
    host.appendChild(pronParagraph(
        'This app does not record you, so nothing is played back and nothing is scored. What it can do is tell you what to feel — and when you want to know whether a stranger would understand you, the only honest test is to ask one.',
        'pron-note'
    ));
}

// ---------------------------------------------------------------------------
// Section loader and navigation
// ---------------------------------------------------------------------------

/**
 * The section loader, registered as `pronunciation` in Sections.registerRuntime().
 *
 * Renders exactly one pair: whichever `state.currentPronunciationIndex` points
 * at, clamped to what is authored. Synchronous and content-only.
 */
function loadPronunciationPair() {
    const pairs = pronunciationPairs();

    const feedbackEl = document.getElementById('pronunciationFeedback');
    if (feedbackEl) feedbackEl.className = 'feedback';

    if (!pairs.length) {
        const title = document.getElementById('pronunciationPairTitle');
        if (title) title.textContent = 'No sound pairs yet';
        ['pronunciationTeaching', 'pronunciationDrill', 'pronunciationProduce'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
        const host = document.getElementById('pronunciationTeaching');
        if (host) {
            host.appendChild(pronParagraph(
                'The pronunciation content could not be loaded on this device. Everything else still works — try reloading the page.'
            ));
        }
        pronunciationSession = null;
        updatePronunciationNavigationState(0);
        return;
    }

    // Clamp rather than wrap, same reasoning as the grammar section.
    const index = Math.min(Math.max(0, state.currentPronunciationIndex || 0), pairs.length - 1);
    state.currentPronunciationIndex = index;
    const pair = pairs[index];

    pronunciationSession = {
        pairId: pair.id,
        key: pronPairKey(pair),
        level: resolveDifficulty(state.currentDifficulty, 'pronunciation'),
        index: index,
        total: pairs.length,
        // The authored minimal pairs, in order, one per screen. Authored order is
        // kept on purpose: the first entry of each set is the canonical pair the
        // content teaches from (sheep/ship, bad/bed, cot/coat).
        //
        // ⚠️ NOT filtered by `audio.ttsHint`, and that is a known limitation, not
        // an oversight. That field says in prose — "Never use *seat/sit* or
        // *cheap/chip* as a TTS item" — which specific rows are unsafe on a
        // synthesised voice, and prose is not something this loader can act on
        // without hardcoding a copy of the content in app.js, which would drift
        // the moment the pairs are edited. The mitigation today is the honest
        // banner (pronAudioNotice) plus the one-click written exercise. The fix
        // is a machine-readable flag on the row itself — `ttsSafe: false` on the
        // minimalPairs entries — after which this line becomes a filter.
        items: Array.isArray(pair.minimalPairs) ? pair.minimalPairs.slice() : [],
        step: 0,
        target: null,
        graded: false,
        wrongSeen: false,
        scheduled: false,
        // A device that cannot speak starts in the written exercise, rather than
        // showing a listening drill with no listening in it.
        mode: pronAudioUsable() ? 'audio' : 'text'
    };

    if (!pronunciationSession.items.length && pair.textOnlyFallback) {
        pronunciationSession.mode = 'text';
    }

    renderPronunciationTeaching(pair);
    renderPronunciationDrill(pair);
    renderPronunciationProduce(pair);

    // Paints #pronunciationStatus (created after the h2 on first use) and is the
    // reason this section's h2 must stay a direct child.
    updateNavigationButtons('pronunciation');
    updatePronunciationNavigationState(pairs.length);
}

/** Disable the ends of the walk rather than letting Next look broken. */
function updatePronunciationNavigationState(total) {
    const prev = document.getElementById('prevPronunciation');
    const next = document.getElementById('nextPronunciation');
    const index = state.currentPronunciationIndex || 0;
    if (prev) prev.disabled = total === 0 || index <= 0;
    if (next) next.disabled = total === 0 || index >= total - 1;
}

function initializePronunciationButtons() {
    const prev = document.getElementById('prevPronunciation');
    const next = document.getElementById('nextPronunciation');

    if (prev) {
        prev.onclick = () => {
            if ((state.currentPronunciationIndex || 0) > 0) {
                state.currentPronunciationIndex--;
                loadPronunciationPair();
                saveProgress();
            }
        };
    }

    if (next) {
        next.onclick = () => {
            const total = pronunciationPairs().length;
            if ((state.currentPronunciationIndex || 0) < total - 1) {
                state.currentPronunciationIndex++;
                loadPronunciationPair();
                saveProgress();
            }
        };
    }
}

// WHAT THIS SECTION DELIBERATELY DOES NOT BUILD, and what it would need.
//
// 1. data/pronunciation/consonants.js. The file exists on disk and is authored to
//    the same `pairs[]` shape, and pronunciationPairs() above already reads it —
//    but index.html does NOT load it and this commit does not add the tag,
//    because that file belongs to another author and is not mine to ship. Wiring
//    it is two lines and no code: a `<script src="data/pronunciation/consonants.js">`
//    before app.js, and the same path in service-worker.js STATIC_ASSETS (which
//    __tests__/unit/assets.test.js enforces). Its five pairs then appear as
//    Pairs 4–8, after the three vowel pairs, and every existing learner's
//    `pronunciation_foundation_0..2` ids keep meaning what they meant.
//
// 2. `PRONUNCIATION_VOWELS_STRESS.stress` (21 word-stress items, FR-PRN-3) and
//    `.noticing` (15 rhythm / final-vowel / cluster items, FR-PRN-8) are authored
//    and rendered nowhere. Neither is a small addition to this file:
//
//  - `stress[]` needs three drill modes ('choose-stress', 'choose-syllable-count',
//    'choose-form'), a syllable renderer that marks primary/secondary/reduced from
//    `stressNumbers` without parsing the display string, and — the part that is
//    not UI — a per-word progress model. Every item schedules under the SINGLE key
//    `phon:word-stress`, so 21 words share one SRS record and per-word accuracy is
//    not an SRS fact at all. That needs its own counter, like
//    state.pronunciationAccuracy but keyed by item id, or the section will
//    remember only "word stress" as one lump.
//  - `noticing[]` needs SEVEN modes ('count-beats', 'pick-beat-words',
//    'pick-written-form', 'count-sounds', 'count-syllables', 'sort',
//    'pick-syllable-count', plus 'match-beat-to-meaning' and
//    'pick-which-word-you-said' which the file's own header does not list), two of
//    them multi-select over `tokens` and three graded from `items[].answer` rather
//    than a `correctIndex`. It also has no projector in srs.js at all:
//    `phon:rhythm`, `phon:final-vowel` and `phon:cluster` would be scheduled with
//    PROJECTORS.phon's vowel-pair field list, which matches none of their fields,
//    so every review card would be empty.
//
// One drill that grades one thing honestly is worth more than three half-built
// ones, so they are left authored and unwired rather than rendered badly.

// ============================================
// SECTION LOADER REGISTRATION
// ============================================
//
// The one place section loaders are wired to js/core/sections.js, deliberately
// placed after every loader declaration in this file rather than inside the
// registry, because sections.js is a separate classic <script> that parses
// BEFORE app.js: naming loadVocabularyWord in that file's literal would be a
// ReferenceError. Data stays with data, functions stay with functions.
//
// This is a top-level statement, so it runs at app.js parse time — complete
// before DOMContentLoaded and long before any click can reach switchSection.
//
// Three call sites read it: switchSection(), retakeCurrentExercise() and the
// difficulty-selector handler. A section with no entry simply does not reload,
// which is deliberately how `dashboard` behaves. Adding a section means adding
// one line here.
Sections.registerRuntime({
    vocabulary: loadVocabularyWord,
    sentences: loadSentenceExercise,
    reading: loadReadingPassage,
    listening: loadListeningExercise,
    grammar: loadGrammarPoint,
    pronunciation: loadPronunciationPair,
    // Wrapped, not bare: puzzles reload whichever sub-puzzle is selected.
    puzzles: () => loadPuzzle(state.currentPuzzle)
});

// ============================================
// SECTION CONTENT REGISTRATION
// ============================================
//
// US-153. One probe per section answering "how many items are authored at this
// tier", which is what hasContentForLevel() / isLevelAvailable() /
// resolveDifficulty() now ask instead of probing `vocabularyData` for everybody.
//
// Here rather than in js/core/sections.js for two reasons. data.js and
// data/grammar.js declare `const vocabularyData` / `const grammarLessons`, which
// are LEXICAL globals — not properties of `window` — so sections.js cannot turn
// its `contentGlobal` name string into a value at all; and both files load after
// sections.js, so a value read at that file's parse time would be a TDZ
// ReferenceError anyway. Each row names its map, this block knows its shape.
//
// Every body is lazy: the map is dereferenced when a probe is CALLED, never at
// this statement's parse time, so load order below app.js cannot matter.
// `typeof` guards throughout, as data/grammar.js's header requires.
Sections.registerContent({
    vocabulary: level => contentCountAt(
        typeof vocabularyData !== 'undefined' ? vocabularyData : null, level),
    sentences: level => contentCountAt(
        typeof sentenceExercises !== 'undefined' ? sentenceExercises : null, level),
    reading: level => contentCountAt(
        typeof readingPassages !== 'undefined' ? readingPassages : null, level),
    listening: level => contentCountAt(
        typeof listeningExercises !== 'undefined' ? listeningExercises : null, level),
    // puzzleData is the one two-level map: puzzle TYPE first, level second. A
    // tier counts as playable when ANY puzzle type has something at it, because
    // that is one working puzzle rather than an empty screen — and the section
    // has no per-type level selector that could report a partly-authored tier.
    puzzles: level => {
        if (typeof puzzleData === 'undefined' || !puzzleData) return 0;
        return Object.keys(puzzleData).reduce(
            (n, type) => n + contentCountAt(puzzleData[type], level), 0);
    },
    // The map that motivated all of this: `foundation` has one point, the other
    // three tiers are authored as empty arrays on purpose.
    grammar: level => grammarLessonsFor(level).length,
    // The odd one out: PRONUNCIATION_VOWELS_STRESS.pairs is NOT keyed by level at
    // all — it is one set of contrasts authored from the Telugu-L1 interference
    // table, which is why this section has no .diff-btn group.
    //
    // Reported at DEFAULT_LEVEL only, and that is a decision rather than an
    // oversight. This probe is what exerciseLevel() consults to stamp an exercise
    // id, so answering "yes, at every tier" would give one pair four ids —
    // `pronunciation_foundation_0` … `pronunciation_fluent_0` — and let the same
    // drill be completed, ✓-ed and counted once per level button, which is
    // precisely the double-count US-152 fixed for grammar. Answering only at
    // `foundation` makes resolveDifficulty(x, 'pronunciation') step down to
    // `foundation` from anywhere, so every id is `pronunciation_foundation_N`
    // whatever tier is selected, and the pair counts once.
    //
    // It also keeps the app-wide union honest: reporting content at `fluent`
    // would mark that tier available in every OTHER section's level selector,
    // because hasContentForLevel() with no section is a union over all probes.
    pronunciation: level => (level === (typeof DEFAULT_LEVEL === 'string' ? DEFAULT_LEVEL : 'foundation'))
        ? pronunciationPairs().length
        : 0
});

/**
 * Items under `map[level]`, tolerating both shapes the content files use: an
 * array of items (every map except puzzleData's sub-maps) or a single non-empty
 * object describing one activity (puzzleData.wordSearch[level] is
 * `{ words, gridSize }`). Never throws — an availability question must not be
 * able to take a section down.
 *
 * Counting rather than mere key presence, deliberately. The old oracle asked
 * `hasOwnProperty`, which reports `grammarLessons.everyday` — an empty array,
 * present only so `grammarLessons[level]` never throws — as content. For the
 * four flat maps the two questions give the same answer today because every tier
 * they list is non-empty; counting is what also makes it right for grammar.
 */
function contentCountAt(map, level) {
    if (!map || typeof map !== 'object' || typeof level !== 'string') return 0;
    const at = map[level];
    if (Array.isArray(at)) return at.length;
    if (at && typeof at === 'object') return Object.keys(at).length > 0 ? 1 : 0;
    return 0;
}

// ============================================
// TODAY'S SESSION  (US-170 / FR-SES-1, FR-SES-5, BR-1)
// ============================================
//
// js/core/session.js plans; everything below renders. That split is the whole
// design: the planner has no DOM and this block has no policy, so "what should
// the learner do next" is answered in one place and "what does that look like"
// in another.
//
// WHAT IT RENDERS
//   #sessionPanel  the Dashboard card — Start, the plan, plan.shortfall,
//                  plan.omitted, and the FR-SES-5 wrap-up
//   #sessionBar    the chrome that follows the learner into every section —
//                  step N of M, the strand, advisory minutes, per-step controls
//
// WHAT IT DELIBERATELY DOES NOT BUILD
// No new exercise surface, not one. Every step routes into a section that
// already exists, through switchSection() and that section's registered loader,
// and the step's `count` / `items` / `target` are applied to that section's own
// state. A step whose surface does not exist is never planned — which is why
// registerSurfaces() below has to be truthful, and why plan.omitted is printed
// on the Dashboard instead of swallowed. An honest empty space is a bug report;
// a hidden one is a lie.
//
// NO TIMER, ANYWHERE. The plan is count-boxed (session.js decision 3): steps end
// when the work ends, never when a clock says so. Minutes are labelled "about",
// and the only number that moves is the step counter.

// --------------------------------------------------------------------------
// What this build can actually render  (session.js SURFACES)
// --------------------------------------------------------------------------
//
// Same loudness and the same once-only call discipline as the two
// Sections.register*() blocks above, and the same reason for living here rather
// than in the module: these answers are facts about app.js's functions and about
// content this file can dereference.
//
// The rule is that a value here must be checkable by reading the named function.
// Declaring a surface that does not render makes the planner promise a step that
// draws nothing, which is a worse failure than a short session: the learner is
// sent to a screen that cannot honour the instruction it just gave them (BR-3).
// Three surfaces are therefore declared FALSE from the render side, confirming
// from here what the module already assumed.
if (typeof Session !== 'undefined' && Session && typeof Session.registerSurfaces === 'function') {
    Session.registerSurfaces({
        // startReview() -> SRS.getDueWords() -> the vocabulary word card. Vocab
        // ONLY, and that restriction is the point of the `types` field: due
        // `gram:` and `phon:` records exist and are correctly scheduled, and no
        // screen in this build draws them, so the review step must not count
        // them. Session.countsHeldBack() reports the gap and the step carries it
        // on `step.heldBack`.
        'srs.review': {
            available: true,
            types: ['vocab'],
            note: 'Review mode (app.js startReview) walks SRS.getDueWords(), which is vocabulary only, and renders it in the vocabulary word card.'
        },

        // renderGrammarTeaching(): the rule, the "how to decide" steps and the
        // notice dialogue. Unconditional — every authored point has a `rule`.
        'grammar.teach': {
            available: true,
            note: 'renderGrammarTeaching() draws the rule, the decide steps and the notice dialogue for one point.'
        },

        // Contrast pairs are drawn by the same function, from `lesson.contrast`.
        // A predicate rather than `true`, because an authored point with no
        // contrast block would render the heading and nothing under it. Today
        // both foundation points carry three pairs each, so this resolves true —
        // it is here so that it stops resolving true if that changes.
        'grammar.contrast': function (ctx) {
            const lessons = grammarLessonsFor(resolveDifficulty(ctx && ctx.level, 'grammar'));
            const withContrast = lessons.filter(l => l && Array.isArray(l.contrast) && l.contrast.length);
            return withContrast.length
                ? { available: true, note: 'renderGrammarTeaching() draws lesson.contrast as "Same sentence, different meaning".' }
                : { available: false, note: 'No grammar point at this tier has contrast pairs authored, so the contrast block would render an empty heading.' };
        },

        // renderGrammarProduce(): a say-it-aloud task with a self-check list.
        // "I said it" and "Skip for now" both complete it and neither needs a
        // microphone (FR-SPK-9 / FR-A11Y-4). This is the only unconditional
        // spoken-production surface in the build, which is why the speak step
        // resolves to it — but only for a tier that has a point with a `produce`
        // block, because the function itself says "No speaking task is written
        // for this point yet" when there is none.
        'grammar.produce': function (ctx) {
            const lessons = grammarLessonsFor(resolveDifficulty(ctx && ctx.level, 'grammar'));
            const withProduce = lessons.filter(l => l && l.produce);
            return withProduce.length
                ? {
                    available: true,
                    note: 'renderGrammarProduce() draws a "say it aloud" task with a self-check; both buttons complete it and neither needs a microphone (FR-SPK-9 / FR-A11Y-4).'
                }
                : {
                    available: false,
                    note: 'No grammar point at this tier has a speaking task authored, so renderGrammarProduce() would only say so.'
                };
        },

        // renderPronunciationDrill(). Not gated on speech synthesis: a device
        // that cannot speak starts in the written exercise instead (AS-3), which
        // is gradable and honest about what it does not measure — so the surface
        // exists either way.
        'pron.discriminate': {
            available: true,
            note: 'renderPronunciationDrill() draws the minimal-pair drill, falling back to the written exercise on a device with no speech synthesis (AS-3).'
        },

        // FR-PRN-6, and the predicate the module asked app.js for: production is
        // gated PER PAIR at the accuracy the content declares, and pronGate() is
        // the only thing that can evaluate it because it reads per-pair attempt
        // history. Available when at least one pair is open, because one open
        // pair is one renderable step; the route below then picks that pair.
        // A learner who has never done the drill has no pair open, so this is
        // false for a first session and the speak step falls back to
        // grammar.produce — which is the honest ordering, not a degradation.
        'pron.produce': function () {
            const open = pronunciationPairs().filter(pair => pronGate(pair).open);
            if (open.length) {
                return {
                    available: true,
                    requirement: 'FR-PRN-6',
                    note: open.length + ' sound pair(s) have passed the FR-PRN-6 discrimination gate, so renderPronunciationProduce() draws the self-comparison task rather than the locked card.'
                };
            }
            return {
                available: false,
                requirement: 'FR-PRN-6',
                note: 'No sound pair has passed its FR-PRN-6 discrimination gate yet, so renderPronunciationProduce() would draw the locked card. Hearing the contrast comes first.'
            };
        },

        // loadListeningExercise() puts the sentence on screen and hands it to
        // #playListening, which speaks it through speechAPI. A predicate on
        // feature detection, not `true`: this section has no written fallback, so
        // on a device with no speech synthesis the step would be "listen to the
        // model" with nothing to listen to.
        'listen.model': function () {
            return pronAudioUsable()
                ? { available: true, note: 'loadListeningExercise() shows the sentence and #playListening speaks it through the Web Speech API.' }
                : { available: false, note: 'This device has no speech synthesis, so there is no model sentence to hear and the listening section has no written fallback.' };
        },

        // The three the module named as unbuilt, confirmed from the render side.
        // Declared rather than left to the defaults so that this map is the
        // complete answer to "what can app.js draw", and so a future commit that
        // builds one of them has an obvious line to change.
        'listen.comprehend': {
            available: false,
            requirement: 'FR-LSN-1',
            note: 'No function in app.js renders a listening comprehension question; the listening section is listen-and-repeat plus read-aloud only.'
        },
        'speak.shadow': {
            available: false,
            requirement: 'FR-SPK-8',
            note: 'No function in app.js renders a shadowing mode.'
        },
        'speak.free': {
            available: false,
            requirement: 'FR-SPK-3',
            note: 'No function in app.js renders a free-production prompt with a timer, a recording and a rubric.'
        },

        // updateDashboard() / updateStatisticsDisplay() already draw the streak
        // and the lifetime totals, and the wrap-up card below reads them. The
        // fluency trend (FR-SPK-5) does not exist, which wrapUp().needsFromApp
        // names and the card reports rather than fakes.
        'session.summary': {
            available: true,
            note: 'The dashboard has the streak and the lifetime totals; the wrap-up card reads them. The fluency trend (FR-SPK-5) does not exist and is reported as missing rather than invented.'
        }
    });
}

/** Session storage keys are normalised the same way srs.js normalises them. */
function sessionRef(value) {
    if (typeof Migrations !== 'undefined' && Migrations && typeof Migrations.srsRef === 'function') {
        return Migrations.srsRef(value);
    }
    return String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g, '-');
}

/** A `<p>`/`<li>`-style element with plain text. Local, so nothing here depends
 *  on the grammar section's markup helpers. */
function sessionEl(tag, text, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
}

/** Lowercase a leading capital so a reason can be spliced after "because".
 *  Left alone when the first word is an identifier or a requirement code —
 *  "FR-PRN-6" and "app.js" must not be mangled to make a sentence read nicely. */
function sessionBecause(reason) {
    const text = String(reason == null ? '' : reason).trim();
    if (!/^[A-Z][a-z]/.test(text)) return text;
    return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Move focus, without assuming a DOM that implements focus().
 *
 * Focus and scrolling are separated deliberately. The session bar is sticky, so
 * it is already on screen and focusing it must NOT scroll — otherwise every step
 * entry would yank the page back to the top and undo sessionReveal() below, which
 * is the call that actually puts the task in front of the learner.
 */
function sessionFocus(el) {
    if (el && typeof el.focus === 'function') el.focus();
}

/** Bring a section's own content into view. Not focus: these are plain
 *  containers, and a real browser ignores focus() on a non-focusable element. */
function sessionReveal(el) {
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' });
}

/**
 * Sections whose authored items the learner has already finished today, at the
 * tier the plan is built for.
 *
 * Session.build() uses this to LABEL a step as a second pass, never to drop it —
 * so an over-count here costs a wrong note and never a missing step. Exercise
 * ids are `type_level_index` (getExerciseId), so counting the ones for this tier
 * against the section's own content probe is the same arithmetic the completion
 * indicator does.
 */
function sessionExhaustedSections(level) {
    return Sections.exercises().filter(section => {
        if (!Sections.knowsContent(section.id)) return false;
        const total = Sections.contentCount(section.id, exerciseLevel(section.id, level));
        if (total <= 0) return false;
        const done = state.completedExercises[section.id];
        if (!done || typeof done.forEach !== 'function') return false;
        const prefix = section.id + '_' + exerciseLevel(section.id, level) + '_';
        let n = 0;
        done.forEach(id => { if (String(id).indexOf(prefix) === 0) n++; });
        return n >= total;
    }).map(section => section.id);
}

/**
 * The review queue for the review step: the plan's own items, in the plan's
 * order, capped by the plan's count.
 *
 * Reading step.items rather than just trimming is what makes a RESUMED session
 * show the same cards it showed before the phone rang. Items that are no longer
 * in the live queue (already reviewed) simply drop out; if none survive, the
 * live queue is used, because the honest fallback is "here is what is due now",
 * not an empty screen.
 */
function sessionReviewQueue(step, queue) {
    const cap = (typeof step.count === 'number' && step.count > 0) ? step.count : queue.length;
    const items = Array.isArray(step.items) ? step.items : [];
    if (!items.length) return queue.slice(0, cap);

    // Object.create(null): the keys here are normalised WORDS, and a learner
    // reviewing "constructor" or "toString" must not match an inherited property.
    const byRef = Object.create(null);
    queue.forEach(word => { byRef[sessionRef(word && word.word)] = word; });
    const ordered = [];
    items.forEach(item => {
        const word = byRef[sessionRef(item && item.ref)];
        if (word && ordered.indexOf(word) === -1) ordered.push(word);
    });
    return (ordered.length ? ordered : queue).slice(0, cap);
}

/**
 * Open the grammar section on the point this step is about.
 *
 * `which` is 'produce' for the speaking step, which needs a point that HAS a
 * speaking task — otherwise the step would land on renderGrammarProduce()'s "no
 * speaking task is written for this point yet", i.e. a production step with
 * nothing to produce. Without a target and outside the speaking step the
 * learner's own position is left alone: moving it would silently lose their place.
 */
function sessionOpenGrammar(step, which) {
    const level = resolveDifficulty(state.currentDifficulty, 'grammar');
    const lessons = grammarLessonsFor(level);
    if (!lessons.length) return 'The grammar content is not loaded on this device.';

    let index = -1;
    // step.target.ref is the mistake log's drill target, which is a data/grammar.js
    // lesson id ('articles', 'countable-uncountable'). A target that names a point
    // this tier does not have is ignored rather than forced.
    const ref = step.target && step.target.ref;
    if (ref) {
        lessons.forEach((lesson, i) => { if (index === -1 && lesson && lesson.id === ref) index = i; });
    }
    if (which === 'produce' && (index === -1 || !lessons[index] || !lessons[index].produce)) {
        index = -1;
        lessons.forEach((lesson, i) => { if (index === -1 && lesson && lesson.produce) index = i; });
    }
    if (index !== -1) state.currentGrammarIndex = index;

    switchSection('grammar');
    const shown = lessons[Math.min(Math.max(0, state.currentGrammarIndex || 0), lessons.length - 1)];
    if (which === 'produce') {
        sessionReveal(document.getElementById('grammarProduce'));
        return shown ? 'The speaking task on "' + shown.title + '".' : null;
    }
    return shown ? 'The point on screen is "' + shown.title + '".' : null;
}

/**
 * Open the pronunciation section on the pair this step is about, and honour the
 * count box by shortening the round rather than by asking the learner to stop
 * early.
 */
function sessionOpenPronunciation(step, which) {
    const pairs = pronunciationPairs();
    if (!pairs.length) return 'The pronunciation content is not loaded on this device.';

    let index = -1;
    const ref = step.target && step.target.ref;
    if (ref) {
        pairs.forEach((pair, i) => {
            if (index === -1 && pair && (pair.id === ref || pair.code === ref)) index = i;
        });
    }
    if (which === 'produce') {
        // The gate is per pair, so the step has to land on a pair that is open —
        // any other choice would show the locked card on a step the planner
        // promised as production.
        let open = -1;
        pairs.forEach((pair, i) => { if (open === -1 && pronGate(pair).open) open = i; });
        if (open !== -1) index = open;
    }
    if (index !== -1) state.currentPronunciationIndex = index;

    switchSection('pronunciation');
    const pair = pairs[Math.min(Math.max(0, state.currentPronunciationIndex || 0), pairs.length - 1)];

    if (which === 'produce') {
        sessionReveal(document.getElementById('pronunciationProduce'));
        return pair ? 'The speaking task on ' + (pair.label || pair.id) + '.' : null;
    }

    // Count box: the drill walks pronunciationSession.items one screen at a time
    // and ends on "Finish this pair", so trimming the list is exactly a shorter
    // round. Re-rendered because the loader has already drawn the full one.
    if (pronunciationSession && typeof step.count === 'number' && step.count > 0 &&
        pronunciationSession.items.length > step.count) {
        pronunciationSession.items = pronunciationSession.items.slice(0, step.count);
        renderPronunciationDrill(pair);
    }
    return pair ? 'The pair on screen is ' + (pair.label || pair.id) + '.' : null;
}

/**
 * surface -> how to open it. Keyed by SURFACE and not by step id, deliberately:
 * the speak step resolves to whichever production surface was available at build
 * time, so the router has to follow the plan's answer rather than restate it.
 *
 * Each handler returns a short line about what it put on screen, or null.
 */
const SESSION_ROUTES = {
    'srs.review': function (step) {
        switchSection('vocabulary');
        startReview();
        if (!state.reviewMode) {
            // Between building the plan and opening the step the queue emptied
            // (another tab, a review done first). Say so; the step still completes.
            return 'Nothing is due any more, so there is nothing to review. Press Done and carry on.';
        }
        state.reviewQueue = sessionReviewQueue(step, state.reviewQueue);
        loadReviewWord();
        return state.reviewQueue.length + ' card(s) from your review queue, oldest first.';
    },
    'grammar.teach': function (step) { return sessionOpenGrammar(step, 'teach'); },
    'grammar.contrast': function (step) { return sessionOpenGrammar(step, 'teach'); },
    'grammar.produce': function (step) { return sessionOpenGrammar(step, 'produce'); },
    'pron.discriminate': function (step) { return sessionOpenPronunciation(step, 'discriminate'); },
    'pron.produce': function (step) { return sessionOpenPronunciation(step, 'produce'); },
    'listen.model': function (step) {
        switchSection('listening');
        // No count is applied to the section here, and that is a limit rather
        // than an omission: the listening section is walked one sentence at a
        // time with Previous/Next and has no multi-item runner to shorten. The
        // count is therefore reported as the advisory size it is, which is what
        // a count box means in session.js anyway.
        return (typeof step.count === 'number' && step.count > 0)
            ? 'About ' + step.count + ' sentence(s): play each one, then say it back. Use Next → to move through them.'
            : 'Play the sentence, then say it back.';
    },
    'session.summary': function () {
        switchSection('dashboard');
        SessionUI.renderWrapUp();
        return 'Your session summary is on the Dashboard below.';
    }
};

/**
 * The session UI.
 *
 * Holds no plan state of its own — every render reads Session.plan() /
 * Session.progress() — so a reload, a resumed session and a fresh build all go
 * through exactly the same code, and there is no second copy of "where am I" to
 * disagree with the module's.
 */
const SessionUI = {
    /** Wire the Dashboard controls and paint whatever state we are already in. */
    init() {
        if (typeof Session === 'undefined' || !Session) return;

        const start = document.getElementById('startSession');
        if (start) start.addEventListener('click', () => SessionUI.start(false));
        const restart = document.getElementById('restartSession');
        if (restart) restart.addEventListener('click', () => SessionUI.start(true));

        // An unfinished plan from earlier today. Rendered WITHOUT calling build():
        // BR-1 buys its predictability from the learner pressing one button, and
        // building a plan nobody asked for would also move the review queue.
        const plan = Session.plan();
        if (plan) {
            const progress = Session.progress();
            SessionUI.renderPlan(plan, progress);
            SessionUI.renderShortfall(plan);
            SessionUI.renderOmitted(plan);
            if (progress && progress.complete) {
                SessionUI.renderWrapUp();
                if (start) start.textContent = '▶️ Today\'s session is finished';
                if (start) start.disabled = true;
                if (restart) restart.hidden = false;
            } else if (progress) {
                SessionUI.renderResume(plan, progress);
                if (start) {
                    start.textContent = '▶️ Continue today\'s session (step ' +
                        (progress.index + 1) + ' of ' + progress.total + ')';
                }
                if (restart) restart.hidden = false;
            }
        }
    },

    /**
     * Build (or resume) today's plan and walk into the current step.
     *
     * The learner chooses nothing here except "start" and, for P2, "I cannot
     * speak aloud right now" — which changes the speaking step's default route
     * and its wording, and never removes it (session.js decision 2).
     */
    start(fresh) {
        if (typeof Session === 'undefined' || !Session) return;

        const silentEl = document.getElementById('sessionSilent');
        const level = resolveDifficulty(state.currentDifficulty);
        const plan = Session.build({
            level: level,
            silent: !!(silentEl && silentEl.checked),
            exhausted: sessionExhaustedSections(level),
            fresh: !!fresh
        });
        if (!plan) return;

        const progress = Session.progress();
        SessionUI.renderPlan(plan, progress);
        SessionUI.renderShortfall(plan);
        SessionUI.renderOmitted(plan);
        // Requirement 6: the banner is driven by build()'s own answer, not by a
        // guess from the index.
        if (plan.resumed) SessionUI.renderResume(plan, progress);
        else SessionUI.clear('sessionResume');

        const restart = document.getElementById('restartSession');
        if (restart) restart.hidden = false;
        const wrapUp = document.getElementById('sessionWrapUp');
        if (wrapUp && !(progress && progress.complete)) wrapUp.textContent = '';

        if (plan.empty) {
            // Nothing could be planned at all. plan.shortfall says why, and it is
            // already on screen; do not open a session with no steps in it.
            Toast.info('There is no session to run today — the card on the Dashboard says why.');
            return;
        }
        SessionUI.enter(Session.current());
    },

    /** Open one step: chrome, then route into the section that renders it. */
    enter(step) {
        if (!step) { SessionUI.finish(); return; }

        // Review mode is a mode on the vocabulary section, not a step, so it has
        // to be left behind when the session moves on — otherwise the learner
        // arrives back at Vocabulary later with the nav buttons hidden.
        if (state.reviewMode && step.id !== 'review') exitReview();

        const bar = document.getElementById('sessionBar');
        if (bar) bar.hidden = false;

        const progress = Session.progress();
        const strands = (step.strands || []).map(Session.strandLabel).join(' + ');

        const meta = document.getElementById('sessionStep');
        if (meta) {
            meta.textContent = [
                'Step ' + (progress.index + 1) + ' of ' + progress.total,
                strands || null,
                // Advisory, and said so. Nothing counts down and nothing expires.
                'about ' + progress.remainingMinutes + ' min of work left'
            ].filter(Boolean).join(' · ');
        }

        const instruction = document.getElementById('sessionInstruction');
        if (instruction) {
            instruction.textContent = step.title +
                (typeof step.count === 'number' && step.count > 0 ? ' — ' + step.count + ' item(s)' : '');
        }

        // Route by surface. The first part with a handler wins: the grammar step's
        // teach and contrast parts are two halves of one screen, so opening it
        // once is opening both.
        let routed = null;
        (step.parts || []).forEach(part => {
            if (routed !== null) return;
            const route = SESSION_ROUTES[part.surface];
            if (route) routed = route(step) || '';
        });

        SessionUI.renderStepNote(step, routed, progress);
        SessionUI.renderControls(step);
        // Focus the bar rather than its first button: a learner tabbing from here
        // reaches the controls, and Enter cannot complete a step they have not
        // started yet. Focus only — the bar is sticky, and scrolling to it would
        // undo the sessionReveal() the route above just did.
        sessionFocus(bar);
    },

    /** Everything true about this step that is not the instruction itself. */
    renderStepNote(step, routed, progress) {
        const host = document.getElementById('sessionStepNote');
        if (!host) return;
        host.textContent = '';

        if (routed) host.appendChild(sessionEl('p', routed, 'session-routed'));

        // Why this step is here at all. §4's reasoning, in the module's words.
        if (step.rationale) host.appendChild(sessionEl('p', step.rationale, 'session-rationale'));

        if (step.target) {
            host.appendChild(sessionEl('p',
                'Aimed at your most frequent recent error: ' + step.target.label + '.',
                'session-target'));
        }

        // Parts of THIS step that dropped out, and the second-pass label. Both
        // come from the planner as prose; printing them is the point.
        (step.reduced || []).forEach(reason => {
            host.appendChild(sessionEl('p', 'Not included in this step: ' + reason, 'session-reduced'));
        });

        // Due items the review screen cannot draw. Named here because "nothing to
        // review" would otherwise be false for a learner with due grammar points.
        (step.heldBack || []).forEach(held => {
            host.appendChild(sessionEl('p', held.reason, 'session-heldback'));
        });

        if (step.speaking) {
            host.appendChild(sessionEl('p',
                'Nothing is recorded and no microphone is used. Saying it silently counts — composing the sentence is the part that transfers.',
                'session-speaking-note'));
        }

        if (progress && progress.total && !step.isTask) {
            host.appendChild(sessionEl('p',
                'This last step is the app reporting back, not another task.',
                'session-rationale'));
        }
    },

    /**
     * The per-step controls.
     *
     * Two shapes only. A speaking step offers the three-way choice — "I said it"
     * / "I did it silently" / "Skip" — and all three complete the step, because
     * FR-A11Y-4's floor is that a learner gets from start to finish without
     * speaking or granting mic access, and BR-2 is about production rather than
     * about audibility. Neither speaking route is styled as the lesser one.
     * Everything else is Done / Skip.
     */
    renderControls(step) {
        const host = document.getElementById('sessionControls');
        if (!host) return;
        host.textContent = '';

        const button = (label, className, onClick, ariaLabel) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = className;
            btn.textContent = label;
            if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
            btn.addEventListener('click', onClick);
            host.appendChild(btn);
            return btn;
        };

        if (step.speaking) {
            // In silent mode the module's own default for this step is 'silent',
            // so the silent route leads. Same class either way and the same
            // one-press cost: one of these is not a downgrade of the other, and
            // ordering is the only thing that changes.
            const aloud = ['🗣️ I said it', 'btn-primary', () => SessionUI.advance('aloud'),
                'I said it aloud'];
            const silent = ['🤫 I did it silently', 'btn-primary', () => SessionUI.advance('silent'),
                'I did it silently, without speaking aloud'];
            const order = step.defaultOutcome === 'silent' ? [silent, aloud] : [aloud, silent];
            order.forEach(args => button(args[0], args[1], args[2], args[3]));
            button('↷ Skip this', 'btn-secondary',
                () => SessionUI.advance('skipped'), 'Skip this step');
        } else if (step.isTask) {
            button('✓ Done', 'btn-primary', () => SessionUI.advance('done'), 'Mark this step done');
            button('↷ Skip this', 'btn-secondary', () => SessionUI.advance('skipped'), 'Skip this step');
        } else {
            button('✓ Finish', 'btn-primary', () => SessionUI.advance('done'), 'Finish today\'s session');
        }

        // Never a trap: leaving keeps the position, which is what resume is for.
        button('⏸ Pause for now', 'btn-secondary', () => SessionUI.pause(),
            'Pause today\'s session and come back to this step later');
    },

    /** Record an outcome through the module's own routes and open what is next. */
    advance(outcome) {
        if (typeof Session === 'undefined' || !Session) return;
        const next = outcome === 'silent' ? Session.markSilent()
            : outcome === 'skipped' ? Session.skip()
                : Session.advance(outcome);
        SessionUI.enter(next);
    },

    /** Hide the chrome, keep the plan. */
    pause() {
        if (state.reviewMode) exitReview();
        const bar = document.getElementById('sessionBar');
        if (bar) bar.hidden = true;
        const plan = Session.plan();
        const progress = Session.progress();
        if (plan && progress) {
            SessionUI.renderPlan(plan, progress);
            SessionUI.renderResume(plan, progress);
            const start = document.getElementById('startSession');
            if (start) {
                start.textContent = '▶️ Continue today\'s session (step ' +
                    (progress.index + 1) + ' of ' + progress.total + ')';
            }
        }
        switchSection('dashboard');
        sessionFocus(document.getElementById('startSession'));
    },

    /** The session ran out of steps: close the chrome and show the wrap-up. */
    finish() {
        if (state.reviewMode) exitReview();
        const bar = document.getElementById('sessionBar');
        if (bar) bar.hidden = true;
        switchSection('dashboard');

        const plan = Session.plan();
        const progress = Session.progress();
        if (plan && progress) SessionUI.renderPlan(plan, progress);
        SessionUI.clear('sessionResume');
        SessionUI.renderWrapUp();

        const start = document.getElementById('startSession');
        if (start) {
            start.textContent = '▶️ Today\'s session is finished';
            start.disabled = true;
        }
        const restart = document.getElementById('restartSession');
        if (restart) restart.hidden = false;
        sessionReveal(document.getElementById('sessionWrapUp'));
    },

    clear(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = '';
        if (id === 'sessionResume') el.hidden = true;
    },

    /** FR-SES-1's own verdict, the shape of the plan, and where the learner is. */
    renderPlan(plan, progress) {
        const host = document.getElementById('sessionPlan');
        if (!host) return;
        host.textContent = '';
        if (!plan) return;

        const heading = sessionEl('h4', 'Today\'s plan');
        host.appendChild(heading);

        // Size, not duration: "about" everywhere, because the minutes are
        // advisory and the counts are what is actually promised.
        host.appendChild(sessionEl('p',
            plan.taskCount + ' thing(s) to do, about ' + plan.minutes + ' minutes, across ' +
            (plan.strandLabels.join(', ') || 'no strand') + '.',
            'session-plan-summary'));

        const list = document.createElement('ol');
        list.className = 'session-steps';
        plan.steps.forEach((step, i) => {
            const li = document.createElement('li');
            li.className = 'session-step-' + (step.status || 'pending');
            const mark = step.status === 'done' ? '✓ ' : step.status === 'skipped' ? '↷ ' : '';
            const here = progress && !progress.complete && progress.index === i ? ' — you are here' : '';
            const count = (typeof step.count === 'number' && step.count > 0) ? ' (' + step.count + ')' : '';
            li.textContent = mark + step.title + count +
                ' · about ' + step.minutes + ' min' + here;
            list.appendChild(li);
        });
        host.appendChild(list);

        if (plan.production && plan.production.planned) {
            host.appendChild(sessionEl('p',
                'It ends with you saying something of your own. You can do that aloud or silently — neither needs a microphone.',
                'session-plan-production'));
        }

        (plan.notes || []).forEach(note => {
            host.appendChild(sessionEl('p', note, 'session-plan-note'));
        });
    },

    /**
     * plan.shortfall.
     *
     * Rendered whenever it is non-empty, not only when meetsFrSes1 is false: a
     * plan that is four minutes short of its budget is still not the session the
     * learner was promised, and presenting a short plan as a full one is the
     * overstatement BR-3 forbids. The heading is what changes.
     */
    renderShortfall(plan) {
        const host = document.getElementById('sessionShortfall');
        if (!host) return;
        host.textContent = '';
        if (!plan || !plan.shortfall || !plan.shortfall.length) return;

        host.appendChild(sessionEl('h4', plan.meetsFrSes1
            ? 'This is a shorter session than 20 minutes'
            : 'This is not the full session yet'));
        host.appendChild(sessionEl('p', plan.meetsFrSes1
            ? 'It still covers three strands and still ends with you speaking. What it does not do:'
            : 'What today\'s session cannot give you, in the app\'s own words:',
        'session-shortfall-intro'));

        const list = document.createElement('ul');
        list.className = 'session-shortfall-list';
        plan.shortfall.forEach(line => list.appendChild(sessionEl('li', line)));
        host.appendChild(list);
    },

    /**
     * plan.omitted.
     *
     * The module reports what it could not include and why, and hiding that
     * would undo the honesty it was built for: a learner who is never told the
     * listening comprehension question does not exist reads its absence as their
     * own progress. So every entry is printed, with its reason, and with the
     * requirement code where the planner has one.
     */
    renderOmitted(plan) {
        const host = document.getElementById('sessionOmitted');
        if (!host) return;
        host.textContent = '';
        if (!plan || !plan.omitted || !plan.omitted.length) return;

        host.appendChild(sessionEl('h4', 'Not in today\'s session'));
        host.appendChild(sessionEl('p',
            'The 20-minute shape this app is built against has parts it cannot give you yet. They are listed rather than left out quietly, so that an empty space is never mistaken for finished work.',
            'session-omitted-intro'));

        const list = document.createElement('ul');
        list.className = 'session-omitted-list';
        plan.omitted.forEach(entry => {
            const li = document.createElement('li');
            const what = document.createElement('strong');
            what.textContent = entry.title;
            li.appendChild(what);
            li.appendChild(document.createTextNode(
                ' — not in today\'s session because ' + sessionBecause(entry.reason)));
            if (entry.requirement) {
                li.appendChild(document.createTextNode(' (' + entry.requirement + ' is not built.)'));
            }
            list.appendChild(li);
        });
        host.appendChild(list);
    },

    /** Requirement 6: build() resumed today's plan rather than making a new one. */
    renderResume(plan, progress) {
        const host = document.getElementById('sessionResume');
        if (!host) return;
        host.textContent = '';
        if (!plan || !progress || progress.complete) { host.hidden = true; return; }
        host.hidden = false;
        host.appendChild(sessionEl('p',
            '↩ Picking up where you stopped: step ' + (progress.index + 1) + ' of ' +
            progress.total + ', "' + plan.steps[Math.min(progress.index, plan.steps.length - 1)].title +
            '". Nothing you finished earlier today needs doing again.',
            'session-resume-line'));
    },

    /**
     * The 1-minute close (FR-SES-5), merged with the two facts the module says it
     * cannot supply.
     *
     * wrapUp().needsFromApp names three: `streak`, `fluencyTrend` and
     * `tomorrowPreview`. The streak is in state.overallStats. Tomorrow's preview
     * is assembled below from what is already true. The fluency trend does not
     * exist anywhere in this build, so it is reported as missing — a wrap-up that
     * invented a trend line would be the exact overstatement BR-3 forbids, and
     * TEACHING_METHODOLOGY.md §5 rules out a streak that flatters.
     *
     * `wrapUp().elapsedMs` is deliberately NOT shown. It is wall clock between
     * the first step and the last, and session.js's own decision 3 says wall
     * clock is not time-on-task for a learner on a commute; printing it as
     * "you practised for 43 minutes" would be a measurement the app does not have.
     */
    renderWrapUp() {
        const host = document.getElementById('sessionWrapUp');
        if (!host) return;
        host.textContent = '';
        if (typeof Session === 'undefined' || !Session) return;
        const wrap = Session.wrapUp();
        if (!wrap) return;

        host.appendChild(sessionEl('h4', wrap.complete
            ? '🎯 That is today\'s session'
            : '🎯 Where you are'));

        // What was done, step by step, including what was skipped. A wrap-up that
        // only lists successes teaches nothing (§5 Tone).
        const list = document.createElement('ul');
        list.className = 'session-wrapup-steps';
        wrap.steps.forEach(step => {
            const mark = step.status === 'done' ? '✓ ' : step.status === 'skipped' ? '↷ ' : '· ';
            const tail = step.outcome === 'silent' ? ' (silently)'
                : step.outcome === 'aloud' ? ' (aloud)'
                    : step.status === 'skipped' ? ' (skipped)'
                        : step.status === 'pending' ? ' (not reached)' : '';
            list.appendChild(sessionEl('li', mark + step.title + tail));
        });
        host.appendChild(list);

        host.appendChild(sessionEl('p',
            'Strands you worked in: ' + (wrap.strandsCovered.join(', ') || 'none yet') +
            '. Planned: ' + (wrap.strandsPlanned.join(', ') || 'none') + '.',
            'session-wrapup-strands'));

        // BR-2 / metric M-1, reported as the route it was rather than as a claim
        // about speech the app never heard.
        const production = wrap.production;
        if (production && production.planned) {
            const line = production.route === 'aloud'
                ? 'You said your own sentence out loud. That is the part that transfers to a real conversation — nothing recorded it, and nothing scored it.'
                : production.route === 'silent'
                    ? 'You composed your own sentence without voicing it. That counts as production: you built the language, which is the part that transfers.'
                    : production.route === 'skipped'
                        ? 'You skipped the speaking task, so this session produced no English of your own. That is recorded as it happened, and it costs you nothing — the task will be there tomorrow.'
                        : 'The speaking task is still ahead of you.';
            host.appendChild(sessionEl('p', line, 'session-wrapup-production'));
        } else if (production) {
            host.appendChild(sessionEl('p', production.note, 'session-wrapup-production'));
        }

        // --- the three things the module named as app.js's to supply ---

        host.appendChild(sessionEl('p',
            'Streak: ' + (state.overallStats.currentStreak || 0) + ' day(s), best ' +
            (state.overallStats.bestStreak || 0) + '. It counts days you completed an exercise, not days you opened the app.',
            'session-wrapup-streak'));

        host.appendChild(sessionEl('p',
            'Fluency trend: not measured. Nothing in this version times or scores your speaking (FR-SPK-5), so there is no trend to show — and a made-up one would tell you nothing.',
            'session-wrapup-trend'));

        host.appendChild(sessionEl('p', 'Tomorrow: ' + SessionUI.tomorrowPreview(),
            'session-wrapup-tomorrow'));

        if (wrap.previousSession) {
            host.appendChild(sessionEl('p',
                'Your previous session (' + wrap.previousSession.date + '): ' +
                wrap.previousSession.done + ' of ' + wrap.previousSession.steps +
                ' steps done, ' + wrap.previousSession.skipped + ' skipped.',
                'session-wrapup-previous'));
        }

        if ((wrap.omitted || []).length || (wrap.shortfall || []).length) {
            host.appendChild(sessionEl('p',
                'What today\'s session could not include is listed above, with the reason for each.',
                'session-wrapup-pointer'));
        }
    },

    /**
     * FR-SES-5's "tomorrow's preview", built only from facts already on this
     * device. No forecast: srs.js can say what is due NOW and what is waiting
     * behind today's cap, and an item behind the cap is already overdue, so
     * "at least" is the strongest claim available.
     */
    tomorrowPreview() {
        const parts = [];
        if (window.SRS && typeof SRS.deferredCount === 'function') {
            const waiting = SRS.deferredCount('vocab') || 0;
            if (waiting > 0) {
                parts.push('at least ' + waiting + ' review card(s) already waiting behind today\'s cap');
            }
        }
        const level = resolveDifficulty(state.currentDifficulty, 'grammar');
        const lessons = grammarLessonsFor(level);
        const next = lessons[(state.currentGrammarIndex || 0) + 1];
        if (next) parts.push('the next grammar point, "' + next.title + '"');
        else if (lessons.length) parts.push('the grammar points you have already met, coming back for review');
        if (!parts.length) return 'the same shape again — review first, then a grammar point, then speaking.';
        return parts.join(', ') + '.';
    }
};



// ============================================
// KEYBOARD NAVIGATION SYSTEM
// ============================================

const KeyboardNavigation = {
    // Keyboard shortcuts map
    shortcuts: {
        'ArrowLeft': 'navigate-prev',
        'ArrowRight': 'navigate-next',
        'Escape': 'close-toast',
        'Tab': 'focus-trap',
        'Enter': 'activate',
        'Space': 'activate'
    },

    // Initialize keyboard navigation
    init() {
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        this.setupFocusTrap();
        this.setupSkipLink();
    },

    // Handle keydown events
    handleKeydown(event) {
        const { key, ctrlKey, altKey, shiftKey } = event;

        // Global keyboard shortcuts
        if (ctrlKey || altKey) {
            this.handleGlobalShortcuts(event);
            return;
        }

        // Context-specific shortcuts
        const activeSection = state.currentSection;
        switch (key) {
            case 'ArrowLeft':
                if (!this.isInputFocused()) {
                    event.preventDefault();
                    this.navigatePrevious(activeSection);
                }
                break;
            case 'ArrowRight':
                if (!this.isInputFocused()) {
                    event.preventDefault();
                    this.navigateNext(activeSection);
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.handleEscape();
                break;
        }
    },

    // Handle global keyboard shortcuts (Ctrl/Alt combinations)
    handleGlobalShortcuts(event) {
        const { key, ctrlKey, altKey } = event;

        // Alt + number for section navigation.
        //
        // The ceiling comes from the registry so a new section is reachable by
        // keyboard the moment it exists. NOTE: this is a single-CHARACTER
        // comparison, so it caps out at nine sections — '10' never arrives as one
        // `key` anyway. Past nine, this handler needs reworking, not widening.
        const sections = Sections.ids();
        if (altKey && key >= '1' && key <= String(sections.length)) {
            event.preventDefault();
            const index = parseInt(key) - 1;
            if (sections[index]) {
                switchSection(sections[index]);
                Toast.info(`Switched to ${sections[index]}`);
            }
        }

        // Ctrl+S for save progress
        if (ctrlKey && key === 's') {
            event.preventDefault();
            saveProgress();
            Toast.success('Progress saved');
        }
    },

    // Navigate to previous item in current section
    navigatePrevious(section) {
        this.clickNavButton((Sections.get(section) || {}).prevBtnId);
    },

    // Navigate to next item in current section
    navigateNext(section) {
        this.clickNavButton((Sections.get(section) || {}).nextBtnId);
    },

    /**
     * Click a prev/next button if it exists and is enabled.
     *
     * A null id (dashboard, puzzles — neither is walked item by item) is a no-op,
     * which is how the old prev/next maps behaved by not listing those sections.
     */
    clickNavButton(btnId) {
        if (!btnId) return;
        const btn = document.getElementById(btnId);
        if (btn && !btn.disabled) {
            btn.click();
        }
    },

    // Handle Escape key
    handleEscape() {
        // Close toasts
        if (Toast.activeToasts.length > 0) {
            Toast.clearAll();
            return;
        }

        // Hide loading indicator if showing
        if (LoadingIndicator.isLoading()) {
            LoadingIndicator.activeOperations.clear();
            LoadingIndicator.hide();
            return;
        }

        // Return to dashboard
        if (state.currentSection !== 'dashboard') {
            switchSection('dashboard');
        }
    },

    // Check if input element is focused
    isInputFocused() {
        const activeEl = document.activeElement;
        return activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable
        );
    },

    // Setup focus trap for modal-like elements
    setupFocusTrap() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                const loadingOverlay = document.getElementById('loadingOverlay');
                if (loadingOverlay && loadingOverlay.classList.contains('loading-show')) {
                    event.preventDefault();
                    return false;
                }
            }
        });
    },

    // Setup skip to main content link
    setupSkipLink() {
        const skipLink = document.createElement('a');
        skipLink.href = '#dashboard';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'Skip to main content';
        skipLink.setAttribute('tabindex', '1');
        skipLink.addEventListener('click', (e) => {
            e.preventDefault();
            const mainContent = document.getElementById('dashboard');
            if (mainContent) {
                mainContent.focus();
                mainContent.scrollIntoView();
            }
        });
        document.body.insertBefore(skipLink, document.body.firstChild);
    },

    // Manage focus for navigation
    manageFocus(element) {
        if (element) {
            element.focus();
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    // Add visible focus indicators
    addFocusIndicators() {
        const style = document.createElement('style');
        style.textContent = `
            *:focus {
                outline: 2px solid #4CAF50 !important;
                outline-offset: 2px !important;
            }

            *:focus:not(:focus-visible) {
                outline: none;
            }

            *:focus-visible {
                outline: 2px solid #4CAF50 !important;
                outline-offset: 2px !important;
            }

            .skip-link {
                position: absolute;
                top: -40px;
                left: 0;
                background: #4CAF50;
                color: white;
                padding: 8px 16px;
                text-decoration: none;
                z-index: 10000;
                border-radius: 0 0 4px 0;
            }

            .skip-link:focus {
                top: 0;
            }
        `;
        document.head.appendChild(style);
    }
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    // Explicit SRS bootstrap. srs.js also loads at parse time, but only init()
    // guarantees the legacy-key migration has run: at parse time it depends on
    // migrations.js having been loaded first, which is a <script> ordering
    // assumption that breaks silently. Idempotent, so calling both is safe.
    if (window.SRS && typeof SRS.init === 'function') SRS.init();
    initializeNavigation();
    initializeDifficultySelectors();
    initializeVocabularyButtons();
    initializeSentenceButtons();
    initializeSentenceBuilderDragDrop();
    initializeReadingButtons();
    initializeListeningButtons();
    initializeGrammarButtons();
    initializePronunciationButtons();
    initializePuzzleSelector();
    initializeWordSearchButton();
    initializeCrosswordButtons();
    initializeScrambleButtons();
    initializeMatchingButtons();
    // Export / restore / clear-review-history controls on the Dashboard.
    // Owned by js/core/portability.js so its copy and its behaviour stay together.
    if (typeof Portability !== 'undefined' && Portability && typeof Portability.initUI === 'function') {
        Portability.initUI();
    }
    updateDashboard();

    // "Start today's session" (US-170 / FR-SES-1). After updateDashboard(),
    // because the wrap-up card reads the streak that call has just painted, and
    // after Portability.initUI() so the Dashboard's own controls are wired first.
    SessionUI.init();

    // Initialize robustness improvements
    KeyboardNavigation.init();
    KeyboardNavigation.addFocusIndicators();

    window.addEventListener('online', () => {
        CONFIG.offlineMode = false;
        Toast.success('You are back online!');
        console.log('✅ Online: API enabled');
    });
    window.addEventListener('offline', () => {
        CONFIG.offlineMode = true;
        Toast.warning('You are offline. Using local data.');
        console.log('⚠️ Offline: Using local data');
    });

    setInterval(saveProgress, 30000);
    console.log('🎓 English Learning Portal Ready!');
    console.log('📡 API: Free Dictionary + Web Speech');
    console.log('💾 Offline Fallback: Enabled');
    console.log('⌨️ Keyboard Navigation: Enabled');

    // Register Service Worker for offline functionality and caching
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then((registration) => {
                    console.log('✅ Service Worker registered:', registration.scope);

                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60000); // Check every minute

                    // Listen for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker available
                                if (window.Toast) {
                                    Toast.info('New version available! Refresh to update.', 10000);
                                }
                            }
                        });
                    });
                })
                .catch((error) => {
                    console.warn('⚠️ Service Worker registration failed:', error);
                });
        });
    } else {
        console.log('ℹ️ Service Worker not supported in this browser');
    }
});