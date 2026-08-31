# Command Palette Inbox Triage Relevance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyboard-first command palette, simplify Inbox into a processing queue, and hide low-relevance work behind a Later section without database changes.

**Architecture:** Reuse current Supabase tables and query modules. Extract global quick-add parsing into a shared helper, add an authenticated shell command palette that writes captures, refactor Inbox UI state around a selected capture, and add a pure work-item relevance utility consumed by dashboard work lists.

**Tech Stack:** React, TypeScript, Vite, React Router, TanStack Query, Supabase client, Vitest, Testing Library, lucide-react, existing OrbitFlo CSS utilities.

---

## File Structure

- Create `src/lib/quick-add.ts`: shared parser for quick capture strings.
- Create `src/lib/quick-add.test.ts`: unit tests for parser behavior.
- Modify `src/components/global-quick-add.tsx`: import shared parser instead of owning parser logic.
- Create `src/components/command-palette.tsx`: global modal palette, route commands, quick capture command, keyboard handling.
- Create `src/components/command-palette.test.tsx`: palette behavior tests.
- Modify `src/components/app-shell.tsx`: render command palette in authenticated shell and keep route prefetch patterns.
- Modify `src/app/App.test.tsx`: mock command palette or assert shell trigger exists.
- Modify `src/features/inbox/inbox-page.tsx`: queue-oriented selected capture UI and richer task metadata fields.
- Modify `src/features/inbox/inbox-page.test.tsx`: task metadata, archive, and note conversion tests.
- Create `src/features/work-items/work-item-relevance.ts`: pure helper for relevant vs later work.
- Create `src/features/work-items/work-item-relevance.test.ts`: relevance grouping tests.
- Modify `src/features/dashboard/dashboard-page.tsx`: use relevance helper in `WorkList` and collapse later work.
- Add or update dashboard component tests only if existing query tests do not cover the UI behavior.

---

### Task 1: Shared Quick-Add Parser

**Files:**
- Create: `src/lib/quick-add.ts`
- Create: `src/lib/quick-add.test.ts`
- Modify: `src/components/global-quick-add.tsx`

- [ ] **Step 1: Write parser tests**

Create `src/lib/quick-add.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quick-add";

describe("parseQuickAdd", () => {
  it("uses explicit capture prefixes", () => {
    expect(parseQuickAdd("idea: Better onboarding prompts")).toEqual({
      type: "idea",
      title: "Better onboarding prompts",
      body: "Captured from global quick add.",
    });
  });

  it("extracts due and priority hints into the body", () => {
    expect(parseQuickAdd("task: Fix auth callback tomorrow high")).toEqual({
      type: "task",
      title: "Fix auth callback",
      body: "Parsed metadata: due tomorrow, priority high.",
    });
  });

  it("defaults blocked language to blocker captures", () => {
    expect(parseQuickAdd("OAuth is blocked by provider setup")).toEqual({
      type: "blocker",
      title: "OAuth is by provider setup",
      body: "Captured from global quick add.",
    });
  });

  it("falls back to the trimmed value when metadata removes the title", () => {
    expect(parseQuickAdd("today high")).toEqual({
      type: "task",
      title: "today high",
      body: "Parsed metadata: due today, priority high.",
    });
  });
});
```

- [ ] **Step 2: Run parser tests and verify they fail**

Run: `npm.cmd test -- src/lib/quick-add.test.ts`

Expected: FAIL because `src/lib/quick-add.ts` does not exist.

- [ ] **Step 3: Implement shared parser**

Create `src/lib/quick-add.ts`:

