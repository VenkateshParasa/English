# ✍️ Content Authoring Guide

How to add learning content without breaking the pedagogy.
Read [TEACHING_METHODOLOGY.md](TEACHING_METHODOLOGY.md) first — this document is the
mechanical half of it.

There is no build step: edit the file, reload the page. Content lives in two places:

| File | Holds | Status |
|---|---|---|
| `data.js` | vocabulary, sentence exercises, reading passages, listening items, puzzles | The original store. Plain objects keyed by level |
| `data/grammar.js` | grammar lessons (`grammarLessons`), plus `MISTAKE_CATEGORIES` and `ZERO_ARTICLE` | New per-strand file. **Not yet in `index.html`'s script list** — add the `<script>` tag before `app.js` when wiring the grammar UI |

Per-strand files under `data/` are the direction of travel: `data.js` is already 44KB and one
strand's schema churn should not risk another's. `data/pronunciation.js` is being authored
concurrently and **does not exist yet** — see §9.

> **⚠️ Lexical globals, not `window` properties.** `data/grammar.js` declares its content with a
> top-level `const` in a classic script (`CON-4`, no modules). A top-level `const` creates a
> *lexical* global, which is **not** a property of `window`. Guard access with bare
> `typeof grammarLessons !== 'undefined'`, never `window.grammarLessons` — that is always
> `undefined`. Every new `data/*.js` file inherits this trap.

---

## 1. Level keys

The four CEFR-aligned tiers have landed in `js/core/levels.js` and are the ids to author against:

```js
foundation   // A1–A2
everyday     // B1
confident    // B2
fluent       // C1
```

The old keys `basic`, `intermediate` and `medium` are **permanent aliases**, not current ids.
`Levels.canonicalLevel()` maps them (`basic → foundation`, `intermediate → everyday`,
`medium → confident`) and `js/core/migrations.js` rewrites stored learner data to the new ids at
`SCHEMA_VERSION` 2. Author new content under the canonical ids. Do not add content under a legacy
key: the alias rescues old *saves*, it is not a supported authoring spelling.

Two things follow for authors:

- **Every tier key must exist, even when empty.** `data/grammar.js` pre-creates
  `everyday: []`, `confident: []`, `fluent: []` precisely so `grammarLessons[level].length` never
  throws for a tier with no content yet. Do the same in any new content file.
- `canonicalLevel()` returns `foundation` for anything it does not recognise, so a typo in a level
  key does not crash — it silently files your content under Foundation. Nothing will tell you.
  Check the key.

Guide to placing an item:

| | foundation (A1–A2) | everyday (B1) | confident (B2) | fluent (C1) |
|---|---|---|---|---|
| Sentence length | 4–8 words | 8–14 words | 14–22 words | not yet specified |
| Tenses | present simple/continuous, past simple | + present perfect, future forms, conditionals 1–2 | + perfect continuous, passives, conditional 3 | not yet specified |
| Vocabulary | top ~1000 words | top ~3000 | top ~6000 + common phrasal verbs | not yet specified |
| Passage length | 40–80 words | 100–180 words | 200–320 words | not yet specified |
| Clause count | 1 | 1–2 | 2–3 | not yet specified |

