/**
 * Contour-map lines behind a project workspace.
 *
 * Vendored from React Bits (https://reactbits.dev), MIT licensed, by David Haz.
 * See LICENSES/react-bits-MIT.txt. Retrieved 2026-08-21 from
 * https://github.com/DavidHDev/react-bits, path
 * src/content/Backgrounds/Topography/Topography.jsx
 *
 * Upstream already pauses off-screen and when the tab is hidden, and already
 * caps DPR - all kept. Five departures:
 *
 * - A WebGL 2 check. These shaders are #version 300 es while the galaxy is
 *   WebGL 1, so a machine that runs the galaxy may still lack WebGL 2. Without
 *   a context we render nothing and the galaxy shows through.
 * - A reduced-motion guard, because CSS cannot reach canvas drawing.
 * - Mouse listeners removed. Upstream binds them to its own canvas, which here
 *   sits behind pointer-events: none UI where they can never fire.
 * - A frame cap, and colours retuned to this product's nebula tokens.
 * - A lost-context handler, so a driver reset or GPU crash falls back to
 *   rendering nothing (the galaxy shows through) rather than a dead canvas.
 *
 * This layers OVER the galaxy rather than replacing it, which is a deliberate
 * choice made with the two-context cost known and deliberately accepted - not
 * yet measured; the measurement could not be taken in this environment.
 */
import { Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef, useState } from "react";
import { gpuReduced } from "./galaxy-canvas";
// Self-namespace import so the two internal `hasWebGL2()` call sites below
// resolve through this module's live export binding rather than the local
// declaration directly. Without this indirection, `vi.spyOn(module,
// "hasWebGL2")` in topography.test.tsx would mutate an export nothing inside
// this file actually reads from, and the reduced-motion test would pass
// whether or not the guard exists - the exact defect this module's test
// suite exists to catch.
import * as self from "./topography";

const FRAME_INTERVAL_MS = 1000 / 30;
const MAX_DPR = 1.5;

/** Nebula tokens, kept dim: this sits behind the densest screen in the app.
 *  Violet -> electric blue -> pale white. Deliberately NOT cyan: cyan means
 *  "you can touch this" in this product, and a backdrop must never claim that. */
const LOW_COLOR: [number, number, number] = [0.486, 0.227, 0.929];
const MID_COLOR: [number, number, number] = [0.231, 0.51, 0.965];
const HIGH_COLOR: [number, number, number] = [0.878, 0.949, 0.996];
const OPACITY = 0.16;

const CTRL_INDICES = [
  [1, -2, 3, -4],
  [9, -8, 7, -6],
  [5, 2, 5, -5],
  [-1, -3, 8, 9],
];

export function hasWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    // This context is never used for rendering - just release it immediately
    // rather than leaking it until the throwaway canvas is garbage collected.
    // Called twice per mount (initial state + the media-query listener).
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float uMorphAmount;
uniform float uBands;
uniform float uThickness;
uniform float uGlow;
uniform float uContrast;
uniform float uOpacity;
uniform vec3 uLow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform vec4 uCtrlA;
uniform vec4 uCtrlB;
uniform vec4 uCtrlC;
uniform vec4 uCtrlD;
out vec4 fragColor;

float bez(float t, vec4 c) {
  float w = 6.2831853 * t;
  return 0.5 * (c.x * sin(w) + c.y * cos(w) + c.z * sin(2.0 * w) + c.w * cos(2.0 * w));
}

float field(vec2 uv) {
  vec2 a = vec2(bez(uv.x, uCtrlA), bez(uv.x, uCtrlB));
  vec2 b = vec2(bez(uv.y, uCtrlC), bez(uv.y, uCtrlD));
  return distance(a, b);
}

