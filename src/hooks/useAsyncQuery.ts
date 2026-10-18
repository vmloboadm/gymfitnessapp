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
 * - `enabled: false` pausa a busca (ex: aguardando profile) sem erro.
 * - Exceções do fetcher viram erro em vez de loading travado.
 * - `silentRefetch: true`: refetches de fundo (realtime/mutação) atualizam os
 *   dados sem trocar a tela por esqueleto (stale-while-revalidate). A primeira
 *   carga continua com loading normal; falha em fundo mantém os dados antigos.
 */
export function useAsyncQuery<T>(
  fetcher: () => Promise<{ data: T | null; error: { message: string } | null }>,
  deps: unknown[] = [],
  opts: { enabled?: boolean; silentRefetch?: boolean } = {}
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const enabled = opts.enabled ?? true;
  const silentRefetch = opts.silentRefetch ?? false;
  const hasLoadedRef = useRef(false);

  const run = useCallback(async () => {
    if (!enabled) return;
    const background = silentRefetch && hasLoadedRef.current;
    if (!background) setLoading(true);
    setError(null);
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
    try {
      const { data, error } = await fetcherRef.current();
      if (error) {
        // Modo demo: erros de permissão (RLS sem login) viram estado vazio limpo,
        // para o usuário conseguir navegar pelas telas sem tela inteira de erro.
        if (isDemo && /permission denied|JWT|not authorized|401|42501|must be authenticated/i.test(error.message)) {
          if (!background) setData(null);
        } else if (!background) {
          setError(error.message);
        }
      } else {
        setData(data);
      }
    } catch (e) {
      if (!background) setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, silentRefetch]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refetch: run };
}