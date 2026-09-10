# ✍️ Content Authoring Guide

How to add learning content without breaking the pedagogy.
Read [TEACHING_METHODOLOGY.md](TEACHING_METHODOLOGY.md) first — this document is the
mechanical half of it.

There is no build step: edit the file, reload the page. Content lives in these files, all of them
loaded by `index.html` before `app.js` and all of them in `service-worker.js`'s precache list:

| File | Holds | Status |
|---|---|---|
| `data.js` | vocabulary, sentence exercises, reading passages, listening items, puzzles | The original store. Plain objects keyed by level |
| `data/grammar.js` | `grammarLessons` (point 3, articles), `grammarMistakeCategoryIds`, `ZERO_ARTICLE`, `GRAMMAR_SCHEMA_VERSION` | Wired. There is no `MISTAKE_CATEGORIES` array any more — `js/core/mistakes.js` owns the taxonomy. See §8 |
| `data/grammar/countability.js` | point 4, countability — **pushes itself into `grammarLessons.foundation`** on load, guarded against duplicate ids | Wired. The pattern for every further point: one file, one point, self-registering. See §8 |
| `data/grammar/be.js` | point 1, `be` (am/is/are), `GRAMMAR_BE` — same self-registering pattern | **Authored, not wired.** No `<script>` tag and no precache entry, so it never loads and the point does not appear. Two lines fixes it — and this is exactly the last checkbox in §10 |
| `data/pronunciation/vowels-stress.js` | `PRONUNCIATION_VOWELS_STRESS` — 3 vowel pair sets, 21 word-stress items, 15 prosody noticing items | Wired; `stress` and `noticing` are **rendered nowhere**. See §9 |
| `data/pronunciation/consonants.js` | `PRONUNCIATION_CONSONANTS` — 5 consonant pair sets | Wired. See §9 |

Per-strand files under `data/` are the direction of travel: `data.js` is already 44KB and one
strand's schema churn should not risk another's. **One point or one phoneme pair per file** — that is
not just tidiness, it is the shape that survived: multi-item authoring tasks failed repeatedly and
single-unit ones landed.

> **⚠️ Lexical globals, not `window` properties.** Every file above declares its content with a
> top-level `const` in a classic script (`CON-4`, no modules). A top-level `const` creates a
> *lexical* global, which is **not** a property of `window`. Guard access with bare
> `typeof grammarLessons !== 'undefined'`, never `window.grammarLessons` — that is always
> `undefined`. Every new `data/*.js` file inherits this trap, and it has already cost a full wave
> once in `js/core/`, where it made an error handler a silent no-op.

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

**Shipped, and the sketch that used to sit here is superseded — see §9.** The sketch specified
`sounds` / `hint` / `pairs`, and the shipped schema uses a 25-key `pairs[]` object whose contrast
words live under `minimalPairs`. `PROJECTORS.phon` has since been validated against that real
content. Authoring against the old sketch would produce items the section loader drops and the
review card cannot draw. **Read §9.**

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

**A field you add to a content item is dropped from every review card unless it is listed in
`PROJECTORS` in `js/core/srs.js`.** There is no failing test: the lesson renders correctly the first
time and then comes back for review with the field missing.

There is now **one** safety net, and it is a development-time console warning, not a test.
`SRS.auditProjection(type, item)` compares an authored item against its projector and warns once per
type+field, naming the field and the file to edit. It is deliberately silent about anything in
`DELIBERATE_OMISSIONS` (see below), because a warning that fires on the documented, correct call is
noise, and noise is how the real signal gets ignored. **Do not treat it as coverage** — it only fires
if the item is actually scheduled while you are watching the console.

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

Copied from `PROJECTORS` in `js/core/srs.js`, verified 2026-09-10:

