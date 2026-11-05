"use client";

import { useActionState } from "react";
import { submitEnquiryAction } from "@/lib/actions/public";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

export function ContactForm() {
  const [state, action] = useActionState(submitEnquiryAction, null);
  const fe = state?.fieldErrors ?? {};
  const v = (state?.data?.values ?? {}) as Record<string, string>;
  if (state?.ok) return <div className="mt-6"><FormMessage state={state} /></div>;
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="c-name" error={fe.name} required>
          <Input id="c-name" name="name" autoComplete="name" defaultValue={v.name} aria-invalid={!!fe.name} />
        </Field>
        <Field label="Phone" htmlFor="c-phone" error={fe.phone}>
          <Input id="c-phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} />
        </Field>
      </div>
      <Field label="Email" htmlFor="c-email" error={fe.email} required>
        <Input id="c-email" name="email" type="email" autoComplete="email" defaultValue={v.email} aria-invalid={!!fe.email} />
      </Field>
      <Field label="Topic" htmlFor="c-topic" error={fe.topic} required>
        <Select id="c-topic" name="topic" defaultValue={v.topic ?? "Appointments"} key={v.topic}>
          {["Appointments", "Health check-up", "Insurance & billing", "International patients", "Feedback", "Other"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Message" htmlFor="c-message" error={fe.message} required>
        <Textarea id="c-message" name="message" rows={5} defaultValue={v.message} aria-invalid={!!fe.message} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingText="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}
