"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowDownUp, Copy, Check, Share2, X, Delete } from "lucide-react";
import Link from "next/link";
import {
  useBalance,
  useReadContract,
  useReadContracts,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther, formatUnits, parseEther, parseUnits, type Address, zeroAddress } from "viem";

import { NavBar } from "@/components/nav-bar";
import { LazyPriceChart } from "@/components/lazy-price-chart";
import type { HoverData } from "@/components/price-chart";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MineHistoryItem } from "@/components/mine-history-item";
import { TokenStats } from "@/components/token-stats";
import { useRigState, useRigInfo } from "@/hooks/useRigState";
import { useAuctionState } from "@/hooks/useAuctionState";
import { useUserRigStats } from "@/hooks/useUserRigStats";
import { usePriceHistory, type Timeframe } from "@/hooks/usePriceHistory";
import { useDexScreener } from "@/hooks/useDexScreener";
import { useMineHistory } from "@/hooks/useMineHistory";
import { useFarcaster, shareMiningAchievement, viewProfile } from "@/hooks/useFarcaster";
import { useFriendActivity, getFriendActivityMessage } from "@/hooks/useFriendActivity";
import { useRigLeaderboard } from "@/hooks/useRigLeaderboard";
import { Leaderboard } from "@/components/leaderboard";
import { usePrices } from "@/hooks/usePrices";
import { useTokenMetadata } from "@/hooks/useMetadata";
import { useProfile } from "@/hooks/useBatchProfiles";
import {
  useBatchedTransaction,
  encodeApproveCall,
  encodeContractCall,
  type Call,
} from "@/hooks/useBatchedTransaction";
import { CONTRACT_ADDRESSES, MULTICALL_ABI, ERC20_ABI, NATIVE_ETH_ADDRESS, UNIV2_ROUTER_ABI, UNIV2_PAIR_ABI, CORE_ABI } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { useSwapPrice, useSwapQuote, formatBuyAmount } from "@/hooks/useSwapQuote";
import {
  DEFAULT_CHAIN_ID,
  STALE_TIME_PROFILE_MS,
  DEADLINE_BUFFER_SECONDS,
  TOKEN_DECIMALS,
  ipfsToHttp,
} from "@/lib/constants";

