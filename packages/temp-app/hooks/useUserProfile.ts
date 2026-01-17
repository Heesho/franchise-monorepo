import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import { base } from "wagmi/chains";
import { zeroAddress } from "viem";
import {
  getAccount,
  getUserRigAccounts,
  getRig,
  type SubgraphRig,
} from "@/lib/subgraph-launchpad";
import {
  CONTRACT_ADDRESSES,
  MULTICALL_ABI,
  type RigState,
} from "@/lib/contracts";

export type UserRigData = {
  address: `0x${string}`;
  unitAddress: `0x${string}`;
  tokenName: string;
  tokenSymbol: string;
  rigUri: string;
  miner: `0x${string}`;
  price: bigint;
  totalMinted: bigint;
  userMined: bigint;
  userSpent: bigint;
  userEarned: bigint;
};

export type UserLaunchedRig = {
  address: `0x${string}`;
  tokenName: string;
  tokenSymbol: string;
  rigUri: string;
  totalMinted: bigint;
  unitPrice: bigint; // price in DONUT
  revenue: bigint;
};

export function useUserProfile(accountAddress: `0x${string}` | undefined) {
  // Fetch user account data from subgraph
  const {
    data: accountData,
    isLoading: isLoadingAccount,
    error: accountError,
  } = useQuery({
    queryKey: ["userProfile", accountAddress],
    queryFn: async () => {
      if (!accountAddress) return null;
      return getAccount(accountAddress);
    },
    enabled: !!accountAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Get user's rig accounts (coins they've mined)
  const {
    data: rigAccounts,
    isLoading: isLoadingRigAccounts,
  } = useQuery({
    queryKey: ["userRigAccounts", accountAddress],
    queryFn: async () => {
      if (!accountAddress) return [];
      return getUserRigAccounts(accountAddress);
    },
    enabled: !!accountAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Get rig addresses for fetching additional data
  const rigAddresses = (rigAccounts ?? [])
    .map((ra) => ra.rig.id.toLowerCase() as `0x${string}`)
    .filter((addr): addr is `0x${string}` => !!addr);

  // Fetch rig details from subgraph (for token name/symbol)
  const {
    data: rigDetails,
    isLoading: isLoadingRigDetails,
  } = useQuery({
    queryKey: ["userRigDetails", rigAddresses],
    queryFn: async () => {
      if (rigAddresses.length === 0) return [];
      const details = await Promise.all(
        rigAddresses.map((addr) => getRig(addr))
      );
      return details.filter((d): d is SubgraphRig => d !== null);
    },
    enabled: rigAddresses.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Fetch on-chain states for mined rigs
  const contracts = rigAddresses.map((address) => ({
    address: CONTRACT_ADDRESSES.multicall as `0x${string}`,
    abi: MULTICALL_ABI,
    functionName: "getRig" as const,
    args: [address, accountAddress ?? zeroAddress] as const,
    chainId: base.id,
  }));

  const { data: rigStates, isLoading: isLoadingStates } = useReadContracts({
    contracts,
    query: {
      enabled: rigAddresses.length > 0 && !!accountAddress,
      refetchInterval: 30_000,
    },
  });

  // Combine data for mined rigs
  const minedRigs: UserRigData[] = (rigAccounts ?? []).map((ra) => {
    const rigAddr = ra.rig.id.toLowerCase();
    const rigIndex = rigAddresses.findIndex((addr) => addr === rigAddr);
    const state = rigStates?.[rigIndex]?.result as RigState | undefined;
    const subgraphRig = rigDetails?.find((r) => r.id.toLowerCase() === rigAddr);

    return {
      address: rigAddr as `0x${string}`,
      unitAddress: (subgraphRig?.unit as `0x${string}`) ?? zeroAddress,
      tokenName: subgraphRig?.tokenName ?? "Unknown",
      tokenSymbol: subgraphRig?.tokenSymbol ?? "???",
      rigUri: state?.rigUri ?? "",
      miner: state?.miner ?? zeroAddress,
      price: state?.price ?? 0n,
      totalMinted: subgraphRig ? BigInt(Math.floor(parseFloat(subgraphRig.minted) * 1e18)) : 0n,
      userMined: BigInt(Math.floor(parseFloat(ra.mined) * 1e18)),
      userSpent: BigInt(Math.floor(parseFloat(ra.spent) * 1e18)),
      userEarned: BigInt(Math.floor(parseFloat(ra.earned) * 1e18)),
    };
  });

  // Get launched rig addresses for on-chain state
  const launchedRigAddresses = (accountData?.rigsLaunched ?? [])
    .map((rig: SubgraphRig) => rig.id.toLowerCase() as `0x${string}`);

  // Fetch on-chain states for launched rigs
  const launchedContracts = launchedRigAddresses.map((address) => ({
    address: CONTRACT_ADDRESSES.multicall as `0x${string}`,
    abi: MULTICALL_ABI,
    functionName: "getRig" as const,
    args: [address, accountAddress ?? zeroAddress] as const,
    chainId: base.id,
  }));

  const { data: launchedRigStates, isLoading: isLoadingLaunchedStates } = useReadContracts({
    contracts: launchedContracts,
    query: {
      enabled: launchedRigAddresses.length > 0,
      refetchInterval: 30_000,
    },
  });

  // Process launched rigs with on-chain data
  const launchedRigs: UserLaunchedRig[] = (accountData?.rigsLaunched ?? []).map((rig: SubgraphRig, index: number) => {
    const state = launchedRigStates?.[index]?.result as RigState | undefined;
    return {
      address: rig.id.toLowerCase() as `0x${string}`,
      tokenName: rig.tokenName,
      tokenSymbol: rig.tokenSymbol,
      rigUri: state?.rigUri ?? "",
      totalMinted: BigInt(Math.floor(parseFloat(rig.minted) * 1e18)),
      unitPrice: state?.unitPrice ?? 0n,
      revenue: BigInt(Math.floor(parseFloat(rig.revenue) * 1e18)),
    };
  });

  const isLoading = isLoadingAccount || isLoadingRigAccounts || isLoadingRigDetails || isLoadingStates || isLoadingLaunchedStates;

  return {
    minedRigs,
    launchedRigs,
    isLoading,
    error: accountError,
  };
}
