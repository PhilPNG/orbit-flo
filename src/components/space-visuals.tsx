import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { orbitAssets } from "../lib/orbit-assets";
import { GalaxyCanvas, gpuReduced, isWebGLAvailable } from "./galaxy-canvas";

/**
 * Pure so it is testable without a WebGL context: a jsdom test can call this
 * directly with the post-context-loss state instead of driving a real canvas
 * through `webglcontextlost`, which jsdom cannot produce.
 */
export function starfieldRootClassName(useGalaxy: boolean, contextLost: boolean): string {
  return clsx("orbit-starfield-root pointer-events-none", useGalaxy && !contextLost && "orbit-starfield-root--webgl");
}

export function StarFieldBackground() {
  // Decided once per mount. All three conditions are about the user's machine
  // or preferences, none of which change while a page is open.
  const useGalaxy = useMemo(() => {
    if (import.meta.env.VITE_CAPTURE_MODE === "1") return false;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    if (gpuReduced()) return false;
    return isWebGLAvailable();
  }, []);
  // A lost WebGL context (driver reset, GPU crash) leaves the canvas blank
  // forever unless something reacts. Once this fires we stop mounting
  // GalaxyCanvas and drop the --webgl modifier so the CSS star layers —
  // hidden while the canvas draws them — come back instead of leaving the
  // user with nebula and grain only. The same flip serves a self-measured
  // quality fallback (see galaxy-canvas.tsx's decideQuality): one mechanism,
  // two triggers.
  const [contextLost, setContextLost] = useState(false);
  const showGalaxy = useGalaxy && !contextLost;

  return (
    <div aria-hidden="true" className={starfieldRootClassName(useGalaxy, contextLost)}>
      {showGalaxy ? (
        <GalaxyCanvas onContextLost={() => setContextLost(true)} onQualityFallback={() => setContextLost(true)} />
      ) : null}
      <div className="orbit-star-layer orbit-starfield orbit-starfield-far" />
      <div className="orbit-star-layer orbit-starfield orbit-starfield-mid" />
      <div className="orbit-star-layer orbit-starfield orbit-starfield-near" />
      <div className="orbit-nebula absolute inset-0" />
      <div
        className="orbit-grain absolute inset-0"
        style={{ backgroundImage: `url("${orbitAssets.textures.deepSpaceGrain}")` }}
      />
      <span aria-hidden="true" className="orbit-star-flare left-[18%] top-[23%]" />
      <span aria-hidden="true" className="orbit-star-flare orbit-star-flare-small right-[16%] top-[38%]" />
      <span aria-hidden="true" className="orbit-meteor orbit-meteor-one" />
      <span aria-hidden="true" className="orbit-meteor orbit-meteor-two" />
      <span aria-hidden="true" className="orbit-meteor orbit-meteor-three" />
    </div>
  );
}

export function SatelliteLoader({ label = "Entering orbit" }: { label?: string }) {
  return (
    <div aria-label={label || "Loading"} className="satellite-loader-shell inline-flex items-center gap-3 text-sm font-medium text-cyan-100" role="status">
      <span aria-hidden="true" className="relative grid h-10 w-10 place-items-center rounded-full border border-cyan-300/25 bg-slate-950/60">
        <span className="satellite-loader-orbit absolute h-8 w-8 rounded-full border border-cyan-300/35" />
        <span aria-hidden="true" className="satellite-loader-trail absolute h-9 w-9 rounded-full" data-testid="satellite-loader-trail" />
        <span className="satellite-loader-pulse absolute h-5 w-5 rounded-full" />
        <span className="h-2.5 w-2.5 rounded-sm bg-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />
      </span>
      {label ? <span aria-hidden="true">{label}</span> : null}
    </div>
  );
}

