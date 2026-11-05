"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Building2, Search, Video, X } from "lucide-react";
import { Avatar, Stars } from "@/components/ui/misc";
import { inr } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCenterActive } from "@/lib/use-center-active";

export type PickerDoctor = {
  id: number;
  code: string;
  name: string;
  designation: string;
  deptSlug: string;
  deptName: string;
  experience: number;
  expertise: string;
  color: string;
  inPersonFee: number;
  videoFee: number;
  videoEnabled: boolean;
  rating: number;
  ratingCount: number;
  /** Pre-formatted next free slot per mode, e.g. "Today, 4:15 PM" */
  nextInPerson: string | null;
  nextVideo: string | null;
};

type Mode = "" | "in_person" | "video";
type Filters = { q: string; dept: string; mode: Mode };

function syncUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.dept) p.set("dept", f.dept);
  if (f.mode) p.set("mode", f.mode);
  const qs = p.toString();
  window.history.replaceState(null, "", `/patient/book${qs ? `?${qs}` : ""}`);
}

/**
 * Step 1 of booking: choose a doctor. Filtering is instant and client-side —
 * no reload, the list just updates where you are.
 */
export function DoctorPicker({ doctors, depts, initial }: { doctors: PickerDoctor[]; depts: { slug: string; label: string }[]; initial: Filters }) {
  const [f, setF] = useState<Filters>(initial);
  const chipRow = useRef<HTMLDivElement>(null);
  useCenterActive(chipRow, f.dept);
  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    setF(next);
    syncUrl(next);
  };

  const q = f.q.toLowerCase().trim();
  const list = useMemo(
    () =>
      doctors.filter(
        (d) =>
          (!f.dept || d.deptSlug === f.dept) &&
          (f.mode !== "video" || d.videoEnabled) &&
          (!q || `${d.name} ${d.deptName} ${d.expertise} ${d.designation}`.toLowerCase().includes(q)),
      ),
    [doctors, f.dept, f.mode, q],
  );
  const available = new Set(doctors.filter((d) => f.mode !== "video" || d.videoEnabled).map((d) => d.deptSlug));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          type="search"
          value={f.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="Search doctor, speciality or condition"
          aria-label="Search doctors"
          className="block h-11 w-full rounded-xl border border-line-strong bg-white pl-10 pr-10 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
        />
        {f.q && (
          <button type="button" onClick={() => update({ q: "" })} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-400 hover:text-ink-700" aria-label="Clear search">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 rounded-xl bg-white p-1 shadow-card ring-1 ring-line" role="group" aria-label="Consultation type">
        {(
          [
            { m: "", label: "All" },
            { m: "in_person", label: "In-person" },
            { m: "video", label: "Video" },
          ] as const
        ).map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => update({ mode: o.m, dept: o.m === "video" && f.dept && !doctors.some((d) => d.deptSlug === f.dept && d.videoEnabled) ? "" : f.dept })}
            aria-pressed={f.mode === o.m}
            className={cn("rounded-lg py-2 text-center text-sm font-semibold transition-colors", f.mode === o.m ? "bg-brand-600 text-white" : "text-ink-600 hover:text-ink-900")}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div ref={chipRow} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Speciality">
        <button
          type="button"
          onClick={() => update({ dept: "" })}
          aria-pressed={!f.dept}
          className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", !f.dept ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-ink-600")}
        >
          All specialities
        </button>
        {depts
          .filter((d) => available.has(d.slug))
          .map((d) => {
            const on = f.dept === d.slug;
            return (
              <button
                key={d.slug}
                type="button"
                onClick={() => update({ dept: on ? "" : d.slug })}
                aria-pressed={on}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-ink-600 hover:border-brand-200",
                )}
              >
                {d.label}
              </button>
            );
          })}
      </div>

      <p className="text-xs text-ink-500" aria-live="polite">
        {list.length} doctor{list.length === 1 ? "" : "s"}
        {f.mode === "video" ? " offering video consults" : ""}
      </p>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-white p-8 text-center">
          <p className="font-semibold text-ink-800">No doctors match</p>
          <button type="button" onClick={() => update({ q: "", dept: "", mode: "" })} className="mt-1 text-sm font-semibold text-brand-700">
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((d) => {
            const mode = f.mode || "in_person";
            const next = mode === "video" ? d.nextVideo : d.nextInPerson;
            return (
              <li key={d.id}>
                <Link
                  href={`/patient/book?doctor=${d.code}&mode=${mode}`}
                  className="flex h-full flex-col rounded-2xl border border-line bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-soft active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={d.name} color={d.color} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink-900">{d.name}</p>
                      <p className="line-clamp-1 text-[0.8125rem] text-ink-600">{d.designation}</p>
                      <p className="text-xs text-ink-500">
                        {d.deptName} · {d.experience}+ yrs
                      </p>
                      {d.ratingCount > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
                          <Stars value={d.rating} /> {d.rating.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs">
                    <span className={cn("rounded-md px-2 py-1 font-semibold", f.mode === "video" ? "bg-surface text-ink-400" : "bg-surface text-ink-700")}>
                      <Building2 className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
                      {inr(d.inPersonFee)}
                    </span>
                    {d.videoEnabled && (
                      <span className={cn("rounded-md px-2 py-1 font-semibold", f.mode === "in_person" ? "bg-surface text-ink-400" : "bg-violet-50 text-violet-700")}>
                        <Video className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
                        {inr(d.videoFee)}
                      </span>
                    )}
                    <span className="ml-auto text-ink-500">
                      {next ? (
                        <>
                          Next: <span className="font-semibold text-success-700">{next}</span>
                        </>
                      ) : (
                        "No slots this week"
                      )}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
