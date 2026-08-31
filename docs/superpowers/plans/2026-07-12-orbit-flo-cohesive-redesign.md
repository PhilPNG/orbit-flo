# Orbit Flo Cohesive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Quiet Orbit Observatory redesign, generate the reusable PNG illustration family, and deliver ten exact 1440x900 product screenshots.

**Architecture:** Keep existing route controllers, Supabase queries, mutations, and domain types intact. Establish shared tokens and accessible primitives first, then recompose each route with those primitives; raster generation is limited to atmospheric art, while all UI, text, marks, nodes, and controls remain code-native. A development-only capture route renders production components with deterministic fixtures and Playwright writes the final PNGs.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 utilities, Vitest/Testing Library, Playwright, Supabase JS, TanStack Query, XYFlow 12, Lucide React, built-in image generation.

## Global Constraints

- Use near-black indigo `#020817` as the canvas; interactive cyan is `#22d3ee` / `#67e8f9`, action blue is `#3b82f6`, and violet `#7c3aed` is ambient only.
- Keep Inter as the typeface and use the approved 12/14/16/20/40-44px hierarchy on an 8px spacing grid.
- Never show more than one glowing focal point per visual region; routine buttons must not use the current blue-cyan-violet gradient.
- Preserve every existing feature, route, query, mutation, callback, keyboard interaction, and real text label unless the approved design explicitly adds a label.
- Do not add or modify Supabase migrations, tables, RLS, generated database types, or remote data behavior.
- Keep raster assets as PNG files under `public/assets/`; keep interface text, OAuth marks, brand text, icons, diagrams, and controls code-native.
- Every looping motion must respect `prefers-reduced-motion`; exclude scanlines, pulsing card borders, and rapid shooting-star loops.
- All ten final captures must be exactly 1440x900, contain no lorem ipsum or product watermark, and be stored under `docs/design/orbit-flo-redesign/` in the approved numeric order.
- Preserve the existing untracked `.claude/` directory and do not stage unrelated user files.
- Do not add a production visual-review route; gate the capture harness behind both `import.meta.env.DEV` and `VITE_CAPTURE_MODE === "1"`.
- Hide the XYFlow attribution with `proOptions={{ hideAttribution: true }}` to satisfy the explicit no-watermark deliverable; React Flow is MIT-licensed, although its [official ProOptions policy](https://reactflow.dev/api-reference/types/pro-options) requests a Pro subscription when attribution is removed.
- No new runtime dependency is required.

## File Structure Map

- `src/styles.css`: global color, surface, control, starfield, motion, map, drag, and modal styling.
- `src/lib/orbit-assets.ts`: stable URLs for generated PNGs.
- `src/components/space-visuals.tsx`: animated code-native star layers and loader.
- `src/components/minimal-layout.tsx`: shared page headers, panels, rows, and disclosures.
- `src/components/app-shell.tsx`: the single 232px navigation shell and desktop spacing.
- `src/components/empty-state.tsx`: route-specific empty-state illustration selection.
- `src/components/modal.tsx`: accessible focus containment, Escape close, and size variants.
- Route-specific files under `src/features/`: presentation composition changes while data ownership remains unchanged.
- `src/dev/orbit-flo-visual-review.tsx`: capture-only screen compositions using production components.
- `src/dev/orbit-flo-visual-fixtures.ts`: deterministic fixture values for all ten screens.
- `tests/e2e/redesign-captures.spec.ts`: exact viewport screenshots and PNG dimension assertions.
- `scripts/capture-orbitflo-redesign.mjs`: cross-platform capture runner that enables capture mode.

---

### Task 1: Generate and register the atmospheric PNG asset family

**Files:**
- Create: `public/assets/illustrations/auth-orbit-core-v2.png`
- Create: `public/assets/illustrations/empty-inbox-receiver-v2.png`
- Create: `public/assets/illustrations/empty-map-constellation-v2.png`
- Create: `public/assets/illustrations/empty-brainstorm-signal-v2.png`
- Create: `public/assets/illustrations/empty-today-orbit-v2.png`
- Create: `public/assets/textures/deep-space-grain-v2.png`
- Modify: `src/lib/orbit-assets.ts`
- Modify: `src/components/empty-state.tsx`
- Create: `src/lib/orbit-assets.test.ts`
- Create: `src/components/empty-state.test.tsx`

**Interfaces:**
- Produces `orbitAssets.illustrations.authOrbitCore`, `.emptyInbox`, `.emptyMap`, `.emptyBrainstorm`, `.emptyToday`, and `orbitAssets.textures.deepSpaceGrain`.
- Extends `EmptyState` with `illustration?: "projects" | "notes" | "inbox" | "maps" | "brainstorm" | "today"` and optional `className?: string`.

- [ ] **Step 1: Write the failing asset-registry and empty-state tests**

```tsx
// src/lib/orbit-assets.test.ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { orbitAssets } from "./orbit-assets";

describe("orbitAssets", () => {
  it.each([
    orbitAssets.illustrations.authOrbitCore,
    orbitAssets.illustrations.emptyInbox,
    orbitAssets.illustrations.emptyMap,
    orbitAssets.illustrations.emptyBrainstorm,
    orbitAssets.illustrations.emptyToday,
    orbitAssets.textures.deepSpaceGrain,
  ])("maps %s to a public PNG", (assetPath) => {
    expect(assetPath).toMatch(/\.png$/);
    expect(existsSync(resolve("public", assetPath.replace(/^\//, "")))).toBe(true);
  });
});
```

```tsx
// src/components/empty-state.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { orbitAssets } from "../lib/orbit-assets";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the route-specific illustration without hiding copy", () => {
    render(<EmptyState illustration="inbox" title="Inbox clear" message="Nothing waiting." />);
    expect(screen.getByRole("img", { name: "Quiet orbital signal receiver" })).toHaveAttribute(
      "src",
      orbitAssets.illustrations.emptyInbox,
    );
    expect(screen.getByText("Inbox clear")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the tests and verify missing keys/files fail**

Run: `npm test -- src/lib/orbit-assets.test.ts src/components/empty-state.test.tsx`

Expected: FAIL because the new registry keys and `inbox` illustration type do not exist.

- [ ] **Step 3: Generate the five illustration sources with the built-in image-generation tool**

Issue one built-in image-generation call per prompt. Use `#00ff00` as a flat chroma-key background, then copy the newest generated PNG immediately after each call and remove the key with the installed helper.

```text
Use case: stylized-concept
Asset type: Orbit Flo authentication hero underlay
Primary request: a single dimensional observatory planet core, centered, with a pearl-white nucleus inside translucent electric-blue and cyan shells; one restrained violet rim reflection; elegant, minimal, premium product illustration
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Composition/framing: isolated circular subject, generous padding, no rings or labels because those animate in code
Lighting/mood: calm deep-space instrument glow, one luminous focal point
Constraints: no text, no logo, no watermark, no UI frame, no stars, no floor, no cast shadow, do not use #00ff00 in the subject
Avoid: arcade game item, neon overload, lens flare, gradients outside the subject
```

```text
Use case: stylized-concept
Asset type: Orbit Flo Inbox empty-state illustration
Primary request: a quiet orbital signal receiver, compact satellite dish and small relay body catching one tiny cyan signal point, observatory-grade industrial design
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Composition/framing: centered wide vignette, crisp silhouette, generous padding
Lighting/mood: subdued electric-blue metal with one cyan active detail, no broad glow
Constraints: no text, no logo, no watermark, no UI card, no stars, no cast shadow, do not use #00ff00 in the subject
Avoid: cartoon mascot, arcade HUD, busy antenna array
```

```text
Use case: stylized-concept
Asset type: Orbit Flo Maps empty-state illustration
Primary request: an open constellation aperture, seven small star nodes of dot, planet, diamond, triangle, ring, and card shapes connected by delicate starlight paths around a quiet central point
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Composition/framing: centered horizontal constellation with clean negative space and distinct shapes
Lighting/mood: cyan and electric blue with one subtle violet ambient node, calm and precise
Constraints: no labels, no text, no logo, no watermark, no UI frame, do not use #00ff00 in the subject
Avoid: thick beams, galaxy explosion, sci-fi HUD markings
```

```text
Use case: stylized-concept
Asset type: Orbit Flo Brainstorm empty-state illustration
Primary request: a dimensional signal-nebula idea form, a small crystalline thought cloud assembled from blue particles around one white-cyan signal spark, clean transparent silhouette
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Composition/framing: centered compact vignette, generous padding, no surrounding box
Lighting/mood: deep blue and restrained violet atmosphere, one cyan-white focal spark
Constraints: no brain anatomy, no text, no logo, no watermark, no UI frame, no cast shadow, do not use #00ff00 in the subject
Avoid: painterly black rectangle, magic fantasy cloud, arcade effects
```

```text
Use case: stylized-concept
Asset type: Orbit Flo Today empty-state illustration
Primary request: a calm daily orbit marker, a small matte indigo planet with one thin cyan orbital arc and a single white objective beacon waiting above the horizon
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Composition/framing: centered compact wide vignette with generous padding
Lighting/mood: sunrise-like observatory calm, one restrained beacon
Constraints: no text, no logo, no watermark, no UI frame, no satellite, no cast shadow, do not use #00ff00 in the subject
Avoid: bright gradients, cartoon planet, multiple glows
```

- [ ] **Step 4: Copy and key each illustration into its final path**

Immediately after each generation, select the newest image and run the helper. Change only `$destination` for the five approved filenames.

```powershell
$source = Get-ChildItem "$HOME\.codex\generated_images" -Recurse -File -Filter *.png |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$destination = "public\assets\illustrations\auth-orbit-core-v2.png"
python "$HOME\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
  --input $source.FullName `
  --out $destination `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill
```

Validate each final with `view_image`. If a green edge remains, rerun once with `--edge-contract 1`.

- [ ] **Step 5: Create the seamless grain PNG deterministically**

The current asset generator already uses Playwright screenshots. Add `textureDir`, create it with `mkdir`, then add a dedicated canvas page before `browser.close()`:

```js
const textureDir = path.join(root, "public", "assets", "textures");
await mkdir(textureDir, { recursive: true });

const grainPage = await browser.newPage({
  deviceScaleFactor: 1,
  viewport: { width: 512, height: 512 },
});
await grainPage.setContent('<canvas id="grain" width="512" height="512"></canvas>');
await grainPage.locator("#grain").evaluate((canvas) => {
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(512, 512);
  let seed = 0x4f524249;
  for (let index = 0; index < 512 * 512; index += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const value = 118 + ((seed >>> 24) % 22);
    pixels.data[index * 4] = value;
    pixels.data[index * 4 + 1] = value + 4;
    pixels.data[index * 4 + 2] = value + 10;
    pixels.data[index * 4 + 3] = 24;
  }
  context.putImageData(pixels, 0, 0);
});
await grainPage.locator("#grain").screenshot({
  omitBackground: true,
  path: path.join(textureDir, "deep-space-grain-v2.png"),
});
await grainPage.close();
```

- [ ] **Step 6: Add registry keys and illustration metadata**

```ts
// additions in src/lib/orbit-assets.ts
illustrations: {
  onboarding: "/assets/illustrations/onboarding-command-module.png",
  emptyProjects: "/assets/illustrations/empty-project-constellation.png",
  emptyNotes: "/assets/illustrations/empty-notes-nebula.png",
  authOrbitCore: "/assets/illustrations/auth-orbit-core-v2.png",
  emptyInbox: "/assets/illustrations/empty-inbox-receiver-v2.png",
  emptyMap: "/assets/illustrations/empty-map-constellation-v2.png",
  emptyBrainstorm: "/assets/illustrations/empty-brainstorm-signal-v2.png",
  emptyToday: "/assets/illustrations/empty-today-orbit-v2.png",
},
textures: {
  deepSpaceGrain: "/assets/textures/deep-space-grain-v2.png",
},
```

```ts
// illustration metadata in src/components/empty-state.tsx
import { clsx } from "clsx";

type EmptyStateIllustration = "projects" | "notes" | "inbox" | "maps" | "brainstorm" | "today";

const illustrationMap: Record<EmptyStateIllustration, { alt: string; src: string }> = {
  projects: { alt: "Empty project constellation", src: orbitAssets.illustrations.emptyProjects },
  notes: { alt: "Empty notes idea nebula", src: orbitAssets.illustrations.emptyNotes },
  inbox: { alt: "Quiet orbital signal receiver", src: orbitAssets.illustrations.emptyInbox },
  maps: { alt: "Open constellation aperture", src: orbitAssets.illustrations.emptyMap },
  brainstorm: { alt: "Signal nebula waiting for an idea", src: orbitAssets.illustrations.emptyBrainstorm },
  today: { alt: "Daily orbit waiting for an objective", src: orbitAssets.illustrations.emptyToday },
};

type EmptyStateProps = {
  title: string;
  message: string;
  action?: React.ReactNode;
  illustration?: EmptyStateIllustration;
  isLoading?: boolean;
  className?: string;
};

export function EmptyState({ title, message, action, illustration, isLoading = false, className }: EmptyStateProps) {
  const selectedIllustration = illustration ? illustrationMap[illustration] : null;
  return (
    <div className={clsx("orbit-empty-state surface-quiet rounded-xl p-6 text-center", className)}>
      <div className="mx-auto mb-4 grid w-full max-w-40 place-items-center overflow-visible">
        {isLoading ? (
          <SatelliteLoader label="" />
        ) : selectedIllustration ? (
          <div className="aspect-[3/2] w-full">
            <img alt={selectedIllustration.alt} className="h-full w-full object-contain" src={selectedIllustration.src} />
          </div>
        ) : (
          <SpaceEmptyIllustration />
        )}
      </div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 7: Run focused tests and commit**

Run: `npm test -- src/lib/orbit-assets.test.ts src/components/empty-state.test.tsx`

Expected: PASS.

```powershell
git add public/assets src/lib/orbit-assets.ts src/lib/orbit-assets.test.ts src/components/empty-state.tsx src/components/empty-state.test.tsx scripts/generate-orbitflo-logo-assets.mjs
git commit -m "Add cohesive Orbit Flo illustration assets"
```

---

### Task 2: Establish the Quiet Orbit design tokens and motion foundation

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/space-visuals.tsx`
- Modify: `src/components/space-visuals.test.tsx`
- Create: `src/components/minimal-layout.test.tsx`
- Modify: `src/components/minimal-layout.tsx`
- Modify: `src/components/status-pill.tsx`

**Interfaces:**
- Keeps `PageHeader`, `SectionHeader`, `QuietPanel`, `DataRow`, `DisclosureSection`, `StarFieldBackground`, and `StatusPill` signatures backward compatible.
- Adds optional `className?: string` to `PageHeader` and `SectionHeader`.

- [ ] **Step 1: Add failing shared-foundation tests**

```tsx
// src/components/minimal-layout.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader, QuietPanel } from "./minimal-layout";

describe("minimal layout", () => {
  it("uses the shared observatory header and quiet surface hooks", () => {
    const { container } = render(
      <>
        <PageHeader eyebrow="Mission registry" title="Projects in orbit.">Track active work.</PageHeader>
        <QuietPanel aria-label="Registry">Content</QuietPanel>
      </>,
    );
    expect(container.querySelector(".orbit-page-header")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Registry" })).toHaveClass("surface-quiet");
  });
});
```

```tsx
// additions in src/components/space-visuals.test.tsx
it("uses only the approved slow star layers and PNG grain", () => {
  const { container } = render(<StarFieldBackground />);
  expect(container.querySelectorAll(".orbit-star-layer")).toHaveLength(3);
  expect(container.querySelector(".orbit-grain")).toHaveStyle({
    backgroundImage: 'url("/assets/textures/deep-space-grain-v2.png")',
  });
  expect(container.querySelector(".shooting-star")).toBeNull();
});
```

- [ ] **Step 2: Run the tests and verify they fail on missing hooks**

Run: `npm test -- src/components/minimal-layout.test.tsx src/components/space-visuals.test.tsx`

Expected: FAIL because `surface-quiet`, `orbit-page-header`, and the PNG grain are not wired.

- [ ] **Step 3: Replace root tokens and surface/control classes**

Use these exact root tokens in `src/styles.css` and map existing compatibility classes to them:

```css
:root {
  color: #f8fafc;
  background: #020817;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color-scheme: dark;
  --orbit-space: #020817;
  --orbit-surface-quiet: rgba(6, 12, 30, 0.86);
  --orbit-surface-raised: rgba(10, 20, 44, 0.94);
  --orbit-surface-focus: rgba(15, 29, 56, 0.97);
  --orbit-blue: #3b82f6;
  --orbit-cyan: #22d3ee;
  --orbit-soft-cyan: #67e8f9;
  --orbit-violet: #7c3aed;
  --orbit-text: #f8fafc;
  --orbit-body: #cbd5e1;
  --orbit-muted: #8290a7;
  --orbit-border: rgba(148, 163, 184, 0.14);
  --orbit-border-strong: rgba(148, 163, 184, 0.24);
}

@layer components {
  .surface-quiet,
  .surface-primary,
  .orbit-panel {
    border: 1px solid var(--orbit-border);
    background: var(--orbit-surface-quiet);
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.025), 0 18px 50px rgba(2, 8, 23, 0.28);
  }

  .surface-raised {
    border: 1px solid var(--orbit-border-strong);
    background: var(--orbit-surface-raised);
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.04), 0 28px 72px rgba(2, 8, 23, 0.48);
  }

  .surface-focus {
    border: 1px solid rgba(103, 232, 249, 0.24);
    background: var(--orbit-surface-focus);
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.05), 0 36px 100px rgba(2, 8, 23, 0.68);
  }

  .surface-whisper,
  .orbit-panel-soft {
    border: 1px solid rgba(148, 163, 184, 0.08);
    background: rgba(6, 12, 30, 0.54);
  }

  .orbit-button {
    background: #3b82f6;
    color: white;
    box-shadow: 0 12px 28px rgba(59, 130, 246, 0.18);
  }

  .orbit-button:focus-visible,
  .orbit-button-secondary:focus-visible,
  .orbit-input:focus-visible {
    outline: 2px solid #67e8f9;
    outline-offset: 2px;
  }
}
```

Remove the primary-button sheen pseudo-element and the three shooting-star selectors/keyframes.

- [ ] **Step 4: Wire the PNG grain and retain three slow star layers**

```tsx
// inside StarFieldBackground
<div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
  <div className="orbit-star-layer orbit-starfield orbit-starfield-far absolute inset-0" />
  <div className="orbit-star-layer orbit-starfield orbit-starfield-mid absolute inset-0" />
  <div className="orbit-star-layer orbit-starfield orbit-starfield-near absolute inset-0" />
  <div className="orbit-nebula absolute inset-0" />
  <div
    className="orbit-grain absolute inset-0"
    style={{ backgroundImage: `url("${orbitAssets.textures.deepSpaceGrain}")` }}
  />
  <span className="orbit-star-flare left-[18%] top-[23%]" />
  <span className="orbit-star-flare orbit-star-flare-small right-[16%] top-[38%]" />
</div>
```

Keep drift durations at 420s, 280s, and 160s and disable them under reduced motion.

- [ ] **Step 5: Apply shared header and quiet-panel hooks**

```tsx
type PageHeaderProps = {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  title: string;
};

type QuietPanelProps = ComponentPropsWithoutRef<"section"> & {
  children: ReactNode;
  className?: string;
};

export function PageHeader({ action, children, className, eyebrow, title }: PageHeaderProps) {
  return (
    <header className={clsx("orbit-page-header flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{eyebrow}</div> : null}
        <h1 className="mt-2 text-[2.5rem] font-bold leading-[1.05] tracking-[-0.035em] text-white">{title}</h1>
        {children ? <div className="mt-3 max-w-2xl text-[0.9375rem] leading-6 text-slate-300">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function QuietPanel({ children, className, ...sectionProps }: QuietPanelProps) {
  return (
    <section className={clsx("surface-quiet rounded-xl p-5", className)} {...sectionProps}>
      {children}
    </section>
  );
}
```

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- src/components/minimal-layout.test.tsx src/components/space-visuals.test.tsx`

Expected: PASS.

```powershell
git add src/styles.css src/components/space-visuals.tsx src/components/space-visuals.test.tsx src/components/minimal-layout.tsx src/components/minimal-layout.test.tsx src/components/status-pill.tsx
git commit -m "Establish Quiet Orbit visual foundation"
```

---

### Task 3: Refine the shared shell, quick dock, and accessible modal

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/components/global-quick-add.tsx`
- Modify: `src/components/command-palette.tsx`
- Modify: `src/components/orbit-flo-logo.tsx`
- Modify: `src/components/modal.tsx`
- Create: `src/components/modal.test.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Keeps `AppShell({ children })` unchanged.
- Extends `Modal` with `size?: "sm" | "md" | "lg"` and `className?: string`; existing calls remain valid.

- [ ] **Step 1: Add failing shell and modal behavior tests**

```tsx
// src/components/modal.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./modal";

describe("Modal", () => {
  it("closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button onClick={() => setIsOpen(true)} type="button">Open details</button>
          {isOpen ? <Modal onClose={() => setIsOpen(false)} size="lg" title="Task details"><button type="button">Save task</button></Modal> : null}
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open details" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toHaveClass("max-w-5xl");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
```

```tsx
// addition in src/app/App.test.tsx after navigating to an authenticated route
expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
expect(screen.getByRole("link", { name: "Today" })).toHaveClass("orbit-nav-active");
expect(screen.getByTestId("app-shell")).toHaveClass("lg:grid-cols-[14.5rem_minmax(0,1fr)]");
```

- [ ] **Step 2: Run tests and verify the missing semantics fail**

Run: `npm test -- src/components/modal.test.tsx src/app/App.test.tsx`

Expected: FAIL because the modal has no size/Escape logic and shell hooks are absent.

- [ ] **Step 3: Implement focus-safe modal behavior**

```tsx
import { clsx } from "clsx";
import { useEffect, useId, useRef, type ReactNode } from "react";

const sizeClass = {
  sm: "max-w-lg",
  md: "max-w-3xl",
  lg: "max-w-5xl",
} as const;

type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: keyof typeof sizeClass;
  className?: string;
};

export function Modal({ title, children, onClose, size = "sm", className }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#020817]/86 px-4 py-8 backdrop-blur-md">
      <section ref={dialogRef} aria-labelledby={titleId} aria-modal="true" className={clsx("surface-focus orbit-page-enter w-full rounded-2xl p-6", sizeClass[size], className)} role="dialog">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white" id={titleId}>{title}</h2>
          <button className="orbit-button-secondary px-2.5 py-1.5 text-xs" onClick={onClose} type="button">Close</button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}
```

Retain the current heading and Close button markup exactly; only move it inside the new section.

- [ ] **Step 4: Normalize the app shell and active navigation treatment**

Add `aria-label="Primary navigation"`, `aria-label="Utility navigation"`, and `data-testid="app-shell"`. Keep 14.5rem expanded and 4.25rem collapsed widths. Use `orbit-nav-active` only for the active link and a pseudo-element leading indicator:

```tsx
className={({ isActive }) => clsx(
  "orbit-nav-link group relative flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium",
  isActive ? "orbit-nav-active bg-[#0a142c] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
  collapsed && "justify-center px-2",
)}
```

Set desktop `<main>` padding to `lg:px-10 lg:py-8`. Keep Quick add and Command available whenever expanded; style them as one quiet bottom dock without changing their handlers.

- [ ] **Step 5: Run focused shell tests and commit**

Run: `npm test -- src/components/modal.test.tsx src/app/App.test.tsx src/components/global-quick-add.test.tsx src/components/command-palette.test.tsx`

Expected: PASS.

```powershell
git add src/components/app-shell.tsx src/components/global-quick-add.tsx src/components/command-palette.tsx src/components/orbit-flo-logo.tsx src/components/modal.tsx src/components/modal.test.tsx src/app/App.test.tsx src/styles.css
git commit -m "Refine shared Orbit Flo shell and modal"
```

---

### Task 4: Redesign the Inbox processing surface

**Files:**
- Modify: `src/features/inbox/inbox-page.tsx`
- Modify: `src/features/inbox/inbox-page.test.tsx`

**Interfaces:**
- Keeps `InboxPage()` and every existing query, mutation, selection, conversion, note, and archive handler unchanged.
- Consumes `PageHeader`, `QuietPanel`, `StatusPill`, and `EmptyState illustration="inbox"`.

- [ ] **Step 1: Add the failing empty-Inbox regression test**

```tsx
it("renders the compact signal receiver state with the queue count", async () => {
  vi.mocked(listInboxCaptures).mockResolvedValue([]);
  renderInboxPage();
  expect(await screen.findByRole("heading", { name: "Inbox" })).toBeVisible();
  expect(screen.getByText("0 open")).toBeVisible();
  expect(screen.getByRole("img", { name: "Quiet orbital signal receiver" })).toHaveAttribute(
    "src",
    orbitAssets.illustrations.emptyInbox,
  );
  expect(screen.getByText("Inbox clear")).toBeVisible();
  expect(screen.getByText("New quick captures will arrive here until you process them.")).toBeVisible();
});
```

- [ ] **Step 2: Run the Inbox test and verify the illustration assertion fails**

Run: `npm test -- src/features/inbox/inbox-page.test.tsx`

Expected: FAIL because the empty state still uses the generic satellite.

- [ ] **Step 3: Recompose the header and empty state without touching behavior**

Use this structure around the existing conditional content:

```tsx
<section className="orbit-page-enter grid gap-6">
  <PageHeader
    action={<StatusPill tone={captures.length > 0 ? "warning" : "good"}>{captures.length} open</StatusPill>}
    title="Inbox"
  >
    Process one signal at a time — convert, assign, or archive.
  </PageHeader>

  {!inboxQuery.isPending && !inboxQuery.isError && captures.length === 0 ? (
    <QuietPanel className="mx-auto w-full max-w-4xl overflow-hidden p-8" aria-label="Inbox queue">
      <div aria-hidden="true" className="inbox-stack-edges" />
      <EmptyState
        className="border-0 bg-transparent shadow-none"
        illustration="inbox"
        title="Inbox clear"
        message="New quick captures will arrive here until you process them."
      />
    </QuietPanel>
  ) : null}
</section>
```

Retain the existing populated capture queue and triage form below the same header, using `surface-quiet` for the queue and `surface-raised` for the selected capture.

- [ ] **Step 4: Run all Inbox tests and commit**

Run: `npm test -- src/features/inbox/inbox-page.test.tsx src/features/inbox/captures.queries.test.ts`

Expected: PASS.

```powershell
git add src/features/inbox/inbox-page.tsx src/features/inbox/inbox-page.test.tsx src/styles.css
git commit -m "Redesign Inbox signal processing"
```

---

### Task 5: Redesign the Missions registry

**Files:**
- Modify: `src/features/projects/projects-page.tsx`
- Create: `src/features/projects/projects-page.test.tsx`

**Interfaces:**
- Keeps `ProjectsPage()` and its project query, `priorityTone`, health calculation, repository normalization, navigation links, and Launch project modal.

- [ ] **Step 1: Add a failing page-level registry test**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { ProjectsPage } from "./projects-page";

const projectsPageMocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listWorkspaceWorkItems: vi.fn(),
}));

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({ isLoading: false, user: { id: "user-1" } }),
}));
vi.mock("../../lib/supabase/workspace", () => ({
  getStoredWorkspaceId: () => "workspace-1",
}));
vi.mock("./projects.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./projects.queries")>()),
  listProjects: projectsPageMocks.listProjects,
}));
vi.mock("../work-items/work-items.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../work-items/work-items.queries")>()),
  listWorkspaceWorkItems: projectsPageMocks.listWorkspaceWorkItems,
}));

function renderProjectsPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  projectsPageMocks.listWorkspaceWorkItems.mockResolvedValue([]);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><ProjectsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

it("groups mission identity and telemetry in a navigable registry row", async () => {
  projectsPageMocks.listProjects.mockResolvedValue([pocketPupProject]);
  renderProjectsPage();
  const mission = await screen.findByRole("article", { name: "PocketPup mission" });
  expect(within(mission).getByText("active")).toBeVisible();
  expect(within(mission).getByText("medium")).toBeVisible();
  expect(within(mission).getByText("good")).toBeVisible();
  expect(within(mission).getByText("Project orbit looks stable.")).toBeVisible();
  expect(within(mission).getByRole("link", { name: "Open PocketPup mission" })).toHaveAttribute(
    "href",
    "/projects/project-1",
  );
  expect(within(mission).getByRole("link", { name: "https://github.com/PhilPNG/PocketPup" })).toHaveAttribute(
    "href",
    "https://github.com/PhilPNG/PocketPup",
  );
});

const pocketPupProject: Database["public"]["Tables"]["projects"]["Row"] = {
  id: "project-1",
  workspace_id: "workspace-1",
  name: "PocketPup",
  description: "Digital dog care app",
  status: "active",
  priority: "medium",
  health: "good",
  color: null,
  repository_url: "https://github.com/PhilPNG/PocketPup",
  rituals_title: null,
  created_by: "user-1",
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: "2026-07-12T12:00:00.000Z",
};

it("opens the Launch project modal", async () => {
  const user = userEvent.setup();
  projectsPageMocks.listProjects.mockResolvedValue([]);
  renderProjectsPage();
  await user.click(await screen.findByRole("button", { name: "Launch project" }));
  expect(screen.getByRole("dialog", { name: "Launch project" })).toBeVisible();
});
```

Reuse the project/auth/query mock structure from `project-workspace-page.test.tsx`.

- [ ] **Step 2: Run the new test and verify the article landmark fails**

Run: `npm test -- src/features/projects/projects-page.test.tsx`

Expected: FAIL because the current registry is table-shaped and has no labelled article.

- [ ] **Step 3: Replace only the registry markup**

Keep the approved header copy and action. Render each project as:

```tsx
<article aria-label={`${project.name} mission`} className="mission-registry-row surface-quiet relative grid gap-5 rounded-xl p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
  <div className="min-w-0">
    <div className="flex flex-wrap items-center gap-2">
      <Link aria-label={`Open ${project.name} mission`} className="text-lg font-semibold text-white after:absolute after:inset-0" to={`/projects/${project.id}`}>
        {project.name}
      </Link>
      <StatusPill>{project.status}</StatusPill>
    </div>
    <p className="mt-2 text-sm text-slate-300">{project.description}</p>
    {repositoryUrl ? <a className="relative z-10 mt-3 inline-flex text-sm font-medium text-cyan-200" href={repositoryUrl}>{repositoryUrl}</a> : null}
  </div>
  <div className="relative z-10 grid min-w-[17rem] grid-cols-2 gap-4 border-l border-white/[0.08] pl-6">
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Priority</p>
      <div className="mt-2"><StatusPill tone={priorityTone(project.priority)}>{project.priority}</StatusPill></div>
    </div>
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Health</p>
      <div className="mt-2"><StatusPill tone={projectHealthTone(healthSignal.health)}>{formatLabel(healthSignal.health)}</StatusPill></div>
      <p className="mt-2 max-w-[13rem] text-xs leading-5 text-slate-400">{healthSignal.reason}</p>
    </div>
  </div>
</article>
```

The telemetry block must include visible `Priority`, `Health`, and the existing health explanation. Do not place the external repository link under the stretched internal link.

- [ ] **Step 4: Run project tests and commit**

Run: `npm test -- src/features/projects/projects-page.test.tsx src/features/projects/projects.test.ts src/features/projects/project-health.test.ts`

Expected: PASS.

```powershell
git add src/features/projects/projects-page.tsx src/features/projects/projects-page.test.tsx src/styles.css
git commit -m "Craft the Missions registry"
```

---

### Task 6: Redesign Brainstorm filters and empty state

**Files:**
- Modify: `src/features/notes/notes-page.tsx`
- Modify: `src/features/notes/notes-page.test.tsx`

**Interfaces:**
- Keeps `NotesPage({ projectId?: string })`, `noteTypes`, active filtering, capture modal, note creation, and task conversion behavior.
- Consumes `EmptyState illustration="brainstorm"`.

- [ ] **Step 1: Add failing filter-count and empty-illustration tests**

```tsx
it("renders zero-count filters and the Brainstorm signal illustration", async () => {
  vi.mocked(listNotes).mockResolvedValue([]);
  renderNotesPage();
  expect(await screen.findByRole("tab", { name: "All 0" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Idea 0" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Question 0" })).toBeVisible();
  expect(screen.getByRole("img", { name: "Signal nebula waiting for an idea" })).toHaveAttribute(
    "src",
    orbitAssets.illustrations.emptyBrainstorm,
  );
});

it("keeps both capture entry points functional without equal emphasis", async () => {
  vi.mocked(listNotes).mockResolvedValue([]);
  renderNotesPage();
  const buttons = await screen.findAllByRole("button", { name: "Capture note" });
  expect(buttons).toHaveLength(2);
  expect(buttons[0]).toHaveClass("orbit-button");
  expect(buttons[1]).toHaveClass("orbit-button-tertiary");
});
```

- [ ] **Step 2: Run the Notes tests and verify count/asset failures**

Run: `npm test -- src/features/notes/notes-page.test.tsx`

Expected: FAIL because filters have no counts/roles and the old notes illustration is used.

- [ ] **Step 3: Compute counts from the already-loaded notes and render a segmented tablist**

```tsx
const filterCounts = Object.fromEntries(
  ["all", ...noteTypes].map((filter) => [
    filter,
    filter === "all" ? notes.length : notes.filter((note) => note.note_type === filter).length,
  ]),
) as Record<"all" | NoteType, number>;

<div aria-label="Brainstorm note filters" className="inline-flex flex-wrap gap-1 rounded-xl border border-white/[0.08] bg-[#060c1e]/80 p-1" role="tablist">
  {["all", ...noteTypes].map((filter) => {
    const label = filter === "all" ? "All" : formatLabel(filter);
    return (
      <button
        aria-selected={activeType === filter}
        className={clsx("brainstorm-filter", activeType === filter && "brainstorm-filter-active")}
        key={filter}
        onClick={() => setActiveType(filter)}
        role="tab"
        type="button"
      >
        <span>{label}</span><span className="brainstorm-filter-count">{filterCounts[filter]}</span>
      </button>
    );
  })}
</div>
```

Use `illustration="brainstorm"` for the zero-result state and `orbit-button-tertiary` for its inner action. The header Capture note remains primary.

- [ ] **Step 4: Run Notes tests and commit**

Run: `npm test -- src/features/notes/notes-page.test.tsx src/features/notes/notes.test.ts`

Expected: PASS.

```powershell
git add src/features/notes/notes-page.tsx src/features/notes/notes-page.test.tsx src/styles.css
git commit -m "Refine Brainstorm signal capture"
```

---

### Task 7: Redesign Settings rows and autosave feedback

**Files:**
- Modify: `src/features/settings/settings-page.tsx`
- Modify: `src/features/settings/settings-page.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Preserves `DailyHomeLayout`, `loadDailyHomeLayout()`, `saveDailyHomeLayout(layout)`, and `updateDailyLayout(key, value)`.
- Uses native checkbox input semantics with `role="switch"`; no custom state library.

- [ ] **Step 1: Add failing switch and autosave assertions**

```tsx
it("exposes daily modules as enabled switches with autosave feedback", async () => {
  render(<SettingsPage />);
  for (const name of ["Quick Capture", "Mission Momentum", "Smart Suggestions", "Mission Debrief"]) {
    expect(screen.getByRole("switch", { name })).toBeChecked();
  }
  expect(screen.getByText("Saved automatically")).toBeVisible();
});
```

Retain the existing test that toggles Quick Capture and asserts the saved layout object.

- [ ] **Step 2: Run the Settings test and verify role/status failure**

Run: `npm test -- src/features/settings/settings-page.test.tsx`

Expected: FAIL because inputs are checkboxes without switch roles and the save-status copy is absent.

- [ ] **Step 3: Recompose account and preference rows**

```tsx
<QuietPanel className="flex flex-wrap items-center justify-between gap-4" aria-label="Account">
  <div>
    <p className="text-xs font-medium text-slate-400">Signed in as</p>
    <p className="mt-1 text-sm font-semibold text-white">{user?.email}</p>
  </div>
  <button className="orbit-button-danger-quiet" disabled={isSigningOut} onClick={signOut} type="button">
    <LogOut aria-hidden="true" size={16} /> Sign out
  </button>
</QuietPanel>

<QuietPanel>
  <SectionHeader action={<span className="text-xs text-slate-500">Saved automatically</span>} title="Daily home">
    Choose the modules that belong on your daily screen.
  </SectionHeader>
  <div className="mt-5 divide-y divide-white/[0.08]">
    {dailyLayoutOptions.map((option) => (
      <label className="settings-row" key={option.key}>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">{option.label}</span>
          <span className="mt-1 block text-sm leading-6 text-slate-400">{option.description}</span>
        </span>
        <input
          aria-label={option.label}
          checked={dailyLayout[option.key]}
          className="orbit-switch"
          onChange={(event) => updateDailyLayout(option.key, event.target.checked)}
          role="switch"
          type="checkbox"
        />
      </label>
    ))}
  </div>
</QuietPanel>
```

Style `.orbit-switch` as a 42x24 appearance-controlled track with a pseudo-like background image or sibling-independent box-shadow; keep the real input focusable and visible under high-contrast modes.

- [ ] **Step 4: Run Settings tests and commit**

Run: `npm test -- src/features/settings/settings-page.test.tsx`

Expected: PASS.

```powershell
git add src/features/settings/settings-page.tsx src/features/settings/settings-page.test.tsx src/styles.css
git commit -m "Polish Orbit Flo settings controls"
```

---

### Task 8: Refine the Maps library, toolbar, and truthful thumbnails

**Files:**
- Modify: `src/features/maps/maps-page.tsx`
- Modify: `src/features/maps/map-library-panel.tsx`
- Create: `src/features/maps/map-library-panel.test.tsx`
- Modify: `src/features/maps/map-template-thumbnail.tsx`
- Modify: `src/features/maps/map-template-thumbnail.test.tsx`
- Modify: `src/features/maps/map-toolbar.tsx`
- Create: `src/features/maps/map-toolbar.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Keeps `MapsPage({ projectId?: string | null })`.
- Keeps `MapLibraryPanel({ isCreating, onCreateBlank, onCreateFromTemplate })`.
- Keeps the existing `MapToolbarProps` callback contract.

- [ ] **Step 1: Add failing library, thumbnail-shape, and toolbar tests**

```tsx
// src/features/maps/map-library-panel.test.tsx
it("renders every complete template card and returns its id", async () => {
  const user = userEvent.setup();
  const onCreateFromTemplate = vi.fn();
  render(<MapLibraryPanel isCreating={false} onCreateBlank={() => undefined} onCreateFromTemplate={onCreateFromTemplate} />);
  expect(screen.getAllByRole("button")).toHaveLength(mapTemplates.length + 1);
  expect(screen.getByText("Capture a meeting topic, decisions, and follow-up actions.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Feature plan/ }));
  expect(onCreateFromTemplate).toHaveBeenCalledWith("feature-plan");
});
```

```tsx
// addition in map-template-thumbnail.test.tsx
expect(container.querySelectorAll("[data-thumbnail-node]")).toHaveLength(nodes.length);
expect(container.querySelector('[data-thumbnail-shape="diamond"]')).toBeTruthy();
expect(container.querySelector('[data-thumbnail-shape="triangle"]')).toBeTruthy();
```

```tsx
// src/features/maps/map-toolbar.test.tsx
it("separates selected view and dirty save state", async () => {
  const user = userEvent.setup();
  const onViewChange = vi.fn();
  const onSave = vi.fn();
  render(<MapToolbar activeView="mind_map" hasSelection={false} isDirty isSaving={false} onAddNode={() => undefined} onOpenDetails={() => undefined} onSave={onSave} onViewChange={onViewChange} />);
  expect(screen.getByRole("tab", { name: "Mind Map" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("button", { name: "Details" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Save map" }));
  expect(onSave).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run focused Maps tests and verify failures**

Run: `npm test -- src/features/maps/map-library-panel.test.tsx src/features/maps/map-template-thumbnail.test.tsx src/features/maps/map-toolbar.test.tsx`

Expected: FAIL on complete descriptions and distinct thumbnail shape hooks.

- [ ] **Step 3: Set the approved gallery/canvas geometry and scrollbar**

In `maps-page.tsx`, replace the content grid with `lg:grid-cols-[288px_minmax(0,1fr)]`. In `map-library-panel.tsx`, expose full descriptions with two-line clamping rather than horizontal truncation:

```tsx
<aside aria-label="Map templates" className="surface-whisper sticky top-8 grid max-h-[calc(100vh-10rem)] gap-3 self-start overflow-hidden rounded-xl p-3">
  <button className="orbit-button-secondary justify-center" disabled={isCreating} onClick={onCreateBlank} type="button">
    <Plus aria-hidden="true" className="h-4 w-4" /> New blank map
  </button>
  <p className="px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Templates</p>
  <div className="orbit-scrollbar grid content-start gap-2 overflow-y-auto pr-1">
    {mapTemplates.map((template) => (
      <button aria-label={`${template.title}: ${template.description}`} className="map-template-card" disabled={isCreating} key={template.id} onClick={() => onCreateFromTemplate(template.id)} type="button">
        <TemplateThumbnail edges={template.edges} nodes={template.nodes} />
        <span className="min-w-0"><span className="block text-sm font-semibold text-white">{template.title}</span><span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{template.description}</span></span>
      </button>
    ))}
  </div>
</aside>
```

- [ ] **Step 4: Render truthful node shapes in the SVG thumbnail**

Use `nodeShape(node.nodeType)` and render each normalized node through a `ThumbnailNodeShape` helper with `data-thumbnail-node` and `data-thumbnail-shape` attributes. Use these exact primitives: circle for dot/ring/planet, rect for card, polygon for diamond/triangle, and an additional ellipse around planet.

```tsx
function ThumbnailNodeShape({ node, x, y }: { node: ThumbnailNode; x: number; y: number }) {
  const shape = nodeShape(node.nodeType);
  const color = accentHex[nodeAccentColor(node.nodeType)];
  if (shape === "triangle") return <polygon data-thumbnail-node data-thumbnail-shape={shape} fill={color} points={`${x},${y - 3.5} ${x - 4},${y + 3.5} ${x + 4},${y + 3.5}`} />;
  if (shape === "diamond") return <rect data-thumbnail-node data-thumbnail-shape={shape} fill={color} height="6" transform={`rotate(45 ${x} ${y})`} width="6" x={x - 3} y={y - 3} />;
  if (shape === "card") return <rect data-thumbnail-node data-thumbnail-shape={shape} fill="none" height="6" rx="1.5" stroke={color} width="9" x={x - 4.5} y={y - 3} />;
  if (shape === "ring") return <circle data-thumbnail-node data-thumbnail-shape={shape} fill="none" r="3.5" stroke={color} cx={x} cy={y} />;
  return <circle data-thumbnail-node data-thumbnail-shape={shape} fill={color} r={shape === "planet" ? 4 : 3} cx={x} cy={y} />;
}
```

- [ ] **Step 5: Restyle toolbar without changing callbacks**

Use one quiet tablist on the left and one action cluster on the right. Active tab uses a cyan bottom edge, while Save map is the only solid-blue control. Keep `Unsaved changes`, `Add node`, `Details`, and `Save map` exact.

- [ ] **Step 6: Run focused and integration tests, then commit**

Run: `npm test -- src/features/maps/map-library-panel.test.tsx src/features/maps/map-template-thumbnail.test.tsx src/features/maps/map-toolbar.test.tsx src/features/maps/maps-page.test.tsx`

Expected: PASS.

```powershell
git add src/features/maps src/styles.css
git commit -m "Elevate the Maps planning library"
```

---

### Task 9: Build constellation nodes and starlight edges

**Files:**
- Create: `src/features/maps/map-starlight-edge.tsx`
- Create: `src/features/maps/map-starlight-edge.test.tsx`
- Modify: `src/features/maps/map-canvas.tsx`
- Modify: `src/features/maps/map-canvas.test.tsx`
- Modify: `src/features/maps/map-star-node.tsx`
- Modify: `src/features/maps/map-star-node.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Keeps `MapCanvas({ graph, selectedNodeId, view, onChange, onSelectNode })`.
- Keeps `StarNodeData` fields unchanged.
- Adds `StarlightEdge(props: EdgeProps)` as an XYFlow custom edge.

- [ ] **Step 1: Write failing edge and canvas configuration tests**

```tsx
// src/features/maps/map-starlight-edge.test.tsx
import { render } from "@testing-library/react";
import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { StarlightEdge } from "./map-starlight-edge";

it("renders an endpoint-brightened path with a stable unique gradient", () => {
  const { container } = render(<svg><StarlightEdge id="edge-a" sourceX={0} sourceY={0} targetX={160} targetY={80} sourcePosition={Position.Right} targetPosition={Position.Left} markerEnd={undefined} data={undefined} selected={false} animated={false} style={{}} interactionWidth={20} /></svg>);
  expect(container.querySelector("#starlight-edge-a")).toBeTruthy();
  expect(container.querySelectorAll("stop")).toHaveLength(3);
  expect(container.querySelector("path.react-flow__edge-path")).toHaveAttribute("stroke", "url(#starlight-edge-a)");
});
```

Extend the ReactFlow test mock in `map-canvas.test.tsx` to capture `edgeTypes` and `proOptions`, then assert:

```tsx
expect(capturedReactFlowProps.edgeTypes).toHaveProperty("starlight");
expect(capturedReactFlowProps.proOptions).toEqual({ hideAttribution: true });
```

- [ ] **Step 2: Run the tests and verify the custom edge is missing**

Run: `npm test -- src/features/maps/map-starlight-edge.test.tsx src/features/maps/map-canvas.test.tsx src/features/maps/map-star-node.test.tsx`

Expected: FAIL because `StarlightEdge` and the edge registration do not exist.

- [ ] **Step 3: Implement the custom starlight edge**

```tsx
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

export function StarlightEdge({ id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, markerEnd, style, interactionWidth = 20 }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const gradientId = `starlight-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <>
      <defs><linearGradient gradientUnits="userSpaceOnUse" id={gradientId} x1={sourceX} x2={targetX} y1={sourceY} y2={targetY}><stop offset="0" stopColor="#67e8f9" stopOpacity="0.82" /><stop offset="0.5" stopColor="#3b82f6" stopOpacity="0.24" /><stop offset="1" stopColor="#67e8f9" stopOpacity="0.82" /></linearGradient></defs>
      <BaseEdge id={id} interactionWidth={interactionWidth} markerEnd={markerEnd} path={path} style={{ ...style, stroke: `url(#${gradientId})` }} />
    </>
  );
}
```

- [ ] **Step 4: Register edges and remove infinite edge animation**

```tsx
const nodeTypes = { star: StarNode };
const edgeTypes = { starlight: StarlightEdge };

function toFlowEdge(edge: EditableMapGraph["edges"][number]): Edge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: edge.label || undefined,
    animated: false,
    type: "starlight",
    className: edge.edgeType === "sequence" ? "orbit-map-edge-sequence" : "orbit-map-edge",
  };
}
```

Pass `edgeTypes={edgeTypes}`, `proOptions={{ hideAttribution: true }}`, `fitView`, and `fitViewOptions={{ padding: 0.24, minZoom: 0.55, maxZoom: 1.15 }}` to `ReactFlow`.

- [ ] **Step 5: Recompose star nodes around their actual shapes**

Keep rename input and handles. Remove the generic solid card from the resting node; use an `orbit-star-node-label` capsule beside a larger shape glyph. Only `selected` applies `star-node-selected`/Beacon styling. Converted nodes retain the small planet badge.

- [ ] **Step 6: Refine canvas, controls, minimap, and run tests**

Set the canvas height to `h-[max(32rem,calc(100vh-15rem))]`, use a quiet dotted background, style controls/minimap with Focus/Quiet tokens, and preserve all interaction tests for double-click, keyboard creation, movement, deletion, and connections.

Run: `npm test -- src/features/maps/map-starlight-edge.test.tsx src/features/maps/map-canvas.test.tsx src/features/maps/map-star-node.test.tsx src/features/maps/maps-page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the constellation treatment**

