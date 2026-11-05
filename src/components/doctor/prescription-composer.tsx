"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarPlus, FlaskConical, Pill, Plus, Repeat, Salad, Stethoscope, Trash2, X } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { COMMON_LAB_TESTS, DIET_TYPES, FREQUENCIES, MEAL_SLOTS, TIMINGS, type MealKey, type Meals } from "@/lib/constants";
import { DIET_TEMPLATES } from "@/lib/doctor/diet-templates";
import { suggestQuantity } from "@/lib/doctor/quantity";
import { addDays } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { MedicinePicker, type MedicineOption, type PickedMedicine } from "./medicine-picker";

type DietType = (typeof DIET_TYPES)[number];

type Item = {
  key: string;
  medicine: PickedMedicine;
  dosage: string;
  frequency: string;
  timing: string;
  durationDays: number;
  quantity: number;
  qtyTouched: boolean;
  instructions: string;
};

type CarePlanState = {
  enabled: boolean;
  dietType: DietType;
  calories: string;
  meals: Meals;
  include: string;
  avoid: string;
  hydration: string;
  exercise: string;
  lifestyle: string;
  sleep: string;
};

export type RepeatSource = {
  code: string;
  createdAt: string;
  diagnosis: string;
  items: { medicineId: number | null; medicineName: string; dosage: string | null; frequency: string; timing: string | null; durationDays: number; quantity: number; instructions: string | null }[];
};

let keySeq = 0;
const nextKey = () => `it-${++keySeq}`;

function blankItem(): Item {
  return {
    key: nextKey(),
    medicine: { medicineId: null, name: "", form: null, strength: null },
    dosage: "",
    frequency: "1-0-1",
    timing: "After food",
    durationDays: 5,
    quantity: 10,
    qtyTouched: false,
    instructions: "",
  };
}

function planFrom(dietType: DietType, enabled = true): CarePlanState {
  const t = DIET_TEMPLATES[dietType];
  return {
    enabled,
    dietType,
    calories: t.calories ? String(t.calories) : "",
    meals: { ...t.meals },
    include: t.include,
    avoid: t.avoid,
    hydration: t.hydration,
    exercise: t.exercise,
    lifestyle: t.lifestyle,
    sleep: t.sleep,
  };
}

/**
 * Prescription + diet plan composer used in the consultation workspace.
 * Everything is kept in state and posted as one JSON payload.
 */
