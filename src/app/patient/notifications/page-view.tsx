"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell, CheckCheck } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { markNotificationsReadAction } from "@/lib/actions/patient";
import { requirePatient } from "@/lib/auth/session";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

async function __render() {
  const { user } = await requirePatient();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  const unread = rows.filter((r) => !r.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up"}
        actions={
          unread ? (
            <form action={markNotificationsReadAction}>
              <Button type="submit" variant="outline" size="sm">
                <CheckCheck aria-hidden /> Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Bell />} title="No notifications yet" />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((n) => {
              const body = (
                <div className="flex gap-3 px-4 py-3.5 sm:px-5">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={cn("text-sm", n.read ? "font-medium text-ink-700" : "font-semibold text-ink-900")}>{n.title}</p>
                      <span className="shrink-0 text-xs text-ink-400">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-600">{n.body}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id} className={cn(!n.read && "bg-brand-50/40")}>
                  {n.href ? (
                    <Link href={n.href} className="block transition hover:bg-surface/60">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

const __loader = () => __render();

export default function PageView() {
  return <ClientPage render={__loader} props={{}} />;
}
