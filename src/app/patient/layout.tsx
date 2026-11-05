import type { Metadata } from "next";
import { PatientShell } from "@/components/shell/patient-shell";
import { requirePatient } from "@/lib/auth/session";
import { patientCounts } from "@/lib/queries/patient";

export const metadata: Metadata = { title: { default: "Patient portal", template: "%s · Medora Patient" } };

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const { user, patient } = await requirePatient();
  const counts = await patientCounts(user.id, patient.id);
  return (
    <PatientShell user={{ name: user.name, uhid: patient.uhid }} unread={counts.unread} cartCount={counts.cart}>
      {children}
    </PatientShell>
  );
}
