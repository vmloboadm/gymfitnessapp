"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { logger } from "~/lib/logger";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("auth.render_error", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h1 className="text-lg font-bold text-foreground">
          Erro no login
        </h1>
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar esta tela. Tente novamente.
        </p>
        <Button onClick={reset} variant="outline">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
