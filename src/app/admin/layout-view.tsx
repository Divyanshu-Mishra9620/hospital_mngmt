"use client";

import { ClientPage } from "@/components/client-page";
import type { ReactNode } from "react";
import { count, eq, inArray } from "drizzle-orm";
import {
  BedDouble,
  Building2,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FlaskConical,
  History,
  Inbox,
  LayoutDashboard,
  Pill,
  Receipt,
  Settings,
  Star,
  Stethoscope,
  Store,
  Users,
  UserRound,
} from "lucide-react";
import { db } from "@/db";
import { enquiries, pharmacyOrders } from "@/db/schema";
import { StaffShell, type NavSection } from "@/components/shell/staff-shell";
import { requireAdmin } from "@/lib/auth/session";

async function __render({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const [[{ newEnquiries }], [{ openOrders }]] = await Promise.all([
    db.select({ newEnquiries: count() }).from(enquiries).where(eq(enquiries.status, "new")),
    db.select({ openOrders: count() }).from(pharmacyOrders).where(inArray(pharmacyOrders.status, ["placed", "processing"])),
  ]);

  const sections: NavSection[] = [
    {
      items: [
        { href: "/admin", label: "Dashboard", icon: <LayoutDashboard />, exact: true },
        { href: "/admin/reports", label: "Reports", icon: <ChartColumn /> },
      ],
    },
    {
      title: "Clinical",
      items: [
        { href: "/admin/appointments", label: "Appointments", icon: <CalendarDays /> },
        { href: "/admin/doctors", label: "Doctors", icon: <Stethoscope /> },
        { href: "/admin/departments", label: "Departments", icon: <Building2 /> },
        { href: "/admin/patients", label: "Patients", icon: <UserRound /> },
        { href: "/admin/beds", label: "Beds & admissions", icon: <BedDouble /> },
        { href: "/admin/health-packages", label: "Health check-ups", icon: <FlaskConical /> },
      ],
    },
    {
      title: "Finance & pharmacy",
      items: [
        { href: "/admin/billing", label: "Billing & payments", icon: <Receipt /> },
        { href: "/admin/pharmacy", label: "Pharmacy overview", icon: <Pill /> },
        { href: "/pharmacy", label: "Open pharmacy panel", icon: <Store />, badge: openOrders },
      ],
    },
    {
      title: "Administration",
      items: [
        { href: "/admin/staff", label: "Staff & users", icon: <Users /> },
        { href: "/admin/enquiries", label: "Enquiries", icon: <Inbox />, badge: newEnquiries },
        { href: "/admin/feedback", label: "Patient reviews", icon: <Star /> },
        { href: "/admin/audit", label: "Audit log", icon: <History /> },
        { href: "/admin/settings", label: "Settings", icon: <Settings /> },
      ],
    },
  ];

  return (
    <StaffShell
      sections={sections}
      roleLabel="Administration"
      user={{ name: user.name, code: user.code, subtitle: `Administrator · ${user.code}` }}
      homeHref="/admin"
      topRight={
        <a href="/" target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-600 hover:bg-surface md:flex">
          <ClipboardList className="size-4" aria-hidden /> View website
        </a>
      }
    >
      {children}
    </StaffShell>
  );
}

export default function LayoutView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
