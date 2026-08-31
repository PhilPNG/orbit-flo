# Invitations Design

**Date:** 2026-08-09
**Status:** Approved

Sub-project D of the collaboration arc. Depends on B (personal boundary,
shipped) and C (profiles, shipped). Gated behind B deliberately: this is the
change that makes a second member possible.

## Problem

There is no way to add anyone to a workspace. `workspace_members` has select,
`update(role)`, and delete policies but **no insert policy and no insert
grant**, and there is no invitations table. The gap is deliberate — a blanket
insert grant would let a client add itself to any workspace — so closing it
means a controlled path, not a looser grant.

## Link, not email

The repository has no email infrastructure: no provider client, no
`supabase/functions` directory, nothing. Sending mail needs a provider account,
an API key, and a deployed edge function.

So an invitation produces **a link the inviter shares however they like**.
Email delivery becomes a later addition that carries the same link rather than
a prerequisite for the feature working.

The invitation is still addressed to an email, and accepting requires the
signed-in address to match, case-insensitively. That keeps a pasted link from
being a bearer token to the workspace.

## Roles

The `workspace_role` enum has four values, but `viewer` is never granted
anything — every `private.has_workspace_role` call in the schema lists only
`owner`, `admin`, `member`. The invite UI offers those three. `viewer` is left
alone rather than offered as a role that silently grants nothing; making it
meaningful is its own piece of work.

## Schema

```sql
public.workspace_invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email        text not null,
  role         public.workspace_role not null default 'member',
  token        text not null unique,
  invited_by   uuid references auth.users(id) on delete set null,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
)
```

Plus a partial unique index on `(workspace_id, lower(email))
where accepted_at is null`, so one workspace cannot have two live invitations
for the same person while still allowing a fresh invite after one is accepted
or revoked.

The token is 64 hex characters from two `gen_random_uuid()` values with the
dashes stripped — 256 bits, and no extension dependency. Invitations expire
after 7 days.

## Three functions

Everything that writes goes through `security definer` functions, because the
whole point is that clients cannot insert into `workspace_members` directly.

**`create_workspace_invitation(target_workspace_id, target_email, target_role)`**
— owner or admin only; rejects `viewer`; rejects an email that already belongs
to a member; returns the row including its token. Raises rather than returning
null so the client gets a message.

**`preview_workspace_invitation(invitation_token)`** — returns the workspace
name, the inviter's display name, the target email, and whether it is expired
or already accepted. Callable by any authenticated user, because the recipient
is not a member yet and could not otherwise see the workspace. It returns
nothing that a link-holder should not see, and never the token.

**`accept_workspace_invitation(invitation_token)`** — the function that closes
the insert gap. It validates in order: the invitation exists, is unaccepted,
is unexpired, and its email matches `auth.email()` case-insensitively. Then it
inserts the membership and stamps `accepted_at` / `accepted_by`. If the caller
is already a member it stamps the invitation and returns the workspace id
rather than failing, so a double-click is harmless. Returns the workspace id.

## RLS

- **select** on `workspace_invitations`: members of the workspace. The
  recipient does not read the row directly; `preview_workspace_invitation`
  serves them.
- **delete**: owner or admin — revoking a pending invitation.
- **no insert or update policy**, and no insert grant. The functions own both.

## Client

`src/features/invitations/invitations.queries.ts`:

```ts
listInvitations(client, workspaceId): Promise<Invitation[]>   // pending only
createInvitation(client, { workspaceId, email, role }): Promise<Invitation>
revokeInvitation(client, { id }): Promise<void>
previewInvitation(client, token): Promise<InvitationPreview>
acceptInvitation(client, token): Promise<string>              // workspace id
invitationLink(token): string                                  // absolute URL
```

`createInvitation` validates the email shape before calling the RPC, so an
obvious typo fails without a round trip, with `That does not look like an email
address.`

## Surfaces

**An Invitations panel in Settings**, owner/admin only: an email field, a role
select, and a list of pending invitations each with a **Copy link** button, its
expiry, and **Revoke**. Copy uses `navigator.clipboard`, matching the existing
project-id copy control.

**A `/invite/:token` route**, unguarded, showing who invited you to what. If
signed out it offers **Sign in to accept** and stores the token; the `/`
resolver already exists and gains one step — if a pending invitation token is
stored, send the user to `/invite/<token>` instead of a workspace. Accepting
navigates to the newly joined workspace and clears the stored token.

## Two passes

1. **Server** — migration, all three functions, RLS, and the query layer with
   its tests. No UI. Verifiable by the suite and by the migration applying.
2. **Client** — the Settings panel, the accept route, and the resolver step.

## Error handling

- Every function raises with a readable message; the client surfaces it
  verbatim rather than inventing copy.
- The accept screen distinguishes expired, already accepted, wrong email, and
  not found, because the remedies differ: ask for a new link, nothing to do,
  sign in as someone else, check the link.
- A failed invitation list degrades the panel to the create form rather than
  breaking Settings.

## Testing

Query-layer tests for all six client functions: argument shapes, the email
validation, and that `listInvitations` filters to pending.

Component tests for the invitations panel (create, copy, revoke, and the
owner/admin gate) and the accept screen (each of the four failure states, plus
the signed-out path).

**RLS and the function bodies are not testable here** — no database in the
vitest environment. Their correctness is argued from the SQL, and the accept
path in particular deserves a two-account check before anyone relies on it.

## Out of scope

- Sending email. The link is the deliverable.
- Resending or extending an invitation — revoke and re-invite.
- Inviting someone to a single project rather than a workspace.
- Making `viewer` a meaningful role.
- The member list and role changes — sub-project E.
