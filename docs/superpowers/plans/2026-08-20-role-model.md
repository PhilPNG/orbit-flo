# Role Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `viewer` impossible to hold, and let a workspace owner demote or remove a co-owner.

**Architecture:** A `CHECK` constraint on both role columns closes `viewer` at the database, and dropping it from the TypeScript union closes it at the client — the compiler then deletes the now-unreachable runtime guards for us. The owner door opens in two places: the members UI stops hiding controls for owners (the UPDATE policy already permitted demotion), and a migration drops `role <> 'owner'` from the DELETE policy so removal works too, with `enforce_owner_survives` as the backstop.

**Tech Stack:** Postgres 15 + Supabase RLS, React 19, TypeScript, Vitest + Testing Library.

## Global Constraints

- Migrations are applied by the **user** running `npx supabase db push`. Never run it yourself; hand over the command and stop.
- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- `tsconfig.json` includes `src`, so test files are typechecked by `npm run build`. A `@ts-expect-error` assertion in a test is a real compile-time guard, not decoration.
- Do NOT tighten the 19 membership-only write policies. With `viewer` unreachable they are not a hole, and changing 19 policies risks silently removing a member's ability to write. The spec records this as deliberate.

---

## File Structure

**Create:** `supabase/migrations/202608200002_role_model.sql` — both CHECK constraints, the DELETE policy replacement, and assertions that all three took.

**Create:** `src/features/members/members-panel.test.tsx` — this component has no tests today, and Task 2 changes exactly the branch that decides which controls a member row gets.

**Modify:** `src/lib/supabase/database.types.ts` (the `WorkspaceRole` union, line 9), `src/features/members/members.queries.ts` (`assignableRoles`, and a now-uncompilable guard), `src/features/members/members-panel.tsx` (two guards, lines 88 and 113), `src/features/invitations/invitations.queries.ts` (a now-uncompilable guard and a stale comment), `docs/verification/rls-assertions.sql` (the `grants` group).

## Facts about the existing code you will need

- `WorkspaceRole` is a hand-written union at `src/lib/supabase/database.types.ts:9`:
  `export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";`
- `assignableRoles` in `members.queries.ts` is `["admin", "member"]`, carrying the comment *"owner is deliberately absent: transferring ownership is its own decision."*
- `invitableRoles` in `invitations.queries.ts` is `["member", "admin", "owner"]`, carrying the comment *"viewer is in the enum but no policy grants it anything."*
- Both query modules contain a runtime guard `if (input.role === "viewer") throw new Error("The viewer role is not available yet.");`. **Removing `viewer` from the union makes these a type error** — comparing against a value not in the type. That is the point: the compiler proves they are unreachable.
- `members-panel.tsx` gates both the role `<select>` and the remove button on `isOwner && !isMe && member.role !== "owner"` at lines 88 and 113.
- `MembersPanel` takes no props. It calls `useWorkspaceId()`, `useAuth()`, and `listMembers`.
- The current DELETE policy is
  `USING (private.has_workspace_role(workspace_id, ARRAY['owner']) AND (role <> 'owner'))`.

---

## Task 1: Migration

**Files:**
- Create: `supabase/migrations/202608200002_role_model.sql`

**Interfaces:**
- Produces: two CHECK constraints named `workspace_members_role_not_viewer` and `workspace_invitations_role_not_viewer`; a replaced DELETE policy named `Workspace owners can remove memberships`.

- [ ] **Step 1: Write the migration**

