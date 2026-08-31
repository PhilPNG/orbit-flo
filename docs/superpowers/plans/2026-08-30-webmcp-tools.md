# WebMCP Agent Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register seven WebMCP tools wrapping existing domain functions, so a browser-hosted agent can operate Orbit Flo through the user's own session — with every mutation appearing on screen live.

**Architecture:** A pure `buildAgentTools(context)` factory produces the tool definitions (testable with a fake registry), and a `useAgentTools()` hook mounted in the app shell registers them through `document.modelContext` when it exists and no-ops everywhere else. No new data paths: every tool calls a function that already exists.

**Tech Stack:** React 19, TypeScript, TanStack Query, Supabase, `webmcp-types` (types-only devDependency, verified on npm at 0.1.5).

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **810 tests currently pass. No existing test may be modified.**
- The only new package is the types-only devDependency `webmcp-types`.
- **No new data paths.** Every tool wraps an exported function from `src/features/*/…queries.ts`. If a tool seems to need something the domain layer cannot do, the tool is out of scope — do not extend the domain layer.
- **Feature-detect always.** No `document.modelContext` (every current browser without the flag, and jsdom) → register nothing, throw nothing.
- Tools return MCP-shaped results: `{ content: [{ type: "text", text: string }] }`. Errors are caught and returned as text, never thrown out of `execute`.

---

## File Structure

**Create:** `src/features/agent/agent-tools.ts` — the pure factory. All seven definitions, no React.

**Create:** `src/features/agent/agent-tools.test.ts`

**Create:** `src/features/agent/use-agent-tools.ts` — the hook: feature detection, registration, abort-on-cleanup, re-register on workspace change.

**Create:** `src/features/agent/use-agent-tools.test.tsx`

**Modify:** `src/components/app-shell.tsx` — one mount line.

**Modify:** `package.json` — add `webmcp-types` to devDependencies.

---

## Task 1: The tool factory

**Files:**
- Create: `src/features/agent/agent-tools.ts`, `src/features/agent/agent-tools.test.ts`

**Interfaces:**
- Produces:
  - `export type AgentToolContext = { client: SupabaseClient<Database>; queryClient: QueryClient; workspaceId: string; userId: string }`
  - `export type AgentTool = { name: string; description: string; inputSchema: object; execute: (input: Record<string, unknown>) => Promise<{ content: Array<{ type: "text"; text: string }> }> }`
  - `export function buildAgentTools(context: AgentToolContext): AgentTool[]`

### Background you need

Every wrapped function already exists with these verified signatures:

| Function | Module | Signature (after `client`) |
|---|---|---|
| `listProjects` | `projects.queries.ts` | `(workspaceId)` |
| `getDailyMissionControlData` | `daily-plan.queries.ts` | `(workspaceId, planDate)` |
| `createWorkItem` | `work-items.queries.ts` | `({ workspaceId, projectId, userId, title, description?, dueDate? })` |
| `updateWorkItemStatus` | `work-items.queries.ts` | `({ id, workspaceId, projectId, status })` |
| `searchWorkspace` | `search.queries.ts` | `(workspaceId, rawTerm)` |
| `createCapture` | `daily-plan.queries.ts` | `({ workspaceId, userId, type, title, body?, projectId?, workItemId? })` |
| `completeDailyPlanItem` | `daily-plan.queries.ts` | `({ id, workspaceId })` |

`formatPlanDate()` is exported from `src/features/daily/daily-plan.utils.ts` and is how the daily page computes today's date — reuse it, computed **inside** `execute` so a page left open overnight uses the right day.

Valid statuses come from `workItemStatuses` in `work-items.queries.ts` (`backlog | ready | in_progress | blocked | review | done`). `CaptureType` is `task | note | idea | blocker` from `database.types.ts`.

**Query keys, verified against the UI, invalidated as prefixes:**

| After | Invalidate |
|---|---|
| `create_task`, `move_task` | `["work-items"]` and `["workspace-work-items"]` |
| `capture_thought` | `["inbox-captures"]` and `["daily-mission-control"]` |
| `complete_plan_item` | `["daily-mission-control"]` |

- [ ] **Step 1: Write the failing tests**

