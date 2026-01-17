import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DEFAULT_ETH_PRICE_USD, DEFAULT_DONUT_PRICE_USD, PRICE_CACHE_TTL_MS } from "./constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Price cache
let ethPriceCache: { price: number; timestamp: number } | null = null;
let donutPriceCache: { price: number; timestamp: number } | null = null;

// DONUT token address on Base
const DONUT_ADDRESS = "0xf8d8f925ff8cadd7b3e59bb609bba5a2b3ae908c";

export async function getEthPrice(): Promise<number> {
  // Check cache
  if (ethPriceCache && Date.now() - ethPriceCache.timestamp < PRICE_CACHE_TTL_MS) {
    return ethPriceCache.price;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } }
    );
    const data = await response.json();
    const price = data.ethereum?.usd ?? DEFAULT_ETH_PRICE_USD;
    ethPriceCache = { price, timestamp: Date.now() };
    return price;
  } catch {
    return ethPriceCache?.price ?? DEFAULT_ETH_PRICE_USD;
  }
}

export async function getDonutPrice(): Promise<number> {
  // Check cache
  if (donutPriceCache && Date.now() - donutPriceCache.timestamp < PRICE_CACHE_TTL_MS) {
    return donutPriceCache.price;
  }

  try {
    // Try DexScreener first (more reliable for Base tokens)
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${DONUT_ADDRESS}`,
      { next: { revalidate: 60 } }
    );
    const data = await response.json();
    const pair = data.pairs?.[0];
    if (pair?.priceUsd) {
      const price = parseFloat(pair.priceUsd);
      donutPriceCache = { price, timestamp: Date.now() };
      return price;
    }
    return donutPriceCache?.price ?? DEFAULT_DONUT_PRICE_USD;
  } catch {
    return donutPriceCache?.price ?? DEFAULT_DONUT_PRICE_USD;
  }
}
