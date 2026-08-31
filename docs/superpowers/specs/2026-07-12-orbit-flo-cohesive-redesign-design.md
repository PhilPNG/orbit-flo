# Orbit Flo Cohesive Product Redesign

**Date:** 2026-07-12

**Status:** Visual direction approved; written specification awaiting user review

**Delivery:** Production UI update, reusable PNG asset pass, and ten 1440x900 product mockups

## 1. Purpose

Redesign Orbit Flo as one premium, coherent product: a calm deep-space observatory for planning and completing personal projects. The redesign must preserve the current feature set and real interface copy while improving hierarchy, depth, composition, component consistency, and the quality of empty, active, and drag states.

The implementation will use the existing React, TypeScript, Vite, Supabase, TanStack Query, React Router, XYFlow, Tailwind, and CSS architecture. No feature, data model, route, query, or mutation is removed as part of this visual pass.

## 2. Approved delivery approach

Use a hybrid production workflow:

1. Build all interface chrome, typography, controls, cards, diagrams, brand marks, and text in code so labels remain crisp and exact.
2. Use the built-in image-generation workflow only for atmospheric raster illustrations and textures that benefit from painterly depth.
3. Save final app-consumed PNG assets under `public/assets/` in stable subfolders.
4. Capture the implemented product at an exact 1440x900 desktop viewport so each mockup is a realistic screenshot of the reusable UI rather than a flattened speculative image.
5. Save final screen captures under `docs/design/orbit-flo-redesign/` and retain their exact attachment order.

This approach is required because raw image-only UI generation cannot reliably guarantee exact text, correct OAuth marks, consistent layout geometry, or reusable production components.

## 3. Deliverables and order

The final capture set is:

1. `01-inbox.png`
2. `02-maps-library.png`
3. `03-maps-mind-map.png`
4. `04-missions.png`
5. `05-auth.png`
6. `06-brainstorm.png`
7. `07-settings.png`
8. `08-mission-workspace-board.png`
9. `09-today.png`
10. `10-task-card-modal.png`

Every capture must be 1440x900, contain no watermark or placeholder copy, use the exact production text described below, and show the same design system. After each capture is presented, include three to five one-line notes describing its most consequential improvements.

## 4. Unified design direction: Quiet Orbit Observatory

### Lighting and background

- Base color is near-black indigo `#020817`.
- Use a sparse three-depth starfield: tiny far stars, fewer mid-depth cyan-white stars, and only two or three near cross-flares per viewport.
- Add one extremely soft off-axis ambient bloom per page, using electric blue `#3b82f6` and violet `#7c3aed` at low opacity. Violet is ambient only and never used as a standard control color.
- Cyan `#22d3ee` and `#67e8f9` identifies interaction, focus, selection, or active state. Never create more than one glowing focal point in the same visual region.
- Foreground surfaces are opaque enough to suppress background stars beneath text. Stars must never look printed on a card.
- A faint grain layer prevents large dark regions from feeling digitally flat without becoming visible texture.

### Surface and elevation model

Use only three surface tiers:

| Tier | Role | Treatment |
| --- | --- | --- |
| Quiet | Standard cards, rows, columns | `rgba(6, 12, 30, 0.86)`, 1px low-contrast border, no glow |
| Raised | Menus, active cards, utility panels | `rgba(10, 20, 44, 0.94)`, brighter top edge, soft long shadow |
| Focus | Modal, drag preview, active hero | `rgba(15, 29, 56, 0.97)`, clear elevation, one restrained cyan focal edge |

- Default card radius is 12px; large panels and modals use 16px.
- Cards receive a subtle inset highlight along the top edge and a long, low-opacity shadow rather than a heavy glass blur.
- Hovered interactive cards lift 2px and sharpen their border. Resting cards do not glow.
- Dividers use quiet 1px lines with generous vertical space.
- Native browser scrollbars are replaced with narrow, dark, low-contrast scrollbars where scrolling is visible.

### Color roles

- Canvas: `#020817`
- Deep panel: `#060c1e`
- Raised panel: `#0a142c`
- Focus panel: `#0f1d38`
- Primary text: `#f8fafc`
- Body text: `#cbd5e1`
- Muted text: `#8290a7`
- Hairline border: `rgba(148, 163, 184, 0.14)`
- Strong border: `rgba(148, 163, 184, 0.24)`
- Cyan active: `#22d3ee` / `#67e8f9`
- Electric blue action: `#3b82f6`
- Violet atmosphere: `#7c3aed`

