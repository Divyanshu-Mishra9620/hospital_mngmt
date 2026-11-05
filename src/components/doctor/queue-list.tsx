import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { DayAppointment } from "@/lib/doctor/queries";
import { ageFrom, fmtTime, genderLabel } from "@/lib/format";
import { AppointmentStatusBadge, ModeBadge } from "@/components/status";
import { AppointmentActions } from "@/components/doctor/appointment-actions";
import { cn } from "@/lib/cn";

function ageSex(dob: string | null, gender: string | null) {
  const a = ageFrom(dob);
  return `${a != null ? `${a} y` : "—"} · ${genderLabel(gender)[0] ?? "—"}`;
}

/**
 * Appointment queue — table on laptops, stacked cards on phones.
 */
const BREAK = {
  lg: { list: "lg:hidden", table: "lg:block" },
  "2xl": { list: "2xl:hidden", table: "2xl:block" },
} as const;

export function QueueList({
  rows,
  today,
  highlightCode,
  tableFrom = "lg",
}: {
  rows: DayAppointment[];
  today: string;
  highlightCode?: string | null;
  /** Breakpoint at which the stacked list switches to a table. Use "2xl" in narrow columns. */
  tableFrom?: keyof typeof BREAK;
}) {
  const bp = BREAK[tableFrom];
  return (
    <>
      {/* Phones / tablets */}
      <ul className={cn("divide-y divide-line", bp.list)}>
        {rows.map((a) => (
          <li key={a.id} className={cn("px-4 py-3.5", highlightCode === a.code && "bg-brand-50/60", a.status === "cancelled" && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="w-14 shrink-0 text-center">
                  <p className="tabular text-sm font-bold text-ink-900">{fmtTime(a.time).replace(" ", " ")}</p>
                  {a.tokenNo && <p className="tabular text-[0.6875rem] text-ink-400">Token {a.tokenNo}</p>}
                </div>
                <div className="min-w-0">
                  <Link href={`/doctor/patients/${a.uhid}`} className="block truncate font-semibold text-ink-900 hover:text-brand-700">
                    {a.patientName}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {a.uhid} · {ageSex(a.dob, a.gender)}
                  </p>
                  {a.reason && <p className="mt-0.5 line-clamp-1 text-sm text-ink-600">{a.reason}</p>}
                  {a.allergies && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-danger-700">
                      <AlertTriangle className="size-3" /> {a.allergies}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <AppointmentStatusBadge status={a.status} />
                <ModeBadge mode={a.mode} />
              </div>
            </div>
            <AppointmentActions appt={a} today={today} className="mt-2.5 pl-[4.25rem]" />
          </li>
        ))}
      </ul>

      {/* Laptops */}
      <div className={cn("relative hidden overflow-x-auto", bp.table)}>
        <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Token", "Time", "Patient", "Visit", "Reason", "Status", ""].map((h) => (
                <th key={h} className="whitespace-nowrap border-b border-line bg-surface/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={cn("align-middle hover:bg-surface/50", highlightCode === a.code && "bg-brand-50/60", a.status === "cancelled" && "opacity-60")}>
                <td className="tabular border-b border-line px-4 py-3 font-semibold text-ink-500">{a.tokenNo ?? "—"}</td>
                <td className="tabular whitespace-nowrap border-b border-line px-4 py-3 font-semibold text-ink-900">{fmtTime(a.time)}</td>
                <td className="border-b border-line px-4 py-3">
                  <Link href={`/doctor/patients/${a.uhid}`} className="whitespace-nowrap font-semibold text-ink-900 hover:text-brand-700">
                    {a.patientName}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {a.uhid} · {ageSex(a.dob, a.gender)}
                    {a.allergies && <span className="ml-1.5 font-medium text-danger-700">· Allergy: {a.allergies}</span>}
                  </p>
                </td>
                <td className="border-b border-line px-4 py-3">
                  <ModeBadge mode={a.mode} />
                </td>
                <td className="max-w-[16rem] border-b border-line px-4 py-3 text-ink-600">
                  <span className="line-clamp-2">{a.reason ?? "—"}</span>
                </td>
                <td className="border-b border-line px-4 py-3">
                  <AppointmentStatusBadge status={a.status} />
                </td>
                <td className="border-b border-line px-4 py-3">
                  <AppointmentActions appt={a} today={today} className="justify-end whitespace-nowrap" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
