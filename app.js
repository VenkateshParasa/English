
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

// vocabularyData is the widest of the content maps and every other content map
// (sentenceExercises, readingPassages, listeningExercises, puzzleData.*) uses
// the same key set, so it is a fair probe for "is there content under this key".
function hasContentForLevel(key) {
    if (typeof key !== 'string' || key.length === 0) return false;
    return typeof vocabularyData !== 'undefined' && !!vocabularyData &&
           Object.prototype.hasOwnProperty.call(vocabularyData, key);
}

// The tiers that actually have content behind them, in ascending order. Derived
// from levels.js rather than hardcoded, so authoring `fluent` content is the
// only step needed to make the tier live.
function playableLevels() {
    if (typeof LEVELS === 'undefined' || !Array.isArray(LEVELS)) return [];
    return LEVELS.slice()
        .sort((a, b) => a.order - b.order)
        .map(l => l.id)
        .filter(hasContentForLevel);
}

/** True when this tier is a real level with no authored content yet. */
function isLevelAvailable(value) {
    if (typeof canonicalLevel !== 'function') return hasContentForLevel(value);
    return hasContentForLevel(canonicalLevel(value));
}

function resolveDifficulty(value) {
    // Guard for levels.js being absent (script-order mistake). Degrade to the
    // previous behaviour of trusting the value, but still never hand back a key
    // that has no content behind it.
    if (typeof canonicalLevel !== 'function') {
        return hasContentForLevel(value) ? value : 'foundation';
    }

    const canonical = canonicalLevel(value);
    if (hasContentForLevel(canonical)) return canonical;

    // No content for this tier. Step DOWN to the nearest lower tier that has
    // some — easier content the learner can still use beats an empty screen,
    // and stepping down never shows them something above the level they asked
    // for. Only if nothing lower exists do we step up.
    const playable = playableLevels();
    const wanted = (typeof LEVELS !== 'undefined' && Array.isArray(LEVELS))
        ? (LEVELS.find(l => l.id === canonical) || {}).order
        : undefined;

    if (typeof wanted === 'number' && playable.length > 0) {
        const orderOf = id => (LEVELS.find(l => l.id === id) || {}).order || 0;
        const lower = playable.filter(id => orderOf(id) < wanted);
        if (lower.length > 0) return lower[lower.length - 1];
        return playable[0];
    }

    if (hasContentForLevel(DEFAULT_LEVEL)) return DEFAULT_LEVEL;
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

// Mark exercise as complete
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

// Check if exercise is completed
function isExerciseCompleted(type, index) {
    const id = getExerciseId(type, index, state.currentDifficulty);
    return state.completedExercises[type].has(id);
}

// Retake exercise
function retakeExercise(type, index) {
    const id = getExerciseId(type, index, state.currentDifficulty);
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
            // Only vocabulary/sentences/reading carry a .diff-btn group today
            // (Sections.hasDifficulty), and those are exactly the three loaders
            // the old three `if`s called.
            Sections.loader(section)?.();
        });
    });

    syncDifficultySelectors();
}

// ============================================
// DASHBOARD
// ============================================

function updateDashboard() {
    // Overall stats
    document.getElementById('wordsLearned').textContent = state.overallStats.totalWords;
    document.getElementById('sentencesCompleted').textContent = state.overallStats.totalSentences;
    document.getElementById('readingCompleted').textContent = state.overallStats.totalReading;
    document.getElementById('puzzlesSolved').textContent = state.overallStats.totalPuzzles;
    
    // Daily goals
    Object.keys(state.dailyGoals).forEach(key => {
        const el = document.getElementById(`goal${key.charAt(0).toUpperCase() + key.slice(1)}`);
        if (el) el.checked = state.dailyGoals[key];
    });
    
    const completedGoals = Object.values(state.dailyGoals).filter(g => g).length;
    // Denominator from the registry, not a hardcoded 5: a new section with a
    // daily goal would otherwise push the bar past 100%.
    const progressPercent = (completedGoals / Sections.goalKeys().length) * 100;
    document.getElementById('overallProgress').style.width = `${progressPercent}%`;
    document.getElementById('progressPercent').textContent = `${Math.round(progressPercent)}%`;
    
    // Update statistics display
    updateStatisticsDisplay();
}

