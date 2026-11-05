import { clinicNow } from "./time";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I confusion

function randomChunk(len: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Human-friendly reference: PREFIX-YYMMDD-XXXX, e.g. APT-261106-K7F2.
 * Uniqueness is enforced by the DB; collisions (1 in ~1M per day) are retried
 * by withUniqueCode().
 */
export function makeCode(prefix: "APT" | "RX" | "ORD" | "DSP" | "PAY" | "HCP" | "IPD") {
  const d = clinicNow().date.replace(/-/g, "").slice(2);
  return `${prefix}-${d}-${randomChunk(4)}`;
}

export function isUniqueViolation(err: unknown, needle?: string) {
  const msg = String((err as { message?: string; cause?: { message?: string } })?.cause?.message ?? (err as Error)?.message ?? err);
  return /UNIQUE constraint failed/i.test(msg) && (!needle || msg.includes(needle));
}

/** Runs `fn` with fresh codes until it doesn't hit a unique-code collision. */
export async function withUniqueCode<T>(prefix: Parameters<typeof makeCode>[0], fn: (code: string) => Promise<T>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn(makeCode(prefix));
    } catch (err) {
      if (isUniqueViolation(err, ".code")) continue;
      throw err;
    }
  }
  throw new Error("Could not allocate a reference number. Please retry.");
}
