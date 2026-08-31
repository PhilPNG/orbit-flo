# Task Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give task descriptions the markdown, `orbit:` links and `@` mention chips that note bodies and task comments already have.

**Architecture:** The Description field becomes two states. `LinkedText` renders the saved description by default; clicking it (or the Edit description button) swaps in `LinkingTextarea`. Persistence is unchanged — the description stays local state and is written by the existing `Save task` submit.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + Testing Library, react-markdown (via `LinkedText`).

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- No schema change. `work_items.description` already stores arbitrary text.
- No new components. `LinkedText` and `LinkingTextarea` are used as they are.
- Persistence stays on the existing form submit. Do NOT add a field-level save.

---

## File Structure

**Modify:** `src/features/work-items/work-item-card-modal.tsx` — the Description field becomes a two-state region.

**Modify:** `src/features/work-items/work-item-card-modal.test.tsx` — new cases; Task 2 adds a router.

Nothing else. This is deliberately one file: the two states are one field's behaviour, and extracting a component would create an abstraction with exactly one caller.

## Facts about the existing code you will need

- The description lives in local state: `const [description, setDescription] = useState(item.description ?? "")` around line 100.
- It is submitted by `handleSave` (around line 244) as `description: description.trim()`, inside `<form id="work-item-core-form" onSubmit={handleSave}>`.
- The field currently renders as `<Field label="Description"><textarea … /></Field>`.
- **`Field` wraps its children in a `<label>`.** It cannot be reused here: the rendered state contains no form control for a label to point at, and nesting the Edit button inside a `<label>` makes clicking the label activate the button. Task 1 replaces it with explicit header markup.
- `orbit-prose` is the existing class for rendered markdown and is already used for comments in this same file (around line 494).
- `LinkedText` takes `body: string`. `LinkingTextarea` takes `value: string` and `onChange: (value: string) => void` — **`onChange` receives the string, not an event** — and spreads all other props onto the inner `<textarea>`.

---

## Task 1: Two-state Description field

**Files:**
- Modify: `src/features/work-items/work-item-card-modal.tsx`
- Test: `src/features/work-items/work-item-card-modal.test.tsx`

