# Netlify Deployment Guide — English Learning Portal

This project is a **static Progressive Web App (PWA) with no build step**. It ships
plain HTML/CSS/JS served directly from the repository root. This guide covers the
exact settings to configure in Netlify and the compatibility notes behind them.

---

## 1. TL;DR — Netlify site settings

| Setting | Value |
|---|---|
| **Build command** | *(leave empty)* |
| **Publish directory** | `.` (repository root) |
| **Base directory** | *(leave empty)* |
| **Functions directory** | *(none — no serverless functions)* |
| **Node version** | Not required (no build). Optional: `NODE_VERSION` unset. |
| **Environment variables** | None required |

Most of this is already declared in [`netlify.toml`](./netlify.toml), so a Git-based
deploy needs **zero manual configuration** in the UI. The table above is what those
fields will (and should) resolve to.

---

## 2. Recommended deploy method — Git integration

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
3. Netlify auto-detects `netlify.toml`. Confirm:
   - Build command: **empty**
   - Publish directory: **`.`**
4. Click **Deploy**.

Because deploys come from Git, only committed files ship. `node_modules/`,
`coverage/`, `__tests__/`, and `docs/` are `.gitignore`d and will **not** be
deployed.

### Alternative — Netlify CLI

```bash
npm i -g netlify-cli   # or use npx
netlify deploy         # draft/preview deploy
netlify deploy --prod  # production deploy
```

> ⚠️ **CLI caveat:** `netlify deploy` uploads the `publish` directory as-is from your
> local disk. Locally, `node_modules/` exists and would be uploaded unless excluded.
> The `netlify.toml` `publish = "."` plus `.gitignore` does **not** filter CLI uploads.
> **Prefer Git-based deploys.** If you must use the CLI, run it from a clean checkout
> or ensure `node_modules/` is absent.

---

## 3. What `netlify.toml` already configures

You do **not** need to set these in the UI — they live in [`netlify.toml`](./netlify.toml):

### Publish / build
- `publish = "."`, `command = ""` — static, no build.

### Redirects
- `/favicon.ico` → `/icons/icon-32x32.png` (status 200) — avoids the implicit favicon 404.

### Security headers (all routes)
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), camera=(), microphone=()`
- `X-XSS-Protection: 1; mode=block`

### Caching
| Path | Cache-Control | Why |
|---|---|---|
| `/service-worker.js` | `max-age=0, must-revalidate` | Never cache the SW — clients must always get updates. |
| `/manifest.json` | `max-age=0, must-revalidate` | PWA metadata updates propagate immediately. |
| `/index.html`, `/offline.html` | `max-age=0, must-revalidate` | New deploys picked up instantly. |
| `*.css`, `*.js` | `max-age=0, must-revalidate` | Filenames aren't content-hashed, so revalidate (cheap 304s via ETag). |
| `/icons/*` | `max-age=31536000, immutable` | Icons are stable; cache for a year. |

---

## 4. Domain, HTTPS & PWA

- **HTTPS:** Netlify provisions a free Let's Encrypt certificate automatically.
  HTTPS is **required** for the service worker and PWA install to work — no action
  needed beyond using the default Netlify domain or attaching a custom one.
- **Custom domain:** Site settings → **Domain management** → add domain → follow DNS
  instructions. Enable **Force HTTPS** once the cert is issued.
- **Service worker scope:** `service-worker.js` is at the site root and registers with
  scope `/`, which matches the app. No path adjustments needed.

---

## 5. Content Security Policy note

The CSP is currently delivered via a `<meta http-equiv="Content-Security-Policy">` tag
in `index.html`. It allows exactly what the app uses:
- `connect-src`: `'self'` + `https://api.dictionaryapi.dev` (dictionary lookups)
- `style-src` / `font-src`: Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`)
- everything else falls back to `default-src 'self'` (icons, scripts, the service worker).

**Optional hardening:** For stronger enforcement you can move the CSP into
`netlify.toml` as a real `Content-Security-Policy` response header (meta-tag CSP can't
use directives like `frame-ancestors`). Not required for a working deploy.

---

## 6. Compatibility re-check summary

| Check | Result |
|---|---|
| Static site, no build required | ✅ `publish = "."`, no command |
| All asset paths resolve (icons, CSS, JS, manifest) | ✅ Verified — full icon set generated under `/icons` |
| File-name **case sensitivity** (Linux vs macOS) | ✅ All references match on-disk case exactly |
| Only external host is `api.dictionaryapi.dev` + Google Fonts | ✅ Covered by CSP |
| No hardcoded `localhost` / `http://` resource URLs | ✅ (only a runtime dev-env check in `error-handler.js`) |
| Service worker registers at root scope over HTTPS | ✅ |
| Offline fallback (`offline.html`) present & precached | ✅ |
| `favicon.ico` request | ✅ Redirected to PNG (no 404) |
| `robots.txt` | ✅ Added (allow all) |
| `node_modules` / tests / docs excluded from deploy | ✅ via `.gitignore` |

---

## 7. Post-deploy verification checklist

After the first production deploy, confirm:

- [ ] Site loads over **HTTPS** with a valid certificate.
- [ ] DevTools → **Application → Manifest**: no icon errors, "installable".
- [ ] DevTools → **Application → Service Workers**: registered and activated.
- [ ] DevTools → **Network**: no 404s (check icons, CSS, JS, `favicon.ico`).
- [ ] Toggle **Offline** in DevTools and reload → `offline.html` (or cached app) shows.
- [ ] **Lighthouse** PWA + Best Practices audit passes.
- [ ] Response headers include the security headers from §3 (Network tab → any request).
- [ ] Dictionary lookups work (a request to `api.dictionaryapi.dev` succeeds, not CSP-blocked).

---

## 8. Files relevant to deployment

| File | Purpose |
|---|---|
| `netlify.toml` | Publish dir, redirects, headers, caching |
| `manifest.json` | PWA manifest (icons, shortcuts) |
| `service-worker.js` | Offline caching + update handling |
| `offline.html` | Offline fallback page |
| `robots.txt` | Crawler policy |
| `icons/` | Full generated PWA icon set |
| `.gitignore` | Excludes `node_modules`, `coverage`, `__tests__`, `docs` from the repo/deploy |
