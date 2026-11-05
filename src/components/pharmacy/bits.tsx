import { Badge, type Tone } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import { diffDays, todayISO } from "@/lib/time";

const METHOD: Record<string, { label: string; tone: Tone }> = {
  cash: { label: "Cash", tone: "neutral" },
  upi: { label: "UPI", tone: "violet" },
  card: { label: "Card", tone: "info" },
  insurance: { label: "Insurance", tone: "accent" },
  netbanking: { label: "Net banking", tone: "info" },
};

export function paymentMethodLabel(m: string) {
  return METHOD[m]?.label ?? m;
}

export function PaymentMethodBadge({ method }: { method: string }) {
  const m = METHOD[method] ?? { label: method, tone: "neutral" as Tone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

const MOVEMENT: Record<string, { label: string; tone: Tone }> = {
  purchase: { label: "Stock in", tone: "success" },
  dispense: { label: "Counter sale", tone: "brand" },
  order: { label: "Online order", tone: "info" },
  adjustment: { label: "Adjustment", tone: "warning" },
  expired: { label: "Expired / damaged", tone: "danger" },
  return: { label: "Return", tone: "violet" },
};

export const MOVEMENT_TYPES = Object.entries(MOVEMENT).map(([value, v]) => ({ value, label: v.label }));

export function MovementBadge({ type }: { type: string }) {
  const m = MOVEMENT[type] ?? { label: type, tone: "neutral" as Tone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/** Expiry date with a coloured hint (expired / ≤ 90 days). */
export function ExpiryText({ date, compact }: { date: string | null; compact?: boolean }) {
  if (!date) return <span className="text-ink-400">—</span>;
  const days = diffDays(date, todayISO());
  const label = fmtDate(date);
  if (days <= 0)
    return (
      <span className="font-semibold text-danger-700">
        {label}
        {!compact && <span className="ml-1 text-xs font-medium">(expired)</span>}
      </span>
    );
  if (days <= 90)
    return (
      <span className="font-semibold text-warning-700">
        {label}
        {!compact && <span className="ml-1 text-xs font-medium">({days} d left)</span>}
      </span>
    );
  return <span className="text-ink-700">{label}</span>;
}

/* Indian-system amount in words, e.g. "Rupees One Thousand Two Hundred and Fifty Paise Fifty Only" */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function threeDigits(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}

export function amountInWords(amount: number) {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  const words = parts.join(" ") || "Zero";
  return `Rupees ${words}${paise ? ` and ${twoDigits(paise)} Paise` : ""} Only`;
}
