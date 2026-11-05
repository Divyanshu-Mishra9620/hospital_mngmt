import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { DepartmentIcon } from "@/components/icons";
import { PageHero } from "@/components/site/page-hero";
import { publicDepartments } from "@/lib/queries/public";

export const metadata: Metadata = { title: "Specialities & departments" };
export const revalidate = 60;

export default async function DepartmentsPage() {
  const depts = await publicDepartments();
  return (
    <>
      <PageHero
        eyebrow="Centres of excellence"
        title="Specialities & departments"
        description="From preventive care to complex surgery, our specialists work as one team around you."
        crumbs={[{ href: "/departments", label: "Specialities" }]}
      />
      <section className="container-page py-12 sm:py-16">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {depts.map((d) => (
            <li key={d.slug}>
              <Link href={`/departments/${d.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft">
                <span className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  <DepartmentIcon name={d.icon} className="size-6" />
                </span>
                <h2 className="mt-4 text-lg font-bold">{d.name}</h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-600">{d.summary}</p>
                <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm">
                  <span className="flex items-center gap-1.5 text-ink-500">
                    <MapPin className="size-3.5" aria-hidden /> {d.location}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                    {d.doctorCount} doctor{d.doctorCount === 1 ? "" : "s"} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
