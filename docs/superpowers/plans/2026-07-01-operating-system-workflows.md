# Operating System Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Project Briefs, Launch Checklist Mode, Meeting-to-Tasks, Daily Shutdown, Private Reflections, and Dashboard Widgets for OrbitFlo.

**Architecture:** Add first-class Supabase tables with RLS, then implement focused query modules and independently testable panels. Project-scoped workflows live in the project workspace; personal workflows live in Daily Mission Control; dashboard preferences customize the Mission Control dashboard without changing existing route structure.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query, Supabase Postgres/Auth/RLS, Vitest, Testing Library, Playwright smoke tests.

---

## File Structure

- Create `supabase/migrations/202607010002_operating_system_workflows.sql`: schema, indexes, grants, RLS policies.
- Modify `src/lib/supabase/database.types.ts`: add new table row/insert/update types.
- Create `src/features/projects/project-brief.queries.ts`: get/upsert project brief.
- Create `src/features/projects/project-brief-panel.tsx`: project brief form/view panel.
- Create `src/features/projects/project-brief-panel.test.tsx`: panel behavior tests.
- Create `src/features/daily/daily-shutdown.queries.ts`: get/upsert daily shutdown.
- Create `src/features/daily/daily-shutdown-panel.tsx`: shutdown ritual form.
- Create `src/features/daily/daily-shutdown-panel.test.tsx`: shutdown behavior tests.
- Create `src/features/daily/private-reflections.queries.ts`: list/create/update private reflections.
- Create `src/features/daily/private-reflection-panel.tsx`: private reflection capture.
- Create `src/features/daily/private-reflection-panel.test.tsx`: reflection behavior tests.
- Create `src/features/dashboard/dashboard-widgets.queries.ts`: list/upsert widget preferences.
- Create `src/features/dashboard/dashboard-widget-customizer.tsx`: widget visibility and ordering UI.
- Create `src/features/dashboard/dashboard-widget-customizer.test.tsx`: widget preference behavior tests.
- Modify `src/features/daily/daily-mission-control-page.tsx`: wire shutdown and reflection panels.
- Modify `src/features/projects/project-workspace-page.tsx`: wire project brief now and Wave 2 panels later.
- Modify `src/features/dashboard/dashboard-page.tsx`: wire widget preferences and customizer.
- Create `src/features/projects/launch-checklist.queries.ts`: list/create/update launch checklists.
- Create `src/features/projects/launch-checklist-panel.tsx`: checklist UI.
- Create `src/features/projects/launch-checklist-panel.test.tsx`: checklist behavior tests.
- Create `src/features/meetings/meeting-notes.queries.ts`: meeting notes and action item conversion.
- Create `src/features/meetings/meeting-notes-panel.tsx`: meeting capture UI.
- Create `src/features/meetings/meeting-notes-panel.test.tsx`: meeting action item tests.

---

### Task 1: Supabase Schema And Types

**Files:**
- Create: `supabase/migrations/202607010002_operating_system_workflows.sql`
- Modify: `src/lib/supabase/database.types.ts`
- Test: `npm.cmd run build`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/202607010002_operating_system_workflows.sql` using the SQL from `docs/superpowers/specs/2026-07-01-operating-system-workflows-design.md`. Use `private.is_workspace_member(workspace_id)` in every shared workflow policy.

Minimum policy pattern for shared workflow tables:

```sql
create policy "Workspace members can manage project briefs"
  on public.project_briefs for all
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));
```

Minimum policy pattern for user-private tables:

```sql
create policy "Users can manage their own private reflections"
  on public.private_reflections for all
  using (created_by = auth.uid() and private.is_workspace_member(workspace_id))
  with check (created_by = auth.uid() and private.is_workspace_member(workspace_id));
