"use client";

import { ClientPage } from "@/components/client-page";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { requireDoctor } from "@/lib/auth/session";
import { doctorHasPatient } from "@/lib/doctor/queries";
import { getPrescription } from "@/lib/queries/prescriptions";
import { PageHeader } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { SupplyBadge } from "@/components/status";
import { PrintButton } from "@/components/print-button";
import { PrescriptionDocument } from "@/components/prescription-document";

async function __render({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { doctor } = await requireDoctor();
  const rx = await getPrescription({ code: decodeURIComponent(code) });
  if (!rx) notFound();
  // Own prescriptions, or a colleague's prescription for one of this doctor's patients.
  if (rx.doctorId !== doctor.id && !(await doctorHasPatient(doctor.id, rx.patientId))) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print">
        <PageHeader
          back={{ href: `/doctor/patients/${rx.patient.uhid}`, label: rx.patient.name }}
          eyebrow={rx.code}
          title={rx.diagnosis}
          description={`${rx.doctor.name} · ${rx.doctor.department}`}
          actions={
            <>
              <SupplyBadge status={rx.supplyStatus} />
              {rx.appointment && rx.doctorId === doctor.id && (
                <LinkButton href={`/doctor/consult/${rx.appointment.code}`} variant="outline" size="sm">
                  <ClipboardList /> Consultation
                </LinkButton>
              )}
              <PrintButton />
            </>
          }
        />
      </div>
      <PrescriptionDocument rx={rx} showSupply />
    </div>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
