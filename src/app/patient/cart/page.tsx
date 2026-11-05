import type { Metadata } from "next";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { removeCartItemAction, updateCartItemAction } from "@/lib/actions/patient";
import { requirePatient } from "@/lib/auth/session";
import { inr, money } from "@/lib/format";
import { suppliedQuantities } from "@/lib/pharmacy";
import { patientCart } from "@/lib/queries/patient";
import { getSettings } from "@/lib/settings";
import { db } from "@/db";
import { prescriptionItems, prescriptions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const { user, patient } = await requirePatient();
  const [lines, settings] = await Promise.all([patientCart(patient.id), getSettings()]);

  const rxItemIds = lines.map((l) => l.item.prescriptionItemId).filter((x): x is number => x != null);
  const rxInfo = rxItemIds.length
    ? await db
        .select({ id: prescriptionItems.id, qty: prescriptionItems.quantity, rxCode: prescriptions.code })
        .from(prescriptionItems)
        .innerJoin(prescriptions, eq(prescriptions.id, prescriptionItems.prescriptionId))
        .where(inArray(prescriptionItems.id, rxItemIds))
    : [];
  const supplied = await suppliedQuantities(rxItemIds);
  const rxById = new Map(rxInfo.map((r) => [r.id, { ...r, remaining: Math.max(0, r.qty - (supplied.get(r.id) ?? 0)) }]));

  if (!lines.length) {
    return (
      <div>
        <PageHeader title="Cart" />
        <Card>
          <EmptyState
            icon={<ShoppingCart />}
            title="Your cart is empty"
            description="Add medicines from a prescription or browse health essentials."
            action={
              <LinkButton href="/patient/pharmacy" size="sm">
                Go to pharmacy
              </LinkButton>
            }
          />
        </Card>
      </div>
    );
  }

  const subtotal = money(lines.reduce((s, l) => s + l.item.quantity * l.med.unitPrice, 0));
  const discountPct = Number(settings.pharmacyDiscountPercent || 0);
  const issues = lines.filter((l) => {
    const rx = l.item.prescriptionItemId ? rxById.get(l.item.prescriptionItemId) : null;
    return l.item.quantity > l.med.stock || (rx && l.item.quantity > rx.remaining) || (l.med.rxRequired && !l.item.prescriptionItemId);
  });

  return (
    <div>
      <PageHeader title="Cart" description={`${lines.length} item${lines.length === 1 ? "" : "s"} from Medora Pharmacy`} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <Card>
          <CardHeader title="Items" />
          <ul className="divide-y divide-line">
            {lines.map(({ item, med }) => {
              const rx = item.prescriptionItemId ? rxById.get(item.prescriptionItemId) : null;
              const max = Math.min(med.stock, rx ? rx.remaining : med.stock);
              const problem = item.quantity > med.stock ? `Only ${med.stock} in stock` : rx && item.quantity > rx.remaining ? `Only ${rx.remaining} left on prescription` : med.rxRequired && !rx ? "Needs a prescription" : null;
              return (
                <li key={item.id} className="flex gap-3 px-4 py-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">{med.name}</p>
                    <p className="text-xs text-ink-500">
                      {med.genericName} · {inr(med.unitPrice, { paise: true })} / {med.unitLabel}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {rx ? <Badge tone="brand">Rx · {rx.rxCode}</Badge> : <Badge tone="neutral">OTC</Badge>}
                      {problem && <Badge tone="danger">{problem}</Badge>}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center rounded-xl border border-line-strong">
                        <form action={updateCartItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="quantity" value={item.quantity - 1} />
                          <button type="submit" className="grid size-9 place-items-center text-ink-600 hover:text-brand-700" aria-label="Decrease quantity">
                            <Minus className="size-4" />
                          </button>
                        </form>
                        <span className="tabular w-10 text-center text-sm font-semibold">{item.quantity}</span>
                        <form action={updateCartItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="quantity" value={item.quantity + 1} />
                          <button type="submit" disabled={item.quantity >= max} className="grid size-9 place-items-center text-ink-600 hover:text-brand-700 disabled:opacity-30" aria-label="Increase quantity">
                            <Plus className="size-4" />
                          </button>
                        </form>
                      </div>
                      <form action={removeCartItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-danger-700">
                          <Trash2 className="size-4" aria-hidden /> Remove
                        </button>
                      </form>
                    </div>
                  </div>
                  <p className="tabular shrink-0 font-semibold text-ink-900">{inr(item.quantity * med.unitPrice, { paise: true })}</p>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line px-4 py-3 text-sm sm:px-5">
            <Link href="/patient/pharmacy" className="font-semibold text-brand-700">
              + Add more items
            </Link>
          </div>
        </Card>

        <CheckoutForm
          subtotal={subtotal}
          discountPct={discountPct}
          deliveryFee={Number(settings.deliveryFee)}
          freeDeliveryAbove={Number(settings.freeDeliveryAbove)}
          defaultAddress={[patient.address, patient.city, patient.pincode].filter(Boolean).join(", ")}
          phone={user.phone ?? ""}
          blocked={issues.length > 0}
        />
      </div>
    </div>
  );
}
