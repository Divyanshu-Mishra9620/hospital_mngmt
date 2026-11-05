"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { and, asc, count, desc, eq, gt, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { AlertTriangle, Boxes, CalendarClock, ExternalLink, IndianRupee, PackageX } from "lucide-react";
import { db } from "@/db";
import { dispenseItems, dispenses, medicineBatches, medicines, patients, pharmacyOrderItems, pharmacyOrders, payments, users } from "@/db/schema";
import { HBarChart } from "@/components/admin/bars";
import { OrderStatusBadge, StockBadge } from "@/components/status";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui/misc";
import { istStart } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDate, fmtDateTime, fmtNumber, inr } from "@/lib/format";
import { addDays, todayISO } from "@/lib/time";

function lakh(n: number) {
  return n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : inr(Math.round(n));
}

async function __render() {
  await requireAdmin();
  const today = todayISO();
  const from30 = istStart(addDays(today, -29));
  const todayStart = istStart(today);
  const in60 = addDays(today, 60);
  const pharmacist = alias(users, "pharmacist");
  const patientUser = alias(users, "patient_user");

  const [
    [retail],
    [cost],
    [{ skus }],
    lowList,
    [{ out }],
    expiring,
    [{ expired }],
    revenue,
    counterTop,
    onlineTop,
    recentBills,
    recentOrders,
  ] = await Promise.all([
    db.select({ v: sql<number>`coalesce(sum(${medicines.stock} * ${medicines.unitPrice}), 0)` }).from(medicines).where(eq(medicines.active, true)),
    db
      .select({ v: sql<number>`coalesce(sum(${medicineBatches.quantity} * ${medicineBatches.costPrice}), 0)` })
      .from(medicineBatches)
      .where(and(gt(medicineBatches.quantity, 0), gt(medicineBatches.expiryDate, today))),
    db.select({ skus: count() }).from(medicines).where(eq(medicines.active, true)),
    db
      .select({ id: medicines.id, name: medicines.name, sku: medicines.sku, stock: medicines.stock, reorderLevel: medicines.reorderLevel, unitLabel: medicines.unitLabel })
      .from(medicines)
      .where(and(eq(medicines.active, true), sql`${medicines.stock} <= ${medicines.reorderLevel}`))
      .orderBy(asc(sql`cast(${medicines.stock} as real) / max(${medicines.reorderLevel}, 1)`))
      .limit(12),
    db.select({ out: count() }).from(medicines).where(and(eq(medicines.active, true), lte(medicines.stock, 0))),
    db
      .select({ id: medicineBatches.id, batchNo: medicineBatches.batchNo, expiryDate: medicineBatches.expiryDate, quantity: medicineBatches.quantity, name: medicines.name, costPrice: medicineBatches.costPrice })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicines.id, medicineBatches.medicineId))
      .where(and(gt(medicineBatches.quantity, 0), gt(medicineBatches.expiryDate, today), lte(medicineBatches.expiryDate, in60)))
      .orderBy(asc(medicineBatches.expiryDate)),
    db
      .select({ expired: count() })
      .from(medicineBatches)
      .where(and(gt(medicineBatches.quantity, 0), lte(medicineBatches.expiryDate, today))),
    db
      .select({
        purpose: payments.purpose,
        today: sql<number>`coalesce(sum(case when ${payments.createdAt} >= ${todayStart} then ${payments.amount} end), 0)`,
        last30: sql<number>`coalesce(sum(${payments.amount}), 0)`,
        n: count(),
      })
      .from(payments)
      .where(and(eq(payments.status, "success"), gte(payments.createdAt, from30), inArray(payments.purpose, ["pharmacy_counter", "pharmacy_order"])))
      .groupBy(payments.purpose),
    db
      .select({ id: dispenseItems.medicineId, name: dispenseItems.name, qty: sql<number>`sum(${dispenseItems.quantity})`, revenue: sql<number>`sum(${dispenseItems.lineTotal})` })
      .from(dispenseItems)
      .innerJoin(dispenses, eq(dispenses.id, dispenseItems.dispenseId))
      .where(gte(dispenses.createdAt, from30))
      .groupBy(dispenseItems.medicineId),
    db
      .select({ id: pharmacyOrderItems.medicineId, name: pharmacyOrderItems.name, qty: sql<number>`sum(${pharmacyOrderItems.quantity})`, revenue: sql<number>`sum(${pharmacyOrderItems.lineTotal})` })
      .from(pharmacyOrderItems)
      .innerJoin(pharmacyOrders, eq(pharmacyOrders.id, pharmacyOrderItems.orderId))
      .where(and(gte(pharmacyOrders.createdAt, from30), ne(pharmacyOrders.status, "cancelled")))
      .groupBy(pharmacyOrderItems.medicineId),
    db
      .select({ d: dispenses, pharmacist: pharmacist.name, patient: patientUser.name, uhid: patients.uhid })
      .from(dispenses)
      .innerJoin(pharmacist, eq(pharmacist.id, dispenses.pharmacistId))
      .leftJoin(patients, eq(patients.id, dispenses.patientId))
      .leftJoin(patientUser, eq(patientUser.id, patients.userId))
      .orderBy(desc(dispenses.createdAt))
      .limit(8),
    db
      .select({ o: pharmacyOrders, patient: patientUser.name, uhid: patients.uhid })
      .from(pharmacyOrders)
      .innerJoin(patients, eq(patients.id, pharmacyOrders.patientId))
      .innerJoin(patientUser, eq(patientUser.id, patients.userId))
      .orderBy(desc(pharmacyOrders.createdAt))
      .limit(8),
  ]);

  const top = new Map<number, { name: string; qty: number; revenue: number }>();
  for (const r of [...counterTop, ...onlineTop]) {
    const cur = top.get(r.id) ?? { name: r.name, qty: 0, revenue: 0 };
    cur.qty += Number(r.qty);
    cur.revenue += Number(r.revenue);
    top.set(r.id, cur);
  }
  const topSellers = [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const rev = { counterToday: 0, counter30: 0, onlineToday: 0, online30: 0, counterN: 0, onlineN: 0 };
  for (const r of revenue) {
    if (r.purpose === "pharmacy_counter") {
      rev.counterToday = Number(r.today);
      rev.counter30 = Number(r.last30);
      rev.counterN = r.n;
    } else {
      rev.onlineToday = Number(r.today);
      rev.online30 = Number(r.last30);
      rev.onlineN = r.n;
    }
  }
  const [{ low }] = await db
    .select({ low: count() })
    .from(medicines)
    .where(and(eq(medicines.active, true), gt(medicines.stock, 0), sql`${medicines.stock} <= ${medicines.reorderLevel}`));
  const expiringValue = expiring.reduce((s, b) => s + b.quantity * b.costPrice, 0);

  return (
    <>
      <PageHeader
        title="Pharmacy overview"
        description="Stock value, alerts and sales across the counter and online orders. Day-to-day operations happen in the pharmacy panel."
        actions={
          <LinkButton href="/pharmacy" size="sm">
            <ExternalLink aria-hidden /> Open pharmacy panel
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Stock value (MRP)" value={lakh(Number(retail.v))} sub={`${lakh(Number(cost.v))} at cost · ${skus} SKUs`} icon={<Boxes />} />
        <StatCard
          label="Sales today"
          value={inr(Math.round(rev.counterToday + rev.onlineToday))}
          sub={`${inr(Math.round(rev.counterToday))} counter · ${inr(Math.round(rev.onlineToday))} online`}
          icon={<IndianRupee />}
          tone="success"
        />
        <StatCard
          label="Sales · 30 days"
          value={lakh(rev.counter30 + rev.online30)}
          sub={`${fmtNumber(rev.counterN)} counter bills · ${fmtNumber(rev.onlineN)} online orders`}
          icon={<IndianRupee />}
          tone="info"
        />
        <StatCard
          label="Stock alerts"
          value={low + out + expiring.length}
          sub={`${low} low · ${out} out · ${expiring.length} expiring ≤ 60 d${expired ? ` · ${expired} expired` : ""}`}
          icon={<AlertTriangle />}
          tone="warning"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Top sellers · last 30 days" description="By revenue, counter + online combined" />
          <div className="p-4 sm:p-5">
            {topSellers.length ? (
              <HBarChart rows={topSellers.map((t) => ({ label: t.name, value: Math.round(t.revenue), sub: `${fmtNumber(t.qty)} units` }))} format={(n) => inr(n)} labelWidth="12rem" />
            ) : (
              <EmptyState title="No sales in the last 30 days" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Low & out of stock" icon={<PackageX />} description="Lowest stock relative to reorder level" />
          {lowList.length ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Medicine</Th>
                  <Th className="text-right">Reorder at</Th>
                  <Th>Stock</Th>
                </tr>
              </thead>
              <tbody>
                {lowList.map((m) => (
                  <tr key={m.id}>
                    <Td>
                      <p className="font-medium text-ink-900">{m.name}</p>
                      <p className="tabular text-xs text-ink-500">
                        {m.sku} · per {m.unitLabel}
                      </p>
                    </Td>
                    <Td className="tabular text-right">{fmtNumber(m.reorderLevel)}</Td>
                    <Td>
                      <StockBadge stock={m.stock} reorderLevel={m.reorderLevel} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState title="All medicines above reorder level" />
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Batches expiring within 60 days"
          icon={<CalendarClock />}
          description={expiring.length ? `${expiring.length} batches · ${inr(Math.round(expiringValue))} at cost` : undefined}
        />
        {expiring.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Medicine</Th>
                <Th>Batch</Th>
                <Th>Expires</Th>
                <Th className="text-right">Units</Th>
                <Th className="text-right">Value at cost</Th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((b) => (
                <tr key={b.id}>
                  <Td className="font-medium text-ink-900">{b.name}</Td>
                  <Td className="tabular">{b.batchNo}</Td>
                  <Td className="whitespace-nowrap text-warning-700">{fmtDate(b.expiryDate)}</Td>
                  <Td className="tabular text-right">{fmtNumber(b.quantity)}</Td>
                  <Td className="tabular text-right">{inr(Math.round(b.quantity * b.costPrice))}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="Nothing expiring in the next 60 days" />
        )}
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Recent counter bills" />
          <ul className="divide-y divide-line">
            {recentBills.map(({ d, pharmacist: ph, patient, uhid }) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="min-w-0">
                  <span className="tabular block font-medium text-ink-900">{d.code}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {uhid ? (
                      <Link href={`/admin/patients/${uhid}`} className="hover:text-brand-700">
                        {patient} · {uhid}
                      </Link>
                    ) : (
                      d.customerName ?? "Walk-in"
                    )}{" "}
                    · by {ph} · {fmtDateTime(d.createdAt)}
                  </span>
                </span>
                <span className="tabular shrink-0 text-right font-semibold text-ink-900">
                  {inr(d.total, { paise: true })}
                  <span className="block text-xs font-normal text-ink-500">{d.paymentMethod.toUpperCase()}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recent online orders" />
          <ul className="divide-y divide-line">
            {recentOrders.map(({ o, patient, uhid }) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="min-w-0">
                  <span className="tabular block font-medium text-ink-900">{o.code}</span>
                  <span className="block truncate text-xs text-ink-500">
                    <Link href={`/admin/patients/${uhid}`} className="hover:text-brand-700">
                      {patient}
                    </Link>{" "}
                    · {o.fulfilment === "delivery" ? "Delivery" : "Pickup"} · {fmtDateTime(o.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular font-semibold text-ink-900">{inr(o.total, { paise: true })}</span>
                  <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

const __loader = () => __render();

export default function PageView() {
  return <ClientPage render={__loader} props={{}} />;
}
