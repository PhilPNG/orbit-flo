# Auth Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brand-correct "Sign in with" buttons, one-row headline, centered left panel with new tagline, and a four-chip orbit scene with twinkles.

**Architecture:** New `brand-icons.tsx` holds three inline-SVG brand marks. All other changes are copy/class edits in `auth-page.tsx`, chip/twinkle additions in `auth-orbit-scene.tsx`, and CSS for positions/delays/twinkle keyframes.

**Tech Stack:** React 19, `src/styles.css`, vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-auth-polish-design.md`

## Global Constraints

- Work in `C:\src\Personal\ToDo\.worktrees\project-command-center` on `codex/project-command-center`. No new dependencies. Twinkle animations only inside the reduced-motion media gate. Commit per task.

---

### Task 1: Brand icons + button copy

**Files:**
- Create: `src/components/brand-icons.tsx`
- Create: `src/components/brand-icons.test.tsx`
- Modify: `src/features/auth/auth-page.tsx` (provider list + button copy)

**Interfaces:**
- Produces: `GoogleMark`, `GitHubMark`, `AppleMark` — each `({ className }: { className?: string })` returning an `aria-hidden` SVG.

- [ ] **Step 1: Failing test** — `src/components/brand-icons.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppleMark, GitHubMark, GoogleMark } from "./brand-icons";

