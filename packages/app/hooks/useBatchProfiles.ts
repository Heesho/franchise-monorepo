"use client";

import { useQuery } from "@tanstack/react-query";

export type UserProfile = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

const PROFILE_STALE_TIME = 10 * 60 * 1000; // 10 minutes

/**
 * Batch fetch Neynar profiles for multiple addresses
 * Much more efficient than individual requests per address
 */
export function useBatchProfiles(addresses: string[]) {
  // Normalize and deduplicate addresses
  const uniqueAddresses = [
    ...new Set(
      addresses
        .filter(Boolean)
        .map((addr) => addr.toLowerCase())
        .filter((addr) => addr !== "0x0000000000000000000000000000000000000000")
    ),
  ];

  const { data, isLoading } = useQuery({
    queryKey: ["batchProfiles", uniqueAddresses.sort().join(",")],
    queryFn: async () => {
      if (uniqueAddresses.length === 0) return {};

      const res = await fetch("/api/neynar/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: uniqueAddresses }),
      });

      if (!res.ok) return {};
      const data = await res.json();
      return (data.addressToUser || {}) as Record<string, UserProfile>;
    },
    enabled: uniqueAddresses.length > 0,
    staleTime: PROFILE_STALE_TIME,
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: false,
  });

  return {
    profiles: data ?? {},
    isLoading,
    getProfile: (address: string) => data?.[address.toLowerCase()] ?? null,
    getDisplayName: (address: string) => {
      const profile = data?.[address.toLowerCase()];
      return (
        profile?.displayName ??
        profile?.username ??
        `${address.slice(0, 6)}...${address.slice(-4)}`
      );
    },
    getAvatarUrl: (address: string) => {
      const profile = data?.[address.toLowerCase()];
      return (
        profile?.pfpUrl ??
        `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(address.toLowerCase())}`
      );
    },
  };
}

/**
 * Single profile lookup with caching
 * Uses the batch endpoint under the hood for consistency
 */
export function useProfile(address: string | undefined) {
  const normalizedAddress = address?.toLowerCase();
  const enabled =
    !!normalizedAddress &&
    normalizedAddress !== "0x0000000000000000000000000000000000000000";

  const { data, isLoading } = useQuery({
    queryKey: ["profile", normalizedAddress],
    queryFn: async () => {
      if (!normalizedAddress) return null;

      const res = await fetch(
        `/api/neynar/user?address=${encodeURIComponent(normalizedAddress)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.user as UserProfile | null;
    },
    enabled,
    staleTime: PROFILE_STALE_TIME,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const displayName =
    data?.displayName ??
    data?.username ??
    (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "");

  const avatarUrl =
    data?.pfpUrl ??
    (address
      ? `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(address.toLowerCase())}`
      : "");

  return {
    profile: data,
    displayName,
    avatarUrl,
    fid: data?.fid ?? null,
    isLoading,
  };
}
