// Budget split, ordering and ranks (PRD US-3, US-4 AC2; DESIGN §6). Pure: no I/O.

import type { Listing } from "../sources/types";
import { type Badge, badgesFor } from "./badges";
import {
  DEFAULT_WEIGHTS,
  dealScore,
  factorScores,
  type FactorScores,
  type Weights,
} from "./score";

export type ScoredListing = Listing & {
  factors: FactorScores;
  dealScore: number;
  limitedData: boolean;
};
export type RankedListing = ScoredListing & {
  rank: number;
  badge: Badge | null;
};

export function rankListings(
  listings: readonly Listing[],
  options: { weights?: Weights; budget?: number } = {},
): { ranked: RankedListing[]; overBudget: ScoredListing[] } {
  const { weights = DEFAULT_WEIGHTS, budget } = options;
  // DESIGN §6: min/max over all listings, so moving the budget never rescores.
  const prices = listings.map((l) => l.price);
  const range = { min: Math.min(...prices), max: Math.max(...prices) };

  const scored = listings.map((listing): ScoredListing => {
    const { limitedData, ...factors } = factorScores(listing, range);
    return {
      ...listing,
      factors,
      dealScore: dealScore(factors, weights),
      limitedData,
    };
  });

  // budget 0 is a real limit; only undefined means "no budget".
  const isOverBudget = (e: ScoredListing) =>
    budget !== undefined && e.price > budget;

  // Array.prototype.sort is stable, so complete ties keep input order.
  const ordered = scored.filter((e) => !isOverBudget(e)).sort(compareRank);
  // Badges need the final rank order, so they come after sorting.
  const badges = badgesFor(ordered);
  const ranked = ordered.map((e, i) => ({
    ...e,
    rank: i + 1,
    badge: badges[i],
  }));

  return { ranked, overBudget: scored.filter(isOverBudget) };
}

// PRD US-3 AC1: higher (rounded) deal score first, then lower price, then more
// reviews, with a missing review count counted as 0.
function compareRank(a: ScoredListing, b: ScoredListing): number {
  return (
    b.dealScore - a.dealScore ||
    a.price - b.price ||
    (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
  );
}
