"use client";

import { useFormStatus } from "react-dom";
import { useSyncExternalStore, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "./button";

const subscribe = () => () => {};

/**
 * Submit button that shows a spinner while the action runs and stays disabled
 * until hydration (so a pre-hydration tap can't post a half-ready form).
 */
export function SubmitButton({
  children,
  pendingText,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <Button type="submit" disabled={!hydrated || pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingText ?? "Please wait…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
