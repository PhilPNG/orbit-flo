# Workspace Switching Design

**Date:** 2026-08-09
**Status:** Approved

Sub-project A of the collaboration arc. See *Collaboration decomposition* below
for where it sits.

## Problem

Orbit Flo assumes exactly one workspace and offers no way to have another.

- `create_personal_workspace` returns the caller's existing owned workspace if
  there is one, so by design it can never create a second.
- `workspaces` has no insert grant for `authenticated` — only
  `select`, `delete`, and `update(name)`.
- `getStoredWorkspaceId()` reads localStorage synchronously at render in 11
  components, so there is no reactive path: changing the stored id would not
  re-render anything.
- URLs are workspace-implicit. `/projects/<id>` carries the project but not the
  workspace, so a link cannot land a reader in the right place.

The authorization model underneath is complete — `workspace_role`
(owner/admin/member), `private.is_workspace_member`,
`private.has_workspace_role`, and RLS on every table — and none of it is
reachable.

## Collaboration decomposition

This work is one of six sub-projects, each with its own spec, plan, and PR:

| | Sub-project | Depends on |
|---|---|---|
| **A** | Workspace switching — create, switch, rename | — |
| **B** | Personal vs shared boundary — tighten leaking RLS | — |
| **C** | Profiles — a public projection of `auth.users` | — |
| **D** | Invitations — invite, accept, email | B, C |
| **E** | Membership management — member list, roles, removal, delete workspace | C, D |
| **F** | Assignment — assignee, avatars, "my tasks", mentions | C |

**B is a hard gate before D.** `daily_plans`, `daily_plan_items`,
`weekly_reviews`, `captures`, and `notes` are member-visible *and*
member-editable. That is invisible in a one-person workspace and becomes a
privacy leak the moment a second member exists.

This spec covers **A only**.

## Decisions

- The workspace lives in the URL: `/w/:workspaceId/*`.
- The segment is the workspace **uuid**. No slug column, no collision handling,
  and renaming never breaks an existing link.
- Switching lands on the workspace root, not the equivalent page. The ids in
  `/projects/<id>` belong to the workspace being left.
- Deleting a workspace is **out of scope** — it cascades through every table,
  and sub-project E is its natural home.

## Routing

Every authenticated route moves under `/w/:workspaceId`:

```
/w/:workspaceId              Today
/w/:workspaceId/dashboard
/w/:workspaceId/projects
/w/:workspaceId/projects/:projectId
/w/:workspaceId/calendar
/w/:workspaceId/maps
/w/:workspaceId/inbox
/w/:workspaceId/notes
/w/:workspaceId/settings
```

`/auth`, `/auth/callback`, and `/auth/reset` stay where they are.

### The resolver

`/` stops being a page and becomes a redirect, in this precedence:

1. The last-used id from localStorage, **if the caller is still a member**.
2. Otherwise the caller's earliest workspace by `created_at`, then `id`.
3. Otherwise `create_personal_workspace`, the existing first-run flow.

While it resolves, the route renders the existing `SatelliteLoader` shell.

Legacy paths — `/projects`, `/calendar`, `/inbox`, `/notes`, `/maps`,
`/dashboard`, `/settings`, and `/projects/:projectId` — redirect through the
resolver, preserving the trailing path so an old bookmark lands on the same
screen in the resolved workspace. `/projects/:projectId` keeps its id: if the
project belongs to a different workspace the page renders its existing
not-found state, which is honest and needs no new machinery.

`AuthCallbackPage` keeps calling `ensurePersonalWorkspace`, which is what
bootstraps a first-run user, and keeps navigating to `/`. It no longer calls
`setStoredWorkspaceId` — the provider writes the hint once the resolver has
placed the user. Step 3 of the resolver calls the same idempotent RPC, so a
user arriving by any other route still gets a workspace; the overlap is
harmless because `create_personal_workspace` returns the existing one.

### No access

If the uuid names a workspace the caller does not belong to, RLS returns
nothing rather than erroring. That renders a dedicated screen — heading
*This workspace is not yours to open.*, a line explaining that access may have
been removed, and a button back to `/`. Not a generic error, because the
distinction between "gone" and "broken" matters here.

## Workspace context

`src/features/workspaces/workspace-context.tsx`:

```tsx
export function WorkspaceProvider({ children }: PropsWithChildren): JSX.Element;
export function useWorkspaceId(): string;
export function useWorkspace(): { id: string; name: string };
```

The provider sits inside the `/w/:workspaceId` route element, reads the param,
and writes it to localStorage as the last-used hint. `useWorkspaceId` throws if
called outside the provider — that turns a missing-provider mistake into an
immediate failure rather than a silent empty-string query.

All 11 `getStoredWorkspaceId()` call sites move to `useWorkspaceId()`:

