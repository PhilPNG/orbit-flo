# Orbit Flo

A React, TypeScript, Vite, and Supabase workspace for managing personal software projects from idea through execution.

The app includes Orbit Flo branding, Supabase auth, a mission-control dashboard, project workspaces, Kanban work items, notes, weekly reviews, settings, unit tests, e2e smoke coverage, and Vercel deployment configuration.

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

`npm run e2e` requires the Supabase environment variables above; placeholder values are enough for the unauthenticated smoke test.

## Supabase

The initial schema lives in `supabase/migrations/202606280001_initial_project_command_center.sql`.

Onboarding is RPC-only: create the first workspace by calling `create_personal_workspace` with `supabase.rpc(...)`, not by issuing separate workspace and membership inserts.

Raw Supabase-generated types should be written to a separate base file, for example `src/lib/supabase/generated.types.ts`.
Use `npx supabase gen types typescript --local --schema public | Out-File -Encoding utf8 src/lib/supabase/generated.types.ts`.
Preserve or reapply the grant-aware, narrowed app-facing `src/lib/supabase/database.types.ts`; do not replace it directly with raw generated types unless a narrowing layer is added.

Before applying the migration to a live project:

1. Review the SQL in the migration.
2. Apply it in a Supabase branch or local Supabase database.
3. Run Supabase security and performance advisors.
4. Verify that RLS blocks access across workspaces with two test users.

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
5. Add the Supabase Auth redirect URLs in the Supabase dashboard:
   - Local: `http://localhost:5173/auth/callback`
   - Preview: `https://<preview-domain>/auth/callback`
   - Production: `https://<production-domain>/auth/callback`

Local Vercel verification:

```powershell
npm install -g vercel
vercel pull --yes
vercel build
```

## WebMCP: an agent can work this app

Orbit Flo registers seven tools with the browser's WebMCP surface
(`document.modelContext`), so a browser-hosted agent can operate the app
through your own signed-in session — and you watch its work land on your
board live.

| Tool | What it does |
| --- | --- |
| `list_projects` | Projects in the current workspace, with ids |
| `get_flight_plan` | Today's daily plan and due work |
| `create_task` | New task on a project's board |
| `move_task` | Move a task between status columns |
| `search_workspace` | Search tasks, notes, projects, milestones |
| `capture_thought` | Drop a thought into the inbox |
| `complete_plan_item` | Complete a flight-plan item (with the launch animation) |

Three design points worth knowing:

- **Row-level security is the boundary, not the tool layer.** The agent uses
  the same authenticated Supabase client as your mouse. What it can touch is
  decided by the database's policies and grants, which are asserted in CI on
  every pull request (`docs/verification/grants-assertions.sql`).
- **Nothing destructive is exposed.** No deletes, no member management, no
  role changes — and a test pins the tool list, so adding an eighth tool is a
  failing build rather than quiet scope creep.
- **Everything is feature-detected.** In a browser without WebMCP the app
  registers nothing and behaves exactly as before. Registration is scoped by
  an `AbortController`, so switching workspaces re-registers the tools against
  the workspace on screen.

To try it, use a browser with WebMCP enabled (for example Chrome with the
WebMCP flag) and ask its agent to "list my projects" or "add a task to the
launch project" while the app is open. The registration code lives in
`src/features/agent/`.

### Demo account

A seeded demo account exists for reviewers; its credentials are published in
the Devpost submission text rather than here. To seed or reset it yourself
against your own Supabase project:

```bash
node scripts/seed-demo.mjs
```

It rebuilds the demo user and workspace from scratch on every run.
