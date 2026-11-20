"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

/**
 * Consulta com cache (React Query). Diferente do useAsyncQuery, guarda o resultado
 * entre telas: voltar para a Home mostra o que já foi carregado, sem tela de
 * carregamento, e o dado é atualizado por trás.
 *
 * opts.key: nome único da consulta dentro da tela. deps: o que muda o resultado.
 */
export function useCachedQuery<T>(
  fetcher: () => Promise<{ data: T | null; error: { message: string } | null }>,
  deps: unknown[],
  opts: { key: string; enabled?: boolean; staleTime?: number }
): { data: T | null; loading: boolean; error: string | null; refetch: () => Promise<void> } {
  const q = useQuery<T | null>({
    queryKey: ["home", opts.key, ...deps],
    enabled: opts.enabled ?? true,
    staleTime: opts.staleTime ?? 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await fetcher();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  return {
    data: q.data ?? null,
    loading: q.isPending,
    error: q.error instanceof Error ? q.error.message : null,
    refetch: async () => {
      await q.refetch();
    },
  };
}
