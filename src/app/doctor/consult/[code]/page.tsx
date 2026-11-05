import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { Activity, AlertTriangle, FileText, HeartPulse, History, Printer, Salad, ShieldCheck, Video } from "lucide-react";
import { db } from "@/db";
import { departments, medicines, vitals } from "@/db/schema";
import { requireDoctor } from "@/lib/auth/session";
import { recordVitals, savePrescription } from "@/lib/actions/doctor";
import { DIET_TYPES } from "@/lib/constants";
import { getDoctorAppointment, latestCarePlan, lastPrescriptionItems, patientPrescriptions, patientVitals } from "@/lib/doctor/queries";
import { getPrescription } from "@/lib/queries/prescriptions";
import { ageFrom, bmi, fmtDate, fmtDateTime, fmtLongDate, fmtTime, genderLabel, inr } from "@/lib/format";
import { clinicNow } from "@/lib/time";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Avatar, DescriptionList, PageHeader } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { AppointmentStatusBadge, ModeBadge } from "@/components/status";
import { PrescriptionDocument } from "@/components/prescription-document";
import { AppointmentActions } from "@/components/doctor/appointment-actions";
import { PrescriptionComposer } from "@/components/doctor/prescription-composer";
import { VitalsForm } from "@/components/doctor/vitals-form";
import { VitalsTrend } from "@/components/doctor/vitals-trend";

export const metadata: Metadata = { title: "Consultation" };

const DIET_BY_DEPT: Record<string, (typeof DIET_TYPES)[number]> = {
  endocrinology: "Diabetic (low glycaemic)",
  cardiology: "DASH (low salt, heart healthy)",
  nephrology: "Renal (low protein, low potassium)",
  "obstetrics-gynaecology": "Pregnancy & lactation",
  paediatrics: "Paediatric",
  gastroenterology: "Soft / bland (GI)",
  orthopaedics: "High protein (recovery)",
};

