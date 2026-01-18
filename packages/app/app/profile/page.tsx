"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { User, Pickaxe, Rocket } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavBar } from "@/components/nav-bar";
import { useFarcaster, getUserDisplayName, getUserHandle, initialsFrom } from "@/hooks/useFarcaster";
import { useUserProfile, type UserRigData, type UserLaunchedRig } from "@/hooks/useUserProfile";
import { getDonutPrice } from "@/lib/utils";
import { DEFAULT_DONUT_PRICE_USD, PRICE_REFETCH_INTERVAL_MS, ipfsToHttp } from "@/lib/constants";

type TabOption = "holdings" | "launched";

const formatTokenAmount = (value: bigint, maximumFractionDigits = 2) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatEther(value));
  if (!Number.isFinite(asNumber)) {
    return formatEther(value);
  }
  return asNumber.toLocaleString(undefined, {
    maximumFractionDigits,
  });
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatAmount(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toLocaleString();
}

function TokenLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="w-10 h-10 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-zinc-700 text-white">
      {name.charAt(0)}
    </div>
  );
}

function MinedRigRow({ rig, donutUsdPrice, isLast }: { rig: UserRigData; donutUsdPrice: number; isLast: boolean }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!rig.rigUri) return;
    const metadataUrl = ipfsToHttp(rig.rigUri);
    if (!metadataUrl) return;

    fetch(metadataUrl)
      .then((res) => res.json())
      .then((metadata) => {
        if (metadata.image) {
          setLogoUrl(ipfsToHttp(metadata.image));
        }
      })
      .catch(() => {});
  }, [rig.rigUri]);

  // Calculate value: userMined * unitPrice (in DONUT) * donutUsdPrice
  const minedAmount = Number(formatEther(rig.userMined));
  const unitPriceDonut = rig.unitPrice ? Number(formatEther(rig.unitPrice)) : 0;
  const valueUsd = minedAmount * unitPriceDonut * donutUsdPrice;

  return (
    <Link
      href={`/rig/${rig.address}`}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-4 transition-colors hover:bg-white/[0.02]"
      style={{
        borderBottom: !isLast ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}
    >
      <TokenLogo name={rig.tokenName} logoUrl={logoUrl} />
      <div>
        <div className="font-semibold text-[15px]">{rig.tokenSymbol}</div>
        <div className="text-[13px] text-muted-foreground">
          {formatAmount(minedAmount)} mined
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium text-[15px] tabular-nums">
          {formatCurrency(valueUsd)}
        </div>
        <div className="text-[13px] tabular-nums text-muted-foreground">
          {formatAmount(minedAmount)} {rig.tokenSymbol}
        </div>
      </div>
    </Link>
  );
}

function LaunchedRigRow({ rig, donutUsdPrice, isLast }: { rig: UserLaunchedRig; donutUsdPrice: number; isLast: boolean }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!rig.rigUri) return;
    const metadataUrl = ipfsToHttp(rig.rigUri);
    if (!metadataUrl) return;

    fetch(metadataUrl)
      .then((res) => res.json())
      .then((metadata) => {
        if (metadata.image) {
          setLogoUrl(ipfsToHttp(metadata.image));
        }
      })
      .catch(() => {});
  }, [rig.rigUri]);

  // Calculate market cap: totalMinted * unitPrice (in DONUT) * donutUsdPrice
  const marketCapUsd = rig.unitPrice > 0n
    ? Number(formatEther(rig.totalMinted)) * Number(formatEther(rig.unitPrice)) * donutUsdPrice
    : 0;

  const revenueEth = Number(formatEther(rig.revenue));

  const formatMarketCap = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <Link
      href={`/rig/${rig.address}`}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-4 transition-colors hover:bg-white/[0.02]"
      style={{
        borderBottom: !isLast ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}
    >
      <TokenLogo name={rig.tokenName} logoUrl={logoUrl} />
      <div>
        <div className="font-semibold text-[15px]">{rig.tokenSymbol}</div>
        <div className="text-[13px] text-muted-foreground">
          {rig.tokenName}
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium text-[15px] tabular-nums">
          {formatMarketCap(marketCapUsd)}
        </div>
        <div className="text-[13px] text-muted-foreground">
          {revenueEth.toFixed(4)} ETH earned
        </div>
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabOption>("holdings");
  const [donutUsdPrice, setDonutUsdPrice] = useState<number>(DEFAULT_DONUT_PRICE_USD);

  const { user, address } = useFarcaster();
  const { minedRigs, launchedRigs, isLoading } = useUserProfile(address);

  // Fetch DONUT price
  useEffect(() => {
    const fetchPrice = async () => {
      const price = await getDonutPrice();
      setDonutUsdPrice(price);
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, PRICE_REFETCH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const userDisplayName = getUserDisplayName(user);
  const userAvatarUrl = user?.pfpUrl ?? null;

  // Calculate total portfolio value
  const totalValue = minedRigs.reduce((acc, rig) => {
    const minedAmount = Number(formatEther(rig.userMined));
    const unitPriceDonut = rig.unitPrice ? Number(formatEther(rig.unitPrice)) : 0;
    return acc + (minedAmount * unitPriceDonut * donutUsdPrice);
  }, 0);

  return (
    <main className="flex h-screen w-screen justify-center bg-zinc-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        {/* Header */}
        <div className="px-4 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight mb-6">Profile</h1>

          {/* User Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt={userDisplayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-7 h-7 text-zinc-500" />
              )}
            </div>
            <div>
              <div className="font-semibold text-[17px]">{userDisplayName}</div>
              <div className="text-[13px] text-muted-foreground">
                {minedRigs.length} tokens held
              </div>
            </div>
          </div>

          {/* Portfolio Value */}
          <div className="mb-6 pb-6 border-b border-white/10">
            <div className="text-[13px] text-muted-foreground mb-1">
              Portfolio Value
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-[32px] font-semibold tracking-tight tabular-nums">
                {formatCurrency(totalValue)}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("holdings")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all ${
                activeTab === "holdings"
                  ? "bg-white text-black"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Pickaxe className="w-3.5 h-3.5" />
              Holdings
            </button>
            <button
              onClick={() => setActiveTab("launched")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all ${
                activeTab === "launched"
                  ? "bg-white text-black"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              Launched
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-[15px]">Loading...</p>
            </div>
          ) : activeTab === "holdings" ? (
            <div>
              {minedRigs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Pickaxe className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-[15px] font-medium">No tokens mined yet</p>
                  <p className="text-[13px] mt-1 opacity-70">
                    Start mining to build your portfolio!
                  </p>
                </div>
              ) : (
                minedRigs.map((rig, index) => (
                  <MinedRigRow
                    key={rig.address}
                    rig={rig}
                    donutUsdPrice={donutUsdPrice}
                    isLast={index === minedRigs.length - 1}
                  />
                ))
              )}
            </div>
          ) : (
            <div>
              {launchedRigs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Rocket className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-[15px] font-medium">No tokens launched yet</p>
                  <p className="text-[13px] mt-1 opacity-70">
                    Create your first token!
                  </p>
                </div>
              ) : (
                launchedRigs.map((rig, index) => (
                  <LaunchedRigRow
                    key={rig.address}
                    rig={rig}
                    donutUsdPrice={donutUsdPrice}
                    isLast={index === launchedRigs.length - 1}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <NavBar />
    </main>
  );
}
