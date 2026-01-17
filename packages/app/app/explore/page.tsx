"use client";

import { useEffect, useState, useRef } from "react";
import { Search, Zap, Clock, Star, X } from "lucide-react";

import { NavBar } from "@/components/nav-bar";
import { RigCard } from "@/components/rig-card";
import { useExploreRigs, type SortOption } from "@/hooks/useAllRigs";
import { useFarcaster } from "@/hooks/useFarcaster";
import { getDonutPrice } from "@/lib/utils";
import { DEFAULT_DONUT_PRICE_USD, PRICE_REFETCH_INTERVAL_MS } from "@/lib/constants";

const SORT_OPTIONS: { value: SortOption; label: string; icon: typeof Zap }[] = [
  { value: "trending", label: "Bump", icon: Zap },
  { value: "top", label: "Top", icon: Star },
  { value: "new", label: "New", icon: Clock },
];

export default function ExplorePage() {
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [donutUsdPrice, setDonutUsdPrice] = useState<number>(DEFAULT_DONUT_PRICE_USD);
  const [newBumpAddress, setNewBumpAddress] = useState<string | null>(null);
  const prevTopRigRef = useRef<string | null>(null);

  // Farcaster context and wallet connection
  const { address } = useFarcaster();

  // Get rigs data
  const { rigs, isLoading } = useExploreRigs(sortBy, searchQuery, address);

  // Track when a new rig bumps to the top
  useEffect(() => {
    if (sortBy !== "trending" || rigs.length === 0) {
      prevTopRigRef.current = null;
      setNewBumpAddress(null);
      return;
    }

    const currentTopRig = rigs[0].address;

    // If this is a different rig than before, it's a new bump
    if (prevTopRigRef.current && prevTopRigRef.current !== currentTopRig) {
      setNewBumpAddress(currentTopRig);
      // Clear the "new" animation after it plays
      const timer = setTimeout(() => {
        setNewBumpAddress(null);
      }, 3000);
      return () => clearTimeout(timer);
    }

    prevTopRigRef.current = currentTopRig;
  }, [rigs, sortBy]);

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
        <div className="px-4 pb-2">
          <h1 className="text-2xl font-semibold tracking-tight mb-4">Explore</h1>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, symbol, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 text-[15px] transition-shadow"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Sort Tabs */}
          <div className="flex gap-2 mt-3">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all ${
                  sortBy === option.value
                    ? "bg-white text-black"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                <option.icon className="w-3.5 h-3.5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rig List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-2">
          {isLoading ? null : rigs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Search className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-[15px] font-medium">No rigs found</p>
              <p className="text-[13px] mt-1 opacity-70">
                {searchQuery
                  ? "Try a different search term"
                  : "Be the first to launch a rig!"}
              </p>
            </div>
          ) : (
            rigs.map((rig, index) => (
              <RigCard
                key={rig.address}
                rig={rig}
                donutUsdPrice={donutUsdPrice}
                isTopBump={sortBy === "trending" && index === 0}
                isNewBump={rig.address === newBumpAddress}
                isLast={index === rigs.length - 1}
              />
            ))
          )}
        </div>
      </div>
      <NavBar />
    </main>
  );
}
