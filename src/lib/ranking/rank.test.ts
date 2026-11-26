import { describe, expect, it } from "vitest";
import fixture from "../../../tests/fixtures/google-shopping/headphones.json";
import { normalizeShoppingResults } from "../sources/google-shopping/normalize";
import type { Listing } from "../sources/types";
import { rankListings } from "./rank";
import { DEFAULT_WEIGHTS } from "./score";

const listing = (id: string, overrides: Partial<Listing> = {}): Listing => ({
  id,
  source: "google-shopping",
  platform: "AMAZON",
  storeName: "Amazon.com",
  title: `Listing ${id}`,
  price: 100,
  url: `https://www.amazon.com/dp/${id}`,
  rating: 4.5,
  reviewCount: 5_000,
  shipping: null,
  returnDays: null,
  imageUrl: null,
  gtin: null,
  brand: null,
  model: null,
  matchType: "SIMILAR",
  ...overrides,
});

const ids = (entries: readonly { id: string }[]) => entries.map((e) => e.id);

// Single-factor weights make every expected deal score easy to check by hand:
// QUALITY_ONLY gives round(100 × norm(rating, 4, 5)).
const QUALITY_ONLY = { price: 0, quality: 1, popularity: 0 };
const PRICE_ONLY = { price: 1, quality: 0, popularity: 0 };

describe("rankListings: budget", () => {
  it("US-4 AC2 R10: moves listings priced above the budget to overBudget", () => {
    const { ranked, overBudget } = rankListings(
      [
        listing("a", { price: 100 }),
        listing("b", { price: 250 }),
        listing("c", { price: 150 }),
      ],
      { budget: 200 },
    );
    expect(ids(ranked).sort()).toEqual(["a", "c"]);
    expect(ids(overBudget)).toEqual(["b"]);
  });

  it("US-4 AC2 R10: keeps a listing priced exactly at the budget", () => {
    const { ranked, overBudget } = rankListings(
      [listing("a", { price: 200 })],
      { budget: 200 },
    );
    expect(ids(ranked)).toEqual(["a"]);
    expect(overBudget).toEqual([]);
  });

  it("US-4 AC2 R10: ranks every listing when no budget is set", () => {
    const listings = [
      listing("a", { price: 100 }),
      listing("b", { price: 9_999 }),
    ];
    for (const result of [rankListings(listings), rankListings(listings, {})]) {
      expect(ids(result.ranked).sort()).toEqual(["a", "b"]);
      expect(result.overBudget).toEqual([]);
    }
  });

  // A budget of 0 is a real limit, not "no budget" (no truthiness check).
  it("US-4 AC2 R10: a budget of 0 keeps only free listings", () => {
    const { ranked, overBudget } = rankListings(
      [listing("free", { price: 0 }), listing("paid", { price: 10 })],
      { budget: 0 },
    );
    expect(ids(ranked)).toEqual(["free"]);
    expect(ids(overBudget)).toEqual(["paid"]);
  });

  it("US-4 AC2 R10: returns an empty ranked list when every listing is over budget", () => {
    const { ranked, overBudget } = rankListings(
      [listing("a", { price: 100 }), listing("b", { price: 200 })],
      { budget: 50 },
    );
    expect(ranked).toEqual([]);
    expect(ids(overBudget)).toEqual(["a", "b"]);
  });

  it("US-4 AC2 R10: over-budget entries keep their deal score and limitedData but get no rank or badge", () => {
    const { overBudget } = rankListings(
      [
        listing("cheap", { price: 100, rating: 4.8, reviewCount: 10_000 }),
        listing("pricey", { price: 300, rating: 5, reviewCount: null }),
      ],
      { budget: 200 },
    );
    // pricey: price 0 (max of the set), quality 1, popularity 0 (missing)
    // → round(100 × (30·0 + 45·1 + 25·0) / 100) = 45
    expect(overBudget).toHaveLength(1);
    expect(overBudget[0]).toMatchObject({
      id: "pricey",
      dealScore: 45,
      limitedData: true,
      factors: { price: 0, quality: 1, popularity: 0 },
    });
    expect(overBudget[0]).not.toHaveProperty("rank");
    expect(overBudget[0]).not.toHaveProperty("badge");
  });

  it("US-4 AC2 R10: over-budget entries keep input order, not score order", () => {
    const { overBudget } = rankListings(
      [
        listing("x", { price: 500, rating: 4.1 }),
        listing("in", { price: 100 }),
        listing("y", { price: 400, rating: 5 }),
        listing("z", { price: 600, rating: 4.5 }),
      ],
      { budget: 200, weights: QUALITY_ONLY },
    );
    expect(ids(overBudget)).toEqual(["x", "y", "z"]);
  });
});

