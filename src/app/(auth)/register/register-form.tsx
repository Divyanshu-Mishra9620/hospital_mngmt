"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/lib/actions/auth";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, null);
  const fe = state?.fieldErrors ?? {};
  const v = (state?.data?.values ?? {}) as Record<string, string | undefined>;

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Full name (as on ID)" htmlFor="name" error={fe.name} required>
        <Input id="name" name="name" defaultValue={v.name} autoComplete="name" aria-invalid={!!fe.name} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile number" htmlFor="phone" error={fe.phone} required>
          <Input id="phone" name="phone" defaultValue={v.phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXX XXXXX" aria-invalid={!!fe.phone} required />
        </Field>
        <Field label="Email" htmlFor="email" error={fe.email} required>
          <Input id="email" name="email" defaultValue={v.email} type="email" autoComplete="email" aria-invalid={!!fe.email} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date of birth" htmlFor="dob" error={fe.dob} required>
          <Input id="dob" name="dob" defaultValue={v.dob} type="date" autoComplete="bday" aria-invalid={!!fe.dob} required />
        </Field>
        <Field label="Gender" htmlFor="gender" error={fe.gender} required>
          <Select id="gender" name="gender" key={v.gender ?? ""} defaultValue={v.gender ?? ""} aria-invalid={!!fe.gender} required>
            <option value="" disabled>
              Select
            </option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" htmlFor="password" error={fe.password} hint="8+ characters with a letter and a number" required>
          <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!fe.password} required />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={fe.confirm} required>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!fe.confirm} required />
        </Field>
      </div>
      <div>
        <Checkbox
          name="consent"
          label={
            <>
              I agree to the{" "}
              <Link href="/privacy" className="font-medium text-brand-700 underline-offset-2 hover:underline">
                privacy policy
              </Link>{" "}
              and consent to Medora Hospital storing my health records for my care.
            </>
          }
        />
        {fe.consent && <p className="mt-1.5 text-sm text-danger-700">{fe.consent}</p>}
      </div>
      <SubmitButton block size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
