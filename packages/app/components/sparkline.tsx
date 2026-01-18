"use client";

import { useMemo, useId } from "react";

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
};

export function Sparkline({
  data,
  width = 60,
  height = 32,
  className = ""
}: SparklineProps) {
  const gradientId = useId();

  const { path, color, areaPath } = useMemo(() => {
    if (data.length < 2) {
      return { path: "", color: "#71717a", areaPath: "" };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Padding for the chart
    const paddingY = 4;
    const chartHeight = height - paddingY * 2;

    // Calculate points
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = paddingY + chartHeight - ((value - min) / range) * chartHeight;
      return { x, y };
    });

    // Create SVG path
    const linePath = points
      .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");

    // Create area path (for gradient fill)
    const areaPathStr = linePath +
      ` L ${width} ${height} L 0 ${height} Z`;

    // Use grayscale color
    const lineColor = "#71717a"; // zinc-500

    return { path: linePath, color: lineColor, areaPath: areaPathStr };
  }, [data, width, height]);

  if (data.length < 2) {
    // Show flat line if no data
    return (
      <svg
        width={width}
        height={height}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#71717a"
          strokeWidth={1.5}
          strokeOpacity={0.3}
        />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#${gradientId})`}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
