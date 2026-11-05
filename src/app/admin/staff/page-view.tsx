"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { doctors, users } from "@/db/schema";
import { ActionForm } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Avatar, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { adminCreateStaff, adminResetPassword, adminToggleUser } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";

async function __render() {
  const me = await requireAdmin();
  const [staff, docs] = await Promise.all([
    db.select().from(users).where(inArray(users.role, ["pharmacist", "admin"])).orderBy(asc(users.role), asc(users.code)),
    db
      .select({ u: users, code: doctors.code })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .orderBy(asc(doctors.code)),
  ]);

  return (
    <>
      <PageHeader title="Staff & user accounts" description="Pharmacy and administration accounts. Doctor accounts are managed from Doctors; patient accounts from Patients." />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader title="Pharmacy & administration" description={`${staff.length} accounts`} />
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Contact</Th>
                <Th>Last sign-in</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} className={u.active ? "hover:bg-surface/50" : "bg-surface/40"}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} size="sm" color={u.role === "admin" ? "#0f5764" : "#9a620e"} />
                      <span>
                        <span className="block font-semibold text-ink-900">
                          {u.name}
                          {u.id === me.id && <span className="ml-1.5 text-xs font-medium text-ink-400">(you)</span>}
                        </span>
                        <span className="tabular block text-xs text-ink-500">{u.code}</span>
                      </span>
                    </div>
                  </Td>
                  <Td>{u.role === "admin" ? <Badge tone="brand">Administrator</Badge> : <Badge tone="accent">Pharmacist</Badge>}</Td>
                  <Td>
                    <p className="max-w-[14rem] truncate">{u.email}</p>
                    <p className="tabular text-xs text-ink-500">{u.phone ?? "—"}</p>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-600">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</Td>
                  <Td>{u.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</Td>
                  <Td className="whitespace-nowrap text-right">
                    {u.id !== me.id && (
                      <div className="flex items-start justify-end gap-1">
                        <ActionForm action={adminResetPassword} submitLabel="Reset password" variant="ghost" size="xs" className="space-y-1" confirm={`Reset the password for ${u.name}?`}>
                          <input type="hidden" name="userId" value={u.id} />
                        </ActionForm>
                        <form action={adminToggleUser}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                          <Button type="submit" variant="ghost" size="xs" className={u.active ? "text-danger-700" : "text-success-700"}>
                            {u.active ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader title="Add staff account" description="A temporary password is shown once after creation." />
          <CardBody>
            <ActionForm action={adminCreateStaff} submitLabel="Create account" pendingText="Creating…">
              <Field label="Role" htmlFor="role">
                <Select id="role" name="role" defaultValue="pharmacist">
                  <option value="pharmacist">Pharmacist (store agent) — PHA- ID</option>
                  <option value="admin">Administrator — ADM- ID</option>
                </Select>
              </Field>
              <Field label="Full name" htmlFor="staff-name" required>
                <Input id="staff-name" name="name" required />
              </Field>
              <Field label="Email" htmlFor="staff-email" required>
                <Input id="staff-email" name="email" type="email" required />
              </Field>
              <Field label="Mobile" htmlFor="staff-phone">
                <Input id="staff-phone" name="phone" type="tel" />
              </Field>
            </ActionForm>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Doctor accounts"
          description="Read-only here — open a doctor to edit, reset password or deactivate."
          action={
            <Link href="/admin/doctors" className="text-xs font-semibold text-brand-700 hover:underline">
              Manage doctors →
            </Link>
          }
        />
        <TableWrap>
          <thead>
            <tr>
              <Th>Doctor</Th>
              <Th>Email</Th>
              <Th>Last sign-in</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {docs.map(({ u, code }) => (
              <tr key={u.id} className="hover:bg-surface/50">
                <Td>
                  <Link href={`/admin/doctors/${code}`} className="font-medium text-ink-900 hover:text-brand-700">
                    {u.name}
                  </Link>
                  <p className="tabular text-xs text-ink-500">{code}</p>
                </Td>
                <Td className="max-w-[16rem] truncate">{u.email}</Td>
                <Td className="whitespace-nowrap text-ink-600">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</Td>
                <Td>{u.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}

const __loader = () => __render();

export default function PageView() {
  return <ClientPage render={__loader} props={{}} />;
}
