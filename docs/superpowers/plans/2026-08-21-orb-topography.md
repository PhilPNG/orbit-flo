# Orb and Topography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-built orbit diagram on `/auth` with a real glowing orb, and give the inside of a project its own contour-map backdrop over the galaxy.

**Architecture:** Two more React Bits components vendored onto `ogl`, each hardened with the guards this project now expects. `AuthOrbitScene` keeps its name and empty props so its call site is untouched; Topography mounts only inside a project and unmounts on leaving.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, `ogl` (already a dependency), Vitest + Testing Library.

## Global Constraints

- Run tests with `npm test -- --maxWorkers=2`.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **803 tests currently pass.** Exactly **one** existing test may change — see Task 1, Step 1, where an assertion about a deleted image is replaced. **No other existing test may be modified.**
- **No new dependency.** `ogl` is already present.
- `AuthOrbitScene` keeps its exact signature: `export function AuthOrbitScene()`, no props. `src/features/auth/auth-page.tsx` must not change.
- Every canvas carries its own `matchMedia` reduced-motion guard. CSS cannot reach canvas drawing — `galaxy-canvas.tsx`, `click-spark.tsx` and `electric-border.tsx` all do this; match them.
- All CSS animation goes inside the single existing `@media (prefers-reduced-motion: no-preference)` block. Do not create a second.

---

## File Structure

**Create:** `src/components/orb.tsx`, `src/components/orb.test.tsx` — the vendored orb and its guards.

**Create:** `src/components/topography.tsx`, `src/components/topography.test.tsx` — the vendored contour background.

**Modify:** `src/components/auth-orbit-scene.tsx` — internals only.

**Modify:** `src/features/auth/auth-page.test.tsx` — one assertion, replaced.

**Modify:** `src/features/projects/project-workspace-page.tsx` — mount Topography.

**Modify:** `src/styles.css` — delete the orphaned ring/core/node/twinkle rules; add the Topography layer.

**Modify:** `LICENSES/react-bits-MIT.txt` — record the third and fourth vendored components.

---

## Task 1: The orb on the sign-in page

**Files:**
- Create: `src/components/orb.tsx`, `src/components/orb.test.tsx`
- Modify: `src/components/auth-orbit-scene.tsx`, `src/features/auth/auth-page.test.tsx`, `src/styles.css`, `LICENSES/react-bits-MIT.txt`

**Interfaces:**
- Produces: `export function Orb(): JSX.Element` — no props.

### Background you need

`src/components/auth-orbit-scene.tsx` currently renders three rings, a raster core image, two orbiting nodes, two twinkles, **and four labelled cards** (`Plan`, `Brainstorm`, `Mind map`, `Review`).

**The four cards are product messaging, not decoration** — they are the only thing on the sign-in page that says what Orbit Flo is for. They stay. Only the rings, core art, nodes and twinkles are replaced.

**One existing test asserts on the deleted image.** `src/features/auth/auth-page.test.tsx:76-79` reads:

```tsx
    expect(screen.getByTestId("auth-orbit-core-art")).toHaveAttribute(
      "src",
      orbitAssets.illustrations.authOrbitCore,
    );
```

That element ceases to exist, so this assertion must be replaced. It is the **only** existing test permitted to change in this plan, and it is replaced with something stronger, not merely deleted. Line 115's `expect(screen.getByTestId("auth-orbit-scene")).toBeInTheDocument();` **survives untouched** — the scene container stays.

Vendored from React Bits (MIT). Five departures from the original, each for a reason:

1. **No props.** The original's effect depends on five props; ours needs none, and the same reasoning that made `GalaxyCanvas` propless applies.
2. **A device-pixel-ratio cap.** The original uses `window.devicePixelRatio` **uncapped**. On a 4K display that is four times the fragment work, on the first screen a visitor sees.
3. **A reduced-motion guard.**
4. **Paused when the tab is hidden and when scrolled off-screen.** `/auth` scrolls on a narrow viewport.
5. **A frame cap.**

- [ ] **Step 1: Replace the assertion about the deleted image**

In `src/features/auth/auth-page.test.tsx`, replace lines 76-79 (the `auth-orbit-core-art` assertion shown above) with:

