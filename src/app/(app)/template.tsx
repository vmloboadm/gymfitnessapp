"use client";

import { m } from "framer-motion";

/**
 * Transição de entrada em TODAS as telas do app.
 * Apenas opacidade: transform/filter aqui criariam um containing block e
 * quebrariam bottom sheets, modais e CTAs `fixed` no celular.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </m.div>
  );
}
