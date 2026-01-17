"use client";

import { useQuery } from "@tanstack/react-query";

export type FriendUser = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  followerCount?: number;
  followingCount?: number;
  viewerContext?: {
    following: boolean;
    followedBy: boolean;
  } | null;
};

export type FriendActivityResult = {
  users: FriendUser[];
  friends: FriendUser[];
  totalUsers: number;
  totalFriends: number;
};

/**
 * Hook to fetch friend activity for a list of miner addresses
 *
 * @param addresses - Array of Ethereum addresses who have mined
 * @param viewerFid - The current user's Farcaster ID for social context
 */
export function useFriendActivity(
  addresses: string[],
  viewerFid: number | null | undefined
) {
  return useQuery<FriendActivityResult>({
    queryKey: ["friend-activity", addresses.sort().join(","), viewerFid],
    queryFn: async () => {
      if (addresses.length === 0) {
        return { users: [], friends: [], totalUsers: 0, totalFriends: 0 };
      }

      const res = await fetch("/api/neynar/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addresses,
          viewerFid,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch friend activity");
      }

      return res.json();
    },
    enabled: addresses.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}

/**
 * Get a friendly message for friend activity
 */
export function getFriendActivityMessage(friends: FriendUser[]): string | null {
  if (friends.length === 0) return null;

  if (friends.length === 1) {
    const friend = friends[0];
    const name = friend.displayName || friend.username || "A friend";
    return `${name} also mined this token`;
  }

  if (friends.length === 2) {
    const names = friends.map(f => f.displayName || f.username || "a friend");
    return `${names[0]} and ${names[1]} also mined this token`;
  }

  const firstName = friends[0].displayName || friends[0].username || "A friend";
  return `${firstName} and ${friends.length - 1} other friends also mined this token`;
}
