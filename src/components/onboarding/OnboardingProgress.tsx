import { Progress } from "~/components/ui/progress";

/** Barra de progresso do onboarding, animada via scaleX (standards §2). */
export function OnboardingProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="space-y-1.5">
      <Progress value={pct} className="h-1.5" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{pct}% concluído</span>
        <span>
          Passo {current} de {total}
        </span>
      </div>
    </div>
  );
}