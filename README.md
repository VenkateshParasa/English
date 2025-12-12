# 🎓 English Learning Portal

An interactive web application for learning English with unlimited practice exercises, featuring vocabulary building, sentence formation, reading comprehension, listening exercises, and educational puzzles.

## ✨ Features

- 📚 **Vocabulary Learning** - Unlimited words with definitions, pronunciations, and quizzes
- 📝 **Sentence Exercises** - 44+ million unique sentence combinations
- 📖 **Reading Passages** - Unlimited passages with comprehension questions
- 🎧 **Listening Practice** - Unlimited audio exercises with speech recognition
- 🧩 **Educational Puzzles** - Word search, scramble, crossword, and matching games
- 💾 **Offline Support** - Works without internet connection (PWA)
- 📊 **Progress Tracking** - Save your learning progress automatically
- 🎯 **Three Difficulty Levels** - Basic, Intermediate, and Medium

## 🚀 Quick Start

### Option 1: Install Dependencies and Run

```bash
# Install http-server
npm install

# Start the application
npm start
```

The app will automatically open in your browser at `http://localhost:3000`

### Option 2: Run Without Installation

```bash
# Using npx (no installation needed)
npx http-server -p 3000 -o
```

### Option 3: Python Server

```bash
# Using Python 3
python3 -m http.server 8000

# Open browser to: http://localhost:8000
```

## 📦 Available Scripts

```bash
npm start          # Start development server (port 3000, auto-open)
npm run dev        # Same as start
npm run serve      # Start server on port 8080
npm test           # Start test server on port 8000
```

## 🌐 Deployment

### Quick Deploy to GitHub Pages

```bash
# 1. Initialize git and push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/english-learning.git
git push -u origin main

# 2. Enable GitHub Pages
# Go to: Repository Settings → Pages → Source: main branch → Save

# Your site will be live at:
# https://YOUR_USERNAME.github.io/english-learning/
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

## 📱 Progressive Web App (PWA)

This application can be installed as a standalone app:

1. Open the site in Chrome/Edge
2. Click the "Install" icon in the address bar
3. Use it like a native app with offline support!

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with modern features
- **APIs**: 
  - Free Dictionary API (word definitions)
  - Web Speech API (text-to-speech & speech recognition)
- **PWA**: Service Worker for offline functionality
- **Storage**: LocalStorage for progress tracking

## 📂 Project Structure

```
English/
├── index.html              # Main HTML file
├── app.js                  # Core application logic
├── data.js                 # Exercise data and content
├── style.css               # Styling
├── service-worker.js       # PWA offline support
├── manifest.json           # PWA configuration
├── package.json            # Dependencies and scripts
├── css/                    # Additional stylesheets
├── js/                     # JavaScript modules
├── docs/                   # Documentation
└── icons/                  # App icons
```

## 🎯 How It Works

### Unlimited Content Generation

The app uses a **hybrid approach** combining:
1. **Curated Content** - Hand-crafted quality exercises
2. **Algorithmic Generation** - Unlimited variations using templates
3. **Smart Alternation** - Balances quality and variety

**Example: Sentence Generation**
- Basic Level: 50 words × 5 templates = 31.25 million sentences
- Intermediate: 40 words × 5 templates = 12.8 million sentences
- Medium: 10 words × 5 templates = 10,000 sentences

### Features with Unlimited Content

✅ Sentence Exercises (44M+ combinations)
✅ Listening Exercises (unlimited)
✅ Reading Passages (unlimited)
✅ Vocabulary Words (unlimited)
✅ Word Scramble (unlimited)
✅ Word Matching (unlimited)

## 📖 Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Detailed deployment instructions
- [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md) - Architecture and implementation
- [User Guide](docs/USER_GUIDE.md) - How to use the application
- [Folder Structure](docs/FOLDER_STRUCTURE.md) - Project organization

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

MIT License - feel free to use this project for learning and teaching!

## 🙏 Acknowledgments

- Free Dictionary API for word definitions
- Web Speech API for audio features
- All contributors and users

## 📞 Support

For issues or questions:
1. Check the [documentation](docs/)
2. Review [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
3. Open an issue on GitHub

---

**Happy Learning! 📚✨**

Made with ❤️ for English learners worldwide