```powershell
git add src/features/maps src/styles.css
git commit -m "Turn mind maps into living constellations"
```

---

### Task 10: Redesign the cinematic authentication screen

**Files:**
- Modify: `src/features/auth/auth-page.tsx`
- Modify: `src/features/auth/auth-page.test.tsx`
- Modify: `src/components/auth-orbit-scene.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Keeps `AuthPage()` and all Supabase password/OAuth calls unchanged.
- Keeps `AuthOrbitScene()` prop-free and consumes `orbitAssets.illustrations.authOrbitCore`.

- [ ] **Step 1: Add failing exact-copy, OAuth, and password-reveal tests**

```tsx
import { orbitAssets } from "../../lib/orbit-assets";

function renderAuthPage() {
  return render(<AuthPage />, { wrapper: MemoryRouter });
}

it("renders the exact cinematic hero and provider actions", () => {
  renderAuthPage();
  expect(screen.getByRole("heading", { name: "Your Mission Control for Productivity" })).toBeVisible();
  expect(screen.getByText("Launch your projects to Orbit.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Sign in with Apple" })).toBeVisible();
  expect(screen.getByTestId("auth-orbit-core-art")).toHaveAttribute("src", orbitAssets.illustrations.authOrbitCore);
});

it("reveals and hides the password", async () => {
  const user = userEvent.setup();
  renderAuthPage();
  const password = screen.getByLabelText("Password");
  expect(password).toHaveAttribute("type", "password");
  await user.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");
  await user.click(screen.getByRole("button", { name: "Hide password" }));
  expect(password).toHaveAttribute("type", "password");
});
```

- [ ] **Step 2: Run Auth tests and verify asset/reveal failures**

Run: `npm test -- src/features/auth/auth-page.test.tsx src/components/brand-icons.test.tsx`

Expected: FAIL because the core art and reveal control are absent.

- [ ] **Step 3: Add the generated core inside code-native orbital layers**

```tsx
import { orbitAssets } from "../lib/orbit-assets";

