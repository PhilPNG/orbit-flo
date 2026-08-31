# Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stacked sidebar on phones with a bottom tab bar, a More sheet, and a floating capture button, so content starts at the top of the screen.

**Architecture:** Three new components render below `lg` and hide above it; the sidebar does the reverse. Layout switches on CSS breakpoints, not JavaScript, matching how every other responsive decision in this codebase is expressed.

**Tech Stack:** React 19, react-router-dom 7, lucide-react, Tailwind v4, vitest.

**Spec (normative):** `docs/superpowers/specs/2026-08-09-mobile-layout-design.md`

## Global Constraints

- Worktree `C:\src\Personal\ToDo\.worktrees\project-command-center`, branch `codex/mobile-layout`.
- Tabs are exactly: Today (`/`), Missions (`/projects`), Inbox (`/inbox`), Brainstorm (`/notes`), then More.
- More holds Maps (`/maps`), Calendar (`/calendar`), Settings (`/settings`) and search.
- Tab bar `h-16` plus `env(safe-area-inset-bottom)`. Capture button `h-14 w-14` at `bottom-20 right-4`. `main` gets `pb-28 lg:pb-8`.
- Every tab-bar and sheet target is at least 44px tall.
- jsdom does not apply CSS. Tests assert presence and classes; visibility is verified in a real browser at 390px.
- Suite green per task (`npx vitest run --maxWorkers=2` under load). Commit per task.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/components/mobile-tab-bar.tsx` (create) | Fixed bottom bar, four destinations plus More |
| `src/components/mobile-more-sheet.tsx` (create) | Overflow destinations and search |
| `src/components/mobile-capture-button.tsx` (create) | Floating capture button and its sheet |
| `src/components/app-shell.tsx` (modify) | Hide the sidebar below `lg`, mount the mobile pieces |
| `src/components/app-shell.test.tsx` (create) | Shell composition at both breakpoints |
| `src/features/projects/project-workspace-page.tsx` (modify) | Tab shrink fix, header stacking |

---

### Task 1: Mobile tab bar (TDD)

**Files:**
- Create: `src/components/mobile-tab-bar.tsx`
- Create: `src/components/mobile-tab-bar.test.tsx`

**Interfaces — Produces:** `export function MobileTabBar({ onOpenMore }: { onOpenMore: () => void }): JSX.Element`

The bar does not own the sheet's open state — `AppShell` does, so the capture button and the sheet cannot both claim it.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "./mobile-tab-bar";

vi.mock("../app/route-loaders", () => ({ routePrefetchers: {} }));

function renderBar(onOpenMore = vi.fn(), route = "/") {
  render(
    <MemoryRouter initialEntries={[route]}>
      <MobileTabBar onOpenMore={onOpenMore} />
    </MemoryRouter>,
  );
  return onOpenMore;
}

describe("MobileTabBar", () => {
  it("renders the four destinations and More", () => {
    renderBar();

    for (const label of ["Today", "Missions", "Inbox", "Brainstorm", "More"]) {
      expect(screen.getByRole("link", { name: label }) ?? screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("marks the active destination", () => {
    renderBar(vi.fn(), "/inbox");

    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");
  });

  it("opens the More sheet", async () => {
    const user = userEvent.setup();
    const onOpenMore = renderBar();

    await user.click(screen.getByRole("button", { name: "More" }));

    expect(onOpenMore).toHaveBeenCalled();
  });

  it("keeps every target at the comfortable tap size", () => {
    renderBar();

    for (const target of [
      screen.getByRole("link", { name: "Today" }),
      screen.getByRole("button", { name: "More" }),
    ]) {
      expect(target.className).toContain("min-h-11");
    }
  });

  it("hides itself on large screens", () => {
    const { container } = render(
      <MemoryRouter>
        <MobileTabBar onOpenMore={vi.fn()} />
      </MemoryRouter>,
    );

    expect(container.querySelector("nav")?.className).toContain("lg:hidden");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/mobile-tab-bar.test.tsx`
Expected: FAIL — cannot resolve `./mobile-tab-bar`.

- [ ] **Step 3: Implement**

