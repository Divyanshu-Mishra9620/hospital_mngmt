"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  admissions,
  appointments,
  departments,
  doctorLeaves,
  doctorSchedules,
  doctors,
  enquiries,
  healthPackages,
  packageBookings,
  patients,
  payments,
  settings,
  users,
  wards,
} from "@/db/schema";
import { fail, ok, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { DEPARTMENT_ICON_NAMES } from "@/lib/admin/constants";
import { bedLabel } from "@/lib/admin/queries";
import { audit, notify } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";
import { isUniqueViolation, withUniqueCode } from "@/lib/codes";
import { fmtDate, fmtTime } from "@/lib/format";
import { SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";
import { isValidDate, isValidTime, toMinutes, todayISO } from "@/lib/time";

/* ----------------------------------------------------------------- helpers */

async function actor() {
  const u = await requireAdmin();
  return { id: u.id, name: u.name, role: u.role };
}

function refresh() {
  // Admin edits can change public pages (doctors, departments, fees) as well.
  revalidatePath("/", "layout");
}

function tempPassword() {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b % 10).join("");
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const l = letters[crypto.getRandomValues(new Uint8Array(1))[0] % letters.length];
  return `Medora@${l}${digits}`;
}

const s = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

/* ---------------------------------------------------------- appointments */

export async function adminCancelAppointment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const code = s(fd.get("code"));
  const reason = s(fd.get("reason")) || "Cancelled by hospital administration";
  const [appt] = await db.select().from(appointments).where(eq(appointments.code, code));
  if (!appt) return fail("Appointment not found.");
  if (!["booked", "checked_in"].includes(appt.status)) return fail("Only upcoming or checked-in appointments can be cancelled.");

  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({ status: "cancelled", paymentStatus: appt.paymentStatus === "paid" ? "refunded" : appt.paymentStatus, cancelReason: reason, cancelledBy: "admin" })
      .where(eq(appointments.id, appt.id));
    await tx
      .update(payments)
      .set({ status: "refunded" })
      .where(and(eq(payments.reference, appt.code), eq(payments.purpose, "consultation")));
  });
  const [p] = await db.select({ userId: patients.userId }).from(patients).where(eq(patients.id, appt.patientId));
  if (p) {
    await notify(
      p.userId,
      "Appointment cancelled by the hospital",
      `Your appointment ${appt.code} on ${fmtDate(appt.date)} at ${fmtTime(appt.time)} was cancelled (${reason}). ₹${appt.fee} will be refunded to your original payment method within 5–7 working days.`,
      `/patient/appointments/${appt.code}`,
    );
  }
  await audit(me, "cancel_refund", "appointment", appt.code, reason);
  refresh();
  return ok(`Appointment ${appt.code} cancelled and ₹${appt.fee} marked for refund. The patient has been notified.`);
}

export async function adminMarkNoShow(fd: FormData) {
  const me = await actor();
  const code = s(fd.get("code"));
  const [appt] = await db.select().from(appointments).where(eq(appointments.code, code));
  if (!appt || !["booked", "checked_in"].includes(appt.status)) return;
  await db.update(appointments).set({ status: "no_show" }).where(eq(appointments.id, appt.id));
  await audit(me, "mark_no_show", "appointment", code);
  refresh();
}

/* --------------------------------------------------------------- doctors */

const scheduleBlock = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().refine(isValidTime, "Invalid start time"),
  endTime: z.string().refine(isValidTime, "Invalid end time"),
  mode: z.enum(["both", "in_person", "video"]),
});

function parseSchedule(raw: string): { ok: true; blocks: z.infer<typeof scheduleBlock>[] } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw || "[]");
  } catch {
    return { ok: false, error: "Schedule could not be read." };
  }
  const parsed = z.array(scheduleBlock).max(42).safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule." };
  const blocks = parsed.data;
  for (const b of blocks) {
    if (toMinutes(b.endTime) - toMinutes(b.startTime) < 30) return { ok: false, error: "Each OPD block must be at least 30 minutes long." };
  }
  for (let wd = 0; wd <= 6; wd++) {
    const day = blocks.filter((b) => b.weekday === wd).sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < day.length; i++) {
      if (day[i].startTime < day[i - 1].endTime) return { ok: false, error: "Two OPD blocks overlap on the same day. Adjust the timings." };
    }
  }
  return { ok: true, blocks };
}

