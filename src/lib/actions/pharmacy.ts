"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  dispenseItems,
  dispenses,
  medicineBatches,
  medicines,
  MEDICINE_FORMS,
  notifications,
  patients,
  payments,
  pharmacyOrders,
  prescriptionItems,
  prescriptions,
  type OrderStatus,
} from "@/db/schema";
import { fail, ok, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { audit, notify } from "@/lib/audit";
import { requirePharmacist } from "@/lib/auth/session";
import { makeCode, withUniqueCode } from "@/lib/codes";
import { inr, money } from "@/lib/format";
import { adjustBatch, deductStock, receiveStock, restoreOrderStock, StockError, suppliedQuantities } from "@/lib/pharmacy";
import { todayISO } from "@/lib/time";

type Actor = { id: number; name: string; role: string };
const actorOf = (u: { id: number; name: string; role: string }): Actor => ({ id: u.id, name: u.name, role: u.role });

function revalidatePharmacy() {
  revalidatePath("/pharmacy", "layout");
}

/* ------------------------------------------------------------------ dispense */

const lineSchema = z.object({
  medicineId: z.number().int().positive(),
  prescriptionItemId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().positive("Quantity must be at least 1").max(10000),
});

const dispenseSchema = z.object({
  prescriptionId: z.coerce.number().int().positive().optional(),
  customerName: z.string().trim().max(80).optional(),
  customerPhone: z.string().trim().max(20).optional(),
  uhid: z.string().trim().max(20).optional(),
  paymentMethod: z.enum(["cash", "upi", "card", "insurance"], "Choose a payment method"),
  discountPercent: z.coerce.number().min(0, "Discount can't be negative").max(30, "Discount can't exceed 30%"),
  override: z.enum(["on"]).optional(),
  notes: z.string().trim().max(300).optional(),
  lines: z.string(),
});

/**
 * Records a counter sale: against a prescription (store agent recording what
 * the doctor prescribed and what was handed over) or a walk-in OTC sale.
 */
export async function createDispenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePharmacist();
  const raw = Object.fromEntries(formData);
  for (const k of ["prescriptionId", "customerName", "customerPhone", "uhid", "notes", "override"]) if (raw[k] === "") delete raw[k];
  const parsed = dispenseSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;

  let lines: z.infer<typeof lineSchema>[];
  try {
    lines = z.array(lineSchema).min(1, "Add at least one medicine to the bill.").parse(JSON.parse(v.lines));
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : null;
    return fail(msg ?? "Add at least one medicine to the bill.");
  }
  // Merge duplicate medicine lines
  const merged = new Map<string, z.infer<typeof lineSchema>>();
  for (const l of lines) {
    const key = `${l.medicineId}|${l.prescriptionItemId ?? ""}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, quantity: prev.quantity + l.quantity } : l);
  }
  lines = [...merged.values()];

  const medRows = await db.select().from(medicines).where(inArray(medicines.id, lines.map((l) => l.medicineId)));
  const medById = new Map(medRows.map((m) => [m.id, m]));
  for (const l of lines) {
    const m = medById.get(l.medicineId);
    if (!m) return fail("One of the medicines on this bill no longer exists.");
    if (!m.active) return fail(`${m.name} is inactive and can't be sold.`);
  }

  let patientId: number | null = null;
  let patientUserId: number | null = null;
  let rxCode: string | null = null;

  if (v.prescriptionId) {
    const [rx] = await db
      .select({ id: prescriptions.id, code: prescriptions.code, patientId: prescriptions.patientId, userId: patients.userId })
      .from(prescriptions)
      .innerJoin(patients, eq(patients.id, prescriptions.patientId))
      .where(eq(prescriptions.id, v.prescriptionId));
    if (!rx) return fail("Prescription not found.");
    patientId = rx.patientId;
    patientUserId = rx.userId;
    rxCode = rx.code;
    const items = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, rx.id));
    const itemById = new Map(items.map((i) => [i.id, i]));
    const supplied = await suppliedQuantities(items.map((i) => i.id));
    for (const l of lines) {
      const m = medById.get(l.medicineId)!;
      if (!l.prescriptionItemId) {
        if (m.rxRequired) return fail(`${m.name} needs a prescription and isn't on ${rx.code}.`);
        continue;
      }
      const it = itemById.get(l.prescriptionItemId);
      if (!it || it.medicineId !== l.medicineId) return fail(`${m.name} doesn't match an item on ${rx.code}.`);
      const remaining = Math.max(0, it.quantity - (supplied.get(it.id) ?? 0));
      if (l.quantity > remaining && v.override !== "on") {
        return fail(`${m.name}: only ${remaining} unit(s) remain on this prescription. Tick “override” if the doctor has approved more.`);
      }
    }
  } else {
    for (const l of lines) {
      const m = medById.get(l.medicineId)!;
      if (m.rxRequired) return fail(`${m.name} is a prescription-only medicine. Dispense it against a prescription.`);
    }
    if (v.uhid) {
      const [p] = await db.select({ id: patients.id, userId: patients.userId }).from(patients).where(sql`upper(${patients.uhid}) = ${v.uhid.toUpperCase()}`);
      if (!p) return fail(`No patient found with UHID ${v.uhid}.`, { uhid: "Not found" });
      patientId = p.id;
      patientUserId = p.userId;
    }
  }

  const subtotal = money(lines.reduce((s, l) => s + l.quantity * medById.get(l.medicineId)!.unitPrice, 0));
  const discount = money((subtotal * v.discountPercent) / 100);
  const total = money(subtotal - discount);

  let code: string;
  try {
    code = await withUniqueCode("DSP", async (dspCode) => {
      await db.transaction(async (tx) => {
        const itemRows: (typeof dispenseItems.$inferInsert)[] = [];
        for (const l of lines) {
          const m = medById.get(l.medicineId)!;
          const allocs = await deductStock(tx, {
            medicineId: m.id,
            quantity: l.quantity,
            type: "dispense",
            reference: dspCode,
            userId: user.id,
            note: rxCode ? `Dispensed against ${rxCode}` : "Counter sale (OTC)",
          });
          itemRows.push({
            dispenseId: 0,
            medicineId: m.id,
            prescriptionItemId: l.prescriptionItemId ?? null,
            name: m.name,
            batchNo: allocs.map((a) => a.batchNo).join(", "),
            quantity: l.quantity,
            unitPrice: m.unitPrice,
            lineTotal: money(l.quantity * m.unitPrice),
          });
        }
        const [d] = await tx
          .insert(dispenses)
          .values({
            code: dspCode,
            prescriptionId: v.prescriptionId ?? null,
            patientId,
            customerName: patientId ? null : v.customerName || "Walk-in customer",
            customerPhone: patientId ? null : v.customerPhone || null,
            pharmacistId: user.id,
            subtotal,
            discount,
            total,
            paymentMethod: v.paymentMethod,
            notes: [v.notes, v.override === "on" ? "Quantity override applied" : null].filter(Boolean).join(" · ") || null,
          })
          .returning({ id: dispenses.id });
        await tx.insert(dispenseItems).values(itemRows.map((r) => ({ ...r, dispenseId: d.id })));
        await tx.insert(payments).values({
          code: makeCode("PAY"),
          patientId,
          purpose: "pharmacy_counter",
          reference: dspCode,
          description: rxCode ? `Pharmacy counter bill against ${rxCode}` : "Pharmacy counter sale (OTC)",
          amount: total,
          method: v.paymentMethod,
        });
      });
      return dspCode;
    });
  } catch (err) {
    if (err instanceof StockError) return fail(err.message);
    console.error(err);
    return fail("The bill couldn't be saved. Please try again.");
  }

  await audit(actorOf(user), "dispense", "dispense", code, `${lines.length} item(s), ${inr(total, { paise: true })}${rxCode ? ` against ${rxCode}` : " (OTC)"}`);
  if (patientUserId) {
    await notify(
      patientUserId,
      "Medicines dispensed",
      `${lines.length} item(s) dispensed at the hospital pharmacy${rxCode ? ` against ${rxCode}` : ""}. Amount paid ${inr(total, { paise: true })}.`,
      "/patient/bills",
    );
  }
  revalidatePharmacy();
  redirect(`/pharmacy/sales/${code}?new=1`);
}

