/**
 * The tools Orbit Flo hands to a browser-hosted agent via WebMCP.
 *
 * Every tool wraps a domain function that already exists and is already
 * tested, called with the SAME authenticated client the user's own clicks go
 * through. RLS and the column grants are the security boundary - the tool
 * layer cannot add privileges, only choose which operations to surface. That
 * is why nothing destructive or administrative appears here: not because a
 * prompt forbids it, but because it is not exposed and the database would
 * refuse it regardless.
 *
 * Each mutating tool ends by invalidating the query caches the UI reads,
 * which is what makes an agent's work appear on screen while it talks.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WorkItemStatus, CaptureType } from "../../lib/supabase/database.types";
import { formatPlanDate } from "../daily/daily-plan.utils";
import {
  completeDailyPlanItem,
  createCapture,
  getDailyMissionControlData,
} from "../daily/daily-plan.queries";
import { listProjects } from "../projects/projects.queries";
import { searchWorkspace } from "../search/search.queries";
import { createWorkItem, updateWorkItemStatus, workItemStatuses } from "../work-items/work-items.queries";

export type AgentToolContext = {
  client: SupabaseClient<Database>;
  queryClient: QueryClient;
  workspaceId: string;
  userId: string;
};

export type AgentToolResult = { content: Array<{ type: "text"; text: string }> };

export type AgentTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<AgentToolResult>;
};

const text = (value: string): AgentToolResult => ({ content: [{ type: "text", text: value }] });

const CAPTURE_TYPES: readonly CaptureType[] = ["task", "note", "idea", "blocker"];

const MAX_TEXT_LENGTH = 2000;

/** The schema's `required` is the agent's promise, not enforcement. A missing
 *  title coerced with String() would WRITE a task literally titled
 *  "undefined" - a successful-looking wrong row, worse than an error. */
function requireText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_TEXT_LENGTH);
}

/** Every execute is wrapped: a thrown Supabase error becomes a text result the
 *  agent can read aloud. "row-level security policy violation" is a truthful
 *  story about the boundary; an unhandled rejection is a broken page. */
