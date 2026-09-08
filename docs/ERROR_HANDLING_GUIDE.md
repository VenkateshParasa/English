# 🛡️ Error Handling Implementation Guide

## Overview

This guide explains how to integrate the robust error handling utilities into your English Learning Portal.

---

## 📦 Core Utilities Created

### 1. **ErrorHandler** (`js/core/error-handler.js`)
- Retry logic with exponential backoff
- Error boundaries for async operations
- Timeout handling
- Error logging and persistence
- Global error listeners

### 2. **Validator** (`js/core/validator.js`)
- Input sanitization (XSS prevention)
- Schema validation
- Exercise data validation
- Progress data validation
- Storage data validation

### 3. **StorageManager** (`js/core/storage.js`)
- Safe localStorage operations
- Automatic backup/restore
- Data compression
- Storage quota management
- Import/export functionality

---

## 🚀 Quick Start Integration

### Step 1: Include the Utilities in HTML

Add these script tags to [`index.html`](index.html:1) before [`app.js`](app.js:1):

```html
<!-- Error Handling Utilities -->
<script src="js/core/error-handler.js"></script>
<script src="js/core/validator.js"></script>
<script src="js/core/storage.js"></script>

<!-- Existing scripts -->
<script src="data.js"></script>
<script src="app.js"></script>
```

### Step 2: Initialize in app.js

Add this at the beginning of [`app.js`](app.js:1):

```javascript
// Initialize error handling utilities
const validator = new Validator();
const storage = new StorageManager(errorHandler, validator);

// Add error listener for user notifications
errorHandler.addListener((error, context) => {
    console.error('Application Error:', error, context);
    // Show user-friendly error message
    showErrorNotification(error.message);
});
```

---

## 💡 Usage Examples

### Example 1: API Calls with Retry Logic

**Before (Current Code):**
```javascript
async function fetchWordData(word) {
    const cached = cache.get(`word_${word.toLowerCase()}`);
    if (cached) return cached;
    
    try {
        const response = await fetch(`${CONFIG.dictionaryAPI}${word.toLowerCase()}`);
        if (response.ok) {
            const data = await response.json();
            return parseAPIResponse(data[0]);
        }
    } catch (error) {
        console.warn(`API failed for "${word}", using offline data`);
    }
    return getLocalWordData(word);
}
```

**After (With Error Handling):**
```javascript
async function fetchWordData(word) {
    const cached = cache.get(`word_${word.toLowerCase()}`);
    if (cached) return cached;
    
    // Wrap API call with retry logic and timeout
    return await errorHandler.withRetry(
        async () => {
            const response = await errorHandler.withTimeout(
                () => fetch(`${CONFIG.dictionaryAPI}${word.toLowerCase()}`),
                5000 // 5 second timeout
            );
            
            if (!response.ok) {
                throw new APIError(
                    `API returned ${response.status}`,
                    CONFIG.dictionaryAPI,
                    response.status
                );
            }
            
            const data = await response.json();
            const wordData = parseAPIResponse(data[0]);
            cache.set(`word_${word.toLowerCase()}`, wordData);
            return wordData;
        },
        {
            maxRetries: 3,
            delay: 1000,
            backoff: 2,
            onRetry: (error, attempt, waitTime) => {
                console.log(`Retrying API call (${attempt}/3) in ${waitTime}ms...`);
            },
            shouldRetry: (error) => {
                // Only retry on network errors, not on 404s
                return !(error instanceof APIError && error.statusCode === 404);
            }
        }
    ).catch(error => {
        // Fallback to local data on all retries failed
        console.warn(`All API retries failed for "${word}", using offline data`);
        return getLocalWordData(word);
    });
}
```

### Example 2: Input Validation

**Before:**
```javascript
document.getElementById('checkDictation').onclick = () => {
    const input = document.getElementById('dictationInput').value.trim();
    const correct = document.getElementById('playDictation').dataset.text;
    // Direct comparison without validation
    const sim = input.toLowerCase() === correct.toLowerCase() ? 1 : 0.5;
    // ...
};
```

**After:**
```javascript
document.getElementById('checkDictation').onclick = () => {
    const input = document.getElementById('dictationInput').value;
    
    // Validate and sanitize input
    const validation = Validator.validateUserAnswer(input, 500);
    
    if (!validation.valid) {
        showFeedback('dictationFeedback', validation.error, 'error');
        return;
    }
    
    const sanitizedInput = validation.sanitized;
    const correct = document.getElementById('playDictation').dataset.text;
    
    // Safe comparison with sanitized input
    const sim = sanitizedInput.toLowerCase() === correct.toLowerCase() ? 1 : 0.5;
    
    if (sim > 0.8) {
        showFeedback('dictationFeedback', '✓ Excellent!', 'success');
        state.stats.readingCompleted++;
        updateDashboard();
        saveProgress();
    } else {
        showFeedback('dictationFeedback', `Correct: "${Validator.sanitizeHTML(correct)}"`, 'info');
    }
};
```

