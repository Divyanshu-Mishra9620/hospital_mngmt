import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Plus, Search } from "lucide-react";
import { inventoryList } from "@/lib/pharmacy-queries";
import { MEDICINE_FORMS } from "@/db/schema";
import { addDays, todayISO } from "@/lib/time";
import { fmtNumber, inr, titleCase } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/ui/misc";
import { StockBadge } from "@/components/status";
import { ExpiryText } from "@/components/pharmacy/bits";

export const metadata: Metadata = { title: "Inventory" };

type SP = { q?: string; category?: string; form?: string; type?: string; state?: string };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const all = await inventoryList();
  const today = todayISO();
  const soon = addDays(today, 90);
  const categories = [...new Set(all.map((m) => m.category))].sort();

  const q = sp.q?.trim().toLowerCase() ?? "";
  const rows = all.filter((m) => {
    if (q && !`${m.name} ${m.genericName} ${m.sku} ${m.manufacturer} ${m.rack ?? ""}`.toLowerCase().includes(q)) return false;
    if (sp.category && m.category !== sp.category) return false;
    if (sp.form && m.form !== sp.form) return false;
    if (sp.type === "rx" && !m.rxRequired) return false;
    if (sp.type === "otc" && m.rxRequired) return false;
    if (sp.state === "low" && !(m.stock > 0 && m.stock <= m.reorderLevel)) return false;
    if (sp.state === "out" && m.stock > 0) return false;
    if (sp.state === "expiring" && !(m.nearestExpiry && m.nearestExpiry <= soon)) return false;
    if (sp.state === "inactive" ? m.active : !m.active && sp.state !== "all") return false;
    return true;
  });

  const active = all.filter((m) => m.active);
  const mrpValue = active.reduce((s, m) => s + m.stock * m.unitPrice, 0);
  const costValue = active.reduce((s, m) => s + m.costValue, 0);
  const low = active.filter((m) => m.stock > 0 && m.stock <= m.reorderLevel).length;
  const out = active.filter((m) => m.stock <= 0).length;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Every medicine stocked by the hospital pharmacy, with live batch-level stock."
        actions={
          <LinkButton href="/pharmacy/inventory/new" size="sm">
            <Plus aria-hidden /> Add medicine
          </LinkButton>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active SKUs" value={fmtNumber(active.length)} sub={`${all.length - active.length} inactive`} icon={<Boxes />} />
        <StatCard label="Stock value (MRP)" value={inr(mrpValue)} sub={`Purchase cost ${inr(costValue)}`} tone="success" />
        <StatCard label="Low stock" value={low} sub="At or below reorder level" tone="warning" href="/pharmacy/inventory?state=low" />
        <StatCard label="Out of stock" value={out} sub="Reorder immediately" tone="danger" href="/pharmacy/inventory?state=out" />
      </div>

      <Card className="mt-5">
        <form className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[2fr_1.3fr_1fr_1fr_1fr_auto] lg:items-end">
          <Field label="Search" htmlFor="q">
            <Input id="q" name="q" defaultValue={sp.q} placeholder="Name, generic, SKU, rack…" />
          </Field>
          <Field label="Category" htmlFor="category">
            <Select id="category" name="category" defaultValue={sp.category ?? ""}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Form" htmlFor="form">
            <Select id="form" name="form" defaultValue={sp.form ?? ""}>
              <option value="">All forms</option>
              {MEDICINE_FORMS.map((f) => (
                <option key={f} value={f}>
                  {titleCase(f)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" htmlFor="type">
            <Select id="type" name="type" defaultValue={sp.type ?? ""}>
              <option value="">Rx & OTC</option>
              <option value="rx">Prescription only</option>
              <option value="otc">OTC</option>
            </Select>
          </Field>
          <Field label="Stock" htmlFor="state">
            <Select id="state" name="state" defaultValue={sp.state ?? ""}>
              <option value="">Active items</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="expiring">Expiring ≤ 90 days</option>
              <option value="inactive">Inactive</option>
              <option value="all">Everything</option>
            </Select>
          </Field>
          <Button type="submit" variant="secondary">
            <Search aria-hidden /> Filter
          </Button>
        </form>
        <p className="px-4 py-2.5 text-sm text-ink-500 sm:px-5">
          Showing {rows.length} of {all.length} medicines
        </p>
        {rows.length === 0 ? (
          <EmptyState icon={<Boxes />} title="No medicines match these filters" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Medicine</Th>
                <Th>Category</Th>
                <Th>Type</Th>
                <Th className="text-right">MRP / unit</Th>
                <Th>Stock</Th>
                <Th className="text-right">Reorder at</Th>
                <Th>Nearest expiry</Th>
                <Th>Rack</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={m.active ? "hover:bg-surface/60" : "bg-surface/50 text-ink-400"}>
                  <Td>
                    <Link href={`/pharmacy/inventory/${m.sku}`} className="font-semibold text-ink-900 hover:text-brand-700">
                      {m.name}
                    </Link>
                    <p className="text-xs text-ink-500">
                      <span className="tabular">{m.sku}</span> · {m.genericName}
                    </p>
                  </Td>
                  <Td className="text-ink-600">
                    {m.category}
                    <p className="text-xs text-ink-400">{titleCase(m.form)}</p>
                  </Td>
                  <Td>{m.rxRequired ? <Badge tone="danger">Rx</Badge> : <Badge tone="success">OTC</Badge>}</Td>
                  <Td className="tabular text-right">
                    {inr(m.unitPrice, { paise: true })}
                    <p className="text-xs text-ink-400">per {m.unitLabel}</p>
                  </Td>
                  <Td>
                    {m.active ? <StockBadge stock={m.stock} reorderLevel={m.reorderLevel} /> : <Badge>Inactive</Badge>}
                    {m.sellable < m.stock && <p className="mt-0.5 text-xs text-danger-700">{m.stock - m.sellable} expired</p>}
                  </Td>
                  <Td className="tabular text-right text-ink-600">{m.reorderLevel}</Td>
                  <Td>
                    <ExpiryText date={m.nearestExpiry} compact />
                  </Td>
                  <Td className="tabular text-ink-600">{m.rack ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
