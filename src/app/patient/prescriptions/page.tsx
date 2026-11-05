import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { SupplyBadge } from "@/components/status";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { fmtDate } from "@/lib/format";
import { listPrescriptions } from "@/lib/queries/prescriptions";

export const metadata: Metadata = { title: "Prescriptions" };

export default async function PrescriptionsPage() {
  const { patient } = await requirePatient();
  const list = await listPrescriptions({ patientId: patient.id });

  return (
    <div>
      <PageHeader title="Prescriptions" description="Digital prescriptions from your consultations. Order medicines straight from any prescription." />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<FileText />} title="No prescriptions yet" description="After your consultation, the doctor's prescription will appear here." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.map((rx) => (
            <li key={rx.id}>
              <Link href={`/patient/prescriptions/${rx.code}`} className="block rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-500">
                      <span className="tabular">{rx.code}</span> · {fmtDate(rx.createdAt)}
                    </p>
                    <p className="mt-0.5 font-semibold text-ink-900">{rx.diagnosis}</p>
                    <p className="text-sm text-ink-600">
                      {rx.doctorName} · {rx.departmentName}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-5 shrink-0 text-ink-300" aria-hidden />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SupplyBadge status={rx.supplyStatus} />
                  <span className="text-xs text-ink-500">
                    {rx.medicines.length} medicine{rx.medicines.length === 1 ? "" : "s"}: {rx.medicines.slice(0, 3).join(", ")}
                    {rx.medicines.length > 3 ? "…" : ""}
                  </span>
                </div>
                {rx.followUpDate && <p className="mt-2 text-xs text-ink-500">Follow-up: {fmtDate(rx.followUpDate)}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
