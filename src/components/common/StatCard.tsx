import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatPercent } from "~/lib/utils/format";

/**
 * Card de métrica com delta (blueprint: todo número com delta + contexto).
 * Quando delta é null, omite a seta. Title + context em baixo.
 */
export function StatCard({
  label,
  value,
  delta,
  context,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  delta?: number | null;
  context?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  const positive = delta != null && delta > 0;
  const negative = delta != null && delta < 0;
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/60 p-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon ? <Icon className="h-4 w-4 text-brand/70" strokeWidth={1.75} /> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="gf-hero-num text-2xl">
          {value}
        </span>
        {delta != null ? (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-semibold tabular-nums",
              negative ? "text-destructive" : positive ? "text-success" : "text-muted-foreground"
            )}
          >
            {positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : negative ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {formatPercent(delta)}
          </span>
        ) : null}
      </div>
      {context ? <p className="mt-1 text-xs text-muted-foreground">{context}</p> : null}
    </div>
  );
}