### Example 3: Safe Storage Operations

**Before:**
```javascript
function saveProgress() {
    try {
        const toSave = {
            ...state,
            completedExercises: {
                vocabulary: Array.from(state.completedExercises.vocabulary),
                // ...
            }
        };
        localStorage.setItem('learningProgress', JSON.stringify(toSave));
    } catch (e) {
        console.warn('Save failed:', e);
    }
}
```

**After:**
```javascript
async function saveProgress() {
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
    
    // Validate before saving
    const validation = Validator.validateProgress(toSave);
    if (!validation.valid) {
        console.error('Invalid progress data:', validation.errors);
        errorHandler.logError(
            new ValidationError('Invalid progress data'),
            { errors: validation.errors }
        );
        return false;
    }
    
    // Save with automatic backup and error handling
    const success = await storage.save('learningProgress', toSave, {
        validate: true,
        backup: true,
        compress: true // Auto-compress if data is large
    });
    
    if (!success) {
        // Try to restore from backup
        console.warn('Save failed, attempting to restore from backup...');
        await storage.restoreFromBackup('learningProgress');
    }
    
    return success;
}
```

### Example 4: Loading with Validation

**Before:**
```javascript
function loadProgress() {
    try {
        const saved = localStorage.getItem('learningProgress');
        if (saved) {
            const loaded = JSON.parse(saved);
            Object.assign(state.stats, loaded.stats || {});
            // ...
        }
    } catch (e) {
        console.warn('Load failed:', e);
    }
}
```

**After:**
```javascript
async function loadProgress() {
    const loaded = await storage.load('learningProgress', null, {
        validate: true,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    if (!loaded) {
        console.log('No saved progress found, starting fresh');
        return;
    }
    
    // Safely merge loaded data
    try {
        Object.assign(state.stats, loaded.stats || {});
        Object.assign(state.dailyGoals, loaded.dailyGoals || {});
        state.currentWordIndex = loaded.currentWordIndex || 0;
        state.currentSentenceIndex = loaded.currentSentenceIndex || 0;
        
        // Restore completed exercises sets
        if (loaded.completedExercises) {
            state.completedExercises.vocabulary = new Set(loaded.completedExercises.vocabulary || []);
            state.completedExercises.sentences = new Set(loaded.completedExercises.sentences || []);
            state.completedExercises.reading = new Set(loaded.completedExercises.reading || []);
            state.completedExercises.listening = new Set(loaded.completedExercises.listening || []);
            state.completedExercises.puzzles = new Set(loaded.completedExercises.puzzles || []);
        }
        
        // Check if it's a new day
        const today = new Date().toDateString();
        if (loaded.dailyStats && loaded.dailyStats.date === today) {
            Object.assign(state.dailyStats, loaded.dailyStats);
        } else {
            resetDailyStats();
            if (loaded.dailyStats) {
                updateStreak(loaded.dailyStats.date);
            }
        }
        
        if (loaded.overallStats) {
            Object.assign(state.overallStats, loaded.overallStats);
        }
        
        calculateAverages();
        updateDashboard();
        
    } catch (error) {
        errorHandler.logError(error, { operation: 'loadProgress' });
        console.error('Error loading progress:', error);
        
        // Try to restore from backup
        const restored = await storage.restoreFromBackup('learningProgress');
        if (restored) {
            console.log('Successfully restored from backup');
            loadProgress(); // Retry loading
        }
    }
}
```

### Example 5: Exercise Data Validation

```javascript
function loadVocabularyWord() {
    const localWords = vocabularyData[state.currentDifficulty];
    const currentWord = localWords[state.currentWordIndex % localWords.length];
    
    // Validate exercise data before using
    const validation = Validator.validateExercise(currentWord, 'vocabulary');
    
    if (!validation.valid) {
        console.error('Invalid vocabulary data:', validation.errors);
        errorHandler.logError(
            new ValidationError('Invalid vocabulary exercise'),
            { errors: validation.errors, word: currentWord }
        );
        
        // Skip to next word
        state.currentWordIndex++;
        loadVocabularyWord();
        return;
    }
    
    // Safe to use the data
    document.getElementById('currentWord').textContent = currentWord.word;
    document.getElementById('pronunciation').textContent = currentWord.pronunciation;
    document.getElementById('definition').textContent = Validator.sanitizeHTML(currentWord.definition);
    document.getElementById('example').textContent = Validator.sanitizeHTML(currentWord.example);
    displayVocabQuiz(currentWord.quiz);
}
```

