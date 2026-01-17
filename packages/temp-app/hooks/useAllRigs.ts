import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract, useReadContracts } from "wagmi";
import { base } from "wagmi/chains";
import { zeroAddress } from "viem";
import {
  CONTRACT_ADDRESSES,
  CORE_ABI,
  MULTICALL_ABI,
  ERC20_ABI,
  type RigState,
} from "@/lib/contracts";
import {
  getRigs,
  searchRigs,
  getTrendingRigs,
  getTopRigs,
  type SubgraphRig,
} from "@/lib/subgraph-launchpad";

export type RigListItem = {
  address: `0x${string}`;
  unitAddress: `0x${string}`;
  tokenName: string;
  tokenSymbol: string;
  rigUri: string;
  launcher: `0x${string}`;
  miner: `0x${string}`;
  price: bigint;
  ups: bigint;
  unitPrice: bigint;
  capacity: bigint;
  totalMinted: bigint;
  totalRevenue: bigint;
  epochCount: number;
  createdAt: number;
};

export type SortOption = "top" | "trending" | "new";

// Hook to get total number of deployed rigs
export function useDeployedRigsCount() {
  const { data: count, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESSES.core as `0x${string}`,
    abi: CORE_ABI,
    functionName: "deployedRigsLength",
    chainId: base.id,
    query: {
      refetchInterval: 30_000,
    },
  });

  return {
    count: count as bigint | undefined,
    isLoading,
    error,
  };
}

// Hook to get all rig addresses from the Core contract
export function useAllRigAddresses() {
  const { count } = useDeployedRigsCount();

  const rigCount = count ? Number(count) : 0;

  // Create array of indices for multicall
  const indices = Array.from({ length: rigCount }, (_, i) => i);

  const contracts = indices.map((index) => ({
    address: CONTRACT_ADDRESSES.core as `0x${string}`,
    abi: CORE_ABI,
    functionName: "deployedRigs" as const,
    args: [BigInt(index)] as const,
    chainId: base.id,
  }));

  const { data: rigAddresses, isLoading, error } = useReadContracts({
    contracts,
    query: {
      enabled: rigCount > 0,
    },
  });

  const addresses = rigAddresses
    ?.map((result) => result.result as `0x${string}` | undefined)
    .filter((addr): addr is `0x${string}` => !!addr);

  return {
    addresses: addresses ?? [],
    isLoading,
    error,
  };
}

// Hook to get rig list from subgraph with sorting
export function useRigList(
  sortBy: SortOption = "top",
  first = 20,
  skip = 0
) {
  // Standardized polling frequency to prevent rate limiting
  const refetchInterval = 60_000; // 60s for all sort types

  const { data: rigs, isLoading, error, refetch } = useQuery({
    queryKey: ["rigList", sortBy, first, skip],
    queryFn: async () => {
      if (sortBy === "trending") {
        return getTrendingRigs(first);
      }
      if (sortBy === "top") {
        return getTopRigs(first);
      }
      // "new" - sort by createdAt
      return getRigs(first, skip, "createdAt", "desc");
    },
    staleTime: 45_000, // 45 seconds
    refetchInterval,
    refetchOnWindowFocus: false,
    retry: false, // Don't retry - fallback to on-chain instead
  });

  return {
    rigs: rigs ?? [],
    isLoading,
    error,
    refetch,
  };
}

// Hook to search rigs
export function useSearchRigs(searchQuery: string) {
  const { data: rigs, isLoading, error } = useQuery({
    queryKey: ["searchRigs", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      return searchRigs(searchQuery, 20);
    },
    enabled: searchQuery.length >= 2,
    staleTime: 10_000,
    retry: false,
  });

  return {
    rigs: rigs ?? [],
    isLoading,
    error,
  };
}

