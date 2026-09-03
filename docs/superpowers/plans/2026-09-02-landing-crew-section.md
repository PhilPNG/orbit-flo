# Landing Site: Shared Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tell visitors that Orbit Flo is built for a crew: a "Bring the crew into orbit" section on the home page and a "Shared workspaces" card on the features page, with copy that is true today.

**Architecture:** Two marketing pages in `src/features/marketing/` are static React components with colocated Testing Library tests that enforce the copy rule. The home section reuses the WebMCP panel's structure (eyebrow, heading, paragraph, pill list, deeper link). The features card is a seventh entry in the existing `TEXT_SECTIONS` array, with an `id` so the home link can target it.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind + `src/styles.css`, Vitest 4 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-02-landing-crew-section-design.md`

## Global Constraints

- Work in the worktree `C:\src\Personal\ToDo\.worktrees\project-command-center` on branch `landing-crew-section`; run every command from there. Do not touch `C:\src\Personal\ToDo` itself.
- Copy rule: only claims true today; no invented numbers, testimonials or pricing; no new images (the features page must still render exactly 4 `img` elements).
- Exact copy (verbatim):
  - Home eyebrow `Shared workspaces`; heading `Bring the crew into orbit.`; body `Invite people to a workspace with a link and give them a role — owner, admin or member. Assign tasks to members, and get a signal when someone mentions or assigns you. Your daily flight plan and inbox stay yours; the mission boards, milestones and project notes are shared.`; pills `Invite by link`, `Owner · Admin · Member`, `Assign tasks`, `Mentions and assignment signals`, `Private flight plans`; link text `See how workspaces work →` to `/features#shared-workspaces`.
  - Features card title `Shared workspaces`, `id="shared-workspaces"`, body `Invite people with a link and give them a role — owner, admin or member. Members can be assigned tasks, can leave, and can be removed; a workspace always keeps an owner. Your flight plan and inbox are private to you; boards, milestones and project notes belong to the workspace.`
  - Mind maps card body becomes `Sketch a graph of ideas, arrange it with one click, and convert any node straight into a task, a note or a milestone without leaving the canvas.`
- `npm run build` runs `tsc -b` and includes test files, so tests must type-check; do not weaken assertions.
- Commit with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File map

| File | Responsibility |
|---|---|
| `src/features/marketing/home-page.tsx` | Storefront at `/`: gains the crew section |
| `src/features/marketing/home-page.test.tsx` | Copy-rule tests for the home page |
| `src/features/marketing/features-page.tsx` | Feature tour at `/features`: gains the card, fixes the mind-maps line |
| `src/features/marketing/features-page.test.tsx` | Copy-rule tests for the features page |

---

### Task 1: Features page card and mind-maps correction

**Files:**
- Modify: `src/features/marketing/features-page.tsx`
- Test: `src/features/marketing/features-page.test.tsx`

**Interfaces:**
- Produces: an `<article id="shared-workspaces">` on `/features` that the home page (Task 2) links to.

- [ ] **Step 1: Write the failing tests**

In `src/features/marketing/features-page.test.tsx`, change the title list in the "gives the un-screenshottable features an honest paragraph and no staged image" test to include the new card, and add one new test after it:

```tsx
    for (const title of [
      "Inbox",
      "Signals",
      "Brainstorm & linked notes",
      "Mind maps",
      "Calendar",
      "Weekly reviews",
      "Shared workspaces",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
    }
```

(keep the `expect(screen.getAllByRole("img")).toHaveLength(4);` assertion as it is), then:

```tsx
  it("describes shared workspaces truthfully and gives the card an anchor for the home page link", () => {
    renderFeatures();

    const heading = screen.getByRole("heading", { name: "Shared workspaces" });
    expect(heading.closest("article")).toHaveAttribute("id", "shared-workspaces");
    expect(screen.getByText(/owner, admin or member/)).toBeVisible();
    expect(screen.getByText(/a workspace always keeps an owner/)).toBeVisible();
    expect(screen.getByText(/flight plan and inbox are private to you/)).toBeVisible();
  });

  it("says what a mind-map node can become - a task, a note or a milestone", () => {
    renderFeatures();

    expect(screen.getByText(/a task, a note or a milestone/)).toBeVisible();
    expect(screen.queryByText(/a task or a project/)).toBeNull();
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test -- src/features/marketing/features-page.test.tsx`
Expected: FAIL — no heading "Shared workspaces"; the mind-maps text still reads "a task or a project".

- [ ] **Step 3: Implement**

In `src/features/marketing/features-page.tsx`:

1. Give `TextSection` an optional id:

```ts
type TextSection = {
  id?: string;
  title: string;
  body: string;
};
```

2. Replace the "Mind maps" entry's body and append the new card at the end of `TEXT_SECTIONS`:

