# Command Palette, Inbox Triage, And Relevance Design

## Goal

Make OrbitFlo faster and calmer without changing the database schema. This pass adds a keyboard-first command palette, makes the Universal Inbox feel like a processing queue, and hides non-relevant work behind lightweight "Later" affordances.

## Scope

This implementation is limited to existing client-side data and Supabase tables:

- Use `captures` for quick capture and inbox triage.
- Use `work_items` status, priority, due date, and blocked reason for relevance.
- Use existing routes for navigation commands.
- Do not add migrations or new backend tables.

## Command Palette

Add a global command palette available from authenticated app screens with `Ctrl+K` and `Cmd+K`. The shell will expose a compact button or hint near the existing quick add area.

The palette will support:

- Route commands for Mission Control, Projects, Maps, Calendar, Inbox, Brainstorm, and Settings.
- Quick capture from the palette using the same parsing behavior as global quick add.
- Search-like filtering across command labels and descriptions.
- Keyboard-friendly open, close, filter, and select interactions.

The palette should feel like an accelerator, not another dashboard. It should be a modal surface with one search input, grouped results, and concise action labels.

## Inbox Triage

Refactor the Inbox page from repeated heavy cards into a queue-oriented triage surface.

Each capture should show its title, type, optional body, and a clear action set:

- Convert to task.
- Convert to note.
- Archive.

The selected capture should get the most detail. Secondary captures should remain compact. Task conversion should allow project, priority, due date, and starting status. Note conversion should allow project and note type when useful. Existing success and error handling remains.

## Smart Hide Until Relevant

Add a shared relevance helper for work items:

- Relevant: overdue, due today, due within the next seven days, high/critical priority, blocked, in progress, or review.
- Later: future work beyond seven days, low/medium backlog work without a due date, and completed work.

Use this helper in task-heavy views where information overload is most visible. Start with dashboard/project workspace surfaces that already list multiple tasks. Relevant work should appear first; later work should be collapsed behind a `Later` disclosure or a `Show later work` toggle.

## Components And Data Flow

- Add a small `command-palette` component under `src/components`.
- Extract global quick-add parsing into a reusable helper so the palette and shell quick add share behavior.
- Add a work item relevance utility near the work item feature code.
- Keep Supabase mutations inside existing query modules where possible.
- Invalidate the same query keys already used by quick add and inbox mutations.

## Error Handling

- Palette quick capture should show inline success and error text.
- Inbox conversion should preserve the selected capture and typed metadata if a mutation fails.
- Relevance grouping should be pure and safe for missing due dates or completed items.

## Testing

Add focused tests for:

- Palette opens with `Ctrl+K`, filters commands, navigates, and creates a capture.
- Inbox can convert captures with task metadata and archive from the queue UI.
- Relevance helper groups work items into relevant and later buckets.
- Existing route, inbox, and shell tests continue to pass.

## Non-Goals

- No new SQL commands.
- No AI command interpretation.
- No true snooze or `hide_until` persistence.
- No replacing the existing quick add until the palette proves useful.
