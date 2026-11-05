"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  IndianRupee,
  Inbox,
  Package,
  Pill,
  UserPlus,
} from "lucide-react";
import { RevenueTrendChart } from "@/components/admin/revenue-chart";
import { HBarChart, Meter } from "@/components/admin/bars";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { getDashboard } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { fmtLongDate, fmtNumber, inr, timeAgo, titleCase } from "@/lib/format";
import { clinicNow } from "@/lib/time";

function compactINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return inr(Math.round(n));
}

async function __render() {
  const me = await requireAdmin();
  const d = await getDashboard();
  const hour = Math.floor(clinicNow().minutes / 60);
  const totalRev30 = d.trend.reduce((s, t) => s + t.consultation + t.pharmacy, 0);

  return (
    <>
      <PageHeader
        eyebrow={fmtLongDate(d.today)}
        title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${me.name.split(" ")[0]}`}
        description="Hospital-wide snapshot: OPD, revenue, pharmacy, beds and patient enquiries."
        actions={
          <>
            <LinkButton href="/admin/reports" variant="outline" size="sm">
              Reports
            </LinkButton>
            <LinkButton href="/admin/doctors/new" size="sm">
              Add doctor
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Appointments today"
          value={fmtNumber(d.appt.total)}
          sub={`${d.appt.inPerson} in-person · ${d.appt.video} video · ${d.appt.completed} completed`}
          icon={<CalendarDays />}
          href="/admin/appointments"
        />
        <StatCard
          label="OPD revenue today"
          value={inr(Math.round(d.rev.opdToday))}
          sub={`${compactINR(d.rev.opd30)} in the last 30 days`}
          icon={<IndianRupee />}
          tone="info"
          href="/admin/billing?purpose=consultation"
        />
        <StatCard
          label="Pharmacy revenue today"
          value={inr(Math.round(d.rev.pharmacyToday))}
          sub={`${compactINR(d.rev.pharmacy30)} in the last 30 days`}
          icon={<Pill />}
          tone="accent"
          href="/admin/pharmacy"
        />
        <StatCard
          label="Registered patients"
          value={fmtNumber(d.patientsTotal)}
          sub={`${d.patientsNew} new this week`}
          icon={<UserPlus />}
          tone="success"
          href="/admin/patients"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/admin/beds" className="rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-200">
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink-500">
            <BedDouble className="size-4 text-ink-400" aria-hidden /> Bed occupancy
          </p>
          <p className="tabular mt-1 font-display text-xl font-bold text-ink-900">
            {d.occupancy.pct}% <span className="text-sm font-medium text-ink-500">· {d.occupancy.occupied}/{d.occupancy.beds}</span>
          </p>
          <Meter value={d.occupancy.occupied} max={d.occupancy.beds} className="mt-2" label="Bed occupancy" />
        </Link>
        <Link href="/admin/pharmacy" className="rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-200">
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink-500">
            <AlertTriangle className="size-4 text-warning-600" aria-hidden /> Stock alerts
          </p>
          <p className="tabular mt-1 font-display text-xl font-bold text-ink-900">{d.lowStock + d.outOfStock}</p>
          <p className="text-xs text-ink-500">
            {d.lowStock} low · {d.outOfStock} out of stock
          </p>
        </Link>
        <Link href="/pharmacy/orders" className="rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-200">
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink-500">
            <Package className="size-4 text-ink-400" aria-hidden /> Open online orders
          </p>
          <p className="tabular mt-1 font-display text-xl font-bold text-ink-900">{d.pendingOrders}</p>
          <p className="text-xs text-ink-500">Placed, packing, ready or out for delivery</p>
        </Link>
        <Link href="/admin/enquiries?status=new" className="rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-200">
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink-500">
            <Inbox className="size-4 text-ink-400" aria-hidden /> New enquiries
          </p>
          <p className="tabular mt-1 font-display text-xl font-bold text-ink-900">{d.newEnquiries}</p>
          <p className="text-xs text-ink-500">Awaiting a response</p>
        </Link>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Revenue — last 30 days"
            description={`${compactINR(totalRev30)} collected from consultations and the pharmacy (successful payments)`}
            action={
              <LinkButton href="/admin/billing" variant="ghost" size="xs">
                Billing →
              </LinkButton>
            }
          />
          <CardBody>
            <RevenueTrendChart data={d.trend} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Appointments by department" description="Last 30 days, excluding cancellations" />
          <CardBody>
            {d.departments.length ? (
              <HBarChart rows={d.departments.slice(0, 10).map((r) => ({ label: r.name.replace(/ \(.+\)$/, "").replace(/ & .+$/, ""), value: r.n }))} labelWidth="8.5rem" />
            ) : (
              <EmptyState title="No appointments yet" />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Today's OPD board"
            description={`${d.board.length} doctors consulting today · ${d.appt.waiting} patients waiting`}
            action={
              <LinkButton href={`/admin/appointments?from=${d.today}&to=${d.today}`} variant="ghost" size="xs">
                All of today →
              </LinkButton>
            }
          />
          {d.board.length === 0 ? (
            <EmptyState title="No OPD appointments today" description="The board fills up as patients book." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Doctor</Th>
                  <Th className="text-right">Booked</Th>
                  <Th className="text-right">Waiting</Th>
                  <Th className="text-right">In consult</Th>
                  <Th className="text-right">Done</Th>
                  <Th>Progress</Th>
                </tr>
              </thead>
              <tbody>
                {d.board.map((b) => (
                  <tr key={b.doctorId} className="hover:bg-surface/50">
                    <Td>
                      <Link href={`/admin/doctors/${b.code}`} className="flex items-center gap-2.5">
                        <Avatar name={b.name} color={b.color} size="xs" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-900">{b.name}</span>
                          <span className="block truncate text-xs text-ink-500">
                            {b.department.replace(/ & .+$/, "")} · Room {b.room ?? "—"}
                            {b.video ? ` · ${b.video} video` : ""}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="tabular text-right">{b.booked}</Td>
                    <Td className="tabular text-right">{b.waiting ? <Badge tone="info">{b.waiting}</Badge> : 0}</Td>
                    <Td className="tabular text-right">{b.inConsult ? <Badge tone="violet">{b.inConsult}</Badge> : 0}</Td>
                    <Td className="tabular text-right font-semibold text-ink-900">{b.completed}</Td>
                    <Td className="w-40">
                      <div className="flex items-center gap-2">
                        <Meter value={b.completed + b.noShow} max={b.total} label={`${b.completed} of ${b.total} seen`} />
                        <span className="tabular w-10 text-right text-xs text-ink-500">
                          {b.completed + b.noShow}/{b.total}
                        </span>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <LinkButton href="/admin/audit" variant="ghost" size="xs">
                Audit log →
              </LinkButton>
            }
          />
          <ul className="divide-y divide-line">
            {d.activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <Avatar name={a.actorName ?? "System"} size="xs" color={a.role === "admin" ? "#0f5764" : a.role === "doctor" ? "#2a78d6" : a.role === "pharmacist" ? "#9a620e" : "#66757f"} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-ink-800">
                    <span className="font-semibold">{a.actorName ?? "System"}</span>{" "}
                    <span className="text-ink-600">
                      {titleCase(a.action).toLowerCase()} · {titleCase(a.entity).toLowerCase()}
                    </span>{" "}
                    {a.entityRef && <span className="tabular font-medium text-ink-700">{a.entityRef}</span>}
                  </p>
                  {a.detail && <p className="truncate text-xs text-ink-500">{a.detail}</p>}
                </div>
                <span className="shrink-0 text-xs text-ink-400">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
            {d.activity.length === 0 && <EmptyState title="No activity yet" />}
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
