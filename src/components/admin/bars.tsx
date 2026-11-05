import { cn } from "@/lib/cn";

/**
 * Single-series horizontal bar chart (no legend — the card title names it).
 * Bars ≤ 14px thick, square at the baseline with a 4px rounded data end,
 * value at the tip, hover lifts the bar and shows a tooltip.
 */
export function HBarChart({
  rows,
  format = (n) => n.toLocaleString("en-IN"),
  color = "#2a78d6",
  max,
  labelWidth = "11rem",
}: {
  rows: { label: string; value: number; sub?: string }[];
  format?: (n: number) => string;
  color?: string;
  max?: number;
  labelWidth?: string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="space-y-1.5" role="list">
      {rows.map((r) => {
        const pct = Math.max(0.5, (r.value / top) * 100);
        return (
          <li
            key={r.label}
            className="group relative grid items-center gap-3 rounded-md px-1 py-0.5 hover:bg-surface/70"
            style={{ gridTemplateColumns: `minmax(0, ${labelWidth}) minmax(0, 1fr)` }}
            tabIndex={0}
          >
            <span className="truncate text-[0.8125rem] text-ink-700" title={r.label}>
              {r.label}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="relative h-3.5 min-w-0 flex-1">
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px] transition-opacity group-hover:opacity-80 group-focus:opacity-80"
                  style={{ width: `${pct}%`, background: color }}
                />
              </span>
              <span className="tabular w-16 shrink-0 text-right text-[0.8125rem] font-semibold text-ink-900">{format(r.value)}</span>
            </span>
            <span
              className={cn(
                "pointer-events-none absolute -top-9 left-1/3 z-10 hidden whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-soft",
                "group-hover:block group-focus:block",
              )}
              role="tooltip"
            >
              <span className="tabular font-semibold text-ink-900">{format(r.value)}</span>
              <span className="text-ink-500">
                {" "}
                · {r.label} · {Math.round((r.value / total) * 100)}%{r.sub ? ` · ${r.sub}` : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Meter: fill carries severity, the track is a lighter step of the same ramp. */
export function Meter({ value, max, className, label }: { value: number; max: number; className?: string; label?: string }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tone = pct >= 90 ? { fill: "#c62a22", track: "#fbd9d6" } : pct >= 75 ? { fill: "#b26b0c", track: "#fbe8c6" } : { fill: "#2a78d6", track: "#cde2fb" };
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full", className)}
      style={{ background: tone.track }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label ?? `${pct}%`}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone.fill }} />
    </div>
  );
}