```tsx
    // The orbit core image is gone, replaced by a WebGL orb. What matters on
    // this page is not the artwork but the four feature labels around it - they
    // are the only thing telling a visitor what this product does, and this
    // assertion is what stops a future change quietly deleting them.
    expect(screen.getByText("Plan")).toBeVisible();
    expect(screen.getByText("Brainstorm")).toBeVisible();
    expect(screen.getByText("Mind map")).toBeVisible();
    expect(screen.getByText("Review")).toBeVisible();
```

If `orbitAssets` becomes an unused import in that file, remove the import too. **Do not change any other assertion in the file.**

- [ ] **Step 2: Run it and expect it to PASS**

Run: `npm test -- --maxWorkers=2 auth-page`
Expected: **PASS.** The four labels already render today, so the new assertions
are green immediately and the removed one is simply gone.

That is not a red-green cycle and it is not pretending to be. This assertion's
value is as a *guard* against future deletion, not as a driver of new code, so
it gets red-proofed explicitly in Step 10 instead.

- [ ] **Step 3: Write the orb's failing tests**

Create `src/components/orb.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Orb } from "./orb";

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

describe("Orb", () => {
  afterEach(() => vi.restoreAllMocks());

  it("draws nothing when the user prefers reduced motion", () => {
    // The only guard CSS cannot provide, on the first screen a visitor sees.
    setReducedMotion(true);
    const { container } = render(<Orb />);

    expect(container.querySelector("canvas")).toBeNull();
  });

  it("mounts a canvas when motion is allowed", () => {
    setReducedMotion(false);
    const { container } = render(<Orb />);

    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("marks its canvas decorative", () => {
    setReducedMotion(false);
    const { container } = render(<Orb />);

    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 4: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 orb`
Expected: FAIL, "Failed to resolve import ./orb".

- [ ] **Step 5: Implement the orb**

Create `src/components/orb.tsx`:

