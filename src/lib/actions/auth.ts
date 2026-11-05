"use server";

import { redirect } from "next/navigation";
import { eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { patients, users } from "@/db/schema";
import { fail, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { audit, notify } from "@/lib/audit";
import { ROLE_HOME } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSession } from "@/lib/auth/session";
import { isUniqueViolation } from "@/lib/codes";
import { todayISO } from "@/lib/time";

const AREA_BY_ROLE: Record<string, string[]> = {
  patient: ["/patient", "/consult"],
  doctor: ["/doctor", "/consult"],
  pharmacist: ["/pharmacy"],
  admin: ["/admin", "/pharmacy"],
};

function safeNext(next: string, role: string) {
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  const portal = ["/patient", "/doctor", "/pharmacy", "/admin", "/consult"].find((p) => next === p || next.startsWith(p + "/"));
  if (portal && !AREA_BY_ROLE[role]?.includes(portal)) return null;
  if (next.startsWith("/login") || next.startsWith("/register") || next.startsWith("/logout")) return null;
  return next;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!identifier || !password) return fail("Enter your ID or email and your password.");

  const digits = identifier.replace(/\D/g, "");
  const [user] = await db
    .select()
    .from(users)
    .where(
      or(
        sql`lower(${users.email}) = ${identifier.toLowerCase()}`,
        sql`upper(${users.code}) = ${identifier.toUpperCase()}`,
        digits.length >= 10 ? sql`replace(replace(${users.phone}, ' ', ''), '+', '') like ${"%" + digits.slice(-10)}` : sql`0`,
      ),
    )
    .limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("The ID/email or password you entered is incorrect.");
  }
  if (!user.active) return fail("This account has been deactivated. Please contact the hospital help desk.");

  await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id));
  await createSession({ uid: user.id, role: user.role, name: user.name, code: user.code });
  await audit({ id: user.id, name: user.name, role: user.role }, "login", "user", user.code);

  redirect(safeNext(next, user.role) ?? ROLE_HOME[user.role]);
}

export async function logoutAction() {
  const session = await getSession();
  if (session) await audit({ id: session.uid, name: session.name, role: session.role }, "logout", "user", session.code);
  await destroySession();
  redirect("/login?signedout=1");
}

const registerSchema = z
  .object({
    name: z.string().trim().min(3, "Enter your full name").max(80),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
    phone: z
      .string()
      .trim()
      .regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a valid 10-digit Indian mobile number"),
    dob: z.iso.date("Enter your date of birth"),
    gender: z.enum(["female", "male", "other"], "Select a gender"),
    password: z.string().min(8, "Use at least 8 characters").regex(/[0-9]/, "Include at least one number").regex(/[A-Za-z]/, "Include at least one letter"),
    confirm: z.string(),
    consent: z.literal("on", "Please accept the terms to continue"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.dob <= todayISO() && v.dob >= "1900-01-01", { path: ["dob"], message: "Enter a valid date of birth" });

function normalisePhone(p: string) {
  const d = p.replace(/\D/g, "").slice(-10);
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData);
  const values = { name: raw.name, email: raw.email, phone: raw.phone, dob: raw.dob, gender: raw.gender };
  const withValues = (s: ActionState): ActionState => ({ ...s, data: { values } });
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return withValues(fail("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues)));
  const v = parsed.data;

  const [exists] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${v.email}`).limit(1);
  if (exists) return withValues(fail("An account with this email already exists. Try signing in instead.", { email: "Already registered" }));

  const passwordHash = await hashPassword(v.password);
  let created: { userId: number; uhid: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const [row] = await db
      .select({ max: sql<number>`coalesce(max(cast(substr(${patients.uhid}, 5) as integer)), 100100)` })
      .from(patients);
    const uhid = `MDR-${Number(row.max) + 1 + attempt}`;
    try {
      created = await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(users)
          .values({ role: "patient", code: uhid, name: v.name, email: v.email, phone: normalisePhone(v.phone), passwordHash })
          .returning();
        await tx.insert(patients).values({ userId: u.id, uhid, dob: v.dob, gender: v.gender });
        return { userId: u.id, uhid };
      });
    } catch (err) {
      if (isUniqueViolation(err, "email")) return fail("An account with this email already exists.", { email: "Already registered" });
      if (!isUniqueViolation(err)) throw err;
    }
  }
  if (!created) return fail("We couldn't create your account right now. Please try again.");

  await createSession({ uid: created.userId, role: "patient", name: v.name, code: created.uhid });
  await notify(
    created.userId,
    "Welcome to Medora Hospital",
    `Your Unique Health ID is ${created.uhid}. Use it at the registration desk, pharmacy and for signing in.`,
    "/patient/profile",
  );
  await audit({ id: created.userId, name: v.name, role: "patient" }, "register", "patient", created.uhid);
  redirect("/patient?welcome=1");
}
