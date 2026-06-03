# Deutsch MiMeo → Installable PWA — Design Spec

**Date:** 2026-06-03
**Status:** Design approved; pending implementation plan
**Scope:** Make the app an installable PWA with an offline-capable shell.

## Context & motivation

The question that started this was *"should we make the app a PWA since the assets are large?"* Investigation showed that premise mostly does **not** hold:

- The app shell (all JS + CSS) is **~493 KB gzipped**, already route-split, and served by Cloudflare with immutable cache headers — repeat daily visits already hit the browser HTTP cache. A PWA does **not** reduce first-load bytes.
- The genuinely large assets are the Piper TTS voice models (**~60 MiB each**), but `piper-tts-web` **already caches them in OPFS** (see `src/lib/sounds.ts` → `evictStalePiperOpfsEntries` / `OPFS_CACHE_VERSION`). They download once per browser regardless of a service worker.

So the value of going PWA here is **not byte savings**. It is:

1. **Installability** — home-screen icon, standalone window, app-like launch. The real draw for a daily two-person habit tracker.
2. **Offline-capable app shell** — the UI loads without network (data still needs Supabase).

Approved decisions:
- Build a **full installable PWA**.
- **Rely on native OS install** — no custom install button/banner.
- **Prompt-to-reload** updates — no silent auto-reload (would be jarring mid-video / mid-listening-exercise).

## Goals & non-goals

### Goals
- Valid manifest + icons + service worker; passes browser installability criteria (Android install prompt, iOS "Add to Home Screen").
- Offline app shell: launching the installed app offline renders the UI (no white screen); precached routes navigate.
- Correct update mechanism that **reuses the existing in-header update button**.

### Non-goals (explicit — prevent scope creep)
- No offline data or sync. Supabase stays online-only; data views show their existing loading/empty/error states when offline.
- No reduction of first-load bytes (separate concern, not this work).
- No custom install UI (button/banner). Native OS affordances only.
- No SW caching of the voice models — OPFS already owns them; duplicating wastes storage.
- No dedicated offline fallback page.

## Approach

Use **`vite-plugin-pwa`** in Workbox **`generateSW`** mode, `registerType: 'prompt'`.

Alternatives considered:
- **Hand-rolled SW + static manifest** — rejected: maintaining a revision-aware precache list for hashed filenames by hand reinvents Workbox and is bug-prone.
- **`injectManifest` mode** — held as fallback if we later need custom SW logic; `generateSW` covers our needs (precache + one runtime rule + nav fallback) declaratively.

### Integration risk — front-load this
`vite-plugin-pwa` and `@cloudflare/vite-plugin` both hook the Vite build; CF does a multi-environment build (client → `dist/client`, worker → `dist/deutsch_mimeo`). **The first implementation step is a smoke test:** confirm `pnpm build` emits `dist/client/sw.js` + `dist/client/manifest.webmanifest` + the registration script. If the plugins conflict, fall back to `injectManifest` mode or a hand-rolled SW. Everything downstream depends on this, so verify before building on top.

## Detailed design

### 1. Service worker config (`vite.config.ts`)
Add `VitePWA({...})` to the `plugins` array (after `react()`; position relative to `cloudflare()` to be settled by the smoke test). Shape:

```ts
VitePWA({
  registerType: 'prompt',
  devOptions: { enabled: false },
  manifest: { /* see §3 */ },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net',
        handler: 'CacheFirst',
        options: {
          cacheName: 'jsdelivr-wasm',
          expiration: { maxEntries: 20, maxAgeSeconds: 31536000 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})
```

Notes:
- `devOptions.enabled: false` keeps the SW out of `pnpm dev` so it cannot interfere with the `serveVoices` middleware or HMR.
- The existing `dropOnnxRuntimeWasm` plugin deletes `ort-wasm*.wasm` from the bundle, so those files are **not** in the precache manifest — they are fetched from jsDelivr at runtime and handled by the runtime rule above.

### 2. Caching matrix
| Asset | Strategy |
|---|---|
| Hashed JS/CSS/HTML + icons (`dist/client`) | Precache (Workbox) |
| `cdn.jsdelivr.net` ORT + piper-phonemize WASM/`.data` | Runtime CacheFirst (1 year) |
| `*.supabase.co` (all data) | Network only (no rule) |
| `/api/listening/generate` (Worker → Gemini) | Network only + nav denylist |
| `raw.githubusercontent.com` voices (~60 MiB) | **Not** cached by SW — OPFS owns them |
| YouTube iframe / player | Network only |

### 3. Manifest
- `name`: `"Deutsch MiMeo"`
- `short_name`: `"MiMeo"`
- `start_url`: `"/"`
- `display`: `"standalone"`
- `theme_color`: `"#0d0f14"` (matches existing `<meta name="theme-color">`)
- `background_color`: `"#0d0f14"`
- `icons`: 192 (`any`), 512 (`any`), 512 (`maskable`)