---

## 🎯 Best Practices

### 1. **Always Validate User Input**
```javascript
// ✅ Good
const validation = Validator.validateUserAnswer(userInput);
if (validation.valid) {
    processAnswer(validation.sanitized);
}

// ❌ Bad
processAnswer(userInput); // No validation!
```

### 2. **Use Error Boundaries for Async Operations**
```javascript
// ✅ Good
const result = await errorHandler.withErrorBoundary(
    async () => await riskyOperation(),
    defaultValue,
    { context: 'operation description' }
);

// ❌ Bad
try {
    const result = await riskyOperation();
} catch (e) {
    console.log(e); // Silent failure
}
```

### 3. **Implement Retry Logic for Network Calls**
```javascript
// ✅ Good
const data = await errorHandler.withRetry(
    () => fetch(url),
    { maxRetries: 3, delay: 1000 }
);

// ❌ Bad
const data = await fetch(url); // No retry on failure
```

### 4. **Sanitize All HTML Output**
```javascript
// ✅ Good
element.textContent = Validator.sanitizeHTML(userContent);

// ❌ Bad
element.innerHTML = userContent; // XSS vulnerability!
```

### 5. **Use Storage Manager for All localStorage Operations**
```javascript
// ✅ Good
await storage.save('key', data, { validate: true, backup: true });

// ❌ Bad
localStorage.setItem('key', JSON.stringify(data)); // No validation or backup
```

---

## 🔍 Monitoring & Debugging

### View Error Log
```javascript
// Get recent errors
const recentErrors = errorHandler.getErrorLog(10);
console.table(recentErrors);

// Clear error log
errorHandler.clearErrorLog();
```

### Check Storage Usage
```javascript
const storageInfo = storage.getStorageInfo();
console.log('Storage Usage:', storageInfo);
// Output:
// {
//   totalSizeMB: "2.45",
//   appSizeMB: "1.23",
//   items: { learningProgress: { size: 12345, sizeKB: "12.05" } },
//   available: 5242880
// }
```

### Export/Import Data
```javascript
// Export all data
const exportedData = storage.exportData();
console.log('Exported:', exportedData);

// Import data
const success = storage.importData(importedData);
```

---

## 📊 Error Types Reference

| Error Type | Use Case | Example |
|------------|----------|---------|
| `NetworkError` | Network/connectivity issues | API timeout, no internet |
| `ValidationError` | Invalid data/input | Bad user input, corrupted data |
| `StorageError` | localStorage failures | Quota exceeded, access denied |
| `APIError` | API-specific errors | 404, 500, rate limiting |

---

## 🚨 Common Pitfalls to Avoid

1. **Don't ignore validation errors**
   ```javascript
   // ❌ Bad
   const validation = Validator.validateProgress(data);
   // Proceed anyway without checking validation.valid
   
   // ✅ Good
   if (!validation.valid) {
       handleValidationError(validation.errors);
       return;
   }
   ```

2. **Don't mix old and new error handling**
   ```javascript
   // ❌ Bad - Mixing approaches
   try {
       await errorHandler.withRetry(() => operation());
   } catch (e) {
       console.log(e);
   }
   
   // ✅ Good - Use error boundaries
   await errorHandler.withErrorBoundary(
       () => errorHandler.withRetry(() => operation()),
       fallbackValue
   );
   ```

3. **Don't forget to sanitize before displaying**
   ```javascript
   // ❌ Bad
   element.innerHTML = userInput;
   
   // ✅ Good
   element.textContent = Validator.sanitizeHTML(userInput);
   ```

---

## 📈 Next Steps

1. ✅ **Error Handling Utilities Created**
2. ⏭️ **Integrate into existing app.js** (see examples above)
3. ⏭️ **Add user-friendly error notifications** (toast system)
4. ⏭️ **Implement loading states** for async operations
5. ⏭️ **Add comprehensive testing** for error scenarios

---

## 🔗 Related Files

- [`js/core/error-handler.js`](js/core/error-handler.js:1) - Main error handling utility
- [`js/core/validator.js`](js/core/validator.js:1) - Validation and sanitization
- [`js/core/storage.js`](js/core/storage.js:1) - Safe storage operations
- [`app.js`](app.js:1) - Main application file (to be updated)

---

**Ready to implement!** Start by adding the script tags to [`index.html`](index.html:1) and gradually refactor [`app.js`](app.js:1) using the examples above.