<div aria-hidden="true" className="auth-orbit-scene mt-6" data-testid="auth-orbit-scene">
  <div className="auth-orbit-glow" />
  <div className="auth-orbit-ring auth-orbit-ring-wide" />
  <div className="auth-orbit-ring auth-orbit-ring-mid" />
  <div className="auth-orbit-ring auth-orbit-ring-tight" />
  <img alt="" className="auth-orbit-core-art" data-testid="auth-orbit-core-art" src={orbitAssets.illustrations.authOrbitCore} />
  <div className="auth-orbit-path auth-orbit-path-one"><span className="auth-orbit-node" /></div>
  <div className="auth-orbit-path auth-orbit-path-two"><span className="auth-orbit-node auth-orbit-node-violet" /></div>
  <span className="auth-orbit-twinkle auth-orbit-twinkle-one" />
  <span className="auth-orbit-twinkle auth-orbit-twinkle-two" />
  {satellites.map((satellite) => (
    <div className={`auth-orbit-card ${satellite.className}`} key={satellite.label}>
      <span className={`auth-orbit-card-dot auth-orbit-card-dot-${satellite.tone}`} />
      <span>{satellite.label}</span>
    </div>
  ))}
</div>
```

Retain Plan, Brainstorm, Mind map, and Review chips. Slow all orbit movement to at least 18s and keep the core as the only focal glow.

- [ ] **Step 4: Implement accessible password visibility**

Add `const [isPasswordVisible, setIsPasswordVisible] = useState(false);`, set `type={isPasswordVisible ? "text" : "password"}`, and add an icon button inside the field:

```tsx
<button aria-label={isPasswordVisible ? "Hide password" : "Show password"} className="orbit-field-icon-button" onClick={() => setIsPasswordVisible((value) => !value)} type="button">
  {isPasswordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
</button>
```

- [ ] **Step 5: Recompose the 60/40 observatory frame**

Use `md:grid-cols-[minmax(0,3fr)_minmax(420px,2fr)]`, 16px outer radius, a minimum 720px desktop height, and 48px hero padding. Keep all exact form copy and the correct Google/GitHub/Apple SVG marks. Primary Enter orbit uses solid blue.

- [ ] **Step 6: Run Auth tests and commit**

Run: `npm test -- src/features/auth/auth-page.test.tsx src/components/brand-icons.test.tsx src/components/space-visuals.test.tsx`

Expected: PASS.

```powershell
git add src/features/auth/auth-page.tsx src/features/auth/auth-page.test.tsx src/components/auth-orbit-scene.tsx src/styles.css
git commit -m "Make authentication cinematic and calm"
```

---

### Task 11: Recompose the Mission workspace and crafted Kanban board

**Files:**
- Modify: `src/features/projects/project-workspace-page.tsx`
- Modify: `src/features/projects/project-workspace-page.test.tsx`
- Modify: `src/features/work-items/kanban-board.tsx`
- Modify: `src/features/work-items/kanban-board.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Keeps `ProjectWorkspacePage()` controller/query/mutation ownership.
- Keeps `KanbanBoard({ columns, items, meta?, isUpdating?, onOpenItem?, onMoveItem, onRenameColumn, onDeleteColumn, onAddColumn, onReorderColumns })`.
- Keeps native drag payloads `item:<id>` and `column:<id>` and accessible status selects.

- [ ] **Step 1: Add failing workspace-composition and drag-state tests**

```tsx
// project-workspace-page.test.tsx
it("keeps the compact board header, utilities, and every workspace tab", async () => {
  renderProjectWorkspace();
  expect(await screen.findByRole("heading", { name: "Mission workspace" })).toBeVisible();
  expect(screen.getByText("Project brief")).toBeVisible();
  expect(screen.getByText("Templates")).toBeVisible();
  expect(screen.getByText("Operating cadence")).toBeVisible();
  for (const tab of ["Board", "Tasks", "Timeline", "Meetings", "Launch", "Maps", "Notes", "Review"]) {
    expect(screen.getByRole("tab", { name: tab })).toBeVisible();
  }
});
```

```tsx
// kanban-board.test.tsx
it("shows a raised preview and target while a card is dragged", () => {
  const readyColumn = column({ id: "col-ready", title: "Ready to Launch", status_category: "ready", sort_order: 1 });
  const polishItem = workItem({ id: "polish", column_id: "col-todo", title: "Polish the release path" });
  const { container } = render(
    <KanbanBoard columns={[todoColumn, readyColumn]} items={[polishItem]} onOpenItem={() => undefined} {...noopHandlers()} />,
  );
  const card = screen.getByRole("button", { name: /Open Polish the release path/ });
  fireEvent.dragStart(card, { clientX: 480, clientY: 520, dataTransfer: fakeDataTransfer() });
  fireEvent.dragOver(screen.getByRole("region", { name: "Ready to Launch column" }), { clientX: 650, clientY: 520 });
  expect(container.querySelector(".kanban-drag-preview")).toHaveTextContent("Polish the release path");
  expect(screen.getByRole("region", { name: "Ready to Launch column" })).toHaveClass("kanban-drop-target");
  expect(card.closest("[data-kanban-card]")).toHaveClass("kanban-drag-source");
});
```

- [ ] **Step 2: Run workspace/Kanban tests and verify drag hooks fail**

Run: `npm test -- src/features/work-items/kanban-board.test.tsx src/features/projects/project-workspace-page.test.tsx`

Expected: FAIL because no raised preview/target/source state is rendered.

- [ ] **Step 3: Add internal drag state without changing the public API**

```tsx
const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

function beginItemDrag(event: DragEvent<HTMLElement>, itemId: string) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", `item:${itemId}`);
  setDraggedItemId(itemId);
  setDragPosition({ x: event.clientX, y: event.clientY });
}

function updateItemDrag(event: DragEvent<HTMLElement>, columnId: string) {
  event.preventDefault();
  if (!draggedItemId) return;
  setDragOverColumnId(columnId);
  setDragPosition({ x: event.clientX, y: event.clientY });
}

function clearItemDrag() {
  setDraggedItemId(null);
  setDragOverColumnId(null);
}
```

Use `onDragEnd={clearItemDrag}` on cards, `onDragOver={(event) => updateItemDrag(event, column.id)}` on columns, and call `clearItemDrag()` after every item drop. Render a fixed `.kanban-drag-preview` from the active item at `left: dragPosition.x + 14`, `top: dragPosition.y + 14`; set `pointerEvents: "none"`.

- [ ] **Step 4: Craft card metadata and drop treatment**

Keep existing label bars, checklist/comment/attachment counts, priority, due, and status select. Add `data-kanban-card` to each card wrapper. Only the active preview receives `surface-focus`; the source is 28% opaque and target gets a cyan hairline. Empty columns retain `Orbit clear.`

- [ ] **Step 5: Recompose the workspace header and utilities**

In `project-workspace-page.tsx`, keep all handlers and lazy tabs. Use one compact header row, the existing collapsed `ProjectBriefPanel`, an underline tablist, and a `lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]` utility row for `TemplatesPanel` and `ProjectRitualsPanel`. Set the board wrapper to full width; five default columns use `min-w-[12.5rem]` and `flex-1` rather than a fixed 16rem.

- [ ] **Step 6: Run workspace and Kanban tests**

Run: `npm test -- src/features/work-items/kanban-board.test.tsx src/features/projects/project-workspace-page.test.tsx src/features/projects/project-rituals-panel.test.tsx src/features/projects/project-rituals-templates.test.tsx`

Expected: PASS, including existing rename/add/delete/reorder/move/meta/select coverage.

- [ ] **Step 7: Commit the board redesign**

```powershell
git add src/features/projects/project-workspace-page.tsx src/features/projects/project-workspace-page.test.tsx src/features/work-items/kanban-board.tsx src/features/work-items/kanban-board.test.tsx src/styles.css
git commit -m "Craft the Mission workspace board"
```

---

### Task 12: Polish the Trello-style task card modal

**Files:**
- Modify: `src/features/work-items/work-item-card-modal.tsx`
- Modify: `src/features/work-items/work-item-card-modal.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Keeps `WorkItemDetailValues` exactly `{ title, description, status, priority, dueDate, milestoneId, blockedReason }`.
- Keeps `WorkItemCardModal({ item, milestones?, isSubmitting?, onClose, onSubmit })`.
- Preserves all detail query keys and immediate section mutations.
- Consumes the enhanced `<Modal size="lg">` primitive.

- [ ] **Step 1: Add failing hierarchy, progress, and keyboard tests**

```tsx
import { useState } from "react";

function renderModal(onSubmit = vi.fn(), item = workItem()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <WorkItemCardModal item={item} milestones={[]} onClose={() => undefined} onSubmit={onSubmit} />
    </QueryClientProvider>,
  );
  return onSubmit;
}

