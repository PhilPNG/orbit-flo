import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      {children}
    </label>
  );
}
