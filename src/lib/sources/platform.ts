import type { Platform } from "./types";

const STORE_TO_PLATFORM: Record<string, Platform> = {
  amazon: "AMAZON",
  amazoncom: "AMAZON",
  ebay: "EBAY",
  ebaycom: "EBAY",
  walmart: "WALMART",
  walmartcom: "WALMART",
  bestbuy: "BEST_BUY",
  bestbuycom: "BEST_BUY",
  target: "TARGET",
  targetcom: "TARGET",
};

// Google Shopping labels marketplace sellers as "<Store> - <seller>", so only
// the part before " - " identifies the platform. Exact key match keeps names
// like "Targeted Audio" from being mistaken for Target.
export function toPlatform(storeName: string): Platform {
  const store = storeName
    .split(" - ")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return STORE_TO_PLATFORM[store] ?? "OTHER";
}