/* -------------------------------------------------------------- online orders */

const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  placed: ["processing"],
  processing: ["ready", "out_for_delivery"],
  ready: ["completed"],
  out_for_delivery: ["completed"],
  completed: [],
  cancelled: [],
};

const STATUS_MESSAGE: Record<OrderStatus, (code: string) => [string, string]> = {
  placed: (c) => ["Order placed", `Order ${c} has been placed.`],
  processing: (c) => ["Your medicines are being packed", `The hospital pharmacy has started packing order ${c}.`],
  ready: (c) => ["Order ready for pickup", `Order ${c} is ready. Collect it from the pharmacy counter (Block A, Ground floor) with your UHID.`],
  out_for_delivery: (c) => ["Out for delivery", `Order ${c} is on its way to you.`],
  completed: (c) => ["Order completed", `Order ${c} has been handed over. Get well soon!`],
  cancelled: (c) => ["Order cancelled", `Order ${c} was cancelled and your payment has been refunded.`],
};

export async function updateOrderStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePharmacist();
  const code = String(formData.get("code") ?? "");
  const next = String(formData.get("next") ?? "") as OrderStatus;
  const [order] = await db
    .select({ id: pharmacyOrders.id, status: pharmacyOrders.status, fulfilment: pharmacyOrders.fulfilment, patientId: pharmacyOrders.patientId, userId: patients.userId })
    .from(pharmacyOrders)
    .innerJoin(patients, eq(patients.id, pharmacyOrders.patientId))
    .where(eq(pharmacyOrders.code, code));
  if (!order) return fail("Order not found.");
  if (!NEXT_STATUS[order.status].includes(next)) return fail("That status change isn't allowed for this order.");
  if (next === "ready" && order.fulfilment !== "pickup") return fail("Delivery orders go out for delivery, not to the pickup counter.");
  if (next === "out_for_delivery" && order.fulfilment !== "delivery") return fail("Pickup orders are marked ready for pickup.");

  const updated = await db
    .update(pharmacyOrders)
    .set({ status: next, handledBy: user.id, updatedAt: new Date().toISOString() })
    .where(and(eq(pharmacyOrders.id, order.id), eq(pharmacyOrders.status, order.status)))
    .returning({ id: pharmacyOrders.id });
  if (!updated.length) return fail("This order was updated by someone else. Refresh to see the latest status.");

  const [title, body] = STATUS_MESSAGE[next](code);
  await notify(order.userId, title, body, `/patient/orders/${code}`);
  await audit(actorOf(user), `order_${next}`, "pharmacy_order", code);
  revalidatePharmacy();
  revalidatePath(`/patient/orders/${code}`);
  return ok(`Order marked “${next.replace(/_/g, " ")}”.`);
}

