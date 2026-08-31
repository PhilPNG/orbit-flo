/**
 * Markdown reduced to the text a human scans.
 *
 * Preview surfaces — kanban cards, list rows, the dashboard, and a few
 * unclamped detail panes — are not places you act on content. Rendering
 * markdown there would put real links inside a draggable card and headings
 * inside a two-line clamp. So: render markdown where you can act on it, show
 * text where you are scanning.
 *
 * Most of those surfaces ARE a single clamped block, so newlines collapse to
 * spaces by default. A few (milestone/timeline description panes) are
 * unclamped multi-paragraph text, where collapsing newlines turns a
 * three-paragraph description into a run-on wall of text — pass
 * `{ preserveLineBreaks: true }` there instead.
 *
 * This is a pragmatic stripper, NOT a markdown parser. No remark dependency is
 * warranted to produce preview text, and the failure mode is cosmetic — an
 * unusual construct may leave a stray character, which is no worse than today,
 * where the entire markup survives.
 */
export function toPlainText(
  markdown: string,
  options?: { preserveLineBreaks?: boolean },
): string {
  const stripped = markdown
    // Images BEFORE links. An image is a link with a leading !, so the link
    // rule would consume the bracket pair and strand the ! on its own. This
    // is the one ordering constraint in the function.
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Then links, whose labels must survive the emphasis pass below.
    // [Ship the graph](orbit:task/…) and [@Ada](orbit:user/…) alike.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    // Emphasis only where a real author meant it. Without the \S guards,
    // "1920 * 1080" loses its asterisks and fuses into "1920  1080"; without
    // the word-boundary lookarounds, "my_file_name.txt" becomes
    // "myfilename.txt". Silently deleting content is worse than showing
    // markup, which is the bar this whole function has to clear.
    .replace(/\*\*(\S(?:[^*]*\S)?)\*\*/g, "$1")
    .replace(/\*(\S(?:[^*]*\S)?)\*/g, "$1")
    .replace(/(?<![A-Za-z0-9])_(\S(?:[^_]*\S)?)_(?![A-Za-z0-9])/g, "$1")
    // Line-leading markers: heading hashes, list bullets, ordered numbers,
    // blockquote carets. Multiline, because a description has many lines.
    // The blockquote caret must be followed by whitespace or end-of-line, or
    // it silently eats content that merely starts with ">", e.g. ">= 5 items".
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s{0,3}\d+\.\s+/gm, "")
    .replace(/^\s{0,3}>(?:[ \t]|$)/gm, "");

  if (options?.preserveLineBreaks) {
    // Unclamped surfaces render multiple lines, so a run-on wall of text is a
    // regression, not a simplification. Collapse blank-line runs to a single
    // newline and trim each line, but keep the breaks a real paragraph needs.
    return stripped
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  // Every other caller renders a single clamped block, so newlines become spaces.
  return stripped.replace(/\s*\n+\s*/g, " ").trim();
}
