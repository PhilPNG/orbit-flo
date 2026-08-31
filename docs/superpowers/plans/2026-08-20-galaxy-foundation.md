# Galaxy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Orbit Flo's static CSS starfield with a real WebGL galaxy, so a product themed as deep space stops rendering as a gradient.

**Architecture:** React Bits' Galaxy shader is vendored into `src/components/galaxy-canvas.tsx` as TypeScript running on `ogl`, with a frame cap and a hidden-tab pause added. `StarFieldBackground` keeps its name and empty props signature and chooses between that canvas and the existing CSS layers, so all five call sites are untouched.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, `ogl` (WebGL), Vitest + Testing Library.

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **The full suite must stay at 759 passing.** No existing test may be modified to accommodate this change. If an existing test breaks, the implementation is wrong, not the test.
- **`StarFieldBackground` keeps its exact current signature:** `export function StarFieldBackground()` — no props. Five files import it (`app-shell.tsx`, `auth-page.tsx`, `auth-callback-page.tsx`, `auth-reset-page.tsx`, `require-auth.tsx`) and **none of them may change.**
- **Cyan `#22d3ee` is the interaction colour and must not appear in atmosphere.** The teal token is permitted only as diffuse low-opacity mass — never a crisp edge, border, or defined boundary.
- **No existing `--orbit-*` token changes value.** This adds tokens only.
- The only new dependency is `ogl`. Nothing else.

---

## File Structure

**Modify:** `src/styles.css` — five atmosphere tokens, a richer nebula, and a `--webgl` modifier that hides the CSS star layers when the canvas is live.

**Create:** `src/components/galaxy-canvas.tsx` — the vendored shader, its WebGL lifecycle, and two exported pure helpers. Separate from `space-visuals.tsx` so the vendored third-party code has one clear home and the 173-line visuals module stays readable.

**Create:** `src/components/galaxy-canvas.test.tsx`

**Modify:** `src/components/space-visuals.tsx:4-22` — `StarFieldBackground` internals only.

**Modify:** `src/components/space-visuals.test.tsx` — add fallback-selection cases.

**Modify:** `package.json` — add `ogl`.

---

## Task 1: Atmosphere tokens and the richer nebula

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Produces: CSS custom properties `--orbit-nebula-violet`, `--orbit-nebula-magenta`, `--orbit-nebula-teal`, `--orbit-star-cool`, `--orbit-star-warm`, and the class `orbit-starfield-root--webgl`.

### Background you need

`src/styles.css` already defines 55 custom properties in a `:root` block, including `--orbit-space`, `--orbit-cyan`, and `--orbit-violet`. Line 933 currently holds the entire nebula:

```css
.orbit-nebula {
  background: radial-gradient(ellipse 70% 55% at 72% 12%, rgba(124, 58, 237, 0.09), transparent 70%);
}
```

One faint violet ellipse at 9% opacity. That is the "ambient bloom" the July spec describes, and it is most of why the product reads flat.

`.orbit-starfield-root` (line 638) is the container. `.orbit-star-layer` (line ~657) are the three drifting star layers. `.orbit-meteor` (line 941) are the streaks.

- [ ] **Step 1: Add the five atmosphere tokens**

Find the `:root` block containing `--orbit-violet` and add these five lines immediately after it:

```css
  /* Atmosphere only. These colour the backdrop and never a control.
     --orbit-nebula-teal sits closest to --orbit-cyan, which is the interaction
     colour, so it is permitted only as diffuse low-opacity mass: never a border,
     never a crisp edge. Cyan marks what you can touch partly through sharpness,
     and a teal line would blur that signal. */
  --orbit-nebula-violet: #7c3aed;
  --orbit-nebula-magenta: #c026d3;
  --orbit-nebula-teal: #0d9488;
  --orbit-star-cool: #e0f2fe;
  --orbit-star-warm: #fcd9a8;
```

- [ ] **Step 2: Replace the nebula with three layered masses**

Replace the whole `.orbit-nebula` rule at line 933 with:

