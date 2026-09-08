# ✍️ Content Authoring Guide

How to add learning content to `data.js` without breaking the pedagogy.
Read [TEACHING_METHODOLOGY.md](TEACHING_METHODOLOGY.md) first — this document is the
mechanical half of it.

All content lives in `data.js` as plain objects keyed by difficulty level. There is no
build step: edit the file, reload the page.

---

## 1. Level keys

Current keys are `basic`, `intermediate`, `medium`. These are being renamed to
`foundation`, `everyday`, `confident` (plus a new `fluent`) — see
[CURRICULUM.md §2](CURRICULUM.md). Until that lands, use the existing keys and keep
each level internally consistent.

Guide to placing an item:

| | foundation (A1–A2) | everyday (B1) | confident (B2) |
|---|---|---|---|
| Sentence length | 4–8 words | 8–14 words | 14–22 words |
| Tenses | present simple/continuous, past simple | + present perfect, future forms, conditionals 1–2 | + perfect continuous, passives, conditional 3 |
| Vocabulary | top ~1000 words | top ~3000 | top ~6000 + common phrasal verbs |
| Passage length | 40–80 words | 100–180 words | 200–320 words |
| Clause count | 1 | 1–2 | 2–3 |

---

## 2. Vocabulary entries

### Current schema (`vocabularyData`)

```js
{
    word: "Happy",
    pronunciation: "/ˈhæpi/",
    definition: "Feeling or showing pleasure or contentment",
    example: "She was happy to see her friends.",
    quiz: {
        question: "What does 'happy' mean?",
        options: ["Sad", "Joyful", "Angry", "Tired"],
        correct: 1                       // zero-based index into options
    }
}
```

### Proposed additions

```js
{
    word: "Decide",
    pronunciation: "/dɪˈsaɪd/",
    stress: 2,                           // stressed syllable, 1-based
    partOfSpeech: "verb",
    register: "neutral",                 // informal | neutral | formal
    definition: "To choose after thinking about the options",
    example: "We decided to leave early.",
    collocations: ["decide to do something", "decide on a plan", "hard to decide"],
    family: ["decision", "decisive", "decisively", "undecided"],
    quiz: { /* as above */ },
    produce: {                           // productive recall, not recognition
        prompt: "We ______ to leave early.",
        answer: "decided"
    }
}
```

### Rules

1. **Real IPA only.** `/dɪˈsaɪd/`, never `/decide/`. If you do not have the IPA, omit
   the field — a wrong transcription is worse than none, because learners will believe
   it. Source from a dictionary; do not invent symbols.
   *This is a live bug: the word generator at `app.js:1349` emits `/word/`. New content
   must not follow that pattern, and the generator should be fixed to omit the field.*
2. **Mark the stress.** For any word of two or more syllables, `stress` is required.
   Wrong stress destroys intelligibility faster than a wrong vowel.
3. **The example must be sayable.** Something a person would actually say out loud, in
   the first or second person where possible. Not "Decision-making is requisite for
   organisational efficacy."
4. **Distractors must be plausible and instructive.** For "happy", the options
   `["Sad", "Joyful", "Angry", "Tired"]` are fine. `["A vehicle", "A written work",
   "A food item", "A tool"]` (the *book* entry) is not a vocabulary test — nobody
   confuses a book with a vehicle. Good distractors are near-misses: a common
   confusion, a false friend, a word with the same root, or a too-broad definition.
5. **Randomise nothing at author time.** Keep `correct` accurate; shuffling is the app's
   job at render time.
6. **One word, one entry.** Do not bundle *affect/effect* into a single item — make two
   entries and cross-reference them in the definitions.

---

## 3. Sentence exercises

### Current schema (`sentenceExercises`)

```js
{
    words: ["I", "am", "happy", "today"],       // drag-and-drop tokens
    correct: "I am happy today",
    fillBlank: {
        sentence: "I ___ happy today.",
        answer: "am",
        options: ["am", "is", "are", "be"]
    }
}
```

### Proposed addition — the teaching half

The fill-blank currently tests grammar with no instruction attached. Add:

```js
{
    words: ["I", "am", "happy", "today"],
    correct: "I am happy today",
    grammarPoint: "be-present",                 // links to the grammar syllabus + SRS
    fillBlank: {
        sentence: "I ___ happy today.",
        answer: "am",
        options: ["am", "is", "are", "be"],
        explanation: "Use **am** with I. Use **is** with he/she/it, **are** with you/we/they.",
        contrast: ["I am ready.", "She is ready.", "They are ready."],
        spoken: "I'm happy today."               // how it's actually said
    }
}
```

### Rules

1. **Exactly one thing varies.** If the blank tests `am/is/are`, every distractor must be
   a form of *be*. Mixing in a vocabulary distractor makes the result uninterpretable.
2. **No ambiguous blanks.** "I ___ to school" accepts *go*, *went*, *walk*, *drive*. Add
   enough context to make exactly one answer correct.
3. **Every fill-blank needs an `explanation`.** No exceptions. A wrong answer with no
   explanation is a missed lesson.
4. **Include the spoken form** where it differs from the written one (*I'm*, *don't*,
   *want to* → *wanna* in casual speech). This is a spoken-English app.
5. **Word-order items should have one valid order.** "Yesterday I went home" and "I went
   home yesterday" are both correct; either accept both in `correct` (make it an array)
   or rewrite the item.

