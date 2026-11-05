"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  appointments,
  carePlans,
  doctorLeaves,
  doctorSchedules,
  doctors,
  medicines,
  notifications,
  patients,
  payments,
  prescriptionItems,
  prescriptions,
  users,
  vitals,
  type AppointmentStatus,
} from "@/db/schema";
import { fail, ok, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { audit, notify } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireDoctor } from "@/lib/auth/session";
import { withUniqueCode } from "@/lib/codes";
import { DIET_TYPES, FREQUENCIES, MEAL_SLOTS } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/format";
import { clinicNow, isValidDate, isValidTime, toMinutes, weekdayOf } from "@/lib/time";

function refresh() {
  revalidatePath("/doctor", "layout");
}

async function ownAppointment(code: string) {
  const { user, doctor } = await requireDoctor();
  const [row] = await db
    .select({ appt: appointments, patientUserId: patients.userId, patientName: users.name })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(eq(appointments.code, code), eq(appointments.doctorId, doctor.id)))
    .limit(1);
  return { user, doctor, row: row ?? null };
}

/* ------------------------------------------------------- appointment status */

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  booked: ["checked_in", "in_consult", "no_show"],
  checked_in: ["in_consult", "no_show"],
  in_consult: ["completed"],
  completed: [],
  cancelled: [],
  no_show: ["booked"],
};

/** Form action: move an appointment along booked → checked_in → in_consult → completed. */
export async function updateAppointmentStatus(code: string, next: AppointmentStatus) {
  const { user, row } = await ownAppointment(code);
  if (!row) return;
  const { appt } = row;
  if (!TRANSITIONS[appt.status].includes(next)) return;
  const today = clinicNow().date;
  if ((next === "checked_in" || next === "in_consult") && appt.date !== today) return;
  if (next === "checked_in" && appt.mode !== "in_person") return;
  if (next === "no_show" && appt.date > today) return;
  if (next === "booked" && appt.date < today) return; // undo no-show only same day

  const nowIso = new Date().toISOString();
  await db
    .update(appointments)
    .set({
      status: next,
      checkedInAt: next === "checked_in" ? nowIso : appt.checkedInAt,
      startedAt: next === "in_consult" ? (appt.startedAt ?? nowIso) : appt.startedAt,
      completedAt: next === "completed" ? nowIso : appt.completedAt,
    })
    .where(eq(appointments.id, appt.id));
  await audit({ id: user.id, name: user.name, role: "doctor" }, `appointment_${next}`, "appointment", appt.code);
  refresh();
}

/* ------------------------------------------------------------------ vitals */

const num = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), `${label} should be between ${min} and ${max}`);

const vitalsSchema = z.object({
  bpSystolic: num(60, 260, "Systolic BP"),
  bpDiastolic: num(30, 160, "Diastolic BP"),
  pulse: num(30, 220, "Pulse"),
  temperatureF: num(90, 110, "Temperature (°F)"),
  spo2: num(50, 100, "SpO₂"),
  respiratoryRate: num(5, 60, "Respiratory rate"),
  weightKg: num(1, 300, "Weight"),
  heightCm: num(30, 250, "Height"),
  bloodSugar: num(20, 700, "Blood sugar"),
  sugarType: z.enum(["fasting", "random", "pp", ""]).default(""),
});

export async function recordVitals(code: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, row } = await ownAppointment(code);
  if (!row) return fail("Appointment not found.");
  const parsed = vitalsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the highlighted values.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const values = [v.bpSystolic, v.bpDiastolic, v.pulse, v.temperatureF, v.spo2, v.respiratoryRate, v.weightKg, v.heightCm, v.bloodSugar];
  if (values.every((x) => x === null)) return fail("Enter at least one reading.");
  if ((v.bpSystolic === null) !== (v.bpDiastolic === null)) return fail("Enter both systolic and diastolic BP.", { bpSystolic: "Both values needed" });

  await db.insert(vitals).values({
    patientId: row.appt.patientId,
    appointmentId: row.appt.id,
    recordedBy: user.id,
    bpSystolic: v.bpSystolic,
    bpDiastolic: v.bpDiastolic,
    pulse: v.pulse,
    temperatureF: v.temperatureF,
    spo2: v.spo2,
    respiratoryRate: v.respiratoryRate,
    weightKg: v.weightKg,
    heightCm: v.heightCm,
    bloodSugar: v.bloodSugar,
    sugarType: v.bloodSugar !== null && v.sugarType ? v.sugarType : null,
  });
  if (v.weightKg !== null || v.heightCm !== null) {
    await db
      .update(patients)
      .set({ ...(v.weightKg !== null ? { weightKg: v.weightKg } : {}), ...(v.heightCm !== null ? { heightCm: v.heightCm } : {}) })
      .where(eq(patients.id, row.appt.patientId));
  }
  await audit({ id: user.id, name: user.name, role: "doctor" }, "vitals_recorded", "appointment", row.appt.code);
  refresh();
  return ok("Vitals saved.");
}

