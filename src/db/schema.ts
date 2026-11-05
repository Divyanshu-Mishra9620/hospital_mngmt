import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/* --------------------------------------------------------------------------
 * Conventions
 *  - Integer autoincrement primary keys; human-readable codes (UHID, DOC-…,
 *    RX-…) live in separate unique `code` columns and are what users see.
 *  - Money is stored in whole rupees (integer).
 *  - Dates are ISO strings: `date` = "YYYY-MM-DD", `time` = "HH:MM",
 *    timestamps = full ISO strings (UTC).
 * ------------------------------------------------------------------------ */

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const ROLES = ["patient", "doctor", "pharmacist", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role", { enum: ROLES }).notNull(),
  /** Login ID shown to the user: UHID for patients, DOC-/PHA-/ADM- for staff. */
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull().default(now),
});

export const GENDERS = ["female", "male", "other"] as const;
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const patients = sqliteTable("patients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique().references(() => users.id),
  uhid: text("uhid").notNull().unique(),
  dob: text("dob"),
  gender: text("gender", { enum: GENDERS }),
  bloodGroup: text("blood_group"),
  address: text("address"),
  city: text("city"),
  pincode: text("pincode"),
  emergencyName: text("emergency_name"),
  emergencyRelation: text("emergency_relation"),
  emergencyPhone: text("emergency_phone"),
  allergies: text("allergies"),
  chronicConditions: text("chronic_conditions"),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNo: text("insurance_policy_no"),
  createdAt: text("created_at").notNull().default(now),
});