```ts
import type { CaptureType } from "./supabase/database.types";

const capturePrefixes: Array<{ prefix: string; type: CaptureType }> = [
  { prefix: "idea:", type: "idea" },
  { prefix: "note:", type: "note" },
  { prefix: "blocker:", type: "blocker" },
  { prefix: "task:", type: "task" },
];

export type ParsedQuickAdd = {
  type: CaptureType;
  title: string;
  body: string;
};

export function parseQuickAdd(value: string): ParsedQuickAdd {
  const trimmed = value.trim();
  const lowerValue = trimmed.toLowerCase();
  const matchedPrefix = capturePrefixes.find((entry) => lowerValue.startsWith(entry.prefix));
  const type = matchedPrefix?.type ?? (lowerValue.includes("blocked") ? "blocker" : "task");
  const withoutPrefix = matchedPrefix ? trimmed.slice(matchedPrefix.prefix.length).trim() : trimmed;
  const metadata: string[] = [];
  let title = withoutPrefix;

  for (const token of ["today", "tomorrow"]) {
    const pattern = new RegExp(`\\b${token}\\b`, "i");
    if (pattern.test(title)) {
      metadata.push(`due ${token}`);
      title = title.replace(pattern, "").replace(/\s+/g, " ").trim();
    }
  }

  for (const priority of ["critical", "high", "medium", "low"]) {
    const pattern = new RegExp(`\\b${priority}\\b`, "i");
    if (pattern.test(title)) {
      metadata.push(`priority ${priority}`);
      title = title.replace(pattern, "").replace(/\s+/g, " ").trim();
      break;
    }
  }

  return {
    type,
    title: title || trimmed,
    body: metadata.length > 0 ? `Parsed metadata: ${metadata.join(", ")}.` : "Captured from global quick add.",
  };
}
```

- [ ] **Step 4: Wire GlobalQuickAdd to the helper**

Modify `src/components/global-quick-add.tsx`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createCapture } from "../features/daily/daily-plan.queries";
import { parseQuickAdd } from "../lib/quick-add";
import { supabase } from "../lib/supabase/client";
import { getStoredWorkspaceId } from "../lib/supabase/workspace";
import { useAuth } from "../features/auth/use-auth";
```

Delete the local `capturePrefixes` constant and local `parseQuickAdd` function. Leave the existing mutation code calling `parseQuickAdd(value)`.

- [ ] **Step 5: Verify parser and existing quick add behavior**

Run: `npm.cmd test -- src/lib/quick-add.test.ts src/app/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git -c safe.directory=C:/src/Personal/ToDo/.worktrees/project-command-center add -- src/lib/quick-add.ts src/lib/quick-add.test.ts src/components/global-quick-add.tsx
git -c safe.directory=C:/src/Personal/ToDo/.worktrees/project-command-center commit -m "Extract quick add parser"
```

---

### Task 2: Command Palette

**Files:**
- Create: `src/components/command-palette.tsx`
- Create: `src/components/command-palette.test.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: Write command palette tests**

Create `src/components/command-palette.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./command-palette";

const captureMocks = vi.hoisted(() => ({
  createCapture: vi.fn(),
}));

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../features/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("../features/daily/daily-plan.queries", () => ({
  createCapture: captureMocks.createCapture,
}));

vi.mock("../lib/supabase/client", () => ({
  supabase: {},
}));

vi.mock("../lib/supabase/workspace", () => ({
  getStoredWorkspaceId: () => "workspace-1",
}));

function renderPalette() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captureMocks.createCapture.mockResolvedValue({});
  });

  it("opens with the keyboard shortcut and navigates to a route command", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeTruthy();

    await user.type(screen.getByLabelText("Search commands"), "inbox");
    await user.click(screen.getByRole("button", { name: "Open Inbox" }));

    expect(navigateMock).toHaveBeenCalledWith("/inbox");
  });

  it("creates a quick capture from palette text", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.click(screen.getByRole("button", { name: "Open command palette" }));
    await user.type(screen.getByLabelText("Search commands"), "idea: Simplify project cards");
    await user.click(screen.getByRole("button", { name: "Capture idea: Simplify project cards" }));

    await waitFor(() => {
      expect(captureMocks.createCapture).toHaveBeenCalledWith(
        {},
        {
          workspaceId: "workspace-1",
          userId: "user-1",
          type: "idea",
          title: "Simplify project cards",
          body: "Captured from global quick add.",
        },
      );
    });
  });
});
```

