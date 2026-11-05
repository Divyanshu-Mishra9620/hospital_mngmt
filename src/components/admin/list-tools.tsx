import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";

type SP = Record<string, string | string[] | undefined>;

/** Builds a URL that keeps the current query string but overrides some keys. */
export function withQuery(base: string, sp: SP, patch: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v !== "") q.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function Pagination({ base, sp, page, pageSize, total }: { base: string; sp: SP; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-500 sm:flex-row">
      <p className="tabular">
        Showing <span className="font-semibold text-ink-800">{fmtNumber(from)}–{fmtNumber(to)}</span> of{" "}
        <span className="font-semibold text-ink-800">{fmtNumber(total)}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={withQuery(base, sp, { page: page - 1 })} className={buttonStyles({ variant: "outline", size: "sm" })} scroll={false}>
            <ChevronLeft aria-hidden /> Previous
          </Link>
        ) : (
          <span className={buttonStyles({ variant: "outline", size: "sm", className: "pointer-events-none opacity-40" })}>
            <ChevronLeft aria-hidden /> Previous
          </span>
        )}
        <span className="tabular px-1 text-ink-600">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={withQuery(base, sp, { page: page + 1 })} className={buttonStyles({ variant: "outline", size: "sm" })} scroll={false}>
            Next <ChevronRight aria-hidden />
          </Link>
        ) : (
          <span className={buttonStyles({ variant: "outline", size: "sm", className: "pointer-events-none opacity-40" })}>
            Next <ChevronRight aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}

/** One row of GET filters above a list. Works without JavaScript. */
export function FilterBar({ action, children, resetHref, className }: { action: string; children: ReactNode; resetHref?: string; className?: string }) {
  return (
    <form action={action} method="get" className={cn("mb-4 flex flex-wrap items-end gap-3", className)}>
      {children}
      <div className="flex gap-2">
        <button type="submit" className={buttonStyles({ size: "md" })}>
          Apply
        </button>
        {resetHref && (
          <Link href={resetHref} className={buttonStyles({ variant: "ghost", size: "md" })}>
            Reset
          </Link>
        )}
      </div>
    </form>
  );
}

export function FilterSearch({ name = "q", defaultValue, placeholder, label = "Search", className }: { name?: string; defaultValue?: string; placeholder?: string; label?: string; className?: string }) {
  return (
    <div className={cn("min-w-[14rem] flex-1", className)}>
      <Label htmlFor={`f-${name}`} className="text-xs text-ink-500">
        {label}
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <Input id={`f-${name}`} name={name} defaultValue={defaultValue} placeholder={placeholder} className="pl-9" />
      </div>
    </div>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  options,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("min-w-[9.5rem]", className)}>
      <Label htmlFor={`f-${name}`} className="text-xs text-ink-500">
        {label}
      </Label>
      <Select id={`f-${name}`} name={name} defaultValue={defaultValue ?? ""}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function FilterDate({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <div className="w-[10.5rem]">
      <Label htmlFor={`f-${name}`} className="text-xs text-ink-500">
        {label}
      </Label>
      <Input id={`f-${name}`} type="date" name={name} defaultValue={defaultValue} />
    </div>
  );
}

/** Quick date-range presets rendered as links. */
export function RangePresets({ base, sp, today, presets }: { base: string; sp: SP; today: string; presets: { label: string; from: string; to?: string }[] }) {
  const cur = `${typeof sp.from === "string" ? sp.from : ""}|${typeof sp.to === "string" ? sp.to : ""}`;
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {presets.map((p) => {
        const to = p.to ?? today;
        const on = cur === `${p.from}|${to}`;
        return (
          <Link
            key={p.label}
            href={withQuery(base, sp, { from: p.from, to, page: null })}
            scroll={false}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              on ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700",
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
