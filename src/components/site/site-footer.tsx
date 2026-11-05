import Link from "next/link";
import { Ambulance, Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { HOSPITAL } from "@/lib/constants";

const COLS = [
  {
    title: "Hospital",
    links: [
      { href: "/about", label: "About Medora" },
      { href: "/departments", label: "Centres of excellence" },
      { href: "/doctors", label: "Our doctors" },
      { href: "/facilities", label: "Facilities & technology" },
      { href: "/careers", label: "Careers" },
    ],
  },
  {
    title: "Patients",
    links: [
      { href: "/book", label: "Book an appointment" },
      { href: "/book?mode=video", label: "Video consultation" },
      { href: "/health-packages", label: "Health check-ups" },
      { href: "/patients-visitors", label: "Patients & visitors" },
      { href: "/patients-visitors#insurance", label: "Insurance & billing" },
      { href: "/login", label: "Patient portal" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/health-library", label: "Health library" },
      { href: "/contact", label: "Contact & directions" },
      { href: "/patients-visitors#faq", label: "FAQs" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of use" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-brand-950 text-brand-200">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.3fr_2fr] lg:gap-16 lg:py-16">
        <div>
          <Logo inverted />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-300">
            A {HOSPITAL.beds}-bed multispeciality hospital in {HOSPITAL.city} providing advanced, compassionate care since {HOSPITAL.established}.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent-500" aria-hidden />
              <span>{HOSPITAL.addressLines.join(", ")}</span>
            </li>
            <li className="flex gap-3">
              <Phone className="mt-0.5 size-4 shrink-0 text-accent-500" aria-hidden />
              <a href={HOSPITAL.phoneHref} className="hover:text-white">
                {HOSPITAL.phone}
              </a>
            </li>
            <li className="flex gap-3">
              <Ambulance className="mt-0.5 size-4 shrink-0 text-accent-500" aria-hidden />
              <span>
                Emergency{" "}
                <a href={HOSPITAL.emergencyHref} className="font-semibold text-white">
                  {HOSPITAL.emergency}
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-accent-500" aria-hidden />
              <a href={`mailto:${HOSPITAL.email}`} className="hover:text-white">
                {HOSPITAL.email}
              </a>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-accent-500" aria-hidden />
              <span>OPD {HOSPITAL.opdHours} · Pharmacy &amp; Emergency 24×7</span>
            </li>
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">{c.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 pb-24 text-xs text-brand-400 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
          <p>© {new Date().getFullYear()} {HOSPITAL.name}. All rights reserved.</p>
          <p>For medical emergencies, call {HOSPITAL.emergency} or visit our Emergency department immediately.</p>
        </div>
      </div>
    </footer>
  );
}
