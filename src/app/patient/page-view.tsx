"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  Activity,
  ArrowRight,
  CalendarPlus,
  ChevronRight,
  Droplet,
  FileText,
  FlaskConical,
  HeartPulse,
  Lightbulb,
  Megaphone,
  Pill,
  Receipt,
  Salad,
  Scale,
  Video,
} from "lucide-react";
import { db } from "@/db";
import { carePlans, prescriptionItems, prescriptions } from "@/db/schema";
import { AppointmentCard } from "@/components/patient/appointment-card";
import { DoseDots } from "@/components/prescription-document";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/misc";
import { isUpcoming } from "@/lib/appointments";
import { requirePatient } from "@/lib/auth/session";
import { MEAL_SLOTS, type Meals } from "@/lib/constants";
import { ageFrom, bmi, fmtDate, fmtLongDate, parseJSON } from "@/lib/format";
import { listPatientAppointments, patientCounts, patientVitals } from "@/lib/queries/patient";
import { getSettings } from "@/lib/settings";
import { addDays, clinicNow, diffDays } from "@/lib/time";
import { cn } from "@/lib/cn";

const QUICK = [
  { href: "/patient/book", label: "Book visit", icon: CalendarPlus, tone: "bg-brand-50 text-brand-700" },
  { href: "/patient/book?mode=video", label: "Video consult", icon: Video, tone: "bg-violet-50 text-violet-700" },
  { href: "/patient/pharmacy", label: "Pharmacy", icon: Pill, tone: "bg-success-50 text-success-700" },
  { href: "/patient/prescriptions", label: "Prescriptions", icon: FileText, tone: "bg-info-50 text-info-700" },
  { href: "/patient/care-plan", label: "Diet plan", icon: Salad, tone: "bg-accent-50 text-accent-700" },
  { href: "/patient/records", label: "Health records", icon: Activity, tone: "bg-danger-50 text-danger-700" },
  { href: "/patient/health-checks", label: "Health checks", icon: FlaskConical, tone: "bg-brand-50 text-brand-700" },
  { href: "/patient/bills", label: "Bills", icon: Receipt, tone: "bg-surface-2 text-ink-700" },
];

function greeting(minutes: number) {
  if (minutes < 12 * 60) return "Good morning";
  if (minutes < 17 * 60) return "Good afternoon";
  return "Good evening";
}

