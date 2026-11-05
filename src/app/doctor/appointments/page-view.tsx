"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { AppointmentStatus } from "@/db/schema";
import { requireDoctor } from "@/lib/auth/session";
import { getDayAppointments } from "@/lib/doctor/queries";
import { fmtLongDate, fmtRelativeDay, inr } from "@/lib/format";
import { addDays, clinicNow, isValidDate } from "@/lib/time";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { buttonStyles } from "@/components/ui/button";
import { QueueList } from "@/components/doctor/queue-list";
import { cn } from "@/lib/cn";

const STATUS_FILTERS: { key: string; label: string; match: AppointmentStatus[] }[] = [
  { key: "all", label: "All", match: [] },
  { key: "waiting", label: "Waiting", match: ["booked", "checked_in", "in_consult"] },
  { key: "completed", label: "Completed", match: ["completed"] },
  { key: "missed", label: "No-show / cancelled", match: ["no_show", "cancelled"] },
];

async function __render({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { doctor } = await requireDoctor();
  const sp = await searchParams;
  const today = clinicNow().date;
  const date = typeof sp.date === "string" && isValidDate(sp.date) ? sp.date : today;
  const mode = sp.mode === "video" || sp.mode === "in_person" ? sp.mode : "all";
  const status = STATUS_FILTERS.find((f) => f.key === sp.status) ?? STATUS_FILTERS[0];

  const all = await getDayAppointments(doctor.id, date);
  const rows = all.filter((a) => (mode === "all" || a.mode === mode) && (!status.match.length || status.match.includes(a.status)));

  const href = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ date, mode, status: status.key, ...patch });
    if (q.get("mode") === "all") q.delete("mode");
    if (q.get("status") === "all") q.delete("status");
    if (q.get("date") === today) q.delete("date");
    const s = q.toString();
    return `/doctor/appointments${s ? `?${s}` : ""}`;
  };

  const liveCount = all.filter((a) => a.status !== "cancelled").length;
  const revenue = all.filter((a) => a.status === "completed").reduce((s, a) => s + a.fee, 0);

  return (
    <>
      <PageHeader title="Appointments" description="Your OPD and video consultation list by day." />

      <Card className="mb-5 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Link href={href({ date: addDays(date, -1) })} className={buttonStyles({ variant: "outline", size: "sm", className: "px-2.5" })} aria-label="Previous day">
              <ChevronLeft />
            </Link>
            <form action="/doctor/appointments" className="flex items-center gap-2">
              {mode !== "all" && <input type="hidden" name="mode" value={mode} />}
              {status.key !== "all" && <input type="hidden" name="status" value={status.key} />}
              <input
                type="date"
                name="date"
                defaultValue={date}
                className="h-9 rounded-lg border border-line-strong bg-white px-2.5 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
                aria-label="Choose date"
              />
              <button type="submit" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                Go
              </button>
            </form>
            <Link href={href({ date: addDays(date, 1) })} className={buttonStyles({ variant: "outline", size: "sm", className: "px-2.5" })} aria-label="Next day">
              <ChevronRight />
            </Link>
            {date !== today && (
              <Link href={href({ date: today })} className={buttonStyles({ variant: "ghost", size: "sm" })}>
                Today
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg bg-surface p-0.5">
              {[
                { k: "all", l: "All visits" },
                { k: "in_person", l: "In-person" },
                { k: "video", l: "Video" },
              ].map((m) => (
                <Link
                  key={m.k}
                  href={href({ mode: m.k })}
                  className={cn("rounded-md px-3 py-1.5 text-sm font-medium", mode === m.k ? "bg-white text-brand-800 shadow-card" : "text-ink-500 hover:text-ink-800")}
                >
                  {m.l}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap rounded-lg bg-surface p-0.5">
              {STATUS_FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={href({ status: f.key })}
                  className={cn("rounded-md px-3 py-1.5 text-sm font-medium", status.key === f.key ? "bg-white text-brand-800 shadow-card" : "text-ink-500 hover:text-ink-800")}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-1 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900">
            {fmtRelativeDay(date)} <span className="font-normal text-ink-500">· {fmtLongDate(date)}</span>
          </h2>
          <p className="text-sm text-ink-500">
            {liveCount} booked · {all.filter((a) => a.status === "completed").length} completed · {inr(revenue)} collected
          </p>
        </div>
        {rows.length ? (
          <QueueList rows={rows} today={today} />
        ) : (
          <EmptyState icon={<CalendarDays />} title="No appointments match" description={all.length ? "Try a different filter." : "Nothing is booked for this day."} />
        )}
      </Card>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
