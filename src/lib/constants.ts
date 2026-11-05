/** Static hospital information used across the public site and printouts. */
export const HOSPITAL = {
  name: "Medora Multispeciality Hospital",
  shortName: "Medora Hospital",
  tagline: "Advanced care. Human touch.",
  city: "Bengaluru",
  addressLines: ["14, Outer Ring Road, Bellandur", "Bengaluru, Karnataka 560103"],
  phone: "+91 80 4718 2000",
  phoneHref: "tel:+918047182000",
  emergency: "+91 80 4718 1111",
  emergencyHref: "tel:+918047181111",
  ambulance: "+91 80 4718 1108",
  ambulanceHref: "tel:+918047181108",
  whatsapp: "+91 98450 10200",
  email: "care@medorahospital.in",
  appointmentsEmail: "appointments@medorahospital.in",
  established: 2004,
  beds: 450,
  icuBeds: 82,
  gstin: "29ABCDE1234F1Z5",
  pharmacyLicence: "KA-B2-21B/20B-118742",
  opdHours: "Mon–Sat · 8:00 AM – 8:00 PM",
  pharmacyHours: "Open 24 × 7",
  visitingHours: "11:00 AM – 1:00 PM and 5:00 PM – 7:00 PM",
  mapQuery: "Bellandur, Bengaluru",
} as const;

export const SITE_NAV = [
  { href: "/about", label: "About" },
  { href: "/departments", label: "Specialities" },
  { href: "/doctors", label: "Find a Doctor" },
  { href: "/facilities", label: "Facilities", wide: true },
  { href: "/health-packages", label: "Health Checks" },
  { href: "/patients-visitors", label: "Patients & Visitors" },
  { href: "/health-library", label: "Health Library", wide: true },
  { href: "/contact", label: "Contact" },
] as const;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** How many days ahead patients can book. */
export const BOOKING_WINDOW_DAYS = 14;
/** Patients can join a video consult this many minutes before the slot. */
export const VIDEO_JOIN_EARLY_MIN = 15;
/** …and up to this many minutes after the slot starts. */
export const VIDEO_JOIN_LATE_MIN = 60;
/** Free cancellation up to this many hours before the slot. */
export const FREE_CANCEL_HOURS = 2;

export const PAYMENT_METHODS = [
  { value: "upi", label: "UPI" },
  { value: "card", label: "Debit / Credit card" },
  { value: "netbanking", label: "Net banking" },
] as const;

export const FREQUENCIES = [
  { value: "1-0-0", label: "1-0-0 · Once daily (morning)", perDay: 1 },
  { value: "0-0-1", label: "0-0-1 · Once daily (night)", perDay: 1 },
  { value: "1-0-1", label: "1-0-1 · Twice daily", perDay: 2 },
  { value: "1-1-1", label: "1-1-1 · Thrice daily", perDay: 3 },
  { value: "0-1-0", label: "0-1-0 · Once daily (afternoon)", perDay: 1 },
  { value: "1-1-0", label: "1-1-0 · Morning & afternoon", perDay: 2 },
  { value: "0-1-1", label: "0-1-1 · Afternoon & night", perDay: 2 },
  { value: "1-1-1-1", label: "1-1-1-1 · Four times daily", perDay: 4 },
  { value: "SOS", label: "SOS · Only when needed", perDay: 0 },
  { value: "STAT", label: "STAT · Single dose now", perDay: 0 },
] as const;

export const TIMINGS = ["After food", "Before food", "With food", "Empty stomach", "At bedtime", "As directed"] as const;

export const DIET_TYPES = [
  "Balanced (general)",
  "Diabetic (low glycaemic)",
  "DASH (low salt, heart healthy)",
  "Renal (low protein, low potassium)",
  "Low fat / cardiac",
  "High protein (recovery)",
  "Soft / bland (GI)",
  "Weight management",
  "Pregnancy & lactation",
  "Paediatric",
] as const;

export const MEAL_SLOTS = [
  { key: "earlyMorning", label: "Early morning", time: "6:30 AM" },
  { key: "breakfast", label: "Breakfast", time: "8:30 AM" },
  { key: "midMorning", label: "Mid-morning", time: "11:00 AM" },
  { key: "lunch", label: "Lunch", time: "1:30 PM" },
  { key: "evening", label: "Evening snack", time: "5:00 PM" },
  { key: "dinner", label: "Dinner", time: "8:00 PM" },
  { key: "bedtime", label: "Bedtime", time: "10:00 PM" },
] as const;
export type MealKey = (typeof MEAL_SLOTS)[number]["key"];
export type Meals = Partial<Record<MealKey, string>>;

export const COMMON_LAB_TESTS = [
  "Complete Blood Count (CBC)",
  "HbA1c",
  "Fasting Blood Sugar",
  "Post-prandial Blood Sugar",
  "Lipid Profile",
  "Liver Function Test (LFT)",
  "Kidney Function Test (KFT)",
  "Thyroid Profile (T3, T4, TSH)",
  "Urine Routine & Microscopy",
  "Vitamin D (25-OH)",
  "Vitamin B12",
  "Serum Electrolytes",
  "ECG",
  "2D Echo",
  "Chest X-ray (PA view)",
  "USG Abdomen",
  "CRP",
  "Serum Creatinine",
] as const;