- [ ] **Step 2: Run palette tests and verify they fail**

Run: `npm.cmd test -- src/components/command-palette.test.tsx`

Expected: FAIL because `CommandPalette` does not exist.

- [ ] **Step 3: Implement `CommandPalette`**

Create `src/components/command-palette.tsx`:

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Command, CornerDownLeft, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCapture } from "../features/daily/daily-plan.queries";
import { parseQuickAdd } from "../lib/quick-add";
import { supabase } from "../lib/supabase/client";
import { getStoredWorkspaceId } from "../lib/supabase/workspace";
import { useAuth } from "../features/auth/use-auth";

const routeCommands = [
  { label: "Mission Control", description: "Open today's command center", to: "/" },
  { label: "Missions", description: "Open project workspace list", to: "/projects" },
  { label: "Maps", description: "Open visual planning maps", to: "/maps" },
  { label: "Calendar", description: "Open due dates and deadlines", to: "/calendar" },
  { label: "Inbox", description: "Process captured signals", to: "/inbox" },
  { label: "Brainstorm", description: "Open notes and ideas", to: "/notes" },
  { label: "Settings", description: "Tune OrbitFlo preferences", to: "/settings" },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function CommandPalette() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const workspaceId = getStoredWorkspaceId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredRouteCommands = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return routeCommands;

    return routeCommands.filter((command) =>
      `${command.label} ${command.description}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  const parsedCapture = query.trim() ? parseQuickAdd(query) : null;

  const captureMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !user || !parsedCapture) {
        throw new Error("Workspace, user, and command text are required to capture from the palette.");
      }

      return createCapture(supabase, {
        workspaceId,
        userId: user.id,
        type: parsedCapture.type,
        title: parsedCapture.title,
        body: parsedCapture.body,
      });
    },
    onSuccess: async () => {
      setSuccessMessage("Captured.");
      setQuery("");
      await queryClient.invalidateQueries({ queryKey: ["inbox-captures", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["daily-mission-control"] });
    },
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;

      event.preventDefault();
      setIsOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  function closePalette() {
    setIsOpen(false);
    setQuery("");
    setSuccessMessage("");
  }

  function openRoute(to: string) {
    navigate(to);
    closePalette();
  }

  return (
    <>
      <button className="orbit-button-secondary mt-3 w-full justify-center" onClick={() => setIsOpen(true)} type="button">
        <Command aria-hidden="true" className="h-4 w-4" />
        Commands
        <span className="ml-auto text-[0.65rem] text-slate-500">Ctrl K</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-start bg-slate-950/70 px-4 py-20 backdrop-blur-sm sm:place-items-center sm:py-4">
          <div
            aria-label="Command palette"
            aria-modal="true"
            className="orbit-panel w-full max-w-2xl overflow-hidden rounded-lg"
            role="dialog"
          >
            <div className="flex items-center gap-3 border-b border-slate-400/15 px-4 py-3">
              <Search aria-hidden="true" className="h-4 w-4 text-cyan-200" />
              <label className="sr-only" htmlFor="command-palette-input">
                Search commands
              </label>
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
                id="command-palette-input"
                onChange={(event) => {
                  setSuccessMessage("");
                  setQuery(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closePalette();
                }}
                placeholder="Jump, search, or capture..."
                ref={inputRef}
                value={query}
              />
              <button aria-label="Close command palette" className="orbit-button-secondary h-8 w-8 p-0" onClick={closePalette} type="button">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="grid max-h-[60vh] gap-4 overflow-y-auto p-3">
              {query.trim() ? (
                <button
                  className="flex items-start justify-between gap-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-left hover:bg-cyan-300/15"
                  disabled={captureMutation.isPending}
                  onClick={() => captureMutation.mutate()}
                  type="button"
                >
                  <span>
                    <span className="block text-sm font-semibold text-white">Capture {query.trim()}</span>
                    <span className="mt-1 block text-xs text-slate-400">Send to Inbox as {parsedCapture?.type ?? "task"}</span>
                  </span>
                  <CornerDownLeft aria-hidden="true" className="mt-0.5 h-4 w-4 text-cyan-100" />
                </button>
              ) : null}

              <div>
                <p className="px-2 text-xs font-bold uppercase text-slate-500">Navigate</p>
                <div className="mt-2 grid gap-1">
                  {filteredRouteCommands.map((command) => (
                    <button
                      className="rounded-md px-3 py-2 text-left hover:bg-white/5"
                      key={command.to}
                      onClick={() => openRoute(command.to)}
                      type="button"
                    >
                      <span className="block text-sm font-semibold text-white">Open {command.label}</span>
                      <span className="mt-1 block text-xs text-slate-400">{command.description}</span>
                    </button>
                  ))}
                  {filteredRouteCommands.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-slate-400">No navigation commands match.</p>
                  ) : null}
                </div>
              </div>

              {successMessage ? <p className="px-2 text-sm font-semibold text-emerald-200">{successMessage}</p> : null}
              {captureMutation.isError ? (
                <p className="px-2 text-sm font-semibold text-rose-200">{captureMutation.error.message}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Wire palette into shell**

Modify `src/components/app-shell.tsx`:

```tsx
import { CommandPalette } from "./command-palette";
```

Render it after `<GlobalQuickAdd />`:

```tsx
<GlobalQuickAdd />
<CommandPalette />
```

- [ ] **Step 5: Update App shell tests**

Modify `src/app/App.test.tsx` to mock the palette:

```tsx
vi.mock("../components/command-palette", () => ({
  CommandPalette: () => <div>Command palette</div>,
}));
```

Add assertion in the authenticated shell test:

```tsx
expect(screen.getByText("Command palette")).toBeTruthy();
```

- [ ] **Step 6: Verify command palette**

Run: `npm.cmd test -- src/components/command-palette.test.tsx src/app/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git -c safe.directory=C:/src/Personal/ToDo/.worktrees/project-command-center add -- src/components/command-palette.tsx src/components/command-palette.test.tsx src/components/app-shell.tsx src/app/App.test.tsx
git -c safe.directory=C:/src/Personal/ToDo/.worktrees/project-command-center commit -m "Add command palette"
```

---

### Task 3: Inbox Triage Queue

**Files:**
- Modify: `src/features/inbox/inbox-page.tsx`
- Modify: `src/features/inbox/inbox-page.test.tsx`

- [ ] **Step 1: Expand Inbox tests**

Add these tests to `src/features/inbox/inbox-page.test.tsx`:

```tsx
it("converts a capture into a task with triage metadata", async () => {
  const user = userEvent.setup();

  renderInboxPage();

  await user.selectOptions(await screen.findByLabelText("Task project"), "project-1");
  await user.selectOptions(screen.getByLabelText("Task priority"), "high");
  await user.selectOptions(screen.getByLabelText("Task status"), "ready");
  await user.type(screen.getByLabelText("Task due date"), "2026-07-10");
  await user.click(screen.getByRole("button", { name: "Create task from Inbox task" }));

  expect(workItemMocks.createWorkItem).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      title: "Inbox task",
      description: "Turn this into work.",
      priority: "high",
      status: "ready",
      dueDate: "2026-07-10",
    }),
  );
});

