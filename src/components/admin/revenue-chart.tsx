"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

type Point = { day: string; consultation: number; pharmacy: number };

/* Validated categorical slots 1–2 (blue / orange) — see dataviz palette. */
const SERIES = [
  { key: "consultation" as const, label: "Consultations", color: "#2a78d6" },
  { key: "pharmacy" as const, label: "Pharmacy", color: "#eb6834" },
];
const GRID = "#e4e9ec";
const SURFACE = "#ffffff";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function compact(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${n}`;
}

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) if (s * p >= v) return s * p;
  return 10 * p;
}

function dayLabel(d: string) {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Two-series daily revenue line chart with a snapping crosshair + tooltip. */
export function RevenueTrendChart({ data, height = 260 }: { data: Point[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 92, bottom: 28, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = useMemo(() => niceMax(Math.max(...data.flatMap((d) => [d.consultation, d.pharmacy]), 0)), [data]);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const x = (i: number) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const path = (key: "consultation" | "pharmacy") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join("");
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70))));

  function onMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round((px / rect.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowRight") setHover((h) => Math.min(data.length - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? data.length) - 1));
    else if (e.key === "Escape") setHover(null);
  }

  const last = data[data.length - 1];
  // End labels: nudge apart only if they would overlap; otherwise sit at the line ends.
  let yC = y(last?.consultation ?? 0);
  let yP = y(last?.pharmacy ?? 0);
  if (Math.abs(yC - yP) < 28) {
    const mid = (yC + yP) / 2;
    const up = yC <= yP;
    yC = mid + (up ? -14 : 14);
    yP = mid + (up ? 14 : -14);
  }
  const hv = hover != null ? data[hover] : null;
  const tipLeft = hover != null ? Math.min(Math.max(x(hover) + 12, pad.left), width - 190) : 0;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem] text-ink-600" aria-label="Legend">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={wrap} className="relative w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Daily revenue for the last 30 days, consultations and pharmacy. Use left and right arrow keys to read values."
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-lg"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#66757f" className="tabular">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 || i === data.length - 1 ? (
              <text key={d.day} x={x(i)} y={height - 8} textAnchor={i === data.length - 1 ? "end" : "middle"} fontSize={11} fill="#66757f">
                {i === data.length - 1 ? "Today" : dayLabel(d.day)}
              </text>
            ) : null,
          )}
          {SERIES.map((s) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* End markers + direct labels */}
          {last &&
            SERIES.map((s, si) => (
              <g key={s.key}>
                <circle cx={x(data.length - 1)} cy={y(last[s.key])} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
                <text x={x(data.length - 1) + 10} y={si === 0 ? yC : yP} dy="0.32em" fontSize={11.5} fill="#111f2a" fontWeight={600} className="tabular">
                  {compact(last[s.key])}
                </text>
                <text x={x(data.length - 1) + 10} y={(si === 0 ? yC : yP) + 13} dy="0.32em" fontSize={10.5} fill="#66757f">
                  {s.label}
                </text>
              </g>
            ))}
          {/* Crosshair */}
          {hover != null && hv && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="#8b979f" strokeWidth={1} />
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(hv[s.key])} r={4.5} fill={s.color} stroke={SURFACE} strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={pad.left}
            y={pad.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            style={{ cursor: "crosshair" }}
          />
        </svg>
        {hover != null && hv && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-44 rounded-xl border border-line bg-white px-3 py-2.5 text-xs shadow-soft"
            style={{ left: tipLeft }}
            role="status"
          >
            <p className="mb-1.5 font-semibold text-ink-700">{dayLabel(hv.day)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-2 py-0.5">
                <span className="flex items-center gap-1.5 text-ink-500">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </span>
                <span className="tabular font-semibold text-ink-900">{inr.format(hv[s.key])}</span>
              </p>
            ))}
            <p className="mt-1 flex justify-between border-t border-line pt-1 text-ink-500">
              Total <span className="tabular font-semibold text-ink-900">{inr.format(hv.consultation + hv.pharmacy)}</span>
            </p>
          </div>
        )}
      </div>
      <details className="mt-3 text-sm">
        <summary className="text-xs font-semibold text-brand-700">View as table</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-ink-500">
              <tr>
                <th className="px-3 py-1.5 font-semibold">Date</th>
                <th className="px-3 py-1.5 text-right font-semibold">Consultations</th>
                <th className="px-3 py-1.5 text-right font-semibold">Pharmacy</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="px-3 py-1.5">{dayLabel(d.day)}</td>
                  <td className="tabular px-3 py-1.5 text-right">{inr.format(d.consultation)}</td>
                  <td className="tabular px-3 py-1.5 text-right">{inr.format(d.pharmacy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
