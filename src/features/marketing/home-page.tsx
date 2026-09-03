/**
 * The storefront at "/" for signed-out visitors.
 *
 * Trimmed relative to the old single-page landing: the full agent-tool
 * breakdown now lives on /agent, the full feature tour on /features. This
 * page's job is the hero, a taste of the agent story, the crew section,
 * three teasers, and an honest close - not the whole pitch.
 *
 * Copy rule, enforced by tests: everything here is true today. No invented
 * numbers, no testimonials, no pricing tiers.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Orb } from "../../components/orb";
import { MarketingLayout, REPO_URL } from "./marketing-layout";

const AGENT_TOOLS = [
  "add_to_flight_plan",
  "capture_thought",
  "complete_plan_item",
  "create_task",
  "file_capture_as_task",
  "get_flight_plan",
  "list_inbox",
  "list_projects",
  "move_task",
  "search_workspace",
];

const CREW_POINTS = [
  "Invite by link",
  "Owner · Admin · Member",
  "Assign tasks",
  "Mentions and assignment signals",
  "Private flight plans",
];

const TEASERS = [
  {
    title: "Today's flight plan",
    body: "A handful of items pulled from your boards each day, one marked primary. Completing one fires a launch streak.",
  },
  {
    title: "Mission control",
    body: "Cross-project health, priority work, milestones and decisions on one dashboard that counts itself up as it loads.",
  },
  {
    title: "Mission boards",
    body: "Projects are missions; their boards run Docked to In Orbit. Markdown descriptions, orbit: links between tasks, and an electric border on the column you are dragging into.",
  },
];

export function HomePage() {
  useEffect(() => {
    document.title = "Orbit Flo — Mission control for your projects";
  }, []);

  return (
    <MarketingLayout>
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

      {/* The differentiator, trimmed - the full ten-tool table lives on /agent */}
      <section className="orbit-panel mt-10 rounded-2xl p-8 sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300/80">
          WebMCP inside
        </p>
        <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
          Your agent works here too.
        </h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Orbit Flo registers thirteen tools with the browser&apos;s WebMCP surface. An
          agent-hosting browser can plan your day, file tasks, and triage your inbox —
          in your session, on your screen, with its work landing on your board live.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {AGENT_TOOLS.map((tool) => (
            <li
              className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-mono text-xs text-cyan-100"
              key={tool}
            >
              {tool}
            </li>
          ))}
        </ul>
        <Link
          className="mt-6 inline-block text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
          to="/agent"
        >
          See what each tool does →
        </Link>
      </section>

      {/* Collaboration - every claim here is shipped and covered by the two-account e2e suite */}
      <section className="orbit-panel mt-10 rounded-2xl p-8 sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300/80">
          Shared workspaces
        </p>
        <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
          Bring the crew into orbit.
        </h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Invite people to a workspace with a link and give them a role — owner, admin or
          member. Assign tasks to members, and get a signal when someone mentions or assigns
          you. Your daily flight plan and inbox stay yours; the mission boards, milestones and
          project notes are shared.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {CREW_POINTS.map((point) => (
            <li
              className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100"
              key={point}
            >
              {point}
            </li>
          ))}
        </ul>
        <Link
          className="mt-6 inline-block text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
          to="/features#shared-workspaces"
        >
          See how workspaces work →
        </Link>
      </section>

      {/* Teasers */}
      <section className="mt-16 grid gap-6 sm:grid-cols-3">
        {TEASERS.map((teaser) => (
          <article className="orbit-panel rounded-2xl p-6" key={teaser.title}>
            <h3 className="text-xl font-bold text-white">{teaser.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{teaser.body}</p>
          </article>
        ))}
      </section>
      <div className="mt-6 text-center">
        <Link className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200" to="/features">
          Explore all features →
        </Link>
      </div>

      {/* Honest close */}
      <section className="mt-20 grid items-center gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <h2 className="text-3xl font-black text-white">Open source under MIT.</h2>
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
    </MarketingLayout>
  );
}

export default HomePage;
