/**
 * Section registry ↔ markup contract.
 *
 * js/core/sections.js is now the only description of a section, which means a
 * row whose ids do not match index.html is the one remaining way to ship a
 * half-wired section. These are plain Node/jsdom checks over the repo — no app
 * bootstrap — so they are cheap enough to be the gate on every new section.
 *
 * The most important assertion here is the direct-child <h2>: app.js's
 * updateCompletionIndicator() does `section.querySelector('h2').after(...)`,
 * which throws on null. A section with its heading nested one level deeper
 * renders fine until the learner completes an exercise.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const Sections = require(path.join(ROOT, 'js', 'core', 'sections.js'));

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let doc;
beforeAll(() => {
    doc = new DOMParser().parseFromString(indexHtml, 'text/html');
});

const rows = Sections.SECTIONS;
const ids = Sections.ids();

describe('registry shape', () => {
    it('exposes the eight current sections in nav order', () => {
        expect(ids).toEqual([
            'dashboard', 'vocabulary', 'sentences', 'reading', 'listening', 'puzzles',
            // US-501. Appended, not slotted in after `sentences` where it belongs
            // pedagogically: this order is positional for the Alt+N shortcuts.
            'grammar',
            // US-401, appended for the same reason — Alt+8. Pronunciation belongs
            // beside Listening pedagogically and must not go there, because
            // inserting it would move Puzzles and Grammar for existing learners.
            'pronunciation'
        ]);
    });

    it('appends new sections rather than renumbering the existing ones', () => {
        // The whole reason both new sections are at the end. If this ever fails,
        // somebody has silently changed every learner's keyboard shortcuts.
        expect(ids.slice(0, 7)).toEqual([
            'dashboard', 'vocabulary', 'sentences', 'reading', 'listening',
            'puzzles', 'grammar'
        ]);
    });

    it('tracks exercises for every section except the dashboard', () => {
        expect(Sections.exerciseIds()).toEqual([
            'vocabulary', 'sentences', 'reading', 'listening', 'puzzles', 'grammar',
            'pronunciation'
        ]);
    });

    it('has one daily goal per learning section', () => {
        expect(Sections.goalKeys()).toEqual([
            'vocab', 'sentence', 'reading', 'listening', 'puzzle', 'grammar',
            'pronunciation'
        ]);
    });

    it('has an index field only for sections walked item by item', () => {
        expect(Sections.indexKeys()).toEqual([
            'currentWordIndex', 'currentSentenceIndex',
            'currentPassageIndex', 'currentListeningIndex', 'currentGrammarIndex',
            'currentPronunciationIndex'
        ]);
    });

    it('zeroMap covers every learning section', () => {
        expect(Sections.zeroMap('dailyStatKey')).toEqual({
            wordsLearned: 0, sentencesCompleted: 0, readingCompleted: 0,
            listeningCompleted: 0, puzzlesSolved: 0, grammarCompleted: 0,
            pronunciationCompleted: 0
        });
        expect(Sections.zeroMap('totalStatKey')).toEqual({
            totalWords: 0, totalSentences: 0, totalReading: 0,
            totalListening: 0, totalPuzzles: 0, totalGrammar: 0,
            totalPronunciation: 0
        });
        expect(Sections.zeroMap('avgKey')).toEqual({
            words: 0, sentences: 0, reading: 0, listening: 0, puzzles: 0,
            grammar: 0, pronunciation: 0
        });
    });

    it('stays inside the single-character Alt+N ceiling', () => {
        // handleGlobalShortcuts compares `key <= String(ids().length)`, one char.
        expect(ids.length).toBeLessThanOrEqual(9);
    });

    it('gives every counter-bearing section all three counter keys', () => {
        // The bug class this registry exists to kill: a section that renders and
        // counts nothing. Partial counter keys would resurrect it.
        Sections.exercises().forEach(s => {
            expect(typeof s.dailyStatKey).toBe('string');
            expect(typeof s.totalStatKey).toBe('string');
            expect(typeof s.avgKey).toBe('string');
        });
    });

    it('gives every counter-bearing section a statLabel', () => {
        // US-163. updateStatisticsDisplay() now builds three rows per section
        // from statLabel, so a row with a null one renders "null:" on the
        // dashboard — the counters would be right and the label nonsense, which
        // is the display-side twin of the bug above.
        Sections.exercises().forEach(s => {
            expect(typeof s.statLabel).toBe('string');
            expect(s.statLabel.length).toBeGreaterThan(0);
        });
    });

    it('states countsInTotalExercises explicitly on every row', () => {
        // US-163. This flag now decides whether a section's lifetime total goes
        // into the "Total Exercises" sum or gets a "Total X" row of its own.
        // `undefined` would silently mean "not counted" — a section missing from
        // the dashboard's headline number while looking perfectly wired.
        rows.forEach(s => expect(typeof s.countsInTotalExercises).toBe('boolean'));
        // At least one section must be outside the sum, or the "Total Words" row
        // the dashboard has always shown disappears.
        expect(Sections.exercises().some(s => !s.countsInTotalExercises)).toBe(true);
    });

    it('uses unique ids and unique keys throughout', () => {
        const unique = list => expect(list).toHaveLength(new Set(list).size);
        unique(ids);
        unique(Sections.goalKeys());
        unique(Sections.indexKeys());
        unique(Sections.exercises().map(s => s.dailyStatKey));
        unique(Sections.exercises().map(s => s.totalStatKey));
        unique(Sections.exercises().map(s => s.avgKey));
        unique(rows.filter(s => s.statusId).map(s => s.statusId));
        // US-163: updateDashboard() writes each card by id, so two rows sharing
        // one totalCardId would have the second silently overwrite the first.
        unique(rows.filter(s => s.totalCardId).map(s => s.totalCardId));
    });

    it('returns null for an unknown id rather than throwing', () => {
        // Was 'grammar' until US-501 made it a real row, then 'pronunciation'
        // until US-401 did the same. Any id that is not a section will do; what
        // is being tested is that a miss is null, not a throw and not an
        // inherited Object property.
        expect(Sections.get('collocations')).toBeNull();
        expect(Sections.get(undefined)).toBeNull();
        // Object.create(null) storage, so inherited names cannot masquerade.
        expect(Sections.get('toString')).toBeNull();
    });
});

describe('runtime loader registration', () => {
    it('starts empty — loaders live in app.js, not in the literal', () => {
        // sections.js parses before app.js; a loader named in the literal would
        // be a ReferenceError. Nothing may pre-populate them.
        ids.forEach(id => expect(Sections.loader(id)).toBeUndefined());
    });

    it('registers, and rejects unknown ids and non-functions loudly', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const fn = () => {};

        Sections.registerRuntime({ vocabulary: fn, nope: fn, reading: 'not a fn' });

        expect(Sections.loader('vocabulary')).toBe(fn);
        expect(Sections.loader('reading')).toBeUndefined();
        expect(Sections.loader('nope')).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(2);

        expect(() => Sections.registerRuntime(null)).not.toThrow();
        warn.mockRestore();
    });
});

describe('index.html markup matches the registry', () => {
    it.each(ids)('#%s exists and is a .section', id => {
        const el = doc.getElementById(id);
        expect(el).not.toBeNull();
        expect(el.classList.contains('section')).toBe(true);
    });

    it.each(ids)('a nav button targets %s', id => {
        expect(doc.querySelector(`.nav-btn[data-section="${id}"]`)).not.toBeNull();
    });

    it.each(ids)('#%s has a direct-child h2', id => {
        // updateCompletionIndicator does section.querySelector('h2').after(...).
        // querySelector is a descendant search, so it would find a nested h2 and
        // insert the status badge in the wrong place; require a direct child.
        const el = doc.getElementById(id);
        const own = Array.from(el.children).filter(c => c.tagName === 'H2');
        expect(own).toHaveLength(1);
        expect(el.querySelector('h2')).toBe(own[0]);
    });

    const navButtons = rows.flatMap(s => [
        [s.id, 'prevBtnId', s.prevBtnId],
        [s.id, 'nextBtnId', s.nextBtnId]
    ]).filter(([, , btnId]) => !!btnId);

    it.each(navButtons)('%s %s (#%s) exists', (sectionId, field, btnId) => {
        const btn = doc.getElementById(btnId);
        expect(btn).not.toBeNull();
        // The keyboard handler clicks these, so they must be real buttons inside
        // the section they navigate.
        expect(btn.tagName).toBe('BUTTON');
        expect(btn.closest('.section').id).toBe(sectionId);
    });

    const prevNextPairs = rows.map(s => [s.id, !!s.prevBtnId, !!s.nextBtnId]);
    it.each(prevNextPairs)('%s declares prev and next together', (id, hasPrev, hasNext) => {
        // Arrow-key navigation is symmetric; one without the other is a typo.
        expect(hasPrev).toBe(hasNext);
        expect(hasPrev).toBe(!!Sections.get(id).indexKey);
    });

    it.each(rows.filter(s => s.hasDifficulty).map(s => s.id))(
        '%s has its own .diff-btn level selector',
        id => {
            expect(doc.getElementById(id).querySelector('.diff-btn')).not.toBeNull();
        }
    );

    it.each(rows.filter(s => !s.hasDifficulty).map(s => s.id))(
        '%s has no .diff-btn level selector',
        id => {
            expect(doc.getElementById(id).querySelector('.diff-btn')).toBeNull();
        }
    );

    it.each(Sections.goalKeys())('the dashboard has a #goal checkbox for %s', key => {
        const el = doc.getElementById('goal' + key.charAt(0).toUpperCase() + key.slice(1));
        expect(el).not.toBeNull();
        expect(el.type).toBe('checkbox');
    });

    it.each(rows.filter(s => s.statusId).map(s => [s.id, s.statusId]))(
        '%s status element #%s is created at runtime, not in the markup',
        (sectionId, statusId) => {
            // updateCompletionIndicator creates it on first use; a stray copy in
            // index.html would be found instead and could sit outside the section.
            expect(doc.getElementById(statusId)).toBeNull();
        }
    );

    it.each(rows.filter(s => s.totalCardId).map(s => [s.id, s.totalCardId]))(
        '%s has a dashboard #%s .stat-number card',
        (sectionId, cardId) => {
            const el = doc.getElementById(cardId);
            expect(el).not.toBeNull();
            expect(el.classList.contains('stat-number')).toBe(true);
            // US-163: updateDashboard() looks these up by id from the row, so a
            // card that exists outside #dashboard would be written and never seen.
            expect(el.closest('#dashboard')).not.toBeNull();
        }
    );

    it.each(['todayStats', 'overallStats', 'averageStats'])(
        'the dashboard has a .stat-box #%s for updateStatisticsDisplay to fill',
        id => {
            // US-163. These three are the only hosts that function writes to, and
            // it no-ops silently on a missing one — which on a stale cached
            // index.html would mean a dashboard with no statistics at all.
            const el = doc.getElementById(id);
            expect(el).not.toBeNull();
            expect(el.classList.contains('stat-box')).toBe(true);
            expect(el.closest('#dashboard')).not.toBeNull();
        }
    );

    it('loads sections.js before app.js', () => {
        const srcs = Array.from(doc.querySelectorAll('script[src]'))
            .map(s => s.getAttribute('src'));
        // app.js's `state` literal calls Sections.zeroMap() at parse time.
        expect(srcs.indexOf('js/core/sections.js')).toBeGreaterThan(-1);
        expect(srcs.indexOf('js/core/sections.js')).toBeLessThan(srcs.indexOf('app.js'));
    });

    it('loads every content file a section names before app.js', () => {
        // A section whose content script is missing or late renders an empty
        // card and counts nothing — the failure this registry exists to prevent,
        // one layer down.
        const srcs = Array.from(doc.querySelectorAll('script[src]'))
            .map(s => s.getAttribute('src'));
        const appAt = srcs.indexOf('app.js');
        ['data.js', 'data/grammar.js', 'data/pronunciation/vowels-stress.js']
            .forEach(src => {
                expect(srcs.indexOf(src)).toBeGreaterThan(-1);
                expect(srcs.indexOf(src)).toBeLessThan(appAt);
            });
    });

    it('gives Listening a lifetime-total card like every other section (US-175)', () => {
        // Named explicitly rather than left to the it.each() above, because the
        // interesting fact is the ABSENCE of an exception: for one release
        // Listening was the only exercise-tracking section whose number was
        // counted, summed and never shown. If this row goes back to
        // `totalCardId: null` the it.each() above simply stops running for it —
        // silently — which is precisely the failure mode this file exists for.
        expect(Sections.get('listening').totalCardId).toBe('listeningCompleted');
        Sections.exercises().forEach(s => expect(typeof s.totalCardId).toBe('string'));
        const card = doc.getElementById('listeningCompleted');
        expect(card).not.toBeNull();
        expect(card.classList.contains('stat-number')).toBe(true);
        expect(card.closest('#dashboard')).not.toBeNull();
    });
});

/**
 * The Pronunciation section's three content groups (US-179).
 *
 * The section walks `pairs[]`, `stress[]` (21 items) and `noticing[]` (15 items)
 * behind ONE nav id, one Prev/Next pair and one `indexKey`. That is a deliberate
 * departure from "one row per walkable thing", and the failure it can produce is
 * specific: a switcher button whose card is not in the markup renders a control
 * that hides the pair cards and shows nothing, which is the blank-screen twin of
 * the counting bug this file exists for. So every button's group must be one this
 * markup can actually draw, and the host it draws into must exist.
 *
 * Structural only, like the rest of this file — app.js exports nothing and cannot
 * be required (see __tests__/README.md), so the app source is read as text.
 */
