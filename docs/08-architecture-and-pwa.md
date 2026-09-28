# 08 — Architecture, PWA and Offline Strategy

---

## 1. Stack

| Layer | Choice | Why this and not the obvious alternative |
|---|---|---|
| Build | **Vite** | Not Next.js. Next's value is SSR, routing conventions and a server runtime — we have no server, one user, and no SEO. It would add build complexity and bundle weight for nothing. |
| UI | **React 18 + TypeScript** | Not Svelte/Solid, which are technically better fits for this size. React wins on your familiarity and on ecosystem depth for charts and date handling. Being able to debug it at 11pm matters more than 15kb. |
| Styling | **Tailwind + a CSS custom-property token layer** | Tokens in `:root` (per `06 §3`), Tailwind consuming them. Keeps the design system single-sourced. |
| State | **Zustand + pure reducers** | The engine is pure functions (`07 §1`); the store is a thin shell around them. No Redux ceremony, no server-state library (no server). |
| Persistence | **Dexie 4** over IndexedDB | Mature, typed, good migrations, live queries. Hand-rolling IndexedDB is a known-bad idea. |
| Dates | **date-fns + date-fns-tz** | `Temporal` when baseline support is solid; until then date-fns-tz is the correct answer for IANA-aware arithmetic. |
| Charts | **Hand-rolled inline SVG** | For 6 sparklines, a trend line and a radar, a charting library is 60–100kb to draw shapes we can draw in 200 lines with exact control over the design system. |
| PWA | **vite-plugin-pwa** (Workbox) | Manifest, precache, update flow, all configured rather than written. |
| Tests | **Vitest** (engine) + **Playwright** (flows) | Engine tests are pure and fast; Playwright covers install, offline and rollover. |

**Total runtime dependencies: 6.** Target bundle < 200kb gzipped. Everything else is written.

---

## 2. Architecture

```
┌───────────────────────────────────────────────────────┐
│  UI  (React)                                          │
│  screens · components · design tokens                 │
│  reads projections, dispatches intents                │
└──────────────────────┬────────────────────────────────┘
                       │  intent
┌──────────────────────▼────────────────────────────────┐
│  ENGINE   ← 100% pure, zero I/O, zero Date.now()      │
│                                                        │
│   xp.ts          computeXp(event, dayState, config)    │
│   level.ts       levelFor(totalXp)                     │
│   streak.ts      streakFrom(days, graceConfig)         │
│   attributes.ts  attributesFrom(window28)              │
│   quests.ts      generateQuests(date, history, config) │
│   rules.ts       evaluateRules(history) → proposals    │
│   rank.ts        evaluateGates(checkpoints, evidence)  │
│   messages.ts    selectMessage(context, state, log)    │
│   srs.ts         nextReview(outcome, history)          │
│   reduce.ts      applyEvents(events, config) → State   │
└──────────────────────┬────────────────────────────────┘
                       │  events in / state out
┌──────────────────────▼────────────────────────────────┐
│  STORE  (Zustand)   orchestration, clock injection     │
└──────────────────────┬────────────────────────────────┘
┌──────────────────────▼────────────────────────────────┐
│  PERSISTENCE  (Dexie)  events · projections · content  │
└──────────────────────┬────────────────────────────────┘
┌──────────────────────▼────────────────────────────────┐
│  SERVICE WORKER  precache shell · offline nav          │
└───────────────────────────────────────────────────────┘
```

**The engine boundary is the most important line in this diagram.** Nothing in `engine/` may import Dexie, React, or call `Date.now()` — the clock is a parameter. That single constraint is what makes your §42 requirement ("XP, LEVEL, STREAK, QUEST, PROGRESS should be deterministic") mechanically enforceable rather than a hope. It's checkable with an ESLint `no-restricted-imports` rule in CI.

---

## 3. PWA strategy

### 3.1 Manifest

```json
{
  "name": "SYSTEM", "short_name": "SYSTEM",
  "start_url": "/", "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0A0B0D", "theme_color": "#0A0B0D",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512",
      "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Log problem",    "url": "/log/problem" },
    { "name": "Evening review", "url": "/review" }
  ]
}
```

Maskable icons are required for a non-embarrassing Android home-screen icon. The two shortcuts are genuinely useful — long-press the icon, log a problem, never see the home screen.

### 3.2 Install

**Android/Chrome:** `beforeinstallprompt` is captured and surfaced as a single unobtrusive "Install" row on the Profile screen. Never as a popup, never on first launch.

**iOS/Safari:** there is no install prompt API. The app detects iOS Safari + not-standalone and shows a one-time instruction card with the Share → Add to Home Screen steps. **On iOS this is not optional** — an uninstalled PWA has no persistent storage guarantee and no push capability at all.

### 3.3 Service worker

- **Precache** the entire app shell (all JS/CSS/fonts/icons). The app is small enough to fully precache, which means it works offline from first launch onward.
- **Navigation fallback** to `index.html` for all routes.
- **No runtime caching strategy needed** — there are no network requests to cache.
- **Update flow:** `skipWaiting: false`. A new version shows a small "Update available" row that applies on tap. Auto-updating mid-session in an app that's writing to IndexedDB is an unnecessary way to lose an event.

---

## 4. Offline strategy

**The app is not "offline-capable." It is offline. There is no online mode.**

This is a genuine simplification, and it eliminates the entire class of problems your brief asked about:

| Your question | Answer under this architecture |
|---|---|
| Store local actions | All actions are local. |
| Sync when internet returns | Nothing to sync. |
| Handle duplicate sync operations | No sync, but `idem_key` + UUIDv7 make it a no-op if sync is ever added. |
| Background synchronization | Not needed. (Also: unsupported on Safari, and Periodic Background Sync is Chromium-only.) |
| Conflict resolution | No second writer. |

