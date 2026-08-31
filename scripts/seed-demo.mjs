/**
 * Seeds the public demo account for the WebMCP Devpost submission.
 *
 * Idempotent by reset: each run deletes the demo user's workspaces, the user
 * itself, and recreates everything fresh - so a judge (or anyone with the
 * published credentials) redecorating the workspace is one re-run away from
 * clean.
 *
 * Two conventions inherited from the e2e backend, both deliberate:
 * - The account lives at example.com, which is reserved and undeliverable, so
 *   no mail can escape. It does NOT use the "orbit-e2e-" prefix, because the
 *   e2e suite's cleanup deletes everything carrying that prefix.
 * - The admin (service-role) client is used ONLY to create/delete the user.
 *   Every content row is written through a client signed in AS the demo
 *   account, so the seed exercises the same RLS the app runs under - a row
 *   the service role can write but a member cannot would demo as a bug.
 *
 * Daily plans are seeded for today through +6 days: the agent's
 * get_flight_plan tool reads TODAY's plan, and judging happens days after
 * seeding. A single-day seed would demo an empty flight plan.
 *
 * Run: node scripts/seed-demo.mjs
 * Needs .env.local with VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 * E2E_SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

export const DEMO_EMAIL = "orbit-flo-demo@example.com";
export const DEMO_PASSWORD = "orbit-demo-2026";
const WORKSPACE_NAME = "Orbit Flo HQ";
const PLAN_DAYS = 7;

function loadEnv() {
  const env = {};
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = env.E2E_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / E2E_SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function planDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function resetDemoUser() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);

  const existing = data.users.find((user) => user.email?.toLowerCase() === DEMO_EMAIL);
  if (existing) {
    // workspaces.created_by is ON DELETE SET NULL, not cascade - deleting the
    // user first would orphan the workspace. Learned the hard way by the e2e.
    const { error: wsError } = await admin.from("workspaces").delete().eq("created_by", existing.id);
    if (wsError) throw new Error(`workspace cleanup failed: ${wsError.message}`);
    const { error: delError } = await admin.auth.admin.deleteUser(existing.id);
    if (delError) throw new Error(`deleteUser failed: ${delError.message}`);
    console.log("reset: removed existing demo user and workspaces");
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (createError) throw new Error(`createUser failed: ${createError.message}`);
  return created.user.id;
}

async function main() {
  const userId = await resetDemoUser();

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (signInError) throw new Error(`demo sign-in failed: ${signInError.message}`);

  const { data: workspaceId, error: wsError } = await client.rpc("create_workspace", {
    workspace_name: WORKSPACE_NAME,
  });
  if (wsError) throw new Error(`create_workspace failed: ${wsError.message}`);
  console.log(`workspace: ${workspaceId}`);

  const insert = async (table, rows) => {
    const { data, error } = await client.from(table).insert(rows).select("*");
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
    return data;
  };

  // --- Projects -------------------------------------------------------------
  const [launch, beta] = await insert("projects", [
    {
      workspace_id: workspaceId,
      created_by: userId,
      name: "Launch the Website",
      description: "Marketing site for the September launch window.",
      status: "active",
      priority: "high",
      health: "good",
    },
    {
      workspace_id: workspaceId,
      created_by: userId,
      name: "Mobile App Beta",
      description: "TestFlight beta for the companion app.",
      status: "active",
      priority: "medium",
      health: "watch",
    },
  ]);

  // --- Milestones -----------------------------------------------------------
  await insert("milestones", [
    {
      workspace_id: workspaceId,
      project_id: launch.id,
      created_by: userId,
      title: "Content freeze",
      description: "All copy final, no more edits.",
      target_date: planDate(3),
      sort_order: 0,
    },
    {
      workspace_id: workspaceId,
      project_id: launch.id,
      created_by: userId,
      title: "Go live",
      description: "DNS flipped, launch post published.",
      target_date: planDate(6),
      sort_order: 1,
    },
  ]);

  // --- Tasks, spread across statuses so the board reads as lived-in ---------
  const task = (projectId, title, status, priority, extra = {}) => ({
    workspace_id: workspaceId,
    project_id: projectId,
    created_by: userId,
    title,
    status,
    priority,
    description: extra.description ?? null,
    due_date: extra.dueDate ?? null,
  });

  const launchTasks = await insert("work_items", [
    task(launch.id, "Write the launch announcement", "in_progress", "high", {
      description: "Draft in **markdown**, keep it under 400 words.\n\n- Lead with the demo video\n- Close with the changelog link",
      dueDate: planDate(2),
    }),
    task(launch.id, "Record the demo video", "ready", "high", { dueDate: planDate(3) }),
    task(launch.id, "Set up analytics", "backlog", "medium"),
    task(launch.id, "Final accessibility pass", "review", "high"),
    task(launch.id, "Choose the launch date", "done", "critical"),
    task(beta.id, "Fix crash on cold start", "in_progress", "critical", {
      description: "Repro: fresh install, aeroplane mode, open app.",
    }),
    task(beta.id, "Invite the next 50 testers", "ready", "medium"),
    task(beta.id, "Collect week-1 feedback", "backlog", "low"),
  ]);

  // A task whose description links another task - shows the orbit: link
  // rendering in the modal and the plain-text stripping on the card.
  await insert("work_items", [
    task(launch.id, "Publish the changelog", "ready", "medium", {
      description: `Coordinate with [${launchTasks[0].title}](orbit:task/${launchTasks[0].id}) so both go out together.`,
    }),
  ]);

  // --- Notes: a decision (shows on the dashboard) and an idea ---------------
  await insert("notes", [
    {
      workspace_id: workspaceId,
      project_id: launch.id,
      work_item_id: null,
      created_by: userId,
      note_type: "decision",
      title: "Launch on a Tuesday",
      body: "Tuesdays get the best press pickup. Decided after comparing the last three launches.",
      tags: ["launch"],
    },
    {
      workspace_id: workspaceId,
      project_id: beta.id,
      work_item_id: null,
      created_by: userId,
      note_type: "idea",
      title: "Widget for the home screen",
      body: "A tiny flight-plan widget could drive daily retention.",
      tags: ["mobile", "retention"],
    },
  ]);

  // --- Captures: an inbox that is not empty ---------------------------------
  await insert("captures", [
    {
      workspace_id: workspaceId,
      created_by: userId,
      type: "idea",
      title: "Ask the agent to triage this inbox",
      body: null,
      project_id: null,
      work_item_id: null,
    },
    {
      workspace_id: workspaceId,
      created_by: userId,
      type: "blocker",
      title: "App Store review is taking longer than expected",
      body: null,
      project_id: null,
      work_item_id: null,
    },
  ]);

  // --- Daily plans for the judging window -----------------------------------
  // get_flight_plan reads TODAY's plan; judges test days after seeding.
  const planItems = launchTasks.filter((item) => item.status !== "done").slice(0, 3);
  for (let offset = 0; offset < PLAN_DAYS; offset += 1) {
    const [plan] = await insert("daily_plans", [
      { workspace_id: workspaceId, plan_date: planDate(offset), created_by: userId },
    ]);
    await insert(
      "daily_plan_items",
      planItems.map((item, index) => ({
        workspace_id: workspaceId,
        daily_plan_id: plan.id,
        work_item_id: item.id,
        sort_order: index,
        is_primary: index === 0,
      })),
    );
  }

  // --- Verify with the same reads the agent tools use -----------------------
  const { data: projects } = await client.from("projects").select("id").eq("workspace_id", workspaceId);
  const { data: items } = await client.from("work_items").select("id").eq("workspace_id", workspaceId);
  const { data: todayPlan } = await client
    .from("daily_plans")
    .select("id, daily_plan_items(id)")
    .eq("workspace_id", workspaceId)
    .eq("plan_date", planDate(0))
    .single();

  console.log(`seeded: ${projects.length} projects, ${items.length} tasks, today's plan has ${todayPlan.daily_plan_items.length} items`);
  console.log(`sign-in: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
