import type { Metadata } from "next";
import Link from "next/link";
import { Activity, AlertTriangle, ClipboardList, Droplet, FlaskConical, HeartPulse, Scale, Stethoscope } from "lucide-react";
import { TrendChart } from "@/components/patient/trend-chart";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { ageFrom, bmi, fmtDate, genderLabel, parseJSON } from "@/lib/format";
import { listPatientAppointments, patientVitals } from "@/lib/queries/patient";
import { listPrescriptions } from "@/lib/queries/prescriptions";
import { db } from "@/db";
import { prescriptions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Health records" };

export default async function RecordsPage() {
  const { user, patient } = await requirePatient();
  const [vit, appts, rxList, rxTests] = await Promise.all([
    patientVitals(patient.id),
    listPatientAppointments(patient.id),
    listPrescriptions({ patientId: patient.id, limit: 50 }),
    db.select({ code: prescriptions.code, labTests: prescriptions.labTests, createdAt: prescriptions.createdAt }).from(prescriptions).where(eq(prescriptions.patientId, patient.id)).orderBy(desc(prescriptions.createdAt)),
  ]);
  const visits = appts.filter((a) => a.status === "completed");
  const weight = vit.find((v) => v.weightKg)?.weightKg ?? patient.weightKg;
  const b = bmi(weight, patient.heightCm);
  const tests = rxTests.flatMap((r) => parseJSON<string[]>(r.labTests, []).map((t) => ({ test: t, code: r.code, at: r.createdAt })));

  return (
    <div className="space-y-5">
      <PageHeader title="Health records" description="Your vitals, visits and medical history at Medora." />

      <Card>
        <CardHeader icon={<ClipboardList />} title="Medical summary" action={<Link href="/patient/profile" className="text-sm font-semibold text-brand-700">Edit</Link>} />
        <CardBody>
          <DescriptionList
            cols={3}
            items={[
              { label: "Name", value: user.name },
              { label: "UHID", value: <span className="tabular">{patient.uhid}</span> },
              { label: "Age / Sex", value: `${ageFrom(patient.dob) ?? "—"} y / ${genderLabel(patient.gender)}` },
              { label: "Blood group", value: patient.bloodGroup },
              { label: "Height / Weight", value: `${patient.heightCm ?? "—"} cm / ${weight ?? "—"} kg` },
              { label: "BMI", value: b ? `${b.value} (${b.band})` : "—" },
              { label: "Chronic conditions", value: patient.chronicConditions },
              {
                label: "Allergies",
                value: patient.allergies ? (
                  <span className="inline-flex items-center gap-1 font-medium text-danger-700">
                    <AlertTriangle className="size-3.5" aria-hidden /> {patient.allergies}
                  </span>
                ) : (
                  "None recorded"
                ),
              },
              { label: "Insurance", value: patient.insuranceProvider ? `${patient.insuranceProvider} · ${patient.insurancePolicyNo ?? ""}` : "—" },
            ]}
          />
        </CardBody>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader icon={<HeartPulse />} title="Blood pressure" description="Systolic / diastolic, mmHg · target <130/80" />
          <CardBody>
            <TrendChart label="Blood pressure" unit="mmHg" band={[80, 130]} points={vit.filter((v) => v.bpSystolic).map((v) => ({ at: v.recordedAt, value: v.bpSystolic!, value2: v.bpDiastolic }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Droplet />} title="Blood sugar" description="mg/dL · fasting target 80–130" />
          <CardBody>
            <TrendChart label="Blood sugar" unit="mg/dL" band={[80, 130]} color="var(--color-accent-600)" points={vit.filter((v) => v.bloodSugar).map((v) => ({ at: v.recordedAt, value: v.bloodSugar! }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Scale />} title="Weight" description="kg" />
          <CardBody>
            <TrendChart label="Weight" unit="kg" color="var(--color-violet-700)" points={vit.filter((v) => v.weightKg).map((v) => ({ at: v.recordedAt, value: v.weightKg! }))} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader icon={<Activity />} title="Vitals history" description="Recorded by your care team at each visit" />
        {vit.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>BP</Th>
                <Th>Pulse</Th>
                <Th>Temp (°F)</Th>
                <Th>SpO₂</Th>
                <Th>Sugar</Th>
                <Th>Weight</Th>
              </tr>
            </thead>
            <tbody className="tabular">
              {vit.map((v) => (
                <tr key={v.id}>
                  <Td>{fmtDate(v.recordedAt)}</Td>
                  <Td className={v.bpSystolic && v.bpSystolic >= 140 ? "font-semibold text-danger-700" : ""}>{v.bpSystolic ? `${v.bpSystolic}/${v.bpDiastolic}` : "—"}</Td>
                  <Td>{v.pulse ?? "—"}</Td>
                  <Td>{v.temperatureF ?? "—"}</Td>
                  <Td>{v.spo2 ? `${v.spo2}%` : "—"}</Td>
                  <Td>{v.bloodSugar ? `${v.bloodSugar} (${v.sugarType ?? ""})` : "—"}</Td>
                  <Td>{v.weightKg ? `${v.weightKg} kg` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState icon={<Activity />} title="No vitals recorded yet" />
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Stethoscope />} title="Visit history" description={`${visits.length} completed consultation${visits.length === 1 ? "" : "s"}`} />
          {visits.length ? (
            <ul className="divide-y divide-line">
              {visits.slice(0, 12).map((a) => {
                const rx = rxList.find((r) => r.createdAt.slice(0, 10) === a.date && r.doctorName === a.doctorName);
                return (
                  <li key={a.code} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-ink-900">{a.doctorName}</p>
                      <p className="text-ink-500">
                        {a.departmentName} · {fmtDate(a.date)} · {a.mode === "video" ? "Video" : "OPD"}
                      </p>
                      {rx && <p className="mt-0.5 text-ink-700">{rx.diagnosis}</p>}
                    </div>
                    {rx && (
                      <Link href={`/patient/prescriptions/${rx.code}`} className="shrink-0 text-sm font-semibold text-brand-700">
                        Rx
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No visits yet" />
          )}
        </Card>
        <Card>
          <CardHeader icon={<FlaskConical />} title="Investigations advised" action={<Link href="/patient/health-checks" className="text-sm font-semibold text-brand-700">Book tests</Link>} />
          {tests.length ? (
            <ul className="divide-y divide-line">
              {tests.slice(0, 14).map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                  <span className="text-ink-800">{t.test}</span>
                  <span className="shrink-0 text-xs text-ink-500">{fmtDate(t.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No tests advised" />
          )}
        </Card>
      </div>
    </div>
  );
}
