"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setNavigator } from "@/lib/client/navigation";
import { ready } from "@/lib/client/store";

/**
 * Mounted once in the root layout: starts loading the in-browser database as
 * soon as any page opens, and lets browser-side actions navigate.
 */
export function DbBoot() {
  const router = useRouter();
  useEffect(() => {
    ready().catch((err) => console.error("Local database failed to load", err));
  }, []);
  useEffect(() => {
    setNavigator((url, mode) => (mode === "replace" ? router.replace(url) : router.push(url)));
    return () => setNavigator(null);
  }, [router]);
  return null;
}