vec3 elevationColor(float e) {
  vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.5, e));
  c = mix(c, uHigh, smoothstep(0.5, 1.0, e));
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float fv = field(uv);

  float f = fv * uBands;
  float frac = fract(f);
  float lineDist = min(frac, 1.0 - frac);

  float aa = fwidth(f) + 0.0001;
  float mask = 1.0 - smoothstep(uThickness - aa, uThickness + aa, lineDist);
  float glowR = uThickness + uGlow * 0.5 + aa;
  float glow = (1.0 - smoothstep(uThickness, glowR, lineDist)) * step(0.0001, uGlow);

  float elev = clamp(fv / (uMorphAmount * 2.5 + 0.001), 0.0, 1.0);
  vec3 lineCol = elevationColor(elev);

  float coverage = clamp(mask + glow * 0.55, 0.0, 1.0);
  coverage = pow(coverage, max(uContrast, 0.001));

  float a = clamp(coverage, 0.0, 1.0) * uOpacity;
  fragColor = vec4(lineCol * a, a);
}
`;

export function Topography() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [allowed, setAllowed] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    if (gpuReduced()) return false;
    return self.hasWebGL2();
  });
  // A lost WebGL context (driver reset, GPU crash) leaves the canvas
  // permanently blank unless something reacts. Separate from `allowed`: the
  // reduced-motion media-query listener recomputes `allowed` from scratch and
  // would happily flip it back to true after a context loss, since
  // hasWebGL2() has no memory of this canvas in particular.
  const [contextLost, setContextLost] = useState(false);
  const showTopography = allowed && !contextLost;

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const sync = () => setAllowed(!query.matches && !gpuReduced() && self.hasWebGL2());
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!showTopography) return;
    const host = hostRef.current;
    if (!host) return;

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR),
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.canvas.setAttribute("aria-hidden", "true");
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";
    host.appendChild(gl.canvas);

    // A driver reset or GPU crash leaves the canvas permanently blank unless
    // something reacts. preventDefault() signals we won't attempt WebGL
    // context restoration ourselves - we fall back to rendering nothing, so
    // the galaxy shows through, same as the no-WebGL-2 case. See
    // galaxy-canvas.tsx for the same pattern.
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    gl.canvas.addEventListener("webglcontextlost", handleContextLost);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iResolution: { value: new Float32Array([1, 1]) },
        uMorphAmount: { value: 3 },
        uBands: { value: 2 },
        uThickness: { value: 0.01 },
        uGlow: { value: 0.5 },
        uContrast: { value: 3 },
        uOpacity: { value: OPACITY },
        uLow: { value: new Float32Array(LOW_COLOR) },
        uMid: { value: new Float32Array(MID_COLOR) },
        uHigh: { value: new Float32Array(HIGH_COLOR) },
        uCtrlA: { value: new Float32Array([0, 0, 0, 0]) },
        uCtrlB: { value: new Float32Array([0, 0, 0, 0]) },
        uCtrlC: { value: new Float32Array([0, 0, 0, 0]) },
        uCtrlD: { value: new Float32Array([0, 0, 0, 0]) },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const setSize = () => {
      const rect = host.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
      const res = program.uniforms.iResolution.value as Float32Array;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
    };
    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(host);
    setSize();

    const ctrlArrays = [
      program.uniforms.uCtrlA.value as Float32Array,
      program.uniforms.uCtrlB.value as Float32Array,
      program.uniforms.uCtrlC.value as Float32Array,
      program.uniforms.uCtrlD.value as Float32Array,
    ];

    let frameId = 0;
    let lastFrameAt = 0;
    let onScreen = true;
    let pageVisible = !document.hidden;
    const startedAt = performance.now();

    const draw = (now: number) => {
      frameId = requestAnimationFrame(draw);
      if (lastFrameAt !== 0 && now - lastFrameAt < FRAME_INTERVAL_MS) return;
      lastFrameAt = now;

      const time = (now - startedAt) * 0.001;
      for (let g = 0; g < 4; g += 1) {
        const arr = ctrlArrays[g];
        const idx = CTRL_INDICES[g];
        for (let j = 0; j < 4; j += 1) {
          const i = idx[j];
          arr[j] = 3 * Math.sin(time * 0.35 * Math.sin(i * 0.05) + i);
        }
      }

      renderer.render({ scene: mesh });
    };

    const start = () => {
      if (frameId === 0 && onScreen && pageVisible) {
        lastFrameAt = 0;
        frameId = requestAnimationFrame(draw);
      }
    };
    const stop = () => {
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        onScreen ? start() : stop();
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(host);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      pageVisible ? start() : stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      gl.canvas.removeEventListener("webglcontextlost", handleContextLost);
      if (gl.canvas.parentNode === host) host.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [showTopography]);

  return <div aria-hidden="true" className="orbit-topography" ref={hostRef} />;
}
