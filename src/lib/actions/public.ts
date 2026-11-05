"use server";

import { z } from "zod";
import { db } from "@/db";
import { enquiries, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { fail, ok, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { notify } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  phone: z.string().trim().max(20).optional().transform((s) => s || null),
  topic: z.enum(["Appointments", "Health check-up", "Insurance & billing", "International patients", "Feedback", "Other"], "Choose a topic"),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(1500),
  website: z.string().max(0).optional(), // honeypot
});

export async function submitEnquiryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...fail("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues)), data: { values: Object.fromEntries(formData) } };
  const { website: _hp, ...v } = parsed.data;
  void _hp;
  await db.insert(enquiries).values(v);
  const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true)));
  for (const a of admins) await notify(a.id, "New website enquiry", `${v.name} · ${v.topic}`, "/admin/enquiries");
  return ok("Thank you — our patient-care team will get back to you within one working day.");
}
