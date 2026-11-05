"use client";

import { ClientPage } from "@/components/client-page";
import { MobileActionBar, SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ROLE_HOME } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";

async function __render({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>
      <SiteHeader portalHref={session ? ROLE_HOME[session.role] : null} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <MobileActionBar />
    </div>
  );
}

export default function LayoutView(props: Parameters<typeof __render>[0]) {
  return <ClientPage render={__render} props={props} />;
}
