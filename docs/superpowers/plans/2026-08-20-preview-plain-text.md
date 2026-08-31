# Preview Plain Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop eight preview surfaces showing raw markdown, so a description containing a link reads as its label instead of 36 characters of uuid.

**Architecture:** One pure `toPlainText(markdown)` strips markup to readable text. The eight clamped preview surfaces call it. The task modal and milestone page keep rendering markdown, because that is where you act on the content rather than scan it.

**Tech Stack:** TypeScript, React 19, Vitest + Testing Library.

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **No new dependency.** Not `remark`, not `strip-markdown`. This is preview text; a regex stripper is proportionate and the failure mode is cosmetic.
- Do NOT change `map-library-panel.tsx` or `project-rituals-templates.tsx`. They render static template copy written by the app, not user markdown.
- Do NOT change the task modal or the milestone page. They render markdown on purpose.

---

## File Structure

**Create:** `src/features/links/plain-text.ts` — the pure function. It lives beside `orbit-link.ts` and `mention.ts` because it must understand `orbit:` link syntax to pull labels out.

**Create:** `src/features/links/plain-text.test.ts`

**Modify, one substitution each:**

| File | Line | Field |
|---|---|---|
| `src/features/work-items/kanban-board.tsx` | 412 | task |
| `src/features/work-items/task-list-view.tsx` | 178 | task |
| `src/features/work-items/task-list-view.tsx` | 206 | task ("Quick preview") |
| `src/features/daily/flight-plan.tsx` | 146 | task |
| `src/features/dashboard/dashboard-page.tsx` | 123 | task |
| `src/features/dashboard/dashboard-page.tsx` | 189 | milestone |
| `src/features/projects/milestone-manager.tsx` | 146 | milestone |
| `src/features/projects/project-timeline.tsx` | 62 | milestone |

That table is the checklist. Missing one leaves a surface still showing markup, and no test would catch it — the component tests cover four families, not eight sites.

---

## Task 1: `toPlainText`

**Files:**
- Create: `src/features/links/plain-text.ts`, `src/features/links/plain-text.test.ts`

**Interfaces:**
- Produces: `toPlainText(markdown: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { toPlainText } from "./plain-text";

describe("toPlainText", () => {
  it("shows a link's label and never its uuid", () => {
    // The case this function exists for. A three-line clamp was being eaten
    // by 36 characters of uuid.
    const preview = toPlainText(
      "Ship [the graph](orbit:task/8f2c1e04-1111-2222-3333-444455556666) first",
    );

    expect(preview).toBe("Ship the graph first");
    expect(preview).not.toContain("orbit:");
    expect(preview).not.toContain("8f2c1e04");
  });

  it("keeps a mention reading as a mention", () => {
    // The @ is part of the stored label, so it survives the strip.
    expect(toPlainText("ask [@Ada Lovelace](orbit:user/11111111-1111-1111-1111-111111111111)"))
      .toBe("ask @Ada Lovelace");
  });

  it("strips an ordinary link to its text", () => {
    expect(toPlainText("see [the docs](https://example.com)")).toBe("see the docs");
  });

  it("strips emphasis and code spans", () => {
    expect(toPlainText("**bold** and *italic* and _under_ and `code`"))
      .toBe("bold and italic and under and code");
  });

  it("strips headings, list markers and quotes", () => {
    expect(toPlainText("# Heading")).toBe("Heading");
    expect(toPlainText("- item")).toBe("item");
    expect(toPlainText("* item")).toBe("item");
    expect(toPlainText("1. item")).toBe("item");
    expect(toPlainText("> quote")).toBe("quote");
  });

  it("collapses newlines, because every caller is a single clamped block", () => {
    expect(toPlainText("first\nsecond\n\nthird")).toBe("first second third");
  });

  it("returns empty for empty input", () => {
    expect(toPlainText("")).toBe("");
  });

  it("leaves ordinary prose untouched", () => {
    // The common case: most descriptions contain no markup at all and must
    // survive byte-for-byte.
    expect(toPlainText("Just a normal sentence, with punctuation."))
      .toBe("Just a normal sentence, with punctuation.");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 plain-text`
Expected: FAIL, "Failed to resolve import ./plain-text".

- [ ] **Step 3: Implement**

```ts
/**
 * Markdown reduced to the text a human scans.
 *
 * Preview surfaces — kanban cards, list rows, the dashboard — are clamped to
 * two or three lines and are not places you act on content. Rendering markdown
 * there would put real links inside a draggable card and headings inside a
 * two-line clamp. So: render markdown where you can act on it, show text where
 * you are scanning.
 *
 * This is a pragmatic stripper, NOT a markdown parser. No remark dependency is
 * warranted to produce preview text, and the failure mode is cosmetic — an
 * unusual construct may leave a stray character, which is no worse than today,
 * where the entire markup survives.
 */
export function toPlainText(markdown: string): string {
  return (
    markdown
      // Images BEFORE links. An image is a link with a leading !, so the link
      // rule would consume the bracket pair and strand the ! on its own. This
      // is the one ordering constraint in the function.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Then links, whose labels must survive the emphasis pass below.
      // [Ship the graph](orbit:task/…) and [@Ada](orbit:user/…) alike.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Line-leading markers: heading hashes, list bullets, ordered numbers,
      // blockquote carets. Multiline, because a description has many lines.
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}[-*+]\s+/gm, "")
      .replace(/^\s{0,3}\d+\.\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      // Every caller renders a single clamped block, so newlines become spaces.
      .replace(/\s*\n+\s*/g, " ")
      .trim()
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- --maxWorkers=2 plain-text`
Expected: PASS, 8 tests.

