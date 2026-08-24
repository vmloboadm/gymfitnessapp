"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Wrapper determinístico p/ queries do Supabase no cliente.
 * Garante os 4 estados do blueprint: loading / error / empty / success.
 */
export function useAsyncQuery<T>(
  fetcher: () => Promise<{ data: T | null; error: { message: string } | null }>,
  deps: unknown[] = []
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
    const { data, error } = await fetcherRef.current();
    if (error) {
      // Modo demo: erros de permissão (RLS sem login) viram estado vazio limpo,
      // para o usuário conseguir navegar pelas telas sem tela inteira de erro.
      if (isDemo && /permission denied|JWT|not authorized|401|42501|must be authenticated/i.test(error.message)) {
        setData(null);
      } else {
        setError(error.message);
      }
    } else {
      setData(data);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refetch: run };
}