**Interfaces:**
- Consumes: `LinkedText` from `../links/linked-text`, `LinkingTextarea` from `../links/linking-textarea`.
- Produces: nothing other tasks import. Task 2 extends the click handler added here.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe("WorkItemCardModal", …)` block in
`src/features/work-items/work-item-card-modal.test.tsx`:

```tsx
  it("renders the description as markdown without entering edit mode", async () => {
    renderModal(vi.fn(), workItem({ description: "**bold** notes" }));

    // The rendered <strong> proves LinkedText ran, not a raw textarea value.
    expect(await screen.findByText("bold")).toBeInTheDocument();
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
  });

  it("reveals the editor when the description is clicked", async () => {
    const user = userEvent.setup();
    renderModal(vi.fn(), workItem({ description: "Original notes" }));

    await user.click(await screen.findByText("Original notes"));

    expect(await screen.findByLabelText("Description")).toHaveValue("Original notes");
  });

  it("reveals the editor from the Edit description button", async () => {
    // The keyboard-reachable path, independent of clicking the text.
    const user = userEvent.setup();
    renderModal(vi.fn(), workItem({ description: "Original notes" }));

    await user.click(await screen.findByRole("button", { name: "Edit description" }));

    expect(await screen.findByLabelText("Description")).toHaveValue("Original notes");
  });

  it("invites a description when there is none", async () => {
    renderModal(vi.fn(), workItem({ description: "" }));

    expect(await screen.findByText("Add a description")).toBeInTheDocument();
  });

  it("submits an edited description", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal(vi.fn(), workItem({ description: "Original notes" }));

    await user.click(await screen.findByText("Original notes"));
    const editor = await screen.findByLabelText("Description");
    await user.clear(editor);
    await user.type(editor, "Rewritten");
    await user.click(screen.getByRole("button", { name: "Save task" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Rewritten" }),
    );
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test -- --maxWorkers=2 work-item-card-modal`

Expected: FAIL. The first fails because the raw markdown sits in a textarea so
no `bold` element exists; the Edit description button does not exist yet.

- [ ] **Step 3: Add the state and handlers**

In `src/features/work-items/work-item-card-modal.tsx`, add to the imports:

```tsx
import { LinkedText } from "../links/linked-text";
import { LinkingTextarea } from "../links/linking-textarea";
```

`useRef` and the `FocusEvent` / `MouseEvent` types must be present in the
existing `react` import — add whichever are missing.

Next to the other `useState` calls (near `const [description, setDescription]`):

```tsx
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);
```

Then, beside the other handlers in the component body:

```tsx
  function handleDescriptionClick(event: MouseEvent<HTMLDivElement>) {
    // A link inside the description must navigate rather than open the editor.
    // Without this, any orbit: link in a description can never be followed —
    // and the feature still looks correct until someone tries.
    if ((event.target as HTMLElement).closest("a")) return;
    setIsEditingDescription(true);
  }

  function handleDescriptionBlur(event: FocusEvent<HTMLTextAreaElement>) {
    // LinkingTextarea renders its [[ and @ picker INSIDE this region. Closing
    // on every blur would unmount the picker the moment you reached for an
    // option, so the click would never land. Staying open when focus moves
    // somewhere inside the region is what makes the picker usable here.
    const next = event.relatedTarget as Node | null;
    if (next && descriptionRef.current?.contains(next)) return;
    setIsEditingDescription(false);
  }
```

- [ ] **Step 4: Replace the field markup**

Replace the whole existing block:

```tsx
              <Field label="Description">
                <textarea
                  className="orbit-input min-h-24"
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </Field>
```

with:

```tsx
              {/* Not <Field>: it wraps children in a <label>, which has no form
                  control to point at while the description is rendered, and
                  would swallow clicks meant for the Edit button. */}
              <div className="grid gap-1 text-sm" ref={descriptionRef}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-200" id="task-description-label">
                    Description
                  </span>
                  {isEditingDescription ? null : (
                    <button
                      className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
                      onClick={() => setIsEditingDescription(true)}
                      type="button"
                    >
                      Edit description
                    </button>
                  )}
                </div>

                {isEditingDescription ? (
                  <LinkingTextarea
                    aria-label="Description"
                    autoFocus
                    className="orbit-input min-h-24"
                    onBlur={handleDescriptionBlur}
                    onChange={setDescription}
                    value={description}
                  />
                ) : (
                  <div
                    className="orbit-prose min-h-24 cursor-text break-words rounded-md border border-slate-400/15 px-3 py-2 text-sm leading-6 text-slate-200"
                    onClick={handleDescriptionClick}
                  >
                    {description.trim() ? (
                      <LinkedText body={description} />
                    ) : (
                      <span className="text-slate-500">Add a description</span>
                    )}
                  </div>
                )}
              </div>
```

Note `onChange={setDescription}` — `LinkingTextarea` hands back the string, not
an event. Passing the old `(event) => setDescription(event.target.value)` would
set the draft to an event object.

If `Field` is now unused in this file, remove it from the imports; if other
fields still use it, leave the import alone.

- [ ] **Step 5: Run the tests**

Run: `npm test -- --maxWorkers=2 work-item-card-modal`
Expected: PASS, including the five new cases.

- [ ] **Step 6: Run the full suite**

Run: `npm test -- --maxWorkers=2`
Expected: all files pass. `npm run build` too.

- [ ] **Step 7: Commit**

```bash
git add src/features/work-items/work-item-card-modal.tsx src/features/work-items/work-item-card-modal.test.tsx
git commit -m "feat: render task descriptions as markdown with a click-to-edit editor"
```

---

## Task 2: Links inside a description stay followable

**Files:**
- Modify: `src/features/work-items/work-item-card-modal.test.tsx`

**Interfaces:**
- Consumes: `handleDescriptionClick` from Task 1, which already exempts anchors.

This task adds the test that pins the exemption. It is separate because it is
the one behaviour that regresses invisibly — a description still renders, still
edits, and still saves with the exemption removed. Only following a link breaks.

- [ ] **Step 1: Add a router to the test harness**

`LinkedText` renders `orbit:` links as react-router `<Link>` elements, which
throw outside a router. The existing tests pass without one only because no
test has rendered a link until now — mention chips are `<span>`.

Add the import to `src/features/work-items/work-item-card-modal.test.tsx`:

```tsx
import { MemoryRouter } from "react-router-dom";
```

and wrap the render inside the existing `renderModal` helper:

```tsx
function renderModal(onSubmit = vi.fn(), item = workItem()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkItemCardModal item={item} milestones={[]} onClose={() => undefined} onSubmit={onSubmit} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onSubmit;
}
```

- [ ] **Step 2: Write the failing test**

```tsx
  it("follows a link in the description instead of opening the editor", async () => {
    const user = userEvent.setup();
    renderModal(
      vi.fn(),
      workItem({
        description: "See [the plan](orbit:note/11111111-1111-1111-1111-111111111111)",
      }),
    );

    await user.click(await screen.findByRole("link", { name: "the plan" }));

    // The editor must NOT have opened, or the link could never be followed.
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: Run it**

Run: `npm test -- --maxWorkers=2 work-item-card-modal`

Expected: PASS immediately — Task 1 already added the `closest("a")` exemption.
This test exists to keep it.

**If it fails**, the exemption is missing or wrong; fix
`handleDescriptionClick` rather than the test.

- [ ] **Step 4: Prove the test can fail**

Temporarily delete the `if ((event.target as HTMLElement).closest("a")) return;`
line and re-run.

Expected: this new test FAILS. Restore the line and confirm it passes again.

A guard test that cannot go red is worth nothing, and this one guards a
behaviour that looks perfectly healthy when broken.

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --maxWorkers=2`
Expected: all pass — adding `MemoryRouter` must not disturb the existing cases.

Then `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add src/features/work-items/work-item-card-modal.test.tsx
git commit -m "test: keep links in a task description followable"
```

---

## Self-review notes

**Spec coverage.** Two states → Task 1 steps 3-4. Empty-state placeholder →
Task 1, tested. Edit button as the accessible path → Task 1, tested separately
from the click path. Anchor exemption → Task 1 implements, Task 2 pins.
Persistence unchanged → Task 1's submit test. Testing section → both tasks.

**Known limitation, deliberate.** `handleDescriptionBlur` relies on
`event.relatedTarget` to tell that focus moved into the picker. Safari does not
always focus a button on click, so the editor may close early there and a picker
selection would be lost. The typed text survives — it is local state and the
field reopens with it intact — so the failure is an annoyance rather than data
loss. Worth revisiting if Safari becomes a target; not worth pre-empting now.

**Not covered.** Existing multi-line descriptions will reflow into paragraphs
and any angle-bracketed text will disappear, because react-markdown drops raw
HTML and there is no `rehype-raw`. This matches what comments already do and is
called out in the spec's Risks section; there is no migration and no test,
because the behaviour is intended.
