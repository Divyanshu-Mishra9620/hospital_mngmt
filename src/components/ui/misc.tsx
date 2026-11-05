import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/* ------------------------------------------------------------------ Header */

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 sm:mb-6", className)}>
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-brand-700">
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h1 className="text-[1.375rem] font-bold leading-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-500 sm:text-[0.9375rem]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Stats */

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "brand" | "success" | "warning" | "danger" | "info" | "violet" | "accent";
  href?: string;
}) {
  const toneCls = {
    brand: "bg-brand-50 text-brand-700",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
    danger: "bg-danger-50 text-danger-700",
    info: "bg-info-50 text-info-700",
    violet: "bg-violet-50 text-violet-700",
    accent: "bg-accent-50 text-accent-700",
  }[tone];
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium text-ink-500">{label}</p>
        <p className="tabular mt-1.5 text-2xl font-bold tracking-tight text-ink-900 font-display">{value}</p>
        {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
      </div>
      {icon && <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5", toneCls)}>{icon}</span>}
    </div>
  );
  const cls = "block rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-brand-200 hover:shadow-soft")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ------------------------------------------------------------------ Empty */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-surface text-ink-400 [&_svg]:size-6">{icon}</div>}
      <p className="font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Avatar */

export function Avatar({
  name,
  color = "#136b7a",
  size = "md",
  className,
}: {
  name: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const s = { xs: "size-7 text-[0.6875rem]", sm: "size-9 text-xs", md: "size-11 text-sm", lg: "size-14 text-base", xl: "size-20 text-xl" }[size];
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold text-white font-display", s, className)}
      style={{ background: `linear-gradient(140deg, ${color}, color-mix(in oklab, ${color} 65%, #06232a))` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ Alerts */

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const map = {
    info: { cls: "border-info-100 bg-info-50 text-info-700", Icon: Info },
    success: { cls: "border-success-100 bg-success-50 text-success-700", Icon: CheckCircle2 },
    warning: { cls: "border-warning-100 bg-warning-50 text-warning-700", Icon: AlertTriangle },
    danger: { cls: "border-danger-100 bg-danger-50 text-danger-700", Icon: XCircle },
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-xl border px-3.5 py-3 text-sm", map.cls, className)} role={tone === "danger" ? "alert" : "status"}>
      <map.Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

/** Renders the error/message from an ActionState. */
export function FormMessage({ state }: { state: { ok?: boolean; error?: string; message?: string } | null }) {
  if (!state) return null;
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

/* ------------------------------------------------------------------ Lists */

export function DescriptionList({ items, className, cols = 2 }: { items: { label: string; value: ReactNode }[]; className?: string; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3.5", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">{it.label}</dt>
          <dd className="mt-0.5 break-words text-[0.9375rem] text-ink-800">{it.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Link-based tabs (state lives in the URL so it survives refresh). */
export function Tabs({ tabs, active, className }: { tabs: { href: string; label: ReactNode; key: string; count?: number }[]; active: string; className?: string }) {
  return (
    <nav className={cn("scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0", className)}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              on ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {t.label}
            {t.count != null && (
              <span className={cn("rounded-full px-1.5 py-px text-[0.6875rem] font-semibold", on ? "bg-brand-100 text-brand-700" : "bg-surface-2 text-ink-500")}>
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ Table */

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap border-b border-line bg-surface/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("border-b border-line px-4 py-3 align-middle text-ink-700", className)}>
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ Misc */

export function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-accent-500", className)} aria-label={`${value.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={cn("size-3.5", i < full ? "fill-current" : "fill-ink-200")} aria-hidden>
          <path d="M10 1.5l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L10 14.8l-5.4 2.9 1.2-5.9L1.4 7.7l6-.7z" />
        </svg>
      ))}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-line", className)} />;
}

export function KeyValue({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-1.5 text-sm", className)}>
      <span className="text-ink-500">{k}</span>
      <span className="tabular text-right font-medium text-ink-800">{v}</span>
    </div>
  );
}
