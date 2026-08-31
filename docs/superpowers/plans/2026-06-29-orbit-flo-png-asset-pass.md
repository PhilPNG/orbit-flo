# Orbit Flo PNG Asset Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and integrate a polished PNG asset system for Orbit Flo branding, primary navigation, onboarding, and empty states.

**Architecture:** Keep app labels and controls code-native while adding project-owned PNG assets under `public/assets`. Add a small asset manifest so components reference stable paths instead of hardcoded strings. Update logo, shell navigation, auth/onboarding, and empty-state visuals with bounded image containers.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS utility classes, Vitest, Playwright, built-in Image Gen PNG output.

---

## File Structure

- Create `public/assets/brand/orbit-flo-mark.png`: primary PNG logo mark.
- Create `public/assets/illustrations/onboarding-command-module.png`: auth/onboarding illustration.
- Create `public/assets/illustrations/empty-project-constellation.png`: empty projects/tasks illustration.
- Create `public/assets/illustrations/empty-notes-nebula.png`: empty notes illustration.
- Create `public/assets/icons/mission-control.png`: primary nav icon.
- Create `public/assets/icons/missions.png`: primary nav icon.
- Create `public/assets/icons/brainstorm.png`: primary nav icon.
- Create `public/assets/icons/reviews.png`: review surface icon.
- Create `public/assets/icons/settings.png`: primary nav icon.
- Create `src/lib/orbit-assets.ts`: typed manifest for public asset paths.
- Modify `src/components/orbit-flo-logo.tsx`: replace SVG mark with PNG mark and preserve code-native wordmark.
- Modify `src/components/app-shell.tsx`: replace primary nav lucide icons with custom PNGs and keep utility orbit indicator code-native.
- Modify `src/components/empty-state.tsx`: accept an illustration variant and render PNG empty-state art when not loading.
- Modify `src/features/auth/auth-page.tsx`: replace the code-drawn `OrbitalCommandScene` with generated onboarding artwork.
- Modify `src/features/projects/projects-page.tsx`: pass the project-empty illustration variant.
- Modify `src/features/notes/notes-page.tsx`: pass the notes-empty illustration variant.
- Modify `src/app/App.test.tsx`: assert nav labels still render with accessible links after decorative image icon replacement.
- Modify `src/features/auth/auth-page.test.tsx`: assert onboarding illustration renders on the auth screen.
- Modify `src/features/reviews/reviews-panel.tsx`: add the review PNG icon to the review panel heading.
- Modify `tests/e2e/smoke.spec.ts`: assert the PNG logo and onboarding illustration load in the browser.

## Task 1: Generate And Persist PNG Assets

**Files:**
- Create: `public/assets/brand/orbit-flo-mark.png`
- Create: `public/assets/illustrations/onboarding-command-module.png`
- Create: `public/assets/illustrations/empty-project-constellation.png`
- Create: `public/assets/illustrations/empty-notes-nebula.png`
- Create: `public/assets/icons/mission-control.png`
- Create: `public/assets/icons/missions.png`
- Create: `public/assets/icons/brainstorm.png`
- Create: `public/assets/icons/reviews.png`
- Create: `public/assets/icons/settings.png`

- [ ] **Step 1: Generate the brand mark PNG**

Use the built-in Image Gen tool with this prompt:

```text
Use case: logo-brand
Asset type: Orbit Flo app logo mark PNG
Primary request: Create a premium standalone logo mark for a productivity app named Orbit Flo.
Subject: a luminous orbital command symbol, combining a small planet core, orbital ring, and tiny satellite/navigation cue.
Style/medium: polished semi-3D glass/clay render, crisp silhouette, premium SaaS app icon feel.
Composition/framing: centered square icon, generous padding, readable at 48px.
Lighting/mood: deep space glow, calm focused energy.
Color palette: deep navy base, cyan, electric blue, and violet accents.
Constraints: no text, no watermark, no busy star background, no brand names, no random letters.
Avoid: flat emoji look, messy small details, photorealistic spacecraft, hard black outline.
```

- [ ] **Step 2: Generate the onboarding illustration PNG**

Use the built-in Image Gen tool with this prompt:

