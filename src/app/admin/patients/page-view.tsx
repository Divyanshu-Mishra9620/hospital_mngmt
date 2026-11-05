"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { and, count, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { UserRound } from "lucide-react";
import { db } from "@/db";
import { patients, users } from "@/db/schema";
import { FilterBar, FilterSearch, FilterSelect, Pagination } from "@/components/admin/list-tools";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { pageOf, str } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { ageFrom, fmtDate, fmtNumber, genderLabel } from "@/lib/format";

const PAGE_SIZE = 25;

async function __render({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = str(sp.q).toLowerCase();
  const gender = str(sp.gender);
  const state = str(sp.state);
  const page = pageOf(sp.page);

  const conds: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    const digits = q.replace(/\D/g, "");
    conds.push(
      or(
        sql`lower(${users.name}) like ${like}`,
        sql`lower(${patients.uhid}) like ${like}`,
        sql`lower(${users.email}) like ${like}`,
        digits.length >= 4 ? sql`replace(${users.phone}, ' ', '') like ${"%" + digits + "%"}` : sql`0`,
      )!,
    );
  }
  if (gender === "female" || gender === "male" || gender === "other") conds.push(eq(patients.gender, gender));
  if (state === "active") conds.push(eq(users.active, true));
  if (state === "inactive") conds.push(eq(users.active, false));
  const where = conds.length ? and(...conds) : undefined;

  const visits = sql<number>`(select count(*) from appointments a where a.patient_id = ${patients.id} and a.status <> 'cancelled')`;
  const lastVisit = sql<string | null>`(select max(a.date) from appointments a where a.patient_id = ${patients.id} and a.status = 'completed')`;
  const admitted = sql<number>`(select count(*) from admissions ad where ad.patient_id = ${patients.id} and ad.discharged_at is null)`;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: patients.id,
        uhid: patients.uhid,
        name: users.name,
        phone: users.phone,
        email: users.email,
        active: users.active,
        dob: patients.dob,
        gender: patients.gender,
        city: patients.city,
        bloodGroup: patients.bloodGroup,
        createdAt: patients.createdAt,
        visits,
        lastVisit,
        admitted,
      })
      .from(patients)
      .innerJoin(users, eq(users.id, patients.userId))
      .where(where)
      .orderBy(desc(patients.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(patients).innerJoin(users, eq(users.id, patients.userId)).where(where),
  ]);

  return (
    <>
      <PageHeader title="Patients" description={`${fmtNumber(total)} patient records${q ? ` matching “${str(sp.q)}”` : ""}`} />
      <FilterBar action="/admin/patients" resetHref="/admin/patients">
        <FilterSearch defaultValue={str(sp.q)} placeholder="Name, UHID, mobile or email" />
        <FilterSelect
          name="gender"
          label="Gender"
          defaultValue={gender}
          options={[
            { value: "", label: "All" },
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
            { value: "other", label: "Other" },
          ]}
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
          <EmptyState icon={<UserRound />} title="No patients found" description="Check the spelling or search by UHID / mobile number." />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Patient</Th>
                  <Th>Age / Sex</Th>
                  <Th>Contact</Th>
                  <Th>City</Th>
                  <Th className="text-right">Visits</Th>
                  <Th>Last visit</Th>
                  <Th>Registered</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-surface/50">
                    <Td>
                      <Link href={`/admin/patients/${p.uhid}`} className="flex items-center gap-2.5">
                        <Avatar name={p.name} size="sm" color="#46638f" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink-900 hover:text-brand-700">{p.name}</span>
                          <span className="tabular block text-xs text-ink-500">
                            {p.uhid}
                            {p.bloodGroup ? ` · ${p.bloodGroup}` : ""}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {ageFrom(p.dob) ?? "—"} y · {genderLabel(p.gender)}
                    </Td>
                    <Td>
                      <p className="tabular whitespace-nowrap">{p.phone ?? "—"}</p>
                      <p className="max-w-[12rem] truncate text-xs text-ink-500">{p.email}</p>
                    </Td>
                    <Td>{p.city ?? "—"}</Td>
                    <Td className="tabular text-right">{p.visits}</Td>
                    <Td className="whitespace-nowrap">{p.lastVisit ? fmtDate(p.lastVisit) : "—"}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(p.createdAt)}</Td>
                    <Td className="whitespace-nowrap text-right">
                      {p.admitted > 0 && (
                        <Badge tone="info" className="mr-1.5">
                          In-patient
                        </Badge>
                      )}
                      {!p.active && (
                        <Badge tone="neutral" className="mr-1.5">
                          Inactive
                        </Badge>
                      )}
                      <Link href={`/admin/patients/${p.uhid}`} className="text-xs font-semibold text-brand-700 hover:underline">
                        Open →
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination base="/admin/patients" sp={sp} page={page} pageSize={PAGE_SIZE} total={total} />
          </>
        )}
      </Card>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
