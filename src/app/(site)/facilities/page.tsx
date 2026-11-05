import type { Metadata } from "next";
import { Activity, Ambulance, Droplets, Dumbbell, FlaskConical, HeartPulse, Pill, Scan, Siren, Sparkles, type LucideIcon } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { FACILITIES } from "@/lib/content";
import { HOSPITAL } from "@/lib/constants";

export const metadata: Metadata = { title: "Facilities & technology" };

const ICONS: Record<string, LucideIcon> = { Siren, HeartPulse, Activity, Scan, FlaskConical, Sparkles, Droplets, Pill, Ambulance, Dumbbell };

export default function FacilitiesPage() {
  return (
    <>
      <PageHero
        eyebrow="Infrastructure"
        title="Facilities & technology"
        description={`${HOSPITAL.beds} beds, ${HOSPITAL.icuBeds} critical-care beds, 14 modular operating theatres and round-the-clock diagnostics.`}
        crumbs={[{ href: "/facilities", label: "Facilities" }]}
      />
      <section className="container-page py-12 sm:py-16">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FACILITIES.map((f) => {
            const Icon = ICONS[f.icon] ?? Activity;
            return (
              <li key={f.title} className="rounded-2xl border border-line bg-white p-6 shadow-card">
                <span className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{f.text}</p>
              </li>
            );
          })}
        </ul>
        <div className="mt-12 grid gap-4 rounded-2xl bg-brand-950 p-6 text-white sm:grid-cols-4 sm:p-10">
          {[
            { k: "Operating theatres", v: "14" },
            { k: "ICU beds", v: String(HOSPITAL.icuBeds) },
            { k: "Dialysis stations", v: "20" },
            { k: "Ambulances", v: "12" },
          ].map((s) => (
            <div key={s.k}>
              <p className="tabular font-display text-4xl font-bold">{s.v}</p>
              <p className="mt-1 text-sm text-brand-200">{s.k}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
