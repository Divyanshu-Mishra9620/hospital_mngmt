import { db } from "@/db";
import { auditLogs, notifications } from "@/db/schema";

type Actor = { id: number; name: string; role: string } | null;

export async function audit(actor: Actor, action: string, entity: string, entityRef?: string | null, detail?: string) {
  try {
    await db.insert(auditLogs).values({
      userId: actor?.id ?? null,
      actorName: actor?.name ?? "System",
      role: actor?.role ?? "system",
      action,
      entity,
      entityRef: entityRef ?? null,
      detail: detail ?? null,
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}

export async function notify(userId: number, title: string, body: string, href?: string) {
  try {
    await db.insert(notifications).values({ userId, title, body, href: href ?? null });
  } catch (err) {
    console.error("notification failed", err);
  }
}
