import type { Metadata } from "next";
import { CalendarDays, Plus } from "lucide-react";
import { AppointmentCard } from "@/components/patient/appointment-card";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { isUpcoming } from "@/lib/appointments";
import { requirePatient } from "@/lib/auth/session";
import { listPatientAppointments } from "@/lib/queries/patient";
import { clinicNow } from "@/lib/time";

export const metadata: Metadata = { title: "My appointments" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { patient } = await requirePatient();
  const { tab = "upcoming" } = await searchParams;
  const now = clinicNow();
  const all = await listPatientAppointments(patient.id);

  const upcoming = all.filter((a) => isUpcoming(a, now)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = all.filter((a) => a.status !== "cancelled" && !isUpcoming(a, now));
  const cancelled = all.filter((a) => a.status === "cancelled");
  const list = tab === "past" ? past : tab === "cancelled" ? cancelled : upcoming;

  return (
    <div>
      <PageHeader
        title="My appointments"
        description="OPD visits and video consultations"
        actions={
          <LinkButton href="/patient/book" size="sm">
            <Plus aria-hidden /> New
          </LinkButton>
        }
      />
      <Tabs
        active={tab}
        className="mb-4"
        tabs={[
          { key: "upcoming", label: "Upcoming", href: "/patient/appointments", count: upcoming.length },
          { key: "past", label: "Past", href: "/patient/appointments?tab=past", count: past.length },
          { key: "cancelled", label: "Cancelled", href: "/patient/appointments?tab=cancelled", count: cancelled.length },
        ]}
      />
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays />}
            title={tab === "upcoming" ? "No upcoming appointments" : tab === "past" ? "No past visits yet" : "No cancelled appointments"}
            action={
              tab === "upcoming" ? (
                <LinkButton href="/patient/book" size="sm">
                  Book an appointment
                </LinkButton>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <li key={a.code}>
              <AppointmentCard appt={a} compact={tab !== "upcoming"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
