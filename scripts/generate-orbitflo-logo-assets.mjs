import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public", "assets", "brand");
const textureDir = path.join(root, "public", "assets", "textures");
const publicDir = path.join(root, "public");

const markSvg = ({ id, tile = false } = {}) => `
  <svg viewBox="0 0 128 128" aria-hidden="true" class="mark-svg ${tile ? "mark-svg-tile" : ""}">
    <defs>
      <linearGradient id="${id}-orbit" x1="18" y1="104" x2="113" y2="36">
        <stop stop-color="#2563EB"/>
        <stop offset="0.48" stop-color="#22D3EE"/>
        <stop offset="1" stop-color="#7C3AED"/>
      </linearGradient>
      <linearGradient id="${id}-panel" x1="22" y1="42" x2="112" y2="68">
        <stop stop-color="#22D3EE"/>
        <stop offset="0.55" stop-color="#2563EB"/>
        <stop offset="1" stop-color="#7C3AED"/>
      </linearGradient>
      <linearGradient id="${id}-body" x1="53" y1="38" x2="82" y2="76">
        <stop stop-color="#FFFFFF"/>
        <stop offset="1" stop-color="#CBD5E1"/>
      </linearGradient>
      <filter id="${id}-glow" x="-28%" y="-28%" width="156%" height="156%">
        <feGaussianBlur stdDeviation="0.85" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    ${tile ? '<rect x="0" y="0" width="128" height="128" rx="28" fill="#020817"/><rect x="1.5" y="1.5" width="125" height="125" rx="26.5" fill="none" stroke="#1E3A8A" stroke-opacity="0.55" stroke-width="3"/>' : ""}
    <path d="M19 90 C 42 106, 82 99, 112 68" fill="none" stroke="url(#${id}-orbit)" stroke-linecap="round" stroke-width="5.2" filter="url(#${id}-glow)"/>
    <path d="M28 103 C 53 110, 88 100, 111 79" fill="none" stroke="url(#${id}-orbit)" stroke-linecap="round" stroke-width="3.2" opacity="0.45"/>
    <path d="M24 79 C 45 90, 77 86, 101 66" fill="none" stroke="url(#${id}-orbit)" stroke-linecap="round" stroke-width="2.4" opacity="0.3"/>
    <g transform="rotate(-22 67 54)">
      <rect x="23" y="45" width="34" height="22" rx="3.5" fill="url(#${id}-panel)"/>
      <path d="M34 45 V67 M45 45 V67 M23 56 H57" stroke="#BAE6FD" stroke-opacity="0.56" stroke-width="1.4"/>
      <rect x="78" y="45" width="34" height="22" rx="3.5" fill="url(#${id}-panel)"/>
      <path d="M89 45 V67 M100 45 V67 M78 56 H112" stroke="#BAE6FD" stroke-opacity="0.56" stroke-width="1.4"/>
      <path d="M57 56 H78" stroke="#E2E8F0" stroke-width="4.5" stroke-linecap="round"/>
      <rect x="53" y="38" width="31" height="36" rx="8" fill="url(#${id}-body)"/>
      <rect x="57" y="43" width="23" height="26" rx="5.5" fill="#F8FAFC" opacity="0.36"/>
      <circle cx="68.5" cy="56" r="6.3" fill="#061225"/>
      <circle cx="68.5" cy="56" r="2.4" fill="#22D3EE"/>
      <path d="M69 37 V27" stroke="#E2E8F0" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M63 27 C 66 20, 75 20, 78 27" fill="none" stroke="#E2E8F0" stroke-width="3.1" stroke-linecap="round"/>
      <circle cx="69" cy="24" r="3.6" fill="#22D3EE"/>
    </g>
    <path d="M101 22 L103.3 28.1 L109.5 30.5 L103.3 32.8 L101 39 L98.7 32.8 L92.5 30.5 L98.7 28.1 Z" fill="#67E8F9" opacity="0.92"/>
    <circle cx="28" cy="35" r="2.6" fill="#FFFFFF" opacity="0.72"/>
    <circle cx="116" cy="52" r="1.7" fill="#C4B5FD" opacity="0.8"/>
  </svg>
`;

