/**
 * Galaxy backdrop.
 *
 * Vendored from React Bits (https://reactbits.dev), MIT licensed, by David Haz.
 * Retrieved 2026-08-20 from https://github.com/DavidHDev/react-bits, path
 * src/content/Backgrounds/Galaxy/Galaxy.jsx — recorded so a future update can
 * be diffed against upstream. The full licence text is reproduced at
 * LICENSES/react-bits-MIT.txt. The shader is theirs; the frame cap, the
 * hidden-tab pause, the WebGL guard and the TypeScript are ours. Vendored
 * rather than depended on because React Bits ships copy-paste source, not a
 * package — which means bugs in here are ours to fix.
 *
 * Deliberate departures from the original, each for a reason:
 *
 * - No props. The original's effect depends on `focal` and `rotation`, which
 *   are arrays, so inline literals would re-initialise WebGL on every render.
 *   Module-level constants remove the trap instead of documenting it.
 * - No mouse repulsion. The original pushes stars away from the cursor via a
 *   `uMouseRepulsion` uniform; that branch and its uniforms are removed
 *   entirely here, leaving only parallax, which is the shader's else branch.
 * - Capped and pausable. The original animates uncapped, forever, including in
 *   a background tab or with `prefers-reduced-motion: reduce` set.
 */
import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";

/** 30fps. Ambient drift does not read as smoother above this, but it does cost. */
export const FRAME_INTERVAL_MS = 1000 / 30;

// Stable identities. See the header — these must never be inline literals.
const FOCAL = new Float32Array([0.5, 0.5]);
const ROTATION = new Float32Array([1, 0]);
const MOUSE = new Float32Array([0.5, 0.5]);

/** Violet-magenta rather than the original's teal-green default of 140. */
const HUE_SHIFT = 265;
/** The original defaults to 0, making every star the same white. Star colour
 *  variety is what stops a field reading as printed dots. Kept low so it reads
 *  as temperature, not confetti. */
const SATURATION = 0.28;
const STAR_SPEED = 0.28;
const DENSITY = 0.9;
const GLOW_INTENSITY = 0.26;
const TWINKLE_INTENSITY = 0.34;
const ROTATION_SPEED = 0.03;
const SPEED = 0.7;

export function shouldRenderFrame(now: number, lastFrameAt: number, hidden: boolean): boolean {
  if (hidden) return false;
  // The first frame draws immediately. Gating it would leave the backdrop blank
  // for a frame interval on mount, which reads as a flash.
  if (lastFrameAt === 0) return true;
  return now - lastFrameAt >= FRAME_INTERVAL_MS;
}

/**
 * Advances the animation-time accumulator by the real time elapsed since the
 * last *rendered* frame, rather than using an absolute timestamp.
 *
 * Pass `null` for `lastRenderAt` on the first frame ever, and again on the
 * first frame after a pause (hidden tab, reduced motion off again) — that
 * tells this function not to count the pause itself as elapsed animation
 * time, so the caller resumes smoothly from where it left off instead of the
 * shader snapping to whatever `now` happens to be.
 */
export function advanceAnimationTime(elapsedMs: number, now: number, lastRenderAt: number | null): number {
  if (lastRenderAt === null) return elapsedMs;
  return elapsedMs + (now - lastRenderAt);
}

export function isWebGLAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2") ?? probe.getContext("webgl");
    // This context is never used for rendering - just release it immediately
    // rather than leaking it until the throwaway canvas is garbage collected.
    // Called twice per mount (initial state + the media-query listener).
    (context as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch {
    // Some privacy tooling throws rather than returning null.
    return false;
  }
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uGlowIntensity;
uniform float uSaturation;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uMouseActiveFactor;

varying vec2 vUv;

#define NUM_LAYER 4.0
#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float tri(float x) {
  return abs(fract(x) * 2.0 - 1.0);
}

float tris(float x) {
  float t = fract(x);
  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
}

