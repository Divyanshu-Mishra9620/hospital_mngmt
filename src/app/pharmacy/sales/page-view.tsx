"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { Plus, ReceiptText, Search } from "lucide-react";
import { recentBills, salesSummary } from "@/lib/pharmacy-queries";
import { addDays, isValidDate, todayISO } from "@/lib/time";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui/misc";
import { PaymentMethodBadge, paymentMethodLabel } from "@/components/pharmacy/bits";

type SP = { from?: string; to?: string; q?: string; method?: string };

async function __render({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = todayISO();
  let from = isValidDate(sp.from) ? sp.from : addDays(today, -6);
  let to = isValidDate(sp.to) ? sp.to : today;
  if (from > to) [from, to] = [to, from];
  const method = ["cash", "upi", "card", "insurance"].includes(sp.method ?? "") ? sp.method : undefined;
  const q = sp.q?.trim() || undefined;

  const [bills, summary] = await Promise.all([recentBills(250, { from, to, q, method }), salesSummary(from, to)]);
  const shownTotal = bills.reduce((s, b) => s + b.total, 0);

  return (
    <>
      <PageHeader
        title="Sales & bills"
        description={`Counter bills from ${fmtDate(from)} to ${fmtDate(to)}`}
        actions={
          <LinkButton href="/pharmacy/dispense" size="sm">
            <Plus aria-hidden /> New dispense
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Counter sales" value={inr(summary.counterTotal)} sub={`${summary.counterBills} bills`} tone="success" />
        <StatCard label="Online orders" value={inr(summary.onlineTotal)} sub={`${summary.onlineOrders} orders (excl. cancelled)`} tone="info" />
        <StatCard label="Combined pharmacy revenue" value={inr(summary.counterTotal + summary.onlineTotal)} tone="brand" />
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
          <p className="text-[0.8125rem] font-medium text-ink-500">Counter by payment mode</p>
          <ul className="mt-2 space-y-1 text-sm">
            {summary.methods.length === 0 && <li className="text-ink-400">No sales</li>}
            {summary.methods
              .sort((a, b) => b.total - a.total)
              .map((m) => (
                <li key={m.method} className="flex justify-between gap-2">
                  <span className="text-ink-600">
                    {paymentMethodLabel(m.method)} <span className="text-xs text-ink-400">({m.n})</span>
                  </span>
                  <span className="tabular font-semibold text-ink-900">{inr(m.total)}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <Card className="mt-5">
        <form className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_1fr_2fr_auto] lg:items-end">
          <Field label="From" htmlFor="from">
            <Input id="from" name="from" type="date" defaultValue={from} max={today} />
          </Field>
          <Field label="To" htmlFor="to">
            <Input id="to" name="to" type="date" defaultValue={to} max={today} />
          </Field>
          <Field label="Payment" htmlFor="method">
            <Select id="method" name="method" defaultValue={method ?? ""}>
              <option value="">All modes</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="insurance">Insurance</option>
            </Select>
          </Field>
          <Field label="Search" htmlFor="q">
            <Input id="q" name="q" defaultValue={q} placeholder="Bill no., Rx code, UHID, customer" />
          </Field>
          <Button type="submit" variant="secondary">
            <Search aria-hidden /> Apply
          </Button>
        </form>
        <CardHeader
          className="border-b-0"
          title={`${bills.length}${bills.length === 250 ? "+" : ""} bill${bills.length === 1 ? "" : "s"}`}
          description={`Total shown ${inr(shownTotal, { paise: true })}`}
          icon={<ReceiptText />}
        />
        {bills.length === 0 ? (
          <EmptyState icon={<ReceiptText />} title="No bills match these filters" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Bill no.</Th>
                <Th>Date & time</Th>
                <Th>Customer</Th>
                <Th>Against</Th>
                <Th className="text-right">Items</Th>
                <Th>Payment</Th>
                <Th>Pharmacist</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="hover:bg-surface/60">
                  <Td>
                    <Link href={`/pharmacy/sales/${b.code}`} className="tabular font-semibold text-brand-700 hover:underline">
                      {b.code}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-600">{fmtDateTime(b.createdAt)}</Td>
                  <Td>
                    <p className="font-medium text-ink-800">{b.name}</p>
                    {b.uhid && <p className="tabular text-xs text-ink-500">{b.uhid}</p>}
                  </Td>
                  <Td>{b.rxCode ? <span className="tabular">{b.rxCode}</span> : <Badge>OTC</Badge>}</Td>
                  <Td className="tabular text-right">{b.items}</Td>
                  <Td>
                    <PaymentMethodBadge method={b.paymentMethod} />
                  </Td>
                  <Td className="text-ink-600">{b.pharmacist}</Td>
                  <Td className="tabular text-right font-semibold text-ink-900">{inr(b.total, { paise: true })}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
