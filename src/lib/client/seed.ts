/**
 * Generates realistic demo data in the browser's local database on first visit
 * (LOCAL STORAGE MODE). Dates are relative to "today", so the demo always has
 * upcoming appointments, a video consult starting soon, recent prescriptions…
 * Adapted from the server seed script (archive/database-version.zip).
 */
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { addDays, clinicNow, fromMinutes, toMinutes, weekdayOf } from "@/lib/time";
import {
  AREAS,
  CARE_PLANS,
  CITIES,
  DEPARTMENTS,
  DOCTORS,
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  HEALTH_PACKAGES,
  LAST_NAMES,
  MEDICINES,
  RX_TEMPLATES,
  WARDS,
  type RxTemplate,
} from "./seed-data";

/** History kept short so the compressed database fits comfortably in localStorage. */
const HISTORY_DAYS = 21;
const FUTURE_DAYS = 8;
const OTC_DAYS = 12;

/* ---------------------------------------------------------------- helpers */

let seed = 20261106;
function rand() {
  // mulberry32 — deterministic so the demo looks the same on every machine
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const chance = (p: number) => rand() < p;
const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const usedCodes = new Set<string>();
function code(prefix: string, date: string) {
  for (;;) {
    let r = "";
    for (let i = 0; i < 4; i++) r += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
    const c = `${prefix}-${date.replace(/-/g, "").slice(2)}-${r}`;
    if (!usedCodes.has(c)) {
      usedCodes.add(c);
      return c;
    }
  }
}
/** IST wall-clock → ISO UTC string */
function istToISO(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}
async function insertMany<T extends Record<string, unknown>>(table: Parameters<typeof db.insert>[0], rows: T[]) {
  for (let i = 0; i < rows.length; i += 200) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + 200) as any);
  }
}
function slotsFor(doc: (typeof DOCTORS)[number], date: string, mode?: "in_person" | "video") {
  const wd = weekdayOf(date);
  const out: string[] = [];
  for (const b of doc.schedule) {
    if (!b.days.includes(wd)) continue;
    const bm = b.mode ?? "both";
    if (mode && bm !== "both" && bm !== mode) continue;
    for (let mm = toMinutes(b.start); mm + doc.slot <= toMinutes(b.end); mm += doc.slot) out.push(fromMinutes(mm));
  }
  return [...new Set(out)].sort();
}
function blockModeAt(doc: (typeof DOCTORS)[number], date: string, time: string) {
  const wd = weekdayOf(date);
  const t = toMinutes(time);
  const b = doc.schedule.find((x) => x.days.includes(wd) && t >= toMinutes(x.start) && t < toMinutes(x.end));
  return b?.mode ?? "both";
}
function tokenFor(doc: (typeof DOCTORS)[number], date: string, time: string) {
  return slotsFor(doc, date).indexOf(time) + 1 || null;
}

/* ------------------------------------------------------------------- main */

