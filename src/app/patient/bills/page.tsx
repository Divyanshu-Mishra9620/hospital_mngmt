import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ChevronRight, FlaskConical, Pill, Receipt, Stethoscope } from "lucide-react";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { fmtDateTime, inr } from "@/lib/format";

export const metadata: Metadata = { title: "Bills & payments" };

const ICON = { consultation: Stethoscope, pharmacy_order: Pill, pharmacy_counter: Pill, health_package: FlaskConical } as const;

export default async function BillsPage() {
  const { patient } = await requirePatient();
  const rows = await db.select().from(payments).where(eq(payments.patientId, patient.id)).orderBy(desc(payments.createdAt));
  const paid = rows.filter((r) => r.status === "success");
  const sum = (p: string[]) => paid.filter((r) => p.includes(r.purpose)).reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader title="Bills & payments" description="Receipts for consultations, pharmacy and health check-ups" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Consultations" value={inr(sum(["consultation"]))} icon={<Stethoscope />} />
        <StatCard label="Pharmacy" value={inr(sum(["pharmacy_order", "pharmacy_counter"]))} icon={<Pill />} tone="success" />
        <div className="col-span-2 lg:col-span-1">
          <StatCard label="Health check-ups" value={inr(sum(["health_package"]))} icon={<FlaskConical />} tone="accent" />
        </div>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Receipt />} title="No payments yet" />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((p) => {
              const Icon = ICON[p.purpose];
              return (
                <li key={p.id}>
                  <Link href={`/patient/bills/${p.code}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface/60 sm:px-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-ink-600">
                      <Icon className="size-[1.125rem]" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{p.description}</p>
                      <p className="text-xs text-ink-500">
                        {fmtDateTime(p.createdAt)} · {p.method.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`tabular text-sm font-semibold ${p.status === "refunded" ? "text-ink-400 line-through" : "text-ink-900"}`}>{inr(p.amount, { paise: true })}</p>
                      {p.status === "refunded" && <Badge tone="info">Refunded</Badge>}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-ink-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
