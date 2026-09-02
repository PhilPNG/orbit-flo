# Adaptive performance, a rotating loader, and a real marketing site

Three user asks, one spec. Branched from `codex/agent-tools-v2` (PR #67
pending); rebase onto `main` once it merges. **Everything here sits behind the
same gate as v2: the rehearsal and Tuesday's video outrank it.**

## Part 1: Performance — measured, then cut

### The numbers (headed Chromium, anti-throttle flags, this machine's Intel UHD)

| Configuration | Median frame |
|---|---|
| `about:blank` baseline | 20 ms |
| Any app page today | ~100 ms (10 fps) |
| Galaxy dieted (DPR 1.0, 3 layers) | 80 ms |
| WebGL disabled → CSS starfield | **20 ms** |

The galaxy shader is ~75% of all frame cost on integrated graphics, even
dieted. Topography adds nothing measurable on top. The glow shadows and
backdrop-blurs are not the frame problem. The user's lag is real, and it has
one dominant cause.

### The fix: adaptive quality, not a blanket downgrade

1. **The diet ships anyway**: galaxy `MAX_DPR` 1.5 → 1.0 and `NUM_LAYER`
   4 → 3 — visually near-identical, ~20% cheaper, benefits every machine.
2. **Self-measurement**: after the galaxy canvas has run for ~3 seconds,
   `StarFieldBackground` samples frame intervals. If the median exceeds 40 ms,
   it flips to the CSS fallback — the same one no-WebGL machines already get —
   and records `orbit-flo:reduce-gpu` in `localStorage` so every later mount
   (and the Orb, and Topography, which read the same flag) skips WebGL
   instantly instead of re-measuring.
3. **Escape hatch both ways**: clearing the flag re-enables the trial. The
   sampling logic is a pure function (`decideQuality(samples): "keep" | "fallback"`)
   with tests; the sampling loop itself is a few lines in the existing rAF.

Fast machines keep the signature visual. Machines like this one get a page
that runs at full rate with a backdrop that still looks like the same product
— that was the whole point of building the fallback properly in #57.

## Part 2: The loading screen rotates

**React Bits' "Rotating Stars" is Pro — paid, proprietary, source behind a
paywall.** It cannot be vendored, and could not legally enter the MIT public
repo the hackathon requires. What ships instead is ours: the loading screen's
existing `StarFieldBackground` gains a slow rotation — a wrapper class
animating a full revolution over ~240 s, applied **only** on the loading
screens (`RequireAuth`'s loader, `HomeRoute`'s loader, `DelayedFallback`'s
shell), inside the existing reduced-motion media block. Fifteen lines of CSS,
same visual idea, MIT.

The rotating wrapper is scaled ~1.4× so corners never expose the layer edge
mid-rotation (the star layers already bleed 220 px; rotation needs the
diagonal covered).

## Part 3: The marketing site goes multi-page

User's call: separate routes rather than one long page.

### Routes — all public, all lazy, all through `route-loaders`

| Route | Content |
|---|---|
| `/` | Home: hero, the agent section, three feature teasers, honest close (trimmed from today's single page) |
| `/features` | The full tour: boards, flight plan, inbox, Signals, Brainstorm & link graph, mind maps, calendar, weekly reviews — with fresh screenshots |
| `/agent` | The WebMCP story in depth: the ten tools, the RLS boundary, the CI guard, how to try it |
| `/open-source` | MIT, the public repo, the verification story (guards in CI, 838 tests), how to self-host |

A shared `MarketingLayout` carries the nav (logo, Features, Agent, Open
source, Sign in) and footer; each page is its own lazy chunk. Signed-out
visitors can browse all four; they are plain public routes with **no** auth
gate — but each still renders `StarFieldBackground` (which now self-adapts,
per Part 1). Signed-in users visiting them see the same pages — marketing
does not redirect, matching how real SaaS sites behave.

`/features` needs screenshots that do not yet exist (Signals, Brainstorm's
link graph, a mind map, calendar). The capture script gains those stops **if
the seeded workspace can show them** — the demo seed has no note links, no
mind map, and no signals. Rather than seed new fixtures under deadline, pages
describe those features in text and card form, and only screens the seed can
genuinely show get screenshots. **No mock screenshots, no staged fakes** —
the truthful-SaaS rule extends to imagery.

The existing landing tests move/adapt to the new Home page — the truthful
absences (`Trusted by`, testimonials) now assert across the shared layout so
they cover all four pages.

## Files

- Modify `src/components/galaxy-canvas.tsx` — diet + `decideQuality` + flag
- Modify `src/components/space-visuals.tsx`, `orb.tsx`, `topography.tsx` —
  read the flag
- Modify `src/styles.css` — loader rotation, marketing styles as needed
- Create `src/features/marketing/` — layout + four pages + tests (landing
  feature folder renames/absorbs into it)
- Modify `src/app/route-loaders.ts`, `routes.tsx`, `App.test.tsx` (mock keys)
- Modify `scripts/capture-readme.mjs` — extra stops for seed-showable screens

## Testing

- `decideQuality` tested as a pure function (keep under threshold, fallback
  over it, insufficient samples → keep).
- The flag path: with `orbit-flo:reduce-gpu` set, no canvas mounts in any of
  the three WebGL components — tested with the fake-registry-style stubs
  already established.
- Marketing pages: content + CTA href tests per page; the absence assertions
  live once in the layout test.
- Full suite stays green (838 + new); the CI env trap rules apply to every
  new chunk.

## Risks

- **Three workstreams, two days, rehearsal unrun.** Order of implementation:
  Part 1 (perf — it fixes the thing the user can feel), Part 2 (trivial),
  Part 3 (largest, cut first if the clock bites). The Devpost writeup and
  video do not depend on Part 3.
- **Adaptive fallback mid-session** is a visible switch (galaxy fades to
  static stars ~3 s in on slow machines). Acceptable: it is the moment the
  page *stops* lagging.
- **Multi-page SEO/meta** kept minimal: per-page `document.title` only.