const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    :root {
      background: transparent;
      color-scheme: dark light;
      font-family: "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
    }
    body {
      margin: 0;
      background: transparent;
      -webkit-font-smoothing: antialiased;
    }
    .capture {
      position: fixed;
      left: 0;
      top: 0;
      display: grid;
      place-items: center;
      overflow: visible;
      background: transparent;
    }
    .lockup {
      position: relative;
      width: 960px;
      height: 360px;
      display: flex;
      align-items: center;
      gap: 28px;
      padding: 54px 74px 66px;
      box-sizing: border-box;
    }
    .lockup-orbit-line {
      position: absolute;
      inset: 38px 66px 36px 70px;
      z-index: 0;
      pointer-events: none;
    }
    .lockup .mark-wrap {
      position: relative;
      z-index: 1;
      width: 158px;
      height: 158px;
      flex: 0 0 auto;
      filter: drop-shadow(0 0 7px rgba(34, 211, 238, 0.14));
    }
    .mark {
      width: 512px;
      height: 512px;
      filter: drop-shadow(0 26px 52px rgba(2, 8, 23, 0.46));
    }
    .wordmark {
      display: flex;
      align-items: baseline;
      gap: 0.28em;
      white-space: nowrap;
      font-size: 92px;
      line-height: 0.9;
      font-weight: 830;
      letter-spacing: 0;
      position: relative;
      z-index: 1;
    }
    .wordmark.small {
      width: 640px;
      height: 150px;
      justify-content: center;
      font-size: 82px;
    }
    .orbit-dark {
      color: #FFFFFF;
    }
    .orbit-light {
      color: #061225;
    }
    .flo {
      background: linear-gradient(92deg, #2563EB 3%, #22D3EE 52%, #7C3AED 98%);
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
    }
    .word-space {
      display: inline-block;
      width: 0.15em;
    }
    .mark-svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <div id="lockup-dark" class="capture lockup">
    <svg class="lockup-orbit-line" viewBox="0 0 820 250" aria-hidden="true">
      <defs>
        <linearGradient id="lockup-orbit-dark-stroke" x1="65" y1="195" x2="720" y2="125">
          <stop stop-color="#2563EB" stop-opacity="0"/>
          <stop offset="0.28" stop-color="#22D3EE" stop-opacity="0.46"/>
          <stop offset="0.67" stop-color="#2563EB" stop-opacity="0.36"/>
          <stop offset="1" stop-color="#7C3AED" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="M44 188 C 210 235, 485 211, 765 113" fill="none" stroke="url(#lockup-orbit-dark-stroke)" stroke-linecap="round" stroke-width="8"/>
      <path d="M134 213 C 319 244, 536 203, 725 136" fill="none" stroke="#22D3EE" stroke-opacity="0.12" stroke-linecap="round" stroke-width="4"/>
    </svg>
    <div class="mark-wrap">${markSvg({ id: "lockup-dark" })}</div>
    <div class="wordmark" aria-label="Orbit Flo"><span class="orbit-dark">Orbit</span><span class="flo">Flo</span></div>
  </div>
  <div id="lockup-light" class="capture lockup">
    <svg class="lockup-orbit-line" viewBox="0 0 820 250" aria-hidden="true">
      <defs>
        <linearGradient id="lockup-orbit-light-stroke" x1="65" y1="195" x2="720" y2="125">
          <stop stop-color="#2563EB" stop-opacity="0"/>
          <stop offset="0.28" stop-color="#2563EB" stop-opacity="0.24"/>
          <stop offset="0.65" stop-color="#22D3EE" stop-opacity="0.18"/>
          <stop offset="1" stop-color="#7C3AED" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="M44 188 C 210 235, 485 211, 765 113" fill="none" stroke="url(#lockup-orbit-light-stroke)" stroke-linecap="round" stroke-width="8"/>
      <path d="M134 213 C 319 244, 536 203, 725 136" fill="none" stroke="#2563EB" stroke-opacity="0.1" stroke-linecap="round" stroke-width="4"/>
    </svg>
    <div class="mark-wrap">${markSvg({ id: "lockup-light" })}</div>
    <div class="wordmark" aria-label="Orbit Flo"><span class="orbit-light">Orbit</span><span class="flo">Flo</span></div>
  </div>
  <div id="wordmark-dark" class="capture wordmark small" aria-label="Orbit Flo"><span class="orbit-dark">Orbit</span><span class="flo">Flo</span></div>
  <div id="wordmark-light" class="capture wordmark small" aria-label="Orbit Flo"><span class="orbit-light">Orbit</span><span class="flo">Flo</span></div>
  <div id="mark" class="capture mark">${markSvg({ id: "mark", tile: true })}</div>
</body>
</html>
`;

await mkdir(brandDir, { recursive: true });
await mkdir(textureDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: 1,
  viewport: { width: 940, height: 540 },
});

await page.setContent(html, { waitUntil: "load" });

const captures = [
  ["#lockup-dark", path.join(brandDir, "orbit-flo-lockup-dark.png")],
  ["#lockup-light", path.join(brandDir, "orbit-flo-lockup-light.png")],
  ["#wordmark-dark", path.join(brandDir, "orbit-flo-wordmark-dark.png")],
  ["#wordmark-light", path.join(brandDir, "orbit-flo-wordmark-light.png")],
  ["#mark", path.join(brandDir, "orbit-flo-mark.png")],
  ["#mark", path.join(publicDir, "orbit-flo-icon.png")],
];

for (const [selector, output] of captures) {
  await page.locator(".capture").evaluateAll((nodes) => {
    for (const node of nodes) {
      node.style.visibility = "hidden";
    }
  });
  await page.locator(selector).evaluate((node) => {
    node.style.visibility = "visible";
  });
  const element = await page.locator(selector).elementHandle();
  await element.screenshot({ path: output, omitBackground: true });
}

const grainPage = await browser.newPage({
  deviceScaleFactor: 1,
  viewport: { width: 512, height: 512 },
});
await grainPage.setContent('<canvas id="grain" width="512" height="512"></canvas>');
await grainPage.locator("#grain").evaluate((canvas) => {
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(512, 512);
  let seed = 0x4f524249;
  for (let index = 0; index < 512 * 512; index += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const value = 118 + ((seed >>> 24) % 22);
    pixels.data[index * 4] = value;
    pixels.data[index * 4 + 1] = value + 4;
    pixels.data[index * 4 + 2] = value + 10;
    pixels.data[index * 4 + 3] = 24;
  }
  context.putImageData(pixels, 0, 0);
});
await grainPage.locator("#grain").screenshot({
  omitBackground: true,
  path: path.join(textureDir, "deep-space-grain-v2.png"),
});
await grainPage.close();

await browser.close();
