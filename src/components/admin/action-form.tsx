"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { KeyRound } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Generic admin form: renders server-provided fields, shows the action's
 * success / error message and an optional one-time secret (e.g. a temporary
 * password) returned as `data.reveal`.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingText,
  className,
  footerClassName,
  variant = "primary",
  size = "md",
  block,
  confirm,
  scrollOnResult,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: ReactNode;
  pendingText?: string;
  className?: string;
  footerClassName?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Native confirm() prompt before submitting. */
  confirm?: string;
  /** Scroll the form's top (where messages appear) into view after submit — for long forms. */
  scrollOnResult?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (scrollOnResult && state) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state, scrollOnResult]);
  const reveal = state?.data?.reveal as { label: string; value: string; note?: string } | undefined;
  const next = state?.data?.href as { href: string; label: string } | undefined;
  return (
    <form
      ref={ref}
      action={formAction}
      className={cn("space-y-4", className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <FormMessage state={state} />
      {reveal && (
        <div className="rounded-xl border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-ink-800">
          <p className="flex items-center gap-2 font-semibold text-accent-700">
            <KeyRound className="size-4" aria-hidden /> {reveal.label}
          </p>
          <p className="tabular mt-1 select-all font-mono text-base font-bold tracking-wide text-ink-900">{reveal.value}</p>
          {reveal.note && <p className="mt-1 text-xs text-ink-600">{reveal.note}</p>}
        </div>
      )}
      {next && (
        <Link href={next.href} className="inline-flex text-sm font-semibold text-brand-700 hover:underline">
          {next.label} →
        </Link>
      )}
      {children}
      <div className={cn("flex flex-wrap items-center gap-2", footerClassName)}>
        <SubmitButton variant={variant} size={size} block={block} pendingText={pendingText}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
