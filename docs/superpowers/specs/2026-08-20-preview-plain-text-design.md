# Descriptions in previews: strip the markup

## The problem

Task and milestone descriptions gained markdown, `orbit:` links and `@` mention
chips in their editors. Eight surfaces still render the raw string.

| Surface | Field | Shape |
|---|---|---|
| `kanban-board.tsx:412` | task | `line-clamp-3` card |
| `task-list-view.tsx:178` | task | `line-clamp-2` row |
| `task-list-view.tsx:206` | task | "Quick preview" panel |
| `daily/flight-plan.tsx:146` | task | paragraph |
| `dashboard-page.tsx:123` | task | `line-clamp-2` |
| `dashboard-page.tsx:189` | milestone | `line-clamp-2` |
| `milestone-manager.tsx:146` | milestone | `whitespace-pre-wrap` |
| `project-timeline.tsx:62` | milestone | `whitespace-pre-wrap` |
| `dashboard-page.tsx:215` | decision note **body** | `line-clamp-3` |

That ninth row was missed when this spec was written and found by the final
whole-branch review. Decision notes are markdown like the rest — authored
through `note-form.tsx`'s `LinkingTextarea`, rendered with `LinkedText` on
Brainstorm — but they live in a `body` column, and both the spec's survey and
the plan's grep guard searched for `description`. **A field-name survey is not
a survey of user markdown.**

A user who types `[[` in a description now sees
`[Ship the graph](orbit:task/8f2c1e04-…)` on their board — 36 characters of
uuid eating a three-line clamp.

`map-library-panel.tsx:51` and `project-rituals-templates.tsx:104` also render a
`description`, but those are **static template copy** written by the app, not
user markdown. They are deliberately untouched.

## The decision: strip, do not render

The obvious fix is to render these with `LinkedText` like the editor does. That
is wrong on every one of these surfaces.

**A kanban card is draggable.** Putting real links inside one creates
click-versus-drag ambiguity and lets a mis-drag navigate away mid-move. The
drag-preview bug this project already fixed once is a reminder that this card is
a fussy interaction surface.

**A two-line clamp cannot hold a heading or a list.** Rendered markdown inside
`line-clamp-2` looks broken in a way that raw text does not — a `<h1>` at card
font size, a `<ul>` with one visible bullet and the rest cut.

**These are scanning surfaces.** You want to know what the task *says*, not to
act on its contents. Acting on it is what opening it is for.

The rule, worth stating in the code because it will come up again:

> Render markdown where you can act on it. Show text where you are scanning.

The task modal and the milestone page render. These eight strip.

## Design

### One pure function

`toPlainText(markdown: string): string` in `src/features/links/plain-text.ts`.

It lives there because it must understand `orbit:` link syntax to pull labels
out correctly, and that vocabulary already lives in `src/features/links/`
alongside `orbit-link.ts` and `mention.ts`.

What it handles, in the order they matter:

- `[Ship the graph](orbit:task/<uuid>)` → `Ship the graph` — the case this
  exists for
- `[@Ada Lovelace](orbit:user/<uuid>)` → `@Ada Lovelace` — the `@` is part of
  the stored label, so a mention still reads as a mention
- `[text](https://example.com)` → `text` — ordinary links too
- `**bold**`, `*italic*`, `_italic_`, `` `code` `` → their inner text
- `# Heading` → `Heading`
- `- item`, `* item`, `1. item` → `item`
- `> quote` → `quote`
- newlines collapse to single spaces on the clamped surfaces

**Correction — the newline rule as written above was wrong.** "Every one of
these surfaces is a single clamped block" is false for four of the eight:
`flight-plan.tsx`, the quick-preview panel, `milestone-manager.tsx` and
`project-timeline.tsx` are unclamped. Two of those carried
`whitespace-pre-wrap`, and stripping it alongside the markup turned a
three-paragraph milestone description into one run-on wall of text — a
readability regression this design caused by asserting a premise it had not
checked. The shipped function takes
`toPlainText(markdown, { preserveLineBreaks?: boolean })`: the default
collapses, as above, and the two unclamped `whitespace-pre-wrap` sites pass
`true` and keep their class. Caught by the final whole-branch review, not by a
test — the component tests assert what shows, not how it is laid out.

### The honest limitation

**This is a pragmatic stripper, not a markdown parser.** No `remark` or
`strip-markdown` dependency is being added to produce preview text.

Worst case, an unusual construct leaves a stray character in a preview — which
is visually no worse than today, where the entire markup survives. That is the
floor this cannot fall below, and it is why a regex-based approach is
proportionate here and would not be for a renderer.

The tests pin the constructs that actually occur in this app, not the CommonMark
spec.

### Empty and absent

`toPlainText("")` returns `""`, and every call site already guards on the
description being truthy — except `task-list-view.tsx:206`, which falls back to
`"No description yet."`. That fallback stays; it is applied to the stripped
result, so a description of only markup (`**`) does not render an empty panel.

## Files

- Create: `src/features/links/plain-text.ts` and `plain-text.test.ts`
- Modify: `kanban-board.tsx`, `task-list-view.tsx` (two sites),
  `daily/flight-plan.tsx`, `dashboard-page.tsx` (two sites),
  `milestone-manager.tsx`, `project-timeline.tsx`

No schema change, no query change. Stored descriptions are untouched; only their
presentation in previews changes.

## Testing

- **vitest on the pure function** — each construct above, plus the composite
  case that matters most: a description containing an `orbit:` link previews as
  its label with **no uuid visible**. That assertion is the whole point, so it
  gets its own test rather than being folded into a general one.
- **One component test per surface family** — kanban, task list, dashboard,
  milestone manager — asserting the raw markup is absent and the label present.
  Four tests rather than eight: the flight plan, timeline and second dashboard
  site use the same substitution as their sibling, and a test per call site
  would pin the wiring rather than the behaviour.
- **No e2e.** Nothing about policies, routes or data changes.

## Risks

- **A stripper is easy to underestimate.** Nested emphasis, links inside
  emphasis, and escaped brackets all have edge cases. The mitigation is that the
  failure mode is cosmetic and strictly better than the status quo — not that
  the implementation is exhaustive.
- **Eight call sites, one substitution.** The risk is missing one, which would
  leave a surface still showing raw markup. The component tests cover four
  families; the remaining sites are verified by reading the diff, and the
  spec's table above is the checklist.
