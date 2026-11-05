import { revalidatePath } from "@/lib/client/revalidate";
import { redirect } from "@/lib/client/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  appointments,
  cartItems,
  doctors,
  feedback,
  healthPackages,
  medicines,
  notifications,
  packageBookings,
  patients,
  payments,
  pharmacyOrderItems,
  pharmacyOrders,
  prescriptionItems,
  prescriptions,
  users,
} from "@/db/schema";
import { fail, ok, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { cancellationPolicy } from "@/lib/appointments";
import { audit, notify } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requirePatient } from "@/lib/auth/session";
import { isUniqueViolation, withUniqueCode } from "@/lib/codes";
import { fmtDay, fmtTime, inr, money } from "@/lib/format";
import { deductStock, restoreOrderStock, StockError, suppliedQuantities } from "@/lib/pharmacy";
import { getNumberSetting, getSettings } from "@/lib/settings";
import { getDoctorAvailability, isSlotOffered } from "@/lib/slots";
import { addDays, clinicNow, isValidDate, isValidTime } from "@/lib/time";

const PAY_METHODS = ["upi", "card", "netbanking"] as const;

/* ======================================================================
 * Appointments
 * ==================================================================== */

const bookSchema = z.object({
  doctorId: z.coerce.number().int().positive(),
  date: z.string().refine(isValidDate, "Choose a date"),
  time: z.string().refine(isValidTime, "Choose a time slot"),
  mode: z.enum(["in_person", "video"]),
  reason: z.string().trim().max(400).optional().default(""),
  paymentMethod: z.enum(PAY_METHODS, "Choose a payment method"),
});

export async function bookAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, patient } = await requirePatient();
  const parsed = bookSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please complete the form.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;

  const [doc] = await db
    .select({ doctor: doctors, name: users.name, userId: users.id, active: users.active })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(doctors.id, v.doctorId));
  if (!doc || !doc.doctor.active || !doc.active) return fail("This doctor is not taking appointments right now.");
  if (v.mode === "video" && !doc.doctor.videoEnabled) return fail("This doctor doesn't offer video consultations.");

  const now = clinicNow();
  const windowDays = await getNumberSetting("bookingWindowDays");
  if (v.date < now.date || v.date > addDays(now.date, windowDays)) return fail(`Appointments can be booked up to ${windowDays} days ahead.`);
  if (!(await isSlotOffered(doc.doctor.id, v.date, v.time, v.mode))) {
    return fail("Sorry — that slot is no longer available. Please pick another time.");
  }

  // One live appointment per patient per doctor per day.
  const [dup] = await db
    .select({ code: appointments.code })
    .from(appointments)
    .where(and(eq(appointments.patientId, patient.id), eq(appointments.doctorId, doc.doctor.id), eq(appointments.date, v.date), ne(appointments.status, "cancelled")))
    .limit(1);
  if (dup) return fail(`You already have an appointment with ${doc.name} on ${fmtDay(v.date)} (${dup.code}).`);

  const fee = v.mode === "video" ? doc.doctor.videoFee : doc.doctor.inPersonFee;
  // Token = position of the slot in the doctor's day (stable regardless of booking order).
  const [day] = await getDoctorAvailability(doc.doctor.id, v.date, 1);
  const tokenNo = (day?.slots.findIndex((s) => s.time === v.time) ?? -1) + 1 || null;

  let apptCode: string;
  try {
    apptCode = await withUniqueCode("APT", async (code) => {
      await db.transaction(async (tx) => {
        await tx.insert(appointments).values({
          code,
          patientId: patient.id,
          doctorId: doc.doctor.id,
          date: v.date,
          time: v.time,
          mode: v.mode,
          status: "booked",
          reason: v.reason || null,
          fee,
          paymentStatus: "paid",
          tokenNo,
        });
        await withUniqueCode("PAY", (payCode) =>
          tx.insert(payments).values({
            code: payCode,
            patientId: patient.id,
            purpose: "consultation",
            reference: code,
            description: `${v.mode === "video" ? "Video" : "OPD"} consultation — ${doc.name}`,
            amount: fee,
            method: v.paymentMethod,
          }),
        );
      });
      return code;
    });
  } catch (err) {
    if (isUniqueViolation(err, "patient_id")) return fail("You already have another appointment at this exact time.");
    if (isUniqueViolation(err)) return fail("Sorry — someone booked that slot a moment ago. Please choose another time.");
    throw err;
  }

  const when = `${fmtDay(v.date)} at ${fmtTime(v.time)}`;
  await notify(
    user.id,
    v.mode === "video" ? "Video consultation confirmed" : "Appointment confirmed",
    `${doc.name} · ${when}. ${v.mode === "video" ? "Join from the app up to 15 minutes before." : `Token ${tokenNo ?? "—"}. Please arrive 15 minutes early.`} Paid ${inr(fee)}.`,
    `/patient/appointments/${apptCode}`,
  );
  await notify(doc.userId, "New appointment", `${user.name} (${patient.uhid}) booked a ${v.mode === "video" ? "video" : "in-person"} consultation for ${when}.`, "/doctor/appointments");
  await audit({ id: user.id, name: user.name, role: "patient" }, "book", "appointment", apptCode, `${doc.name} ${v.date} ${v.time} ${v.mode}`);
  revalidatePath("/patient", "layout");
  redirect(`/patient/appointments/${apptCode}?booked=1`);
}

