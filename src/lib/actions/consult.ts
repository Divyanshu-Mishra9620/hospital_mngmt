"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, callSignals } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireDoctor } from "@/lib/auth/session";

/**
 * Doctor ends the video call and closes the consultation. The patient's room
 * sees the status change on its next poll and shows the "consultation ended"
 * screen. The doctor lands in the workspace to finish the prescription.
 */
export async function endVideoConsultation(code: string) {
  const { user, doctor } = await requireDoctor();
  const [appt] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.code, code), eq(appointments.doctorId, doctor.id)))
    .limit(1);
  if (!appt) redirect("/doctor");
  if (appt.status !== "completed" && appt.status !== "cancelled") {
    const nowIso = new Date().toISOString();
    await db
      .update(appointments)
      .set({ status: "completed", startedAt: appt.startedAt ?? nowIso, completedAt: nowIso })
      .where(eq(appointments.id, appt.id));
    await audit({ id: user.id, name: user.name, role: "doctor" }, "video_consult_completed", "appointment", appt.code);
  }
  await db.insert(callSignals).values({ appointmentId: appt.id, sender: "doctor", type: "leave", payload: "ended" });
  revalidatePath("/doctor", "layout");
  revalidatePath("/patient", "layout");
  redirect(`/doctor/consult/${appt.code}`);
}
