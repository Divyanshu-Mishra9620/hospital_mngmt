import { FREE_CANCEL_HOURS, VIDEO_JOIN_EARLY_MIN, VIDEO_JOIN_LATE_MIN } from "./constants";
import { clinicNow, minutesUntil, type ClinicNow } from "./time";

type ApptLike = { date: string; time: string; mode: "in_person" | "video"; status: string };

const LIVE = ["booked", "checked_in", "in_consult"];

export function isUpcoming(a: ApptLike, now: ClinicNow = clinicNow()) {
  return LIVE.includes(a.status) && minutesUntil(a.date, a.time, now) > -VIDEO_JOIN_LATE_MIN;
}

/** Patient-side: can the video room be entered right now? */
export function videoJoinState(a: ApptLike, now: ClinicNow = clinicNow()) {
  if (a.mode !== "video" || !LIVE.includes(a.status)) return { canJoin: false as const, reason: "not_live" as const };
  const mins = minutesUntil(a.date, a.time, now);
  if (a.date !== now.date) return { canJoin: false as const, reason: mins > 0 ? ("too_early" as const) : ("ended" as const), minutes: mins };
  if (mins > VIDEO_JOIN_EARLY_MIN && a.status !== "in_consult") return { canJoin: false as const, reason: "too_early" as const, minutes: mins };
  if (mins < -VIDEO_JOIN_LATE_MIN && a.status !== "in_consult") return { canJoin: false as const, reason: "ended" as const, minutes: mins };
  return { canJoin: true as const, minutes: mins };
}

/** Cancellation rules shown to the patient and enforced by the action. */
export function cancellationPolicy(a: ApptLike, now: ClinicNow = clinicNow()) {
  const mins = minutesUntil(a.date, a.time, now);
  const cancellable = a.status === "booked" && mins > 0;
  const refundable = mins >= FREE_CANCEL_HOURS * 60;
  return { cancellable, refundable, minutes: mins };
}
