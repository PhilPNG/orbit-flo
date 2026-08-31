import { render } from "@testing-library/react";
import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { StarlightEdge } from "./map-starlight-edge";

describe("StarlightEdge", () => {
  it("renders an endpoint-brightened path with a stable unique gradient", () => {
    const { container } = render(
      <svg>
        <StarlightEdge
          animated={false}
          data={undefined}
          id="edge:a/one"
          interactionWidth={20}
          markerEnd={undefined}
          selected={false}
          source="node-a"
          sourcePosition={Position.Right}
          sourceX={0}
          sourceY={0}
          style={{}}
          target="node-b"
          targetPosition={Position.Left}
          targetX={160}
          targetY={80}
        />
      </svg>,
    );

    expect(container.querySelector("#starlight-edge-a-one")).toBeTruthy();
    expect(container.querySelectorAll("stop")).toHaveLength(3);
    expect(container.querySelector("path.react-flow__edge-path")).toHaveStyle({
      stroke: "url(#starlight-edge-a-one)",
    });
  });
});
