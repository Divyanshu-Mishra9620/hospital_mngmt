"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  FileText,
  House,
  LayoutGrid,
  LogOut,
  Pill,
  Plus,
  Receipt,
  Salad,
  ShoppingCart,
  Activity,
  UserRound,
  Package,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo, LogoMark } from "@/components/logo";
import { Avatar } from "@/components/ui/misc";

const SIDEBAR: { href: string; label: string; icon: ReactNode; exact?: boolean }[] = [
  { href: "/patient", label: "Home", icon: <House />, exact: true },
  { href: "/patient/book", label: "Book appointment", icon: <Plus /> },
  { href: "/patient/appointments", label: "My appointments", icon: <CalendarDays /> },
  { href: "/patient/prescriptions", label: "Prescriptions", icon: <FileText /> },
  { href: "/patient/care-plan", label: "Diet & lifestyle", icon: <Salad /> },
  { href: "/patient/records", label: "Health records", icon: <Activity /> },
  { href: "/patient/pharmacy", label: "Pharmacy", icon: <Pill /> },
  { href: "/patient/cart", label: "Cart", icon: <ShoppingCart /> },
  { href: "/patient/orders", label: "Medicine orders", icon: <Package /> },
  { href: "/patient/health-checks", label: "Health check-ups", icon: <FlaskConical /> },
  { href: "/patient/bills", label: "Bills & payments", icon: <Receipt /> },
  { href: "/patient/profile", label: "Profile & health card", icon: <UserRound /> },
];

const TABS: { href: string; label: string; icon: ReactNode; exact?: boolean; match?: string[] }[] = [
  { href: "/patient", label: "Home", icon: <House />, exact: true },
  { href: "/patient/appointments", label: "Visits", icon: <CalendarDays /> },
  { href: "/patient/book", label: "Book", icon: <Plus /> },
  { href: "/patient/pharmacy", label: "Pharmacy", icon: <Pill />, match: ["/patient/pharmacy", "/patient/cart", "/patient/orders"] },
  {
    href: "/patient/more",
    label: "More",
    icon: <LayoutGrid />,
    match: ["/patient/more", "/patient/prescriptions", "/patient/care-plan", "/patient/records", "/patient/bills", "/patient/profile", "/patient/notifications", "/patient/health-checks"],
  },
];

function active(pathname: string, href: string, exact?: boolean, match?: string[]) {
  if (exact) return pathname === href;
  const prefixes = match ?? [href];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Mobile-first patient app shell: top app bar + bottom tab bar on phones,
 * a light sidebar on laptops.
 */
export function PatientShell({
  user,
  unread,
  cartCount,
  children,
}: {
  user: { name: string; uhid: string };
  unread: number;
  cartCount: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const firstName = user.name.split(" ")[0];

  return (
    <div className="min-h-dvh bg-surface">
      {/* Laptop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href="/patient" subtitle="Patient portal" />
        </div>
        <nav className="scrollbar-none flex-1 overflow-y-auto px-3 py-2" aria-label="Patient navigation">
          <ul className="space-y-0.5">
            {SIDEBAR.map((item) => {
              const on = active(pathname, item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors [&_svg]:size-[1.125rem]",
                      on ? "bg-brand-50 text-brand-800" : "text-ink-600 hover:bg-surface hover:text-ink-900",
                    )}
                  >
                    <span className={on ? "text-brand-600" : "text-ink-400"}>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/patient/cart" && cartCount > 0 && (
                      <span className="tabular rounded-full bg-brand-600 px-1.5 text-[0.6875rem] font-bold text-white">{cartCount}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={user.name} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
              <p className="truncate text-xs text-ink-500">UHID {user.uhid}</p>
            </div>
            <a href="/logout" className="rounded-lg p-2 text-ink-400 hover:bg-surface hover:text-ink-800" title="Sign out" aria-label="Sign out">
              <LogOut className="size-4" />
            </a>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Top app bar */}
        <header className="no-print sticky top-0 z-20 border-b border-line bg-white/92 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:h-16 sm:px-6">
            <Link href="/patient" className="flex items-center gap-2.5 lg:hidden" aria-label="Home">
              <LogoMark className="size-8" />
            </Link>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[0.9375rem] font-semibold text-ink-900">Hi, {firstName}</p>
              <p className="truncate text-xs text-ink-500">UHID {user.uhid}</p>
            </div>
            <Link href="/patient/cart" className="relative rounded-full p-2.5 text-ink-600 hover:bg-surface" aria-label={`Cart (${cartCount} items)`}>
              <ShoppingCart className="size-5" />
              {cartCount > 0 && (
                <span className="tabular absolute right-0.5 top-0.5 grid min-w-[1.125rem] place-items-center rounded-full bg-brand-600 px-1 text-[0.625rem] font-bold leading-[1.125rem] text-white ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link href="/patient/notifications" className="relative rounded-full p-2.5 text-ink-600 hover:bg-surface" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
              <Bell className="size-5" />
              {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-danger-600 ring-2 ring-white" />}
            </Link>
            <Link href="/patient/profile" className="hidden sm:block lg:hidden" aria-label="Profile">
              <Avatar name={user.name} size="sm" />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-12">{children}</main>
      </div>

      {/* Bottom tab bar (phones & tablets) */}
      <nav
        className="no-print pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 shadow-bar backdrop-blur-md lg:hidden"
        aria-label="Primary"
      >
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {TABS.map((tab) => {
            const on = active(pathname, tab.href, tab.exact, tab.match);
            const isBook = tab.href === "/patient/book";
            return (
              <li key={tab.href} className="flex">
                <Link
                  href={tab.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold transition-colors",
                    on ? "text-brand-700" : "text-ink-500",
                  )}
                >
                  {isBook ? (
                    <span className={cn("-mt-6 grid size-12 place-items-center rounded-2xl text-white shadow-lift ring-4 ring-white [&_svg]:size-6", on ? "bg-brand-700" : "bg-brand-600")}>
                      {tab.icon}
                    </span>
                  ) : (
                    <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors [&_svg]:size-[1.3rem]", on && "bg-brand-50")}>{tab.icon}</span>
                  )}
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