Primary buttons use a solid electric-blue fill with a cyan focus border. The existing blue-cyan-violet button gradient is removed from routine actions. Secondary actions use transparent or quiet surfaces. Destructive actions use a restrained rose border and text treatment.

### Typography and spacing

- Inter remains the product typeface.
- Page title: 40-44px, 700 weight, tight line-height.
- Section title: 20px, 650-700 weight.
- Card title and important rows: 15-16px, 600 weight.
- Body: 14-16px, 400-500 weight.
- Metadata and captions: 12-13px.
- Uppercase micro-labels are limited to true category labels and use 11px with modest tracking.
- Use an 8px spacing grid. Standard page padding is 40px horizontally and 32px vertically at 1440x900.
- The app shell uses one 232px sidebar on product screens. The same sidebar component, logo scale, nav spacing, active row, quick-add area, and command shortcut appear everywhere.
- Today remains centered at approximately 760px. Standard content uses the remaining shell width. Maps and Kanban may use the full content width.

### Motion vocabulary

Only five motion behaviors are used:

1. **Drift:** star layers move almost imperceptibly over minutes.
2. **Settle:** page and raised panel entry uses a 4-6px rise and fade over approximately 300ms.
3. **Dock:** captures, saves, and dropped tasks land with one soft pulse.
4. **Ignite:** completion or successful launch emits one short point-of-light streak.
5. **Beacon:** the single active focal element may breathe slowly.

All motion respects `prefers-reduced-motion`. Repeated scanlines, rapid shooting stars, pulsing borders, and arcade-style loops are excluded.

## 5. Shared component system

### App shell

- Keep the Orbit Flo mark, wordmark, collapse control, Today, Missions, Maps, Calendar, Inbox, Brainstorm, Settings, Quick add, send control, and Command / Ctrl K affordance.
- Refine the existing orbital satellite mark rather than introducing an unrelated identity. The wordmark remains code-native or deterministically composed so it is always sharp.
- Use one icon language: Lucide for functional controls and the refined Orbit Flo mark for brand moments. Existing mismatched painterly nav PNGs are not mixed with line icons.
- Active navigation receives a quiet indigo fill, a 2px cyan leading indicator, and a cyan icon. It does not glow.

### Buttons and controls

- Primary: solid electric blue, white label, cyan focus outline, optional restrained shadow only when it is the focal action.
- Secondary: quiet raised surface with a hairline border.
- Tertiary: text or icon action with transparent background.
- Inputs: deep fill, 1px hairline border, 3px accessible cyan focus ring, clear label, and readable placeholder.
- Tabs: quiet underline or segmented treatment; only the selected item uses cyan.
- Pills and badges use 999px radius, 11-12px text, and compact padding. Status is never communicated by color alone.
- Toggles and checkboxes use custom accessible controls with a clear on/off label and a visible keyboard focus state.

### Empty states

- Empty states use a compact observatory vignette rather than a large vacant card.
- Illustration, title, explanation, and action form one tight vertical group.
- Each route receives a related but distinct illustration so the satellite artwork is not repeated everywhere.
- Empty-state imagery never contains text and never sits inside a visible black rectangle.

### Cards and data rows

- Rows align title, supporting metadata, and status into one readable grid.
- Kanban cards include label bars and compact checklist, comment, and attachment badges.
- Task rows and cards expose actions on hover and focus while keeping primary content visible at rest.
- Dragging uses a raised preview, slight rotation under one degree, a visible grab state, and a cyan hairline drop target. Only the dragged card glows.

### Modal

- Task details use a centered `Focus` surface approximately 960px wide and no taller than the viewport.
- Main and side columns use a roughly 2:1 ratio.
- The overlay darkens and slightly desaturates the board but leaves enough context to recognize the source task.
- Modal close, keyboard focus trap, Escape behavior, scroll containment, and accessible heading semantics remain intact.

## 6. Screen specifications

### 1. Inbox

Preserve:

- `Inbox`
- `Process one signal at a time — convert, assign, or archive.`
- `0 open`
- `Inbox clear`
- `New quick captures will arrive here until you process them.`
- Full app shell, Quick add, send, and Command / Ctrl K controls.

Redesign:

