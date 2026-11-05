import { and, count, desc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  admissions,
  appointments,
  auditLogs,
  departments,
  doctors,
  enquiries,
  medicines,
  patients,
  payments,
  pharmacyOrders,
  users,
  wards,
} from "@/db/schema";
import { addDays, todayISO } from "@/lib/time";

/* ----------------------------------------------------------------- dates */

/** Start of an IST calendar day as a UTC ISO string (for comparing created_at). */
export function istStart(date: string) {
  return new Date(`${date}T00:00:00+05:30`).toISOString();
}

/** [from, to] IST dates → [startISO, endISOExclusive] */
export function istRange(from: string, to: string) {
  return [istStart(from), istStart(addDays(to, 1))] as const;
}

/** IST calendar date of a UTC ISO column, in SQL. */
export const istDateOf = (col: unknown) => sql<string>`date(${col}, '+330 minutes')`;

export function readRange(sp: Record<string, string | string[] | undefined>, defaultDays = 30) {
  const today = todayISO();
  const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  let from = isDate(sp.from) ? sp.from : addDays(today, -(defaultDays - 1));
  let to = isDate(sp.to) ? sp.to : today;
  if (from > to) [from, to] = [to, from];
  return { from, to, today };
}

export function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v.trim() : "";
}

export function pageOf(v: string | string[] | undefined) {
  const n = Number(typeof v === "string" ? v : 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/* ------------------------------------------------------------- dashboard */

export async function getDashboard() {
  const today = todayISO();
  const [todayStart, tomorrowStart] = istRange(today, today);
  const thirtyStart = istStart(addDays(today, -29));
  const weekStart = istStart(addDays(today, -6));

  const [
    apptToday,
    revenueRows,
    [{ patientsTotal }],
    [{ patientsNew }],
    [{ occupied }],
    [{ beds }],
    [{ lowStock }],
    [{ outOfStock }],
    [{ pendingOrders }],
    [{ newEnquiries }],
    trendRows,
    deptRows,
    boardRows,
    activity,
  ] = await Promise.all([
    db
      .select({ mode: appointments.mode, status: appointments.status, n: count() })
      .from(appointments)
      .where(eq(appointments.date, today))
      .groupBy(appointments.mode, appointments.status),
    db
      .select({
        purpose: payments.purpose,
        today: sql<number>`coalesce(sum(case when ${payments.createdAt} >= ${todayStart} and ${payments.createdAt} < ${tomorrowStart} then ${payments.amount} end), 0)`,
        last30: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(and(eq(payments.status, "success"), gte(payments.createdAt, thirtyStart)))
      .groupBy(payments.purpose),
    db.select({ patientsTotal: count() }).from(patients),
    db.select({ patientsNew: count() }).from(patients).where(gte(patients.createdAt, weekStart)),
    db.select({ occupied: count() }).from(admissions).where(isNull(admissions.dischargedAt)),
    db.select({ beds: sql<number>`coalesce(sum(${wards.totalBeds}), 0)` }).from(wards),
    db
      .select({ lowStock: count() })
      .from(medicines)
      .where(and(eq(medicines.active, true), sql`${medicines.stock} > 0`, sql`${medicines.stock} <= ${medicines.reorderLevel}`)),
    db.select({ outOfStock: count() }).from(medicines).where(and(eq(medicines.active, true), lte(medicines.stock, 0))),
    db
      .select({ pendingOrders: count() })
      .from(pharmacyOrders)
      .where(inArray(pharmacyOrders.status, ["placed", "processing", "ready", "out_for_delivery"])),
    db.select({ newEnquiries: count() }).from(enquiries).where(eq(enquiries.status, "new")),
    db
      .select({
        day: istDateOf(payments.createdAt),
        consultation: sql<number>`coalesce(sum(case when ${payments.purpose} = 'consultation' then ${payments.amount} end), 0)`,
        pharmacy: sql<number>`coalesce(sum(case when ${payments.purpose} in ('pharmacy_order','pharmacy_counter') then ${payments.amount} end), 0)`,
      })
      .from(payments)
      .where(and(eq(payments.status, "success"), gte(payments.createdAt, thirtyStart)))
      .groupBy(istDateOf(payments.createdAt)),
    db
      .select({ name: departments.name, n: count() })
      .from(appointments)
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .innerJoin(departments, eq(departments.id, doctors.departmentId))
      .where(and(gte(appointments.date, addDays(today, -29)), lte(appointments.date, today), ne(appointments.status, "cancelled")))
      .groupBy(departments.id)
      .orderBy(desc(count())),
    db
      .select({
        doctorId: doctors.id,
        code: doctors.code,
        name: users.name,
        color: doctors.avatarColor,
        room: doctors.room,
        department: departments.name,
        booked: sql<number>`sum(case when ${appointments.status} = 'booked' then 1 else 0 end)`,
        waiting: sql<number>`sum(case when ${appointments.status} = 'checked_in' then 1 else 0 end)`,
        inConsult: sql<number>`sum(case when ${appointments.status} = 'in_consult' then 1 else 0 end)`,
        completed: sql<number>`sum(case when ${appointments.status} = 'completed' then 1 else 0 end)`,
        noShow: sql<number>`sum(case when ${appointments.status} = 'no_show' then 1 else 0 end)`,
        video: sql<number>`sum(case when ${appointments.mode} = 'video' and ${appointments.status} <> 'cancelled' then 1 else 0 end)`,
        total: sql<number>`sum(case when ${appointments.status} <> 'cancelled' then 1 else 0 end)`,
      })
      .from(appointments)
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId))
      .innerJoin(departments, eq(departments.id, doctors.departmentId))
      .where(eq(appointments.date, today))
      .groupBy(doctors.id)
      .orderBy(users.name),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(10),
  ]);

  const appt = { total: 0, inPerson: 0, video: 0, completed: 0, cancelled: 0, waiting: 0 };
  for (const r of apptToday) {
    if (r.status === "cancelled") {
      appt.cancelled += r.n;
      continue;
    }
    appt.total += r.n;
    if (r.mode === "video") appt.video += r.n;
    else appt.inPerson += r.n;
    if (r.status === "completed") appt.completed += r.n;
    if (r.status === "checked_in") appt.waiting += r.n;
  }

  const rev = { opdToday: 0, opd30: 0, pharmacyToday: 0, pharmacy30: 0, packages30: 0, total30: 0 };
  for (const r of revenueRows) {
    const t = Number(r.today);
    const m = Number(r.last30);
    rev.total30 += m;
    if (r.purpose === "consultation") {
      rev.opdToday += t;
      rev.opd30 += m;
    } else if (r.purpose === "pharmacy_counter" || r.purpose === "pharmacy_order") {
      rev.pharmacyToday += t;
      rev.pharmacy30 += m;
    } else rev.packages30 += m;
  }

  const byDay = new Map(trendRows.map((r) => [r.day, r]));
  const trend = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(today, i - 29);
    const r = byDay.get(day);
    return { day, consultation: Math.round(Number(r?.consultation ?? 0)), pharmacy: Math.round(Number(r?.pharmacy ?? 0)) };
  });

  return {
    today,
    appt,
    rev,
    patientsTotal,
    patientsNew,
    occupancy: { occupied, beds: Number(beds), pct: Number(beds) ? Math.round((occupied / Number(beds)) * 100) : 0 },
    lowStock,
    outOfStock,
    pendingOrders,
    newEnquiries,
    trend,
    departments: deptRows,
    board: boardRows.map((b) => ({
      ...b,
      booked: Number(b.booked),
      waiting: Number(b.waiting),
      inConsult: Number(b.inConsult),
      completed: Number(b.completed),
      noShow: Number(b.noShow),
      video: Number(b.video),
      total: Number(b.total),
    })),
    activity,
  };
}

/* ---------------------------------------------------------------- lookups */

export async function listDepartmentsBasic() {
  return db.select({ id: departments.id, name: departments.name, slug: departments.slug }).from(departments).orderBy(departments.sortOrder);
}

export async function listDoctorsBasic() {
  return db
    .select({ id: doctors.id, code: doctors.code, name: users.name, departmentId: doctors.departmentId })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .orderBy(users.name);
}

/** Bed label used across the hospital (matches seeded data). */
export function bedLabel(wardName: string, n: number) {
  return `${wardName.split(" ")[0].slice(0, 3).toUpperCase()}-${String(n).padStart(2, "0")}`;
}

