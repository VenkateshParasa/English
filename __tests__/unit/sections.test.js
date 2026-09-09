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
    it('exposes the six current sections in nav order', () => {
        expect(ids).toEqual([
            'dashboard', 'vocabulary', 'sentences', 'reading', 'listening', 'puzzles'
        ]);
    });

    it('tracks exercises for every section except the dashboard', () => {
        expect(Sections.exerciseIds()).toEqual([
            'vocabulary', 'sentences', 'reading', 'listening', 'puzzles'
        ]);
    });

    it('has one daily goal per learning section', () => {
        expect(Sections.goalKeys()).toEqual([
            'vocab', 'sentence', 'reading', 'listening', 'puzzle'
        ]);
    });

    it('has an index field only for sections walked item by item', () => {
        expect(Sections.indexKeys()).toEqual([
            'currentWordIndex', 'currentSentenceIndex',
            'currentPassageIndex', 'currentListeningIndex'
        ]);
    });

    it('zeroMap covers every learning section', () => {
        expect(Sections.zeroMap('dailyStatKey')).toEqual({
            wordsLearned: 0, sentencesCompleted: 0, readingCompleted: 0,
            listeningCompleted: 0, puzzlesSolved: 0
        });
        expect(Sections.zeroMap('totalStatKey')).toEqual({
            totalWords: 0, totalSentences: 0, totalReading: 0,
            totalListening: 0, totalPuzzles: 0
        });
        expect(Sections.zeroMap('avgKey')).toEqual({
            words: 0, sentences: 0, reading: 0, listening: 0, puzzles: 0
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

    it('uses unique ids and unique keys throughout', () => {
        const unique = list => expect(list).toHaveLength(new Set(list).size);
        unique(ids);
        unique(Sections.goalKeys());
        unique(Sections.indexKeys());
        unique(Sections.exercises().map(s => s.dailyStatKey));
        unique(Sections.exercises().map(s => s.totalStatKey));
        unique(Sections.exercises().map(s => s.avgKey));
        unique(rows.filter(s => s.statusId).map(s => s.statusId));
    });

    it('returns null for an unknown id rather than throwing', () => {
        expect(Sections.get('grammar')).toBeNull();
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

    it('loads sections.js before app.js', () => {
        const srcs = Array.from(doc.querySelectorAll('script[src]'))
            .map(s => s.getAttribute('src'));
        // app.js's `state` literal calls Sections.zeroMap() at parse time.
        expect(srcs.indexOf('js/core/sections.js')).toBeGreaterThan(-1);
        expect(srcs.indexOf('js/core/sections.js')).toBeLessThan(srcs.indexOf('app.js'));
    });
});
