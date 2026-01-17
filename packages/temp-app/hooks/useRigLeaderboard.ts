"use client";

import { useQuery } from "@tanstack/react-query";
import { getRigLeaderboard } from "@/lib/subgraph-launchpad";
import { formatUnits } from "viem";
import { TOKEN_DECIMALS } from "@/lib/constants";

export type LeaderboardEntry = {
  rank: number;
  address: string;
  mined: bigint;
  minedFormatted: string;
  spent: bigint;
  spentFormatted: string;
  earned: bigint;
  earnedFormatted: string;
  isCurrentUser: boolean;
  isFriend: boolean;
  profile?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  } | null;
};

export type LeaderboardResult = {
  entries: LeaderboardEntry[];
  userRank: number | null;
  friendsOnLeaderboard: LeaderboardEntry[];
  isLoading: boolean;
};

/**
 * Hook to fetch the mining leaderboard for a rig
 *
 * @param rigAddress - The rig contract address
 * @param currentUserAddress - The current user's wallet address (for highlighting)
 * @param friendFids - Set of FIDs that are friends of the current user
 * @param limit - Number of entries to fetch
 */
export function useRigLeaderboard(
  rigAddress: string,
  currentUserAddress?: string,
  friendFids?: Set<number>,
  limit = 10
): LeaderboardResult {
  // Fetch leaderboard from subgraph
  const { data: leaderboardData, isLoading: isLoadingLeaderboard } = useQuery({
    queryKey: ["rig-leaderboard", rigAddress, limit],
    queryFn: () => getRigLeaderboard(rigAddress, limit),
    enabled: !!rigAddress,
    staleTime: 60 * 1000, // 60 seconds
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false, // Prevent duplicate requests on tab focus
  });

  // Get unique addresses for profile lookup
  const addresses = leaderboardData?.map(entry => entry.account.id) ?? [];

  // Fetch profiles for leaderboard entries
  const { data: profilesData, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["leaderboard-profiles", addresses.join(",")],
    queryFn: async () => {
      if (addresses.length === 0) return {};

      const res = await fetch("/api/neynar/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      });

      if (!res.ok) return {};
      const data = await res.json();
      return data.addressToUser || {};
    },
    enabled: addresses.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes - profiles don't change often
  });

  // Build leaderboard entries
  const entries: LeaderboardEntry[] = (leaderboardData ?? []).map((entry, index) => {
    const address = entry.account.id;
    const profile = profilesData?.[address.toLowerCase()];
    const isCurrentUser = currentUserAddress?.toLowerCase() === address.toLowerCase();
    const isFriend = profile?.fid ? (friendFids?.has(profile.fid) ?? false) : false;

    // Convert decimal strings from subgraph to BigInt (same pattern as useUserRigStats)
    const minedBigInt = BigInt(Math.floor(parseFloat(entry.mined) * 1e18));
    const spentBigInt = BigInt(Math.floor(parseFloat(entry.spent) * 1e18));
    const earnedBigInt = BigInt(Math.floor(parseFloat(entry.earned) * 1e18));

    return {
      rank: index + 1,
      address,
      mined: minedBigInt,
      minedFormatted: Number(formatUnits(minedBigInt, TOKEN_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 }),
      spent: spentBigInt,
      spentFormatted: Number(formatUnits(spentBigInt, 18)).toFixed(4),
      earned: earnedBigInt,
      earnedFormatted: Number(formatUnits(earnedBigInt, 18)).toFixed(4),
      isCurrentUser,
      isFriend,
      profile: profile ?? null,
    };
  });

  // Find user's rank
  const userRank = currentUserAddress
    ? entries.find(e => e.isCurrentUser)?.rank ?? null
    : null;

  // Get friends on leaderboard
  const friendsOnLeaderboard = entries.filter(e => e.isFriend && !e.isCurrentUser);

  return {
    entries,
    userRank,
    friendsOnLeaderboard,
    isLoading: isLoadingLeaderboard || isLoadingProfiles,
  };
}

/**
 * Generate a challenge message for sharing
 */
export function generateChallengeMessage(options: {
  userRank: number;
  tokenSymbol: string;
  tokenName: string;
  rigUrl: string;
  friendUsername?: string;
}): string {
  const { userRank, tokenSymbol, tokenName, friendUsername } = options;

  if (friendUsername) {
    return `I'm ranked #${userRank} on the ${tokenName} ($${tokenSymbol}) mining leaderboard! Can you beat me @${friendUsername}? ⛏️`;
  }

  return `I'm ranked #${userRank} on the ${tokenName} ($${tokenSymbol}) mining leaderboard! Think you can beat me? ⛏️`;
}
