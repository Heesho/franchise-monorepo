"use client";

import { useRef, useEffect } from "react";
import { SlotCard } from "./slot-card";
import type { SlotDisplayState } from "@/hooks/useMultiSlotState";

type MinerProfile = {
  displayName: string;
  avatarUrl?: string;
};

type SlotSelectorProps = {
  slotStates: SlotDisplayState[];
  selectedIndex: number;
  onSelectSlot: (index: number) => void;
  tokenSymbol: string;
  donutUsdPrice: number;
  currentUserAddress?: `0x${string}`;
  minerProfiles?: Map<string, MinerProfile>; // keyed by lowercase address
};

export function SlotSelector({
  slotStates,
  selectedIndex,
  onSelectSlot,
  tokenSymbol,
  donutUsdPrice,
  currentUserAddress,
  minerProfiles,
}: SlotSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll selected slot into view when selection changes
  useEffect(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const selectedCard = container.children[selectedIndex] as HTMLElement;
    if (!selectedCard) return;

    const containerRect = container.getBoundingClientRect();
    const cardRect = selectedCard.getBoundingClientRect();

    // Check if card is out of view
    if (cardRect.left < containerRect.left || cardRect.right > containerRect.right) {
      selectedCard.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedIndex]);

  const activeCount = slotStates.filter(s => !s.isAvailable).length;
  const totalCount = slotStates.length;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <span className="text-sm font-medium text-white">
          Mining Slots
          <span className="text-surface-600 ml-2">
            {activeCount}/{totalCount} active
          </span>
        </span>
        <span className="text-sm text-surface-600">
          #{selectedIndex}
        </span>
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2 snap-x snap-mandatory"
        style={{ scrollPaddingLeft: "16px", scrollPaddingRight: "16px" }}
      >
        {slotStates.map((slot) => {
          const isCurrentUser = currentUserAddress
            ? slot.miner.toLowerCase() === currentUserAddress.toLowerCase()
            : false;
          const profile = minerProfiles?.get(slot.miner.toLowerCase());

          return (
            <SlotCard
              key={slot.index}
              slot={slot}
              isSelected={slot.index === selectedIndex}
              isCurrentUser={isCurrentUser}
              onClick={() => onSelectSlot(slot.index)}
              tokenSymbol={tokenSymbol}
              donutUsdPrice={donutUsdPrice}
              minerProfile={profile}
            />
          );
        })}
      </div>
    </div>
  );
}
