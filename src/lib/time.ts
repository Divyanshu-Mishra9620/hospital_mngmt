/**
 * The hospital runs on India Standard Time regardless of where the server is
 * hosted. Every "today" / "now" comparison goes through these helpers.
 */
export const TZ = "Asia/Kolkata";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type ClinicNow = { date: string; time: string; minutes: number; weekday: number };

/** Current date/time at the hospital. */
export function clinicNow(at: Date = new Date()): ClinicNow {
  const p = Object.fromEntries(partsFmt.formatToParts(at).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const time = `${p.hour}:${p.minute}`;
  return { date, time, minutes: toMinutes(time), weekday: weekdayOf(date) };
}

export function todayISO() {
  return clinicNow().date;
}

/** "HH:MM" → minutes since midnight */
export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** minutes since midnight → "HH:MM" */
export function fromMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Weekday (0 = Sunday) of a YYYY-MM-DD date, independent of server TZ. */
export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86_400_000);
}

/** Minutes from clinic "now" until the given slot (negative if past). */
export function minutesUntil(date: string, time: string, now: ClinicNow = clinicNow()) {
  return diffDays(date, now.date) * 1440 + toMinutes(time) - now.minutes;
}

export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function isValidTime(s: unknown): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