const formatUsd = (value: number, compact = false) => {
  if (compact) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Animated dots component for loading state
function LoadingDots() {
  return (
    <span className="inline-flex">
      <span className="animate-bounce-dot-1">.</span>
      <span className="animate-bounce-dot-2">.</span>
      <span className="animate-bounce-dot-3">.</span>
    </span>
  );
}

// Format number with commas (e.g., "100000" -> "100,000", "100000.5" -> "100,000.5")
function formatWithCommas(value: string): string {
  if (!value) return "0";
  const parts = value.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

// Number pad button component
function NumPadButton({
  value,
  onClick,
  children,
}: {
  value: string;
  onClick: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onClick(value)}
      className="flex-1 h-14 flex items-center justify-center text-xl font-medium text-white hover:bg-zinc-800/50 active:bg-zinc-700/50 rounded-xl transition-colors"
    >
      {children}
    </button>
  );
}


export default function RigDetailPage() {
  const params = useParams();
  const rigAddress = params.address as `0x${string}`;

  const [customMessage, setCustomMessage] = useState("");
  const [mineResult, setMineResult] = useState<"success" | "failure" | null>(null);

  // Use shared price hook (cached across components)
  const { ethUsdPrice, donutUsdPrice } = usePrices();
  const mineResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tradeResult, setTradeResult] = useState<"success" | "failure" | null>(null);
  const tradeResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1D");
  const [chartHover, setChartHover] = useState<HoverData>(null);
  const [showHeaderTicker, setShowHeaderTicker] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [lastMineDetails, setLastMineDetails] = useState<{
    priceSpent: string;
    message: string;
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Action menu state
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showMineModal, setShowMineModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showLiquidityModal, setShowLiquidityModal] = useState(false);
  const [liquidityAmount, setLiquidityAmount] = useState("");

  // Trade state
  const [tradeDirection, setTradeDirection] = useState<"buy" | "sell">("buy"); // buy = ETH -> Unit, sell = Unit -> ETH
  const [tradeAmount, setTradeAmount] = useState("");

  // Farcaster context and wallet connection
  const { address, isConnected, connect, user: farcasterUser } = useFarcaster();

  // Rig data
  const { rigState, refetch: refetchRigState } = useRigState(rigAddress, address);
  const { rigInfo } = useRigInfo(rigAddress);
  const { auctionState, refetch: refetchAuctionState } = useAuctionState(rigAddress, address);
  const { stats: userStats } = useUserRigStats(address, rigAddress);

  // Mining price history for chart (from subgraph epochs, in USD)
  const { priceHistory, isLoading: isLoadingPrice, timeframeSeconds, tokenFirstActiveTime } = usePriceHistory(rigAddress, selectedTimeframe, ethUsdPrice);

  // DexScreener data for token price/market stats
  const { pairData, lpAddress } = useDexScreener(rigAddress, rigInfo?.unitAddress);
  const { mines: mineHistory } = useMineHistory(rigAddress, 10);

  // Friend activity - get unique miner addresses and check for friends
  const minerAddresses = useMemo(() => {
    const uniqueAddrs = new Set<string>();
    mineHistory.forEach(mine => uniqueAddrs.add(mine.miner));
    if (rigState?.miner && rigState.miner !== "0x0000000000000000000000000000000000000000") {
      uniqueAddrs.add(rigState.miner);
    }
    return Array.from(uniqueAddrs);
  }, [mineHistory, rigState?.miner]);

  const { data: friendActivity } = useFriendActivity(minerAddresses, farcasterUser?.fid);
  const friendActivityMessage = friendActivity?.friends ? getFriendActivityMessage(friendActivity.friends) : null;

  // Leaderboard with friend highlighting
  const friendFids = useMemo(() => {
    if (!friendActivity?.friends) return new Set<number>();
    return new Set(friendActivity.friends.map(f => f.fid));
  }, [friendActivity?.friends]);

  const { entries: leaderboardEntries, userRank, isLoading: isLoadingLeaderboard } = useRigLeaderboard(
    rigAddress,
    address,
    friendFids,
    10
  );

  // Use cached metadata hook
  const { metadata: tokenMetadata, logoUrl: tokenLogoUrl } = useTokenMetadata(rigState?.rigUri);

  // Token total supply
  const { data: totalSupplyRaw } = useReadContract({
    address: rigInfo?.unitAddress,
    abi: ERC20_ABI,
    functionName: "totalSupply",
    chainId: DEFAULT_CHAIN_ID,
    query: {
      enabled: !!rigInfo?.unitAddress,
    },
  });

  // Transaction handling (mining)
  const { data: txHash, writeContract, isPending: isWriting, reset: resetWrite } = useWriteContract();
  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash, chainId: DEFAULT_CHAIN_ID });

  // Trade transaction handling - for buys (ETH -> Token, no approval needed)
  const { sendTransaction, isPending: isSwapping, data: swapTxHash } = useSendTransaction();
  const { isLoading: isWaitingSwap, isSuccess: swapSuccess, isError: swapError } = useWaitForTransactionReceipt({ hash: swapTxHash });

  // Batched transaction handling - for sells (Token -> ETH, needs approval)
  const {
    execute: executeBatch,
    state: batchState,
    reset: resetBatch,
  } = useBatchedTransaction();

  // Trade balances
  const { data: ethBalanceData, refetch: refetchEthBalance } = useBalance({
    address,
    chainId: DEFAULT_CHAIN_ID,
  });

  const { data: unitBalanceData, refetch: refetchUnitBalance } = useBalance({
    address,
    token: rigInfo?.unitAddress as Address,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: !!rigInfo?.unitAddress },
  });

  // DONUT balance for liquidity
  const { data: donutBalanceData, refetch: refetchDonutBalance } = useBalance({
    address,
    token: CONTRACT_ADDRESSES.donut as Address,
    chainId: DEFAULT_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Get LP address from Core contract
  const { data: lpAddressFromCore } = useReadContract({
    address: CONTRACT_ADDRESSES.core as Address,
    abi: CORE_ABI,
    functionName: "rigToLP",
    args: [rigAddress],
    chainId: DEFAULT_CHAIN_ID,
  });

  // Read LP pair info (reserves, token0/token1)
  const { data: lpPairInfo, refetch: refetchLpPairInfo } = useReadContracts({
    contracts: lpAddressFromCore ? [
      {
        address: lpAddressFromCore as Address,
        abi: UNIV2_PAIR_ABI,
        functionName: "token0",
        chainId: DEFAULT_CHAIN_ID,
      },
      {
        address: lpAddressFromCore as Address,
        abi: UNIV2_PAIR_ABI,
        functionName: "token1",
        chainId: DEFAULT_CHAIN_ID,
      },
      {
        address: lpAddressFromCore as Address,
        abi: UNIV2_PAIR_ABI,
        functionName: "getReserves",
        chainId: DEFAULT_CHAIN_ID,
      },
      {
        address: lpAddressFromCore as Address,
        abi: UNIV2_PAIR_ABI,
        functionName: "totalSupply",
        chainId: DEFAULT_CHAIN_ID,
      },
    ] : [],
    query: {
      enabled: !!lpAddressFromCore,
      refetchInterval: 30_000,
    },
  });

  const lpToken0 = lpPairInfo?.[0]?.result as Address | undefined;
  const lpToken1 = lpPairInfo?.[1]?.result as Address | undefined;
  const lpReserves = lpPairInfo?.[2]?.result as [bigint, bigint, number] | undefined;
  const lpTotalSupply = lpPairInfo?.[3]?.result as bigint | undefined;

  // Determine which token is UNIT and which is DONUT
  const isUnitToken0 = rigInfo?.unitAddress && lpToken0 &&
    rigInfo.unitAddress.toLowerCase() === lpToken0.toLowerCase();
  const unitReserve = lpReserves ? (isUnitToken0 ? lpReserves[0] : lpReserves[1]) : 0n;
  const donutReserve = lpReserves ? (isUnitToken0 ? lpReserves[1] : lpReserves[0]) : 0n;

  // Batched transaction for LP operations
  const {
    execute: executeLpBatch,
    state: lpBatchState,
    reset: resetLpBatch,
  } = useBatchedTransaction();

  // Batched transaction for auction operations
  const {
    execute: executeAuctionBatch,
    state: auctionBatchState,
    reset: resetAuctionBatch,
  } = useBatchedTransaction();

  const refetchBalances = useCallback(() => {
    refetchEthBalance();
    refetchUnitBalance();
    refetchDonutBalance();
    refetchLpPairInfo();
  }, [refetchEthBalance, refetchUnitBalance, refetchDonutBalance, refetchLpPairInfo]);

  // Swap tokens for trading
  const sellToken = tradeDirection === "buy" ? NATIVE_ETH_ADDRESS : (rigInfo?.unitAddress || "");
  const buyToken = tradeDirection === "buy" ? (rigInfo?.unitAddress || "") : NATIVE_ETH_ADDRESS;
  const sellDecimals = tradeDirection === "buy" ? 18 : 18; // ETH and unit tokens are both 18 decimals

  // Get price quote
  const { data: tradePriceQuote, isLoading: isLoadingTradePrice, error: tradePriceError } = useSwapPrice({
    sellToken,
    buyToken,
    sellAmount: tradeAmount || "0",
    sellTokenDecimals: sellDecimals,
    enabled: showTradeModal && !!rigInfo?.unitAddress && !!tradeAmount && parseFloat(tradeAmount) > 0,
  });

  // Calculate output amount and price impact for auto slippage
  const tradeOutputAmountForSlippage = tradePriceQuote?.buyAmount
    ? formatBuyAmount(tradePriceQuote.buyAmount, 18)
    : "0";

  // Auto slippage: price impact + 1%, minimum 1%, maximum 49%
  const slippage = useMemo(() => {
    if (!tradePriceQuote?.buyAmount || !tradeAmount || parseFloat(tradeAmount) === 0) return 1;

    // Try Kyber's USD values first
    let inputUsd = tradePriceQuote?.sellAmountUsd ? parseFloat(tradePriceQuote.sellAmountUsd) : 0;
    let outputUsd = tradePriceQuote?.buyAmountUsd ? parseFloat(tradePriceQuote.buyAmountUsd) : 0;

    // If Kyber doesn't have USD data, calculate ourselves
    if (inputUsd === 0 || outputUsd === 0) {
      const dexPrice = pairData?.priceUsd ? parseFloat(pairData.priceUsd) : null;
      const onChainPrice = rigState?.unitPrice && rigState.unitPrice > 0n
        ? Number(formatEther(rigState.unitPrice)) * donutUsdPrice
        : 0;
      const tokenPrice = dexPrice ?? onChainPrice;

      inputUsd = parseFloat(tradeAmount) * (tradeDirection === "buy" ? ethUsdPrice : tokenPrice);
      outputUsd = parseFloat(tradeOutputAmountForSlippage) * (tradeDirection === "buy" ? tokenPrice : ethUsdPrice);
    }

    if (inputUsd === 0) return 2;

    const impact = ((inputUsd - outputUsd) / inputUsd) * 100;
    // Add 2% buffer on top of price impact to account for price movement
    return Math.min(49, Math.max(2, Math.ceil(Math.max(0, impact)) + 2));
  }, [tradePriceQuote, tradeAmount, tradeOutputAmountForSlippage, tradeDirection, ethUsdPrice, pairData?.priceUsd, rigState?.unitPrice, donutUsdPrice]);

  // Get full quote for trading
  const { data: tradeQuote, isLoading: isLoadingTradeQuote, refetch: refetchTradeQuote } = useSwapQuote({
    sellToken,
    buyToken,
    sellAmount: tradeAmount || "0",
    sellTokenDecimals: sellDecimals,
    taker: address,
    slippageBps: Math.round(slippage * 100),
    enabled: showTradeModal && !!rigInfo?.unitAddress && !!tradeAmount && parseFloat(tradeAmount) > 0 && !!address,
  });


  // Result handling
  const resetMineResult = useCallback(() => {
    if (mineResultTimeoutRef.current) {
      clearTimeout(mineResultTimeoutRef.current);
      mineResultTimeoutRef.current = null;
    }
    setMineResult(null);
  }, []);

  const showMineResult = useCallback((result: "success" | "failure") => {
    if (mineResultTimeoutRef.current) clearTimeout(mineResultTimeoutRef.current);
    setMineResult(result);
    mineResultTimeoutRef.current = setTimeout(() => {
      setMineResult(null);
      mineResultTimeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (mineResultTimeoutRef.current) clearTimeout(mineResultTimeoutRef.current);
      if (tradeResultTimeoutRef.current) clearTimeout(tradeResultTimeoutRef.current);
    };
  }, []);


  // Scroll handler for header ticker - show when price bottom gets covered by header
  useEffect(() => {
    const container = scrollContainerRef.current;
    const price = priceRef.current;
    const header = headerRef.current;
    if (!container || !price || !header) return;

    const handleScroll = () => {
      const priceRect = price.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      // Show ticker when price bottom goes above the header bottom
      setShowHeaderTicker(priceRect.bottom < headerRect.bottom);
    };

    // Run once on mount to set initial state
    handleScroll();

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [rigInfo, rigState]); // Re-run when data loads

  // Handle receipt
  useEffect(() => {
    if (!receipt) return;
    if (receipt.status === "success" || receipt.status === "reverted") {
      showMineResult(receipt.status === "success" ? "success" : "failure");
      refetchRigState();
      if (receipt.status === "success") setCustomMessage("");
      const resetTimer = setTimeout(() => resetWrite(), 500);
      return () => clearTimeout(resetTimer);
    }
  }, [receipt, refetchRigState, resetWrite, showMineResult]);

  // Interpolated mining values
  const [interpolatedGlazed, setInterpolatedGlazed] = useState<bigint | null>(null);
  const [glazeElapsedSeconds, setGlazeElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (!rigState) {
      setInterpolatedGlazed(null);
      return;
    }
    setInterpolatedGlazed(rigState.glazed);
    const interval = setInterval(() => {
      if (rigState.nextUps > 0n) {
        setInterpolatedGlazed((prev) => (prev ? prev + rigState.nextUps : rigState.glazed));
      }
    }, 1_000);
    return () => clearInterval(interval);
  }, [rigState]);

  useEffect(() => {
    if (!rigState) {
      setGlazeElapsedSeconds(0);
      return;
    }
    const startTimeSeconds = Number(rigState.epochStartTime);
    const initialElapsed = Math.floor(Date.now() / 1000) - startTimeSeconds;
    setGlazeElapsedSeconds(initialElapsed);
    const interval = setInterval(() => {
      setGlazeElapsedSeconds(Math.floor(Date.now() / 1000) - startTimeSeconds);
    }, 1_000);
    return () => clearInterval(interval);
  }, [rigState]);

  // Mine handler
  const handleMine = useCallback(async () => {
    if (!rigState) return;
    resetMineResult();
    try {
      let targetAddress = address;
      if (!targetAddress) {
        targetAddress = await connect();
      }
      if (!targetAddress) throw new Error("Unable to determine wallet address.");

      const price = rigState.price;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_SECONDS);
      const maxPrice = price === 0n ? 0n : (price * 105n) / 100n;
      const messageToSend = customMessage.trim() || tokenMetadata?.defaultMessage || "gm";

      // Store mine details for sharing after success
      setLastMineDetails({
        priceSpent: Number(formatEther(price)).toFixed(6),
        message: messageToSend,
      });

      await writeContract({
        account: targetAddress as Address,
        address: CONTRACT_ADDRESSES.multicall as Address,
        abi: MULTICALL_ABI,
        functionName: "mine",
        args: [rigAddress, rigState.epochId, deadline, maxPrice, messageToSend],
        value: price,
        chainId: DEFAULT_CHAIN_ID,
      });
    } catch (error) {
      console.error("Failed to mine:", error);
      showMineResult("failure");
      setLastMineDetails(null);
      resetWrite();
    }
  }, [address, connect, customMessage, rigState, rigAddress, resetMineResult, resetWrite, showMineResult, writeContract, tokenMetadata]);

  // Share mining achievement handler
  const handleShareMine = useCallback(async () => {
    if (!rigInfo) return;

    const rigUrl = `${window.location.origin}/rig/${rigAddress}`;

    // Use current session mined amount or estimate from mining rate
    const currentGlazed = interpolatedGlazed ?? rigState?.glazed ?? 0n;
    const minedAmount = currentGlazed > 0n
      ? Number(formatUnits(currentGlazed, TOKEN_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : rigState?.nextUps
        ? Number(formatUnits(rigState.nextUps * 60n, TOKEN_DECIMALS)).toFixed(0)
        : "some";

    await shareMiningAchievement({
      tokenSymbol: rigInfo.tokenSymbol || "TOKEN",
      tokenName: rigInfo.tokenName || "this token",
      amountMined: minedAmount,
      rigUrl,
      message: customMessage && customMessage !== "gm" ? customMessage : undefined,
    });
  }, [rigInfo, rigAddress, rigState?.glazed, rigState?.nextUps, interpolatedGlazed, customMessage]);

  // Trade handlers
  const handleTrade = useCallback(async () => {
    if (!tradeQuote?.transaction || !address || !tradeAmount) return;

    const isTwoHop = tradeQuote.routeType === "two-hop" && tradeQuote.transaction2;

    if (tradeDirection === "sell" && rigInfo?.unitAddress) {
      // Sells: Token -> DONUT -> ETH (two-hop) or Token -> ETH (direct)
      const sellAmountWei = parseUnits(tradeAmount, 18);

      if (isTwoHop) {
        // Two-hop sell: approve token, swap to DONUT, approve DONUT, swap to ETH
        const approveTokenCall = encodeApproveCall(
          rigInfo.unitAddress as Address,
          tradeQuote.transaction.to as Address,
          sellAmountWei
        );

        const swap1Call: Call = {
          to: tradeQuote.transaction.to as Address,
          data: tradeQuote.transaction.data as `0x${string}`,
          value: BigInt(tradeQuote.transaction.value || "0"),
        };

        const donutAmount = BigInt(tradeQuote.intermediateAmount || "0");
        const approveDonutCall = encodeApproveCall(
          CONTRACT_ADDRESSES.donut as Address,
          tradeQuote.transaction2!.to as Address,
          donutAmount
        );

        const swap2Call: Call = {
          to: tradeQuote.transaction2!.to as Address,
          data: tradeQuote.transaction2!.data as `0x${string}`,
          value: BigInt(tradeQuote.transaction2!.value || "0"),
        };

        try {
          await executeBatch([approveTokenCall, swap1Call, approveDonutCall, swap2Call]);
        } catch (error) {
          console.error("Trade failed:", error);
        }
      } else {
        // Direct sell: just approve token and swap
        const approveCall = encodeApproveCall(
          rigInfo.unitAddress as Address,
          tradeQuote.transaction.to as Address,
          sellAmountWei
        );

        const swapCall: Call = {
          to: tradeQuote.transaction.to as Address,
          data: tradeQuote.transaction.data as `0x${string}`,
          value: BigInt(tradeQuote.transaction.value || "0"),
        };

        try {
          await executeBatch([approveCall, swapCall]);
        } catch (error) {
          console.error("Trade failed:", error);
        }
      }
    } else {
      // Buys: ETH -> DONUT -> Token (two-hop) or ETH -> Token (direct)
      if (isTwoHop) {
        // Two-hop buy: swap ETH to DONUT, approve DONUT, swap to Token
        const swap1Call: Call = {
          to: tradeQuote.transaction.to as Address,
          data: tradeQuote.transaction.data as `0x${string}`,
          value: BigInt(tradeQuote.transaction.value || "0"),
        };

        const donutAmount = BigInt(tradeQuote.intermediateAmount || "0");
        const approveDonutCall = encodeApproveCall(
          CONTRACT_ADDRESSES.donut as Address,
          tradeQuote.transaction2!.to as Address,
          donutAmount
        );

        const swap2Call: Call = {
          to: tradeQuote.transaction2!.to as Address,
          data: tradeQuote.transaction2!.data as `0x${string}`,
          value: BigInt(tradeQuote.transaction2!.value || "0"),
        };

        try {
          await executeBatch([swap1Call, approveDonutCall, swap2Call]);
        } catch (error) {
          console.error("Trade failed:", error);
        }
      } else {
        // Direct buy: no approval needed, just swap
        sendTransaction({
          to: tradeQuote.transaction.to as Address,
          data: tradeQuote.transaction.data as `0x${string}`,
          value: BigInt(tradeQuote.transaction.value || "0"),
          chainId: DEFAULT_CHAIN_ID,
        });
      }
    }
  }, [tradeQuote, address, tradeAmount, tradeDirection, rigInfo?.unitAddress, executeBatch, sendTransaction]);

  // Track last processed swap hash to detect new successful swaps
  const lastProcessedSwapHash = useRef<string | null>(null);

  // Handle swap result (for buys via sendTransaction)
  useEffect(() => {
    if (swapSuccess && swapTxHash && swapTxHash !== lastProcessedSwapHash.current) {
      lastProcessedSwapHash.current = swapTxHash;
      setTradeAmount("");
      // Refetch immediately, then again after delays to handle RPC lag
      refetchBalances();
      refetchRigState();
      setTimeout(() => {
        refetchBalances();
        refetchRigState();
      }, 2000);
      setTimeout(() => {
        refetchBalances();
        refetchRigState();
      }, 5000);
      if (tradeResultTimeoutRef.current) clearTimeout(tradeResultTimeoutRef.current);
      setTradeResult("success");
      tradeResultTimeoutRef.current = setTimeout(() => {
        setTradeResult(null);
        tradeResultTimeoutRef.current = null;
      }, 3000);
    }
  }, [swapSuccess, swapTxHash, refetchBalances, refetchRigState]);

  // Track last processed error hash
  const lastProcessedErrorHash = useRef<string | null>(null);

  // Handle swap failure (for buys via sendTransaction)
  useEffect(() => {
    if (swapError && swapTxHash && swapTxHash !== lastProcessedErrorHash.current) {
      lastProcessedErrorHash.current = swapTxHash;
      if (tradeResultTimeoutRef.current) clearTimeout(tradeResultTimeoutRef.current);
      setTradeResult("failure");
      tradeResultTimeoutRef.current = setTimeout(() => {
        setTradeResult(null);
        tradeResultTimeoutRef.current = null;
      }, 3000);
    }
  }, [swapError, swapTxHash]);

  // Handle batched transaction result (for sells)
  useEffect(() => {
    if (batchState === "success") {
      setTradeAmount("");
      resetBatch();
      // Refetch immediately, then again after delays to handle RPC lag
      refetchBalances();
      refetchRigState();
      setTimeout(() => {
        refetchBalances();
        refetchRigState();
      }, 2000);
      setTimeout(() => {
        refetchBalances();
        refetchRigState();
      }, 5000);
      if (tradeResultTimeoutRef.current) clearTimeout(tradeResultTimeoutRef.current);
      setTradeResult("success");
      tradeResultTimeoutRef.current = setTimeout(() => {
        setTradeResult(null);
        tradeResultTimeoutRef.current = null;
      }, 3000);
    } else if (batchState === "error") {
      resetBatch();
      if (tradeResultTimeoutRef.current) clearTimeout(tradeResultTimeoutRef.current);
      setTradeResult("failure");
      tradeResultTimeoutRef.current = setTimeout(() => {
        setTradeResult(null);
        tradeResultTimeoutRef.current = null;
      }, 3000);
    }
  }, [batchState, resetBatch, refetchBalances, refetchRigState]);

  // Liquidity result state
  const [lpResult, setLpResult] = useState<"success" | "failure" | null>(null);
  const lpResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auction result state
  const [auctionResult, setAuctionResult] = useState<"success" | "failure" | null>(null);
  const auctionResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle LP batch transaction result
  useEffect(() => {
    if (lpBatchState === "success") {
      setLiquidityAmount("");
      resetLpBatch();
      refetchBalances();
      refetchRigState();
      setTimeout(() => {
        refetchBalances();
        refetchRigState();
      }, 2000);
      if (lpResultTimeoutRef.current) clearTimeout(lpResultTimeoutRef.current);
      setLpResult("success");
      lpResultTimeoutRef.current = setTimeout(() => {
        setLpResult(null);
        lpResultTimeoutRef.current = null;
      }, 3000);
    } else if (lpBatchState === "error") {
      resetLpBatch();
      if (lpResultTimeoutRef.current) clearTimeout(lpResultTimeoutRef.current);
      setLpResult("failure");
      lpResultTimeoutRef.current = setTimeout(() => {
        setLpResult(null);
        lpResultTimeoutRef.current = null;
      }, 3000);
    }
  }, [lpBatchState, resetLpBatch, refetchBalances, refetchRigState]);

  // Handle auction batch transaction result
  useEffect(() => {
    if (auctionBatchState === "success") {
      resetAuctionBatch();
      refetchBalances();
      refetchAuctionState();
      setTimeout(() => {
        refetchBalances();
        refetchAuctionState();
      }, 2000);
      if (auctionResultTimeoutRef.current) clearTimeout(auctionResultTimeoutRef.current);
      setAuctionResult("success");
      auctionResultTimeoutRef.current = setTimeout(() => {
        setAuctionResult(null);
        auctionResultTimeoutRef.current = null;
      }, 3000);
    } else if (auctionBatchState === "error") {
      resetAuctionBatch();
      if (auctionResultTimeoutRef.current) clearTimeout(auctionResultTimeoutRef.current);
      setAuctionResult("failure");
      auctionResultTimeoutRef.current = setTimeout(() => {
        setAuctionResult(null);
        auctionResultTimeoutRef.current = null;
      }, 3000);
    }
  }, [auctionBatchState, resetAuctionBatch, refetchBalances, refetchAuctionState]);

  // Liquidity calculations
  const parsedLiquidityAmount = useMemo(() => {
    if (!liquidityAmount || isNaN(Number(liquidityAmount))) return 0n;
    try {
      return parseEther(liquidityAmount);
    } catch {
      return 0n;
    }
  }, [liquidityAmount]);

  const requiredDonutForLp = useMemo(() => {
    if (parsedLiquidityAmount === 0n || unitReserve === 0n || donutReserve === 0n) return 0n;
    // DONUT needed = (UNIT amount * DONUT reserve) / UNIT reserve
    // Add 0.5% buffer for slippage
    const exactDonut = (parsedLiquidityAmount * donutReserve) / unitReserve;
    return (exactDonut * 1005n) / 1000n;
  }, [parsedLiquidityAmount, unitReserve, donutReserve]);

  const estimatedLpTokens = useMemo(() => {
    if (parsedLiquidityAmount === 0n || unitReserve === 0n || !lpTotalSupply) return 0n;
    return (parsedLiquidityAmount * lpTotalSupply) / unitReserve;
  }, [parsedLiquidityAmount, unitReserve, lpTotalSupply]);

  // Handle add liquidity
  const handleAddLiquidity = useCallback(async () => {
    if (!address || !rigInfo?.unitAddress || !lpAddressFromCore || parsedLiquidityAmount === 0n || requiredDonutForLp === 0n) {
      return;
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_SECONDS);

    // Calculate min amounts with 1% slippage tolerance
    const minUnitAmount = (parsedLiquidityAmount * 99n) / 100n;
    const minDonutAmount = (requiredDonutForLp * 99n) / 100n;

    // Build batched calls: approve UNIT + approve DONUT + addLiquidity
    const approveUnitCall = encodeApproveCall(
      rigInfo.unitAddress as Address,
      CONTRACT_ADDRESSES.uniV2Router as Address,
      parsedLiquidityAmount
    );

    const approveDonutCall = encodeApproveCall(
      CONTRACT_ADDRESSES.donut as Address,
      CONTRACT_ADDRESSES.uniV2Router as Address,
      requiredDonutForLp
    );

    const addLiquidityCall = encodeContractCall(
      CONTRACT_ADDRESSES.uniV2Router as Address,
      UNIV2_ROUTER_ABI,
      "addLiquidity",
      [
        rigInfo.unitAddress, // tokenA (UNIT)
        CONTRACT_ADDRESSES.donut, // tokenB (DONUT)
        parsedLiquidityAmount, // amountADesired
        requiredDonutForLp, // amountBDesired
        minUnitAmount, // amountAMin
        minDonutAmount, // amountBMin
        address, // to (LP tokens go to user)
        deadline, // deadline
      ]
    );

    try {
      await executeLpBatch([approveUnitCall, approveDonutCall, addLiquidityCall]);
    } catch (error) {
      console.error("LP creation failed:", error);
      resetLpBatch();
    }
  }, [
    address,
    rigInfo?.unitAddress,
    lpAddressFromCore,
    parsedLiquidityAmount,
    requiredDonutForLp,
    executeLpBatch,
    resetLpBatch,
  ]);

  // Handle auction buy
  const handleAuctionBuy = useCallback(async () => {
    if (!address || !auctionState) return;

    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_SECONDS);

    // Build batched calls: approve LP + buy
    const approveCall = encodeApproveCall(
      auctionState.paymentToken,
      CONTRACT_ADDRESSES.multicall as Address,
      auctionState.price
    );

    const buyCall = encodeContractCall(
      CONTRACT_ADDRESSES.multicall as Address,
      MULTICALL_ABI,
      "buy",
      [
        rigAddress,
        auctionState.epochId,
        deadline,
        auctionState.price,
      ]
    );

    try {
      await executeAuctionBatch([approveCall, buyCall]);
    } catch (error) {
      console.error("Auction buy failed:", error);
      resetAuctionBatch();
    }
  }, [address, auctionState, rigAddress, executeAuctionBatch, resetAuctionBatch]);

  // Trade calculations
  const tradeBalance = tradeDirection === "buy" ? ethBalanceData : unitBalanceData;
  const tradeOutputAmount = tradePriceQuote?.buyAmount
    ? formatBuyAmount(tradePriceQuote.buyAmount, 18)
    : "0";
  const formattedTradeOutput = parseFloat(tradeOutputAmount).toLocaleString(undefined, { maximumFractionDigits: 6 });

  // Calculate price impact for display
  const priceImpact = useMemo(() => {
    // No quote yet = loading
    if (!tradePriceQuote?.buyAmount || !tradeAmount || parseFloat(tradeAmount) === 0) return null;

    // Try Kyber's USD values first
    let inputUsd = tradePriceQuote?.sellAmountUsd ? parseFloat(tradePriceQuote.sellAmountUsd) : 0;
    let outputUsd = tradePriceQuote?.buyAmountUsd ? parseFloat(tradePriceQuote.buyAmountUsd) : 0;

    // If Kyber doesn't have USD data, calculate ourselves (same as UI display)
    if (inputUsd === 0 || outputUsd === 0) {
      const dexPrice = pairData?.priceUsd ? parseFloat(pairData.priceUsd) : null;
      const onChainPrice = rigState?.unitPrice && rigState.unitPrice > 0n
        ? Number(formatEther(rigState.unitPrice)) * donutUsdPrice
        : 0;
      const tokenPrice = dexPrice ?? onChainPrice;

      inputUsd = parseFloat(tradeAmount) * (tradeDirection === "buy" ? ethUsdPrice : tokenPrice);
      outputUsd = parseFloat(tradeOutputAmount) * (tradeDirection === "buy" ? tokenPrice : ethUsdPrice);
    }

    if (inputUsd === 0) return null;

    const impact = ((inputUsd - outputUsd) / inputUsd) * 100;
    return Math.max(0, impact); // Don't show negative impact
  }, [tradePriceQuote, tradeAmount, tradeOutputAmount, tradeDirection, ethUsdPrice, pairData?.priceUsd, rigState?.unitPrice, donutUsdPrice]);

  const tradeInsufficientBalance = useMemo(() => {
    if (!tradeAmount || !tradeBalance) return false;
    try {
      const sellAmountWei = parseUnits(tradeAmount, 18);
      return sellAmountWei > tradeBalance.value;
    } catch {
      return false;
    }
  }, [tradeAmount, tradeBalance]);

  const isTradeLoading = isLoadingTradePrice || isLoadingTradeQuote;
  const isBatchPending = batchState === "pending" || batchState === "confirming";
  const isTradePending = isBatchPending || isSwapping || isWaitingSwap;

  const buttonLabel = useMemo(() => {
    if (!rigState) return "LOADING...";
    if (mineResult === "success") return "MINED!";
    if (mineResult === "failure") return "FAILED";
    if (isWriting || isConfirming) return <>MINING<LoadingDots /></>;
    return "MINE";
  }, [mineResult, isConfirming, isWriting, rigState]);

  const isMineDisabled = !rigState || isWriting || isConfirming || mineResult !== null;
  const tokenSymbol = rigInfo?.tokenSymbol ?? "TOKEN";
  const tokenName = rigInfo?.tokenName ?? "Loading...";

  // Check if there's no liquidity
  const hasNoLiquidity = tradePriceError || (tradeAmount && parseFloat(tradeAmount) > 0 && !isLoadingTradePrice && !tradePriceQuote?.buyAmount);

  // Trade button text (after tokenSymbol is defined)
  const tradeButtonText = useMemo(() => {
    if (tradeResult === "success") return "Trade successful!";
    if (tradeResult === "failure") return "Trade failed";
    if (!isConnected) return "Connect Wallet";
    if (!tradeAmount || parseFloat(tradeAmount) === 0) return "Enter amount";
    if (tradeInsufficientBalance) return "Insufficient balance";
    if (hasNoLiquidity) return "No liquidity";
    if (isBatchPending) return batchState === "confirming" ? "Confirming..." : "Swapping...";
    if (isSwapping || isWaitingSwap) return "Swapping...";
    if (isLoadingTradeQuote) return "Loading...";
    return tradeDirection === "buy" ? "Buy" : "Sell";
  }, [tradeResult, isConnected, tradeAmount, tradeInsufficientBalance, hasNoLiquidity, isBatchPending, batchState, isSwapping, isWaitingSwap, isLoadingTradeQuote, tradeDirection]);

  const canTrade = isConnected && tradeAmount && parseFloat(tradeAmount) > 0 && !tradeInsufficientBalance && !isTradeLoading && !hasNoLiquidity && !!tradeQuote?.transaction?.to;

  // Calculate values - unitPrice is in DONUT, so use donutUsdPrice
  const glazedAmount = interpolatedGlazed ?? rigState?.glazed ?? 0n;
  const unitPrice = rigState?.unitPrice ?? 0n;
  const glazedUsd = unitPrice > 0n
    ? Number(formatUnits(glazedAmount, TOKEN_DECIMALS)) * Number(formatEther(unitPrice)) * donutUsdPrice
    : 0;
  const rateUsd = unitPrice > 0n
    ? Number(formatUnits(rigState?.nextUps ?? 0n, TOKEN_DECIMALS)) * Number(formatEther(unitPrice)) * donutUsdPrice
    : 0;
  const priceUsd = rigState ? Number(formatEther(rigState.price)) * ethUsdPrice : 0;
  const priceEth = rigState ? Number(formatEther(rigState.price)) : 0;
  // Token price in USD (unitPrice is in DONUT)
  const tokenPriceUsd = unitPrice > 0n ? Number(formatEther(unitPrice)) * donutUsdPrice : 0;

  // Token stats - prefer DexScreener data when available
  const totalSupply = totalSupplyRaw ? Number(formatUnits(totalSupplyRaw as bigint, TOKEN_DECIMALS)) : 0;
  const dexPriceUsd = pairData?.priceUsd ? parseFloat(pairData.priceUsd) : null;
  const displayPriceUsd = dexPriceUsd ?? tokenPriceUsd;
  const marketCap = pairData?.marketCap ?? (totalSupply * displayPriceUsd);
  const liquidity = pairData?.liquidity?.usd ?? 0;
  const volume24h = pairData?.volume?.h24 ?? 0;

  // User balances - unitPrice is in DONUT
  const unitBalance = rigState?.unitBalance ? Number(formatUnits(rigState.unitBalance, TOKEN_DECIMALS)) : 0;
  const unitBalanceUsd = unitPrice > 0n ? unitBalance * Number(formatEther(unitPrice)) * donutUsdPrice : 0;
  const ethBalance = rigState?.ethBalance ? Number(formatEther(rigState.ethBalance)) : 0;

  // User stats from subgraph
  const totalMined = userStats?.totalMined ? Number(formatUnits(userStats.totalMined, TOKEN_DECIMALS)) : 0;
  const totalMinedUsd = unitPrice > 0n ? totalMined * Number(formatEther(unitPrice)) * donutUsdPrice : 0;
  const totalSpent = userStats?.totalSpent ? Number(formatEther(userStats.totalSpent)) : 0;
  const totalSpentUsd = totalSpent * ethUsdPrice;
  const totalEarned = userStats?.totalEarned ? Number(formatEther(userStats.totalEarned)) : 0;
  const totalEarnedUsd = totalEarned * ethUsdPrice;

  const minerAddress = rigState?.miner ?? zeroAddress;
  const hasMiner = minerAddress !== zeroAddress;
  const isCurrentUserMiner = address && minerAddress.toLowerCase() === address.toLowerCase();

  // Use cached profile hooks
  const {
    displayName: minerDisplayName,
    avatarUrl: minerAvatarUrl,
    fid: minerFid,
  } = useProfile(hasMiner ? minerAddress : undefined);

  const launcherAddress = rigInfo?.launcher ?? zeroAddress;
  const hasLauncher = launcherAddress !== zeroAddress;
  const {
    displayName: launcherDisplayName,
    avatarUrl: launcherAvatarUrl,
    fid: launcherFid,
  } = useProfile(hasLauncher ? launcherAddress : undefined);

  const formatTime = (seconds: number): string => {
    if (seconds < 0) return "0s";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const timeAgo = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 604800)}w ago`;
  };

  const handleCopyAddress = useCallback(async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  const handleCopyLink = useCallback(async () => {
    const rigUrl = `${window.location.origin}/rig/${rigAddress}`;
    try {
      await navigator.clipboard.writeText(rigUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }, [rigAddress]);

  // Chart data from DexScreener
  const chartData = priceHistory;

  // Show nothing until essential data is ready
  const isPageLoading = !rigInfo || !rigState;

  if (isPageLoading) {
    return (
      <main className="flex h-screen w-screen justify-center overflow-hidden bg-zinc-800 text-foreground">
        <div
          className="relative flex h-full w-full max-w-[520px] flex-1 flex-col overflow-hidden bg-background"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
          }}
        />
        <NavBar />
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-zinc-800 text-foreground">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-1 flex-col overflow-hidden bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
        }}
      >
        {/* Fixed Header */}
        <div ref={headerRef} className="px-4 pb-2">
          <div className="relative flex items-center justify-between">
            <Link href="/explore" className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors z-10">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
            {/* Center ticker - absolutely positioned for true centering */}
            <div
              className={cn(
                "absolute left-1/2 -translate-x-1/2 text-center transition-opacity duration-200",
                showHeaderTicker ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              <div className="text-[15px] font-semibold">${displayPriceUsd.toFixed(6)}</div>
              <div className="text-[11px] text-muted-foreground">{tokenSymbol}</div>
            </div>
            {/* Share Button */}
            <button
              onClick={async () => {
                const rigUrl = `${window.location.origin}/rig/${rigAddress}`;
                try {
                  await navigator.clipboard.writeText(rigUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                } catch {
                  const textArea = document.createElement("textarea");
                  textArea.value = rigUrl;
                  textArea.style.position = "fixed";
                  textArea.style.left = "-9999px";
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand("copy");
                  document.body.removeChild(textArea);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }
              }}
              className="p-2 -mr-2 rounded-xl hover:bg-secondary transition-colors z-10"
            >
              {copiedLink ? <Check className="h-5 w-5 text-green-400" /> : <Share2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-hide px-4">
          {/* Token Info Section - Logo, Name, Price layout */}
          <div ref={priceRef} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              {/* Token Logo */}
              <div className="w-12 h-12 rounded-full overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0">
                {tokenLogoUrl ? (
                  <img src={tokenLogoUrl} alt={tokenSymbol} className="w-12 h-12 object-cover" />
                ) : (
                  <span className="text-lg font-bold text-foreground">{tokenSymbol.slice(0, 2)}</span>
                )}
              </div>
              <div>
                <div className="text-[13px] text-muted-foreground">{tokenSymbol}</div>
                <div className="text-[15px] font-medium">{tokenName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[22px] font-semibold tabular-nums">${displayPriceUsd.toFixed(6)}</div>
              {/* Show hover date and mine price in ETH, or current mine price */}
              <div className="text-[13px] text-muted-foreground">
                {chartHover ? (
                  <>
                    {new Date(chartHover.time * 1000).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })} · Ξ{(chartHover.value / ethUsdPrice).toFixed(6)}
                  </>
                ) : (
                  <>Ξ{priceEth.toFixed(6)}</>
                )}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-44 -mx-4">
            <LazyPriceChart data={chartData} isLoading={isLoadingPrice} color="#71717a" height={176} onHover={setChartHover} timeframeSeconds={timeframeSeconds} tokenFirstActiveTime={tokenFirstActiveTime} currentPrice={priceUsd} />
          </div>

          {/* Timeframe Tabs */}
          <div className="flex justify-between mb-5 px-2 mt-2">
            {(["1D", "1W", "1M", "ALL"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                  selectedTimeframe === tf
                    ? "bg-zinc-700 text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Your Position */}
          <div className="mb-6">
            <h2 className="font-semibold text-[18px] mb-3">Your position</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  {tokenLogoUrl ? (
                    <img src={tokenLogoUrl} alt={tokenSymbol} className="w-4 h-4 rounded-full" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[8px] text-black font-bold">
                      {tokenSymbol.slice(0, 2)}
                    </span>
                  )}
                  <span>{unitBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{formatUsd(unitBalanceUsd)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Mined</div>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  {tokenLogoUrl ? (
                    <img src={tokenLogoUrl} alt={tokenSymbol} className="w-4 h-4 rounded-full" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[8px] text-black font-bold">
                      {tokenSymbol.slice(0, 2)}
                    </span>
                  )}
                  <span>{totalMined.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{formatUsd(totalMinedUsd)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Spent</div>
                <div className="text-sm font-semibold">Ξ{totalSpent.toFixed(4)}</div>
                <div className="text-[10px] text-muted-foreground">{formatUsd(totalSpentUsd)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Earned</div>
                <div className="text-sm font-semibold">Ξ{totalEarned.toFixed(4)}</div>
                <div className="text-[10px] text-muted-foreground">{formatUsd(totalEarnedUsd)}</div>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="mb-6">
            <h2 className="font-semibold text-[18px] mb-3">About</h2>
            {hasLauncher && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-muted-foreground">Deployed by</span>
                <button
                  onClick={() => launcherFid && viewProfile(launcherFid)}
                  disabled={!launcherFid}
                  className={`flex items-center gap-2 ${launcherFid ? "cursor-pointer" : "cursor-default"}`}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={launcherAvatarUrl} alt={launcherDisplayName} />
                    <AvatarFallback className="bg-secondary text-white text-[8px]">
                      {launcherAddress.slice(2, 4).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`text-sm font-medium text-white ${launcherFid ? "hover:text-muted-foreground" : ""}`}>
                    {launcherDisplayName}
                  </span>
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-3">
              {tokenMetadata?.description || `${tokenName} is a token launched on the Miner Launchpad.`}
            </p>

            {/* Links */}
            <div className="flex flex-wrap gap-2">
              {/* New format: links array */}
              {tokenMetadata?.links?.map((link, index) => {
                const url = link.startsWith("http") ? link : `https://${link}`;
                // Extract display name from URL
                let label = "Link";
                try {
                  const hostname = new URL(url).hostname.replace("www.", "");
                  if (hostname.includes("twitter") || hostname.includes("x.com")) label = "Twitter";
                  else if (hostname.includes("telegram") || hostname.includes("t.me")) label = "Telegram";
                  else if (hostname.includes("discord")) label = "Discord";
                  else if (hostname.includes("github")) label = "GitHub";
                  else label = hostname.split(".")[0].charAt(0).toUpperCase() + hostname.split(".")[0].slice(1);
                } catch {
                  label = "Link";
                }
                return (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-xs rounded-full bg-secondary text-foreground/80 hover:bg-muted"
                  >
                    {label}
                  </a>
                );
              })}
              {/* Legacy format support */}
              {!tokenMetadata?.links?.length && tokenMetadata?.website && (
                <a
                  href={tokenMetadata.website.startsWith("http") ? tokenMetadata.website : `https://${tokenMetadata.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs rounded-full bg-secondary text-foreground/80 hover:bg-muted"
                >
                  Website
                </a>
              )}
              {!tokenMetadata?.links?.length && tokenMetadata?.twitter && (
                <a
                  href={`https://x.com/${tokenMetadata.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs rounded-full bg-secondary text-foreground/80 hover:bg-muted"
                >
                  Twitter
                </a>
              )}
              {!tokenMetadata?.links?.length && tokenMetadata?.telegram && (
                <a
                  href={`https://t.me/${tokenMetadata.telegram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs rounded-full bg-secondary text-foreground/80 hover:bg-muted"
                >
                  Telegram
                </a>
              )}
              {!tokenMetadata?.links?.length && tokenMetadata?.discord && (
                <a
                  href={tokenMetadata.discord.startsWith("http") ? tokenMetadata.discord : `https://discord.gg/${tokenMetadata.discord}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs rounded-full bg-secondary text-foreground/80 hover:bg-muted"
                >
                  Discord
                </a>
              )}
              {rigInfo?.unitAddress && (
                <button
                  onClick={() => handleCopyAddress(rigInfo.unitAddress)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-secondary text-foreground/80 hover:bg-muted"
                >
                  <span>{tokenSymbol}</span>
                  {copiedAddress === rigInfo.unitAddress ? (
                    <Check className="w-3 h-3 text-foreground" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
              {lpAddress && (
                <button
                  onClick={() => handleCopyAddress(lpAddress)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-secondary text-foreground/80 hover:bg-muted"
                >
                  <span>{tokenSymbol}-DONUT LP</span>
                  {copiedAddress === lpAddress ? (
                    <Check className="w-3 h-3 text-foreground" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Stats - Memoized component */}
          <TokenStats
            marketCap={marketCap}
            totalSupply={totalSupply}
            liquidity={liquidity}
            volume24h={volume24h}
          />

          {/* Leaderboard */}
          <Leaderboard
            entries={leaderboardEntries}
            userRank={userRank}
            tokenSymbol={tokenSymbol}
            tokenName={tokenName}
            rigUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/rig/${rigAddress}`}
            isLoading={isLoadingLeaderboard}
          />

          {/* Recent Mines */}
          <div className="mt-6 mb-6">
            <h2 className="font-semibold text-[18px] mb-3">Recent Mines</h2>
            <div className="space-y-2">
              {mineHistory.length === 0 ? (
                <div className="text-sm text-muted-foreground">No mines yet</div>
              ) : (
                [...mineHistory].reverse().map((mine) => (
                  <MineHistoryItem key={mine.id} mine={mine} timeAgo={timeAgo} />
                ))
              )}
            </div>
          </div>

          {/* Spacer for bottom bar */}
          <div className="h-32" />
        </div>

        {/* Darkened overlay when menu is open */}
        {showActionMenu && (
          <div
            className="fixed inset-0 z-40 flex justify-center"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}
            onClick={() => setShowActionMenu(false)}
          >
            <div className="w-full max-w-[520px] bg-black/70" />
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-800 flex justify-center" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}>
          <div className="flex items-center justify-between w-full max-w-[520px] px-4 py-3 bg-background">
            <div>
              <div className="text-muted-foreground text-[12px]">Market Cap</div>
              <div className="font-semibold text-[17px] tabular-nums">
                {formatUsd(marketCap, true)}
              </div>
            </div>
            <div className="relative">
              {/* Action Menu Popup - appears above button */}
              {showActionMenu && (
                <div className="absolute bottom-full right-0 mb-2 flex flex-col gap-1.5">
                  <button
                    onClick={() => {
                      setShowActionMenu(false);
                      setTradeDirection("buy");
                      setTradeAmount("");
                      setShowTradeModal(true);
                    }}
                    className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => {
                      setShowActionMenu(false);
                      setTradeDirection("sell");
                      setTradeAmount("");
                      setShowTradeModal(true);
                    }}
                    className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                  >
                    Sell
                  </button>
                  <button
                    onClick={() => {
                      setShowActionMenu(false);
                      setShowMineModal(true);
                    }}
                    className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                  >
                    Mine
                  </button>
                  <button
                    onClick={() => {
                      setShowActionMenu(false);
                      setShowAuctionModal(true);
                    }}
                    className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                  >
                    Auction
                  </button>
                  <button
                    onClick={() => {
                      setShowActionMenu(false);
                      setShowLiquidityModal(true);
                    }}
                    className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                  >
                    Liquidity
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className={cn(
                  "w-32 h-10 text-[14px] font-semibold rounded-xl transition-all",
                  showActionMenu
                    ? "bg-black border-2 border-white text-white"
                    : "bg-white text-black"
                )}
              >
                {showActionMenu ? "✕" : "Actions"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <NavBar />

      {/* Mine Modal */}
      {showMineModal && (
        <div className="fixed inset-0 z-[100] flex h-screen w-screen justify-center bg-zinc-800">
          <div
            className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 130px)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <button
                onClick={() => setShowMineModal(false)}
                className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-base font-semibold">Mine</span>
              <div className="w-9" />
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 flex flex-col px-4">
              {/* Title */}
              <div className="mt-2 mb-4">
                <h1 className="text-xl font-semibold tracking-tight">
                  Mine {tokenSymbol}
                </h1>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  Ξ{ethBalance.toFixed(4)} available
                </p>
              </div>

              {/* Miner Info */}
              {hasMiner && (
                <div className="flex-1 flex flex-col">
                  {/* Miner Header */}
                  <div className="py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarImage src={minerAvatarUrl} />
                        <AvatarFallback className="bg-zinc-700 text-base">
                          {minerAddress.slice(2, 4).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-semibold truncate">{minerDisplayName}</div>
                        <div className="text-xs text-zinc-500">
                          {minerAddress.slice(0, 6)}...{minerAddress.slice(-4)}
                        </div>
                      </div>
                    </div>
                    {rigState?.epochUri && (
                      <div className="mt-2 text-sm text-zinc-400 italic truncate">
                        "{rigState.epochUri}"
                      </div>
                    )}
                  </div>

                  {/* Rate + Price + Time */}
                  <div className="flex py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-0.5">Rate</div>
                      <div className="text-lg font-semibold tabular-nums">
                        {Number(formatUnits(rigState?.nextUps ?? 0n, TOKEN_DECIMALS)).toFixed(2)}/s
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ${rateUsd.toFixed(4)}/s
                      </div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="text-xs text-muted-foreground mb-0.5">Price</div>
                      <div className="text-lg font-semibold tabular-nums">
                        Ξ{priceEth.toFixed(4)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatUsd(priceUsd)}
                      </div>
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-xs text-muted-foreground mb-0.5">Time</div>
                      <div className="text-lg font-semibold tabular-nums">
                        {formatTime(glazeElapsedSeconds)}
                      </div>
                    </div>
                  </div>

                  {/* Mined + PnL stacked, line, then Total - like hand addition */}
                  <div className="py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {/* Mined row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-muted-foreground">Mined</div>
                      <div className="text-right">
                        <div className="text-base font-semibold tabular-nums flex items-center justify-end gap-1.5">
                          +
                          {tokenLogoUrl ? (
                            <img src={tokenLogoUrl} alt={tokenSymbol} className="w-4 h-4 rounded-full" />
                          ) : (
                            <span className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center text-[9px]">
                              {tokenSymbol.slice(0, 2)}
                            </span>
                          )}
                          {Number(formatUnits(glazedAmount, TOKEN_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">+{formatUsd(glazedUsd)}</div>
                      </div>
                    </div>

                    {/* PnL row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-muted-foreground">PnL</div>
                      <div className="text-right">
                        <div className="text-base font-semibold tabular-nums">
                          {(glazedUsd - priceUsd) >= 0 ? '+' : '-'}Ξ{Math.abs((glazedUsd - priceUsd) / ethUsdPrice).toFixed(4)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {(glazedUsd - priceUsd) >= 0 ? '+' : '-'}{formatUsd(Math.abs(glazedUsd - priceUsd))}
                        </div>
                      </div>
                    </div>

                    {/* Addition line */}
                    <div className="border-t border-zinc-600 mb-3" />

                    {/* Total row */}
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="text-lg font-semibold tabular-nums">
                        {(glazedUsd + (glazedUsd - priceUsd)) >= 0 ? '+' : '-'}${Math.abs(glazedUsd + (glazedUsd - priceUsd)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />
                </div>
              )}

            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-800 flex justify-center" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}>
              <div className="w-full max-w-[520px] px-4 py-3 bg-background">
                {/* Message Input */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder={tokenMetadata?.defaultMessage || "gm"}
                    maxLength={100}
                    className="w-full rounded-xl bg-secondary px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
                  />
                </div>
                {/* Price/Balance and Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-muted-foreground text-[12px]">Mine Price</div>
                      <div className="font-semibold text-[17px] tabular-nums">
                        Ξ{priceEth.toFixed(6)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[12px]">Balance</div>
                      <div className="font-semibold text-[17px] tabular-nums">
                        Ξ{ethBalance.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleMine}
                    disabled={isMineDisabled}
                    className={cn(
                      "w-32 h-10 text-[14px] font-semibold rounded-xl transition-all",
                      mineResult === "failure"
                        ? "bg-zinc-700 text-zinc-500"
                        : "bg-white text-black hover:bg-zinc-200",
                      isMineDisabled && !mineResult && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {buttonLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <NavBar />
        </div>
      )}

      {/* Trade Modal */}
      {showTradeModal && (
        <div className="fixed inset-0 z-[100] flex h-screen w-screen justify-center bg-zinc-800">
          <div
            className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <button
                onClick={() => setShowTradeModal(false)}
                className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-base font-semibold">{tradeDirection === "buy" ? "Buy" : "Sell"}</span>
              <div className="w-9" />
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col px-4">
              {/* Title */}
              <div className="mt-2 mb-4">
                <h1 className="text-xl font-semibold tracking-tight">
                  {tradeDirection === "buy" ? "Buy" : "Sell"} {tokenSymbol}
                </h1>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  {tradeDirection === "buy"
                    ? `Ξ${ethBalance.toFixed(4)} available`
                    : `${unitBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${tokenSymbol} available`
                  }
                </p>
              </div>

              {/* Amount display */}
              <div className="py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Amount</span>
                  <span className="text-base font-semibold tabular-nums">
                    {tradeDirection === "buy" ? `Ξ${formatWithCommas(tradeAmount || "0")}` : `${formatWithCommas(tradeAmount || "0")} ${tokenSymbol}`}
                  </span>
                </div>
              </div>

              {/* Market price */}
              <div className="py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-zinc-500">Market price</span>
                  <span className="text-[13px] font-medium tabular-nums">
                    ${displayPriceUsd.toFixed(6)}
                  </span>
                </div>
              </div>

              {/* Est. received */}
              <div className="py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-zinc-500">Est. received</span>
                  <div className="flex items-center gap-2">
                    {isTradeLoading && tradeAmount && parseFloat(tradeAmount) > 0 ? (
                      <span className="text-[13px] font-medium inline-flex items-center gap-0.5">
                        <span className="animate-bounce-dot-1">•</span>
                        <span className="animate-bounce-dot-2">•</span>
                        <span className="animate-bounce-dot-3">•</span>
                      </span>
                    ) : (
                      <span className="text-[13px] font-medium tabular-nums">
                        {tradeDirection === "sell" ? "Ξ" : ""}{formattedTradeOutput} {tradeDirection === "buy" ? tokenSymbol : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Trade Info - impact instead of slippage */}
              <div className="flex items-center justify-end gap-3 py-2 text-[11px] text-zinc-500">
                <span>{tradeAmount && parseFloat(tradeAmount) > 0 ? (priceImpact?.toFixed(1) ?? "0") : "0"}% impact</span>
                <span>·</span>
                <span>
                  {tradeDirection === "buy" ? (
                    <>
                      {tradePriceQuote?.buyAmount
                        ? (parseFloat(formatBuyAmount(tradePriceQuote.buyAmount, 18)) * (1 - slippage / 100)).toLocaleString(undefined, { maximumFractionDigits: 6 })
                        : "0"
                      } {tokenSymbol} min
                    </>
                  ) : (
                    <>
                      Ξ{tradePriceQuote?.buyAmount
                        ? (parseFloat(formatBuyAmount(tradePriceQuote.buyAmount, 18)) * (1 - slippage / 100)).toLocaleString(undefined, { maximumFractionDigits: 6 })
                        : "0"
                      } min
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Bottom section: Number pad + Button */}
            <div className="px-4 pb-4 mt-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)" }}>
              {/* Trade Button */}
              <button
                onClick={handleTrade}
                disabled={!canTrade || isTradePending || tradeResult !== null}
                className={cn(
                  "w-full h-11 rounded-xl font-semibold text-[14px] transition-all mb-3",
                  canTrade && !isTradePending && tradeResult === null
                    ? "bg-white text-black hover:bg-zinc-200"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
              >
                {tradeButtonText}
              </button>

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-1">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"].map(
                  (key) => (
                    <NumPadButton
                      key={key}
                      value={key}
                      onClick={(value) => {
                        setTradeAmount((prev) => {
                          const current = prev || "0";
                          if (value === "backspace") {
                            if (current.length <= 1) return "";
                            return current.slice(0, -1);
                          }
                          if (value === ".") {
                            if (current.includes(".")) return current;
                            return current + ".";
                          }
                          // Limit decimal places: 6 for ETH, 2 for tokens
                          const maxDecimals = tradeDirection === "buy" ? 6 : 2;
                          const decimalIndex = current.indexOf(".");
                          if (decimalIndex !== -1) {
                            const decimals = current.length - decimalIndex - 1;
                            if (decimals >= maxDecimals) return current;
                          }
                          // Replace initial 0
                          if (current === "0" && value !== ".") {
                            return value;
                          }
                          // Limit total length
                          if (current.length >= 12) return current;
                          return current + value;
                        });
                      }}
                    >
                      {key === "backspace" ? (
                        <Delete className="w-6 h-6" />
                      ) : (
                        key
                      )}
                    </NumPadButton>
                  )
                )}
              </div>
            </div>
          </div>
          <NavBar />
        </div>
      )}

      {/* Auction Modal */}
      {showAuctionModal && (() => {
        // Auction calculations from contract state
        const lpBalance = auctionState?.paymentTokenBalance
          ? Number(formatEther(auctionState.paymentTokenBalance))
          : 0;
        const auctionPrice = auctionState?.price
          ? Number(formatEther(auctionState.price))
          : 0;
        const wethReward = auctionState?.wethAccumulated
          ? Number(formatEther(auctionState.wethAccumulated))
          : 0;
        const lpTokenPrice = auctionState?.paymentTokenPrice
          ? Number(formatEther(auctionState.paymentTokenPrice))
          : 0;

        // Calculate USD values
        const lpCostUsd = auctionPrice * lpTokenPrice * donutUsdPrice;
        const wethRewardUsd = wethReward * ethUsdPrice;
        const profitUsd = wethRewardUsd - lpCostUsd;
        const isBuyingAuction = auctionBatchState === "pending" || auctionBatchState === "confirming";
        const canBuy = lpBalance >= auctionPrice && auctionPrice > 0 && !isBuyingAuction && auctionResult === null;

        // Button text
        const auctionButtonText = (() => {
          if (auctionResult === "success") return "Bought!";
          if (auctionResult === "failure") return "Failed";
          if (isBuyingAuction) return auctionBatchState === "confirming" ? "Confirming..." : "Buying...";
          if (lpBalance < auctionPrice && auctionPrice > 0) return "Insufficient LP";
          return "Buy WETH";
        })();

        return (
          <div className="fixed inset-0 z-[100] flex h-screen w-screen justify-center bg-zinc-800">
            <div
              className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
              style={{
                paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-2">
                <button
                  onClick={() => setShowAuctionModal(false)}
                  className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <span className="text-base font-semibold">Auction</span>
                <div className="w-9" />
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col px-4">
                {/* Title */}
                <div className="mt-2 mb-4">
                  <h1 className="text-xl font-semibold tracking-tight">Buy WETH</h1>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {lpBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tokenSymbol}-DONUT LP available
                  </p>
                </div>

                {/* You Pay */}
                <div className="py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-muted-foreground">You pay</span>
                    <span className="text-base font-semibold tabular-nums">
                      {auctionPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} LP
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-muted-foreground">{tokenSymbol}-DONUT LP</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      ~${lpCostUsd.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* You Receive */}
                <div className="py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-muted-foreground">You receive</span>
                    <span className="text-base font-semibold tabular-nums">
                      Ξ{wethReward.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-muted-foreground">WETH</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      ~${wethRewardUsd.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Profit indicator */}
                <div className="flex items-center justify-end gap-3 py-2 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">
                    {profitUsd >= 0 ? "+" : ""}{profitUsd.toFixed(2)} {profitUsd >= 0 ? "profit" : "loss"}
                  </span>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Info text */}
                <p className="text-[11px] text-muted-foreground text-center mb-3">
                  Auction price decays over time. Buy when profitable.
                </p>

                {/* Action button */}
                <button
                  onClick={handleAuctionBuy}
                  disabled={!canBuy}
                  className={cn(
                    "w-full h-11 rounded-xl font-semibold text-[14px] transition-all mb-4",
                    auctionResult === "success"
                      ? "bg-green-500 text-black"
                      : canBuy
                        ? "bg-white text-black hover:bg-zinc-200"
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  )}
                >
                  {auctionButtonText}
                </button>
              </div>
            </div>
            <NavBar />
          </div>
        );
      })()}

      {/* Liquidity Modal */}
      {showLiquidityModal && (() => {
        // Use actual balances and calculations
        const tokenBalance = unitBalance;
        const donutBalance = donutBalanceData ? Number(formatEther(donutBalanceData.value)) : 0;

        const tokenInputAmount = parseFloat(liquidityAmount) || 0;
        // Required DONUT is calculated from reserves (already computed above)
        const requiredDonut = requiredDonutForLp > 0n ? Number(formatEther(requiredDonutForLp)) : 0;
        // Estimated LP tokens (already computed above)
        const lpTokensReceived = estimatedLpTokens > 0n ? Number(formatEther(estimatedLpTokens)) : 0;

        const hasEnoughToken = parsedLiquidityAmount > 0n && (unitBalanceData?.value ?? 0n) >= parsedLiquidityAmount;
        const hasEnoughDonut = requiredDonutForLp > 0n && (donutBalanceData?.value ?? 0n) >= requiredDonutForLp;
        const isCreatingLp = lpBatchState === "pending" || lpBatchState === "confirming";
        const canCreateLp = tokenInputAmount > 0 && hasEnoughToken && hasEnoughDonut && !isCreatingLp && lpResult === null;

        // Button text
        const lpButtonText = (() => {
          if (lpResult === "success") return "LP Created!";
          if (lpResult === "failure") return "Failed";
          if (isCreatingLp) return lpBatchState === "confirming" ? "Confirming..." : "Creating LP...";
          if (!hasEnoughToken && tokenInputAmount > 0) return "Insufficient " + tokenSymbol;
          if (!hasEnoughDonut && tokenInputAmount > 0) return "Insufficient DONUT";
          return "Create LP";
        })();

        return (
          <div className="fixed inset-0 z-[100] flex h-screen w-screen justify-center bg-zinc-800">
            <div
              className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
              style={{
                paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-2">
                <button
                  onClick={() => {
                    setShowLiquidityModal(false);
                    setLiquidityAmount("");
                  }}
                  className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <span className="text-base font-semibold">Liquidity</span>
                <div className="w-9" />
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col px-4">
                {/* Title */}
                <div className="mt-2 mb-4">
                  <h1 className="text-xl font-semibold tracking-tight">Add Liquidity</h1>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Provide {tokenSymbol} and DONUT to get LP tokens
                  </p>
                </div>

                {/* Token Input */}
                <div className="py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-muted-foreground">You provide</span>
                    <button
                      onClick={() => setLiquidityAmount(tokenBalance.toFixed(2))}
                      className="text-[11px] text-muted-foreground hover:text-zinc-300 transition-colors"
                    >
                      Balance: {tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-semibold tabular-nums">
                      {formatWithCommas(liquidityAmount || "0")}
                    </span>
                    <div className="flex items-center gap-2 bg-zinc-800 rounded-full px-3 py-1.5">
                      {tokenLogoUrl ? (
                        <img src={tokenLogoUrl} alt={tokenSymbol} className="w-5 h-5 rounded-full" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] font-semibold">
                          {tokenSymbol.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium">{tokenSymbol}</span>
                    </div>
                  </div>
                </div>

                {/* Required DONUT */}
                <div className="py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-muted-foreground">Required DONUT</span>
                    <button
                      onClick={() => {
                        // Calculate max token amount based on donut balance using reserves ratio
                        if (donutReserve > 0n && unitReserve > 0n && donutBalanceData?.value) {
                          const maxUnitFromDonut = (donutBalanceData.value * unitReserve) / donutReserve;
                          const maxUnitNumber = Number(formatEther(maxUnitFromDonut));
                          setLiquidityAmount(Math.min(tokenBalance, maxUnitNumber).toFixed(2));
                        }
                      }}
                      className="text-[11px] text-muted-foreground hover:text-zinc-300 transition-colors"
                    >
                      Balance: {donutBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-semibold tabular-nums">
                      {requiredDonut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className="flex items-center gap-2 bg-zinc-800 rounded-full px-3 py-1.5">
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-black" />
                      </div>
                      <span className="text-sm font-medium">DONUT</span>
                    </div>
                  </div>
                </div>

                {/* LP Output */}
                <div className="flex items-center justify-end gap-3 py-3 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">
                    You receive ~ {lpTokensReceived.toFixed(4)} LP tokens
                  </span>
                </div>
              </div>

              {/* Bottom section: Number pad + Button */}
              <div className="px-4 pb-4 mt-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)" }}>
                {/* Action button */}
                <button
                  onClick={handleAddLiquidity}
                  disabled={!canCreateLp}
                  className={cn(
                    "w-full h-11 rounded-xl font-semibold text-[14px] transition-all mb-3",
                    lpResult === "success"
                      ? "bg-green-500 text-black"
                      : canCreateLp
                        ? "bg-white text-black hover:bg-zinc-200"
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  )}
                >
                  {lpButtonText}
                </button>

                {/* Number pad */}
                <div className="grid grid-cols-3 gap-1">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"].map(
                    (key) => (
                      <NumPadButton
                        key={key}
                        value={key}
                        onClick={(value) => {
                          setLiquidityAmount((prev) => {
                            const current = prev || "0";
                            if (value === "backspace") {
                              if (current.length <= 1) return "";
                              return current.slice(0, -1);
                            }
                            if (value === ".") {
                              if (current.includes(".")) return current;
                              return current + ".";
                            }
                            // Limit decimal places
                            const decimalIndex = current.indexOf(".");
                            if (decimalIndex !== -1) {
                              const decimals = current.length - decimalIndex - 1;
                              if (decimals >= 2) return current;
                            }
                            // Replace initial 0
                            if (current === "0" && value !== ".") {
                              return value;
                            }
                            // Limit total length
                            if (current.length >= 12) return current;
                            return current + value;
                          });
                        }}
                      >
                        {key === "backspace" ? (
                          <Delete className="w-6 h-6" />
                        ) : (
                          key
                        )}
                      </NumPadButton>
                    )
                  )}
                </div>
              </div>
            </div>
            <NavBar />
          </div>
        );
      })()}
    </main>
  );
}
