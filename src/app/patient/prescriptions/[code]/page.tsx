import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { Salad } from "lucide-react";
import { db } from "@/db";
import { medicines } from "@/db/schema";
import { PrescriptionDocument } from "@/components/prescription-document";
import { PrintButton } from "@/components/print-button";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { inr } from "@/lib/format";
import { getPrescription } from "@/lib/queries/prescriptions";
import { AddToCart } from "./add-to-cart";

export const metadata: Metadata = { title: "Prescription" };

export default async function PrescriptionDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { patient } = await requirePatient();
  const rx = await getPrescription({ code });
  if (!rx || rx.patientId !== patient.id) notFound();

  const medIds = rx.items.map((i) => i.medicineId).filter((x): x is number => x != null);
  const meds = medIds.length ? await db.select().from(medicines).where(inArray(medicines.id, medIds)) : [];
  const medById = new Map(meds.map((m) => [m.id, m]));
  const orderable = rx.items
    .filter((i) => i.medicineId && i.remaining > 0)
    .map((i) => {
      const m = medById.get(i.medicineId!)!;
      return { id: i.id, name: m.name, qty: Math.min(i.remaining, m.stock), remaining: i.remaining, price: m.unitPrice, unit: m.unitLabel, stock: m.stock };
    });
  const estimate = orderable.reduce((s, o) => s + o.qty * o.price, 0);

  return (
    <div>
      <PageHeader
        title="Prescription"
        description={<span className="tabular">{rx.code}</span>}
        back={{ href: "/patient/prescriptions", label: "Prescriptions" }}
        actions={<PrintButton label="Print / save PDF" />}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        <PrescriptionDocument rx={rx} />
        <aside className="no-print space-y-5">
          <Card>
            <CardHeader title="Buy from hospital pharmacy" description="Pick up at the counter or get it delivered." />
            <div className="p-4 sm:p-5">
              {orderable.length ? (
                <>
                  <ul className="space-y-2.5 text-sm">
                    {orderable.map((o) => (
                      <li key={o.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-800">{o.name}</span>
                          <span className="text-xs text-ink-500">
                            {o.qty} × {inr(o.price, { paise: true })}
                            {o.stock < o.remaining && <span className="text-warning-700"> · only {o.stock} in stock</span>}
                          </span>
                        </span>
                        <span className="tabular shrink-0 font-semibold text-ink-800">{inr(o.qty * o.price, { paise: true })}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="text-ink-500">Estimated total</span>
                    <span className="tabular font-display text-lg font-bold text-ink-900">{inr(estimate, { paise: true })}</span>
                  </div>
                  <div className="mt-3">
                    <AddToCart rx={rx.code} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-500">
                  {rx.items.some((i) => i.medicineId) ? "All medicines on this prescription have been supplied." : "These medicines aren't stocked by the hospital pharmacy."}
                </p>
              )}
            </div>
          </Card>
          {rx.carePlan && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700">
                  <Salad className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-ink-900">{rx.carePlan.dietType}</p>
                  <p className="text-sm text-ink-500">Meal-by-meal diet, exercise and lifestyle plan</p>
                </div>
              </div>
              <LinkButton href={`/patient/care-plan?rx=${rx.code}`} variant="secondary" size="sm" block className="mt-3">
                Open diet &amp; lifestyle plan
              </LinkButton>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
