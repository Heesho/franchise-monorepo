"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, LineSeries, AreaSeries, type IChartApi, type ISeriesApi, type LineData, type AreaData, type Time, LineStyle } from "lightweight-charts";

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
  tokenFirstActiveTime?: number | null; // When the token first had activity (for determining if gray padding is needed)
};

export function PriceChart({
  data,
  isLoading = false,
  color = "#a06fff",
  height = 200,
  onHover,
  timeframeSeconds,
  tokenFirstActiveTime,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [mounted, setMounted] = useState(false);

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
        handleScroll: true,
        handleScale: true,
        rightPriceScale: {
          visible: false,
          scaleMargins: {
            top: 0.1,
            bottom: 0.15, // Ensure bottom (0 value) is visible
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
      const realData = data.filter(d => d.value > 0);

      // Calculate cutoff for the timeframe
      const cutoff = timeframeSeconds && timeframeSeconds !== Infinity
        ? now - timeframeSeconds
        : (realData.length > 0 ? realData[0].time - 3600 : now - 86400);

      // Determine if we need gray padding - ONLY if the TOKEN is younger than the timeframe
      const tokenBirthTime = tokenFirstActiveTime ?? (realData.length > 0 ? realData[0].time : now);
      const needsGrayPadding = timeframeSeconds && timeframeSeconds !== Infinity && tokenBirthTime > cutoff + 60;

      const BASELINE = 0.0001;
      let areaSeries: ISeriesApi<"Area"> | null = null;

      // 1. INVISIBLE anchor series spanning full timeframe (forces correct scaling)
      if (timeframeSeconds && timeframeSeconds !== Infinity) {
        const anchorSeries = chart.addSeries(LineSeries, {
          color: "rgba(0,0,0,0)",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          visible: false,
        });
        anchorSeries.setData([
          { time: cutoff as Time, value: BASELINE },
          { time: now as Time, value: BASELINE },
        ]);
      }

      // 2. Gray dotted line ONLY for empty period (before token existed)
      if (needsGrayPadding) {
        const grayData: LineData<Time>[] = [];
        const emptyPeriod = tokenBirthTime - cutoff;
        const numPoints = Math.max(2, Math.min(30, Math.floor(emptyPeriod / 3600)));

        for (let i = 0; i <= numPoints; i++) {
          const t = cutoff + (emptyPeriod * i / numPoints);
          grayData.push({ time: Math.floor(t) as Time, value: BASELINE });
        }

        const graySeries = chart.addSeries(LineSeries, {
          color: "#71717a",
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        graySeries.setData(grayData);
      }

      // 3. Purple area series for actual data
      if (realData.length > 0) {
        areaSeries = chart.addSeries(AreaSeries, {
          lineColor: color,
          topColor: `${color}40`,
          bottomColor: `${color}00`,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        areaSeries.setData(realData.map(d => ({ time: d.time as Time, value: d.value })));
      }

      chart.timeScale().fitContent();
      chartRef.current = chart;

      // Handle hover
      chart.subscribeCrosshairMove((param) => {
        if (!onHover) return;

        if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
          onHover(null);
          return;
        }

        // Check if we're in the gray/empty area (before first real data)
        const hoverTime = param.time as number;
        if (realData.length > 0 && hoverTime < realData[0].time) {
          onHover({
            time: hoverTime,
            value: 0,
          });
          return;
        }

        if (areaSeries) {
          const seriesData = param.seriesData.get(areaSeries);
          if (seriesData && "value" in seriesData) {
            onHover({
              time: param.time as number,
              value: seriesData.value as number,
            });
            return;
          }
        }

        onHover({
          time: param.time as number,
          value: 0,
        });
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
  }, [mounted, color, height, data, isLoading, onHover, timeframeSeconds, tokenFirstActiveTime]);

  return (
    <div style={{ height }} className="w-full relative overflow-hidden">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
