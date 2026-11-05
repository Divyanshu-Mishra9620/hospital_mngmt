"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, IndianRupee, Play, Star, Users, Video } from "lucide-react";
import { requireDoctor } from "@/lib/auth/session";
import { earningsByDay, getDayAppointments, ratingSummary, recentFeedback, upcomingCounts } from "@/lib/doctor/queries";
import { ageFrom, fmtDay, fmtTime, genderLabel, inr, timeAgo } from "@/lib/format";
import { addDays, clinicNow, toMinutes } from "@/lib/time";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, StatCard, Stars } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { AppointmentStatusBadge, ModeBadge } from "@/components/status";
import { QueueList } from "@/components/doctor/queue-list";

function greeting(minutes: number) {
  if (minutes < 12 * 60) return "Good morning";
  if (minutes < 17 * 60) return "Good afternoon";
  return "Good evening";
}

async function __render() {
  const { user, doctor } = await requireDoctor();
  const now = clinicNow();
  const today = now.date;
  const [queue, upcoming, rating, feedback, earnings] = await Promise.all([
    getDayAppointments(doctor.id, today),
    upcomingCounts(doctor.id, addDays(today, 1), addDays(today, 7)),
    ratingSummary(doctor.id),
    recentFeedback(doctor.id, 3),
    earningsByDay(doctor.id, today, today),
  ]);

  const live = queue.filter((a) => a.status !== "cancelled");
  const waiting = live.filter((a) => a.status === "booked" || a.status === "checked_in");
  const completed = live.filter((a) => a.status === "completed");
  const video = live.filter((a) => a.mode === "video");
  const earnedToday = earnings.reduce((s, e) => s + Number(e.revenue), 0);

  const next =
    live.find((a) => a.status === "in_consult") ??
    live.find((a) => a.status === "checked_in") ??
    waiting.filter((a) => toMinutes(a.time) >= now.minutes - 30).sort((a, b) => a.time.localeCompare(b.time))[0] ??
    waiting[0];

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).map((date) => {
    const rows = upcoming.filter((u) => u.date === date);
    return {
      date,
      inPerson: Number(rows.find((r) => r.mode === "in_person")?.n ?? 0),
      video: Number(rows.find((r) => r.mode === "video")?.n ?? 0),
    };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.inPerson + d.video));
  const lastName = user.name.replace(/^Dr\.?\s*/, "").split(" ").at(-1);

  return (
    <>
      <PageHeader
        eyebrow={doctor.code}
        title={`${greeting(now.minutes)}, Dr. ${lastName}`}
        description={`You have ${waiting.length} patient${waiting.length === 1 ? "" : "s"} waiting and ${completed.length} seen today.`}
        actions={
          <>
            <LinkButton href="/doctor/appointments" variant="outline" size="sm">
              <CalendarCheck /> All appointments
            </LinkButton>
            <LinkButton href="/doctor/schedule" variant="secondary" size="sm">
              <Clock /> Schedule & leave
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard label="Today's appointments" value={live.length} icon={<Users />} sub={`${queue.length - live.length} cancelled`} href="/doctor/appointments" />
        <StatCard label="Waiting / checked in" value={waiting.length} icon={<Clock />} tone="warning" sub={`${live.filter((a) => a.status === "checked_in").length} checked in`} />
        <StatCard label="Completed" value={completed.length} icon={<CheckCircle2 />} tone="success" />
        <StatCard label="Video consults" value={video.length} icon={<Video />} tone="violet" sub={`${video.filter((a) => a.status === "completed").length} done`} />
        <StatCard label="Earned today" value={inr(earnedToday)} icon={<IndianRupee />} tone="accent" sub="Completed consultations" href="/doctor/earnings" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {/* Next patient */}
          {next ? (
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-4 bg-gradient-to-r from-brand-700 to-brand-600 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar name={next.patientName} color="#0a3741" size="lg" className="ring-2 ring-white/30" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-100">
                      {next.status === "in_consult" ? "In consultation" : "Next patient"} · {fmtTime(next.time)}
                      {next.tokenNo ? ` · Token ${next.tokenNo}` : ""}
                    </p>
                    <p className="truncate font-display text-xl font-bold">{next.patientName}</p>
                    <p className="text-sm text-brand-100">
                      {next.uhid} · {ageFrom(next.dob) ?? "—"} y · {genderLabel(next.gender)}
                      {next.reason ? ` · ${next.reason}` : ""}
                    </p>
                    {next.allergies && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-danger-600 px-2 py-0.5 text-xs font-semibold">
                        <AlertTriangle className="size-3" /> Allergy: {next.allergies}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {next.mode === "video" ? (
                    <LinkButton href={`/consult/${next.code}`} variant="accent">
                      <Video /> Join video call
                    </LinkButton>
                  ) : (
                    <LinkButton href={`/doctor/consult/${next.code}`} variant="white">
                      <Play /> {next.status === "in_consult" ? "Continue consultation" : "Start consultation"}
                    </LinkButton>
                  )}
                  {next.mode === "video" && (
                    <LinkButton href={`/doctor/consult/${next.code}`} variant="white">
                      Open workspace
                    </LinkButton>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm text-ink-600">
                <ModeBadge mode={next.mode} />
                <AppointmentStatusBadge status={next.status} />
                <span className="text-ink-400">·</span>
                <span>Fee {inr(next.fee)}</span>
                {next.mode === "video" && <span className="text-ink-400">(video consult; OPD visit {inr(doctor.inPersonFee)})</span>}
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState icon={<CheckCircle2 />} title="No one waiting right now" description="New bookings for today will appear here automatically." />
            </Card>
          )}

          {/* Queue */}
          <Card>
            <CardHeader
              title="Today's OPD queue"
              description={`${live.length} appointment${live.length === 1 ? "" : "s"} · slots of ${doctor.slotMinutes} min`}
              action={
                <Link href="/doctor/appointments" className="text-sm font-semibold text-brand-700 hover:underline">
                  Manage
                </Link>
              }
            />
            {queue.length ? (
              <QueueList rows={queue} today={today} highlightCode={next?.code} tableFrom="2xl" />
            ) : (
              <EmptyState icon={<CalendarCheck />} title="No appointments today" description="Enjoy the breather — or open extra slots from your schedule." />
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Next 7 days" description="Live bookings" />
            <CardBody className="space-y-2.5">
              {days.map((d) => {
                const total = d.inPerson + d.video;
                return (
                  <Link key={d.date} href={`/doctor/appointments?date=${d.date}`} className="group flex items-center gap-3 rounded-lg text-sm">
                    <span className="w-24 shrink-0 text-ink-600 group-hover:text-brand-700">{fmtDay(d.date)}</span>
                    <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <span className="bg-brand-500" style={{ width: `${(d.inPerson / maxDay) * 100}%` }} />
                      <span className="bg-violet-700/70" style={{ width: `${(d.video / maxDay) * 100}%` }} />
                    </span>
                    <span className="tabular w-6 text-right font-semibold text-ink-800">{total}</span>
                  </Link>
                );
              })}
              <p className="flex gap-4 pt-1 text-xs text-ink-500">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-brand-500" /> In-person
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-violet-700/70" /> Video
                </span>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Patient feedback"
              icon={<Star />}
              action={
                <Link href="/doctor/reviews" className="text-sm font-semibold text-brand-700 hover:underline">
                  All
                </Link>
              }
            />
            <CardBody>
              <div className="flex items-end gap-3">
                <p className="tabular font-display text-3xl font-bold text-ink-900">{rating.count ? rating.average.toFixed(1) : "—"}</p>
                <div className="pb-1">
                  <Stars value={rating.average} />
                  <p className="text-xs text-ink-500">{rating.count} reviews</p>
                </div>
              </div>
              <ul className="mt-4 space-y-3">
                {feedback.map((f) => (
                  <li key={f.id} className="rounded-xl bg-surface px-3.5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Stars value={f.rating} />
                      <span className="text-xs text-ink-400">{timeAgo(f.createdAt)}</span>
                    </div>
                    {f.comment && <p className="mt-1.5 text-ink-700">“{f.comment}”</p>}
                    <p className="mt-1 text-xs text-ink-500">— {f.patientName.split(" ")[0]}</p>
                  </li>
                ))}
                {!feedback.length && <li className="text-sm text-ink-500">No reviews yet.</li>}
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

const __loader = () => __render();

export default function PageView() {
  return <ClientPage render={__loader} props={{}} />;
}
