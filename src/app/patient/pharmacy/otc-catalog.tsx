"use client";

import { useMemo, useRef, useState } from "react";
import { Package, Search, X } from "lucide-react";
import { inr } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCenterActive } from "@/lib/use-center-active";
import { AddOtcButton } from "./add-otc";

export type OtcItem = { id: number; name: string; genericName: string; category: string; unitPrice: number; unitLabel: string; stock: number };

/** Over-the-counter catalogue with instant search and category filter. */
export function OtcCatalog({ items, initial }: { items: OtcItem[]; initial: { q: string; cat: string } }) {
  const [q, setQ] = useState(initial.q);
  const [cat, setCat] = useState(initial.cat);
  const chipRow = useRef<HTMLDivElement>(null);
  useCenterActive(chipRow, cat);
  const cats = useMemo(() => [...new Set(items.map((m) => m.category))], [items]);
  const needle = q.toLowerCase().trim();
  const shown = items.filter((m) => (!cat || m.category === cat) && (!needle || `${m.name} ${m.genericName} ${m.category}`.toLowerCase().includes(needle)));

  function sync(nq: string, ncat: string) {
    const p = new URLSearchParams();
    if (nq.trim()) p.set("q", nq.trim());
    if (ncat) p.set("cat", ncat);
    window.history.replaceState(null, "", `/patient/pharmacy${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            sync(e.target.value, cat);
          }}
          placeholder="Search products"
          aria-label="Search products"
          className="block h-11 w-full rounded-xl border border-line-strong bg-white pl-10 pr-10 text-[0.9375rem] placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              sync("", cat);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-400 hover:text-ink-700"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div ref={chipRow} className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
        {["", ...cats].map((c) => (
          <button
            key={c || "all"}
            type="button"
            aria-pressed={cat === c}
            onClick={() => {
              setCat(c);
              sync(q, c);
            }}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              cat === c ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-ink-600 hover:border-brand-200",
            )}
          >
            {c || "All"}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-white p-8 text-center text-sm text-ink-500">No products found</div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((m) => (
            <li key={m.id} className="flex flex-col rounded-2xl border border-line bg-white p-3.5 shadow-card">
              <div className="grid aspect-[4/3] place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-surface text-brand-600">
                <Package className="size-8" aria-hidden />
              </div>
              <p className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-ink-900">{m.name}</p>
              <p className="line-clamp-1 text-xs text-ink-500">{m.genericName}</p>
              <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                <div>
                  <p className="tabular font-display text-base font-bold text-ink-900">{inr(m.unitPrice, { paise: m.unitPrice < 50 })}</p>
                  <p className="text-[0.6875rem] text-ink-500">per {m.unitLabel}</p>
                </div>
                {m.stock > 0 ? <AddOtcButton medicineId={m.id} /> : <span className="text-xs font-semibold text-danger-600">Out of stock</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
