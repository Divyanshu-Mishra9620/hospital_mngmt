"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell, CheckCheck } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requirePharmacist } from "@/lib/auth/session";
import { markPharmacyNotificationsReadAction } from "@/lib/actions/pharmacy";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";

async function __render() {
  const user = await requirePharmacist();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  const unread = rows.filter((r) => !r.read).length;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up"}
        actions={
          unread > 0 && (
            <form action={markPharmacyNotificationsReadAction}>
              <Button type="submit" variant="outline" size="sm">
                <CheckCheck aria-hidden /> Mark all read
              </Button>
            </form>
          )
        }
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<Bell />} title="No notifications yet" description="New online orders and system messages will appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((n) => {
              const body = (
                <div className="flex gap-3 px-4 py-3.5 sm:px-5">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", n.read ? "text-ink-700" : "font-semibold text-ink-900")}>{n.title}</p>
                    <p className="text-sm text-ink-500">{n.body}</p>
                    <p className="mt-0.5 text-xs text-ink-400" title={fmtDateTime(n.createdAt)}>
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href && n.href.startsWith("/pharmacy") ? (
                    <Link href={n.href} className="block hover:bg-surface/60">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

const __loader = () => __render();

export default function PageView() {
  return <ClientPage render={__loader} props={{}} />;
}