```tsx
/**
 * The glowing sphere on the sign-in page.
 *
 * Vendored from React Bits (https://reactbits.dev), MIT licensed, by David Haz.
 * See LICENSES/react-bits-MIT.txt. Retrieved 2026-08-21 from
 * https://github.com/DavidHDev/react-bits, path
 * src/content/Backgrounds/Orb/Orb.jsx
 *
 * Five departures from the original:
 *
 * - No props. The original's effect depends on five, so any inline value would
 *   re-initialise WebGL; ours needs none.
 * - A device-pixel-ratio cap. The original is UNCAPPED, which on a 4K display
 *   is four times the fragment work - on the first screen a visitor sees, which
 *   is exactly where they decide whether this product feels fast.
 * - A reduced-motion guard, because CSS cannot reach canvas drawing.
 * - Paused when the tab is hidden and when scrolled out of view. /auth scrolls
 *   on a narrow viewport and an animating canvas below the fold is pure cost.
 * - A frame cap.
 *
 * Its base colours are already violet and cyan. HUE_SHIFT pushes it
 * violet-dominant so it does not compete with cyan, which in this product means
 * "you can touch this".
 */
import { Mesh, Program, Renderer, Triangle, Vec3 } from "ogl";
import { useEffect, useRef, useState } from "react";

const FRAME_INTERVAL_MS = 1000 / 30;
const MAX_DPR = 1.5;
/** Degrees. Pushes the default violet/cyan pair toward violet. */
const HUE_SHIFT = 30;
const HOVER_INTENSITY = 0.25;
const ROTATION_SPEED = 0.3;

const vertexShader = `
  precision highp float;
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float iTime;
  uniform vec3 iResolution;
  uniform float hue;
  uniform float hover;
  uniform float rot;
  uniform float hoverIntensity;
  varying vec2 vUv;

  vec3 rgb2yiq(vec3 c) {
    float y = dot(c, vec3(0.299, 0.587, 0.114));
    float i = dot(c, vec3(0.596, -0.274, -0.322));
    float q = dot(c, vec3(0.211, -0.523, 0.312));
    return vec3(y, i, q);
  }

  vec3 yiq2rgb(vec3 c) {
    float r = c.x + 0.956 * c.y + 0.621 * c.z;
    float g = c.x - 0.272 * c.y - 0.647 * c.z;
    float b = c.x - 1.106 * c.y + 1.703 * c.z;
    return vec3(r, g, b);
  }

  vec3 adjustHue(vec3 color, float hueDeg) {
    float hueRad = hueDeg * 3.14159265 / 180.0;
    vec3 yiq = rgb2yiq(color);
    float cosA = cos(hueRad);
    float sinA = sin(hueRad);
    float i = yiq.y * cosA - yiq.z * sinA;
    float q = yiq.y * sinA + yiq.z * cosA;
    yiq.y = i;
    yiq.z = q;
    return yiq2rgb(yiq);
  }

  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yxz + 19.19);
    return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
  }

  float snoise3(vec3 p) {
    const float K1 = 0.333333333;
    const float K2 = 0.166666667;
    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
    vec3 e = step(vec3(0.0), d0 - d0.yzx);
    vec3 i1 = e * (1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy * (1.0 - e);
    vec3 d1 = d0 - (i1 - K2);
    vec3 d2 = d0 - (i2 - K1);
    vec3 d3 = d0 - 0.5;
    vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
    vec4 n = h * h * h * h * vec4(
      dot(d0, hash33(i)),
      dot(d1, hash33(i + i1)),
      dot(d2, hash33(i + i2)),
      dot(d3, hash33(i + 1.0))
    );
    return dot(vec4(31.316), n);
  }

  vec4 extractAlpha(vec3 colorIn) {
    float a = max(max(colorIn.r, colorIn.g), colorIn.b);
    return vec4(colorIn.rgb / (a + 1e-5), a);
  }

  const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
  const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
  const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
  const float innerRadius = 0.6;
  const float noiseScale = 0.65;

  float light1(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * attenuation);
  }
  float light2(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * dist * attenuation);
  }

  vec4 draw(vec2 uv) {
    vec3 color1 = adjustHue(baseColor1, hue);
    vec3 color2 = adjustHue(baseColor2, hue);
    vec3 color3 = adjustHue(baseColor3, hue);

    float ang = atan(uv.y, uv.x);
    float len = length(uv);
    float invLen = len > 0.0 ? 1.0 / len : 0.0;

    float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
    float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
    float d0 = distance(uv, (r0 * invLen) * uv);
    float v0 = light1(1.0, 10.0, d0);
    v0 *= smoothstep(r0 * 1.05, r0, len);
    v0 *= smoothstep(r0 * 0.8, r0 * 0.95, len);
    float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

    float a = iTime * -1.0;
    vec2 pos = vec2(cos(a), sin(a)) * r0;
    float d = distance(uv, pos);
    float v1 = light2(1.5, 5.0, d);
    v1 *= light1(1.0, 50.0, d0);

    float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
    float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

    vec3 col = mix(color1, color2, cl);
    col = mix(color3, col, v0);
    col = (col + v1) * v2 * v3;
    col = clamp(col, 0.0, 1.0);

    return extractAlpha(col);
  }

  vec4 mainImage(vec2 fragCoord) {
    vec2 center = iResolution.xy * 0.5;
    float size = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - center) / size * 2.0;

    float angle = rot;
    float s = sin(angle);
    float c = cos(angle);
    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

    uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
    uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

    return draw(uv);
  }

  void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    vec4 col = mainImage(fragCoord);
    gl_FragColor = vec4(col.rgb * col.a, col.a);
  }
`;

export function Orb() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [allowed, setAllowed] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const sync = () => setAllowed(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const host = hostRef.current;
    if (!host) return;

    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.canvas.setAttribute("aria-hidden", "true");
    host.appendChild(gl.canvas);

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Vec3(1, 1, 1) },
        hue: { value: HUE_SHIFT },
        hover: { value: 0 },
        rot: { value: 0 },
        hoverIntensity: { value: HOVER_INTENSITY },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    // Capped, unlike upstream. See the header.
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      renderer.setSize(width * dpr, height * dpr);
      gl.canvas.style.width = `${width}px`;
      gl.canvas.style.height = `${height}px`;
      program.uniforms.iResolution.value.set(
        gl.canvas.width,
        gl.canvas.height,
        gl.canvas.width / Math.max(gl.canvas.height, 1),
      );
    };
    window.addEventListener("resize", resize);
    resize();

    let targetHover = 0;
    let currentRot = 0;
    let lastTime = 0;
    let lastFrameAt = 0;
    let frameId = 0;
    let onScreen = true;
    let pageVisible = !document.hidden;

    const draw = (now: number) => {
      frameId = requestAnimationFrame(draw);
      if (lastFrameAt !== 0 && now - lastFrameAt < FRAME_INTERVAL_MS) return;
      const dt = lastTime === 0 ? 0 : (now - lastTime) / 1000;
      lastTime = now;
      lastFrameAt = now;

      program.uniforms.iTime.value = now * 0.001;
      program.uniforms.hover.value += (targetHover - program.uniforms.hover.value) * 0.1;
      if (program.uniforms.hover.value > 0.5) currentRot += dt * ROTATION_SPEED;
      program.uniforms.rot.value = currentRot;

      renderer.render({ scene: mesh });
    };

    const start = () => {
      if (frameId === 0 && onScreen && pageVisible) {
        lastTime = 0;
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        onScreen ? start() : stop();
      },
      { threshold: 0 },
    );
    observer.observe(host);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      pageVisible ? start() : stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height) || 1;
      const x = ((event.clientX - rect.left - rect.width / 2) / size) * 2;
      const y = ((event.clientY - rect.top - rect.height / 2) / size) * 2;
      targetHover = Math.hypot(x, y) < 0.8 ? 1 : 0;
    };
    const onPointerLeave = () => {
      targetHover = 0;
    };
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);

    start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      if (gl.canvas.parentNode === host) host.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [allowed]);

  return <div aria-hidden="true" className="auth-orb-host" ref={hostRef} />;
}
```

