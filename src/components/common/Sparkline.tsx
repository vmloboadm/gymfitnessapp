import { useId } from "react";
import { cn } from "~/lib/utils";

/**
 * Sparkline SVG caseiro (anti-slop: sem lib, gradiente lower-case).
 * Anima via transform/opacity, nunca width.
 */
export function Sparkline({
  points,
  color = "var(--brand)",
  height = 36,
  className,
  showArea = true,
}: {
  points: number[];
  color?: string;
  height?: number;
  className?: string;
  showArea?: boolean;
}) {
  const id = useId();
  const w = 100;
  const h = 40;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1 || 1)) * w;
    const y = h - ((p - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label="Gráfico de variação"
    >
      {showArea ? (
        <>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#spark-${id})`} />
        </>
      ) : null}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r={2.5} fill={color} />
    </svg>
  );
}