it("renders the approved hierarchy and announces checklist progress", async () => {
  detailMocks.listChecklistItems.mockResolvedValue([
    { id: "ck1", workspace_id: "workspace-1", work_item_id: "work-item-1", title: "Define the user outcome", is_done: true, sort_order: 0, created_by: "user-1", created_at: "", updated_at: "" },
    { id: "ck2", workspace_id: "workspace-1", work_item_id: "work-item-1", title: "Confirm the smallest workflow", is_done: true, sort_order: 1, created_by: "user-1", created_at: "", updated_at: "" },
    { id: "ck3", workspace_id: "workspace-1", work_item_id: "work-item-1", title: "Capture empty and error states", is_done: false, sort_order: 2, created_by: "user-1", created_at: "", updated_at: "" },
    { id: "ck4", workspace_id: "workspace-1", work_item_id: "work-item-1", title: "Write acceptance criteria", is_done: false, sort_order: 3, created_by: "user-1", created_at: "", updated_at: "" },
  ]);
  renderModal(vi.fn(), workItem({ title: "Define the smallest useful version" }));
  expect(await screen.findByRole("heading", { name: "Define the smallest useful version" })).toBeVisible();
  expect(screen.getByText("Context snapshot")).toBeVisible();
  expect(screen.getByRole("progressbar", { name: "Checklist progress" })).toHaveAttribute("aria-valuenow", "50");
  expect(screen.getByRole("progressbar", { name: "Checklist progress" })).toHaveAccessibleDescription("2 of 4 complete");
});

