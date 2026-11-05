import Link from "next/link";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9 shrink-0", className)} aria-hidden>
      <rect width="40" height="40" rx="10" fill="#0f5764" />
      <path d="M16.5 8.5h7v8h8v7h-8v8h-7v-8h-8v-7h8z" fill="#fff" />
      <circle cx="20" cy="20" r="2.6" fill="#e59a1f" />
    </svg>
  );
}

export function Logo({
  href = "/",
  inverted,
  compact,
  subtitle = "Multispeciality Hospital",
  className,
}: {
  href?: string;
  inverted?: boolean;
  compact?: boolean;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="Medora Hospital — home">
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className={cn("block font-display text-[1.1875rem] font-bold tracking-tight", inverted ? "text-white" : "text-brand-900")}>
            Medora
          </span>
          <span className={cn("mt-0.5 block text-[0.625rem] font-semibold uppercase tracking-[0.16em]", inverted ? "text-brand-200" : "text-ink-500")}>
            {subtitle}
          </span>
        </span>
      )}
    </Link>
  );
}