```text
Use case: stylized-concept
Asset type: onboarding illustration for Orbit Flo auth screen
Primary request: Create a premium space-themed onboarding illustration for a project planning app.
Subject: an orbital command module with a glowing central workspace, tiny task cards orbiting like satellites, and subtle constellation lines.
Style/medium: polished semi-3D digital illustration, glassy surfaces, refined product UI art.
Composition/framing: square-ish centered composition with transparent-feeling dark edges that blend into a navy UI.
Lighting/mood: calm, focused, premium, luminous cyan-blue-violet glow.
Color palette: deep navy, cyan, blue, violet, soft white highlights.
Constraints: no readable UI text, no watermark, no people, no random logo text.
Avoid: cluttered dashboard screenshots, cartoon rockets, childish stickers, beige palette.
```

- [ ] **Step 3: Generate the empty project constellation PNG**

Use the built-in Image Gen tool with this prompt:

```text
Use case: stylized-concept
Asset type: empty state illustration for projects and work items
Primary request: Create a premium empty-state illustration for unmapped software projects.
Subject: a sparse constellation map with a few glowing nodes, a small folded mission map, and an orbital path waiting to be completed.
Style/medium: polished semi-3D digital illustration, elegant SaaS empty-state art.
Composition/framing: centered wide icon illustration, readable inside a 160px container.
Lighting/mood: quiet, optimistic, focused.
Color palette: deep navy, cyan, blue, violet, soft slate.
Constraints: no text, no watermark, simple silhouette, transparent-feeling dark edges.
Avoid: generic checklist clipart, busy galaxy background, flat monochrome icon.
```

- [ ] **Step 4: Generate the empty notes nebula PNG**

Use the built-in Image Gen tool with this prompt:

```text
Use case: stylized-concept
Asset type: empty state illustration for brainstorming notes
Primary request: Create a premium empty-state illustration for brainstorming notes.
Subject: an idea nebula made of small luminous fragments, a glowing thought spark, and subtle orbit trails.
Style/medium: polished semi-3D digital illustration, refined product empty-state art.
Composition/framing: centered wide icon illustration, readable inside a 160px container.
Lighting/mood: imaginative but calm, premium, focused.
Color palette: deep navy, cyan, violet, blue, soft white highlights.
Constraints: no text, no watermark, simple silhouette, transparent-feeling dark edges.
Avoid: cartoon brain, busy galaxy, generic light bulb icon, childish stickers.
```

- [ ] **Step 5: Generate the five app-area icon PNGs**

Use one built-in Image Gen call per icon with this shared style block and the listed subject line:

```text
Use case: logo-brand
Asset type: Orbit Flo primary navigation PNG icon
Style/medium: premium semi-3D glass/clay app icon object, crisp silhouette, readable at 24px.
Composition/framing: centered square icon with generous padding, no background frame, no text.
Lighting/mood: calm luminous space UI.
Color palette: deep navy object base, cyan, electric blue, violet accents.
Constraints: no text, no watermark, no random symbols, no busy background.
Avoid: emoji, sticker sheet style, photorealistic spacecraft, generic outline icon.
Subject: Mission Control icon as an orbital radar dashboard.
```

Repeat the same prompt with these subject lines:

```text
Subject: Missions icon as a constellation map folder.
Subject: Brainstorm icon as an idea nebula spark.
Subject: Reviews icon as an orbital checkpoint beacon.
Subject: Settings icon as a space instrument gear.
```

- [ ] **Step 6: Move final PNG outputs into the project**

Copy the selected generated PNG files from the Image Gen output folder into the paths listed in this task. Use stable kebab-case names exactly as listed.

Expected file check:

```powershell
Test-Path public/assets/brand/orbit-flo-mark.png
Test-Path public/assets/illustrations/onboarding-command-module.png
Test-Path public/assets/illustrations/empty-project-constellation.png
Test-Path public/assets/illustrations/empty-notes-nebula.png
Test-Path public/assets/icons/mission-control.png
Test-Path public/assets/icons/missions.png
Test-Path public/assets/icons/brainstorm.png
Test-Path public/assets/icons/reviews.png
Test-Path public/assets/icons/settings.png
```

Expected: each line prints `True`.

## Task 2: Add Asset Manifest And Logo PNG Support

