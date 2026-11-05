"use client";

import { useActionState, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { Field, Input } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";

const DEMO = [
  { role: "Patient", id: "MDR-100101", pw: "Patient@123", who: "Rahul Verma" },
  { role: "Doctor", id: "DOC-1001", pw: "Doctor@123", who: "Dr. Ananya Rao" },
  { role: "Pharmacy", id: "PHA-201", pw: "Pharma@123", who: "Suresh Kumar" },
  { role: "Admin", id: "ADM-001", pw: "Admin@123", who: "Ritu Malhotra" },
];

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, null);
  const [tab, setTab] = useState<"patient" | "staff">("patient");
  const [show, setShow] = useState(false);
  const idRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  function fill(id: string, pw: string) {
    if (idRef.current) idRef.current.value = id;
    if (pwRef.current) pwRef.current.value = pw;
  }

  return (
    <>
      <div className="mt-6 grid grid-cols-2 rounded-xl bg-surface p-1" role="tablist" aria-label="Account type">
        {(["patient", "staff"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "h-10 rounded-lg text-sm font-semibold transition",
              tab === t ? "bg-white text-brand-800 shadow-card" : "text-ink-500 hover:text-ink-800",
            )}
          >
            {t === "patient" ? "Patient" : "Hospital staff"}
          </button>
        ))}
      </div>

      <form action={action} className="mt-6 space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <FormMessage state={state} />
        <Field
          label={tab === "patient" ? "UHID, email or mobile number" : "Staff ID or email"}
          htmlFor="identifier"
          hint={tab === "patient" ? "Your UHID looks like MDR-100101 and is printed on your health card." : "e.g. DOC-1001, PHA-201 or ADM-001"}
        >
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-ink-400" aria-hidden />
            <Input
              ref={idRef}
              id="identifier"
              name="identifier"
              autoComplete="username"
              autoCapitalize="none"
              required
              className="pl-10"
              placeholder={tab === "patient" ? "MDR-100101 or you@email.com" : "DOC-1001"}
            />
          </div>
        </Field>
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-ink-400" aria-hidden />
            <Input ref={pwRef} id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="px-10" />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 hover:text-ink-700"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <SubmitButton block size="lg" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <details className="group mt-6 rounded-xl border border-dashed border-line-strong bg-surface/60 p-4 open:bg-surface/60">
        <summary className="flex items-center justify-between text-sm font-semibold text-ink-700">
          Demo accounts
          <span className="text-xs font-medium text-ink-400 group-open:hidden">Tap to view</span>
        </summary>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {DEMO.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => {
                  setTab(d.role === "Patient" ? "patient" : "staff");
                  fill(d.id, d.pw);
                }}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-left text-xs transition hover:border-brand-300"
              >
                <span className="block font-semibold text-ink-800">
                  {d.role} · {d.who}
                </span>
                <span className="tabular text-ink-500">
                  {d.id} / {d.pw}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