| Type | Key prefix | Projected fields |
|---|---|---|
| `vocab` | `vocab:happy` | `word`, `pronunciation`, `definition`, `example`, `quiz`, `difficulty` |
| `gram` | `gram:articles` | `id`, `title`, `tier`, `cefr`, `rule`, `explain`, `contrast`, `practice`, `review`, `produce`, `caveats`, `l1Notes`, `mistakeCategory` |
| `phon` | `phon:iː-ɪ` | `id`, `pair`, `label`, `code`, `phonemes`, `contrastFeature`, `articulatoryCue`, `mirrorCheck`, `feelChecks`, `lengthNote`, `minimalPairs`, `examples`, `sentences`, `textOnlyFallback`, `discrimination`, `productionGate`, `caveats`, `mistakeCategory`, `difficulty` |
| `coll` | `coll:make-a-decision` | `id`, `chunk`, `meaning`, `example`, `practice`, `difficulty` — **still an unverified guess**; `data/collocations.js` does not exist |

There is also a `DELIBERATE_OMISSIONS` registry alongside it. Listing a field there is a statement
that a review card does not need it, and it stops `auditProjection()` warning about it. Current
entries: `gram` omits `notice`, `decide`, `whyItMatters`, `spokenNote`, `commonErrors`,
`prerequisites`, `syllabusNumber`, `tags` (first-teaching material and authoring metadata — a review
is by definition not the first teaching); `phon` omits `priority`, `audio`, `tags`. **A field that is
neither projected nor deliberately omitted still warns**, which is the point.

`vocab` behaves slightly differently from the other three: a declared-but-absent field is copied as
`undefined` for `vocab` only, so its stored shape stays byte-for-byte identical to what the old
inline whitelist produced. The other types omit absent fields entirely.

### This has already bitten three times

**`gram`, twice.** `PROJECTORS.gram` originally read
`['id', 'title', 'explanation', 'example', 'practice', 'difficulty']`. Two of those fields
(`explanation`, `example`) do not exist on a grammar point at all, and the list **omitted `rule`**
— the one field a wrong answer is required to show.
[TEACHING_METHODOLOGY.md §2](TEACHING_METHODOLOGY.md) requires a reason, a contrast and a retry on
every wrong grammar answer, so a grammar review card would have rendered a title and six practice
items with **no rule to show when the learner got one wrong**: a bare verdict, which `FR-GRM-2`
forbids. It was then corrected and still dropped `review` — its `{ rulePrompt, itemIds }`, which
*is* the review card `FR-GRM-3` asks for — and `cefr`. Both are projected now. `tier` carries the
level, so grammar has **no `difficulty` field**; do not add one.

**`phon`, once, and it was the worst of the three.** The `phon` list was a guess written before any
pronunciation content existed. It had no phantom fields, but when the real content landed it was
dropping **16 authored fields**, including `articulatoryCue`, `feelChecks`, `mirrorCheck`,
`discrimination` and `productionGate` — that is, the entire teaching value. A phoneme review card
without the articulatory cue is useless, precisely because [PROGRESS.md §6.aa](PROGRESS.md) rule 2
makes the feelable cue load-bearing for a learner who cannot yet *hear* the contrast. It was found by
`auditProjection()`, which is the class of defect that function was built for.

The lesson in all three: **a projector written before its content is a guess, and it fails silently.**
Validate it against real authored items in the commit that lands them.

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

## 9. Pronunciation content — `data/pronunciation/*.js`

**Shipped.** Two files exist, both loaded by `index.html` before `app.js` and both in
`service-worker.js`'s precache list. The earlier version of this section said the schema could not be
documented because no content existed; it exists now, and this is it, verified against source on
2026-09-10.

| File | Lexical global | Contains |
|---|---|---|
| `data/pronunciation/vowels-stress.js` | `PRONUNCIATION_VOWELS_STRESS` | `pairs` (3 vowel sets: T-P7 `iː-ɪ`, T-P8 `æ-e`, T-P9 `ɒ-əʊ`), `stress` (21 items), `noticing` (15 items), `schemaVersion` |
| `data/pronunciation/consonants.js` | `PRONUNCIATION_CONSONANTS` | `pairs` (5 sets: T-P5 `v-w`, T-P6 `θ-t`, T-P6 `ð-d`, T-P10 `z-s`, T-P11 `f-p`), `schemaVersion`. **No `stress` or `noticing`** — those live in the sibling and are not duplicated |

