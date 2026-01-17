import { useQuery } from "@tanstack/react-query";
import {
  getRigAccount,
  getUserRigAccounts,
  type SubgraphRigAccount,
} from "@/lib/subgraph-launchpad";

export type UserRigStats = {
  totalMined: bigint;
  totalSpent: bigint;
  totalEarned: bigint;
};

function parseRigAccountStats(stats: SubgraphRigAccount): UserRigStats {
  return {
    totalMined: BigInt(Math.floor(parseFloat(stats.mined) * 1e18)),
    totalSpent: BigInt(Math.floor(parseFloat(stats.spent) * 1e18)),
    totalEarned: BigInt(Math.floor(parseFloat(stats.earned) * 1e18)),
  };
}

export function useUserRigStats(
  userAddress: `0x${string}` | undefined,
  rigAddress: `0x${string}` | undefined
) {
  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ["userRigStats", userAddress, rigAddress],
    queryFn: async () => {
      if (!userAddress || !rigAddress) return null;
      const rawStats = await getRigAccount(rigAddress, userAddress);
      return rawStats ? parseRigAccountStats(rawStats) : null;
    },
    enabled: !!userAddress && !!rigAddress,
    staleTime: 15_000,
    refetchInterval: 15_000,
    retry: false,
  });

  return {
    stats,
    isLoading,
    error,
    refetch,
  };
}

export function useUserAllStats(userAddress: `0x${string}` | undefined) {
  const { data: allStats, isLoading, error, refetch } = useQuery({
    queryKey: ["userAllStats", userAddress],
    queryFn: async () => {
      if (!userAddress) return [];
      const rawStats = await getUserRigAccounts(userAddress);
      return rawStats.map(parseRigAccountStats);
    },
    enabled: !!userAddress,
    staleTime: 30_000,
    retry: false,
  });

  return {
    allStats: allStats ?? [],
    isLoading,
    error,
    refetch,
  };
}
