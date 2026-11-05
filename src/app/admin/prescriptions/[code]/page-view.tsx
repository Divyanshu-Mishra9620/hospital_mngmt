"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrescriptionDocument } from "@/components/prescription-document";
import { PrintButton } from "@/components/print-button";
import { SupplyBadge } from "@/components/status";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { getPrescription } from "@/lib/queries/prescriptions";

async function __render({ params }: { params: Promise<{ code: string }> }) {
  await requireAdmin();
  const { code } = await params;
  const rx = await getPrescription({ code: decodeURIComponent(code) });
  if (!rx) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        className="no-print"
        back={{ href: `/admin/patients/${rx.patient.uhid}`, label: rx.patient.name }}
        title={`Prescription ${rx.code}`}
        description={
          <>
            {rx.doctor.name} · {rx.doctor.department}
            {rx.appointment && (
              <>
                {" · "}
                <Link href={`/admin/appointments/${rx.appointment.code}`} className="font-medium text-brand-700 hover:underline">
                  {rx.appointment.code}
                </Link>
              </>
            )}
          </>
        }
        actions={
          <>
            <SupplyBadge status={rx.supplyStatus} />
            <PrintButton />
          </>
        }
      />
      <PrescriptionDocument rx={rx} showSupply />
    </div>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
