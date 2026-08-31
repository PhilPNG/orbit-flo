import { clsx } from "clsx";

const toneClass = {
  neutral: "border-white/[0.10] bg-white/[0.045] text-slate-300",
  good: "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100",
  warning: "border-blue-300/20 bg-blue-300/[0.08] text-blue-100",
  danger: "border-violet-300/20 bg-violet-400/[0.09] text-violet-100",
};

export type StatusTone = keyof typeof toneClass;

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-5 items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold leading-4 tracking-[0.01em]",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}
