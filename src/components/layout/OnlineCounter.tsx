"use client";

import { Flame } from "lucide-react";
import { useOnlineCount } from "~/hooks/useOnlineCount";
import { cn } from "~/lib/utils";

/**
 * "X pessoas treinando agora", dot "ao vivo" pulsante + contador mono.
 * Flame é ícone SVG lucide, não emoji (anti-slop).
 */
export function OnlineCounter({
  gymId,
  className,
}: {
  gymId?: string;
  className?: string;
}) {
  const { count, loading } = useOnlineCount(gymId);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="font-mono font-semibold text-foreground">
        {loading ? "…" : count}
      </span>
      <span className="text-muted-foreground">treinando agora</span>
      <Flame className="h-3.5 w-3.5 text-brand" />
    </div>
  );
}