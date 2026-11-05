import "server-only";
import { and, asc, avg, count, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  carePlans,
  departments,
  doctorLeaves,
  doctorSchedules,
  doctors,
  feedback,
  notifications,
  patients,
  prescriptionItems,
  prescriptions,
  users,
  vitals,
} from "@/db/schema";

/** Appointments for one doctor on one date, with patient details and Rx code if written. */
export async function getDayAppointments(doctorId: number, date: string) {
  return db
    .select({
      id: appointments.id,
      code: appointments.code,
      date: appointments.date,
      time: appointments.time,
      mode: appointments.mode,
      status: appointments.status,
      reason: appointments.reason,
      fee: appointments.fee,
      tokenNo: appointments.tokenNo,
      checkedInAt: appointments.checkedInAt,
      startedAt: appointments.startedAt,
      completedAt: appointments.completedAt,
      patientId: patients.id,
      uhid: patients.uhid,
      dob: patients.dob,
      gender: patients.gender,
      allergies: patients.allergies,
      patientName: users.name,
      phone: users.phone,
      rxCode: prescriptions.code,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .leftJoin(prescriptions, eq(prescriptions.appointmentId, appointments.id))
    .where(and(eq(appointments.doctorId, doctorId), eq(appointments.date, date)))
    .orderBy(asc(appointments.time));
}
export type DayAppointment = Awaited<ReturnType<typeof getDayAppointments>>[number];

/** One appointment owned by this doctor, with full patient profile. */
export async function getDoctorAppointment(doctorId: number, code: string) {
  const [row] = await db
    .select({ appt: appointments, patient: patients, patientName: users.name, patientPhone: users.phone, patientEmail: users.email, patientUserId: users.id })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(eq(appointments.code, code), eq(appointments.doctorId, doctorId)))
    .limit(1);
  if (!row) return null;
  const [rx] = await db.select({ id: prescriptions.id, code: prescriptions.code }).from(prescriptions).where(eq(prescriptions.appointmentId, row.appt.id)).limit(1);
  return { ...row, rx: rx ?? null };
}

export async function unreadCount(userId: number) {
  const [r] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return Number(r?.n ?? 0);
}

/** Live bookings per date & mode over a range — for the "upcoming days" strip. */
export async function upcomingCounts(doctorId: number, from: string, to: string) {
  return db
    .select({ date: appointments.date, mode: appointments.mode, n: count() })
    .from(appointments)
    .where(and(eq(appointments.doctorId, doctorId), gte(appointments.date, from), lte(appointments.date, to), inArray(appointments.status, ["booked", "checked_in"])))
    .groupBy(appointments.date, appointments.mode);
}

export async function ratingSummary(doctorId: number) {
  const [agg] = await db.select({ avg: avg(feedback.rating), n: count() }).from(feedback).where(eq(feedback.doctorId, doctorId));
  const dist = await db.select({ rating: feedback.rating, n: count() }).from(feedback).where(eq(feedback.doctorId, doctorId)).groupBy(feedback.rating);
  return { average: agg?.avg ? Number(agg.avg) : 0, count: Number(agg?.n ?? 0), distribution: new Map(dist.map((d) => [d.rating, Number(d.n)])) };
}

export async function recentFeedback(doctorId: number, limit = 50) {
  return db
    .select({
      id: feedback.id,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
      patientName: users.name,
      uhid: patients.uhid,
      apptCode: appointments.code,
      apptDate: appointments.date,
      mode: appointments.mode,
    })
    .from(feedback)
    .innerJoin(patients, eq(patients.id, feedback.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .innerJoin(appointments, eq(appointments.id, feedback.appointmentId))
    .where(eq(feedback.doctorId, doctorId))
    .orderBy(desc(feedback.createdAt))
    .limit(limit);
}

/** Completed consultations grouped by date and mode, for earnings. */
export async function earningsByDay(doctorId: number, from: string, to: string) {
  return db
    .select({ date: appointments.date, mode: appointments.mode, n: count(), revenue: sql<number>`coalesce(sum(${appointments.fee}), 0)` })
    .from(appointments)
    .where(and(eq(appointments.doctorId, doctorId), eq(appointments.status, "completed"), gte(appointments.date, from), lte(appointments.date, to)))
    .groupBy(appointments.date, appointments.mode)
    .orderBy(asc(appointments.date));
}

/** Patients this doctor has an appointment history with. */
export async function listDoctorPatients(doctorId: number, q: string, today: string) {
  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const search = term
    ? or(
        sql`lower(${users.name}) like ${"%" + term + "%"}`,
        sql`lower(${patients.uhid}) like ${"%" + term + "%"}`,
        digits.length >= 4 ? sql`replace(${users.phone}, ' ', '') like ${"%" + digits + "%"}` : sql`0`,
      )
    : undefined;
  return db
    .select({
      id: patients.id,
      uhid: patients.uhid,
      name: users.name,
      phone: users.phone,
      dob: patients.dob,
      gender: patients.gender,
      bloodGroup: patients.bloodGroup,
      chronicConditions: patients.chronicConditions,
      allergies: patients.allergies,
      visits: sql<number>`sum(case when ${appointments.status} = 'completed' then 1 else 0 end)`,
      lastVisit: sql<string | null>`max(case when ${appointments.status} = 'completed' then ${appointments.date} end)`,
      nextVisit: sql<string | null>`min(case when ${appointments.date} >= ${today} and ${appointments.status} in ('booked','checked_in') then ${appointments.date} end)`,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(eq(appointments.doctorId, doctorId), ne(appointments.status, "cancelled"), search))
    .groupBy(patients.id)
    .orderBy(desc(sql`max(${appointments.date})`))
    .limit(300);
}

export async function doctorHasPatient(doctorId: number, patientId: number) {
  const [r] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.doctorId, doctorId), eq(appointments.patientId, patientId)))
    .limit(1);
  return !!r;
}

export async function getPatientByUhid(uhid: string) {
  const [row] = await db
    .select({ patient: patients, name: users.name, phone: users.phone, email: users.email, userId: users.id })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.uhid, uhid))
    .limit(1);
  return row ?? null;
}

