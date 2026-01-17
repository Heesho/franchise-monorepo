"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount, useConnect } from "wagmi";
import { base } from "wagmi/chains";
import { SDK_READY_TIMEOUT_MS } from "@/lib/constants";

export type FarcasterUser = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

export type FarcasterContext = {
  user?: FarcasterUser;
};

// Session storage key for tracking auto-connect attempts
const AUTO_CONNECT_KEY = "farcaster_auto_connect_attempted";

/**
 * Hook to manage Farcaster Mini App context, SDK ready state, and wallet auto-connection
 */
export function useFarcaster() {
  const readyRef = useRef(false);
  const [context, setContext] = useState<FarcasterContext | null>(null);

  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const primaryConnector = connectors[0];

  // Fetch Farcaster context
  useEffect(() => {
    let cancelled = false;
    const hydrateContext = async () => {
      try {
        const ctx = (await (sdk as unknown as {
          context: Promise<FarcasterContext> | FarcasterContext;
        }).context) as FarcasterContext;
        if (!cancelled) {
          setContext(ctx);
        }
      } catch {
        if (!cancelled) setContext(null);
      }
    };
    hydrateContext();
    return () => {
      cancelled = true;
    };
  }, []);

  // SDK ready
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!readyRef.current) {
        readyRef.current = true;
        sdk.actions.ready().catch(() => {});
      }
    }, SDK_READY_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  // Auto-connect wallet (only once per session)
  useEffect(() => {
    // Check if we already attempted this session
    const alreadyAttempted = typeof window !== "undefined" && sessionStorage.getItem(AUTO_CONNECT_KEY);

    if (
      alreadyAttempted ||
      isConnected ||
      !primaryConnector ||
      isConnecting
    ) {
      return;
    }

    // Mark as attempted in sessionStorage
    if (typeof window !== "undefined") {
      sessionStorage.setItem(AUTO_CONNECT_KEY, "true");
    }

    connectAsync({
      connector: primaryConnector,
      chainId: base.id,
    }).catch(() => {});
  }, [connectAsync, isConnected, isConnecting, primaryConnector]);

  // Connect wallet manually
  const connect = useCallback(async () => {
    if (!primaryConnector) {
      throw new Error("Wallet connector not available");
    }
    const result = await connectAsync({
      connector: primaryConnector,
      chainId: base.id,
    });
    return result.accounts[0];
  }, [connectAsync, primaryConnector]);

  return {
    context,
    user: context?.user ?? null,
    address,
    isConnected,
    isConnecting,
    connect,
    primaryConnector,
  };
}

/**
 * Get user display name from Farcaster context
 */
export function getUserDisplayName(user: FarcasterUser | null | undefined): string {
  return user?.displayName ?? user?.username ?? "Farcaster user";
}

/**
 * Get user handle (@username or fid) from Farcaster context
 */
export function getUserHandle(user: FarcasterUser | null | undefined): string {
  if (user?.username) return `@${user.username}`;
  if (user?.fid) return `fid ${user.fid}`;
  return "";
}

/**
 * Get initials from a label (for avatar fallback)
 */
export function initialsFrom(label?: string): string {
  if (!label) return "";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
}

/**
 * Compose and share a cast to Farcaster
 * Opens the native Farcaster compose UI with pre-filled text
 */
export async function composeCast(options: {
  text: string;
  embeds?: string[];
}): Promise<boolean> {
  try {
    // SDK expects embeds as a tuple of 0-2 URLs: [] | [string] | [string, string]
    const embedUrls = options.embeds?.slice(0, 2) as [] | [string] | [string, string] | undefined;
    await sdk.actions.composeCast({
      text: options.text,
      embeds: embedUrls,
    });
    return true;
  } catch (error) {
    console.error("Failed to compose cast:", error);
    return false;
  }
}

/**
 * Share a mining achievement to Farcaster
 */
export async function shareMiningAchievement(options: {
  tokenSymbol: string;
  tokenName: string;
  amountMined: string;
  rigUrl: string;
  message?: string;
}): Promise<boolean> {
  const { tokenSymbol, tokenName, amountMined, rigUrl, message } = options;

  let text = `⛏️ Just mined ${amountMined} $${tokenSymbol} on ${tokenName}!`;

  if (message) {
    text += `\n\n"${message}"`;
  }

  text += `\n\nMine with me 👇`;

  return composeCast({
    text,
    embeds: [rigUrl],
  });
}

/**
 * Share a new token launch to Farcaster
 */
export async function shareLaunch(options: {
  tokenSymbol: string;
  tokenName: string;
  appUrl: string;
}): Promise<boolean> {
  const { tokenSymbol, tokenName, appUrl } = options;

  const text = `🎉 Just opened a franchise!\n\n$${tokenSymbol} (${tokenName}) is now live.\n\nCome mine with me 👇`;

  return composeCast({
    text,
    embeds: [appUrl],
  });
}

/**
 * View a Farcaster user's profile
 * Opens the native Farcaster profile view
 */
export async function viewProfile(fid: number): Promise<boolean> {
  try {
    await sdk.actions.viewProfile({ fid });
    return true;
  } catch (error) {
    console.error("Failed to view profile:", error);
    return false;
  }
}
