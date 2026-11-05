import { Badge, type Tone } from "@/components/ui/badge";
import { Building2, Video } from "lucide-react";
import type { AppointmentStatus, OrderStatus } from "@/db/schema";

const APPT: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  booked: { label: "Confirmed", tone: "brand" },
  checked_in: { label: "Checked in", tone: "info" },
  in_consult: { label: "In consultation", tone: "violet" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  no_show: { label: "No-show", tone: "neutral" },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const s = APPT[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function appointmentStatusLabel(status: AppointmentStatus) {
  return APPT[status].label;
}

export function ModeBadge({ mode }: { mode: "in_person" | "video" }) {
  return mode === "video" ? (
    <Badge tone="violet">
      <Video className="size-3" aria-hidden /> Video consult
    </Badge>
  ) : (
    <Badge tone="neutral">
      <Building2 className="size-3" aria-hidden /> In-person
    </Badge>
  );
}

const ORDER: Record<OrderStatus, { label: string; tone: Tone }> = {
  placed: { label: "Order placed", tone: "info" },
  processing: { label: "Being packed", tone: "warning" },
  ready: { label: "Ready for pickup", tone: "brand" },
  out_for_delivery: { label: "Out for delivery", tone: "violet" },
  completed: { label: "Delivered / collected", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export function OrderStatusBadge({ status, fulfilment }: { status: OrderStatus; fulfilment?: "pickup" | "delivery" }) {
  const s = ORDER[status];
  const label = status === "completed" && fulfilment ? (fulfilment === "pickup" ? "Collected" : "Delivered") : s.label;
  return (
    <Badge tone={s.tone} dot>
      {label}
    </Badge>
  );
}

export function orderStatusLabel(status: OrderStatus) {
  return ORDER[status].label;
}

export function SupplyBadge({ status }: { status: "not_dispensed" | "partial" | "dispensed" }) {
  if (status === "dispensed") return <Badge tone="success">Dispensed</Badge>;
  if (status === "partial") return <Badge tone="warning">Partly dispensed</Badge>;
  return <Badge tone="neutral">Not dispensed</Badge>;
}

export function StockBadge({ stock, reorderLevel }: { stock: number; reorderLevel: number }) {
  if (stock <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (stock <= reorderLevel) return <Badge tone="warning">Low · {stock}</Badge>;
  return <Badge tone="success">{stock} in stock</Badge>;
}
