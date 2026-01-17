"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Share2, Copy, Check } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { Leaderboard } from "@/components/leaderboard";
import { MineHistoryItem } from "@/components/mine-history-item";
import { MineModal } from "@/components/mine-modal";
import { TradeModal } from "@/components/trade-modal";
import { AuctionModal } from "@/components/auction-modal";
import { LiquidityModal } from "@/components/liquidity-modal";
// import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useFarcaster } from "@/hooks/useFarcaster";
import { useRigLeaderboard } from "@/hooks/useRigLeaderboard";
// import { useFriendActivity, getFriendActivityMessage } from "@/hooks/useFriendActivity";

type Timeframe = "1H" | "1D" | "1W" | "1M" | "ALL";

// Mock token data (will be replaced with real data later)
const MOCK_TOKEN = {
  name: "Donut",
  symbol: "DONUT",
  price: 0.00234,
  change24h: 12.5,
  description: "The original donut token. Mine it, earn it, love it.",
};

// Mock chart data
const MOCK_CHART_DATA = [
  { time: "9:00", price: 0.0021 },
  { time: "10:00", price: 0.00215 },
  { time: "11:00", price: 0.00208 },
  { time: "12:00", price: 0.00225 },
  { time: "13:00", price: 0.00218 },
  { time: "14:00", price: 0.0023 },
  { time: "15:00", price: 0.00228 },
  { time: "16:00", price: 0.00234 },
];

// Mock user position
const MOCK_USER_POSITION = {
  balance: 154888,
  balanceUsd: 1.89,
  totalMined: 183464,
  totalMinedUsd: 2.24,
  spent: 564.68,
  earned: 267.52,
};

// Mock current mining session
const MOCK_MINING_SESSION = {
  slotsOwned: 2,
  mineRate: 4.0,
  mineRateUsd: 0.0000,
  minedSession: 7032,
  minedSessionUsd: 0.09,
  total: 0.17,
  pnl: 0.09,
};

// Mock global stats
const MOCK_GLOBAL_STATS = {
  marketCap: 123.00,
  totalSupply: 9993464,
  liquidity: 122.69,
  volume24h: 2.12,
  treasuryRevenue: 45.60,
  teamRevenue: 12.16,
  totalMinted: 2450000,
  miningSlots: 4,
  emissionRate: 4.0, // current UPS
};

// Mock launcher
const MOCK_LAUNCHER = {
  name: "Heeshilio Frost",
  avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=heesho",
  launchDate: "2d ago",
};

// Mock links
const MOCK_LINKS = {
  tokenAddress: "0x1234...5678",
  lpAddress: "0xabcd...ef01",
};