/* ------------------------------------------------------------ prescription */

const itemSchema = z.object({
  medicineId: z.number().int().positive().nullable(),
  medicineName: z.string().trim().min(2, "Medicine name is required").max(120),
  dosage: z.string().trim().max(60).default(""),
  frequency: z.string().refine((v) => FREQUENCIES.some((f) => f.value === v), "Choose a frequency"),
  timing: z.string().trim().max(40).default(""),
  durationDays: z.number().int().min(1, "Duration must be at least 1 day").max(365),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(2000),
  instructions: z.string().trim().max(300).default(""),
});

const mealKeys = MEAL_SLOTS.map((m) => m.key);

const payloadSchema = z.object({
  chiefComplaints: z.string().trim().max(1000).default(""),
  diagnosis: z.string().trim().min(3, "Enter a diagnosis").max(300),
  clinicalNotes: z.string().trim().max(2000).default(""),
  advice: z.string().trim().max(2000).default(""),
  followUpDate: z.string().default(""),
  labTests: z.array(z.string().trim().min(2).max(120)).max(40).default([]),
  items: z.array(itemSchema).max(30),
  carePlan: z
    .object({
      dietType: z.enum(DIET_TYPES),
      calories: z.number().int().min(800).max(5000).nullable(),
      meals: z.record(z.string(), z.string().trim().max(400)),
      include: z.string().trim().max(1000).default(""),
      avoid: z.string().trim().max(1000).default(""),
      hydration: z.string().trim().max(500).default(""),
      exercise: z.string().trim().max(1000).default(""),
      lifestyle: z.string().trim().max(1000).default(""),
      sleep: z.string().trim().max(300).default(""),
    })
    .nullable(),
});

