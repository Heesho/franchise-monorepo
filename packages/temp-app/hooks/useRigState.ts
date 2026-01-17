import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { zeroAddress } from "viem";
import {
  CONTRACT_ADDRESSES,
  MULTICALL_ABI,
  CORE_ABI,
  ERC20_ABI,
  type RigState,
} from "@/lib/contracts";

export type RigInfo = {
  address: `0x${string}`;
  unitAddress: `0x${string}`;
  auctionAddress: `0x${string}`;
  lpAddress: `0x${string}`;
  quoteAddress: `0x${string}`;
  launcher: `0x${string}`;
  tokenName: string;
  tokenSymbol: string;
};

export function useRigState(
  rigAddress: `0x${string}` | undefined,
  account: `0x${string}` | undefined,
  slotIndex: bigint = 0n // Default to slot 0 for single-slot rigs
) {
  const { data: rawRigState, refetch, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESSES.multicall as `0x${string}`,
    abi: MULTICALL_ABI,
    functionName: "getRig",
    args: rigAddress ? [rigAddress, slotIndex, account ?? zeroAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!rigAddress,
      refetchInterval: 15_000,
      refetchOnWindowFocus: false,
    },
  });

  const rigState = rawRigState as RigState | undefined;

  return {
    rigState,
    refetch,
    isLoading,
    error,
  };
}

export function useRigInfo(rigAddress: `0x${string}` | undefined) {
  // Get unit token address
  const { data: unitAddress } = useReadContract({
    address: CONTRACT_ADDRESSES.core as `0x${string}`,
    abi: CORE_ABI,
    functionName: "rigToUnit",
    args: rigAddress ? [rigAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!rigAddress,
    },
  });

  // Get auction address
  const { data: auctionAddress } = useReadContract({
    address: CONTRACT_ADDRESSES.core as `0x${string}`,
    abi: CORE_ABI,
    functionName: "rigToAuction",
    args: rigAddress ? [rigAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!rigAddress,
    },
  });

  // Get LP token address
  const { data: lpAddress } = useReadContract({
    address: CONTRACT_ADDRESSES.core as `0x${string}`,
    abi: CORE_ABI,
    functionName: "rigToLP",
    args: rigAddress ? [rigAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!rigAddress,
    },
  });

  // Get quote token address
  const { data: quoteAddress } = useReadContract({
    address: CONTRACT_ADDRESSES.core as `0x${string}`,
    abi: CORE_ABI,
    functionName: "rigToQuote",
    args: rigAddress ? [rigAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!rigAddress,
    },
  });

  // Get launcher address
  const { data: launcher } = useReadContract({
    address: CONTRACT_ADDRESSES.core as `0x${string}`,
    abi: CORE_ABI,
    functionName: "rigToLauncher",
    args: rigAddress ? [rigAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!rigAddress,
    },
  });

  // Get token name
  const { data: tokenName } = useReadContract({
    address: unitAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "name",
    chainId: base.id,
    query: {
      enabled: !!unitAddress,
    },
  });

  // Get token symbol
  const { data: tokenSymbol } = useReadContract({
    address: unitAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "symbol",
    chainId: base.id,
    query: {
      enabled: !!unitAddress,
    },
  });

  const rigInfo: RigInfo | undefined =
    rigAddress && unitAddress && auctionAddress && lpAddress && launcher
      ? {
          address: rigAddress,
          unitAddress: unitAddress as `0x${string}`,
          auctionAddress: auctionAddress as `0x${string}`,
          lpAddress: lpAddress as `0x${string}`,
          quoteAddress: (quoteAddress as `0x${string}`) ?? CONTRACT_ADDRESSES.usdc,
          launcher: launcher as `0x${string}`,
          tokenName: (tokenName as string) ?? "",
          tokenSymbol: (tokenSymbol as string) ?? "",
        }
      : undefined;

  return {
    rigInfo,
    isLoading: !rigInfo && !!rigAddress,
  };
}
