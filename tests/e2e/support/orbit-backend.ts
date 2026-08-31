import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Backend plumbing for the collaboration e2e run.
 *
 * These tests need something the rest of the suite deliberately avoids: a real
 * Supabase project. RLS is the thing under test, and RLS cannot be exercised
 * against a placeholder URL or a mocked client — a fake backend would return
 * whatever we told it to and prove nothing.
 */

const url = process.env.VITE_SUPABASE_URL ?? "";
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "";

/** example.com is reserved and undeliverable, so no mail can escape. */
export const testEmailPrefix = "orbit-e2e-";

/**
 * Null when the run can talk to a real project; otherwise the reason, which
 * becomes the skip message. CI has no secrets and must stay green, so the
 * absence of a key is a skip rather than a failure.
 */
export function missingBackendReason(): string | null {
  if (!serviceRoleKey) {
    return "E2E_SUPABASE_SERVICE_ROLE_KEY is not set";
  }
  if (!url || url.includes("e2e-placeholder")) {
    return "VITE_SUPABASE_URL points at the placeholder, not a real project";
  }
  if (!anonKey || anonKey.includes("e2e_placeholder")) {
    return "VITE_SUPABASE_PUBLISHABLE_KEY points at the placeholder";
  }
  return null;
}

function adminClient(): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type TestAccount = { id: string; email: string; password: string };

/**
 * `email_confirm: true` matters twice: it lets the account sign in immediately,
 * and it stops Supabase sending a confirmation mail to an address that does not
 * exist.
 */
export async function createTestAccount(label: string): Promise<TestAccount> {
  const suffix = randomUUID().slice(0, 8);
  const email = `${testEmailPrefix}${label}-${suffix}@example.com`;
  const password = `Orbit!${randomUUID()}`;

  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Could not create the ${label} test account: ${error?.message}`);
  }

  return { id: data.user.id, email, password };
}

/**
 * Deleting the user cascades to workspace_members, and deleting a workspace
 * cascades to everything in it. Runs at the start of the file as well as the
 * end, because a crashed run leaves accounts behind and the next run should not
 * inherit them.
 *
 * The workspaces themselves need a second pass. `workspaces.created_by` is
 * `on delete set null`, not cascade, so deleting the account leaves its
 * personal workspace standing with no members and no creator — verified
 * against the live database, where seven had accumulated. Nothing collects
 * those, so this does.
 */
export async function deleteLeftoverTestAccounts(): Promise<number> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });

  if (error) throw new Error(`Could not list users for cleanup: ${error.message}`);

  const stale = data.users.filter((user) => user.email?.startsWith(testEmailPrefix));

  for (const user of stale) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      throw new Error(`Could not delete ${user.email}: ${deleteError.message}`);
    }
  }

  await deleteOrphanedTestWorkspaces();

  return stale.length;
}

/**
 * Personal workspaces are named "<email>'s Workspace" by the onboarding path,
 * so the test prefix survives in the name after the account is gone. Matching
 * on the name AND on having no members keeps this from ever touching a real
 * workspace.
 */
async function deleteOrphanedTestWorkspaces(): Promise<void> {
  const admin = adminClient();

  const { data, error } = await admin
    .from("workspaces")
    .select("id, name, workspace_members(id)")
    .like("name", `${testEmailPrefix}%`);

  if (error) throw new Error(`Could not list workspaces for cleanup: ${error.message}`);

  const orphaned = ((data ?? []) as unknown as Array<{
    id: string;
    workspace_members: Array<{ id: string }>;
  }>).filter((workspace) => workspace.workspace_members.length === 0);

  for (const workspace of orphaned) {
    const { error: deleteError } = await admin.from("workspaces").delete().eq("id", workspace.id);
    if (deleteError) {
      throw new Error(`Could not delete workspace ${workspace.id}: ${deleteError.message}`);
    }
  }
}

/**
 * A client authenticated as one of the test accounts. Seeding runs through this
 * rather than the service role, so every insert is subject to the same policies
 * the app runs under — a seed that the service role can write but a member
 * cannot would quietly invalidate the assertions built on top of it.
 */
export async function signedInClient(account: TestAccount): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (error) throw new Error(`Could not sign in as ${account.email}: ${error.message}`);

  return client;
}

/** Read with the service role: the invited account cannot see the row yet. */
export async function readInvitationToken(
  workspaceId: string,
  email: string,
): Promise<string> {
  const { data, error } = await adminClient()
    .from("workspace_invitations")
    .select("token")
    .eq("workspace_id", workspaceId)
    .eq("email", email.toLowerCase())
    .is("accepted_at", null)
    .single();

  if (error || !data) {
    throw new Error(`No pending invitation for ${email}: ${error?.message}`);
  }

  return (data as { token: string }).token;
}
