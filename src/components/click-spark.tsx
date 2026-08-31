import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const SPARK_COUNT = 8;
const SPARK_LIFE_MS = 380;
const SPARK_RADIUS = 16;

type Spark = { x: number; y: number; angle: number; bornAt: number };

/**
 * A short burst at the click point.
 *
 * This is the only effect in this pass that draws to a canvas, which is why it
 * carries its own reduced-motion guard: the global CSS rule in styles.css
 * neutralises `animation` and `transition`, and reaches nothing here.
 *
 * Deliberately NOT used on the kanban board or the mind map. Both are
 * drag-and-pan surfaces where per-pointer work competes with the interaction
 * people actually came for.
 */
export function ClickSpark({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<Spark[]>([]);
  const frameRef = useRef(0);
  const [allowed, setAllowed] = useState(false);

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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const now = performance.now();
    sparksRef.current = sparksRef.current.filter((s) => now - s.bornAt < SPARK_LIFE_MS);
    context.clearRect(0, 0, canvas.width, canvas.height);

    sparksRef.current.forEach((spark) => {
      const life = (now - spark.bornAt) / SPARK_LIFE_MS;
      const distance = SPARK_RADIUS * life;
      context.globalAlpha = 1 - life;
      context.strokeStyle = "#22d3ee";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(spark.x + Math.cos(spark.angle) * distance, spark.y + Math.sin(spark.angle) * distance);
      context.lineTo(
        spark.x + Math.cos(spark.angle) * (distance + 5),
        spark.y + Math.sin(spark.angle) * (distance + 5),
      );
      context.stroke();
    });

    frameRef.current = sparksRef.current.length > 0 ? requestAnimationFrame(draw) : 0;
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      if (!allowed) return;
      const host = hostRef.current;
      const canvas = canvasRef.current;
      if (!host || !canvas) return;

      const rect = host.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const bornAt = performance.now();
      for (let i = 0; i < SPARK_COUNT; i += 1) {
        sparksRef.current.push({ x, y, angle: (i / SPARK_COUNT) * Math.PI * 2, bornAt });
      }

      if (frameRef.current === 0) frameRef.current = requestAnimationFrame(draw);
    },
    [allowed, draw],
  );

  useEffect(() => () => {
    if (frameRef.current !== 0) cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <span className="relative inline-block" onClick={handleClick} ref={hostRef}>
      {children}
      {allowed ? (
        <canvas
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          ref={canvasRef}
        />
      ) : null}
    </span>
  );
}
