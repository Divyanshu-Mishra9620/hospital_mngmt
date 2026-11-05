import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { doctors, patients, users, type Role } from "@/db/schema";
import { ROLE_HOME, SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession, type SessionPayload } from "./jwt";

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Verified session from the cookie, or null. Memoised per request. */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
});

/**
 * Loads the signed-in user and checks they are active and have one of the
 * allowed roles. Redirects to /login otherwise. Use in layouts, pages and
 * server actions — never rely on proxy.ts alone.
 */
export const requireUser = cache(async (...allowed: Role[]) => {
  const session = await getSession();
  if (!session) redirect("/login");
  const [user] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!user || !user.active) redirect("/logout?error=inactive");
  if (allowed.length && !allowed.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
});

export const requirePatient = cache(async () => {
  const user = await requireUser("patient");
  const [patient] = await db.select().from(patients).where(eq(patients.userId, user.id)).limit(1);
  if (!patient) redirect("/logout?error=profile");
  return { user, patient };
});

export const requireDoctor = cache(async () => {
  const user = await requireUser("doctor");
  const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, user.id)).limit(1);
  if (!doctor) redirect("/logout?error=profile");
  return { user, doctor };
});

export const requirePharmacist = cache(async () => requireUser("pharmacist", "admin"));
export const requireAdmin = cache(async () => requireUser("admin"));