- [ ] **Step 6: Run the orb tests**

Run: `npm test -- --maxWorkers=2 orb`
Expected: PASS, 3 tests.

- [ ] **Step 7: Rewrite the scene**

Replace `src/components/auth-orbit-scene.tsx` entirely with:

```tsx
import { Orb } from "./orb";

// These four labels are the only thing on the sign-in page that says what this
// product does. They are content, not decoration - the orb replaced the rings
// and the core artwork, not these.
const satellites = [
  { label: "Plan", className: "auth-orbit-satellite-one", tone: "cyan" },
  { label: "Brainstorm", className: "auth-orbit-satellite-two", tone: "blue" },
  { label: "Mind map", className: "auth-orbit-satellite-three", tone: "violet" },
  { label: "Review", className: "auth-orbit-satellite-four", tone: "cyan" },
];

export function AuthOrbitScene() {
  return (
    <div aria-hidden="true" className="auth-orbit-scene mt-6" data-testid="auth-orbit-scene">
      <Orb />
      {satellites.map((satellite) => (
        <div className={`auth-orbit-card ${satellite.className}`} key={satellite.label}>
          <span className={`auth-orbit-card-dot auth-orbit-card-dot-${satellite.tone}`} />
          <span>{satellite.label}</span>
        </div>
      ))}
    </div>
  );
}
```

**Note the `aria-hidden="true"` on the wrapper is inherited from the original.** The satellite labels are decorative-by-declaration today; keep it exactly as it was so this task changes visuals only, not accessibility semantics.

- [ ] **Step 8: Add the orb host CSS and delete the orphaned rules**

In `src/styles.css`, add beside the other `auth-orbit-*` rules:

```css
  /* The orb fills the space the ring diagram used to occupy. */
  .auth-orb-host {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .auth-orb-host canvas {
    display: block;
    margin: 0 auto;
  }
```

Then **delete** every rule for `.auth-orbit-ring`, `.auth-orbit-ring-wide`, `.auth-orbit-ring-mid`, `.auth-orbit-ring-tight`, `.auth-orbit-core-art`, `.auth-orbit-path`, `.auth-orbit-path-one`, `.auth-orbit-path-two`, `.auth-orbit-node`, `.auth-orbit-node-violet`, `.auth-orbit-twinkle`, `.auth-orbit-twinkle-one`, `.auth-orbit-twinkle-two`, including any inside the `@media (prefers-reduced-motion: no-preference)` block and any `@keyframes` used only by them.

**Keep** `.auth-orbit-scene`, `.auth-orbit-card`, `.auth-orbit-card-dot*` and `.auth-orbit-satellite-*` — all still in use.

Then prove nothing dangles:

```bash
grep -rnE "auth-orbit-(ring|core-art|path|node|twinkle)" src/
```

Expected: **no output.** If anything remains, report what and where rather than deleting further.

- [ ] **Step 9: Record the vendored components**

Append to `LICENSES/react-bits-MIT.txt` a line noting that `src/components/orb.tsx` is also derived from React Bits under this licence, alongside the existing entries.

- [ ] **Step 10: Run everything**

```bash
npm test -- --maxWorkers=2 auth-page orb
npm test -- --maxWorkers=2
npm run build
git diff --stat src/features/auth/auth-page.tsx
```