```

- [ ] **Step 2: Add database table types**

Update `src/lib/supabase/database.types.ts` with table entries matching the migration. Use this shape for each table:

```ts
project_briefs: {
  Row: {
    id: string;
    workspace_id: string;
    project_id: string;
    goal: string;
    audience: string;
    success_criteria: string;
    constraints: string;
    status_summary: string;
    next_milestone: string;
    links: Json;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    workspace_id: string;
    project_id: string;
    goal?: string;
    audience?: string;
    success_criteria?: string;
    constraints?: string;
    status_summary?: string;
    next_milestone?: string;
    links?: Json;
    created_by: string;
  };
  Update: {
    goal?: string;
    audience?: string;
    success_criteria?: string;
    constraints?: string;
    status_summary?: string;
    next_milestone?: string;
    links?: Json;
  };
  Relationships: [];
};
```

Repeat the same explicit Row/Insert/Update pattern for `launch_checklists`, `meeting_notes`, `meeting_action_items`, `daily_shutdowns`, `private_reflections`, and `dashboard_widget_preferences`.

- [ ] **Step 3: Build-check the schema types**

Run: `npm.cmd run build`

Expected: TypeScript succeeds. Vite may still warn about chunks larger than 500 kB.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202607010002_operating_system_workflows.sql src/lib/supabase/database.types.ts
git commit -m "Add operating system workflow schema"
```

---

### Task 2: Project Brief Query Module And Panel

**Files:**
- Create: `src/features/projects/project-brief.queries.ts`
- Create: `src/features/projects/project-brief-panel.tsx`
- Create: `src/features/projects/project-brief-panel.test.tsx`
- Modify: `src/features/projects/project-workspace-page.tsx`

- [ ] **Step 1: Write the failing panel test**

Create `src/features/projects/project-brief-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectBriefPanel } from "./project-brief-panel";

describe("ProjectBriefPanel", () => {
  it("edits and saves the project brief", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <ProjectBriefPanel
        brief={null}
        isSaving={false}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText("Project goal"), "Ship a calmer planning cockpit.");
    await user.type(screen.getByLabelText("Success criteria"), "Users know what to do next.");
    await user.click(screen.getByRole("button", { name: "Save project brief" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: "Ship a calmer planning cockpit.",
        successCriteria: "Users know what to do next.",
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/features/projects/project-brief-panel.test.tsx`

Expected: FAIL because `project-brief-panel` does not exist.

- [ ] **Step 3: Implement queries**

Create `src/features/projects/project-brief.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type ProjectBrief = Database["public"]["Tables"]["project_briefs"]["Row"];

export type ProjectBriefValues = {
  goal: string;
  audience: string;
  successCriteria: string;
  constraints: string;
  statusSummary: string;
  nextMilestone: string;
  links: Json;
};

export async function getProjectBrief(client: Client, workspaceId: string, projectId: string) {
  const { data, error } = await client
    .from("project_briefs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectBrief | null;
}

export async function upsertProjectBrief(
  client: Client,
  input: ProjectBriefValues & { workspaceId: string; projectId: string; userId: string },
) {
  const { data, error } = await client
    .from("project_briefs")
    .upsert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      goal: input.goal,
      audience: input.audience,
      success_criteria: input.successCriteria,
      constraints: input.constraints,
      status_summary: input.statusSummary,
      next_milestone: input.nextMilestone,
      links: input.links,
    }, { onConflict: "workspace_id,project_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as ProjectBrief;
}
```

- [ ] **Step 4: Implement the panel**

Create `src/features/projects/project-brief-panel.tsx`:

```tsx
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import type { Database, Json } from "../../lib/supabase/database.types";
import type { ProjectBriefValues } from "./project-brief.queries";

type ProjectBrief = Database["public"]["Tables"]["project_briefs"]["Row"];

const emptyValues: ProjectBriefValues = {
  goal: "",
  audience: "",
  successCriteria: "",
  constraints: "",
  statusSummary: "",
  nextMilestone: "",
  links: [],
};

export function ProjectBriefPanel({
  brief,
  isSaving,
  onSave,
}: {
  brief: ProjectBrief | null;
  isSaving: boolean;
  onSave: (values: ProjectBriefValues) => void;
}) {
  const [values, setValues] = useState<ProjectBriefValues>(emptyValues);

  useEffect(() => {
    setValues(
      brief
        ? {
            goal: brief.goal,
            audience: brief.audience,
            successCriteria: brief.success_criteria,
            constraints: brief.constraints,
            statusSummary: brief.status_summary,
            nextMilestone: brief.next_milestone,
            links: brief.links as Json,
          }
        : emptyValues,
    );
  }, [brief]);

  function updateValue(key: keyof ProjectBriefValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
          <FileText aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <p className="mission-label">Project brief</p>
          <h2 className="text-base font-black text-white">Mission dossier</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          ["goal", "Project goal"],
          ["audience", "Audience"],
          ["successCriteria", "Success criteria"],
          ["constraints", "Constraints"],
          ["statusSummary", "Status summary"],
          ["nextMilestone", "Next milestone"],
        ].map(([key, label]) => (
          <label className="grid gap-1 text-sm" key={key}>
            <span className="font-medium text-slate-200">{label}</span>
            <textarea
              className="orbit-input min-h-20 resize-y"
              onChange={(event) => updateValue(key as keyof ProjectBriefValues, event.target.value)}
              value={String(values[key as keyof ProjectBriefValues] ?? "")}
            />
          </label>
        ))}
      </div>
      <button
        className="orbit-button mt-4"
        disabled={isSaving}
        onClick={() => onSave(values)}
        type="button"
      >
        Save project brief
      </button>
    </section>
  );
}
```