Both are top-level `const`s in classic scripts, so they are **lexical globals, not `window`
properties** (`CON-4`). Guard with bare `typeof PRONUNCIATION_CONSONANTS !== 'undefined'`, never
`window.PRONUNCIATION_CONSONANTS`, which is permanently `undefined`. This exact mistake cost a full
wave elsewhere in the repo.

`app.js`'s `pronunciationPairs()` concatenates `.pairs` from both files, vowels first — the order is
load-bearing because `state.currentPronunciationIndex` and the `pronunciation_foundation_N` exercise
ids are **positional**, so inserting a set in the middle silently moves a learner's completed pairs.
**Append new sets; never interleave.** A row missing `phonemes`, `minimalPairs`, `contrastFeature` or
`articulatoryCue` is dropped with a `console.warn` rather than half-drawn, because a pair that
quietly disappears is a content bug nobody would find.

### 9.1 Three load-bearing rules, before the schema

#### Rule 1 — articulatory cues must be **feelable, not auditory**

This is the single most important rule in this section, and it comes from
[PROGRESS.md §6.aa](PROGRESS.md) rule 2. Self-comparison fails *precisely where the learner needs it
most*: L2 perception is filtered through L1 phonology, so a Telugu-L1 speaker who cannot yet **hear**
/v/ vs /w/ will play back their own *wine* for *vine*, hear no difference, and mark themselves
correct. The blind spot sits exactly on the interference points this app exists to fix.

So every cue and every self-check must ask about something the learner can **feel or see in a
mirror**:

| ❌ Never write | ✅ Write instead |
|---|---|
| "Did it sound right?" | "Did your top teeth touch your bottom lip?" (/v/) |
| "Listen for the longer vowel" | "Does your jaw drop further on the first word?" |
| "Can you hear the difference?" | "Put a finger on your throat — does the buzz keep running, or stop and pop?" (/ð/ vs /d/) |
| "Compare your version to the model" | "Did your version end in a vowel sound after the last consonant?" (final-vowel epenthesis) |

Consonants are where this pays off most: unlike a vowel, a consonant has a **contact point**, and a
contact point can be felt with a fingertip or seen in a mirror. Use a **different physical channel**
per set where you can — fingertip on lip, tongue tip in a mirror, fingers on the throat, palm in
front of the mouth — so a learner who cannot manage one self-check has another.

`articulatoryCue`, `mirrorCheck`, `feelChecks` and `noticing[].feelCheck` are all governed by this
rule. `feelChecks` are for `FR-PRN-4` self-comparison; they are **never graded** (`FR-PRN-5`) and
**never gate anything** (`FR-SPK-9`).

#### Rule 2 — a minimal pair differs in **exactly one phoneme**, and the trap is vowels

`differsIn` on every `minimalPairs` row names the single segment that differs, and that is the
invariant: two words that differ in two things do not isolate the feature the drill is training, so
a learner who gets it wrong learns nothing about *why*.

**The trap:** a candidate pair looks like a clean consonant contrast while the vowels differ too. The
adversarial pass over the consonant sets discarded a run of otherwise-plausible candidates for
exactly this, in the British reference accent:

| Discarded | Looks like | Actually |
|---|---|---|
| *laugh / lap* | /f/ ~ /p/ | `/lɑːf/` vs `/læp/` — the **vowel** differs as well |
| *path / part* | /θ/ ~ /t/ | vowel differs as well |
| *bath / bat* | /θ/ ~ /t/ | vowel differs as well |
| *lather / ladder* | /ð/ ~ /d/ | vowel differs as well |
| *caught / coat* | /ɒ/ ~ /əʊ/ | `/kɔːt/` vs `/kəʊt/` differs in more than one way |

