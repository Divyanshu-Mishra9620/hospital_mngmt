import Link from "next/link";
import { Building2, Languages, Video } from "lucide-react";
import { Avatar, Stars } from "@/components/ui/misc";
import { buttonStyles } from "@/components/ui/button";
import { inr } from "@/lib/format";
import type { PublicDoctor } from "@/lib/queries/public";

export function DoctorCard({ d }: { d: PublicDoctor }) {
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft">
      <div className="flex items-start gap-3.5">
        <Avatar name={d.name} color={d.doctor.avatarColor} size="lg" />
        <div className="min-w-0">
          <h3 className="text-[1.0625rem] font-bold leading-snug">
            <Link href={`/doctors/${d.doctor.code}`} className="after:absolute after:inset-0 group-hover:text-brand-700">
              {d.name}
            </Link>
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-600">{d.doctor.designation}</p>
          <p className="mt-1 text-xs font-medium text-brand-700">{d.deptName}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-1 text-xs text-ink-500">{d.doctor.qualifications}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
        <span>{d.doctor.experienceYears}+ years</span>
        {d.rating.n > 0 && (
          <span className="inline-flex items-center gap-1">
            <Stars value={d.rating.avg} /> {d.rating.avg.toFixed(1)} ({d.rating.n})
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Languages className="size-3.5" aria-hidden /> {d.doctor.languages.split(",").slice(0, 2).join(",")}
        </span>
      </div>
      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2 border-t border-line pt-4 text-sm">
          <span className="inline-flex items-center gap-1.5 text-ink-700">
            <Building2 className="size-4 text-ink-400" aria-hidden /> {inr(d.doctor.inPersonFee)}
          </span>
          {d.doctor.videoEnabled && (
            <span className="inline-flex items-center gap-1.5 text-violet-700">
              <Video className="size-4" aria-hidden /> {inr(d.doctor.videoFee)}
            </span>
          )}
          <Link href={`/book?doctor=${d.doctor.code}`} className={buttonStyles({ size: "sm", className: "relative z-10 ml-auto" })}>
            Book
          </Link>
        </div>
      </div>
    </article>
  );
}
