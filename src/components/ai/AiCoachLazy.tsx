"use client";

import dynamic from "next/dynamic";

/** Chat do Assistente de Treino carregado sob demanda (fora da primeira pintura). */
export const AiCoach = dynamic(() => import("~/components/ai/coach-chat"), {
  ssr: false,
});
