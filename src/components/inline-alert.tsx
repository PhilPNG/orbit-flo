import { clsx } from "clsx";
import type { ReactNode } from "react";

const toneClass = {
  success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  error: "border-rose-300/25 bg-rose-300/10 text-rose-100",
};

export function InlineAlert({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone: "success" | "error";
}) {
  return (
    <p
      className={clsx("rounded-lg border px-3 py-2 text-sm font-semibold", toneClass[tone], className)}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
