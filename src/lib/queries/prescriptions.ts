import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appointments, carePlans, departments, doctors, patients, prescriptionItems, prescriptions, users } from "@/db/schema";
import { parseJSON } from "@/lib/format";
import type { Meals } from "@/lib/constants";
import { prescriptionSupplyStatus, suppliedQuantities } from "@/lib/pharmacy";

/**
 * Full prescription with items (incl. how much was already supplied), care
 * plan, doctor, department and patient. Shared by every portal.
 */
export async function getPrescription(where: { id?: number; code?: string }) {
  const cond = where.id != null ? eq(prescriptions.id, where.id) : eq(prescriptions.code, where.code ?? "");
  const [row] = await db
    .select({
      rx: prescriptions,
      doctorName: users.name,
      doctorCode: doctors.code,
      doctorDesignation: doctors.designation,
      doctorQualifications: doctors.qualifications,
      doctorRegistration: doctors.registrationNo,
      doctorColor: doctors.avatarColor,
      departmentName: departments.name,
      appointmentCode: appointments.code,
      appointmentMode: appointments.mode,
      appointmentDate: appointments.date,
    })
    .from(prescriptions)
    .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .leftJoin(appointments, eq(appointments.id, prescriptions.appointmentId))
    .where(cond)
    .limit(1);
  if (!row) return null;

  const [patientRow] = await db
    .select({ patient: patients, name: users.name, phone: users.phone, email: users.email })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, row.rx.patientId));

  const items = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, row.rx.id)).orderBy(prescriptionItems.id);
  const supplied = await suppliedQuantities(items.map((i) => i.id));
  const [plan] = await db.select().from(carePlans).where(eq(carePlans.prescriptionId, row.rx.id));
  const status = (await prescriptionSupplyStatus([row.rx.id])).get(row.rx.id) ?? "not_dispensed";

  return {
    ...row.rx,
    labTestList: parseJSON<string[]>(row.rx.labTests, []),
    doctor: {
      id: row.rx.doctorId,
      name: row.doctorName,
      code: row.doctorCode,
      designation: row.doctorDesignation,
      qualifications: row.doctorQualifications,
      registrationNo: row.doctorRegistration,
      color: row.doctorColor,
      department: row.departmentName,
    },
    appointment: row.appointmentCode ? { code: row.appointmentCode, mode: row.appointmentMode!, date: row.appointmentDate! } : null,
    patient: {
      ...patientRow.patient,
      name: patientRow.name,
      phone: patientRow.phone,
      email: patientRow.email,
    },
    items: items.map((i) => ({
      ...i,
      supplied: supplied.get(i.id) ?? 0,
      remaining: Math.max(0, i.quantity - (supplied.get(i.id) ?? 0)),
    })),
    carePlan: plan ? { ...plan, mealsParsed: parseJSON<Meals>(plan.meals, {}) } : null,
    supplyStatus: status,
  };
}

export type PrescriptionDetail = NonNullable<Awaited<ReturnType<typeof getPrescription>>>;

/** Compact list of prescriptions (newest first) with doctor and supply status. */
export async function listPrescriptions(filter: { patientId?: number; doctorId?: number; limit?: number }) {
  const conds = [];
  if (filter.patientId) conds.push(eq(prescriptions.patientId, filter.patientId));
  if (filter.doctorId) conds.push(eq(prescriptions.doctorId, filter.doctorId));
  const doctorUser = users;
  const rows = await db
    .select({
      id: prescriptions.id,
      code: prescriptions.code,
      diagnosis: prescriptions.diagnosis,
      createdAt: prescriptions.createdAt,
      followUpDate: prescriptions.followUpDate,
      patientId: prescriptions.patientId,
      doctorId: prescriptions.doctorId,
      doctorName: doctorUser.name,
      departmentName: departments.name,
    })
    .from(prescriptions)
    .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
    .innerJoin(doctorUser, eq(doctorUser.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(prescriptions.createdAt))
    .limit(filter.limit ?? 100);
  const ids = rows.map((r) => r.id);
  const [status, counts] = await Promise.all([
    prescriptionSupplyStatus(ids),
    ids.length
      ? db.select({ rxId: prescriptionItems.prescriptionId, name: prescriptionItems.medicineName }).from(prescriptionItems).where(inArray(prescriptionItems.prescriptionId, ids))
      : Promise.resolve([] as { rxId: number; name: string }[]),
  ]);
  const meds = new Map<number, string[]>();
  for (const c of counts) meds.set(c.rxId, [...(meds.get(c.rxId) ?? []), c.name]);
  return rows.map((r) => ({ ...r, supplyStatus: status.get(r.id) ?? "not_dispensed", medicines: meds.get(r.id) ?? [] }));
}
