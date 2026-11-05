import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/db/schema";

/** Edge-safe JWT helpers (used by proxy.ts and the server session module). */
export const SESSION_COOKIE = "medora_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type SessionPayload = {
  uid: number;
  role: Role;
  name: string;
  code: string;
};

function secret() {
  const s = process.env.AUTH_SECRET ?? "dev-only-medora-secret-change-me-in-production-0123456789";
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "number" || typeof payload.role !== "string") return null;
    return { uid: payload.uid, role: payload.role as Role, name: String(payload.name), code: String(payload.code) };
  } catch {
    return null;
  }
}

export const ROLE_HOME: Record<Role, string> = {
  patient: "/patient",
  doctor: "/doctor",
  pharmacist: "/pharmacy",
  admin: "/admin",
};

export const ROLE_LABEL: Record<Role, string> = {
  patient: "Patient",
  doctor: "Doctor",
  pharmacist: "Pharmacy",
  admin: "Administrator",
};
