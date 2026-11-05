/**
 * Client-safe copy of lib/pharmacy courseQuantity (that module is server-only).
 * Units needed for a course: per-day × days; liquids/topicals default to one pack.
 */
export function suggestQuantity(frequency: string, durationDays: number, form?: string | null) {
  const pack = ["syrup", "suspension", "ointment", "cream", "drops", "inhaler", "gel", "device", "injection"];
  if (form && pack.includes(form)) return 1;
  if (frequency === "SOS") return Math.min(10, Math.max(4, durationDays));
  if (frequency === "STAT") return 1;
  const perDay = frequency.split("-").reduce((s, x) => s + (Number(x) || 0), 0);
  return Math.max(1, perDay * Math.max(1, durationDays));
}
