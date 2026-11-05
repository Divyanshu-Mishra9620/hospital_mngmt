"use client";

import { useActionState, useState } from "react";
import { Lock, Store, Truck } from "lucide-react";
import { checkoutAction } from "@/lib/actions/patient";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Alert, FormMessage, KeyValue } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { HOSPITAL } from "@/lib/constants";
import { inr, money } from "@/lib/format";
import { cn } from "@/lib/cn";

export function CheckoutForm({
  subtotal,
  discountPct,
  deliveryFee,
  freeDeliveryAbove,
  defaultAddress,
  phone,
  blocked,
}: {
  subtotal: number;
  discountPct: number;
  deliveryFee: number;
  freeDeliveryAbove: number;
  defaultAddress: string;
  phone: string;
  blocked: boolean;
}) {
  const [state, action] = useActionState(checkoutAction, null);
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup");
  const discount = money((subtotal * discountPct) / 100);
  const fee = fulfilment === "delivery" && subtotal < freeDeliveryAbove ? deliveryFee : 0;
  const total = money(subtotal - discount + fee);

  return (
    <form action={action} className="space-y-5 lg:sticky lg:top-24 lg:self-start">
      <input type="hidden" name="fulfilment" value={fulfilment} />
      <Card>
        <CardHeader title="Delivery option" />
        <div className="space-y-3 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { v: "pickup", label: "Pickup", sub: "Pharmacy counter", icon: Store },
                { v: "delivery", label: "Home delivery", sub: "Within 4 hours", icon: Truck },
              ] as const
            ).map((o) => {
              const Icon = o.icon;
              const on = fulfilment === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setFulfilment(o.v)}
                  aria-pressed={on}
                  className={cn("rounded-xl border-2 p-3 text-left transition", on ? "border-brand-600 bg-brand-50/60" : "border-line hover:border-brand-200")}
                >
                  <Icon className={cn("size-5", on ? "text-brand-700" : "text-ink-400")} aria-hidden />
                  <p className="mt-1.5 text-sm font-semibold text-ink-900">{o.label}</p>
                  <p className="text-xs text-ink-500">{o.sub}</p>
                </button>
              );
            })}
          </div>
          {fulfilment === "delivery" ? (
            <Field label="Delivery address" htmlFor="address" error={state?.fieldErrors?.address} hint={`We'll call ${phone || "you"} before delivery.`}>
              <Textarea id="address" name="address" rows={3} defaultValue={defaultAddress} required />
            </Field>
          ) : (
            <p className="rounded-lg bg-surface px-3 py-2 text-xs text-ink-600">
              Collect from Medora Pharmacy, Block A ground floor ({HOSPITAL.pharmacyHours}). Bring your UHID or order number.
            </p>
          )}
          <Field label="Pay with" htmlFor="paymentMethod">
            <Select id="paymentMethod" name="paymentMethod" defaultValue="upi">
              <option value="upi">UPI</option>
              <option value="card">Debit / credit card</option>
              <option value="netbanking">Net banking</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="divide-y divide-line">
          <KeyValue k="Subtotal (MRP)" v={inr(subtotal, { paise: true })} />
          <KeyValue k={`Hospital discount (${discountPct}%)`} v={<span className="text-success-700">− {inr(discount, { paise: true })}</span>} />
          <KeyValue k="Delivery" v={fulfilment === "pickup" ? "Free" : fee ? inr(fee) : "Free"} />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
          <span className="font-semibold text-ink-900">Total</span>
          <span className="tabular font-display text-xl font-bold text-ink-900">{inr(total, { paise: true })}</span>
        </div>
        {fulfilment === "delivery" && fee > 0 && <p className="mt-1 text-xs text-ink-500">Add {inr(freeDeliveryAbove - subtotal, { paise: true })} more for free delivery.</p>}
        <div className="mt-4 space-y-3">
          {blocked && <Alert tone="warning">Fix the highlighted items in your cart to continue.</Alert>}
          <FormMessage state={state} />
          <SubmitButton block size="lg" disabled={blocked} pendingText="Placing order…">
            <Lock aria-hidden /> Pay {inr(total, { paise: true })}
          </SubmitButton>
          <p className="text-center text-[0.6875rem] text-ink-400">Demo payment — no real money is charged. Prices include GST.</p>
        </div>
      </Card>
    </form>
  );
}
