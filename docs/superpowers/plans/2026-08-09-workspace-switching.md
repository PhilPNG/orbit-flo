# Workspace Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make workspaces first-class — URL-scoped, switchable, creatable, and renameable — starting from an app that assumes exactly one.

**Architecture:** Every authenticated route moves under `/w/:workspaceId`, served by one nested layout route rather than nine repeated shells. A `WorkspaceProvider` reads the param and replaces 11 synchronous localStorage reads. `/` becomes a resolver that redirects. A new `create_workspace` RPC supplies what `create_personal_workspace` deliberately cannot.

**Tech Stack:** React 19, react-router-dom v7, TanStack Query, Supabase JS v2, Tailwind v4, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-09-workspace-switching-design.md`

## Global Constraints

- The URL segment is the workspace **uuid**. No slugs.
- `useWorkspaceId()` throws outside a provider. Never return an empty string.
- Nav tables keep **workspace-relative** paths (`/projects`, `/`) as their `to`
  values so `routePrefetchers[item.to]` keeps working; only the rendered href is
  prefixed, via `workspacePath`.
- Deleting a workspace is out of scope.
- Do not modify `create_personal_workspace`. It stays idempotent.
- Commit trailer on every commit: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Run tests with `npx vitest run --maxWorkers=2 <path>`.
- The pass-2 migration is applied by the USER via `npx supabase db push`.

## Deviation from the spec

The spec lists `useWorkspace(): { id; name }` alongside `useWorkspaceId()`.
**Drop `useWorkspace`.** The name is only needed by the switcher, which owns a
workspace-list query anyway; putting it in the provider would make every page
wait on a query it does not use. `useWorkspaceId()` is the whole provider API.

---

## Pass 1 — routing and context (PR 1)

No new user-visible feature. A user with one workspace sees only a changed URL.

### Task 1: `workspacePath` and `listWorkspaces`

**Files:**
- Create: `src/features/workspaces/workspace-path.ts`
- Create: `src/features/workspaces/workspaces.queries.ts`
- Test: `src/features/workspaces/workspace-path.test.ts`
- Test: `src/features/workspaces/workspaces.queries.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function workspacePath(workspaceId: string, path: string): string;
  export type WorkspaceSummary = { id: string; name: string };
  export function listWorkspaces(client: Client): Promise<WorkspaceSummary[]>;
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/features/workspaces/workspace-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { workspacePath } from "./workspace-path";

describe("workspacePath", () => {
  it("maps the workspace root without a trailing slash", () => {
    expect(workspacePath("ws-1", "/")).toBe("/w/ws-1");
  });

  it("prefixes a section path", () => {
    expect(workspacePath("ws-1", "/projects")).toBe("/w/ws-1/projects");
  });

  it("prefixes a nested path", () => {
    expect(workspacePath("ws-1", "/projects/project-9")).toBe("/w/ws-1/projects/project-9");
  });

  it("tolerates a path given without its leading slash", () => {
    expect(workspacePath("ws-1", "projects")).toBe("/w/ws-1/projects");
  });
});
```

Create `src/features/workspaces/workspaces.queries.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { listWorkspaces } from "./workspaces.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    update: vi.fn(() => query),
    single: vi.fn(() => result),
  };

  return { client: { from: vi.fn(() => query), rpc: vi.fn(() => result) }, query };
}

