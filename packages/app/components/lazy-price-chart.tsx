"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import type { HoverData } from "./price-chart";

type PriceChartProps = {
  data: { time: number; value: number }[];
  isLoading?: boolean;
  color?: string;
  height?: number;
  onHover?: (data: HoverData) => void;
  timeframeSeconds?: number;
  tokenFirstActiveTime?: number | null;
};

const PriceChartInner = dynamic(
  () => import("@/components/price-chart").then((mod) => mod.PriceChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full flex items-center justify-center bg-black"
        style={{ height: 200 }}
      >
        <div className="text-zinc-600 text-xs">Loading chart...</div>
      </div>
    ),
  }
);

export const LazyPriceChart = memo(function LazyPriceChart({
  data,
  isLoading = false,
  color = "#a06fff",
  height = 200,
  onHover,
  timeframeSeconds,
  tokenFirstActiveTime,
}: PriceChartProps) {
  return (
    <PriceChartInner
      data={data}
      isLoading={isLoading}
      color={color}
      height={height}
      onHover={onHover}
      timeframeSeconds={timeframeSeconds}
      tokenFirstActiveTime={tokenFirstActiveTime}
    />
  );
});
