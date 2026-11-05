"use client";

import { useActionState, useRef } from "react";
import { PackagePlus, Save, SlidersHorizontal, Truck } from "lucide-react";
import { addMedicineAction, adjustBatchAction, receiveStockAction, updateMedicineAction } from "@/lib/actions/pharmacy";
import { MEDICINE_FORMS } from "@/db/schema";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { titleCase } from "@/lib/format";
import { BusyButton, useKeepValues } from "./form-bits";

const GST = [0, 5, 12, 18, 28];

export function AddMedicineForm({ categories }: { categories: string[] }) {
  const [state, action, pending] = useActionState(addMedicineAction, null);
  const fe = state?.fieldErrors ?? {};
  const onSubmit = useKeepValues(action, state);
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" htmlFor="name" error={fe.name} required hint="As printed on the pack, with strength">
          <Input id="name" name="name" placeholder="e.g. Cefuroxime 500 mg" aria-invalid={!!fe.name} required />
        </Field>
        <Field label="Generic / salt" htmlFor="genericName" error={fe.genericName} required>
          <Input id="genericName" name="genericName" placeholder="Cefuroxime axetil" aria-invalid={!!fe.genericName} required />
        </Field>
        <Field label="Manufacturer" htmlFor="manufacturer" error={fe.manufacturer} required>
          <Input id="manufacturer" name="manufacturer" aria-invalid={!!fe.manufacturer} required />
        </Field>
        <Field label="Category" htmlFor="category" error={fe.category} required hint="Pick an existing one or type a new category">
          <Input id="category" name="category" list="category-list" aria-invalid={!!fe.category} required />
          <datalist id="category-list">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Dosage form" htmlFor="form" error={fe.form} required>
          <Select id="form" name="form" defaultValue="tablet">
            {MEDICINE_FORMS.map((f) => (
              <option key={f} value={f}>
                {titleCase(f)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Strength" htmlFor="strength" error={fe.strength}>
          <Input id="strength" name="strength" placeholder="500 mg" />
        </Field>
        <Field label="Selling unit" htmlFor="unitLabel" error={fe.unitLabel} required hint="tablet, capsule, 100 ml bottle…">
          <Input id="unitLabel" name="unitLabel" defaultValue="tablet" required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="MRP per unit (₹)" htmlFor="unitPrice" error={fe.unitPrice} required>
          <Input id="unitPrice" name="unitPrice" type="number" min={0} step={0.01} inputMode="decimal" aria-invalid={!!fe.unitPrice} required />
        </Field>
        <Field label="Reorder level (units)" htmlFor="reorderLevel" error={fe.reorderLevel} required>
          <Input id="reorderLevel" name="reorderLevel" type="number" min={0} defaultValue={100} required />
        </Field>
        <Field label="Rack / bin" htmlFor="rack" error={fe.rack}>
          <Input id="rack" name="rack" placeholder="C-4" />
        </Field>
        <Field label="HSN code" htmlFor="hsn" error={fe.hsn}>
          <Input id="hsn" name="hsn" defaultValue="3004" inputMode="numeric" />
        </Field>
        <Field label="GST %" htmlFor="gstPercent" error={fe.gstPercent}>
          <Select id="gstPercent" name="gstPercent" defaultValue="12">
            {GST.map((g) => (
              <option key={g} value={g}>
                {g}%
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end pb-3">
          <Checkbox name="rxRequired" defaultChecked label="Prescription required (Schedule H / H1)" />
        </div>
      </div>
      <BusyButton pending={pending}>
        <PackagePlus aria-hidden /> Add medicine
      </BusyButton>
      <p className="text-xs text-ink-500">New medicines start with zero stock — receive the first batch on the next screen.</p>
    </form>
  );
}

export function EditMedicineForm({
  med,
  categories,
}: {
  med: { id: number; unitPrice: number; reorderLevel: number; rack: string | null; category: string; gstPercent: number; rxRequired: boolean; active: boolean };
  categories: string[];
}) {
  const [state, action] = useActionState(updateMedicineAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={med.id} />
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="MRP per unit (₹)" htmlFor="unitPrice" error={fe.unitPrice}>
          <Input id="unitPrice" name="unitPrice" type="number" min={0} step={0.01} defaultValue={med.unitPrice} required />
        </Field>
        <Field label="Reorder level" htmlFor="reorderLevel" error={fe.reorderLevel}>
          <Input id="reorderLevel" name="reorderLevel" type="number" min={0} defaultValue={med.reorderLevel} required />
        </Field>
        <Field label="Rack / bin" htmlFor="rack" error={fe.rack}>
          <Input id="rack" name="rack" defaultValue={med.rack ?? ""} />
        </Field>
        <Field label="GST %" htmlFor="gstPercent" error={fe.gstPercent}>
          <Select id="gstPercent" name="gstPercent" defaultValue={String(med.gstPercent)}>
            {GST.map((g) => (
              <option key={g} value={g}>
                {g}%
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category" htmlFor="category-edit" error={fe.category} className="sm:col-span-2">
          <Input id="category-edit" name="category" list="category-list-edit" defaultValue={med.category} required />
          <datalist id="category-list-edit">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox name="rxRequired" defaultChecked={med.rxRequired} label="Prescription required" />
        <Checkbox name="active" defaultChecked={med.active} label="Active (available for sale)" />
      </div>
      <SubmitButton size="sm" variant="secondary" pendingText="Saving…">
        <Save aria-hidden /> Save changes
      </SubmitButton>
    </form>
  );
}

export function ReceiveStockForm({ medicineId, unitPrice, minExpiry }: { medicineId: number; unitPrice: number; minExpiry: string }) {
  const [state, action, pending] = useActionState(receiveStockAction, null);
  const fe = state?.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const onSubmit = useKeepValues(action, state, formRef);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="medicineId" value={medicineId} />
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Batch no." htmlFor="batchNo" error={fe.batchNo} required>
          <Input id="batchNo" name="batchNo" autoCapitalize="characters" required />
        </Field>
        <Field label="Expiry date" htmlFor="expiryDate" error={fe.expiryDate} required>
          <Input id="expiryDate" name="expiryDate" type="date" min={minExpiry} required />
        </Field>
        <Field label="Quantity (units)" htmlFor="quantity" error={fe.quantity} required>
          <Input id="quantity" name="quantity" type="number" min={1} required />
        </Field>
        <Field label="Cost price / unit (₹)" htmlFor="costPrice" error={fe.costPrice} hint={`MRP ₹${unitPrice}`} required>
          <Input id="costPrice" name="costPrice" type="number" min={0} step={0.01} defaultValue={Math.round(unitPrice * 72) / 100} required />
        </Field>
        <Field label="Supplier" htmlFor="supplier" error={fe.supplier} required>
          <Input id="supplier" name="supplier" list="supplier-list" required />
          <datalist id="supplier-list">
            {["Karnataka Medical Distributors", "Southern Pharma Agencies", "Apex Healthcare Supplies", "Shree Balaji Pharma Traders"].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Purchase invoice no." htmlFor="invoiceNo" error={fe.invoiceNo} required>
          <Input id="invoiceNo" name="invoiceNo" required />
        </Field>
      </div>
      <BusyButton pending={pending} pendingText="Receiving…">
        <Truck aria-hidden /> Receive stock
      </BusyButton>
    </form>
  );
}

export function AdjustBatchForm({ batches }: { batches: { id: number; batchNo: string; quantity: number; expiryDate: string }[] }) {
  const [state, action, pending] = useActionState(adjustBatchAction, null);
  const fe = state?.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const onSubmit = useKeepValues(action, state, formRef);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Batch" htmlFor="batchId" error={fe.batchId} className="sm:col-span-1">
          <Select id="batchId" name="batchId" defaultValue="" required>
            <option value="" disabled>
              Choose batch
            </option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batchNo} · {b.quantity} units · exp {b.expiryDate}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reason type" htmlFor="type">
          <Select id="type" name="type" defaultValue="adjustment">
            <option value="adjustment">Count correction</option>
            <option value="expired">Expired / damaged write-off</option>
            <option value="return">Return (to supplier / from customer)</option>
          </Select>
        </Field>
        <Field label="Change (+/− units)" htmlFor="delta" error={fe.delta} hint="Negative reduces stock">
          <Input id="delta" name="delta" type="number" step={1} placeholder="-5" required />
        </Field>
      </div>
      <Field label="Note" htmlFor="note" error={fe.note} required>
        <Textarea id="note" name="note" rows={2} placeholder="e.g. Physical count on rack C-4 found 5 strips short" required />
      </Field>
      <BusyButton pending={pending} variant="outline">
        <SlidersHorizontal aria-hidden /> Record adjustment
      </BusyButton>
    </form>
  );
}
