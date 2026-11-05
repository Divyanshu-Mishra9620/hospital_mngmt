import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, cartItems, departments, doctors, feedback, medicines, notifications, users, vitals } from "@/db/schema";

export async function patientCounts(userId: number, patientId: number) {
  const [[n], [c]] = await Promise.all([
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, false))),
    db.select({ n: count() }).from(cartItems).where(eq(cartItems.patientId, patientId)),
  ]);
  return { unread: n?.n ?? 0, cart: c?.n ?? 0 };
}

const apptSelect = {
  id: appointments.id,
  code: appointments.code,
  date: appointments.date,
  time: appointments.time,
  mode: appointments.mode,
  status: appointments.status,
  reason: appointments.reason,
  fee: appointments.fee,
  paymentStatus: appointments.paymentStatus,
  tokenNo: appointments.tokenNo,
  cancelReason: appointments.cancelReason,
  createdAt: appointments.createdAt,
  completedAt: appointments.completedAt,
  doctorId: doctors.id,
  doctorCode: doctors.code,
  doctorName: users.name,
  doctorDesignation: doctors.designation,
  doctorColor: doctors.avatarColor,
  doctorRoom: doctors.room,
  slotMinutes: doctors.slotMinutes,
  departmentName: departments.name,
  departmentLocation: departments.location,
};

export async function listPatientAppointments(patientId: number) {
  return db
    .select(apptSelect)
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .where(eq(appointments.patientId, patientId))
    .orderBy(desc(appointments.date), desc(appointments.time));
}

export async function getPatientAppointment(patientId: number, code: string) {
  const [row] = await db
    .select({ ...apptSelect, feedbackRating: feedback.rating, feedbackComment: feedback.comment })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .leftJoin(feedback, eq(feedback.appointmentId, appointments.id))
    .where(and(eq(appointments.patientId, patientId), eq(appointments.code, code)));
  return row ?? null;
}

export type PatientAppointment = Awaited<ReturnType<typeof listPatientAppointments>>[number];

export async function patientVitals(patientId: number) {
  return db.select().from(vitals).where(eq(vitals.patientId, patientId)).orderBy(desc(vitals.recordedAt));
}

export async function patientCart(patientId: number) {
  return db
    .select({ item: cartItems, med: medicines })
    .from(cartItems)
    .innerJoin(medicines, eq(medicines.id, cartItems.medicineId))
    .where(eq(cartItems.patientId, patientId))
    .orderBy(cartItems.addedAt);
}