Create `src/features/agent/agent-tools.test.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAgentTools } from "./agent-tools";

vi.mock("../projects/projects.queries", () => ({
  listProjects: vi.fn().mockResolvedValue([{ id: "p1", name: "Orbit", status: "active" }]),
}));
vi.mock("../work-items/work-items.queries", () => ({
  // The title here must match what create_task's test passes in, because the
  // implementation interpolates the RETURNED row's title into its result text.
  createWorkItem: vi.fn().mockResolvedValue({ id: "w1", title: "Ship it", status: "backlog" }),
  updateWorkItemStatus: vi.fn().mockResolvedValue({ id: "w1", status: "done" }),
  workItemStatuses: ["backlog", "ready", "in_progress", "blocked", "review", "done"],
}));
vi.mock("../search/search.queries", () => ({
  searchWorkspace: vi.fn().mockResolvedValue([]),
}));
vi.mock("../daily/daily-plan.queries", () => ({
  getDailyMissionControlData: vi.fn().mockResolvedValue({ plan: null, workItems: [] }),
  createCapture: vi.fn().mockResolvedValue({ id: "c1", title: "Thought" }),
  completeDailyPlanItem: vi.fn().mockResolvedValue({ id: "d1", state: "completed" }),
}));

import { createWorkItem, updateWorkItemStatus } from "../work-items/work-items.queries";
import { completeDailyPlanItem } from "../daily/daily-plan.queries";

const context = () => ({
  client: {} as never,
  queryClient: new QueryClient(),
  workspaceId: "ws-1",
  userId: "user-1",
});

describe("buildAgentTools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes exactly the seven approved tools, and none of the dangerous ones", () => {
    const names = buildAgentTools(context()).map((tool) => tool.name).sort();

    expect(names).toEqual([
      "capture_thought",
      "complete_plan_item",
      "create_task",
      "get_flight_plan",
      "list_projects",
      "move_task",
      "search_workspace",
    ]);
  });

  it("gives every tool a description and an object schema, which is what the agent reasons from", () => {
    for (const tool of buildAgentTools(context())) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect((tool.inputSchema as { type: string }).type).toBe("object");
    }
  });

  it("create_task calls the domain function with the context's workspace and user", async () => {
    const ctx = context();
    const create = buildAgentTools(ctx).find((tool) => tool.name === "create_task")!;

    const result = await create.execute({ projectId: "p1", title: "Ship it" });

    expect(createWorkItem).toHaveBeenCalledWith(ctx.client, {
      workspaceId: "ws-1",
      projectId: "p1",
      userId: "user-1",
      title: "Ship it",
      description: undefined,
      dueDate: undefined,
    });
    expect(result.content[0].text).toContain("Ship it");
  });

  it("mutating tools invalidate the caches the UI reads, which is what makes the agent's work appear live", async () => {
    const ctx = context();
    const invalidate = vi.spyOn(ctx.queryClient, "invalidateQueries");
    const move = buildAgentTools(ctx).find((tool) => tool.name === "move_task")!;

    await move.execute({ id: "w1", projectId: "p1", status: "done" });

    expect(updateWorkItemStatus).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["work-items"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["workspace-work-items"] });
  });

  it("move_task refuses a status outside the enum instead of passing it through", async () => {
    const move = buildAgentTools(context()).find((tool) => tool.name === "move_task")!;

    const result = await move.execute({ id: "w1", projectId: "p1", status: "obliterated" });

    expect(updateWorkItemStatus).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("backlog");
  });

  it("a throwing domain function becomes a text result, never an unhandled rejection", async () => {
    vi.mocked(completeDailyPlanItem).mockRejectedValueOnce(new Error("row-level security policy violation"));
    const complete = buildAgentTools(context()).find((tool) => tool.name === "complete_plan_item")!;

    const result = await complete.execute({ id: "d1" });

    expect(result.content[0].text).toContain("row-level security");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 agent-tools`
Expected: FAIL, "Failed to resolve import ./agent-tools".

- [ ] **Step 3: Implement**

Create `src/features/agent/agent-tools.ts`:

```ts
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
        return text(JSON.stringify(data));
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
        const item = await createWorkItem(client, {
          workspaceId,
          projectId: String(input.projectId),
          userId,
          title: String(input.title),
          description: input.description ? String(input.description) : undefined,
          dueDate: input.dueDate ? String(input.dueDate) : undefined,
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
        const capture = await createCapture(client, {
          workspaceId,
          userId,
          type,
          title: String(input.title),
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
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- --maxWorkers=2 agent-tools`
Expected: PASS, 6 tests.

