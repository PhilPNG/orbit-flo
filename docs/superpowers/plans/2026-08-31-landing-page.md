# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give signed-out visitors to `/` a SaaS storefront built from the app's own visual system, while signed-in users keep today's redirect byte-for-byte.

**Architecture:** A small `HomeRoute` branches on auth state; the landing page itself is a lazy chunk loaded through the existing `route-loaders` seam, so `App.test.tsx` stubs it the way it stubs every other route. The page reuses `StarFieldBackground`, `Orb`, and the glow classes — no new visual vocabulary.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Vitest + Testing Library.

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **821 tests currently pass.** Two existing files may change in defined ways only: `src/app/routes.tsx` (the `/` route) and `src/app/App.test.tsx` (one mock key added to its `route-loaders` stub, called out below). **No other existing test may be modified.**
- **No new dependency.**
- **Everything on the page must be true today.** No user counts, no testimonials, no "trusted by", no pricing tiers. The WebMCP claims match what shipped: seven tools, CI-verified grants.
- **No new animation vocabulary.** Entrance settles and static glow; the galaxy and orb are the only loops and both already carry their guards.
- Signed-in behaviour at `/` — including `WorkspaceRedirect`'s pending-invitation handling — must be unchanged.

---

## Prior work (done, not a task)

The three landing assets already exist, captured at 1x from the seeded demo
workspace: `public/assets/landing/board.png` (995 KB),
`public/assets/landing/dashboard.png` (528 KB),
`public/assets/landing/flight-plan.png` (740 KB). The `--landing` mode that
produced them is already in `scripts/capture-readme.mjs`. **Commit them with
your work** — they are untracked.

---

## Task 1: The landing page

**Files:**
- Create: `src/features/landing/landing-page.tsx`, `src/features/landing/landing-page.test.tsx`
- Create: `src/app/home-route.tsx`, `src/app/home-route.test.tsx`
- Modify: `src/app/route-loaders.ts` — one export
- Modify: `src/app/routes.tsx` — the `/` route only
- Modify: `src/app/App.test.tsx` — one mock key
- Modify: `index.html` — title and meta description

**Interfaces:**
- Produces: `export function LandingPage(): JSX.Element` (default-exported too, for the lazy loader), `export function HomeRoute(): JSX.Element`, `export function loadLandingPage()`.
- Consumes: `StarFieldBackground` from `src/components/space-visuals.tsx`, `Orb` from `src/components/orb.tsx`, `orbitAssets.brand.lockupDark` (`/assets/brand/orbit-flo-lockup-dark.png`), `useAuth` from `src/features/auth/use-auth.ts`, `WorkspaceRedirect` from `src/features/workspaces/workspace-redirect.tsx`, `SatelliteLoader` from `src/components/space-visuals.tsx`.

### Background you need

**How routing works today.** In `src/app/routes.tsx`, `/` renders
`<ResolveWorkspace />`, which is `RequireAuth` around `WorkspaceRedirect` —
so a signed-out visitor bounces to `/auth`. You are replacing **only the `/`
route's element** with `<HomeRoute />`. The other `ResolveWorkspace` routes
(`/dashboard`, `/projects`, …) keep it.

**How lazy routes avoid the CI trap.** CI has no Supabase env vars, and the
suite is green only because `App.test.tsx` mocks the whole `./route-loaders`
module. The landing chunk must therefore be loaded through
`src/app/route-loaders.ts` like every other lazy page, and `App.test.tsx`'s
stub gains a `loadLandingPage` key. That is the one permitted existing-test
edit, and it is additive.

**Copy is part of the spec.** Use the exact copy below — it was written to be
true. If something reads wrong to you, report it; do not improvise claims.

- [ ] **Step 1: Write the failing landing page test**

