"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ShoppingCart } from "lucide-react";
import { addPrescriptionToCartAction } from "@/lib/actions/patient";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

export function AddToCart({ rx, label = "Add all to cart" }: { rx: string; label?: string }) {
  const [state, action] = useActionState(addPrescriptionToCartAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="rx" value={rx} />
      <SubmitButton block pendingText="Adding…">
        <ShoppingCart aria-hidden /> {label}
      </SubmitButton>
      <FormMessage state={state} />
      {state?.ok && (
        <Link href="/patient/cart" className="block text-center text-sm font-semibold text-brand-700">
          Go to cart →
        </Link>
      )}
    </form>
  );
}
