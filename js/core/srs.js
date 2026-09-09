/**
 * Spaced Repetition System (SRS)
 * -------------------------------------------------------------
 * A self-contained, offline-first review scheduler based on a
 * simplified SM-2 algorithm. It tracks per-item review state in
 * localStorage and surfaces the items that are due for review.
 *
 * No backend required — everything persists locally in the browser.
 *
 * ITEM TYPES (docs/TEACHING_METHODOLOGY.md §3). Records are keyed `type:ref`:
 *   vocab:happy · gram:present-perfect · phon:iː-ɪ · coll:make-a-decision
 * Records written before this existed were keyed by bare lowercase word; they
 * are migrated to `vocab:<word>` by js/core/migrations.js, without loss.
 *
 * Depends on js/core/migrations.js (which depends on js/core/levels.js) for the
 * key normaliser and the legacy-key migration. index.html loads both first; if
 * a script-order mistake removes them, this module degrades to an inline copy of
 * the normaliser and simply does not migrate (it never rewrites blind).
 *
 * Public API (window.SRS):
 *   SRS.init()                           -> load + migrate, explicitly, once
 *   SRS.schedule(item, correct, opts)    -> updates an item's schedule
 *   SRS.scheduleItem(type, ref, data, correct, opts) -> typed form
 *   SRS.selfReport(item, achieved)       -> records a self-judged outcome
 *   SRS.getDueWords(limit)               -> [wordObj, ...] vocab due now, capped
 *   SRS.getAllDueWords()                 -> every due vocab wordObj, uncapped
 *   SRS.getDue(type, opts)               -> [{type, ref, key, data}, ...] capped
 *   SRS.countDue(type)                   -> every due AND renderable item
 *   SRS.dueCount(type)                   -> capped actionable count (the badge)
 *   SRS.totalDueCount(type)              -> honest total that is due
 *   SRS.deferredCount(type)              -> due items waiting behind the cap
 *   SRS.stats(type) -> { total, due, actionable, queued, deferred, learned, lapses, selfReported }
 *   SRS.getRecord(item)                  -> raw record or null
 *   SRS.isSelfReported(item)             -> was the last outcome self-judged?
 *   SRS.reset()                          -> clears all SRS data
 *   SRS.DAILY_REVIEW_CAP                 -> the daily queue cap (20)
 *   SRS.PROJECTORS / SRS.RENDERABLE      -> per-type payload + renderability
 */