it("creates a note from the selected capture", async () => {
  const user = userEvent.setup();

  renderInboxPage();

  await user.click(await screen.findByRole("button", { name: "Show note options for Inbox task" }));
  await user.selectOptions(screen.getByLabelText("Note project"), "project-1");
  await user.click(screen.getByRole("button", { name: "Create note from Inbox task" }));

  expect(noteMocks.createNote).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      noteType: "reference",
      title: "Inbox task",
      body: "Turn this into work.",
      tags: ["inbox"],
    }),
  );
});

it("archives the selected capture", async () => {
  const user = userEvent.setup();

  renderInboxPage();

  await user.click(await screen.findByRole("button", { name: "Archive Inbox task" }));

  expect(inboxMocks.updateCapture).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      id: "capture-1",
      workspaceId: "workspace-1",
      processedAt: expect.any(String),
    }),
  );
});
```

Update the existing task conversion test to use `Task project` instead of `Project for Inbox task`.

- [ ] **Step 2: Run Inbox tests and verify they fail**

Run: `npm.cmd test -- src/features/inbox/inbox-page.test.tsx`

Expected: FAIL because the new triage labels and metadata inputs do not exist.

- [ ] **Step 3: Add Inbox triage state**

In `src/features/inbox/inbox-page.tsx`, add imports:

```tsx
import type { ProjectPriority, WorkItemStatus } from "../../lib/supabase/database.types";
```

Add constants near `captureLabel`:

```tsx
const taskPriorities: ProjectPriority[] = ["low", "medium", "high", "critical"];
const taskStatuses: WorkItemStatus[] = ["backlog", "ready", "in_progress", "blocked", "review"];
```

Add state in `InboxPage`:

```tsx
const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
const [taskPriority, setTaskPriority] = useState<ProjectPriority>("medium");
const [taskStatus, setTaskStatus] = useState<WorkItemStatus>("backlog");
const [taskDueDate, setTaskDueDate] = useState("");
const [noteProjectId, setNoteProjectId] = useState("");
const [activeMode, setActiveMode] = useState<"task" | "note">("task");
```

After `const captures = inboxQuery.data ?? [];`, add:

```tsx
const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? captures[0] ?? null;
const selectedProjectId = selectedCapture ? projectByCaptureId[selectedCapture.id] ?? selectedCapture.project_id ?? "" : "";
```

- [ ] **Step 4: Use triage metadata in mutations**

In the task mutation, replace the createWorkItem call with:

```tsx
await createWorkItem(supabase, {
  workspaceId,
  projectId,
  userId: user.id,
  title: capture.title,
  description: capture.body ?? "",
  priority: taskPriority,
  status: taskStatus,
  dueDate: taskDueDate || undefined,
});
```

In the note mutation, replace project selection with:

```tsx
const projectId = noteProjectId || projectByCaptureId[capture.id] || capture.project_id || undefined;
```

In all mutation `onSuccess` handlers, keep existing query invalidation and add:

```tsx
setTaskPriority("medium");
setTaskStatus("backlog");
setTaskDueDate("");
setNoteProjectId("");
```

- [ ] **Step 5: Replace heavy card list with queue UI**

Replace the current `captures.length > 0` render block with a two-column queue:

```tsx
{!inboxQuery.isPending && !projectsQuery.isPending && captures.length > 0 && selectedCapture ? (
  <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.7fr)_minmax(0,1.3fr)]">
    <ul className="orbit-panel-soft divide-y divide-slate-400/10 overflow-hidden rounded-lg">
      {captures.map((capture) => (
        <li key={capture.id}>
          <button
            className={`w-full px-4 py-3 text-left transition ${
              selectedCapture.id === capture.id ? "bg-cyan-300/10" : "hover:bg-white/5"
            }`}
            onClick={() => setSelectedCaptureId(capture.id)}
            type="button"
          >
            <span className="block break-words text-sm font-semibold text-white">{capture.title}</span>
            <span className="mt-1 block text-xs capitalize text-slate-400">{captureLabel(capture.type)}</span>
          </button>
        </li>
      ))}
    </ul>

    <section className="orbit-panel rounded-lg p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
              <Inbox size={16} aria-hidden="true" />
            </span>
            <h2 className="break-words text-lg font-black text-white">{selectedCapture.title}</h2>
            <StatusPill>{captureLabel(selectedCapture.type)}</StatusPill>
          </div>
          {selectedCapture.body ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{selectedCapture.body}</p>
          ) : null}
        </div>
        <button
          aria-label={`Archive ${selectedCapture.title}`}
          className="orbit-button-secondary"
          disabled={isMutating}
          onClick={() => {
            setSuccessMessage("");
            markProcessedMutation.mutate(selectedCapture);
          }}
          type="button"
        >
          <Archive size={15} aria-hidden="true" />
          Archive
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className={activeMode === "task" ? "orbit-button" : "orbit-button-secondary"}
          onClick={() => setActiveMode("task")}
          type="button"
        >
          <ListPlus size={15} aria-hidden="true" />
          Task
        </button>
        <button
          aria-label={`Show note options for ${selectedCapture.title}`}
          className={activeMode === "note" ? "orbit-button" : "orbit-button-secondary"}
          onClick={() => setActiveMode("note")}
          type="button"
        >
          <FileText size={15} aria-hidden="true" />
          Note
        </button>
      </div>

      {activeMode === "task" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Task project</span>
            <select
              className="orbit-input"
              onChange={(event) =>
                setProjectByCaptureId((current) => ({
                  ...current,
                  [selectedCapture.id]: event.target.value,
                }))
              }
              value={selectedProjectId}
            >
              <option value="">Choose project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Task priority</span>
            <select className="orbit-input capitalize" onChange={(event) => setTaskPriority(event.target.value as ProjectPriority)} value={taskPriority}>
              {taskPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Task status</span>
            <select className="orbit-input capitalize" onChange={(event) => setTaskStatus(event.target.value as WorkItemStatus)} value={taskStatus}>
              {taskStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Task due date</span>
            <input className="orbit-input" onChange={(event) => setTaskDueDate(event.target.value)} type="date" value={taskDueDate} />
          </label>
          <button
            aria-label={`Create task from ${selectedCapture.title}`}
            className="orbit-button sm:col-span-2"
            disabled={isMutating}
            onClick={() => {
              setSuccessMessage("");
              createTaskMutation.mutate(selectedCapture);
            }}
            type="button"
          >
            <ListPlus size={15} aria-hidden="true" />
            Create task
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-200">Note project</span>
            <select className="orbit-input" onChange={(event) => setNoteProjectId(event.target.value)} value={noteProjectId}>
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label={`Create note from ${selectedCapture.title}`}
            className="orbit-button"
            disabled={isMutating}
            onClick={() => {
              setSuccessMessage("");
              createNoteMutation.mutate(selectedCapture);
            }}
            type="button"
          >
            <FileText size={15} aria-hidden="true" />
            Create note
          </button>
        </div>
      )}
    </section>
  </div>
) : null}
```

- [ ] **Step 6: Verify Inbox tests**

Run: `npm.cmd test -- src/features/inbox/inbox-page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git -c safe.directory=C:/src/Personal/ToDo/.worktrees/project-command-center add -- src/features/inbox/inbox-page.tsx src/features/inbox/inbox-page.test.tsx
git -c safe.directory=C:/src/Personal/ToDo/.worktrees/project-command-center commit -m "Refine inbox triage flow"
```

---

### Task 4: Work Item Relevance

**Files:**
- Create: `src/features/work-items/work-item-relevance.ts`
- Create: `src/features/work-items/work-item-relevance.test.ts`
- Modify: `src/features/dashboard/dashboard-page.tsx`

- [ ] **Step 1: Write relevance tests**

Create `src/features/work-items/work-item-relevance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import { groupWorkItemsByRelevance, isRelevantWorkItem } from "./work-item-relevance";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "work-item-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    milestone_id: null,
    title: "Work item",
    description: null,
    status: "backlog",
    priority: "medium",
    due_date: null,
    estimate_points: null,
    sort_order: 0,
    blocked_reason: null,
    created_by: "user-1",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

