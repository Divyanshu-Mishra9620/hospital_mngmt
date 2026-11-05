import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { departments, doctors } from "@/db/schema";
import { ActionForm } from "@/components/admin/action-form";
import { DepartmentIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { adminSaveDepartment } from "@/lib/actions/admin";
import { DEPARTMENT_ICON_NAMES } from "@/lib/admin/constants";
import { str } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";

export const metadata = { title: "Departments" };

export default async function AdminDepartments({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const editId = Number(str(sp.edit)) || 0;
  const creating = str(sp.new) === "1";
  const [rows, docCounts] = await Promise.all([
    db.select().from(departments).orderBy(departments.sortOrder, departments.name),
    db.select({ id: doctors.departmentId, n: count() }).from(doctors).where(eq(doctors.active, true)).groupBy(doctors.departmentId),
  ]);
  const counts = new Map(docCounts.map((c) => [c.id, c.n]));
  const editing = editId ? rows.find((r) => r.id === editId) : undefined;
  const showForm = creating || !!editing;
  const d = editing;

  return (
    <>
      <PageHeader
        title="Departments & specialities"
        description="Shown on the public website, doctor profiles and the booking flow."
        actions={
          !showForm && (
            <LinkButton href="/admin/departments?new=1" size="sm">
              <Plus aria-hidden /> New department
            </LinkButton>
          )
        }
      />
      {str(sp.saved) === "1" && <Alert tone="success" className="mb-4">Department created.</Alert>}

      {showForm && (
        <Card className="mb-5">
          <CardHeader
            title={editing ? `Edit ${editing.name}` : "New department"}
            action={
              <LinkButton href="/admin/departments" variant="ghost" size="xs">
                Close
              </LinkButton>
            }
          />
          <CardBody>
            <ActionForm action={adminSaveDepartment} submitLabel={editing ? "Save department" : "Create department"} footerClassName="justify-end">
              <input type="hidden" name="id" value={d?.id ?? ""} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="name" required>
                  <Input id="name" name="name" defaultValue={d?.name} required />
                </Field>
                <Field label="URL slug" htmlFor="slug" hint="Used in /departments/<slug>" required>
                  <Input id="slug" name="slug" defaultValue={d?.slug} pattern="[a-z0-9-]+" required />
                </Field>
              </div>
              <Field label="One-line summary" htmlFor="summary" required>
                <Input id="summary" name="summary" defaultValue={d?.summary} maxLength={200} required />
              </Field>
              <Field label="Description" htmlFor="description" required>
                <Textarea id="description" name="description" rows={4} defaultValue={d?.description} required />
              </Field>
              <Field label="Services & procedures" htmlFor="services" hint="Comma-separated">
                <Textarea id="services" name="services" rows={2} defaultValue={d?.services} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Icon" htmlFor="icon">
                  <Select id="icon" name="icon" defaultValue={d?.icon ?? "Stethoscope"}>
                    {DEPARTMENT_ICON_NAMES.map((n) => (
                      <option key={n} value={n}>
                        {n.replace(/([A-Z])/g, " $1").trim()}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Location" htmlFor="location">
                  <Input id="location" name="location" defaultValue={d?.location ?? ""} placeholder="Block A, 2nd floor" />
                </Field>
                <Field label="Extension" htmlFor="extension">
                  <Input id="extension" name="extension" defaultValue={d?.extension ?? ""} />
                </Field>
                <Field label="Sort order" htmlFor="sortOrder">
                  <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={d?.sortOrder ?? rows.length + 1} />
                </Field>
              </div>
              <Checkbox name="active" defaultChecked={d?.active ?? true} label="Active (visible on the website and in booking)" />
            </ActionForm>
          </CardBody>
        </Card>
      )}

      <Card>
        <TableWrap>
          <thead>
            <tr>
              <Th>Department</Th>
              <Th>Location</Th>
              <Th className="text-right">Active doctors</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={editId === r.id ? "bg-brand-50/50" : "hover:bg-surface/50"}>
                <Td>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                      <DepartmentIcon name={r.icon} className="size-[1.125rem]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink-900">{r.name}</span>
                      <span className="block max-w-md truncate text-xs text-ink-500">{r.summary}</span>
                    </span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-ink-600">
                  {r.location ?? "—"}
                  {r.extension && <span className="block text-xs text-ink-400">Ext. {r.extension}</span>}
                </Td>
                <Td className="tabular text-right">{counts.get(r.id) ?? 0}</Td>
                <Td>{r.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Hidden</Badge>}</Td>
                <Td className="whitespace-nowrap text-right">
                  <Link href={`/departments/${r.slug}`} target="_blank" className="mr-3 text-xs font-medium text-ink-500 hover:text-brand-700">
                    View page
                  </Link>
                  <LinkButton href={`/admin/departments?edit=${r.id}`} variant="outline" size="xs" scroll>
                    Edit
                  </LinkButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
