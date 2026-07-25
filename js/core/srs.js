/**
 * Spaced Repetition System (SRS)
 * -------------------------------------------------------------
 * A self-contained, offline-first review scheduler based on a
 * simplified SM-2 algorithm. It tracks per-word review state in
 * localStorage and surfaces the words that are due for review.
 *
 * No backend required — everything persists locally in the browser.
 *
 * Public API (window.SRS):
 *   SRS.schedule(wordObj, correct)  -> updates a word's schedule
 *   SRS.getDueWords()               -> [wordObj, ...] due now (oldest first)
 *   SRS.dueCount()                  -> number of words due now
 *   SRS.stats()                     -> { total, due, learned, lapses }
 *   SRS.getRecord(word)             -> raw record or null
 *   SRS.reset()                     -> clears all SRS data
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'srsData';
    const DAY_MS = 24 * 60 * 60 * 1000;

    // SM-2 tuning constants
    const MIN_EASE = 1.3;
    const MAX_EASE = 2.8;
    const DEFAULT_EASE = 2.5;

    const SRS = {
        records: {},

        /** Normalize a word into a stable, case-insensitive key. */
        _key(word) {
            return String(word || '').trim().toLowerCase();
        },

        /** Current time in ms. Wrapped so it is easy to stub in tests. */
        _now() {
            return Date.now();
        },

        /** Load persisted records from localStorage (called on first use). */
        load() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                this.records = raw ? (JSON.parse(raw) || {}) : {};
            } catch (e) {
                // Corrupt or unavailable storage — start clean rather than crash.
                this.records = {};
            }
            return this.records;
        },

        /** Persist records to localStorage. Silent on failure (private mode, quota). */
        save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
            } catch (e) {
                if (global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                    global.AppErrorHandler.logError(e, 'SRS save');
                }
            }
        },

        getRecord(word) {
            return this.records[this._key(word)] || null;
        },

        /**
         * Update a word's review schedule based on the answer.
         * @param {Object} wordObj - Full word object ({ word, pronunciation, definition, example, quiz, ... })
         * @param {boolean} correct - Whether the learner answered correctly.
         * @returns {Object} The updated record.
         */
        schedule(wordObj, correct) {
            const wordText = wordObj && (wordObj.word || wordObj);
            const key = this._key(wordText);
            if (!key) return null;

            const now = this._now();
            const rec = this.records[key] || {
                word: wordText,
                reps: 0,
                interval: 0,
                ease: DEFAULT_EASE,
                lapses: 0,
                due: now,
                lastReviewed: null,
                createdAt: now
            };

            // Keep the full word payload so review works fully offline
            // without re-hitting the dictionary API.
            if (wordObj && typeof wordObj === 'object') {
                rec.data = {
                    word: wordObj.word,
                    pronunciation: wordObj.pronunciation,
                    definition: wordObj.definition,
                    example: wordObj.example,
                    quiz: wordObj.quiz,
                    difficulty: wordObj.difficulty
                };
            }

            if (correct) {
                rec.reps += 1;
                if (rec.reps === 1) {
                    rec.interval = 1;          // review again tomorrow
                } else if (rec.reps === 2) {
                    rec.interval = 3;          // then in 3 days
                } else {
                    rec.interval = Math.round(rec.interval * rec.ease);
                }
                rec.ease = Math.min(MAX_EASE, rec.ease + 0.1);
                rec.due = now + rec.interval * DAY_MS;
            } else {
                // Lapse: reset progress and re-queue within the current session.
                rec.reps = 0;
                rec.interval = 0;
                rec.lapses += 1;
                rec.ease = Math.max(MIN_EASE, rec.ease - 0.2);
                rec.due = now; // due immediately, stays in the queue
            }

            rec.lastReviewed = now;
            this.records[key] = rec;
            this.save();
            return rec;
        },

        /**
         * Words that are due for review now, oldest due-date first.
         * Only records that carry a full word payload are returned.
         */
        getDueWords() {
            const now = this._now();
            return Object.keys(this.records)
                .map(k => this.records[k])
                .filter(r => r && r.data && r.data.quiz && r.due <= now)
                .sort((a, b) => a.due - b.due)
                .map(r => Object.assign({}, r.data));
        },

        dueCount() {
            return this.getDueWords().length;
        },

        stats() {
            const now = this._now();
            const all = Object.keys(this.records).map(k => this.records[k]);
            return {
                total: all.length,
                due: all.filter(r => r.due <= now).length,
                learned: all.filter(r => r.reps >= 3).length,
                lapses: all.reduce((sum, r) => sum + (r.lapses || 0), 0)
            };
        },

        reset() {
            this.records = {};
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (e) { /* ignore */ }
        }
    };

    SRS.load();

    // Expose globally (matches the pattern of the other core modules) and
    // support CommonJS for the test suite.
    global.SRS = SRS;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SRS;
    }
})(typeof window !== 'undefined' ? window : this);
