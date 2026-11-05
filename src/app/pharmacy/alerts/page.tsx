import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, PackageX, Trash2, TrendingDown } from "lucide-react";
import { stockAlerts } from "@/lib/pharmacy-queries";
import { writeOffBatchAction } from "@/lib/actions/pharmacy";
import { inr } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui/misc";
import { ExpiryText } from "@/components/pharmacy/bits";

export const metadata: Metadata = { title: "Stock alerts" };

export default async function AlertsPage() {
  const { low, out, expiring, expired } = await stockAlerts();
  const expiredValue = expired.reduce((s, e) => s + e.batch.quantity * e.batch.costPrice, 0);
  const expiringValue = expiring.reduce((s, e) => s + e.batch.quantity * e.unitPrice, 0);

  return (
    <>
      <PageHeader title="Stock alerts" description="What needs reordering, rotating to the front shelf, returning or writing off." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Out of stock" value={out.length} icon={<PackageX />} tone="danger" />
        <StatCard label="Low stock" value={low.length} sub="At or below reorder level" icon={<TrendingDown />} tone="warning" />
        <StatCard label="Expiring ≤ 90 days" value={expiring.length} sub={`${inr(expiringValue)} at MRP`} icon={<CalendarClock />} tone="accent" />
        <StatCard label="Expired on shelf" value={expired.length} sub={expired.length ? `${inr(expiredValue)} at cost` : "None — good"} icon={<AlertTriangle />} tone={expired.length ? "danger" : "success"} />
      </div>

      <div className="mt-5 space-y-5">
        {expired.length > 0 && (
          <Card className="border-danger-100">
            <CardHeader title="Expired batches still in stock" description="Move to the quarantine shelf and write off. These can't be sold." icon={<AlertTriangle />} />
            <TableWrap>
              <thead>
                <tr>
                  <Th>Medicine</Th>
                  <Th>Batch</Th>
                  <Th>Expired on</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Cost value</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {expired.map((e) => (
                  <tr key={e.batch.id}>
                    <Td>
                      <MedLink sku={e.sku} name={e.name} />
                    </Td>
                    <Td className="tabular">{e.batch.batchNo}</Td>
                    <Td>
                      <ExpiryText date={e.batch.expiryDate} compact />
                    </Td>
                    <Td className="tabular text-right font-semibold">{e.batch.quantity}</Td>
                    <Td className="tabular text-right">{inr(e.batch.quantity * e.batch.costPrice, { paise: true })}</Td>
                    <Td className="text-right">
                      <form action={writeOffBatchAction}>
                        <input type="hidden" name="batchId" value={e.batch.id} />
                        <Button type="submit" variant="danger" size="xs">
                          <Trash2 aria-hidden /> Write off
                        </Button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Out of stock" description="Raise a purchase order with the supplier" icon={<PackageX />} />
            {out.length === 0 ? (
              <EmptyState title="Nothing is out of stock" />
            ) : (
              <ul className="divide-y divide-line">
                {out.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <MedLink sku={m.sku} name={m.name} />
                      <p className="text-xs text-ink-500">
                        <span className="tabular">{m.sku}</span> · {m.category} · reorder at {m.reorderLevel}
                      </p>
                    </div>
                    <LinkButton href={`/pharmacy/inventory/${m.sku}`} size="xs" variant="secondary">
                      Receive stock
                    </LinkButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Low stock" description="Lowest cover first" icon={<TrendingDown />} />
            {low.length === 0 ? (
              <EmptyState title="All items above reorder level" />
            ) : (
              <ul className="divide-y divide-line">
                {low.map((m) => {
                  const pct = Math.min(100, Math.round((m.stock / Math.max(1, m.reorderLevel)) * 100));
                  return (
                    <li key={m.id} className="px-4 py-3 sm:px-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <MedLink sku={m.sku} name={m.name} />
                        <span className="tabular shrink-0 text-sm font-semibold text-warning-700">
                          {m.stock} / {m.reorderLevel}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                        <div className="h-full rounded-full bg-warning-600" style={{ width: `${Math.max(3, pct)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Expiring within 90 days" description="Sell first (FEFO is automatic), or return to supplier before the return window closes" icon={<CalendarClock />} />
          {expiring.length === 0 ? (
            <EmptyState title="No batches expiring in the next 90 days" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Medicine</Th>
                  <Th>Batch</Th>
                  <Th>Expiry</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">MRP value</Th>
                  <Th>Supplier</Th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((e) => (
                  <tr key={e.batch.id}>
                    <Td>
                      <MedLink sku={e.sku} name={e.name} />
                    </Td>
                    <Td className="tabular">{e.batch.batchNo}</Td>
                    <Td>
                      <ExpiryText date={e.batch.expiryDate} />
                    </Td>
                    <Td className="tabular text-right font-semibold">{e.batch.quantity}</Td>
                    <Td className="tabular text-right">{inr(e.batch.quantity * e.unitPrice, { paise: true })}</Td>
                    <Td className="text-ink-600">{e.batch.supplier ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}

function MedLink({ sku, name }: { sku: string; name: string }) {
  return (
    <Link href={`/pharmacy/inventory/${sku}`} className="font-semibold text-ink-900 hover:text-brand-700">
      {name}
    </Link>
  );
}
