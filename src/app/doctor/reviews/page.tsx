import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { requireDoctor } from "@/lib/auth/session";
import { ratingSummary, recentFeedback } from "@/lib/doctor/queries";
import { fmtDate } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Stars } from "@/components/ui/misc";
import { ModeBadge } from "@/components/status";

export const metadata: Metadata = { title: "Patient reviews" };

export default async function DoctorReviewsPage() {
  const { doctor } = await requireDoctor();
  const [summary, rows] = await Promise.all([ratingSummary(doctor.id), recentFeedback(doctor.id, 200)]);

  return (
    <>
      <PageHeader title="Patient reviews" description="Feedback patients leave after a completed consultation." />
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardBody>
            <p className="tabular font-display text-5xl font-bold text-ink-900">{summary.count ? summary.average.toFixed(1) : "—"}</p>
            <Stars value={summary.average} className="mt-2" />
            <p className="mt-1 text-sm text-ink-500">
              Based on {summary.count} review{summary.count === 1 ? "" : "s"}
            </p>
            <ul className="mt-5 space-y-2">
              {[5, 4, 3, 2, 1].map((r) => {
                const n = summary.distribution.get(r) ?? 0;
                const pct = summary.count ? (n / summary.count) * 100 : 0;
                return (
                  <li key={r} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-ink-600">{r}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-accent-500" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="tabular w-8 text-right text-ink-500">{n}</span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="All reviews" icon={<MessageSquare />} />
          {rows.length ? (
            <ul className="divide-y divide-line">
              {rows.map((f) => (
                <li key={f.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Stars value={f.rating} />
                      <span className="text-sm font-semibold text-ink-900">{f.patientName}</span>
                    </div>
                    <span className="text-xs text-ink-400">{fmtDate(f.createdAt)}</span>
                  </div>
                  {f.comment ? <p className="mt-1.5 text-[0.9375rem] text-ink-700">“{f.comment}”</p> : <p className="mt-1.5 text-sm italic text-ink-400">No written comment</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <ModeBadge mode={f.mode} />
                    <span>
                      Visit {fmtDate(f.apptDate)} · {f.apptCode}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<MessageSquare />} title="No reviews yet" description="Patients can rate their visit after it's completed." />
          )}
        </Card>
      </div>
    </>
  );
}
