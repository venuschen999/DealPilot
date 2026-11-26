import { describe, expect, it } from "vitest";
import { norm, popularityScore, priceScore, qualityScore } from "./score";

describe("norm", () => {
  it.each([
    [0, 0],
    [10, 1],
    [5, 0.5],
    [2.5, 0.25],
  ])("Ranking R1: maps %d in [0, 10] to %d", (v, expected) => {
    expect(norm(v, 0, 10)).toBeCloseTo(expected, 10);
  });

  it.each([
    [-5, 0],
    [15, 1],
    [-Infinity, 0],
    [Infinity, 1],
  ])("Ranking R1: clamps %d outside [0, 10] to %d", (v, expected) => {
    expect(norm(v, 0, 10)).toBe(expected);
  });

  it.each([7, 100, 0])(
    "Ranking R1: returns 1 when hi equals lo (v = %d)",
    (v) => {
      expect(norm(v, 7, 7)).toBe(1);
    },
  );
});

describe("priceScore", () => {
  it.each([
    [50, 1],
    [150, 0],
    [100, 0.5],
    [75, 0.75],
  ])(
    "Ranking R2: price %d in a $50–$150 result set scores %d (cheapest 1, most expensive 0)",
    (price, expected) => {
      expect(priceScore(price, 50, 150)).toBeCloseTo(expected, 10);
    },
  );

  // DESIGN §6 makes norm return 1 when hi == lo, so 1 − norm gives 0. No spec
  // has a separate equal-price rule (human review finding in the plan).
  it("Ranking R2: scores 0 when every listing has the same price", () => {
    expect(priceScore(99.99, 99.99, 99.99)).toBe(0);
  });

  it("Ranking R2: scores 0 for a single listing (min equals max)", () => {
    expect(priceScore(0, 0, 0)).toBe(0);
  });
});

describe("qualityScore", () => {
  it.each([
    [4.0, 0],
    [4.2, 0.2],
    [4.5, 0.5],
    [4.8, 0.8],
    [5.0, 1],
  ])("Ranking R3: rating %d scores %d", (rating, expected) => {
    expect(qualityScore(rating)).toBeCloseTo(expected, 10);
  });

  it.each([3.9, 1, 0])(
    "Ranking R3: rating %d at or below 4.0 scores 0",
    (rating) => {
      expect(qualityScore(rating)).toBe(0);
    },
  );
});

describe("popularityScore", () => {
  it.each([
    [1_000, 0],
    [10 ** 3.5, 0.5],
    [10_000, 1],
  ])("Ranking R4: %d reviews scores %d", (reviews, expected) => {
    expect(popularityScore(reviews)).toBeCloseTo(expected, 10);
  });

  it.each([999, 10, 1])(
    "Ranking R4: %d reviews (at most 1,000) scores 0",
    (reviews) => {
      expect(popularityScore(reviews)).toBe(0);
    },
  );

  it.each([10_001, 50_000, 2_000_000])(
    "Ranking R4: %d reviews (at least 10,000) scores 1",
    (reviews) => {
      expect(popularityScore(reviews)).toBe(1);
    },
  );

  // log10(0) is -Infinity; the clamp must turn it into 0, not NaN.
  it("Ranking R4: zero reviews scores 0, not NaN", () => {
    expect(popularityScore(0)).toBe(0);
  });
});
