import "server-only";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, doctorLeaves, doctorSchedules, doctors, type AppointmentMode } from "@/db/schema";
import { addDays, clinicNow, fromMinutes, toMinutes, weekdayOf, type ClinicNow } from "./time";

export type Slot = {
  time: string;
  /** "available" | "booked" | "past" */
  state: "available" | "booked" | "past";
  session: "Morning" | "Afternoon" | "Evening";
};

export type DayAvailability = {
  date: string;
  onLeave: boolean;
  leaveReason?: string | null;
  slots: Slot[];
  available: number;
};

/** Minimum lead time before a slot can be booked online. */
const BOOKING_LEAD_MIN = 10;

function sessionOf(time: string): Slot["session"] {
  const m = toMinutes(time);
  if (m < 12 * 60) return "Morning";
  if (m < 16 * 60) return "Afternoon";
  return "Evening";
}

type ScheduleBlock = { weekday: number; startTime: string; endTime: string; mode: "both" | "in_person" | "video" };

/** Pure slot generator — exported for reuse in tests and the doctor schedule preview. */
export function buildSlots(
  date: string,
  blocks: ScheduleBlock[],
  slotMinutes: number,
  mode: AppointmentMode | null,
  taken: Set<string>,
  now: ClinicNow,
): Slot[] {
  const weekday = weekdayOf(date);
  const seen = new Set<string>();
  const out: Slot[] = [];
  for (const b of blocks) {
    if (b.weekday !== weekday) continue;
    if (mode && b.mode !== "both" && b.mode !== mode) continue;
    for (let m = toMinutes(b.startTime); m + slotMinutes <= toMinutes(b.endTime); m += slotMinutes) {
      const time = fromMinutes(m);
      if (seen.has(time)) continue;
      seen.add(time);
      const isPast = date < now.date || (date === now.date && m < now.minutes + BOOKING_LEAD_MIN);
      out.push({
        time,
        state: isPast ? "past" : taken.has(time) ? "booked" : "available",
        session: sessionOf(time),
      });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Availability for one doctor across a date range. Each doctor's slots are
 * computed only from that doctor's schedule and bookings, so booking with one
 * doctor never affects another doctor's calendar.
 */
export async function getDoctorAvailability(
  doctorId: number,
  fromDate: string,
  days: number,
  mode: AppointmentMode | null = null,
): Promise<DayAvailability[]> {
  const [doc] = await db.select({ slotMinutes: doctors.slotMinutes }).from(doctors).where(eq(doctors.id, doctorId));
  if (!doc) return [];
  const toDate = addDays(fromDate, days - 1);
  const [blocks, leaves, booked] = await Promise.all([
    db.select().from(doctorSchedules).where(eq(doctorSchedules.doctorId, doctorId)),
    db
      .select()
      .from(doctorLeaves)
      .where(and(eq(doctorLeaves.doctorId, doctorId), gte(doctorLeaves.date, fromDate), lte(doctorLeaves.date, toDate))),
    db
      .select({ date: appointments.date, time: appointments.time })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          gte(appointments.date, fromDate),
          lte(appointments.date, toDate),
          ne(appointments.status, "cancelled"),
        ),
      ),
  ]);
  const now = clinicNow();
  const takenByDate = new Map<string, Set<string>>();
  for (const b of booked) {
    if (!takenByDate.has(b.date)) takenByDate.set(b.date, new Set());
    takenByDate.get(b.date)!.add(b.time);
  }
  const leaveByDate = new Map(leaves.map((l) => [l.date, l]));

  const result: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const leave = leaveByDate.get(date);
    const slots = leave ? [] : buildSlots(date, blocks, doc.slotMinutes, mode, takenByDate.get(date) ?? new Set(), now);
    result.push({
      date,
      onLeave: !!leave,
      leaveReason: leave?.reason,
      slots,
      available: slots.filter((s) => s.state === "available").length,
    });
  }
  return result;
}

/** Server-side check used right before inserting a booking. */
export async function isSlotOffered(doctorId: number, date: string, time: string, mode: AppointmentMode) {
  const [day] = await getDoctorAvailability(doctorId, date, 1, mode);
  const slot = day?.slots.find((s) => s.time === time);
  return slot?.state === "available";
}

/**
 * Next available slot per doctor (used on doctor cards). Loads schedules,
 * leaves and bookings for all doctors in three queries.
 */
export async function nextAvailableByDoctor(doctorIds: number[], days = 7, mode: AppointmentMode | null = null) {
  const out = new Map<number, { date: string; time: string } | null>();
  if (!doctorIds.length) return out;
  const now = clinicNow();
  const from = now.date;
  const to = addDays(from, days - 1);
  const [docs, blocks, leaves, booked] = await Promise.all([
    db.select({ id: doctors.id, slotMinutes: doctors.slotMinutes }).from(doctors).where(inArray(doctors.id, doctorIds)),
    db.select().from(doctorSchedules).where(inArray(doctorSchedules.doctorId, doctorIds)),
    db
      .select({ doctorId: doctorLeaves.doctorId, date: doctorLeaves.date })
      .from(doctorLeaves)
      .where(and(inArray(doctorLeaves.doctorId, doctorIds), gte(doctorLeaves.date, from), lte(doctorLeaves.date, to))),
    db
      .select({ doctorId: appointments.doctorId, date: appointments.date, time: appointments.time })
      .from(appointments)
      .where(and(inArray(appointments.doctorId, doctorIds), gte(appointments.date, from), lte(appointments.date, to), ne(appointments.status, "cancelled"))),
  ]);
  const leaveSet = new Set(leaves.map((l) => `${l.doctorId}|${l.date}`));
  const taken = new Map<string, Set<string>>();
  for (const b of booked) {
    const k = `${b.doctorId}|${b.date}`;
    if (!taken.has(k)) taken.set(k, new Set());
    taken.get(k)!.add(b.time);
  }
  for (const d of docs) {
    const mine = blocks.filter((b) => b.doctorId === d.id);
    let found: { date: string; time: string } | null = null;
    for (let i = 0; i < days && !found; i++) {
      const date = addDays(from, i);
      if (leaveSet.has(`${d.id}|${date}`)) continue;
      const slot = buildSlots(date, mine, d.slotMinutes, mode, taken.get(`${d.id}|${date}`) ?? new Set(), now).find((s) => s.state === "available");
      if (slot) found = { date, time: slot.time };
    }
    out.set(d.id, found);
  }
  return out;
}

/** Live appointments for a set of doctors on a date — handy for dashboards. */
export async function liveAppointmentsOn(date: string, doctorIds?: number[]) {
  const conds = [eq(appointments.date, date), ne(appointments.status, "cancelled")];
  if (doctorIds?.length) conds.push(inArray(appointments.doctorId, doctorIds));
  return db.select().from(appointments).where(and(...conds));
}
