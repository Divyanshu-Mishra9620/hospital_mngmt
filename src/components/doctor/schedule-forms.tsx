"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { WEEKDAYS_SHORT } from "@/lib/constants";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert, FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function AddBlockForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-800">Days</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS_SHORT.map((d, i) => (
            <label key={d} className="cursor-pointer">
              <input type="checkbox" name="weekdays" value={i} defaultChecked={i >= 1 && i <= 5} className="peer sr-only" />
              <span className="inline-grid h-9 w-12 place-items-center rounded-lg border border-line-strong text-sm font-semibold text-ink-600 transition peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
                {d}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Start" htmlFor="blk-start">
          <Input id="blk-start" name="startTime" type="time" defaultValue="17:00" step={300} required />
        </Field>
        <Field label="End" htmlFor="blk-end">
          <Input id="blk-end" name="endTime" type="time" defaultValue="19:00" step={300} required />
        </Field>
        <Field label="Consultation type" htmlFor="blk-mode" className="col-span-2 sm:col-span-1">
          <Select id="blk-mode" name="mode" defaultValue="both">
            <option value="both">In-person & video</option>
            <option value="in_person">In-person only</option>
            <option value="video">Video only</option>
          </Select>
        </Field>
      </div>
      <SubmitButton size="sm" pendingText="Adding…">
        Add session
      </SubmitButton>
    </form>
  );
}

export function RemoveBlockButton({ action, label }: { action: Action; label: string }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="contents">
      <button type="submit" className="rounded-lg p-1.5 text-ink-400 hover:bg-danger-50 hover:text-danger-700" aria-label={`Remove ${label}`} title="Remove session">
        <Trash2 className="size-4" />
      </button>
      {state?.error && <p className="col-span-full mt-1 text-xs text-danger-700">{state.error}</p>}
    </form>
  );
}

export function SlotLengthForm({ action, current }: { action: Action; current: number }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <div className="flex items-end gap-2">
        <Field label="Slot length" htmlFor="slot-len" className="flex-1">
          <Select id="slot-len" name="slotMinutes" defaultValue={current}>
            {[10, 15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton variant="outline" pendingText="Saving…">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}

export function LeaveForm({ action, minDate }: { action: Action; minDate: string }) {
  const [state, formAction] = useActionState(action, null);
  const needsConfirm = !!state?.data?.needsConfirm;
  const d = (state?.data ?? {}) as { date?: string; reason?: string };
  return (
    <form action={formAction} className="space-y-3">
      {needsConfirm ? (
        <Alert tone="warning" title="Patients are booked on this day">
          {state?.error}
        </Alert>
      ) : (
        <FormMessage state={state} />
      )}
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label="Date" htmlFor="leave-date">
          <Input id="leave-date" name="date" type="date" min={minDate} defaultValue={needsConfirm ? d.date : undefined} key={needsConfirm ? `c-${d.date}` : "n"} required />
        </Field>
        <Field label="Reason (optional)" htmlFor="leave-reason">
          <Input id="leave-reason" name="reason" maxLength={200} placeholder="Conference, personal leave…" defaultValue={needsConfirm ? d.reason : undefined} key={needsConfirm ? `r-${d.reason}` : "rn"} />
        </Field>
      </div>
      {needsConfirm && <input type="hidden" name="confirm" value="yes" />}
      <SubmitButton size="sm" variant={needsConfirm ? "danger" : "primary"} pendingText="Saving…">
        {needsConfirm ? "Confirm leave & cancel bookings" : "Mark leave"}
      </SubmitButton>
    </form>
  );
}
