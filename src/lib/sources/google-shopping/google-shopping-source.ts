import { SourceResponseError } from "../errors";
import type { ProductSource } from "../types";
import {
  GOOGLE_SHOPPING_SOURCE_ID,
  normalizeShoppingResults,
} from "./normalize";

// The only host this adapter ever fetches (OWASP A10): the query is the sole
// user input and it goes into a search param, never into the URL itself.
const ENDPOINT = "https://serpapi.com/search.json";

type Options = { apiKey: string; fetchFn?: typeof fetch };

// Server-only: needs the provider API key. Never import from client components.
export function createGoogleShoppingSource({
  apiKey,
  fetchFn = fetch,
}: Options): ProductSource {
  if (!apiKey) throw new Error("Google Shopping source requires an API key");

  return {
    id: GOOGLE_SHOPPING_SOURCE_ID,
    async search({ q }, opts = {}) {
      const query = q.trim();
      if (!query) return [];

      const url = new URL(ENDPOINT);
      url.search = new URLSearchParams({
        engine: "google_shopping",
        q: query,
        api_key: apiKey,
      }).toString();

      const response = await fetchFn(url, { signal: opts.signal });
      // Provider error bodies can echo the key, so only the status is reported.
      if (!response.ok) {
        throw new SourceResponseError(
          GOOGLE_SHOPPING_SOURCE_ID,
          `HTTP ${response.status}`,
          response.status,
        );
      }
      return normalizeShoppingResults(await readJson(response));
    },
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new SourceResponseError(
      GOOGLE_SHOPPING_SOURCE_ID,
      "response was not JSON",
      response.status,
    );
  }
}