export function PrescriptionComposer({
  action,
  medicines,
  defaultComplaint,
  defaultDiet,
  appointmentDate,
  repeatFrom,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  medicines: MedicineOption[];
  defaultComplaint: string;
  defaultDiet: DietType;
  appointmentDate: string;
  repeatFrom: RepeatSource | null;
}) {
  const [state, formAction] = useActionState(action, null);
  const [complaints, setComplaints] = useState(defaultComplaint);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [tests, setTests] = useState<string[]>([]);
  const [customTest, setCustomTest] = useState("");
  const [advice, setAdvice] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [plan, setPlan] = useState<CarePlanState>(() => planFrom(defaultDiet));

  const medById = useMemo(() => new Map(medicines.map((m) => [m.id, m])), [medicines]);

  function update(key: string, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, ...patch };
        if (!next.qtyTouched && ("frequency" in patch || "durationDays" in patch || "medicine" in patch)) {
          next.quantity = suggestQuantity(next.frequency, next.durationDays, next.medicine.form);
        }
        return next;
      }),
    );
  }

  function repeatLast() {
    if (!repeatFrom) return;
    setItems((prev) => [
      ...prev.filter((p) => p.medicine.name.trim()),
      ...repeatFrom.items.map((r) => {
        const m = r.medicineId != null ? medById.get(r.medicineId) : undefined;
        return {
          key: nextKey(),
          medicine: { medicineId: m ? m.id : null, name: m ? m.name : r.medicineName, form: m?.form ?? null, strength: m?.strength ?? null },
          dosage: r.dosage ?? "",
          frequency: r.frequency,
          timing: r.timing ?? "",
          durationDays: r.durationDays,
          quantity: r.quantity,
          qtyTouched: true,
          instructions: r.instructions ?? "",
        };
      }),
    ]);
  }

  function toggleTest(t: string) {
    setTests((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }
  function addCustomTest() {
    const t = customTest.trim();
    if (t.length >= 2 && !tests.includes(t)) setTests((prev) => [...prev, t]);
    setCustomTest("");
  }

  const payload = JSON.stringify({
    chiefComplaints: complaints,
    diagnosis,
    clinicalNotes: notes,
    advice,
    followUpDate: followUp,
    labTests: tests,
    items: items
      .filter((i) => i.medicine.name.trim())
      .map((i) => ({
        medicineId: i.medicine.medicineId,
        medicineName: i.medicine.name.trim(),
        dosage: i.dosage,
        frequency: i.frequency,
        timing: i.timing,
        durationDays: Number(i.durationDays) || 0,
        quantity: Number(i.quantity) || 0,
        instructions: i.instructions,
      })),
    carePlan: plan.enabled
      ? {
          dietType: plan.dietType,
          calories: plan.calories ? Number(plan.calories) : null,
          meals: plan.meals,
          include: plan.include,
          avoid: plan.avoid,
          hydration: plan.hydration,
          exercise: plan.exercise,
          lifestyle: plan.lifestyle,
          sleep: plan.sleep,
        }
      : null,
  });

  const medCount = items.filter((i) => i.medicine.name.trim()).length;
  const outOfStock = items.filter((i) => i.medicine.medicineId != null && (medById.get(i.medicine.medicineId)?.stock ?? 0) <= 0);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="payload" value={payload} />
      <FormMessage state={state} />

      {/* Clinical */}
      <Card>
        <CardHeader title="Clinical assessment" icon={<Stethoscope />} />
        <CardBody className="grid gap-4">
          <Field label="Chief complaints" htmlFor="rx-complaints">
            <Textarea id="rx-complaints" rows={2} value={complaints} onChange={(e) => setComplaints(e.target.value)} placeholder="e.g. Fever with sore throat for 3 days" />
          </Field>
          <Field label="Diagnosis" htmlFor="rx-diagnosis" required error={fe.diagnosis}>
            <Input id="rx-diagnosis" required value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Acute pharyngitis" aria-invalid={!!fe.diagnosis} />
          </Field>
          <Field label="Clinical notes" htmlFor="rx-notes" hint="Examination findings — visible on the printed prescription.">
            <Textarea id="rx-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </CardBody>
      </Card>

      {/* Medicines */}
      <Card>
        <CardHeader
          title="Medicines"
          description="Search the hospital pharmacy — stocked medicines can be ordered by the patient from their portal."
          icon={<Pill />}
          action={
            repeatFrom ? (
              <Button variant="outline" size="xs" onClick={repeatLast} title={`Copy medicines from ${repeatFrom.code}`}>
                <Repeat /> Repeat last Rx
              </Button>
            ) : null
          }
        />
        <CardBody className="space-y-3">
          {items.length === 0 && <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-500">No medicines added yet.</p>}
          {items.map((it, idx) => (
            <div key={it.key} className="rounded-xl border border-line bg-surface/40 p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <span className="mt-2.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{idx + 1}</span>
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <MedicinePicker options={medicines} value={it.medicine} onChange={(m) => update(it.key, { medicine: m, dosage: m.strength ?? it.dosage })} />
                  <Input aria-label="Dosage / strength" placeholder="Dose, e.g. 500 mg" value={it.dosage} onChange={(e) => update(it.key, { dosage: e.target.value })} />
                </div>
                <button type="button" onClick={() => setItems((p) => p.filter((x) => x.key !== it.key))} className="mt-1.5 rounded-lg p-2 text-ink-400 hover:bg-danger-50 hover:text-danger-700" aria-label={`Remove medicine ${idx + 1}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:ml-8 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)]">
                <div className="col-span-2 sm:col-span-1">
                  <Select aria-label="Frequency" value={it.frequency} onChange={(e) => update(it.key, { frequency: e.target.value })}>
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Select aria-label="When to take" value={it.timing} onChange={(e) => update(it.key, { timing: e.target.value })}>
                    <option value="">Timing…</option>
                    {TIMINGS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                <label className="relative block">
                  <span className="sr-only">Duration in days</span>
                  <Input type="number" min={1} max={365} value={it.durationDays} onChange={(e) => update(it.key, { durationDays: Number(e.target.value) })} className="pr-12" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">days</span>
                </label>
                <label className="relative block">
                  <span className="sr-only">Quantity</span>
                  <Input type="number" min={1} max={2000} value={it.quantity} onChange={(e) => update(it.key, { quantity: Number(e.target.value), qtyTouched: true })} className="pr-10" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">qty</span>
                </label>
              </div>
              <div className="mt-3 sm:ml-8">
                <Input aria-label="Instructions" placeholder="Instructions (optional), e.g. Stop if rash appears" value={it.instructions} onChange={(e) => update(it.key, { instructions: e.target.value })} />
              </div>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setItems((p) => [...p, blankItem()])}>
            <Plus /> Add medicine
          </Button>
          {outOfStock.length > 0 && (
            <p className="text-sm text-warning-700">
              {outOfStock.map((o) => o.medicine.name).join(", ")} {outOfStock.length === 1 ? "is" : "are"} currently out of stock at the hospital pharmacy.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Investigations */}
      <Card>
        <CardHeader title="Investigations" description={tests.length ? `${tests.length} selected` : "Tap to add lab tests and imaging"} icon={<FlaskConical />} />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {[...COMMON_LAB_TESTS, ...tests.filter((t) => !(COMMON_LAB_TESTS as readonly string[]).includes(t))].map((t) => {
              const on = tests.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTest(t)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition",
                    on ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong bg-white text-ink-700 hover:border-brand-300",
                  )}
                >
                  {on && <span aria-hidden>✓ </span>}
                  {t}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={customTest}
              onChange={(e) => setCustomTest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTest();
                }
              }}
              placeholder="Other test, e.g. MRI Lumbar spine"
              aria-label="Add another test"
            />
            <Button variant="outline" onClick={addCustomTest}>
              Add
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Advice */}
      <Card>
        <CardHeader title="Advice & follow-up" icon={<CalendarPlus />} />
        <CardBody className="grid gap-4">
          <Field label="Advice to patient" htmlFor="rx-advice">
            <Textarea id="rx-advice" rows={3} value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder="Rest, fluids, warning signs to watch for…" />
          </Field>
          <Field label="Follow-up date" htmlFor="rx-followup" error={fe.followUpDate}>
            <div className="flex flex-wrap items-center gap-2">
              <Input id="rx-followup" type="date" min={addDays(appointmentDate, 1)} value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="w-auto" />
              {[
                { l: "1 week", d: 7 },
                { l: "2 weeks", d: 14 },
                { l: "1 month", d: 30 },
                { l: "3 months", d: 90 },
              ].map((q) => (
                <Button key={q.d} variant="ghost" size="xs" onClick={() => setFollowUp(addDays(appointmentDate, q.d))}>
                  +{q.l}
                </Button>
              ))}
              {followUp && (
                <Button variant="ghost" size="xs" onClick={() => setFollowUp("")} aria-label="Clear follow-up">
                  <X />
                </Button>
              )}
            </div>
          </Field>
        </CardBody>
      </Card>

      {/* Diet & lifestyle */}
      <Card>
        <CardHeader
          title="Diet & lifestyle plan"
          description="Shared with the patient in their portal under “Diet & lifestyle”."
          icon={<Salad />}
          action={<Checkbox label="Include" checked={plan.enabled} onChange={(e) => setPlan((p) => ({ ...p, enabled: e.target.checked }))} />}
        />
        {plan.enabled && (
          <CardBody className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Field label="Diet type" htmlFor="plan-type" hint="Changing the type reloads its template below.">
                <Select id="plan-type" value={plan.dietType} onChange={(e) => setPlan(planFrom(e.target.value as DietType))}>
                  {DIET_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Calories / day" htmlFor="plan-cal" hint="Optional">
                <Input id="plan-cal" type="number" min={800} max={5000} step={50} value={plan.calories} onChange={(e) => setPlan((p) => ({ ...p, calories: e.target.value }))} placeholder="e.g. 1800" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {MEAL_SLOTS.map((m) => (
                <Field key={m.key} label={`${m.label} · ${m.time}`} htmlFor={`meal-${m.key}`}>
                  <Textarea
                    id={`meal-${m.key}`}
                    rows={2}
                    value={plan.meals[m.key as MealKey] ?? ""}
                    onChange={(e) => setPlan((p) => ({ ...p, meals: { ...p.meals, [m.key]: e.target.value } }))}
                  />
                </Field>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Foods to include" htmlFor="plan-include">
                <Textarea id="plan-include" rows={3} value={plan.include} onChange={(e) => setPlan((p) => ({ ...p, include: e.target.value }))} />
              </Field>
              <Field label="Foods to avoid" htmlFor="plan-avoid">
                <Textarea id="plan-avoid" rows={3} value={plan.avoid} onChange={(e) => setPlan((p) => ({ ...p, avoid: e.target.value }))} />
              </Field>
              <Field label="Hydration" htmlFor="plan-hyd">
                <Textarea id="plan-hyd" rows={2} value={plan.hydration} onChange={(e) => setPlan((p) => ({ ...p, hydration: e.target.value }))} />
              </Field>
              <Field label="Exercise" htmlFor="plan-ex">
                <Textarea id="plan-ex" rows={2} value={plan.exercise} onChange={(e) => setPlan((p) => ({ ...p, exercise: e.target.value }))} />
              </Field>
              <Field label="Lifestyle" htmlFor="plan-life">
                <Textarea id="plan-life" rows={2} value={plan.lifestyle} onChange={(e) => setPlan((p) => ({ ...p, lifestyle: e.target.value }))} />
              </Field>
              <Field label="Sleep" htmlFor="plan-sleep">
                <Textarea id="plan-sleep" rows={2} value={plan.sleep} onChange={(e) => setPlan((p) => ({ ...p, sleep: e.target.value }))} />
              </Field>
            </div>
          </CardBody>
        )}
      </Card>

      {/* Submit bar */}
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-lift backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-ink-900">{medCount}</span> medicine{medCount === 1 ? "" : "s"} · <span className="font-semibold text-ink-900">{tests.length}</span> test
          {tests.length === 1 ? "" : "s"} · {plan.enabled ? "diet plan included" : "no diet plan"}
          {followUp ? " · follow-up set" : ""}
        </p>
        <SubmitButton pendingText="Issuing prescription…" disabled={!diagnosis.trim()}>
          Issue prescription & complete visit
        </SubmitButton>
      </div>
    </form>
  );
}