---

## 4. Reading passages

### Current schema (`readingPassages`)

```js
{
    title: "A Beautiful Day",
    text: "Today is a beautiful day. ...",
    questions: [
        { question: "What is the weather like today?",
          options: ["Rainy", "Sunny", "Cloudy", "Snowy"], correct: 1 }
    ],
    dictation: "The sun is shining brightly in the sky."
}
```

### Rules

1. **Question mix.** Per passage, aim for: 1 gist question ("What is this text mainly
   about?"), 1–2 detail questions, 1 vocabulary-in-context question ("What does *bright*
   mean here?"), and at B1+ 1 inference question ("How does the writer feel?").
   Current passages are 100% literal detail — that trains scanning, not comprehension.
2. **Reference questions are cheap and valuable.** "In line 3, what does *they* refer
   to?" Anaphora tracking is a real reading sub-skill and costs one line to author.
3. **Dictation lines** should be 8–15 words and should contain something worth
   noticing — a contraction, a cluster, a weak form.
4. **Follow every passage with a spoken task.** "Retell this in three sentences,
   out loud, without looking." Reading feeds speaking or it is just reading.

---

## 5. Listening items

### Current schema (`listeningExercises`)

A flat array of strings per level. That is enough for listen-and-repeat and nothing else.

### Proposed schema

```js
{
    text: "Sorry, I can't make it — something's come up at work.",
    rate: 1.0,                          // playback speed; vary 0.75 / 1.0 / 1.25
    situation: "cancelling plans",
    focus: "connected-speech",          // what to notice
    questions: [
        { question: "Can the speaker come?", options: ["Yes", "No", "Not sure"], correct: 1 },
        { question: "Why not?", options: ["Illness", "Work", "Travel"], correct: 1 }
    ],
    shadow: true,                       // offer speak-along mode
    notes: "Note the linking in 'make it' and the reduced 'something's'."
}
```

### Rules

1. **Every listening item gets at least one comprehension question.** Without one, it is
   not a listening exercise.
2. **Use real spoken register** — contractions, hesitations, ellipsis
   ("Sorry, can't make it" not "I am sorry, I cannot attend"). Text-to-speech reading
   formal prose does not prepare anyone for a phone call.
3. **Group items by situation**, so they can be assembled into functional dialogue sets
   (phone call, interview, ordering food).
4. **Do not reveal the transcript before the attempt.**

---

## 6. New content types to add

These have no schema in `data.js` yet. Proposed shapes:

### Grammar lessons

```js
const grammarLessons = {
    foundation: [{
        id: "be-present",
        title: "am / is / are",
        cefr: "A1",
        explain: "English needs a form of 'be' in every simple description...",
        contrast: [
            { right: "I am tired.",    wrong: "I is tired." },
            { right: "She is tired.",  wrong: "She are tired." }
        ],
        spokenNote: "In speech you'll almost always hear the contraction: I'm, she's, they're.",
        practice: [
            { sentence: "They ___ my neighbours.", answer: "are", options: ["am","is","are","be"] }
        ],
        produce: "Say three sentences about your family using am, is and are."
    }]
};
```

### Minimal pairs

```js
const minimalPairs = [{
    id: "iː-ɪ",
    sounds: ["/iː/", "/ɪ/"],
    hint: "/iː/ is long, lips wide, like a smile. /ɪ/ is short and relaxed.",
    pairs: [
        { a: "sheep", b: "ship" },
        { a: "feel",  b: "fill" },
        { a: "seat",  b: "sit"  }
    ],
    sentences: ["Is that a sheep or a ship?"]
}];
```

Discrimination drill: play one member at random, learner picks which they heard, app
tracks accuracy per pair id (and feeds it to SRS as `phon:iː-ɪ`).

### Speaking prompts

```js
const speakingPrompts = {
    everyday: [{
        id: "late-story",
        prompt: "Tell me about a time you were late for something important.",
        cefr: "B1",
        targetSeconds: 60,
        useLanguage: ["past simple", "because", "in the end"],
        rubric: [
            "Did I use past tense throughout?",
            "Did I speak for the full minute without stopping?",
            "Did I count my 'um's — fewer than last time?"
        ]
    }]
};
```

### Functional dialogues

```js
const dialogues = {
    everyday: [{
        id: "doctor-appointment",
        situation: "Booking a doctor's appointment by phone",
        keyPhrases: ["I'd like to book...", "Is there anything earlier?", "That works for me."],
        lines: [
            { speaker: "Receptionist", text: "Good morning, Green Lane Surgery." },
            { speaker: "You",          text: "Hi, I'd like to book an appointment, please." }
        ],
        roleplay: "You"     // app speaks the other role, learner speaks this one
    }]
};
```

---

## 7. Before you commit content

- [ ] Read every sentence **aloud**. If it feels strange to say, rewrite it.
- [ ] IPA copied from a dictionary, or the field omitted entirely.
- [ ] Stress marked on all multi-syllable words.
- [ ] Every distractor is a plausible confusion, not a filler.
- [ ] Every wrong answer produces an explanation.
- [ ] `correct` indexes verified against the actual `options` array.
- [ ] Item sits at the right level per the table in §1.
- [ ] Nothing culturally narrow or dated; names and places varied.
- [ ] `node -e "new Function(require('fs').readFileSync('data.js','utf8'))"` parses clean.
