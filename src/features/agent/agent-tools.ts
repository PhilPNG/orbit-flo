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
import type { Database, WorkItemStatus, CaptureType, NoteType } from "../../lib/supabase/database.types";
import { formatPlanDate } from "../daily/daily-plan.utils";
import {
  addDailyPlanItem,
  completeDailyPlanItem,
  createCapture,
  getDailyMissionControlData,
  getOrCreateDailyPlan,
} from "../daily/daily-plan.queries";
import { listInboxCaptures, updateCapture } from "../inbox/captures.queries";
import { createNote, listNotes } from "../notes/notes.queries";
import { createMilestone } from "../projects/milestones.queries";
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
  /** Set only on tools that read and never write, so a host can offer them
   *  without the confirmation a mutation deserves. Mutating tools declare
   *  nothing here - absence, not `false`, is their answer. */
  annotations?: { readOnlyHint?: boolean };
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
      annotations: { readOnlyHint: true },
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
      annotations: { readOnlyHint: true },
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
      name: "file_capture_as_task",
      description:
        "Turn an unprocessed inbox capture into a task in a project. Get captureId from list_inbox and projectId from list_projects. Marks the capture processed so it leaves the inbox.",
      inputSchema: {
        type: "object",
        properties: {
          captureId: { type: "string", description: "Id of the capture, from list_inbox" },
          projectId: { type: "string", description: "Id of the project, from list_projects" },
          dueDate: { type: "string", description: "Optional due date, YYYY-MM-DD" },
        },
        required: ["captureId", "projectId"],
      },
      execute: guarded(async (input) => {
        const captureId = requireText(input.captureId);
        const projectId = requireText(input.projectId);
        if (!captureId || !projectId) return text("file_capture_as_task needs a captureId and a projectId.");

        const captures = await listInboxCaptures(client, workspaceId);
        const capture = captures.find((c) => c.id === captureId);
        if (!capture) return text("No unprocessed capture with that id was found in the inbox.");

        // Exactly the inbox page's sequence: the task must exist before the
        // capture is marked processed, or a mid-sequence failure loses the
        // capture with nothing to show for it.
        const item = await createWorkItem(client, {
          workspaceId,
          projectId,
          userId,
          title: capture.title,
          description: capture.body ?? "",
          dueDate: input.dueDate ? String(input.dueDate) : undefined,
          priority: "medium",
          status: "backlog",
        });
        await updateCapture(client, {
          id: capture.id,
          workspaceId,
          projectId,
          processedAt: new Date().toISOString(),
        });
        await invalidate(["inbox-captures"], ["work-items"], ["workspace-work-items"], ["daily-mission-control"]);
        return text(`Filed capture "${capture.title}" as task "${item.title}" (${item.id}).`);
      }),
    },
    {
      name: "add_to_flight_plan",
      description:
        "Add a task to today's flight plan. Requires a taskId, from create_task, file_capture_as_task, search_workspace or get_flight_plan.",
      inputSchema: {
        type: "object",
        properties: { taskId: { type: "string", description: "Id of the task/work item to add" } },
        required: ["taskId"],
      },
      execute: guarded(async (input) => {
        const taskId = requireText(input.taskId);
        if (!taskId) return text("add_to_flight_plan needs a non-empty taskId.");

        const planDate = formatPlanDate();
        const plan = await getOrCreateDailyPlan(client, { workspaceId, userId, planDate });
        const data = await getDailyMissionControlData(client, workspaceId, planDate);
        await addDailyPlanItem(client, {
          workspaceId,
          dailyPlanId: plan.id,
          workItemId: taskId,
          sortOrder: data.dailyPlanItems.length,
          isPrimary: false,
        });
        await invalidate(["daily-mission-control"]);
        return text(`Added task ${taskId} to today's flight plan.`);
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
      annotations: { readOnlyHint: true },
      execute: guarded(async (input) => {
        const results = await searchWorkspace(client, workspaceId, String(input.query));
        if (results.length === 0) return text("No results.");
        return text(JSON.stringify(results.slice(0, 12)));
      }),
    },
    {
      name: "list_inbox",
      description:
        "List up to 20 unprocessed captures in the inbox, with their ids, titles, types and bodies. Use file_capture_as_task with a projectId from list_projects to turn one into a task.",
      inputSchema: { type: "object", properties: {}, required: [] },
      annotations: { readOnlyHint: true },
      execute: guarded(async () => {
        const captures = await listInboxCaptures(client, workspaceId);
        if (captures.length === 0) return text("The inbox is empty.");
        return text(
          JSON.stringify(
            captures.slice(0, 20).map((c) => ({ id: c.id, title: c.title, type: c.type, body: c.body })),
          ),
        );
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
    {
      name: "list_notes",
      description:
        "List the workspace's notes, newest first - ideas, questions, decisions, risks, references. Pass projectId to scope to one project.",
      inputSchema: {
        type: "object",
        properties: { projectId: { type: "string", description: "Optional project id, from list_projects" } },
        required: [],
      },
      annotations: { readOnlyHint: true },
      execute: guarded(async (input) => {
        const notes = await listNotes(client, workspaceId, input.projectId ? String(input.projectId) : undefined);
        if (notes.length === 0) return text("No notes yet.");
        return text(
          JSON.stringify(
            notes.slice(0, 20).map((note) => ({ id: note.id, type: note.note_type, title: note.title })),
          ),
        );
      }),
    },
    {
      name: "create_note",
      description:
        "Write a note into the workspace. Type is one of: idea, question, decision, risk, reference. Decisions surface on the dashboard.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short note title" },
          type: { type: "string", enum: ["idea", "question", "decision", "risk", "reference"], description: "Kind of note; default idea" },
          body: { type: "string", description: "Optional body; supports markdown and orbit: links" },
          projectId: { type: "string", description: "Optional project to attach it to" },
        },
        required: ["title"],
      },
      execute: guarded(async (input) => {
        const title = requireText(input.title);
        if (!title) return text("A note needs a non-empty string title.");
        const requested = input.type ? String(input.type) : "idea";
        const noteTypes: readonly NoteType[] = ["idea", "question", "decision", "risk", "reference"];
        const noteType = (noteTypes as readonly string[]).includes(requested) ? (requested as NoteType) : "idea";
        const note = await createNote(client, {
          workspaceId,
          projectId: input.projectId ? String(input.projectId) : undefined,
          userId,
          noteType,
          title,
          body: input.body ? String(input.body) : undefined,
          tags: [],
        });
        await invalidate(["notes"], ["daily-mission-control"]);
        return text(`Noted "${note.title}" as ${noteType}.`);
      }),
    },
    {
      name: "create_milestone",
      description:
        "Add a milestone to a project's roadmap. Requires a projectId from list_projects; targetDate is optional YYYY-MM-DD.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project id, from list_projects" },
          title: { type: "string", description: "Milestone title" },
          description: { type: "string", description: "Optional description" },
          targetDate: { type: "string", description: "Optional target date, YYYY-MM-DD" },
        },
        required: ["projectId", "title"],
      },
      execute: guarded(async (input) => {
        const title = requireText(input.title);
        if (!title) return text("A milestone needs a non-empty string title.");
        const milestone = await createMilestone(client, {
          workspaceId,
          projectId: String(input.projectId),
          userId,
          title,
          description: input.description ? String(input.description) : undefined,
          targetDate: input.targetDate ? String(input.targetDate) : undefined,
        });
        await invalidate(["milestones"], ["daily-mission-control"]);
        return text(`Milestone "${milestone.title}" added to the roadmap.`);
      }),
    },
  ];
}
