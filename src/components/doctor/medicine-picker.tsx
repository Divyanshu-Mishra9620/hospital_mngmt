"use client";

import { useId, useMemo, useRef, useState } from "react";
import { PackageX, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type MedicineOption = {
  id: number;
  name: string;
  genericName: string;
  strength: string | null;
  form: string;
  stock: number;
  reorderLevel: number;
  unitLabel: string;
  unitPrice: number;
};

export type PickedMedicine = { medicineId: number | null; name: string; form: string | null; strength: string | null };

/**
 * Searchable combobox over the hospital pharmacy catalogue. Typing a name that
 * isn't stocked lets the doctor prescribe it as free text (medicineId = null).
 */
export function MedicinePicker({
  options,
  value,
  onChange,
  invalid,
}: {
  options: MedicineOption[];
  value: PickedMedicine;
  onChange: (v: PickedMedicine) => void;
  invalid?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = value.name.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return options.slice(0, 8);
    const words = query.split(/\s+/);
    return options
      .filter((o) => {
        const hay = `${o.name} ${o.genericName}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(query)) - Number(a.name.toLowerCase().startsWith(query)))
      .slice(0, 8);
  }, [options, query]);

  const exact = options.some((o) => o.name.toLowerCase() === query);
  const showFree = query.length >= 3 && !exact;
  const total = matches.length + (showFree ? 1 : 0);

  function pick(o: MedicineOption) {
    onChange({ medicineId: o.id, name: o.name, form: o.form, strength: o.strength });
    setOpen(false);
  }
  function pickFree() {
    onChange({ medicineId: null, name: value.name.trim(), form: null, strength: null });
    setOpen(false);
  }

  const selected = value.medicineId != null ? options.find((o) => o.id === value.medicineId) : null;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-invalid={invalid}
        value={value.name}
        placeholder="Search medicine or generic name"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          onChange({ medicineId: null, name: e.target.value, form: null, strength: null });
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(total - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && open && total) {
            e.preventDefault();
            if (active < matches.length) pick(matches[active]);
            else pickFree();
          } else if (e.key === "Escape") setOpen(false);
        }}
        className={cn(
          "block h-11 w-full rounded-xl border border-line-strong bg-white pl-9 pr-3 text-[0.9375rem] text-ink-900 placeholder:text-ink-400",
          "focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 aria-[invalid=true]:border-danger-600",
          value.medicineId != null && "font-semibold",
        )}
      />
      {selected && (
        <p className="mt-1 text-xs text-ink-500">
          {selected.genericName} ·{" "}
          <span className={cn(selected.stock <= 0 ? "text-danger-700" : selected.stock <= selected.reorderLevel ? "text-warning-700" : "text-success-700")}>
            {selected.stock <= 0 ? "Out of stock" : `${selected.stock} in stock`}
          </span>{" "}
          · ₹{selected.unitPrice}/{selected.unitLabel}
        </p>
      )}
      {value.medicineId == null && value.name.trim().length >= 3 && !open && (
        <p className="mt-1 flex items-center gap-1 text-xs text-warning-700">
          <PackageX className="size-3" /> Not from hospital pharmacy — patient will buy outside
        </p>
      )}
      {open && total > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-12 z-30 max-h-80 overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lift"
        >
          {matches.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-start justify-between gap-3 px-3 py-2", i === active && "bg-brand-50")}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink-900">{o.name}</span>
                <span className="block truncate text-xs text-ink-500">
                  {o.genericName} · {o.form}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs">
                <span className={cn("block font-semibold", o.stock <= 0 ? "text-danger-700" : o.stock <= o.reorderLevel ? "text-warning-700" : "text-success-700")}>
                  {o.stock <= 0 ? "Out of stock" : `${o.stock} left`}
                </span>
                <span className="text-ink-400">
                  ₹{o.unitPrice}/{o.unitLabel}
                </span>
              </span>
            </li>
          ))}
          {showFree && (
            <li
              role="option"
              aria-selected={active === matches.length}
              onMouseDown={(e) => {
                e.preventDefault();
                pickFree();
              }}
              onMouseEnter={() => setActive(matches.length)}
              className={cn("cursor-pointer border-t border-line px-3 py-2 text-sm", active === matches.length && "bg-brand-50")}
            >
              Prescribe <span className="font-semibold">“{value.name.trim()}”</span> <span className="text-ink-500">(not stocked here)</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
