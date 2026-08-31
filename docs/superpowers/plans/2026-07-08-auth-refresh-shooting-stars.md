# Auth Refresh + Shooting Stars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blend the auth orbit scene into its card, declutter the auth marketing panel, and add three co-prime-timed shooting-star variants to the site-wide starfield.

**Architecture:** Pure CSS + JSX pruning. Shooting stars live in `StarFieldBackground` (used by both the app shell and the auth page), each with its own keyframes/duration/delay so the pattern never perceptibly repeats. The orbit scene's box chrome is replaced by a radial `mask-image` feather.

**Tech Stack:** React 19, `src/styles.css`, vitest + testing-library.

**Spec:** `docs/superpowers/specs/2026-07-08-auth-refresh-shooting-stars-design.md`

## Global Constraints

- Work in `C:\src\Personal\ToDo\.worktrees\project-command-center` on `codex/project-command-center`.
- No new dependencies. Animations only inside `@media (prefers-reduced-motion: no-preference)`; base classes render invisible (`opacity: 0`) without it.
- Modesty: 1px streaks, peak opacity 0.7, visible <6% of each cycle. Cycles 23s/37s/53s (co-prime).
- Keep `data-testid="auth-orbit-scene"` and all auth copy in the right column.
- Commit after every task.

---

### Task 1: Shooting stars in the starfield

**Files:**
- Modify: `src/components/space-visuals.tsx` (StarFieldBackground)
- Modify: `src/components/space-visuals.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Extend the starfield test**

In `src/components/space-visuals.test.tsx`, inside the "renders layered starfield depth" test, add after the star-flare assertion:

```tsx
    const shootingStars = container.querySelectorAll(".shooting-star");
    expect(shootingStars).toHaveLength(3);
    expect(container.querySelector(".shooting-star-one")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".shooting-star-two")).toBeTruthy();
    expect(container.querySelector(".shooting-star-three")).toBeTruthy();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/space-visuals.test.tsx`
Expected: FAIL — 0 shooting stars found.

- [ ] **Step 3: Add the spans**

In `StarFieldBackground`, after the third `orbit-star-flare` span and before the `orbit-grain` div, add:

```tsx
      <span aria-hidden="true" className="shooting-star shooting-star-one" />
      <span aria-hidden="true" className="shooting-star shooting-star-two" />
      <span aria-hidden="true" className="shooting-star shooting-star-three" />
```

- [ ] **Step 4: Add the CSS**

In `src/styles.css`, after the `.orbit-star-flare-small` rule, add:

```css
.shooting-star {
  position: absolute;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.7), rgba(103, 232, 249, 0.4), transparent);
  opacity: 0;
  pointer-events: none;
}

.shooting-star::before {
  content: "";
  position: absolute;
  left: -1px;
  top: -1px;
  height: 3px;
  width: 3px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 0 6px 1px rgba(255, 255, 255, 0.8);
}

.shooting-star-one {
  left: 6%;
  top: 12%;
  width: 7rem;
}

.shooting-star-two {
  left: 58%;
  top: 8%;
  width: 10rem;
}

.shooting-star-three {
  left: 10%;
  top: 46%;
  width: 5rem;
}
```

Inside the `@media (prefers-reduced-motion: no-preference)` block (next to the starfield drift hookups), add:

```css
  .shooting-star-one {
    animation: shooting-star-one 23s linear infinite;
  }

  .shooting-star-two {
    animation: shooting-star-two 37s 9s linear infinite;
  }

  .shooting-star-three {
    animation: shooting-star-three 53s 21s linear infinite;
  }
```

At the bottom of the file with the other top-level keyframes, add (distinct angles, travel, and visible windows: ~1.0s / ~1.4s / ~0.8s):

```css
@keyframes shooting-star-one {
  0% {
    opacity: 0;
    transform: rotate(-35deg) translateX(0);
  }
  1.2% {
    opacity: 0.7;
  }
  4.3% {
    opacity: 0;
    transform: rotate(-35deg) translateX(44rem);
  }
  100% {
    opacity: 0;
    transform: rotate(-35deg) translateX(44rem);
  }
}

@keyframes shooting-star-two {
  0% {
    opacity: 0;
    transform: rotate(-20deg) translateX(0);
  }
  1% {
    opacity: 0.6;
  }
  3.8% {
    opacity: 0;
    transform: rotate(-20deg) translateX(56rem);
  }
  100% {
    opacity: 0;
    transform: rotate(-20deg) translateX(56rem);
  }
}

