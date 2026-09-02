/**
 * The glowing sphere on the sign-in page.
 *
 * Vendored from React Bits (https://reactbits.dev), MIT licensed, by David Haz.
 * See LICENSES/react-bits-MIT.txt. Retrieved 2026-08-21 from
 * https://github.com/DavidHDev/react-bits, path
 * src/content/Backgrounds/Orb/Orb.jsx
 *
 * Eight departures from the original:
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
 * - Pointer listeners on window/document, not the host. `.auth-orb-host` is
 *   `pointer-events: none` (the four feature cards above it must stay
 *   clickable), so host-bound listeners would never fire.
 * - A lost-context handler, so a driver reset or GPU crash falls back to the
 *   static CSS sphere rather than a permanently blank canvas.
 * - A static CSS fallback when motion is off, WebGL is unavailable, or the
 *   context is lost - so the four feature cards never float around nothing.
 *
 * Its base colours are already violet and cyan. HUE_SHIFT pushes it
 * violet-dominant so it does not compete with cyan, which in this product means
 * "you can touch this".
 */
import { Mesh, Program, Renderer, Triangle, Vec3 } from "ogl";
import { useEffect, useRef, useState } from "react";
import { gpuReduced, isWebGLAvailable } from "./galaxy-canvas";

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
    const motionAllowed = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return motionAllowed && !gpuReduced() && isWebGLAvailable();
  });
  // A lost WebGL context (driver reset, GPU crash) leaves the canvas
  // permanently blank unless something reacts. Separate from `allowed`: the
  // reduced-motion media-query listener recomputes `allowed` from scratch and
  // would happily flip it back to true after a context loss, since
  // isWebGLAvailable() has no memory of this canvas in particular.
  const [contextLost, setContextLost] = useState(false);
  const showOrb = allowed && !contextLost;

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const sync = () => setAllowed(!query.matches && !gpuReduced() && isWebGLAvailable());
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!showOrb) return;
    const host = hostRef.current;
    if (!host) return;

    // WebGL availability is already gated into `allowed` above, so a context
    // is guaranteed here - no try/catch needed.
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
    // The pointer listeners below bind to window (see the header), so they
    // cannot call host.getBoundingClientRect() as their own target's rect the
    // way a host-bound listener could. Cached here instead of read on every
    // pointermove, and refreshed whenever layout can actually have changed.
    let hostRect = host.getBoundingClientRect();
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
      hostRect = host.getBoundingClientRect();
    };
    window.addEventListener("resize", resize);
    resize();

    // A driver reset or GPU crash leaves the canvas permanently blank unless
    // something reacts. preventDefault() signals we won't attempt WebGL
    // context restoration ourselves - we hand off to the static CSS fallback
    // instead. See galaxy-canvas.tsx for the same pattern.
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    gl.canvas.addEventListener("webglcontextlost", handleContextLost);

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

    // pointer-events: none on .auth-orb-host (the four feature cards sit above
    // it and must stay clickable) means the host itself never receives
    // pointer events, so these bind to window/document instead - the same
    // reasoning galaxy-canvas.tsx uses for its parallax listeners.
    // pointermove: on window, using the cached hostRect to test proximity.
    // pointerleave: on document, not window. pointerleave does not bubble,
    // and window is never its target, so a window listener never fires -
    // document is the nearest ancestor that actually receives it.
    const onPointerMove = (event: PointerEvent) => {
      const size = Math.min(hostRect.width, hostRect.height) || 1;
      const x = ((event.clientX - hostRect.left - hostRect.width / 2) / size) * 2;
      const y = ((event.clientY - hostRect.top - hostRect.height / 2) / size) * 2;
      targetHover = Math.hypot(x, y) < 0.8 ? 1 : 0;
    };
    const onPointerLeave = () => {
      targetHover = 0;
    };
    window.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerleave", onPointerLeave);

    start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      gl.canvas.removeEventListener("webglcontextlost", handleContextLost);
      if (gl.canvas.parentNode === host) host.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [showOrb]);

  return (
    <div aria-hidden="true" className="auth-orb-host" ref={hostRef}>
      {showOrb ? null : <div aria-hidden="true" className="auth-orb-fallback" />}
    </div>
  );
}
