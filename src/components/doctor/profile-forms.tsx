"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { Field, Input, Textarea } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function DoctorProfileForm({ action, initial }: { action: Action; initial: { bio: string; expertise: string; languages: string; phone: string } }) {
  const [state, formAction] = useActionState(action, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <Field label="About you" htmlFor="bio" hint="Shown on your public profile on the hospital website." error={fe.bio}>
        <Textarea id="bio" name="bio" rows={5} defaultValue={initial.bio} aria-invalid={!!fe.bio} />
      </Field>
      <Field label="Areas of expertise" htmlFor="expertise" hint="Comma-separated, e.g. Heart failure, Angioplasty" error={fe.expertise}>
        <Input id="expertise" name="expertise" defaultValue={initial.expertise} aria-invalid={!!fe.expertise} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Languages spoken" htmlFor="languages" error={fe.languages}>
          <Input id="languages" name="languages" defaultValue={initial.languages} aria-invalid={!!fe.languages} />
        </Field>
        <Field label="Mobile number" htmlFor="phone" error={fe.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={initial.phone} aria-invalid={!!fe.phone} />
        </Field>
      </div>
      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Current password" htmlFor="current" error={fe.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" aria-invalid={!!fe.current} />
      </Field>
      <Field label="New password" htmlFor="new-password" hint="8+ characters with a letter and a number" error={fe.password}>
        <Input id="new-password" name="password" type="password" autoComplete="new-password" aria-invalid={!!fe.password} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={fe.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!fe.confirm} />
      </Field>
      <SubmitButton variant="outline" pendingText="Updating…">
        Change password
      </SubmitButton>
    </form>
  );
}
