import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { upsertDashboardWidgetPreferences } from "./dashboard-widgets.queries";
import { DashboardWidgetCustomizer, defaultDashboardWidgets, mergeDashboardWidgets } from "./dashboard-widget-customizer";

type QueryCall = {
  method: string;
  args: unknown[];
};

class FakePreferenceQuery {
  calls: QueryCall[] = [];

  constructor(private readonly response: { data: unknown; error: null }) {}

  select(...args: unknown[]) {
    this.calls.push({ method: "select", args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: "eq", args });
    return this;
  }

  maybeSingle() {
    this.calls.push({ method: "maybeSingle", args: [] });
    return this;
  }

  single() {
    this.calls.push({ method: "single", args: [] });
    return this;
  }

  update(...args: unknown[]) {
    this.calls.push({ method: "update", args });
    return this;
  }

  insert(...args: unknown[]) {
    this.calls.push({ method: "insert", args });
    return this;
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

describe("DashboardWidgetCustomizer", () => {
  it("toggles and reorders dashboard widgets", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DashboardWidgetCustomizer widgets={defaultDashboardWidgets} onChange={onChange} />);

    await user.click(screen.getByLabelText("Show Priority work"));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ key: "priority-work", isVisible: false })]));

    onChange.mockClear();
    await user.click(screen.getByRole("button", { name: "Move Blocked work up" }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: "project-health", sortOrder: 0 }),
      expect.objectContaining({ key: "blocked-work", sortOrder: 1 }),
      expect.objectContaining({ key: "priority-work", sortOrder: 2 }),
      expect.objectContaining({ key: "upcoming-milestones", sortOrder: 3 }),
      expect.objectContaining({ key: "recent-decisions", sortOrder: 4 }),
    ]);
  });

  it("applies saved widget visibility and order", () => {
    const widgets = mergeDashboardWidgets(defaultDashboardWidgets, [
      { widget_key: "blocked-work", is_visible: false, sort_order: 0 },
      { widget_key: "project-health", is_visible: true, sort_order: 1 },
    ]);

    expect(widgets[0]).toMatchObject({ key: "blocked-work", isVisible: false, sortOrder: 0 });
    expect(widgets[1]).toMatchObject({ key: "project-health", isVisible: true, sortOrder: 1 });
  });
});

describe("upsertDashboardWidgetPreferences", () => {
  it("updates existing preferences without workspace or user fields", async () => {
    const queries: FakePreferenceQuery[] = [];
    const existingPreference = {
      id: "preference-1",
      workspace_id: "workspace-1",
      user_id: "user-1",
      widget_key: "priority-work",
      is_visible: true,
      sort_order: 0,
      settings: {},
    };
    const client = {
      from() {
        const query = new FakePreferenceQuery({ data: existingPreference, error: null });
        queries.push(query);
        return query;
      },
    };

    await upsertDashboardWidgetPreferences(client as never, {
      workspaceId: "workspace-1",
      userId: "user-1",
      widgets: [{ widgetKey: "priority-work", isVisible: false, sortOrder: 2, settings: { compact: true } }],
    });

    expect(queries[1].calls).toContainEqual({
      method: "update",
      args: [{ is_visible: false, sort_order: 2, settings: { compact: true } }],
    });
  });
});
