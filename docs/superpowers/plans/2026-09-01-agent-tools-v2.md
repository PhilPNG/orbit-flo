# Agent Tools v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ten workspace tools instead of seven — closing the inbox-triage and plan-building loops the demo data advertises — plus a signed-out storefront tool and `readOnlyHint` annotations.

**Architecture:** Three additions to the existing `buildAgentTools` factory, following every v1 rule; a self-contained `useLandingAgentTool` hook on the landing page; annotations on exactly the read-only set, fenced by a test.

**Tech Stack:** React 19, TypeScript, TanStack Query, Supabase, `webmcp-types`.

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **829 tests pass.** The only existing tests that may change are the two tool-list guards (`agent-tools.test.ts`, `use-agent-tools.test.tsx`) — seven becomes ten, the re-register count 14 becomes 20 — and they must stay `toEqual` on full sorted lists.
- No new dependency. No change to `use-agent-tools.ts`.
- Workspace and user ids come only from context, never from agent input. Required text is validated, never coerced. Every `execute` is guarded. Mutations invalidate the caches the UI reads.

---

## Task 1: Everything

**Files:**
- Modify: `src/features/agent/agent-tools.ts`, `src/features/agent/agent-tools.test.ts`, `src/features/agent/use-agent-tools.test.tsx`
- Create: `src/features/landing/use-landing-agent-tool.ts`, `src/features/landing/use-landing-agent-tool.test.tsx`
- Modify: `src/features/landing/landing-page.tsx` — one hook call

**Interfaces:**
- Consumes (all verified in source): `listInboxCaptures(client, workspaceId)`; `updateCapture(client, { id, workspaceId, projectId?, processedAt?, ... })`; `getOrCreateDailyPlan(client, { workspaceId, userId, planDate })`; `addDailyPlanItem(client, { workspaceId, dailyPlanId, workItemId, sortOrder, isPrimary })`; `getDailyMissionControlData(client, workspaceId, planDate)` (already imported).
- Produces: `AgentTool` gains optional `annotations?: { readOnlyHint?: boolean }`; `export function useLandingAgentTool(): void`.

### Steps

- [ ] **Step 1: Extend the factory tests.** In `agent-tools.test.ts`:
  - Add to the `vi.mock` factories: `listInboxCaptures: vi.fn().mockResolvedValue([{ id: "c1", title: "Ask the agent to triage this inbox", type: "idea", body: null }])` and `updateCapture: vi.fn().mockResolvedValue({ id: "c1" })` in a new `../inbox/captures.queries` mock; `getOrCreateDailyPlan: vi.fn().mockResolvedValue({ id: "plan-1" })` and `addDailyPlanItem: vi.fn().mockResolvedValue({ id: "dpi-1" })` added to the existing `../daily/daily-plan.queries` mock (keep its other keys).
  - The tool-list guard becomes the sorted ten: `add_to_flight_plan, capture_thought, complete_plan_item, create_task, file_capture_as_task, get_flight_plan, list_inbox, list_projects, move_task, search_workspace`.
  - New case: `file_capture_as_task` with a `captureId` not in the unprocessed list returns text containing "capture" and calls neither `createWorkItem` nor `updateCapture`.
  - New case: a successful `file_capture_as_task` calls `createWorkItem` **before** `updateCapture` (assert with `mock.invocationCallOrder`), passes the capture's title, and invalidates `["inbox-captures"]`.
  - New case: `add_to_flight_plan` calls `getOrCreateDailyPlan` with the context workspace/user and today's plan date, then `addDailyPlanItem` with the returned plan id, and invalidates `["daily-mission-control"]`.
  - New case, the annotation fence: tools whose `annotations?.readOnlyHint === true`, sorted, equal exactly `["get_flight_plan", "list_inbox", "list_projects", "search_workspace"]`.

- [ ] **Step 2: Watch them fail**, then implement in `agent-tools.ts`:
  - Add `annotations?: { readOnlyHint?: boolean }` to `AgentTool`; add `annotations: { readOnlyHint: true }` to the four read-only tools. Mutating tools declare nothing.
  - `list_inbox` (read-only): wraps `listInboxCaptures`, returns up to 20 captures as `{ id, title, type, body }` JSON; empty → `"The inbox is empty."` Description tells the agent to use `file_capture_as_task` with a `projectId` from `list_projects`.
  - `file_capture_as_task`: input `{ captureId, projectId, dueDate? }`, both ids required (validated as non-empty strings, not coerced). Finds the capture via `listInboxCaptures`; missing → text refusal. Then **exactly the inbox page's sequence**: `createWorkItem({ workspaceId, projectId, userId, title: capture.title, description: capture.body ?? "", dueDate? })`, then `updateCapture({ id, workspaceId, projectId, processedAt: new Date().toISOString() })`. Invalidate `["inbox-captures"], ["work-items"], ["workspace-work-items"], ["daily-mission-control"]`. Result names the created task.
  - `add_to_flight_plan`: input `{ taskId }` required. `getOrCreateDailyPlan` with `formatPlanDate()`; `sortOrder` = today's `dailyPlanItems.length` from `getDailyMissionControlData`; `addDailyPlanItem({ ..., isPrimary: false })`. Invalidate `["daily-mission-control"]`. Result says the task is on today's plan.

- [ ] **Step 3: Update `use-agent-tools.test.tsx`** — the registered-names `toEqual` becomes the same sorted ten; the workspace-switch expectation becomes `registered.length` reaching **20**.

- [ ] **Step 4: The landing tool.** Create `use-landing-agent-tool.ts`: a hook with the same feature-detect + `AbortController` shape as `use-agent-tools.ts`, registering one tool `about_orbit_flo` (`annotations: { readOnlyHint: true }`), whose `execute` returns static text: what Orbit Flo is, that **ten** workspace tools appear after sign-in, and `https://github.com/PhilPNG/orbit-flo`. **No Supabase import anywhere in the file.** Test with the fake-registry pattern from `use-agent-tools.test.tsx`: absent API registers nothing and throws nothing; present API registers exactly `about_orbit_flo`; unmount aborts. Call the hook at the top of `LandingPage`.

- [ ] **Step 5: Verify and commit.**
  ```bash
  npm test -- --maxWorkers=2 agent-tools use-agent-tools use-landing-agent-tool landing-page
  npm test -- --maxWorkers=2
  npm run build
  ```
  Full suite: 829 plus the new tests, no other existing test modified. Commit everything with message `feat: ten agent tools, and a storefront that speaks WebMCP`.

## Self-review notes

The `invocationCallOrder` assertion is the one that matters in
`file_capture_as_task`: marking a capture processed before its task exists
would lose the capture on a mid-sequence failure. The annotation fence and the
ten-tool `toEqual` are the same fence-not-vibes discipline as v1. The landing
hook's no-Supabase rule keeps the storefront chunk clean and the CI trap
closed.