export async function patientVitals(patientId: number, limit = 20) {
  return db.select().from(vitals).where(eq(vitals.patientId, patientId)).orderBy(desc(vitals.recordedAt)).limit(limit);
}

/** All prescriptions of a patient (any doctor) — newest first. */
export async function patientPrescriptions(patientId: number, limit = 50) {
  const rows = await db
    .select({
      id: prescriptions.id,
      code: prescriptions.code,
      diagnosis: prescriptions.diagnosis,
      createdAt: prescriptions.createdAt,
      followUpDate: prescriptions.followUpDate,
      doctorId: prescriptions.doctorId,
      doctorName: users.name,
      departmentName: departments.name,
    })
    .from(prescriptions)
    .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .where(eq(prescriptions.patientId, patientId))
    .orderBy(desc(prescriptions.createdAt))
    .limit(limit);
  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await db
        .select({ rxId: prescriptionItems.prescriptionId, name: prescriptionItems.medicineName, frequency: prescriptionItems.frequency, days: prescriptionItems.durationDays })
        .from(prescriptionItems)
        .where(inArray(prescriptionItems.prescriptionId, ids))
    : [];
  const byRx = new Map<number, typeof items>();
  for (const i of items) byRx.set(i.rxId, [...(byRx.get(i.rxId) ?? []), i]);
  return rows.map((r) => ({ ...r, items: byRx.get(r.id) ?? [] }));
}