it("closes on Escape and restores focus", async () => {
  const user = userEvent.setup();
  function Harness() {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <>
        <button onClick={() => setIsOpen(true)} type="button">Open card</button>
        {isOpen ? <WorkItemCardModal item={workItem()} milestones={[]} onClose={() => setIsOpen(false)} onSubmit={vi.fn()} /> : null}
      </>
    );
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>);
  const opener = screen.getByRole("button", { name: "Open card" });
  await user.click(opener);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
```

Use the existing QueryClient seeding helpers and existing mock rows rather than adding network-specific fixtures.

- [ ] **Step 2: Run modal tests and verify progress/modal failures**

Run: `npm test -- src/features/work-items/work-item-card-modal.test.tsx src/components/modal.test.tsx`

Expected: FAIL because progress lacks ARIA and the component does not use the shared focus-safe modal.

- [ ] **Step 3: Move the existing form into the shared large modal**

```tsx
const taskModalGridClass = "grid max-h-[min(46rem,calc(100vh-6rem))] overflow-hidden lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]";
const taskModalMainClass = "orbit-scrollbar min-w-0 overflow-y-auto p-6";
const taskModalRailClass = "orbit-scrollbar min-w-0 overflow-y-auto border-l border-white/[0.08] bg-[#060c1e]/72 p-5";
```

Replace the current fixed overlay with `<Modal className="work-item-card-modal" onClose={onClose} size="lg" title={title || "Task details"}>`. Apply the three constants above to the existing form, main column, and rail. Main receives title, assigned labels, description, checklist, attachments, and comments; rail receives Context snapshot, Status, Priority, Deadline, Milestone, Blocker, Labels, New label, and Save task. Do not alter input names or mutation callbacks while moving them.

- [ ] **Step 4: Add an accessible progress visualization**

```tsx
<div aria-describedby="checklist-progress-copy" aria-label="Checklist progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={checklistPercent} className="work-item-progress" role="progressbar">
  <span style={{ width: `${checklistPercent}%` }} />
</div>
<span className="sr-only" id="checklist-progress-copy">{checklistDone} of {checklist.length} complete</span>
```

Show `2/4` visually beside the Checklist heading. At 100%, use emerald text/fill; otherwise use solid blue with a cyan endpoint.

- [ ] **Step 5: Craft attachment and comment rows**

Use `DataRow`-like structure: file icon, file name, formatted size, Download, and delete in one attachment row; avatar dot, `You`, timestamp, body, and delete in one comment row. Keep `getAttachmentUrl`, upload, delete, and comment mutations unchanged.

- [ ] **Step 6: Run task-modal tests and commit**

Run: `npm test -- src/features/work-items/work-item-card-modal.test.tsx src/components/modal.test.tsx src/features/projects/project-workspace-page.test.tsx`

Expected: PASS.

```powershell
git add src/features/work-items/work-item-card-modal.tsx src/features/work-items/work-item-card-modal.test.tsx src/styles.css
git commit -m "Polish Trello-style task details"
```

---

### Task 13: Make Today calm, compact, and useful above the fold

**Files:**
- Modify: `src/features/daily/daily-mission-control-page.tsx`
- Modify: `src/features/daily/daily-mission-control-page.test.tsx`
- Modify: `src/features/daily/flight-plan.tsx`
- Modify: `src/features/daily/flight-plan.test.tsx`
- Modify: `src/features/daily/inline-suggestions.tsx`
- Modify: `src/features/daily/inline-suggestions.test.tsx`
- Modify: `src/features/daily/suggested-flight-plan.tsx`
- Modify: `src/features/daily/quick-capture-dock.tsx`
- Modify: `src/features/daily/mission-log.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Keeps all `FlightPlan`, `QuickCaptureDock`, and `MissionLog` props unchanged.
- Adds `defaultExpanded?: boolean` to `InlineSuggestions`, default `false`.

- [ ] **Step 1: Add failing default-expansion and above-fold composition tests**

```tsx
// inline-suggestions.test.tsx
it("can expose recommendations immediately for an empty flight plan", () => {
  render(<InlineSuggestions availableWorkItems={availableItems} dailyPlanItems={[]} defaultExpanded isAdding={false} onAdd={() => undefined} todayKey="2026-07-12" />);
  expect(screen.getByRole("button", { name: "Hide suggestions" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Define the smallest useful version")).toBeVisible();
});
```

```tsx
// daily-mission-control-page.test.tsx
it("shows recommendations, Quick Capture, and collapsed Mission log on an empty day", async () => {
  dailyPlanMocks.getDailyMissionControlData.mockResolvedValue({
    availableWorkItems: [
      workItem({ id: "suggestion-1", title: "Define the smallest useful version", priority: "critical", due_date: "2026-07-11" }),
      workItem({ id: "suggestion-2", title: "Polish the release path", priority: "high", due_date: "2026-07-12" }),
      workItem({ id: "suggestion-3", title: "Build the first usable slice", priority: "high" }),
      workItem({ id: "suggestion-4", title: "Test", priority: "medium" }),
    ],
    captures: [],
    dailyPlanItems: [],
    milestones: [],
    plan: dailyPlan({ plan_date: "2026-07-12" }),
    projects: [],
  });
  renderDailyMissionControlPage();
  expect(await screen.findByText("No objectives locked")).toBeVisible();
  expect(screen.getByText("4 suggestions for today")).toBeVisible();
  expect(screen.getByRole("form", { name: "Quick capture" })).toBeVisible();
  expect(screen.getByText("Mission log")).toBeVisible();
});
```

In the existing `adds a suggested work item to today's flight plan` test, replace the disclosure click with this assertion, then click the Add action directly:

```tsx
expect(await screen.findByRole("button", { name: "Hide suggestions" })).toHaveAttribute("aria-expanded", "true");
await user.click(await screen.findByRole("button", { name: "Add Fix overdue launch blocker to today" }));
```

- [ ] **Step 2: Run focused Today tests and verify default-expansion failure**

Run: `npm test -- src/features/daily/flight-plan.test.tsx src/features/daily/inline-suggestions.test.tsx src/features/daily/daily-mission-control-page.test.tsx`

Expected: FAIL because `defaultExpanded` is absent and suggestions start collapsed.

- [ ] **Step 3: Add the controlled initial expansion contract**

```tsx
type InlineSuggestionsProps = {
  availableWorkItems: WorkItem[];
  dailyPlanItems: DailyPlanItemWithWorkItem[];
  defaultExpanded?: boolean;
  isAdding: boolean;
  onAdd: (workItem: WorkItem, index: number) => void;
  todayKey: string;
};

export function InlineSuggestions({ availableWorkItems, dailyPlanItems, defaultExpanded = false, isAdding, onAdd, todayKey }: InlineSuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const count = getSuggestedDailyWorkItems(availableWorkItems, dailyPlanItems, todayKey).length;
  if (count === 0) return null;
  const countLabel = `${count} suggestion${count === 1 ? "" : "s"} for today`;

  return (
    <div>
      <button
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Hide suggestions" : countLabel}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-400 transition hover:text-cyan-100"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
        <span>{countLabel}</span>
        <ChevronDown aria-hidden="true" className={clsx("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
      </button>
      {isExpanded ? <div className="mt-2"><SuggestedFlightPlan availableWorkItems={availableWorkItems} dailyPlanItems={dailyPlanItems} isAdding={isAdding} onAdd={onAdd} todayKey={todayKey} /></div> : null}
    </div>
  );
}
```

Add `ChevronDown` and `clsx` imports. The visible count remains on screen while the accessible name changes to `Hide suggestions` when expanded.

In `DailyMissionControlPage`, pass:

```tsx
<InlineSuggestions
  availableWorkItems={missionControl.availableWorkItems}
  dailyPlanItems={missionControl.dailyPlanItems}
  defaultExpanded={missionControl.dailyPlanItems.length === 0}
  isAdding={addSuggestedItemMutation.isPending}
  onAdd={(workItem, index) => addSuggestedWorkItem(workItem.id, index)}
  todayKey={planDate}
/>
```

- [ ] **Step 4: Compact the empty Flight Plan**

Keep `aria-label="Drop tasks into today's plan"`, drag-over/drop behavior, and Add top suggested task. Replace the generic EmptyState fallback with `illustration="today"`, a recessed `today-flight-target`, and maximum artwork width of 128px. Keep title and message exact.

- [ ] **Step 5: Recompose the centered daily column**

Keep `max-w-[44rem]`, show `2026-07-12`, Today, and the greeting. Use a 20px vertical gap. Render Flight Plan, expanded suggestion rows, Quick Capture, and collapsed Mission log in that order. `MissionMomentum` remains inside Review per existing behavior and all Settings flags continue to determine module visibility.

- [ ] **Step 6: Refine suggestion rows and capture dock**

Make each suggestion a tactile 56-64px row with project, priority, and Add action; no gradient. Give Quick Capture a distinct recessed dock edge, preserving the Enter submission, detail toggle, reset signal, and all error/success behavior.

- [ ] **Step 7: Run the complete Today test set**

Run: `npm test -- src/features/daily/flight-plan.test.tsx src/features/daily/inline-suggestions.test.tsx src/features/daily/suggested-flight-plan.test.tsx src/features/daily/quick-capture-dock.test.tsx src/features/daily/mission-log.test.tsx src/features/daily/daily-mission-control-page.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit the daily redesign**

```powershell
git add src/features/daily src/styles.css
git commit -m "Make Today calm and actionable"
```

---

### Task 14: Add the gated deterministic visual-review harness

**Files:**
- Create: `src/dev/orbit-flo-visual-fixtures.ts`
- Create: `src/dev/orbit-flo-visual-review.tsx`
- Create: `src/dev/orbit-flo-visual-review.test.tsx`
- Modify: `src/app/routes.tsx`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Produces `visualScreenIds` as the ten exact IDs below.
- Produces `OrbitFloVisualReview({ screenId })` using production shell/components.
- Adds the route only when `import.meta.env.DEV && import.meta.env.VITE_CAPTURE_MODE === "1"`.

- [ ] **Step 1: Add a failing harness-route test**

```tsx
it.each([
  "01-inbox",
  "02-maps-library",
  "03-maps-mind-map",
  "04-missions",
  "05-auth",
  "06-brainstorm",
  "07-settings",
  "08-mission-workspace-board",
  "09-today",
  "10-task-card-modal",
] as const)("renders deterministic production composition %s", (screenId) => {
  render(<OrbitFloVisualReview screenId={screenId} />);
  expect(screen.getByTestId(`visual-${screenId}`)).toBeVisible();
});
```

- [ ] **Step 2: Run the harness test and verify the module is missing**

Run: `npm test -- src/dev/orbit-flo-visual-review.test.tsx`

Expected: FAIL because the visual-review modules do not exist.

- [ ] **Step 3: Define exact fixture IDs and data**

```ts
export const visualScreenIds = [
  "01-inbox",
  "02-maps-library",
  "03-maps-mind-map",
  "04-missions",
  "05-auth",
  "06-brainstorm",
  "07-settings",
  "08-mission-workspace-board",
  "09-today",
  "10-task-card-modal",
] as const;
export type VisualScreenId = (typeof visualScreenIds)[number];
```

Define fixtures with these exact values:

| Screen | Fixture state |
| --- | --- |
| Inbox | Zero captures, `0 open`, inbox receiver art |
| Maps library | No selected map, six production templates |
| Mind map | Feature plan production template, selected Feature node |
| Missions | PocketPup / active / Digital dog care app / repository URL / medium / good |
| Auth | Sign-in mode with empty fields and three provider buttons |
| Brainstorm | Zero notes and All selected |
| Settings | `philiprrodriguez@gmail.com`, all four Daily home switches on |
| Board | Approved project ID, five columns, four approved cards, two utility panels, metadata badges |
| Today | `2026-07-12`, empty plan, exactly four suggestions, all modules enabled |
| Task modal | Approved task, MVP/Product labels, 2/4 checklist, `scope-outline.pdf` 438272 bytes, approved comment, Launch v1 |

- [ ] **Step 4: Compose the ten screens from production components**

Use a switch that returns `AppShell` for product screens and the real `AuthPage` component for Auth. Reuse `PageHeader`, `EmptyState`, `MapLibraryPanel`, `MapToolbar`, `MapCanvas`, `KanbanBoard`, `WorkItemCardModal`, `FlightPlan`, `InlineSuggestions`, `QuickCaptureDock`, and `MissionLog`. Wrap each root with:

```tsx
<div data-testid={`visual-${screenId}`} className="visual-review-screen min-h-screen">
  {screen}
</div>
```

For query-owning components such as `WorkItemCardModal`, construct a `QueryClient` with `retry: false`, seed all approved detail keys before render, and wrap in `QueryClientProvider` plus the existing auth test provider/mocks. The harness must not call Supabase.

- [ ] **Step 5: Add the development-only route gate**

```ts
// src/vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_CAPTURE_MODE?: string;
}

