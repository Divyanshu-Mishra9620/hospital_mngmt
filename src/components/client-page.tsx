"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isScheduled } from "@/lib/client/navigation";
import { getVersion, ready, subscribe } from "@/lib/client/store";
import { buttonStyles } from "@/components/ui/button";

const ChildrenContext = createContext<ReactNode>(null);
function ChildrenSlot() {
  return <>{useContext(ChildrenContext)}</>;
}

function digestOf(err: unknown) {
  return typeof err === "object" && err && "digest" in err ? String((err as { digest: unknown }).digest) : "";
}

/**
 * Runs a page/layout's async loader in the browser against the local database
 * and renders the result. Re-runs when data changes (any action that saves),
 * and turns redirect()/notFound() from the loader into client navigation.
 */
export function ClientPage<P extends object>({ render, props }: { render: (props: P) => Promise<ReactNode>; props: P }) {
  const router = useRouter();
  const version = useSyncExternalStore(subscribe, getVersion, () => -1);
  const [node, setNode] = useState<ReactNode>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [slow, setSlow] = useState(false);

  // Layout children are rendered through a slot so they're always current.
  const hasChildren = "children" in props;
  const { children, rest } = useMemo(() => {
    const { children: c, ...r } = props as P & { children?: ReactNode };
    return { children: c, rest: r };
  }, [props]);
  // Re-run the loader only when non-children props (params/searchParams) change.
  const deps = Object.values(rest);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => alive && setSlow(true), 700);
    (async () => {
      try {
        await ready();
        const loaderProps = (hasChildren ? { ...rest, children: <ChildrenSlot /> } : rest) as P;
        const result = await render(loaderProps);
        if (!alive) return;
        setNode(result);
        setStatus("ready");
      } catch (err) {
        if (!alive) return;
        const digest = digestOf(err);
        if (digest.startsWith("NEXT_REDIRECT")) {
          const [, mode, url] = digest.split(";");
          if (isScheduled(url)) return; // the redirect helper is already navigating
          if (mode === "push") router.push(url);
          else router.replace(url);
          return;
        }
        if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404") || digest === "NEXT_NOT_FOUND") {
          setStatus("notfound");
          return;
        }
        console.error(err);
        setStatus("error");
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render, version, ...deps]);

  if (status === "notfound") {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="font-display text-5xl font-extrabold text-brand-600">404</p>
        <h1 className="mt-3 text-xl font-bold">We couldn&apos;t find that</h1>
        <p className="mt-2 text-ink-600">The record may have been removed, or the link is incorrect.</p>
        <Link href="/" className={buttonStyles({ className: "mt-6" })}>
          Go to homepage
        </Link>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-ink-600">Please reload the page. If it keeps happening, reset the demo data from the sign-in page.</p>
        <button type="button" onClick={() => window.location.reload()} className={buttonStyles({ className: "mt-6" })}>
          Reload
        </button>
      </div>
    );
  }
  if (node == null) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center text-ink-500" role="status">
        <Loader2 className="size-6 animate-spin text-brand-600" aria-hidden />
        {slow && <p className="text-sm">Loading… (the first visit sets up the demo hospital in your browser)</p>}
      </div>
    );
  }
  return hasChildren ? <ChildrenContext.Provider value={children}>{node}</ChildrenContext.Provider> : <>{node}</>;
}