If `listProjects` or `getDailyMissionControlData` return shapes differ from what the mock assumes (e.g. no `.name` on projects), fix the **implementation's field picks** to match the real types — the compiler will tell you — and adjust the mock to the real shape. Do not loosen an assertion to dodge a type error.

- [ ] **Step 5: Build and commit**

```bash
npm run build
git add src/features/agent/agent-tools.ts src/features/agent/agent-tools.test.ts
git commit -m "feat: define the seven agent tools"
```

---

## Task 2: Registration and the mount

**Files:**
- Create: `src/features/agent/use-agent-tools.ts`, `src/features/agent/use-agent-tools.test.tsx`
- Modify: `src/components/app-shell.tsx`, `package.json`

**Interfaces:**
- Consumes: `buildAgentTools`, `AgentTool` from `./agent-tools`.
- Produces: `export function useAgentTools(): void`.

### Background you need

- `useWorkspaceId()` from `src/features/workspaces/workspace-context.tsx` **throws outside its provider**. `app-shell.tsx` already calls it at line ~50, so the hook mounts safely inside `AppShell`.
- `useAuth()` from `src/features/auth/use-auth.ts` provides `user` (nullable).
- The singletons: `supabase` from `src/lib/supabase/client.ts`, `queryClient` from `src/lib/query-client.ts`.
- The WebMCP surface (from the webmachinelearning explainer, verified 2026-08-30): `document.modelContext.registerTool(def, { signal })` — the `signal` aborts registration, which is the cleanup mechanism. **A live Chrome 148 without the flag has no `modelContext` at all**, so feature detection is the primary path, not an edge case.

- [ ] **Step 1: Install the types**

```bash
npm install --save-dev webmcp-types
```

Then check what it actually declares (`node_modules/webmcp-types/`). If it types `document.modelContext` compatibly, use it. If it does not (wrong global, wrong shape, or requires configuration that fights the build), **do not fight it**: uninstall it and create `src/types/webmcp.d.ts`:

```ts
interface ModelContextToolResult {
  content: Array<{ type: "text"; text: string }>;
}

interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<ModelContextToolResult>;
}

interface ModelContext {
  registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal }): Promise<void> | void;
}

interface Document {
  modelContext?: ModelContext;
}
```

Report which branch you took.

- [ ] **Step 2: Write the failing tests**

Create `src/features/agent/use-agent-tools.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../lib/query-client";
import { WorkspaceContext } from "../workspaces/workspace-context";
import { useAgentTools } from "./use-agent-tools";

vi.mock("../auth/use-auth", () => ({
  useAuth: () => ({ isLoading: false, user: { id: "user-1" } }),
}));

function Probe() {
  useAgentTools();
  return null;
}

function mount(workspaceId: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={workspaceId}>
        <Probe />
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
}

type Registered = { name: string; signal: AbortSignal | undefined };

function installFakeModelContext() {
  const registered: Registered[] = [];
  (document as { modelContext?: unknown }).modelContext = {
    registerTool: (tool: { name: string }, options?: { signal?: AbortSignal }) => {
      registered.push({ name: tool.name, signal: options?.signal });
    },
  };
  return registered;
}

afterEach(() => {
  delete (document as { modelContext?: unknown }).modelContext;
  vi.restoreAllMocks();
});

describe("useAgentTools", () => {
  it("registers nothing and throws nothing when the API is absent", () => {
    // This is the path every current browser without the flag takes, and the
    // path jsdom takes - the primary path, not an edge case.
    expect(() => {
      const view = mount("ws-1");
      view.unmount();
    }).not.toThrow();
  });

  it("registers all seven tools when the API exists", () => {
    const registered = installFakeModelContext();

    mount("ws-1");

    expect(registered.map((r) => r.name).sort()).toEqual([
      "capture_thought",
      "complete_plan_item",
      "create_task",
      "get_flight_plan",
      "list_projects",
      "move_task",
      "search_workspace",
    ]);
  });

  it("aborts its registrations on unmount, so a signed-out page offers no tools", () => {
    const registered = installFakeModelContext();

    const view = mount("ws-1");
    expect(registered[0].signal?.aborted).toBe(false);

    view.unmount();
    expect(registered.every((r) => r.signal?.aborted)).toBe(true);
  });

  it("re-registers when the workspace changes, so tools always act on the workspace on screen", () => {
    const registered = installFakeModelContext();

    const view = mount("ws-1");
    const firstBatch = [...registered];

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <WorkspaceContext.Provider value="ws-2">
          <Probe />
        </WorkspaceContext.Provider>
      </QueryClientProvider>,
    );

    expect(firstBatch.every((r) => r.signal?.aborted)).toBe(true);
    expect(registered.length).toBe(14);
  });
});
```