```css
/* Three masses rather than one: a violet primary high-right, a magenta
   secondary low-left, and a teal counter-glow that keeps the two warm masses
   from reading as a single purple wash. Opacities stay under 0.14 because
   foreground surfaces must remain opaque enough that text never sits on
   visible colour. */
.orbit-nebula {
  background:
    radial-gradient(ellipse 70% 55% at 72% 12%, color-mix(in srgb, var(--orbit-nebula-violet) 13%, transparent), transparent 70%),
    radial-gradient(ellipse 60% 50% at 18% 82%, color-mix(in srgb, var(--orbit-nebula-magenta) 9%, transparent), transparent 72%),
    radial-gradient(ellipse 85% 60% at 8% 24%, color-mix(in srgb, var(--orbit-nebula-teal) 7%, transparent), transparent 75%);
}
```

- [ ] **Step 3: Add the WebGL modifier**

Append after the `.orbit-nebula` rule:

```css
/* When the WebGL galaxy is live it draws its own stars, twinkle and flares.
   The CSS layers would double them, so they are hidden — but the nebula and
   grain stay, because the canvas renders transparent and composites over them.
   That is what makes the two paths look like the same product rather than two
   different backgrounds. */
.orbit-starfield-root--webgl .orbit-star-layer,
.orbit-starfield-root--webgl .orbit-star-flare,
.orbit-starfield-root--webgl .orbit-meteor {
  display: none;
}

.orbit-galaxy-canvas {
  position: absolute;
  inset: 0;
}

.orbit-galaxy-canvas canvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 4: Verify nothing else changed and the build is clean**

```bash
git diff --stat src/styles.css
npm run build
```

Expected: only `src/styles.css` changed, and the build succeeds. Confirm the diff shows **no** modification to any existing `--orbit-*` value — additions only, plus the one `.orbit-nebula` rule replacement.

- [ ] **Step 5: Run the suite**

Run: `npm test -- --maxWorkers=2`
Expected: 759 passing. CSS is not unit-tested here, so this is a regression check: if a test breaks, a selector was renamed rather than added.

- [ ] **Step 6: Commit**

```bash
git add src/styles.css
git commit -m "feat: give the nebula three colour masses and add atmosphere tokens"
```

---

## Task 2: The vendored galaxy canvas

**Files:**
- Create: `src/components/galaxy-canvas.tsx`, `src/components/galaxy-canvas.test.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `export function GalaxyCanvas(): JSX.Element` — renders a div that hosts a WebGL canvas. Takes **no props**.
  - `export function isWebGLAvailable(): boolean`
  - `export function shouldRenderFrame(now: number, lastFrameAt: number, hidden: boolean): boolean`
  - `export const FRAME_INTERVAL_MS: number`

### Background you need

**This code is vendored from React Bits (MIT), not written from scratch.** Keep the attribution header. Three deliberate changes from the original, all of which matter:

1. **The original's `useEffect` dependency array includes `focal` and `rotation`, which are arrays.** Passing inline literals would give new identities every render and re-initialise WebGL on every render. This version takes **no props** and uses module-level constants, which removes the footgun entirely rather than documenting it.
2. **`mouseRepulsion` is `false`.** The original defaults it to `true`, which pushes stars *away* from the cursor. The spec asks for parallax — stars offsetting *with* pointer position — which is the shader's `else` branch.
3. **A frame cap and a hidden-tab pause are added.** The original runs uncapped `requestAnimationFrame` forever, including in a background tab.

**The WebGL lifecycle cannot be tested in jsdom** — there is no WebGL context, so `new Renderer()` throws. That is why the frame-gating decision is extracted into `shouldRenderFrame`, a pure function. Test that. Do not mock WebGL to manufacture coverage of the lifecycle; a mocked canvas would prove nothing about a real one.

- [ ] **Step 1: Install the dependency**

```bash
npm install ogl
```

Then confirm it ships TypeScript types:

```bash
ls node_modules/ogl/types/index.d.ts && node -e "console.log(require('./node_modules/ogl/package.json').types || require('./node_modules/ogl/package.json').typings || 'NO TYPES FIELD')"
```

If that prints a path, types are present and nothing more is needed. If it prints `NO TYPES FIELD` or the file is missing, create `src/types/ogl.d.ts` with exactly:

