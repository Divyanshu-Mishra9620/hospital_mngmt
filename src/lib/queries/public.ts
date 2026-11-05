import "server-only";
import { and, asc, avg, count, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { departments, doctorSchedules, doctors, feedback, healthPackages, patients, users } from "@/db/schema";

export async function publicDepartments() {
  const rows = await db.select().from(departments).where(eq(departments.active, true)).orderBy(asc(departments.sortOrder));
  const counts = await db
    .select({ id: doctors.departmentId, n: count() })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(and(eq(doctors.active, true), eq(users.active, true)))
    .groupBy(doctors.departmentId);
  const byId = new Map(counts.map((c) => [c.id, c.n]));
  return rows.map((d) => ({ ...d, doctorCount: byId.get(d.id) ?? 0 }));
}

export async function publicDoctors(filter: { departmentId?: number } = {}) {
  const conds = [eq(doctors.active, true), eq(users.active, true)];
  if (filter.departmentId) conds.push(eq(doctors.departmentId, filter.departmentId));
  const rows = await db
    .select({ doctor: doctors, name: users.name, deptName: departments.name, deptSlug: departments.slug, deptSort: departments.sortOrder })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .where(and(...conds))
    .orderBy(asc(departments.sortOrder), desc(doctors.experienceYears));
  const ratings = await db.select({ id: feedback.doctorId, avg: avg(feedback.rating), n: count() }).from(feedback).groupBy(feedback.doctorId);
  const r = new Map(ratings.map((x) => [x.id, { avg: Number(x.avg ?? 0), n: x.n }]));
  return rows.map((d) => ({ ...d, rating: r.get(d.doctor.id) ?? { avg: 0, n: 0 } }));
}

export type PublicDoctor = Awaited<ReturnType<typeof publicDoctors>>[number];

export async function publicDoctor(code: string) {
  const [row] = await db
    .select({ doctor: doctors, name: users.name, dept: departments })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .where(and(eq(doctors.code, code), eq(doctors.active, true), eq(users.active, true)));
  if (!row) return null;
  const [schedule, [rating], reviews] = await Promise.all([
    db.select().from(doctorSchedules).where(eq(doctorSchedules.doctorId, row.doctor.id)).orderBy(asc(doctorSchedules.weekday), asc(doctorSchedules.startTime)),
    db.select({ avg: avg(feedback.rating), n: count() }).from(feedback).where(eq(feedback.doctorId, row.doctor.id)),
    db
      .select({ rating: feedback.rating, comment: feedback.comment, createdAt: feedback.createdAt, name: users.name })
      .from(feedback)
      .innerJoin(patients, eq(patients.id, feedback.patientId))
      .innerJoin(users, eq(users.id, patients.userId))
      .where(and(eq(feedback.doctorId, row.doctor.id), isNotNull(feedback.comment)))
      .orderBy(desc(feedback.createdAt))
      .limit(6),
  ]);
  return { ...row, schedule, rating: { avg: Number(rating?.avg ?? 0), n: rating?.n ?? 0 }, reviews };
}

/** Recent 5★/4★ comments for the home page. Names shortened for privacy. */
export async function testimonials(limit = 6) {
  const rows = await db
    .select({ rating: feedback.rating, comment: feedback.comment, name: users.name, doctorId: feedback.doctorId })
    .from(feedback)
    .innerJoin(patients, eq(patients.id, feedback.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(isNotNull(feedback.comment)))
    .orderBy(desc(feedback.rating), desc(feedback.createdAt))
    .limit(60);
  const docs = await db.select({ id: doctors.id, name: users.name, dept: departments.name }).from(doctors).innerJoin(users, eq(users.id, doctors.userId)).innerJoin(departments, eq(departments.id, doctors.departmentId));
  const docBy = new Map(docs.map((d) => [d.id, d]));
  const seen = new Set<string>();
  const out: { quote: string; name: string; rating: number; doctor: string; dept: string }[] = [];
  for (const r of rows) {
    if (!r.comment || seen.has(r.comment) || r.rating < 4) continue;
    seen.add(r.comment);
    const [first, ...rest] = r.name.split(" ");
    const d = docBy.get(r.doctorId);
    out.push({ quote: r.comment, name: `${first} ${rest.at(-1)?.[0] ?? ""}.`, rating: r.rating, doctor: d?.name ?? "", dept: d?.dept ?? "" });
    if (out.length >= limit) break;
  }
  return out;
}

export async function publicPackages() {
  return db.select().from(healthPackages).where(eq(healthPackages.active, true)).orderBy(asc(healthPackages.price));
}
