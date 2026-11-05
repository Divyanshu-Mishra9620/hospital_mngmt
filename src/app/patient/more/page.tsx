import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Bell, ChevronRight, FileText, FlaskConical, Globe, LogOut, Package, Phone, Receipt, Salad, ShoppingCart, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { HOSPITAL } from "@/lib/constants";

export const metadata: Metadata = { title: "More" };

const GROUPS = [
  {
    title: "My health",
    items: [
      { href: "/patient/prescriptions", label: "Prescriptions", icon: FileText },
      { href: "/patient/care-plan", label: "Diet & lifestyle plan", icon: Salad },
      { href: "/patient/records", label: "Health records & vitals", icon: Activity },
      { href: "/patient/health-checks", label: "Health check-ups", icon: FlaskConical },
    ],
  },
  {
    title: "Pharmacy & billing",
    items: [
      { href: "/patient/cart", label: "Cart", icon: ShoppingCart },
      { href: "/patient/orders", label: "Medicine orders", icon: Package },
      { href: "/patient/bills", label: "Bills & payments", icon: Receipt },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/patient/profile", label: "Profile & health card", icon: UserRound },
      { href: "/patient/notifications", label: "Notifications", icon: Bell },
      { href: "/", label: "Hospital website", icon: Globe },
    ],
  },
];

export default async function MorePage() {
  const { user, patient } = await requirePatient();
  return (
    <div className="space-y-5">
      <Link href="/patient/profile" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">{user.name}</p>
          <p className="tabular text-sm text-ink-500">UHID {patient.uhid}</p>
        </div>
        <ChevronRight className="size-5 text-ink-300" aria-hidden />
      </Link>

      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-500">{g.title}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            {g.items.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface/60">
                  <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="size-[1.125rem]" aria-hidden />
                  </span>
                  <span className="flex-1 text-[0.9375rem] font-medium text-ink-800">{label}</span>
                  <ChevronRight className="size-4 text-ink-300" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <a href={HOSPITAL.emergencyHref} className="flex items-center gap-3 rounded-2xl bg-danger-600 p-4 text-white shadow-soft">
        <Phone className="size-5" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold">24×7 Emergency</span>
          <span className="text-sm text-danger-100">{HOSPITAL.emergency}</span>
        </span>
        <ChevronRight className="size-5" aria-hidden />
      </a>

      <a href="/logout" className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3.5 text-sm font-semibold text-danger-700 shadow-card">
        <LogOut className="size-4" aria-hidden /> Sign out
      </a>
    </div>
  );
}
