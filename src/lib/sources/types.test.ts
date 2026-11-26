import { describe, expect, it } from "vitest";
import { listingSchema, PLATFORMS } from "./types";

const validListing = {
  id: "google-shopping:123",
  source: "google-shopping",
  platform: "AMAZON",
  storeName: "Amazon.com",
  title: "AuraSound Q45 Wireless ANC Headphones",
  price: 179.99,
  url: "https://www.amazon.com/dp/B000000",
  rating: 4.6,
  reviewCount: 12840,
  shipping: "Free delivery",
  returnDays: 30,
  imageUrl: "https://example-cdn.test/q45.jpg",
  gtin: null,
  brand: "AuraSound",
  model: "Q45",
  matchType: "SIMILAR",
};

describe("listingSchema", () => {
  it("US-2 AC1: accepts a listing with title, platform, price, rating, reviews, shipping/returns and match type", () => {
    expect(listingSchema.parse(validListing)).toEqual(validListing);
  });

  it("matches the Prisma Platform enum", () => {
    expect(PLATFORMS).toEqual([
      "AMAZON",
      "EBAY",
      "WALMART",
      "BEST_BUY",
      "TARGET",
      "OTHER",
    ]);
  });

  it("allows missing rating and review count so ranking can flag Limited data", () => {
    const parsed = listingSchema.parse({
      ...validListing,
      rating: null,
      reviewCount: null,
    });
    expect(parsed.rating).toBeNull();
    expect(parsed.reviewCount).toBeNull();
  });

  it("defaults match type to SIMILAR when absent", () => {
    const withoutMatch: Partial<typeof validListing> = { ...validListing };
    delete withoutMatch.matchType;
    expect(listingSchema.parse(withoutMatch).matchType).toBe("SIMILAR");
  });

  it.each([
    ["negative price", { price: -1 }],
    ["rating above 5", { rating: 5.1 }],
    ["fractional review count", { reviewCount: 10.5 }],
    ["non-https url", { url: "http://www.amazon.com/dp/B000000" }],
    ["javascript url", { url: "javascript:alert(1)" }],
    ["unknown platform", { platform: "ETSY" }],
    ["empty title", { title: "" }],
  ])("rejects %s", (_label, override) => {
    expect(
      listingSchema.safeParse({ ...validListing, ...override }).success,
    ).toBe(false);
  });

  it("survives a JSON round trip unchanged (stored in wishlist snapshots and cache)", () => {
    const parsed = listingSchema.parse(validListing);
    expect(listingSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(
      parsed,
    );
  });
});