describe("isRelevantWorkItem", () => {
  it("treats urgent due dates and active statuses as relevant", () => {
    expect(isRelevantWorkItem(workItem({ due_date: "2026-07-01" }), "2026-07-02")).toBe(true);
    expect(isRelevantWorkItem(workItem({ due_date: "2026-07-02" }), "2026-07-02")).toBe(true);
    expect(isRelevantWorkItem(workItem({ due_date: "2026-07-08" }), "2026-07-02")).toBe(true);
    expect(isRelevantWorkItem(workItem({ status: "in_progress" }), "2026-07-02")).toBe(true);
    expect(isRelevantWorkItem(workItem({ status: "review" }), "2026-07-02")).toBe(true);
    expect(isRelevantWorkItem(workItem({ status: "blocked" }), "2026-07-02")).toBe(true);
  });

  it("treats high priority and blocked reasons as relevant", () => {
    expect(isRelevantWorkItem(workItem({ priority: "critical" }), "2026-07-02")).toBe(true);
    expect(isRelevantWorkItem(workItem({ priority: "high" }), "2026-07-02")).toBe(true);
    expect(isRelevantWorkItem(workItem({ blocked_reason: "Waiting on OAuth app" }), "2026-07-02")).toBe(true);
  });

  it("puts done, distant, and unscheduled lower-priority backlog work later", () => {
    expect(isRelevantWorkItem(workItem({ status: "done", priority: "critical" }), "2026-07-02")).toBe(false);
    expect(isRelevantWorkItem(workItem({ due_date: "2026-07-20" }), "2026-07-02")).toBe(false);
    expect(isRelevantWorkItem(workItem({ priority: "medium", status: "backlog", due_date: null }), "2026-07-02")).toBe(false);
  });
});

