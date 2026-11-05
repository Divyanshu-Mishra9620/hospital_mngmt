"use client";

import { ClientPage } from "@/components/client-page";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Check, MapPin, Store } from "lucide-react";
import { db } from "@/db";
import { pharmacyOrderItems, pharmacyOrders, prescriptionItems, prescriptions } from "@/db/schema";
import { PrintButton } from "@/components/print-button";
import { OrderStatusBadge } from "@/components/status";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, KeyValue, PageHeader } from "@/components/ui/misc";
import { requirePatient } from "@/lib/auth/session";
import { HOSPITAL } from "@/lib/constants";
import { fmtDateTime, inr } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CancelOrder } from "./cancel-order";

async function __render({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ placed?: string }> }) {
  const { code } = await params;
  const sp = await searchParams;
  const { patient } = await requirePatient();
  const [order] = await db.select().from(pharmacyOrders).where(and(eq(pharmacyOrders.code, code), eq(pharmacyOrders.patientId, patient.id)));
  if (!order) notFound();
  const items = await db
    .select({ item: pharmacyOrderItems, rxCode: prescriptions.code })
    .from(pharmacyOrderItems)
    .leftJoin(prescriptionItems, eq(prescriptionItems.id, pharmacyOrderItems.prescriptionItemId))
    .leftJoin(prescriptions, eq(prescriptions.id, prescriptionItems.prescriptionId))
    .where(eq(pharmacyOrderItems.orderId, order.id));

  const flow: string[] = order.fulfilment === "pickup" ? ["placed", "processing", "ready", "completed"] : ["placed", "processing", "out_for_delivery", "completed"];
  const labels: Record<string, string> = {
    placed: "Order placed",
    processing: "Being packed",
    ready: "Ready for pickup",
    out_for_delivery: "Out for delivery",
    completed: order.fulfilment === "pickup" ? "Collected" : "Delivered",
  };
  const idx = flow.indexOf(order.status);

  return (
    <div>
      <PageHeader
        title="Order details"
        description={<span className="tabular">{order.code}</span>}
        back={{ href: "/patient/orders", label: "Orders" }}
        actions={<PrintButton label="Print invoice" />}
      />
      {sp.placed === "1" && (
        <Alert tone="success" title="Order placed" className="mb-5">
          Payment received. We&apos;ll notify you at every step.
        </Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <div className="space-y-5">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between gap-3">
                <OrderStatusBadge status={order.status} fulfilment={order.fulfilment} />
                <span className="text-xs text-ink-500">Updated {fmtDateTime(order.updatedAt)}</span>
              </div>
              {order.status === "cancelled" ? (
                <p className="mt-3 text-sm text-ink-600">This order was cancelled{order.notes ? ` (${order.notes})` : ""}. {order.paymentStatus === "refunded" && "The amount has been refunded."}</p>
              ) : (
                <ol className="mt-5 grid grid-cols-4 gap-1">
                  {flow.map((s, i) => (
                    <li key={s} className="flex flex-col items-center text-center">
                      <div className="flex w-full items-center">
                        <span className={cn("h-0.5 flex-1", i === 0 ? "invisible" : i <= idx ? "bg-brand-500" : "bg-line")} />
                        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", i <= idx ? "bg-brand-600 text-white" : "bg-surface-2 text-ink-400")}>
                          {i < idx || order.status === "completed" ? <Check className="size-4" aria-hidden /> : i + 1}
                        </span>
                        <span className={cn("h-0.5 flex-1", i === flow.length - 1 ? "invisible" : i < idx ? "bg-brand-500" : "bg-line")} />
                      </div>
                      <span className={cn("mt-1.5 text-[0.6875rem] font-medium leading-tight sm:text-xs", i <= idx ? "text-ink-900" : "text-ink-400")}>{labels[s]}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Items" />
            <ul className="divide-y divide-line">
              {items.map(({ item, rxCode }) => (
                <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">{item.name}</p>
                    <p className="text-xs text-ink-500">
                      {item.quantity} × {inr(item.unitPrice, { paise: true })}
                      {rxCode && ` · Rx ${rxCode}`}
                    </p>
                  </div>
                  <span className="tabular font-semibold text-ink-800">{inr(item.lineTotal, { paise: true })}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <aside className="space-y-5">
          <Card>
            <CardHeader icon={order.fulfilment === "pickup" ? <Store /> : <MapPin />} title={order.fulfilment === "pickup" ? "Pickup" : "Delivery address"} />
            <CardBody className="text-sm text-ink-600">
              {order.fulfilment === "pickup" ? `Medora Pharmacy, Block A ground floor, ${HOSPITAL.addressLines[0]}. ${HOSPITAL.pharmacyHours}.` : order.deliveryAddress}
            </CardBody>
          </Card>
          <Card className="p-4 sm:p-5">
            <div className="divide-y divide-line">
              <KeyValue k="Subtotal" v={inr(order.subtotal, { paise: true })} />
              <KeyValue k="Discount" v={`− ${inr(order.discount, { paise: true })}`} />
              <KeyValue k="Delivery" v={order.deliveryFee ? inr(order.deliveryFee) : "Free"} />
              <KeyValue k="Total" v={<span className="font-display text-lg font-bold">{inr(order.total, { paise: true })}</span>} />
              <KeyValue k="Payment" v={`${order.paymentMethod.toUpperCase()} · ${order.paymentStatus}`} />
            </div>
          </Card>
          {order.status === "placed" && <CancelOrder code={order.code} />}
        </aside>
      </div>
    </div>
  );
}

export default function PageView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
