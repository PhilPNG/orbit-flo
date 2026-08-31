# Auth Page Refresh + Shooting Stars

**Date:** 2026-07-08
**Branch:** `codex/project-command-center`
**Status:** Approved by user

## Problem

The auth page's orbit animation sits in a visible bordered box inside the marketing panel — it reads as a widget pasted onto a card, not part of the scene — and the panel is cluttered with decorative filler (three telemetry chips, two fake metric cards). Site-wide, the sky is completely static; the user wants occasional shooting stars that don't look looped.

## Goals

- Auth left panel: cleaner composition; the orbit scene blends seamlessly into the card.
- Site-wide: modest shooting stars with enough variation that no repeat is perceptible.
- No new dependencies; respect `prefers-reduced-motion`; keep the Deep Space Observatory rules otherwise intact.

## Design

### Auth page (`src/features/auth/auth-page.tsx`, `src/components/auth-orbit-scene.tsx`, `src/styles.css`)

- `.auth-orbit-scene` loses its border, box background, and rounded-box look. The rings/core/nodes render directly on the panel with a radial `mask-image` feather (opaque center → transparent ~78%) so edges dissolve into the card. Width cap raised 25rem → 28rem; scene centered under the copy.
- Removed from the left panel: the three telemetry chips ("Launch your next task", "Map project constellations", "Reach mission success") and both fake metric cards in the scene ("42 tasks aligned", "3 orbits live"). The single "Plan" chip stays.
- Everything else on the page (form column, copy, OAuth) unchanged.

### Shooting stars (`src/components/space-visuals.tsx`, `src/styles.css`)

- `StarFieldBackground` gains three `aria-hidden` spans: `shooting-star shooting-star-one|-two|-three`. Because both the app shell and the auth page render this component, one change covers the whole site.
- Variants (all values distinct so no two streaks look alike):
  | Variant | Cycle | Visible streak | Angle | Length | Start |
  |---|---|---|---|---|---|
  | one | 23s | ~1.0s | −35° | 7rem | top-left area |
  | two | 37s | ~1.4s | −20° | 10rem | top-right third |
  | three | 53s | ~0.8s | −50° | 5rem | mid-left |
- Co-prime cycles (23/37/53) mean the trio's combined pattern repeats only every ~45,000s.
- Modesty constraints: 1px gradient streak + small head glow, peak opacity 0.7, visible <6% of each cycle, animations only inside the existing `@media (prefers-reduced-motion: no-preference)` block.

### Spec amendment

The overhaul spec's "all infinite decorative loops removed" rule is amended by explicit user request: the **Drift** verb now includes rare, varied shooting stars.

## Testing

- `space-visuals.test.tsx`: assert the three shooting-star variants render with `aria-hidden`.
- Existing auth unit tests + e2e smoke unaffected (`data-testid="auth-orbit-scene"` and headings stay).
- Visual verification: auth page screenshot (blend, decluttered panel); confirm a shooting star renders (screenshot timing may miss the streak; DOM assertion suffices).

## Non-goals

- No canvas/WebGL; no changes to the auth form, OAuth flow, or copy in the right column.