describe("rankListings: price range", () => {
  it("Ranking R10: price min and max come from all listings, including over-budget ones", () => {
    const { ranked } = rankListings(
      [
        listing("a", { price: 100 }),
        listing("b", { price: 200 }),
        listing("c", { price: 300 }),
      ],
      { budget: 250 },
    );
    // Over all listings: 1 − (200 − 100) / (300 − 100) = 0.5.
    // Over in-budget listings only it would be 0.
    expect(ranked.find((e) => e.id === "b")?.factors.price).toBe(0.5);
  });

  it("Ranking R10: changing the budget does not change any deal score", () => {
    const listings = [
      listing("a", { price: 80, rating: 4.2, reviewCount: 1_500 }),
      listing("b", { price: 140, rating: 4.9, reviewCount: 8_000 }),
      listing("c", { price: 220, rating: 4.6, reviewCount: null }),
      listing("d", { price: 300, rating: null, reviewCount: 20_000 }),
    ];
    const scoresFor = (budget?: number) => {
      const { ranked, overBudget } = rankListings(listings, { budget });
      return Object.fromEntries(
        [...ranked, ...overBudget].map((e) => [e.id, e.dealScore]),
      );
    };
    const unlimited = scoresFor(undefined);
    expect(scoresFor(250)).toEqual(unlimited);
    expect(scoresFor(150)).toEqual(unlimited);
    expect(scoresFor(0)).toEqual(unlimited);
  });
});