export async function savePrescription(code: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, doctor, row } = await ownAppointment(code);
  if (!row) return fail("Appointment not found.");
  const { appt } = row;
  if (appt.status === "cancelled") return fail("This appointment was cancelled.");
  if (appt.status === "no_show") return fail("Mark the patient as arrived before writing a prescription.");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return fail("Could not read the prescription. Please try again.");
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path[0] === "items" ? `Medicine ${Number(issue.path[1]) + 1}: ` : "";
    return fail(`${where}${issue.message}`, zodFieldErrors(parsed.error.issues));
  }
  const p = parsed.data;
  if (p.followUpDate && (!isValidDate(p.followUpDate) || p.followUpDate <= appt.date)) {
    return fail("Follow-up date must be after the consultation date.", { followUpDate: "Pick a later date" });
  }

  const [existing] = await db.select({ code: prescriptions.code }).from(prescriptions).where(eq(prescriptions.appointmentId, appt.id)).limit(1);
  if (existing) return fail(`A prescription (${existing.code}) has already been issued for this visit.`);

  // Resolve stocked medicines so names match the store catalogue.
  const medIds = p.items.map((i) => i.medicineId).filter((x): x is number => x != null);
  const stocked = medIds.length ? await db.select({ id: medicines.id, name: medicines.name }).from(medicines).where(inArray(medicines.id, medIds)) : [];
  const nameById = new Map(stocked.map((m) => [m.id, m.name]));

  const nowIso = new Date().toISOString();
  const rxCode = await withUniqueCode("RX", (newCode) =>
    db.transaction(async (tx) => {
      const [rx] = await tx
        .insert(prescriptions)
        .values({
          code: newCode,
          appointmentId: appt.id,
          patientId: appt.patientId,
          doctorId: doctor.id,
          chiefComplaints: p.chiefComplaints || null,
          diagnosis: p.diagnosis,
          clinicalNotes: p.clinicalNotes || null,
          advice: p.advice || null,
          labTests: JSON.stringify([...new Set(p.labTests)]),
          followUpDate: p.followUpDate || null,
        })
        .returning();
      if (p.items.length) {
        await tx.insert(prescriptionItems).values(
          p.items.map((i) => {
            const medicineId = i.medicineId != null && nameById.has(i.medicineId) ? i.medicineId : null;
            return {
              prescriptionId: rx.id,
              medicineId,
              medicineName: medicineId ? nameById.get(medicineId)! : i.medicineName,
              dosage: i.dosage || null,
              frequency: i.frequency,
              timing: i.timing || null,
              durationDays: i.durationDays,
              quantity: i.quantity,
              instructions: i.instructions || null,
            };
          }),
        );
      }
      if (p.carePlan) {
        const meals = Object.fromEntries(Object.entries(p.carePlan.meals).filter(([k, v]) => mealKeys.includes(k as (typeof mealKeys)[number]) && v.trim()));
        await tx.insert(carePlans).values({
          prescriptionId: rx.id,
          patientId: appt.patientId,
          doctorId: doctor.id,
          dietType: p.carePlan.dietType,
          calories: p.carePlan.calories,
          meals: JSON.stringify(meals),
          include: p.carePlan.include || null,
          avoid: p.carePlan.avoid || null,
          hydration: p.carePlan.hydration || null,
          exercise: p.carePlan.exercise || null,
          lifestyle: p.carePlan.lifestyle || null,
          sleep: p.carePlan.sleep || null,
        });
      }
      await tx
        .update(appointments)
        .set({ status: "completed", startedAt: appt.startedAt ?? nowIso, completedAt: nowIso })
        .where(eq(appointments.id, appt.id));
      return rx.code;
    }),
  );

  await notify(
    row.patientUserId,
    "New prescription from " + user.name,
    `${p.items.length ? `${p.items.length} medicine${p.items.length === 1 ? "" : "s"}` : "Advice"}${p.carePlan ? " and a diet & lifestyle plan" : ""} for: ${p.diagnosis}. You can order medicines from the hospital pharmacy.`,
    `/patient/prescriptions/${rxCode}`,
  );
  await audit({ id: user.id, name: user.name, role: "doctor" }, "prescription_issued", "prescription", rxCode, `Appointment ${appt.code}`);
  refresh();
  revalidatePath("/patient", "layout");
  redirect(`/doctor/consult/${appt.code}?saved=${rxCode}`);
}

/* ---------------------------------------------------------------- schedule */

const blockSchema = z
  .object({
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one day"),
    startTime: z.string().refine(isValidTime, "Enter a start time"),
    endTime: z.string().refine(isValidTime, "Enter an end time"),
    mode: z.enum(["both", "in_person", "video"]),
  })
  .refine((v) => toMinutes(v.endTime) > toMinutes(v.startTime), { path: ["endTime"], message: "End time must be after start time" });