```ts
  {
    title: "Mind maps",
    body: "Sketch a graph of ideas, arrange it with one click, and convert any node straight into a task, a note or a milestone without leaving the canvas.",
  },
```

```ts
  {
    id: "shared-workspaces",
    title: "Shared workspaces",
    body: "Invite people with a link and give them a role — owner, admin or member. Members can be assigned tasks, can leave, and can be removed; a workspace always keeps an owner. Your flight plan and inbox are private to you; boards, milestones and project notes belong to the workspace.",
  },
```

3. Render the id on the article:

```tsx
            <article className="orbit-panel rounded-2xl p-6" id={section.id} key={section.title}>
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/features/marketing/features-page.test.tsx`
Expected: PASS (all tests, including the unchanged 4-image assertion — the new card has no image).

- [ ] **Step 5: Commit**

```bash
git add src/features/marketing/features-page.tsx src/features/marketing/features-page.test.tsx
git commit -m "feat(marketing): shared workspaces card; mind maps convert to task, note or milestone"
```

---

### Task 2: Home page crew section

**Files:**
- Modify: `src/features/marketing/home-page.tsx`
- Test: `src/features/marketing/home-page.test.tsx`

**Interfaces:**
- Consumes: the `/features#shared-workspaces` anchor from Task 1.

- [ ] **Step 1: Write the failing test**

Append to the `describe("HomePage", …)` block in `src/features/marketing/home-page.test.tsx`:

```tsx
  it("tells visitors the workspace is built for a crew, with only shipped claims", () => {
    renderHome();

    expect(screen.getByRole("heading", { name: "Bring the crew into orbit." })).toBeVisible();
    for (const pill of [
      "Invite by link",
      "Owner · Admin · Member",
      "Assign tasks",
      "Mentions and assignment signals",
      "Private flight plans",
    ]) {
      expect(screen.getByText(pill)).toBeVisible();
    }
    expect(screen.getByText(/daily flight plan and inbox stay yours/)).toBeVisible();
    expect(screen.getByRole("link", { name: /See how workspaces work/ })).toHaveAttribute(
      "href",
      "/features#shared-workspaces",
    );
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/features/marketing/home-page.test.tsx`
Expected: FAIL — no heading "Bring the crew into orbit."

- [ ] **Step 3: Implement**

In `src/features/marketing/home-page.tsx`:

1. Add the pill list constant next to `AGENT_TOOLS`:

```ts
const CREW_POINTS = [
  "Invite by link",
  "Owner · Admin · Member",
  "Assign tasks",
  "Mentions and assignment signals",
  "Private flight plans",
];
```

2. Insert this section between the WebMCP panel (`{/* The differentiator, trimmed … */}` block) and the `{/* Teasers */}` block:

```tsx
      {/* Collaboration - every claim here is shipped and covered by the two-account e2e suite */}
      <section className="orbit-panel mt-10 rounded-2xl p-8 sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300/80">
          Shared workspaces
        </p>
        <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
          Bring the crew into orbit.
        </h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Invite people to a workspace with a link and give them a role — owner, admin or
          member. Assign tasks to members, and get a signal when someone mentions or assigns
          you. Your daily flight plan and inbox stay yours; the mission boards, milestones and
          project notes are shared.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {CREW_POINTS.map((point) => (
            <li
              className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100"
              key={point}
            >
              {point}
            </li>
          ))}
        </ul>
        <Link
          className="mt-6 inline-block text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
          to="/features#shared-workspaces"
        >
          See how workspaces work →
        </Link>
      </section>
```

The body paragraph in JSX wraps across lines; JSX collapses the line breaks into single spaces, so the rendered text matches the spec string exactly.

3. Update the file's header comment: the line "This page's job is the hero, a taste of the agent story, three teasers, and an honest close" becomes "This page's job is the hero, a taste of the agent story, the crew section, three teasers, and an honest close".

- [ ] **Step 4: Run the tests and build**

Run: `npm test -- src/features/marketing`
Expected: PASS.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Visual check**

Start the `orbit-flo-worktree` preview and open `http://localhost:5173/` and `http://localhost:5173/features` at 1440×900 and 390×844 (these marketing routes need no sign-in). Confirm the crew section sits between the WebMCP panel and the teasers with the same panel styling, the pills wrap on the phone width, and the home link scrolls to the "Shared workspaces" card.

- [ ] **Step 6: Commit**

```bash
git add src/features/marketing/home-page.tsx src/features/marketing/home-page.test.tsx
git commit -m "feat(marketing): 'Bring the crew into orbit' section on the home page"
```

---

### Finishing

Invoke `superpowers:finishing-a-development-branch`: push `landing-crew-section` and open a PR against `main` titled `feat: the landing site says Orbit Flo is built for a crew`. After merge, delete the branch explicitly and fast-forward the primary checkout (this repo's `gh pr merge --delete-branch` silently fails).
