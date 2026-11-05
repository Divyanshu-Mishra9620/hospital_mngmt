"use client";

import { ClientPage } from "@/components/client-page";
import { notFound } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { CalendarOff, ExternalLink, Trash2 } from "lucide-react";
import { db } from "@/db";
import { departments, doctorLeaves, doctorSchedules, doctors, feedback, patients, users } from "@/db/schema";
import { ActionForm } from "@/components/admin/action-form";
import { DoctorFields } from "@/components/admin/doctor-fields";
import { ScheduleEditor } from "@/components/admin/schedule-editor";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Avatar, PageHeader, StatCard, Stars } from "@/components/ui/misc";
import { adminAddLeave, adminRemoveLeave, adminResetPassword, adminSaveSchedule, adminToggleUser, adminUpdateDoctor } from "@/lib/actions/admin";
import { doctorStats } from "@/lib/admin/doctors";
import { listDepartmentsBasic } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDate, fmtDateTime, fmtDay, inr } from "@/lib/format";
import { getDoctorAvailability } from "@/lib/slots";
import { todayISO } from "@/lib/time";
import { cn } from "@/lib/cn";

async function __render({ params }: { params: Promise<{ code: string }> }) {
  await requireAdmin();
  const { code } = await params;
  const [row] = await db
    .select({ d: doctors, u: users, dept: departments.name })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .where(eq(doctors.code, decodeURIComponent(code)));
  if (!row) notFound();
  const { d, u } = row;
  const today = todayISO();

  const [depts, schedule, leaves, stats, availability, reviews] = await Promise.all([
    listDepartmentsBasic(),
    db.select().from(doctorSchedules).where(eq(doctorSchedules.doctorId, d.id)),
    db.select().from(doctorLeaves).where(and(eq(doctorLeaves.doctorId, d.id), gte(doctorLeaves.date, today))).orderBy(doctorLeaves.date),
    doctorStats(d.id),
    getDoctorAvailability(d.id, today, 7),
    db
      .select({ rating: feedback.rating, comment: feedback.comment, createdAt: feedback.createdAt, patient: users.name })
      .from(feedback)
      .innerJoin(patients, eq(patients.id, feedback.patientId))
      .innerJoin(users, eq(users.id, patients.userId))
      .where(eq(feedback.doctorId, d.id))
      .orderBy(desc(feedback.createdAt))
      .limit(5),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/doctors", label: "Doctors" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={u.name} color={d.avatarColor} />
            <span>
              {u.name}
              <span className="tabular mt-0.5 block text-sm font-medium text-ink-500">
                {d.code} · {row.dept}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            {u.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
            <LinkButton href={`/doctors/${d.code}`} target="_blank" variant="outline" size="sm">
              <ExternalLink aria-hidden /> Public profile
            </LinkButton>
            <LinkButton href={`/admin/appointments?doctor=${d.id}`} variant="outline" size="sm">
              Appointments
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Consultations (30 days)" value={stats.consults30} sub={`${stats.consults} lifetime · ${stats.video} by video`} />
        <StatCard label="Fees collected (30 days)" value={inr(stats.revenue30)} sub={`${inr(stats.revenue)} lifetime`} tone="info" />
        <StatCard label="Patient rating" value={stats.reviews ? stats.rating.toFixed(1) : "—"} sub={`${stats.reviews} reviews`} tone="accent" />
        <StatCard label="No-shows" value={stats.noShows} sub="All time" tone="warning" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Profile, fees & consultation settings" description="Fee changes apply to new bookings; existing appointments keep the price they were booked at." />
            <CardBody>
              <ActionForm action={adminUpdateDoctor} submitLabel="Save profile" pendingText="Saving…" footerClassName="justify-end">
                <input type="hidden" name="code" value={d.code} />
                <DoctorFields
                  departments={depts}
                  d={{
                    name: u.name,
                    email: u.email,
                    phone: u.phone,
                    departmentId: d.departmentId,
                    designation: d.designation,
                    qualifications: d.qualifications,
                    experienceYears: d.experienceYears,
                    languages: d.languages,
                    expertise: d.expertise,
                    bio: d.bio,
                    room: d.room,
                    registrationNo: d.registrationNo,
                    inPersonFee: d.inPersonFee,
                    videoFee: d.videoFee,
                    slotMinutes: d.slotMinutes,
                    videoEnabled: d.videoEnabled,
                    avatarColor: d.avatarColor,
                  }}
                />
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Weekly OPD schedule" description="Slots are generated from these blocks. Each doctor's calendar is independent." />
            <CardBody>
              <ActionForm action={adminSaveSchedule} submitLabel="Save schedule" pendingText="Saving…" footerClassName="justify-end">
                <input type="hidden" name="code" value={d.code} />
                <ScheduleEditor
                  initial={schedule.map((s) => ({ weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, mode: s.mode }))}
                  slotMinutes={d.slotMinutes}
                />
              </ActionForm>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Next 7 days" description="Live slot availability (all modes)" />
            <ul className="divide-y divide-line">
              {availability.map((day) => {
                const total = day.slots.length;
                const booked = day.slots.filter((s) => s.state === "booked").length;
                return (
                  <li key={day.date} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                    <span className="font-medium text-ink-800">{fmtDay(day.date)}</span>
                    {day.onLeave ? (
                      <Badge tone="warning">On leave{day.leaveReason ? ` · ${day.leaveReason}` : ""}</Badge>
                    ) : total === 0 ? (
                      <span className="text-xs text-ink-400">No OPD</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="tabular text-xs text-ink-500">
                          {booked} booked · <span className={cn("font-semibold", day.available ? "text-success-700" : "text-danger-700")}>{day.available} free</span>
                        </span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#cde2fb]" aria-hidden>
                          <span className="block h-full rounded-full bg-[#2a78d6]" style={{ width: `${Math.round(((total - day.available) / total) * 100)}%` }} />
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Leave & blocked dates" icon={<CalendarOff />} />
            <CardBody className="space-y-4">
              {leaves.length ? (
                <ul className="space-y-2">
                  {leaves.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <span>
                        <span className="font-medium text-ink-900">{fmtDate(l.date)}</span>
                        {l.reason && <span className="block text-xs text-ink-500">{l.reason}</span>}
                      </span>
                      <form action={adminRemoveLeave}>
                        <input type="hidden" name="id" value={l.id} />
                        <Button type="submit" variant="ghost" size="xs" aria-label={`Remove leave on ${fmtDate(l.date)}`}>
                          <Trash2 aria-hidden />
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">No upcoming leave.</p>
              )}
              <ActionForm action={adminAddLeave} submitLabel="Add leave" size="sm" variant="outline" className="border-t border-line pt-4">
                <input type="hidden" name="code" value={d.code} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" htmlFor="leave-date">
                    <Input id="leave-date" name="date" type="date" min={today} required />
                  </Field>
                  <Field label="Reason" htmlFor="leave-reason">
                    <Input id="leave-reason" name="reason" placeholder="Conference" />
                  </Field>
                </div>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Account" description={`Signs in with ${d.code} or ${u.email}`} />
            <CardBody className="space-y-4">
              <p className="text-sm text-ink-600">Last sign-in: {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "never"}</p>
              <ActionForm action={adminResetPassword} submitLabel="Reset password" size="sm" variant="outline" confirm={`Reset the password for ${u.name}?`}>
                <input type="hidden" name="userId" value={u.id} />
              </ActionForm>
              <form action={adminToggleUser} className="border-t border-line pt-4">
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                <Button type="submit" variant={u.active ? "danger" : "success"} size="sm">
                  {u.active ? "Deactivate doctor" : "Re-activate doctor"}
                </Button>
                <p className="mt-2 text-xs text-ink-500">Inactive doctors can&apos;t sign in and are hidden from online booking.</p>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent reviews" />
            {reviews.length ? (
              <ul className="divide-y divide-line">
                {reviews.map((r, i) => (
                  <li key={i} className="px-4 py-3 text-sm sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <Stars value={r.rating} />
                      <span className="text-xs text-ink-400">{fmtDate(r.createdAt)}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-ink-700">“{r.comment}”</p>}
                    <p className="mt-0.5 text-xs text-ink-500">— {r.patient}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-sm text-ink-500">No reviews yet.</p>
              </CardBody>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
