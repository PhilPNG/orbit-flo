import type { MindMapNodeType } from "../../lib/supabase/database.types";
import { nodeAccentColor, nodeShape } from "./map-graph-ops";

const accentHex = { cyan: "#67e8f9", blue: "#60a5fa", violet: "#a78bfa" } as const;

type ThumbnailNode = { id: string; position: { x: number; y: number }; nodeType: MindMapNodeType };
type ThumbnailEdge = { id: string; sourceNodeId: string; targetNodeId: string };

const WIDTH = 96;
const HEIGHT = 52;
const PAD = 8;

function ThumbnailNodeShape({ node, x, y }: { node: ThumbnailNode; x: number; y: number }) {
  const shape = nodeShape(node.nodeType);
  const color = accentHex[nodeAccentColor(node.nodeType)];

  if (shape === "triangle") {
    return (
      <polygon
        data-thumbnail-node
        data-thumbnail-shape={shape}
        fill={color}
        points={`${x},${y - 3.5} ${x - 4},${y + 3.5} ${x + 4},${y + 3.5}`}
      />
    );
  }
  if (shape === "diamond") {
    return (
      <polygon
        data-thumbnail-node
        data-thumbnail-shape={shape}
        fill={color}
        points={`${x},${y - 4} ${x + 4},${y} ${x},${y + 4} ${x - 4},${y}`}
      />
    );
  }
  if (shape === "card") {
    return (
      <rect
        data-thumbnail-node
        data-thumbnail-shape={shape}
        fill="none"
        height="6"
        rx="1.5"
        stroke={color}
        width="9"
        x={x - 4.5}
        y={y - 3}
      />
    );
  }
  if (shape === "ring") {
    return (
      <circle
        cx={x}
        cy={y}
        data-thumbnail-node
        data-thumbnail-shape={shape}
        fill="none"
        r="3.5"
        stroke={color}
      />
    );
  }
  if (shape === "planet") {
    return (
      <>
        <ellipse
          cx={x}
          cy={y}
          fill="none"
          rx="6"
          ry="2.25"
          stroke={color}
          strokeOpacity="0.7"
          transform={`rotate(-18 ${x} ${y})`}
        />
        <circle cx={x} cy={y} data-thumbnail-node data-thumbnail-shape={shape} fill={color} r="4" />
      </>
    );
  }
  return <circle cx={x} cy={y} data-thumbnail-node data-thumbnail-shape={shape} fill={color} r="3" />;
}

export function TemplateThumbnail({ edges, nodes }: { edges: ThumbnailEdge[]; nodes: ThumbnailNode[] }) {
  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const scaled = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: maxX === minX ? WIDTH / 2 : PAD + ((node.position.x - minX) / (maxX - minX)) * (WIDTH - PAD * 2),
        y: maxY === minY ? HEIGHT / 2 : PAD + ((node.position.y - minY) / (maxY - minY)) * (HEIGHT - PAD * 2),
      },
    ]),
  );

  return (
    <svg
      aria-hidden="true"
      className="h-[3.25rem] w-24 shrink-0 rounded-md border border-slate-400/10 bg-slate-950/60"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {edges.map((edge) => {
        const source = scaled.get(edge.sourceNodeId);
        const target = scaled.get(edge.targetNodeId);
        if (!source || !target) return null;
        return (
          <line
            key={edge.id}
            stroke="rgba(103, 232, 249, 0.35)"
            strokeWidth="1"
            x1={source.x}
            x2={target.x}
            y1={source.y}
            y2={target.y}
          />
        );
      })}
      {nodes.map((node) => {
        const point = scaled.get(node.id);
        if (!point) return null;
        return <ThumbnailNodeShape key={node.id} node={node} x={point.x} y={point.y} />;
      })}
    </svg>
  );
}
