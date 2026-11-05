import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/jwt";

/** Clears the session cookie. Used by sign-out links and by requireUser() on stale sessions. */
export function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const url = new URL("/login", request.url);
  if (error) url.searchParams.set("error", error);
  else url.searchParams.set("signedout", "1");
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