Create `src/features/landing/landing-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./landing-page";

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  it("leads with the mission-control headline", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /Mission control for your projects/ }),
    ).toBeVisible();
  });

  it("sends both hero calls to action to the right places", () => {
    renderLanding();

    expect(screen.getByRole("link", { name: "Enter orbit" })).toHaveAttribute("href", "/auth");
    expect(screen.getByRole("link", { name: "View source" })).toHaveAttribute(
      "href",
      "https://github.com/PhilPNG/orbit-flo",
    );
  });

  it("names all seven agent tools, because the WebMCP story is the differentiator", () => {
    renderLanding();

    for (const tool of [
      "list_projects",
      "get_flight_plan",
      "create_task",
      "move_task",
      "search_workspace",
      "capture_thought",
      "complete_plan_item",
    ]) {
      expect(screen.getByText(tool)).toBeVisible();
    }
  });

  it("closes honestly - open source, free while in beta, no fabricated proof", () => {
    renderLanding();

    expect(screen.getByText(/Open source under MIT/)).toBeVisible();
    expect(screen.getByText(/Free while in beta/)).toBeVisible();
    // The truthful-SaaS rule, pinned: these genre staples must never appear.
    expect(screen.queryByText(/Trusted by/i)).toBeNull();
    expect(screen.queryByText(/testimonial/i)).toBeNull();
  });

  it("shows the product, not placeholders", () => {
    renderLanding();

    expect(screen.getByAltText(/mission board/i)).toHaveAttribute(
      "src",
      "/assets/landing/board.png",
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- --maxWorkers=2 landing-page`
Expected: FAIL, "Failed to resolve import ./landing-page".

- [ ] **Step 3: Implement the page**

Create `src/features/landing/landing-page.tsx`:

```tsx
/**
 * The storefront at "/" for signed-out visitors.
 *
 * Built from the app's own visual system - the real galaxy, the real orb, the
 * real glow classes - because the product IS the visual system, and a
 * marketing page faking it would undersell the thing it advertises.
 *
 * Copy rule, enforced by tests: everything on this page is true today. No
 * invented numbers, no testimonials, no pricing tiers. When that stops being
 * enough, this becomes a separate site - see the spec.
 */
import { Link } from "react-router-dom";
import { Orb } from "../../components/orb";
import { StarFieldBackground } from "../../components/space-visuals";
import { orbitAssets } from "../../lib/orbit-assets";

const REPO_URL = "https://github.com/PhilPNG/orbit-flo";

const agentTools = [
  "list_projects",
  "get_flight_plan",
  "create_task",
  "move_task",
  "search_workspace",
  "capture_thought",
  "complete_plan_item",
];

const features = [
  {
    title: "Today's flight plan",
    body: "A handful of items pulled from your boards each day, one marked primary. Completing one fires a launch streak.",
    image: { src: "/assets/landing/flight-plan.png", alt: "Daily flight plan with seeded items" },
  },
  {
    title: "Mission boards",
    body: "Projects are missions; their boards run Docked to In Orbit. Markdown descriptions, orbit: links between tasks, and an electric border on the column you are dragging into.",
    image: null,
  },
  {
    title: "Mission control",
    body: "Cross-project health, priority work, milestones and decisions on one dashboard that counts itself up as it loads.",
    image: { src: "/assets/landing/dashboard.png", alt: "Mission control dashboard" },
  },
  {
    title: "Capture everything",
    body: "Stray thoughts land in the inbox from anywhere in the app - or from your agent - and become tasks when you are ready.",
    image: null,
  },
];

export function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#020817] text-slate-100">
      <StarFieldBackground />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24">
        {/* Nav */}
        <header className="flex items-center justify-between py-6">
          <img
            alt="Orbit Flo"
            className="h-9 w-auto"
            src={orbitAssets.brand.lockupDark}
          />
          <nav className="flex items-center gap-3">
            <a
              className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
              href={REPO_URL}
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <Link className="orbit-button px-4 py-2 text-sm" to="/auth">
              Sign in
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="orbit-page-enter grid gap-10 py-14 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/80">
              Focus. Flow. Finish.
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-6xl">
              Mission control for your projects — and your agent&apos;s.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Orbit Flo takes software projects from idea to done — boards, daily flight
              plans, milestones and linked notes inside a live galaxy. And through WebMCP,
              a browser-hosted agent can work the same workspace you do.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link className="orbit-button px-6 py-3 text-base" to="/auth">
                Enter orbit
              </Link>
              <a
                className="rounded-md border border-slate-400/20 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-slate-300/40 hover:text-white"
                href={REPO_URL}
                rel="noreferrer"
                target="_blank"
              >
                View source
              </a>
            </div>
          </div>

          <figure className="orbit-panel overflow-hidden rounded-2xl p-2">
            <img
              alt="A mission board with tasks moving from Docked to In Orbit"
              className="w-full rounded-xl"
              height={900}
              src="/assets/landing/board.png"
              width={1440}
            />
          </figure>
        </section>

        {/* The differentiator */}
        <section className="orbit-panel mt-10 rounded-2xl p-8 sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300/80">
            WebMCP inside
          </p>
          <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
            Your agent works here too.
          </h2>
          <p className="mt-4 max-w-3xl text-slate-300">
            Orbit Flo registers seven tools with the browser&apos;s WebMCP surface. An
            agent-hosting browser can plan your day, file tasks, and triage your inbox —
            in your session, on your screen, with its work landing on your board live.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {agentTools.map((tool) => (
              <li
                className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-mono text-xs text-cyan-100"
                key={tool}
              >
                {tool}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-sm text-slate-400">
            The agent gets your session; the database decides what it can touch.
            Row-level security and column grants bound every tool call — and those
            grants are verified in CI on every pull request.
          </p>
        </section>

        {/* Features */}
        <section className="mt-16 grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <article className="orbit-panel rounded-2xl p-6" key={feature.title}>
              <h3 className="text-xl font-bold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{feature.body}</p>
              {feature.image ? (
                <img
                  alt={feature.image.alt}
                  className="mt-4 w-full rounded-lg border border-slate-400/10"
                  height={900}
                  loading="lazy"
                  src={feature.image.src}
                  width={1440}
                />
              ) : null}
            </article>
          ))}
        </section>

        {/* Honest close */}
        <section className="mt-20 grid items-center gap-8 lg:grid-cols-[1fr_280px]">
          <div>
            <h2 className="text-3xl font-black text-white">
              Open source under MIT.
            </h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              Free while in beta. Bring your own Supabase project, or sign in and try
              it — the code, the schema, and the CI that guards its privilege model are
              all public.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link className="orbit-button px-6 py-3 text-base" to="/auth">
                Enter orbit
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="relative mx-auto h-64 w-64">
            <Orb />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-slate-400/10 pt-6 text-sm text-slate-400">
          <span>MIT licensed. Built for the WebMCP challenge.</span>
          <a className="transition hover:text-white" href={REPO_URL} rel="noreferrer" target="_blank">
            github.com/PhilPNG/orbit-flo
          </a>
        </footer>
      </div>
    </main>
  );
}

export default LandingPage;
```