async function ownAppointment(code: string, patientId: number) {
  const [appt] = await db
    .select({ appt: appointments, doctorName: users.name, doctorUserId: users.id, slotMinutes: doctors.slotMinutes })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(and(eq(appointments.code, code), eq(appointments.patientId, patientId)));
  return appt ?? null;
}

export async function cancelAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, patient } = await requirePatient();
  const code = String(formData.get("code") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Cancelled by patient";
  const row = await ownAppointment(code, patient.id);
  if (!row) return fail("Appointment not found.");
  const policy = cancellationPolicy(row.appt);
  if (!policy.cancellable) return fail("This appointment can no longer be cancelled online. Please call the help desk.");

  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({ status: "cancelled", cancelReason: reason, cancelledBy: "patient", paymentStatus: policy.refundable ? "refunded" : "paid" })
      .where(eq(appointments.id, row.appt.id));
    if (policy.refundable) {
      await tx.update(payments).set({ status: "refunded" }).where(and(eq(payments.reference, row.appt.code), eq(payments.purpose, "consultation")));
    }
  });
  await notify(
    user.id,
    "Appointment cancelled",
    `${row.doctorName} · ${fmtDay(row.appt.date)} ${fmtTime(row.appt.time)}. ${policy.refundable ? `${inr(row.appt.fee)} will be refunded to your original payment method in 3–5 working days.` : "Cancelled within 2 hours of the slot — not eligible for a refund."}`,
    `/patient/appointments/${code}`,
  );
  await notify(row.doctorUserId, "Appointment cancelled", `${user.name} cancelled the ${fmtTime(row.appt.time)} slot on ${fmtDay(row.appt.date)}.`, "/doctor/appointments");
  await audit({ id: user.id, name: user.name, role: "patient" }, "cancel", "appointment", code, reason);
  revalidatePath("/patient", "layout");
  return ok(policy.refundable ? "Appointment cancelled. Your refund has been initiated." : "Appointment cancelled.");
}

export async function rescheduleAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, patient } = await requirePatient();
  const code = String(formData.get("code") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  if (!isValidDate(date) || !isValidTime(time)) return fail("Choose a new date and time.");
  const row = await ownAppointment(code, patient.id);
  if (!row) return fail("Appointment not found.");
  if (!cancellationPolicy(row.appt).cancellable) return fail("This appointment can no longer be rescheduled online.");
  if (date === row.appt.date && time === row.appt.time) return fail("That's your current slot — pick a different one.");
  if (!(await isSlotOffered(row.appt.doctorId, date, time, row.appt.mode))) return fail("That slot is no longer available. Please pick another time.");

  const [day] = await getDoctorAvailability(row.appt.doctorId, date, 1);
  const tokenNo = (day?.slots.findIndex((s) => s.time === time) ?? -1) + 1 || null;
  try {
    await db.update(appointments).set({ date, time, tokenNo }).where(eq(appointments.id, row.appt.id));
  } catch (err) {
    if (isUniqueViolation(err)) return fail("That slot was just taken, or clashes with another of your appointments.");
    throw err;
  }
  const when = `${fmtDay(date)} at ${fmtTime(time)}`;
  await notify(user.id, "Appointment rescheduled", `${row.doctorName} · now ${when}.`, `/patient/appointments/${code}`);
  await notify(row.doctorUserId, "Appointment rescheduled", `${user.name} moved their appointment to ${when}.`, "/doctor/appointments");
  await audit({ id: user.id, name: user.name, role: "patient" }, "reschedule", "appointment", code, `${row.appt.date} ${row.appt.time} → ${date} ${time}`);
  revalidatePath("/patient", "layout");
  return ok(`Rescheduled to ${when}.`);
}

