import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { buttonStyles } from "@/components/ui/button";
import { ARTICLES } from "@/lib/content";
import { fmtDate } from "@/lib/format";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = ARTICLES.find((x) => x.slug === slug);
  return { title: a?.title ?? "Article", description: a?.excerpt };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = ARTICLES.find((x) => x.slug === slug);
  if (!a) notFound();
  const more = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 3);

  return (
    <>
      <PageHero eyebrow={a.category} title={a.title} description={a.excerpt} crumbs={[{ href: "/health-library", label: "Health library" }]}>
        <p className="text-sm text-ink-500">
          By{" "}
          <Link href={`/doctors/${a.authorCode}`} className="font-semibold text-brand-700 hover:underline">
            {a.author}
          </Link>{" "}
          · {fmtDate(a.date)} · {a.readMins} min read
        </p>
      </PageHero>
      <section className="container-page grid gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="prose-medora max-w-2xl text-[1.0625rem]">
          {a.body.map((b, i) =>
            b.h ? (
              <h2 key={i}>{b.h}</h2>
            ) : b.list ? (
              <ul key={i}>
                {b.list.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>{b.p}</p>
            ),
          )}
          <p className="!mt-10 rounded-xl bg-surface p-4 text-sm text-ink-500">This article is for general information and isn&apos;t a substitute for medical advice. Please consult a doctor about your symptoms.</p>
        </article>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-brand-50 p-5">
            <p className="font-semibold text-ink-900">Talk to {a.author}</p>
            <p className="mt-1 text-sm text-ink-600">Book an in-person or video consultation.</p>
            <Link href={`/book?doctor=${a.authorCode}`} className={buttonStyles({ size: "sm", block: true, className: "mt-4" })}>
              <CalendarPlus aria-hidden /> Book appointment
            </Link>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-ink-900">More from the library</p>
            <ul className="space-y-3">
              {more.map((m) => (
                <li key={m.slug}>
                  <Link href={`/health-library/${m.slug}`} className="text-sm font-medium text-ink-700 hover:text-brand-700">
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </>
  );
}
