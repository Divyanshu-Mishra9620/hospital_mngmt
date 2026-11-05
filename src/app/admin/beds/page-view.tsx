"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { BedDouble, BedSingle } from "lucide-react";
import { db } from "@/db";
import { admissions, doctors, patients, users, wards } from "@/db/schema";
import { ActionForm } from "@/components/admin/action-form";
import { Meter } from "@/components/admin/bars";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, DescriptionList, PageHeader, StatCard } from "@/components/ui/misc";
import { adminAdmit, adminDischarge } from "@/lib/actions/admin";
import { bedLabel, listDoctorsBasic, str } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { fmtDateTime, inr, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

async function __render({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const docUser = alias(users, "doc_user");
  const patUser = alias(users, "pat_user");

  const [wardRows, current, recent, docs] = await Promise.all([
    db.select().from(wards).orderBy(wards.id),
    db
      .select({ a: admissions, patient: patUser.name, uhid: patients.uhid, doctor: docUser.name })
      .from(admissions)
      .innerJoin(patients, eq(patients.id, admissions.patientId))
      .innerJoin(patUser, eq(patUser.id, patients.userId))
      .innerJoin(doctors, eq(doctors.id, admissions.doctorId))
      .innerJoin(docUser, eq(docUser.id, doctors.userId))
      .where(isNull(admissions.dischargedAt)),
    db
      .select({ a: admissions, patient: patUser.name, uhid: patients.uhid, ward: wards.name })
      .from(admissions)
      .innerJoin(patients, eq(patients.id, admissions.patientId))
      .innerJoin(patUser, eq(patUser.id, patients.userId))
      .innerJoin(wards, eq(wards.id, admissions.wardId))
      .where(and(isNotNull(admissions.dischargedAt)))
      .orderBy(desc(admissions.dischargedAt))
      .limit(6),
    listDoctorsBasic(),
  ]);

  const wardId = Number(str(sp.ward)) || wardRows[0]?.id;
  const ward = wardRows.find((w) => w.id === wardId) ?? wardRows[0];
  const byWard = new Map<number, typeof current>();
  for (const c of current) byWard.set(c.a.wardId, [...(byWard.get(c.a.wardId) ?? []), c]);
  const totalBeds = wardRows.reduce((s, w) => s + w.totalBeds, 0);
  const occupied = current.length;

  const wardAdmissions = new Map((byWard.get(ward?.id ?? 0) ?? []).map((c) => [c.a.bedNo, c]));
  const selectedBed = str(sp.bed);
  const selectedAdmission = Number(str(sp.admission)) ? current.find((c) => c.a.id === Number(str(sp.admission))) : undefined;
  const beds = ward ? Array.from({ length: ward.totalBeds }, (_, i) => bedLabel(ward.name, i + 1)) : [];
  const freeBedSelected = selectedBed && beds.includes(selectedBed) && !wardAdmissions.has(selectedBed);

  return (
    <>
      <PageHeader title="Beds & admissions" description="In-patient occupancy across wards. Select a free bed to admit a patient, or an occupied bed to discharge." />
      {str(sp.discharged) && <Alert tone="success" className="mb-4">Admission {str(sp.discharged)} discharged and the bed is now free.</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total beds" value={totalBeds} sub={`${wardRows.length} wards`} icon={<BedDouble />} />
        <StatCard label="Occupied" value={occupied} sub={`${totalBeds ? Math.round((occupied / totalBeds) * 100) : 0}% occupancy`} tone="info" />
        <StatCard label="Available" value={totalBeds - occupied} tone="success" />
        <StatCard
          label="ICU availability"
          value={wardRows.filter((w) => w.type === "ICU").reduce((s, w) => s + w.totalBeds - (byWard.get(w.id)?.length ?? 0), 0)}
          sub="Free ICU / CCU / NICU beds"
          tone="warning"
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {wardRows.map((w) => {
          const occ = byWard.get(w.id)?.length ?? 0;
          const on = w.id === ward?.id;
          return (
            <Link
              key={w.id}
              href={`/admin/beds?ward=${w.id}`}
              scroll={false}
              className={cn("rounded-2xl border bg-white p-4 shadow-card transition", on ? "border-brand-500 ring-2 ring-brand-500/20" : "border-line hover:border-brand-200")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900">{w.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {w.floor} · {inr(w.dailyRate)}/day
                  </p>
                </div>
                <Badge tone={w.type === "ICU" ? "danger" : "neutral"}>{w.type}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Meter value={occ} max={w.totalBeds} label={`${w.name} occupancy`} />
                <span className="tabular w-14 shrink-0 text-right text-xs font-semibold text-ink-700">
                  {occ}/{w.totalBeds}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {ward && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              title={`${ward.name} — bed map`}
              description={`${wardAdmissions.size} occupied · ${ward.totalBeds - wardAdmissions.size} free`}
              icon={<BedSingle />}
            />
            <CardBody>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-8">
                {beds.map((b) => {
                  const adm = wardAdmissions.get(b);
                  const on = adm ? selectedAdmission?.a.id === adm.a.id : selectedBed === b;
                  return (
                    <li key={b}>
                      <Link
                        href={adm ? `/admin/beds?ward=${ward.id}&admission=${adm.a.id}` : `/admin/beds?ward=${ward.id}&bed=${b}`}
                        scroll={false}
                        title={adm ? `${adm.patient} · ${adm.a.reason}` : "Free — click to admit"}
                        className={cn(
                          "block rounded-xl border px-2 py-2 text-center text-xs transition",
                          adm ? "border-info-100 bg-info-50 text-info-700 hover:border-info-600" : "border-dashed border-line-strong bg-white text-ink-500 hover:border-success-600 hover:text-success-700",
                          on && "ring-2 ring-brand-500",
                        )}
                      >
                        <span className="tabular block font-semibold">{b}</span>
                        <span className="block truncate">{adm ? adm.patient.split(" ")[0] : "Free"}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 flex flex-wrap gap-4 text-xs text-ink-500">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded border border-info-100 bg-info-50" aria-hidden /> Occupied
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded border border-dashed border-line-strong bg-white" aria-hidden /> Free
                </span>
              </p>
            </CardBody>
          </Card>

          <div className="space-y-5">
            {freeBedSelected ? (
              <Card>
                <CardHeader title={`Admit to bed ${selectedBed}`} description={ward.name} />
                <CardBody>
                  <ActionForm action={adminAdmit} submitLabel="Admit patient" pendingText="Admitting…">
                    <input type="hidden" name="wardId" value={ward.id} />
                    <input type="hidden" name="bedNo" value={selectedBed} />
                    <Field label="Patient UHID" htmlFor="uhid" hint="e.g. MDR-100105" required>
                      <Input id="uhid" name="uhid" placeholder="MDR-" required autoCapitalize="characters" />
                    </Field>
                    <Field label="Admitting doctor" htmlFor="doctorId" required>
                      <Select id="doctorId" name="doctorId" defaultValue="" required>
                        <option value="" disabled>
                          Select doctor
                        </option>
                        {docs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Reason for admission" htmlFor="reason" required>
                      <Textarea id="reason" name="reason" rows={2} required />
                    </Field>
                  </ActionForm>
                </CardBody>
              </Card>
            ) : selectedAdmission ? (
              <Card>
                <CardHeader title={`Bed ${selectedAdmission.a.bedNo}`} description={selectedAdmission.a.code} />
                <CardBody className="space-y-4">
                  <DescriptionList
                    cols={1}
                    items={[
                      {
                        label: "Patient",
                        value: (
                          <Link href={`/admin/patients/${selectedAdmission.uhid}`} className="font-medium text-brand-700 hover:underline">
                            {selectedAdmission.patient} · {selectedAdmission.uhid}
                          </Link>
                        ),
                      },
                      { label: "Under", value: selectedAdmission.doctor },
                      { label: "Reason", value: selectedAdmission.a.reason },
                      { label: "Admitted", value: `${fmtDateTime(selectedAdmission.a.admittedAt)} (${timeAgo(selectedAdmission.a.admittedAt)})` },
                    ]}
                  />
                  <ActionForm action={adminDischarge} submitLabel="Discharge patient" variant="danger" confirm="Discharge this patient and free the bed?" className="border-t border-line pt-4">
                    <input type="hidden" name="admissionId" value={selectedAdmission.a.id} />
                    <Field label="Discharge summary" htmlFor="summary" required>
                      <Textarea id="summary" name="summary" rows={3} placeholder="Condition at discharge, medicines, follow-up…" required />
                    </Field>
                  </ActionForm>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardHeader title="Admit or discharge" />
                <CardBody>
                  <p className="text-sm text-ink-600">Select a free bed in the map to admit a patient, or an occupied bed to view and discharge.</p>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader title="Recent discharges" />
              <ul className="divide-y divide-line">
                {recent.map((r) => (
                  <li key={r.a.id} className="px-4 py-2.5 text-sm sm:px-5">
                    <Link href={`/admin/patients/${r.uhid}?tab=admissions`} className="font-medium text-ink-900 hover:text-brand-700">
                      {r.patient}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {r.ward} · {r.a.bedNo} · {r.a.dischargedAt ? timeAgo(r.a.dischargedAt) : ""}
                    </p>
                  </li>
                ))}
                {recent.length === 0 && <li className="px-4 py-3 text-sm text-ink-500 sm:px-5">No discharges yet.</li>}
              </ul>
            </Card>
            <LinkButton href="/admin/patients" variant="ghost" size="sm">
              Find a patient&apos;s UHID →
            </LinkButton>
          </div>
        </div>
      )}
    </>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
