import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "./callback-url";

describe("safeCallbackUrl", () => {
  it.each([
    "/results",
    "/results?q=headphones&budget=200",
    "/compare?ids=a,b",
    "/wishlist#top",
  ])("US-8 AC: returns to the page that sent the user (%s)", (path) => {
    expect(safeCallbackUrl(path)).toBe(path);
  });

  it.each([
    ["absolute URL", "https://evil.example/phish"],
    ["protocol-relative URL", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative without slash", "results"],
    ["encoded double slash", "/%2F%2Fevil.example"],
    ["control characters", "/\t/evil.example"],
  ])("rejects an open redirect: %s", (_label, value) => {
    expect(safeCallbackUrl(value)).toBe("/");
  });

  it.each([undefined, null, "", 42, ["/results"]])(
    "falls back to / for a missing or non-string value (%j)",
    (value) => {
      expect(safeCallbackUrl(value)).toBe("/");
    },
  );

  it("never sends the user back to the sign-in page itself", () => {
    expect(safeCallbackUrl("/sign-in?error=Verification")).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(safeCallbackUrl("https://evil.example", "/results")).toBe(
      "/results",
    );
  });
});
