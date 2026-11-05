import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, like, lt, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import {
  departments,
  dispenseItems,
  dispenses,
  doctors,
  medicineBatches,
  medicines,
  patients,
  pharmacyOrderItems,
  pharmacyOrders,
  prescriptionItems,
  prescriptions,
  stockMovements,
  users,
  type OrderStatus,
} from "@/db/schema";
import { prescriptionSupplyStatus } from "@/lib/pharmacy";
import { addDays, todayISO } from "@/lib/time";

/* --------------------------------------------------------------- helpers */

/** UTC ISO bounds for an inclusive range of IST calendar days. */
export function istRange(fromDate: string, toDate: string) {
  return {
    start: new Date(`${fromDate}T00:00:00+05:30`).toISOString(),
    end: new Date(`${addDays(toDate, 1)}T00:00:00+05:30`).toISOString(),
  };
}

const patientUser = alias(users, "patient_user");
const doctorUser = alias(users, "doctor_user");
const staffUser = alias(users, "staff_user");

export const PENDING_ORDER_STATUSES: OrderStatus[] = ["placed", "processing", "ready", "out_for_delivery"];

/* ------------------------------------------------------------ shell data */

export async function pharmacyBadges() {
  const today = todayISO();
  const [[orders], [low], [expiring]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(pharmacyOrders)
      .where(inArray(pharmacyOrders.status, ["placed", "processing"])),
    db
      .select({ n: sql<number>`count(*)` })
      .from(medicines)
      .where(and(eq(medicines.active, true), lte(medicines.stock, medicines.reorderLevel))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(medicineBatches)
      .where(and(gt(medicineBatches.quantity, 0), lte(medicineBatches.expiryDate, addDays(today, 30)))),
  ]);
  return { pendingOrders: Number(orders.n), stockAlerts: Number(low.n) + Number(expiring.n) };
}

/* ------------------------------------------------------------- dashboard */