**Transcribe both members before you accept a pair.** If the two IPA strings differ anywhere except
the one segment in `differsIn`, discard it. Three further rejection grounds are already in use and
should stay in use, each recorded in the set's `caveats` so the next author does not re-propose the
pair:

- **Accent merger.** *marry/merry* is minimal in RP and merged for most American speakers, so an
  `en-US` voice produces two identical clips and the learner is marked wrong for hearing correctly.
  *bag/beg* goes the same way — several American voices raise /æ/ before /ɡ/ far enough to spoil it.
- **Rarity or proper nouns.** *thing/ting*, *thank/tank*, *bathe/bade* — one member is not a word an
  adult learner will meet.
- **Dignity.** *beach/bitch*, *sheet/shit*, *peace/piss* are textbook-perfect `iː`~`ɪ` pairs and a
  humiliation risk for an adult practising aloud in a shared room. Do not use them. This is not
  squeamishness; it is `NFR-15` and persona P2.

**Record every rejection in `caveats`, with the reason.** That list is the most re-read part of these
files.

#### Rule 3 — nothing may depend on TTS being good (`AS-3`)

`AS-3` ("browser TTS distinguishes minimal pairs audibly on real devices") is recorded in
`REQUIREMENTS.md` §8.2 as *must be validated before authoring pair sets*, and **it has still not
been run on a real mid-range Android phone.** The content is therefore authored so that no item
depends on the answer:

- every set carries `audio.ttsRisk` (`'high' | 'medium' | 'low'`) with `audio.ttsRiskWhy` stating
  the reason — current values: `iː-ɪ` and `θ-t` high, `æ-e`, `ð-d` and `f-p` medium, `ɒ-əʊ` and
  `z-s` and `v-w` low;
- every set carries `audio.degradeTo`, naming what the drill becomes when audio is untrustworthy;
- every set carries a `textOnlyFallback` that is gradable with **no audio at all** and still teaches
  the lexical half of the problem — *which* English words contain *which* sound, and where the
  spelling lies about it ("th" for two sounds, "s" for /z/, "ph" for /f/). For a Telugu-L1 learner
  that lexical knowledge is a real part of the difficulty, independent of the ear;
- nothing in `noticing` requires audio, by design (`FR-PRN-8`).

`audio.clipIds` are **proposed filenames, not shipped assets** — the repo contains zero audio files.
Nothing in these files asserts a clip exists.

### 9.2 `pairs[]` — one object per phoneme contrast (25 keys)

Both files use **exactly this key set, in this order.** The section loader is written against the
shape, so a new set that reorders or renames is a silent renderer bug.

**Identity and routing**

| Key | Notes |
|---|---|
| `id` | The contrast, e.g. `'iː-ɪ'`, `'v-w'`. **Must equal the `drill.target` in `js/core/mistakes.js`**, because the SRS key is `'phon:' + id`. Never change it: it is both the SRS ref and the mistake-log key |
| `code` | The `REQUIREMENTS.md` §3.1 interference row (`'T-P7'`), so the mapping back to the requirement is checkable |
| `priority` | `'M'` / `'S'` / `'W'`, copied from that same row. Drives L1-first ordering |
| `difficulty` | How hard the **contrast** is for a Telugu-L1 learner: `'medium'` or `'hard'`. Display and ordering only — it is *not* a level key |
| `srsType` | Always `'phon'` |
| `srsRef` | Equals `id` |
| `srsKey` | `'phon:' + id`. Denormalised so the key is greppable and testable |
| `mistakeCategory` | A real `prn.*` id from `js/core/mistakes.js`. Current mapping: `prn.i-length`, `prn.ae-e`, `prn.o-ou`, `prn.v-w`, `prn.th` (**both** `θ-t` and `ð-d`), `prn.z`, `prn.f-p` |
| `tags` | Authoring metadata. Deliberately unprojected |

**Teaching**

