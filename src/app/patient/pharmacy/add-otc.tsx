"use client";

import { useActionState } from "react";
import { Check, Plus } from "lucide-react";
import { addOtcToCartAction } from "@/lib/actions/patient";
import { SubmitButton } from "@/components/ui/submit-button";

export function AddOtcButton({ medicineId }: { medicineId: number }) {
  const [state, action] = useActionState(addOtcToCartAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="medicineId" value={medicineId} />
      <SubmitButton size="xs" variant={state?.ok ? "success" : "secondary"} pendingText="" aria-label="Add to cart" title={state?.error ?? state?.message}>
        {state?.ok ? <Check aria-hidden /> : <Plus aria-hidden />}
        {state?.ok ? "Added" : "Add"}
      </SubmitButton>
    </form>
  );
}