```sql
-- Two defects in the role model, closed together because they are the same
-- subsystem.
--
-- 1. `viewer` is a value the schema offers and the system refuses. It is in the
--    workspace_role enum, create_workspace_invitation rejects it, and no UI
--    offers it. Worse than useless: private.is_workspace_member ignores role,
--    and 19 write policies are gated on membership alone with no role list, so
--    a viewer inserted by the service role or from the SQL editor would look
--    read-only while holding write access to all of them.
--
--    A CHECK constraint closes it. The enum VALUE stays — removing it means
--    recreating the type and rebuilding every policy and function that depends
--    on it, which is most of the RLS surface, for a value with zero rows in
--    either table. This is a deliberate trade, not an oversight.

alter table public.workspace_members
  add constraint workspace_members_role_not_viewer check (role <> 'viewer');

alter table public.workspace_invitations
  add constraint workspace_invitations_role_not_viewer check (role <> 'viewer');

-- 2. Two owners could never remove each other. Demotion already worked — the
--    UPDATE policy's WITH CHECK permits it because user_id <> auth.uid() holds
--    for someone else's row — but the DELETE policy carried `role <> 'owner'`,
--    so removal was blocked at the database and the UI hid the control to
--    match.
--
--    The invariant that a workspace keeps an owner belongs to
--    enforce_owner_survives, which fires on every path, not to a policy clause
--    that only covers this one. Dropping the clause makes the trigger the
--    single place that guarantee lives.

drop policy "Workspace owners can remove memberships" on public.workspace_members;

create policy "Workspace owners can remove memberships"
on public.workspace_members
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));

-- Assert rather than assume: a constraint that failed to attach, or a policy
-- that was recreated with the old clause, would both be silent.
do $$
declare
  policy_using text;
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspace_members_role_not_viewer'
      and conrelid = 'public.workspace_members'::regclass
  ) then
    raise exception 'workspace_members_role_not_viewer was not created';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'workspace_invitations_role_not_viewer'
      and conrelid = 'public.workspace_invitations'::regclass
  ) then
    raise exception 'workspace_invitations_role_not_viewer was not created';
  end if;

  select qual into policy_using
  from pg_policies
  where schemaname = 'public'
    and tablename = 'workspace_members'
    and policyname = 'Workspace owners can remove memberships';

  if policy_using is null then
    raise exception 'the remove-memberships policy is missing';
  end if;

  -- The new expression still mentions 'owner' inside the ARRAY, so match on the
  -- comparison itself rather than on the word.
  if policy_using like '%role <>%' then
    raise exception 'the remove-memberships policy still excludes owners: %', policy_using;
  end if;
end
$$;
```

- [ ] **Step 2: Ask the user to apply it**

Give them exactly this and wait — do not run it yourself:

```bash
npx supabase db push --workdir "C:\src\Personal\ToDo\.worktrees\project-command-center"
```

Expected: `Finished supabase db push.`

If a CHECK constraint fails to apply, some row holds `viewer`. Both tables were
verified empty of it, so investigate rather than dropping the constraint.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202608200002_role_model.sql
git commit -m "feat: forbid viewer and let owners remove co-owners"
```

---

## Task 2: Client

**Files:**
- Modify: `src/lib/supabase/database.types.ts`, `src/features/members/members.queries.ts`, `src/features/members/members-panel.tsx`, `src/features/invitations/invitations.queries.ts`
- Create: `src/features/members/members-panel.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 — this task is independent and can be reviewed on its own.
- Produces: `assignableRoles` becomes `["owner", "admin", "member"]`; `WorkspaceRole` becomes `"owner" | "admin" | "member"`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/members/members-panel.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceRole } from "../../lib/supabase/database.types";
import { MembersPanel } from "./members-panel";
import { assignableRoles } from "./members.queries";

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("../workspaces/workspace-context", () => ({
  useWorkspaceId: () => "workspace-1",
}));

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-me" } }),
}));

vi.mock("./members.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./members.queries")>()),
  listMembers: vi.fn().mockResolvedValue([
    { id: "m1", userId: "user-me", role: "owner", displayName: "Me" },
    { id: "m2", userId: "user-other", role: "owner", displayName: "Co Owner" },
  ]),
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MembersPanel />
    </QueryClientProvider>,
  );
}

