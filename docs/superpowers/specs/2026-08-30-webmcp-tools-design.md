# Agent tools: Orbit Flo speaks WebMCP

**Built for the WebMCP Devpost challenge (deadline Sep 3, 1pm PDT — four days
including today), and worth keeping afterwards regardless.** Branched from
`main` at `ce964cf`.

## The idea

WebMCP lets a web page register tools that a browser-hosted agent can call —
`document.modelContext.registerTool(...)`, executing in-page, in the user's
session. Orbit Flo is unusually well-placed for this:

- **Every domain operation is already a plain async function** taking
  `(client, workspaceId, ...)` — not a hook. Tools wrap them directly.
- **`supabase` and `queryClient` are module singletons**, importable from a
  non-React module.
- **RLS is the security boundary, and it is machine-verified.** The agent goes
  through the same authenticated client as the user's mouse. The CI privilege
  guard (PR #56) proves the grants; the agent cannot exceed them by
  construction, not by prompt.

The demo moment this buys: the agent creates a task and **the card appears on
the kanban board live**, because each mutating tool ends with
`queryClient.invalidateQueries(...)`. Human and agent share one workspace, one
session, one screen — which is the hackathon's theme, verbatim.

## API facts, verified today rather than assumed

- Probed a real Chrome 148: **no `modelContext` on `document`, `navigator`, or
  `window`** — the API is flag-gated. Judges run "Chrome with WebMCP enabled",
  so the app must **feature-detect and no-op** when it is absent.
- The canonical surface, from the webmachinelearning/webmcp explainer:
  `document.modelContext.registerTool(def, { signal })`, where `def.execute`
  receives parsed input and returns `{ content: [{ type: "text", text }] }`.
  The `signal` is an `AbortController` signal — which maps exactly onto a React
  effect cleanup.
- Types ship as the **`webmcp-types`** npm package (types only, devDependency).
  No polyfill exists; none is needed given feature detection.

## Design

### One module, one mount point

**`src/features/agent/agent-tools.ts`** — pure tool definitions. Each tool is a
name, description, JSON schema, and an `execute` that (a) calls an existing
domain function with the singleton `supabase` client and the current workspace
id, (b) invalidates the relevant query keys, (c) returns a short text result
the agent can read aloud. No new data paths: if a tool needs something the
domain layer cannot already do, the tool is out of scope.

**`src/features/agent/use-agent-tools.ts`** — a hook mounted once inside the
authenticated shell. When `document.modelContext` exists, it registers every
tool with an `AbortController` whose abort is the effect cleanup; when the
workspace changes, the effect re-runs and re-registers with the new id. When
the API is absent (every current browser without the flag, and jsdom), it does
nothing.

**`src/components/app-shell.tsx`** gains one line mounting the hook. That is
the entire UI footprint.

### The seven tools

| Tool | Wraps | Invalidates |
|---|---|---|
| `list_projects` | `listProjects` | — |
| `get_flight_plan` | `getDailyMissionControlData` | — |
| `create_task` | `createWorkItem` | work-items |
| `move_task` | `updateWorkItemStatus` | work-items |
| `search_workspace` | `searchWorkspace` | — |
| `capture_thought` | `createCapture` | captures/inbox |
| `complete_plan_item` | `completeDailyPlanItem` | daily plan |

`complete_plan_item` is chosen deliberately: completing a plan item fires the
existing Ignite animation, so an agent action produces a visible celebration —
the strongest three-seconds-of-video in the set.

**Deliberately excluded:** anything destructive or administrative —
`deleteWorkspace`, `removeMember`, role changes, invitations. An agent that
*cannot* do the dangerous things is a feature of the submission, and RLS plus
the column grants enforce the boundary regardless of what the tool layer
exposes.

### Workspace context

Tools need the current workspace id. The hook reads it from the same source the
shell uses and passes it into the tool definitions at registration time;
switching workspaces aborts and re-registers. A no-workspace state is
unreachable by construction: the hook mounts inside `AppShell`, which renders
only inside `WorkspaceGate`, so `useWorkspaceId()` always has a value there.
(The spec originally promised a text fallback for that case; what shipped is
stronger - the state cannot occur.)

### Errors

Domain functions throw Supabase errors. Each `execute` catches and returns the
message as text — an agent that reads "row-level security policy violation"
tells a truthful story about the boundary, which is better for the demo than a
silent failure and better for the user than a crash.

## Judge access (decided)

A **seeded demo account**, credentials published in the Devpost submission
text. The workspace is pre-seeded with projects, tasks, notes and a daily plan
that demo well. No guest-mode engineering — new auth surface built under
deadline pressure is where rushed code bites. RLS confines the account to its
own workspace.

## Repo (decided)

A **fresh public repo with a clean snapshot** of the current tree, root MIT
`LICENSE`, README with run instructions and the WebMCP section. The private
repo and its history stay private — no under-pressure secret audit of months of
commits. `.env.example` is checked before the snapshot goes out.

## Files

- Create `src/features/agent/agent-tools.ts` and its test
- Create `src/features/agent/use-agent-tools.ts` and its test
- Modify `src/components/app-shell.tsx` — one mount line
- Add devDependency `webmcp-types`
- Create `src/types/webmcp.d.ts` only if `webmcp-types` proves wrong or absent

No schema change, no new tables, no new policies. The only runtime surface
added is tool registration.

## Testing

- **Tool definitions are testable without a browser.** A fake
  `document.modelContext` — a plain object recording registrations — is an
  honest stub here, unlike mocking WebGL: the API is pure JS surface, and the
  thing under test is *our* wiring (names, schemas, that `execute` calls the
  domain function and invalidates the right keys), not the browser's agent.
- **The absent-API path is tested**: no `document.modelContext` → no
  registration, no throw. This is the path every current browser takes.
- **Re-registration on workspace change** is tested via the recorded abort +
  re-register sequence.
- **`execute` error path**: a domain function that throws produces a text
  result containing the message, not an unhandled rejection.
- The full suite must stay at 810 passing, no existing test modified.
- **The end-to-end rehearsal is manual and scheduled for Monday**: real Chrome
  with the WebMCP flag, real agent, full demo path. The first complete
  integration test does not happen on submission day.

## Risks

- **Nobody on this machine can run the real API today** — Chrome 148 here has
  no flag exposed through the pane. Everything up to the Monday rehearsal rests
  on matching the explainer exactly; the feature-detect boundary means the
  worst case is tools that never register, not a broken app.
- **The rules' pre-existing-project clause is still unverified.** The user is
  checking it. If pre-existing projects are barred, this work is still a
  feature — the deadline pressure evaporates and the schedule reverts to
  normal.
- **Four days, zero slack.** The cut line is final: seven tools, no guest mode,
  no new visuals. Anything that threatens Tuesday's video gets dropped, not
  compressed.

## Out of scope

Notes/milestone/mind-map tools, `provideContext` page-state streaming,
`toolchange` dynamics, guest mode, any visual work, and the motion-intensity
control (deferred a fifth time, noted without pride).