describe("brand icons", () => {
  it.each([
    ["google", GoogleMark],
    ["github", GitHubMark],
    ["apple", AppleMark],
  ])("renders the %s mark as decorative svg", (_name, Mark) => {
    const { container } = render(<Mark className="h-4 w-4" />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("h-4", "w-4");
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/components/brand-icons.test.tsx` → FAIL (module not found).

- [ ] **Step 3: Implement** — `src/components/brand-icons.tsx` (official paths: Google multi-color G; GitHub octocat; Apple mark):

```tsx
type MarkProps = { className?: string };

export function GoogleMark({ className }: MarkProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" fill="#4285F4" />
      <path d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z" fill="#34A853" />
      <path d="M5.28 14.28a7.21 7.21 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z" fill="#FBBC05" />
      <path d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z" fill="#EA4335" />
    </svg>
  );
}

export function GitHubMark({ className }: MarkProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58l-.01-2.03c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.49 5.92.43.38.82 1.11.82 2.24l-.01 3.32c0 .32.21.7.82.58A12 12 0 0 0 12 .3Z"
        fill="#ffffff"
      />
    </svg>
  );
}

export function AppleMark({ className }: MarkProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16.37 12.76c.03 3.24 2.84 4.32 2.87 4.33-.02.08-.45 1.54-1.48 3.05-.89 1.3-1.82 2.6-3.28 2.63-1.43.03-1.9-.85-3.54-.85-1.64 0-2.15.82-3.51.88-1.41.05-2.48-1.41-3.38-2.7C2.2 17.44.8 12.62 2.69 9.39a5.25 5.25 0 0 1 4.44-2.7c1.38-.03 2.69.93 3.54 .93.84 0 2.43-1.15 4.1-.98.7.03 2.66.28 3.92 2.13-.1.06-2.34 1.37-2.32 4Zm-2.7-7.85c.75-.9 1.25-2.16 1.11-3.41-1.08.04-2.38.72-3.15 1.62-.69.8-1.3 2.08-1.13 3.3 1.2.1 2.42-.61 3.17-1.51Z"
        fill="#ffffff"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Wire into the page** — in `src/features/auth/auth-page.tsx`:

Replace the lucide import line's `Apple, GitBranch, Globe2,` entries (keep `ArrowRight, LockKeyhole, Mail`) and add:

```tsx
import { AppleMark, GitHubMark, GoogleMark } from "../../components/brand-icons";
```

Replace the provider catalog:

```tsx
const oauthProviders: Array<{
  label: string;
  provider: OAuthProvider;
  icon: (props: { className?: string }) => JSX.Element;
}> = [
  { label: "Google", provider: "google", icon: GoogleMark },
  { label: "GitHub", provider: "github", icon: GitHubMark },
  { label: "Apple", provider: "apple", icon: AppleMark },
];
```

and the button body text `Continue with {label}` → `Sign in with {label}` (the `<Icon className="h-4 w-4" aria-hidden="true" />` call keeps working; drop the extra `aria-hidden` prop if TypeScript complains — the SVGs set it internally).

- [ ] **Step 5:** `npx vitest run src/components/brand-icons.test.tsx src/features/auth` → PASS. Commit `Add brand marks and sign-in copy`.

---

### Task 2: Panel copy, centering, richer scene

**Files:**
- Modify: `src/features/auth/auth-page.tsx` (headline/tagline/centering)
- Modify: `src/components/auth-orbit-scene.tsx` (chips + twinkles)
- Modify: `src/styles.css`

- [ ] **Step 1: Copy + centering** — in `auth-page.tsx` replace:

```tsx
              <h1 className="mt-10 max-w-lg text-5xl font-black leading-[1.03]">
                Your mission control for calm productivity.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
                Bring scattered tasks, plans, decisions, and reviews into one guided orbit.
              </p>
              <AuthOrbitScene />
```

with:

```tsx
              <h1 className="mt-10 text-4xl font-black leading-tight md:whitespace-nowrap">
                Your Mission Control for Productivity
              </h1>
              <p className="mt-4 text-center text-lg font-semibold text-slate-300">
                Launch your projects to Orbit.
              </p>
              <AuthOrbitScene />
```

and the footer line:

```tsx
            <p className="max-w-sm text-sm leading-6 text-slate-400">
```

→

```tsx
            <p className="mx-auto max-w-sm text-center text-sm leading-6 text-slate-400">
```

(The scene already centers via `margin-inline: auto`; the tagline/footer center via the classes above.)

- [ ] **Step 2: Scene chips + twinkles** — in `auth-orbit-scene.tsx` replace the `satellites` array with:

```tsx
const satellites = [
  { label: "Plan", className: "auth-orbit-satellite-one", tone: "cyan" },
  { label: "Brainstorm", className: "auth-orbit-satellite-two", tone: "blue" },
  { label: "Mind map", className: "auth-orbit-satellite-three", tone: "violet" },
  { label: "Review", className: "auth-orbit-satellite-four", tone: "cyan" },
];
```

and add inside the scene root, after the second orbit path:

```tsx
      <span className="auth-orbit-twinkle auth-orbit-twinkle-one" />
      <span className="auth-orbit-twinkle auth-orbit-twinkle-two" />
```

- [ ] **Step 3: CSS** — in `src/styles.css`, next to `.auth-orbit-satellite-one`, add:

```css
.auth-orbit-satellite-two {
  right: 5%;
  top: 30%;
}

.auth-orbit-satellite-three {
  bottom: 16%;
  right: 12%;
}

.auth-orbit-satellite-four {
  bottom: 22%;
  left: 6%;
}

.auth-orbit-twinkle {
  position: absolute;
  height: 3px;
  width: 3px;
  border-radius: 999px;
  background: #ffffff;
  opacity: 0.25;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.7);
}

.auth-orbit-twinkle-one {
  left: 24%;
  top: 14%;
}

.auth-orbit-twinkle-two {
  right: 20%;
  bottom: 30%;
}
```

Inside the motion media query, after the `.auth-orbit-card` hookup, add:

```css
  .auth-orbit-satellite-two {
    animation-delay: 700ms;
  }

  .auth-orbit-satellite-three {
    animation-delay: 1400ms;
  }

  .auth-orbit-satellite-four {
    animation-delay: 2100ms;
  }

  .auth-orbit-twinkle-one {
    animation: auth-twinkle 6s ease-in-out infinite;
  }

  .auth-orbit-twinkle-two {
    animation: auth-twinkle 8s 2s ease-in-out infinite;
  }
```

and with the top-level keyframes:

```css
@keyframes auth-twinkle {
  0%,
  100% {
    opacity: 0.15;
  }

  50% {
    opacity: 0.8;
  }
}
```

- [ ] **Step 4:** `npx vitest run src/features/auth src/components 2>&1 | tail -3` → PASS; `npm run e2e` → PASS. Commit `Polish auth panel copy and enrich orbit scene`.

---

### Task 3: Verification

- [ ] `npx vitest run --maxWorkers=2` green; `npm run build` clean; auth-page screenshot (one-row headline, centered content, 4 chips, brand marks).

## Self-Review (completed)

Spec coverage ✔ (buttons T1; headline/tagline/centering/scene T2). No placeholders. `icon` prop type matches usage.
