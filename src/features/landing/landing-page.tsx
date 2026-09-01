/**
 * The storefront at "/" for signed-out visitors.
 *
 * Built from the app's own visual system - the real galaxy, the real orb, the
 * real glow classes - because the product IS the visual system, and a
 * marketing page faking it would undersell the thing it advertises.
 *
 * Copy rule, enforced by tests: everything on this page is true today. No
 * invented numbers, no testimonials, no pricing tiers. When that stops being
 * enough, this becomes a separate site - see the spec.
 */
import { Link } from "react-router-dom";
import { Orb } from "../../components/orb";
import { StarFieldBackground } from "../../components/space-visuals";
import { orbitAssets } from "../../lib/orbit-assets";

const REPO_URL = "https://github.com/PhilPNG/orbit-flo";

const agentTools = [
  "list_projects",
  "get_flight_plan",
  "create_task",
  "move_task",
  "search_workspace",
  "capture_thought",
  "complete_plan_item",
];

const features = [
  {
    title: "Today's flight plan",
    body: "A handful of items pulled from your boards each day, one marked primary. Completing one fires a launch streak.",
    image: { src: "/assets/landing/flight-plan.png", alt: "Daily flight plan with seeded items" },
  },
  {
    title: "Mission control",
    body: "Cross-project health, priority work, milestones and decisions on one dashboard that counts itself up as it loads.",
    image: { src: "/assets/landing/dashboard.png", alt: "Mission control dashboard" },
  },
  {
    title: "Mission boards",
    body: "Projects are missions; their boards run Docked to In Orbit. Markdown descriptions, orbit: links between tasks, and an electric border on the column you are dragging into.",
    image: null,
  },
  {
    title: "Capture everything",
    body: "Stray thoughts land in the inbox from anywhere in the app - or from your agent - and become tasks when you are ready.",
    image: null,
  },
];

export function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#020817] text-slate-100">
      <StarFieldBackground />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24">
        {/* Nav */}
        <header className="flex items-center justify-between py-6">
          <img
            alt="Orbit Flo"
            className="h-9 w-auto"
            src={orbitAssets.brand.lockupDark}
          />
          <nav className="flex items-center gap-3">
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

        {/* Hero */}
        <section className="orbit-page-enter grid gap-10 py-14 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/80">
              Focus. Flow. Finish.
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-6xl">
              Mission control for your projects — and your agent&apos;s.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Orbit Flo takes software projects from idea to done — boards, daily flight
              plans, milestones and linked notes inside a live galaxy. And through WebMCP,
              a browser-hosted agent can work the same workspace you do.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link className="orbit-button px-6 py-3 text-base" to="/auth">
                Enter orbit
              </Link>
              <a
                className="rounded-md border border-slate-400/20 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-slate-300/40 hover:text-white"
                href={REPO_URL}
                rel="noreferrer"
                target="_blank"
              >
                View source
              </a>
            </div>
          </div>

          <figure className="orbit-panel overflow-hidden rounded-2xl p-2">
            <img
              alt="A mission board with tasks moving from Docked to In Orbit"
              className="w-full rounded-xl"
              height={900}
              src="/assets/landing/board.png"
              width={1440}
            />
          </figure>
        </section>

        {/* The differentiator */}
        <section className="orbit-panel mt-10 rounded-2xl p-8 sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300/80">
            WebMCP inside
          </p>
          <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
            Your agent works here too.
          </h2>
          <p className="mt-4 max-w-3xl text-slate-300">
            Orbit Flo registers seven tools with the browser&apos;s WebMCP surface. An
            agent-hosting browser can plan your day, file tasks, and triage your inbox —
            in your session, on your screen, with its work landing on your board live.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {agentTools.map((tool) => (
              <li
                className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-mono text-xs text-cyan-100"
                key={tool}
              >
                {tool}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-sm text-slate-400">
            The agent gets your session; the database decides what it can touch.
            Row-level security and column grants bound every tool call — and those
            grants are verified in CI on every pull request.
          </p>
        </section>

        {/* Features */}
        {/* Image cards pair in the first row, text cards in the second, so a
            two-line card never stretches to match a screenshot's height. */}
        <section className="mt-16 grid items-start gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <article className="orbit-panel rounded-2xl p-6" key={feature.title}>
              <h3 className="text-xl font-bold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{feature.body}</p>
              {feature.image ? (
                <img
                  alt={feature.image.alt}
                  className="mt-4 w-full rounded-lg border border-slate-400/10"
                  height={900}
                  loading="lazy"
                  src={feature.image.src}
                  width={1440}
                />
              ) : null}
            </article>
          ))}
        </section>

        {/* Honest close */}
        <section className="mt-20 grid items-center gap-8 lg:grid-cols-[1fr_280px]">
          <div>
            <h2 className="text-3xl font-black text-white">
              Open source under MIT.
            </h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              Free while in beta. Bring your own Supabase project, or sign in and try
              it — the code, the schema, and the CI that guards its privilege model are
              all public.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link className="orbit-button px-6 py-3 text-base" to="/auth">
                Sign in
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="relative mx-auto h-64 w-64">
            <Orb />
          </div>
        </section>

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

export default LandingPage;
