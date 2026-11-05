import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Bike, Check, ClipboardCheck, MapPin, Phone, Store, UserRound } from "lucide-react";
import { getOrder } from "@/lib/pharmacy-queries";
import { fmtDateTime, inr } from "@/lib/format";
import type { OrderStatus } from "@/db/schema";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, DescriptionList, KeyValue, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { OrderStatusBadge } from "@/components/status";
import { PrintButton } from "@/components/print-button";
import { OrderActions } from "@/components/pharmacy/order-actions";
import { ExpiryText, paymentMethodLabel } from "@/components/pharmacy/bits";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Order ${code}` };
}

export default async function OrderDetailPage({ params }: Props) {
  const { code } = await params;
  const data = await getOrder(decodeURIComponent(code));
  if (!data) notFound();
  const o = data.order;

  const steps: { key: OrderStatus; label: string }[] =
    o.fulfilment === "pickup"
      ? [
          { key: "placed", label: "Placed" },
          { key: "processing", label: "Packing" },
          { key: "ready", label: "Ready for pickup" },
          { key: "completed", label: "Collected" },
        ]
      : [
          { key: "placed", label: "Placed" },
          { key: "processing", label: "Packing" },
          { key: "out_for_delivery", label: "Out for delivery" },
          { key: "completed", label: "Delivered" },
        ];
  const currentIdx = steps.findIndex((s) => s.key === o.status);

  return (
    <>
      <PageHeader
        back={{ href: "/pharmacy/orders", label: "Online orders" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="tabular">{o.code}</span> <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} />
          </span>
        }
        description={`Placed ${fmtDateTime(o.createdAt)} · last updated ${fmtDateTime(o.updatedAt)}${data.handledByName ? ` by ${data.handledByName}` : ""}`}
        actions={<PrintButton label="Print packing slip" />}
      />

      {o.status === "cancelled" ? (
        <Alert tone="danger" title="Order cancelled" className="mb-5">
          {o.notes ?? "This order was cancelled."} Payment status: {o.paymentStatus}.
        </Alert>
      ) : (
        <ol className="no-print mb-5 grid grid-cols-4 gap-1.5 sm:gap-3" aria-label="Order progress">
          {steps.map((s, i) => {
            const done = i < currentIdx || o.status === "completed";
            const current = i === currentIdx && o.status !== "completed";
            return (
              <li key={s.key} className="min-w-0">
                <div className={cn("h-1.5 rounded-full", done ? "bg-success-600" : current ? "bg-brand-500" : "bg-surface-2")} />
                <p className={cn("mt-1.5 flex items-center gap-1 truncate text-xs font-semibold sm:text-sm", done ? "text-success-700" : current ? "text-brand-700" : "text-ink-400")}>
                  {done && <Check className="size-3.5 shrink-0" aria-hidden />}
                  {s.label}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Items to pick" description="Rack locations and batches allocated (earliest expiry first)" icon={<ClipboardCheck />} />
            <TableWrap>
              <thead>
                <tr>
                  <Th>Medicine</Th>
                  <Th>Rack</Th>
                  <Th>Batch / expiry</Th>
                  <Th>Prescription</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => {
                  return (
                    <tr key={it.id}>
                      <Td>
                        <p className="font-semibold text-ink-900">{it.name}</p>
                        <p className="tabular text-xs text-ink-500">
                          {it.sku} · {inr(it.unitPrice, { paise: true })} / {it.unitLabel}
                        </p>
                      </Td>
                      <Td className="tabular font-semibold text-ink-800">{it.rack ?? "—"}</Td>
                      <Td>
                        <BatchList batches={data.batchesByMedicine[it.medicineId] ?? []} />
                      </Td>
                      <Td>
                        {it.rxCode ? (
                          <>
                            <p className="tabular text-sm text-ink-800">{it.rxCode}</p>
                            <p className="text-xs text-ink-500">
                              {it.doctorName} · {it.frequency} × {it.durationDays}d
                            </p>
                          </>
                        ) : it.rxRequired ? (
                          <Badge tone="danger">Rx missing</Badge>
                        ) : (
                          <Badge>OTC</Badge>
                        )}
                      </Td>
                      <Td className="tabular text-right font-semibold">{it.quantity}</Td>
                      <Td className="tabular text-right">{inr(it.lineTotal, { paise: true })}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            <CardBody className="border-t border-line">
              <div className="ml-auto max-w-xs">
                <KeyValue k="Subtotal" v={inr(o.subtotal, { paise: true })} />
                <KeyValue k="Discount" v={`− ${inr(o.discount, { paise: true })}`} />
                <KeyValue k="Delivery fee" v={o.deliveryFee ? inr(o.deliveryFee, { paise: true }) : "Free"} />
                <KeyValue k="Total" v={<span className="text-base font-bold text-ink-900">{inr(o.total, { paise: true })}</span>} className="border-t border-line pt-2" />
                <p className="mt-1 text-right text-xs text-ink-500">
                  Paid online via {paymentMethodLabel(o.paymentMethod)} · {o.paymentStatus}
                </p>
              </div>
            </CardBody>
          </Card>
          {o.notes && o.status !== "cancelled" && (
            <Card>
              <CardHeader title="Notes" />
              <CardBody className="whitespace-pre-line text-sm text-ink-700">{o.notes}</CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          {o.status !== "completed" && o.status !== "cancelled" && (
            <Card className="no-print">
              <CardHeader title="Next step" />
              <CardBody>
                <OrderActions code={o.code} status={o.status} fulfilment={o.fulfilment} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Patient" icon={<UserRound />} />
            <CardBody className="space-y-4">
              <DescriptionList
                cols={1}
                items={[
                  { label: "Name", value: data.patientName },
                  { label: "UHID", value: <span className="tabular">{data.uhid}</span> },
                  {
                    label: "Contact",
                    value: (
                      <a href={`tel:${data.patientPhone?.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-brand-700 hover:underline">
                        <Phone className="size-3.5" aria-hidden /> {data.patientPhone}
                      </a>
                    ),
                  },
                ]}
              />
              {data.allergies && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700">Allergy: {data.allergies}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={o.fulfilment === "delivery" ? "Home delivery" : "Counter pickup"} icon={o.fulfilment === "delivery" ? <Bike /> : <Store />} />
            <CardBody className="text-sm text-ink-700">
              {o.fulfilment === "delivery" ? (
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                  {o.deliveryAddress ?? "No address provided"}
                </p>
              ) : (
                <p>Patient collects from the pharmacy counter, Block A ground floor. Verify UHID before handing over.</p>
              )}
            </CardBody>
          </Card>
          <LinkButton href={`/pharmacy/dispense?q=${encodeURIComponent(data.uhid)}`} variant="outline" block className="no-print">
            Patient&apos;s prescriptions
          </LinkButton>
        </div>
      </div>
    </>
  );
}

function BatchList({ batches }: { batches: { batchNo: string | null; expiry: string | null; qty: number }[] }) {
  if (!batches.length) return <span className="text-ink-400">—</span>;
  return (
    <ul className="space-y-0.5 text-xs">
      {batches.map((b, i) => (
        <li key={i} className="tabular">
          <span className="font-semibold text-ink-800">{b.batchNo ?? "—"}</span> · <ExpiryText date={b.expiry} compact /> · {b.qty}
        </li>
      ))}
    </ul>
  );
}
