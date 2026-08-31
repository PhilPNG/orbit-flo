# Orbit Flo PNG Asset Pass Design

Date: 2026-06-29

## Goal

Make Orbit Flo feel more premium, artsy, and complete by replacing the purely code-drawn brand mark and repeated generic icon treatment with a small system of generated PNG assets.

The asset pass should add visual detail without making dense planning surfaces noisy. Product controls should remain crisp, accessible, and code-native.

## Direction

Use a hybrid visual system:

- A clean premium PNG brand mark and optional horizontal lockup.
- A small functional PNG icon set for primary app areas.
- A few larger space-themed illustration moments for onboarding and empty states.
- Existing lucide icons remain for tiny utility controls where universal symbols are clearer.

## Asset Inventory

Create final project-bound PNG files for:

- Brand mark: luminous orbital command mark for small logo use.
- Brand lockup: horizontal Orbit Flo logo for auth and sidebar contexts. If generated text is not crisp, compose the PNG mark with code-native Orbit Flo wordmark text instead.
- Mission Control icon: command dashboard or orbital radar motif.
- Missions icon: constellation map or mission folder motif.
- Brainstorm icon: idea nebula or thought starburst motif.
- Reviews icon: orbit checkpoint or inspection beacon motif.
- Settings icon: space instrument gear motif.
- Onboarding illustration: command module or orbital workspace.
- Empty project illustration: project constellation waiting to be mapped.
- Empty notes illustration: idea nebula with soft luminous fragments.

## Style

Assets should feel related to the current Orbit Flo UI:

- Deep navy/space base with cyan, blue, and violet energy accents.
- Semi-3D glass or polished clay render feeling, not flat emoji-style stickers.
- Soft glow, subtle texture, clean silhouette.
- Clear shapes at app UI sizes.
- No watermarks.
- No random text inside icons.
- Avoid busy backgrounds for small icons.

## Implementation Plan

Store generated assets under `public/assets/brand` and `public/assets/icons`, with clear stable filenames.

Update `OrbitFloLogo` so the PNG mark becomes the brand anchor. Keep code-native text available when it is sharper and more accessible than generated text.

Replace primary navigation icons in `AppShell` with the custom PNG app-area icons. Keep lucide icons for buttons, OAuth providers, form fields, logout, plus actions, and arrows.

Update onboarding/auth and empty states to use the larger generated illustrations where they add personality without blocking content.

## Accessibility And Performance

- Use meaningful `alt` text for content-bearing assets and empty `alt` for decorative assets.
- Keep layout dimensions stable with fixed asset boxes or aspect ratios.
- Use reasonably compressed PNGs sized for their display roles.
- Do not rely on image text for essential UI labels.

## Verification

After implementation:

- Confirm every referenced PNG exists and loads in the browser.
- Check desktop and mobile layouts for overlap, clipping, or blurry scaling.
- Run unit tests, production build, and e2e smoke.
- Visually inspect the auth/onboarding screen, app shell sidebar, and at least one empty state.
