import { describe, expect, it } from "vitest";
import { hasSessionCookie, signInRedirect } from "./proxy-rules";

describe("signInRedirect", () => {
  it.each(["/wishlist", "/admin", "/admin/flags/abc"])(
    "US-8 AC: sends a guest on protected route %s to sign-in",
    (path) => {
      expect(signInRedirect(path, "", false)).toBe(
        `/sign-in?callbackUrl=${encodeURIComponent(path)}`,
      );
    },
  );

  it("keeps the query string in the callback", () => {
    expect(signInRedirect("/wishlist", "?sort=price", false)).toBe(
      "/sign-in?callbackUrl=%2Fwishlist%3Fsort%3Dprice",
    );
  });

  it.each(["/", "/results", "/compare", "/sign-in", "/wishlistings", "/administrator"])(
    "leaves public route %s alone",
    (path) => {
      expect(signInRedirect(path, "", false)).toBeNull();
    },
  );

  it("lets a request with a session cookie through (the page still checks for real)", () => {
    expect(signInRedirect("/admin", "", true)).toBeNull();
  });
});

describe("hasSessionCookie", () => {
  it.each(["authjs.session-token", "__Secure-authjs.session-token"])(
    "recognises the Auth.js cookie %s",
    (name) => {
      expect(hasSessionCookie(["theme", name])).toBe(true);
    },
  );

  it("is false without an Auth.js session cookie", () => {
    expect(hasSessionCookie(["theme", "authjs.csrf-token"])).toBe(false);
  });
});
