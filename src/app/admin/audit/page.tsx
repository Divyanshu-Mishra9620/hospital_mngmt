import { and, count, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { History } from "lucide-react";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { FilterBar, FilterDate, FilterSearch, FilterSelect, Pagination } from "@/components/admin/list-tools";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { istRange, pageOf, str } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDateTime, fmtNumber, titleCase } from "@/lib/format";

export const metadata = { title: "Audit log" };
const PAGE_SIZE = 50;

const ROLE_TONE: Record<string, Tone> = { admin: "brand", doctor: "info", pharmacist: "accent", patient: "neutral", system: "violet" };

export default async function AdminAudit({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const role = str(sp.role);
  const action = str(sp.action);
  const q = str(sp.q).toLowerCase();
  const from = str(sp.from);
  const to = str(sp.to);

  const conds: SQL[] = [];
  if (role) conds.push(eq(auditLogs.role, role));
  if (action) conds.push(eq(auditLogs.action, action));
  if (q) {
    const like = `%${q}%`;
    conds.push(
      or(
        sql`lower(coalesce(${auditLogs.actorName}, '')) like ${like}`,
        sql`lower(coalesce(${auditLogs.entityRef}, '')) like ${like}`,
        sql`lower(coalesce(${auditLogs.detail}, '')) like ${like}`,
        sql`lower(${auditLogs.entity}) like ${like}`,
      )!,
    );
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) conds.push(sql`${auditLogs.createdAt} >= ${istRange(from, from)[0]}`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) conds.push(sql`${auditLogs.createdAt} < ${istRange(to, to)[1]}`);
  const where = conds.length ? and(...conds) : undefined;

  const [rows, [{ total }], actions] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(auditLogs).where(where),
    db.selectDistinct({ action: auditLogs.action }).from(auditLogs).orderBy(auditLogs.action),
  ]);

  return (
    <>
      <PageHeader title="Audit log" description={`${fmtNumber(total)} recorded actions — sign-ins, bookings, prescriptions, dispensing, refunds and admin changes.`} />
      <FilterBar action="/admin/audit" resetHref="/admin/audit">
        <FilterSelect
          name="role"
          label="Role"
          defaultValue={role}
          options={[
            { value: "", label: "All roles" },
            { value: "admin", label: "Administrator" },
            { value: "doctor", label: "Doctor" },
            { value: "pharmacist", label: "Pharmacist" },
            { value: "patient", label: "Patient" },
            { value: "system", label: "System" },
          ]}
        />
        <FilterSelect name="action" label="Action" defaultValue={action} options={[{ value: "", label: "All actions" }, ...actions.map((a) => ({ value: a.action, label: titleCase(a.action) }))]} />
        <FilterDate name="from" label="From" defaultValue={from} />
        <FilterDate name="to" label="To" defaultValue={to} />
        <FilterSearch defaultValue={str(sp.q)} placeholder="Person, reference or detail" />
      </FilterBar>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<History />} title="No matching activity" />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>Action</Th>
                  <Th>Record</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-surface/50">
                    <Td className="tabular whitespace-nowrap text-ink-600">{fmtDateTime(r.createdAt)}</Td>
                    <Td className="whitespace-nowrap">
                      <p className="font-medium text-ink-900">{r.actorName ?? "System"}</p>
                      <Badge tone={ROLE_TONE[r.role ?? "system"] ?? "neutral"}>{titleCase(r.role ?? "system")}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap font-medium text-ink-800">{titleCase(r.action)}</Td>
                    <Td className="whitespace-nowrap">
                      <p className="text-ink-700">{titleCase(r.entity)}</p>
                      {r.entityRef && <p className="tabular text-xs text-ink-500">{r.entityRef}</p>}
                    </Td>
                    <Td className="max-w-md text-ink-600">
                      <p className="line-clamp-2 break-words">{r.detail ?? "—"}</p>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination base="/admin/audit" sp={sp} page={page} pageSize={PAGE_SIZE} total={total} />
          </>
        )}
      </Card>
    </>
  );
}
