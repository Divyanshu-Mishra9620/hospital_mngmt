import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";
import { requireDoctor } from "@/lib/auth/session";
import { doctorPrescriptions } from "@/lib/doctor/queries";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Prescriptions" };

const PAGE = 25;

export default async function DoctorPrescriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { doctor } = await requireDoctor();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await doctorPrescriptions(doctor.id, q, PAGE, (page - 1) * PAGE);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) => `/doctor/prescriptions?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Prescriptions" description={`${total} prescription${total === 1 ? "" : "s"} issued by you.`} />
      <Card className="mb-5 p-3 sm:p-4">
        <form className="flex gap-2" action="/doctor/prescriptions">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Search patient, UHID, Rx number or diagnosis" className="pl-10" aria-label="Search prescriptions" />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<FileText />} title="No prescriptions found" description={q ? "Try a different search." : "Prescriptions you issue will appear here."} />
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/doctor/prescriptions/${r.code}`} className="block px-4 py-3.5 hover:bg-surface/60">
                    <p className="font-semibold text-ink-900">{r.patientName}</p>
                    <p className="text-sm text-ink-700">{r.diagnosis}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {r.code} · {fmtDate(r.createdAt)} · {Number(r.items)} medicine{Number(r.items) === 1 ? "" : "s"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    {["Rx number", "Patient", "Diagnosis", "Medicines", "Follow-up", "Issued"].map((h) => (
                      <th key={h} className="whitespace-nowrap border-b border-line bg-surface/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-surface/50">
                      <td className="tabular whitespace-nowrap border-b border-line px-4 py-3">
                        <Link href={`/doctor/prescriptions/${r.code}`} className="font-semibold text-brand-700 hover:underline">
                          {r.code}
                        </Link>
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <p className="font-medium text-ink-900">{r.patientName}</p>
                        <p className="text-xs text-ink-500">{r.uhid}</p>
                      </td>
                      <td className="max-w-[20rem] border-b border-line px-4 py-3 text-ink-700">
                        <span className="line-clamp-2">{r.diagnosis}</span>
                      </td>
                      <td className="tabular border-b border-line px-4 py-3 text-ink-700">{Number(r.items)}</td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3 text-ink-700">{fmtDate(r.followUpDate)}</td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3 text-ink-500">{fmtDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm sm:px-5">
                <span className="text-ink-500">
                  Page {page} of {pages}
                </span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link href={link(page - 1)} className={buttonStyles({ variant: "outline", size: "sm" })}>
                      <ChevronLeft /> Previous
                    </Link>
                  )}
                  {page < pages && (
                    <Link href={link(page + 1)} className={buttonStyles({ variant: "outline", size: "sm" })}>
                      Next <ChevronRight />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
