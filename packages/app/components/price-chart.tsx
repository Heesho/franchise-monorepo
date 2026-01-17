"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, AreaSeries, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";

export type HoverData = {
  time: number;
  value: number;
} | null;

type PriceChartProps = {
  data: { time: number; value: number }[];
  isLoading?: boolean;
  color?: string;
  height?: number;
  onHover?: (data: HoverData) => void;
  timeframeSeconds?: number;
  tokenFirstActiveTime?: number | null;
  currentPrice?: number; // Current price to append as last data point
};

export function PriceChart({
  data,
  isLoading = false,
  color = "#a06fff",
  height = 200,
  onHover,
  timeframeSeconds,
  tokenFirstActiveTime,
  currentPrice,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [mounted, setMounted] = useState(false);

  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted || !chartContainerRef.current || isLoading) return;

    const container = chartContainerRef.current;
    const width = container.clientWidth;
    if (width === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    try {
      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#71717a",
          fontFamily: "monospace",
          attributionLogo: false,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        width: width,
        height: height,
        handleScroll: false,
        handleScale: false,
        rightPriceScale: {
          visible: false,
          scaleMargins: {
            top: 0.1,
            bottom: 0.15,
          },
        },
        timeScale: { visible: false, borderVisible: false },
        crosshair: {
          vertLine: {
            visible: true,
            labelVisible: false,
            color: "#a06fff50",
            width: 1,
            style: 2,
          },
          horzLine: {
            visible: false,
            labelVisible: false,
          },
        },
      });

      const now = Math.floor(Date.now() / 1000);

      // Determine time range
      const tokenBirthTime = tokenFirstActiveTime ?? now;

      let startTime: number;
      if (timeframeSeconds && timeframeSeconds !== Infinity) {
        startTime = now - timeframeSeconds;
      } else {
        startTime = tokenBirthTime;
      }

      // Step 1: Dedupe and sort the input data
      const dataMap = new Map<number, number>();
      data.forEach(d => {
        if (d.value > 0) dataMap.set(d.time, d.value);
      });
      const sortedData = Array.from(dataMap.entries()).sort((a, b) => a[0] - b[0]);

      // Step 2: Build the final data array
      const filledData: { time: Time; value: number }[] = [];

      // Step 3: For timeframe views (1D, 1W, 1M), fill hourly 0s from startTime to first data point
      if (timeframeSeconds && timeframeSeconds !== Infinity) {
        const firstDataTime = sortedData.length > 0 ? sortedData[0][0] : now;
        const HOUR = 3600;
        for (let t = startTime; t < firstDataTime; t += HOUR) {
          filledData.push({ time: t as Time, value: 0 });
        }
      }

      // Step 4: Add all actual data points
      sortedData.forEach(([time, value]) => {
        if (time >= startTime && time <= now) {
          filledData.push({ time: time as Time, value });
        }
      });

      // Step 5: Add current price at the end (the real-time dropping price)
      if (currentPrice !== undefined) {
        filledData.push({ time: now as Time, value: currentPrice });
      }

      // Dedupe by time (keep last value for duplicates)
      const finalMap = new Map<number, number>();
      filledData.forEach(d => finalMap.set(d.time as number, d.value));
      const dedupedData = Array.from(finalMap.entries())
        .map(([time, value]) => ({ time: time as Time, value }))
        .sort((a, b) => (a.time as number) - (b.time as number));

      // Create area series
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: `${color}40`,
        bottomColor: `${color}00`,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      areaSeries.setData(dedupedData);

      chart.timeScale().fitContent();
      chartRef.current = chart;

      // Handle hover
      chart.subscribeCrosshairMove((param) => {
        if (!onHoverRef.current) return;

        if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
          onHoverRef.current(null);
          return;
        }

        const seriesData = param.seriesData.get(areaSeries);
        if (seriesData && "value" in seriesData) {
          onHoverRef.current({
            time: param.time as number,
            value: seriesData.value as number,
          });
        } else {
          onHoverRef.current({
            time: param.time as number,
            value: 0,
          });
        }
      });

    } catch (error) {
      console.error("Failed to create chart:", error);
    }

    const handleResize = () => {
      if (chartRef.current && container.clientWidth > 0) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [mounted, color, height, data, isLoading, timeframeSeconds, tokenFirstActiveTime, currentPrice]);

  return (
    <div style={{ height }} className="w-full relative overflow-hidden">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
