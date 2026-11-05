import { redirect } from "next/navigation";

/** Public "Book appointment" entry point → patient booking flow (login enforced by proxy). */
export default async function BookRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const k of ["doctor", "mode", "dept"]) {
    const v = sp[k];
    if (typeof v === "string" && /^[\w-]{1,40}$/.test(v)) params.set(k, v);
  }
  if (params.get("doctor") && !params.get("mode")) params.set("mode", "in_person");
  const qs = params.toString();
  redirect(`/patient/book${qs ? `?${qs}` : ""}`);
}