function updateStatisticsDisplay() {
    // Today's stats
    const todayEl = document.getElementById('todayStats');
    if (todayEl) {
        todayEl.innerHTML = `
            <h4>📅 Today's Progress</h4>
            <div class="stat-row">
                <span>Words:</span> <strong>${state.dailyStats.wordsLearned}</strong>
                ${getComparisonBadge(state.dailyStats.wordsLearned, state.overallStats.averageDaily.words)}
            </div>
            <div class="stat-row">
                <span>Sentences:</span> <strong>${state.dailyStats.sentencesCompleted}</strong>
                ${getComparisonBadge(state.dailyStats.sentencesCompleted, state.overallStats.averageDaily.sentences)}
            </div>
            <div class="stat-row">
                <span>Reading:</span> <strong>${state.dailyStats.readingCompleted}</strong>
                ${getComparisonBadge(state.dailyStats.readingCompleted, state.overallStats.averageDaily.reading)}
            </div>
            <div class="stat-row">
                <span>Listening:</span> <strong>${state.dailyStats.listeningCompleted}</strong>
                ${getComparisonBadge(state.dailyStats.listeningCompleted, state.overallStats.averageDaily.listening)}
            </div>
            <div class="stat-row">
                <span>Puzzles:</span> <strong>${state.dailyStats.puzzlesSolved}</strong>
                ${getComparisonBadge(state.dailyStats.puzzlesSolved, state.overallStats.averageDaily.puzzles)}
            </div>
        `;
    }
    
    // Overall stats
    const overallEl = document.getElementById('overallStats');
    if (overallEl) {
        overallEl.innerHTML = `
            <h4>📊 Overall Statistics</h4>
            <div class="stat-row">
                <span>Total Days:</span> <strong>${state.overallStats.totalDays}</strong>
            </div>
            <div class="stat-row">
                <span>Current Streak:</span> <strong>${state.overallStats.currentStreak} days 🔥</strong>
            </div>
            <div class="stat-row">
                <span>Best Streak:</span> <strong>${state.overallStats.bestStreak} days 🏆</strong>
            </div>
            <div class="stat-row">
                <span>Total Words:</span> <strong>${state.overallStats.totalWords}</strong>
            </div>
            <div class="stat-row">
                <span>Total Exercises:</span> <strong>${state.overallStats.totalSentences + state.overallStats.totalReading + state.overallStats.totalListening + state.overallStats.totalPuzzles}</strong>
            </div>
        `;
    }
    
    // Averages
    const avgEl = document.getElementById('averageStats');
    if (avgEl) {
        avgEl.innerHTML = `
            <h4>📈 Daily Averages</h4>
            <div class="stat-row">
                <span>Words:</span> <strong>${state.overallStats.averageDaily.words}</strong>
            </div>
            <div class="stat-row">
                <span>Sentences:</span> <strong>${state.overallStats.averageDaily.sentences}</strong>
            </div>
            <div class="stat-row">
                <span>Reading:</span> <strong>${state.overallStats.averageDaily.reading}</strong>
            </div>
            <div class="stat-row">
                <span>Listening:</span> <strong>${state.overallStats.averageDaily.listening}</strong>
            </div>
            <div class="stat-row">
                <span>Puzzles:</span> <strong>${state.overallStats.averageDaily.puzzles}</strong>
            </div>
        `;
    }
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
function setPronunciationDisplay(pronunciation) {
    const el = document.getElementById('pronunciation');
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
    // Wrapped, not bare: puzzles reload whichever sub-puzzle is selected.
    puzzles: () => loadPuzzle(state.currentPuzzle)
});

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