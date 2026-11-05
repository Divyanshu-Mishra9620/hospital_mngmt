import type { Metadata } from "next";
import type { ReactNode } from "react";
import { and, eq, sql } from "drizzle-orm";
import {
  AlertTriangle,
  BookOpenCheck,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requirePharmacist } from "@/lib/auth/session";
import { pharmacyBadges } from "@/lib/pharmacy-queries";
import { StaffShell, type NavSection } from "@/components/shell/staff-shell";

export const metadata: Metadata = { title: { default: "Pharmacy", template: "%s · Pharmacy · Medora" } };

export default async function PharmacyLayout({ children }: { children: ReactNode }) {
  const user = await requirePharmacist();
  const [badges, [unread]] = await Promise.all([
    pharmacyBadges(),
    db
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, false))),
  ]);

  const sections: NavSection[] = [
    { items: [{ href: "/pharmacy", label: "Dashboard", icon: <LayoutDashboard />, exact: true }] },
    {
      title: "Counter",
      items: [
        { href: "/pharmacy/dispense", label: "Dispense & bill", icon: <ShoppingBag /> },
        { href: "/pharmacy/sales", label: "Sales & bills", icon: <ReceiptText /> },
        { href: "/pharmacy/prescriptions", label: "Prescription register", icon: <ClipboardList /> },
      ],
    },
    {
      title: "Online",
      items: [{ href: "/pharmacy/orders", label: "Online orders", icon: <Package />, badge: badges.pendingOrders }],
    },
    {
      title: "Stock",
      items: [
        { href: "/pharmacy/inventory", label: "Inventory", icon: <Boxes /> },
        { href: "/pharmacy/alerts", label: "Stock alerts", icon: <AlertTriangle />, badge: badges.stockAlerts },
        { href: "/pharmacy/stock-ledger", label: "Stock ledger", icon: <ScrollText /> },
      ],
    },
  ];
  if (user.role === "admin") {
    sections.push({ title: "Administration", items: [{ href: "/admin", label: "Back to admin panel", icon: <ShieldCheck /> }] });
  }

  return (
    <StaffShell
      sections={sections}
      roleLabel="Pharmacy"
      homeHref="/pharmacy"
      notificationsHref="/pharmacy/notifications"
      unread={Number(unread?.n ?? 0)}
      user={{
        name: user.name,
        code: user.code,
        subtitle: user.role === "admin" ? `${user.code} · Administrator` : `${user.code} · Pharmacist`,
        color: "#2c7a4b",
      }}
      topRight={
        <span className="hidden items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 md:inline-flex">
          <BookOpenCheck className="size-3.5" aria-hidden /> Counter open 24×7
        </span>
      }
    >
      {children}
    </StaffShell>
  );
}