export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** One-line summary for cards. */
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  /** Comma-separated list of conditions / procedures treated. */
  services: text("services").notNull().default(""),
  /** lucide-react icon name, resolved in components/icons.tsx */
  icon: text("icon").notNull().default("Stethoscope"),
  location: text("location"),
  extension: text("extension"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const doctors = sqliteTable("doctors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique().references(() => users.id),
  code: text("code").notNull().unique(),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  designation: text("designation").notNull(),
  qualifications: text("qualifications").notNull(),
  experienceYears: integer("experience_years").notNull().default(0),
  languages: text("languages").notNull().default("English, Hindi"),
  bio: text("bio").notNull().default(""),
  expertise: text("expertise").notNull().default(""),
  room: text("room"),
  registrationNo: text("registration_no"),
  inPersonFee: integer("in_person_fee").notNull().default(500),
  videoFee: integer("video_fee").notNull().default(350),
  slotMinutes: integer("slot_minutes").notNull().default(15),
  videoEnabled: integer("video_enabled", { mode: "boolean" }).notNull().default(true),
  /** Tailwind-independent accent used for avatar backgrounds. */
  avatarColor: text("avatar_color").notNull().default("#0f6e7c"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/** Weekly OPD timings. A doctor can have several blocks per weekday. */
export const doctorSchedules = sqliteTable(
  "doctor_schedules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    doctorId: integer("doctor_id").notNull().references(() => doctors.id),
    /** 0 = Sunday … 6 = Saturday */
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    mode: text("mode", { enum: ["both", "in_person", "video"] }).notNull().default("both"),
  },
  (t) => [index("sched_doctor_idx").on(t.doctorId, t.weekday)],
);

export const doctorLeaves = sqliteTable(
  "doctor_leaves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    doctorId: integer("doctor_id").notNull().references(() => doctors.id),
    date: text("date").notNull(),
    reason: text("reason"),
  },
  (t) => [uniqueIndex("leave_doctor_date_uq").on(t.doctorId, t.date)],
);

export const APPOINTMENT_MODES = ["in_person", "video"] as const;
export type AppointmentMode = (typeof APPOINTMENT_MODES)[number];
export const APPOINTMENT_STATUSES = [
  "booked",
  "checked_in",
  "in_consult",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const appointments = sqliteTable(
  "appointments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    patientId: integer("patient_id").notNull().references(() => patients.id),
    doctorId: integer("doctor_id").notNull().references(() => doctors.id),
    date: text("date").notNull(),
    time: text("time").notNull(),
    mode: text("mode", { enum: APPOINTMENT_MODES }).notNull(),
    status: text("status", { enum: APPOINTMENT_STATUSES }).notNull().default("booked"),
    reason: text("reason"),
    fee: integer("fee").notNull(),
    paymentStatus: text("payment_status", { enum: ["paid", "pending", "refunded"] })
      .notNull()
      .default("paid"),
    /** Daily OPD token, per doctor per day. */
    tokenNo: integer("token_no"),
    cancelReason: text("cancel_reason"),
    cancelledBy: text("cancelled_by"),
    checkedInAt: text("checked_in_at"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    // A doctor's slot can only be held by one live appointment. Cancelled
    // appointments release the slot. Different doctors never collide.
    uniqueIndex("appt_doctor_slot_uq")
      .on(t.doctorId, t.date, t.time)
      .where(sql`status <> 'cancelled'`),
    // A patient cannot be in two consultations at the same time.
    uniqueIndex("appt_patient_slot_uq")
      .on(t.patientId, t.date, t.time)
      .where(sql`status <> 'cancelled'`),
    index("appt_doctor_date_idx").on(t.doctorId, t.date),
    index("appt_patient_idx").on(t.patientId),
  ],
);

export const vitals = sqliteTable(
  "vitals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    patientId: integer("patient_id").notNull().references(() => patients.id),
    appointmentId: integer("appointment_id").references(() => appointments.id),
    recordedBy: integer("recorded_by").references(() => users.id),
    bpSystolic: integer("bp_systolic"),
    bpDiastolic: integer("bp_diastolic"),
    pulse: integer("pulse"),
    temperatureF: real("temperature_f"),
    spo2: integer("spo2"),
    respiratoryRate: integer("respiratory_rate"),
    weightKg: real("weight_kg"),
    heightCm: real("height_cm"),
    bloodSugar: integer("blood_sugar"),
    sugarType: text("sugar_type", { enum: ["fasting", "random", "pp"] }),
    recordedAt: text("recorded_at").notNull().default(now),
  },
  (t) => [index("vitals_patient_idx").on(t.patientId)],
);

export const prescriptions = sqliteTable(
  "prescriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    appointmentId: integer("appointment_id").references(() => appointments.id),
    patientId: integer("patient_id").notNull().references(() => patients.id),
    doctorId: integer("doctor_id").notNull().references(() => doctors.id),
    chiefComplaints: text("chief_complaints"),
    diagnosis: text("diagnosis").notNull(),
    clinicalNotes: text("clinical_notes"),
    advice: text("advice"),
    /** JSON string[] of investigations advised. */
    labTests: text("lab_tests").notNull().default("[]"),
    followUpDate: text("follow_up_date"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("rx_patient_idx").on(t.patientId), index("rx_doctor_idx").on(t.doctorId)],
);

export const prescriptionItems = sqliteTable(
  "prescription_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    prescriptionId: integer("prescription_id").notNull().references(() => prescriptions.id),
    /** Null when the doctor prescribed something the hospital store doesn't stock. */
    medicineId: integer("medicine_id").references(() => medicines.id),
    medicineName: text("medicine_name").notNull(),
    dosage: text("dosage"),
    /** Morning-Afternoon-Night pattern, e.g. "1-0-1". */
    frequency: text("frequency").notNull(),
    timing: text("timing"),
    durationDays: integer("duration_days").notNull(),
    /** Units to dispense (tablets, bottles, tubes…). */
    quantity: integer("quantity").notNull(),
    instructions: text("instructions"),
  },
  (t) => [index("rx_items_rx_idx").on(t.prescriptionId)],
);

/** Diet + lifestyle recommendations attached to a prescription. */
export const carePlans = sqliteTable("care_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prescriptionId: integer("prescription_id").notNull().unique().references(() => prescriptions.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  dietType: text("diet_type").notNull(),
  calories: integer("calories"),
  /** JSON: { earlyMorning, breakfast, midMorning, lunch, evening, dinner, bedtime } */
  meals: text("meals").notNull().default("{}"),
  include: text("include"),
  avoid: text("avoid"),
  hydration: text("hydration"),
  exercise: text("exercise"),
  lifestyle: text("lifestyle"),
  sleep: text("sleep"),
  createdAt: text("created_at").notNull().default(now),
});

