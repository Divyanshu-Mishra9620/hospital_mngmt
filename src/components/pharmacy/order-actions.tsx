"use client";

import { useActionState, type ReactNode } from "react";
import { Ban, Bike, CheckCircle2, PackageOpen, Store } from "lucide-react";
import { cancelOrderAction, updateOrderStatusAction } from "@/lib/actions/pharmacy";
import type { OrderStatus } from "@/db/schema";
import { Field, Textarea } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

export function OrderActions({ code, status, fulfilment }: { code: string; status: OrderStatus; fulfilment: "pickup" | "delivery" }) {
  const [state, action] = useActionState(updateOrderStatusAction, null);
  const [cancelState, cancelAction] = useActionState(cancelOrderAction, null);

  const next: { to: OrderStatus; label: string; icon: ReactNode; hint: string } | null =
    status === "placed"
      ? { to: "processing", label: "Start packing", icon: <PackageOpen aria-hidden />, hint: "Pick the items from the racks listed below and check expiry." }
      : status === "processing"
        ? fulfilment === "pickup"
          ? { to: "ready", label: "Mark ready for pickup", icon: <Store aria-hidden />, hint: "The patient will be notified to collect from the counter." }
          : { to: "out_for_delivery", label: "Hand over for delivery", icon: <Bike aria-hidden />, hint: "Seal the pack with the printed order slip before dispatch." }
        : status === "ready" || status === "out_for_delivery"
          ? {
              to: "completed",
              label: fulfilment === "pickup" ? "Mark collected" : "Mark delivered",
              icon: <CheckCircle2 aria-hidden />,
              hint: fulfilment === "pickup" ? "Verify the patient's UHID before handing over." : "Confirm once the delivery partner reports success.",
            }
          : null;

  if (!next) return null;

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-2">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="next" value={next.to} />
        <FormMessage state={state} />
        <SubmitButton block size="lg" variant={next.to === "completed" ? "success" : "primary"} pendingText="Updating…">
          {next.icon} {next.label}
        </SubmitButton>
        <p className="text-center text-xs text-ink-500">{next.hint}</p>
      </form>

      <details className="group rounded-xl border border-line">
        <summary className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-danger-700">
          <Ban className="size-4" aria-hidden /> Cancel order
        </summary>
        <form action={cancelAction} className="space-y-3 border-t border-line p-3.5">
          <input type="hidden" name="code" value={code} />
          <FormMessage state={cancelState} />
          <Field label="Reason (shared with the patient)" htmlFor="reason" error={cancelState?.fieldErrors?.reason}>
            <Textarea id="reason" name="reason" rows={2} placeholder="e.g. Item recalled by manufacturer" required />
          </Field>
          <SubmitButton variant="danger" size="sm" pendingText="Cancelling…">
            Cancel & refund
          </SubmitButton>
          <p className="text-xs text-ink-500">Stock goes back to the original batches and the payment is marked refunded.</p>
        </form>
      </details>
    </div>
  );
}