// Hook to get on-chain rig states for a list of addresses (slot 0)
export function useRigStates(
  rigAddresses: `0x${string}`[],
  account: `0x${string}` | undefined
) {
  const contracts = rigAddresses.map((address) => ({
    address: CONTRACT_ADDRESSES.multicall as `0x${string}`,
    abi: MULTICALL_ABI,
    functionName: "getRig" as const,
    args: [address, 0n, account ?? zeroAddress] as const, // slot index 0
    chainId: base.id,
  }));

  const { data: states, isLoading, error } = useReadContracts({
    contracts,
    query: {
      enabled: rigAddresses.length > 0,
      refetchInterval: 30_000,
      refetchOnWindowFocus: false,
    },
  });

  const rigStates = states
    ?.map((result, index) => ({
      address: rigAddresses[index],
      state: result.result as RigState | undefined,
    }))
    .filter((item) => item.state);

  return {
    rigStates: rigStates ?? [],
    isLoading,
    error,
  };
}

// Hook to get rig info (token name/symbol) for multiple rigs
export function useRigTokenInfo(rigAddresses: `0x${string}`[]) {
  // Get unit addresses for all rigs
  const unitContracts = rigAddresses.map((address) => ({
    address: CONTRACT_ADDRESSES.core as `0x${string}`,
    abi: CORE_ABI,
    functionName: "rigToUnit" as const,
    args: [address] as const,
    chainId: base.id,
  }));

  const { data: unitAddresses } = useReadContracts({
    contracts: unitContracts,
    query: {
      enabled: rigAddresses.length > 0,
    },
  });

  // Get token names and symbols
  const validUnitAddresses = (unitAddresses ?? [])
    .map((result, index) => ({
      rigAddress: rigAddresses[index],
      unitAddress: result.result as `0x${string}` | undefined,
    }))
    .filter((item) => item.unitAddress);

  const nameContracts = validUnitAddresses.map((item) => ({
    address: item.unitAddress!,
    abi: ERC20_ABI,
    functionName: "name" as const,
    chainId: base.id,
  }));

  const symbolContracts = validUnitAddresses.map((item) => ({
    address: item.unitAddress!,
    abi: ERC20_ABI,
    functionName: "symbol" as const,
    chainId: base.id,
  }));

  const { data: names } = useReadContracts({
    contracts: nameContracts,
    query: {
      enabled: validUnitAddresses.length > 0,
    },
  });

  const { data: symbols } = useReadContracts({
    contracts: symbolContracts,
    query: {
      enabled: validUnitAddresses.length > 0,
    },
  });

  const tokenInfo = validUnitAddresses.map((item, index) => ({
    rigAddress: item.rigAddress,
    unitAddress: item.unitAddress!,
    tokenName: (names?.[index]?.result as string) ?? "",
    tokenSymbol: (symbols?.[index]?.result as string) ?? "",
  }));

  return { tokenInfo };
}

