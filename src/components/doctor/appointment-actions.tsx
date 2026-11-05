import Link from "next/link";
import { ClipboardPlus, LogIn, Play, UserX, Video } from "lucide-react";
import type { AppointmentMode, AppointmentStatus } from "@/db/schema";
import { updateAppointmentStatus } from "@/lib/actions/doctor";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Appt = { code: string; status: AppointmentStatus; mode: AppointmentMode; date: string; rxCode?: string | null };

function ActionForm({ code, next, label, icon, variant = "outline" }: { code: string; next: AppointmentStatus; label: string; icon: React.ReactNode; variant?: "outline" | "primary" | "ghost" }) {
  return (
    <form action={updateAppointmentStatus.bind(null, code, next)}>
      <button type="submit" className={buttonStyles({ variant, size: "xs" })}>
        {icon}
        {label}
      </button>
    </form>
  );
}

/** Context-aware buttons for one appointment row (check in, start, no-show, open, join video). */
export function AppointmentActions({ appt, today, className }: { appt: Appt; today: string; className?: string }) {
  const live = appt.status === "booked" || appt.status === "checked_in" || appt.status === "in_consult";
  const isToday = appt.date === today;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {isToday && appt.status === "booked" && appt.mode === "in_person" && (
        <ActionForm code={appt.code} next="checked_in" label="Check in" icon={<LogIn />} />
      )}
      {isToday && appt.mode === "video" && live && (
        <Link href={`/consult/${appt.code}`} className={buttonStyles({ variant: "primary", size: "xs" })}>
          <Video /> Join video
        </Link>
      )}
      {isToday && appt.mode === "in_person" && (appt.status === "booked" || appt.status === "checked_in") && (
        <ActionForm code={appt.code} next="in_consult" label="Start" icon={<Play />} variant="primary" />
      )}
      {(live || appt.status === "completed") && (
        <Link href={`/doctor/consult/${appt.code}`} className={buttonStyles({ variant: appt.status === "in_consult" ? "primary" : "outline", size: "xs" })}>
          <ClipboardPlus />
          {appt.rxCode ? "View Rx" : appt.status === "completed" ? "Write Rx" : "Open"}
        </Link>
      )}
      {(appt.status === "booked" || appt.status === "checked_in") && appt.date <= today && (
        <ActionForm code={appt.code} next="no_show" label="No-show" icon={<UserX />} variant="ghost" />
      )}
      {appt.status === "no_show" && isToday && <ActionForm code={appt.code} next="booked" label="Undo no-show" icon={<LogIn />} variant="ghost" />}
    </div>
  );
}
