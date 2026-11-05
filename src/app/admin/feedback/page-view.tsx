"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { avg, count, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Star } from "lucide-react";
import { db } from "@/db";
import { appointments, departments, doctors, feedback, patients, users } from "@/db/schema";
import { FilterBar, FilterSelect, Pagination } from "@/components/admin/list-tools";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, StatCard, Stars, TableWrap, Td, Th } from "@/components/ui/misc";
import { pageOf, str } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDate } from "@/lib/format";
import { ModeBadge } from "@/components/status";

const PAGE_SIZE = 20;

async function __render({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const rating = Number(str(sp.rating)) || 0;
  const docUser = alias(users, "doc_user");
  const patUser = alias(users, "pat_user");
  const where = rating ? eq(feedback.rating, rating) : undefined;

  const [byDoctor, [overall], dist, rows, [{ total }]] = await Promise.all([
    db
      .select({ id: doctors.id, code: doctors.code, name: docUser.name, color: doctors.avatarColor, dept: departments.name, rating: avg(feedback.rating), n: count() })
      .from(feedback)
      .innerJoin(doctors, eq(doctors.id, feedback.doctorId))
      .innerJoin(docUser, eq(docUser.id, doctors.userId))
      .innerJoin(departments, eq(departments.id, doctors.departmentId))
      .groupBy(doctors.id)
      .orderBy(desc(avg(feedback.rating)), desc(count())),
    db.select({ rating: avg(feedback.rating), n: count(), withComment: sql<number>`sum(case when ${feedback.comment} is not null then 1 else 0 end)` }).from(feedback),
    db.select({ rating: feedback.rating, n: count() }).from(feedback).groupBy(feedback.rating),
    db
      .select({ f: feedback, patient: patUser.name, uhid: patients.uhid, doctor: docUser.name, mode: appointments.mode, apptCode: appointments.code })
      .from(feedback)
      .innerJoin(patients, eq(patients.id, feedback.patientId))
      .innerJoin(patUser, eq(patUser.id, patients.userId))
      .innerJoin(doctors, eq(doctors.id, feedback.doctorId))
      .innerJoin(docUser, eq(docUser.id, doctors.userId))
      .innerJoin(appointments, eq(appointments.id, feedback.appointmentId))
      .where(where)
      .orderBy(desc(feedback.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(feedback).where(where),
  ]);
  const totalReviews = overall?.n ?? 0;
  const distMap = new Map(dist.map((d) => [d.rating, d.n]));
  const promoters = (distMap.get(5) ?? 0) + (distMap.get(4) ?? 0);

  return (
    <>
      <PageHeader title="Patient reviews" description="Ratings patients leave after completed consultations." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Average rating" value={totalReviews ? Number(overall.rating).toFixed(2) : "—"} sub={`${totalReviews} reviews`} icon={<Star />} tone="accent" />
        <StatCard label="Rated 4★ or 5★" value={totalReviews ? `${Math.round((promoters / totalReviews) * 100)}%` : "—"} tone="success" />
        <StatCard label="Rated 3★ or below" value={totalReviews ? totalReviews - promoters : 0} tone="warning" />
        <StatCard label="With written comments" value={Number(overall?.withComment ?? 0)} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader title="Ratings by doctor" />
          <TableWrap>
            <thead>
              <tr>
                <Th>Doctor</Th>
                <Th>Rating</Th>
                <Th className="text-right">Reviews</Th>
              </tr>
            </thead>
            <tbody>
              {byDoctor.map((d) => (
                <tr key={d.id} className="hover:bg-surface/50">
                  <Td>
                    <Link href={`/admin/doctors/${d.code}`} className="flex items-center gap-2">
                      <Avatar name={d.name} color={d.color} size="xs" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink-900">{d.name}</span>
                        <span className="block truncate text-xs text-ink-500">{d.dept}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Stars value={Number(d.rating)} />
                      <span className="tabular text-xs font-semibold text-ink-700">{Number(d.rating).toFixed(1)}</span>
                    </span>
                  </Td>
                  <Td className="tabular text-right">{d.n}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>

        <div>
          <FilterBar action="/admin/feedback" resetHref="/admin/feedback">
            <FilterSelect
              name="rating"
              label="Rating"
              defaultValue={rating ? String(rating) : ""}
              options={[{ value: "", label: "All ratings" }, ...[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r} star${r > 1 ? "s" : ""} (${distMap.get(r) ?? 0})` }))]}
            />
          </FilterBar>
          <Card>
            {rows.length === 0 ? (
              <EmptyState icon={<Star />} title="No reviews" />
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {rows.map((r) => (
                    <li key={r.f.id} className="px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Stars value={r.f.rating} />
                          <ModeBadge mode={r.mode} />
                        </span>
                        <span className="text-xs text-ink-400">{fmtDate(r.f.createdAt)}</span>
                      </div>
                      {r.f.comment ? <p className="mt-1.5 text-sm text-ink-800">“{r.f.comment}”</p> : <p className="mt-1.5 text-sm italic text-ink-400">No comment</p>}
                      <p className="mt-1 text-xs text-ink-500">
                        <Link href={`/admin/patients/${r.uhid}`} className="hover:text-brand-700">
                          {r.patient}
                        </Link>{" "}
                        about {r.doctor} ·{" "}
                        <Link href={`/admin/appointments/${r.apptCode}`} className="tabular hover:text-brand-700">
                          {r.apptCode}
                        </Link>
                      </p>
                    </li>
                  ))}
                </ul>
                <Pagination base="/admin/feedback" sp={sp} page={page} pageSize={PAGE_SIZE} total={total} />
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