```tsx
import { Brain, Inbox, MoreHorizontal, Orbit, Rocket } from "lucide-react";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { routePrefetchers } from "../app/route-loaders";

const tabs: Array<{ to: string; label: string; Icon: LucideIcon }> = [
  { to: "/", label: "Today", Icon: Orbit },
  { to: "/projects", label: "Missions", Icon: Rocket },
  { to: "/inbox", label: "Inbox", Icon: Inbox },
  { to: "/notes", label: "Brainstorm", Icon: Brain },
];

const targetClass =
  "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[0.65rem] font-semibold transition";

export function MobileTabBar({ onOpenMore }: { onOpenMore: () => void }) {
  return (
    <nav
      aria-label="Primary navigation"
      // The inset keeps the bar clear of the iPhone home indicator.
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-white/[0.08] bg-[#040b1d]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md lg:hidden"
    >
      {tabs.map((tab) => (
        <NavLink
          className={({ isActive }) =>
            clsx(targetClass, isActive ? "text-cyan-200" : "text-slate-400")
          }
          key={tab.to}
          onFocus={() => void routePrefetchers[tab.to]?.()}
          to={tab.to}
        >
          {({ isActive }) => (
            <>
              <tab.Icon
                aria-hidden="true"
                className={clsx("h-5 w-5", isActive ? "text-cyan-300" : "text-slate-500")}
              />
              <span>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}

      <button className={clsx(targetClass, "text-slate-400")} onClick={onOpenMore} type="button">
        <MoreHorizontal aria-hidden="true" className="h-5 w-5 text-slate-500" />
        <span>More</span>
      </button>
    </nav>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/mobile-tab-bar.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/mobile-tab-bar.tsx src/components/mobile-tab-bar.test.tsx
git commit -m "Add the mobile tab bar"
```

---

### Task 2: More sheet (TDD)

**Files:**
- Create: `src/components/mobile-more-sheet.tsx`
- Create: `src/components/mobile-more-sheet.test.tsx`

**Interfaces — Produces:** `export function MobileMoreSheet({ onClose }: { onClose: () => void }): JSX.Element`

Search is a `CommandPalette` instance rendered inside the sheet. The sidebar's instance owns its own state and is hidden on mobile, so it cannot be reached from here.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MobileMoreSheet } from "./mobile-more-sheet";

vi.mock("./command-palette", () => ({
  CommandPalette: () => <button type="button">Search</button>,
}));

function renderSheet(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <MobileMoreSheet onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
}