export async function submitFeedbackAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, patient } = await requirePatient();
  const code = String(formData.get("code") ?? "");
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 600);
  if (!(rating >= 1 && rating <= 5)) return fail("Choose a rating from 1 to 5 stars.");
  const row = await ownAppointment(code, patient.id);
  if (!row || row.appt.status !== "completed") return fail("You can rate a consultation once it is completed.");
  try {
    await db.insert(feedback).values({ appointmentId: row.appt.id, patientId: patient.id, doctorId: row.appt.doctorId, rating, comment: comment || null });
  } catch (err) {
    if (isUniqueViolation(err)) return fail("You've already shared feedback for this visit.");
    throw err;
  }
  await audit({ id: user.id, name: user.name, role: "patient" }, "feedback", "appointment", code, `${rating}★`);
  revalidatePath(`/patient/appointments/${code}`);
  return ok("Thank you for your feedback.");
}

/* ======================================================================
 * Pharmacy cart & orders
 * ==================================================================== */

/** Remaining prescribed quantity for each of the patient's prescription items. */
async function remainingForItems(patientId: number, itemIds: number[]) {
  if (!itemIds.length) return new Map<number, { remaining: number; medicineId: number | null }>();
  const items = await db
    .select({ id: prescriptionItems.id, qty: prescriptionItems.quantity, medicineId: prescriptionItems.medicineId })
    .from(prescriptionItems)
    .innerJoin(prescriptions, eq(prescriptions.id, prescriptionItems.prescriptionId))
    .where(and(inArray(prescriptionItems.id, itemIds), eq(prescriptions.patientId, patientId)));
  const supplied = await suppliedQuantities(items.map((i) => i.id));
  return new Map(items.map((i) => [i.id, { remaining: Math.max(0, i.qty - (supplied.get(i.id) ?? 0)), medicineId: i.medicineId }]));
}

export async function addPrescriptionToCartAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { patient } = await requirePatient();
  const rxCode = String(formData.get("rx") ?? "");
  const onlyItem = formData.get("item") ? Number(formData.get("item")) : null;
  const [rx] = await db.select().from(prescriptions).where(and(eq(prescriptions.code, rxCode), eq(prescriptions.patientId, patient.id)));
  if (!rx) return fail("Prescription not found.");
  const items = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, rx.id));
  const remaining = await remainingForItems(patient.id, items.map((i) => i.id));
  const meds = await db.select().from(medicines).where(inArray(medicines.id, items.map((i) => i.medicineId ?? 0)));
  const medById = new Map(meds.map((m) => [m.id, m]));

  let added = 0;
  const skipped: string[] = [];
  for (const it of items) {
    if (onlyItem && it.id !== onlyItem) continue;
    const med = it.medicineId ? medById.get(it.medicineId) : undefined;
    const left = remaining.get(it.id)?.remaining ?? 0;
    if (!med || !med.active) {
      skipped.push(`${it.medicineName} (not stocked)`);
      continue;
    }
    if (left <= 0) continue;
    if (med.stock <= 0) {
      skipped.push(`${med.name} (out of stock)`);
      continue;
    }
    const qty = Math.min(left, med.stock);
    await db
      .insert(cartItems)
      .values({ patientId: patient.id, medicineId: med.id, prescriptionItemId: it.id, quantity: qty })
      .onConflictDoUpdate({ target: [cartItems.patientId, cartItems.medicineId], set: { quantity: qty, prescriptionItemId: it.id } });
    added++;
  }
  revalidatePath("/patient", "layout");
  if (!added && !skipped.length) return ok("Everything on this prescription has already been supplied.");
  if (!added) return fail(`Nothing could be added: ${skipped.join(", ")}.`);
  return ok(`${added} medicine${added === 1 ? "" : "s"} added to your cart.${skipped.length ? ` Not added: ${skipped.join(", ")}.` : ""}`, { added });
}