const doctorSchema = z.object({
  name: z.string().trim().min(3, "Enter the doctor's full name").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  phone: optional,
  departmentId: z.coerce.number().int().positive("Select a department"),
  designation: z.string().trim().min(3, "Enter a designation"),
  qualifications: z.string().trim().min(2, "Enter qualifications"),
  experienceYears: z.coerce.number().int().min(0).max(60),
  languages: z.string().trim().min(2, "Enter languages spoken"),
  expertise: z.string().trim().default(""),
  bio: z.string().trim().default(""),
  room: optional,
  registrationNo: optional,
  inPersonFee: z.coerce.number().int().min(0, "Fee can't be negative").max(100000),
  videoFee: z.coerce.number().int().min(0, "Fee can't be negative").max(100000),
  slotMinutes: z.coerce.number().int().refine((v) => [10, 15, 20, 30].includes(v), "Choose 10, 15, 20 or 30 minutes"),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#136b7a"),
});

function doctorInput(fd: FormData) {
  const raw = Object.fromEntries(fd);
  const parsed = doctorSchema.safeParse(raw);
  if (!parsed.success) return { error: fail("Please correct the highlighted fields: " + parsed.error.issues.map((i) => i.message).slice(0, 3).join("; "), zodFieldErrors(parsed.error.issues)) };
  const v = parsed.data;
  const name = /^dr\.?\s/i.test(v.name) ? v.name.replace(/^dr\.?\s*/i, "Dr. ") : `Dr. ${v.name}`;
  return { value: { ...v, name, videoEnabled: fd.get("videoEnabled") === "on" } };
}

export async function adminCreateDoctor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const input = doctorInput(fd);
  if ("error" in input) return input.error!;
  const v = input.value;
  const sched = parseSchedule(s(fd.get("schedule")));
  if (!sched.ok) return fail(sched.error);

  const [dup] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${v.email}`);
  if (dup) return fail("Another account already uses this email address.");

  const password = tempPassword();
  const passwordHash = await hashPassword(password);
  let code = "";
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const [row] = await db.select({ max: sql<number>`coalesce(max(cast(substr(${doctors.code}, 5) as integer)), 1000)` }).from(doctors);
    const candidate = `DOC-${Number(row.max) + 1 + attempt}`;
    try {
      await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(users)
          .values({ role: "doctor", code: candidate, name: v.name, email: v.email, phone: v.phone ?? null, passwordHash })
          .returning();
        const [d] = await tx
          .insert(doctors)
          .values({
            userId: u.id,
            code: candidate,
            departmentId: v.departmentId,
            designation: v.designation,
            qualifications: v.qualifications,
            experienceYears: v.experienceYears,
            languages: v.languages,
            expertise: v.expertise,
            bio: v.bio,
            room: v.room ?? null,
            registrationNo: v.registrationNo ?? null,
            inPersonFee: v.inPersonFee,
            videoFee: v.videoFee,
            slotMinutes: v.slotMinutes,
            videoEnabled: v.videoEnabled,
            avatarColor: v.avatarColor,
          })
          .returning();
        if (sched.blocks.length) await tx.insert(doctorSchedules).values(sched.blocks.map((b) => ({ ...b, doctorId: d.id })));
      });
      code = candidate;
    } catch (err) {
      if (isUniqueViolation(err, "email")) return fail("Another account already uses this email address.");
      if (!isUniqueViolation(err)) throw err;
    }
  }
  if (!code) return fail("Could not allocate a doctor ID. Please try again.");

  await audit(me, "create", "doctor", code, v.name);
  refresh();
  return ok(`${v.name} added as ${code}. Share the temporary password securely — it won't be shown again.`, {
    code,
    href: { href: `/admin/doctors/${code}`, label: `Open ${v.name}'s profile, schedule & leave` },
    reveal: { label: `Sign-in for ${code}`, value: password, note: `ID: ${code} · Email: ${v.email}. Ask the doctor to change it after first sign-in.` },
  });
}