| Key | Notes |
|---|---|
| `pair` | The two symbols, **longer/tenser first**, in the same order as `id`, so `id` is always derivable from `pair` |
| `label` | One learner-facing line naming the **feelable** difference, never the auditory one |
| `phonemes` | One entry per symbol: `{ symbol, gloss, keyword, articulation, feel }`. `gloss` is the `FR-PRN-9` plain-English string (*"the 'ee' in sheep"*) — every symbol shown to a learner gets one, or they are reading bare IPA |
| `contrastFeature` | The ONE feature the drill trains, short, for the `FR-PRN-1` wrong-answer message |
| `articulatoryCue` | **The load-bearing field** (`REQUIREMENTS.md` §3.3: "load-bearing, not decorative"). One or two sentences, all of it checkable without hearing anything. See Rule 1 |
| `mirrorCheck` | What to look for in a mirror. Visual, never auditory |
| `feelChecks` | `FR-PRN-4` self-comparison questions. Feelable only, never graded, never a gate |
| `lengthNote` | An honest note on how far duration can be trusted as a cue. Usually: not far — the popular "long vs short" framing is the least reliable thing about `iː`~`ɪ` |
| `caveats` | Accent dependencies, rejected candidate pairs and their reasons, and anything an author must not quietly rely on |

**Items**

| Key | Notes |
|---|---|
| `minimalPairs` | `[{ a, b, aIpa, bIpa, differsIn, note?, ttsUse?, ttsWhy?, requiresCarrierSentence? }]`. `a` is the `pair[0]` member, `b` the `pair[1]`. See Rule 2 and §9.3 |
| `examples` | Flat word list. It exists **because `PROJECTORS.phon` declares `examples`** — a naming decision made to keep the review card non-empty |
| `sentences` | `[{ text, note }]` — contexts where the contrast carries meaning, for the disambiguation drill and for reading |
| `textOnlyFallback` | `{ mode, prompt, items, why }` — gradable with no audio. See Rule 3 |

**Behaviour**

| Key | Notes |
|---|---|
| `audio` | `{ ttsRisk, ttsRiskWhy, requiresBundledClip, clipIds, ttsHint, degradeTo }`. `ttsHint` is **prose for a human** and stays — see §9.3 for why it is not sufficient on its own |
| `discrimination` | `{ mode, itemsFrom, wrongAnswer }` — how `FR-PRN-1` renders. `wrongAnswer` is the feature-**naming** text a miss must show. Name the feature, never give a verdict |
| `productionGate` | `FR-PRN-6`: `{ requiresKey, minAccuracy, minAttempts, why }` — currently `0.8` over `10` attempts on the set's own `phon:` key, uniformly. Write the `why`; on `v-w` it records the honest tension that the articulatory check there is reliable enough that a learner *could* self-monitor before their ear catches up, and the gate stays anyway because `FR-PRN-6` is uniform |

### 9.3 `ttsUse` — the per-row TTS-safety enum, and why it is on the row

`audio.ttsHint` says things like *"Never use seat/sit or cheap/chip as a TTS item"*. That is
**unactionable**: honouring it at runtime would mean parsing English prose. So every claim
`ttsHint` makes about a specific pair is **also** carried on that pair's own row.

| `ttsUse` | Meaning | The drill must |
|---|---|---|
| `'prefer'` | First choice for a TTS-rendered item in this set | rank these rows first |
| `'verify'` | Usable on TTS only after **this row** has been checked on the device voice | defer it until checked |
| `'clip-first'` | Play a bundled clip if one exists; TTS is a last resort and the learner should be warned | defer it when no clip exists |
| `'clip-only'` | Never render this row on TTS | skip it unless a bundled clip exists |
| *absent* | **No claim.** Fall back to the set-level `audio.ttsRisk` | — |

The four values are in ascending severity. `ttsWhy` is optional, only meaningful next to `ttsUse`,
and holds one sentence naming which prose claim the flag encodes — so the flag and the prose cannot
drift silently. It is **never shown to a learner.** Current distribution across the 78 rows: 42
`prefer`, 6 `verify`, 3 `clip-first`, 7 `clip-only`, 20 with no claim.

