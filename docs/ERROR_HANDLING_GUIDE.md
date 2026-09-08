# 🛡️ Error Handling Implementation Guide

## Overview

This guide explains how the `js/core/` error handling utilities were *intended* to be
integrated into your English Learning Portal.

> **⚠️ Status note — this integration never happened**
>
> **Everything from "Quick Start Integration" onwards is aspirational design, not
> working code.** It is kept here on purpose — the design is worth recording — but do
> not read it as a description of the running application.
>
> What is actually true today:
>
> - The four `js/core/` modules **are** loaded by [`index.html`](../index.html:356).
> - **Nothing in the application calls them.** `app.js` contains no reference to
>   `errorHandler`, `Validator`, `StorageManager`, `notificationManager` or
>   `loadingManager` — only two stale comments naming `ErrorHandler`
>   ([`app.js:939`](../app.js:939), [`app.js:959`](../app.js:959)).
> - `class StorageManager` ([`js/core/storage.js:6`](../js/core/storage.js:6)) and
>   `class Validator` ([`js/core/validator.js:6`](../js/core/validator.js:6)) are
>   **never instantiated anywhere**.
> - `errorHandler` ([`js/core/error-handler.js:326`](../js/core/error-handler.js:326)),
>   `notificationManager` and `loadingManager`
>   ([`js/core/notification.js:497`](../js/core/notification.js:497)) are constructed
>   inside their own files, and no other file consumes them.
> - `app.js` instead uses its own inline helpers — see
>   [What `app.js` Actually Uses](#-what-appjs-actually-uses) below.
>
> **Pending harvest-then-delete.** These ~1,687 lines are parsed on every page load and
> almost nothing in them runs. Do **not** wire them up as a "quick fix", and do **not**
> delete the files wholesale: the backup / export / import code in `storage.js` and the
> schema-validation code in `validator.js` are still wanted and will be lifted out
> first. Only the class shells are being retired.
>
> **Two load-time side effects to preserve or replace, though — they are *not* dead:**
>
> 1. `js/core/error-handler.js:332` and `:341` register live `window` listeners for
>    `error` and `unhandledrejection`. Every uncaught error and unhandled rejection in
>    the app *is* captured by `errorHandler.logError()`
>    ([`js/core/error-handler.js:151`](../js/core/error-handler.js:151)) and persisted to
>    the `errorLog` localStorage key
>    ([`js/core/error-handler.js:231`](../js/core/error-handler.js:231)). Deleting this
>    file removes the app's only global error capture.
> 2. `notificationManager`'s constructor injects DOM nodes — see the note under
>    *Core Utilities* below.

---

## 🧭 What `app.js` Actually Uses

The running application relies on three plain object literals declared inside
[`app.js`](../app.js:1). They are objects, not classes — there is nothing to
construct.

### `AppErrorHandler` ([`app.js:566`](../app.js:566))

The real error path, used at roughly 20 call sites in `app.js`.

| Member | Notes |
|--------|-------|
| `ErrorTypes` | `NETWORK`, `TIMEOUT`, `API`, `VALIDATION`, `STORAGE`, `PERMISSION`, `UNKNOWN` |
| `classifyError(error)` | Maps a thrown error to an `ErrorTypes` value |
| `getUserMessage(errorType, context)` | User-facing copy for a type |
| `logError(error, context)` | Logging |
| `retryWithBackoff(fn, maxRetries, baseDelay, context)` | Async retry |
| `handleError(error, context, options)` | Classify + log + optionally toast |
| `wrapAsync(fn, context, options)` | Async wrapper |
| `validateInput(input, rules)` | Input validation |
| `sanitizeInput(input)` | Sanitisation |

```javascript
AppErrorHandler.logError(e, 'save progress');
AppErrorHandler.handleError(error, `word "${word}"`, { showToast: true });
const wordData = await AppErrorHandler.retryWithBackoff(fetchFn, 3, 1000, 'word lookup');
```

### `Toast` ([`app.js:741`](../app.js:741), exported as `window.Toast` at [`app.js:867`](../app.js:867))

`init()`, `show(message, type, duration)`, `displayToast(toast)`, `dismiss(toastId)`,
`success(message, duration)`, `error(...)`, `warning(...)`, `info(...)`, `clearAll()`.

```javascript
Toast.success('Progress saved');
Toast.error('Failed to load word. Please try again.');
Toast.warning('Invalid word detected');
```

### `LoadingIndicator` ([`app.js:873`](../app.js:873), exported as `window.LoadingIndicator` at [`app.js:927`](../app.js:927))

`init()`, `show(operationId, message)`, `hide(operationId)`, `isLoading()`.

```javascript
LoadingIndicator.show('vocabulary', 'Loading word...');
LoadingIndicator.hide('vocabulary');
```

Note that `js/core/notification.js` defines a *separate*, unused
`NotificationManager` / `LoadingManager` / `ConfirmationManager` trio. The two systems
are unrelated. They do overlap in CSS: the inline `Toast` and the unused
`NotificationManager` both render the `.toast-*` classes from
[`css/notifications.css`](../css/notifications.css:1), whereas the inline
`LoadingIndicator` uses `.loading-overlay` / `.loading-spinner` / `.loading-text` from
[`performance.css`](../performance.css:110) and the unused `LoadingManager` uses the
`.loader-*` classes from `css/notifications.css`. The `.loader-*` and `.dialog-*`
blocks in `css/notifications.css` are therefore dead styles today.

---

## 📦 Core Utilities Created (⚠️ none of them wired up)

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

### 4. **NotificationManager / LoadingManager / ConfirmationManager** (`js/core/notification.js`)
- Toast notifications with a `maxToasts` cap and manual dismissal
- Loading overlays attached to a target element (`overlay` / `spinner` / `blocking` options)
- Confirmation dialogs (`ConfirmationManager.confirm()`)
- Screen-reader announcements (`notificationManager.announce()`)

Superseded in practice by the inline `Toast` and `LoadingIndicator` in `app.js`. There
is no inline equivalent of `ConfirmationManager` — that capability exists here and
nowhere else, and is unreachable as things stand.

> **⚠️ Not entirely inert.** `notificationManager` is constructed at load time
> ([`js/core/notification.js:497`](../js/core/notification.js:497)) and its constructor
> calls `init()` ([`js/core/notification.js:17`](../js/core/notification.js:17)), which
> appends `<div id="toast-container" class="toast-container">` and
> `<div id="sr-announcer" class="sr-only">` to `document.body`. The app's own `Toast`
> creates a *different* container, `<div id="toastContainer">`
> ([`app.js:751`](../app.js:751)), also with class `toast-container`. So every page ends
> up with two `.toast-container` elements and a spare `aria-live` region, one of each
> permanently empty. Remove the `<script>` tag when doing the delete pass, not just the
> call sites.

---

## 🚀 Quick Start Integration (⚠️ aspirational — never carried out)

> Steps 1-2 and every "After" example below describe an integration that was
> **planned but never done**. Treat them as a design record for the
> harvest-then-delete pass, not as instructions to follow. Wiring these up now would
> duplicate the working `AppErrorHandler` / `Toast` / `LoadingIndicator` helpers
> described above.

### Step 1: Include the Utilities in HTML — ✅ done

[`index.html:356-359`](../index.html:356) already loads all four modules before
[`app.js`](../app.js:1):

```html
<!-- Error Handling Utilities -->
<script src="js/core/error-handler.js"></script>
<script src="js/core/validator.js"></script>
<script src="js/core/storage.js"></script>
<script src="js/core/notification.js"></script>

<!-- Existing scripts -->
<script src="data.js"></script>
<script src="app.js"></script>
```

This is the *only* step that happened — which is why the modules load on every page
and then sit idle.

### Step 2: Initialize in app.js — ⏭️ never done

This code **does not exist in [`app.js`](../app.js:1) or anywhere else** in the
codebase:

```javascript
// ⚠️ NOT PRESENT IN THE CODEBASE — aspirational design, do not copy as-is
const validator = new Validator();
const storage = new StorageManager(errorHandler, validator);

// Add error listener for user notifications
errorHandler.addListener((error, context) => {
    console.error('Application Error:', error, context);
    // Show user-friendly error message
    showErrorNotification(error.message);
});
```

Three problems to be aware of before anyone revives it:

- Every member of `Validator` is `static`
  ([`js/core/validator.js:12-392`](../js/core/validator.js:12)), so `new Validator()`
  yields an object with no usable methods. `StorageManager` stores that instance as
  `this.validator` ([`js/core/storage.js:9`](../js/core/storage.js:9)) and then calls
  `this.validator.validateProgress(data)` from `validateData()`
  ([`js/core/storage.js:333`](../js/core/storage.js:333)) — an instance call to a static
  method, which would throw `TypeError: this.validator.validateProgress is not a
  function`. **This wiring has never been executed, so the bug has never surfaced.**
- `showErrorNotification()` is not defined anywhere in the project. The real
  equivalent is `Toast.error(...)` ([`app.js:845`](../app.js:845)).
- `StorageManager` namespaces every key with the prefix `englishLearning_`
  ([`js/core/storage.js:10`](../js/core/storage.js:10)), whereas `app.js` reads and
  writes the bare `learningProgress` key ([`app.js:129`](../app.js:129),
  [`app.js:137`](../app.js:137)). Any future migration has to account for that mismatch.

---

## 💡 Usage Examples (⚠️ all "After" snippets are hypothetical)

> The "Before" snippets are approximations of older `app.js` code; the "After" snippets
> were **never merged**. `app.js` has since grown its own equivalents — e.g. the real
> retry path for dictionary lookups is
> `AppErrorHandler.retryWithBackoff(...)` at [`app.js:940`](../app.js:940), and the real
> input validation is `AppErrorHandler.validateInput(...)` /
> `AppErrorHandler.sanitizeInput(...)`. The method names used in the "After" snippets
> (`errorHandler.withRetry`, `withTimeout`, `withErrorBoundary`, `logError`;
> `Validator.validateUserAnswer`, `validateProgress`, `validateExercise`,
> `sanitizeHTML`; `storage.save`, `load`, `restoreFromBackup`) *do* all exist in
> `js/core/` — they are simply never called.

### Example 1: API Calls with Retry Logic

**Before (approximation of older `app.js`):**
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

## 🎯 Best Practices (⚠️ describe the unbuilt `js/core/` API)

> These are the conventions the `js/core/` design was aiming for. They are **not** the
> conventions the codebase follows: `app.js` uses `AppErrorHandler.validateInput()` /
> `AppErrorHandler.sanitizeInput()` rather than `Validator.*`, and plain
> `localStorage.setItem('learningProgress', ...)` ([`app.js:129`](../app.js:129)) rather
> than a storage manager. Keep the *principles*; ignore the specific `storage.*` and
> `Validator.*` call sites until something is actually wired up.

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

> **What works, what doesn't.** `errorHandler`, `notificationManager` and
> `loadingManager` are top-level `const` declarations in classic scripts
> ([`js/core/error-handler.js:326`](../js/core/error-handler.js:326),
> [`js/core/notification.js:497-498`](../js/core/notification.js:497)), so they *are*
> reachable from the devtools console even though the app never uses them — the error-log
> snippets below will run. The `storage.*` snippets will **not**: no `StorageManager`
> instance exists anywhere, so `storage` is undefined. To use them you would first have
> to construct one by hand.

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
// Export all data — returns { version, exportDate, data } (storage.js:351)
const exportedData = storage.exportData();
console.log('Exported:', exportedData);

// Import data — note: importData() wraps its body in errorHandler.withErrorBoundary(),
// so it returns a Promise, not a boolean (storage.js:384)
const success = await storage.importData(importedData);
```

> This backup / export / import code and `validator.js`'s schema validation are the
> parts of `js/core/` worth **harvesting** before the class shells are deleted.

---

## 📊 Error Types Reference

These four `Error` subclasses are defined in
[`js/core/error-handler.js:289-319`](../js/core/error-handler.js:289) and are real, but
**nothing throws them** outside `js/core/` itself. `app.js` classifies errors with the
`AppErrorHandler.ErrorTypes` string constants ([`app.js:568`](../app.js:568)) instead.

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

1. ✅ **Error Handling Utilities Created** — but never connected to anything
2. ❌ **Integrate into existing app.js** — *abandoned*. `app.js` grew its own
   `AppErrorHandler` instead ([`app.js:566`](../app.js:566))
3. ✅ **Add user-friendly error notifications** — done via the inline `Toast`
   ([`app.js:741`](../app.js:741)), **not** via `js/core/notification.js`
4. ✅ **Implement loading states** — done via the inline `LoadingIndicator`
   ([`app.js:873`](../app.js:873))
5. ⏭️ **Add comprehensive testing** for error scenarios
6. ⏭️ **Harvest-then-delete `js/core/`** — lift the backup / export / import code out of
   `storage.js` and the schema validation out of `validator.js`, then remove the four
   unused modules and their `<script>` tags from
   [`index.html:356-359`](../index.html:356)

---

## 🔗 Related Files

- [`js/core/error-handler.js`](../js/core/error-handler.js:1) - Error handling utility (⚠️ unused)
- [`js/core/validator.js`](../js/core/validator.js:1) - Validation and sanitization (⚠️ unused)
- [`js/core/storage.js`](../js/core/storage.js:1) - Safe storage operations (⚠️ unused)
- [`js/core/notification.js`](../js/core/notification.js:1) - Toast / loading / dialog managers (⚠️ unused)
- [`app.js`](../app.js:1) - Main application file; contains the helpers actually in use
- [`docs/FOLDER_STRUCTURE.md`](FOLDER_STRUCTURE.md:1) - Same status note, from the file-layout angle

---

**Not implemented.** This document is retained as a design record and as a warning: do
not wire `js/core/` up on the strength of the examples above, and do not delete those
files before the wanted code has been harvested out of them.