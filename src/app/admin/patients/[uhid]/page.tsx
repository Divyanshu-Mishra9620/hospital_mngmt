import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { admissions, dispenses, doctors, patients, payments, pharmacyOrders, users, vitals, wards } from "@/db/schema";
import { ActionForm } from "@/components/admin/action-form";
import { AppointmentStatusBadge, ModeBadge, OrderStatusBadge, SupplyBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, DescriptionList, EmptyState, PageHeader, StatCard, TableWrap, Tabs, Td, Th } from "@/components/ui/misc";
import { adminResetPassword, adminToggleUser } from "@/lib/actions/admin";
import { recentAppointmentsForPatient } from "@/lib/admin/appointments";
import { str } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { ageFrom, bmi, fmtDate, fmtDateTime, fmtDay, fmtTime, genderLabel, inr, titleCase } from "@/lib/format";
import { listPrescriptions } from "@/lib/queries/prescriptions";

export const metadata = { title: "Patient record" };

const TABS = ["appointments", "prescriptions", "pharmacy", "billing", "admissions", "vitals"] as const;

export default async function AdminPatientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ uhid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { uhid } = await params;
  const sp = await searchParams;
  const tab = TABS.find((t) => t === str(sp.tab)) ?? "appointments";
  const [row] = await db
    .select({ p: patients, u: users })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.uhid, decodeURIComponent(uhid).toUpperCase()));
  if (!row) notFound();
  const { p, u } = row;
  const docUser = alias(users, "doc_user");

  const [appts, rxs, orders, bills, pays, adms, vit] = await Promise.all([
    recentAppointmentsForPatient(p.id, 100),
    listPrescriptions({ patientId: p.id, limit: 100 }),
    db.select().from(pharmacyOrders).where(eq(pharmacyOrders.patientId, p.id)).orderBy(desc(pharmacyOrders.createdAt)),
    db.select().from(dispenses).where(eq(dispenses.patientId, p.id)).orderBy(desc(dispenses.createdAt)),
    db.select().from(payments).where(eq(payments.patientId, p.id)).orderBy(desc(payments.createdAt)),
    db
      .select({ a: admissions, ward: wards.name, doctor: docUser.name })
      .from(admissions)
      .innerJoin(wards, eq(wards.id, admissions.wardId))
      .innerJoin(doctors, eq(doctors.id, admissions.doctorId))
      .innerJoin(docUser, eq(docUser.id, doctors.userId))
      .where(eq(admissions.patientId, p.id))
      .orderBy(desc(admissions.admittedAt)),
    db.select().from(vitals).where(eq(vitals.patientId, p.id)).orderBy(desc(vitals.recordedAt)).limit(50),
  ]);

  const paid = pays.filter((x) => x.status === "success").reduce((s, x) => s + x.amount, 0);
  const latestV = vit[0];
  const b = bmi(latestV?.weightKg ?? p.weightKg, latestV?.heightCm ?? p.heightCm);
  const active = adms.find((a) => !a.a.dischargedAt);
  const base = `/admin/patients/${p.uhid}`;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/patients", label: "Patients" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={u.name} color="#46638f" />
            <span>
              {u.name}
              <span className="tabular mt-0.5 block text-sm font-medium text-ink-500">
                UHID {p.uhid} · {ageFrom(p.dob) ?? "—"} y · {genderLabel(p.gender)}
                {p.bloodGroup ? ` · ${p.bloodGroup}` : ""}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            {active && <Badge tone="info">Admitted · {active.ward} {active.a.bedNo}</Badge>}
            {u.active ? <Badge tone="success">Account active</Badge> : <Badge tone="neutral">Account inactive</Badge>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Visits" value={appts.filter((a) => a.status !== "cancelled").length} sub={`${appts.filter((a) => a.status === "completed").length} completed`} />
        <StatCard label="Prescriptions" value={rxs.length} tone="violet" />
        <StatCard label="Pharmacy purchases" value={orders.length + bills.length} sub={`${orders.length} online · ${bills.length} counter`} tone="accent" />
        <StatCard label="Total paid" value={inr(Math.round(paid))} tone="info" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Profile" />
            <CardBody>
              <DescriptionList
                cols={1}
                items={[
                  { label: "Date of birth", value: p.dob ? `${fmtDate(p.dob)} (${ageFrom(p.dob)} y)` : "—" },
                  { label: "Mobile", value: u.phone },
                  { label: "Email", value: <span className="break-all">{u.email}</span> },
                  { label: "Address", value: [p.address, p.city, p.pincode].filter(Boolean).join(", ") },
                  { label: "Emergency contact", value: p.emergencyName ? `${p.emergencyName} (${p.emergencyRelation ?? "—"}) · ${p.emergencyPhone ?? ""}` : "—" },
                  { label: "Allergies", value: p.allergies ? <span className="font-medium text-danger-700">{p.allergies}</span> : "None recorded" },
                  { label: "Chronic conditions", value: p.chronicConditions },
                  { label: "Height / weight", value: p.heightCm || p.weightKg ? `${p.heightCm ?? "—"} cm · ${latestV?.weightKg ?? p.weightKg ?? "—"} kg${b ? ` · BMI ${b.value} (${b.band})` : ""}` : "—" },
                  { label: "Insurance", value: p.insuranceProvider ? `${p.insuranceProvider} · ${p.insurancePolicyNo ?? ""}` : "Self-pay" },
                  { label: "Registered", value: fmtDateTime(p.createdAt) },
                  { label: "Last sign-in", value: u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never" },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Account" />
            <CardBody className="space-y-4">
              <ActionForm action={adminResetPassword} submitLabel="Reset password" variant="outline" size="sm" confirm={`Reset the password for ${u.name}?`}>
                <input type="hidden" name="userId" value={u.id} />
              </ActionForm>
              <form action={adminToggleUser} className="border-t border-line pt-4">
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                <Button type="submit" variant={u.active ? "danger" : "success"} size="sm">
                  {u.active ? "Deactivate account" : "Re-activate account"}
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        <Card className="min-w-0">
          <div className="px-4 pt-2 sm:px-5">
            <Tabs
              active={tab}
              tabs={[
                { key: "appointments", label: "Appointments", href: `${base}?tab=appointments`, count: appts.length },
                { key: "prescriptions", label: "Prescriptions", href: `${base}?tab=prescriptions`, count: rxs.length },
                { key: "pharmacy", label: "Pharmacy", href: `${base}?tab=pharmacy`, count: orders.length + bills.length },
                { key: "billing", label: "Payments", href: `${base}?tab=billing`, count: pays.length },
                { key: "admissions", label: "Admissions", href: `${base}?tab=admissions`, count: adms.length },
                { key: "vitals", label: "Vitals", href: `${base}?tab=vitals`, count: vit.length },
              ]}
            />
          </div>

          {tab === "appointments" &&
            (appts.length ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Doctor</Th>
                    <Th>Mode</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Fee</Th>
                  </tr>
                </thead>
                <tbody>
                  {appts.map((a) => (
                    <tr key={a.id} className="hover:bg-surface/50">
                      <Td className="whitespace-nowrap">
                        <Link href={`/admin/appointments/${a.code}`} className="font-medium text-ink-900 hover:text-brand-700">
                          {fmtDay(a.date)} · {fmtTime(a.time)}
                        </Link>
                        <p className="tabular text-xs text-ink-500">{a.code}</p>
                      </Td>
                      <Td>
                        <p className="font-medium text-ink-800">{a.doctorName}</p>
                        <p className="text-xs text-ink-500">{a.department}</p>
                      </Td>
                      <Td>
                        <ModeBadge mode={a.mode} />
                      </Td>
                      <Td>
                        <AppointmentStatusBadge status={a.status} />
                      </Td>
                      <Td className="tabular text-right">{inr(a.fee)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="No appointments yet" />
            ))}

          {tab === "prescriptions" &&
            (rxs.length ? (
              <ul className="divide-y divide-line">
                {rxs.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/prescriptions/${r.code}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-surface/50 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <span className="min-w-0">
                        <span className="tabular text-xs font-semibold text-brand-700">
                          {r.code} · {fmtDate(r.createdAt)}
                        </span>
                        <span className="block truncate font-medium text-ink-900">{r.diagnosis}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {r.doctorName} · {r.medicines.join(", ")}
                        </span>
                      </span>
                      <SupplyBadge status={r.supplyStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No prescriptions" />
            ))}

          {tab === "pharmacy" && (
            <div className="space-y-1">
              <p className="px-4 pt-4 text-xs font-bold uppercase tracking-[0.12em] text-ink-500 sm:px-5">Online orders</p>
              {orders.length ? (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Order</Th>
                      <Th>Fulfilment</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <Td>
                          <p className="tabular font-medium text-ink-900">{o.code}</p>
                          <p className="text-xs text-ink-500">{fmtDateTime(o.createdAt)}</p>
                        </Td>
                        <Td>{o.fulfilment === "delivery" ? "Home delivery" : "Pickup at counter"}</Td>
                        <Td>
                          <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} />
                        </Td>
                        <Td className="tabular text-right font-medium">{inr(o.total, { paise: true })}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              ) : (
                <p className="px-4 pb-2 text-sm text-ink-500 sm:px-5">No online orders.</p>
              )}
              <p className="px-4 pt-4 text-xs font-bold uppercase tracking-[0.12em] text-ink-500 sm:px-5">Counter bills</p>
              {bills.length ? (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Bill</Th>
                      <Th>Payment</Th>
                      <Th className="text-right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((d) => (
                      <tr key={d.id}>
                        <Td>
                          <p className="tabular font-medium text-ink-900">{d.code}</p>
                          <p className="text-xs text-ink-500">{fmtDateTime(d.createdAt)}</p>
                        </Td>
                        <Td>{d.paymentMethod.toUpperCase()}</Td>
                        <Td className="tabular text-right font-medium">{inr(d.total, { paise: true })}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              ) : (
                <p className="px-4 pb-4 text-sm text-ink-500 sm:px-5">No counter bills.</p>
              )}
            </div>
          )}

          {tab === "billing" &&
            (pays.length ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Payment</Th>
                    <Th>For</Th>
                    <Th>Method</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {pays.map((x) => (
                    <tr key={x.id}>
                      <Td>
                        <p className="tabular font-medium text-ink-900">{x.code}</p>
                        <p className="text-xs text-ink-500">{fmtDateTime(x.createdAt)}</p>
                      </Td>
                      <Td>
                        <p className="text-ink-800">{x.description}</p>
                        <p className="tabular text-xs text-ink-500">{x.reference}</p>
                      </Td>
                      <Td>{x.method.toUpperCase()}</Td>
                      <Td>{x.status === "refunded" ? <Badge tone="danger">Refunded</Badge> : <Badge tone="success">Paid</Badge>}</Td>
                      <Td className="tabular text-right font-medium">{inr(x.amount, { paise: true })}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="No payments" />
            ))}

          {tab === "admissions" &&
            (adms.length ? (
              <ul className="divide-y divide-line">
                {adms.map(({ a, ward, doctor }) => (
                  <li key={a.id} className="px-4 py-3 text-sm sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink-900">
                        {ward} · Bed {a.bedNo}
                      </p>
                      {a.dischargedAt ? <Badge tone="neutral">Discharged {fmtDate(a.dischargedAt)}</Badge> : <Badge tone="info">Currently admitted</Badge>}
                    </div>
                    <p className="text-ink-600">
                      {a.reason} · under {doctor}
                    </p>
                    <p className="tabular text-xs text-ink-500">
                      {a.code} · admitted {fmtDateTime(a.admittedAt)}
                    </p>
                    {a.dischargeSummary && <p className="mt-1 text-xs text-ink-600">Summary: {a.dischargeSummary}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No admissions" description="Admit from Beds & admissions." />
            ))}

          {tab === "vitals" &&
            (vit.length ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Recorded</Th>
                    <Th className="text-right">BP</Th>
                    <Th className="text-right">Pulse</Th>
                    <Th className="text-right">SpO₂</Th>
                    <Th className="text-right">Temp</Th>
                    <Th className="text-right">Sugar</Th>
                    <Th className="text-right">Weight</Th>
                  </tr>
                </thead>
                <tbody>
                  {vit.map((v) => (
                    <tr key={v.id}>
                      <Td className="whitespace-nowrap">{fmtDateTime(v.recordedAt)}</Td>
                      <Td className="tabular text-right">{v.bpSystolic ? `${v.bpSystolic}/${v.bpDiastolic}` : "—"}</Td>
                      <Td className="tabular text-right">{v.pulse ?? "—"}</Td>
                      <Td className="tabular text-right">{v.spo2 ? `${v.spo2}%` : "—"}</Td>
                      <Td className="tabular text-right">{v.temperatureF ? `${v.temperatureF}°F` : "—"}</Td>
                      <Td className="tabular text-right">{v.bloodSugar ? `${v.bloodSugar} (${titleCase(v.sugarType ?? "")})` : "—"}</Td>
                      <Td className="tabular text-right">{v.weightKg ? `${v.weightKg} kg` : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="No vitals recorded" />
            ))}
        </Card>
      </div>
    </>
  );
}
