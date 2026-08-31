import type { CaptureType } from "./supabase/database.types";

const capturePrefixes: Array<{ prefix: string; type: CaptureType }> = [
  { prefix: "idea:", type: "idea" },
  { prefix: "note:", type: "note" },
  { prefix: "blocker:", type: "blocker" },
  { prefix: "task:", type: "task" },
];

export type ParsedQuickAdd = {
  type: CaptureType;
  title: string;
  body: string;
};

export function parseQuickAdd(value: string): ParsedQuickAdd {
  const trimmed = value.trim();
  const lowerValue = trimmed.toLowerCase();
  const matchedPrefix = capturePrefixes.find((entry) => lowerValue.startsWith(entry.prefix));
  const type = matchedPrefix?.type ?? (lowerValue.includes("blocked") ? "blocker" : "task");
  const withoutPrefix = matchedPrefix ? trimmed.slice(matchedPrefix.prefix.length).trim() : trimmed;
  const metadata: string[] = [];
  let title = withoutPrefix;

  for (const token of ["today", "tomorrow"]) {
    const pattern = new RegExp(`\\b${token}\\b`, "gi");
    if (title.match(pattern)) {
      metadata.push(`due ${token}`);
      title = title.replace(pattern, "").replace(/\s+/g, " ").trim();
    }
  }

  let priorityMetadataAdded = false;
  for (const priority of ["critical", "high", "medium", "low"]) {
    const pattern = new RegExp(`\\b${priority}\\b`, "gi");
    if (title.match(pattern)) {
      if (!priorityMetadataAdded) {
        metadata.push(`priority ${priority}`);
        priorityMetadataAdded = true;
      }
      title = title.replace(pattern, "").replace(/\s+/g, " ").trim();
    }
  }

  return {
    type,
    title: title || trimmed,
    body: metadata.length > 0 ? `Parsed metadata: ${metadata.join(", ")}.` : "Captured from global quick add.",
  };
}
