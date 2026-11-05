"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Clock, FileText, ShieldCheck, Truck } from "lucide-react";
import { db } from "@/db";
import { medicines, prescriptionItems } from "@/db/schema";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { HOSPITAL } from "@/lib/constants";
import { fmtDate, inr } from "@/lib/format";
import { suppliedQuantities } from "@/lib/pharmacy";
import { listPrescriptions } from "@/lib/queries/prescriptions";
import { getSettings } from "@/lib/settings";
import { AddToCart } from "../prescriptions/[code]/add-to-cart";
import { OtcCatalog } from "./otc-catalog";

async function __render({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const { patient } = await requirePatient();
  const sp = await searchParams;
  const settings = await getSettings();

  // Prescriptions with medicines still to buy
  const rxList = await listPrescriptions({ patientId: patient.id, limit: 20 });
  const ids = rxList.map((r) => r.id);
  const items = ids.length ? await db.select().from(prescriptionItems).where(inArray(prescriptionItems.prescriptionId, ids)) : [];
  const supplied = await suppliedQuantities(items.map((i) => i.id));
  const pending = rxList
    .map((rx) => {
      const its = items.filter((i) => i.prescriptionId === rx.id && i.medicineId && i.quantity - (supplied.get(i.id) ?? 0) > 0);
      return { rx, its };
    })
    .filter((x) => x.its.length)
    .slice(0, 4);

  const otc = await db
    .select()
    .from(medicines)
    .where(and(eq(medicines.rxRequired, false), eq(medicines.active, true)))
    .orderBy(asc(medicines.category), asc(medicines.name));

  return (
    <div className="space-y-6">
      <PageHeader title="Hospital pharmacy" description={`Genuine medicines from Medora's in-house pharmacy · ${HOSPITAL.pharmacyHours}`} />

      <div className="grid grid-cols-3 gap-2 text-center text-xs sm:gap-3 sm:text-sm">
        {[
          { icon: ShieldCheck, text: "100% genuine, batch-tracked" },
          { icon: Truck, text: `Free delivery over ${inr(Number(settings.freeDeliveryAbove))}` },
          { icon: Clock, text: "Ready for pickup in 30 min" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white px-2 py-3 shadow-card">
            <Icon className="size-5 text-brand-600" aria-hidden />
            <span className="font-medium leading-tight text-ink-700">{text}</span>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold">From your prescriptions</h2>
        {pending.length === 0 ? (
          <Card>
            <EmptyState icon={<FileText />} title="Nothing pending" description="When a doctor prescribes medicines stocked at our pharmacy, you can order them here in one tap." />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map(({ rx, its }) => (
              <Card key={rx.id}>
                <CardHeader
                  icon={<FileText />}
                  title={rx.diagnosis}
                  description={`${rx.doctorName} · ${fmtDate(rx.createdAt)}`}
                  action={
                    <Link href={`/patient/prescriptions/${rx.code}`} className="text-sm font-semibold text-brand-700">
                      View
                    </Link>
                  }
                />
                <div className="p-4 sm:p-5">
                  <ul className="mb-4 space-y-1 text-sm text-ink-700">
                    {its.map((i) => (
                      <li key={i.id} className="flex justify-between gap-2">
                        <span className="truncate">{i.medicineName}</span>
                        <span className="tabular shrink-0 text-ink-500">× {i.quantity - (supplied.get(i.id) ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                  <AddToCart rx={rx.code} label="Add prescription to cart" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Health essentials</h2>
            <p className="text-sm text-ink-500">Over-the-counter products. Prescription medicines are sold only against a valid prescription.</p>
          </div>
        </div>
        <OtcCatalog
          items={otc.map((m) => ({ id: m.id, name: m.name, genericName: m.genericName, category: m.category, unitPrice: m.unitPrice, unitLabel: m.unitLabel, stock: m.stock }))}
          initial={{ q: sp.q ?? "", cat: sp.cat ?? "" }}
        />
      </section>
    </div>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