export async function cancelOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePharmacist();
  const code = String(formData.get("code") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 4) return fail("Please enter a reason for cancelling.", { reason: "Required" });
  const [order] = await db
    .select({ id: pharmacyOrders.id, status: pharmacyOrders.status, notes: pharmacyOrders.notes, userId: patients.userId, total: pharmacyOrders.total })
    .from(pharmacyOrders)
    .innerJoin(patients, eq(patients.id, pharmacyOrders.patientId))
    .where(eq(pharmacyOrders.code, code));
  if (!order) return fail("Order not found.");
  if (order.status === "completed" || order.status === "cancelled") return fail("Completed or cancelled orders can't be cancelled.");

  try {
    await db.transaction(async (tx) => {
      const res = await tx
        .update(pharmacyOrders)
        .set({
          status: "cancelled",
          paymentStatus: "refunded",
          handledBy: user.id,
          notes: [order.notes, `Cancelled by pharmacy: ${reason}`].filter(Boolean).join("\n"),
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(pharmacyOrders.id, order.id), eq(pharmacyOrders.status, order.status)))
        .returning({ id: pharmacyOrders.id });
      if (!res.length) throw new StockError("This order was updated by someone else. Refresh and try again.");
      await restoreOrderStock(tx, code, user.id, `Order cancelled by pharmacy — ${reason}`);
      await tx.update(payments).set({ status: "refunded" }).where(eq(payments.reference, code));
    });
  } catch (err) {
    if (err instanceof StockError) return fail(err.message);
    console.error(err);
    return fail("Couldn't cancel the order. Please try again.");
  }
  await notify(order.userId, "Order cancelled", `Order ${code} was cancelled by the pharmacy (${reason}). ${inr(order.total, { paise: true })} will be refunded to your original payment method.`, `/patient/orders/${code}`);
  await audit(actorOf(user), "order_cancelled", "pharmacy_order", code, reason);
  revalidatePharmacy();
  revalidatePath(`/patient/orders/${code}`);
  return ok("Order cancelled, stock returned to shelf and refund initiated.");
}

/* ------------------------------------------------------------------ inventory */

const medicineSchema = z.object({
  name: z.string().trim().min(2, "Enter the product name").max(120),
  genericName: z.string().trim().min(2, "Enter the generic / salt name").max(160),
  manufacturer: z.string().trim().min(2, "Enter the manufacturer").max(80),
  category: z.string().trim().min(2, "Enter a category").max(60),
  form: z.enum(MEDICINE_FORMS, "Choose a dosage form"),
  strength: z.string().trim().max(60).optional(),
  unitLabel: z.string().trim().min(1, "e.g. tablet, 100 ml bottle").max(40),
  unitPrice: z.coerce.number().positive("Enter the MRP per unit").max(100000),
  rxRequired: z.enum(["on"]).optional(),
  reorderLevel: z.coerce.number().int().min(0).max(100000),
  rack: z.string().trim().max(20).optional(),
  hsn: z.string().trim().max(12).optional(),
  gstPercent: z.coerce.number().int().refine((n) => [0, 5, 12, 18, 28].includes(n), "GST must be 0, 5, 12, 18 or 28%"),
});