**⚠️ Why this is on the `minimalPairs` row and not on the pair set.** This is the projector reason,
and it generalises to any new pronunciation field you are tempted to add:

> A new field at the **pair-set** level must be added to `PROJECTORS.phon` (or to
> `DELIBERATE_OMISSIONS.phon`) in `js/core/srs.js`, or `_project()` drops it from every stored
> review record and `auditProjection()` reports it as `dropped`. A field **inside** a `minimalPairs`
> row is part of the `minimalPairs` value, which `PROJECTORS.phon` already lists, so it travels onto
> the record for free and needs no change to `srs.js` — a file a content author cannot edit.

Row level is also the **truthful** level: TTS safety is a property of the two words, not of the
contrast. Same reasoning applies to `requiresCarrierSentence`, which is `true` on exactly one row
today — `close`/`close` in the `z-s` set. Those two are homographs, so a bare-word TTS call or a
bare-word recording picks a reading at random and the clip must be cut from a sentence. It is a
clip-**authoring** requirement, which is why it is a separate flag rather than folded into `ttsUse`.

**Scope, stated so the gap is visible rather than looking like an oversight:** these flags encode
claims made in the `audio` object. Voice-dependent claims that live in `caveats` — the `en-US`
/d/-flap warning on *other/udder*, for one — are deliberately left as prose, and the row says so.

### 9.4 `stress[]` — one object per word (21 keys, T-P4)

`id`, `code`, `word`, `pos`, `ipa`, `ameNote`, `syllables`, `stressNumbers`, `stressIndex`,
`display`, `reducedSyllables`, `reductionNote`, `family`, `familyRule`, `stressMinimalPair`,
`srsType`, `srsRef`, `srsKey`, `mistakeCategory`, `drill`, `tags`.

The ones that are easy to get wrong:

- **`stressNumbers` is the canonical marking**, one number per syllable: `1` primary, `2` secondary,
  `0` unstressed (ARPAbet/CMUdict convention). **Exactly one `1` per word**, and
  `stressNumbers.length` must equal `syllables.length`.
- **`stressIndex`** is the 0-based index of the primary stress, denormalised from `stressNumbers` so
  a renderer never scans and a test can assert directly.
- **`display`** is the learner-facing form with the stressed syllable in CAPITALS (`'PHO-to-graph'`).
  **Display only — never parse it.**
- **`reducedSyllables`** lists indices whose vowel reduces to /ə/ or disappears. This is the T-P1 half
  of a T-P4 word: English does not merely move the stress, it **flattens everything else**, and a
  learner who moves the stress without reducing the rest still does not sound English.
- **`family`** / **`familyRule`** group the shifting sets (`PHOtograph` / `phoTOGrapher` /
  `photoGRAPHic`) and state the transferable rule in one sentence.
- **`stressMinimalPair`** is the id of the other member when two words differ **only** in stress
  (`record` noun/verb). `null` otherwise.
- **`drill`** is `{ mode, prompt, options, correctIndex, answerableFromText, whyWrong }` with `mode`
  one of `'choose-stress' | 'choose-syllable-count' | 'choose-form'`. Answerable from text: the
  learner **marks a syllable**, not an imitation. For `'choose-stress'` the options are the syllables
  themselves, so `correctIndex === stressIndex`.
- **`srsKey` is `'phon:word-stress'` for all 21 items.** Phoneme/feature detail rides in the key and
  the key is the *feature*, not the word — per §9.6. Per-word accuracy is therefore **not** an SRS
  fact; it is the `drill` item id, and any renderer needs its own per-item counter.
  `mistakeCategory` is `'prn.word-stress'`.

### 9.5 `noticing[]` — one object per exercise (T-P1, T-P2, T-P3)

`FR-PRN-8` prosody content is **text-and-discrimination, never imitation.** TTS is not trusted to
model rhythm, so an imitation task would have the learner copying something wrong. Three invariants,
and they hold on all 15 items today:

