# 🎓 English Learning Portal

An interactive web-based English learning application featuring vocabulary practice, sentence formation, reading comprehension, listening exercises, and educational puzzles. Built with vanilla JavaScript and integrated with the Free Dictionary API and Web Speech API.

## ✨ Features

### 📚 Vocabulary Practice
- Three difficulty levels: Basic, Intermediate, and Medium
- Interactive word cards with pronunciations and definitions
- Quiz-based learning with multiple-choice questions
- Text-to-speech pronunciation support
- Progress tracking for daily vocabulary goals

### ✍️ Sentence Formation
- Multiple exercise types:
  - Drag-and-drop word arrangement
  - Fill-in-the-blank exercises
  - Multiple-choice sentence selection
  - Word reordering challenges
- Smart hint system (available after 3 attempts)
- Real-time feedback on answers
- Unlimited generated exercises

### 📖 Reading & Dictation
- Curated reading passages at different difficulty levels
- Comprehension questions with instant feedback
- Text-to-speech with playback controls (play, pause, resume, stop, replay)
- Dictation practice exercises
- Progress tracking for completed passages

### 🎧 Listening & Speaking
- Listen and repeat exercises
- Voice recording with playback functionality
- Speech recognition practice
- Native pronunciation examples
- Interactive speaking challenges

### 🧩 Puzzles & Games
- **Word Search**: Find hidden words in a grid
- **Crossword**: Mini crossword puzzles
- **Word Scramble**: Unscramble letters with hints
- **Word Matching**: Match words with their meanings

### 📊 Progress Tracking
- Daily goals checklist
- Overall statistics dashboard
- Daily vs. average performance comparison
- Streak tracking (current and best)
- Detailed progress metrics for all activities
- Persistent progress storage using localStorage

## 🛡️ Robustness & Quality Features (Phase 1 & 2 Complete)

### Error Handling & Validation
- **Smart Retry Logic**: Automatic retry with exponential backoff for failed API calls
- **Graceful Degradation**: Seamless fallback to offline data when API is unavailable
- **Input Validation**: Real-time validation with user-friendly error messages
- **XSS Prevention**: All user inputs are sanitized to prevent security vulnerabilities
- **Error Logging**: Debugging support with error logs in sessionStorage

### User Feedback Systems
- **Toast Notifications**: 4 types (success, error, warning, info) with auto-dismiss
- **Loading Indicators**: Visual feedback for all async operations
- **Progress Indicators**: Real-time status updates during operations
- **Accessible Feedback**: Screen reader compatible notifications

### Accessibility (WCAG 2.1 AA Compliant)
- **Keyboard Navigation**: Full keyboard support with shortcuts
  - `Alt + 1-6`: Navigate between sections
  - `Arrow Left/Right`: Navigate exercises
  - `Ctrl + S`: Save progress
  - `Escape`: Close toasts or return to dashboard
- **ARIA Labels**: Comprehensive labels for all interactive elements
- **Screen Reader Support**: All content accessible to assistive technologies
- **Focus Management**: Visible focus indicators and skip links
- **High Contrast**: Proper color contrast for readability

### Security Hardening
- **Input Sanitization**: All user inputs cleaned to prevent XSS attacks
- **HTML Escaping**: Safe rendering of dynamic content
- **Content Security**: No use of dangerous JavaScript patterns
- **Data Validation**: Strict validation rules for all user inputs

### Testing & Quality Assurance
- **260+ Unit Tests**: Comprehensive test coverage
  - ErrorHandler: 80+ tests
  - Toast System: 60+ tests
  - LoadingIndicator: 50+ tests
  - KeyboardNavigation: 70+ tests
- **40+ Integration Tests**: Real user flow scenarios
- **70% Code Coverage**: Enforced minimum coverage threshold
- **Automated Testing**: Jest framework with jsdom environment
- **CI/CD Ready**: Test suite ready for continuous integration
All robustness features have been fully implemented and are production-ready.


## 🚀 Getting Started

### Prerequisites
- Modern web browser with JavaScript enabled
- Internet connection (for API features, offline fallback available)
- Microphone access (for speech recognition features)
- Node.js (v14+) for running tests (optional)

### Installation

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Start learning!

#### For Developers (Testing)
```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode (auto-rerun on changes)
npm run test:watch
```

No build process required for the application - it's pure HTML/CSS/JavaScript!

## 📁 Project Structure

```
English-Learning-Portal/
├── index.html                      # Main HTML structure
├── styles.css                      # All styling and responsive design
├── app.js                          # Application logic and functionality
├── data.js                         # Learning content and curriculum data
├── package.json                    # Dependencies and test scripts
├── docs/                           # Documentation
│   ├── README.md                   # This file
│   ├── USER_GUIDE.md               # User guide
│   ├── TECHNICAL_DOCUMENTATION.md  # Technical details
│   ├── ERROR_HANDLING_GUIDE.md     # Error handling guide
│   ├── CHANGELOG.md                # Version history
│   └── FOLDER_STRUCTURE.md         # Project structure
└── __tests__/                      # Test suite
    ├── setup.js                    # Test configuration
    ├── README.md                   # Testing documentation
    ├── unit/                       # Unit tests (260+ tests)
    │   ├── errorHandler.test.js
    │   ├── toast.test.js
    │   ├── loadingIndicator.test.js
    │   └── keyboardNavigation.test.js
    └── integration/                # Integration tests (40+ tests)
        └── userFlows.test.js
```

