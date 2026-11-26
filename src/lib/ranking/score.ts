// Factor scores from PRD §Ranking and DESIGN §6. Pure: no I/O, runs in the browser.

export function norm(v: number, lo: number, hi: number): number {
  // DESIGN §6 guard: a zero-width range would otherwise divide by zero.
  if (hi === lo) return 1;
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}

export function priceScore(price: number, min: number, max: number): number {
  return 1 - norm(price, min, max);
}

export function qualityScore(rating: number): number {
  return norm(rating, 4.0, 5.0);
}

export function popularityScore(reviewCount: number): number {
  return norm(Math.log10(reviewCount), 3, 4);
}

// The PRD allows exactly these three factors; weights and scores share the keys.
type Factor = "price" | "quality" | "popularity";
export type Weights = Record<Factor, number>;
export type FactorScores = Record<Factor, number>;

export const DEFAULT_WEIGHTS: Weights = {
  price: 30,
  quality: 45,
  popularity: 25,
};

export function dealScore(
  factors: FactorScores,
  weights: Weights = DEFAULT_WEIGHTS,
): number {
  // DESIGN §6: all-zero weights use a total of 1 instead of dividing by zero.
  const total = weights.price + weights.quality + weights.popularity || 1;
  const weighted =
    weights.price * factors.price +
    weights.quality * factors.quality +
    weights.popularity * factors.popularity;
  return Math.round((100 * weighted) / total);
}