// in src/app/routes.tsx
const VisualReviewRoute = import.meta.env.DEV && import.meta.env.VITE_CAPTURE_MODE === "1"
  ? lazy(async () => {
      const module = await import("../dev/orbit-flo-visual-review");
      return { default: module.OrbitFloVisualReviewRoute };
    })
  : null;
```

Add this JSX immediately after the auth routes:

```tsx
{VisualReviewRoute ? (
  <Route
    path="/__visual/:screenId"
    element={<LazyRoute><VisualReviewRoute /></LazyRoute>}
  />
) : null}
```

Implement the route component as:

```tsx
export function OrbitFloVisualReviewRoute() {
  const { screenId } = useParams();
  if (!visualScreenIds.includes(screenId as VisualScreenId)) return <Navigate replace to="/" />;
  return <OrbitFloVisualReview screenId={screenId as VisualScreenId} />;
}
```

- [ ] **Step 6: Provide deterministic board drag state**

In the Board fixture, dispatch `dragStart` for `Polish the release path` and `dragOver` for Ready to Launch in an effect after refs mount. Use coordinates `{ clientX: 742, clientY: 640 }`, leaving the drag preview between the first two columns. Do not dispatch drop until after screenshot.

- [ ] **Step 7: Run the harness test and production build gate**

Run: `npm test -- src/dev/orbit-flo-visual-review.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS and the production route table contains no `/__visual/` route because `import.meta.env.DEV` is false.

