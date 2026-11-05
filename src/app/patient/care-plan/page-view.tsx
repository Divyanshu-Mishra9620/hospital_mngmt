"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Ban, Check, Droplets, Dumbbell, Flame, HeartHandshake, Moon, Salad, Utensils } from "lucide-react";
import { db } from "@/db";
import { carePlans, doctors, prescriptions, users } from "@/db/schema";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { MEAL_SLOTS, type Meals } from "@/lib/constants";
import { bmi, fmtDate, parseJSON } from "@/lib/format";
import { patientVitals } from "@/lib/queries/patient";
import { cn } from "@/lib/cn";

function chips(s: string | null) {
  return (s ?? "")
    .split(/[,;]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function __render({ searchParams }: { searchParams: Promise<{ rx?: string }> }) {
  const { patient } = await requirePatient();
  const sp = await searchParams;
  const plans = await db
    .select({ plan: carePlans, rxCode: prescriptions.code, diagnosis: prescriptions.diagnosis, doctorName: users.name })
    .from(carePlans)
    .innerJoin(prescriptions, eq(prescriptions.id, carePlans.prescriptionId))
    .innerJoin(doctors, eq(doctors.id, carePlans.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(carePlans.patientId, patient.id))
    .orderBy(desc(carePlans.createdAt));
  const vit = await patientVitals(patient.id);

  if (!plans.length) {
    return (
      <div>
        <PageHeader title="Diet & lifestyle" />
        <Card>
          <EmptyState icon={<Salad />} title="No diet plan yet" description="Your doctor's diet, exercise and lifestyle recommendations will appear here after a consultation." />
        </Card>
      </div>
    );
  }

  const current = plans.find((p) => p.rxCode === sp.rx) ?? plans[0];
  const p = current.plan;
  const meals = parseJSON<Meals>(p.meals, {});
  const weight = vit.find((v) => v.weightKg)?.weightKg ?? patient.weightKg;
  const b = bmi(weight, patient.heightCm);
  const lastBP = vit.find((v) => v.bpSystolic);
  const lastSugar = vit.find((v) => v.bloodSugar);

  const general: string[] = [];
  if (b) {
    if (b.value >= 25) general.push(`Your BMI is ${b.value}. A realistic first goal is to lose ${Math.round((weight ?? 0) * 0.05)} kg (5%) over 3 months.`);
    else if (b.value >= 23) general.push(`Your BMI is ${b.value} — slightly above the healthy range for Asian adults (18.5–22.9). Aim for small, steady weight loss.`);
    else if (b.value < 18.5) general.push(`Your BMI is ${b.value} — below the healthy range. Add protein-rich snacks and discuss with a dietitian.`);
    else general.push(`Your BMI of ${b.value} is in the healthy range — keep it up.`);
  }
  if (lastBP?.bpSystolic) {
    general.push(
      lastBP.bpSystolic >= 140 || (lastBP.bpDiastolic ?? 0) >= 90
        ? `Last BP ${lastBP.bpSystolic}/${lastBP.bpDiastolic} is high. Limit salt to 1 teaspoon a day, avoid pickles and papads.`
        : `Last BP ${lastBP.bpSystolic}/${lastBP.bpDiastolic} is within target.`,
    );
  }
  if (lastSugar?.bloodSugar && lastSugar.sugarType === "fasting") {
    general.push(lastSugar.bloodSugar > 130 ? `Fasting sugar ${lastSugar.bloodSugar} mg/dL — above the 80–130 target. Avoid sweets, juices and refined flour.` : `Fasting sugar ${lastSugar.bloodSugar} mg/dL is on target.`);
  }
  general.push("Walk at least 7,000–8,000 steps a day and take a 5-minute movement break every hour of sitting.");

  return (
    <div>
      <PageHeader title="Diet & lifestyle" description={`Personalised by ${current.doctorName} · ${fmtDate(p.createdAt)}`} />

      {plans.length > 1 && (
        <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {plans.map((x) => (
            <Link
              key={x.rxCode}
              href={`/patient/care-plan?rx=${x.rxCode}`}
              scroll={false}
              className={cn(
                "shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition",
                x.rxCode === current.rxCode ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-ink-600 hover:border-brand-200",
              )}
            >
              <span className="block font-semibold">{x.plan.dietType}</span>
              <span>
                {fmtDate(x.plan.createdAt)} · {x.doctorName}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-accent-50 to-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{p.dietType}</Badge>
                {p.calories && (
                  <Badge tone="neutral">
                    <Flame className="size-3" aria-hidden /> ~{p.calories} kcal / day
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-ink-600">
                For: <span className="font-medium text-ink-800">{current.diagnosis}</span>
              </p>
            </div>
            <CardHeader icon={<Utensils />} title="Daily meal plan" className="border-t" />
            <ol className="px-4 py-2 sm:px-5">
              {MEAL_SLOTS.filter((m) => meals[m.key]).map((m) => (
                <li key={m.key} className="relative flex gap-4 py-3">
                  <div className="w-16 shrink-0 pt-0.5 text-right sm:w-20">
                    <p className="tabular text-xs font-semibold text-brand-700">{m.time}</p>
                  </div>
                  <span className="relative mt-1.5 size-2.5 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-50" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{m.label}</p>
                    <p className="text-sm text-ink-600">{meals[m.key]}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader icon={<Check />} title="Include" />
              <CardBody>
                <ul className="flex flex-wrap gap-1.5">
                  {chips(p.include).map((c) => (
                    <li key={c} className="rounded-full bg-success-50 px-2.5 py-1 text-[0.8125rem] text-success-700">
                      {c}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader icon={<Ban />} title="Avoid / limit" />
              <CardBody>
                <ul className="flex flex-wrap gap-1.5">
                  {chips(p.avoid).map((c) => (
                    <li key={c} className="rounded-full bg-danger-50 px-2.5 py-1 text-[0.8125rem] text-danger-700">
                      {c}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>

        <div className="space-y-5">
          {[
            { icon: Droplets, title: "Hydration", text: p.hydration, tone: "bg-info-50 text-info-700" },
            { icon: Dumbbell, title: "Exercise", text: p.exercise, tone: "bg-success-50 text-success-700" },
            { icon: HeartHandshake, title: "Lifestyle", text: p.lifestyle, tone: "bg-violet-50 text-violet-700" },
            { icon: Moon, title: "Sleep", text: p.sleep, tone: "bg-brand-50 text-brand-700" },
          ]
            .filter((x) => x.text)
            .map(({ icon: Icon, title, text, tone }) => (
              <Card key={title} className="flex gap-3 p-4">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{title}</p>
                  <p className="text-sm text-ink-600">{text}</p>
                </div>
              </Card>
            ))}
          <Card>
            <CardHeader title="Based on your latest vitals" />
            <ul className="space-y-2.5 p-4 text-sm text-ink-600 sm:p-5">
              {general.map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  {g}
                </li>
              ))}
            </ul>
          </Card>
          <p className="px-1 text-xs text-ink-400">These recommendations support, and don&apos;t replace, your doctor&apos;s advice. Ask your doctor before major diet changes.</p>
        </div>
      </div>
    </div>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
