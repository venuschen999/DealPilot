import { describe, expect, it } from "vitest";
import { emailSignInSchema, resolveSignInView } from "./sign-in-view";

describe("emailSignInSchema", () => {
  it("US-8 AC: accepts an email and normalizes it", () => {
    const parsed = emailSignInSchema.parse({
      email: "  You@Example.COM ",
      callbackUrl: "/results?q=x",
    });
    expect(parsed).toEqual({
      email: "you@example.com",
      callbackUrl: "/results?q=x",
    });
  });

  it.each([
    "",
    "not-an-email",
    "a@",
    "@b.com",
    "x".repeat(250) + "@example.com",
  ])("rejects invalid email %j", (email) => {
    expect(
      emailSignInSchema.safeParse({ email, callbackUrl: "/" }).success,
    ).toBe(false);
  });

  it("replaces an unsafe callbackUrl with /", () => {
    const parsed = emailSignInSchema.parse({
      email: "you@example.com",
      callbackUrl: "https://evil.example",
    });
    expect(parsed.callbackUrl).toBe("/");
  });

  it("defaults a missing callbackUrl to /", () => {
    expect(
      emailSignInSchema.parse({ email: "you@example.com" }).callbackUrl,
    ).toBe("/");
  });
});

describe("resolveSignInView", () => {
  it("shows the sign-in form by default", () => {
    expect(resolveSignInView({}, false)).toEqual({
      kind: "form",
      callbackUrl: "/",
    });
  });

  it("US-8 AC: shows Check your email after a link is sent", () => {
    expect(resolveSignInView({ sent: "1" }, false)).toEqual({
      kind: "check-email",
      callbackUrl: "/",
    });
  });

  it("US-8 AC: shows This link no longer works for an expired or used link", () => {
    expect(resolveSignInView({ error: "Verification" }, false)).toEqual({
      kind: "link-expired",
      callbackUrl: "/",
    });
  });

  it("shows an inline error for an invalid email", () => {
    expect(resolveSignInView({ error: "EmailInvalid" }, false)).toEqual({
      kind: "form",
      callbackUrl: "/",
      formError: "email",
    });
  });

  it.each(["OAuthCallbackError", "Configuration", "AccessDenied", "Something"])(
    "shows a generic error for Auth.js error %s",
    (error) => {
      expect(resolveSignInView({ error }, false)).toMatchObject({
        kind: "form",
        formError: "generic",
      });
    },
  );

  it("shows You're signed in when a session already exists", () => {
    expect(
      resolveSignInView({ sent: "1", callbackUrl: "/results" }, true),
    ).toEqual({
      kind: "signed-in",
      callbackUrl: "/results",
    });
  });

  it("US-8 AC: carries a safe callbackUrl through every state", () => {
    expect(
      resolveSignInView({ callbackUrl: "/compare?ids=a,b" }, false).callbackUrl,
    ).toBe("/compare?ids=a,b");
    expect(
      resolveSignInView({ callbackUrl: "//evil.example" }, false).callbackUrl,
    ).toBe("/");
  });

  it("uses the first value when a param is repeated", () => {
    expect(
      resolveSignInView({ callbackUrl: ["/results", "//evil"] }, false)
        .callbackUrl,
    ).toBe("/results");
  });
});