The `fluent` column is deliberately blank rather than guessed: [CURRICULUM.md §2.2](CURRICULUM.md)
defines the tier by what a learner can *do* ("speak spontaneously and precisely, use idiom and
register appropriately, restructure mid-sentence when I hit a wall") and no one has yet set its
mechanical bands. Until they are set, author `fluent` content against that descriptor and against
`data/grammar.js`'s own `cefr` field, and do not extrapolate the B2 numbers.

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

Grammar has **landed** — see §8 for the schema that shipped in `data/grammar.js`, which
supersedes the sketch that used to sit here. The rest below are still proposals with no
implementation.

### Grammar lessons

Shipped. **See §8.** The old sketch in this section specified
`contrast: [{ right, wrong }]`, which contradicts the methodology and must not be authored —
§8 explains why and gives the correct shape.

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

**This is a proposal, and it does not match what the SRS will store.** `PROJECTORS.phon` currently
declares `['id', 'pair', 'label', 'examples', 'minimalPairs', 'difficulty']` — note `pair`,
`label` and `examples`, none of which appear above, and note that `sounds`, `hint` and `pairs`
would all be **dropped**. Whoever authors `data/pronunciation.js` (§9) settles this: pick the field
names, then make `PROJECTORS.phon` match them in the same commit. Read §7 first.

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

## 7. ⚠️ The SRS projection contract — read this before adding any field

**A field you add to a content item is silently dropped from every review card unless it is
listed in `PROJECTORS` in `js/core/srs.js`.** There is no warning, no console message and no
failing test. The lesson renders correctly the first time and then comes back for review with the
field missing.

### How it works

When an outcome is recorded — `SRS.schedule(item, correct)` or
`SRS.scheduleItem('gram', lesson.id, lesson, correct)` — the scheduler does **not** store your
object. It stores a projection of it: `SRS._project(type, source)` copies only the field names
`PROJECTORS[type]` declares and discards the rest. That projection is what `localStorage` holds
under `srsData`, and it is the *only* thing a review card has to draw from. The original content
object is not consulted again at review time.

The bound is deliberate and should not be removed. `rec.data` goes to `localStorage`, so copying
an author's whole object risks putting a DOM node, a Blob or a reference cycle into storage —
`JSON.stringify` throws on a cycle and the learner's save silently fails. `PROJECTORS` is a
registry, not a fixed whitelist: the correct fix is always to **extend it**, never to bypass it.

### The current lists, per type

Copied from `PROJECTORS` in `js/core/srs.js`:

| Type | Key prefix | Projected fields |
|---|---|---|
| `vocab` | `vocab:happy` | `word`, `pronunciation`, `definition`, `example`, `quiz`, `difficulty` |
| `gram` | `gram:articles` | `id`, `title`, `tier`, `rule`, `explain`, `contrast`, `practice`, `produce`, `caveats`, `l1Notes`, `mistakeCategory` |
| `phon` | `phon:iː-ɪ` | `id`, `pair`, `label`, `examples`, `minimalPairs`, `difficulty` |
| `coll` | `coll:make-a-decision` | `id`, `chunk`, `meaning`, `example`, `practice`, `difficulty` |

`vocab` behaves slightly differently from the other three: a declared-but-absent field is copied as
`undefined` for `vocab` only, so its stored shape stays byte-for-byte identical to what the old
inline whitelist produced. The other types omit absent fields entirely.

### This has already bitten once

`PROJECTORS.gram` originally read
`['id', 'title', 'explanation', 'example', 'practice', 'difficulty']`. Two of those fields
(`explanation`, `example`) do not exist on a grammar point at all, and the list **omitted `rule`**
— the one field a wrong answer is required to show.
[TEACHING_METHODOLOGY.md §2](TEACHING_METHODOLOGY.md) requires a reason, a contrast and a retry on
every wrong grammar answer, so a grammar review card would have rendered a title and six practice
items with **no rule to show when the learner got one wrong**: a bare verdict, which `FR-GRM-2`
forbids. The list has since been corrected against the authored schema in `data/grammar.js` rather
than guessed.

Two fields `data/grammar.js` argues a review card needs are **still not projected**: `review`
(its `{ rulePrompt, itemIds }` — what a due review is supposed to look like without re-teaching
the whole lesson, per `FR-GRM-3`) and `cefr`. `tier` is projected and carries the level instead, so
grammar has no `difficulty` field — do not add one. Whoever wires the grammar review surface must
resolve `review` before it can behave as `FR-GRM-3` describes.

### The rule for authors

1. **Adding a field to a content item is a two-file change.** The content file *and*
   `PROJECTORS[type]` in `js/core/srs.js`, in the same commit.
2. **Ask "does this field need to survive into a review?"** If the review card must show it —
   the rule, the contrast, the feedback the learner sees on a wrong answer — it must be projected.
   If it is authoring metadata only (`syllabusNumber`, `prerequisites`, `tags`, `errorKind`), leave
   it out and keep the stored records small.
3. **Never solve a missing field by duplicating it under a projected name.** Two copies of the same
   paragraph drift, and the learner eventually sees the stale one.
4. **`PROJECTORS` is not the same as `RENDERABLE`.** `RENDERABLE[type]` decides whether a stored
   record can be *shown at all*; for `vocab` it requires `data.quiz`, so a vocabulary entry with no
   `quiz` is stored and then never surfaces. The other three types only require a payload to exist.
   An unrecognised type is never renderable — a record from a newer release is not poured into a
   card this build cannot draw.

---

## 8. Grammar lessons — `data/grammar.js`

This schema has shipped. One object per grammar point; `data/grammar.js` carries the full
field-by-field contract in its header comment and one complete worked example (point 3, articles).
Read that file before authoring — what follows is the part authors most often get wrong.

### `contrast` is a contrast, not a right/wrong pair

This guide previously specified:

```js
// ❌ WRONG. Do not author this shape.
contrast: [
    { right: "I am tired.", wrong: "I is tired." }
]
```

The shipped schema is:

```js
// ✅ CORRECT. EXACTLY 3 of these per lesson.
contrast: [
    {
        pair: [
            { text: "I am waiting for a bus.",
              means: "Any bus that goes my way. I have not told you which one, and you do not need to know." },
            { text: "I am waiting for the bus.",
              means: "The one we both know about — my usual one, or the one we were just talking about." }
        ],
        takeaway: "Both are correct. **a** means \"you do not know which one yet\"; **the** means \"we are both thinking of the same one\"."
    }
    // ...two more
]
```

**Both members must be correct English.** They differ only in the target form, and that difference
must produce a **real change of meaning**, which `means` states for each and `takeaway` names.

**Why this matters, because right/wrong pairs are the obvious thing to author and you will default
to them.** A right/wrong pair teaches that a form is *forbidden*. A contrast teaches what the form
*does*. Those are different lessons, and only the second one transfers to speech: a learner who has
memorised "*I is tired* is wrong" still has no idea when to reach for **the** instead of **a**,
because nothing in the pair told them what **the** contributes. `He is a doctor` versus
`He is the doctor` is the lesson — both correct, one means "that is his job" and the other means
"he is the particular doctor we are expecting" — and it is the reason
[TEACHING_METHODOLOGY.md](TEACHING_METHODOLOGY.md) asks for noticing rather than prohibition.

There is also a tone argument. A wrong-form example puts the learner's own error on screen as the
thing to be corrected. Two correct sentences put the learner in the position of noticing a
difference. The second is what principle 7 ("notice, then practise, then use") is built on.

**Genuine learner errors are still authored — in `commonErrors`, not in `contrast`:**

```js
commonErrors: [
    {
        heard: "I went to shop.",
        fix: "I went to the shop. / I went to a shop.",
        why: "*Shop* is one countable thing, so the slot in front of it cannot stay empty. Use **the** for the one near your house, **a** for some shop you have not identified.",
        l1: "T-G1"      // keys to REQUIREMENTS.md §3.2
    }
]
```

`commonErrors` is shown **after** practice, never before — do not prime the error. Note that
`commonErrors` is **not** in `PROJECTORS.gram`, so it does not reach a review card (§7).

### The fixed counts

The schema fixes two cardinalities, and a test should enforce both:

- `contrast` — **exactly 3** pairs.
- `practice` — **exactly 6** items.

### Fields authors get wrong

| Field | The mistake | The rule |
|---|---|---|
| `id` | Renaming it to read better | **Never change it.** It is the SRS ref *and* the mistake-log key. Renaming orphans every learner's history for that point |
| `rule` | Writing a paragraph | **One sentence.** This is the exact string shown on a wrong answer. Say it out loud first |
| `explain` | Restating `rule` in more words | 2–4 sentences teaching the *mechanism*. May name the L1 pattern |
| `tier` | Not matching the containing key | Must equal the `grammarLessons` key it sits under, and be a `js/core/levels.js` id |
| `accept` | One entry when two readings are defensible | Array of **every** defensible answer as `{ answer, means }`. `FR-GRM-5` lives here: a defensible answer is never "wrong". If a second reading works, it goes in this array or the item is rewritten |
| `showDifferenceOnCorrect` | Setting it true everywhere | `true` **only** when `accept.length > 1`. A right first answer should say nothing more; the one exception is an item with two right answers, where the learner must be told they are not interchangeable |
| `feedback` | Writing a verdict | One entry per wrong option, each with `reason` (why, in the learner's terms), `contrast` (2 sentences showing what their choice would have meant), and `retryCue` (the question to ask themselves). `FR-GRM-2` forbids a bare ✗ |
| `grammaticalButDifferent` | Leaving it false by default | `true` when the choice is real English that simply means something else here. Articles are mostly this, and saying so is the difference between teaching and scolding |
| `fallbackFeedback` | Omitting it | Required. Without it, a typed answer that is not in `options` produces a bare verdict |
| `logAs` | Inventing a category name | Must be a `js/core/mistakes.js` id. `MISTAKE_CATEGORIES` in `data/grammar.js` is the grammar subset, held there so a typo fails a test instead of silently landing in `general.uncategorised`. `MISTAKE_CATEGORY_ALIASES` translates the older plan names |
| `errorKind` | Expecting it on screen | **Never displayed.** Finer grain than the learner-facing category, for analysis only |
| `produce.model` | Omitting `note` | The note must tell the learner not to read the model aloud. Principle 1 requires them to say something not read off the screen |
| `produce.skippable` | Omitting it | `FR-SPK-9`: speaking is never a hard gate |
| `caveats` | Leaving them out to keep the rule clean | Honest limits are required. Never let a lesson imply a clean rule that isn't one |

### Conventions shared across all content

- **`**double asterisks**` marks the target form.** Used in `rule`, `explain`, `notice.lines`,
  `takeaway`, `commonErrors.why` and `produce.task`.
- **`ZERO_ARTICLE` is the empty string**, so rendering the chosen answer into the gap produces the
  correct sentence with no post-processing. Display it as `ZERO_ARTICLE_LABEL` (`"— (no article)"`).
  When grading typed input, normalise `""`, `"-"`, `"—"`, `"none"`, `"no article"` and `"zero"` to it.
- **`rendersAs`** is an optional `{ answer: displayForm }` map for a gap at the start of a sentence.
  Grade against `answer`, render `rendersAs[answer]`, so capitalisation never becomes part of the
  correctness check.
- **`GRAMMAR_SCHEMA_VERSION`** is the content-shape version (currently `1`). Bump it when the
  schema changes. It is unrelated to `Migrations.SCHEMA_VERSION`, which versions *learner* data.
- **`prerequisites` is advisory.** The app may order by it; it must not hard-gate. Nothing in the
  methodology gates grammar.

---

## 9. Pronunciation content — `data/pronunciation.js`

**This file does not exist yet.** It is being authored concurrently with this guide, so no schema
can be documented here without inventing one. What is known and fixed today:

- **SRS keys are `phon:<pair-id>`** (`phon:iː-ɪ`), per
  [TEACHING_METHODOLOGY.md §3](TEACHING_METHODOLOGY.md). `phon` is one of the four
  `SRS.TYPES`, and `js/core/migrations.js` already recognises the prefix.
- **`PROJECTORS.phon` currently declares** `['id', 'pair', 'label', 'examples', 'minimalPairs',
  'difficulty']`. This was written before any pronunciation content existed and is a **guess** —
  unlike `PROJECTORS.gram`, it has never been matched against an authored schema. Whoever writes
  `data/pronunciation.js` must reconcile the two in the same commit, per §7.
- **Mistake categories use the `prn.*` ids** from `js/core/mistakes.js`; the phoneme detail rides
  in the `phon:<pair-id>` SRS key, not in a category name. Do not invent a category per phoneme.
- **`AS-3` is unvalidated and blocks this work.** The assumption that browser TTS distinguishes
  minimal pairs audibly on real devices is recorded in `REQUIREMENTS.md` §8.2 as **"must be
  validated before authoring pair sets"**. If TTS cannot reliably say *sheep* and *ship*
  differently on a mid-range Android phone, the discrimination drill is unteachable however good
  the content is. Validate first.
- **`FR-A11Y-4` applies to every production item**: a silent skip-and-mark-done path, so a learner
  can finish a session without granting microphone access.

The §6 "Minimal pairs" sketch is the current proposal and nothing more. Treat it as a starting
point, not a contract.

---

## 10. Before you commit content

- [ ] Read every sentence **aloud**. If it feels strange to say, rewrite it.
- [ ] IPA copied from a dictionary, or the field omitted entirely.
- [ ] Stress marked on all multi-syllable words.
- [ ] Every distractor is a plausible confusion, not a filler.
- [ ] Every wrong answer produces an explanation.
- [ ] `correct` indexes verified against the actual `options` array.
- [ ] Item sits at the right level per the table in §1, under a **canonical** level key.
- [ ] Nothing culturally narrow or dated; names and places varied.
- [ ] **Every new field is in `PROJECTORS[type]` in `js/core/srs.js`** (§7), or you have decided
      deliberately that it need not survive into a review.
- [ ] Grammar only: `contrast` is 3 two-correct-sentence pairs (**not** right/wrong), `practice`
      is 6 items, every wrong option has a `feedback` entry, and `fallbackFeedback` exists.
- [ ] Every `logAs` / `mistakeCategory` is a real `js/core/mistakes.js` id.
- [ ] `node -e "new Function(require('fs').readFileSync('data.js','utf8'))"` parses clean —
      and the same for each file under `data/`.
- [ ] New file under `data/`? Its `<script>` tag is in `index.html` **before `app.js`**, and it is
      in `service-worker.js`'s precache list, or it will not work offline.
