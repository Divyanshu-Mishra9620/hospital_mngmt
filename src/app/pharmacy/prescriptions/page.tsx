import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Search } from "lucide-react";
import { prescriptionRegister } from "@/lib/pharmacy-queries";
import { fmtDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { SupplyBadge } from "@/components/status";

export const metadata: Metadata = { title: "Prescription register" };

export default async function PrescriptionRegisterPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const status = ["not_dispensed", "partial", "dispensed"].includes(sp.status ?? "") ? sp.status : undefined;
  const q = sp.q?.trim() || undefined;
  const rows = await prescriptionRegister({ q, status, limit: 150 });

  return (
    <>
      <PageHeader title="Prescription register" description="Prescriptions written by Medora doctors, with what the pharmacy has supplied against each." />
      <Card>
        <form className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:p-5">
          <Input name="q" defaultValue={q} placeholder="Rx code, patient, UHID, doctor or diagnosis" className="sm:max-w-md" aria-label="Search prescriptions" />
          <Select name="status" defaultValue={status ?? ""} className="sm:w-52" aria-label="Supply status">
            <option value="">All supply states</option>
            <option value="not_dispensed">Not dispensed</option>
            <option value="partial">Partly dispensed</option>
            <option value="dispensed">Dispensed</option>
          </Select>
          <Button type="submit" variant="secondary">
            <Search aria-hidden /> Search
          </Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={<ClipboardList />} title="No prescriptions match" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Rx</Th>
                <Th>Patient</Th>
                <Th>Prescribed by</Th>
                <Th>Diagnosis</Th>
                <Th className="text-right">Items</Th>
                <Th>Supply</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface/60">
                  <Td>
                    <Link href={`/pharmacy/dispense?rx=${r.code}`} className="tabular font-semibold text-brand-700 hover:underline">
                      {r.code}
                    </Link>
                    <p className="whitespace-nowrap text-xs text-ink-500">{fmtDateTime(r.createdAt)}</p>
                  </Td>
                  <Td>
                    <p className="font-medium text-ink-800">{r.patientName}</p>
                    <p className="tabular text-xs text-ink-500">{r.uhid}</p>
                  </Td>
                  <Td>
                    <p className="text-ink-800">{r.doctorName}</p>
                    <p className="text-xs text-ink-500">{r.department}</p>
                  </Td>
                  <Td>
                    <p className="max-w-[18rem] truncate text-ink-700" title={r.diagnosis}>
                      {r.diagnosis}
                    </p>
                  </Td>
                  <Td className="tabular text-right">{r.items}</Td>
                  <Td>
                    <SupplyBadge status={r.supplyStatus} />
                  </Td>
                  <Td className="text-right">
                    <LinkButton href={`/pharmacy/dispense?rx=${r.code}`} size="xs" variant={r.supplyStatus === "dispensed" ? "outline" : "primary"}>
                      {r.supplyStatus === "dispensed" ? "View" : "Dispense"}
                    </LinkButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
