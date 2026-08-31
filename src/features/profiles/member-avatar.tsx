/** Reuses the label palette so avatars stay inside the design language. */
const avatarTones = ["cyan", "blue", "violet", "emerald", "amber", "rose"] as const;

export type AvatarTone = (typeof avatarTones)[number];

const toneClasses: Record<AvatarTone, string> = {
  cyan: "bg-cyan-300/15 text-cyan-100",
  blue: "bg-blue-400/15 text-blue-100",
  violet: "bg-violet-400/15 text-violet-100",
  emerald: "bg-emerald-400/15 text-emerald-100",
  amber: "bg-amber-400/15 text-amber-100",
  rose: "bg-rose-400/15 text-rose-100",
};

export function initialsFor(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);

  // display_name is not null and trimmed on write, so this should be
  // unreachable — but an empty circle is worse than a question mark.
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/** Deterministic, so the same person is the same colour on every screen. */
export function avatarToneFor(userId: string): AvatarTone {
  let sum = 0;
  for (let index = 0; index < userId.length; index += 1) {
    sum += userId.charCodeAt(index);
  }

  return avatarTones[sum % avatarTones.length];
}

export function MemberAvatar({
  displayName,
  userId,
  size = "md",
}: {
  displayName: string;
  userId: string;
  size?: "sm" | "md";
}) {
  const tone = avatarToneFor(userId);

  return (
    <span
      aria-label={displayName}
      className={`grid shrink-0 place-items-center rounded-full font-black ${toneClasses[tone]} ${
        size === "sm" ? "h-6 w-6 text-[0.6rem]" : "h-9 w-9 text-xs"
      }`}
      role="img"
      title={displayName}
    >
      {initialsFor(displayName)}
    </span>
  );
}