export const MEDICINE_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "suspension",
  "injection",
  "ointment",
  "cream",
  "drops",
  "inhaler",
  "sachet",
  "gel",
  "device",
] as const;

export const medicines = sqliteTable("medicines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  genericName: text("generic_name").notNull(),
  manufacturer: text("manufacturer").notNull(),
  category: text("category").notNull(),
  form: text("form", { enum: MEDICINE_FORMS }).notNull(),
  strength: text("strength"),
  /** Human description of a sellable unit, e.g. "tablet", "100 ml bottle". */
  unitLabel: text("unit_label").notNull(),
  /** Selling price (MRP) per unit in rupees. Integer paise avoided for clarity; fractional allowed. */
  unitPrice: real("unit_price").notNull(),
  rxRequired: integer("rx_required", { mode: "boolean" }).notNull().default(true),
  /** Cached sum of batch quantities, kept in sync by lib/pharmacy/stock.ts */
  stock: integer("stock").notNull().default(0),
  reorderLevel: integer("reorder_level").notNull().default(50),
  rack: text("rack"),
  hsn: text("hsn"),
  gstPercent: integer("gst_percent").notNull().default(12),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(now),
});

export const medicineBatches = sqliteTable(
  "medicine_batches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    medicineId: integer("medicine_id").notNull().references(() => medicines.id),
    batchNo: text("batch_no").notNull(),
    expiryDate: text("expiry_date").notNull(),
    quantity: integer("quantity").notNull(),
    receivedQty: integer("received_qty").notNull(),
    costPrice: real("cost_price").notNull(),
    supplier: text("supplier"),
    invoiceNo: text("invoice_no"),
    receivedAt: text("received_at").notNull().default(now),
  },
  (t) => [index("batch_medicine_idx").on(t.medicineId, t.expiryDate)],
);

export const STOCK_MOVEMENT_TYPES = ["purchase", "dispense", "order", "adjustment", "expired", "return"] as const;

/** Immutable ledger of every change to stock. Quantity is signed. */
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    medicineId: integer("medicine_id").notNull().references(() => medicines.id),
    batchId: integer("batch_id").references(() => medicineBatches.id),
    type: text("type", { enum: STOCK_MOVEMENT_TYPES }).notNull(),
    quantity: integer("quantity").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reference: text("reference"),
    note: text("note"),
    userId: integer("user_id").references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("movement_medicine_idx").on(t.medicineId, t.createdAt)],
);

/** Patient's online cart for the hospital pharmacy. */
export const cartItems = sqliteTable(
  "cart_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    patientId: integer("patient_id").notNull().references(() => patients.id),
    medicineId: integer("medicine_id").notNull().references(() => medicines.id),
    prescriptionItemId: integer("prescription_item_id").references(() => prescriptionItems.id),
    quantity: integer("quantity").notNull(),
    addedAt: text("added_at").notNull().default(now),
  },
  (t) => [uniqueIndex("cart_patient_medicine_uq").on(t.patientId, t.medicineId)],
);

export const ORDER_STATUSES = ["placed", "processing", "ready", "out_for_delivery", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const pharmacyOrders = sqliteTable(
  "pharmacy_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    patientId: integer("patient_id").notNull().references(() => patients.id),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("placed"),
    fulfilment: text("fulfilment", { enum: ["pickup", "delivery"] }).notNull(),
    deliveryAddress: text("delivery_address"),
    subtotal: real("subtotal").notNull(),
    discount: real("discount").notNull().default(0),
    deliveryFee: real("delivery_fee").notNull().default(0),
    total: real("total").notNull(),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status", { enum: ["paid", "pending", "refunded"] }).notNull().default("paid"),
    handledBy: integer("handled_by").references(() => users.id),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("order_patient_idx").on(t.patientId), index("order_status_idx").on(t.status)],
);

export const pharmacyOrderItems = sqliteTable("pharmacy_order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => pharmacyOrders.id),
  medicineId: integer("medicine_id").notNull().references(() => medicines.id),
  prescriptionItemId: integer("prescription_item_id").references(() => prescriptionItems.id),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  lineTotal: real("line_total").notNull(),
});

