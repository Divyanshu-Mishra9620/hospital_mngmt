"use client";

import { useActionState, useState } from "react";
import { cancelOrderAction } from "@/lib/actions/patient";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

export function CancelOrder({ code }: { code: string }) {
  const [state, action] = useActionState(cancelOrderAction, null);
  const [confirm, setConfirm] = useState(false);
  return (
    <form action={action} className="no-print space-y-2">
      <input type="hidden" name="code" value={code} />
      <FormMessage state={state} />
      {!state?.ok &&
        (confirm ? (
          <div className="flex gap-2">
            <SubmitButton variant="danger" size="sm" pendingText="Cancelling…">
              Yes, cancel order
            </SubmitButton>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              No
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" block onClick={() => setConfirm(true)}>
            Cancel order
          </Button>
        ))}
    </form>
  );
}
