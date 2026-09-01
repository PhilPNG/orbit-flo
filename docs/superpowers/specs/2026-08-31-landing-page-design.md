# The landing page: Orbit Flo as a storefront

**Built on the hackathon clock (submission Sep 2), and a lasting product asset
after it.** Branched from `main` at `86abbc7`.

## The problem

The live URL — the first thing a Devpost judge opens — redirects straight to a
sign-in form. Everything persuasive about the product (the galaxy, the agent
integration, the screenshots just captured for the README) is invisible until
after authentication. A product with no storefront reads as a demo; the ask is
to read as a SaaS.

## Decisions (made with the user)

- **Inside the app at `/`**, not a separate site. One deploy; the page is built
  from the app's own visual system — real WebGL galaxy, real orb, real glow —
  and it is exactly what judges hit.
- **Truthful SaaS.** Full landing structure, zero fabrication: no invented
  testimonials, no fake logos, no pricing tiers. The honest close is that the
  product is MIT open source and free while in beta.
- **No demo credentials on the page.** The landing sells; credentials stay in
  the Devpost submission text.

## Design

### Routing: one branch

`/` currently routes `ResolveWorkspace` → `RequireAuth` → signed-out visitors
bounce to `/auth`. A new `HomeRoute` replaces it **at `/` only**:

- auth loading → the existing satellite loader (unchanged look)
- signed in → the existing `WorkspaceRedirect`, byte-for-byte behaviour,
  including its pending-invitation handling
- signed out → a lazy-loaded `LandingPage`

Every other pre-workspace path (`/dashboard`, `/projects`, `/calendar`, …)
keeps today's redirect-to-auth behaviour untouched. Deep links do not acquire
a marketing detour.

### The page, top to bottom

1. **Nav** — Orbit Flo mark and wordmark, a GitHub link
   (`https://github.com/PhilPNG/orbit-flo`), and a "Sign in" button → `/auth`.
2. **Hero** — headline *"Mission control for your projects — and your
   agent's."*, a one-sentence subhead, CTAs **Enter orbit** (→ `/auth`) and
   **View source** (→ GitHub), and the board screenshot in a glowing
   `surface-focus`-style frame. The board shot carries the topography
   contours, the seeded cards, and the space-stage columns — it is the single
   most persuasive image the project owns.
3. **"Your agent works here too"** — the differentiator. Short copy, the seven
   tool names as chips, and the security line: *the agent gets your session;
   the database decides what it can touch — verified in CI on every pull
   request.*
4. **Feature grid** — four glowing cards: Flight plan, Mission boards,
   Brainstorm & linked notes, Signals. One sentence each; the flight-plan and
   dashboard screenshots back two of them.
5. **Honest close** — "Open source under MIT. Free while in beta." with the
   `Orb` component as the visual and a final **Enter orbit** CTA.
6. **Footer** — MIT, GitHub, a quiet "built for the WebMCP challenge" line.

### Reuse, not imitation

The page renders the app's own `StarFieldBackground` (galaxy with all its
guards), `Orb`, and the glow/panel classes from `styles.css`. No new visual
vocabulary, no new animation verbs — entrance settles and static glow only.
The galaxy and orb are the page's only loops, and both already carry
reduced-motion, visibility, and WebGL guards.

### Assets

The README screenshots are 1.2–2.8 MB each — README-appropriate,
landing-inappropriate. `scripts/capture-readme.mjs` gains a `--landing` mode:
same flow, `deviceScaleFactor: 1`, writing to `public/assets/landing/`
(~400–700 KB each). The page uses exactly three: board (hero), dashboard and
flight-plan (feature grid). Images carry real `alt` text, `loading="lazy"`
below the hero, and explicit dimensions so the page does not shift as they
arrive.

### Copy rules

Everything on the page must be true today: no user counts, no testimonials,
no "trusted by", no tiers. The WebMCP claims match what shipped (seven tools,
CI-verified grants). The one forward-looking line — "free while in beta" — is
a statement of current fact.

## Files

- Create `src/features/landing/landing-page.tsx` and its test
- Modify `src/app/routes.tsx` — `HomeRoute` at `/`; nothing else
- Modify `scripts/capture-readme.mjs` — the `--landing` mode
- Create `public/assets/landing/*.png` — three captures
- Modify `index.html` — title and meta description worthy of a link preview

No schema, query, or mutation change. No new dependency.

## Testing

- **`LandingPage` renders the headline, both hero CTAs (asserted by `href`),
  the seven tool chips, and the GitHub link.** Content assertions, since copy
  is the product here.
- **Signed-out `/` shows the landing** — routing test with the established
  auth-mock pattern.
- **The signed-in redirect keeps its existing coverage**; `HomeRoute` must not
  alter `WorkspaceRedirect` semantics, including the pending-invitation path.
- **The CI env trap applies** (green locally, red in CI): the landing page and
  its test must not pull the Supabase client into module scope on an
  unstubbed path. `App.test.tsx` gets whatever stub the other lazy routes
  already use, per `createVisualQueryClient` conventions.
- The full suite must stay at 821 passing, no existing test modified except
  any route-level test that legitimately asserts today's `/`-redirects-to-auth
  behaviour — if one exists, it changes to assert the new landing behaviour,
  and the change is called out, not buried.

## Risks

- **The clock.** Roughly half a day. If it threatens Monday's rehearsal or
  Tuesday's video, the cut is the whole feature — the app works without a
  storefront; the submission does not work without a video.
- **Bundle weight.** Three PNGs at ~500 KB each, lazy-loaded below the hero;
  the landing chunk itself is lazy so signed-in users never pay for it.
- **A marketing page inside an app invites drift.** Copy lives in one
  component with no CMS ambitions. When it outgrows that, it becomes the
  separate site this spec deliberately declined to build.

## Out of scope

A separate marketing site, pricing tiers, analytics, a waitlist, SEO beyond
title/description, and any new animation vocabulary.
