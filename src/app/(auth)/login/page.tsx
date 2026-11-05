import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/misc";
import { DemoDataNote } from "./demo-data-note";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  inactive: "Your account is inactive or your session has expired. Please sign in again.",
  profile: "We couldn't load your profile. Please sign in again or contact the help desk.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const signedOut = sp.signedout === "1";

  return (
    <div className="animate-fade-up">
      <h1 className="text-[1.75rem] font-bold">Sign in</h1>
      <p className="mt-1.5 text-ink-500">Patients, doctors, pharmacy staff and administrators sign in here.</p>
      <div className="mt-6 space-y-3">
        {error && <Alert tone="warning">{error}</Alert>}
        {signedOut && <Alert tone="success">You have been signed out securely.</Alert>}
      </div>
      <LoginForm next={next} />
      <DemoDataNote />
      <p className="mt-8 text-center text-sm text-ink-500">
        New to Medora?{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          Create a patient account
        </Link>
      </p>
    </div>
  );
}
