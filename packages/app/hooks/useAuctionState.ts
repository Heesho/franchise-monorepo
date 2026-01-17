import { useReadContract, useReadContracts } from "wagmi";
import { base } from "wagmi/chains";
import { zeroAddress } from "viem";
import {
  CONTRACT_ADDRESSES,
  MULTICALL_ABI,
  type AuctionState,
} from "@/lib/contracts";

export function useAuctionState(
  rigAddress: `0x${string}` | undefined,
  account: `0x${string}` | undefined
) {
  const { data: rawAuctionState, refetch, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESSES.multicall as `0x${string}`,
    abi: MULTICALL_ABI,
    functionName: "getAuction",
    args: rigAddress ? [rigAddress, account ?? zeroAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!rigAddress,
      refetchInterval: 15_000, // Reduced from 3s to prevent rate limiting
      refetchOnWindowFocus: false,
    },
  });

  const auctionState = rawAuctionState as AuctionState | undefined;

  return {
    auctionState,
    refetch,
    isLoading,
    error,
  };
}

export type AuctionListItem = {
  rigAddress: `0x${string}`;
  auctionState: AuctionState;
  profitLoss: bigint; // WETH value - LP cost in DONUT equivalent
  isProfitable: boolean;
};

export function useAllAuctionStates(
  rigAddresses: `0x${string}`[],
  account: `0x${string}` | undefined
) {
  const contracts = rigAddresses.map((address) => ({
    address: CONTRACT_ADDRESSES.multicall as `0x${string}`,
    abi: MULTICALL_ABI,
    functionName: "getAuction" as const,
    args: [address, account ?? zeroAddress] as const,
    chainId: base.id,
  }));

  const { data: states, isLoading, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: rigAddresses.length > 0,
      refetchInterval: 30_000, // Reduced from 10s to prevent rate limiting
      refetchOnWindowFocus: false,
    },
  });

  const auctionItems: AuctionListItem[] = (states ?? [])
    .map((result, index) => {
      const state = result.result as AuctionState | undefined;
      if (!state) return null;

      // Calculate profit/loss
      // LP cost = price * paymentTokenPrice (LP token value in underlying)
      // WETH value = wethAccumulated
      // For simplicity, compare WETH accumulated vs LP price * LP value
      const lpCostInWeth =
        (state.price * state.paymentTokenPrice) / BigInt(1e18);
      const profitLoss = state.wethAccumulated - lpCostInWeth;
      const isProfitable = profitLoss > 0n;

      return {
        rigAddress: rigAddresses[index],
        auctionState: state,
        profitLoss,
        isProfitable,
      };
    })
    .filter((item): item is AuctionListItem => item !== null);

  // Sort by profitability (most profitable first)
  auctionItems.sort((a, b) => {
    if (a.profitLoss > b.profitLoss) return -1;
    if (a.profitLoss < b.profitLoss) return 1;
    return 0;
  });

  return {
    auctions: auctionItems,
    isLoading,
    error,
    refetch,
  };
}
