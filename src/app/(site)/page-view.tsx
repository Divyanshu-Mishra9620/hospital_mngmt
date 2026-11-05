"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import {
  Ambulance,
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarCheck,
  CalendarPlus,
  Check,
  Clock,
  FileText,
  FlaskConical,
  HeartPulse,
  Pill,
  Quote,
  Search,
  ShieldCheck,
  Siren,
  Smartphone,
  Stethoscope,
  Users,
  Video,
} from "lucide-react";
import { DepartmentIcon } from "@/components/icons";
import { DoctorCard } from "@/components/site/doctor-card";
import { Avatar, Stars } from "@/components/ui/misc";
import { buttonStyles } from "@/components/ui/button";
import { ARTICLES } from "@/lib/content";
import { HOSPITAL } from "@/lib/constants";
import { fmtDate, inr, parseJSON } from "@/lib/format";
import { publicDepartments, publicDoctors, publicPackages, testimonials } from "@/lib/queries/public";
import { cn } from "@/lib/cn";

const QUICK = [
  { href: "/book", title: "Book appointment", text: "Live OPD slots for 30+ specialities", icon: CalendarPlus, tone: "bg-brand-600 text-white" },
  { href: "/book?mode=video", title: "Video consultation", text: "See a specialist from home", icon: Video, tone: "bg-violet-50 text-violet-700" },
  { href: "/doctors", title: "Find a doctor", text: "By name, speciality or condition", icon: Search, tone: "bg-info-50 text-info-700" },
  { href: "/health-packages", title: "Health check-ups", text: "Preventive packages from ₹1,499", icon: FlaskConical, tone: "bg-accent-50 text-accent-700" },
  { href: "/login", title: "Order medicines", text: "24×7 pharmacy, pickup or delivery", icon: Pill, tone: "bg-success-50 text-success-700" },
  { href: HOSPITAL.emergencyHref, title: "Emergency 24×7", text: HOSPITAL.emergency, icon: Siren, tone: "bg-danger-50 text-danger-700" },
];

