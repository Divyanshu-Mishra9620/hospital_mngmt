import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { ARTICLES } from "@/lib/content";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Health library" };

export default function HealthLibraryPage() {
  const [lead, ...rest] = ARTICLES;
  return (
    <>
      <PageHero eyebrow="Health library" title="Trusted health information from our doctors" description="Practical, evidence-based guidance on common conditions, prevention and getting the most from your care." crumbs={[{ href: "/health-library", label: "Health library" }]} />
      <section className="container-page py-12 sm:py-16">
        <Link href={`/health-library/${lead.slug}`} className="group grid gap-6 rounded-3xl border border-line bg-white p-6 shadow-card transition hover:shadow-soft sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Featured · {lead.category}</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight group-hover:text-brand-700 sm:text-3xl">{lead.title}</h2>
            <p className="mt-3 text-ink-600">{lead.excerpt}</p>
            <p className="mt-5 text-sm text-ink-500">
              {lead.author} · {fmtDate(lead.date)} · {lead.readMins} min read
            </p>
          </div>
          <div className="hidden aspect-[4/3] rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 lg:block" aria-hidden />
        </Link>
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((a) => (
            <li key={a.slug}>
              <Link href={`/health-library/${a.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition hover:border-brand-200 hover:shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{a.category}</p>
                <h2 className="mt-2 text-lg font-bold leading-snug group-hover:text-brand-700">{a.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{a.excerpt}</p>
                <p className="mt-4 text-xs text-ink-500">
                  {a.author} · {fmtDate(a.date)} · {a.readMins} min
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
