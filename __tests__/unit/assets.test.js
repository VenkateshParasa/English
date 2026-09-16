/**
 * Asset manifest guard.
 *
 * service-worker.js precaches STATIC_ASSETS with cache.addAll(), which is
 * all-or-nothing: a single missing path rejects the whole install and the app
 * silently loses offline support. Nothing in the app surfaces that failure —
 * it is logged to the console and swallowed (service-worker.js:40-42).
 *
 * These are plain Node checks over the repo, not browser tests. They are the
 * cheapest possible defence against the class of bug where someone adds a
 * <script> tag and forgets the service worker.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const indexHtml = read('index.html');
const swSource = read('service-worker.js');

/** Local (non-URL) src/href values referenced by index.html. */
function localRefs(source) {
    const refs = [];
    const re = /<(?:script|link)\b[^>]*?(?:src|href)\s*=\s*"([^"]+)"/gi;
    let m;
    while ((m = re.exec(source)) !== null) {
        const ref = m[1].trim();
        if (/^(https?:)?\/\//i.test(ref)) continue;   // CDN / preconnect
        if (ref.startsWith('data:') || ref.startsWith('#')) continue;
        refs.push(ref);
    }
    return refs;
}

/** STATIC_ASSETS entries, parsed out of the service worker source. */
function staticAssets(source) {
    const block = source.match(/const\s+STATIC_ASSETS\s*=\s*\[([\s\S]*?)\]/);
    if (!block) throw new Error('Could not find STATIC_ASSETS in service-worker.js');
    return (block[1].match(/'([^']+)'|"([^"]+)"/g) || [])
        .map(s => s.slice(1, -1));
}

/** '/js/core/srs.js', 'js/core/srs.js' and './js/core/srs.js' are one file. */
const norm = p => p.replace(/^\.?\//, '');

const refs = localRefs(indexHtml);
const assets = staticAssets(swSource);
const assetSet = new Set(assets.map(norm));

describe('index.html references', () => {
    it('finds the expected scripts and stylesheets', () => {
        // Sanity check on the parser itself, so a regex bug cannot make the
        // interesting assertions below vacuously pass.
        expect(refs).toContain('app.js');
        expect(refs).toContain('styles.css');
        expect(refs.length).toBeGreaterThan(5);
    });

    it.each(refs)('%s exists on disk', ref => {
        expect(fs.existsSync(path.join(ROOT, norm(ref)))).toBe(true);
    });

    it.each(refs)('%s is precached by the service worker', ref => {
        // No exceptions: every local file index.html pulls in is part of the
        // app shell and must survive going offline.
        expect(assetSet.has(norm(ref))).toBe(true);
    });
});

describe('service worker STATIC_ASSETS', () => {
    it.each(staticAssets(swSource).filter(a => a !== '/'))(
        '%s exists on disk',
        asset => {
            // '/' is the navigation request, not a file.
            expect(fs.existsSync(path.join(ROOT, norm(asset)))).toBe(true);
        }
    );

    it('has no duplicate entries', () => {
        const normalized = assets.map(norm);
        expect(normalized).toHaveLength(new Set(normalized).size);
    });

    it('includes the offline fallback page', () => {
        expect(assetSet.has('offline.html')).toBe(true);
    });
});

/**
 * Cache-name guard (US-408).
 *
 * activate() deletes every `english-portal-*` cache that is not one of the named
 * constants. A new cache added without a matching line in that filter is deleted
 * the moment the worker activates — so the feature works until the next reload
 * and then silently stops, which is the worst version of this bug to debug.
 * MEDIA_CACHE is the fourth such constant and the first one whose contents cost
 * the learner mobile data to replace.
 */
describe('service worker cache names', () => {
    /** Every `const X_CACHE = '...'` in the worker. */
    function cacheConstants(source) {
        const out = {};
        const re = /const\s+([A-Z_]*CACHE[A-Z_]*)\s*=\s*'([^']+)'/g;
        let m;
        while ((m = re.exec(source)) !== null) out[m[1]] = m[2];
        return out;
    }

    const names = cacheConstants(swSource);
    const activate = swSource.slice(swSource.indexOf("addEventListener('activate'"),
                                   swSource.indexOf("addEventListener('fetch'"));

    it('declares the caches this worker uses', () => {
        // Sanity check on the parser, so the assertions below cannot pass vacuously.
        expect(Object.keys(names).sort()).toEqual(
            ['API_CACHE', 'CACHE_NAME', 'DYNAMIC_CACHE', 'MEDIA_CACHE', 'STATIC_CACHE']);
    });

    it('gives every cache a distinct name', () => {
        const values = Object.values(names);
        expect(values).toHaveLength(new Set(values).size);
    });

    it.each(Object.keys(names).filter(n => n !== 'CACHE_NAME'))(
        '%s survives activate()',
        constant => {
            // CACHE_NAME is the unused v1.0.2 legacy constant and is deliberately
            // NOT exempted from cleanup.
            expect(activate).toContain('cacheName !== ' + constant);
        });

    it('still prefixes every cache with english-portal-, or cleanup misses it', () => {
        expect(activate).toContain("cacheName.startsWith('english-portal-')");
        Object.values(names).forEach(value => {
            expect(value.startsWith('english-portal-')).toBe(true);
        });
    });
});