- [ ] **Step 8: Commit the capture-only harness**

```powershell
git add src/dev src/app/routes.tsx src/vite-env.d.ts
git commit -m "Add gated Orbit Flo visual review harness"
```

---

### Task 15: Capture, validate, and document all ten redesign images

**Files:**
- Create: `tests/e2e/redesign-captures.spec.ts`
- Create: `scripts/capture-orbitflo-redesign.mjs`
- Modify: `tests/e2e/run-e2e.mjs`
- Modify: `package.json`
- Create: `docs/design/orbit-flo-redesign/01-inbox.png`
- Create: `docs/design/orbit-flo-redesign/02-maps-library.png`
- Create: `docs/design/orbit-flo-redesign/03-maps-mind-map.png`
- Create: `docs/design/orbit-flo-redesign/04-missions.png`
- Create: `docs/design/orbit-flo-redesign/05-auth.png`
- Create: `docs/design/orbit-flo-redesign/06-brainstorm.png`
- Create: `docs/design/orbit-flo-redesign/07-settings.png`
- Create: `docs/design/orbit-flo-redesign/08-mission-workspace-board.png`
- Create: `docs/design/orbit-flo-redesign/09-today.png`
- Create: `docs/design/orbit-flo-redesign/10-task-card-modal.png`
- Create: `docs/design/orbit-flo-redesign/changes.md`

