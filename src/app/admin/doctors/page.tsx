import Link from "next/link";
import { Plus, Stethoscope, Video } from "lucide-react";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/admin/list-tools";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, Stars, TableWrap, Td, Th } from "@/components/ui/misc";
import { adminToggleUser } from "@/lib/actions/admin";
import { listDoctorsWithStats } from "@/lib/admin/doctors";
import { listDepartmentsBasic, str } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { inr } from "@/lib/format";

export const metadata = { title: "Doctors" };

export default async function AdminDoctors({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = str(sp.q).toLowerCase();
  const dept = Number(str(sp.dept)) || 0;
  const state = str(sp.state);
  const [all, depts] = await Promise.all([listDoctorsWithStats(), listDepartmentsBasic()]);
  const rows = all.filter(
    (d) =>
      (!q || d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q) || d.department.toLowerCase().includes(q)) &&
      (!dept || d.departmentId === dept) &&
      (!state || (state === "active" ? d.active : !d.active)),
  );
  const active = all.filter((d) => d.active).length;

  return (
    <>
      <PageHeader
        title="Doctors"
        description={`${all.length} doctors · ${active} active · ${all.filter((d) => d.videoEnabled).length} offer video consultations`}
        actions={
          <LinkButton href="/admin/doctors/new" size="sm">
            <Plus aria-hidden /> Add doctor
          </LinkButton>
        }
      />
      <FilterBar action="/admin/doctors" resetHref="/admin/doctors">
        <FilterSearch defaultValue={str(sp.q)} placeholder="Name, DOC code or department" />
        <FilterSelect
          name="dept"
          label="Department"
          defaultValue={dept ? String(dept) : ""}
          options={[{ value: "", label: "All departments" }, ...depts.map((d) => ({ value: String(d.id), label: d.name }))]}
          className="max-w-[15rem]"
        />
        <FilterSelect
          name="state"
          label="Account"
          defaultValue={state}
          options={[
            { value: "", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </FilterBar>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<Stethoscope />} title="No doctors match" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Doctor</Th>
                <Th>Department</Th>
                <Th className="text-right">In-person</Th>
                <Th className="text-right">Video</Th>
                <Th>Rating</Th>
                <Th className="text-right">Today</Th>
                <Th className="text-right">Consults · 30d</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className={d.active ? "hover:bg-surface/50" : "bg-surface/40 text-ink-500"}>
                  <Td>
                    <Link href={`/admin/doctors/${d.code}`} className="flex items-center gap-2.5">
                      <Avatar name={d.name} color={d.color} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink-900 hover:text-brand-700">{d.name}</span>
                        <span className="tabular block truncate text-xs text-ink-500">
                          {d.code} · {d.experienceYears} yrs · {d.slotMinutes}-min slots
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="max-w-[14rem]">
                    <p className="truncate">{d.department}</p>
                    <p className="truncate text-xs text-ink-500">{d.designation}</p>
                  </Td>
                  <Td className="tabular text-right font-medium text-ink-900">{inr(d.inPersonFee)}</Td>
                  <Td className="tabular text-right">
                    {d.videoEnabled ? (
                      <span className="inline-flex items-center gap-1 font-medium text-ink-900">
                        <Video className="size-3.5 text-violet-700" aria-hidden />
                        {inr(d.videoFee)}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-400">Not offered</span>
                    )}
                  </Td>
                  <Td>
                    {d.reviews ? (
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <Stars value={d.rating} />
                        <span className="tabular text-xs text-ink-500">
                          {d.rating.toFixed(1)} ({d.reviews})
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-400">No reviews</span>
                    )}
                  </Td>
                  <Td className="tabular text-right">{d.today}</Td>
                  <Td className="tabular text-right">{d.completed30}</Td>
                  <Td>{d.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <form action={adminToggleUser} className="inline">
                      <input type="hidden" name="userId" value={d.userId} />
                      <input type="hidden" name="active" value={d.active ? "0" : "1"} />
                      <Button type="submit" variant="ghost" size="xs">
                        {d.active ? "Deactivate" : "Activate"}
                      </Button>
                    </form>
                    <LinkButton href={`/admin/doctors/${d.code}`} variant="outline" size="xs" className="ml-1">
                      Manage
                    </LinkButton>
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