// Combined hook for explore page - gets subgraph data + on-chain states
// Falls back to on-chain only if subgraph returns no results
export function useExploreRigs(
  sortBy: SortOption = "top",
  searchQuery = "",
  account: `0x${string}` | undefined
) {
  // Always call both hooks (React rules), but only use one based on searchQuery
  const { rigs: searchResults, isLoading: isLoadingSearch } = useSearchRigs(searchQuery);
  const { rigs: listRigs, isLoading: isLoadingList } = useRigList(sortBy);

  const isSearching = searchQuery.length >= 2;
  const subgraphRigs = isSearching ? searchResults : listRigs;
  const isLoadingSubgraph = isSearching ? isLoadingSearch : isLoadingList;

  // Get all rig addresses from on-chain as fallback
  const { addresses: onChainAddresses, isLoading: isLoadingOnChain } =
    useAllRigAddresses();

  // Determine which addresses to use
  const useOnChainFallback = !isLoadingSubgraph && subgraphRigs.length === 0;
  const addresses = useOnChainFallback
    ? onChainAddresses
    : subgraphRigs.map((rig) => rig.id.toLowerCase() as `0x${string}`);

  // Get on-chain states for these rigs
  const { rigStates, isLoading: isLoadingStates } = useRigStates(
    addresses,
    account
  );

  // Get token info for on-chain fallback
  const { tokenInfo } = useRigTokenInfo(useOnChainFallback ? addresses : []);

  // Memoize the expensive data transformation to prevent unnecessary recalculations
  const filteredRigs = useMemo(() => {
    let combinedRigs: RigListItem[];

    if (useOnChainFallback) {
      // On-chain only mode - create a lookup map for O(1) access
      const statesMap = new Map(rigStates.map((s) => [s.address.toLowerCase(), s.state]));
      const tokenInfoMap = new Map(tokenInfo.map((t) => [t.rigAddress.toLowerCase(), t]));

      combinedRigs = addresses.map((address) => {
        const addrLower = address.toLowerCase();
        const onChainState = statesMap.get(addrLower);
        const info = tokenInfoMap.get(addrLower);

        return {
          address,
          unitAddress: info?.unitAddress ?? zeroAddress,
          tokenName: info?.tokenName ?? "Unknown",
          tokenSymbol: info?.tokenSymbol ?? "???",
          rigUri: onChainState?.rigUri ?? "",
          launcher: zeroAddress, // Not available without subgraph
          miner: onChainState?.miner ?? zeroAddress,
          price: onChainState?.price ?? 0n,
          ups: onChainState?.nextUps ?? 0n,
          unitPrice: onChainState?.unitPrice ?? 0n,
          capacity: onChainState?.capacity ?? 1n,
          totalMinted: 0n, // Not available without subgraph
          totalRevenue: 0n, // Not available without subgraph
          epochCount: 0, // Not available without subgraph
          createdAt: 0, // Not available without subgraph
        };
      });

      // Sort by price (descending) as fallback sorting for top
      if (sortBy === "top") {
        combinedRigs.sort((a, b) => (a.price > b.price ? -1 : 1));
      }
    } else {
      // Subgraph mode - create a lookup map for O(1) access
      const statesMap = new Map(rigStates.map((s) => [s.address.toLowerCase(), s.state]));

      combinedRigs = subgraphRigs.map((subgraphRig: SubgraphRig) => {
        const onChainState = statesMap.get(subgraphRig.id.toLowerCase());

        return {
          address: subgraphRig.id.toLowerCase() as `0x${string}`,
          unitAddress: subgraphRig.unit.toLowerCase() as `0x${string}`,
          tokenName: subgraphRig.tokenName,
          tokenSymbol: subgraphRig.tokenSymbol,
          rigUri: onChainState?.rigUri ?? "",
          launcher: subgraphRig.launcher.id.toLowerCase() as `0x${string}`,
          miner: onChainState?.miner ?? zeroAddress,
          price: onChainState?.price ?? 0n,
          ups: onChainState?.nextUps ?? 0n,
          unitPrice: onChainState?.unitPrice ?? 0n,
          capacity: onChainState?.capacity ?? 1n,
          totalMinted: BigInt(Math.floor(parseFloat(subgraphRig.minted) * 1e18)),
          totalRevenue: BigInt(Math.floor(parseFloat(subgraphRig.revenue) * 1e18)),
          epochCount: parseInt(subgraphRig.capacity),
          createdAt: parseInt(subgraphRig.createdAt),
        };
      });

      // Note: "top" rigs are already sorted by latest epoch spent from subgraph
    }

    // Filter out rigs without valid metadata (must have ipfs:// URI)
    return combinedRigs.filter(
      (rig) => rig.rigUri && rig.rigUri.startsWith("ipfs://")
    );
  }, [useOnChainFallback, addresses, rigStates, tokenInfo, subgraphRigs, sortBy]);

  // Loading until we have actual data ready to display
  const hasData = filteredRigs.length > 0;
  const isLoading = useOnChainFallback
    ? isLoadingOnChain || isLoadingStates || !hasData
    : isLoadingSubgraph || isLoadingStates || (addresses.length > 0 && !hasData);

  return {
    rigs: isLoading ? [] : filteredRigs,
    isLoading,
    isUsingFallback: useOnChainFallback,
  };
}
