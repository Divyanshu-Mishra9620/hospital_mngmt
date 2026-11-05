"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Ambulance, CalendarPlus, ChevronRight, Clock, Mail, Menu, Phone, Siren, UserRound, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonStyles } from "@/components/ui/button";
import { HOSPITAL, SITE_NAV } from "@/lib/constants";
import { cn } from "@/lib/cn";

export function SiteHeader({ portalHref }: { portalHref: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close the mobile menu after navigation (state adjusted during render, no effect needed).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Utility bar */}
      <div className="bg-brand-950 text-[0.8125rem] text-brand-100">
        <div className="container-page flex h-10 items-center justify-between gap-4">
          <a href={HOSPITAL.emergencyHref} className="flex items-center gap-2 font-semibold text-white">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger-600 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-danger-600" />
            </span>
            <span className="hidden sm:inline">24×7 Emergency:</span>
            <span className="sm:hidden">Emergency</span> {HOSPITAL.emergency}
          </a>
          <div className="hidden items-center gap-5 md:flex">
            <a href={HOSPITAL.ambulanceHref} className="flex items-center gap-1.5 hover:text-white">
              <Ambulance className="size-3.5" aria-hidden /> Ambulance {HOSPITAL.ambulance}
            </a>
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden /> OPD {HOSPITAL.opdHours}
            </span>
            <a href={`mailto:${HOSPITAL.email}`} className="hidden items-center gap-1.5 hover:text-white lg:flex">
              <Mail className="size-3.5" aria-hidden /> {HOSPITAL.email}
            </a>
          </div>
          <a href={HOSPITAL.phoneHref} className="flex items-center gap-1.5 hover:text-white md:hidden">
            <Phone className="size-3.5" aria-hidden /> Call
          </a>
        </div>
      </div>

      <header className={cn("sticky top-0 z-40 border-b bg-white/95 backdrop-blur-md transition-shadow", scrolled ? "border-line shadow-card" : "border-transparent")}>
        <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
          <Logo />
          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Main">
            {SITE_NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-2.5 py-2 text-[0.875rem] font-medium transition-colors 2xl:px-3",
                    "wide" in item && item.wide && "hidden 2xl:block",
                    active ? "text-brand-700" : "text-ink-700 hover:bg-surface hover:text-ink-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={portalHref ?? "/login"} className={cn(buttonStyles({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
              <UserRound aria-hidden /> {portalHref ? "My portal" : "Sign in"}
            </Link>
            <Link href="/book" className={cn(buttonStyles({ size: "sm" }), "hidden sm:inline-flex")}>
              <CalendarPlus aria-hidden /> Book appointment
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-ink-800 hover:bg-surface xl:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
            >
              <Menu className="size-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {open && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="animate-fade-in absolute inset-0 bg-ink-950/50" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="animate-fade-up absolute inset-x-0 top-0 max-h-dvh overflow-y-auto rounded-b-3xl bg-white pb-6 shadow-lift">
            <div className="container-page flex h-16 items-center justify-between">
              <Logo />
              <button type="button" className="rounded-lg p-2 text-ink-800 hover:bg-surface" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-6" />
              </button>
            </div>
            <nav className="container-page" aria-label="Mobile">
              <ul className="divide-y divide-line border-y border-line">
                {SITE_NAV.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="flex items-center justify-between py-3.5 text-base font-medium text-ink-800">
                      {item.label}
                      <ChevronRight className="size-4 text-ink-300" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link href={portalHref ?? "/login"} className={buttonStyles({ variant: "outline", block: true })}>
                  {portalHref ? "My portal" : "Sign in"}
                </Link>
                <Link href="/book" className={buttonStyles({ block: true })}>
                  Book appointment
                </Link>
              </div>
              <a href={HOSPITAL.emergencyHref} className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-danger-50 py-3 font-semibold text-danger-700">
                <Siren className="size-5" aria-hidden /> Emergency · {HOSPITAL.emergency}
              </a>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

/** Thumb-reachable actions on phones. */
export function MobileActionBar() {
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 shadow-bar backdrop-blur-md sm:hidden">
      <div className="grid h-16 grid-cols-3 text-[0.75rem] font-semibold">
        <a href={HOSPITAL.phoneHref} className="flex flex-col items-center justify-center gap-1 text-ink-700">
          <Phone className="size-5 text-brand-600" aria-hidden /> Call us
        </a>
        <Link href="/book" className="flex flex-col items-center justify-center gap-1 bg-brand-600 text-white">
          <CalendarPlus className="size-5" aria-hidden /> Book visit
        </Link>
        <a href={HOSPITAL.emergencyHref} className="flex flex-col items-center justify-center gap-1 text-danger-700">
          <Siren className="size-5" aria-hidden /> Emergency
        </a>
      </div>
    </div>
  );
}
