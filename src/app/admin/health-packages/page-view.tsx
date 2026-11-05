"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { healthPackages, packageBookings, patients, users } from "@/db/schema";
import { ActionForm } from "@/components/admin/action-form";
import { FilterBar, FilterSelect } from "@/components/admin/list-tools";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { adminSavePackage, adminSetPackageBooking } from "@/lib/actions/admin";
import { str } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDate, fmtDay, inr, parseJSON } from "@/lib/format";
import { todayISO } from "@/lib/time";

async function __render({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (["booked", "completed", "cancelled"] as const).find((s) => s === str(sp.status));
  const [pkgs, stats, bookings] = await Promise.all([
    db.select().from(healthPackages).orderBy(healthPackages.price),
    db
      .select({ id: packageBookings.packageId, n: count(), revenue: sql<number>`coalesce(sum(case when ${packageBookings.status} <> 'cancelled' then ${packageBookings.amount} end), 0)` })
      .from(packageBookings)
      .groupBy(packageBookings.packageId),
    db
      .select({ b: packageBookings, pkg: healthPackages.name, patient: users.name, uhid: patients.uhid, phone: users.phone })
      .from(packageBookings)
      .innerJoin(healthPackages, eq(healthPackages.id, packageBookings.packageId))
      .innerJoin(patients, eq(patients.id, packageBookings.patientId))
      .innerJoin(users, eq(users.id, patients.userId))
      .where(status ? eq(packageBookings.status, status) : undefined)
      .orderBy(desc(packageBookings.date)),
  ]);
  const byPkg = new Map(stats.map((s) => [s.id, s]));
  const today = todayISO();

  return (
    <>
      <PageHeader title="Health check-up packages" description="Prices shown on the public website and in the patient portal, plus every package booking." />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {pkgs.map((p) => {
          const st = byPkg.get(p.id);
          const tests = parseJSON<string[]>(p.tests, []);
          return (
            <Card key={p.id} className="flex flex-col">
              <CardHeader
                title={p.name}
                description={p.audience}
                action={
                  <span className="flex gap-1">
                    {p.highlight && <Badge tone="accent">Featured</Badge>}
                    {p.active ? <Badge tone="success">Live</Badge> : <Badge tone="neutral">Hidden</Badge>}
                  </span>
                }
              />
              <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                <p className="text-xs text-ink-500">
                  {tests.length} inclusions · {st?.n ?? 0} bookings · {inr(Number(st?.revenue ?? 0))} billed
                </p>
                <p className="line-clamp-2 text-sm text-ink-600">{tests.join(" · ")}</p>
                <ActionForm action={adminSavePackage} submitLabel="Save" size="sm" variant="outline" className="mt-auto">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Offer price (₹)" htmlFor={`price-${p.id}`}>
                      <Input id={`price-${p.id}`} name="price" type="number" min={1} defaultValue={p.price} />
                    </Field>
                    <Field label="MRP (₹)" htmlFor={`mrp-${p.id}`}>
                      <Input id={`mrp-${p.id}`} name="mrp" type="number" min={1} defaultValue={p.mrp} />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <Checkbox name="active" defaultChecked={p.active} label="Bookable" />
                    <Checkbox name="highlight" defaultChecked={p.highlight} label="Featured" />
                  </div>
                </ActionForm>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">Bookings</h2>
      <FilterBar action="/admin/health-packages" resetHref="/admin/health-packages">
        <FilterSelect
          name="status"
          label="Status"
          defaultValue={status ?? ""}
          options={[
            { value: "", label: "All" },
            { value: "booked", label: "Booked" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </FilterBar>
      <Card>
        {bookings.length === 0 ? (
          <EmptyState title="No bookings" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Patient</Th>
                <Th>Package</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {bookings.map(({ b, pkg, patient, uhid, phone }) => (
                <tr key={b.id} className="hover:bg-surface/50">
                  <Td className="whitespace-nowrap">
                    <p className="font-medium text-ink-900">{fmtDay(b.date)}</p>
                    <p className="tabular text-xs text-ink-500">{b.code}</p>
                  </Td>
                  <Td>
                    <Link href={`/admin/patients/${uhid}`} className="font-medium text-ink-800 hover:text-brand-700">
                      {patient}
                    </Link>
                    <p className="tabular text-xs text-ink-500">
                      {uhid} · {phone}
                    </p>
                  </Td>
                  <Td>{pkg}</Td>
                  <Td className="tabular text-right">{inr(b.amount)}</Td>
                  <Td>
                    {b.status === "booked" ? (
                      <Badge tone={b.date < today ? "warning" : "brand"}>{b.date < today ? "Overdue" : "Booked"}</Badge>
                    ) : b.status === "completed" ? (
                      <Badge tone="success">Completed</Badge>
                    ) : (
                      <Badge tone="danger">Cancelled · refunded</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {b.status === "booked" && (
                      <div className="flex justify-end gap-1">
                        <form action={adminSetPackageBooking}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="status" value="completed" />
                          <Button type="submit" variant="secondary" size="xs">
                            Mark completed
                          </Button>
                        </form>
                        <form action={adminSetPackageBooking}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <Button type="submit" variant="ghost" size="xs" className="text-danger-700">
                            Cancel & refund
                          </Button>
                        </form>
                      </div>
                    )}
                    {b.status !== "booked" && <span className="text-xs text-ink-400">Booked {fmtDate(b.createdAt)}</span>}
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

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
