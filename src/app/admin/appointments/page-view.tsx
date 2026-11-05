"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { APPOINTMENT_STATUSES } from "@/db/schema";
import { FilterBar, FilterDate, FilterSearch, FilterSelect, Pagination, RangePresets } from "@/components/admin/list-tools";
import { AppointmentStatusBadge, ModeBadge } from "@/components/status";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { searchAppointments } from "@/lib/admin/appointments";
import { listDepartmentsBasic, listDoctorsBasic, pageOf, readRange, str } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDay, fmtNumber, fmtTime, inr, titleCase } from "@/lib/format";
import { addDays } from "@/lib/time";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 25;

async function __render({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { from, to, today } = readRange(sp, 1);
  const page = pageOf(sp.page);
  const doctorId = Number(str(sp.doctor)) || undefined;
  const departmentId = Number(str(sp.dept)) || undefined;
  const mode = (["in_person", "video"] as const).find((m) => m === str(sp.mode));
  const status = APPOINTMENT_STATUSES.find((s) => s === str(sp.status));
  const q = str(sp.q) || undefined;

  const [docs, depts, result] = await Promise.all([
    listDoctorsBasic(),
    listDepartmentsBasic(),
    searchAppointments({ from, to, doctorId, departmentId, mode, status, q }, page, PAGE_SIZE),
  ]);
  const { rows, total, summary } = result;

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Every OPD and video consultation across the hospital. Cancel with automatic refund from the appointment page."
      />

      <RangePresets
        base="/admin/appointments"
        sp={sp}
        today={today}
        presets={[
          { label: "Today", from: today, to: today },
          { label: "Tomorrow", from: addDays(today, 1), to: addDays(today, 1) },
          { label: "Next 7 days", from: today, to: addDays(today, 6) },
          { label: "Last 7 days", from: addDays(today, -6) },
          { label: "Last 30 days", from: addDays(today, -29) },
        ]}
      />
      <FilterBar action="/admin/appointments" resetHref="/admin/appointments">
        <FilterDate name="from" label="From" defaultValue={from} />
        <FilterDate name="to" label="To" defaultValue={to} />
        <FilterSelect
          name="dept"
          label="Department"
          defaultValue={departmentId ? String(departmentId) : ""}
          options={[{ value: "", label: "All departments" }, ...depts.map((d) => ({ value: String(d.id), label: d.name }))]}
          className="max-w-[14rem]"
        />
        <FilterSelect
          name="doctor"
          label="Doctor"
          defaultValue={doctorId ? String(doctorId) : ""}
          options={[{ value: "", label: "All doctors" }, ...docs.map((d) => ({ value: String(d.id), label: d.name }))]}
          className="max-w-[14rem]"
        />
        <FilterSelect
          name="mode"
          label="Mode"
          defaultValue={mode ?? ""}
          options={[
            { value: "", label: "All modes" },
            { value: "in_person", label: "In-person" },
            { value: "video", label: "Video" },
          ]}
        />
        <FilterSelect
          name="status"
          label="Status"
          defaultValue={status ?? ""}
          options={[{ value: "", label: "All statuses" }, ...APPOINTMENT_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))]}
        />
        <FilterSearch defaultValue={q} placeholder="Patient, UHID, doctor or APT code" />
      </FilterBar>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Badge tone="neutral">{fmtNumber(summary.total)} total</Badge>
        <Badge tone="brand">{summary.live} upcoming / in progress</Badge>
        <Badge tone="success">{summary.completed} completed</Badge>
        <Badge tone="violet">{summary.video} video</Badge>
        <Badge tone="neutral">{summary.inPerson} in-person</Badge>
        <Badge tone="danger">{summary.cancelled} cancelled</Badge>
        {summary.noShow > 0 && <Badge tone="warning">{summary.noShow} no-show</Badge>}
        <Badge tone="info">Fees (excl. cancelled) {inr(summary.fees)}</Badge>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<CalendarDays />} title="No appointments match these filters" description="Try a wider date range or clear the filters." />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Patient</Th>
                  <Th>Doctor</Th>
                  <Th>Mode</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Fee</Th>
                  <Th>Ref.</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/50">
                    <Td className="whitespace-nowrap">
                      <p className="font-medium text-ink-900">{fmtDay(r.date)}</p>
                      <p className="tabular text-xs text-ink-500">
                        {fmtTime(r.time)}
                        {r.tokenNo ? ` · Token ${r.tokenNo}` : ""}
                      </p>
                    </Td>
                    <Td>
                      <Link href={`/admin/patients/${r.uhid}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {r.patientName}
                      </Link>
                      <p className="tabular text-xs text-ink-500">{r.uhid}</p>
                    </Td>
                    <Td>
                      <Link href={`/admin/doctors/${r.doctorCode}`} className="flex items-center gap-2">
                        <Avatar name={r.doctorName} color={r.doctorColor} size="xs" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-800 hover:text-brand-700">{r.doctorName}</span>
                          <span className="block truncate text-xs text-ink-500">{r.department}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <ModeBadge mode={r.mode} />
                    </Td>
                    <Td>
                      <AppointmentStatusBadge status={r.status} />
                    </Td>
                    <Td className="tabular whitespace-nowrap text-right">
                      <p className="font-medium text-ink-900">{inr(r.fee)}</p>
                      <p className={r.paymentStatus === "refunded" ? "text-xs text-danger-700" : "text-xs text-ink-500"}>{titleCase(r.paymentStatus)}</p>
                    </Td>
                    <Td>
                      <Link href={`/admin/appointments/${r.code}`} className="tabular whitespace-nowrap text-xs font-semibold text-brand-700 hover:underline">
                        {r.code} →
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination base="/admin/appointments" sp={sp} page={page} pageSize={PAGE_SIZE} total={total} />
          </>
        )}
      </Card>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