### 4. Icons
Source: `public/favicon.svg` (purple `#863bff` lightning bolt, transparent background). Generate via a one-off `sharp`-based script (`scripts/gen-icons.mjs`) and commit the PNGs to `public/`:
- `pwa-192x192.png` — purpose `any`
- `pwa-512x512.png` — purpose `any`
- `pwa-maskable-512x512.png` — bolt centered on solid `#0d0f14` with ~20% safe-zone padding (maskable spec)
- `apple-touch-icon.png` — 180×180, bolt on solid background (iOS ignores transparency & maskable)

### 5. `index.html` additions
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`
- `<meta name="apple-mobile-web-app-capable" content="yes" />` (plus `mobile-web-app-capable` for modern Chrome)
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />` (pairs with the existing `viewport-fit=cover`)
- `<meta name="apple-mobile-web-app-title" content="Deutsch MiMeo" />`
- Existing `theme-color` stays. The `manifest.webmanifest` link + SW registration are injected by the plugin.

### 6. Update flow — rewrite `src/hooks/useUpdateAvailable.ts`
**Current:** polls `/index.html` every 5 min + on `visibilitychange`, diffs the main `<script src>`, returns `boolean`. `AppHeader` shows a green `UpdateIcon` button → `window.location.reload()`.

**New:**
- Wrap `useRegisterSW()` from `virtual:pwa-register/react`.
- Return `{ updateAvailable, applyUpdate }` where `updateAvailable = needRefresh[0]` (the React hook exposes `needRefresh` as a `[boolean, setter]` tuple) and `applyUpdate = () => updateServiceWorker(true)` (skipWaiting + reload).
- In `onRegisteredSW(swUrl, r)`, set a 5-min interval + a `visibilitychange` listener calling `r?.update()` to mirror today's detection cadence.
- Delete the old `index.html`-polling implementation.

**`AppHeader.tsx`:**
- `const { updateAvailable, applyUpdate } = useUpdateAvailable()`
- Button `onClick={applyUpdate}` (was `window.location.reload()`). Icon, tooltip, and i18n key `header.updateAvailable` unchanged.

### 7. TypeScript
There is no `src/vite-env.d.ts`; `import.meta.env` types resolve via `tsconfig.app.json`. Add `"vite-plugin-pwa/react"` to `compilerOptions.types` in `tsconfig.app.json` (confirm `"vite/client"` is present too) so `virtual:pwa-register/react` resolves. Alternative: create `src/vite-env.d.ts` with the triple-slash references — pick whichever matches the setup found during implementation.

### 8. Worker
**No change.** `worker/index.ts` routes only `POST /api/listening/generate` and falls through to `env.ASSETS.fetch` for everything else — so `sw.js`, `manifest.webmanifest`, `registerSW.js`, and icons serve as static assets. The `navigateFallbackDenylist` is belt-and-suspenders (the API is POST; navigation requests are GET).

### 9. Conventions (per CLAUDE.md)
- `src/lib/changelog.ts`: new entry, `type: 'feature'`, ~60-char English `text` (e.g. *"Installable PWA with offline app shell"*), `date` = today, new version block.
- `src/lib/appVersion.ts`: bump `APP_VERSION` in lockstep with the new block.

## Offline behavior (expected)
- Installed app launched offline: shell renders, precached routes navigate.
- Data-dependent views (stats / videos / compare): existing React Query loading/empty/error states (Supabase unreachable).
- Listening generation & YouTube: fail gracefully as they do today.
- No special offline page.

## Verification / acceptance
1. `pnpm build` succeeds with both plugins; `dist/client/` contains `sw.js` + `manifest.webmanifest` + icon PNGs. **(Gates everything — do first.)**
2. `pnpm preview` (wrangler dev): app loads; SW registers (DevTools → Application → Service Workers).
3. Lighthouse "Installable" / PWA checks pass; manifest valid; icons resolve.
4. Offline (DevTools offline, reload): app shell renders, no white screen.
5. `/api/listening/generate` still reaches the Worker (listening challenge works online).
6. TTS still works (OPFS voice load unaffected; jsDelivr WASM served from SW cache on 2nd load).
7. Update button: simulate a new build (changed asset hash) → green button appears → click → reloads into new build.
8. `pnpm typecheck` and `pnpm lint` are green.

## Files touched
- `package.json` — add `vite-plugin-pwa` (devDependency)
- `vite.config.ts` — `VitePWA(...)`
- `index.html` — apple-touch-icon link + apple meta tags
- `public/` — generated icon PNGs
- `scripts/gen-icons.mjs` — one-off icon generator
- `src/hooks/useUpdateAvailable.ts` — rewrite over `useRegisterSW`
- `src/components/AppHeader.tsx` — wire button to `applyUpdate`
- `tsconfig.app.json` — PWA virtual-module types
- `src/lib/changelog.ts`, `src/lib/appVersion.ts` — changelog entry + version bump
