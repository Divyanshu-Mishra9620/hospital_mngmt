import type { Metadata } from "next";
import Link from "next/link";
import { Bike, Package, Search, Store } from "lucide-react";
import { listOrders, orderCounts } from "@/lib/pharmacy-queries";
import { ORDER_STATUSES, type OrderStatus } from "@/db/schema";
import { fmtDateTime, inr, timeAgo } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { EmptyState, PageHeader, TableWrap, Tabs, Td, Th } from "@/components/ui/misc";
import { OrderStatusBadge } from "@/components/status";

export const metadata: Metadata = { title: "Online orders" };

const TAB_LABEL: Record<OrderStatus | "all", string> = {
  placed: "New",
  processing: "Packing",
  ready: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
  all: "All",
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const counts = await orderCounts();
  const defaultTab: OrderStatus = (counts.placed ?? 0) > 0 ? "placed" : (counts.processing ?? 0) > 0 ? "processing" : "ready";
  const status = ([...ORDER_STATUSES, "all"] as string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus | "all") : defaultTab;
  const q = sp.q?.trim() || undefined;
  const orders = await listOrders(status, q);
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <>
      <PageHeader title="Online orders" description="Medicines ordered by patients from the app — pack, hand over or dispatch." />
      <Tabs
        active={status}
        className="mb-4"
        tabs={[...ORDER_STATUSES, "all" as const].map((s) => ({
          key: s,
          href: `/pharmacy/orders?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
          label: TAB_LABEL[s],
          count: s === "all" ? total : (counts[s] ?? 0),
        }))}
      />
      <Card>
        <form className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:p-5">
          <input type="hidden" name="status" value={status} />
          <Input name="q" defaultValue={q} placeholder="Search order no., patient name or UHID" className="sm:max-w-md" aria-label="Search orders" />
          <Button type="submit" variant="secondary">
            <Search aria-hidden /> Search
          </Button>
        </form>
        {orders.length === 0 ? (
          <EmptyState icon={<Package />} title={`No ${TAB_LABEL[status].toLowerCase()} orders`} description={q ? "Try a different search." : "New orders from the patient app will appear here."} />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Patient</Th>
                <Th>Fulfilment</Th>
                <Th className="text-right">Items</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-surface/60">
                  <Td>
                    <Link href={`/pharmacy/orders/${o.code}`} className="tabular font-semibold text-brand-700 hover:underline">
                      {o.code}
                    </Link>
                    <p className="text-xs text-ink-500" title={fmtDateTime(o.createdAt)}>
                      Placed {timeAgo(o.createdAt)}
                    </p>
                  </Td>
                  <Td>
                    <p className="font-medium text-ink-800">{o.patientName}</p>
                    <p className="tabular text-xs text-ink-500">
                      {o.uhid} · {o.phone}
                    </p>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink-700">
                      {o.fulfilment === "delivery" ? <Bike className="size-4 text-violet-700" aria-hidden /> : <Store className="size-4 text-brand-600" aria-hidden />}
                      {o.fulfilment === "delivery" ? "Home delivery" : "Counter pickup"}
                    </span>
                  </Td>
                  <Td className="tabular text-right">{o.items}</Td>
                  <Td className="tabular text-right font-semibold text-ink-900">
                    {inr(o.total, { paise: true })}
                    {o.paymentStatus === "refunded" && <p className="text-xs font-medium text-danger-700">Refunded</p>}
                  </Td>
                  <Td>
                    <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} />
                  </Td>
                  <Td className="text-right">
                    <Link href={`/pharmacy/orders/${o.code}`} className="text-sm font-semibold text-brand-700 hover:underline">
                      {o.status === "placed" ? "Start packing →" : "Open →"}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
