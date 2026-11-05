"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, ReceiptText, Search, Trash2 } from "lucide-react";
import { createDispenseAction } from "@/lib/actions/pharmacy";
import { Field, Input } from "@/components/ui/form";
import { EmptyState, FormMessage } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BusyButton, PaymentMethodPicker, QtyStepper, money2, useKeepValues } from "./form-bits";

export type OtcItem = { id: number; sku: string; name: string; unitLabel: string; unitPrice: number; category: string; sellable: number };

export function OtcSaleForm({ catalogue }: { catalogue: OtcItem[] }) {
  const [state, action, pending] = useActionState(createDispenseAction, null);
  const onSubmit = useKeepValues(action, state);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<{ id: number; qty: number }[]>([]);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState("cash");
  const byId = useMemo(() => new Map(catalogue.map((c) => [c.id, c])), [catalogue]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? catalogue.filter((c) => `${c.name} ${c.sku} ${c.category}`.toLowerCase().includes(q)) : catalogue;
    return list.slice(0, q ? 12 : 8);
  }, [catalogue, query]);

  const lines = cart.map((c) => {
    const item = byId.get(c.id)!;
    return { ...item, qty: c.qty, lineTotal: c.qty * item.unitPrice, over: c.qty > item.sellable };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const disc = Math.round(((subtotal * (Number(discount) || 0)) / 100) * 100) / 100;
  const hasErrors = lines.some((l) => l.over);

  function add(id: number) {
    setCart((c) => (c.some((x) => x.id === id) ? c.map((x) => (x.id === id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { id, qty: 1 }]));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <input type="hidden" name="lines" value={JSON.stringify(cart.map((c) => ({ medicineId: c.id, quantity: c.qty })))} />
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
          <label htmlFor="otc-search" className="mb-1.5 block text-sm font-medium text-ink-800">
            Add over-the-counter items
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <Input id="otc-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search paracetamol, ORS, sanitiser…" className="pl-10" autoComplete="off" />
          </div>
          <p className="mt-1.5 text-xs text-ink-500">Prescription-only medicines are hidden here — dispense them against a prescription.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => add(m.id)}
                  disabled={m.sellable <= 0}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-900">{m.name}</span>
                    <span className="tabular block text-xs text-ink-500">
                      {money2(m.unitPrice)} / {m.unitLabel} · {m.sellable > 0 ? `${m.sellable} in stock` : "out of stock"}
                    </span>
                  </span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Plus className="size-4" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {matches.length === 0 && <p className="mt-3 text-sm text-ink-500">No OTC item matches “{query}”.</p>}
        </div>

        <div className="rounded-2xl border border-line bg-white shadow-card">
          <p className="border-b border-line px-4 py-3 text-[0.9375rem] font-semibold text-ink-900 sm:px-5">Bill items</p>
          {lines.length === 0 ? (
            <EmptyState icon={<ReceiptText />} title="No items yet" description="Tap an item above to add it to this bill." />
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">{l.name}</p>
                    <p className={cn("tabular text-xs", l.over ? "font-semibold text-danger-700" : "text-ink-500")}>
                      {money2(l.unitPrice)} / {l.unitLabel} · {l.over ? `only ${l.sellable} in stock` : `${l.sellable} in stock`}
                    </p>
                  </div>
                  <QtyStepper label={l.name} value={l.qty} invalid={l.over} onChange={(qty) => setCart((c) => c.map((x) => (x.id === l.id ? { ...x, qty } : x)))} />
                  <p className="tabular w-24 text-right text-sm font-semibold text-ink-900">{money2(l.lineTotal)}</p>
                  <Button variant="ghost" size="xs" onClick={() => setCart((c) => c.filter((x) => x.id !== l.id))} aria-label={`Remove ${l.name}`}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="space-y-4 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
          <FormMessage state={state} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Field label="Customer name" htmlFor="customerName">
              <Input id="customerName" name="customerName" placeholder="Walk-in customer" autoComplete="off" />
            </Field>
            <Field label="Mobile" htmlFor="customerPhone">
              <Input id="customerPhone" name="customerPhone" type="tel" inputMode="tel" autoComplete="off" />
            </Field>
          </div>
          <Field label="UHID (optional)" htmlFor="uhid" hint="Links the bill to the patient's record" error={state?.fieldErrors?.uhid}>
            <Input id="uhid" name="uhid" placeholder="MDR-100101" autoCapitalize="characters" autoComplete="off" />
          </Field>
          <Field label="Discount %" htmlFor="discountPercent">
            <Input id="discountPercent" name="discountPercent" type="number" min={0} max={30} step={0.5} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </Field>
          <PaymentMethodPicker value={method} onChange={setMethod} />
          <div className="rounded-xl bg-brand-950 px-4 py-3.5 text-white">
            <div className="flex justify-between text-sm text-brand-200">
              <span>Subtotal</span>
              <span className="tabular">{money2(subtotal)}</span>
            </div>
            {disc > 0 && (
              <div className="flex justify-between text-sm text-brand-200">
                <span>Discount</span>
                <span className="tabular">− {money2(disc)}</span>
              </div>
            )}
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-semibold">Amount payable</span>
              <span className="tabular font-display text-2xl font-bold">{money2(subtotal - disc)}</span>
            </div>
          </div>
          <BusyButton block size="lg" pending={pending} disabled={lines.length === 0 || hasErrors} pendingText="Saving bill…">
            <ReceiptText aria-hidden /> Generate bill
          </BusyButton>
        </div>
      </div>
    </form>
  );
}
