import { describe, expect, it, vi } from "vitest";
import { createWeeklyReview, listWeeklyReviews, reviewHealthLabel, weeklyReviewKeys } from "./reviews.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    insert: vi.fn(() => query),
    single: vi.fn(() => result),
  };

  return {
    client: {
      from: vi.fn(() => query),
    },
    query,
  };
}

describe("weeklyReviewKeys", () => {
  it("keeps project reviews under the workspace cache prefix", () => {
    expect(weeklyReviewKeys.workspace("workspace-1")).toEqual(["weekly-reviews", "workspace-1"]);
    expect(weeklyReviewKeys.project("workspace-1", "project-1")).toEqual([
      "weekly-reviews",
      "workspace-1",
      "project",
      "project-1",
    ]);
  });
});

describe("reviewHealthLabel", () => {
  it("formats review health values for display", () => {
    expect(reviewHealthLabel("at_risk")).toBe("at risk");
  });
});

describe("listWeeklyReviews", () => {
  it("filters weekly reviews by workspace", async () => {
    const { client, query } = createQueryClient();

    await listWeeklyReviews(client as never, "workspace-1");

    expect(client.from).toHaveBeenCalledWith("weekly_reviews");
    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.order).toHaveBeenCalledWith("week_start", { ascending: false });
  });

  it("applies an optional project filter", async () => {
    const { client, query } = createQueryClient();

    await listWeeklyReviews(client as never, "workspace-1", "project-1");

    expect(query.eq).toHaveBeenNthCalledWith(1, "workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "project_id", "project-1");
  });
});

describe("createWeeklyReview", () => {
  it("creates workspace reviews without a project id", async () => {
    const { client, query } = createQueryClient({ data: { id: "review-1" }, error: null });

    await createWeeklyReview(client as never, {
      workspaceId: "workspace-1",
      userId: "user-1",
      weekStart: "2026-06-22",
      wins: "Shipped notes.",
    });

    expect(client.from).toHaveBeenCalledWith("weekly_reviews");
    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-1",
      project_id: null,
      created_by: "user-1",
      week_start: "2026-06-22",
      wins: "Shipped notes.",
      blockers: null,
      next_focus: null,
      health: null,
    });
  });
});
