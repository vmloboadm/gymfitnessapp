import Image from "next/image";
import Link from "next/link";
import { cn } from "~/lib/utils";

/**
 * Logo GymFitness — asset oficial (logo GF) com fundo transparente (PNG).
 * Usa o quadrado original quando `variant="square"` (favicon/emblema).
 */
export function GymLogo({
  className,
  showName = true,
  href,
  size = 40,
}: {
  className?: string;
  showName?: boolean;
  href?: string;
  size?: number;
}) {
  const mark = (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10",
        "shadow-[0_2px_12px_rgba(2,13,33,0.6)]",
        href && "tactile"
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: "radial-gradient(130% 130% at 30% 0%, #04122E 0%, #020D21 55%, #010814 100%)",
      }}
    >
      <Image
        src="/logo-gf.png"
        alt="GymFitness"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        priority
        unoptimized
      />
    </span>
  );

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {href ? (
        <Link href={href} aria-label="GymFitness — início">
          {mark}
        </Link>
      ) : (
        mark
      )}
      {showName && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Gym<span className="text-brand">Fitness</span>
        </span>
      )}
    </div>
  );
}