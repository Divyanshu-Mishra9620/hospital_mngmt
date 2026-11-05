"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { History, Layers, Pencil, SlidersHorizontal, Truck } from "lucide-react";
import { db } from "@/db";
import { medicines } from "@/db/schema";
import { getMedicine } from "@/lib/pharmacy-queries";
import { addDays, todayISO } from "@/lib/time";
import { fmtDate, fmtDateTime, inr, titleCase } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, DescriptionList, EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui/misc";
import { StockBadge } from "@/components/status";
import { ExpiryText, MovementBadge } from "@/components/pharmacy/bits";
import { AdjustBatchForm, EditMedicineForm, ReceiveStockForm } from "@/components/pharmacy/medicine-forms";

type Props = { params: Promise<{ sku: string }>; searchParams: Promise<{ added?: string }> };

async function __render({ params, searchParams }: Props) {
  const [{ sku }, sp] = await Promise.all([params, searchParams]);
  const data = await getMedicine(decodeURIComponent(sku));
  if (!data) notFound();
  const { med, batches, ledger, sold30 } = data;
  const today = todayISO();
  const cats = await db.selectDistinct({ category: medicines.category }).from(medicines).orderBy(asc(medicines.category));
  const live = batches.filter((b) => b.quantity > 0);
  const sellable = live.filter((b) => b.expiryDate > today).reduce((s, b) => s + b.quantity, 0);
  const expiredQty = live.filter((b) => b.expiryDate <= today).reduce((s, b) => s + b.quantity, 0);
  const daysCover = sold30 > 0 ? Math.floor(sellable / (sold30 / 30)) : null;

  return (
    <>
      <PageHeader
        back={{ href: "/pharmacy/inventory", label: "Inventory" }}
        eyebrow={<span className="tabular">{med.sku}</span>}
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {med.name}
            {med.rxRequired ? <Badge tone="danger">Rx only</Badge> : <Badge tone="success">OTC</Badge>}
            {!med.active && <Badge>Inactive</Badge>}
          </span>
        }
        description={`${med.genericName} · ${med.manufacturer} · ${titleCase(med.form)}${med.strength ? ` · ${med.strength}` : ""}`}
      />
      {sp.added === "1" && (
        <Alert tone="success" title="Medicine added" className="mb-5">
          {med.sku} has been created with zero stock. Receive the first batch below.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Sellable stock" value={`${sellable}`} sub={`${med.unitLabel}s · reorder at ${med.reorderLevel}`} tone={sellable <= 0 ? "danger" : sellable <= med.reorderLevel ? "warning" : "success"} />
        <StatCard label="MRP per unit" value={inr(med.unitPrice, { paise: true })} sub={`GST ${med.gstPercent}% incl. · HSN ${med.hsn ?? "—"}`} />
        <StatCard label="Sold last 30 days" value={sold30} sub={daysCover != null ? `≈ ${daysCover} days of cover left` : "No recent sales"} tone="info" />
        <StatCard label="Expired on shelf" value={expiredQty} sub={expiredQty ? "Write off from Stock alerts" : "None"} tone={expiredQty ? "danger" : "brand"} href={expiredQty ? "/pharmacy/alerts" : undefined} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Batches" description="Sold first-expiry-first-out" icon={<Layers />} action={<StockBadge stock={med.stock} reorderLevel={med.reorderLevel} />} />
            {batches.length === 0 ? (
              <EmptyState icon={<Layers />} title="No batches received yet" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Batch</Th>
                    <Th>Expiry</Th>
                    <Th className="text-right">In stock</Th>
                    <Th className="text-right">Received</Th>
                    <Th className="text-right">Cost</Th>
                    <Th>Supplier / invoice</Th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className={b.quantity === 0 ? "text-ink-400" : undefined}>
                      <Td className="tabular font-semibold text-ink-900">{b.batchNo}</Td>
                      <Td>
                        <ExpiryText date={b.expiryDate} />
                      </Td>
                      <Td className="tabular text-right font-semibold">{b.quantity}</Td>
                      <Td className="tabular text-right">
                        {b.receivedQty}
                        <p className="text-xs text-ink-400">{fmtDate(b.receivedAt)}</p>
                      </Td>
                      <Td className="tabular text-right">{inr(b.costPrice, { paise: true })}</Td>
                      <Td>
                        <p className="text-ink-700">{b.supplier ?? "—"}</p>
                        <p className="tabular text-xs text-ink-400">{b.invoiceNo ?? ""}</p>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardHeader title="Stock ledger" description="Every unit in and out, newest first" icon={<History />} />
            {ledger.length === 0 ? (
              <EmptyState title="No stock movements yet" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Type</Th>
                    <Th>Reference</Th>
                    <Th>Batch</Th>
                    <Th className="text-right">Change</Th>
                    <Th className="text-right">Balance</Th>
                    <Th>By</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(({ mv, batchNo, user }) => (
                    <tr key={mv.id}>
                      <Td className="whitespace-nowrap text-ink-600">{fmtDateTime(mv.createdAt)}</Td>
                      <Td>
                        <MovementBadge type={mv.type} />
                      </Td>
                      <Td>
                        <RefLink reference={mv.reference} />
                        {mv.note && <p className="max-w-[16rem] truncate text-xs text-ink-400" title={mv.note}>{mv.note}</p>}
                      </Td>
                      <Td className="tabular text-ink-600">{batchNo ?? "—"}</Td>
                      <Td className={`tabular text-right font-semibold ${mv.quantity > 0 ? "text-success-700" : "text-danger-700"}`}>
                        {mv.quantity > 0 ? "+" : ""}
                        {mv.quantity}
                      </Td>
                      <Td className="tabular text-right">{mv.balanceAfter}</Td>
                      <Td className="text-ink-600">{user ?? "System"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Receive stock" description="Goods receipt against a supplier invoice" icon={<Truck />} />
            <CardBody>
              <ReceiveStockForm medicineId={med.id} unitPrice={med.unitPrice} minExpiry={addDays(today, 1)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Adjust a batch" description="Count corrections, damage, expiry write-off or returns" icon={<SlidersHorizontal />} />
            <CardBody>
              {live.length ? (
                <AdjustBatchForm batches={live.map((b) => ({ id: b.id, batchNo: b.batchNo, quantity: b.quantity, expiryDate: b.expiryDate }))} />
              ) : (
                <p className="text-sm text-ink-500">No batch with stock to adjust.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Details" icon={<Pencil />} />
            <CardBody className="space-y-5">
              <DescriptionList
                items={[
                  { label: "Generic", value: med.genericName },
                  { label: "Manufacturer", value: med.manufacturer },
                  { label: "Form / strength", value: `${titleCase(med.form)}${med.strength ? ` · ${med.strength}` : ""}` },
                  { label: "Selling unit", value: med.unitLabel },
                ]}
              />
              <EditMedicineForm
                med={{
                  id: med.id,
                  unitPrice: med.unitPrice,
                  reorderLevel: med.reorderLevel,
                  rack: med.rack,
                  category: med.category,
                  gstPercent: med.gstPercent,
                  rxRequired: med.rxRequired,
                  active: med.active,
                }}
                categories={cats.map((c) => c.category)}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function RefLink({ reference }: { reference: string | null }) {
  if (!reference) return <span className="text-ink-400">—</span>;
  if (reference.startsWith("DSP-"))
    return (
      <Link href={`/pharmacy/sales/${reference}`} className="tabular font-medium text-brand-700 hover:underline">
        {reference}
      </Link>
    );
  if (reference.startsWith("ORD-"))
    return (
      <Link href={`/pharmacy/orders/${reference}`} className="tabular font-medium text-brand-700 hover:underline">
        {reference}
      </Link>
    );
  return <span className="tabular text-ink-700">{reference}</span>;
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
