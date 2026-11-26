import { describe, expect, it } from "vitest";
import { toPlatform } from "./platform";

describe("toPlatform", () => {
  it.each([
    ["Amazon.com", "AMAZON"],
    ["Amazon", "AMAZON"],
    ["Amazon.com - Seller", "AMAZON"],
    ["eBay", "EBAY"],
    ["eBay - techdeals", "EBAY"],
    ["Walmart", "WALMART"],
    ["Walmart - Seller", "WALMART"],
    ["Best Buy", "BEST_BUY"],
    ["BestBuy", "BEST_BUY"],
    ["Target", "TARGET"],
  ] as const)("US-2 AC1: maps store %s to %s", (store, platform) => {
    expect(toPlatform(store)).toBe(platform);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(toPlatform("  BEST buy ")).toBe("BEST_BUY");
  });

  it.each(["Sony", "Bose Official Store", "Targeted Audio", "Newegg", ""])(
    "maps brand and other stores (%s) to OTHER",
    (store) => {
      expect(toPlatform(store)).toBe("OTHER");
    },
  );
});