/** Last prescription this doctor wrote for this patient, with items (for "repeat medicines"). */
export async function lastPrescriptionItems(doctorId: number, patientId: number) {
  const [rx] = await db
    .select({ id: prescriptions.id, code: prescriptions.code, createdAt: prescriptions.createdAt, diagnosis: prescriptions.diagnosis })
    .from(prescriptions)
    .where(and(eq(prescriptions.doctorId, doctorId), eq(prescriptions.patientId, patientId)))
    .orderBy(desc(prescriptions.createdAt))
    .limit(1);
  if (!rx) return null;
  const items = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, rx.id)).orderBy(prescriptionItems.id);
  return { ...rx, items };
}

export async function latestCarePlan(patientId: number) {
  const [row] = await db
    .select({ plan: carePlans, doctorName: users.name, rxCode: prescriptions.code })
    .from(carePlans)
    .innerJoin(prescriptions, eq(prescriptions.id, carePlans.prescriptionId))
    .innerJoin(doctors, eq(doctors.id, carePlans.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(carePlans.patientId, patientId))
    .orderBy(desc(carePlans.createdAt))
    .limit(1);
  return row ?? null;
}

/** Appointment history between this doctor and a patient. */
export async function patientAppointmentsWithDoctor(doctorId: number, patientId: number) {
  return db
    .select({
      code: appointments.code,
      date: appointments.date,
      time: appointments.time,
      mode: appointments.mode,
      status: appointments.status,
      reason: appointments.reason,
      rxCode: prescriptions.code,
    })
    .from(appointments)
    .leftJoin(prescriptions, eq(prescriptions.appointmentId, appointments.id))
    .where(and(eq(appointments.doctorId, doctorId), eq(appointments.patientId, patientId)))
    .orderBy(desc(appointments.date), desc(appointments.time));
}

/** This doctor's prescriptions with patient names, newest first. */
export async function doctorPrescriptions(doctorId: number, q: string, limit: number, offset: number) {
  const term = q.trim().toLowerCase();
  const search = term
    ? or(
        sql`lower(${users.name}) like ${"%" + term + "%"}`,
        sql`lower(${patients.uhid}) like ${"%" + term + "%"}`,
        sql`lower(${prescriptions.code}) like ${"%" + term + "%"}`,
        sql`lower(${prescriptions.diagnosis}) like ${"%" + term + "%"}`,
      )
    : undefined;
  const where = and(eq(prescriptions.doctorId, doctorId), search);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: prescriptions.id,
        code: prescriptions.code,
        diagnosis: prescriptions.diagnosis,
        createdAt: prescriptions.createdAt,
        followUpDate: prescriptions.followUpDate,
        patientName: users.name,
        uhid: patients.uhid,
        items: sql<number>`(select count(*) from ${prescriptionItems} where ${prescriptionItems.prescriptionId} = ${prescriptions.id})`,
      })
      .from(prescriptions)
      .innerJoin(patients, eq(patients.id, prescriptions.patientId))
      .innerJoin(users, eq(users.id, patients.userId))
      .where(where)
      .orderBy(desc(prescriptions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ n: count() })
      .from(prescriptions)
      .innerJoin(patients, eq(patients.id, prescriptions.patientId))
      .innerJoin(users, eq(users.id, patients.userId))
      .where(where),
  ]);
  return { rows, total: Number(total?.n ?? 0) };
}

export async function doctorScheduleData(doctorId: number, from: string) {
  const [blocks, leaves] = await Promise.all([
    db.select().from(doctorSchedules).where(eq(doctorSchedules.doctorId, doctorId)).orderBy(asc(doctorSchedules.weekday), asc(doctorSchedules.startTime)),
    db.select().from(doctorLeaves).where(and(eq(doctorLeaves.doctorId, doctorId), gte(doctorLeaves.date, from))).orderBy(asc(doctorLeaves.date)),
  ]);
  return { blocks, leaves };
}

export async function doctorWithDepartment(doctorId: number) {
  const [row] = await db
    .select({ doctor: doctors, departmentName: departments.name })
    .from(doctors)
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .where(eq(doctors.id, doctorId));
  return row;
}
