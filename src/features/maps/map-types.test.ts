import { describe, expect, it } from "vitest";
import { mapEdgeTypeLabel, mapEdgeTypes, mapNodeStatusLabel, mapNodeStatuses, mapNodeTypeLabel, mapNodeTypes } from "./map-types";

describe("map labels", () => {
  it("labels every node type, status and edge type", () => {
    expect(mapNodeTypeLabel("task_candidate")).toBe("Task candidate");
    expect(mapNodeStatusLabel("converted")).toBe("Converted");
    expect(mapEdgeTypeLabel("outcome")).toBe("Outcome");
    mapNodeTypes.forEach((type) => expect(mapNodeTypeLabel(type)).toBeTruthy());
    mapNodeStatuses.forEach((status) => expect(mapNodeStatusLabel(status)).toBeTruthy());
    mapEdgeTypes.forEach((type) => expect(mapEdgeTypeLabel(type)).toBeTruthy());
  });
});
