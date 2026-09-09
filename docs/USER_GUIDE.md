# 📖 User Guide - English Learning Portal

Welcome to the English Learning Portal! This guide will help you make the most of your learning experience.

## 🎯 Getting Started

### First Time Setup

1. **Open the Application**

   The portal needs to be served by a web server — over `http://` or `https://`. If you double-click [`index.html`](index.html:1) and it opens as `file:///…`, the app icons and the offline support will not load. It is an easy mistake to make, and nothing is wrong with your setup.

   From the project folder, run:

   ```bash
   npm install   # once — this fetches the small local web server
   npm start     # serves the portal on http://localhost:3000 and opens your browser
   ```

   If you would rather it did not open a browser tab for you, `npm run serve` does the same thing on http://localhost:8080. Either one is fine.

   You can also just visit a deployed copy of the site, if someone has hosted it for you.

   No account and no registration are needed — only the local server.

2. **Grant Microphone Permission** (Optional but Recommended)
   - Your browser will ask the first time you use the recording or speech-recognition exercises
   - Those two features need a secure page: `https://`, or `http://localhost`, which is what `npm start` gives you

3. **Start Learning**
   - Your progress is automatically saved
   - You can close and reopen anytime without losing progress

## 📊 Dashboard Overview

The Dashboard is your learning hub showing:

### Statistics Cards
- **📚 Words Learned**: Vocabulary words you've worked through
- **✍️ Sentences Completed**: Number of sentence exercises finished
- **📖 Reading Exercises**: Reading passages you've completed
- **🧩 Puzzles Solved**: Total puzzles you've successfully solved

### Daily Goals
Complete at least one activity from each category daily:
- ✅ Vocabulary Practice
- ✅ Sentence Formation
- ✅ Reading Exercise
- ✅ Listening Practice
- ✅ Puzzle Activity

### Progress Bar
Shows your overall completion percentage for today's goals.

### Statistics Sections

#### 📅 Today's Progress
- Shows today's count for Words, Sentences, Reading, Listening and Puzzles
- Compares each one with your daily average
- Green badges (⬆️) mean you're above average
- Orange badges (⬇️) mean below average
- ➡️ means you're right at your average
- In your first days there is no average yet, so no badge appears — that's expected

#### 📊 Overall Statistics
- Total days of learning
- Current streak (consecutive days)
- Best streak achieved
- Total words
- Total exercises (sentences, reading, listening and puzzles added together)

#### 📈 Daily Averages
- Your per-day average for each of the five activities
- Helps you set realistic goals

## 📚 Vocabulary Section

### How to Use

1. **Select Difficulty Level**
   - **Basic**: Common everyday words
   - **Intermediate**: More complex vocabulary
   - **Medium**: Advanced words and concepts

2. **Study the Word Card**
   - **Word**: The vocabulary word in large text
   - **Pronunciation**: Phonetic spelling (e.g., /ˈhæpi/) — this line is hidden for the extra practice words, which don't have one
   - **Definition**: Clear explanation of meaning
   - **Example**: Word used in context

3. **Listen to Pronunciation**
   - Click "🔊 Pronounce" button
   - Hear the word and definition read aloud
   - Listen multiple times if needed

4. **Test Your Knowledge**
   - Answer the multiple-choice quiz question
   - Click an option to select your answer
   - Immediate feedback (green = correct, red = incorrect)
   - Correct answer highlighted if you're wrong

5. **Track Progress**
   - Progress shown as "X/10" (aim for 10 words per session)
   - Use "Next →" to move to the next word
   - Use "← Previous" to review earlier words

### Reviewing Words You've Seen

Above the word card there's a "🔁 Review Due (N)" button. The number is how many of your earlier words are due for another look right now.

- Click it to work through just those words, one at a time
- Get one right and it leaves the queue; get it wrong and it comes back later in the same session, so you get another go
- The count beside the button tells you how many are left
- "✕ Exit Review" returns you to normal practice at any point
- If the count is zero there's nothing to review yet — learn a few new words and the queue will fill up on its own

This is the spaced repetition part, and it works offline.

