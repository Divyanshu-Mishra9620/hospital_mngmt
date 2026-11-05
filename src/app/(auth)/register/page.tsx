import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create patient account" };

export default function RegisterPage() {
  return (
    <div className="animate-fade-up">
      <h1 className="text-[1.75rem] font-bold">Create your patient account</h1>
      <p className="mt-1.5 text-ink-500">You&apos;ll get a Unique Health ID (UHID) instantly — use it for appointments, the pharmacy and your records.</p>
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-ink-500">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
