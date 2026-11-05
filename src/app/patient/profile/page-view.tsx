"use client";

import { ClientPage } from "@/components/client-page";
import QRCode from "qrcode";
import { HeartPulse, LogOut } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { HOSPITAL } from "@/lib/constants";
import { ageFrom, fmtDate, genderLabel } from "@/lib/format";
import { PasswordForm, ProfileForm } from "./forms";

async function __render() {
  const { user, patient } = await requirePatient();
  const qr = await QRCode.toString(`MEDORA-UHID:${patient.uhid}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#06232a", light: "#ffffff" } });

  return (
    <div className="space-y-5">
      <PageHeader title="Profile & health card" actions={<PrintButton label="Print card" />} />

      {/* Health card */}
      <div className="mx-auto max-w-md print-sheet">
        <div className="overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-line">
          <div className="flex items-center justify-between bg-brand-800 px-5 py-3 text-white" style={{ backgroundImage: "radial-gradient(120% 140% at 100% 0%, rgb(63 154 168 / .6), transparent 60%)" }}>
            <div className="flex items-center gap-2.5">
              <LogoMark className="size-8" />
              <div className="leading-tight">
                <p className="font-display text-sm font-bold">{HOSPITAL.shortName}</p>
                <p className="text-[0.625rem] uppercase tracking-[0.16em] text-brand-200">Patient health card</p>
              </div>
            </div>
            <HeartPulse className="size-6 text-accent-500" aria-hidden />
          </div>
          <div className="flex gap-4 p-5">
            <div className="min-w-0 flex-1 space-y-2.5 text-sm">
              <div>
                <p className="text-[0.625rem] uppercase tracking-wider text-ink-400">Name</p>
                <p className="font-semibold text-ink-900">{user.name}</p>
              </div>
              <div>
                <p className="text-[0.625rem] uppercase tracking-wider text-ink-400">UHID</p>
                <p className="tabular font-display text-lg font-bold tracking-wide text-brand-800">{patient.uhid}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[0.625rem] uppercase tracking-wider text-ink-400">Age</p>
                  <p className="font-medium text-ink-800">{ageFrom(patient.dob) ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[0.625rem] uppercase tracking-wider text-ink-400">Sex</p>
                  <p className="font-medium text-ink-800">{genderLabel(patient.gender)}</p>
                </div>
                <div>
                  <p className="text-[0.625rem] uppercase tracking-wider text-ink-400">Blood</p>
                  <p className="font-medium text-danger-700">{patient.bloodGroup ?? "—"}</p>
                </div>
              </div>
            </div>
            <div className="w-28 shrink-0">
              <div className="aspect-square w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} aria-label={`QR code for UHID ${patient.uhid}`} role="img" />
              <p className="mt-1 text-center text-[0.625rem] text-ink-400">Scan at registration</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-line bg-surface px-5 py-2 text-[0.6875rem] text-ink-500">
            <span>Emergency: {HOSPITAL.emergency}</span>
            <span>Since {fmtDate(patient.createdAt, { day: undefined })}</span>
          </div>
        </div>
      </div>

      <div className="no-print grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <Card>
          <CardHeader title="Personal & medical details" description={`Registered email: ${user.email}`} />
          <div className="p-4 sm:p-5">
            <ProfileForm
              values={{
                phone: user.phone ?? "",
                address: patient.address ?? "",
                city: patient.city ?? "",
                pincode: patient.pincode ?? "",
                bloodGroup: patient.bloodGroup ?? "",
                emergencyName: patient.emergencyName ?? "",
                emergencyRelation: patient.emergencyRelation ?? "",
                emergencyPhone: patient.emergencyPhone ?? "",
                allergies: patient.allergies ?? "",
                chronicConditions: patient.chronicConditions ?? "",
                heightCm: patient.heightCm?.toString() ?? "",
                weightKg: patient.weightKg?.toString() ?? "",
                insuranceProvider: patient.insuranceProvider ?? "",
                insurancePolicyNo: patient.insurancePolicyNo ?? "",
              }}
            />
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Change password" />
            <div className="p-4 sm:p-5">
              <PasswordForm />
            </div>
          </Card>
          <a href="/logout" className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3 text-sm font-semibold text-danger-700 shadow-card hover:bg-danger-50">
            <LogOut className="size-4" aria-hidden /> Sign out
          </a>
        </div>
      </div>
    </div>
  );
}

const __loader = () => __render();

export default function PageView() {
  return <ClientPage render={__loader} props={{}} />;
}
