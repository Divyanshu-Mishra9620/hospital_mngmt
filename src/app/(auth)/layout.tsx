import Link from "next/link";
import { BadgeCheck, CalendarCheck, ShieldCheck, Video } from "lucide-react";
import { Logo } from "@/components/logo";
import { HOSPITAL } from "@/lib/constants";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Brand panel (laptop) */}
      <aside className="relative hidden overflow-hidden bg-brand-950 text-brand-100 lg:flex lg:flex-col">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 10%, rgb(29 127 143 / 0.55), transparent 70%), radial-gradient(50% 40% at 90% 90%, rgb(229 154 31 / 0.25), transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-16">
          <Logo inverted />
          <div className="max-w-md">
            <p className="eyebrow text-accent-500!">Patient & staff portal</p>
            <h2 className="mt-3 text-4xl font-bold leading-[1.15] text-white">
              Your health records, appointments and medicines — in one place.
            </h2>
            <ul className="mt-8 space-y-4 text-[0.9375rem]">
              {[
                { icon: CalendarCheck, text: "Book OPD or video consultations with real-time slot availability" },
                { icon: Video, text: "Consult your doctor from home — video visits from ₹350" },
                { icon: BadgeCheck, text: "Digital prescriptions, diet plans and lab advice after every visit" },
                { icon: ShieldCheck, text: "Your data is encrypted and visible only to your care team" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-accent-500">
                    <Icon className="size-[1.125rem]" />
                  </span>
                  <span className="pt-1.5 text-brand-100">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-brand-300">
            Need help signing in? Call <a href={HOSPITAL.phoneHref} className="font-semibold text-white">{HOSPITAL.phone}</a>
          </p>
        </div>
      </aside>

      {/* Form column */}
      <main className="flex flex-col bg-white">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8 lg:justify-end">
          <span className="lg:hidden">
            <Logo />
          </span>
          <Link href="/" className="text-sm font-medium text-ink-500 hover:text-brand-700">
            ← Back to website
          </Link>
        </div>
        <div className="flex flex-1 items-start justify-center px-5 pb-12 pt-4 sm:items-center sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
