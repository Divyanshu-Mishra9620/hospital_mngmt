import { cookies } from "next/headers";
import { and, asc, eq, gt, inArray, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, callSignals, doctors, patients } from "@/db/schema";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";

/**
 * HTTP-polled signalling channel for 1:1 WebRTC video consultations.
 *   GET  ?after=<id>  → signals from the other party (and chat from both) newer than <id>
 *   POST {type, payload} → append a signal as the signed-in party
 * Only the appointment's own patient and doctor can use the channel.
 */

const TYPES = ["join", "offer", "answer", "candidate", "leave", "chat"] as const;
type SignalType = (typeof TYPES)[number];

async function resolve(code: string) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return { error: Response.json({ error: "Not signed in" }, { status: 401 }) };
  const [row] = await db
    .select({ appt: appointments, patientUserId: patients.userId, doctorUserId: doctors.userId })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .where(eq(appointments.code, code))
    .limit(1);
  if (!row) return { error: Response.json({ error: "Not found" }, { status: 404 }) };
  const role = session.uid === row.doctorUserId ? "doctor" : session.uid === row.patientUserId ? "patient" : null;
  if (!role) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  if (row.appt.mode !== "video") return { error: Response.json({ error: "Not a video consultation" }, { status: 400 }) };
  return { role: role as "doctor" | "patient", appt: row.appt };
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = await resolve(code);
  if ("error" in r) return r.error;
  const after = Math.max(0, Number(new URL(request.url).searchParams.get("after")) || 0);
  const rows = await db
    .select({ id: callSignals.id, sender: callSignals.sender, type: callSignals.type, payload: callSignals.payload, createdAt: callSignals.createdAt })
    .from(callSignals)
    .where(
      and(
        eq(callSignals.appointmentId, r.appt.id),
        gt(callSignals.id, after),
        or(ne(callSignals.sender, r.role), eq(callSignals.type, "chat")),
      ),
    )
    .orderBy(asc(callSignals.id))
    .limit(200);
  return Response.json(
    { signals: rows, status: r.appt.status },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = await resolve(code);
  if ("error" in r) return r.error;

  let body: { type?: string; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  const type = body.type as SignalType;
  if (!TYPES.includes(type)) return Response.json({ error: "Invalid type" }, { status: 400 });
  const payload = typeof body.payload === "string" ? body.payload : JSON.stringify(body.payload ?? "");
  const limit = type === "chat" ? 1000 : 30000;
  if (payload.length > limit) return Response.json({ error: "Payload too large" }, { status: 413 });
  if (type === "chat" && !payload.trim()) return Response.json({ error: "Empty message" }, { status: 400 });

  const closed = r.appt.status === "cancelled" || r.appt.status === "completed";
  if (closed && type !== "leave" && type !== "chat") {
    return Response.json({ error: "This consultation has ended", status: r.appt.status }, { status: 409 });
  }

  if (r.role === "doctor" && type === "join") {
    // Fresh session: drop stale negotiation from earlier attempts (keep chat history).
    await db
      .delete(callSignals)
      .where(and(eq(callSignals.appointmentId, r.appt.id), inArray(callSignals.type, ["join", "offer", "answer", "candidate", "leave"])));
    if (r.appt.status === "booked" || r.appt.status === "checked_in") {
      await db
        .update(appointments)
        .set({ status: "in_consult", startedAt: r.appt.startedAt ?? new Date().toISOString() })
        .where(eq(appointments.id, r.appt.id));
    }
  }

  const [row] = await db
    .insert(callSignals)
    .values({ appointmentId: r.appt.id, sender: r.role, type, payload })
    .returning({ id: callSignals.id, createdAt: callSignals.createdAt });
  return Response.json({ id: row.id, createdAt: row.createdAt }, { headers: { "Cache-Control": "no-store" } });
}
