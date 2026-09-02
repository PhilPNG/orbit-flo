/**
 * The verification story at /open-source - MIT, the repo, and the tests and
 * checks that back the security claims made elsewhere on the site.
 *
 * Every number here is real today, not a marketing round-up: it should be
 * updated alongside the suite it describes, not left to drift.
 */
import { useEffect } from "react";
import { MarketingLayout, REPO_URL } from "./marketing-layout";

export function OpenSourcePage() {
  useEffect(() => {
    document.title = "Open source — Orbit Flo";
  }, []);

  return (
    <MarketingLayout>
      <div className="orbit-page-enter py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/80">Open source</p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">
            MIT licensed. Free while in beta.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-slate-300">
            The code, the database schema, and the CI that guards its privilege model
            are all public. Bring your own Supabase project and self-host it, or sign
            in and use the hosted instance while it&apos;s free.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              className="orbit-button px-6 py-3 text-base"
              href={REPO_URL}
              rel="noreferrer"
              target="_blank"
            >
              View the repo
            </a>
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          <article className="orbit-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white">851 tests, run on every change</h2>
            <p className="mt-2 text-sm text-slate-300">
              The suite covers the app, the WebMCP tool layer, and the database
              functions those tools call - unit and integration tests, run with
              Vitest before anything merges.
            </p>
          </article>
          <article className="orbit-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white">CI-verified privilege grants</h2>
            <p className="mt-2 text-sm text-slate-300">
              A hermetic SQL check reads the database&apos;s own system catalogs on every
              pull request and fails the build if any table or function grant drifts
              from what it should be - no live data or accounts required.
            </p>
          </article>
          <article className="orbit-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white">A two-account RLS harness</h2>
            <p className="mt-2 text-sm text-slate-300">
              Row-level security is exercised behaviourally: two real signed-in
              accounts run the same SQL and prove one cannot read or write the
              other&apos;s workspace, not just that a grant exists on paper.
            </p>
          </article>
          <article className="orbit-panel rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white">Self-host it</h2>
            <p className="mt-2 text-sm text-slate-300">
              The README walks through pointing the app at your own Supabase
              project - schema, environment variables, and the same verification
              scripts CI runs.
            </p>
          </article>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default OpenSourcePage;
