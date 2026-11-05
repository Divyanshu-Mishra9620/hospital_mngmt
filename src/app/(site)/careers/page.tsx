import type { Metadata } from "next";
import { Briefcase, MapPin } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { HOSPITAL } from "@/lib/constants";

export const metadata: Metadata = { title: "Careers" };

const OPENINGS = [
  { title: "Consultant — Interventional Cardiology", dept: "Cardiology", type: "Full-time", exp: "DM Cardiology, 5+ years" },
  { title: "Staff Nurse — Critical Care", dept: "Nursing", type: "Full-time", exp: "B.Sc Nursing, 2+ years ICU" },
  { title: "Clinical Pharmacist", dept: "Pharmacy", type: "Full-time", exp: "Pharm.D / M.Pharm" },
  { title: "Physiotherapist", dept: "Rehabilitation", type: "Full-time", exp: "BPT/MPT, 1+ year" },
  { title: "Patient Relationship Executive", dept: "Patient services", type: "Full-time", exp: "Graduate, good communication in English & Kannada" },
  { title: "Medical Records Officer", dept: "Administration", type: "Full-time", exp: "Diploma in MRD / HIM" },
];

export default function CareersPage() {
  return (
    <>
      <PageHero eyebrow="Join us" title="Careers at Medora" description="Work with a team that values clinical excellence, continuous learning and kindness." crumbs={[{ href: "/careers", label: "Careers" }]} />
      <section className="container-page py-12 sm:py-16">
        <ul className="grid gap-4 md:grid-cols-2">
          {OPENINGS.map((o) => (
            <li key={o.title} className="rounded-2xl border border-line bg-white p-6 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{o.dept}</p>
              <h2 className="mt-1.5 text-lg font-bold">{o.title}</h2>
              <p className="mt-1 text-sm text-ink-600">{o.exp}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="size-4" aria-hidden /> {o.type}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden /> {HOSPITAL.city}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-ink-600">
          To apply, email your CV with the role in the subject line to <a className="font-semibold text-brand-700" href="mailto:careers@medorahospital.in">careers@medorahospital.in</a>.
        </p>
      </section>
    </>
  );
}
