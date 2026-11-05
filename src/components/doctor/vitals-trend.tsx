import type { vitals } from "@/db/schema";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Sparkline } from "./sparkline";

type VitalRow = typeof vitals.$inferSelect;

/** Latest values + sparklines for BP, sugar and weight. Rows newest-first. */
export function VitalsTrend({ rows }: { rows: VitalRow[] }) {
  const chrono = [...rows].reverse();
  const latest = (pick: (v: VitalRow) => number | null) => rows.find((r) => pick(r) != null);
  const bp = latest((r) => r.bpSystolic);
  const sugar = latest((r) => r.bloodSugar);
  const weight = latest((r) => r.weightKg);
  const items = [
    {
      label: "Blood pressure",
      value: bp ? `${bp.bpSystolic}/${bp.bpDiastolic}` : "—",
      unit: "mmHg",
      when: bp?.recordedAt,
      chart: <Sparkline label="Blood pressure trend" values={chrono.map((r) => r.bpSystolic)} second={chrono.map((r) => r.bpDiastolic)} className="text-danger-600" />,
    },
    {
      label: "Blood sugar",
      value: sugar?.bloodSugar ?? "—",
      unit: sugar?.sugarType ? `mg/dL · ${sugar.sugarType === "pp" ? "PP" : sugar.sugarType}` : "mg/dL",
      when: sugar?.recordedAt,
      chart: <Sparkline label="Blood sugar trend" values={chrono.map((r) => r.bloodSugar)} className="text-accent-600" />,
    },
    {
      label: "Weight",
      value: weight?.weightKg ?? "—",
      unit: "kg",
      when: weight?.recordedAt,
      chart: <Sparkline label="Weight trend" values={chrono.map((r) => r.weightKg)} className="text-brand-600" />,
    },
  ];
  return (
    <ul className="divide-y divide-line">
      {items.map((it) => (
        <li key={it.label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-500">{it.label}</p>
            <p className="tabular font-display text-lg font-bold text-ink-900">
              {it.value} <span className="text-xs font-normal text-ink-500">{it.unit}</span>
            </p>
            {it.when && <p className="text-[0.6875rem] text-ink-400">{fmtDate(it.when)}</p>}
          </div>
          <div className="shrink-0">{it.chart}</div>
        </li>
      ))}
    </ul>
  );
}

export function VitalsTable({ rows }: { rows: VitalRow[] }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr>
            {["Recorded", "BP", "Pulse", "Temp", "SpO₂", "RR", "Weight", "Height", "Sugar"].map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-line bg-surface/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((v) => (
            <tr key={v.id}>
              <td className="whitespace-nowrap border-b border-line px-4 py-2.5 text-ink-600">{fmtDateTime(v.recordedAt)}</td>
              <td className="border-b border-line px-4 py-2.5 font-medium text-ink-900">{v.bpSystolic ? `${v.bpSystolic}/${v.bpDiastolic}` : "—"}</td>
              <td className="border-b border-line px-4 py-2.5">{v.pulse ?? "—"}</td>
              <td className="border-b border-line px-4 py-2.5">{v.temperatureF ? `${v.temperatureF} °F` : "—"}</td>
              <td className="border-b border-line px-4 py-2.5">{v.spo2 ? `${v.spo2}%` : "—"}</td>
              <td className="border-b border-line px-4 py-2.5">{v.respiratoryRate ?? "—"}</td>
              <td className="border-b border-line px-4 py-2.5">{v.weightKg ? `${v.weightKg} kg` : "—"}</td>
              <td className="border-b border-line px-4 py-2.5">{v.heightCm ? `${v.heightCm} cm` : "—"}</td>
              <td className="border-b border-line px-4 py-2.5">
                {v.bloodSugar ? `${v.bloodSugar}${v.sugarType ? ` (${v.sugarType === "pp" ? "PP" : v.sugarType[0].toUpperCase()})` : ""}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
