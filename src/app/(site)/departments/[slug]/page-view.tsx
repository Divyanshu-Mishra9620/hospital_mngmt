"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Check, MapPin, Phone, Video } from "lucide-react";
import { DepartmentIcon } from "@/components/icons";
import { DoctorCard } from "@/components/site/doctor-card";
import { PageHero } from "@/components/site/page-hero";
import { buttonStyles } from "@/components/ui/button";
import { HOSPITAL } from "@/lib/constants";
import { publicDepartments, publicDoctors } from "@/lib/queries/public";

async function __render({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const depts = await publicDepartments();
  const d = depts.find((x) => x.slug === slug);
  if (!d) notFound();
  const doctors = await publicDoctors({ departmentId: d.id });
  const services = d.services.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <>
      <PageHero eyebrow="Speciality" title={d.name} description={d.summary} crumbs={[{ href: "/departments", label: "Specialities" }, { href: `/departments/${d.slug}`, label: d.name }]}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/book?dept=${d.slug}`} className={buttonStyles({ size: "lg" })}>
            <CalendarPlus aria-hidden /> Book with {d.name.split(" & ")[0].split(" (")[0]}
          </Link>
          {doctors.some((x) => x.doctor.videoEnabled) && (
            <Link href={`/book?dept=${d.slug}&mode=video`} className={buttonStyles({ size: "lg", variant: "outline" })}>
              <Video aria-hidden /> Video consult
            </Link>
          )}
        </div>
      </PageHero>

      <section className="container-page grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
        <div>
          <h2 className="text-2xl font-bold">About the department</h2>
          <p className="mt-3 text-[1.0625rem] leading-relaxed text-ink-600">{d.description}</p>
          <h3 className="mt-10 text-lg font-bold">Conditions & procedures</h3>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {services.map((s) => (
              <li key={s} className="flex gap-2.5 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-700">
                <Check className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden /> {s}
              </li>
            ))}
          </ul>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <span className="grid size-12 place-items-center rounded-xl bg-brand-600 text-white">
              <DepartmentIcon name={d.icon} className="size-6" />
            </span>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <div>
                  <dt className="font-semibold text-ink-900">Location</dt>
                  <dd className="text-ink-600">{d.location}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <div>
                  <dt className="font-semibold text-ink-900">Department desk</dt>
                  <dd className="text-ink-600">
                    {HOSPITAL.phone} · ext. {d.extension}
                  </dd>
                </div>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
            <p className="font-semibold">Is it an emergency?</p>
            <p className="mt-1">
              Don&apos;t wait for an appointment — call <a href={HOSPITAL.emergencyHref} className="font-semibold underline">{HOSPITAL.emergency}</a> or come straight to Emergency.
            </p>
          </div>
        </aside>
      </section>

      <section className="bg-surface py-12 sm:py-16">
        <div className="container-page">
          <h2 className="text-2xl font-bold">Our specialists</h2>
          {doctors.length ? (
            <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {doctors.map((x) => (
                <li key={x.doctor.code}>
                  <DoctorCard d={x} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-ink-500">Consultants for this department are available through the Emergency and Internal Medicine teams.</p>
          )}
        </div>
      </section>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