describe("rankListings: order and tie-breaks", () => {
  it("US-3 AC1 R11: sorts in-budget listings by deal score, highest first", () => {
    const { ranked } = rankListings(
      [
        listing("low", { rating: 4.2 }),
        listing("high", { rating: 4.9 }),
        listing("mid", { rating: 4.5 }),
      ],
      { weights: QUALITY_ONLY },
    );
    expect(ids(ranked)).toEqual(["high", "mid", "low"]);
    expect(ranked.map((e) => e.dealScore)).toEqual([90, 50, 20]);
  });

  it("US-3 AC1 R11: numbers ranks consecutively from 1", () => {
    const { ranked } = rankListings(
      [
        listing("a", { rating: 4.1 }),
        listing("b", { rating: 4.9 }),
        listing("c", { rating: 4.5 }),
        listing("d", { rating: 4.5, price: 90 }),
      ],
      { weights: QUALITY_ONLY },
    );
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3, 4]);
  });

  it("US-3 AC1 R12: breaks a deal-score tie by lower price", () => {
    const { ranked } = rankListings(
      [listing("a", { price: 150 }), listing("b", { price: 120 })],
      { weights: QUALITY_ONLY },
    );
    expect(ids(ranked)).toEqual(["b", "a"]);
  });

  it("US-3 AC1 R12: compares the rounded deal score when breaking ties", () => {
    // Raw scores 70.4 and 69.6 both round to 70, so the cheaper listing wins
    // even though its unrounded score is lower.
    const { ranked } = rankListings(
      [
        listing("higherRaw", { rating: 4.704, price: 150 }),
        listing("cheaper", { rating: 4.696, price: 120 }),
      ],
      { weights: QUALITY_ONLY },
    );
    expect(ranked.map((e) => e.dealScore)).toEqual([70, 70]);
    expect(ids(ranked)).toEqual(["cheaper", "higherRaw"]);
  });

  it("US-3 AC1 R12: breaks a price tie by more reviews", () => {
    const { ranked } = rankListings(
      [
        listing("fewer", { reviewCount: 2_000 }),
        listing("more", { reviewCount: 5_000 }),
      ],
      { weights: QUALITY_ONLY },
    );
    expect(ids(ranked)).toEqual(["more", "fewer"]);
  });

  it("US-3 AC1 R12: treats a null review count as zero reviews", () => {
    const rank = (...listings: Listing[]) =>
      ids(rankListings(listings, { weights: QUALITY_ONLY }).ranked);
    const missing = listing("missing", { reviewCount: null });
    const one = listing("one", { reviewCount: 1 });
    const zero = listing("zero", { reviewCount: 0 });
    expect(rank(missing, one)).toEqual(["one", "missing"]);
    // null and 0 are an exact tie, so input order decides.
    expect(rank(missing, zero)).toEqual(["missing", "zero"]);
    expect(rank(zero, missing)).toEqual(["zero", "missing"]);
  });

  it("US-3 AC1 R12: keeps input order for complete ties", () => {
    const tied = [listing("a"), listing("b"), listing("c")];
    expect(ids(rankListings(tied).ranked)).toEqual(["a", "b", "c"]);
    expect(ids(rankListings([...tied].reverse()).ranked)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
});

describe("rankListings: input immutability", () => {
  const input = () => [
    listing("a", { price: 300, rating: 4.2 }),
    listing("b", { price: 100, rating: 4.9 }),
    listing("c", { price: 200, rating: null, reviewCount: null }),
  ];

  it("Ranking: leaves the input array's order and length unchanged", () => {
    const listings = input();
    const before = [...listings];
    rankListings(listings, { budget: 250 });
    expect(listings).toHaveLength(before.length);
    listings.forEach((l, i) => expect(l).toBe(before[i]));
  });

  it("Ranking: leaves every input listing object unchanged", () => {
    const listings = input();
    const snapshot = structuredClone(listings);
    rankListings(listings, { budget: 250 });
    expect(listings).toStrictEqual(snapshot);
  });

  it("Ranking: leaves custom weights unchanged", () => {
    const weights = { price: 10, quality: 20, popularity: 30 };
    rankListings(input(), { weights });
    expect(weights).toStrictEqual({ price: 10, quality: 20, popularity: 30 });
  });

  it("Ranking: leaves DEFAULT_WEIGHTS unchanged when weights are omitted", () => {
    rankListings(input());
    rankListings(input(), { budget: 150 });
    expect(DEFAULT_WEIGHTS).toStrictEqual({
      price: 30,
      quality: 45,
      popularity: 25,
    });
  });

  it("Ranking: returns new entry objects, not the input listings", () => {
    const listings = input();
    const { ranked, overBudget } = rankListings(listings, { budget: 250 });
    for (const entry of [...ranked, ...overBudget]) {
      expect(listings).not.toContain(entry);
    }
  });

  it("Ranking: returns identical results for repeated calls", () => {
    const listings = input();
    expect(rankListings(listings, { budget: 250 })).toStrictEqual(
      rankListings(listings, { budget: 250 }),
    );
  });
});

describe("rankListings: edge cases", () => {
  it("Ranking: returns empty lists for no listings", () => {
    expect(rankListings([])).toStrictEqual({ ranked: [], overBudget: [] });
  });

  it("Ranking: ranks a single listing first (equal prices give a price score of 0)", () => {
    const { ranked, overBudget } = rankListings([
      listing("only", { rating: 4.8, reviewCount: 10_000 }),
    ]);
    // round(100 × (30·0 + 45·0.8 + 25·1) / 100) = 61
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ id: "only", rank: 1, dealScore: 61 });
    expect(overBudget).toEqual([]);
  });

  it("US-3 AC1: custom weights change the order", () => {
    const listings = [
      listing("premium", { price: 150, rating: 4.9 }),
      listing("cheap", { price: 50, rating: 4.1 }),
    ];
    expect(ids(rankListings(listings, { weights: PRICE_ONLY }).ranked)).toEqual(
      ["cheap", "premium"],
    );
    expect(
      ids(rankListings(listings, { weights: QUALITY_ONLY }).ranked),
    ).toEqual(["premium", "cheap"]);
  });

  it("Ranking R7: all-zero weights score every listing 0 and order by price", () => {
    const { ranked } = rankListings(
      [listing("a", { price: 150 }), listing("b", { price: 100 })],
      { weights: { price: 0, quality: 0, popularity: 0 } },
    );
    expect(ranked.map((e) => e.dealScore)).toEqual([0, 0]);
    expect(ids(ranked)).toEqual(["b", "a"]);
  });

  it("Ranking R8: ranks a listing with no rating or reviews on price alone and flags it", () => {
    const { ranked } = rankListings([
      listing("complete", { price: 200, rating: 4.0, reviewCount: 1_000 }),
      listing("missing", { price: 100, rating: null, reviewCount: null }),
    ]);
    // missing: price 1 → 30; complete: every factor 0 → 0
    expect(ranked.map((e) => [e.id, e.dealScore, e.limitedData])).toEqual([
      ["missing", 30, true],
      ["complete", 0, false],
    ]);
  });

  it("US-3 AC1: ranks the recorded fixture with a $300 budget", () => {
    const { ranked, overBudget } = rankListings(
      normalizeShoppingResults(fixture),
      { budget: 300 },
    );
    expect(ids(overBudget)).toEqual(["google-shopping:1005"]); // $1,139.50
    expect(ranked).toHaveLength(5);
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
    const scores = ranked.map((e) => e.dealScore);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    expect(
      ranked.find((e) => e.id === "google-shopping:1006")?.limitedData,
    ).toBe(true);
  });

  it("US-3 AC1 R5: every deal score is an integer from 0 to 100", () => {
    const listings = normalizeShoppingResults(fixture);
    const weightSets = [
      undefined,
      QUALITY_ONLY,
      PRICE_ONLY,
      { price: 0, quality: 0, popularity: 0 },
      { price: 5, quality: 95, popularity: 50 },
    ];
    for (const weights of weightSets) {
      const { ranked, overBudget } = rankListings(listings, {
        weights,
        budget: 200,
      });
      for (const { dealScore } of [...ranked, ...overBudget]) {
        expect(Number.isInteger(dealScore)).toBe(true);
        expect(dealScore).toBeGreaterThanOrEqual(0);
        expect(dealScore).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("rankListings: badges", () => {
  // Popularity-only weights let the cheapest or highest-rated listing sit below
  // #1: the order is set by review count alone (10,000 → 100, 5,000 → 70,
  // 2,000 → 30, 1,500 → 18).
  const POPULARITY_ONLY = { price: 0, quality: 0, popularity: 1 };
  const badges = (result: {
    ranked: readonly { id: string; badge: unknown }[];
  }) => result.ranked.map((e) => [e.id, e.badge]);

  it("US-3 AC2 R13: marks rank #1 BEST OVERALL", () => {
    const { ranked } = rankListings(
      [
        listing("a", { rating: 4.9, price: 100 }),
        listing("b", { rating: 4.5, price: 80 }),
        listing("c", { rating: 4.2, price: 120 }),
      ],
      { weights: QUALITY_ONLY },
    );
    expect(ranked[0]).toMatchObject({
      id: "a",
      rank: 1,
      badge: "BEST OVERALL",
    });
  });

  it("US-3 AC2 R13: marks the cheapest in-budget listing LOWEST PRICE when it is not #1", () => {
    const result = rankListings(
      [
        listing("a", { rating: 4.9, price: 100 }),
        listing("b", { rating: 4.5, price: 80 }),
        listing("c", { rating: 4.2, price: 120 }),
      ],
      { weights: QUALITY_ONLY },
    );
    // a is #1 and the highest rated, so nobody gets TOP RATED.
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "LOWEST PRICE"],
      ["c", null],
    ]);
  });

  it("US-3 AC2 R13: gives no LOWEST PRICE when #1 is also the cheapest", () => {
    const result = rankListings(
      [
        listing("a", { price: 80, rating: 4.2 }),
        listing("b", { price: 100, rating: 4.9 }),
        listing("c", { price: 120, rating: 4.5 }),
      ],
      { weights: PRICE_ONLY },
    );
    // b is the next-cheapest but is not promoted to LOWEST PRICE; it is the
    // highest rated, so it gets TOP RATED instead.
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "TOP RATED"],
      ["c", null],
    ]);
  });

  it("US-3 AC2 R13: gives all three badges to three different listings", () => {
    const result = rankListings(
      [
        listing("a", { reviewCount: 10_000, price: 100, rating: 4.2 }),
        listing("b", { reviewCount: 5_000, price: 50, rating: 4.5 }),
        listing("c", { reviewCount: 2_000, price: 120, rating: 4.9 }),
      ],
      { weights: POPULARITY_ONLY },
    );
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "LOWEST PRICE"],
      ["c", "TOP RATED"],
    ]);
  });

  it("US-3 AC2 R13: gives no TOP RATED when the highest-rated listing is #1", () => {
    const result = rankListings(
      [
        listing("a", { rating: 4.9, price: 100 }),
        listing("b", { rating: 4.5, price: 50 }),
        listing("c", { rating: 4.2, price: 120 }),
      ],
      { weights: QUALITY_ONLY },
    );
    // c is rated and badge-free but is not promoted to TOP RATED.
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "LOWEST PRICE"],
      ["c", null],
    ]);
  });

  it("US-3 AC2 R13: gives no TOP RATED when the highest-rated listing is LOWEST PRICE", () => {
    const result = rankListings(
      [
        listing("a", { reviewCount: 10_000, price: 100, rating: 4.2 }),
        listing("b", { reviewCount: 5_000, price: 50, rating: 4.9 }),
        listing("c", { reviewCount: 2_000, price: 120, rating: 4.5 }),
      ],
      { weights: POPULARITY_ONLY },
    );
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "LOWEST PRICE"],
      ["c", null],
    ]);
  });

  it("US-3 AC2 R13: never gives TOP RATED to a listing with no rating", () => {
    const result = rankListings(
      [
        listing("a", { reviewCount: 10_000, price: 100, rating: 4.2 }),
        listing("b", { reviewCount: 5_000, price: 50, rating: 4.0 }),
        listing("c", { reviewCount: 2_000, price: 120, rating: null }),
        listing("d", { reviewCount: 1_500, price: 130, rating: 4.3 }),
      ],
      { weights: POPULARITY_ONLY },
    );
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "LOWEST PRICE"],
      ["c", null],
      ["d", "TOP RATED"],
    ]);
  });

  it("US-3 AC2 R13: gives no TOP RATED when every rating is missing", () => {
    const result = rankListings(
      [
        listing("a", { reviewCount: 10_000, price: 100, rating: null }),
        listing("b", { reviewCount: 5_000, price: 50, rating: null }),
        listing("c", { reviewCount: 2_000, price: 120, rating: null }),
      ],
      { weights: POPULARITY_ONLY },
    );
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "LOWEST PRICE"],
      ["c", null],
    ]);
  });

  it("US-3 AC2 R13: gives one badge per listing, BEST OVERALL first, when #1 is also cheapest and highest rated", () => {
    const result = rankListings(
      [
        listing("a", { price: 50, rating: 4.9, reviewCount: 10_000 }),
        listing("b", { price: 100, rating: 4.5, reviewCount: 5_000 }),
        listing("c", { price: 120, rating: 4.2, reviewCount: 2_000 }),
      ],
      { weights: POPULARITY_ONLY },
    );
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", null],
      ["c", null],
    ]);
  });

  it("US-3 AC2 R13: ignores over-budget listings when choosing badges and gives them none", () => {
    const { ranked, overBudget } = rankListings(
      [
        listing("a", { price: 50, rating: 4.2 }),
        listing("b", { price: 100, rating: 4.6 }),
        listing("c", { price: 200, rating: 5 }),
      ],
      { weights: PRICE_ONLY, budget: 150 },
    );
    // c (5.0★) is over budget, so TOP RATED goes to b, the highest-rated
    // in-budget listing.
    expect(badges({ ranked })).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "TOP RATED"],
    ]);
    expect(ids(overBudget)).toEqual(["c"]);
    expect(overBudget[0]).not.toHaveProperty("badge");
  });

  it("US-3 AC2 R13: breaks an equal-price LOWEST PRICE tie in favour of the higher rank", () => {
    const result = rankListings(
      [
        listing("c", { reviewCount: 2_000, price: 50, rating: 4.4 }),
        listing("b", { reviewCount: 5_000, price: 50, rating: 4.3 }),
        listing("a", { reviewCount: 10_000, price: 100, rating: 4.2 }),
      ],
      { weights: POPULARITY_ONLY },
    );
    // b (#2) and c (#3) are both $50; c comes first in the input but b ranks higher.
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "LOWEST PRICE"],
      ["c", "TOP RATED"],
    ]);
  });

  it("US-3 AC2 R13: breaks an equal-rating TOP RATED tie in favour of the higher rank", () => {
    const result = rankListings(
      [
        listing("c", { reviewCount: 2_000, price: 120, rating: 4.8 }),
        listing("a", { reviewCount: 10_000, price: 50, rating: 4.2 }),
        listing("b", { reviewCount: 5_000, price: 100, rating: 4.8 }),
      ],
      { weights: POPULARITY_ONLY },
    );
    // b (#2) and c (#3) are both 4.8★; c comes first in the input but b ranks higher.
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "TOP RATED"],
      ["c", null],
    ]);
  });

  it("US-3 AC2 R13: gives a single listing only BEST OVERALL", () => {
    expect(badges(rankListings([listing("only")]))).toEqual([
      ["only", "BEST OVERALL"],
    ]);
  });

  it("US-3 AC2 R13: sets badge to null, not undefined, on ranked listings without a badge", () => {
    const { ranked } = rankListings(
      [
        listing("a", { rating: 4.9, price: 50 }),
        listing("b", { rating: 4.5, price: 100 }),
        listing("c", { rating: 4.2, price: 120 }),
      ],
      { weights: QUALITY_ONLY },
    );
    expect(ranked[1]).toHaveProperty("badge", null);
    expect(ranked[2]).toHaveProperty("badge", null);
  });

  it("US-3 AC2 R13: badges the recorded fixture without changing its scores or order", () => {
    // Hand-computed with default weights 30/45/25 and the price range over all
    // six listings ($128–$1,139.50, so $1,139.50 still counts while over budget):
    //   1001 $179.99 4.6★ 12,840 → 28.46 + 27 + 25    = 80.46 → 80
    //   1004 $229    4.8★  3,470 → 27.00 + 36 + 13.51 = 76.51 → 77
    //   1003 $149    4.4★  6,210 → 29.38 + 18 + 19.83 = 67.20 → 67
    //   1002 $128    4.1★  1,930 → 30    + 4.5 + 7.14 = 41.64 → 42
    //   1006 $239    no rating, no reviews → 26.71 → 27 (Limited data)
    // Badges: #1 1001; cheapest 1002 → LOWEST PRICE; highest rated 1004 → TOP RATED.
    const { ranked, overBudget } = rankListings(
      normalizeShoppingResults(fixture),
      { budget: 300 },
    );
    expect(
      ranked.map((e) => [e.id, e.rank, e.dealScore, e.limitedData, e.badge]),
    ).toEqual([
      ["google-shopping:1001", 1, 80, false, "BEST OVERALL"],
      ["google-shopping:1004", 2, 77, false, "TOP RATED"],
      ["google-shopping:1003", 3, 67, false, null],
      ["google-shopping:1002", 4, 42, false, "LOWEST PRICE"],
      ["google-shopping:1006", 5, 27, true, null],
    ]);
    expect(ids(overBudget)).toEqual(["google-shopping:1005"]);
    expect(overBudget[0]).not.toHaveProperty("badge");
  });

  it("US-3 AC2 R13: TOP RATED has no minimum rating; the highest rating below 4.0 still wins", () => {
    const result = rankListings(
      [
        listing("a", { reviewCount: 10_000, price: 100, rating: 3.2 }),
        listing("b", { reviewCount: 5_000, price: 50, rating: 3.0 }),
        listing("c", { reviewCount: 2_000, price: 120, rating: 3.8 }),
      ],
      { weights: POPULARITY_ONLY },
    );
    // Every rating scores quality 0 (≤ 4.0), but c (3.8★) is still the
    // highest-rated listing and has no other badge.
    expect(badges(result)).toEqual([
      ["a", "BEST OVERALL"],
      ["b", "LOWEST PRICE"],
      ["c", "TOP RATED"],
    ]);
  });

  it("US-3 AC2 R13: a rated listing with a missing review count can be TOP RATED and stays Limited data", () => {
    const { ranked } = rankListings(
      [
        listing("a", { reviewCount: 10_000, price: 100, rating: 4.2 }),
        listing("b", { reviewCount: 5_000, price: 50, rating: 4.3 }),
        listing("c", { reviewCount: null, price: 120, rating: 4.9 }),
      ],
      { weights: POPULARITY_ONLY },
    );
    // c's missing reviews score popularity 0, so it ranks last, but its 4.9★
    // rating is still the highest.
    expect(ranked.map((e) => [e.id, e.badge, e.limitedData])).toEqual([
      ["a", "BEST OVERALL", false],
      ["b", "LOWEST PRICE", false],
      ["c", "TOP RATED", true],
    ]);
  });
});
