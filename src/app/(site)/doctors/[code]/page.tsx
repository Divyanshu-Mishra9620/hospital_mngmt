import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Building2, CalendarPlus, Clock, GraduationCap, Languages, MapPin, Quote, Video } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Avatar, Stars } from "@/components/ui/misc";
import { buttonStyles } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/constants";
import { fmtRelativeDay, fmtTime, inr } from "@/lib/format";
import { publicDoctor } from "@/lib/queries/public";
import { getDoctorAvailability } from "@/lib/slots";
import { clinicNow } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const d = await publicDoctor(code);
  return { title: d ? `${d.name} — ${d.dept.name}` : "Doctor" };
}

export default async function DoctorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = await publicDoctor(code);
  if (!d) notFound();
  const avail = await getDoctorAvailability(d.doctor.id, clinicNow().date, 7);
  const firstOpen = avail.find((x) => x.available > 0);

  const byDay = new Map<number, typeof d.schedule>();
  for (const s of d.schedule) byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), s]);

  return (
    <>
      <PageHero title={d.name} crumbs={[{ href: "/doctors", label: "Doctors" }, { href: `/doctors/${d.doctor.code}`, label: d.name }]}>
        <div className="-mt-2 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={d.name} color={d.doctor.avatarColor} size="xl" className="shadow-soft" />
            <div>
              <p className="text-[1.0625rem] font-semibold text-ink-800">{d.doctor.designation}</p>
              <Link href={`/departments/${d.dept.slug}`} className="text-sm font-medium text-brand-700 hover:underline">
                {d.dept.name}
              </Link>
              <p className="mt-1 text-sm text-ink-500">{d.doctor.qualifications}</p>
              {d.rating.n > 0 && (
                <p className="mt-2 flex items-center gap-2 text-sm text-ink-600">
                  <Stars value={d.rating.avg} /> {d.rating.avg.toFixed(1)} · {d.rating.n} patient reviews
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={`/book?doctor=${d.doctor.code}&mode=in_person`} className={buttonStyles({ size: "lg" })}>
              <CalendarPlus aria-hidden /> Visit · {inr(d.doctor.inPersonFee)}
            </Link>
            {d.doctor.videoEnabled && (
              <Link href={`/book?doctor=${d.doctor.code}&mode=video`} className={buttonStyles({ size: "lg", variant: "outline" })}>
                <Video aria-hidden /> Video · {inr(d.doctor.videoFee)}
              </Link>
            )}
          </div>
        </div>
      </PageHero>

      <section className="container-page grid gap-10 py-12 sm:py-14 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
        <div className="space-y-10">
          <div>
            <h2 className="text-xl font-bold">About</h2>
            <p className="mt-3 text-[1.0625rem] leading-relaxed text-ink-600">{d.doctor.bio}</p>
          </div>
          <div>
            <h2 className="text-xl font-bold">Areas of expertise</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {d.doctor.expertise.split(",").map((e) => (
                <li key={e} className="rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand-800">
                  {e.trim()}
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Award, k: "Experience", v: `${d.doctor.experienceYears}+ years` },
              { icon: GraduationCap, k: "Qualifications", v: d.doctor.qualifications },
              { icon: Languages, k: "Languages", v: d.doctor.languages },
              { icon: MapPin, k: "OPD location", v: `${d.dept.location}${d.doctor.room ? ` · Room ${d.doctor.room}` : ""}` },
            ].map(({ icon: Icon, k, v }) => (
              <div key={k} className="flex gap-3 rounded-2xl border border-line p-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{k}</dt>
                  <dd className="mt-0.5 text-sm text-ink-800">{v}</dd>
                </div>
              </div>
            ))}
          </dl>
          {d.reviews.length > 0 && (
            <div>
              <h2 className="text-xl font-bold">Patient reviews</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {d.reviews.map((r, i) => (
                  <li key={i} className="rounded-2xl border border-line p-5">
                    <Quote className="size-5 text-brand-200" aria-hidden />
                    <p className="mt-2 text-sm leading-relaxed text-ink-700">{r.comment}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
                      <span>
                        {r.name.split(" ")[0]} {r.name.split(" ").at(-1)?.[0]}.
                      </span>
                      <Stars value={r.rating} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-semibold text-ink-900">
              <Clock className="size-4 text-brand-600" aria-hidden /> Consultation hours
            </h2>
            <ul className="mt-4 divide-y divide-line text-sm">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                const blocks = byDay.get(wd) ?? [];
                return (
                  <li key={wd} className="flex justify-between gap-3 py-2">
                    <span className="font-medium text-ink-700">{WEEKDAYS[wd].slice(0, 3)}</span>
                    <span className="text-right text-ink-600">
                      {blocks.length
                        ? blocks.map((b) => (
                            <span key={b.id} className="block">
                              {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                              {b.mode === "video" && <Video className="ml-1 inline size-3.5 text-violet-700" aria-label="video only" />}
                              {b.mode === "in_person" && <Building2 className="ml-1 inline size-3.5 text-ink-400" aria-label="in-person only" />}
                            </span>
                          ))
                        : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
              {firstOpen ? (
                <>
                  Next available: <strong>{fmtRelativeDay(firstOpen.date)}, {fmtTime(firstOpen.slots.find((s) => s.state === "available")!.time)}</strong>
                </>
              ) : (
                "Fully booked this week — new slots open daily."
              )}
            </p>
            <Link href={`/book?doctor=${d.doctor.code}`} className={buttonStyles({ block: true, className: "mt-4" })}>
              See all slots &amp; book
            </Link>
          </div>
        </aside>
      </section>
    </>
  );
}