describe("MembersPanel", () => {
  it("lets an owner change a co-owner's role", async () => {
    renderPanel();
    expect(await screen.findByLabelText("Role for Co Owner")).toBeInTheDocument();
  });

  it("lets an owner remove a co-owner", async () => {
    renderPanel();
    expect(await screen.findByRole("button", { name: "Remove Co Owner" })).toBeInTheDocument();
  });

  it("never offers those controls for your own row", async () => {
    // Self-demotion is blocked by the UPDATE policy's WITH CHECK, so offering
    // the control would show a button that always fails.
    renderPanel();
    await screen.findByLabelText("Role for Co Owner");
    expect(screen.queryByLabelText("Role for Me")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Me" })).not.toBeInTheDocument();
  });

  it("offers owner as an assignable role", () => {
    expect(assignableRoles).toContain("owner");
  });

  it("no longer admits viewer as a role", () => {
    // @ts-expect-error viewer was removed from WorkspaceRole
    const gone: WorkspaceRole = "viewer";
    expect(gone).toBe("viewer");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 members-panel`

Expected: FAIL. The role select and remove button are hidden for a co-owner, so
the first two cannot find their elements; `assignableRoles` lacks `owner`; and
the `@ts-expect-error` is *unused* because `"viewer"` is still assignable, which
`tsc` reports as an error of its own.

- [ ] **Step 3: Narrow the type**

In `src/lib/supabase/database.types.ts`, line 9:

```ts
export type WorkspaceRole = "owner" | "admin" | "member";
```

- [ ] **Step 4: Delete the guards the compiler now rejects**

`npm run build` will now fail on two lines. Delete both — the type makes them
unreachable, and that is the guarantee replacing them.

In `src/features/invitations/invitations.queries.ts`, remove:

```ts
  if (input.role === "viewer") throw new Error("The viewer role is not available yet.");
```

In `src/features/members/members.queries.ts`, remove the identical line.

The SQL function `create_workspace_invitation` keeps its own `raise` for
`viewer`. That is not redundant: it is the readable error for any caller that is
not this TypeScript client.

- [ ] **Step 5: Open the roles**

In `src/features/members/members.queries.ts`, replace the `assignableRoles`
declaration and its comment with:

```ts
/**
 * owner is assignable: several owners may coexist, and any of them may demote
 * another. enforce_owner_survives refuses the last one, so the invariant is
 * held by the database rather than by hiding the control.
 */
export const assignableRoles = ["owner", "admin", "member"] as const satisfies readonly WorkspaceRole[];
```

In `src/features/invitations/invitations.queries.ts`, replace the stale comment
above `invitableRoles` — it currently explains a `viewer` that no longer exists
in the type — with:

```ts
/** Every role a person can be invited as. viewer is not one: see 202608200002. */
```

- [ ] **Step 6: Stop hiding the controls**

In `src/features/members/members-panel.tsx`, at both line 88 and line 113,
change the condition from:

```tsx
              {isOwner && !isMe && member.role !== "owner" ? (
```

to:

```tsx
              {isOwner && !isMe ? (
```

Leave the `!isMe` half alone. Self-demotion is blocked by the UPDATE policy's
`WITH CHECK`, so offering the control on your own row would show a button that
always fails.

The comment above the role select currently reads *"An owner's role is fixed
here: transferring ownership is a different decision from adjusting someone's
access."* Replace it with:

```tsx
              {/* A co-owner can be demoted or removed like anyone else. The
                  last owner cannot: enforce_owner_survives refuses, on every
                  path rather than only through this control. */}
```

- [ ] **Step 7: Run the tests**

Run: `npm test -- --maxWorkers=2 members-panel`
Expected: PASS, 5 tests.

- [ ] **Step 8: Run the full suite and build**

Run: `npm test -- --maxWorkers=2`, then `npm run build`.

Expected: both clean. The build is the one that proves the `@ts-expect-error`
assertion and the deleted guards are consistent.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase/database.types.ts src/features/members/ src/features/invitations/invitations.queries.ts
git commit -m "feat: forbid viewer in the type and let owners manage co-owners"
```

---

## Task 3: Verification

**Files:**
- Modify: `docs/verification/rls-assertions.sql`

**Interfaces:**
- Consumes: the constraints and policy from Task 1, which must be applied before this runs.

- [ ] **Step 1: Extend the `grants` group**

`docs/verification/rls-assertions.sql` has a `grants` group near the end,
before the section headed `-- 15. Report.`. Add these two checks inside it,
following the file's existing conventions: results go into `rls_results` with
the verdict vocabulary `PASS` / `FAIL — …` / `VACUOUS — …` / `SKIP — …`, and
anything that writes must roll back.

```sql
do $$
declare
  holders integer;
  outcome text := 'accepted';
begin
  select
    (select count(*) from public.workspace_members where role = 'viewer')
    + (select count(*) from public.workspace_invitations where role = 'viewer')
  into holders;

  insert into rls_results
  values (
    'grants',
    'nobody holds the viewer role',
    '0 rows',
    holders || ' rows',
    case when holders = 0 then 'PASS' else 'FAIL — viewer is reachable after all' end
  );

  -- A count of zero could mean the constraint works or merely that nobody has
  -- tried. Prove it actually refuses, inside a subtransaction so nothing
  -- persists.
  --
  -- The user_id is a fresh uuid rather than an existing member, so the row
  -- cannot collide with the (workspace_id, user_id) unique index. If it did,
  -- a unique violation would be indistinguishable from the CHECK firing and
  -- the probe would pass for the wrong reason.
  begin
    insert into public.workspace_members (workspace_id, user_id, role)
    select w.id, gen_random_uuid(), 'viewer'
    from public.workspaces w
    limit 1;
    outcome := 'accepted';
    raise exception using errcode = 'ORB01';
  exception
    when sqlstate 'ORB01' then null;                      -- insert succeeded, rolled back
    when check_violation then outcome := 'rejected';
    when others then outcome := 'inconclusive: ' || sqlerrm;
  end;

  insert into rls_results
  values (
    'grants',
    'the database refuses a viewer membership',
    'rejected by CHECK',
    outcome,
    case
      when outcome = 'rejected' then 'PASS'
      when outcome = 'accepted' then 'FAIL — the CHECK constraint is not enforcing'
      else 'VACUOUS — ' || outcome
    end
  );
end
$$;
```

Two details carry this probe. The `ORB01` sentinel means a *successful* insert
is rolled back and recorded as `accepted`, which is the failing case. And only
`check_violation` counts as proof: a foreign-key or unique violation would
otherwise look identical to the constraint firing, and the check would pass
having demonstrated nothing. Those land as `VACUOUS`, not `PASS`.

A foreign-key violation on `user_id` referencing `auth.users` is the likely
`inconclusive` outcome here, since the uuid is fabricated. If that happens the
check is honest about proving nothing — fix it by inserting into
`workspace_invitations` instead, whose `role` carries the same constraint and
whose columns have no such reference.

- [ ] **Step 2: Add `'grants'` ordering — already present**

The report's ordering `CASE` already contains `when 'grants' then 7`. No change.

- [ ] **Step 3: Ask the user to run the harness**

```bash
npx supabase db query --workdir "C:\src\Personal\ToDo\.worktrees\project-command-center" --linked -f docs/verification/rls-assertions.sql
```

Expected: 0 failures. The CLI prints only the final summary; to see per-check
detail, truncate the file before the `-- Summary line.` block so the detail
table is the last result set.

- [ ] **Step 4: Commit**

```bash
git add docs/verification/rls-assertions.sql
git commit -m "test: assert viewer is unreachable"
```

---

## Self-review notes

**Spec coverage.** CHECK constraints on both columns → Task 1. DELETE policy
without `role <> 'owner'` → Task 1. `WorkspaceRole` union → Task 2 step 3.
`assignableRoles` gains owner → Task 2 step 5. Members-list guards → Task 2 step
6. Stale comments → Task 2 steps 5 and 6. Viewer check in the harness → Task 3.
The 19 membership-only policies are deliberately untouched, per Global
Constraints.

**The e2e needs no edit.** `collaboration.spec.ts` already asserts *the last
owner cannot leave the workspace*, which is the regression net for the DELETE
policy change. It must keep passing; if it starts failing, the trigger — not
the policy — is what to look at.

**Ordering.** Task 2 is independent of Tasks 1 and 3 and can be reviewed alone.
Task 3's probes require Task 1 to be applied, so the user's `db push` must
happen between them.
