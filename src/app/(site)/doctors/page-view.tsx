"use client";

import { ClientPage } from "@/components/client-page";
import { DoctorDirectory } from "@/components/site/doctor-directory";
import { PageHero } from "@/components/site/page-hero";
import { publicDepartments, publicDoctors } from "@/lib/queries/public";

async function __render({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string; video?: string }> }) {
  const sp = await searchParams;
  const [depts, all] = await Promise.all([publicDepartments(), publicDoctors()]);
  return (
    <>
      <PageHero
        eyebrow="Our specialists"
        title="Find a doctor"
        description={`${all.length} consultants across ${depts.length} specialities. Book an in-person visit or a video consultation.`}
        crumbs={[{ href: "/doctors", label: "Find a doctor" }]}
      />
      <section className="container-page py-10 sm:py-12">
        <DoctorDirectory
          doctors={all}
          depts={depts.map((d) => ({ slug: d.slug, label: d.name.split(" & ")[0].split(" (")[0] }))}
          initial={{ q: sp.q ?? "", dept: sp.dept ?? "", video: sp.video === "1" }}
        />
      </section>
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
