import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getBill } from "@/lib/pharmacy-queries";
import { HOSPITAL } from "@/lib/constants";
import { fmtDate, fmtDateTime, inr, money } from "@/lib/format";
import { LogoMark } from "@/components/logo";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { PrintButton } from "@/components/print-button";
import { amountInWords, paymentMethodLabel } from "@/components/pharmacy/bits";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ new?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Bill ${code}` };
}

export default async function BillPage({ params, searchParams }: Props) {
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const bill = await getBill(decodeURIComponent(code));
  if (!bill) notFound();
  const b = bill.bill;
  const ratio = b.subtotal > 0 ? b.total / b.subtotal : 1;
  const taxRows = bill.items.map((it) => {
    const net = it.lineTotal * ratio;
    const taxable = net / (1 + it.gstPercent / 100);
    return { gst: it.gstPercent, taxable, tax: net - taxable };
  });
  const byRate = new Map<number, { taxable: number; tax: number }>();
  for (const t of taxRows) {
    const r = byRate.get(t.gst) ?? { taxable: 0, tax: 0 };
    r.taxable += t.taxable;
    r.tax += t.tax;
    byRate.set(t.gst, r);
  }
  const totalTax = taxRows.reduce((s, t) => s + t.tax, 0);
  const customer = bill.patientName ?? b.customerName ?? "Walk-in customer";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <LinkButton href="/pharmacy/sales" variant="ghost" size="sm">
          ← All bills
        </LinkButton>
        <div className="flex gap-2">
          <PrintButton label="Print bill" />
          <LinkButton href="/pharmacy/dispense" size="sm">
            <Plus aria-hidden /> New dispense
          </LinkButton>
        </div>
      </div>
      {sp.new === "1" && (
        <Alert tone="success" title="Bill saved" className="no-print mb-4">
          Stock has been deducted and the payment recorded{bill.uhid ? `. ${customer} can see this bill in their patient portal.` : "."}
        </Alert>
      )}

      <article className="print-sheet rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
        <header className="flex flex-col gap-4 border-b-2 border-brand-700 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <LogoMark className="size-11" />
            <div>
              <p className="font-display text-lg font-bold leading-tight text-brand-900">{HOSPITAL.name} — Pharmacy</p>
              <p className="text-xs text-ink-500">{HOSPITAL.addressLines.join(", ")}</p>
              <p className="text-xs text-ink-500">
                {HOSPITAL.phone} · {HOSPITAL.email}
              </p>
              <p className="tabular mt-1 text-xs text-ink-600">
                GSTIN {HOSPITAL.gstin} · D.L. No. {HOSPITAL.pharmacyLicence}
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="font-display text-base font-bold uppercase tracking-wide text-ink-900">Tax invoice</p>
            <p className="tabular text-sm font-semibold text-brand-800">{b.code}</p>
            <p className="text-xs text-ink-500">{fmtDateTime(b.createdAt)}</p>
          </div>
        </header>

        <div className="mt-4 grid gap-3 rounded-xl bg-surface px-4 py-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-ink-400">Billed to</p>
            <p className="font-semibold text-ink-900">{customer}</p>
            <p className="tabular text-xs text-ink-500">{[bill.uhid && `UHID ${bill.uhid}`, bill.patientPhone ?? b.customerPhone].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-ink-400">Prescription</p>
            {bill.rxCode ? (
              <>
                <p className="tabular font-semibold text-ink-900">{bill.rxCode}</p>
                <p className="text-xs text-ink-500">
                  {bill.doctorName} · {fmtDate(bill.rxDate)}
                </p>
              </>
            ) : (
              <p className="text-ink-700">Over the counter (no Rx)</p>
            )}
          </div>
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-ink-400">Payment</p>
            <p className="font-semibold text-ink-900">{paymentMethodLabel(b.paymentMethod)} · Paid</p>
            <p className="text-xs text-ink-500">
              Dispensed by {bill.pharmacist} ({bill.pharmacistCode})
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-strong text-left text-[0.6875rem] uppercase tracking-wide text-ink-500">
                <th className="py-2 pr-2 font-semibold">#</th>
                <th className="py-2 pr-2 font-semibold">Item</th>
                <th className="py-2 pr-2 font-semibold">HSN</th>
                <th className="py-2 pr-2 font-semibold">Batch</th>
                <th className="py-2 pr-2 font-semibold">Expiry</th>
                <th className="py-2 pr-2 text-right font-semibold">Qty</th>
                <th className="py-2 pr-2 text-right font-semibold">MRP</th>
                <th className="py-2 pr-2 text-right font-semibold">GST</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((it, i) => (
                <tr key={it.id} className="border-b border-line/70 align-top">
                  <td className="py-2 pr-2 text-ink-500">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <p className="font-medium text-ink-900">{it.name}</p>
                    <p className="text-xs text-ink-500">per {it.unitLabel}</p>
                  </td>
                  <td className="tabular py-2 pr-2 text-ink-600">{it.hsn ?? "—"}</td>
                  <td className="tabular py-2 pr-2 text-ink-600">{it.batchNo ?? "—"}</td>
                  <td className="tabular py-2 pr-2 text-ink-600">{it.expiry ? fmtDate(it.expiry, { day: undefined }) : "—"}</td>
                  <td className="tabular py-2 pr-2 text-right text-ink-800">{it.quantity}</td>
                  <td className="tabular py-2 pr-2 text-right text-ink-700">{inr(it.unitPrice, { paise: true })}</td>
                  <td className="tabular py-2 pr-2 text-right text-ink-600">{it.gstPercent}%</td>
                  <td className="tabular py-2 text-right font-medium text-ink-900">{inr(it.lineTotal, { paise: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="text-xs text-ink-500">
            <p className="font-semibold uppercase tracking-wide text-ink-400">GST summary (prices inclusive of GST)</p>
            <table className="mt-1.5 w-full max-w-sm text-left">
              <thead>
                <tr className="text-ink-400">
                  <th className="py-0.5 font-medium">Rate</th>
                  <th className="py-0.5 text-right font-medium">Taxable</th>
                  <th className="py-0.5 text-right font-medium">CGST</th>
                  <th className="py-0.5 text-right font-medium">SGST</th>
                </tr>
              </thead>
              <tbody className="tabular text-ink-600">
                {[...byRate.entries()].map(([rate, r]) => (
                  <tr key={rate}>
                    <td className="py-0.5">{rate}%</td>
                    <td className="py-0.5 text-right">{inr(money(r.taxable), { paise: true })}</td>
                    <td className="py-0.5 text-right">{inr(money(r.tax / 2), { paise: true })}</td>
                    <td className="py-0.5 text-right">{inr(money(r.tax / 2), { paise: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-ink-600">
              <span className="font-semibold text-ink-800">Amount in words:</span> {amountInWords(money(b.total))}
            </p>
            {b.notes && <p className="mt-2 text-ink-600">Note: {b.notes}</p>}
          </div>
          <dl className="tabular space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Gross amount</dt>
              <dd className="text-ink-800">{inr(b.subtotal, { paise: true })}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Discount</dt>
              <dd className="text-ink-800">− {inr(b.discount, { paise: true })}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">GST included</dt>
              <dd className="text-ink-800">{inr(money(totalTax), { paise: true })}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-line-strong pt-2">
              <dt className="font-semibold text-ink-900">Net paid</dt>
              <dd className="font-display text-xl font-bold text-ink-900">{inr(b.total, { paise: true })}</dd>
            </div>
          </dl>
        </div>

        <footer className="mt-8 flex flex-col gap-6 border-t border-line pt-4 text-xs text-ink-500 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-md space-y-1">
            <p>Medicines once sold are taken back within 7 days only with this bill, in original sealed packing. Refrigerated items and opened strips are not returnable.</p>
            <p>Keep all medicines out of reach of children. For queries call {HOSPITAL.phone} ({HOSPITAL.pharmacyHours}).</p>
          </div>
          <div className="text-right">
            <p className="h-8" />
            <p className="border-t border-ink-300 pt-1 font-medium text-ink-700">Registered Pharmacist</p>
            <p>{bill.pharmacist}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