export async function adminUpdateDoctor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const code = s(fd.get("code"));
  const [doc] = await db.select().from(doctors).where(eq(doctors.code, code));
  if (!doc) return fail("Doctor not found.");
  const input = doctorInput(fd);
  if ("error" in input) return input.error!;
  const v = input.value;
  try {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ name: v.name, email: v.email, phone: v.phone ?? null }).where(eq(users.id, doc.userId));
      await tx
        .update(doctors)
        .set({
          departmentId: v.departmentId,
          designation: v.designation,
          qualifications: v.qualifications,
          experienceYears: v.experienceYears,
          languages: v.languages,
          expertise: v.expertise,
          bio: v.bio,
          room: v.room ?? null,
          registrationNo: v.registrationNo ?? null,
          inPersonFee: v.inPersonFee,
          videoFee: v.videoFee,
          slotMinutes: v.slotMinutes,
          videoEnabled: v.videoEnabled,
          avatarColor: v.avatarColor,
        })
        .where(eq(doctors.id, doc.id));
    });
  } catch (err) {
    if (isUniqueViolation(err, "email")) return fail("Another account already uses this email address.");
    throw err;
  }
  const changes: string[] = [];
  if (doc.inPersonFee !== v.inPersonFee) changes.push(`in-person fee ₹${doc.inPersonFee}→₹${v.inPersonFee}`);
  if (doc.videoFee !== v.videoFee) changes.push(`video fee ₹${doc.videoFee}→₹${v.videoFee}`);
  if (doc.slotMinutes !== v.slotMinutes) changes.push(`slot ${doc.slotMinutes}→${v.slotMinutes} min`);
  await audit(me, "update", "doctor", code, changes.join(", ") || "Profile updated");
  refresh();
  return ok("Doctor profile saved. New fees apply to bookings made from now on; existing bookings keep their price.");
}

export async function adminSaveSchedule(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const code = s(fd.get("code"));
  const [doc] = await db.select().from(doctors).where(eq(doctors.code, code));
  if (!doc) return fail("Doctor not found.");
  const sched = parseSchedule(s(fd.get("schedule")));
  if (!sched.ok) return fail(sched.error);
  await db.transaction(async (tx) => {
    await tx.delete(doctorSchedules).where(eq(doctorSchedules.doctorId, doc.id));
    if (sched.blocks.length) await tx.insert(doctorSchedules).values(sched.blocks.map((b) => ({ ...b, doctorId: doc.id })));
  });
  await audit(me, "update_schedule", "doctor", code, `${sched.blocks.length} weekly OPD blocks`);
  refresh();
  return ok("Weekly OPD schedule saved. Existing bookings are unchanged; new slots follow the updated timings.");
}

export async function adminAddLeave(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const code = s(fd.get("code"));
  const date = s(fd.get("date"));
  const reason = s(fd.get("reason")) || null;
  if (!isValidDate(date)) return fail("Choose a valid date.");
  if (date < todayISO()) return fail("Leave can't be added for a past date.");
  const [doc] = await db.select().from(doctors).where(eq(doctors.code, code));
  if (!doc) return fail("Doctor not found.");
  try {
    await db.insert(doctorLeaves).values({ doctorId: doc.id, date, reason });
  } catch (err) {
    if (isUniqueViolation(err)) return fail("Leave is already marked for that date.");
    throw err;
  }
  const [{ n }] = await db
    .select({ n: count() })
    .from(appointments)
    .where(and(eq(appointments.doctorId, doc.id), eq(appointments.date, date), inArray(appointments.status, ["booked", "checked_in"])));
  await audit(me, "add_leave", "doctor", code, `${date}${reason ? ` — ${reason}` : ""}`);
  refresh();
  return ok(
    n
      ? `Leave added for ${fmtDate(date)}. ${n} existing booking${n === 1 ? " is" : "s are"} on that day — reschedule or cancel ${n === 1 ? "it" : "them"} from Appointments.`
      : `Leave added for ${fmtDate(date)}. No new bookings will be accepted that day.`,
  );
}

