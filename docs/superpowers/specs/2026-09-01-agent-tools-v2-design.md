# Agent tools v2: close the loops the demo advertises

**Two days before the Devpost deadline.** Branched from `main` at `b44e01a`.
Everything here is optional polish behind one gate: **if the user's rehearsal
slips or finds problems, this branch is cut without ceremony.**

## The problem, honestly

The seeded demo inbox contains a capture titled *"Ask the agent to triage this
inbox"* — an invitation the tool set cannot honour. The agent can neither read
the inbox nor turn a capture into a task. Likewise it can read and complete
today's flight plan but cannot *build* it. The two best demo sentences —
"triage my inbox" and "plan my day" — both dead-end.

Separately: a judge whose agent-browser opens the live URL sees zero tools
until after sign-in. The storefront says the product speaks WebMCP; the
storefront itself does not.

## What ships (scope decided with the user)

### 1. Three tools closing the loops — total becomes ten

| Tool | Wraps (all existing, signatures verified) |
|---|---|
| `list_inbox` | `listInboxCaptures(client, workspaceId)` — unprocessed only |
| `file_capture_as_task` | `createWorkItem` then `updateCapture({ processedAt, projectId })` — the exact sequence `inbox-page.tsx` runs, mirrored not reinvented |
| `add_to_flight_plan` | `getOrCreateDailyPlan({ workspaceId, userId, planDate })` then `addDailyPlanItem({ workspaceId, dailyPlanId, workItemId, sortOrder, isPrimary: false })` |

Rules carried from v1, unchanged: workspace and user ids only from context;
required text validated, never coerced; every `execute` guarded so errors are
text results; mutations invalidate the caches the UI reads (`inbox-captures`,
`work-items`, `workspace-work-items`, `daily-mission-control`). The
seven-tools `toEqual` guards in both test files become ten-tools guards — the
same fence, moved deliberately.

`file_capture_as_task` requires a `projectId` (agent gets it from
`list_projects`), because the underlying flow requires one; a capture without
a project cannot become a task, and the tool says so in text rather than
guessing a project.

`add_to_flight_plan`'s `sortOrder` appends: current plan items length via
`getDailyMissionControlData`, which the module already imports.

### 2. The storefront speaks WebMCP

`LandingPage` registers **one** signed-out tool, `about_orbit_flo`: static
text — what the product is, that ten workspace tools appear after sign-in,
where the code lives. No Supabase touch, no auth, feature-detected exactly
like the app tools, `AbortController` on unmount so the tool vanishes when
the visitor navigates to sign-in and the workspace tools later take over.
Implemented as a small `useLandingAgentTool()` hook in the landing feature —
the shell's `useAgentTools` is untouched.

### 3. `readOnlyHint` annotations

`webmcp-types` defines `ToolAnnotations.readOnlyHint`. The read-only tools —
`list_projects`, `get_flight_plan`, `search_workspace`, `list_inbox`, and the
landing tool — declare it, so agent browsers can offer smarter permission UX.
Mutating tools declare nothing rather than a false `readOnlyHint: false`
comfort blanket. A test asserts the annotation sits on exactly the read-only
set — the truthfulness rule, again, as a fence.

## Files

- Modify `src/features/agent/agent-tools.ts` and its test — three tools,
  annotations, guards updated to ten
- Modify `src/features/agent/use-agent-tools.test.tsx` — the ten-tool list
- Create `src/features/landing/use-landing-agent-tool.ts` and test
- Modify `src/features/landing/landing-page.tsx` — one hook call

No schema change, no new dependency, no change to `use-agent-tools.ts` itself.

## Testing

Same honest lines as v1: the factory tested against mocked domain functions
(including: `file_capture_as_task` refuses a missing `projectId` in text;
the capture is marked processed only after the task exists), the landing hook
tested with the fake-registry pattern from `use-agent-tools.test.tsx`, the
absent-API path everywhere. Full suite must stay at 829 plus the new tests.
The Devpost writeup's "seven tools" copy updates to ten **after** this merges
— the submission text must never lead the code.

## Risks

- **The rehearsal has not happened.** This adds surface to an integration no
  real agent has touched. Mitigation: nothing here changes v1's registration
  path or the seven existing tools' behaviour; a rehearsal failure would
  implicate v1 machinery, not this.
- **The clock.** Half a day through the pipeline. The cut line is the whole
  branch, and the user knows it.

## Out of scope

`provideContext` (unverified API surface — not building against a guess with
two days left), notes/milestone tools, any UI change beyond the one hook call.
