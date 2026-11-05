import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonStyles } from "@/components/ui/button";
import { HOSPITAL } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-6 text-center">
      <Logo />
      <p className="mt-10 font-display text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-ink-600">The page may have moved, or the link may be incorrect.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className={buttonStyles()}>
          Go to homepage
        </Link>
        <Link href="/doctors" className={buttonStyles({ variant: "outline" })}>
          Find a doctor
        </Link>
      </div>
      <p className="mt-10 text-sm text-ink-500">
        Medical emergency? Call <a href={HOSPITAL.emergencyHref} className="font-semibold text-danger-700">{HOSPITAL.emergency}</a>
      </p>
    </div>
  );
}
