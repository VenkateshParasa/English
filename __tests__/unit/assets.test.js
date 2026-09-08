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