- [ ] **Step 5: Wire into project workspace**

In `src/features/projects/project-workspace-page.tsx`, add a query and mutation next to the existing project queries:

```tsx
const projectBriefQuery = useQuery({
  queryKey: ["project-brief", workspaceId, projectId],
  queryFn: () => getProjectBrief(supabase, workspaceId ?? "", projectId ?? ""),
  enabled: Boolean(workspaceId && projectId && user),
});

const saveProjectBriefMutation = useMutation({
  mutationFn: (values: ProjectBriefValues) => {
    if (!workspaceId || !projectId || !user) throw new Error("Choose a workspace before saving the brief.");
    return upsertProjectBrief(supabase, { ...values, workspaceId, projectId, userId: user.id });
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["project-brief", workspaceId, projectId] });
  },
});
```

Render before the workspace tabs:

```tsx
<ProjectBriefPanel
  brief={projectBriefQuery.data ?? null}
  isSaving={saveProjectBriefMutation.isPending}
  onSave={(values) => saveProjectBriefMutation.mutate(values)}
/>
```

- [ ] **Step 6: Run tests**

Run: `npm.cmd test -- src/features/projects/project-brief-panel.test.tsx src/features/projects/project-workspace-page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/projects/project-brief.queries.ts src/features/projects/project-brief-panel.tsx src/features/projects/project-brief-panel.test.tsx src/features/projects/project-workspace-page.tsx src/features/projects/project-workspace-page.test.tsx
git commit -m "Add project brief workflow"
```

---

### Task 3: Daily Shutdown Ritual

**Files:**
- Create: `src/features/daily/daily-shutdown.queries.ts`
- Create: `src/features/daily/daily-shutdown-panel.tsx`
- Create: `src/features/daily/daily-shutdown-panel.test.tsx`
- Modify: `src/features/daily/daily-mission-control-page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/daily/daily-shutdown-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DailyShutdownPanel } from "./daily-shutdown-panel";

describe("DailyShutdownPanel", () => {
  it("saves a daily shutdown ritual", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<DailyShutdownPanel isSaving={false} shutdown={null} onSave={onSave} />);

    await user.type(screen.getByLabelText("What shipped"), "Calendar planning blocks");
    await user.type(screen.getByLabelText("Resume tomorrow"), "Wire dashboard widgets");
    await user.click(screen.getByRole("button", { name: "Save shutdown ritual" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        shipped: "Calendar planning blocks",
        resumeTomorrow: "Wire dashboard widgets",
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/features/daily/daily-shutdown-panel.test.tsx`

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement queries**

Create `src/features/daily/daily-shutdown.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type DailyShutdown = Database["public"]["Tables"]["daily_shutdowns"]["Row"];

export type DailyShutdownValues = {
  shipped: string;
  movedForward: string;
  blocked: string;
  resumeTomorrow: string;
};

export async function getDailyShutdown(client: Client, workspaceId: string, userId: string, shutdownDate: string) {
  const { data, error } = await client
    .from("daily_shutdowns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("created_by", userId)
    .eq("shutdown_date", shutdownDate)
    .maybeSingle();

  if (error) throw error;
  return data as DailyShutdown | null;
}

export async function upsertDailyShutdown(
  client: Client,
  input: DailyShutdownValues & { workspaceId: string; userId: string; shutdownDate: string; dailyPlanId?: string },
) {
  const { data, error } = await client
    .from("daily_shutdowns")
    .upsert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      shutdown_date: input.shutdownDate,
      daily_plan_id: input.dailyPlanId || null,
      shipped: input.shipped,
      moved_forward: input.movedForward,
      blocked: input.blocked,
      resume_tomorrow: input.resumeTomorrow,
    }, { onConflict: "workspace_id,created_by,shutdown_date" })
    .select("*")
    .single();

  if (error) throw error;
  return data as DailyShutdown;
}
```

