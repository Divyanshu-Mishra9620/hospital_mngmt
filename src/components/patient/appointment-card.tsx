import Link from "next/link";
import { Building2, ChevronRight, Clock, Hash, MapPin, Video } from "lucide-react";
import { AppointmentStatusBadge, ModeBadge } from "@/components/status";
import { Avatar } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { videoJoinState } from "@/lib/appointments";
import { fmtRelativeDay, fmtTime } from "@/lib/format";
import type { PatientAppointment } from "@/lib/queries/patient";
import { cn } from "@/lib/cn";

export function JoinVideoButton({ appt, block, size = "sm" }: { appt: Pick<PatientAppointment, "code" | "date" | "time" | "mode" | "status">; block?: boolean; size?: "sm" | "md" | "lg" }) {
  const join = videoJoinState(appt);
  if (appt.mode !== "video") return null;
  if (join.canJoin) {
    return (
      <LinkButton href={`/consult/${appt.code}`} variant="success" size={size} block={block} className="animate-pulse-ring">
        <Video aria-hidden /> Join video call
      </LinkButton>
    );
  }
  if (join.reason === "too_early") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700", block && "w-full justify-center")}>
        <Video className="size-3.5" aria-hidden /> Join opens 15 min before
      </span>
    );
  }
  return null;
}

export function AppointmentCard({ appt, compact }: { appt: PatientAppointment; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-200">
      <Link href={`/patient/appointments/${appt.code}`} className="flex items-start gap-3">
        <Avatar name={appt.doctorName} color={appt.doctorColor} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink-900">{appt.doctorName}</p>
              <p className="truncate text-[0.8125rem] text-ink-500">{appt.departmentName}</p>
            </div>
            <ChevronRight className="mt-0.5 size-5 shrink-0 text-ink-300" aria-hidden />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.8125rem] text-ink-700">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink-900">
              <Clock className="size-3.5 text-brand-600" aria-hidden />
              {fmtRelativeDay(appt.date)}, {fmtTime(appt.time)}
            </span>
            {appt.mode === "in_person" && appt.tokenNo && (
              <span className="inline-flex items-center gap-1">
                <Hash className="size-3.5 text-ink-400" aria-hidden />
                Token {appt.tokenNo}
              </span>
            )}
            {!compact && appt.mode === "in_person" && appt.doctorRoom && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-ink-400" aria-hidden />
                Room {appt.doctorRoom}
              </span>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <AppointmentStatusBadge status={appt.status} />
            <ModeBadge mode={appt.mode} />
          </div>
        </div>
      </Link>
      {appt.mode === "video" && ["booked", "checked_in", "in_consult"].includes(appt.status) && (
        <div className="mt-3 border-t border-line pt-3">
          <JoinVideoButton appt={appt} block />
        </div>
      )}
      {appt.mode === "in_person" && appt.status === "booked" && !compact && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-xs text-ink-500">
          <Building2 className="size-3.5" aria-hidden /> {appt.departmentLocation} · please arrive 15 minutes early
        </p>
      )}
    </div>
  );
}
