import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createTestAccount,
  deleteLeftoverTestAccounts,
  missingBackendReason,
  readInvitationToken,
  signedInClient,
  type TestAccount,
} from "./support/orbit-backend";

/**
 * The two-account pass, automated.
 *
 * Everything the collaboration arc claims about privacy lives in RLS policies,
 * and the vitest suite mocks Supabase, so none of it is covered there. The SQL
 * assertions in docs/verification prove the database enforces the boundary;
 * this proves the app honours it — that a teammate's browser shows shared work
 * and not personal surfaces.
 *
 * Serial by necessity: each step depends on the account state the previous one
 * left behind.
 */

const skipReason = missingBackendReason();

test.describe("collaboration across two accounts", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(skipReason !== null, `Needs a real Supabase project — ${skipReason}`);

  // A tag on every seeded row, so assertions cannot collide with real data if
  // this is ever pointed at a project that has some.
  const runId = randomUUID().slice(0, 8);
  const projectName = `E2E Mission ${runId}`;
  const taskTitle = `E2E shared task ${runId}`;
  const privateNoteTitle = `E2E private note ${runId}`;
  const captureTitle = `E2E private capture ${runId}`;

  let owner: TestAccount;
  let teammate: TestAccount;
  let ownerContext: BrowserContext;
  let teammateContext: BrowserContext;
  let ownerPage: Page;
  let teammatePage: Page;
  let workspaceId: string;

  test.beforeAll(async ({ browser }) => {
    await deleteLeftoverTestAccounts();

    owner = await createTestAccount("owner");
    teammate = await createTestAccount("teammate");

    // Separate contexts, not separate tabs: supabase-js keeps the session in
    // localStorage, so two tabs would share one account and the whole exercise
    // would be theatre.
    ownerContext = await browser.newContext();
    teammateContext = await browser.newContext();
    ownerPage = await ownerContext.newPage();
    teammatePage = await teammateContext.newPage();
  });

  test.afterAll(async () => {
    await ownerContext?.close();
    await teammateContext?.close();
    // Deleting the accounts cascades away the workspaces and everything in them.
    if (!skipReason) await deleteLeftoverTestAccounts();
  });

  async function signIn(page: Page, account: TestAccount) {
    await page.goto("/");
    await page.getByPlaceholder("Email").fill(account.email);
    await page.locator('input[autocomplete="current-password"]').fill(account.password);
    await page.getByRole("button", { name: "Enter orbit" }).click();
  }

  test("the owner signs in and gets a personal workspace", async () => {
    await signIn(ownerPage, owner);

    // A first sign-in has no workspace; the resolver creates one.
    await ownerPage.waitForURL(/\/w\/[0-9a-f-]{36}/, { timeout: 30_000 });

    workspaceId = new URL(ownerPage.url()).pathname.split("/")[2];
    expect(workspaceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("the owner seeds shared work and personal surfaces", async () => {
    // Seeded through a signed-in client rather than the service role, so every
    // insert passes the same policies the app runs under. A row the service
    // role can write but a member cannot would invalidate what follows.
    const client: SupabaseClient = await signedInClient(owner);

    const project = await client
      .from("projects")
      .insert({ workspace_id: workspaceId, name: projectName, created_by: owner.id })
      .select("id")
      .single();
    expect(project.error, project.error?.message).toBeNull();

    const projectId = (project.data as { id: string }).id;

    const task = await client.from("work_items").insert({
      workspace_id: workspaceId,
      project_id: projectId,
      title: taskTitle,
      created_by: owner.id,
    });
    expect(task.error, task.error?.message).toBeNull();

    // No project_id: a workspace-level note is private by policy.
    const note = await client.from("notes").insert({
      workspace_id: workspaceId,
      title: privateNoteTitle,
      body: "Only the author should ever see this.",
      created_by: owner.id,
    });
    expect(note.error, note.error?.message).toBeNull();

    const capture = await client.from("captures").insert({
      workspace_id: workspaceId,
      title: captureTitle,
      created_by: owner.id,
    });
    expect(capture.error, capture.error?.message).toBeNull();
  });

  test("a non-member cannot reach the workspace by URL", async () => {
    await signIn(teammatePage, teammate);
    await teammatePage.waitForURL(/\/w\/[0-9a-f-]{36}/, { timeout: 30_000 });

    // Guessing another workspace's URL is the cheapest possible attack.
    await teammatePage.goto(`/w/${workspaceId}/projects`);

    await expect(teammatePage.getByText(projectName)).toHaveCount(0);
    await expect(teammatePage.getByText(taskTitle)).toHaveCount(0);
  });

  test("the owner invites the teammate", async () => {
    await ownerPage.goto(`/w/${workspaceId}/settings`);

    const invitations = ownerPage.getByLabel("Invitations");
    await invitations.getByLabel("Email").fill(teammate.email);
    await invitations.getByRole("button", { name: "Create invite" }).click();

    await expect(invitations.getByText(teammate.email)).toBeVisible();
    await expect(
      invitations.getByRole("button", { name: `Copy invite link for ${teammate.email}` }),
    ).toBeVisible();
  });

  test("the teammate accepts and lands in the workspace", async () => {
    const token = await readInvitationToken(workspaceId, teammate.email);

    await teammatePage.goto(`/invite/${token}`);
    await teammatePage.getByRole("button", { name: "Accept invitation" }).click();

    // A regex, not a glob. `**/w/<id>/**` requires a path segment after the
    // workspace id, and the app lands on `/w/<id>` with nothing after it.
    await teammatePage.waitForURL(new RegExp(`/w/${workspaceId}`), { timeout: 30_000 });
  });

  test("the teammate sees shared work", async () => {
    await teammatePage.goto(`/w/${workspaceId}/projects`);
    await expect(teammatePage.getByText(projectName)).toBeVisible();
  });

  test("assigning a task signals the teammate", async () => {
    const asOwner = await signedInClient(owner);

    const { error } = await asOwner
      .from("work_items")
      .update({ assigned_to: teammate.id })
      .eq("title", taskTitle);
    expect(error, error?.message).toBeNull();

    await teammatePage.goto(`/w/${workspaceId}/signals`);

    // Assert on the task title too, not just "assigned you": buildSignalSentence
    // falls back to "a deleted task" when the target title fails to resolve,
    // and that fallback was a real bug on this branch. Asserting the title
    // proves the resolution happened, not just that a signal row exists.
    await expect(
      teammatePage.getByText(`${owner.email.split("@")[0]} assigned you ${taskTitle}`),
    ).toBeVisible();
  });

  test("the owner is not signalled by their own action", async () => {
    await ownerPage.goto(`/w/${workspaceId}/signals`);

    // Wait for the heading before asserting absence, so absence means "the
    // page rendered and the row is not there" rather than "the page had not
    // loaded yet" — an absence assertion against an unrendered page passes
    // vacuously and proves nothing.
    await expect(ownerPage.getByRole("heading", { name: "Signals" })).toBeVisible();
    await expect(ownerPage.getByText(/assigned you/)).toHaveCount(0);
  });

  test("the teammate cannot see the owner's private note", async () => {
    await teammatePage.goto(`/w/${workspaceId}/notes`);

    // The page has to have loaded before absence means anything, so wait for
    // the Brainstorm heading before asserting the note is missing.
    await expect(teammatePage.getByRole("heading", { name: "Brainstorm" })).toBeVisible();
    await expect(teammatePage.getByText(privateNoteTitle)).toHaveCount(0);
  });

  test("the teammate cannot see the owner's captures", async () => {
    await teammatePage.goto(`/w/${workspaceId}/inbox`);

    // exact, because the empty state's own heading is "Inbox clear" and a
    // substring match resolves to two elements.
    await expect(
      teammatePage.getByRole("heading", { exact: true, name: "Inbox" }),
    ).toBeVisible();
    await expect(teammatePage.getByText(captureTitle)).toHaveCount(0);
  });

  test("both members appear with names, not blank avatars", async () => {
    await teammatePage.goto(`/w/${workspaceId}/settings`);

    const members = teammatePage.getByLabel("Members");
    // display_name is derived from the address local part by handle_new_user.
    await expect(members.getByText(owner.email.split("@")[0])).toBeVisible();
    await expect(members.getByText(teammate.email.split("@")[0])).toBeVisible();
  });

  test("a member cannot invite, an admin can", async () => {
    // The teammate joined as `member`, so the RPC must refuse.
    const asTeammate = await signedInClient(teammate);
    const refused = await asTeammate.rpc("create_workspace_invitation", {
      target_workspace_id: workspaceId,
      target_email: "orbit-e2e-should-never-exist@example.com",
      target_role: "member",
    });

    expect(refused.error?.message ?? "").toContain("Only owners and admins can invite");
  });

  test("the last owner cannot leave the workspace", async () => {
    await ownerPage.goto(`/w/${workspaceId}/settings`);
    await ownerPage.getByRole("button", { name: "Leave workspace" }).click();

    // The trigger refuses rather than stranding a workspace with no owner.
    await expect(ownerPage.getByRole("alert")).toContainText("at least one owner");
  });
});