/** Fills an empty, freshly-migrated database. Runs inside a transaction (see store.ts). */
export async function seedDatabase() {
  seed = 20261106;
  usedCodes.clear();

  const now = clinicNow();
  const today = now.date;
  const hash = {
    patient: await bcrypt.hash("Patient@123", 10),
    doctor: await bcrypt.hash("Doctor@123", 10),
    pharmacist: await bcrypt.hash("Pharma@123", 10),
    admin: await bcrypt.hash("Admin@123", 10),
  };

  /* -------------------------------------------------------------- settings */
  await insertMany(s.settings, [
    { key: "defaultInPersonFee", value: "500" },
    { key: "defaultVideoFee", value: "350" },
    { key: "deliveryFee", value: "40" },
    { key: "freeDeliveryAbove", value: "999" },
    { key: "pharmacyDiscountPercent", value: "5" },
    { key: "bookingWindowDays", value: "14" },
    { key: "announcement", value: "Free diabetic foot screening every Saturday this month at the Endocrinology OPD (Block A, Ground floor)." },
  ]);

  /* ----------------------------------------------------------- departments */
  const deptRows = await db
    .insert(s.departments)
    .values(DEPARTMENTS.map((d, i) => ({ ...d, sortOrder: i + 1 })))
    .returning();
  const deptBySlug = new Map(deptRows.map((d) => [d.slug, d]));

  /* ------------------------------------------------------------ staff users */
  const [admin] = await db
    .insert(s.users)
    .values({ role: "admin", code: "ADM-001", name: "Ritu Malhotra", email: "admin@medorahospital.in", phone: "+91 98450 11001", passwordHash: hash.admin })
    .returning();
  await db.insert(s.users).values({
    role: "admin",
    code: "ADM-002",
    name: "Sameer Kulkarni",
    email: "sameer.k@medorahospital.in",
    phone: "+91 98450 11002",
    passwordHash: hash.admin,
  });
  const pharmacists = await db
    .insert(s.users)
    .values([
      { role: "pharmacist", code: "PHA-201", name: "Suresh Kumar", email: "pharmacy@medorahospital.in", phone: "+91 98450 12201", passwordHash: hash.pharmacist },
      { role: "pharmacist", code: "PHA-202", name: "Nisha Reddy", email: "nisha.reddy@medorahospital.in", phone: "+91 98450 12202", passwordHash: hash.pharmacist },
    ])
    .returning();

  /* --------------------------------------------------------------- doctors */
  const doctorRows: { id: number; userId: number; seed: (typeof DOCTORS)[number]; deptSlug: string }[] = [];
  for (const d of DOCTORS) {
    const [u] = await db
      .insert(s.users)
      .values({ role: "doctor", code: d.code, name: d.name, email: d.email, phone: `+91 98450 ${d.code.slice(4)}0`, passwordHash: hash.doctor })
      .returning();
    const [doc] = await db
      .insert(s.doctors)
      .values({
        userId: u.id,
        code: d.code,
        departmentId: deptBySlug.get(d.dept)!.id,
        designation: d.designation,
        qualifications: d.qualifications,
        experienceYears: d.experience,
        languages: d.languages,
        bio: d.bio,
        expertise: d.expertise,
        room: d.room,
        registrationNo: `KMC-${int(40000, 89999)}`,
        inPersonFee: 500,
        videoFee: 350,
        slotMinutes: d.slot,
        videoEnabled: d.schedule.some((b) => (b.mode ?? "both") !== "in_person"),
        avatarColor: d.color,
      })
      .returning();
    doctorRows.push({ id: doc.id, userId: u.id, seed: d, deptSlug: d.dept });
    const blocks = d.schedule.flatMap((b) => b.days.map((wd) => ({ doctorId: doc.id, weekday: wd, startTime: b.start, endTime: b.end, mode: b.mode ?? ("both" as const) })));
    await insertMany(s.doctorSchedules, blocks);
  }
  // A couple of upcoming leave days to show the feature
  await insertMany(s.doctorLeaves, [
    { doctorId: doctorRows[1].id, date: addDays(today, 5), reason: "Conference — CTVS annual meet" },
    { doctorId: doctorRows[4].id, date: addDays(today, 8), reason: "Personal leave" },
  ]);

  /* -------------------------------------------------------------- patients */
  type P = { id: number; userId: number; name: string; uhid: string };
  const patientRows: P[] = [];
  let uhidSeq = 100100;
  async function addPatient(p: {
    name: string;
    email: string;
    phone: string;
    dob: string;
    gender: "female" | "male" | "other";
    blood: string;
    allergies?: string;
    chronic?: string;
    height?: number;
    weight?: number;
    insurer?: string;
    policy?: string;
    city?: string;
    area?: string;
    emergency?: [string, string, string];
    createdAt?: string;
  }) {
    const uhid = `MDR-${++uhidSeq}`;
    const [u] = await db
      .insert(s.users)
      .values({ role: "patient", code: uhid, name: p.name, email: p.email, phone: p.phone, passwordHash: hash.patient, createdAt: p.createdAt })
      .returning();
    const [row] = await db
      .insert(s.patients)
      .values({
        userId: u.id,
        uhid,
        dob: p.dob,
        gender: p.gender,
        bloodGroup: p.blood,
        address: `${int(1, 220)}, ${int(1, 18)}th Cross, ${p.area ?? pick(AREAS)}`,
        city: p.city ?? "Bengaluru",
        pincode: String(int(560001, 560103)),
        emergencyName: p.emergency?.[0] ?? null,
        emergencyRelation: p.emergency?.[1] ?? null,
        emergencyPhone: p.emergency?.[2] ?? null,
        allergies: p.allergies ?? null,
        chronicConditions: p.chronic ?? null,
        heightCm: p.height ?? null,
        weightKg: p.weight ?? null,
        insuranceProvider: p.insurer ?? null,
        insurancePolicyNo: p.policy ?? null,
        createdAt: p.createdAt,
      })
      .returning();
    const rec = { id: row.id, userId: u.id, name: p.name, uhid };
    patientRows.push(rec);
    return rec;
  }

  const demo = await addPatient({
    name: "Rahul Verma",
    email: "rahul.verma@example.com",
    phone: "+91 98860 45210",
    dob: "1984-04-12",
    gender: "male",
    blood: "B+",
    allergies: "Penicillin (rash)",
    chronic: "Type 2 diabetes (since 2019), Hypertension",
    height: 174,
    weight: 84,
    insurer: "Star Shield Health (TPA: MedAssist)",
    policy: "SSH-4471-2290-18",
    area: "HSR Layout",
    emergency: ["Neha Verma", "Spouse", "+91 98860 45211"],
    createdAt: istToISO(addDays(today, -120), "10:12"),
  });
  const named: Parameters<typeof addPatient>[0][] = [
    { name: "Priya Sharma", email: "priya.sharma@example.com", phone: "+91 99001 22334", dob: "1993-09-21", gender: "female", blood: "O+", chronic: "Hypothyroidism", height: 160, weight: 62, emergency: ["Ankit Sharma", "Husband", "+91 99001 22335"] },
    { name: "Amit Patel", email: "amit.patel@example.com", phone: "+91 97400 66120", dob: "1971-02-03", gender: "male", blood: "A+", chronic: "Hypertension, Dyslipidaemia", allergies: "Sulfa drugs", height: 170, weight: 79 },
    { name: "Sunita Devi", email: "sunita.devi@example.com", phone: "+91 96111 45001", dob: "1958-11-30", gender: "female", blood: "B-", chronic: "Osteoarthritis knees, Type 2 diabetes", height: 152, weight: 68 },
    { name: "Mohammed Arif", email: "m.arif@example.com", phone: "+91 98444 21900", dob: "1989-06-15", gender: "male", blood: "O-", chronic: "Bronchial asthma", height: 178, weight: 72 },
    { name: "Kavya Reddy", email: "kavya.reddy@example.com", phone: "+91 90080 33441", dob: "1997-01-08", gender: "female", blood: "AB+", chronic: "Pregnancy (14 weeks)", height: 158, weight: 57 },
    { name: "Arjun Singh", email: "arjun.singh@example.com", phone: "+91 99860 10023", dob: "2016-03-19", gender: "male", blood: "A+", height: 128, weight: 26, emergency: ["Harpreet Singh", "Father", "+91 99860 10024"] },
    { name: "Lakshmi Narayan", email: "lakshmi.n@example.com", phone: "+91 94480 77102", dob: "1949-08-25", gender: "female", blood: "O+", chronic: "CKD stage 3, Hypertension", height: 150, weight: 55 },
    { name: "Fatima Khan", email: "fatima.khan@example.com", phone: "+91 98451 66020", dob: "1991-12-04", gender: "female", blood: "B+", chronic: "PCOS", height: 162, weight: 70 },
    { name: "Rakesh Yadav", email: "rakesh.yadav@example.com", phone: "+91 97319 50011", dob: "1979-05-11", gender: "male", blood: "A-", allergies: "NSAIDs (gastritis)", height: 168, weight: 81 },
    { name: "Ishita Bose", email: "ishita.bose@example.com", phone: "+91 98302 41188", dob: "2000-07-29", gender: "female", blood: "O+", chronic: "Migraine", height: 165, weight: 54 },
    { name: "George Thomas", email: "george.thomas@example.com", phone: "+91 94470 90031", dob: "1966-10-17", gender: "male", blood: "AB-", chronic: "Coronary artery disease (post-PCI 2023)", height: 172, weight: 77 },
  ];
  for (const p of named) await addPatient({ ...p, createdAt: istToISO(addDays(today, -int(20, 200)), "11:00") });
  for (let i = 0; i < 28; i++) {
    const female = chance(0.5);
    const first = pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
    const last = pick(LAST_NAMES);
    await addPatient({
      name: `${first} ${last}`,
      email: `${first}.${last}.${i + 1}@example.com`.toLowerCase(),
      phone: `+91 9${int(100000000, 999999999)}`,
      dob: `${int(1950, 2018)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`,
      gender: female ? "female" : "male",
      blood: pick(s.BLOOD_GROUPS),
      height: int(150, 185),
      weight: int(48, 95),
      city: pick(CITIES),
      createdAt: istToISO(addDays(today, -int(1, 90)), `${String(int(8, 20)).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}`),
    });
  }

  /* ------------------------------------------------------------- medicines */
  const medRows = await db
    .insert(s.medicines)
    .values(
      MEDICINES.map((m) => ({
        sku: m.sku,
        name: m.name,
        genericName: m.generic,
        manufacturer: m.mfr,
        category: m.category,
        form: m.form,
        strength: m.strength ?? null,
        unitLabel: m.unit,
        unitPrice: m.price,
        rxRequired: m.rx,
        reorderLevel: m.reorder,
        rack: m.rack,
        hsn: m.form === "device" ? "9025" : "3004",
        gstPercent: m.form === "device" ? 18 : 12,
        stock: 0,
      })),
    )
    .returning();
  const medByName = new Map(medRows.map((m) => [m.name, m]));
  const SUPPLIERS = ["Karnataka Medical Distributors", "Southern Pharma Agencies", "Apex Healthcare Supplies", "Shree Balaji Pharma Traders"];

  // Batches: an older batch (some near expiry) + a fresh batch.
  type B = { id: number; medicineId: number; batchNo: string; expiryDate: string; quantity: number };
  const batches: B[] = [];
  const movements: (typeof s.stockMovements.$inferInsert)[] = [];
  const stockOf = new Map<number, number>();
  for (const [idx, m] of MEDICINES.entries()) {
    const med = medByName.get(m.name)!;
    if (m.stock === 0) {
      // received earlier but sold out
      const [b] = await db
        .insert(s.medicineBatches)
        .values({ medicineId: med.id, batchNo: `${m.sku.slice(4)}A${int(10, 99)}`, expiryDate: addDays(today, 400), quantity: 0, receivedQty: 300, costPrice: +(m.price * 0.7).toFixed(2), supplier: pick(SUPPLIERS), invoiceNo: `INV-${int(10000, 99999)}`, receivedAt: istToISO(addDays(today, -70), "11:30") })
        .returning();
      movements.push({ medicineId: med.id, batchId: b.id, type: "purchase", quantity: 300, balanceAfter: 300, reference: b.invoiceNo, note: `Received from ${b.supplier}`, userId: pharmacists[0].id, createdAt: istToISO(addDays(today, -70), "11:30") });
      movements.push({ medicineId: med.id, batchId: b.id, type: "dispense", quantity: -300, balanceAfter: 0, reference: "Counter sales", note: "Sold out", userId: pharmacists[0].id, createdAt: istToISO(addDays(today, -3), "18:10") });
      stockOf.set(med.id, 0);
      continue;
    }
    const older = Math.round(m.stock * 0.35);
    const fresh = m.stock - older;
    const nearExpiry = idx % 9 === 4; // a few batches expire soon
    const specs = [
      { qty: older, expiry: nearExpiry ? addDays(today, int(12, 45)) : addDays(today, int(150, 330)), received: addDays(today, -int(60, 120)) },
      { qty: fresh, expiry: addDays(today, int(420, 800)), received: addDays(today, -int(5, 30)) },
    ].filter((x) => x.qty > 0);
    let bal = 0;
    for (const [bi, sp] of specs.entries()) {
      const batchNo = `${m.sku.slice(4)}${String.fromCharCode(65 + bi)}${int(10, 99)}`;
      const inv = `INV-${int(10000, 99999)}`;
      const supplier = pick(SUPPLIERS);
      const [b] = await db
        .insert(s.medicineBatches)
        .values({ medicineId: med.id, batchNo, expiryDate: sp.expiry, quantity: sp.qty, receivedQty: sp.qty, costPrice: +(m.price * 0.72).toFixed(2), supplier, invoiceNo: inv, receivedAt: istToISO(sp.received, "11:00") })
        .returning();
      bal += sp.qty;
      batches.push({ id: b.id, medicineId: med.id, batchNo, expiryDate: sp.expiry, quantity: sp.qty });
      movements.push({ medicineId: med.id, batchId: b.id, type: "purchase", quantity: sp.qty, balanceAfter: bal, reference: inv, note: `Received from ${supplier}`, userId: pharmacists[bi % 2].id, createdAt: istToISO(sp.received, "11:00") });
    }
    stockOf.set(med.id, bal);
  }

  /** FEFO deduction used while generating historic sales. */
  function take(medicineId: number, qty: number, type: "dispense" | "order", reference: string, userId: number, at: string) {
    const avail = batches.filter((b) => b.medicineId === medicineId && b.quantity > 0 && b.expiryDate > today).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    const total = avail.reduce((x, b) => x + b.quantity, 0);
    if (total < qty) return null;
    let rem = qty;
    let firstBatch = "";
    for (const b of avail) {
      if (rem <= 0) break;
      const t = Math.min(rem, b.quantity);
      b.quantity -= t;
      rem -= t;
      firstBatch ||= b.batchNo;
      const bal = (stockOf.get(medicineId) ?? 0) - t;
      stockOf.set(medicineId, bal);
      movements.push({ medicineId, batchId: b.id, type, quantity: -t, balanceAfter: bal, reference, userId, createdAt: at });
    }
    return firstBatch;
  }

  /* ------------------------------------------------------ health packages */
  await insertMany(
    s.healthPackages,
    HEALTH_PACKAGES.map((p) => ({ ...p, tests: JSON.stringify(p.tests) })),
  );
  await insertMany(s.wards, WARDS);
  const wardRows = await db.select().from(s.wards);

  /* ---------------------------------------------------------- appointments */
  const taken = new Set<string>(); // doctorId|date|time and p:patientId|date|time
  const isFree = (docId: number, patId: number, date: string, time: string) => !taken.has(`${docId}|${date}|${time}`) && !taken.has(`p${patId}|${date}|${time}`);
  const hold = (docId: number, patId: number, date: string, time: string) => {
    taken.add(`${docId}|${date}|${time}`);
    taken.add(`p${patId}|${date}|${time}`);
  };

  const apptInserts: (typeof s.appointments.$inferInsert)[] = [];
  const paymentInserts: (typeof s.payments.$inferInsert)[] = [];
  type Hist = { idx: number; doc: (typeof doctorRows)[number]; patient: P; date: string; time: string; mode: "in_person" | "video"; template?: RxTemplate };
  const history: Hist[] = [];

  function addAppt(doc: (typeof doctorRows)[number], patient: P, date: string, time: string, mode: "in_person" | "video", status: s.AppointmentStatus, reason: string, bookedDaysBefore = int(0, 4)) {
    hold(doc.id, patient.id, date, time);
    const fee = mode === "video" ? 350 : 500;
    const apptCode = code("APT", date);
    // Future visits were booked over the past week, not all "today".
    const bookedOn = date <= today ? addDays(date, -bookedDaysBefore) : addDays(today, -int(0, 6));
    const bookedAt = istToISO(bookedOn, `${String(int(8, 21)).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}`);
    const createdAt = bookedAt > new Date().toISOString() ? new Date(Date.now() - int(10, 300) * 60000).toISOString() : bookedAt;
    const doneAt = istToISO(date, fromMinutes(toMinutes(time) + doc.seed.slot));
    apptInserts.push({
      code: apptCode,
      patientId: patient.id,
      doctorId: doc.id,
      date,
      time,
      mode,
      status,
      reason,
      fee,
      paymentStatus: status === "cancelled" ? "refunded" : "paid",
      tokenNo: tokenFor(doc.seed, date, time),
      checkedInAt: ["checked_in", "in_consult", "completed"].includes(status) && mode === "in_person" ? istToISO(date, fromMinutes(toMinutes(time) - int(5, 20))) : null,
      startedAt: ["in_consult", "completed"].includes(status) ? istToISO(date, time) : null,
      completedAt: status === "completed" ? doneAt : null,
      cancelReason: status === "cancelled" ? "Change of plans" : null,
      cancelledBy: status === "cancelled" ? "patient" : null,
      createdAt,
    });
    paymentInserts.push({
      code: code("PAY", bookedOn),
      patientId: patient.id,
      purpose: "consultation",
      reference: apptCode,
      description: `${mode === "video" ? "Video" : "OPD"} consultation — ${doc.seed.name}`,
      amount: fee,
      method: pick(["upi", "upi", "upi", "card", "netbanking"]),
      status: status === "cancelled" ? "refunded" : "success",
      createdAt,
    });
    return apptInserts.length - 1;
  }

  const REASONS: Record<string, string[]> = {
    cardiology: ["Chest discomfort on exertion", "BP review", "Palpitations", "Follow-up after angioplasty"],
    endocrinology: ["Diabetes review", "Thyroid follow-up", "High sugar readings", "Weight gain"],
    "internal-medicine": ["Fever and cough", "Acidity", "General check-up", "Body ache and weakness"],
    orthopaedics: ["Knee pain", "Lower back pain", "Shoulder stiffness", "Ankle sprain"],
    pulmonology: ["Breathlessness", "Chronic cough", "Snoring", "Asthma follow-up"],
    "obstetrics-gynaecology": ["Antenatal visit", "Irregular periods", "PCOS follow-up"],
    paediatrics: ["Cough and cold", "Vaccination", "Growth review"],
    dermatology: ["Skin rash", "Acne", "Hair fall"],
    neurology: ["Recurrent headaches", "Dizziness", "Numbness in hands"],
    nephrology: ["Raised creatinine", "Swelling of feet"],
    gastroenterology: ["Bloating", "Fatty liver on scan", "Constipation"],
    psychiatry: ["Low mood", "Anxiety and poor sleep"],
  };
  const reasonFor = (slug: string) => pick(REASONS[slug] ?? ["Consultation"]);

  // ~35 days of history across all doctors
  const others = patientRows.filter((p) => p.id !== demo.id);
  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const date = addDays(today, -back);
    for (const doc of doctorRows) {
      const all = slotsFor(doc.seed, date);
      if (!all.length) continue;
      const n = Math.min(all.length, int(1, 5));
      for (let k = 0; k < n; k++) {
        const time = pick(all);
        const patient = pick(others);
        if (!isFree(doc.id, patient.id, date, time)) continue;
        const bm = blockModeAt(doc.seed, date, time);
        const mode = bm === "video" ? "video" : bm === "in_person" ? "in_person" : chance(0.25) ? "video" : "in_person";
        const status: s.AppointmentStatus = chance(0.06) ? "cancelled" : chance(0.05) ? "no_show" : "completed";
        const idx = addAppt(doc, patient, date, time, mode, status, reasonFor(doc.deptSlug));
        if (status === "completed" && RX_TEMPLATES[doc.deptSlug] && chance(0.7)) {
          history.push({ idx, doc, patient, date, time, mode, template: pick(RX_TEMPLATES[doc.deptSlug]) });
        }
      }
    }
  }

  // Demo patient's own history — explicit and rich
  const byCode = (c: string) => doctorRows.find((d) => d.seed.code === c)!;
  const drAnanya = byCode("DOC-1001");
  const drRajesh = byCode("DOC-1015");
  const drDeepak = byCode("DOC-1020");
  const firstFree = (doc: (typeof doctorRows)[number], date: string, mode?: "in_person" | "video") =>
    slotsFor(doc.seed, date, mode).find((t) => isFree(doc.id, demo.id, date, t));
  const nearestWorkingDay = (doc: (typeof doctorRows)[number], from: string, dir: 1 | -1, mode?: "in_person" | "video") => {
    for (let i = 0; i < 14; i++) {
      const d = addDays(from, i * dir);
      if (firstFree(doc, d, mode)) return d;
    }
    return from;
  };
  const demoHist: [typeof drAnanya, number, "in_person" | "video", RxTemplate][] = [
    [drRajesh, -92, "in_person", RX_TEMPLATES.endocrinology[0]],
    [drDeepak, -46, "in_person", RX_TEMPLATES["internal-medicine"][1]],
    [drAnanya, -21, "in_person", RX_TEMPLATES.cardiology[0]],
    [drRajesh, -6, "video", RX_TEMPLATES.endocrinology[0]],
  ];
  for (const [doc, back, mode, template] of demoHist) {
    const date = nearestWorkingDay(doc, addDays(today, back), -1, mode);
    const time = firstFree(doc, date, mode)!;
    const idx = addAppt(doc, demo, date, time, mode, "completed", mode === "video" ? "Review of sugar readings" : template.complaints.split(",")[0], 2);
    history.push({ idx, doc, patient: demo, date, time, mode, template });
  }

  // Today's OPD for the demo doctor (Dr. Ananya Rao) and others
  const todaysFor = (doc: (typeof doctorRows)[number], count: number) => {
    const all = slotsFor(doc.seed, today);
    const picks = all.filter((_, i) => i % 2 === 0).slice(0, count);
    for (const time of picks) {
      const patient = pick(others);
      if (!isFree(doc.id, patient.id, today, time)) continue;
      const bm = blockModeAt(doc.seed, today, time);
      const mode = bm === "video" ? "video" : chance(0.2) ? "video" : "in_person";
      const mins = toMinutes(time);
      const status: s.AppointmentStatus =
        mins + doc.seed.slot < now.minutes ? (chance(0.88) ? "completed" : "no_show") : mins <= now.minutes ? (mode === "in_person" ? "in_consult" : "booked") : mins - now.minutes < 60 && mode === "in_person" ? "checked_in" : "booked";
      const idx = addAppt(doc, patient, today, time, mode, status, reasonFor(doc.deptSlug), int(0, 3));
      if (status === "completed" && RX_TEMPLATES[doc.deptSlug]) history.push({ idx, doc, patient, date: today, time, mode, template: pick(RX_TEMPLATES[doc.deptSlug]) });
    }
  };
  for (const doc of doctorRows) todaysFor(doc, doc.seed.code === "DOC-1001" ? 9 : int(2, 5));

  // Demo video consultation: today, a few minutes from now, so it can be joined right away.
  // 5–10 minutes from now, so the patient can join straight away (window opens 15 min before).
  const demoVideoMin = Math.min(Math.ceil((now.minutes + 5) / 5) * 5, 23 * 60 + 55);
  let demoVideoTime = fromMinutes(demoVideoMin);
  while (!isFree(drAnanya.id, demo.id, today, demoVideoTime)) demoVideoTime = fromMinutes(toMinutes(demoVideoTime) + 5);
  addAppt(drAnanya, demo, today, demoVideoTime, "video", "booked", "Follow-up: BP readings and lipid report", 1);

  // Demo patient upcoming in-person appointment
  const nextDay = nearestWorkingDay(drAnanya, addDays(today, 2), 1, "in_person");
  addAppt(drAnanya, demo, nextDay, firstFree(drAnanya, nextDay, "in_person")!, "in_person", "booked", "TMT review and cardiology follow-up", 0);
  const endoDay = nearestWorkingDay(drRajesh, addDays(today, 6), 1, "in_person");
  addAppt(drRajesh, demo, endoDay, firstFree(drRajesh, endoDay, "in_person")!, "in_person", "booked", "Quarterly diabetes review with HbA1c", 0);

  // Future bookings for everyone else (next 10 days)
  for (let fwd = 1; fwd <= FUTURE_DAYS; fwd++) {
    const date = addDays(today, fwd);
    for (const doc of doctorRows) {
      const all = slotsFor(doc.seed, date);
      if (!all.length) continue;
      const n = Math.min(all.length, Math.max(0, int(0, 5) - Math.floor(fwd / 3)));
      for (let k = 0; k < n; k++) {
        const time = pick(all);
        const patient = pick(others);
        if (!isFree(doc.id, patient.id, date, time)) continue;
        const bm = blockModeAt(doc.seed, date, time);
        const mode = bm === "video" ? "video" : bm === "in_person" ? "in_person" : chance(0.25) ? "video" : "in_person";
        addAppt(doc, patient, date, time, mode, chance(0.05) ? "cancelled" : "booked", reasonFor(doc.deptSlug), int(0, fwd));
      }
    }
  }

  const insertedAppts: { id: number; code: string }[] = [];
  for (let i = 0; i < apptInserts.length; i += 300) {
    insertedAppts.push(...(await db.insert(s.appointments).values(apptInserts.slice(i, i + 300)).returning({ id: s.appointments.id, code: s.appointments.code })));
  }
  await insertMany(s.payments, paymentInserts);

  /* ------------------------------------------ prescriptions, plans, vitals */
  const rxForDispense: { rxId: number; rxCode: string; patient: P; date: string; items: { id: number; medicineId: number | null; name: string; qty: number }[] }[] = [];
  history.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const demoWeights = [86.5, 85.8, 85.1, 84.4, 84];
  let demoVisit = 0;
  for (const h of history) {
    const t = h.template!;
    const appt = insertedAppts[h.idx];
    const isDemo = h.patient.id === demo.id;
    const created = istToISO(h.date, fromMinutes(toMinutes(h.time) + h.doc.seed.slot - 2));
    const [rx] = await db
      .insert(s.prescriptions)
      .values({
        code: code("RX", h.date),
        appointmentId: appt.id,
        patientId: h.patient.id,
        doctorId: h.doc.id,
        chiefComplaints: t.complaints,
        diagnosis: t.diagnosis,
        clinicalNotes: t.notes,
        advice: t.advice,
        labTests: JSON.stringify(t.tests),
        followUpDate: addDays(h.date, pick([7, 14, 30, 30, 90])),
        createdAt: created,
      })
      .returning();
    const items = await db
      .insert(s.prescriptionItems)
      .values(
        t.meds.map(([name, freq, days, timing]) => {
          const med = medByName.get(name);
          const perDay = freq.split("-").reduce((x, y) => x + (Number(y) || 0), 0);
          const liquid = med && ["syrup", "suspension", "ointment", "cream", "drops", "inhaler", "gel", "device", "injection"].includes(med.form);
          const qty = liquid ? 1 : freq === "SOS" ? 6 : freq === "STAT" ? 1 : perDay * days;
          return {
            prescriptionId: rx.id,
            medicineId: med?.id ?? null,
            medicineName: name,
            dosage: med?.strength ?? null,
            frequency: freq,
            timing,
            durationDays: days,
            quantity: qty,
            instructions: freq === "SOS" ? "Only when required; not more than 2 in 24 hours" : null,
          };
        }),
      )
      .returning();
    const plan = CARE_PLANS[t.diet] ?? CARE_PLANS["Balanced (general)"];
    await db.insert(s.carePlans).values({
      prescriptionId: rx.id,
      patientId: h.patient.id,
      doctorId: h.doc.id,
      dietType: t.diet,
      calories: plan.calories ?? null,
      meals: JSON.stringify(plan.meals),
      include: plan.include,
      avoid: plan.avoid,
      hydration: plan.hydration,
      exercise: plan.exercise,
      lifestyle: plan.lifestyle,
      sleep: plan.sleep,
      createdAt: created,
    });
    await db.insert(s.vitals).values({
      patientId: h.patient.id,
      appointmentId: appt.id,
      recordedBy: h.doc.userId,
      bpSystolic: isDemo ? [148, 142, 138, 132, 128][demoVisit] : int(108, 150),
      bpDiastolic: isDemo ? [94, 90, 88, 84, 82][demoVisit] : int(68, 96),
      pulse: int(64, 96),
      temperatureF: h.doc.deptSlug === "internal-medicine" ? +(98 + rand() * 3).toFixed(1) : +(97.6 + rand() * 1.2).toFixed(1),
      spo2: int(95, 99),
      respiratoryRate: int(14, 20),
      weightKg: isDemo ? demoWeights[demoVisit] : null,
      heightCm: isDemo ? 174 : null,
      bloodSugar: isDemo ? [212, 186, 168, 152, 138][demoVisit] : h.doc.deptSlug === "endocrinology" ? int(110, 240) : null,
      sugarType: isDemo || h.doc.deptSlug === "endocrinology" ? "fasting" : null,
      recordedAt: istToISO(h.date, h.time),
    });
    if (isDemo) demoVisit++;
    // Mark the appointment as completed with feedback sometimes
    if (chance(0.35) || (isDemo && demoVisit <= 3)) {
      await db.insert(s.feedback).values({
        appointmentId: appt.id,
        patientId: h.patient.id,
        doctorId: h.doc.id,
        rating: pick([5, 5, 5, 4, 4, 4, 3]),
        comment: pick([
          "Explained everything patiently and clearly.",
          "Very thorough examination, felt well cared for.",
          "Waiting time was a bit long but the consultation was excellent.",
          "The video consult saved me a trip — very convenient.",
          "Doctor listened carefully and the diet plan is easy to follow.",
          null,
        ]),
        createdAt: istToISO(h.date, "21:00"),
      });
    }
    rxForDispense.push({ rxId: rx.id, rxCode: rx.code, patient: h.patient, date: h.date, items: items.map((i) => ({ id: i.id, medicineId: i.medicineId, name: i.medicineName, qty: i.quantity })) });
  }

  /* ------------------------------------- pharmacy: counter sales & orders */
  const dispenseRows: (typeof s.dispenses.$inferInsert)[] = [];
  const dispenseItemRows: { dispenseCode: string; item: Omit<typeof s.dispenseItems.$inferInsert, "dispenseId"> }[] = [];
  const orderRows: (typeof s.pharmacyOrders.$inferInsert)[] = [];
  const orderItemRows: { orderCode: string; item: Omit<typeof s.pharmacyOrderItems.$inferInsert, "orderId"> }[] = [];

  // Leave the demo patient's most recent prescription undispensed so the cart flow can be tried.
  const demoLatest = rxForDispense.filter((r) => r.patient.id === demo.id).at(-1);
  for (const rx of rxForDispense) {
    if (rx === demoLatest) continue;
    const roll = rand();
    if (roll < 0.18) continue; // never bought here
    const ts = istToISO(rx.date, `${String(int(11, 20)).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}`);
    const pharmacist = pick(pharmacists);
    if (roll < 0.8) {
      // Counter sale against the prescription
      const dCode = code("DSP", rx.date);
      let subtotal = 0;
      for (const it of rx.items) {
        if (!it.medicineId) continue;
        const med = medRows.find((x) => x.id === it.medicineId)!;
        const qty = roll < 0.3 ? Math.ceil(it.qty / 2) : it.qty;
        const batchNo = take(med.id, qty, "dispense", dCode, pharmacist.id, ts);
        if (!batchNo) continue;
        const line = +(qty * med.unitPrice).toFixed(2);
        subtotal += line;
        dispenseItemRows.push({ dispenseCode: dCode, item: { medicineId: med.id, prescriptionItemId: it.id, name: med.name, batchNo, quantity: qty, unitPrice: med.unitPrice, lineTotal: line } });
      }
      if (subtotal === 0) continue;
      const discount = +(subtotal * 0.05).toFixed(2);
      const total = +(subtotal - discount).toFixed(2);
      const method = pick(["cash", "upi", "upi", "card"] as const);
      dispenseRows.push({ code: dCode, prescriptionId: rx.rxId, patientId: rx.patient.id, pharmacistId: pharmacist.id, subtotal: +subtotal.toFixed(2), discount, total, paymentMethod: method, createdAt: ts });
      await db.insert(s.payments).values({ code: code("PAY", rx.date), patientId: rx.patient.id, purpose: "pharmacy_counter", reference: dCode, description: `Pharmacy counter bill against ${rx.rxCode}`, amount: total, method, createdAt: ts });
    } else {
      // Online order
      const oCode = code("ORD", rx.date);
      let subtotal = 0;
      for (const it of rx.items) {
        if (!it.medicineId) continue;
        const med = medRows.find((x) => x.id === it.medicineId)!;
        const ok = take(med.id, it.qty, "order", oCode, pharmacist.id, ts);
        if (!ok) continue;
        const line = +(it.qty * med.unitPrice).toFixed(2);
        subtotal += line;
        orderItemRows.push({ orderCode: oCode, item: { medicineId: med.id, prescriptionItemId: it.id, name: med.name, quantity: it.qty, unitPrice: med.unitPrice, lineTotal: line } });
      }
      if (subtotal === 0) continue;
      const delivery = chance(0.5);
      const deliveryFee = delivery && subtotal < 999 ? 40 : 0;
      const discount = +(subtotal * 0.05).toFixed(2);
      const total = +(subtotal - discount + deliveryFee).toFixed(2);
      orderRows.push({
        code: oCode,
        patientId: rx.patient.id,
        status: "completed",
        fulfilment: delivery ? "delivery" : "pickup",
        deliveryAddress: delivery ? `${int(1, 200)}, ${pick(AREAS)}, Bengaluru` : null,
        subtotal: +subtotal.toFixed(2),
        discount,
        deliveryFee,
        total,
        paymentMethod: pick(["upi", "card"]),
        handledBy: pharmacist.id,
        createdAt: ts,
        updatedAt: ts,
      });
      await db.insert(s.payments).values({ code: code("PAY", rx.date), patientId: rx.patient.id, purpose: "pharmacy_order", reference: oCode, description: "Online pharmacy order", amount: total, method: "upi", createdAt: ts });
    }
  }

  // OTC walk-in sales (no prescription)
  const otc = medRows.filter((x) => !x.rxRequired && (stockOf.get(x.id) ?? 0) > 50);
  for (let back = OTC_DAYS; back >= 0; back--) {
    const date = addDays(today, -back);
    for (let k = 0; k < int(2, 6); k++) {
      const hhmm = `${String(int(8, 21)).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}`;
      if (back === 0 && toMinutes(hhmm) > now.minutes) continue;
      const ts = istToISO(date, hhmm);
      const dCode = code("DSP", date);
      const pharmacist = pick(pharmacists);
      let subtotal = 0;
      const lines = int(1, 3);
      for (let l = 0; l < lines; l++) {
        const med = pick(otc);
        const qty = med.unitPrice > 50 ? 1 : int(6, 20);
        const batchNo = take(med.id, qty, "dispense", dCode, pharmacist.id, ts);
        if (!batchNo) continue;
        const line = +(qty * med.unitPrice).toFixed(2);
        subtotal += line;
        dispenseItemRows.push({ dispenseCode: dCode, item: { medicineId: med.id, name: med.name, batchNo, quantity: qty, unitPrice: med.unitPrice, lineTotal: line } });
      }
      if (subtotal === 0) continue;
      const method = pick(["cash", "cash", "upi", "card"] as const);
      dispenseRows.push({ code: dCode, customerName: `${pick([...FIRST_NAMES_F, ...FIRST_NAMES_M])} ${pick(LAST_NAMES)}`, customerPhone: `+91 9${int(100000000, 999999999)}`, pharmacistId: pharmacist.id, subtotal: +subtotal.toFixed(2), discount: 0, total: +subtotal.toFixed(2), paymentMethod: method, createdAt: ts, notes: "Walk-in, OTC" });
      await db.insert(s.payments).values({ code: code("PAY", date), patientId: null, purpose: "pharmacy_counter", reference: dCode, description: "Pharmacy counter sale (OTC)", amount: +subtotal.toFixed(2), method, createdAt: ts });
    }
  }

  // A few live online orders in different states for the pharmacy queue
  const liveOrderPatients = others.slice(0, 4);
  const liveStatuses: s.OrderStatus[] = ["placed", "placed", "processing", "ready"];
  for (const [i, p] of liveOrderPatients.entries()) {
    const oCode = code("ORD", today);
    const ts = new Date(Date.now() - (i + 1) * 47 * 60000).toISOString();
    const meds = [pick(medRows.filter((x) => (stockOf.get(x.id) ?? 0) > 200)), pick(otc)];
    let subtotal = 0;
    for (const med of meds) {
      const qty = med.unitPrice > 50 ? 1 : 10;
      if (!take(med.id, qty, "order", oCode, pharmacists[0].id, ts)) continue;
      const line = +(qty * med.unitPrice).toFixed(2);
      subtotal += line;
      orderItemRows.push({ orderCode: oCode, item: { medicineId: med.id, name: med.name, quantity: qty, unitPrice: med.unitPrice, lineTotal: line } });
    }
    const delivery = i % 2 === 0;
    const deliveryFee = delivery && subtotal < 999 ? 40 : 0;
    const discount = +(subtotal * 0.05).toFixed(2);
    const total = +(subtotal - discount + deliveryFee).toFixed(2);
    orderRows.push({ code: oCode, patientId: p.id, status: liveStatuses[i], fulfilment: delivery ? "delivery" : "pickup", deliveryAddress: delivery ? `${int(1, 200)}, ${pick(AREAS)}, Bengaluru` : null, subtotal: +subtotal.toFixed(2), discount, deliveryFee, total, paymentMethod: "upi", createdAt: ts, updatedAt: ts });
    await db.insert(s.payments).values({ code: code("PAY", today), patientId: p.id, purpose: "pharmacy_order", reference: oCode, description: "Online pharmacy order", amount: total, method: "upi", createdAt: ts });
  }

  const insertedDispenses: { id: number; code: string }[] = [];
  for (let i = 0; i < dispenseRows.length; i += 300) {
    insertedDispenses.push(...(await db.insert(s.dispenses).values(dispenseRows.slice(i, i + 300)).returning({ id: s.dispenses.id, code: s.dispenses.code })));
  }
  const dispIdByCode = new Map(insertedDispenses.map((d) => [d.code, d.id]));
  await insertMany(s.dispenseItems, dispenseItemRows.map((r) => ({ ...r.item, dispenseId: dispIdByCode.get(r.dispenseCode)! })));
  const insertedOrders: { id: number; code: string }[] = [];
  for (let i = 0; i < orderRows.length; i += 300) {
    insertedOrders.push(...(await db.insert(s.pharmacyOrders).values(orderRows.slice(i, i + 300)).returning({ id: s.pharmacyOrders.id, code: s.pharmacyOrders.code })));
  }
  const orderIdByCode = new Map(insertedOrders.map((o) => [o.code, o.id]));
  await insertMany(s.pharmacyOrderItems, orderItemRows.map((r) => ({ ...r.item, orderId: orderIdByCode.get(r.orderCode)! })));

  // Persist batch quantities, stock and the ledger
  for (const b of batches) await db.update(s.medicineBatches).set({ quantity: b.quantity }).where(sql`id = ${b.id}`);
  for (const [id, qty] of stockOf) await db.update(s.medicines).set({ stock: qty }).where(sql`id = ${id}`);
  movements.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  // Recompute running balances per medicine in chronological order
  const running = new Map<number, number>();
  for (const mv of movements) {
    const bal = (running.get(mv.medicineId) ?? 0) + mv.quantity;
    running.set(mv.medicineId, bal);
    mv.balanceAfter = bal;
  }
  await insertMany(s.stockMovements, movements);

  /* ------------------------------------------------------- demo cart & misc */
  if (demoLatest) {
    const first = demoLatest.items.find((i) => i.medicineId);
    if (first) await db.insert(s.cartItems).values({ patientId: demo.id, medicineId: first.medicineId!, prescriptionItemId: first.id, quantity: first.qty });
  }

  // Health package bookings
  const pkgs = await db.select().from(s.healthPackages);
  for (let i = 0; i < 9; i++) {
    const pkg = pick(pkgs);
    const p = pick(others);
    const date = addDays(today, int(-12, 9));
    const c = code("HCP", date);
    const ts = istToISO(addDays(date, -int(1, 5)) < today ? addDays(date, -int(1, 5)) : today, "10:00");
    await db.insert(s.packageBookings).values({ code: c, packageId: pkg.id, patientId: p.id, date, status: date < today ? "completed" : "booked", amount: pkg.price, createdAt: ts });
    await db.insert(s.payments).values({ code: code("PAY", date), patientId: p.id, purpose: "health_package", reference: c, description: pkg.name, amount: pkg.price, method: "card", createdAt: ts });
  }

  // In-patient admissions (occupancy)
  for (const w of wardRows) {
    const occupied = Math.round(w.totalBeds * (0.45 + rand() * 0.4));
    const beds = [...Array(w.totalBeds).keys()].sort(() => rand() - 0.5).slice(0, occupied);
    for (const b of beds) {
      const p = pick(others);
      const doc = pick(doctorRows);
      await db.insert(s.admissions).values({
        code: code("IPD", today),
        patientId: p.id,
        doctorId: doc.id,
        wardId: w.id,
        bedNo: `${w.name.split(" ")[0].slice(0, 3).toUpperCase()}-${String(b + 1).padStart(2, "0")}`,
        reason: pick(["Observation", "Post-operative care", "Pneumonia", "Uncontrolled diabetes", "Chest pain evaluation", "Fracture management", "Delivery", "Dengue fever"]),
        admittedAt: new Date(Date.now() - int(2, 200) * 3600000).toISOString(),
      });
    }
  }

  // Enquiries
  await insertMany(s.enquiries, [
    { name: "Vandana Rao", email: "vandana.rao@example.com", phone: "+91 98861 22110", topic: "Health check-up", message: "Do you offer a home sample collection for the Comprehensive Health Check? My parents are elderly.", status: "new", createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
    { name: "Imtiaz Ahmed", email: "imtiaz.a@example.com", phone: "+91 99000 45123", topic: "Insurance & billing", message: "Is cashless hospitalisation available with my employer group policy? Which documents should I bring?", status: "in_progress", createdAt: new Date(Date.now() - 26 * 3600000).toISOString() },
    { name: "Deepa Krishnan", email: "deepa.k@example.com", phone: null, topic: "Feedback", message: "Wanted to thank the nursing staff on the 4th floor for the care my father received last week.", status: "resolved", createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { name: "Rohit Jain", email: "rohit.jain@example.com", phone: "+91 97411 55667", topic: "International patients", message: "I'm travelling from Dubai for a knee replacement consultation with Dr. Desai. Can you help with a visa invitation letter?", status: "new", createdAt: new Date(Date.now() - 50 * 60000).toISOString() },
  ]);

  // Notifications for demo users
  const demoDocUser = drAnanya.userId;
  await insertMany(s.notifications, [
    { userId: demo.userId, title: "Video consultation today", body: `Your video consultation with Dr. Ananya Rao is today. You can join 15 minutes before the slot.`, href: "/patient/appointments", read: false },
    { userId: demo.userId, title: "Diet plan updated", body: "Dr. Rajesh Agarwal shared a new diabetic diet and lifestyle plan.", href: "/patient/care-plan", read: false },
    { userId: demo.userId, title: "Medicines waiting in your cart", body: "Medicines from your latest prescription are ready to order from the hospital pharmacy.", href: "/patient/cart", read: true },
    { userId: demoDocUser, title: "New video consultation booked", body: "Rahul Verma booked a video consultation for today.", href: "/doctor", read: false },
  ]);

  await insertMany(s.auditLogs, [
    { userId: admin.id, actorName: admin.name, role: "admin", action: "seed", entity: "system", detail: "Demo data loaded", createdAt: new Date().toISOString() },
  ]);
}

