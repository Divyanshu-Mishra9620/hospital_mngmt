"use client";

import { ClientPage } from "@/components/client-page";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, FileSearch, ReceiptText, ScanLine, Search, UserRound } from "lucide-react";
import { getPrescription } from "@/lib/queries/prescriptions";
import { billsForPrescription, findPatients, otcCatalogue, prescriptionRegister, sellableStock } from "@/lib/pharmacy-queries";
import { getNumberSetting } from "@/lib/settings";
import { ageFrom, fmtDate, fmtDateTime, genderLabel, inr, timeAgo } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Alert, Avatar, EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { SupplyBadge } from "@/components/status";
import { PrescriptionDocument } from "@/components/prescription-document";
import { RxBillForm, type RxBillLine } from "@/components/pharmacy/rx-bill-form";
import { OtcSaleForm } from "@/components/pharmacy/otc-sale-form";
import { medicines } from "@/db/schema";
import { db } from "@/db";
import { inArray } from "drizzle-orm";

type SP = { q?: string; rx?: string; mode?: string };

async function __render({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const mode = sp.mode === "otc" ? "otc" : "rx";
  const q = (sp.q ?? "").trim();

  // A scanned / typed Rx code goes straight to the prescription.
  if (mode === "rx" && q && /^RX-/i.test(q) && !sp.rx) {
    const rx = await getPrescription({ code: q.toUpperCase() });
    if (rx) redirect(`/pharmacy/dispense?rx=${rx.code}`);
  }

  return (
    <>
      <PageHeader
        title="Dispense & bill"
        description="Record medicines handed over at the counter — against a doctor's prescription or as a walk-in OTC sale."
        actions={
          <LinkButton href="/pharmacy/prescriptions" variant="outline" size="sm">
            <ClipboardList aria-hidden /> Prescription register
          </LinkButton>
        }
      />
      <Tabs
        className="mb-5"
        active={mode}
        tabs={[
          { key: "rx", href: "/pharmacy/dispense", label: "Against prescription" },
          { key: "otc", href: "/pharmacy/dispense?mode=otc", label: "Walk-in / OTC sale" },
        ]}
      />
      {mode === "otc" ? await OtcSale() : sp.rx ? await RxDispense({ code: sp.rx }) : await RxSearch({ q })}
    </>
  );
}

async function OtcSale() {
  const catalogue = await otcCatalogue();
  return <OtcSaleForm catalogue={catalogue} />;
}

function SearchBox({ q }: { q: string }) {
  return (
    <form action="/pharmacy/dispense" className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-ink-400" aria-hidden />
        <Input
          name="q"
          defaultValue={q}
          autoFocus
          autoComplete="off"
          placeholder="Scan / type Rx code (RX-…), UHID, mobile or patient name"
          className="h-12 pl-10 text-base"
          aria-label="Search prescription or patient"
        />
      </div>
      <Button type="submit" size="lg">
        <Search aria-hidden /> Find
      </Button>
    </form>
  );
}

async function RxSearch({ q }: { q: string }) {
  if (!q) {
    const pending = await prescriptionRegister({ status: "not_dispensed", limit: 12 });
    return (
      <div className="space-y-5">
        <Card>
          <CardBody>
            <SearchBox q="" />
            <p className="mt-2 text-xs text-ink-500">Tip: the Rx code is printed at the top of every Medora prescription and in the patient app.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Awaiting dispense" description="Recent prescriptions with nothing supplied yet" icon={<FileSearch />} />
          {pending.length === 0 ? (
            <EmptyState title="All caught up" description="Every recent prescription has been dispensed." />
          ) : (
            <ul className="divide-y divide-line">
              {pending.map((p) => (
                <li key={p.id}>
                  <Link href={`/pharmacy/dispense?rx=${p.code}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-surface/60 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink-900">
                        {p.patientName} <span className="tabular ml-1 text-xs font-normal text-ink-500">{p.uhid}</span>
                      </p>
                      <p className="truncate text-sm text-ink-500">
                        {p.doctorName} · {p.diagnosis}
                      </p>
                    </div>
                    <span className="tabular text-sm text-ink-600">{p.code}</span>
                    <span className="text-xs text-ink-500">{timeAgo(p.createdAt)}</span>
                    <span className="text-sm font-semibold text-brand-700">Dispense →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  const found = await findPatients(q);
  const withRx = await Promise.all(found.map(async (p) => ({ ...p, rx: await prescriptionRegister({ patientId: p.id, limit: 8 }) })));

  return (
    <div className="space-y-5">
      <Card>
        <CardBody>
          <SearchBox q={q} />
        </CardBody>
      </Card>
      {withRx.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserRound />}
            title={`No patient or prescription matches “${q}”`}
            description="Check the Rx code / UHID, or record a walk-in OTC sale if the customer has no Medora prescription."
            action={
              <LinkButton href="/pharmacy/dispense?mode=otc" variant="outline" size="sm">
                Walk-in / OTC sale
              </LinkButton>
            }
          />
        </Card>
      ) : (
        withRx.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
              <Avatar name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{p.name}</p>
                <p className="tabular text-xs text-ink-500">
                  {p.uhid} · {ageFrom(p.dob) ?? "—"} y / {genderLabel(p.gender)} · {p.phone}
                </p>
              </div>
              {p.allergies && <span className="rounded-lg bg-danger-50 px-2.5 py-1 text-xs font-semibold text-danger-700">Allergy: {p.allergies}</span>}
            </div>
            {p.rx.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-500">No prescriptions on record for this patient.</p>
            ) : (
              <ul className="divide-y divide-line">
                {p.rx.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="tabular text-sm font-semibold text-ink-900">
                        {r.code} <span className="font-normal text-ink-500">· {fmtDate(r.createdAt)}</span>
                      </p>
                      <p className="truncate text-sm text-ink-500">
                        {r.doctorName} · {r.diagnosis}
                      </p>
                    </div>
                    <SupplyBadge status={r.supplyStatus} />
                    <LinkButton href={`/pharmacy/dispense?rx=${r.code}`} size="xs" variant={r.supplyStatus === "dispensed" ? "outline" : "primary"}>
                      {r.supplyStatus === "dispensed" ? "View" : "Dispense"}
                    </LinkButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

async function RxDispense({ code }: { code: string }) {
  const rx = await getPrescription({ code: code.toUpperCase() });
  if (!rx) {
    return (
      <div className="space-y-4">
        <Alert tone="danger" title="Prescription not found">
          No prescription with code “{code}”. Check the code or search by UHID.
        </Alert>
        <Card>
          <CardBody>
            <SearchBox q="" />
          </CardBody>
        </Card>
      </div>
    );
  }

  const stockedItems = rx.items.filter((i) => i.medicineId != null);
  const medIds = stockedItems.map((i) => i.medicineId!);
  const [sellable, meds, bills, discount] = await Promise.all([
    sellableStock(medIds),
    medIds.length ? db.select().from(medicines).where(inArray(medicines.id, medIds)) : Promise.resolve([]),
    billsForPrescription(rx.id),
    getNumberSetting("pharmacyDiscountPercent"),
  ]);
  const medById = new Map(meds.map((m) => [m.id, m]));
  const lines: RxBillLine[] = stockedItems.map((i) => {
    const m = medById.get(i.medicineId!)!;
    return {
      prescriptionItemId: i.id,
      medicineId: m.id,
      name: m.name,
      unitLabel: m.unitLabel,
      unitPrice: m.unitPrice,
      prescribed: i.quantity,
      supplied: i.supplied,
      remaining: i.remaining,
      sellable: sellable.get(m.id) ?? 0,
      frequency: i.frequency,
      durationDays: i.durationDays,
    };
  });
  const notStocked = rx.items.filter((i) => i.medicineId == null).map((i) => i.medicineName);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`/pharmacy/dispense?q=${encodeURIComponent(rx.patient.uhid)}`} variant="ghost" size="sm">
            ← {rx.patient.name}&apos;s prescriptions
          </LinkButton>
          <SupplyBadge status={rx.supplyStatus} />
        </div>
        {rx.supplyStatus === "dispensed" && (
          <Alert tone="success" title="Fully dispensed">
            Every stocked medicine on this prescription has already been supplied. Use the override only if the doctor has approved extra quantity.
          </Alert>
        )}
        <PrescriptionDocument rx={rx} showSupply />
        {bills.length > 0 && (
          <Card>
            <CardHeader title="Bills against this prescription" icon={<ReceiptText />} />
            <ul className="divide-y divide-line">
              {bills.map((b) => (
                <li key={b.code} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                  <Link href={`/pharmacy/sales/${b.code}`} className="tabular font-semibold text-brand-700 hover:underline">
                    {b.code}
                  </Link>
                  <span className="text-ink-500">
                    {fmtDateTime(b.createdAt)} · {b.pharmacist}
                  </span>
                  <span className="tabular font-semibold text-ink-900">{inr(b.total, { paise: true })}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <div className="xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader title="Bill this prescription" description={`${rx.patient.name} · ${rx.patient.uhid}`} icon={<ReceiptText />} />
          <CardBody>
            <RxBillForm
              prescriptionId={rx.id}
              rxCode={rx.code}
              patientName={rx.patient.name}
              lines={lines}
              notStocked={notStocked}
              defaultDiscount={discount}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