export default async function ConsultWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const { doctor } = await requireDoctor();
  const data = await getDoctorAppointment(doctor.id, code);
  if (!data) notFound();
  const { appt, patient } = data;
  const today = clinicNow().date;

  const [rx, visitVitals, vitalsHistory, history, repeat, plan, meds, [dept]] = await Promise.all([
    data.rx ? getPrescription({ id: data.rx.id }) : Promise.resolve(null),
    db.select().from(vitals).where(eq(vitals.appointmentId, appt.id)).orderBy(desc(vitals.recordedAt)),
    patientVitals(patient.id, 12),
    patientPrescriptions(patient.id, 8),
    lastPrescriptionItems(doctor.id, patient.id),
    latestCarePlan(patient.id),
    db
      .select({
        id: medicines.id,
        name: medicines.name,
        genericName: medicines.genericName,
        strength: medicines.strength,
        form: medicines.form,
        stock: medicines.stock,
        reorderLevel: medicines.reorderLevel,
        unitLabel: medicines.unitLabel,
        unitPrice: medicines.unitPrice,
      })
      .from(medicines)
      .where(eq(medicines.active, true))
      .orderBy(asc(medicines.name)),
    db.select({ slug: departments.slug }).from(departments).where(eq(departments.id, doctor.departmentId)),
  ]);

  const age = ageFrom(patient.dob);
  const b = bmi(patient.weightKg, patient.heightCm);
  const canWrite = !rx && appt.status !== "cancelled" && appt.status !== "no_show";
  const pastRx = history.filter((h) => h.id !== data.rx?.id);
  const saved = typeof sp.saved === "string" ? sp.saved : null;

  return (
    <>
      <PageHeader
        back={{ href: appt.date === today ? "/doctor" : `/doctor/appointments?date=${appt.date}`, label: appt.date === today ? "Today's queue" : "Appointments" }}
        eyebrow={`${appt.code}${appt.tokenNo ? ` · Token ${appt.tokenNo}` : ""}`}
        title={data.patientName}
        description={`${fmtLongDate(appt.date)} · ${fmtTime(appt.time)} · ${appt.reason ?? "Consultation"}`}
        actions={
          <>
            <ModeBadge mode={appt.mode} />
            <AppointmentStatusBadge status={appt.status} />
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <AppointmentActions appt={{ code: appt.code, status: appt.status, mode: appt.mode, date: appt.date, rxCode: rx?.code }} today={today} />
        {appt.mode === "video" && appt.date === today && appt.status !== "cancelled" && appt.status !== "completed" && (
          <span className="text-sm text-ink-500">Fee {inr(appt.fee)} (video) · OPD {inr(doctor.inPersonFee)}</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-5">
          {saved && (
            <Alert tone="success" title={`Prescription ${saved} issued`}>
              The patient has been notified and can order the medicines from the hospital pharmacy.
            </Alert>
          )}
          {appt.status === "cancelled" && (
            <Alert tone="danger" title="Appointment cancelled">
              {appt.cancelReason ?? "This appointment was cancelled."}
            </Alert>
          )}
          {appt.status === "no_show" && <Alert tone="warning" title="Marked as no-show">Undo the no-show from today&apos;s queue if the patient has arrived.</Alert>}
          {appt.mode === "video" && appt.status !== "completed" && appt.status !== "cancelled" && appt.date === today && (
            <Card className="flex flex-col gap-3 border-violet-50 bg-violet-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-white text-violet-700">
                  <Video className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900">Video consultation</p>
                  <p className="text-sm text-ink-600">Open the call in another tab and write the prescription here while you talk.</p>
                </div>
              </div>
              <LinkButton href={`/consult/${appt.code}`} target="_blank" size="sm">
                <Video /> Open video room
              </LinkButton>
            </Card>
          )}

          {/* Vitals */}
          {appt.status !== "cancelled" && (
            <Card>
              <CardHeader
                title="Vitals for this visit"
                icon={<HeartPulse />}
                description={visitVitals.length ? `Last recorded ${fmtDateTime(visitVitals[0].recordedAt)}` : appt.mode === "video" ? "Self-reported readings from the patient" : "Recorded at triage or in the room"}
              />
              <CardBody className="space-y-4">
                {visitVitals.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const v = visitVitals[0];
                      const chips = [
                        v.bpSystolic && `BP ${v.bpSystolic}/${v.bpDiastolic}`,
                        v.pulse && `Pulse ${v.pulse}`,
                        v.temperatureF && `Temp ${v.temperatureF} °F`,
                        v.spo2 && `SpO₂ ${v.spo2}%`,
                        v.respiratoryRate && `RR ${v.respiratoryRate}`,
                        v.weightKg && `Wt ${v.weightKg} kg`,
                        v.heightCm && `Ht ${v.heightCm} cm`,
                        v.bloodSugar && `Sugar ${v.bloodSugar} mg/dL${v.sugarType ? ` (${v.sugarType === "pp" ? "PP" : v.sugarType})` : ""}`,
                      ].filter(Boolean) as string[];
                      return chips.map((c) => (
                        <span key={c} className="tabular rounded-lg bg-surface px-2.5 py-1 text-sm font-medium text-ink-800">
                          {c}
                        </span>
                      ));
                    })()}
                  </div>
                )}
                {!rx && <VitalsForm action={recordVitals.bind(null, appt.code)} />}
              </CardBody>
            </Card>
          )}

          {/* Prescription */}
          {rx ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Prescription issued</h2>
                <LinkButton href={`/doctor/prescriptions/${rx.code}`} variant="outline" size="sm">
                  <Printer /> Open printable copy
                </LinkButton>
              </div>
              <PrescriptionDocument rx={rx} showSupply />
            </div>
          ) : canWrite ? (
            <PrescriptionComposer
              action={savePrescription.bind(null, appt.code)}
              medicines={meds}
              defaultComplaint={appt.reason ?? ""}
              defaultDiet={DIET_BY_DEPT[dept?.slug ?? ""] ?? "Balanced (general)"}
              appointmentDate={appt.date}
              repeatFrom={
                repeat
                  ? {
                      code: repeat.code,
                      createdAt: repeat.createdAt,
                      diagnosis: repeat.diagnosis,
                      items: repeat.items.map((i) => ({
                        medicineId: i.medicineId,
                        medicineName: i.medicineName,
                        dosage: i.dosage,
                        frequency: i.frequency,
                        timing: i.timing,
                        durationDays: i.durationDays,
                        quantity: i.quantity,
                        instructions: i.instructions,
                      })),
                    }
                  : null
              }
            />
          ) : null}
        </div>

        {/* Patient summary */}
        <aside className="order-first space-y-5 lg:order-none">
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar name={data.patientName} size="lg" />
                <div className="min-w-0">
                  <Link href={`/doctor/patients/${patient.uhid}`} className="block truncate font-display text-lg font-bold text-ink-900 hover:text-brand-700">
                    {data.patientName}
                  </Link>
                  <p className="text-sm text-ink-500">
                    {patient.uhid} · {age != null ? `${age} y` : "—"} · {genderLabel(patient.gender)}
                  </p>
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
                  { label: "Blood group", value: patient.bloodGroup },
                  { label: "Chronic conditions", value: patient.chronicConditions },
                  { label: "Height / weight", value: patient.heightCm || patient.weightKg ? `${patient.heightCm ?? "—"} cm · ${patient.weightKg ?? "—"} kg${b ? ` · BMI ${b.value} (${b.band})` : ""}` : null },
                  { label: "Phone", value: data.patientPhone },
                  {
                    label: "Insurance",
                    value: patient.insuranceProvider ? (
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="size-3.5 text-success-600" /> {patient.insuranceProvider}
                        {patient.insurancePolicyNo ? ` · ${patient.insurancePolicyNo}` : ""}
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
            <CardHeader title="Vitals trend" icon={<Activity />} description={`${vitalsHistory.length} readings`} />
            <CardBody>{vitalsHistory.length ? <VitalsTrend rows={vitalsHistory} /> : <p className="text-sm text-ink-500">No vitals recorded yet.</p>}</CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Previous prescriptions"
              icon={<History />}
              action={
                <Link href={`/doctor/patients/${patient.uhid}`} className="text-sm font-semibold text-brand-700 hover:underline">
                  Full history
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {pastRx.slice(0, 5).map((h) => (
                <li key={h.id}>
                  <Link href={`/doctor/prescriptions/${h.code}`} className="block px-4 py-3 hover:bg-surface/60 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink-900">{h.diagnosis}</p>
                      <FileText className="size-4 shrink-0 text-ink-300" />
                    </div>
                    <p className="text-xs text-ink-500">
                      {fmtDate(h.createdAt)} · {h.doctorName}
                    </p>
                    {h.items.length > 0 && <p className="mt-1 line-clamp-2 text-xs text-ink-600">{h.items.map((i) => `${i.name} (${i.frequency})`).join(", ")}</p>}
                  </Link>
                </li>
              ))}
              {!pastRx.length && <li className="px-5 py-4 text-sm text-ink-500">No earlier prescriptions.</li>}
            </ul>
          </Card>

          {plan && (
            <Card>
              <CardHeader title="Current diet plan" icon={<Salad />} description={`${plan.plan.dietType} · by ${plan.doctorName}`} />
              <CardBody className="space-y-1.5 text-sm text-ink-600">
                {plan.plan.calories && <p>~{plan.plan.calories} kcal/day</p>}
                {plan.plan.avoid && (
                  <p>
                    <span className="font-medium text-ink-800">Avoid:</span> {plan.plan.avoid}
                  </p>
                )}
                <p className="text-xs text-ink-400">Issued {fmtDate(plan.plan.createdAt)}</p>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
