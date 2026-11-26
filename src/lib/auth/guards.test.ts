import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, redirect, forbidden } = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN");
  }),
}));

vi.mock("./session", () => ({ getSession: auth }));
vi.mock("next/navigation", () => ({ redirect, forbidden }));

import { requireAdmin, requireUser } from "./guards";

const shopper = {
  id: "u1",
  email: "you@example.com",
  name: "You",
  role: "SHOPPER",
};
const admin = { ...shopper, id: "a1", role: "ADMIN" };

beforeEach(() => {
  auth.mockReset();
  redirect.mockClear();
  forbidden.mockClear();
});

describe("requireUser", () => {
  it("US-8 AC: redirects a guest to sign-in with the page as callbackUrl", async () => {
    auth.mockResolvedValue(null);
    await expect(requireUser("/wishlist?sort=price")).rejects.toThrow(
      "REDIRECT /sign-in?callbackUrl=%2Fwishlist%3Fsort%3Dprice",
    );
  });

  it("drops an unsafe callback path instead of passing it on", async () => {
    auth.mockResolvedValue(null);
    await expect(requireUser("//evil.example")).rejects.toThrow(
      "REDIRECT /sign-in?callbackUrl=%2F",
    );
  });

  it("returns the signed-in user", async () => {
    auth.mockResolvedValue({ user: shopper });
    await expect(requireUser("/wishlist")).resolves.toEqual(shopper);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  it("US-9 AC: returns 403 for a signed-in shopper", async () => {
    auth.mockResolvedValue({ user: shopper });
    await expect(requireAdmin("/admin")).rejects.toThrow("FORBIDDEN");
  });

  it("US-8 AC: sends a guest to sign-in first, not to 403", async () => {
    auth.mockResolvedValue(null);
    await expect(requireAdmin("/admin")).rejects.toThrow(
      "REDIRECT /sign-in?callbackUrl=%2Fadmin",
    );
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("treats a session without a role as not admin", async () => {
    auth.mockResolvedValue({ user: { ...shopper, role: undefined } });
    await expect(requireAdmin("/admin")).rejects.toThrow("FORBIDDEN");
  });

  it("US-8 AC: lets an admin through (role checked server-side)", async () => {
    auth.mockResolvedValue({ user: admin });
    await expect(requireAdmin("/admin")).resolves.toEqual(admin);
  });
});