If the emphasis rules mangle a case, fix the implementation rather than
loosening a test. The assertions are the contract.

- [ ] **Step 5: Commit**

```bash
git add src/features/links/plain-text.ts src/features/links/plain-text.test.ts
git commit -m "feat: reduce markdown to preview text"
```

---

## Task 2: The eight call sites

**Files:** the eight in the table above, plus four test files.

**Interfaces:**
- Consumes: `toPlainText` from `../links/plain-text` (adjust the relative path per file).

- [ ] **Step 1: Write the failing component tests**

One per surface family. In each, render the component with a description
containing an `orbit:` link and assert the label shows and the markup does not.

Add to `src/features/work-items/kanban-board.test.tsx`:

```tsx
  it("previews a description as text, not markup", async () => {
    renderBoard(vi.fn(), [
      workItem({ description: "Ship [the graph](orbit:task/8f2c1e04-1111-2222-3333-444455556666)" }),
    ]);

    expect(await screen.findByText(/Ship the graph/)).toBeInTheDocument();
    expect(screen.queryByText(/orbit:task/)).not.toBeInTheDocument();
  });
```

Read each test file first and use its existing render helper and fixture
factory rather than the names above — `renderBoard` and `workItem` are
illustrative. Add the equivalent case to:

- `src/features/work-items/task-list-view.test.tsx`
- `src/features/dashboard/dashboard-page.test.tsx`
- `src/features/projects/milestone-manager.test.tsx`

If any of those test files does not exist, create it with the minimum harness
needed for this one assertion, following
`src/features/signals/signals-page.test.tsx` for style.

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 kanban-board task-list-view dashboard-page milestone-manager`
Expected: FAIL — the raw markup is present, so `queryByText(/orbit:task/)`
finds it and `findByText(/Ship the graph/)` does not match the un-stripped
string.

- [ ] **Step 3: Substitute at all eight sites**

In each file, import the helper and wrap the description. For example, in
`src/features/work-items/kanban-board.tsx` line 412:

```tsx
                    <p className="mt-1 line-clamp-3 break-words text-xs text-slate-400">{toPlainText(item.description)}</p>
```

Apply the same substitution at every row of the table in the File Structure
section. Two of them need care:

**`task-list-view.tsx:206`** currently reads `{item.description || "No description yet."}`.
It becomes `{toPlainText(item.description ?? "") || "No description yet."}` — the
fallback applies to the **stripped** result, so a description of only markup
does not render an empty panel.

**`milestone-manager.tsx:146` and `project-timeline.tsx:62`** carry
`whitespace-pre-wrap`. `toPlainText` collapses newlines, so that class now has
nothing to preserve. Remove it from those two elements; leaving it would imply
a line structure that no longer exists.

Guard clauses like `{item.description ? (` stay as they are — they test the raw
value for presence, which is still correct.

- [ ] **Step 4: Verify every site was changed**

Run: `grep -rn "\.description" src/features --include=*.tsx | grep -v "\.test\." | grep -v "toPlainText" | grep -v "LinkedText"`

Expected: the only remaining lines are assignments (`description: values.description`),
state initialisers, `map-library-panel.tsx`, and `project-rituals-templates.tsx`.
**No line rendering `{item.description}` or `{milestone.description}` or
`{entry.description}` directly may remain.** If one does, it is a missed site.

- [ ] **Step 5: Run the tests, the suite and the build**

```bash
npm test -- --maxWorkers=2 kanban-board task-list-view dashboard-page milestone-manager
npm test -- --maxWorkers=2
npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/
git commit -m "fix: show description previews as text rather than markup"
```

---

## Self-review notes

**Spec coverage.** The pure function and every construct it handles → Task 1.
All eight call sites → Task 2, with the table as the checklist and a grep in
step 4 that fails if one was missed. The `"No description yet."` fallback and
the `whitespace-pre-wrap` removal → Task 2 step 3, called out individually
because both are easy to overlook while doing eight mechanical substitutions.
The four component tests → Task 2 step 1.

**One ordering constraint, stated in the code.** An image is a link with a
leading `!`, so the image rule must run first or the link rule consumes the
bracket pair and strands the `!`. The first draft of this plan shipped that
rule in the wrong position and then told the implementer to move it — a trap
dressed as a teaching moment. It is now simply correct, with a comment saying
why the order matters.

**Why four tests and not eight.** A test per call site would pin the wiring
rather than the behaviour. The flight plan, project timeline and second
dashboard site use the identical substitution as a tested sibling; step 4's
grep is what guards them.
