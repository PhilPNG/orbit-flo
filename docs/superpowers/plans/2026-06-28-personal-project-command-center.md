# Personal Project Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable React/Supabase personal project command center described in `docs/superpowers/specs/2026-06-28-personal-project-command-center-design.md`.

**Architecture:** Use a Vite React app with feature folders, Supabase as the authenticated backend, TanStack Query for server state, and route-level pages inside a persistent app shell. Keep the UI personal-first while preserving workspace membership boundaries in every data operation.

**Tech Stack:** React, TypeScript, Vite, React Router, TanStack Query, Supabase Auth/Postgres, Tailwind CSS, Vitest, Testing Library, Playwright, Vercel.

---

## File Structure

Create this structure during implementation:

```text
supabase/
  migrations/
    202606280001_initial_project_command_center.sql
vercel.json
src/
  app/
    App.tsx
    providers.tsx
    routes.tsx
  components/
    app-shell.tsx
    empty-state.tsx
    field.tsx
    modal.tsx
    status-pill.tsx
  features/
    auth/
      auth-callback-page.tsx
      auth-page.tsx
      require-auth.tsx
      use-auth.ts
    dashboard/
      dashboard-page.tsx
      dashboard.queries.ts
      dashboard.test.ts
    notes/
      note-form.tsx
      notes-page.tsx
      notes.queries.ts
    projects/
      project-form.tsx
      project-workspace-page.tsx
      projects-page.tsx
      projects.queries.ts
    reviews/
      review-form.tsx
      reviews-panel.tsx
      reviews.queries.ts
    settings/
      settings-page.tsx
    work-items/
      kanban-board.tsx
      subtask-list.tsx
      work-item-form.tsx
      work-items.queries.ts
  lib/
    dates.ts
    supabase/
      client.ts
      database.types.ts
      onboarding.ts
      workspace.ts
    query-client.ts
  main.tsx
  styles.css
tests/
  e2e/
    smoke.spec.ts
```

Responsibility boundaries:

- `src/lib/supabase/*` owns Supabase client setup, database types, workspace bootstrap, and shared workspace helpers.
- `src/features/*/*.queries.ts` owns data fetching and mutation functions for one feature.
- Page components compose feature components and queries; they should not contain raw Supabase calls.
- Shared components are small visual primitives without feature-specific data fetching.

## Task 1: Scaffold The React App

**Files:**

- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `postcss.config.js`
- Create: `tailwind.config.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/styles.css`
- Modify: `README.md`

- [ ] **Step 1: Create the Vite React TypeScript app files**

Run:

```powershell
npm create vite@latest . -- --template react-ts
```

Expected: Vite creates `package.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, and TypeScript config files.

- [ ] **Step 2: Install runtime and test dependencies**

Run:

```powershell
npm install @supabase/supabase-js @tanstack/react-query react-router-dom clsx lucide-react
npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom playwright
```

Expected: `package-lock.json` is created and dependencies are pinned.

- [ ] **Step 3: Replace `package.json` scripts**

Update `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 4: Configure Vitest in `vite.config.ts`**

Use:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

- [ ] **Step 5: Create `src/test/setup.ts`**

Use:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Create Tailwind entry CSS**

Replace `src/styles.css` with:

```css
@import "tailwindcss";

:root {
  color: #17201a;
  background: #f6f7f4;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
textarea,
select {
  font: inherit;
}
```

- [ ] **Step 7: Replace starter app**

Use `src/app/App.tsx`:

```tsx
export function App() {
  return (
    <main className="min-h-screen bg-[#f6f7f4] p-8 text-[#17201a]">
      <h1 className="text-2xl font-semibold">Project Command Center</h1>
      <p className="mt-2 max-w-xl text-sm text-[#5d6a61]">
        Scaffold ready. Auth, Supabase data, and planning views come next.
      </p>
    </main>
  );
}
```

Use `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Verify scaffold**

Run:

```powershell
npm run build
npm test
```

Expected: build succeeds; Vitest exits successfully with no tests or only passing tests.

- [ ] **Step 9: Commit**

Run:

```powershell
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json postcss.config.js tailwind.config.ts src README.md
git commit -m "Scaffold React project command center"
```

## Task 2: Add Supabase Schema Migration And Types

**Files:**

- Create: `supabase/migrations/202606280001_initial_project_command_center.sql`
- Create: `src/lib/supabase/database.types.ts`
- Modify: `README.md`

- [ ] **Step 1: Create migration from approved spec**

Create `supabase/migrations/202606280001_initial_project_command_center.sql` by copying the complete SQL block from `docs/superpowers/specs/2026-06-28-personal-project-command-center-design.md` under `## Supabase SQL`.

The migration must start with:

```sql
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
```

The migration must end with:

```sql
create policy "Owners and admins can delete weekly reviews"
on public.weekly_reviews
for delete
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
```