Expected: all passing; the full suite at 803 plus your 3 new orb tests; clean build; and **no output** from the last command — `auth-page.tsx` must be untouched.

Then **red-proof the guard from Step 1**, since it never failed: temporarily
delete the `Review` entry from the `satellites` array in
`src/components/auth-orbit-scene.tsx` and re-run `npm test -- --maxWorkers=2 auth-page`.
Expected: FAIL on the missing `Review` label. Restore the entry, confirm green
again, and report all three outcomes. A guard that has never failed is not a
guard.

- [ ] **Step 11: Commit**

```bash
git add src/components/orb.tsx src/components/orb.test.tsx src/components/auth-orbit-scene.tsx src/features/auth/auth-page.test.tsx src/styles.css LICENSES/react-bits-MIT.txt
git commit -m "feat: put a real orb on the sign-in page"
```

---

## Task 2: Topography inside a project

**Files:**
- Create: `src/components/topography.tsx`, `src/components/topography.test.tsx`
- Modify: `src/features/projects/project-workspace-page.tsx`, `src/styles.css`, `LICENSES/react-bits-MIT.txt`

**Interfaces:**
- Produces: `export function Topography(): JSX.Element` — no props.

### Background you need

Vendored from React Bits (MIT). **It already has good hygiene** — an `IntersectionObserver`, a `visibilitychange` pause and a `ResizeObserver`, and its DPR is already capped at 2. Keep all of that. Four departures:

1. **A WebGL 2 check.** Its shaders are `#version 300 es`. The galaxy is WebGL 1, so a machine that runs the galaxy may still lack WebGL 2. Without a context, render nothing and let the galaxy show through.
2. **A reduced-motion guard.**
3. **Mouse listeners removed.** Upstream binds `mousemove`/`mouseleave` to its own canvas. This sits behind `pointer-events: none` UI where they can never fire — listeners that cannot run read as a feature and are not one.
4. **A frame cap**, and colours retuned from upstream's `#5227FF`/`#FF9FFC` to this product's nebula tokens.

- [ ] **Step 1: Write the failing tests**

Create `src/components/topography.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Topography } from "./topography";

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

describe("Topography", () => {
  afterEach(() => vi.restoreAllMocks());

  it("draws nothing when the user prefers reduced motion", () => {
    setReducedMotion(true);
    const { container } = render(<Topography />);

    expect(container.querySelector("canvas")).toBeNull();
  });

  it("draws nothing without WebGL 2", () => {
    // jsdom has no WebGL at all, so this is the real path here - and it is also
    // what a machine with WebGL 1 only sees. The galaxy shows through instead
    // of a dead canvas.
    setReducedMotion(false);
    const { container } = render(<Topography />);

    expect(container.querySelector("canvas")).toBeNull();
  });

  it("renders a decorative host that never takes pointer events", () => {
    setReducedMotion(false);
    const { container } = render(<Topography />);
    const host = container.querySelector(".orbit-topography");

    expect(host).not.toBeNull();
    expect(host).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -- --maxWorkers=2 topography`
Expected: FAIL, "Failed to resolve import ./topography".

- [ ] **Step 3: Implement**

Create `src/components/topography.tsx`:

```tsx
/**
 * Contour-map lines behind a project workspace.
 *
 * Vendored from React Bits (https://reactbits.dev), MIT licensed, by David Haz.
 * See LICENSES/react-bits-MIT.txt. Retrieved 2026-08-21 from
 * https://github.com/DavidHDev/react-bits, path
 * src/content/Backgrounds/Topography/Topography.jsx
 *
 * Upstream already pauses off-screen and when the tab is hidden, and already
 * caps DPR - all kept. Four departures:
 *
 * - A WebGL 2 check. These shaders are #version 300 es while the galaxy is
 *   WebGL 1, so a machine that runs the galaxy may still lack WebGL 2. Without
 *   a context we render nothing and the galaxy shows through.
 * - A reduced-motion guard, because CSS cannot reach canvas drawing.
 * - Mouse listeners removed. Upstream binds them to its own canvas, which here
 *   sits behind pointer-events: none UI where they can never fire.
 * - A frame cap, and colours retuned to this product's nebula tokens.
 *
 * This layers OVER the galaxy rather than replacing it, which is a deliberate
 * choice made with the two-context cost known and measured.
 */
import { Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef, useState } from "react";

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
    return Boolean(document.createElement("canvas").getContext("webgl2"));
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
    return hasWebGL2();
  });

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const sync = () => setAllowed(!query.matches && hasWebGL2());
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!allowed) return;
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
      if (gl.canvas.parentNode === host) host.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [allowed]);

  return <div aria-hidden="true" className="orbit-topography" ref={hostRef} />;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- --maxWorkers=2 topography`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the layer CSS**

