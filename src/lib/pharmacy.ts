import { and, asc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  dispenseItems,
  medicineBatches,
  medicines,
  pharmacyOrderItems,
  pharmacyOrders,
  prescriptionItems,
  stockMovements,
  STOCK_MOVEMENT_TYPES,
} from "@/db/schema";
import { todayISO } from "./time";

type Executor = Tx | typeof db;
type MovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export class StockError extends Error {}

/** Recomputes the cached medicines.stock from its batches and returns it. */
async function syncStock(tx: Executor, medicineId: number) {
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${medicineBatches.quantity}), 0)` })
    .from(medicineBatches)
    .where(eq(medicineBatches.medicineId, medicineId));
  const total = Number(row?.total ?? 0);
  await tx.update(medicines).set({ stock: total }).where(eq(medicines.id, medicineId));
  return total;
}

/**
 * Removes `quantity` units using First-Expiry-First-Out across non-expired
 * batches. Throws StockError if there isn't enough sellable stock.
 */
export async function deductStock(
  tx: Executor,
  opts: { medicineId: number; quantity: number; type: MovementType; reference: string; userId?: number | null; note?: string },
) {
  const today = todayISO();
  const batches = await tx
    .select()
    .from(medicineBatches)
    .where(
      and(
        eq(medicineBatches.medicineId, opts.medicineId),
        gt(medicineBatches.quantity, 0),
        gt(medicineBatches.expiryDate, today),
      ),
    )
    .orderBy(asc(medicineBatches.expiryDate), asc(medicineBatches.id));

  const available = batches.reduce((s, b) => s + b.quantity, 0);
  if (available < opts.quantity) {
    const [m] = await tx.select({ name: medicines.name }).from(medicines).where(eq(medicines.id, opts.medicineId));
    throw new StockError(`Only ${available} unit(s) of ${m?.name ?? "this medicine"} in sellable stock.`);
  }

  let remaining = opts.quantity;
  const allocations: { batchId: number; batchNo: string; quantity: number }[] = [];
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.quantity);
    await tx.update(medicineBatches).set({ quantity: b.quantity - take }).where(eq(medicineBatches.id, b.id));
    allocations.push({ batchId: b.id, batchNo: b.batchNo, quantity: take });
    remaining -= take;
  }

  const balance = await syncStock(tx, opts.medicineId);
  let running = balance + opts.quantity;
  for (const a of allocations) {
    running -= a.quantity;
    await tx.insert(stockMovements).values({
      medicineId: opts.medicineId,
      batchId: a.batchId,
      type: opts.type,
      quantity: -a.quantity,
      balanceAfter: running,
      reference: opts.reference,
      note: opts.note ?? null,
      userId: opts.userId ?? null,
    });
  }
  return allocations;
}

/** Goods receipt: adds a new batch and logs a purchase movement. */
export async function receiveStock(
  tx: Executor,
  opts: {
    medicineId: number;
    batchNo: string;
    expiryDate: string;
    quantity: number;
    costPrice: number;
    supplier?: string | null;
    invoiceNo?: string | null;
    userId?: number | null;
  },
) {
  const [batch] = await tx
    .insert(medicineBatches)
    .values({
      medicineId: opts.medicineId,
      batchNo: opts.batchNo,
      expiryDate: opts.expiryDate,
      quantity: opts.quantity,
      receivedQty: opts.quantity,
      costPrice: opts.costPrice,
      supplier: opts.supplier ?? null,
      invoiceNo: opts.invoiceNo ?? null,
    })
    .returning();
  const balance = await syncStock(tx, opts.medicineId);
  await tx.insert(stockMovements).values({
    medicineId: opts.medicineId,
    batchId: batch.id,
    type: "purchase",
    quantity: opts.quantity,
    balanceAfter: balance,
    reference: opts.invoiceNo ?? opts.batchNo,
    note: opts.supplier ? `Received from ${opts.supplier}` : null,
    userId: opts.userId ?? null,
  });
  return batch;
}

/** Manual correction on a specific batch (damage, count mismatch, expiry write-off, return). */
export async function adjustBatch(
  tx: Executor,
  opts: { batchId: number; delta: number; type: "adjustment" | "expired" | "return"; note: string; userId?: number | null },
) {
  const [batch] = await tx.select().from(medicineBatches).where(eq(medicineBatches.id, opts.batchId));
  if (!batch) throw new StockError("Batch not found.");
  const next = batch.quantity + opts.delta;
  if (next < 0) throw new StockError(`Batch ${batch.batchNo} only has ${batch.quantity} unit(s).`);
  await tx.update(medicineBatches).set({ quantity: next }).where(eq(medicineBatches.id, batch.id));
  const balance = await syncStock(tx, batch.medicineId);
  await tx.insert(stockMovements).values({
    medicineId: batch.medicineId,
    batchId: batch.id,
    type: opts.type,
    quantity: opts.delta,
    balanceAfter: balance,
    reference: batch.batchNo,
    note: opts.note,
    userId: opts.userId ?? null,
  });
}

/**
 * How much of each prescription item has already been supplied, either at the
 * pharmacy counter or through an online order that wasn't cancelled.
 */
export async function suppliedQuantities(prescriptionItemIds: number[]) {
  const supplied = new Map<number, number>();
  if (!prescriptionItemIds.length) return supplied;
  const [counter, online] = await Promise.all([
    db
      .select({ id: dispenseItems.prescriptionItemId, qty: sql<number>`sum(${dispenseItems.quantity})` })
      .from(dispenseItems)
      .where(inArray(dispenseItems.prescriptionItemId, prescriptionItemIds))
      .groupBy(dispenseItems.prescriptionItemId),
    db
      .select({ id: pharmacyOrderItems.prescriptionItemId, qty: sql<number>`sum(${pharmacyOrderItems.quantity})` })
      .from(pharmacyOrderItems)
      .innerJoin(pharmacyOrders, eq(pharmacyOrders.id, pharmacyOrderItems.orderId))
      .where(and(inArray(pharmacyOrderItems.prescriptionItemId, prescriptionItemIds), ne(pharmacyOrders.status, "cancelled")))
      .groupBy(pharmacyOrderItems.prescriptionItemId),
  ]);
  for (const r of [...counter, ...online]) {
    if (r.id == null) continue;
    supplied.set(r.id, (supplied.get(r.id) ?? 0) + Number(r.qty));
  }
  return supplied;
}

export type RxSupplyStatus = "not_dispensed" | "partial" | "dispensed";

/** Supply status per prescription (only counts items stocked by the hospital store). */
export async function prescriptionSupplyStatus(prescriptionIds: number[]) {
  const status = new Map<number, RxSupplyStatus>();
  if (!prescriptionIds.length) return status;
  const items = await db
    .select({ id: prescriptionItems.id, rxId: prescriptionItems.prescriptionId, qty: prescriptionItems.quantity, medicineId: prescriptionItems.medicineId })
    .from(prescriptionItems)
    .where(inArray(prescriptionItems.prescriptionId, prescriptionIds));
  const supplied = await suppliedQuantities(items.map((i) => i.id));
  const agg = new Map<number, { need: number; got: number }>();
  for (const i of items) {
    if (!i.medicineId) continue;
    const a = agg.get(i.rxId) ?? { need: 0, got: 0 };
    a.need += i.qty;
    a.got += Math.min(i.qty, supplied.get(i.id) ?? 0);
    agg.set(i.rxId, a);
  }
  for (const id of prescriptionIds) {
    const a = agg.get(id);
    if (!a || a.got === 0) status.set(id, "not_dispensed");
    else if (a.got >= a.need) status.set(id, "dispensed");
    else status.set(id, "partial");
  }
  return status;
}

/** Units needed for a course: per-day × days (SOS/STAT default to a small pack). */
export function courseQuantity(frequency: string, durationDays: number, form?: string | null) {
  const liquidOrTopical = ["syrup", "suspension", "ointment", "cream", "drops", "inhaler", "gel", "device"];
  if (form && liquidOrTopical.includes(form)) return 1;
  if (frequency === "SOS") return Math.min(10, Math.max(4, durationDays));
  if (frequency === "STAT") return 1;
  const perDay = frequency.split("-").reduce((s, x) => s + (Number(x) || 0), 0);
  return Math.max(1, perDay * Math.max(1, durationDays));
}

/**
 * Puts back stock taken by an online order (used when an order is cancelled).
 * Reads the order's ledger entries so units go back to the exact batches.
 */
export async function restoreOrderStock(tx: Executor, orderCode: string, userId?: number | null, note = "Order cancelled — stock returned") {
  const taken = await tx
    .select()
    .from(stockMovements)
    .where(and(eq(stockMovements.reference, orderCode), eq(stockMovements.type, "order")));
  for (const mv of taken) {
    if (!mv.batchId || mv.quantity >= 0) continue;
    const qty = -mv.quantity;
    const [batch] = await tx.select().from(medicineBatches).where(eq(medicineBatches.id, mv.batchId));
    if (!batch) continue;
    await tx.update(medicineBatches).set({ quantity: batch.quantity + qty }).where(eq(medicineBatches.id, batch.id));
    const balance = await syncStock(tx, mv.medicineId);
    await tx.insert(stockMovements).values({
      medicineId: mv.medicineId,
      batchId: batch.id,
      type: "return",
      quantity: qty,
      balanceAfter: balance,
      reference: orderCode,
      note,
      userId: userId ?? null,
    });
  }
}