float trisn(float x) {
  float t = fract(x);
  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float Star(vec2 uv, float flare) {
  float d = length(uv);
  float m = (0.05 * uGlowIntensity) / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uGlowIntensity;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uGlowIntensity;
  m *= smoothstep(1.0, 0.2, d);
  return m;
}

vec3 StarLayer(vec2 uv) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + vec2(float(x), float(y));
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
      float grn = min(red, blu) * seed;
      vec3 base = vec3(red, grn, blu);

      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
      hue = fract(hue + uHueShift / 360.0);
      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
      float val = max(max(base.r, base.g), base.b);
      base = hsv2rgb(vec3(hue, sat, val));

      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;

      float star = Star(gv - offset - pad, flareSize);
      vec3 color = base;

      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      star *= twinkle;

      col += star * size * color;
    }
  }

  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution.xy;
  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;

  // Parallax: layers offset WITH the pointer. The original's repulsion branch
  // is removed rather than switched off, because it is not a mode we want.
  vec2 mouseNorm = uMouse - vec2(0.5);
  uv += mouseNorm * 0.1 * uMouseActiveFactor;

  float autoRotAngle = uTime * uRotationSpeed;
  mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));
  uv = autoRot * uv;
  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;

  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {
    float depth = fract(i + uStarSpeed * uSpeed);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    col += StarLayer(uv * scale + i * 453.32) * fade;
  }

  // Always transparent: the CSS nebula and grain paint over this canvas (it
  // is the first child of the starfield root, they come later, and nothing
  // here sets z-index), which is desirable — the nebula tints the stars
  // rather than sitting behind them, and that tint is what makes the WebGL
  // and fallback paths look like one product instead of two.
  float alpha = smoothstep(0.0, 0.3, length(col));
  gl_FragColor = vec4(col, min(alpha, 1.0));
}
`;

export function GalaxyCanvas({ onContextLost }: { onContextLost?: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Stored in a ref, not read directly: the effect below has empty deps by
  // design (see the header — inline array props would re-initialise WebGL on
  // every render), so reading the prop straight from the closure would go
  // stale after the first render. The ref stays current without becoming a
  // dependency.
  const onContextLostRef = useRef(onContextLost);
  onContextLostRef.current = onContextLost;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Capped at 1.5, not left uncapped: StarLayer runs a 3x3 neighbourhood loop
    // across 4 layers per pixel, so uncapped DPR on a retina display would
    // roughly quadruple fragment work for a resolution gain past this point
    // that is not visible in an ambient backdrop.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false, dpr });
    const gl = renderer.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Color(1, 1, 1) },
        uFocal: { value: FOCAL },
        uRotation: { value: ROTATION },
        uStarSpeed: { value: STAR_SPEED },
        uDensity: { value: DENSITY },
        uHueShift: { value: HUE_SHIFT },
        uSpeed: { value: SPEED },
        uMouse: { value: MOUSE },
        uGlowIntensity: { value: GLOW_INTENSITY },
        uSaturation: { value: SATURATION },
        uTwinkleIntensity: { value: TWINKLE_INTENSITY },
        uRotationSpeed: { value: ROTATION_SPEED },
        uMouseActiveFactor: { value: 0 },
      },
    });

    // The host always fills the viewport, so this only changes on resize —
    // caching it here avoids a layout read (getBoundingClientRect) on every
    // pointermove.
    let hostRect = host.getBoundingClientRect();

    const resize = () => {
      renderer.setSize(host.offsetWidth, host.offsetHeight);
      program.uniforms.uResolution.value = new Color(
        gl.canvas.width,
        gl.canvas.height,
        gl.canvas.width / Math.max(gl.canvas.height, 1),
      );
      hostRect = host.getBoundingClientRect();
    };
    window.addEventListener("resize", resize);
    resize();

    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    host.appendChild(gl.canvas);

    // A driver reset (GPU crash, OS-level context eviction) fires this event
    // rather than throwing, and leaves the canvas permanently blank unless
    // something reacts. preventDefault() signals we won't attempt WebGL
    // context restoration ourselves — we hand off to the CSS fallback
    // instead, via the ref so this stays readable by a stale-closure-free
    // effect with empty deps.
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLostRef.current?.();
    };
    gl.canvas.addEventListener("webglcontextlost", handleContextLost);

    const targetMouse = { x: 0.5, y: 0.5 };
    const smoothMouse = { x: 0.5, y: 0.5 };
    let targetActive = 0;
    let smoothActive = 0;
    let lastFrameAt = 0;
    let frameId = 0;
    // Accumulated animation time, in ms. Advances only on frames actually
    // rendered (see advanceAnimationTime), so a long spell in a background
    // tab or under prefers-reduced-motion does not show up as a jump in
    // rotation when the loop resumes.
    let elapsedMs = 0;
    let lastRenderAt: number | null = null;

    const update = (now: number) => {
      frameId = requestAnimationFrame(update);
      if (!shouldRenderFrame(now, lastFrameAt, document.hidden)) {
        // Break the delta chain across a pause so the next accepted frame
        // computes a zero (not huge) delta instead of folding the pause's
        // real-world duration into the animation.
        lastRenderAt = null;
        return;
      }
      lastFrameAt = now;
      elapsedMs = advanceAnimationTime(elapsedMs, now, lastRenderAt);
      lastRenderAt = now;

      const elapsedSeconds = elapsedMs * 0.001;
      program.uniforms.uTime.value = elapsedSeconds;
      program.uniforms.uStarSpeed.value = (elapsedSeconds * STAR_SPEED) / 10;

      const lerp = 0.05;
      smoothMouse.x += (targetMouse.x - smoothMouse.x) * lerp;
      smoothMouse.y += (targetMouse.y - smoothMouse.y) * lerp;
      smoothActive += (targetActive - smoothActive) * lerp;

      MOUSE[0] = smoothMouse.x;
      MOUSE[1] = smoothMouse.y;
      program.uniforms.uMouseActiveFactor.value = smoothActive;

      renderer.render({ scene: mesh });
    };

    const startLoop = () => {
      if (frameId) return;
      lastRenderAt = null;
      frameId = requestAnimationFrame(update);
    };
    const stopLoop = () => {
      if (!frameId) return;
      cancelAnimationFrame(frameId);
      frameId = 0;
    };

    // prefers-reduced-motion: CSS can neutralise CSS animations, but not this
    // rAF loop, and the caller only checks the preference once at mount. This
    // component has to stay correct on its own, including when the OS setting
    // is toggled mid-session.
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        stopLoop();
        // Static, not frozen mid-animation: one render at the current
        // uniforms so the backdrop still shows stars rather than going blank.
        renderer.render({ scene: mesh });
      } else {
        startLoop();
      }
    };
    motionQuery.addEventListener("change", handleMotionChange);

    if (motionQuery.matches) {
      renderer.render({ scene: mesh });
    } else {
      startLoop();
    }

    const handlePointerMove = (event: PointerEvent) => {
      targetMouse.x = (event.clientX - hostRect.left) / hostRect.width;
      targetMouse.y = 1 - (event.clientY - hostRect.top) / hostRect.height;
      targetActive = 1;
    };
    const handlePointerLeave = () => {
      targetActive = 0;
    };

    // pointermove: on window, not the host, because the host sits behind the
    // entire app and never receives pointer events itself.
    // pointerleave: on document, not window. pointerleave does not bubble,
    // and window is never its target, so a window listener never fires —
    // document is the nearest ancestor that actually receives it.
    window.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      stopLoop();
      motionQuery.removeEventListener("change", handleMotionChange);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", handlePointerLeave);
      gl.canvas.removeEventListener("webglcontextlost", handleContextLost);
      if (gl.canvas.parentNode === host) host.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <div aria-hidden="true" className="orbit-galaxy-canvas" data-testid="galaxy-canvas" ref={hostRef} />;
}
