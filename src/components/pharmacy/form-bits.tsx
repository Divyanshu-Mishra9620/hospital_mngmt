"use client";

import { startTransition, useEffect, useSyncExternalStore, type FormEvent, type ReactNode, type RefObject } from "react";
import { Banknote, CreditCard, Loader2, Minus, Plus, ShieldPlus, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

export const COUNTER_METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "insurance", label: "Insurance", icon: ShieldPlus },
] as const;

export function PaymentMethodPicker({ value, onChange, name = "paymentMethod" }: { value: string; onChange: (v: string) => void; name?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink-800">Payment received by</legend>
      <div className="grid grid-cols-4 gap-1.5">
        {COUNTER_METHODS.map((m) => {
          const on = value === m.value;
          return (
            <label
              key={m.value}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-1 py-2 text-xs font-semibold transition",
                on ? "border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20" : "border-line-strong bg-white text-ink-600 hover:border-ink-300",
              )}
            >
              <input type="radio" name={name} value={m.value} checked={on} onChange={() => onChange(m.value)} className="sr-only" />
              <m.icon className="size-4" aria-hidden />
              {m.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function QtyStepper({
  value,
  onChange,
  max,
  disabled,
  label,
  invalid,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  disabled?: boolean;
  label: string;
  invalid?: boolean;
}) {
  const set = (v: number) => onChange(Math.max(1, Math.min(max ?? 100000, Number.isFinite(v) ? Math.round(v) : 1)));
  return (
    <div className={cn("inline-flex h-9 items-stretch overflow-hidden rounded-lg border bg-white", invalid ? "border-danger-600" : "border-line-strong", disabled && "opacity-50")}>
      <button type="button" className="grid w-8 place-items-center text-ink-600 hover:bg-surface disabled:opacity-40" onClick={() => set(value - 1)} disabled={disabled || value <= 1} aria-label={`Decrease ${label}`}>
        <Minus className="size-3.5" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={value}
        disabled={disabled}
        onChange={(e) => set(Number(e.target.value))}
        className="tabular w-14 border-x border-line text-center text-sm font-semibold text-ink-900 focus:outline-none"
        aria-label={`${label} quantity`}
      />
      <button type="button" className="grid w-8 place-items-center text-ink-600 hover:bg-surface disabled:opacity-40" onClick={() => set(value + 1)} disabled={disabled} aria-label={`Increase ${label}`}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function money2(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/**
 * Submits a form to a useActionState dispatcher without React's automatic
 * form reset, so typed values survive a validation error. Optionally resets
 * the form once the action reports success.
 */
export function useKeepValues(
  dispatch: (fd: FormData) => void,
  state: { ok?: boolean } | null,
  resetRef?: RefObject<HTMLFormElement | null>,
) {
  useEffect(() => {
    if (resetRef && state?.ok) resetRef.current?.reset();
  }, [state, resetRef]);
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
}

const noopSubscribe = () => () => {};

export function BusyButton({
  pending,
  pendingText = "Saving…",
  children,
  variant,
  size,
  block,
  disabled,
}: {
  pending: boolean;
  pendingText?: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
}) {
  // Disabled until hydrated so a pre-hydration tap can't trigger a native GET submit.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return (
    <Button type="submit" variant={variant} size={size} block={block} disabled={!hydrated || pending || disabled} aria-busy={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden /> {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