(function (global) {
    'use strict';

    // In the browser, index.html loads migrations.js (and levels.js) before this
    // file. Under Node (Jest) a test may require() this module on its own, so
    // pull the dependency in ourselves rather than failing on a missing global.
    if (typeof module !== 'undefined' && module.exports &&
        typeof global.Migrations === 'undefined') {
        require('./migrations.js');
    }

    const STORAGE_KEY = 'srsData';
    const DAY_MS = 24 * 60 * 60 * 1000;

    // SM-2 tuning constants
    const MIN_EASE = 1.3;
    const MAX_EASE = 2.8;
    const DEFAULT_EASE = 2.5;

    const DEFAULT_TYPE = 'vocab';
    const TYPES = ['vocab', 'gram', 'phon', 'coll'];

    /**
     * Per-type payload projection.
     *
     * Bounded on purpose: `rec.data` goes to localStorage, so copying an
     * author's whole object risks a DOM node, a blob or a cycle ending up in
     * storage. Extensible on purpose too — it is a registry, not a hardcoded
     * whitelist.
     *
     * ⚠️  ADDING A FIELD TO A CONTENT ITEM REQUIRES ADDING IT HERE, or it is
     * silently dropped from every review card. `vocab` is deliberately the exact
     * six fields the old inline whitelist copied, so this change moves no
     * vocabulary bytes. See docs/CONTENT_AUTHORING_GUIDE.md.
     */
    const PROJECTORS = {
        vocab: ['word', 'pronunciation', 'definition', 'example', 'quiz', 'difficulty'],
        // Matched to the authored schema in data/grammar.js, not guessed. The
        // earlier list projected `explanation`, `example` and `difficulty`, none
        // of which exist on a grammar point, while dropping `rule` — the one
        // field a wrong answer MUST show. TEACHING_METHODOLOGY.md §2 requires a
        // reason, a contrast and a retry on every wrong grammar answer, so
        // `rule`, `explain`, `contrast` and `practice` are all load-bearing.
        // `tier` carries the level (grammar has no `difficulty` field).
        gram:  ['id', 'title', 'tier', 'rule', 'explain', 'contrast', 'practice',
                'produce', 'caveats', 'l1Notes', 'mistakeCategory'],
        phon:  ['id', 'pair', 'label', 'examples', 'minimalPairs', 'difficulty'],
        coll:  ['id', 'chunk', 'meaning', 'example', 'practice', 'difficulty']
    };

    /**
     * Per-type "can the learner actually be shown this right now" predicate.
     *
     * `vocab` reproduces the old `data.quiz` filter EXACTLY, because the
     * vocabulary review card *is* a quiz and a record without one cannot be
     * rendered. The other three only need a stored payload: their review
     * surfaces are built in later phases and inventing required fields for them
     * here would silently hide correctly-authored content.
     *
     * An unrecognised type is NOT renderable — a record from a newer release
     * must not be poured into a card this build does not know how to draw.
     */
    const RENDERABLE = {
        vocab: d => !!(d && d.quiz),
        gram:  d => !!d,
        phon:  d => !!d,
        coll:  d => !!d
    };

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

    // Single source of truth for key normalisation lives in migrations.js, so
    // the migration and the runtime can never disagree about what key a word
    // gets. The fallback is an exact copy for the degraded case where a script
    // reorder leaves migrations.js unloaded.
    function normRef(ref) {
        if (global.Migrations && typeof global.Migrations.srsRef === 'function') {
            return global.Migrations.srsRef(ref);
        }
        return String(ref == null ? '' : ref).trim().toLowerCase().replace(/\s+/g, '-');
    }

    function typedKey(type, ref) {
        if (global.Migrations && typeof global.Migrations.srsTypedKey === 'function') {
            return global.Migrations.srsTypedKey(type, ref);
        }
        const t = String(type == null ? '' : type).trim().toLowerCase();
        const r = normRef(ref);
        if (!r) return '';
        return (TYPES.indexOf(t) === -1 ? DEFAULT_TYPE : t) + ':' + r;
    }

    const SRS = {
        records: {},

        // Exposed so the UI and the tests reference the policy constant rather
        // than repeating the number 20.
        DAILY_REVIEW_CAP: DAILY_REVIEW_CAP,
        TYPES: TYPES,
        PROJECTORS: PROJECTORS,
        RENDERABLE: RENDERABLE,

        /**
         * Normalize a reference into a stable, case-insensitive key fragment.
         * Kept as the BARE ref (no type prefix) because it is also how legacy
         * records were keyed, so it stays the lookup of last resort.
         */
        _key(word) {
            return normRef(word);
        },

        /** `type:ref` — the key a record is actually stored under. */
        _typedKey(type, ref) {
            return typedKey(type, ref);
        },

        /**
         * Accept any of the three shapes a caller may hold and return a common
         * `{ type, ref, data }`:
         *   - a bare string                -> vocab, no payload
         *   - `{ srsType, srsRef, ... }`   -> an explicitly typed item
         *   - `{ word, ... }`              -> legacy vocabulary object
         *
         * Anything else returns null. The old code fell through to
         * `String(obj)` === "[object object]", which collapsed every grammar
         * point and phoneme pair onto ONE shared record — silent data loss.
         * Refusing an item we cannot identify is the honest alternative.
         */
        _normalizeItem(item, typeHint) {
            if (item == null) return null;

            if (typeof item === 'string' || typeof item === 'number') {
                const ref = normRef(item);
                return ref ? { type: typeHint || DEFAULT_TYPE, ref: ref, data: null } : null;
            }

            if (typeof item !== 'object') return null;

            const hasWord = typeof item.word === 'string';
            const explicitRef = (item.srsRef !== undefined && item.srsRef !== null)
                ? item.srsRef
                : (hasWord ? item.word : null);

            if (explicitRef === null || normRef(explicitRef) === '') return null;

            // `item.type` is only trusted when the item is NOT a plain vocabulary
            // object. A rich vocabulary entry may well carry `type: 'noun'` (part
            // of speech) or, worse, a value that happens to collide with one of
            // OUR type names, and reading that as an SRS type would file the word
            // under the wrong strand.
            const explicitType = item.srsType || typeHint ||
                ((item.srsRef !== undefined || !hasWord) ? item.type : undefined);

            return {
                type: TYPES.indexOf(String(explicitType).toLowerCase()) === -1
                    ? DEFAULT_TYPE
                    : String(explicitType).toLowerCase(),
                ref: normRef(explicitRef),
                data: item
            };
        },

        /** The type a stored record belongs to: its own field, then its key. */
        _recordType(rec, key) {
            const own = rec && rec.type;
            if (typeof own === 'string' && TYPES.indexOf(own) !== -1) return own;
            const colon = typeof key === 'string' ? key.indexOf(':') : -1;
            if (colon > 0) {
                const prefix = key.slice(0, colon);
                if (TYPES.indexOf(prefix) !== -1) return prefix;
                return prefix;              // unknown type: reported honestly
            }
            // A bare key is a pre-migration vocabulary record.
            return DEFAULT_TYPE;
        },

        /** Is this record showable to the learner right now? */
        _isRenderable(rec, key) {
            const type = this._recordType(rec, key);
            const predicate = RENDERABLE[type];
            if (!predicate) return false;   // unknown type: fail closed
            return predicate(rec && rec.data);
        },

        /** Current time in ms. Wrapped so it is easy to stub in tests. */
        _now() {
            return Date.now();
        },

        /**
         * Load persisted records from localStorage, migrating legacy bare-word
         * keys on the way in.
         *
         * The migration is delegated to js/core/migrations.js and is gated on
         * SHAPE, not on a counter, so calling load() twice is a no-op. If
         * migrations.js is not present the records are used exactly as found —
         * this never rewrites storage blind.
         */
        load() {
            let parsed = null;
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                parsed = raw ? JSON.parse(raw) : null;
            } catch (e) {
                // Corrupt or unavailable storage — start clean rather than crash.
                this.records = {};
                return this.records;
            }

            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                this.records = {};
                return this.records;
            }

            if (global.Migrations && typeof global.Migrations.migrateSrsData === 'function') {
                try {
                    const result = global.Migrations.migrateSrsData(parsed);
                    this.records = result.records || {};
                    this._migrated = true;
                    // Persist so the rewrite happens once rather than on every
                    // load. Only when something actually changed, so a normal
                    // load performs no write at all.
                    if (result.changed) this.save();
                } catch (e) {
                    // A failed migration must not cost the learner their data:
                    // use it as found and leave storage untouched.
                    this.records = parsed;
                    if (global.AppErrorHandler && typeof global.AppErrorHandler.logError === 'function') {
                        global.AppErrorHandler.logError(e, 'SRS migrate');
                    }
                }
            } else {
                this.records = parsed;
            }

            return this.records;
        },

        /**
         * Explicit bootstrap. srs.js also calls load() at parse time so that a
         * caller which never calls init() still works, but that parse-time call
         * has a hard ordering dependency on migrations.js having been loaded
         * first. init() is the supported entry point: call it from bootstrap and
         * the migration is guaranteed to have run whatever the script order.
         *
         * Idempotent, and it will not clobber in-memory state that has already
         * been migrated.
         */
        init() {
            if (!this._migrated) this.load();
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

        /**
         * Resolve any of the three ways a caller might name an item to the key
         * it is actually stored under, WITHOUT creating anything:
         *   1. an exact key            (`vocab:happy`)
         *   2. the typed key for a ref (`happy`  -> `vocab:happy`)
         *   3. the bare legacy key     (`happy`) — a record that predates the
         *      typed-key migration and has not been through load() yet.
         * Returns null when the item is not in the store.
         */
        _findKey(item, type) {
            const norm = this._normalizeItem(item, type);
            const ref = norm ? norm.ref : normRef(item);
            if (!ref) return null;

            if (typeof item === 'string' && Object.prototype.hasOwnProperty.call(this.records, item)) {
                return item;
            }
            const typed = typedKey(norm ? norm.type : (type || DEFAULT_TYPE), ref);
            if (typed && Object.prototype.hasOwnProperty.call(this.records, typed)) return typed;
            if (Object.prototype.hasOwnProperty.call(this.records, ref)) return ref;
            return null;
        },

        /**
         * Move a legacy bare-keyed record onto its typed key, in place.
         *
         * The bulk migration in migrations.js does this at load time; this is the
         * write-path safety net for a record that reached memory without it —
         * a script-order mistake, a direct `SRS.records = {...}` assignment, or
         * an import that bypassed load(). Without it, writing to `vocab:happy`
         * while `happy` still existed would fork one item into two schedules.
         */
        _adoptLegacy(typed, ref) {
            if (typed === ref) return;
            if (Object.prototype.hasOwnProperty.call(this.records, typed)) return;
            if (!Object.prototype.hasOwnProperty.call(this.records, ref)) return;
            this.records[typed] = this.records[ref];
            delete this.records[ref];
        },

        getRecord(item, type) {
            const key = this._findKey(item, type);
            return key ? (this.records[key] || null) : null;
        },

        /**
         * Was the most recent recorded outcome for this item self-judged?
         * Records written before FR-SRS-5 carry no flag at all; the absent
         * field reads as `false` — "not self-reported" — which is correct,
         * because every outcome written by the old code was a graded one.
         */
        isSelfReported(item, type) {
            const rec = this.getRecord(item, type);
            return !!(rec && rec.selfReported);
        },

        /**
         * Update an item's review schedule based on the answer.
         *
         * @param {Object|string} item - A vocabulary object ({ word, pronunciation,
         *        definition, example, quiz, ... }), a bare string, or an explicitly
         *        typed item ({ srsType: 'gram', srsRef: 'present-perfect', ... }).
         *        The two-argument vocabulary call is unchanged, so every existing
         *        call site keeps its exact behaviour.
         * @param {boolean} correct - Whether the learner answered correctly.
         * @param {Object} [opts] - { selfReported: true } for a learner- or
         *        recogniser-judged outcome. Omitting it means "graded", so every
         *        existing two-argument call site keeps its exact behaviour.
         *        { type: 'gram' } sets the type for an untyped item.
         * @returns {Object|null} The updated record, or null for an unkeyable item.
         */
        schedule(item, correct, opts) {
            const norm = this._normalizeItem(item, opts && opts.type);
            if (!norm) return null;

            const key = typedKey(norm.type, norm.ref);
            if (!key) return null;

            const selfReported = !!(opts && opts.selfReported);

            // Adopt a pre-migration record for this same item rather than
            // starting a second schedule alongside it.
            this._adoptLegacy(key, norm.ref);

            const now = this._now();
            const rec = this.records[key] || {
                key: key,
                type: norm.type,
                ref: norm.ref,
                // Kept for backwards compatibility: older code and the export
                // format both read `rec.word`.
                word: (norm.data && norm.data.word) || norm.ref,
                reps: 0,
                interval: 0,
                ease: DEFAULT_EASE,
                lapses: 0,
                due: now,
                lastReviewed: null,
                createdAt: now
            };

            // Backfill identity on a record that predates it (migrated or adopted).
            if (rec.key === undefined) rec.key = key;
            if (rec.type === undefined) rec.type = norm.type;
            if (rec.ref === undefined) rec.ref = norm.ref;

            // Keep the item's payload so review works fully offline without
            // re-hitting the dictionary API. Projected per type — see PROJECTORS.
            if (norm.data && typeof norm.data === 'object') {
                rec.data = this._project(norm.type, norm.data);
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
         * Explicitly typed form, for the non-vocabulary callers that arrive with
         * a type and a reference rather than a word object.
         */
        scheduleItem(type, ref, data, correct, opts) {
            const payload = Object.assign({}, data || {}, { srsType: type, srsRef: ref });
            return this.schedule(payload, correct, opts);
        },

        /**
         * Copy the fields PROJECTORS declares for this type, and nothing else.
         * A declared-but-absent field is copied as `undefined` for `vocab` only,
         * so the stored shape is byte-for-byte what the old inline whitelist
         * produced; other types omit absent fields.
         */
        _project(type, source) {
            const fields = PROJECTORS[type] || PROJECTORS[DEFAULT_TYPE];
            const out = {};
            fields.forEach(function (f) {
                if (type === DEFAULT_TYPE || source[f] !== undefined) out[f] = source[f];
            });
            return out;
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
         * Every due, renderable record, most-overdue first. Internal: callers get
         * payload copies from getDueWords / getAllDueWords / getDue, never records.
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
         *
         * Renderability is per type now, not a hardcoded `data.quiz` test, which
         * is what lets grammar points and phoneme pairs be represented at all.
         * For `vocab` the predicate is exactly the old test, so the vocabulary
         * review flow is unchanged.
         *
         * @param {string} [type] - restrict to one item type; omit for all types.
         */
        _dueRecords(type) {
            const now = this._now();
            const self = this;
            return Object.keys(this.records)
                .map(k => ({ key: k, rec: this.records[k] }))
                .filter(function (e) {
                    const r = e.rec;
                    if (!r || !(r.due <= now)) return false;
                    if (type && self._recordType(r, e.key) !== type) return false;
                    return self._isRenderable(r, e.key);
                })
                .map(e => e.rec)
                .sort((a, b) => (a.due - b.due) || ((b.lapses || 0) - (a.lapses || 0)));
        },

        /** Normalize a cap argument: a non-negative finite number, else the policy cap. */
        _cap(limit) {
            return (typeof limit === 'number' && isFinite(limit) && limit >= 0)
                ? limit
                : DAILY_REVIEW_CAP;
        },

        /**
         * The general, typed review queue: renderable, oldest-due-first, capped.
         * Returns `{ type, ref, key, data }` items rather than bare payloads, so
         * a caller always knows which kind of card to draw. Vocabulary callers
         * should keep using getDueWords(), whose shape is unchanged.
         *
         * With no `type`, types are INTERLEAVED round-robin rather than globally
         * sorted. A global oldest-first sort would happily fill all 20 slots with
         * vocabulary and starve grammar and pronunciation, defeating
         * docs/CURRICULUM.md §3 ("every session touches at least three strands").
         * Within each type the order is still strict oldest-due-first, so nothing
         * starves inside a strand either.
         *
         * @param {string} [type] - one of SRS.TYPES, or null/undefined for all.
         * @param {Object} [opts] - { limit } to override the cap.
         */
        getDue(type, opts) {
            const cap = this._cap(opts && opts.limit);
            const self = this;
            const wrap = function (r) {
                return {
                    type: self._recordType(r, r && r.key),
                    ref: r && r.ref !== undefined ? r.ref : normRef(r && r.word),
                    key: r && r.key,
                    data: Object.assign({}, r && r.data)
                };
            };

            if (type) return this._dueRecords(type).slice(0, cap).map(wrap);

            // Round-robin across the types that actually have something due, in
            // the declared TYPES order so the sequence is stable across calls.
            const queues = TYPES.map(t => self._dueRecords(t)).filter(q => q.length > 0);
            const out = [];
            let i = 0;
            while (out.length < cap) {
                let placed = false;
                for (let q = 0; q < queues.length; q++) {
                    if (i < queues[q].length) {
                        out.push(wrap(queues[q][i]));
                        placed = true;
                        if (out.length >= cap) break;
                    }
                }
                if (!placed) break;
                i++;
            }
            return out;
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
            return this._dueRecords(DEFAULT_TYPE)
                .slice(0, this._cap(limit))
                .map(r => Object.assign({}, r.data));
        },

        /** Every due word, ignoring the cap. For dashboards and diagnostics. */
        getAllDueWords() {
            return this._dueRecords(DEFAULT_TYPE).map(r => Object.assign({}, r.data));
        },

        /**
         * The number of items the learner will actually be asked to review, i.e.
         * the size of the capped queue. This is deliberately the capped figure,
         * not the honest backlog: the badge it feeds ("Review Due (N)") is a
         * promise about how long the session is, and it must equal
         * getDueWords().length or pressing it contradicts it. Showing "347" is
         * exactly the wall of work FR-SRS-4 exists to prevent. The honest total
         * is still available, unrounded, via totalDueCount() / deferredCount()
         * / stats().
         *
         * DEFAULTS TO `vocab`, deliberately, and not because vocabulary is
         * special: review mode (app.js startReview) walks getDueWords(), which is
         * vocabulary-only. A badge counting grammar and phoneme items would
         * promise a session longer than the one the button opens — the same trust
         * bug as a false "Perfect!". When review mode learns to walk getDue(),
         * this default moves to all-types IN THE SAME COMMIT.
         *
         * @param {string|null} [type] - a type, or null for every type.
         */
        dueCount(type) {
            const t = arguments.length === 0 ? DEFAULT_TYPE : type;
            return t ? this._dueRecords(t).slice(0, DAILY_REVIEW_CAP).length
                     : this.getDue(null).length;
        },

        /**
         * Every due AND renderable item, cap ignored. "Actionable": work that
         * exists and could be shown, as opposed to stats().due which counts work
         * that exists at all (including records with no showable payload).
         */
        countDue(type) {
            return this._dueRecords(type).length;
        },

        /** The honest total that is due now, cap ignored. Alias of countDue. */
        totalDueCount(type) {
            return this.countDue(type);
        },

        /** How many due items are waiting behind the cap. */
        deferredCount(type) {
            return Math.max(0, this.totalDueCount(type) - DAILY_REVIEW_CAP);
        },

        /**
         * `dueCount() <= actionable <= due` holds by construction: the badge is a
         * capped subset of the actionable queue, which is a subset of everything
         * that is due.
         *
         * @param {string} [type] - restrict every figure to one item type.
         */
        stats(type) {
            const now = this._now();
            const self = this;
            const keys = Object.keys(this.records).filter(function (k) {
                return !type || self._recordType(self.records[k], k) === type;
            });
            const all = keys.map(k => this.records[k]).filter(r => !!r);
            return {
                total: all.length,
                due: all.filter(r => r.due <= now).length,
                // Due and showable. The gap between this and `due` is records
                // whose payload cannot be rendered — never silently hidden.
                actionable: this.countDue(type),
                // What today's session actually holds, and what it is holding back.
                queued: this.dueCount(type || DEFAULT_TYPE),
                deferred: this.deferredCount(type),
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

    // Parse-time load, kept so a caller that never reaches init() still works.
    // SRS.init() is the supported entry point — see its comment.
    SRS.load();

    // Expose globally (matches the pattern of the other core modules) and
    // support CommonJS for the test suite.
    global.SRS = SRS;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SRS;
    }
// `globalThis`, not `this`. Under CommonJS a bare top-level `this` is
// `module.exports`, so the old `: this` fallback meant that when Jest or a node
// script require()d this file, `global.Migrations` / `global.AppErrorHandler`
// resolved against an empty object and were silently always undefined — i.e. the
// legacy-key migration would never have run under test. levels.js and
// migrations.js already use globalThis; this brings srs.js in line.
})(typeof window !== 'undefined' ? window : globalThis);
