import { describe, expect, it } from "vitest";
import { initialsFor } from "./initials";

describe("initialsFor", () => {
  it.each([
    ["Weisi Chen", "w@example.com", "WC"],
    ["  ada   lovelace  ", "a@example.com", "AL"],
    ["Cher", "c@example.com", "C"],
    ["Jean Claude Van Damme", "j@example.com", "JD"],
  ])(
    "US-8: header avatar uses initials of the name %j",
    (name, email, expected) => {
      expect(initialsFor(name, email)).toBe(expected);
    },
  );

  it("falls back to the first letter of the email when there is no name", () => {
    expect(initialsFor(null, "you@example.com")).toBe("Y");
    expect(initialsFor("   ", "you@example.com")).toBe("Y");
  });

  it("returns ? when there is nothing usable", () => {
    expect(initialsFor(null, null)).toBe("?");
  });
});
