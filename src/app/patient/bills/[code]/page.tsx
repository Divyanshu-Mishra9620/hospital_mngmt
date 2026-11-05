import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { dispenseItems, dispenses, payments, pharmacyOrderItems, pharmacyOrders } from "@/db/schema";
import { LogoMark } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { HOSPITAL } from "@/lib/constants";
import { fmtDateTime, inr, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { user, patient } = await requirePatient();
  const [p] = await db.select().from(payments).where(and(eq(payments.code, code), eq(payments.patientId, patient.id)));
  if (!p) notFound();

  let lines: { name: string; qty: number; rate: number; amount: number }[] = [{ name: p.description, qty: 1, rate: p.amount, amount: p.amount }];
  let extras: { k: string; v: number }[] = [];
  if (p.purpose === "pharmacy_order") {
    const [o] = await db.select().from(pharmacyOrders).where(eq(pharmacyOrders.code, p.reference));
    if (o) {
      const its = await db.select().from(pharmacyOrderItems).where(eq(pharmacyOrderItems.orderId, o.id));
      lines = its.map((i) => ({ name: i.name, qty: i.quantity, rate: i.unitPrice, amount: i.lineTotal }));
      extras = [
        { k: "Discount", v: -o.discount },
        { k: "Delivery", v: o.deliveryFee },
      ];
    }
  } else if (p.purpose === "pharmacy_counter") {
    const [d] = await db.select().from(dispenses).where(eq(dispenses.code, p.reference));
    if (d) {
      const its = await db.select().from(dispenseItems).where(eq(dispenseItems.dispenseId, d.id));
      lines = its.map((i) => ({ name: `${i.name}${i.batchNo ? ` (Batch ${i.batchNo})` : ""}`, qty: i.quantity, rate: i.unitPrice, amount: i.lineTotal }));
      extras = [{ k: "Discount", v: -d.discount }];
    }
  }

  return (
    <div>
      <PageHeader title="Receipt" back={{ href: "/patient/bills", label: "Bills" }} actions={<PrintButton label="Print / save PDF" />} className="no-print" />
      <article className="print-sheet mx-auto max-w-2xl rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
        <header className="flex items-start justify-between gap-4 border-b-2 border-brand-700 pb-4">
          <div className="flex items-start gap-3">
            <LogoMark className="size-10" />
            <div>
              <p className="font-display font-bold text-brand-900">{HOSPITAL.name}</p>
              <p className="text-xs text-ink-500">{HOSPITAL.addressLines.join(", ")}</p>
              <p className="text-xs text-ink-500">GSTIN {HOSPITAL.gstin}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-ink-900">Receipt</p>
            <p className="tabular text-xs text-ink-500">{p.code}</p>
          </div>
        </header>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Billed to</p>
            <p className="font-semibold text-ink-900">{user.name}</p>
            <p className="tabular text-ink-600">UHID {patient.uhid}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-400">Date</p>
            <p className="text-ink-800">{fmtDateTime(p.createdAt)}</p>
            <p className="text-ink-600">
              {titleCase(p.purpose)} · Ref <span className="tabular">{p.reference}</span>
            </p>
          </div>
        </div>
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Rate</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-line/70">
                <td className="py-2 pr-2 text-ink-800">{l.name}</td>
                <td className="py-2 text-right">{l.qty}</td>
                <td className="py-2 text-right">{inr(l.rate, { paise: true })}</td>
                <td className="py-2 text-right">{inr(l.amount, { paise: true })}</td>
              </tr>
            ))}
            {extras
              .filter((e) => e.v !== 0)
              .map((e) => (
                <tr key={e.k}>
                  <td colSpan={3} className="py-1.5 text-right text-ink-500">
                    {e.k}
                  </td>
                  <td className="py-1.5 text-right">{inr(e.v, { paise: true })}</td>
                </tr>
              ))}
            <tr>
              <td colSpan={3} className="py-2 text-right font-semibold text-ink-900">
                Total paid
              </td>
              <td className="py-2 text-right font-display text-base font-bold text-ink-900">{inr(p.amount, { paise: true })}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm">
          <span className="text-ink-600">Payment mode: {p.method.toUpperCase()}</span>
          {p.status === "refunded" ? <Badge tone="info">Refunded</Badge> : <Badge tone="success">Paid</Badge>}
        </div>
        <p className="mt-6 text-center text-xs text-ink-400">This is a computer-generated receipt and does not require a signature.</p>
      </article>
    </div>
  );
}
