# Task descriptions — markdown, links and mentions

## The problem

Orbit Flo has three places you write prose: note bodies, task comments, and task
descriptions. The first two render markdown, resolve `orbit:` links, and show
`@` mention chips. Descriptions do none of it — they are a plain `<textarea>`
that stores and returns raw text.

That inconsistency is now the visible one. Comments gained markdown as a
deliberate side effect of the Signals work, which left descriptions as the only
surface where typing `[[` does nothing and a pasted link stays inert.

## Why this is not just a component swap

The obvious fix — swap `<textarea>` for `LinkingTextarea` — does not work, and
the reason is worth stating because it was the initial assumption.

Notes and comments each have **two** states: a rendered view (`LinkedText`) and
a separate editor (`LinkingTextarea`). The description has only one. It is a
permanently open textarea inside the modal's form, saved when **Save task** is
pressed.

So swapping the component would give the author `[[` and `@` autocomplete, and
would store correct markup, but there would be nowhere for that markup to
render. The author would type a link and forever after see
`[Label](orbit:task/8f2c…)`. The feature would be half-built by construction.

The description needs a read view before it can meaningfully have markdown.

## Design

### Two states

**Rendered** is the default: `LinkedText` with the saved description, so
markdown, `orbit:` links and mention chips display exactly as they do in notes
and comments.

**Editing** replaces it with `LinkingTextarea`, autofocused, carrying the `[[`
and `@` pickers. Blur returns to rendered.

This is the Trello card behaviour the modal was modelled on, and it is the only
arrangement in which the markdown is ever visible as markdown.

### Persistence is unchanged

The description stays local state and is submitted by the existing
`handleSave`. Blur switches the view; it does not write to the server. Nothing
persists until **Save task**, which is how every other field in this modal
already behaves — introducing a second, field-level save path would make the
modal's save button mean two different things.

### Empty state

An empty description renders a muted **"Add a description"** rather than a
blank clickable region. A zero-height invisible target is not discoverable, and
a click-to-edit surface that looks like nothing reads as a bug.

## Two constraints that shape the implementation

### Links inside the description must stay clickable

The rendered description can contain `orbit:` links. If the whole region
switches to the editor on click, those links can never be followed — clicking
one would open the editor instead of navigating.

The click handler must therefore ignore clicks that originated inside an
anchor, via `event.target.closest("a")`. Mention chips are `<span>`, not
anchors, so clicking one correctly opens the editor; that asymmetry is correct
rather than accidental, because a mention has no destination to navigate to.

### The rendered view cannot be a button

Wrapping the rendered description in `<button>` would be the natural way to make
click-to-edit keyboard accessible. It is not available: a `<button>` may not
contain interactive descendants, and this content can contain links. Nesting
them produces invalid HTML and unpredictable behaviour across browsers.

Instead: an **Edit description** button in the field header is the accessible,
keyboard-reachable path, and the clickable region is a convenience layered on
top. The affordance exists for mouse users without the accessibility of the
feature depending on it.

## Files

- Modify: `src/features/work-items/work-item-card-modal.tsx` — the Description
  field becomes a two-state region
- Modify: `src/features/work-items/work-item-card-modal.test.tsx`

No new components. `LinkedText` and `LinkingTextarea` are used as they are.

No schema change. `work_items.description` is already `text` and already
round-trips whatever is written to it; only its presentation changes.

## Testing

Vitest, extending the existing modal test setup:

- a description containing markdown renders as markdown without entering edit
  mode
- clicking the rendered description reveals the textarea
- clicking a **link inside** the rendered description does NOT reveal the
  textarea — this is the constraint most likely to regress silently, because
  the feature still looks fine until someone tries to follow a link
- the **Edit description** button reveals the textarea, so the keyboard path is
  covered independently of the click path
- an empty description shows the placeholder
- editing and pressing **Save task** submits the new description, proving the
  view switch did not detach the field from the form

## Risks

- **Existing descriptions reflow.** Markdown collapses single newlines, so a
  description written as several short lines will render as one paragraph. Same
  change comments went through, and the same trade: consistency across the three
  surfaces costs the previous whitespace behaviour. Text containing angle
  brackets will disappear, since react-markdown drops raw HTML and there is no
  `rehype-raw`.
- **The modal is already tall.** Adding a rendered view does not add height —
  it replaces the textarea rather than sitting beside it — but the rendered
  height varies with content where the textarea had a `min-h-24` floor.