export async function addScheduleBlock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, doctor } = await requireDoctor();
  const parsed = blockSchema.safeParse({
    weekdays: formData.getAll("weekdays"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message, zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  if (toMinutes(v.endTime) - toMinutes(v.startTime) < doctor.slotMinutes) return fail(`A session must fit at least one ${doctor.slotMinutes}-minute slot.`);
  if (v.mode !== "in_person" && !doctor.videoEnabled && v.mode === "video") return fail("Video consultations are disabled for your profile. Contact the administrator.");

  const existing = await db.select().from(doctorSchedules).where(eq(doctorSchedules.doctorId, doctor.id));
  const s = toMinutes(v.startTime);
  const e = toMinutes(v.endTime);
  for (const wd of v.weekdays) {
    const clash = existing.find((b) => b.weekday === wd && s < toMinutes(b.endTime) && e > toMinutes(b.startTime));
    if (clash) {
      const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][wd];
      return fail(`Overlaps your ${day} session ${fmtTime(clash.startTime)}–${fmtTime(clash.endTime)}.`);
    }
  }
  await db.insert(doctorSchedules).values(v.weekdays.map((wd) => ({ doctorId: doctor.id, weekday: wd, startTime: v.startTime, endTime: v.endTime, mode: v.mode })));
  await audit({ id: user.id, name: user.name, role: "doctor" }, "schedule_added", "doctor", doctor.code, `${v.weekdays.join(",")} ${v.startTime}-${v.endTime} ${v.mode}`);
  refresh();
  return ok("Session added to your weekly schedule.");
}

/** Upcoming live bookings that only this block covers. */
async function bookingsDependingOn(doctorId: number, blockId: number) {
  const blocks = await db.select().from(doctorSchedules).where(eq(doctorSchedules.doctorId, doctorId));
  const block = blocks.find((b) => b.id === blockId);
  if (!block) return { block: null, count: 0 };
  const others = blocks.filter((b) => b.id !== blockId);
  const today = clinicNow().date;
  const live = await db
    .select({ date: appointments.date, time: appointments.time, mode: appointments.mode })
    .from(appointments)
    .where(and(eq(appointments.doctorId, doctorId), gte(appointments.date, today), inArray(appointments.status, ["booked", "checked_in"])));
  let count = 0;
  for (const a of live) {
    const wd = weekdayOf(a.date);
    const t = toMinutes(a.time);
    const inBlock = (b: (typeof blocks)[number]): boolean => b.weekday === wd && t >= toMinutes(b.startTime) && t < toMinutes(b.endTime) && (b.mode === "both" || b.mode === a.mode);
    if (inBlock(block) && !others.some(inBlock)) count++;
  }
  return { block, count };
}

export async function removeScheduleBlock(blockId: number): Promise<ActionState> {
  const { user, doctor } = await requireDoctor();
  const { block, count } = await bookingsDependingOn(doctor.id, blockId);
  if (!block) return fail("Session not found.");
  if (count > 0) {
    return fail(
      `${count} upcoming appointment${count === 1 ? "" : "s"} fall in this session. Mark leave for those dates (patients are refunded automatically) or wait until they are completed, then remove it.`,
    );
  }
  await db.delete(doctorSchedules).where(and(eq(doctorSchedules.id, blockId), eq(doctorSchedules.doctorId, doctor.id)));
  await audit({ id: user.id, name: user.name, role: "doctor" }, "schedule_removed", "doctor", doctor.code, `${block.weekday} ${block.startTime}-${block.endTime}`);
  refresh();
  return ok("Session removed.");
}

export async function updateSlotMinutes(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, doctor } = await requireDoctor();
  const minutes = Number(formData.get("slotMinutes"));
  if (![10, 15, 20, 30, 45, 60].includes(minutes)) return fail("Choose a valid slot length.");
  if (minutes === doctor.slotMinutes) return ok("Slot length unchanged.");
  const blocks = await db.select().from(doctorSchedules).where(eq(doctorSchedules.doctorId, doctor.id));
  const today = clinicNow().date;
  const live = await db
    .select({ date: appointments.date, time: appointments.time })
    .from(appointments)
    .where(and(eq(appointments.doctorId, doctor.id), gte(appointments.date, today), inArray(appointments.status, ["booked", "checked_in"])));
  const misaligned = live.filter((a) => {
    const wd = weekdayOf(a.date);
    const t = toMinutes(a.time);
    const b = blocks.find((x) => x.weekday === wd && t >= toMinutes(x.startTime) && t < toMinutes(x.endTime));
    return !b || (t - toMinutes(b.startTime)) % minutes !== 0;
  });
  if (misaligned.length) {
    return fail(
      `${misaligned.length} upcoming booking${misaligned.length === 1 ? "" : "s"} wouldn't line up with ${minutes}-minute slots. The slot length can be changed once those visits are completed or moved.`,
    );
  }
  await db.update(doctors).set({ slotMinutes: minutes }).where(eq(doctors.id, doctor.id));
  await audit({ id: user.id, name: user.name, role: "doctor" }, "slot_length_changed", "doctor", doctor.code, `${doctor.slotMinutes} → ${minutes} min`);
  refresh();
  return ok(`Slots are now ${minutes} minutes long.`);
}

