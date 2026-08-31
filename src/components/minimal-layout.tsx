import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { clsx } from "clsx";

type PageHeaderProps = {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  title: string;
};

type QuietPanelProps = ComponentPropsWithoutRef<"section"> & {
  children: ReactNode;
  className?: string;
};

export function PageHeader({
  action,
  children,
  className,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <header
      className={clsx(
        "orbit-page-header flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-400">{eyebrow}</div>
        ) : null}
        <h1 className="mt-2 text-[2.5rem] font-bold leading-[1.05] tracking-[-0.035em] text-white">{title}</h1>
        {children ? <div className="mt-3 max-w-2xl text-[0.9375rem] leading-6 text-slate-300">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
  action,
  children,
  className,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <div className={clsx("flex min-w-0 items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-black text-white">{title}</h2>
        {children ? <p className="mt-1 text-sm leading-6 text-slate-400">{children}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function QuietPanel({
  children,
  className,
  ...sectionProps
}: QuietPanelProps) {
  return (
    <section className={clsx("surface-quiet rounded-xl p-5", className)} {...sectionProps}>
      {children}
    </section>
  );
}

export function DataRow({
  action,
  children,
  className,
  title,
  ...rowProps
}: Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  title: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "flex min-w-0 items-start justify-between gap-3 border-t border-slate-400/12 py-3 first:border-t-0 first:pt-0 last:pb-0",
        className,
      )}
      {...rowProps}
    >
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-white">{title}</p>
        {children ? <div className="mt-1 text-sm leading-6 text-slate-400">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function DisclosureSection({
  children,
  defaultOpen = false,
  summary,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  summary: string;
}) {
  return (
    <details className="orbit-panel-soft rounded-lg p-4" open={defaultOpen}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-100">{summary}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
