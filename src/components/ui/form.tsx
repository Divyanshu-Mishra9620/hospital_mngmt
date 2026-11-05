import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-xl border border-line-strong bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 " +
  "transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 " +
  "disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-500 aria-[invalid=true]:border-danger-600";

const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2366757f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, style, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(control, "h-11 appearance-none bg-no-repeat pr-10", className)}
      style={{ backgroundImage: chevron, backgroundSize: "16px", backgroundPosition: "right 0.85rem center", ...style }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink-800", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger-600" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-danger-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink-700", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-line-strong accent-brand-600" {...props} />
      <span>{label}</span>
    </label>
  );
}
