import { cn } from "@/lib/cn";

/**
 * Tiny inline trend line (oldest → newest). Null values are skipped.
 * Optional second series (e.g. diastolic BP) is drawn lighter.
 */
export function Sparkline({
  values,
  second,
  width = 160,
  height = 44,
  className,
  label,
}: {
  values: (number | null)[];
  second?: (number | null)[];
  width?: number;
  height?: number;
  className?: string;
  label: string;
}) {
  const all = [...values, ...(second ?? [])].filter((v): v is number => v != null);
  if (all.length < 2) return <span className="text-xs text-ink-400">Not enough readings</span>;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = 4;
  const range = max - min || 1;
  const toPoints = (series: (number | null)[]) => {
    const pts: string[] = [];
    const n = series.length;
    series.forEach((v, i) => {
      if (v == null) return;
      const x = n === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (n - 1);
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    return pts;
  };
  const main = toPoints(values);
  const sec = second ? toPoints(second) : [];
  const last = main.at(-1)?.split(",");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn("overflow-visible", className)} role="img" aria-label={label}>
      {sec.length > 1 && <polyline points={sec.join(" ")} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
      {main.length > 1 && <polyline points={main.join(" ")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {last && <circle cx={last[0]} cy={last[1]} r={3} fill="currentColor" />}
    </svg>
  );
}
