/**
 * Publishes a snapshot of this repository to the public mirror.
 *
 * The public repo (github.com/PhilPNG/orbit-flo) carries a curated history:
 * one commit per release, each an exact copy of a private `main` commit's
 * tree with a narrative message, rather than the private repo's PR-by-PR
 * log. This script adds the next such commit. It never rewrites history: the
 * new commit's parent is the public `main`, so the push is a fast-forward.
 *
 * Vercel builds www.orbitflo.co from the public repo's `main`, so pushing a
 * snapshot is what ships a release.
 *
 * Usage:
 *   node scripts/publish-public-snapshot.mjs --message "What this release is"
 *   node scripts/publish-public-snapshot.mjs --message "..." --ref origin/main --dry-run
 *
 * --ref     the private commit to snapshot (default origin/main, fetched first)
 * --remote  the public repository URL (default https://github.com/PhilPNG/orbit-flo.git)
 * --dry-run create the commit locally and print it, but do not push
 */
import { execFileSync } from "node:child_process";

const DEFAULT_REF = "origin/main";
const DEFAULT_REMOTE = "https://github.com/PhilPNG/orbit-flo.git";
const PUBLIC_REF = "refs/remotes/public-snapshot/main";

function git(args, options = {}) {
  const output = execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...options });
  // With an inherited stdout (the push), execFileSync returns null.
  return typeof output === "string" ? output.trim() : "";
}

function parseArgs(argv) {
  const parsed = { message: "", ref: DEFAULT_REF, remote: DEFAULT_REMOTE, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--message" || arg === "-m") parsed.message = argv[++index] ?? "";
    else if (arg === "--ref") parsed.ref = argv[++index] ?? DEFAULT_REF;
    else if (arg === "--remote") parsed.remote = argv[++index] ?? DEFAULT_REMOTE;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!parsed.message.trim()) throw new Error("A --message describing the release is required.");
  return parsed;
}

function main() {
  const { message, ref, remote, dryRun } = parseArgs(process.argv.slice(2));

  if (ref.startsWith("origin/")) git(["fetch", "origin", ref.slice("origin/".length)]);
  git(["fetch", remote, `main:${PUBLIC_REF}`]);

  const sourceCommit = git(["rev-parse", `${ref}^{commit}`]);
  const sourceTree = git(["rev-parse", `${ref}^{tree}`]);
  const publicHead = git(["rev-parse", PUBLIC_REF]);
  const publicTree = git(["rev-parse", `${PUBLIC_REF}^{tree}`]);

  if (sourceTree === publicTree) {
    console.log(`Nothing to publish: ${ref} (${sourceCommit.slice(0, 7)}) already matches public main (${publicHead.slice(0, 7)}).`);
    return;
  }

  const subject = git(["log", "-1", "--format=%s", sourceCommit]);
  const fullMessage = `${message.trim()}\n\nSnapshot of ${sourceCommit} (${subject}).`;
  const snapshot = git(["commit-tree", sourceTree, "-p", publicHead, "-m", fullMessage]);
  const stat = git(["diff", "--shortstat", publicHead, snapshot]);

  console.log(`Snapshot ${snapshot.slice(0, 7)} on top of public main ${publicHead.slice(0, 7)}: ${stat || "no file changes"}`);

  if (dryRun) {
    console.log(`Dry run - not pushed. Inspect with: git show --stat ${snapshot}`);
    return;
  }

  git(["push", remote, `${snapshot}:refs/heads/main`], { stdio: ["ignore", "inherit", "inherit"] });
  console.log(`Pushed ${snapshot.slice(0, 7)} to ${remote} main.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
