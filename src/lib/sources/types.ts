import { z } from "zod";

// Mirrors `enum Platform` in docs/architecture.md (Prisma schema).
export const PLATFORMS = ["AMAZON", "EBAY", "WALMART", "BEST_BUY", "TARGET", "OTHER"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const MATCH_TYPES = ["EXACT", "SIMILAR"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

const nullableText = z.string().min(1).nullable();

// The one normalized shape every source returns. It is stored as JSON in
// wishlist snapshots and the search cache, so it holds only JSON-safe values.
export const listingSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  platform: z.enum(PLATFORMS),
  storeName: z.string(),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  // https only: these links are rendered as "View on {Platform}" anchors.
  url: z.url({ protocol: /^https$/ }),
  // null (not 0) so ranking can flag "Limited data" (PRD, Ranking).
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(),
  shipping: nullableText,
  returnDays: z.number().int().nonnegative().nullable(),
  imageUrl: z.url({ protocol: /^https$/ }).nullable(),
  gtin: nullableText,
  brand: nullableText,
  model: nullableText,
  // PRD fallback is Similar; the AI match step may upgrade it to EXACT.
  matchType: z.enum(MATCH_TYPES).default("SIMILAR"),
});

export type Listing = z.infer<typeof listingSchema>;

export type SearchQuery = { q: string };

export interface ProductSource {
  readonly id: string;
  search(query: SearchQuery, opts?: { signal?: AbortSignal }): Promise<Listing[]>;
}
