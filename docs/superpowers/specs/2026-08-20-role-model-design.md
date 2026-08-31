# The role model — removing `viewer`, opening the owner door

## Two defects

**`viewer` is a value the schema offers and the system refuses.** It is in the
`workspace_role` enum, `create_workspace_invitation` rejects it with an explicit
`raise`, and `invitableRoles` omits it. Nothing can create one through the app.

**Two owners can never remove each other.** `invitableRoles` offers `owner`, but
`assignableRoles` is only `["admin", "member"]` and the members list hides both
the role select and the remove button for anyone whose role is `owner`. Invite a
second owner and the only exit is one of them choosing to leave.

## What the investigation changed

Two assumptions in the original framing turned out to be wrong, and both change
what gets built.

### `viewer` is not inert — it is a trap

`private.is_workspace_member` checks membership without looking at role, so a
viewer would read everything a member reads. That part is harmless.

**19 write policies are gated on `is_workspace_member` alone, with no role
list.** A viewer would be able to *write* through every one of them.

The invite RPC refuses to create a viewer, but nothing stops a row being
inserted by the service role or from the SQL editor. That person would look
read-only in the members list while holding write access to 19 policies' worth
of tables. This is a latent hole, not untidiness.

### Demoting a co-owner already works in the database

Only the UI blocks it. The UPDATE policy on `workspace_members` is:

```
USING       private.has_workspace_role(workspace_id, ARRAY['owner'])
WITH CHECK  private.has_workspace_role(workspace_id, ARRAY['owner'])
            AND (user_id <> auth.uid() OR role = 'owner')
```

An owner demoting *another* owner satisfies both — `user_id <> auth.uid()` is
true for someone else's row — and `enforce_owner_survives` permits it while
another owner remains.

Removing a co-owner is genuinely blocked, by the DELETE policy:

```
USING  private.has_workspace_role(workspace_id, ARRAY['owner'])
       AND role <> 'owner'
```

So the fix is not symmetrical: demotion needs a UI change only, removal needs a
migration.

**Self-demotion is blocked** by that same `WITH CHECK` and stays blocked — it is
what stops an owner stranding themselves. The UI already never offers the
dropdown on your own row, so the two agree and neither needs changing.

## Design

### Removing `viewer`

A `CHECK (role <> 'viewer')` constraint on `public.workspace_members.role` and
`public.workspace_invitations.role`. The database then refuses what the code
already claims to refuse.

`viewer` leaves the TypeScript `WorkspaceRole` union so the client cannot
express it. `create_workspace_invitation` keeps its explicit `raise` — the
constraint is the guarantee, the raise is the readable error. Without it a
caller gets a constraint violation instead of a sentence.

**The enum value itself stays, unused.** Removing it means recreating the type
and altering both columns, which requires dropping and rebuilding every policy
and function that depends on it — most of the RLS surface — for a value with
zero rows anywhere. The constraint delivers the same guarantee at a fraction of
the risk. This is a deliberate trade, recorded here so it is not later mistaken
for an oversight.

**The 19 membership-only write policies are left alone.** With `viewer`
unreachable they are no longer a hole, and tightening 19 policies carries real
breakage risk — get one wrong and a member silently loses the ability to write —
for no gain. If `viewer` is ever revived, tightening them is the first task of
that work, and this paragraph is the note to whoever does it.

### Opening the owner door

`assignableRoles` gains `owner`, and the members list stops hiding the role
select and the remove button for members whose role is `owner`. That alone
restores demotion, because the policy already permits it.

A migration then drops `AND role <> 'owner'` from the DELETE policy, so removal
works too. `enforce_owner_survives` becomes the thing that protects the
invariant, rather than a hidden control — which is where the protection belonged
all along: the trigger fires on every path, the hidden button only on one.

The resulting model is roughly GitHub's org owners. Several owners may coexist;
any of them may demote or remove another; the database refuses to let the last
one go.

## Files

**Migration** — `supabase/migrations/202608200002_role_model.sql` (the previous
migration is `202608200001_revoke_anon_table_access.sql`)
- `CHECK (role <> 'viewer')` on both role columns
- replace the `workspace_members` DELETE policy without `role <> 'owner'`
- assertions that both constraints exist and that the DELETE policy no longer
  names `'owner'` in its `USING`

**Modify** — `src/features/members/members.queries.ts` (`assignableRoles`),
`src/features/members/members-panel.tsx` (drop the `member.role !== "owner"`
guards), `src/features/invitations/invitations.queries.ts` (`invitableRoles`
comment, which currently explains a `viewer` that will no longer exist),
`src/lib/supabase/database.types.ts` (`WorkspaceRole` union)

**Modify** — `docs/verification/rls-assertions.sql`: the `grants` group gains a
check that no row in either table holds `viewer`

## Testing

- **vitest** — the members panel offers a role select and a remove button for a
  co-owner; still offers neither for your own row; `assignableRoles` includes
  `owner`; `WorkspaceRole` no longer admits `viewer` (a type-level assertion, so
  the compiler carries it).
- **SQL assertions** — inserting a `viewer` membership fails, inside a
  rolled-back subtransaction; and a `triggers`-style probe that an owner can now
  delete a co-owner's membership while the last owner still cannot be removed.
- **e2e** — `collaboration.spec.ts` already asserts *the last owner cannot leave
  the workspace*, which must keep passing. That test is the regression net for
  the DELETE policy change and needs no edit.

## Risks

- **The DELETE policy change is the sharp edge.** It widens who can be removed,
  and the only thing standing between it and a stranded workspace is
  `enforce_owner_survives`. That trigger was itself broken until two days ago —
  it blocked cascade deletes and made workspaces and accounts undeletable — so
  it deserves the explicit probe listed above rather than assumed correctness.
- **A CHECK constraint is validated against existing rows.** Both tables have
  zero `viewer` rows today, verified, so it will apply cleanly. If that ever
  stops being true the migration fails loudly, which is the correct outcome.
