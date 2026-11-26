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
