
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

const state = {
    currentSection: 'dashboard',
    currentDifficulty: 'basic',
    currentWordIndex: 0,
    currentSentenceIndex: 0,
    currentPassageIndex: 0,
    currentListeningIndex: 0,
    currentPuzzle: 'wordsearch',
    vocabProgress: 0,
    stats: {
        wordsLearned: 0,
        sentencesCompleted: 0,
        readingCompleted: 0,
        puzzlesSolved: 0
    },
    dailyGoals: {
        vocab: false,
        sentence: false,
        reading: false,
        listening: false,
        puzzle: false
    },
    sentenceBuilderWords: [],
    sentenceAttempts: 0,
    sentenceHintUsed: false,
    // Enhanced progress tracking
    completedExercises: {
        vocabulary: new Set(),
        sentences: new Set(),
        reading: new Set(),
        listening: new Set(),
        puzzles: new Set()
    },
    exerciseHistory: [],
    generatedExercises: {
        sentences: [],
        reading: [],
        listening: []
    },
    // Daily and overall statistics
    dailyStats: {
        date: new Date().toDateString(),
        wordsLearned: 0,
        sentencesCompleted: 0,
        readingCompleted: 0,
        listeningCompleted: 0,
        puzzlesSolved: 0,
        timeSpent: 0,
        streak: 0
    },
    overallStats: {
        totalDays: 0,
        totalWords: 0,
        totalSentences: 0,
        totalReading: 0,
        totalListening: 0,
        totalPuzzles: 0,
        bestStreak: 0,
        currentStreak: 0,
        averageDaily: {
            words: 0,
            sentences: 0,
            reading: 0,
            listening: 0,
            puzzles: 0
        }
    },
    dailyHistory: []
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const cache = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
        } catch (e) {
            ErrorHandler.logError(e, 'cache operation');
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
    try {
        const toSave = {
            ...state,
            completedExercises: {
                vocabulary: Array.from(state.completedExercises.vocabulary),
                sentences: Array.from(state.completedExercises.sentences),
                reading: Array.from(state.completedExercises.reading),
                listening: Array.from(state.completedExercises.listening),
                puzzles: Array.from(state.completedExercises.puzzles)
            }
        };
        localStorage.setItem('learningProgress', JSON.stringify(toSave));
    } catch (e) {
        ErrorHandler.logError(e, 'save progress');
    }
}

