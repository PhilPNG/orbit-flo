# Auth Orbit Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static auth illustration with a lightweight animated orbit scene and use a generated PNG lockup for the full Orbit Flo logo.

**Architecture:** Keep the animation code-native in a focused auth visual component. Keep assets centralized in `orbitAssets`. Preserve accessible logo wrappers while making decorative animation/images hidden from assistive technology.

**Tech Stack:** React, TypeScript, Vite, Tailwind/CSS animations, Image Gen PNG asset, Vitest, Playwright.

---

## Tasks

- [ ] Generate `public/assets/brand/orbit-flo-lockup.png` with mark plus "Orbit Flo" text.
- [ ] Add `orbitAssets.brand.lockup`.
- [ ] Update `OrbitFloLogo` full variant to render the lockup image and keep code-native tagline.
- [ ] Add `AuthOrbitScene` to replace the auth page static onboarding PNG.
- [ ] Add CSS keyframes/classes for the animated orbit scene with reduced-motion fallback.
- [ ] Update tests and e2e image decode checks.
- [ ] Run unit tests, build, e2e, and visual QA.
