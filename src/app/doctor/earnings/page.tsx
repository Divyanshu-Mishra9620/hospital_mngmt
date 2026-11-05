import type { Metadata } from "next";
import { Building2, IndianRupee, TrendingUp, Video } from "lucide-react";
import { requireDoctor } from "@/lib/auth/session";
import { earningsByDay } from "@/lib/doctor/queries";
import { fmtDay, inr } from "@/lib/format";
import { addDays, todayISO } from "@/lib/time";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Earnings" };

export default async function DoctorEarningsPage() {
  const { doctor } = await requireDoctor();
  const today = todayISO();
  const from = addDays(today, -29);
  const rows = await earningsByDay(doctor.id, from, today);

  const days = Array.from({ length: 30 }, (_, i) => addDays(from, i)).map((date) => {
    const ip = rows.find((r) => r.date === date && r.mode === "in_person");
    const vc = rows.find((r) => r.date === date && r.mode === "video");
    return {
      date,
      ipCount: Number(ip?.n ?? 0),
      ipRevenue: Number(ip?.revenue ?? 0),
      vcCount: Number(vc?.n ?? 0),
      vcRevenue: Number(vc?.revenue ?? 0),
    };
  });
  const totals = days.reduce(
    (t, d) => ({ ipCount: t.ipCount + d.ipCount, ipRevenue: t.ipRevenue + d.ipRevenue, vcCount: t.vcCount + d.vcCount, vcRevenue: t.vcRevenue + d.vcRevenue }),
    { ipCount: 0, ipRevenue: 0, vcCount: 0, vcRevenue: 0 },
  );
  const total = totals.ipRevenue + totals.vcRevenue;
  const consults = totals.ipCount + totals.vcCount;
  const maxDay = Math.max(1, ...days.map((d) => d.ipRevenue + d.vcRevenue));
  const working = days.filter((d) => d.ipCount + d.vcCount > 0).length;
  const reversed = [...days].reverse().filter((d) => d.ipCount + d.vcCount > 0);

  return (
    <>
      <PageHeader title="Earnings" description="Completed consultations over the last 30 days. Fees are set by the hospital administration." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total (30 days)" value={inr(total)} icon={<IndianRupee />} tone="accent" sub={`${consults} consultations`} />
        <StatCard label="In-person OPD" value={inr(totals.ipRevenue)} icon={<Building2 />} sub={`${totals.ipCount} × ${inr(doctor.inPersonFee)}`} />
        <StatCard label="Video consults" value={inr(totals.vcRevenue)} icon={<Video />} tone="violet" sub={`${totals.vcCount} × ${inr(doctor.videoFee)}`} />
        <StatCard label="Average per OPD day" value={inr(working ? Math.round(total / working) : 0)} icon={<TrendingUp />} tone="success" sub={`${working} working days`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Daily revenue" description="In-person vs video, last 30 days" />
          <CardBody>
            <div className="flex h-56 items-end gap-[3px] sm:gap-1" role="img" aria-label="Bar chart of daily consultation revenue for the last 30 days">
              {days.map((d) => {
                const t = d.ipRevenue + d.vcRevenue;
                return (
                  <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${fmtDay(d.date)}: ${inr(t)} (${d.ipCount} OPD, ${d.vcCount} video)`}>
                    <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-[3px]" style={{ height: `${(t / maxDay) * 100}%` }}>
                      <div className="w-full bg-violet-700/70" style={{ height: t ? `${(d.vcRevenue / t) * 100}%` : 0 }} />
                      <div className="w-full flex-1 bg-brand-500" />
                    </div>
                    {t === 0 && <div className="h-px w-full bg-line-strong" />}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[0.6875rem] text-ink-400">
              <span>{fmtDay(days[0].date)}</span>
              <span>{fmtDay(days[14].date)}</span>
              <span>Today</span>
            </div>
            <p className="mt-4 flex gap-4 text-xs text-ink-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand-500" /> In-person ({inr(doctor.inPersonFee)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-violet-700/70" /> Video ({inr(doctor.videoFee)})
              </span>
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Day by day" description={`${reversed.length} days with consultations`} />
          <div className="max-h-[22rem] overflow-y-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0">
                <tr>
                  {["Date", "OPD", "Video", "Revenue"].map((h, i) => (
                    <th key={h} className={`border-b border-line bg-surface px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500 ${i ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {reversed.map((d) => (
                  <tr key={d.date}>
                    <td className="border-b border-line px-4 py-2.5 text-ink-700">{d.date === today ? "Today" : fmtDay(d.date)}</td>
                    <td className="border-b border-line px-4 py-2.5 text-right">{d.ipCount}</td>
                    <td className="border-b border-line px-4 py-2.5 text-right">{d.vcCount}</td>
                    <td className="border-b border-line px-4 py-2.5 text-right font-semibold text-ink-900">{inr(d.ipRevenue + d.vcRevenue)}</td>
                  </tr>
                ))}
                {!reversed.length && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-500">
                      No completed consultations in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
