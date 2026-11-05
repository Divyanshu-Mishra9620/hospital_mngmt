import "server-only";
import { db } from "@/db";
import { settings } from "@/db/schema";

export const SETTING_DEFAULTS = {
  defaultInPersonFee: "500",
  defaultVideoFee: "350",
  deliveryFee: "40",
  freeDeliveryAbove: "999",
  pharmacyDiscountPercent: "5",
  bookingWindowDays: "14",
  announcement: "Free diabetic foot screening every Saturday in November at the Endocrinology OPD.",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings);
  const out = { ...SETTING_DEFAULTS } as Settings;
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
}

export async function getNumberSetting(key: SettingKey) {
  const s = await getSettings();
  const n = Number(s[key]);
  return Number.isFinite(n) ? n : Number(SETTING_DEFAULTS[key]);
}