describe("groupWorkItemsByRelevance", () => {
  it("splits work into relevant and later buckets", () => {
    const relevant = workItem({ id: "relevant", priority: "high" });
    const later = workItem({ id: "later", priority: "low", due_date: null });

    expect(groupWorkItemsByRelevance([later, relevant], "2026-07-02")).toEqual({
      relevant: [relevant],
      later: [later],
    });
  });
});
```

- [ ] **Step 2: Run relevance tests and verify they fail**

Run: `npm.cmd test -- src/features/work-items/work-item-relevance.test.ts`

Expected: FAIL because `work-item-relevance.ts` does not exist.

- [ ] **Step 3: Implement relevance helper**

Create `src/features/work-items/work-item-relevance.ts`:

```ts
import type { Database } from "../../lib/supabase/database.types";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function daysBetween(dateKey: string, todayKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const today = new Date(`${todayKey}T00:00:00`);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

export function isRelevantWorkItem(item: WorkItem, todayKey: string) {
  if (item.status === "done") return false;
  if (item.status === "blocked" || item.status === "in_progress" || item.status === "review") return true;
  if (item.priority === "critical" || item.priority === "high") return true;
  if (item.blocked_reason) return true;
  if (!item.due_date) return false;

  return daysBetween(item.due_date, todayKey) <= 7;
}

export function groupWorkItemsByRelevance(items: WorkItem[], todayKey: string) {
  return items.reduce(
    (grouped, item) => {
      if (isRelevantWorkItem(item, todayKey)) {
        grouped.relevant.push(item);
      } else {
        grouped.later.push(item);
      }

      return grouped;
    },
    { relevant: [] as WorkItem[], later: [] as WorkItem[] },
  );
}
```

- [ ] **Step 4: Update dashboard work list UI**

In `src/features/dashboard/dashboard-page.tsx`, import helper:

```tsx
import { groupWorkItemsByRelevance } from "../work-items/work-item-relevance";
```

Replace `WorkList` with:

```tsx
function WorkRows({ items }: { items: WorkItem[] }) {
  return (
    <ul className="divide-y divide-slate-400/10">
      {items.map((item) => (
        <li className="grid gap-2 px-4 py-3" key={item.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <Link
              className="break-words text-sm font-semibold text-white underline-offset-2 hover:text-cyan-100 hover:underline"
              to={`/projects/${item.project_id}`}
            >
              {item.title}
            </Link>
            <div className="flex shrink-0 flex-wrap gap-2">
              <StatusPill tone={priorityTone(item.priority)}>{item.priority}</StatusPill>
              <StatusPill tone={statusTone(item.status)}>{formatLabel(item.status)}</StatusPill>
            </div>
          </div>
          {item.description ? (
            <p className="line-clamp-2 break-words text-sm text-slate-400">{item.description}</p>
          ) : null}
          {item.blocked_reason ? (
            <p className="rounded-md border border-violet-300/25 bg-violet-400/10 px-3 py-2 text-xs text-violet-100">
              {item.blocked_reason}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function WorkList({ emptyMessage, items }: { emptyMessage: string; items: WorkItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="Your orbit is clear" message={emptyMessage} />;
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const grouped = groupWorkItemsByRelevance(items, todayKey);

  return (
    <div className="orbit-panel overflow-hidden rounded-lg">
      {grouped.relevant.length > 0 ? <WorkRows items={grouped.relevant} /> : null}
      {grouped.relevant.length === 0 ? (
        <div className="px-4 py-5">
          <EmptyState title="Nothing needs attention" message="Lower-priority work is tucked into Later." />
        </div>
      ) : null}
      {grouped.later.length > 0 ? (
        <details className="border-t border-slate-400/10">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-300">
            Later work ({grouped.later.length})
          </summary>
          <WorkRows items={grouped.later} />
        </details>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Verify relevance tests**

Run: `npm.cmd test -- src/features/work-items/work-item-relevance.test.ts src/features/dashboard/dashboard.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git -c safe.directory=C:/src/Personal/ToDo/.worktrees/project-command-center add -- src/features/work-items/work-item-relevance.ts src/features/work-items/work-item-relevance.test.ts src/features/dashboard/dashboard-page.tsx
git -c safe.directory=C:/src/Personal/ToDo/.worktrees/project-command-center commit -m "Group dashboard work by relevance"
```

---

### Task 5: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused suites**

Run:

```powershell
npm.cmd test -- src/lib/quick-add.test.ts src/components/command-palette.test.tsx src/features/inbox/inbox-page.test.tsx src/features/work-items/work-item-relevance.test.ts src/app/App.test.tsx
```

Expected: all listed tests PASS.

- [ ] **Step 2: Run full unit test suite**

Run: `npm.cmd test`

Expected: all test files PASS.

- [ ] **Step 3: Run production build**

Run: `npm.cmd run build`

Expected: TypeScript build and Vite production build PASS.

- [ ] **Step 4: Run browser e2e smoke test**

Run: `npm.cmd run e2e`

Expected: Chromium smoke test PASS.

- [ ] **Step 5: Inspect git status**

Run:

```powershell
git -c safe.directory=C:/src/Personal/ToDo/.worktrees/project-command-center status --short
```

Expected: only intentional feature changes are present. Existing unrelated dirty files from earlier work must not be reverted.

---

## Self-Review

- Spec coverage: command palette is covered by Task 2; Inbox triage is covered by Task 3; Smart Hide Until Relevant is covered by Task 4; no SQL changes are introduced.
- Placeholder scan: this plan contains no unresolved markers or intentionally vague implementation steps.
- Type consistency: quick-add parsing returns `CaptureType`; Inbox task metadata uses `ProjectPriority` and `WorkItemStatus`; relevance helpers consume `Database["public"]["Tables"]["work_items"]["Row"]`.
