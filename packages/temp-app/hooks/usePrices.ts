"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getEthPrice, getDonutPrice } from "@/lib/utils";
import { DEFAULT_ETH_PRICE_USD, DEFAULT_DONUT_PRICE_USD } from "@/lib/constants";

const PRICE_STALE_TIME = 60_000; // 1 minute
const PRICE_REFETCH_INTERVAL = 60_000; // 1 minute

/**
 * Shared hook for ETH and DONUT prices
 * Uses React Query for caching and deduplication across components
 */
export function usePrices() {
  const { data: ethPrice = DEFAULT_ETH_PRICE_USD } = useQuery({
    queryKey: ["ethPrice"],
    queryFn: getEthPrice,
    staleTime: PRICE_STALE_TIME,
    refetchInterval: PRICE_REFETCH_INTERVAL,
    refetchOnWindowFocus: false, // Prevent duplicate requests on tab focus
  });

  const { data: donutPrice = DEFAULT_DONUT_PRICE_USD } = useQuery({
    queryKey: ["donutPrice"],
    queryFn: getDonutPrice,
    staleTime: PRICE_STALE_TIME,
    refetchInterval: PRICE_REFETCH_INTERVAL,
    refetchOnWindowFocus: false, // Prevent duplicate requests on tab focus
  });

  return {
    ethUsdPrice: ethPrice,
    donutUsdPrice: donutPrice,
  };
}

/**
 * Hook to prefetch prices on app load
 */
export function usePrefetchPrices() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey: ["ethPrice"],
      queryFn: getEthPrice,
      staleTime: PRICE_STALE_TIME,
    });
    queryClient.prefetchQuery({
      queryKey: ["donutPrice"],
      queryFn: getDonutPrice,
      staleTime: PRICE_STALE_TIME,
    });
  };
}
