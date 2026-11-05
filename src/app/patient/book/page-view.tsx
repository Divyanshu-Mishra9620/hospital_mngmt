"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { and, asc, avg, count, eq } from "drizzle-orm";
import { Building2, Check, Languages, Video } from "lucide-react";
import { db } from "@/db";
import { departments, doctors, feedback, users } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { Avatar, PageHeader, Stars } from "@/components/ui/misc";
import { getNumberSetting } from "@/lib/settings";
import { requirePatient } from "@/lib/auth/session";
import { fmtRelativeDay, fmtTime, inr } from "@/lib/format";
import { getDoctorAvailability, nextAvailableByDoctor } from "@/lib/slots";
import { clinicNow } from "@/lib/time";
import { cn } from "@/lib/cn";
import { BookingForm } from "./booking-form";
import { DoctorPicker, type PickerDoctor } from "./doctor-picker";

type SP = { dept?: string; doctor?: string; mode?: string; date?: string; q?: string };

function href(base: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  const merged = { ...base, ...patch };
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const s = p.toString();
  return `/patient/book${s ? `?${s}` : ""}`;
}

async function __render({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePatient();
  const sp = await searchParams;
  const mode = sp.mode === "video" ? "video" : sp.mode === "in_person" ? "in_person" : undefined;

  const depts = await db.select().from(departments).where(eq(departments.active, true)).orderBy(asc(departments.sortOrder));
  const docRows = await db
    .select({ doctor: doctors, name: users.name, deptSlug: departments.slug, deptName: departments.name, deptLocation: departments.location })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .where(and(eq(doctors.active, true), eq(users.active, true)))
    .orderBy(asc(departments.sortOrder), asc(users.name));
  const ratings = await db.select({ doctorId: feedback.doctorId, avg: avg(feedback.rating), n: count() }).from(feedback).groupBy(feedback.doctorId);
  const ratingBy = new Map(ratings.map((r) => [r.doctorId, { avg: Number(r.avg ?? 0), n: r.n }]));

  const selected = sp.doctor ? docRows.find((d) => d.doctor.code === sp.doctor) : undefined;

  /* ----------------------------------------------- Step 2: slots for a doctor */
  if (selected) {
    const d = selected.doctor;
    const effectiveMode = mode ?? "in_person";
    const videoOk = d.videoEnabled;
    const days = await getDoctorAvailability(d.id, clinicNow().date, (await getNumberSetting("bookingWindowDays")) + 1, effectiveMode === "video" && !videoOk ? "in_person" : effectiveMode);
    const date = sp.date && days.some((x) => x.date === sp.date) ? sp.date : (days.find((x) => x.available > 0)?.date ?? days[0].date);
    const fee = effectiveMode === "video" ? d.videoFee : d.inPersonFee;
    const r = ratingBy.get(d.id);

    return (
      <div>
        <PageHeader title="Book appointment" back={{ href: href({ dept: selected.deptSlug, mode }, {}), label: "Change doctor" }} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
          <div className="space-y-5">
            {/* Doctor summary */}
            <Card className="flex items-start gap-3 p-4 sm:p-5">
              <Avatar name={selected.name} color={d.avatarColor} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[1.0625rem] font-bold text-ink-900">{selected.name}</p>
                <p className="text-sm text-ink-600">{d.designation}</p>
                <p className="text-sm text-ink-500">{selected.deptName}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                  <span>{d.experienceYears}+ yrs experience</span>
                  {r && r.n > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Stars value={r.avg} /> {r.avg.toFixed(1)} ({r.n})
                    </span>
                  )}
                </div>
              </div>
            </Card>

            {/* Mode */}
            <section>
              <h2 className="mb-2.5 text-sm font-semibold text-ink-800">1. Consultation type</h2>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { m: "in_person", title: "In-person visit", sub: selected.deptLocation ?? "At the hospital", price: d.inPersonFee, icon: Building2, enabled: true },
                    { m: "video", title: "Video consult", sub: "From your phone or laptop", price: d.videoFee, icon: Video, enabled: videoOk },
                  ] as const
                ).map((o) => {
                  const on = effectiveMode === o.m;
                  const Icon = o.icon;
                  const body = (
                    <>
                      <div className="flex items-center justify-between">
                        <span className={cn("grid size-9 place-items-center rounded-xl", on ? "bg-brand-600 text-white" : "bg-surface text-ink-500")}>
                          <Icon className="size-[1.125rem]" aria-hidden />
                        </span>
                        {on && <Check className="size-5 text-brand-600" aria-hidden />}
                      </div>
                      <p className="mt-2.5 text-sm font-semibold text-ink-900">{o.title}</p>
                      <p className="line-clamp-1 text-xs text-ink-500">{o.enabled ? o.sub : "Not offered by this doctor"}</p>
                      <p className="tabular mt-1.5 font-display text-lg font-bold text-ink-900">{inr(o.price)}</p>
                    </>
                  );
                  return o.enabled ? (
                    <Link
                      key={o.m}
                      href={href(sp, { mode: o.m, date: undefined })}
                      scroll={false}
                      aria-current={on ? "true" : undefined}
                      className={cn("rounded-2xl border-2 bg-white p-3.5 transition", on ? "border-brand-600 shadow-soft" : "border-line hover:border-brand-200")}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div key={o.m} className="rounded-2xl border-2 border-line bg-surface p-3.5 opacity-60" aria-disabled>
                      {body}
                    </div>
                  );
                })}
              </div>
              {effectiveMode === "video" && (
                <p className="mt-2 text-xs text-ink-500">
                  Video consults are {inr(d.inPersonFee - d.videoFee)} cheaper than visiting the hospital. You&apos;ll get a digital prescription right after the call.
                </p>
              )}
            </section>

            <BookingForm
              key={`${d.id}-${effectiveMode}`}
              doctorId={d.id}
              doctorCode={d.code}
              doctorName={selected.name}
              mode={effectiveMode}
              initialDate={date}
              days={days}
              fee={fee}
              location={effectiveMode === "in_person" ? `${selected.deptLocation ?? ""}${d.room ? ` · Room ${d.room}` : ""}` : null}
            />
          </div>

          {/* Side info (laptop) */}
          <aside className="hidden space-y-4 lg:block">
            <Card className="p-5 text-sm">
              <p className="font-semibold text-ink-900">Good to know</p>
              <ul className="mt-3 space-y-2.5 text-ink-600">
                <li>• Each doctor has their own calendar — booking with one doctor never blocks another.</li>
                <li>• Free cancellation up to 2 hours before your slot.</li>
                <li>• In-person: arrive 15 minutes early with your UHID.</li>
                <li>• Video: join from the app 15 minutes before; keep reports handy.</li>
              </ul>
            </Card>
            {d.languages && (
              <Card className="flex items-start gap-3 p-5 text-sm">
                <Languages className="mt-0.5 size-4 text-brand-600" aria-hidden />
                <p className="text-ink-600">
                  <span className="font-semibold text-ink-800">Speaks:</span> {d.languages}
                </p>
              </Card>
            )}
          </aside>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------- Step 1: pick a doctor */
  const ids = docRows.map((d) => d.doctor.id);
  const [nextIn, nextVideo] = await Promise.all([nextAvailableByDoctor(ids, 7, "in_person"), nextAvailableByDoctor(ids, 7, "video")]);
  const label = (x: { date: string; time: string } | null | undefined) => (x ? `${fmtRelativeDay(x.date)}, ${fmtTime(x.time)}` : null);
  const pickerDoctors: PickerDoctor[] = docRows.map((d) => {
    const r = ratingBy.get(d.doctor.id);
    return {
      id: d.doctor.id,
      code: d.doctor.code,
      name: d.name,
      designation: d.doctor.designation,
      deptSlug: d.deptSlug,
      deptName: d.deptName,
      experience: d.doctor.experienceYears,
      expertise: d.doctor.expertise,
      color: d.doctor.avatarColor,
      inPersonFee: d.doctor.inPersonFee,
      videoFee: d.doctor.videoFee,
      videoEnabled: d.doctor.videoEnabled,
      rating: r?.avg ?? 0,
      ratingCount: r?.n ?? 0,
      nextInPerson: label(nextIn.get(d.doctor.id)),
      nextVideo: d.doctor.videoEnabled ? label(nextVideo.get(d.doctor.id)) : null,
    };
  });

  return (
    <div>
      <PageHeader title="Book an appointment" description="Choose a speciality and doctor. You'll see live slot availability next." />
      <DoctorPicker
        doctors={pickerDoctors}
        depts={depts.map((dp) => ({ slug: dp.slug, label: dp.name.split(" & ")[0].split(" (")[0] }))}
        initial={{ q: sp.q ?? "", dept: sp.dept ?? "", mode: mode ?? "" }}
      />
    </div>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
