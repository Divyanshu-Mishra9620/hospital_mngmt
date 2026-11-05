import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { ChevronRight, Package, Store, Truck } from "lucide-react";
import { db } from "@/db";
import { pharmacyOrderItems, pharmacyOrders } from "@/db/schema";
import { OrderStatusBadge } from "@/components/status";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { fmtDateTime, inr } from "@/lib/format";

export const metadata: Metadata = { title: "Medicine orders" };

export default async function OrdersPage() {
  const { patient } = await requirePatient();
  const orders = await db
    .select({ order: pharmacyOrders, items: count(pharmacyOrderItems.id) })
    .from(pharmacyOrders)
    .leftJoin(pharmacyOrderItems, eq(pharmacyOrderItems.orderId, pharmacyOrders.id))
    .where(eq(pharmacyOrders.patientId, patient.id))
    .groupBy(pharmacyOrders.id)
    .orderBy(desc(pharmacyOrders.createdAt));

  return (
    <div>
      <PageHeader title="Medicine orders" description="Online orders from the hospital pharmacy" actions={<LinkButton href="/patient/pharmacy" size="sm" variant="outline">Pharmacy</LinkButton>} />
      {orders.length === 0 ? (
        <Card>
          <EmptyState icon={<Package />} title="No orders yet" description="Order medicines from your prescriptions for pickup or home delivery." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {orders.map(({ order, items }) => (
            <li key={order.id}>
              <Link href={`/patient/orders/${order.code}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-200">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  {order.fulfilment === "delivery" ? <Truck className="size-5" aria-hidden /> : <Store className="size-5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="tabular font-semibold text-ink-900">{order.code}</p>
                    <OrderStatusBadge status={order.status} fulfilment={order.fulfilment} />
                  </div>
                  <p className="text-sm text-ink-500">
                    {items} item{items === 1 ? "" : "s"} · {inr(order.total, { paise: true })} · {fmtDateTime(order.createdAt)}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-ink-300" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
