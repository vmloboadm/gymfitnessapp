"use client";

import dynamic from "next/dynamic";

/** Chat do Personal Digital carregado sob demanda (não está na primeira pintura). */
export const AiCoach = dynamic(() => import("~/components/ai/coach-chat"), {
  ssr: false,
});