async function __render() {
  const [depts, doctors, pkgs, quotes] = await Promise.all([publicDepartments(), publicDoctors(), publicPackages(), testimonials(3)]);
  const featured = [...doctors].sort((a, b) => b.rating.avg * Math.log(b.rating.n + 1) - a.rating.avg * Math.log(a.rating.n + 1)).slice(0, 6);
  const specialistCount = doctors.length;

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        <div
          className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(119 188 199 / .45), transparent 65%)" }}
          aria-hidden
        />
        <div className="container-page relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:py-20">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-card">
              <BadgeCheck className="size-3.5" aria-hidden /> Trusted by families in {HOSPITAL.city} since {HOSPITAL.established}
            </p>
            <h1 className="mt-5 text-[2.25rem] font-extrabold leading-[1.08] sm:text-5xl lg:text-[3.5rem]" style={{ letterSpacing: "-0.035em" }}>
              Advanced care.
              <br />
              <span className="text-brand-600">Human touch.</span>
            </h1>
            <p className="lead mt-5 max-w-xl">
              {HOSPITAL.beds}-bed multispeciality hospital with {specialistCount}+ senior specialists, round-the-clock emergency care and video consultations from {inr(350)}.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/book" className={buttonStyles({ size: "lg" })}>
                <CalendarPlus aria-hidden /> Book an appointment
              </Link>
              <Link href="/book?mode=video" className={buttonStyles({ size: "lg", variant: "outline" })}>
                <Video aria-hidden /> Consult on video
              </Link>
            </div>
            <form action="/doctors" className="mt-6 flex max-w-xl items-center gap-2 rounded-2xl border border-line bg-white p-1.5 shadow-soft">
              <Search className="ml-2.5 size-5 shrink-0 text-ink-400" aria-hidden />
              <input name="q" placeholder="Search doctors, specialities, conditions…" className="h-10 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-ink-400" aria-label="Search doctors" />
              <button type="submit" className={buttonStyles({ size: "sm" })}>
                Search
              </button>
            </form>
            <dl className="mt-9 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {[
                { k: "Beds", v: `${HOSPITAL.beds}` },
                { k: "Specialists", v: `${specialistCount}+` },
                { k: "ICU beds", v: `${HOSPITAL.icuBeds}` },
                { k: "Years of care", v: `${new Date().getFullYear() - HOSPITAL.established}` },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{s.k}</dt>
                  <dd className="tabular mt-0.5 font-display text-2xl font-bold text-ink-900 sm:text-[1.75rem]">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Hero visual — product glimpse */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
            <div className="relative rounded-[1.75rem] bg-brand-800 p-6 text-white shadow-lift" style={{ backgroundImage: "radial-gradient(120% 100% at 100% 0%, rgb(63 154 168 / .55), transparent 60%)" }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">Your next visit</p>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[0.6875rem] font-semibold">Confirmed</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Avatar name="Ananya Rao" color="#b4405a" size="lg" className="ring-2 ring-white/30" />
                <div>
                  <p className="font-display text-lg font-bold">Dr. Ananya Rao</p>
                  <p className="text-sm text-brand-200">Interventional Cardiology</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                {["09:30", "09:45", "10:00", "10:15", "10:30", "10:45"].map((t, i) => (
                  <span key={t} className={cn("rounded-xl py-2 text-sm font-semibold", i === 2 ? "bg-accent-500 text-ink-950" : i === 0 || i === 4 ? "bg-white/5 text-white/30 line-through" : "bg-white/10")}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <Video className="size-4 text-accent-500" /> Video consult
                </span>
                <span className="font-display text-lg font-bold">₹350</span>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-4 hidden w-56 rounded-2xl border border-line bg-white p-4 shadow-lift sm:block">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <FileText className="size-4 text-brand-600" /> Digital prescription
              </p>
              <p className="mt-1 text-xs text-ink-500">Medicines, diet plan &amp; advice in your app right after the visit.</p>
            </div>
            <div className="absolute -right-3 -top-5 hidden items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 shadow-lift sm:flex">
              <HeartPulse className="size-5 text-danger-600" />
              <div className="leading-tight">
                <p className="text-sm font-bold text-ink-900">24×7 Cath lab</p>
                <p className="text-xs text-ink-500">Door-to-balloon &lt; 60 min</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Quick access */}
      <section className="container-page relative z-10 -mt-2 pb-4 sm:-mt-4">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {QUICK.map(({ href, title, text, icon: Icon, tone }) => (
            <li key={title}>
              <Link href={href} className="flex h-full flex-col rounded-2xl border border-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft">
                <span className={cn("grid size-11 place-items-center rounded-xl", tone)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="mt-3 text-[0.9375rem] font-semibold leading-snug text-ink-900">{title}</p>
                <p className="mt-0.5 text-xs leading-snug text-ink-500">{text}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------- Specialities */}
      <section className="section">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Centres of excellence</p>
              <h2 className="section-title mt-2">Specialist care across {depts.length} departments</h2>
              <p className="lead mt-3">Multidisciplinary teams, modern technology and evidence-based protocols — so you get the right care the first time.</p>
            </div>
            <Link href="/departments" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:gap-2.5">
              All specialities <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {depts.slice(0, 12).map((d) => (
              <li key={d.slug}>
                <Link href={`/departments/${d.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-white p-4 transition hover:border-brand-200 hover:shadow-soft sm:p-5">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                    <DepartmentIcon name={d.icon} className="size-[1.375rem]" />
                  </span>
                  <h3 className="mt-3.5 text-[0.9375rem] font-semibold leading-snug sm:text-base">{d.name}</h3>
                  <p className="mt-1 hidden text-sm leading-relaxed text-ink-500 sm:line-clamp-2">{d.summary}</p>
                  <p className="mt-auto pt-3 text-xs font-medium text-brand-700">
                    {d.doctorCount} specialist{d.doctorCount === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------- Video consult */}
      <section className="bg-brand-950 text-brand-100">
        <div className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="eyebrow text-accent-500!">Video consultation</p>
            <h2 className="section-title mt-2 text-white">See your specialist without the commute</h2>
            <p className="mt-4 text-base leading-relaxed text-brand-200 sm:text-lg">
              Private, secure one-on-one video calls with the same Medora doctors you&apos;d meet in the OPD — ideal for follow-ups, report reviews and medicine adjustments.
            </p>
            <div className="mt-7 grid max-w-md grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-brand-300">Hospital visit</p>
                <p className="tabular mt-1 font-display text-2xl font-bold text-white">{inr(500)}</p>
              </div>
              <div className="rounded-2xl border border-accent-500/50 bg-accent-500/10 p-4">
                <p className="text-xs uppercase tracking-wide text-accent-500">Video consult</p>
                <p className="tabular mt-1 font-display text-2xl font-bold text-white">{inr(350)}</p>
              </div>
            </div>
            <Link href="/book?mode=video" className={buttonStyles({ variant: "accent", size: "lg", className: "mt-8" })}>
              Book a video consult <ArrowRight aria-hidden />
            </Link>
          </div>
          <ol className="space-y-4">
            {[
              { icon: CalendarCheck, title: "Pick a doctor and slot", text: "Choose a video slot that suits you and pay securely online." },
              { icon: Smartphone, title: "Join from your phone", text: "Open the appointment in the app and tap Join — no downloads needed." },
              { icon: FileText, title: "Get your prescription", text: "Prescription, diet plan and tests appear in the app; order medicines in one tap." },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-accent-500">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold text-brand-300">Step {i + 1}</p>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-brand-200">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------ Doctors */}
      <section className="section bg-surface">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Our specialists</p>
              <h2 className="section-title mt-2">Meet some of our doctors</h2>
            </div>
            <Link href="/doctors" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:gap-2.5">
              View all {doctors.length} doctors <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((d) => (
              <li key={d.doctor.code}>
                <DoctorCard d={d} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------- Why Medora */}
      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div>
            <p className="eyebrow">Why Medora</p>
            <h2 className="section-title mt-2">Hospital-grade safety, with care that feels personal</h2>
            <p className="lead mt-4">We measure what matters — infection rates, waiting times, and how our patients feel when they go home — and publish improvements every quarter.</p>
            <Link href="/about" className={buttonStyles({ variant: "outline", className: "mt-7" })}>
              About the hospital
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Ambulance, title: "Emergency in minutes", text: "Advanced life-support ambulances and a 30-bed emergency department open 24×7." },
              { icon: ShieldCheck, title: "Safety first", text: "Infection-control audits, barcode medication checks and surgical safety checklists." },
              { icon: Users, title: "Team-based care", text: "Tumour boards, heart teams and joint clinics review complex cases together." },
              { icon: Clock, title: "Respect for your time", text: "Slot-based OPD with tokens, digital records and reports on your phone." },
              { icon: Award, title: "Experienced specialists", text: "Our consultants average 14 years of experience after super-specialisation." },
              { icon: Stethoscope, title: "Transparent pricing", text: "Consultation fees shown upfront; package prices for common procedures." },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-line p-5">
                <Icon className="size-6 text-brand-600" aria-hidden />
                <p className="mt-3 font-semibold text-ink-900">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------- Health packages */}
      <section className="section bg-gradient-to-b from-accent-50/60 to-white">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Preventive health</p>
              <h2 className="section-title mt-2">Health check-up packages</h2>
              <p className="lead mt-3">Catch problems early. Reports within 24 hours and a doctor consultation included.</p>
            </div>
            <Link href="/health-packages" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:gap-2.5">
              All packages <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {pkgs.slice(0, 3).map((p) => {
              const tests = parseJSON<string[]>(p.tests, []);
              return (
                <li key={p.slug} className={cn("flex flex-col rounded-2xl border bg-white p-6 shadow-card", p.highlight ? "border-brand-300 ring-2 ring-brand-100" : "border-line")}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    {p.highlight && <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">Popular</span>}
                  </div>
                  <p className="text-sm text-ink-500">{p.audience}</p>
                  <p className="mt-4">
                    <span className="tabular font-display text-3xl font-bold text-ink-900">{inr(p.price)}</span>{" "}
                    <span className="text-sm text-ink-400 line-through">{inr(p.mrp)}</span>
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-600">
                    {tests.slice(0, 5).map((t) => (
                      <li key={t} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden /> {t}
                      </li>
                    ))}
                    {tests.length > 5 && <li className="pl-6 text-ink-400">+ {tests.length - 5} more</li>}
                  </ul>
                  <Link href={`/patient/health-checks?pkg=${p.slug}`} className={buttonStyles({ variant: p.highlight ? "primary" : "secondary", block: true, className: "mt-6" })}>
                    Book now
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------- Testimonials */}
      {quotes.length > 0 && (
        <section className="section">
          <div className="container-page">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">Patient stories</p>
              <h2 className="section-title mt-2">What our patients say</h2>
            </div>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {quotes.map((q, i) => (
                <li key={i} className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card">
                  <Quote className="size-7 text-brand-200" aria-hidden />
                  <p className="mt-3 flex-1 text-[0.9375rem] leading-relaxed text-ink-700">“{q.quote}”</p>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{q.name}</p>
                      <p className="text-xs text-ink-500">Consulted {q.doctor}</p>
                    </div>
                    <Stars value={q.rating} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------------------------------------------- Health library */}
      <section className="section bg-surface">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Health library</p>
              <h2 className="section-title mt-2">Expert advice from our doctors</h2>
            </div>
            <Link href="/health-library" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:gap-2.5">
              All articles <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {ARTICLES.slice(0, 3).map((a) => (
              <li key={a.slug}>
                <Link href={`/health-library/${a.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition hover:border-brand-200 hover:shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{a.category}</p>
                  <h3 className="mt-2 text-lg font-bold leading-snug group-hover:text-brand-700">{a.title}</h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-600">{a.excerpt}</p>
                  <p className="mt-4 text-xs text-ink-500">
                    {a.author} · {fmtDate(a.date)} · {a.readMins} min read
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- CTA */}
      <section className="container-page py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-brand-700 px-6 py-10 text-white sm:px-12 sm:py-14" style={{ backgroundImage: "radial-gradient(80% 120% at 100% 0%, rgb(63 154 168 / .7), transparent 60%)" }}>
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <h2 className="text-[1.75rem] font-bold text-white sm:text-4xl" style={{ letterSpacing: "-0.025em" }}>
                Your health, in your pocket
              </h2>
              <p className="mt-3 max-w-xl text-brand-100">
                Create a free patient account to get your UHID, book appointments, join video consults, view prescriptions and diet plans, and order medicines.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link href="/register" className={buttonStyles({ variant: "white", size: "lg" })}>
                Create account
              </Link>
              <Link href="/login" className={buttonStyles({ variant: "outline", size: "lg", className: "border-white/40 bg-transparent text-white hover:bg-white/10" })}>
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

const __loader = () => __render();

export default function PageView() {
  return <ClientPage render={__loader} props={{}} />;
}