- [ ] **Step 4: Implement the panel**

Create `src/features/daily/daily-shutdown-panel.tsx` with four labeled textareas and a `Save shutdown ritual` button:

```tsx
import { MoonStar } from "lucide-react";
import { useEffect, useState } from "react";
import type { Database } from "../../lib/supabase/database.types";
import type { DailyShutdownValues } from "./daily-shutdown.queries";

type DailyShutdown = Database["public"]["Tables"]["daily_shutdowns"]["Row"];

const emptyValues: DailyShutdownValues = { shipped: "", movedForward: "", blocked: "", resumeTomorrow: "" };

export function DailyShutdownPanel({
  isSaving,
  shutdown,
  onSave,
}: {
  isSaving: boolean;
  shutdown: DailyShutdown | null;
  onSave: (values: DailyShutdownValues) => void;
}) {
  const [values, setValues] = useState(emptyValues);

  useEffect(() => {
    setValues(
      shutdown
        ? {
            shipped: shutdown.shipped,
            movedForward: shutdown.moved_forward,
            blocked: shutdown.blocked,
            resumeTomorrow: shutdown.resume_tomorrow,
          }
        : emptyValues,
    );
  }, [shutdown]);

  return (
    <section className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md border border-violet-300/25 bg-violet-300/10 text-violet-100">
          <MoonStar aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <p className="mission-label">Daily shutdown</p>
          <h2 className="text-base font-black text-white">Close the loop</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["shipped", "What shipped"],
          ["movedForward", "What moved forward"],
          ["blocked", "What got blocked"],
          ["resumeTomorrow", "Resume tomorrow"],
        ].map(([key, label]) => (
          <label className="grid gap-1 text-sm" key={key}>
            <span className="font-medium text-slate-200">{label}</span>
            <textarea
              className="orbit-input min-h-20 resize-y"
              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
              value={values[key as keyof DailyShutdownValues]}
            />
          </label>
        ))}
      </div>
      <button className="orbit-button mt-4" disabled={isSaving} onClick={() => onSave(values)} type="button">
        Save shutdown ritual
      </button>
    </section>
  );
}
```

- [ ] **Step 5: Wire into Daily Mission Control**

Add a `useQuery` for `getDailyShutdown`, a mutation for `upsertDailyShutdown`, and render `<DailyShutdownPanel />` below the focus/review grid. Use `planDate` as `shutdownDate` and `missionControl.plan?.id` as `dailyPlanId`.

- [ ] **Step 6: Run tests**

Run: `npm.cmd test -- src/features/daily/daily-shutdown-panel.test.tsx src/features/daily/daily-mission-control-page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/daily/daily-shutdown.queries.ts src/features/daily/daily-shutdown-panel.tsx src/features/daily/daily-shutdown-panel.test.tsx src/features/daily/daily-mission-control-page.tsx src/features/daily/daily-mission-control-page.test.tsx
git commit -m "Add daily shutdown ritual"
```

---

### Task 4: Private Reflection Panel

**Files:**
- Create: `src/features/daily/private-reflections.queries.ts`
- Create: `src/features/daily/private-reflection-panel.tsx`
- Create: `src/features/daily/private-reflection-panel.test.tsx`
- Modify: `src/features/daily/daily-mission-control-page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/daily/private-reflection-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrivateReflectionPanel } from "./private-reflection-panel";

describe("PrivateReflectionPanel", () => {
  it("saves a private reflection", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(<PrivateReflectionPanel isSaving={false} reflections={[]} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Reflection title"), "What I learned today");
    await user.type(screen.getByLabelText("Private reflection"), "Smaller planning blocks helped.");
    await user.click(screen.getByRole("button", { name: "Save private reflection" }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "What I learned today",
        body: "Smaller planning blocks helped.",
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/features/daily/private-reflection-panel.test.tsx`

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement queries**

