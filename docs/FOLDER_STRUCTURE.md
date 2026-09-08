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
│       ├── error-handler.js                # Error handling with retry logic
│       ├── validator.js                    # Input validation & sanitization
│       ├── storage.js                      # Safe localStorage operations
│       └── notification.js                 # Toast, loading, dialog managers
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
- **[`app.js`](../app.js:1)** - Main application logic (1689 lines)
- **[`data.js`](../data.js:1)** - Learning content and curriculum data

#### Core Utilities (New)
- **[`js/core/error-handler.js`](../js/core/error-handler.js:1)** - Error handling (348 lines)
- **[`js/core/validator.js`](../js/core/validator.js:1)** - Validation (385 lines)
- **[`js/core/storage.js`](../js/core/storage.js:1)** - Storage management (429 lines)
- **[`js/core/notification.js`](../js/core/notification.js:1)** - Notifications (485 lines)

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
    <link rel="stylesheet" href="performance.css">
    <link rel="stylesheet" href="css/notifications.css">
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="manifest.json">
</head>
<body>
    <!-- Application content -->
    
    <!-- Core Utilities (Load first) -->
    <script src="js/core/error-handler.js"></script>
    <script src="js/core/validator.js"></script>
    <script src="js/core/storage.js"></script>
    <script src="js/core/notification.js"></script>
    
    <!-- Application Data & Logic -->
    <script src="data.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

### In JavaScript

```javascript
// Importing utilities (they're globally available after script load)
const validator = new Validator();
const storage = new StorageManager(errorHandler, validator);

// Using notification system
notificationManager.success('Operation completed!');
loadingManager.show('#container', 'Loading...');
```

---

## 📊 File Size Summary

| Category | Files | Total Lines | Size |
|----------|-------|-------------|------|
| **Core Utilities** | 4 | 1,647 | ~65 KB |
| **Styles** | 3 | ~2,400 | ~80 KB |
| **Application** | 2 | ~2,400 | ~95 KB |
| **Documentation** | 6 | ~2,500 | ~100 KB |
| **Tests** | 5 | ~500 | ~20 KB |
| **Total** | 20 | ~11,000 | ~380 KB |

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
| Error Handler | `js/core/error-handler.js` |
| Validator | `js/core/validator.js` |
| Storage Manager | `js/core/storage.js` |
| Notification Manager | `js/core/notification.js` |
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
3. **Check** [`ERROR_HANDLING_GUIDE.md`](ERROR_HANDLING_GUIDE.md:1) for integration steps

---

**Last Updated:** 2025-12-12
**Structure Version:** 2.1 (Streamlined documentation - essential files only)