@keyframes shooting-star-three {
  0% {
    opacity: 0;
    transform: rotate(-50deg) translateX(0);
  }
  0.5% {
    opacity: 0.7;
  }
  1.5% {
    opacity: 0;
    transform: rotate(-50deg) translateX(30rem);
  }
  100% {
    opacity: 0;
    transform: rotate(-50deg) translateX(30rem);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/space-visuals.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/space-visuals.tsx src/components/space-visuals.test.tsx src/styles.css
git commit -m "Add varied shooting stars to the starfield"
```

---

### Task 2: Blend the orbit scene and declutter the auth panel

**Files:**
- Modify: `src/components/auth-orbit-scene.tsx` (remove metric cards)
- Modify: `src/features/auth/auth-page.tsx:138-144` (remove telemetry chips)
- Modify: `src/styles.css` (`.auth-orbit-scene` feather)

- [ ] **Step 1: Remove the fake metric cards**

In `src/components/auth-orbit-scene.tsx`, delete:

```tsx
      <div className="auth-orbit-metric auth-orbit-metric-left">
        <span>42</span>
        <small>tasks aligned</small>
      </div>
      <div className="auth-orbit-metric auth-orbit-metric-right">
        <span>3</span>
        <small>orbits live</small>
      </div>
```

- [ ] **Step 2: Remove the telemetry chips from the auth page**

In `src/features/auth/auth-page.tsx`, delete:

```tsx
              <div className="mt-4 grid max-w-md gap-3">
                {["Launch your next task", "Map project constellations", "Reach mission success"].map((item) => (
                  <div className="telemetry-chip rounded-lg px-4 py-3 text-sm font-semibold text-cyan-50" key={item}>
                    {item}
                  </div>
                ))}
              </div>
```

- [ ] **Step 3: Feather the scene into the card**

In `src/styles.css`, replace:

```css
.auth-orbit-scene {
  position: relative;
  isolation: isolate;
  aspect-ratio: 1;
  width: min(100%, 25rem);
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid rgba(34, 211, 238, 0.18);
  background:
    radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.18), transparent 18%),
    radial-gradient(circle at 64% 30%, rgba(124, 58, 237, 0.2), transparent 30%),
    linear-gradient(145deg, rgba(2, 8, 23, 0.92), rgba(6, 18, 37, 0.82));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 24px 64px rgba(2, 8, 23, 0.32);
}
```

with:

```css
.auth-orbit-scene {
  position: relative;
  isolation: isolate;
  aspect-ratio: 1;
  width: min(100%, 28rem);
  margin-inline: auto;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.14), transparent 60%);
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 55%, transparent 78%);
  mask-image: radial-gradient(circle at 50% 50%, #000 55%, transparent 78%);
}
```

Also delete the now-unused metric CSS: remove `.auth-orbit-metric` from the shared `position: absolute` selector list (`.auth-orbit-glow, .auth-orbit-ring, ... .auth-orbit-card, .auth-orbit-metric { position: absolute; }` — drop the last item), delete the `.auth-orbit-metric { flex-direction: column; ... }`, `.auth-orbit-metric span`, `.auth-orbit-metric small`, `.auth-orbit-metric-left`, `.auth-orbit-metric-right` rules, and change `.auth-orbit-card, .auth-orbit-metric` selectors (the base style block and the `orbit-float` animation hookup) to just `.auth-orbit-card`.

- [ ] **Step 4: Verify**

Run: `npx vitest run src/features/auth src/components 2>&1 | tail -4`
Expected: all PASS.

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth-orbit-scene.tsx src/features/auth/auth-page.tsx src/styles.css
git commit -m "Blend auth orbit scene into the card and declutter the panel"
```

---

### Task 3: Verification pass

- [ ] **Step 1:** `npx vitest run --maxWorkers=2` — all green (~265).
- [ ] **Step 2:** `npm run e2e` — smoke passes (asserts the scene testid + headings, all kept).
- [ ] **Step 3:** Fake-session Playwright screenshots: auth page (blend + declutter) and Today page. Shooting stars are DOM/test-verified; a screenshot catching a streak is a bonus, not required.
- [ ] **Step 4:** Commit any polish as `Polish auth blend after visual verification`.

## Self-Review (completed)

- **Spec coverage:** shooting-star variants w/ co-prime cycles + modesty constraints ✔ (T1), scene feather + 28rem + declutter ✔ (T2), reduced-motion gating ✔ (base opacity 0 + hooks in media query), testing ✔ (T1 assertion, T3 e2e/screenshots).
- **Placeholders:** none.
- **Type consistency:** CSS class names match between component spans and stylesheet.