**Files:**
- Create: `src/lib/orbit-assets.ts`
- Modify: `src/components/orbit-flo-logo.tsx`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Write the failing app-shell logo test**

Add this assertion to the first test in `src/app/App.test.tsx` after the existing Orbit Flo logo assertion:

```ts
const logo = screen.getByRole("img", { name: "Orbit Flo" });

expect(logo.querySelector("img")).toHaveAttribute(
  "src",
  "/assets/brand/orbit-flo-mark.png",
);
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd test -- src/app/App.test.tsx
```

Expected: FAIL because the `Orbit Flo` logo does not contain a PNG image yet.

- [ ] **Step 3: Create the asset manifest**

Create `src/lib/orbit-assets.ts`:

```ts
export const orbitAssets = {
  brand: {
    mark: "/assets/brand/orbit-flo-mark.png",
  },
  icons: {
    missionControl: "/assets/icons/mission-control.png",
    missions: "/assets/icons/missions.png",
    brainstorm: "/assets/icons/brainstorm.png",
    reviews: "/assets/icons/reviews.png",
    settings: "/assets/icons/settings.png",
  },
  illustrations: {
    onboarding: "/assets/illustrations/onboarding-command-module.png",
    emptyProjects: "/assets/illustrations/empty-project-constellation.png",
    emptyNotes: "/assets/illustrations/empty-notes-nebula.png",
  },
} as const;
```

- [ ] **Step 4: Replace the SVG logo mark with the PNG mark**

In `src/components/orbit-flo-logo.tsx`, remove the SVG `OrbitFloMark` implementation and use this component instead:

```tsx
import { clsx } from "clsx";
import { orbitAssets } from "../lib/orbit-assets";

function OrbitFloMark({
  className,
  labelled = false,
}: {
  className?: string;
  labelled?: boolean;
}) {
  return (
    <img
      alt={labelled ? "Orbit Flo mark" : ""}
      aria-hidden={labelled ? undefined : true}
      className={clsx("h-auto w-full object-contain drop-shadow-[0_0_18px_rgba(34,211,238,0.28)]", className)}
      src={orbitAssets.brand.mark}
    />
  );
}
```

Keep `OrbitFloLogoProps`, `wordmark`, and `OrbitFloLogo` behavior intact.

- [ ] **Step 5: Run the logo test and verify it passes**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd test -- src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/orbit-assets.ts src/components/orbit-flo-logo.tsx src/app/App.test.tsx public/assets/brand/orbit-flo-mark.png
git commit -m "Add Orbit Flo PNG brand mark"
```

## Task 3: Replace Primary Navigation Icons With PNGs

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: Write the failing navigation icon test**

Add this assertion to the first test in `src/app/App.test.tsx` after the navigation link assertions:

```ts
expect(screen.getByRole("link", { name: "Mission Control" }).querySelector("img")).toHaveAttribute(
  "src",
  "/assets/icons/mission-control.png",
);
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd test -- src/app/App.test.tsx
```

Expected: FAIL because the nav still uses lucide components.

- [ ] **Step 3: Replace nav icon config**

In `src/components/app-shell.tsx`, replace the lucide imports and `navItems` icon config with:

```tsx
import { Orbit } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { orbitAssets } from "../lib/orbit-assets";
import { OrbitFloLogo } from "./orbit-flo-logo";
import { StarFieldBackground } from "./space-visuals";

const navItems = [
  { to: "/", label: "Mission Control", iconSrc: orbitAssets.icons.missionControl },
  { to: "/projects", label: "Missions", iconSrc: orbitAssets.icons.missions },
  { to: "/notes", label: "Brainstorm", iconSrc: orbitAssets.icons.brainstorm },
  { to: "/settings", label: "Settings", iconSrc: orbitAssets.icons.settings },
];
```

- [ ] **Step 4: Render nav PNG icons**

Replace the current lucide nav icon render line:

```tsx
<item.icon className="shrink-0 text-cyan-200/80" size={16} aria-hidden="true" />
```

with:

```tsx
<span className="grid h-6 w-6 shrink-0 place-items-center">
  <img
    alt=""
    aria-hidden="true"
    className="h-5 w-5 object-contain drop-shadow-[0_0_10px_rgba(34,211,238,0.2)] transition group-hover:scale-105"
    src={item.iconSrc}
  />
