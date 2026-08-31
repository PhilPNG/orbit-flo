# Mobile Layout

**Date:** 2026-08-09 · **Branch:** `codex/mobile-layout` · **Status:** Approved

## Audit

Rendered every screen at iPhone 13 width (390×844) with realistic data. The layouts themselves hold up — **no horizontal document overflow on any screen**. Four problems, in order of severity:

1. **The sidebar has no mobile treatment.** It carries no `lg:` gate on its own visibility, so it stacks above the content on every route: logo, six nav links in a two-column grid, Settings, quick add, command palette. That is roughly 1,250px — about a screen and a half — of scrolling before reaching the page heading. This dwarfs everything else.
2. **Workspace tabs are clipped mid-word.** The container already has `overflow-x-auto`, but the eight tab buttons lack `shrink-0`, so flex squashes them and the text is cut at "La…" rather than scrolling.
3. **The workspace header wraps badly.** "Mission workspace" breaks across two lines while three buttons crowd beside it.
4. **Tap targets below 40px:** 11 on Today, 13 on Missions, 26 on the workspace, 5 on Settings.

The kanban board's horizontal column scrolling is intentional and reads fine.

## Decisions

- **Bottom tab bar**, not a drawer or an icon rail. Thumb-reachable, always visible, costs no vertical scroll.
- **Today · Missions · Inbox · Brainstorm · More.** Maps, Calendar and Settings live behind More. Maps is the weakest phone experience — dragging nodes on a canvas — and Calendar is a planning view better suited to a large screen.
- **A floating capture button** above the bar, on every screen. Capture is what this app is for when away from a desk. Search moves into More, since `Ctrl+K` means nothing on a phone.

## Architecture

### Breakpoint strategy

Layout switches on CSS breakpoints, not a JavaScript `matchMedia` hook. The codebase already expresses every responsive decision with `lg:` classes, so this adds no new primitive and cannot flash the wrong layout on first paint.

The cost is honest: jsdom does not apply CSS, so component tests can assert that both trees render with the correct classes but cannot assert which is *visible*. Visibility is verified in a real browser at 390px instead, which is the only place that question can actually be answered.

### `src/components/mobile-tab-bar.tsx`

```tsx
export function MobileTabBar(): JSX.Element;
```

Fixed to the bottom, `lg:hidden`. Four `NavLink` destinations plus a More button that opens the sheet. Each target is at least 44px tall. Active state comes from `NavLink`'s render-prop, matching `ShellNavLink`.

Carries `padding-bottom: env(safe-area-inset-bottom)` — without it the bar sits under the iPhone home indicator.

### `src/components/mobile-more-sheet.tsx`

```tsx
export function MobileMoreSheet({ onClose }: { onClose: () => void }): JSX.Element;
```

Reuses the existing `Modal`, which portals to the body and traps focus. Contains links to Maps, Calendar and Settings, plus search.

Search cannot simply "open the command palette": the existing `CommandPalette` owns its open state internally and its only instance lives inside the sidebar, which is now hidden. The sheet therefore renders **its own `CommandPalette` instance**, whose trigger button *is* the Search entry. That reuses the component wholesale — including the workspace search added in #24 — without lifting state or duplicating markup.

Choosing any destination closes the sheet.

### `src/components/mobile-capture-button.tsx`

```tsx
export function MobileCaptureButton(): JSX.Element;
```

A round button floating above the tab bar, `lg:hidden`, opening a capture sheet. It reuses `GlobalQuickAdd` inside a `Modal` rather than duplicating the capture mutation or the `parseQuickAdd` handling.

### `AppShell`

The `aside` becomes `hidden lg:flex`, so it stops stacking. `MobileTabBar` and `MobileCaptureButton` render as siblings of `main`.

Concrete measurements, so the pieces cannot overlap:

- Tab bar: `h-16` (64px) of content plus the safe-area inset.
- Capture button: `h-14 w-14`, positioned `bottom-20 right-4` — clear of the 64px bar.
- `main`: `pb-28 lg:pb-8`. 112px clears the bar and leaves the last row of content reachable above the floating button.

### Two layout fixes

- Workspace tab buttons gain `shrink-0 whitespace-nowrap`. The container's `overflow-x-auto` then does what it was always meant to.
- The workspace header stacks below `sm`: title block above, button row beneath, instead of competing for one line.

### Tap targets

Scoped to icon-only buttons, which are the genuine offenders — a 36px send button is hard to hit, whereas a full-width text button at 38px is not. Blanket-raising all 55 sub-40px controls would churn a great deal of layout for little gain.

## Testing

- `MobileTabBar`: renders the four destinations and More; the active route is marked `aria-current`; every target is at least 44px by class.
- `MobileMoreSheet`: contains Maps, Calendar, Settings and Search; choosing a destination closes it.
- `MobileCaptureButton`: opens the sheet; submitting creates a capture through the existing quick-add path.
- `AppShell`: renders both the sidebar and the tab bar, with the sidebar carrying `hidden lg:flex`.
- Workspace: tab buttons carry `shrink-0`.
- Browser verification at 390×844 across all seven screens, confirming content starts at the top of the viewport and nothing is clipped.

## Non-goals

Mobile-specific mind map editing, a single-column kanban variant (horizontal column scrolling is the standard board pattern and already works), PWA or offline support, and landscape-specific layouts.
