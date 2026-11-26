// Deal badges (PRD US-3 AC2; DESIGN §6; Results.dc.html mockup). Pure: no I/O.

export type Badge = "BEST OVERALL" | "LOWEST PRICE" | "TOP RATED";

// Takes listings already filtered to the budget and sorted by rank (index 0
// is #1). Only price and rating matter, so this needs nothing from rank.ts.
export function badgesFor(
  ranked: readonly { price: number; rating: number | null }[],
): (Badge | null)[] {
  // One cheapest and one highest-rated candidate, like the mockup. Strict
  // comparisons keep the earlier (higher-ranked) listing on ties.
  let cheapest = 0;
  let topRated = -1;
  let topRating = -Infinity;
  ranked.forEach((listing, i) => {
    if (listing.price < ranked[cheapest].price) cheapest = i;
    if (listing.rating !== null && listing.rating > topRating) {
      topRated = i;
      topRating = listing.rating;
    }
  });

  // Priority order; a candidate that already holds a higher badge keeps it and
  // the lower badge is not passed on to anyone else.
  return ranked.map((_, i) => {
    if (i === 0) return "BEST OVERALL";
    if (i === cheapest) return "LOWEST PRICE";
    if (i === topRated) return "TOP RATED";
    return null;
  });
}