export async function addMedicineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePharmacist();
  const raw = Object.fromEntries(formData);
  for (const k of ["strength", "rack", "hsn", "rxRequired"]) if (raw[k] === "") delete raw[k];
  const parsed = medicineSchema.safeParse(raw);
  if (!parsed.success) return fail("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;

  const [dup] = await db.select({ sku: medicines.sku }).from(medicines).where(sql`lower(${medicines.name}) = ${v.name.toLowerCase()}`);
  if (dup) return fail(`A medicine with this name already exists (${dup.sku}).`, { name: "Duplicate" });

  let sku = "";
  for (let attempt = 0; attempt < 5 && !sku; attempt++) {
    const [row] = await db.select({ max: sql<number>`coalesce(max(cast(substr(${medicines.sku}, 5) as integer)), 0)` }).from(medicines);
    const candidate = `MED-${String(Number(row.max) + 1 + attempt).padStart(4, "0")}`;
    try {
      await db.insert(medicines).values({
        sku: candidate,
        name: v.name,
        genericName: v.genericName,
        manufacturer: v.manufacturer,
        category: v.category,
        form: v.form,
        strength: v.strength ?? null,
        unitLabel: v.unitLabel,
        unitPrice: v.unitPrice,
        rxRequired: v.rxRequired === "on",
        reorderLevel: v.reorderLevel,
        rack: v.rack ?? null,
        hsn: v.hsn ?? null,
        gstPercent: v.gstPercent,
        stock: 0,
      });
      sku = candidate;
    } catch (err) {
      if (!String((err as Error)?.message ?? err).includes("UNIQUE") && !String((err as { cause?: Error })?.cause?.message ?? "").includes("UNIQUE")) throw err;
    }
  }
  if (!sku) return fail("Couldn't allocate a SKU. Please try again.");
  await audit(actorOf(user), "medicine_added", "medicine", sku, v.name);
  revalidatePharmacy();
  redirect(`/pharmacy/inventory/${sku}?added=1`);
}

const updateMedicineSchema = z.object({
  id: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().positive("Enter the MRP per unit").max(100000),
  reorderLevel: z.coerce.number().int().min(0).max(100000),
  rack: z.string().trim().max(20).optional(),
  category: z.string().trim().min(2).max(60),
  gstPercent: z.coerce.number().int().refine((n) => [0, 5, 12, 18, 28].includes(n), "GST must be 0, 5, 12, 18 or 28%"),
  rxRequired: z.enum(["on"]).optional(),
  active: z.enum(["on"]).optional(),
});

export async function updateMedicineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePharmacist();
  const raw = Object.fromEntries(formData);
  if (raw.rack === "") delete raw.rack;
  const parsed = updateMedicineSchema.safeParse(raw);
  if (!parsed.success) return fail("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const [before] = await db.select().from(medicines).where(eq(medicines.id, v.id));
  if (!before) return fail("Medicine not found.");
  await db
    .update(medicines)
    .set({
      unitPrice: v.unitPrice,
      reorderLevel: v.reorderLevel,
      rack: v.rack ?? null,
      category: v.category,
      gstPercent: v.gstPercent,
      rxRequired: v.rxRequired === "on",
      active: v.active === "on",
    })
    .where(eq(medicines.id, v.id));
  const changes = [
    before.unitPrice !== v.unitPrice && `MRP ${inr(before.unitPrice, { paise: true })} → ${inr(v.unitPrice, { paise: true })}`,
    before.reorderLevel !== v.reorderLevel && `reorder ${before.reorderLevel} → ${v.reorderLevel}`,
    before.active !== (v.active === "on") && (v.active === "on" ? "activated" : "deactivated"),
  ].filter(Boolean);
  await audit(actorOf(user), "medicine_updated", "medicine", before.sku, changes.join(", ") || "details updated");
  revalidatePharmacy();
  return ok("Medicine details saved.");
}