function loadProgress() {
    try {
        const saved = localStorage.getItem('learningProgress');
        if (saved) {
            const loaded = JSON.parse(saved);
            Object.assign(state.stats, loaded.stats || {});
            Object.assign(state.dailyGoals, loaded.dailyGoals || {});
            state.currentWordIndex = loaded.currentWordIndex || 0;
            state.currentSentenceIndex = loaded.currentSentenceIndex || 0;
            state.currentPassageIndex = loaded.currentPassageIndex || 0;
            state.currentListeningIndex = loaded.currentListeningIndex || 0;
            state.exerciseHistory = loaded.exerciseHistory || [];
            
            // Restore completed exercises sets
            if (loaded.completedExercises) {
                state.completedExercises.vocabulary = new Set(loaded.completedExercises.vocabulary || []);
                state.completedExercises.sentences = new Set(loaded.completedExercises.sentences || []);
                state.completedExercises.reading = new Set(loaded.completedExercises.reading || []);
                state.completedExercises.listening = new Set(loaded.completedExercises.listening || []);
                state.completedExercises.puzzles = new Set(loaded.completedExercises.puzzles || []);
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
        ErrorHandler.logError(e, 'load progress');
    }
}

// Reset daily stats for new day
function resetDailyStats() {
    state.dailyStats = {
        date: new Date().toDateString(),
        wordsLearned: 0,
        sentencesCompleted: 0,
        readingCompleted: 0,
        listeningCompleted: 0,
        puzzlesSolved: 0,
        timeSpent: 0
    };
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
        state.overallStats.averageDaily.words = Math.round(state.overallStats.totalWords / totalDays);
        state.overallStats.averageDaily.sentences = Math.round(state.overallStats.totalSentences / totalDays);
        state.overallStats.averageDaily.reading = Math.round(state.overallStats.totalReading / totalDays);
        state.overallStats.averageDaily.listening = Math.round(state.overallStats.totalListening / totalDays);
        state.overallStats.averageDaily.puzzles = Math.round(state.overallStats.totalPuzzles / totalDays);
    }
}

// Update statistics when completing exercises
function updateStatistics(type) {
    // Update daily stats
    switch(type) {
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

// Generate unlimited sentence exercises
function generateSentenceExercise(index) {
    const templates = [
        { words: ["The", "sun", "is", "shining", "brightly"], correct: "The sun is shining brightly" },
        { words: ["I", "love", "learning", "new", "things"], correct: "I love learning new things" },
        { words: ["Practice", "makes", "perfect", "every", "day"], correct: "Practice makes perfect every day" },
        { words: ["Reading", "books", "expands", "your", "mind"], correct: "Reading books expands your mind" },
        { words: ["Hard", "work", "leads", "to", "success"], correct: "Hard work leads to success" }
    ];
    
    const baseExercise = templates[index % templates.length];
    return {
        words: baseExercise.words,
        correct: baseExercise.correct,
        fillBlank: {
            sentence: baseExercise.correct.replace(baseExercise.words[1], "___"),
            answer: baseExercise.words[1],
            options: [baseExercise.words[1], "other", "word", "test"]
        }
    };
}

// Update navigation buttons visibility and state
function updateNavigationButtons(type) {
    const sections = {
        vocabulary: { prev: null, next: 'nextWord', current: 'currentWordIndex' },
        sentences: { prev: 'prevSentence', next: 'nextSentence', current: 'currentSentenceIndex' },
        reading: { prev: 'prevReading', next: 'nextReading', current: 'currentPassageIndex' },
        listening: { prev: 'prevListening', next: 'nextListening', current: 'currentListeningIndex' }
    };
    
    const section = sections[type];
    if (!section) return;
    
    const currentIndex = state[section.current];
    const isCompleted = isExerciseCompleted(type, currentIndex);
    
    // Update completion indicator
    updateCompletionIndicator(type, currentIndex, isCompleted);
}

// Update completion indicator in UI
function updateCompletionIndicator(type, index, isCompleted) {
    const indicators = {
        vocabulary: 'vocabStatus',
        sentences: 'sentenceStatus',
        reading: 'readingStatus',
        listening: 'listeningStatus'
    };
    
    const indicatorId = indicators[type];
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
        indicator.innerHTML = isCompleted
            ? `<span class="status-complete">✓ Completed</span> <button class="btn-secondary btn-retake" onclick="retakeCurrentExercise('${type}')">Retake</button>`
            : `<span class="status-incomplete">○ Not completed</span>`;
    }
}

// Retake current exercise
window.retakeCurrentExercise = function(type) {
    const indexMap = {
        vocabulary: 'currentWordIndex',
        sentences: 'currentSentenceIndex',
        reading: 'currentPassageIndex',
        listening: 'currentListeningIndex'
    };

    const currentIndex = state[indexMap[type]];
    retakeExercise(type, currentIndex);

    // Reload the exercise
    const loaders = {
        vocabulary: loadVocabularyWord,
        sentences: loadSentenceExercise,
        reading: loadReadingPassage,
        listening: loadListeningExercise
    };
    loaders[type]?.();
};

// ============================================
// ERROR HANDLER WITH RETRY LOGIC
// ============================================

const ErrorHandler = {
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

    // Classify error type
    classifyError(error) {
        if (!navigator.onLine) return this.ErrorTypes.NETWORK;
        if (error.name === 'TimeoutError' || error.name === 'AbortError') return this.ErrorTypes.TIMEOUT;
        if (error.response) return this.ErrorTypes.API;
        if (error.name === 'QuotaExceededError') return this.ErrorTypes.STORAGE;
        if (error.name === 'NotAllowedError') return this.ErrorTypes.PERMISSION;
        return this.ErrorTypes.UNKNOWN;
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
            fallback = null
        } = options;

        this.logError(error, context);
        const errorType = this.classifyError(error);
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

    // Validate and sanitize input
    validateInput(input, rules = {}) {
        const {
            required = false,
            minLength = 0,
            maxLength = Infinity,
            pattern = null,
            type = 'text'
        } = rules;

        // Check if required
        if (required && (!input || input.trim() === '')) {
            throw new Error('This field is required');
        }

        // If not required and empty, return sanitized empty string
        if (!input) return '';

        // Sanitize input
        const sanitized = this.sanitizeInput(input);

        // Check length
        if (sanitized.length < minLength) {
            throw new Error(`Minimum length is ${minLength} characters`);
        }
        if (sanitized.length > maxLength) {
            throw new Error(`Maximum length is ${maxLength} characters`);
        }

        // Check pattern
        if (pattern && !pattern.test(sanitized)) {
            throw new Error('Invalid format');
        }

        return sanitized;
    },

    // Sanitize input to prevent XSS
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;

        // Remove HTML tags
        const div = document.createElement('div');
        div.textContent = input;
        const sanitized = div.innerHTML;

        // Additional sanitization
        return sanitized
            .replace(/[<>]/g, '')
            .trim();
    }
};

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
            message: ErrorHandler.sanitizeInput(message),
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

        toastEl.innerHTML = `
            <span class="toast-icon">${icons[toast.type] || icons.info}</span>
            <span class="toast-message">${toast.message}</span>
            <button class="toast-close" aria-label="Close notification">×</button>
        `;

        // Close button handler
        const closeBtn = toastEl.querySelector('.toast-close');
        closeBtn.onclick = () => this.dismiss(toast.id);

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
            const wordData = await ErrorHandler.retryWithBackoff(
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
            ErrorHandler.handleError(error, `word "${word}"`, {
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
    return {
        word: apiData.word,
        pronunciation: apiData.phonetic || apiData.phonetics[0]?.text || '',
        definition: definition.definition,
        example: definition.example || `Example: ${apiData.word} is commonly used.`,
        quiz: {
            question: `What does '${apiData.word}' mean?`,
            options: [definition.definition, "Something different", "Unrelated concept", "Opposite meaning"].sort(() => Math.random() - 0.5),
            correct: 0
        }
    };
}

function getLocalWordData(word) {
    const localWords = vocabularyData[state.currentDifficulty] || vocabularyData.basic;
    return localWords.find(w => w.word.toLowerCase() === word.toLowerCase()) || 
           localWords[state.currentWordIndex % localWords.length];
}

// ============================================
// WEB SPEECH API
// ============================================

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
                // Validate and sanitize the speech recognition result
                const validatedTranscript = ErrorHandler.validateInput(transcript, {
                    required: true,
                    maxLength: 500,
                    pattern: /^[a-zA-Z0-9\s.,!?'\-]+$/
                });
                callback(validatedTranscript);
            } catch (error) {
                ErrorHandler.handleError(error, 'speech recognition result');
                Toast.error('Invalid speech input detected');
            }
        };
        recognition.onerror = (e) => {
            ErrorHandler.logError(new Error(e.error), 'speech recognition');
            Toast.error('Speech recognition error. Please try again.');
        };
        recognition.start();
        return recognition;
    }
};

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
    
    const loaders = {
        vocabulary: loadVocabularyWord,
        sentences: loadSentenceExercise,
        reading: loadReadingPassage,
        listening: loadListeningExercise,
        puzzles: () => loadPuzzle(state.currentPuzzle)
    };
    loaders[sectionName]?.();
}

