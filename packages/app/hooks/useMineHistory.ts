import { useQuery } from "@tanstack/react-query";
import { getMines, type SubgraphMineEvent } from "@/lib/subgraph-launchpad";

export type MineMessage = {
  id: string;
  miner: `0x${string}`;
  prevMiner: `0x${string}` | null;
  price: bigint;
  uri: string;
  timestamp: number;
  slotIndex: number;
  epochId: number;
  spent: bigint; // Same as price (what new miner paid)
  mined: bigint; // Tokens minted for prev miner
  earned: bigint; // Fee earned by prev miner
  upsMultiplier: number | null;
};

function parseMineEventToMessage(mine: SubgraphMineEvent): MineMessage {
  return {
    id: mine.id,
    miner: mine.miner.id.toLowerCase() as `0x${string}`,
    prevMiner: mine.prevMiner ? mine.prevMiner.id.toLowerCase() as `0x${string}` : null,
    price: BigInt(Math.floor(parseFloat(mine.price) * 1e6)), // USDC has 6 decimals
    uri: mine.uri,
    timestamp: parseInt(mine.timestamp),
    slotIndex: parseInt(mine.slotIndex),
    epochId: parseInt(mine.epochId),
    spent: BigInt(Math.floor(parseFloat(mine.price) * 1e6)),
    mined: BigInt(Math.floor(parseFloat(mine.mined) * 1e18)), // Unit tokens have 18 decimals
    earned: BigInt(Math.floor(parseFloat(mine.earned) * 1e6)), // USDC has 6 decimals
    upsMultiplier: mine.upsMultiplier ? parseInt(mine.upsMultiplier) : null,
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
      try {
        const mineEvents = await getMines(rigAddress, first, skip);
        // Already ordered by timestamp desc from subgraph
        return mineEvents.map(parseMineEventToMessage);
      } catch (err) {
        console.warn("[useMineHistory] Subgraph query failed:", err);
        return [];
      }
    },
    enabled: !!rigAddress,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 30_000, // Re-enable auto-refetch now that we have the Mine entity
    refetchOnWindowFocus: false,
    retry: false,
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
      try {
        const mineEvents = await getMines(rigAddress, pageSize, 0);
        return mineEvents.map(parseMineEventToMessage);
      } catch (err) {
        console.warn("[useMineHistoryPaginated] Subgraph query failed:", err);
        return [];
      }
    },
    enabled: !!rigAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
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
