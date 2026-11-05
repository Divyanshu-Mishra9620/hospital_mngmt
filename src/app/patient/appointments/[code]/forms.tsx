"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarClock, Loader2, Star, XCircle } from "lucide-react";
import { cancelAppointmentAction, rescheduleAppointmentAction, rescheduleSlotsAction, submitFeedbackAction } from "@/lib/actions/patient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmtDay, fmtTime, inr } from "@/lib/format";
import { cn } from "@/lib/cn";

export function CancelForm({ code, refundable, fee }: { code: string; refundable: boolean; fee: number }) {
  const [state, action] = useActionState(cancelAppointmentAction, null);
  const [open, setOpen] = useState(false);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <XCircle className="size-4 text-danger-600" aria-hidden /> Cancel appointment
      </p>
      <p className="mt-1 text-sm text-ink-500">{refundable ? `${inr(fee)} will be refunded to your original payment method.` : "No refund within 2 hours of the slot."}</p>
      {!open ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
          Cancel appointment
        </Button>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="code" value={code} />
          <Field label="Reason" htmlFor="reason">
            <Select id="reason" name="reason" defaultValue="Change of plans">
              <option>Change of plans</option>
              <option>Feeling better</option>
              <option>Booked by mistake</option>
              <option>Will consult another doctor</option>
              <option>Travel / not in town</option>
            </Select>
          </Field>
          <FormMessage state={state} />
          <div className="flex gap-2">
            <SubmitButton variant="danger" size="sm" pendingText="Cancelling…">
              Confirm cancellation
            </SubmitButton>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Keep it
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function RescheduleForm({ code }: { code: string }) {
  const [state, action] = useActionState(rescheduleAppointmentAction, null);
  const [days, setDays] = useState<{ date: string; slots: string[] }[] | null>(null);
  const [date, setDate] = useState("");
  const [loading, startLoading] = useTransition();

  function load() {
    startLoading(async () => {
      const d = (await rescheduleSlotsAction(code)).filter((x) => x.slots.length);
      setDays(d);
      setDate(d[0]?.date ?? "");
    });
  }

  const slots = days?.find((d) => d.date === date)?.slots ?? [];
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <CalendarClock className="size-4 text-brand-600" aria-hidden /> Reschedule
      </p>
      <p className="mt-1 text-sm text-ink-500">Same doctor and consultation type. No extra charge.</p>
      {state?.ok ? (
        <div className="mt-3">
          <FormMessage state={state} />
        </div>
      ) : !days ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : null} Choose a new slot
        </Button>
      ) : days.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">No other slots available in the next two weeks.</p>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="code" value={code} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date" htmlFor="rs-date">
              <Select id="rs-date" name="date" value={date} onChange={(e) => setDate(e.target.value)}>
                {days.map((d) => (
                  <option key={d.date} value={d.date}>
                    {fmtDay(d.date)} ({d.slots.length})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Time" htmlFor="rs-time">
              <Select id="rs-time" name="time" key={date}>
                {slots.map((t) => (
                  <option key={t} value={t}>
                    {fmtTime(t)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <FormMessage state={state} />
          <SubmitButton size="sm" pendingText="Saving…">
            Confirm new slot
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

export function FeedbackForm({ code, doctorName }: { code: string; doctorName: string }) {
  const [state, action] = useActionState(submitFeedbackAction, null);
  const [rating, setRating] = useState(0);
  if (state?.ok)
    return (
      <Card className="p-4 sm:p-5">
        <FormMessage state={state} />
      </Card>
    );
  return (
    <Card className="p-4 sm:p-5">
      <form action={action} className="space-y-3">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="rating" value={rating} />
        <p className="font-semibold text-ink-900">How was your consultation with {doctorName}?</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className="p-1">
              <Star className={cn("size-8 transition", n <= rating ? "fill-accent-500 text-accent-500" : "text-ink-300")} />
            </button>
          ))}
        </div>
        <Textarea name="comment" rows={2} placeholder="Tell us what went well or what we can improve (optional)" maxLength={600} />
        <FormMessage state={state} />
        <SubmitButton size="sm" disabled={!rating} pendingText="Sending…">
          Submit feedback
        </SubmitButton>
      </form>
    </Card>
  );
}
