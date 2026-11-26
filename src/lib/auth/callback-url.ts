const BASE = "http://dealpilot.invalid";

// "Return to where you were" must never become an open redirect, so only
// same-site relative paths pass; anything doubtful falls back.
export function safeCallbackUrl(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (/^\/[/\\]/.test(value) || /^\/[/\\]/.test(decoded)) return fallback;

  const url = new URL(value, BASE);
  if (url.origin !== BASE || url.pathname.startsWith("/sign-in"))
    return fallback;
  return value;
}