const receiveSchema = z.object({
  medicineId: z.coerce.number().int().positive(),
  batchNo: z.string().trim().min(2, "Enter the batch number").max(30).transform((s) => s.toUpperCase()),
  expiryDate: z.iso.date("Enter the expiry date"),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1").max(100000),
  costPrice: z.coerce.number().min(0, "Cost can't be negative").max(100000),
  supplier: z.string().trim().min(2, "Enter the supplier").max(80),
  invoiceNo: z.string().trim().min(2, "Enter the purchase invoice number").max(40),
});

export async function receiveStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePharmacist();
  const parsed = receiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  if (v.expiryDate <= todayISO()) return fail("This batch has already expired — it can't be received.", { expiryDate: "Already expired" });
  const [med] = await db.select().from(medicines).where(eq(medicines.id, v.medicineId));
  if (!med) return fail("Medicine not found.");
  if (v.costPrice > med.unitPrice) return fail(`Cost price (${inr(v.costPrice, { paise: true })}) is higher than MRP (${inr(med.unitPrice, { paise: true })}). Check the invoice.`, { costPrice: "Above MRP" });
  const [dup] = await db
    .select({ id: medicineBatches.id })
    .from(medicineBatches)
    .where(and(eq(medicineBatches.medicineId, med.id), eq(medicineBatches.batchNo, v.batchNo)));
  if (dup) return fail(`Batch ${v.batchNo} already exists for this medicine. Use a stock adjustment instead.`, { batchNo: "Duplicate batch" });

  await db.transaction(async (tx) => {
    await receiveStock(tx, { ...v, userId: user.id });
  });
  await audit(actorOf(user), "stock_received", "medicine", med.sku, `${v.quantity} ${med.unitLabel}(s), batch ${v.batchNo}, exp ${v.expiryDate}, inv ${v.invoiceNo}`);
  revalidatePharmacy();
  return ok(`Received ${v.quantity} unit(s) of ${med.name} (batch ${v.batchNo}).`);
}

const adjustSchema = z.object({
  batchId: z.coerce.number().int().positive("Choose a batch"),
  type: z.enum(["adjustment", "expired", "return"]),
  delta: z.coerce.number().int().refine((n) => n !== 0, "Enter a non-zero quantity change").refine((n) => Math.abs(n) <= 100000, "Too large"),
  note: z.string().trim().min(4, "Explain the reason for this adjustment").max(200),
});

export async function adjustBatchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePharmacist();
  const parsed = adjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  if (v.type === "expired" && v.delta > 0) return fail("An expiry / damage write-off must reduce stock (use a negative number).", { delta: "Must be negative" });
  const [batch] = await db
    .select({ batchNo: medicineBatches.batchNo, sku: medicines.sku })
    .from(medicineBatches)
    .innerJoin(medicines, eq(medicines.id, medicineBatches.medicineId))
    .where(eq(medicineBatches.id, v.batchId));
  if (!batch) return fail("Batch not found.");
  try {
    await db.transaction(async (tx) => adjustBatch(tx, { ...v, userId: user.id }));
  } catch (err) {
    if (err instanceof StockError) return fail(err.message);
    throw err;
  }
  await audit(actorOf(user), `stock_${v.type}`, "medicine", batch.sku, `${v.delta > 0 ? "+" : ""}${v.delta} on batch ${batch.batchNo}: ${v.note}`);
  revalidatePharmacy();
  return ok(`Batch ${batch.batchNo} adjusted by ${v.delta > 0 ? "+" : ""}${v.delta}.`);
}

/** One-click write-off of an expired batch's remaining quantity. */
export async function writeOffBatchAction(formData: FormData) {
  const user = await requirePharmacist();
  const batchId = Number(formData.get("batchId"));
  const [batch] = await db
    .select({ id: medicineBatches.id, qty: medicineBatches.quantity, batchNo: medicineBatches.batchNo, expiry: medicineBatches.expiryDate, sku: medicines.sku })
    .from(medicineBatches)
    .innerJoin(medicines, eq(medicines.id, medicineBatches.medicineId))
    .where(eq(medicineBatches.id, batchId));
  if (!batch || batch.qty <= 0) return;
  await db.transaction(async (tx) =>
    adjustBatch(tx, { batchId: batch.id, delta: -batch.qty, type: "expired", note: `Expired on ${batch.expiry} — written off`, userId: user.id }),
  );
  await audit(actorOf(user), "stock_expired", "medicine", batch.sku, `-${batch.qty} written off from batch ${batch.batchNo} (expired ${batch.expiry})`);
  revalidatePharmacy();
}

/* -------------------------------------------------------------- notifications */

export async function markPharmacyNotificationsReadAction() {
  const user = await requirePharmacist();
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  revalidatePharmacy();
}
