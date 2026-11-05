import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo";
import { HOSPITAL } from "@/lib/constants";
import { ageFrom, fmtDate, fmtDateTime, genderLabel } from "@/lib/format";
import type { PrescriptionDetail } from "@/lib/queries/prescriptions";
import { cn } from "@/lib/cn";

/** Morning–Afternoon–Night dots, e.g. 1-0-1 */
export function DoseDots({ frequency }: { frequency: string }) {
  const parts = frequency.split("-");
  if (parts.length < 3 || parts.some((p) => Number.isNaN(Number(p)))) {
    return <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-ink-700">{frequency}</span>;
  }
  const labels = parts.length === 4 ? ["M", "A", "E", "N"] : ["M", "A", "N"];
  return (
    <span className="inline-flex items-center gap-1" title={`${frequency} (${labels.join("-")})`}>
      {parts.map((p, i) => (
        <span
          key={i}
          className={cn(
            "grid size-6 place-items-center rounded-md text-[0.6875rem] font-bold",
            Number(p) > 0 ? "bg-brand-600 text-white" : "bg-surface-2 text-ink-400",
          )}
          aria-hidden
        >
          {Number(p) > 0 ? (Number(p) > 1 ? p : labels[i]) : "–"}
        </span>
      ))}
      <span className="sr-only">{frequency}</span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3 className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-brand-700">{title}</h3>
      <div className="text-sm leading-relaxed text-ink-800">{children}</div>
    </section>
  );
}

/**
 * Printable prescription (A4 friendly). Used by the patient, doctor and
 * pharmacy portals. `showSupply` adds the dispensed / remaining columns.
 */