export async function adminRemoveLeave(fd: FormData) {
  const me = await actor();
  const id = Number(fd.get("id"));
  const [leave] = await db.select().from(doctorLeaves).where(eq(doctorLeaves.id, id));
  if (!leave) return;
  await db.delete(doctorLeaves).where(eq(doctorLeaves.id, id));
  await audit(me, "remove_leave", "doctor", String(leave.doctorId), leave.date);
  refresh();
}

/* ------------------------------------------------------------ user admin */

export async function adminToggleUser(fd: FormData) {
  const me = await actor();
  const userId = Number(fd.get("userId"));
  const active = fd.get("active") === "1";
  if (userId === me.id) return; // never lock yourself out
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return;
  await db.update(users).set({ active }).where(eq(users.id, userId));
  if (u.role === "doctor") await db.update(doctors).set({ active }).where(eq(doctors.userId, userId));
  await audit(me, active ? "activate" : "deactivate", u.role, u.code, u.name);
  refresh();
}

export async function adminResetPassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const userId = Number(fd.get("userId"));
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return fail("User not found.");
  const password = tempPassword();
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId));
  await notify(u.id, "Password reset by administrator", "Your password was reset by the hospital administration. Sign in with the temporary password you were given and keep it private.");
  await audit(me, "reset_password", u.role, u.code, u.name);
  return ok(`Password reset for ${u.name}.`, { reveal: { label: `Temporary password for ${u.code}`, value: password, note: "Shown once. Share it with the user securely." } });
}

const staffSchema = z.object({
  role: z.enum(["pharmacist", "admin"]),
  name: z.string().trim().min(3, "Enter the full name").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  phone: optional,
});

export async function adminCreateStaff(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const parsed = staffSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const prefix = v.role === "pharmacist" ? "PHA" : "ADM";
  const password = tempPassword();
  const passwordHash = await hashPassword(password);
  let code = "";
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const [row] = await db
      .select({ max: sql<number>`coalesce(max(cast(substr(${users.code}, 5) as integer)), ${v.role === "pharmacist" ? 200 : 0})` })
      .from(users)
      .where(sql`${users.code} like ${prefix + "-%"}`);
    const n = Number(row.max) + 1 + attempt;
    const candidate = `${prefix}-${String(n).padStart(3, "0")}`;
    try {
      await db.insert(users).values({ role: v.role, code: candidate, name: v.name, email: v.email, phone: v.phone ?? null, passwordHash });
      code = candidate;
    } catch (err) {
      if (isUniqueViolation(err, "email")) return fail("Another account already uses this email address.");
      if (!isUniqueViolation(err)) throw err;
    }
  }
  if (!code) return fail("Could not allocate a staff ID. Please try again.");
  await audit(me, "create", v.role, code, v.name);
  refresh();
  return ok(`${v.name} added as ${code}.`, { reveal: { label: `Sign-in for ${code}`, value: password, note: `ID: ${code} · Email: ${v.email}. Shown once.` } });
}

/* ----------------------------------------------------------- departments */



