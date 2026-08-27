"use client";

/**
 * Ícones anatômicos em SVG para grupos musculares e movimentos.
 * Cada ícone é uma silhueta estilizada, identificável à primeira vista,
 * com peso visual coerente (stroke 1.8, cantos arredondados).
 */

type IconProps = { size?: number; className?: string; color?: string };

const base = (size: number, className = "") => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
});

export function ChestIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M5 7c0-2 2-3 4-3h6c2 0 4 1 4 3v6c0 2-2 4-4 4H9c-2 0-4-2-4-4V7z" />
      <path d="M12 7v10" />
      <path d="M7 10c2 1 5 1 7 0M7 13c2 1 5 1 7 0" />
    </svg>
  );
}

export function BackIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M7 4c-2 2-2 5-1 8 .5 1.5 1 3 1 5M17 4c2 2 2 5 1 8-.5 1.5-1 3-1 5" />
      <path d="M9 6c2 1 4 1 6 0" />
      <path d="M9 17c2-1 4-1 6 0" />
      <path d="M12 6v8" />
    </svg>
  );
}

export function ShoulderIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <circle cx="12" cy="7" r="3" />
      <path d="M7 10c-2 1-3 3-3 6M17 10c2 1 3 3 3 6" />
      <path d="M9 14h6" />
      <path d="M12 14v4" />
    </svg>
  );
}

export function BicepsIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M7 5c-2 2-2 5 0 7 1.5 1.5 3 1 4 0M17 5c2 2 2 5 0 7-1.5 1.5-3 1-4 0" />
      <path d="M7 12v6M17 12v6" />
      <path d="M9 7h6" />
    </svg>
  );
}

export function TricepsIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M6 6c-1 2-1 4 1 6 1.5 1 3 .5 4-1M18 6c1 2 1 4-1 6-1.5 1-3 .5-4-1" />
      <path d="M7 12l-1 7M17 12l1 7" />
      <path d="M10 8h4" />
    </svg>
  );
}

export function ForearmIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M7 5c-1 3-1 6 1 9 1.5 2 3 3 4 3M17 5c1 3 1 6-1 9-1.5 2-3 3-4 3" />
      <path d="M6 6h12M8 17h8" />
    </svg>
  );
}

export function LegsIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M8 4c-1 3-1 7 1 11 1 2 2 4 2 6M16 4c1 3 1 7-1 11-1 2-2 4-2 6" />
      <path d="M7 9h10" />
      <path d="M9 15h6" />
    </svg>
  );
}

export function HamstringsIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M8 4c0 2-1 5-1 8s1 6 2 8M16 4c0 2 1 5 1 8s-1 6-2 8" />
      <path d="M6 10h12" />
      <path d="M7 16h10" />
    </svg>
  );
}

export function GlutesIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M6 9c0-2 2-4 4-4h4c2 0 4 2 4 4v4c0 2-2 4-4 4h-4c-2 0-4-2-4-4V9z" />
      <path d="M12 9v8" />
      <path d="M8 13h8" />
    </svg>
  );
}

export function CalvesIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M8 4c-1 3-1 7 0 10 .5 1.5 1 3 1 5M16 4c1 3 1 7 0 10-.5 1.5-1 3-1 5" />
      <path d="M6 9h12" />
      <ellipse cx="12" cy="6" rx="3" ry="1.5" />
    </svg>
  );
}

export function AbsIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M8 4c-2 1-2 4-2 8s1 7 3 8M16 4c2 1 2 4 2 8s-1 7-3 8" />
      <path d="M10 7h4M10 11h4M10 15h4" />
    </svg>
  );
}

export function CardioIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M4 12c0-3 2.5-5 5-5 2 0 3 1.5 3 3 0-1.5 1-3 3-3 2.5 0 5 2 5 5 0 4-5.5 8-8 9-2.5-1-8-5-8-9z" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  );
}

export function RunIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <circle cx="15" cy="5" r="2.5" />
      <path d="M10 9l3 3-2 5M13 12l4 2 2 5" />
      <path d="M8 21l2-4M17 21l-2-4" />
      <path d="M7 10l3-1" />
    </svg>
  );
}

export function DumbbellIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M4 10h16M4 14h16" />
      <rect x="2" y="7" width="4" height="10" rx="1.5" />
      <rect x="18" y="7" width="4" height="10" rx="1.5" />
      <path d="M9 9v6M15 9v6" />
    </svg>
  );
}

export function BarbellIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M3 10h18M3 14h18" />
      <rect x="2" y="6" width="2" height="12" rx="1" />
      <rect x="20" y="6" width="2" height="12" rx="1" />
      <path d="M8 10v4M16 10v4" />
    </svg>
  );
}

export function PullupIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M4 5h16" />
      <path d="M8 5v3c0 2 1 3 2 4v8M16 5v3c0 2-1 3-2 4v8" />
      <path d="M12 12v8" />
    </svg>
  );
}

export function CableIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M12 3v12" />
      <circle cx="12" cy="17" r="3" />
      <path d="M7 7h10" />
      <path d="M9 7l-2 4M15 7l2 4" />
    </svg>
  );
}

export function TrophyIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M8 4h8v4c0 3-2 5-4 5s-4-2-4-5V4z" />
      <path d="M5 5v2c0 2 1.5 3 3 3M19 5v2c0 2-1.5 3-3 3" />
      <path d="M12 13v3M9 21h6" />
    </svg>
  );
}

export function FlameIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M12 21c4-2 6-5 6-9 0-3-2-5-3-7-1 2-3 3-3 6 0-2-2-3-2-5-2 2-4 4-4 7 0 3 2 6 6 8z" />
    </svg>
  );
}

export function ScaleIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 3" />
      <path d="M7 5h10" />
    </svg>
  );
}

export function CalendarIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 9h18" />
      <path d="M8 13h2M8 17h2M14 13h2M14 17h2" />
    </svg>
  );
}

export function ChecklistIcon({ size = 24, className = "" }: IconProps) {
  const p = base(size, className);
  return (
    <svg {...p} aria-hidden>
      <path d="M4 6h16M4 12h12M4 18h8" />
      <path d="M18 11l2 2 3-4" />
    </svg>
  );
}