/** Counter sale recorded by the pharmacist (walk-in with a paper/printed Rx, or OTC). */
export const dispenses = sqliteTable(
  "dispenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    prescriptionId: integer("prescription_id").references(() => prescriptions.id),
    patientId: integer("patient_id").references(() => patients.id),
    /** For walk-ins without a hospital record. */
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    pharmacistId: integer("pharmacist_id").notNull().references(() => users.id),
    subtotal: real("subtotal").notNull(),
    discount: real("discount").notNull().default(0),
    total: real("total").notNull(),
    paymentMethod: text("payment_method", { enum: ["cash", "upi", "card", "insurance"] }).notNull(),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("dispense_rx_idx").on(t.prescriptionId), index("dispense_created_idx").on(t.createdAt)],
);

export const dispenseItems = sqliteTable("dispense_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dispenseId: integer("dispense_id").notNull().references(() => dispenses.id),
  medicineId: integer("medicine_id").notNull().references(() => medicines.id),
  prescriptionItemId: integer("prescription_item_id").references(() => prescriptionItems.id),
  name: text("name").notNull(),
  batchNo: text("batch_no"),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  lineTotal: real("line_total").notNull(),
});

export const PAYMENT_PURPOSES = ["consultation", "pharmacy_order", "pharmacy_counter", "health_package"] as const;

export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    patientId: integer("patient_id").references(() => patients.id),
    purpose: text("purpose", { enum: PAYMENT_PURPOSES }).notNull(),
    /** Code of the appointment / order / dispense / package booking this pays for. */
    reference: text("reference").notNull(),
    description: text("description").notNull(),
    amount: real("amount").notNull(),
    method: text("method").notNull(),
    status: text("status", { enum: ["success", "refunded"] }).notNull().default("success"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("payment_patient_idx").on(t.patientId), index("payment_created_idx").on(t.createdAt)],
);

export const feedback = sqliteTable("feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appointmentId: integer("appointment_id").notNull().unique().references(() => appointments.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").notNull().default(now),
});

export const healthPackages = sqliteTable("health_packages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  audience: text("audience").notNull(),
  price: integer("price").notNull(),
  mrp: integer("mrp").notNull(),
  /** JSON string[] */
  tests: text("tests").notNull(),
  highlight: integer("highlight", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const packageBookings = sqliteTable("package_bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  packageId: integer("package_id").notNull().references(() => healthPackages.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  date: text("date").notNull(),
  status: text("status", { enum: ["booked", "completed", "cancelled"] }).notNull().default("booked"),
  amount: integer("amount").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

/** In-patient wards & beds (admin). */
export const wards = sqliteTable("wards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  floor: text("floor").notNull(),
  totalBeds: integer("total_beds").notNull(),
  dailyRate: integer("daily_rate").notNull(),
});

export const admissions = sqliteTable("admissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  wardId: integer("ward_id").notNull().references(() => wards.id),
  bedNo: text("bed_no").notNull(),
  reason: text("reason").notNull(),
  admittedAt: text("admitted_at").notNull().default(now),
  dischargedAt: text("discharged_at"),
  dischargeSummary: text("discharge_summary"),
});

export const enquiries = sqliteTable("enquiries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["new", "in_progress", "resolved"] }).notNull().default("new"),
  createdAt: text("created_at").notNull().default(now),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.read)],
);

/** WebRTC signalling for 1:1 video consultations (polled over HTTP). */
export const callSignals = sqliteTable(
  "call_signals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appointmentId: integer("appointment_id").notNull().references(() => appointments.id),
    sender: text("sender", { enum: ["doctor", "patient"] }).notNull(),
    type: text("type", { enum: ["join", "offer", "answer", "candidate", "leave", "chat"] }).notNull(),
    payload: text("payload").notNull().default(""),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("signal_appt_idx").on(t.appointmentId, t.id)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id),
    actorName: text("actor_name"),
    role: text("role"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityRef: text("entity_ref"),
    detail: text("detail"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
