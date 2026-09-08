# 📁 Project Folder Structure

## Current Organization

```
English-Learning-Portal/
├── 📄 Root Files
│   ├── index.html                          # Main HTML file
│   ├── app.js                              # Main application logic (legacy - to be refactored)
│   ├── data.js                             # Learning content data
│   ├── styles.css                          # Main styles
│   ├── performance.css                     # Performance-related styles
│   ├── manifest.json                       # PWA manifest
│   ├── service-worker.js                   # Service worker for offline support
│   ├── package.json                        # NPM dependencies
│   └── .gitignore                          # Git ignore rules
│
├── 📂 css/                                 # Stylesheets
│   └── notifications.css                   # Toast, loading, dialog styles
│
├── 📂 js/                                  # JavaScript modules
│   └── core/                               # Core utilities
│       ├── error-handler.js                # ⚠️ UNUSED - error handling with retry logic
│       ├── validator.js                    # ⚠️ UNUSED - input validation & sanitization
│       ├── storage.js                      # ⚠️ UNUSED - safe localStorage operations
│       └── notification.js                 # ⚠️ UNUSED - toast, loading, dialog managers
│
├── 📂 __tests__/                           # Test files
│   ├── README.md                           # Testing documentation
│   ├── setup.js                            # Test setup configuration
│   ├── unit/                               # Unit tests
│   │   ├── errorHandler.test.js
│   │   ├── keyboardNavigation.test.js
│   │   ├── loadingIndicator.test.js
│   │   └── toast.test.js
│   └── integration/                        # Integration tests
│       └── userFlows.test.js
│
├── 📂 docs/                                # Documentation
│   ├── README.md                           # Main project documentation
│   ├── USER_GUIDE.md                       # User guide
│   ├── TECHNICAL_DOCUMENTATION.md          # Technical details
│   ├── ERROR_HANDLING_GUIDE.md             # Error handling usage guide
│   ├── CHANGELOG.md                        # Version history
│   └── FOLDER_STRUCTURE.md                 # This file
│
├── 📂 .github/                             # GitHub configuration
│   └── workflows/                          # CI/CD workflows
│
└── 📂 .claude/                             # Claude AI configuration
```

---

## 📋 File Reference Guide

### HTML Files
- **[`index.html`](../index.html:1)** - Main application entry point

### CSS Files
- **[`styles.css`](../styles.css:1)** - Main application styles
- **[`performance.css`](../performance.css:1)** - Performance optimizations
- **[`css/notifications.css`](../css/notifications.css:1)** - Notification system styles

### JavaScript Files

#### Core Application
- **[`app.js`](../app.js:1)** - Main application logic (~3,160 lines)
- **[`data.js`](../data.js:1)** - Learning content and curriculum data

App-level helpers live *inside* `app.js` and are what the running application
actually uses:

| Helper | Defined at | Purpose |
|--------|-----------|---------|
| `AppErrorHandler` | [`app.js:566`](../app.js:566) | Error classification, logging, retry-with-backoff |
| `Toast` | [`app.js:741`](../app.js:741) | Toast notifications (`success` / `error` / `warning` / `info`) |
| `LoadingIndicator` | [`app.js:873`](../app.js:873) | Full-screen loading overlay |

#### Core Utilities (⚠️ loaded but NOT wired up)
- **[`js/core/error-handler.js`](../js/core/error-handler.js:1)** - Error handling (357 lines)
- **[`js/core/validator.js`](../js/core/validator.js:1)** - Validation (396 lines)
- **[`js/core/storage.js`](../js/core/storage.js:1)** - Storage management (426 lines)
- **[`js/core/notification.js`](../js/core/notification.js:1)** - Notifications (508 lines)

