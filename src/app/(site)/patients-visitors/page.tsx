import type { Metadata } from "next";
import { BedDouble, ChevronDown, ClipboardList, CreditCard, FileText, Shield, Users } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { FAQS } from "@/lib/content";
import { HOSPITAL } from "@/lib/constants";

export const metadata: Metadata = { title: "Patients & visitors" };

const SECTIONS = [
  {
    id: "opd",
    icon: ClipboardList,
    title: "Your OPD visit",
    items: [
      "Book online to get a confirmed slot and OPD token — walk-ins are seen between booked slots.",
      "Arrive 15 minutes early and check in at the department desk with your UHID.",
      "Bring a photo ID, previous prescriptions, reports and the medicines you currently take.",
      "Your prescription, diet plan and advised tests are available in the patient app after the visit.",
    ],
  },
  {
    id: "admission",
    icon: BedDouble,
    title: "Admission & discharge",
    items: [
      "Planned admissions: visit the admission desk (Block A, ground floor) with the doctor's admission advice and ID.",
      "Room categories: general ward, semi-private, private suites and ICUs — tariffs are shared at the desk.",
      "Discharge is usually completed by 12 noon; the summary, medicines and follow-up date are explained by the nurse.",
    ],
  },
  {
    id: "insurance",
    icon: Shield,
    title: "Insurance & cashless treatment",
    items: [
      "Cashless treatment with most major insurers, TPAs and corporate and government schemes.",
      "For planned procedures, submit the pre-authorisation form 3–5 days in advance.",
      "In emergencies, our insurance desk initiates the claim within hours of admission.",
      "Carry your policy card / e-card, photo ID and employee ID (for group policies).",
    ],
  },
  {
    id: "billing",
    icon: CreditCard,
    title: "Billing & payments",
    items: [
      "Consultation fees are paid at booking (online) or at the OPD counter.",
      "We accept UPI, cards, net banking and cash. All receipts are available in the patient app.",
      "Refunds for cancelled appointments are processed in 3–5 working days.",
    ],
  },
  {
    id: "visitors",
    icon: Users,
    title: "Visiting hours & guidelines",
    items: [
      `General wards: ${HOSPITAL.visitingHours}.`,
      "ICU: 15-minute visits at 12:00 PM and 6:00 PM, one visitor at a time.",
      "Children under 12 are not permitted in patient areas, to protect them and our patients.",
      "Please wash hands or use sanitiser when entering and leaving patient rooms.",
    ],
  },
  {
    id: "records",
    icon: FileText,
    title: "Medical records",
    items: [
      "Prescriptions, bills and vitals are always available in your patient app.",
      "Certified copies of case files can be requested at the Medical Records Department (3 working days).",
    ],
  },
];

export default function PatientsVisitorsPage() {
  return (
    <>
      <PageHero eyebrow="Patient guide" title="Patients & visitors" description="Everything you need to know before, during and after your visit." crumbs={[{ href: "/patients-visitors", label: "Patients & visitors" }]}>
        <nav aria-label="On this page" className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-ink-700 hover:border-brand-200">
              {s.title}
            </a>
          ))}
          <a href="#faq" className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-ink-700 hover:border-brand-200">
            FAQs
          </a>
        </nav>
      </PageHero>
      <section className="container-page grid gap-4 py-12 sm:py-16 md:grid-cols-2">
        {SECTIONS.map(({ id, icon: Icon, title, items }) => (
          <article key={id} id={id} className="scroll-mt-28 rounded-2xl border border-line bg-white p-6 shadow-card">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="text-lg font-bold">{title}</h2>
            </div>
            <ul className="mt-4 space-y-2.5 text-[0.9375rem] leading-relaxed text-ink-600">
              {items.map((i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  {i}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <section id="faq" className="scroll-mt-28 bg-surface py-12 sm:py-16">
        <div className="container-page max-w-3xl">
          <h2 className="section-title">Frequently asked questions</h2>
          <div className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {FAQS.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 font-semibold text-ink-900">
                  {f.q}
                  <ChevronDown className="size-5 shrink-0 text-ink-400 transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-5 pb-5 text-[0.9375rem] leading-relaxed text-ink-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