## 🎯 Usage

### Navigation
- Use the top navigation bar to switch between different learning sections
- Select difficulty levels using the buttons at the top of each section
- Navigate through exercises using Previous/Next buttons

### Vocabulary Section
1. View word cards with definitions and examples
2. Click "🔊 Pronounce" to hear the word
3. Answer quiz questions to test your knowledge
4. Track your progress (0/10 words per session)

### Sentence Formation
1. Choose from various exercise types (randomly selected)
2. Complete the exercise by arranging words or filling blanks
3. Click "Check Answer" to verify your response
4. Use hints after 3 incorrect attempts
5. Navigate to next exercise when ready

### Reading Section
1. Read the passage carefully
2. Use audio controls to listen to the text
3. Answer comprehension questions
4. Practice dictation by typing what you hear

### Listening Section
1. Click "Play" to hear the sentence
2. Record your voice repeating the sentence
3. Replay your recording to compare
4. Practice speech recognition with target words

### Puzzles
1. Select a puzzle type from the available options
2. Complete the puzzle according to its rules
3. Generate new puzzles as needed

## 🔧 Technical Details

### APIs Used
- **Free Dictionary API**: Fetches word definitions, pronunciations, and examples
- **Web Speech API**: Provides text-to-speech and speech recognition

### Browser Compatibility
- Chrome/Edge: Full support (recommended)
- Firefox: Full support
- Safari: Partial support (speech recognition may be limited)

### Offline Support
- Automatic fallback to local data when API is unavailable
- All core features work offline
- Progress saved locally using localStorage

### Data Persistence
- Progress automatically saved every 30 seconds
- Daily statistics tracked and compared
- Streak tracking across sessions
- Exercise completion history maintained

## 🎨 Customization

### Adding New Content

#### Vocabulary Words
Edit [`data.js`](data.js:1) and add entries to the `vocabularyData` object:

```javascript
{
    word: "Example",
    pronunciation: "/ɪɡˈzæmpl/",
    definition: "A thing characteristic of its kind",
    example: "This is an example sentence.",
    quiz: {
        question: "What does 'example' mean?",
        options: ["Option1", "Option2", "Option3", "Option4"],
        correct: 0
    }
}
```

#### Sentence Exercises
Add to `sentenceExercises` in [`data.js`](data.js:342):

```javascript
{
    words: ["word1", "word2", "word3"],
    correct: "word1 word2 word3",
    fillBlank: {
        sentence: "word1 ___ word3",
        answer: "word2",
        options: ["word2", "other1", "other2", "other3"]
    }
}
```

#### Reading Passages
Add to `readingPassages` in [`data.js`](data.js:486):

```javascript
{
    title: "Passage Title",
    text: "Full passage text here...",
    questions: [
        {
            question: "Question text?",
            options: ["A", "B", "C", "D"],
            correct: 0
        }
    ],
    dictation: "Sentence for dictation practice."
}
```

### Styling
Modify [`styles.css`](styles.css:1) to customize:
- Color scheme (gradient backgrounds)
- Font sizes and families
- Layout and spacing
- Responsive breakpoints

## 📈 Progress System

### Daily Goals
Complete at least one activity from each category:
- ✅ Vocabulary Practice
- ✅ Sentence Formation
- ✅ Reading Exercise
- ✅ Listening Practice
- ✅ Puzzle Activity

### Statistics Tracked
- Words learned (daily and total)
- Sentences completed
- Reading exercises finished
- Listening practices done
- Puzzles solved
- Current and best streaks
- Daily averages

## 🐛 Troubleshooting

### Speech Features Not Working
- Ensure microphone permissions are granted
- Check browser compatibility (Chrome/Edge recommended)
- Verify HTTPS connection (required for speech recognition)

### Progress Not Saving
- Check browser localStorage is enabled
- Ensure cookies/site data are not being cleared
- Try a different browser if issues persist

### API Errors
- Application automatically falls back to offline data
- Check internet connection for API features
- Rate limiting may occur with excessive API calls

## 🤝 Contributing

This is an educational project. Feel free to:
- Add more vocabulary words and exercises
- Improve the UI/UX design
- Add new exercise types
- Enhance accessibility features
- Fix bugs and improve performance

## 📄 License

This project is open source and available for educational purposes.

## 🙏 Acknowledgments

- **Free Dictionary API** for word definitions
- **Web Speech API** for text-to-speech and speech recognition
- Educational content curated for progressive learning

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the code comments in [`app.js`](app.js:1)
3. Ensure all files are in the same directory

---

**Happy Learning! 🎓📚**

Start your English learning journey today and track your progress as you improve!