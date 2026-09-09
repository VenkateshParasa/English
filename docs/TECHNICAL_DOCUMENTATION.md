# 📘 Technical Documentation - English Learning Portal

## Architecture Overview

The English Learning Portal is built using a modular, vanilla JavaScript architecture with no external dependencies. The application follows a state-driven design pattern with persistent storage.

> **How this document cites code.** `app.js` is a single ~3,175-line classic script that
> changes shape often, so line numbers here rot within days. This document therefore cites
> **function and object names** — search for them (`function updateStatistics`,
> `const speechAPI`) rather than jumping to a line. Where a number is unavoidable it is
> stamped with the date it was checked. Snapshot verified against `app.js` (3,175 lines),
> `styles.css` (2,045 lines) on **2026-09-08**.

## Core Components

### 1. State Management (`const state` in [`app.js`](app.js:1))

The application uses a centralized state object that manages:

```javascript
const state = {
    currentSection: 'dashboard',
    currentDifficulty: 'basic',
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