export async function getDashboard() {
  const today = todayISO();
  const { start, end } = istRange(today, today);
  const weekStart = istRange(addDays(today, -6), today).start;

  const [[sales], [orderSales], orderCounts, [low], [out], [expiring], recent, top] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${dispenses.total}), 0)`, n: sql<number>`count(*)` })
      .from(dispenses)
      .where(and(gte(dispenses.createdAt, start), lt(dispenses.createdAt, end))),
    db
      .select({ total: sql<number>`coalesce(sum(${pharmacyOrders.total}), 0)`, n: sql<number>`count(*)` })
      .from(pharmacyOrders)
      .where(and(gte(pharmacyOrders.createdAt, start), lt(pharmacyOrders.createdAt, end), sql`${pharmacyOrders.status} <> 'cancelled'`)),
    db
      .select({ status: pharmacyOrders.status, n: sql<number>`count(*)` })
      .from(pharmacyOrders)
      .where(inArray(pharmacyOrders.status, PENDING_ORDER_STATUSES))
      .groupBy(pharmacyOrders.status),
    db
      .select({ n: sql<number>`count(*)` })
      .from(medicines)
      .where(and(eq(medicines.active, true), gt(medicines.stock, 0), lte(medicines.stock, medicines.reorderLevel))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(medicines)
      .where(and(eq(medicines.active, true), lte(medicines.stock, 0))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(medicineBatches)
      .where(and(gt(medicineBatches.quantity, 0), gt(medicineBatches.expiryDate, today), lte(medicineBatches.expiryDate, addDays(today, 60)))),
    recentBills(8),
    db
      .select({
        medicineId: stockMovements.medicineId,
        name: medicines.name,
        sku: medicines.sku,
        units: sql<number>`sum(-${stockMovements.quantity})`,
        revenue: sql<number>`sum(-${stockMovements.quantity} * ${medicines.unitPrice})`,
      })
      .from(stockMovements)
      .innerJoin(medicines, eq(medicines.id, stockMovements.medicineId))
      .where(and(inArray(stockMovements.type, ["dispense", "order"]), gte(stockMovements.createdAt, weekStart)))
      .groupBy(stockMovements.medicineId)
      .orderBy(desc(sql`sum(-${stockMovements.quantity} * ${medicines.unitPrice})`))
      .limit(6),
  ]);

  const byStatus = Object.fromEntries(orderCounts.map((r) => [r.status, Number(r.n)])) as Partial<Record<OrderStatus, number>>;

  return {
    todaySales: Number(sales.total),
    todayBills: Number(sales.n),
    todayOrderSales: Number(orderSales.total),
    todayOrders: Number(orderSales.n),
    orders: byStatus,
    pendingOrders: PENDING_ORDER_STATUSES.reduce((s, k) => s + (byStatus[k] ?? 0), 0),
    lowStock: Number(low.n),
    outOfStock: Number(out.n),
    expiringSoon: Number(expiring.n),
    recent,
    top: top.map((t) => ({ ...t, units: Number(t.units), revenue: Number(t.revenue) })),
  };
}

/* ---------------------------------------------------------------- sales */

export async function recentBills(limit: number, filter?: { from?: string; to?: string; q?: string; method?: string }) {
  const conds = [];
  if (filter?.from && filter?.to) {
    const r = istRange(filter.from, filter.to);
    conds.push(gte(dispenses.createdAt, r.start), lt(dispenses.createdAt, r.end));
  }
  if (filter?.method) conds.push(eq(dispenses.paymentMethod, filter.method as "cash"));
  if (filter?.q) {
    const q = `%${filter.q.trim()}%`;
    conds.push(
      or(
        like(dispenses.code, q),
        like(dispenses.customerName, q),
        like(dispenses.customerPhone, q),
        like(patientUser.name, q),
        like(patients.uhid, q),
        like(prescriptions.code, q),
      )!,
    );
  }
  const rows = await db
    .select({
      id: dispenses.id,
      code: dispenses.code,
      total: dispenses.total,
      subtotal: dispenses.subtotal,
      discount: dispenses.discount,
      paymentMethod: dispenses.paymentMethod,
      createdAt: dispenses.createdAt,
      customerName: dispenses.customerName,
      patientName: patientUser.name,
      uhid: patients.uhid,
      rxCode: prescriptions.code,
      pharmacist: staffUser.name,
      items: sql<number>`(select count(*) from ${dispenseItems} where ${dispenseItems.dispenseId} = ${dispenses.id})`,
    })
    .from(dispenses)
    .leftJoin(patients, eq(patients.id, dispenses.patientId))
    .leftJoin(patientUser, eq(patientUser.id, patients.userId))
    .leftJoin(prescriptions, eq(prescriptions.id, dispenses.prescriptionId))
    .innerJoin(staffUser, eq(staffUser.id, dispenses.pharmacistId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(dispenses.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, items: Number(r.items), name: r.patientName ?? r.customerName ?? "Walk-in customer" }));
}

export async function salesSummary(from: string, to: string) {
  const r = istRange(from, to);
  const [byMethod, [orders]] = await Promise.all([
    db
      .select({ method: dispenses.paymentMethod, total: sql<number>`coalesce(sum(${dispenses.total}), 0)`, n: sql<number>`count(*)` })
      .from(dispenses)
      .where(and(gte(dispenses.createdAt, r.start), lt(dispenses.createdAt, r.end)))
      .groupBy(dispenses.paymentMethod),
    db
      .select({ total: sql<number>`coalesce(sum(${pharmacyOrders.total}), 0)`, n: sql<number>`count(*)` })
      .from(pharmacyOrders)
      .where(and(gte(pharmacyOrders.createdAt, r.start), lt(pharmacyOrders.createdAt, r.end), sql`${pharmacyOrders.status} <> 'cancelled'`)),
  ]);
  const methods = byMethod.map((m) => ({ method: m.method, total: Number(m.total), n: Number(m.n) }));
  return {
    methods,
    counterTotal: methods.reduce((s, m) => s + m.total, 0),
    counterBills: methods.reduce((s, m) => s + m.n, 0),
    onlineTotal: Number(orders.total),
    onlineOrders: Number(orders.n),
  };
}

export async function getBill(code: string) {
  const [row] = await db
    .select({
      bill: dispenses,
      patientName: patientUser.name,
      patientPhone: patientUser.phone,
      uhid: patients.uhid,
      rxCode: prescriptions.code,
      rxDate: prescriptions.createdAt,
      doctorName: doctorUser.name,
      pharmacist: staffUser.name,
      pharmacistCode: staffUser.code,
    })
    .from(dispenses)
    .leftJoin(patients, eq(patients.id, dispenses.patientId))
    .leftJoin(patientUser, eq(patientUser.id, patients.userId))
    .leftJoin(prescriptions, eq(prescriptions.id, dispenses.prescriptionId))
    .leftJoin(doctors, eq(doctors.id, prescriptions.doctorId))
    .leftJoin(doctorUser, eq(doctorUser.id, doctors.userId))
    .innerJoin(staffUser, eq(staffUser.id, dispenses.pharmacistId))
    .where(eq(dispenses.code, code))
    .limit(1);
  if (!row) return null;
  const items = await db
    .select({
      id: dispenseItems.id,
      name: dispenseItems.name,
      batchNo: dispenseItems.batchNo,
      quantity: dispenseItems.quantity,
      unitPrice: dispenseItems.unitPrice,
      lineTotal: dispenseItems.lineTotal,
      hsn: medicines.hsn,
      gstPercent: medicines.gstPercent,
      unitLabel: medicines.unitLabel,
      expiry: medicineBatches.expiryDate,
    })
    .from(dispenseItems)
    .innerJoin(medicines, eq(medicines.id, dispenseItems.medicineId))
    .leftJoin(medicineBatches, and(eq(medicineBatches.medicineId, dispenseItems.medicineId), eq(medicineBatches.batchNo, dispenseItems.batchNo)))
    .where(eq(dispenseItems.dispenseId, row.bill.id))
    .orderBy(dispenseItems.id);
  return { ...row, items };
}

/* --------------------------------------------------------------- orders */

export async function listOrders(status: OrderStatus | "all", q?: string) {
  const conds = [];
  if (status !== "all") conds.push(eq(pharmacyOrders.status, status));
  if (q) {
    const like_ = `%${q.trim()}%`;
    conds.push(or(like(pharmacyOrders.code, like_), like(patientUser.name, like_), like(patients.uhid, like_))!);
  }
  const rows = await db
    .select({
      id: pharmacyOrders.id,
      code: pharmacyOrders.code,
      status: pharmacyOrders.status,
      fulfilment: pharmacyOrders.fulfilment,
      total: pharmacyOrders.total,
      paymentStatus: pharmacyOrders.paymentStatus,
      createdAt: pharmacyOrders.createdAt,
      updatedAt: pharmacyOrders.updatedAt,
      patientName: patientUser.name,
      uhid: patients.uhid,
      phone: patientUser.phone,
      items: sql<number>`(select count(*) from ${pharmacyOrderItems} where ${pharmacyOrderItems.orderId} = ${pharmacyOrders.id})`,
    })
    .from(pharmacyOrders)
    .innerJoin(patients, eq(patients.id, pharmacyOrders.patientId))
    .innerJoin(patientUser, eq(patientUser.id, patients.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(status === "completed" || status === "cancelled" ? desc(pharmacyOrders.updatedAt) : asc(pharmacyOrders.createdAt))
    .limit(150);
  return rows.map((r) => ({ ...r, items: Number(r.items) }));
}

export async function orderCounts() {
  const rows = await db.select({ status: pharmacyOrders.status, n: sql<number>`count(*)` }).from(pharmacyOrders).groupBy(pharmacyOrders.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Partial<Record<OrderStatus, number>>;
}

export async function getOrder(code: string) {
  const [row] = await db
    .select({
      order: pharmacyOrders,
      patientName: patientUser.name,
      patientPhone: patientUser.phone,
      patientEmail: patientUser.email,
      patientUserId: patientUser.id,
      uhid: patients.uhid,
      allergies: patients.allergies,
      handledByName: staffUser.name,
    })
    .from(pharmacyOrders)
    .innerJoin(patients, eq(patients.id, pharmacyOrders.patientId))
    .innerJoin(patientUser, eq(patientUser.id, patients.userId))
    .leftJoin(staffUser, eq(staffUser.id, pharmacyOrders.handledBy))
    .where(eq(pharmacyOrders.code, code))
    .limit(1);
  if (!row) return null;
  const items = await db
    .select({
      id: pharmacyOrderItems.id,
      medicineId: pharmacyOrderItems.medicineId,
      name: pharmacyOrderItems.name,
      quantity: pharmacyOrderItems.quantity,
      unitPrice: pharmacyOrderItems.unitPrice,
      lineTotal: pharmacyOrderItems.lineTotal,
      sku: medicines.sku,
      rack: medicines.rack,
      unitLabel: medicines.unitLabel,
      rxRequired: medicines.rxRequired,
      rxCode: prescriptions.code,
      frequency: prescriptionItems.frequency,
      durationDays: prescriptionItems.durationDays,
      doctorName: doctorUser.name,
    })
    .from(pharmacyOrderItems)
    .innerJoin(medicines, eq(medicines.id, pharmacyOrderItems.medicineId))
    .leftJoin(prescriptionItems, eq(prescriptionItems.id, pharmacyOrderItems.prescriptionItemId))
    .leftJoin(prescriptions, eq(prescriptions.id, prescriptionItems.prescriptionId))
    .leftJoin(doctors, eq(doctors.id, prescriptions.doctorId))
    .leftJoin(doctorUser, eq(doctorUser.id, doctors.userId))
    .where(eq(pharmacyOrderItems.orderId, row.order.id))
    .orderBy(pharmacyOrderItems.id);
  const batches = await db
    .select({ medicineId: stockMovements.medicineId, batchNo: medicineBatches.batchNo, expiry: medicineBatches.expiryDate, qty: stockMovements.quantity, type: stockMovements.type })
    .from(stockMovements)
    .leftJoin(medicineBatches, eq(medicineBatches.id, stockMovements.batchId))
    .where(eq(stockMovements.reference, code));
  // Batches picked for each medicine (outgoing "order" movements)
  const batchesByMedicine: Record<number, { batchNo: string | null; expiry: string | null; qty: number }[]> = {};
  for (const b of batches) {
    if (b.type !== "order" || b.qty >= 0) continue;
    (batchesByMedicine[b.medicineId] ??= []).push({ batchNo: b.batchNo, expiry: b.expiry, qty: -b.qty });
  }
  return { ...row, items, batchesByMedicine };
}

/* ------------------------------------------------------------ inventory */

export async function sellableStock(medicineIds: number[]) {
  const out = new Map<number, number>();
  if (!medicineIds.length) return out;
  const rows = await db
    .select({ id: medicineBatches.medicineId, qty: sql<number>`coalesce(sum(${medicineBatches.quantity}), 0)` })
    .from(medicineBatches)
    .where(and(inArray(medicineBatches.medicineId, medicineIds), gt(medicineBatches.expiryDate, todayISO()), gt(medicineBatches.quantity, 0)))
    .groupBy(medicineBatches.medicineId);
  for (const r of rows) out.set(r.id, Number(r.qty));
  return out;
}

export async function inventoryList() {
  const today = todayISO();
  const [meds, expiry] = await Promise.all([
    db.select().from(medicines).orderBy(asc(medicines.name)),
    db
      .select({
        id: medicineBatches.medicineId,
        nearest: sql<string>`min(${medicineBatches.expiryDate})`,
        sellable: sql<number>`coalesce(sum(case when ${medicineBatches.expiryDate} > ${today} then ${medicineBatches.quantity} else 0 end), 0)`,
        costValue: sql<number>`coalesce(sum(${medicineBatches.quantity} * ${medicineBatches.costPrice}), 0)`,
      })
      .from(medicineBatches)
      .where(gt(medicineBatches.quantity, 0))
      .groupBy(medicineBatches.medicineId),
  ]);
  const ex = new Map(expiry.map((e) => [e.id, e]));
  return meds.map((m) => ({
    ...m,
    nearestExpiry: ex.get(m.id)?.nearest ?? null,
    sellable: Number(ex.get(m.id)?.sellable ?? 0),
    costValue: Number(ex.get(m.id)?.costValue ?? 0),
  }));
}

export async function getMedicine(sku: string) {
  const [med] = await db.select().from(medicines).where(eq(medicines.sku, sku)).limit(1);
  if (!med) return null;
  const [batches, ledger] = await Promise.all([
    db.select().from(medicineBatches).where(eq(medicineBatches.medicineId, med.id)).orderBy(asc(medicineBatches.expiryDate), asc(medicineBatches.id)),
    db
      .select({ mv: stockMovements, batchNo: medicineBatches.batchNo, user: staffUser.name })
      .from(stockMovements)
      .leftJoin(medicineBatches, eq(medicineBatches.id, stockMovements.batchId))
      .leftJoin(staffUser, eq(staffUser.id, stockMovements.userId))
      .where(eq(stockMovements.medicineId, med.id))
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(120),
  ]);
  const weekStart = istRange(addDays(todayISO(), -29), todayISO()).start;
  const [sold] = await db
    .select({ units: sql<number>`coalesce(sum(-${stockMovements.quantity}), 0)` })
    .from(stockMovements)
    .where(and(eq(stockMovements.medicineId, med.id), inArray(stockMovements.type, ["dispense", "order"]), gte(stockMovements.createdAt, weekStart)));
  return { med, batches, ledger, sold30: Number(sold.units) };
}

export async function stockAlerts() {
  const today = todayISO();
  const [low, out, expiring, expired] = await Promise.all([
    db
      .select()
      .from(medicines)
      .where(and(eq(medicines.active, true), gt(medicines.stock, 0), lte(medicines.stock, medicines.reorderLevel)))
      .orderBy(asc(sql`${medicines.stock} * 1.0 / max(${medicines.reorderLevel}, 1)`)),
    db.select().from(medicines).where(and(eq(medicines.active, true), lte(medicines.stock, 0))).orderBy(asc(medicines.name)),
    db
      .select({ batch: medicineBatches, name: medicines.name, sku: medicines.sku, unitLabel: medicines.unitLabel, unitPrice: medicines.unitPrice })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicines.id, medicineBatches.medicineId))
      .where(and(gt(medicineBatches.quantity, 0), gt(medicineBatches.expiryDate, today), lte(medicineBatches.expiryDate, addDays(today, 90))))
      .orderBy(asc(medicineBatches.expiryDate)),
    db
      .select({ batch: medicineBatches, name: medicines.name, sku: medicines.sku, unitLabel: medicines.unitLabel, unitPrice: medicines.unitPrice })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicines.id, medicineBatches.medicineId))
      .where(and(gt(medicineBatches.quantity, 0), lte(medicineBatches.expiryDate, today)))
      .orderBy(asc(medicineBatches.expiryDate)),
  ]);
  return { low, out, expiring, expired };
}

export async function stockLedger(filter: { type?: string; from: string; to: string; q?: string }) {
  const r = istRange(filter.from, filter.to);
  const conds = [gte(stockMovements.createdAt, r.start), lt(stockMovements.createdAt, r.end)];
  if (filter.type) conds.push(eq(stockMovements.type, filter.type as "purchase"));
  if (filter.q) {
    const q = `%${filter.q.trim()}%`;
    conds.push(or(like(medicines.name, q), like(medicines.sku, q), like(stockMovements.reference, q), like(medicineBatches.batchNo, q))!);
  }
  const rows = await db
    .select({ mv: stockMovements, name: medicines.name, sku: medicines.sku, unitLabel: medicines.unitLabel, batchNo: medicineBatches.batchNo, user: staffUser.name })
    .from(stockMovements)
    .innerJoin(medicines, eq(medicines.id, stockMovements.medicineId))
    .leftJoin(medicineBatches, eq(medicineBatches.id, stockMovements.batchId))
    .leftJoin(staffUser, eq(staffUser.id, stockMovements.userId))
    .where(and(...conds))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(400);
  const [totals] = await db
    .select({
      inQty: sql<number>`coalesce(sum(case when ${stockMovements.quantity} > 0 then ${stockMovements.quantity} else 0 end), 0)`,
      outQty: sql<number>`coalesce(sum(case when ${stockMovements.quantity} < 0 then -${stockMovements.quantity} else 0 end), 0)`,
      n: sql<number>`count(*)`,
    })
    .from(stockMovements)
    .innerJoin(medicines, eq(medicines.id, stockMovements.medicineId))
    .leftJoin(medicineBatches, eq(medicineBatches.id, stockMovements.batchId))
    .where(and(...conds));
  return { rows, inQty: Number(totals.inQty), outQty: Number(totals.outQty), count: Number(totals.n) };
}

/* -------------------------------------------------------- prescriptions */

/** Hospital-wide prescription register with patient & doctor names. */
export async function prescriptionRegister(filter: { q?: string; status?: string; limit?: number; patientId?: number }) {
  const conds = [];
  if (filter.patientId) conds.push(eq(prescriptions.patientId, filter.patientId));
  if (filter.q) {
    const q = `%${filter.q.trim()}%`;
    conds.push(or(like(prescriptions.code, q), like(patientUser.name, q), like(patients.uhid, q), like(doctorUser.name, q), like(prescriptions.diagnosis, q))!);
  }
  const rows = await db
    .select({
      id: prescriptions.id,
      code: prescriptions.code,
      diagnosis: prescriptions.diagnosis,
      createdAt: prescriptions.createdAt,
      patientName: patientUser.name,
      uhid: patients.uhid,
      doctorName: doctorUser.name,
      department: departments.name,
      items: sql<number>`(select count(*) from ${prescriptionItems} where ${prescriptionItems.prescriptionId} = ${prescriptions.id})`,
    })
    .from(prescriptions)
    .innerJoin(patients, eq(patients.id, prescriptions.patientId))
    .innerJoin(patientUser, eq(patientUser.id, patients.userId))
    .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
    .innerJoin(doctorUser, eq(doctorUser.id, doctors.userId))
    .innerJoin(departments, eq(departments.id, doctors.departmentId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(prescriptions.createdAt))
    .limit(filter.status ? 600 : (filter.limit ?? 150));
  const status = await prescriptionSupplyStatus(rows.map((r) => r.id));
  const out = rows.map((r) => ({ ...r, items: Number(r.items), supplyStatus: status.get(r.id) ?? "not_dispensed" }));
  return filter.status ? out.filter((r) => r.supplyStatus === filter.status).slice(0, filter.limit ?? 150) : out;
}

/** Patients matching a UHID / phone / name search (for the dispense counter). */
export async function findPatients(q: string) {
  const term = q.trim();
  if (!term) return [];
  const digits = term.replace(/\D/g, "");
  const conds = [sql`upper(${patients.uhid}) = ${term.toUpperCase()}`, like(patientUser.name, `%${term}%`)];
  if (digits.length >= 6) conds.push(sql`replace(replace(${patientUser.phone}, ' ', ''), '+', '') like ${"%" + digits}`);
  return db
    .select({
      id: patients.id,
      uhid: patients.uhid,
      name: patientUser.name,
      phone: patientUser.phone,
      dob: patients.dob,
      gender: patients.gender,
      allergies: patients.allergies,
    })
    .from(patients)
    .innerJoin(patientUser, eq(patientUser.id, patients.userId))
    .where(or(...conds))
    .limit(10);
}

/** Bills previously raised against a prescription. */
export async function billsForPrescription(prescriptionId: number) {
  return db
    .select({ code: dispenses.code, total: dispenses.total, createdAt: dispenses.createdAt, pharmacist: staffUser.name })
    .from(dispenses)
    .innerJoin(staffUser, eq(staffUser.id, dispenses.pharmacistId))
    .where(eq(dispenses.prescriptionId, prescriptionId))
    .orderBy(desc(dispenses.createdAt));
}

export async function otcCatalogue() {
  const meds = await db
    .select({ id: medicines.id, sku: medicines.sku, name: medicines.name, unitLabel: medicines.unitLabel, unitPrice: medicines.unitPrice, category: medicines.category })
    .from(medicines)
    .where(and(eq(medicines.active, true), eq(medicines.rxRequired, false)))
    .orderBy(asc(medicines.name));
  const sellable = await sellableStock(meds.map((m) => m.id));
  return meds.map((m) => ({ ...m, sellable: sellable.get(m.id) ?? 0 }));
}
