import { describe, expect, it, vi } from "vitest";
import { buildMagicLinkEmail, sendMagicLink } from "./magic-link-email";

const LINK =
  "http://localhost:3000/api/auth/callback/resend?token=abc&email=you%40example.com";

describe("buildMagicLinkEmail", () => {
  const email = buildMagicLinkEmail(LINK);

  it("US-8 AC: uses the subject from the design", () => {
    expect(email.subject).toBe("Sign in to DealPilot");
  });

  it("US-8 AC: says the link works once and expires in 24 hours", () => {
    for (const body of [email.text, email.html]) {
      expect(body).toContain("works once");
      expect(body).toContain("expires in 24 hours");
      expect(body).toContain("you can ignore it");
    }
  });

  it("includes the link in the text version", () => {
    expect(email.text).toContain(LINK);
  });

  it("has a Sign in to DealPilot button pointing at the HTML-escaped link", () => {
    expect(email.html).toContain(`href="${LINK.replace(/&/g, "&amp;")}"`);
    expect(email.html).toMatch(/>\s*Sign in to DealPilot\s*</);
  });

  it("escapes the link so it cannot break out of the attribute", () => {
    const html = buildMagicLinkEmail(
      'https://x.test/"><script>alert(1)</script>',
    ).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });
});

describe("sendMagicLink", () => {
  const params = { to: "you@example.com", url: LINK };

  it("prints the link to the server console in development instead of emailing", async () => {
    const log = vi.fn();
    const fetchFn = vi.fn<typeof fetch>();
    await sendMagicLink(params, { nodeEnv: "development", log, fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining(LINK));
  });

  it("sends through Resend in production and never logs the link", async () => {
    const log = vi.fn();
    const fetchFn = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 200 }),
    );
    await sendMagicLink(params, {
      nodeEnv: "production",
      log,
      fetchFn,
      apiKey: "re_test",
      from: "DealPilot <no-reply@dealpilot.app>",
    });

    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe("https://api.resend.com/emails");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer re_test",
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: "DealPilot <no-reply@dealpilot.app>",
      to: "you@example.com",
      subject: "Sign in to DealPilot",
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("refuses to send in production without an API key or sender", async () => {
    await expect(
      sendMagicLink(params, {
        nodeEnv: "production",
        fetchFn: vi.fn<typeof fetch>(),
      }),
    ).rejects.toThrow(/AUTH_RESEND_KEY/);
  });

  it("reports a provider failure without leaking the API key", async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () => new Response("bad key re_test", { status: 401 }),
    );
    const error = await sendMagicLink(params, {
      nodeEnv: "production",
      fetchFn,
      apiKey: "re_test",
      from: "DealPilot <no-reply@dealpilot.app>",
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("401");
    expect((error as Error).message).not.toContain("re_test");
  });
});
