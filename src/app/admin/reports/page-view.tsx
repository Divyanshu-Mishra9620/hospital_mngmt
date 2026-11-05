"use client";

import { ClientPage } from "@/components/client-page";
import { and, count, desc, eq, gte, lt, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { appointments, departments, dispenseItems, dispenses, doctors, patients, payments, pharmacyOrderItems, pharmacyOrders, prescriptions, users } from "@/db/schema";
import { HBarChart } from "@/components/admin/bars";
import { FilterBar, FilterDate, RangePresets } from "@/components/admin/list-tools";
import { PrintButton } from "@/components/print-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui/misc";
import { PURPOSE_LABEL } from "@/lib/admin/billing";
import { istRange, readRange } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { HOSPITAL } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtNumber, inr } from "@/lib/format";
import { addDays } from "@/lib/time";

async function __render({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const { from, to, today } = readRange(sp, 30);
  const [start, end] = istRange(from, to);
  const docUser = alias(users, "doc_user");
  const apptRange = and(gte(appointments.date, from), lte(appointments.date, to), ne(appointments.status, "cancelled"))!;

  const [byDept, byDoctor, revenue, diagnoses, counterTop, onlineTop, [{ newPatients }], [{ cancelled }]] = await Promise.all([
    db
      .select({
        name: departments.name,
        total: count(),
        inPerson: sql<number>`sum(case when ${appointments.mode} = 'in_person' then 1 else 0 end)`,
        video: sql<number>`sum(case when ${appointments.mode} = 'video' then 1 else 0 end)`,
        completed: sql<number>`sum(case when ${appointments.status} = 'completed' then 1 else 0 end)`,
        fees: sql<number>`coalesce(sum(case when ${appointments.paymentStatus} = 'paid' then ${appointments.fee} end), 0)`,
      })
      .from(appointments)
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .innerJoin(departments, eq(departments.id, doctors.departmentId))
      .where(apptRange)
      .groupBy(departments.id)
      .orderBy(desc(count())),
    db
      .select({
        name: docUser.name,
        code: doctors.code,
        dept: departments.name,
        total: count(),
        video: sql<number>`sum(case when ${appointments.mode} = 'video' then 1 else 0 end)`,
        completed: sql<number>`sum(case when ${appointments.status} = 'completed' then 1 else 0 end)`,
        noShow: sql<number>`sum(case when ${appointments.status} = 'no_show' then 1 else 0 end)`,
        fees: sql<number>`coalesce(sum(case when ${appointments.paymentStatus} = 'paid' then ${appointments.fee} end), 0)`,
      })
      .from(appointments)
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .innerJoin(docUser, eq(docUser.id, doctors.userId))
      .innerJoin(departments, eq(departments.id, doctors.departmentId))
      .where(apptRange)
      .groupBy(doctors.id)
      .orderBy(desc(count())),
    db
      .select({
        purpose: payments.purpose,
        collected: sql<number>`coalesce(sum(case when ${payments.status} = 'success' then ${payments.amount} end), 0)`,
        refunded: sql<number>`coalesce(sum(case when ${payments.status} = 'refunded' then ${payments.amount} end), 0)`,
        n: count(),
      })
      .from(payments)
      .where(and(gte(payments.createdAt, start), lt(payments.createdAt, end)))
      .groupBy(payments.purpose),
    db
      .select({ diagnosis: prescriptions.diagnosis, n: count() })
      .from(prescriptions)
      .where(and(gte(prescriptions.createdAt, start), lt(prescriptions.createdAt, end)))
      .groupBy(prescriptions.diagnosis)
      .orderBy(desc(count()))
      .limit(10),
    db
      .select({ id: dispenseItems.medicineId, name: dispenseItems.name, qty: sql<number>`sum(${dispenseItems.quantity})`, revenue: sql<number>`sum(${dispenseItems.lineTotal})` })
      .from(dispenseItems)
      .innerJoin(dispenses, eq(dispenses.id, dispenseItems.dispenseId))
      .where(and(gte(dispenses.createdAt, start), lt(dispenses.createdAt, end)))
      .groupBy(dispenseItems.medicineId),
    db
      .select({ id: pharmacyOrderItems.medicineId, name: pharmacyOrderItems.name, qty: sql<number>`sum(${pharmacyOrderItems.quantity})`, revenue: sql<number>`sum(${pharmacyOrderItems.lineTotal})` })
      .from(pharmacyOrderItems)
      .innerJoin(pharmacyOrders, eq(pharmacyOrders.id, pharmacyOrderItems.orderId))
      .where(and(gte(pharmacyOrders.createdAt, start), lt(pharmacyOrders.createdAt, end), ne(pharmacyOrders.status, "cancelled")))
      .groupBy(pharmacyOrderItems.medicineId),
    db.select({ newPatients: count() }).from(patients).where(and(gte(patients.createdAt, start), lt(patients.createdAt, end))),
    db
      .select({ cancelled: count() })
      .from(appointments)
      .where(and(gte(appointments.date, from), lte(appointments.date, to), eq(appointments.status, "cancelled"))),
  ]);

  const consults = byDept.reduce((s, d) => s + d.total, 0);
  const video = byDept.reduce((s, d) => s + Number(d.video), 0);
  const completed = byDept.reduce((s, d) => s + Number(d.completed), 0);
  const collected = revenue.reduce((s, r) => s + Number(r.collected), 0);
  const top = new Map<number, { name: string; qty: number; revenue: number }>();
  for (const r of [...counterTop, ...onlineTop]) {
    const cur = top.get(r.id) ?? { name: r.name, qty: 0, revenue: 0 };
    cur.qty += Number(r.qty);
    cur.revenue += Number(r.revenue);
    top.set(r.id, cur);
  }
  const topSellers = [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 12);

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${fmtDate(from)} – ${fmtDate(to)}`}
        actions={<PrintButton label="Print report" />}
        className="no-print"
      />
      <div className="no-print">
        <RangePresets
          base="/admin/reports"
          sp={sp}
          today={today}
          presets={[
            { label: "Last 7 days", from: addDays(today, -6) },
            { label: "Last 30 days", from: addDays(today, -29) },
            { label: "This month", from: `${today.slice(0, 8)}01` },
            { label: "Last 90 days", from: addDays(today, -89) },
          ]}
        />
        <FilterBar action="/admin/reports" resetHref="/admin/reports">
          <FilterDate name="from" label="From" defaultValue={from} />
          <FilterDate name="to" label="To" defaultValue={to} />
        </FilterBar>
      </div>

      {/* Print header */}
      <div className="print-only mb-6">
        <p className="font-display text-xl font-bold">{HOSPITAL.name} — Management report</p>
        <p className="text-sm text-ink-600">
          {fmtDate(from)} to {fmtDate(to)} · generated {fmtDateTime(new Date().toISOString())} by {me.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Consultations" value={fmtNumber(consults)} sub={`${fmtNumber(completed)} completed`} />
        <StatCard label="Video share" value={consults ? `${Math.round((video / consults) * 100)}%` : "—"} sub={`${fmtNumber(video)} video consults`} tone="violet" />
        <StatCard label="Cancellations" value={fmtNumber(cancelled)} tone="danger" />
        <StatCard label="Revenue collected" value={inr(Math.round(collected))} tone="success" />
        <StatCard label="New patients" value={fmtNumber(newPatients)} tone="info" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="break-inside-avoid">
          <CardHeader title="Revenue by purpose" description="Successful payments in range" />
          <CardBody>
            {revenue.length ? (
              <HBarChart
                rows={[...revenue].sort((a, b) => Number(b.collected) - Number(a.collected)).map((r) => ({ label: PURPOSE_LABEL[r.purpose], value: Math.round(Number(r.collected)), sub: `${r.n} txns` }))}
                format={(n) => inr(n)}
                labelWidth="9.5rem"
              />
            ) : (
              <EmptyState title="No payments in range" />
            )}
          </CardBody>
        </Card>
        <Card className="break-inside-avoid">
          <CardHeader title="Top diagnoses" description="From prescriptions issued in range" />
          <CardBody>
            {diagnoses.length ? (
              <HBarChart rows={diagnoses.map((d) => ({ label: d.diagnosis, value: d.n }))} labelWidth="15rem" />
            ) : (
              <EmptyState title="No prescriptions in range" />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5 break-inside-avoid">
        <CardHeader title="Consultations by department" />
        <TableWrap>
          <thead>
            <tr>
              <Th>Department</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">In-person</Th>
              <Th className="text-right">Video</Th>
              <Th className="text-right">Completed</Th>
              <Th className="text-right">Fees collected</Th>
            </tr>
          </thead>
          <tbody>
            {byDept.map((d) => (
              <tr key={d.name}>
                <Td className="font-medium text-ink-900">{d.name}</Td>
                <Td className="tabular text-right">{d.total}</Td>
                <Td className="tabular text-right">{Number(d.inPerson)}</Td>
                <Td className="tabular text-right">{Number(d.video)}</Td>
                <Td className="tabular text-right">{Number(d.completed)}</Td>
                <Td className="tabular text-right font-medium">{inr(Number(d.fees))}</Td>
              </tr>
            ))}
            <tr className="bg-surface/60 font-semibold">
              <Td>Total</Td>
              <Td className="tabular text-right">{consults}</Td>
              <Td className="tabular text-right">{consults - video}</Td>
              <Td className="tabular text-right">{video}</Td>
              <Td className="tabular text-right">{completed}</Td>
              <Td className="tabular text-right">{inr(byDept.reduce((s, d) => s + Number(d.fees), 0))}</Td>
            </tr>
          </tbody>
        </TableWrap>
      </Card>

      <Card className="mt-5 break-inside-avoid">
        <CardHeader title="Consultations by doctor" />
        <TableWrap>
          <thead>
            <tr>
              <Th>Doctor</Th>
              <Th>Department</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Video</Th>
              <Th className="text-right">Completed</Th>
              <Th className="text-right">No-show</Th>
              <Th className="text-right">Fees collected</Th>
            </tr>
          </thead>
          <tbody>
            {byDoctor.map((d) => (
              <tr key={d.code}>
                <Td>
                  <p className="font-medium text-ink-900">{d.name}</p>
                  <p className="tabular text-xs text-ink-500">{d.code}</p>
                </Td>
                <Td className="text-ink-600">{d.dept}</Td>
                <Td className="tabular text-right">{d.total}</Td>
                <Td className="tabular text-right">{Number(d.video)}</Td>
                <Td className="tabular text-right">{Number(d.completed)}</Td>
                <Td className="tabular text-right">{Number(d.noShow)}</Td>
                <Td className="tabular text-right font-medium">{inr(Number(d.fees))}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      <Card className="mt-5 break-inside-avoid">
        <CardHeader title="Pharmacy top sellers" description="Counter + online, by revenue" />
        {topSellers.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Medicine</Th>
                <Th className="text-right">Units sold</Th>
                <Th className="text-right">Revenue</Th>
              </tr>
            </thead>
            <tbody>
              {topSellers.map((t, i) => (
                <tr key={t.name}>
                  <Td className="text-ink-500">{i + 1}</Td>
                  <Td className="font-medium text-ink-900">{t.name}</Td>
                  <Td className="tabular text-right">{fmtNumber(t.qty)}</Td>
                  <Td className="tabular text-right font-medium">{inr(Math.round(t.revenue))}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No pharmacy sales in range" />
        )}
      </Card>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
