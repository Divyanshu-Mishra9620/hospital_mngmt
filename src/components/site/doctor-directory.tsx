"use client";

import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { DoctorCard } from "@/components/site/doctor-card";
import type { PublicDoctor } from "@/lib/queries/public";
import { cn } from "@/lib/cn";
import { useCenterActive } from "@/lib/use-center-active";

type Filters = { q: string; dept: string; video: boolean };

/** Writes filters to the URL without a navigation, so refresh/share keeps them. */
function syncUrl(path: string, f: Filters) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.dept) p.set("dept", f.dept);
  if (f.video) p.set("video", "1");
  const qs = p.toString();
  window.history.replaceState(null, "", `${path}${qs ? `?${qs}` : ""}`);
}

/**
 * Find-a-doctor list with instant, client-side filtering by speciality,
 * video availability and free text. No page reload, no scroll jump.
 */
export function DoctorDirectory({
  doctors,
  depts,
  initial,
}: {
  doctors: PublicDoctor[];
  depts: { slug: string; label: string }[];
  initial: Filters;
}) {
  const [f, setF] = useState<Filters>(initial);
  const chipRow = useRef<HTMLDivElement>(null);
  useCenterActive(chipRow, f.dept);
  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    setF(next);
    syncUrl("/doctors", next);
  };

  const q = f.q.toLowerCase().trim();
  const list = useMemo(
    () =>
      doctors.filter(
        (d) =>
          (!f.dept || d.deptSlug === f.dept) &&
          (!f.video || d.doctor.videoEnabled) &&
          (!q || `${d.name} ${d.deptName} ${d.doctor.expertise} ${d.doctor.designation} ${d.doctor.languages}`.toLowerCase().includes(q)),
      ),
    [doctors, f.dept, f.video, q],
  );
  const countFor = (slug: string) => doctors.filter((d) => d.deptSlug === slug && (!f.video || d.doctor.videoEnabled)).length;

  return (
    <div>
      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          type="search"
          value={f.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="Search by name, speciality, condition or language"
          aria-label="Search doctors"
          className="h-12 w-full rounded-2xl border border-line bg-white pl-12 pr-11 text-[0.9375rem] shadow-soft outline-none placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
        />
        {f.q && (
          <button type="button" onClick={() => update({ q: "" })} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-400 hover:bg-surface hover:text-ink-700" aria-label="Clear search">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div ref={chipRow} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="Filter by speciality">
          <button
            type="button"
            onClick={() => update({ dept: "" })}
            aria-pressed={!f.dept}
            className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", !f.dept ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-ink-600 hover:border-brand-200")}
          >
            All
          </button>
          {depts.map((d) => {
            const n = countFor(d.slug);
            const on = f.dept === d.slug;
            return (
              <button
                key={d.slug}
                type="button"
                onClick={() => update({ dept: on ? "" : d.slug })}
                aria-pressed={on}
                disabled={n === 0}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-40",
                  on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-ink-600 hover:border-brand-200",
                )}
              >
                {d.label} <span className="tabular text-ink-400">{n}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => update({ video: !f.video })}
          aria-pressed={f.video}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            f.video ? "border-violet-700 bg-violet-50 text-violet-700" : "border-line bg-white text-ink-600",
          )}
        >
          <span className={cn("size-3.5 rounded-full border-2 transition-colors", f.video ? "border-violet-700 bg-violet-700" : "border-ink-300")} aria-hidden /> Offers video consult
        </button>
      </div>

      <p className="mt-6 text-sm text-ink-500" aria-live="polite">
        Showing {list.length} doctor{list.length === 1 ? "" : "s"}
        {q && <> for “{f.q.trim()}”</>}
      </p>
      {list.length ? (
        <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => (
            <li key={d.doctor.code}>
              <DoctorCard d={d} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-line-strong p-10 text-center">
          <p className="font-semibold text-ink-800">No doctors match your search</p>
          <button type="button" onClick={() => update({ q: "", dept: "", video: false })} className="mt-2 text-sm font-semibold text-brand-700">
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