export async function addLeave(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, doctor } = await requireDoctor();
  const date = String(formData.get("date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  const confirmed = formData.get("confirm") === "yes";
  const today = clinicNow().date;
  if (!isValidDate(date) || date < today) return fail("Choose today or a future date.", { date: "Invalid date" });

  const [dup] = await db.select({ id: doctorLeaves.id }).from(doctorLeaves).where(and(eq(doctorLeaves.doctorId, doctor.id), eq(doctorLeaves.date, date)));
  if (dup) return fail(`You are already marked on leave for ${fmtDate(date)}.`);

  const affected = await db
    .select({ id: appointments.id, code: appointments.code, time: appointments.time, patientUserId: patients.userId })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(eq(appointments.doctorId, doctor.id), eq(appointments.date, date), inArray(appointments.status, ["booked", "checked_in"])));

  if (affected.length && !confirmed) {
    return {
      ok: false,
      error: `${affected.length} patient${affected.length === 1 ? " is" : "s are"} booked on ${fmtDate(date)}. Confirm to cancel ${affected.length === 1 ? "that appointment" : "those appointments"} — patients will be notified and refunded in full.`,
      data: { needsConfirm: true, date, reason, count: affected.length },
    };
  }

  const cancelReason = `Doctor unavailable${reason ? ` — ${reason}` : ""}`;
  await db.transaction(async (tx) => {
    await tx.insert(doctorLeaves).values({ doctorId: doctor.id, date, reason: reason || null });
    if (affected.length) {
      await tx
        .update(appointments)
        .set({ status: "cancelled", paymentStatus: "refunded", cancelledBy: "doctor", cancelReason })
        .where(inArray(appointments.id, affected.map((a) => a.id)));
      await tx.update(payments).set({ status: "refunded" }).where(inArray(payments.reference, affected.map((a) => a.code)));
    }
  });
  for (const a of affected) {
    await notify(
      a.patientUserId,
      "Appointment cancelled — full refund",
      `${user.name} is unavailable on ${fmtDate(date)}. Your ${fmtTime(a.time)} appointment (${a.code}) has been cancelled and your fee refunded. Please book another slot.`,
      `/patient/appointments/${a.code}`,
    );
  }
  await audit({ id: user.id, name: user.name, role: "doctor" }, "leave_added", "doctor", doctor.code, `${date}${affected.length ? ` · ${affected.length} cancelled` : ""}`);
  refresh();
  revalidatePath("/patient", "layout");
  return ok(affected.length ? `Leave added. ${affected.length} appointment(s) cancelled and refunded.` : `Leave added for ${fmtDate(date)}.`);
}

export async function removeLeave(leaveId: number) {
  const { user, doctor } = await requireDoctor();
  const [leave] = await db.select().from(doctorLeaves).where(and(eq(doctorLeaves.id, leaveId), eq(doctorLeaves.doctorId, doctor.id)));
  if (!leave) return;
  await db.delete(doctorLeaves).where(eq(doctorLeaves.id, leave.id));
  await audit({ id: user.id, name: user.name, role: "doctor" }, "leave_removed", "doctor", doctor.code, leave.date);
  refresh();
}

/* ----------------------------------------------------------------- profile */

const profileSchema = z.object({
  bio: z.string().trim().min(20, "Write at least a couple of sentences").max(1500),
  expertise: z.string().trim().min(3).max(400),
  languages: z.string().trim().min(2).max(200),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a valid mobile number")
    .or(z.literal("")),
});

export async function updateDoctorProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, doctor } = await requireDoctor();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  await db.update(doctors).set({ bio: v.bio, expertise: v.expertise, languages: v.languages }).where(eq(doctors.id, doctor.id));
  if (v.phone) {
    const d = v.phone.replace(/\D/g, "").slice(-10);
    await db.update(users).set({ phone: `+91 ${d.slice(0, 5)} ${d.slice(5)}` }).where(eq(users.id, user.id));
  }
  await audit({ id: user.id, name: user.name, role: "doctor" }, "profile_updated", "doctor", doctor.code);
  refresh();
  revalidatePath("/doctors", "layout");
  return ok("Profile updated. Changes appear on your public profile.");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "Use at least 8 characters").regex(/[0-9]/, "Include a number").regex(/[A-Za-z]/, "Include a letter"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export async function changeDoctorPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireDoctor();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return fail("Current password is incorrect.", { current: "Incorrect password" });
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(users.id, user.id));
  await audit({ id: user.id, name: user.name, role: "doctor" }, "password_changed", "user", user.code);
  return ok("Password changed.");
}

/* ----------------------------------------------------------- notifications */

export async function markDoctorNotificationsRead() {
  const { user } = await requireDoctor();
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  refresh();
}

export async function openDoctorNotification(id: number) {
  const { user } = await requireDoctor();
  const [n] = await db.select().from(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  if (!n) return;
  if (!n.read) await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  refresh();
  if (n.href) redirect(n.href);
}