### Tips for Success
- 💡 Read the example sentence carefully
- 💡 Try to use the word in your own sentence
- 💡 Review words you got wrong
- 💡 Practice pronunciation out loud

## ✍️ Sentence Formation

### Exercise Types

The exercises cycle through four types in turn, so you'll meet each one regularly:

#### 1. Drag and Drop
- **Goal**: Arrange words in correct order
- **How**: Click or drag words from the word bank
- **Tip**: Read all words first to understand the sentence

#### 2. Fill in the Blanks
- **Goal**: Complete the sentence with missing words
- **How**: Type the correct word in the blank space
- **Tip**: Consider grammar and context

#### 3. Multiple Choice
- **Goal**: Select the correctly formed sentence
- **How**: Choose from 4 options using radio buttons
- **Tip**: Read all options before selecting

#### 4. Word Reordering
- **Goal**: Click words in the correct sequence
- **How**: Click words one by one to build the sentence
- **Tip**: Think about sentence structure first

### Using the Hint System

After 3 incorrect attempts:
- 💡 A "Get Hint" button appears
- Click it to reveal one word's position
- Use hints wisely to learn, not just to pass

### Controls
- **Check Answer**: Verify your response
- **Reset**: Start the exercise over
- **← Previous**: Go to previous exercise
- **Next →**: Move to next exercise

### Progress Tracking
- ✓ Completed exercises marked with green checkmark
- ○ Incomplete exercises shown with circle
- Click "Retake" to practice completed exercises again

## 📖 Reading & Dictation

### Reading Passages

1. **Select Difficulty**
   - Basic: Short, simple passages
   - Intermediate: Longer, more complex texts
   - Medium: Advanced reading material

2. **Read the Passage**
   - Take your time to understand
   - Read multiple times if needed

3. **Use Audio Controls**
   - **▶️ Play**: Start reading aloud
   - **⏸️ Pause**: Pause the reading
   - **▶️ Resume**: Continue from where paused
   - **⏹️ Stop**: Stop completely
   - **🔄 Replay**: Start over from beginning

4. **Answer Comprehension Questions**
   - Multiple-choice questions about the passage
   - Select your answers using radio buttons
   - Click "Check Answers" when ready
   - Green background = correct, red = incorrect

### Dictation Practice

1. **Click "▶️ Play Audio"**
   - Listen to the sentence carefully
   - You can replay as many times as needed

2. **Type What You Hear**
   - Use the text area provided
   - Try to match exactly what you hear

3. **Check Your Answer**
   - Click "Check Answer"
   - See if your transcription is correct
   - Learn from any mistakes

### Tips
- 💡 Listen to the passage while reading along
- 💡 Look up unfamiliar words
- 💡 Try to summarize the passage in your own words
- 💡 For dictation, focus on spelling and punctuation

## 🎧 Listening & Speaking

### Listen and Repeat

1. **Click "🔊 Play"**
   - Hear the sentence spoken clearly
   - Listen carefully to pronunciation

2. **Record Your Voice**
   - Click "🎤 Record Your Voice"
   - Speak the sentence clearly
   - Click "⏹️ Stop" when finished

3. **Review Your Recording**
   - Click "🔄 Replay Recording"
   - Compare with the original
   - Practice until satisfied
   - Playback is reliable in Chrome and Edge. In Safari the recording is saved but usually won't play back, so use Chrome or Edge for this exercise.

### Speech Recognition Practice

1. **View Target Word**
   - A word is displayed in large text

2. **Click "🎤 Start Speaking"**
   - Say the word clearly
   - The system listens and writes down what it heard

3. **Get Feedback**
   - You'll see "The recogniser heard: …" with the words it picked up
   - If it caught everything, it says it understood every word and the exercise is marked complete
   - Otherwise it tells you how many words it missed and underlines them, so you can try just those again
   - Remember this is the recogniser's opinion, not a verdict on your English — background noise and accents both affect it

### Tips for Better Recognition
- 💡 Speak clearly and at normal pace
- 💡 Minimize background noise
- 💡 Position microphone properly
- 💡 Practice pronunciation first
- 💡 Don't shout or whisper

## 🧩 Puzzles & Games

### Word Search

**Goal**: Find all hidden words in the grid