async function __render({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const sp = await searchParams;
  const { user, patient } = await requirePatient();
  const now = clinicNow();

  const [appts, vit, settings, counts, rxRows, [plan]] = await Promise.all([
    listPatientAppointments(patient.id),
    patientVitals(patient.id),
    getSettings(),
    patientCounts(user.id, patient.id),
    db
      .select({ rx: prescriptions, item: prescriptionItems })
      .from(prescriptions)
      .innerJoin(prescriptionItems, eq(prescriptionItems.prescriptionId, prescriptions.id))
      .where(eq(prescriptions.patientId, patient.id))
      .orderBy(desc(prescriptions.createdAt)),
    db.select().from(carePlans).where(eq(carePlans.patientId, patient.id)).orderBy(desc(carePlans.createdAt)).limit(1),
  ]);

  const upcoming = appts.filter((a) => isUpcoming(a, now)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const next = upcoming[0];

  // Medicines still within their course
  const activeMeds = rxRows.filter((r) => addDays(r.rx.createdAt.slice(0, 10), r.item.durationDays) >= now.date && r.item.frequency !== "STAT");
  const latestRx = rxRows[0]?.rx;
  const meals = plan ? parseJSON<Meals>(plan.meals, {}) : {};

  const lastV = vit[0];
  const lastBP = vit.find((v) => v.bpSystolic);
  const lastSugar = vit.find((v) => v.bloodSugar);
  const weightRow = vit.find((v) => v.weightKg);
  const weight = weightRow?.weightKg ?? patient.weightKg;
  const b = bmi(weight, patient.heightCm ?? weightRow?.heightCm);

  const tips: { text: string; href?: string; cta?: string; tone: "info" | "warning" | "success" }[] = [];
  if (latestRx?.followUpDate) {
    const d = diffDays(latestRx.followUpDate, now.date);
    const booked = upcoming.some((a) => a.date >= addDays(latestRx.followUpDate!, -7));
    if (!booked && d <= 7)
      tips.push({ tone: d < 0 ? "warning" : "info", text: d < 0 ? `Your follow-up was due on ${fmtDate(latestRx.followUpDate)}.` : `Follow-up due on ${fmtDate(latestRx.followUpDate)}.`, href: "/patient/book", cta: "Book follow-up" });
  }
  if (lastBP?.bpSystolic && (lastBP.bpSystolic >= 140 || (lastBP.bpDiastolic ?? 0) >= 90))
    tips.push({ tone: "warning", text: `Your last BP was ${lastBP.bpSystolic}/${lastBP.bpDiastolic} mmHg — above target. Keep salt under 5 g a day and check BP twice a week.`, href: "/patient/records", cta: "See trend" });
  if (lastSugar?.bloodSugar && lastSugar.sugarType === "fasting" && lastSugar.bloodSugar > 126)
    tips.push({ tone: "warning", text: `Fasting sugar ${lastSugar.bloodSugar} mg/dL is above the 80–130 target. Follow your diet plan and walk after dinner.`, href: "/patient/care-plan", cta: "Diet plan" });
  if (b && b.value >= 23) tips.push({ tone: "info", text: `BMI ${b.value} (${b.band.toLowerCase()} for Asian adults). Losing 5% of body weight improves sugar and BP.`, href: "/patient/care-plan", cta: "Lifestyle tips" });
  const tests = latestRx ? parseJSON<string[]>(latestRx.labTests, []) : [];
  if (tests.length) tips.push({ tone: "info", text: `${tests.length} test${tests.length > 1 ? "s" : ""} advised: ${tests.slice(0, 3).join(", ")}${tests.length > 3 ? "…" : ""}`, href: "/patient/health-checks", cta: "Book tests" });
  if (counts.cart > 0) tips.push({ tone: "success", text: `${counts.cart} item${counts.cart > 1 ? "s" : ""} waiting in your pharmacy cart.`, href: "/patient/cart", cta: "Checkout" });
  if (!tips.length) tips.push({ tone: "success", text: "You're all caught up. Stay active — 30 minutes of walking a day keeps your heart healthy." });

  return (
    <div className="space-y-5 sm:space-y-6">
      {sp.welcome === "1" && (
        <Alert tone="success" title="Your account is ready">
          Your Unique Health ID is <strong className="tabular">{patient.uhid}</strong>. Show it at the registration desk and pharmacy counter.
        </Alert>
      )}

      <div>
        <p className="text-sm text-ink-500">{fmtLongDate(now.date)}</p>
        <h1 className="mt-0.5 text-[1.5rem] font-bold sm:text-[1.75rem]">
          {greeting(now.minutes)}, {user.name.split(" ")[0]}
        </h1>
      </div>

      {/* Health ID card */}
      <Link
        href="/patient/profile"
        className="relative block overflow-hidden rounded-2xl bg-brand-800 p-4 text-white shadow-soft sm:p-5"
        style={{ backgroundImage: "radial-gradient(120% 120% at 100% 0%, rgb(63 154 168 / 0.55), transparent 55%)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-brand-200">Medora Health ID</p>
            <p className="tabular mt-1 font-display text-2xl font-bold tracking-wide">{patient.uhid}</p>
          </div>
          <HeartPulse className="size-7 text-accent-500" aria-hidden />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-brand-200">Name</p>
            <p className="truncate font-semibold">{user.name}</p>
          </div>
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-brand-200">Age</p>
            <p className="font-semibold">{ageFrom(patient.dob) ?? "—"} yrs</p>
          </div>
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-brand-200">Blood group</p>
            <p className="font-semibold">{patient.bloodGroup ?? "—"}</p>
          </div>
        </div>
        {patient.allergies && <p className="mt-3 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs">⚠ Allergies: {patient.allergies}</p>}
      </Link>

      {settings.announcement && (
        <div className="flex items-start gap-3 rounded-xl border border-accent-100 bg-accent-50 px-3.5 py-3 text-sm text-accent-700">
          <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{settings.announcement}</p>
        </div>
      )}

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <ul className="grid grid-cols-4 gap-2 sm:gap-3">
          {QUICK.map(({ href, label, icon: Icon, tone }) => (
            <li key={href}>
              <Link href={href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-white px-1 py-3 text-center shadow-card transition hover:border-brand-200 sm:py-4">
                <span className={cn("grid size-10 place-items-center rounded-xl sm:size-11", tone)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-[0.6875rem] font-semibold leading-tight text-ink-800 sm:text-xs">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-5 lg:col-span-3">
          {/* Next appointment */}
          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-base font-semibold">Upcoming appointments</h2>
              <Link href="/patient/appointments" className="text-sm font-semibold text-brand-700">
                View all
              </Link>
            </div>
            {next ? (
              <div className="space-y-3">
                {upcoming.slice(0, 2).map((a) => (
                  <AppointmentCard key={a.code} appt={a} />
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={<CalendarPlus />}
                  title="No upcoming appointments"
                  description="Book an in-person OPD visit or consult a specialist on video from home."
                  action={
                    <LinkButton href="/patient/book" size="sm">
                      Book an appointment
                    </LinkButton>
                  }
                />
              </Card>
            )}
          </section>

          {/* Medicines */}
          <Card>
            <CardHeader
              icon={<Pill />}
              title="Today's medicines"
              description={activeMeds.length ? "From your current prescriptions" : undefined}
              action={
                <Link href="/patient/prescriptions" className="text-sm font-semibold text-brand-700">
                  All
                </Link>
              }
            />
            {activeMeds.length ? (
              <ul className="divide-y divide-line">
                {activeMeds.slice(0, 6).map(({ item, rx }) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">{item.medicineName}</p>
                      <p className="truncate text-xs text-ink-500">
                        {item.timing ?? "As directed"} · till {fmtDate(addDays(rx.createdAt.slice(0, 10), item.durationDays))}
                      </p>
                    </div>
                    <DoseDots frequency={item.frequency} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-ink-500">No active medicine courses right now.</p>
            )}
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-2">
          {/* Recommendations */}
          <Card>
            <CardHeader icon={<Lightbulb />} title="Recommended for you" />
            <ul className="divide-y divide-line">
              {tips.map((t, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      t.tone === "warning" ? "bg-warning-600" : t.tone === "success" ? "bg-success-600" : "bg-info-600",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-ink-700">{t.text}</p>
                    {t.href && (
                      <Link href={t.href} className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-700">
                        {t.cta} <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Vitals */}
          <Card>
            <CardHeader
              icon={<Activity />}
              title="Latest vitals"
              description={lastV ? `Recorded ${fmtDate(lastV.recordedAt)}` : undefined}
              action={
                <Link href="/patient/records" className="text-sm font-semibold text-brand-700">
                  Trend
                </Link>
              }
            />
            <dl className="grid grid-cols-2 gap-px bg-line">
              {[
                { icon: HeartPulse, label: "Blood pressure", value: lastBP ? `${lastBP.bpSystolic}/${lastBP.bpDiastolic}` : "—", unit: "mmHg" },
                { icon: Droplet, label: `Sugar${lastSugar?.sugarType ? ` (${lastSugar.sugarType})` : ""}`, value: lastSugar?.bloodSugar ?? "—", unit: "mg/dL" },
                { icon: Scale, label: "Weight", value: weight ?? "—", unit: "kg" },
                { icon: Activity, label: "BMI", value: b?.value ?? "—", unit: b?.band ?? "" },
              ].map(({ icon: Icon, label, value, unit }) => (
                <div key={label} className="bg-white px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-xs text-ink-500">
                    <Icon className="size-3.5" aria-hidden /> {label}
                  </dt>
                  <dd className="mt-1">
                    <span className="tabular font-display text-lg font-bold text-ink-900">{value}</span> <span className="text-xs text-ink-500">{unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Diet preview */}
          {plan && (
            <Link href="/patient/care-plan" className="block rounded-2xl border border-line bg-white shadow-card transition hover:border-brand-200">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-accent-50 text-accent-700">
                    <Salad className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[0.9375rem] font-semibold text-ink-900">Your diet plan</p>
                    <p className="text-xs text-ink-500">
                      {plan.dietType}
                      {plan.calories ? ` · ~${plan.calories} kcal` : ""}
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-ink-300" aria-hidden />
              </div>
              <ul className="space-y-2.5 px-4 py-3.5 sm:px-5">
                {MEAL_SLOTS.filter((m) => meals[m.key]).slice(1, 4).map((m) => (
                  <li key={m.key} className="text-sm">
                    <span className="font-semibold text-ink-800">{m.label}</span> <span className="text-ink-400">· {m.time}</span>
                    <p className="line-clamp-2 text-ink-600">{meals[m.key]}</p>
                  </li>
                ))}
              </ul>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
