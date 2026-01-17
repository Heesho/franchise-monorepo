import { useQuery } from "@tanstack/react-query";
import { parseUnits, formatUnits } from "viem";

export type SwapQuote = {
  // Input/output amounts
  sellAmount: string;
  buyAmount: string;
  // USD values from Kyber
  sellAmountUsd?: string;
  buyAmountUsd?: string;
  // Price info
  price: string; // buyAmount / sellAmount
  // Gas estimate
  estimatedGas: string;
  // Fee info
  fees?: {
    integratorFee?: {
      amount: string;
      token: string;
    };
    zeroExFee?: {
      amount: string;
      token: string;
    };
    gasFee?: {
      amount: string;
      token: string;
    };
  };
  // Transaction data (only present in full quote, not price)
  transaction?: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
  // Allowance info
  issues?: {
    allowance?: {
      spender: string;
      actual: string;
      expected: string;
    };
  };
  // Liquidity sources used
  route?: {
    fills: Array<{
      source: string;
      proportionBps: string;
    }>;
  };
};

type UseSwapQuoteParams = {
  sellToken: string;
  buyToken: string;
  sellAmount: string; // In token units (e.g., "1.5" for 1.5 ETH)
  sellTokenDecimals: number;
  taker?: string; // User's wallet address (needed for full quote)
  slippageBps?: number;
  enabled?: boolean;
};

// Fetch just the price (lightweight, no tx data)
export function useSwapPrice({
  sellToken,
  buyToken,
  sellAmount,
  sellTokenDecimals,
  enabled = true,
}: Omit<UseSwapQuoteParams, "taker" | "slippageBps">) {
  return useQuery({
    queryKey: ["swapPrice", sellToken, buyToken, sellAmount],
    queryFn: async (): Promise<SwapQuote | null> => {
      if (!sellToken || !buyToken || !sellAmount || sellAmount === "0") {
        return null;
      }

      // Convert human-readable amount to wei
      const sellAmountWei = parseUnits(sellAmount, sellTokenDecimals).toString();

      const params = new URLSearchParams({
        sellToken,
        buyToken,
        sellAmount: sellAmountWei,
      });

      const res = await fetch(`/api/swap/price?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch price");
      }

      return data;
    },
    enabled: enabled && !!sellToken && !!buyToken && !!sellAmount && sellAmount !== "0",
    staleTime: 10_000, // Prices go stale after 10s
    refetchInterval: 15_000, // Refetch every 15s
    retry: false,
  });
}

// Fetch full quote with transaction data (heavier, use before swap)
export function useSwapQuote({
  sellToken,
  buyToken,
  sellAmount,
  sellTokenDecimals,
  taker,
  slippageBps = 50,
  enabled = true,
}: UseSwapQuoteParams) {
  return useQuery({
    queryKey: ["swapQuote", sellToken, buyToken, sellAmount, taker, slippageBps],
    queryFn: async (): Promise<SwapQuote | null> => {
      if (!sellToken || !buyToken || !sellAmount || sellAmount === "0" || !taker) {
        return null;
      }

      // Convert human-readable amount to wei
      const sellAmountWei = parseUnits(sellAmount, sellTokenDecimals).toString();

      const params = new URLSearchParams({
        sellToken,
        buyToken,
        sellAmount: sellAmountWei,
        taker,
        slippageBps: slippageBps.toString(),
      });

      const res = await fetch(`/api/swap/quote?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch quote");
      }

      return data;
    },
    enabled: enabled && !!sellToken && !!buyToken && !!sellAmount && sellAmount !== "0" && !!taker,
    staleTime: 30_000, // Quotes valid for 30s
    retry: false,
  });
}

// Helper to format buy amount with decimals
export function formatBuyAmount(
  buyAmount: string | undefined,
  decimals: number
): string {
  if (!buyAmount) return "0";
  try {
    return formatUnits(BigInt(buyAmount), decimals);
  } catch {
    return "0";
  }
}

// Helper to calculate price impact (rough estimate)
export function calculatePriceImpact(
  sellAmountUsd: number,
  buyAmountUsd: number
): number {
  if (sellAmountUsd === 0) return 0;
  return ((sellAmountUsd - buyAmountUsd) / sellAmountUsd) * 100;
}
