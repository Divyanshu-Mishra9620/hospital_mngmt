"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { Check, Clock, FileText, Home, Stethoscope } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { buttonStyles } from "@/components/ui/button";
import { inr, parseJSON } from "@/lib/format";
import { publicPackages } from "@/lib/queries/public";
import { cn } from "@/lib/cn";

async function __render() {
  const pkgs = await publicPackages();
  return (
    <>
      <PageHero eyebrow="Preventive health" title="Health check-up packages" description="Comprehensive screening in a single morning, with reports in 24 hours and a doctor's consultation to explain them." crumbs={[{ href: "/health-packages", label: "Health checks" }]} />
      <section className="container-page py-12 sm:py-16">
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pkgs.map((p) => {
            const tests = parseJSON<string[]>(p.tests, []);
            return (
              <li key={p.slug} className={cn("flex flex-col rounded-2xl border bg-white p-6 shadow-card", p.highlight ? "border-brand-300 ring-2 ring-brand-100" : "border-line")}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-xl font-bold">{p.name}</h2>
                  {p.highlight && <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">Most popular</span>}
                </div>
                <p className="text-sm text-ink-500">{p.audience}</p>
                <p className="mt-4">
                  <span className="tabular font-display text-3xl font-bold text-ink-900">{inr(p.price)}</span> <span className="text-sm text-ink-400 line-through">{inr(p.mrp)}</span>{" "}
                  <span className="text-sm font-semibold text-success-700">Save {inr(p.mrp - p.price)}</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-700">
                  {tests.map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden /> {t}
                    </li>
                  ))}
                </ul>
                <Link href={`/patient/health-checks?pkg=${p.slug}`} className={buttonStyles({ block: true, variant: p.highlight ? "primary" : "secondary", className: "mt-6" })}>
                  Book this package
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Clock, t: "Done in one morning", d: "Report at 8 AM after 10–12 hours of fasting; most tests finish by noon." },
            { icon: FileText, t: "Reports in 24 hours", d: "Digital reports in your patient app, plus a printed file." },
            { icon: Stethoscope, t: "Doctor review", d: "A physician explains results and plans next steps." },
            { icon: Home, t: "Home sample collection", d: "Available for blood tests in most city areas." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-line p-5">
              <Icon className="size-5 text-brand-600" aria-hidden />
              <p className="mt-2 font-semibold text-ink-900">{t}</p>
              <p className="mt-1 text-sm text-ink-600">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

const __loader = () => __render();

export default function PageView() {
  return <ClientPage render={__loader} props={{}} />;
}