const deptSchema = z.object({
  name: z.string().trim().min(3, "Enter a name").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can use lowercase letters, numbers and hyphens"),
  summary: z.string().trim().min(10, "Add a one-line summary").max(200),
  description: z.string().trim().min(20, "Add a description (20+ characters)"),
  services: z.string().trim().default(""),
  icon: z.string().refine((v) => DEPARTMENT_ICON_NAMES.includes(v), "Choose an icon"),
  location: optional,
  extension: optional,
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function adminSaveDepartment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const id = Number(fd.get("id") || 0);
  const parsed = deptSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).slice(0, 3).join("; "), zodFieldErrors(parsed.error.issues));
  const v = { ...parsed.data, location: parsed.data.location ?? null, extension: parsed.data.extension ?? null, active: fd.get("active") === "on" };
  try {
    if (id) {
      await db.update(departments).set(v).where(eq(departments.id, id));
      await audit(me, "update", "department", v.slug, v.name);
    } else {
      await db.insert(departments).values(v);
      await audit(me, "create", "department", v.slug, v.name);
    }
  } catch (err) {
    if (isUniqueViolation(err, "slug")) return fail("Another department already uses this slug.");
    throw err;
  }
  refresh();
  if (!id) redirect("/admin/departments?saved=1");
  return ok("Department saved.");
}

/* ------------------------------------------------------------- settings */

const NUMERIC_SETTINGS: SettingKey[] = ["defaultInPersonFee", "defaultVideoFee", "deliveryFee", "freeDeliveryAbove", "pharmacyDiscountPercent", "bookingWindowDays"];

export async function adminSaveSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const values: Partial<Record<SettingKey, string>> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    const raw = s(fd.get(key));
    if (NUMERIC_SETTINGS.includes(key)) {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return fail(`Enter a valid number for ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`);
      if (key === "pharmacyDiscountPercent" && n > 50) return fail("Pharmacy discount can't exceed 50%.");
      if (key === "bookingWindowDays" && (n < 1 || n > 90)) return fail("Booking window must be between 1 and 90 days.");
      values[key] = String(Math.round(n));
    } else values[key] = raw.slice(0, 280);
  }
  for (const [key, value] of Object.entries(values)) {
    await db.insert(settings).values({ key, value: value! }).onConflictDoUpdate({ target: settings.key, set: { value: value! } });
  }
  await audit(me, "update", "settings", null, Object.entries(values).map(([k, v]) => `${k}=${v}`).join(", ").slice(0, 500));
  refresh();
  return ok("Settings saved.");
}

/* ------------------------------------------------------ beds & admissions */

export async function adminAdmit(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const uhid = s(fd.get("uhid")).toUpperCase();
  const doctorId = Number(fd.get("doctorId"));
  const wardId = Number(fd.get("wardId"));
  const bedNo = s(fd.get("bedNo"));
  const reason = s(fd.get("reason"));
  if (!uhid || !doctorId || !wardId || !bedNo) return fail("Fill in the patient UHID, doctor, ward and bed.");
  if (reason.length < 3) return fail("Enter the reason for admission.");

  const [patient] = await db
    .select({ id: patients.id, userId: patients.userId, name: users.name })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.uhid, uhid));
  if (!patient) return fail(`No patient found with UHID ${uhid}.`);
  const [ward] = await db.select().from(wards).where(eq(wards.id, wardId));
  if (!ward) return fail("Ward not found.");
  const validBeds = new Set(Array.from({ length: ward.totalBeds }, (_, i) => bedLabel(ward.name, i + 1)));
  if (!validBeds.has(bedNo)) return fail("That bed doesn't exist in this ward.");
  const [busyBed] = await db
    .select({ id: admissions.id })
    .from(admissions)
    .where(and(eq(admissions.wardId, wardId), eq(admissions.bedNo, bedNo), isNull(admissions.dischargedAt)));
  if (busyBed) return fail(`Bed ${bedNo} is already occupied.`);
  const [already] = await db
    .select({ code: admissions.code })
    .from(admissions)
    .where(and(eq(admissions.patientId, patient.id), isNull(admissions.dischargedAt)));
  if (already) return fail(`${patient.name} is already admitted (${already.code}). Discharge or transfer first.`);
  const [doc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, doctorId));
  if (!doc) return fail("Select the admitting doctor.");

  const code = await withUniqueCode("IPD", async (c) => {
    await db.insert(admissions).values({ code: c, patientId: patient.id, doctorId, wardId, bedNo, reason });
    return c;
  });
  await notify(patient.userId, "Admission confirmed", `You have been admitted to ${ward.name}, bed ${bedNo}. Admission number ${code}.`);
  await audit(me, "admit", "admission", code, `${patient.name} → ${ward.name} ${bedNo}`);
  refresh();
  return ok(`${patient.name} admitted to ${ward.name}, bed ${bedNo} (${code}).`);
}

