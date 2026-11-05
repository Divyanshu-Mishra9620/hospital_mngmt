import "server-only";
import { and, asc, count, desc, eq, gte, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { APPOINTMENT_STATUSES, appointments, departments, doctors, patients, users } from "@/db/schema";

export const patientUser = alias(users, "patient_user");
export const doctorUser = alias(users, "doctor_user");

export type ApptFilters = {
  from: string;
  to: string;
  doctorId?: number;
  departmentId?: number;
  mode?: "in_person" | "video";
  status?: (typeof APPOINTMENT_STATUSES)[number];
  q?: string;
  patientId?: number;
};

export function apptConditions(f: ApptFilters) {
  const c: SQL[] = [gte(appointments.date, f.from), lte(appointments.date, f.to)];
  if (f.doctorId) c.push(eq(appointments.doctorId, f.doctorId));
  if (f.departmentId) c.push(eq(doctors.departmentId, f.departmentId));
  if (f.mode) c.push(eq(appointments.mode, f.mode));
  if (f.status) c.push(eq(appointments.status, f.status));
  if (f.patientId) c.push(eq(appointments.patientId, f.patientId));
  if (f.q) {
    const like = `%${f.q.toLowerCase()}%`;
    c.push(
      or(
        sql`lower(${patientUser.name}) like ${like}`,
        sql`lower(${patients.uhid}) like ${like}`,
        sql`lower(${appointments.code}) like ${like}`,
        sql`lower(${doctorUser.name}) like ${like}`,
      )!,
    );
  }
  return and(...c)!;
}

function base() {
  return db
    .select({
      id: appointments.id,
      code: appointments.code,
      date: appointments.date,
      time: appointments.time,
      mode: appointments.mode,
      status: appointments.status,
      fee: appointments.fee,
      paymentStatus: appointments.paymentStatus,
      tokenNo: appointments.tokenNo,
      reason: appointments.reason,
      patientName: patientUser.name,
      uhid: patients.uhid,
      doctorName: doctorUser.name,
      doctorCode: doctors.code,
      doctorColor: doctors.avatarColor,
      department: departments.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(patientUser, eq(patientUser.id, patients.userId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(doctorUser, eq(doctorUser.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId));
}

export async function searchAppointments(f: ApptFilters, page: number, pageSize: number, order: "asc" | "desc" = "asc") {
  const where = apptConditions(f);
  const [rows, [{ total }], summary] = await Promise.all([
    base()
      .where(where)
      .orderBy(...(order === "asc" ? [asc(appointments.date), asc(appointments.time)] : [desc(appointments.date), desc(appointments.time)]))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(patientUser, eq(patientUser.id, patients.userId))
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .innerJoin(doctorUser, eq(doctorUser.id, doctors.userId))
      .where(where),
    db
      .select({
        status: appointments.status,
        mode: appointments.mode,
        n: count(),
        fees: sql<number>`coalesce(sum(${appointments.fee}), 0)`,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(patientUser, eq(patientUser.id, patients.userId))
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .innerJoin(doctorUser, eq(doctorUser.id, doctors.userId))
      .where(where)
      .groupBy(appointments.status, appointments.mode),
  ]);
  const s = { total: 0, live: 0, completed: 0, cancelled: 0, noShow: 0, video: 0, inPerson: 0, fees: 0 };
  for (const r of summary) {
    s.total += r.n;
    if (r.status === "cancelled") s.cancelled += r.n;
    else {
      s.fees += Number(r.fees);
      if (r.mode === "video") s.video += r.n;
      else s.inPerson += r.n;
    }
    if (r.status === "completed") s.completed += r.n;
    if (r.status === "no_show") s.noShow += r.n;
    if (["booked", "checked_in", "in_consult"].includes(r.status)) s.live += r.n;
  }
  return { rows, total, summary: s };
}

export async function recentAppointmentsForPatient(patientId: number, limit = 50) {
  return base().where(eq(appointments.patientId, patientId)).orderBy(desc(appointments.date), desc(appointments.time)).limit(limit);
}

export async function getAppointmentRow(code: string) {
  const [row] = await base().where(eq(appointments.code, code)).limit(1);
  return row ?? null;
}