In `src/styles.css`, beside the other background rules:

```css
/* Sits above the galaxy (z-index 0) and below all content. Fixed, so scrolling
   a long project does not drag the contours with it. */
.orbit-topography {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
```

- [ ] **Step 6: Mount it inside a project**

In `src/features/projects/project-workspace-page.tsx`, add the import:

```tsx
import { Topography } from "../../components/topography";
```

Render `<Topography />` as the first child of the component's top-level returned element, so it mounts with the project workspace and unmounts when you leave it. Because it is `position: fixed`, its position in the tree does not affect layout.

If the component has early returns for loading or error states, put it **after** them — a background behind a spinner is wasted work.

- [ ] **Step 7: Record the vendored component**

Append `src/components/topography.tsx` to the list in `LICENSES/react-bits-MIT.txt`.

- [ ] **Step 8: Run everything**

```bash
npm test -- --maxWorkers=2
npm run build
```

Expected: 803 + 6 new passing, clean build.

- [ ] **Step 9: Commit**

```bash
git add src/components/topography.tsx src/components/topography.test.tsx src/features/projects/project-workspace-page.tsx src/styles.css LICENSES/react-bits-MIT.txt
git commit -m "feat: lay contour lines behind a project workspace"
```

---

## Task 3: Measure what two contexts actually cost

**Files:** none — this task produces a measurement, not a change.

### Why this task exists

Layering Topography over the galaxy rather than replacing it was chosen with the cost raised and understood. This task turns that from a prediction into a number. **The deliverable is data, not a verdict.**

- [ ] **Step 1: Start the dev server**

Use the project's existing preview tooling on port 5173. Do not add a launch config if one exists.

- [ ] **Step 2: Measure the galaxy alone**

Navigate to a screen that shows the galaxy but **not** a project workspace — `/today` is a good choice. In the browser console, sample frame intervals over about five seconds:

```js
await new Promise(resolve => {
  const times = [];
  let last = performance.now();
  const tick = (now) => {
    times.push(now - last);
    last = now;
    if (times.length < 300) requestAnimationFrame(tick);
    else {
      times.sort((a, b) => a - b);
      resolve(console.log('median frame ms:', times[Math.floor(times.length / 2)].toFixed(2)));
    }
  };
  requestAnimationFrame(tick);
});
```

Record the median.

- [ ] **Step 3: Measure galaxy plus Topography**

Navigate into a project workspace so both canvases are live. Confirm two canvases exist:

```js
document.querySelectorAll('canvas').length
```

Then run the same sampling snippet and record the median.

- [ ] **Step 4: Report the numbers**

Write both medians and the delta into your report. Also record how many WebGL contexts are live and whether the browser logged any context warnings.

**Do not interpret the result as a pass or fail.** Report it. If the delta is large, the one-line fallback is documented in the spec — mounting Topography *instead of* the galaxy inside a project rather than over it — and that is a decision for the controller, not this task.

**A caveat you must state:** this browser may report `document.hidden: true`, which suspends `requestAnimationFrame` entirely and would make every sample meaningless. Check `document.hidden` before sampling and say what it was. If it is `true`, the measurement cannot be taken here and you should say so rather than reporting numbers that mean nothing.

---

## Self-review notes

**Spec coverage.** The orb, its guards, the preserved satellite cards and the CSS cleanup → Task 1. Topography, its WebGL 2 check, its dropped mouse listeners and its mount point → Task 2. The measurement the spec promised → Task 3.

**The one existing test that changes, and why that is not the usual smell.** `auth-page.test.tsx` asserts the core image's `src`. That image is deliberately deleted, so the assertion is testing something that no longer exists. It is replaced with assertions on the four satellite labels — which is strictly stronger, because those labels are product messaging and nothing currently guards them. Every other existing test stays untouched.

**Why `hasWebGL2` is exported.** It is the one part of Topography that can be tested honestly in jsdom. The canvas cannot.

**The measurement task states its own failure mode.** This browser has already been observed suspending rAF while its pane is hidden, which would silently produce meaningless numbers. A measurement that cannot be trusted must be reported as untaken, not as data.