describe("listWorkspaces", () => {
  it("selects id and name oldest first", async () => {
    const { client, query } = createQueryClient({
      data: [{ id: "ws-1", name: "Personal" }],
      error: null,
    });

    const result = await listWorkspaces(client as never);

    expect(client.from).toHaveBeenCalledWith("workspaces");
    expect(query.select).toHaveBeenCalledWith("id, name");
    expect(query.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(result).toEqual([{ id: "ws-1", name: "Personal" }]);
  });

  it("returns an empty list rather than null", async () => {
    const { client } = createQueryClient({ data: null, error: null });

    expect(await listWorkspaces(client as never)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
npx vitest run --maxWorkers=2 src/features/workspaces
```

Expected: FAIL — both imports unresolved.

- [ ] **Step 3: Write the modules**

Create `src/features/workspaces/workspace-path.ts`:

```ts
/**
 * Nav tables keep workspace-relative paths so routePrefetchers stays keyed by
 * them; only the rendered href goes through here.
 */
export function workspacePath(workspaceId: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? `/w/${workspaceId}` : `/w/${workspaceId}${normalized}`;
}
```

Create `src/features/workspaces/workspaces.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type WorkspaceSummary = { id: string; name: string };

/** Shared by the gate, the redirect, the switcher, and the rename control. */
export const workspacesQueryKey = ["workspaces"] as const;

/** RLS narrows this to workspaces the caller belongs to or created. */
export async function listWorkspaces(client: Client): Promise<WorkspaceSummary[]> {
  const { data, error } = await client
    .from("workspaces")
    .select("id, name")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorkspaceSummary[];
}
```

- [ ] **Step 4: Run them and confirm they pass**

```bash
npx vitest run --maxWorkers=2 src/features/workspaces
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/workspaces && git commit -m "feat: add workspace path helper and list query"
```

---

### Task 2: The resolver

**Files:**
- Create: `src/features/workspaces/workspace-resolver.ts`
- Test: `src/features/workspaces/workspace-resolver.test.ts`

**Interfaces:**
- Consumes: `WorkspaceSummary` (Task 1)
- Produces: `export function resolveWorkspaceId(workspaces: WorkspaceSummary[], storedId: string | null): string | null` — null means "none exist, create one".

- [ ] **Step 1: Write the failing test**

Create `src/features/workspaces/workspace-resolver.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveWorkspaceId } from "./workspace-resolver";

const workspaces = [
  { id: "ws-old", name: "Personal" },
  { id: "ws-new", name: "Acme" },
];

describe("resolveWorkspaceId", () => {
  it("keeps the stored workspace when the caller is still a member", () => {
    expect(resolveWorkspaceId(workspaces, "ws-new")).toBe("ws-new");
  });

  it("falls back to the oldest when the stored id is stale", () => {
    expect(resolveWorkspaceId(workspaces, "ws-removed")).toBe("ws-old");
  });

  it("falls back to the oldest when nothing is stored", () => {
    expect(resolveWorkspaceId(workspaces, null)).toBe("ws-old");
  });

  it("signals that one must be created when there are none", () => {
    expect(resolveWorkspaceId([], "ws-old")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run --maxWorkers=2 src/features/workspaces/workspace-resolver.test.ts
```

Expected: FAIL — unresolved import.

- [ ] **Step 3: Write it**

Create `src/features/workspaces/workspace-resolver.ts`:

```ts
import type { WorkspaceSummary } from "./workspaces.queries";

/**
 * The stored id is only a hint — it survives losing access to a workspace, so
 * it is honoured only when it is still in the caller's list. Null means the
 * caller has no workspace yet and one must be created.
 */
export function resolveWorkspaceId(
  workspaces: WorkspaceSummary[],
  storedId: string | null,
): string | null {
  if (workspaces.length === 0) return null;
  if (storedId && workspaces.some((workspace) => workspace.id === storedId)) return storedId;
  return workspaces[0].id;
}
```

- [ ] **Step 4: Run it and confirm it passes**

```bash
npx vitest run --maxWorkers=2 src/features/workspaces/workspace-resolver.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/workspaces && git commit -m "feat: add the workspace resolver"
```

---

### Task 3: `WorkspaceProvider`

**Files:**
- Create: `src/features/workspaces/workspace-context.tsx`
- Test: `src/features/workspaces/workspace-context.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export function WorkspaceProvider({ workspaceId, children }: PropsWithChildren<{ workspaceId: string }>): JSX.Element;
  export function useWorkspaceId(): string;
  ```

The provider takes the id as a prop rather than reading the param itself, so it
is trivially testable and the guard in Task 4 stays the single place that
validates membership.

- [ ] **Step 1: Write the failing test**

Create `src/features/workspaces/workspace-context.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceId } from "./workspace-context";
import { getStoredWorkspaceId } from "../../lib/supabase/workspace";

function Consumer() {
  return <p>workspace: {useWorkspaceId()}</p>;
}

describe("WorkspaceProvider", () => {
  it("exposes the workspace id to consumers", () => {
    render(
      <WorkspaceProvider workspaceId="ws-1">
        <Consumer />
      </WorkspaceProvider>,
    );

    expect(screen.getByText("workspace: ws-1")).toBeTruthy();
  });

  it("re-renders consumers when the workspace changes", () => {
    const { rerender } = render(
      <WorkspaceProvider workspaceId="ws-1">
        <Consumer />
      </WorkspaceProvider>,
    );

    rerender(
      <WorkspaceProvider workspaceId="ws-2">
        <Consumer />
      </WorkspaceProvider>,
    );

    expect(screen.getByText("workspace: ws-2")).toBeTruthy();
  });

  it("records the workspace as the last-used hint", () => {
    window.localStorage.clear();

    render(
      <WorkspaceProvider workspaceId="ws-7">
        <Consumer />
      </WorkspaceProvider>,
    );

    expect(getStoredWorkspaceId()).toBe("ws-7");
  });

  it("throws when the hook is used outside the provider", () => {
    // React logs the thrown render error; silence it for this assertion only.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(
      "useWorkspaceId must be used inside a WorkspaceProvider.",
    );

    consoleError.mockRestore();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run --maxWorkers=2 src/features/workspaces/workspace-context.test.tsx
```

Expected: FAIL — unresolved import.

- [ ] **Step 3: Write it**

Create `src/features/workspaces/workspace-context.tsx`:

```tsx
import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import { setStoredWorkspaceId } from "../../lib/supabase/workspace";

const WorkspaceContext = createContext<string | null>(null);

export function WorkspaceProvider({
  workspaceId,
  children,
}: PropsWithChildren<{ workspaceId: string }>) {
  // localStorage is no longer the source of truth — only the resolver's hint
  // for where to send someone who arrives at "/".
  useEffect(() => {
    setStoredWorkspaceId(workspaceId);
  }, [workspaceId]);

  return <WorkspaceContext.Provider value={workspaceId}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceId(): string {
  const workspaceId = useContext(WorkspaceContext);

  // Throwing beats returning "" — a missing provider becomes an immediate
  // failure instead of a query that silently matches nothing.
  if (!workspaceId) throw new Error("useWorkspaceId must be used inside a WorkspaceProvider.");

  return workspaceId;
}
```

- [ ] **Step 4: Run it and confirm it passes**

```bash
npx vitest run --maxWorkers=2 src/features/workspaces/workspace-context.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/workspaces && git commit -m "feat: add the workspace context provider"
```

---

### Task 4: Routes, guard, and resolver screens

**Files:**
- Create: `src/features/workspaces/workspace-gate.tsx`
- Create: `src/features/workspaces/workspace-redirect.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/features/workspaces/workspace-gate.test.tsx`

**Interfaces:**
- Consumes: `listWorkspaces`, `resolveWorkspaceId`, `WorkspaceProvider`, `workspacePath`
- Produces:
  - `WorkspaceGate` — validates the param against the caller's list, then provides it
  - `WorkspaceRedirect` — the `/` resolver, also used by legacy paths

- [ ] **Step 1: Write `WorkspaceGate`**

Create `src/features/workspaces/workspace-gate.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { OrbitFloLogo } from "../../components/orbit-flo-logo";
import { SatelliteLoader, StarFieldBackground } from "../../components/space-visuals";
import { supabase } from "../../lib/supabase/client";
import { WorkspaceProvider } from "./workspace-context";
import { listWorkspaces, workspacesQueryKey } from "./workspaces.queries";
import type { PropsWithChildren } from "react";

function WorkspaceNotice({ children }: PropsWithChildren) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020817] px-6 text-slate-100">
      <StarFieldBackground />
      <section className="orbit-panel relative z-10 w-full max-w-sm rounded-lg p-6">
        <OrbitFloLogo className="mb-6 max-w-56" showTagline />
        {children}
      </section>
    </main>
  );
}

export function WorkspaceGate({ children }: PropsWithChildren) {
  const { workspaceId } = useParams();
  const workspacesQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () => listWorkspaces(supabase),
  });

  if (workspacesQuery.isPending) {
    return (
      <WorkspaceNotice>
        <SatelliteLoader label="Opening workspace" />
      </WorkspaceNotice>
    );
  }

  if (workspacesQuery.isError) {
    return (
      <WorkspaceNotice>
        <h1 className="text-lg font-semibold text-white">Could not load your workspaces</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{workspacesQuery.error.message}</p>
      </WorkspaceNotice>
    );
  }

  const isMember = (workspacesQuery.data ?? []).some((workspace) => workspace.id === workspaceId);

  // RLS returns nothing rather than erroring, so "not yours" and "does not
  // exist" are indistinguishable here — and to the reader they mean the same.
  if (!workspaceId || !isMember) {
    return (
      <WorkspaceNotice>
        <h1 className="text-lg font-semibold text-white">This workspace is not yours to open.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          It may have been deleted, or your access removed.
        </p>
        <Link className="orbit-button mt-4" to="/">
          Go to your workspace
        </Link>
      </WorkspaceNotice>
    );
  }

  return <WorkspaceProvider workspaceId={workspaceId}>{children}</WorkspaceProvider>;
}
```

- [ ] **Step 2: Write `WorkspaceRedirect`**

Create `src/features/workspaces/workspace-redirect.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { OrbitFloLogo } from "../../components/orbit-flo-logo";
import { SatelliteLoader, StarFieldBackground } from "../../components/space-visuals";
import { supabase } from "../../lib/supabase/client";
import { ensurePersonalWorkspace } from "../../lib/supabase/onboarding";
import { getStoredWorkspaceId } from "../../lib/supabase/workspace";
import { useAuth } from "../auth/use-auth";
import { workspacePath } from "./workspace-path";
import { resolveWorkspaceId } from "./workspace-resolver";
import { listWorkspaces, workspacesQueryKey } from "./workspaces.queries";

/**
 * "/" and every legacy path land here. The path is carried across so an old
 * bookmark such as /projects reopens the same screen in the resolved
 * workspace.
 */
export function WorkspaceRedirect() {
  const location = useLocation();
  const { user } = useAuth();

  const workspacesQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () => listWorkspaces(supabase),
  });

  const resolvedId = workspacesQuery.data
    ? resolveWorkspaceId(workspacesQuery.data, getStoredWorkspaceId())
    : null;

  // Only runs for a caller with no workspace at all — the first-run path.
  const createdQuery = useQuery({
    queryKey: ["workspaces", "bootstrap"],
    queryFn: () => ensurePersonalWorkspace(supabase, user ?? { id: "", email: null }),
    enabled: Boolean(user) && workspacesQuery.isSuccess && resolvedId === null,
  });

  const targetId = resolvedId ?? createdQuery.data?.id ?? null;

  if (targetId) {
    return <Navigate to={workspacePath(targetId, location.pathname)} replace />;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020817] px-6 text-slate-100">
      <StarFieldBackground />
      <section className="orbit-panel relative z-10 w-full max-w-sm rounded-lg p-6">
        <OrbitFloLogo className="mb-6 max-w-56" showTagline />
        {workspacesQuery.isError || createdQuery.isError ? (
          <>
            <h1 className="text-lg font-semibold text-white">Could not open a workspace</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {(workspacesQuery.error ?? createdQuery.error)?.message}
            </p>
          </>
        ) : (
          <SatelliteLoader label="Finding your workspace" />
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Restructure the routes**

Rewrite the route table in `src/app/routes.tsx`. Replace the nine repeated
`AuthenticatedShell` routes with one nested layout route, and add the redirect
routes. Keep the auth routes and the visual-review route exactly as they are.

Replace `AuthenticatedShell` with:

```tsx
function WorkspaceLayout() {
  return (
    <RequireAuth>
      <WorkspaceGate>
        <AppShell>
          <LazyRoute>
            <Outlet />
          </LazyRoute>
        </AppShell>
      </WorkspaceGate>
    </RequireAuth>
  );
}
```

and the authenticated part of the route table with:

```tsx
        <Route element={<RequireAuth><WorkspaceRedirect /></RequireAuth>} path="/" />
        <Route element={<RequireAuth><WorkspaceRedirect /></RequireAuth>} path="/dashboard" />
        <Route element={<RequireAuth><WorkspaceRedirect /></RequireAuth>} path="/projects" />
        <Route element={<RequireAuth><WorkspaceRedirect /></RequireAuth>} path="/projects/:projectId" />
        <Route element={<RequireAuth><WorkspaceRedirect /></RequireAuth>} path="/calendar" />
        <Route element={<RequireAuth><WorkspaceRedirect /></RequireAuth>} path="/maps" />
        <Route element={<RequireAuth><WorkspaceRedirect /></RequireAuth>} path="/inbox" />
        <Route element={<RequireAuth><WorkspaceRedirect /></RequireAuth>} path="/notes" />
        <Route element={<RequireAuth><WorkspaceRedirect /></RequireAuth>} path="/settings" />

        <Route element={<WorkspaceLayout />} path="/w/:workspaceId">
          <Route index element={<DailyMissionControlPage />} />
          <Route element={<DashboardPage />} path="dashboard" />
          <Route element={<ProjectsPage />} path="projects" />
          <Route element={<ProjectWorkspacePage />} path="projects/:projectId" />
          <Route element={<CalendarPage />} path="calendar" />
          <Route element={<MapsPage />} path="maps" />
          <Route element={<InboxPage />} path="inbox" />
          <Route element={<NotesPage />} path="notes" />
          <Route element={<SettingsPage />} path="settings" />
        </Route>
```

Add `Outlet` to the react-router-dom import, and import `WorkspaceGate` and
`WorkspaceRedirect`.

- [ ] **Step 4: Write the gate test**

Create `src/features/workspaces/workspace-gate.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceGate } from "./workspace-gate";
import { useWorkspaceId } from "./workspace-context";

const gateMocks = vi.hoisted(() => ({ listWorkspaces: vi.fn() }));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("./workspaces.queries", () => ({ listWorkspaces: gateMocks.listWorkspaces }));

function Consumer() {
  return <p>inside {useWorkspaceId()}</p>;
}

function renderGate(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            element={
              <WorkspaceGate>
                <Consumer />
              </WorkspaceGate>
            }
            path="/w/:workspaceId"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WorkspaceGate", () => {
  it("provides the workspace when the caller is a member", async () => {
    gateMocks.listWorkspaces.mockResolvedValue([{ id: "ws-1", name: "Personal" }]);

    renderGate("/w/ws-1");

    expect(await screen.findByText("inside ws-1")).toBeTruthy();
  });

  it("refuses a workspace the caller does not belong to", async () => {
    gateMocks.listWorkspaces.mockResolvedValue([{ id: "ws-1", name: "Personal" }]);

    renderGate("/w/ws-someone-else");

    expect(await screen.findByText("This workspace is not yours to open.")).toBeTruthy();
    expect(screen.queryByText(/^inside/)).toBeNull();
  });

  it("surfaces a failure to load the workspace list", async () => {
    gateMocks.listWorkspaces.mockRejectedValue(new Error("network down"));

    renderGate("/w/ws-1");

    expect(await screen.findByText("network down")).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run the workspace tests**

```bash
npx vitest run --maxWorkers=2 src/features/workspaces
```

Expected: PASS, 17 tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/workspaces src/app/routes.tsx && git commit -m "feat: scope authenticated routes to /w/:workspaceId"
```

---

### Task 5: Move the call sites and prefix the links

**Files:**
- Modify the 11 pages listed in the spec, replacing `getStoredWorkspaceId()` with `useWorkspaceId()`
- Modify: `src/components/app-shell.tsx`, `src/components/command-palette.tsx`, `src/components/mobile-tab-bar.tsx`, `src/components/mobile-more-sheet.tsx`
- Modify: `src/features/projects/projects-page.tsx`, `src/features/dashboard/dashboard-page.tsx` — the three `/projects/${id}` links
- Modify: `src/features/auth/auth-callback-page.tsx` — stop setting the stored id
- Modify the corresponding test files

- [ ] **Step 1: Replace the 11 workspace reads**

In each of these files, delete the `getStoredWorkspaceId` import and the
`const workspaceId = getStoredWorkspaceId();` line, and add:

```ts
import { useWorkspaceId } from "../workspaces/workspace-context";
```

(`../../features/workspaces/workspace-context` from `src/components/*`), with

```ts
  const workspaceId = useWorkspaceId();
```

Files: `command-palette.tsx`, `global-quick-add.tsx`, `calendar-page.tsx`,
`daily-mission-control-page.tsx`, `dashboard-page.tsx`, `inbox-page.tsx`,
`maps-page.tsx`, `notes-page.tsx`, `project-workspace-page.tsx`,
`projects-page.tsx`, `reviews-panel.tsx`.

`workspaceId` is now `string` rather than `string | null`. Simplify the
`Boolean(workspaceId && ...)` guards and `workspaceId ?? ""` fallbacks these
files carry — `tsc` will not flag them, so grep each file for `workspaceId ??`
and `workspaceId &&` and remove the now-dead branches.

- [ ] **Step 2: Prefix the nav links**

In `app-shell.tsx`, `mobile-tab-bar.tsx`, and `mobile-more-sheet.tsx`, keep the
`to` values in the nav tables as they are, and wrap them at render:

```tsx
  const workspaceId = useWorkspaceId();
  // ...
  <NavLink to={workspacePath(workspaceId, item.to)} ... />
```

`routePrefetchers[item.to]` keeps using the unprefixed `item.to` and needs no
change.

In `command-palette.tsx`, the command list's `to` values get the same treatment
where the palette navigates.

In `projects-page.tsx` and `dashboard-page.tsx`, change the three project links:

```tsx
to={workspacePath(workspaceId, `/projects/${project.id}`)}
```

- [ ] **Step 3: Stop the callback writing the stored id**

In `src/features/auth/auth-callback-page.tsx`, delete the
`setStoredWorkspaceId(workspace.id)` line and its import. Keep the
`ensurePersonalWorkspace` call and the `navigate("/")`.

- [ ] **Step 4: Fix the tests**

Every page test that renders a page directly now needs the provider. Wrap the
render helper in each affected test file:

```tsx
<WorkspaceProvider workspaceId="workspace-1">{/* page */}</WorkspaceProvider>
```

and delete the `vi.mock("../../lib/supabase/workspace", ...)` stubs that
returned a fixed id, since the provider supplies it now. Leave the mock in
place where a test also relies on `clearStoredWorkspaceId`.

`App.test.tsx` needs its history pushes updated to `/w/workspace-1/...` and a
`listWorkspaces` mock returning that workspace.

- [ ] **Step 5: Run the full suite**

```bash
npx vitest run --maxWorkers=2
```

Expected: PASS. Fix fallout until green; this is the step where most of it
appears.

- [ ] **Step 6: Typecheck and build**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor: read the workspace from the route rather than localStorage"
```

---

### Task 6: Pass 1 verification and PR

- [ ] **Step 1: Confirm nothing still reads the store directly**

```bash
git grep -n "getStoredWorkspaceId" -- src
```

Expected: only `src/lib/supabase/workspace.ts`,
`src/features/workspaces/workspace-redirect.tsx`, and tests.

- [ ] **Step 2: Browser check**

Start the preview and confirm: `/` redirects to `/w/<uuid>`, the sidebar links
carry the prefix, `/projects` redirects to `/w/<uuid>/projects`, and
`/w/00000000-0000-0000-0000-000000000000` renders the no-access screen.

- [ ] **Step 3: Open PR 1, wait for CI, merge**

Title: `Scope routes to /w/:workspaceId`. Describe it as a refactor with no new
feature, and note that a single-workspace user sees only a changed URL.

---

## Pass 2 — switcher, create, rename (PR 2)

### Task 7: `create_workspace` migration

**Files:**
- Create: `supabase/migrations/202608100001_create_workspace.sql`

- [ ] **Step 1: Write the migration**

```sql
-- create_personal_workspace is deliberately idempotent — it returns the
-- caller's existing owned workspace — so it cannot make a second one. This is
-- the deliberate path for additional workspaces. It is a function rather than
-- an insert grant because the owner membership must be created atomically with
-- the workspace; a blanket insert grant would let a client create a workspace
-- it is not a member of.
create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid;
  trimmed_name text;
  new_workspace_id uuid;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'Authentication required to create a workspace';
  end if;

  trimmed_name := nullif(btrim(workspace_name), '');

  if trimmed_name is null then
    raise exception 'Workspace name is required';
  end if;

  insert into public.workspaces (name, created_by)
  values (trimmed_name, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'owner');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text) from public;
grant execute on function public.create_workspace(text) to authenticated;
```

- [ ] **Step 2: Add it to `database.types.ts`**

Add `create_workspace: { Args: { workspace_name: string }; Returns: string }`
to the `Functions` block, matching how `create_personal_workspace` is declared
there.

- [ ] **Step 3: Commit and hand the push to the user**

```bash
git add supabase/migrations src/lib/supabase/database.types.ts && git commit -m "feat: add the create_workspace function"
```

Then ask the user to run, from the worktree:

```bash
npx supabase db push
```

Tasks 8 and 9 do not depend on it having run.

---

### Task 8: create and rename queries

**Files:**
- Modify: `src/features/workspaces/workspaces.queries.ts`
- Modify: `src/features/workspaces/workspaces.queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `workspaces.queries.test.ts`:

```ts
describe("createWorkspace", () => {
  it("calls the RPC with a trimmed name", async () => {
    const { client } = createQueryClient({ data: "ws-new", error: null });

    const id = await createWorkspace(client as never, "  Acme Engineering  ");

    expect(client.rpc).toHaveBeenCalledWith("create_workspace", {
      workspace_name: "Acme Engineering",
    });
    expect(id).toBe("ws-new");
  });

  it("refuses a blank name without calling the RPC", async () => {
    const { client } = createQueryClient({ data: null, error: null });

    await expect(createWorkspace(client as never, "   ")).rejects.toThrow(
      "Workspaces need a name.",
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe("renameWorkspace", () => {
  it("updates the name scoped by id", async () => {
    const { client, query } = createQueryClient({ data: { id: "ws-1" }, error: null });

    await renameWorkspace(client as never, { id: "ws-1", name: "  Renamed  " });

    expect(query.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(query.eq).toHaveBeenCalledWith("id", "ws-1");
  });
});
```

Add `createWorkspace` and `renameWorkspace` to the import at the top.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run --maxWorkers=2 src/features/workspaces/workspaces.queries.test.ts
```

- [ ] **Step 3: Implement**

Append to `workspaces.queries.ts`:

```ts
export async function createWorkspace(client: Client, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Workspaces need a name.");

  const { data, error } = await client.rpc("create_workspace", { workspace_name: trimmed });

  if (error) throw error;
  if (!data) throw new Error("The workspace was not created.");
  return data;
}

export async function renameWorkspace(client: Client, input: { id: string; name: string }) {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("Workspaces need a name.");

  const { data, error } = await client
    .from("workspaces")
    .update({ name: trimmed })
    .eq("id", input.id)
    .select("id, name")
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Run and confirm pass, then commit**

```bash
npx vitest run --maxWorkers=2 src/features/workspaces
git add src/features/workspaces && git commit -m "feat: add create and rename workspace queries"
```

---

### Task 9: The switcher

**Files:**
- Create: `src/features/workspaces/workspace-switcher.tsx`
- Test: `src/features/workspaces/workspace-switcher.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export function WorkspaceSwitcher({ isCollapsed }: { isCollapsed: boolean }): JSX.Element
  ```

It owns its own `listWorkspaces` query on `workspacesQueryKey` — the same key
the gate uses, so it is already cached and resolves instantly — plus the create
mutation and the dropdown state.

- [ ] **Step 1: Write the failing test**

Create `src/features/workspaces/workspace-switcher.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "./workspace-context";
import { WorkspaceSwitcher } from "./workspace-switcher";

const switcherMocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
}));

const navigateMock = vi.fn();

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("./workspaces.queries", () => ({
  listWorkspaces: switcherMocks.listWorkspaces,
  createWorkspace: switcherMocks.createWorkspace,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function renderSwitcher(isCollapsed = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkspaceProvider workspaceId="ws-1">
          <WorkspaceSwitcher isCollapsed={isCollapsed} />
        </WorkspaceProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    switcherMocks.createWorkspace.mockReset();
    switcherMocks.listWorkspaces.mockResolvedValue([
      { id: "ws-1", name: "Personal" },
      { id: "ws-2", name: "Acme" },
    ]);
  });

  it("names the current workspace", async () => {
    renderSwitcher();

    expect(await screen.findByRole("button", { name: /Personal/ })).toBeTruthy();
  });

  it("switches to another workspace", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(await screen.findByRole("button", { name: /Personal/ }));
    await user.click(screen.getByRole("menuitem", { name: "Acme" }));

    expect(navigateMock).toHaveBeenCalledWith("/w/ws-2");
  });

  it("keeps the workspace name reachable when the rail is collapsed", async () => {
    renderSwitcher(true);

    expect(await screen.findByRole("button", { name: "Personal" })).toBeTruthy();
  });

  it("creates a workspace and moves to it", async () => {
    switcherMocks.createWorkspace.mockResolvedValue("ws-3");
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(await screen.findByRole("button", { name: /Personal/ }));
    await user.click(screen.getByRole("menuitem", { name: "New workspace" }));
    await user.type(screen.getByLabelText("Workspace name"), "Orbit Labs");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(switcherMocks.createWorkspace).toHaveBeenCalledWith({}, "Orbit Labs");
    expect(navigateMock).toHaveBeenCalledWith("/w/ws-3");
  });

  it("keeps the modal open when creating fails", async () => {
    switcherMocks.createWorkspace.mockRejectedValue(new Error("name taken"));
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(await screen.findByRole("button", { name: /Personal/ }));
    await user.click(screen.getByRole("menuitem", { name: "New workspace" }));
    await user.type(screen.getByLabelText("Workspace name"), "Orbit Labs");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByText("name taken")).toBeTruthy();
    expect(screen.getByLabelText("Workspace name")).toHaveValue("Orbit Labs");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Implement the switcher**

Create `src/features/workspaces/workspace-switcher.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Field } from "../../components/field";
import { Modal } from "../../components/modal";
import { supabase } from "../../lib/supabase/client";
import { useWorkspaceId } from "./workspace-context";
import { workspacePath } from "./workspace-path";
import { createWorkspace, listWorkspaces, workspacesQueryKey } from "./workspaces.queries";

export function WorkspaceSwitcher({ isCollapsed }: { isCollapsed: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const workspacesQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () => listWorkspaces(supabase),
  });

  const workspaces = workspacesQuery.data ?? [];
  const current = workspaces.find((workspace) => workspace.id === workspaceId);
  // Falling back to the id keeps the trigger labelled while the list loads or
  // if it fails, rather than collapsing to an empty button.
  const currentName = current?.name ?? "Workspace";

  const createMutation = useMutation({
    mutationFn: (workspaceName: string) => createWorkspace(supabase, workspaceName),
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      setIsCreateOpen(false);
      setName("");
      navigate(workspacePath(id, "/"));
    },
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function choose(id: string) {
    setIsOpen(false);
    // Always the workspace root: ids in the current path belong to the
    // workspace being left.
    navigate(workspacePath(id, "/"));
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate(name);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={isCollapsed ? currentName : undefined}
        className={`flex w-full min-w-0 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#050d20]/80 px-2.5 py-2 text-left text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 ${
          isCollapsed ? "justify-center" : ""
        }`}
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-cyan-300/15 text-xs font-black text-cyan-100">
          {currentName.slice(0, 1).toUpperCase()}
        </span>
        {isCollapsed ? null : (
          <>
            <span className="min-w-0 flex-1 truncate">{currentName}</span>
            <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
          </>
        )}
      </button>

      {isOpen ? (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 grid gap-0.5 rounded-lg border border-white/[0.08] bg-[#050d20] p-1 shadow-xl"
          role="menu"
        >
          {workspaces.map((workspace) => (
            <button
              className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]"
              key={workspace.id}
              onClick={() => choose(workspace.id)}
              role="menuitem"
              type="button"
            >
              <span className="w-4 shrink-0">
                {workspace.id === workspaceId ? (
                  <Check aria-hidden="true" className="h-4 w-4 text-cyan-300" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
            </button>
          ))}

          <div className="my-0.5 h-px bg-white/[0.08]" />

          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-cyan-200 transition hover:bg-white/[0.05]"
            onClick={() => {
              setIsOpen(false);
              setIsCreateOpen(true);
            }}
            role="menuitem"
            type="button"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New workspace
          </button>
        </div>
      ) : null}

      {isCreateOpen ? (
        <Modal onClose={() => setIsCreateOpen(false)} size="sm" title="New workspace">
          <form className="grid gap-4" onSubmit={submitCreate}>
            <Field label="Workspace name">
              <input
                autoFocus
                className="orbit-input"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </Field>

            {createMutation.isError ? (
              <p
                className="rounded-md border border-violet-300/35 bg-violet-400/10 px-3 py-2 text-sm text-violet-100"
                role="alert"
              >
                {createMutation.error.message}
              </p>
            ) : null}

            <button className="orbit-button w-full" disabled={createMutation.isPending} type="submit">
              {createMutation.isPending ? "Creating..." : "Create workspace"}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
```

Note the trigger's accessible name: expanded, it comes from the visible name
text; collapsed, only the initial is visible, so `aria-label` supplies the full
name. That is what the collapsed-rail test asserts.

- [ ] **Step 4: Run, then commit**

```bash
npx vitest run --maxWorkers=2 src/features/workspaces
git add src/features/workspaces && git commit -m "feat: add the workspace switcher"
```

---

### Task 10: Mount the switcher and add rename

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/features/settings/settings-page.tsx`
- Modify: `src/components/app-shell.test.tsx`, `src/features/settings/settings-page.test.tsx`

- [ ] **Step 1: Mount the switcher**

In `app-shell.tsx`, directly under the logo row inside the `aside`:

```tsx
        <div className="mt-3">
          <WorkspaceSwitcher isCollapsed={isCollapsed} />
        </div>
```

- [ ] **Step 2: Add the rename control**

In `settings-page.tsx`, add this state and handler alongside the existing
password ones:

```tsx
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const workspacesQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () => listWorkspaces(supabase),
  });
  const currentWorkspace = (workspacesQuery.data ?? []).find(
    (workspace) => workspace.id === workspaceId,
  );

  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);

  // Seed the field once the name arrives, without clobbering a live edit.
  useEffect(() => {
    if (currentWorkspace && !workspaceName) setWorkspaceName(currentWorkspace.name);
  }, [currentWorkspace, workspaceName]);

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameWorkspace(supabase, { id: workspaceId, name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      setWorkspaceMessage("Workspace renamed.");
    },
  });
```

and this panel immediately above the account `QuietPanel`:

```tsx
      <QuietPanel aria-label="Workspace">
        <SectionHeader title="Workspace">Rename the workspace everyone sees.</SectionHeader>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input
            aria-label="Workspace name"
            className="orbit-input min-w-0 flex-1 sm:max-w-72"
            onChange={(event) => {
              setWorkspaceName(event.target.value);
              setWorkspaceMessage(null);
            }}
            value={workspaceName}
          />
          <button
            className="orbit-button-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={renameMutation.isPending || !workspaceName.trim()}
            onClick={() => renameMutation.mutate(workspaceName)}
            type="button"
          >
            {renameMutation.isPending ? "Saving..." : "Update name"}
          </button>
        </div>
        {workspaceMessage ? (
          <p className="mt-3 text-sm font-semibold text-emerald-200">{workspaceMessage}</p>
        ) : null}
        {renameMutation.isError ? (
          <p className="mt-3 text-sm text-rose-200" role="alert">
            {renameMutation.error.message}
          </p>
        ) : null}
      </QuietPanel>
```

Add the imports: `useQuery`, `useMutation`, `useQueryClient` from
`@tanstack/react-query`; `useEffect` from React; `useWorkspaceId` from
`../workspaces/workspace-context`; and `listWorkspaces`, `renameWorkspace`,
`workspacesQueryKey` from `../workspaces/workspaces.queries`.

- [ ] **Step 3: Update the shell and settings tests**

`app-shell.test.tsx` now needs the workspace provider and a `listWorkspaces`
mock. `settings-page.test.tsx` needs the same, plus assertions that renaming
calls `renameWorkspace` with the trimmed name.

- [ ] **Step 4: Full suite, build**

```bash
npx vitest run --maxWorkers=2
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: mount the workspace switcher and rename control"
```

---

### Task 11: Pass 2 verification and PR

- [ ] **Step 1: Browser check** — after the user confirms the migration ran.
  Create a second workspace, confirm the URL changes and the sidebar relabels,
  switch between them and confirm the project list differs, rename one and
  confirm the switcher updates. Screenshot the open dropdown at 1440px and
  390px.

- [ ] **Step 2: Open PR 2, wait for CI, merge.**
