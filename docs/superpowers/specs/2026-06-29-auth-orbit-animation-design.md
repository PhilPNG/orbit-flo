# Auth Orbit Animation Design

Date: 2026-06-29

## Goal

Refresh the Orbit Flo auth screen so the desktop visual panel feels alive and bespoke instead of relying on a static illustration. Replace the full logo treatment with one generated PNG lockup containing the mark and "Orbit Flo" text together.

## Direction

Use a lightweight code-native animated orbit scene rather than a heavy 3D library. The scene should feel premium and unusual, with a glowing central core, orbit paths, task-card satellites, small status nodes, and subtle motion. It should preserve the existing dark space theme and avoid adding bundle weight.

Generate one PNG brand lockup for the full Orbit Flo logo. Use that image for full logo contexts. Keep the existing standalone mark asset for compact mark-only contexts.

## Implementation Notes

- Add `public/assets/brand/orbit-flo-lockup.png`.
- Add the lockup path to `src/lib/orbit-assets.ts`.
- Update `OrbitFloLogo` so `variant="full"` renders the lockup PNG, with the existing tagline still code-native when requested.
- Replace the auth page static onboarding image with an `AuthOrbitScene` component.
- Keep the scene decorative and hidden from assistive technology.
- Respect `prefers-reduced-motion` through CSS media queries.
- Keep mobile layout clean; the animation remains desktop-only in the left panel.

## Verification

- Unit tests should cover the new lockup image path and auth screen behavior.
- E2E should verify the lockup image decodes.
- Production build and smoke test should pass.
- Visual QA should check desktop auth, create-account state, and mobile auth.
