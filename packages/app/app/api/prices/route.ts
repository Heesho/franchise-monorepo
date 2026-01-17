import { NextResponse } from "next/server";

const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price";

// Cache prices server-side for 60 seconds
let priceCache: {
  eth: number | null;
  donut: number | null;
  timestamp: number;
} = {
  eth: null,
  donut: null,
  timestamp: 0,
};

const CACHE_TTL_MS = 60_000; // 1 minute

export async function GET() {
  const now = Date.now();

  // Return cached prices if still fresh
  if (
    priceCache.eth !== null &&
    priceCache.donut !== null &&
    now - priceCache.timestamp < CACHE_TTL_MS
  ) {
    return NextResponse.json({
      eth: priceCache.eth,
      donut: priceCache.donut,
    });
  }

  try {
    // Fetch both prices in parallel
    const [ethResponse, donutResponse] = await Promise.all([
      fetch(`${COINGECKO_API}?ids=ethereum&vs_currencies=usd`, {
        next: { revalidate: 60 },
      }),
      fetch(`${COINGECKO_API}?ids=donut-2&vs_currencies=usd`, {
        next: { revalidate: 60 },
      }),
    ]);

    let ethPrice = priceCache.eth ?? 3200; // Default fallback
    let donutPrice = priceCache.donut ?? 0.001; // Default fallback

    if (ethResponse.ok) {
      const ethData = await ethResponse.json();
      if (typeof ethData.ethereum?.usd === "number") {
        ethPrice = ethData.ethereum.usd;
      }
    }

    if (donutResponse.ok) {
      const donutData = await donutResponse.json();
      if (typeof donutData["donut-2"]?.usd === "number") {
        donutPrice = donutData["donut-2"].usd;
      }
    }

    // Update cache
    priceCache = {
      eth: ethPrice,
      donut: donutPrice,
      timestamp: now,
    };

    return NextResponse.json({
      eth: ethPrice,
      donut: donutPrice,
    });
  } catch (error) {
    console.error("[prices] Error fetching prices:", error);

    // Return cached values if available, otherwise defaults
    return NextResponse.json({
      eth: priceCache.eth ?? 3200,
      donut: priceCache.donut ?? 0.001,
    });
  }
}
