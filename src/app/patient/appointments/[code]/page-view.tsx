"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Building2, CheckCircle2, Circle, FileText, Info, MapPin, Receipt, Video, Wifi, XCircle } from "lucide-react";
import { db } from "@/db";
import { payments, prescriptions } from "@/db/schema";
import { JoinVideoButton } from "@/components/patient/appointment-card";
import { AppointmentStatusBadge, ModeBadge } from "@/components/status";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Avatar, KeyValue, PageHeader, Stars } from "@/components/ui/misc";
import { cancellationPolicy } from "@/lib/appointments";
import { requirePatient } from "@/lib/auth/session";
import { HOSPITAL } from "@/lib/constants";
import { fmtDateTime, fmtLongDate, fmtTime, inr } from "@/lib/format";
import { getPatientAppointment } from "@/lib/queries/patient";
import { cn } from "@/lib/cn";
import { CancelForm, FeedbackForm, RescheduleForm } from "./forms";

async function __render({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ booked?: string }> }) {
  const { code } = await params;
  const sp = await searchParams;
  const { patient } = await requirePatient();
  const a = await getPatientAppointment(patient.id, code);
  if (!a) notFound();

  const [[rx], [pay]] = await Promise.all([
    db.select({ code: prescriptions.code }).from(prescriptions).where(eq(prescriptions.appointmentId, a.id)).limit(1),
    db.select().from(payments).where(and(eq(payments.reference, a.code), eq(payments.purpose, "consultation"))).limit(1),
  ]);
  const policy = cancellationPolicy(a);

  const steps =
    a.status === "cancelled"
      ? [
          { label: "Booked & paid", at: a.createdAt, done: true },
          { label: "Cancelled", at: null, done: true, bad: true, note: a.cancelReason },
        ]
      : [
          { label: "Booked & paid", at: a.createdAt, done: true },
          ...(a.mode === "in_person" ? [{ label: "Checked in at OPD", at: null, done: ["checked_in", "in_consult", "completed"].includes(a.status) }] : []),
          { label: a.mode === "video" ? "Video call in progress" : "With the doctor", at: null, done: ["in_consult", "completed"].includes(a.status) },
          { label: a.status === "no_show" ? "Missed (no-show)" : "Consultation complete", at: a.completedAt, done: a.status === "completed" || a.status === "no_show", bad: a.status === "no_show" },
        ];

  return (
    <div>
      <PageHeader title="Appointment" description={<span className="tabular">Ref {a.code}</span>} back={{ href: "/patient/appointments", label: "My appointments" }} />

      {sp.booked === "1" && (
        <Alert tone="success" title="Appointment confirmed" className="mb-5">
          Payment of {inr(a.fee)} received. {a.mode === "video" ? "You can join the video call from here 15 minutes before your slot." : `Your OPD token is ${a.tokenNo ?? "—"}. Please arrive 15 minutes early.`}
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <div className="space-y-5">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-start gap-3">
                <Avatar name={a.doctorName} color={a.doctorColor} size="lg" />
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold text-ink-900">{a.doctorName}</p>
                  <p className="text-sm text-ink-600">{a.doctorDesignation}</p>
                  <p className="text-sm text-ink-500">{a.departmentName}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <AppointmentStatusBadge status={a.status} />
                <ModeBadge mode={a.mode} />
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-3.5 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-ink-500">Date</p>
                  <p className="font-semibold text-ink-900">{fmtLongDate(a.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Time</p>
                  <p className="font-semibold text-ink-900">{fmtTime(a.time)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">{a.mode === "video" ? "Duration" : "OPD token"}</p>
                  <p className="font-semibold text-ink-900">{a.mode === "video" ? `${a.slotMinutes} min` : (a.tokenNo ?? "—")}</p>
                </div>
              </div>
              {a.reason && (
                <p className="text-sm text-ink-600">
                  <span className="font-semibold text-ink-800">Reason:</span> {a.reason}
                </p>
              )}
            </CardBody>
          </Card>

          {a.mode === "video" && ["booked", "checked_in", "in_consult"].includes(a.status) && (
            <Card className="border-violet-50">
              <CardHeader icon={<Video />} title="Video consultation" description="Join from this phone or a laptop with a camera." />
              <CardBody className="space-y-4">
                <JoinVideoButton appt={a} block size="lg" />
                <ul className="grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
                  <li className="flex gap-2">
                    <Wifi className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Use a stable Wi-Fi or 4G connection
                  </li>
                  <li className="flex gap-2">
                    <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Allow camera &amp; microphone when asked
                  </li>
                  <li className="flex gap-2">
                    <FileText className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Keep recent reports and medicines handy
                  </li>
                  <li className="flex gap-2">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Sit in a quiet, well-lit room
                  </li>
                </ul>
              </CardBody>
            </Card>
          )}

          {a.mode === "in_person" && a.status === "booked" && (
            <Card>
              <CardHeader icon={<MapPin />} title="Getting there" />
              <CardBody className="space-y-2 text-sm text-ink-600">
                <p>
                  <span className="font-semibold text-ink-800">{a.departmentName}</span> — {a.departmentLocation}
                  {a.doctorRoom ? `, Room ${a.doctorRoom}` : ""}
                </p>
                <p>{HOSPITAL.addressLines.join(", ")}</p>
                <p>Bring your UHID ({patient.uhid}), a photo ID, previous reports and current medicines. Show this page at the OPD desk to check in.</p>
                <a
                  className="inline-flex font-semibold text-brand-700"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(HOSPITAL.addressLines.join(", "))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Maps →
                </a>
              </CardBody>
            </Card>
          )}

          {rx && (
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-success-50 text-success-700">
                  <FileText className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-ink-900">Prescription ready</p>
                  <p className="text-sm text-ink-500">Medicines, diet plan and advice from this visit</p>
                </div>
              </div>
              <LinkButton href={`/patient/prescriptions/${rx.code}`} size="sm">
                View prescription
              </LinkButton>
            </Card>
          )}

          {a.status === "completed" &&
            (a.feedbackRating ? (
              <Card className="p-4 sm:p-5">
                <p className="text-sm font-semibold text-ink-900">Your feedback</p>
                <div className="mt-1 flex items-center gap-2">
                  <Stars value={a.feedbackRating} />
                  <span className="text-sm text-ink-600">{a.feedbackComment}</span>
                </div>
              </Card>
            ) : (
              <FeedbackForm code={a.code} doctorName={a.doctorName} />
            ))}

          {policy.cancellable && (
            <Card>
              <CardHeader title="Need to make a change?" description={policy.refundable ? "Free cancellation — full refund up to 2 hours before the slot." : "Less than 2 hours to go — cancellation is allowed but not refundable."} />
              <CardBody className="grid gap-4 md:grid-cols-2">
                <RescheduleForm code={a.code} />
                <CancelForm code={a.code} refundable={policy.refundable} fee={a.fee} />
              </CardBody>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="Status" />
            <ol className="px-4 py-4 sm:px-5">
              {steps.map((s, i) => (
                <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < steps.length - 1 && <span className={cn("absolute left-[9px] top-6 h-[calc(100%-1.25rem)] w-0.5", s.done ? "bg-brand-200" : "bg-line")} aria-hidden />}
                  {s.done ? (
                    "bad" in s && s.bad ? (
                      <XCircle className="relative size-5 shrink-0 text-danger-600" aria-hidden />
                    ) : (
                      <CheckCircle2 className="relative size-5 shrink-0 text-brand-600" aria-hidden />
                    )
                  ) : (
                    <Circle className="relative size-5 shrink-0 text-ink-300" aria-hidden />
                  )}
                  <div className="text-sm">
                    <p className={cn("font-medium", s.done ? "text-ink-900" : "text-ink-400")}>{s.label}</p>
                    {s.at && <p className="text-xs text-ink-500">{fmtDateTime(s.at)}</p>}
                    {"note" in s && s.note && <p className="text-xs text-ink-500">{s.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader icon={<Receipt />} title="Payment" />
            <CardBody className="divide-y divide-line py-2">
              <KeyValue k="Consultation fee" v={inr(a.fee)} />
              <KeyValue k="Status" v={a.paymentStatus === "refunded" ? "Refunded" : "Paid"} />
              {pay && <KeyValue k="Method" v={pay.method.toUpperCase()} />}
              {pay && <KeyValue k="Transaction" v={<span className="tabular text-xs">{pay.code}</span>} />}
            </CardBody>
            {pay && (
              <div className="border-t border-line px-4 py-3 sm:px-5">
                <Link href={`/patient/bills/${pay.code}`} className="text-sm font-semibold text-brand-700">
                  View / print receipt →
                </Link>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