</span>
```

- [ ] **Step 5: Run the app-shell test and verify it passes**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd test -- src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/app-shell.tsx src/app/App.test.tsx public/assets/icons/mission-control.png public/assets/icons/missions.png public/assets/icons/brainstorm.png public/assets/icons/reviews.png public/assets/icons/settings.png
git commit -m "Add Orbit Flo navigation PNG icons"
```

## Task 4: Add Onboarding And Empty-State Illustrations

**Files:**
- Modify: `src/components/empty-state.tsx`
- Modify: `src/features/auth/auth-page.tsx`
- Modify: `src/features/auth/auth-page.test.tsx`
- Modify: `src/features/reviews/reviews-panel.tsx`
- Modify: `src/features/projects/projects-page.tsx`
- Modify: `src/features/notes/notes-page.tsx`
- Modify: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Write the failing auth illustration test**

Add this assertion to `src/features/auth/auth-page.test.tsx` after rendering the page and before clicking create account:

```ts
expect(screen.getByAltText("Orbit Flo onboarding command module")).toHaveAttribute(
  "src",
  "/assets/illustrations/onboarding-command-module.png",
);
```

- [ ] **Step 2: Run the auth test and verify it fails**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd test -- src/features/auth/auth-page.test.tsx
```

Expected: FAIL because the auth page still renders `OrbitalCommandScene`.

- [ ] **Step 3: Replace the onboarding visual**

In `src/features/auth/auth-page.tsx`, remove `OrbitalCommandScene` from the import:

```tsx
import { StarFieldBackground } from "../../components/space-visuals";
import { orbitAssets } from "../../lib/orbit-assets";
```

Replace `<OrbitalCommandScene className="mt-4" />` with:

```tsx
<div className="mt-5 aspect-square w-full max-w-[25rem] overflow-hidden rounded-lg">
  <img
    alt="Orbit Flo onboarding command module"
    className="h-full w-full object-contain drop-shadow-[0_0_42px_rgba(34,211,238,0.2)]"
    src={orbitAssets.illustrations.onboarding}
  />
</div>
```

- [ ] **Step 4: Add empty-state illustration variants**

Replace `src/components/empty-state.tsx` with:

```tsx
import { orbitAssets } from "../lib/orbit-assets";
import { SatelliteLoader } from "./space-visuals";

type EmptyStateIllustration = "projects" | "notes";

const illustrationMap: Record<EmptyStateIllustration, { alt: string; src: string }> = {
  projects: {
    alt: "Empty project constellation",
    src: orbitAssets.illustrations.emptyProjects,
  },
  notes: {
    alt: "Empty notes idea nebula",
    src: orbitAssets.illustrations.emptyNotes,
  },
};

