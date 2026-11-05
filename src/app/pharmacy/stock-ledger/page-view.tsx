"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { ScrollText, Search } from "lucide-react";
import { stockLedger } from "@/lib/pharmacy-queries";
import { addDays, isValidDate, todayISO } from "@/lib/time";
import { fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui/misc";
import { MOVEMENT_TYPES, MovementBadge } from "@/components/pharmacy/bits";

type SP = { from?: string; to?: string; type?: string; q?: string };

async function __render({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = todayISO();
  let from = isValidDate(sp.from) ? sp.from : addDays(today, -6);
  let to = isValidDate(sp.to) ? sp.to : today;
  if (from > to) [from, to] = [to, from];
  const type = MOVEMENT_TYPES.some((t) => t.value === sp.type) ? sp.type : undefined;
  const q = sp.q?.trim() || undefined;
  const { rows, inQty, outQty, count } = await stockLedger({ from, to, type, q });

  return (
    <>
      <PageHeader title="Stock ledger" description={`Every stock movement from ${fmtDate(from)} to ${fmtDate(to)} — purchases, sales, orders, adjustments and write-offs.`} />
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Movements" value={fmtNumber(count)} />
        <StatCard label="Units in" value={`+${fmtNumber(inQty)}`} tone="success" />
        <StatCard label="Units out" value={`−${fmtNumber(outQty)}`} tone="danger" />
      </div>
      <Card className="mt-5">
        <form className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_1.2fr_2fr_auto] lg:items-end">
          <Field label="From" htmlFor="from">
            <Input id="from" name="from" type="date" defaultValue={from} max={today} />
          </Field>
          <Field label="To" htmlFor="to">
            <Input id="to" name="to" type="date" defaultValue={to} max={today} />
          </Field>
          <Field label="Movement" htmlFor="type">
            <Select id="type" name="type" defaultValue={type ?? ""}>
              <option value="">All types</option>
              {MOVEMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search" htmlFor="q">
            <Input id="q" name="q" defaultValue={q} placeholder="Medicine, SKU, batch, bill / order no." />
          </Field>
          <Button type="submit" variant="secondary">
            <Search aria-hidden /> Apply
          </Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={<ScrollText />} title="No movements in this period" />
        ) : (
          <>
            {count > rows.length && <p className="px-4 py-2.5 text-sm text-ink-500 sm:px-5">Showing the latest {rows.length} of {fmtNumber(count)} movements. Narrow the filters to see more.</p>}
            <TableWrap>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Medicine</Th>
                  <Th>Type</Th>
                  <Th>Reference</Th>
                  <Th>Batch</Th>
                  <Th className="text-right">Change</Th>
                  <Th className="text-right">Balance</Th>
                  <Th>By</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ mv, name, sku, batchNo, user }) => (
                  <tr key={mv.id} className="hover:bg-surface/60">
                    <Td className="whitespace-nowrap text-ink-600">{fmtDateTime(mv.createdAt)}</Td>
                    <Td>
                      <Link href={`/pharmacy/inventory/${sku}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {name}
                      </Link>
                      <p className="tabular text-xs text-ink-400">{sku}</p>
                    </Td>
                    <Td>
                      <MovementBadge type={mv.type} />
                    </Td>
                    <Td>
                      <Ref reference={mv.reference} />
                      {mv.note && (
                        <p className="max-w-[16rem] truncate text-xs text-ink-400" title={mv.note}>
                          {mv.note}
                        </p>
                      )}
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
          </>
        )}
      </Card>
    </>
  );
}

function Ref({ reference }: { reference: string | null }) {
  if (!reference) return <span className="text-ink-400">—</span>;
  const href = reference.startsWith("DSP-") ? `/pharmacy/sales/${reference}` : reference.startsWith("ORD-") ? `/pharmacy/orders/${reference}` : null;
  return href ? (
    <Link href={href} className="tabular font-medium text-brand-700 hover:underline">
      {reference}
    </Link>
  ) : (
    <span className="tabular text-ink-700">{reference}</span>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
