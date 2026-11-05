"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, feedback, patients, payments, prescriptions, users, vitals } from "@/db/schema";
import { ActionForm } from "@/components/admin/action-form";
import { AppointmentStatusBadge, ModeBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Avatar, DescriptionList, KeyValue, PageHeader, Stars } from "@/components/ui/misc";
import { adminCancelAppointment, adminMarkNoShow } from "@/lib/actions/admin";
import { getAppointmentRow } from "@/lib/admin/appointments";
import { requireAdmin } from "@/lib/auth/session";
import { ageFrom, fmtDateTime, fmtLongDate, fmtTime, genderLabel, inr, titleCase } from "@/lib/format";

async function __render({ params }: { params: Promise<{ code: string }> }) {
  await requireAdmin();
  const { code } = await params;
  const row = await getAppointmentRow(decodeURIComponent(code));
  if (!row) notFound();

  const [[appt], [patient], pays, rx, vit, [fb]] = await Promise.all([
    db.select().from(appointments).where(eq(appointments.id, row.id)),
    db
      .select({ p: patients, phone: users.phone, email: users.email })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(users, eq(users.id, patients.userId))
      .where(eq(appointments.id, row.id)),
    db.select().from(payments).where(eq(payments.reference, row.code)).orderBy(desc(payments.createdAt)),
    db.select({ code: prescriptions.code, diagnosis: prescriptions.diagnosis }).from(prescriptions).where(eq(prescriptions.appointmentId, row.id)),
    db.select().from(vitals).where(eq(vitals.appointmentId, row.id)).orderBy(desc(vitals.recordedAt)),
    db.select().from(feedback).where(eq(feedback.appointmentId, row.id)),
  ]);
  const cancellable = appt.status === "booked" || appt.status === "checked_in";
  const v = vit[0];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/appointments", label: "Appointments" }}
        eyebrow={<span className="tabular">{row.code}</span>}
        title={`${row.patientName} with ${row.doctorName}`}
        description={`${fmtLongDate(row.date)} · ${fmtTime(row.time)}${row.tokenNo ? ` · Token ${row.tokenNo}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <ModeBadge mode={row.mode} />
            <AppointmentStatusBadge status={row.status} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Consultation" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Reason for visit", value: appt.reason },
                  { label: "Department", value: row.department },
                  { label: "Booked on", value: fmtDateTime(appt.createdAt) },
                  { label: "Checked in", value: appt.checkedInAt ? fmtDateTime(appt.checkedInAt) : "—" },
                  { label: "Consult started", value: appt.startedAt ? fmtDateTime(appt.startedAt) : "—" },
                  { label: "Completed", value: appt.completedAt ? fmtDateTime(appt.completedAt) : "—" },
                  ...(appt.status === "cancelled"
                    ? [
                        { label: "Cancelled by", value: titleCase(appt.cancelledBy ?? "—") },
                        { label: "Cancellation reason", value: appt.cancelReason },
                      ]
                    : []),
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Clinical record" description="Prescription, vitals and feedback linked to this visit" />
            <CardBody className="space-y-4">
              {rx.length ? (
                rx.map((r) => (
                  <Link key={r.code} href={`/admin/prescriptions/${r.code}`} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 hover:border-brand-200">
                    <span className="min-w-0">
                      <span className="tabular block text-xs font-semibold text-brand-700">{r.code}</span>
                      <span className="block truncate text-sm text-ink-800">{r.diagnosis}</span>
                    </span>
                    <span className="text-sm font-semibold text-brand-700">View →</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-ink-500">No prescription has been issued for this visit.</p>
              )}
              {v && (
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-ink-500">Blood pressure</p>
                    <p className="tabular font-semibold text-ink-900">{v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Pulse</p>
                    <p className="tabular font-semibold text-ink-900">{v.pulse ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">SpO₂</p>
                    <p className="tabular font-semibold text-ink-900">{v.spo2 ? `${v.spo2}%` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Temp.</p>
                    <p className="tabular font-semibold text-ink-900">{v.temperatureF ? `${v.temperatureF} °F` : "—"}</p>
                  </div>
                </div>
              )}
              {fb && (
                <div className="rounded-xl border border-line p-4">
                  <div className="flex items-center gap-2">
                    <Stars value={fb.rating} />
                    <span className="text-sm font-semibold text-ink-800">{fb.rating}/5</span>
                  </div>
                  {fb.comment && <p className="mt-1 text-sm text-ink-600">“{fb.comment}”</p>}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payments" />
            <CardBody>
              {pays.length === 0 ? (
                <p className="text-sm text-ink-500">No payment recorded.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {pays.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span>
                        <span className="tabular block font-medium text-ink-900">{p.code}</span>
                        <span className="block text-xs text-ink-500">
                          {p.method.toUpperCase()} · {fmtDateTime(p.createdAt)}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="tabular block font-semibold text-ink-900">{inr(p.amount)}</span>
                        <Badge tone={p.status === "refunded" ? "danger" : "success"}>{p.status === "refunded" ? "Refunded" : "Paid"}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Patient" />
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar name={row.patientName} />
                <div>
                  <Link href={`/admin/patients/${row.uhid}`} className="font-semibold text-ink-900 hover:text-brand-700">
                    {row.patientName}
                  </Link>
                  <p className="tabular text-xs text-ink-500">
                    {row.uhid} · {ageFrom(patient.p.dob) ?? "—"} y · {genderLabel(patient.p.gender)}
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t border-line pt-2">
                <KeyValue k="Phone" v={patient.phone ?? "—"} />
                <KeyValue k="Email" v={<span className="break-all">{patient.email}</span>} />
                {patient.p.allergies && <KeyValue k="Allergies" v={<span className="text-danger-700">{patient.p.allergies}</span>} />}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Doctor" />
            <CardBody>
              <Link href={`/admin/doctors/${row.doctorCode}`} className="flex items-center gap-3">
                <Avatar name={row.doctorName} color={row.doctorColor} />
                <div>
                  <p className="font-semibold text-ink-900">{row.doctorName}</p>
                  <p className="text-xs text-ink-500">
                    {row.doctorCode} · {row.department}
                  </p>
                </div>
              </Link>
              <div className="mt-3 border-t border-line pt-2">
                <KeyValue k="Fee" v={inr(appt.fee)} />
                <KeyValue k="Payment" v={titleCase(appt.paymentStatus)} />
              </div>
            </CardBody>
          </Card>

          {cancellable ? (
            <Card className="border-danger-100">
              <CardHeader title="Cancel & refund" description={`The slot is released immediately and ${inr(appt.fee)} is marked for refund.`} />
              <CardBody>
                <ActionForm action={adminCancelAppointment} submitLabel="Cancel appointment & refund" variant="danger" confirm="Cancel this appointment and refund the patient?" pendingText="Cancelling…">
                  <input type="hidden" name="code" value={row.code} />
                  <Field label="Reason (shared with the patient)" htmlFor="reason">
                    <Input id="reason" name="reason" placeholder="e.g. Doctor on emergency duty" />
                  </Field>
                </ActionForm>
                <form action={adminMarkNoShow} className="mt-3 border-t border-line pt-3">
                  <input type="hidden" name="code" value={row.code} />
                  <Button type="submit" variant="ghost" size="sm">
                    Mark as no-show instead
                  </Button>
                </form>
              </CardBody>
            </Card>
          ) : (
            <LinkButton href={`/admin/appointments?q=${row.uhid}&from=${row.date}&to=${row.date}`} variant="outline" block>
              Other appointments that day
            </LinkButton>
          )}
        </div>
      </div>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