| Key | Invariant |
|---|---|
| `requiresImitation` | **`false`, always.** There is no "listen and repeat" item in this file and none may be added |
| `requiresAudio` | **`false`, always.** Audio may *illustrate* an item (`audioOptional: true`), but the answer never depends on it |
| `answerableFrom` | `'text'` on every current item. `'text-or-audio'` is permitted; **`'audio'` is not** |

Remaining keys: `id`, `code`, `target`, `srsKey`, `mistakeCategory`, `mode`, `audioOptional`,
`teach`, `prompt`, `text`, `options`, `correctIndex`, `correct`, `tokens`, `items`, `answer`, `why`,
`feelCheck`, `l1`, plus `notMinimalPairs` / `notMinimalPairsWhy` where an item deliberately uses
word pairs that are *not* minimal pairs and needs to say so.

- `target` matches the `drill.target` in `js/core/mistakes.js` — `'rhythm'`, `'final-vowel'`,
  `'cluster'` — so `srsKey` is `'phon:' + target` and `mistakeCategory` is `prn.rhythm`,
  `prn.final-vowel`, `prn.cluster`.
- `mode` is one of **nine** today: `'count-beats'`, `'pick-beat-words'`, `'pick-written-form'`,
  `'count-sounds'`, `'count-syllables'`, `'sort'`, `'match-beat-to-meaning'`,
  `'pick-consonant-final'`, `'pick-which-word-you-said'`. Adding a mode is adding a renderer —
  count them before promising a surface.
- Grading is **not uniform**: `correctIndex` indexes `options`; `correct` is an array of indices into
  `tokens` for multi-select modes; and `sort` / per-word modes grade from `items[].answer` with no
  `correctIndex` at all. `text` may be `null` for the `items`-driven modes.
- `why` is what makes an item **noticing rather than trivia** — the reason, in the learner's terms.
  `feelCheck` is optional and is never the graded part.
- `l1` names the Telugu pattern the item targets.

### 9.6 Which `phon:` keys have a projector, and which do not

Read §7 first. `PROJECTORS.phon` was validated against real content on 2026-09-10 and now declares
19 fields:

```
phon: ['id', 'pair', 'label', 'code', 'phonemes', 'contrastFeature', 'articulatoryCue',
       'mirrorCheck', 'feelChecks', 'lengthNote', 'minimalPairs', 'examples', 'sentences',
       'textOnlyFallback', 'discrimination', 'productionGate', 'caveats', 'mistakeCategory',
       'difficulty']
```

with `DELIBERATE_OMISSIONS.phon = ['priority', 'audio', 'tags']` — declared so
`auditProjection()` stays silent about them instead of crying wolf. That accounts for all 25
`pairs[]` keys except `srsType` / `srsRef` / `srsKey`, which are already on the record as
`type` / `ref` / `key`.

**But the projector is shaped for pair sets only.** `_project()` looks up `PROJECTORS[type]`, and the
type for every one of these keys is `phon`, so:

| `phon:` key | Source | Projector |
|---|---|---|
| `phon:iː-ɪ`, `phon:æ-e`, `phon:ɒ-əʊ`, `phon:v-w`, `phon:θ-t`, `phon:ð-d`, `phon:z-s`, `phon:f-p` | `pairs[]` in both files | **Yes** — the 19-field list above, validated against this content |
| `phon:word-stress` | all 21 `stress[]` items | **No.** Projected through the pair-set list, which shares none of `word`, `syllables`, `stressNumbers`, `display`, `drill` … so a stored record keeps essentially nothing and the review card would be empty |
| `phon:rhythm`, `phon:final-vowel`, `phon:cluster` | `noticing[]` | **No.** Same failure: none of `teach`, `prompt`, `tokens`, `items`, `answer`, `why` survives |