> **⚠️ Status note — read before touching these four files**
>
> These modules are loaded by [`index.html`](../index.html:356) on every page load but
> **nothing in the application calls them**. `app.js` contains no reference to
> `errorHandler`, `notificationManager`, `loadingManager`, `Validator` or
> `StorageManager` — only two stale comments that mention `ErrorHandler` by name
> ([`app.js:939`](../app.js:939), [`app.js:959`](../app.js:959)).
>
> - `class StorageManager` and `class Validator` are **never instantiated anywhere**.
> - `js/core/error-handler.js:326` and `js/core/notification.js:497-498` create the
>   singletons `errorHandler`, `notificationManager` and `loadingManager` inside
>   their own files, but no other file consumes them.
>
> **Do not wire them up** as a "fix", and **do not delete them wholesale** either.
> They are scheduled for a *harvest-then-delete*: the backup/export/import code in
> `storage.js` and the schema-validation code in `validator.js` are wanted and will
> be lifted out first; the surrounding class shells are not. Roughly 1,687 lines are
> currently downloaded and parsed on every page load, with almost nothing in them running.
>
> **Two exceptions that do run at load time** — preserve or replace these before deleting:
>
> 1. `js/core/error-handler.js:332` / `:341` register live `window` listeners for `error`
>    and `unhandledrejection`, so uncaught errors *are* captured and persisted to the
>    `errorLog` localStorage key. This is the app's only global error capture.
> 2. `notificationManager`'s constructor calls `init()`
>    ([`js/core/notification.js:17`](../js/core/notification.js:17)), which appends
>    `<div id="toast-container">` and `<div id="sr-announcer">` to `document.body` —
>    duplicating the `toast-container` class already used by `app.js`'s own
>    `<div id="toastContainer">` ([`app.js:751`](../app.js:751)).
>
> See [`ERROR_HANDLING_GUIDE.md`](ERROR_HANDLING_GUIDE.md:1) for the full design record.

#### PWA Files
- **[`service-worker.js`](../service-worker.js:1)** - Service worker for offline support
- **[`manifest.json`](../manifest.json:1)** - PWA manifest

---

## 🔗 Integration Paths

### In HTML (`index.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>English Learning Portal</title>
    
    <!-- Stylesheets -->
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="css/animations.css">
    <link rel="stylesheet" href="css/accessibility.css">
    <link rel="stylesheet" href="performance.css">
    <link rel="stylesheet" href="css/notifications.css">
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="manifest.json">
</head>
<body>
    <!-- Application content -->
    
    <!-- Core Utilities (loaded first — but see the status note above:
         the first four are currently unused by the application) -->
    <script src="js/core/error-handler.js"></script>
    <script src="js/core/validator.js"></script>
    <script src="js/core/storage.js"></script>
    <script src="js/core/notification.js"></script>
    <script src="js/core/levels.js"></script>
    <script src="js/core/migrations.js"></script>
    <script src="js/core/srs.js"></script>
    <script src="js/theme-toggle.js"></script>
    <script src="js/ui-enhancements.js"></script>
    
    <!-- Application Data & Logic -->
    <script src="data.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

### In JavaScript

**What the app actually does today.** All three helpers are plain object literals
declared inside [`app.js`](../app.js:1) — there is nothing to construct:

```javascript
// Error handling (AppErrorHandler, app.js:566)
AppErrorHandler.logError(e, 'save progress');
AppErrorHandler.handleError(error, `word "${word}"`, { showToast: true });
const data = await AppErrorHandler.retryWithBackoff(fetchFn, 3, 1000, 'word lookup');

// Toasts (Toast, app.js:741 — also exported as window.Toast at app.js:867)
Toast.success('Progress saved');
Toast.error('Failed to load word. Please try again.');

// Loading overlay (LoadingIndicator, app.js:873 — window.LoadingIndicator at app.js:927)
LoadingIndicator.show('vocabulary', 'Loading word...');
LoadingIndicator.hide('vocabulary');
```

> **⚠️ Aspirational only — not currently wired up.** The design below was the
> original intent for `js/core/`. It is recorded here for whoever does the
> harvest-then-delete pass, **not as working usage** — no file in the app performs
> this wiring. Note also that every `Validator` member is `static`
> ([`js/core/validator.js:12-392`](../js/core/validator.js:12)), so `new Validator()`
> would produce an object with no usable methods.
>
> ```javascript
> // ⚠️ DOES NOT EXIST IN THE CODEBASE — aspirational design, do not copy as-is
> const validator = new Validator();
> const storage = new StorageManager(errorHandler, validator);
>
> notificationManager.success('Operation completed!');
> loadingManager.show('#container', 'Loading...');
> ```

---

## 📊 File Size Summary

Measured 2026-09-08. The previous figures in this table were badly out of date.

