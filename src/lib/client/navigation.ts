/**
 * Local-storage mode: actions run in the browser, so a redirect thrown after a
 * data change can be lost if the form that started it unmounts first (e.g. the
 * checkout form disappears when the cart empties). This redirect schedules the
 * navigation itself *and* throws like next/navigation's, so it always lands
 * and still stops the calling code.
 */
import { redirect as nextRedirect } from "next/navigation";

type Navigate = (url: string, mode: "push" | "replace") => void;

let navigate: Navigate | null = null;
let scheduled: string | null = null;

/** Registered by <RouterBridge /> in the root layout. */
export function setNavigator(fn: Navigate | null) {
  navigate = fn;
}

/** True if a redirect to `url` is already on its way (lets ClientPage skip a duplicate). */
export function isScheduled(url: string) {
  return scheduled === url;
}

export function redirect(url: string, mode: "push" | "replace" = "push"): never {
  if (typeof window !== "undefined") {
    scheduled = url;
    setTimeout(() => {
      if (scheduled !== url) return;
      scheduled = null;
      if (navigate) navigate(url, mode);
      else window.location.assign(url);
    }, 0);
  }
  nextRedirect(url);
}