- `src/components/command-palette.tsx`
- `src/components/global-quick-add.tsx`
- `src/features/calendar/calendar-page.tsx`
- `src/features/daily/daily-mission-control-page.tsx`
- `src/features/dashboard/dashboard-page.tsx`
- `src/features/inbox/inbox-page.tsx`
- `src/features/maps/maps-page.tsx`
- `src/features/notes/notes-page.tsx`
- `src/features/projects/project-workspace-page.tsx`
- `src/features/projects/projects-page.tsx`
- `src/features/reviews/reviews-panel.tsx`

`workspace.ts` keeps `getStoredWorkspaceId`/`setStoredWorkspaceId`/
`clearStoredWorkspaceId`, but they are now only the resolver's hint and the
sign-out cleanup. Nothing else reads them.

Query keys already embed the workspace id nearly everywhere, so a switch
re-keys and refetches without further work. Any key found missing it is fixed
as part of the refactor.

## Creating a workspace

A new migration adds `public.create_workspace(workspace_name text)`, a
security-definer function mirroring `create_personal_workspace`: it inserts the
workspace with `created_by = auth.uid()` and the caller's `owner` membership in
one transaction, and returns the id. It raises if `auth.uid()` is null, and
rejects a blank name rather than defaulting one — an unnamed second workspace
is a mistake, unlike the first-run personal one.

It is an RPC rather than an insert grant because `workspaces` has no insert
grant today, and the membership row must be created atomically with it.
Granting blanket insert would let a client create a workspace it is not a
member of.

## Renaming

No migration needed. The `update(name)` grant and the
*Workspace owners and admins can update workspaces* policy already exist, so
renaming is a direct client update scoped by id. A rename control goes in
Settings, next to the existing account panel.

## The switcher

`src/features/workspaces/workspace-switcher.tsx`, in the sidebar directly under
the logo: the current workspace name, a chevron, and a dropdown listing the
caller's workspaces with a check against the current one, plus a
**New workspace** action at the bottom that opens a small `Modal` with a single
name field.

Collapsed rail shows the first initial only, with the full name as the button's
accessible name so the control stays reachable.

The dropdown closes on selection, on Escape, and on outside click. Choosing a
workspace navigates to `/w/<id>`, which the provider picks up.

## Error handling

- A failed workspace list degrades the switcher to the current workspace name
  alone rather than hiding the sidebar.
- A failed create keeps the modal open with the name intact and shows the
  Supabase message.
- A failed rename leaves the field dirty and shows the message inline.
- The resolver failing at every step — no membership and a failing
  `create_personal_workspace` — renders the same no-access screen with the
  underlying message.

## Shipping in two passes

Two PRs, because a single one would touch routes, the shell, 11 pages, and most
test files at once:

1. **Routing and context.** `/w/:workspaceId`, the resolver, legacy redirects,
   the provider, and the 11 call-site moves. No visible new feature; the full
   suite still passes. A user with one workspace sees only a changed URL.
2. **Switcher, create, rename.** The `create_workspace` migration, the switcher,
   the create modal, and the Settings rename control.

## Testing

**Pass 1**

`workspaces.queries.test.ts` — `listWorkspaces` selects id and name ordered by
`created_at`. The resolver needs it, so it lands in this pass; the create and
rename queries join it in pass 2.

`workspace-resolver.test.ts` — pure precedence logic, given a member list and a
stored hint:
- Returns the stored id when it is in the list.
- Falls back to the earliest workspace when the stored id is absent or stale.
- Returns null when the list is empty, signalling the create path.

`workspace-context.test.tsx`:
- `useWorkspaceId` returns the route param.
- A param change re-renders consumers with the new id.
- Calling the hook outside the provider throws.
- Mounting writes the id to localStorage as the last-used hint.

`App.test.tsx`:
- `/w/<id>/projects` renders the projects page inside the shell.
- `/projects` redirects through the resolver to `/w/<id>/projects`.
- A workspace id the caller does not belong to renders the no-access screen.

**Pass 2**

`workspaces.queries.test.ts`, extending the pass-1 file:
- `createWorkspace` calls the RPC with a trimmed name and rejects a blank one
  without calling it.
- `renameWorkspace` updates `name` scoped by id.

`workspace-switcher.test.tsx`:
- Renders the current workspace name and lists the others.
- Selecting a workspace navigates to its root.
- The collapsed rail exposes the full name as the accessible name.
- **New workspace** opens the modal; submitting calls create and navigates to
  the new id.
- A failed create keeps the modal open with the typed name.

## Out of scope

- Deleting a workspace, and any membership UI — sub-project E.
- Slugs or vanity URLs. The uuid is permanent across renames.
- Per-workspace theming or settings beyond the name.
- Moving a project between workspaces.
