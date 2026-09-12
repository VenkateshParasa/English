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
            expect(body).toMatch(/listeningSession = \{ item: item, attempted: false, revealed: false/);
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
