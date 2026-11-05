import type { Metadata } from "next";
import { and, count, eq, inArray } from "drizzle-orm";
import { Bell, CalendarClock, CalendarDays, FileText, IndianRupee, LayoutDashboard, Star, UserRound, Users } from "lucide-react";
import { db } from "@/db";
import { appointments, departments } from "@/db/schema";
import { requireDoctor } from "@/lib/auth/session";
import { unreadCount } from "@/lib/doctor/queries";
import { fmtLongDate } from "@/lib/format";
import { todayISO } from "@/lib/time";
import { StaffShell, type NavSection } from "@/components/shell/staff-shell";

export const metadata: Metadata = { title: { default: "Doctor portal", template: "%s · Doctor portal · Medora" } };

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const { user, doctor } = await requireDoctor();
  const today = todayISO();
  const [[waiting], unread, [dept]] = await Promise.all([
    db
      .select({ n: count() })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctor.id), eq(appointments.date, today), inArray(appointments.status, ["booked", "checked_in", "in_consult"]))),
    unreadCount(user.id),
    db.select({ name: departments.name }).from(departments).where(eq(departments.id, doctor.departmentId)),
  ]);

  const sections: NavSection[] = [
    {
      items: [
        { href: "/doctor", label: "Today", icon: <LayoutDashboard />, exact: true },
        { href: "/doctor/appointments", label: "Appointments", icon: <CalendarDays />, badge: Number(waiting?.n ?? 0) },
      ],
    },
    {
      title: "Clinical",
      items: [
        { href: "/doctor/patients", label: "My patients", icon: <Users /> },
        { href: "/doctor/prescriptions", label: "Prescriptions", icon: <FileText /> },
      ],
    },
    {
      title: "Practice",
      items: [
        { href: "/doctor/schedule", label: "OPD schedule & leave", icon: <CalendarClock /> },
        { href: "/doctor/earnings", label: "Earnings", icon: <IndianRupee /> },
        { href: "/doctor/reviews", label: "Patient reviews", icon: <Star /> },
      ],
    },
    {
      title: "Account",
      items: [
        { href: "/doctor/notifications", label: "Notifications", icon: <Bell />, badge: unread },
        { href: "/doctor/profile", label: "Profile & password", icon: <UserRound /> },
      ],
    },
  ];

  return (
    <StaffShell
      sections={sections}
      roleLabel="Doctor portal"
      homeHref="/doctor"
      notificationsHref="/doctor/notifications"
      unread={unread}
      user={{ name: user.name, code: doctor.code, subtitle: dept?.name ?? doctor.designation, color: doctor.avatarColor }}
      topRight={<span className="hidden rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-ink-600 md:inline">{fmtLongDate(today)}</span>}
    >
      {children}
    </StaffShell>
  );
}
