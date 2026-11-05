"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { PURPOSE_LABEL, billingFilters, exportPayments } from "@/lib/admin/billing";

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Builds the payments CSV in the browser (local storage mode) with the page's filters. */
export function ExportCsvButton({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const me = await requireAdmin();
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
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medora-payments-${f.from}-to-${f.to}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} Export CSV
    </Button>
  );
}
