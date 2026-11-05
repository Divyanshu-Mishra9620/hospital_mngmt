"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/logo";
import { Avatar } from "@/components/ui/misc";

export type NavItem = { href: string; label: string; icon: ReactNode; badge?: number | null; exact?: boolean };
export type NavSection = { title?: string; items: NavItem[] };

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

/**
 * Laptop-first workspace shell for doctors, pharmacy staff and administrators:
 * fixed sidebar on large screens, slide-in drawer on tablets and phones.
 */
export function StaffShell({
  sections,
  roleLabel,
  user,
  homeHref,
  notificationsHref,
  unread = 0,
  topRight,
  children,
}: {
  sections: NavSection[];
  roleLabel: string;
  user: { name: string; code: string; subtitle?: string; color?: string };
  homeHref: string;
  notificationsHref?: string;
  unread?: number;
  topRight?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const all = sections.flatMap((s) => s.items);
  const current = [...all].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(pathname, i));

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-950 text-brand-100">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5">
        <Link href={homeHref} className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <LogoMark className="size-8" />
          <span className="leading-none">
            <span className="block font-display text-[1.0625rem] font-bold text-white">Medora</span>
            <span className="mt-0.5 block text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-brand-300">{roleLabel}</span>
          </span>
        </Link>
        <button type="button" className="rounded-lg p-2 text-brand-200 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <nav className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4" aria-label={`${roleLabel} navigation`}>
        {sections.map((section, i) => (
          <div key={i} className="mt-4 first:mt-1">
            {section.title && <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-400">{section.title}</p>}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = current?.href === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-[0.875rem] font-medium transition-colors [&_svg]:size-[1.125rem] [&_svg]:shrink-0",
                        active ? "bg-white/12 text-white" : "text-brand-200 hover:bg-white/6 hover:text-white",
                      )}
                    >
                      <span className={cn(active ? "text-accent-500" : "text-brand-300 group-hover:text-brand-100")}>{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {!!item.badge && (
                        <span className="tabular rounded-full bg-accent-500 px-1.5 py-px text-[0.6875rem] font-bold text-ink-950">{item.badge > 99 ? "99+" : item.badge}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={user.name} color={user.color ?? "#1d7f8f"} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs text-brand-300">{user.subtitle ?? user.code}</p>
          </div>
          <a href="/logout" className="rounded-lg p-2 text-brand-300 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out">
            <LogOut className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" className="animate-fade-in absolute inset-0 bg-ink-950/50" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="animate-slide-in absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] shadow-lift">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-md sm:px-6">
          <button type="button" className="-ml-1 rounded-lg p-2 text-ink-700 hover:bg-surface lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9375rem] font-semibold text-ink-900">{current?.label ?? roleLabel}</p>
          </div>
          {topRight}
          {notificationsHref && (
            <Link href={notificationsHref} className="relative rounded-lg p-2 text-ink-600 hover:bg-surface" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
              <Bell className="size-5" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger-600 ring-2 ring-white" />}
            </Link>
          )}
          <div className="hidden items-center gap-2.5 border-l border-line pl-3 sm:flex">
            <Avatar name={user.name} color={user.color ?? "#1d7f8f"} size="sm" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink-900">{user.name}</p>
              <p className="text-xs text-ink-500">{user.code}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[90rem] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