**Interfaces:**
- Adds package script `capture:redesign`.
- `redesign-captures.spec.ts` owns the exact filename order and PNG IHDR dimension checks.

- [ ] **Step 1: Write the capture test before creating images**

```ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

const captures = [
  ["01-inbox", "01-inbox.png"],
  ["02-maps-library", "02-maps-library.png"],
  ["03-maps-mind-map", "03-maps-mind-map.png"],
  ["04-missions", "04-missions.png"],
  ["05-auth", "05-auth.png"],
  ["06-brainstorm", "06-brainstorm.png"],
  ["07-settings", "07-settings.png"],
  ["08-mission-workspace-board", "08-mission-workspace-board.png"],
  ["09-today", "09-today.png"],
  ["10-task-card-modal", "10-task-card-modal.png"],
] as const;

for (const [screenId, fileName] of captures) {
  test(`captures ${screenId} at 1440x900`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date("2026-07-12T12:00:00-04:00"));
    await page.goto(`/__visual/${screenId}`);
    await expect(page.getByTestId(`visual-${screenId}`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);

    const output = resolve("docs/design/orbit-flo-redesign", fileName);
    await page.screenshot({ animations: "disabled", fullPage: false, path: output });
    const png = await readFile(output);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1440);
    expect(png.readUInt32BE(20)).toBe(900);
  });
}
```

- [ ] **Step 2: Add the cross-platform capture runner**

```js
// scripts/capture-orbitflo-redesign.mjs
process.env.VITE_CAPTURE_MODE = "1";
process.argv.push("tests/e2e/redesign-captures.spec.ts");
await import("../tests/e2e/run-e2e.mjs");
```

Pass `VITE_CAPTURE_MODE: process.env.VITE_CAPTURE_MODE || "0"` through `e2eEnv` in `run-e2e.mjs`. Add to `package.json`:

```json
"capture:redesign": "node scripts/capture-orbitflo-redesign.mjs"
```

- [ ] **Step 3: Run capture generation**

Run: `npm run capture:redesign`

Expected: 10 Playwright tests PASS and ten PNGs appear under `docs/design/orbit-flo-redesign/`.

- [ ] **Step 4: Inspect every capture visually in attachment order**

Use `view_image` on all ten PNGs. For each image verify:

- exact text and correct provider marks;
- consistent 232px shell and page grid;
- no clipped copy, native horizontal scrollbar, or unwanted library attribution;
- one focal glow per region;
- card/empty/modal depth matches the same three-tier system;
- Screen 8 visibly shows the mid-drag card and metadata badges;
- Screen 10 visibly shows checklist progress, attachment, comment, and side rail.

If a capture fails, fix production composition, rerun its focused tests, and rerun `npm run capture:redesign`; do not edit the screenshot bitmap.

- [ ] **Step 5: Write the presentation notes used after each image**

Create `docs/design/orbit-flo-redesign/changes.md` with a heading per numeric filename and three to five one-line changes. Use only changes visibly present in that screenshot. Include the shared-system retrofit note under the first screen and mention later component additions where they become visible.

- [ ] **Step 6: Run full verification**

Run: `npm test`

Expected: all Vitest files PASS.

Run: `npm run build`

Expected: TypeScript and Vite production build PASS.

Run: `npm run e2e`

Expected: unauthenticated smoke test PASS.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 7: Verify asset and capture dimensions**

```powershell
@'
from pathlib import Path
from PIL import Image

captures = sorted(Path("docs/design/orbit-flo-redesign").glob("*.png"))
assert len(captures) == 10, len(captures)
for path in captures:
    with Image.open(path) as image:
        assert image.size == (1440, 900), (path, image.size)
for path in Path("public/assets").rglob("*-v2.png"):
    with Image.open(path) as image:
        image.verify()
print("Validated 10 captures and all v2 assets")
'@ | python -
```

Expected: `Validated 10 captures and all v2 assets`.

- [ ] **Step 8: Commit final captures and verification tooling**

```powershell
git add tests/e2e/redesign-captures.spec.ts tests/e2e/run-e2e.mjs scripts/capture-orbitflo-redesign.mjs package.json docs/design/orbit-flo-redesign
git commit -m "Deliver Orbit Flo redesign mockups"
```

---

## Spec coverage matrix

| Approved requirement | Implementation task |
| --- | --- |
| Shared lighting, depth, cards, typography, motion, and one-glow discipline | Tasks 2-3 |
| Reusable PNG illustration and grain assets under `public/assets/` | Task 1 |
| Consistent shell, Quick add, Command, logo, and accessible modal | Task 3 |
| Inbox | Task 4 |
| Missions registry | Task 5 |
| Brainstorm | Task 6 |
| Settings | Task 7 |
| Maps library and template gallery | Task 8 |
| Living-constellation mind map | Task 9 |
| Cinematic Auth and correct provider marks | Task 10 |
| Mission workspace, labels/badges, and mid-drag card | Task 11 |
| Trello-style task card modal | Task 12 |
| Calm single-column Today with visible suggestions and capture | Task 13 |
| Non-production deterministic fixture states | Task 14 |
| Ten exact 1440x900 images and per-image change notes | Task 15 |

Self-review found no uncovered approved requirement, no new data-layer work, and no runtime dependency requirement.

---

## Final completion checklist

- [ ] All fifteen task commits exist and contain only scoped files.
- [ ] `npm test`, `npm run build`, and `npm run e2e` pass from a clean worktree.
- [ ] All six PNG app assets are present and referenced through `orbitAssets`.
- [ ] All ten 1440x900 captures exist in exact numeric order.
- [ ] No screenshot was manually retouched after capture.
- [ ] `.claude/` and other unrelated user files remain untouched and unstaged.
- [ ] Present the ten images in numeric order, with the corresponding three-to-five change lines immediately after each image.