- Align the page title, description, and `0 open` pill in one header grid.
- Replace the oversized dotted rectangle with a centered, compact signal-receiver vignette on a quiet card.
- Suggest a stacked processing queue through subtle layered card edges without inventing captured content.
- Give Quick add a deliberate docked appearance instead of a disabled look.

### 2. Maps library

Preserve:

- `Visual planning workspace`
- `New blank map`
- `Open map...`
- `TEMPLATES`
- Feature plan, Bug investigation, Launch flow, Product roadmap, their previews, and descriptions.
- `Choose a visual plan`
- `Start a blank map or pick a template to open the planning canvas.`

Redesign:

- Use a 288px template gallery and a flexible canvas aligned to the same top grid.
- Give each template a crafted card with truthful constellation thumbnail, full title, and a readable description line.
- Use a narrow, styled gallery scrollbar with no horizontal scrollbar.
- Place `Open map...` with canvas actions rather than floating between regions.
- Use a quiet constellation-aperture empty state and reserve the single focal accent for the selected or primary action.

### 3. Open mind map

Preserve:

- The shared workspace title and full template gallery: Feature plan, Bug investigation, Launch flow, Product roadmap, Decision tree, Meeting brainstorm.
- `Feature plan` selector.
- `Mind Map`, `Flowchart`, `Timeline`, `Decision Tree`.
- `Unsaved changes`, `Add node`, `Details`, and `Save map`.
- Nodes: Feature, Launch plan, Success metrics, Risks, Task breakdown, Requirements, Target users, Scope cuts.
- Zoom controls and minimap.

Redesign:

- Expand the constellation to use the canvas instead of clustering it around the center.
- Render different node types as dots, planets, diamonds, triangles, rings, and small cards.
- Use thin starlight connections that brighten only near endpoints.
- The selected `Feature` node is the only beacon in the canvas.
- Separate the view switcher from save/edit actions so the active tab and Save button do not compete.
- Use a refined dark minimap and controls; hide native/react-library attribution from the product screenshot where licensing configuration permits.

### 4. Missions

Preserve:

- `MISSION REGISTRY`
- `Projects in orbit.`
- `Track active work, priority, and health in one orbital system.`
- `Launch project`
- PocketPup, active, Digital dog care app, `https://github.com/PhilPNG/PocketPup`, medium, good, and `Project orbit looks stable.`

Redesign:

- Replace the stretched table feeling with a crafted registry row that groups mission identity on the left and health telemetry on the right.
- Add a quiet orbital-path accent or project mark without introducing new data.
- Make the entire mission row a clear navigable surface.
- Use compact, consistent status pills and a solid-blue Launch project action.

### 5. Authentication

Preserve exact hero copy and form labels:

- Orbit Flo
- `FOCUS. FLOW. FINISH.`
- `Your Mission Control for Productivity`
- `Launch your projects to Orbit.`
- `WELCOME BACK`
- `Enter your flow state.`
- `Sign in to continue to Orbit Flo.`
- `Sign in`, `Create account`, `Email`, `Password`, `Enter orbit`, and `OR`
- `Sign in with Google`, `Sign in with GitHub`, `Sign in with Apple`
- Correct Google, GitHub, and Apple marks.

Redesign:

- Use a cinematic approximately 60/40 hero-to-form split inside one raised observatory frame.
- Make the left orbit scene the dominant composition: crisp orbital rings, a dimensional core, slow-moving waypoints, and restrained cyan/blue/violet atmosphere.
- Keep only the orbit core as the hero focal glow.
- Connect headline, scene, and supporting line through a stronger vertical rhythm.
- Give the form column more breathing room, clear labels, password reveal control, polished tabs, and correctly sized OAuth marks.
- Use a solid action treatment instead of a three-color gradient.

### 6. Brainstorm

Preserve:

- `SIGNAL LOG`
- `Brainstorm notes`
- `Capture workspace ideas, questions, and decisions before they drift.`
- `Capture note`
- All, Idea, Question, Decision, Risk, Reference.
- `No signals captured`
- `Capture the first note for this orbit.`

Redesign:

- Group filters as one segmented filter bar and show zero-count badges where useful.
- Use one primary Capture note button in the header; the empty-state action remains available but becomes tertiary so functionality is preserved without duplicate emphasis.
- Replace the mismatched black-box brain artwork with a transparent, dimensional signal-nebula illustration from the shared asset family.
- Reduce the empty-state card height and strengthen the relationship between filters and results.

### 7. Settings

Preserve:

