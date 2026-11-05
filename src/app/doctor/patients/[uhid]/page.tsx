import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, AlertTriangle, CalendarDays, FileText, Salad, ShieldCheck } from "lucide-react";
import { requireDoctor } from "@/lib/auth/session";
import {
  doctorHasPatient,
  getPatientByUhid,
  latestCarePlan,
  patientAppointmentsWithDoctor,
  patientPrescriptions,
  patientVitals,
} from "@/lib/doctor/queries";
import { MEAL_SLOTS, type Meals } from "@/lib/constants";
import { ageFrom, bmi, fmtDate, fmtTime, genderLabel, parseJSON } from "@/lib/format";
import { todayISO } from "@/lib/time";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, DescriptionList, EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { AppointmentStatusBadge, ModeBadge } from "@/components/status";
import { AppointmentActions } from "@/components/doctor/appointment-actions";
import { VitalsTable, VitalsTrend } from "@/components/doctor/vitals-trend";

export const metadata: Metadata = { title: "Patient record" };

export default async function DoctorPatientDetail({ params }: { params: Promise<{ uhid: string }> }) {
  const { uhid } = await params;
  const { doctor } = await requireDoctor();
  const found = await getPatientByUhid(decodeURIComponent(uhid));
  // Doctors can only open records of patients who have booked with them.
  if (!found || !(await doctorHasPatient(doctor.id, found.patient.id))) notFound();
  const { patient } = found;
  const today = todayISO();

  const [visits, rxList, vit, plan] = await Promise.all([
    patientAppointmentsWithDoctor(doctor.id, patient.id),
    patientPrescriptions(patient.id, 50),
    patientVitals(patient.id, 30),
    latestCarePlan(patient.id),
  ]);
  const age = ageFrom(patient.dob);
  const b = bmi(patient.weightKg, patient.heightCm);
  const meals = plan ? parseJSON<Meals>(plan.plan.meals, {}) : {};

  return (
    <>
      <PageHeader back={{ href: "/doctor/patients", label: "My patients" }} eyebrow={`UHID ${patient.uhid}`} title={found.name} description={`${age != null ? `${age} years` : "Age —"} · ${genderLabel(patient.gender)} · ${found.phone ?? "No phone"}`} />

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-5">
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar name={found.name} size="lg" />
                <div>
                  <p className="font-display text-lg font-bold text-ink-900">{found.name}</p>
                  <p className="text-sm text-ink-500">{found.email}</p>
                </div>
              </div>
              {patient.allergies && (
                <p className="mt-4 flex gap-2 rounded-xl bg-danger-50 px-3 py-2.5 text-sm font-semibold text-danger-700">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Allergies: {patient.allergies}
                </p>
              )}
              <DescriptionList
                cols={1}
                className="mt-4"
                items={[
                  { label: "Date of birth", value: patient.dob ? fmtDate(patient.dob) : null },
                  { label: "Blood group", value: patient.bloodGroup },
                  { label: "Chronic conditions", value: patient.chronicConditions },
                  { label: "Height / weight", value: patient.heightCm || patient.weightKg ? `${patient.heightCm ?? "—"} cm · ${patient.weightKg ?? "—"} kg` : null },
                  { label: "BMI", value: b ? `${b.value} · ${b.band}` : null },
                  { label: "Address", value: [patient.address, patient.city, patient.pincode].filter(Boolean).join(", ") || null },
                  {
                    label: "Insurance",
                    value: patient.insuranceProvider ? (
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="size-3.5 text-success-600" /> {patient.insuranceProvider}
                      </span>
                    ) : (
                      "Self-pay"
                    ),
                  },
                  { label: "Emergency contact", value: patient.emergencyName ? `${patient.emergencyName} (${patient.emergencyRelation ?? "—"}) · ${patient.emergencyPhone ?? ""}` : null },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Trends" icon={<Activity />} />
            <CardBody>{vit.length ? <VitalsTrend rows={vit} /> : <p className="text-sm text-ink-500">No vitals recorded yet.</p>}</CardBody>
          </Card>
        </aside>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Visits with you" icon={<CalendarDays />} description={`${visits.length} appointment${visits.length === 1 ? "" : "s"}`} />
            {visits.length ? (
              <ul className="divide-y divide-line">
                {visits.map((v) => (
                  <li key={v.code} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">
                        {fmtDate(v.date)} · {fmtTime(v.time)}
                      </p>
                      <p className="text-sm text-ink-500">
                        {v.code} · {v.reason ?? "Consultation"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <ModeBadge mode={v.mode} />
                        <AppointmentStatusBadge status={v.status} />
                      </div>
                    </div>
                    <AppointmentActions appt={{ ...v, rxCode: v.rxCode }} today={today} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No visits yet" />
            )}
          </Card>

          <Card>
            <CardHeader title="Prescriptions (all doctors)" icon={<FileText />} description="Read-only for prescriptions written by colleagues." />
            {rxList.length ? (
              <ul className="divide-y divide-line">
                {rxList.map((r) => (
                  <li key={r.id}>
                    <Link href={`/doctor/prescriptions/${r.code}`} className="block px-4 py-3 hover:bg-surface/60 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-ink-900">{r.diagnosis}</p>
                        {r.doctorId === doctor.id ? <Badge tone="brand">You</Badge> : <Badge tone="neutral">{r.departmentName}</Badge>}
                      </div>
                      <p className="text-xs text-ink-500">
                        {r.code} · {fmtDate(r.createdAt)} · {r.doctorName}
                        {r.followUpDate ? ` · follow-up ${fmtDate(r.followUpDate)}` : ""}
                      </p>
                      {r.items.length > 0 && <p className="mt-1 line-clamp-2 text-sm text-ink-600">{r.items.map((i) => `${i.name} ${i.frequency} × ${i.days}d`).join(" · ")}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<FileText />} title="No prescriptions yet" />
            )}
          </Card>

          {plan && (
            <Card>
              <CardHeader title="Latest diet & lifestyle plan" icon={<Salad />} description={`${plan.plan.dietType} · ${plan.doctorName} · ${fmtDate(plan.plan.createdAt)}`} />
              <CardBody className="grid gap-4 md:grid-cols-2">
                <dl className="space-y-2 text-sm">
                  {MEAL_SLOTS.filter((m) => meals[m.key]).map((m) => (
                    <div key={m.key}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                        {m.label} · {m.time}
                      </dt>
                      <dd className="text-ink-700">{meals[m.key]}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="space-y-2 text-sm">
                  {(
                    [
                      ["Include", plan.plan.include],
                      ["Avoid", plan.plan.avoid],
                      ["Hydration", plan.plan.hydration],
                      ["Exercise", plan.plan.exercise],
                      ["Lifestyle", plan.plan.lifestyle],
                      ["Sleep", plan.plan.sleep],
                    ] as const
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{k}</dt>
                        <dd className="text-ink-700">{v}</dd>
                      </div>
                    ))}
                </dl>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Vitals history" icon={<Activity />} description={`${vit.length} readings`} />
            {vit.length ? <VitalsTable rows={vit} /> : <EmptyState title="No vitals recorded" />}
          </Card>
        </div>
      </div>
    </>
  );
}