**How to Play**:
1. Words are listed at the top
2. Click letters in the grid to select them
3. Words can be horizontal, vertical, or diagonal
4. Found words turn green and are crossed out
5. Click "New Puzzle" for a fresh challenge

**Tips**:
- 💡 Look for the first letter of each word
- 💡 Check all directions
- 💡 Start with shorter words

### Mini Crossword

The Mini Crossword is the newest and least finished of the puzzles. Right now it shows one fixed 8×8 grid with the same two clues every time, and "Check Answers" credits a puzzle towards today's goal without marking your letters right or wrong.

**How to Play**:
1. Read the clues under "Across" and "Down"
2. Click a cell to start typing
3. Type one letter per cell
4. Use Tab to move between cells
5. Click "Check Answers" when you're done, or "New Puzzle" to clear the grid

**Tips**:
- 💡 Because it doesn't grade your letters yet, treat it as a warm-up rather than a test
- 💡 If you want a puzzle that tells you whether you're right, Word Search, Word Scramble and Word Matching all do

### Word Scramble

**Goal**: Unscramble letters to form a word

**How to Play**:
1. View the scrambled letters
2. Type your answer in the input box
3. Click "Check" to verify
4. Click "Show Answer" if you're stuck — this reveals the complete word
5. Click "Next Word" for a new challenge

**Tips**:
- 💡 Look for common letter patterns
- 💡 Try different combinations
- 💡 "Show Answer" gives you the whole word, not a clue — so try a few guesses of your own first, then read the answer, then come back to that word later with "Next Word"

### Word Matching

**Goal**: Match words with their meanings

**How to Play**:
1. Click a word in the left column
2. Click its meaning in the right column
3. Correct matches turn green
4. Incorrect matches deselect automatically
5. Match all pairs to complete

**Tips**:
- 💡 Start with words you know
- 💡 Use process of elimination
- 💡 Read all options first

## 📈 Tracking Your Progress

### Daily Routine

**Recommended Daily Practice**:
1. **Morning** (15 minutes)
   - 5 vocabulary words
   - 2-3 sentence exercises

2. **Afternoon** (15 minutes)
   - 1 reading passage
   - Comprehension questions

3. **Evening** (15 minutes)
   - Listening practice
   - 1-2 puzzles

### Maintaining Your Streak

- 🔥 Practice every day to build your streak
- 🏆 Beat your best streak record
- 📅 Check dashboard daily for motivation
- ⭐ Complete all daily goals for maximum progress

### Setting Personal Goals

The app keeps your counts and your streak. Choosing what to aim for is up to you — here is a shape that works for many learners.

1. **Short-term** (Weekly)
   - Learn 20 new words
   - Complete 20 sentence exercises
   - Finish 3 reading passages

2. **Medium-term** (Monthly)
   - Maintain a 30-day streak
   - Spend a couple of weeks on one difficulty level before moving up
   - Improve your daily averages

3. **Long-term** (3-6 months)
   - Work comfortably at the Medium level
   - Achieve consistent high scores
   - Feel confident in English communication

## 🎓 Learning Strategies

### For Vocabulary
1. **Spaced Repetition**: Review words multiple times over days
2. **Context Learning**: Focus on example sentences
3. **Active Use**: Try using new words in conversation
4. **Visual Association**: Create mental images for words

### For Sentence Formation
1. **Pattern Recognition**: Notice common sentence structures
2. **Grammar Rules**: Understand why sentences are correct
3. **Practice Variety**: Try all exercise types
4. **Error Analysis**: Learn from mistakes

### For Reading
1. **Active Reading**: Take notes while reading
2. **Prediction**: Guess what comes next
3. **Summarization**: Recap in your own words
4. **Question Generation**: Ask yourself questions about the text

### For Listening
1. **Focused Listening**: Eliminate distractions
2. **Repetition**: Listen multiple times
3. **Shadowing**: Repeat immediately after hearing
4. **Recording Review**: Compare your pronunciation

## 🔧 Troubleshooting

### Audio Not Working
- ✅ Check browser audio settings
- ✅ Ensure volume is not muted
- ✅ Try refreshing the page
- ✅ Use Chrome or Edge for best compatibility