Create `src/features/daily/private-reflections.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type PrivateReflection = Database["public"]["Tables"]["private_reflections"]["Row"];

export type PrivateReflectionValues = {
  reflectionDate: string;
  title: string;
  body: string;
  mood: string;
  tags: string[];
};

export async function listPrivateReflections(client: Client, workspaceId: string, userId: string) {
  const { data, error } = await client
    .from("private_reflections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("created_by", userId)
    .order("reflection_date", { ascending: false })
    .limit(5);

  if (error) throw error;
  return data as PrivateReflection[];
}

export async function createPrivateReflection(
  client: Client,
  input: PrivateReflectionValues & { workspaceId: string; userId: string },
) {
  const { data, error } = await client
    .from("private_reflections")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      reflection_date: input.reflectionDate,
      title: input.title,
      body: input.body,
      mood: input.mood,
      tags: input.tags,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PrivateReflection;
}
```

- [ ] **Step 4: Implement the panel**

Create `src/features/daily/private-reflection-panel.tsx` with title, body, mood, and recent reflection list:

```tsx
import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { Database } from "../../lib/supabase/database.types";
import type { PrivateReflectionValues } from "./private-reflections.queries";

type PrivateReflection = Database["public"]["Tables"]["private_reflections"]["Row"];

export function PrivateReflectionPanel({
  isSaving,
  reflections,
  onCreate,
}: {
  isSaving: boolean;
  reflections: PrivateReflection[];
  onCreate: (values: Omit<PrivateReflectionValues, "reflectionDate" | "tags">) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState("");

  function saveReflection() {
    const nextTitle = title.trim();
    const nextBody = body.trim();
    if (!nextTitle || !nextBody) return;
    onCreate({ title: nextTitle, body: nextBody, mood });
    setTitle("");
    setBody("");
    setMood("");
  }

  return (
    <section className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
          <LockKeyhole aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <p className="mission-label">Private reflection</p>
          <h2 className="text-base font-black text-white">Personal log</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">Reflection title</span>
          <input className="orbit-input" onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">Private reflection</span>
          <textarea className="orbit-input min-h-24 resize-y" onChange={(event) => setBody(event.target.value)} value={body} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">Mood</span>
          <input className="orbit-input" onChange={(event) => setMood(event.target.value)} value={mood} />
        </label>
      </div>
      <button className="orbit-button mt-4" disabled={isSaving || !title.trim() || !body.trim()} onClick={saveReflection} type="button">
        Save private reflection
      </button>
      {reflections.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {reflections.map((reflection) => (
            <li className="rounded-md border border-slate-400/15 bg-slate-950/35 px-3 py-2" key={reflection.id}>
              <p className="text-sm font-semibold text-white">{reflection.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{reflection.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: Wire into Daily Mission Control**

Query `listPrivateReflections(supabase, workspaceId, user.id)`. Mutation calls `createPrivateReflection` with `reflectionDate: planDate` and `tags: []`. Render beside or below the Daily Shutdown panel.

- [ ] **Step 6: Run tests**

Run: `npm.cmd test -- src/features/daily/private-reflection-panel.test.tsx src/features/daily/daily-mission-control-page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/daily/private-reflections.queries.ts src/features/daily/private-reflection-panel.tsx src/features/daily/private-reflection-panel.test.tsx src/features/daily/daily-mission-control-page.tsx src/features/daily/daily-mission-control-page.test.tsx
git commit -m "Add private reflection workflow"
```

---

### Task 5: Dashboard Widget Preferences

**Files:**
- Create: `src/features/dashboard/dashboard-widgets.queries.ts`
- Create: `src/features/dashboard/dashboard-widget-customizer.tsx`
- Create: `src/features/dashboard/dashboard-widget-customizer.test.tsx`
- Modify: `src/features/dashboard/dashboard-page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/dashboard/dashboard-widget-customizer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DashboardWidgetCustomizer, defaultDashboardWidgets } from "./dashboard-widget-customizer";

