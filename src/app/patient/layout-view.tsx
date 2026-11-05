"use client";

import { ClientPage } from "@/components/client-page";
import { PatientShell } from "@/components/shell/patient-shell";
import { requirePatient } from "@/lib/auth/session";
import { patientCounts } from "@/lib/queries/patient";

async function __render({ children }: { children: React.ReactNode }) {
  const { user, patient } = await requirePatient();
  const counts = await patientCounts(user.id, patient.id);
  return (
    <PatientShell user={{ name: user.name, uhid: patient.uhid }} unread={counts.unread} cartCount={counts.cart}>
      {children}
    </PatientShell>
  );
}

export default function LayoutView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