export async function addOtcToCartAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { patient } = await requirePatient();
  const medicineId = Number(formData.get("medicineId"));
  const [med] = await db.select().from(medicines).where(eq(medicines.id, medicineId));
  if (!med || !med.active) return fail("Product not available.");
  if (med.rxRequired) return fail("This medicine needs a doctor's prescription.");
  if (med.stock <= 0) return fail("Out of stock.");
  const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.patientId, patient.id), eq(cartItems.medicineId, med.id)));
  const qty = Math.min(med.stock, (existing?.quantity ?? 0) + (med.unitPrice >= 50 ? 1 : 10));
  await db
    .insert(cartItems)
    .values({ patientId: patient.id, medicineId: med.id, quantity: qty })
    .onConflictDoUpdate({ target: [cartItems.patientId, cartItems.medicineId], set: { quantity: qty } });
  revalidatePath("/patient", "layout");
  return ok(`${med.name} added to cart.`);
}

export async function updateCartItemAction(formData: FormData) {
  const { patient } = await requirePatient();
  const id = Number(formData.get("id"));
  const qty = Math.floor(Number(formData.get("quantity")));
  const [item] = await db
    .select({ item: cartItems, stock: medicines.stock })
    .from(cartItems)
    .innerJoin(medicines, eq(medicines.id, cartItems.medicineId))
    .where(and(eq(cartItems.id, id), eq(cartItems.patientId, patient.id)));
  if (!item) return;
  if (!(qty > 0)) {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  } else {
    let cap = item.stock;
    if (item.item.prescriptionItemId) {
      const rem = await remainingForItems(patient.id, [item.item.prescriptionItemId]);
      cap = Math.min(cap, rem.get(item.item.prescriptionItemId)?.remaining ?? 0);
    }
    await db.update(cartItems).set({ quantity: Math.max(1, Math.min(qty, cap)) }).where(eq(cartItems.id, id));
  }
  revalidatePath("/patient", "layout");
}

export async function removeCartItemAction(formData: FormData) {
  const { patient } = await requirePatient();
  await db.delete(cartItems).where(and(eq(cartItems.id, Number(formData.get("id"))), eq(cartItems.patientId, patient.id)));
  revalidatePath("/patient", "layout");
}

const checkoutSchema = z
  .object({
    fulfilment: z.enum(["pickup", "delivery"]),
    address: z.string().trim().max(300).optional().default(""),
    paymentMethod: z.enum(PAY_METHODS, "Choose a payment method"),
  })
  .refine((v) => v.fulfilment === "pickup" || v.address.length >= 10, { path: ["address"], message: "Enter the full delivery address" });

