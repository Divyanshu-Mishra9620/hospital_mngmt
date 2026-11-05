import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { requireDoctor } from "@/lib/auth/session";
import { listDoctorPatients } from "@/lib/doctor/queries";
import { ageFrom, fmtDate, genderLabel } from "@/lib/format";
import { todayISO } from "@/lib/time";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "My patients" };

export default async function DoctorPatientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { doctor } = await requireDoctor();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const today = todayISO();
  const rows = await listDoctorPatients(doctor.id, q, today);

  return (
    <>
      <PageHeader title="My patients" description="Everyone who has booked a consultation with you." />
      <Card className="mb-5 p-3 sm:p-4">
        <form className="flex gap-2" action="/doctor/patients">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Search by name, UHID or phone" className="pl-10" aria-label="Search patients" />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      <Card>
        <div className="border-b border-line px-4 py-3 text-sm text-ink-500 sm:px-5">
          {rows.length} patient{rows.length === 1 ? "" : "s"}
          {q && (
            <>
              {" "}
              matching “{q}” ·{" "}
              <Link href="/doctor/patients" className="font-medium text-brand-700 hover:underline">
                Clear
              </Link>
            </>
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<Users />} title="No patients found" description={q ? "Try another name, UHID or phone number." : "Patients appear here once they book with you."} />
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((p) => (
                <li key={p.id}>
                  <Link href={`/doctor/patients/${p.uhid}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface/60">
                    <Avatar name={p.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink-900">{p.name}</p>
                      <p className="text-xs text-ink-500">
                        {p.uhid} · {ageFrom(p.dob) ?? "—"} y · {genderLabel(p.gender)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {Number(p.visits)} visit{Number(p.visits) === 1 ? "" : "s"} · last {fmtDate(p.lastVisit)}
                      </p>
                    </div>
                    {p.nextVisit && <Badge tone="brand">Next {fmtDate(p.nextVisit, { year: undefined })}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    {["Patient", "Age / sex", "Blood", "Conditions", "Visits", "Last visit", "Next"].map((h) => (
                      <th key={h} className="whitespace-nowrap border-b border-line bg-surface/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="hover:bg-surface/50">
                      <td className="border-b border-line px-4 py-3">
                        <Link href={`/doctor/patients/${p.uhid}`} className="flex items-center gap-3">
                          <Avatar name={p.name} size="sm" />
                          <span>
                            <span className="block font-semibold text-ink-900 hover:text-brand-700">{p.name}</span>
                            <span className="text-xs text-ink-500">
                              {p.uhid} · {p.phone ?? "—"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="border-b border-line px-4 py-3 text-ink-700">
                        {ageFrom(p.dob) ?? "—"} y · {genderLabel(p.gender)}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-ink-700">{p.bloodGroup ?? "—"}</td>
                      <td className="max-w-[16rem] border-b border-line px-4 py-3 text-ink-600">
                        <span className="line-clamp-1">{p.chronicConditions ?? "—"}</span>
                        {p.allergies && <span className="block text-xs font-medium text-danger-700">Allergy: {p.allergies}</span>}
                      </td>
                      <td className="tabular border-b border-line px-4 py-3 font-semibold text-ink-900">{Number(p.visits)}</td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3 text-ink-700">{fmtDate(p.lastVisit)}</td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3">{p.nextVisit ? <Badge tone="brand">{fmtDate(p.nextVisit)}</Badge> : <span className="text-ink-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