describe("DashboardWidgetCustomizer", () => {
  it("toggles and reorders dashboard widgets", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DashboardWidgetCustomizer widgets={defaultDashboardWidgets} onChange={onChange} />);

    await user.click(screen.getByLabelText("Show Priority work"));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ key: "priority-work", isVisible: false })]));

    await user.click(screen.getByRole("button", { name: "Move Blocked work up" }));
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/features/dashboard/dashboard-widget-customizer.test.tsx`

Expected: FAIL because the customizer does not exist.

- [ ] **Step 3: Implement queries**

Create `src/features/dashboard/dashboard-widgets.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type WidgetPreference = Database["public"]["Tables"]["dashboard_widget_preferences"]["Row"];

export type DashboardWidgetPreferenceInput = {
  widgetKey: string;
  isVisible: boolean;
  sortOrder: number;
  settings: Json;
};

export async function listDashboardWidgetPreferences(client: Client, workspaceId: string, userId: string) {
  const { data, error } = await client
    .from("dashboard_widget_preferences")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as WidgetPreference[];
}

export async function upsertDashboardWidgetPreferences(
  client: Client,
  input: { workspaceId: string; userId: string; widgets: DashboardWidgetPreferenceInput[] },
) {
  const { data, error } = await client
    .from("dashboard_widget_preferences")
    .upsert(
      input.widgets.map((widget) => ({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        widget_key: widget.widgetKey,
        is_visible: widget.isVisible,
        sort_order: widget.sortOrder,
        settings: widget.settings,
      })),
      { onConflict: "workspace_id,user_id,widget_key" },
    )
    .select("*");

  if (error) throw error;
  return data as WidgetPreference[];
}
```

- [ ] **Step 4: Implement customizer**

Create `src/features/dashboard/dashboard-widget-customizer.tsx`:

```tsx
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";

export type DashboardWidgetConfig = {
  key: string;
  label: string;
  isVisible: boolean;
  sortOrder: number;
};

export const defaultDashboardWidgets: DashboardWidgetConfig[] = [
  { key: "project-health", label: "Project health", isVisible: true, sortOrder: 0 },
  { key: "priority-work", label: "Priority work", isVisible: true, sortOrder: 1 },
  { key: "blocked-work", label: "Blocked work", isVisible: true, sortOrder: 2 },
  { key: "upcoming-milestones", label: "Upcoming milestones", isVisible: true, sortOrder: 3 },
  { key: "recent-decisions", label: "Recent decisions", isVisible: true, sortOrder: 4 },
];

