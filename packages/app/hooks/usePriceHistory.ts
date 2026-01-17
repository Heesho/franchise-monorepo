import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEpochs, type SubgraphEpoch } from "@/lib/subgraph-launchpad";

export type PricePoint = {
  time: number;
  value: number;
};

export type Timeframe = "1D" | "1W" | "1M" | "ALL";

// Get the time range in seconds for each timeframe
export function getTimeframeSeconds(timeframe: Timeframe): number {
  switch (timeframe) {
    case "1D":
      return 24 * 3600;
    case "1W":
      return 7 * 24 * 3600;
    case "1M":
      return 30 * 24 * 3600;
    case "ALL":
      return Infinity;
    default:
      return 24 * 3600;
  }
}

// Fetch historical epochs (max 1000 per subgraph limit)
async function fetchHistoricalEpochs(rigAddress: string): Promise<SubgraphEpoch[]> {
  if (!rigAddress) return [];
  try {
    return await getEpochs(rigAddress, 1000, 0);
  } catch (error) {
    console.error("[usePriceHistory] Failed to fetch epochs:", error);
    return [];
  }
}

// Convert epochs to mining cost points (spent field = ETH spent per mine)
function epochsToMiningCostPoints(epochs: SubgraphEpoch[], ethUsdPrice: number): PricePoint[] {
  if (!epochs.length || ethUsdPrice <= 0) return [];

  // Epochs come desc (newest first), reverse for chronological
  const sorted = [...epochs].reverse();

  return sorted.map((epoch) => ({
    time: parseInt(epoch.startTime),
    value: parseFloat(epoch.spent) * ethUsdPrice,
  }));
}

// Filter to timeframe
function filterByTimeframe(data: PricePoint[], timeframe: Timeframe): PricePoint[] {
  if (data.length === 0 || timeframe === "ALL") return data;

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - getTimeframeSeconds(timeframe);

  return data.filter(point => point.time >= cutoff);
}

export function usePriceHistory(
  rigAddress: `0x${string}` | undefined,
  timeframe: Timeframe = "1D",
  ethUsdPrice: number = 3000
) {
  const { data: allEpochs, isLoading } = useQuery({
    queryKey: ["miningPriceHistory", rigAddress],
    queryFn: () => fetchHistoricalEpochs(rigAddress as string),
    enabled: !!rigAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const { priceHistory, tokenFirstActiveTime } = useMemo(() => {
    const allPoints = epochsToMiningCostPoints(allEpochs ?? [], ethUsdPrice);
    const filtered = filterByTimeframe(allPoints, timeframe);
    // Get the earliest data point ever (not filtered) to know when token was created
    const firstTime = allPoints.length > 0 ? allPoints[0].time : null;
    return { priceHistory: filtered, tokenFirstActiveTime: firstTime };
  }, [allEpochs, timeframe, ethUsdPrice]);

  return {
    priceHistory,
    isLoading,
    timeframeSeconds: getTimeframeSeconds(timeframe),
    tokenFirstActiveTime, // When the token first had activity (null if no data)
  };
}
