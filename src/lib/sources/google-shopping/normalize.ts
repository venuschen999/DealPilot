import { SourceResponseError } from "../errors";
import { toPlatform } from "../platform";
import { type Listing, listingSchema } from "../types";
import { type RawItem, rawItemSchema, rawResponseSchema } from "./raw-schema";

export const GOOGLE_SHOPPING_SOURCE_ID = "google-shopping";

export function normalizeShoppingResults(raw: unknown): Listing[] {
  const response = rawResponseSchema.safeParse(raw);
  if (!response.success) {
    throw new SourceResponseError(
      GOOGLE_SHOPPING_SOURCE_ID,
      "unexpected response shape",
    );
  }
  return (response.data.shopping_results ?? []).flatMap((value) => {
    const item = rawItemSchema.safeParse(value);
    if (!item.success) return [];
    const listing = listingSchema.safeParse(toListingCandidate(item.data));
    return listing.success ? [listing.data] : [];
  });
}

function toListingCandidate(item: RawItem): unknown {
  const url = item.product_link ?? item.link;
  const storeName = item.source ?? "";
  return {
    id: `${GOOGLE_SHOPPING_SOURCE_ID}:${item.product_id ?? url}`,
    source: GOOGLE_SHOPPING_SOURCE_ID,
    platform: toPlatform(storeName),
    storeName,
    title: item.title,
    price: item.extracted_price ?? parsePrice(item.price),
    url,
    rating: item.rating ?? null,
    reviewCount: item.reviews ?? null,
    shipping: item.delivery ?? null,
    returnDays: parseReturnDays(item.extensions ?? []),
    imageUrl: item.thumbnail ?? null,
    // The results API does not expose these; later enrichment may fill them.
    gtin: null,
    brand: null,
    model: null,
  };
}

function parsePrice(display: string | undefined): number | undefined {
  const match = display?.match(/\d[\d,]*(?:\.\d+)?/);
  return match ? Number(match[0].replace(/,/g, "")) : undefined;
}

function parseReturnDays(extensions: string[]): number | null {
  for (const text of extensions) {
    const match = text.match(/(\d+)-day returns?/i);
    if (match) return Number(match[1]);
  }
  return null;
}
