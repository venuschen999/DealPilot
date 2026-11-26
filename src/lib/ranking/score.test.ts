import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  dealScore,
  norm,
  popularityScore,
  priceScore,
  qualityScore,
} from "./score";

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
    "Ranking R2: price %d in a 50–150 result set scores %d (cheapest 1, most expensive 0)",
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

describe("dealScore", () => {
  const defaults = { price: 30, quality: 45, popularity: 25 };

  it("US-3 AC1 R5: is round(100 × weighted mean of factor scores)", () => {
    // 100 × (30·0.5 + 45·1 + 25·0) / (30 + 45 + 25) = 60
    expect(dealScore({ price: 0.5, quality: 1, popularity: 0 }, defaults)).toBe(
      60,
    );
  });

  it.each([
    ["default weights", defaults],
    ["custom weights", { price: 1, quality: 2, popularity: 3 }],
  ])("US-3 AC1 R5: scores 100 when every factor is 1 (%s)", (_label, w) => {
    expect(dealScore({ price: 1, quality: 1, popularity: 1 }, w)).toBe(100);
  });

  it.each([
    ["default weights", defaults],
    ["custom weights", { price: 1, quality: 2, popularity: 3 }],
  ])("US-3 AC1 R5: scores 0 when every factor is 0 (%s)", (_label, w) => {
    expect(dealScore({ price: 0, quality: 0, popularity: 0 }, w)).toBe(0);
  });

  it.each([
    [{ price: 1, quality: 0, popularity: 0 }, 33], // 33.33…
    [{ price: 1, quality: 1, popularity: 0 }, 67], // 66.66…
  ])(
    "US-3 AC1 R5: rounds to the nearest integer (%o → %d)",
    (factors, expected) => {
      const equal = { price: 1, quality: 1, popularity: 1 };
      expect(dealScore(factors, equal)).toBe(expected);
    },
  );

  it.each([
    ["10/20/10 (sum 40)", { price: 10, quality: 20, popularity: 10 }],
    ["100/100/100 (sum 300)", { price: 100, quality: 100, popularity: 100 }],
  ])("US-3 AC1 R5: custom weights need not sum to 100 (%s)", (_label, w) => {
    // (w·1 + w·0.5 + w·0) / Σw = 0.5 for both weight sets
    expect(dealScore({ price: 1, quality: 0.5, popularity: 0 }, w)).toBe(50);
  });

  it.each([2, 0.1, 7])(
    "US-3 AC1 R5: scaling every weight by %d leaves the score unchanged",
    (k) => {
      const factors = { price: 0.2, quality: 0.6, popularity: 0.4 };
      const scaled = {
        price: 30 * k,
        quality: 45 * k,
        popularity: 25 * k,
      };
      // 100 × (6 + 27 + 10) / 100 = 43
      expect(dealScore(factors, defaults)).toBe(43);
      expect(dealScore(factors, scaled)).toBe(43);
    },
  );

  it.each([
    ["price", { price: 5, quality: 0, popularity: 0 }, 20],
    ["quality", { price: 0, quality: 5, popularity: 0 }, 70],
    ["popularity", { price: 0, quality: 0, popularity: 5 }, 90],
  ] as const)(
    "US-3 AC1 R5: a single non-zero weight on %s scores only that factor",
    (_factor, w, expected) => {
      const factors = { price: 0.2, quality: 0.7, popularity: 0.9 };
      expect(dealScore(factors, w)).toBe(expected);
    },
  );

  it("US-3 AC1 R5: is an integer from 0 to 100 for every valid input", () => {
    const steps = [0, 0.25, 0.5, 0.75, 1];
    const weightSets = [
      defaults,
      { price: 0, quality: 0, popularity: 0 },
      { price: 100, quality: 0, popularity: 0 },
      { price: 5, quality: 95, popularity: 50 },
      { price: 100, quality: 100, popularity: 100 },
    ];
    for (const w of weightSets)
      for (const price of steps)
        for (const quality of steps)
          for (const popularity of steps) {
            const score = dealScore({ price, quality, popularity }, w);
            expect(Number.isInteger(score)).toBe(true);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          }
  });

  it("Ranking R6: default weights are Price 30, Quality 45, Popularity 25", () => {
    expect(DEFAULT_WEIGHTS).toEqual({ price: 30, quality: 45, popularity: 25 });
  });

  it.each([
    [{ price: 1, quality: 0, popularity: 0 }, 30],
    [{ price: 0, quality: 1, popularity: 0 }, 45],
    [{ price: 0, quality: 0, popularity: 1 }, 25],
  ])(
    "Ranking R6: omitting weights uses DEFAULT_WEIGHTS (%o → %d)",
    (factors, expected) => {
      expect(dealScore(factors)).toBe(expected);
      expect(dealScore(factors)).toBe(dealScore(factors, DEFAULT_WEIGHTS));
    },
  );

  // DESIGN §6: "If all weights are 0, the total uses 1 to avoid division by zero."
  it("Ranking R7: all-zero weights score 0, not NaN", () => {
    const zero = { price: 0, quality: 0, popularity: 0 };
    expect(dealScore({ price: 1, quality: 1, popularity: 1 }, zero)).toBe(0);
  });
});
