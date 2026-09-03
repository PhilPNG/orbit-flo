/**
 * The full feature tour at /features.
 *
 * Only three screenshots exist that the seed data can genuinely produce -
 * board, dashboard, flight-plan (public/assets/landing/) - so only those
 * three sections get imagery. Everything else gets an honest paragraph and
 * no staged image, because a screenshot of a mind map or a signal built from
 * empty seed data would be a lie about what a new workspace looks like.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MarketingLayout } from "./marketing-layout";

type ImageSection = {
  title: string;
  body: string;
  image: { src: string; alt: string };
};

type TextSection = {
  id?: string;
  title: string;
  body: string;
};

const IMAGE_SECTIONS: ImageSection[] = [
  {
    title: "Mission boards",
    body: "Projects are missions; their boards run Docked to In Orbit. Markdown descriptions, orbit: links between tasks, and an electric border on the column you are dragging into.",
    image: {
      src: "/assets/landing/board.png",
      alt: "A mission board with tasks moving from Docked to In Orbit",
    },
  },
  {
    title: "Mission control",
    body: "Cross-project health, priority work, milestones and decisions on one dashboard that counts itself up as it loads.",
    image: { src: "/assets/landing/dashboard.png", alt: "Mission control dashboard" },
  },
  {
    title: "Today's flight plan",
    body: "A handful of items pulled from your boards each day, one marked primary. Completing one fires a launch streak.",
    image: { src: "/assets/landing/flight-plan.png", alt: "Daily flight plan with seeded items" },
  },
];

const TEXT_SECTIONS: TextSection[] = [
  {
    title: "Inbox",
    body: "Stray thoughts land in the inbox from anywhere in the app - or from your agent, via capture_thought - and become tasks when you are ready to triage them.",
  },
  {
    title: "Signals",
    body: "Signals surface what changed while you were away - mentions, assignments, review requests - as one list marked read as you clear it, feeding the same unread badge across the app.",
  },
  {
    title: "Brainstorm & linked notes",
    body: "Write in markdown notes that link back to tasks and to each other with orbit: references, so a decision written down stays connected to the work it shaped.",
  },
  {
    title: "Mind maps",
    body: "Sketch a graph of ideas, arrange it with one click, and convert any node straight into a task, a note or a milestone without leaving the canvas.",
  },
  {
    title: "Calendar",
    body: "See due dates and flight-plan items laid out on a week or month grid, so a plan lives in time as well as on a board.",
  },
  {
    title: "Weekly reviews",
    body: "Close the week with a quick per-project health check - good, watch, or at risk - logged so the trend shows up over time, not just the current snapshot.",
  },
  {
    id: "shared-workspaces",
    title: "Shared workspaces",
    body: "Invite people with a link and give them a role — owner, admin or member. Members can be assigned tasks, can leave, and can be removed; a workspace always keeps an owner. Your flight plan and inbox are private to you; boards, milestones and project notes belong to the workspace.",
  },
];

export function FeaturesPage() {
  const { hash } = useLocation();

  useEffect(() => {
    document.title = "Features — Orbit Flo";
  }, []);

  useEffect(() => {
    if (!hash) return;

    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <MarketingLayout>
      <div className="orbit-page-enter py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/80">Features</p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">
            Everything a project needs, one live galaxy.
          </h1>
        </div>

        <div className="mt-16 grid gap-10">
          {IMAGE_SECTIONS.map((section) => (
            <section className="orbit-panel grid gap-6 rounded-2xl p-6 sm:p-8 lg:grid-cols-2 lg:items-center" key={section.title}>
              <div>
                <h2 className="text-2xl font-bold text-white">{section.title}</h2>
                <p className="mt-3 text-slate-300">{section.body}</p>
              </div>
              <img
                alt={section.image.alt}
                className="w-full rounded-xl border border-slate-400/10"
                height={900}
                loading="lazy"
                src={section.image.src}
                width={1440}
              />
            </section>
          ))}
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEXT_SECTIONS.map((section) => (
            <article className="orbit-panel rounded-2xl p-6" id={section.id} key={section.title}>
              <h3 className="text-xl font-bold text-white">{section.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{section.body}</p>
            </article>
          ))}
        </div>
      </div>
    </MarketingLayout>
  );
}

export default FeaturesPage;