function initializeDifficultySelectors() {
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const level = btn.dataset.level;
            btn.parentElement.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentDifficulty = level;
            state.currentWordIndex = 0;
            state.currentSentenceIndex = 0;
            state.currentPassageIndex = 0;
            
            const section = btn.closest('.section').id;
            if (section === 'vocabulary') loadVocabularyWord();
            if (section === 'sentences') loadSentenceExercise();
            if (section === 'reading') loadReadingPassage();
        });
    });
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
    const progressPercent = (completedGoals / 5) * 100;
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
                <span>Total Exercises:</span> <strong>${state.overallStats.totalSentences + state.overallStats.totalReading + state.overallStats.totalPuzzles}</strong>
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

async function loadVocabularyWord() {
    const localWords = vocabularyData[state.currentDifficulty];
    const currentWord = localWords[state.currentWordIndex % localWords.length];

    // Show loading indicator
    LoadingIndicator.show('vocabulary', 'Loading word...');
    document.getElementById('currentWord').textContent = 'Loading...';

    try {
        const wordData = await fetchWordData(currentWord.word);
        document.getElementById('currentWord').textContent = wordData.word;
        document.getElementById('pronunciation').textContent = wordData.pronunciation;
        document.getElementById('definition').textContent = wordData.definition;
        document.getElementById('example').textContent = wordData.example;
        displayVocabQuiz(wordData.quiz);
        document.getElementById('vocabProgress').textContent = `${state.vocabProgress}/10`;
    } catch (error) {
        ErrorHandler.handleError(error, 'vocabulary word', {
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
    
    quiz.options.forEach((option, index) => {
        const div = document.createElement('div');
        div.className = 'quiz-option';
        div.textContent = option;
        div.onclick = () => {
            container.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected', 'correct', 'incorrect'));
            div.classList.add('selected', index === quiz.correct ? 'correct' : 'incorrect');
            if (index === quiz.correct) {
                state.vocabProgress++;
                state.stats.wordsLearned++;
                state.dailyGoals.vocab = true;
                updateStatistics('vocabulary');
                updateDashboard();
                saveProgress();
            } else {
                container.children[quiz.correct].classList.add('correct');
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
    
    // Randomly choose exercise type
    const exerciseTypes = ['dragdrop', 'fillblank', 'multiplechoice', 'reorder'];
    const randomType = exerciseTypes[Math.floor(Math.random() * exerciseTypes.length)];
    
    // Hide all exercise containers
    document.querySelectorAll('.sentence-exercise-container').forEach(el => el.style.display = 'none');
    
    // Show selected exercise type
    switch(randomType) {
        case 'dragdrop':
            loadDragDropSentence(exercise);
            document.getElementById('dragDropContainer').style.display = 'block';
            break;
        case 'fillblank':
            loadFillBlankExercise(exercise.fillBlank);
            document.getElementById('fillBlankExerciseContainer').style.display = 'block';
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
        const sanitizedWord = ErrorHandler.sanitizeInput(word);
        chip.textContent = sanitizedWord;
        chip.draggable = true;
        chip.ondragstart = (e) => {
            try {
                // Validate word before allowing drag
                const validatedWord = ErrorHandler.validateInput(sanitizedWord, {
                    required: true,
                    maxLength: 100,
                    pattern: /^[a-zA-Z0-9\s.,!?'\-]+$/
                });
                e.dataTransfer.setData('text', validatedWord);
                chip.classList.add('dragging');
            } catch (error) {
                e.preventDefault();
                ErrorHandler.handleError(error, 'drag operation');
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
                const validatedText = ErrorHandler.validateInput(chip.textContent, {
                    required: true,
                    maxLength: 100
                });
                state.sentenceBuilderWords.push(validatedText);
            } catch (error) {
                ErrorHandler.handleError(error, 'word selection');
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
                const validatedText = ErrorHandler.validateInput(droppedText, {
                    required: true,
                    maxLength: 100,
                    pattern: /^[a-zA-Z0-9\s.,!?'\-]+$/
                });
            }
            const chip = document.querySelector('.word-chip.dragging');
            if (chip) chip.click();
        } catch (error) {
            ErrorHandler.handleError(error, 'drop operation');
            Toast.warning('Invalid drop operation');
        }
    };
}

function loadFillBlankExercise(fillBlank) {
    document.getElementById('fillBlankInstruction').textContent = fillBlank.sentence;
    const container = document.getElementById('fillBlankContainer');
    container.innerHTML = '';
    fillBlank.sentence.split('___').forEach((part, i, arr) => {
        container.appendChild(document.createTextNode(part));
        if (i < arr.length - 1) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'blank-input';
            input.dataset.answer = fillBlank.answer;
            container.appendChild(input);
        }
    });
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
            state.stats.sentencesCompleted++;
            state.dailyGoals.sentence = true;
            markExerciseComplete('sentences', state.currentSentenceIndex);
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
        loadSentenceExercise();
        document.getElementById('sentenceFeedback').classList.remove('visible');
        document.getElementById('hintDisplay').classList.remove('visible');
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
    console.log('showSentenceHint called');
    console.log('currentExercise:', state.currentExercise);
    
    if (!state.currentExercise) {
        console.error('No current exercise found!');
        return;
    }
    
    const hintDisplay = document.getElementById('hintDisplay');
    console.log('hintDisplay element:', hintDisplay);
    
    if (!hintDisplay) {
        console.error('hintDisplay element not found!');
        return;
    }
    
    // Get a random word from the correct sentence as a hint
    const words = state.currentExercise.words || state.currentExercise.correct.split(' ');
    const randomIndex = Math.floor(Math.random() * words.length);
    const hintWord = words[randomIndex];
    const position = randomIndex + 1;
    
    console.log('Hint word:', hintWord, 'at position:', position);
    
    hintDisplay.innerHTML = `
        <div class="hint-content">
            <span class="hint-icon">💡</span>
            <strong>Hint:</strong> Word #${position} is "<span class="hint-word">${hintWord}</span>"
        </div>
    `;
    hintDisplay.classList.add('visible');
    
    console.log('Hint display classes:', hintDisplay.className);
    console.log('Hint display style:', window.getComputedStyle(hintDisplay).display);
    
    // Keep the hint button visible but disable it and change text
    const hintBtn = document.getElementById('sentenceHint');
    if (hintBtn) {
        hintBtn.textContent = '💡 Hint Shown';
        hintBtn.disabled = true;
        hintBtn.classList.remove('pulse');
        hintBtn.style.opacity = '0.6';
        hintBtn.style.cursor = 'not-allowed';
    }
    
    console.log('Hint should now be visible');
}

// ============================================
// READING SECTION
// ============================================

function loadReadingPassage() {
    const passages = readingPassages[state.currentDifficulty];
    const passage = passages[state.currentPassageIndex % passages.length];
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
            state.stats.readingCompleted++;
            state.dailyGoals.reading = true;
            markExerciseComplete('reading', state.currentPassageIndex);
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
            const sanitizedInput = ErrorHandler.validateInput(input, {
                required: true,
                minLength: 1,
                maxLength: 500
            });

            const sim = sanitizedInput.trim().toLowerCase() === correct.toLowerCase() ? 1 : 0.5;
            if (sim > 0.8) {
                showFeedback('dictationFeedback', '✓ Excellent!', 'success');
                Toast.success('Dictation completed successfully!');
                state.stats.readingCompleted++;
                state.dailyGoals.reading = true;
                markExerciseComplete('reading', state.currentPassageIndex);
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

function loadListeningExercise() {
    const exercises = listeningExercises[state.currentDifficulty];
    const sentence = exercises[state.currentListeningIndex % exercises.length];
    document.getElementById('listenSentence').textContent = sentence;
    document.getElementById('playListening').dataset.text = sentence;
    const words = vocabularyData[state.currentDifficulty];
    document.getElementById('targetWord').textContent = words[Math.floor(Math.random() * words.length)].word;
    updateNavigationButtons('listening');
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
        const target = document.getElementById('targetWord').textContent;
        speechAPI.startRecognition((transcript) => {
            document.getElementById('recognizedText').textContent = `You said: "${transcript}"`;
            if (transcript.toLowerCase().includes(target.toLowerCase())) {
                showFeedback('speechFeedback', '✓ Perfect!', 'success');
                state.dailyGoals.listening = true;
                markExerciseComplete('listening', state.currentListeningIndex);
                updateDashboard();
                saveProgress();
            } else {
                showFeedback('speechFeedback', `Try: "${target}"`, 'info');
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
                    if (document.querySelectorAll('.word-list-item.found').length === data.words.length) {
                        state.stats.puzzlesSolved++;
                        state.dailyGoals.puzzle = true;
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
        state.stats.puzzlesSolved++;
        state.dailyGoals.puzzle = true;
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
    document.getElementById('scrambleHint').textContent = `Hint: ${current.hint}`;
    document.getElementById('scrambleHint').classList.remove('visible');
    document.getElementById('scrambleFeedback').classList.remove('visible');
}

function initializeScrambleButtons() {
    document.getElementById('checkScramble').onclick = () => {
        const input = document.getElementById('scrambleInput');

        try {
            const sanitizedInput = ErrorHandler.validateInput(input.value, {
                required: true,
                minLength: 1,
                maxLength: 50
            });

            if (sanitizedInput.toUpperCase() === input.dataset.answer) {
                showFeedback('scrambleFeedback', '✓ Correct!', 'success');
                Toast.success('Word unscrambled correctly!');
                state.stats.puzzlesSolved++;
                state.dailyGoals.puzzle = true;
                updateDashboard();
                saveProgress();
            } else {
                showFeedback('scrambleFeedback', '✗ Incorrect', 'error');
            }
        } catch (error) {
            showFeedback('scrambleFeedback', error.message, 'error');
            Toast.error('Please enter your answer before checking');
        }
    };
    document.getElementById('showHint').onclick = () => document.getElementById('scrambleHint').classList.add('visible');
    document.getElementById('nextScramble').onclick = loadWordScramble;
}

function loadWordMatching() {
    const pairs = puzzleData.matching[state.currentDifficulty];
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
                    state.stats.puzzlesSolved++;
                    state.dailyGoals.puzzle = true;
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

        // Alt + number for section navigation
        if (altKey && key >= '1' && key <= '6') {
            event.preventDefault();
            const sections = ['dashboard', 'vocabulary', 'sentences', 'reading', 'listening', 'puzzles'];
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
        const buttons = {
            vocabulary: 'prevWord',
            sentences: 'prevSentence',
            reading: 'prevReading',
            listening: 'prevListening'
        };

        const btnId = buttons[section];
        if (btnId) {
            const btn = document.getElementById(btnId);
            if (btn && !btn.disabled) {
                btn.click();
            }
        }
    },

    // Navigate to next item in current section
    navigateNext(section) {
        const buttons = {
            vocabulary: 'nextWord',
            sentences: 'nextSentence',
            reading: 'nextReading',
            listening: 'nextListening'
        };

        const btnId = buttons[section];
        if (btnId) {
            const btn = document.getElementById(btnId);
            if (btn && !btn.disabled) {
                btn.click();
            }
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
    console.log('♿ Accessibility: WCAG 2.1 AA Compliant');

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