```ts
declare module "ogl" {
  export class Renderer {
    constructor(options?: Record<string, unknown>);
    gl: WebGL2RenderingContext & { canvas: HTMLCanvasElement };
    setSize(width: number, height: number): void;
    render(options: { scene: unknown }): void;
  }
  export class Program {
    constructor(gl: unknown, options: Record<string, unknown>);
    uniforms: Record<string, { value: unknown }>;
  }
  export class Mesh {
    constructor(gl: unknown, options: Record<string, unknown>);
  }
  export class Triangle {
    constructor(gl: unknown);
  }
  export class Color {
    constructor(r: number, g: number, b: number);
  }
}
```

Report which branch you took.

- [ ] **Step 2: Write the failing tests**

Create `src/components/galaxy-canvas.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { FRAME_INTERVAL_MS, isWebGLAvailable, shouldRenderFrame } from "./galaxy-canvas";

describe("shouldRenderFrame", () => {
  it("never renders while the tab is hidden", () => {
    // The battery claim in the spec. An animation loop in a background tab is
    // pure cost, and this app is one people leave open all day.
    expect(shouldRenderFrame(100_000, 0, true)).toBe(false);
  });

  it("skips frames that arrive before the interval has elapsed", () => {
    // The frame cap. A 240Hz display should not do four times the work for no
    // visible benefit.
    expect(shouldRenderFrame(1_000, 1_000 - (FRAME_INTERVAL_MS - 1), false)).toBe(false);
  });

  it("renders once the interval has elapsed", () => {
    expect(shouldRenderFrame(1_000, 1_000 - FRAME_INTERVAL_MS, false)).toBe(true);
  });

  it("renders the very first frame", () => {
    // lastFrameAt starts at 0, so the first call must not be gated.
    expect(shouldRenderFrame(16, 0, false)).toBe(true);
  });
});

describe("isWebGLAvailable", () => {
  it("reports false under jsdom, which has no WebGL", () => {
    // This is what keeps the existing suite green: StarFieldBackground asks
    // this question and takes the CSS path. If this ever returns true here,
    // the guard is not doing what the whole design depends on.
    expect(isWebGLAvailable()).toBe(false);
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 galaxy-canvas`
Expected: FAIL, "Failed to resolve import ./galaxy-canvas".

- [ ] **Step 4: Implement**

Create `src/components/galaxy-canvas.tsx`:

```tsx
/**
 * Galaxy backdrop.
 *
 * Vendored from React Bits (https://reactbits.dev), MIT licensed, by David Haz.
 * The shader is theirs; the frame cap, the hidden-tab pause, the WebGL guard
 * and the TypeScript are ours. Vendored rather than depended on because React
 * Bits ships copy-paste source, not a package — which means bugs in here are
 * ours to fix.
 *
 * Deliberate departures from the original, each for a reason:
 *
 * - No props. The original's effect depends on `focal` and `rotation`, which
 *   are arrays, so inline literals would re-initialise WebGL on every render.
 *   Module-level constants remove the trap instead of documenting it.
 * - `uMouseRepulsion` is false. The original pushes stars away from the cursor;
 *   we want parallax, which is the shader's else branch.
 * - Capped and pausable. The original animates uncapped, forever, including in
 *   a background tab.
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

export function isWebGLAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
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

  // Always transparent: the canvas composites over the CSS nebula and grain,
  // which is what makes the WebGL and fallback paths look like one product.
  float alpha = smoothstep(0.0, 0.3, length(col));
  gl_FragColor = vec4(col, min(alpha, 1.0));
}
`;

