import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

export function StarlightEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  interactionWidth = 20,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const gradientId = `starlight-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <>
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          x1={sourceX}
          x2={targetX}
          y1={sourceY}
          y2={targetY}
        >
          <stop offset="0" stopColor="#67e8f9" stopOpacity="0.82" />
          <stop offset="0.5" stopColor="#3b82f6" stopOpacity="0.24" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0.82" />
        </linearGradient>
      </defs>
      <BaseEdge
        id={id}
        interactionWidth={interactionWidth}
        markerEnd={markerEnd}
        path={path}
        style={{ ...style, stroke: `url(#${gradientId})` }}
      />
    </>
  );
}
