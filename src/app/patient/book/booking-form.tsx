"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarX2, CreditCard, Landmark, Lock, MapPin, Smartphone, Video } from "lucide-react";
import { bookAppointmentAction } from "@/lib/actions/patient";
import { Field, Textarea } from "@/components/ui/form";
import { EmptyState, FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmtDay, fmtTime, inr } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { DayAvailability } from "@/lib/slots";

const METHODS = [
  { value: "upi", label: "UPI", sub: "GPay, PhonePe, Paytm", icon: Smartphone },
  { value: "card", label: "Card", sub: "Debit / credit", icon: CreditCard },
  { value: "netbanking", label: "Net banking", sub: "All major banks", icon: Landmark },
];

type Slot = DayAvailability["slots"][number];

function dayParts(date: string) {
  const d = new Date(date + "T12:00:00Z");
  return {
    wd: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
    dd: d.getUTCDate(),
    mon: d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
  };
}

export function BookingForm({
  doctorId,
  doctorCode,
  doctorName,
  mode,
  initialDate,
  days,
  fee,
  location,
}: {
  doctorId: number;
  doctorCode: string;
  doctorName: string;
  mode: "in_person" | "video";
  initialDate: string;
  days: DayAvailability[];
  fee: number;
  location: string | null;
}) {
  const [state, action] = useActionState(bookAppointmentAction, null);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState<string | null>(null);
  const [method, setMethod] = useState("upi");

  const day = days.find((x) => x.date === date) ?? days[0];
  const slots = day.slots;
  const sessions = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) map.set(s.session, [...(map.get(s.session) ?? []), s]);
    return [...map.entries()];
  }, [slots]);
  const available = slots.filter((s) => s.state === "available").length;

  function chooseDate(d: string) {
    setDate(d);
    setTime(null);
    window.history.replaceState(null, "", `/patient/book?doctor=${doctorCode}&mode=${mode}&date=${d}`);
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="doctorId" value={doctorId} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time ?? ""} />
      <input type="hidden" name="paymentMethod" value={method} />

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-800">2. Choose a date</h2>
        <div className="scrollbar-none -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="listbox" aria-label="Date">
          {days.map((x) => {
            const on = x.date === date;
            const { wd, dd, mon } = dayParts(x.date);
            return (
              <button
                key={x.date}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => chooseDate(x.date)}
                className={cn(
                  "flex w-[4.25rem] shrink-0 snap-start flex-col items-center rounded-2xl border-2 px-1 py-2.5 transition",
                  on ? "border-brand-600 bg-brand-600 text-white shadow-soft" : x.available ? "border-line bg-white hover:border-brand-200" : "border-line bg-surface text-ink-400",
                )}
              >
                <span className={cn("text-[0.6875rem] font-semibold uppercase", on ? "text-brand-100" : "text-ink-500")}>{wd}</span>
                <span className="tabular font-display text-xl font-bold leading-tight">{dd}</span>
                <span className={cn("text-[0.6875rem]", on ? "text-brand-100" : "text-ink-500")}>{mon}</span>
                <span className={cn("mt-1 text-[0.625rem] font-semibold", on ? "text-white" : x.onLeave ? "text-danger-600" : x.available ? "text-success-700" : "text-ink-400")}>
                  {x.onLeave ? "Leave" : x.available ? `${x.available} slots` : "Full"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {day.onLeave || slots.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white shadow-card">
          <EmptyState
            icon={<CalendarX2 />}
            title={day.onLeave ? `${doctorName} is on leave this day` : `No ${mode === "video" ? "video" : "OPD"} hours on this day`}
            description={day.onLeave ? (day.leaveReason ?? "Please pick another date.") : "Pick another date, or switch the consultation type above."}
          />
        </div>
      ) : (
      <section>
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink-800">3. Pick a time · {fmtDay(date)}</h2>
          <span className="text-xs text-ink-500">{available} available</span>
        </div>
        <div className="space-y-4 rounded-2xl border border-line bg-white p-4 shadow-card">
          {sessions.map(([session, list]) => (
            <fieldset key={session}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{session}</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {list.map((s) => {
                  const on = time === s.time;
                  const disabled = s.state !== "available";
                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={disabled}
                      onClick={() => setTime(s.time)}
                      aria-pressed={on}
                      className={cn(
                        "tabular h-11 rounded-xl border text-sm font-semibold transition",
                        on && "border-brand-600 bg-brand-600 text-white shadow-soft",
                        !on && !disabled && "border-line-strong bg-white text-ink-800 hover:border-brand-400 hover:text-brand-700",
                        disabled && "cursor-not-allowed border-transparent bg-surface text-ink-300 line-through decoration-ink-300",
                      )}
                      title={s.state === "booked" ? "Already booked" : s.state === "past" ? "Time has passed" : undefined}
                    >
                      {fmtTime(s.time)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded border border-line-strong bg-white" /> Available
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded bg-brand-600" /> Selected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded bg-surface ring-1 ring-line" /> Booked / past
            </span>
          </div>
        </div>
      </section>
      )}

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-800">4. Reason for visit</h2>
        <Field label="Symptoms or reason (optional)" htmlFor="reason" hint="Helps the doctor prepare. Don't include sensitive details you'd rather discuss in person.">
          <Textarea id="reason" name="reason" rows={2} maxLength={400} placeholder="e.g. Follow-up for BP, chest discomfort while walking" />
        </Field>
      </section>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-ink-800">5. Payment</h2>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const on = method === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                aria-pressed={on}
                className={cn("rounded-xl border-2 p-3 text-left transition", on ? "border-brand-600 bg-brand-50/60" : "border-line bg-white hover:border-brand-200")}
              >
                <Icon className={cn("size-5", on ? "text-brand-700" : "text-ink-400")} aria-hidden />
                <p className="mt-1.5 text-sm font-semibold text-ink-900">{m.label}</p>
                <p className="hidden text-[0.6875rem] text-ink-500 sm:block">{m.sub}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Summary + pay (sticky on phones) */}
      <div className="sticky bottom-20 z-10 rounded-2xl border border-line bg-white p-4 shadow-lift lg:static lg:shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold text-ink-900">{doctorName}</p>
            <p className="text-ink-600">
              {time ? `${fmtDay(date)}, ${fmtTime(time)}` : "Select a time slot"}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
              {mode === "video" ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
              {mode === "video" ? "Video consultation" : location || "In-person visit"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Consultation fee</p>
            <p className="tabular font-display text-xl font-bold text-ink-900">{inr(fee)}</p>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          <FormMessage state={state} />
          <SubmitButton block size="lg" disabled={!time} pendingText="Confirming…">
            <Lock aria-hidden /> Pay {inr(fee)} &amp; confirm
          </SubmitButton>
          <p className="text-center text-[0.6875rem] text-ink-400">Demo payment gateway — no real money is charged.</p>
        </div>
      </div>
    </form>
  );
}
