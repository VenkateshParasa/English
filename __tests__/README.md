# Testing Documentation

## Running Tests

This project uses Jest for unit and integration testing.

### Prerequisites

1. Install Node.js (v14 or higher)
2. Install dependencies:
   ```bash
   npm install
   ```

### Test Commands

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Generate coverage report in multiple formats
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

### Test Structure

```
__tests__/
├── setup.js                         # Global test configuration
├── unit/                            # Unit tests
│   ├── errorHandler.test.js         # ErrorHandler tests
│   ├── toast.test.js                # Toast notification tests
│   ├── loadingIndicator.test.js    # LoadingIndicator tests
│   └── keyboardNavigation.test.js   # KeyboardNavigation tests
└── integration/                      # Integration tests
    └── userFlows.test.js            # End-to-end user flow tests
```

### Coverage Thresholds

The project enforces the following minimum coverage thresholds:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Viewing Coverage Reports

After running tests with coverage:

```bash
# Open HTML coverage report in browser
open coverage/index.html    # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html    # Windows
```

## Test Descriptions

### Unit Tests

#### ErrorHandler Tests (80+ tests)
- Error classification (network, timeout, API, validation, storage, permission)
- User-friendly error message generation
- Error logging to sessionStorage
- Retry logic with exponential backoff
- Input validation and sanitization
- XSS prevention

#### Toast Notification Tests (60+ tests)
- Toast initialization and display
- Multiple toast types (success, error, warning, info)
- Auto-dismissal and manual close
- Queue management (max 3 active toasts)
- Accessibility (ARIA attributes)
- Message sanitization

#### LoadingIndicator Tests (50+ tests)
- Loading overlay display/hide
- Multiple concurrent operation tracking
- Custom loading messages
- ARIA attributes for screen readers
- Async operation handling

#### KeyboardNavigation Tests (70+ tests)
- Arrow key navigation (left/right)
- Global shortcuts (Alt+1-6, Ctrl+S)
- Escape key handling
- Input focus detection
- Skip to main content link
- Focus management and indicators
- Focus trap for modal overlays

### Integration Tests

#### User Flow Tests
- Complete vocabulary learning flow
- Sentence formation with validation
- Error recovery scenarios
- Multi-component interactions

## Mocking

The test suite includes comprehensive mocks for:

- `localStorage` and `sessionStorage`
- `navigator.onLine` for offline testing
- `fetch` API for network requests
- `speechSynthesis` for audio features
- DOM elements and interactions

## Best Practices

1. **Run tests before committing**: Ensure all tests pass
2. **Maintain coverage**: Keep coverage above thresholds
3. **Write tests for new features**: Add tests when adding new functionality
4. **Test edge cases**: Include tests for error conditions and edge cases
5. **Keep tests isolated**: Each test should be independent

## Troubleshooting

### Tests fail with "Cannot find module"
```bash
npm install
```

### Coverage below threshold
Check which files need more test coverage:
```bash
npm test -- --coverage --verbose
```

### Tests timeout
Increase Jest timeout in package.json or individual tests:
```javascript
jest.setTimeout(10000);
```

## Continuous Integration

Tests are designed to run in CI/CD environments. Configure your CI to run:

```bash
npm install
npm test
```

## Future Enhancements

- E2E tests with Playwright/Cypress
- Visual regression testing
- Performance testing
- Accessibility testing with axe-core
- API contract testing