export function PrescriptionDocument({ rx, showSupply = false, className }: { rx: PrescriptionDetail; showSupply?: boolean; className?: string }) {
  const age = ageFrom(rx.patient.dob);
  return (
    <article className={cn("print-sheet rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8", className)}>
      {/* Letterhead */}
      <header className="flex flex-col gap-4 border-b-2 border-brand-700 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <LogoMark className="size-11" />
          <div>
            <p className="font-display text-lg font-bold leading-tight text-brand-900">{HOSPITAL.name}</p>
            <p className="text-xs text-ink-500">{HOSPITAL.addressLines.join(", ")}</p>
            <p className="text-xs text-ink-500">
              {HOSPITAL.phone} · {HOSPITAL.email}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-display text-[0.9375rem] font-bold text-ink-900">{rx.doctor.name}</p>
          <p className="text-xs text-ink-600">{rx.doctor.qualifications}</p>
          <p className="text-xs text-ink-600">{rx.doctor.department}</p>
          {rx.doctor.registrationNo && <p className="text-xs text-ink-500">Reg. No. {rx.doctor.registrationNo}</p>}
        </div>
      </header>

      {/* Patient strip */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-surface px-4 py-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-[0.6875rem] uppercase tracking-wide text-ink-400">Patient</p>
          <p className="font-semibold text-ink-900">{rx.patient.name}</p>
        </div>
        <div>
          <p className="text-[0.6875rem] uppercase tracking-wide text-ink-400">UHID</p>
          <p className="tabular font-semibold text-ink-900">{rx.patient.uhid}</p>
        </div>
        <div>
          <p className="text-[0.6875rem] uppercase tracking-wide text-ink-400">Age / Sex</p>
          <p className="text-ink-800">
            {age != null ? `${age} y` : "—"} / {genderLabel(rx.patient.gender)}
          </p>
        </div>
        <div>
          <p className="text-[0.6875rem] uppercase tracking-wide text-ink-400">Rx no. · Date</p>
          <p className="tabular text-ink-800">
            {rx.code} · {fmtDate(rx.createdAt)}
          </p>
        </div>
        {rx.patient.allergies && (
          <div className="col-span-2 sm:col-span-4">
            <p className="text-[0.6875rem] uppercase tracking-wide text-danger-700">Allergies</p>
            <p className="font-medium text-danger-700">{rx.patient.allergies}</p>
          </div>
        )}
      </div>

      {rx.chiefComplaints && <Section title="Chief complaints">{rx.chiefComplaints}</Section>}
      <Section title="Diagnosis">
        <p className="font-semibold text-ink-900">{rx.diagnosis}</p>
        {rx.clinicalNotes && <p className="mt-1 text-ink-600">{rx.clinicalNotes}</p>}
      </Section>

      {/* Medicines */}
      <section className="mt-5">
        <h3 className="mb-2 flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-brand-700">
          <span className="font-display text-xl normal-case tracking-normal text-brand-800">℞</span> Medicines
        </h3>
        {rx.items.length === 0 ? (
          <p className="text-sm text-ink-500">No medicines prescribed.</p>
        ) : (
          <>
            {/* Cards on phones */}
            <ol className="space-y-2.5 sm:hidden">
              {rx.items.map((it, i) => (
                <li key={it.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink-900">
                      {i + 1}. {it.medicineName}
                    </p>
                    <DoseDots frequency={it.frequency} />
                  </div>
                  <p className="mt-1 text-sm text-ink-600">
                    {[it.dosage, it.timing, `${it.durationDays} day${it.durationDays === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                  </p>
                  {it.instructions && <p className="mt-1 text-sm text-ink-500">{it.instructions}</p>}
                  <p className="mt-1.5 text-xs text-ink-500">
                    Qty {it.quantity}
                    {showSupply && ` · Supplied ${it.supplied} · Remaining ${it.remaining}`}
                    {!it.medicineId && " · Not stocked at hospital pharmacy"}
                  </p>
                </li>
              ))}
            </ol>
            {/* Table on larger screens and print */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[0.6875rem] uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3 font-semibold">#</th>
                    <th className="py-2 pr-3 font-semibold">Medicine</th>
                    <th className="py-2 pr-3 font-semibold">Dose (M-A-N)</th>
                    <th className="py-2 pr-3 font-semibold">When</th>
                    <th className="py-2 pr-3 font-semibold">Duration</th>
                    <th className="py-2 pr-3 text-right font-semibold">Qty</th>
                    {showSupply && <th className="py-2 pr-3 text-right font-semibold">Supplied</th>}
                    {showSupply && <th className="py-2 text-right font-semibold">Remaining</th>}
                  </tr>
                </thead>
                <tbody>
                  {rx.items.map((it, i) => (
                    <tr key={it.id} className="border-b border-line/70 align-top">
                      <td className="py-2.5 pr-3 text-ink-500">{i + 1}</td>
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-ink-900">{it.medicineName}</p>
                        {it.instructions && <p className="text-xs text-ink-500">{it.instructions}</p>}
                        {!it.medicineId && <p className="text-xs text-warning-700">Not stocked at hospital pharmacy</p>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <DoseDots frequency={it.frequency} />
                      </td>
                      <td className="py-2.5 pr-3 text-ink-700">{it.timing ?? "—"}</td>
                      <td className="tabular py-2.5 pr-3 text-ink-700">
                        {it.durationDays} day{it.durationDays === 1 ? "" : "s"}
                      </td>
                      <td className="tabular py-2.5 pr-3 text-right text-ink-800">{it.quantity}</td>
                      {showSupply && <td className="tabular py-2.5 pr-3 text-right text-ink-700">{it.supplied}</td>}
                      {showSupply && (
                        <td className={cn("tabular py-2.5 text-right font-semibold", it.remaining > 0 ? "text-warning-700" : "text-success-700")}>{it.remaining}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {rx.labTestList.length > 0 && (
        <Section title="Investigations advised">
          <ul className="flex flex-wrap gap-1.5">
            {rx.labTestList.map((t) => (
              <li key={t} className="rounded-md border border-line bg-surface px-2 py-0.5 text-[0.8125rem] text-ink-700">
                {t}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {rx.advice && <Section title="Advice">{rx.advice}</Section>}
      {rx.carePlan && (
        <Section title="Diet & lifestyle">
          <p>
            <span className="font-semibold">{rx.carePlan.dietType}</span>
            {rx.carePlan.calories ? ` · ~${rx.carePlan.calories} kcal/day` : ""}. Full meal plan available in the patient portal under “Diet &amp; lifestyle”.
          </p>
          {rx.carePlan.avoid && <p className="mt-1 text-ink-600">Avoid: {rx.carePlan.avoid}</p>}
        </Section>
      )}

      <footer className="mt-8 flex flex-col gap-6 border-t border-line pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-sm">
          {rx.followUpDate && (
            <p className="font-semibold text-ink-900">
              Follow-up on <span className="text-brand-700">{fmtDate(rx.followUpDate)}</span>
            </p>
          )}
          <p className="mt-1 text-xs text-ink-500">
            {rx.appointment ? `${rx.appointment.mode === "video" ? "Video consultation" : "OPD consultation"} · ${rx.appointment.code} · ` : ""}
            Issued {fmtDateTime(rx.createdAt)}
          </p>
          <p className="mt-1 text-xs text-ink-400">In an emergency call {HOSPITAL.emergency}. This is a digitally generated prescription.</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg italic text-brand-800" style={{ fontFamily: "Georgia, serif" }}>
            {rx.doctor.name.replace(/^Dr\.?\s*/, "Dr. ")}
          </p>
          <p className="border-t border-ink-300 pt-1 text-xs text-ink-500">Digitally signed · {rx.doctor.code}</p>
        </div>
      </footer>
    </article>
  );
}
