import type { Metadata } from "next";
import Link from "next/link";
import { Award, HeartHandshake, Lightbulb, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { buttonStyles } from "@/components/ui/button";
import { HOSPITAL } from "@/lib/constants";

export const metadata: Metadata = { title: "About us" };

const MILESTONES = [
  { year: "2004", text: "Medora opens as a 120-bed hospital with 8 specialities." },
  { year: "2009", text: "Cardiac sciences centre and 24×7 cath lab commissioned." },
  { year: "2014", text: "Expansion to 300 beds; Level III NICU and dialysis unit open." },
  { year: "2019", text: "Robotic-assisted joint replacement and 3T MRI introduced." },
  { year: "2022", text: "Video consultations and the patient app launched." },
  { year: "2026", text: `${HOSPITAL.beds} beds, ${HOSPITAL.icuBeds} ICU beds and 16 centres of excellence.` },
];

const LEADERS = [
  { name: "Dr. Vivek Raman", role: "Chairman & Managing Director", note: "Cardiothoracic surgeon; founded Medora in 2004." },
  { name: "Ms. Ritu Malhotra", role: "Chief Operating Officer", note: "Leads operations, quality and patient experience." },
  { name: "Dr. Deepak Chawla", role: "Medical Director", note: "Senior physician; chairs the clinical governance committee." },
  { name: "Ms. Grace D'Souza", role: "Chief Nursing Officer", note: "Oversees 900+ nurses and the nursing education academy." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About Medora" title="Two decades of advanced, compassionate care" description={`Founded in ${HOSPITAL.established}, Medora has grown into a ${HOSPITAL.beds}-bed multispeciality hospital trusted by families across ${HOSPITAL.city}.`} crumbs={[{ href: "/about", label: "About" }]} />

      <section className="container-page grid gap-10 py-12 sm:py-16 lg:grid-cols-2 lg:gap-16">
        <div className="prose-medora">
          <h2 className="!mt-0">Our story</h2>
          <p>Medora began with a simple belief: that world-class medicine should feel personal. Two decades later, that belief still shapes everything — from how we design our wards to how our doctors explain a diagnosis.</p>
          <p>Today our specialists treat more than 3,00,000 outpatients and 28,000 inpatients every year. We invest continuously in technology — robotic surgery, a 3T MRI, a 24×7 cath lab — but we measure success by outcomes and by how our patients feel when they go home.</p>
          <h3>Mission</h3>
          <p>To deliver safe, evidence-based and affordable healthcare with kindness, and to make every interaction simple for patients and their families.</p>
          <h3>Vision</h3>
          <p>To be the most trusted hospital in South India for complex care and everyday health.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: HeartHandshake, t: "Compassion", d: "We listen first, explain clearly and treat every patient like family." },
            { icon: ShieldCheck, t: "Safety", d: "Rigorous protocols, audits and a just culture that encourages reporting." },
            { icon: Award, t: "Excellence", d: "Specialists who lead in research, training and outcomes." },
            { icon: Lightbulb, t: "Innovation", d: "Technology that shortens recoveries and makes care accessible." },
          ].map(({ icon: Icon, t, d }) => (
            <li key={t} className="rounded-2xl border border-line bg-white p-6 shadow-card">
              <Icon className="size-7 text-brand-600" aria-hidden />
              <p className="mt-3 text-lg font-bold text-ink-900">{t}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface py-12 sm:py-16">
        <div className="container-page">
          <h2 className="section-title">Milestones</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MILESTONES.map((m) => (
              <li key={m.year} className="rounded-2xl border border-line bg-white p-5">
                <p className="tabular font-display text-2xl font-bold text-brand-600">{m.year}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-700">{m.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-12 sm:py-16">
        <h2 className="section-title">Leadership</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LEADERS.map((l) => (
            <li key={l.name} className="rounded-2xl border border-line p-5">
              <p className="font-semibold text-ink-900">{l.name}</p>
              <p className="text-sm font-medium text-brand-700">{l.role}</p>
              <p className="mt-2 text-sm text-ink-600">{l.note}</p>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link href="/departments" className={buttonStyles()}>
            Explore our specialities
          </Link>
          <Link href="/careers" className={buttonStyles({ variant: "outline" })}>
            Careers at Medora
          </Link>
        </div>
      </section>
    </>
  );
}