- [ ] **Step 2: Add handwritten database types for v1**

Create `src/lib/supabase/database.types.ts`:

```ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type ProjectPriority = "low" | "medium" | "high" | "critical";
export type ProjectHealth = "good" | "watch" | "at_risk" | "blocked";
export type WorkItemStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "blocked"
  | "review"
  | "done";
export type NoteType = "idea" | "question" | "decision" | "risk" | "reference";
export type LinkType =
  | "repository"
  | "documentation"
  | "design"
  | "deployment"
  | "issue_tracker"
  | "other";

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          role?: WorkspaceRole;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          status: ProjectStatus;
          priority: ProjectPriority;
          health: ProjectHealth;
          color: string | null;
          repository_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          name: string;
          description?: string | null;
          status?: ProjectStatus;
          priority?: ProjectPriority;
          health?: ProjectHealth;
          color?: string | null;
          repository_url?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: ProjectStatus;
          priority?: ProjectPriority;
          health?: ProjectHealth;
          color?: string | null;
          repository_url?: string | null;
        };
        Relationships: [];
      };
      project_links: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          link_type: LinkType;
          label: string;
          url: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id: string;
          link_type?: LinkType;
          label: string;
          url: string;
          created_by: string;
        };
        Update: {
          link_type?: LinkType;
          label?: string;
          url?: string;
        };
        Relationships: [];
      };
      milestones: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          title: string;
          description: string | null;
          target_date: string | null;
          completed_at: string | null;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id: string;
          title: string;
          description?: string | null;
          target_date?: string | null;
          sort_order?: number;
          created_by: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      work_items: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          milestone_id: string | null;
          title: string;
          description: string | null;
          status: WorkItemStatus;
          priority: ProjectPriority;
          due_date: string | null;
          estimate_points: number | null;
          sort_order: number;
          blocked_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          workspace_id: string;
          project_id: string;
          milestone_id?: string | null;
          title: string;
          description?: string | null;
          status?: WorkItemStatus;
          priority?: ProjectPriority;
          due_date?: string | null;
          estimate_points?: number | null;
          sort_order?: number;
          blocked_reason?: string | null;
          created_by: string;
        };
        Update: {
          milestone_id?: string | null;
          title?: string;
          description?: string | null;
          status?: WorkItemStatus;
          priority?: ProjectPriority;
          due_date?: string | null;
          estimate_points?: number | null;
          sort_order?: number;
          blocked_reason?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      subtasks: {
        Row: {
          id: string;
          workspace_id: string;
          work_item_id: string;
          title: string;
          is_done: boolean;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          workspace_id: string;
          work_item_id: string;
          title: string;
          is_done?: boolean;
          sort_order?: number;
          created_by: string;
        };
        Update: {
          title?: string;
          is_done?: boolean;
          sort_order?: number;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          work_item_id: string | null;
          note_type: NoteType;
          title: string;
          body: string | null;
          tags: string[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id?: string | null;
          work_item_id?: string | null;
          note_type?: NoteType;
          title: string;
          body?: string | null;
          tags?: string[];
          created_by: string;
        };
        Update: {
          note_type?: NoteType;
          title?: string;
          body?: string | null;
          tags?: string[];
        };
        Relationships: [];
      };
      weekly_reviews: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          week_start: string;
          wins: string | null;
          blockers: string | null;
          next_focus: string | null;
          health: ProjectHealth | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          project_id?: string | null;
          week_start: string;
          wins?: string | null;
          blockers?: string | null;
          next_focus?: string | null;
          health?: ProjectHealth | null;
          created_by: string;
        };
        Update: {
          week_start?: string;
          wins?: string | null;
          blockers?: string | null;
          next_focus?: string | null;
          health?: ProjectHealth | null;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      create_personal_workspace: {
        Args: {
          workspace_name?: string | null;
        };
        Returns: string;
      };
    };
  };
}
```

- [ ] **Step 3: Document schema workflow**

Add to `README.md`:

```md
## Supabase

The initial schema lives in `supabase/migrations/202606280001_initial_project_command_center.sql`.

Raw Supabase-generated types should be written to a separate base file, for example `src/lib/supabase/generated.types.ts`.
Use `npx supabase gen types typescript --local --schema public > src/lib/supabase/generated.types.ts`.
Preserve or reapply the grant-aware, narrowed app-facing `src/lib/supabase/database.types.ts`; do not replace it directly with raw generated types unless a narrowing layer is added.

Before applying the migration to a live project:

1. Review the SQL in the migration.
2. Apply it in a Supabase branch or local Supabase database.
3. Run Supabase security and performance advisors.
4. Verify that RLS blocks access across workspaces with two test users.
```

- [ ] **Step 4: Verify types compile**

Run:

```powershell
npm run build
```

Expected: TypeScript build succeeds.

- [ ] **Step 5: Commit**

Run:

```powershell
git add supabase/migrations/202606280001_initial_project_command_center.sql src/lib/supabase/database.types.ts README.md
git commit -m "Add Supabase schema migration"
```

## Task 3: Add Supabase Client, Query Provider, And Auth State

**Files:**

- Create: `.env.example`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/query-client.ts`
- Create: `src/app/providers.tsx`
- Create: `src/features/auth/use-auth.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: Add environment example**

Create `.env.example`:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

- [ ] **Step 2: Write failing Supabase env and type smoke tests**

Create `src/lib/supabase/client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

describe("Supabase environment", () => {
  it("throws when required Vite env vars are missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.resetModules();

    await expect(import("./client")).rejects.toThrow("Missing Supabase environment variables");
  });

  it("type-checks project selects through the generated Database type", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.resetModules();

    const { supabase } = await import("./client");
    const query = supabase.from("projects").select("*");

    expect(query).toBeDefined();
  });
});
```

- [ ] **Step 3: Run failing test**

Run:

```powershell
npm test -- src/lib/supabase/client.test.ts
```

Expected: FAIL because `src/lib/supabase/client.ts` does not exist.

- [ ] **Step 4: Implement Supabase client**

Create `src/lib/supabase/client.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
```

- [ ] **Step 5: Add query client**

Create `src/lib/query-client.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 6: Add providers**

Create `src/app/providers.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { queryClient } from "../lib/query-client";

