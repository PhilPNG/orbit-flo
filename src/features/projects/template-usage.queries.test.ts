import { describe, expect, it, vi } from "vitest";
import { incrementTemplateUsage, listTemplateUsage, templateSlug } from "./template-usage.queries";

function createQueryClient(maybeSingleResult: { data: unknown; error: unknown } = { data: null, error: null }) {
  const query = {
    data: [],
    error: null,
    select: vi.fn((..._args: unknown[]) => query),
    eq: vi.fn((..._args: unknown[]) => query),
    update: vi.fn((..._args: unknown[]) => query),
    insert: vi.fn((..._args: unknown[]) => query),
    maybeSingle: vi.fn(() => maybeSingleResult),
  };

  return {
    client: {
      from: vi.fn(() => query),
    },
    query,
  };
}

describe("templateSlug", () => {
  it("lowercases and dashes template names", () => {
    expect(templateSlug("Bug fix day")).toBe("bug-fix-day");
    expect(templateSlug("  Feature   slice ")).toBe("feature-slice");
  });
});

describe("listTemplateUsage", () => {
  it("scopes usage rows by workspace", async () => {
    const { client, query } = createQueryClient();

    await listTemplateUsage(client as never, "workspace-1");

    expect(client.from).toHaveBeenCalledWith("template_usage");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
  });
});

describe("incrementTemplateUsage", () => {
  it("bumps an existing counter", async () => {
    const { client, query } = createQueryClient({
      data: { id: "usage-1", workspace_id: "workspace-1", template_id: "bug-fix-day", use_count: 3 },
      error: null,
    });

    await incrementTemplateUsage(client as never, { workspaceId: "workspace-1", templateId: "bug-fix-day" });

    expect(query.update).toHaveBeenCalledWith({ use_count: 4 });
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("inserts a first-use row when none exists", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await incrementTemplateUsage(client as never, { workspaceId: "workspace-1", templateId: "feature-slice" });

    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-1",
      template_id: "feature-slice",
      use_count: 1,
    });
    expect(query.update).not.toHaveBeenCalled();
  });
});
