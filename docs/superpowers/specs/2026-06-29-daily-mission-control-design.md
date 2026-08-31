# Daily Mission Control Design

## Summary

Daily Mission Control is the next major Orbit Flo feature. It turns the app into a daily planning cockpit that helps a user decide what matters today, focus on a small flight plan, capture loose signals, and finish with a lightweight review.

The first version should prioritize personal power-user workflow and premium UI polish. Team collaboration and AI assistance remain future layers.

## Goals

- Make the first authenticated screen feel immediately useful every morning.
- Connect existing projects, work items, notes, milestones, and blocked work around a daily ritual.
- Keep daily planning lightweight: choose a small number of objectives, focus, capture, and review.
- Use the outer-space theme in a practical way through subtle motion, orbit progress, and mission language.
- Avoid destructive task behavior. A daily plan should sit on top of existing work rather than rewrite project data.

## Non-Goals

- Full team collaboration, assignment workflows, or shared daily plans.
- Deep Pomodoro customization or advanced time tracking.
- AI-generated plans or summaries.
- Calendar integration.
- Replacing the existing project workspace or kanban board.

## Core Experience

Daily Mission Control becomes the emotional center of the app. It answers three questions:

1. What should I do today?
2. Why does it matter?
3. What momentum am I building?

The page is organized around four zones:

- Launch Briefing: date, mission status, project load, overdue or blocked signals, and a recommended focus message.
- Today's Flight Plan: a curated list of 3-5 tasks for the day, including one primary focus item when the plan has at least one task.
- Quick Capture Dock: one fast input for tasks, notes, blockers, and ideas.
- Mission Momentum: progress rings, completion feedback, focus-state motion, and end-of-day review cues.

## Feature Set

### Daily Launch Plan

Users can create or update a plan for the current day. The plan contains 3-5 work items pulled from existing projects or created quickly from the daily page.

Expected behaviors:

- Add existing work items to today's plan.
- Quick-create a new work item from the plan.
- Mark one item as the primary focus, called the primary burn.
- Reorder plan items.
- Remove an item from today's plan without deleting the underlying work item.
- Show the source project, status, priority, and blocked state for each linked item.

### Quick Capture

Quick Capture gives the user one fast input for loose signals. A capture can be a task, note, idea, or blocker.

Expected behaviors:

- Create a capture without choosing a project.
- Optionally route a capture to a project.
- Optionally convert a task capture into a real work item.
- Keep unprocessed captures visible until the user routes or dismisses them.

### Focus Session

The user can launch a lightweight focus session from the primary daily item.

Expected behaviors:

- Show the active task, source project, and a compact timer.
- Support start, pause, complete, and skip.
- Use calm orbit motion to show active focus.
- Avoid advanced timer settings in the first version.

### End-Of-Day Review

The review turns the daily plan into a closing ritual.

Expected behaviors:

- Show completed, skipped, and unfinished plan items.
- Show captures created during the day.
- Ask for one short reflection: "What moved forward?"
- Let unfinished items roll into tomorrow or return to normal backlog.
- Store completion stats and reflection on the daily plan.

### Premium Motion Layer

Motion should support focus rather than distract from it.

Expected behaviors:

- The primary task has a subtle orbit halo or animated underline.
- Completing a task sends a small cyan/violet trail into the progress ring.
- Quick captures dock into the list with a short slide/fade animation.
- Focus mode dims surrounding UI and expands the active task into a cockpit panel.
- Empty states use brand language and immediate actions.

## UI Layout

The page should feel like a focused cockpit, not another generic dashboard.

Recommended layout:

- Top command band: date, mission status, completion ring, and primary action.
- Main column: Today's Flight Plan, with the primary task visually elevated.
- Right column: Quick Capture, blocked signals, upcoming milestones, and momentum stats.
- Secondary area: End-of-day review when the plan has activity or the day is closing.

Core actions should happen inline. Avoid modal-heavy workflows for adding, focusing, completing, skipping, or capturing.

## Data Model

Daily planning should be a layer over existing data.

### daily_plans

One row per workspace and date.

Fields:

- id
- workspace_id
- plan_date
- status: planned, active, completed
- reflection
- completed_count
- skipped_count
- created_at
- updated_at

### daily_plan_items

Links work items into a daily plan.

Fields:

- id
- daily_plan_id
- work_item_id
- sort_order
- is_primary
- state: planned, completed, skipped
- completed_at
- skipped_at
- created_at
- updated_at

### captures

Stores unprocessed signals from Quick Capture.

Fields:

- id
- workspace_id
- project_id
- work_item_id
- type: task, note, idea, blocker
- title
- body
- processed_at
- created_at
- updated_at

## Data Behavior

- Completing a daily plan item may offer to complete the linked work item, but should not silently change global task status without a clear user action.
- Skipping a daily plan item only affects the daily plan item.
- Removing a daily plan item does not delete the linked work item.
- Captured task signals can stay in the capture inbox until converted into work items.
- Captured blockers can populate a linked work item's blocked reason only after user confirmation.

## Component Boundaries

Recommended front-end units:

- DailyMissionControlPage: page shell, query orchestration, and layout.
- LaunchBriefing: date, status, signals, and primary action.
- FlightPlan: daily item list and ordering.
- FlightPlanItem: individual task display and actions.
- QuickCaptureDock: capture input and routing.
- FocusSessionPanel: active focus session UI.
- MissionMomentum: progress ring and daily stats.
- DailyReviewPanel: end-of-day reflection and rollover actions.

Recommended data modules:

- daily-plan.queries.ts for Supabase reads/writes.
- daily-plan.utils.ts for completion math, ordering, and plan status helpers.
- daily-plan.test.ts for behavior tests independent of React.

## Error Handling

- If there is no workspace, show the existing workspace empty state pattern.
- If today's plan fails to load, show a retryable panel rather than replacing the whole app shell.
- If adding an item fails, keep the user's selection visible and show an inline error.
- If Quick Capture fails, keep the typed content in place.
- If focus session state cannot be persisted, allow the local session to continue and show a warning.

## Testing

Recommended coverage:

- Unit tests for plan completion math, item ordering, and rollover rules.
- Query tests for creating a daily plan, adding/removing items, quick captures, and completing/skipping items.
- Component tests for empty, loading, error, active, and review states.
- E2E smoke path for an authenticated user seeing Daily Mission Control and adding a quick capture.

## Rollout Plan

Implement in three slices:

1. Daily plan foundation: tables, queries, page route, launch briefing, and flight plan.
2. Quick capture and focus session: capture inbox, primary focus behavior, and cockpit panel.
3. End-of-day review and premium motion: reflection, rollover, completion animations, and polished empty states.

## Product Decisions

- Daily Mission Control should replace the current authenticated dashboard at `/`. The existing dashboard sections can be folded into the new Launch Briefing and side panels instead of introducing a second top-level destination.
- Quick-created captures may remain unassigned. The unassigned capture inbox is part of the first version so users can collect signals without interrupting flow.
- Completing a daily item updates only the daily plan item by default. The UI should offer a clear secondary action to also complete the linked work item.