- `Flight controls`
- `Settings`
- `Keep the app quiet and tuned to the way you plan.`
- `Signed in as`, `philiprrodriguez@gmail.com`, and `Sign out`
- `Daily home`
- Quick Capture — `Keep the capture form on your daily home.`
- Mission Momentum — `Show the compact daily progress ring.`
- Smart Suggestions — `Show recommended tasks for today.`
- Mission Debrief — `Show the end-of-day review panel.`
- All four settings enabled.

Redesign:

- Use the same sidebar scale and shell as every other product screen.
- Compress the account area into a purposeful identity row with a quiet destructive Sign out action.
- Turn each preference into a tactile settings row with the label and description together and a custom switch nearby.
- Add a subtle `Saved automatically` status so the persistence model is clear.
- Keep generous section spacing without using oversized empty cards.

### 8. Mission workspace board

Preserve:

- `Mission workspace`
- Project ID `565da75a-788c-4493-9fd0-e029f2a6259a`
- Project brief and `Add a goal, audience, and success criteria.`
- `Launch task`
- Board, Tasks, Timeline, Meetings, Launch, Maps, Notes, Review.
- Templates: Bug fix day and Feature slice with their descriptions and Apply template actions.
- Operating cadence, 0/4 rituals checked, all four ritual labels, add-ritual field, and add action.
- Columns: Docked, Ready to Launch, Launching, Signal Lost, In Orbit.
- Cards: Test, Polish the release path, Build the first usable slice, Define the smallest useful version, their descriptions, priorities, and status controls.

Redesign:

- Keep the project header compact and align the action and project telemetry in one row.
- Present Project brief as a concise disclosure.
- Keep Templates and Operating cadence as lower-contrast utility panels above the board; they may collapse without losing functionality.
- Fit five readable Kanban columns across the content area at 1440px, using a minimum width near 200px and compact gaps.
- Add crafted label bars plus checklist, comment, and attachment badges to populated cards.
- Show `Polish the release path` mid-drag between Docked and Ready to Launch, with a source placeholder and a clear Ready to Launch drop target.
- Retain status controls in a compact treatment so the visible functionality is not removed.

### 9. Today

Preserve:

- `2026-07-12`
- `Today`
- `A clear sky. 4 suggestions waiting when you're ready.`
- `No objectives locked`
- `Pull in a smart suggestion or drag a task here to start today's orbit.`
- `Add top suggested task`
- `4 suggestions for today`
- Existing Quick Capture, Mission Momentum, Smart Suggestions, and Mission Debrief functionality.

Redesign:

- Keep a single centered column and a calm, human rhythm.
- Reduce the empty flight-plan height so useful suggestions remain visible within the viewport.
- Make the flight-plan target feel tactile through a recessed surface and subtle drag edge, not a large generic empty card.
- Show four compact premium suggestion rows beneath it.
- Keep Quick Capture and the collapsed Mission Debrief reachable within the same continuous column.
- Use one small daily-orbit illustration distinct from Inbox and Maps.

### 10. Trello-style task card modal

This is an additional approved deliverable derived from the existing `WorkItemCardModal` feature.

Use `Define the smallest useful version` as the task title and retain its description: `Write the user outcome and what is intentionally out of scope.`

Main column:

- Label pills for `MVP` and `Product`.
- Description section.
- Checklist with a visible 2/4 progress bar and items: Define the user outcome; Confirm the smallest workflow; Capture empty and error states; Write acceptance criteria.
- Attachment row for `scope-outline.pdf`, 428 KB, with Download and delete actions.
- Comment row with author `You`, a readable timestamp, and the comment: `Keep the first release intentionally small; validate the core loop before adding automation.`
- Comment composer.

Side rail:

- Context snapshot.
- Status: Ready to Launch.
- Priority: medium.
- Deadline: 2026-07-18.
- Milestone: Launch v1.
- Blocker: None.
- Labels manager and New label controls.
- Save task action.

Use a crisp two-column rhythm, a prominent but restrained progress visualization, crafted attachment/comment rows, and one focal Save task action.

## 7. Raster asset plan

Final assets are PNG files and must be copied into the workspace before they are referenced. Generate non-destructively with versioned names until selected.

Planned app assets:

- `public/assets/illustrations/auth-orbit-core-v2.png` — dimensional planet/core underlay with no text; animated rings and waypoints remain code-native.
- `public/assets/illustrations/empty-inbox-receiver-v2.png` — quiet orbital receiver/satellite vignette.
- `public/assets/illustrations/empty-map-constellation-v2.png` — open constellation aperture with no labels.
- `public/assets/illustrations/empty-brainstorm-signal-v2.png` — dimensional signal-nebula idea form with no black rectangle.
- `public/assets/illustrations/empty-today-orbit-v2.png` — calm daily-orbit marker distinct from the other empty states.
- `public/assets/textures/deep-space-grain-v2.png` — subtle seamless grain/noise layer; star positions and parallax remain CSS so they animate cleanly.

Asset constraints:

- No text, logos, watermark, UI frame, or embedded background rectangle.
- Deep indigo base compatibility with cyan, electric blue, and restrained violet accents.
- Crisp silhouette at intended display size.
- One luminous focal area per asset.
- No arcade HUD, lens flare overload, glossy game-item rendering, or heavy gradient field.

Brand marks, OAuth marks, tiny functional icons, constellation diagrams, and controls remain vector or code-native because generated raster output would reduce accuracy.

## 8. Architecture and data flow

- Preserve `AppShell`, route boundaries, query keys, mutations, Supabase tables, and authorization behavior.
- Consolidate visual tokens and shared motion in `src/styles.css`.
- Refine shared primitives in `src/components/minimal-layout.tsx`, `empty-state.tsx`, `status-pill.tsx`, `modal.tsx`, `app-shell.tsx`, and brand/logo components before screen-specific work.
- Screen-specific components continue consuming their current query results and callbacks. This pass changes composition and presentation, not data ownership.
- Existing drag-and-drop, map editing, task metadata, authentication, settings persistence, and daily-plan behavior remain wired to their current handlers.
- Use deterministic visual fixture data for capture-only states where live data cannot reliably produce the approved screenshot. Fixtures must render the real production components and must not create a user-facing production route.

## 9. Loading, error, and empty behavior

- Loading states use the same compact observatory composition and a reduced-motion-safe satellite/orbit indicator.
- Error states use the shared `InlineAlert` treatment with clear text and no decorative glow.
- Empty states follow the route-specific illustration plan above.
- Disabled controls retain readable contrast and remain distinguishable from inactive navigation.
- Asset-load failure must not hide essential copy or controls; layout dimensions remain stable and text provides the meaning.

## 10. Accessibility

- Maintain semantic headings, labels, form associations, button names, focus order, modal focus trapping, Escape close behavior, and keyboard drag/drop access already represented by the current components.
- Meet WCAG AA contrast for text and controls against all dark surfaces.
- Focus rings use cyan and remain visible without relying on glow.
- State and priority are communicated through text plus color.
- Decorative raster assets use empty alt text; meaningful empty-state imagery receives concise alt text only where it adds information beyond the adjacent copy.
- All looping motion is disabled or simplified under `prefers-reduced-motion`.

## 11. Verification

Before completion:

1. Run focused Vitest files for every changed shared component and route.
2. Run the complete `npm test` suite.
3. Run `npm run build`.
4. Run `npm run e2e`.
5. Verify each PNG exists, loads, has the intended dimensions, and does not contain text or watermark artifacts.
6. Inspect all ten captures at 1440x900 for clipping, native scrollbars, duplicate focal glows, inconsistent shell geometry, incorrect text, and OAuth mark accuracy.
7. Inspect representative mobile and tablet layouts so the desktop redesign does not regress responsive behavior.
8. Confirm no unrelated working-tree files are staged or modified.

## 12. Scope boundaries

Included:

- Shared visual system, shell consistency, component polish, motion restraint, raster illustration pass, route-level layout improvements, the task-card modal, deterministic captures, tests, and repository commits.

Excluded:

- New Supabase schema or data migrations.
- Removing or renaming existing product features.
- Replacing React, Tailwind, XYFlow, or the existing data layer.
- A Three.js/WebGL scene.
- New billing, collaboration, or notification features.
- Publishing, deployment, or pushing changes unless separately requested.

## 13. Approved decisions

- Direction: Quiet Orbit Observatory.
- Delivery: hybrid generated raster assets plus code-native production UI.
- Identity: preserve near-black indigo, sparse starfield, cyan interaction, electric-blue actions, and violet ambient accents.
- Tone: observatory, not arcade.
- Scope: all nine supplied screens plus an additional Trello-style task-card-modal capture.
- Output: exact 1440x900 desktop screenshots with real text and no watermark.