describe("MobileMoreSheet", () => {
  it("offers the overflow destinations and search", () => {
    renderSheet();

    expect(screen.getByRole("link", { name: "Maps" })).toHaveAttribute("href", "/maps");
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "Search" })).toBeVisible();
  });

  it("closes when a destination is chosen", async () => {
    const user = userEvent.setup();
    const onClose = renderSheet();

    await user.click(screen.getByRole("link", { name: "Maps" }));

    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/mobile-more-sheet.test.tsx`
Expected: FAIL — cannot resolve `./mobile-more-sheet`.

- [ ] **Step 3: Implement**

```tsx
import { CalendarDays, Network, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { CommandPalette } from "./command-palette";
import { Modal } from "./modal";

const moreItems: Array<{ to: string; label: string; Icon: LucideIcon }> = [
  { to: "/maps", label: "Maps", Icon: Network },
  { to: "/calendar", label: "Calendar", Icon: CalendarDays },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export function MobileMoreSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} size="sm" title="More">
      <div className="grid gap-2">
        {moreItems.map((item) => (
          <NavLink
            className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-400/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30"
            key={item.to}
            onClick={onClose}
            to={item.to}
          >
            <item.Icon aria-hidden="true" className="h-4 w-4 text-slate-400" />
            {item.label}
          </NavLink>
        ))}

        <div className="border-t border-slate-400/12 pt-2">
          <CommandPalette />
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/mobile-more-sheet.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/mobile-more-sheet.tsx src/components/mobile-more-sheet.test.tsx
git commit -m "Add the mobile More sheet"
```

---

### Task 3: Floating capture button (TDD)

**Files:**
- Create: `src/components/mobile-capture-button.tsx`
- Create: `src/components/mobile-capture-button.test.tsx`

**Interfaces — Produces:** `export function MobileCaptureButton(): JSX.Element`

It owns only its own open state, and reuses `GlobalQuickAdd` for the capture itself rather than duplicating the mutation or `parseQuickAdd`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileCaptureButton } from "./mobile-capture-button";

vi.mock("./global-quick-add", () => ({
  GlobalQuickAdd: () => <label>Quick add<input /></label>,
}));

describe("MobileCaptureButton", () => {
  it("opens a capture sheet", async () => {
    const user = userEvent.setup();
    render(<MobileCaptureButton />);

    await user.click(screen.getByRole("button", { name: "Capture a thought" }));

    expect(screen.getByRole("dialog", { name: "Capture" })).toBeVisible();
    expect(screen.getByLabelText("Quick add")).toBeVisible();
  });

  it("stays clear of the tab bar and hides on large screens", () => {
    render(<MobileCaptureButton />);

    const trigger = screen.getByRole("button", { name: "Capture a thought" });
    expect(trigger.className).toContain("bottom-20");
    expect(trigger.className).toContain("lg:hidden");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/mobile-capture-button.test.tsx`
Expected: FAIL — cannot resolve `./mobile-capture-button`.

- [ ] **Step 3: Implement**

```tsx
import { Plus } from "lucide-react";
import { useState } from "react";
import { GlobalQuickAdd } from "./global-quick-add";
import { Modal } from "./modal";

export function MobileCaptureButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Capture a thought"
        className="orbit-button fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full p-0 shadow-[0_10px_30px_rgba(2,8,23,0.55)] lg:hidden"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Plus aria-hidden="true" className="h-6 w-6" />
      </button>

      {isOpen ? (
        <Modal onClose={() => setIsOpen(false)} size="sm" title="Capture">
          <GlobalQuickAdd />
        </Modal>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/mobile-capture-button.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/mobile-capture-button.tsx src/components/mobile-capture-button.test.tsx
git commit -m "Add the mobile capture button"
```

---

### Task 4: Shell wiring (TDD)

**Files:**
- Modify: `src/components/app-shell.tsx`
- Create: `src/components/app-shell.test.tsx`

**Interfaces:**
- Consumes: `MobileTabBar`, `MobileMoreSheet`, `MobileCaptureButton` from Tasks 1–3.

`AppShell` owns `isMoreOpen`, so the bar opens the sheet and the sheet closes itself.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("./command-palette", () => ({ CommandPalette: () => <button type="button">Search</button> }));
vi.mock("./global-quick-add", () => ({ GlobalQuickAdd: () => <label>Quick add<input /></label> }));
vi.mock("../app/route-loaders", () => ({ routePrefetchers: {} }));

function renderShell() {
  render(
    <MemoryRouter>
      <AppShell>
        <p>Page body</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("hides the sidebar below the large breakpoint", () => {
    renderShell();

    const sidebar = document.querySelector("aside");
    expect(sidebar?.className).toContain("hidden");
    expect(sidebar?.className).toContain("lg:flex");
  });

  it("renders the mobile bar and capture button alongside the page", () => {
    renderShell();

    expect(screen.getByText("Page body")).toBeVisible();
    expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Capture a thought" })).toBeTruthy();
  });

  it("leaves room under the content for the bar", () => {
    renderShell();

    expect(document.querySelector("main")?.className).toContain("pb-28");
  });

  it("opens the More sheet from the bar", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByRole("dialog", { name: "More" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Calendar" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/app-shell.test.tsx`
Expected: FAIL — no More button.

- [ ] **Step 3: Implement**

Add the imports and `const [isMoreOpen, setIsMoreOpen] = useState(false);` alongside the existing `isCollapsed` state. Change the `aside` opening tag from `className="relative z-10 flex min-w-0 flex-col …"` to `className="relative z-10 hidden min-w-0 flex-col … lg:flex"` (keep every other class). Change `main` to:

```tsx
<main className="relative z-10 min-w-0 p-4 pb-28 sm:p-6 sm:pb-28 lg:px-10 lg:py-8 lg:pb-8">
```

Then, immediately after `</main>` and before the closing `</div>`:

```tsx
      <MobileTabBar onOpenMore={() => setIsMoreOpen(true)} />
      <MobileCaptureButton />
      {isMoreOpen ? <MobileMoreSheet onClose={() => setIsMoreOpen(false)} /> : null}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/app-shell.test.tsx src/app/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell.tsx src/components/app-shell.test.tsx
git commit -m "Swap the sidebar for a tab bar on phones"
```

---

### Task 5: Workspace fixes, tap targets, then verify

**Files:**
- Modify: `src/features/projects/project-workspace-page.tsx`
- Modify: `src/features/projects/project-workspace-page.test.tsx`
- Modify: `src/components/global-quick-add.tsx`

- [ ] **Step 1: Write the failing test**

Add to `project-workspace-page.test.tsx`:

```tsx
it("lets the section tabs scroll rather than squashing them", async () => {
  renderProjectWorkspacePage();

  const tab = await screen.findByRole("tab", { name: "Meetings" });
  expect(tab.className).toContain("shrink-0");
  expect(tab.className).toContain("whitespace-nowrap");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/projects/project-workspace-page.test.tsx`
Expected: FAIL — class not found.

- [ ] **Step 3: Implement the three fixes**

In `project-workspace-page.tsx`, both tab `className` branches gain `shrink-0 whitespace-nowrap`:

```tsx
              activeTab === tab
                ? "-mb-px shrink-0 whitespace-nowrap border-b-2 border-cyan-300 px-3 py-2 text-sm font-medium text-white"
                : "-mb-px shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
```

The header stacks below `sm` — change its wrapper from `flex items-center justify-between gap-3` to:

```tsx
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
```

In `global-quick-add.tsx`, the send button grows to a comfortable target on phones — change `grid h-9 w-9 shrink-0 place-items-center` to:

```tsx
          className="orbit-button-secondary grid h-11 w-11 shrink-0 place-items-center border-white/[0.1] bg-white/[0.03] p-0 lg:h-9 lg:w-9"
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/projects/project-workspace-page.test.tsx src/components/global-quick-add.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification**

```bash
npx vitest run --maxWorkers=2
npm run build
```

Expected: all green, build clean.

- [ ] **Step 6: Verify in a real browser at phone width**

jsdom cannot answer the only question that matters here, so drive Playwright at 390×844 with a fake session across `/`, `/projects`, `/projects/:id`, `/calendar`, `/notes`, `/maps` and `/settings`. Confirm for each: the page heading is visible without scrolling, `document.documentElement.scrollWidth === clientWidth`, the tab bar is fixed at the bottom, and the capture button does not cover the last row of content.

- [ ] **Step 7: Commit and push**

```bash
git add src/features/projects src/components/global-quick-add.tsx
git commit -m "Fix workspace tabs, header stacking, and phone tap targets"
git push -u origin codex/mobile-layout
```

## Self-Review (completed)

**Spec coverage.** Tab bar with the exact five entries → Task 1. More sheet with Maps/Calendar/Settings and its own `CommandPalette` instance → Task 2. Floating capture reusing `GlobalQuickAdd` → Task 3. Sidebar hidden below `lg`, mobile pieces mounted, `pb-28` → Task 4. Tab shrink fix, header stacking, icon tap targets → Task 5. Browser verification at 390px → Task 5 Step 6. Every measurement in the spec's Architecture section appears verbatim in a task.

**Placeholder scan.** No TBDs; every code step carries real code.

**Type consistency.** `MobileTabBar` takes `onOpenMore`, `MobileMoreSheet` takes `onClose`, `MobileCaptureButton` takes nothing — matching exactly how Task 4 mounts all three.

**One gap found and fixed while reviewing:** the tab bar originally owned the More sheet's state, which would have made `AppShell` unable to close it and left two components able to open it. State now lives in `AppShell`, and the bar only reports the intent through `onOpenMore`.
