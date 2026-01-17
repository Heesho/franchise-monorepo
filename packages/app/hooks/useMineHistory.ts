import { useQuery } from "@tanstack/react-query";
import { getEpochs, type SubgraphEpoch } from "@/lib/subgraph-launchpad";

export type MineMessage = {
  id: string;
  miner: `0x${string}`;
  price: bigint;
  uri: string;
  timestamp: number;
  minedAmount: bigint;
  spent: bigint;
  earned: bigint;
};

function parseEpochToMineMessage(epoch: SubgraphEpoch): MineMessage {
  return {
    id: epoch.id,
    miner: epoch.rigAccount.account.id.toLowerCase() as `0x${string}`,
    price: BigInt(Math.floor(parseFloat(epoch.initPrice) * 1e18)), // Convert from BigDecimal
    uri: epoch.uri,
    timestamp: parseInt(epoch.startTime),
    minedAmount: BigInt(Math.floor(parseFloat(epoch.mined) * 1e18)),
    spent: BigInt(Math.floor(parseFloat(epoch.spent) * 1e18)),
    earned: BigInt(Math.floor(parseFloat(epoch.earned) * 1e18)),
  };
}

export function useMineHistory(
  rigAddress: `0x${string}` | undefined,
  first = 50,
  skip = 0
) {
  const {
    data: mines,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["mineHistory", rigAddress, first, skip],
    queryFn: async () => {
      if (!rigAddress) return [];
      const epochs = await getEpochs(rigAddress, first, skip);
      // Parse and reverse to get chronological order (oldest first for chat)
      return epochs.map(parseEpochToMineMessage).reverse();
    },
    enabled: !!rigAddress,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 30_000, // Refetch every 30 seconds for new messages (reduced from 10s)
    refetchOnWindowFocus: false,
    retry: false, // Don't retry - subgraph may be unavailable
  });

  return {
    mines: mines ?? [],
    isLoading,
    error,
    refetch,
  };
}

export function useMineHistoryPaginated(
  rigAddress: `0x${string}` | undefined,
  pageSize = 20
) {
  const {
    data: mines,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["mineHistoryPaginated", rigAddress],
    queryFn: async () => {
      if (!rigAddress) return [];
      const epochs = await getEpochs(rigAddress, pageSize, 0);
      return epochs.map(parseEpochToMineMessage).reverse();
    },
    enabled: !!rigAddress,
    staleTime: 30_000,
    refetchInterval: 30_000, // Reduced from 10s
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    mines: (mines as MineMessage[]) ?? [],
    isLoading,
    error,
    refetch,
    // Pagination stubs for future infinite scroll implementation
    fetchNextPage: async () => {},
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}