export async function adminDischarge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const id = Number(fd.get("admissionId"));
  const summary = s(fd.get("summary"));
  if (summary.length < 5) return fail("Add a short discharge summary.");
  const [adm] = await db.select().from(admissions).where(eq(admissions.id, id));
  if (!adm) return fail("Admission not found.");
  if (adm.dischargedAt) return fail("This patient has already been discharged.");
  await db.update(admissions).set({ dischargedAt: new Date().toISOString(), dischargeSummary: summary }).where(eq(admissions.id, id));
  const [p] = await db.select({ userId: patients.userId }).from(patients).where(eq(patients.id, adm.patientId));
  if (p) await notify(p.userId, "Discharged", `You have been discharged (${adm.code}). Please follow the discharge advice and book a follow-up if advised.`);
  await audit(me, "discharge", "admission", adm.code, summary.slice(0, 200));
  refresh();
  redirect(`/admin/beds?ward=${adm.wardId}&discharged=${adm.code}`);
}

/* --------------------------------------------------- enquiries, packages */

export async function adminSetEnquiryStatus(fd: FormData) {
  const me = await actor();
  const id = Number(fd.get("id"));
  const status = s(fd.get("status"));
  if (!["new", "in_progress", "resolved"].includes(status)) return;
  await db.update(enquiries).set({ status: status as "new" | "in_progress" | "resolved" }).where(eq(enquiries.id, id));
  await audit(me, "update_status", "enquiry", String(id), status);
  refresh();
}

export async function adminSavePackage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await actor();
  const id = Number(fd.get("id"));
  const price = Number(fd.get("price"));
  const mrp = Number(fd.get("mrp"));
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(mrp) || mrp <= 0) return fail("Enter valid prices.");
  if (price > mrp) return fail("Offer price can't be higher than the MRP.");
  const [pkg] = await db.select().from(healthPackages).where(eq(healthPackages.id, id));
  if (!pkg) return fail("Package not found.");
  const active = fd.get("active") === "on";
  const highlight = fd.get("highlight") === "on";
  await db.update(healthPackages).set({ price: Math.round(price), mrp: Math.round(mrp), active, highlight }).where(eq(healthPackages.id, id));
  await audit(me, "update", "health_package", pkg.slug, `₹${pkg.price}→₹${Math.round(price)}${active ? "" : " (inactive)"}`);
  refresh();
  return ok(`${pkg.name} updated.`);
}

export async function adminSetPackageBooking(fd: FormData) {
  const me = await actor();
  const id = Number(fd.get("id"));
  const status = s(fd.get("status"));
  if (!["completed", "cancelled"].includes(status)) return;
  const [b] = await db.select().from(packageBookings).where(eq(packageBookings.id, id));
  if (!b || b.status !== "booked") return;
  await db.update(packageBookings).set({ status: status as "completed" | "cancelled" }).where(eq(packageBookings.id, id));
  if (status === "cancelled") {
    await db.update(payments).set({ status: "refunded" }).where(and(eq(payments.reference, b.code), eq(payments.purpose, "health_package")));
  }
  const [p] = await db.select({ userId: patients.userId }).from(patients).where(eq(patients.id, b.patientId));
  if (p)
    await notify(
      p.userId,
      status === "completed" ? "Health check completed" : "Health check cancelled",
      status === "completed" ? `Your health check-up (${b.code}) is complete. Reports will be shared by the lab.` : `Your health check-up booking ${b.code} was cancelled and ₹${b.amount} will be refunded.`,
      "/patient/health-checks",
    );
  await audit(me, status === "completed" ? "complete" : "cancel_refund", "package_booking", b.code);
  refresh();
}