// Mock leaderboard (top 10 miners)
const MOCK_LEADERBOARD = [
  { rank: 1, address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", mined: BigInt(182500n * 10n**18n), minedFormatted: "182,500", spent: BigInt(0), spentFormatted: "0", earned: BigInt(0), earnedFormatted: "0", isCurrentUser: false, isFriend: false, profile: null },
  { rank: 2, address: "0x1234567890abcdef1234567890abcdef12345678", mined: BigInt(156200n * 10n**18n), minedFormatted: "156,200", spent: BigInt(0), spentFormatted: "0", earned: BigInt(0), earnedFormatted: "0", isCurrentUser: false, isFriend: false, profile: null },
  { rank: 3, address: "0xabcdef1234567890abcdef1234567890abcdef12", mined: BigInt(134800n * 10n**18n), minedFormatted: "134,800", spent: BigInt(0), spentFormatted: "0", earned: BigInt(0), earnedFormatted: "0", isCurrentUser: false, isFriend: false, profile: null },
  { rank: 4, address: "0x9876543210fedcba9876543210fedcba98765432", mined: BigInt(98400n * 10n**18n), minedFormatted: "98,400", spent: BigInt(0), spentFormatted: "0", earned: BigInt(0), earnedFormatted: "0", isCurrentUser: false, isFriend: false, profile: null },
  { rank: 5, address: "0xcafebabecafebabecafebabecafebabecafebabe", mined: BigInt(76500n * 10n**18n), minedFormatted: "76,500", spent: BigInt(0), spentFormatted: "0", earned: BigInt(0), earnedFormatted: "0", isCurrentUser: true, isFriend: false, profile: null },
  { rank: 6, address: "0xfeedfacefeedfacefeedfacefeedfacefeedface", mined: BigInt(54200n * 10n**18n), minedFormatted: "54,200", spent: BigInt(0), spentFormatted: "0", earned: BigInt(0), earnedFormatted: "0", isCurrentUser: false, isFriend: false, profile: null },
  { rank: 7, address: "0x1111222233334444555566667777888899990000", mined: BigInt(42100n * 10n**18n), minedFormatted: "42,100", spent: BigInt(0), spentFormatted: "0", earned: BigInt(0), earnedFormatted: "0", isCurrentUser: false, isFriend: false, profile: null },
  { rank: 8, address: "0xaaaa5555bbbb6666cccc7777dddd8888eeee9999", mined: BigInt(31800n * 10n**18n), minedFormatted: "31,800", spent: BigInt(0), spentFormatted: "0", earned: BigInt(0), earnedFormatted: "0", isCurrentUser: false, isFriend: false, profile: null },
  { rank: 9, address: "0x0000111122223333444455556666777788889999", mined: BigInt(24600n * 10n**18n), minedFormatted: "24,600", spent: BigInt(0), spentFormatted: "0", earned: BigInt(0), earnedFormatted: "0", isCurrentUser: false, isFriend: false, profile: null },
  { rank: 10, address: "0xbeef0000beef0000beef0000beef0000beef0000", mined: BigInt(18900n * 10n**18n), minedFormatted: "18,900", spent: BigInt(0), spentFormatted: "0", earned: BigInt(0), earnedFormatted: "0", isCurrentUser: false, isFriend: false, profile: null },
];

// Mock mine history (last 10 mines)
const MOCK_MINES = [
  { id: "1", miner: "0x1234567890abcdef1234567890abcdef12345678", uri: "gm frens", price: BigInt(2_500_000), spent: BigInt(2_500_000), earned: BigInt(1_200_000), mined: BigInt(4500n * 10n**18n), multiplier: 2, timestamp: Math.floor(Date.now() / 1000) - 120 },
  { id: "2", miner: "0xabcdef1234567890abcdef1234567890abcdef12", uri: "to the moon", price: BigInt(1_800_000), spent: BigInt(1_800_000), earned: BigInt(890_000), mined: BigInt(3200n * 10n**18n), multiplier: 1, timestamp: Math.floor(Date.now() / 1000) - 340 },
  { id: "3", miner: "0x9876543210fedcba9876543210fedcba98765432", uri: "", price: BigInt(3_200_000), spent: BigInt(3_200_000), earned: BigInt(1_580_000), mined: BigInt(5800n * 10n**18n), multiplier: 3, timestamp: Math.floor(Date.now() / 1000) - 890 },
  { id: "4", miner: "0x1111222233334444555566667777888899990000", uri: "wagmi", price: BigInt(950_000), spent: BigInt(950_000), earned: BigInt(420_000), mined: BigInt(1800n * 10n**18n), multiplier: 1, timestamp: Math.floor(Date.now() / 1000) - 1800 },
  { id: "5", miner: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", uri: "lfg", price: BigInt(4_100_000), spent: BigInt(4_100_000), earned: BigInt(2_050_000), mined: BigInt(7200n * 10n**18n), multiplier: 4, timestamp: Math.floor(Date.now() / 1000) - 3600 },
  { id: "6", miner: "0x1234567890abcdef1234567890abcdef12345678", uri: "mining is fun", price: BigInt(2_100_000), spent: BigInt(2_100_000), earned: BigInt(980_000), mined: BigInt(3900n * 10n**18n), multiplier: 1, timestamp: Math.floor(Date.now() / 1000) - 7200 },
  { id: "7", miner: "0xfeedfacefeedfacefeedfacefeedfacefeedface", uri: "", price: BigInt(1_500_000), spent: BigInt(1_500_000), earned: BigInt(720_000), mined: BigInt(2800n * 10n**18n), multiplier: 2, timestamp: Math.floor(Date.now() / 1000) - 14400 },
  { id: "8", miner: "0xabcdef1234567890abcdef1234567890abcdef12", uri: "donut gang", price: BigInt(2_800_000), spent: BigInt(2_800_000), earned: BigInt(1_350_000), mined: BigInt(5100n * 10n**18n), multiplier: 1, timestamp: Math.floor(Date.now() / 1000) - 28800 },
  { id: "9", miner: "0xcafebabecafebabecafebabecafebabecafebabe", uri: "first mine!", price: BigInt(500_000), spent: BigInt(500_000), earned: BigInt(230_000), mined: BigInt(950n * 10n**18n), multiplier: 1, timestamp: Math.floor(Date.now() / 1000) - 43200 },
  { id: "10", miner: "0x9876543210fedcba9876543210fedcba98765432", uri: "", price: BigInt(1_200_000), spent: BigInt(1_200_000), earned: BigInt(580_000), mined: BigInt(2200n * 10n**18n), multiplier: 1, timestamp: Math.floor(Date.now() / 1000) - 86400 },
];

// Helper to format time ago
function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  return `$${price.toExponential(2)}`;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(2);
}

function TokenLogo({
  name,
  size = "md",
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    xs: "w-4 h-4 text-[8px]",
    sm: "w-5 h-5 text-[9px]",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold bg-gradient-to-br from-amber-500 to-orange-600 text-white`}
    >
      {name.charAt(0)}
    </div>
  );
}

// Simple chart component
function SimpleChart({
  data,
  isPositive,
}: {
  data: typeof MOCK_CHART_DATA;
  isPositive: boolean;
}) {
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((d.price - min) / range) * 80 - 10;
      return `${x},${y}`;
    })
    .join(" ");

  const fillPoints = `0,100 ${points} 100,100`;

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor={isPositive ? "hsl(0, 0%, 70%)" : "hsl(0, 0%, 45%)"}
            stopOpacity="0.3"
          />
          <stop
            offset="100%"
            stopColor={isPositive ? "hsl(0, 0%, 70%)" : "hsl(0, 0%, 45%)"}
            stopOpacity="0"
          />
        </linearGradient>
      </defs>
      <polygon fill="url(#chartGradient)" points={fillPoints} />
      <polyline
        fill="none"
        stroke={isPositive ? "hsl(0, 0%, 70%)" : "hsl(0, 0%, 45%)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function RigDetailPage() {
  const params = useParams();
  const rigAddress = (params.address as string) || "";
  const isValidAddress = rigAddress.length > 0 && rigAddress.startsWith("0x");

  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showHeaderPrice, setShowHeaderPrice] = useState(false);
  const [minedAmount, setMinedAmount] = useState(MOCK_MINING_SESSION.minedSession);
  const [showMineModal, setShowMineModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showLiquidityModal, setShowLiquidityModal] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tokenInfoRef = useRef<HTMLDivElement>(null);

  // Farcaster context for social features
  const { user, address: userAddress } = useFarcaster();

  // Leaderboard data - only fetch if we have a valid address
  const { entries: leaderboardEntries, userRank, isLoading: leaderboardLoading } = useRigLeaderboard(
    isValidAddress ? rigAddress : "",
    userAddress,
    undefined, // friendFids - could be populated from user's following list
    10
  );

  // Mine history for activity feed - DISABLED until subgraph is redeployed with Epoch entity
  // const { mines, isLoading: historyLoading } = useMineHistory(
  //   isValidAddress ? (rigAddress as `0x${string}`) : undefined,
  //   10 // Last 10 mines
  // );

  // Friend activity - disabled for now to debug freeze
  // TODO: Re-enable once we confirm it's not causing issues
  const friendActivity: { friends: Array<{ fid: number; displayName?: string; username?: string; pfpUrl?: string }> } | null = null;
  const friendMessage: string | null = null;

  /*
  // Get unique miner addresses for friend activity lookup - use stable string key
  const minerAddressesKey = useMemo(() => {
    if (!mines.length && !leaderboardEntries.length) return "";
    const addresses = new Set<string>();
    mines.forEach(m => addresses.add(m.miner.toLowerCase()));
    leaderboardEntries.forEach(e => addresses.add(e.address.toLowerCase()));
    return Array.from(addresses).sort().join(",");
  }, [mines, leaderboardEntries]);

  // Convert back to array only when key changes
  const minerAddresses = useMemo(() => {
    return minerAddressesKey ? minerAddressesKey.split(",") : [];
  }, [minerAddressesKey]);

  // Friend activity - who you follow that has mined this rig
  // Only fetch when we have addresses AND a user FID
  const shouldFetchFriends = minerAddresses.length > 0 && !!user?.fid;
  const { data: friendActivity } = useFriendActivity(
    shouldFetchFriends ? minerAddresses : [],
    user?.fid
  );
  const friendMessage = friendActivity ? getFriendActivityMessage(friendActivity.friends) : null;
  */

  // Rig URL for sharing
  const rigUrl = typeof window !== "undefined" ? `${window.location.origin}/rig/${rigAddress}` : "";

  const isPositive = MOCK_TOKEN.change24h >= 0;
  const hasPosition = MOCK_USER_POSITION.balance > 0;

  // Tick up mined amount based on mine rate
  useEffect(() => {
    if (MOCK_MINING_SESSION.slotsOwned === 0) return;

    const interval = setInterval(() => {
      setMinedAmount(prev => prev + MOCK_MINING_SESSION.mineRate / 10);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const tokenInfo = tokenInfoRef.current;

    if (!scrollContainer || !tokenInfo) return;

    const handleScroll = () => {
      const tokenInfoBottom = tokenInfo.getBoundingClientRect().bottom;
      const containerTop = scrollContainer.getBoundingClientRect().top;
      setShowHeaderPrice(tokenInfoBottom < containerTop + 10);
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="flex h-screen w-screen justify-center bg-zinc-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 130px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <Link
            href="/explore"
            className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          {/* Center - Price appears on scroll */}
          <div className={`text-center transition-opacity duration-200 ${showHeaderPrice ? "opacity-100" : "opacity-0"}`}>
            <div className="text-[15px] font-semibold">{formatPrice(MOCK_TOKEN.price)}</div>
            <div className="text-[11px] text-muted-foreground">{MOCK_TOKEN.symbol}</div>
          </div>
          <button className="p-2 -mr-2 rounded-xl hover:bg-secondary transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4">
          {/* Token Info Section */}
          <div ref={tokenInfoRef} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <TokenLogo name={MOCK_TOKEN.name} size="lg" />
              <div>
                <div className="text-[13px] text-muted-foreground">{MOCK_TOKEN.symbol}</div>
                <div className="text-[15px] font-medium">{MOCK_TOKEN.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="price-large">{formatPrice(MOCK_TOKEN.price)}</div>
              <div
                className={`text-[13px] font-medium ${
                  isPositive ? "text-zinc-300" : "text-zinc-500"
                }`}
              >
                {isPositive ? "+" : ""}
                {MOCK_TOKEN.change24h.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-44 mb-2 -mx-4">
            <SimpleChart data={MOCK_CHART_DATA} isPositive={isPositive} />
          </div>

          {/* Timeframe Selector */}
          <div className="flex justify-between mb-5 px-2">
            {(["1H", "1D", "1W", "1M", "ALL"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                  timeframe === tf
                    ? "bg-zinc-700 text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* User Position Section */}
          {hasPosition && (
            <div className="mb-6">
              <div className="font-semibold text-[18px] mb-3">Your position</div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                {/* Mining stats - only show if actively mining */}
                {MOCK_MINING_SESSION.slotsOwned > 0 && (
                  <>
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Mine rate</div>
                      <div className="font-semibold text-[15px] tabular-nums text-white">
                        {MOCK_MINING_SESSION.mineRate.toFixed(2)}/s <span className="text-muted-foreground font-normal">({MOCK_MINING_SESSION.slotsOwned} slot{MOCK_MINING_SESSION.slotsOwned > 1 ? 's' : ''})</span>
                      </div>
                      <div className="text-muted-foreground/60 text-[11px] tabular-nums">
                        ${MOCK_MINING_SESSION.mineRateUsd.toFixed(4)}/s
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Mined</div>
                      <div className="font-semibold text-[15px] tabular-nums flex items-center gap-1">
                        <span className="text-zinc-400">+</span>
                        <TokenLogo name={MOCK_TOKEN.name} size="sm" />
                        <span>{formatNumber(minedAmount)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Total</div>
                      <div className="font-semibold text-[15px] tabular-nums text-white">
                        +${MOCK_MINING_SESSION.total.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">PnL</div>
                      <div className="font-semibold text-[15px] tabular-nums text-white">
                        +${MOCK_MINING_SESSION.pnl.toFixed(2)}
                      </div>
                    </div>
                  </>
                )}
                {/* Overall position */}
                <div>
                  <div className="text-muted-foreground text-[12px] mb-0.5">Balance</div>
                  <div className="font-semibold text-[15px] tabular-nums flex items-center gap-1">
                    <TokenLogo name={MOCK_TOKEN.name} size="sm" />
                    <span>{formatNumber(MOCK_USER_POSITION.balance)}</span>
                  </div>
                  <div className="text-muted-foreground/60 text-[11px] tabular-nums">
                    ${MOCK_USER_POSITION.balanceUsd.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[12px] mb-0.5">Mined</div>
                  <div className="font-semibold text-[15px] tabular-nums flex items-center gap-1">
                    <TokenLogo name={MOCK_TOKEN.name} size="sm" />
                    <span>{formatNumber(MOCK_USER_POSITION.totalMined)}</span>
                  </div>
                  <div className="text-muted-foreground/60 text-[11px] tabular-nums">
                    ${MOCK_USER_POSITION.totalMinedUsd.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[12px] mb-0.5">Spent</div>
                  <div className="font-semibold text-[15px] tabular-nums">
                    ${MOCK_USER_POSITION.spent.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[12px] mb-0.5">Earned</div>
                  <div className="font-semibold text-[15px] tabular-nums">
                    ${MOCK_USER_POSITION.earned.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* About Section */}
          <div className="mb-6">
            <div className="font-semibold text-[18px] mb-3">About</div>

            {/* Deployed by row */}
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-2">
              <span>Deployed by</span>
              <img
                src={MOCK_LAUNCHER.avatar}
                alt={MOCK_LAUNCHER.name}
                className="w-5 h-5 rounded-full object-cover"
              />
              <span className="text-foreground font-medium">{MOCK_LAUNCHER.name}</span>
              <span className="text-muted-foreground/60">{MOCK_LAUNCHER.launchDate}</span>
            </div>

            {/* Description */}
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
              {MOCK_TOKEN.description}
            </p>

            {/* Link buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(MOCK_LINKS.tokenAddress)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-[12px] text-muted-foreground hover:bg-secondary/80 transition-colors"
              >
                {MOCK_TOKEN.symbol}
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(MOCK_LINKS.lpAddress)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-[12px] text-muted-foreground hover:bg-secondary/80 transition-colors"
              >
                {MOCK_TOKEN.symbol}-DONUT LP
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Global Stats Grid */}
          <div className="mb-5">
            <div className="font-semibold text-[18px] mb-3">Stats</div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Market cap</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  ${MOCK_GLOBAL_STATS.marketCap.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Total supply</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  {formatNumber(MOCK_GLOBAL_STATS.totalSupply)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Liquidity</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  ${MOCK_GLOBAL_STATS.liquidity.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">24h volume</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  ${MOCK_GLOBAL_STATS.volume24h.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Treasury</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  ${MOCK_GLOBAL_STATS.treasuryRevenue.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Team</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  ${MOCK_GLOBAL_STATS.teamRevenue.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Mining slots</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  {MOCK_GLOBAL_STATS.miningSlots}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Emission rate</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  {MOCK_GLOBAL_STATS.emissionRate.toFixed(2)}/s
                </div>
              </div>
            </div>
          </div>

          {/* Friend Activity Banner - Social Proof (disabled for debugging)
          {friendActivity?.friends && friendActivity.friends.length > 0 && friendMessage && (
            <div className="mb-6 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {friendActivity.friends.slice(0, 3).map((friend) => (
                    <Avatar key={friend.fid} className="h-7 w-7 border-2 border-background">
                      <AvatarImage src={friend.pfpUrl} alt={friend.displayName || friend.username} />
                      <AvatarFallback className="bg-blue-500/20 text-blue-400 text-[10px]">
                        {(friend.displayName || friend.username || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] text-blue-400">
                    <Users className="w-3.5 h-3.5" />
                    <span>{friendMessage}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          */}

          {/* Leaderboard Section */}
          <Leaderboard
            entries={MOCK_LEADERBOARD}
            userRank={5}
            tokenSymbol={MOCK_TOKEN.symbol}
            tokenName={MOCK_TOKEN.name}
            rigUrl={rigUrl}
            isLoading={false}
          />

          {/* Recent Activity Feed */}
          <div className="mt-6 mb-6">
            <div className="font-semibold text-[18px] mb-3">Recent Mines</div>
            <div>
              {MOCK_MINES.map((mine) => (
                <MineHistoryItem
                  key={mine.id}
                  mine={mine}
                  timeAgo={timeAgo}
                  tokenSymbol={MOCK_TOKEN.symbol}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Darkened overlay when menu is open */}
        {showActionMenu && (
          <div
            className="fixed inset-0 bg-black/70 z-40"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}
            onClick={() => setShowActionMenu(false)}
          />
        )}

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background flex justify-center" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}>
          <div className="flex items-center justify-between w-full max-w-[520px] px-4 py-3">
            <div>
              <div className="text-muted-foreground text-[12px]">Market Cap</div>
              <div className="font-semibold text-[17px] tabular-nums">
                ${MOCK_GLOBAL_STATS.marketCap.toFixed(2)}
              </div>
            </div>
            <div className="relative">
              {/* Action Menu Popup - appears above button */}
              {showActionMenu && (
                <div className="absolute bottom-full right-0 mb-2 flex flex-col gap-1.5">
                  <button
                    onClick={() => {
                      setShowActionMenu(false);
                      setTradeMode("buy");
                      setShowTradeModal(true);
                    }}
                    className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => {
                      setShowActionMenu(false);
                      setTradeMode("sell");
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
                className={`w-32 h-10 text-[14px] font-semibold rounded-xl transition-all ${
                  showActionMenu
                    ? "bg-black border-2 border-white text-white"
                    : "bg-white text-black"
                }`}
              >
                {showActionMenu ? "✕" : "Actions"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <NavBar />

      {/* Mine Modal */}
      <MineModal
        isOpen={showMineModal}
        onClose={() => setShowMineModal(false)}
        tokenSymbol={MOCK_TOKEN.symbol}
        userBalance={12.45}
      />

      {/* Trade Modal (Buy/Sell) */}
      <TradeModal
        isOpen={showTradeModal}
        onClose={() => setShowTradeModal(false)}
        mode={tradeMode}
        tokenSymbol={MOCK_TOKEN.symbol}
        tokenName={MOCK_TOKEN.name}
        marketPrice={MOCK_TOKEN.price}
        userBalance={tradeMode === "buy" ? 45.73 : MOCK_USER_POSITION.balance}
        priceImpact={0.5}
      />

      {/* Auction Modal */}
      <AuctionModal
        isOpen={showAuctionModal}
        onClose={() => setShowAuctionModal(false)}
        tokenSymbol={MOCK_TOKEN.symbol}
        tokenName={MOCK_TOKEN.name}
      />

      {/* Liquidity Modal */}
      <LiquidityModal
        isOpen={showLiquidityModal}
        onClose={() => setShowLiquidityModal(false)}
        tokenSymbol={MOCK_TOKEN.symbol}
        tokenName={MOCK_TOKEN.name}
        tokenBalance={MOCK_USER_POSITION.balance}
        donutBalance={1186.38}
        tokenPrice={MOCK_TOKEN.price}
        donutPrice={0.001}
      />
    </main>
  );
}
