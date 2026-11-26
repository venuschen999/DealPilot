import { z } from "zod";

// Items are validated one by one (see normalize.ts) so a single odd result
// from the provider is dropped instead of failing the whole search.
export const rawResponseSchema = z.object({
  shopping_results: z.array(z.unknown()).optional(),
});

// Lenient on purpose: only the fields DealPilot reads, all optional except
// the title. Unknown provider fields are stripped.
export const rawItemSchema = z.object({
  title: z.string(),
  product_id: z.string().optional(),
  product_link: z.string().optional(),
  link: z.string().optional(),
  source: z.string().optional(),
  price: z.string().optional(),
  extracted_price: z.number().optional(),
  rating: z.number().optional(),
  reviews: z.number().optional(),
  delivery: z.string().optional(),
  extensions: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
});

export type RawItem = z.infer<typeof rawItemSchema>;
