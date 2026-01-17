"use client";

import { useState, useEffect } from "react";
import { formatUnits, formatEther } from "viem";
import { Share2, Copy, Check } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TOKEN_DECIMALS } from "@/lib/constants";
import type { SlotDisplayState } from "@/hooks/useMultiSlotState";

type SlotMinerInfoProps = {
  slot: SlotDisplayState;
  slotIndex: number;
  totalSlots: number;
  isCurrentUserMiner: boolean;
  tokenSymbol: string;
  tokenLogoUrl?: string;
  ethUsdPrice: number;
  donutUsdPrice: number;
  rigAddress: string;
  onShare: () => void;
  minerProfile?: {
    displayName: string;
    avatarUrl?: string;
    fid?: number;
  };
  onViewProfile?: (fid: number) => void;
};

const formatUsd = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value < 0.01) return `<$0.01`;
  return `$${value.toFixed(2)}`;
};

const formatTime = (seconds: number): string => {
  if (seconds < 0) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

export function SlotMinerInfo({
  slot,
  slotIndex,
  totalSlots,
  isCurrentUserMiner,
  tokenSymbol,
  tokenLogoUrl,
  ethUsdPrice,
  donutUsdPrice,
  rigAddress,
  onShare,
  minerProfile,
  onViewProfile,
}: SlotMinerInfoProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [interpolatedGlazed, setInterpolatedGlazed] = useState(slot.glazed);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Interpolate glazed amount
  useEffect(() => {
    setInterpolatedGlazed(slot.glazed);
    const interval = setInterval(() => {
      if (slot.nextUps > 0n) {
        setInterpolatedGlazed((prev) => prev + slot.nextUps);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [slot.glazed, slot.nextUps]);

  // Track elapsed time
  useEffect(() => {
    const startTime = Number(slot.epochStartTime);
    const initialElapsed = Math.floor(Date.now() / 1000) - startTime;
    setElapsedSeconds(initialElapsed);
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor(Date.now() / 1000) - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [slot.epochStartTime]);

  const glazedAmount = Number(formatUnits(interpolatedGlazed, TOKEN_DECIMALS));
  const unitPrice = slot.unitPrice > 0n ? Number(formatEther(slot.unitPrice)) : 0;
  const glazedUsd = glazedAmount * unitPrice * donutUsdPrice;
  const ratePerSec = Number(formatUnits(slot.nextUps, TOKEN_DECIMALS));
  const rateUsd = ratePerSec * unitPrice * donutUsdPrice;

  const handleCopyLink = async () => {
    const rigUrl = `${window.location.origin}/rig/${rigAddress}`;
    try {
      await navigator.clipboard.writeText(rigUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
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
  };

  const handleProfileClick = () => {
    if (minerProfile?.fid && onViewProfile) {
      onViewProfile(minerProfile.fid);
    }
  };

  if (slot.isAvailable) {
    return (
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">
            Slot {slotIndex}
            {totalSlots > 1 && <span className="text-surface-600 font-normal text-sm ml-2">of {totalSlots}</span>}
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-10 rounded-2xl bg-surface-100 border border-dashed border-surface-400">
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-surface-400 flex items-center justify-center mb-4">
            <span className="text-surface-500 text-3xl font-light">+</span>
          </div>
          <p className="text-sm font-medium text-white mb-1">Slot available</p>
          <p className="text-sm text-surface-600">Be the first to mine!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">
          Current Miner
          {totalSlots > 1 && <span className="text-surface-600 font-normal text-sm ml-2">Slot {slotIndex}</span>}
        </h2>
        <div className="flex items-center gap-2">
          {isCurrentUserMiner && (
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/15 hover:bg-primary-500/25 transition-colors text-xs font-medium text-primary-400"
              title="Cast to Farcaster"
            >
              <Share2 className="w-3.5 h-3.5" />
              Cast
            </button>
          )}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors text-xs font-medium text-surface-700"
            title="Copy link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? "Copied" : "Share"}
          </button>
        </div>
      </div>

      {/* Miner Card */}
      <div className="p-4 rounded-2xl bg-surface-100 border border-surface-300">
        {/* Miner profile */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleProfileClick}
            disabled={!minerProfile?.fid}
            className={minerProfile?.fid ? "cursor-pointer" : "cursor-default"}
          >
            <Avatar className="h-11 w-11 border-2 border-surface-300">
              {minerProfile?.avatarUrl && (
                <AvatarImage src={minerProfile.avatarUrl} alt={minerProfile.displayName} />
              )}
              <AvatarFallback className="bg-surface-200 text-white text-xs font-medium">
                {slot.miner.slice(-2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
          <button
            onClick={handleProfileClick}
            disabled={!minerProfile?.fid}
            className={`flex-1 text-left ${minerProfile?.fid ? "cursor-pointer" : "cursor-default"}`}
          >
            <div className={`text-sm font-semibold text-white ${minerProfile?.fid ? "hover:text-primary-400" : ""}`}>
              {minerProfile?.displayName || `${slot.miner.slice(0, 6)}...${slot.miner.slice(-4)}`}
            </div>
            <div className="text-xs text-surface-600 mt-0.5">
              {slot.miner.slice(0, 6)}...{slot.miner.slice(-4)}
            </div>
          </button>
          <div className="text-right">
            <div className="text-xs text-surface-600 font-medium">{formatTime(elapsedSeconds)}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-surface-50">
            <div className="text-xs text-surface-600 mb-1">Mine rate</div>
            <div className="text-sm font-semibold text-white">
              {ratePerSec.toFixed(2)}/s
            </div>
            <div className="text-xs text-surface-600 mt-0.5">${rateUsd.toFixed(4)}/s</div>
          </div>
          <div className="p-3 rounded-xl bg-surface-50">
            <div className="text-xs text-surface-600 mb-1">Mined</div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
              {tokenLogoUrl ? (
                <img src={tokenLogoUrl} alt={tokenSymbol} className="w-4 h-4 rounded-full" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center text-[8px] text-black font-bold">
                  {tokenSymbol.slice(0, 2)}
                </span>
              )}
              <span>{glazedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="text-xs text-surface-600 mt-0.5">{formatUsd(glazedUsd)}</div>
          </div>
          <div className="p-3 rounded-xl bg-surface-50">
            <div className="text-xs text-surface-600 mb-1">Value</div>
            <div className="text-sm font-semibold text-white">
              {formatUsd(glazedUsd)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-surface-50">
            <div className="text-xs text-surface-600 mb-1">PnL</div>
            <div className="text-sm font-semibold text-success-500">
              +Ξ{(glazedUsd / ethUsdPrice).toFixed(4)}
            </div>
            <div className="text-xs text-surface-600 mt-0.5">{formatUsd(glazedUsd)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
