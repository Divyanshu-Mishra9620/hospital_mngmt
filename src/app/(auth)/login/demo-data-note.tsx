"use client";

import { useState, useSyncExternalStore } from "react";
import { Database, Loader2, RotateCcw } from "lucide-react";
import { resetDemoData, seededAt } from "@/lib/client/store";
import { fmtDateTime } from "@/lib/format";

const noop = () => () => {};

/** Explains local-storage mode and lets the visitor regenerate the demo data. */
export function DemoDataNote() {
  const created = useSyncExternalStore(noop, seededAt, () => null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    if (!window.confirm("Reset all demo data in this browser? Bookings, orders and prescriptions you created will be removed.")) return;
    setBusy(true);
    try {
      sessionStorage.removeItem("medora.session");
      localStorage.removeItem("medora.session");
      await resetDemoData();
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex gap-3 rounded-xl border border-line bg-white p-4 text-xs text-ink-600">
      <Database className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
      <div className="min-w-0 flex-1">
        <p>
          <span className="font-semibold text-ink-800">Demo mode:</span> all data is stored in this browser (local storage). Use separate tabs to be signed in as a patient and a doctor at
          the same time.
          {created && <> Demo data created {fmtDateTime(created)}.</>}
        </p>
        <button type="button" onClick={reset} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline disabled:opacity-60">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RotateCcw className="size-3.5" aria-hidden />}
          {done ? "Fresh demo data ready" : "Reset demo data"}
        </button>
      </div>
    </div>
  );
}
