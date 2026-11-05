"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { CalendarClock, CheckCircle2, Clock, VideoOff, XCircle } from "lucide-react";
import { db } from "@/db";
import { appointments, departments, doctors, patients, prescriptions, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { endVideoConsultation } from "@/lib/actions/consult";
import { VIDEO_JOIN_EARLY_MIN } from "@/lib/constants";
import { ageFrom, fmtLongDate, fmtTime, genderLabel } from "@/lib/format";
import { clinicNow, fromMinutes, minutesUntil, toMinutes } from "@/lib/time";
import { LogoMark } from "@/components/logo";
import { LinkButton } from "@/components/ui/button";
import { VideoRoom } from "@/components/consult/video-room";
import { rtcHistory } from "@/lib/client/rtc";

function Notice({
  icon,
  title,
  children,
  backHref,
  backLabel,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  backHref: string;
  backLabel: string;
  extra?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-brand-950 px-5 py-10 text-brand-100">
      <div className="w-full max-w-md text-center">
        <LogoMark className="mx-auto size-11" />
        <div className="mx-auto mt-8 grid size-16 place-items-center rounded-2xl bg-white/10 text-accent-500 [&_svg]:size-8">{icon}</div>
        <h1 className="mt-5 text-2xl font-bold text-white">{title}</h1>
        <div className="mt-2 text-[0.9375rem] leading-relaxed text-brand-200">{children}</div>
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <LinkButton href={backHref} variant="white">
            {backLabel}
          </LinkButton>
          {extra}
        </div>
      </div>
    </main>
  );
}

async function __render({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser("patient", "doctor");

  const [row] = await db
    .select({
      appt: appointments,
      patient: patients,
      patientName: users.name,
      doctorUserId: doctors.userId,
      doctorCode: doctors.code,
      doctorColor: doctors.avatarColor,
      doctorDesignation: doctors.designation,
      inPersonFee: doctors.inPersonFee,
      departmentName: departments.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .where(eq(appointments.code, code))
    .limit(1);
  if (!row) notFound();

  const role = user.role === "doctor" && user.id === row.doctorUserId ? "doctor" : user.role === "patient" && user.id === row.patient.userId ? "patient" : null;
  if (!role) notFound();

  const [docUser] = await db.select({ name: users.name }).from(users).where(eq(users.id, row.doctorUserId));
  const doctorName = docUser?.name ?? "your doctor";
  const { appt } = row;
  const backHref = role === "doctor" ? `/doctor/consult/${appt.code}` : `/patient/appointments/${appt.code}`;
  const backLabel = role === "doctor" ? "Open consultation workspace" : "Back to appointment";

  if (appt.mode !== "video") {
    return (
      <Notice icon={<VideoOff />} title="This is an in-person visit" backHref={backHref} backLabel={backLabel}>
        Appointment {appt.code} is booked as an OPD visit at the hospital, so there is no video room for it.
      </Notice>
    );
  }
  if (appt.status === "cancelled") {
    return (
      <Notice icon={<XCircle />} title="Consultation cancelled" backHref={backHref} backLabel={backLabel}>
        This video consultation was cancelled{appt.cancelReason ? ` (${appt.cancelReason})` : ""}.
      </Notice>
    );
  }
  if (appt.status === "completed") {
    const [rx] = await db.select({ code: prescriptions.code }).from(prescriptions).where(eq(prescriptions.appointmentId, appt.id)).orderBy(desc(prescriptions.id)).limit(1);
    const rxHref = rx ? (role === "doctor" ? `/doctor/prescriptions/${rx.code}` : `/patient/prescriptions/${rx.code}`) : null;
    return (
      <Notice
        icon={<CheckCircle2 />}
        title="Consultation completed"
        backHref={backHref}
        backLabel={backLabel}
        extra={
          rxHref ? (
            <LinkButton href={rxHref} variant="accent">
              View prescription
            </LinkButton>
          ) : null
        }
      >
        {role === "patient"
          ? rx
            ? `${doctorName} has issued your prescription. You can order the medicines from the hospital pharmacy.`
            : `${doctorName} has closed this consultation. Your prescription will appear under Prescriptions as soon as it is issued.`
          : "This consultation is closed."}
      </Notice>
    );
  }

  const now = clinicNow();
  if (appt.date !== now.date) {
    const past = appt.date < now.date;
    return (
      <Notice icon={<CalendarClock />} title={past ? "This consultation date has passed" : "Your video room isn't open yet"} backHref={backHref} backLabel={backLabel}>
        {past
          ? `The consultation was scheduled for ${fmtLongDate(appt.date)} at ${fmtTime(appt.time)}.`
          : `It opens on ${fmtLongDate(appt.date)} at ${fmtTime(fromMinutes(Math.max(0, toMinutes(appt.time) - VIDEO_JOIN_EARLY_MIN)))} — ${VIDEO_JOIN_EARLY_MIN} minutes before your ${fmtTime(appt.time)} slot.`}
      </Notice>
    );
  }
  // Patients can enter from 15 min before the slot — or straight away once the doctor has started.
  if (role === "patient" && appt.status !== "in_consult" && minutesUntil(appt.date, appt.time, now) > VIDEO_JOIN_EARLY_MIN) {
    return (
      <Notice icon={<Clock />} title="Your video room opens soon" backHref={backHref} backLabel={backLabel}>
        You can join from {fmtTime(fromMinutes(toMinutes(appt.time) - VIDEO_JOIN_EARLY_MIN))}, {VIDEO_JOIN_EARLY_MIN} minutes before your {fmtTime(appt.time)} slot with {doctorName}.
        Keep this page handy and make sure your camera and microphone work.
      </Notice>
    );
  }

  const history = rtcHistory(appt.code);

  const age = ageFrom(row.patient.dob);
  const isDoctor = role === "doctor";

  return (
    <VideoRoom
      code={appt.code}
      role={role}
      self={{ name: isDoctor ? doctorName : row.patientName, color: isDoctor ? row.doctorColor : "#136b7a" }}
      peer={
        isDoctor
          ? { name: row.patientName, color: "#136b7a", subtitle: `UHID ${row.patient.uhid}` }
          : { name: doctorName, color: row.doctorColor, subtitle: row.departmentName }
      }
      slotLabel={`Today · ${fmtTime(appt.time)}`}
      fee={appt.fee}
      inPersonFee={row.inPersonFee}
      paid={appt.paymentStatus === "paid"}
      initialCursor={history.cursor}
      initialChat={history.chat}
      backHref={backHref}
      workspaceHref={isDoctor ? `/doctor/consult/${appt.code}` : undefined}
      endAction={isDoctor ? endVideoConsultation.bind(null, appt.code) : undefined}
      patientInfo={
        isDoctor
          ? {
              uhid: row.patient.uhid,
              ageSex: `${age != null ? `${age} y` : "—"} / ${genderLabel(row.patient.gender)}`,
              allergies: row.patient.allergies,
              conditions: row.patient.chronicConditions,
              reason: appt.reason,
              bloodGroup: row.patient.bloodGroup,
            }
          : undefined
      }
      footerNote={
        isDoctor ? null : (
          <>
            Trouble connecting? Use Chrome or Safari, allow camera &amp; microphone, or{" "}
            <Link href={backHref} className="underline">
              go back
            </Link>{" "}
            and call the help desk.
          </>
        )
      }
    />
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