| Category | Files | Total Lines | Size |
|----------|-------|-------------|------|
| **Application** (`app.js`, `data.js`) | 2 | 4,235 | ~188 KB |
| **Core Utilities** (⚠️ unused) | 4 | 1,687 | ~60 KB |
| **Other `js/` modules** (`levels`, `migrations`, `srs`, `theme-toggle`, `ui-enhancements`) | 5 | 646 | ~32 KB |
| **Styles** | 5 | 3,646 | ~80 KB |
| **Documentation** (`docs/*.md`) | 14 | 6,528 | ~328 KB |
| **Tests** (`__tests__/**/*.js`) | 10 | 2,995 | ~124 KB |
| **Total** | 40 | 19,737 | ~812 KB |

The ⚠️ unused row is ~60 KB of dead JavaScript shipped and parsed on every page load.

---

## 🎯 Recommended Future Structure

For better scalability, consider this modular structure:

```
English-Learning-Portal/
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── assets/
│       ├── icons/
│       └── images/
│
├── src/
│   ├── css/
│   │   ├── main.css
│   │   ├── components/
│   │   │   ├── notifications.css
│   │   │   ├── cards.css
│   │   │   └── buttons.css
│   │   └── utilities/
│   │       └── performance.css
│   │
│   ├── js/
│   │   ├── core/
│   │   │   ├── error-handler.js
│   │   │   ├── validator.js
│   │   │   ├── storage.js
│   │   │   └── notification.js
│   │   │
│   │   ├── features/
│   │   │   ├── vocabulary/
│   │   │   ├── sentences/
│   │   │   ├── reading/
│   │   │   ├── listening/
│   │   │   └── puzzles/
│   │   │
│   │   ├── utils/
│   │   │   ├── helpers.js
│   │   │   ├── constants.js
│   │   │   └── api.js
│   │   │
│   │   ├── data/
│   │   │   └── curriculum.js
│   │   │
│   │   └── app.js
│   │
│   └── service-worker.js
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── README.md
│   ├── USER_GUIDE.md
│   ├── TECHNICAL_DOCUMENTATION.md
│   └── API_REFERENCE.md
│
└── config/
    ├── jest.config.js
    └── webpack.config.js
```

---

## 📝 Path Reference Quick Guide

### Current Paths (Use These)

| Resource | Path |
|----------|------|
| Main HTML | `index.html` |
| Main CSS | `styles.css` |
| Performance CSS | `performance.css` |
| Notifications CSS | `css/notifications.css` |
| Main App JS | `app.js` |
| Data JS | `data.js` |
| Error Handler | `js/core/error-handler.js` (⚠️ unused) |
| Validator | `js/core/validator.js` (⚠️ unused) |
| Storage Manager | `js/core/storage.js` (⚠️ unused) |
| Notification Manager | `js/core/notification.js` (⚠️ unused) |
| Service Worker | `service-worker.js` |
| PWA Manifest | `manifest.json` |

### Documentation Paths

| Document | Path |
|----------|------|
| Main README | `docs/README.md` |
| User Guide | `docs/USER_GUIDE.md` |
| Technical Docs | `docs/TECHNICAL_DOCUMENTATION.md` |
| Error Handling Guide | `docs/ERROR_HANDLING_GUIDE.md` |
| Changelog | `docs/CHANGELOG.md` |
| Folder Structure | `docs/FOLDER_STRUCTURE.md` |

---

## ✅ Path Verification

All paths in the documentation have been updated to reflect the current structure:

- ✅ HTML script tags use correct paths
- ✅ CSS link tags use correct paths
- ✅ Documentation references use correct paths
- ✅ All file links are clickable and accurate
- ✅ Relative paths are consistent

---

## 🚀 Quick Start

1. **Open** [`index.html`](../index.html:1) in your browser
2. **Or** run a local server:
   ```bash
   npx http-server -p 3000 -o
   ```
3. **Check** [`ERROR_HANDLING_GUIDE.md`](ERROR_HANDLING_GUIDE.md:1) for the `js/core/`
   design record — note that its integration steps were **never carried out**; the
   guide's own status banner explains what the app really does

---

**Last Updated:** 2026-09-08 (corrected the `js/core/` wiring claims — see the status
note under *Core Utilities*)
**Structure Version:** 2.2 (Streamlined documentation - essential files only)