export function AppProviders({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 7: Add auth hook**

Create `src/features/auth/use-auth.ts`:

```ts
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";

interface AuthState {
  isLoading: boolean;
  session: Session | null;
  user: User | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    session: null,
    user: null,
  });

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setState({
        isLoading: false,
        session: data.session,
        user: data.session?.user ?? null,
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        isLoading: false,
        session,
        user: session?.user ?? null,
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
```

- [ ] **Step 8: Wrap app with providers**

Update `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/providers";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
```

- [ ] **Step 9: Verify**

Run:

```powershell
npm test -- src/lib/supabase/client.test.ts
npm run build
```

Expected: test passes and build succeeds when env vars are present. If local env vars are absent, set temporary dummy env vars for the build:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm run build
```

- [ ] **Step 10: Commit**

Run:

```powershell
git add .env.example src/lib src/app/providers.tsx src/features/auth/use-auth.ts src/main.tsx
git commit -m "Configure Supabase client and app providers"
```

## Task 4: Add Auth Pages And Workspace Bootstrap

**Files:**

- Create: `src/features/auth/auth-page.tsx`
- Create: `src/features/auth/auth-callback-page.tsx`
- Create: `src/features/auth/require-auth.tsx`
- Create: `src/lib/supabase/onboarding.ts`
- Create: `src/lib/supabase/workspace.ts`
- Modify: `src/app/routes.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write onboarding test**

Create `src/lib/supabase/onboarding.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ensurePersonalWorkspace } from "./onboarding";

const maybeSingle = vi.fn();
const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
const rpc = vi.fn();
const from = vi.fn((table: string) => {
  if (table === "workspace_members") return { select };
  return {};
});

describe("ensurePersonalWorkspace", () => {
  it("returns an existing workspace when membership exists", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { workspace_id: "workspace-1" },
      error: null,
    });

    const result = await ensurePersonalWorkspace(
      { from } as never,
      { id: "user-1", email: "person@example.com" },
    );

    expect(result).toEqual({ id: "workspace-1" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates a personal workspace through the onboarding rpc", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    rpc.mockResolvedValueOnce({ data: "workspace-2", error: null });

    const result = await ensurePersonalWorkspace(
      { from, rpc } as never,
      { id: "user-1", email: "person@example.com" },
    );

    expect(rpc).toHaveBeenCalledWith("create_personal_workspace", {
      workspace_name: "person@example.com's Workspace",
    });
    expect(result).toEqual({ id: "workspace-2" });
  });
});
```

- [ ] **Step 2: Run failing onboarding test**

Run:

```powershell
npm test -- src/lib/supabase/onboarding.test.ts
```

Expected: FAIL because `onboarding.ts` does not exist.

- [ ] **Step 3: Implement workspace bootstrap**

Create `src/lib/supabase/onboarding.ts`:

```ts
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type TypedClient = SupabaseClient<Database>;

export async function ensurePersonalWorkspace(
  client: TypedClient,
  user: Pick<User, "id" | "email">,
): Promise<{ id: string }> {
  const { data: membership, error: membershipError } = await client
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (membership?.workspace_id) return { id: membership.workspace_id };

  const workspaceName = user.email ? `${user.email}'s Workspace` : "Personal Workspace";
  const { data: workspaceId, error: workspaceError } = await client.rpc("create_personal_workspace", {
    workspace_name: workspaceName,
  });

  if (workspaceError) throw workspaceError;
  if (!workspaceId) throw new Error("Workspace RPC did not return an id.");
  return { id: workspaceId };
}
```

- [ ] **Step 4: Implement active workspace helper**

Create `src/lib/supabase/workspace.ts`:

```ts
const STORAGE_KEY = "project-command-center:workspace-id";

export function getStoredWorkspaceId(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredWorkspaceId(workspaceId: string): void {
  window.localStorage.setItem(STORAGE_KEY, workspaceId);
}
```

- [ ] **Step 5: Add auth page**

Create `src/features/auth/auth-page.tsx`:

```tsx
import { Github, Mail } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../lib/supabase/client";

type Provider = "google" | "github" | "apple";

export function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signInWithPassword() {
    setIsSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsSubmitting(false);
    if (signInError) setError(signInError.message);
  }

  async function signInWithProvider(provider: Provider) {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4">
      <section className="w-full max-w-md rounded-lg border border-[#d8ded4] bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-[#17201a]">Project Command Center</h1>
        <p className="mt-2 text-sm text-[#5d6a61]">Sign in to plan your software projects.</p>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-md border border-[#cbd4c8] px-3 py-2 text-sm"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            type="email"
          />
          <input
            className="w-full rounded-md border border-[#cbd4c8] px-3 py-2 text-sm"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
          />
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#2f5d50] px-3 py-2 text-sm font-medium text-white"
            disabled={isSubmitting}
            onClick={signInWithPassword}
            type="button"
          >
            <Mail size={16} />
            Sign in with email
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button className="rounded-md border px-3 py-2 text-sm" onClick={() => signInWithProvider("google")} type="button">
            Google
          </button>
          <button className="flex items-center justify-center rounded-md border px-3 py-2 text-sm" onClick={() => signInWithProvider("github")} type="button">
            <Github size={16} />
          </button>
          <button className="rounded-md border px-3 py-2 text-sm" onClick={() => signInWithProvider("apple")} type="button">
            Apple
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-[#a33a2b]">{error}</p> : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Add callback page**

Create `src/features/auth/auth-callback-page.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase/client";
import { ensurePersonalWorkspace } from "../../lib/supabase/onboarding";
import { setStoredWorkspaceId } from "../../lib/supabase/workspace";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finishing sign in...");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) {
        setMessage("Unable to finish sign in.");
        return;
      }

      const workspace = await ensurePersonalWorkspace(supabase, data.user);
      setStoredWorkspaceId(workspace.id);
      navigate("/", { replace: true });
    });
  }, [navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f4] text-sm text-[#5d6a61]">
      {message}
    </main>
  );
}
```

- [ ] **Step 7: Add auth guard**

Create `src/features/auth/require-auth.tsx`:

```tsx
import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./use-auth";

export function RequireAuth({ children }: PropsWithChildren) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <main className="p-6 text-sm text-[#5d6a61]">Loading workspace...</main>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
```

- [ ] **Step 8: Add routes**

Create `src/app/routes.tsx`:

```tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthCallbackPage } from "../features/auth/auth-callback-page";
import { AuthPage } from "../features/auth/auth-page";
import { RequireAuth } from "../features/auth/require-auth";

function HomePage() {
  return (
    <RequireAuth>
      <main className="min-h-screen bg-[#f6f7f4] p-8">Dashboard coming next.</main>
    </RequireAuth>
  );
}

const router = createBrowserRouter([
  { path: "/auth", element: <AuthPage /> },
  { path: "/auth/callback", element: <AuthCallbackPage /> },
  { path: "/", element: <HomePage /> },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
```

Update `src/app/App.tsx`:

```tsx
import { AppRoutes } from "./routes";

export function App() {
  return <AppRoutes />;
}
```

- [ ] **Step 9: Verify**

Run:

```powershell
npm test -- src/lib/supabase/onboarding.test.ts
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm run build
```

Expected: onboarding test passes and build succeeds.

- [ ] **Step 10: Commit**

Run:

```powershell
git add src/features/auth src/lib/supabase src/app
git commit -m "Add Supabase authentication flow"
```

## Task 5: Add App Shell And Shared UI

**Files:**

- Create: `src/components/app-shell.tsx`
- Create: `src/components/empty-state.tsx`
- Create: `src/components/field.tsx`
- Create: `src/components/modal.tsx`
- Create: `src/components/status-pill.tsx`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Create shared status component**

Create `src/components/status-pill.tsx`:

```tsx
import { clsx } from "clsx";

const toneClass = {
  neutral: "bg-[#eef1eb] text-[#465249]",
  good: "bg-[#e1f2e7] text-[#24613b]",
  warning: "bg-[#fff0c2] text-[#745313]",
  danger: "bg-[#f9d9d4] text-[#8f2d20]",
};

export type StatusTone = keyof typeof toneClass;

export function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: StatusTone }) {
  return (
    <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", toneClass[tone])}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Create empty state**

Create `src/components/empty-state.tsx`:

```tsx
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#cbd4c8] bg-white p-6 text-center">
      <h2 className="text-sm font-semibold text-[#17201a]">{title}</h2>
      <p className="mt-1 text-sm text-[#5d6a61]">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 3: Create field wrapper**

Create `src/components/field.tsx`:

```tsx
import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-[#2d3830]">{label}</span>
      {children}
    </label>
  );
}
```

- [ ] **Step 4: Create modal wrapper**

Create `src/components/modal.tsx`:

```tsx
import type { ReactNode } from "react";

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4">
      <section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#17201a]">{title}</h2>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Create app shell**

Create `src/components/app-shell.tsx`:

```tsx
import { BarChart3, Brain, FolderKanban, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/notes", label: "Brainstorm", icon: Brain },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-[#f6f7f4] text-[#17201a]">
      <aside className="border-r border-[#d8ded4] bg-white px-4 py-5">
        <h1 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#2f5d50]">Command Center</h1>
        <nav className="mt-6 grid gap-1">
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  isActive ? "bg-[#e5eee8] text-[#1f463c]" : "text-[#5d6a61] hover:bg-[#f1f4ef]"
                }`
              }
              key={item.to}
              to={item.to}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Wrap authenticated routes with shell**

Update `src/app/routes.tsx` so `HomePage` returns:

```tsx
import { AppShell } from "../components/app-shell";

function HomePage() {
  return (
    <RequireAuth>
      <AppShell>
        <main>Dashboard coming next.</main>
      </AppShell>
    </RequireAuth>
  );
}
```

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm run build
git add src/components src/app/routes.tsx
git commit -m "Add authenticated app shell"
```

Expected: build succeeds before commit.

## Task 6: Add Project Queries, Pages, And Create Flow

**Files:**

- Create: `src/features/projects/projects.queries.ts`
- Create: `src/features/projects/project-form.tsx`
- Create: `src/features/projects/projects-page.tsx`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Write project query tests**

Create `src/features/projects/projects.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { projectHealthTone } from "./projects.queries";

describe("projectHealthTone", () => {
  it("maps health values to visual tones", () => {
    expect(projectHealthTone("good")).toBe("good");
    expect(projectHealthTone("watch")).toBe("warning");
    expect(projectHealthTone("at_risk")).toBe("danger");
    expect(projectHealthTone("blocked")).toBe("danger");
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm test -- src/features/projects/projects.test.ts
```

Expected: FAIL because `projectHealthTone` does not exist.

- [ ] **Step 3: Implement project queries**

Create `src/features/projects/projects.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatusTone } from "../../components/status-pill";
import type { Database, ProjectHealth, ProjectPriority, ProjectStatus } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface CreateProjectInput {
  workspaceId: string;
  userId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  health: ProjectHealth;
  repositoryUrl?: string;
}

export function projectHealthTone(health: ProjectHealth): StatusTone {
  if (health === "good") return "good";
  if (health === "watch") return "warning";
  return "danger";
}

export async function listProjects(client: Client, workspaceId: string) {
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createProject(client: Client, input: CreateProjectInput) {
  const { data, error } = await client
    .from("projects")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      name: input.name,
      description: input.description || null,
      status: input.status,
      priority: input.priority,
      health: input.health,
      repository_url: input.repositoryUrl || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Implement project form**

Create `src/features/projects/project-form.tsx` with controlled fields for `name`, `description`, `repositoryUrl`, `status`, `priority`, and `health`. On submit, call `onSubmit` with this object:

```ts
{
  name,
  description,
  repositoryUrl,
  status,
  priority,
  health
}
```

Use select options exactly:

```ts
const statuses = ["active", "paused", "completed", "archived"] as const;
const priorities = ["low", "medium", "high", "critical"] as const;
const healthValues = ["good", "watch", "at_risk", "blocked"] as const;
```

- [ ] **Step 5: Implement projects page**

Create `src/features/projects/projects-page.tsx`. It should:

- Read auth via `useAuth()`.
- Read workspace id via `getStoredWorkspaceId()`.
- Use `useQuery` with key `["projects", workspaceId]` and `listProjects`.
- Use `useMutation` with `createProject`.
- Render an `EmptyState` when there are no projects.
- Render project rows with `StatusPill` for health and priority.

- [ ] **Step 6: Add projects route**

Update `src/app/routes.tsx` with:

```tsx
{ path: "/projects", element: <ProtectedShell><ProjectsPage /></ProtectedShell> }
```

Also create a local helper in `routes.tsx`:

```tsx
function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
```

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm test -- src/features/projects/projects.test.ts
npm run build
git add src/features/projects src/app/routes.tsx
git commit -m "Add project list and create flow"
```

Expected: tests and build pass.

## Task 7: Add Work Items, Subtasks, And Project Workspace

**Files:**

- Create: `src/features/work-items/work-items.queries.ts`
- Create: `src/features/work-items/work-item-form.tsx`
- Create: `src/features/work-items/subtask-list.tsx`
- Create: `src/features/work-items/kanban-board.tsx`
- Create: `src/features/projects/project-workspace-page.tsx`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Write kanban grouping test**

Create `src/features/work-items/work-items.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupWorkItemsByStatus } from "./work-items.queries";

describe("groupWorkItemsByStatus", () => {
  it("creates every board column even when no cards exist", () => {
    const grouped = groupWorkItemsByStatus([]);
    expect(Object.keys(grouped)).toEqual(["backlog", "ready", "in_progress", "blocked", "review", "done"]);
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm test -- src/features/work-items/work-items.test.ts
```

Expected: FAIL because the query module does not exist.

- [ ] **Step 3: Implement work item queries**

Create `src/features/work-items/work-items.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProjectPriority, WorkItemStatus } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export const workItemStatuses = ["backlog", "ready", "in_progress", "blocked", "review", "done"] as const;

export function groupWorkItemsByStatus(items: WorkItem[]) {
  return workItemStatuses.reduce<Record<WorkItemStatus, WorkItem[]>>((grouped, status) => {
    grouped[status] = items.filter((item) => item.status === status);
    return grouped;
  }, {} as Record<WorkItemStatus, WorkItem[]>);
}

export async function listWorkItems(client: Client, projectId: string) {
  const { data, error } = await client
    .from("work_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createWorkItem(
  client: Client,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    title: string;
    description?: string;
    priority: ProjectPriority;
    status: WorkItemStatus;
  },
) {
  const { data, error } = await client
    .from("work_items")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      status: input.status,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkItemStatus(client: Client, id: string, status: WorkItemStatus) {
  const { data, error } = await client
    .from("work_items")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Implement work item form and board**

Create `work-item-form.tsx` for title, description, status, and priority. Create `kanban-board.tsx` that receives `items`, groups them with `groupWorkItemsByStatus`, and renders six stable columns.

Column labels:

```ts
const labels = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};
```

- [ ] **Step 5: Implement subtask list**

Create `src/features/work-items/subtask-list.tsx` with:

```tsx
export function SubtaskList() {
  return (
    <section className="rounded-lg border border-[#d8ded4] bg-white p-4">
      <h3 className="text-sm font-semibold">Subtasks</h3>
      <p className="mt-1 text-sm text-[#5d6a61]">Subtask creation is shown in the card detail flow after the board lands.</p>
    </section>
  );
}
```

- [ ] **Step 6: Implement project workspace page**

Create `src/features/projects/project-workspace-page.tsx` with route param `projectId`, query `listWorkItems`, and tabs for `Board`, `Tasks`, `Notes`, `Milestones`, and `Review`. In this task, only `Board` needs live content; other tabs can render named empty panels.

- [ ] **Step 7: Add project workspace route**

Update `src/app/routes.tsx`:

```tsx
{ path: "/projects/:projectId", element: <ProtectedShell><ProjectWorkspacePage /></ProtectedShell> }
```

- [ ] **Step 8: Verify and commit**

Run:

```powershell
npm test -- src/features/work-items/work-items.test.ts
npm run build
git add src/features/work-items src/features/projects/project-workspace-page.tsx src/app/routes.tsx
git commit -m "Add project workspace kanban board"
```

## Task 8: Add Notes, Milestones, And Weekly Reviews

**Files:**

- Create: `src/features/notes/notes.queries.ts`
- Create: `src/features/notes/note-form.tsx`
- Create: `src/features/notes/notes-page.tsx`
- Create: `src/features/reviews/reviews.queries.ts`
- Create: `src/features/reviews/review-form.tsx`
- Create: `src/features/reviews/reviews-panel.tsx`
- Modify: `src/features/projects/project-workspace-page.tsx`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Write note type label test**

Create `src/features/notes/notes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { noteTypeLabel } from "./notes.queries";

describe("noteTypeLabel", () => {
  it("formats note types for display", () => {
    expect(noteTypeLabel("idea")).toBe("Idea");
    expect(noteTypeLabel("at_risk" as never)).toBe("at_risk");
  });
});
```

- [ ] **Step 2: Implement notes queries**

Create `src/features/notes/notes.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NoteType } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export function noteTypeLabel(noteType: NoteType): string {
  const labels: Record<NoteType, string> = {
    idea: "Idea",
    question: "Question",
    decision: "Decision",
    risk: "Risk",
    reference: "Reference",
  };
  return labels[noteType] ?? noteType;
}

export async function listNotes(client: Client, workspaceId: string, projectId?: string) {
  let query = client
    .from("notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Add note form and notes page**

Create `note-form.tsx` with fields `note_type`, `title`, `body`, and comma-separated `tags`. Create `notes-page.tsx` with workspace-scoped note list and type filters.

Use note type options:

```ts
const noteTypes = ["idea", "question", "decision", "risk", "reference"] as const;
```

- [ ] **Step 4: Add review queries**

Create `src/features/reviews/reviews.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProjectHealth } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function listWeeklyReviews(client: Client, workspaceId: string, projectId?: string) {
  let query = client
    .from("weekly_reviews")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("week_start", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createWeeklyReview(
  client: Client,
  input: {
    workspaceId: string;
    projectId?: string;
    userId: string;
    weekStart: string;
    wins?: string;
    blockers?: string;
    nextFocus?: string;
    health?: ProjectHealth;
  },
) {
  const { data, error } = await client
    .from("weekly_reviews")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId || null,
      created_by: input.userId,
      week_start: input.weekStart,
      wins: input.wins || null,
      blockers: input.blockers || null,
      next_focus: input.nextFocus || null,
      health: input.health || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 5: Add review components**

Create `review-form.tsx` with fields `weekStart`, `wins`, `blockers`, `nextFocus`, and `health`. Create `reviews-panel.tsx` that renders recent reviews and a create form.

- [ ] **Step 6: Wire notes and review routes**

Update `src/app/routes.tsx`:

```tsx
{ path: "/notes", element: <ProtectedShell><NotesPage /></ProtectedShell> }
```

Update `project-workspace-page.tsx` so the `Notes` tab renders project-filtered notes and `Review` renders `ReviewsPanel`.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm test -- src/features/notes/notes.test.ts
npm run build
git add src/features/notes src/features/reviews src/features/projects/project-workspace-page.tsx src/app/routes.tsx
git commit -m "Add structured notes and weekly reviews"
```

## Task 9: Add Dashboard Queries And Page

**Files:**

- Create: `src/features/dashboard/dashboard.queries.ts`
- Create: `src/features/dashboard/dashboard-page.tsx`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Write dashboard priority test**

Create `src/features/dashboard/dashboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sortPriorityWork } from "./dashboard.queries";

describe("sortPriorityWork", () => {
  it("orders critical work before high and medium work", () => {
    const items = [
      { id: "1", priority: "medium", updated_at: "2026-06-01T00:00:00Z" },
      { id: "2", priority: "critical", updated_at: "2026-06-01T00:00:00Z" },
      { id: "3", priority: "high", updated_at: "2026-06-01T00:00:00Z" },
    ];

    expect(sortPriorityWork(items as never).map((item) => item.id)).toEqual(["2", "3", "1"]);
  });
});
```

- [ ] **Step 2: Implement dashboard queries**

Create `src/features/dashboard/dashboard.queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProjectPriority } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

const priorityRank: Record<ProjectPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortPriorityWork<T extends { priority: ProjectPriority; updated_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export async function getDashboardData(client: Client, workspaceId: string) {
  const [projects, workItems, milestones, decisions] = await Promise.all([
    client.from("projects").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
    client.from("work_items").select("*").eq("workspace_id", workspaceId).neq("status", "done"),
    client.from("milestones").select("*").eq("workspace_id", workspaceId).is("completed_at", null).order("target_date", { ascending: true }),
    client.from("notes").select("*").eq("workspace_id", workspaceId).eq("note_type", "decision").order("updated_at", { ascending: false }).limit(5),
  ]);

  if (projects.error) throw projects.error;
  if (workItems.error) throw workItems.error;
  if (milestones.error) throw milestones.error;
  if (decisions.error) throw decisions.error;

  const activeWork = workItems.data as WorkItem[];

  return {
    projects: projects.data,
    priorityWork: sortPriorityWork(activeWork).slice(0, 8),
    blockedWork: activeWork.filter((item) => item.status === "blocked"),
    upcomingMilestones: milestones.data.slice(0, 8),
    recentDecisions: decisions.data,
  };
}
```

- [ ] **Step 3: Implement dashboard page**

Create `src/features/dashboard/dashboard-page.tsx` with:

- Header "Dashboard".
- Four sections: priority work, blocked work, upcoming milestones, recent decisions.
- Project health summary cards.
- Empty states for each section.

- [ ] **Step 4: Route dashboard as home**

Update `src/app/routes.tsx` so `/` renders:

```tsx
<ProtectedShell>
  <DashboardPage />
</ProtectedShell>
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/features/dashboard/dashboard.test.ts
npm run build
git add src/features/dashboard src/app/routes.tsx
git commit -m "Add cross-project dashboard"
```

## Task 10: Add Settings And Sign Out

**Files:**

- Create: `src/features/settings/settings-page.tsx`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Implement settings page**

Create `src/features/settings/settings-page.tsx`:

```tsx
import { LogOut } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/use-auth";

export function SettingsPage() {
  const { user } = useAuth();

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <section>
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="mt-4 rounded-lg border border-[#d8ded4] bg-white p-4">
        <p className="text-sm text-[#5d6a61]">Signed in as</p>
        <p className="mt-1 text-sm font-medium">{user?.email}</p>
        <button
          className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          onClick={signOut}
          type="button"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add settings route**

Update `src/app/routes.tsx`:

```tsx
{ path: "/settings", element: <ProtectedShell><SettingsPage /></ProtectedShell> }
```

- [ ] **Step 3: Verify and commit**

Run:

```powershell
npm run build
git add src/features/settings src/app/routes.tsx
git commit -m "Add settings and sign out"
```

## Task 11: Add Playwright Smoke Test

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Add Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

- [ ] **Step 2: Add unauthenticated smoke test**

Create `tests/e2e/smoke.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("unauthenticated user sees auth screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Project Command Center" })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toBeVisible();
});
```

- [ ] **Step 3: Verify and commit**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm run e2e
npm run build
git add playwright.config.ts tests/e2e/smoke.spec.ts
git commit -m "Add browser smoke test"
```

Expected: Playwright passes against the unauthenticated auth screen.

## Task 12: Add Vercel Deployment Readiness

**Files:**

- Create: `vercel.json`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add Vercel config for Vite SPA routing**

Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

- [ ] **Step 2: Confirm public env template**

Ensure `.env.example` contains exactly these Vite-exposed Supabase values:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

These values are intentionally public client configuration. Do not add Supabase service-role keys or other secrets to Vite-exposed variables.

- [ ] **Step 3: Document Vercel setup**

Add to `README.md`:

~~~md
## Vercel Deployment

This app is intended to deploy on Vercel as a Vite React project.

Required Vercel environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Configure both variables in Vercel for Development, Preview, and Production. Use separate Supabase projects or branches for Preview and Production if you want preview deployments isolated from production data.

Recommended workflow:

1. Connect the Git repository to Vercel.
2. Set the framework preset to Vite.
3. Use `npm run build` as the build command.
4. Use `dist` as the output directory.
5. Add the Supabase OAuth callback URLs in the Supabase dashboard:
   - Local: `http://localhost:5173/auth/callback`
   - Preview: `https://<preview-domain>/auth/callback`
   - Production: `https://<production-domain>/auth/callback`

Local Vercel verification:

```powershell
npm install -g vercel
vercel pull --yes
vercel build
```
~~~

- [ ] **Step 4: Verify Vercel build config locally**

Run:

```powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'
npm run build
```

Expected: Vite builds to `dist/` and no route-specific files are required because `vercel.json` rewrites browser routes to `index.html`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add vercel.json .env.example README.md
git commit -m "Add Vercel deployment configuration"
```

## Task 13: Final Verification And README

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Update README run instructions**

Add:

~~~md
## Development

Copy `.env.example` to `.env.local` and fill in:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Run the app:

```powershell
npm install
npm run dev
```

Verify locally:

```powershell
npm test
npm run build
npm run e2e
```
~~~

- [ ] **Step 2: Run full local verification**

Run:

```powershell
npm test
npm run build
npm run e2e
```

Expected: all commands pass.

- [ ] **Step 3: Start dev server**

Run:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: Vite reports a local URL, normally `http://127.0.0.1:5173/`.

- [ ] **Step 4: Manual browser smoke**

Open the local URL and verify:

- Auth page renders.
- Sidebar renders after a real Supabase sign-in.
- Project create flow creates a project.
- Kanban card create flow creates a work item.
- Notes page creates an idea, decision, risk, question, or reference.
- Dashboard reflects created project data.

- [ ] **Step 5: Commit**

Run:

```powershell
git add README.md
git commit -m "Document development workflow"
```

## Self-Review

Spec coverage:

- Dashboard: covered in Task 9.
- Projects and project workspace: covered in Tasks 6 and 7.
- Kanban cards and subtasks: covered in Task 7.
- Structured notes: covered in Task 8.
- Weekly reviews: covered in Task 8.
- Settings and auth account basics: covered in Tasks 4 and 10.
- Supabase Auth and workspace bootstrap: covered in Task 4.
- Supabase SQL, RLS, grants, and indexes: covered in Task 2 through the approved spec SQL migration.
- Browser smoke verification: covered in Task 11 and Task 13.
- Vercel deployment configuration and environment setup: covered in Task 12.

Known execution notes:

- The SQL migration should be applied to a Supabase branch or local Supabase database before using real credentials.
- OAuth providers must be configured in the Supabase dashboard with the app callback URL before Google, GitHub, and Apple sign-in can complete.
- Raw Supabase-generated types should be written to `src/lib/supabase/generated.types.ts`; preserve or reapply the grant-aware, narrowed app-facing `src/lib/supabase/database.types.ts` instead of replacing it directly.
- Vercel preview and production deployments need `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` configured before auth or data requests can work.
