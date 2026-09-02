# Polish and Marketing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full frame rate on weak GPUs via adaptive quality, a rotating star loader, and a four-page marketing site.

**Architecture:** A pure `decideQuality` function plus a localStorage flag that all three WebGL components respect; a CSS rotation on the loading screens; a `MarketingLayout` with four lazy public routes through the existing `route-loaders` seam.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Vitest.

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`. End commits with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **838 tests pass.** Existing-test edits limited to: `App.test.tsx` route-loader mock keys (additive), and moving/renaming the landing tests into the marketing feature (content preserved, called out).
- No new dependency. Truthful copy only; **no screenshots of screens the seed cannot genuinely show** (no mind map, no note links, no signals exist in the seed).
- All CSS animation inside the single `@media (prefers-reduced-motion: no-preference)` block.
- Measured facts this plan rests on: galaxy shader ≈75% of frame cost on integrated GPUs; CSS fallback ≈ free; diet (DPR 1.0, 3 layers) is visually near-identical.

---

## Task 1: Adaptive quality

**Files:** modify `src/components/galaxy-canvas.tsx` (+test), `space-visuals.tsx` (+test), `orb.tsx`, `topography.tsx`.

**Interfaces produced:**
- `export const REDUCE_GPU_KEY = "orbit-flo:reduce-gpu";`
- `export function decideQuality(frameIntervalsMs: number[]): "keep" | "fallback"` — fallback iff ≥ 30 samples and median > 40 ms.
- `export function gpuReduced(): boolean` — reads the flag, try/catch around localStorage, false on any failure. All exported from `galaxy-canvas.tsx`.

**Steps:**
1. TDD `decideQuality` (median over threshold → fallback; under → keep; < 30 samples → keep; unsorted input handled) and `gpuReduced` (flag set → true; absent → false; localStorage throwing → false).
2. Apply the diet: `MAX_DPR` 1.5 → 1.0, `NUM_LAYER 4.0` → `3.0` (comment: measured near-identical, ~20% cheaper).
3. In `GalaxyCanvas`'s rAF loop: collect rendered-frame intervals for the first ~4 s (cap 60 samples, only frames actually drawn); once, call `decideQuality`; on `"fallback"`, set the flag (try/catch) and invoke a new optional `onQualityFallback?: () => void` prop (ref-stored, like `onContextLost`).
4. `StarFieldBackground`: include `!gpuReduced()` in `useGalaxy`; add a state flip on `onQualityFallback` (same pattern as the context-lost flip — canvas unmounts, `--webgl` modifier drops, CSS stars return). `Orb` and `Topography`: add `!gpuReduced()` to their `allowed` initializers and change-listener re-evaluations.
5. Tests: with the flag set (stub `localStorage.getItem`), none of the three mounts a canvas — same stub style as the existing WebGL-availability tests. Full suite + build. Commit.

## Task 2: The rotating loader

**Files:** modify `src/styles.css`, `src/features/auth/require-auth.tsx`, `src/app/home-route.tsx`, `src/app/route-transition.tsx` (only if `DelayedFallback`'s shell renders a starfield — check; if not, the first two only).

**Steps:**
1. CSS: `.orbit-loader-rotate { position:absolute; inset:-22%; }` wrapper (oversized so rotation never exposes an edge — the layers bleed 220px, the diagonal needs ~1.42×), and inside the motion media block: `.orbit-loader-rotate { animation: orbit-loader-spin 240s linear infinite; }` with `@keyframes orbit-loader-spin { to { transform: rotate(360deg); } }`. Comment: loading screens only — the app backdrop must never rotate (parallax + rotation reads as drift).
2. Wrap the `<StarFieldBackground />` on the loading screens in `<div className="orbit-loader-rotate">…</div>`. Assert in each touched test file only if one exists; otherwise a small render test that the wrapper class is present on `RequireAuth`'s loading state (auth mocked `isLoading: true`).
3. Full suite + build. Commit.

## Task 3: The marketing site

**Files:** create `src/features/marketing/` — `marketing-layout.tsx`, `home-page.tsx`, `features-page.tsx`, `agent-page.tsx`, `open-source-page.tsx`, plus tests (the existing `landing-page.test.tsx` assertions move into `home-page.test.tsx` / `marketing-layout.test.tsx`); delete `src/features/landing/landing-page.tsx` after migrating (keep `use-landing-agent-tool` — the layout calls it, so every marketing page speaks WebMCP); modify `route-loaders.ts`, `routes.tsx`, `App.test.tsx` (mock keys), `home-route.tsx` (loads home page).

**Structure:**
- `MarketingLayout({ children })`: `StarFieldBackground`, nav (logo → `/`, links Features `/features`, Agent `/agent`, Open source `/open-source`, GitHub, Sign in button → `/auth`), footer (MIT line, repo link), `useLandingAgentTool()`. Each page sets `document.title` in an effect.
- **Home** (`/`): current hero + agent section trimmed (tool chips stay), three feature teaser cards linking to `/features`, honest close with Orb.
- **Features** (`/features`): sections with the existing screenshots (board, dashboard, flight-plan from `public/assets/landing/`) for boards/dashboard/flight-plan; text-and-card treatment for Inbox, Signals, Brainstorm & linked notes, Mind maps, Calendar, Weekly reviews — one honest paragraph each, no staged imagery.
- **Agent** (`/agent`): the ten tools as a table with one-line descriptions (copy them from `agent-tools.ts` descriptions — single source of truth: import `buildAgentTools` is NOT possible without context; instead hardcode and add a test comparing the page's tool names to the sorted ten, so drift fails).
- **Open source** (`/open-source`): MIT, repo link, the verification story (CI privilege guard, two-account RLS harness, 838 tests), self-host pointer (README).
- Routes: four public `<Route>`s, each `lazy` via `route-loaders`; `/` keeps `HomeRoute` (signed-in redirect preserved) whose signed-out branch now loads the marketing home. `/features` etc. render for signed-in users too (no gate).
- Tests per page: title/heading, key content, CTA hrefs; layout test carries the truthful absences (`Trusted by`, `testimonial`) and the nav links; agent page test pins the ten tool names sorted.

**Verify:** targeted suites, full suite (838 + new), build, and `git diff --stat src/features/agent/` must be empty. Commit.

## Self-review notes

Task 1's fallback flip reuses the context-lost pattern deliberately — one
mechanism, two triggers. Task 3's agent-page drift test replaces importing the
factory (which needs a client) with a pinned list — the same fence style as
everywhere else. The landing feature folder dissolves into marketing; its
WebMCP hook survives because the layout mounts it for all four pages.
