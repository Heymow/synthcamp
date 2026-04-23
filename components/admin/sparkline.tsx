interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

/**
 * Minimal SVG polyline with no axes, no dep. 30-point series recommended.
 * Height scales via `h-*` wrapper on the parent.
 */
export function Sparkline({ data, color = '#818cf8', height = 28 }: SparklineProps) {
  if (data.length < 2) {
    return <div className="h-7 w-full rounded-sm bg-white/5" aria-hidden="true" />;
  }
  const max = Math.max(...data, 1);
  const w = 100;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = height - (v / max) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const areaPoints = `0,${height} ${points} ${w},${height}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="h-7 w-full"
      aria-hidden="true"
    >
      <polyline points={areaPoints} fill={color} fillOpacity="0.15" stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