export function GalaxyCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
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

    const resize = () => {
      renderer.setSize(host.offsetWidth, host.offsetHeight);
      program.uniforms.uResolution.value = new Color(
        gl.canvas.width,
        gl.canvas.height,
        gl.canvas.width / Math.max(gl.canvas.height, 1),
      );
    };
    window.addEventListener("resize", resize);
    resize();

    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    host.appendChild(gl.canvas);

    const targetMouse = { x: 0.5, y: 0.5 };
    const smoothMouse = { x: 0.5, y: 0.5 };
    let targetActive = 0;
    let smoothActive = 0;
    let lastFrameAt = 0;
    let frameId = 0;

    const update = (now: number) => {
      frameId = requestAnimationFrame(update);
      if (!shouldRenderFrame(now, lastFrameAt, document.hidden)) return;
      lastFrameAt = now;

      program.uniforms.uTime.value = now * 0.001;
      program.uniforms.uStarSpeed.value = (now * 0.001 * STAR_SPEED) / 10;

      const lerp = 0.05;
      smoothMouse.x += (targetMouse.x - smoothMouse.x) * lerp;
      smoothMouse.y += (targetMouse.y - smoothMouse.y) * lerp;
      smoothActive += (targetActive - smoothActive) * lerp;

      MOUSE[0] = smoothMouse.x;
      MOUSE[1] = smoothMouse.y;
      program.uniforms.uMouseActiveFactor.value = smoothActive;

      renderer.render({ scene: mesh });
    };
    frameId = requestAnimationFrame(update);

    const handlePointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      targetMouse.x = (event.clientX - rect.left) / rect.width;
      targetMouse.y = 1 - (event.clientY - rect.top) / rect.height;
      targetActive = 1;
    };
    const handlePointerLeave = () => {
      targetActive = 0;
    };

    // On window, not the host: the host is behind the entire app and never
    // receives pointer events itself.
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      if (gl.canvas.parentNode === host) host.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <div aria-hidden="true" className="orbit-galaxy-canvas" data-testid="galaxy-canvas" ref={hostRef} />;
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- --maxWorkers=2 galaxy-canvas`
Expected: PASS, 5 tests.

- [ ] **Step 6: Typecheck and build**

Run: `npm run build`
Expected: succeeds. If `tsc` complains about `ogl` having no types, go back to Step 1 and add the declaration file.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/galaxy-canvas.tsx src/components/galaxy-canvas.test.tsx src/types/ogl.d.ts
git commit -m "feat: vendor the React Bits galaxy shader with a frame cap and tab pause"
```

`src/types/ogl.d.ts` may not exist; `git add` of a missing path fails, so drop it from the command if you did not create it.

---

## Task 3: Wire it into StarFieldBackground

**Files:**
- Modify: `src/components/space-visuals.tsx:4-22`
- Modify: `src/components/space-visuals.test.tsx`

**Interfaces:**
- Consumes: `GalaxyCanvas`, `isWebGLAvailable` from `./galaxy-canvas`.

### Background you need

`StarFieldBackground` currently renders a fixed root containing three star layers, a nebula, a grain texture, two flares and three meteors. Its current source is at `src/components/space-visuals.tsx:4-22`.

It must now decide between two paths. **The CSS path is not a test shim** — it is what a user on a blocked, failed, or software-rasterised WebGL context sees, and it must keep looking good.

The canvas is used when **all three** hold:
1. WebGL is available
2. the user has not asked for reduced motion
3. `import.meta.env.VITE_CAPTURE_MODE !== "1"` — the signal that already exists in `src/vite-env.d.ts` and already gates the visual-review route in `src/app/routes.tsx:38`. Screenshots must be deterministic, and a drifting background would make every capture differ.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/space-visuals.test.tsx`, inside the existing `describe("space visuals", ...)` block:

```tsx
  it("falls back to CSS layers when WebGL is unavailable", () => {
    // jsdom has no WebGL, so this is the real path here — and it is also what
    // a user with a blocked GPU sees. The CSS layers must survive.
    const { container } = render(<StarFieldBackground />);

    expect(container.querySelector(".orbit-galaxy-canvas")).toBeNull();
    expect(container.querySelectorAll(".orbit-star-layer")).toHaveLength(3);
    expect(container.querySelector(".orbit-starfield-root--webgl")).toBeNull();
  });

  it("keeps the nebula and grain on the fallback path", () => {
    // The nebula carries the colour. Losing it would make the fallback a flat
    // black rectangle rather than a quieter version of the same product.
    const { container } = render(<StarFieldBackground />);

    expect(container.querySelector(".orbit-nebula")).not.toBeNull();
    expect(container.querySelector(".orbit-grain")).not.toBeNull();
  });

  it("hides decorative layers from assistive technology either way", () => {
    const { container } = render(<StarFieldBackground />);

    expect(container.querySelector(".orbit-starfield-root")).toHaveAttribute("aria-hidden", "true");
  });
