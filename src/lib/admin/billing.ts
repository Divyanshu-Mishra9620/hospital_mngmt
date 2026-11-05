import { and, count, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { PAYMENT_PURPOSES, patients, payments, users } from "@/db/schema";
import { istRange, readRange, str } from "./queries";

type SP = Record<string, string | string[] | undefined>;

export const PURPOSE_LABEL: Record<(typeof PAYMENT_PURPOSES)[number], string> = {
  consultation: "Consultation",
  pharmacy_order: "Pharmacy — online",
  pharmacy_counter: "Pharmacy — counter",
  health_package: "Health check-up",
};

export function billingFilters(sp: SP) {
  const { from, to, today } = readRange(sp, 30);
  const purpose = PAYMENT_PURPOSES.find((p) => p === str(sp.purpose));
  const method = str(sp.method);
  const status = (["success", "refunded"] as const).find((s) => s === str(sp.status));
  const q = str(sp.q);
  const [start, end] = istRange(from, to);
  const conds: SQL[] = [gte(payments.createdAt, start), lt(payments.createdAt, end)];
  if (purpose) conds.push(eq(payments.purpose, purpose));
  if (method) conds.push(eq(payments.method, method));
  if (status) conds.push(eq(payments.status, status));
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    conds.push(
      or(
        sql`lower(${payments.code}) like ${like}`,
        sql`lower(${payments.reference}) like ${like}`,
        sql`lower(${payments.description}) like ${like}`,
        sql`lower(coalesce(${users.name}, '')) like ${like}`,
        sql`lower(coalesce(${patients.uhid}, '')) like ${like}`,
      )!,
    );
  }
  return { from, to, today, purpose, method, status, q, where: and(...conds)! };
}

function base() {
  return db
    .select({
      id: payments.id,
      code: payments.code,
      purpose: payments.purpose,
      reference: payments.reference,
      description: payments.description,
      amount: payments.amount,
      method: payments.method,
      status: payments.status,
      createdAt: payments.createdAt,
      patientName: users.name,
      uhid: patients.uhid,
    })
    .from(payments)
    .leftJoin(patients, eq(patients.id, payments.patientId))
    .leftJoin(users, eq(users.id, patients.userId));
}

export async function searchPayments(where: SQL, page: number, pageSize: number) {
  const [rows, [{ total }], byPurpose, byMethod] = await Promise.all([
    base().where(where).orderBy(desc(payments.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(payments)
      .leftJoin(patients, eq(patients.id, payments.patientId))
      .leftJoin(users, eq(users.id, patients.userId))
      .where(where),
    db
      .select({
        purpose: payments.purpose,
        n: count(),
        collected: sql<number>`coalesce(sum(case when ${payments.status} = 'success' then ${payments.amount} end), 0)`,
        refunded: sql<number>`coalesce(sum(case when ${payments.status} = 'refunded' then ${payments.amount} end), 0)`,
      })
      .from(payments)
      .leftJoin(patients, eq(patients.id, payments.patientId))
      .leftJoin(users, eq(users.id, patients.userId))
      .where(where)
      .groupBy(payments.purpose),
    db
      .select({ method: payments.method, collected: sql<number>`coalesce(sum(case when ${payments.status} = 'success' then ${payments.amount} end), 0)` })
      .from(payments)
      .leftJoin(patients, eq(patients.id, payments.patientId))
      .leftJoin(users, eq(users.id, patients.userId))
      .where(where)
      .groupBy(payments.method),
  ]);
  return {
    rows,
    total,
    byPurpose: byPurpose.map((r) => ({ ...r, collected: Number(r.collected), refunded: Number(r.refunded) })),
    byMethod: byMethod.map((r) => ({ ...r, collected: Number(r.collected) })),
  };
}

export async function exportPayments(where: SQL) {
  return base().where(where).orderBy(desc(payments.createdAt)).limit(20000);
}
