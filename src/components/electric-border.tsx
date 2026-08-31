/**
 * A crackling border for the column you are dragging into.
 *
 * Vendored from React Bits (https://reactbits.dev), MIT licensed, by David Haz.
 * See LICENSES/react-bits-MIT.txt. Retrieved 2026-08-20 from
 * https://github.com/DavidHDev/react-bits, path
 * src/content/Animations/ElectricBorder/ElectricBorder.jsx
 *
 * Six deliberate departures from the original:
 *
 * - Overlay, not wrapper. The original nests children three divs deep. Board
 *   columns are flex items in a horizontal scroller, so wrapping would change
 *   layout; this is one absolutely-positioned canvas inside the column instead.
 * - No static glow divs. styles.css already gives every surface that glow via
 *   --orbit-glow; repeating it here would double it on one element.
 * - No oklch() relative colour syntax - a newer baseline than anything else
 *   here. The stroke colour is explicit.
 * - Octaves 10 -> 5 and samples capped at 240. The original runs ~18,000 noise
 *   evaluations per frame on a column-sized element; this runs ~2,400. The
 *   dropped octaves contribute sub-pixel detail at this size.
 * - A reduced-motion guard, because CSS cannot reach canvas drawing.
 * - Paused when the tab is hidden, and frame-capped.
 */
import { useEffect, useRef, useState } from "react";

const OCTAVES = 5;
const LACUNARITY = 1.6;
const GAIN = 0.7;
const CHAOS = 0.12;
const FREQUENCY = 10;
const DISPLACEMENT = 26;
const BORDER_OFFSET = 30;
const MAX_SAMPLES = 240;
const SPEED = 1;
/** 30fps. This runs during a drag, where responsiveness matters more than smoothness. */
const FRAME_INTERVAL_MS = 1000 / 30;
/** Cyan, because a drop target is an interaction state - which is what cyan means here. */
const STROKE = "#22d3ee";

function random(x: number): number {
  return (Math.sin(x * 12.9898) * 43758.5453) % 1;
}

function noise2D(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;

  const a = random(i + j * 57);
  const b = random(i + 1 + j * 57);
  const c = random(i + (j + 1) * 57);
  const d = random(i + 1 + (j + 1) * 57);

  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function octavedNoise(x: number, time: number, seed: number): number {
  let y = 0;
  let amplitude = CHAOS;
  let frequency = FREQUENCY;

  for (let i = 0; i < OCTAVES; i += 1) {
    y += amplitude * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
    frequency *= LACUNARITY;
    amplitude *= GAIN;
  }

  return y;
}

function cornerPoint(cx: number, cy: number, r: number, start: number, arc: number, t: number) {
  const angle = start + t * arc;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** A point at fraction `t` around a rounded rectangle's perimeter. */
export function roundedRectPoint(
  t: number,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
): { x: number; y: number } {
  const straightW = width - 2 * radius;
  const straightH = height - 2 * radius;
  const arc = (Math.PI * radius) / 2;
  const perimeter = 2 * straightW + 2 * straightH + 4 * arc;
  const distance = t * perimeter;
  let acc = 0;

  if (distance <= acc + straightW) {
    return { x: left + radius + ((distance - acc) / straightW) * straightW, y: top };
  }
  acc += straightW;

  if (distance <= acc + arc) {
    return cornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, (distance - acc) / arc);
  }
  acc += arc;

  if (distance <= acc + straightH) {
    return { x: left + width, y: top + radius + ((distance - acc) / straightH) * straightH };
  }
  acc += straightH;

  if (distance <= acc + arc) {
    return cornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, (distance - acc) / arc);
  }
  acc += arc;

  if (distance <= acc + straightW) {
    return { x: left + width - radius - ((distance - acc) / straightW) * straightW, y: top + height };
  }
  acc += straightW;

  if (distance <= acc + arc) {
    return cornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, (distance - acc) / arc);
  }
  acc += arc;

  if (distance <= acc + straightH) {
    return { x: left, y: top + height - radius - ((distance - acc) / straightH) * straightH };
  }
  acc += straightH;

  return cornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, (distance - acc) / arc);
}

export function ElectricBorder({ radius = 12 }: { radius?: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Read synchronously so a column that becomes the drop target on first
  // paint gets the border in the same commit, instead of mounting `false`
  // and flipping true a commit later.
  const [allowed, setAllowed] = useState(() => {
    const query = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : null;
    return query ? !query.matches : true;
  });

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) {
      setAllowed(true);
      return;
    }
    const sync = () => setAllowed(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!host || !canvas || !context) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = rect.width + BORDER_OFFSET * 2;
      height = rect.height + BORDER_OFFSET * 2;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let frameId = 0;
    let lastFrameAt = 0;
    let elapsed = 0;

    const draw = (now: number) => {
      frameId = requestAnimationFrame(draw);
      if (document.hidden) {
        // Keep lastFrameAt current even while not drawing, so the tick after
        // the tab comes back computes a normal small delta instead of one
        // spanning the whole hidden duration and snapping the border's shape.
        lastFrameAt = now;
        return;
      }
      if (lastFrameAt !== 0 && now - lastFrameAt < FRAME_INTERVAL_MS) return;
      const delta = lastFrameAt === 0 ? 0 : (now - lastFrameAt) / 1000;
      lastFrameAt = now;
      elapsed += delta * SPEED;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(dpr, dpr);
      context.strokeStyle = STROKE;
      context.lineWidth = 1;
      context.lineCap = "round";
      context.lineJoin = "round";

      const boxW = width - BORDER_OFFSET * 2;
      const boxH = height - BORDER_OFFSET * 2;
      if (boxW <= 0 || boxH <= 0) return;
      const r = Math.min(radius, Math.min(boxW, boxH) / 2);
      const perimeter = 2 * (boxW + boxH) + 2 * Math.PI * r;
      const samples = Math.min(MAX_SAMPLES, Math.max(24, Math.floor(perimeter / 2)));

      context.beginPath();
      for (let i = 0; i <= samples; i += 1) {
        const t = i / samples;
        const point = roundedRectPoint(t, BORDER_OFFSET, BORDER_OFFSET, boxW, boxH, r);
        const dx = octavedNoise(t * 8, elapsed, 0) * DISPLACEMENT;
        const dy = octavedNoise(t * 8, elapsed, 1) * DISPLACEMENT;
        if (i === 0) context.moveTo(point.x + dx, point.y + dy);
        else context.lineTo(point.x + dx, point.y + dy);
      }
      context.closePath();
      context.stroke();
    };

    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [allowed, radius]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
      ref={hostRef}
    >
      {allowed ? (
        <canvas
          aria-hidden="true"
          className="pointer-events-none absolute"
          ref={canvasRef}
          style={{ left: `-${BORDER_OFFSET}px`, top: `-${BORDER_OFFSET}px` }}
        />
      ) : null}
    </div>
  );
}
