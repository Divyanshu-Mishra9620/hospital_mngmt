import type { NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { PURPOSE_LABEL, billingFilters, exportPayments } from "@/lib/admin/billing";

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV export of payments using the same filters as /admin/billing. */
export async function GET(request: NextRequest) {
  const me = await requireAdmin();
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const f = billingFilters(sp);
  const rows = await exportPayments(f.where);
  const header = ["Payment code", "Date & time (UTC)", "Purpose", "Reference", "Description", "Patient", "UHID", "Method", "Status", "Amount (INR)"];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((r) =>
      [r.code, r.createdAt, PURPOSE_LABEL[r.purpose], r.reference, r.description, r.patientName ?? "Walk-in", r.uhid ?? "", r.method.toUpperCase(), r.status, r.amount.toFixed(2)]
        .map(csvCell)
        .join(","),
    ),
  ];
  await audit({ id: me.id, name: me.name, role: me.role }, "export", "payments", null, `${rows.length} rows · ${f.from} to ${f.to}`);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="medora-payments-${f.from}-to-${f.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
