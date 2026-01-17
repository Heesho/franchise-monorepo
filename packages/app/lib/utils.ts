import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  PRICE_CACHE_TTL_MS,
  DEFAULT_ETH_PRICE_USD,
  DEFAULT_DONUT_PRICE_USD,
} from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Price cache - simple in-memory cache for client-side usage
type PriceCache = {
  price: number;
  timestamp: number;
};

const priceCache: Record<string, PriceCache> = {};

function getCachedPrice(key: string): number | null {
  const cached = priceCache[key];
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL_MS) {
    return cached.price;
  }
  return null;
}

function setCachedPrice(key: string, price: number): void {
  priceCache[key] = { price, timestamp: Date.now() };
}

/**
 * Fetches prices from our API route (which proxies CoinGecko)
 * Returns cached value if available and fresh
 */
async function fetchPrices(): Promise<{ eth: number; donut: number }> {
  try {
    const response = await fetch("/api/prices");

    if (!response.ok) {
      throw new Error(`Failed to fetch prices: ${response.status}`);
    }

    const data = await response.json();
    return {
      eth: typeof data.eth === "number" ? data.eth : DEFAULT_ETH_PRICE_USD,
      donut: typeof data.donut === "number" ? data.donut : DEFAULT_DONUT_PRICE_USD,
    };
  } catch (error) {
    console.error("Error fetching prices:", error);
    return {
      eth: DEFAULT_ETH_PRICE_USD,
      donut: DEFAULT_DONUT_PRICE_USD,
    };
  }
}

/**
 * Fetches the current ETH to USD price
 * Returns cached value if available and fresh
 */
export async function getEthPrice(): Promise<number> {
  const cached = getCachedPrice("eth");
  if (cached !== null) return cached;

  const prices = await fetchPrices();
  setCachedPrice("eth", prices.eth);
  setCachedPrice("donut", prices.donut);
  return prices.eth;
}

/**
 * Fetches the current DONUT to USD price
 * Returns cached value if available and fresh
 */
export async function getDonutPrice(): Promise<number> {
  const cached = getCachedPrice("donut");
  if (cached !== null) return cached;

  const prices = await fetchPrices();
  setCachedPrice("eth", prices.eth);
  setCachedPrice("donut", prices.donut);
  return prices.donut;
}
