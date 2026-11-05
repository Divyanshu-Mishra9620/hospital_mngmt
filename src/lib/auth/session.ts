/**
 * Sessions — LOCAL STORAGE MODE.
 *
 * The signed-in user is kept in sessionStorage (per tab, so a patient and a
 * doctor can be signed in on two tabs of the same browser) with the most
 * recent sign-in mirrored to localStorage so new tabs start signed in.
 * The server version (HTTP-only JWT cookies) is in archive/database-version.zip.
 */
import { redirect } from "@/lib/client/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { doctors, patients, users, type Role } from "@/db/schema";
import { ready } from "@/lib/client/store";
import { ROLE_HOME } from "./roles";

export type SessionPayload = { uid: number; role: Role; name: string; code: string };

const KEY = "medora.session";

function readKey(store: Storage | undefined) {
  try {
    const raw = store?.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionPayload) : null;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const raw = JSON.stringify(payload);
  sessionStorage.setItem(KEY, raw);
  localStorage.setItem(KEY, raw);
}

export async function destroySession() {
  const mine = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (localStorage.getItem(KEY) === mine) localStorage.removeItem(KEY);
}

/** Current tab's session (falls back to, and pins, the browser's last sign-in). */
export async function getSession(): Promise<SessionPayload | null> {
  if (typeof window === "undefined") return null;
  const own = readKey(sessionStorage);
  if (own) return own;
  const last = readKey(localStorage);
  if (last) sessionStorage.setItem(KEY, JSON.stringify(last));
  return last;
}

function loginRedirect(error?: string): never {
  const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
  const qs = new URLSearchParams();
  if (next && !next.startsWith("/login")) qs.set("next", next);
  if (error) qs.set("error", error);
  const query = qs.toString();
  redirect(`/login${query ? `?${query}` : ""}`, "replace");
}

/**
 * Loads the signed-in user and checks they are active and have one of the
 * allowed roles. Redirects to /login (or the user's own portal) otherwise.
 */
export async function requireUser(...allowed: Role[]) {
  await ready();
  const session = await getSession();
  if (!session) loginRedirect();
  const [user] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!user || !user.active || user.code !== session.code) {
    await destroySession();
    loginRedirect("inactive");
  }
  if (allowed.length && !allowed.includes(user.role)) redirect(ROLE_HOME[user.role], "replace");
  return user;
}

export async function requirePatient() {
  const user = await requireUser("patient");
  const [patient] = await db.select().from(patients).where(eq(patients.userId, user.id)).limit(1);
  if (!patient) loginRedirect("profile");
  return { user, patient };
}

export async function requireDoctor() {
  const user = await requireUser("doctor");
  const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, user.id)).limit(1);
  if (!doctor) loginRedirect("profile");
  return { user, doctor };
}

export async function requirePharmacist() {
  return requireUser("pharmacist", "admin");
}

export async function requireAdmin() {
  return requireUser("admin");
}
