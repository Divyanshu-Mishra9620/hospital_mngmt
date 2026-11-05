import { count, desc, eq } from "drizzle-orm";
import { Inbox, Mail, Phone } from "lucide-react";
import { db } from "@/db";
import { enquiries } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { adminSetEnquiryStatus } from "@/lib/actions/admin";
import { str } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDateTime, timeAgo } from "@/lib/format";

export const metadata = { title: "Enquiries" };

const STATUS = {
  new: { label: "New", tone: "danger" as const },
  in_progress: { label: "In progress", tone: "warning" as const },
  resolved: { label: "Resolved", tone: "success" as const },
};

export default async function AdminEnquiries({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (["new", "in_progress", "resolved"] as const).find((s) => s === str(sp.status));
  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(enquiries)
      .where(status ? eq(enquiries.status, status) : undefined)
      .orderBy(desc(enquiries.createdAt)),
    db.select({ status: enquiries.status, n: count() }).from(enquiries).groupBy(enquiries.status),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x.n])) as Record<string, number>;
  const all = counts.reduce((s, x) => s + x.n, 0);

  return (
    <>
      <PageHeader title="Enquiries" description="Messages sent from the website's contact form." />
      <Tabs
        className="mb-4"
        active={status ?? "all"}
        tabs={[
          { key: "all", label: "All", href: "/admin/enquiries", count: all },
          { key: "new", label: "New", href: "/admin/enquiries?status=new", count: c.new ?? 0 },
          { key: "in_progress", label: "In progress", href: "/admin/enquiries?status=in_progress", count: c.in_progress ?? 0 },
          { key: "resolved", label: "Resolved", href: "/admin/enquiries?status=resolved", count: c.resolved ?? 0 },
        ]}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Inbox />} title="No enquiries here" />
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((e) => (
            <li key={e.id}>
              <Card className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink-900">{e.name}</p>
                      <Badge tone={STATUS[e.status].tone} dot>
                        {STATUS[e.status].label}
                      </Badge>
                      <Badge tone="neutral">{e.topic}</Badge>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                      <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                        <Mail className="size-3.5" aria-hidden /> {e.email}
                      </a>
                      {e.phone && (
                        <a href={`tel:${e.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                          <Phone className="size-3.5" aria-hidden /> {e.phone}
                        </a>
                      )}
                      <span title={fmtDateTime(e.createdAt)}>{timeAgo(e.createdAt)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(["new", "in_progress", "resolved"] as const)
                      .filter((s) => s !== e.status)
                      .map((s) => (
                        <form key={s} action={adminSetEnquiryStatus}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="status" value={s} />
                          <Button type="submit" variant={s === "resolved" ? "secondary" : "ghost"} size="xs">
                            {s === "new" ? "Reopen" : s === "in_progress" ? "Mark in progress" : "Mark resolved"}
                          </Button>
                        </form>
                      ))}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">{e.message}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