This is why `stress[]` and `noticing[]` are authored and **rendered nowhere**: a surface for them is
not just UI work, it is a projector change in `js/core/srs.js` first. If you are the author who
wires them, the honest options are a per-key field list or separate SRS types — decide it in the same
commit as the surface, and re-run `auditProjection()` against real items before shipping. Getting
this wrong is silent: the lesson renders correctly the first time and the review card comes back
empty.

One further gap, recorded in `consonants.js` and repeated here because it is a content-routing fact:
**`'ð-d'` is reachable in the mistake log only via `alsoTargets`** — row T-P6 covers /θ/ and /ð/
under the single category `prn.th`, whose primary `drill.target` is `'θ-t'`. Both sets carry
`mistakeCategory: 'prn.th'`. Do **not** "fix" this by collapsing the two sets: *then/den* and
*thin/tin* need different word lists and different voicing checks, and merging them would hide that
/ð/ is the more frequent of the two in ordinary speech (*the*, *this*, *that*, *they*, *there*).

### 9.7 Reference accent

Both files use **British** IPA (RP-style, Oxford/Cambridge learner-dictionary conventions), matching
the transcriptions already in `REQUIREMENTS.md` §3.1 (`/ˈkʌmftəbl/`). Where a General-American
realisation differs enough to matter it is carried in `ameNote` or `caveats` rather than silently
ignored — because the app plays **whatever voice the device has, which is usually `en-US`**
(`utterance.lang` is hardcoded), so the clip a learner hears may not match the IPA printed on screen.
Consonants are far more accent-stable than vowels, so this matters most in `vowels-stress.js`; but
where a non-rhotic transcription is doing real work (*fourth/fort*, *four/pour*, *worthy/wordy*)
flag it in `caveats`.

### 9.8 Fixed facts that predate the content and still hold

- **SRS keys are `phon:<id>`**, per [TEACHING_METHODOLOGY.md §3](TEACHING_METHODOLOGY.md). `phon` is
  one of the four `SRS.TYPES` and `js/core/migrations.js` recognises the prefix.
- **Mistake categories use the `prn.*` ids** from `js/core/mistakes.js`; the phoneme detail rides in
  the SRS key, not in a category name. **Do not invent a category per phoneme.**
- **`FR-A11Y-4` applies to every production item**: a silent skip-and-mark-done path, so a learner
  can finish a session without granting microphone access. Only *discrimination* may gate on audio
  (`FR-SPK-9`).
- **`schemaVersion`** is the content-shape version (`1` in both files). Bump it when the shape
  changes. It is unrelated to `Migrations.SCHEMA_VERSION`, which versions *learner* data.
- **The `**target form**` / `*cited word*` markup convention is repo-wide**, and the pronunciation
  content uses it too — in `lengthNote`, `minimalPairs[].note` and `caveats`.

The old §6 "Minimal pairs" sketch is **superseded** by §9.2 and must not be authored against — it
used `sounds` / `hint` / `pairs`, none of which the projector or the section loader knows.

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
- [ ] **Pronunciation only** (§9): every `minimalPairs` row has **both** members transcribed and
      differs in **exactly one** phoneme, named in `differsIn` — check the vowels, that is where the
      trap is. Every discarded candidate pair is recorded in `caveats` with its reason. Every cue,
      `mirrorCheck`, `feelChecks` entry and `feelCheck` is **feelable or visible, never auditory**.
      `ttsUse` is set on any row the set's `audio.ttsHint` makes a claim about. The set carries
      `ttsRisk` + `ttsRiskWhy`, `degradeTo` and a gradable `textOnlyFallback`. Nothing in `noticing`
      has `requiresImitation` or `requiresAudio` true.
- [ ] Every `logAs` / `mistakeCategory` is a real `js/core/mistakes.js` id.
- [ ] `node -e "new Function(require('fs').readFileSync('data.js','utf8'))"` parses clean —
      and the same for each file under `data/`.
- [ ] New file under `data/`? Its `<script>` tag is in `index.html` **before `app.js`**, and it is
      in `service-worker.js`'s precache list, or it will not work offline.
