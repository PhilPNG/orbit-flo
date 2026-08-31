import { describe, expect, it } from "vitest";
import { workspacePath } from "./workspace-path";

describe("workspacePath", () => {
  it("maps the workspace root without a trailing slash", () => {
    expect(workspacePath("ws-1", "/")).toBe("/w/ws-1");
  });

  it("prefixes a section path", () => {
    expect(workspacePath("ws-1", "/projects")).toBe("/w/ws-1/projects");
  });

  it("prefixes a nested path", () => {
    expect(workspacePath("ws-1", "/projects/project-9")).toBe("/w/ws-1/projects/project-9");
  });

  it("tolerates a path given without its leading slash", () => {
    expect(workspacePath("ws-1", "projects")).toBe("/w/ws-1/projects");
  });
});
