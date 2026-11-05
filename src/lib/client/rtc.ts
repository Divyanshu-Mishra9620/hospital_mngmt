/**
 * Video-call signalling — LOCAL STORAGE MODE.
 *
 * Replaces the old /api/rtc/[code] route. Signals are appended to a log in
 * localStorage that both participants poll, so a doctor and a patient signed
 * in on two tabs of the same browser can call each other. `rtcFetch` mimics the
 * route's request/response shape so the video room code is unchanged.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, doctors, patients } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { markDirty, ready } from "./store";

const TYPES = ["join", "offer", "answer", "candidate", "leave", "chat"] as const;
type SignalType = (typeof TYPES)[number];
type Role = "doctor" | "patient";
export type StoredSignal = { id: number; sender: Role; type: SignalType; payload: string; createdAt: string };
type Log = { seq: number; signals: StoredSignal[] };

const keyFor = (code: string) => `medora.rtc.${code}`;

function readLog(code: string): Log {
  try {
    const raw = localStorage.getItem(keyFor(code));
    if (raw) return JSON.parse(raw) as Log;
  } catch {}
  return { seq: 0, signals: [] };
}

function writeLog(code: string, log: Log) {
  // Keep the log small: all chat + the latest negotiation messages.
  const chat = log.signals.filter((s) => s.type === "chat").slice(-200);
  const rest = log.signals.filter((s) => s.type !== "chat").slice(-300);
  log.signals = [...chat, ...rest].sort((a, b) => a.id - b.id);
  localStorage.setItem(keyFor(code), JSON.stringify(log));
}

/** Chat history and the latest signal id, for the room's first render. */
export function rtcHistory(code: string) {
  const log = readLog(code);
  return {
    cursor: log.seq,
    chat: log.signals.filter((s) => s.type === "chat").map((s) => ({ id: s.id, sender: s.sender, text: s.payload, at: s.createdAt })),
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

type Appointment = typeof appointments.$inferSelect;

async function resolve(code: string): Promise<{ error: Response } | { role: Role; appt: Appointment }> {
  await ready();
  const session = await getSession();
  if (!session) return { error: json({ error: "Not signed in" }, 401) };
  const [row] = await db
    .select({ appt: appointments, patientUserId: patients.userId, doctorUserId: doctors.userId })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .where(and(eq(appointments.code, code)))
    .limit(1);
  if (!row) return { error: json({ error: "Not found" }, 404) };
  const role: Role | null = session.uid === row.doctorUserId ? "doctor" : session.uid === row.patientUserId ? "patient" : null;
  if (!role) return { error: json({ error: "Forbidden" }, 403) };
  if (row.appt.mode !== "video") return { error: json({ error: "Not a video consultation" }, 400) };
  return { role, appt: row.appt };
}

/** Drop-in replacement for fetch() against the old /api/rtc/[code] endpoint. */
export async function rtcFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input, window.location.origin);
  const code = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  const r = await resolve(code);
  if ("error" in r) return r.error;

  if (!init?.method || init.method === "GET") {
    const after = Math.max(0, Number(url.searchParams.get("after")) || 0);
    const signals = readLog(code).signals.filter((s) => s.id > after && (s.sender !== r.role || s.type === "chat"));
    return json({ signals, status: r.appt.status });
  }

  let body: { type?: string; payload?: unknown };
  try {
    body = JSON.parse(typeof init.body === "string" ? init.body : init.body instanceof Blob ? await init.body.text() : "{}");
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const type = body.type as SignalType;
  if (!TYPES.includes(type)) return json({ error: "Invalid type" }, 400);
  const payload = typeof body.payload === "string" ? body.payload : JSON.stringify(body.payload ?? "");
  if (payload.length > (type === "chat" ? 1000 : 30000)) return json({ error: "Payload too large" }, 413);
  if (type === "chat" && !payload.trim()) return json({ error: "Empty message" }, 400);

  const closed = r.appt.status === "cancelled" || r.appt.status === "completed";
  if (closed && type !== "leave" && type !== "chat") return json({ error: "This consultation has ended", status: r.appt.status }, 409);

  if (r.role === "doctor" && type === "join" && (r.appt.status === "booked" || r.appt.status === "checked_in")) {
    await db
      .update(appointments)
      .set({ status: "in_consult", startedAt: r.appt.startedAt ?? new Date().toISOString() })
      .where(eq(appointments.id, r.appt.id));
    markDirty();
  }
  // Read-modify-write with no await in between, so tabs can't interleave.
  const log = readLog(code);
  if (r.role === "doctor" && type === "join") {
    // Fresh session: drop stale negotiation from earlier attempts (keep chat history).
    log.signals = log.signals.filter((s) => s.type === "chat");
  }
  const signal: StoredSignal = { id: log.seq + 1, sender: r.role, type, payload, createdAt: new Date().toISOString() };
  log.seq = signal.id;
  log.signals.push(signal);
  writeLog(code, log);
  return json({ id: signal.id, createdAt: signal.createdAt });
}