- [ ] **Step 4: Run the landing tests**

Run: `npm test -- --maxWorkers=2 landing-page`
Expected: PASS, 5 tests. If `orbit-button` or `orbit-panel` class names differ
from what `styles.css` actually defines, use the real class names — check
`src/features/auth/auth-page.tsx` for how the sign-in button is styled and
match it. Report any substitution.

- [ ] **Step 5: Write the failing HomeRoute test**

Create `src/app/home-route.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const authState = { isLoading: false, session: null, user: null as null | { id: string } };

vi.mock("../features/auth/use-auth", () => ({
  useAuth: () => authState,
}));

vi.mock("../features/workspaces/workspace-redirect", () => ({
  WorkspaceRedirect: () => <div>workspace redirect</div>,
}));

vi.mock("./route-loaders", () => ({
  loadLandingPage: () => Promise.resolve({ default: () => <div>landing page</div> }),
}));

import { HomeRoute } from "./home-route";

function renderHome() {
  return render(
    <MemoryRouter>
      <HomeRoute />
    </MemoryRouter>,
  );
}

afterEach(() => {
  authState.isLoading = false;
  authState.user = null;
});

describe("HomeRoute", () => {
  it("shows the landing page to a signed-out visitor", async () => {
    renderHome();

    expect(await screen.findByText("landing page")).toBeVisible();
  });

  it("keeps the signed-in redirect exactly as before", () => {
    authState.user = { id: "user-1" };
    renderHome();

    expect(screen.getByText("workspace redirect")).toBeVisible();
    expect(screen.queryByText("landing page")).toBeNull();
  });

  it("shows the loader while auth is still resolving", () => {
    authState.isLoading = true;
    renderHome();

    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByText("landing page")).toBeNull();
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npm test -- --maxWorkers=2 home-route`
Expected: FAIL, "Failed to resolve import ./home-route".

