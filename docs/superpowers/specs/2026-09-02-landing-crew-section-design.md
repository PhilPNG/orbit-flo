# Landing Site: Shared Workspaces

**Date:** 2026-09-02
**Branch:** `landing-crew-section`
**Status:** Approved by user

## Problem

Collaboration shipped in August (PRs #30–#36: shared workspaces with a switcher, link-based invitations, owner/admin/member roles, member removal and leaving, task assignment to members, and a personal/shared boundary) and is covered by the two-account e2e suite. Neither the home page nor the features page mentions any of it, so a visitor reads Orbit Flo as single-player.

## Goals

- Say, truthfully and briefly, that Orbit Flo is built for a crew: on the home page as a dedicated section, on the features page as a card.
- Keep the marketing copy rule intact: nothing that is not true today, no invented numbers, no staged screenshots.

## Non-goals

- A crew screenshot. The demo seed is single-user, so no honest image exists yet; the demo-seeding work can add a second member and revisit.
- README changes, pricing, testimonials.

## Design

### 1. Home page section (`src/features/marketing/home-page.tsx`)

Placed between the "WebMCP inside" panel and the three teasers, built the same way as the WebMCP panel: an `orbit-panel` with an eyebrow, a heading, a paragraph, a pill list and a deeper link.

- Eyebrow: `Shared workspaces`
- Heading: `Bring the crew into orbit.`
- Body: "Invite people to a workspace with a link and give them a role — owner, admin or member. Assign tasks to members, and get a signal when someone mentions or assigns you. Your daily flight plan and inbox stay yours; the mission boards, milestones and project notes are shared."
- Pills (same styling as the agent-tool pills, but not monospace): `Invite by link`, `Owner · Admin · Member`, `Assign tasks`, `Mentions and assignment signals`, `Private flight plans`
- Link: `See how workspaces work →` to `/features#shared-workspaces`

Every claim above maps to shipped behaviour: invitations are link-based (`create_workspace_invitation`), roles are the three the UI offers, assignment references `workspace_members`, Signals cover mentions and assignments, and daily plans and captures are author-only while project rows are shared.

### 2. Features page card (`src/features/marketing/features-page.tsx`)

A seventh entry in `TEXT_SECTIONS`, rendered like the others, with `id="shared-workspaces"` on its `<article>` so the home link lands on it (the `TextSection` type gains an optional `id`; the article renders `id={section.id}`).

- Title: `Shared workspaces`
- Body: "Invite people with a link and give them a role — owner, admin or member. Members can be assigned tasks, can leave, and can be removed; a workspace always keeps an owner. Your flight plan and inbox are private to you; boards, milestones and project notes belong to the workspace."

Also corrected while here: the "Mind maps" card currently says a node converts into "a task or a project". The product converts a node into a task, a note or a milestone. New body: "Sketch a graph of ideas, arrange it with one click, and convert any node straight into a task, a note or a milestone without leaving the canvas." (Arrange shipped in PR #71, already on `main`.)

### 3. Tests

- `home-page.test.tsx`: a new test asserts the crew heading is visible, the five pills are visible, and the "See how workspaces work" link targets `/features#shared-workspaces`. The existing three-teaser test is unchanged.
- `features-page.test.tsx`: the "honest paragraph" test's title list gains `Shared workspaces`; the image count assertion stays at 4; a new assertion checks the card has `id="shared-workspaces"`.

### 4. Copy rule

Unchanged: only claims that are true today, no numbers, no testimonials, no pricing. No new images.

## Testing

```bash
npm test -- src/features/marketing
```

```bash
npm run build
```

Visual check of `/` and `/features` on the dev server at 1440×900 and 390×844.
