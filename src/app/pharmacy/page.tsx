import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, IndianRupee, Package, PackageX, Plus, ReceiptText, Search, ShoppingBag, TrendingUp } from "lucide-react";
import { requirePharmacist } from "@/lib/auth/session";
import { getDashboard } from "@/lib/pharmacy-queries";
import { fmtDateTime, fmtLongDate, fmtNumber, inr, timeAgo } from "@/lib/format";
import { todayISO } from "@/lib/time";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui/misc";
import { PaymentMethodBadge } from "@/components/pharmacy/bits";

export const metadata: Metadata = { title: "Dashboard" };

export default async function PharmacyDashboard() {
  const user = await requirePharmacist();
  const d = await getDashboard();
  const maxRevenue = Math.max(1, ...d.top.map((t) => t.revenue));

  return (
    <>
      <PageHeader
        eyebrow={fmtLongDate(todayISO())}
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description="Hospital pharmacy · counter sales, online orders and stock at a glance."
        actions={
          <>
            <LinkButton href="/pharmacy/inventory" variant="outline" size="sm">
              <Search aria-hidden /> Find medicine
            </LinkButton>
            <LinkButton href="/pharmacy/dispense" size="sm">
              <Plus aria-hidden /> New dispense
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Counter sales today"
          value={inr(d.todaySales)}
          sub={`${fmtNumber(d.todayBills)} bill${d.todayBills === 1 ? "" : "s"} raised`}
          icon={<IndianRupee />}
          tone="success"
          href="/pharmacy/sales"
        />
        <StatCard
          label="Online orders pending"
          value={d.pendingOrders}
          sub={`${d.orders.placed ?? 0} new · ${d.orders.processing ?? 0} packing · ${(d.orders.ready ?? 0) + (d.orders.out_for_delivery ?? 0)} ready/out`}
          icon={<Package />}
          tone="info"
          href="/pharmacy/orders"
        />
        <StatCard
          label="Low / out of stock"
          value={`${d.lowStock} / ${d.outOfStock}`}
          sub="At or below reorder level"
          icon={<PackageX />}
          tone={d.outOfStock ? "danger" : "warning"}
          href="/pharmacy/alerts"
        />
        <StatCard label="Batches expiring ≤ 60 days" value={d.expiringSoon} sub="Move to front shelf or return" icon={<CalendarClock />} tone="warning" href="/pharmacy/alerts" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Recent bills"
            description="Latest counter sales across all pharmacists"
            icon={<ReceiptText />}
            action={
              <LinkButton href="/pharmacy/sales" variant="ghost" size="xs">
                View all
              </LinkButton>
            }
          />
          {d.recent.length === 0 ? (
            <EmptyState icon={<ReceiptText />} title="No bills yet today" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Bill</Th>
                  <Th>Customer</Th>
                  <Th>Against</Th>
                  <Th>Payment</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((b) => (
                  <tr key={b.id} className="hover:bg-surface/60">
                    <Td>
                      <Link href={`/pharmacy/sales/${b.code}`} className="tabular font-semibold text-brand-700 hover:underline">
                        {b.code}
                      </Link>
                      <p className="text-xs text-ink-500" title={fmtDateTime(b.createdAt)}>
                        {timeAgo(b.createdAt)} · {b.pharmacist}
                      </p>
                    </Td>
                    <Td>
                      <p className="font-medium text-ink-800">{b.name}</p>
                      {b.uhid && <p className="tabular text-xs text-ink-500">{b.uhid}</p>}
                    </Td>
                    <Td>{b.rxCode ? <span className="tabular text-sm">{b.rxCode}</span> : <Badge tone="neutral">OTC</Badge>}</Td>
                    <Td>
                      <PaymentMethodBadge method={b.paymentMethod} />
                    </Td>
                    <Td className="tabular text-right font-semibold text-ink-900">{inr(b.total, { paise: true })}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Top sellers · last 7 days" description="By sales value, counter + online" icon={<TrendingUp />} />
            <CardBody>
              {d.top.length === 0 ? (
                <p className="text-sm text-ink-500">No sales recorded this week.</p>
              ) : (
                <ol className="space-y-3.5">
                  {d.top.map((t, i) => (
                    <li key={t.medicineId}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <Link href={`/pharmacy/inventory/${t.sku}`} className="min-w-0 truncate font-medium text-ink-800 hover:text-brand-700">
                          <span className="mr-1.5 text-ink-400">{i + 1}.</span>
                          {t.name}
                        </Link>
                        <span className="tabular shrink-0 font-semibold text-ink-900">{inr(t.revenue)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, (t.revenue / maxRevenue) * 100)}%` }} />
                        </div>
                        <span className="tabular w-16 shrink-0 text-right text-xs text-ink-500">{fmtNumber(t.units)} units</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Quick actions" icon={<ShoppingBag />} />
            <CardBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <QuickLink href="/pharmacy/dispense" title="Dispense prescription" text="Scan Rx code or search UHID" />
              <QuickLink href="/pharmacy/dispense?mode=otc" title="Walk-in OTC sale" text="Non-prescription items" />
              <QuickLink href="/pharmacy/orders?status=placed" title="Process new orders" text={`${d.orders.placed ?? 0} waiting to be packed`} />
              <QuickLink href="/pharmacy/alerts" title="Review stock alerts" text={`${d.lowStock + d.outOfStock} items need reordering`} warn={d.outOfStock > 0} />
            </CardBody>
          </Card>

          {d.todayOrders > 0 && (
            <p className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-600">
              <AlertTriangle className="size-4 text-info-600" aria-hidden />
              {d.todayOrders} online order{d.todayOrders === 1 ? "" : "s"} today worth <span className="font-semibold text-ink-900">{inr(d.todayOrderSales)}</span>
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function QuickLink({ href, title, text, warn }: { href: string; title: string; text: string; warn?: boolean }) {
  return (
    <Link href={href} className="group rounded-xl border border-line px-3.5 py-3 transition hover:border-brand-300 hover:bg-brand-50/40">
      <p className="text-sm font-semibold text-ink-900 group-hover:text-brand-800">{title} →</p>
      <p className={warn ? "text-xs text-danger-700" : "text-xs text-ink-500"}>{text}</p>
    </Link>
  );
}