- [ ] **Step 7: Implement HomeRoute and wire the seams**

Add to `src/app/route-loaders.ts`, matching the file's existing style exactly:

```ts
export function loadLandingPage() {
  return import("../features/landing/landing-page");
}
```

Create `src/app/home-route.tsx`:

```tsx
/**
 * "/" is the only route that branches on auth state instead of requiring it:
 * signed-out visitors get the storefront, signed-in users get exactly the
 * redirect they always got - including WorkspaceRedirect's pending-invitation
 * handling, which lives in that component untouched.
 */
import { lazy, Suspense } from "react";
import { SatelliteLoader, StarFieldBackground } from "../components/space-visuals";
import { useAuth } from "../features/auth/use-auth";
import { WorkspaceRedirect } from "../features/workspaces/workspace-redirect";
import { loadLandingPage } from "./route-loaders";

const LandingPage = lazy(loadLandingPage);

function HomeLoader() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020817] px-6">
      <StarFieldBackground />
      <div className="relative z-10">
        <SatelliteLoader label="Preparing your orbit" />
      </div>
    </main>
  );
}

export function HomeRoute() {
  const { isLoading, user } = useAuth();

  if (isLoading) return <HomeLoader />;
  if (user) return <WorkspaceRedirect />;

  return (
    <Suspense fallback={<HomeLoader />}>
      <LandingPage />
    </Suspense>
  );
}
```

In `src/app/routes.tsx`: import `HomeRoute` and change **only** the `/` route
from `<Route element={<ResolveWorkspace />} path="/" />` to
`<Route element={<HomeRoute />} path="/" />`. Every other `ResolveWorkspace`
route stays.

In `src/app/App.test.tsx`: add one key to the existing `./route-loaders` mock,
beside its siblings:

```ts
  loadLandingPage: () => Promise.resolve({ default: () => <div>Landing page</div> }),
```

This is the single permitted existing-test edit. Do not change any assertion.

- [ ] **Step 8: Update the page metadata**

In `index.html`, set the title to
`Orbit Flo — mission control for your projects` and the meta description to
`A deep-space project workspace you share with your agent. Boards, daily flight plans, milestones and linked notes — with seven WebMCP tools bounded by row-level security.`

- [ ] **Step 9: Run everything**

```bash
npm test -- --maxWorkers=2 landing-page home-route App
npm test -- --maxWorkers=2
npm run build
```

Expected: the full suite at **821 + 8 = 829 passing**, clean build. If
`App.test.tsx` fails, the wiring broke the signed-in path — fix the wiring,
never the assertions.

- [ ] **Step 10: Commit**

```bash
git add src/features/landing/ src/app/home-route.tsx src/app/home-route.test.tsx src/app/route-loaders.ts src/app/routes.tsx src/app/App.test.tsx index.html public/assets/landing/ scripts/capture-readme.mjs
git commit -m "feat: a storefront at / for signed-out visitors"
```

---

## Self-review notes

**Spec coverage.** Routing branch → `home-route.tsx` with all three states
tested. Page sections, copy rules, and the truthful-close guard → the landing
test's `queryByText(/Trusted by/)` assertions. Assets → prior work, committed
here. Metadata → Step 8. The CI trap → the `route-loaders` seam plus the one
called-out mock key.

**The one deliberate style risk.** The plan's JSX uses `orbit-button` and
`orbit-panel`, which exist in `styles.css` — but Step 4 tells the implementer
to verify against the auth page's real button styling rather than trust the
plan, and to report substitutions. Copy is exact; class names are verified.

**Why the truthful-close test asserts absences.** "No testimonials" is a spec
rule, and rules without tests decay — the same reasoning as the seven-tools
`toEqual`. A future edit that pastes in genre filler fails the build.