**If `WorkspaceContext` is not exported** from `workspace-context.tsx` (only the provider component and hook are), export the context itself as well — that is a one-line addition and does not change behaviour. Report it if you do.

- [ ] **Step 3: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 use-agent-tools`
Expected: FAIL, "Failed to resolve import ./use-agent-tools".

- [ ] **Step 4: Implement the hook**

Create `src/features/agent/use-agent-tools.ts`:

```ts
/**
 * Registers Orbit Flo's agent tools with the browser's WebMCP surface.
 *
 * document.modelContext exists only in agent-hosting browsers (Chrome with
 * WebMCP enabled, ChatGPT's in-app browser). Everywhere else - including
 * every test - this hook does nothing, which is why no call site needs to
 * care whether the API is present.
 *
 * Registration is scoped by an AbortController: unmounting (sign-out, shell
 * teardown) or a workspace switch aborts every registration and, on switch,
 * re-registers against the new workspace. Tools therefore always act on the
 * workspace the user is looking at.
 */
import { useEffect } from "react";
import { queryClient } from "../../lib/query-client";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/use-auth";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { buildAgentTools } from "./agent-tools";

export function useAgentTools(): void {
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext || !userId) return;

    const controller = new AbortController();
    for (const tool of buildAgentTools({ client: supabase, queryClient, workspaceId, userId })) {
      modelContext.registerTool(tool, { signal: controller.signal });
    }

    return () => controller.abort();
  }, [workspaceId, userId]);
}
```

- [ ] **Step 5: Mount it in the shell**

In `src/components/app-shell.tsx`, add the import and call the hook next to the existing `useWorkspaceId()` call (~line 50):

```tsx
import { useAgentTools } from "../features/agent/use-agent-tools";
```

```tsx
  useAgentTools();
```

Nothing else in the file changes.

- [ ] **Step 6: Run the tests**

Run: `npm test -- --maxWorkers=2 use-agent-tools agent-tools`
Expected: PASS — 4 + 6 tests.

- [ ] **Step 7: Run the suite and build**

```bash
npm test -- --maxWorkers=2
npm run build
```

Expected: **810 + 10 passing**, no existing test modified, clean build. Watch `app-shell.test.tsx` specifically — the hook must not break shell tests; if it does, the feature-detect path is wrong, not the test.

- [ ] **Step 8: Commit**

```bash
git add src/features/agent/ src/components/app-shell.tsx package.json package-lock.json
git commit -m "feat: register agent tools through WebMCP when the browser offers it"
```

Add `src/types/webmcp.d.ts` and `src/features/workspaces/workspace-context.tsx` to the `git add` if Steps 1–2 created or touched them.

---

## Self-review notes

**Spec coverage.** Seven tools with verified wrapped signatures → Task 1. Feature detection, AbortController lifecycle, workspace re-registration, the shell mount, and the types package → Task 2. The seeded demo account, public repo, deploy rehearsal and video are **deliberately not plan tasks** — they are day-2/3/4 work the controller drives directly, not code an implementer can write.

**Why the fake `modelContext` is honest where a fake WebGL was not.** The registry is pure JS surface, and the thing under test is our wiring — names, schemas, signal lifecycle, that `execute` reaches the domain function. A fake canvas proves only that the mock works because the value is in the GPU; a fake registry *is* the contract.

**The one test that guards the submission's story:** "exposes exactly the seven approved tools, and none of the dangerous ones." `toEqual` on the sorted full list means adding an eighth tool — or leaking `deleteWorkspace` — fails the build.

**Two stop-rather-than-guess points.** If `webmcp-types` doesn't fit, fall back to the local declaration and say so. If `WorkspaceContext` isn't exported, export it and say so.
