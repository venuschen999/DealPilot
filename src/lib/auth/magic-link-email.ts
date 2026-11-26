const RESEND_ENDPOINT = "https://api.resend.com/emails";

const SUBJECT = "Sign in to DealPilot";
const BODY =
  "Click the button below to sign in. This link works once and expires in 24 hours.";
const IGNORE =
  "If you didn't request this email, you can ignore it. No one can sign in without this link.";

export type MagicLinkEmail = { subject: string; text: string; html: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Email clients ignore stylesheets, so this is the one place inline styles
// and literal colors (DESIGN `primary` #1D4ED8, `muted` #4B5563) are allowed.
export function buildMagicLinkEmail(url: string): MagicLinkEmail {
  const href = escapeHtml(url);
  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#111827">
<p style="font-weight:700;font-size:18px">DealPilot</p>
<p>${BODY}</p>
<p><a href="${href}" style="display:inline-block;background:#1D4ED8;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Sign in to DealPilot</a></p>
<p style="color:#4B5563;font-size:13px">${IGNORE}</p>
</body></html>`;
  const text = `${SUBJECT}\n\n${BODY}\n\n${url}\n\n${IGNORE}\n`;
  return { subject: SUBJECT, text, html };
}

type SendDeps = {
  nodeEnv?: string;
  apiKey?: string;
  from?: string;
  fetchFn?: typeof fetch;
  log?: (message: string) => void;
};

export async function sendMagicLink(
  { to, url }: { to: string; url: string },
  { nodeEnv, apiKey, from, fetchFn = fetch, log = console.info }: SendDeps,
): Promise<void> {
  // Development has no mail provider: print the link so sign-in still works.
  // Never in production, where the link is a live credential.
  if (nodeEnv !== "production") {
    log(`[auth] Magic link for ${to}: ${url}`);
    return;
  }
  if (!apiKey || !from) {
    throw new Error(
      "Email sign-in needs AUTH_RESEND_KEY and EMAIL_FROM in production",
    );
  }

  const email = buildMagicLinkEmail(url);
  const response = await fetchFn(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, ...email }),
  });
  // The provider body can echo request details, so only the status is reported.
  if (!response.ok)
    throw new Error(`Magic link email failed: HTTP ${response.status}`);
}
