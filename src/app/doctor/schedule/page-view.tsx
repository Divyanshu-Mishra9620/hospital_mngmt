"use client";

import { ClientPage } from "@/components/client-page";
import { CalendarClock, CalendarOff, Clock, Eye, X } from "lucide-react";
import { addScheduleBlock, addLeave, removeLeave, removeScheduleBlock, updateSlotMinutes } from "@/lib/actions/doctor";
import { requireDoctor } from "@/lib/auth/session";
import { WEEKDAYS } from "@/lib/constants";
import { doctorScheduleData } from "@/lib/doctor/queries";
import { fmtDay, fmtLongDate, fmtTime } from "@/lib/format";
import { getDoctorAvailability } from "@/lib/slots";
import { todayISO } from "@/lib/time";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { AddBlockForm, LeaveForm, RemoveBlockButton, SlotLengthForm } from "@/components/doctor/schedule-forms";
import { cn } from "@/lib/cn";

const MODE_LABEL = { both: "In-person & video", in_person: "In-person", video: "Video only" } as const;
const MODE_TONE = { both: "brand", in_person: "neutral", video: "violet" } as const;

async function __render() {
  const { doctor } = await requireDoctor();
  const today = todayISO();
  const [{ blocks, leaves }, preview] = await Promise.all([doctorScheduleData(doctor.id, today), getDoctorAvailability(doctor.id, today, 7)]);

  const byDay = WEEKDAYS.map((name, wd) => ({ name, wd, blocks: blocks.filter((b) => b.weekday === wd) }));
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <>
      <PageHeader title="OPD schedule & leave" description="Patients can only book the slots you publish here. Existing bookings are always protected." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Weekly sessions" icon={<CalendarClock />} description={`${blocks.length} session${blocks.length === 1 ? "" : "s"} · ${doctor.slotMinutes}-minute slots`} />
            <ul className="divide-y divide-line">
              {order.map((wd) => {
                const d = byDay[wd];
                return (
                  <li key={wd} className="grid gap-2 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:px-5">
                    <p className={cn("font-semibold", d.blocks.length ? "text-ink-900" : "text-ink-400")}>{d.name}</p>
                    {d.blocks.length ? (
                      <div className="flex flex-wrap gap-2">
                        {d.blocks.map((b) => (
                          <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/50 py-1.5 pl-3 pr-1.5">
                            <span className="tabular text-sm font-semibold text-ink-800">
                              {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                            </span>
                            <Badge tone={MODE_TONE[b.mode]}>{MODE_LABEL[b.mode]}</Badge>
                            <RemoveBlockButton action={removeScheduleBlock.bind(null, b.id)} label={`${d.name} ${fmtTime(b.startTime)} session`} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-400">No OPD</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Next 7 days — what patients see" icon={<Eye />} description="Live availability including bookings and leave." />
            <CardBody className="space-y-4">
              {preview.map((day) => {
                const booked = day.slots.filter((s) => s.state === "booked").length;
                return (
                  <div key={day.date}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-ink-900">{fmtDay(day.date)}</p>
                      <p className="text-xs text-ink-500">
                        {day.onLeave ? (
                          <span className="font-semibold text-danger-700">On leave{day.leaveReason ? ` · ${day.leaveReason}` : ""}</span>
                        ) : day.slots.length ? (
                          `${day.available} open · ${booked} booked`
                        ) : (
                          "No OPD"
                        )}
                      </p>
                    </div>
                    {!day.onLeave && day.slots.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {day.slots.map((s) => (
                          <span
                            key={s.time}
                            title={`${fmtTime(s.time)} · ${s.state}`}
                            className={cn(
                              "tabular rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium",
                              s.state === "available" && "bg-success-50 text-success-700",
                              s.state === "booked" && "bg-brand-600 text-white",
                              s.state === "past" && "bg-surface-2 text-ink-400 line-through",
                            )}
                          >
                            {fmtTime(s.time).replace(" AM", "a").replace(" PM", "p")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="flex flex-wrap gap-4 border-t border-line pt-3 text-xs text-ink-500">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-success-100" /> Open
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-brand-600" /> Booked
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-surface-2" /> Past
                </span>
              </p>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Add a session" icon={<Clock />} />
            <CardBody>
              <AddBlockForm action={addScheduleBlock} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Slot length" description="Applies to all sessions." />
            <CardBody>
              <SlotLengthForm action={updateSlotMinutes} current={doctor.slotMinutes} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Leave & unavailable days" icon={<CalendarOff />} />
            <CardBody className="space-y-5">
              <LeaveForm action={addLeave} minDate={today} />
              {leaves.length ? (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {leaves.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{fmtLongDate(l.date)}</p>
                        {l.reason && <p className="truncate text-xs text-ink-500">{l.reason}</p>}
                      </div>
                      <form action={removeLeave.bind(null, l.id)}>
                        <button type="submit" className="rounded-lg p-1.5 text-ink-400 hover:bg-surface hover:text-ink-800" aria-label={`Remove leave on ${l.date}`} title="Remove leave">
                          <X className="size-4" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState className="py-6" title="No upcoming leave" />
              )}
              <Alert tone="info">Marking leave on a day with bookings cancels them, refunds the fee in full and notifies each patient.</Alert>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

const __loader = () => __render();

export default function PageView() {
  return <ClientPage render={__loader} props={{}} />;
}