export async function checkoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, patient } = await requirePatient();
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please complete the form.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;

  const lines = await db
    .select({ item: cartItems, med: medicines })
    .from(cartItems)
    .innerJoin(medicines, eq(medicines.id, cartItems.medicineId))
    .where(eq(cartItems.patientId, patient.id));
  if (!lines.length) return fail("Your cart is empty.");

  const remaining = await remainingForItems(
    patient.id,
    lines.map((l) => l.item.prescriptionItemId).filter((x): x is number => x != null),
  );
  for (const l of lines) {
    if (l.med.rxRequired && !l.item.prescriptionItemId) return fail(`${l.med.name} needs a prescription. Remove it to continue.`);
    if (l.item.prescriptionItemId) {
      const left = remaining.get(l.item.prescriptionItemId)?.remaining ?? 0;
      if (l.item.quantity > left) return fail(`${l.med.name}: only ${left} more unit(s) remain on your prescription.`);
    }
    if (l.item.quantity > l.med.stock) return fail(`${l.med.name}: only ${l.med.stock} unit(s) in stock right now.`);
  }

  const settings = await getSettings();
  const subtotal = money(lines.reduce((s, l) => s + l.item.quantity * l.med.unitPrice, 0));
  const discount = money((subtotal * Number(settings.pharmacyDiscountPercent || 0)) / 100);
  const deliveryFee = v.fulfilment === "delivery" && subtotal < Number(settings.freeDeliveryAbove) ? Number(settings.deliveryFee) : 0;
  const total = money(subtotal - discount + deliveryFee);
  const address = v.fulfilment === "delivery" ? v.address : null;

  let orderCode: string;
  try {
    orderCode = await withUniqueCode("ORD", async (code) => {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .insert(pharmacyOrders)
          .values({ code, patientId: patient.id, status: "placed", fulfilment: v.fulfilment, deliveryAddress: address, subtotal, discount, deliveryFee, total, paymentMethod: v.paymentMethod, paymentStatus: "paid" })
          .returning();
        for (const l of lines) {
          await deductStock(tx, { medicineId: l.med.id, quantity: l.item.quantity, type: "order", reference: code, userId: user.id, note: "Online order" });
          await tx.insert(pharmacyOrderItems).values({
            orderId: order.id,
            medicineId: l.med.id,
            prescriptionItemId: l.item.prescriptionItemId,
            name: l.med.name,
            quantity: l.item.quantity,
            unitPrice: l.med.unitPrice,
            lineTotal: money(l.item.quantity * l.med.unitPrice),
          });
        }
        await withUniqueCode("PAY", (payCode) =>
          tx.insert(payments).values({ code: payCode, patientId: patient.id, purpose: "pharmacy_order", reference: code, description: `Pharmacy order (${lines.length} item${lines.length === 1 ? "" : "s"})`, amount: total, method: v.paymentMethod }),
        );
        await tx.delete(cartItems).where(eq(cartItems.patientId, patient.id));
      });
      return code;
    });
  } catch (err) {
    if (err instanceof StockError) return fail(err.message);
    throw err;
  }

  await notify(user.id, "Order placed", `${orderCode} · ${inr(total, { paise: true })} paid. ${v.fulfilment === "pickup" ? "We'll notify you when it's ready at the pharmacy counter." : "We'll notify you when it's out for delivery."}`, `/patient/orders/${orderCode}`);
  const staff = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "pharmacist"), eq(users.active, true)));
  for (const s of staff) await notify(s.id, "New online order", `${orderCode} from ${user.name} (${patient.uhid}) — ${v.fulfilment}.`, `/pharmacy/orders/${orderCode}`);
  await audit({ id: user.id, name: user.name, role: "patient" }, "place_order", "pharmacy_order", orderCode, `${lines.length} items, ${total}`);
  revalidatePath("/patient", "layout");
  redirect(`/patient/orders/${orderCode}?placed=1`);
}

export async function cancelOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, patient } = await requirePatient();
  const code = String(formData.get("code") ?? "");
  const [order] = await db.select().from(pharmacyOrders).where(and(eq(pharmacyOrders.code, code), eq(pharmacyOrders.patientId, patient.id)));
  if (!order) return fail("Order not found.");
  if (order.status !== "placed") return fail("This order is already being prepared and can't be cancelled online. Please call the pharmacy.");
  await db.transaction(async (tx) => {
    await restoreOrderStock(tx, code, user.id, "Cancelled by patient");
    await tx.update(pharmacyOrders).set({ status: "cancelled", paymentStatus: "refunded", notes: "Cancelled by patient", updatedAt: new Date().toISOString() }).where(eq(pharmacyOrders.id, order.id));
    await tx.update(payments).set({ status: "refunded" }).where(and(eq(payments.reference, code), eq(payments.purpose, "pharmacy_order")));
  });
  await notify(user.id, "Order cancelled", `${code} cancelled. ${inr(order.total, { paise: true })} will be refunded in 3–5 working days.`, `/patient/orders/${code}`);
  await audit({ id: user.id, name: user.name, role: "patient" }, "cancel", "pharmacy_order", code);
  revalidatePath("/patient", "layout");
  return ok("Order cancelled and refund initiated.");
}

/* ======================================================================
 * Health packages
 * ==================================================================== */

