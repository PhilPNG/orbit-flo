export type TagCount = { tag: string; count: number };

/**
 * Tags are lowercased so "Design" and "design" are one tag rather than two
 * near-duplicates cluttering the index, and deduped so a note cannot carry the
 * same tag twice.
 */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const value = tag.trim().toLowerCase();
    if (!value || seen.has(value)) continue;

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

/** The comma-separated field on the note form. */
export function parseTagInput(value: string): string[] {
  return normalizeTags(value.split(","));
}

/** Derived from the notes already loaded, so it costs no extra query. */
export function buildTagIndex(notes: ReadonlyArray<{ tags: readonly string[] }>): TagCount[] {
  const counts = new Map<string, number>();

  for (const note of notes) {
    for (const tag of normalizeTags(note.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  // Commonest first, then alphabetical, so the list does not reshuffle
  // unpredictably as counts tie.
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** AND, not OR: selecting two tags narrows to notes carrying both. */
export function matchesTags(noteTags: readonly string[], selected: readonly string[]): boolean {
  if (selected.length === 0) return true;

  const owned = new Set(normalizeTags(noteTags));

  return normalizeTags(selected).every((tag) => owned.has(tag));
}
