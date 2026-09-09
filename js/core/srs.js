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
 *   SRS.schedule(wordObj, correct, opts) -> updates a word's schedule
 *   SRS.selfReport(wordObj, achieved)    -> records a self-judged outcome
 *   SRS.getDueWords(limit)               -> [wordObj, ...] due now, capped
 *   SRS.getAllDueWords()                 -> every due wordObj, uncapped
 *   SRS.dueCount()                       -> size of the capped queue
 *   SRS.totalDueCount()                  -> honest total that is due
 *   SRS.deferredCount()                  -> due items waiting behind the cap
 *   SRS.stats()   -> { total, due, queued, deferred, learned, lapses, selfReported }
 *   SRS.getRecord(word)                  -> raw record or null
 *   SRS.isSelfReported(word)             -> was the last outcome self-judged?
 *   SRS.reset()                          -> clears all SRS data
 *   SRS.DAILY_REVIEW_CAP                 -> the daily queue cap (20)
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'srsData';
    const DAY_MS = 24 * 60 * 60 * 1000;

    // SM-2 tuning constants
    const MIN_EASE = 1.3;
    const MAX_EASE = 2.8;
    const DEFAULT_EASE = 2.5;

    // docs/TEACHING_METHODOLOGY.md §3 / FR-SRS-4: "Do not let the queue exceed
    // ~20 items a day — an unmanageable backlog is the most common reason
    // learners abandon SRS apps. Cap the daily queue and defer the rest."
    // The cap is a *presentation* limit only: nothing is dropped or rescheduled,
    // the overflow simply is not offered yet (see _dueRecords / getDueWords).
    const DAILY_REVIEW_CAP = 20;

    // FR-SRS-5: a self-reported outcome may bring an item back sooner, so the
    // soonest it may ask for is one day — the same rung a graded lapse falls to
    // (§3: "a lapse resets to 1 day"). It is never allowed to push an item out.
    const SELF_REPORT_INTERVAL_DAYS = 1;

    const SRS = {
        records: {},

        // Exposed so the UI and the tests reference the policy constant rather
        // than repeating the number 20.
        DAILY_REVIEW_CAP: DAILY_REVIEW_CAP,

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
         * Was the most recent recorded outcome for this word self-judged?
         * Records written before FR-SRS-5 carry no flag at all; the absent
         * field reads as `false` — "not self-reported" — which is correct,
         * because every outcome written by the old code was a graded one.
         */
        isSelfReported(word) {
            const rec = this.getRecord(word);
            return !!(rec && rec.selfReported);
        },

        /**
         * Update a word's review schedule based on the answer.
         * @param {Object} wordObj - Full word object ({ word, pronunciation, definition, example, quiz, ... })
         * @param {boolean} correct - Whether the learner answered correctly.
         * @param {Object} [opts] - { selfReported: true } for a learner- or
         *        recogniser-judged outcome. Omitting it means "graded", so every
         *        existing two-argument call site keeps its exact behaviour.
         * @returns {Object} The updated record.
         */
        schedule(wordObj, correct, opts) {
            const wordText = wordObj && (wordObj.word || wordObj);
            const key = this._key(wordText);
            if (!key) return null;

            const selfReported = !!(opts && opts.selfReported);

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

            if (selfReported) {
                this._applySelfReport(rec, correct, now);
            } else {
                this._applyGraded(rec, correct, now);
            }

            this.records[key] = rec;
            this.save();
            return rec;
        },

        /**
         * Record an outcome the learner (or a speech recogniser) judged for
         * themselves — FR-PRN-4/FR-PRN-5 self-comparison, "not yet" buttons,
         * read-aloud misses. Sugar for schedule(word, achieved, { selfReported: true }).
         */
        selfReport(wordObj, achieved) {
            return this.schedule(wordObj, achieved, { selfReported: true });
        },

        /**
         * Graded outcome: the app knows the answer, so this is evidence.
         * This is the original SM-2 ladder, unchanged.
         */
        _applyGraded(rec, correct, now) {
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
            // The last outcome on this record is a graded one again.
            rec.selfReported = false;
            return rec;
        },

        /**
         * Self-reported outcome (FR-SRS-5): "may schedule but never certify".
         *
         * Deliberately touches only `due` and `interval`, and only ever downwards:
         *  - `reps`, `ease` and `lapses` are the verified-evidence fields. reps
         *    drives stats().learned and ease drives the ladder, so a learner
         *    marking their own work — in either direction — must not move them.
         *    That is what makes stats() ungameable by self-report.
         *  - a self-reported success changes *nothing* about the schedule. It is
         *    not evidence, so it may not buy a longer interval (methodology
         *    principle 3: never claim more accuracy than we have).
         *  - a self-reported failure pulls the item back to at most one day out.
         *    Math.min means it can only ever move the due date earlier, so no
         *    self-report can silently extend an interval or defer an item that
         *    is already due.
         *  - `lastReviewed` is left alone: no graded review happened, and nothing
         *    downstream may mistake a self-report for one. The timestamp lives in
         *    `lastSelfReported` instead.
         */
        _applySelfReport(rec, achieved, now) {
            rec.selfReported = true;
            rec.selfReports = (rec.selfReports || 0) + 1;
            rec.lastSelfReported = now;

            if (!achieved) {
                // Back sooner, never later. interval is lowered too, so the next
                // graded success multiplies from the shortened rung rather than
                // from an interval the learner has just said they cannot hold.
                rec.interval = Math.min(
                    typeof rec.interval === 'number' ? rec.interval : 0,
                    SELF_REPORT_INTERVAL_DAYS
                );
                rec.due = Math.min(rec.due, now + SELF_REPORT_INTERVAL_DAYS * DAY_MS);
            }
            return rec;
        },

        /**
         * Every due record, most-overdue first. Internal: callers get word
         * payload copies from getDueWords / getAllDueWords, never records.
         *
         * Order is oldest-due-first, tie-broken by most lapses. Pedagogically:
         * the most overdue item is the one closest to being forgotten outright,
         * so it has the most retention to gain from a review right now, and
         * recovering a decaying memory is worth more than topping up a fresh
         * one. It is also starvation-free — a newly due item can never queue
         * ahead of an older one, so a backlog drains in order instead of
         * stranding the same items behind the cap forever. Among items that
         * came due at the same moment the most-lapsed goes first: repeated
         * failure is the app's own evidence that the item is the least secure.
         */
        _dueRecords() {
            const now = this._now();
            return Object.keys(this.records)
                .map(k => this.records[k])
                .filter(r => r && r.data && r.data.quiz && r.due <= now)
                .sort((a, b) => (a.due - b.due) || ((b.lapses || 0) - (a.lapses || 0)));
        },

        /**
         * Words to review now: most-overdue first, capped at DAILY_REVIEW_CAP.
         * Only records that carry a full word payload are returned.
         *
         * Overflow is *deferred, not dropped*: no record is touched here, so a
         * deferred item keeps its due date in the past, stays due tomorrow, and
         * sorts even further to the front then. Deferring cannot extend an
         * interval because deferring writes nothing at all.
         *
         * @param {number} [limit] - Override the cap (tests, "review more"
         *        flows). Must be a non-negative number; anything else uses the cap.
         */
        getDueWords(limit) {
            const cap = (typeof limit === 'number' && isFinite(limit) && limit >= 0)
                ? limit
                : DAILY_REVIEW_CAP;
            return this._dueRecords()
                .slice(0, cap)
                .map(r => Object.assign({}, r.data));
        },

        /** Every due word, ignoring the cap. For dashboards and diagnostics. */
        getAllDueWords() {
            return this._dueRecords().map(r => Object.assign({}, r.data));
        },

        /**
         * The number of words the learner will actually be asked to review, i.e.
         * the size of the capped queue. This is deliberately the capped figure,
         * not the honest backlog: the badge it feeds ("Review Due (N)") is a
         * promise about how long the session is, and it must equal
         * getDueWords().length or pressing it contradicts it. Showing "347" is
         * exactly the wall of work FR-SRS-4 exists to prevent. The honest total
         * is still available, unrounded, via totalDueCount() / deferredCount()
         * / stats().
         */
        dueCount() {
            return this.getDueWords().length;
        },

        /** The honest total that is due now, cap ignored. */
        totalDueCount() {
            return this._dueRecords().length;
        },

        /** How many due items are waiting behind the cap. */
        deferredCount() {
            return Math.max(0, this.totalDueCount() - DAILY_REVIEW_CAP);
        },

        stats() {
            const now = this._now();
            const all = Object.keys(this.records).map(k => this.records[k]);
            return {
                total: all.length,
                due: all.filter(r => r.due <= now).length,
                // What today's session actually holds, and what it is holding back.
                queued: this.dueCount(),
                deferred: this.deferredCount(),
                // reps only ever advances on a graded success, so "learned"
                // cannot be reached by self-report. Same for lapses.
                learned: all.filter(r => r.reps >= 3).length,
                lapses: all.reduce((sum, r) => sum + (r.lapses || 0), 0),
                // Reported separately and never folded into learned/lapses.
                selfReported: all.reduce((sum, r) => sum + (r.selfReports || 0), 0)
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