### Microphone Not Working
- ✅ Grant microphone permissions
- ✅ Check system microphone settings
- ✅ Test microphone in other apps
- ✅ Use an `https://` address, or `http://localhost` (needed for microphone and speech recognition)

### Progress Not Saving
- ✅ Enable cookies and local storage
- ✅ Don't use private/incognito mode
- ✅ Check browser storage settings
- ✅ Try a different browser

### Exercises Not Loading
- ✅ Check that you opened the portal from a `http://` or `https://` address, not as a `file:///…` path
- ✅ Refresh the page
- ✅ Clear browser cache
- ✅ Check internet connection (word definitions are looked up online for the hand-written vocabulary; the app falls back to its built-in text if the lookup fails)

## 💡 Best Practices

### Do's ✅
- Practice consistently every day
- Complete all daily goals
- Use audio features for pronunciation
- Review completed exercises
- Take breaks between sessions
- Track your progress regularly
- Challenge yourself with harder levels

### Don'ts ❌
- Don't rush through exercises
- Don't skip comprehension questions
- Don't rely only on hints
- Don't practice when tired
- Don't ignore pronunciation
- Don't forget to review mistakes

## 🎯 Milestones to Aim For

A note first, so nothing catches you out: the portal has no badges, trophies or achievement screen. What it does keep for you is the counters and streaks on the Dashboard — words, sentences, reading, listening, puzzles, current streak and best streak. Nothing below is awarded or unlocked by the app; these are simply sensible targets you can check against those counters yourself.

It also helps to know how much material there is. The hand-written content is 61 vocabulary words, 15 sentence exercises, 5 reading passages, 30 listening exercises, and 30 items each for the scramble and matching puzzles. Vocabulary, sentences, reading, listening and word matching all carry on past the end of that set — the app builds further practice from patterns, so you will never hit a wall, though you will start to notice familiar shapes. The scramble and word search draw from their fixed sets and simply come round again. Either way, repetition is not a dead end: it is how the words stick.

### First couple of weeks
- ✨ Work through 20 vocabulary words
- ✨ Finish 20 sentence exercises
- ✨ Read 5 passages
- ✨ Reach a 7-day streak

### First couple of months
- ⭐ Work through all 61 hand-written vocabulary words
- ⭐ Finish 100 sentence exercises
- ⭐ Re-read each passage until you can answer every question without looking back
- ⭐ Reach a 30-day streak

### Beyond that
- 🏆 Practise comfortably at the Medium level in every section
- 🏆 Pass 500 exercises on your Total Exercises counter
- 🏆 Reach a 90-day streak
- 🏆 Notice your daily averages holding steady rather than spiking

## 📞 Getting Help

### Common Questions

**Q: How long should I practice daily?**
A: Aim for 30-45 minutes split into 2-3 sessions.

**Q: What if I find a level too difficult?**
A: Drop down to an easier level and build confidence first.

**Q: Can I use this offline?**
A: Yes, once you've loaded the portal at least once from a proper web address — `npm start`, `npm run serve`, or a hosted copy. The offline support installs itself on that first visit, and after that the lessons, puzzles and your saved progress all work with no connection. It cannot install if you've opened the file directly as `file:///…`, so that route stays online-only.

**Q: How is my progress calculated?**
A: Based on completed exercises, correct answers, and daily consistency.

**Q: Can I reset my progress?**
A: Clear browser data to start fresh (this cannot be undone).

## 🌟 Success Tips

1. **Consistency Over Intensity**: 30 minutes daily beats 3 hours once a week
2. **Active Learning**: Engage with content, don't just read passively
3. **Variety**: Use all sections for well-rounded learning
4. **Patience**: Language learning takes time
5. **Enjoyment**: Make it fun with puzzles and games
6. **Real-world Practice**: Use English outside the app too
7. **Goal Setting**: Set and track specific, achievable goals

---

**Happy Learning! 🎓**

Remember: Every expert was once a beginner. Keep practicing, stay consistent, and celebrate your progress!

For technical details, see [`TECHNICAL_DOCUMENTATION.md`](TECHNICAL_DOCUMENTATION.md:1) in this docs folder