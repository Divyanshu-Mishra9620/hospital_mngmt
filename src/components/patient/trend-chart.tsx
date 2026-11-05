import { fmtDate } from "@/lib/format";

type Point = { at: string; value: number; value2?: number | null };

/**
 * Small, dependency-free line chart for vitals trends. Optional second series
 * (e.g. diastolic BP) and a shaded target band.
 */
export function TrendChart({
  points,
  label,
  unit,
  band,
  color = "var(--color-brand-600)",
  color2 = "var(--color-brand-300)",
}: {
  points: Point[];
  label: string;
  unit: string;
  band?: [number, number];
  color?: string;
  color2?: string;
}) {
  const data = [...points].sort((a, b) => a.at.localeCompare(b.at)).slice(-10);
  if (data.length === 0) return <p className="py-6 text-center text-sm text-ink-400">No readings yet</p>;
  const W = 320;
  const H = 120;
  const pad = { l: 30, r: 10, t: 10, b: 20 };
  const vals = data.flatMap((d) => [d.value, d.value2 ?? d.value]).concat(band ?? []);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  const span = Math.max(1, max - min);
  min = Math.floor(min - span * 0.15);
  max = Math.ceil(max + span * 0.15);
  const x = (i: number) => pad.l + (data.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v: number) => pad.t + ((max - v) * (H - pad.t - pad.b)) / (max - min);
  const path = (k: "value" | "value2") =>
    data
      .filter((d) => d[k] != null)
      .map((d, i) => `${i ? "L" : "M"}${x(data.indexOf(d)).toFixed(1)},${y(d[k] as number).toFixed(1)}`)
      .join(" ");
  const last = data[data.length - 1];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label} trend, latest ${last.value}${last.value2 ? "/" + last.value2 : ""} ${unit}`}>
        {band && <rect x={pad.l} y={y(band[1])} width={W - pad.l - pad.r} height={Math.max(0, y(band[0]) - y(band[1]))} fill="var(--color-success-50)" />}
        {[min, Math.round((min + max) / 2), max].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray="2 3" />
            <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9" fill="var(--color-ink-400)">
              {t}
            </text>
          </g>
        ))}
        {data.some((d) => d.value2 != null) && <path d={path("value2")} fill="none" stroke={color2} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        <path d={path("value")} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.value)} r={i === data.length - 1 ? 3.5 : 2.5} fill="white" stroke={color} strokeWidth="2">
              <title>{`${fmtDate(d.at)}: ${d.value}${d.value2 != null ? "/" + d.value2 : ""} ${unit}`}</title>
            </circle>
            {d.value2 != null && <circle cx={x(i)} cy={y(d.value2)} r="2.25" fill="white" stroke={color2} strokeWidth="2" />}
          </g>
        ))}
        <text x={pad.l} y={H - 4} fontSize="9" fill="var(--color-ink-400)">
          {fmtDate(data[0].at, { year: undefined })}
        </text>
        <text x={W - pad.r} y={H - 4} fontSize="9" textAnchor="end" fill="var(--color-ink-400)">
          {fmtDate(last.at, { year: undefined })}
        </text>
      </svg>
    </figure>
  );
}
