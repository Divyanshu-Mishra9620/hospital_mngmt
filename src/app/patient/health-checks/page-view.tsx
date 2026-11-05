"use client";

import { ClientPage } from "@/components/client-page";
import { asc, desc, eq } from "drizzle-orm";
import { CalendarCheck, Check } from "lucide-react";
import { db } from "@/db";
import { healthPackages, packageBookings } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { fmtDate, inr, parseJSON } from "@/lib/format";
import { addDays, clinicNow } from "@/lib/time";
import { cn } from "@/lib/cn";
import { BookPackage } from "./book-package";

async function __render({ searchParams }: { searchParams: Promise<{ pkg?: string }> }) {
  const { patient } = await requirePatient();
  const sp = await searchParams;
  const pkgs = await db.select().from(healthPackages).where(eq(healthPackages.active, true)).orderBy(asc(healthPackages.price));
  const mine = await db
    .select({ b: packageBookings, name: healthPackages.name })
    .from(packageBookings)
    .innerJoin(healthPackages, eq(healthPackages.id, packageBookings.packageId))
    .where(eq(packageBookings.patientId, patient.id))
    .orderBy(desc(packageBookings.date));
  const today = clinicNow().date;

  return (
    <div className="space-y-6">
      <PageHeader title="Health check-ups" description="Preventive packages with reports in 24 hours and a doctor consultation included." />

      {mine.length > 0 && (
        <Card>
          <CardHeader icon={<CalendarCheck />} title="My bookings" />
          <ul className="divide-y divide-line">
            {mine.map(({ b, name }) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <div>
                  <p className="font-semibold text-ink-900">{name}</p>
                  <p className="text-ink-500">
                    {fmtDate(b.date)} · <span className="tabular">{b.code}</span>
                  </p>
                </div>
                <Badge tone={b.status === "completed" ? "success" : b.status === "cancelled" ? "danger" : "brand"}>{b.status === "booked" ? "Booked" : b.status === "completed" ? "Completed" : "Cancelled"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pkgs.map((p) => {
          const tests = parseJSON<string[]>(p.tests, []);
          const open = sp.pkg === p.slug;
          return (
            <li key={p.id} className={cn("flex flex-col rounded-2xl border bg-white p-5 shadow-card", p.highlight ? "border-brand-300 ring-2 ring-brand-100" : "border-line")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-[1.0625rem] font-bold text-ink-900">{p.name}</p>
                  <p className="text-sm text-ink-500">{p.audience}</p>
                </div>
                {p.highlight && <Badge tone="brand">Popular</Badge>}
              </div>
              <p className="mt-3">
                <span className="tabular font-display text-2xl font-bold text-ink-900">{inr(p.price)}</span>{" "}
                <span className="text-sm text-ink-400 line-through">{inr(p.mrp)}</span>{" "}
                <span className="text-sm font-semibold text-success-700">{Math.round((1 - p.price / p.mrp) * 100)}% off</span>
              </p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-ink-600">
                {tests.map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <BookPackage packageId={p.id} price={p.price} minDate={addDays(today, 1)} maxDate={addDays(today, 30)} defaultOpen={open} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
