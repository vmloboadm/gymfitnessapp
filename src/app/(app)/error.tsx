"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { logger } from "~/lib/logger";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("app.render_error", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h1 className="text-lg font-bold text-foreground">
          Algo deu errado nesta tela
        </h1>
        <p className="text-sm text-muted-foreground">
          Tente novamente. Se o problema persistir, volte ao início.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="outline">
            Tentar novamente
          </Button>
          <Button onClick={() => (window.location.href = "/")}>
            Voltar ao início
          </Button>
        </div>
      </div>
    </div>
  );
}