export function SpaceEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={clsx("h-auto w-full", className)}
      viewBox="0 0 180 116"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="empty-orbit" x1="20" x2="160" y1="96" y2="24">
          <stop stopColor="#2563EB" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <path d="M23 86c35 19 94 13 134-25" fill="none" stroke="url(#empty-orbit)" strokeLinecap="round" strokeWidth="4" />
      <path d="M42 96c30 10 70 4 99-21" fill="none" opacity="0.45" stroke="url(#empty-orbit)" strokeLinecap="round" strokeWidth="2" />
      <g transform="rotate(-20 91 47)">
        <rect fill="#2563EB" height="15" rx="3" width="34" x="48" y="42" />
        <rect fill="#22D3EE" height="15" rx="3" width="34" x="99" y="42" />
        <rect fill="#E5E7EB" height="23" rx="6" width="30" x="76" y="38" />
        <path d="M82 49h-8M107 49h-8" stroke="#94A3B8" strokeLinecap="round" strokeWidth="2" />
        <circle cx="91" cy="49" fill="#061225" r="4" />
      </g>
      <path d="M139 20l1.5 3.7 3.8 1.5-3.8 1.5-1.5 3.8-1.5-3.8-3.8-1.5 3.8-1.5 1.5-3.7Z" fill="#67E8F9" />
      <circle cx="38" cy="35" fill="#FFFFFF" opacity="0.7" r="2" />
      <circle cx="153" cy="48" fill="#FFFFFF" opacity="0.5" r="1.7" />
    </svg>
  );
}

export function ConstellationProgress({
  complete,
  total,
}: {
  complete: number;
  total: number;
}) {
  const nodeCount = Math.max(4, Math.min(8, total || 4));
  const litNodes = total > 0 ? Math.round((complete / total) * nodeCount) : 0;

  return (
    <div aria-label={`${complete} of ${total} missions complete`} className="flex items-center gap-2">
      {Array.from({ length: nodeCount }).map((_, index) => {
        const isLit = index < litNodes;

        return (
          <span className="flex items-center gap-2" key={index}>
            <span
              className={clsx(
                "h-2.5 w-2.5 rounded-full border",
                isLit
                  ? "border-cyan-200 bg-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.75)]"
                  : "border-slate-500 bg-slate-800",
              )}
            />
            {index < nodeCount - 1 ? <span className="h-px w-5 bg-slate-600/70" /> : null}
          </span>
        );
      })}
    </div>
  );
}

export function OrbitProgressRing({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: number;
  tone?: "cyan" | "blue" | "violet";
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  const color = tone === "violet" ? "#7C3AED" : tone === "blue" ? "#3B82F6" : "#22D3EE";

  return (
    <div className="relative grid h-36 w-36 place-items-center rounded-full">
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" fill="none" r="48" stroke="rgba(148,163,184,0.18)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          fill="none"
          pathLength="100"
          r="48"
          stroke={color}
          strokeDasharray={`${safeValue} 100`}
          strokeLinecap="round"
          strokeWidth="8"
        />
      </svg>
      <span className="orbit-progress-satellite absolute inset-0 rounded-full" />
      <div className="text-center">
        <p className="text-3xl font-black text-white">{safeValue}%</p>
        <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      </div>
    </div>
  );
}

export function OrbitalCommandScene({ className }: { className?: string }) {
  const cards = [
    { label: "Docked", value: "Ideas", className: "left-3 top-16" },
    { label: "Launching", value: "Focus", className: "right-2 top-28" },
    { label: "In Orbit", value: "Review", className: "bottom-12 left-10" },
  ];

  return (
    <div className={clsx("relative mx-auto aspect-square w-full max-w-[25rem]", className)} aria-hidden="true">
      <div className="absolute inset-8 rounded-full border border-cyan-300/20" />
      <div className="orbit-ring-slow absolute inset-14 rounded-full border border-blue-400/20" />
      <div className="orbit-ring-reverse absolute inset-24 rounded-full border border-violet-400/20" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_52%_48%,rgba(124,58,237,0.2),transparent_18%)] blur-sm" />
      <div className="absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-cyan-200/40 bg-slate-950/80 shadow-[0_0_80px_rgba(34,211,238,0.24)]">
        <div className="h-12 w-12 rounded-full bg-[radial-gradient(circle,#67E8F9,#2563EB_62%,#7C3AED)] shadow-[0_0_38px_rgba(34,211,238,0.8)]" />
      </div>
      <div className="orbiting-satellite absolute inset-0">
        <span className="absolute left-1/2 top-2 h-3 w-8 -translate-x-1/2 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
      </div>
      {cards.map((card, index) => (
        <div
          className={clsx(
            "orbit-float-card absolute rounded-lg border border-slate-400/20 bg-slate-950/80 px-3 py-2 shadow-2xl backdrop-blur",
            card.className,
          )}
          key={card.label}
          style={{ animationDelay: `${index * 240}ms` }}
        >
          <p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-cyan-200">{card.label}</p>
          <p className="mt-1 text-sm font-bold text-white">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
