# Auth Page Polish

**Date:** 2026-07-08 · **Branch:** `codex/project-command-center` · **Status:** Approved

## Changes

### Sign-in buttons (`src/features/auth/auth-page.tsx`, new `src/components/brand-icons.tsx`)
- Copy: "Continue with X" → **"Sign in with X"** for Google, GitHub, Apple.
- Icons: replace lucide `Globe2`/`GitBranch`/`Apple` with official brand marks as inline SVG components — `GoogleMark` (four-color G), `GitHubMark` (white octocat), `AppleMark` (white apple) — exported from `brand-icons.tsx`, each `aria-hidden`, 16×16 viewBox-scaled.
- Button chrome unchanged (`orbit-button-secondary`), which satisfies all three brands' dark-UI guidelines.

### Left panel copy + layout
- Headline → **"Your Mission Control for Productivity"** (no trailing period), `text-4xl font-black`, `md:whitespace-nowrap` so it holds one row in the marketing panel.
- Tagline → **"Launch your projects to Orbit."** (replaces "Bring scattered tasks…").
- Everything below the headline centers horizontally: tagline, orbit scene, and the footer line get `text-center`/centered flex column; logo + headline stay left-aligned.

### Orbit scene (`src/components/auth-orbit-scene.tsx` + CSS)
- Chips: **Plan, Brainstorm, Mind map, Review** — four `auth-orbit-card`s with accent dots (cyan, blue, violet, cyan), positioned at the four quadrants (`auth-orbit-satellite-one…four`), staggered `animation-delay`s (0 / 700ms / 1400ms / 2100ms) on the existing 9s float.
- Clean complexity: two `auth-orbit-twinkle` dots inside the scene (small white points, slow 6s/8s opacity pulse, offset delays). No new glow sources; rings/paths/core unchanged.

## Testing
- Unit: brand icon components render with `aria-hidden`; auth page shows the three "Sign in with X" buttons.
- e2e smoke: update the copy assertions if any reference "Continue with".
- Visual screenshot of the auth page.

## Non-goals
- No auth-flow logic changes; no right-column changes beyond button copy/icons.
