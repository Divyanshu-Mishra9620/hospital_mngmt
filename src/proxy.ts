import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";
import type { Role } from "@/db/schema";

/**
 * Optimistic route protection: bounce signed-out visitors to /login and send
 * users to their own portal. Real authorisation happens in requireUser().
 */
const AREAS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/patient", roles: ["patient"] },
  { prefix: "/doctor", roles: ["doctor"] },
  { prefix: "/pharmacy", roles: ["pharmacist", "admin"] },
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/consult", roles: ["patient", "doctor"] },
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const area = AREAS.find((a) => pathname === a.prefix || pathname.startsWith(a.prefix + "/"));
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (area) {
    if (!session) {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    if (!area.roles.includes(session.role)) {
      return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
    }
  }

  if ((pathname === "/login" || pathname === "/register") && session && !request.nextUrl.searchParams.has("error")) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*", "/pharmacy/:path*", "/admin/:path*", "/consult/:path*", "/login", "/register"],
};
