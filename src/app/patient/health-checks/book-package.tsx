"use client";

import { useActionState, useState } from "react";
import { bookPackageAction } from "@/lib/actions/patient";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { inr } from "@/lib/format";

export function BookPackage({ packageId, price, minDate, maxDate, defaultOpen }: { packageId: number; price: number; minDate: string; maxDate: string; defaultOpen?: boolean }) {
  const [state, action] = useActionState(bookPackageAction, null);
  const [open, setOpen] = useState(!!defaultOpen);
  if (state?.ok) return <FormMessage state={state} />;
  if (!open)
    return (
      <Button block variant="secondary" onClick={() => setOpen(true)}>
        Book this package
      </Button>
    );
  return (
    <form action={action} className="space-y-3 rounded-xl bg-surface p-3">
      <input type="hidden" name="packageId" value={packageId} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date" htmlFor={`d-${packageId}`}>
          <Input id={`d-${packageId}`} type="date" name="date" min={minDate} max={maxDate} defaultValue={minDate} required />
        </Field>
        <Field label="Pay with" htmlFor={`m-${packageId}`}>
          <Select id={`m-${packageId}`} name="paymentMethod" defaultValue="upi">
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="netbanking">Net banking</option>
          </Select>
        </Field>
      </div>
      <p className="text-xs text-ink-500">Report at 8:00 AM after 10–12 hours of fasting. Sample collection takes about 2 hours.</p>
      <FormMessage state={state} />
      <SubmitButton block pendingText="Booking…">
        Pay {inr(price)} &amp; book
      </SubmitButton>
    </form>
  );
}