export function EmptyState({
  title,
  message,
  action,
  illustration = "projects",
  isLoading = false,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
  illustration?: EmptyStateIllustration;
  isLoading?: boolean;
}) {
  const selectedIllustration = illustrationMap[illustration];

  return (
    <div className="orbit-panel rounded-lg border-dashed p-6 text-center">
      <div className="orbit-float-card mx-auto mb-4 grid max-w-40 place-items-center overflow-hidden rounded-lg">
        {isLoading ? (
          <SatelliteLoader label={title} />
        ) : (
          <img
            alt={selectedIllustration.alt}
            className="h-auto w-full object-contain"
            src={selectedIllustration.src}
          />
        )}
      </div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-400">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 5: Pass the notes illustration from notes page**

In `src/features/notes/notes-page.tsx`, update the empty notes state from:

```tsx
<EmptyState
  action={
    <button
      className="orbit-button"
      onClick={openCreateModal}
      type="button"
    >
      <Plus size={16} />
      Capture note
    </button>
  }
  title="No signals captured"
  message="Capture the first note for this orbit."
/>
```

to:

```tsx
<EmptyState
  action={
    <button
      className="orbit-button"
      onClick={openCreateModal}
      type="button"
    >
      <Plus size={16} />
      Capture note
    </button>
  }
  illustration="notes"
  title="No signals captured"
  message="Capture the first note for this orbit."
/>
```

- [ ] **Step 6: Keep projects on the project illustration**

In `src/features/projects/projects-page.tsx`, either leave `EmptyState` unchanged because it defaults to `projects`, or pass `illustration="projects"` explicitly if the component call reads clearer.

- [ ] **Step 7: Add the review icon to the review panel heading**

In `src/features/reviews/reviews-panel.tsx`, import the asset manifest:

```tsx
import { orbitAssets } from "../../lib/orbit-assets";
```

Then add the decorative review icon immediately before the `Mission review` label:

```tsx
<div className="mb-3 grid h-11 w-11 place-items-center rounded-lg border border-cyan-300/15 bg-cyan-300/10">
  <img
    alt=""
    aria-hidden="true"
    className="h-8 w-8 object-contain drop-shadow-[0_0_14px_rgba(34,211,238,0.24)]"
    src={orbitAssets.icons.reviews}
  />
</div>
```

- [ ] **Step 8: Extend e2e smoke to assert loaded images**

In `tests/e2e/smoke.spec.ts`, after the existing auth screen assertions add:

```ts
const logoImage = page.locator('img[src="/assets/brand/orbit-flo-mark.png"]').first();
await expect(logoImage).toBeVisible();
await expect(logoImage).toHaveJSProperty("complete", true);

const onboardingImage = page.getByAltText("Orbit Flo onboarding command module");
await expect(onboardingImage).toBeVisible();
await expect(onboardingImage).toHaveJSProperty("complete", true);
```

- [ ] **Step 9: Run focused tests**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd test -- src/features/auth/auth-page.test.tsx src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add src/components/empty-state.tsx src/features/auth/auth-page.tsx src/features/auth/auth-page.test.tsx src/features/reviews/reviews-panel.tsx src/features/projects/projects-page.tsx src/features/notes/notes-page.tsx tests/e2e/smoke.spec.ts public/assets/illustrations/onboarding-command-module.png public/assets/illustrations/empty-project-constellation.png public/assets/illustrations/empty-notes-nebula.png
git commit -m "Add Orbit Flo onboarding illustrations"
```

## Task 5: Final Verification And Visual QA

**Files:**
- Modify only if QA finds a concrete issue.

- [ ] **Step 1: Run the full unit suite**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd test
```

Expected: all test files pass.

- [ ] **Step 2: Run the production build**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd run build
```

Expected: build exits `0`. The existing Vite large-chunk warning may still appear.

- [ ] **Step 3: Run browser smoke**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
$port = 5177
while (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue) { $port++ }
$env:E2E_PORT = [string]$port
npm.cmd run e2e
```

Expected: Chromium smoke test passes.

- [ ] **Step 4: Visual QA desktop and mobile**

Start a dev server:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm.cmd run dev -- --host 127.0.0.1 --port 5178 --strictPort
```

Use the in-app browser or Playwright to inspect:

- Auth sign-in screen at desktop width.
- Auth create-account state at desktop width.
- App shell sidebar at desktop width.
- Auth create-account state at mobile width around 390px.

Verify:

- PNG logo loads and is not blurry at rendered size.
- Nav icons are distinct and not repeated.
- Onboarding illustration does not cover text or controls.
- Empty-state image containers remain stable.
- No visible UI text is replaced by unreadable image text.

- [ ] **Step 5: Commit QA fixes if needed**

If visual QA required changes:

```powershell
git add src/lib/orbit-assets.ts src/components/orbit-flo-logo.tsx src/components/app-shell.tsx src/components/empty-state.tsx src/features/auth/auth-page.tsx src/features/auth/auth-page.test.tsx src/features/reviews/reviews-panel.tsx src/features/projects/projects-page.tsx src/features/notes/notes-page.tsx tests/e2e/smoke.spec.ts public/assets/brand/orbit-flo-mark.png public/assets/icons/mission-control.png public/assets/icons/missions.png public/assets/icons/brainstorm.png public/assets/icons/reviews.png public/assets/icons/settings.png public/assets/illustrations/onboarding-command-module.png public/assets/illustrations/empty-project-constellation.png public/assets/illustrations/empty-notes-nebula.png
git commit -m "Refine Orbit Flo asset presentation"
```

If no changes are needed, do not create an empty commit.

- [ ] **Step 6: Push branch**

```powershell
git push -u origin codex/project-command-center
```

Expected: remote branch updates the existing PR.
