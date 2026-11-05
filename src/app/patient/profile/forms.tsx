"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/patient";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

type V = Record<string, string>;

export function ProfileForm({ values }: { values: V }) {
  const [state, action] = useActionState(updateProfileAction, null);
  const fe = state?.fieldErrors ?? {};
  const f = (name: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Field label={label} htmlFor={name} error={fe[name]}>
      <Input id={name} name={name} defaultValue={values[name]} aria-invalid={!!fe[name]} {...props} />
    </Field>
  );
  return (
    <form action={action} className="space-y-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Contact</legend>
        {f("phone", "Mobile number", { type: "tel", inputMode: "tel", required: true })}
        {f("city", "City")}
        <Field label="Address" htmlFor="address" error={fe.address} className="sm:col-span-2">
          <Textarea id="address" name="address" rows={2} defaultValue={values.address} />
        </Field>
        {f("pincode", "PIN code", { inputMode: "numeric", maxLength: 6 })}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Emergency contact</legend>
        {f("emergencyName", "Name")}
        {f("emergencyRelation", "Relation")}
        {f("emergencyPhone", "Phone", { type: "tel", inputMode: "tel" })}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Medical</legend>
        <Field label="Blood group" htmlFor="bloodGroup">
          <Select id="bloodGroup" name="bloodGroup" defaultValue={values.bloodGroup}>
            <option value="">Not known</option>
            {BLOOD_GROUPS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </Field>
        {f("heightCm", "Height (cm)", { inputMode: "decimal" })}
        {f("weightKg", "Weight (kg)", { inputMode: "decimal" })}
        <Field label="Allergies" htmlFor="allergies" hint="Medicines, food or other — e.g. Penicillin (rash)" className="sm:col-span-3">
          <Input id="allergies" name="allergies" defaultValue={values.allergies} />
        </Field>
        <Field label="Long-term conditions" htmlFor="chronicConditions" className="sm:col-span-3">
          <Input id="chronicConditions" name="chronicConditions" defaultValue={values.chronicConditions} />
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Insurance (for cashless claims)</legend>
        {f("insuranceProvider", "Insurer / TPA")}
        {f("insurancePolicyNo", "Policy number")}
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3">
      <Field label="Current password" htmlFor="current" error={fe.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="next" error={fe.next} hint="8+ characters with a letter and a number">
        <Input id="next" name="next" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={fe.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="outline" pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
