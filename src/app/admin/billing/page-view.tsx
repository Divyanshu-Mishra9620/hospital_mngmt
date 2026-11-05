"use client";

import { ClientPage } from "@/components/client-page";
import { ExportCsvButton } from "@/components/admin/export-csv-button";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { PAYMENT_PURPOSES } from "@/db/schema";
import { HBarChart } from "@/components/admin/bars";
import { FilterBar, FilterDate, FilterSearch, FilterSelect, Pagination, RangePresets } from "@/components/admin/list-tools";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, KeyValue, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui/misc";
import { PURPOSE_LABEL, billingFilters, searchPayments } from "@/lib/admin/billing";
import { pageOf } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDate, fmtDateTime, fmtNumber, inr } from "@/lib/format";
import { addDays } from "@/lib/time";

const PAGE_SIZE = 30;

const METHODS = ["upi", "card", "netbanking", "cash", "insurance"];

async function __render({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = billingFilters(sp);
  const page = pageOf(sp.page);
  const { rows, total, byPurpose, byMethod } = await searchPayments(f.where, page, PAGE_SIZE);
  const collected = byPurpose.reduce((s, r) => s + r.collected, 0);
  const refunded = byPurpose.reduce((s, r) => s + r.refunded, 0);

  return (
    <>
      <PageHeader
        title="Billing & payments"
        description={`${fmtDate(f.from)} – ${fmtDate(f.to)} · consultation fees, pharmacy sales and health check-ups`}
        actions={
          <ExportCsvButton sp={sp} />
        }
      />
      <RangePresets
        base="/admin/billing"
        sp={sp}
        today={f.today}
        presets={[
          { label: "Today", from: f.today },
          { label: "Last 7 days", from: addDays(f.today, -6) },
          { label: "Last 30 days", from: addDays(f.today, -29) },
          { label: "Last 90 days", from: addDays(f.today, -89) },
        ]}
      />
      <FilterBar action="/admin/billing" resetHref="/admin/billing">
        <FilterDate name="from" label="From" defaultValue={f.from} />
        <FilterDate name="to" label="To" defaultValue={f.to} />
        <FilterSelect
          name="purpose"
          label="Purpose"
          defaultValue={f.purpose ?? ""}
          options={[{ value: "", label: "All purposes" }, ...PAYMENT_PURPOSES.map((p) => ({ value: p, label: PURPOSE_LABEL[p] }))]}
        />
        <FilterSelect
          name="method"
          label="Method"
          defaultValue={f.method}
          options={[{ value: "", label: "All methods" }, ...METHODS.map((m) => ({ value: m, label: m.toUpperCase() }))]}
        />
        <FilterSelect
          name="status"
          label="Status"
          defaultValue={f.status ?? ""}
          options={[
            { value: "", label: "All" },
            { value: "success", label: "Paid" },
            { value: "refunded", label: "Refunded" },
          ]}
        />
        <FilterSearch defaultValue={f.q} placeholder="PAY / APT / ORD code, patient or UHID" />
      </FilterBar>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gross billed" value={inr(Math.round(collected + refunded))} sub={`${fmtNumber(total)} transactions`} />
        <StatCard label="Refunded" value={inr(Math.round(refunded))} tone="danger" />
        <StatCard label="Net collected" value={inr(Math.round(collected))} sub="Gross minus refunds" tone="success" />
        <StatCard
          label="Average ticket"
          value={inr(total ? Math.round((collected + refunded) / total) : 0)}
          sub="Across all transactions in range"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Collected by purpose" />
          <CardBody>
            {byPurpose.length ? (
              <HBarChart
                rows={[...byPurpose].sort((a, b) => b.collected - a.collected).map((r) => ({ label: PURPOSE_LABEL[r.purpose], value: Math.round(r.collected), sub: `${r.n} txns` }))}
                format={(n) => inr(n)}
                labelWidth="9.5rem"
              />
            ) : (
              <p className="text-sm text-ink-500">No payments in this range.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Collected by payment method" />
          <CardBody>
            {byMethod.length ? (
              [...byMethod]
                .sort((a, b) => b.collected - a.collected)
                .map((m) => <KeyValue key={m.method} k={m.method.toUpperCase()} v={inr(Math.round(m.collected))} className="border-b border-line last:border-0" />)
            ) : (
              <p className="text-sm text-ink-500">No payments in this range.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        {rows.length === 0 ? (
          <EmptyState icon={<Receipt />} title="No transactions match these filters" />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Payment</Th>
                  <Th>Patient</Th>
                  <Th>For</Th>
                  <Th>Method</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/50">
                    <Td className="whitespace-nowrap">
                      <p className="tabular font-medium text-ink-900">{r.code}</p>
                      <p className="text-xs text-ink-500">{fmtDateTime(r.createdAt)}</p>
                    </Td>
                    <Td>
                      {r.uhid ? (
                        <Link href={`/admin/patients/${r.uhid}`} className="font-medium text-ink-800 hover:text-brand-700">
                          {r.patientName}
                          <span className="tabular block text-xs font-normal text-ink-500">{r.uhid}</span>
                        </Link>
                      ) : (
                        <span className="text-ink-500">Walk-in</span>
                      )}
                    </Td>
                    <Td className="max-w-[18rem]">
                      <p className="truncate text-ink-800">{r.description}</p>
                      <p className="tabular text-xs text-ink-500">
                        {PURPOSE_LABEL[r.purpose]} ·{" "}
                        {r.reference.startsWith("APT-") ? (
                          <Link href={`/admin/appointments/${r.reference}`} className="text-brand-700 hover:underline">
                            {r.reference}
                          </Link>
                        ) : (
                          r.reference
                        )}
                      </p>
                    </Td>
                    <Td>{r.method.toUpperCase()}</Td>
                    <Td>{r.status === "refunded" ? <Badge tone="danger">Refunded</Badge> : <Badge tone="success">Paid</Badge>}</Td>
                    <Td className="tabular text-right font-semibold text-ink-900">{inr(r.amount, { paise: true })}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination base="/admin/billing" sp={sp} page={page} pageSize={PAGE_SIZE} total={total} />
          </>
        )}
      </Card>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
