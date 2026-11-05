"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, ReceiptText } from "lucide-react";
import { createDispenseAction } from "@/lib/actions/pharmacy";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Alert, FormMessage } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { BusyButton, PaymentMethodPicker, QtyStepper, money2, useKeepValues } from "./form-bits";

export type RxBillLine = {
  prescriptionItemId: number;
  medicineId: number;
  name: string;
  unitLabel: string;
  unitPrice: number;
  prescribed: number;
  supplied: number;
  remaining: number;
  sellable: number;
  frequency: string;
  durationDays: number;
};

export function RxBillForm({
  prescriptionId,
  rxCode,
  patientName,
  lines,
  notStocked,
  defaultDiscount,
}: {
  prescriptionId: number;
  rxCode: string;
  patientName: string;
  lines: RxBillLine[];
  notStocked: string[];
  defaultDiscount: number;
}) {
  const [state, action, pending] = useActionState(createDispenseAction, null);
  const onSubmit = useKeepValues(action, state);
  const [rows, setRows] = useState(() =>
    lines.map((l) => ({ include: l.remaining > 0 && l.sellable > 0, qty: Math.max(1, Math.min(l.remaining || 1, l.sellable || 1)) })),
  );
  const [override, setOverride] = useState(false);
  const [discount, setDiscount] = useState(defaultDiscount);
  const [method, setMethod] = useState("upi");

  const computed = useMemo(() => {
    const out = lines.map((l, i) => {
      const r = rows[i];
      const errors: string[] = [];
      if (r.include) {
        if (r.qty > l.sellable) errors.push(`Only ${l.sellable} sellable in stock`);
        if (r.qty > l.remaining && !override) errors.push(l.remaining === 0 ? "Already fully supplied" : `Only ${l.remaining} remaining on Rx`);
      }
      return { ...l, ...r, errors, lineTotal: r.include ? r.qty * l.unitPrice : 0 };
    });
    const subtotal = out.reduce((s, l) => s + l.lineTotal, 0);
    const disc = Math.round(((subtotal * (Number(discount) || 0)) / 100) * 100) / 100;
    return { out, subtotal, disc, total: subtotal - disc, hasErrors: out.some((l) => l.errors.length), count: out.filter((l) => l.include).length };
  }, [lines, rows, override, discount]);

  const payload = JSON.stringify(
    computed.out.filter((l) => l.include).map((l) => ({ medicineId: l.medicineId, prescriptionItemId: l.prescriptionItemId, quantity: l.qty })),
  );
  const needsOverride = lines.some((l, i) => rows[i].include && rows[i].qty > l.remaining);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="prescriptionId" value={prescriptionId} />
      <input type="hidden" name="lines" value={payload} />
      <FormMessage state={state} />

      {lines.length === 0 ? (
        <Alert tone="warning" title="Nothing to bill from the hospital pharmacy">
          None of the medicines on {rxCode} are stocked here.
        </Alert>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {computed.out.map((l, i) => (
            <li key={l.prescriptionItemId} className={cn("p-3", !l.include && "bg-surface/50")}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-brand-600"
                  checked={l.include}
                  onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, include: e.target.checked } : r)))}
                  aria-label={`Include ${l.name}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className={cn("font-semibold", l.include ? "text-ink-900" : "text-ink-500")}>{l.name}</p>
                    <p className="tabular text-sm font-semibold text-ink-900">{money2(l.lineTotal)}</p>
                  </div>
                  <p className="tabular mt-0.5 text-xs text-ink-500">
                    {l.frequency} × {l.durationDays}d · Rx {l.prescribed} · supplied {l.supplied} ·{" "}
                    <span className={l.remaining ? "font-semibold text-warning-700" : "text-success-700"}>remaining {l.remaining}</span> ·{" "}
                    <span className={l.sellable < l.remaining ? "font-semibold text-danger-700" : ""}>stock {l.sellable}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <QtyStepper
                      label={l.name}
                      value={l.qty}
                      disabled={!l.include}
                      invalid={l.errors.length > 0}
                      onChange={(qty) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, qty } : r)))}
                    />
                    <span className="tabular text-xs text-ink-500">
                      × {money2(l.unitPrice)} / {l.unitLabel}
                    </span>
                  </div>
                  {l.errors.map((e) => (
                    <p key={e} className="mt-1 flex items-center gap-1 text-xs font-medium text-danger-700">
                      <AlertTriangle className="size-3" aria-hidden /> {e}
                    </p>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {notStocked.length > 0 && (
        <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
          Not stocked here (advise patient to buy outside): <span className="font-semibold">{notStocked.join(", ")}</span>
        </p>
      )}

      {needsOverride && (
        <Checkbox
          name="override"
          checked={override}
          onChange={(e) => setOverride(e.target.checked)}
          label={<span className="font-medium text-warning-700">Override — dispense more than the remaining prescribed quantity (doctor approved)</span>}
        />
      )}

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label="Discount %" htmlFor="discountPercent" hint="Hospital patient discount">
          <Input
            id="discountPercent"
            name="discountPercent"
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="h-10"
          />
        </Field>
        <div className="pb-6 text-right text-sm text-ink-500">− {money2(computed.disc)}</div>
      </div>

      <PaymentMethodPicker value={method} onChange={setMethod} />

      <Field label="Notes (optional)" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} placeholder="e.g. Counselled on insulin pen storage" />
      </Field>

      <div className="rounded-xl bg-brand-950 px-4 py-3.5 text-white">
        <div className="flex justify-between text-sm text-brand-200">
          <span>
            {computed.count} item{computed.count === 1 ? "" : "s"} · subtotal
          </span>
          <span className="tabular">{money2(computed.subtotal)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-semibold">Amount payable</span>
          <span className="tabular font-display text-2xl font-bold">{money2(computed.total)}</span>
        </div>
      </div>

      <BusyButton block size="lg" pending={pending} disabled={computed.count === 0 || computed.hasErrors} pendingText="Saving bill…">
        <ReceiptText aria-hidden /> Dispense & generate bill
      </BusyButton>
      <p className="text-center text-xs text-ink-500">
        Stock is deducted batch-wise (earliest expiry first). {patientName} will see this bill in their portal.
      </p>
    </form>
  );
}
