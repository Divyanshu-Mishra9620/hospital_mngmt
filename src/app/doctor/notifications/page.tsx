import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Bell, CheckCheck } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { markDoctorNotificationsRead, openDoctorNotification } from "@/lib/actions/doctor";
import { requireDoctor } from "@/lib/auth/session";
import { timeAgo } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Notifications" };

export default async function DoctorNotificationsPage() {
  const { user } = await requireDoctor();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  const unread = rows.filter((r) => !r.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          unread ? (
            <form action={markDoctorNotificationsRead}>
              <button type="submit" className={buttonStyles({ variant: "outline", size: "sm" })}>
                <CheckCheck /> Mark all as read
              </button>
            </form>
          ) : null
        }
      />
      <Card>
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((n) => (
              <li key={n.id}>
                <form action={openDoctorNotification.bind(null, n.id)}>
                  <button type="submit" className={cn("flex w-full gap-3 px-4 py-3.5 text-left hover:bg-surface/60 sm:px-5", !n.read && "bg-brand-50/50")}>
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={cn("text-[0.9375rem] text-ink-900", !n.read && "font-semibold")}>{n.title}</span>
                        <span className="shrink-0 text-xs text-ink-400">{timeAgo(n.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-600">{n.body}</span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Bell />} title="No notifications" description="New bookings, cancellations and updates will show up here." />
        )}
      </Card>
    </>
  );
}
