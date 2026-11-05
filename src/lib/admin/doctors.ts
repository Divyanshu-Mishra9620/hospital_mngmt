import "server-only";
import { and, avg, count, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, departments, doctors, feedback, users } from "@/db/schema";
import { addDays, todayISO } from "@/lib/time";

/** All doctors with department, account state, rating and load figures. */
export async function listDoctorsWithStats() {
  const today = todayISO();
  const from30 = addDays(today, -29);
  const [rows, ratings, loads] = await Promise.all([
    db
      .select({
        id: doctors.id,
        userId: doctors.userId,
        code: doctors.code,
        name: users.name,
        email: users.email,
        active: users.active,
        color: doctors.avatarColor,
        designation: doctors.designation,
        department: departments.name,
        departmentId: doctors.departmentId,
        inPersonFee: doctors.inPersonFee,
        videoFee: doctors.videoFee,
        slotMinutes: doctors.slotMinutes,
        videoEnabled: doctors.videoEnabled,
        experienceYears: doctors.experienceYears,
      })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .innerJoin(departments, eq(departments.id, doctors.departmentId))
      .orderBy(departments.sortOrder, users.name),
    db.select({ doctorId: feedback.doctorId, rating: avg(feedback.rating), n: count() }).from(feedback).groupBy(feedback.doctorId),
    db
      .select({
        doctorId: appointments.doctorId,
        today: sql<number>`sum(case when ${appointments.date} = ${today} then 1 else 0 end)`,
        completed30: sql<number>`sum(case when ${appointments.status} = 'completed' and ${appointments.date} >= ${from30} then 1 else 0 end)`,
        upcoming: sql<number>`sum(case when ${appointments.date} > ${today} and ${appointments.status} = 'booked' then 1 else 0 end)`,
      })
      .from(appointments)
      .where(and(ne(appointments.status, "cancelled"), gte(appointments.date, from30)))
      .groupBy(appointments.doctorId),
  ]);
  const r = new Map(ratings.map((x) => [x.doctorId, { rating: Number(x.rating ?? 0), reviews: x.n }]));
  const l = new Map(loads.map((x) => [x.doctorId, { today: Number(x.today), completed30: Number(x.completed30), upcoming: Number(x.upcoming) }]));
  return rows.map((d) => ({
    ...d,
    rating: r.get(d.id)?.rating ?? 0,
    reviews: r.get(d.id)?.reviews ?? 0,
    today: l.get(d.id)?.today ?? 0,
    completed30: l.get(d.id)?.completed30 ?? 0,
    upcoming: l.get(d.id)?.upcoming ?? 0,
  }));
}

/** Lifetime + 30 day numbers for one doctor. */
export async function doctorStats(doctorId: number) {
  const today = todayISO();
  const from30 = addDays(today, -29);
  const [[life], [last30], [rating]] = await Promise.all([
    db
      .select({
        consults: sql<number>`sum(case when ${appointments.status} = 'completed' then 1 else 0 end)`,
        revenue: sql<number>`coalesce(sum(case when ${appointments.status} <> 'cancelled' and ${appointments.paymentStatus} = 'paid' then ${appointments.fee} end), 0)`,
        video: sql<number>`sum(case when ${appointments.status} = 'completed' and ${appointments.mode} = 'video' then 1 else 0 end)`,
        noShows: sql<number>`sum(case when ${appointments.status} = 'no_show' then 1 else 0 end)`,
      })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), lte(appointments.date, today))),
    db
      .select({
        consults: sql<number>`sum(case when ${appointments.status} = 'completed' then 1 else 0 end)`,
        revenue: sql<number>`coalesce(sum(case when ${appointments.status} <> 'cancelled' and ${appointments.paymentStatus} = 'paid' then ${appointments.fee} end), 0)`,
      })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), gte(appointments.date, from30), lte(appointments.date, today))),
    db.select({ rating: avg(feedback.rating), n: count() }).from(feedback).where(eq(feedback.doctorId, doctorId)),
  ]);
  return {
    consults: Number(life?.consults ?? 0),
    revenue: Number(life?.revenue ?? 0),
    video: Number(life?.video ?? 0),
    noShows: Number(life?.noShows ?? 0),
    consults30: Number(last30?.consults ?? 0),
    revenue30: Number(last30?.revenue ?? 0),
    rating: Number(rating?.rating ?? 0),
    reviews: rating?.n ?? 0,
  };
}