function guarded(run: (input: Record<string, unknown>) => Promise<AgentToolResult>) {
  return async (input: Record<string, unknown>): Promise<AgentToolResult> => {
    try {
      return await run(input);
    } catch (error) {
      return text(`That didn't work: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

export function buildAgentTools(context: AgentToolContext): AgentTool[] {
  const { client, queryClient, workspaceId, userId } = context;

  const invalidate = (...keys: string[][]) =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  return [
    {
      name: "list_projects",
      description:
        "List the projects in the user's current workspace, with their ids, names and statuses. Call this first to get project ids for other tools.",
      inputSchema: { type: "object", properties: {}, required: [] },
      execute: guarded(async () => {
        const projects = await listProjects(client, workspaceId);
        return text(JSON.stringify(projects.map((p) => ({ id: p.id, name: p.name, status: p.status }))));
      }),
    },
    {
      name: "get_flight_plan",
      description:
        "Get today's daily plan (the flight plan): its items with their ids and states, plus due work items. Use the item ids with complete_plan_item.",
      inputSchema: { type: "object", properties: {}, required: [] },
      execute: guarded(async () => {
        const data = await getDailyMissionControlData(client, workspaceId, formatPlanDate());
        // Projected, not dumped: the query selects * on every non-done work
        // item, full markdown descriptions included, which would swamp an
        // agent's context in a real workspace.
        return text(
          JSON.stringify({
            planDate: formatPlanDate(),
            planItems: data.dailyPlanItems.map((item) => ({
              id: item.id,
              state: item.state,
              isPrimary: item.is_primary,
              workItem: item.workItem
                ? { id: item.workItem.id, title: item.workItem.title, status: item.workItem.status }
                : null,
            })),
            availableWorkItems: data.availableWorkItems.slice(0, 25).map((item) => ({
              id: item.id,
              title: item.title,
              status: item.status,
              dueDate: item.due_date,
              projectId: item.project_id,
            })),
            projects: (data.projects ?? []).map((project) => ({ id: project.id, name: project.name })),
          }),
        );
      }),
    },
    {
      name: "create_task",
      description:
        "Create a task in a project. Requires a projectId from list_projects. The task appears on the user's kanban board immediately.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Id of the project, from list_projects" },
          title: { type: "string", description: "Short task title" },
          description: { type: "string", description: "Optional details; supports markdown" },
          dueDate: { type: "string", description: "Optional due date, YYYY-MM-DD" },
        },
        required: ["projectId", "title"],
      },
      execute: guarded(async (input) => {
        const title = requireText(input.title);
        if (!title) return text("A task needs a non-empty string title.");
        const item = await createWorkItem(client, {
          workspaceId,
          projectId: String(input.projectId),
          userId,
          title,
          description: input.description ? String(input.description) : undefined,
          dueDate: input.dueDate ? String(input.dueDate) : undefined,
          // createWorkItem requires priority and status; the tool doesn't
          // expose them, so it uses the same defaults the notes-page and
          // inbox-page "quick create" paths use for a bare title.
          priority: "medium",
          status: "backlog",
        });
        await invalidate(["work-items"], ["workspace-work-items"]);
        return text(`Created task "${item.title}" (${item.id}) in status ${item.status}.`);
      }),
    },
    {
      name: "move_task",
      description:
        "Move a task to another status column. Valid statuses: backlog, ready, in_progress, blocked, review, done. The board updates immediately.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task id" },
          projectId: { type: "string", description: "The task's project id" },
          status: { type: "string", enum: [...workItemStatuses], description: "Target status" },
        },
        required: ["id", "projectId", "status"],
      },
      execute: guarded(async (input) => {
        const status = String(input.status);
        if (!(workItemStatuses as readonly string[]).includes(status)) {
          return text(`"${status}" is not a valid status. Valid statuses: ${workItemStatuses.join(", ")}.`);
        }
        const item = await updateWorkItemStatus(client, {
          id: String(input.id),
          workspaceId,
          projectId: String(input.projectId),
          status: status as WorkItemStatus,
        });
        await invalidate(["work-items"], ["workspace-work-items"]);
        return text(`Moved "${item.title}" to ${item.status}.`);
      }),
    },
    {
      name: "search_workspace",
      description:
        "Search the workspace across tasks, notes, projects and milestones. Supports operators like is:milestone and type:decision.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Search terms" } },
        required: ["query"],
      },
      execute: guarded(async (input) => {
        const results = await searchWorkspace(client, workspaceId, String(input.query));
        if (results.length === 0) return text("No results.");
        return text(JSON.stringify(results.slice(0, 12)));
      }),
    },
    {
      name: "capture_thought",
      description:
        "Capture a quick thought into the user's inbox for later triage. Type is one of: task, note, idea, blocker.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "The thought, briefly" },
          type: { type: "string", enum: [...CAPTURE_TYPES], description: "Kind of capture; default idea" },
          body: { type: "string", description: "Optional detail" },
        },
        required: ["title"],
      },
      execute: guarded(async (input) => {
        const requested = input.type ? String(input.type) : "idea";
        const type = (CAPTURE_TYPES as readonly string[]).includes(requested) ? (requested as CaptureType) : "idea";
        const title = requireText(input.title);
        if (!title) return text("A capture needs a non-empty string title.");
        const capture = await createCapture(client, {
          workspaceId,
          userId,
          type,
          title,
          body: input.body ? String(input.body) : undefined,
        });
        await invalidate(["inbox-captures"], ["daily-mission-control"]);
        return text(`Captured "${capture.title}" as ${type}.`);
      }),
    },
    {
      name: "complete_plan_item",
      description:
        "Mark an item on today's flight plan as completed. Get item ids from get_flight_plan. The user sees the completion animation.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Plan item id, from get_flight_plan" } },
        required: ["id"],
      },
      execute: guarded(async (input) => {
        const item = await completeDailyPlanItem(client, { id: String(input.id), workspaceId });
        await invalidate(["daily-mission-control"]);
        return text(`Completed plan item ${item.id}.`);
      }),
    },
  ];
}