```

- [ ] **Step 2: Run them and expect them to PASS — which is the problem**

Run: `npm test -- --maxWorkers=2 space-visuals`
Expected: **all three PASS**, before any implementation exists.

That is not a mistake in the plan, and you must not treat it as success. These
tests assert the absence of a canvas, and no canvas can exist yet, so they are
trivially true — the classic vacuous green this codebase has been bitten by
before. They become evidence only in Step 4, where you force the flag on and
watch them fail. Do not skip that step.

- [ ] **Step 3: Implement**

Replace `src/components/space-visuals.tsx` lines 4-22 (the whole `StarFieldBackground` function) with:

```tsx
export function StarFieldBackground() {
  // Decided once per mount. All three conditions are about the user's machine
  // or preferences, none of which change while a page is open.
  const useGalaxy = useMemo(() => {
    if (import.meta.env.VITE_CAPTURE_MODE === "1") return false;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    return isWebGLAvailable();
  }, []);

  return (
    <div
      aria-hidden="true"
      className={clsx("orbit-starfield-root pointer-events-none", useGalaxy && "orbit-starfield-root--webgl")}
    >
      {useGalaxy ? <GalaxyCanvas /> : null}
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
```

The CSS layers stay in the tree on both paths and are hidden by the `--webgl` modifier from Task 1. Keeping them mounted rather than conditionally rendering them means one DOM shape, one set of selectors, and no chance of the two paths drifting apart structurally.

Update the imports at the top of the file:

```tsx
import { clsx } from "clsx";
import { useMemo } from "react";
import { orbitAssets } from "../lib/orbit-assets";
import { GalaxyCanvas, isWebGLAvailable } from "./galaxy-canvas";
```

- [ ] **Step 4: Red-proof the new tests**

Temporarily change `const useGalaxy = useMemo(...)` to `const useGalaxy = true;` and run:

Run: `npm test -- --maxWorkers=2 space-visuals`
Expected: FAIL — `.orbit-galaxy-canvas` is found when the test asserts it is null, and `.orbit-starfield-root--webgl` is present.

This is the step that proves the tests test something. **Then revert to the real `useMemo` implementation** and confirm they pass again. Report both outcomes.

Note: with `useGalaxy = true`, `GalaxyCanvas` mounts and `new Renderer()` throws in jsdom. If the failure you see is that throw rather than the assertion, that is fine — it still demonstrates the tests are sensitive to the flag. Say which you saw.

- [ ] **Step 5: Run the full suite and build**

```bash
npm test -- --maxWorkers=2
npm run build
```

Expected: **759 passing** plus the 5 new galaxy-canvas tests and the 3 new space-visuals tests, and a clean build. No pre-existing test may have been modified.

- [ ] **Step 6: Verify the five call sites are untouched**

```bash
git diff --stat src/components/app-shell.tsx src/features/auth/ src/app/routes.tsx
```

Expected: **no output.** If any of those files changed, the signature was broken and the change is wrong.

- [ ] **Step 7: Commit**

```bash
git add src/components/space-visuals.tsx src/components/space-visuals.test.tsx
git commit -m "feat: render the galaxy canvas when the machine and the user allow it"
```

---

## Self-review notes

**Spec coverage.** Five atmosphere tokens and the richer nebula → Task 1. The vendored shader, `ogl`, the frame cap and the hidden-tab pause → Task 2. Fallback selection on all three conditions, and the untouched call sites → Task 3. The `--webgl` modifier that stops the two star systems doubling → Task 1, consumed in Task 3.

**The one thing I could not put in a test.** The WebGL lifecycle itself. jsdom has no WebGL, so `GalaxyCanvas`'s effect cannot run here, and mocking a canvas would produce coverage that proves nothing about a real GPU. Instead the two claims worth defending — the frame cap and the hidden-tab pause — are extracted into `shouldRenderFrame`, a pure function, and tested directly. An untested battery claim is a wish.

**Why Task 3 Step 4 exists.** The new fallback tests would pass before the feature is written, because "no canvas present" is trivially true when no canvas can exist. That is the classic vacuous green. Forcing the flag and watching them fail is the only thing that makes them evidence.

**Deliberately not here.** Shimmer — the new foreground loop verb — is defined in the spec but applied to no component in this plan. It belongs to sub-project 2, against real buttons and cards, where the three craft rules can be judged rather than guessed at.
