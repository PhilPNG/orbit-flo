/**
 * The shared shell for all four public marketing pages - Home, Features,
 * Agent, Open source.
 *
 * Built from the app's own visual system - the real starfield, the real
 * orbit-panel/orbit-button classes - because the product IS the visual
 * system, and a marketing page faking it would undersell the thing it
 * advertises. Every page mounts this once, so `useLandingAgentTool` (the
 * signed-out WebMCP tool) is wired here rather than per-page.
 *
 * Copy rule, enforced by tests: everything on these pages is true today. No
 * invented numbers, no testimonials, no pricing tiers.
 */
import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { StarFieldBackground } from "../../components/space-visuals";
import { orbitAssets } from "../../lib/orbit-assets";
import { useLandingAgentTool } from "../landing/use-landing-agent-tool";

export const REPO_URL = "https://github.com/PhilPNG/orbit-flo";

const NAV_LINKS = [
  { label: "Features", to: "/features" },
  { label: "Agent", to: "/agent" },
  { label: "Open source", to: "/open-source" },
];

export function MarketingLayout({ children }: { children: ReactNode }) {
  useLandingAgentTool();
  const { pathname } = useLocation();

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#020817] text-slate-100">
      <StarFieldBackground />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24">
        {/* Nav */}
        <header className="flex flex-wrap items-center justify-between gap-4 py-6">
          <Link aria-label="Orbit Flo home" to="/">
            <img alt="Orbit Flo" className="h-9 w-auto" src={orbitAssets.brand.lockupDark} />
          </Link>
          <nav aria-label="Marketing" className="flex flex-wrap items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                aria-current={pathname === link.to ? "page" : undefined}
                className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white aria-[current=page]:text-cyan-300"
                key={link.to}
                to={link.to}
              >
                {link.label}
              </Link>
            ))}
            <a
              className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
              href={REPO_URL}
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <Link className="orbit-button px-4 py-2 text-sm" to="/auth">
              Sign in
            </Link>
          </nav>
        </header>

        {children}

        {/* Footer */}
        <footer className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-slate-400/10 pt-6 text-sm text-slate-400">
          <span>MIT licensed. Built for the WebMCP challenge.</span>
          <a className="transition hover:text-white" href={REPO_URL} rel="noreferrer" target="_blank">
            github.com/PhilPNG/orbit-flo
          </a>
        </footer>
      </div>
    </main>
  );
}

export default MarketingLayout;
