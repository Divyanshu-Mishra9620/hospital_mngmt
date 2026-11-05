import type { Metadata } from "next";
import { Ambulance, Car, Clock, Mail, MapPin, Phone, Siren, TrainFront } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { HOSPITAL } from "@/lib/constants";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact & directions" };

export default function ContactPage() {
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(HOSPITAL.addressLines.join(", "))}`;
  return (
    <>
      <PageHero eyebrow="We're here to help" title="Contact & directions" description="Reach the right team quickly. For emergencies, call us — don't use the form." crumbs={[{ href: "/contact", label: "Contact" }]} />
      <section className="container-page grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
        <div className="space-y-4">
          <a href={HOSPITAL.emergencyHref} className="flex items-center gap-4 rounded-2xl bg-danger-600 p-5 text-white shadow-soft">
            <Siren className="size-7 shrink-0" aria-hidden />
            <div>
              <p className="text-sm text-danger-100">24×7 Emergency</p>
              <p className="font-display text-xl font-bold">{HOSPITAL.emergency}</p>
            </div>
          </a>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Phone, k: "Appointments & enquiries", v: HOSPITAL.phone, href: HOSPITAL.phoneHref },
              { icon: Ambulance, k: "Ambulance", v: HOSPITAL.ambulance, href: HOSPITAL.ambulanceHref },
              { icon: Mail, k: "Email", v: HOSPITAL.email, href: `mailto:${HOSPITAL.email}` },
              { icon: Clock, k: "OPD hours", v: HOSPITAL.opdHours },
            ].map(({ icon: Icon, k, v, href }) => (
              <div key={k} className="rounded-2xl border border-line p-5">
                <Icon className="size-5 text-brand-600" aria-hidden />
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{k}</p>
                {href ? (
                  <a href={href} className="mt-0.5 block break-words font-semibold text-ink-900 hover:text-brand-700">
                    {v}
                  </a>
                ) : (
                  <p className="mt-0.5 font-semibold text-ink-900">{v}</p>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-line p-5">
            <p className="flex items-center gap-2 font-semibold text-ink-900">
              <MapPin className="size-5 text-brand-600" aria-hidden /> {HOSPITAL.name}
            </p>
            <p className="mt-1 text-ink-600">{HOSPITAL.addressLines.join(", ")}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-600">
              <li className="flex gap-2">
                <Car className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden /> Multi-level parking for 400 cars at Gate 2; drop-off at the main entrance.
              </li>
              <li className="flex gap-2">
                <TrainFront className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden /> 10 minutes from the nearest metro station; hospital shuttle every 20 minutes.
              </li>
            </ul>
            <a href={map} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-semibold text-brand-700">
              Get directions on Google Maps →
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
          <h2 className="text-xl font-bold">Send us a message</h2>
          <p className="mt-1 text-sm text-ink-500">We respond within one working day. Please don&apos;t share detailed medical history here.</p>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
