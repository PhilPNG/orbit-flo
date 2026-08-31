# OrbitFlo Motion System Design

## Goal

Make OrbitFlo feel more alive, premium, and unified through a shared outer-space motion system. The work should add artful interactions and loading states without changing the core product structure, database schema, or the calmer minimal UI direction.

## Creative Direction

Use a blend of expressive "cinematic OrbitFlo" motion and screen-specific space-productivity details. The app should feel like a polished space operating system: calm by default, responsive on interaction, and memorable when users complete, capture, search, or move through work.

The motion should be subtle enough for repeated daily use. Animations should support the work instead of competing with it.

## Motion Foundation

Add a shared set of CSS motion primitives in the existing theme layer:

- Page entrance fade and slight lift.
- Panel hover lift with restrained orbital glow.
- Command HUD scanline and radar sweep.
- Comet sweep accent for key actions.
- Docking pulse for capture/selection interactions.
- Completion flare for successful work.
- Loading orbit for route and auth/loading states.

All motion must respect `prefers-reduced-motion`. Reduced-motion users should keep color/focus state changes without looping movement.

## Shared Components

Upgrade existing components rather than introducing a large animation dependency.

- `StarFieldBackground`: add more depth through subtle layered star movement and small orbital debris accents.
- `SatelliteLoader`: make the loader feel more like a satellite orbit with a richer trail and small pulse.
- Route fallback: replace generic loading text with a themed "systems online" loading surface.
- Common panels/buttons/inputs: unify hover, focus, and active states with the same glow language.

The implementation should avoid new large dependencies unless a small utility is already present or clearly worth it. CSS-first is preferred.

## Screen-Specific Touches

Apply a small number of targeted details where they reinforce each screen's purpose:

- Command Palette: HUD-style open animation, scanline, and radar sweep.
- Inbox: selected capture docks into the detail panel with a brief pulse.
- Daily: capture/completion states feel like signal capture and launch completion.
- Calendar: due items use quiet orbital marker pulses for urgent/today states.
- Maps: visual planning gains constellation shimmer on nodes or connections.
- Focus: timer glow feels cockpit-like without becoming distracting.

## Guardrails

- Keep the existing theme and palette.
- Do not add decorative gradient blobs or large unrelated background elements.
- Do not make loops visually loud or distracting.
- Do not hide information behind animation.
- Keep text readable and layout stable on mobile and desktop.
- Preserve accessibility, keyboard navigation, and reduced-motion behavior.
- No SQL or Supabase schema changes.

## Testing And Verification

Add tests where behavior, accessibility, or class wiring changes matter. Most animation CSS itself can be verified through build and smoke tests rather than brittle visual assertions.

Verification should include:

- Focused tests for touched components/routes.
- Full unit test suite.
- Production build.
- E2E smoke test.

## Non-Goals

- No full redesign of layout or navigation.
- No Three.js/WebGL scene for this pass.
- No new database-backed personalization.
- No replacing existing OrbitFlo image assets.
