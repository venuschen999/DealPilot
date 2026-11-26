import { type NextRequest, NextResponse } from "next/server";
import { hasSessionCookie, signInRedirect } from "@/lib/auth/proxy-rules";

// Optimistic redirect only (Next 16 docs): no database call here. Pages call
// requireUser/requireAdmin for the real check.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  const target = signInRedirect(
    pathname,
    search,
    hasSessionCookie(cookieNames),
  );
  return target
    ? NextResponse.redirect(new URL(target, request.url))
    : NextResponse.next();
}

export const config = {
  matcher: ["/wishlist/:path*", "/admin/:path*"],
};
