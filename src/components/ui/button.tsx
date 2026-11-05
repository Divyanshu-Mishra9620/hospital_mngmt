import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "white" | "accent";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm",
  secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200",
  outline: "border border-line-strong bg-white text-ink-800 hover:bg-surface hover:border-ink-300",
  ghost: "text-ink-700 hover:bg-surface active:bg-surface-2",
  danger: "bg-danger-600 text-white hover:bg-danger-700 shadow-sm",
  success: "bg-success-600 text-white hover:bg-success-700 shadow-sm",
  white: "bg-white text-brand-800 hover:bg-brand-50 shadow-sm",
  accent: "bg-accent-500 text-ink-950 hover:bg-accent-600 hover:text-white shadow-sm",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-8 px-2.5 text-xs gap-1.5 rounded-lg",
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-[0.9375rem] gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  block,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cn(
    "inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    block && "w-full",
    className,
  );
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

export function Button({ variant, size, block, className, type = "button", ...props }: ComponentProps<"button"> & Common) {
  return <button type={type} className={buttonStyles({ variant, size, block, className })} {...props} />;
}

export function LinkButton({ variant, size, block, className, ...props }: ComponentProps<typeof Link> & Common) {
  return <Link className={buttonStyles({ variant, size, block, className })} {...props} />;
}
