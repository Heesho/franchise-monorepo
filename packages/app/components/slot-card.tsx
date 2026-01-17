"use client";

import { formatUnits, formatEther } from "viem";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { TOKEN_DECIMALS } from "@/lib/constants";
import type { SlotDisplayState } from "@/hooks/useMultiSlotState";

type SlotCardProps = {
  slot: SlotDisplayState;
  isSelected: boolean;
  isCurrentUser: boolean;
  onClick: () => void;
  tokenSymbol: string;
  donutUsdPrice: number;
  minerProfile?: {
    displayName: string;
    avatarUrl?: string;
  };
};

const formatCompact = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
};

export function SlotCard({
  slot,
  isSelected,
  isCurrentUser,
  onClick,
  tokenSymbol,
  donutUsdPrice,
  minerProfile,
}: SlotCardProps) {
  const glazedAmount = Number(formatUnits(slot.glazed, TOKEN_DECIMALS));
  const priceEth = Number(formatEther(slot.price));

  // Calculate USD value of glazed tokens
  const unitPrice = slot.unitPrice > 0n ? Number(formatEther(slot.unitPrice)) : 0;
  const glazedUsd = glazedAmount * unitPrice * donutUsdPrice;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center w-[88px] h-[100px] rounded-xl transition-all duration-200 flex-shrink-0 snap-center",
        // Base styles
        "bg-surface-100",
        // Available slot
        slot.isAvailable && !isSelected && "border-2 border-dashed border-surface-400 hover:border-surface-500",
        // Active slot (other user)
        !slot.isAvailable && !isCurrentUser && !isSelected && "border border-surface-300 hover:border-surface-400",
        // Active slot (current user)
        !slot.isAvailable && isCurrentUser && !isSelected && "border border-primary-500/40 bg-primary-500/5",
        // Selected state
        isSelected && "border-2 border-primary-500 shadow-glow-sm"
      )}
    >
      {slot.isAvailable ? (
        // Empty slot - show CTA
        <>
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-surface-400 flex items-center justify-center mb-2">
            <span className="text-surface-500 text-lg font-light">+</span>
          </div>
          <span className="text-xs font-medium text-primary-500">Mine</span>
          <span className="text-[11px] text-surface-600 mt-0.5">
            Ξ{priceEth.toFixed(4)}
          </span>
        </>
      ) : (
        // Active slot - show miner info
        <>
          <Avatar className="w-8 h-8 mb-2">
            {minerProfile?.avatarUrl ? (
              <AvatarImage src={minerProfile.avatarUrl} alt={minerProfile.displayName} />
            ) : null}
            <AvatarFallback className="bg-surface-200 text-white text-[9px] font-medium">
              {slot.miner.slice(-2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className={cn(
            "text-xs font-medium truncate max-w-[80px] px-1",
            isCurrentUser ? "text-primary-400" : "text-white"
          )}>
            {isCurrentUser ? "You" : (minerProfile?.displayName || `${slot.miner.slice(0, 4)}...`)}
          </span>
          <span className="text-[11px] text-surface-600 mt-0.5">
            {formatCompact(glazedAmount)} {tokenSymbol.slice(0, 4)}
          </span>
        </>
      )}

      {/* Slot index indicator */}
      <span className="absolute top-1.5 left-2 text-[9px] text-surface-600 font-medium">
        {slot.index}
      </span>
    </button>
  );
}
