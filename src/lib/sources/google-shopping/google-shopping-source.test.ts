import { describe, expect, it, vi } from "vitest";
import fixture from "../../../../tests/fixtures/google-shopping/headphones.json";
import { SourceResponseError } from "../errors";
import type { ProductSource } from "../types";
import { createGoogleShoppingSource } from "./google-shopping-source";

const API_KEY = "test-key-not-real";

function fakeFetch(body: unknown = fixture, status = 200) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return vi.fn<typeof fetch>(async () => new Response(text, { status }));
}

function requestedUrl(fetchFn: ReturnType<typeof fakeFetch>): URL {
  return new URL(String(fetchFn.mock.calls[0][0]));
}

describe("createGoogleShoppingSource", () => {
  it("implements ProductSource with the google-shopping id", () => {
    const source: ProductSource = createGoogleShoppingSource({
      apiKey: API_KEY,
      fetchFn: fakeFetch(),
    });
    expect(source.id).toBe("google-shopping");
  });

  it("US-2 AC1: returns normalized listings from the provider response", async () => {
    const source = createGoogleShoppingSource({
      apiKey: API_KEY,
      fetchFn: fakeFetch(),
    });
    const listings = await source.search({
      q: "wireless noise cancelling headphones",
    });
    expect(listings).toHaveLength(6);
    expect(listings[0]).toMatchObject({ platform: "AMAZON", price: 179.99 });
  });

  it("A10: requests only the allowlisted provider endpoint with the query", async () => {
    const fetchFn = fakeFetch();
    await createGoogleShoppingSource({ apiKey: API_KEY, fetchFn }).search({
      q: "sony wh-1000xm5 & case",
    });
    const url = requestedUrl(fetchFn);
    expect(url.origin + url.pathname).toBe("https://serpapi.com/search.json");
    expect(url.searchParams.get("engine")).toBe("google_shopping");
    expect(url.searchParams.get("q")).toBe("sony wh-1000xm5 & case");
    expect(url.searchParams.get("api_key")).toBe(API_KEY);
  });

  it("US-2 AC2: passes the abort signal through so the search route can time a source out", async () => {
    const fetchFn = fakeFetch();
    const controller = new AbortController();
    await createGoogleShoppingSource({ apiKey: API_KEY, fetchFn }).search(
      { q: "headphones" },
      { signal: controller.signal },
    );
    expect(fetchFn.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("US-2 AC2: lets an abort propagate unchanged", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw abort;
    });
    await expect(
      createGoogleShoppingSource({ apiKey: API_KEY, fetchFn }).search({
        q: "headphones",
      }),
    ).rejects.toBe(abort);
  });

  it("throws SourceResponseError with the status on a non-2xx response, without leaking the key", async () => {
    const fetchFn = fakeFetch({ error: `Invalid API key ${API_KEY}` }, 401);
    const error = await createGoogleShoppingSource({ apiKey: API_KEY, fetchFn })
      .search({ q: "headphones" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceResponseError);
    expect(error).toMatchObject({ status: 401, source: "google-shopping" });
    expect(String((error as Error).message)).not.toContain(API_KEY);
  });

  it("throws SourceResponseError when the body is not JSON", async () => {
    const source = createGoogleShoppingSource({
      apiKey: API_KEY,
      fetchFn: fakeFetch("<html>busy</html>"),
    });
    await expect(source.search({ q: "headphones" })).rejects.toBeInstanceOf(
      SourceResponseError,
    );
  });

  it("does not spend an API call on a blank query", async () => {
    const fetchFn = fakeFetch();
    await expect(
      createGoogleShoppingSource({ apiKey: API_KEY, fetchFn }).search({
        q: "   ",
      }),
    ).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses to be created without an API key", () => {
    expect(() =>
      createGoogleShoppingSource({ apiKey: "", fetchFn: fakeFetch() }),
    ).toThrow();
  });
});
