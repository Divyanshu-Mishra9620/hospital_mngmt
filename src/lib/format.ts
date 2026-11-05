import { TZ, clinicNow, diffDays } from "./time";

const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-IN");

/** ₹1,250 — whole rupees unless the amount has paise. */
export function inr(amount: number | null | undefined, opts: { paise?: boolean } = {}) {
  const v = amount ?? 0;
  if (opts.paise || Math.round(v * 100) % 100 !== 0) return inr2.format(v);
  return inr0.format(v);
}

export function fmtNumber(n: number) {
  return num.format(n);
}

/** Round money to 2 decimals. */
export function money(n: number) {
  return Math.round(n * 100) / 100;
}

function parseDateOnly(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "6 Nov 2026" */
export function fmtDate(date: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!date) return "—";
  const d = date.length === 10 ? parseDateOnly(date) : new Date(date);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: date.length === 10 ? "UTC" : TZ, ...opts });
}

/** "Fri, 6 Nov" */
export function fmtDay(date: string) {
  return parseDateOnly(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** "Friday, 6 November 2026" */
export function fmtLongDate(date: string) {
  return parseDateOnly(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** "Today" / "Tomorrow" / "Fri, 6 Nov" */
export function fmtRelativeDay(date: string) {
  const d = diffDays(date, clinicNow().date);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return fmtDay(date);
}

/** "HH:MM" → "9:30 AM" */
export function fmtTime(time: string | null | undefined) {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** ISO timestamp → "6 Nov 2026, 4:05 PM" (IST) */
export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
}

/** "3 min ago", "2 h ago", "4 Nov" */
export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return fmtDate(iso);
}

export function ageFrom(dob: string | null | undefined) {
  if (!dob) return null;
  const today = clinicNow().date;
  let age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  if (today.slice(5) < dob.slice(5)) age--;
  return age;
}

export function initials(name: string) {
  const parts = name.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function genderLabel(g: string | null | undefined) {
  return g ? g[0].toUpperCase() + g.slice(1) : "—";
}

export function bmi(weightKg?: number | null, heightCm?: number | null) {
  if (!weightKg || !heightCm) return null;
  const v = weightKg / (heightCm / 100) ** 2;
  const value = Math.round(v * 10) / 10;
  const band = v < 18.5 ? "Underweight" : v < 23 ? "Healthy" : v < 25 ? "Overweight" : "Obese";
  return { value, band };
}

export function parseJSON<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