export function DashboardWidgetCustomizer({
  widgets,
  onChange,
}: {
  widgets: DashboardWidgetConfig[];
  onChange: (widgets: DashboardWidgetConfig[]) => void;
}) {
  function update(nextWidgets: DashboardWidgetConfig[]) {
    onChange(nextWidgets.map((widget, index) => ({ ...widget, sortOrder: index })));
  }

  function toggleWidget(key: string) {
    update(widgets.map((widget) => (widget.key === key ? { ...widget, isVisible: !widget.isVisible } : widget)));
  }

  function moveWidget(key: string, direction: -1 | 1) {
    const currentIndex = widgets.findIndex((widget) => widget.key === key);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= widgets.length) return;
    const nextWidgets = [...widgets];
    [nextWidgets[currentIndex], nextWidgets[nextIndex]] = [nextWidgets[nextIndex], nextWidgets[currentIndex]];
    update(nextWidgets);
  }

  return (
    <section className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-center gap-3">
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-cyan-100" />
        <h2 className="text-sm font-black text-white">Dashboard widgets</h2>
      </div>
      <div className="mt-3 grid gap-2">
        {widgets.map((widget) => (
          <div className="flex items-center justify-between gap-2 rounded-md border border-slate-400/15 bg-slate-950/35 px-3 py-2" key={widget.key}>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <input checked={widget.isVisible} onChange={() => toggleWidget(widget.key)} type="checkbox" />
              Show {widget.label}
            </label>
            <div className="flex gap-1">
              <button aria-label={`Move ${widget.label} up`} className="orbit-button-secondary grid h-8 w-8 place-items-center p-0" onClick={() => moveWidget(widget.key, -1)} type="button">
                <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
              <button aria-label={`Move ${widget.label} down`} className="orbit-button-secondary grid h-8 w-8 place-items-center p-0" onClick={() => moveWidget(widget.key, 1)} type="button">
                <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Wire into dashboard**

In `dashboard-page.tsx`, merge saved preferences with `defaultDashboardWidgets`, render `<DashboardWidgetCustomizer />`, and conditionally render existing sections by widget key.

- [ ] **Step 6: Run tests**

Run: `npm.cmd test -- src/features/dashboard/dashboard-widget-customizer.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/dashboard/dashboard-widgets.queries.ts src/features/dashboard/dashboard-widget-customizer.tsx src/features/dashboard/dashboard-widget-customizer.test.tsx src/features/dashboard/dashboard-page.tsx
git commit -m "Add dashboard widget preferences"
```

---

### Task 6: Launch Checklist Mode

**Files:**
- Create: `src/features/projects/launch-checklist.queries.ts`
- Create: `src/features/projects/launch-checklist-panel.tsx`
- Create: `src/features/projects/launch-checklist-panel.test.tsx`
- Modify: `src/features/projects/project-workspace-page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/projects/launch-checklist-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LaunchChecklistPanel, defaultLaunchChecklistItems } from "./launch-checklist-panel";

describe("LaunchChecklistPanel", () => {
  it("checks launch items and adds a custom item", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<LaunchChecklistPanel checklist={null} isSaving={false} onSave={onSave} />);

    expect(screen.getByLabelText(defaultLaunchChecklistItems[0].label)).toBeTruthy();
    await user.click(screen.getByLabelText(defaultLaunchChecklistItems[0].label));
    await user.type(screen.getByLabelText("Custom launch item"), "Notify beta users");
    await user.click(screen.getByRole("button", { name: "Add launch item" }));
    await user.click(screen.getByRole("button", { name: "Save launch checklist" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Launch checklist" }));
    expect(screen.getByText("Notify beta users")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/features/projects/launch-checklist-panel.test.tsx`

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement queries**

Create `src/features/projects/launch-checklist.queries.ts` with `listLaunchChecklists`, `createLaunchChecklist`, and `updateLaunchChecklist`. Checklist items are JSON objects with `{ id: string; label: string; isDone: boolean }`.

- [ ] **Step 4: Implement panel**

Create `src/features/projects/launch-checklist-panel.tsx` exporting:

```ts
export const defaultLaunchChecklistItems = [
  { id: "tests", label: "Tests pass", isDone: false },
  { id: "docs", label: "Documentation updated", isDone: false },
  { id: "review", label: "Review completed", isDone: false },
  { id: "deploy", label: "Deployment path confirmed", isDone: false },
  { id: "rollback", label: "Rollback plan captured", isDone: false },
  { id: "proof", label: "Screenshots or proof captured", isDone: false },
  { id: "follow-up", label: "Follow-up tasks created", isDone: false },
];
```

Render all items as checkboxes, a `Custom launch item` input, `Add launch item`, and `Save launch checklist`.

- [ ] **Step 5: Wire into project workspace**

Add a `Launch` tab or render the checklist in the existing `Timeline` tab below milestones. Query the latest checklist for the project and allow save/update.

- [ ] **Step 6: Run tests**

Run: `npm.cmd test -- src/features/projects/launch-checklist-panel.test.tsx src/features/projects/project-workspace-page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/projects/launch-checklist.queries.ts src/features/projects/launch-checklist-panel.tsx src/features/projects/launch-checklist-panel.test.tsx src/features/projects/project-workspace-page.tsx src/features/projects/project-workspace-page.test.tsx
git commit -m "Add launch checklist mode"
```

---

### Task 7: Meeting-To-Tasks Flow

**Files:**
- Create: `src/features/meetings/meeting-notes.queries.ts`
- Create: `src/features/meetings/meeting-notes-panel.tsx`
- Create: `src/features/meetings/meeting-notes-panel.test.tsx`
- Modify: `src/features/projects/project-workspace-page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/meetings/meeting-notes-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MeetingNotesPanel } from "./meeting-notes-panel";

describe("MeetingNotesPanel", () => {
  it("captures a meeting action item and converts it to a task", async () => {
    const user = userEvent.setup();
    const onSaveMeeting = vi.fn();
    const onConvertActionItem = vi.fn();

    render(
      <MeetingNotesPanel
        actionItems={[{ id: "action-1", title: "Follow up on launch risk", is_converted: false }]}
        isSaving={false}
        meetingNotes={[]}
        onConvertActionItem={onConvertActionItem}
        onSaveMeeting={onSaveMeeting}
      />,
    );

    await user.type(screen.getByLabelText("Meeting title"), "Launch sync");
    await user.type(screen.getByLabelText("Discussion"), "Reviewed launch risk.");
    await user.click(screen.getByRole("button", { name: "Save meeting note" }));
    await user.click(screen.getByRole("button", { name: "Convert Follow up on launch risk to task" }));

    expect(onSaveMeeting).toHaveBeenCalled();
    expect(onConvertActionItem).toHaveBeenCalledWith("action-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/features/meetings/meeting-notes-panel.test.tsx`

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement queries**

Create `src/features/meetings/meeting-notes.queries.ts` with:

```ts
export type MeetingNoteValues = {
  title: string;
  meetingDate: string;
  attendees: string[];
  discussion: string;
  decisions: string;
  risks: string;
  actionItems: Array<{ title: string; ownerLabel: string; dueDate: string }>;
};
```

Functions:

- `listMeetingNotes(client, workspaceId, projectId)`
- `createMeetingNote(client, input)`
- `listMeetingActionItems(client, workspaceId, projectId)`
- `convertMeetingActionItemToTask(client, input)`

`convertMeetingActionItemToTask` must insert into `work_items`, then update the action item with `work_item_id` and `is_converted: true`.

- [ ] **Step 4: Implement panel**

Create `src/features/meetings/meeting-notes-panel.tsx` with fields for title, date, attendees, discussion, decisions, risks, one action-item input row, existing meeting list, and convert buttons for unconverted action items.

- [ ] **Step 5: Wire into project workspace**

Add a `Meetings` tab to `project-workspace-page.tsx`, render `MeetingNotesPanel`, and invalidate both meeting and work item queries when an action item is converted.

- [ ] **Step 6: Run tests**

Run: `npm.cmd test -- src/features/meetings/meeting-notes-panel.test.tsx src/features/projects/project-workspace-page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/meetings src/features/projects/project-workspace-page.tsx src/features/projects/project-workspace-page.test.tsx
git commit -m "Add meeting to tasks workflow"
```

---

### Task 8: Full Verification

**Files:**
- No new files unless verification exposes fixes.

- [ ] **Step 1: Run focused workflow tests**

Run:

```bash
npm.cmd test -- src/features/projects/project-brief-panel.test.tsx src/features/daily/daily-shutdown-panel.test.tsx src/features/daily/private-reflection-panel.test.tsx src/features/dashboard/dashboard-widget-customizer.test.tsx src/features/projects/launch-checklist-panel.test.tsx src/features/meetings/meeting-notes-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full unit/component tests**

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 3: Run production build**

Run: `npm.cmd run build`

Expected: TypeScript and Vite build pass. Existing large chunk warning is acceptable.

- [ ] **Step 4: Run e2e smoke**

Run: `npm.cmd run e2e`

Expected: Playwright smoke test passes.

- [ ] **Step 5: Commit final fixes if any**

If verification required fixes:

```bash
git add src supabase tests
git commit -m "Stabilize operating system workflows"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Project Briefs: Task 2.
- Launch Checklist Mode: Task 6.
- Meeting-to-Tasks Flow: Task 7.
- Daily Shutdown Ritual: Task 3.
- Private Reflection Notes: Task 4.
- Dashboard Widgets: Task 5.
- Supabase SQL and RLS: Task 1.
- Verification: Task 8.

Placeholder scan:

- The plan contains no `TBD` or `TODO`.
- Wave 2 query details are intentionally scoped but still name exact functions, files, and behavior.

Type consistency:

- `successCriteria`, `statusSummary`, `nextMilestone`, `movedForward`, and `resumeTomorrow` are frontend camelCase values mapped to snake_case database columns inside query modules.
- `DashboardWidgetConfig.key` maps to `dashboard_widget_preferences.widget_key`.
- Meeting action conversion updates `meeting_action_items.work_item_id` and `meeting_action_items.is_converted`.
