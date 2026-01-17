import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { fallback, http, createStorage, cookieStorage } from "wagmi";
import { base } from "wagmi/chains";
import { createConfig } from "wagmi";

// Backup RPC endpoints for Base mainnet with automatic fallback
// Order: Primary (env) -> Alchemy (env) -> Public RPCs (no rate-limited defaults)
const BASE_RPC_ENDPOINTS = [
  // Primary RPC from env
  process.env.NEXT_PUBLIC_BASE_RPC_URL,
  // Alchemy backup from env
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL,
  // Public backup RPCs (reliable, no auth required)
  "https://base.llamarpc.com",
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
].filter((url): url is string => !!url && url !== "");

// Create transport array with retry configuration
const baseTransports = BASE_RPC_ENDPOINTS.map((url) =>
  http(url, {
    retryCount: 2,
    retryDelay: 1500,
    timeout: 15_000,
  })
);

export const wagmiConfig = createConfig({
  chains: [base],
  ssr: true,
  connectors: [farcasterMiniApp()],
  transports: {
    // Fallback transport: tries each RPC in order until one succeeds
    // rank: false to avoid constant probing of all endpoints
    [base.id]: fallback(baseTransports, { rank: false }),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  // Increased polling interval to reduce request frequency
  pollingInterval: 30_000,
});
