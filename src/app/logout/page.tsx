"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { destroySession } from "@/lib/auth/session";

/** Signs this tab out (local storage mode) and returns to the sign-in page. */
export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    void destroySession().then(() => router.replace(error ? `/login?error=${encodeURIComponent(error)}` : "/login?signedout=1"));
  }, [router]);
  return (
    <div className="flex min-h-dvh items-center justify-center gap-2 text-ink-500" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden /> Signing out…
    </div>
  );
}
