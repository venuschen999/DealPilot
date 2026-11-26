const PROTECTED_PREFIXES = ["/wishlist", "/admin"];

// Auth.js v5 uses the __Secure- prefix on HTTPS.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function hasSessionCookie(cookieNames: string[]): boolean {
  return cookieNames.some((name) => SESSION_COOKIES.includes(name));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Optimistic only: a cookie can exist for an expired session, so pages still
// call requireUser/requireAdmin. This just skips a render for obvious guests.
export function signInRedirect(
  pathname: string,
  search: string,
  hasSession: boolean,
): string | null {
  if (hasSession || !isProtected(pathname)) return null;
  return `/sign-in?callbackUrl=${encodeURIComponent(pathname + search)}`;
}
