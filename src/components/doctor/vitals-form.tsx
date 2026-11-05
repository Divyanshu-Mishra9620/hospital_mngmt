"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { Input, Select } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";

const FIELDS: { name: string; label: string; unit: string; step?: string; placeholder: string }[] = [
  { name: "bpSystolic", label: "BP systolic", unit: "mmHg", placeholder: "120" },
  { name: "bpDiastolic", label: "BP diastolic", unit: "mmHg", placeholder: "80" },
  { name: "pulse", label: "Pulse", unit: "bpm", placeholder: "72" },
  { name: "temperatureF", label: "Temperature", unit: "°F", step: "0.1", placeholder: "98.6" },
  { name: "spo2", label: "SpO₂", unit: "%", placeholder: "98" },
  { name: "respiratoryRate", label: "Resp. rate", unit: "/min", placeholder: "16" },
  { name: "weightKg", label: "Weight", unit: "kg", step: "0.1", placeholder: "70" },
  { name: "heightCm", label: "Height", unit: "cm", step: "0.1", placeholder: "170" },
  { name: "bloodSugar", label: "Blood sugar", unit: "mg/dL", placeholder: "110" },
];

export function VitalsForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {FIELDS.map((f) => (
          <label key={f.name} className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">{f.label}</span>
            <span className="relative block">
              <Input
                name={f.name}
                type="number"
                inputMode="decimal"
                step={f.step ?? "1"}
                placeholder={f.placeholder}
                aria-invalid={!!fe[f.name]}
                className="h-10 pr-14"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">{f.unit}</span>
            </span>
            {fe[f.name] && <span className="mt-1 block text-xs text-danger-700">{fe[f.name]}</span>}
          </label>
        ))}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">Sugar type</span>
          <Select name="sugarType" defaultValue="fasting" className="h-10">
            <option value="fasting">Fasting</option>
            <option value="random">Random</option>
            <option value="pp">Post-prandial</option>
          </Select>
        </label>
      </div>
      <div className="flex justify-end">
        <SubmitButton variant="secondary" size="sm" pendingText="Saving…">
          Save vitals
        </SubmitButton>
      </div>
    </form>
  );
}
