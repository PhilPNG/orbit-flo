import { describe, expect, it, vi } from "vitest";
import { ensureRecurringOccurrences } from "./recurrence.queries";

function ruleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    title: "Daily standup",
    description: null,
    priority: "medium",
    pattern: "daily",
    weekdays: [],
    day_of_month: null,
    planned_at: null,
    planned_minutes: null,
    is_active: true,
    generated_through: null,
    ...overrides,
  };
}

function createClient(rules: Array<Record<string, unknown>>, insertError: unknown = null) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];

  const client = {
    from: vi.fn((table: string) => {
      if (table === "recurrence_rules") {
        const builder = {
          select: vi.fn((..._args: unknown[]) => builder),
          eq: vi.fn((..._args: unknown[]) => builder),
          order: vi.fn(() => Promise.resolve({ data: rules, error: null })),
          update: vi.fn((payload: unknown) => {
            updates.push(payload);
            return {
              eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
            };
          }),
        };

        return builder;
      }

      return {
        insert: vi.fn((payload: unknown) => {
          inserts.push(payload);
          return Promise.resolve({ error: insertError });
        }),
      };
    }),
  };

  return { client, inserts, updates };
}

describe("ensureRecurringOccurrences", () => {
  it("creates today's occurrence inheriting the rule fields", async () => {
    const { client, inserts } = createClient([
      ruleRow({ planned_at: "09:00:00", planned_minutes: 15, generated_through: "2026-08-08" }),
    ]);

    const result = await ensureRecurringOccurrences(client as never, "workspace-1", "2026-08-09", "user-1");

    expect(result.created).toBe(1);
    expect(inserts[0]).toMatchObject({
      workspace_id: "workspace-1",
      project_id: "project-1",
      title: "Daily standup",
      priority: "medium",
      status: "ready",
      due_date: "2026-08-09",
      planned_at: "09:00:00",
      planned_minutes: 15,
      recurrence_rule_id: "rule-1",
      occurrence_date: "2026-08-09",
    });
  });

  it("reports occurrences missed since the watermark", async () => {
    const { client } = createClient([ruleRow({ generated_through: "2026-08-05" })]);

    const result = await ensureRecurringOccurrences(client as never, "workspace-1", "2026-08-09", "user-1");

    expect(result.missed).toBe(3);
  });

  it("skips a rule already generated through today", async () => {
    const { client, inserts } = createClient([ruleRow({ generated_through: "2026-08-09" })]);

    const result = await ensureRecurringOccurrences(client as never, "workspace-1", "2026-08-09", "user-1");

    expect(inserts).toHaveLength(0);
    expect(result).toEqual({ created: 0, missed: 0 });
  });

  it("advances the watermark to today", async () => {
    const { client, updates } = createClient([ruleRow({ generated_through: "2026-08-08" })]);

    await ensureRecurringOccurrences(client as never, "workspace-1", "2026-08-09", "user-1");

    expect(updates[0]).toMatchObject({ generated_through: "2026-08-09" });
  });

  it("treats a unique violation as another device winning the race", async () => {
    const { client } = createClient([ruleRow({ generated_through: "2026-08-08" })], { code: "23505" });

    const result = await ensureRecurringOccurrences(client as never, "workspace-1", "2026-08-09", "user-1");

    expect(result.created).toBe(0);
  });

  it("does not create an occurrence on a day the pattern skips", async () => {
    // 2026-08-09 is a Sunday.
    const { client, inserts } = createClient([
      ruleRow({ pattern: "weekdays", generated_through: "2026-08-08" }),
    ]);

    await ensureRecurringOccurrences(client as never, "workspace-1", "2026-08-09", "user-1");

    expect(inserts).toHaveLength(0);
  });
});