describe('pronunciation content groups (US-179)', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const section = () => doc.getElementById('pronunciation');
    const GROUPS = ['pairs', 'stress', 'noticing'];

    it('has one switcher button per group, inside the section', () => {
        const buttons = Array.from(
            section().querySelectorAll('#pronunciationGroups .pron-group-btn'));
        expect(buttons.map(b => b.getAttribute('data-pron-group'))).toEqual(GROUPS);
        buttons.forEach(b => {
            expect(b.tagName).toBe('BUTTON');
            // FR-A11Y-1: toggle buttons, so a reader says "pressed", and the
            // markup must not start with all three unpressed or all three pressed.
            expect(['true', 'false']).toContain(b.getAttribute('aria-pressed'));
        });
        expect(buttons.filter(b => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
        expect(buttons.filter(b => b.classList.contains('active'))).toHaveLength(1);
    });

    it('never uses .diff-btn for the switcher', () => {
        // The registry says `hasDifficulty: false` and the it.each() above asserts
        // no .diff-btn is in this section. Restated here as intent rather than as
        // a side effect: these buttons pick WHICH CONTENT, not which tier, and a
        // learner must not read them as the app-wide level control.
        expect(section().querySelectorAll('.diff-btn')).toHaveLength(0);
        expect(Sections.get('pronunciation').hasDifficulty).toBe(false);
    });

    it('has a host card for every group a button can select', () => {
        // pairs -> the three original cards; stress and noticing -> the browse card.
        ['pronLessonCard', 'pronDrillCard', 'pronProduceCard', 'pronBrowseCard']
            .forEach(id => {
                const el = doc.getElementById(id);
                expect(el).not.toBeNull();
                expect(el.closest('#pronunciation')).not.toBeNull();
            });
        // The element loadPronunciationBrowseItem() empties and fills.
        const browse = doc.getElementById('pronunciationBrowse');
        expect(browse).not.toBeNull();
        expect(browse.closest('#pronBrowseCard')).not.toBeNull();
        // ...and its heading, which the loader rewrites per group.
        expect(doc.getElementById('pronunciation-browse-title')).not.toBeNull();
    });

    it('starts with the browse card hidden and the pair cards shown', () => {
        // No JS has run yet. The section has always opened on a pair, and a
        // markup default of "both visible" would flash two questions at once.
        expect(doc.getElementById('pronBrowseCard').hasAttribute('hidden')).toBe(true);
        ['pronLessonCard', 'pronDrillCard', 'pronProduceCard'].forEach(id => {
            expect(doc.getElementById(id).hasAttribute('hidden')).toBe(false);
        });
    });

    it('registers the dispatcher as the section loader, not the pair renderer', () => {
        // loadPronunciationPair() draws one minimal-pair set and knows nothing
        // about the other two groups, so registering it would make switchSection()
        // and retakeCurrentExercise() reopen the section on the wrong group.
        expect(appSource).toMatch(/pronunciation: loadPronunciationSection/);
        expect(appSource).toMatch(/function loadPronunciationSection\(/);
    });

    it('gives each group its own cursor in state', () => {
        // One `indexKey` per section is all the registry holds, and it means "which
        // minimal-pair set" — it also stamps `pronunciation_foundation_N`. Folding
        // 36 more items into that counter would renumber every pair a learner has
        // already completed.
        expect(Sections.get('pronunciation').indexKey).toBe('currentPronunciationIndex');
        ['currentPronunciationGroup', 'currentStressIndex', 'currentNoticingIndex']
            .forEach(key => expect(appSource).toContain(key));
        expect(Sections.indexKeys()).not.toContain('currentStressIndex');
        expect(Sections.indexKeys()).not.toContain('currentNoticingIndex');
    });

    it('draws no audio control on either browsable group (FR-PRN-8 / AS-3)', () => {
        // Every stress drill is `answerableFromText` and every noticing item is
        // `requiresAudio: false`, so a learner whose device cannot speak completes
        // all 36 with nothing missing. That only stays true if these two renderers
        // never reach for the speech API.
        const from = appSource.indexOf('function renderPronStressItem(');
        const to = appSource.indexOf('function pronBrowseAfterAnswer(');
        expect(from).toBeGreaterThan(-1);
        expect(to).toBeGreaterThan(from);
        const block = appSource.slice(from, to);
        expect(block).not.toMatch(/pronSpeak|pronPlayButton|speechAPI|SpeechRecognition|speechSynthesis/);
    });

    it('refuses a requiresImitation item rather than trusting the data', () => {
        // FR-PRN-8 is binding: prosody is noticing and discrimination, never
        // imitation. The guard covers stress items too, where today's content does
        // not carry the flag — a guard over only the array that has the field is a
        // guard against nothing.
        expect(appSource).toMatch(/function pronBrowseRefusesImitation\(/);
        const guard = appSource.slice(appSource.indexOf('function pronBrowseRefusesImitation('),
                                      appSource.indexOf('let pronBrowseSession'));
        expect(guard).toMatch(/item\.requiresImitation/);
        expect(guard).toMatch(/FR-PRN-8/);
        // Called by BOTH renderers, before anything else is drawn.
        ['function renderPronStressItem(', 'function renderPronNoticingItem(']
            .forEach(name => {
                const at = appSource.indexOf(name);
                expect(at).toBeGreaterThan(-1);
                expect(appSource.slice(at, at + 1200))
                    .toMatch(/if \(pronBrowseRefusesImitation\(item, host\)\) return;/);
            });
    });
});

/**
 * The "Start today's session" chrome (US-170 / FR-SES-1).
 *
 * Structural only, in the same spirit as the section contract above: app.js's
 * SessionUI looks every one of these hosts up by id and no-ops on a miss, so a
 * renamed or moved element is a session that silently stops reporting.
 */
describe('today\'s session markup (US-170)', () => {
    it('keeps #sessionBar outside every .section', () => {
        // switchSection() toggles `.active` on `.section` elements and a step
        // routes the learner INTO a section, so chrome inside one would vanish
        // exactly when it is needed.
        const bar = doc.getElementById('sessionBar');
        expect(bar).not.toBeNull();
        expect(bar.closest('.section')).toBeNull();
        expect(bar.classList.contains('section')).toBe(false);
    });

    it('starts #sessionBar hidden and focusable', () => {
        const bar = doc.getElementById('sessionBar');
        // No JS has run yet, so the markup itself must not show an empty bar.
        expect(bar.hasAttribute('hidden')).toBe(true);
        // SessionUI.enter() moves focus here on every step; -1 keeps it out of
        // the tab order while still being focusable (FR-A11Y-1).
        expect(bar.getAttribute('tabindex')).toBe('-1');
    });

    it.each(['sessionStep', 'sessionInstruction', 'sessionStepNote', 'sessionControls'])(
        '#%s lives inside the session bar',
        id => {
            const el = doc.getElementById(id);
            expect(el).not.toBeNull();
            expect(el.closest('.session-bar')).not.toBeNull();
        }
    );

    it.each([
        'sessionPanel', 'sessionResume', 'sessionSilent', 'startSession',
        'restartSession', 'sessionPlan', 'sessionShortfall', 'sessionOmitted',
        'sessionWrapUp'
    ])('#%s lives on the dashboard', id => {
        const el = doc.getElementById(id);
        expect(el).not.toBeNull();
        expect(el.closest('#dashboard')).not.toBeNull();
    });

    it('puts the session panel before the stats grid', () => {
        // BR-1: a learner completes a session without choosing what to practise.
        // The Start button has to be the first thing on the Dashboard, or the
        // eight-button nav is still the first offer the app makes.
        const dashboard = doc.getElementById('dashboard');
        const order = Array.from(dashboard.children);
        const panel = order.findIndex(c => c.classList.contains('session-panel'));
        const grid = order.findIndex(c => c.classList.contains('stats-grid'));
        expect(panel).toBeGreaterThan(-1);
        expect(grid).toBeGreaterThan(-1);
        expect(panel).toBeLessThan(grid);
    });

    it('uses real buttons for every session control in the markup', () => {
        // FR-A11Y-1: Tab reaches them and Enter/Space activate them with no key
        // handling of our own. The per-step controls are built in app.js as
        // <button type="button"> for the same reason.
        ['startSession', 'restartSession'].forEach(id => {
            expect(doc.getElementById(id).tagName).toBe('BUTTON');
        });
    });

    it('loads session.js after its dependencies and before app.js', () => {
        const srcs = Array.from(doc.querySelectorAll('script[src]'))
            .map(s => s.getAttribute('src'));
        const at = name => srcs.indexOf(name);
        expect(at('js/core/session.js')).toBeGreaterThan(-1);
        // It reads Sections, SRS and Mistakes at build time.
        ['js/core/sections.js', 'js/core/srs.js', 'js/core/mistakes.js'].forEach(dep => {
            expect(at(dep)).toBeGreaterThan(-1);
            expect(at(dep)).toBeLessThan(at('js/core/session.js'));
        });
        // app.js calls Session.registerSurfaces() at parse time.
        expect(at('js/core/session.js')).toBeLessThan(at('app.js'));
    });
});


/**
 * Reading feedback and the mistake-log producers (US-140 / US-141 / US-186).
 *
 * Structural, like the rest of this file — app.js exports nothing and cannot be
 * required. Three things are worth a static gate:
 *
 *  1. EVERY category id app.js hands Mistakes.record() has to RESOLVE. record()
 *     rejects an unknown id, so a typo is not a wrong bucket, it is a mistake
 *     that goes unlogged and a diagnosis that silently loses evidence.
 *     mistakes.js provides unknownCategories() for exactly this check and asks
 *     callers to use it (FR-CNT-1: fail loudly at author time).
 *  2. The dictation check must not grow another fake tolerance. The old code
 *     computed `sim = exact ? 1 : 0.5` and tested `sim > 0.8`, so the name and
 *     the threshold both described matching that did not exist.
 *  3. Every new record() call has to stay behind its single-answer guard. Without
 *     one, a learner who checks the same wrong answer four times becomes four
 *     occurrences, and one stubborn item becomes the whole top-5.
 */
describe('reading feedback and mistake producers (US-140 / US-141 / US-186)', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const Mistakes = require(path.join(ROOT, 'js', 'core', 'mistakes.js'));

    /** The body of one top-level function, by brace matching. */
    function functionBody(header) {
        const start = appSource.indexOf(header);
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces after ' + header);
    }

    it('passes Mistakes.record() only ids the taxonomy knows', () => {
        const ids = Array.from(appSource.matchAll(/Mistakes\.record\(\s*'([^']+)'/g))
            .map(match => match[1]);
        // The other two producers choose between ids on the line above the call
        // (a ternary in recordSentenceMistake, comprehensionMistakeCategory), so
        // those are collected separately below rather than by this regex.
        const chosen = ['gram.word-order', 'general.uncategorised'];
        chosen.forEach(id => expect(appSource).toContain(`'${id}'`));
        // If this is ever zero the regex has stopped matching, not the app.
        expect(ids.length).toBeGreaterThanOrEqual(3);
        expect(Mistakes.unknownCategories(ids.concat(chosen))).toEqual([]);
    });

    it('records the seven categories that had no producer where one now exists', () => {
        // vocab.recall, vocab.collocation and lsn.gist are deliberately still
        // absent — there is no production-from-meaning task, no collocation
        // content and no gist question in this build to produce them honestly.
        ['vocab.meaning', 'vocab.spelling', 'lsn.detail'].forEach(id => {
            expect(appSource).toContain(`Mistakes.record('${id}'`);
        });
    });

    it('grades dictation word by word, with no invented similarity score', () => {
        const body = functionBody('function markDictation(');
        expect(body).toContain('diffSpeechAttempt(');
        // Completion is no more generous than the exact comparison it replaced:
        // every target word matched AND nothing extra typed.
        expect(body).toMatch(/right:\s*diff\.allMatched && extra\.length === 0/);

        // The two halves of the old lie, gone from the handler that held them.
        // Scoped to the handler, not the file: the block comment above
        // markDictation() quotes the old code on purpose.
        const handler = functionBody('function initializeReadingButtons(');
        expect(handler).not.toMatch(/sim\s*>\s*0\.8/);
        expect(handler).not.toMatch(/\?\s*1\s*:\s*0\.5/);
        expect(handler).toContain('markDictation(target, typed)');
    });

    it('gives a wrong dictation a reason, a contrast and a retry', () => {
        const body = functionBody('function renderDictationResult(');
        // The contrast is two marked lines: the learner's, then the audio's.
        expect(body).toContain("appendMarkedWordLine(host, 'You wrote:'");
        expect(body).toContain("appendMarkedWordLine(host, 'The audio said:'");
        expect(body).toContain('dictation-reason');
        expect(body).toContain('dictation-retry');
        // No bare verdict left: the old failure branch was `Correct: "…"` alone.
        expect(functionBody('function initializeReadingButtons('))
            .not.toContain('`Correct: "${correct}"`');
    });

    it('gives a wrong comprehension answer the answer, a reason and a retry', () => {
        const body = functionBody('function checkComprehensionAnswers(');
        expect(body).toContain('question-verdict');
        expect(body).toContain('question-reason');
        expect(body).toContain('question-retry');
        // FR-A11Y-5: the fix is on the same screen, so the ✗ line carries it.
        expect(body).toMatch(/The answer is "\$\{answerText\}"/);
        // §5 tone: the praise and its exclamation marks are gone, the ✓ stays.
        expect(body).not.toContain('Perfect');
        expect(body).toMatch(/✓ All \$\{questions\.length\} answers right\./);
        // The old red paint with nothing beside it.
        expect(body).not.toContain('#ffebee');
    });

    it('never marks or logs an unanswered question', () => {
        const comprehension = functionBody('function checkComprehensionAnswers(');
        // The unanswered branch runs before anything is marked wrong and returns.
        expect(comprehension).toMatch(/if \(!chosen\) \{[\s\S]*?is-unanswered[\s\S]*?return;/);
        // initializeSentenceButtons() counted an unanswered multiple choice as
        // wrong, which would have logged a mistake the learner never made.
        const sentences = functionBody('function initializeSentenceButtons(');
        expect(sentences).toMatch(/\} else if \(!given\.trim\(\)\) \{/);
        expect(sentences.indexOf('} else if (!given.trim()) {'))
            .toBeLessThan(sentences.indexOf('state.sentenceAttempts++'));
    });

    it('keeps every new record() call behind its single-answer guard', () => {
        // Vocabulary: the `answered` flag, one answer per word render.
        const quiz = functionBody('function displayVocabQuiz(');
        expect(quiz).toMatch(/if \(!answered\) \{[\s\S]*?recordVocabMistake\(/);

        // Sentences: the first wrong attempt only. sentenceAttempts is zeroed by
        // loadSentenceExercise() and by Reset.
        const sentences = functionBody('function initializeSentenceButtons(');
        expect(sentences).toMatch(/state\.sentenceAttempts === 1\) \{\s*\n\s*recordSentenceMistake\(/);

        // Reading: a per-render flag, because a WRONG answer never marks the
        // passage complete and isExerciseCompleted() therefore cannot be the
        // guard on its own.
        ['function recordDictationMistakes(', 'function recordComprehensionMistakes(']
            .forEach(header => {
                expect(functionBody(header)).toMatch(/if \(readingSession\.\w+Logged\) return;/);
            });
        expect(functionBody('function loadReadingPassage(')).toMatch(/readingSession = \{/);
    });

    it('logs graded evidence, and says so at every call site', () => {
        // All four new producers compared against an answer the app held, so all
        // four are `graded`. Written out rather than left to record()'s default,
        // because BR-3 turns on this distinction.
        const graded = appSource.match(/evidence: Mistakes\.EVIDENCE\.GRADED/g) || [];
        expect(graded.length).toBeGreaterThanOrEqual(5);
        // `source` names the screen, so the log can tell a section answer from a
        // review answer — the same wrong click means the same thing about the
        // learner either way, but not about the app.
        ["'readingDictation'", "'readingComprehension'", "'vocabQuiz'",
         "'vocabReview'", "'sentenceExercise'"]
            .forEach(source => expect(appSource).toContain(source));
    });
});

/**
 * Listening items: the string[] -> object[] conversion (US-701 / FR-LSN-1).
 *
 * This is the one block in this file that tests BEHAVIOUR rather than structure,
 * and it is here because data.js now carries a normaliser and exports it under a
 * `typeof module` guard. That guard exists for this suite: "a bare string still
 * works" is the whole promise of US-701, and a regex over source text cannot check
 * it. The promise is not hypothetical — service-worker.js serves app.js cache-first
 * and index.html network-first, so a returning learner really can hold one shape in
 * one file and the other shape in the other.
 *
 * THE ZERO-LOSS PROOF lives here too. The 30 sentences are written out below
 * exactly as they were authored as strings, so a conversion that drops, reorders or
 * silently edits one fails a test rather than quietly costing a learner an item.
 */
describe('listening items (US-701 / FR-LSN-1)', () => {
    const Data = require(path.join(ROOT, 'data.js'));
    const { normaliseListeningItem, normaliseListeningList, listeningExercises } = Data;

    // The pre-US-701 content, verbatim. Do not "tidy" this list: it is the
    // before-image half of the proof, not a copy of the current data.
    const AUTHORED = {
        foundation: [
            "Hello, how are you today?",
            "I am learning English every day.",
            "The weather is beautiful outside.",
            "My favorite color is blue.",
            "I like to read books.",
            "She is my best friend.",
            "We go to school together.",
            "The cat is sleeping on the sofa.",
            "I love my family very much.",
            "Today is a wonderful day."
        ],
        everyday: [
            "Practice makes perfect in everything you do.",
            "Learning a new language opens many opportunities.",
            "Success comes to those who work hard.",
            "Understanding different cultures is important.",
            "Knowledge is the key to success.",
            "Every challenge is an opportunity to grow.",
            "Reading helps improve your vocabulary.",
            "Communication skills are essential in life.",
            "Dedication and persistence lead to achievement.",
            "Education is the foundation of progress."
        ],
        confident: [
            "Collaboration enhances productivity and innovation.",
            "Implementing effective strategies requires careful planning.",
            "Understanding different perspectives broadens your worldview.",
            "Demonstrating your skills builds confidence and credibility.",
            "Fundamental principles guide successful decision-making.",
            "Versatile individuals adapt well to changing circumstances.",
            "Significant achievements require consistent effort and determination.",
            "Beneficial habits contribute to long-term success.",
            "Accomplishing goals demands focus and perseverance.",
            "Efficient time management maximizes productivity and results."
        ]
    };

    describe('the normaliser accepts both authored shapes', () => {
        it('normalises the OLD bare-string shape', () => {
            // The shape every item had before US-701, and the one a stale cached
            // data.js still holds. Not a legacy case to be swept up later: a
            // string is a valid shorthand for `{ text: <string> }`, for good.
            expect(normaliseListeningItem('Hello, how are you today?', 'foundation')).toEqual({
                text: 'Hello, how are you today?',
                // FR-A11Y-2 needs a transcript for EVERY audio item, so it
                // defaults to the text rather than to ''. For a TTS-read sentence
                // that is the truth, not a placeholder.
                transcript: 'Hello, how are you today?',
                tier: 'foundation',
                rate: null,
                seconds: null,
                situation: null,
                focus: null,
                notes: null,
                shadow: false,
                // US-702's room, and always an array so a consumer can loop
                // without a guard.
                questions: []
            });
        });

        it('normalises the NEW object shape and keeps every field', () => {
            const q = { question: 'Can the speaker come?', options: ['Yes', 'No'], correct: 1 };
            expect(normaliseListeningItem({
                text: 'Sorry, I can\'t make it.',
                transcript: 'Sorry, I can’t make it — something\'s come up.',
                tier: 'everyday',
                rate: 0.75,
                seconds: 62,
                situation: 'cancelling plans',
                focus: 'connected-speech',
                notes: 'Note the linking in "make it".',
                shadow: true,
                questions: [q]
            }, 'foundation')).toEqual({
                text: 'Sorry, I can\'t make it.',
                transcript: 'Sorry, I can’t make it — something\'s come up.',
                // The item's own tier wins over the map key it was found under.
                tier: 'everyday',
                rate: 0.75,
                seconds: 62,
                situation: 'cancelling plans',
                focus: 'connected-speech',
                notes: 'Note the linking in "make it".',
                shadow: true,
                questions: [q]
            });
        });

        it('copies the questions array rather than aliasing it', () => {
            const authored = { text: 'x', questions: [{ question: 'a' }] };
            const item = normaliseListeningItem(authored, 'foundation');
            item.questions.push({ question: 'b' });
            expect(authored.questions).toHaveLength(1);
        });

        it('accepts only the three speeds FR-LSN-2 names', () => {
            expect(Data.LISTENING_RATES).toEqual([0.75, 1, 1.25]);
            [0.75, 1, 1.25].forEach(rate => {
                expect(normaliseListeningItem({ text: 'x', rate }).rate).toBe(rate);
            });
            // Not snapped to the nearest allowed value: silently changing an
            // authored number is worse than ignoring it, because the author never
            // finds out. null means "no authored default", and the learner's
            // selection decides.
            [0, 2, 1.1, '1', null, NaN].forEach(rate => {
                expect(normaliseListeningItem({ text: 'x', rate }).rate).toBeNull();
            });
        });
    });

    describe('the normaliser refuses what it cannot render', () => {
        // null, not a placeholder item. An item with no text renders an empty card
        // and plays silence, and a learner cannot tell that apart from a broken
        // phone — so the caller drops it and loadListeningExercise() says so.
        it.each([
            ['a number', 42],
            ['null', null],
            ['undefined', undefined],
            ['an array', ['Hello']],
            ['an object with no text', { transcript: 'Hello', questions: [] }],
            ['an empty string', ''],
            ['whitespace only', '   '],
            ['text that is whitespace only', { text: '\n\t ' }],
            ['text that is not a string', { text: 42 }]
        ])('drops %s', (_label, raw) => {
            expect(normaliseListeningItem(raw, 'foundation')).toBeNull();
        });

        it('reads a non-array `questions` as no questions, not as one question', () => {
            // `questions: {}` is an authoring slip. Array.isArray, not truthiness,
            // so it cannot become a single unusable question object.
            expect(normaliseListeningItem({ text: 'x', questions: {} }).questions).toEqual([]);
            expect(normaliseListeningItem({ text: 'x', questions: 'two' }).questions).toEqual([]);
        });

        it('trims, and never returns an empty transcript for a playable item', () => {
            const item = normaliseListeningItem({ text: '  Spaced out  ', transcript: '   ' });
            expect(item.text).toBe('Spaced out');
            // FR-A11Y-2: a whitespace transcript is not a transcript.
            expect(item.transcript).toBe('Spaced out');
        });

        it('drops the unrenderable entries from a list and keeps the rest in order', () => {
            expect(normaliseListeningList(['a', { text: 'b' }, null, { text: '' }, 'c'], 'foundation')
                .map(i => i.text)).toEqual(['a', 'b', 'c']);
            expect(normaliseListeningList('not a list', 'foundation')).toEqual([]);
            expect(normaliseListeningList(undefined)).toEqual([]);
        });
    });

    describe('zero content loss', () => {
        it('keeps the same three tiers', () => {
            expect(Object.keys(listeningExercises)).toEqual(Object.keys(AUTHORED));
        });

        it('keeps 30 items — 10 per tier, the count before the conversion', () => {
            const count = map => Object.keys(map).reduce((n, tier) => n + map[tier].length, 0);
            expect(count(listeningExercises)).toBe(30);
            expect(count(AUTHORED)).toBe(30);
            expect(count(listeningExercises)).toBe(count(AUTHORED));
            Object.keys(AUTHORED).forEach(tier => {
                expect(listeningExercises[tier]).toHaveLength(AUTHORED[tier].length);
            });
        });

        it('preserves every sentence, character for character, in its original position', () => {
            // Position matters as much as content: state.completedExercises holds
            // `listening_<tier>_<index>` stamps, so reordering the array would
            // re-point every stamp a learner has already earned at a different
            // sentence. That is why this compares index by index.
            Object.keys(AUTHORED).forEach(tier => {
                const now = listeningExercises[tier].map(
                    (raw, i) => normaliseListeningItem(raw, tier));
                expect(now.map(item => item && item.text)).toEqual(AUTHORED[tier]);
                // And the transcript half of the promise: every item can answer
                // FR-A11Y-2 without any content being authored for it.
                expect(now.map(item => item && item.transcript)).toEqual(AUTHORED[tier]);
            });
        });

        it('has no authored item the normaliser refuses', () => {
            Object.keys(listeningExercises).forEach(tier => {
                listeningExercises[tier].forEach((raw, i) => {
                    expect(normaliseListeningItem(raw, tier)).not.toBeNull();
                });
            });
        });

        it('authors no comprehension question yet, and says so here (US-702)', () => {
            // Deliberate. US-701 makes the FIELD exist; authoring the questions is
            // US-702's 5 points and a content-review job. If this ever fails
            // because questions have arrived, the `lsn.gist` producer note in
            // app.js (drillDestinations, and the 'listen.comprehend' surface
            // predicate) has to be revisited in the same commit — a question with
            // no renderer is a step the session planner would promise and no
            // screen could honour.
            const all = Object.keys(listeningExercises)
                .flatMap(tier => listeningExercises[tier].map(raw => normaliseListeningItem(raw, tier)));
            expect(all).toHaveLength(30);
            expect(all.every(item => item.questions.length === 0)).toBe(true);
        });
    });
});

/**
 * The listening surface: transcript gating, speed control and the text route
 * (US-703 / US-704 / US-711 — FR-LSN-2, FR-LSN-3, FR-LSN-4, FR-A11Y-2).
 *
 * Half markup contract, half static source check, for the same reason as the
 * pronunciation block above: app.js cannot be required, and the failure these
 * guard against is silent. A transcript that leaks before the attempt does not
 * throw — it renders perfectly and quietly turns a listening exercise into a
 * reading exercise, which is exactly what this section did before US-703.
 */
describe('listening transcript gate, speed and text route (US-703 / US-704 / US-711)', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const section = () => doc.getElementById('listening');

    /** The body of one top-level function, by brace matching. */
    function functionBody(header) {
        const start = appSource.indexOf(header);
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces after ' + header);
    }

    describe('the markup starts with the transcript unreachable (FR-LSN-3)', () => {
        it('ships #listenSentence empty and masked', () => {
            // No JS has run yet. A sentence in the markup would be the leak in its
            // purest form: visible in "view source" before the learner has heard
            // anything at all.
            const el = doc.getElementById('listenSentence');
            expect(el).not.toBeNull();
            expect(el.textContent.trim()).toBe('');
            expect(el.classList.contains('is-masked')).toBe(true);
        });

        it('ships #revealTranscript hidden', () => {
            const btn = doc.getElementById('revealTranscript');
            expect(btn).not.toBeNull();
            expect(btn.tagName).toBe('BUTTON');
            // `hidden`, not display:none in a style attribute — app.js toggles the
            // attribute, and a screen reader must not reach a control that is not
            // available yet.
            expect(btn.hasAttribute('hidden')).toBe(true);
            expect(btn.closest('#listening')).not.toBeNull();
        });

        it('ships the Read Aloud card locked, with the reason on screen', () => {
            // #targetWord IS the transcript. An open Read Aloud card before the
            // attempt is not a second exercise, it is the same leak one card down.
            const target = doc.getElementById('targetWord');
            expect(target.textContent.trim()).toBe('');
            expect(doc.getElementById('startSpeech').hasAttribute('disabled')).toBe(true);
            const lock = doc.getElementById('readAloudLock');
            expect(lock).not.toBeNull();
            expect(lock.closest('#listening')).not.toBeNull();
            // FR-A11Y-5's cousin: a disabled control with no explanation is its own
            // small dishonesty.
            expect(lock.textContent.trim().length).toBeGreaterThan(0);
        });

        it('has a no-microphone attempt route (FR-A11Y-4)', () => {
            // Recording was the only way to finish an item, so a refused
            // microphone ended the section — and after US-703 would also have made
            // the transcript unreachable for good. R-7 says learners do refuse.
            const btn = doc.getElementById('listeningRepeated');
            expect(btn).not.toBeNull();
            expect(btn.tagName).toBe('BUTTON');
            expect(btn.hasAttribute('disabled')).toBe(false);
            expect(btn.closest('#listening')).not.toBeNull();
        });

        it('has the FR-A11Y-2 text route as an unchecked checkbox with a note', () => {
            const box = doc.getElementById('listeningTextRoute');
            expect(box).not.toBeNull();
            expect(box.type).toBe('checkbox');
            // Default OFF: FR-LSN-3 is the rule and this is the exception, so the
            // markup may not ship with the exception already applied.
            expect(box.checked).toBe(false);
            // A real <label for>, so the 44px target and the screen-reader name
            // come from the markup rather than from JS.
            expect(doc.querySelector('label[for="listeningTextRoute"]')).not.toBeNull();
            expect(doc.getElementById('listeningTextRouteNote')).not.toBeNull();
        });
    });

    describe('the speed control (US-704 / FR-LSN-2)', () => {
        it('offers exactly 0.75x, 1x and 1.25x, as toggle buttons', () => {
            const buttons = Array.from(
                section().querySelectorAll('#listeningSpeed .lsn-speed-btn'));
            expect(buttons.map(b => b.getAttribute('data-rate'))).toEqual(['0.75', '1', '1.25']);
            buttons.forEach(b => {
                expect(b.tagName).toBe('BUTTON');
                expect(['true', 'false']).toContain(b.getAttribute('aria-pressed'));
            });
            // One pressed in the markup, so the control reads correctly before any
            // JS runs — and exactly one, or it reads as two speeds at once.
            expect(buttons.filter(b => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
            expect(buttons.filter(b => b.classList.contains('active'))).toHaveLength(1);
        });

        it('never uses .diff-btn for the speed buttons', () => {
            // Same reasoning as the pronunciation group switcher: these pick a
            // SPEED, and a learner must not read them as the app-wide tier control.
            // The registry-driven assertion above already requires this section to
            // have no .diff-btn at all; this states the intent.
            expect(section().querySelectorAll('.diff-btn')).toHaveLength(0);
            expect(Sections.get('listening').hasDifficulty).toBe(false);
        });

        it('applies the chosen rate to speechAPI.speak', () => {
            // The whole of US-704's single point: the parameter has always been
            // there and was never varied. `speechAPI.speak(this.dataset.text)` with
            // no second argument was the old call.
            const play = functionBody('function playListeningItem(');
            expect(play).toMatch(/speechAPI\.speak\(\s*listeningSession\.item\.text,\s*listeningRateFor\(listeningSession\.item\)\s*\)/);
            const rate = functionBody('function listeningRateFor(');
            // Learner's choice first, the item's authored default second, 1 last.
            expect(rate).toMatch(/if \(listeningRate !== null\) return listeningRate;/);
            expect(rate).toMatch(/item\.rate/);
        });

        it('keeps the chosen rate out of saved progress, deliberately', () => {
            // The decision, pinned: the speed is a page-session variable, so a
            // learner who slows one hard clip down is not still hearing everything
            // at 0.75x next month without knowing why. If someone moves it into
            // `state` it will be written by saveProgress()'s `...state` spread on
            // the very next tick, so this has to be a test and not a comment.
            expect(appSource).toMatch(/^let listeningRate = null;$/m);
            expect(appSource).not.toMatch(/state\.listeningRate/);
            expect(functionBody('function loadProgress(')).not.toContain('listeningRate');
        });

        it('persists the text route, which is a fact about the learner', () => {
            // The other half of that decision, and the reason the asymmetry is not
            // an oversight: a learner who cannot hear should say so once.
            expect(appSource).toMatch(/listeningTextRoute: false/);
            expect(functionBody('function loadProgress('))
                .toContain('state.listeningTextRoute = loaded.listeningTextRoute === true;');
            // `=== true`, so a corrupt record cannot switch FR-LSN-3 off for a
            // learner who never asked.
            expect(functionBody('function listeningTextRouteOn('))
                .toContain('state.listeningTextRoute === true');
        });
    });

    describe('app.js keeps the transcript out of the document until the reveal', () => {
        it('no longer parks the sentence on #playListening.dataset.text', () => {
            // The old leak, exactly: loadListeningExercise() wrote the sentence to
            // a data attribute on the Play button and the read-aloud handler read
            // it back, so the transcript was in the markup from the moment the
            // section opened. Both are gone; the mentions that remain are the
            // comments explaining why.
            expect(appSource).not.toMatch(/playListening'\)\.dataset\.text\s*=/);
            expect(appSource).not.toMatch(/getElementById\('playListening'\)\.dataset\.text \|\|/);
            // Playback and the read-aloud target both come from the session object.
            expect(functionBody('function playListeningItem('))
                .toContain('listeningSession.item.text');
        });

        it('writes the transcript from exactly one function', () => {
            // Two functions touch #listenSentence / #targetWord: the loader (which
            // masks them) and the reveal (which fills them). A third write site is
            // how a gate like this comes undone.
            const writers = ['function loadListeningExercise(', 'function revealListeningTranscript(']
                .map(header => functionBody(header));
            const bodies = writers.join('\n');
            const occurrences = (appSource.match(/getElementById\('listenSentence'\)/g) || []).length;
            expect(occurrences).toBe(2);
            expect((bodies.match(/getElementById\('listenSentence'\)/g) || []).length).toBe(2);
            // Only the reveal puts item.transcript on screen.
            expect(functionBody('function revealListeningTranscript('))
                .toMatch(/host\.textContent = listeningSession\.item\.transcript;/);
            expect(functionBody('function loadListeningExercise('))
                .not.toContain('item.transcript');
        });

        it('re-masks on every load, so Next -> closes the gate again', () => {
            const body = functionBody('function loadListeningExercise(');
            // A FRESH session object per load, with the gate shut. Asserted field
            // by field rather than as one source line: US-136 added `promptId` to
            // the literal and broke it across lines, and a test that pins the
            // formatting forbids ever adding a field to it.
            expect(body).toMatch(/listeningSession = \{/);
            ['item: item', 'attempted: false', 'revealed: false', 'route: null', 'plays: 0']
                .forEach(field => expect(body).toContain(field));
            expect(body).toContain("host.classList.add('is-masked')");
            expect(body).toContain('if (reveal) reveal.hidden = true;');
            expect(body).toContain('if (speak) speak.disabled = true;');
            expect(body).toContain('if (lock) lock.hidden = false;');
            // The one exception, and it is last: the learner's own declaration.
            expect(body).toContain("if (listeningTextRouteOn()) revealListeningTranscript('no-audio');");
        });

        it('shows the reveal button only after an attempt, and only on demand', () => {
            // FR-A11Y-2 says "on demand"; FR-LSN-4 says replay precedes transcript,
            // always. So an attempt UNHIDES the button and does not press it.
            const body = functionBody('function markListeningAttempt(');
            expect(body).toContain('listeningSession.attempted = true;');
            expect(body).toMatch(/if \(reveal && !listeningSession\.revealed\) reveal\.hidden = false;/);
            expect(body).not.toContain('revealListeningTranscript(');
        });

        it('says what has no sentence in it rather than drawing an empty card', () => {
            // normaliseListeningItem() returns null for an unrenderable entry. An
            // empty card is indistinguishable from a broken device.
            const body = functionBody('function loadListeningExercise(');
            expect(body).toMatch(/if \(!item\) \{/);
            expect(body).toMatch(/no sentence in it/);
        });
    });

    describe('completion, and what the routes are allowed to claim (BR-3)', () => {
        it('counts a listening exercise from exactly one place', () => {
            // Was two inline copies — the recording handler and the read-aloud
            // handler — and a third route was about to make it three. One call
            // site means a route cannot count without opening the transcript gate,
            // or open it without counting.
            expect((appSource.match(/markExerciseComplete\('listening'/g) || [])).toHaveLength(1);
            expect((appSource.match(/updateStatistics\('listening'/g) || [])).toHaveLength(1);
            expect(functionBody('function markListeningAttempt('))
                .toContain("markExerciseComplete('listening', state.currentListeningIndex);");
            ["markListeningAttempt('recorded', true)",
             "markListeningAttempt('self-report', true)",
             "markListeningAttempt('read-aloud', true)"]
                .forEach(call => expect(appSource).toContain(call));
        });

        it('never credits an item for revealing the transcript', () => {
            // I-8 is the crossword granting the daily puzzle goal for an untouched
            // grid. Revealing a sentence and being credited for it would be the
            // same defect in this section, and the FR-A11Y-2 route is exactly
            // where it would land.
            const reveal = functionBody('function revealListeningTranscript(');
            expect(reveal).not.toContain('markExerciseComplete');
            expect(reveal).not.toContain('updateStatistics');
            expect(reveal).not.toContain('markListeningAttempt');
            expect(reveal).not.toContain('dailyGoals');
        });

        it('refuses a self-reported attempt on an item that was never played', () => {
            // "I said it" has to be true about something. The text route is exempt
            // because it has nothing to play.
            const handler = appSource.slice(
                appSource.indexOf("wireListening('listeningRepeated'"),
                appSource.indexOf("wireListening('listeningTextRoute'"));
            expect(handler).toMatch(/if \(!listeningTextRouteOn\(\) && listeningSession && listeningSession\.plays === 0\)/);
            expect(handler.indexOf('return;')).toBeLessThan(handler.indexOf('markListeningAttempt('));
        });

        it('gives a wrong read-aloud a reason, a slowed replay and a retry', () => {
            // TEACHING_METHODOLOGY.md principle 2 and FR-LSN-4. renderSpeechDiff()
            // was the contrast and the whole of the feedback; a marked-up sentence
            // with no idea what to do about it is the "Wrong" that principle exists
            // to forbid.
            const body = functionBody('function appendReadAloudRetry(');
            expect(body).toContain('question-reason');
            expect(body).toContain('question-retry');
            // The replay is the FR-LSN-4 "replay the relevant clip", slowed as
            // TEACHING_METHODOLOGY.md §2 asks.
            expect(body).toMatch(/speechAPI\.speak\(listeningSession\.item\.text, 0\.75\)/);
            // Principle 3: a recogniser miss is not proof of a mispronunciation,
            // and the copy has to say so.
            expect(body).toMatch(/sometimes it is the recogniser rather than you/);
            // Called on the miss branch, after the diff is drawn.
            const handler = functionBody('function initializeListeningButtons(');
            expect(handler).toContain("appendReadAloudRetry('speechFeedback', diff)");
            expect(handler.indexOf("renderSpeechDiff('speechFeedback', diff)"))
                .toBeLessThan(handler.indexOf("appendReadAloudRetry('speechFeedback', diff)"));
        });

        it('replaces the microphone-denied dead end with the other route', () => {
            // Was `alert('Microphone access denied')` and nothing else: recording
            // was the only attempt route, so the section ended there (R-7).
            // Scoped to the handler, not the file: the comment above the new catch
            // block quotes the old line on purpose.
            const handler = appSource.slice(
                appSource.indexOf("document.getElementById('startRecording').onclick"),
                appSource.indexOf("document.getElementById('stopRecording').onclick"));
            // Comment lines stripped: the new catch block quotes the old `alert`
            // line on purpose, and a test that cannot tell code from a comment
            // about the code would forbid explaining the fix.
            const code = handler.split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
            expect(code).not.toMatch(/\balert\(/);
            expect(code).toMatch(/I said it/);
            expect(code).toContain("AppErrorHandler.logError(e, 'listening recording')");
        });

        it('leaves lsn.gist without a producer, and says where that is recorded', () => {
            // US-701 makes a gist question POSSIBLE — every item carries a
            // `questions` array now — and does not make one exist. Both places that
            // claim this must keep claiming it until US-702 lands, or the session
            // planner will offer a comprehension step no screen can draw.
            expect(appSource).not.toContain("Mistakes.record('lsn.gist'");
            expect(appSource).toMatch(/'listen\.comprehend': \{\s*\n\s*available: false,/);
            const Mistakes = require(path.join(ROOT, 'js', 'core', 'mistakes.js'));
            expect(Mistakes.unknownCategories(['lsn.gist'])).toEqual([]);
        });
    });
});

// ===========================================================================
// RECORDING ARCHIVE (US-136 / US-404) — the fake IndexedDB, and why it is here
// ===========================================================================
//
// COPIED VERBATIM from __tests__/unit/blobstore.test.js, whose header explains
// every design decision in it and, just as importantly, the seven things a fake
// cannot prove (structured-cloning a real Blob, a real per-origin quota, storage
// pressure, Safari private browsing, cross-tab versionchange, transaction
// auto-commit timing, WebKit's silent open()). Read that header before trusting a
// green run here; none of it is restated.
//
// Copied rather than imported because that file is a suite, not a module: it
// exports nothing, and requiring it would re-run 224 tests inside this one. It is
// not modified. If it changes, this copy is stale and should be re-copied.
//
// What it is for HERE: js/core/blobstore.js is 100% IndexedDB and jsdom has none,
// so the only way to walk the archive the way a learner does — record, leave the
// sentence, come back, delete one — is to inject this and drive the REAL store.
// ===========================================================================
// ===========================================================================
// The fake IndexedDB
// ===========================================================================

function domError(name, message) {
    const e = new Error(message || name);
    e.name = name;
    return e;
}

/**
 * IndexedDB key ordering, per spec §key-construct: number < date < string <
 * binary < array; arrays compare element-wise and a shorter array that is a
 * prefix of a longer one sorts first. `list()` depends on this being right:
 * `bound([key], [key, []])` only isolates one prompt because every number sorts
 * before every array, so `[key, <any createdAt>]` < `[key, []]`.
 */
function keyRank(k) {
    if (Array.isArray(k)) return 4;
    if (typeof k === 'number') return 1;
    if (k instanceof Date) return 2;
    if (typeof k === 'string') return 3;
    return 0;
}

function compareKeys(a, b) {
    const ra = keyRank(a);
    const rb = keyRank(b);
    if (ra !== rb) return ra < rb ? -1 : 1;
    if (ra === 4) {
        const n = Math.min(a.length, b.length);
        for (let i = 0; i < n; i++) {
            const c = compareKeys(a[i], b[i]);
            if (c !== 0) return c;
        }
        if (a.length === b.length) return 0;
        return a.length < b.length ? -1 : 1;
    }
    if (ra === 2) return a.getTime() - b.getTime();
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

class FakeKeyRange {
    constructor(lower, upper, lowerOpen, upperOpen) {
        this.lower = lower;
        this.upper = upper;
        this.lowerOpen = !!lowerOpen;
        this.upperOpen = !!upperOpen;
    }
    includes(key) {
        if (this.lower !== undefined) {
            const c = compareKeys(key, this.lower);
            if (c < 0 || (c === 0 && this.lowerOpen)) return false;
        }
        if (this.upper !== undefined) {
            const c = compareKeys(key, this.upper);
            if (c > 0 || (c === 0 && this.upperOpen)) return false;
        }
        return true;
    }
    static bound(lower, upper, lowerOpen, upperOpen) {
        if (lower === undefined || upper === undefined) throw domError('DataError');
        if (compareKeys(lower, upper) > 0) throw domError('DataError');
        return new FakeKeyRange(lower, upper, lowerOpen, upperOpen);
    }
    static only(value) { return new FakeKeyRange(value, value, false, false); }
    static lowerBound(v, open) { return new FakeKeyRange(v, undefined, open, false); }
    static upperBound(v, open) { return new FakeKeyRange(undefined, v, false, open); }
}

/** Blob-shaped things pass by reference; everything else is copied, as a
 *  structured clone would be (see caveat 1 in the header). */
function isBlobLike(v) {
    return !!v && typeof v === 'object' &&
        typeof v.size === 'number' && typeof v.type === 'string' &&
        typeof v.promptId === 'undefined';
}

function cloneValue(v) {
    if (Array.isArray(v)) return v.map(cloneValue);
    if (v && typeof v === 'object') {
        if (isBlobLike(v)) return v;
        if (v instanceof Date) return new Date(v.getTime());
        const out = {};
        Object.keys(v).forEach((k) => { out[k] = cloneValue(v[k]); });
        return out;
    }
    return v;
}

/** Only blob payload bytes count against the fake budget; metadata rows are
 *  free. That keeps the quota arithmetic in the tests readable. */
function bytesOf(value) {
    if (value && value.blob && typeof value.blob.size === 'number') return value.blob.size;
    return 0;
}

class FakeObjectStore {
    constructor(db, name, options) {
        this.db = db;
        this.name = name;
        this.keyPath = (options && options.keyPath) || null;
        this.autoIncrement = !!(options && options.autoIncrement);
        this.nextKey = 1;
        this.records = new Map();      // key -> { value, bytes }
        this.indexes = new Map();
    }

    createIndex(name, keyPath, options) {
        const idx = { name: name, keyPath: keyPath, unique: !!(options && options.unique) };
        this.indexes.set(name, idx);
        return idx;
    }

    _write(key, value) {
        const factory = this.db.factory;
        // Models an engine that accepts the write but loses the Blob — the exact
        // WebKit failure available({deep:true}) exists to detect.
        if (factory.dropBlobs && value && value.blob) value.blob = null;
        const incoming = bytesOf(value);
        const existing = this.records.has(key) ? this.records.get(key).bytes : 0;
        const used = this.db._usedBytes();
        if (used - existing + incoming > factory.budget) {
            throw domError('QuotaExceededError', 'The quota has been exceeded.');
        }
        this.records.set(key, { value: value, bytes: incoming });
    }
}

class FakeRequest {
    constructor(source, tx) {
        this.source = source;
        this.transaction = tx;
        this.result = undefined;
        this.error = null;
        this.onsuccess = null;
        this.onerror = null;
    }
}

class FakeStoreHandle {
    constructor(tx, store) {
        this.tx = tx;
        this.store = store;
        this.name = store.name;
    }

    _readonlyGuard() {
        if (this.tx.mode !== 'readwrite' && this.tx.mode !== 'versionchange') {
            throw domError('ReadOnlyError');
        }
    }

    index(name) {
        const idx = this.store.indexes.get(name);
        if (!idx) throw domError('NotFoundError');
        return new FakeIndexHandle(this.tx, this.store, idx);
    }

    get(key) {
        return this.tx._enqueue(this.store, 'get', key, () => {
            const hit = this.store.records.get(key);
            return hit ? cloneValue(hit.value) : undefined;
        });
    }

    getAll() {
        return this.tx._enqueue(this.store, 'getAll', null, () => {
            return Array.from(this.store.records.keys())
                .sort(compareKeys)
                .map((k) => cloneValue(this.store.records.get(k).value));
        });
    }

    add(value) {
        this._readonlyGuard();
        return this.tx._enqueue(this.store, 'add', null, () => {
            const rec = cloneValue(value);
            let key = this.store.keyPath ? rec[this.store.keyPath] : undefined;
            if (key === undefined || key === null) {
                if (!this.store.autoIncrement) throw domError('DataError');
                key = this.store.nextKey;
                this.store.nextKey += 1;
                if (this.store.keyPath) rec[this.store.keyPath] = key;
            } else if (this.store.autoIncrement && typeof key === 'number' && key >= this.store.nextKey) {
                this.store.nextKey = Math.floor(key) + 1;
            }
            if (this.store.records.has(key)) throw domError('ConstraintError');
            this.store._write(key, rec);
            return key;
        });
    }

    put(value) {
        this._readonlyGuard();
        return this.tx._enqueue(this.store, 'put', null, () => {
            const rec = cloneValue(value);
            let key = this.store.keyPath ? rec[this.store.keyPath] : undefined;
            if (key === undefined || key === null) {
                if (!this.store.autoIncrement) throw domError('DataError');
                key = this.store.nextKey;
                this.store.nextKey += 1;
                if (this.store.keyPath) rec[this.store.keyPath] = key;
            }
            this.store._write(key, rec);
            return key;
        });
    }

    delete(key) {
        this._readonlyGuard();
        return this.tx._enqueue(this.store, 'delete', key, () => {
            this.store.records.delete(key);
            return undefined;
        });
    }

    clear() {
        this._readonlyGuard();
        return this.tx._enqueue(this.store, 'clear', null, () => {
            this.store.records.clear();
            return undefined;
        });
    }
}

class FakeIndexHandle {
    constructor(tx, store, idx) {
        this.tx = tx;
        this.store = store;
        this.idx = idx;
        this.name = idx.name;
    }

    _keyFor(value) {
        const paths = Array.isArray(this.idx.keyPath) ? this.idx.keyPath : [this.idx.keyPath];
        const parts = [];
        for (let i = 0; i < paths.length; i++) {
            const v = value[paths[i]];
            if (v === undefined || v === null) return undefined;   // row not in the index
            parts.push(v);
        }
        return Array.isArray(this.idx.keyPath) ? parts : parts[0];
    }

    getAll(range) {
        return this.tx._enqueue(this.store, 'index.getAll', null, () => {
            const hits = [];
            this.store.records.forEach((entry) => {
                const k = this._keyFor(entry.value);
                if (k === undefined) return;
                if (range && typeof range.includes === 'function' && !range.includes(k)) return;
                hits.push({ k: k, value: entry.value });
            });
            hits.sort((a, b) => compareKeys(a.k, b.k));
            return hits.map((h) => cloneValue(h.value));
        });
    }
}

class FakeTransaction {
    constructor(db, names, mode) {
        this.db = db;
        this.mode = mode;
        this.names = names;
        this.error = null;
        this.oncomplete = null;
        this.onabort = null;
        this.onerror = null;

        this._queue = [];
        this._finished = false;
        this._scheduled = false;

        // Rollback support: the fake writes live and restores on abort.
        this._snapshots = new Map();
        names.forEach((n) => {
            const s = db._store(n);
            this._snapshots.set(n, { records: new Map(s.records), nextKey: s.nextKey });
        });

        db.factory.txCount += 1;
    }

    objectStore(name) {
        if (this.names.indexOf(name) === -1) throw domError('NotFoundError');
        if (this._finished) throw domError('TransactionInactiveError');
        return new FakeStoreHandle(this, this.db._store(name));
    }

    abort() {
        if (this._finished) throw domError('InvalidStateError');
        this._abort(domError('AbortError'), false);
    }

    _enqueue(store, op, key, run) {
        if (this._finished) throw domError('TransactionInactiveError');
        const req = new FakeRequest(store, this);
        this.db.factory.ops.push({ store: store.name, op: op, key: key });
        this._queue.push({ req: req, run: run, store: store.name, op: op, key: key });
        this._schedule();
        return req;
    }

    _schedule() {
        if (this._scheduled) return;
        this._scheduled = true;
        Promise.resolve().then(() => {
            this._scheduled = false;
            this._drain();
        });
    }

    _drain() {
        let guard = 0;
        while (!this._finished && this._queue.length) {
            if (++guard > 5000) throw new Error('fake IndexedDB: runaway request queue');
            const entry = this._queue.shift();
            this._execute(entry);
        }
        if (!this._finished) this._commit();
    }

    _execute(entry) {
        const req = entry.req;
        let value;
        let err = null;

        // Per-operation error injection: DataCloneError on the payload, a generic
        // request failure, etc. `errorHook(store, op, key)` returns an Error or null.
        const hook = this.db.factory.errorHook;
        if (typeof hook === 'function') {
            err = hook(entry.store, entry.op, entry.key) || null;
        }

        if (!err) {
            try {
                value = entry.run();
            } catch (e) {
                err = e;
            }
        }

        if (err) {
            req.error = err;
            let prevented = false;
            const ev = {
                target: req,
                type: 'error',
                preventDefault: function () { prevented = true; },
                stopPropagation: function () {}
            };
            if (typeof req.onerror === 'function') {
                try { req.onerror(ev); } catch (e2) { /* a throwing handler still aborts */ }
            }
            // Real IndexedDB: an unhandled request error aborts the transaction.
            if (!prevented) this._abort(err, true);
            return;
        }

        req.result = value;
        if (typeof req.onsuccess === 'function') {
            try {
                req.onsuccess({ target: req, type: 'success' });
            } catch (e3) {
                this._abort(e3, true);
            }
        }
    }

    _commit() {
        this._finished = true;
        const fn = this.oncomplete;
        Promise.resolve().then(() => { if (typeof fn === 'function') fn({ type: 'complete' }); });
    }

    _abort(err, fromRequest) {
        if (this._finished) return;
        this._finished = true;
        this._queue.length = 0;
        this._snapshots.forEach((snap, name) => {
            const s = this.db._store(name);
            s.records = new Map(snap.records);
            s.nextKey = snap.nextKey;
        });
        this.error = err || domError('AbortError');
        const onError = this.onerror;
        const onAbort = this.onabort;
        Promise.resolve().then(() => {
            // Real order for a failed request: request error -> tx error -> tx abort.
            if (fromRequest && typeof onError === 'function') onError({ type: 'error' });
            if (typeof onAbort === 'function') onAbort({ type: 'abort' });
        });
    }
}

class FakeDatabase {
    constructor(factory, name) {
        this.factory = factory;
        this.name = name;
        this.version = 0;
        this.stores = new Map();
        this.onversionchange = null;
        this.onclose = null;
        this._closed = false;
    }

    get objectStoreNames() {
        const names = Array.from(this.stores.keys());
        names.contains = (n) => names.indexOf(n) !== -1;
        return names;
    }

    _store(name) {
        const s = this.stores.get(name);
        if (!s) throw domError('NotFoundError');
        return s;
    }

    _usedBytes() {
        let sum = 0;
        this.stores.forEach((s) => { s.records.forEach((e) => { sum += e.bytes; }); });
        return sum;
    }

    createObjectStore(name, options) {
        const s = new FakeObjectStore(this, name, options);
        this.stores.set(name, s);
        return s;
    }

    transaction(names, mode) {
        if (this.factory.txThrows) throw domError(this.factory.txThrows);
        if (this._closed) throw domError('InvalidStateError');
        const list = typeof names === 'string' ? [names] : Array.prototype.slice.call(names);
        list.forEach((n) => { if (!this.stores.has(n)) throw domError('NotFoundError'); });
        return new FakeTransaction(this, list, mode || 'readonly');
    }

    close() { this._closed = true; }
}

/**
 * @param {Object} [opts]
 *   openMode: 'ok' | 'throw' | 'error' | 'blocked' | 'silent'
 *   budget:   bytes of blob payload the whole database may hold
 */
class FakeIndexedDB {
    constructor(opts) {
        const o = opts || {};
        this.openMode = o.openMode || 'ok';
        this.budget = typeof o.budget === 'number' ? o.budget : Infinity;
        this.txThrows = o.txThrows || null;
        this.errorHook = o.errorHook || null;
        this.dropBlobs = !!o.dropBlobs;
        this.extraErrorAfterSuccess = !!o.extraErrorAfterSuccess;
        this.openCount = 0;
        this.txCount = 0;
        this.ops = [];
        this.db = null;
        this.schemaThrows = !!o.schemaThrows;
    }

    open(name, version) {
        this.openCount += 1;
        if (this.openMode === 'throw') throw domError('InvalidStateError', 'private browsing');

        const req = new FakeRequest(null, null);
        req.onupgradeneeded = null;
        req.onblocked = null;

        const mode = this.openMode;
        Promise.resolve().then(() => {
            if (mode === 'silent') return;                 // WebKit: no event, ever
            if (mode === 'blocked') {
                if (typeof req.onblocked === 'function') req.onblocked({ type: 'blocked' });
                return;
            }
            if (mode === 'error') {
                req.error = domError('UnknownError', 'open failed');
                if (typeof req.onerror === 'function') req.onerror({ type: 'error', target: req });
                return;
            }

            if (!this.db) this.db = new FakeDatabase(this, name);
            const db = this.db;
            db._closed = false;
            req.result = db;

            const oldVersion = db.version;
            if (version > db.version) {
                // A versionchange transaction, so a throwing upgrade can abort it.
                const upgradeTx = new FakeTransaction(db, [], 'versionchange');
                req.transaction = upgradeTx;
                let aborted = false;
                upgradeTx.abort = function () { aborted = true; };
                db.version = version;
                if (this.schemaThrows) {
                    // Simulate createObjectStore blowing up inside onupgradeneeded.
                    const realCreate = db.createObjectStore.bind(db);
                    db.createObjectStore = function () { throw domError('InvalidStateError'); };
                    if (typeof req.onupgradeneeded === 'function') {
                        req.onupgradeneeded({ type: 'upgradeneeded', oldVersion: oldVersion, target: req });
                    }
                    db.createObjectStore = realCreate;
                } else if (typeof req.onupgradeneeded === 'function') {
                    req.onupgradeneeded({ type: 'upgradeneeded', oldVersion: oldVersion, target: req });
                }
                if (aborted) {
                    db.version = oldVersion;
                    db.stores.clear();
                    req.error = domError('AbortError');
                    if (typeof req.onerror === 'function') req.onerror({ type: 'error', target: req });
                    return;
                }
            }
            if (typeof req.onsuccess === 'function') req.onsuccess({ type: 'success', target: req });
            if (this.extraErrorAfterSuccess) {
                // A misbehaving engine firing a second event on an already-settled
                // request. openDb()'s `settled` latch has to absorb it.
                req.error = domError('UnknownError', 'late error');
                if (typeof req.onerror === 'function') req.onerror({ type: 'error', target: req });
                if (typeof req.onblocked === 'function') req.onblocked({ type: 'blocked' });
            }
        });

        return req;
    }

    // ---- test-side inspection -------------------------------------------
    metaRows() {
        if (!this.db || !this.db.stores.has('recordings')) return [];
        return Array.from(this.db.stores.get('recordings').records.values())
            .map((e) => e.value)
            .sort((a, b) => a.id - b.id);
    }
    /** Write straight into the store, bypassing put() — for rows put() would
     *  never produce (garbage, the reserved PROBE_ID, an over-cap archive). */
    seedMeta(rows) {
        const s = this.db._store('recordings');
        rows.forEach((r) => {
            s.records.set(r.id, { value: r, bytes: 0 });
            if (typeof r.id === 'number' && r.id >= s.nextKey) s.nextKey = Math.floor(r.id) + 1;
        });
    }
    seedAudio(entries) {
        const s = this.db._store('audio');
        entries.forEach((e) => { s.records.set(e.id, { value: e, bytes: bytesOf(e) }); });
    }
    audioIds() {
        if (!this.db || !this.db.stores.has('audio')) return [];
        return Array.from(this.db.stores.get('audio').records.keys()).sort((a, b) => a - b);
    }
    ids() { return this.metaRows().map((r) => r.id); }
    usedBytes() { return this.db ? this.db._usedBytes() : 0; }
    opsOn(storeName, op) {
        return this.ops.filter((o) => o.store === storeName && (!op || o.op === op));
    }
}


// ===========================================================================
// US-136 — the recording archive gets a caller
// ===========================================================================
//
// HOW app.js IS TESTED HERE, GIVEN THAT IT CANNOT BE REQUIRED
// ----------------------------------------------------------
// __tests__/README.md is right: app.js is one classic script with top-level side
// effects and no exports. Every other app.js assertion in this file is therefore
// a read over its SOURCE TEXT, and for wiring that is enough.
//
// It is NOT enough for the one thing US-136 turns on. `promptId` must be stable
// content identity, and "the source mentions listeningPromptId" proves nothing
// about whether inserting a sentence moves a learner's recording. So the archive
// module in app.js is deliberately written as a self-contained IIFE between two
// sentinel comments, depending on `window.BlobStore`, `document` and `navigator`
// and on nothing else in app.js — and the block below extracts that source and
// evaluates it. What runs in these tests is the shipped code, not a copy of it.
//
// The seam is load-bearing: if the module ever reaches for an app.js global, the
// first test here fails with a ReferenceError, which is the correct outcome.

describe('recording archive — stable content identity (US-136 / FR-SPK-6)', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const Data = require(path.join(ROOT, 'data.js'));
    const { normaliseListeningItem, listeningExercises } = Data;
    const BlobStore = require(path.join(ROOT, 'js', 'core', 'blobstore.js'));

    const BEGIN = '// ===== BEGIN RECORDING ARCHIVE (US-136) =====';
    const END = '// ===== END RECORDING ARCHIVE (US-136) =====';

    /** The body of one top-level function, by brace matching. */
    function functionBody(header) {
        const start = appSource.indexOf(header);
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces after ' + header);
    }

    function archiveSource() {
        const from = appSource.indexOf(BEGIN);
        const to = appSource.indexOf(END);
        expect(from).toBeGreaterThan(-1);
        expect(to).toBeGreaterThan(from);
        return appSource.slice(from, to);
    }

    /**
     * Source with the comments stripped.
     *
     * Needed because the assertions below forbid particular CODE — an index near
     * the archive, a cross-surface revokeAll() — and the module's own header
     * explains at length why each of those would be wrong. A test that cannot tell
     * code from a comment about the code forbids explaining the decision, which is
     * the same reasoning the microphone-denied test above already uses.
     */
    function codeOnly(source) {
        return source
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .filter(line => !/^\s*\/\//.test(line))
            .join('\n');
    }

    /**
     * The real module, with an injected `window`. `document` inside it resolves to
     * jsdom's, so render() draws into the live document.
     */
    function loadArchive(win) {
        const factory = new Function('window',
            archiveSource() + '\n;return window.RecordingArchive;');
        return factory(win);
    }

    // --- stand-ins for the four browser APIs the module touches --------------

    function FakeBlob(parts, opts) {
        this.size = (parts || []).reduce((n, p) => n + ((p && p.size) || 0), 0);
        this.type = (opts && opts.type) || '';
    }

    class FakeMediaRecorder {
        constructor(stream) {
            this.stream = stream;
            this.state = 'inactive';
            this.mimeType = 'audio/webm;codecs=opus';
        }
        start() { this.state = 'recording'; }
        stop() {
            this.state = 'inactive';
            if (this.ondataavailable) {
                this.ondataavailable({ data: { size: FakeMediaRecorder.chunkSize, type: this.mimeType } });
            }
            if (this.onstop) this.onstop();
        }
    }
    FakeMediaRecorder.chunkSize = 2048;

    /** Does NOT end by itself: the object-url tests need a url that stays live
     *  while "playing", which is precisely the state a leak lives in. */
    function FakeAudio(url) {
        this.src = url;
        this.paused = false;
        FakeAudio.instances.push(this);
    }
    FakeAudio.instances = [];
    FakeAudio.prototype.play = function () {
        FakeAudio.played.push(this.src);
        if (FakeAudio.autoEnd && this.onended) {
            const self = this;
            Promise.resolve().then(() => { if (self.onended) self.onended(); });
        }
        return Promise.resolve();
    };
    FakeAudio.prototype.pause = function () { this.paused = true; };
    FakeAudio.played = [];
    FakeAudio.autoEnd = false;
    FakeAudio.reset = () => { FakeAudio.instances = []; FakeAudio.played = []; FakeAudio.autoEnd = false; };
    FakeAudio.endAll = () => {
        FakeAudio.instances.slice().forEach(a => { if (a.onended) a.onended(); });
    };

    const fakeStream = () => ({ getTracks: () => [{ stop() {} }] });

    let logged;

    function fakeWindow(extra) {
        const win = {
            BlobStore: BlobStore,
            AppErrorHandler: { logError: (e, context) => logged.push(context) },
            URL: global.URL,
            Audio: FakeAudio,
            Blob: FakeBlob,
            MediaRecorder: FakeMediaRecorder,
            navigator: { mediaDevices: { getUserMedia: () => Promise.resolve(fakeStream()) } }
        };
        Object.keys(extra || {}).forEach(k => { win[k] = extra[k]; });
        return win;
    }

    /** Record and stop, resolving with what the recorder produced. */
    function capture(Archive, surface) {
        return new Promise(resolve => {
            Archive.startCapture(surface, {
                onstop: (blob, meta) => resolve({ blob: blob, meta: meta }),
                onerror: e => resolve({ error: e })
            }).then(started => { if (started) Archive.stopCapture(); });
        });
    }

    const flush = () => new Promise(r => setTimeout(r, 0));

    // ------------------------------------------------------------------
    // Identity. No IndexedDB involved: this is arithmetic over content.
    // ------------------------------------------------------------------

    describe('the promptId is derived from the content, never from the index', () => {
        let Archive;
        beforeEach(() => { logged = []; Archive = loadArchive(fakeWindow()); });

        it('extracts and runs without reaching for anything in app.js', () => {
            // If the module ever closes over an app.js global, this throws.
            expect(typeof Archive.listeningPromptId).toBe('function');
            expect(typeof Archive.render).toBe('function');
            expect(Archive.ID_VERSION).toBe('1');
        });

        it('survives a sentence being inserted at the front of a tier', () => {
            // THE FAILURE THIS TEST EXISTS FOR. state.currentListeningIndex is
            // positional: insert one sentence and index 0 is a different sentence,
            // so an index-keyed archive would hand a learner's month-one recording
            // to somebody else's words — silently, and in the one feature whose
            // whole purpose is hearing month-one against month-three.
            const tier = 'foundation';
            const authored = listeningExercises[tier];
            const before = normaliseListeningItem(authored[0], tier);
            const recordedUnder = Archive.listeningPromptId(before);
            expect(recordedUnder).toMatch(/^lsn:1:[0-9a-z]{14}$/);

            // A content author inserts a sentence at the front of the tier.
            const after = [{ text: 'Good morning. Did you sleep well?' }].concat(authored);

            // Index 0 is now a DIFFERENT sentence...
            const nowAtZero = normaliseListeningItem(after[0], tier);
            expect(nowAtZero.text).toBe('Good morning. Did you sleep well?');
            expect(nowAtZero.text).not.toBe(before.text);
            expect(Archive.listeningPromptId(nowAtZero)).not.toBe(recordedUnder);

            // ...and the learner's sentence has moved to index 1, with its archive
            // key unchanged. The recording still belongs to the words it is of.
            const movedTo = normaliseListeningItem(after[1], tier);
            expect(movedTo.text).toBe(before.text);
            expect(Archive.listeningPromptId(movedTo)).toBe(recordedUnder);

            // And the id resolves BACK to the original sentence, which is what
            // lets an eviction notice name it (US-218 / BR-3).
            Archive.setCatalogue(() => after.map(raw => {
                const item = normaliseListeningItem(raw, tier);
                return { promptId: Archive.listeningPromptId(item), label: item.transcript };
            }));
            expect(Archive.describePrompt(recordedUnder)).toBe('“Hello, how are you today?”');
        });

        it('survives the whole tier being reversed', () => {
            const tier = 'everyday';
            const forward = listeningExercises[tier]
                .map(raw => Archive.listeningPromptId(normaliseListeningItem(raw, tier)));
            const backward = listeningExercises[tier].slice().reverse()
                .map(raw => Archive.listeningPromptId(normaliseListeningItem(raw, tier)));
            expect(backward).toEqual(forward.slice().reverse());
        });

        it('ignores every authored field that is not the utterance', () => {
            // Authoring a comprehension question (US-702) onto a sentence a learner
            // recorded in month one must not cost them the recording.
            const plain = normaliseListeningItem({ text: 'The weather is beautiful outside.' }, 'foundation');
            const id = Archive.listeningPromptId(plain);
            const enriched = normaliseListeningItem({
                text: 'The weather is beautiful outside.',
                rate: 0.75,
                seconds: 4,
                situation: 'small talk with a neighbour',
                focus: 'weather vocabulary',
                notes: 'T-P1 rhythm',
                shadow: true,
                questions: [{ q: 'What is the weather like?' }]
            }, 'confident');
            expect(Archive.listeningPromptId(enriched)).toBe(id);
            // Tier included: the same sentence promoted between tiers is the same
            // sentence, and the learner keeps the recordings. Stated in the module
            // header as a deliberate choice, not an accident.
            expect(enriched.tier).not.toBe(plain.tier);
        });

        it('treats punctuation, casing, spacing and apostrophe style as not part of the utterance', () => {
            const canonical = Archive.promptIdFor('lsn', "I don't know.");
            expect(Archive.promptIdFor('lsn', 'I don’t know')).toBe(canonical);
            expect(Archive.promptIdFor('lsn', '  I DON’T   know!  ')).toBe(canonical);
            expect(Archive.promptIdFor('lsn', 'i dont know')).toBe(canonical);
            expect(Archive.contentKey("I don't know.")).toBe('i dont know');
        });

        it('changes the id when the sentence itself changes, and must', () => {
            // Not a wart. A different sentence is a different prompt, and keeping
            // the old recordings under it would play a learner's voice against
            // words they never said (BR-3).
            const a = Archive.promptIdFor('lsn', 'I like to read books.');
            const b = Archive.promptIdFor('lsn', 'I like to read magazines.');
            expect(b).not.toBe(a);
        });

        it('gives every authored listening sentence in the repo a distinct id', () => {
            const ids = [];
            Object.keys(listeningExercises).forEach(tier => {
                listeningExercises[tier].forEach(raw => {
                    ids.push(Archive.listeningPromptId(normaliseListeningItem(raw, tier)));
                });
            });
            expect(ids).toHaveLength(30);
            expect(new Set(ids).size).toBe(ids.length);
            // normalizePromptId() in blobstore.js refuses anything over 200 chars.
            ids.forEach(id => expect(id.length).toBeLessThanOrEqual(200));
        });

        it('has no id for an item with no words, rather than one shared by all of them', () => {
            expect(Archive.listeningPromptId(null)).toBe('');
            expect(Archive.listeningPromptId({ text: '' })).toBe('');
            expect(Archive.contentKey('   ')).toBe('');
            // Punctuation-only or non-Latin text still gets ONE key each rather
            // than colliding on ''.
            expect(Archive.promptIdFor('lsn', 'నమస్కారం'))
                .not.toBe(Archive.promptIdFor('lsn', 'ధన్యవాదాలు'));
        });

        it('uses the authored pair id for a pronunciation prompt, unhashed', () => {
            // pair.id is already stable content identity and every comment in that
            // section protects it, so hashing it would only make an archive row
            // unreadable for no gain.
            expect(Archive.pronunciationPromptId({ id: 'iː-ɪ' })).toBe('pron:1:iː-ɪ');
            expect(Archive.pronunciationPromptId({ id: 'v-w' })).toBe('pron:1:v-w');
            expect(Archive.pronunciationPromptId({})).toBe('');
            // Different namespace from listening, so the two can never collide.
            expect(Archive.pronunciationPromptId({ id: 'v-w' }).indexOf('pron:')).toBe(0);
        });

        it('never lets an index near the archive', () => {
            // The single most important structural assertion in this story.
            expect(codeOnly(archiveSource())).not.toContain('currentListeningIndex');
            expect(codeOnly(archiveSource())).not.toContain('currentPronunciationIndex');
            expect(codeOnly(appSource)).not.toMatch(/RecordingArchive\.[A-Za-z]+\([^)]*current\w*Index/);
            const load = functionBody('function loadListeningExercise(');
            expect(load).toContain('RecordingArchive.listeningPromptId(item)');
        });

        it('is loaded by index.html and drawn into a region that exists', () => {
            const host = doc.getElementById('recordingArchive');
            expect(host).not.toBeNull();
            expect(doc.getElementById('listening').contains(host)).toBe(true);
            // Starts hidden and empty: on a browser with no IndexedDB the region
            // holds one honest note and nothing else changes.
            expect(host.hasAttribute('hidden')).toBe(true);
            expect(host.textContent.trim()).toBe('');
            expect(host.getAttribute('role')).toBe('region');
            expect(host.getAttribute('aria-label')).toBeTruthy();
        });
    });

    // ------------------------------------------------------------------
    // The archive, driven through the real store
    // ------------------------------------------------------------------

    describe('walking it: record, leave the sentence, come back', () => {
        const REAL_NOW = BlobStore._now;
        const MB = 1024 * 1024;

        let idb;
        let Archive;
        let clock;
        let createdUrls;
        let revokedUrls;

        const blobOf = (size) => ({ size: size, type: 'audio/webm;codecs=opus' });
        const host = () => document.getElementById('recordingArchive');
        const status = () => document.getElementById('recordingStatus');
        const texts = (selector) =>
            Array.from(host().querySelectorAll(selector)).map(el => el.textContent);

        function renderFor(promptId) {
            return Archive.render({
                hostId: 'recordingArchive',
                promptId: promptId,
                surface: 'listening',
                thing: 'sentence',
                status: 'recordingStatus'
            });
        }

        beforeEach(() => {
            logged = [];
            // blobstore.js binds to the jsdom window, so its logError() looks for
            // AppErrorHandler there. Routing both layers to one spy exercises that
            // branch and keeps the suite's output readable.
            global.AppErrorHandler = { logError: (e, context) => logged.push(context) };
            FakeAudio.reset();
            createdUrls = [];
            revokedUrls = [];
            let n = 0;
            // jsdom implements neither of these.
            global.URL.createObjectURL = () => {
                const url = 'blob:archive/' + (++n);
                createdUrls.push(url);
                return url;
            };
            global.URL.revokeObjectURL = (url) => { revokedUrls.push(url); };

            clock = new Date(2026, 8, 12, 14, 3).getTime();
            BlobStore._now = () => clock;
            BlobStore.revokeAll();
            revokedUrls = [];
            BlobStore._reset();

            idb = new FakeIndexedDB({});
            BlobStore._useEnvironment({ indexedDB: idb, IDBKeyRange: FakeKeyRange });

            document.body.innerHTML =
                '<div class="recording-status" id="recordingStatus"></div>' +
                '<div class="recording-archive" id="recordingArchive" hidden></div>';

            Archive = loadArchive(fakeWindow());
        });

        afterEach(() => {
            BlobStore._useEnvironment(null);
            BlobStore._now = REAL_NOW;
        });

        it('keeps the recording when the learner leaves the sentence and comes back', async () => {
            const tier = 'foundation';
            const mine = normaliseListeningItem(listeningExercises[tier][0], tier);
            const other = normaliseListeningItem(listeningExercises[tier][1], tier);
            const promptId = Archive.listeningPromptId(mine);

            // 1. Record. This is the recorder app.js actually calls.
            const recorded = await capture(Archive, 'listening');
            expect(recorded.blob.size).toBe(2048);
            expect(recorded.meta.mimeType).toBe('audio/webm;codecs=opus');

            const saved = await Archive.save(promptId, blobOf(2048), {
                durationMs: 4200, mimeType: recorded.meta.mimeType, label: mine.transcript
            });
            expect(saved.ok).toBe(true);
            // BlobStore's own copy, verbatim. Nothing here writes over it.
            expect(saved.message)
                .toBe('Saved. You can play it back and compare it with your earlier tries.');
            expect(saved.elsewhere).toEqual([]);

            // 2. Next → : app.js releases this surface and redraws for the new
            //    sentence. Before this story the recording died here.
            Archive.release('listening');
            let drawn = await renderFor(Archive.listeningPromptId(other));
            expect(drawn.records).toHaveLength(0);
            expect(texts('p')).toEqual([
                'Nothing is kept for this sentence yet. Record yourself and it stays on this device, ' +
                'so next month you can hear today against then.'
            ]);

            // 3. ← Previous : and it is still there.
            drawn = await renderFor(promptId);
            expect(drawn.records).toHaveLength(1);
            expect(host().hidden).toBe(false);
            expect(host().querySelector('.archive-head').textContent)
                .toBe('Your recordings of this sentence');
            expect(texts('.archive-when')).toEqual([
                'Your first try — 12 Sep 2026, 14:03 (0:04)'
            ]);
            expect(texts('.archive-item button')).toEqual(['▶ Play', '🗑 Delete']);
            expect(host().querySelector('.archive-item').className)
                .toBe('archive-item is-baseline');
            expect(texts('p')).toEqual([
                'This keeps your first recording and your two most recent.'
            ]);
            // One recording is not a comparison, so no compare button yet.
            expect(host().querySelector('.archive-compare')).toBeNull();
            expect(logged).toEqual([]);
        });

        it('plays a kept recording back, and says what it is doing', async () => {
            const promptId = 'lsn:1:playbackcase';
            await Archive.save(promptId, blobOf(1024), { durationMs: 3000 });
            await renderFor(promptId);

            host().querySelector('.archive-play').click();
            await flush();

            expect(FakeAudio.played).toEqual([createdUrls[createdUrls.length - 1]]);
            expect(status().textContent).toBe('Playing your recording.');
            expect(Archive.liveUrls('listening')).toBe(1);

            FakeAudio.endAll();
            expect(Archive.liveUrls('listening')).toBe(0);
            expect(revokedUrls).toContain(createdUrls[createdUrls.length - 1]);
        });

        it('keeps the pinned baseline and drops the second-oldest on the fourth try', async () => {
            // FR-DATA-6 as amended: one pinned baseline plus the N-1 most recent.
            // A plain ring buffer would delete recording #1 here, which is the half
            // of the comparison Strand E.7 exists for.
            const promptId = 'lsn:1:fourthtry';
            const base = clock;
            const at = ms => { clock = ms; };

            at(base);           await Archive.save(promptId, blobOf(1000), { durationMs: 1000 });
            at(base + 60000);   await Archive.save(promptId, blobOf(1000), { durationMs: 2000 });
            at(base + 120000);  await Archive.save(promptId, blobOf(1000), { durationMs: 3000 });
            at(base + 180000);
            const fourth = await Archive.save(promptId, blobOf(1000), { durationMs: 4000 });

            // The fourth write is the one that evicts, and it says so — about THIS
            // prompt, which is where the recording actually went from.
            expect(fourth.ok).toBe(true);
            expect(fourth.message).toBe(
                'Saved. This prompt keeps your first recording and your two most recent, so an ' +
                'in-between one was removed.');
            expect(fourth.elsewhere).toEqual([]);

            const rows = await Archive.list(promptId);
            expect(rows).toHaveLength(3);
            // Newest first. The baseline (id 1) is kept; the SECOND-oldest (id 2,
            // the in-between one) is what went.
            expect(rows.map(r => r.id)).toEqual([4, 3, 1]);
            expect(rows.map(r => r.createdAt))
                .toEqual([base + 180000, base + 120000, base]);
            expect(rows.map(r => r.baseline)).toEqual([false, false, true]);
            expect(idb.ids()).toEqual([1, 3, 4]);
            expect(idb.audioIds()).toEqual([1, 3, 4]);

            // The row created SECOND is the one that is gone, and the learner's very
            // first try is not.
            expect(rows.some(r => r.durationMs === 2000)).toBe(false);
            expect(rows.some(r => r.durationMs === 1000)).toBe(true);

            // And the learner is offered the comparison the whole feature is for.
            await renderFor(promptId);
            expect(host().querySelector('.archive-compare').textContent)
                .toBe('▶ Your first try, then your latest');
            expect(texts('.archive-when').map(t => t.split(' — ')[0]))
                .toEqual(['A later try', 'A later try', 'Your first try']);
        });

        it('plays first-then-latest as two clips, one live url at a time', async () => {
            const promptId = 'lsn:1:comparecase';
            const base = clock;
            await Archive.save(promptId, blobOf(1000), { durationMs: 1000 });
            clock = base + 60000;
            await Archive.save(promptId, blobOf(1000), { durationMs: 2000 });
            await renderFor(promptId);

            FakeAudio.autoEnd = true;
            host().querySelector('.archive-compare').click();
            await flush();
            await flush();

            expect(FakeAudio.played).toHaveLength(2);
            // Oldest first: the point is hearing where you started, then where you
            // are. And every url handed out has been given back.
            expect(Archive.liveUrls('listening')).toBe(0);
            expect(revokedUrls.length).toBe(createdUrls.length);
        });

        it('lets the learner delete one, and refuses to confirm a deletion twice', async () => {
            const promptId = 'lsn:1:deletecase';
            await Archive.save(promptId, blobOf(1000), { durationMs: 1000 });
            await renderFor(promptId);
            expect(texts('.archive-when')).toHaveLength(1);

            host().querySelector('.archive-delete').click();
            await flush();
            await flush();

            expect(status().textContent).toBe('Recording deleted.');
            expect(await Archive.list(promptId)).toEqual([]);
            expect(idb.ids()).toEqual([]);
            expect(idb.audioIds()).toEqual([]);
            expect(texts('p')).toContain(
                'Nothing is kept for this sentence yet. Record yourself and it stays on this device, ' +
                'so next month you can hear today against then.');

            // remove() of an absent id reports `missing` rather than confirming a
            // deletion that never happened (US-217), and the learner is told the
            // recording is gone rather than that it was just deleted.
            const again = await Archive.remove(1);
            expect(again.ok).toBe(false);
            expect(again.code).toBe('missing');
            expect(again.message).toBe('That recording is no longer on this device.');
        });

        it('names the OTHER sentences when the cap frees space from them', async () => {
            // US-218 / BR-3. The 50MB cap takes from other prompts, and telling the
            // learner "an in-between one at this prompt was removed" would name the
            // wrong sentence entirely.
            const mine = normaliseListeningItem(listeningExercises.foundation[0], 'foundation');
            const owner = Archive.listeningPromptId(mine);
            const filler = 'lsn:1:fillerprompt';
            const theirs = 'lsn:1:otherprompt';
            Archive.setCatalogue(() => [{ promptId: owner, label: mine.transcript }]);

            // 45MB against a 50MB cap, with exactly one expendable row in it: the
            // in-between recording at `owner`. Every recording is 9MB, because
            // MAX_RECORDING_BYTES clamps one recording to 10MB (US-221).
            const base = clock;
            let t = base;
            const save = (promptId) => { t += 1000; clock = t; return Archive.save(promptId, blobOf(9 * MB), {}); };
            await save(owner);    // baseline, protected
            await save(owner);    // in-between, the only expendable row anywhere
            await save(owner);    // newest at this prompt, protected
            await save(filler);   // baseline, protected
            await save(filler);   // newest, protected

            t += 1000; clock = t;
            const result = await Archive.save(theirs, blobOf(9 * MB), {});

            expect(result.ok).toBe(true);
            expect(result.message).toBe(
                'Saved. There was no room left on this device, so in-between recordings at your ' +
                'other prompts were deleted to make space. Every prompt still keeps its first ' +
                'recording and its most recent one.');
            // Named, not implied.
            expect(result.elsewhere).toEqual(['“Hello, how are you today?”']);
            // The baseline and the newest at the other prompt both survived.
            const kept = await Archive.list(owner);
            expect(kept.map(r => r.baseline)).toEqual([false, true]);
        });

        it('falls back honestly for a prompt it cannot name', async () => {
            // An algorithmically generated sentence is not in the catalogue, and
            // inventing a name for it would be worse than saying so.
            Archive.setCatalogue(() => []);
            expect(Archive.describePrompt('lsn:1:unknownnnn'))
                .toBe('another sentence you have recorded');
        });

        it('leaks no object url across a Prev/Next walk', async () => {
            const a = 'lsn:1:walkpromptaa';
            const b = 'lsn:1:walkpromptbb';
            await Archive.save(a, blobOf(1000), { durationMs: 1000 });
            await Archive.save(b, blobOf(1000), { durationMs: 1000 });

            const urlsAtStart = createdUrls.length;   // the availability probe makes none
            for (let i = 0; i < 3; i++) {
                for (const promptId of [a, b]) {
                    await renderFor(promptId);
                    host().querySelector('.archive-play').click();
                    await flush();
                    // Exactly one live url, always: open() releases this surface's
                    // previous one before it asks for another.
                    expect(Archive.liveUrls('listening')).toBe(1);
                    expect(BlobStore.liveUrlCount()).toBe(1);
                    // Next → / ← Previous, as loadListeningExercise() does it.
                    Archive.release('listening');
                    expect(Archive.liveUrls('listening')).toBe(0);
                }
            }

            expect(createdUrls.length - urlsAtStart).toBe(6);
            expect(revokedUrls.length).toBe(createdUrls.length);
            expect(BlobStore.liveUrlCount()).toBe(0);
            // The store's MAX_LIVE_URLS net (which revokes the oldest past 8) never
            // had to fire. It is a backstop for a caller that forgot, not a licence.
            expect(BlobStore.MAX_LIVE_URLS).toBe(8);
        });

        it('does not revoke a url another surface is still playing', async () => {
            const listening = 'lsn:1:twosurfacea';
            const pron = 'pron:1:v-w';
            await Archive.save(listening, blobOf(1000), { durationMs: 1000 });
            await Archive.save(pron, blobOf(1000), { durationMs: 1000 });
            const listeningRow = (await Archive.list(listening))[0];
            const pronRow = (await Archive.list(pron))[0];

            const openedListening = await Archive.open('listening', listeningRow.id);
            const openedPron = await Archive.open('pron', pronRow.id);
            expect(openedListening.ok).toBe(true);
            expect(openedPron.ok).toBe(true);
            expect(BlobStore.liveUrlCount()).toBe(2);

            // Prev/Next in Listening. Not BlobStore.revokeAll(), which would reach
            // across and cut off the pronunciation task mid-comparison.
            Archive.release('listening');
            expect(revokedUrls).toContain(openedListening.url);
            expect(revokedUrls).not.toContain(openedPron.url);
            expect(Archive.liveUrls('pron')).toBe(1);
            expect(BlobStore.liveUrlCount()).toBe(1);

            Archive.releaseAll();
            expect(BlobStore.liveUrlCount()).toBe(0);
        });

        it('reports a recording that is no longer there as exactly that', async () => {
            const opened = await Archive.open('listening', 4242);
            expect(opened.ok).toBe(false);
            expect(opened.code).toBe('missing');
            expect(opened.message).toBe('That recording is no longer on this device.');
        });
    });

    // ------------------------------------------------------------------
    // The failure modes. None of them may stop an exercise.
    // ------------------------------------------------------------------

    describe('storage failing never blocks the exercise (NFR-8, FR-A11Y-4)', () => {
        const REAL_NOW = BlobStore._now;
        let Archive;

        function renderFor(promptId) {
            return Archive.render({
                hostId: 'recordingArchive',
                promptId: promptId,
                surface: 'listening',
                thing: 'sentence',
                status: 'recordingStatus'
            });
        }

        const notes = () => Array.from(
            document.getElementById('recordingArchive').querySelectorAll('p')
        ).map(p => p.textContent);

        beforeEach(() => {
            logged = [];
            global.AppErrorHandler = { logError: (e, context) => logged.push(context) };
            FakeAudio.reset();
            global.URL.createObjectURL = () => 'blob:archive/x';
            global.URL.revokeObjectURL = () => {};
            BlobStore.revokeAll();
            BlobStore._reset();
            BlobStore._now = () => 1000;
            document.body.innerHTML =
                '<div class="recording-status" id="recordingStatus"></div>' +
                '<div class="recording-archive" id="recordingArchive" hidden></div>';
        });

        afterEach(() => {
            BlobStore._useEnvironment(null);
            BlobStore._now = REAL_NOW;
        });

        const KEPT_NOTHING =
            'This browser will not let the app keep recordings, so this one lasts until you leave ' +
            'the page. Everything else works normally.';
        const STILL_WORKS =
            'Recording still works. You can play back what you just said until you leave this ' +
            'sentence — nothing is kept after that.';

        it('records and plays back within the session on a browser with no IndexedDB', async () => {
            BlobStore._useEnvironment({ indexedDB: null, IDBKeyRange: null });
            Archive = loadArchive(fakeWindow());

            const can = await Archive.availability();
            expect(can.ok).toBe(false);
            expect(can.code).toBe('no-indexeddb');

            // The microphone still works, which is the whole point: the archive is
            // an enhancement, and its absence changes nothing about the exercise.
            const recorded = await capture(Archive, 'listening');
            expect(recorded.error).toBeUndefined();
            expect(recorded.blob.size).toBe(2048);

            const saved = await Archive.save('lsn:1:noidbcase00', recorded.blob, {});
            expect(saved.ok).toBe(false);
            expect(saved.code).toBe('no-indexeddb');
            expect(saved.message).toBe(KEPT_NOTHING);

            const drawn = await renderFor('lsn:1:noidbcase00');
            expect(drawn.records).toEqual([]);
            expect(notes()).toEqual([KEPT_NOTHING, STILL_WORKS]);
            // No throw and no rejection. blobstore.js logs the unavailability once,
            // as it documents; nothing in the archive layer logs a failure of its
            // own, because for the learner nothing has failed.
            expect(logged).toContain('blobstore availability');
            expect(logged.filter(c => String(c).indexOf('archive') === 0)).toEqual([]);
        });

        it('tells a learner with the app open twice which tab to close', async () => {
            BlobStore._useEnvironment({
                indexedDB: new FakeIndexedDB({ openMode: 'blocked' }),
                IDBKeyRange: FakeKeyRange
            });
            Archive = loadArchive(fakeWindow());

            const can = await Archive.availability();
            expect(can.code).toBe('blocked-by-other-tab');
            await renderFor('lsn:1:othertabcase');
            expect(notes()).toEqual([
                'This app is open in another tab, which is holding on to your recordings. ' +
                'Close the other tab and try again.',
                STILL_WORKS
            ]);
        });

        it('retries a transient failure without a page reload', async () => {
            const blocked = new FakeIndexedDB({ openMode: 'blocked' });
            BlobStore._useEnvironment({ indexedDB: blocked, IDBKeyRange: FakeKeyRange });
            Archive = loadArchive(fakeWindow());
            expect((await Archive.availability()).ok).toBe(false);

            // The other tab closes. Neither blobstore.js nor the archive caches a
            // transient failure, so the next ask really re-checks.
            BlobStore._reset();
            BlobStore._useEnvironment({ indexedDB: new FakeIndexedDB({}), IDBKeyRange: FakeKeyRange });
            expect((await Archive.availability()).ok).toBe(true);
        });

        it('reports a device whose IndexedDB cannot hold a Blob', async () => {
            // Some WebKit builds accept the write and lose the payload. Only the
            // deep probe catches it, which is why availability() asks for one.
            BlobStore._useEnvironment({
                indexedDB: new FakeIndexedDB({ dropBlobs: true }),
                IDBKeyRange: FakeKeyRange
            });
            Archive = loadArchive(fakeWindow());
            const can = await Archive.availability();
            expect(can.ok).toBe(false);
            expect(can.code).toBe('blob-roundtrip-failed');
            await renderFor('lsn:1:noblobcase0');
            expect(notes()).toEqual([KEPT_NOTHING, STILL_WORKS]);
        });

        it('refuses an empty recording without pretending anything was kept', async () => {
            BlobStore._useEnvironment({ indexedDB: new FakeIndexedDB({}), IDBKeyRange: FakeKeyRange });
            Archive = loadArchive(fakeWindow());
            const result = await Archive.save('lsn:1:emptycase00', { size: 0, type: 'audio/webm' }, {});
            expect(result.ok).toBe(false);
            expect(result.message).toBe('Nothing was recorded, so there is nothing to keep.');
        });

        it('refuses a recorder that was never stopped, and says what to do', async () => {
            BlobStore._useEnvironment({ indexedDB: new FakeIndexedDB({}), IDBKeyRange: FakeKeyRange });
            Archive = loadArchive(fakeWindow());
            const tooBig = { size: BlobStore.MAX_RECORDING_BYTES + 1, type: 'audio/webm' };
            const result = await Archive.save('lsn:1:toolongcase', tooBig, {});
            expect(result.ok).toBe(false);
            expect(result.message).toBe(
                'That recording is too long to keep. Stop the recording when you have finished ' +
                'speaking and try again — nothing else has changed.');
        });

        it('says the microphone is missing without ending the section', async () => {
            BlobStore._useEnvironment({ indexedDB: new FakeIndexedDB({}), IDBKeyRange: FakeKeyRange });
            Archive = loadArchive(fakeWindow({ MediaRecorder: undefined, navigator: {} }));
            expect(Archive.recorderMissing()).toBe(true);
            const attempt = await capture(Archive, 'listening');
            expect(attempt.error.code).toBe('no-recorder');
            expect(Archive.isRecording()).toBe(false);
        });

        it('draws nothing at all for an item with no promptId', async () => {
            BlobStore._useEnvironment({ indexedDB: new FakeIndexedDB({}), IDBKeyRange: FakeKeyRange });
            Archive = loadArchive(fakeWindow());
            const drawn = await renderFor('');
            expect(drawn.records).toEqual([]);
            expect(document.getElementById('recordingArchive').hidden).toBe(true);
            expect(document.getElementById('recordingArchive').textContent).toBe('');
        });

        it('treats a missing host as nothing to draw, so an old index.html still works', async () => {
            // service-worker.js serves app.js cache-first and index.html
            // network-first, so new-app-old-markup is a real offline combination.
            BlobStore._useEnvironment({ indexedDB: new FakeIndexedDB({}), IDBKeyRange: FakeKeyRange });
            Archive = loadArchive(fakeWindow());
            document.body.innerHTML = '';
            const drawn = await Archive.render({ hostId: 'recordingArchive', promptId: 'lsn:1:x' });
            expect(drawn).toEqual({ records: [], availability: null });
        });
    });

    // ------------------------------------------------------------------
    // Where app.js calls it from
    // ------------------------------------------------------------------

    describe('the call sites in app.js', () => {
        it('finishes the exercise before it touches storage', () => {
            const handler = appSource.slice(
                appSource.indexOf("document.getElementById('startRecording').onclick"),
                appSource.indexOf("document.getElementById('stopRecording').onclick"));
            // FR-A11Y-4 / NFR-8's principle: the attempt counts first, so no
            // storage failure can cost a learner a completed item.
            expect(handler).toContain("markListeningAttempt('recorded', true)");
            expect(handler).toContain('keepListeningRecording(blob, meta)');
            expect(handler.indexOf("markListeningAttempt('recorded', true)"))
                .toBeLessThan(handler.indexOf('keepListeningRecording(blob, meta)'));
            // And the FR-A11Y-4 no-microphone route is still the same route.
            expect(handler).toContain('✓ I said it');
            expect(handler).toContain("AppErrorHandler.logError(e, 'listening recording')");
        });

        it('releases this surface on navigation and never reaches across', () => {
            const load = functionBody('function loadListeningExercise(');
            expect(load).toContain("RecordingArchive.release('listening')");
            expect(load).toContain('refreshListeningArchive()');
            // revokeAll() would kill a url the pronunciation task is playing.
            expect(codeOnly(appSource)).not.toContain('BlobStore.revokeAll');
            expect(codeOnly(archiveSource())).not.toContain('revokeAll()');
        });

        it('reports BlobStore\'s own copy rather than writing over it', () => {
            const body = functionBody('function reportArchiveSave(');
            expect(body).toContain('result.message');
            expect(body).not.toMatch(/Error saving|Something went wrong|Failed to save/);
            // The one thing added: WHICH other prompts lost a recording.
            expect(body).toContain('The recordings that were removed were at ');
            expect(body).toContain('result.elsewhere');
        });

        it('never keys a save on anything but the derived promptId', () => {
            const body = functionBody('function keepListeningRecording(');
            expect(body).toContain('const promptId = listeningPromptId();');
            expect(body).toContain('if (!promptId || !blob || !blob.size) return;');
            expect(body).not.toContain('Index');
        });

        it('registers every authored prompt so an eviction can be named', () => {
            expect(appSource).toContain('RecordingArchive.setCatalogue(');
            const at = appSource.indexOf('RecordingArchive.setCatalogue(');
            const block = appSource.slice(at, at + 1600);
            expect(block).toContain('RecordingArchive.listeningPromptId(item)');
            expect(block).toContain('RecordingArchive.pronunciationPromptId(pair)');
        });
    });
});

// ===========================================================================
// US-404 — self-comparison, A -> B -> A (FR-PRN-4 / FR-PRN-5)
// ===========================================================================
//
// Structural, in the same spirit as the rest of this file: renderPronunciationProduce()
// reaches for pronGate(), pronParagraph(), SRS and speechSynthesis, so it is not
// extractable the way the archive module is. What IS worth pinning here is every
// promise this story makes that a later edit could quietly break — the matched
// speed, the absence of a score, the feelable question, and the skip path that
// FR-A11Y-4 says must survive the arrival of a recorder.

describe('pronunciation self-comparison, A -> B -> A (US-404 / FR-PRN-4)', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

    /** The body of one top-level function, by brace matching. */
    function functionBody(header) {
        const start = appSource.indexOf(header);
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces after ' + header);
    }

    /** Code with comments removed — the assertions below forbid particular code,
     *  and the comments explain at length why. */
    function codeOnly(source) {
        return source
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .filter(line => !/^\s*\/\//.test(line))
            .join('\n');
    }

    it('no longer prints "this app does not record you"', () => {
        // The line was honest while there was no recorder and PROGRESS.md §6.aa
        // rule 3 required it. US-136 built the recorder, so the right fix was to
        // stop needing the disclaimer rather than to keep apologising. The two
        // remaining occurrences are comments quoting what was removed.
        const code = codeOnly(appSource);
        expect(code).not.toContain('This app does not record you');
        expect(code).not.toContain('nothing is played back and nothing is scored');
        expect(appSource).toContain('This app does not record you');   // in a comment
    });

    it('still says, in the same place, that nothing is scored', () => {
        // FR-PRN-5 / BR-3. What went was the claim "this app cannot record you".
        // What must not go is the claim "nothing here is a verdict on your voice",
        // which is true of any app and is the honest half of the old sentence.
        const body = functionBody('function renderPronunciationProduce(');
        expect(body).toContain('Nothing on this screen is scored');
        expect(body).toContain('what it cannot do is judge your voice, so it does not try');
        expect(body).toContain('the only honest test is to ask one');
    });

    it('plays model, learner, model — in that order', () => {
        const body = functionBody('function pronRunComparison(');
        const first = body.indexOf('pronSpeakSequence(words, PRON_RATE_SLOW');
        const learner = body.indexOf('pronPlayLearner(');
        const again = body.indexOf('modelAgain');
        expect(first).toBeGreaterThan(-1);
        expect(learner).toBeGreaterThan(-1);
        expect(again).toBeGreaterThan(-1);
        // The model is spoken, and the learner's clip only starts once the model
        // has finished: that is what `pronSpeakSequence`'s callback is for, and it
        // is why pronSpeak() could not be reused.
        expect(body).toContain("pronCompareStatus('Now you.')");
        expect(functionBody('function pronSpeakSequence(')).toContain('u.onend = advance;');
    });

    it('plays both models at the same rate, and does not re-time the learner', () => {
        // PROGRESS.md §6.aa rule 4. A fast model against a slow attempt teaches the
        // learner about the speed and nothing about the sound.
        const body = functionBody('function pronRunComparison(');
        const rates = body.match(/pronSpeakSequence\(words, ([A-Z_]+),/g) || [];
        expect(rates).toHaveLength(2);
        rates.forEach(call => expect(call).toContain('PRON_RATE_SLOW'));
        // The learner's own clip plays at its natural rate. Anything else would be
        // the app editing the thing it is asking the learner to judge.
        expect(codeOnly(functionBody('function pronPlayUrl('))).not.toContain('playbackRate');
        expect(codeOnly(functionBody('function pronPlayLearner('))).not.toContain('playbackRate');
        // And it says so to the learner.
        expect(body).toContain('at exactly the same speed');
    });

    it('asks a feelable question and refuses the unanswerable one', () => {
        const body = functionBody('function appendPronunciationComparison(');
        // The question is the AUTHORED one, not a second one invented here.
        expect(body).toContain('const feel = (pair.feelChecks || [])[0];');
        expect(body).toContain('+ feel');
        // "Did it sound right?" appears exactly once and only to be ruled out.
        expect(body).toContain('it is not "did it sound right?"');
        expect(body).toContain('that is the one thing you cannot judge yet');
    });

    it('is fed by content whose feelChecks are all feelable', () => {
        // FR-PRN-4 is only as good as the authored questions. A `feelChecks` entry
        // asking about the SOUND would put the unanswerable question back on screen
        // through the content rather than through the code.
        ['vowels-stress.js', 'consonants.js'].forEach(file => {
            const src = fs.readFileSync(path.join(ROOT, 'data', 'pronunciation', file), 'utf8');
            const blocks = src.match(/feelChecks:\s*\[[\s\S]*?\]/g) || [];
            expect(blocks.length).toBeGreaterThan(0);
            blocks.forEach(block => {
                expect(block.toLowerCase()).not.toContain('sound right');
                expect(block.toLowerCase()).not.toContain('sound correct');
                expect(block.toLowerCase()).not.toContain('did it sound');
            });
        });
        // The example FR-PRN-4 itself gives, so the requirement's own wording is
        // reachable from the app.
        const consonants = fs.readFileSync(
            path.join(ROOT, 'data', 'pronunciation', 'consonants.js'), 'utf8');
        expect(consonants).toContain('Did your top teeth touch your bottom lip');
    });

    it('produces no score, no verdict and no pass/fail', () => {
        const produce = functionBody('function renderPronunciationProduce(');
        const compare = functionBody('function appendPronunciationComparison(');
        const run = functionBody('function pronRunComparison(');
        [produce, compare, run].forEach(body => {
            // FR-PRN-2's accuracy counter belongs to the DISCRIMINATION drill. A
            // call to it from here would score a recording (FR-PRN-5).
            expect(codeOnly(body)).not.toContain('pronRecordAttempt(');
            expect(codeOnly(body)).not.toContain('Mistakes.record(');
            expect(codeOnly(body)).not.toMatch(/\bcorrect\s*[?:=]/);
        });
        // Nothing in the comparison touches SRS at all: the only SRS call in the
        // production task is the "not yet" self-report below, which cannot certify.
        expect(codeOnly(compare)).not.toContain('SRS.');
        expect(codeOnly(run)).not.toContain('SRS.');
    });

    it('sends "not yet" to SRS as a self-report and "yes" nowhere', () => {
        // FR-SRS-5. A self-marked production task may shorten an interval and may
        // never be counted as verified-correct, so the flag is not optional.
        const body = functionBody('function renderPronunciationProduce(');
        expect(body).toContain(
            "SRS.scheduleItem('phon', pair.id, pair, false, { selfReported: true })");
        // And the affirmative goes to SRS not at all: a learner marking their own
        // speaking right is not evidence of anything.
        const yesHandler = body.slice(
            body.indexOf("yes.addEventListener('click'"),
            body.indexOf("const notYet = document.createElement('button')"));
        expect(codeOnly(yesHandler)).not.toContain('SRS.');
        expect(yesHandler).toContain('this app never judges your voice');
    });

    it('keeps the skip-and-mark-done path in front of the recorder (FR-A11Y-4)', () => {
        const body = functionBody('function renderPronunciationProduce(');
        const yes = body.indexOf('Yes, I felt that');
        const notYet = body.indexOf('Not yet / skip this');
        const comparison = body.indexOf('appendPronunciationComparison(host, pair)');
        expect(yes).toBeGreaterThan(-1);
        expect(notYet).toBeGreaterThan(-1);
        // Appended AFTER, so everything a learner needs to finish is already on
        // screen and needs no microphone, no audio and no storage.
        expect(comparison).toBeGreaterThan(yes);
        expect(comparison).toBeGreaterThan(notYet);
    });

    it('says the task is still finishable when there is no microphone', () => {
        const body = functionBody('function appendPronunciationComparison(');
        expect(body).toContain('RecordingArchive.recorderMissing()');
        expect(body).toContain('Say the words out loud anyway and answer the question below');
        expect(body).toContain('it was never the recording.');
        // The refusal-at-the-moment-it-bites copy, for a learner who declines the
        // permission prompt rather than lacking the hardware.
        expect(body).toContain('No microphone, so nothing was recorded.');
        expect(body).toContain('nothing here is scored either way');
    });

    it('never makes the archive a precondition for anything', () => {
        const compare = functionBody('function appendPronunciationComparison(');
        // The comparison works off THIS session's url first and only falls back to
        // the store, so a device that cannot keep anything still gets A -> B -> A.
        const learner = functionBody('function pronPlayLearner(');
        expect(learner.indexOf('pronCompare.url'))
            .toBeLessThan(learner.indexOf('pronCompare.recordId'));
        // The save is fire-and-forget and happens after the UI is already usable.
        const stopHandler = compare.slice(
            compare.indexOf('onstop: (blob, meta) =>'),
            compare.indexOf('onerror: (e) =>'));
        expect(stopHandler.indexOf('compare.disabled = false'))
            .toBeLessThan(stopHandler.indexOf('keepPronunciationRecording(pair, blob, meta)'));
    });

    it('stays behind the one gate the app is allowed to have (FR-SPK-9)', () => {
        const body = functionBody('function renderPronunciationProduce(');
        const locked = body.indexOf('host.appendChild(lock);');
        const returnAfterLock = body.indexOf('return;', locked);
        const comparison = body.indexOf('appendPronunciationComparison(host, pair)');
        // The locked branch returns before anything below it, so a learner who
        // cannot yet hear the contrast is not offered a self-comparison they
        // cannot judge.
        expect(returnAfterLock).toBeLessThan(comparison);
        expect(body).toContain('const gate = pronGate(pair);');
    });

    it('releases its object urls on a pair change and on leaving the section', () => {
        const produce = functionBody('function renderPronunciationProduce(');
        expect(produce).toContain('releasePronCompare();');
        // Reset before anything is drawn, so a redraw cannot leave the previous
        // pair's recording pinned.
        expect(produce.indexOf('releasePronCompare();'))
            .toBeLessThan(produce.indexOf('const gate = pronGate(pair);'));
        const release = functionBody('function releasePronCompare(');
        expect(release).toContain('URL.revokeObjectURL(pronCompare.url)');
        expect(release).toContain("RecordingArchive.release('pron')");
        const switching = functionBody('function switchSection(');
        expect(switching).toContain("RecordingArchive.release('listening')");
        expect(switching).toContain('releasePronCompare()');
    });

    it('does not stall if a voice never fires onend', () => {
        // A -> B -> A is a chain of callbacks, and `onend` has been observed never
        // to fire on some Android WebView voices. Without the watchdog the status
        // line would say "Now you." for the rest of the session.
        const body = functionBody('function pronSpeakSequence(');
        expect(body).toContain('setTimeout(advance,');
        expect(body).toContain('if (advanced) return;');
        expect(body).toContain('u.onerror = advance;');
        // And a device with no speech synthesis at all is told, not left waiting.
        expect(body).toContain('if (!list.length || !pronAudioUsable())');
        expect(functionBody('function pronRunComparison(')).toContain(
            'This device cannot play audio, so the comparison is not available.');
    });

    it('keys the pronunciation archive on the authored pair id', () => {
        const produce = functionBody('function renderPronunciationProduce(');
        expect(produce).toContain('RecordingArchive.pronunciationPromptId(pair)');
        const keep = functionBody('function keepPronunciationRecording(');
        expect(keep).toContain('const promptId = pronCompare.promptId;');
        expect(codeOnly(keep)).not.toContain('Index');
    });

    it('offers a recording from a previous session as the comparison', () => {
        // Strand E.7: the month-one half of the comparison is almost never one the
        // learner made two minutes ago, so the newest archived row is adopted when
        // there is no session recording.
        const body = functionBody('function refreshPronunciationArchive(');
        expect(body).toContain('pronCompare.recordId = drawn.records[0].id;');
        expect(body).toContain("compare.disabled = !(pronCompare.url || pronCompare.recordId)");
    });
});

// ===========================================================================
// US-601 — free production: prompt, clock, recording, rubric (FR-SPK-3)
// ===========================================================================
//
// Three kinds of assertion here, and the split is deliberate.
//
//  1. THE CONTENT is real data and is tested as data: every authored prompt has
//     to survive data.js's normaliser, and every rubric item has to be one the
//     LEARNER can answer. That second one is the whole story of this feature —
//     the app cannot grade free speech, so a rubric asking "was my pronunciation
//     good?" would hand the learner a question only a teacher could answer and
//     leave them assuming the fault was theirs.
//
//  2. THE MARKUP is checked against the code that draws into it, in the same
//     spirit as the rest of this file.
//
//  3. THE BEHAVIOUR is WALKED in jsdom, not grepped. app.js cannot be required,
//     so the block between the BEGIN/END markers is extracted and evaluated with
//     its dependencies injected — exactly the arrangement the recording archive
//     uses, and for the same reason: "the clock cannot end the task" and "the
//     silent route finishes it with no microphone" are behaviour, and a regex
//     over source text cannot prove either.

describe('free production — prompt, clock, recording, rubric (US-601 / FR-SPK-3)', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const Data = require(path.join(ROOT, 'data.js'));
    const BlobStore = require(path.join(ROOT, 'js', 'core', 'blobstore.js'));

    const TIERS = ['foundation', 'everyday', 'confident', 'fluent'];

    /** Source between two markers. */
    function between(begin, end) {
        const from = appSource.indexOf(begin);
        const to = appSource.indexOf(end);
        expect(from).toBeGreaterThan(-1);
        expect(to).toBeGreaterThan(from);
        return appSource.slice(from, to);
    }

    function fsBlock() {
        return between('// ===== BEGIN FREE PRODUCTION (US-601) =====',
            '// ===== END FREE PRODUCTION (US-601) =====');
    }

    function archiveBlock() {
        return between('// ===== BEGIN RECORDING ARCHIVE (US-136) =====',
            '// ===== END RECORDING ARCHIVE (US-136) =====');
    }

    /** The body of one top-level function, by brace matching. */
    function functionBody(header) {
        const start = appSource.indexOf(header);
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces after ' + header);
    }

    /** Code with the comments stripped — the assertions below forbid particular
     *  code, and the comments explain at length why. */
    function codeOnly(source) {
        return source
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .filter(line => !/^\s*\/\//.test(line))
            .join('\n');
    }

    const allPrompts = () => TIERS.reduce((out, tier) => out.concat(
        Data.normaliseFreeSpeakingList(Data.freeSpeakingPrompts[tier], tier)), []);

    // ------------------------------------------------------------------
    // 1. The content
    // ------------------------------------------------------------------

    describe('the prompts are authored and reachable', () => {
        it('authors prompts for every tier, so no tier falls back', () => {
            // A tier with nothing authored sends the learner down a level by
            // resolveDifficulty()'s step-down rule, which for P4 (fluent) would
            // mean the app has no prompt written for the persona it names.
            TIERS.forEach(tier => {
                const list = Data.normaliseFreeSpeakingList(Data.freeSpeakingPrompts[tier], tier);
                expect(list.length).toBeGreaterThan(0);
                list.forEach(p => expect(p.tier).toBe(tier));
            });
        });

        it('loses nothing to the normaliser', () => {
            // Every authored entry renders. A prompt silently dropped is content
            // nobody would ever find missing (FR-CNT-1).
            TIERS.forEach(tier => {
                const authored = Data.freeSpeakingPrompts[tier];
                expect(Data.normaliseFreeSpeakingList(authored, tier))
                    .toHaveLength(authored.length);
            });
        });

        it('grades the advisory length by tier (FR-SPK-3)', () => {
            allPrompts().forEach(p => {
                expect(typeof p.targetSeconds).toBe('number');
                expect(p.targetSeconds).toBeGreaterThan(0);
            });
            // The tier defaults exist so an author can leave it out, and every
            // tier has one — otherwise "graded by tier" is 90 seconds for all.
            TIERS.forEach(tier => expect(Data.FREE_SPEAKING_SECONDS[tier]).toBeGreaterThan(0));
            expect(Data.FREE_SPEAKING_SECONDS.foundation)
                .toBeLessThan(Data.FREE_SPEAKING_SECONDS.confident);
        });

        it('covers the persona patterns the backlog names', () => {
            const situations = allPrompts().map(p => p.situation);
            // A commute-length task (P1), an interview-style task (P3/P4) and a
            // describe-your-work task (P1/P4).
            expect(situations).toContain('commute');
            expect(situations).toContain('interview');
            expect(situations).toContain('work');
            // And the commute one is actually commute-length.
            const commute = allPrompts().filter(p => p.situation === 'commute');
            commute.forEach(p => expect(p.targetSeconds).toBeLessThanOrEqual(60));
        });

        it('gives every prompt at least two rubric items and unique ids', () => {
            const seen = new Set();
            allPrompts().forEach(p => {
                expect(p.rubric.length).toBeGreaterThanOrEqual(2);
                expect(seen.has(p.id)).toBe(false);
                seen.add(p.id);
                const ids = p.rubric.map(r => r.id);
                expect(new Set(ids).size).toBe(ids.length);
            });
        });
    });

    describe('every rubric item is one the learner can answer about themselves', () => {
        it('ships nothing rubricRefuses() would refuse', () => {
            allPrompts().forEach(p => {
                p.rubric.forEach(item => {
                    expect(Data.rubricRefuses(item.ask)).toBeNull();
                });
            });
        });

        it('refuses the question FR-PRN-5 forbids everywhere else', () => {
            // The one the learner cannot answer, in the wordings an author would
            // actually reach for.
            [
                'Was your pronunciation good?',
                'Did it sound right?',
                'Did you sound natural?',
                'Did you sound like a native speaker?',
                'Was your accent clear?',
                'Were you fluent?',
                'Score yourself out of 5',
                'Was your grammar correct?'
            ].forEach(ask => {
                expect(Data.rubricRefuses(ask)).not.toBeNull();
            });
        });

        it('drops a refused item at author time rather than softening it', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            try {
                const dropped = Data.normaliseFreeSpeakingPrompt({
                    id: 'x', prompt: 'Say something.',
                    rubric: [
                        { id: 'a', ask: 'Did you keep going without stopping?' },
                        { id: 'b', ask: 'Was your pronunciation good?' },
                        { id: 'c', ask: 'Did you finish every sentence?' }
                    ]
                }, 'everyday');
                expect(dropped.rubric.map(r => r.id)).toEqual(['a', 'c']);
                expect(warn.mock.calls.join(' ')).toContain('was dropped because it');
                // And a prompt left with fewer than two usable items is dropped
                // whole: a recording with nothing to check it against is the thing
                // CURRICULUM.md Strand E opens by calling the problem.
                expect(Data.normaliseFreeSpeakingPrompt({
                    id: 'y', prompt: 'Say something.',
                    rubric: [{ ask: 'Did it sound right?' }, { ask: 'Was it fluent?' }]
                }, 'everyday')).toBeNull();
            } finally {
                warn.mockRestore();
            }
        });

        it('never puts a score, a mark or a percentage in front of the learner', () => {
            // BR-3 / FR-PRN-5 over the CONTENT, not just the code: a rubric item
            // saying "give yourself 4/5" would be a score the app invited.
            allPrompts().forEach(p => {
                [p.prompt, p.notes || ''].concat(p.rubric.map(r => r.ask))
                    .concat(p.bullets)
                    .forEach(text => {
                        expect(text).not.toMatch(/\b\d+\s*(\/|out of)\s*\d+\b/);
                        expect(text).not.toMatch(/%|percent|\bscore\b|\bgrade\b|\bpass\/fail\b/i);
                    });
            });
        });

        it('asks about what the learner did, in the second person', () => {
            // Every item is a yes/no question addressed to the learner. Not a
            // style rule: an item that is not a question about their own attempt
            // is one they cannot answer, which is the failure this whole block is
            // about.
            allPrompts().forEach(p => {
                p.rubric.forEach(item => {
                    expect(item.ask).toMatch(/\?$/);
                    expect(item.ask.toLowerCase()).toMatch(/\byou\b|\byour\b/);
                });
            });
        });
    });
});

describe('free production — the card, walked in jsdom (US-601)', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const Data = require(path.join(ROOT, 'data.js'));
    const BlobStore = require(path.join(ROOT, 'js', 'core', 'blobstore.js'));
    const REAL_NOW = BlobStore._now;

    function between(begin, end) {
        const from = appSource.indexOf(begin);
        const to = appSource.indexOf(end);
        expect(from).toBeGreaterThan(-1);
        expect(to).toBeGreaterThan(from);
        return appSource.slice(from, to);
    }
    const fsBlock = () => between('// ===== BEGIN FREE PRODUCTION (US-601) =====',
        '// ===== END FREE PRODUCTION (US-601) =====');
    const archiveBlock = () => between('// ===== BEGIN RECORDING ARCHIVE (US-136) =====',
        '// ===== END RECORDING ARCHIVE (US-136) =====');

    // --- stand-ins for the browser APIs the two blocks touch ----------------

    function FakeBlob(parts, opts) {
        this.size = (parts || []).reduce((n, p) => n + ((p && p.size) || 0), 0);
        this.type = (opts && opts.type) || '';
    }
    class FakeMediaRecorder {
        constructor(stream) { this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/webm;codecs=opus'; }
        start() { this.state = 'recording'; }
        stop() {
            this.state = 'inactive';
            if (this.ondataavailable) this.ondataavailable({ data: { size: 4096, type: this.mimeType } });
            if (this.onstop) this.onstop();
        }
    }
    function FakeAudio(url) { this.src = url; FakeAudio.played.push(url); }
    FakeAudio.played = [];
    FakeAudio.prototype.play = function () { return Promise.resolve(); };
    FakeAudio.prototype.pause = function () {};

    /** The real markup, lifted out of index.html so the code and the card that
     *  ships are tested against each other rather than against a stub. */
    function cardMarkup() {
        const card = doc.getElementById('freeSpeaking');
        expect(card).not.toBeNull();
        return card.outerHTML;
    }

    let state;
    let FS;
    let Archive;
    let warned;
    const flush = () => new Promise(r => setTimeout(r, 0));

    /**
     * Build the card: real markup, real archive over a fake IndexedDB, and the
     * free-production block with its app.js dependencies injected.
     * @param {Object} [opts] { level, microphone }
     */
    function build(opts) {
        const o = opts || {};
        document.body.innerHTML = cardMarkup();

        BlobStore._reset();
        BlobStore._useEnvironment({ indexedDB: new FakeIndexedDB({}), IDBKeyRange: FakeKeyRange });
        BlobStore._now = () => new Date(2026, 8, 12, 21, 40).getTime();

        global.URL.createObjectURL = () => 'blob:free/1';
        global.URL.revokeObjectURL = () => {};

        const win = {
            BlobStore: BlobStore,
            AppErrorHandler: { logError: (e, context) => warned.push(context) },
            URL: global.URL,
            Audio: FakeAudio,
            Blob: FakeBlob,
            MediaRecorder: o.microphone === false ? undefined : FakeMediaRecorder,
            navigator: o.microphone === false
                ? {}
                : {
                    mediaDevices: {
                        getUserMedia: () => o.microphone === 'refused'
                            ? Promise.reject(new Error('NotAllowedError'))
                            : Promise.resolve({ getTracks: () => [{ stop() {} }] })
                    }
                }
        };
        Archive = new Function('window', archiveBlock() + '\n;return window.RecordingArchive;')(win);
        win.RecordingArchive = Archive;

        state = {
            currentDifficulty: o.level || 'everyday',
            freeSpeaking: { index: 0, prompts: o.prompts || {} }
        };

        const deps = {
            state: state,
            window: win,
            // app.js reads the archive through the bare global after guarding on
            // `window.RecordingArchive`, which is the house style in this file.
            RecordingArchive: Archive,
            URL: global.URL,
            Audio: FakeAudio,
            AppErrorHandler: win.AppErrorHandler,
            appendGrammarText: appendGrammarText,
            joinWithAnd: list => !list || !list.length ? ''
                : (list.length === 1 ? list[0]
                    : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]),
            saveProgress: () => { state.saved = (state.saved || 0) + 1; },
            reportArchiveSave: (result, statusId) => {
                const el = document.getElementById(statusId);
                if (el && result && result.message) el.textContent = result.message;
            },
            Levels: { levelLabel: id => ({ foundation: 'Foundation', everyday: 'Everyday', confident: 'Confident', fluent: 'Fluent' })[id] || null },
            canonicalLevel: v => v,
            LEVELS: [
                { id: 'foundation', order: 1 }, { id: 'everyday', order: 2 },
                { id: 'confident', order: 3 }, { id: 'fluent', order: 4 }
            ],
            freeSpeakingPrompts: Data.freeSpeakingPrompts,
            normaliseFreeSpeakingList: Data.normaliseFreeSpeakingList,
            Session: null
        };
        const names = Object.keys(deps);
        FS = new Function(...names, fsBlock() + `
;return {
    load: loadFreeSpeakingPrompt, ensure: ensureFreeSpeakingPrompt,
    open: openFreeSpeakingPrompt, promptsFor: freeSpeakingPromptsFor,
    all: freeSpeakingAllPrompts, mark: markFreeSpeakDone, tick: freeSpeakTick,
    totals: freeSpeakTotals, elapsed: freeSpeakElapsed,
    suggested: freeSpeakSuggestedIndex, sanitize: sanitizeFreeSpeaking,
    session: () => freeSpeakSession, SURFACE: FREE_SPEAK_SURFACE
};`)(...names.map(n => deps[n]));
        return FS;
    }

    /** app.js's own markup helper, lifted verbatim so the *cited word* markup is
     *  rendered the way the app renders it. */
    function appendGrammarText(el, text) {
        const raw = text == null ? '' : String(text);
        raw.split(/(\*\*[^*]+\*\*)/).forEach(chunk => {
            if (!chunk) return;
            if (chunk.length > 4 && chunk.startsWith('**') && chunk.endsWith('**')) {
                const strong = document.createElement('strong');
                strong.textContent = chunk.slice(2, -2);
                el.appendChild(strong);
                return;
            }
            chunk.split(/(\*[^*]+\*)/).forEach(part => {
                if (!part) return;
                if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
                    const em = document.createElement('em');
                    em.textContent = part.slice(1, -1);
                    el.appendChild(em);
                    return;
                }
                el.appendChild(document.createTextNode(part));
            });
        });
        return el;
    }

    const text = id => (document.getElementById(id) || {}).textContent;
    const labels = id => Array.from(document.getElementById(id).querySelectorAll('button'))
        .map(b => b.textContent);
    const paragraphs = id => Array.from(document.getElementById(id).querySelectorAll('p'))
        .map(p => p.textContent);

    beforeEach(() => {
        warned = [];
        FakeAudio.played = [];
        global.AppErrorHandler = { logError: (e, context) => warned.push(context) };
    });

    afterEach(() => {
        BlobStore._useEnvironment(null);
        BlobStore._now = REAL_NOW;
    });

    // ------------------------------------------------------------------
    // The markup
    // ------------------------------------------------------------------

    describe('the markup it draws into', () => {
        it('puts the card inside Listening & Speaking, after Read Aloud', () => {
            const card = doc.getElementById('freeSpeaking');
            expect(card.closest('#listening')).not.toBeNull();
            const cards = Array.from(doc.querySelectorAll('#listening .exercise-card'));
            expect(cards.indexOf(card)).toBe(cards.length - 1);
            // Speaking is not a section in js/core/sections.js and cannot become
            // one without renumbering every learner's Alt+N shortcuts, so the
            // section that already says "& Speaking" is where this lives.
            expect(doc.getElementById('listening-title').textContent)
                .toContain('Speaking');
        });

        it.each([
            'freeSpeakPrompt', 'freeSpeakClock', 'freeSpeakControls',
            'freeSpeakStatus', 'freeSpeakRubric', 'freeSpeakArchive',
            'prevFreeSpeak', 'nextFreeSpeak'
        ])('#%s exists inside the card', id => {
            const el = doc.getElementById(id);
            expect(el).not.toBeNull();
            expect(el.closest('#freeSpeaking')).not.toBeNull();
        });

        it('does not announce the clock once a second', () => {
            // role="timer" with aria-live="off": a live region ticking every
            // second would talk over the learner mid-sentence, which is the one
            // thing this card exists to let them do.
            const clock = doc.getElementById('freeSpeakClock');
            expect(clock.getAttribute('role')).toBe('timer');
            expect(clock.getAttribute('aria-live')).toBe('off');
            // The status line IS polite, so the one message that matters — the
            // target going by, and the outcome — is announced.
            expect(doc.getElementById('freeSpeakStatus').getAttribute('aria-live'))
                .toBe('polite');
        });

        it('starts the archive region empty and hidden', () => {
            const archive = doc.getElementById('freeSpeakArchive');
            expect(archive.hasAttribute('hidden')).toBe(true);
            expect(archive.textContent.trim()).toBe('');
        });

        it('says in the markup that nothing here is scored', () => {
            const card = doc.getElementById('freeSpeaking');
            const instruction = card.querySelector('.instruction').textContent;
            expect(instruction).toContain('Nothing here is scored');
            expect(instruction).toContain('cannot grade free speech');
            expect(instruction).toContain('The clock only counts — it never stops you.');
        });
    });

    // ------------------------------------------------------------------
    // The walk
    // ------------------------------------------------------------------

    describe('what the learner sees, step by step', () => {
        it('opens on a prompt, a clock at zero and a collapsed rubric', () => {
            build({ level: 'everyday' });
            FS.load();

            const prompt = FS.session().prompt;
            expect(prompt.id).toBe('tell-me-about-yourself');
            expect(paragraphs('freeSpeakPrompt')).toEqual([
                'Answer the interview question Tell me about yourself out loud, as if the interview has just started.',
                'about 1:30, as a target and not a limit · interview practice · Everyday prompt',
                'Cover these, in any order and in your own words:',
                'Say it to the wall, to your phone, or under your breath. The part that transfers is building the answer while the clock runs.'
            ]);
            expect(Array.from(document.querySelectorAll('.free-speak-bullets li')).map(li => li.textContent))
                .toEqual([
                    'what you do now, in one sentence',
                    'one thing you are good at, and a time it mattered',
                    'what you want to do next'
                ]);

            // The clock is drawn before anything starts, and it says what the
            // number means: a target, not a limit.
            expect(text('freeSpeakClock')).toBe('0:00 of the 1:30 you are aiming for');

            // The rubric is COLLAPSED. An open checklist above an unstarted task
            // is a script, and §1.1 asks for speech not read off the screen.
            const details = document.querySelector('#freeSpeakRubric details');
            expect(details).not.toBeNull();
            expect(details.hasAttribute('open')).toBe(false);
            expect(details.querySelector('summary').textContent)
                .toBe('What you will check afterwards — open it now if you want to');
            expect(document.querySelectorAll('#freeSpeakRubric input').length).toBe(0);
        });

        it('offers every route before it offers the microphone', () => {
            build({ level: 'everyday' });
            FS.load();
            expect(labels('freeSpeakControls')).toEqual([
                '🎤 Record and start the clock',
                '▶ Start the clock without recording',
                '⏹ Stop',
                '🗣️ I said it out loud',
                '🤫 I did it silently',
                '↷ Skip this one'
            ]);
            // Stop is the only disabled control, and only because nothing has
            // started. No finishing route is ever gated (FR-SPK-9).
            expect(document.getElementById('freeSpeakStop').disabled).toBe(true);
            ['freeSpeakAloud', 'freeSpeakSilent', 'freeSpeakSkip'].forEach(id => {
                expect(document.getElementById(id).disabled).toBe(false);
            });
            expect(text('freeSpeakControls'))
                .toContain('All three of these finish the task.');
            expect(text('freeSpeakControls'))
                .toContain('it cannot hear you, so your word is the only evidence there is');
        });

        it('records, and says so while it is recording', async () => {
            build({ level: 'everyday' });
            FS.load();
            document.getElementById('freeSpeakRecord').click();
            await flush();

            expect(text('freeSpeakStatus')).toBe(
                '🔴 Recording, and the clock is running. Press Stop when you have finished — ' +
                'nothing will cut you off.');
            expect(Archive.isRecording(FS.SURFACE)).toBe(true);
            expect(document.getElementById('freeSpeakStop').disabled).toBe(false);
        });

        it('passing the target changes the words and nothing else', async () => {
            build({ level: 'everyday' });
            FS.load();
            document.getElementById('freeSpeakRecord').click();
            await flush();

            // 200 seconds against a 90-second target.
            FS.session().clock.elapsedMs = 200 * 1000;
            FS.tick();

            expect(text('freeSpeakClock')).toBe('3:20 of the 1:30 you are aiming for');
            expect(text('freeSpeakStatus')).toBe(
                'You have passed the 1:30 you were aiming for. Nothing stops — keep going for as ' +
                'long as you have something to say, and press Stop when you are finished.');

            // THE PROOF THAT THE TIMER CANNOT END THE TASK: after the target has
            // gone by, the recorder is still running, no route has been recorded,
            // no control has been disabled and nothing has been written.
            expect(Archive.isRecording(FS.SURFACE)).toBe(true);
            expect(FS.session().route).toBeNull();
            expect(document.getElementById('freeSpeakStop').disabled).toBe(false);
            expect(state.freeSpeaking.prompts).toEqual({});

            // And it is said once, not once a second.
            FS.session().clock.elapsedMs = 300 * 1000;
            FS.tick();
            expect(text('freeSpeakStatus')).toContain('You have passed the 1:30');
            expect(FS.session().clock.passed).toBe(true);
        });

        it('stops, keeps the recording, and opens the rubric', async () => {
            build({ level: 'everyday' });
            FS.load();
            document.getElementById('freeSpeakRecord').click();
            await flush();
            FS.session().clock.elapsedMs = 95 * 1000;
            document.getElementById('freeSpeakStop').click();
            await flush();

            expect(FS.session().route).toBe('recorded');
            expect(text('freeSpeakStatus')).toContain('Kept.');
            expect(text('freeSpeakStatus')).toContain('You kept going for 1:35.');
            expect(text('freeSpeakStatus')).toContain(
                'Nothing was scored: the app can play it back to you, and that is the whole of ' +
                'what it can honestly do.');

            // The rubric is now the learner's checklist, one checkbox per item.
            expect(document.querySelector('#freeSpeakRubric h4').textContent)
                .toBe('Check yourself');
            const asks = Array.from(document.querySelectorAll('#freeSpeakRubric li'))
                .map(li => li.textContent.trim());
            expect(asks).toEqual([
                'After you said what you are good at, did you give an actual example — a time it happened — or did you only make the claim?',
                'Did you say I have five years of experience rather than I am having five years of experience?',
                'Did you talk for about as long as you aimed for, or did you run out halfway?',
                'Did you reach the end of every sentence you started?'
            ]);
            expect(document.querySelectorAll('#freeSpeakRubric input[type="checkbox"]').length)
                .toBe(4);
            expect(paragraphs('freeSpeakRubric')[0]).toBe(
                'Notes to yourself, and nothing else: nothing counts the ticks, nothing stores them ' +
                'and there is no total. Every question is about what you did, which is the only ' +
                'thing you are in a position to answer — and it is why none of them asks how you ' +
                'sounded.');
            expect(labels('freeSpeakRubric')).toEqual(['▶ Play your recording back']);
        });

        it('shows no total, no fraction and no score after the attempt', async () => {
            build({ level: 'everyday' });
            FS.load();
            document.getElementById('freeSpeakRecord').click();
            await flush();
            document.getElementById('freeSpeakStop').click();
            await flush();

            // Tick every box. Nothing on screen counts them.
            const boxes = Array.from(document.querySelectorAll('.free-speak-tick'));
            boxes.forEach(box => { box.checked = true; box.dispatchEvent(new Event('change')); });

            const card = document.getElementById('freeSpeaking').textContent;
            expect(card).not.toMatch(/\b4\s*(\/|of)\s*4\b/);
            expect(card).not.toMatch(/%/);
            expect(card).not.toMatch(/\bscore\b/i);
            expect(card).not.toMatch(/\b(pass|fail)ed?\b/i);
            // And nothing was stored: the ticks are the learner's private notes.
            expect(JSON.stringify(state.freeSpeaking)).not.toContain('example-given');
        });

        it('lands the recording in the archive under a content-derived id', async () => {
            build({ level: 'everyday' });
            FS.load();
            const prompt = FS.session().prompt;

            // The id is the digest of the PROMPT TEXT, not the authored slug and
            // not the position in the array.
            expect(FS.session().promptId)
                .toBe(Archive.promptIdFor('free', prompt.prompt));
            expect(FS.session().promptId).toMatch(/^free:1:[a-z0-9]{14}$/);
            expect(FS.session().promptId).not.toContain(prompt.id);
            // The position is not in it, so inserting a prompt in front is free.
            const reversed = Data.normaliseFreeSpeakingList(
                Data.freeSpeakingPrompts.everyday.slice().reverse(), 'everyday');
            expect(Archive.freeSpeakingPromptId(reversed[reversed.length - 1]))
                .toBe(FS.session().promptId);

            document.getElementById('freeSpeakRecord').click();
            await flush();
            document.getElementById('freeSpeakStop').click();
            await flush();
            await flush();

            const rows = await Archive.list(FS.session().promptId);
            expect(rows).toHaveLength(1);
            expect(rows[0].baseline).toBe(true);
            expect(rows[0].promptId).toBe(FS.session().promptId);
            // Drawn, with the archive's own copy and the right noun.
            expect(document.querySelector('#freeSpeakArchive .archive-head').textContent)
                .toBe('Your recordings of this prompt');
            expect(document.querySelector('#freeSpeakArchive .archive-when').textContent)
                .toBe('Your first try — 12 Sep 2026, 21:40 (0:01)');
        });

        it('keys the archive on the task, so editing anything else is free', () => {
            build({ level: 'everyday' });
            const prompt = Data.normaliseFreeSpeakingList(
                Data.freeSpeakingPrompts.everyday, 'everyday')[0];
            const id = Archive.freeSpeakingPromptId(prompt);

            // The slug, the tier, the length, the situation, the bullets and the
            // whole rubric can be rewritten without costing a learner a recording.
            const edited = Object.assign({}, prompt, {
                id: 'renamed-slug', tier: 'confident', targetSeconds: 300,
                situation: 'work', bullets: [], rubric: [], notes: 'different'
            });
            expect(Archive.freeSpeakingPromptId(edited)).toBe(id);

            // Rewriting the TASK does change it, and must: a different prompt is a
            // different thing to have recorded.
            expect(Archive.freeSpeakingPromptId(
                Object.assign({}, prompt, { prompt: 'Describe your last holiday.' })))
                .not.toBe(id);

            // Punctuation and casing are not the utterance.
            expect(Archive.freeSpeakingPromptId(
                Object.assign({}, prompt, { prompt: prompt.prompt.toUpperCase() })))
                .toBe(id);
        });

        it('gives no two authored prompts the same archive key', () => {
            build({});
            const ids = FS.all().map(p => Archive.freeSpeakingPromptId(p));
            expect(ids.filter(Boolean)).toHaveLength(ids.length);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    // ------------------------------------------------------------------
    // US-608 — the silent path, on this surface
    // ------------------------------------------------------------------

    describe('the silent path finishes it, with no microphone at all', () => {
        it('drops one button and nothing else when there is no recorder', () => {
            build({ microphone: false });
            FS.load();

            // No 🎤 button, because there is nothing behind it. Not a disabled
            // one: a dead control is what the listening card used to be.
            expect(document.getElementById('freeSpeakRecord')).toBeNull();
            expect(labels('freeSpeakControls')).toEqual([
                '▶ Start the clock',
                '⏹ Stop',
                '🗣️ I said it out loud',
                '🤫 I did it silently',
                '↷ Skip this one'
            ]);
            expect(text('freeSpeakControls')).toContain(
                'This device has no microphone the app can use, so there is nothing to record or ' +
                'play back. Start the clock, say your answer — out loud or under your breath — and ' +
                'mark how you did it below. That is the task, and it was never the recording.');
            // The prompt, the clock and the rubric are all still there.
            expect(text('freeSpeakClock')).toBe('0:00 of the 1:30 you are aiming for');
            expect(document.querySelector('#freeSpeakRubric details')).not.toBeNull();
        });

        it('completes the task silently, and stores it as silent', async () => {
            build({ microphone: false });
            FS.load();

            document.getElementById('freeSpeakClockStart').click();
            expect(text('freeSpeakStatus')).toBe(
                'The clock is running. Say your answer — nothing is being recorded, and nothing ' +
                'is listening.');

            FS.session().clock.elapsedMs = 88 * 1000;
            document.getElementById('freeSpeakStop').click();
            expect(text('freeSpeakStatus')).toBe(
                'Clock stopped at 1:28. Nothing was recorded, so tell the app how you did it — ' +
                'out loud, or silently.');

            document.getElementById('freeSpeakSilent').click();
            expect(FS.session().route).toBe('silent');
            expect(text('freeSpeakStatus')).toBe(
                'Marked as done, silently — and that counts as production, not as a skip. ' +
                'Composing the sentence is the part that transfers to a real conversation. The app ' +
                'records that you did it silently rather than pretending it heard you. ' +
                'You kept going for 1:28.');

            // The rubric opens for a silent attempt exactly as it does for a
            // recorded one — with no playback button, because there is nothing to
            // play.
            expect(document.querySelector('#freeSpeakRubric h4').textContent)
                .toBe('Check yourself');
            expect(document.getElementById('freeSpeakPlayback')).toBeNull();

            // Stored as SILENT, not as spoken and not as a skip.
            const row = state.freeSpeaking.prompts[FS.session().promptId];
            expect(row).toEqual({
                recorded: 0, aloud: 0, silent: 1, skipped: 0,
                lastAt: expect.any(Number), lastRoute: 'silent', lastSeconds: 88
            });
            expect(FS.totals()).toEqual({
                recorded: 0, aloud: 0, silent: 1, skipped: 0, productions: 1, prompts: 1
            });
        });

        it('distinguishes spoken from silent from skipped, and never merges them', () => {
            // The four routes are four different claims, and §9.1 Decision 2
            // forbids laundering one into another. A skip is not a production.
            build({});
            FS.load();
            const first = FS.session().promptId;
            FS.mark('silent');

            FS.open(1);
            FS.mark('aloud');
            const second = FS.session().promptId;

            FS.open(0);
            expect(FS.session().route).toBeNull();   // a fresh attempt at prompt 1
            FS.mark('skipped');

            expect(state.freeSpeaking.prompts[first].silent).toBe(1);
            expect(state.freeSpeaking.prompts[first].skipped).toBe(1);
            expect(state.freeSpeaking.prompts[first].recorded).toBe(0);
            expect(state.freeSpeaking.prompts[second].aloud).toBe(1);
            expect(FS.totals()).toEqual({
                recorded: 0, aloud: 1, silent: 1, skipped: 1, productions: 2, prompts: 2
            });
        });

        it('says a skip is a skip, and does not open the rubric for it', () => {
            build({});
            FS.load();
            document.getElementById('freeSpeakSkip').click();

            expect(text('freeSpeakStatus')).toBe(
                'Skipped, and recorded as a skip rather than as a production. It costs you ' +
                'nothing, and this prompt will be here next time.');
            // Nothing happened, so there is nothing to check. The collapsed
            // preview is left as it was.
            expect(document.querySelector('#freeSpeakRubric details')).not.toBeNull();
            expect(document.querySelector('#freeSpeakRubric h4')).toBeNull();
        });

        it('leaves the clock running when the microphone is refused', async () => {
            // R-7 / FR-A11Y-4 at the moment it bites: the learner presses Record
            // and then declines the permission dialog. Before US-703 the listening
            // card alert()ed and stopped; this card must not lose the task.
            build({ microphone: 'refused' });
            FS.load();
            document.getElementById('freeSpeakRecord').click();
            await flush();

            expect(text('freeSpeakStatus')).toBe(
                'No microphone, so nothing is being recorded. The clock is still running — say ' +
                'your answer anyway and mark how you did it below. Nothing here is scored ' +
                'either way.');
            // The clock is running, the finishing routes are live, and the task is
            // finishable in one press.
            expect(FS.session().clock.startedAt).not.toBeNull();
            expect(document.getElementById('freeSpeakSilent').disabled).toBe(false);
            document.getElementById('freeSpeakAloud').click();
            expect(FS.session().route).toBe('aloud');
            expect(FS.totals().productions).toBe(1);
        });

        it('counts a silent completion exactly as it counts an aloud one', () => {
            build({});
            FS.load();
            FS.mark('silent');
            const silent = FS.totals();

            build({});
            FS.load();
            FS.mark('aloud');
            const aloud = FS.totals();

            // Same number of finished tasks, same number of prompts produced.
            // Saying yes to this is the whole of the judgement in US-608: a
            // silently-completed task counts, and the route is what is reported.
            expect(silent.productions).toBe(aloud.productions);
            expect(silent.prompts).toBe(aloud.prompts);
            expect(silent.silent).toBe(1);
            expect(aloud.aloud).toBe(1);
        });

        it('lets a learner answer it again, including after a mis-pressed skip', () => {
            build({});
            FS.load();
            document.getElementById('freeSpeakSkip').click();
            expect(FS.session().route).toBe('skipped');

            // markFreeSpeakDone() is idempotent per attempt, so the first route
            // wins and a second press does nothing — which without a way back
            // would make a mis-pressed Skip cost the prompt for the session.
            document.getElementById('freeSpeakSilent').click();
            expect(FS.session().route).toBe('skipped');
            expect(FS.totals().silent).toBe(0);

            const again = document.getElementById('freeSpeakAgain');
            expect(again).not.toBeNull();
            expect(again.textContent).toBe('🔄 Answer it again');
            again.click();

            // A fresh attempt: no route, clock back to zero — and the skip is
            // still on the record, because a redraw is not an erasure.
            expect(FS.session().route).toBeNull();
            expect(text('freeSpeakClock')).toBe('0:00 of the 1:30 you are aiming for');
            expect(FS.totals().skipped).toBe(1);

            document.getElementById('freeSpeakSilent').click();
            expect(FS.totals()).toEqual({
                recorded: 0, aloud: 0, silent: 1, skipped: 1, productions: 1, prompts: 1
            });
        });

        it('offers the silent route first when the learner cannot speak aloud', () => {
            build({});
            // The session's own control, which is the one the learner already
            // knows about — not a second copy of "can I speak tonight".
            document.body.insertAdjacentHTML('beforeend',
                '<input type="checkbox" id="sessionSilent" checked>');
            FS.load();
            expect(labels('freeSpeakControls').slice(3))
                .toEqual(['🤫 I did it silently', '🗣️ I said it out loud', '↷ Skip this one']);
        });
    });

    // ------------------------------------------------------------------
    // What must not be here
    // ------------------------------------------------------------------

    describe('nothing in this block scores free speech', () => {
        it('never touches SRS, Mistakes or the accuracy maps', () => {
            const code = codeOnlyOf(fsBlock());
            expect(code).not.toContain('SRS.');
            expect(code).not.toContain('Mistakes.');
            expect(code).not.toContain('pronunciationAccuracy');
            expect(code).not.toContain('itemAccuracy');
            // Nor the section counters: this card lives in Listening for markup
            // reasons and must not credit a listening item for a speaking task.
            expect(code).not.toContain('updateStatistics(');
            expect(code).not.toContain('markExerciseComplete(');
            expect(code).not.toContain('dailyGoals');
        });

        it('computes no percentage, ratio or verdict', () => {
            const code = codeOnlyOf(fsBlock());
            expect(code).not.toMatch(/\*\s*100\b/);
            expect(code).not.toMatch(/\bcorrect\b/);
            expect(code).not.toMatch(/\bwpm\b|wordsPerMinute/i);
            // No ' of ' arithmetic over the rubric: the ticks are not counted.
            expect(code).not.toMatch(/rubric[\s\S]{0,80}\.length[\s\S]{0,40}checked/);
        });

        it('never reads a rubric checkbox back', () => {
            // The strongest statement the code can make about "the ticks are not
            // counted": nothing anywhere reads .checked on them.
            const code = codeOnlyOf(fsBlock());
            expect(code).toContain("box.type = 'checkbox'");
            expect(code).not.toMatch(/\.checked\b(?!\s*===\s*true)/);
        });

        it('has no timer callback that can end the task', () => {
            // Belt and braces beside the walk above: the only interval in this
            // block calls freeSpeakTick, and freeSpeakTick paints and nothing else.
            const block = codeOnlyOf(fsBlock());
            const intervals = block.match(/setInterval\([^)]*\)/g) || [];
            expect(intervals).toEqual(['setInterval(freeSpeakTick, 1000)']);
            const tick = block.slice(block.indexOf('function freeSpeakTick('),
                block.indexOf('function startFreeSpeakClock('));
            expect(tick).not.toContain('markFreeSpeakDone');
            expect(tick).not.toContain('stopCapture');
            expect(tick).not.toContain('stopFreeSpeaking');
            expect(tick).not.toMatch(/\.disabled\s*=/);
            // It cannot move the session on either.
            expect(tick).not.toContain('SessionUI');
            expect(tick).not.toMatch(/\bSession\.(advance|skip|markSilent)/);
        });

        it('finishes the task before it touches storage', () => {
            const start = functionBodyOf('function startFreeSpeaking(');
            expect(start.indexOf('markFreeSpeakDone('))
                .toBeLessThan(start.indexOf('keepFreeSpeakRecording('));
        });

        it('refuses to key a save on anything but the derived promptId', () => {
            const keep = functionBodyOf('function keepFreeSpeakRecording(');
            expect(keep).toContain("const promptId = freeSpeakSession ? freeSpeakSession.promptId : '';");
            expect(keep).toContain('if (!promptId || !blob || !blob.size) return;');
            expect(codeOnlyOf(keep)).not.toContain('Index');
        });

        it('releases its own surface and never reaches across', () => {
            const release = functionBodyOf('function releaseFreeSpeak(');
            expect(release).toContain('RecordingArchive.release(FREE_SPEAK_SURFACE)');
            expect(codeOnlyOf(release)).not.toContain('revokeAll');
            // And leaving the section takes the url AND the ticking clock with it.
            const switching = functionBodyOf('function switchSection(');
            expect(switching).toContain('releaseFreeSpeak()');
            expect(functionBodyOf('function releaseFreeSpeak(')).toContain('stopFreeSpeakClock()');
        });

        it('says out loud that a refused microphone changes nothing', () => {
            const start = functionBodyOf('function startFreeSpeaking(');
            expect(start).toContain('No microphone, so nothing is being recorded. The clock is still');
            expect(start).toContain('mark how you did it below');
            expect(start).toContain('Nothing here is scored either way');
        });
    });

    /** Local copies, because the helpers above live in a sibling describe. */
    function codeOnlyOf(source) {
        return source
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .filter(line => !/^\s*\/\//.test(line))
            .join('\n');
    }
    function functionBodyOf(header) {
        const start = appSource.indexOf(header);
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces after ' + header);
    }
});

// ===========================================================================
// US-608 — the silent / skip-and-mark-done path, on every speaking surface
// ===========================================================================
//
// FR-SPK-9 ("speaking is never a hard gate") and FR-A11Y-4 ("every speaking task
// has a silent / skip-and-mark-done path"). The requirement no persona but P2
// surfaces: Lakshmi practises at 10pm and cannot speak aloud without being
// overheard, so a surface whose only completion route makes a sound is a surface
// she cannot use at all.
//
// The check is per-surface, and there are four. Two of them already passed before
// this story (the listening sentence card since US-703, the pronunciation
// production task since US-404) and are pinned here so they cannot regress; two
// did not: Read Aloud had one control and it needed a microphone, and grammar's
// produce task offered "I said it" or "Skip", so a learner who did it silently
// had to choose between a lie and a skip.
//
// The standard every route is held to is the one the listening card set: the route
// is RECORDED and never laundered (BR-3). "I did it silently" must not be stored,
// or reported, as "the app heard you".

describe('the silent path, surface by surface (US-608 / FR-SPK-9 / FR-A11Y-4)', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

    function functionBody(header) {
        const start = appSource.indexOf(header);
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces after ' + header);
    }
    function codeOnly(source) {
        return source
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .filter(line => !/^\s*\/\//.test(line))
            .join('\n');
    }

    describe('1. the listening sentence card — unchanged, and pinned (US-703)', () => {
        it('still has the no-microphone attempt route', () => {
            expect(doc.getElementById('listeningRepeated')).not.toBeNull();
            expect(doc.getElementById('listeningRepeated').textContent).toBe('✓ I said it');
            const wiring = appSource.slice(
                appSource.indexOf("wireListening('listeningRepeated'"),
                appSource.indexOf("wireListening('listeningTextRoute'"));
            expect(wiring).toContain("markListeningAttempt('self-report', true)");
            expect(wiring).toContain('nothing was recorded, so the app is not claiming anything');
        });
    });

    describe('2. Read Aloud — new (it had one control, and it needed a microphone)', () => {
        it('has a container in the markup that app.js draws into', () => {
            const host = doc.getElementById('readAloudSilent');
            expect(host).not.toBeNull();
            // In the Read Aloud card, after the recogniser button — the same
            // ordering the pronunciation task uses: the route that needs no
            // hardware is beside the one that does, not in a separate place.
            expect(host.closest('.exercise-card')
                .querySelector('h3').textContent).toBe('Read Aloud');
            expect(host.previousElementSibling.id).toBe('startSpeech');
        });

        it('offers an aloud route and a silent route, and both complete the card', () => {
            const body = functionBody('function renderReadAloudSilentRoute(');
            expect(body).toContain("aloud.textContent = '🗣️ I read it aloud';");
            expect(body).toContain("silent.textContent = '🤫 I read it silently';");
            // Both go through the one call site for "the learner attempted this",
            // with `complete` true — so neither is a button that only looks like
            // it finished something.
            expect(body).toContain("markListeningAttempt('read-aloud-self-report', true)");
            expect(body).toContain("markListeningAttempt('read-aloud-silent', true)");
        });

        it('records the route and refuses to claim it heard anything', () => {
            const body = functionBody('function renderReadAloudSilentRoute(');
            // Distinct route names: 'read-aloud' is the recogniser, and these two
            // are not it. BR-3 — the route is reported, never laundered.
            expect(body).toContain('read-aloud-self-report');
            expect(body).toContain('read-aloud-silent');
            expect(body).toContain('The recogniser was not used, so the app has no idea ');
            expect(body).toContain('which words landed and is not going to guess');
            expect(body).toContain('is stored as your word — never as something the app heard');
            // And no word-level diff is invented for a route that produced none.
            expect(codeOnly(body)).not.toContain('diffSpeechAttempt');
            expect(codeOnly(body)).not.toContain('renderSpeechDiff');
        });

        it('appears with the text it is about, not before it', () => {
            // This card's target IS the transcript (FR-LSN-3), so offering to mark
            // it done before the reveal would be offering to complete a task whose
            // words the learner cannot see.
            const body = functionBody('function renderReadAloudSilentRoute(');
            expect(body).toContain('!listeningSession.revealed) return;');
            const reveal = functionBody('function revealListeningTranscript(');
            expect(reveal).toContain('renderReadAloudSilentRoute();');
            // Reset per item, from the loader, like every other per-item surface.
            expect(functionBody('function loadListeningExercise('))
                .toContain('renderReadAloudSilentRoute();');
        });
    });

    describe('3. grammar produce — new (it had "I said it" or "Skip")', () => {
        it('now offers all three routes', () => {
            const body = functionBody('function renderGrammarProduce(');
            expect(body).toContain("done.textContent = '🗣️ I said it';");
            expect(body).toContain("silently.textContent = '🤫 I did it silently';");
            expect(body).toMatch(/notYet\.textContent = produce\.skippable \? 'Skip for now' : 'Not yet';/);
            // All three are appended, so all three are reachable.
            expect(body).toContain('buttons.appendChild(silently);');
            expect(body).toContain('buttons.appendChild(notYet);');
        });

        it('does not style the silent route as the lesser one', () => {
            const body = functionBody('function renderGrammarProduce(');
            // Same class as "I said it" — §9.1 Decision 2: "neither is presented
            // as the lesser path". Only the ORDER changes, and only for a learner
            // who has said they cannot speak aloud.
            expect(body).toContain("silently.className = 'btn-primary';");
            expect(body).toContain("done.className = 'btn-primary';");
            expect(body).toContain('if (freeSpeakPrefersSilent()) {');
        });

        it('says the silent route counts, and still claims nothing', () => {
            const body = functionBody('function renderGrammarProduce(');
            expect(body).toContain('Noted as done silently, and that counts');
            expect(body).toContain('Nothing was recorded and nothing is scored.');
            // And it is not sent to SRS, for the same reason "I said it" is not:
            // a learner marking their own production right is not evidence, and
            // FR-SRS-5 would refuse to certify it.
            const handler = body.slice(
                body.indexOf("silently.addEventListener('click'"),
                body.indexOf('const notYet = document.createElement'));
            expect(codeOnly(handler)).not.toContain('SRS.');
        });
    });

    describe('4. pronunciation production — already silent-capable, now said out loud', () => {
        it('states the silent route rather than leaving it to be inferred', () => {
            const body = functionBody('function renderPronunciationProduce(');
            // "out loud, in front of a mirror" reads as a requirement to a learner
            // who cannot make a sound tonight. The feel-checks are articulatory,
            // so mouthing the word answers them exactly as well.
            expect(body).toContain('If you cannot speak out loud right now, mouth it or whisper it.');
            expect(body).toContain('about what your mouth did, not about what came out');
            expect(body).toContain('practise properly at midnight');
        });

        it('still completes with no microphone and no audio', () => {
            const body = functionBody('function renderPronunciationProduce(');
            const silentLine = body.indexOf('If you cannot speak out loud right now');
            const yes = body.indexOf('Yes, I felt that');
            const comparison = body.indexOf('appendPronunciationComparison(host, pair)');
            // The order that matters: the no-hardware routes come before the
            // recorder, which is appended last.
            expect(silentLine).toBeLessThan(yes);
            expect(yes).toBeLessThan(comparison);
        });
    });

    describe('the session step, which is what a route finally completes', () => {
        it('still offers three routes and marks the step done on all three', () => {
            const body = functionBody('    renderControls(step) {');
            expect(body).toContain("'🗣️ I said it'");
            expect(body).toContain("'🤫 I did it silently'");
            expect(body).toContain("'↷ Skip this'");
            expect(body).toContain("SessionUI.advance('silent')");
            expect(body).toContain("SessionUI.advance('skipped')");
        });

        it('routes a silent completion through the module\'s own silent path', () => {
            // Session.markSilent(), not Session.advance('done'): the planner is
            // what reports the route in the wrap-up, and it can only report what
            // it was told (BR-3 / metric M-1).
            const body = functionBody('    advance(outcome) {');
            expect(body).toContain("outcome === 'silent' ? Session.markSilent()");
            expect(body).toContain("outcome === 'skipped' ? Session.skip()");
        });

        it('tells the learner a skipped production produced nothing', () => {
            const wrap = functionBody('    renderWrapUp() {');
            expect(wrap).toContain('so this session produced no English of your own');
            expect(wrap).toContain('That is recorded as it happened');
        });
    });

    describe('the honesty audit', () => {
        it('no longer says nothing renders a free-production prompt', () => {
            // The audit is the thing that must not lie. Before this story the row
            // read `available: false` with the note "No function in app.js renders
            // a free-production prompt with a timer, a recording and a rubric",
            // and that sentence has to go because it is no longer true.
            expect(appSource).not.toContain(
                'No function in app.js renders a free-production prompt');
            const at = appSource.indexOf("'speak.free': function");
            expect(at).toBeGreaterThan(-1);
            const row = appSource.slice(at, at + 2000);
            expect(row).toContain('freeSpeakingPromptsFor(');
            expect(row).toContain("requirement: 'FR-SPK-3'");
            // It reports available only when a prompt actually resolves — the
            // predicate calls the same function the loader resolves the tier with.
            expect(row).toContain('if (!prompts.length)');
            expect(row).toContain('available: false');
            expect(row).toContain('available: true');
            expect(row).toContain('never a countdown');
        });

        it('leaves the two surfaces that are still unbuilt saying so', () => {
            // US-608 is not a licence to tidy the audit: listen.comprehend and
            // speak.shadow are still unbuilt and still say `false`, each with the
            // requirement it misses.
            const row = name => {
                const at = appSource.indexOf("'" + name + "': {");
                expect(at).toBeGreaterThan(-1);
                return appSource.slice(at, appSource.indexOf('},', at));
            };
            expect(row('listen.comprehend')).toContain('available: false');
            expect(row('listen.comprehend')).toContain("requirement: 'FR-LSN-1'");
            expect(row('speak.shadow')).toContain('available: false');
            expect(row('speak.shadow')).toContain("requirement: 'FR-SPK-8'");
        });

        it('routes the speak step into the card it now has', () => {
            const at = appSource.indexOf("    'speak.free': function (step) {");
            expect(at).toBeGreaterThan(-1);
            const route = appSource.slice(at, appSource.indexOf("    'session.summary': function ()"));
            expect(route).toContain("switchSection('listening')");
            expect(route).toContain('openFreeSpeakingPrompt(freeSpeakSuggestedIndex())');
            expect(route).toContain("sessionReveal(document.getElementById('freeSpeaking'))");
            expect(route).toContain('the clock does not stop you');
        });
    });
});

/**
 * Vocabulary must render with the network broken (CON-6, FR-CNT-4, US-714).
 *
 * WHY THIS BLOCK EXISTS, because it is the whole point of it: an eighteen-second
 * hang reached production and was reported from the live site. `fetchWordData()`
 * tried api.dictionaryapi.dev FIRST for every curated word, through a retry ladder
 * of 3 attempts x a 5s timeout plus 1s and 2s of backoff, before falling back to
 * data.js. "Happy" — the first foundation word, authored with its own IPA and its
 * own quiz — sat behind a "Loading word..." spinner for eighteen seconds on flaky
 * mobile data.
 *
 * CON-6 makes `api.dictionaryapi.dev` the one optional API, enhancement only, and
 * says "its failure must never block an exercise"; FR-CNT-4 says curated content
 * serves first. Both were stated requirements and neither was asserted anywhere,
 * which is why this shipped. So these tests are about the ORDER of resolution and
 * the CEILING on waiting, not about the API.
 *
 * (CON-6, not NFR-8, which is service-worker media caching. The first draft of this
 * block cited NFR-8 and was wrong; several `NFR-8's principle` comments elsewhere in
 * app.js use it as loose shorthand for "an optional subsystem must not block an
 * exercise", which for storage is NFR-10's and blobstore's own guarantee.)
 */
describe('vocabulary resolves offline: curated content serves first (CON-6, FR-CNT-4)', () => {
    const fs = require('fs');
    const path = require('path');
    const ROOT = path.join(__dirname, '..', '..');
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

    /** One top-level function's source, by brace matching. */
    function fnSource(name) {
        const start = appSource.indexOf('function ' + name + '(');
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces in ' + name);
    }

    /** curatedWordData(), evaluated against the real data.js. */
    function loadCuratedLookup() {
        const Data = require(path.join(ROOT, 'data.js'));
        const factory = new Function('vocabularyData',
            fnSource('curatedWordData') + '\n;return curatedWordData;');
        return factory(Data.vocabularyData);
    }

    test('the first curated word resolves from data.js, with its authored ipa and quiz', () => {
        const curatedWordData = loadCuratedLookup();
        const happy = curatedWordData('Happy');
        expect(happy).toBeTruthy();
        expect(happy.word).toBe('Happy');
        // Authored, not whatever the API's `phonetic` happens to be.
        expect(happy.pronunciation).toBe('/ˈhæpi/');
        // Authored distractors, not definitions borrowed from other entries.
        expect(happy.quiz.options).toHaveLength(4);
        expect(typeof happy.quiz.correct).toBe('number');
        expect(happy.quiz.options[happy.quiz.correct]).toBe('Joyful');
    });

    test('lookup is case-insensitive and searches every tier', () => {
        const curatedWordData = loadCuratedLookup();
        expect(curatedWordData('happy')).toBeTruthy();
        expect(curatedWordData('HAPPY')).toBeTruthy();
        const Data = require(path.join(ROOT, 'data.js'));
        // One word from each populated tier must be findable.
        Object.keys(Data.vocabularyData).forEach((tier) => {
            const list = Data.vocabularyData[tier];
            if (!Array.isArray(list) || !list.length) return;
            expect(curatedWordData(list[0].word)).toBeTruthy();
        });
    });

    test('⚠️ THE TRAP: an unknown word returns null, not an arbitrary curated word', () => {
        // getLocalWordData() cannot be used as the "do we have this?" test, because
        // it ends with `localWords[state.currentWordIndex % localWords.length]` and
        // therefore answers YES for every word in the language. A curated-first
        // check built on it would cheerfully serve the wrong word.
        const curatedWordData = loadCuratedLookup();
        expect(curatedWordData('zzzznotaword')).toBeNull();
        expect(curatedWordData('')).toBeNull();
        expect(curatedWordData(null)).toBeNull();
        expect(curatedWordData(undefined)).toBeNull();
    });

    test('the curated check precedes the network branch, so a curated word never fetches', () => {
        const fetchWordData = fnSource('fetchWordData');
        const curatedAt = fetchWordData.indexOf('curatedWordData(word)');
        const onlineAt = fetchWordData.indexOf('navigator.onLine');
        const fetchAt = fetchWordData.indexOf('await fetch(');
        expect(curatedAt).toBeGreaterThan(-1);
        expect(onlineAt).toBeGreaterThan(-1);
        expect(curatedAt).toBeLessThan(onlineAt);
        expect(curatedAt).toBeLessThan(fetchAt);
        // And it returns rather than falling through.
        expect(fetchWordData).toMatch(/if \(curated\) return curated;/);
    });

    test('the retry ladder is gone from this call: one attempt, no backoff', () => {
        const fetchWordData = fnSource('fetchWordData');
        // 3 attempts with a 1000ms base was up to 18s of spinner. A retry ladder is
        // right for a resource you NEED; for an optional enrichment it only turns a
        // fast failure into a slow one.
        expect(fetchWordData).toMatch(/,\s*1,\s*0,\s*`fetchWordData/);
        expect(fetchWordData).not.toMatch(/,\s*3,\s*1000,/);
    });

    test('the per-attempt timeout is bounded well under the old 5s', () => {
        const fetchWordData = fnSource('fetchWordData');
        const m = fetchWordData.match(/AbortSignal\.timeout\((\d+)\)/);
        expect(m).toBeTruthy();
        expect(Number(m[1])).toBeLessThanOrEqual(4000);
    });

    test('retryWithBackoff itself is untouched, so other callers keep the ladder', () => {
        // The fix belongs at the call site. Weakening the shared helper would
        // silently change every caller that legitimately wants retries.
        expect(appSource).toContain('async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000');
        // And someone else IS still relying on those defaults, so this matters:
        // the helper is called somewhere other than fetchWordData.
        const calls = appSource.match(/retryWithBackoff\(/g) || [];
        expect(calls.length).toBeGreaterThanOrEqual(2);   // the definition plus >=1 call
    });
});

/**
 * =============================================================================
 * US-408 — media routing in the service worker, and the offline.html defect
 * =============================================================================
 *
 * NFR-8 (REQUIREMENTS.md:700): *"Media caching is explicit — audio requests are
 * routed deliberately by the service worker, tolerate Range/206 responses, and
 * never fall back to an HTML page."*
 *
 * All three clauses were false, and the third was a live defect:
 *
 *   - NOT ROUTED. isStaticAsset()'s extension list contains no audio extension
 *     and an <audio> element sends no `Accept: text/html`, so every clip fell
 *     through every branch of the fetch handler onto the DEFAULT one.
 *   - THE DEFAULT ONE FELL BACK TO A HTML PAGE. cacheFirstStrategy()'s catch
 *     returned `caches.match('/offline.html')` for anything that reached it. A
 *     media element handed an HTML document AT STATUS 200 downloads it, fails to
 *     demux it, and reports MEDIA_ERR_SRC_NOT_SUPPORTED — "this file is corrupt".
 *     The learner is told the recording is broken when they are simply offline,
 *     and nothing in app.js could tell the difference either, because at the
 *     fetch layer it was a SUCCESS.
 *   - RANGE was handled only accidentally: `status === 200` happened to exclude a
 *     206 from cache.put() (which throws a TypeError on one), but a range request
 *     against a cached complete clip was answered with a 200 claiming to be the
 *     whole file.
 *
 * These tests run the real functions out of service-worker.js against fake
 * `caches`/`fetch`. The fake Response is the honest limitation: jsdom has no
 * Response, so the shape is reproduced here (see FakeResponse) and these tests
 * therefore prove the WORKER'S BRANCHING, not the browser's media stack.
 */
describe('service worker: media is routed deliberately (US-408 / NFR-8)', () => {
    const fs = require('fs');
    const path = require('path');
    const ROOT = path.join(__dirname, '..', '..');
    const swSource = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');

    /** One top-level function's source, by brace matching. */
    function fnSource(source, name) {
        const re = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(');
        const m = re.exec(source);
        expect(m).toBeTruthy();
        const start = m.index;
        let depth = 0;
        for (let i = source.indexOf('{', start); i < source.length; i++) {
            if (source[i] === '{') depth++;
            else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
        }
        throw new Error('unbalanced braces in ' + name);
    }

    // ---- fakes -------------------------------------------------------------

    /**
     * jsdom HAS a Headers, and it cannot be used here: it implements the fetch
     * spec's forbidden-header-name list, so `new Headers({ Range: 'bytes=0-' })`
     * silently drops the one header these tests are about. A service worker reads
     * a real Range off a real request, so the fake has to allow it.
     */
    class FakeHeaders {
        constructor(init) {
            this._map = new Map();
            Object.keys(init || {}).forEach(k => this.set(k, init[k]));
        }
        set(name, value) { this._map.set(String(name).toLowerCase(), String(value)); }
        get(name) {
            const key = String(name).toLowerCase();
            return this._map.has(key) ? this._map.get(key) : null;
        }
        forEach(fn) { this._map.forEach((v, k) => fn(v, k)); }
    }

    class FakeResponse {
        constructor(body, init) {
            init = init || {};
            this._body = body === undefined ? null : body;
            this.status = init.status === undefined ? 200 : init.status;
            this.statusText = init.statusText || '';
            this.headers = init.headers instanceof FakeHeaders
                ? init.headers
                : new FakeHeaders(init.headers || {});
            this.type = init.type || 'basic';
            this.ok = this.status >= 200 && this.status < 300;
        }
        clone() {
            const copy = new FakeResponse(this._body, {
                status: this.status,
                statusText: this.statusText,
                type: this.type
            });
            this.headers.forEach((v, k) => copy.headers.set(k, v));
            return copy;
        }
        async arrayBuffer() {
            // An opaque response cannot be read. This is the property
            // rangeResponse() has to survive rather than assume away.
            if (this.type === 'opaque') throw new TypeError('opaque response');
            if (this._body instanceof ArrayBuffer) return this._body;
            if (this._body === null) return new ArrayBuffer(0);
            return new TextEncoder().encode(String(this._body)).buffer;
        }
        async text() {
            if (this._body instanceof ArrayBuffer) {
                return new TextDecoder().decode(this._body);
            }
            return this._body === null ? '' : String(this._body);
        }
    }

    function req(url, extra) {
        const init = extra || {};
        return {
            url: url,
            mode: init.mode || 'no-cors',
            destination: init.destination === undefined ? '' : init.destination,
            headers: new FakeHeaders(init.headers || {})
        };
    }

    /** A cache store keyed by request url, plus a log of what was asked of it. */
    function fakeCaches(seed) {
        const stores = { };
        const log = { matched: [], put: [], deleted: [], opened: [] };
        function store(name) {
            if (!stores[name]) stores[name] = {};
            return stores[name];
        }
        Object.keys(seed || {}).forEach(name => {
            Object.keys(seed[name]).forEach(url => { store(name)[url] = seed[name][url]; });
        });
        const api = {
            _stores: stores,
            _log: log,
            match: async (request) => {
                const url = typeof request === 'string' ? request : request.url;
                log.matched.push(url);
                const names = Object.keys(stores);
                for (let i = 0; i < names.length; i++) {
                    const hit = stores[names[i]][url];
                    if (hit) return hit;
                }
                return undefined;
            },
            open: async (name) => {
                log.opened.push(name);
                return {
                    put: async (request, response) => {
                        const url = typeof request === 'string' ? request : request.url;
                        log.put.push({ cache: name, url: url, status: response.status });
                        store(name)[url] = response;
                    },
                    match: async (request) => store(name)[typeof request === 'string' ? request : request.url],
                    delete: async (request) => {
                        const url = typeof request === 'string' ? request : request.url;
                        log.deleted.push({ cache: name, url: url });
                        const had = !!store(name)[url];
                        delete store(name)[url];
                        return had;
                    }
                };
            }
        };
        return api;
    }

    const quiet = { log: () => {}, warn: () => {}, error: () => {} };

    /** The named service-worker functions, wired to the fakes given. */
    function loadWorker(deps) {
        const names = ['isMediaRequest', 'isDocumentRequest', 'mediaFailure',
                       'rangeResponse', 'mediaStrategy', 'cacheFirstStrategy'];
        const src = names.map(n => fnSource(swSource, n)).join('\n');
        const factory = new Function(
            'caches', 'fetch', 'console', 'Response', 'Headers', 'URL', 'MEDIA_CACHE',
            src + '\n;return { ' + names.join(', ') + ' };');
        return factory(deps.caches, deps.fetch, quiet, FakeResponse, FakeHeaders, URL,
                       'english-portal-media-v1');
    }

    const MP3 = 'https://api.dictionaryapi.dev/media/pronunciations/en/bus-uk.mp3';

    function clipBody() {
        // 10 recognisable bytes, so a slice can be checked byte for byte.
        return new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]).buffer;
    }

    function clipResponse(init) {
        return new FakeResponse(clipBody(), Object.assign({
            status: 200,
            headers: { 'Content-Type': 'audio/mpeg' }
        }, init || {}));
    }

    // ---- the source-level invariants ---------------------------------------

    describe('the shape of the worker', () => {
        test('media is routed BEFORE the static-asset test and before the default', () => {
            const handler = swSource.slice(swSource.indexOf("self.addEventListener('fetch'"));
            const mediaAt = handler.indexOf('isMediaRequest(request, url)');
            const staticAt = handler.indexOf('isStaticAsset(url)');
            const defaultAt = handler.indexOf('cacheFirstStrategy(request, DYNAMIC_CACHE)');
            expect(mediaAt).toBeGreaterThan(-1);
            expect(mediaAt).toBeLessThan(staticAt);
            expect(mediaAt).toBeLessThan(defaultAt);
        });

        test('media has its own cache, and activate() does not delete it', () => {
            expect(swSource).toMatch(/const MEDIA_CACHE = 'english-portal-media-v1'/);
            const activate = swSource.slice(swSource.indexOf("addEventListener('activate'"),
                                            swSource.indexOf("addEventListener('fetch'"));
            expect(activate).toContain('cacheName !== MEDIA_CACHE');
        });

        test('STATIC_CACHE was bumped off v21, or a returning learner keeps the defect', () => {
            // index.html is network-first and app.js cache-first, so the new
            // markup would meet the old app.js. And the fix itself only ships
            // when the worker is replaced.
            expect(swSource).not.toContain("english-portal-static-v21'");
            expect(swSource).toMatch(/const STATIC_CACHE = 'english-portal-static-v(2[2-9]|[3-9]\d)'/);
        });

        test('an unplayable cached clip can be evicted by the surface that found it', () => {
            const handler = swSource.slice(swSource.indexOf("addEventListener('message'"));
            expect(handler).toContain("'media-failed'");
            expect(handler).toContain('MEDIA_CACHE');
            expect(handler).toContain('cache.delete(data.url)');
        });
    });

    describe('isMediaRequest', () => {
        const sw = loadWorker({ caches: fakeCaches(), fetch: async () => clipResponse() });

        test('trusts request.destination when the browser supplies one', () => {
            expect(sw.isMediaRequest(req('https://x/y', { destination: 'audio' }), new URL('https://x/y'))).toBe(true);
            expect(sw.isMediaRequest(req('https://x/y', { destination: 'video' }), new URL('https://x/y'))).toBe(true);
        });

        test('recognises an audio Accept header', () => {
            const r = req('https://x/y', { headers: { Accept: 'audio/webm,audio/ogg' } });
            expect(sw.isMediaRequest(r, new URL('https://x/y'))).toBe(true);
        });

        test('recognises audio by extension, which is the only test a bare fetch() passes', () => {
            expect(sw.isMediaRequest(req(MP3), new URL(MP3))).toBe(true);
            ['/a.ogg', '/a.wav', '/a.m4a', '/a.opus', '/a.webm', '/a.flac', '/a.aac']
                .forEach(p => expect(sw.isMediaRequest(req('https://x' + p), new URL('https://x' + p))).toBe(true));
        });

        test('does NOT claim the app shell, and does not claim a document', () => {
            ['/app.js', '/styles.css', '/icons/icon-16x16.png', '/index.html']
                .forEach(p => expect(sw.isMediaRequest(req('https://x' + p), new URL('https://x' + p))).toBe(false));
            const doc = req('https://x/', { mode: 'navigate', destination: 'document',
                                            headers: { Accept: 'text/html,*/*' } });
            expect(sw.isMediaRequest(doc, new URL('https://x/'))).toBe(false);
            expect(sw.isDocumentRequest(doc)).toBe(true);
        });
    });

    describe('⚠️ THE DEFECT: a failed request must not resolve to HTML', () => {
        const OFFLINE = new FakeResponse('<!DOCTYPE html><title>Offline</title>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });

        function withFailingNetwork() {
            const caches = fakeCaches({ 'english-portal-static-v22': { '/offline.html': OFFLINE } });
            const sw = loadWorker({
                caches: caches,
                fetch: async () => { throw new TypeError('Failed to fetch'); }
            });
            return { sw, caches };
        }

        test('a failed AUDIO request fails as audio: 504, no body, no HTML', async () => {
            const { sw, caches } = withFailingNetwork();
            const response = await sw.cacheFirstStrategy(
                req(MP3, { destination: 'audio' }), 'english-portal-dynamic-v3');

            // The assertion the defect fails: not an HTML page, and not 200.
            expect(response.status).toBe(504);
            expect(response.ok).toBe(false);
            expect(response.headers.get('content-type')).toBeFalsy();
            expect(await response.text()).toBe('');
            expect(response).not.toBe(OFFLINE);

            // And the branch: offline.html was never even looked up for a clip.
            expect(caches._log.matched).not.toContain('/offline.html');
        });

        test('mediaStrategy fails the same way, with nothing cached', async () => {
            const { sw, caches } = withFailingNetwork();
            const response = await sw.mediaStrategy(req(MP3, { destination: 'audio' }));
            expect(response.status).toBe(504);
            expect(await response.text()).toBe('');
            expect(caches._log.matched).not.toContain('/offline.html');
        });

        test('a NAVIGATION still gets the offline page — the fix is not a removal', async () => {
            const { sw } = withFailingNetwork();
            const response = await sw.cacheFirstStrategy(
                req('https://x/somewhere', {
                    mode: 'navigate',
                    destination: 'document',
                    headers: { Accept: 'text/html' }
                }), 'english-portal-dynamic-v3');
            expect(response).toBe(OFFLINE);
            expect(await response.text()).toContain('Offline');
        });

        test('a failed data request gets text/plain at 503, not a HTML page at 200', async () => {
            // The same defect with a different victim: JSON.parse() on an HTML
            // page throws a syntax error, so the caller reports corrupt data
            // rather than "you are offline".
            const { sw } = withFailingNetwork();
            const response = await sw.cacheFirstStrategy(
                req('https://x/data/thing.json', { headers: { Accept: 'application/json' } }),
                'english-portal-dynamic-v3');
            expect(response.status).toBe(503);
            expect(response.headers.get('content-type')).toBe('text/plain');
            expect(await response.text()).not.toContain('<!DOCTYPE html>');
        });
    });

    describe('Range and 206 are tolerated, and a fragment is never stored', () => {
        test('a 206 from the network is returned and NOT cached', async () => {
            const caches = fakeCaches();
            const partial = new FakeResponse(new Uint8Array([12, 13]).buffer, {
                status: 206,
                headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes 2-3/10' }
            });
            const sw = loadWorker({ caches: caches, fetch: async () => partial });

            const response = await sw.mediaStrategy(
                req(MP3, { destination: 'audio', headers: { Range: 'bytes=2-3' } }));

            expect(response.status).toBe(206);
            // THE POINT: half a clip must not be stored under the whole clip's
            // URL. Stored, it would be served later as a complete file — a
            // corrupt clip that survives going offline.
            expect(caches._log.put).toEqual([]);
        });

        test('a range request against a complete cached clip is answered with a real 206', async () => {
            const caches = fakeCaches({ 'english-portal-media-v1': { [MP3]: clipResponse() } });
            const sw = loadWorker({
                caches: caches,
                fetch: async () => { throw new Error('the network must not be needed here'); }
            });

            const response = await sw.mediaStrategy(
                req(MP3, { destination: 'audio', headers: { Range: 'bytes=2-4' } }));

            expect(response.status).toBe(206);
            expect(response.headers.get('content-range')).toBe('bytes 2-4/10');
            expect(response.headers.get('content-length')).toBe('3');
            expect(response.headers.get('accept-ranges')).toBe('bytes');
            expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([12, 13, 14]);
        });

        test('`bytes=0-` — what Chromium actually sends — gets the whole file as a 206', async () => {
            const caches = fakeCaches({ 'english-portal-media-v1': { [MP3]: clipResponse() } });
            const sw = loadWorker({ caches: caches, fetch: async () => { throw new Error('no'); } });
            const response = await sw.mediaStrategy(
                req(MP3, { destination: 'audio', headers: { Range: 'bytes=0-' } }));
            expect(response.status).toBe(206);
            expect(response.headers.get('content-range')).toBe('bytes 0-9/10');
        });

        test('a suffix range means the LAST n bytes, not the first', async () => {
            const caches = fakeCaches({ 'english-portal-media-v1': { [MP3]: clipResponse() } });
            const sw = loadWorker({ caches: caches, fetch: async () => { throw new Error('no'); } });
            const response = await sw.mediaStrategy(
                req(MP3, { destination: 'audio', headers: { Range: 'bytes=-3' } }));
            expect(response.headers.get('content-range')).toBe('bytes 7-9/10');
            expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([17, 18, 19]);
        });

        test('a range past the end is a 416 with a Content-Range, not a slice of nothing', async () => {
            const caches = fakeCaches({ 'english-portal-media-v1': { [MP3]: clipResponse() } });
            const sw = loadWorker({ caches: caches, fetch: async () => { throw new Error('no'); } });
            const response = await sw.mediaStrategy(
                req(MP3, { destination: 'audio', headers: { Range: 'bytes=50-60' } }));
            expect(response.status).toBe(416);
            expect(response.headers.get('content-range')).toBe('bytes */10');
        });

        test('an OPAQUE cached clip cannot be sliced, so the range goes to the network', async () => {
            const opaque = new FakeResponse(clipBody(), { status: 0, type: 'opaque' });
            const caches = fakeCaches({ 'english-portal-media-v1': { [MP3]: opaque } });
            let fetched = 0;
            const sw = loadWorker({
                caches: caches,
                fetch: async () => {
                    fetched++;
                    return new FakeResponse(new Uint8Array([12]).buffer, { status: 206 });
                }
            });
            const response = await sw.mediaStrategy(
                req(MP3, { destination: 'audio', headers: { Range: 'bytes=2-2' } }));
            expect(fetched).toBe(1);
            expect(response.status).toBe(206);
            expect(caches._log.put).toEqual([]);
        });
    });

    describe('offline replay (NFR-4, R-9)', () => {
        test('a complete clip is stored on first play and served from cache after', async () => {
            const caches = fakeCaches();
            let fetched = 0;
            const sw = loadWorker({
                caches: caches,
                fetch: async () => { fetched++; return clipResponse(); }
            });
            const first = await sw.mediaStrategy(req(MP3, { destination: 'audio' }));
            expect(first.status).toBe(200);
            expect(fetched).toBe(1);
            expect(caches._log.put).toEqual([
                { cache: 'english-portal-media-v1', url: MP3, status: 200 }
            ]);

            const second = await sw.mediaStrategy(req(MP3, { destination: 'audio' }));
            expect(second.status).toBe(200);
            expect(fetched).toBe(1);   // never went back to the network
        });

        test('an opaque clip is stored too — deliberately, and the reason is written down', async () => {
            const caches = fakeCaches();
            const sw = loadWorker({
                caches: caches,
                fetch: async () => new FakeResponse(clipBody(), { status: 0, type: 'opaque' })
            });
            await sw.mediaStrategy(req(MP3, { destination: 'audio' }));
            expect(caches._log.put).toHaveLength(1);
            expect(swSource).toContain('OPAQUE RESPONSES ARE CACHED, AND THAT IS A JUDGEMENT CALL');
        });

        test('offline with a cached clip replays it instead of failing', async () => {
            const caches = fakeCaches({ 'english-portal-media-v1': { [MP3]: clipResponse() } });
            const sw = loadWorker({
                caches: caches,
                fetch: async () => { throw new TypeError('Failed to fetch'); }
            });
            const response = await sw.mediaStrategy(req(MP3, { destination: 'audio' }));
            expect(response.status).toBe(200);
            expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toHaveLength(10);
        });

        test('a broken Cache API does not stop the clip being fetched', async () => {
            const broken = {
                match: async () => { throw new DOMException('nope'); },
                open: async () => { throw new DOMException('nope'); }
            };
            const sw = loadWorker({ caches: broken, fetch: async () => clipResponse() });
            const response = await sw.mediaStrategy(req(MP3, { destination: 'audio' }));
            expect(response.status).toBe(200);
        });
    });
});

/**
 * =============================================================================
 * US-408 — API audio for word models, and the precedence that keeps CON-6 true
 * =============================================================================
 *
 * `CON-6`: *"One optional API — api.dictionaryapi.dev, enhancement only · its
 * failure must never block an exercise or corrupt data."*
 *
 * Days before this was written the same API hung the vocabulary section for
 * eighteen seconds (`US-245` / `I-13`) because it was consulted FIRST for a word
 * already authored in data.js. The tests below are the audio-shaped version of
 * that regression suite, and the third case is the one that caused it: the API
 * ABSENT, the API ERRORING, and the API HANGING FOREVER. A pending fetch is as
 * bad as a failed one, and the property being proved is that a pending one is
 * INVISIBLE — there is no control for it to own.
 *
 * The block between the BEGIN/END markers depends on `global.fetch`,
 * `global.navigator`, `global.Audio`, `global.URL` and `global.setTimeout` and on
 * nothing in app.js, so it is extracted and run.
 */
describe('WordAudio — a recording of a person, when there is one (US-408 / CON-6)', () => {
    const fs = require('fs');
    const path = require('path');
    const ROOT = path.join(__dirname, '..', '..');
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

    const BEGIN = '// ===== BEGIN WORD AUDIO (US-408) =====';
    const END = '// ===== END WORD AUDIO (US-408) =====';

    function block() {
        const from = appSource.indexOf(BEGIN);
        const to = appSource.indexOf(END);
        expect(from).toBeGreaterThan(-1);
        expect(to).toBeGreaterThan(from);
        return appSource.slice(from + BEGIN.length, to);
    }

    /** One top-level function's source, by brace matching. */
    function fnSource(name) {
        const start = appSource.indexOf('function ' + name + '(');
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces in ' + name);
    }

    const MP3 = 'https://api.dictionaryapi.dev/media/pronunciations/en/happy-uk.mp3';

    /** One entry in the shape api.dictionaryapi.dev actually returns. */
    function entry(word, audioUrls, extra) {
        return Object.assign({
            word: word,
            phonetics: (audioUrls || []).map(url => ({ text: '/ˈhæpi/', audio: url })),
            meanings: [{ definitions: [{ definition: 'x' }] }]
        }, extra || {});
    }

    let win;
    let WordAudio;
    let fetchCalls;
    let fetchImpl;
    let audioLog;

    function makeWindow(options) {
        const opts = options || {};
        fetchCalls = [];
        audioLog = [];
        const w = {
            URL: URL,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            navigator: {
                onLine: opts.onLine === undefined ? true : opts.onLine,
                serviceWorker: opts.serviceWorker
            },
            AbortSignal: { timeout: (ms) => ({ _ms: ms }) },
            AppErrorHandler: { logError: () => {} }
        };
        w.Audio = function (url) {
            const element = {
                src: url,
                onerror: null,
                play: () => (opts.playRejects
                    ? Promise.reject(new DOMException('NotAllowedError'))
                    : Promise.resolve())
            };
            audioLog.push(element);
            if (opts.audioThrows) throw new Error('no media element');
            return element;
        };
        if (opts.noFetch) {
            w.fetch = undefined;
        } else {
            w.fetch = (url, init) => {
                fetchCalls.push({ url: url, init: init });
                return fetchImpl(url, init);
            };
        }
        return w;
    }

    function load(options) {
        win = makeWindow(options);
        WordAudio = new Function('window', block() + '\n;return window.WordAudio;')(win);
        return WordAudio;
    }

    /** Drain the microtask queue that lookup()'s .then chain runs on. */
    async function flush() {
        for (let i = 0; i < 12; i++) await Promise.resolve();
    }

    function jsonResponse(body) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    }

    beforeEach(() => {
        fetchImpl = () => jsonResponse([entry('happy', [MP3])]);
        load();
    });

    // -----------------------------------------------------------------------
    describe('ONE origin, enforced in code and not only in the CSP (CON-6)', () => {
        test('a clip on the one allowed API origin is accepted', () => {
            expect(WordAudio.apiAudioUrl(MP3)).toBe(MP3);
        });

        test('⚠️ a clip on ANY other host is refused, gstatic included', () => {
            // dictionaryapi.dev really does return these. Allowing them would make
            // "one optional API" false for the sake of one word's recording.
            [
                'https://ssl.gstatic.com/dictionary/static/sounds/20200429/happy--_gb_1.mp3',
                '//ssl.gstatic.com/dictionary/static/sounds/20200429/happy--_gb_1.mp3',
                'https://lex-audio.useremarkable.com/mp3/happy_us_1.mp3',
                // The look-alike: a suffix match or an `includes()` test would
                // pass this one.
                'https://api.dictionaryapi.dev.evil.example/happy.mp3',
                'https://evil.example/?x=https://api.dictionaryapi.dev/happy.mp3'
            ].forEach(url => expect(WordAudio.apiAudioUrl(url)).toBe(''));
        });

        test('http is a different origin from https, and is refused', () => {
            expect(WordAudio.apiAudioUrl('http://api.dictionaryapi.dev/media/x.mp3')).toBe('');
        });

        test('a relative path is refused rather than resolved against our own origin', () => {
            // `new URL(x)` with no base is deliberate: a bare path here would
            // otherwise become a same-origin URL and look local and trustworthy.
            ['/media/x.mp3', 'media/x.mp3', '', '   ', null, undefined, 42, {}]
                .forEach(v => expect(WordAudio.apiAudioUrl(v)).toBe(''));
        });

        test('clipFromEntries skips the refused clips and takes the first allowed one', () => {
            const clip = WordAudio.clipFromEntries([entry('happy', [
                '',
                '//ssl.gstatic.com/dictionary/static/sounds/happy.mp3',
                MP3
            ])]);
            expect(clip.url).toBe(MP3);
            expect(clip.word).toBe('happy');
        });

        test('an entry whose only clips are off-origin yields no clip at all', () => {
            const clip = WordAudio.clipFromEntries([
                entry('happy', ['https://ssl.gstatic.com/x.mp3'])
            ]);
            expect(clip).toBeNull();
            expect(WordAudio.clipFromEntries([])).toBeNull();
            expect(WordAudio.clipFromEntries(null)).toBeNull();
            expect(WordAudio.clipFromEntries([{ }])).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    describe('FR-CNT-5 — the clip is credited, and the credit never guesses', () => {
        test('licence name and source URL both appear', () => {
            const text = WordAudio.creditFor(
                { license: { name: 'CC BY-SA 3.0' }, sourceUrls: ['https://en.wiktionary.org/wiki/happy'] },
                null);
            expect(text).toContain('CC BY-SA 3.0');
            expect(text).toContain('https://en.wiktionary.org/wiki/happy');
        });

        test("the clip's own licence wins over the entry's", () => {
            const text = WordAudio.creditFor(
                { license: { name: 'CC BY-SA 3.0' }, sourceUrls: ['https://entry.example'] },
                { license: { name: 'BY-SA 4.0' }, sourceUrl: 'https://clip.example' });
            expect(text).toContain('BY-SA 4.0');
            expect(text).toContain('https://clip.example');
            expect(text).not.toContain('CC BY-SA 3.0');
        });

        test('⚠️ with no licence stated, it says so rather than inventing one', () => {
            const text = WordAudio.creditFor({}, {});
            expect(text).toContain('api.dictionaryapi.dev');
            expect(text).toContain('licence was not stated');
            expect(text).not.toMatch(/CC BY|BY-SA|public domain/i);
        });

        test('a real lookup carries the credit through to the clip', async () => {
            fetchImpl = () => jsonResponse([entry('happy', [MP3], {
                license: { name: 'CC BY-SA 3.0' },
                sourceUrls: ['https://en.wiktionary.org/wiki/happy']
            })]);
            WordAudio.lookup('happy', () => {});
            await flush();
            expect(WordAudio.known('happy').credit).toContain('CC BY-SA 3.0');
        });
    });

    // -----------------------------------------------------------------------
    describe('the API ABSENT', () => {
        test('no fetch at all in this browser: no throw, no clip, TTS still speaks', () => {
            load({ noFetch: true });
            expect(WordAudio.lookup('happy', () => { throw new Error('must not be called'); }))
                .toBeUndefined();
            expect(WordAudio.known('happy')).toBeNull();

            let spoken = 0;
            expect(WordAudio.playModel('happy', () => { spoken++; })).toBe('tts');
            expect(spoken).toBe(1);
        });

        test('offline: navigator.onLine === false means the request is never made', async () => {
            load({ onLine: false });
            WordAudio.lookup('happy', () => {});
            await flush();
            expect(fetchCalls).toEqual([]);
            expect(WordAudio.known('happy')).toBeNull();
        });

        test('a word with no recording is asked about ONCE, then remembered', async () => {
            fetchImpl = () => Promise.resolve({ ok: false, status: 404 });
            WordAudio.lookup('happy', () => {});
            await flush();
            expect(WordAudio.known('happy')).toBeNull();
            WordAudio.lookup('happy', () => {});
            WordAudio.lookup('HAPPY', () => {});
            await flush();
            expect(fetchCalls).toHaveLength(1);
        });

        test('there is a ceiling on lookups per page load', async () => {
            expect(WordAudio.MAX_LOOKUPS).toBeGreaterThan(0);
            fetchImpl = () => Promise.resolve({ ok: false, status: 404 });
            for (let i = 0; i < WordAudio.MAX_LOOKUPS + 10; i++) {
                WordAudio.lookup('word' + i, () => {});
                await flush();
            }
            expect(fetchCalls).toHaveLength(WordAudio.MAX_LOOKUPS);
        });
    });

    // -----------------------------------------------------------------------
    describe('the API ERRORING', () => {
        test('a rejected fetch is a missing recording, not an exception', async () => {
            fetchImpl = () => Promise.reject(new TypeError('Failed to fetch'));
            let called = 0;
            expect(WordAudio.lookup('happy', () => { called++; })).toBeUndefined();
            await flush();
            expect(called).toBe(0);
            expect(WordAudio.known('happy')).toBeNull();
            let spoken = 0;
            expect(WordAudio.playModel('happy', () => { spoken++; })).toBe('tts');
            expect(spoken).toBe(1);
        });

        test('a fetch that throws synchronously is survived too', () => {
            fetchImpl = () => { throw new Error('blocked by CSP'); };
            expect(() => WordAudio.lookup('happy', () => {})).not.toThrow();
            expect(WordAudio.known('happy')).toBeNull();
        });

        test('a non-promise return value from fetch is survived', () => {
            fetchImpl = () => undefined;
            expect(() => WordAudio.lookup('happy', () => {})).not.toThrow();
        });

        test('malformed JSON is a missing recording', async () => {
            fetchImpl = () => Promise.resolve({
                ok: true, status: 200, json: () => Promise.reject(new SyntaxError('<!DOCTYPE html>'))
            });
            WordAudio.lookup('happy', () => {});
            await flush();
            expect(WordAudio.known('happy')).toBeNull();
        });

        test('⚠️ HTML where JSON was expected — the old offline.html fallback — is survived', async () => {
            // Before the service-worker fix, a failed lookup resolved to
            // offline.html AT STATUS 200. This is what that looked like here.
            fetchImpl = () => jsonResponse('<!DOCTYPE html><title>Offline</title>');
            WordAudio.lookup('happy', () => {});
            await flush();
            expect(WordAudio.known('happy')).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    describe('⚠️ the API HANGING — the case that caused US-245', () => {
        beforeEach(() => { jest.useFakeTimers(); });
        afterEach(() => { jest.useRealTimers(); });

        test('a fetch that never settles never calls back, and cannot be awaited', async () => {
            load();
            fetchImpl = () => new Promise(() => {});   // forever
            const result = WordAudio.lookup('happy', () => { throw new Error('must not fire'); });

            // The strongest guarantee available: there is no promise to await, so
            // no caller can accidentally make this blocking.
            expect(result).toBeUndefined();

            jest.advanceTimersByTime(WordAudio.LOOKUP_TIMEOUT_MS * 3);
            await flush();
            expect(WordAudio.known('happy')).toBeNull();

            // And the model still plays, at once, with the fetch still pending.
            let spoken = 0;
            expect(WordAudio.playModel('happy', () => { spoken++; })).toBe('tts');
            expect(spoken).toBe(1);
        });

        test('the deadline does not depend on AbortSignal.timeout existing', async () => {
            load();
            win.AbortSignal = undefined;      // older Safari
            fetchImpl = () => new Promise(() => {});
            expect(() => WordAudio.lookup('happy', () => {})).not.toThrow();
            jest.advanceTimersByTime(WordAudio.LOOKUP_TIMEOUT_MS + 1);
            await flush();
            // Not memoised as a miss: a hang is "we still do not know", and a
            // later visit is allowed to ask again.
            fetchImpl = () => jsonResponse([entry('happy', [MP3])]);
            WordAudio.lookup('happy', () => {});
            await flush();
            expect(WordAudio.known('happy').url).toBe(MP3);
        });

        test('an answer that arrives AFTER the deadline is discarded, not shown late', async () => {
            load();
            let settle;
            fetchImpl = () => new Promise(resolve => { settle = resolve; });
            let called = 0;
            WordAudio.lookup('happy', () => { called++; });

            jest.advanceTimersByTime(WordAudio.LOOKUP_TIMEOUT_MS + 1);
            await flush();
            expect(called).toBe(0);

            // The slow answer finally arrives. The screen must not rearrange
            // itself under a learner who has moved on.
            settle({ ok: true, status: 200, json: () => Promise.resolve([entry('happy', [MP3])]) });
            await flush();
            expect(called).toBe(0);
        });

        test('a slow lookup is bounded by a timeout well under US-245\'s 18 seconds', () => {
            expect(WordAudio.LOOKUP_TIMEOUT_MS).toBeLessThanOrEqual(4000);
        });
    });

    // -----------------------------------------------------------------------
    describe('precedence: whichever model is ALREADY in hand, preferring the clip', () => {
        test('with a clip in hand the recording plays and TTS does not', async () => {
            WordAudio.lookup('happy', () => {});
            await flush();
            let spoken = 0;
            expect(WordAudio.playModel('happy', () => { spoken++; })).toBe('clip');
            expect(spoken).toBe(0);
            expect(audioLog).toHaveLength(1);
            expect(audioLog[0].src).toBe(MP3);
        });

        test('with nothing in hand the synthesiser plays IMMEDIATELY and nothing is fetched', () => {
            let spoken = 0;
            expect(WordAudio.playModel('happy', () => { spoken++; })).toBe('tts');
            expect(spoken).toBe(1);
            // The press must never be the thing that starts a network request.
            expect(fetchCalls).toEqual([]);
        });

        test('playModel never touches the network on any path', () => {
            const src = block();
            const playModel = src.slice(src.indexOf('function playModel('));
            expect(playModel).not.toContain('fetch(');
            expect(playModel).not.toContain('lookup(');
            expect(playModel).not.toContain('await');
        });

        test('a clip that will not play falls back to TTS inside the same press', async () => {
            load({ playRejects: true });
            WordAudio.lookup('happy', () => {});
            await flush();
            let spoken = 0;
            WordAudio.playModel('happy', () => { spoken++; });
            await flush();
            expect(spoken).toBe(1);
        });

        test('an Audio constructor that throws falls back to TTS', async () => {
            load({ audioThrows: true });
            WordAudio.lookup('happy', () => {});
            await flush();
            let spoken = 0;
            WordAudio.playModel('happy', () => { spoken++; });
            expect(spoken).toBe(1);
        });

        test('an <audio> error event falls back to TTS', async () => {
            WordAudio.lookup('happy', () => {});
            await flush();
            let spoken = 0;
            WordAudio.playModel('happy', () => { spoken++; });
            expect(audioLog).toHaveLength(1);
            audioLog[0].onerror(new Event('error'));
            expect(spoken).toBe(1);
        });
    });

    // -----------------------------------------------------------------------
    describe('an unplayable cached clip is evicted by the surface that found it', () => {
        test('the service worker is told to drop it, and it is not offered again', async () => {
            const posted = [];
            load({
                playRejects: true,
                serviceWorker: { controller: { postMessage: (m) => posted.push(m) } }
            });
            WordAudio.lookup('happy', () => {});
            await flush();
            expect(WordAudio.known('happy')).toBeTruthy();

            WordAudio.playModel('happy', () => {});
            await flush();

            expect(posted).toEqual([{ type: 'media-failed', url: MP3 }]);
            // And this session stops offering it, so one silent press is the
            // whole cost of a pinned failure.
            expect(WordAudio.known('happy')).toBeNull();
        });

        test('no service worker controller is not an error', async () => {
            load({ playRejects: true, serviceWorker: undefined });
            WordAudio.lookup('happy', () => {});
            await flush();
            expect(() => WordAudio.playModel('happy', () => {})).not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    describe('the enrichment is free for a word the app already fetched', () => {
        test('offer() takes the clip out of a response fetchWordData already paid for', () => {
            WordAudio.offer(entry('Happy', [MP3]));
            expect(WordAudio.known('happy').url).toBe(MP3);
            expect(fetchCalls).toEqual([]);
        });

        test('parseAPIResponse hands the entry over, so the JSON is not fetched twice', () => {
            const parse = fnSource('parseAPIResponse');
            expect(parse).toContain('WordAudio.offer(apiData)');
            // And it is guarded, because app.js has no import graph: a build that
            // has not loaded this block must not break vocabulary.
            expect(parse).toMatch(/if \(window\.WordAudio\) WordAudio\.offer/);
        });

        test('offer() survives nonsense without storing anything', () => {
            expect(() => WordAudio.offer(null)).not.toThrow();
            expect(() => WordAudio.offer({})).not.toThrow();
            expect(() => WordAudio.offer({ word: 'x' })).not.toThrow();
            expect(WordAudio.known('x')).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    describe('the block reaches for nothing in app.js', () => {
        test('it extracts and runs with only browser globals supplied', () => {
            // The same guarantee as RecordingArchive's: this is what makes the
            // suite able to run it at all, and it is easy to break by accident.
            expect(() => load()).not.toThrow();
            expect(typeof WordAudio.playModel).toBe('function');
        });

        test('it does not name state, vocabularyData, Toast or speechAPI', () => {
            const src = block();
            ['state.', 'vocabularyData', 'Toast.', 'speechAPI.', 'CONFIG.']
                .forEach(name => expect(src).not.toContain(name));
        });
    });
});

/**
 * =============================================================================
 * US-408 — the vocabulary card's native-audio control, walked in jsdom
 * =============================================================================
 *
 * The module above is honest in isolation; this is where CON-6 is actually kept
 * or broken, because this is where a control exists. The property under test is
 * the one `US-245` cost eighteen seconds to learn: THERE IS NO STATE IN WHICH A
 * CONTROL IS WAITING FOR api.dictionaryapi.dev. Not "waits briefly" — does not
 * exist until there is nothing left to wait for.
 */
describe('the vocabulary card and its native-audio control (US-408 / CON-6)', () => {
    const fs = require('fs');
    const path = require('path');
    const ROOT = path.join(__dirname, '..', '..');
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    function fnSource(name) {
        const start = appSource.indexOf('function ' + name + '(');
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces in ' + name);
    }

    const MP3 = 'https://api.dictionaryapi.dev/media/pronunciations/en/happy-uk.mp3';
    const CLIP = { word: 'happy', url: MP3, ipa: '/ˈhæpi/', credit: 'Recording from api.dictionaryapi.dev, licensed CC BY-SA 3.0. Source: https://en.wiktionary.org/wiki/happy.' };

    let card;
    let fakeAudio;
    let spoken;
    let toasts;
    let lookupCalls;
    let onReady;

    function build(options) {
        const opts = options || {};
        document.body.innerHTML = `
            <div class="word-card">
                <h3 id="currentWord">${opts.showing === undefined ? 'Happy' : opts.showing}</h3>
                <p id="definition"></p>
                <button id="speakWord">Pronounce</button>
                <button id="wordAudioNative" hidden>A person saying it</button>
                <p id="wordAudioCredit" hidden></p>
            </div>`;
        spoken = [];
        toasts = [];
        lookupCalls = [];
        onReady = null;
        fakeAudio = { played: [], failNext: !!opts.playFails };

        const WordAudio = {
            known: (word) => (opts.knownClips || {})[String(word).toLowerCase()] || null,
            lookup: (word, ready) => {
                lookupCalls.push(word);
                onReady = ready;      // the test decides when, or never
                return undefined;
            },
            playClip: (clip, onFailure) => {
                if (fakeAudio.failNext) {
                    onFailure();
                    return true;
                }
                fakeAudio.played.push(clip.url);
                return true;
            }
        };
        const win = { WordAudio: WordAudio };
        const factory = new Function(
            'document', 'window', 'WordAudio', 'speechAPI', 'Toast',
            fnSource('setWordAudioControl') + '\n' + fnSource('prefetchWordAudio') +
            '\n;return { setWordAudioControl: setWordAudioControl, prefetchWordAudio: prefetchWordAudio };');
        card = factory(document, win, WordAudio,
                       { speak: (text) => spoken.push(text) },
                       { info: (m) => toasts.push(m) });
        return card;
    }

    const button = () => document.getElementById('wordAudioNative');
    const credit = () => document.getElementById('wordAudioCredit');

    describe('the markup it draws into', () => {
        test('index.html ships the control hidden, not disabled', () => {
            // Hidden-and-absent is the guarantee. Shown-and-disabled would be a
            // control the network owns, which is what CON-6 forbids.
            expect(indexSource).toMatch(/id="wordAudioNative"[^>]*hidden/);
            expect(indexSource).toMatch(/id="wordAudioCredit"[^>]*hidden/);
            expect(indexSource).not.toMatch(/id="wordAudioNative"[^>]*disabled/);
        });

        test('the always-available TTS control is untouched', () => {
            expect(indexSource).toContain('id="speakWord"');
            expect(fnSource('initializeVocabularyButtons'))
                .toContain("document.getElementById('speakWord').onclick");
        });
    });

    describe('with no clip', () => {
        test('the control stays hidden and empty', () => {
            build();
            card.setWordAudioControl(null);
            expect(button().hidden).toBe(true);
            expect(credit().hidden).toBe(true);
            expect(credit().textContent).toBe('');
            expect(button().onclick).toBeNull();
        });
    });

    describe('with a clip in hand', () => {
        test('the control appears, is NOT disabled, and is credited (FR-CNT-5)', () => {
            build();
            card.setWordAudioControl(CLIP);
            expect(button().hidden).toBe(false);
            expect(button().disabled).toBe(false);
            expect(credit().hidden).toBe(false);
            expect(credit().textContent).toContain('CC BY-SA 3.0');
            expect(credit().textContent).toContain('https://en.wiktionary.org/wiki/happy');
        });

        test('pressing it plays the recording and does not speak', () => {
            build();
            card.setWordAudioControl(CLIP);
            button().click();
            expect(fakeAudio.played).toEqual([MP3]);
            expect(spoken).toEqual([]);
        });

        test('a clip that fails AT THE PRESS speaks the word, says so once, and goes away', () => {
            build({ playFails: true });
            card.setWordAudioControl(CLIP);
            button().click();
            expect(spoken).toEqual(['happy']);
            // Not a dead button: the control is removed rather than left there
            // failing every time it is pressed.
            expect(button().hidden).toBe(true);
            expect(credit().hidden).toBe(true);
            expect(toasts).toHaveLength(1);
            expect(toasts[0]).toContain('phone');
        });

        test('the credit is rendered as text, never as markup', () => {
            build();
            card.setWordAudioControl({
                word: 'happy', url: MP3,
                credit: '<img src=x onerror=alert(1)> licensed CC BY-SA'
            });
            expect(credit().querySelector('img')).toBeNull();
            expect(credit().textContent).toContain('<img');
        });
    });

    describe('⚠️ the staleness guard', () => {
        test("a clip arriving for the previous word is NOT attached to this one", () => {
            // A human voice saying the wrong word is more convincing, and
            // therefore worse, than a wrong TTS read.
            build({ showing: 'Happy' });
            card.prefetchWordAudio('happy');
            expect(lookupCalls).toEqual(['happy']);

            // The learner presses Next while the lookup is in flight.
            document.getElementById('currentWord').textContent = 'Sad';
            onReady('happy', CLIP);

            expect(button().hidden).toBe(true);
            expect(credit().textContent).toBe('');
        });

        test('a clip arriving for the word still on screen IS attached', () => {
            build({ showing: 'Happy' });
            card.prefetchWordAudio('happy');
            onReady('happy', CLIP);
            expect(button().hidden).toBe(false);
        });

        test('the comparison is case-insensitive, because the card shows title case', () => {
            build({ showing: 'HAPPY' });
            card.prefetchWordAudio('Happy');
            onReady('happy', CLIP);
            expect(button().hidden).toBe(false);
        });
    });

    describe('⚠️ a pending lookup leaves nothing spinning', () => {
        test('while the lookup never resolves, the card is complete and the control absent', () => {
            build();
            card.prefetchWordAudio('happy');
            // onReady is never called. This is the eighteen-second case.
            expect(button().hidden).toBe(true);
            expect(button().disabled).toBe(false);   // never shown-and-disabled
            expect(document.querySelector('.word-card').textContent).toContain('Happy');
        });

        test('an in-hand clip is used with no lookup at all', () => {
            build({ knownClips: { happy: CLIP } });
            card.prefetchWordAudio('happy');
            expect(lookupCalls).toEqual([]);
            expect(button().hidden).toBe(false);
        });

        test('a build with no WordAudio at all still renders the card', () => {
            build();
            const factory = new Function('document', 'window',
                fnSource('prefetchWordAudio') + '\n;return prefetchWordAudio;');
            const prefetch = factory(document, {});
            expect(() => prefetch('happy')).not.toThrow();
            expect(button().hidden).toBe(true);
        });
    });

    describe('where the loader calls it, which is the whole of CON-6 here', () => {
        const loader = fnSource('loadVocabularyWord');

        test('the clip is asked for AFTER the quiz is drawn and answerable', () => {
            const quizAt = loader.indexOf('displayVocabQuiz(wordData.quiz)');
            const prefetchAt = loader.indexOf('prefetchWordAudio(wordData.word)');
            expect(quizAt).toBeGreaterThan(-1);
            expect(prefetchAt).toBeGreaterThan(quizAt);
        });

        test('nothing in the loader awaits the clip', () => {
            expect(loader).not.toMatch(/await\s+prefetchWordAudio/);
            expect(loader).not.toMatch(/await\s+WordAudio/);
            // And the only thing actually awaited is the one call that always was.
            const awaited = (loader.match(/await\s+[A-Za-z_$][\w$]*\(/g) || []);
            expect(awaited).toEqual(['await fetchWordData(']);
        });

        test('the previous word\'s control is cleared BEFORE that await', () => {
            const clearAt = loader.indexOf('setWordAudioControl(null)');
            const awaitAt = loader.indexOf('await fetchWordData');
            expect(clearAt).toBeGreaterThan(-1);
            expect(clearAt).toBeLessThan(awaitAt);
        });

        test('the review card owns the control too, since it reuses the word card', () => {
            const review = fnSource('renderVocabReviewCard');
            expect(review).toContain('setWordAudioControl(');
            // A review must not start a lookup: the learner is mid-answer.
            expect(review).not.toContain('prefetchWordAudio');
        });
    });

    describe('the CSP change is deliberate and bounded (CON-6)', () => {
        const csp = (indexSource.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([\s\S]*?)"/) || [])[1] || '';

        test('media-src is declared at all, which it was not', () => {
            expect(csp).toMatch(/media-src[^;]*;/);
        });

        test('blob: is allowed — the already-shipped recording playback needs it', () => {
            // RecordingArchive (US-136), the A->B->A comparison (US-404) and the
            // free-production card (US-601) all play a learner's own recording
            // from a blob: URL, and 'self' does not match a blob: URL.
            expect(csp).toMatch(/media-src[^;]*blob:/);
            expect(appSource).toContain('URL.createObjectURL');
        });

        test('exactly ONE remote origin is allowed for media, and it is the API', () => {
            const media = csp.match(/media-src([^;]*)/)[1];
            const remote = media.match(/https?:\/\/[^\s;]+/g) || [];
            expect(remote).toEqual(['https://api.dictionaryapi.dev']);
        });

        test('no new origin is introduced: connect-src already named it', () => {
            const origins = new Set((csp.match(/https?:\/\/[^\s;]+/g) || []));
            // fonts.googleapis.com / fonts.gstatic.com were already there; the
            // interesting assertion is that the media hosts dictionaryapi.dev
            // ALSO returns clips from are not.
            expect(origins.has('https://api.dictionaryapi.dev')).toBe(true);
            expect(origins.has('https://ssl.gstatic.com')).toBe(false);
        });

        test('media routing did not quietly take over content wiring', () => {
            // WHAT THIS REPLACED, because the change is worth recording. The
            // original assertion here was
            //     expect(appSource).not.toContain('data/pronunciation/connected-speech.js')
            // under the name "the service worker precaches the same set it always
            // did" — which asserted on app.js rather than on the service worker, so
            // its name described neither its subject nor its claim. It was a
            // BOUNDARY GUARD an agent wrote around its own edit scope ("the content
            // files are somebody else's to wire"), not a property of the app. Once
            // that file was wired — which was always the plan — the guard failed on
            // a COMMENT naming the file, which is the giveaway: a durable test does
            // not care what the prose says.
            //
            // What is worth asserting is the property that made the wiring safe:
            // pronContentList() gathers from EVERY source that declares the array,
            // so a fourth content file needs no edit here. Naming one global was how
            // 15 authored items sat loaded-but-unreachable, and unreachable WITHOUT
            // a warning, because pronNoticingItems() only warns about items it
            // dropped and these were never loaded to be dropped.
            const gather = appSource.slice(appSource.indexOf('function pronContentList('));
            const body = gather.slice(0, gather.indexOf('\n}') + 2);
            expect(body).toContain('PRONUNCIATION_VOWELS_STRESS');
            expect(body).toContain('PRONUNCIATION_CONNECTED_SPEECH');
            // Gathered, not returned from the first match — the bug being prevented.
            expect(body).toMatch(/sources\.forEach|out\.push/);
            // And the precache/index.html invariant is assets.test.js's job, which
            // checks it in both directions. This test does not duplicate it.
        });
    });
});

// ===========================================================================
// US-406 — the duration hint (FR-PRN-7 / FR-PRN-5 / BR-3)
// ===========================================================================
//
// TWO KINDS OF TEST, because the feature has two halves and they fail differently.
//
//   1. THE MODULE. `DurationHint` is between BEGIN/END markers and depends on
//      `global.AudioContext` and nothing in app.js, so it is extracted and RUN.
//      The thresholds and the envelope analysis are the two things here that must
//      be proved rather than read: a threshold that drifts turns noise into a
//      finding, and an envelope that measures press-to-press instead of the voiced
//      span makes the whole comparison a lie.
//   2. THE SURFACE. appendDurationHint() and its helpers are run too, against a
//      fake microphone, a fake decoder, a fake voice and the REAL authored pairs —
//      so the assertions below are the sentences a learner actually reads, not a
//      paraphrase of them. The fake RecordingArchive has exactly three methods
//      (recorderMissing / startCapture / stopCapture) plus a save() that fails the
//      test if it is ever called, which is how "nothing is stored" is proved: any
//      other call would be a TypeError.
//
// What these tests CANNOT prove is the acoustics. They prove that a 600ms voiced
// span against a 400ms model is reported as +50% and described as consistent with
// an added vowel; they cannot prove that a Telugu-L1 learner saying "bus-u" on a
// real phone actually produces 600ms, nor that a device's TTS times honestly. That
// is AS-3 territory and remains unverified.

describe('DurationHint — the module (US-406 / FR-PRN-7)', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const BEGIN = '// ===== BEGIN DURATION HINT (US-406) =====';
    const END = '// ===== END DURATION HINT (US-406) =====';

    function block() {
        const from = appSource.indexOf(BEGIN);
        const to = appSource.indexOf(END);
        expect(from).toBeGreaterThan(-1);
        expect(to).toBeGreaterThan(from);
        return appSource.slice(from + BEGIN.length, to);
    }

    /** ±level alternating, so the RMS of any whole number of frames is `level`. */
    function samples(parts, rate) {
        const sr = rate || 16000;
        const counts = parts.map(p => Math.round((p.ms * sr) / 1000));
        const out = new Float32Array(counts.reduce((a, b) => a + b, 0));
        let at = 0;
        parts.forEach((p, i) => {
            for (let j = 0; j < counts[i]; j++) out[at + j] = p.level * (j % 2 ? 1 : -1);
            at += counts[i];
        });
        return out;
    }

    let DH;
    beforeEach(() => {
        DH = new Function('window', block() + '\n;return window.DurationHint;')({});
    });

    describe('it extracts and runs with no app.js around it', () => {
        test('a window with nothing on it is enough to load the module', () => {
            expect(typeof DH.verdict).toBe('function');
            expect(typeof DH.analyse).toBe('function');
        });

        test('with no AudioContext it says so instead of throwing', () => {
            expect(DH.decoderMissing()).toBe(true);
            return DH.measure({ byteLength: 10 }).then(r => {
                expect(r.ok).toBe(false);
                expect(r.code).toBe('no-decoder');
            });
        });
    });

    describe('the threshold, and that it scales with syllables', () => {
        test('one syllable: +15% is noise, +40% is evidence', () => {
            expect(DH.NOISE_EXCESS).toBe(0.15);
            expect(DH.EVIDENCE_EXCESS).toBe(0.40);
            expect(DH.thresholds(1)).toEqual({ evidence: 1.4, noise: 1.15, syllables: 1 });
        });

        test('two syllables or more: the app declines rather than guesses', () => {
            // +40%/2 = +20%, which is not far enough above the +15% noise floor to
            // be told apart from speaking carefully. The rule producing the
            // refusal is the SAME rule, not a special case bolted on.
            expect(DH.thresholds(2)).toBeNull();
            expect(DH.thresholds(3)).toBeNull();
            expect(DH.thresholds(9)).toBeNull();
        });

        test('a nonsense syllable count is treated as one, never as zero', () => {
            // Dividing by zero would produce Infinity and a bar nothing can clear.
            expect(DH.thresholds(0)).toEqual({ evidence: 1.4, noise: 1.15, syllables: 1 });
            expect(DH.thresholds(NaN).syllables).toBe(1);
        });
    });

    describe('scope comes from the authored IPA, never from spelling', () => {
        test('a diphthong is one syllable, not two vowels', () => {
            expect(DH.syllableCount('/kəʊt/')).toBe(1);
            expect(DH.syllableCount('/ʃiːp/')).toBe(1);
            expect(DH.syllableCount('/ˈkʌmftəbl/')).toBe(2);
        });

        test('/tʃ/ and /dʒ/ are one segment, so *watch* is not a cluster', () => {
            expect(DH.finalConsonants('/wɒtʃ/')).toBe(1);
            // *asked* is /ɑːskt/ — three consonants after the vowel, which is why
            // REQUIREMENTS.md §3.1 lists it as the T-P3 example it does.
            expect(DH.finalConsonants('/ɑːskt/')).toBe(3);
            expect(DH.finalConsonants('/teksts/')).toBe(4);
        });

        test('a word ending in a vowel is out of scope entirely', () => {
            // There is no final consonant for an epenthetic vowel to follow, so
            // *zoo* is not a T-P2 word and the hint is not offered on it.
            expect(DH.finalConsonants('/zuː/')).toBe(0);
            expect(DH.riskFor('zoo', '/zuː/')).toBeNull();
        });

        test('one final consonant is T-P2, two or more is T-P3', () => {
            expect(DH.riskFor('bus', '/bʌs/')).toMatchObject({ code: 'T-P2', syllables: 1, cluster: 1 });
            expect(DH.riskFor('asked', '/ɑːskt/')).toMatchObject({ code: 'T-P3', cluster: 3 });
            expect(DH.riskFor('films', '/fɪlmz/')).toMatchObject({ code: 'T-P3', cluster: 3 });
        });

        test('no IPA means no scope decision, so no hint', () => {
            // The content is the only source of syllables and clusters. Guessing
            // from spelling would move the threshold on a wrong guess.
            expect(DH.riskFor('van', '')).toBeNull();
            expect(DH.riskFor('', '/væn/')).toBeNull();
        });
    });

    describe('what is measured is the voiced span, not press-to-press', () => {
        test('leading and trailing silence are not part of the word', () => {
            const r = DH.analyse(samples([
                { ms: 500, level: 0 }, { ms: 400, level: 0.5 }, { ms: 900, level: 0 }
            ]), 16000);
            expect(r.ok).toBe(true);
            // 1.8 seconds of recording, 400ms of word. The whole feature turns on
            // this number being 400 and not 1800.
            expect(r.ms).toBe(400);
            expect(r.startMs).toBe(500);
        });

        test('a pause inside the span is refused, not measured', () => {
            const r = DH.analyse(samples([
                { ms: 100, level: 0.5 }, { ms: 400, level: 0 }, { ms: 100, level: 0.5 }
            ]), 16000);
            expect(r.ok).toBe(false);
            expect(r.code).toBe('gap');
        });

        test('a short gap inside one word is kept', () => {
            // A stop consonant has silence in it. 200ms is under the limit.
            const r = DH.analyse(samples([
                { ms: 150, level: 0.5 }, { ms: 200, level: 0 }, { ms: 150, level: 0.5 }
            ]), 16000);
            expect(r.ok).toBe(true);
            expect(r.ms).toBe(500);
        });

        test('silence is silence, and says so', () => {
            const r = DH.analyse(samples([{ ms: 800, level: 0 }]), 16000);
            expect(r.ok).toBe(false);
            expect(r.code).toBe('silent');
        });

        test('a span too short or too long to be one word is refused', () => {
            expect(DH.analyse(samples([{ ms: 30, level: 0.5 }]), 16000).code).toBe('implausible');
            expect(DH.analyse(samples([{ ms: 5000, level: 0.5 }]), 16000).code).toBe('implausible');
        });

        test('no samples at all is a refusal, not a zero', () => {
            expect(DH.analyse(null, 16000).code).toBe('no-audio');
            expect(DH.analyse(new Float32Array(0), 16000).code).toBe('no-audio');
        });

        test('the same word at two sample rates measures the same', () => {
            const at = (sr) => DH.analyse(samples([
                { ms: 100, level: 0.4 }, { ms: 300, level: 0.4 }
            ], sr), sr).ms;
            expect(at(8000)).toBe(400);
            expect(at(44100)).toBe(400);
        });
    });

    describe('the five things it says, and the one thing it never says', () => {
        const one = { word: 'bus', ipa: '/bʌs/', syllables: 1, cluster: 1, code: 'T-P2' };

        test('clearly longer: consistent with, and explicitly not proof of', () => {
            const v = DH.verdict(400, 600, one);
            expect(v.band).toBe('consistent');
            expect(v.percent).toBe(50);
            expect(v.text).toContain('Measured: the model 0.40s, your recording 0.60s.');
            expect(v.text).toContain('That is 50% longer');
            expect(v.text).toContain('**This is consistent with a vowel after the final consonant of *bus*.');
            expect(v.text).toContain('It is not proof of one:**');
            expect(v.text).toContain('speaking slowly, pausing before the end, or breathing out after the word');
            expect(v.text).toContain('nothing here can separate them');
            // And it hands the judgement back, at the control that already exists.
            expect(v.text).toContain('Press "▶ Model, you, model"');
        });

        test('slightly longer: a real difference it refuses to attribute', () => {
            const v = DH.verdict(400, 520, one);
            expect(v.band).toBe('unclear');
            expect(v.percent).toBe(30);
            expect(v.text).toContain('It is a real difference, but **it is not enough to tell an ' +
                'added vowel from simply speaking more slowly**');
            expect(v.text).toContain('this app cannot tell those two apart');
        });

        test('the too-small band reports nothing as a finding', () => {
            const v = DH.verdict(400, 430, one);
            expect(v.band).toBe('too-small');
            expect(v.text).toContain('**that difference is too small to mean anything.**');
            expect(v.text).toContain('Two recordings of the same person saying the same word ' +
                'differ by more than this');
            expect(v.text).toContain('Nothing was found here.');
            // It does not point at the comparison, because there is nothing to
            // check: sending a learner to listen for a vowel on 8% would be the
            // suggestion doing the work the measurement could not.
            expect(v.text).not.toContain('Model, you, model');
        });

        test('the same length lands in that band too, at 0%', () => {
            const v = DH.verdict(400, 400, one);
            expect(v.band).toBe('too-small');
            expect(v.percent).toBe(0);
            expect(v.text).toContain('That is 0% longer');
            expect(v.text).toContain('too small to mean anything');
        });

        test('shorter: nothing found, and not a pass either', () => {
            const v = DH.verdict(400, 350, one);
            expect(v.band).toBe('shorter');
            expect(v.text).toContain('Yours was **shorter** than the model');
            expect(v.text).toContain('That does not mean it was right');
            expect(v.text).toContain('It means this particular measurement found nothing.');
        });

        test('more than one syllable: the numbers, and no interpretation', () => {
            const v = DH.verdict(600, 900, { word: 'asking', ipa: '/ˈɑːskɪŋ/', syllables: 2, cluster: 1 });
            expect(v.band).toBe('not-offered');
            expect(v.percent).toBeNull();
            expect(v.text).toContain('too little for this app to tell it apart from speaking carefully');
            expect(v.text).toContain('the two numbers above are all there is');
        });

        test('a missing number is never filled in with a zero', () => {
            expect(DH.verdict(0, 600, one).band).toBe('unmeasurable');
            expect(DH.verdict(400, 0, one).band).toBe('unmeasurable');
            expect(DH.verdict(0, 600, one).text).toContain('Nothing was measured this time');
        });

        test('a cluster is named as a cluster', () => {
            const v = DH.verdict(400, 700, { word: 'asked', ipa: '/ɑːskt/', syllables: 1, cluster: 2 });
            expect(v.text).toContain('the consonants at the end of *asked*');
        });

        test('NO BAND EVER SAYS THE LEARNER ADDED A VOWEL', () => {
            // The single most important assertion in this file. Every phrasing that
            // would turn a measurement into an accusation, in every band.
            const all = [
                DH.verdict(400, 600, one), DH.verdict(400, 520, one), DH.verdict(400, 430, one),
                DH.verdict(400, 400, one), DH.verdict(400, 350, one), DH.verdict(0, 0, one),
                DH.verdict(600, 900, { word: 'asking', syllables: 2, cluster: 1 })
            ];
            all.forEach(v => {
                const t = v.text.toLowerCase();
                expect(t).not.toContain('you added');
                expect(t).not.toContain('you inserted');
                expect(t).not.toContain('extra vowel sound after');
                expect(t).not.toContain('incorrect');
                // "wrong" survives in one place only — "a short recording can still
                // have the wrong sounds in it", which is a hedge against the app
                // being read as a pass. What is forbidden is calling the learner's
                // attempt wrong.
                expect(t).not.toMatch(/\b(you|yours|that|it|this) (was|were|is|are) wrong\b/);
                expect(t).not.toMatch(/\bscore\b/);
                expect(t).not.toMatch(/\bscores\b/);
                // "scored" is allowed in exactly one shape: a sentence denying that
                // anything was. Any other sentence containing it would be a score.
                v.text.split(/(?<=\.)\s/).forEach(sentence => {
                    if (/scored/i.test(sentence)) {
                        expect(sentence.toLowerCase()).toContain('nothing');
                    }
                });
                expect(t).not.toMatch(/\b(pass|fail)(ed)?\b/);
                expect(t).not.toMatch(/\bout of \d/);
                // No band carries a mark of any kind.
                expect(v.scored).toBe(false);
            });
        });

        test('every band that interprets anything also names an innocent cause', () => {
            expect(DH.verdict(400, 600, one).text).toContain('speaking slowly');
            expect(DH.verdict(400, 520, one).text).toContain('speaking more slowly');
            expect(DH.verdict(400, 430, one).text).toContain('the phone\'s voice from one play to the next');
        });
    });

    describe('the refusals are in the learner\'s terms', () => {
        test('each one names what happened and what still works', () => {
            expect(DH.refusal('no-decoder')).toContain('cannot measure the length of a recording');
            expect(DH.refusal('no-decoder')).toContain('Everything else on this card works.');
            expect(DH.refusal('silent')).toContain('The recording is silent');
            expect(DH.refusal('gap')).toContain('There is a pause in the middle of the recording');
            expect(DH.refusal('implausible')).toContain('not the length of a single short word');
            expect(DH.refusal('no-model')).toContain('The phone\'s voice could not be timed');
            expect(DH.refusal('anything-else')).toContain('could not be measured');
        });

        test('no refusal blames the learner or implies a score', () => {
            ['no-decoder', 'silent', 'gap', 'implausible', 'no-model', 'x'].forEach(code => {
                const t = DH.refusal(code).toLowerCase();
                expect(t).not.toContain('wrong');
                expect(t).not.toContain('failed');
                expect(t).not.toContain('error');
            });
        });
    });

    describe('the module writes nothing anywhere', () => {
        test('it names no store, no SRS and no mistake taxonomy', () => {
            const code = block()
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
            ['SRS.', 'Mistakes.', 'BlobStore', 'localStorage', 'saveProgress',
             'RecordingArchive', 'state.'].forEach(forbidden => {
                expect(code).not.toContain(forbidden);
            });
        });
    });
});

describe('the duration hint on screen (US-406 / FR-PRN-5)', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

    /** One top-level function's source, by brace matching. */
    function fnSource(name) {
        const start = appSource.indexOf('function ' + name + '(');
        expect(start).toBeGreaterThan(-1);
        let depth = 0;
        for (let i = appSource.indexOf('{', start); i < appSource.length; i++) {
            if (appSource[i] === '{') depth++;
            else if (appSource[i] === '}' && --depth === 0) return appSource.slice(start, i + 1);
        }
        throw new Error('unbalanced braces in ' + name);
    }

    function codeOnly(source) {
        return source.replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
    }

    /** The authored pairs, as the app sees them. */
    function contentPairs() {
        const read = (file, name) => {
            const src = fs.readFileSync(path.join(ROOT, 'data', 'pronunciation', file), 'utf8');
            return new Function(src + '\n;return typeof ' + name + ' !== "undefined" ? ' + name + ' : null;')();
        };
        const v = read('vowels-stress.js', 'PRONUNCIATION_VOWELS_STRESS');
        const c = read('consonants.js', 'PRONUNCIATION_CONSONANTS');
        return [].concat((v && v.pairs) || [], (c && c.pairs) || []);
    }

    const pairs = contentPairs();
    const pairById = (id) => pairs.filter(p => p.id === id)[0];

    function samples(parts, rate) {
        const sr = rate || 16000;
        const counts = parts.map(p => Math.round((p.ms * sr) / 1000));
        const out = new Float32Array(counts.reduce((a, b) => a + b, 0));
        let at = 0;
        parts.forEach((p, i) => {
            for (let j = 0; j < counts[i]; j++) out[at + j] = p.level * (j % 2 ? 1 : -1);
            at += counts[i];
        });
        return out;
    }

    let saveCalls;
    let captures;
    let spoken;
    let timeouts;
    let clock;

    /**
     * Everything the surface reaches for, faked, and NOTHING ELSE. The archive fake
     * carries only the three methods the card is allowed to use; save() throws.
     */
    function build(options) {
        const opts = options || {};
        saveCalls = [];
        captures = [];
        spoken = [];
        timeouts = [];
        clock = 1000;

        const win = {};
        if (!opts.noDecoder) {
            win.AudioContext = function () {
                this.decodeAudioData = (buffer, ok, fail) => {
                    if (opts.undecodable) { fail(new Error('nope')); return; }
                    ok({
                        sampleRate: buffer._rate,
                        getChannelData: () => buffer._samples
                    });
                };
                this.close = () => {};
            };
        }
        const DurationHint = new Function('window',
            appSource.slice(
                appSource.indexOf('// ===== BEGIN DURATION HINT (US-406) ====='),
                appSource.indexOf('// ===== END DURATION HINT (US-406) =====')
            ) + '\n;return window.DurationHint;')(win);

        const Archive = {
            recorderMissing: () => !!opts.noMic,
            startCapture: (surface, handlers) => {
                captures.push({ surface: surface, handlers: handlers });
                if (opts.micDenied) {
                    handlers.onerror(new Error('NotAllowedError'));
                    return Promise.resolve(false);
                }
                handlers.onstart();
                return Promise.resolve(true);
            },
            stopCapture: () => true,
            save: () => {
                saveCalls.push(1);
                throw new Error('US-406 must never write to the archive');
            }
        };

        const speech = opts.noVoice ? undefined : {
            cancel: () => {},
            speak: (u) => {
                spoken.push(u);
                if (opts.neverStarts) { u.onend(); return; }
                u.onstart();
                clock += (opts.modelMs || 400) + (spoken.length === 2 ? (opts.secondDelta || 0) : 0);
                if (!opts.neverEnds) u.onend();
            }
        };

        const window_ = {
            DurationHint: DurationHint,
            RecordingArchive: Archive,
            speechSynthesis: speech
        };

        const names = ['document', 'window', 'Date', 'setTimeout', 'FileReader',
                       'SpeechSynthesisUtterance', 'AppErrorHandler', 'DurationHint',
                       'RecordingArchive', 'PRON_RATE_NORMAL'];
        const body = [
            fnSource('appendGrammarText'),
            fnSource('grammarParagraph'),
            fnSource('pronAudioUsable'),
            fnSource('pronDurationStatus'),
            fnSource('pronKeywordIpa'),
            fnSource('pronDurationTarget'),
            fnSource('pronTimeModel'),
            fnSource('pronTimeModelTwice'),
            fnSource('pronBlobBuffer'),
            fnSource('pronDurationReport'),
            fnSource('appendDurationHint'),
            fnSource('pronMeasureAndCompare'),
            'const pronParagraph = grammarParagraph;',
            'const PRON_DURATION_SURFACE = "pron-duration";',
            'const PRON_MODEL_TIMEOUT_MS = 6000;',
            'let pronDuration = { word: "", risk: null, learner: null, busy: false };',
            'let pronCompare = { playing: ' + (opts.comparisonPlaying ? 'true' : 'false') + ' };',
            'return { append: appendDurationHint, target: pronDurationTarget, ipa: pronKeywordIpa };'
        ].join('\n\n');

        const Utterance = function (text) { this.text = text; };
        return new Function(...names, body)(
            document, window_, { now: () => clock },
            (fn, ms) => { timeouts.push({ fn: fn, ms: ms }); return timeouts.length; },
            undefined, Utterance, { logError: () => {} }, DurationHint, Archive, 1
        );
    }

    /** A recording of a given voiced length, as the blob the recorder hands over. */
    function clip(voicedMs, rate) {
        const sr = rate || 16000;
        const data = samples([
            { ms: 250, level: 0 }, { ms: voicedMs, level: 0.5 }, { ms: 400, level: 0 }
        ], sr);
        return {
            size: data.length * 4,
            arrayBuffer: () => Promise.resolve({
                byteLength: data.length * 4, _samples: data, _rate: sr
            })
        };
    }

    async function flush() {
        for (let i = 0; i < 24; i++) await Promise.resolve();
    }

    function host() {
        return document.getElementById('durationHost');
    }

    beforeEach(() => {
        document.body.innerHTML =
            '<div id="durationHost"></div><div id="pronCompareStatus"></div>';
    });

    const resultText = () => document.getElementById('pronDurationResult').textContent;
    const band = () => document.getElementById('pronDurationResult').getAttribute('data-band');
    const statusText = () => document.getElementById('pronDurationStatus').textContent;

    /** Record, stop, and let the whole chain settle. */
    async function run(card, voicedMs, rate) {
        document.getElementById('pronDurationRecord').click();
        // The press-to-press number is deliberately absurd: if it ever reaches the
        // comparison, the assertions on 0.60s below fail.
        captures[0].handlers.onstop(clip(voicedMs, rate), { durationMs: 99000 });
        await flush();
    }

    describe('which pairs it is offered on at all', () => {
        test('*sheep* / *ship* — one syllable, final consonant — gets the card', () => {
            const card = build();
            card.append(host(), pairById('iː-ɪ'));
            expect(document.getElementById('pronDurationCard')).not.toBeNull();
            expect(document.getElementById('pronDurationRecord').textContent)
                .toBe('⏱ Record just "sheep"');
        });

        test('*zoo* / *Sue* gets NO card, because neither word ends in a consonant', () => {
            // Not a limitation worked around: an epenthetic vowel follows a final
            // consonant, and these words have none. A card here would be measuring
            // something the arithmetic cannot interpret.
            const card = build();
            expect(card.append(host(), pairById('z-s'))).toBeNull();
            expect(document.getElementById('pronDurationCard')).toBeNull();
            expect(host().textContent).toBe('');
        });

        test('the IPA comes from the content, and a keyword with none is skipped', () => {
            const card = build();
            const vw = pairById('v-w');
            expect(card.ipa(vw, 'van')).toBe('');            // authored nowhere
            expect(card.ipa(pairById('iː-ɪ'), 'sheep')).toBe('/ʃiːp/');
            // So the /v/~/w/ card falls through to the second keyword rather than
            // guessing *van* from its spelling.
            expect(card.target(vw).word).toBe('wet');
        });

        test('every card the real content produces is a one-syllable word', () => {
            pairs.forEach(pair => {
                const card = build();
                const target = card.target(pair);
                if (!target) return;
                expect(target.syllables).toBe(1);
                expect(target.cluster).toBeGreaterThan(0);
            });
        });
    });

    describe('what the learner sees before they record anything', () => {
        test('the no-recording state is stated, not left as a blank panel', () => {
            const card = build();
            card.append(host(), pairById('iː-ɪ'));
            expect(statusText()).toBe('No recording yet, so there is nothing to compare. ' +
                'Nothing here is scored and nothing is stored.');
            expect(document.getElementById('pronDurationResult').hidden).toBe(true);
        });

        test('it asks for ONE word, and says why not both', () => {
            const card = build();
            card.append(host(), pairById('iː-ɪ'));
            const text = document.getElementById('pronDurationCard').textContent;
            expect(text).toContain('Record just sheep, once, on its own, with no pause.');
            expect(text).toContain('the recording above is of two words, and the gap between ' +
                'them is not part of either one');
            expect(text).toContain('This clip is measured and then dropped');
            expect(text).toContain('the recordings above are untouched');
        });

        test('it says what duration is and is not evidence of, up front', () => {
            const card = build();
            card.append(host(), pairById('iː-ɪ'));
            const text = document.getElementById('pronDurationCard').textContent;
            expect(text).toContain('It cannot hear whether the vowel is there.');
            expect(text).toContain('what that is — and is not — evidence of');
        });
    });

    describe('the four outcomes, as the learner reads them', () => {
        test('clearly longer: 0.60s against 0.40s is +50% and consistent with a vowel', async () => {
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 600);
            expect(band()).toBe('consistent');
            expect(resultText()).toContain('Measured: the model 0.40s, your recording 0.60s.');
            expect(resultText()).toContain('That is 50% longer');
            expect(resultText()).toContain('This is consistent with a vowel after the final consonant of sheep.');
            expect(resultText()).toContain('It is not proof of one:');
            expect(resultText()).toContain('Press "▶ Model, you, model"');
            expect(statusText()).toBe('Measured. Nothing has been scored, and nothing about this is stored.');
        });

        test('slightly longer: +30% is a real difference it will not attribute', async () => {
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 520);
            expect(band()).toBe('unclear');
            expect(resultText()).toContain('That is 30% longer');
            expect(resultText()).toContain('not enough to tell an added vowel from simply speaking more slowly');
        });

        test('the same: +0% is refused as noise', async () => {
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 400);
            expect(band()).toBe('too-small');
            expect(resultText()).toContain('That is 0% longer');
            expect(resultText()).toContain('too small to mean anything');
            expect(resultText()).toContain('Nothing was found here.');
        });

        test('a difference under the noise floor is refused too', async () => {
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 440);      // +10%
            expect(band()).toBe('too-small');
            expect(resultText()).toContain('That is 10% longer');
            expect(resultText()).toContain('too small to mean anything');
        });

        test('shorter: nothing found, and explicitly not a pass', async () => {
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 300);
            expect(band()).toBe('shorter');
            expect(resultText()).toContain('Yours was shorter than the model');
            expect(resultText()).toContain('That does not mean it was right');
        });

        test('the press-to-press duration never reaches the comparison', async () => {
            // 99 seconds was handed in as meta.durationMs. What is reported is the
            // 0.60s voiced span. This is the difference between a hint and a lie.
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 600);
            expect(resultText()).toContain('your recording 0.60s');
            expect(resultText()).not.toContain('99');
        });
    });

    describe('the model duration is measured, never invented', () => {
        test('the word is spoken twice, at the normal rate, and the longer is kept', async () => {
            const card = build({ modelMs: 400, secondDelta: 200 });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 900);
            expect(spoken.map(u => u.text)).toEqual(['sheep', 'sheep']);
            spoken.forEach(u => expect(u.rate).toBe(1));      // PRON_RATE_NORMAL
            // 400 and 600 were measured; the longer one is used, which SHRINKS the
            // ratio (900/600 = +50%, not 900/400 = +125%) and makes the hint less
            // likely to fire. Every bias in this feature points that way.
            expect(resultText()).toContain('the model 0.60s');
            expect(resultText()).toContain('That is 50% longer');
        });

        test('a voice that never starts is a refusal, not an estimate', async () => {
            const card = build({ neverStarts: true });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 600);
            expect(band()).toBe('refused');
            expect(resultText()).toContain('The phone\'s voice could not be timed this time');
            expect(resultText()).toContain('The written exercise and the comparison need no measurement');
            // No number was put on the left of the comparison.
            expect(resultText()).not.toContain('Measured: the model');
        });

        test('a voice that never ends times out into the same refusal', async () => {
            const card = build({ neverEnds: true });
            card.append(host(), pairById('iː-ɪ'));
            document.getElementById('pronDurationRecord').click();
            captures[0].handlers.onstop(clip(600), { durationMs: 99000 });
            await flush();
            // The watchdog is the only thing that will finish this, and what it
            // reports is failure.
            expect(timeouts.length).toBeGreaterThan(0);
            expect(timeouts[0].ms).toBe(6000);
            timeouts[0].fn();
            await flush();
            expect(band()).toBe('refused');
            expect(resultText()).toContain('could not be timed');
        });

        test('no speech synthesis at all: refused, and the card still stands', async () => {
            const card = build({ noVoice: true });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 600);
            expect(band()).toBe('refused');
            expect(resultText()).toContain('The phone\'s voice could not be timed');
        });

        test('a clip that cannot be measured does not make the learner sit through two plays', async () => {
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            document.getElementById('pronDurationRecord').click();
            captures[0].handlers.onstop(clip(0), { durationMs: 99000 });   // silence
            await flush();
            expect(spoken).toEqual([]);
            expect(band()).toBe('refused');
            expect(resultText()).toContain('The recording is silent');
        });
    });

    describe('the honest edge cases', () => {
        test('a pause in the middle is refused with the reason', async () => {
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            document.getElementById('pronDurationRecord').click();
            const data = samples([
                { ms: 100, level: 0.5 }, { ms: 500, level: 0 }, { ms: 200, level: 0.5 }
            ], 16000);
            captures[0].handlers.onstop({
                size: 400,
                arrayBuffer: () => Promise.resolve({ byteLength: 400, _samples: data, _rate: 16000 })
            }, { durationMs: 800 });
            await flush();
            expect(band()).toBe('refused');
            expect(resultText()).toContain('There is a pause in the middle of the recording');
        });

        test('no microphone: the card explains itself and draws no controls', () => {
            const card = build({ noMic: true });
            card.append(host(), pairById('iː-ɪ'));
            expect(document.getElementById('pronDurationCard')).not.toBeNull();
            expect(document.getElementById('pronDurationRecord')).toBeNull();
            expect(document.getElementById('pronDurationCard').textContent).toContain(
                'this device has no microphone the app can use — so there is no length to compare');
            expect(document.getElementById('pronDurationCard').textContent).toContain(
                'Nothing else on this card changes.');
        });

        test('a refused microphone says so and scores nothing', async () => {
            const card = build({ micDenied: true });
            card.append(host(), pairById('iː-ɪ'));
            document.getElementById('pronDurationRecord').click();
            await flush();
            expect(statusText()).toContain('No microphone, so there is no length to measure');
            expect(statusText()).toContain('the question above needs no recording');
        });

        test('no Web Audio: the hint is not offered and the card says why', () => {
            const card = build({ noDecoder: true });
            card.append(host(), pairById('iː-ɪ'));
            expect(document.getElementById('pronDurationRecord')).toBeNull();
            expect(document.getElementById('pronDurationCard').textContent).toContain(
                'This browser cannot measure the length of a recording');
            expect(document.getElementById('pronDurationCard').textContent).toContain(
                'Everything else on this card works.');
        });

        test('an undecodable blob is a refusal, not a crash', async () => {
            const card = build({ undecodable: true });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 600);
            expect(band()).toBe('refused');
            expect(resultText()).toContain('could not be measured');
        });

        test('a browser with no Blob.arrayBuffer and no FileReader refuses cleanly', async () => {
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            document.getElementById('pronDurationRecord').click();
            captures[0].handlers.onstop({ size: 100 }, { durationMs: 800 });
            await flush();
            expect(band()).toBe('refused');
            expect(spoken).toEqual([]);
        });

        test('it will not record over a comparison that is still playing', () => {
            const card = build({ comparisonPlaying: true });
            card.append(host(), pairById('iː-ɪ'));
            document.getElementById('pronDurationRecord').click();
            expect(captures).toEqual([]);
            expect(statusText()).toContain('The model-you-model comparison is still playing');
            expect(statusText()).toContain('otherwise the model ends up inside your recording');
        });

        test('a device with neither microphone nor Web Audio still gets one sentence', () => {
            const card = build({ noMic: true, noDecoder: true });
            expect(() => card.append(host(), pairById('iː-ɪ'))).not.toThrow();
            expect(document.getElementById('pronDurationCard').textContent).toContain('microphone');
        });
    });

    describe('nothing is scored and nothing is stored', () => {
        test('a full successful run touches the archive not at all', async () => {
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 600);
            // save() throws if called, so an empty log is a proof and not a hope.
            expect(saveCalls).toEqual([]);
            // Its own recorder surface, so the A->B->A card's isRecording('pron')
            // never sees this one.
            expect(captures[0].surface).toBe('pron-duration');
        });

        test('it does not write into the comparison\'s status line either', async () => {
            const card = build({ modelMs: 400 });
            card.append(host(), pairById('iː-ɪ'));
            await run(card, 600);
            expect(document.getElementById('pronCompareStatus').textContent).toBe('');
        });

        test('the surface names no SRS, no Mistakes, no store and no progress', () => {
            const region = appSource.slice(
                appSource.indexOf('// US-406 / FR-PRN-7 — the duration comparison'),
                appSource.indexOf('// ===== BEGIN DURATION HINT (US-406) ====='));
            expect(region.length).toBeGreaterThan(2000);
            const code = codeOnly(region);
            ['SRS.', 'Mistakes.', 'BlobStore', 'localStorage', 'saveProgress(',
             'pronRecordAttempt', 'recordItemAttempt', 'updateDueCount',
             'RecordingArchive.save', 'RecordingArchive.open', 'RecordingArchive.list',
             'RecordingArchive.render', 'markExerciseComplete', 'awardXP'].forEach(forbidden => {
                expect(code).not.toContain(forbidden);
            });
            // Nor a percentage of its own: every number the learner sees is
            // computed by DurationHint.verdict().
            expect(code).not.toMatch(/Math\.round\([^)]*100\)/);
        });

        test('no result is turned into a colour, a meter or a badge', () => {
            const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
            const rules = css.slice(css.indexOf('.pron-duration'),
                                    css.indexOf('/* --- Free production'));
            expect(rules).toContain('.pron-duration');
            // A green/amber/red band would be a score drawn in CSS.
            expect(rules).not.toMatch(/\.pron-duration.*(success|warning|danger|correct|wrong)/);
            expect(rules).not.toContain('data-band');
        });
    });

    describe('what US-404 shipped is untouched', () => {
        const compare = fnSource('appendPronunciationComparison');

        test('the hint is appended to the comparison card, after its controls', () => {
            // The LAST call is the one on the normal path, and it comes after the
            // archive div — so the hint is under a working comparison, never above
            // it. (The first call is the no-microphone branch, tested below.)
            const at = compare.lastIndexOf('appendDurationHint(box, pair)');
            expect(at).toBeGreaterThan(-1);
            expect(at).toBeGreaterThan(compare.lastIndexOf("archive.id = 'pronCompareArchive'"));
            expect(at).toBeLessThan(compare.indexOf('refreshPronunciationArchive();'));
        });

        test('the no-microphone branch gets it too, rather than hiding it', () => {
            const branch = compare.slice(0, compare.indexOf('const row = document.createElement'));
            expect(branch).toContain('appendDurationHint(box, pair)');
        });

        test('A->B->A still plays both models at PRON_RATE_SLOW', () => {
            const run = fnSource('pronRunComparison');
            const rates = run.match(/pronSpeakSequence\(words, ([A-Z_]+),/g) || [];
            expect(rates).toHaveLength(2);
            rates.forEach(call => expect(call).toContain('PRON_RATE_SLOW'));
            // And the hint's own timing is the other rate, on purpose: comparing a
            // 0.6-rate model against natural speech would measure the rate.
            expect(fnSource('pronTimeModel')).toContain('u.rate = PRON_RATE_NORMAL;');
            expect(codeOnly(fnSource('pronTimeModel'))).not.toContain('PRON_RATE_SLOW');
        });

        test('the comparison code knows nothing about the hint beyond calling it', () => {
            const run = codeOnly(fnSource('pronRunComparison'));
            expect(run).not.toContain('DurationHint');
            expect(run).not.toContain('pronDuration');
            expect(codeOnly(fnSource('pronPlayLearner'))).not.toContain('DurationHint');
            expect(codeOnly(fnSource('keepPronunciationRecording'))).not.toContain('DurationHint');
        });

        test('the produce card still ends on the no-score note', () => {
            const produce = fnSource('renderPronunciationProduce');
            expect(produce).toContain('Nothing on this screen is scored');
            const comparison = produce.indexOf('appendPronunciationComparison(host, pair)');
            expect(produce.indexOf('Nothing on this screen is scored')).toBeGreaterThan(comparison);
        });
    });
});

