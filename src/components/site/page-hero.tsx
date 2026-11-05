import Link from "next/link";
import type { ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  description,
  crumbs = [],
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  crumbs?: { href: string; label: string }[];
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-brand-50 to-white">
      <div
        className="pointer-events-none absolute -right-32 -top-48 size-[28rem] rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgb(119 188 199 / .5), transparent 65%)" }}
        aria-hidden
      />
      <div className="container-page relative py-10 sm:py-14">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-brand-700">
                Home
              </Link>
            </li>
            {crumbs.map((c) => (
              <li key={c.href} className="flex items-center gap-1.5">
                <span aria-hidden>/</span>
                <Link href={c.href} className="hover:text-brand-700">
                  {c.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 max-w-3xl text-[2rem] font-extrabold leading-[1.1] sm:text-[2.75rem]" style={{ letterSpacing: "-0.03em" }}>
          {title}
        </h1>
        {description && <p className="lead mt-4 max-w-2xl">{description}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