**What replaces sync, and what you give up.** The risk is device loss: your phone is the only copy. Mitigations, in order of importance:

1. `navigator.storage.persist()` requested on first launch. Chrome and Safari grant it automatically based on interaction history; Firefox prompts. Persistent storage is exempt from LRU eviction under storage pressure, and — critically on iOS — **exempt from the 7-day script-created-data eviction rule that applies to sites without recent interaction.** Installing to the home screen and using the app daily also keeps you clear of that rule, but persist() is the belt to that braces.
2. Weekly export prompt at the Sunday review. One tap, a JSON file to your Downloads.
3. Checkpoint exports are mandatory — the checkpoint cannot be sealed without an export.
4. Profile screen shows days since last export; red past 14 days.

**Honest statement of the residual risk:** if you lose the phone between exports, you lose up to a week. That is the price of no server. It is an acceptable price for a 120-day personal experiment, and if you decide it isn't, `12 §Q2` covers adding sync.

---

## 5. Notification architecture — the honest version

**Reliable scheduled local notifications do not exist for PWAs.** This is the most consequential platform constraint in the project and it needs to be stated plainly rather than discovered in week 3.

### 5.1 What is actually available

| Capability | Android/Chrome | iOS/Safari | Verdict |
|---|---|---|---|
| Notification API while app is open | ✓ | ✓ | Useful for immediate feedback only |
| Web Push (server-driven) | ✓ | ✓ **but requires home-screen install**, iOS 16.4+ | Needs a server we don't have |
| **Notification Triggers** (schedule locally, no server) | ✗ — origin trial, never shipped | ✗ | **The thing we want, and it doesn't exist** |
| Background Sync | ✓ | ✗ | Not needed |
| Periodic Background Sync | ✓ (installed + engagement gated) | ✗ | Unreliable, Chromium-only |
| Any code execution while app is closed | limited | ✗ | Cannot be relied on |

### 5.2 The recommendation

**Use the operating system's own alarms. Do not build a push stack for V1.**

Onboarding step 5 already collects your implementation-intention sentences with times attached. The app turns those into either (a) a downloadable `.ics` with three recurring events, or (b) a simple screen listing three times and labels to set as repeating phone alarms.

```
06:45  SYSTEM — read today's priority
07:15  At my desk: open the editor before anything else
22:30  Evening review — 25 seconds
```

Compared to Web Push, this is: platform-identical, perfectly reliable, unaffected by the app being closed for a week, requires no server, no VAPID keys, no subscription lifecycle, and takes about two hours to build instead of two days. The only thing it can't do is put dynamic content in the notification — and the dynamic content belongs on the screen you're about to open anyway.

The notification whose text is *your own if-then sentence*, fired by a system alarm you can't dismiss with a swipe-from-the-shade habit, is very likely **more** effective than a generic push saying "Time for DSA!"

### 5.3 If you later want push

Phase 7, optional, and cleanly additive: a ~100-line Cloudflare Worker + KV holding push subscriptions and a cron that fires three pushes a day. It requires no data-model change. It also introduces a server, an endpoint that knows when you wake up, and a subscription lifecycle to debug. Decide at Day 60 with real evidence about whether the alarms were insufficient.

---

## 6. Performance budget

| Metric | Budget | Why |
|---|---|---|
| Cold start to interactive home | < 1.2 s on a mid-range Android | You'll open this half-asleep |
| Tap → XP feedback rendered | **< 2 s, and realistically < 300 ms** | Derived from the immediate-reward evidence; this is a product requirement, not an aspiration |
| Bundle (gzipped) | < 200 kb | Precached, so it's a one-time cost — but a small bundle keeps cold start fast |
| Projection rebuild, full arc | < 500 ms | 1,800 events; should be nowhere near this |
| Median session length | **< 90 s** | The guardrail metric — measured, reported weekly |

---

## 7. Security and privacy posture

- **No network requests after load.** Self-hosted fonts, no CDN, no analytics, no crash reporting, no error tracking. CSP set to `default-src 'self'` with no exceptions.
- **No auth, because there's no server and no second user.** Device lock screen is the access control. If you want more, the export can be passphrase-encrypted (WebCrypto AES-GCM + PBKDF2), which is the only place encryption meaningfully helps — the export is what ends up in a cloud drive.
- **No PII is collected that isn't needed.** No salary (`04 §6.3`), no address, no contacts, no photos, no health-app integration in V1.
- **Delete means delete.** One button, drops the IndexedDB database, unregisters the SW, clears caches.
- **Threat model, stated:** the realistic threats are device loss and shoulder-surfing, not a remote attacker — there is no remote surface. Design effort goes to backup, not to cryptography.

---

## 8. Analytics

**All analytics are local, computed from the event log, and shown only to you.** No endpoint exists.

What's tracked and why:

| Metric | Purpose |
|---|---|
| Median daily app time | **The guardrail.** Is the app becoming the task? |
| Time-to-first-action after open | Is the home screen doing its job? |
| Quest completion rate by hour-of-day | Feeds the schedule-change rule |
| Most-skipped quest | Feeds the checkpoint amendment proposal |
| Recovery-quest uptake rate | Is the failure system working? |
| Evening-review completion rate | Is the review too long? |
| Backdated entry count | Anti-gaming signal, surfaced honestly |

These appear on a single Settings → Diagnostics screen. They are diagnostics for the *product*, not scores for you, and the UI says so.