export async function bookPackageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, patient } = await requirePatient();
  const packageId = Number(formData.get("packageId"));
  const date = String(formData.get("date") ?? "");
  const method = String(formData.get("paymentMethod") ?? "");
  const [pkg] = await db.select().from(healthPackages).where(and(eq(healthPackages.id, packageId), eq(healthPackages.active, true)));
  if (!pkg) return fail("Choose a health check package.");
  const today = clinicNow().date;
  if (!isValidDate(date) || date <= today || date > addDays(today, 30)) return fail("Choose a date between tomorrow and the next 30 days.");
  if (!PAY_METHODS.includes(method as (typeof PAY_METHODS)[number])) return fail("Choose a payment method.");
  const code = await withUniqueCode("HCP", async (c) => {
    await db.transaction(async (tx) => {
      await tx.insert(packageBookings).values({ code: c, packageId: pkg.id, patientId: patient.id, date, amount: pkg.price });
      await withUniqueCode("PAY", (p) => tx.insert(payments).values({ code: p, patientId: patient.id, purpose: "health_package", reference: c, description: pkg.name, amount: pkg.price, method }));
    });
    return c;
  });
  await notify(user.id, "Health check booked", `${pkg.name} on ${fmtDay(date)}. Report at 8:00 AM to the Health Check Lounge (Block A, Ground floor) after 10–12 hours of fasting.`, "/patient/health-checks");
  await audit({ id: user.id, name: user.name, role: "patient" }, "book", "health_package", code, pkg.name);
  revalidatePath("/patient", "layout");
  return ok(`Booked ${pkg.name} for ${fmtDay(date)} · Ref ${code}`);
}

/* ======================================================================
 * Profile
 * ==================================================================== */

const opt = (max = 120) => z.string().trim().max(max).optional().transform((s) => s || null);
const optNum = (min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((s) => (s ? Number(s) : null))
    .refine((n) => n == null || (Number.isFinite(n) && n >= min && n <= max), `Enter a value between ${min} and ${max}`);

const profileSchema = z.object({
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a valid 10-digit mobile number"),
  address: opt(200),
  city: opt(60),
  pincode: z.string().trim().regex(/^(\d{6})?$/, "6-digit PIN code").optional().transform((s) => s || null),
  bloodGroup: opt(4),
  emergencyName: opt(80),
  emergencyRelation: opt(40),
  emergencyPhone: opt(20),
  allergies: opt(300),
  chronicConditions: opt(300),
  heightCm: optNum(40, 250),
  weightKg: optNum(2, 300),
  insuranceProvider: opt(100),
  insurancePolicyNo: opt(60),
});

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, patient } = await requirePatient();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const { phone, ...rest } = parsed.data;
  const digits = phone.replace(/\D/g, "").slice(-10);
  await db.update(users).set({ phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` }).where(eq(users.id, user.id));
  await db.update(patients).set(rest).where(eq(patients.id, patient.id));
  await audit({ id: user.id, name: user.name, role: "patient" }, "update", "patient_profile", patient.uhid);
  revalidatePath("/patient", "layout");
  return ok("Profile updated.");
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePatient();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return fail("Your current password is incorrect.", { current: "Incorrect password" });
  if (next.length < 8 || !/\d/.test(next) || !/[A-Za-z]/.test(next)) return fail("Use at least 8 characters with a letter and a number.", { next: "Too weak" });
  if (next !== confirm) return fail("New passwords don't match.", { confirm: "Doesn't match" });
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  await audit({ id: user.id, name: user.name, role: "patient" }, "change_password", "user", user.code);
  return ok("Password changed.");
}

export async function markNotificationsReadAction() {
  const { user } = await requirePatient();
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  revalidatePath("/patient", "layout");
}

/** Used by the reschedule picker — slots for a doctor across the booking window. */
export async function rescheduleSlotsAction(code: string) {
  const { patient } = await requirePatient();
  const [appt] = await db.select().from(appointments).where(and(eq(appointments.code, code), eq(appointments.patientId, patient.id)));
  if (!appt) return [];
  const days = await getDoctorAvailability(appt.doctorId, clinicNow().date, await getNumberSetting("bookingWindowDays"), appt.mode);
  return days.map((d) => ({ date: d.date, slots: d.slots.filter((s) => s.state === "available").map((s) => s.time) }));
}
