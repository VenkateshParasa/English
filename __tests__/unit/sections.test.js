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
