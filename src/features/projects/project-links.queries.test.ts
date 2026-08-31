import { describe, expect, it, vi } from "vitest";
import {
  createProjectLink,
  deleteProjectLink,
  linkTypeLabel,
  listProjectLinks,
  listRepositoryLinks,
  normalizeLinkUrl,
  safeLinkUrl,
} from "./project-links.queries";

function createQueryClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    single: vi.fn(() => result),
  };

  return { client: { from: vi.fn(() => query) }, query };
}

describe("normalizeLinkUrl", () => {
  it("accepts http and https", () => {
    expect(normalizeLinkUrl("https://example.com/docs")).toBe("https://example.com/docs");
    expect(normalizeLinkUrl("  http://example.com  ")).toBe("http://example.com/");
  });

  it("rejects protocols that are not http or https", () => {
    expect(() => normalizeLinkUrl("javascript:alert(1)")).toThrow(
      "Links must start with http:// or https://.",
    );
    expect(() => normalizeLinkUrl("ftp://example.com")).toThrow(
      "Links must start with http:// or https://.",
    );
  });

  it("rejects unparseable input", () => {
    expect(() => normalizeLinkUrl("example.com")).toThrow(
      "Links must start with http:// or https://.",
    );
  });

  it("rejects an empty URL", () => {
    expect(() => normalizeLinkUrl("   ")).toThrow("Links need a URL.");
    expect(() => normalizeLinkUrl(null)).toThrow("Links need a URL.");
  });
});

describe("safeLinkUrl", () => {
  it("returns null instead of throwing", () => {
    expect(safeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(safeLinkUrl("https://example.com/")).toBe("https://example.com/");
  });
});

describe("linkTypeLabel", () => {
  it("spells issue_tracker as prose", () => {
    expect(linkTypeLabel("issue_tracker")).toBe("Issue tracker");
    expect(linkTypeLabel("repository")).toBe("Repository");
  });
});

describe("listProjectLinks", () => {
  it("scopes to the workspace and project and orders by type", async () => {
    const { client, query } = createQueryClient({ data: [], error: null });

    await listProjectLinks(client as never, { workspaceId: "workspace-1", projectId: "project-1" });

    expect(client.from).toHaveBeenCalledWith("project_links");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(query.order).toHaveBeenCalledWith("link_type", { ascending: true });
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });
});

describe("createProjectLink", () => {
  it("normalizes the URL before writing", async () => {
    const { client, query } = createQueryClient({ data: { id: "link-1" }, error: null });

    await createProjectLink(client as never, {
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      linkType: "documentation",
      label: "Docs",
      url: "  https://example.com/docs  ",
    });

    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-1",
      project_id: "project-1",
      created_by: "user-1",
      link_type: "documentation",
      label: "Docs",
      url: "https://example.com/docs",
    });
  });

  it("falls back to the type name when the label is blank", async () => {
    const { client, query } = createQueryClient({ data: { id: "link-1" }, error: null });

    await createProjectLink(client as never, {
      workspaceId: "workspace-1",
      projectId: "project-1",
      userId: "user-1",
      linkType: "issue_tracker",
      label: "   ",
      url: "https://example.com/issues",
    });

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Issue tracker" }),
    );
  });

  it("refuses a dangerous URL without writing", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await expect(
      createProjectLink(client as never, {
        workspaceId: "workspace-1",
        projectId: "project-1",
        userId: "user-1",
        linkType: "other",
        label: "Bad",
        url: "javascript:alert(1)",
      }),
    ).rejects.toThrow("Links must start with http:// or https://.");

    expect(query.insert).not.toHaveBeenCalled();
  });
});

describe("deleteProjectLink", () => {
  it("scopes the delete to the workspace", async () => {
    const { client, query } = createQueryClient({ data: null, error: null });

    await deleteProjectLink(client as never, { id: "link-1", workspaceId: "workspace-1" });

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("id", "link-1");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
  });
});

describe("listRepositoryLinks", () => {
  it("maps project id to URL and keeps the first per project", async () => {
    const { client } = createQueryClient({
      data: [
        { project_id: "project-1", url: "https://example.com/one" },
        { project_id: "project-1", url: "https://example.com/two" },
        { project_id: "project-2", url: "https://example.com/three" },
      ],
      error: null,
    });

    const result = await listRepositoryLinks(client as never, {
      workspaceId: "workspace-1",
      projectIds: ["project-1", "project-2"],
    });

    expect(result.get("project-1")).toBe("https://example.com/one");
    expect(result.get("project-2")).toBe("https://example.com/three");
  });

  it("issues no query for an empty id list", async () => {
    const { client } = createQueryClient({ data: [], error: null });

    const result = await listRepositoryLinks(client as never, {
      workspaceId: "workspace-1",
      projectIds: [],
    });

    expect(result.size).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("drops URLs that would not be safe to render", async () => {
    const { client } = createQueryClient({
      data: [{ project_id: "project-1", url: "javascript:alert(1)" }],
      error: null,
    });

    const result = await listRepositoryLinks(client as never, {
      workspaceId: "workspace-1",
      projectIds: ["project-1"],
    });

    expect(result.size).toBe(0);
  });
});
